import { ProtocolError } from '../core/errors.ts'
import { C2S_PACKET_SIZES } from './tables/s2c-sizes.ts'

/**
 * Resolves the expected byte length of a D2GS C->S packet per `D2NET_10006` (`0x6fbf65d0`)
 * and `C2S_PACKET_SIZES` (`0x6fbfabd8`).
 * Returns `null` if the buffer is shorter than the packet's variable-length header or complete payload.
 */
export function resolveC2sPacketSize(buf: Uint8Array, offset = 0): number | null {
  const remaining = buf.length - offset
  if (remaining < 1) return null
  const opcode = buf[offset]!
  if (opcode === 0xff) {
    return remaining >= 16 ? 16 : null
  }
  if (opcode >= C2S_PACKET_SIZES.length) {
    throw new ProtocolError(`Unknown D2GS C->S opcode 0x${opcode.toString(16).padStart(2, '0')}`, opcode, offset)
  }
  const tableEntry = C2S_PACKET_SIZES[opcode]!
  if (tableEntry === 0) {
    throw new ProtocolError(`Unused D2GS C->S opcode 0x${opcode.toString(16).padStart(2, '0')}`, opcode, offset)
  }
  if (tableEntry > 0) {
    return remaining >= tableEntry ? tableEntry : null
  }

  // Variable-length C->S packets in D2NET_10006 (0x6fbf65d0), index table 0x6fbf66f0 / jump table 0x6fbf66e0.
  switch (opcode) {
    case 0x14:
    case 0x15: {
      // Case 0x6fbf663a (shared): needs >= 3 bytes, then s1 = C string @3, s2 = C string after s1, b = the byte right
      // after s2's NUL; size = 3 + (strlen(s1)+1) + (strlen(s2)+1) + 1 + (int8)b (#1657). Each step waits for
      // more data while the buffer is shorter than what it has measured so far.
      if (remaining < 3) return null
      const end = offset + remaining
      const s1End = findZeroByte(buf, offset + 3, end)
      if (s1End < 0) return null
      const s2End = findZeroByte(buf, s1End + 1, end)
      if (s2End < 0) return null
      const bPos = s2End + 1
      if (bPos >= end) return null
      const b = (buf[bPos]! << 24) >> 24
      const size = bPos - offset + 1 + b
      if (size < 1) {
        throw new ProtocolError(
          `D2GS C->S packet 0x${opcode.toString(16).padStart(2, '0')} has a negative trailing length byte`,
          opcode,
          offset,
        )
      }
      return remaining >= size ? size : null
    }
    case 0x66: {
      // Case 0x6fbf6688: needs >= 3 bytes; size = (u16 @1 <= 0x1FD ? u16 @1 : 0) + 3 (#1657).
      if (remaining < 3) return null
      const payloadLen = buf[offset + 1]! | (buf[offset + 2]! << 8)
      const size = (payloadLen <= 0x1fd ? payloadLen : 0) + 3
      return remaining >= size ? size : null
    }
    case 0x6c: {
      // Case 0x6fbf66ab: needs >= 6 bytes; size = u8 @1 + 7 (#1657).
      if (remaining < 6) return null
      const size = buf[offset + 1]! + 7
      return remaining >= size ? size : null
    }
    default:
      throw new ProtocolError(`Unhandled variable-length C->S opcode 0x${opcode.toString(16).padStart(2, '0')}`, opcode, offset)
  }
}

/**
 * C->S opcodes whose 1.13c D2Game handler (dispatch table `0x6FD1A078`, 8-byte rows) is a bare
 * `mov eax,3; ret 8`, i.e. the server rejects them unconditionally (the same result as a size mismatch):
 * `0x2C` (`0x6FCEB1E0`), `0x2D` (`0x6FCEBDA0`), `0x39` (`0x6FCEB560`), `0x45` (`0x6FCEB550`), `0x52` (`0x6FCEB490`).
 * D2Net frames them with their fixed table size (`0x2C` has size 0 and is never framed at all); the client
 * must never emit them.
 */
export const D2GAME_REJECTED_C2S_OPCODES: ReadonlySet<number> = new Set([0x2c, 0x2d, 0x39, 0x45, 0x52])

/**
 * Validates that a serialized C->S packet matches `C2S_PACKET_SIZES` (`D2Net.dll` `0x6fbfabd8`).
 * Throws `ProtocolError` if the opcode is invalid, always rejected by D2Game
 * (`D2GAME_REJECTED_C2S_OPCODES`), or the byte length does not match.
 */
export function validateC2sPacket(
  bytes: Uint8Array,
): Uint8Array & { readonly valid: true; readonly opcode: number; readonly expectedLength: number } {
  if (bytes.length < 1) {
    throw new ProtocolError('Empty D2GS C->S packet')
  }
  const opcode = bytes[0]!
  if (D2GAME_REJECTED_C2S_OPCODES.has(opcode)) {
    throw new ProtocolError(
      `D2GS C->S packet 0x${opcode.toString(16).padStart(2, '0')} is always rejected by the 1.13c D2Game handler`,
      opcode,
      0,
    )
  }
  const expected = resolveC2sPacketSize(bytes, 0)
  if (expected === null || expected !== bytes.length) {
    const tableSize = opcode < C2S_PACKET_SIZES.length ? C2S_PACKET_SIZES[opcode] : 0
    throw new ProtocolError(
      `D2GS C->S packet 0x${opcode.toString(16).padStart(2, '0')} length mismatch: got ${bytes.length}, expected ${expected ?? tableSize}`,
      opcode,
      0,
    )
  }
  return Object.assign(bytes, { valid: true as const, opcode, expectedLength: expected })
}

export class D2gsC2sFramer {
  private buf: Uint8Array = new Uint8Array(4096)
  private head = 0
  private tail = 0

  push(chunk: Uint8Array): Uint8Array[] {
    if (chunk.byteLength === 0) return []
    if (this.head === this.tail) {
      this.head = 0
      this.tail = 0
    }
    const unread = this.tail - this.head
    if (this.tail + chunk.byteLength > this.buf.byteLength) {
      if (unread + chunk.byteLength <= this.buf.byteLength) {
        this.buf.copyWithin(0, this.head, this.tail)
        this.head = 0
        this.tail = unread
      } else {
        let nextCap = Math.max(4096, this.buf.byteLength * 2)
        while (nextCap < unread + chunk.byteLength) nextCap *= 2
        const next = new Uint8Array(nextCap)
        if (unread > 0) {
          next.set(this.buf.subarray(this.head, this.tail), 0)
        }
        this.buf = next
        this.head = 0
        this.tail = unread
      }
    }
    this.buf.set(chunk, this.tail)
    this.tail += chunk.byteLength

    const packets: Uint8Array[] = []
    const view = this.buf.subarray(this.head, this.tail)
    let offset = 0
    while (offset < view.byteLength) {
      const pktSize = resolveC2sPacketSize(view, offset)
      if (pktSize === null) break
      packets.push(view.slice(offset, offset + pktSize))
      offset += pktSize
    }
    if (offset > 0) {
      this.head += offset
      if (this.head === this.tail) {
        this.head = 0
        this.tail = 0
      }
    }
    return packets
  }

  get bufferedBytes(): number {
    return this.tail - this.head
  }

  reset(): void {
    this.head = 0
    this.tail = 0
  }
}

function findZeroByte(buf: Uint8Array, start: number, limit: number): number {
  for (let i = start; i < limit; i++) {
    if (buf[i] === 0) return i
  }
  return -1
}
