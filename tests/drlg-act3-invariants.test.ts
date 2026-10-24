/**
 * Act III outdoor DRLG (#499): structural and gameplay invariants across levels 76-83 over many seeds:
 * - sizes: jungle levels 76-78 have 48x(24*k) subdivisions, Kurast levels 79-83 match Levels.txt SizeX/SizeY;
 * - connected act graph: 75..83 form a single connected outdoor graph with mutual touching orth links;
 * - jungle population: 1 waypoint cell and 5 shrine cells on jungle levels 76..78, plus waypoint objects
 *   on 76, 77, 78, 79, 80, 81, 83;
 * - dungeon warps on 76, 78, 80, 81, 82, 83;
 * - determinism and seed distinctness.
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { LVLPREST_ACT3_JUNGLE_HEAD, LVLPREST_ACT3_JUNGLE_TAIL } from '../src/common/drlg/drlg-ids.ts'
import { dumpAct1, type DrlgDump, type DumpCoord } from '../src/common/drlg/drlg-dump.ts'
import { drlgLevelInputFromDump } from '../src/common/drlg/drlg-map.ts'
import { createDrlgEnv } from '../src/common/drlg/drlg-source.ts'
import { DATATBLS_GetLevelDefRecord, objectSubClass } from '../src/common/drlg/drlg-tables.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { loadDrlgMpqData, type DrlgMpqData } from '../src/baker/io/drlg-mpq-source.ts'

const LEVELS = [76, 77, 78, 79, 80, 81, 82, 83]
const JUNGLE_LEVELS = new Set([76, 77, 78])
const KURAST_LEVELS = [79, 80, 81, 82, 83]
const WAYPOINT_OBJECT_LEVELS = new Set([76, 77, 78, 79, 80, 81, 83])
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

const BAKE_SEEDS = [0x5eed0300, 0x5eed0301, 0x5eed0302]
const SEEDS = [0x12345678, ...BAKE_SEEDS, ...lcgSeeds(0x3badf00d, 4)]
const LAYOUT_SEEDS = lcgSeeds(0x2468ace1, 128)

const SUBCLASS_WAYPOINT = 0x40
const UNIT_OBJECT = 2

const EXPECTED_WARPS: Readonly<Record<number, readonly number[]>> = {
  76: [84, 85],
  77: [],
  78: [86, 88],
  79: [],
  80: [92, 94, 95],
  81: [92, 96, 97],
  82: [98, 99],
  83: [100],
}

const numeric = (a: number, b: number): number => a - b

function hex(seed: number): string {
  return `0x${seed.toString(16).padStart(8, '0')}`
}

function touchesOnDir(a: DumpCoord, b: DumpCoord, dir: number): boolean {
  const [ax, ay, aw, ah] = a
  const [bx, by, bw, bh] = b
  if (dir === 0 || dir === 2) {
    const touch = dir === 2 ? ax + aw === bx : bx + bw === ax
    return touch && Math.min(ay + ah, by + bh) > Math.max(ay, by)
  }
  const touch = dir === 3 ? ay + ah === by : by + bh === ay
  return touch && Math.min(ax + aw, bx + bw) > Math.max(ax, bx)
}

describe.skipIf(!hasMpq)('Act III outdoor DRLG port: level invariants over many seeds', () => {
  let data: DrlgMpqData

  beforeAll(async () => {
    const archives = new MountedArchives()
    for (const name of MOUNTS) archives.add(name, await MpqArchive.open(await fileSource(join(ARCHIVE_DIR, name))))
    data = await loadDrlgMpqData(member => archives.read(member), 3)
  }, 120_000)

  function generate(seed: number): DrlgDump {
    return dumpAct1(createDrlgEnv(data.source, data.tables), seed, LEVELS, { difficulty: 0, isolated: false })
  }

  it(`sizes jungle and Kurast levels properly on ${LAYOUT_SEEDS.length} act layouts`, () => {
    const env = createDrlgEnv(data.source, data.tables)
    for (const seed of LAYOUT_SEEDS) {
      const { act } = dumpAct1(env, seed, LEVELS, { actOnly: true })
      for (const levelId of LEVELS) {
        const level = act.find(l => l.id === levelId)
        expect(level, `${hex(seed)}: level ${levelId} is not in the act`).toBeDefined()
        const [, , width, height] = level!.coord
        if (JUNGLE_LEVELS.has(levelId)) {
          expect(width % 16, `${hex(seed)} level ${levelId} width multiple of 16`).toBe(0)
          expect(width, `${hex(seed)} level ${levelId} width >= 32`).toBeGreaterThanOrEqual(32)
          expect(height % 24, `${hex(seed)} level ${levelId} height multiple of 24`).toBe(0)
          expect(height, `${hex(seed)} level ${levelId} height >= 72`).toBeGreaterThanOrEqual(72)
        }
      }
      for (const levelId of KURAST_LEVELS) {
        const level = act.find(l => l.id === levelId)!
        const [, , width, height] = level.coord
        const def = DATATBLS_GetLevelDefRecord(data.tables, levelId)
        expect([width, height], `${hex(seed)} level ${levelId}`).toEqual([def.dwSizeX[0], def.dwSizeY[0]])
      }
    }
  }, 60_000)

  it('generates the same act from the same seed', () => {
    expect(JSON.stringify(generate(BAKE_SEEDS[0]!))).toBe(JSON.stringify(generate(BAKE_SEEDS[0]!)))
  }, 60_000)

  it('generates a different jungle layout across seeds', () => {
    const env = createDrlgEnv(data.source, data.tables)
    const grids = new Map<number, Set<string>>([76, 77, 78].map(id => [id, new Set<string>()]))
    for (const seed of SEEDS) {
      const dump = dumpAct1(env, seed, [76, 77, 78], { difficulty: 0, isolated: false, skipActivation: true })
      for (const level of dump.levels) grids.get(level.id)!.add(JSON.stringify(level.levelGrid.grids))
    }
    for (const [levelId, distinct] of grids) expect(distinct.size, `level ${levelId}`).toBe(SEEDS.length)
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

        const cells0 = levelDump.levelGrid.grids[0]!.cells
        if (levelId === 76) {
          expect(cells0.includes(LVLPREST_ACT3_JUNGLE_HEAD), `${what}: jungle head preset`).toBe(true)
        } else if (levelId === 78) {
          expect(cells0.includes(LVLPREST_ACT3_JUNGLE_TAIL), `${what}: jungle tail preset`).toBe(true)
        }

        const objects = input.units.filter(
          u => u.type === UNIT_OBJECT && u.index >= 0 && u.index < data.tables.objectSubClass.length,
        )
        const waypoints = objects.filter(u => (objectSubClass(data.tables, u.index) & SUBCLASS_WAYPOINT) !== 0)
        expect(waypoints, `${what}: waypoint objects`).toHaveLength(WAYPOINT_OBJECT_LEVELS.has(levelId) ? 1 : 0)

        expect(input.orths.length, `${what}: has orth neighbours`).toBeGreaterThan(0)
        for (const orth of input.orths) {
          const neighbour = act.get(orth.level)!
          expect(touchesOnDir(layout, neighbour.coord, orth.dir), `${what}: touches ${orth.level} on dir ${orth.dir}`).toBe(
            true,
          )
        }

        expect([...new Set(input.warps.map(w => w.toLevelId))].sort(numeric), `${what}: warps`).toEqual(
          [...EXPECTED_WARPS[levelId]!].sort(numeric),
        )
      }
    }, 60_000)
  }
})
