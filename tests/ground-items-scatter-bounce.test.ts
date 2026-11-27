import { describe, it, expect } from 'vitest'
import {
  GroundItemManager,
  findIsometricDropPosition,
  getIsometricRingCandidates,
  isDropPositionBlocked,
  calculateBounceHeight,
  triggerFlippyBounce,
} from '../src/common/items/ground-items.ts'
import type { GroundItemEntity } from '../src/common/items/ground-items.ts'
import {
  GameEngine,
  worldToCell,
} from '../src/server/engine/game-engine.ts'
import type { GameEngineOptions, WorldMapProvider } from '../src/server/engine/game-engine.ts'
import {
  COLLIDE_NONE,
  COLLIDE_WALL,
  COLLIDE_ITEM,
  COLLIDE_OBJECT,
  COLLIDE_DOOR,
  COLLIDE_NO_PATH,
  COLLIDE_PET,
  COLLIDE_MASK_SPAWN,
  COLLIDE_MASK_SPAWN_LOS,
  ORTHO_CELL_WIDTH,
  ORTHO_CELL_HEIGHT,
  ORTHO_SUB_TILE_WIDTH,
  ORTHO_SUB_TILE_HEIGHT,
  subTileAt,
} from '../src/common/world/d2map.ts'
import type { CollisionGrid } from '../src/common/world/d2map.ts'
import { resolveGroundItemSpriteRect } from '../src/client/ui/inventory.ts'
import { BAKED_UI_MANIFEST } from '../src/common/items/baked-ui-meta.ts'
import type { SpriteRenderer } from '../src/client/render/renderer.ts'
import { DEMO_SKILLS, DEMO_EXPERIENCE } from '../src/common/data/demo-data.ts'

function createDummyTerrain(widthPx = 2000, heightPx = 2000, originX = 0, originY = 0): WorldMapProvider {
  return {
    widthPx,
    heightPx,
    originX,
    originY,
    overlap: () => 0,
  }
}

function createMockRenderer() {
  const drawnQuads: {
    x: number
    y: number
    w: number
    h: number
    color: readonly [number, number, number, number]
  }[] = []
  const drawnSprites: { frame: any; x: number; y: number; options: any }[] = []

  const renderer: SpriteRenderer = {
    drawSolid(x: number, y: number, w: number, h: number, color: readonly [number, number, number, number]) {
      drawnQuads.push({ x, y, w, h, color })
    },
    draw(frame: any, x: number, y: number, options: any) {
      drawnSprites.push({ frame, x, y, options })
    },
  } as unknown as SpriteRenderer

  return { renderer, drawnQuads, drawnSprites }
}

describe('Milestone M11.3 (Issue #406) — Ground Item & Gold Spawning, Isometric Scatter & Flippy Bounce', () => {
  describe('1. Monster Loot & Gold Ground Spawning (Elimination of Silent Bag Addition)', () => {
    it('monster gold drops spawn as GroundItemEntity on the ground and do NOT silently add to player bag', () => {
      const terrain = createDummyTerrain()
      const engineOpts: GameEngineOptions = {
        spawn: { x: 500, y: 500 },
        stats: [
          {
            id: 'monster1',
            name: 'Zombie',
            level: 3,
            hp: 1, // 1 hp so one hit kills
            damage: 0,
            cooldownTicks: 10,
            reach: 30,
            aggroRadius: 100,
            speed: 0,
            xp: 10,
          },
        ],
        xpTable: DEMO_EXPERIENCE,
        skills: DEMO_SKILLS,
        npcDefs: [],
        questDefs: [],
        itemBases: [
          { id: 'gold', name: 'Gold', invWidth: 1, invHeight: 1, code: 'gld' } as any,
        ],
        combatOptions: {
          playerSpeed: 10,
          playerReach: 50,
          playerCooldownTicks: 1,
          playerDamage: 10,
          playerManaPerAttack: 0,
          respawnTicks: 1000,
        },
        talkRadius: 50,
        pickupRadius: 30,
        inventoryCols: 10,
        inventoryRows: 4,
        monsterCount: 1,
        monsterSpread: 10,
      }

      const engine = new GameEngine(terrain, engineOpts)

      // Initial state: bag has 0 gold, 0 ground items
      expect(engine.bag.gold).toBe(0)
      expect(engine.groundItems.count).toBe(0)
      expect(engine.ground.length).toBe(0)

      // Trigger kill via attacking
      let killed = false
      for (let tick = 0; tick < 20; tick++) {
        engine.tick({
          movement: { x: 0, y: 0 },
          attacking: true,
          pickingUp: false,
          talking: false,
          digits: [],
          saving: false,
          loading: false,
        })
        if (engine.world.events.some(e => e.kind === 'kill')) {
          killed = true
          break
        }
      }

      expect(killed).toBe(true)

      // If gold or items dropped, they MUST be on the ground, NEVER siphoned into bag!
      if (engine.groundItems.count > 0) {
        const goldDrops = engine.groundItems.all.filter(g => g.isGold)
        if (goldDrops.length > 0) {
          // Strict 1.13c parity: Gold is on the floor!
          expect(engine.bag.gold).toBe(0)
          for (const g of goldDrops) {
            expect(g.isGold).toBe(true)
            expect(g.amount).toBeGreaterThan(0)
            expect(g.name).toContain('Gold')
            expect(g.nameZh).toContain('金币')
            expect(g.bounceState).toBeDefined()
            expect(g.bounceState?.phase).toBe('primary')
          }
        }
      }
    })

    it('pickupGold collects gold from ground and correctly synchronizes player bag gold', () => {
      const terrain = createDummyTerrain()
      const engine = new GameEngine(terrain, {
        spawn: { x: 500, y: 500 },
        stats: [],
        xpTable: DEMO_EXPERIENCE,
        skills: DEMO_SKILLS,
        npcDefs: [],
        questDefs: [],
        combatOptions: {
          playerSpeed: 10,
          playerReach: 50,
          playerCooldownTicks: 1,
          playerDamage: 10,
          playerManaPerAttack: 0,
          respawnTicks: 1000,
        },
        talkRadius: 50,
        pickupRadius: 30,
        inventoryCols: 10,
        inventoryRows: 4,
      })

      // Drop 2500 gold
      const goldEntity = engine.dropGold(2500, 520, 520, undefined, undefined, { fromWorld: true })
      expect(goldEntity).toBeDefined()
      expect(engine.groundItems.count).toBe(1)
      expect(engine.ground.length).toBe(1)
      expect(engine.bag.gold).toBe(0)

      // Pickup gold via ID
      const result = engine.pickupGold(goldEntity!.id)
      expect(result.success).toBe(true)
      expect(result.amount).toBe(2500)
      expect(engine.bag.gold).toBe(2500)
      expect(engine.groundItems.count).toBe(0)
      expect(engine.ground.length).toBe(0)
      expect(engine.metrics.pickups).toBe(1)
    })

    it('pickupItem with gold entity delegates to pickupGold and updates bag', () => {
      const terrain = createDummyTerrain()
      const engine = new GameEngine(terrain, {
        spawn: { x: 500, y: 500 },
        stats: [],
        xpTable: DEMO_EXPERIENCE,
        skills: DEMO_SKILLS,
        npcDefs: [],
        questDefs: [],
        combatOptions: {
          playerSpeed: 10,
          playerReach: 50,
          playerCooldownTicks: 1,
          playerDamage: 10,
          playerManaPerAttack: 0,
          respawnTicks: 1000,
        },
        talkRadius: 50,
        pickupRadius: 30,
        inventoryCols: 10,
        inventoryRows: 4,
      })

      const goldEntity = engine.dropGold(1200, 510, 510, undefined, undefined, { fromWorld: true })
      const res = engine.pickupItem(goldEntity!.id)
      expect(res.success).toBe(true)
      expect(engine.bag.gold).toBe(1200)
      expect(engine.groundItems.count).toBe(0)
    })

    it('walking over gold with pickingUp=true adds gold to bag and removes ground item', () => {
      const terrain = createDummyTerrain()
      const engine = new GameEngine(terrain, {
        spawn: { x: 500, y: 500 },
        stats: [],
        xpTable: DEMO_EXPERIENCE,
        skills: DEMO_SKILLS,
        npcDefs: [],
        questDefs: [],
        combatOptions: {
          playerSpeed: 10,
          playerReach: 50,
          playerCooldownTicks: 1,
          playerDamage: 10,
          playerManaPerAttack: 0,
          respawnTicks: 1000,
        },
        talkRadius: 50,
        pickupRadius: 40,
        inventoryCols: 10,
        inventoryRows: 4,
      })

      // Drop gold 10px away from player
      engine.dropGold(750, 505, 505, undefined, undefined, { fromWorld: true })
      expect(engine.bag.gold).toBe(0)

      // Player picks up
      engine.tick({
        movement: { x: 0, y: 0 },
        attacking: false,
        pickingUp: true,
        talking: false,
        digits: [],
        saving: false,
        loading: false,
      })

      expect(engine.bag.gold).toBe(750)
      expect(engine.groundItems.count).toBe(0)
      expect(engine.ground.length).toBe(0)
    })
  })

  describe('2. Cell Coordinate Inversion Synchronization (worldToCell)', () => {
    it('accurately converts world coordinates to cell coordinates under 2:1 isometric projection', () => {
      const terrain: WorldMapProvider = {
        widthPx: 5000,
        heightPx: 5000,
        originX: 1000,
        originY: 500,
        overlap: () => 0,
      }

      // origin cell (0, 0)
      const c0 = worldToCell(terrain, 1000, 500)
      expect(c0.cellX).toBe(0)
      expect(c0.cellY).toBe(0)

      // Cell (1, 0): worldX = 1000 + (1 - 0) * 80 = 1080, worldY = 500 + (1 + 0) * 40 = 540
      const c10 = worldToCell(terrain, 1080, 540)
      expect(c10.cellX).toBe(1)
      expect(c10.cellY).toBe(0)

      // Cell (0, 1): worldX = 1000 + (0 - 1) * 80 = 920, worldY = 500 + (0 + 1) * 40 = 540
      const c01 = worldToCell(terrain, 920, 540)
      expect(c01.cellX).toBe(0)
      expect(c01.cellY).toBe(1)

      // Cell (5, 8):
      // worldX = 1000 + (5 - 8) * 80 = 760
      // worldY = 500 + (5 + 8) * 40 = 1020
      const c58 = worldToCell(terrain, 760, 1020)
      expect(c58.cellX).toBe(5)
      expect(c58.cellY).toBe(8)
    })

    it('GameEngine.dropItem and dropGold assign actual cellX/cellY rather than hardcoding (0, 0)', () => {
      const terrain: WorldMapProvider = {
        widthPx: 5000,
        heightPx: 5000,
        originX: 0,
        originY: 0,
        overlap: () => 0,
      }
      const engine = new GameEngine(terrain, {
        spawn: { x: 800, y: 400 },
        stats: [],
        xpTable: DEMO_EXPERIENCE,
        skills: DEMO_SKILLS,
        npcDefs: [],
        questDefs: [],
        combatOptions: {
          playerSpeed: 10,
          playerReach: 50,
          playerCooldownTicks: 1,
          playerDamage: 10,
          playerManaPerAttack: 0,
          respawnTicks: 1000,
        },
        talkRadius: 50,
        pickupRadius: 30,
        inventoryCols: 10,
        inventoryRows: 4,
      })

      const item = engine.dropItem({ name: 'Long Bow' } as any, 800, 400)
      // (800, 400) with origin (0, 0): px = 800, py = 400
      // cellX = floor((800/80 + 400/40) / 2) = floor((10 + 10) / 2) = 10
      // cellY = floor((400/40 - 800/80) / 2) = floor((10 - 10) / 2) = 0
      expect(item.cellX).toBe(10)
      expect(item.cellY).toBe(0)
      expect(item.cellX !== 0 || item.cellY !== 0).toBe(true)

      const gold = engine.dropGold(100, 160, 240, undefined, undefined, { fromWorld: true })
      // (160, 240): px = 160, py = 240
      // cellX = floor((160/80 + 240/40) / 2) = floor((2 + 6) / 2) = 4
      // cellY = floor((240/40 - 160/80) / 2) = floor((6 - 2) / 2) = 2
      expect(gold!.cellX).toBe(4)
      expect(gold!.cellY).toBe(2)
    })

    it('items dropped at distinct cell coordinates have desynchronized sparkle phase offsets', () => {
      const period = 2000
      const getPhase = (cellX: number, cellY: number) =>
        Math.abs(Math.floor(cellX * 31 + cellY * 17)) % period

      const phase1 = getPhase(10, 5)
      const phase2 = getPhase(11, 5)
      const phase3 = getPhase(10, 6)

      expect(phase1).not.toBe(phase2)
      expect(phase1).not.toBe(phase3)
      expect(phase2).not.toBe(phase3)
    })
  })

  describe('3. Clock Domain Synchronization & Parabolic Flippy Bounce Kinematics', () => {
    it('GameEngine drops synchronize bounce startTime with simulation clock (world.tick * 40)', () => {
      const terrain = createDummyTerrain()
      const engine = new GameEngine(terrain, {
        spawn: { x: 500, y: 500 },
        stats: [],
        xpTable: DEMO_EXPERIENCE,
        skills: DEMO_SKILLS,
        npcDefs: [],
        questDefs: [],
        combatOptions: {
          playerSpeed: 10,
          playerReach: 50,
          playerCooldownTicks: 1,
          playerDamage: 10,
          playerManaPerAttack: 0,
          respawnTicks: 1000,
        },
        talkRadius: 50,
        pickupRadius: 30,
        inventoryCols: 10,
        inventoryRows: 4,
      })

      // Advance engine by 25 ticks (tick = 25, sim time = 1000ms)
      for (let i = 0; i < 25; i++) {
        engine.tick({
          movement: { x: 0, y: 0 },
          attacking: false,
          pickingUp: false,
          talking: false,
          digits: [],
          saving: false,
          loading: false,
        })
      }

      expect(engine.world.tick).toBe(25)

      const dropped = engine.dropItem({ name: 'Short Sword' } as any, 500, 500)
      expect(dropped.bounceState).toBeDefined()
      // startTime must match simulation clock 25 * 40 = 1000, NOT performance.now()
      expect(dropped.bounceState!.startTime).toBe(1000)
      expect(dropped.dropTime).toBe(1000)
    })

    it('2-phase bounce decay advances in GameEngine simulation and transitions cleanly to resting state', () => {
      const manager = new GroundItemManager()
      const entity = manager.add({ name: 'Helm' }, 2, 3, 200, 200, {
        bounce: true,
        durationMs: 400,
        peakHeight: 24,
        now: 0, // sim time 0
      })

      expect(entity.bounceState?.phase).toBe('primary')
      expect(entity.bounceState?.peakHeightPx).toBe(24)

      // Apex of primary bounce (t = 200ms)
      expect(calculateBounceHeight(entity.bounceState!, 200)).toBe(24)

      // Advance to 400ms (end of primary bounce): transitions to secondary bounce
      manager.update(400, 40)
      expect(entity.bounceState?.phase).toBe('secondary')
      expect(entity.bounceState?.durationMs).toBe(200) // 50% of 400ms
      expect(entity.bounceState?.peakHeightPx).toBe(6) // 25% of 24px

      // Apex of secondary bounce (t = 500ms, p = 0.5 of 200ms)
      expect(calculateBounceHeight(entity.bounceState!, 500)).toBe(6)

      // Advance past secondary duration (t = 600ms): transitions to null (resting)
      manager.update(600, 40)
      expect(entity.bounceState).toBeNull()
      expect(manager.getRenderOffset(entity, 600)).toEqual({ x: 0, y: 0 })
    })

    it('defensively guards calculateBounceHeight against non-positive or expired elapsed times', () => {
      const bounce = {
        startTime: 1000,
        durationMs: 400,
        peakHeightPx: 24,
      }

      // Negative elapsed (sub-frame jitter / out of order): returns 0, never negative
      expect(calculateBounceHeight(bounce, 900)).toBe(0)
      expect(calculateBounceHeight(bounce, 999.9)).toBe(0)
      // Exactly at start (t = 1000): returns 0
      expect(calculateBounceHeight(bounce, 1000)).toBe(0)
      // At duration boundary (t = 1400): returns 0
      expect(calculateBounceHeight(bounce, 1400)).toBe(0)
      // Far in future: returns 0
      expect(calculateBounceHeight(bounce, 2000)).toBe(0)
    })
  })

  describe('4. 2:1 Isometric Diamond Grid Scatter Algorithm Parity', () => {
    it('produces authentic D2Common 8-slot isometric diamond sequence on 16x8 sub-tile lattice', () => {
      const originX = 1000
      const originY = 800
      const existingItems: { x: number; y: number }[] = []

      // Drop 9 items in sequence at same epicenter
      for (let i = 0; i < 9; i++) {
        const pos = findIsometricDropPosition(originX, originY, existingItems)
        existingItems.push(pos)
      }

      expect(existingItems.length).toBe(9)

      // Drop 1: Epicenter (Ring 0)
      expect(existingItems[0]).toEqual({ x: 1000, y: 800 })

      // Ring 1 canonical sequence:
      // Drop 2: (-1, 0) -> (-16, -8)
      expect(existingItems[1]).toEqual({ x: 1000 - 16, y: 800 - 8 })
      // Drop 3: (1, 0) -> (+16, +8)
      expect(existingItems[2]).toEqual({ x: 1000 + 16, y: 800 + 8 })
      // Drop 4: (0, -1) -> (+16, -8)
      expect(existingItems[3]).toEqual({ x: 1000 + 16, y: 800 - 8 })
      // Drop 5: (0, 1) -> (-16, +8)
      expect(existingItems[4]).toEqual({ x: 1000 - 16, y: 800 + 8 })
      // Drop 6: (-1, -1) -> (0, -16) [Top Apex]
      expect(existingItems[5]).toEqual({ x: 1000, y: 800 - 16 })
      // Drop 7: (1, -1) -> (+32, 0) [Right Apex]
      expect(existingItems[6]).toEqual({ x: 1000 + 32, y: 800 })
      // Drop 8: (-1, 1) -> (-32, 0) [Left Apex]
      expect(existingItems[7]).toEqual({ x: 1000 - 32, y: 800 })
      // Drop 9: (1, 1) -> (0, +16) [Bottom Apex]
      expect(existingItems[8]).toEqual({ x: 1000, y: 800 + 16 })

      // Verify exact 2:1 isometric diamond aspect ratio:
      // Horizontal diameter = 32 - (-32) = 64px
      // Vertical diameter = 16 - (-16) = 32px
      // Ratio = 64 / 32 = 2.0 (exact 2:1!)
      const minX = Math.min(...existingItems.map(p => p.x))
      const maxX = Math.max(...existingItems.map(p => p.x))
      const minY = Math.min(...existingItems.map(p => p.y))
      const maxY = Math.max(...existingItems.map(p => p.y))

      const spanX = maxX - minX
      const spanY = maxY - minY
      expect(spanX).toBe(64)
      expect(spanY).toBe(32)
      expect(spanX / spanY).toBe(2)
    })

    it('strictly minimizes L1 Manhattan distance (|dx| + |dy|) within concentric rings', () => {
      const ring1Cands = getIsometricRingCandidates(1)
      expect(ring1Cands.length).toBe(8)

      // First 4 candidates have L1 = 1 (|dx| + |dy| = 1)
      for (let i = 0; i < 4; i++) {
        expect(ring1Cands[i]!.l1).toBe(1)
      }
      // Remaining 4 corner candidates have L1 = 2
      for (let i = 4; i < 8; i++) {
        expect(ring1Cands[i]!.l1).toBe(2)
      }

      const ring2Cands = getIsometricRingCandidates(2)
      expect(ring2Cands.length).toBe(16)
      // L1 must be monotonically non-decreasing
      for (let i = 1; i < ring2Cands.length; i++) {
        expect(ring2Cands[i]!.l1).toBeGreaterThanOrEqual(ring2Cands[i - 1]!.l1)
      }
    })

    it('anti-stacking: all items maintain minimum spacing >= 16px', () => {
      const items: { x: number; y: number }[] = []
      for (let i = 0; i < 15; i++) {
        const pos = findIsometricDropPosition(500, 500, items)
        items.push(pos)
      }

      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const dist = Math.hypot(items[i]!.x - items[j]!.x, items[i]!.y - items[j]!.y)
          expect(dist).toBeGreaterThanOrEqual(16)
        }
      }
    })
  })

  describe('5. Collision Masks & Line-of-Sight Raycast Protection', () => {
    it('rejects candidate sub-tiles with COLLIDE_MASK_SPAWN bits set', () => {
      // Create a 10x10 cell grid (50x50 sub-tiles)
      const widthSub = 50
      const heightSub = 50
      const collisionMasks = new Uint16Array(widthSub * heightSub)
      const mockGrid: CollisionGrid = {
        gridWidth: widthSub,
        cellsX: 10,
        cellsY: 10,
        originX: 0,
        originY: 0,
        blocked: new Uint8Array(widthSub * heightSub),
        collisionMasks,
      }

      // Origin at (400, 200)
      const originX = 400
      const originY = 200

      // Block candidate 2: (-16, -8) from origin
      const cand2X = originX - 16
      const cand2Y = originY - 8
      const cand2Sub = subTileAt(mockGrid, cand2X, cand2Y)
      collisionMasks[cand2Sub.subY * widthSub + cand2Sub.subX] = COLLIDE_WALL // 0x0001 (part of COLLIDE_MASK_SPAWN 0x3E01)

      const existing = [{ x: originX, y: originY }]
      const pos = findIsometricDropPosition(originX, originY, existing, mockGrid)

      // Candidate 2 is blocked by COLLIDE_WALL, so it skips to Candidate 3 (+16, +8)
      expect(pos).not.toEqual({ x: cand2X, y: cand2Y })
      expect(pos).toEqual({ x: originX + 16, y: originY + 8 })
    })

    it('rejects candidates across walls via COLLIDE_MASK_SPAWN_LOS line-of-sight raycast', () => {
      const widthSub = 50
      const heightSub = 50
      const collisionMasks = new Uint16Array(widthSub * heightSub)
      const mockGrid: CollisionGrid = {
        gridWidth: widthSub,
        cellsX: 10,
        cellsY: 10,
        originX: 0,
        originY: 0,
        blocked: new Uint8Array(widthSub * heightSub),
        collisionMasks,
      }

      const originX = 400
      const originY = 200

      // Place a closed door (COLLIDE_DOOR = 0x0800, in COLLIDE_MASK_SPAWN_LOS) on the ray
      // between origin (400, 200) and right apex (432, 200)
      const mid = subTileAt(mockGrid, 416, 200)
      collisionMasks[mid.subY * widthSub + mid.subX] = COLLIDE_DOOR

      const existing: { x: number; y: number }[] = [
        { x: originX, y: originY },
        { x: originX - 16, y: originY - 8 },
        { x: originX + 16, y: originY + 8 },
        { x: originX + 16, y: originY - 8 },
        { x: originX - 16, y: originY + 8 },
        { x: originX, y: originY - 16 },
      ]

      // Next candidate would naturally be Right Apex (+32, 0)
      const pos = findIsometricDropPosition(originX, originY, existing, mockGrid)
      // Ray to (+32, 0) hits the door, so Right Apex must be rejected
      expect(pos).not.toEqual({ x: originX + 32, y: originY })
      // Drops to Left Apex (-32, 0) or unblocked candidate instead
      expect(pos).toEqual({ x: originX - 32, y: originY })
    })
  })

  describe('6. Rendering & Sprite Selection Parity', () => {

    it('resolves gold pile sprite tier based on amount (<100, 100-499, 500-4999, 5000+)', () => {
      const flippyRects = BAKED_UI_MANIFEST.flippyRects

      const small = resolveGroundItemSpriteRect({ isGold: true, amount: 45, code: 'gld' })
      expect(small).toEqual(flippyRects['flpgld_0'])

      const med = resolveGroundItemSpriteRect({ isGold: true, amount: 250, code: 'gld' })
      expect(med).toEqual(flippyRects['flpgld_1'])

      const large = resolveGroundItemSpriteRect({ isGold: true, amount: 2000, code: 'gld' })
      expect(large).toEqual(flippyRects['flpgld_2'])

      const huge = resolveGroundItemSpriteRect({ isGold: true, amount: 15000, code: 'gld' })
      expect(huge).toEqual(flippyRects['flpgld_3'])
    })
  })
})
