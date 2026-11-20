/**
 * Act I outdoor DRLG: what the rest of the game relies on in the levels the D2MOO port (src/game/drlg)
 * generates, checked on more seeds than the oracle fixtures, on the maps the bake makes from them
 * (src/common/drlg/drlg-map.ts) and on the collision scenes it builds (src/common/world/d2map.ts).
 *
 * tests/drlg-act1-oracle.test.ts proves the port is D2MOO roll for roll on four seeds; this suite checks
 * invariants on any seed:
 * - sizes: the act layout gives every level its Levels.txt size (the Blood Moor either way round, as
 *   DRLGOUTPLACE_CreateLevelConnections orients it);
 * - population: one waypoint on Cold Plains..Black Marsh and five shrine cells on Blood Moor..Tamoe
 *   Highland (DrlgOutWild.cpp:212-220), the SuperUnique presets, Flavie at the camp gate;
 * - links: every seam lies on an edge the act layout shares with the neighbour and is mirrored by it,
 *   and the seams and warps are exactly the world graph's (the bake's exactLinks check throws otherwise);
 * - reachability: in the bake's collision scene every seam opens onto the level's main walkable region,
 *   every warp and waypoint can be triggered from it, the SuperUniques stand next to it and the spawn is
 *   on it;
 * - determinism.
 *
 * It replaces the Act I suites of the deleted hand-written generator (wilderness-reachability-stress,
 * wilderness-stress-fuzz). Needs the 1.13c archives in samples/d2; skipped without them, like the other
 * MPQ suites (the oracle suite is the one that fails instead).
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { decodeDt1, type Dt1 } from '../src/common/formats/dt1.ts'
import { parseTable } from '../src/common/world/acts.ts'
import { buildIsoMapScene, subTileAt } from '../src/common/world/d2map.ts'
import { dumpAct1, type DrlgDump, type DumpCoord } from '../src/common/drlg/drlg-dump.ts'
import {
  act1OutdoorLevelIds,
  buildDrlgLevelMap,
  drlgLevelInputFromDump,
  type DrlgLevelInput,
  type DrlgLevelMap,
} from '../src/common/drlg/drlg-map.ts'
import { createDrlgEnv } from '../src/common/drlg/drlg-source.ts'
import { DATATBLS_GetLevelDefRecord, objectSubClass } from '../src/common/drlg/drlg-tables.ts'
import {
  findBorderOpening,
  findIsoSpawn,
  largestWalkableRegion,
  nearestWalkable,
  triggerableFrom,
  WARP_TRIGGER_SUBTILES,
  type BorderOpening,
} from '../src/common/world/level-links.ts'
import { SUB_TILES_PER_TILE } from '../src/common/world/map.ts'
import { buildWorldGraph, edgesFrom, oppositeSide, parseLevelRows, type WorldGraph } from '../src/common/world/world-graph.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { drlgLevelDt1s, drlgSuperUniqueIds, loadDrlgMpqData, type DrlgMpqData } from '../src/baker/io/drlg-mpq-source.ts'

/** The Act I levels Levels.txt generates with the outdoor DRLG (checked against the table below). */
const LEVELS = [2, 3, 4, 5, 6, 7, 17, 39]
const ARCHIVE_DIR = resolve(import.meta.dirname, '../samples/d2')
const MOUNTS = ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq'] as const
const SUPERUNIQUES_TXT = 'data\\global\\excel\\SuperUniques.txt'
const LEVELS_TXT = 'data\\global\\excel\\Levels.txt'
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

/** The game seeds the bake generates its three Act I copies from (scripts/pack-act-assets.ts actGameSeed). */
const BAKE_SEEDS = [0x5eed0100, 0x5eed0101, 0x5eed0102]
/** Fully generated and activated: the oracle fixture seed, the bake's seeds and pseudo-random ones. */
const SEEDS = [0x12345678, ...BAKE_SEEDS, ...lcgSeeds(0x0badf00d, 12)]
/** How many of SEEDS also get the (slow) collision-scene checks. */
const SCENE_SEEDS = 6
/** Act layout only, for the size sweep. */
const LAYOUT_SEEDS = lcgSeeds(0x2468ace1, 256)

// DRLGOUTWILD_InitAct1OutdoorLevel (DrlgOutWild.cpp:212-220).
/** LEVEL_COLDPLAINS..LEVEL_BLACKMARSH: DRLGOUTDOORS_SpawnAct12Waypoint. */
const WAYPOINT_LEVELS = new Set([3, 4, 5, 6])
/** LEVEL_BLOODMOOR..LEVEL_TAMOEHIGHLAND: DRLGOUTDOORS_SpawnAct12Shrines(pLevel, 5). */
const SHRINE_LEVELS = new Set([2, 3, 4, 5, 6, 7])
const SHRINES_PER_LEVEL = 5
/** Grid-1 cell flags: waypoint 0x10000 / 0x20000 (DrlgOutdoors.cpp:520, :565), shrine 0x1000..0x8000 (:581). */
const GRID1_WAYPOINT = 0x30000
const GRID1_SHRINE = 0xf000
/** Objects.txt SubClass bits. */
const SUBCLASS_SHRINE = 0x01
const SUBCLASS_WAYPOINT = 0x40
/** D2PresetUnitStrc nUnitType. */
const UNIT_MONSTER = 1
const UNIT_OBJECT = 2
/** MonStats.txt hcIdx 266 (navi): Flavie, part of the Blood Moor's camp transition preset. */
const MONSTATS_FLAVIE = 266
/** The fixed monsters each level's presets carry (drlg-map.ts landmarks). */
const LANDMARKS: Readonly<Record<number, readonly string[]>> = {
  2: [],
  3: ['Bishibosh'],
  4: ['Rakanishu'],
  5: ['Treehead WoodFist'],
  6: [],
  7: [],
  17: ['Blood Raven'],
  39: ['The Cow King'],
}
/**
 * How close main-region ground must be to a SuperUnique's preset position, in sub-tiles. Some stand on
 * blocked ground (Rakanishu inside the Cairn Stones: up to 10 sub-tiles measured); D2Game places the
 * monster on free ground around its preset, and that ground must be reachable.
 */
const LANDMARK_REACH = 3 * SUB_TILES_PER_TILE

const numeric = (a: number, b: number): number => a - b

function hex(seed: number): string {
  return `0x${seed.toString(16).padStart(8, '0')}`
}

/** The stretch two act-layout rectangles share along one side of `a`, or null if they do not touch there. */
function sharedStretch(a: DumpCoord, b: DumpCoord, side: string): { lo: number; hi: number } | null {
  const [ax, ay, aw, ah] = a
  const [bx, by, bw, bh] = b
  let touching: boolean
  let lo: number
  let hi: number
  if (side === 'east' || side === 'west') {
    touching = side === 'east' ? ax + aw === bx : bx + bw === ax
    lo = Math.max(ay, by)
    hi = Math.min(ay + ah, by + bh)
  } else {
    touching = side === 'south' ? ay + ah === by : by + bh === ay
    lo = Math.max(ax, bx)
    hi = Math.min(ax + aw, bx + bw)
  }
  return touching && hi > lo ? { lo, hi } : null
}

describe.skipIf(!hasMpq)('Act I outdoor DRLG port: level invariants over many seeds', () => {
  let data: DrlgMpqData
  let superUniqueIds: string[]
  let worldGraph: WorldGraph
  const dt1Cache = new Map<string, Dt1>()

  beforeAll(async () => {
    const archives = new MountedArchives()
    for (const name of MOUNTS) archives.add(name, await MpqArchive.open(await fileSource(join(ARCHIVE_DIR, name))))
    data = await loadDrlgMpqData(member => archives.read(member), 1)
    superUniqueIds = drlgSuperUniqueIds(parseTable(await archives.read(SUPERUNIQUES_TXT)), data.tables)
    worldGraph = buildWorldGraph(parseLevelRows(parseTable(await archives.read(LEVELS_TXT))))
  }, 120_000)

  function generate(seed: number): DrlgDump {
    return dumpAct1(createDrlgEnv(data.source, data.tables), seed, LEVELS, { difficulty: 0, isolated: false })
  }

  function mapLevel(dump: DrlgDump, levelId: number): { input: DrlgLevelInput; map: DrlgLevelMap } {
    const input = drlgLevelInputFromDump(dump, levelId, data.tables)
    const map = buildDrlgLevelMap(input, { tables: data.tables, dt1: drlgLevelDt1s(input, data.source, dt1Cache), superUniqueIds })
    return { input, map }
  }

  function library(name: string): Dt1 {
    let lib = dt1Cache.get(name)
    if (lib === undefined) {
      lib = decodeDt1(data.source.readFile(name))
      dt1Cache.set(name, lib)
    }
    return lib
  }

  it('takes the outdoor level list from Levels.txt', () => {
    expect(act1OutdoorLevelIds(data.tables)).toEqual(LEVELS)
  })

  it(`sizes every level as D2 does on ${LAYOUT_SEEDS.length} act layouts`, () => {
    const env = createDrlgEnv(data.source, data.tables)
    const bloodMoor = new Set<string>()
    for (const seed of LAYOUT_SEEDS) {
      const { act } = dumpAct1(env, seed, LEVELS, { actOnly: true })
      for (const levelId of LEVELS) {
        const level = act.find(l => l.id === levelId)
        expect(level, `${hex(seed)}: level ${levelId} is not in the act`).toBeDefined()
        const [, , width, height] = level!.coord
        if (levelId === 2) {
          // The Blood Moor's link callback (sub_6FD81950, DrlgOutPlace.cpp:1310; gAct1WildernessDrlgLink,
          // :33) replaces its Levels.txt size with 96x56 or 56x96, whichever way it runs from the camp.
          bloodMoor.add(`${width}x${height}`)
          continue
        }
        // Every other level keeps Levels.txt SizeX/SizeY (DRLGOUTPLACE_CreateLevelConnections).
        const def = DATATBLS_GetLevelDefRecord(data.tables, levelId)
        expect([width, height], `${hex(seed)} level ${levelId}`).toEqual([def.dwSizeX[0], def.dwSizeY[0]])
      }
    }
    expect([...bloodMoor].sort()).toEqual(['56x96', '96x56'])
  }, 120_000)

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
    for (const [levelId, distinct] of grids) expect(distinct.size, `level ${levelId}`).toBe(SEEDS.length)
  }, 60_000)

  SEEDS.forEach((seed, index) => {
    const withScene = index < SCENE_SEEDS
    it(`seed ${hex(seed)}: population and links${withScene ? ', and reachability in the collision scene' : ''}`, () => {
      const dump = generate(seed)
      const act = new Map(dump.act.map(l => [l.id, l]))
      const maps = new Map(LEVELS.map(levelId => [levelId, mapLevel(dump, levelId)]))

      for (const levelId of LEVELS) {
        const what = `${hex(seed)} level ${levelId}`
        const { input, map } = maps.get(levelId)!

        // ---- the canvas ----
        const layout = act.get(levelId)!.coord
        expect([map.coord.x, map.coord.y, map.coord.width, map.coord.height], what).toEqual(layout)
        expect(map.ds1.width, what).toBe(map.coord.width + 1)
        expect(map.ds1.height, what).toBe(map.coord.height + 1)

        // ---- population ----
        const cells = dump.levels.find(l => l.id === levelId)!.levelGrid.grids[1]!.cells
        expect(cells.filter(c => (c & GRID1_WAYPOINT) !== 0).length, `${what}: waypoint cells`).toBe(WAYPOINT_LEVELS.has(levelId) ? 1 : 0)
        expect(cells.filter(c => (c & GRID1_SHRINE) !== 0).length, `${what}: shrine cells`)
          .toBe(SHRINE_LEVELS.has(levelId) ? SHRINES_PER_LEVEL : 0)
        const objects = input.units.filter(u => u.type === UNIT_OBJECT && u.index >= 0 && u.index < data.tables.objectSubClass.length)
        const waypoints = objects.filter(u => (objectSubClass(data.tables, u.index) & SUBCLASS_WAYPOINT) !== 0)
        const shrines = objects.filter(u => (objectSubClass(data.tables, u.index) & SUBCLASS_SHRINE) !== 0)
        // The world graph registers the waypoint from Levels.txt `Waypoint`; the map must have it.
        const hasWaypoint = worldGraph.levels.get(levelId)!.waypoint !== 255
        expect(hasWaypoint, what).toBe(WAYPOINT_LEVELS.has(levelId))
        expect(waypoints, `${what}: waypoint objects`).toHaveLength(hasWaypoint ? 1 : 0)
        if (SHRINE_LEVELS.has(levelId)) {
          expect(shrines.length, `${what}: shrine objects`).toBeGreaterThanOrEqual(1)
          expect(shrines.length, `${what}: shrine objects`).toBeLessThanOrEqual(SHRINES_PER_LEVEL)
        } else {
          expect(shrines, `${what}: shrine objects`).toHaveLength(0)
        }
        const flavie = input.units.filter(u => u.type === UNIT_MONSTER && u.index === MONSTATS_FLAVIE)
        expect(flavie, `${what}: Flavie`).toHaveLength(levelId === 2 ? 1 : 0)
        expect(map.landmarks.map(l => l.id).sort(), `${what}: landmarks`).toEqual([...LANDMARKS[levelId]!].sort())
        for (const unit of [...input.units, ...map.landmarks]) {
          expect(unit.subX >= 0 && unit.subY >= 0 && unit.subX < map.ds1.width * SUB_TILES_PER_TILE
            && unit.subY < map.ds1.height * SUB_TILES_PER_TILE, `${what}: unit at ${unit.subX},${unit.subY} is on the canvas`).toBe(true)
        }

        // ---- links: exactly the world graph's, on shared edges, mirrored by outdoor neighbours ----
        const gates = map.entrances.filter(e => e.kind === 'gate')
        const warps = map.entrances.filter(e => e.kind === 'preset')
        const graphEdges = edgesFrom(worldGraph, levelId)
        expect(gates.map(e => e.toLevelId).sort(numeric), `${what}: seams`)
          .toEqual(graphEdges.filter(e => e.kind === 'seamless').map(e => e.to).sort(numeric))
        expect([...new Set(warps.map(e => e.toLevelId))].sort(numeric), `${what}: warps`)
          .toEqual(graphEdges.filter(e => e.kind === 'warp').map(e => e.to).sort(numeric))
        expect(warps.length, `${what}: one warp unit per warp`).toBe(new Set(warps.map(e => e.toLevelId)).size)
        for (const gate of gates) {
          const seam = `${what} seam to ${gate.toLevelId}`
          const neighbour = act.get(gate.toLevelId)
          expect(neighbour, `${seam}: neighbour in the act`).toBeDefined()
          const shared = sharedStretch(layout, neighbour!.coord, gate.side!)
          expect(shared, `${seam}: the ${gate.side} edge touches the neighbour`).not.toBeNull()
          const horizontal = gate.side === 'north' || gate.side === 'south'
          const offset = horizontal ? map.coord.x : map.coord.y
          const from = offset + gate.span!.from
          const to = offset + gate.span!.to
          expect(from >= shared!.lo && to <= shared!.hi && from < to, `${seam}: opening ${from}..${to} on the shared stretch`).toBe(true)
          const other = maps.get(gate.toLevelId)
          if (other === undefined) continue // the camp or the Monastery Gate: not an outdoor level
          const back = other.map.entrances.filter(e => e.kind === 'gate' && e.toLevelId === levelId)
          expect(back, `${seam}: mirrored`).toHaveLength(1)
          expect(back[0]!.side, `${seam}: mirrored`).toBe(oppositeSide(gate.side!))
          const backOffset = horizontal ? other.map.coord.x : other.map.coord.y
          expect([backOffset + back[0]!.span!.from, backOffset + back[0]!.span!.to], `${seam}: same opening from both sides`).toEqual([from, to])
        }

        if (!withScene) continue

        // ---- reachability, in the collision scene the bake builds (bakeDs1Variant / buildSceneLinks) ----
        const copy = BAKE_SEEDS.indexOf(seed)
        const scene = buildIsoMapScene(map.ds1, map.dt1Names.map(library), 0x5eed_1000 + levelId * 10 + (copy < 0 ? index % 3 : copy) + 1)
        const region = largestWalkableRegion(scene)
        const reachable = (x: number, y: number): boolean => region[y * scene.gridWidth + x] === 1
        let walkable = 0
        let inRegion = 0
        for (let at = 0; at < scene.blocked.length; at += 1) {
          if (scene.blocked[at] === 0) walkable += 1
          if (region[at] === 1) inRegion += 1
        }
        // One play area: the ground walled off from it is a sliver (at most ~1% measured).
        expect(inRegion / walkable, `${what}: share of the walkable ground in the main region`).toBeGreaterThan(0.95)
        const openings: BorderOpening[] = []
        for (const gate of gates) {
          const range = { from: gate.span!.from * SUB_TILES_PER_TILE, to: gate.span!.to * SUB_TILES_PER_TILE }
          const opening = findBorderOpening(scene, gate.side!, region, undefined, range)
          expect(opening, `${what}: walkable opening for the seam to ${gate.toLevelId}`).not.toBeNull()
          expect(opening!.inset, `${what}: the seam to ${gate.toLevelId} opens at the border`).toBeLessThanOrEqual(SUB_TILES_PER_TILE)
          expect(reachable(opening!.arriveX, opening!.arriveY), `${what}: arrival from ${gate.toLevelId}`).toBe(true)
          openings.push(opening!)
        }
        for (const warp of warps) {
          const { subX, subY } = warp.warp!
          expect(triggerableFrom(scene, region, subX, subY, WARP_TRIGGER_SUBTILES), `${what}: warp to ${warp.toLevelId} at ${subX},${subY}`).toBe(true)
        }
        for (const wp of waypoints) {
          expect(triggerableFrom(scene, region, wp.subX, wp.subY, WARP_TRIGGER_SUBTILES), `${what}: waypoint at ${wp.subX},${wp.subY}`).toBe(true)
        }
        for (const lm of map.landmarks) {
          expect(nearestWalkable(scene, lm.subX, lm.subY, LANDMARK_REACH, region), `${what}: ${lm.id} at ${lm.subX},${lm.subY}`).not.toBeNull()
        }
        // The spawn is on the main region: from the seams' arrival points, and with nothing to go by
        // (the Moo Moo Farm has no seam at all).
        for (const spawn of [findIsoSpawn(scene, { entrances: openings }), findIsoSpawn(scene)]) {
          expect(spawn, `${what}: spawn`).not.toBeNull()
          const at = subTileAt(scene, spawn!.x, spawn!.y)
          expect(at.inBounds && reachable(at.subX, at.subY), `${what}: spawn at ${at.subX},${at.subY} on the main region`).toBe(true)
        }
      }
    }, 60_000)
  })
})
