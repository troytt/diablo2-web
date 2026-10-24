import { describe, expect, it } from 'vitest'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import type { Monster } from '../src/server/ai/monster-ai.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'

describe('Issue #420: Death Animation Frame Gating (1.13c Parity)', () => {
  const dropTables = getEmbeddedDropTables()

  function createTestEngine(overrides?: any) {
    const engine = new GameEngine(
      { widthPx: 1000, heightPx: 1000, overlap: () => 0 },
      {
        spawn: { x: 500, y: 500 },
        stats: [],
        xpTable: [0, 500, 1500],
        skills: [],
        npcDefs: [],
        questDefs: [],
        combatOptions: {
          playerSpeed: 4,
          playerReach: 50,
          playerCooldownTicks: 10,
          playerDamage: 100,
          playerManaPerAttack: 1,
          respawnTicks: 100,
        },
        talkRadius: 50,
        pickupRadius: 30,
        inventoryCols: 10,
        inventoryRows: 4,
        lootSeed: 42,
        dropTables,
        ...overrides,
      },
    )
    engine.setDropTables(dropTables)
    return engine
  }

  function createTestMonster(
    index: number,
    id: string,
    x: number,
    y: number,
    hp = 20,
    rank: 'normal' | 'champion' | 'unique' | 'minion' = 'normal',
    superUniqueId?: string,
  ): Monster {
    return {
      index,
      stats: {
        id,
        name: id,
        hp,
        damage: 1,
        cooldownTicks: 10,
        reach: 20,
        aggroRadius: 100,
        speed: 10,
        xp: 10,
        level: 5,
        rank,
        ...(superUniqueId !== undefined ? { superUniqueId } : {}),
      },
      x,
      y,
      hp,
      cooldown: 0,
      state: 'idle',
      facing: 0,
      hitFlash: 0,
      corpseTicks: 0,
      dropRolled: false,
    }
  }

  const emptyInput = {
    movement: { x: 0, y: 0 },
    attacking: false,
    pickingUp: false,
    talking: false,
    digits: [],
    saving: false,
    loading: false,
  }

  describe('Suite 1: Death Animation Drop Gating Invariant', () => {
    it('1.1: drops do NOT spawn on the lethal damage tick when deathGated is true', () => {
      const engine = createTestEngine()
      const monster = createTestMonster(0, 'zombie1', 520, 500, 20)
      monster.deathGated = true
      engine.world.monsters.push(monster)

      // Apply lethal damage
      const killed = engine.damageMonster(0, 999)
      expect(killed).toBe(true)
      expect(monster.state).toBe('dead')
      expect(monster.animMode).toBe('dt')

      // Tick the engine to process kill event
      engine.tick(emptyInput)

      // Ground items must NOT have spawned yet
      expect(engine.groundItems.count).toBe(0)
      expect(monster.dropRolled).toBeFalsy()
      expect(monster.pendingDrop).toBeDefined()
      expect(monster.pendingDrop?.monsterIndex).toBe(0)
    })

    it('1.2: drops do NOT spawn on the lethal damage tick when deathTicks > 0', () => {
      const engine = createTestEngine()
      const monster = createTestMonster(0, 'zombie1', 520, 500, 20)
      monster.deathTicks = 5
      engine.world.monsters.push(monster)

      engine.damageMonster(0, 999)
      engine.tick(emptyInput)

      expect(engine.groundItems.count).toBe(0)
      expect(monster.dropRolled).toBeFalsy()
      expect(monster.pendingDrop).toBeDefined()
    })
  })

  describe('Suite 2: Final Frame Drop Trigger & Headless Countdown', () => {
    it('2.1: advances deathTicks countdown and triggers drop when ticks reach 0', () => {
      const engine = createTestEngine()
      const monster = createTestMonster(0, 'fallen1', 520, 500, 20)
      monster.deathTicks = 3
      engine.world.monsters.push(monster)

      engine.damageMonster(0, 999)

      // Tick 1: deathTicks becomes 2 (queued in tick 1)
      engine.tick(emptyInput)
      expect(monster.deathTicks).toBe(2)
      expect(engine.groundItems.count).toBe(0)

      // Tick 2: deathTicks becomes 1
      engine.tick(emptyInput)
      expect(monster.deathTicks).toBe(1)
      expect(engine.groundItems.count).toBe(0)

      // Tick 3: deathTicks reaches 0 -> triggers drop!
      engine.tick(emptyInput)
      expect(monster.deathTicks).toBe(0)
      expect(monster.dropRolled).toBe(true)
      expect(monster.animMode).toBe('dd')
      expect(monster.pendingDrop).toBeUndefined()
      expect(engine.metrics.dropsRolled).toBeGreaterThanOrEqual(1)
      expect(engine.groundItems.count).toBeGreaterThanOrEqual(1)
    })

    it('2.2: explicit triggerMonsterDrop spawns items immediately when called on animation finish', () => {
      const engine = createTestEngine()
      const monster = createTestMonster(0, 'skeleton1', 520, 500, 20)
      monster.deathGated = true
      engine.world.monsters.push(monster)

      engine.damageMonster(0, 999)
      engine.tick(emptyInput)

      expect(engine.groundItems.count).toBe(0)
      expect(monster.pendingDrop).toBeDefined()

      // Simulate ActorAnimator completing DT sequence
      const dropped = engine.triggerMonsterDrop(monster)
      expect(monster.dropRolled).toBe(true)
      expect(monster.animMode).toBe('dd')
      expect(monster.pendingDrop).toBeUndefined()
      expect(dropped.length).toBe(engine.groundItems.count)
      expect(dropped.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Suite 3: Killer Context Locking & Exploit Prevention', () => {
    it('3.1: preserves player MF/GF from lethal strike, ignoring weapon swaps during DT', () => {
      const engine = createTestEngine({
        equippedItems: [
          {
            name: 'Goldwrap',
            stats: [{ text: '80% Extra Gold' }, { text: '30% Better Chance of Getting Magic Items' }],
          },
        ],
      })
      const monster = createTestMonster(0, 'fallen1', 520, 500, 20)
      monster.deathTicks = 4
      engine.world.monsters.push(monster)

      engine.damageMonster(0, 999)
      engine.tick(emptyInput)

      expect(monster.pendingDrop).toBeDefined()
      expect(monster.pendingDrop?.killerContext.playerMf).toBe(30)
      expect(monster.pendingDrop?.killerContext.playerGf).toBe(80)

      // Player swaps to naked weapon (0 MF/GF) during death animation
      ;(engine.opts as any).equippedItems = []

      // Advance through remainder of death animation
      for (let i = 0; i < 4; i++) {
        engine.tick(emptyInput)
      }

      expect(monster.dropRolled).toBe(true)
    })
  })

  describe('Suite 4: Instant Fallback & Single-Drop Gate', () => {
    it('4.1: monsters without deathGated or deathTicks drop immediately on kill tick', () => {
      const engine = createTestEngine()
      const monster = createTestMonster(0, 'zombie1', 520, 500, 20)
      engine.world.monsters.push(monster)

      expect(monster.deathGated).toBeUndefined()
      expect(monster.deathTicks).toBeUndefined()

      engine.damageMonster(0, 999)
      engine.tick(emptyInput)

      // Immediate drop
      expect(monster.dropRolled).toBe(true)
      expect(monster.animMode).toBe('dd')
      expect(engine.metrics.dropsRolled).toBe(1)
      expect(engine.groundItems.count).toBeGreaterThanOrEqual(1)
    })

    it('4.2: multiple damage hits or multiple triggerMonsterDrop calls never duplicate drops', () => {
      const engine = createTestEngine()
      const monster = createTestMonster(0, 'zombie1', 520, 500, 20)
      engine.world.monsters.push(monster)

      engine.damageMonster(0, 999)
      engine.tick(emptyInput)

      const initialCount = engine.groundItems.count
      expect(initialCount).toBeGreaterThanOrEqual(1)

      // Try hitting dead monster again
      const damagedAgain = engine.damageMonster(0, 999)
      expect(damagedAgain).toBe(false)

      // Try calling triggerMonsterDrop again
      const secondCall = engine.triggerMonsterDrop(monster)
      expect(secondCall).toEqual([])
      expect(engine.groundItems.count).toBe(initialCount)
      expect(engine.metrics.dropsRolled).toBe(1)
    })
  })
})
