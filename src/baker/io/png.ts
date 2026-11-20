/**
 * Indexed-colour PNG writer for the offline asset packs.
 *
 * Diablo II's art is palette-indexed, so PNG's indexed colour type is the right
 * target rather than RGBA: the browser decodes it natively, the file is roughly
 * a quarter of the size, and the palette travels in the same file. Index 0 is
 * made transparent through `tRNS`, which is how the decoders already mark
 * "no pixel".
 *
 * Only what the packer needs is implemented — no interlacing, no 16-bit, no
 * colour types other than 3 — because a half-implemented encoder that silently
 * produces a file another tool misreads is worse than a small one.
 *
 * Node's `zlib` does the deflate; everything else is written here.
 */
import { deflateSync } from 'node:zlib'

/** PNG's 8-byte signature. */
const SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** CRC-32 table, built once. */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/**
 * CRC-32 of a byte range, as PNG chunks require.
 *
 * @param bytes - the bytes.
 * @returns the checksum.
 */
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)) >>> 0
  return (c ^ 0xffffffff) >>> 0
}

/**
 * One PNG chunk: length, type, payload, CRC.
 *
 * @param type - four-character chunk type.
 * @param payload - chunk body.
 * @returns the serialised chunk.
 */
function chunk(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + payload.byteLength)
  const view = new DataView(out.buffer)
  view.setUint32(0, payload.byteLength)
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i)
  out.set(payload, 8)
  view.setUint32(8 + payload.byteLength, crc32(out.subarray(4, 8 + payload.byteLength)))
  return out
}

/** An indexed image ready to encode. */
export interface IndexedImage {
  /** Width in pixels. */
  readonly width: number
  /** Height in pixels. */
  readonly height: number
  /** Palette indices, row-major, `width * height` bytes. */
  readonly pixels: Uint8Array
  /** Palette as 768 RGB bytes. */
  readonly palette: Uint8Array
  /** Index treated as fully transparent, if any (usually 0). */
  readonly transparentIndex?: number | undefined
  /** Compression level for deflate (default 6). */
  readonly compressionLevel?: number | undefined
}

/**
 * Fast-path check: returns true if all bytes in the row are 0.
 * Uses 32-bit word scanning when aligned to 4 bytes, falling back to byte scanning.
 */
function isAllZero(row: Uint8Array): boolean {
  const len = row.byteLength
  if ((row.byteOffset & 3) === 0) {
    const len32 = len >>> 2
    const view32 = new Uint32Array(row.buffer, row.byteOffset, len32)
    for (let i = 0; i < len32; i += 1) {
      if (view32[i] !== 0) return false
    }
    for (let i = len32 << 2; i < len; i += 1) {
      if (row[i] !== 0) return false
    }
    return true
  }
  for (let i = 0; i < len; i += 1) {
    if (row[i] !== 0) return false
  }
  return true
}

/**
 * Fast-path check: returns true if row is identical to previous row.
 * Uses 32-bit word scanning when both rows are 4-byte aligned, falling back to byte scanning.
 */
function isSameRow(row: Uint8Array, prev: Uint8Array): boolean {
  const len = row.byteLength
  if ((row.byteOffset & 3) === 0 && (prev.byteOffset & 3) === 0) {
    const len32 = len >>> 2
    const v1 = new Uint32Array(row.buffer, row.byteOffset, len32)
    const v2 = new Uint32Array(prev.buffer, prev.byteOffset, len32)
    for (let i = 0; i < len32; i += 1) {
      if (v1[i] !== v2[i]) return false
    }
    for (let i = len32 << 2; i < len; i += 1) {
      if (row[i] !== prev[i]) return false
    }
    return true
  }
  for (let i = 0; i < len; i += 1) {
    if (row[i] !== prev[i]) return false
  }
  return true
}

/**
 * Filters image scanlines using adaptive filtering with short-circuit fast paths
 * for completely transparent rows and rows identical to the previous row.
 *
 * @param pixels - pixel buffer.
 * @param width - image width in pixels.
 * @param height - image height in pixels.
 * @param stride - bytes per pixel (1 for indexed, 4 for RGBA).
 * @returns filtered scanlines ready for deflate.
 */
function filterScanlines(pixels: Uint8Array, width: number, height: number, stride: number): Uint8Array {
  const rowBytes = width * stride
  const raw = new Uint8Array((rowBytes + 1) * height)
  const cand0 = new Uint8Array(rowBytes)
  const cand1 = new Uint8Array(rowBytes)
  let at = 0

  for (let y = 0; y < height; y += 1) {
    const row = pixels.subarray(y * rowBytes, (y + 1) * rowBytes)
    const previous = y === 0 ? null : pixels.subarray((y - 1) * rowBytes, y * rowBytes)

    // Fast-path 1: All zero row (empty / transparent) -> Filter 0 (None)
    // The output buffer `raw` is already zero-initialized by Uint8Array allocation.
    if (isAllZero(row)) {
      raw[at] = 0
      at += rowBytes + 1
      continue
    }

    // Fast-path 2: Identical to previous row -> Filter 2 (Up) produces all zeros
    if (previous !== null && isSameRow(row, previous)) {
      raw[at] = 2
      at += rowBytes + 1
      continue
    }

    // Filter 0 (None) score: sum of absolute differences directly from row
    let score0 = 0
    for (let i = 0; i < rowBytes; i += 1) {
      const v = row[i]!
      score0 += v < 128 ? v : 256 - v
    }

    // Filter 1 (Sub): compute difference and score in one pass
    let score1 = 0
    for (let i = 0; i < stride; i += 1) {
      const v = row[i]!
      cand0[i] = v
      score1 += v < 128 ? v : 256 - v
    }
    for (let i = stride; i < rowBytes; i += 1) {
      const diff = (row[i]! - row[i - stride]!) & 0xff
      cand0[i] = diff
      score1 += diff < 128 ? diff : 256 - diff
    }

    // Filter 2 (Up): compute difference and score in one pass
    let score2 = Number.POSITIVE_INFINITY
    if (previous !== null) {
      score2 = 0
      for (let i = 0; i < rowBytes; i += 1) {
        const diff = (row[i]! - previous[i]!) & 0xff
        cand1[i] = diff
        score2 += diff < 128 ? diff : 256 - diff
      }
    }

    // Select the best filter and write into raw
    if (score0 <= score1 && score0 <= score2) {
      raw[at] = 0
      raw.set(row, at + 1)
    } else if (score1 <= score2) {
      raw[at] = 1
      raw.set(cand0, at + 1)
    } else {
      raw[at] = 2
      raw.set(cand1, at + 1)
    }

    at += rowBytes + 1
  }

  return raw
}

/**
 * Encode an indexed image as a PNG.
 *
 * Each row picks its own filter (none / sub / up) by the usual minimum-sum-of-
 * absolute-differences rule. For tile art — large flat regions with sharp edges
 * — that is worth a solid fraction of the file size over "no filter everywhere",
 * and it costs one pass over the data.
 *
 * @param image - the image.
 * @returns the PNG bytes.
 */
export function encodeIndexedPng(image: IndexedImage): Uint8Array {
  const { width, height, pixels, palette } = image
  if (pixels.byteLength !== width * height) {
    throw new Error(`pixel buffer is ${String(pixels.byteLength)} bytes for ${String(width)}x${String(height)}`)
  }
  if (palette.byteLength % 3 !== 0 || palette.byteLength === 0 || palette.byteLength > 768) {
    throw new Error(`palette must be 3..768 bytes of RGB triples, got ${String(palette.byteLength)}`)
  }

  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)
  ihdrView.setUint32(0, width)
  ihdrView.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 3 // colour type: indexed
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // adaptive filtering
  ihdr[12] = 0 // no interlace

  const plte = Uint8Array.from(palette)
  const trns = new Uint8Array((image.transparentIndex ?? 0) + 1)
  trns.fill(255)
  if (image.transparentIndex !== undefined) trns[image.transparentIndex] = 0

  const raw = filterScanlines(pixels, width, height, 1)
  const idat = new Uint8Array(deflateSync(raw, { level: image.compressionLevel ?? 6 }))
  const parts = [SIGNATURE, chunk('IHDR', ihdr), chunk('PLTE', plte)]
  if (image.transparentIndex !== undefined) parts.push(chunk('tRNS', trns))
  parts.push(chunk('IDAT', idat), chunk('IEND', new Uint8Array(0)))
  const size = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) { out.set(part, offset); offset += part.byteLength }
  return out
}

/** An RGBA image ready to encode. */
export interface RgbaImage {
  /** Width in pixels. */
  readonly width: number
  /** Height in pixels. */
  readonly height: number
  /** RGBA pixels, row-major, 4 bytes per pixel (`width * height * 4` bytes). */
  readonly pixels: Uint8Array
  /** Compression level for deflate (default 6). */
  readonly compressionLevel?: number | undefined
}

/**
 * Encode a 32-bit RGBA image as a PNG (color type 6).
 *
 * @param image - the RGBA image.
 * @returns the PNG bytes.
 */
export function encodeRgbaPng(image: RgbaImage): Uint8Array {
  const { width, height, pixels } = image
  if (pixels.byteLength !== width * height * 4) {
    throw new Error(`pixel buffer is ${String(pixels.byteLength)} bytes for ${String(width)}x${String(height)} RGBA`)
  }

  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)
  ihdrView.setUint32(0, width)
  ihdrView.setUint32(4, height)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // adaptive filtering
  ihdr[12] = 0 // no interlace

  const raw = filterScanlines(pixels, width, height, 4)
  const idat = new Uint8Array(deflateSync(raw, { level: image.compressionLevel ?? 6 }))
  const parts = [SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))]
  const size = parts.reduce((sum, part) => sum + part.byteLength, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) { out.set(part, offset); offset += part.byteLength }
  return out
}

