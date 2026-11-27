import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import {
  loadActTables,
  resolveLevel,
  resolveLevelLibraries,
  UNIVERSAL_DT1S,
} from '../src/common/world/acts.ts'
import type { ActTables, D2Table } from '../src/common/world/acts.ts'
import { buildIsoMapScene } from '../src/common/world/d2map.ts'
import type { Ds1, Ds1Cell } from '../src/common/formats/ds1.ts'
import { decodeDt1 } from '../src/common/formats/dt1.ts'
import type { Dt1, Dt1Tile } from '../src/common/formats/dt1.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'

function createMockTables(): ActTables {
  const emptyTable: D2Table = { header: [], rows: [] }
  const levels: D2Table = {
    header: ['Id', 'Name', 'Pal', 'LevelType', 'DrlgType', 'SizeX', 'SizeY', 'Act', 'Waypoint', 'Position', 'Portal'],
    rows: [
      ['1', 'Act 1 - Town', '0', '1', '2', '56', '40', '0', '255', '0', '0'],
      ['79', 'Act 3 - Kurast 1', '2', '22', '3', '100', '100', '2', '79', '0', '0'],
      ['125', 'Act 5 - Hell 1', '4', '35', '1', '80', '80', '4', '255', '0', '0'],
      ['135', 'Act 5 - Pandemonium 3', '4', '35', '1', '80', '80', '4', '255', '0', '0'],
    ],
  }
  const lvltypes: D2Table = {
    header: ['Id', 'Name', 'File 1', 'File 2'],
    rows: [
      ['1', 'Act 1 - Town', 'Act1/Town/Floor.dt1', 'Act1/Town/Walls.dt1'],
      ['22', 'Act 3 - Jungle', 'Act3/Jungle/Floor.dt1', 'Act3/Jungle/Tree.dt1'],
      ['35', 'Act 5 - Lava', 'Act4/Lava/Floor.dt1', 'Act4/Lava/Walls.dt1'],
    ],
  }
  const lvlprest: D2Table = {
    header: ['Def', 'LevelId', 'File1', 'Dt1Mask', 'Animate'],
    rows: [
      ['1', '1', 'TownN1.ds1', '3', '80'],
    ],
  }
  return {
    levels,
    lvltypes,
    lvlprest,
    monstats: emptyTable,
    monpreset: emptyTable,
    monstats2: emptyTable,
    monlvl: emptyTable,
    montype: emptyTable,
    monumod: emptyTable,
    superuniques: emptyTable,
    lvlwarp: emptyTable,
  }
}

function makeSingleTileDs1(style: number, sequence: number, prop1 = 1): Ds1 {
  const width = 35
  const height = 25
  const cells: Ds1Cell[][] = []
  for (let y = 0; y < height; y += 1) {
    const row: Ds1Cell[] = []
    for (let x = 0; x < width; x += 1) {
      if (x === 30 && y === 18) {
        row.push({
          walls: [],
          floors: [{ prop1, style, sequence, unknown1: 0, unknown2: 0, hidden: false }],
          shadows: [],
          substitutions: [],
        })
      } else {
        row.push({ walls: [], floors: [], shadows: [], substitutions: [] })
      }
    }
    cells.push(row)
  }
  return {
    version: 18,
    width,
    height,
    act: 5,
    substitutionType: 0,
    wallLayers: 0,
    floorLayers: 1,
    cells,
    objects: [],
    npcPathOffset: null,
  }
}

function createMockInvisWalDt1(): Dt1 {
  const dummyFlags = Array.from({ length: 25 }, () => ({
    blockWalk: true,
    blockLos: false,
    blockJump: false,
    blockPlayerWalk: false,
    blockLight: false,
    raw: 1,
  }))
  const mockTile: Dt1Tile = {
    direction: 0,
    height: -80,
    width: 160,
    type: 0, // Floor
    style: 49,
    sequence: 7,
    materialFlags: 0,
    roofHeight: 0,
    animated: 0,
    rarityFrameIndex: 0,
    subTileFlags: dummyFlags,
    minBlockY: 0,
    bitmapHeight: 80,
    blocks: [],
  }
  return {
    versionMajor: 7,
    versionMinor: 6,
    warnings: [],
    tiles: [mockTile],
  }
}

describe('Blizzard 1.13c DRLGROOM_LoadDt1Files Universal DT1s (Issue #112)', () => {
  it('exports UNIVERSAL_DT1S with exact Blizzard paths and casing', () => {
    expect(UNIVERSAL_DT1S).toEqual([
      'data\\global\\tiles\\Act1\\Outdoors\\Blank.dt1',
      'data\\global\\tiles\\Act1\\Barracks\\InvisWal.dt1',
      'data\\global\\tiles\\Act1\\Barracks\\Warp.dt1',
    ])
  })

  it('unconditionally appends universal DT1s in resolveLevelLibraries for all test levels', () => {
    const mockTables = createMockTables()
    for (const levelId of [1, 79, 125, 135]) {
      const { dt1Names } = resolveLevelLibraries(mockTables, levelId)
      expect(dt1Names).toContain('data\\global\\tiles\\Act1\\Outdoors\\Blank.dt1')
      expect(dt1Names).toContain('data\\global\\tiles\\Act1\\Barracks\\InvisWal.dt1')
      expect(dt1Names).toContain('data\\global\\tiles\\Act1\\Barracks\\Warp.dt1')
    }
  })

  it('unconditionally appends universal DT1s in resolveLevel', () => {
    const mockTables = createMockTables()
    const levelInfo = resolveLevel(mockTables, 1)
    expect(levelInfo.dt1Names).toContain('data\\global\\tiles\\Act1\\Outdoors\\Blank.dt1')
    expect(levelInfo.dt1Names).toContain('data\\global\\tiles\\Act1\\Barracks\\InvisWal.dt1')
    expect(levelInfo.dt1Names).toContain('data\\global\\tiles\\Act1\\Barracks\\Warp.dt1')
  })

  it('recognizes floor style=49 sequence=7 when InvisWal.dt1 is in the pool and flags missing without it', () => {
    const ds1 = makeSingleTileDs1(49, 7)
    const sceneWithout = buildIsoMapScene(ds1, [])
    expect(sceneWithout.missingTiles).toBe(1)
    expect(sceneWithout.missingRefs[0]).toContain('floor style=49 sequence=7:0 @cell(30,18)')

    const mockDt1 = createMockInvisWalDt1()
    const sceneWith = buildIsoMapScene(ds1, [mockDt1])
    expect(sceneWith.missingTiles).toBe(0)
    expect(sceneWith.floors).toHaveLength(1)
    expect(sceneWith.floors[0]!.cellX).toBe(30)
    expect(sceneWith.floors[0]!.cellY).toBe(18)
  })

  const hasRealData = fs.existsSync('samples/d2/d2data.mpq')
  it.runIf(hasRealData)('verifies real MPQ tables and InvisWal.dt1 decoding on levels 1, 79, 125, 135', async () => {
    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      try {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      } catch {}
    }
    const realTables = await loadActTables(archives)

    for (const levelId of [1, 79, 125, 135]) {
      const { dt1Names } = resolveLevelLibraries(realTables, levelId)
      expect(dt1Names).toContain('data\\global\\tiles\\Act1\\Outdoors\\Blank.dt1')
      expect(dt1Names).toContain('data\\global\\tiles\\Act1\\Barracks\\InvisWal.dt1')
      expect(dt1Names).toContain('data\\global\\tiles\\Act1\\Barracks\\Warp.dt1')
    }

    // Decode real InvisWal.dt1 from MPQ and ensure style=49 sequence=7 floor tile is present
    const invisWalBytes = await archives.read('data\\global\\tiles\\Act1\\Barracks\\InvisWal.dt1')
    const realInvisWal = decodeDt1(invisWalBytes)
    const match = realInvisWal.tiles.find(t => t.type === 0 && t.style === 49 && t.sequence === 7)
    expect(match).toBeDefined()
    expect(match?.style).toBe(49)
    expect(match?.sequence).toBe(7)

    // Build scene with real InvisWal.dt1
    const ds1 = makeSingleTileDs1(49, 7)
    const scene = buildIsoMapScene(ds1, [realInvisWal])
    expect(scene.missingTiles).toBe(0)
    expect(scene.floors).toHaveLength(1)
  })
})
