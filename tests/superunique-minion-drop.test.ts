import { describe, it, expect, vi } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { loadDropTables } from '../src/common/items/drop-tables.ts'
import * as dropPipeline from '../src/common/items/drop-tables.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import { damageMonster } from '../src/server/ai/monster-ai.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { getMonsterTreasureClass } from '../src/common/units/monsters-data.ts'
import * as treasureClass from '../src/common/items/treasure-class.ts'
import * as fs from 'node:fs'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

describe('SuperUnique Multi-Difficulty TC & Minion Drop Inheritance (Issue #411)', () => {
  const dropTables = getEmbeddedDropTables()

  const dummyTerrain = {
    widthPx: 1000,
    heightPx: 1000,
    overlap: () => 0,
  }

  function createTestEngine(difficulty: 'normal' | 'nightmare' | 'hell' = 'normal') {
    return new GameEngine(dummyTerrain, {
      spawn: { x: 0, y: 0 },
      stats: [],
      xpTable: [0, 100, 200],
      dropTables,
      difficulty,
      skills: [],
      npcDefs: [],
      questDefs: [],
      combatOptions: {} as any,
      talkRadius: 50,
      pickupRadius: 50,
      inventoryCols: 10,
      inventoryRows: 4,
    })
  }

  function lastDropArgs(spy: any) {
    expect(spy).toHaveBeenCalled()
    const calls = spy.mock.calls
    return calls[calls.length - 1][1]
  }

  it('SuperUnique boss drops from SuperUnique TC while minion inherits host TreasureClass3', () => {
    const engine = createTestEngine('normal')
    const dropSpy = vi.spyOn(dropPipeline, 'executeDropPipeline')

    // Bishibosh has TC: 'Act 1 Super A'.
    // Bishibosh host class is fallenshaman1. Minions are fallen1.
    // fallen1 TreasureClass3 is 'Act 1 Unique A'.
    const bishibosh = dropTables.superUniques.get('Bishibosh')!
    expect(bishibosh).toBeDefined()
    expect(bishibosh.getTreasureClass?.('normal')).toBe('Act 1 Super A')

    const fallenKind = dropTables.monsterKinds.get('fallen1')!
    expect(fallenKind).toBeDefined()
    const fallenTc3 = getMonsterTreasureClass(fallenKind, 'normal', 3)
    expect(fallenTc3).toBe('Act 1 Unique A')

    // Simulate Bishibosh boss kill: superUniqueId is set, monsterRank is 'unique'
    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 50,
        y: 50,
        subjectId: 'fallenshaman1',
        monsterRank: 'unique',
        superUniqueId: 'Bishibosh',
        monsterLevel: 10,
      } as any,
    ]
    engine.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      saving: false,
      loading: false,
      digits: [],
    })
    expect(engine.metrics.dropsRolled).toBe(1)
    const bossArgs = lastDropArgs(dropSpy)
    expect(bossArgs.tcName).toBe('Act 1 Super A')
    expect(bossArgs.monsterType).toBe(3)
    expect(bossArgs.isBoss).toBe(false)

    // Simulate Bishibosh MINION kill: superUniqueId is set, but monsterRank is 'minion'
    // Minion MUST inherit host Unique monster TreasureClass3 instead of Bishibosh boss TC ('Act 1 Super A')
    const minionEngine = createTestEngine('normal')
    minionEngine.world.pendingKills = [
      {
        kind: 'kill',
        x: 60,
        y: 60,
        subjectId: 'fallen1',
        monsterRank: 'minion',
        superUniqueId: 'Bishibosh',
        monsterLevel: 10,
      } as any,
    ]
    minionEngine.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      saving: false,
      loading: false,
      digits: [],
    })
    expect(minionEngine.metrics.dropsRolled).toBe(1)
    const minionArgs = lastDropArgs(dropSpy)
    expect(minionArgs.tcName).toBe('Act 1 Unique A')
    expect(minionArgs.monsterType).toBe(3)
    expect(minionArgs.isBoss).toBe(false)
    dropSpy.mockRestore()
  })

  it('real combat damageMonster killing a minion emits monsterType 3 and resolves TreasureClass3', () => {
    const engine = createTestEngine('normal')
    const dropSpy = vi.spyOn(dropPipeline, 'executeDropPipeline')

    // Put a minion in the world
    engine.world.monsters.push({
      index: 0,
      stats: {
        id: 'fallen1',
        name: 'Fallen Minion',
        hp: 15,
        maxHp: 15,
        speed: 5,
        rank: 'minion',
        level: 8,
        xp: 20,
        superUniqueId: 'Bishibosh',
        resistances: {} as any,
      } as any,
      x: 100,
      y: 100,
      hp: 15,
      cooldown: 0,
      state: 'idle',
      facing: 0,
      hitFlash: 0,
      corpseTicks: 0,
    })

    // Kill the minion via combat damage
    const killed = damageMonster(engine.world, 0, 999)
    expect(killed).toBe(true)

    // Verify buildKillEvent set monsterType to 3 for rank === 'minion'
    expect(engine.world.pendingKills).toHaveLength(1)
    expect(engine.world.pendingKills![0]!.monsterRank).toBe('minion')
    expect(engine.world.pendingKills![0]!.monsterType).toBe(3)

    // Advance engine tick to execute drop resolution
    engine.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      saving: false,
      loading: false,
      digits: [],
    })
    expect(engine.metrics.dropsRolled).toBe(1)
    const dropArgs = lastDropArgs(dropSpy)
    expect(dropArgs.tcName).toBe('Act 1 Unique A')
    expect(dropArgs.monsterType).toBe(3)
    expect(dropArgs.isBoss).toBe(false)
    dropSpy.mockRestore()
  })

  it('stale or adversarial monsterType: 1 on a minion event is strictly overridden to 3', () => {
    const engine = createTestEngine('normal')
    const dropSpy = vi.spyOn(dropPipeline, 'executeDropPipeline')

    // Adversarially provide monsterType: 1 on a minion kill
    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 60,
        y: 60,
        subjectId: 'fallen1',
        monsterRank: 'minion',
        monsterType: 1, // Adversarial normal-monster type code
        superUniqueId: 'Bishibosh',
        monsterLevel: 10,
      } as any,
    ]
    engine.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      saving: false,
      loading: false,
      digits: [],
    })
    expect(engine.metrics.dropsRolled).toBe(1)
    // Must be overridden to 3 and resolve to TreasureClass3
    const dropArgs = lastDropArgs(dropSpy)
    expect(dropArgs.tcName).toBe('Act 1 Unique A')
    expect(dropArgs.monsterType).toBe(3)
    expect(dropArgs.isBoss).toBe(false)
    dropSpy.mockRestore()
  })

  it('SuperUnique minion inherits host TreasureClass3 on Nightmare and Hell difficulties', () => {
    const dropSpy = vi.spyOn(dropPipeline, 'executeDropPipeline')
    const fallenKind = dropTables.monsterKinds.get('fallen1')!
    const fallenNmTc3 = getMonsterTreasureClass(fallenKind, 'nightmare', 3)
    const fallenHellTc3 = getMonsterTreasureClass(fallenKind, 'hell', 3)
    expect(fallenNmTc3).toBe('Act 1 (N) Unique A')
    expect(fallenHellTc3).toBe('Act 1 (H) Unique A')

    // On Nightmare
    const engineNm = createTestEngine('nightmare')
    engineNm.world.pendingKills = [
      {
        kind: 'kill',
        x: 60,
        y: 60,
        subjectId: 'fallen1',
        monsterRank: 'minion',
        superUniqueId: 'Bishibosh',
        monsterLevel: 45,
      } as any,
    ]
    engineNm.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      saving: false,
      loading: false,
      digits: [],
    })
    expect(engineNm.metrics.dropsRolled).toBe(1)
    const nmArgs = lastDropArgs(dropSpy)
    expect(nmArgs.tcName).toBe('Act 1 (N) Unique A')
    expect(nmArgs.monsterType).toBe(3)
    expect(nmArgs.difficulty).toBe('nightmare')
    expect(nmArgs.isBoss).toBe(false)

    // On Hell
    const engineHell = createTestEngine('hell')
    engineHell.world.pendingKills = [
      {
        kind: 'kill',
        x: 60,
        y: 60,
        subjectId: 'fallen1',
        monsterRank: 'minion',
        superUniqueId: 'Bishibosh',
        monsterLevel: 85,
      } as any,
    ]
    engineHell.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      saving: false,
      loading: false,
      digits: [],
    })
    expect(engineHell.metrics.dropsRolled).toBe(1)
    const hellArgs = lastDropArgs(dropSpy)
    expect(hellArgs.tcName).toBe('Act 1 (H) Unique A')
    expect(hellArgs.monsterType).toBe(3)
    expect(hellArgs.difficulty).toBe('hell')
    expect(hellArgs.isBoss).toBe(false)
    dropSpy.mockRestore()
  })

  it('minion of a boss monster does NOT inherit isBoss = true', () => {
    const dropSpy = vi.spyOn(dropPipeline, 'executeDropPipeline')

    // Blood Raven has boss: true in MonStats.txt
    const bloodravenKind = dropTables.monsterKinds.get('bloodraven')!
    expect(bloodravenKind.boss).toBe(true)

    // Blood Raven boss kill
    const engine = createTestEngine('hell')
    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 50,
        y: 50,
        subjectId: 'bloodraven',
        monsterRank: 'unique',
        superUniqueId: 'Blood Raven',
        monsterLevel: 88,
      } as any,
    ]
    engine.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      saving: false,
      loading: false,
      digits: [],
    })
    const bossArgs = lastDropArgs(dropSpy)
    expect(bossArgs.tcName).toBe('Blood Raven (H)')
    expect(bossArgs.isBoss).toBe(true)

    // Blood Raven minion kill (zombie1)
    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 50,
        y: 50,
        subjectId: 'zombie1',
        monsterRank: 'minion',
        superUniqueId: 'Blood Raven',
        monsterLevel: 88,
      } as any,
    ]
    engine.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      saving: false,
      loading: false,
      digits: [],
    })
    // Minion must have isBoss: false so TC upgrading is permitted per 1.13c rules
    const minionArgs = lastDropArgs(dropSpy)
    expect(minionArgs.tcName).toBe('Act 1 (H) Unique A')
    expect(minionArgs.isBoss).toBe(false)
    expect(minionArgs.monsterType).toBe(3)
    dropSpy.mockRestore()
  })

  it('minion with missing subjectId gracefully falls back to host superUnique monsterId', () => {
    const dropSpy = vi.spyOn(dropPipeline, 'executeDropPipeline')
    const engine = createTestEngine('normal')

    // Bishibosh host monster is fallenshaman1
    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 60,
        y: 60,
        subjectId: '', // missing subjectId
        monsterRank: 'minion',
        superUniqueId: 'Bishibosh',
        monsterLevel: 10,
      } as any,
    ]
    engine.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      saving: false,
      loading: false,
      digits: [],
    })
    expect(engine.metrics.dropsRolled).toBe(1)
    // fallenshaman1 TreasureClass3 is 'Act 1 Unique A'
    const fallbackArgs = lastDropArgs(dropSpy)
    expect(fallbackArgs.tcName).toBe('Act 1 Unique A')
    expect(fallbackArgs.monsterType).toBe(3)
    dropSpy.mockRestore()
  })

  it('minion with missing subjectId and unknown superUniqueId fails fast with descriptive error', () => {
    const engine = createTestEngine('normal')
    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 60,
        y: 60,
        subjectId: '',
        monsterRank: 'minion',
        superUniqueId: 'NonExistentSuperUnique_XYZ',
        monsterLevel: 10,
      } as any,
    ]
    expect(() => {
      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: false,
        pickingUp: false,
        talking: false,
        saving: false,
        loading: false,
        digits: [],
      })
    }).toThrow(/GameEngine drop failure: unknown monster/)
  })

  it('superUniqueId resolves case-insensitively and tolerates whitespace for both boss and minion', () => {
    const dropSpy = vi.spyOn(dropPipeline, 'executeDropPipeline')
    const engine = createTestEngine('normal')

    // Boss with lowercase 'the countess'
    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 50,
        y: 50,
        subjectId: 'corruptrogue5',
        monsterRank: 'unique',
        superUniqueId: '  the countess  ',
        monsterLevel: 12,
      } as any,
    ]
    engine.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      saving: false,
      loading: false,
      digits: [],
    })
    expect(engine.metrics.dropsRolled).toBe(1)
    const countessArgs = lastDropArgs(dropSpy)
    expect(countessArgs.tcName).toBe('Countess')
    expect(countessArgs.monsterType).toBe(3)

    // Minion with lowercase 'bishibosh' and missing subjectId falls back to host monsterId
    const minionEngine = createTestEngine('normal')
    minionEngine.world.pendingKills = [
      {
        kind: 'kill',
        x: 60,
        y: 60,
        subjectId: '',
        monsterRank: 'minion',
        superUniqueId: 'bishibosh',
        monsterLevel: 10,
      } as any,
    ]
    minionEngine.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      saving: false,
      loading: false,
      digits: [],
    })
    expect(minionEngine.metrics.dropsRolled).toBe(1)
    const minionArgs = lastDropArgs(dropSpy)
    expect(minionArgs.tcName).toBe('Act 1 Unique A')
    expect(minionArgs.monsterType).toBe(3)
    dropSpy.mockRestore()
  })

  it('embeds noRatio from MonStats.txt and enforces noRatio TC upgrade suppression in GameEngine', () => {
    // 1. Embedded monsterKinds parity: claygolem, valkyrie, etc. have noRatio: true
    const claygolem = dropTables.monsterKinds.get('claygolem')!
    expect(claygolem).toBeDefined()
    expect(claygolem.noRatio).toBe(true)

    const valkyrie = dropTables.monsterKinds.get('valkyrie')!
    expect(valkyrie).toBeDefined()
    expect(valkyrie.noRatio).toBe(true)

    // Standard monsters do not have noRatio
    const fallen = dropTables.monsterKinds.get('fallen1')!
    expect(fallen).toBeDefined()
    expect(fallen.noRatio).toBeUndefined()

    // 2. GameEngine passes isNoRatio: true on kill to executeDropPipeline
    const dropSpy = vi.spyOn(dropPipeline, 'executeDropPipeline')
    const engine = createTestEngine('hell')

    // Mock a summon/pet with noRatio: true and a TC in an isolated map
    const testMonsterKind = {
      ...claygolem,
      getTreasureClass: () => 'Act 1 H2H A',
    }
    const isolatedKinds = new Map(dropTables.monsterKinds)
    isolatedKinds.set('test_pet', testMonsterKind as any)
    engine.opts.dropTables = {
      ...dropTables,
      monsterKinds: isolatedKinds,
    }

    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 50,
        y: 50,
        subjectId: 'test_pet',
        monsterRank: 'normal',
        monsterLevel: 80,
      } as any,
    ]
    engine.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      saving: false,
      loading: false,
      digits: [],
    })
    expect(engine.metrics.dropsRolled).toBe(1)
    const petDropArgs = lastDropArgs(dropSpy)
    expect(petDropArgs.isNoRatio).toBe(true)
    dropSpy.mockRestore()

    // 3. Verify executeDropPipeline suppresses TC group upgrade when isNoRatio is true
    const tcUpgradeSpy = vi.spyOn(treasureClass, 'resolveTreasureClassGroup')
    dropPipeline.executeDropPipeline({
      tcName: 'Act 1 H2H A',
      nLevel: 80,
      difficulty: 'hell',
      isNoRatio: true,
      dropTables,
      monsterRng: 12345,
    })
    expect(tcUpgradeSpy).not.toHaveBeenCalled()

    // Without isNoRatio, TC upgrade runs
    dropPipeline.executeDropPipeline({
      tcName: 'Act 1 H2H A',
      nLevel: 80,
      difficulty: 'hell',
      isNoRatio: false,
      dropTables,
      monsterRng: 12345,
    })
    expect(tcUpgradeSpy).toHaveBeenCalledWith(dropTables.tcTable, 'Act 1 H2H A', 80)
    tcUpgradeSpy.mockRestore()
  })

  it('audits all 66 SuperUniques and 734 MonsterKinds resolve authentic non-empty 1.13c TCs', () => {
    expect(dropTables.superUniques.size).toBe(66)
    expect(dropTables.monsterKinds.size).toBe(734)

    for (const [id, su] of dropTables.superUniques) {
      for (const diff of ['normal', 'nightmare', 'hell'] as const) {
        const tc = su.getTreasureClass ? su.getTreasureClass(diff) : su.treasureClass
        // ancientbarb1/2/3 in 1.13c SuperUniques.txt have blank TC column (they don't drop items)
        if (id.startsWith('Ancient Barbarian')) {
          continue
        }
        expect(tc, `SuperUnique ${id} on ${diff} should have valid TC`).toBeTruthy()
        expect(dropTables.tcTable.get(tc), `TC "${tc}" for ${id} on ${diff} must exist in tcTable`).toBeDefined()
      }
    }

    for (const [id, mon] of dropTables.monsterKinds) {
      for (const diff of ['normal', 'nightmare', 'hell'] as const) {
        for (const mType of [1, 2, 3, 4]) {
          const tc = mon.getTreasureClass ? mon.getTreasureClass(diff, mType) : ''
          // If a monster kind defines a TC, it must exist in tcTable
          if (tc) {
            expect(dropTables.tcTable.get(tc), `MonsterKind ${id} (diff: ${diff}, type: ${mType}) TC "${tc}" must exist in tcTable`).toBeDefined()
          }
        }
      }
    }
  })

  it('loadDropTables throws an explicit error when SuperUniques.txt cannot be read', async () => {
    if (!hasD2) return
    // Create an archive stack without SuperUniques.txt
    const incompleteArchives = new MountedArchives()
    incompleteArchives.add('d2data.mpq', await MpqArchive.open(await fileSource('samples/d2/d2data.mpq')))
    // d2data.mpq alone does NOT have SuperUniques.txt (which is in d2exp.mpq / Patch_D2.mpq)
    // Verify that loading fails fast with an explicit Error
    await expect(loadDropTables(incompleteArchives)).rejects.toThrow(/SuperUniques\.txt|mounted archives have no member/)
  })
})
