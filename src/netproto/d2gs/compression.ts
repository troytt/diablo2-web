import { ProtocolError } from '../core/errors.ts'
import { HUFFMAN_BIT_LENGTHS } from './tables/huffman.ts'

export interface D2gsBlockHeader {
  readonly headerSize: 1 | 2
  readonly headerLen: 1 | 2
  readonly totalFrameSize: number
  readonly totalBlockBytes: number
  readonly compressedPayloadLen: number
}

/**
 * Parses a D2GS compressed block header per `D2Net.dll` @ `0x6fbf73a0..0x6fbf73df`:
 * - Header encodes `totalFrameSize` (INCLUDING the 1- or 2-byte header).
 * - If `b0 < 0xF0`: `headerSize = 1`, `totalFrameSize = b0`, `compressedPayloadLen = b0 - 1`.
 * - If `b0 >= 0xF0`: `headerSize = 2`, `totalFrameSize = ((b0 & 0x0F) << 8) | b1`, `compressedPayloadLen = totalFrameSize - 2`.
 * Returns `null` if the buffer does not yet have enough bytes to read the header.
 */
export function parseD2gsBlockHeader(buf: Uint8Array, offset = 0): D2gsBlockHeader | null {
  const remaining = buf.length - offset
  if (remaining < 1) return null
  const b0 = buf[offset]!
  if (b0 < 0xf0) {
    if (b0 < 1) {
      throw new ProtocolError(`Invalid D2GS 1-byte block header totalFrameSize=${b0}`, 0xaf, offset)
    }
    return {
      headerSize: 1,
      headerLen: 1,
      totalFrameSize: b0,
      totalBlockBytes: b0,
      compressedPayloadLen: b0 - 1,
    }
  }
  if (remaining < 2) return null
  const b1 = buf[offset + 1]!
  const totalFrameSize = ((b0 & 0x0f) << 8) | b1
  if (totalFrameSize < 2) {
    throw new ProtocolError(`Invalid D2GS 2-byte block header totalFrameSize=${totalFrameSize}`, 0xaf, offset)
  }
  return {
    headerSize: 2,
    headerLen: 2,
    totalFrameSize,
    totalBlockBytes: totalFrameSize,
    compressedPayloadLen: totalFrameSize - 2,
  }
}

/**
 * Encodes the 1- or 2-byte D2GS block header (`D2Net.dll` @ `0x6fbf64a2..0x6fbf6500`)
 * and prepends it to `compressedPayload`.
 */
export function wrapD2gsCompressedBlock(compressedPayload: Uint8Array): Uint8Array {
  const payloadLen = compressedPayload.length
  if (payloadLen + 1 < 0xf0) {
    const totalFrameSize = payloadLen + 1
    const out = new Uint8Array(totalFrameSize)
    out[0] = totalFrameSize
    out.set(compressedPayload, 1)
    return out
  }
  const totalFrameSize = payloadLen + 2
  if (totalFrameSize > 0x0fff) {
    throw new ProtocolError(`D2GS compressed frame exceeds 12-bit max size (${totalFrameSize})`)
  }
  const out = new Uint8Array(totalFrameSize)
  out[0] = 0xf0 | ((totalFrameSize >>> 8) & 0x0f)
  out[1] = totalFrameSize & 0xff
  out.set(compressedPayload, 2)
  return out
}

interface DecodePrefixEntry {
  readonly extraBits: number
  readonly symbols: Uint8Array
}

/**
 * Canonical MSB-first Huffman codec matching `Fog.dll`:
 * - Table builder `Fog.10219` (`0x6ff6efd0`)
 * - Decompressor `Fog.10224` (`0x6ff6eda0`)
 * - Compressor `Fog.10222` (`0x6ff6ec90`)
 */
export class D2gsHuffmanCodec {
  readonly bitLengths: Uint8Array
  readonly codes: Uint16Array
  private readonly prefixTable: readonly DecodePrefixEntry[]

  constructor(bitLengths: ArrayLike<number> = HUFFMAN_BIT_LENGTHS) {
    if (bitLengths.length !== 256) {
      throw new ProtocolError(`Huffman bitLengths must have 256 entries, got ${bitLengths.length}`)
    }
    this.bitLengths = new Uint8Array(256)
    for (let i = 0; i < 256; i++) {
      const len = bitLengths[i]!
      if (len < 1 || len > 15) {
        throw new ProtocolError(`Invalid Huffman bit length ${len} for symbol 0x${i.toString(16)}`)
      }
      this.bitLengths[i] = len
    }

    // Fog.10219 (0x6ff6efd0): sort symbols by bitLength descending, then symbol ascending
    const sortedSymbols: number[] = []
    for (let len = 15; len >= 1; len--) {
      for (let sym = 0; sym < 256; sym++) {
        if (this.bitLengths[sym] === len) {
          sortedSymbols.push(sym)
        }
      }
    }

    this.codes = new Uint16Array(256)
    let code = 0
    if (sortedSymbols.length > 0) {
      this.codes[sortedSymbols[0]!] = 0
      for (let i = 0; i < sortedSymbols.length - 1; i++) {
        const curSym = sortedSymbols[i]!
        const nextSym = sortedSymbols[i + 1]!
        const shift = this.bitLengths[curSym]! - this.bitLengths[nextSym]!
        code = (code + 1) >>> shift
        this.codes[nextSym] = code
      }
    }

    // Build two-level 8-bit prefix lookup table matching Fog.10219 (0x6ff806d0 / 0x6ff80ad0)
    const table = new Array<DecodePrefixEntry>(256)
    // Group symbols with len > 8 by their top 8 bits
    const subBuckets = new Map<number, { maxLen: number; items: Array<{ sym: number; len: number; code: number }> }>()
    for (let i = sortedSymbols.length - 1; i >= 0; i--) {
      const sym = sortedSymbols[i]!
      const len = this.bitLengths[sym]!
      const c = this.codes[sym]!
      if (len <= 8) {
        const shift = 8 - len
        const basePrefix = (c << shift) & 0xff
        const span = 1 << shift
        const entry: DecodePrefixEntry = {
          extraBits: 0,
          symbols: new Uint8Array([sym]),
        }
        for (let k = 0; k < span; k++) {
          table[basePrefix + k] = entry
        }
      } else {
        const prefix8 = (c >>> (len - 8)) & 0xff
        let bucket = subBuckets.get(prefix8)
        if (!bucket) {
          bucket = { maxLen: len, items: [] }
          subBuckets.set(prefix8, bucket)
        }
        if (len > bucket.maxLen) bucket.maxLen = len
        bucket.items.push({ sym, len, code: c })
      }
    }

    for (const [prefix8, bucket] of subBuckets.entries()) {
      const extraBits = bucket.maxLen - 8
      const subSize = 1 << extraBits
      const symbols = new Uint8Array(subSize)
      for (const item of bucket.items) {
        const remBits = item.len - 8
        const lowMask = (1 << remBits) - 1
        const lowCode = item.code & lowMask
        const shift = extraBits - remBits
        const baseIdx = lowCode << shift
        const count = 1 << shift
        for (let k = 0; k < count; k++) {
          symbols[baseIdx + k] = item.sym
        }
      }
      table[prefix8] = { extraBits, symbols }
    }

    // Ensure every prefix entry is populated
    for (let p = 0; p < 256; p++) {
      if (!table[p]) {
        throw new ProtocolError(`Incomplete Huffman decode table at prefix 0x${p.toString(16)}`)
      }
    }
    this.prefixTable = table
  }

  /**
   * Decompresses a D2GS block payload per `Fog.10224` (`0x6ff6eda0`).
   * Uses a 32-bit MSB-first shift register (`bitBuf`) and `emptyBits` counter initialized to 32,
   * stopping cleanly when `emptyBits + bitLength > 32`.
   */
  decompress(src: Uint8Array, expectedLength?: number): Uint8Array {
    if (src.length === 0) {
      if (expectedLength !== undefined && expectedLength > 0) {
        throw new ProtocolError(
          `D2GS Huffman decompression failed: empty input for expectedLength=${expectedLength}`,
          0xaf,
        )
      }
      return new Uint8Array(0)
    }
    const maxDestLen = expectedLength ?? 8192
    let bitBuf = 0
    let emptyBits = 32
    let srcIdx = 0
    let out = new Uint8Array(
      expectedLength !== undefined && expectedLength > 0 ? expectedLength : Math.max(256, src.byteLength * 4),
    )
    let outLen = 0

    while (true) {
      if (expectedLength !== undefined && outLen >= expectedLength) {
        break
      }
      while (emptyBits >= 8 && srcIdx < src.length) {
        emptyBits -= 8
        bitBuf = (bitBuf | ((src[srcIdx]! & 0xff) << emptyBits)) >>> 0
        srcIdx++
      }

      const prefix8 = (bitBuf >>> 24) & 0xff
      const entry = this.prefixTable[prefix8]!
      let sym: number
      if (entry.extraBits === 0) {
        sym = entry.symbols[0]!
      } else {
        const extraMask = (1 << entry.extraBits) - 1
        const subIdx = (bitBuf >>> (24 - entry.extraBits)) & extraMask
        sym = entry.symbols[subIdx]!
      }

      const len = this.bitLengths[sym]!
      emptyBits += len
      if (emptyBits > 32) {
        break
      }
      if (outLen >= maxDestLen) {
        throw new ProtocolError(`D2GS Huffman decompression exceeded maxDestLen=${maxDestLen}`, 0xaf)
      }
      if (outLen >= out.byteLength) {
        const next = new Uint8Array(out.byteLength * 2)
        next.set(out, 0)
        out = next
      }
      out[outLen++] = sym
      bitBuf = (bitBuf << len) >>> 0
    }

    if (expectedLength !== undefined && outLen < expectedLength) {
      throw new ProtocolError(
        `D2GS Huffman decompression underrun: got ${outLen} bytes, expected ${expectedLength}`,
        0xaf,
      )
    }

    return out.subarray(0, outLen)
  }

  /**
   * Compresses an uncompressed payload using MSB-first canonical Huffman codes (`Fog.10222` @ `0x6ff6ec90`).
   * Trailing partial byte bits are zero-padded so `Fog.10224` terminates cleanly (`emptyBits + 11 > 32`).
   */
  compress(src: Uint8Array): Uint8Array {
    if (src.length === 0) return new Uint8Array(0)
    let out = new Uint8Array(Math.max(64, src.byteLength * 2))
    let outLen = 0
    let bitBuf = 0
    let usedBits = 0

    for (let i = 0; i < src.length; i++) {
      const sym = src[i]!
      const len = this.bitLengths[sym]!
      const code = this.codes[sym]!
      bitBuf = ((bitBuf << len) | code) >>> 0
      usedBits += len
      while (usedBits >= 8) {
        usedBits -= 8
        if (outLen >= out.byteLength) {
          const next = new Uint8Array(out.byteLength * 2)
          next.set(out, 0)
          out = next
        }
        out[outLen++] = (bitBuf >>> usedBits) & 0xff
      }
    }

    if (usedBits > 0) {
      if (outLen >= out.byteLength) {
        const next = new Uint8Array(out.byteLength * 2)
        next.set(out, 0)
        out = next
      }
      out[outLen++] = (bitBuf << (8 - usedBits)) & 0xff
    }

    return out.subarray(0, outLen)
  }
}

export const defaultD2gsHuffmanCodec = new D2gsHuffmanCodec(HUFFMAN_BIT_LENGTHS)

/**
 * Unpacks a custom 130-byte `0xAF 0x81` Huffman bit-length packet (`D2Net.dll` @ `0x6fbf6e10`)
 * where 128 bytes encode 256 4-bit nibbles (`(byte & 0x0F) + 1`, `(byte >> 4) + 1`).
 */
export function unpackCustomHuffmanLengths(packet0xAf: Uint8Array): Uint8Array {
  if (packet0xAf.length < 130 || packet0xAf[0] !== 0xaf || packet0xAf[1] !== 0x81) {
    throw new ProtocolError('Invalid 0xAF 0x81 custom Huffman table packet', 0xaf)
  }
  const lengths = new Uint8Array(256)
  for (let i = 0; i < 128; i++) {
    const b = packet0xAf[2 + i]!
    lengths[i * 2] = (b & 0x0f) + 1
    lengths[i * 2 + 1] = ((b >>> 4) & 0x0f) + 1
  }
  return lengths
}

export function decompressD2gsPayload(compressedPayload: Uint8Array, codec: D2gsHuffmanCodec = defaultD2gsHuffmanCodec): Uint8Array {
  return codec.decompress(compressedPayload)
}

export function compressD2gsPayload(uncompressedPayload: Uint8Array, codec: D2gsHuffmanCodec = defaultD2gsHuffmanCodec): Uint8Array {
  return codec.compress(uncompressedPayload)
}

export function encodeD2gsCompressedFrame(uncompressedPayload: Uint8Array, codec: D2gsHuffmanCodec = defaultD2gsHuffmanCodec): Uint8Array {
  return wrapD2gsCompressedBlock(codec.compress(uncompressedPayload))
}
