/**
 * DS1 objects: `(type, id)` → the art the engine would draw, and where it lands.
 *
 * This is a port of three things out of ThePhrozenKeep/D2MOO (a C++
 * re-implementation of Diablo II 1.10f), which is the reference this project
 * reads instead of guessing:
 *
 * 1. **`D2Common_10884_COMPOSIT_unk`** — `source/D2Common/src/D2Composit.cpp`,
 *    D2Common ordinal **10884**, address `D2Common.0x6FD466C0`. It is the
 *    function that decides which composition file an object's frame comes from.
 *    For `UNIT_OBJECT` it takes the **class token** from
 *    `DATATBLS_GetObjModeTypeTxtRecord(nClass, 0)->szToken` (the `objtype.txt`
 *    row for the object's `Objects.txt` id), the **mode token** from
 *    `DATATBLS_GetObjModeTypeTxtRecord(nMode, 1)->szToken` (the `objmode.txt` row
 *    for the object's animation mode), the weapon class from
 *    `COMPOSIT_GetWeaponClassCode` (always `' hth'` for objects), sets
 *    `szPathPrefix = "DATA\\GLOBAL\\OBJECTS"`, strips every space byte with the
 *    `c &= ((c == ' ') - 1)` idiom, and finally:
 *
 *        wsprintfA(szPath, "%s\\%s\\COF\\%s%s%s.COF", prefix, class, class, mode, weapon)
 *
 *    i.e. `data\global\objects\<TOKEN>\COF\<TOKEN><MODE>hth.COF`. That is the
 *    whole member-selection rule: **there is no per-object table of art files** —
 *    the object's `Token` column and its *animation mode* are concatenated onto a
 *    fixed path template, and a COF is what gets loaded.
 * 2. **The COF's layers pick the sprite files** — `decodeCof` reads them. A COF
 *    layer record (9 bytes, starting at file offset `28 + 9 * layer`, see
 *    `D2Comp.cpp` `sub_6F8A1250`, which walks `v12 += 9` and reads a 3-byte
 *    weapon token at `+5`) carries a *composite index*, not a file name. The
 *    composite index maps to a component directory through `D2Composit.h`'s
 *    `COMPOSIT_HEAD, COMPOSIT_TORSO, ... COMPOSIT_SPECIAL1, ...` order. The
 *    sprite's own file name is reconstructed from the same tokens as the COF
 *    name, plus the object's fixed armor class `lit`:
 *    `data\global\objects\<TOKEN>\<COMPONENT>\<TOKEN><COMPONENT>lit<MODE>hth.dcc`.
 *    Archive evidence: sweeping all 1461 object COFs in `d2data.mpq` +
 *    `d2exp.mpq` and rebuilding every layer's path this way resolves 1728 layers
 *    to an existing `.dcc` by exact name; the remaining 18 are the same name
 *    with a `.dc6` extension (the `1y`, `4x`, `e1`, `e2`, `tp`, `ho`, `yq`
 *    tokens ship as DC6 in `d2exp.mpq`). Nothing else was tried and nothing else
 *    was needed, so the rule is exact, not approximate.
 * 3. **The draw position** — `DUNGEON_GameToClientTileDrawPositionCoords` and
 *    `DUNGEON_GameToClientSubtileDrawPositionCoords`
 *    (`source/D2Common/src/D2Dungeon.cpp`, ordinals **10115** and **10117**),
 *    documented in `doc/Coordinates.md`. They are ported verbatim under
 *    {@link tileDrawPositionCoords} / {@link subtileDrawPositionCoords}, and
 *    {@link objectDrawAnchor} is the object case of the latter.
 *
 * Two facts about modes that the art rule depends on:
 *
 * - The mode index is D2's object animation mode, `D2Common/include/DataTbls/ObjectsIds.h`
 *   `enum D2C_ObjModes`: `OBJMODE_NEUTRAL=0` (`NU`), `OBJMODE_OPERATING=1` (`OP`),
 *   `OBJMODE_OPENED=2` (`ON`), `OBJMODE_SPECIAL1..5=3..7` (`S1`..`S5`).
 * - A freshly placed map object is in `OBJMODE_NEUTRAL`:
 *   `source/D2Game/src/OBJECTS/Objects.cpp` calls
 *   `UNITS_ChangeAnimMode(pObject, OBJMODE_NEUTRAL)`. `Objects.txt`'s per-mode
 *   `Mode0..Mode7` columns (a 0/1 flag array, `D2ObjectsTxt::nMode[8]` at
 *   `0x13F`, mapped in `source/D2Common/src/DataTbls/ObjectsTbls.cpp`) say which
 *   modes an object actually has art for: casket `C5` has modes `NU`/`OP`/`ON`
 *   set and ships exactly `C5NUHTH.COF`, `c5ophth.cof`, `c5onhth.cof`; the door
 *   `D1` has all seven set and ships all seven COFs.
 */
import type { D2Table } from '../world/acts.ts'
import { cell, parseTable } from '../world/acts.ts'
import { cofLayerOrder, decodeCof } from '../formats/cof.ts'
import type { CofFile } from '../formats/cof.ts'
import { decodeDc6 } from '../formats/dc6.ts'
import { decodeDcc } from '../formats/dcc.ts'
import type { DccFile } from '../formats/dcc.ts'
import type { SpriteFrame, SpriteSheet } from '../formats/sprite.ts'
import type { MountedArchives } from '../mpq/mount.ts'
import { OBJECT_TYPE_OBJECT, OBJECT_TYPE_MONSTER, lookupObject } from './object-lookup.ts'
import type { ObjectLookupEntry } from './object-lookup.ts'
import { compositeObjectAnimation, dc6ToDccFile } from './monster-art.ts'

export { compositeObjectAnimation }

/** `Objects.txt` inside the archives. */
const OBJECTS_TABLE = 'data\\global\\excel\\objects.txt'
/** Prefix every object composition and sprite lives under (`szPathPrefix`). */
export const OBJECT_ROOT = 'data\\global\\objects\\'
/** Prefix every monster composition and sprite lives under. */
export const MONSTER_ROOT = 'data\\global\\monsters\\'
/** Weapon-class token the engine hard-codes for objects (`COMPOSIT_GetWeaponClassCode`). */
const OBJECT_WEAPON = 'hth'
/** Armor-class token objects always use; characters vary it (`lit`/`med`/`hvy`). */
const OBJECT_ARMOR_CLASS = 'lit'
/** How many animation modes `D2ObjectsTxt::nMode[8]` and `D2C_ObjModes` define. */
export const OBJECT_MODE_COUNT = 8

/**
 * Animation-mode index → the token `objmode.txt` gives that row.
 *
 * `D2C_ObjModes` in `DataTbls/ObjectsIds.h` names them in the comments; the
 * tokens are what the archive actually uses (`C5NUHTH.COF`, `c5ophth.cof`,
 * `d1s2hth.cof`). The order is load-bearing: it is the index the engine passes
 * to `DATATBLS_GetObjModeTypeTxtRecord(nMode, 1)`.
 */
export const OBJECT_MODE_TOKENS = ['NU', 'OP', 'ON', 'S1', 'S2', 'S3', 'S4', 'S5'] as const

/**
 * Composite index → the archive's directory for that component.
 *
 * The same 16-entry order as `D2Composit.h` and as `Objects.txt`'s
 * `HD,TR,LG,RA,LA,RH,LH,SH,S1..S8` columns, which are the per-object flags
 * saying which of these the object's composition uses. Only `HD`, `TR` and
 * `S1..S6` appear under `data\global\objects\`, which matches those columns
 * being zero for every other entry across the whole table.
 */
export const OBJECT_COMPONENTS = [
  'hd', 'tr', 'lg', 'ra', 'la', 'rh', 'lh', 'sh', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8',
] as const

/**
 * Tokens that represent environmental additive-blend illumination and magic objects.
 * Ground truth parity (1.13c): Window light rays (11, 12 in Act 4), light beams
 * (R1..R5, 1R..4R with Trans=7), arcane orifice (HA with Trans=1), and fire jets.
 */
export const ADDITIVE_OBJECT_TOKENS: ReadonlySet<string> = new Set([
  '11', '12', 'R1', 'R2', 'R3', 'R4', 'R5', '1R', '2R', '3R', '4R', 'HA',
])

/**
 * Component preference when only a member-name list is available.
 *
 * `tr` is the object's body layer: of the 1461 shipped object COFs, 1453 declare
 * component 1 (`tr`) as their first layer, 5 declare component 0 (`hd`) and 3
 * declare component 8 (`s1`). The rest of the order is the composite order, so a
 * token that only ships `hd` art still resolves. When the COF itself is readable
 * use {@link loadObjectSheet}, which follows the COF's own declared layers and
 * draw order instead of this preference.
 */
const COMPONENT_PREFERENCE = ['tr', 'hd', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 'lg', 'ra', 'la', 'rh', 'lh', 'sh'] as const

/** Sub-tile width in client pixels: `DUNGEON_GameSubtileToClientCoords` step on x (16). */
export const SUBTILE_WIDTH = 16
/** Sub-tile height in client pixels: the same function's step on y (8). */
export const SUBTILE_HEIGHT = 8
/** Floor-tile width in client pixels: `DUNGEON_GameTileToClientCoords` step on x (80). */
export const TILE_WIDTH = 80
/** Floor-tile height in client pixels: the same function's step on y (40). */
export const TILE_HEIGHT = 40

/**
 * `DUNGEON_GameTileToClientCoords` — D2Common ordinal 10110 (`0x6FD8D6E0`).
 *
 * Tile precision → client pixels, the *centre-line* conversion: a tile's client
 * centre. `doc/Coordinates.md` records it as `clientX = (gameX - gameY) / 2`,
 * `clientY = (gameX + gameY) / 4` for unit precision; at tile precision D2MOO
 * multiplies by the 160×80 pixel tile size and halves the y term.
 *
 * @param tileX - tile x.
 * @param tileY - tile y.
 * @returns client pixel x/y of the tile's centre.
 */
export function gameTileToClientCoords(tileX: number, tileY: number): { x: number; y: number } {
  return { x: TILE_WIDTH * (tileX - tileY), y: (TILE_WIDTH * (tileX + tileY)) / 2 }
}

/**
 * `DUNGEON_GameSubTileToClientCoords` — D2Common ordinal 10111 (`0x6FD8D630`).
 *
 * Sub-tile precision → client pixels, again the centre-line conversion: one
 * sub-tile is 32×16 px, so its centre steps by (±16, ±8).
 *
 * @param subX - sub-tile x (a DS1 cell is 5 sub-tiles).
 * @param subY - sub-tile y.
 * @returns client pixel x/y of the sub-tile's centre.
 */
export function gameSubtileToClientCoords(subX: number, subY: number): { x: number; y: number } {
  return { x: SUBTILE_WIDTH * (subX - subY), y: SUBTILE_HEIGHT * (subX + subY) }
}

/**
 * `DUNGEON_GameToClientCoords` — D2Common ordinal 10112 (`0x6FD8D660`).
 *
 * Unit precision, game → client, with no pixel scale at all: `(x - y) / 2`,
 * `(x + y) / 4`. Kept for completeness (it is what `doc/Coordinates.md`'s
 * headline formula describes) and to show why the draw-position functions are
 * the ones to use for pixels — this one is not in pixels.
 *
 * @param gameX - game-unit x.
 * @param gameY - game-unit y.
 * @returns client-unit x/y.
 */
export function gameToClientCoords(gameX: number, gameY: number): { x: number; y: number } {
  return { x: (gameX - gameY) / 2, y: (gameX + gameY) / 4 }
}

/**
 * `DUNGEON_GameToClientTileDrawPositionCoords` — D2Common ordinal 10115 (`0x6FD8D790`).
 *
 * The engine's tile draw position: where a floor *or* wall tile's art is placed.
 * `source/D2Common/src/D2Dungeon.cpp` `D2Common_10052` (ordinal 10052) feeds the
 * corners of a room into this same function to build the room's client rect, and
 * `doc/Coordinates.md` calls the result the render position of the source unit.
 *
 * Note the asymmetry against {@link gameTileToClientCoords}: x loses half a tile
 * width and y gains **a whole tile height**. The y term is not decoration — wall
 * bitmaps carry negative block offsets, and this `+80` is what puts their art
 * back over the cell. The project's `src/game/d2map.ts` reproduces the x term
 * exactly (`(cx - cy) * 80 - 80`) but not the y term; see
 * {@link objectDrawAnchor}'s module notes and `scripts/verify-objects.ts`, which
 * prints both side by side.
 *
 * @param tileX - tile x.
 * @param tileY - tile y.
 * @returns client pixel x/y the tile's bitmap is drawn at.
 */
export function tileDrawPositionCoords(tileX: number, tileY: number): { x: number; y: number } {
  return { x: TILE_WIDTH * (tileX - tileY) - TILE_WIDTH, y: TILE_HEIGHT * (tileX + tileY) + TILE_HEIGHT * 2 }
}

/**
 * `DUNGEON_GameToClientSubtileDrawPositionCoords` — D2Common ordinal 10117 (`0x6FD8D830`).
 *
 * The sub-tile draw position: half a sub-tile width to the left of the sub-tile
 * centre and one full sub-tile height below it. This is the function that places
 * an object, because a DS1 object is stored at sub-tile precision.
 *
 * The `-16`/`+16` constants are the *source square's* half-width and height, not
 * the sprite's: the engine has no frame-size term here at all. A caller that
 * centres by the frame's own width (as `src/game/d2map.ts` does for objects) is
 * therefore applying a rule the engine does not have.
 *
 * @param subX - sub-tile x.
 * @param subY - sub-tile y.
 * @returns client pixel x/y the sub-tile's art is drawn at.
 */
export function subtileDrawPositionCoords(subX: number, subY: number): { x: number; y: number } {
  return { x: SUBTILE_WIDTH * (subX - subY) - SUBTILE_WIDTH, y: SUBTILE_HEIGHT * (subX + subY) + SUBTILE_HEIGHT * 2 }
}

/**
 * `DUNGEON_ClientTileDrawPositionToGameCoords` — D2Common ordinal 10114 (`0x6FD8D710`).
 *
 * The inverse of {@link tileDrawPositionCoords}, including D2MOO's C-style
 * division: negative coordinates round towards **negative infinity** (`v / 160 - 1`
 * on the negative branch), not towards zero. A port that used `Math.trunc` would
 * be off by one tile on half the map.
 *
 * @param clientX - client pixel x from {@link tileDrawPositionCoords}.
 * @param clientY - client pixel y from the same.
 * @returns the tile coordinates.
 */
export function clientTileDrawPositionToGameCoords(clientX: number, clientY: number): { x: number; y: number } {
  return { x: floorDiv(2 * clientY + clientX, 160), y: floorDiv(2 * clientY - clientX, 160) }
}

/**
 * `DUNGEON_ClientSubileDrawPositionToGameCoords` — D2Common ordinal 10116 (`0x6FD8D7D0`).
 *
 * The sub-tile inverse of {@link subtileDrawPositionCoords}, with the same
 * floor-towards-negative-infinity division (divisor 32).
 *
 * @param clientX - client pixel x from {@link subtileDrawPositionCoords}.
 * @param clientY - client pixel y from the same.
 * @returns the sub-tile coordinates.
 */
export function clientSubtileDrawPositionToGameCoords(clientX: number, clientY: number): { x: number; y: number } {
  return { x: floorDiv(2 * clientY + clientX, 32), y: floorDiv(2 * clientY - clientX, 32) }
}

/**
 * Divide rounding towards negative infinity, as the C++ `p / n - 1` idiom does.
 *
 * @param value - numerator.
 * @param divisor - positive divisor.
 * @returns the floored quotient.
 */
function floorDiv(value: number, divisor: number): number {
  return value >= 0 ? Math.floor(value / divisor) : Math.floor(value / divisor) - 1
}

/**
 * The anchor an object's frame is drawn at, relative to its sub-tile centre.
 *
 * The engine's answer is {@link subtileDrawPositionCoords}: a constant
 * `(-16, +16)` — half a sub-tile width left, one sub-tile height down — plus the
 * COF/DCC frame's own `xOffset`/`yOffset`. `tileWidth` and `tileHeight` are part
 * of the signature because every caller has them and because they are exactly
 * what the engine does *not* use: if a frame were positioned as
 * `(-width / 2, -height)`, a 32×32 barrel frame would land 32 px higher than the
 * engine puts it, and a 160-px-wide frame would be off by 64. They are validated
 * rather than read, so a caller that decoded nothing fails here instead of
 * silently emitting an anchor.
 *
 * @param tileWidth - the frame's width in pixels; must be finite and non-negative.
 * @param tileHeight - the frame's height in pixels; must be finite and non-negative.
 * @param frameOffsetX - the frame's own x offset (COF/DCC frame offset).
 * @param frameOffsetY - the frame's own y offset.
 * @returns the offset to add to `gameSubtileToClientCoords(object.x, object.y)`.
 */
export function objectDrawAnchor(
  tileWidth: number,
  tileHeight: number,
  frameOffsetX: number,
  frameOffsetY: number,
): { x: number; y: number } {
  if (!Number.isFinite(tileWidth) || tileWidth < 0) {
    throw new Error(`objectDrawAnchor: frame width ${String(tileWidth)} is not a finite non-negative size`)
  }
  if (!Number.isFinite(tileHeight) || tileHeight < 0) {
    throw new Error(`objectDrawAnchor: frame height ${String(tileHeight)} is not a finite non-negative size`)
  }
  if (!Number.isFinite(frameOffsetX) || !Number.isFinite(frameOffsetY)) {
    throw new Error(`objectDrawAnchor: frame offset (${String(frameOffsetX)}, ${String(frameOffsetY)}) is not finite`)
  }
  return { x: -SUBTILE_WIDTH + frameOffsetX, y: SUBTILE_HEIGHT * 2 + frameOffsetY }
}

/**
 * The anchor a DS1 object's art is drawn at, in absolute client pixels.
 *
 * `(DUNGEON_GameToClientSubtileDrawPositionCoords)` applied to the object's own
 * sub-tile position, with the frame offsets left at zero because the frame is not
 * known until the COF has been read.
 *
 * @param object - the DS1 object; `x`/`y` are sub-tiles.
 * @returns client pixel x/y of the object's draw position.
 */
export function objectAnchor(object: { readonly x: number; readonly y: number }): { x: number; y: number } {
  if (!Number.isFinite(object.x) || !Number.isFinite(object.y)) {
    throw new Error(`objectAnchor: object at (${String(object.x)}, ${String(object.y)}) is not finite`)
  }
  return subtileDrawPositionCoords(object.x, object.y)
}

/** One `Objects.txt` row, as the object-art rule needs it. */
export interface ObjectsRow {
  /** `Id` — the DS1 object entry's `id`, and the index `DATATBLS_GetObjectsTxtRecord` takes. */
  readonly id: number
  /** `Name`, e.g. `Barrel`. */
  readonly name: string
  /** `Description - not loaded`, e.g. ` barrel` or `Cain's Cage`. */
  readonly description?: string | undefined
  /** `Token`, upper-cased: the `<TOKEN>` in every path the engine builds. */
  readonly token: string
  /** `SubClass` — the object class (`OBJSUBCLASS_DOOR` = 0x80, `CHEST` = 0x08, ...). */
  readonly subClass: number
  /** `Act` the object belongs to (0 = any). */
  readonly act: number
  /** `SizeX` / `SizeY` in sub-tiles, used for placement collision. */
  readonly sizeX: number
  readonly sizeY: number
  /** `Xoffset` / `Yoffset`: the row's own art nudge, added to the frame anchor. */
  readonly xOffset: number
  readonly yOffset: number
  /** `IsDoor` — doors take the operate path rather than the casket path. */
  readonly isDoor: boolean
  /** `OperateRange` — interaction range in sub-tiles. */
  readonly operateRange?: number | undefined
  /** `Trans` — transparency mode. */
  readonly trans: number
  /** `BlendMode` — additive or normal blending mode. */
  readonly blendMode?: 'normal' | 'additive'
  /** `Draw` — draw priority flag. */
  readonly draw: number
  /** `TotalPieces` — how many components the object's composition has. */
  readonly totalPieces: number
  /** `AutoMap` — automap cell/colour. */
  readonly autoMap: number
  /**
   * `Mode0..Mode7`: 1 when the object has a composition for that animation mode.
   *
   * This is `D2ObjectsTxt::nMode[8]`, and it is the array D2MOO consults
   * (`pObjectsTxtRecord->nMode[1]`, `[2]`) to decide whether an operate action has
   * art to play. It also matches the shipped COF set exactly.
   */
  readonly mode: readonly number[]
  /** `Selectable0..7`: whether the object is targetable while in that mode. */
  readonly selectable: readonly number[]
  /** `FrameCnt0..7`: frames in that mode. */
  readonly frameCnt: readonly number[]
  /** `FrameDelta0..7`: per-frame delay, 1/256 units (the engine shifts these left by 8). */
  readonly frameDelta: readonly number[]
  /** `Start0..7`: the mode's first frame **within the COF**. */
  readonly start: readonly number[]
  /** `CycleAnim0..7`: whether that mode loops. */
  readonly cycleAnim: readonly number[]
  /** `Lit0..7`: whether the mode is drawn lit. */
  readonly lit: readonly number[]
  /** `Sync`: whether all instances of this object are animation-synchronized. */
  readonly sync: number
  /** `HD`, `TR`, `LG`, `RA`, `LA`, `RH`, `LH`, `SH`, `S1..S8`: composition components present. */
  readonly components: readonly string[]
}

/** `Objects.txt` parsed once, plus the id lookup the DS1 decoder needs. */
export interface ObjectsTable {
  /** The raw parsed table, for callers that need a column not modelled here. */
  readonly table: D2Table
  /** Every row, in file order (`Id` order). */
  readonly rows: readonly ObjectsRow[]
  /** `Id` → row. */
  readonly byId: ReadonlyMap<number, ObjectsRow>
}

/** Columns of the 16 composition flags, in `D2ObjectsTxt` order. */
const COMPONENT_COLUMNS = ['HD', 'TR', 'LG', 'RA', 'LA', 'RH', 'LH', 'SH', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'] as const

/**
 * Read one `Objects.txt` row.
 *
 * @param table - the parsed table.
 * @param row - the raw cells.
 * @returns the typed row.
 */
function toObjectsRow(table: D2Table, row: readonly string[], sequentialId: number): ObjectsRow {
  const numbers = (prefix: string, count: number): number[] =>
    Array.from({ length: count }, (_, index) => Number(cell(table, row, `${prefix}${String(index)}`) || '0'))
  const components = COMPONENT_COLUMNS.filter(column => cell(table, row, column) !== '0' && cell(table, row, column) !== '')
    .map(column => column.toLowerCase())
  const trans = Number(cell(table, row, 'Trans') || '0')
  const token = cell(table, row, 'Token').trim().toUpperCase()
  const blendMode: 'normal' | 'additive' =
    trans === 7 || trans === 1 || ADDITIVE_OBJECT_TOKENS.has(token)
      ? 'additive'
      : 'normal'
  return {
    id: sequentialId,
    name: cell(table, row, 'Name'),
    description: cell(table, row, 'Description - not loaded') || cell(table, row, 'Name'),
    token,
    subClass: Number(cell(table, row, 'SubClass') || '0'),
    act: Number(cell(table, row, 'Act') || '0'),
    sizeX: Number(cell(table, row, 'SizeX') || '0'),
    sizeY: Number(cell(table, row, 'SizeY') || '0'),
    xOffset: Number(cell(table, row, 'Xoffset') || '0'),
    yOffset: Number(cell(table, row, 'Yoffset') || '0'),
    isDoor: cell(table, row, 'IsDoor') !== '0' && cell(table, row, 'IsDoor') !== '',
    operateRange: Number(cell(table, row, 'OperateRange') || '0'),
    trans,
    blendMode,
    draw: Number(cell(table, row, 'Draw') || '0'),
    totalPieces: Number(cell(table, row, 'TotalPieces') || '0'),
    autoMap: Number(cell(table, row, 'AutoMap') || '0'),
    mode: numbers('Mode', OBJECT_MODE_COUNT),
    selectable: numbers('Selectable', OBJECT_MODE_COUNT),
    frameCnt: numbers('FrameCnt', OBJECT_MODE_COUNT),
    frameDelta: numbers('FrameDelta', OBJECT_MODE_COUNT),
    start: numbers('Start', OBJECT_MODE_COUNT),
    cycleAnim: numbers('CycleAnim', OBJECT_MODE_COUNT),
    lit: numbers('Lit', OBJECT_MODE_COUNT),
    sync: Number(cell(table, row, 'Sync') || '0'),
    components,
  }
}

/**
 * Load and parse `data\global\excel\objects.txt` from a mounted archive stack.
 *
 * Uses `parseTable`/`cell` from `src/game/acts.ts` rather than a second
 * tab-separated reader, so the two cannot disagree about CRLF, a trailing newline
 * or a missing column.
 *
 * @param archives - the mounted archives (the file lives in `d2data.mpq`).
 * @returns the parsed table and its id lookup.
 */
export async function loadObjectsTable(archives: MountedArchives): Promise<ObjectsTable> {
  const table = parseTable(await archives.read(OBJECTS_TABLE))
  const rows: ObjectsRow[] = []
  for (const raw of table.rows) {
    const idStr = cell(table, raw, 'Id').trim()
    const nameStr = cell(table, raw, 'Name').trim()
    if (idStr === '' || nameStr.toLowerCase() === 'expansion') continue
    const row = toObjectsRow(table, raw, rows.length)
    rows.push(row)
  }
  const byId = new Map<number, ObjectsRow>()
  for (const row of rows) byId.set(row.id, row)
  return { table, rows, byId }
}

export interface MonstersTable {
  /** Parsed monstats.txt. */
  readonly stats: D2Table
  /** Parsed MonPreset.txt. */
  readonly preset: D2Table
  /** Pre-filtered MonPreset Place column values, grouped by String(act). */
  readonly presetPlaceByAct: ReadonlyMap<string, readonly string[]>
  /** Pre-indexed monstats.txt rows by Id (column 0). */
  readonly statsById: ReadonlyMap<string, readonly string[]>
}

const statsByHcIdxCache = new WeakMap<D2Table, Map<number, readonly string[]>>()

export function getMonsterRowByHcIdx(stats: D2Table, hcIdx: number): readonly string[] | undefined {
  let byHcIdx = statsByHcIdxCache.get(stats)
  if (byHcIdx === undefined) {
    byHcIdx = new Map<number, readonly string[]>()
    for (const row of stats.rows) {
      const raw = cell(stats, row, 'hcIdx').trim()
      if (raw === '') continue
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isNaN(parsed) && String(parsed) === raw && !byHcIdx.has(parsed)) {
        byHcIdx.set(parsed, row)
      }
    }
    statsByHcIdxCache.set(stats, byHcIdx)
  }
  return byHcIdx.get(hcIdx)
}

/**
 * Resolve a DS1 object entry to the art the engine would use for it.
 *
 * Two lookups happen here, in this order:
 *
 * 1. `(act, type, id)` goes through the hardcoded per-act object table
 *    ({@link lookupObject}). The DS1 `id` is **not** an `Objects.txt` row number —
 *    it indexes that table, which is why identity mapping produced nonsense
 *    (an act 1 fountain, id 0, became `Objects.txt` row 0, "Expansion", token `''`).
 *    The table's `token` is authoritative: in 26 places `Objects.txt` carries a
 *    placeholder (`SS`/`XX`/`SL`) where the table has the real token.
 * 2. The table's `objectsTxtId`, or failing that the table's token, is used to find
 *    the `Objects.txt` row, which supplies the metadata (name, size, modes, flags).
 *
 * @param tables - the parsed `Objects.txt`.
 * @param act - the level's act, 1..5.
 * @param objectType - the DS1 object's `type` (2 = object, 1 = monster spawn).
 * @param objectId - the DS1 object's `id`.
 * @param monsters - precomputed monster lookup tables. Omitting this parameter intentionally restores the legacy behavior of dropping all non-object (type !== 2) DS1 entries.
 * @returns the entry, the optional metadata row, and the token/mode to draw with.
 * @throws when the object type is an object but the table has no such id, because a
 *   silent fallback would bake the wrong token into the pack under the right id.
 */
export function resolveDs1Object(
  tables: ObjectsTable,
  act: number,
  objectType: number,
  objectId: number,
  monsters?: MonstersTable,
): ResolvedDs1Object {
  if (!Number.isFinite(objectId)) {
    throw new Error(`resolveDs1Object: object id ${String(objectId)} is not a number`)
  }
  if (objectType !== OBJECT_TYPE_OBJECT) {
    if (objectType === OBJECT_TYPE_MONSTER && monsters !== undefined) {
      const presets = monsters.presetPlaceByAct.get(String(act))
      let place = presets !== undefined && objectId >= 0 && objectId < presets.length ? presets[objectId] : undefined
      let statRow = place !== undefined ? monsters.statsById.get(place) : undefined
      if (statRow === undefined && objectId >= 1000) {
        statRow = getMonsterRowByHcIdx(monsters.stats, objectId - 1000)
        if (statRow !== undefined && place === undefined) {
          place = cell(monsters.stats, statRow, 'Id').trim()
        }
      }
      if (place !== undefined) {
        // `Code` is spelled inconsistently in the shipped table — `K9` on one row,
        // `k9` on another, `ja` lower-cased — while the art directories are indexed
        // upper-cased. Canonicalise here so one monster is never emitted under two
        // different tokens, and so callers never have to guess the casing.
        const token = statRow === undefined ? '' : cell(monsters.stats, statRow, 'Code').trim().toUpperCase()
        const nameStr = statRow === undefined ? '' : cell(monsters.stats, statRow, 'NameStr')

        return {
          entry: null,
          row: null,
          token,
          mode: 'NU',
          artless: token === '',
          kind: 'npc',
          name: nameStr || place,
          trans: 0,
          blendMode: 'normal',
        }
      }
    }
    return { entry: null, row: null, token: '', mode: '', artless: true, kind: 'monster', trans: 0, blendMode: 'normal' }
  }
  const entry = lookupObject(act, objectType, objectId)
  if (entry === null) {
    throw new Error(`resolveDs1Object: act ${String(act)} object id ${String(objectId)} is not in the object lookup table`)
  }
  const byId = entry.objectsTxtId >= 0 ? tables.byId.get(entry.objectsTxtId) : undefined
  const row = byId ?? (entry.token === '' ? undefined : findByToken(tables, entry.token)) ?? null
  const token = entry.token !== '' ? entry.token : (row?.token ?? '')
  const trans = row?.trans ?? 0
  const isAdditive = trans === 7 || trans === 1 || ADDITIVE_OBJECT_TOKENS.has(token.trim().toUpperCase())
  const blendMode: 'normal' | 'additive' = isAdditive ? 'additive' : 'normal'
  return {
    entry,
    row,
    token,
    mode: entry.mode,
    artless: token.trim() === '',
    kind: entry.baseIsMonsters ? 'npc' : 'object',
    trans,
    blendMode,
  }
}

/**
 * Find an `Objects.txt` row by token (case-insensitive), for records whose lookup
 * entry has no row number.
 *
 * @param tables - the parsed table.
 * @param token - the token to look for.
 * @returns the first matching row, or undefined.
 */
function findByToken(tables: ObjectsTable, token: string): ObjectsRow | undefined {
  return tables.rows.find(row => row.token.trim().toLowerCase() === token.trim().toLowerCase())
}

/** What {@link resolveDs1Object} found for one DS1 object entry. */
export interface ResolvedDs1Object {
  /** The hardcoded lookup table record, or null for a monster spawn. */
  readonly entry: ObjectLookupEntry | null
  /** The `Objects.txt` row, when one could be found (by id, else by token). */
  readonly row: ObjectsRow | null
  /** The token to draw with; empty when the object has no art. */
  readonly token: string
  /** The animation mode token the engine places it in (`NU`/`OP`/…); empty when unknown. */
  readonly mode: string
  /** True when no token could be found: drawing nothing is then correct. */
  readonly artless: boolean
  /** `object` for a real object, `monster` for a DS1 monster spawn point, `npc` for named NPC. */
  readonly kind: 'object' | 'monster' | 'npc'
  /** The name resolved for this object (like the name of the NPC), if any. */
  readonly name?: string
  /** Transparency mode from Objects.txt (`Trans` column). */
  readonly trans?: number
  /** Blend mode for rendering this object (`additive` for light rays, orifices, beams). */
  readonly blendMode?: 'normal' | 'additive'
}

/** What {@link resolveObjectArt} is asked to resolve. */
export interface ObjectArtRequest {
  /** The DS1 object, exactly as decoded; `x`/`y` are sub-tiles. */
  readonly object: { type: number; id: number; x: number; y: number; flags: number }
  /**
   * The token to draw with, taken from the hardcoded object lookup table (it wins
   * over `Objects.txt`'s `Token` column, which carries placeholders in 26 places).
   */
  readonly token: string
  /**
   * The animation mode token the engine places the object in, from the same table
   * (`NU`/`OP`/`ON`/`S1`…); empty string when the table did not say.
   */
  readonly mode: string
  /**
   * The `Objects.txt` row, or `null` when the table gave no row and the token did
   * not match one. Only metadata (name, sub-class) is read from it.
   */
  readonly row: { name: string; token: string; subClass: number; mode: number; hp: number } | null
  /** Every member name in the mounted archives, for name-only resolution. */
  readonly members: readonly string[]
  /** True when the object is effectively an NPC (`baseIsMonsters`), resolving in `monsters/` not `objects/`. */
  readonly baseIsMonsters?: boolean
}

/** The art the engine would use for one DS1 object. */
export interface ObjectArt {
  /** The archive member, or `null` when the token ships no art at all. */
  readonly member: string | null
  /** The animation-mode token actually used, e.g. `NU`. */
  readonly mode: string
  /** Frame index within the resolved member; 0 is the mode's first frame here. */
  readonly frameIndex: number
  /** Client pixel draw position of the object, frame offsets excluded. */
  readonly anchor: { readonly x: number; readonly y: number }
  /** Everything the resolution could not decide, or decided by fallback. */
  readonly notes: readonly string[]
}

/**
 * The COF member name the engine builds for an object token and mode.
 *
 * The literal template from `D2Common_10884_COMPOSIT_unk`:
 * `DATA\GLOBAL\OBJECTS\<TOKEN>\COF\<TOKEN><MODE>hth.COF`, with the space-stripping
 * already applied (the tokens are trimmed, so there is nothing left to strip).
 *
 * @param token - `Objects.txt` `Token`, any case.
 * @param modeIndex - animation mode index, 0..7.
 * @returns the lower-cased member name.
 */
export function objectCofMember(token: string, modeIndex: number, baseIsMonsters = false): string {
  const name = token.trim().toLowerCase()
  const mode = modeToken(modeIndex).toLowerCase()
  const root = baseIsMonsters ? MONSTER_ROOT : OBJECT_ROOT
  return `${root}${name}\\cof\\${name}${mode}${OBJECT_WEAPON}.cof`
}

/**
 * The sprite member name for one component of an object's composition.
 *
 * Reconstructed the way `verify-dcc.ts` and `src/game/character.ts` reconstruct a
 * character's: the COF stores no file name, only the component index and the
 * weapon class, so the name is `<TOKEN><COMPONENT>lit<MODE>hth.dcc` in the
 * component's directory. Objects keep the armor class fixed at `lit`.
 *
 * @param token - `Objects.txt` `Token`, any case.
 * @param component - component directory, e.g. `tr`.
 * @param modeIndex - animation mode index, 0..7.
 * @param baseIsMonsters - true when the base directory is `monsters/` not `objects/`.
 * @returns the lower-cased `.dcc` member name.
 */
export function objectSpriteMember(token: string, component: string, modeIndex: number, baseIsMonsters = false): string {
  const name = token.trim().toLowerCase()
  const part = component.toLowerCase()
  const mode = modeToken(modeIndex).toLowerCase()
  const root = baseIsMonsters ? MONSTER_ROOT : OBJECT_ROOT
  return `${root}${name}\\${part}\\${name}${part}${OBJECT_ARMOR_CLASS}${mode}${OBJECT_WEAPON}.dcc`
}

/**
 * The mode token for an index, clamped into range.
 *
 * @param modeIndex - animation mode index.
 * @returns the token, e.g. `NU`.
 */
function modeToken(modeIndex: number): string {
  const index = Number.isFinite(modeIndex) ? Math.trunc(modeIndex) : 0
  return OBJECT_MODE_TOKENS[Math.min(Math.max(index, 0), OBJECT_MODE_TOKENS.length - 1)] ?? 'NU'
}

/**
 * The engine's member order, with the requested mode first.
 *
 * A placed object is in `NU`, so `NU` is first for every object the packer sees;
 * the requested mode comes first only so a caller that knows better (an opened
 * door, an operating chest) is not overridden.
 *
 * @param requested - the requested animation mode index.
 * @returns mode indices, most preferred first.
 */
function modeOrder(requested: number): number[] {
  const start = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 0), OBJECT_MODE_COUNT - 1) : 0
  const order = [start]
  for (let index = 0; index < OBJECT_MODE_COUNT; index += 1) if (index !== start) order.push(index)
  return order
}

/**
 * Find a member case-insensitively, preferring the archive's own spelling.
 *
 * The engine's lookups go through Storm's case-insensitive hash, and the archives
 * really do mix case (`Data\Global\Objects\1Y\S1\1ys1litnuhth.DC6`,
 * `data\global\objects\C5\COF\C5NUHTH.COF`), so a byte-exact compare would fail.
 *
 * @param members - every member name.
 * @param wanted - the lower-cased name to find.
 * @returns the member as the archive spells it, or undefined.
 */
function findMember(members: readonly string[], wanted: string): string | undefined {
  const exact = members.find(name => name.toLowerCase() === wanted)
  return exact
}

/**
 * Resolve the art member an object is drawn from, from a member-name list.
 *
 * The engine's rule, in order: the **mode token** comes from the object's
 * animation mode through `objmode.txt`
 * (`DATATBLS_GetObjModeTypeTxtRecord(nMode, 1)`), the **class token** from
 * `Objects.txt`/`objtype.txt`, and the path is the fixed template in
 * `D2Common_10884_COMPOSIT_unk`. What this function adds over that is only the
 * fallback for a mode the object has no art for, and the choice of *component*
 * when the COF cannot be read: the COF is the engine's real entry point, and it
 * declares which components exist. With names alone, `tr` (the body layer, first
 * layer of 1453 of 1461 shipped object COFs) is preferred, then the composite
 * order.
 *
 * Two things this cannot decide, reported in `notes` rather than guessed:
 * a mode the object has no art for, and the frame index inside that mode
 * (`Objects.txt` `Start{mode}` gives the mode's first frame within the COF, and
 * `FrameCnt{mode}` its length, so frame 0 here is the COF's first frame — the
 * mode's own first frame only when `Start{mode}` is 0).
 *
 * @param request - the object, its row (or null) and the archive's member list.
 * @returns the member, the mode token, the frame index, the anchor and notes.
 * @throws when the request is malformed — a missing token or a non-finite object
 *   position means the caller lost data, and a wrong member is worse than a stop.
 *   A token that genuinely ships no art returns `member: null` instead, because
 *   that is what the engine draws: nothing.
 */
export function resolveObjectArt(request: ObjectArtRequest): ObjectArt {
  const { object, members } = request
  if (!Number.isFinite(object.type) || !Number.isFinite(object.id) || !Number.isFinite(object.x) || !Number.isFinite(object.y) || !Number.isFinite(object.flags)) {
    throw new Error(`resolveObjectArt: object ${String(object.type)}/${String(object.id)} at (${String(object.x)}, ${String(object.y)}) is not finite`)
  }
  const notes: string[] = []
  const anchor = objectAnchor(object)
  const token = request.token.trim().toUpperCase()
  if (token === '') {
    notes.push(`act object id ${String(object.id)} has no token in the lookup table, so it has no art`)
    return { member: null, mode: 'NU', frameIndex: 0, anchor, notes }
  }
  // The mode comes from the lookup table (`OP` for a casket, `ON` for a campfire);
  // when it does not say, the engine's placement default is `NU`.
  const requestedToken = request.mode.trim().toUpperCase()
  const requestedIndex = (OBJECT_MODE_TOKENS as readonly string[]).indexOf(requestedToken)
  const requested = requestedIndex >= 0 ? requestedIndex : 0
  if (requestedToken !== '' && requestedIndex < 0) {
    notes.push(`lookup table mode "${requestedToken}" is not one of ${OBJECT_MODE_TOKENS.join('/')}; using NU`)
  }
  if (requestedIndex > 0) notes.push(`placed in mode ${requestedToken} by the lookup table`)

  // The engine loads a COF, and the COF lists the layers. Prefer the mode the
  // object is in; fall back through the mode order when this token ships no art
  // for it (a chest in a level that placed it opened, for instance).
  let modeIndex = requested
  let cof: string | undefined
  for (const candidate of modeOrder(requested)) {
    const found = findMember(members, objectCofMember(token, candidate, request.baseIsMonsters))
    if (found !== undefined) { cof = found; modeIndex = candidate; break }
  }
  if (cof === undefined) {
    notes.push(`token ${token} ships no COF for any mode (looked for ${objectCofMember(token, requested, request.baseIsMonsters)})`)
  } else if (modeIndex !== requested) {
    notes.push(`mode ${String(requested)} has no COF; fell back to ${OBJECT_MODE_TOKENS[modeIndex] ?? 'NU'}`)
  }

  // Sprites: the same tokens as the COF name, one file per component directory.
  let member: string | null = null
  let chosenMode = modeIndex
  const layers: string[] = []
  const order = cof === undefined ? modeOrder(requested) : [modeIndex]
  outer: for (const index of order) {
    for (const component of COMPONENT_PREFERENCE) {
      const found = findMember(members, objectSpriteMember(token, component, index, request.baseIsMonsters))
      if (found === undefined) continue
      layers.push(found)
      if (member === null) { member = found; chosenMode = index }
    }
    if (member !== null) break outer
  }
  // `lit` is not universal in the shipped set: a handful of tokens store the same
  // name without it, so those are matched too rather than reported as missing.
  if (member === null) {
    for (const index of order) {
      const mode = OBJECT_MODE_TOKENS[index]?.toLowerCase() ?? 'nu'
      const root = request.baseIsMonsters ? MONSTER_ROOT : OBJECT_ROOT
      const prefix = `${root}${token.toLowerCase()}\\`
      const suffix = `${mode}${OBJECT_WEAPON}.dcc`
      const hits = members
        .filter(name => name.toLowerCase().startsWith(prefix) && name.toLowerCase().endsWith(suffix))
        .sort()
      if (hits.length > 0) { member = hits[0] ?? null; chosenMode = index; layers.push(...hits); break }
    }
  }
  if (member === null) {
    notes.push(`token ${token} ships no sprite member for mode ${OBJECT_MODE_TOKENS[chosenMode] ?? 'NU'}`)
  }

  if (cof !== undefined) notes.push(`cof ${cof}`)
  if (layers.length > 1) notes.push(`layers ${layers.join(' ')}`)
  if (request.row !== null && (request.row.mode < 0 || request.row.mode >= OBJECT_MODE_COUNT)) {
    notes.push(`row mode ${String(request.row.mode)} is outside 0..${String(OBJECT_MODE_COUNT - 1)}`)
  }
  notes.push('frameIndex is the COF\'s first frame; add Objects.txt Start{mode} for the mode\'s own first frame')

  return {
    member,
    mode: OBJECT_MODE_TOKENS[chosenMode] ?? 'NU',
    frameIndex: 0,
    anchor,
    notes,
  }
}

/** One composited object animation, the way the engine builds one. */
export interface ObjectSheet {
  /** The composited frames for direction 0, in COF frame order. */
  readonly sheet: SpriteSheet
  /** Directions the COF declares (1 for most objects, 4 for a rare few). */
  readonly directions: number
  /** Frames per direction, i.e. the COF's own count. */
  readonly framesPerDirection: number
  /** The COF member that was read. */
  readonly cof: string
  /** The sprite members the COF's layers resolved to, in draw order. */
  readonly members: readonly string[]
  /** Layers with no sprite, or that failed to decode. */
  readonly skipped: number
  /** Non-fatal observations. */
  readonly notes: readonly string[]
}

/**
 * Build an object's frames the way the engine does: read the COF, then its layers.
 *
 * This is the authoritative path — it is what `D2Common_10884_COMPOSIT_unk`
 * resolves and what `D2Comp.cpp`'s `sub_6F8A1250` loads — and it needs the
 * archives, because the component list lives inside the COF bytes and nowhere
 * else. The layer decoders are `src/formats/cof.ts` and `src/formats/dcc.ts`, the
 * same ones `src/game/character.ts` uses; the draw order comes from
 * `cofLayerOrder`, and the frame-window arithmetic is `Start{mode}` +
 * `FrameCnt{mode}` from `Objects.txt` when the row is supplied.
 *
 * @param archives - the mounted archives.
 * @param token - `Objects.txt` `Token`.
 * @param modeIndex - animation mode index, 0..7.
 * @param row - the `Objects.txt` row, for the mode's frame window; optional.
 * @returns the composited sheet.
 * @throws when the COF for that token and mode is absent, naming both.
 */
export async function loadObjectSheet(
  archives: MountedArchives,
  token: string,
  modeIndex: number,
  row?: ObjectsRow,
  baseIsMonsters = false,
): Promise<ObjectSheet> {
  const cofMember = objectCofMember(token, modeIndex, baseIsMonsters)
  let cof: CofFile
  try {
    cof = decodeCof(await archives.read(cofMember))
  } catch (err) {
    throw new Error(`loadObjectSheet: ${cofMember} (token ${token}, mode ${OBJECT_MODE_TOKENS[modeIndex] ?? '?'}) failed: ${(err as Error).message}`)
  }
  const names = await archives.listFiles()
  const notes: string[] = []
  const members: string[] = []
  const sprites: (DccFile | null)[] = []
  for (const layer of cof.layers) {
    const component = OBJECT_COMPONENTS[layer.type]
    if (component === undefined) { notes.push(`layer type ${String(layer.type)} has no component directory`); sprites.push(null); continue }
    const wanted = objectSpriteMember(token, component, modeIndex, baseIsMonsters)
    const wantedNoLit = wanted.replace(/lit(\.dcc)$/i, '$1')
    let found = findMember(names, wanted)
    if (found === undefined) found = findMember(names, wanted.replace(/\.dcc$/i, '.dc6'))
    if (found === undefined && wantedNoLit !== wanted) {
      found = findMember(names, wantedNoLit)
      if (found === undefined) found = findMember(names, wantedNoLit.replace(/\.dcc$/i, '.dc6'))
    }
    if (found === undefined) { notes.push(`no sprite for component ${component} (${wanted})`); sprites.push(null); continue }
    try {
      const raw = await archives.read(found)
      if (found.toLowerCase().endsWith('.dc6')) {
        sprites.push(dc6ToDccFile(decodeDc6(raw), cof.numberOfDirections, cof.framesPerDirection))
      } else {
        sprites.push(decodeDcc(raw))
      }
      members.push(found)
    } catch (err) {
      notes.push(`${found}: ${(err as Error).message}`)
      sprites.push(null)
    }
  }

  const start = row === undefined ? 0 : (row.start[modeIndex] ?? 0)
  const count = row === undefined ? cof.framesPerDirection : Math.max(1, row.frameCnt[modeIndex] ?? 1)
  const frames: SpriteFrame[] = []
  for (let index = 0; index < cof.framesPerDirection; index += 1) frames.push(blankFrame())
  const wanted = row === undefined ? [0] : Array.from({ length: count }, (_, offset) => start + offset)
  const directions = Math.max(1, cof.numberOfDirections)
  for (const index of wanted) {
    if (index < 0 || index >= cof.framesPerDirection) continue
    let left = Number.POSITIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    let placed = 0
    for (const sprite of sprites) {
      if (sprite === null) continue
      const direction = sprite.directions[0]
      const frame = direction?.frames[index]
      if (frame === undefined) continue
      left = Math.min(left, direction!.box.left)
      top = Math.min(top, direction!.box.top)
      right = Math.max(right, direction!.box.left + direction!.box.width)
      bottom = Math.max(bottom, direction!.box.top + direction!.box.height)
      placed += 1
    }
    if (placed === 0) continue
    const width = Math.max(1, Math.round(right) - Math.round(left))
    const height = Math.max(1, Math.round(bottom) - Math.round(top))
    const composed: SpriteFrame = { width, height, indices: new Uint8Array(width * height), mask: new Uint8Array(width * height) }
    const ordered = cofLayerOrder(cof, 0, index)
    for (const layerIndex of ordered) {
      const sprite = sprites[layerIndex]
      if (sprite === null || sprite === undefined) continue
      const direction = sprite.directions[0]
      const frame = direction?.frames[index]
      if (frame === undefined) continue
      blit(composed, frame.frame, Math.round(direction!.box.left) - Math.round(left), Math.round(direction!.box.top) - Math.round(top))
    }
    frames[index] = composed
  }

  return {
    sheet: { groups: [{ frames }], width: null },
    directions,
    framesPerDirection: cof.framesPerDirection,
    cof: cofMember,
    members,
    skipped: sprites.filter(sprite => sprite === null).length,
    notes,
  }
}

/**
 * A transparent 1×1 frame, so a slot with no art still occupies its COF index.
 *
 * @returns the frame.
 */
function blankFrame(): SpriteFrame {
  return { width: 1, height: 1, indices: new Uint8Array(1), mask: new Uint8Array(1) }
}

/**
 * Masked blit of one layer onto the composed frame.
 *
 * Palette index 0 is transparent in D2's art, so a layer paints only where it has
 * a non-zero pixel — the same rule the DT1 tile compositor uses.
 *
 * @param target - destination frame buffers.
 * @param source - the layer's frame.
 * @param atX - destination x.
 * @param atY - destination y.
 */
function blit(
  target: { indices: Uint8Array; mask: Uint8Array; width: number; height: number },
  source: SpriteFrame,
  atX: number,
  atY: number,
): void {
  for (let y = 0; y < source.height; y += 1) {
    const ty = atY + y
    if (ty < 0 || ty >= target.height) continue
    for (let x = 0; x < source.width; x += 1) {
      const value = source.indices[y * source.width + x] ?? 0
      if (value === 0) continue
      const tx = atX + x
      if (tx < 0 || tx >= target.width) continue
      target.indices[ty * target.width + tx] = value
      target.mask[ty * target.width + tx] = 1
    }
  }
}
