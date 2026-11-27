/**
 * #1327: GameInstance wilderness population and experience table.
 *
 * - The hard-coded "one classId 0 Fallen per 40 sub-tiles" stub is gone: DRLG rooms
 *   are populated once, when a player activates them, from the level's 1.13c
 *   `Levels.txt` plan (MonDen, NumMon, mon/nmon/umon, MonUMin/MonUMax) with
 *   MonStats.txt + MonLvl.txt stats at `MonLvl*Ex`, never in towns, never on
 *   blocked cells.
 * - SuperUniques (DRLG presets beyond MonStats.txt) spawn with Mod1..Mod3 and
 *   MinGrp..MaxGrp minions.
 * - Level-ups use the full 1..99 `Experience.txt` table.
 */
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { Rng } from '../src/common/rng/d2-rng.ts'
import { D2_EXPERIENCE_TABLE_99, PARSED_EXPERIENCE_TABLE } from '../src/common/skills/formulas.ts'
import {
  filterTransferableEliteModifiers113c,
  getCanonicalMonsterKinds,
  getCanonicalSuperUniques,
  monsterBudget,
  passesSparsePopulate113c,
  planMonsterGroups,
  readLevelMonsterPlan,
  resolveEliteCandidates,
  rollEliteGroup,
  rollMonsterAttempt113c,
  rollPackKind113c,
  roomMonsterAttempts113c,
  selectLevelTypes,
  type Difficulty,
  type MonsterKind,
} from '../src/common/units/monsters-data.ts'
import { loadActTables } from '../src/common/world/acts.ts'
import {
  CANONICAL_LEVEL_MONSTER_PLANS,
  getLevelMonsterPlan113c,
} from '../src/common/world/level-monster-plans.ts'
import {
  planLevelPopulation113c,
  planRoomPopulation113c,
  type PopulationRoomRect,
} from '../src/server/ai/room-streamer.ts'
import {
  GameInstance,
  SINGLE_PLAYER_POLICY,
  type ServerMonsterState,
} from '../src/server/engine/game-instance.ts'

const ROOM = 40 // outdoor DRLG room: 8x8 tiles = 40x40 sub-tiles

/** 3x3 grid of outdoor rooms starting at world sub-tile (1000, 1000). */
function roomGrid(seedBase = 0x1234): PopulationRoomRect[] {
  const rooms: PopulationRoomRect[] = []
  for (let ry = 0; ry < 3; ry++) {
    for (let rx = 0; rx < 3; rx++) {
      rooms.push({
        index: ry * 3 + rx,
        x: 1000 + rx * ROOM,
        y: 1000 + ry * ROOM,
        w: ROOM,
        h: ROOM,
        seed: (seedBase + ry * 3 + rx) * 0x9e3779b1 >>> 0,
      })
    }
  }
  return rooms
}

function monstersOf(game: GameInstance): ServerMonsterState[] {
  const out: ServerMonsterState[] = []
  for (let id = 1; id < 4000; id++) {
    const m = game.getMonster(id)
    if (m) out.push(m)
  }
  return out
}

function makeGame(opts: {
  readonly areaId: number
  readonly difficulty?: 0 | 1 | 2
  readonly seed?: number
  readonly walkable?: (x: number, y: number) => boolean
  readonly rooms?: readonly PopulationRoomRect[] | null
}): { game: GameInstance; player: number } {
  const game = new GameInstance({
    mapSeed: opts.seed ?? 0xc0ffee,
    policy: SINGLE_PLAYER_POLICY,
    areaId: opts.areaId,
    difficulty: opts.difficulty ?? 0,
  })
  const walkable = opts.walkable ?? (() => true)
  game.setTerrainWalkableCheck((_a, x, y) => walkable(Math.floor(x), Math.floor(y)))
  if (opts.rooms !== null) {
    const rooms = opts.rooms ?? roomGrid()
    game.setAreaRoomProvider((areaId) => (areaId === opts.areaId ? rooms : null))
  }
  const player = game.connectPlayer({
    charName: 'Hero',
    classId: 1,
    areaId: opts.areaId,
    x: 1060,
    y: 1060,
  })
  return { game, player }
}

describe('#1327 Levels.txt monster plans (embedded, 136 levels)', () => {
  it('embeds all 136 Levels.txt rows with towns at MonDen 0', () => {
    expect(Object.keys(CANONICAL_LEVEL_MONSTER_PLANS)).toHaveLength(136)
    for (const town of [1, 40, 75, 103, 109]) {
      for (const d of ['normal', 'nightmare', 'hell'] as const) {
        expect(getLevelMonsterPlan113c(town, d)!.density).toBe(0)
      }
    }
    const bloodMoor = getLevelMonsterPlan113c(2, 'normal')!
    expect(bloodMoor.density).toBe(520)
    expect(bloodMoor.pool).toEqual(['zombie1', 'fallen1', 'quillrat1'])
    expect(getLevelMonsterPlan113c(2, 'hell')!.eliteMin).toBe(7)
    expect(getLevelMonsterPlan113c(2, 'hell')!.eliteMax).toBe(9)
    expect(getLevelMonsterPlan113c(137, 'normal')).toBeNull()
  })

  it('every mon/nmon/umon entry resolves to a canonical MonStats.txt row', () => {
    const kinds = getCanonicalMonsterKinds('normal')
    for (const rec of Object.values(CANONICAL_LEVEL_MONSTER_PLANS)) {
      for (const id of [...rec.pool, ...rec.nightmarePool, ...rec.elitePool]) {
        expect(kinds.has(id), `level ${rec.id}: ${id}`).toBe(true)
      }
    }
  })

  const mpqDir = 'samples/d2'
  it.skipIf(!existsSync(`${mpqDir}/Patch_D2.mpq`))(
    'matches readLevelMonsterPlan over the MPQ Levels.txt for all 136 levels x 3 difficulties',
    async () => {
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`${mpqDir}/${name}`)))
      }
      const tables = await loadActTables(archives)
      for (let id = 1; id <= 136; id++) {
        for (const d of ['normal', 'nightmare', 'hell'] as Difficulty[]) {
          expect(getLevelMonsterPlan113c(id, d), `level ${id} ${d}`).toEqual(
            readLevelMonsterPlan(tables.levels, id, d),
          )
        }
      }
    },
    60_000,
  )
})

describe('#1327 per-room population planner', () => {
  it('uses the 1.13c per-room density budget and only the level types', () => {
    const rooms = roomGrid()
    const level = planLevelPopulation113c(2, 0, rooms, 0xabc)!
    expect(level).not.toBeNull()
    const allowed = new Set(['zombie1', 'fallen1', 'quillrat1'])
    for (const t of level.types) expect(allowed.has(t.id)).toBe(true)
    // Blood Moor Normal: MonUMin = MonUMax = 0
    expect(level.totalRooms).toBe(rooms.length)
    expect(level.activatedRooms).toBe(0)
    expect(level.spawnedElites).toBe(0)
    expect(monsterBudget(8 * 8, 520)).toBe(1)
    let totalSpawns = 0
    for (const room of rooms) {
      const spawns = planRoomPopulation113c(level, room, () => true)
      totalSpawns += spawns.length
      const byGroup = new Map<number, typeof spawns>()
      for (const s of spawns) {
        const list = byGroup.get(s.groupIndex) ?? []
        list.push(s)
        byGroup.set(s.groupIndex, list)
        expect(level.types.map((t) => t.id)).toContain(s.kind.id)
        expect(s.rank).toBe('normal')
        expect(s.x).toBeGreaterThanOrEqual(room.x)
        expect(s.x).toBeLessThan(room.x + room.w)
        expect(s.y).toBeGreaterThanOrEqual(room.y)
        expect(s.y).toBeLessThan(room.y + room.h)
      }
      for (const members of byGroup.values()) {
        const kind = members[0]!.kind
        expect(members.length).toBeGreaterThanOrEqual(Math.max(1, kind.minGroup))
        expect(members.length).toBeLessThanOrEqual(Math.max(1, kind.maxGroup))
      }
    }
    expect(totalSpawns).toBeGreaterThan(0)
  })

  it('returns null for towns and levels with MonDen 0', () => {
    for (const id of [1, 40, 75, 103, 109]) {
      expect(planLevelPopulation113c(id, 2, roomGrid(), 1)).toBeNull()
    }
  })

  it('rolls MonUMin..MonUMax elite packs across rooms on Hell via 0x6FCFF080', () => {
    // 5x5 outdoor room grid (25 rooms, typical wilderness room count)
    const rooms: PopulationRoomRect[] = []
    for (let ry = 0; ry < 5; ry++) {
      for (let rx = 0; rx < 5; rx++) {
        rooms.push({
          index: ry * 5 + rx,
          x: 1000 + rx * ROOM,
          y: 1000 + ry * ROOM,
          w: ROOM,
          h: ROOM,
          seed: ((0x1234 + ry * 5 + rx) * 0x9e3779b1) >>> 0,
        })
      }
    }
    const level = planLevelPopulation113c(2, 2, rooms, 0x5eed)!
    expect(level.totalRooms).toBe(rooms.length)
    expect(level.activatedRooms).toBe(0)
    expect(level.spawnedElites).toBe(0)
    const spawnsByRoom = rooms.map((r) => planRoomPopulation113c(level, r, () => true))
    const spawns = spawnsByRoom.flat()
    expect(level.activatedRooms).toBe(rooms.length)
    expect(level.spawnedElites).toBeGreaterThanOrEqual(7)
    expect(level.spawnedElites).toBeLessThanOrEqual(9)
    const leaders = spawns.filter((s) => s.rank === 'champion' || s.rank === 'unique')
    expect(leaders.length).toBeGreaterThan(0)
    for (const l of leaders) expect(l.modifiers.length).toBeGreaterThan(0)
    for (const roomSpawns of spawnsByRoom) {
      for (const s of roomSpawns.filter((x) => x.rank === 'minion')) {
        const packLeader = roomSpawns.find(
          (cand) => cand.groupIndex === s.groupIndex && cand.rank === 'unique',
        )!
        expect(s.modifiers).toEqual(filterTransferableEliteModifiers113c(packLeader.modifiers))
      }
    }
  })

  it('never places a monster on a blocked sub-tile', () => {
    const level = planLevelPopulation113c(3, 0, roomGrid(), 7)!
    const walkable = (x: number, y: number): boolean => (x + y) % 3 !== 0
    for (const room of roomGrid()) {
      for (const s of planRoomPopulation113c(level, room, walkable)) {
        expect(walkable(s.x, s.y)).toBe(true)
      }
    }
    // A fully blocked room places nothing.
    expect(planRoomPopulation113c(level, roomGrid()[0]!, () => false)).toEqual([])
  })
})

describe('#1327 GameInstance room streaming', () => {
  it('no longer spawns the hard-coded classId 0 Fallen stub', () => {
    const { game } = makeGame({ areaId: 2, rooms: null })
    for (let i = 0; i < 5; i++) game.stepFrame()
    expect(monstersOf(game)).toEqual([])
  })

  it('populates the player room and its near rooms once from the Blood Moor pool', () => {
    const { game } = makeGame({ areaId: 2 })
    game.stepFrame()
    const first = monstersOf(game)
    expect(first.length).toBeGreaterThan(0)
    expect(first.length).toBeLessThanOrEqual(9 * roomMonsterAttempts113c(ROOM, ROOM) * 3)
    const kinds = getCanonicalMonsterKinds('normal')
    const pool = new Set(['zombie1', 'fallen1', 'quillrat1'].map((id) => kinds.get(id)!.hcIdx))
    for (const m of first) {
      expect(pool.has(m.hcIdx)).toBe(true)
      expect(m.areaId).toBe(2)
      expect(m.isNpc).toBe(false)
      const kind = [...kinds.values()].find((k) => k.hcIdx === m.hcIdx)!
      // Normal difficulty: MonStats Level column, not the old "1 + difficulty * 25" formula.
      expect(m.level).toBe(kind.level[0])
      expect(m.x).toBeGreaterThanOrEqual(1000)
      expect(m.x).toBeLessThan(1120)
    }
    for (let i = 0; i < 10; i++) game.stepFrame()
    expect(monstersOf(game).length).toBe(first.length)
  })

  it('uses the Levels.txt area level on Hell (MonLvl3Ex) for normal monsters', () => {
    const { game } = makeGame({ areaId: 3, difficulty: 2 })
    game.stepFrame()
    const monsters = monstersOf(game)
    expect(monsters.length).toBeGreaterThan(0)
    const areaLevel = getLevelMonsterPlan113c(3, 'hell')!.monsterLevel
    for (const m of monsters) {
      // Normal monsters sit at the area level; champions / uniques / minions add
      // their MonUMod.txt level bonus on top of it.
      if (m.rank === 'normal') expect(m.level).toBe(areaLevel)
      else expect(m.level).toBeGreaterThan(areaLevel)
    }
    expect(monsters.some((m) => m.rank !== 'normal')).toBe(true)
  })

  it('never populates towns', () => {
    for (const town of [1, 40, 75, 103, 109]) {
      const { game } = makeGame({ areaId: town })
      game.stepFrame()
      expect(monstersOf(game)).toEqual([])
    }
  })

  it('respects the walkability check', () => {
    const walkable = (x: number, y: number): boolean => x % 2 === 1
    const { game } = makeGame({ areaId: 2, walkable })
    game.stepFrame()
    const monsters = monstersOf(game)
    expect(monsters.length).toBeGreaterThan(0)
    for (const m of monsters) expect(walkable(Math.floor(m.x), Math.floor(m.y))).toBe(true)
  })

  it('is deterministic for the same map seed', () => {
    const snap = (): string => {
      const { game } = makeGame({ areaId: 4, difficulty: 1, seed: 0xdead })
      game.stepFrame()
      return JSON.stringify(monstersOf(game).map((m) => [m.hcIdx, m.x, m.y, m.rank, m.maxHp]))
    }
    expect(snap()).toBe(snap())
  })
})

describe('#1327 SuperUniques', () => {
  it('spawns Bishibosh with SuperUniques.txt mods and MinGrp..MaxGrp minions', () => {
    const game = new GameInstance({ mapSeed: 9, policy: SINGLE_PLAYER_POLICY, areaId: 3 })
    const sus = getCanonicalSuperUniques()
    const index = sus.findIndex((s) => s.id === 'Bishibosh')
    expect(index).toBeGreaterThanOrEqual(0)
    const su = sus[index]!
    const ids = game.spawnSuperUnique({ superUniqueIndex: index, x: 500, y: 500, areaId: 3 })
    const boss = game.getMonster(ids[0]!)!
    const kinds = getCanonicalMonsterKinds('normal')
    expect(boss.hcIdx).toBe(kinds.get(su.monsterId)!.hcIdx)
    expect(boss.rank).toBe('unique')
    for (const mod of su.modifiers.filter((m) => m !== 24)) {
      expect(boss.umodIds).toContain(mod)
    }
    const minions = ids.slice(1).map((id) => game.getMonster(id)!)
    expect(minions.length).toBeGreaterThanOrEqual(su.minMinions)
    expect(minions.length).toBeLessThanOrEqual(su.maxMinions)
    for (const m of minions) expect(m.rank).toBe('minion')
  })

  it('rejects an out-of-range SuperUniques.txt index', () => {
    const game = new GameInstance({ mapSeed: 9, policy: SINGLE_PLAYER_POLICY, areaId: 3 })
    expect(() => game.spawnSuperUnique({ superUniqueIndex: 9999, x: 1, y: 1 })).toThrow()
  })
})

describe('#1327 Experience.txt 1..99', () => {
  it('levels a player all the way to 99 with the canonical thresholds and caps experience', () => {
    const game = new GameInstance({ mapSeed: 1, policy: SINGLE_PLAYER_POLICY, areaId: 1 })
    const pid = game.connectPlayer({ charName: 'Xp', classId: 1, x: 10, y: 10 })
    const pRec = (
      game as unknown as { players: Map<number, { level: number; experience: number }> }
    ).players.get(pid)!
    const rawGrant = (xp: number): void =>
      (game as unknown as { grantExperience(p: unknown, n: number): void }).grantExperience(
        pRec,
        xp,
      )
    const grant = (xp: number): void => {
      let rem = xp
      while (rem > 0 && pRec.level < 99) {
        const expRatio = PARSED_EXPERIENCE_TABLE.expRatios[pRec.level] ?? 1024
        const nextThresh = D2_EXPERIENCE_TABLE_99[pRec.level + 1] ?? D2_EXPERIENCE_TABLE_99[99]!
        const toNextLevel = Math.max(1, nextThresh - pRec.experience)
        const maxSingleGain = Math.max(1, Math.floor((0x7fffff * expRatio) / 1024))
        const targetGain = Math.min(rem, toNextLevel, maxSingleGain)
        const raw = Math.min(0x7fffff, Math.ceil((targetGain * 1024) / expRatio))
        const before = pRec.experience
        rawGrant(raw)
        const gained = pRec.experience - before
        if (gained <= 0) break
        rem -= gained
      }
    }
    grant(D2_EXPERIENCE_TABLE_99[30]!)
    expect(game.getPlayerState(pid)!.level).toBe(30)
    grant(D2_EXPERIENCE_TABLE_99[75]! - D2_EXPERIENCE_TABLE_99[30]! - 1)
    expect(game.getPlayerState(pid)!.level).toBe(74)
    grant(1)
    expect(game.getPlayerState(pid)!.level).toBe(75)
    grant(10_000_000_000)
    expect(game.getPlayerState(pid)!.level).toBe(99)
    expect(game.getPlayerState(pid)!.experience).toBe(3520485254)
  })

  it('seeds a fresh character of a given level with that level\'s Experience.txt total', () => {
    const game = new GameInstance({ mapSeed: 1, policy: SINGLE_PLAYER_POLICY, areaId: 1 })
    const pid = game.connectPlayer({ charName: 'Lv60', classId: 2, level: 60, x: 10, y: 10 })
    expect(game.getPlayerState(pid)!.experience).toBe(D2_EXPERIENCE_TABLE_99[60])
  })
})

describe('#1427 D2Game.dll 0x6FC67A20 room density, full MinGrp..MaxGrp & sparsePopulate', () => {
  it('computes room attempts as Math.floor(w / 3) * Math.floor(h / 3) (0x6FC67AF1..0x6FC67B17)', () => {
    expect(roomMonsterAttempts113c(40, 40)).toBe(13 * 13)
    expect(roomMonsterAttempts113c(25, 35)).toBe(8 * 11)
    expect(roomMonsterAttempts113c(2, 40)).toBe(0)
    expect(roomMonsterAttempts113c(40, 2)).toBe(0)

    // With MonDen = 100000 (capped to 10000 -> ~10% per attempt) vs custom plan with 1-member groups:
    // verify exact attempt count drives pack trials on a fixed seed.
    const kinds = getCanonicalMonsterKinds('normal')
    const zombie = { ...kinds.get('zombie1')!, minGroup: 1, maxGroup: 1, sparsePopulate: 100 }
    const plan = { ...getLevelMonsterPlan113c(2, 'normal')!, density: 10000, eliteMin: 0, eliteMax: 0 }
    const w = 39 // 39 / 3 = 13
    const h = 27 // 27 / 3 = 9 -> 117 attempts
    const attempts = roomMonsterAttempts113c(w, h)
    expect(attempts).toBe(117)

    // Count how many of the first 117 rollMonsterAttempt113c(10000, rng) calls succeed for a fixed seed:
    const room: PopulationRoomRect = { index: 0, x: 0, y: 0, w, h, seed: 0x12345678 }
    const levelPlan: NonNullable<ReturnType<typeof planLevelPopulation113c>> = {
      levelId: 2,
      difficulty: 'normal',
      plan,
      types: [zombie],
      eliteCandidates: [],
      totalRooms: 1,
      activatedRooms: 0,
      spawnedElites: 0,
    }
    const spawns = planRoomPopulation113c(levelPlan, room, () => true)
    // Re-run the exact same RNG stream to count successful attempts out of 117:
    const verifyRng = new Rng((room.seed ^ (2 * 0x01000193)) >>> 0)
    let expectedHits = 0
    for (let i = 0; i < attempts; i++) {
      if (rollMonsterAttempt113c(10000, verifyRng)) {
        // pickWeightedKind113c consumes 1 rng.int(1, totalRarity) call
        verifyRng.int(1, Math.max(1, zombie.rarity))
        expectedHits += 1
      }
    }
    const groupIndices = new Set(spawns.map((s) => s.groupIndex))
    expect(spawns.length).toBe(expectedHits)
    expect(groupIndices.size).toBe(expectedHits)
    expect(expectedHits).toBeGreaterThan(0)
    expect(expectedHits).toBeLessThan(attempts)
  })

  it('rolls MonDen=10000 with ~10% attempt success rate (0x6FC67B57..0x6FC67B64: rand()%100000 <= min(MonDen,10000))', () => {
    const kinds = getCanonicalMonsterKinds('normal')
    const singleKind: MonsterKind = {
      ...kinds.get('zombie1')!,
      minGroup: 1,
      maxGroup: 1,
      sparsePopulate: 100,
    }
    const plan = { ...getLevelMonsterPlan113c(2, 'normal')!, density: 10000, eliteMin: 0, eliteMax: 0 }
    // 300x300 sub-tile room => 100 * 100 = 10,000 attempts per room across 5 rooms = 50,000 attempts
    let hits = 0
    const totalAttempts = 50_000
    for (let i = 0; i < 5; i++) {
      const room: PopulationRoomRect = { index: i, x: 0, y: 0, w: 300, h: 300, seed: 0xabc000 + i }
      const level = {
        levelId: 2,
        difficulty: 'normal' as const,
        plan,
        types: [singleKind],
        eliteCandidates: [],
        totalRooms: 5,
        activatedRooms: i,
        spawnedElites: 0,
      }
      const spawns = planRoomPopulation113c(level, room, () => true)
      hits += spawns.length
    }
    const rate = hits / totalAttempts
    // Theoretical rate = 10001 / 100000 = 0.10001
    expect(rate).toBeGreaterThan(0.095)
    expect(rate).toBeLessThan(0.105)
  })

  it('spawns Hell Bovine (Moo Moo Farm level 39) in full [5, 10] groups without truncation (0x6FC67700)', () => {
    const rooms = roomGrid(0xbeef)
    const level = planLevelPopulation113c(39, 0, rooms, 0xc0ffee)!
    expect(level).not.toBeNull()
    expect(level.types.every((t) => t.id === 'hellbovine')).toBe(true)
    expect(level.types[0]!.minGroup).toBe(5)
    expect(level.types[0]!.maxGroup).toBe(10)

    const groupSizes: number[] = []
    for (const room of rooms) {
      const spawns = planRoomPopulation113c(level, room, () => true)
      const countsByGroup = new Map<number, number>()
      for (const s of spawns) {
        if (s.rank === 'normal') {
          countsByGroup.set(s.groupIndex, (countsByGroup.get(s.groupIndex) ?? 0) + 1)
        }
      }
      for (const count of countsByGroup.values()) {
        groupSizes.push(count)
        expect(count).toBeGreaterThanOrEqual(5)
        expect(count).toBeLessThanOrEqual(10)
      }
    }
    expect(groupSizes.length).toBeGreaterThan(5)
    // Verify spread across [5, 10]
    expect(Math.min(...groupSizes)).toBeLessThanOrEqual(6)
    expect(Math.max(...groupSizes)).toBeGreaterThanOrEqual(9)
  })

  it('gates normal pack generation by sparsePopulate=N at ~(N + 1)% pass rate (0x6FC67BD4..0x6FC67C13)', () => {
    const kinds = getCanonicalMonsterKinds('normal')
    for (const N of [20, 50, 75]) {
      const sparseKind: MonsterKind = {
        ...kinds.get('zombie1')!,
        minGroup: 1,
        maxGroup: 1,
        sparsePopulate: N,
      }
      const denseKind: MonsterKind = {
        ...kinds.get('zombie1')!,
        minGroup: 1,
        maxGroup: 1,
        sparsePopulate: 100,
      }
      const plan = { ...getLevelMonsterPlan113c(2, 'normal')!, density: 10000, eliteMin: 0, eliteMax: 0 }
      let sparsePacks = 0
      let densePacks = 0
      for (let i = 0; i < 10; i++) {
        const room: PopulationRoomRect = { index: i, x: 0, y: 0, w: 300, h: 300, seed: 0x777000 + i }
        sparsePacks += planRoomPopulation113c(
          { levelId: 2, difficulty: 'normal', plan, types: [sparseKind], eliteCandidates: [], totalRooms: 10, activatedRooms: i, spawnedElites: 0 },
          room,
          () => true,
        ).length
        densePacks += planRoomPopulation113c(
          { levelId: 2, difficulty: 'normal', plan, types: [denseKind], eliteCandidates: [], totalRooms: 10, activatedRooms: i, spawnedElites: 0 },
          room,
          () => true,
        ).length
      }
      const observedPassRate = sparsePacks / densePacks
      const expectedPassRate = (N + 1) / 100
      expect(observedPassRate).toBeGreaterThan(expectedPassRate - 0.035)
      expect(observedPassRate).toBeLessThan(expectedPassRate + 0.035)
    }
  })

  it('elite packs replace 1 attempt rather than subtracting group.count from normal monster headcount (0x6FC67B8E)', () => {
    const kinds = getCanonicalMonsterKinds('normal')
    const cow = kinds.get('hellbovine')!
    const plan = { ...getLevelMonsterPlan113c(39, 'normal')!, density: 10000, eliteMin: 1, eliteMax: 1 }
    const room: PopulationRoomRect = { index: 0, x: 0, y: 0, w: 90, h: 90, seed: 0x424242 }
    const withElite = planRoomPopulation113c(
      {
        levelId: 39,
        difficulty: 'normal',
        plan,
        types: [cow],
        eliteCandidates: [cow],
        totalRooms: 1,
        activatedRooms: 0,
        spawnedElites: 0,
      },
      room,
      () => true,
    )
    const normalByGroup = new Map<number, number>()
    for (const s of withElite) {
      if (s.rank === 'normal') {
        normalByGroup.set(s.groupIndex, (normalByGroup.get(s.groupIndex) ?? 0) + 1)
      }
    }
    expect(normalByGroup.size).toBeGreaterThan(0)
    // Every remaining normal pack still spawns a full [5, 10] group without any remainder truncation
    for (const count of normalByGroup.values()) {
      expect(count).toBeGreaterThanOrEqual(5)
      expect(count).toBeLessThanOrEqual(10)
    }
  })
})

describe('#1428 D2Game.dll 0x6FCFF080 per-attempt elite roll & 0x6FCFF4A0 NM/Hell elite pool + empty umon', () => {
  it('replicates D2Game.dll 0x6FCFF080 step-by-step in rollPackKind113c (catch-up fallthrough, 6% L_max roll, hard cap)', () => {
    // 1. eliteMax < eliteMin -> immediate 'normal' without advancing RNG (0x6FCFF09B: jl L_normal)
    const rngNoAdvance = new Rng(0x1111)
    const snapBefore = new Rng(0x1111).int(0, 999)
    expect(
      rollPackKind113c(
        { eliteMin: 5, eliteMax: 3, totalRooms: 10, activatedRooms: 10, spawnedElites: 0 },
        rngNoAdvance,
      ),
    ).toBe('normal')
    expect(rngNoAdvance.int(0, 999)).toBe(snapBefore)

    // 2. Step A catch-up: when activatedRooms == totalRooms, threshold = 100 -> 100% 'elite' while spawnedElites < eliteMin
    const rngFull = new Rng(0x2222)
    for (let i = 0; i < 50; i++) {
      expect(
        rollPackKind113c(
          { eliteMin: 4, eliteMax: 5, totalRooms: 9, activatedRooms: 9, spawnedElites: 3 },
          rngFull,
        ),
      ).toBe('elite')
    }

    // 3. Step A fallthrough to Step B (0x6FCFF0CF: jge L_max):
    // When activatedRooms = 0 (threshold = 0), Step A always fails (r < 0 is false) and falls through to Step B (r2 <= 5 -> 6% chance).
    const rngFallthrough = new Rng(0x3333)
    const rngRef = new Rng(0x3333)
    for (let i = 0; i < 200; i++) {
      const actual = rollPackKind113c(
        { eliteMin: 4, eliteMax: 5, totalRooms: 10, activatedRooms: 0, spawnedElites: 0 },
        rngFallthrough,
      )
      const r1 = rngRef.int(0, 99) // Step A roll (fails since threshold = 0)
      expect(r1).toBeGreaterThanOrEqual(0)
      const r2 = rngRef.int(0, 99) // Step B roll (L_max: r2 <= 5)
      expect(actual).toBe(r2 <= 5 ? 'elite' : 'normal')
    }

    // 4. Step B (eliteMin <= spawnedElites < eliteMax): 6% chance (r <= 5)
    const rngStepB = new Rng(0x4444)
    let elitesInStepB = 0
    const trials = 10_000
    for (let i = 0; i < trials; i++) {
      if (
        rollPackKind113c(
          { eliteMin: 4, eliteMax: 5, totalRooms: 10, activatedRooms: 10, spawnedElites: 4 },
          rngStepB,
        ) === 'elite'
      ) {
        elitesInStepB += 1
      }
    }
    const rate = elitesInStepB / trials
    expect(rate).toBeGreaterThan(0.05)
    expect(rate).toBeLessThan(0.07)

    // 5. Hard cap: spawnedElites >= eliteMax -> 'normal' without advancing RNG
    const rngCap = new Rng(0x5555)
    const expectedNext = new Rng(0x5555).int(0, 999)
    expect(
      rollPackKind113c(
        { eliteMin: 4, eliteMax: 5, totalRooms: 10, activatedRooms: 10, spawnedElites: 5 },
        rngCap,
      ),
    ).toBe('normal')
    expect(rngCap.int(0, 999)).toBe(expectedNext)
  })

  it('tracks activatedRooms & spawnedElites across sequential room activations (MonUMin=4, MonUMax=5) and stops at MonUMax', () => {
    // Act 1 Level 2 (Blood Moor) on Nightmare has MonUMin(N)=4, MonUMax(N)=5, MonDen(N)=520
    const baseRooms = Array.from({ length: 25 }, (_, i) => ({
      index: i,
      x: 1000 + (i % 5) * ROOM,
      y: 1000 + Math.floor(i / 5) * ROOM,
      w: ROOM,
      h: ROOM,
      seed: 0,
    }))
    for (let seed = 1; seed <= 50; seed++) {
      const rooms = baseRooms.map((r, i) => ({
        ...r,
        seed: ((seed * 0x9e3779b1 + i * 31) >>> 0),
      }))
      const level = planLevelPopulation113c(2, 1, rooms, seed * 0x13579)!
      expect(level.plan.eliteMin).toBe(4)
      expect(level.plan.eliteMax).toBe(5)
      expect(level.totalRooms).toBe(rooms.length)
      expect(level.activatedRooms).toBe(0)
      expect(level.spawnedElites).toBe(0)

      let totalEliteGroupsSpawned = 0
      rooms.forEach((room, idx) => {
        const spawns = planRoomPopulation113c(level, room, () => true)
        expect(level.activatedRooms).toBe(idx + 1)
        const roomEliteGroups = new Set(
          spawns.filter((s) => s.rank !== 'normal').map((s) => s.groupIndex),
        )
        totalEliteGroupsSpawned += roomEliteGroups.size
        expect(level.spawnedElites).toBe(totalEliteGroupsSpawned)
        expect(level.spawnedElites).toBeLessThanOrEqual(5)
      })
      expect(level.spawnedElites).toBeGreaterThanOrEqual(4)
      expect(level.spawnedElites).toBeLessThanOrEqual(5)

      // Once spawnedElites reaches MonUMax (5), activating any further room must spawn 0 elites:
      level.spawnedElites = 5
      const extraRoom: PopulationRoomRect = {
        index: 99,
        x: 2000,
        y: 2000,
        w: 120,
        h: 120,
        seed: 0x999999,
      }
      const extraSpawns = planRoomPopulation113c(level, extraRoom, () => true)
      expect(extraSpawns.length).toBeGreaterThan(0)
      expect(extraSpawns.every((s) => s.rank === 'normal')).toBe(true)
      expect(level.spawnedElites).toBe(5)
    }

    // Verify 0x6FC44ADB rollback when room is completely unwalkable:
    const blockedLevel = planLevelPopulation113c(2, 1, baseRooms, 0xdeadbeef)!
    for (const room of baseRooms) {
      expect(planRoomPopulation113c(blockedLevel, room, () => false)).toEqual([])
    }
    expect(blockedLevel.activatedRooms).toBe(baseRooms.length)
    expect(blockedLevel.spawnedElites).toBe(0)
  })

  it('draws Normal elites uniformly from umon and NM/Hell elites weighted by Rarity from level.types (D2Game.dll 0x6FCFF4A0)', () => {
    const kindsNorm = getCanonicalMonsterKinds('normal')
    const kindsNM = getCanonicalMonsterKinds('nightmare')
    const kindsHell = getCanonicalMonsterKinds('hell')

    // Act 5 Level 111 (Frigid Highlands):
    // Normal pool = ['imp1', 'siegebeast1', 'minion1'], umon = ['imp1', 'imp2', 'siegebeast1']
    // NM/Hell nmon = ['imp1', 'siegebeast1', 'minion1', 'deathmauler1', '骨骼弓箭手/guest monsters...']
    // Construct a plan with disjoint mon, nmon, and umon to prove zero cross-contamination:
    const disjointPlanNorm = {
      ...getLevelMonsterPlan113c(111, 'normal')!,
      typeCount: 2,
      pool: ['zombie1', 'quillrat1'],
      nightmarePool: ['skeleton1', 'goatman1'],
      elitePool: ['imp1', 'siegebeast1'],
    }
    const normTypes = [kindsNorm.get('zombie1')!, kindsNorm.get('quillrat1')!]
    const normEliteCands = resolveEliteCandidates(disjointPlanNorm, normTypes, kindsNorm, 'normal')
    expect(normEliteCands.map((k) => k.id)).toEqual(['imp1', 'siegebeast1'])

    // On Nightmare & Hell, 0x6FCFF4C4 (jne 0x6FCFF523) ignores umon and uses level.types (drawn from nmon):
    const nmTypes = [kindsNM.get('skeleton1')!, kindsNM.get('goatman1')!]
    const nmEliteCands = resolveEliteCandidates(disjointPlanNorm, nmTypes, kindsNM, 'nightmare')
    expect(nmEliteCands.map((k) => k.id)).toEqual(['skeleton1', 'goatman1'])

    const hellTypes = [kindsHell.get('skeleton1')!, kindsHell.get('goatman1')!]
    const hellEliteCands = resolveEliteCandidates(disjointPlanNorm, hellTypes, kindsHell, 'hell')
    expect(hellEliteCands.map((k) => k.id)).toEqual(['skeleton1', 'goatman1'])

    // Verify Normal rollEliteGroup is uniform (0x6FCFF4D5..0x6FCFF518: rand() % nNumUMon),
    // while NM/Hell rollEliteGroup is weighted by Rarity (0x6FCFF523..0x6FCFF565):
    const lowRarity: MonsterKind = { ...kindsNorm.get('imp1')!, id: 'low_r', rarity: 1 }
    const highRarity: MonsterKind = { ...kindsNorm.get('siegebeast1')!, id: 'high_r', rarity: 99 }
    const rngUniform = new Rng(0x12345)
    let highCountNormal = 0
    for (let i = 0; i < 1000; i++) {
      const g = rollEliteGroup([lowRarity, highRarity], rngUniform, i, 'normal')
      if (g.kind.id === 'high_r') highCountNormal += 1
    }
    // Uniform 50/50 split on Normal regardless of Rarity 1 vs 99:
    expect(highCountNormal).toBeGreaterThan(440)
    expect(highCountNormal).toBeLessThan(560)

    const rngWeighted = new Rng(0x12345)
    let highCountHell = 0
    for (let i = 0; i < 1000; i++) {
      const g = rollEliteGroup([lowRarity, highRarity], rngWeighted, i, 'hell')
      if (g.kind.id === 'high_r') highCountHell += 1
    }
    // 99% Rarity weight on Hell:
    expect(highCountHell).toBeGreaterThan(960)
  })

  it('returns [] for empty umon on Normal without fallback (0x6FCFF4D5 -> 0x6FCFF52A -> 0x6FC43CA0) while NM/Hell use nmon types', () => {
    const rooms = roomGrid(0x51e6e)
    // Act 5 Level 110 (Act 5 - Siege 1 / Bloody Foothills):
    // Levels.txt has umon1..10 all blank (elitePool = []), MonUMin=[1, 3, 4], MonUMax=[2, 5, 6].
    const siegeNormPlan = getLevelMonsterPlan113c(110, 'normal')!
    expect(siegeNormPlan.elitePool).toEqual([])
    expect(siegeNormPlan.eliteMin).toBe(1)
    expect(siegeNormPlan.eliteMax).toBe(2)

    const kindsNorm = getCanonicalMonsterKinds('normal')
    const normTypes = siegeNormPlan.pool.map((id) => kindsNorm.get(id)!)
    expect(normTypes.length).toBeGreaterThan(0)
    // Must NOT fall back to normTypes or siegeNormPlan.pool on Normal:
    expect(resolveEliteCandidates(siegeNormPlan, normTypes, kindsNorm, 'normal')).toEqual([])

    // Even if a Normal level with empty umon has density > 0, elite attempts abort cleanly (0 elites spawned):
    const syntheticNormalLevel = {
      levelId: 110,
      difficulty: 'normal' as const,
      plan: { ...siegeNormPlan, density: 650 },
      types: normTypes,
      eliteCandidates: resolveEliteCandidates(siegeNormPlan, normTypes, kindsNorm, 'normal'),
      totalRooms: rooms.length,
      activatedRooms: 0,
      spawnedElites: 0,
    }
    const normSpawns = rooms.flatMap((r) => planRoomPopulation113c(syntheticNormalLevel, r, () => true))
    expect(normSpawns.length).toBeGreaterThan(0)
    expect(normSpawns.every((s) => s.rank === 'normal')).toBe(true)
    expect(syntheticNormalLevel.spawnedElites).toBe(0)

    // On Nightmare & Hell, Level 110 has MonDen=650 and uses types (drawn from nmon1..10) for elite packs:
    const siegeNM = planLevelPopulation113c(110, 1, rooms, 0x110)!
    expect(siegeNM.eliteCandidates.length).toBeGreaterThan(0)
    expect(siegeNM.eliteCandidates).toEqual(siegeNM.types)
    const nmSpawns = rooms.flatMap((r) => planRoomPopulation113c(siegeNM, r, () => true))
    expect(siegeNM.spawnedElites).toBeGreaterThanOrEqual(3)
    expect(siegeNM.spawnedElites).toBeLessThanOrEqual(5)
    expect(nmSpawns.some((s) => s.rank !== 'normal')).toBe(true)
  })

  it('#1463 embeds rangedspawn (+0x31) for all 20 Act 5 levels and matches 0x6FCEA760 slot-0 ranged preference & isSpawn gate', () => {
    const rangedIds = Object.values(CANONICAL_LEVEL_MONSTER_PLANS)
      .filter((r) => r.rangedSpawn)
      .map((r) => r.id)
    expect(rangedIds).toEqual([
      110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
      123, 124, 125, 126, 127, 128, 129, 130, 131, 135,
    ])

    // Level 110 (Act 5 - Siege 1 / Bloody Foothills): rangedSpawn = true, NumMon = 2.
    // D2Game.dll 0x6FCEA840..0x6FCEAA81 tests MonStats +0x0f & 0x10 (rangedtype) on slot 0,
    // jumping to 0x6FCEAA87 (accept) if ranged, or rerolling up to 20 times (5x unrolled * 4 loops).
    const kindsNorm = getCanonicalMonsterKinds('normal')
    const siegePlan = getLevelMonsterPlan113c(110, 'normal')!
    expect(siegePlan.rangedSpawn).toBe(true)
    const pRanged110 =
      siegePlan.pool.filter((id) => kindsNorm.get(id)!.ranged).length / siegePlan.pool.length
    const expectedRangedRate110 = 1 - Math.pow(1 - pRanged110, 21)
    let rangedSlot0Count110 = 0
    for (let seed = 1; seed <= 1000; seed += 1) {
      const chosen = selectLevelTypes(siegePlan, kindsNorm, new Rng((seed * 0x9e3779b9) >>> 0), 'normal')
      expect(chosen).toHaveLength(2)
      if (chosen[0]!.ranged) rangedSlot0Count110 += 1
    }
    expect(Math.abs(rangedSlot0Count110 / 1000 - expectedRangedRate110)).toBeLessThan(0.01)

    // Controlled 1-in-10 ranged pool (p = 0.1):
    // Theoretical P(slot 0 ranged) with 20 retries = 1 - 0.9^21 = 0.89058 (vs 0.10 without rangedSpawn).
    const sparseRangedPool = [
      'imp1',
      'minion1', 'minion2', 'minion3', 'minion4', 'minion5',
      'overseer1', 'overseer2', 'overseer3', 'deathmauler1',
    ]
    const sparsePlan = { ...siegePlan, typeCount: 2, pool: sparseRangedPool, rangedSpawn: true }
    let sparseRangedHits = 0
    for (let seed = 1; seed <= 1000; seed += 1) {
      const chosen = selectLevelTypes(sparsePlan, kindsNorm, new Rng((seed * 0x85ebca6b) >>> 0), 'normal')
      if (chosen[0]!.ranged) sparseRangedHits += 1
    }
    const theoreticalSparse = 1 - Math.pow(0.9, 21)
    expect(Math.abs(sparseRangedHits / 1000 - theoreticalSparse)).toBeLessThan(0.03)

    // Verify D2Game.dll 0x6FCEAAD1 (+0x0c bit 0 isSpawn): putriddefiler1..4 (isSpawn=true, boss=true)
    // on Levels 123, 124, 128, 130 are included in candidate pool rather than excluded by boss flag.
    const plan123 = { ...getLevelMonsterPlan113c(123, 'normal')!, typeCount: 3 }
    const chosen123 = selectLevelTypes(plan123, kindsNorm, new Rng(1), 'normal').map((k) => k.id)
    expect(chosen123).toContain('putriddefiler1')
  })
})
