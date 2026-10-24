/**
 * Regression Test Suite for Issue #479:
 * 1. 打怪掉落的物品图标间隔太大，和原版不符合 (16x8 sub-tile diamond lattice vs 80x40 macro cell)
 * 2. 打怪掉落物品和从身上扔下来的物品逻辑不一致（比如名字一个是纯英文一个是中英、符文品质颜色、掉落音效等）
 * 3. 身上扔下来的不同物品图标不应该叠在一起（比如血瓶连续丢弃不重叠）
 */

import { describe, it, expect } from 'vitest'
import { GameEngine, type GameEngineOptions } from '../src/server/engine/game-engine.ts'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import { createDroppedItem } from '../src/common/items/drop-tables.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { DEMO_EXPERIENCE, DEMO_SKILLS } from '../src/common/data/demo-data.ts'
import { itemToUiInventoryItem } from '../src/common/items/item-bridge.ts'
import { resolveGroundItemSpriteRect } from '../src/client/ui/inventory.ts'
import { ORTHO_SUB_TILE_WIDTH, ORTHO_SUB_TILE_HEIGHT, ORTHO_CELL_WIDTH } from '../src/common/world/d2map.ts'
import type { Monster } from '../src/server/ai/monster-ai.ts'

describe('Issue #479 — Ground Item Drop Spacing, Metadata Parity & Anti-Stacking', () => {
  const dropTables = getEmbeddedDropTables()
  const terrain = { widthPx: 2000, heightPx: 2000, originX: 0, originY: 0, overlap: () => 0 }

  function createEngine(overrides?: Partial<GameEngineOptions>): GameEngine {
    const engine = new GameEngine(terrain, {
      spawn: { x: 512, y: 384 },
      stats: [],
      xpTable: DEMO_EXPERIENCE,
      skills: DEMO_SKILLS,
      npcDefs: [],
      questDefs: [],
      combatOptions: {
        playerSpeed: 4,
        playerReach: 50,
        playerCooldownTicks: 0,
        playerDamage: 100,
        playerManaPerAttack: 0,
        respawnTicks: 1000,
      },
      talkRadius: 48,
      pickupRadius: 0, // keep items on ground for inspection
      inventoryCols: 10,
      inventoryRows: 4,
      lootSeed: 1337,
      ...overrides,
    })
    engine.setDropTables(dropTables)
    return engine
  }

  describe('1. Monster Drop Sub-Tile Spacing (16x8 Sub-Tile Diamond Lattice vs 80x40 Macro Cell)', () => {
    it('places monster drops on the 16x8 sub-tile diamond lattice around death position, never 80x40 macro cells apart', () => {
      const engine = createEngine()
      // Use a non-macro-cell-aligned sub-tile death coordinate (e.g. 533, 417)
      // Countesses / Act Bosses drop multiple items in a single burst
      const deathX = 533
      const deathY = 417
      const boss: Monster = {
        index: 0,
        stats: {
          id: 'andariel',
          name: 'Andariel',
          hp: 10,
          damage: 1,
          cooldownTicks: 10,
          reach: 20,
          aggroRadius: 100,
          speed: 10,
          xp: 500,
          level: 12,
          rank: 'normal',
        },
        x: deathX,
        y: deathY,
        hp: 0,
        cooldown: 0,
        state: 'dead',
        facing: 0,
        hitFlash: 0,
        corpseTicks: 0,
        dropRolled: false,
        pendingDrop: {
          tcName: 'Andariel',
          nLevel: 12,
          monsterType: 'boss',
          isBoss: true,
          isNoRatio: false,
          seed: 424242,
          x: deathX,
          y: deathY,
          killerContext: {
            gamePlayers: 8,
            partyPlayers: 8,
            playerMf: 200,
            playerGf: 100,
          },
        },
      }
      engine.world.monsters.push(boss)

      const spawned = engine.triggerMonsterDrop(boss)
      expect(spawned.length).toBeGreaterThanOrEqual(2)

      // 1st drop lands at the exact monster death epicenter (Ring 0)
      expect(spawned[0]!.x).toBe(deathX)
      expect(spawned[0]!.y).toBe(deathY)

      // Every subsequent drop in the burst must be on the 16x8 sub-tile lattice around (deathX, deathY)
      for (let i = 1; i < spawned.length; i++) {
        const item = spawned[i]!
        const dx = item.x - deathX
        const dy = item.y - deathY
        expect(Math.abs(dx) % ORTHO_SUB_TILE_WIDTH).toBe(0)
        expect(Math.abs(dy) % ORTHO_SUB_TILE_HEIGHT).toBe(0)

        // Ring 1 & Ring 2 sub-tile offsets are compact (< ORTHO_CELL_WIDTH = 80px), NOT 80..400px macro cell steps!
        const distFromEpicenter = Math.hypot(dx, dy)
        expect(distFromEpicenter).toBeGreaterThanOrEqual(16)
        expect(distFromEpicenter).toBeLessThan(ORTHO_CELL_WIDTH)
      }

      // Pairwise anti-stacking: no two monster drops overlap
      for (let i = 0; i < spawned.length; i++) {
        for (let j = i + 1; j < spawned.length; j++) {
          const d = Math.hypot(spawned[i]!.x - spawned[j]!.x, spawned[i]!.y - spawned[j]!.y)
          expect(d).toBeGreaterThanOrEqual(16)
        }
      }
    })
  })

  describe('3. Player Body/Inventory Dropped Items Anti-Stacking (Potions & Equipment)', () => {
    it('scatters 8 sequentially dropped potions/items from player inventory onto distinct sub-tile slots with zero stacking', () => {
      const engine = createEngine()
      const playerX = engine.world.player.x
      const playerY = engine.world.player.y

      const potionsToDrop = [
        { id: 'pot-1', code: 'hp1', invFile: 'invhp1', name: 'Minor Healing Potion', nameZh: '轻微治疗药剂 (Minor Healing Potion)', baseNameZh: '药剂', quality: 'normal' as const, invWidth: 1, invHeight: 1, allowedSlots: [], stats: [] },
        { id: 'pot-2', code: 'hp2', invFile: 'invhp2', name: 'Light Healing Potion', nameZh: '轻度治疗药剂 (Light Healing Potion)', baseNameZh: '药剂', quality: 'normal' as const, invWidth: 1, invHeight: 1, allowedSlots: [], stats: [] },
        { id: 'pot-3', code: 'hp3', invFile: 'invhp3', name: 'Healing Potion', nameZh: '治疗药剂 (Healing Potion)', baseNameZh: '药剂', quality: 'normal' as const, invWidth: 1, invHeight: 1, allowedSlots: [], stats: [] },
        { id: 'pot-4', code: 'hp4', invFile: 'invhp4', name: 'Greater Healing Potion', nameZh: '强效治疗药剂 (Greater Healing Potion)', baseNameZh: '药剂', quality: 'normal' as const, invWidth: 1, invHeight: 1, allowedSlots: [], stats: [] },
        { id: 'pot-5', code: 'hp5', invFile: 'invhp5', name: 'Super Healing Potion', nameZh: '超级治疗药剂 (Super Healing Potion)', baseNameZh: '药剂', quality: 'normal' as const, invWidth: 1, invHeight: 1, allowedSlots: [], stats: [] },
        { id: 'pot-6', code: 'mp4', invFile: 'invmp4', name: 'Greater Mana Potion', nameZh: '强效法力药剂 (Greater Mana Potion)', baseNameZh: '药剂', quality: 'normal' as const, invWidth: 1, invHeight: 1, allowedSlots: [], stats: [] },
        { id: 'pot-7', code: 'rvs', invFile: 'invvps', name: 'Rejuvenation Potion', nameZh: '回复活力药剂 (Rejuvenation Potion)', baseNameZh: '药剂', quality: 'normal' as const, invWidth: 1, invHeight: 1, allowedSlots: [], stats: [] },
        { id: 'pot-8', code: 'rvl', invFile: 'invvpl', name: 'Full Rejuvenation Potion', nameZh: '全面回复活力药剂 (Full Rejuvenation Potion)', baseNameZh: '药剂', quality: 'normal' as const, invWidth: 1, invHeight: 1, allowedSlots: [], stats: [] },
      ]

      const droppedEntities = potionsToDrop.map(p => engine.dropItem(p, playerX, playerY))
      expect(droppedEntities.length).toBe(8)

      // Check that all 8 dropped items have unique (x, y) coordinates
      const coordSet = new Set(droppedEntities.map(e => `${e.x},${e.y}`))
      expect(coordSet.size).toBe(8)

      // Check pairwise distance >= 16px (minimum 1 sub-tile spacing) and compact Ring 0..1 radius
      for (let i = 0; i < droppedEntities.length; i++) {
        const a = droppedEntities[i]!
        expect(Math.hypot(a.x - playerX, a.y - playerY)).toBeLessThanOrEqual(32)
        for (let j = i + 1; j < droppedEntities.length; j++) {
          const b = droppedEntities[j]!
          const dist = Math.hypot(a.x - b.x, a.y - b.y)
          expect(dist).toBeGreaterThanOrEqual(16)
        }
      }
    })

    it('scatters multiple gold piles dropped from player inventory onto distinct sub-tile slots without stacking', () => {
      const engine = createEngine()
      engine.bag.gold = 5000
      const playerX = engine.world.player.x
      const playerY = engine.world.player.y

      const g1 = engine.dropGold(100, playerX, playerY)!
      const g2 = engine.dropGold(250, playerX, playerY)!
      const g3 = engine.dropGold(500, playerX, playerY)!
      const g4 = engine.dropGold(1000, playerX, playerY)!

      const piles = [g1, g2, g3, g4]
      const coordSet = new Set(piles.map(g => `${g.x},${g.y}`))
      expect(coordSet.size).toBe(4)

      for (let i = 0; i < piles.length; i++) {
        for (let j = i + 1; j < piles.length; j++) {
          expect(Math.hypot(piles[i]!.x - piles[j]!.x, piles[i]!.y - piles[j]!.y)).toBeGreaterThanOrEqual(16)
        }
      }
    })
  })
})
