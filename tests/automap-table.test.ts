import fs from 'node:fs'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { MpqArchive, memorySource } from '../src/common/mpq/index.ts'
import {
  AUTOMAP_CELL_WEIGHT_PAIRS,
  AUTOMAP_CROSSHAIR_SCALED_VERTICES,
  AUTOMAP_CROSSHAIR_VERTICES,
  AUTOMAP_LEVEL_NAMES,
  AUTOMAP_TILE_NAMES,
  computeAutomapObjectPixelCoords,
  computeAutomapTilePixelCoords,
  deduplicateAutomapCells,
  generateTownSavedExtras,
  getAutomapCellId,
  getAutomapCellWeight,
  getAutomapLevelTypeId,
  getAutomapTileType,
  getCrosshairSegments,
  parseAutomapTable,
  resolveMonsterAutomapCellId,
  resolveObjectAutomapCellId,
  resolveTileAutomapCellId,
} from '../src/common/formats/automap-table.ts'
import * as gameAutomapReexport from '../src/common/world/automap-table.ts'

const MPQ_PATH = path.resolve(process.cwd(), 'samples/d2/d2exp.mpq')
let rawAutomapBytes: Uint8Array

beforeAll(async () => {
  const archive = await MpqArchive.open(memorySource(new Uint8Array(fs.readFileSync(MPQ_PATH))))
  const file = archive.find('data\\global\\excel\\AutoMap.txt')
  if (!file) throw new Error('AutoMap.txt not found in d2exp.mpq')
  rawAutomapBytes = await archive.read(file)
})

describe('Diablo II v1.13c Automap Table & Cell Lookup (R1)', () => {
  it('re-exports the complete contract from src/common/formats/automap-table.ts', () => {
    expect(gameAutomapReexport.AUTOMAP_LEVEL_NAMES).toBe(AUTOMAP_LEVEL_NAMES)
    expect(gameAutomapReexport.AUTOMAP_TILE_NAMES).toBe(AUTOMAP_TILE_NAMES)
    expect(gameAutomapReexport.AUTOMAP_CELL_WEIGHT_PAIRS).toBe(AUTOMAP_CELL_WEIGHT_PAIRS)
    expect(gameAutomapReexport.AUTOMAP_CROSSHAIR_VERTICES).toBe(AUTOMAP_CROSSHAIR_VERTICES)
    expect(gameAutomapReexport.AUTOMAP_CROSSHAIR_SCALED_VERTICES).toBe(AUTOMAP_CROSSHAIR_SCALED_VERTICES)
    expect(gameAutomapReexport.parseAutomapTable).toBe(parseAutomapTable)
    expect(gameAutomapReexport.getAutomapCellId).toBe(getAutomapCellId)
    expect(gameAutomapReexport.resolveTileAutomapCellId).toBe(resolveTileAutomapCellId)
    expect(gameAutomapReexport.resolveObjectAutomapCellId).toBe(resolveObjectAutomapCellId)
    expect(gameAutomapReexport.resolveMonsterAutomapCellId).toBe(resolveMonsterAutomapCellId)
    expect(gameAutomapReexport.deduplicateAutomapCells).toBe(deduplicateAutomapCells)
    expect(gameAutomapReexport.generateTownSavedExtras).toBe(generateTownSavedExtras)
    expect(gameAutomapReexport.getCrosshairSegments).toBe(getCrosshairSegments)
  })

  it('defines all 36 level names (0x6fdef720) and 20 tile names (0x6fdef7b0)', () => {
    expect(AUTOMAP_LEVEL_NAMES).toHaveLength(36)
    expect(AUTOMAP_LEVEL_NAMES[0]).toBe('None')
    expect(AUTOMAP_LEVEL_NAMES[1]).toBe('1 Town')
    expect(AUTOMAP_LEVEL_NAMES[5]).toBe('1 Monestary')
    expect(AUTOMAP_LEVEL_NAMES[12]).toBe('2 Town')
    expect(AUTOMAP_LEVEL_NAMES[20]).toBe('3 Town')
    expect(AUTOMAP_LEVEL_NAMES[25]).toBe('3 Sewer')
    expect(AUTOMAP_LEVEL_NAMES[26]).toBe('4 Town')
    expect(AUTOMAP_LEVEL_NAMES[29]).toBe('5 Town')
    expect(AUTOMAP_LEVEL_NAMES[35]).toBe('5 Lava')

    expect(AUTOMAP_TILE_NAMES).toHaveLength(20)
    expect(AUTOMAP_TILE_NAMES[0]).toBe('fl')
    expect(AUTOMAP_TILE_NAMES[1]).toBe('wl')
    expect(AUTOMAP_TILE_NAMES[2]).toBe('wr')
    expect(AUTOMAP_TILE_NAMES[8]).toBe('wld')
    expect(AUTOMAP_TILE_NAMES[9]).toBe('wrd')
    expect(AUTOMAP_TILE_NAMES[13]).toBe('sh')
    expect(AUTOMAP_TILE_NAMES[14]).toBe('tr')
    expect(AUTOMAP_TILE_NAMES[15]).toBe('rf')
    expect(AUTOMAP_TILE_NAMES[16]).toBe('ld')
    expect(AUTOMAP_TILE_NAMES[19]).toBe('fi')
  })

  it('resolves levelTypeIds from AutoMap.txt names, LvlTypes.txt names, and numeric IDs, failing fast on invalid inputs', () => {
    for (let i = 0; i < AUTOMAP_LEVEL_NAMES.length; i++) {
      expect(getAutomapLevelTypeId(AUTOMAP_LEVEL_NAMES[i]!)).toBe(i)
      expect(getAutomapLevelTypeId(i)).toBe(i)
    }
    expect(getAutomapLevelTypeId('Act 1 - Town')).toBe(1)
    expect(getAutomapLevelTypeId('Act 1 - Monastery')).toBe(5)
    expect(getAutomapLevelTypeId('Act 2 - Town')).toBe(12)
    expect(getAutomapLevelTypeId('Act 3 - Sewer')).toBe(25)
    expect(getAutomapLevelTypeId('Act 4 - Lava')).toBe(28)
    expect(getAutomapLevelTypeId('Act 5 - Ice Caves')).toBe(33)
    expect(getAutomapLevelTypeId('Act 5 - Lava')).toBe(35)
    expect(getAutomapLevelTypeId('Expansion')).toBe(0)
    expect(getAutomapLevelTypeId('')).toBe(0)

    expect(() => getAutomapLevelTypeId(-1)).toThrow()
    expect(() => getAutomapLevelTypeId(36)).toThrow()
    expect(() => getAutomapLevelTypeId('Act 6 - Fake')).toThrow()
  })

  it('resolves tileTypes from AutoMap.txt tile names and fails fast on unknown tile names', () => {
    for (let i = 0; i < AUTOMAP_TILE_NAMES.length; i++) {
      expect(getAutomapTileType(AUTOMAP_TILE_NAMES[i]!)).toBe(i)
      expect(getAutomapTileType(AUTOMAP_TILE_NAMES[i]!.toUpperCase())).toBe(i)
    }
    expect(getAutomapTileType('')).toBe(0)
    expect(() => getAutomapTileType('invalid_tile')).toThrow()
  })

  it('parses all 3,288 rows of AutoMap.txt from d2exp.mpq with exact 36x20 buckets and Cel1..Cel4 indices', () => {
    const table = parseAutomapTable(rawAutomapBytes)
    expect(table.rows).toHaveLength(3288)
    expect(table.buckets).toHaveLength(36)
    for (let lvl = 0; lvl < 36; lvl++) {
      expect(table.buckets[lvl]).toHaveLength(20)
    }
    expect(table.levelRanges).toHaveLength(36)

    // Row 0: 1 Town, fl, style=0, startSeq=1
    const row0 = table.rows[0]!
    expect(row0.levelName).toBe('1 Town')
    expect(row0.levelTypeId).toBe(1)
    expect(row0.tileName).toBe('fl')
    expect(row0.tileType).toBe(0)
    expect(row0.style).toBe(0)
    expect(row0.startSequence).toBe(1)
    expect(row0.endSequence).toBeGreaterThanOrEqual(1)
    expect(row0.celCount).toBeGreaterThanOrEqual(1)

    // Expansion divider at row 2603
    const expRow = table.rows[2603]!
    expect(expRow.levelName).toBe('Expansion')
    expect(expRow.levelTypeId).toBe(0)
    expect(expRow.celCount).toBe(0)

    // Verify all Cel values across all 3,288 rows are in 0..1498 (within MaxiMap.dc6's 1,499 frames)
    let maxCel = -1
    let multiVariantRows = 0
    for (const row of table.rows) {
      if (row.celCount > 1) multiVariantRows++
      for (const cel of row.cels) {
        expect(cel).toBeGreaterThanOrEqual(0)
        expect(cel).toBeLessThan(1499)
        if (cel > maxCel) maxCel = cel
      }
    }
    expect(maxCel).toBe(1498)
    expect(multiVariantRows).toBeGreaterThan(200)
  })

  it('looks up automap cells with wildcard style/sequence matching and deterministic SplitMix64 variants', () => {
    const table = parseAutomapTable(rawAutomapBytes)

    // 1 Town, wl (1), style=0, seq=0 -> 61
    expect(getAutomapCellId(table, 1, 1, 0, 0)).toBe(61)
    // 1 Town, wr (2), style=0, seq=0 -> 60
    expect(getAutomapCellId(table, 1, 2, 0, 0)).toBe(60)
    // LevelType 0 ("None") -> -1
    expect(getAutomapCellId(table, 0, 1, 0, 0)).toBe(-1)
    // Non-matching style/sequence -> -1
    expect(getAutomapCellId(table, 1, 1, 999, 999)).toBe(-1)

    // Verify wildcard and range matching on a custom synthetic table
    const syntheticTsv = [
      'LevelName\tTileName\tStyle\tStartSequence\tEndSequence\tType1\tCel1\tType2\tCel2\tType2\tCel3\tType4\tCel4',
      '1 Cave\tfl\t5\t2\t6\tfl\t100\tfl\t101\tfl\t102\tfl\t103',
      '1 Cave\tfl\t-1\t-1\t-1\tfl\t200\t\t-1\t\t-1\t\t-1',
    ].join('\n')
    const synthTable = parseAutomapTable(syntheticTsv)

    // Sequence in [2..6] matches row 0 (100..103)
    const seen = new Set<number>()
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        const c = getAutomapCellId(synthTable, 3, 0, 5, 4, x, y, 42)
        expect([100, 101, 102, 103]).toContain(c)
        seen.add(c)
      }
    }
    expect(seen.size).toBe(4)

    // Sequence outside [2..6] falls through to wildcard row 1 (200)
    expect(getAutomapCellId(synthTable, 3, 0, 5, 1)).toBe(200)
    expect(getAutomapCellId(synthTable, 3, 0, 99, 99)).toBe(200)

    // Fail-fast checks
    expect(() => getAutomapCellId(synthTable, -1, 0, 0, 0)).toThrow()
    expect(() => getAutomapCellId(synthTable, 36, 0, 0, 0)).toThrow()
    expect(() => getAutomapCellId(synthTable, 1, 20, 0, 0)).toThrow()
    expect(() => getAutomapCellId(synthTable, 1, 0, -2, 0)).toThrow()
  })

  it('implements the 49-entry priority weight table (0x6fba1528) and deduplicates overlapping cells', () => {
    expect(AUTOMAP_CELL_WEIGHT_PAIRS).toHaveLength(49)
    expect(getAutomapCellWeight(0)).toBe(0)
    expect(getAutomapCellWeight(3)).toBe(0)
    expect(getAutomapCellWeight(6)).toBe(1)
    expect(getAutomapCellWeight(11)).toBe(2)
    expect(getAutomapCellWeight(13)).toBe(3)
    expect(getAutomapCellWeight(20)).toBe(4)
    expect(getAutomapCellWeight(38)).toBe(4)
    expect(getAutomapCellWeight(120)).toBe(10)
    expect(getAutomapCellWeight(171)).toBe(10)
    expect(getAutomapCellWeight(533)).toBe(17)
    expect(getAutomapCellWeight(534)).toBe(17)
    expect(getAutomapCellWeight(405)).toBe(-1)
    expect(getAutomapCellWeight(-1)).toBe(-1)
    expect(getAutomapCellWeight(3000)).toBe(-1)

    const deduped = deduplicateAutomapCells([
      { cellNo: 11, xPixel: 16, yPixel: 8, cellX: 2, cellY: 0 }, // weight 2
      { cellNo: 120, xPixel: 16, yPixel: 8, cellX: 2, cellY: 0 }, // weight 10 -> wins over 11
      { cellNo: 169, xPixel: 16, yPixel: 8, cellX: 2, cellY: 0 }, // weight 10 -> equal weight, 120 stays
      { cellNo: 99, xPixel: 32, yPixel: 16, cellX: 4, cellY: 0 }, // weight -1
      { cellNo: 305, xPixel: 32, yPixel: 16, cellX: 4, cellY: 0 }, // special warp icon 305 beats unweighted 99
    ])

    expect(deduped).toHaveLength(2)
    expect(deduped[0]?.cellNo).toBe(120)
    expect(deduped[0]?.weight).toBe(10)
    expect(deduped[1]?.cellNo).toBe(305)
  })

  it('computes exact tile (0x6fb11880) and object (0x6fb11780) automap pixel coordinates', () => {
    // Normal floor/wall (tileType < 16)
    expect(computeAutomapTilePixelCoords(10, 4, 0)).toEqual({
      xPixel: (10 - 4) * 8,
      yPixel: (10 + 4) * 4,
    })
    // Lower walls (tileType >= 16: ld, rd, fd, fi) add +24 to yPixel
    expect(computeAutomapTilePixelCoords(10, 4, 16)).toEqual({
      xPixel: (10 - 4) * 8,
      yPixel: (10 + 4) * 4 + 24,
    })
    expect(computeAutomapTilePixelCoords(10, 4, 19)).toEqual({
      xPixel: (10 - 4) * 8,
      yPixel: (10 + 4) * 4 + 24,
    })

    // Object pixel coordinates at subtile (50, 20):
    // xClient = 30 * 16 = 480 -> 480 / 10 + 1 = 49
    // yClient = 70 * 8 = 560 -> 560 / 10 - 3 = 53
    expect(computeAutomapObjectPixelCoords(50, 20)).toEqual({
      xPixel: 49,
      yPixel: 53,
    })
  })

  it('applies all 1.13c tile, object, and monster automap overrides accurately', () => {
    const table = parseAutomapTable(rawAutomapBytes)

    // 1. Hidden wall bit 0 filter (tileType !== 0 && (flags & 1) !== 0 -> -1)
    expect(
      resolveTileAutomapCellId(table, {
        levelId: 1,
        levelTypeId: 1,
        tileType: 1,
        style: 0,
        sequence: 0,
        flags: 1,
      }),
    ).toBe(-1)
    // Floor tile (tileType === 0) is NOT suppressed by bit 0
    expect(
      resolveTileAutomapCellId(table, {
        levelId: 2,
        levelTypeId: 2,
        tileType: 0,
        style: 8,
        sequence: 0,
        flags: 1,
      }),
    ).toBe(405)

    // 2. Rogue Campfire in Level 2 (style === 8): seq 0 -> 405, seq > 0 -> -1
    expect(
      resolveTileAutomapCellId(table, {
        levelId: 2,
        levelTypeId: 2,
        tileType: 1,
        style: 8,
        sequence: 0,
      }),
    ).toBe(405)
    expect(
      resolveTileAutomapCellId(table, {
        levelId: 2,
        levelTypeId: 2,
        tileType: 1,
        style: 8,
        sequence: 1,
      }),
    ).toBe(-1)

    // 3. Act 2 Palace Cellar in Level 40 (tileType === 8, style === 25): seq 0 -> 305, seq > 0 -> -1
    expect(
      resolveTileAutomapCellId(table, {
        levelId: 40,
        levelTypeId: 12,
        tileType: 8,
        style: 25,
        sequence: 0,
      }),
    ).toBe(305)
    expect(
      resolveTileAutomapCellId(table, {
        levelId: 40,
        levelTypeId: 12,
        tileType: 8,
        style: 25,
        sequence: 2,
      }),
    ).toBe(-1)

    // 4. Object overrides (0x6fb11d00 & 0x6fb10c40)
    expect(resolveObjectAutomapCellId({ objectClassId: 267, autoMapCol: 0 })).toBe(319)
    expect(resolveObjectAutomapCellId({ objectClassId: 26, autoMapCol: 0 })).toBe(267)
    expect(resolveObjectAutomapCellId({ objectClassId: 59, autoMapCol: 0 })).toBe(306)
    expect(resolveObjectAutomapCellId({ objectClassId: 60, autoMapCol: 0, levelId: 4, mode: 0 })).toBe(-1)
    expect(resolveObjectAutomapCellId({ objectClassId: 60, autoMapCol: 0, levelId: 4, mode: 2 })).toBe(300)
    expect(resolveObjectAutomapCellId({ objectClassId: 60, autoMapCol: 0, levelId: 39, mode: 2 })).toBe(306)
    expect(resolveObjectAutomapCellId({ objectClassId: 268, autoMapCol: 0 })).toBe(309)
    expect(resolveObjectAutomapCellId({ objectClassId: 405, autoMapCol: 0 })).toBe(319)
    expect(resolveObjectAutomapCellId({ objectClassId: 406, autoMapCol: 0 })).toBe(319)
    expect(resolveObjectAutomapCellId({ objectClassId: 407, autoMapCol: 0 })).toBe(319)
    expect(resolveObjectAutomapCellId({ objectClassId: 366, autoMapCol: 308, mode: 2 })).toBe(308)
    expect(resolveObjectAutomapCellId({ objectClassId: 402, autoMapCol: 307, levelId: 74 })).toBe(307)
    expect(resolveObjectAutomapCellId({ objectClassId: 402, autoMapCol: 0, levelId: 74 })).toBe(307)
    expect(resolveObjectAutomapCellId({ objectClassId: 402, autoMapCol: 307, levelId: 46 })).toBe(-1)
    expect(resolveObjectAutomapCellId({ objectClassId: 402, autoMapCol: 307, levelId: 75 })).toBe(-1)
    expect(resolveObjectAutomapCellId({ objectClassId: 119, autoMapCol: 0 })).toBe(-1)
    expect(resolveObjectAutomapCellId({ objectClassId: 1, autoMapCol: 0 })).toBe(-1)

    // 5. Monster overrides (0x6fb11dfd & 0x6fb10ef0)
    for (const cainId of [146, 254, 265, 266, 473, 532, 540]) {
      expect(resolveMonsterAutomapCellId({ monsterClassId: cainId, automapCel: 0, noMap: true })).toBe(267)
    }
    expect(resolveMonsterAutomapCellId({ monsterClassId: 146, automapCel: 267, isAlive: false })).toBe(-1)
    expect(resolveMonsterAutomapCellId({ monsterClassId: 150, automapCel: 280, noMap: false })).toBe(280)
    expect(resolveMonsterAutomapCellId({ monsterClassId: 150, automapCel: 280, noMap: true })).toBe(-1)
  })

  it('generates pre-baked town extras (0x6fb12760) for Act 2 (40), Act 4 (103), and Act 5 (109)', () => {
    // Act 2 North gate (pickedFile = 0 -> frames 20..39 minus skip list [20, 25, 30, 35, 36, 39] = 14 frames)
    const act2North = generateTownSavedExtras(40, 40, 40, 0)
    expect(act2North).toHaveLength(14)
    expect(act2North.map(c => c.cellNo)).toEqual([
      21, 22, 23, 24, 26, 27, 28, 29, 31, 32, 33, 34, 37, 38,
    ])
    expect(act2North.every(c => c.fSaved === 1)).toBe(true)

    // Act 2 West gate (pickedFile = 1 -> frames 0..19 minus skip list [0, 10, 15, 16, 19] = 15 frames)
    const act2West = generateTownSavedExtras(40, 40, 40, 1)
    expect(act2West).toHaveLength(15)
    expect(act2West.map(c => c.cellNo)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 17, 18,
    ])
    expect(act2West.every(c => c.fSaved === 1)).toBe(true)

    const act4 = generateTownSavedExtras(103, 24, 24)
    expect(act4).toHaveLength(4)
    expect(act4.map(c => c.cellNo)).toEqual([0, 1, 2, 3])
    expect(act4.every(c => c.fSaved === 2)).toBe(true)

    const act5 = generateTownSavedExtras(109, 40, 40)
    expect(act5).toHaveLength(6)
    expect(act5.map(c => c.cellNo)).toEqual([0, 1, 2, 3, 4, 5])
    expect(act5.every(c => c.fSaved === 3)).toBe(true)

    expect(generateTownSavedExtras(1)).toEqual([])
  })

  it('computes the 12-segment closed isometric X crosshair polygon (0x6fb0f1c0 & 0x6fb82de8)', () => {
    expect(AUTOMAP_CROSSHAIR_VERTICES).toHaveLength(13)
    expect(AUTOMAP_CROSSHAIR_SCALED_VERTICES).toHaveLength(13)
    expect(AUTOMAP_CROSSHAIR_SCALED_VERTICES[0]).toEqual([0, -2])
    expect(AUTOMAP_CROSSHAIR_SCALED_VERTICES[12]).toEqual([0, -2])

    const fullSegs = getCrosshairSegments(400, 276, false)
    expect(fullSegs).toHaveLength(12)
    expect(fullSegs[0]).toEqual({ x0: 400, y0: 274, x1: 404, y1: 272 })
    expect(fullSegs[11]).toEqual({ x0: 396, y0: 272, x1: 400, y1: 274 })

    // Minimap applies (-1, +5) center shift
    const miniSegs = getCrosshairSegments(400, 276, true)
    expect(miniSegs).toHaveLength(12)
    expect(miniSegs[0]).toEqual({ x0: 399, y0: 279, x1: 403, y1: 277 })
  })
})
