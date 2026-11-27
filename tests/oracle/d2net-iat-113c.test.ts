/**
 * Authoritative 11-slot `D2Game.dll` -> `D2Net.dll` IAT bridge (`0x6FD18B48..0x6FD18B70`)
 * parity tests against real v1.13c `D2Game.dll`, `D2Net.dll`, and `Fog.dll` PE binaries.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Heap113c } from '../../src/d2kern-113c/mem/heap.ts'
import {
  D2GAME_D2NET_IAT_113C,
  D2NET_MAX_PACKET_LEN_113C,
  D2NET_MODE_LOCAL_113C,
  D2NET_MODE_SERVER_113C,
  D2NetPacketSink113c,
  FOG_HUFFMAN_BIT_LENS_113C,
  FOG_HUFFMAN_CODES_113C,
  dispatchD2NetIat113c,
  fogCompressPacket113c,
  frameServerPacket113c,
} from '../../src/d2kern-113c/net/packet-sink.ts'
import { isOracleToolchainAvailable113c } from '../../tools/oracle/fn-daemon.ts'

interface PeImage {
  readonly buf: Uint8Array
  readonly dv: DataView
  readonly imageBase: number
  rvaToOffset(rva: number): number
  vaToOffset(va: number): number
  readAscii(offset: number): string
}

function parsePeImage(buf: Uint8Array): PeImage {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const eLfanew = dv.getUint32(0x3c, true)
  const numSections = dv.getUint16(eLfanew + 6, true)
  const optHdrSize = dv.getUint16(eLfanew + 20, true)
  const imageBase = dv.getUint32(eLfanew + 0x34, true)
  const secBase = eLfanew + 24 + optHdrSize

  const sections: Array<{ va: number; vsize: number; rawPtr: number; rawSize: number }> = []
  for (let i = 0; i < numSections; i++) {
    const off = secBase + i * 40
    sections.push({
      vsize: dv.getUint32(off + 8, true),
      va: dv.getUint32(off + 12, true),
      rawSize: dv.getUint32(off + 16, true),
      rawPtr: dv.getUint32(off + 20, true),
    })
  }

  const rvaToOffset = (rva: number): number => {
    for (const s of sections) {
      const span = Math.max(s.vsize, s.rawSize)
      if (rva >= s.va && rva < s.va + span) {
        return s.rawPtr + (rva - s.va)
      }
    }
    throw new RangeError(`Unmapped RVA 0x${rva.toString(16)}`)
  }

  return {
    buf,
    dv,
    imageBase,
    rvaToOffset,
    vaToOffset: (va: number) => rvaToOffset((va - imageBase) >>> 0),
    readAscii: (offset: number): string => {
      let out = ''
      for (let i = offset; i < buf.byteLength && buf[i] !== 0; i++) {
        out += String.fromCharCode(buf[i]!)
      }
      return out
    },
  }
}

function writeAsciiToMem(m: Heap113c, str: string): number {
  const ptr = m.alloc(str.length + 1)
  for (let i = 0; i < str.length; i++) {
    m.setU8(ptr + i, str.charCodeAt(i) & 0xff)
  }
  m.setU8(ptr + str.length, 0)
  return ptr
}

function readAsciiFromMem(m: Heap113c, ptr: number): string {
  let out = ''
  for (let i = 0; i < 256; i++) {
    const ch = m.u8(ptr + i)
    if (ch === 0) break
    out += String.fromCharCode(ch)
  }
  return out
}

const d2DataDir = process.env.D2_DATA_DIR ?? join(homedir(), 'd2-data')
const d2GamePath = join(d2DataDir, 'D2Game.dll')
const d2NetPath = join(d2DataDir, 'D2Net.dll')
const fogPath = join(d2DataDir, 'Fog.dll')

describe('D2Game.dll -> D2Net.dll 11-slot IAT bridge (0x6FD18B48..0x6FD18B70)', () => {
  it('matches D2Game.dll PE Import Directory, D2Net.dll Export Directory, and Fog.dll 0x6FF7F210 Huffman table 1:1', () => {
    expect(existsSync(d2GamePath)).toBe(true)
    expect(existsSync(d2NetPath)).toBe(true)
    expect(existsSync(fogPath)).toBe(true)

    const d2game = parsePeImage(readFileSync(d2GamePath))
    const d2net = parsePeImage(readFileSync(d2NetPath))
    const fog = parsePeImage(readFileSync(fogPath))
    expect(d2game.imageBase).toBe(0x6fc20000)
    expect(d2net.imageBase).toBe(0x6fbf0000)
    expect(fog.imageBase).toBe(0x6ff50000)

    // Verify Fog.dll 256-byte Huffman bit-length table at `0x6FF7F210` (`Fog.#10223`)
    const fogHuffOff = fog.vaToOffset(0x6ff7f210)
    const fogBitLens = fog.buf.subarray(fogHuffOff, fogHuffOff + 256)
    expect(Array.from(FOG_HUFFMAN_BIT_LENS_113C)).toEqual(Array.from(fogBitLens))

    // Parse D2Net.dll Export Directory
    const netELfanew = d2net.dv.getUint32(0x3c, true)
    const exportDirRva = d2net.dv.getUint32(netELfanew + 0x78, true)
    const exportDirOff = d2net.rvaToOffset(exportDirRva)
    const ordinalBase = d2net.dv.getUint32(exportDirOff + 16, true)
    const addressOfFunctionsRva = d2net.dv.getUint32(exportDirOff + 28, true)
    const addressOfFunctionsOff = d2net.rvaToOffset(addressOfFunctionsRva)

    // Parse D2Game.dll Import Directory and locate D2Net.dll descriptor
    const gameELfanew = d2game.dv.getUint32(0x3c, true)
    const importDirRva = d2game.dv.getUint32(gameELfanew + 0x80, true)
    let descOff = d2game.rvaToOffset(importDirRva)

    let foundSlots: Array<{ iatVa: number; ordinal: number }> | null = null
    while (true) {
      const origFirstThunk = d2game.dv.getUint32(descOff + 0, true)
      const nameRva = d2game.dv.getUint32(descOff + 12, true)
      const firstThunk = d2game.dv.getUint32(descOff + 16, true)
      if (origFirstThunk === 0 && nameRva === 0 && firstThunk === 0) break

      const dllName = d2game.readAscii(d2game.rvaToOffset(nameRva))
      if (dllName.toLowerCase() === 'd2net.dll') {
        foundSlots = []
        const thunkRva = origFirstThunk !== 0 ? origFirstThunk : firstThunk
        let idx = 0
        while (true) {
          const entry = d2game.dv.getUint32(d2game.rvaToOffset(thunkRva + idx * 4), true)
          if (entry === 0) break
          expect((entry & 0x80000000) !== 0).toBe(true) // imported by ordinal
          foundSlots.push({
            iatVa: (d2game.imageBase + firstThunk + idx * 4) >>> 0,
            ordinal: entry & 0xffff,
          })
          idx++
        }
        break
      }
      descOff += 20
    }

    expect(foundSlots).not.toBeNull()
    expect(foundSlots).toHaveLength(11)
    expect(D2GAME_D2NET_IAT_113C).toHaveLength(11)

    for (let i = 0; i < 11; i++) {
      const peSlot = foundSlots![i]!
      const meta = D2GAME_D2NET_IAT_113C[i]!
      expect(meta.slotIndex).toBe(i)
      expect(meta.iatVa).toBe(peSlot.iatVa)
      expect(meta.ordinal).toBe(peSlot.ordinal)

      // Verify D2Game indirect jump thunk `FF 25 <u32 iatVa>` at `meta.d2gameThunkVa`
      const thunkOff = d2game.vaToOffset(meta.d2gameThunkVa)
      expect(d2game.buf[thunkOff]).toBe(0xff)
      expect(d2game.buf[thunkOff + 1]).toBe(0x25)
      expect(d2game.dv.getUint32(thunkOff + 2, true)).toBe(meta.iatVa)

      // Verify D2Net export RVA & VA
      const exportedRva = d2net.dv.getUint32(
        addressOfFunctionsOff + (meta.ordinal - ordinalBase) * 4,
        true,
      )
      expect(meta.d2netRva).toBe(exportedRva)
      expect(meta.d2netVa).toBe((d2net.imageBase + exportedRva) >>> 0)

      // Verify stdcall `ret N` in D2Net.dll (Slot 0 #10003 is `E9` jmp thunk to WSAGetLastError `0` args)
      const fnOff = d2net.rvaToOffset(exportedRva)
      if (meta.ordinal === 10003) {
        expect(d2net.buf[fnOff]).toBe(0xe9)
        expect(meta.stackBytes).toBe(0)
      } else {
        let retImm: number | null = null
        const maxScan = meta.ordinal === 10002 ? 0x160 : 0x40
        for (let k = 0; k < maxScan; k++) {
          if (d2net.buf[fnOff + k] === 0xc2 && d2net.buf[fnOff + k + 2] === 0x00) {
            retImm = d2net.dv.getUint16(fnOff + k + 1, true)
            break
          }
        }
        expect(retImm).toBe(meta.stackBytes)
        expect(meta.stackBytes).toBe(meta.argCount * 4)
      }
    }
  })

  it('executes all 11 ordinals with exact binary return codes (#10017->0, #10002 Fog.#10223 framed len & >0x204 assert, Fog.#10156 full len on truncation, #10000 closing non-zero, #10009 +0xBBC without close callback)', () => {
    const heap = new Heap113c()
    const sink = new D2NetPacketSink113c({ netMode: D2NET_MODE_SERVER_113C })

    // 1. Slot 0 (#10003 @ 0x6FD18B48): WSAGetLastError initially 0
    expect(sink.getLastError()).toBe(0)
    expect(dispatchD2NetIat113c(0x6fd18b48, heap, [], sink)).toBe(0)

    // 2. Slot 1 (#10017 @ 0x6FD18B4C): missing client NEVER returns '127.0.0.1'; writes '\0' and returns 0.
    //    Found client copies IPv4 C-string (`SStrCopy`) and ALSO returns 0 (`LeaveCriticalSection` at 0x6FF5D9C8).
    expect(sink.getClientAddress(99)).toBeNull()
    const ipBuf = heap.alloc(16)
    for (let i = 0; i < 16; i++) heap.setU8(ipBuf + i, 0x5a)
    expect(dispatchD2NetIat113c(sink, 0x6fd18b4c, heap, [99, ipBuf, 16])).toBe(0)
    expect(heap.u8(ipBuf)).toBe(0)
    expect(readAsciiFromMem(heap, ipBuf)).toBe('')

    sink.registerClient(7, '192.168.50.12', 0xdeadbeef, 2) // refCount=2 models active QServer session + in-flight ref
    expect(sink.getClientAddress(7)).toBe('192.168.50.12')
    expect(dispatchD2NetIat113c(0x6fd18b4c, heap, [7, ipBuf, 16], sink)).toBe(0)
    expect(readAsciiFromMem(heap, ipBuf)).toBe('192.168.50.12')

    // 3. Slot 6 (#10015 @ 0x6FD18B60) & Slot 10 (#10021 @ 0x6FD18B70)
    expect(dispatchD2NetIat113c(sink, 0x6fd18b60, heap, [999])).toBe(0)
    dispatchD2NetIat113c(sink, 0x6fd18b70, heap, [999, 0x11223344])
    expect(dispatchD2NetIat113c(sink, 0x6fd18b60, heap, [999])).toBe(0)

    expect(dispatchD2NetIat113c(sink, 0x6fd18b60, heap, [7]) >>> 0).toBe(0xdeadbeef)
    dispatchD2NetIat113c(sink, 0x6fd18b70, heap, [7, 0xcafebabe])
    expect(dispatchD2NetIat113c(sink, 0x6fd18b60, heap, [7]) >>> 0).toBe(0xcafebabe)

    expect(dispatchD2NetIat113c(sink, 0x6fd18b60, heap, [0])).toBe(0)
    dispatchD2NetIat113c(sink, 0x6fd18b70, heap, [0, 0x778899aa])
    expect(dispatchD2NetIat113c(sink, 0x6fd18b60, heap, [0]) >>> 0).toBe(0x778899aa)

    // 4. Slot 7 (#10002 @ 0x6FD18B64):
    //    - Missing client in server mode returns 0 (`Fog.#10157` `0x6FF5E8C0` returns 0 without modifying Winsock error)
    //    - Active client in server mode returns framed Fog.#10223 length (`compLen + 1` or `compLen + 2`; raw `nLen` on Q0 `0xAF` or Q2)
    //    - Local mode (`netMode = 1` or `2` at `0x6FBF6432`) returns raw `nLen` even if client slot is absent
    //    - Packet > 0x204 asserts (`RangeError` matching `0x6FBF63EE..0x6FBF6410`)
    const rawChat = new Uint8Array([0x26, 0x01, 0x00, 0x02, 0x48, 0x69, 0x00])
    const pktPtr = heap.alloc(8)
    heap.loadBlock(pktPtr, rawChat)
    expect(dispatchD2NetIat113c(sink, 0x6fd18b64, heap, [0, 999, pktPtr, 7])).toBe(0)
    expect(sink.pendingCount).toBe(0)

    const expectedCompLen = fogCompressPacket113c(rawChat)
    const expectedFramed = frameServerPacket113c(0, rawChat)
    expect(expectedFramed.byteLength).toBe(expectedCompLen + 1)
    expect(expectedFramed[0]).toBe(expectedCompLen + 1)

    expect(dispatchD2NetIat113c(sink, 0x6fd18b64, heap, [0, 7, pktPtr, 7])).toBe(
      expectedFramed.byteLength,
    )

    // Q0 `0xAF` (`LOGON_CHALLENGE`) bypasses Huffman framing at `0x6FBF6452` and returns raw length 2
    const logonPtr = heap.alloc(4)
    heap.loadBlock(logonPtr, new Uint8Array([0xaf, 0x01]))
    expect(dispatchD2NetIat113c(sink, 0x6fd18b64, heap, [0, 7, logonPtr, 2])).toBe(2)

    // Oversized (> 0x204) packet hits Fog.#10024 assert (`RangeError`), NOT silent 0
    expect(() =>
      dispatchD2NetIat113c(sink, 0x6fd18b64, heap, [0, 7, pktPtr, D2NET_MAX_PACKET_LEN_113C + 1]),
    ).toThrow(RangeError)

    // 2-byte header framing (`compLen + 1 >= 0xF0`) for large high-entropy payload <= 0x204
    const bigPayload = new Uint8Array(300)
    for (let i = 0; i < bigPayload.length; i++) bigPayload[i] = 0xc0 | (i & 0x3f) // 11-bit symbols -> >240B compressed
    const bigFramed = frameServerPacket113c(1, bigPayload)
    expect(bigFramed.byteLength).toBeGreaterThanOrEqual(0xf1)
    expect(bigFramed[0]! & 0xf0).toBe(0xf0)
    expect(((bigFramed[0]! & 0x0f) << 8) | bigFramed[1]!).toBe(bigFramed.byteLength)
    expect(sink.sendPacket(1, 7, bigPayload)).toBe(bigFramed.byteLength)

    const drained = sink.drainClient(7)
    expect(drained).toHaveLength(3)
    expect(drained[0]!.opcode).toBe(0x26)
    expect(Array.from(drained[0]!.bytes)).toEqual(Array.from(rawChat))
    expect(Array.from(drained[0]!.wireBytes!)).toEqual(Array.from(expectedFramed))
    expect(Array.from(drained[1]!.wireBytes!)).toEqual([0xaf, 0x01])

    // Local mode (`0x6FBF6432: mov eax, esi`) returns raw `nLen` even if client slot is absent or disconnected
    const localSink = new D2NetPacketSink113c({ netMode: D2NET_MODE_LOCAL_113C })
    expect(dispatchD2NetIat113c(localSink, 0x6fd18b64, heap, [0, 1, pktPtr, 7])).toBe(7)
    localSink.registerClient(55, '127.0.0.1')
    localSink.disconnectClient(55)
    expect(dispatchD2NetIat113c(localSink, 0x6fd18b64, heap, [0, 55, pktPtr, 7])).toBe(7)

    // 5. Slots 4 (#10035 Q0), 3 (#10016 Q1), 5 (#10014 Q2): Fog.#10156 (`0x6FF5DA60`)
    const rxBuf = heap.alloc(0x200)
    expect(dispatchD2NetIat113c(sink, 0x6fd18b58, heap, [rxBuf, 0x200])).toBe(-1)
    expect(dispatchD2NetIat113c(sink, 0x6fd18b54, heap, [rxBuf, 0x200])).toBe(-1)
    expect(dispatchD2NetIat113c(sink, 0x6fd18b5c, heap, [rxBuf, 0x200])).toBe(-1)

    expect(sink.enqueueC2SPacket(7, new Uint8Array([0x68, 0x01, 0x02, 0x03]), 0)).toBe(true)
    expect(sink.enqueueC2SPacket(7, new Uint8Array([0x03, 0x10, 0x27, 0x20, 0x13]), 1)).toBe(true)
    expect(sink.enqueueC2SPacket(42, new Uint8Array([0xf1, 0x99]), 2)).toBe(true)
    expect(sink.inboundPendingCount()).toBe(3)

    // Dequeue Q0 (#10035): full buffer -> returns 4
    expect(dispatchD2NetIat113c(sink, 0x6fd18b58, heap, [rxBuf, 0x200])).toBe(4)
    expect(heap.u32(rxBuf)).toBe(7)
    expect([heap.u8(rxBuf + 4), heap.u8(rxBuf + 5), heap.u8(rxBuf + 6), heap.u8(rxBuf + 7)]).toEqual(
      [0x68, 0x01, 0x02, 0x03],
    )

    // Dequeue Q1 (#10016) with truncated `nMaxLen = 6` (`4`B clientId + `2`B of `5`B payload):
    // `Fog.#10156` copies 6 bytes AND still returns full payload length `5` (`0x6FF5DB22` -> `0x6FF5DB66`)!
    for (let i = 0; i < 12; i++) heap.setU8(rxBuf + i, 0xee)
    expect(dispatchD2NetIat113c(sink, 0x6fd18b54, heap, [rxBuf, 6])).toBe(5)
    expect(heap.u32(rxBuf)).toBe(7)
    expect([heap.u8(rxBuf + 4), heap.u8(rxBuf + 5), heap.u8(rxBuf + 6)]).toEqual([0x03, 0x10, 0xee])

    // Even when `nMaxLen < 4` (`nMaxLen = 2`), `Fog.#10156` does NOT return -1: copies 2 bytes of clientId and returns full payload length `2`
    for (let i = 0; i < 8; i++) heap.setU8(rxBuf + i, 0xdd)
    expect(dispatchD2NetIat113c(sink, 0x6fd18b5c, heap, [rxBuf, 2])).toBe(2)
    expect([heap.u8(rxBuf), heap.u8(rxBuf + 1), heap.u8(rxBuf + 2)]).toEqual([42, 0, 0xdd])
    expect(sink.inboundPendingCount()).toBe(0)

    // 6. Slot 9 (#10009 @ 0x6FD18B6C), Slot 2 (#10000 @ 0x6FD18B50), Slot 8 (#10001 @ 0x6FD18B68)
    //    `#10009` writes `[ghQServer + 0xBBC] = eax` and leaves `eax = pfnCloseCallback`; nothing invokes `+0xBBC` on disconnect.
    expect(dispatchD2NetIat113c(sink, 0x6fd18b6c, heap, [0x6fc4d2f0]) >>> 0).toBe(0x6fc4d2f0)
    expect(sink.getCloseCallbackVa()).toBe(0x6fc4d2f0)

    // Missing client returns 0; active client 7 (refCount=2) transitions to closing (`[ebx+0x0C]=1`), returning non-zero (1),
    // and calling `#10000` AGAIN on the already-closing client ALSO returns non-zero (`[ebx+0x0C] == 1` at `0x6FF5E562`)!
    expect(dispatchD2NetIat113c(sink, 0x6fd18b50, heap, [999])).toBe(0)
    expect(dispatchD2NetIat113c(sink, 0x6fd18b50, heap, [7])).toBeGreaterThan(0)
    expect(dispatchD2NetIat113c(sink, 0x6fd18b50, heap, [7])).toBe(1)
    // Sending to a closing client fails (`0x6FF5E8D3`) and returns 0
    expect(dispatchD2NetIat113c(sink, 0x6fd18b64, heap, [0, 7, pktPtr, 7])).toBe(0)
    // Releasing the final ref unlinks client 7 (`0x6FF5E1B0`); subsequent `#10000` sees NULL (`0x6FF5E55A`) and returns 0
    expect(sink.releaseClientRef(7)).toBe(0)
    expect(sink.getClientAddress(7)).toBeNull()
    expect(dispatchD2NetIat113c(sink, 0x6fd18b50, heap, [7])).toBe(0)

    // Drop client with source file & line (#10001 @ 0x6FD18B68 — void __stdcall in Fog.#10162 `0x6FF5EC10`, callers ignore eax)
    const srcFilePtr = writeAsciiToMem(heap, 'D2Game/Net/Clients.cpp')
    dispatchD2NetIat113c(sink, 0x6fd18b68, heap, [888, srcFilePtr, 312])
    sink.registerClient(12, '10.20.30.40', 0x55)
    dispatchD2NetIat113c(sink, 0x6fd18b68, heap, [12, srcFilePtr, 312])
    expect(sink.getDroppedClients()).toEqual([
      { clientId: 12, sourceFile: 'D2Game/Net/Clients.cpp', sourceLine: 312 },
    ])
    expect(sink.getClientAddress(12)).toBeNull()
  })

  it('matches live Wine Fog.#10218 / Fog.#10223 / D2Net.#10002 output byte-for-byte across all 778 Huffman & framing test vectors (256 single bytes, lengths 1..0x204, 238->EF / 239->F0 F1 boundary)', () => {
    expect(isOracleToolchainAvailable113c()).toBe(true)
    const repoRoot = resolve(import.meta.dirname, '../..')
    const oracleRoot = process.env.D2_ORACLE_ROOT ?? join(homedir(), '.local/opt/d2oracle')
    const buildScript = join(repoRoot, 'tools/oracle/headless/build.sh')
    const pfx = mkdtempSync(join(tmpdir(), 'd2host-huff-'))
    let ndjsonText = ''
    try {
      const buildDir = process.env.ORACLE_BUILD ?? join(pfx, 'build')
      execFileSync('bash', [buildScript, buildDir], { cwd: repoRoot, stdio: 'pipe', timeout: 30_000 })
      cpSync(join(oracleRoot, 'wine/prefix'), pfx, { recursive: true, verbatimSymlinks: true })
      const wineDir = join(oracleRoot, 'wine/root/usr/lib/x86_64-linux-gnu/wine')
      const driveD2 = join(pfx, 'drive_c/D2')
      cpSync(join(buildDir, 'd2host-113c.exe'), join(driveD2, 'd2host-113c.exe'))
      const env = {
        ...process.env,
        WINEPREFIX: pfx,
        WINESERVER: join(wineDir, 'wineserver'),
        WINELOADER: join(wineDir, 'wine'),
        WINEDEBUG: '-all',
        WINEDLLOVERRIDES: 'mscoree,mshtml=;winex11.drv=;winedbg.exe=d',
        DISPLAY: '',
      }
      execFileSync(
        join(wineDir, 'wine'),
        ['d2host-113c.exe', '--test-huffman', 'C:\\D2\\huffman.ndjson'],
        { cwd: driveD2, env, stdio: 'pipe', timeout: 30_000 },
      )
      try {
        execFileSync(join(wineDir, 'wineserver'), ['-k'], { env, stdio: 'ignore', timeout: 5_000 })
      } catch {
        // ignore wineserver shutdown status
      }
      ndjsonText = readFileSync(join(driveD2, 'huffman.ndjson'), 'utf8')
    } finally {
      rmSync(pfx, { recursive: true, force: true })
    }

    const lines = ndjsonText.trim().split('\n')
    expect(lines.length).toBe(778) // 256 single + 2 0xAF + 516 len (1..0x204) + 4 boundary (237..240)

    let singleCount = 0
    let lenSweepCount = 0
    let sawBoundary238 = false
    let sawBoundary239 = false

    for (let i = 0; i < lines.length; i++) {
      const v = JSON.parse(lines[i]!) as {
        idx: number
        q: number
        ret: number
        raw: string
        comp: string
        wire: string
      }
      expect(v.idx).toBe(i)
      const input = new Uint8Array(Buffer.from(v.raw, 'hex'))

      const compBuf = new Uint8Array(0x408)
      const tsCompLen = fogCompressPacket113c(input, compBuf)
      expect(Buffer.from(compBuf.subarray(0, tsCompLen)).toString('hex'), `idx=${v.idx} comp`).toBe(
        v.comp,
      )

      const tsWire = frameServerPacket113c(v.q, input)
      expect(tsWire.byteLength, `idx=${v.idx} ret`).toBe(v.ret)
      expect(Buffer.from(tsWire).toString('hex'), `idx=${v.idx} wire`).toBe(v.wire)

      if (v.idx < 256) singleCount++
      else if (v.idx >= 258 && v.idx < 258 + 0x204) lenSweepCount++
      else if (v.idx >= 258 + 0x204) {
        if (tsCompLen === 238) {
          expect(tsWire[0]).toBe(0xef)
          expect(tsWire.byteLength).toBe(239)
          sawBoundary238 = true
        }
        if (tsCompLen === 239) {
          expect(tsWire[0]).toBe(0xf0)
          expect(tsWire[1]).toBe(0xf1)
          expect(tsWire.byteLength).toBe(241)
          sawBoundary239 = true
        }
      }
    }

    expect(singleCount).toBe(256)
    expect(lenSweepCount).toBe(0x204)
    expect(sawBoundary238).toBe(true)
    expect(sawBoundary239).toBe(true)
  }, 60_000)

  it('rejects unknown IAT VAs and under-supplied stdcall argument lists', () => {
    const heap = new Heap113c()
    const sink = new D2NetPacketSink113c()
    expect(() => dispatchD2NetIat113c(sink, 0x6fd18b74, heap, [])).toThrow(RangeError)
    expect(() => dispatchD2NetIat113c(sink, 0x6fd18b64, heap, [0, 1])).toThrow(RangeError)
  })
})
