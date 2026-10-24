/**
 * Diablo II `.dcc` sprite decoder.
 *
 * A DCC is a *cell-compressed* sprite sheet: instead of storing each frame as a
 * run stream, the format quantises the art to a 4x4 grid and stores, per frame,
 * a list of pixel codes per cell plus a flag telling the decoder when a cell is
 * identical to the same slot in an earlier frame. Decoding therefore happens in
 * three passes, and the order matters:
 *
 * 1. A direction begins with a header declaring the *bit widths* of the
 *    per-frame header fields (through a small lookup table, because the format's
 *    authors only needed a dozen widths), then the frame headers, then the table
 *    describing the direction's padded canvas.
 * 2. The payload is four independent bit streams layered over each other —
 *    equal-cell flags, pixel mask, encoding type, raw pixel codes — followed by
 *    the pixel-code/displacement stream. Their starts are *bit* offsets, not
 *    byte offsets, so they are read through clones of a single reader whose bit
 *    position inside a byte is preserved exactly.
 * 3. Cells are decoded once per (frame, cell) position into a shared pixel
 *    buffer, then blitted; frames that reuse a cell copy the previous frame's
 *    pixels instead of carrying their own codes.
 *
 * Two conventions this module keeps deliberately:
 *
 * - A frame's `frame.width`/`frame.height` is the *direction's* canvas, not the
 *   frame's own art rectangle. The direction box is the bounding box of every
 *   frame in that direction, so all frames of a direction share dimensions and
 *   compositing is a straight overlay. The frame's own rectangle is exposed as
 *   `width`/`height`/`offsetX`/`offsetY`.
 * - Palette index 0 is transparent, exactly as in `.dc6`; `mask` records which
 *   pixels are opaque so a renderer never has to test a sentinel index.
 *
 * Frames flagged bottom-up are decoded and then flipped vertically — see
 * `flipFrameRows`, which documents the one place the reference gives no answer
 * because it panics instead of implementing the case.
 */
import { BitReader } from './bitstream.ts'
import { CelError } from './sprite.ts'
import type { SpriteFrame } from './sprite.ts'

/** Every DCC starts with this byte; anything else is mislabelled. */
const SIGNATURE = 0x74
/** Direction offsets are stored in bytes but used as bit offsets. */
const DIRECTION_OFFSET_SCALE = 8
/** The pixel grid is quantised to 4x4 cells; no cell is larger than 4 pixels. */
const CELL_SIZE = 4
/**
 * Bit widths are not stored literally: the direction header holds a 4-bit index
 * into this table. It tops out at 32, which bounds every header field.
 */
const BIT_WIDTH_TABLE = [0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 26, 28, 30, 32]
/**
 * Number of set bits in each 4-bit pixel mask, i.e. how many pixel codes the
 * cell stores. A mask of 0 means every code was inherited from an earlier frame.
 */
const PIXEL_MASK_POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4]
/** Guard on the declared direction count. */
const MAX_DIRECTIONS = 256
/** Guard on the declared frames per direction. */
const MAX_FRAMES_PER_DIRECTION = 4096
/** Guard on one direction canvas, in pixels. */
const MAX_PIXELS = 1 << 24

/** The padded canvas coordinates of a direction or of one frame. */
export interface DccBox {
  /** Left edge, in sprite space. */
  readonly left: number
  /** Top edge, in sprite space. */
  readonly top: number
  /** Width in pixels. */
  readonly width: number
  /** Height in pixels. */
  readonly height: number
}

/** One decoded frame: its own art rectangle plus the direction-sized canvas. */
export interface DccFrame {
  /** The frame's own width, as stored in the header. */
  readonly width: number
  /** The frame's own height, as stored in the header. */
  readonly height: number
  /** Anchor x of the frame inside the direction canvas. */
  readonly offsetX: number
  /** Anchor y of the frame inside the direction canvas. */
  readonly offsetY: number
  /** The decoded canvas; its dimensions are the direction's box size. */
  readonly frame: SpriteFrame
  /**
   * Whether the file stored this frame's rows bottom-up, so they were flipped.
   *
   * Exposed because the reference implementation refuses this case outright: the
   * only way to measure how much of a data set depends on the flip judgement is
   * to count the frames that took that path after decoding.
   */
  readonly bottomUp: boolean
}

/** Every frame of one facing direction, drawn on a shared canvas. */
export interface DccDirection {
  /** Bounding box of all frames in this direction. */
  readonly box: DccBox
  /** Frames in animation order. */
  readonly frames: readonly DccFrame[]
}

/** A decoded DCC file. */
export interface DccFile {
  /** Format version byte. */
  readonly version: number
  /** Directions, in file order. */
  readonly directions: readonly DccDirection[]
}

/** A cell rectangle in direction-canvas coordinates. */
interface CellRect {
  width: number
  height: number
  xOffset: number
  yOffset: number
}

/**
 * A cell of the direction grid, which additionally remembers the geometry of the
 * last frame cell that occupied it — the memory that makes equal-cell copying
 * possible.
 */
interface BufferCell extends CellRect {
  lastWidth: number
  lastHeight: number
  lastXOffset: number
  lastYOffset: number
}

/** One frame's header fields and its own cell decomposition. */
interface FrameState {
  box: DccBox
  width: number
  height: number
  offsetX: number
  offsetY: number
  bottomUp: boolean
  horizontalCellCount: number
  verticalCellCount: number
  cells: CellRect[]
}

/** One entry of the shared pixel buffer: four palette codes plus its owner. */
interface PixelBufferEntry {
  value: [number, number, number, number]
  frame: number
  cellIndex: number
}

/** The per-direction decode state, threaded through the three passes. */
interface DirectionState {
  box: DccBox
  frames: FrameState[]
  cells: BufferCell[]
  horizontalCellCount: number
  verticalCellCount: number
  equalCellsBits: number
  pixelMaskBits: number
  encodingTypeBits: number
  rawPixelBits: number
}

/** The seven per-frame header field widths a direction declares. */
interface FieldWidths {
  variable0: number
  width: number
  height: number
  xOffset: number
  yOffset: number
  optionalData: number
  codedBytes: number
}

/**
 * Decode a DCC file.
 *
 * @param data - the complete file.
 * @returns the decoded directions.
 */
export function decodeDcc(data: Uint8Array): DccFile {
  const reader = new BitReader(data, 0)
  const signature = reader.getByte()
  if (signature !== SIGNATURE) {
    throw new CelError(
      `DCC signature 0x${signature.toString(16)} is not 0x${SIGNATURE.toString(16)} (mislabelled file?)`,
    )
  }
  const version = reader.getByte()
  const directionCount = reader.getByte()
  const framesPerDirection = reader.getInt32()
  const serialised = reader.getInt32()
  if (serialised !== 1) {
    throw new CelError(`DCC header word 2 is ${String(serialised)}, the format requires 1`)
  }
  reader.getUint32() // total size coded: the per-direction offsets are authoritative

  if (directionCount < 1 || directionCount > MAX_DIRECTIONS) {
    throw new CelError(`DCC declares ${String(directionCount)} directions (allowed 1..${String(MAX_DIRECTIONS)})`)
  }
  if (framesPerDirection < 1 || framesPerDirection > MAX_FRAMES_PER_DIRECTION) {
    throw new CelError(
      `DCC declares ${String(framesPerDirection)} frames per direction (allowed 1..${String(MAX_FRAMES_PER_DIRECTION)})`,
    )
  }

  const offsets: number[] = []
  for (let i = 0; i < directionCount; i += 1) {
    const byteOffset = reader.getInt32()
    if (byteOffset < 0 || byteOffset * DIRECTION_OFFSET_SCALE >= data.length * 8) {
      throw new CelError(`DCC direction ${String(i)} offset ${String(byteOffset)} is outside the file`)
    }
    offsets.push(byteOffset * DIRECTION_OFFSET_SCALE)
  }

  const directions: DccDirection[] = []
  for (let i = 0; i < directionCount; i += 1) {
    directions.push(decodeDirection(data, offsets[i] ?? 0, framesPerDirection, i))
  }

  return { version, directions }
}

/**
 * Decode one direction, translating any raw reader failure into an error that
 * names the direction.
 *
 * @param data - the complete file.
 * @param bitOffset - the direction's start, in bits.
 * @param framesPerDirection - the file-level frame count.
 * @param index - the direction index.
 * @returns the decoded direction.
 */
function decodeDirection(
  data: Uint8Array,
  bitOffset: number,
  framesPerDirection: number,
  index: number,
): DccDirection {
  const where = `DCC direction ${String(index)}`
  try {
    return decodeDirectionInner(data, bitOffset, framesPerDirection, where)
  } catch (err) {
    throw err instanceof CelError ? err : new CelError(`${where}: ${messageOf(err)}`)
  }
}

/**
 * The direction decode proper: headers, then payload, then cell and frame
 * assembly, in the order the format requires.
 *
 * @param data - the complete file.
 * @param bitOffset - the direction's start, in bits.
 * @param framesPerDirection - the file-level frame count.
 * @param where - error-message prefix.
 * @returns the decoded direction.
 */
function decodeDirectionInner(
  data: Uint8Array,
  bitOffset: number,
  framesPerDirection: number,
  where: string,
): DccDirection {
  const reader = new BitReader(data, bitOffset)
  reader.getUint32() // out size coded, unused
  const compressionFlags = reader.getBits(2)
  const widths: FieldWidths = {
    variable0: (BIT_WIDTH_TABLE[reader.getBits(4)] ?? 0),
    width: (BIT_WIDTH_TABLE[reader.getBits(4)] ?? 0),
    height: (BIT_WIDTH_TABLE[reader.getBits(4)] ?? 0),
    xOffset: (BIT_WIDTH_TABLE[reader.getBits(4)] ?? 0),
    yOffset: (BIT_WIDTH_TABLE[reader.getBits(4)] ?? 0),
    optionalData: (BIT_WIDTH_TABLE[reader.getBits(4)] ?? 0),
    codedBytes: (BIT_WIDTH_TABLE[reader.getBits(4)] ?? 0),
  }

  const frames: FrameState[] = []
  let minX = Number.MAX_SAFE_INTEGER
  let minY = Number.MAX_SAFE_INTEGER
  let maxX = -Number.MAX_SAFE_INTEGER
  let maxY = -Number.MAX_SAFE_INTEGER
  for (let i = 0; i < framesPerDirection; i += 1) {
    const frame = readFrameHeader(reader, widths, i, where)
    minX = Math.min(minX, frame.box.left)
    minY = Math.min(minY, frame.box.top)
    maxX = Math.max(maxX, frame.box.left + frame.box.width)
    maxY = Math.max(maxY, frame.box.top + frame.box.height)
    frames.push(frame)
  }
  const box: DccBox = { left: minX, top: minY, width: maxX - minX, height: maxY - minY }
  if (box.width <= 0 || box.height <= 0 || box.width * box.height > MAX_PIXELS) {
    throw new CelError(`${where}: canvas ${String(box.width)}x${String(box.height)} is implausible`)
  }

  if (widths.optionalData > 0) {
    throw new CelError(
      `${where}: frames declare ${String(widths.optionalData)} bits of optional data, which this decoder does not implement`,
    )
  }

  // The declared sizes are *bit* counts. Each stream is walked through a clone
  // of the reader while the original skips past it, so a stream that starts
  // mid-byte keeps its bit offset — rounding here would shift every code.
  const equalCellsBits = (compressionFlags & 0x2) !== 0 ? reader.getBits(20) : 0
  const pixelMaskBits = reader.getBits(20)
  const encodingTypeBits = (compressionFlags & 0x1) !== 0 ? reader.getBits(20) : 0
  const rawPixelBits = (compressionFlags & 0x1) !== 0 ? reader.getBits(20) : 0

  // The palette table is one validity bit per entry; the valid entries are
  // remapped onto a dense set of codes that the pixel stream then indexes.
  const palette = new Uint8Array(256)
  let paletteCount = 0
  for (let i = 0; i < 256; i += 1) {
    if (reader.getBit() !== 0) {
      palette[paletteCount] = i
      paletteCount += 1
    }
  }

  const equalCells = reader.copy()
  reader.skipBits(equalCellsBits)
  const pixelMask = reader.copy()
  reader.skipBits(pixelMaskBits)
  const encodingType = reader.copy()
  reader.skipBits(encodingTypeBits)
  const rawPixelCodes = reader.copy()
  reader.skipBits(rawPixelBits)
  const pixelCodes = reader.copy()

  const state: DirectionState = {
    box,
    frames,
    cells: [],
    horizontalCellCount: 0,
    verticalCellCount: 0,
    equalCellsBits,
    pixelMaskBits,
    encodingTypeBits,
    rawPixelBits,
  }

  calculateCells(state)
  for (const frame of frames) recalculateCells(state, frame)

  const buffer = fillPixelBuffer(
    state,
    palette,
    pixelCodes,
    equalCells,
    pixelMask,
    encodingType,
    rawPixelCodes,
  )
  const canvases = generateFrames(state, buffer, pixelCodes)

  verifyStream(where, 'equal-cells', equalCells, equalCellsBits)
  verifyStream(where, 'pixel-mask', pixelMask, pixelMaskBits)
  verifyStream(where, 'encoding-type', encodingType, encodingTypeBits)
  verifyStream(where, 'raw-pixel-codes', rawPixelCodes, rawPixelBits)

  const decoded: DccFrame[] = []
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i]
    if (!frame) continue
    const pixels = canvases[i]
    if (!pixels) continue
    if (frame.bottomUp) flipFrameRows(pixels, box, frame.box)
    decoded.push({
      width: frame.width,
      height: frame.height,
      offsetX: frame.offsetX,
      offsetY: frame.offsetY,
      frame: toSpriteFrame(pixels, box.width, box.height),
      bottomUp: frame.bottomUp,
    })
  }

  return { box, frames: decoded }
}

/**
 * Read one frame header.
 *
 * The box is derived from the anchor: a frame is placed top-down relative to its
 * `yOffset`, so its top edge sits `height - 1` rows above it. Bottom-up frames
 * get the same box — the flag describes storage order, not placement, and the
 * reference computes no alternative — and are flipped after decoding instead.
 *
 * @param reader - the direction reader, positioned at the frame header.
 * @param widths - the direction's declared field widths.
 * @param index - the frame index.
 * @param where - error-message prefix.
 * @returns the frame header fields.
 */
function readFrameHeader(reader: BitReader, widths: FieldWidths, index: number, where: string): FrameState {
  const at = `${where} frame ${String(index)}`
  reader.getBits(widths.variable0) // per-frame scratch value, never used
  const width = reader.getBits(widths.width)
  const height = reader.getBits(widths.height)
  const offsetX = reader.getSignedBits(widths.xOffset)
  const offsetY = reader.getSignedBits(widths.yOffset)
  reader.getBits(widths.optionalData) // must be zero-length; enforced after the frame headers
  reader.getBits(widths.codedBytes) // coded byte count, only meaningful to the encoder
  const bottomUp = reader.getBit() === 1

  if (width * height > MAX_PIXELS) {
    throw new CelError(`${at}: implausible size ${String(width)}x${String(height)}`)
  }
  if (width <= 0 || height <= 0) {
    throw new CelError(`${at}: empty frame ${String(width)}x${String(height)}`)
  }

  return {
    box: { left: offsetX, top: offsetY - height + 1, width, height },
    width,
    height,
    offsetX,
    offsetY,
    bottomUp,
    horizontalCellCount: 0,
    verticalCellCount: 0,
    cells: [],
  }
}

/**
 * Decompose the direction canvas into the 4x4-aligned cell grid that every frame
 * cell is addressed against.
 *
 * @param state - the direction state, updated in place.
 */
function calculateCells(state: DirectionState): void {
  const { box } = state
  const horizontal = 1 + Math.trunc((box.width - 1) / CELL_SIZE)
  const vertical = 1 + Math.trunc((box.height - 1) / CELL_SIZE)
  state.horizontalCellCount = horizontal
  state.verticalCellCount = vertical

  const cellWidths = new Array<number>(horizontal).fill(CELL_SIZE)
  cellWidths[horizontal - 1] = box.width - CELL_SIZE * (horizontal - 1)
  const cellHeights = new Array<number>(vertical).fill(CELL_SIZE)
  cellHeights[vertical - 1] = box.height - CELL_SIZE * (vertical - 1)

  const cells: BufferCell[] = []
  for (let y = 0; y < vertical; y += 1) {
    for (let x = 0; x < horizontal; x += 1) {
      cells.push({
        width: cellWidths[x] ?? 0,
        height: cellHeights[y] ?? 0,
        xOffset: x * CELL_SIZE,
        yOffset: y * CELL_SIZE,
        lastWidth: -1,
        lastHeight: -1,
        lastXOffset: 0,
        lastYOffset: 0,
      })
    }
  }
  state.cells = cells
}

/**
 * Decompose one frame into cells aligned to the *direction's* grid.
 *
 * A frame's art rectangle generally does not start on the direction's 4-pixel
 * grid, so the first column and row are truncated to whatever remains of the
 * cell they begin inside. That is what lets one pixel-buffer slot index serve
 * every frame in the direction.
 *
 * @param state - the direction state.
 * @param frame - the frame to decompose.
 */
function recalculateCells(state: DirectionState, frame: FrameState): void {
  const { box } = state
  const firstWidth = CELL_SIZE - ((frame.box.left - box.left) % CELL_SIZE)
  const firstHeight = CELL_SIZE - ((frame.box.top - box.top) % CELL_SIZE)

  const horizontal = cellSpanCount(frame.width, firstWidth)
  const vertical = cellSpanCount(frame.height, firstHeight)
  frame.horizontalCellCount = horizontal
  frame.verticalCellCount = vertical

  const cellWidths = new Array<number>(horizontal).fill(CELL_SIZE)
  if (horizontal === 1) {
    cellWidths[0] = frame.width
  } else {
    cellWidths[0] = firstWidth
    cellWidths[horizontal - 1] = frame.width - firstWidth - CELL_SIZE * (horizontal - 2)
  }
  const cellHeights = new Array<number>(vertical).fill(CELL_SIZE)
  if (vertical === 1) {
    cellHeights[0] = frame.height
  } else {
    cellHeights[0] = firstHeight
    cellHeights[vertical - 1] = frame.height - firstHeight - CELL_SIZE * (vertical - 2)
  }

  const cells: CellRect[] = []
  let yOffset = frame.box.top - box.top
  for (let y = 0; y < vertical; y += 1) {
    let xOffset = frame.box.left - box.left
    for (let x = 0; x < horizontal; x += 1) {
      cells.push({ width: cellWidths[x] ?? 0, height: cellHeights[y] ?? 0, xOffset, yOffset })
      xOffset += cellWidths[x] ?? 0
    }
    yOffset += cellHeights[y] ?? 0
  }
  frame.cells = cells
}

/**
 * How many cells a span of `total` pixels needs when its first cell is already
 * `first` pixels wide.
 *
 * @param total - the span length.
 * @param first - the truncated first cell's length.
 * @returns the cell count.
 */
function cellSpanCount(total: number, first: number): number {
  if (total - first <= 1) return 1
  const remaining = total - first - 1
  return 2 + Math.trunc(remaining / CELL_SIZE) - (remaining % CELL_SIZE === 0 ? 1 : 0)
}

/**
 * Decode the shared pixel buffer: one entry per (frame, cell) that carries pixel
 * codes, in stream order.
 *
 * Four bit streams drive this pass. For every cell the decoder reads an
 * equal-cell flag (only when the slot has been touched before), then a 4-bit
 * mask saying which of the cell's four codes are supplied, then either a raw
 * 8-bit code or a 4-bit displacement from the previous code, run-length extended
 * by 15s. A cell flagged equal contributes no entry at all: the frame generator
 * copies the previous occupant of that grid slot instead.
 *
 * @param state - the direction state.
 * @param palette - the direction's code → palette index table.
 * @param codes - the pixel-code/displacement stream.
 * @param equalCells - the equal-cell flag stream.
 * @param pixelMask - the per-cell mask stream.
 * @param encodingType - the per-cell encoding selector stream.
 * @param rawPixelCodes - the raw 8-bit pixel stream.
 * @returns the buffer, dense from index 0.
 */
function fillPixelBuffer(
  state: DirectionState,
  palette: Uint8Array,
  codes: BitReader,
  equalCells: BitReader,
  pixelMask: BitReader,
  encodingType: BitReader,
  rawPixelCodes: BitReader,
): PixelBufferEntry[] {
  let maxCellX = 0
  let maxCellY = 0
  for (const frame of state.frames) {
    maxCellX += frame.horizontalCellCount
    maxCellY += frame.verticalCellCount
  }
  const buffer: PixelBufferEntry[] = new Array<PixelBufferEntry>(maxCellX * maxCellY)
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] = { value: [0, 0, 0, 0], frame: -1, cellIndex: -1 }
  }
  const slots = new Array<PixelBufferEntry | null>(state.horizontalCellCount * state.verticalCellCount)
  slots.fill(null)

  let entryIndex = -1
  for (let frameIndex = 0; frameIndex < state.frames.length; frameIndex += 1) {
    const frame = state.frames[frameIndex]
  if (!frame) continue
    const originCellX = Math.trunc((frame.box.left - state.box.left) / CELL_SIZE)
    const originCellY = Math.trunc((frame.box.top - state.box.top) / CELL_SIZE)

    for (let cellY = 0; cellY < frame.verticalCellCount; cellY += 1) {
      const gridY = cellY + originCellY
      for (let cellX = 0; cellX < frame.horizontalCellCount; cellX += 1) {
        const gridCell = originCellX + cellX + gridY * state.horizontalCellCount
        const previous = slots[gridCell] ?? null
        let mask: number
        if (previous === null) {
          mask = 0xf // nothing to inherit from, so every code is supplied
        } else {
          if (state.equalCellsBits > 0 && equalCells.getBit() !== 0) continue // repeats: no entry
          mask = pixelMask.getBits(4)
        }

        let lastPixel = 0
        const pixelStack: [number, number, number, number] = [0, 0, 0, 0]
        const pixelCount = (PIXEL_MASK_POPCOUNT[mask] ?? 0)
        const encoded = pixelCount !== 0 && state.encodingTypeBits > 0 ? encodingType.getBit() : 0
        let decoded = 0
        for (let i = 0; i < pixelCount; i += 1) {
          let value: number
          if (encoded !== 0) {
            value = rawPixelCodes.getBits(8)
          } else {
            let displacement = codes.getBits(4)
            value = lastPixel + displacement
            while (displacement === 15) {
              displacement = codes.getBits(4)
              value += displacement
            }
          }
          if (value === lastPixel) {
            pixelStack[i] = 0 // zero displacement means "nothing here", ending the run
            break
          }
          pixelStack[i] = value
          lastPixel = value
          decoded += 1
        }

        entryIndex += 1
        const entry = buffer[entryIndex]
        if (entry === undefined) {
          throw new CelError(
            `pixel buffer overflow at grid cell ${String(gridCell)} (capacity ${String(buffer.length)})`,
          )
        }
        // Codes are stored reversed: the last decoded code belongs to the cell's
        // first pixel, and the mask's lowest set bit picks the next in line.
        let code = decoded - 1
        for (let i = 0; i < CELL_SIZE; i += 1) {
          if ((mask & (1 << i)) !== 0) {
            entry.value[i] = code >= 0 ? (pixelStack[code] ?? 0) & 0xff : 0
            code -= 1
          } else {
            entry.value[i] = previous === null ? 0 : (previous.value[i] ?? 0)
          }
        }
        slots[gridCell] = entry
        entry.frame = frameIndex
        entry.cellIndex = cellX + cellY * frame.horizontalCellCount
      }
    }
  }

  // Buffer values are indices into the direction's dense palette table, not
  // palette entries; resolve them once so the frame pass can use them directly.
  for (let i = 0; i <= entryIndex; i += 1) {
    const entry = buffer[i]
    if (!entry) continue
    for (let x = 0; x < CELL_SIZE; x += 1) entry.value[x] = (palette[entry.value[x] ?? 0] ?? 0)
  }

  return buffer
}

/**
 * Blit the pixel buffer into one canvas per frame.
 *
 * Each (frame, cell) either consumes the next buffer entry — writing it into a
 * shared scratch canvas, then copying it into that frame's canvas — or, when the
 * next entry belongs to another frame, reproduces the previous occupant of the
 * slot: by copying its pixels when the geometry matches, or by leaving the slot
 * transparent when it does not, since the old pixels would not fit.
 *
 * @param state - the direction state.
 * @param buffer - the pixel buffer from `fillPixelBuffer`.
 * @param codes - the pixel-code stream, still positioned after the buffer pass.
 * @returns one canvas per frame, direction-box sized.
 */
function generateFrames(state: DirectionState, buffer: PixelBufferEntry[], codes: BitReader): Uint8Array[] {
  const stride = state.box.width
  const scratch = new Uint8Array(stride * state.box.height)
  for (const cell of state.cells) {
    cell.lastWidth = -1
    cell.lastHeight = -1
  }

  const canvases: Uint8Array[] = []
  let entryIndex = 0
  for (let frameIndex = 0; frameIndex < state.frames.length; frameIndex += 1) {
    const frame = state.frames[frameIndex]
  if (!frame) continue
    const canvas = new Uint8Array(stride * state.box.height)
    for (let c = 0; c < frame.cells.length; c += 1) {
      const cell = frame.cells[c]
      if (!cell) continue
      const gridX = Math.trunc(cell.xOffset / CELL_SIZE)
      const gridY = Math.trunc(cell.yOffset / CELL_SIZE)
      const slot = state.cells[gridX + gridY * state.horizontalCellCount]
      if (!slot) continue
      const entry = buffer[entryIndex]
      if (entry === undefined) {
        throw new CelError(`frame ${String(frameIndex)} cell ${String(c)}: pixel buffer underrun`)
      }

      if (entry.frame !== frameIndex || entry.cellIndex !== c) {
        if (cell.width !== slot.lastWidth || cell.height !== slot.lastHeight) {
          // The previous occupant had a different shape, so only the scratch
          // canvas can be cleared; this frame's cell stays transparent.
          for (let y = 0; y < cell.height; y += 1) {
            const row = cell.xOffset + (y + cell.yOffset) * stride
            for (let x = 0; x < cell.width; x += 1) scratch[row + x] = 0
          }
        } else {
          for (let y = 0; y < cell.height; y += 1) {
            const from = slot.lastXOffset + (y + slot.lastYOffset) * stride
            const to = cell.xOffset + (y + cell.yOffset) * stride
            for (let x = 0; x < cell.width; x += 1) scratch[to + x] = (scratch[from + x] ?? 0)
          }
          blit(scratch, canvas, cell, stride)
        }
      } else {
        if (entry.value[0] === entry.value[1]) {
          // One flat colour for the whole cell, so no per-pixel codes follow.
          for (let y = 0; y < cell.height; y += 1) {
            const row = cell.xOffset + (y + cell.yOffset) * stride
            for (let x = 0; x < cell.width; x += 1) scratch[row + x] = (entry.value[0] ?? 0)
          }
        } else {
          // One bit per pixel when only two codes survive, two bits when there
          // are three or four (the fourth is the "nothing here" code).
          const bits = entry.value[1] !== entry.value[2] ? 2 : 1
          for (let y = 0; y < cell.height; y += 1) {
            const row = cell.xOffset + (y + cell.yOffset) * stride
            for (let x = 0; x < cell.width; x += 1) scratch[row + x] = (entry.value[codes.getBits(bits)] ?? 0)
          }
        }
        blit(scratch, canvas, cell, stride)
        entryIndex += 1
      }

      slot.lastWidth = cell.width
      slot.lastHeight = cell.height
      slot.lastXOffset = cell.xOffset
      slot.lastYOffset = cell.yOffset
    }
    canvases.push(canvas)
  }
  return canvases
}

/**
 * Copy one cell rectangle from the scratch canvas into a frame canvas.
 *
 * @param from - the scratch canvas.
 * @param to - the frame canvas.
 * @param cell - the cell rectangle.
 * @param stride - canvas width in pixels.
 */
function blit(from: Uint8Array, to: Uint8Array, cell: CellRect, stride: number): void {
  for (let y = 0; y < cell.height; y += 1) {
    const row = cell.xOffset + (y + cell.yOffset) * stride
    for (let x = 0; x < cell.width; x += 1) to[row + x] = (from[row + x] ?? 0)
  }
}

/**
 * Flip a frame's pixel rows inside the direction canvas.
 *
 * The reference implementation panics with "bottom up frames are not
 * implemented", so this path has no second opinion to check it against. The
 * flag's documented meaning is that the frame's pixel rows are stored
 * bottom-up, so the frame's own art rectangle — not the whole direction canvas —
 * is mirrored about its horizontal centre line, with the box computed exactly as
 * for a top-down frame. Decoding never *skips* such a frame: the only cost of
 * getting the interpretation wrong is a vertically mirrored frame, which is why
 * the flag is also exposed on the decoded frame for counting.
 *
 * @param pixels - the direction-sized canvas, modified in place.
 * @param directionBox - the direction's box, for offsetting the frame rectangle.
 * @param frameBox - the frame's rectangle.
 */
function flipFrameRows(pixels: Uint8Array, directionBox: DccBox, frameBox: DccBox): void {
  const top = frameBox.top - directionBox.top
  const left = frameBox.left - directionBox.left
  for (let y = 0; y < Math.trunc(frameBox.height / 2); y += 1) {
    const upper = (top + y) * directionBox.width + left
    const lower = (top + frameBox.height - 1 - y) * directionBox.width + left
    for (let x = 0; x < frameBox.width; x += 1) {
      const swap = (pixels[upper + x] ?? 0)
      pixels[upper + x] = (pixels[lower + x] ?? 0)
      pixels[lower + x] = swap
    }
  }
}

/**
 * Wrap a decoded canvas in the project's palette-indexed sprite shape, tagging
 * index 0 as transparent the same way the DC6 decoder does.
 *
 * @param pixels - the canvas, which becomes the index buffer.
 * @param width - canvas width.
 * @param height - canvas height.
 * @returns the sprite frame.
 */
function toSpriteFrame(pixels: Uint8Array, width: number, height: number): SpriteFrame {
  const mask = new Uint8Array(pixels.length)
  for (let i = 0; i < pixels.length; i += 1) mask[i] = pixels[i] === 0 ? 0 : 1
  return { width, height, indices: pixels, mask }
}

/**
 * Assert a sub-stream was consumed exactly to its declared bit length.
 *
 * This is the format's own consistency check: the declared sizes and the actual
 * content have to agree, and a mismatch means the decode drifted, which would
 * otherwise surface only as a subtly wrong sprite.
 *
 * @param where - error-message prefix.
 * @param name - the stream name.
 * @param reader - the sub-stream reader.
 * @param declared - the declared bit length.
 */
function verifyStream(where: string, name: string, reader: BitReader, declared: number): void {
  const consumed = reader.bitsRead()
  if (consumed !== declared) {
    throw new CelError(
      `${where}: ${name} stream consumed ${String(consumed)} bits, header declares ${String(declared)}`,
    )
  }
}

/**
 * Extract a message from an unknown thrown value.
 *
 * @param err - the thrown value.
 * @returns the message.
 */
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
