/**
 * Auto-growing little-endian byte buffer writer.
 */

import {
  defaultTextCodec,
  resolveTextCodec,
  type SupportedTextEncoding,
  type TextCodec,
} from './text-codec.ts'

export class ByteWriter {
  private buf: Uint8Array
  private view: DataView
  private len = 0

  constructor(initialCapacity = 64) {
    const cap = Math.max(16, initialCapacity)
    this.buf = new Uint8Array(cap)
    this.view = new DataView(this.buf.buffer)
  }

  get length(): number {
    return this.len
  }

  private ensureCapacity(extra: number): void {
    const needed = this.len + extra
    if (needed <= this.buf.length) return
    let nextCap = this.buf.length * 2
    while (nextCap < needed) {
      nextCap *= 2
    }
    const next = new Uint8Array(nextCap)
    next.set(this.buf.subarray(0, this.len))
    this.buf = next
    this.view = new DataView(this.buf.buffer)
  }

  u8(value: number): this {
    this.ensureCapacity(1)
    this.buf[this.len] = value & 0xff
    this.len += 1
    return this
  }

  i8(value: number): this {
    return this.u8(value)
  }

  u16(value: number): this {
    this.ensureCapacity(2)
    this.view.setUint16(this.len, value & 0xffff, true)
    this.len += 2
    return this
  }

  u16LE(value: number): this {
    return this.u16(value)
  }

  u16BE(value: number): this {
    this.ensureCapacity(2)
    this.view.setUint16(this.len, value & 0xffff, false)
    this.len += 2
    return this
  }

  i16(value: number): this {
    this.ensureCapacity(2)
    this.view.setInt16(this.len, value, true)
    this.len += 2
    return this
  }

  i16LE(value: number): this {
    return this.i16(value)
  }

  u32(value: number): this {
    this.ensureCapacity(4)
    this.view.setUint32(this.len, value >>> 0, true)
    this.len += 4
    return this
  }

  u32LE(value: number): this {
    return this.u32(value)
  }

  i32(value: number): this {
    this.ensureCapacity(4)
    this.view.setInt32(this.len, value | 0, true)
    this.len += 4
    return this
  }

  i32LE(value: number): this {
    return this.i32(value)
  }

  u64BigInt(value: bigint): this {
    this.ensureCapacity(8)
    const lo = Number(value & 0xffffffffn) >>> 0
    const hi = Number((value >> 32n) & 0xffffffffn) >>> 0
    this.view.setUint32(this.len, lo, true)
    this.view.setUint32(this.len + 4, hi, true)
    this.len += 8
    return this
  }

  bytes(chunk: Uint8Array): this {
    this.ensureCapacity(chunk.length)
    this.buf.set(chunk, this.len)
    this.len += chunk.length
    return this
  }

  cstring(text: string, codecOrEncoding: TextCodec | SupportedTextEncoding = defaultTextCodec): this {
    const codec = resolveTextCodec(codecOrEncoding)
    const encoded = codec.encode(text)
    this.bytes(encoded)
    this.u8(0)
    return this
  }

  cString(text: string, codecOrEncoding: TextCodec | SupportedTextEncoding = defaultTextCodec): this {
    return this.cstring(text, codecOrEncoding)
  }

  fixedString(
    text: string,
    byteLength: number,
    codecOrEncoding: TextCodec | SupportedTextEncoding = defaultTextCodec,
  ): this {
    const codec = resolveTextCodec(codecOrEncoding)
    this.ensureCapacity(byteLength)
    const encoded = codec.encode(text)
    const copyLen = Math.min(encoded.length, Math.max(0, byteLength - 1))
    this.buf.fill(0, this.len, this.len + byteLength)
    this.buf.set(encoded.subarray(0, copyLen), this.len)
    this.len += byteLength
    return this
  }

  fixedCString(
    text: string,
    byteLength: number,
    codecOrEncoding: TextCodec | SupportedTextEncoding = defaultTextCodec,
  ): this {
    return this.fixedString(text, byteLength, codecOrEncoding)
  }

  patchU16(offset: number, value: number): void {
    this.view.setUint16(offset, value & 0xffff, true)
  }

  toUint8Array(): Uint8Array {
    return this.buf.slice(0, this.len)
  }
}
