/**
 * LSB-first bitstream reader for D2GS packets (`0x18`, `0x95`, `0x9C`, `0x9D`, `0xA8`, `0xAA`, `0xAC`).
 * Throws `ProtocolError` on out-of-bounds reads or invalid bit widths.
 */

import { ProtocolError } from './errors.ts'

export class BitReader {
  private readonly data: Uint8Array
  private bitPos: number
  private readonly maxBitPos: number

  constructor(data: Uint8Array, startByteOffset = 0, byteLength = data.length - startByteOffset) {
    if (startByteOffset < 0 || byteLength < 0 || startByteOffset + byteLength > data.length) {
      throw new ProtocolError(
        'bitstream',
        null,
        startByteOffset,
        `Invalid BitReader slice offset=${startByteOffset} len=${byteLength} total=${data.length}`,
        data,
      )
    }
    this.data = data
    this.bitPos = startByteOffset * 8
    this.maxBitPos = (startByteOffset + byteLength) * 8
  }

  get bitOffset(): number {
    return this.bitPos
  }

  get byteOffset(): number {
    return this.bitPos >>> 3
  }

  get bitsRemaining(): number {
    return Math.max(0, this.maxBitPos - this.bitPos)
  }

  get remainingBits(): number {
    return this.bitsRemaining
  }

  readBit(): number {
    if (this.bitPos >= this.maxBitPos) {
      throw new ProtocolError(
        'bitstream',
        null,
        this.bitPos >>> 3,
        `BitReader overrun: tried to read 1 bit at bitOffset=${this.bitPos}, maxBitPos=${this.maxBitPos}`,
        this.data,
      )
    }
    const pos = this.bitPos
    this.bitPos = pos + 1
    return ((this.data[pos >>> 3] ?? 0) >>> (pos & 7)) & 1
  }

  readBits(count: number): number {
    if (count === 0) return 0
    if (!Number.isInteger(count) || count < 0 || count > 32) {
      throw new ProtocolError(
        'bitstream',
        null,
        this.bitPos >>> 3,
        `BitReader invalid bit count=${count} (expected 0..32)`,
        this.data,
      )
    }
    const start = this.bitPos
    const end = start + count
    if (end > this.maxBitPos) {
      throw new ProtocolError(
        'bitstream',
        null,
        start >>> 3,
        `BitReader overrun: needed ${count} bits at bitOffset=${start}, only ${this.bitsRemaining} remaining`,
        this.data,
      )
    }

    let result = 0
    let shift = 0
    let pos = start
    while (pos < end) {
      const bit = pos & 7
      const take = Math.min(8 - bit, end - pos)
      const chunk = ((this.data[pos >>> 3] ?? 0) >>> bit) & ((1 << take) - 1)
      result |= chunk << shift
      shift += take
      pos += take
    }
    this.bitPos = end
    return result >>> 0
  }

  readSignedBits(count: number): number {
    if (count === 0) return 0
    const raw = this.readBits(count)
    if (count === 32) return raw | 0
    const signBit = 1 << (count - 1)
    return (raw & signBit) !== 0 ? raw - (1 << count) : raw
  }

  readByte(): number {
    return this.readBits(8)
  }

  readAscii(charCount: number): string {
    let s = ''
    for (let i = 0; i < charCount; i++) {
      s += String.fromCharCode(this.readBits(8))
    }
    return s
  }

  read7BitString(maxChars = 16, bitsPerChar = 7): string {
    let s = ''
    for (let i = 0; i < maxChars; i++) {
      const code = this.readBits(bitsPerChar)
      if (code === 0) {
        return s
      }
      s += String.fromCharCode(code)
    }
    return s
  }

  alignToByte(): void {
    const rem = this.bitPos & 7
    if (rem !== 0) {
      this.bitPos += 8 - rem
    }
  }

  skipBits(count: number): void {
    if (!Number.isInteger(count) || count < 0 || this.bitPos + count > this.maxBitPos) {
      throw new ProtocolError(
        'bitstream',
        null,
        this.bitPos >>> 3,
        `BitReader skipBits(${count}) out of range at bitOffset=${this.bitPos}`,
        this.data,
      )
    }
    this.bitPos += count
  }
}
