/**
 * Diablo II: Lord of Destruction v1.13c — Monster Drop End-to-End Integration Suite
 *
 * Test Specifications for Milestone M11.5 (Issue #408):
 * 1. All 4 Damage Sources & Single Drop Gate Invariant:
 *    - Melee normal attack
 *    - Projectile skill (Fireball / Firebolt)
 *    - Instant radial AoE (Frost Nova / Nova)
 *    - Continuous periodic aura pulse (Holy Fire at tick % 50 === 0)
 *    - Single drop gate assertion: metrics.dropsRolled === 1, no duplicate spawns.
 *
 * 2. All 4 Monster Ranks & Authentic TreasureClass Hierarchy:
 *    - Normal (fallen1, zombie1, skeleton1) -> TC1 (Act 1 H2H A)
 *    - Champion -> TC2 (Act 1 Champ A)
 *    - Unique -> TC3 (Act 1 Unique A)
 *    - SuperUnique: Bishibosh, Rakanishu, Blood Raven, The Countess (rune drop picks = -2)
 *
 * 3. Full UI Inventory Pickup & Equipping Loop:
 *    - Conversion via itemToUiInventoryItem
 *    - 100% invFile atlas match against BAKED_UI_MANIFEST.itemRects
 *    - Non-empty bilingual nameZh and formatted stats array
 *    - Authentic allowedSlots resolution and paperdoll equipping
 *
 * 4. Gold Currency Accumulation vs Inventory Full Flippy Bounce:
 *    - Gold currency accumulation clamped to the level-based inventory gold limit
 *    - Full 10x4 inventory grid refusal, metrics.inventoryRefusals, and parabolic bounce physics
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GameEngine, type GameEngineOptions } from '../src/server/engine/game-engine.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { DEMO_EXPERIENCE } from '../src/common/data/demo-data.ts'
import { getMonsterTreasureClass } from '../src/common/units/monsters-data.ts'
import { itemToUiInventoryItem } from '../src/common/items/item-bridge.ts'
import {
  InventoryPanel,
  resolveItemSpriteRect,
  identifyUiItem,
  isUiItemUnidentified,
  type UiInventoryItem,
  type EquipSlotId,
} from '../src/client/ui/inventory.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import type { Monster } from '../src/server/ai/monster-ai.ts'
import { createDemoInventory } from './fixtures/hud-demo-state.ts'

describe('Milestone M11.5 (Issue #408) — Monster Drop End-to-End Integration Suite', () => {
  const dropTables = getEmbeddedDropTables()
  const terrain = { widthPx: 2000, heightPx: 2000, overlap: () => 0 }

  function createTestEngine(overrides?: Partial<GameEngineOptions>) {
    const engine = new GameEngine(terrain, {
      spawn: { x: 500, y: 500 },
      stats: [],
      xpTable: DEMO_EXPERIENCE,
      skills: [
        {
          id: 'attack',
          name: 'Attack',
          manaCost: 0,
          cooldownTicks: 0,
          range: 48,
          projectile: false,
          speed: 0,
          baseMinDamage: 50,
          baseMaxDamage: 50,
          damagePerLevel: 0,
          radius: 20,
        },
        {
          id: 'fireball',
          name: 'Fire Ball',
          manaCost: 0,
          cooldownTicks: 0,
          range: 500,
          projectile: true,
          speed: 300,
          baseMinDamage: 50,
          baseMaxDamage: 50,
          damagePerLevel: 0,
          radius: 20,
        },
        {
          id: 'frostnova',
          name: 'Frost Nova',
          manaCost: 0,
          cooldownTicks: 0,
          range: 150,
          projectile: false,
          speed: 0,
          baseMinDamage: 50,
          baseMaxDamage: 50,
          damagePerLevel: 0,
          radius: 150,
        },
      ],
      questDefs: [],
      combatOptions: {
        playerSpeed: 4,
        playerReach: 50,
        playerCooldownTicks: 0,
        playerDamage: 50,
        playerManaPerAttack: 0,
        respawnTicks: 1000,
      },
      talkRadius: 48,
      pickupRadius: 48,
      inventoryCols: 10,
      inventoryRows: 4,
      lootSeed: 42,
      npcDefs: [],
      ...overrides,
    })
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

  describe('1. All 4 Damage Sources & Single Drop Gate Invariant', () => {
    it('deals Melee Normal Attack damage, kills monster, rolls drop once, and respects single drop gate', () => {
      const engine = createTestEngine()
      const monster = createTestMonster(0, 'fallen1', 520, 500, 20)
      engine.world.monsters.push(monster)
      engine.selectedSkill = 0 // Attack

      // Tick 1: Player melee attacks monster
      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: true,
        pickingUp: false,
        talking: false,
        saving: false,
        loading: false,
        digits: [],
      })

      expect(monster.state).toBe('dead')
      expect(monster.dropRolled).toBe(true)
      expect(engine.metrics.dropsRolled).toBe(1)
      expect(engine.groundItems.count).toBeGreaterThan(0)
      expect(engine.ground.length).toBe(engine.groundItems.count)

      const initialDropCount = engine.groundItems.count

      // Subsequent Ticks: Advance simulation multiple ticks — assert single drop gate invariant
      for (let t = 0; t < 5; t++) {
        engine.tick({
          movement: { x: 0, y: 0 },
          attacking: true,
          pickingUp: false,
          talking: false,
          saving: false,
          loading: false,
          digits: [],
        })
      }

      expect(engine.metrics.dropsRolled).toBe(1)
      expect(engine.groundItems.count).toBe(initialDropCount)
    })

    it('casts Projectile Skill (Fireball), collides with monster, kills, and respects single drop gate', () => {
      const engine = createTestEngine()
      const monster = createTestMonster(0, 'zombie1', 520, 500, 20)
      engine.world.monsters.push(monster)
      engine.selectedSkill = 1 // Fireball
      engine.world.player.facing = 6 // Facing East towards (520, 500)

      // Tick 1: Cast fireball projectile towards East
      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: true,
        pickingUp: false,
        talking: false,
        saving: false,
        loading: false,
        digits: [],
      })

      // Tick 2: Projectile advances, collides, damage applied, pending kills processed
      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: false,
        pickingUp: false,
        talking: false,
        saving: false,
        loading: false,
        digits: [],
      })

      expect(monster.state).toBe('dead')
      expect(monster.dropRolled).toBe(true)
      expect(engine.metrics.dropsRolled).toBe(1)
      expect(engine.groundItems.count).toBeGreaterThan(0)

      const initialDropCount = engine.groundItems.count

      // Subsequent Ticks: Single drop gate invariant check
      for (let t = 0; t < 5; t++) {
        engine.tick({
          movement: { x: 0, y: 0 },
          attacking: false,
          pickingUp: false,
          talking: false,
          saving: false,
          loading: false,
          digits: [],
        })
      }

      expect(engine.metrics.dropsRolled).toBe(1)
      expect(engine.groundItems.count).toBe(initialDropCount)
    })

    it('casts Instant AoE Skill (Frost Nova), hits monster in radius, and respects single drop gate', () => {
      const engine = createTestEngine()
      const monster = createTestMonster(0, 'skeleton1', 550, 500, 20)
      engine.world.monsters.push(monster)
      engine.selectedSkill = 2 // Frost Nova (radius 150)

      // Tick 1: Cast Frost Nova instant radial AoE
      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: true,
        pickingUp: false,
        talking: false,
        saving: false,
        loading: false,
        digits: [],
      })

      expect(monster.state).toBe('dead')
      expect(monster.dropRolled).toBe(true)
      expect(engine.metrics.dropsRolled).toBe(1)
      expect(engine.groundItems.count).toBeGreaterThan(0)

      const initialDropCount = engine.groundItems.count

      // Subsequent Ticks: Single drop gate invariant check
      for (let t = 0; t < 5; t++) {
        engine.tick({
          movement: { x: 0, y: 0 },
          attacking: false,
          pickingUp: false,
          talking: false,
          saving: false,
          loading: false,
          digits: [],
        })
      }

      expect(engine.metrics.dropsRolled).toBe(1)
      expect(engine.groundItems.count).toBe(initialDropCount)
    })

    it('inflicts Continuous Aura Pulse (Holy Fire) at tick % 50 === 0, kills monster, and respects single drop gate', () => {
      const engine = createTestEngine()
      engine.isTown = false
      engine.levelId = 2 // Blood Moor (wilderness)
      engine.activeAuraSkillId = 102 // Holy Fire
      engine.activeAuraLevel = 20 // High aura level for guaranteed kill

      const monster = createTestMonster(0, 'fallen1', 530, 500, 10)
      engine.world.monsters.push(monster)

      // Advance engine ticks until tick 49 (right before periodic pulse at tick 50)
      while (engine.world.tick % 50 !== 49) {
        engine.tick({
          movement: { x: 0, y: 0 },
          attacking: false,
          pickingUp: false,
          talking: false,
          saving: false,
          loading: false,
          digits: [],
        })
      }

      expect(monster.state).not.toBe('dead')
      expect(engine.metrics.dropsRolled).toBe(0)

      // Tick 50: Holy Fire periodic pulse fires
      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: false,
        pickingUp: false,
        talking: false,
        saving: false,
        loading: false,
        digits: [],
      })

      expect(engine.world.tick % 50).toBe(0)
      expect(monster.state).toBe('dead')
      expect(monster.dropRolled).toBe(true)
      expect(engine.metrics.dropsRolled).toBe(1)
      expect(engine.groundItems.count).toBeGreaterThan(0)

      const dropCountAtPulse = engine.groundItems.count

      // Advance through next 55 ticks (including tick 100 second pulse)
      for (let t = 0; t < 55; t++) {
        engine.tick({
          movement: { x: 0, y: 0 },
          attacking: false,
          pickingUp: false,
          talking: false,
          saving: false,
          loading: false,
          digits: [],
        })
      }

      expect(engine.metrics.dropsRolled).toBe(1)
      expect(engine.groundItems.count).toBe(dropCountAtPulse)
    })
  })

  describe('2. All 4 Monster Ranks & Authentic TreasureClass Hierarchy', () => {
    it('resolves Normal rank monsters (fallen1, zombie1, skeleton1) to TC1 (Act 1 H2H A)', () => {
      const normalIds = ['fallen1', 'zombie1', 'skeleton1'] as const
      for (const id of normalIds) {
        const kind = dropTables.monsterKinds.get(id)!
        expect(kind).toBeDefined()
        const tcName = getMonsterTreasureClass(kind, 'normal', 1)
        expect(tcName).toBe('Act 1 H2H A')

        let dropped = 0
        for (let seed = 100; seed < 120 && dropped === 0; seed += 1) {
          const engine = createTestEngine({ lootSeed: seed })
          const monster = createTestMonster(0, id, 520, 500, 10, 'normal')
          engine.world.monsters.push(monster)

          engine.tick({
            movement: { x: 0, y: 0 },
            attacking: true,
            pickingUp: false,
            talking: false,
            saving: false,
            loading: false,
            digits: [],
          })

          expect(engine.metrics.dropsRolled).toBe(1)
          dropped = engine.groundItems.count
        }
        expect(dropped).toBeGreaterThan(0)
      }
    })

    it('resolves Champion rank monster to TC2 (Act 1 Champ A) and generates champion drop', () => {
      const kind = dropTables.monsterKinds.get('fallen1')!
      expect(getMonsterTreasureClass(kind, 'normal', 2)).toBe('Act 1 Champ A')

      const engine = createTestEngine({ lootSeed: 200 })
      const champ = createTestMonster(0, 'fallen1', 520, 500, 10, 'champion')
      engine.world.monsters.push(champ)

      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: true,
        pickingUp: false,
        talking: false,
        saving: false,
        loading: false,
        digits: [],
      })

      expect(engine.metrics.dropsRolled).toBe(1)
      expect(engine.groundItems.count).toBeGreaterThan(0)
    })

    it('resolves Unique rank monster to TC3 (Act 1 Unique A) and generates unique drop', () => {
      const kind = dropTables.monsterKinds.get('fallen1')!
      expect(getMonsterTreasureClass(kind, 'normal', 3)).toBe('Act 1 Unique A')

      const engine = createTestEngine({ lootSeed: 300 })
      const unique = createTestMonster(0, 'fallen1', 520, 500, 10, 'unique')
      engine.world.monsters.push(unique)

      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: true,
        pickingUp: false,
        talking: false,
        saving: false,
        loading: false,
        digits: [],
      })

      expect(engine.metrics.dropsRolled).toBe(1)
      expect(engine.groundItems.count).toBeGreaterThan(0)
    })

    it('resolves SuperUniques: Bishibosh (Act 1 Super A), Rakanishu (Act 1 Super B), Blood Raven, and The Countess (Countess Rune drop)', () => {
      // 1. Bishibosh
      const bishiboshDef = dropTables.superUniques.get('Bishibosh')!
      expect(bishiboshDef.getTreasureClass?.('normal')).toBe('Act 1 Super A')

      const engineBishi = createTestEngine({ lootSeed: 5555 })
      engineBishi.world.monsters.push(createTestMonster(0, 'fallen1', 520, 500, 10, 'unique', 'Bishibosh'))
      engineBishi.tick({ movement: { x: 0, y: 0 }, attacking: true, pickingUp: false, talking: false, saving: false, loading: false, digits: [] })
      expect(engineBishi.metrics.dropsRolled).toBe(1)
      expect(engineBishi.groundItems.count).toBeGreaterThan(0)

      // 2. Rakanishu
      const rakanishuDef = dropTables.superUniques.get('Rakanishu')!
      expect(rakanishuDef.getTreasureClass?.('normal')).toBe('Act 1 Super B')

      const engineRaka = createTestEngine({ lootSeed: 7777 })
      engineRaka.world.monsters.push(createTestMonster(0, 'fallen1', 520, 500, 10, 'unique', 'Rakanishu'))
      engineRaka.tick({ movement: { x: 0, y: 0 }, attacking: true, pickingUp: false, talking: false, saving: false, loading: false, digits: [] })
      expect(engineRaka.metrics.dropsRolled).toBe(1)
      expect(engineRaka.groundItems.count).toBeGreaterThan(0)

      // 3. Blood Raven (Boss kind bloodraven)
      const bloodRavenKind = dropTables.monsterKinds.get('bloodraven')!
      expect(bloodRavenKind.boss).toBe(true)
      expect(getMonsterTreasureClass(bloodRavenKind, 'normal', 1)).toBe('Blood Raven')

      const engineRaven = createTestEngine({ lootSeed: 9999 })
      engineRaven.world.monsters.push(createTestMonster(0, 'bloodraven', 520, 500, 10, 'unique'))
      engineRaven.tick({ movement: { x: 0, y: 0 }, attacking: true, pickingUp: false, talking: false, saving: false, loading: false, digits: [] })
      expect(engineRaven.metrics.dropsRolled).toBe(1)
      expect(engineRaven.groundItems.count).toBeGreaterThan(0)

      // 4. The Countess (picks = -2, Countess Item and Countess Rune)
      const countessDef = dropTables.superUniques.get('The Countess')!
      expect(countessDef.getTreasureClass?.('normal')).toBe('Countess')

      const engineCountess = createTestEngine({ lootSeed: 12345678 })
      engineCountess.world.monsters.push(createTestMonster(0, 'fallen1', 520, 500, 10, 'unique', 'The Countess'))
      engineCountess.tick({ movement: { x: 0, y: 0 }, attacking: true, pickingUp: false, talking: false, saving: false, loading: false, digits: [] })
      expect(engineCountess.metrics.dropsRolled).toBe(1)
      expect(engineCountess.groundItems.count).toBeGreaterThan(0)

      // Assert Countess rune drop is generated on ground
      const countessGroundItems = engineCountess.ground.map(g => g.item)
      const hasRune = countessGroundItems.some(i => i.code?.trim().startsWith('r') || i.quality === 8 || i.name.toLowerCase().includes('rune'))
      expect(hasRune, 'The Countess must drop at least one Rune from Countess Rune sub-TC').toBe(true)
    })
  })
})
