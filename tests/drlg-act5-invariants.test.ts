/**
 * Act V outdoor DRLG (#498): structural and gameplay invariants across levels 110-112,117,134 over many seeds:
 * - sizes: 110-112 match Levels.txt SizeX/SizeY across 128 act layouts, 117/134 match Levels.txt SizeX/SizeY;
 * - waypoints: 1 waypoint object on levels 111, 112, 117;
 * - links & warps: seamless orth links along shared edges of 109 <-> 110 <-> 111 <-> 112,
 *   plus dungeon warps (111 -> 113,125; 112 -> 115,126; 117 -> 118,127);
 * - determinism and seed distinctness (including Level 134 Forgotten Sands routed via Act II desert DRLG).
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  LVLPREST_ACT5_BARRICADE_HELL_PORTAL_N,
  LVLPREST_ACT5_BARRICADE_HELL_PORTAL_W,
} from '../src/common/drlg/drlg-ids.ts'
import { dumpAct1, type DrlgDump, type DumpCoord } from '../src/common/drlg/drlg-dump.ts'
import { drlgLevelInputFromDump } from '../src/common/drlg/drlg-map.ts'
import { createDrlgEnv } from '../src/common/drlg/drlg-source.ts'
import { DATATBLS_GetLevelDefRecord, objectSubClass } from '../src/common/drlg/drlg-tables.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { loadDrlgMpqData, type DrlgMpqData } from '../src/baker/io/drlg-mpq-source.ts'

const LEVELS = [110, 111, 112, 117, 134]
const ACT_OUTDOOR_LEVELS = [110, 111, 112]
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

const BAKE_SEEDS = [0x5eed0500, 0x5eed0501, 0x5eed0502]
const SEEDS = [0x12345678, ...BAKE_SEEDS, ...lcgSeeds(0x5badf00d, 4)]
const LAYOUT_SEEDS = lcgSeeds(0x468ace13, 128)

const BARRICADE_LEVELS = new Set([111, 112, 117])
const WAYPOINT_LEVELS = new Set([111, 112, 117, 134])
const SUBCLASS_WAYPOINT = 0x40
const UNIT_OBJECT = 2

const EXPECTED_WARPS: Readonly<Record<number, readonly number[]>> = {
  110: [],
  111: [],
  112: [113],
  117: [115, 118],
  134: [],
}

const EXPECTED_ORTHS: Readonly<Record<number, readonly number[]>> = {
  110: [],
  111: [112],
  112: [111],
  117: [],
  134: [],
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

describe.skipIf(!hasMpq)('Act V outdoor DRLG port: level invariants over many seeds', () => {
  let data: DrlgMpqData

  beforeAll(async () => {
    const archives = new MountedArchives()
    for (const name of MOUNTS) archives.add(name, await MpqArchive.open(await fileSource(join(ARCHIVE_DIR, name))))
    data = await loadDrlgMpqData(member => archives.read(member), 5)
  }, 120_000)

  function generate(seed: number): DrlgDump {
    return dumpAct1(createDrlgEnv(data.source, data.tables), seed, LEVELS, { difficulty: 0, isolated: false })
  }

  it(`sizes every Act V outdoor level properly on ${LAYOUT_SEEDS.length} act layouts`, () => {
    const env = createDrlgEnv(data.source, data.tables)
    for (const seed of LAYOUT_SEEDS) {
      const { act } = dumpAct1(env, seed, ACT_OUTDOOR_LEVELS, { actOnly: true })
      for (const levelId of ACT_OUTDOOR_LEVELS) {
        const level = act.find(l => l.id === levelId)
        expect(level, `${hex(seed)}: level ${levelId} is not in the act`).toBeDefined()
        const [, , width, height] = level!.coord
        if (BARRICADE_LEVELS.has(levelId)) {
          expect([width, height].sort(numeric), `${hex(seed)} level ${levelId}`).toEqual([64, 160])
        } else {
          const def = DATATBLS_GetLevelDefRecord(data.tables, levelId)
          expect([width, height], `${hex(seed)} level ${levelId}`).toEqual([def.dwSizeX[0], def.dwSizeY[0]])
        }
      }
    }
  }, 60_000)

  it('generates the same act from the same seed', () => {
    expect(JSON.stringify(generate(BAKE_SEEDS[0]!))).toBe(JSON.stringify(generate(BAKE_SEEDS[0]!)))
  }, 60_000)

  it('generates a different outdoor layout across seeds', () => {
    const env = createDrlgEnv(data.source, data.tables)
    const variedLevels = [111, 112, 117, 134]
    const grids = new Map<number, Set<string>>(variedLevels.map(id => [id, new Set<string>()]))
    for (const seed of SEEDS) {
      const dump = dumpAct1(env, seed, variedLevels, { difficulty: 0, isolated: false, skipActivation: true })
      for (const level of dump.levels) grids.get(level.id)!.add(JSON.stringify(level.levelGrid.grids))
    }
    for (const [levelId, distinct] of grids) expect(distinct.size, `level ${levelId}`).toBe(SEEDS.length)
  }, 60_000)

  for (const seed of SEEDS) {
    it(`seed ${hex(seed)}: waypoints, seamless orth links, and dungeon warps`, () => {
      const dump = generate(seed)
      const act = new Map(dump.act.map(l => [l.id, l]))

      for (const levelId of LEVELS) {
        const what = `${hex(seed)} level ${levelId}`
        const levelDump = dump.levels.find(l => l.id === levelId)!
        const input = drlgLevelInputFromDump(dump, levelId, data.tables)
        const dims = [levelDump.levelGrid.coord[2] * 8, levelDump.levelGrid.coord[3] * 8]
        if (BARRICADE_LEVELS.has(levelId)) {
          expect([...dims].sort(numeric), `${what}: level dimensions`).toEqual([64, 160])
        } else {
          const def = DATATBLS_GetLevelDefRecord(data.tables, levelId)
          expect(dims, `${what}: level dimensions`).toEqual([def.dwSizeX[0], def.dwSizeY[0]])
        }

        const objects = input.units.filter(
          u => u.type === UNIT_OBJECT && u.index >= 0 && u.index < data.tables.objectSubClass.length,
        )
        const waypoints = objects.filter(u => (objectSubClass(data.tables, u.index) & SUBCLASS_WAYPOINT) !== 0)
        expect(waypoints, `${what}: waypoint objects`).toHaveLength(WAYPOINT_LEVELS.has(levelId) ? 1 : 0)

        expect(input.orths.map(o => o.level).sort(numeric), `${what}: orth neighbours`).toEqual(
          [...EXPECTED_ORTHS[levelId]!].sort(numeric),
        )
        if (act.has(levelId)) {
          const layout = act.get(levelId)!.coord
          for (const orth of input.orths) {
            const neighbour = act.get(orth.level)!
            expect(touchesOnDir(layout, neighbour.coord, orth.dir), `${what}: touches ${orth.level} on dir ${orth.dir}`).toBe(
              true,
            )
          }
          if (levelId === 110) {
            expect(touchesOnDir(layout, act.get(111)!.coord, 0), `${what}: touches 111 on west`).toBe(true)
            expect(touchesOnDir(layout, act.get(109)!.coord, 2), `${what}: touches 109 on east`).toBe(true)
          }
        }

        if (BARRICADE_LEVELS.has(levelId)) {
          const cells0 = levelDump.levelGrid.grids[0]!.cells
          expect(
            cells0.includes(LVLPREST_ACT5_BARRICADE_HELL_PORTAL_N) ||
              cells0.includes(LVLPREST_ACT5_BARRICADE_HELL_PORTAL_W),
            `${what}: Hell portal preset`,
          ).toBe(true)
        }

        expect([...new Set(input.warps.map(w => w.toLevelId))].sort(numeric), `${what}: warps`).toEqual(
          [...EXPECTED_WARPS[levelId]!].sort(numeric),
        )
      }
    }, 60_000)
  }
})
