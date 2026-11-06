import { describe, expect, it } from 'vitest'
import {
  getInventoryGoldLimit,
  getGoldFlippyRect,
  resolveGroundItemSpriteRect,
} from '../src/client/ui/inventory.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import { goldItem } from '../src/common/items/items.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'

function createTestEngine(playerLevel = 1, initialGold = 0): GameEngine {
  const engine = new GameEngine(
    { widthPx: 1000, heightPx: 1000, overlap: () => 0 },
    {
      spawn: { x: 100, y: 100 },
      stats: [],
      xpTable: [0, 500, 1500],
      skills: [],
      npcDefs: [],
      questDefs: [],
      combatOptions: {
        playerSpeed: 4,
        playerReach: 50,
        playerCooldownTicks: 10,
        playerDamage: 5,
        playerManaPerAttack: 1,
        respawnTicks: 100,
      },
      talkRadius: 50,
      pickupRadius: 30,
      inventoryCols: 10,
      inventoryRows: 4,
    },
  )
  engine.world.player.level = playerLevel
  engine.bag.gold = initialGold
  return engine
}

describe('Issue #419: Physical Gold Piles & Inventory Capacity (1.13c Parity)', () => {
  it('T1: resolves gold piles into 4 authentic 1.13c graphic tiers', () => {
    const flippyRects = BAKED_UI_MANIFEST.flippyRects

    // Tier 0: 1–99 gold -> flpgld_0
    expect(getGoldFlippyRect(1)).toEqual(flippyRects['flpgld_0'])
    expect(getGoldFlippyRect(25)).toEqual(flippyRects['flpgld_0'])
    expect(getGoldFlippyRect(99)).toEqual(flippyRects['flpgld_0'])
    expect(resolveGroundItemSpriteRect({ isGold: true, amount: 99, code: 'gld' })).toEqual(flippyRects['flpgld_0'])

    // Tier 1: 100–499 gold -> flpgld_1
    expect(getGoldFlippyRect(100)).toEqual(flippyRects['flpgld_1'])
    expect(getGoldFlippyRect(250)).toEqual(flippyRects['flpgld_1'])
    expect(getGoldFlippyRect(499)).toEqual(flippyRects['flpgld_1'])
    expect(resolveGroundItemSpriteRect({ isGold: true, amount: 100, code: 'gld' })).toEqual(flippyRects['flpgld_1'])

    // Tier 2: 500–4999 gold -> flpgld_2
    expect(getGoldFlippyRect(500)).toEqual(flippyRects['flpgld_2'])
    expect(getGoldFlippyRect(2500)).toEqual(flippyRects['flpgld_2'])
    expect(getGoldFlippyRect(4999)).toEqual(flippyRects['flpgld_2'])
    expect(resolveGroundItemSpriteRect({ isGold: true, amount: 4999, code: 'gld' })).toEqual(flippyRects['flpgld_2'])

    // Tier 3: 5000+ gold -> flpgld_3
    expect(getGoldFlippyRect(5000)).toEqual(flippyRects['flpgld_3'])
    expect(getGoldFlippyRect(50000)).toEqual(flippyRects['flpgld_3'])
    expect(resolveGroundItemSpriteRect({ isGold: true, amount: 15000, code: 'gld' })).toEqual(flippyRects['flpgld_3'])
  })

  it('T2: calculates authentic character inventory gold capacity limit (level * 10,000)', () => {
    // Level 1: 10,000
    expect(getInventoryGoldLimit(1)).toBe(10_000)
    // Level 10: 100,000
    expect(getInventoryGoldLimit(10)).toBe(100_000)
    // Level 20: 200,000
    expect(getInventoryGoldLimit(20)).toBe(200_000)
    // Level 85: 850,000
    expect(getInventoryGoldLimit(85)).toBe(850_000)
    // Level 99: 990,000
    expect(getInventoryGoldLimit(99)).toBe(990_000)
    // Edge case: Level <= 0 clamped to 1
    expect(getInventoryGoldLimit(0)).toBe(10_000)
    expect(getInventoryGoldLimit(-5)).toBe(10_000)
  })

  it('T3: full gold pickup when current + pile <= maxCapacity', () => {
    const engine = createTestEngine(1, 0)
    expect(engine.maxGoldCapacity).toBe(10_000)

    const pile = engine.dropGold(2500, 100, 100, undefined, undefined, { fromWorld: true })!
    expect(pile).toBeDefined()
    expect(engine.groundItems.count).toBe(1)
    expect(engine.ground.length).toBe(1)

    const res = engine.pickupGold(pile.id)
    expect(res.success).toBe(true)
    expect(res.amount).toBe(2500)
    expect(res.remaining).toBe(0)
    expect(engine.gold).toBe(2500)
    expect(engine.groundItems.count).toBe(0)
    expect(engine.ground.length).toBe(0)
  })

  it('T4: partial gold pickup when current + pile > maxCapacity', () => {
    const engine = createTestEngine(1, 7000)
    expect(engine.maxGoldCapacity).toBe(10_000)

    const pile = engine.dropGold(8000, 100, 100, undefined, undefined, { fromWorld: true })!
    expect(pile.amount).toBe(8000)

    const res = engine.pickupGold(pile.id)
    expect(res.success).toBe(true)
    expect(res.amount).toBe(3000) // 10000 - 7000
    expect(res.remaining).toBe(5000) // 8000 - 3000
    expect(engine.gold).toBe(10_000)

    // Ground entity remains with updated amount and label
    const remainingEntity = engine.groundItems.get(pile.id)!
    expect(remainingEntity).toBeDefined()
    expect(remainingEntity.amount).toBe(5000)
    expect(remainingEntity.name).toBe('5000 Gold')
    expect(remainingEntity.nameZh).toBe('5000 金币')
    expect(engine.ground.length).toBe(1)
    expect((engine.ground[0]!.item as any).stack).toBe(5000)
  })

  it('T5: graphic tier updates on partial pickup remainder', () => {
    const engine = createTestEngine(1, 9970)
    // Drop 130 gold pile (tier 1: medium, 100-499)
    const pile = engine.dropGold(130, 100, 100, undefined, undefined, { fromWorld: true })!
    expect(resolveGroundItemSpriteRect(pile)).toEqual(BAKED_UI_MANIFEST.flippyRects['flpgld_1'])

    // Pickup 30 gold -> remainder 100 gold (still medium tier: flpgld_1)
    const res1 = engine.pickupGold(pile.id)
    expect(res1.amount).toBe(30)
    expect(res1.remaining).toBe(100)
    expect(resolveGroundItemSpriteRect(pile)).toEqual(BAKED_UI_MANIFEST.flippyRects['flpgld_1'])

    // Spend some gold so player has 9990
    engine.bag.gold = 9990
    // Pickup 10 gold from remainder 100 -> remainder becomes 90 gold (small tier: flpgld_0)
    const res2 = engine.pickupGold(pile.id)
    expect(res2.amount).toBe(10)
    expect(res2.remaining).toBe(90)
    expect(resolveGroundItemSpriteRect(pile)).toEqual(BAKED_UI_MANIFEST.flippyRects['flpgld_0'])
  })

  it('T6: rejects pickup when inventory gold is already at capacity', () => {
    const engine = createTestEngine(1, 10_000)
    const pile = engine.dropGold(5000, 100, 100, undefined, undefined, { fromWorld: true })!
    const initialPickups = engine.metrics.pickups

    const res = engine.pickupGold(pile.id)
    expect(res.success).toBe(false)
    expect(res.amount).toBe(0)
    expect(res.remaining).toBe(5000)
    expect(engine.gold).toBe(10_000)
    expect(engine.groundItems.count).toBe(1)
    expect(engine.metrics.pickups).toBe(initialPickups)

    // Also verify pickupItem delegation
    const itemRes = engine.pickupItem(pile.id)
    expect(itemRes.success).toBe(false)
    expect(itemRes.reason).toBe('full')
    expect(engine.metrics.inventoryRefusals).toBeGreaterThan(0)
  })

  it('T7: walkover auto-pickup when player steps within pickupRadius', () => {
    const engine = createTestEngine(1, 0)
    // Drop gold at (105, 105), near player spawn (100, 100)
    engine.dropGold(1200, 105, 105, undefined, undefined, { fromWorld: true })
    expect(engine.groundItems.count).toBe(1)
    expect(engine.gold).toBe(0)

    // Tick engine with no inputs (player at 100, 100 is within 30px radius of 105, 105)
    engine.tick({
      movement: { x: 0, y: 0 },
      attacking: false,
      pickingUp: false,
      talking: false,
      digits: [],
      saving: false,
      loading: false,
    })

    expect(engine.gold).toBe(1200)
    expect(engine.groundItems.count).toBe(0)
  })

  it('T8: goldItem does not clamp amounts > 5000', () => {
    const item = goldItem(50_000)
    expect(item.stack).toBe(50_000)
    expect(item.value).toBe(50_000)

    const engine = createTestEngine(10, 0) // Level 10 cap: 100,000
    const pile = engine.dropGold(50_000, 100, 100, undefined, undefined, { fromWorld: true })!
    expect(pile.amount).toBe(50_000)
    engine.pickupGold(pile.id)
    expect(engine.gold).toBe(50_000)
  })
})
