import { describe, it, expect, vi } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import * as dropPipeline from '../src/common/items/drop-tables.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import type { MonsterKind } from '../src/common/units/monsters-data.ts'

describe('Fail-Fast Drop Resolution & Elimination of Permissive Fallbacks (Issue #413)', () => {
  const dropTables = getEmbeddedDropTables()

  const dummyTerrain = {
    widthPx: 1000,
    heightPx: 1000,
    overlap: () => 0,
  }

  function createTestEngine(
    difficulty: 'normal' | 'nightmare' | 'hell' = 'normal',
    customMonsterKinds?: Map<string, MonsterKind>,
  ) {
    return new GameEngine(dummyTerrain, {
      spawn: { x: 0, y: 0 },
      stats: [],
      xpTable: [0, 100, 200],
      dropTables,
      difficulty,
      monsterKinds: customMonsterKinds,
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

  const idleInput = {
    movement: { x: 0, y: 0 },
    attacking: false,
    pickingUp: false,
    talking: false,
    saving: false,
    loading: false,
    digits: [],
  }

  it('1. throws descriptive error when death event has missing monsterLevel', () => {
    const engine = createTestEngine('normal')
    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 10,
        y: 10,
        subjectId: 'fallen1',
        monsterRank: 'normal',
      } as any,
    ]
    expect(() => engine.tick(idleInput)).toThrow(
      /GameEngine drop failure: missing or invalid monsterLevel for death event \(subjectId: "fallen1"/,
    )
  })

  it('2. throws descriptive error when death event has non-positive or NaN monsterLevel', () => {
    const engine = createTestEngine('normal')
    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 10,
        y: 10,
        subjectId: 'fallen1',
        monsterRank: 'normal',
        monsterLevel: 0,
      } as any,
    ]
    expect(() => engine.tick(idleInput)).toThrow(
      /GameEngine drop failure: missing or invalid monsterLevel/,
    )

    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 10,
        y: 10,
        subjectId: 'fallen1',
        monsterRank: 'normal',
        monsterLevel: -5,
      } as any,
    ]
    expect(() => engine.tick(idleInput)).toThrow(
      /GameEngine drop failure: missing or invalid monsterLevel/,
    )

    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 10,
        y: 10,
        subjectId: 'fallen1',
        monsterRank: 'normal',
        monsterLevel: Number.NaN,
      } as any,
    ]
    expect(() => engine.tick(idleInput)).toThrow(
      /GameEngine drop failure: missing or invalid monsterLevel/,
    )
  })

  it('3. throws descriptive error on unknown monster with no valid subjectId or superUniqueId', () => {
    const engine = createTestEngine('normal')
    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 10,
        y: 10,
        subjectId: 'non_existent_monster_kind_999',
        monsterRank: 'normal',
        monsterLevel: 10,
      } as any,
    ]
    expect(() => engine.tick(idleInput)).toThrow(
      /GameEngine drop failure: unknown monster \(subjectId: "non_existent_monster_kind_999", superUniqueId: "undefined"\) not found in canonical drop tables/,
    )
  })

  it('4. throws descriptive error when monster TC is corrupt or unresolvable', () => {
    const customKinds = new Map<string, MonsterKind>()
    customKinds.set('corrupt_boss', {
      id: 'corrupt_boss',
      baseId: 'corrupt_boss',
      name: 'Corrupt Boss',
      boss: true,
      levels: { normal: 10, nightmare: 40, hell: 70 },
      treasureClasses: ['Act 1 H2H A'],
      getTreasureClass: () => '',
    } as any)

    const engine = createTestEngine('normal', customKinds)
    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 10,
        y: 10,
        subjectId: 'corrupt_boss',
        monsterRank: 'unique',
        monsterLevel: 10,
      } as any,
    ]

    expect(() => engine.tick(idleInput)).toThrow(
      /GameEngine drop failure: corrupt or unresolvable treasure class for monster "corrupt_boss" on difficulty "normal"/,
    )
  })

  it('5. throws descriptive error when resolved TC is unregistered in drop tables', () => {
    const customKinds = new Map<string, MonsterKind>()
    customKinds.set('unregistered_tc_mob', {
      id: 'unregistered_tc_mob',
      baseId: 'unregistered_tc_mob',
      name: 'Unregistered TC Mob',
      levels: { normal: 10, nightmare: 40, hell: 70 },
      treasureClasses: ['Bogus NonExistent Treasure Class XYZ'],
    } as any)

    const engine = createTestEngine('normal', customKinds)
    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 10,
        y: 10,
        subjectId: 'unregistered_tc_mob',
        monsterRank: 'normal',
        monsterLevel: 10,
      } as any,
    ]

    expect(() => engine.tick(idleInput)).toThrow(
      /GameEngine drop failure: treasure class "Bogus NonExistent Treasure Class XYZ" resolved for monster "unregistered_tc_mob" not found in drop tables/,
    )
  })

  it('6. authentic non-dropping ambient critters (chicken, rat, bird) succeed with 0 drops without throwing', () => {
    const critters = ['chicken', 'rat', 'bird1', 'bird2']

    for (const critterId of critters) {
      const engine = createTestEngine('normal')
      engine.world.pendingKills = [
        {
          kind: 'kill',
          x: 10,
          y: 10,
          subjectId: critterId,
          monsterRank: 'normal',
          monsterLevel: 1,
        } as any,
      ]

      expect(() => engine.tick(idleInput)).not.toThrow()
      expect(engine.metrics.dropsRolled).toBe(0)
      expect(engine.ground.length).toBe(0)
    }
  })

  it('7. authentic non-dropping SuperUniques (Ancient Barbarians) succeed with 0 drops without throwing', () => {
    const ancients = ['Ancient Barbarian 1', 'Ancient Barbarian 2', 'Ancient Barbarian 3']

    for (const ancientId of ancients) {
      const engine = createTestEngine('normal')
      engine.world.pendingKills = [
        {
          kind: 'kill',
          x: 10,
          y: 10,
          subjectId: ancientId.toLowerCase().replace(/\s+/g, ''),
          superUniqueId: ancientId,
          monsterRank: 'unique',
          monsterLevel: 68,
        } as any,
      ]

      expect(() => engine.tick(idleInput)).not.toThrow()
      expect(engine.metrics.dropsRolled).toBe(0)
      expect(engine.ground.length).toBe(0)
    }
  })

  it('8. verifies no silent fallback to Act 1 H2H A occurs when TC resolution fails', () => {
    const dropSpy = vi.spyOn(dropPipeline, 'executeDropPipeline')
    const engine = createTestEngine('normal')

    engine.world.pendingKills = [
      {
        kind: 'kill',
        x: 10,
        y: 10,
        subjectId: 'invalid_entity_id',
        monsterRank: 'normal',
        monsterLevel: 10,
      } as any,
    ]

    expect(() => engine.tick(idleInput)).toThrow(/GameEngine drop failure: unknown monster/)
    expect(dropSpy).not.toHaveBeenCalled()
    dropSpy.mockRestore()
  })
})
