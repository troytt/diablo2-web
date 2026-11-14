/**
 * Act II outdoor DRLG (#496): structural and gameplay invariants across levels 41-46 over many seeds:
 * - sizes: every Act II outdoor level gets its Levels.txt SizeX/SizeY across 128 layouts;
 * - staff/boss tomb rolls: nStaffTombLevel and nBossTombLevel in 66..72 and distinct;
 * - population: 1 waypoint on levels 42, 43, 44, 46 and 5 shrine cells on levels 41..45;
 * - links & warps: seamless orth links along shared edges of 40 <-> 41 <-> 42 <-> 43 <-> 44 <-> 45,
 *   plus dungeon warps (41 -> 55, 42 -> 56, 43 -> 62, 44 -> 65, 45 -> 58, 46 -> 66..72);
 * - determinism and seed distinctness.
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { dumpAct1, runAct1, type DrlgDump, type DumpCoord } from '../src/common/drlg/drlg-dump.ts'
import { drlgLevelInputFromDump } from '../src/common/drlg/drlg-map.ts'
import { createDrlgEnv } from '../src/common/drlg/drlg-source.ts'
import { DATATBLS_GetLevelDefRecord, objectSubClass } from '../src/common/drlg/drlg-tables.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { loadDrlgMpqData, type DrlgMpqData } from '../src/baker/io/drlg-mpq-source.ts'

const LEVELS = [41, 42, 43, 44, 45, 46]
const ARCHIVE_DIR = resolve(import.meta.dirname, '../samples/d2')
const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const
const hasMpq = MOUNTS.every(name => existsSync(join(ARCHIVE_DIR, name)))

function lcgSeeds(start: number, count: number): number[] {
  const out: number[] = []
  let seed = start
  for (let i = 0; i < count; i += 1) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
    out.push(seed)
  }
  return out
}

const BAKE_SEEDS = [0x5eed0200, 0x5eed0201, 0x5eed0202]
const SEEDS = [0x12345678, ...BAKE_SEEDS, ...lcgSeeds(0x2badf00d, 8)]
const LAYOUT_SEEDS = lcgSeeds(0x13579bdf, 128)

const WAYPOINT_LEVELS = new Set([42, 43, 44, 46])
// Level 46 (Canyon of the Magi) gets its waypoint from its tomb presets in grid 0; 42..44 use grid 1.
const GRID1_WAYPOINT_LEVELS = new Set([42, 43, 44])
// DRLGOUTDESR_InitAct2OutdoorLevel (DrlgOutDesr.cpp): all Act 2 outdoor levels except 45 (Valley of Snakes) and 134 get 5 shrines.
const SHRINE_LEVELS = new Set([41, 42, 43, 44, 46])
const SHRINES_PER_LEVEL = 5
const GRID1_WAYPOINT = 0x30000
const GRID1_SHRINE = 0xf000
const SUBCLASS_WAYPOINT = 0x40
const UNIT_OBJECT = 2

const EXPECTED_WARPS: Readonly<Record<number, readonly number[]>> = {
  41: [55],
  42: [56],
  43: [62],
  44: [65],
  45: [58],
  46: [66, 67, 68, 69, 70, 71, 72],
}

const EXPECTED_ORTHS: Readonly<Record<number, readonly number[]>> = {
  41: [40, 42],
  42: [41, 43],
  43: [42, 44],
  44: [43, 45],
  45: [44],
  46: [],
}

const numeric = (a: number, b: number): number => a - b

function hex(seed: number): string {
  return `0x${seed.toString(16).padStart(8, '0')}`
}

function touchesOnDir(a: DumpCoord, b: DumpCoord, dir: number): boolean {
  const [ax, ay, aw, ah] = a
  const [bx, by, bw, bh] = b
  // ALTDIR_WEST=0, ALTDIR_NORTH=1, ALTDIR_EAST=2, ALTDIR_SOUTH=3
  if (dir === 0 || dir === 2) {
    const touch = dir === 2 ? ax + aw === bx : bx + bw === ax
    return touch && Math.min(ay + ah, by + bh) > Math.max(ay, by)
  }
  const touch = dir === 3 ? ay + ah === by : by + bh === ay
  return touch && Math.min(ax + aw, bx + bw) > Math.max(ax, bx)
}

describe.skipIf(!hasMpq)('Act II outdoor DRLG port: level invariants over many seeds', () => {
  let data: DrlgMpqData

  beforeAll(async () => {
    const archives = new MountedArchives()
    for (const name of MOUNTS) archives.add(name, await MpqArchive.open(await fileSource(join(ARCHIVE_DIR, name))))
    data = await loadDrlgMpqData(member => archives.read(member), 2)
  }, 120_000)

  function generate(seed: number): DrlgDump {
    return dumpAct1(createDrlgEnv(data.source, data.tables), seed, LEVELS, { difficulty: 0, isolated: false })
  }

  it(`sizes every level and rolls distinct staff/boss tombs on ${LAYOUT_SEEDS.length} act layouts`, () => {
    const env = createDrlgEnv(data.source, data.tables)
    for (const seed of LAYOUT_SEEDS) {
      const run = runAct1(env, seed, [], { act: 1 })
      expect(run.pDrlg.nStaffTombLevel).toBeGreaterThanOrEqual(66)
      expect(run.pDrlg.nStaffTombLevel).toBeLessThanOrEqual(72)
      expect(run.pDrlg.nBossTombLevel).toBeGreaterThanOrEqual(66)
      expect(run.pDrlg.nBossTombLevel).toBeLessThanOrEqual(72)
      expect(run.pDrlg.nBossTombLevel).not.toBe(run.pDrlg.nStaffTombLevel)

      const { act } = dumpAct1(env, seed, LEVELS, { actOnly: true })
      for (const levelId of LEVELS) {
        const level = act.find(l => l.id === levelId)
        expect(level, `${hex(seed)}: level ${levelId} is not in the act`).toBeDefined()
        const [, , width, height] = level!.coord
        const def = DATATBLS_GetLevelDefRecord(data.tables, levelId)
        expect([width, height], `${hex(seed)} level ${levelId}`).toEqual([def.dwSizeX[0], def.dwSizeY[0]])
      }
    }
  }, 60_000)

  it('generates the same act from the same seed', () => {
    expect(JSON.stringify(generate(BAKE_SEEDS[0]!))).toBe(JSON.stringify(generate(BAKE_SEEDS[0]!)))
  }, 60_000)

  it('generates a different level from every seed', () => {
    const env = createDrlgEnv(data.source, data.tables)
    const grids = new Map<number, Set<string>>(LEVELS.map(id => [id, new Set<string>()]))
    for (const seed of SEEDS) {
      const dump = dumpAct1(env, seed, LEVELS, { difficulty: 0, isolated: false, skipActivation: true })
      for (const level of dump.levels) grids.get(level.id)!.add(JSON.stringify(level.levelGrid.grids))
    }
    for (const [levelId, distinct] of grids) {
      // Level 45 (Valley of Snakes) is a fixed 4x4 grid (32x32) with only the Claw Viper Temple preset
      // and border links (3 link orientations), whereas 41..44 and 46 are full desert levels.
      if (levelId === 45) {
        expect(distinct.size, `level ${levelId}`).toBeGreaterThanOrEqual(2)
      } else {
        expect(distinct.size, `level ${levelId}`).toBe(SEEDS.length)
      }
    }
  }, 60_000)

  for (const seed of SEEDS) {
    it(`seed ${hex(seed)}: waypoints, shrines, seamless orth links, and dungeon warps`, () => {
      const dump = generate(seed)
      const act = new Map(dump.act.map(l => [l.id, l]))

      for (const levelId of LEVELS) {
        const what = `${hex(seed)} level ${levelId}`
        const levelDump = dump.levels.find(l => l.id === levelId)!
        const input = drlgLevelInputFromDump(dump, levelId, data.tables)
        const layout = act.get(levelId)!.coord

        // Waypoint & shrine cells in grid 1
        const cells = levelDump.levelGrid.grids[1]!.cells
        expect(cells.filter(c => (c & GRID1_WAYPOINT) !== 0).length, `${what}: waypoint cells`).toBe(
          GRID1_WAYPOINT_LEVELS.has(levelId) ? 1 : 0,
        )
        expect(cells.filter(c => (c & GRID1_SHRINE) !== 0).length, `${what}: shrine cells`).toBe(
          SHRINE_LEVELS.has(levelId) ? SHRINES_PER_LEVEL : 0,
        )

        const objects = input.units.filter(
          u => u.type === UNIT_OBJECT && u.index >= 0 && u.index < data.tables.objectSubClass.length,
        )
        const waypoints = objects.filter(u => (objectSubClass(data.tables, u.index) & SUBCLASS_WAYPOINT) !== 0)
        expect(waypoints, `${what}: waypoint objects`).toHaveLength(WAYPOINT_LEVELS.has(levelId) ? 1 : 0)

        // Seamless orth links
        expect(input.orths.map(o => o.level).sort(numeric), `${what}: orth neighbours`).toEqual(
          [...EXPECTED_ORTHS[levelId]!].sort(numeric),
        )
        for (const orth of input.orths) {
          const neighbour = act.get(orth.level)!
          expect(touchesOnDir(layout, neighbour.coord, orth.dir), `${what}: touches ${orth.level} on dir ${orth.dir}`).toBe(
            true,
          )
        }

        // Dungeon warps
        expect([...new Set(input.warps.map(w => w.toLevelId))].sort(numeric), `${what}: warps`).toEqual(
          [...EXPECTED_WARPS[levelId]!].sort(numeric),
        )
      }
    }, 60_000)
  }
})
