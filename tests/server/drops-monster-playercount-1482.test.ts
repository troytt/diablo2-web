import { describe, it, expect } from 'vitest'
import { D2Rng } from '../../src/common/rng/d2-rng.ts'
import {
  computeEffectivePlayers,
  computeScaledNoDrop,
  rollTreasureClass,
} from '../../src/common/items/treasure-engine.ts'
import {
  executeDropPipeline,
} from '../../src/common/items/drop-tables.ts'
import { getEmbeddedDropTables } from '../../src/common/items/embedded-drop-tables.ts'
import {
  getCanonicalMonsterKinds,
  monsterStatsOf,
  resolveMonsterStats,
} from '../../src/common/units/monsters-data.ts'
import {
  resolveMonsterDropPending113c,
  executePendingMonsterDrop113c,
} from '../../src/server/items/drop-pipeline.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { GameEngine } from '../../src/server/engine/game-engine.ts'

describe('NoDrop monster_playercount (stat 100) cap & p <= 8 clamp (Issue #1482)', () => {
  it('clamps partyPlayers p <= 8 and caps effectivePlayers n by monsterPlayerCount (D2Game!0x6FC324B5..0x6FC32534)', () => {
    // Monster spawned at g=1 (stat 100 = 1), killed at g=8, p=1 -> uncapped n=4 capped to 1
    expect(computeEffectivePlayers(8, 1, 1)).toBe(1)
    expect(computeEffectivePlayers(8, 8, 1)).toBe(1)

    // Monster spawned at g=8 (stat 100 = 8), killed at g=8, p=1 -> n = min(4, 8) = 4
    expect(computeEffectivePlayers(8, 1, 8)).toBe(4)

    // Party count p is clamped to <= 8 (0x6FC324E9..0x6FC324F0: cmp edi, 8; jl ...; mov edi, 8)
    expect(computeEffectivePlayers(8, 9)).toBe(8)
    expect(computeEffectivePlayers(10, 10)).toBe(9) // p=8, g=10 -> 8 + trunc((10 - 8) / 2) = 9
    expect(computeEffectivePlayers(10, 10, 8)).toBe(8)

    // Chest / container drop (monsterPlayerCount === undefined) is not capped by stat 100
    expect(computeEffectivePlayers(8, 1, undefined)).toBe(4)
  })

  it('records monsterPlayerCount on MonsterStats from spawn playerCount for hostile monsters and 1 for non-hostile (D2Game!0x6FCCF840 / 0x6FCCFF3B)', () => {
    const kinds = getCanonicalMonsterKinds('normal')
    const fallen = kinds.get('fallen1')!
    expect(fallen).toBeDefined()

    const statsP1 = monsterStatsOf(fallen, { difficulty: 'normal', playerCount: 1 })
    const statsP8 = monsterStatsOf(fallen, { difficulty: 'normal', playerCount: 8 })
    expect(statsP1.monsterPlayerCount).toBe(1)
    expect(statsP8.monsterPlayerCount).toBe(8)

    const resolvedP6 = resolveMonsterStats(fallen, { difficulty: 'normal', playerCount: 6 })
    expect(resolvedP6.monsterPlayerCount).toBe(6)

    // Non-hostile unit (Align != 0, e.g. valkyrie / shadow / roguehire) always gets monster_playercount = 1 (0x6FCCF85D..0x6FCCF8A4)
    const alignedKind = { ...fallen, align: 1 as const }
    const alignedStats = monsterStatsOf(alignedKind, { difficulty: 'normal', playerCount: 8 })
    const alignedResolved = resolveMonsterStats(alignedKind, { difficulty: 'normal', playerCount: 8 })
    expect(alignedStats.monsterPlayerCount).toBe(1)
    expect(alignedResolved.monsterPlayerCount).toBe(1)
  })

  it('caps TC NoDrop scaling when monster spawned at g=1 is killed at g=8, while g=8 spawn scales to n=4', () => {
    const tables = getEmbeddedDropTables()
    // Act 1 H2H A has NoDrop = 100, TotalProb = 60:
    // At n=1: scaledNoDrop = 100 (totalWeight = 160)
    // At n=4: scaledNoDrop = 10  (totalWeight = 70)
    expect(computeScaledNoDrop(100, 60, computeEffectivePlayers(8, 1, 1))).toBe(100)
    expect(computeScaledNoDrop(100, 60, computeEffectivePlayers(8, 1, 8))).toBe(10)

    // Find a deterministic seed where rollTreasureClass('Act 1 H2H A') drops 0 items at n=1 (roll in [10, 99])
    // but drops 1 item at n=4 (where scaledNoDrop = 10).
    let differentiatingSeed = 0
    for (let s = 1; s < 5000; s++) {
      const r = new D2Rng(s).rand(160)
      const r4 = new D2Rng(s).rand(70)
      if (r >= 10 && r < 100 && r4 >= 10) {
        differentiatingSeed = s
        break
      }
    }
    expect(differentiatingSeed).toBeGreaterThan(0)

    // 1. Monster spawned at g=1 (monsterPlayerCount=1), killed at g=8, p=1 -> n=1 -> NoDrop!
    const dropsSpawnedAt1 = rollTreasureClass('Act 1 H2H A', {
      rng: new D2Rng(differentiatingSeed),
      tcTable: tables.tcTable,
      autoTcTable: tables.autoTcTable,
      gamePlayers: 8,
      partyPlayers: 1,
      monsterPlayerCount: 1,
    })
    const dropsPureSolo = rollTreasureClass('Act 1 H2H A', {
      rng: new D2Rng(differentiatingSeed),
      tcTable: tables.tcTable,
      autoTcTable: tables.autoTcTable,
      gamePlayers: 1,
      partyPlayers: 1,
      monsterPlayerCount: 1,
    })
    expect(dropsSpawnedAt1).toEqual(dropsPureSolo)
    expect(dropsSpawnedAt1.length).toBe(0)

    // 2. Monster spawned at g=8 (monsterPlayerCount=8), killed at g=8, p=1 -> n=4 -> drops an item!
    const dropsSpawnedAt8 = rollTreasureClass('Act 1 H2H A', {
      rng: new D2Rng(differentiatingSeed),
      tcTable: tables.tcTable,
      autoTcTable: tables.autoTcTable,
      gamePlayers: 8,
      partyPlayers: 1,
      monsterPlayerCount: 8,
    })
    expect(dropsSpawnedAt8.length).toBe(1)

    // 3. Chest / container drop (monsterPlayerCount omitted) at g=8, p=1 -> n=4 -> drops an item!
    const chestDropsAt8 = rollTreasureClass('Act 1 H2H A', {
      rng: new D2Rng(differentiatingSeed),
      tcTable: tables.tcTable,
      autoTcTable: tables.autoTcTable,
      gamePlayers: 8,
      partyPlayers: 1,
    })
    expect(chestDropsAt8).toEqual(dropsSpawnedAt8)
  })

  it('threads monsterPlayerCount through resolveMonsterDropPending113c, executePendingMonsterDrop113c, and executeDropPipeline', () => {
    const tables = getEmbeddedDropTables()
    const seed = 0x12345678

    let p1Total = 0
    let p8CappedAt1Total = 0
    let p8SpawnedAt8Total = 0

    for (let i = 1; i <= 100; i++) {
      const s = (seed + i * 7919) >>> 0
      const pending1 = resolveMonsterDropPending113c(
        undefined,
        {
          kind: 'kill',
          x: 100,
          y: 100,
          subjectId: 'fallen1',
          monsterIndex: i,
          monsterLevel: 1,
          monsterRank: 'normal',
        },
        {
          dropTables: tables,
          difficulty: 'normal',
          gamePlayers: 1,
          partyPlayers: 1,
          monsterPlayerCount: 1,
        },
      )!
      const pending8Capped = resolveMonsterDropPending113c(
        undefined,
        {
          kind: 'kill',
          x: 100,
          y: 100,
          subjectId: 'fallen1',
          monsterIndex: i,
          monsterLevel: 1,
          monsterRank: 'normal',
        },
        {
          dropTables: tables,
          difficulty: 'normal',
          gamePlayers: 8,
          partyPlayers: 1,
          monsterPlayerCount: 1,
        },
      )!
      const pending8Full = resolveMonsterDropPending113c(
        undefined,
        {
          kind: 'kill',
          x: 100,
          y: 100,
          subjectId: 'fallen1',
          monsterIndex: i,
          monsterLevel: 1,
          monsterRank: 'normal',
        },
        {
          dropTables: tables,
          difficulty: 'normal',
          gamePlayers: 8,
          partyPlayers: 1,
          monsterPlayerCount: 8,
        },
      )!

      expect(pending8Capped.killerContext.monsterPlayerCount).toBe(1)
      expect(pending8Full.killerContext.monsterPlayerCount).toBe(8)

      const items1 = executePendingMonsterDrop113c(tables, pending1, 'normal', s)
      const items8Capped = executePendingMonsterDrop113c(tables, pending8Capped, 'normal', s)
      const items8Full = executePendingMonsterDrop113c(tables, pending8Full, 'normal', s)

      expect(items8Capped.map(it => it.code)).toEqual(items1.map(it => it.code))
      p1Total += items1.length
      p8CappedAt1Total += items8Capped.length
      p8SpawnedAt8Total += items8Full.length
    }

    expect(p8CappedAt1Total).toBe(p1Total)
    expect(p8SpawnedAt8Total).toBeGreaterThan(p8CappedAt1Total)
  })

  it('preserves spawn-time monsterPlayerCount in GameInstance across setPlayersX(8) while keeping chest drops uncapped', () => {
    const game = new GameInstance({ areaId: 2, playersX: 1, mapSeed: 0x424242 })
    game.connectPlayer({ charName: 'Hero', classId: 1, areaId: 2, x: 100, y: 100 })

    // Spawn monster at g=1 before /players 8
    const monAt1 = game.spawnMonster({ defId: 'fallen1', x: 105, y: 100, areaId: 2 })
    expect(game.getMonsterState(monAt1)?.monsterPlayerCount).toBe(1)

    // Switch to /players 8: existing monster's monsterPlayerCount must remain 1,
    // while newly spawned monster records monsterPlayerCount = 8.
    game.setPlayersX(8)
    expect(game.getMonsterState(monAt1)?.monsterPlayerCount).toBe(1)

    const monAt8 = game.spawnMonster({ defId: 'fallen1', x: 110, y: 100, areaId: 2 })
    expect(game.getMonsterState(monAt8)?.monsterPlayerCount).toBe(8)

    // NPC always has monsterPlayerCount = 1 even when spawned at /players 8
    const npcAt8 = game.spawnMonster({ classId: 148, x: 115, y: 100, areaId: 1, isNpc: true })
    expect(game.getMonsterState(npcAt8)?.monsterPlayerCount).toBe(1)
  })

  it('records spawn-time monsterPlayerCount on GameEngine monsters and caps pendingDrop when gamePlayers increases later', () => {
    const tables = getEmbeddedDropTables()
    const engine = new GameEngine('sor')
    engine.opts.dropTables = tables
    engine.setPlayers(1, 1)

    const m1 = engine.spawnMonster('fallen1', 120, 100)
    expect(m1.monsterPlayerCount).toBe(1)

    // Increase player count to 8 after m1 was already spawned
    engine.setPlayers(8, 8)
    const m8 = engine.spawnMonster('fallen1', 140, 100)
    expect(m8.monsterPlayerCount).toBe(8)
    expect(m1.monsterPlayerCount).toBe(1)
  })
})
