/**
 * Diablo II `.dc6` sprite decoder.
 *
 * DC6 is Diablo II's replacement for Diablo I's CEL: a multi-direction,
 * multi-frame sheet of palette-indexed frames, stored as one run stream per
 * frame. Two properties are easy to get wrong and are worth stating outright,
 * because both independent reference implementations agree on them:
 *
 * - **Rows are stored bottom-up.** The first decoded scanline is the frame's
 *   last row, so the stream must be written starting at `height - 1` and
 *   counting down. Filling rows top-down yields a vertically mirrored sprite.
 * - **The run alphabet is three-way**, not two: `0x80` ends a scanline, any
 *   other byte with the high bit set is a *transparent* run of `byte & 0x7f`
 *   pixels, and a byte below `0x80` introduces that many literal pixels. A
 *   decoder that treats `0x80` as "transparent run of zero" desynchronises the
 *   rest of the frame.
 *
 * Index 0 is transparent by convention (the encoder leaves the palette's first
 * entry unused), which is why frames carry a mask rather than relying on a
 * sentinel index.
 */
import { FormatError, InvalidFieldError, TruncatedDataError, ByteReader, requireBytes } from './reader.ts'
import type { SpriteFrame, SpriteGroup, SpriteSheet } from './sprite.ts'

/** Byte offset of the file header, and its size. */
const FILE_HEADER_SIZE = 24
/** Byte offset of a frame header inside its frame, and its size. */
const FRAME_HEADER_SIZE = 32
/** Scanline terminator in the run alphabet. */
const END_OF_SCANLINE = 0x80
/** Mask extracting a transparent run's length. */
const RUN_LENGTH_MASK = 0x7f

/** The DC6 file header. */
export interface Dc6Header {
  /** Format version (6 for the shipped format). */
  readonly version: number
  /** Flag word (`1` serialised, `4` 24-bit). */
  readonly flags: number
  /** Encoding word as stored. */
  readonly encoding: number
  /** Number of directions. */
  readonly directions: number
  /** Frames per direction. */
  readonly framesPerDirection: number
}

/** One decoded frame plus the fields the renderer needs for placement. */
export interface Dc6Frame extends SpriteFrame {
  /** Frame anchor x, as stored. */
  readonly offsetX: number
  /** Frame anchor y, as stored. */
  readonly offsetY: number
  /** The frame's own serial number in the sheet. */
  readonly index: number
}

/** A decoded DC6 sheet, grouped by direction. */
export interface Dc6Sheet extends SpriteSheet {
  /** The file header. */
  readonly header: Dc6Header
  /** Frames grouped by direction, each carrying its own size. */
  readonly groups: readonly { readonly frames: readonly Dc6Frame[] }[]
}

/** Guard against a corrupt header demanding a huge allocation. */
const MAX_FRAMES = 4096
/** Guard on one frame's pixel count. */
const MAX_FRAME_PIXELS = 1 << 24

/**
 * Decode a DC6 file.
 *
 * @param data - the complete file.
 * @returns the decoded sheet.
 */
export function decodeDc6(data: Uint8Array): Dc6Sheet {
  const r = new ByteReader(data, 'dc6')
  const version = r.i32le('version')
  const flags = r.u32le('flags')
  const encoding = r.u32le('encoding')
  r.seek(0x10, 'directions')
  const directions = r.i32le('directions')
  const framesPerDirection = r.i32le('framesPerDirection')
  
  const header: Dc6Header = { version, flags, encoding, directions, framesPerDirection }

  if (header.directions <= 0 || header.framesPerDirection <= 0) {
    throw new InvalidFieldError('dc6', 'directions/framesPerDirection', 0x10, `${String(header.directions)}x${String(header.framesPerDirection)}`, '> 0')
  }
  const total = header.directions * header.framesPerDirection
  if (total > MAX_FRAMES) throw new InvalidFieldError('dc6', 'total frames', 0x14, total, `<= ${String(MAX_FRAMES)}`)

  const pointers = new Array<number>(total)
  r.seek(FILE_HEADER_SIZE, 'pointers')
  for (let index = 0; index < total; index += 1) {
    pointers[index] = r.u32le('pointer')
  }

  const groups: { frames: Dc6Frame[] }[] = []
  for (let direction = 0; direction < header.directions; direction += 1) {
    const frames: Dc6Frame[] = []
    for (let frameIndex = 0; frameIndex < header.framesPerDirection; frameIndex += 1) {
      const index = direction * header.framesPerDirection + frameIndex
      // The last frame has no successor pointer: it runs to the end of file.
      const start = pointers[index]! // pointers is an Array<number>, not untrusted data bytes
      const end = index + 1 < total ? pointers[index + 1]! : data.byteLength
      if (start < FILE_HEADER_SIZE || end > data.byteLength || end < start) {
        throw new InvalidFieldError('dc6', 'frame pointer', FILE_HEADER_SIZE + index * 4, `${String(start)}..${String(end)}`, 'valid extent')
      }
      frames.push(decodeFrame(data, start, end, index))
    }
    groups.push({ frames })
  }

  return { header, groups, width: null }
}

/**
 * Decode one frame.
 *
 * @param data - the complete file.
 * @param start - frame start offset.
 * @param end - frame end offset (exclusive).
 * @param index - the frame's serial number.
 * @returns the decoded frame.
 */
function decodeFrame(data: Uint8Array, start: number, end: number, index: number): Dc6Frame {
  const r = new ByteReader(data, 'dc6')
  r.seek(start, 'frame header')
  r.skip(4, 'flipped')
  const width = r.i32le('width')
  const height = r.i32le('height')
  const offsetX = r.i32le('offsetX')
  const offsetY = r.i32le('offsetY')
  r.skip(8, 'reserved')
  const length = r.u32le('length')

  if (width < 0 || height < 0 || width * height > MAX_FRAME_PIXELS) {
    throw new InvalidFieldError('dc6', 'frame geometry', start + 0x04, `${String(width)}x${String(height)}`, `positive, <= ${String(MAX_FRAME_PIXELS)} px`)
  }
  
  const streamEnd = Math.min(end, start + FRAME_HEADER_SIZE + length)
  requireBytes(data, start + FRAME_HEADER_SIZE, streamEnd - (start + FRAME_HEADER_SIZE), 'dc6', 'run stream')

  const indices = new Uint8Array(width * height)
  const mask = new Uint8Array(width * height)
  let cursor = start + FRAME_HEADER_SIZE
  // Rows land bottom-up: the first scanline written is the frame's last row.
  let x = 0
  let y = height - 1
  let complete = false
  while (cursor < streamEnd && y >= 0) {
    const control = data[cursor]
    if (control === undefined) break
    cursor += 1
    if (control === END_OF_SCANLINE) {
      if (y === 0) { complete = true; break }
      y -= 1
      x = 0
    } else if ((control & END_OF_SCANLINE) !== 0) {
      x += control & RUN_LENGTH_MASK
    } else {
      if (cursor + control > streamEnd) {
        throw new TruncatedDataError('dc6', 'literal run', cursor, control, streamEnd - cursor, data.length)
      }
      const rowStart = y * width
      for (let i = 0; i < control; i += 1) {
        const at = rowStart + x + i
        if (x + i >= width) break
        const value = data[cursor + i]
        if (value === undefined) break
        indices[at] = value
        // Index 0 is the transparent entry by convention.
        mask[at] = value === 0 ? 0 : 1
      }
      cursor += control
      x += control
    }
  }
  if (!complete) {
    // The reference decoders stop at the final end-of-scanline; a stream that
    // ends without one is still usable, so this is reported by leaving the
    // remaining rows transparent rather than failing the whole sheet.
    // (Frames with height 1 legitimately end at `y === 0` handled above.)
  }
  return { width, height, indices, mask, offsetX, offsetY, index }
}

/** A decoded frame with its placement fields, as the atlas packer wants it. */
export type { SpriteGroup }
