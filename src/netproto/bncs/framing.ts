/**
 * BNCS (Battle.net Chat Server, Port 6112) stream framing (`0xFF | u8 id | u16 len`).
 * Client sends 1-byte protocol greeting `0x01` upon connection.
 */

import { ProtocolError } from '../core/errors.ts'

export const BNCS_GREETING_BYTE = 0x01
export const BNCS_HEADER_MAGIC = 0xff

export interface BncsRawPacket {
  readonly id: number
  readonly payload: Uint8Array
  readonly raw: Uint8Array
}

export function encodeBncsFrame(packetId: number, payload: Uint8Array): Uint8Array {
  const totalLen = 4 + payload.length
  if (totalLen > 0xffff) {
    throw new ProtocolError('bnet', packetId, 0, `BNCS packet too large (${totalLen}B)`)
  }
  const out = new Uint8Array(totalLen)
  out[0] = BNCS_HEADER_MAGIC
  out[1] = packetId & 0xff
  out[2] = totalLen & 0xff
  out[3] = (totalLen >>> 8) & 0xff
  out.set(payload, 4)
  return out
}

export class BncsFramer {
  private buf: Uint8Array = new Uint8Array(4096)
  private head = 0
  private tail = 0

  push(chunk: Uint8Array): BncsRawPacket[] {
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

    const packets: BncsRawPacket[] = []
    let offset = 0
    const avail = this.tail - this.head

    while (avail - offset >= 4) {
      const pos = this.head + offset
      const magic = this.buf[pos]!
      if (magic !== BNCS_HEADER_MAGIC) {
        throw new ProtocolError(
          'bnet',
          null,
          offset,
          `Invalid BNCS frame magic 0x${magic.toString(16).padStart(2, '0')} (expected 0xFF)`,
          this.buf.slice(pos, this.tail),
        )
      }
      const id = this.buf[pos + 1]!
      const totalLen = this.buf[pos + 2]! | (this.buf[pos + 3]! << 8)
      if (totalLen < 4) {
        throw new ProtocolError(
          'bnet',
          id,
          offset,
          `Invalid BNCS frame length ${totalLen} (< 4)`,
          this.buf.slice(pos, this.tail),
        )
      }
      if (avail - offset < totalLen) {
        break
      }
      const raw = this.buf.slice(pos, pos + totalLen)
      const payload = raw.subarray(4)
      packets.push({ id, payload, raw })
      offset += totalLen
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
