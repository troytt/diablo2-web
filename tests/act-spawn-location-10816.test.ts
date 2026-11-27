/**
 * #1698 / #1693: 1.13c DUNGEON_FindActSpawnLocationEx (D2Common #10816 0x6FD8CDF0) port.
 *
 * - sub_6FD69B60 tile-info pick with the 0x6FDE4F48 group table and the level seed;
 * - COLLISION_GetFreeCoordinates (0x6FD9D140) ring scan order and |dx|+|dy| tie rule;
 * - real DRLG towns (samples/d2): every town saves a style-33 (index 11) marker and the town-portal
 *   mouth resolves onto it, replacing the deleted per-variant table.
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  ACT_SPAWN_TILE_ENTRY,
  ACT_SPAWN_TILE_TOWN_PORTAL,
  collisionGetFreeCoordinates,
  findActSpawnLocationSubTile,
  findActSpawnLocationTile,
  pickTileInfoRecord,
  TILE_INFO_GROUPS_113C,
  type ActSpawnLevelData,
} from '../src/common/world/act-spawn-location.ts'
import { SEED_RollLimitedRandomNumber } from '../src/common/rng/d2-rng.ts'
import { createDrlgActSession } from '../src/common/drlg/drlg-dump.ts'
import { drlgLevelInputFromSession } from '../src/common/drlg/drlg-map.ts'
import { createDrlgEnv } from '../src/common/drlg/drlg-source.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { loadDrlgMpqData, type DrlgMpqData } from '../src/baker/io/drlg-mpq-source.ts'
import { createActSpawnLocator } from '../src/server/world/area-bootstrap.ts'
import type { LocalAreaLevelGeometry } from '../src/netproto/index.ts'

const ARCHIVE_DIR = resolve(import.meta.dirname, '../samples/d2')
const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const
const hasMpq = MOUNTS.every(name => existsSync(join(ARCHIVE_DIR, name)))

function level(overrides: Partial<ActSpawnLevelData>): ActSpawnLevelData {
  return {
    position: 1,
    tileInfo: [],
    rooms: [{ x: 0, y: 0, w: 40, h: 40 }],
    waypointRoom: -1,
    waypointTile: null,
    warpRoom: -1,
    centreX: 18,
    centreY: 18,
    ...overrides,
  }
}

describe('sub_6FD69B60 tile-info pick (#1693 / #1698)', () => {
  it('uses the .rdata 0x6FDE4F48 group table', () => {
    expect(TILE_INFO_GROUPS_113C).toHaveLength(14)
    expect(TILE_INFO_GROUPS_113C[0]).toEqual([1, 0])
    expect(TILE_INFO_GROUPS_113C[6]).toEqual([1, 1])
    expect(TILE_INFO_GROUPS_113C[11]).toEqual([0, 3])
  })

  it('rolls the level seed even for a single match and picks 1 + rand % count', () => {
    const tileInfo = [
      { x: 1, y: 1, index: 0 },
      { x: 2, y: 2, index: 11 },
      { x: 3, y: 3, index: 3 },
      { x: 4, y: 4, index: 5 },
    ]
    const seed = { lo: 0x1234, hi: 0x5678 }
    expect(pickTileInfoRecord(tileInfo, 11, seed)).toEqual({ x: 2, y: 2, index: 11 })
    expect(seed).not.toEqual({ lo: 0x1234, hi: 0x5678 })

    // index 0 matches every group-0 record (0, 3, 5): pick = 1 + roll(3).
    for (let s = 1; s < 40; s += 1) {
      const a = { lo: s, hi: 7 }
      const b = { lo: s, hi: 7 }
      const k = SEED_RollLimitedRandomNumber(b, 3)
      const expected = [tileInfo[0], tileInfo[2], tileInfo[3]][k]
      expect(pickTileInfoRecord(tileInfo, 0, a)).toEqual(expected)
      expect(a).toEqual(b)
    }
  })

  it('no match leaves the counter at 0 and selects record 0 without rolling', () => {
    const seed = { lo: 9, hi: 9 }
    expect(pickTileInfoRecord([{ x: 7, y: 8, index: 11 }], 10, seed)).toEqual({ x: 7, y: 8, index: 11 })
    expect(seed).toEqual({ lo: 9, hi: 9 })
  })

  it('Position == 0 levels use the waypoint, then the warp room centre, then the room holding the level centre', () => {
    const rooms = [{ x: 0, y: 0, w: 8, h: 8 }, { x: 8, y: 0, w: 16, h: 8 }, { x: 0, y: 8, w: 40, h: 40 }]
    const seed = { lo: 1, hi: 2 }
    expect(findActSpawnLocationTile(level({ position: 0, rooms, waypointRoom: 1, waypointTile: { x: 12, y: 3 } }), 0, seed))
      .toEqual({ x: 12, y: 3 })
    expect(findActSpawnLocationTile(level({ position: 0, rooms, waypointRoom: 1 }), 0, seed)).toEqual({ x: 16, y: 4 })
    expect(findActSpawnLocationTile(level({ position: 0, rooms, warpRoom: 0 }), 0, seed)).toEqual({ x: 4, y: 4 })
    expect(findActSpawnLocationTile(level({ position: 0, rooms, centreX: 18, centreY: 18 }), 0, seed)).toEqual({ x: 20, y: 28 })
    expect(seed).toEqual({ lo: 1, hi: 2 })
  })
})

describe('COLLISION_GetFreeCoordinates 0x6FD9D140 (#1693 / #1698)', () => {
  it('returns the start cell when free', () => {
    expect(collisionGetFreeCoordinates(() => true, 5, 5)).toEqual({ x: 5, y: 5 })
  })

  it('scans ring columns first (left before right, top to bottom) and keeps the first smallest |dx|+|dy|', () => {
    const visited: string[] = []
    collisionGetFreeCoordinates((x, y) => {
      visited.push(`${String(x - 10)},${String(y - 10)}`)
      return false
    }, 10, 10, 3)
    expect(visited.slice(0, 1 + 8)).toEqual([
      '0,0',
      '-1,-1', '1,-1', '-1,0', '1,0', '-1,1', '1,1',
      '0,-1', '0,1',
    ])
    // Ring 2 starts with the columns x = -2 / +2.
    expect(visited.slice(9, 13)).toEqual(['-2,-2', '2,-2', '-2,-1', '2,-1'])
    // All 8 cells of ring 1 free -> (-1,0) wins: first with metric 1 in scan order.
    expect(collisionGetFreeCoordinates((x, y) => !(x === 10 && y === 10), 10, 10)).toEqual({ x: 9, y: 10 })
    // Only corners free -> first corner (-1,-1).
    expect(collisionGetFreeCoordinates((x, y) => Math.abs(x - 10) === 1 && Math.abs(y - 10) === 1, 10, 10))
      .toEqual({ x: 9, y: 9 })
  })

  it('returns null when nothing within the radius is free', () => {
    expect(collisionGetFreeCoordinates(() => false, 0, 0, 5)).toBeNull()
  })

  it('#10816 converts the tile to sub-tile *5+3 and applies the unit-size pattern', () => {
    const data = level({ tileInfo: [{ x: 4, y: 6, index: 11 }] })
    // Only the "+" around (23, 33) blocked at its centre's west neighbour -> size-3 box must move.
    const blocked = (x: number, y: number): boolean => x === 22 && y === 33
    expect(findActSpawnLocationSubTile(data, 11, { lo: 1, hi: 1 }, 1, blocked)).toEqual({ x: 23, y: 33 })
    const moved = findActSpawnLocationSubTile(data, 11, { lo: 1, hi: 1 }, 3, blocked)
    expect(moved).not.toEqual({ x: 23, y: 33 })
    expect(Math.abs(moved.x - 23) + Math.abs(moved.y - 33)).toBe(1)
  })

  it('area bootstrap locator advances its own copy of the level seed on every call', () => {
    const geometry: LocalAreaLevelGeometry = {
      areaId: 1,
      originX: 500,
      originY: 700,
      subWidth: 200,
      subHeight: 200,
      blocked: new Uint8Array(200 * 200),
      spawnTileX: 0,
      spawnTileY: 0,
      rooms: [],
      roomRects: [],
      presetUnits: [],
      warps: [],
      actSpawn: {
        level: level({ tileInfo: [0, 1, 2, 3].map(i => ({ x: 4 + 8 * i, y: 4, index: i })) }),
        seed: [0xdeadbeef, 0x12345678],
      },
    }
    const locate = createActSpawnLocator(geometry)
    const seed = { lo: 0xdeadbeef, hi: 0x12345678 }
    for (let i = 0; i < 12; i += 1) {
      const k = SEED_RollLimitedRandomNumber(seed, 4)
      expect(locate(ACT_SPAWN_TILE_ENTRY, 2)).toEqual({ x: 500 + (4 + 8 * k) * 5 + 3, y: 700 + 23 })
    }
  })
})

describe.skipIf(!hasMpq)('real 1.13c DRLG towns save the #10816 special tiles (#1698)', () => {
  const archives = new MountedArchives()
  beforeAll(async () => {
    for (const name of MOUNTS) archives.add(name, await MpqArchive.open(await fileSource(join(ARCHIVE_DIR, name))))
  }, 120_000)

  const TOWNS: readonly (readonly [act: number, levelId: number])[] = [[0, 1], [1, 40], [2, 75], [3, 103], [4, 109]]
  for (const [act, levelId] of TOWNS) {
    it(`town ${String(levelId)}: Position = 1, the town-portal pick follows sub_6FD69B60 on the real tile-info records`, async () => {
      const data: DrlgMpqData = await loadDrlgMpqData(member => archives.read(member), act + 1)
      for (const seed of [0x12345678, 0x5eed0100, 0x0badf00d]) {
        const session = createDrlgActSession(createDrlgEnv(data.source, data.tables), { act, seed })
        const input = drlgLevelInputFromSession(session, levelId)
        const capture = input.actSpawn
        expect(capture).toBeDefined()
        expect(capture!.level.position).toBe(1)
        const records = capture!.level.tileInfo
        expect(records.length).toBeGreaterThan(0)
        for (const nTileIndex of [ACT_SPAWN_TILE_TOWN_PORTAL, ACT_SPAWN_TILE_ENTRY]) {
          const [match, group] = TILE_INFO_GROUPS_113C[nTileIndex]!
          const candidates = records.filter(t =>
            t.index === nTileIndex || (match !== 0 && TILE_INFO_GROUPS_113C[t.index]![1] === group))
          const picked = findActSpawnLocationTile(capture!.level, nTileIndex, {
            lo: capture!.seed[0],
            hi: capture!.seed[1],
          })
          // No matching record (e.g. Harrogath has no style-33 marker) -> pTileInfo[0], as in 1.13c.
          const expected = candidates.length > 0 ? candidates : [records[0]!]
          expect(expected.map(t => ({ x: t.x, y: t.y }))).toContainEqual(picked)
          expect(picked.x).toBeGreaterThanOrEqual(0)
          expect(picked.y).toBeGreaterThanOrEqual(0)
          expect(picked.x).toBeLessThan(input.coord.width)
          expect(picked.y).toBeLessThan(input.coord.height)
        }
      }
    }, 120_000)
  }
})
