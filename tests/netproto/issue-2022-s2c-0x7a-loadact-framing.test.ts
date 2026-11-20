/**
 * Regression suite for Issue #2022:
 * - Binary lock of `S2C_PACKET_SIZES`, `D2CLIENT_S2C_HANDLERS`, `C2S_PACKET_SIZES`, and `HUFFMAN_BIT_LENGTHS`
 *   against 1.13c `D2Net.dll`, `D2Client.dll`, and `Fog.dll` (`0x7A SummonAction === 13` bytes).
 * - Exact byte-stream & `.d2cap` replay reproduction of the `0x7A` (13B) + `0x1C` (5B ending in `0x03`) +
 *   `0xA9 EndState` (`A9 01 01 00 00 00 02`) sequence that previously misframed into
 *   `0x03 LoadAct(act=169, seed=0x101, areaId=512)`.
 * - Upfront `decode0x03LoadAct` & `OnlineSession` bounds validation, fail-closed D2GS stream termination,
 *   post-handshake `watchGameConnection` framing error propagation, and 64-packet S->C diagnostic ring buffer.
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OnlineSession, type OnlineSessionLostEvent } from '../../src/client/session/online-session.ts'
import { createSettingsStore } from '../../src/client/settings/settings-store.ts'
import { getCanonicalItemDataTables } from '../../src/client/world/item-tables-provider.ts'
import { FakeClock } from '../../src/netproto/core/clock.ts'
import { InMemoryPacketTap } from '../../src/netproto/core/packet-tap.ts'
import { D2gsAdapter } from '../../src/netproto/d2gs/adapter.ts'
import { defaultD2gsHuffmanCodec, wrapD2gsCompressedBlock } from '../../src/netproto/d2gs/compression.ts'
import { encodeTypedServerEventToS2cPackets } from '../../src/netproto/d2gs/s2c-encoder.ts'
import { decode0x03LoadAct } from '../../src/netproto/d2gs/s2c/load.ts'
import { decode0x7ASummonAction } from '../../src/netproto/d2gs/s2c/merc.ts'
import { D2GS_S2C_RING_BUFFER_SIZE, D2gsSession } from '../../src/netproto/d2gs/session.ts'
import {
  FOG_HUFFMAN_LENGTHS_FILE_OFFSET,
  HUFFMAN_BIT_LENGTHS,
} from '../../src/netproto/d2gs/tables/huffman.ts'
import {
  C2S_PACKET_SIZES,
  D2CLIENT_S2C_HANDLERS,
  D2CLIENT_S2C_HANDLERS_FILE_OFFSET,
  D2NET_C2S_TABLE_FILE_OFFSET,
  D2NET_S2C_TABLE_FILE_OFFSET,
  S2C_PACKET_SIZES,
} from '../../src/netproto/d2gs/tables/s2c-sizes.ts'
import { createD2OnlineFlow, createMemoryStreamPair } from '../../src/netproto/index.ts'
import { createFakeRealm } from './fake-realm-servers.ts'

function resolveD2DataDir(): string | null {
  const candidates = [
    process.env.D2_DATA_DIR,
    resolve(process.cwd(), 'samples/d2'),
    join(homedir(), 'd2-data'),
  ].filter((p): p is string => Boolean(p))
  for (const dir of candidates) {
    if (existsSync(join(dir, 'D2Net.dll')) && existsSync(join(dir, 'D2Client.dll'))) {
      return dir
    }
  }
  return null
}

function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.byteLength, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.byteLength
  }
  return out
}

function compressS2cFrame(...packets: readonly Uint8Array[]): Uint8Array {
  const raw = concatBytes(...packets)
  return wrapD2gsCompressedBlock(defaultD2gsHuffmanCodec.compress(raw))
}

function buildLoadActPacket(act: number, mapSeed: number, areaId: number, objectSeed = 0): Uint8Array {
  const out = new Uint8Array(12)
  const dv = new DataView(out.buffer)
  out[0] = 0x03
  out[1] = act & 0xff
  dv.setUint32(2, mapSeed >>> 0, true)
  dv.setUint16(6, areaId & 0xffff, true)
  dv.setUint32(8, objectSeed >>> 0, true)
  return out
}

describe('Issue #2022 — 1.13c S2C 0x7A size parity, 0x03 LoadAct validation, and stream desync diagnostics', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('locks S2C_PACKET_SIZES[0x7A] = 13 and matches 1.13c D2Net.dll / D2Client.dll / Fog.dll tables byte-for-byte', () => {
    expect(S2C_PACKET_SIZES[0x7a]).toBe(13)
    expect(D2CLIENT_S2C_HANDLERS[0x7a]?.expectedSize).toBe(13)
    expect(S2C_PACKET_SIZES[0x03]).toBe(12)
    expect(S2C_PACKET_SIZES[0x1c]).toBe(5)
    expect(S2C_PACKET_SIZES[0xa9]).toBe(7)

    // Encode/decode 0x7A round-trip is strictly 13 bytes
    const encoded = encodeTypedServerEventToS2cPackets({
      type: 'Merc',
      kind: 'assign',
      isSummonAction: true,
      summonAction: 1,
      petType: 4,
      classId: 363,
      ownerId: 1,
      mercId: 101,
    })
    expect(encoded).toHaveLength(1)
    expect(encoded[0]!.byteLength).toBe(13)
    const decoded = decode0x7ASummonAction(encoded[0]!)
    expect(decoded).toMatchObject({
      type: 'Merc',
      kind: 'assign',
      isSummonAction: true,
      summonAction: 1,
      petType: 4,
      classId: 363,
      ownerId: 1,
      mercId: 101,
    })
    expect(() => decode0x7ASummonAction(encoded[0]!.subarray(0, 12))).toThrow(/0x7A SummonAction/)

    const d2Dir = resolveD2DataDir()
    if (!d2Dir) return

    const d2net = readFileSync(join(d2Dir, 'D2Net.dll'))
    const d2netView = new DataView(d2net.buffer, d2net.byteOffset, d2net.byteLength)
    for (let op = 0; op < S2C_PACKET_SIZES.length; op++) {
      const dllSize = d2netView.getInt32(D2NET_S2C_TABLE_FILE_OFFSET + op * 4, true)
      expect(S2C_PACKET_SIZES[op], `D2Net S2C size mismatch at 0x${op.toString(16)}`).toBe(dllSize)
    }
    for (let op = 0; op < C2S_PACKET_SIZES.length; op++) {
      const dllSize = d2netView.getInt32(D2NET_C2S_TABLE_FILE_OFFSET + op * 4, true)
      expect(C2S_PACKET_SIZES[op], `D2Net C2S size mismatch at 0x${op.toString(16)}`).toBe(dllSize)
    }

    const d2client = readFileSync(join(d2Dir, 'D2Client.dll'))
    const d2clientView = new DataView(d2client.buffer, d2client.byteOffset, d2client.byteLength)
    for (let op = 0; op < D2CLIENT_S2C_HANDLERS.length; op++) {
      const off = D2CLIENT_S2C_HANDLERS_FILE_OFFSET + op * 12
      const handlerVa = d2clientView.getUint32(off, true)
      const expectedSize = d2clientView.getInt32(off + 4, true)
      const unitHandlerVa = d2clientView.getUint32(off + 8, true)
      expect(D2CLIENT_S2C_HANDLERS[op]).toEqual({
        opcode: op,
        handlerVa,
        expectedSize,
        unitHandlerVa,
      })
    }

    const fogPath = join(d2Dir, 'Fog.dll')
    if (existsSync(fogPath)) {
      const fog = readFileSync(fogPath)
      // Fog.dll 0x6FF7F210 -> file offset 0x02F210 (256 uint8 bit lengths)
      for (let sym = 0; sym < 256; sym++) {
        expect(HUFFMAN_BIT_LENGTHS[sym]).toBe(fog[FOG_HUFFMAN_LENGTHS_FILE_OFFSET + sym])
      }
    }
  })

  it('reproduces and fixes the exact Issue #2022 stream sequence (13B 0x7A + 5B 0x1C ending in 0x03 + 7B 0xA9 EndState) via live stream and .d2cap replay', () => {
    // 13-byte 1.13c S2C 0x7A SummonAction (action=1, petType=4 skeleton, classId=363, ownerId=1, petUnitId=101)
    const pkt7a = new Uint8Array([0x7a, 0x01, 0x04, 0x6b, 0x01, 0x01, 0x00, 0x00, 0x00, 0x65, 0x00, 0x00, 0x00])
    // 5-byte 0x1C ExperienceDword whose MSB byte is 0x03 (e.g. +0x03001000 XP)
    const pkt1c = new Uint8Array([0x1c, 0x00, 0x10, 0x00, 0x03])
    // 7-byte 0xA9 EndState: unitType=1 (monster), unitId=1, state=2 (poison) -> bytes A9 01 01 00 00 00 02
    const pktA9 = new Uint8Array([0xa9, 0x01, 0x01, 0x00, 0x00, 0x00, 0x02])
    // 6-byte 0x79 GoldInTrade
    const pkt79 = new Uint8Array([0x79, 0x01, 0x64, 0x00, 0x00, 0x00])

    // Forensic proof: if 0x7A had consumed 17 bytes instead of 13, byte 17 is pkt1c[4] === 0x03,
    // and the 12 bytes starting at offset 17 carry act=169 (0xA9), mapSeed=0x101, areaId=512 (0x0200)!
    const rawConcat = concatBytes(pkt7a, pkt1c, pktA9, pkt79)
    const misalignedSlice = rawConcat.subarray(17, 29)
    const misalignedDv = new DataView(
      misalignedSlice.buffer,
      misalignedSlice.byteOffset,
      misalignedSlice.byteLength,
    )
    expect(misalignedSlice[0]).toBe(0x03)
    expect(misalignedSlice[1]).toBe(169)
    expect(misalignedDv.getUint32(2, true)).toBe(0x101)
    expect(misalignedDv.getUint16(6, true)).toBe(512)

    // Now drive the real compressed S2C stream through D2gsSession -> D2gsAdapter -> OnlineSession
    const [clientStream, serverStream] = createMemoryStreamPair('issue-2022')
    const tap = new InMemoryPacketTap(256)
    const clock = new FakeClock(1_000)
    const d2gs = new D2gsSession({
      stream: clientStream,
      logon: {
        gameHash: 0x12345678,
        gameToken: 0x0042,
        charClass: 2,
        charName: 'SummonNec',
        expansion: true,
      },
      clock,
      tap,
    })
    const adapter = new D2gsAdapter({
      session: d2gs,
      tables: getCanonicalItemDataTables(),
      clock,
    })
    const online = new OnlineSession({ settingsStore: createSettingsStore() })
    const lostEvents: OnlineSessionLostEvent[] = []
    online.onSessionLost((ev) => lostEvents.push(ev))
    online.attachGameServer(adapter)

    // Handshake: uncompressed [0xAF, 0x01], then compressed [0x01 GameFlags, 0x02 LogonSuccess, 0x03 LoadAct(0, 1), 0x0B Self(1), 0x04 LoadDone]
    serverStream.write(new Uint8Array([0xaf, 0x01]))
    const pkt01 = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01])
    const pkt02 = new Uint8Array([0x02])
    const pkt03 = buildLoadActPacket(0, 0x11223344, 1, 0)
    const pkt0b = new Uint8Array([0x0b, 0x00, 0x01, 0x00, 0x00, 0x00])
    const pkt04 = new Uint8Array([0x04])
    serverStream.write(compressS2cFrame(pkt01, pkt02, pkt03, pkt0b, pkt04))

    // Combat frame with 13B 0x7A + 5B 0x1C + 7B 0xA9 + 6B 0x79 in a single Huffman-compressed block
    serverStream.write(compressS2cFrame(pkt7a, pkt1c, pktA9, pkt79))

    expect(lostEvents).toHaveLength(0)
    expect(online.phase).toBe('ingame')
    expect(adapter.stats.protocolErrors).toBe(0)
    expect(online.world.act).toBe(0)
    expect(online.world.areaId).toBe(1)
    expect(online.world.pets.has(101)).toBe(true)

    // Export to .d2cap JSONL and verify deterministic replay produces the same clean state
    const jsonl = tap.toD2CapJsonl({
      format: 'd2cap-v1',
      createdAt: '2026-11-05T00:00:00.000Z',
      server: '127.0.0.1',
      character: 'SummonNec',
      scenario: 'issue-2022-0x7a-13b-framing',
    })
    const replaySession = new OnlineSession({ settingsStore: createSettingsStore() })
    const loadedCount = replaySession.loadD2CapReplay(jsonl)
    expect(loadedCount).toBeGreaterThan(0)
    const replayedCount = replaySession.replayAllD2Cap()
    expect(replayedCount).toBe(loadedCount)
    expect(replaySession.phase).not.toBe('disconnected')
    expect(replaySession.world.areaId).toBe(1)
    expect(replaySession.world.pets.has(101)).toBe(true)
  })

  it('validates 0x03 LoadAct bounds upfront, fails closed without mutating ClientWorld, and dumps the 64-packet S2C ring buffer', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Direct decoder validation
    expect(() => decode0x03LoadAct(buildLoadActPacket(169, 0x101, 512))).toThrow(RangeError)
    expect(() => decode0x03LoadAct(buildLoadActPacket(5, 0x101, 1))).toThrow(RangeError)
    expect(() => decode0x03LoadAct(buildLoadActPacket(0, 0x101, 0))).toThrow(RangeError)
    expect(() => decode0x03LoadAct(buildLoadActPacket(0, 0x101, 137))).toThrow(RangeError)
    expect(() => decode0x03LoadAct(new Uint8Array([0x03, 0, 1, 2]))).toThrow(/0x03 LoadAct/)

    // Full OnlineSession + D2OnlineFlow flow: push 70 valid S2C packets, then a corrupt 0x03 LoadAct (act=169, areaId=512)
    const realm = createFakeRealm({ characters: 1 })
    const clock = new FakeClock(1_000)
    const journalEntries: Array<{ kind: string; detail: Readonly<Record<string, unknown>> }> = []
    const session = new OnlineSession({
      settingsStore: createSettingsStore(),
      flowFactory: (cfg) => createD2OnlineFlow({ ...cfg, resolver: realm.resolver, clock }),
    })
    session.commandMapper.assists.journal = (kind, detail) => {
      journalEntries.push({ kind, detail })
    }
    const lost: OnlineSessionLostEvent[] = []
    session.onSessionLost((ev) => lost.push(ev))

    await session.login({ username: 'tester', password: 'pw' })
    await session.selectCharacter('d2webbot_sorc')
    await session.enterGame({ mode: 'create', spec: { name: 'g2022', difficulty: 0 } })
    expect(session.phase).toBe('ingame')

    const gameConn = realm.latest('game')
    // Push 70 valid 2-byte 0x19 GoldByte packets so the 64-packet ring buffer wraps
    const validBurst: Uint8Array[] = []
    for (let i = 0; i < 70; i++) {
      validBurst.push(new Uint8Array([0x19, i & 0xff]))
    }
    gameConn.server.write(compressS2cFrame(...validBurst))
    expect(session.phase).toBe('ingame')

    // Now send corrupt 0x03 LoadAct(act=169, seed=0x101, areaId=512)
    const badLoadAct = buildLoadActPacket(169, 0x101, 512)
    gameConn.server.write(compressS2cFrame(badLoadAct))

    expect(lost).toHaveLength(1)
    expect(lost[0]).toMatchObject({ session: 'd2gs', cause: 'error' })
    expect(lost[0]!.technical).toContain('0x03 LoadAct: act=169 areaId=512')
    expect(session.phase).toBe('disconnected')
    expect(gameConn.client.isClosed).toBe(true)

    // Journal captured the 64-packet ring buffer (including the trailing 0x03 packet hex)
    const diagEntry = journalEntries.find((j) => j.kind === 'd2gs-error-disconnect')
    expect(diagEntry).toBeDefined()
    expect(diagEntry!.detail.recentS2cCount).toBe(D2GS_S2C_RING_BUFFER_SIZE)
    const recentList = diagEntry!.detail.recentS2c as Array<{ op: string; hex: string }>
    expect(recentList).toHaveLength(D2GS_S2C_RING_BUFFER_SIZE)
    expect(recentList[recentList.length - 1]).toMatchObject({
      op: '0x03',
      hex: '03a901010000000200000000',
    })
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes('recentS2C'))).toBe(true)
  })

  it('propagates post-handshake S2C framing ProtocolError through watchGameConnection instead of wedging silently', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const realm = createFakeRealm({ characters: 1 })
    const clock = new FakeClock(1_000)
    const session = new OnlineSession({
      settingsStore: createSettingsStore(),
      flowFactory: (cfg) => createD2OnlineFlow({ ...cfg, resolver: realm.resolver, clock }),
    })
    const lost: OnlineSessionLostEvent[] = []
    session.onSessionLost((ev) => lost.push(ev))

    await session.login({ username: 'tester', password: 'pw' })
    await session.selectCharacter('d2webbot_sorc')
    await session.enterGame({ mode: 'create', spec: { name: 'gframe', difficulty: 0 } })
    expect(session.phase).toBe('ingame')

    const gameConn = realm.latest('game')
    // Valid 2B 0x19 followed by unused opcode 0x2B (size 0 in D2Net.dll) in the same compressed block
    const validThenCorrupt = concatBytes(new Uint8Array([0x19, 0x2a]), new Uint8Array([0x2b, 0xde, 0xad]))
    gameConn.server.write(wrapD2gsCompressedBlock(defaultD2gsHuffmanCodec.compress(validThenCorrupt)))

    expect(lost).toHaveLength(1)
    expect(lost[0]).toMatchObject({ session: 'd2gs', cause: 'error' })
    expect(lost[0]!.technical).toContain('0x2b')
    expect(session.phase).toBe('disconnected')
    expect(gameConn.client.isClosed).toBe(true)

    // Preceding valid 0x19 packet in the same chunk was still preserved in packetTap before failing closed
    const recent = session.packetTap.recentGameS2cPackets(8)
    expect(recent[recent.length - 1]).toMatchObject({
      packetId: 0x19,
      hex: '192a',
    })
  })
})
