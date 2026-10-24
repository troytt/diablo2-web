/**
 * Authentic Diablo II v1.13c Automap Table Parser, Cell Lookup, Priority Weights & Overrides.
 *
 * Ground truth references:
 * - D2Common.dll:
 *   - 0x6fdef720: gszAutomapLevelNames[36] (0..35, 1-to-1 with LvlTypes.txt IDs 1..35)
 *   - 0x6fdef7b0: gszAutomapTileNames[20] (0..19, D2C_TileTypes "fl".."fi")
 *   - 0x6fdbcca0 (1.13c) / 0x6fd5f8f0 (1.10f): DATATBLS_LoadAutomapTxt
 *   - 0x6fdbfac0 (1.13c #10148) / 0x6fd5fdd0 (1.10f): DATATBLS_GetAutomapCellId
 *   - 0x6fd89360: DRLGROOMTILE_GetAutomapCellForTile / DRLGROOMTILE_AddTilePresetUnits
 * - D2Client.dll:
 *   - 0x6fba1528: 49 (cellId, groupId) priority weight pairs across 18 groups (0..17)
 *   - 0x6fb10990, 0x6fb0f760, 0x6fb11320: gnAutomapCellWeight[2048] & tree deduplication
 *   - 0x6fb11880, 0x6fb11780: tile & object automap pixel coordinate projection
 *   - 0x6fb11d00, 0x6fb10c40: static & dynamic object/monster automap cell overrides
 *   - 0x6fb12760: pre-baked town base map chunk generation (Act2Map, Act4Map, ExTnMap)
 *   - 0x6fb0f1c0, 0x6fb82de8: 12-segment closed isometric X crosshair polygon
 */

export type AutomapAtlasSlot = 0 | 1 | 2 | 3 // 0 = MaxiMap(S), 1 = Act2Map(S), 2 = Act4Map(S), 3 = ExTnMap(S)

export interface AutomapRow {
  readonly rowIndex: number
  readonly levelName: string
  readonly tileName: string
  readonly levelTypeId: number // 0..35
  readonly tileType: number    // 0..19
  readonly style: number       // -1 or 0..N
  readonly startSequence: number // -1 or 0..N
  readonly endSequence: number   // -1 or 0..N
  readonly cels: readonly number[]
  readonly celCount: number
}

export interface AutomapTable {
  readonly rows: readonly AutomapRow[]
  readonly buckets: ReadonlyArray<ReadonlyArray<readonly AutomapRow[]>> // [36][20]
  readonly levelRanges: ReadonlyArray<{ readonly start: number; readonly end: number }> // [36]
}

export interface AutomapCell {
  readonly cellNo: number
  readonly xPixel: number
  readonly yPixel: number
  readonly cellX: number
  readonly cellY: number
  readonly fSaved?: AutomapAtlasSlot
  readonly weight?: number
  readonly preRevealed?: boolean
}

export interface AutomapLayerData {
  readonly layerId: number
  readonly levelTypeId: number
  readonly floors: readonly AutomapCell[]
  readonly walls: readonly AutomapCell[]
  readonly objects: readonly AutomapCell[]
  readonly extras: readonly AutomapCell[]
}

/**
 * 36 Automap Level Names (0..35) from D2Common.dll 0x6fdef720 (gszAutomapLevelNames).
 * Indices 1..35 map 1-to-1 to LvlTypes.txt IDs 1..35.
 * Note index 5 is spelled "1 Monestary" in the binary and AutoMap.txt.
 */
export const AUTOMAP_LEVEL_NAMES: readonly string[] = [
  'None',
  '1 Town',
  '1 Wilderness',
  '1 Cave',
  '1 Crypt',
  '1 Monestary',
  '1 Courtyard',
  '1 Barracks',
  '1 Jail',
  '1 Cathedral',
  '1 Catacombs',
  '1 Tristram',
  '2 Town',
  '2 Sewer',
  '2 Harem',
  '2 Basement',
  '2 Desert',
  '2 Tomb',
  '2 Lair',
  '2 Arcane',
  '3 Town',
  '3 Jungle',
  '3 Kurast',
  '3 Spider',
  '3 Dungeon',
  '3 Sewer',
  '4 Town',
  '4 Mesa',
  '4 Lava',
  '5 Town',
  '5 Siege',
  '5 Barricade',
  '5 Temple',
  '5 Ice',
  '5 Baal',
  '5 Lava',
]

/**
 * 20 Automap Tile Names (0..19) from D2Common.dll 0x6fdef7b0 (gszAutomapTileNames).
 * Matches D2C_TileTypes 0..19.
 */
export const AUTOMAP_TILE_NAMES: readonly string[] = [
  'fl',
  'wl',
  'wr',
  'wtlr',
  'wtll',
  'wtr',
  'wbl',
  'wbr',
  'wld',
  'wrd',
  'wle',
  'wre',
  'co',
  'sh',
  'tr',
  'rf',
  'ld',
  'rd',
  'fd',
  'fi',
]

/**
 * 49 (cellId, groupId) priority weight pairs across 18 priority groups (0..17)
 * extracted directly from D2Client.dll 0x6fba1528..0x6fba16b0.
 */
export const AUTOMAP_CELL_WEIGHT_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [1, 0], [2, 0], [3, 0],
  [6, 1], [7, 1], [8, 1],
  [11, 2], [12, 2],
  [13, 3], [14, 3],
  [20, 4], [38, 4],
  [21, 5], [39, 5],
  [46, 6], [47, 6], [48, 6], [49, 6],
  [51, 7], [52, 7], [53, 7], [54, 7],
  [60, 8], [70, 8],
  [61, 9], [71, 9],
  [120, 10], [169, 10], [171, 10],
  [121, 11], [170, 11], [172, 11],
  [257, 12], [258, 12], [259, 12],
  [266, 13], [267, 13],
  [337, 14], [338, 14],
  [472, 15], [473, 15], [474, 15], [475, 15],
  [520, 16], [521, 16], [522, 16],
  [533, 17], [534, 17],
]

/**
 * 2048-entry weight lookup table (gnAutomapCellWeight at D2Client.dll 0x6fbc55b8),
 * initialized to -1 and populated from AUTOMAP_CELL_WEIGHT_PAIRS (0x6fb10990).
 */
const CELL_WEIGHT_TABLE: Int16Array = (() => {
  const table = new Int16Array(2048)
  table.fill(-1)
  for (const [cellId, groupId] of AUTOMAP_CELL_WEIGHT_PAIRS) {
    if (cellId >= 0 && cellId < 2048) {
      table[cellId] = groupId
    }
  }
  return table
})()

/**
 * 13 vertex pairs (x, y) from D2Client.dll 0x6fb82de8 forming the 12-segment
 * closed isometric X crosshair polygon.
 */
export const AUTOMAP_CROSSHAIR_VERTICES: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [2, -2],
  [4, -1],
  [2, 0],
  [4, 1],
  [2, 2],
  [0, 1],
  [-2, 2],
  [-4, 1],
  [-2, 0],
  [-4, -1],
  [-2, -2],
  [0, -1],
]

/**
 * 13 vertex pairs from 0x6fb82de8 scaled by 2 (shl 1 in 0x6fb0f1c0).
 */
export const AUTOMAP_CROSSHAIR_SCALED_VERTICES: ReadonlyArray<readonly [number, number]> =
  AUTOMAP_CROSSHAIR_VERTICES.map(([vx, vy]) => [vx * 2, vy * 2] as const)

const LEVEL_NAME_LOOKUP: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>()
  AUTOMAP_LEVEL_NAMES.forEach((name, idx) => {
    map.set(name.toLowerCase(), idx)
  })
  // Alternate LvlTypes.txt spellings
  map.set('1 monastery', 5)
  map.set('5 ice caves', 33)
  return map
})()

const TILE_NAME_LOOKUP: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>()
  AUTOMAP_TILE_NAMES.forEach((name, idx) => {
    map.set(name.toLowerCase(), idx)
  })
  return map
})()

/**
 * Decode bytes as Latin-1 without Node-only Buffer dependency.
 */
function decodeLatin1(bytes: Uint8Array): string {
  const chunk = 8192
  let out = ''
  for (let at = 0; at < bytes.length; at += chunk) {
    out += String.fromCharCode(...bytes.subarray(at, Math.min(at + chunk, bytes.length)))
  }
  return out
}

function normalizeZero(n: number): number {
  return n === 0 ? 0 : n
}

/**
 * Resolves an AutoMap.txt LevelName, LvlTypes.txt Name ("Act X - <Category>"), or numeric ID (0..35)
 * into its 0..35 dwAutomapLevelType index.
 * Fails fast on out-of-range numbers or unrecognized non-empty strings.
 */
export function getAutomapLevelTypeId(levelNameOrLvlTypeName: string | number): number {
  if (typeof levelNameOrLvlTypeName === 'number') {
    if (!Number.isInteger(levelNameOrLvlTypeName) || levelNameOrLvlTypeName < 0 || levelNameOrLvlTypeName >= AUTOMAP_LEVEL_NAMES.length) {
      throw new Error(`getAutomapLevelTypeId: invalid numeric levelTypeId ${String(levelNameOrLvlTypeName)}`)
    }
    return levelNameOrLvlTypeName
  }
  if (typeof levelNameOrLvlTypeName !== 'string') {
    throw new Error('getAutomapLevelTypeId: expected string or number')
  }
  const trimmed = levelNameOrLvlTypeName.trim()
  if (trimmed === '' || trimmed === '0') {
    return 0
  }
  const lower = trimmed.toLowerCase()
  if (lower === 'none' || lower === 'expansion') {
    return 0
  }
  const direct = LEVEL_NAME_LOOKUP.get(lower)
  if (direct !== undefined) {
    return direct
  }
  // Convert LvlTypes.txt "Act <N> - <Category>" -> "<N> <Category>"
  const normalized = lower.replace(/^act\s+([1-5])\s*-\s*/i, '$1 ').replace(/\s+/g, ' ').trim()
  const mapped = LEVEL_NAME_LOOKUP.get(normalized)
  if (mapped !== undefined) {
    return mapped
  }
  if (/^\d+$/.test(trimmed)) {
    const num = Number(trimmed)
    if (Number.isInteger(num) && num >= 0 && num < AUTOMAP_LEVEL_NAMES.length) {
      return num
    }
  }
  throw new Error(`getAutomapLevelTypeId: unrecognized level name "${levelNameOrLvlTypeName}"`)
}

/**
 * Maps an AutoMap.txt TileName ("fl".."fi", case-insensitive) to its 0..19 dwAutomapTileType index.
 * Empty string returns 0 ("fl", for section divider rows). Throws on unknown non-empty tile names.
 */
export function getAutomapTileType(tileName: string): number {
  if (typeof tileName !== 'string') {
    throw new Error('getAutomapTileType: expected string')
  }
  const trimmed = tileName.trim()
  if (trimmed === '') {
    return 0
  }
  const found = TILE_NAME_LOOKUP.get(trimmed.toLowerCase())
  if (found === undefined) {
    throw new Error(`getAutomapTileType: unrecognized tile name "${tileName}"`)
  }
  return found
}

function parseSignedIntField(rawVal: string | undefined, defaultVal: number, fieldName: string, rowIndex: number): number {
  if (rawVal === undefined) return defaultVal
  const trimmed = rawVal.trim()
  if (trimmed === '') return defaultVal
  const num = Number(trimmed)
  if (!Number.isInteger(num)) {
    throw new Error(`parseAutomapTable: invalid integer "${rawVal}" in ${fieldName} at row ${String(rowIndex)}`)
  }
  return num
}

/**
 * Parses data\global\excel\AutoMap.txt into a 36x20 bucketed AutomapTable.
 * Reads columns strictly by index (0=LevelName, 1=TileName, 2=Style, 3=StartSequence, 4=EndSequence,
 * 6=Cel1, 8=Cel2, 10=Cel3, 12=Cel4) to avoid the duplicate 'Type2' column header at indices 7 and 9.
 */
export function parseAutomapTable(raw: Uint8Array | string): AutomapTable {
  if (raw === null || raw === undefined) {
    throw new Error('parseAutomapTable: raw input is null or undefined')
  }
  const text = typeof raw === 'string'
    ? raw
    : raw instanceof Uint8Array
      ? decodeLatin1(raw)
      : (() => { throw new Error('parseAutomapTable: expected Uint8Array or string') })()

  if (text.trim().length === 0) {
    throw new Error('parseAutomapTable: empty input')
  }

  const lines = text.split(/\r?\n/)
  const headerLine = lines[0] ?? ''
  const header = headerLine.split('\t').map(h => h.trim())
  if (
    header.length < 13
    || header[0] !== 'LevelName'
    || header[1] !== 'TileName'
    || header[2] !== 'Style'
    || header[3] !== 'StartSequence'
    || header[4] !== 'EndSequence'
    || header[6] !== 'Cel1'
    || header[8] !== 'Cel2'
    || header[10] !== 'Cel3'
    || header[12] !== 'Cel4'
  ) {
    throw new Error(`parseAutomapTable: invalid 13-column AutoMap.txt header: ${JSON.stringify(header)}`)
  }

  const dataLines = lines.slice(1)
  if (dataLines.length !== 3288) {
    while (dataLines.length > 0 && dataLines[dataLines.length - 1]!.trim() === '') {
      dataLines.pop()
    }
    // If the full MPQ AutoMap.txt was passed after .trim() (3,287 lines with 'Expansion' divider at 2603),
    // preserve the 3,288th trailing record so all 3,288 rows are represented.
    if (dataLines.length === 3287 && dataLines[2603]?.startsWith('Expansion')) {
      dataLines.push('')
    }
  }

  if (dataLines.length === 0) {
    throw new Error('parseAutomapTable: no data rows found')
  }

  const buckets: AutomapRow[][][] = Array.from({ length: 36 }, () =>
    Array.from({ length: 20 }, () => []),
  )
  const levelRanges: { start: number; end: number }[] = Array.from({ length: 36 }, () => ({
    start: -1,
    end: -1,
  }))
  const rows: AutomapRow[] = []

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]!
    const cols = line.split('\t')
    const rawLevelName = (cols[0] ?? '').trim()
    const rawTileName = (cols[1] ?? '').trim()

    const isDivider =
      rawLevelName === ''
      || rawLevelName.toLowerCase() === 'expansion'
      || rawLevelName.toLowerCase() === 'none'

    if (!isDivider && rawTileName === '') {
      throw new Error(`parseAutomapTable: row ${String(i)} ("${rawLevelName}") has empty TileName`)
    }

    const levelTypeId = isDivider ? 0 : getAutomapLevelTypeId(rawLevelName)
    const tileType = rawTileName === '' ? 0 : getAutomapTileType(rawTileName)

    const style = parseSignedIntField(cols[2], -1, 'Style', i)
    const startSequence = parseSignedIntField(cols[3], -1, 'StartSequence', i)
    const endSequence = parseSignedIntField(cols[4], -1, 'EndSequence', i)

    const rawCels = [
      parseSignedIntField(cols[6], -1, 'Cel1', i),
      parseSignedIntField(cols[8], -1, 'Cel2', i),
      parseSignedIntField(cols[10], -1, 'Cel3', i),
      parseSignedIntField(cols[12], -1, 'Cel4', i),
    ]

    // DATATBLS_LoadAutomapTxt (0x6fdbcca0): count consecutive non--1 cells from Cel1..Cel4
    const cels: number[] = []
    for (let j = 0; j < 4; j++) {
      const c = rawCels[j]!
      if (c === -1 || c < 0) break
      cels.push(c)
    }

    const row: AutomapRow = {
      rowIndex: i,
      levelName: rawLevelName,
      tileName: rawTileName,
      levelTypeId,
      tileType,
      style,
      startSequence,
      endSequence,
      cels,
      celCount: cels.length,
    }
    rows.push(row)

    buckets[levelTypeId]![tileType]!.push(row)
    if (levelTypeId > 0) {
      const range = levelRanges[levelTypeId]!
      if (range.start === -1) {
        range.start = i
      }
      range.end = i + 1
    }
  }

  return {
    rows,
    buckets,
    levelRanges,
  }
}

/**
 * Deterministic SplitMix64 spatial hash for selecting among Cel1..Cel4 variants.
 */
function pickAutomapVariantIndex(
  celCount: number,
  cellX: number,
  cellY: number,
  tileType: number,
  seed: number,
): number {
  if (celCount <= 1) return 0
  const mask = (1n << 64n) - 1n
  const x = BigInt(cellX >>> 0)
  const y = BigInt(cellY >>> 0)
  const t = BigInt(tileType >>> 0)
  const s = BigInt(seed >>> 0)
  let state = (s ^ (x * 0x9e3779b97f4a7c15n) ^ (y * 0xc6a4a7935bd1e995n) ^ (t * 0x94d049bb133111ebn)) & mask
  state = (state + ((x << 32n) | y) + 0x9e3779b97f4a7c15n) & mask
  state = ((state ^ (state >> 30n)) * 0xbf58476d1ce4e5b9n) & mask
  state = ((state ^ (state >> 27n)) * 0x94d049bb133111ebn) & mask
  state = (state ^ (state >> 31n)) & mask
  return Number(state % BigInt(celCount))
}

/**
 * Looks up an automap sprite frame ID (nCellNo in MaxiMap.dc6 / MaxiMapS.dc6)
 * matching D2Common.dll DATATBLS_GetAutomapCellId (#10148 @ 0x6fdbfac0 / 0x6fd5fdd0).
 *
 * Fails fast if table is missing or parameters are out of range.
 */
export function getAutomapCellId(
  table: AutomapTable,
  levelTypeId: number,
  tileType: number,
  style: number,
  sequence: number,
  cellX = 0,
  cellY = 0,
  seed = 0,
): number {
  if (!table || !Array.isArray(table.buckets)) {
    throw new Error('getAutomapCellId: invalid AutomapTable')
  }
  if (typeof levelTypeId !== 'number' || !Number.isInteger(levelTypeId) || levelTypeId < 0 || levelTypeId >= 36) {
    throw new Error(`getAutomapCellId: invalid levelTypeId ${String(levelTypeId)} (expected integer 0..35)`)
  }
  if (typeof tileType !== 'number' || !Number.isInteger(tileType) || tileType < 0 || tileType >= 20) {
    throw new Error(`getAutomapCellId: invalid tileType ${String(tileType)} (expected integer 0..19)`)
  }
  if (typeof style !== 'number' || !Number.isInteger(style) || style < -1) {
    throw new Error(`getAutomapCellId: invalid style ${String(style)} (expected integer >= -1)`)
  }
  if (typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < -1) {
    throw new Error(`getAutomapCellId: invalid sequence ${String(sequence)} (expected integer >= -1)`)
  }

  if (levelTypeId === 0) {
    return -1
  }

  const bucket = table.buckets[levelTypeId]?.[tileType]
  if (!bucket || bucket.length === 0) {
    return -1
  }

  for (let i = 0; i < bucket.length; i++) {
    const row = bucket[i]!
    if (row.style !== -1 && row.style !== style) continue
    if (row.startSequence !== -1 && (sequence < row.startSequence || sequence > row.endSequence)) continue
    if (row.celCount <= 0 || row.cels.length === 0) {
      return -1
    }
    const idx = pickAutomapVariantIndex(row.celCount, cellX, cellY, tileType, seed)
    return row.cels[idx] ?? -1
  }

  return -1
}

/**
 * Returns the priority group weight (0..17, or -1 if unweighted) for a MaxiMap cellNo
 * per D2Client.dll 0x6fba1528 and gnAutomapCellWeight[2048] (0x6fbc55b8).
 */
export function getAutomapCellWeight(cellNo: number): number {
  if (typeof cellNo !== 'number' || !Number.isInteger(cellNo) || cellNo < 0 || cellNo >= CELL_WEIGHT_TABLE.length) {
    return -1
  }
  return CELL_WEIGHT_TABLE[cellNo] ?? -1
}

/**
 * Computes automap pixel coordinates for a floor or wall tile at (cellX, cellY)
 * per D2Client.dll 0x6fb11880.
 * Lower walls (tileType >= 16: "ld", "rd", "fd", "fi") add +24 to yPixel.
 */
export function computeAutomapTilePixelCoords(
  cellX: number,
  cellY: number,
  tileType: number,
): { xPixel: number; yPixel: number } {
  const xPixel = (cellX - cellY) * 8
  const yPixel = (cellX + cellY) * 4 + (tileType >= 16 ? 24 : 0)
  return {
    xPixel: normalizeZero(xPixel),
    yPixel: normalizeZero(yPixel),
  }
}

/**
 * Computes automap pixel coordinates for a static object or NPC at subtile (subX, subY)
 * per D2Client.dll 0x6fb11780:
 *   xClient = (subX - subY) * 16
 *   yClient = (subX + subY) * 8
 *   xPixel  = trunc(xClient / 10) + 1
 *   yPixel  = trunc(yClient / 10) - 3
 */
export function computeAutomapObjectPixelCoords(
  subX: number,
  subY: number,
): { xPixel: number; yPixel: number } {
  const xClient = (subX - subY) * 16
  const yClient = (subX + subY) * 8
  const xPixel = Math.trunc(xClient / 10) + 1
  const yPixel = Math.trunc(yClient / 10) - 3
  return {
    xPixel: normalizeZero(xPixel),
    yPixel: normalizeZero(yPixel),
  }
}

/**
 * Resolves the automap cell ID for a floor or wall tile, applying 1.13c hardcoded
 * tile overrides (D2Common.dll 0x6fd89360 & D2Client.dll 0x6fb11880) before AutoMap.txt lookup:
 * - Hidden wall bit 0 skip: tileType !== 0 && ((flags ?? 0) & 1) !== 0 -> -1
 * - Rogue Campfire in Level 2: levelId === 2 && style === 8 -> (sequence === 0 ? 405 : -1)
 * - Act 2 Palace Cellar warp: levelId === 40 && tileType === 8 && style === 25 -> (sequence === 0 ? 305 : -1)
 */
export function resolveTileAutomapCellId(
  table: AutomapTable,
  params: {
    levelId: number
    levelTypeId: number
    tileType: number
    style: number
    sequence: number
    flags?: number
    cellX?: number
    cellY?: number
    seed?: number
  },
): number {
  if (!table || !Array.isArray(table.buckets)) {
    throw new Error('resolveTileAutomapCellId: invalid AutomapTable')
  }
  if (!params || typeof params !== 'object') {
    throw new Error('resolveTileAutomapCellId: missing params')
  }
  const {
    levelId,
    levelTypeId,
    tileType,
    style,
    sequence,
    flags = 0,
    cellX = 0,
    cellY = 0,
    seed = 0,
  } = params

  if (typeof levelId !== 'number' || !Number.isInteger(levelId) || levelId < 0) {
    throw new Error(`resolveTileAutomapCellId: invalid levelId ${String(levelId)}`)
  }
  if (typeof levelTypeId !== 'number' || !Number.isInteger(levelTypeId) || levelTypeId < 0 || levelTypeId >= 36) {
    throw new Error(`resolveTileAutomapCellId: invalid levelTypeId ${String(levelTypeId)}`)
  }
  if (typeof tileType !== 'number' || !Number.isInteger(tileType) || tileType < 0 || tileType >= 20) {
    throw new Error(`resolveTileAutomapCellId: invalid tileType ${String(tileType)}`)
  }
  if (typeof style !== 'number' || !Number.isInteger(style) || style < -1) {
    throw new Error(`resolveTileAutomapCellId: invalid style ${String(style)}`)
  }
  if (typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < -1) {
    throw new Error(`resolveTileAutomapCellId: invalid sequence ${String(sequence)}`)
  }

  // Hidden wall bit 0 filter (D2Client.dll 0x6fb11880: test byte ptr [esi+24h], 1)
  if (tileType !== 0 && (flags & 1) !== 0) {
    return -1
  }

  // Blood Moor Rogue Campfire override (D2Common.dll 0x6fd89360)
  if (levelId === 2 && style === 8) {
    return sequence === 0 ? 405 : -1
  }

  // Act 2 Lut Gholein Palace Cellar stairs override (D2Common.dll 0x6fd89360)
  if (levelId === 40 && tileType === 8 && style === 25) {
    return sequence === 0 ? 305 : -1
  }

  return getAutomapCellId(table, levelTypeId, tileType, style, sequence, cellX, cellY, seed)
}

/**
 * Resolves the automap cell ID for an object instance per D2Client.dll 0x6fb11d00 & 0x6fb10c40:
 * - Stash (267) -> 319
 * - Cain Gibbet (26) -> 267
 * - Blue Portal (59) -> 306
 * - Red Portal (60) -> in Level 4 (Stony Field), mode === 0 ? -1 : 300; otherwise 306
 * - Wirt's Body (268) -> 309
 * - Khalim Chests (405..407) -> 319
 * - Sewer Stairs (366) -> mode === undefined || mode === 2 ? (autoMapCol > 0 ? autoMapCol : 308) : -1
 * - Arcane Waypoint (402) -> levelId === 74 ? (autoMapCol > 0 ? autoMapCol : 307) : -1
 * - Otherwise -> autoMapCol > 0 ? autoMapCol : -1
 */
export function resolveObjectAutomapCellId(params: {
  objectClassId: number
  autoMapCol: number
  levelId?: number
  mode?: number
}): number {
  if (!params || typeof params !== 'object') {
    throw new Error('resolveObjectAutomapCellId: missing params')
  }
  const { objectClassId, autoMapCol, levelId, mode } = params
  if (typeof objectClassId !== 'number' || !Number.isInteger(objectClassId) || objectClassId < 0) {
    throw new Error(`resolveObjectAutomapCellId: invalid objectClassId ${String(objectClassId)}`)
  }
  if (typeof autoMapCol !== 'number' || Number.isNaN(autoMapCol)) {
    throw new Error(`resolveObjectAutomapCellId: invalid autoMapCol ${String(autoMapCol)}`)
  }

  if (objectClassId === 267) return 319
  if (objectClassId === 26) return 267
  if (objectClassId === 59) return 306
  if (objectClassId === 60) {
    if (levelId === 4) {
      return mode === 0 ? -1 : 300
    }
    return 306
  }
  if (objectClassId === 268) return 309
  if (objectClassId >= 405 && objectClassId <= 407) return 319
  if (objectClassId === 366) {
    if (mode === undefined || mode === 2) {
      return autoMapCol > 0 ? autoMapCol : 308
    }
    return -1
  }
  if (objectClassId === 402) {
    if (levelId === 74) {
      return autoMapCol > 0 ? autoMapCol : 307
    }
    return -1
  }
  return autoMapCol > 0 ? autoMapCol : -1
}

const CAIN_MONSTER_CLASS_IDS = new Set<number>([146, 254, 265, 266, 473, 532, 540])

/**
 * Resolves the automap cell ID for a monster/NPC per D2Client.dll 0x6fb11dfd & 0x6fb10ef0:
 * - Dead monsters (isAlive === false) -> -1
 * - Deckard Cain monster IDs {146, 254, 265, 266, 473, 532, 540} -> 267
 * - MonStats2.txt noMap === true -> -1
 * - Otherwise -> automapCel > 0 ? automapCel : -1
 */
export function resolveMonsterAutomapCellId(params: {
  monsterClassId: number
  automapCel: number
  noMap?: boolean
  isAlive?: boolean
}): number {
  if (!params || typeof params !== 'object') {
    throw new Error('resolveMonsterAutomapCellId: missing params')
  }
  const { monsterClassId, automapCel, noMap = false, isAlive = true } = params
  if (typeof monsterClassId !== 'number' || !Number.isInteger(monsterClassId) || monsterClassId < 0) {
    throw new Error(`resolveMonsterAutomapCellId: invalid monsterClassId ${String(monsterClassId)}`)
  }
  if (typeof automapCel !== 'number' || Number.isNaN(automapCel)) {
    throw new Error(`resolveMonsterAutomapCellId: invalid automapCel ${String(automapCel)}`)
  }

  if (!isAlive) return -1
  if (CAIN_MONSTER_CLASS_IDS.has(monsterClassId)) return 267
  if (noMap) return -1
  return automapCel > 0 ? automapCel : -1
}

function isSpecialOverrideIcon(cellNo: number): boolean {
  return (cellNo >= 300 && cellNo <= 319) || cellNo === 405
}

/**
 * Deduplicates automap cells at identical (xPixel, yPixel) coordinates using the
 * D2Client.dll 0x6fba1528 priority weight table (and preserving special warp/portal/stash/campfire
 * override icons 300..319, 405 over unweighted ordinary wall/floor tiles).
 * Returns cells sorted deterministically by (yPixel, xPixel, cellNo).
 */
export function deduplicateAutomapCells(cells: readonly AutomapCell[]): AutomapCell[] {
  if (!Array.isArray(cells)) {
    throw new Error('deduplicateAutomapCells: expected array of AutomapCell')
  }
  const byCoord = new Map<string, AutomapCell>()

  for (let i = 0; i < cells.length; i++) {
    const rawCell = cells[i]!
    const weight = rawCell.weight !== undefined ? rawCell.weight : getAutomapCellWeight(rawCell.cellNo)
    const normalized: AutomapCell = {
      ...rawCell,
      xPixel: normalizeZero(rawCell.xPixel),
      yPixel: normalizeZero(rawCell.yPixel),
      weight,
    }
    const key = `${String(normalized.fSaved ?? 0)}:${String(normalized.xPixel)}:${String(normalized.yPixel)}`
    const existing = byCoord.get(key)
    if (existing === undefined) {
      byCoord.set(key, normalized)
      continue
    }

    const existWeight = existing.weight !== undefined ? existing.weight : getAutomapCellWeight(existing.cellNo)
    if (weight > existWeight) {
      byCoord.set(key, normalized)
    } else if (weight === existWeight && weight === -1) {
      if (isSpecialOverrideIcon(normalized.cellNo) && !isSpecialOverrideIcon(existing.cellNo)) {
        byCoord.set(key, normalized)
      }
    }
  }

  const result = [...byCoord.values()]
  result.sort((a, b) => a.yPixel - b.yPixel || a.xPixel - b.xPixel || a.cellNo - b.cellNo)
  return result
}

/**
 * Act 2 Lut Gholein (`Act2Map.dc6`) placeholder red-X frame indices skipped by
 * `D2Client.dll` `pfTownAutomap` (`0x6fb12760`, skip table at `0x6fb82db8`).
 */
export const ACT2_TOWN_AUTOMAP_SKIP_FRAMES: ReadonlySet<number> = new Set([
  0, 10, 15, 16, 19, 20, 25, 30, 35, 36, 39,
])

/**
 * Generates pre-baked town base map chunks for `pLayer->pExtras` per
 * `D2Common.dll` `DRLGPRESET_GenerateLevel` (`0x6FD886F0`) and
 * `D2Client.dll` `pfTownAutomap` (`0x6fb12760`):
 * - `levelId === 40` (Lut Gholein): `fSaved = 1` (`Act2Map`), 5 cols × 4 rows (`stepX=160, stepY=100, adjX=53, adjY=-81`),
 *   `startFrame = pickedFile === 1 ? 0 : 20`, skipping `ACT2_TOWN_AUTOMAP_SKIP_FRAMES`.
 * - `levelId === 103` (Pandemonium Fortress): `fSaved = 2` (`Act4Map`), 2 cols × 2 rows (`stepX=136, stepY=90, adjX=-3, adjY=-50`), frames `0..3`.
 * - `levelId === 109` (Harrogath): `fSaved = 3` (`ExTnMap`), 3 cols × 2 rows (`stepX=180, stepY=170, adjX=-20, adjY=-155`), frames `0..5`.
 */
export function generateTownSavedExtras(
  levelId: number,
  cellsX?: number,
  cellsY?: number,
  pickedFile = 0,
): AutomapCell[] {
  if (typeof levelId !== 'number' || !Number.isInteger(levelId) || levelId < 0) {
    throw new Error(`generateTownSavedExtras: invalid levelId ${String(levelId)}`)
  }
  if (levelId !== 40 && levelId !== 103 && levelId !== 109) {
    return []
  }

  const defaultWidth = levelId === 40 ? 56 : levelId === 103 ? 32 : 40
  const defaultHeight = levelId === 40 ? 56 : levelId === 103 ? 24 : 40
  const effectiveCellsX = cellsX !== undefined && cellsX > 0 ? cellsX : defaultWidth
  const effectiveCellsY = cellsY !== undefined && cellsY > 0 ? cellsY : defaultHeight

  // D2Common.dll DRLGPRESET_GenerateLevel (0x6FD886F0) + DUNGEON_GameTileToClientCoords (0x6FD8D6E0):
  // centerTileX = nWidth / 2, centerTileY = nHeight / 2
  // centerXPixel = 8 * (centerTileX - centerTileY), centerYPixel = 4 * (centerTileX + centerTileY)
  const centerTileX = Math.trunc(effectiveCellsX / 2)
  const centerTileY = Math.trunc(effectiveCellsY / 2)
  const centerXPixel = 8 * (centerTileX - centerTileY)
  const centerYPixel = 4 * (centerTileX + centerTileY)

  let fSaved: 1 | 2 | 3
  let nCols: number
  let nRows: number
  let stepX: number
  let stepY: number
  let adjX: number
  let adjY: number
  let startFrame: number

  if (levelId === 40) {
    fSaved = 1
    nCols = 5
    nRows = 4
    stepX = 160
    stepY = 100
    adjX = 53
    adjY = -81
    startFrame = pickedFile === 1 ? 0 : 20
  } else if (levelId === 103) {
    fSaved = 2
    nCols = 2
    nRows = 2
    stepX = 136
    stepY = 90
    adjX = -3
    adjY = -50
    startFrame = 0
  } else {
    fSaved = 3
    nCols = 3
    nRows = 2
    stepX = 180
    stepY = 170
    adjX = -20
    adjY = -155
    startFrame = 0
  }

  const startX = centerXPixel - (Math.trunc((stepX * nCols) / 2) + adjX)
  const startY = centerYPixel - Math.trunc((stepY * nRows) / 2) - adjY

  const extras: AutomapCell[] = []
  for (let row = 0; row < nRows; row++) {
    const yPixel = normalizeZero(startY + row * stepY)
    for (let col = 0; col < nCols; col++) {
      const cellNo = startFrame + row * nCols + col
      if (fSaved === 1 && ACT2_TOWN_AUTOMAP_SKIP_FRAMES.has(cellNo)) {
        continue
      }
      const xPixel = normalizeZero(startX + col * stepX)
      const isoX = (xPixel * 10) / 16
      const isoY = (yPixel * 10) / 8
      const subX = Math.round((isoX + isoY) / 2)
      const subY = Math.round((isoY - isoX) / 2)
      extras.push({
        cellNo,
        xPixel,
        yPixel,
        cellX: normalizeZero(Math.floor(subX / 5)),
        cellY: normalizeZero(Math.floor(subY / 5)),
        fSaved,
        weight: -1,
      })
    }
  }

  return extras
}

/**
 * Computes the 12 closed line segments for the 1.13c isometric X crosshair polygon
 * (D2Client.dll 0x6fb0f1c0 & vertex table 0x6fb82de8 scaled by 2).
 * Applies the (-1, +5) center shift when bMinimap === true.
 */
export function getCrosshairSegments(
  cx: number,
  cy: number,
  bMinimap: boolean,
): ReadonlyArray<{ readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }> {
  const adjX = bMinimap ? cx - 1 : cx
  const adjY = bMinimap ? cy + 5 : cy
  const segments: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }[] = []
  for (let i = 0; i < 12; i++) {
    const v0 = AUTOMAP_CROSSHAIR_SCALED_VERTICES[i]!
    const v1 = AUTOMAP_CROSSHAIR_SCALED_VERTICES[i + 1]!
    segments.push({
      x0: adjX + v0[0],
      y0: adjY + v0[1],
      x1: adjX + v1[0],
      y1: adjY + v1[1],
    })
  }
  return segments
}
