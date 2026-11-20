/**
 * MCP (`d2cs` Realm Server, Port 6113) stream framing (`u16 len | u8 id`).
 * Verified against `D2MCPClient.dll` (1.13c). Client sends 1-byte greeting `0x01` on connect.
 */

import { ProtocolError } from '../core/errors.ts'

export const MCP_GREETING_BYTE = 0x01

export interface McpRawPacket {
  readonly id: number
  readonly payload: Uint8Array
  readonly raw: Uint8Array
}

export function encodeMcpFrame(packetId: number, payload: Uint8Array): Uint8Array {
  const totalLen = 3 + payload.length
  if (totalLen > 0xffff) {
    throw new ProtocolError('realm', packetId, 0, `MCP packet too large (${totalLen}B)`)
  }
  const out = new Uint8Array(totalLen)
  out[0] = totalLen & 0xff
  out[1] = (totalLen >>> 8) & 0xff
  out[2] = packetId & 0xff
  out.set(payload, 3)
  return out
}

export class McpFramer {
  private buf: Uint8Array = new Uint8Array(4096)
  private head = 0
  private tail = 0

  push(chunk: Uint8Array): McpRawPacket[] {
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

    const packets: McpRawPacket[] = []
    let offset = 0
    const avail = this.tail - this.head

    while (avail - offset >= 3) {
      const pos = this.head + offset
      const totalLen = this.buf[pos]! | (this.buf[pos + 1]! << 8)
      const id = this.buf[pos + 2]!
      if (totalLen < 3) {
        throw new ProtocolError(
          'realm',
          id,
          offset,
          `Invalid MCP frame length ${totalLen} (< 3)`,
          this.buf.slice(pos, this.tail),
        )
      }
      if (avail - offset < totalLen) {
        break
      }
      const raw = this.buf.slice(pos, pos + totalLen)
      const payload = raw.subarray(3)
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
