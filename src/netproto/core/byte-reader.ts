/**
 * Little-endian byte stream reader with fail-fast ProtocolError on out-of-bounds reads.
 */

import { ProtocolError, type ProtocolConnectionKind } from './errors.ts'
import {
  defaultTextCodec,
  resolveTextCodec,
  type SupportedTextEncoding,
  type TextCodec,
} from './text-codec.ts'

export class ByteReader {
  private readonly buf: Uint8Array
  private readonly view: DataView
  private pos: number
  private readonly conn: ProtocolConnectionKind
  private readonly packetId: number | null

  constructor(
    buf: Uint8Array,
    offset = 0,
    conn: ProtocolConnectionKind = 'unknown',
    packetId: number | null = null,
  ) {
    this.buf = buf
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    this.pos = offset
    this.conn = conn
    this.packetId = packetId
  }

  get offset(): number {
    return this.pos
  }

  get length(): number {
    return this.buf.length
  }

  get remaining(): number {
    return this.buf.length - this.pos
  }

  private ensure(needed: number, field = 'bytes'): void {
    if (needed < 0 || this.pos + needed > this.buf.length) {
      throw new ProtocolError(
        this.conn,
        this.packetId,
        this.pos,
        `Truncated read of ${field}: needed ${needed}B at offset ${this.pos}, only ${this.remaining}B remaining (total ${this.buf.length}B)`,
        this.buf,
      )
    }
  }

  peekU8(lookahead = 0): number {
    this.ensure(lookahead + 1, 'peekU8')
    return this.buf[this.pos + lookahead]!
  }

  u8(): number {
    this.ensure(1, 'u8')
    const v = this.buf[this.pos]!
    this.pos += 1
    return v
  }

  i8(): number {
    this.ensure(1, 'i8')
    const v = this.view.getInt8(this.pos)
    this.pos += 1
    return v
  }

  u16(): number {
    this.ensure(2, 'u16')
    const v = this.view.getUint16(this.pos, true)
    this.pos += 2
    return v
  }

  u16LE(): number {
    return this.u16()
  }

  u16BE(): number {
    this.ensure(2, 'u16BE')
    const v = this.view.getUint16(this.pos, false)
    this.pos += 2
    return v
  }

  i16(): number {
    this.ensure(2, 'i16')
    const v = this.view.getInt16(this.pos, true)
    this.pos += 2
    return v
  }

  i16LE(): number {
    return this.i16()
  }

  u32(): number {
    this.ensure(4, 'u32')
    const v = this.view.getUint32(this.pos, true)
    this.pos += 4
    return v
  }

  u32LE(): number {
    return this.u32()
  }

  i32(): number {
    this.ensure(4, 'i32')
    const v = this.view.getInt32(this.pos, true)
    this.pos += 4
    return v
  }

  i32LE(): number {
    return this.i32()
  }

  u64BigInt(): bigint {
    this.ensure(8, 'u64')
    const lo = BigInt(this.view.getUint32(this.pos, true))
    const hi = BigInt(this.view.getUint32(this.pos + 4, true))
    this.pos += 8
    return (hi << 32n) | lo
  }

  bytes(len: number): Uint8Array {
    this.ensure(len, `bytes(${len})`)
    const out = this.buf.slice(this.pos, this.pos + len)
    this.pos += len
    return out
  }

  rest(): Uint8Array {
    return this.bytes(this.remaining)
  }

  skip(len: number): void {
    this.ensure(len, `skip(${len})`)
    this.pos += len
  }

  cstring(codecOrEncoding: TextCodec | SupportedTextEncoding = defaultTextCodec): string {
    const codec = resolveTextCodec(codecOrEncoding)
    const start = this.pos
    while (this.pos < this.buf.length && this.buf[this.pos] !== 0) {
      this.pos += 1
    }
    if (this.pos >= this.buf.length) {
      throw new ProtocolError(
        this.conn,
        this.packetId,
        start,
        `Unterminated cstring starting at offset ${start} (length ${this.buf.length})`,
        this.buf,
      )
    }
    const slice = this.buf.subarray(start, this.pos)
    this.pos += 1
    return codec.decode(slice)
  }

  cString(codecOrEncoding: TextCodec | SupportedTextEncoding = defaultTextCodec): string {
    return this.cstring(codecOrEncoding)
  }

  fixedString(
    len: number,
    codecOrEncoding: TextCodec | SupportedTextEncoding = defaultTextCodec,
  ): string {
    const codec = resolveTextCodec(codecOrEncoding)
    this.ensure(len, `fixedString(${len})`)
    const raw = this.buf.subarray(this.pos, this.pos + len)
    this.pos += len
    let end = 0
    while (end < raw.length && raw[end] !== 0) {
      end += 1
    }
    return codec.decode(raw.subarray(0, end))
  }

  fixedCString(
    len: number,
    codecOrEncoding: TextCodec | SupportedTextEncoding = defaultTextCodec,
  ): string {
    return this.fixedString(len, codecOrEncoding)
  }
}
