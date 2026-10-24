/**
 * Diablo II v1.13c Inventory Full Flippy Bounce & Feedback Tests (Issue #392).
 *
 * Requirements:
 * 1. Inventory Full Gate: pickup refused when no grid space, item preserved on ground, metrics incremented.
 * 2. Authentic Parabolic Flippy Bounce:
 *    - Primary phase: duration ~350ms, peak height ~28px.
 *    - Secondary phase: duration ~175ms, peak height ~7px.
 *    - Resting state after secondary bounce completes.
 * 3. Airborne Flippy Tumble & Grounded Shadow:
 *    - Shadow stays on the ground plane (item.y) while item rises to baseY = item.y - bounceH.
 *    - Width oscillation during airborne tumble.
 * 4. Visual Feedback & Notification:
 *    - "包裹已满。" status & center banner notification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import { DEMO_EXPERIENCE, DEMO_SKILLS, DEMO_QUESTS } from '../src/common/data/demo-data.ts'
import {
  calculateBounceHeight,
  triggerFlippyBounce,
  GroundItemManager,
  type GroundItemEntity,
} from '../src/common/items/ground-items.ts'
import type { SpriteRenderer } from '../src/client/render/renderer.ts'

function createSmallEngine() {
  const terrain = { widthPx: 1000, heightPx: 1000, overlap: () => 0 }
  return new GameEngine(terrain, {
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
    inventoryCols: 2,
    inventoryRows: 2, // 2x2 = 4 slots total
    lootSeed: 1234,
    npcDefs: [],
  })
}

describe('Issue #392 — Inventory Full Flippy Bounce & Feedback Ground Truth', () => {
  describe('1. Inventory Full Gate & Refusal Mechanics', () => {
    it('refuses pickup, preserves item on ground, increments inventoryRefusals and triggers bounce', () => {
      const engine = createSmallEngine()
      // Fill the 2x2 bag with two 1x2 items
      engine.bag.add({ id: 'item1', name: 'Item 1', invWidth: 1, invHeight: 2 } as any)
      engine.bag.add({ id: 'item2', name: 'Item 2', invWidth: 1, invHeight: 2 } as any)
      expect(engine.bag.contents.length).toBe(2)

      // Drop another 1x2 item
      const groundItem = engine.dropItem(
        { id: 'overflow-axe', name: 'Axe', nameZh: '巨斧', invWidth: 1, invHeight: 2 },
        510,
        510,
      )
      expect(engine.groundItems.count).toBe(1)
      const initialRefusals = engine.metrics.inventoryRefusals

      // Attempt pickup
      const res = engine.pickupItem(groundItem.id)
      expect(res.success).toBe(false)
      expect(res.reason).toBe('full')
      expect(res.item).toBe(groundItem)

      // Item remains on ground without deletion
      expect(engine.groundItems.count).toBe(1)
      expect(engine.metrics.inventoryRefusals).toBe(initialRefusals + 1)

      // Bounce state is triggered with authentic 1.13c properties
      expect(groundItem.bounceState).toBeDefined()
      expect(groundItem.bounceState!.phase).toBe('primary')
      expect(groundItem.bounceState!.durationMs).toBe(350)
      expect(groundItem.bounceState!.peakHeightPx).toBe(28)
    })
  })

  describe('2. Parabolic Flippy Bounce Trajectory Math', () => {
    it('calculates symmetrical parabolic height curve h(t) peaking at midpoint', () => {
      const bounce = {
        startTime: 1000,
        durationMs: 350,
        peakHeightPx: 28,
        phase: 'primary' as const,
      }

      // At start (t = 1000): height is 0
      expect(calculateBounceHeight(bounce, 1000)).toBe(0)

      // At apex midpoint (t = 1175): height is peakHeightPx (28px)
      expect(calculateBounceHeight(bounce, 1175)).toBeCloseTo(28, 2)

      // At quarter point (p = 0.25): 4 * 28 * 0.25 * 0.75 = 21px
      expect(calculateBounceHeight(bounce, 1000 + 350 * 0.25)).toBeCloseTo(21, 2)

      // At three-quarter point (p = 0.75): 4 * 28 * 0.75 * 0.25 = 21px
      expect(calculateBounceHeight(bounce, 1000 + 350 * 0.75)).toBeCloseTo(21, 2)

      // At completion (t >= 1350): height returns to 0
      expect(calculateBounceHeight(bounce, 1350)).toBe(0)
      expect(calculateBounceHeight(bounce, 1500)).toBe(0)
    })

    it('handles two-phase decay: primary -> secondary -> rested', () => {
      const mgr = new GroundItemManager()
      const item: GroundItemEntity = {
        id: 'test_item',
        item: {},
        name: 'Item',
        nameZh: '物品',
        quality: 'normal',
        isGold: false,
        amount: 1,
        invWidth: 1,
        invHeight: 1,
        dropTime: 0,
        x: 100,
        y: 100,
        cellX: 3,
        cellY: 3,
        sparklePhase: 0,
      }
      mgr.addEntity(item)

      // Trigger flippy bounce at t = 1000
      mgr.triggerBounce('test_item', 1000)
      expect(item.bounceState?.phase).toBe('primary')
      expect(item.bounceState?.peakHeightPx).toBe(28)
      expect(item.bounceState?.durationMs).toBe(350)

      // Step during primary bounce (t = 1200)
      mgr.update(1200, 200)
      expect(item.bounceState?.phase).toBe('primary')

      // Step past primary bounce (t = 1360): transitions to secondary bounce
      mgr.update(1360, 160)
      expect(item.bounceState?.phase).toBe('secondary')
      expect(item.bounceState?.peakHeightPx).toBe(7) // 25% of 28 = 7
      expect(item.bounceState?.durationMs).toBe(175) // 50% of 350 = 175

      // Step past secondary bounce (t = 1550): rested on ground
      mgr.update(1550, 190)
      expect(item.bounceState).toBeNull()
    })
  })
})
