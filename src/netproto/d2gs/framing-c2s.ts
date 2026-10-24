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
  if (opcode === 0x39) {
    return remaining >= 9 ? 9 : remaining >= 5 ? 5 : null
  }
  if (tableEntry > 0) {
    return remaining >= tableEntry ? tableEntry : null
  }

  // Variable-length C->S packets in D2NET_10006 (0x6fbf65d0): 0x14, 0x15, 0x66, 0x6C
  switch (opcode) {
    case 0x14: {
      // Overhead Chat: u8 0x14 | u16 0 | string msg\0 | u8 0 | u16 0
      if (remaining < 6) return null
      const msgEnd = findZeroByte(buf, offset + 3, offset + remaining)
      if (msgEnd < 0) return null
      const size = msgEnd - offset + 1 + 2
      return remaining >= size ? size : null
    }
    case 0x15: {
      // Chat Message: u8 0x15 | u8 type | u8 0 | string msg\0 | string target\0 | u8 0
      if (remaining < 6) return null
      const msgEnd = findZeroByte(buf, offset + 3, offset + remaining)
      if (msgEnd < 0) return null
      const targetEnd = findZeroByte(buf, msgEnd + 1, offset + remaining)
      if (targetEnd < 0) return null
      const size = targetEnd - offset + 2
      return remaining >= size ? size : null
    }
    case 0x66: {
      // Warden Response: u8 0x66 | u16 payloadLen | payload
      if (remaining < 3) return null
      const payloadLen = buf[offset + 1]! | (buf[offset + 2]! << 8)
      const size = payloadLen + 3
      return remaining >= size ? size : null
    }
    case 0x6c: {
      // Save Data Chunk: u8 0x6C | u8 chunkLen | ...
      if (remaining < 2) return null
      const size = buf[offset + 1]! + 6
      return remaining >= size ? size : null
    }
    default:
      throw new ProtocolError(`Unhandled variable-length C->S opcode 0x${opcode.toString(16).padStart(2, '0')}`, opcode, offset)
  }
}

/**
 * Validates that a serialized C->S packet matches `C2S_PACKET_SIZES` (`D2Net.dll` `0x6fbfabd8`).
 * Throws `ProtocolError` if the opcode is invalid or the byte length does not match.
 */
export function validateC2sPacket(
  bytes: Uint8Array,
): Uint8Array & { readonly valid: true; readonly opcode: number; readonly expectedLength: number } {
  if (bytes.length < 1) {
    throw new ProtocolError('Empty D2GS C->S packet')
  }
  const opcode = bytes[0]!
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
