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
import { D2_EXPERIENCE_TABLE_99 } from '../src/common/skills/formulas.ts'
import {
  getCanonicalMonsterKinds,
  getCanonicalSuperUniques,
  monsterBudget,
  readLevelMonsterPlan,
  type Difficulty,
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
    expect(level.elitePacksByRoom.size).toBe(0)
    const budget = monsterBudget(8 * 8, 520)
    for (const room of rooms) {
      const spawns = planRoomPopulation113c(level, room, () => true)
      expect(spawns.length).toBeLessThanOrEqual(budget)
      expect(spawns.length).toBeGreaterThan(0)
      for (const s of spawns) {
        expect(level.types.map((t) => t.id)).toContain(s.kind.id)
        expect(s.rank).toBe('normal')
        expect(s.x).toBeGreaterThanOrEqual(room.x)
        expect(s.x).toBeLessThan(room.x + room.w)
        expect(s.y).toBeGreaterThanOrEqual(room.y)
        expect(s.y).toBeLessThan(room.y + room.h)
      }
    }
  })

  it('returns null for towns and levels with MonDen 0', () => {
    for (const id of [1, 40, 75, 103, 109]) {
      expect(planLevelPopulation113c(id, 2, roomGrid(), 1)).toBeNull()
    }
  })

  it('distributes MonUMin..MonUMax elite packs over rooms on Hell', () => {
    const rooms = roomGrid()
    const level = planLevelPopulation113c(2, 2, rooms, 0x5eed)!
    const elitePacks = [...level.elitePacksByRoom.values()].reduce((n, l) => n + l.length, 0)
    expect(elitePacks).toBeGreaterThanOrEqual(7)
    expect(elitePacks).toBeLessThanOrEqual(9)
    const spawns = rooms.flatMap((r) => planRoomPopulation113c(level, r, () => true))
    const leaders = spawns.filter((s) => s.rank === 'champion' || s.rank === 'unique')
    expect(leaders.length).toBeGreaterThan(0)
    for (const l of leaders) expect(l.modifiers.length).toBeGreaterThan(0)
    for (const s of spawns.filter((x) => x.rank === 'minion')) expect(s.modifiers).toEqual([])
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
    expect(first.length).toBeLessThanOrEqual(9 * monsterBudget(64, 520))
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
    const grant = (xp: number): void =>
      (game as unknown as { grantExperience(p: unknown, n: number): void }).grantExperience(
        (game as unknown as { players: Map<number, unknown> }).players.get(pid),
        xp,
      )
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
