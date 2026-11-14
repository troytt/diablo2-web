/**
 * Diablo II: Lord of Destruction v1.13c `D2Game.dll` -> `D2Net.dll` 11-slot IAT bridge
 * (`0x6FD18B48..0x6FD18B70`) and bidirectional S2C/C2S `ByteStream` packet boundary.
 *
 * Binary provenance (`kb/network/d2game-d2net-iat-113c.md`):
 * - `D2Game.dll` ImageBase `0x6FC20000`, `D2Net.dll` IAT at `0x6FD18B48..0x6FD18B70` (11 slots)
 * - `D2Net.dll` ImageBase `0x6FBF0000`, `Fog.dll` ImageBase `0x6FF50000` (`QServer` `#10156..#10173`,
 *   Huffman packet compressor `Fog.#10223` `0x6FF6EE60` initialized by `Fog.#10218`/`#10219` `0x6FF6EFD0`)
 * - Missing/invalid `nClientId` NEVER synthesizes `'127.0.0.1'`: `#10017` (`Fog.#10159` `0x6FF5D940`)
 *   writes `szOutBuf[0] = '\0'` when missing (`SStrCopy` when found) and returns `0` (`LeaveCriticalSection`);
 *   `#10000` returns `0` when missing and non-zero (`[ebx+0x0C]`) when already closing (`0x6FF5E562`);
 *   `#10002` asserts (`RangeError`) on `nLen > 0x204`, returns `nLen` in local mode and framed compressed
 *   length in server mode (`0` when client missing/closing); `#10035`/`#10016`/`#10014` (`Fog.#10156`
 *   `0x6FF5DA60`) return `-1` when empty and full un-truncated payload length even when `nMaxLen` truncates.
 */
import type { Memory113c } from '../mem/sparse-memory.ts'

export const D2NET_MAX_PACKET_LEN_113C = 0x204 // 516 bytes (`cmp esi, 0x204` at `0x6FBF63EE`)
export const D2NET_MAX_DEQUEUE_BUF_113C = 0x5b4 // 1460 bytes (`mov eax, 0x5B4` at `Fog.#10156 0x6FF5DA8B`)
export const D2NET_C2S_QUEUE_COUNT_113C = 3 // Q0 handshake (#10035), Q1 gameplay (#10016), Q2 admin (#10014)

export const D2NET_QUEUE_SYSTEM_113C = 0 // `#10035` (`0x6FD18B58`)
export const D2NET_QUEUE_GAMEPLAY_113C = 1 // `#10016` (`0x6FD18B54`)
export const D2NET_QUEUE_ADMIN_113C = 2 // `#10014` (`0x6FD18B5C`)

export const D2NET_MODE_SERVER_113C = 0 // `[0x6FBFB418] == 0`: QServer framed Huffman + strict client lookup
export const D2NET_MODE_LOCAL_113C = 1 // `[0x6FBFB418] == 1`: local loopback (`0x6FBF641A`)
export const WSAENOTCONN_113C = 10057

/**
 * Authoritative 256-byte Huffman bit-length table from `Fog.dll` `.data` at `0x6FF7F210`
 * (passed to `Fog.#10219` `0x6FF6EFD0` at the tail of `Fog.#10218` `0x6FF6F58E`).
 */
export const FOG_HUFFMAN_BIT_LENS_113C = new Uint8Array([
  1, 4, 6, 7, 7, 6, 7, 7, 7, 8, 7, 8, 8, 7, 9, 8,
  8, 8, 7, 6, 6, 7, 8, 8, 8, 9, 9, 10, 10, 8, 7, 8,
  8, 10, 10, 10, 10, 9, 10, 10, 9, 10, 10, 10, 10, 10, 10, 11,
  9, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 9, 10, 10, 10, 10,
  9, 10, 10, 9, 10, 9, 10, 10, 10, 10, 10, 10, 9, 9, 10, 11,
  9, 8, 9, 10, 11, 9, 9, 10, 9, 10, 10, 10, 11, 10, 10, 10,
  10, 10, 9, 9, 9, 10, 10, 7, 7, 7, 10, 9, 8, 7, 10, 10,
  10, 11, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11, 10, 10, 10, 10,
  7, 10, 10, 10, 11, 11, 11, 11, 11, 10, 10, 11, 11, 11, 11, 10,
  9, 11, 11, 10, 11, 9, 9, 9, 10, 11, 11, 11, 11, 11, 11, 11,
  10, 11, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11,
  10, 11, 11, 11, 11, 11, 11, 11, 10, 11, 11, 11, 11, 11, 11, 11,
  10, 11, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 10, 11,
  11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11,
  10, 11, 10, 11, 11, 11, 11, 11, 10, 11, 11, 11, 11, 11, 11, 11,
  10, 11, 11, 11, 11, 11, 11, 11, 10, 11, 11, 11, 11, 11, 11, 6,
])

/**
 * Exact `Fog.#10219` (`0x6FF6EFD0..0x6FF6F2AC`) canonical Huffman code builder writing `0x6FF80DD0`
 * (`0x6FF80DD0` is zero in the `Fog.dll` PE image and built at runtime by `Fog.#10218` `0x6FF6F550`
 * -> `Fog.#10219` `0x6FF6EFD0` from the 256-byte bit-length table at `0x6FF7F210`).
 */
export function buildFogHuffmanCodes113c(bitLens: Uint8Array = FOG_HUFFMAN_BIT_LENS_113C): Uint8Array {
  const counts = new Int32Array(16)
  for (let sym = 0; sym < 256; sym++) {
    const len = bitLens[sym]!
    if (len === 0 || len >= 16) {
      throw new RangeError(`Invalid Fog Huffman bit length ${len} at symbol ${sym}`)
    }
    counts[len] = counts[len]! + 1
  }

  const offsets = new Int32Array(16)
  let acc = 0
  for (let len = 15; len >= 1; len--) {
    offsets[len] = acc
    acc += counts[len]!
  }

  const order = new Uint8Array(256)
  for (let sym = 0; sym < 256; sym++) {
    const len = bitLens[sym]!
    const pos = offsets[len]!
    order[pos] = sym
    offsets[len] = pos + 1
  }

  const codes = new Uint8Array(256)
  codes[order[0]!] = 0
  for (let i = 0; i < 255; i++) {
    const prevSym = order[i]!
    const nextSym = order[i + 1]!
    const diff = bitLens[prevSym]! - bitLens[nextSym]!
    codes[nextSym] = ((codes[prevSym]! + 1) >> diff) & 0xff
  }
  return codes
}

export const FOG_HUFFMAN_CODES_113C = buildFogHuffmanCodes113c(FOG_HUFFMAN_BIT_LENS_113C)

/**
 * Exact `Fog.#10223` (`0x6FF6EE60..0x6FF6EF04`) S2C packet Huffman compressor:
 * `int __fastcall Fog_CompressPacket(uint8_t* dst, int dstMax, const uint8_t* src, int srcLen)`
 */
export function fogCompressPacket113c(
  src: Uint8Array,
  dst: Uint8Array = new Uint8Array(0x408),
): number {
  const srcLen = src.byteLength
  if (srcLen === 0) return 0

  let remCap = dst.byteLength
  let outPos = 0
  let dl = 0
  let freeBits = 8 // `esi` in `0x6FF6EE75`

  for (let i = 0; i < srcLen; i++) {
    const sym = src[i]!
    let ecx = FOG_HUFFMAN_BIT_LENS_113C[sym]!
    const code = FOG_HUFFMAN_CODES_113C[sym]!

    while (ecx >= freeBits) {
      ecx -= freeBits
      if (remCap === 0) return 0
      remCap--
      const bl = (((code >>> ecx) & 0xff) | dl) & 0xff
      dst[outPos++] = bl
      dl = 0
      freeBits = 8
    }

    if (ecx > 0) {
      freeBits -= ecx
      dl = (dl | ((code << freeBits) & 0xff)) & 0xff
    }
  }

  if (freeBits < 8) {
    if (remCap === 0) return 0
    dst[outPos++] = dl
  }

  return outPos
}

/**
 * Exact `D2Net.#10002` (`0x6FBF643E..0x6FBF653B`) server-mode wire framing:
 * - Unframed raw pass-through when `(nQueue & 0xFF) === 0 && payload[0] === 0xAF` or `(nQueue & 0xFF) === 2`.
 * - Otherwise `Fog.#10223` Huffman payload prefixed with 1-byte (`< 0xF0`) or 2-byte (`>= 0xF0`) frame length header.
 */
export function frameServerPacket113c(nQueue: number, payload: Uint8Array): Uint8Array {
  const bl = nQueue & 0xff
  if ((bl === 0 && payload.byteLength > 0 && payload[0] === 0xaf) || bl === 2) {
    return payload.slice()
  }

  const scratch = new Uint8Array(0x408)
  const compLen = fogCompressPacket113c(payload, scratch)
  if (compLen === 0) {
    // `0x6FBF647F..0x6FBF649D`: `Fog.#10024` assertion (`0x6FBF9244` `""`, line `0x16F` = 367) + `exit(-1)`
    throw new RangeError('D2Net.#10002 Fog.#10223 compressed length == 0 (0x6FBF9244 "":367)')
  }

  const len1 = compLen + 1
  if (len1 < 0xf0) {
    const framed = new Uint8Array(len1)
    framed[0] = len1 & 0xff
    framed.set(scratch.subarray(0, compLen), 1)
    return framed
  }

  const len2 = compLen + 2
  const framed = new Uint8Array(len2)
  framed[0] = 0xf0 | ((len2 >>> 8) & 0x0f)
  framed[1] = len2 & 0xff
  framed.set(scratch.subarray(0, compLen), 2)
  return framed
}

export interface CapturedS2CPacket113c {
  readonly queue: number
  readonly clientId: number
  readonly opcode: number
  readonly bytes: Uint8Array
  readonly wireBytes?: Uint8Array
}

export type CapturedS2CPacket = CapturedS2CPacket113c

export interface QueuedC2SPacket113c {
  readonly queue: 0 | 1 | 2
  readonly clientId: number
  readonly opcode: number
  readonly bytes: Uint8Array
}

export interface DroppedClientRecord113c {
  readonly clientId: number
  readonly sourceFile: string
  readonly sourceLine: number
}

export interface D2NetClientRecord113c {
  readonly clientId: number
  address: string
  gameTag: number
  closing: boolean // `[pClient + 0x0C]` checked at `0x6FF5E562` & `0x6FF5E8D3`
  refCount: number // `[pClient + 0x08]` decremented at `0x6FF5E5A3`
}

export interface PacketSink {
  sendPacket(nQueue: number, nClientId: number, payload: Uint8Array): number
  sendPacketFromMemory(
    m: Memory113c,
    nQueue: number,
    nClientId: number,
    pPacket: number,
    nLen: number,
  ): number
  drain(clientId?: number): CapturedS2CPacket113c[]
  drainClient(clientId: number): CapturedS2CPacket113c[]
  registerClient(nClientId: number, address: string, gameTag?: number, refCount?: number): void
  disconnectClient(nClientId: number): number
  getClientAddress(nClientId: number): string | null
}

export interface D2NetIatSlotMeta113c {
  readonly slotIndex: number
  readonly iatVa: number
  readonly d2gameThunkVa: number
  readonly ordinal: number
  readonly d2netRva: number
  readonly d2netVa: number
  readonly argCount: number
  readonly stackBytes: number
  readonly name: string
}

/**
 * Authoritative 11-entry `D2Game.dll` (`0x6FC20000`) PE Import Address Table for `D2Net.dll`
 * (`0x6FD18B48..0x6FD18B70`), in exact binary slot order.
 */
export const D2GAME_D2NET_IAT_113C: readonly D2NetIatSlotMeta113c[] = [
  {
    slotIndex: 0,
    iatVa: 0x6fd18b48,
    d2gameThunkVa: 0x6fc2a388,
    ordinal: 10003,
    d2netRva: 0x06a10,
    d2netVa: 0x6fbf6a10,
    argCount: 0,
    stackBytes: 0x00,
    name: 'D2Net_GetLastError',
  },
  {
    slotIndex: 1,
    iatVa: 0x6fd18b4c,
    d2gameThunkVa: 0x6fc2a382,
    ordinal: 10017,
    d2netRva: 0x06170,
    d2netVa: 0x6fbf6170,
    argCount: 3,
    stackBytes: 0x0c,
    name: 'D2Net_GetClientIpAddress',
  },
  {
    slotIndex: 2,
    iatVa: 0x6fd18b50,
    d2gameThunkVa: 0x6fc2a37c,
    ordinal: 10000,
    d2netRva: 0x06090,
    d2netVa: 0x6fbf6090,
    argCount: 1,
    stackBytes: 0x04,
    name: 'D2Net_DisconnectClient',
  },
  {
    slotIndex: 3,
    iatVa: 0x6fd18b54,
    d2gameThunkVa: 0x6fc2a376,
    ordinal: 10016,
    d2netRva: 0x061d0,
    d2netVa: 0x6fbf61d0,
    argCount: 2,
    stackBytes: 0x08,
    name: 'D2Net_DequeuePacketQ1',
  },
  {
    slotIndex: 4,
    iatVa: 0x6fd18b58,
    d2gameThunkVa: 0x6fc2a370,
    ordinal: 10035,
    d2netRva: 0x061b0,
    d2netVa: 0x6fbf61b0,
    argCount: 2,
    stackBytes: 0x08,
    name: 'D2Net_DequeuePacketQ0',
  },
  {
    slotIndex: 5,
    iatVa: 0x6fd18b5c,
    d2gameThunkVa: 0x6fc2a36a,
    ordinal: 10014,
    d2netRva: 0x06190,
    d2netVa: 0x6fbf6190,
    argCount: 2,
    stackBytes: 0x08,
    name: 'D2Net_DequeuePacketQ2',
  },
  {
    slotIndex: 6,
    iatVa: 0x6fd18b60,
    d2gameThunkVa: 0x6fc2a364,
    ordinal: 10015,
    d2netRva: 0x06000,
    d2netVa: 0x6fbf6000,
    argCount: 1,
    stackBytes: 0x04,
    name: 'D2Net_GetClientGameTag',
  },
  {
    slotIndex: 7,
    iatVa: 0x6fd18b64,
    d2gameThunkVa: 0x6fc2a35e,
    ordinal: 10002,
    d2netRva: 0x063e0,
    d2netVa: 0x6fbf63e0,
    argCount: 4,
    stackBytes: 0x10,
    name: 'D2Net_SendPacket',
  },
  {
    slotIndex: 8,
    iatVa: 0x6fd18b68,
    d2gameThunkVa: 0x6fc2a358,
    ordinal: 10001,
    d2netRva: 0x06110,
    d2netVa: 0x6fbf6110,
    argCount: 3,
    stackBytes: 0x0c,
    name: 'D2Net_DropClientSource',
  },
  {
    slotIndex: 9,
    iatVa: 0x6fd18b6c,
    d2gameThunkVa: 0x6fc2a394,
    ordinal: 10009,
    d2netRva: 0x06050,
    d2netVa: 0x6fbf6050,
    argCount: 1,
    stackBytes: 0x04,
    name: 'D2Net_SetCloseCallback',
  },
  {
    slotIndex: 10,
    iatVa: 0x6fd18b70,
    d2gameThunkVa: 0x6fc2a38e,
    ordinal: 10021,
    d2netRva: 0x06020,
    d2netVa: 0x6fbf6020,
    argCount: 2,
    stackBytes: 0x08,
    name: 'D2Net_SetClientGameTag',
  },
]

const IAT_BY_VA_113C = new Map<number, D2NetIatSlotMeta113c>(
  D2GAME_D2NET_IAT_113C.map((slot) => [slot.iatVa >>> 0, slot]),
)

export interface D2NetPacketSinkOptions113c {
  /** `gnNetMode` (`0x6FBFB418`): `0` = strict QServer client lookup, `1` = local loopback (default). */
  readonly netMode?: 0 | 1 | 2
}

function readCStringFromMemory(m: Memory113c, ptr: number, maxChars = 260): string {
  if (ptr === 0) return ''
  let s = ''
  for (let i = 0; i < maxChars; i++) {
    const ch = m.u8((ptr + i) >>> 0)
    if (ch === 0) break
    s += String.fromCharCode(ch)
  }
  return s
}

export class D2NetPacketSink113c implements PacketSink {
  private readonly outbox: CapturedS2CPacket113c[] = []
  private readonly inboundQueues: [
    QueuedC2SPacket113c[],
    QueuedC2SPacket113c[],
    QueuedC2SPacket113c[],
  ] = [[], [], []]
  private readonly clients = new Map<number, D2NetClientRecord113c>()
  private readonly disconnectedClients = new Set<number>()
  private readonly dropRecords: DroppedClientRecord113c[] = []
  private netMode: 0 | 1 | 2
  private lastError = 0
  private localGameTag = 0 // `[0x6FBFB428]` used when `nClientId == 0` in `#10015` / `#10021`
  private closeCallbackVa = 0 // `[ghQServer + 0xBBC]` written by `#10009` (`0x6FF5CFA0`, never read on disconnect)

  constructor(options: D2NetPacketSinkOptions113c = {}) {
    this.netMode = options.netMode !== undefined ? options.netMode : D2NET_MODE_LOCAL_113C
  }

  get mode(): 0 | 1 | 2 {
    return this.netMode
  }

  setMode(mode: 0 | 1 | 2): void {
    this.netMode = mode
  }

  /** `D2Net.#10003` (`0x6FBF6A10` / `IAT 0x6FD18B48`): `WSAGetLastError()`. */
  getLastError(): number {
    return this.lastError | 0
  }

  setLastError(errCode: number): void {
    this.lastError = errCode | 0
  }

  /** Register an active client in `QServer` (`[0x6FBFB424]`). */
  registerClient(nClientId: number, address: string, gameTag = 0, refCount = 1): void {
    const id = nClientId >>> 0
    this.disconnectedClients.delete(id)
    this.clients.set(id, {
      clientId: id,
      address,
      gameTag: gameTag >>> 0,
      closing: false,
      refCount: Math.max(1, refCount | 0),
    })
  }

  /** Alias preserved for caller compatibility; registers or updates client address. */
  setClientAddress(nClientId: number, address: string): void {
    const id = nClientId >>> 0
    const existing = this.clients.get(id)
    if (existing) {
      existing.address = address
    } else {
      this.registerClient(id, address, 0)
    }
  }

  /**
   * Release an in-flight `QServer` reference (`0x6FF5E420`). When `refCount` reaches `0` on a
   * closing client, unlinks the client from the `QServer` hash bucket (`0x6FF5E1B0`).
   */
  releaseClientRef(nClientId: number): number {
    const id = nClientId >>> 0
    const rec = this.clients.get(id)
    if (!rec) return 0
    rec.refCount = Math.max(0, rec.refCount - 1)
    if (rec.refCount === 0 && rec.closing) {
      this.clients.delete(id)
      this.disconnectedClients.add(id)
    }
    return rec.refCount
  }

  /**
   * Query registered client IPv4 string in `QServer` bucket, or `null` if `nClientId` is absent.
   * Never synthesizes a fake `'127.0.0.1'` fallback.
   */
  getClientAddress(nClientId: number): string | null {
    const rec = this.clients.get(nClientId >>> 0)
    return rec !== undefined ? rec.address : null
  }

  hasClient(nClientId: number): boolean {
    const rec = this.clients.get(nClientId >>> 0)
    return rec !== undefined && !rec.closing
  }

  /**
   * `D2Net.#10017` (`0x6FBF6170` -> `Fog.#10159` `0x6FF5D940` / `IAT 0x6FD18B4C`):
   * `int __stdcall D2Net_GetClientIpAddress(DWORD nClientId, char* szOutBuf, DWORD nBufSize)`
   * Missing client (`0x6FF5D9A2`): writes `szOutBuf[0] = 0` and returns `0`.
   * Found client (`0x6FF5D9BD..0x6FF5D9C8`): copies IPv4 string (`SStrCopy`) into `szOutBuf` and
   * returns `0` (`LeaveCriticalSection` `eax = 0`, NEVER `szOutBuf`).
   */
  getClientIpToMemory(
    m: Memory113c,
    nClientId: number,
    szOutBuf: number,
    nBufSize: number,
  ): number {
    const outPtr = szOutBuf >>> 0
    const maxLen = nBufSize >>> 0
    if (outPtr === 0) return 0

    const rec = this.clients.get(nClientId >>> 0)
    if (!rec) {
      m.setU8(outPtr, 0)
      return 0
    }

    if (maxLen > 0) {
      const copyChars = Math.min(rec.address.length, maxLen - 1)
      for (let i = 0; i < copyChars; i++) {
        m.setU8((outPtr + i) >>> 0, rec.address.charCodeAt(i) & 0xff)
      }
      m.setU8((outPtr + copyChars) >>> 0, 0)
    }
    return 0
  }

  /**
   * `D2Net.#10015` (`0x6FBF6000` -> `Fog.#10173` `0x6FF5E9F0` / `IAT 0x6FD18B60`):
   * `DWORD __stdcall D2Net_GetClientGameTag(DWORD nClientId)`
   * Returns `[0x6FBFB428]` when `nClientId == 0`, `[pClient + 0x20]` when registered, or `0` when missing.
   */
  getClientGameTag(nClientId: number): number {
    const id = nClientId >>> 0
    if (id === 0) return this.localGameTag | 0
    const rec = this.clients.get(id)
    return rec ? rec.gameTag | 0 : 0
  }

  /**
   * `D2Net.#10021` (`0x6FBF6020` -> `Fog.#10172` `0x6FF5EA20` / `IAT 0x6FD18B70`):
   * `void __stdcall D2Net_SetClientGameTag(DWORD nClientId, DWORD dwGameTag)`
   * Writes `[0x6FBFB428]` when `nClientId == 0`; updates `[pClient + 0x20]` only if `nClientId` is registered.
   */
  setClientGameTag(nClientId: number, dwGameTag: number): number {
    const id = nClientId >>> 0
    if (id === 0) {
      this.localGameTag = dwGameTag >>> 0
      return 0
    }
    const rec = this.clients.get(id)
    if (rec) {
      rec.gameTag = dwGameTag >>> 0
    }
    return 0
  }

  /**
   * `D2Net.#10009` (`0x6FBF6050` -> `Fog.#10171` `0x6FF5CFA0` / `IAT 0x6FD18B6C`):
   * `void __stdcall D2Net_SetCloseCallback(DWORD pfnCloseCallback)`
   * `0x6FF5CFA0`: `mov eax, [esp+8]; mov ecx, [esp+4]; mov [ecx+0xBBC], eax; ret 8`.
   * Note: `QServer` disconnect (`0x6FF5E5AD`) reads `+0xBC8`, never `+0xBBC`.
   */
  setCloseCallback(pfnCallbackVa: number): number {
    this.closeCallbackVa = pfnCallbackVa >>> 0
    return pfnCallbackVa | 0
  }

  getCloseCallbackVa(): number {
    return this.closeCallbackVa >>> 0
  }

  /**
   * `D2Net.#10000` (`0x6FBF6090` -> `Fog.#10165` `0x6FF5EAF0` -> `0x6FF5E550` / `IAT 0x6FD18B50`):
   * `BOOL __stdcall D2Net_DisconnectClient(DWORD nClientId)`
   * - Missing (`0x6FF5E4E0 == NULL`): returns `0`.
   * - Already marked closing (`[ebx + 0x0C] != 0` at `0x6FF5E562`): returns `[ebx + 0x0C]` (`1`, non-zero).
   * - Active (`[ebx + 0x0C] == 0`): sets `[ebx + 0x0C] = 1`, decrements `[ebx + 0x08]`; if `refCount > 0`
   *   stays in bucket as closing and returns `refCount` (non-zero); if `refCount == 0` unlinks & frees
   *   (`LeaveCriticalSection` `eax = 0`).
   */
  disconnectClient(nClientId: number): number {
    const id = nClientId >>> 0
    const rec = this.clients.get(id)
    if (!rec) {
      return 0
    }
    if (rec.closing) {
      return 1
    }
    rec.closing = true
    rec.refCount = Math.max(0, rec.refCount - 1)
    if (rec.refCount > 0) {
      return rec.refCount | 0
    }
    this.clients.delete(id)
    this.disconnectedClients.add(id)
    return 0
  }

  /**
   * `D2Net.#10001` (`0x6FBF6110` -> `Fog.#10162` `0x6FF5EC10` / `IAT 0x6FD18B68`):
   * `BOOL __stdcall D2Net_DropClientSource(DWORD nClientId, const char* szFile, DWORD nLine)`
   */
  dropClientSource(m: Memory113c, nClientId: number, szFilePtr: number, nLine: number): number {
    const id = nClientId >>> 0
    if (!this.clients.has(id)) {
      return 0
    }
    const sourceFile = readCStringFromMemory(m, szFilePtr >>> 0)
    this.dropRecords.push({
      clientId: id,
      sourceFile,
      sourceLine: nLine >>> 0,
    })
    this.disconnectClient(id)
    return 0
  }

  getDroppedClients(): readonly DroppedClientRecord113c[] {
    return this.dropRecords
  }

  private canDeliverToClient(nClientId: number): boolean {
    const id = nClientId >>> 0
    if (this.disconnectedClients.has(id)) {
      return false
    }
    if (this.netMode === D2NET_MODE_SERVER_113C) {
      const rec = this.clients.get(id)
      if (!rec || rec.closing) {
        return false
      }
    }
    return true
  }

  /**
   * `D2Net.#10002` (`0x6FBF63E0` / `IAT 0x6FD18B64`):
   * `DWORD __stdcall D2Net_SendPacket(DWORD nQueue, DWORD nClientId, const uint8_t* pPacket, DWORD nLen)`
   */
  sendPacketFromMemory(
    m: Memory113c,
    nQueue: number,
    nClientId: number,
    pPacket: number,
    nLen: number,
  ): number {
    const unsignedLen = nLen >>> 0
    if (unsignedLen > D2NET_MAX_PACKET_LEN_113C) {
      // `0x6FBF63EE..0x6FBF6410`: `cmp esi, 0x204; jbe ...` -> `Fog.#10024` (`0x6FBF9244` `""`, line `0x14F` = 335) + `exit(-1)`
      throw new RangeError(
        `D2Net.#10002 packet length 0x${unsignedLen.toString(16)} exceeds 0x204 limit (0x6FBF9244 "":335)`,
      )
    }
    const ptr = pPacket >>> 0
    if (ptr === 0 && unsignedLen > 0) {
      throw new RangeError('D2Net.#10002 null pPacket with non-zero length')
    }
    const bytes = new Uint8Array(unsignedLen)
    for (let i = 0; i < unsignedLen; i++) {
      bytes[i] = m.u8((ptr + i) >>> 0)
    }
    return this.sendPacketInternal(nQueue, nClientId, bytes)
  }

  /** Direct `Uint8Array` S2C send (`PacketSink.sendPacket`). */
  sendPacket(nQueue: number, nClientId: number, payload: Uint8Array): number {
    if (payload.byteLength > D2NET_MAX_PACKET_LEN_113C) {
      throw new RangeError(
        `D2Net.#10002 packet length 0x${payload.byteLength.toString(16)} exceeds 0x204 limit (0x6FBF9244 "":335)`,
      )
    }
    return this.sendPacketInternal(nQueue, nClientId, payload.slice())
  }

  private sendPacketInternal(nQueue: number, nClientId: number, bytes: Uint8Array): number {
    // Local loopback mode (`0x6FBF641A..0x6FBF643B`): calls `0x6FBF6BD0(pPacket, nLen)` and
    // executes `0x6FBF6432: mov eax, esi` (`return nLen`) unconditionally even if client slot is absent.
    if (this.netMode === 1 || this.netMode === 2) {
      if (bytes.byteLength === 0) return 0
      this.outbox.push({
        queue: nQueue | 0,
        clientId: nClientId >>> 0,
        opcode: bytes[0]!,
        bytes,
      })
      return bytes.byteLength
    }

    // Server mode (`0x6FBF643E..0x6FBF653B`): frames/compresses via `Fog.#10223` BEFORE `Fog.#10157`
    const wireBytes = frameServerPacket113c(nQueue, bytes)
    if (!this.canDeliverToClient(nClientId)) {
      return 0
    }
    this.outbox.push({
      queue: nQueue | 0,
      clientId: nClientId >>> 0,
      opcode: bytes.byteLength > 0 ? bytes[0]! : 0,
      bytes,
      wireBytes,
    })
    return wireBytes.byteLength
  }

  /** Alias preserved for existing callers (`sendPacketBytes`). */
  sendPacketBytes(nQueue: number, nClientId: number, payload: Uint8Array): number {
    return this.sendPacket(nQueue, nClientId, payload)
  }

  /**
   * Enqueue an inbound C2S packet onto `Fog.#10156` Queue `0` (`#10035`), `1` (`#10016`), or `2` (`#10014`).
   * Defaults to Queue `1` (gameplay C2S action stream).
   */
  enqueueC2SPacket(nClientId: number, payload: Uint8Array, queue: 0 | 1 | 2 = 1): boolean {
    if (queue !== 0 && queue !== 1 && queue !== 2) return false
    if (payload.byteLength === 0 || payload.byteLength + 4 > D2NET_MAX_DEQUEUE_BUF_113C) {
      return false
    }
    const bytes = payload.slice()
    this.inboundQueues[queue].push({
      queue,
      clientId: nClientId >>> 0,
      opcode: bytes[0]!,
      bytes,
    })
    return true
  }

  /** Dequeue next inbound C2S packet object from Queue `0`, `1`, or `2`, or `null` if empty. */
  dequeueC2SPacket(queue: 0 | 1 | 2 = 1): QueuedC2SPacket113c | null {
    if (queue !== 0 && queue !== 1 && queue !== 2) return null
    const next = this.inboundQueues[queue].shift()
    return next !== undefined ? next : null
  }

  inboundPendingCount(queue?: 0 | 1 | 2): number {
    if (queue !== undefined) {
      return this.inboundQueues[queue].length
    }
    return (
      this.inboundQueues[0].length + this.inboundQueues[1].length + this.inboundQueues[2].length
    )
  }

  /**
   * `Fog.#10156` (`0x6FF5DA60..0x6FF5DB69`) backing `#10035` (Q0), `#10016` (Q1), and `#10014` (Q2):
   * Clamps unsigned `nMaxLen` to `0x5B4`, copies `min(pktLen + 4, clampedMax)` bytes of
   * `[u32 nClientId][u8 payload...]` to `pOutBuf`, and returns the **full un-truncated `pktLen`**
   * (`mov esi, [ebx+0x5B4]` -> `mov eax, esi`), or `-1` when queue is empty / invalid.
   */
  dequeueC2SToMemory(
    m: Memory113c,
    queue: 0 | 1 | 2,
    pOutBuf: number,
    nMaxLen: number,
  ): number {
    const outPtr = pOutBuf >>> 0
    if (outPtr === 0 || (queue !== 0 && queue !== 1 && queue !== 2)) {
      return -1
    }
    const clampedMax = Math.min(nMaxLen >>> 0, D2NET_MAX_DEQUEUE_BUF_113C)
    const pkt = this.dequeueC2SPacket(queue)
    if (!pkt) {
      return -1
    }

    const totalEntryLen = pkt.bytes.byteLength + 4
    const copyTotal = Math.min(totalEntryLen, clampedMax)
    const cid = pkt.clientId >>> 0
    for (let i = 0; i < copyTotal; i++) {
      const b =
        i < 4 ? (cid >>> (i * 8)) & 0xff : pkt.bytes[i - 4]!
      m.setU8((outPtr + i) >>> 0, b)
    }
    return pkt.bytes.byteLength
  }

  /** Dispatch a `D2Game.dll` indirect call through `IAT 0x6FD18B48..0x6FD18B70`. */
  dispatchIat(iatVa: number, m: Memory113c, args: readonly number[] = []): number {
    const slot = IAT_BY_VA_113C.get(iatVa >>> 0)
    if (!slot) {
      throw new RangeError(
        `Unknown D2Game->D2Net IAT address 0x${(iatVa >>> 0).toString(16)} (expected 0x6fd18b48..0x6fd18b70)`,
      )
    }
    if (args.length < slot.argCount) {
      throw new RangeError(
        `${slot.name} (#${slot.ordinal} @ 0x${slot.iatVa.toString(16)}) expects ${slot.argCount} args, got ${args.length}`,
      )
    }

    switch (slot.ordinal) {
      case 10003:
        return this.getLastError()
      case 10017:
        return this.getClientIpToMemory(m, args[0]!, args[1]!, args[2]!)
      case 10000:
        return this.disconnectClient(args[0]!)
      case 10016:
        return this.dequeueC2SToMemory(m, 1, args[0]!, args[1]!)
      case 10035:
        return this.dequeueC2SToMemory(m, 0, args[0]!, args[1]!)
      case 10014:
        return this.dequeueC2SToMemory(m, 2, args[0]!, args[1]!)
      case 10015:
        return this.getClientGameTag(args[0]!)
      case 10002:
        return this.sendPacketFromMemory(m, args[0]!, args[1]!, args[2]!, args[3]!)
      case 10001:
        return this.dropClientSource(m, args[0]!, args[1]!, args[2]!)
      case 10009:
        return this.setCloseCallback(args[0]!)
      case 10021:
        return this.setClientGameTag(args[0]!, args[1]!)
      default:
        throw new Error(`Unhandled D2Net ordinal #${slot.ordinal}`)
    }
  }

  get pendingCount(): number {
    return this.outbox.length
  }

  peekAll(): readonly CapturedS2CPacket113c[] {
    return this.outbox
  }

  drainClient(clientId: number): CapturedS2CPacket113c[] {
    return this.drain(clientId)
  }

  drain(clientId?: number): CapturedS2CPacket113c[] {
    if (clientId === undefined) {
      return this.outbox.splice(0, this.outbox.length)
    }
    const target = clientId >>> 0
    const matched: CapturedS2CPacket113c[] = []
    let writeIdx = 0
    for (let i = 0; i < this.outbox.length; i++) {
      const pkt = this.outbox[i]!
      if (pkt.clientId === target) matched.push(pkt)
      else this.outbox[writeIdx++] = pkt
    }
    this.outbox.length = writeIdx
    return matched
  }

  clear(): void {
    this.outbox.length = 0
    this.inboundQueues[0].length = 0
    this.inboundQueues[1].length = 0
    this.inboundQueues[2].length = 0
    this.clients.clear()
    this.disconnectedClients.clear()
    this.dropRecords.length = 0
    this.lastError = 0
    this.localGameTag = 0
    this.closeCallbackVa = 0
  }
}

/**
 * Standalone dispatcher for `D2Game.dll` calls through `D2Net.dll` IAT (`0x6FD18B48..0x6FD18B70`).
 * Supports both `(iatVa, m, args, sink)` and `(sink, iatVa, m, args)` argument orders.
 */
export function dispatchD2NetIat113c(
  iatVa: number,
  m: Memory113c,
  args: readonly number[],
  sink: D2NetPacketSink113c,
): number
export function dispatchD2NetIat113c(
  sink: D2NetPacketSink113c,
  iatVa: number,
  m: Memory113c,
  args?: readonly number[],
): number
export function dispatchD2NetIat113c(
  first: number | D2NetPacketSink113c,
  second: Memory113c | number,
  third?: readonly number[] | Memory113c,
  fourth?: D2NetPacketSink113c | readonly number[],
): number {
  if (typeof first === 'number') {
    const sink = fourth as D2NetPacketSink113c | undefined
    if (!sink) {
      throw new TypeError('dispatchD2NetIat113c(iatVa, m, args, sink) requires a D2NetPacketSink113c')
    }
    const args = third as readonly number[] | undefined
    return sink.dispatchIat(first, second as Memory113c, args !== undefined ? args : [])
  }
  const args = fourth as readonly number[] | undefined
  return first.dispatchIat(second as number, third as Memory113c, args !== undefined ? args : [])
}
