/**
 * LSB-first bitstream writer for constructing D2GS item and unit bitstreams in tests and mock servers.
 */

export class BitWriter {
  private bytes: number[] = []
  private bitLen = 0

  get bitLength(): number {
    return this.bitLen
  }

  get byteLength(): number {
    return Math.ceil(this.bitLen / 8)
  }

  writeBit(bit: number): this {
    const byteIdx = this.bitLen >>> 3
    const bitIdx = this.bitLen & 7
    if (byteIdx >= this.bytes.length) {
      this.bytes.push(0)
    }
    if (bit & 1) {
      this.bytes[byteIdx] = (this.bytes[byteIdx]! | (1 << bitIdx)) & 0xff
    }
    this.bitLen += 1
    return this
  }

  writeBits(value: number, count: number): this {
    if (count === 0) return this
    if (!Number.isInteger(count) || count < 0 || count > 32) {
      throw new Error(`BitWriter invalid bit count=${count}`)
    }
    const v = value >>> 0
    for (let i = 0; i < count; i++) {
      this.writeBit((v >>> i) & 1)
    }
    return this
  }

  writeSignedBits(value: number, count: number): this {
    if (count === 0) return this
    const mask = count === 32 ? 0xffffffff : (1 << count) - 1
    return this.writeBits((value & mask) >>> 0, count)
  }

  writeAscii(text: string, charCount = text.length): this {
    const padded = (text + '    ').slice(0, charCount)
    for (let i = 0; i < charCount; i++) {
      this.writeBits(padded.charCodeAt(i) & 0xff, 8)
    }
    return this
  }

  write7BitString(text: string, bitsPerChar = 7): this {
    for (let i = 0; i < text.length; i++) {
      this.writeBits(text.charCodeAt(i) & ((1 << bitsPerChar) - 1), bitsPerChar)
    }
    this.writeBits(0, bitsPerChar)
    return this
  }

  alignToByte(): this {
    const rem = this.bitLen & 7
    if (rem !== 0) {
      this.writeBits(0, 8 - rem)
    }
    return this
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.bytes)
  }
}
