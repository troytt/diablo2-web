/**
 * Diablo II v1.13c Ground Items Pathfinding & Pickup Tests (Issue #391).
 */

import { describe, it, expect, vi } from 'vitest'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import { DEMO_EXPERIENCE, DEMO_SKILLS, DEMO_QUESTS } from '../src/common/data/demo-data.ts'
import type { GroundItemEntity } from '../src/common/items/ground-items.ts'
import { seedDemoBeltPotions } from './fixtures/demo-profile-data.ts'

function createTestEngine() {
  const terrain = { widthPx: 1000, heightPx: 1000, overlap: () => 0 }
  const engine = new GameEngine(terrain, {
    spawn: { x: 500, y: 500 },
    stats: [],
    xpTable: DEMO_EXPERIENCE,
    skills: DEMO_SKILLS,
    questDefs: DEMO_QUESTS,
    combatOptions: {
      playerSpeed: 4,
      playerReach: 50,
      playerCooldownTicks: 10,
      playerDamage: 5,
      playerManaPerAttack: 1,
      respawnTicks: 100,
    },
    talkRadius: 48,
    pickupRadius: 48,
    inventoryCols: 4,
    inventoryRows: 2, // Compact 4x2 grid for testing full capacity
    lootSeed: 42,
    npcDefs: [],
  })
  // Explicit legacy full belt (16 potions) so picked-up potions route to the bag, not the belt.
  seedDemoBeltPotions(engine.belt)
  return engine
}

describe('Ground Items Pickup & Pathfinding (Issue #391)', () => {
  describe('GameEngine Pickup Methods', () => {
    it('successfully picks up gold, increments metrics, and removes from groundItems', () => {
      const engine = createTestEngine()
      const gold = engine.dropGold(500, 510, 510, undefined, undefined, { fromWorld: true })
      expect(gold).not.toBeNull()
      expect(engine.groundItems.count).toBe(1)

      const res = engine.pickupGold(gold!.id)
      expect(res.success).toBe(true)
      expect(res.amount).toBe(500)
      expect(engine.groundItems.count).toBe(0)
      expect(engine.metrics.pickups).toBe(1)
    })

    it('returns false when picking up non-existent gold id', () => {
      const engine = createTestEngine()
      const res = engine.pickupGold('non-existent-gold')
      expect(res.success).toBe(false)
      expect(res.amount).toBe(0)
    })

    it('picks up an equipment item into the bag when space is available', () => {
      const engine = createTestEngine()
      const item = {
        id: 'test-sword',
        name: 'Short Sword',
        nameZh: '短剑',
        invWidth: 1,
        invHeight: 2,
      }
      const entity = engine.dropItem(item, 520, 520)
      expect(engine.groundItems.count).toBe(1)

      const res = engine.pickupItem(entity.id)
      expect(res.success).toBe(true)
      expect(res.item).toBe(entity)
      expect(engine.groundItems.count).toBe(0)
      expect(engine.metrics.pickups).toBe(1)
      expect(engine.bag.contents.length).toBe(1)
    })

    it('refuses pickup when the inventory bag is completely full', () => {
      const engine = createTestEngine() // 4x2 = 8 slots total
      // Fill the 4x2 bag with four 1x2 items
      for (let i = 0; i < 4; i++) {
        const added = engine.bag.add({
          id: `filler-${i}`,
          name: `Filler ${i}`,
          invWidth: 1,
          invHeight: 2,
        } as any)
        expect(added).not.toBeNull()
      }
      expect(engine.bag.contents.length).toBe(4)

      // Try dropping and picking up another 1x2 item
      const extraItem = {
        id: 'extra-axe',
        name: 'Hand Axe',
        nameZh: '手斧',
        invWidth: 1,
        invHeight: 2,
      }
      const entity = engine.dropItem(extraItem, 530, 530)
      expect(engine.groundItems.count).toBe(1)

      const res = engine.pickupItem(entity.id)
      expect(res.success).toBe(false)
      expect(res.reason).toBe('full')
      expect(engine.groundItems.count).toBe(1) // Still on ground
      expect(engine.metrics.inventoryRefusals).toBe(1)
    })
  })
})
