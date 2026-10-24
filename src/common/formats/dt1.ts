import { CelError } from "./sprite.ts";

import { FormatError, InvalidFieldError, TruncatedDataError, requireBytes } from './reader.ts'

/** Bytes of the fixed header before the tile count. */
const HEADER_PREFIX = 8
/** Bytes of unknown data between the version and the tile count. */
const HEADER_UNKNOWN = 260
/** Bytes per tile record. */
const TILE_RECORD_SIZE = 96
/** Pixel height of one block's covered area, used to size tile bitmaps. */
const BLOCK_PIXEL_HEIGHT = 32
/** Bytes per block header. */
const BLOCK_HEADER_SIZE = 20
/** Sub-tile grid edge (5×5 collision flags per tile). */
export const SUB_TILE_GRID = 5
/** Row offsets of the isometric diamond, one entry per row. */
const ISO_JUMP = [14, 12, 10, 8, 6, 4, 2, 0, 2, 4, 6, 8, 10, 12, 14] as const
/** Row run lengths of the isometric diamond, one entry per row. */
const ISO_RUN = [4, 8, 12, 16, 20, 24, 28, 32, 28, 24, 20, 16, 12, 8, 4] as const

/** A tile's collision flags, decoded from one of its 25 sub-tile bytes. */
export interface SubTileFlags {
  /** Blocks walking (all units). */
  readonly blockWalk: boolean
  /** Blocks line of sight. */
  readonly blockLos: boolean
  /** Blocks jumping/leaping. */
  readonly blockJump: boolean
  /** Blocks the player specifically (but not monsters). */
  readonly blockPlayerWalk: boolean
  /** Blocks light. */
  readonly blockLight: boolean
  /** Raw byte, for the bits that are not named. */
  readonly raw: number
}

/** One block of a tile: its placement inside the tile and its pixels. */
export interface Dt1Block {
  /** Destination x within the tile. */
  readonly x: number
  /** Destination y within the tile. */
  readonly y: number
  /** Block grid position, as stored. */
  readonly gridX: number
  /** Block grid position, as stored. */
  readonly gridY: number
  /** Encoding: 0 run-length, 1 isometric. */
  readonly format: number
  /** Palette indices, laid out at tile size (tile width × |tile height|). */
  readonly pixels: Uint8Array
}

/** A block header as stored (20 bytes). */
interface BlockHeader {
  /** Destination x within the tile. */
  readonly x: number
  /** Destination y within the tile. */
  readonly y: number
  /** Sub-tile grid column (floor tiles only). */
  readonly gridX: number
  /** Sub-tile grid row (floor tiles only). */
  readonly gridY: number
  /** Encoding: 0 run-length, 1 isometric. */
  readonly format: number
  /** Encoded byte count. */
  readonly length: number
  /** Offset of the encoded data, as stored. */
  readonly fileOffset: number
  /** Offset of the block header that carries it. */
  readonly headerOffset: number
}

/**
 * Resolve where a block's encoded bytes actually live.
 *
 * The community format documentation calls the field "offset in file", while the
 * working reference implementation reads it relative to the block header. Both
 * readings occur in the wild, so the decoder tries the reference's reading
 * first and falls back to the absolute one when that range is unusable — and a
 * file that satisfies neither is reported rather than decoded into noise.
 *
 * @param data - the complete file.
 * @param block - the block header.
 * @returns the absolute offset of the encoded data.
 */
function resolveBlockDataOffset(data: Uint8Array, block: BlockHeader): number[] {
  const relative = block.headerOffset + block.fileOffset
  const absolute = block.fileOffset
  const fits = (offset: number): boolean =>
    offset >= 0 && offset + block.length <= data.byteLength && block.length >= 0
  const candidates = [relative, absolute].filter((offset, index, all) => fits(offset) && all.indexOf(offset) === index)
  if (candidates.length === 0) {
    throw new InvalidFieldError('dt1', 'block fileOffset', block.headerOffset + 16, Math.max(relative, absolute), 'data fitting the file bounds')
  }
  return candidates
}

/** One tile of the library. */
export interface Dt1Tile {
  /** Orientation/direction index. */
  readonly direction: number
  /** Tile height, negative for roofs. */
  readonly height: number
  /** Tile width. */
  readonly width: number
  /** Tile type (the `type` half of a DS1 tile reference). */
  readonly type: number
  /** Tile style (the `style` half of a DS1 tile reference). */
  readonly style: number
  /** Sequence within the style. */
  readonly sequence: number
  /** Material bit field (water, wood, stone, ...). */
  readonly materialFlags: number
  /**
   * Roof height, at file offset +4.
   *
   * OpenDiablo2 reads this field and uses it for one thing: a roof tile's
   * `YAdjust` is `-roofHeight` instead of `minBlockY + 80`
   * (`d2maprenderer/tile_cache.go`). Kept here so the roof layer can be drawn
   * with the engine's own offset when it is wired up.
   */
  readonly roofHeight: number
  /**
   * Animated flag, at file offset +7.
   *
   * Non-zero (specifically bit 0 set) when this tile is part of an animated sequence.
   * For animated tiles, `rarityFrameIndex` specifies the 0-based animation frame index
   * rather than a variant selection weight.
   */
  readonly animated: number
  /**
   * Variant weight inside one `style:sequence` group, at file offset +32.
   *
   * A DT1 ships several tiles for the same `style`/`sequence` and the engine
   * picks one **per cell** by weighted random using this field as the weight
   * (OpenDiablo2 `getRandomTile`, seeded from the map seed and the cell's x/y).
   * Without it every cell of a floor would draw the same variant.
   */
  readonly rarityFrameIndex: number
  /** 25 sub-tile collision flag sets, row-major on a 5×5 grid. */
  readonly subTileFlags: readonly SubTileFlags[]
  /**
   * Most negative block `y` in this tile.
   *
   * Blocks are placed with this shift applied (see {@link Dt1Tile.blocks}), and
   * the value is also what Diablo II's renderer adds to a wall's cell position
   * (`YAdjust = minBlockY + 80`): a wall whose art extends above its cell must
   * be pushed back down by exactly the amount the art was shifted. Floors ignore
   * it, which is why only walls look wrong when it is dropped.
   */
  readonly minBlockY: number
  /**
   * Height of the decoded bitmap, in pixels.
   *
   * Usually `|height|`, but a wall's art can legitimately extend past the
   * declared height (the reference renderer allocates
   * `max(|height|, maxBlockY + 32 - minBlockY)` for exactly this reason). Using
   * the declared height alone clips those tiles — two references in Act 5's town
   * hit that case.
   */
  readonly bitmapHeight: number
  /** The tile's blocks, in file order. */
  readonly blocks: readonly Dt1Block[]
}

/** A decoded DT1 file. */
export interface Dt1 {
  /**
   * Structural surprises that did not prevent decoding (empty for a
   * well-formed library). Real Blizzard files are expected to leave this empty;
   * a non-empty list means a field's meaning differs from the documented one.
   */
  readonly warnings: readonly string[]
  /** Major version, as stored (7 for shipped files). */
  readonly versionMajor: number
  /** Minor version, as stored (6 for shipped files). */
  readonly versionMinor: number
  /** The tile library. */
  readonly tiles: readonly Dt1Tile[]
}

/**
 * Read a little-endian uint32.
 *
 * @param data - the buffer.
 * @param at - byte offset.
 * @returns the value.
 */
function u32(data: Uint8Array, at: number): number {
  requireBytes(data, at, 4, 'dt1', 'u32')
  requireBytes(data, at, 4, 'dt1', 'u32')
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(at, true)
}

/**
 * Read a little-endian int32.
 *
 * @param data - the buffer.
 * @param at - byte offset.
 * @returns the value.
 */
function i32(data: Uint8Array, at: number): number {
  return u32(data, at) | 0
}

/**
 * Read a little-endian uint16.
 *
 * @param data - the buffer.
 * @param at - byte offset.
 * @returns the value.
 */
function u16(data: Uint8Array, at: number): number {
  requireBytes(data, at, 2, 'dt1', 'u16')
  requireBytes(data, at, 2, 'dt1', 'u16')
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(at, true)
}

/**
 * Read a little-endian int16.
 *
 * @param data - the buffer.
 * @param at - byte offset.
 * @returns the value.
 */
function i16(data: Uint8Array, at: number): number {
  const value = u16(data, at)
  return value >= 0x8000 ? value - 0x10000 : value
}

/**
 * Decode one sub-tile flag byte.
 *
 * @param raw - the flag byte.
 * @returns the decoded flags.
 */
export function subTileFlagsOf(raw: number): SubTileFlags {
  return {
    blockWalk: (raw & 1) === 1,
    blockLos: (raw & 2) === 2,
    blockJump: (raw & 4) === 4,
    blockPlayerWalk: (raw & 8) === 8,
    blockLight: (raw & 32) === 32,
    raw,
  }
}

/**
 * Whether a DT1 tile is part of an animated sequence.
 *
 * Byte +7 is the high byte of the u16 material flags at +6 (`D2TileLibraryEntryStrc::nFlags`), not a dedicated
 * "animated" byte. 1.13c D2Common animates a tile iff `TILE_FLAGS_LAVA` (`0x100`, bit 0 of byte +7) is set:
 * `DRLGANIM_TestLoadAnimatedRoomTiles` / `DRLGANIM_AllocAnimationTileGrid` call `D2CMP.#10051` (returns the word at
 * `+0x06`) and test `ah, 0x1` (`0x6fd62f20`, `0x6fd62ff0`). Other bits of byte +7 are plain materials — notably
 * `TILE_FLAGS_SNOW` (`0x400`, byte +7 = `4`) on every Act 5 `siege\snow.dt1` / `cliff.dt1` snow floor — and must not
 * animate (issue #923: treating any non-zero byte as animated cycled the snow patch variants every frame).
 * When animated, `rarityFrameIndex` is the 0-based animation frame index rather than a variation weight.
 *
 * @param tile - the DT1 tile to check (`animated` = byte +7).
 * @returns true if the tile is an animated frame.
 */
export function isAnimatedTile(tile: { readonly animated?: number }): boolean {
  return typeof tile.animated === 'number' && (tile.animated & 1) === 1
}

/**
 * Decode a DT1 file.
 *
 * @param data - the complete file.
 * @returns the decoded library.
 */
export function decodeDt1(data: Uint8Array): Dt1 {
  if (data.byteLength < HEADER_PREFIX + HEADER_UNKNOWN + 8) {
    throw new TruncatedDataError('dt1', 'header', 0, HEADER_PREFIX + HEADER_UNKNOWN + 8, data.byteLength, data.byteLength)
  }
  const versionMajor = i32(data, 0)
  const versionMinor = i32(data, 4)
  if (versionMajor !== 7 || versionMinor !== 6) {
    throw new InvalidFieldError('dt1', 'version', 0, `${String(versionMajor)}.${String(versionMinor)}`, '7.6')
  }
  const tileCount = i32(data, HEADER_PREFIX + HEADER_UNKNOWN)
  const tileDataStart = i32(data, HEADER_PREFIX + HEADER_UNKNOWN + 4)
  if (tileCount < 0 || tileDataStart < 0 || tileDataStart > data.byteLength) {
    throw new InvalidFieldError('dt1', 'tile metadata', HEADER_PREFIX + HEADER_UNKNOWN, `${String(tileCount)} tiles at ${String(tileDataStart)}`, 'plausible layout')
  }
  const tilesEnd = tileDataStart + tileCount * TILE_RECORD_SIZE
  if (tilesEnd > data.byteLength) {
    throw new TruncatedDataError('dt1', 'tiles area', tileDataStart, tileCount * TILE_RECORD_SIZE, data.byteLength - tileDataStart, data.byteLength)
  }

  const warnings: string[] = []
  const records: { tile: Omit<Dt1Tile, 'blocks' | 'minBlockY' | 'bitmapHeight'>; blocks: BlockHeader[] }[] = []
  for (let index = 0; index < tileCount; index += 1) {
    const at = tileDataStart + index * TILE_RECORD_SIZE
    const subTileFlags: SubTileFlags[] = []
    for (let subY = 0; subY < SUB_TILE_GRID; subY += 1) {
      for (let subX = 0; subX < SUB_TILE_GRID; subX += 1) {
        // DT1 sub-tile collision flags are stored bottom-to-top in the binary
        // (bytes 0..4 are the bottom row subY=4, bytes 20..24 are the top row subY=0).
        // OpenDiablo2 subtileLookup: row 0 -> 20..24, row 4 -> 0..4.
        // D2MOO D2Collision.cpp: pTmp = &v5[5 * (nY - nCappedY + 4) - nX].
        // Normalize into top-to-bottom row order [subY * 5 + subX].
        const fileIndex = (SUB_TILE_GRID - 1 - subY) * SUB_TILE_GRID + subX
        subTileFlags.push(subTileFlagsOf(new DataView(data.buffer, data.byteOffset, data.byteLength).getUint8(at + 40 + fileIndex)))
      }
    }
    const blockHeaderPointer = i32(data, at + 72)
    const blockHeaderSize = i32(data, at + 76)
    const numBlocks = i32(data, at + 80)
    const blocks: BlockHeader[] = []
    for (let blockIndex = 0; blockIndex < numBlocks; blockIndex += 1) {
      const headerAt = blockHeaderPointer + blockIndex * BLOCK_HEADER_SIZE
      if (headerAt + BLOCK_HEADER_SIZE > data.byteLength) {
        throw new InvalidFieldError("dt1", "block header offset", at + 72, headerAt + BLOCK_HEADER_SIZE, `<= ${String(data.byteLength)}`)
      }
      // Block header (20 bytes): X, Y, 2 unused, GridX, GridY, Format,
      // Length, 2 unused, FileOffset. Note the two unused words: a 16-byte
      // reading of this record parses every field after Y at the wrong offset.
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
      blocks.push({
        x: i16(data, headerAt),
        y: i16(data, headerAt + 2),
        gridX: view.getUint8(headerAt + 6),
        gridY: view.getUint8(headerAt + 7),
        format: i16(data, headerAt + 8),
        length: i32(data, headerAt + 10),
        fileOffset: i32(data, headerAt + 16),
        headerOffset: blockHeaderPointer,
      })
    }
    records.push({
      tile: {
        direction: i32(data, at + 0),
        height: i32(data, at + 8),
        width: i32(data, at + 12),
        type: i32(data, at + 20),
        style: i32(data, at + 24),
        sequence: i32(data, at + 28),
        materialFlags: u16(data, at + 6),
        roofHeight: i16(data, at + 4),
        animated: new DataView(data.buffer, data.byteOffset, data.byteLength).getUint8(at + 7),
        rarityFrameIndex: i32(data, at + 32),
        subTileFlags,
      },
      blocks,
    })
    // The field at +76 is *not* a per-block stride: real Act 1 town tiles carry
    // 25 blocks and a value of 6900, which is the whole block section —
    // `25 * 20 (headers) + 25 * 256 (bodies)`. Treating it as `numBlocks * 20`
    // rejected every real Diablo II DT1 while accepting our own fixtures, which
    // is exactly the failure mode a fixture-only round trip cannot see. The
    // invariant is checked and reported instead of guessed at.
    if (numBlocks > 0) {
      const bodies = blocks.reduce((sum, block) => sum + block.length, 0)
      const expected = numBlocks * BLOCK_HEADER_SIZE + bodies
      if (blockHeaderSize !== expected) {
        warnings.push(
          `tile ${String(index)}: block section is ${String(blockHeaderSize)} bytes, `
          + `but ${String(numBlocks)} headers + ${String(bodies)} body bytes = ${String(expected)}`,
        )
      }
    }
  }

  // Each tile is shifted by its *own* most negative block y, not by a file-wide
  // worst case: a wall's art legitimately extends above its cell (that is what
  // makes it a wall), and a shared shift would push every other tile down by the
  // tallest wall in the library.
  const tiles: Dt1Tile[] = records.map((record, index) => {
    let minBlockY = 0
    let maxBlockY = 0
    for (const block of record.blocks) {
      if (block.y < minBlockY) minBlockY = block.y
      if (block.y + BLOCK_PIXEL_HEIGHT > maxBlockY) maxBlockY = block.y + BLOCK_PIXEL_HEIGHT
    }
    const yOffset = -minBlockY
    const bitmapHeight = Math.max(Math.abs(record.tile.height), maxBlockY - minBlockY)
    return {
      ...record.tile,
      minBlockY,
      bitmapHeight,
      blocks: record.blocks.map(block => decodeBlock(data, block, record.tile, yOffset, index, bitmapHeight)),
    }
  })

  return { versionMajor, versionMinor, tiles, warnings }
}

/**
 * Decode one block's pixels at tile size.
 *
 * @param data - the complete file.
 * @param block - the block header.
 * @param tile - the owning tile.
 * @param yOffset - vertical shift applied to every block.
 * @param tileIndex - the tile's index, for error messages.
 * @returns the block with pixels.
 */
function decodeBlock(
  data: Uint8Array,
  block: BlockHeader,
  tile: Omit<Dt1Tile, 'blocks' | 'minBlockY' | 'bitmapHeight'>,
  yOffset: number,
  tileIndex: number,
  bitmapHeight: number,
): Dt1Block {
  const tileWidth = tile.width
  const tileHeight = bitmapHeight
  if (tileWidth <= 0 || tileHeight <= 0 || tileWidth * tileHeight > (1 << 22)) {
    throw new InvalidFieldError('dt1', 'tile bounds', block.headerOffset, `${String(tileWidth)}x${String(tileHeight)}`, `area <= ${String(1 << 22)}`)
  }
  const pixels = new Uint8Array(tileWidth * tileHeight)
  const decodeWith = (offset: number): Uint8Array => {
    const encoded = data.subarray(offset, offset + block.length)
    if (encoded.byteLength < block.length) {
      throw new TruncatedDataError('dt1', 'block stream', offset, block.length, encoded.byteLength, data.byteLength)
    }
    const target = new Uint8Array(tileWidth * tileHeight)
    if (block.format === 1) {
      decodeIsometric(encoded, target, block, tileWidth, tileHeight, yOffset)
    } else {
      decodeRunLength(encoded, target, block, tileWidth, tileHeight, yOffset)
    }
    return target
  }
  // The offset field's base is not settled by the documentation (`offset in
  // file`) versus the reference implementation (relative to the block header),
  // so both readings are tried. An all-transparent result is what a wrong-but-
  // in-range reading looks like — an RLE stream of zero pairs advances rows and
  // draws nothing — so a blank first attempt falls through to the alternative
  // instead of being returned as a silently empty tile.
  let best: Uint8Array | null = null
  for (const offset of resolveBlockDataOffset(data, block)) {
    const decoded = decodeWith(offset)
    if (decoded.some(value => value !== 0)) return { x: block.x, y: block.y, gridX: block.gridX, gridY: block.gridY, format: block.format, pixels: decoded }
    best ??= decoded
  }
  /* v8 ignore next -- resolveBlockDataOffset guarantees at least one candidate. */
  if (best === null) throw new FormatError('dt1', 'block decode', block.headerOffset, `tile ${String(tileIndex)} block produced no data`)
  return { x: block.x, y: block.y, gridX: block.gridX, gridY: block.gridY, format: block.format, pixels: best }
}

/**
 * Lay an isometric block onto the tile bitmap.
 *
 * @param encoded - the 256-byte block.
 * @param pixels - the tile bitmap to fill.
 * @param block - the block placement.
 * @param tileWidth - tile width.
 * @param tileHeight - tile height.
 * @param yOffset - vertical shift applied to every block.
 */
function decodeIsometric(
  encoded: Uint8Array,
  pixels: Uint8Array,
  block: { x: number; y: number },
  tileWidth: number,
  tileHeight: number,
  yOffset: number,
): void {
  let index = 0
  for (let row = 0; row < ISO_JUMP.length && index < encoded.byteLength; row += 1) {
    const startX = ISO_JUMP[row]!
    const run = ISO_RUN[row]!
    for (let i = 0; i < run; i += 1) {
      const x = block.x + startX + i
      const y = block.y + row + yOffset
      if (x < 0 || x >= tileWidth || y < 0 || y >= tileHeight) { index += 1; continue }
      const val = encoded[index]
      if (val === undefined) return
      pixels[y * tileWidth + x] = val
      index += 1
    }
  }
}

/**
 * Lay a run-length encoded block onto the tile bitmap.
 *
 * @param encoded - the block's run stream.
 * @param pixels - the tile bitmap to fill.
 * @param block - the block placement.
 * @param tileWidth - tile width.
 * @param tileHeight - tile height.
 * @param yOffset - vertical shift applied to every block.
 */
function decodeRunLength(
  encoded: Uint8Array,
  pixels: Uint8Array,
  block: { x: number; y: number },
  tileWidth: number,
  tileHeight: number,
  yOffset: number,
): void {
  let index = 0
  let remaining = blockLengthOf(encoded)
  let x = 0
  let y = 0
  while (remaining > 0 && index + 1 < encoded.byteLength) {
    const skip = encoded[index]
    const count = encoded[index + 1]
    if (skip === undefined || count === undefined) return
    index += 2
    remaining -= 2
    if ((skip | count) === 0) {
      x = 0
      y += 1
      continue
    }
    x += skip
    remaining -= count
    for (let i = 0; i < count; i += 1) {
      const px = block.x + x + i
      const py = block.y + y + yOffset
      if (px >= 0 && px < tileWidth && py >= 0 && py < tileHeight) {
        pixels[py * tileWidth + px] = encoded[index] ?? 0
      }
      index += 1
    }
    x += count
  }
}

/**
 * The block's declared length, which the caller substitutes for the stream's
 * own bound. Kept as a helper so the run-length loop reads the same way as the
 * reference decoder, which counts down a byte budget rather than testing the
 * buffer end.
 *
 * @param encoded - the block's bytes.
 * @returns the byte budget.
 */
function blockLengthOf(encoded: Uint8Array): number {
  return encoded.byteLength
}
