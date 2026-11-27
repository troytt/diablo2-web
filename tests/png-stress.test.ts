import { describe, it, expect } from 'vitest'
import { inflateSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodeIndexedPng, encodeRgbaPng, type IndexedImage, type RgbaImage } from '../src/baker/io/png'

// --- Independent PNG Specification Decoder & Oracle ---

interface DecodedPng {
  readonly width: number
  readonly height: number
  readonly bitDepth: number
  readonly colorType: number
  readonly compressionMethod: number
  readonly filterMethod: number
  readonly interlaceMethod: number
  readonly palette?: Uint8Array | undefined
  readonly transparentIndex?: number | undefined
  readonly pixels: Uint8Array
  readonly scanlineFilterTypes: number[]
}

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n += 1) {
  let c = n
  for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1
  CRC_TABLE[n] = c >>> 0
}

function verifyCrc32(bytes: Uint8Array, expected: number): boolean {
  let c = 0xffffffff
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)) >>> 0
  return ((c ^ 0xffffffff) >>> 0) === expected
}

/**
 * Strictly decodes a PNG byte stream according to W3C PNG Specification.
 * Validates header, chunks, CRCs, decompress IDAT, and unfilters scanlines.
 */
export function decodePng(bytes: Uint8Array): DecodedPng {
  if (bytes.length < 8) throw new Error('PNG too short for signature')
  for (let i = 0; i < 8; i += 1) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error(`Invalid PNG signature byte at ${i}: expected ${PNG_SIGNATURE[i]}, got ${bytes[i]}`)
    }
  }

  let offset = 8
  let ihdr: { width: number; height: number; bitDepth: number; colorType: number; comp: number; filter: number; interlace: number } | null = null
  let palette: Uint8Array | undefined
  let transparentIndex: number | undefined
  const idatParts: Uint8Array[] = []

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error(`Truncated chunk header at offset ${offset}`)
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 8)
    const length = view.getUint32(0)
    const type = String.fromCharCode(bytes[offset + 4]!, bytes[offset + 5]!, bytes[offset + 6]!, bytes[offset + 7]!)

    if (offset + 12 + length > bytes.length) {
      throw new Error(`Truncated chunk payload for ${type} at offset ${offset}`)
    }

    const payload = bytes.subarray(offset + 8, offset + 8 + length)
    const crcView = new DataView(bytes.buffer, bytes.byteOffset + offset + 8 + length, 4)
    const expectedCrc = crcView.getUint32(0)

    const chunkDataForCrc = bytes.subarray(offset + 4, offset + 8 + length)
    if (!verifyCrc32(chunkDataForCrc, expectedCrc)) {
      throw new Error(`CRC32 mismatch for chunk ${type} at offset ${offset}`)
    }

    if (type === 'IHDR') {
      const ihdrView = new DataView(payload.buffer, payload.byteOffset, 13)
      ihdr = {
        width: ihdrView.getUint32(0),
        height: ihdrView.getUint32(4),
        bitDepth: payload[8]!,
        colorType: payload[9]!,
        comp: payload[10]!,
        filter: payload[11]!,
        interlace: payload[12]!,
      }
    } else if (type === 'PLTE') {
      palette = new Uint8Array(payload)
    } else if (type === 'tRNS') {
      for (let i = 0; i < payload.length; i += 1) {
        if (payload[i] === 0) {
          transparentIndex = i
          break
        }
      }
    } else if (type === 'IDAT') {
      idatParts.push(payload)
    } else if (type === 'IEND') {
      break
    }

    offset += 12 + length
  }

  if (!ihdr) throw new Error('Missing IHDR chunk')
  if (ihdr.bitDepth !== 8) throw new Error(`Unsupported bit depth: ${ihdr.bitDepth}`)
  if (ihdr.comp !== 0 || ihdr.filter !== 0 || ihdr.interlace !== 0) {
    throw new Error('Unsupported compression, filter, or interlace method')
  }

  const stride = ihdr.colorType === 3 ? 1 : ihdr.colorType === 6 ? 4 : 0
  if (stride === 0) throw new Error(`Unsupported color type: ${ihdr.colorType}`)

  const totalIdatLen = idatParts.reduce((acc, p) => acc + p.length, 0)
  const mergedIdat = new Uint8Array(totalIdatLen)
  let idatOff = 0
  for (const part of idatParts) {
    mergedIdat.set(part, idatOff)
    idatOff += part.length
  }

  const decompressed = new Uint8Array(inflateSync(mergedIdat))
  const rowBytes = ihdr.width * stride
  const expectedRawLen = (rowBytes + 1) * ihdr.height
  if (decompressed.length !== expectedRawLen) {
    throw new Error(`Decompressed length mismatch: expected ${expectedRawLen}, got ${decompressed.length}`)
  }

  const pixels = new Uint8Array(ihdr.width * ihdr.height * stride)
  const scanlineFilterTypes: number[] = []
  let at = 0

  for (let y = 0; y < ihdr.height; y += 1) {
    const filterType = decompressed[at]!
    scanlineFilterTypes.push(filterType)
    at += 1

    const row = decompressed.subarray(at, at + rowBytes)
    const outRow = pixels.subarray(y * rowBytes, (y + 1) * rowBytes)
    const priorRow = y === 0 ? null : pixels.subarray((y - 1) * rowBytes, y * rowBytes)

    if (filterType === 0) {
      // None
      outRow.set(row)
    } else if (filterType === 1) {
      // Sub
      for (let x = 0; x < stride; x += 1) {
        outRow[x] = row[x]!
      }
      for (let x = stride; x < rowBytes; x += 1) {
        outRow[x] = (row[x]! + outRow[x - stride]!) & 0xff
      }
    } else if (filterType === 2) {
      // Up
      for (let x = 0; x < rowBytes; x += 1) {
        const up = priorRow ? priorRow[x]! : 0
        outRow[x] = (row[x]! + up) & 0xff
      }
    } else if (filterType === 3) {
      // Average
      for (let x = 0; x < rowBytes; x += 1) {
        const left = x >= stride ? outRow[x - stride]! : 0
        const up = priorRow ? priorRow[x]! : 0
        outRow[x] = (row[x]! + Math.floor((left + up) / 2)) & 0xff
      }
    } else if (filterType === 4) {
      // Paeth
      for (let x = 0; x < rowBytes; x += 1) {
        const a = x >= stride ? outRow[x - stride]! : 0
        const b = priorRow ? priorRow[x]! : 0
        const c = x >= stride && priorRow ? priorRow[x - stride]! : 0
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        let pr = c
        if (pa <= pb && pa <= pc) pr = a
        else if (pb <= pc) pr = b
        outRow[x] = (row[x]! + pr) & 0xff
      }
    } else {
      throw new Error(`Invalid filter type: ${filterType} at row ${y}`)
    }

    at += rowBytes
  }

  return {
    width: ihdr.width,
    height: ihdr.height,
    bitDepth: ihdr.bitDepth,
    colorType: ihdr.colorType,
    compressionMethod: ihdr.comp,
    filterMethod: ihdr.filter,
    interlaceMethod: ihdr.interlace,
    palette,
    transparentIndex,
    pixels,
    scanlineFilterTypes,
  }
}

/**
 * Asserts 100% bit-for-bit identity between original pixels and decoded pixels.
 */
function assertPixelParity(original: Uint8Array, decoded: Uint8Array, label: string) {
  expect(decoded.length).toBe(original.length)
  let mismatches = 0
  let firstMismatch = -1
  for (let i = 0; i < original.length; i += 1) {
    if (original[i] !== decoded[i]) {
      mismatches += 1
      if (firstMismatch === -1) firstMismatch = i
    }
  }
  if (mismatches > 0) {
    throw new Error(`${label}: ${mismatches} byte mismatches! First at byte ${firstMismatch} (expected ${original[firstMismatch]}, got ${decoded[firstMismatch]})`)
  }
}

/** PRNG generator for deterministic reproducible high-entropy noise */
function createPrng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s >>> 24
  }
}

// Generate default 768-byte palette
const TEST_PALETTE = new Uint8Array(768)
for (let i = 0; i < 256; i += 1) {
  TEST_PALETTE[i * 3 + 0] = (i * 7) & 0xff
  TEST_PALETTE[i * 3 + 1] = (i * 13) & 0xff
  TEST_PALETTE[i * 3 + 2] = (i * 29) & 0xff
}

describe('PNG Encoder Adversarial Stress Suite', () => {
  describe('Dimension & Stride Alignment Spectrum', () => {
    const testDimensions = [
      [1, 1],
      [1, 2],
      [2, 1],
      [3, 3],
      [5, 7],
      [7, 5],
      [13, 11],
      [15, 17],
      [17, 23],
      [31, 33],
      [135, 77],
      [255, 127],
      [256, 256],
      [512, 384],
    ]

    for (const [w, h] of testDimensions) {
      it(`Indexed PNG round-trips correctly on unaligned dimensions ${w}x${h}`, () => {
        const prng = createPrng(w * 1000 + h)
        const pixels = new Uint8Array(w * h)
        for (let i = 0; i < pixels.length; i += 1) pixels[i] = prng()

        const encoded = encodeIndexedPng({
          width: w,
          height: h,
          pixels,
          palette: TEST_PALETTE,
          transparentIndex: 0,
        })
        const decoded = decodePng(encoded)
        expect(decoded.width).toBe(w)
        expect(decoded.height).toBe(h)
        expect(decoded.colorType).toBe(3)
        assertPixelParity(pixels, decoded.pixels, `Indexed ${w}x${h}`)
      })

      it(`RGBA PNG round-trips correctly on unaligned dimensions ${w}x${h}`, () => {
        const prng = createPrng(w * 2000 + h)
        const pixels = new Uint8Array(w * h * 4)
        for (let i = 0; i < pixels.length; i += 1) pixels[i] = prng()

        const encoded = encodeRgbaPng({
          width: w,
          height: h,
          pixels,
        })
        const decoded = decodePng(encoded)
        expect(decoded.width).toBe(w)
        expect(decoded.height).toBe(h)
        expect(decoded.colorType).toBe(6)
        assertPixelParity(pixels, decoded.pixels, `RGBA ${w}x${h}`)
      })
    }
  })

  describe('Adversarial Synthetic Patterns', () => {
    const W = 135 // unaligned width
    const H = 77  // unaligned height

    it('All-zero / transparent rows trigger Fast-Path 1 (Filter 0) with 100% parity', () => {
      // Indexed
      const indexedPixels = new Uint8Array(W * H) // all zeros
      const encIndexed = encodeIndexedPng({ width: W, height: H, pixels: indexedPixels, palette: TEST_PALETTE })
      const decIndexed = decodePng(encIndexed)
      assertPixelParity(indexedPixels, decIndexed.pixels, 'All zeros indexed')
      // All rows should select Filter 0
      expect(decIndexed.scanlineFilterTypes.every((f) => f === 0)).toBe(true)

      // RGBA
      const rgbaPixels = new Uint8Array(W * H * 4) // all zeros
      const encRgba = encodeRgbaPng({ width: W, height: H, pixels: rgbaPixels })
      const decRgba = decodePng(encRgba)
      assertPixelParity(rgbaPixels, decRgba.pixels, 'All zeros RGBA')
      expect(decRgba.scanlineFilterTypes.every((f) => f === 0)).toBe(true)
    })

    it('Solid colors & identical rows trigger Fast-Path 2 (Filter 2) with 100% parity', () => {
      // Indexed: row 0 non-zero, rows 1..H-1 identical to row 0
      const indexedPixels = new Uint8Array(W * H)
      for (let x = 0; x < W; x += 1) indexedPixels[x] = (x + 1) % 255
      for (let y = 1; y < H; y += 1) {
        indexedPixels.set(indexedPixels.subarray(0, W), y * W)
      }
      const encIndexed = encodeIndexedPng({ width: W, height: H, pixels: indexedPixels, palette: TEST_PALETTE })
      const decIndexed = decodePng(encIndexed)
      assertPixelParity(indexedPixels, decIndexed.pixels, 'Identical rows indexed')
      // Row 0 is not all zero; rows 1..H-1 must choose Filter 2 (Up)
      expect(decIndexed.scanlineFilterTypes[0]).not.toBe(2)
      for (let y = 1; y < H; y += 1) {
        expect(decIndexed.scanlineFilterTypes[y]).toBe(2)
      }

      // RGBA: row 0 non-zero, rows 1..H-1 identical
      const rgbaPixels = new Uint8Array(W * H * 4)
      for (let x = 0; x < W * 4; x += 1) rgbaPixels[x] = (x * 37 + 13) & 0xff
      for (let y = 1; y < H; y += 1) {
        rgbaPixels.set(rgbaPixels.subarray(0, W * 4), y * W * 4)
      }
      const encRgba = encodeRgbaPng({ width: W, height: H, pixels: rgbaPixels })
      const decRgba = decodePng(encRgba)
      assertPixelParity(rgbaPixels, decRgba.pixels, 'Identical rows RGBA')
      for (let y = 1; y < H; y += 1) {
        expect(decRgba.scanlineFilterTypes[y]).toBe(2)
      }
    })

    it('Horizontal gradients trigger Filter 1 (Sub) optimality with 100% parity', () => {
      // Horizontal ramp: each pixel increases by 1
      const indexedPixels = new Uint8Array(W * H)
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          indexedPixels[y * W + x] = x & 0xff
        }
      }
      const encIndexed = encodeIndexedPng({ width: W, height: H, pixels: indexedPixels, palette: TEST_PALETTE })
      const decIndexed = decodePng(encIndexed)
      assertPixelParity(indexedPixels, decIndexed.pixels, 'Horizontal gradient indexed')

      // Row 0 has constant difference 1, so Filter 1 (Sub) should dominate
      expect(decIndexed.scanlineFilterTypes[0]).toBe(1)
    })

    it('Vertical patterns trigger Filter 2 (Up) with 100% parity', () => {
      // High horizontal variation (high Filter 1 score), but small vertical delta (low Filter 2 score)
      const indexedPixels = new Uint8Array(W * H)
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          indexedPixels[y * W + x] = ((x * 17) + y) & 0xff
        }
      }
      const encIndexed = encodeIndexedPng({ width: W, height: H, pixels: indexedPixels, palette: TEST_PALETTE })
      const decIndexed = decodePng(encIndexed)
      assertPixelParity(indexedPixels, decIndexed.pixels, 'Vertical gradient indexed')

      // Rows > 0 have constant difference 1 from previous row, so Filter 2 should dominate
      for (let y = 1; y < H; y += 1) {
        expect(decIndexed.scanlineFilterTypes[y]).toBe(2)
      }
    })

    it('Checkerboard and sparse noise patterns preserve exact parity', () => {
      // Checkerboard 2x2
      const checkPixels = new Uint8Array(W * H)
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          checkPixels[y * W + x] = (((x >>> 1) ^ (y >>> 1)) & 1) ? 255 : 0
        }
      }
      const encCheck = encodeIndexedPng({ width: W, height: H, pixels: checkPixels, palette: TEST_PALETTE })
      const decCheck = decodePng(encCheck)
      assertPixelParity(checkPixels, decCheck.pixels, 'Checkerboard indexed')

      // Sparse pattern: 99% zero with single non-zero byte at unaligned boundaries
      const sparsePixels = new Uint8Array(W * H)
      sparsePixels[0] = 42
      sparsePixels[W - 1] = 99 // unaligned end of row 0
      sparsePixels[W * 2 + 3] = 150
      sparsePixels[W * H - 1] = 250 // very last byte
      const encSparse = encodeIndexedPng({ width: W, height: H, pixels: sparsePixels, palette: TEST_PALETTE })
      const decSparse = decodePng(encSparse)
      assertPixelParity(sparsePixels, decSparse.pixels, 'Sparse pattern indexed')
    })
  })

  describe('Non-Zero ByteOffset Subarray Buffers (Alignment Strees)', () => {
    it('Handles Uint8Array with unaligned byteOffset without throwing RangeError', () => {
      const W = 33
      const H = 19
      // Allocate an unaligned backing buffer (e.g. byteOffset = 3)
      const rawBuffer = new ArrayBuffer(W * H + 16)
      const unalignedPixels = new Uint8Array(rawBuffer, 3, W * H)
      unalignedPixels.fill(0)
      // Set a few non-zeros
      unalignedPixels[10] = 77
      unalignedPixels[W * 3 + 2] = 88

      // Encoding must NOT throw RangeError due to Uint32Array alignment
      expect(() => {
        const enc = encodeIndexedPng({
          width: W,
          height: H,
          pixels: unalignedPixels,
          palette: TEST_PALETTE,
        })
        const dec = decodePng(enc)
        assertPixelParity(unalignedPixels, dec.pixels, 'Unaligned buffer byteOffset=3')
      }).not.toThrow()
    })
  })

  describe('Max Constraint & Game Atlas Scale Stress', () => {
    it('Encodes 2048x1808 game sprite atlas within tight timing bounds and 100% parity', () => {
      const W = 2048
      const H = 1808
      const pixels = new Uint8Array(W * H)
      // Populate with realistic atlas structure: large transparent regions, isolated sprite islands
      for (let y = 100; y < 300; y += 1) {
        for (let x = 100; x < 300; x += 1) {
          pixels[y * W + x] = ((x ^ y) & 0xff) || 1
        }
      }
      for (let y = 600; y < 800; y += 1) {
        for (let x = 500; x < 900; x += 1) {
          pixels[y * W + x] = (x & 0xff) || 2
        }
      }

      const start = performance.now()
      const encoded = encodeIndexedPng({
        width: W,
        height: H,
        pixels,
        palette: TEST_PALETTE,
        transparentIndex: 0,
        compressionLevel: 6,
      })
      const elapsed = performance.now() - start

      expect(encoded.length).toBeGreaterThan(1000)
      expect(elapsed).toBeLessThan(1000) // Should be well under 1 second (target ~55ms)

      const decoded = decodePng(encoded)
      expect(decoded.width).toBe(W)
      expect(decoded.height).toBe(H)
      assertPixelParity(pixels, decoded.pixels, '2048x1808 Game Atlas')
    })
  })

  describe('Options & Compression Level Sweeps', () => {
    const W = 64
    const H = 64
    const pixels = new Uint8Array(W * H)
    for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 31) & 0xff

    for (const lvl of [0, 1, 3, 6, 9]) {
      it(`Encodes with compressionLevel=${lvl} and preserves bit-for-bit parity`, () => {
        const enc = encodeIndexedPng({
          width: W,
          height: H,
          pixels,
          palette: TEST_PALETTE,
          compressionLevel: lvl,
        })
        const dec = decodePng(enc)
        assertPixelParity(pixels, dec.pixels, `Compression level ${lvl}`)
      })
    }

    it('Correctly handles palette sizes from 3 bytes to 768 bytes', () => {
      for (const palSize of [3, 6, 48, 255, 768]) {
        const palette = new Uint8Array(palSize)
        for (let i = 0; i < palSize; i += 1) palette[i] = (i * 17) & 0xff
        const enc = encodeIndexedPng({
          width: 8,
          height: 8,
          pixels: new Uint8Array(64),
          palette,
        })
        const dec = decodePng(enc)
        expect(dec.palette?.length).toBe(palSize)
        assertPixelParity(palette, dec.palette!, `Palette size ${palSize}`)
      }
    })

    it('Correctly handles transparentIndex omitted vs specified', () => {
      // Omitted
      const encNoTrns = encodeIndexedPng({ width: 4, height: 4, pixels: new Uint8Array(16), palette: TEST_PALETTE })
      const decNoTrns = decodePng(encNoTrns)
      expect(decNoTrns.transparentIndex).toBeUndefined()

      // Specified = 0
      const encTrns0 = encodeIndexedPng({ width: 4, height: 4, pixels: new Uint8Array(16), palette: TEST_PALETTE, transparentIndex: 0 })
      const decTrns0 = decodePng(encTrns0)
      expect(decTrns0.transparentIndex).toBe(0)

      // Specified = 127
      const encTrns127 = encodeIndexedPng({ width: 4, height: 4, pixels: new Uint8Array(16), palette: TEST_PALETTE, transparentIndex: 127 })
      const decTrns127 = decodePng(encTrns127)
      expect(decTrns127.transparentIndex).toBe(127)
    })
  })

  describe('Contract Validation & Error Invariants', () => {
    it('Throws when pixel buffer length does not match width * height', () => {
      expect(() => {
        encodeIndexedPng({ width: 10, height: 10, pixels: new Uint8Array(99), palette: TEST_PALETTE })
      }).toThrow('pixel buffer is 99 bytes for 10x10')

      expect(() => {
        encodeRgbaPng({ width: 10, height: 10, pixels: new Uint8Array(399) })
      }).toThrow('pixel buffer is 399 bytes for 10x10 RGBA')
    })

    it('Throws on invalid palette length', () => {
      expect(() => {
        encodeIndexedPng({ width: 2, height: 2, pixels: new Uint8Array(4), palette: new Uint8Array(0) })
      }).toThrow(/palette must be 3\.\.768 bytes/)

      expect(() => {
        encodeIndexedPng({ width: 2, height: 2, pixels: new Uint8Array(4), palette: new Uint8Array(4) }) // not % 3
      }).toThrow(/palette must be 3\.\.768 bytes/)

      expect(() => {
        encodeIndexedPng({ width: 2, height: 2, pixels: new Uint8Array(4), palette: new Uint8Array(771) }) // > 768
      }).toThrow(/palette must be 3\.\.768 bytes/)
    })
  })

  describe('External Oracle Parity (ImageMagick identify)', () => {
    it('ImageMagick successfully parses and validates generated Indexed and RGBA PNGs', () => {
      const W = 67
      const H = 43
      const pixels = new Uint8Array(W * H)
      for (let i = 0; i < pixels.length; i += 1) pixels[i] = (i * 23) & 0xff

      const encIndexed = encodeIndexedPng({ width: W, height: H, pixels, palette: TEST_PALETTE, transparentIndex: 0 })
      const tmpPathIndexed = join(tmpdir(), `test_indexed_${Date.now()}.png`)
      writeFileSync(tmpPathIndexed, encIndexed)

      try {
        const output = execFileSync('/usr/bin/identify', ['-verbose', tmpPathIndexed], { encoding: 'utf-8' })
        expect(output).toContain('Format: PNG')
        expect(output).toContain('Geometry: 67x43')
        expect(output).toContain('Type: Palette')
      } finally {
        unlinkSync(tmpPathIndexed)
      }

      const rgbaPixels = new Uint8Array(W * H * 4)
      for (let i = 0; i < rgbaPixels.length; i += 1) rgbaPixels[i] = (i * 19) & 0xff
      const encRgba = encodeRgbaPng({ width: W, height: H, pixels: rgbaPixels })
      const tmpPathRgba = join(tmpdir(), `test_rgba_${Date.now()}.png`)
      writeFileSync(tmpPathRgba, encRgba)

      try {
        const output = execFileSync('/usr/bin/identify', ['-verbose', tmpPathRgba], { encoding: 'utf-8' })
        expect(output).toContain('Format: PNG')
        expect(output).toContain('Geometry: 67x43')
      } finally {
        unlinkSync(tmpPathRgba)
      }
    })
  })
})
