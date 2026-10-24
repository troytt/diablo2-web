import { CelError } from "./sprite.ts";

/**
 * Diablo II `.ds1` map decoder.
 *
 * A DS1 is a map *layout*: a grid of tiles, each slot holding one reference per
 * layer (four wall layers, four orientation layers, two floor layers, a shadow
 * layer and a substitution layer, depending on the version). A reference is
 * only `(style, sequence)` into a DT1 library — the pixels come from there —
 * so DS1 and DT1 are useless apart and are decoded as a pair.
 *
 * The file is a versioned sequence of optional sections, which is the whole
 * difficulty: which fields exist depends on a version number, and the layer
 * streams are interleaved in a fixed order that also has a legacy shape for
 * versions below 4. Both are encoded here exactly as the reference decoder
 * reads them, including the pre-7 orientation lookup table.
 */
import { FormatError, InvalidFieldError, TruncatedDataError } from './reader.ts'

/** Pre-7 maps store orientations through this lookup rather than directly. */
const LEGACY_DIRECTION_LOOKUP = [
  0x00, 0x01, 0x02, 0x01, 0x02, 0x03, 0x03, 0x05, 0x05, 0x06,
  0x06, 0x07, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e,
  0x0f, 0x10, 0x11, 0x12, 0x14,
] as const

/** Version at which the act field exists. */
const V_ACT = 8
/** Version at which the substitution type exists. */
const V_SUBSTITUTION_LAYERS = 10
/** Version at which the embedded file list exists. */
const V_FILES = 3
/** Versions 9..13 carry eight unknown bytes. */
const V_UNKNOWN_LOW = 9
const V_UNKNOWN_HIGH = 13
/** Version at which floor layers exist (below it there is exactly one). */
const V_FLOORS = 4
/** Version at which wall layers exist. */
const V_WALLS = 16
/** Version at which NPC paths exist. */
const V_NPCS = 14
/** Below this version the orientation field goes through the lookup. */
const V_DIRECT_ORIENTATION = 7

/** One wall cell: a tile reference plus the wall's own fields. */
export interface Ds1Wall {
  /** Palette/tile property byte. */
  readonly prop1: number
  /** Sequence within the style (0..63). */
  readonly sequence: number
  /** Style index within the DT1 library. */
  readonly style: number
  /** Orientation index (a DT1 `direction`). */
  readonly type: number
  /** Unnamed field, as stored. */
  readonly unknown1: number
  /** Unnamed field, as stored. */
  readonly unknown2: number
  /** The cell is hidden. */
  readonly hidden: boolean
  /** Exact DT1 library index chosen by DRLG (bypasses `pickVariant` when set). */
  readonly dt1Library?: number
  /** Exact DT1 tile index chosen by DRLG (bypasses `pickVariant` when set). */
  readonly dt1Tile?: number
  /** Exact DT1 library index for a top-corner-left (type 4) companion of a type-3 wall. */
  readonly companionDt1Library?: number
  /** Exact DT1 tile index for a top-corner-left (type 4) companion of a type-3 wall. */
  readonly companionDt1Tile?: number
  /**
   * DRLG walls only: `D2DrlgTileDataStrc::unk0x10` coord list (`nIndex`, level-local `pBox[0].nPosX/nPosY`)
   * read by the 1.13c wall occlusion fade (D2Client `0x6fb29f20`). Absent when `unk0x10` is NULL.
   */
  readonly fadeBox?: { readonly index: number; readonly x: number; readonly y: number }
  /** DRLG walls only: `dwFlags & MAPTILE_TREES (0x4)`, which exempts the wall from the occlusion fade. */
  readonly noFade?: boolean
  /**
   * DRLG walls only: `dwFlags & MAPTILE_UNK_0x200 (0x200)` (`bRevealHidden`), cutaway interior wall cap that
   * starts hidden (`MAPTILE_HIDDEN`, no collision) and is revealed while an enclosing POPS box is active
   * (`DRLGPRESET_TogglePopsVisibility` `0x6fd5a180`, hidden again 500 ms after exit in `0x6fb4ef9f`).
   */
  readonly revealHidden?: boolean
  /**
   * DRLG walls only: `dwFlags & MAPTILE_FLOOR_LINKER_PATH (0x100)` (`bLinkage`), which exempts the wall/roof
   * from POPS style-matching fade (`DRLGPRESET_TogglePopsVisibility` `0x6fd5a25b: test ah, 1`).
   */
  readonly popLinkage?: boolean
}

/** One floor or shadow cell. */
export interface Ds1Floor {
  /** Palette/tile property byte. */
  readonly prop1: number
  /** Sequence within the style (0..63). */
  readonly sequence: number
  /** Style index within the DT1 library. */
  readonly style: number
  /** Unnamed field, as stored. */
  readonly unknown1: number
  /** Unnamed field, as stored. */
  readonly unknown2: number
  /** The cell is hidden. */
  readonly hidden: boolean
  /** Exact DT1 library index chosen by DRLG (bypasses `pickVariant` when set). */
  readonly dt1Library?: number
  /** Exact DT1 tile index chosen by DRLG (bypasses `pickVariant` when set). */
  readonly dt1Tile?: number
  /** Whether DRLG marked this floor tile MAPTILE_UNWALKABLE. */
  readonly unwalkable?: boolean
}

/** One substitution cell (raw value; its meaning is map-specific). */
export interface Ds1Substitution {
  /** The raw 32-bit layer value. */
  readonly value: number
}

/** Everything one map cell carries. */
export interface Ds1Cell {
  /** Wall layers, outermost first. */
  readonly walls: readonly Ds1Wall[]
  /** Floor layers, one per declared floor layer. */
  readonly floors: readonly Ds1Floor[]
  /** Shadow layers (one in shipped maps). */
  readonly shadows: readonly Ds1Floor[]
  /** Substitution layers. */
  readonly substitutions: readonly Ds1Substitution[]
  /** Optional per-room DT1 library bitmask (`D2DrlgRoomStrc.dwDT1Mask`). */
  readonly dt1Mask?: number
}

/** One placed object (a door, a shrine, a chest, ...). */
export interface Ds1Object {
  /** Object type index into the act's object table. */
  readonly type: number
  /** Object id (the specific variant). */
  readonly id: number
  /** Tile x. */
  readonly x: number
  /** Tile y. */
  readonly y: number
  /** Raw flags word. */
  readonly flags: number
  /** Optional 1-indexed act override for cross-act MonPreset resolution (e.g. Pandemonium L133-136). */
  readonly act?: number
}

/** A decoded DS1 map. */
export interface Ds1 {
  /** File version. */
  readonly version: number
  /** Map width in tiles. */
  readonly width: number
  /** Map height in tiles. */
  readonly height: number
  /** Act (1..5). */
  readonly act: number
  /** Substitution layer type (0, 1 or 2). */
  readonly substitutionType: number
  /** Number of wall layers. */
  readonly wallLayers: number
  /** Number of floor layers. */
  readonly floorLayers: number
  /** Cells, row-major: `cells[y][x]`. */
  readonly cells: readonly (readonly Ds1Cell[])[]
  /** Placed objects. */
  readonly objects: readonly Ds1Object[]
  /** Byte offset where NPC paths begin (not decoded). */
  readonly npcPathOffset: number | null
}

/** A cursor over the file, so the versioned section walk reads linearly. */
class Cursor {
  private at = 0
  private readonly data: Uint8Array

  /**
   * @param data - the buffer to walk.
   */
  constructor(data: Uint8Array) {
    this.data = data
  }

  /** Current byte offset. */
  get offset(): number { return this.at }

  /**
   * Read `count` bytes and advance.
   *
   * @param count - byte count.
   * @returns the bytes.
   */
  take(count: number): Uint8Array {
    if (count < 0 || this.at + count > this.data.byteLength) {
      throw new TruncatedDataError("ds1", "section", this.at, count, this.data.byteLength - this.at, this.data.byteLength)
    }
    const slice = this.data.subarray(this.at, this.at + count)
    this.at += count
    return slice
  }

  /**
   * Read a little-endian int32 and advance.
   *
   * @returns the value.
   */
  int32(): number {
    const bytes = this.take(4)
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(0, true)
  }

  /**
   * Read a little-endian uint32 and advance.
   *
   * @returns the value.
   */
  uint32(): number {
    const bytes = this.take(4)
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true)
  }

  /**
   * Read a NUL-terminated ASCII string and advance.
   *
   * @returns the string.
   */
  cstring(): string {
    let out = ''
    for (;;) {
      const bytes = this.take(1)
      const byte = bytes[0]
      if (byte === undefined || byte === 0) return out
      out += String.fromCharCode(byte)
    }
  }
}

/**
 * Decode a DS1 map.
 *
 * @param data - the complete file.
 * @returns the decoded map.
 */
export function decodeDs1(data: Uint8Array): Ds1 {
  if (data.byteLength < 12) throw new TruncatedDataError("ds1", "header", 0, 12, data.byteLength, data.byteLength)
  const cursor = new Cursor(data)
  const version = cursor.int32()
  // Stored width/height are one less than the tile count.
  const width = cursor.int32() + 1
  const height = cursor.int32() + 1
  if (width <= 0 || height <= 0 || width * height > (1 << 22)) {
    throw new InvalidFieldError("ds1", "geometry", 4, `${String(width)}x${String(height)}`, "positive area <= 2^22")
  }

  let act = 1
  if (version >= V_ACT) act = cursor.int32()

  let substitutionType = 0
  let substitutionLayers = 0
  if (version >= V_SUBSTITUTION_LAYERS) {
    substitutionType = cursor.int32()
    if (substitutionType === 1 || substitutionType === 2) substitutionLayers = 1
  }

  const files: string[] = []
  if (version >= V_FILES) {
    const count = cursor.int32()
    if (count < 0 || count > 1024) throw new InvalidFieldError("ds1", "files", cursor.offset - 4, count, "0..1024")
    for (let index = 0; index < count; index += 1) files.push(cursor.cstring())
  }

  if (version >= V_UNKNOWN_LOW && version <= V_UNKNOWN_HIGH) cursor.take(8)

  let wallLayers = 0
  let floorLayers = 0
  if (version >= V_FLOORS) {
    wallLayers = cursor.int32()
    if (version >= V_WALLS) floorLayers = cursor.int32()
    else floorLayers = 1
  }
  if (wallLayers < 0 || wallLayers > 4 || floorLayers < 0 || floorLayers > 2) {
    throw new InvalidFieldError("ds1", "layers", cursor.offset, `${String(wallLayers)} walls, ${String(floorLayers)} floors`, "walls 0..4, floors 0..2")
  }
  const shadowLayers = 1

  const cells: Ds1Cell[][] = []
  for (let y = 0; y < height; y += 1) {
    const row: Ds1Cell[] = []
    for (let x = 0; x < width; x += 1) {
      row.push({
        walls: Array.from({ length: wallLayers }, () => emptyWall()),
        floors: Array.from({ length: floorLayers }, () => emptyFloor()),
        shadows: Array.from({ length: shadowLayers }, () => emptyFloor()),
        substitutions: Array.from({ length: substitutionLayers }, () => ({ value: 0 })),
      })
    }
    cells.push(row)
  }

  for (const layer of layerOrder(version, wallLayers, floorLayers, shadowLayers, substitutionLayers)) {
    for (let y = 0; y < height; y += 1) {
      const row = cells[y]!
      for (let x = 0; x < width; x += 1) {
        const bits = cursor.uint32()
        applyLayer(row[x]!, layer, bits, version)
      }
    }
  }

  const objects: Ds1Object[] = []
  if (version >= 2) {
    const count = cursor.int32()
    if (count < 0 || count > (1 << 20)) throw new InvalidFieldError("ds1", "objects", cursor.offset - 4, count, "0..2^20")
    for (let index = 0; index < count; index += 1) {
      objects.push({
        type: cursor.int32(),
        id: cursor.int32(),
        x: cursor.int32(),
        y: cursor.int32(),
        flags: cursor.int32(),
      })
    }
  }

  // Substitution groups, NPC paths and NPC extra data follow; they are not
  // needed to draw or walk a map, so their offset is recorded instead of being
  // guessed at.
  const npcPathOffset = version >= V_NPCS ? cursor.offset : null

  return {
    version, width, height, act, substitutionType,
    wallLayers, floorLayers, cells, objects, npcPathOffset,
  }
}

/** A blank wall cell. */
function emptyWall(): Ds1Wall {
  return { prop1: 0, sequence: 0, style: 0, type: 0, unknown1: 0, unknown2: 0, hidden: false }
}

/** A blank floor/shadow cell. */
function emptyFloor(): Ds1Floor {
  return { prop1: 0, sequence: 0, style: 0, unknown1: 0, unknown2: 0, hidden: false }
}

/** Wall layer indices, matching the file's fixed order. */
const WALL_LAYERS = [0, 1, 2, 3] as const
/** Floor layer indices. */
const FLOOR_LAYERS = [0, 1] as const

/**
 * The order the layer streams appear in the file.
 *
 * Below version 4 every type had exactly one layer and the streams follow a
 * legacy order; from 4 on, wall and orientation layers alternate per wall
 * layer, then floors, then shadow, then substitutions.
 *
 * @param version - file version.
 * @param wallLayers - declared wall layers.
 * @param floorLayers - declared floor layers.
 * @param shadowLayers - shadow layers.
 * @param substitutionLayers - substitution layers.
 * @returns the layer stream descriptors in file order.
 */
function layerOrder(
  version: number,
  wallLayers: number,
  floorLayers: number,
  shadowLayers: number,
  substitutionLayers: number,
): { kind: 'wall' | 'orientation' | 'floor' | 'shadow' | 'substitution'; index: number }[] {
  if (version < V_FLOORS) {
    return [
      { kind: 'wall', index: 0 },
      { kind: 'floor', index: 0 },
      { kind: 'orientation', index: 0 },
      { kind: 'substitution', index: 0 },
      { kind: 'shadow', index: 0 },
    ]
  }
  const order: { kind: 'wall' | 'orientation' | 'floor' | 'shadow' | 'substitution'; index: number }[] = []
  for (let index = 0; index < wallLayers; index += 1) {
    order.push({ kind: 'wall', index }, { kind: 'orientation', index })
  }
  for (let index = 0; index < floorLayers; index += 1) order.push({ kind: 'floor', index })
  for (let index = 0; index < shadowLayers; index += 1) order.push({ kind: 'shadow', index })
  for (let index = 0; index < substitutionLayers; index += 1) order.push({ kind: 'substitution', index })
  return order
}

/**
 * Apply one 32-bit layer value to its cell.
 *
 * Cells are small mutable records for exactly this reason: the layer streams
 * arrive interleaved, so a cell is assembled from several passes.
 *
 * @param cell - the cell to update.
 * @param layer - which layer this value belongs to.
 * @param bits - the raw 32-bit value.
 * @param version - file version (older maps fold orientations).
 */
function applyLayer(
  cell: Ds1Cell,
  layer: { kind: 'wall' | 'orientation' | 'floor' | 'shadow' | 'substitution'; index: number },
  bits: number,
  version: number,
): void {
  const prop1 = bits & 0x000000ff
  const sequence = (bits & 0x00003f00) >>> 8
  const unknown1 = (bits & 0x000fc000) >>> 14
  const style = (bits & 0x03f00000) >>> 20
  const unknown2 = (bits & 0x7c000000) >>> 26
  const hidden = ((bits & 0x80000000) >>> 31) > 0
  switch (layer.kind) {
    case 'wall': {
      const wall = cell.walls[layer.index]
      if (wall === undefined) return
      // Walls are mutable during assembly; the exported type is read-only.
      Object.assign(wall, { prop1, sequence, unknown1, style, unknown2, hidden })
      return
    }
    case 'orientation': {
      const wall = cell.walls[layer.index]
      if (wall === undefined) return
      let type = bits & 0x000000ff
      if (version < V_DIRECT_ORIENTATION && type < LEGACY_DIRECTION_LOOKUP.length) {
        type = LEGACY_DIRECTION_LOOKUP[type]!
      }
      Object.assign(wall, { type })
      return
    }
    case 'floor': {
      const floor = cell.floors[layer.index]
      if (floor !== undefined) {
        const isHidden = hidden || (style === 30 && (sequence === 0 || sequence === 1))
        Object.assign(floor, { prop1, sequence, unknown1, style, unknown2, hidden: isHidden })
      }
      return
    }
    case 'shadow': {
      const shadow = cell.shadows[layer.index]
      if (shadow !== undefined) Object.assign(shadow, { prop1, sequence, unknown1, style, unknown2, hidden })
      return
    }
    case 'substitution': {
      const substitution = cell.substitutions[layer.index]
      if (substitution !== undefined) Object.assign(substitution, { value: bits })
      return
    }
    /* v8 ignore next -- the layer union is closed above. */
    default: return
  }
}

/** Reserved for the DT1 pairing helpers that follow in the renderer. */
export { WALL_LAYERS, FLOOR_LAYERS }
