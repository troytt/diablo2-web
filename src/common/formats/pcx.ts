/**
 * PCX decoder for the 8-bit, single-plane, RLE-compressed images Diablo I and
 * II use for UI art.
 *
 * Only the variant the games actually ship is supported: manufacturer 0x0A,
 * encoding 1 (RLE), bitsPerPixel 8, planes 1, with the 256-colour palette in
 * the trailing 769 bytes (0x0C marker + 768 bytes of VGA triples).
 */

import { ByteReader, FormatError, InvalidFieldError, TruncatedDataError } from './reader.ts'

/** One decoded image, ready to blit. */
export interface PcxImage {
  /** Pixel width. */
  readonly width: number
  /** Pixel height. */
  readonly height: number
  /** RGBA8 pixels, row-major, top-left origin. */
  readonly rgba: Uint8ClampedArray
  /** The file's 256-colour palette as RGB triples. */
  readonly palette: Uint8Array
}

/**
 * Decode a PCX image.
 *
 * @param data - the complete file.
 * @returns the decoded image.
 */
export function decodePcx(data: Uint8Array): PcxImage {
  const r = new ByteReader(data, 'pcx')
  const manufacturer = r.u8('manufacturer')
  if (manufacturer !== 0x0a) throw new InvalidFieldError('pcx', 'manufacturer', 0, manufacturer, 0x0a)
  r.u8('version')
  const encoding = r.u8('encoding')
  const bpp = r.u8('bpp')
  const xMin = r.u16le('xMin')
  const yMin = r.u16le('yMin')
  const xMax = r.u16le('xMax')
  const yMax = r.u16le('yMax')
  
  // Skip to planes
  r.seek(65, 'planes')
  const planes = r.u8('planes')
  const bytesPerLine = r.u16le('bytesPerLine')

  if (bpp !== 8 || planes !== 1) {
    throw new InvalidFieldError('pcx', 'bpp/planes', 3, bpp, '8 and 1')
  }

  const width = xMax - xMin + 1
  const height = yMax - yMin + 1
  if (width <= 0 || width > 32767 || height <= 0 || height > 32767 || bytesPerLine < width) {
    throw new InvalidFieldError('pcx', 'geometry', 8, `${String(width)}x${String(height)}`, 'valid geometry')
  }

  // The palette is the last 769 bytes, marked by 0x0C.
  const paletteAt = data.byteLength - 769
  if (paletteAt < 128) {
    throw new TruncatedDataError('pcx', 'trailer', data.byteLength, 769, 0, data.byteLength)
  }
  if (data[paletteAt] !== 0x0c) {
    throw new InvalidFieldError('pcx', 'palette marker', paletteAt, data[paletteAt], 0x0c)
  }
  const palette = data.subarray(paletteAt + 1, paletteAt + 769)

  // Row-major RLE: a byte with the two top bits set is a run of the low six
  // bits, followed by the value; anything else is one literal pixel.
  const pixels = new Uint8Array(width * height)
  let read = 128
  if (encoding === 1) {
    for (let row = 0; row < height; row += 1) {
      let column = 0
      while (column < bytesPerLine) {
        if (read >= paletteAt) throw new TruncatedDataError('pcx', 'rle stream', read, 1, 0, paletteAt)
        const marker = data[read]
        if (marker === undefined) throw new TruncatedDataError('pcx', 'rle stream', read, 1, 0, paletteAt)
        read += 1
        if ((marker & 0xc0) === 0xc0) {
          const run = marker & 0x3f
          if (read >= paletteAt) throw new TruncatedDataError('pcx', 'rle run', read, 1, 0, paletteAt)
          const value = data[read]
          if (value === undefined) throw new TruncatedDataError('pcx', 'rle run', read, 1, 0, paletteAt)
          read += 1
          for (let i = 0; i < run && column < bytesPerLine; i += 1, column += 1) {
            if (column < width) pixels[row * width + column] = value
          }
        } else {
          if (column < width) pixels[row * width + column] = marker
          column += 1
        }
      }
    }
  } else if (encoding === 0) {
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const at = 128 + row * bytesPerLine + column
        if (at >= paletteAt) throw new TruncatedDataError('pcx', 'raw image', at, 1, 0, paletteAt)
        const val = data[at]
        if (val === undefined) throw new TruncatedDataError('pcx', 'raw image', at, 1, 0, paletteAt)
        pixels[row * width + column] = val
      }
    }
  } else {
    throw new InvalidFieldError('pcx', 'encoding', 2, encoding, '0 or 1')
  }

  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < pixels.length; i += 1) {
    // pixels[i] max is 255
    const index = pixels[i]! * 3
    rgba[i * 4] = palette[index]!
    rgba[i * 4 + 1] = palette[index + 1]!
    rgba[i * 4 + 2] = palette[index + 2]!
    rgba[i * 4 + 3] = 255
  }
  return { width, height, rgba, palette }
}
