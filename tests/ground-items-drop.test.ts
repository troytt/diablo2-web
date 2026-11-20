/**
 * Diablo II: Lord of Destruction v1.13c — Ground Items & Drop System Test Suite
 *
 * Requirements (Issue #388):
 * 1. Safe Drop Radial Search: finds walkable cell avoiding walls, void and invalid cells.
 * 2. Authentic Gold & Item Representation: parses gold amounts, qualities, and names.
 * 3. GroundItemManager Lifecycle: add, remove, search, sparkle phase, and parabolic bounce physics.
 * 4. Inventory & Stash Drop Interaction: dropGold, findFreeGridSlot, and auto placement.
 * 5. GameEngine & Scene Integration: groundItems synchronization with engine ground list.
 */

import { describe, expect, it } from 'vitest'
import {
  findSafeDropPosition,
  findIsometricDropPosition,
  isGoldItem,
  resolveGroundItemMetadata,
  calculateBounceHeight,
  GroundItemManager,
  CANONICAL_QUEST_ITEM_CODES,
  CANONICAL_ORANGE_SPECIAL_ITEM_CODES,
  layoutGroundItemLabels,
  type GroundItemBounceState,
} from '../src/common/items/ground-items.ts'
import {
  COLLIDE_NONE,
  COLLIDE_WALL,
  COLLIDE_BLANK,
  COLLIDE_MASK_INVALID,
  ORTHO_CELL_WIDTH,
  ORTHO_CELL_HEIGHT,
} from '../src/common/world/d2map.ts'
import { InventoryPanel, findFreeGridSlot, type UiInventoryItem, type GridPlacement } from '../src/client/ui/inventory.ts'
import { HudManager } from '../src/client/ui/hud-manager.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'
import { DEMO_EXPERIENCE, DEMO_SKILLS, DEMO_QUESTS } from '../src/common/data/demo-data.ts'

describe('Issue #388 — Ground Item & Drop System Ground Truth', () => {
  describe('1. findSafeDropPosition Radial Search (D2Common.dll ITEM_Drop Parity)', () => {
    it('returns origin cell directly when origin is not blocked', () => {
      const mockGrid = {
        originX: 100,
        originY: 200,
        isBlocked: () => false,
      }
      const pos = findSafeDropPosition(mockGrid, 10, 20, 3)
      expect(pos.cellX).toBe(10)
      expect(pos.cellY).toBe(20)
      expect(pos.x).toBe(100 + (10 - 20) * ORTHO_CELL_WIDTH)
      expect(pos.y).toBe(200 + (10 + 20) * ORTHO_CELL_HEIGHT)
    })

    it('spirals to nearest unblocked neighbor when origin is blocked by wall', () => {
      // Origin (10, 20) is blocked; (10, 21) is free
      const blockedCells = new Set(['10,20'])
      const mockGrid = {
        originX: 0,
        originY: 0,
        isBlocked: (cx: number, cy: number) => blockedCells.has(`${cx},${cy}`),
      }
      const pos = findSafeDropPosition(mockGrid, 10, 20, 2)
      expect(pos.cellX !== 10 || pos.cellY !== 20).toBe(true)
      const distSq = (pos.cellX - 10) ** 2 + (pos.cellY - 20) ** 2
      expect(distSq).toBe(1) // Nearest orthogonal neighbor
    })

    it('strictly avoids COLLIDE_WALL, COLLIDE_BLANK, and COLLIDE_MASK_INVALID in grid collisionMasks', () => {
      const width = 5
      const height = 5
      const masks = new Uint16Array(width * height)
      // Block center (2, 2) and immediate neighbors except (3, 2)
      masks[2 * width + 2] = COLLIDE_WALL
      masks[1 * width + 2] = COLLIDE_BLANK
      masks[3 * width + 2] = COLLIDE_MASK_INVALID
      masks[2 * width + 1] = COLLIDE_WALL
      // (3, 2) is left as COLLIDE_NONE

      const grid = {
        width,
        height,
        originX: 0,
        originY: 0,
        collisionMasks: masks,
      }

      const pos = findSafeDropPosition(grid, 2, 2, 2)
      expect(pos.cellX).toBe(3)
      expect(pos.cellY).toBe(2)
    })

    it('falls back safely to origin if all cells within maxRadius are blocked', () => {
      const mockGrid = {
        isBlocked: () => true,
      }
      const pos = findSafeDropPosition(mockGrid, 5, 5, 2)
      expect(pos.cellX).toBe(5)
      expect(pos.cellY).toBe(5)
    })
  })

  describe('2. isGoldItem & resolveGroundItemMetadata', () => {
    it('accurately identifies gold items from diverse shapes', () => {
      expect(isGoldItem({ isGold: true })).toBe(true)
      expect(isGoldItem({ code: 'gld' })).toBe(true)
      expect(isGoldItem({ code: '  gld  ' })).toBe(true)
      expect(isGoldItem({ id: 'gold' })).toBe(true)
      expect(isGoldItem({ base: { id: 'gold' } })).toBe(true)
      expect(isGoldItem({ name: 'Gold' })).toBe(true)
      expect(isGoldItem({ name: '500 金币' })).toBe(true)

      expect(isGoldItem({ name: 'Short Sword', code: 'swd' })).toBe(false)
      expect(isGoldItem(null)).toBe(false)
      expect(isGoldItem(undefined)).toBe(false)
    })

    it('resolves gold metadata with formatted Chinese/English names and amount', () => {
      const meta = resolveGroundItemMetadata({ isGold: true, amount: 2500 })
      expect(meta.isGold).toBe(true)
      expect(meta.amount).toBe(2500)
      expect(meta.name).toBe('2500 Gold')
      expect(meta.nameZh).toBe('2500 金币')
      expect(meta.quality).toBe('normal')
      expect(meta.invWidth).toBe(1)
      expect(meta.invHeight).toBe(1)
    })

    it('resolves equipment item metadata preserving quality, dimensions, and names', () => {
      const item: Partial<UiInventoryItem> = {
        id: 'soj_1',
        name: 'The Stone of Jordan',
        nameZh: '乔丹之石',
        quality: 'unique',
        invWidth: 1,
        invHeight: 1,
      }
      const meta = resolveGroundItemMetadata(item)
      expect(meta.isGold).toBe(false)
      expect(meta.name).toBe('The Stone of Jordan')
      expect(meta.nameZh).toBe('乔丹之石')
      expect(meta.quality).toBe('unique')
      expect(meta.invWidth).toBe(1)
      expect(meta.invHeight).toBe(1)
    })
  })

  describe('3. GroundItemManager Lifecycle & Parabolic Bounce Physics', () => {
    it('adds and retrieves dropped items with unique generated IDs', () => {
      const manager = new GroundItemManager()
      const item: Partial<UiInventoryItem> = {
        name: 'Grand Charm',
        nameZh: '超大护身符',
        quality: 'magic',
        invWidth: 1,
        invHeight: 3,
      }

      const entity = manager.add(item, 15, 25, 400, 300, { bounce: true })
      expect(entity.id).toBeDefined()
      expect(entity.name).toBe('Grand Charm')
      expect(entity.nameZh).toBe('超大护身符')
      expect(entity.cellX).toBe(15)
      expect(entity.cellY).toBe(25)
      expect(entity.x).toBe(400)
      expect(entity.y).toBe(300)
      expect(entity.bounceState).toBeDefined()
      expect(manager.count).toBe(1)
      expect(manager.get(entity.id)).toBe(entity)
    })

    it('removes item by ID when picked up', () => {
      const manager = new GroundItemManager()
      const entity = manager.add({ name: 'Potion' }, 0, 0, 100, 100)
      expect(manager.count).toBe(1)
      const removed = manager.remove(entity.id)
      expect(removed).toBe(entity)
      expect(manager.count).toBe(0)
      expect(manager.get(entity.id)).toBeUndefined()
    })

    it('findAtPoint and findNearby correctly filter by radius', () => {
      const manager = new GroundItemManager()
      const item1 = manager.add({ name: 'Item 1' }, 0, 0, 100, 100)
      const item2 = manager.add({ name: 'Item 2' }, 0, 0, 105, 105)
      const item3 = manager.add({ name: 'Item 3' }, 0, 0, 200, 200)

      const hit = manager.findAtPoint(102, 102, 10)
      expect(hit).toBeDefined()
      expect(hit?.id === item1.id || hit?.id === item2.id).toBe(true)

      const nearby = manager.findNearby(100, 100, 20)
      expect(nearby.length).toBe(2)
      expect(nearby.map(i => i.id)).toContain(item1.id)
      expect(nearby.map(i => i.id)).toContain(item2.id)
      expect(nearby.map(i => i.id)).not.toContain(item3.id)
    })

    it('parabolic bounce equation h(p) = 4 * H * p * (1 - p) calculates exact apex and landing', () => {
      const bounce: GroundItemBounceState = {
        startTime: 1000,
        durationMs: 400,
        peakHeightPx: 32,
      }

      // At start (t = 1000): h = 0
      expect(calculateBounceHeight(bounce, 1000)).toBe(0)

      // At apex (t = 1200, p = 0.5): h = 4 * 32 * 0.5 * 0.5 = 32
      expect(calculateBounceHeight(bounce, 1200)).toBe(32)

      // At quarter time (p = 0.25): h = 4 * 32 * 0.25 * 0.75 = 24
      expect(calculateBounceHeight(bounce, 1100)).toBe(24)

      // At landing (t = 1400): h = 0
      expect(calculateBounceHeight(bounce, 1400)).toBe(0)

      // After duration: h = 0
      expect(calculateBounceHeight(bounce, 1500)).toBe(0)
    })

    it('manager.update advances bounce from primary to secondary bounce and completes', () => {
      const manager = new GroundItemManager()
      const entity = manager.add({ name: 'Rune' }, 0, 0, 100, 100, {
        bounce: true,
        durationMs: 400,
        peakHeight: 24,
        now: 1000,
      })

      expect(entity.bounceState?.phase).toBe('primary')

      // Advance past primary duration (1450ms)
      manager.update(1450, 450)
      expect(entity.bounceState?.phase).toBe('secondary')
      expect(entity.bounceState?.peakHeightPx).toBe(6) // 24 * 0.25 = 6

      // Advance past secondary duration
      manager.update(1700, 250)
      expect(entity.bounceState).toBeNull()
    })
  })

  describe('4. InventoryPanel findFreeGridSlot', () => {
    it('findFreeGridSlot returns first available (col, row) without overlapping existing items', () => {
      const gridItems: GridPlacement[] = [
        {
          item: { id: '1', invWidth: 2, invHeight: 2 } as any,
          col: 0,
          row: 0,
        },
      ]

      // A 1x1 item should find col: 2, row: 0 (or col: 0, row: 2)
      const slot1x1 = findFreeGridSlot(gridItems, 1, 1, 10, 4)
      expect(slot1x1).toEqual({ col: 2, row: 0 })

      // A 2x2 item cannot fit at (0, 0) or (1, 0), finds (2, 0)
      const slot2x2 = findFreeGridSlot(gridItems, 2, 2, 10, 4)
      expect(slot2x2).toEqual({ col: 2, row: 0 })
    })

    it('findFreeGridSlot returns null when grid is completely packed', () => {
      const gridItems: GridPlacement[] = []
      // Fill all 10x4 cells with 1x1 items
      for (let r = 0; r < 4; r += 1) {
        for (let c = 0; c < 10; c += 1) {
          gridItems.push({
            item: { id: `item_${c}_${r}`, invWidth: 1, invHeight: 1 } as any,
            col: c,
            row: r,
          })
        }
      }

      const slot = findFreeGridSlot(gridItems, 1, 1, 10, 4)
      expect(slot).toBeNull()
    })
  })

  describe('5. GameEngine & GroundItems Integration', () => {
    it('GameEngine.dropItem creates ground entity and syncs engine.ground', () => {
      const engine = new GameEngine(
        { widthPx: 1000, heightPx: 1000, overlap: () => 0 },
        {
          spawn: { x: 100, y: 100 },
          stats: [],
          xpTable: DEMO_EXPERIENCE,
          skills: DEMO_SKILLS,
          npcDefs: [],
          questDefs: DEMO_QUESTS,
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

      expect(engine.ground.length).toBe(0)
      expect(engine.groundItems.count).toBe(0)

      const dropped = engine.dropItem(
        { name: 'Broad Sword', quality: 'normal', invWidth: 1, invHeight: 3 } as any,
        120,
        130,
      )

      expect(engine.ground.length).toBe(1)
      expect(engine.groundItems.count).toBe(1)
      expect(dropped.x).toBe(120)
      expect(dropped.y).toBe(130)
      expect(dropped.name).toBe('Broad Sword')
      expect(engine.ground[0]!.x).toBe(120)
      expect(engine.ground[0]!.y).toBe(130)
    })

    it('GameEngine.dropGold creates gold entity on ground and updates groundItems', () => {
      const engine = new GameEngine(
        { widthPx: 1000, heightPx: 1000, overlap: () => 0 },
        {
          spawn: { x: 100, y: 100 },
          stats: [],
          xpTable: DEMO_EXPERIENCE,
          skills: DEMO_SKILLS,
          npcDefs: [],
          questDefs: DEMO_QUESTS,
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

      const goldEntity = engine.dropGold(5000, 150, 160, undefined, undefined, { fromWorld: true })
      expect(goldEntity).toBeDefined()
      expect(goldEntity!.isGold).toBe(true)
      expect(goldEntity!.amount).toBe(5000)
      expect(goldEntity!.nameZh).toBe('5000 金币')
      expect(engine.ground.length).toBe(1)
      expect(engine.groundItems.count).toBe(1)
    })
  })

  describe('6. findIsometricDropPosition & Ground Diamond Dispersal (D2 1.13c Ground Truth)', () => {
    it('returns exact origin when ground has no existing items', () => {
      const pos = findIsometricDropPosition(500, 300, [])
      expect(pos.x).toBe(500)
      expect(pos.y).toBe(300)
    })

    it('disperses multiple items dropped at identical epicenter onto unoccupied isometric grid slots', () => {
      const items: { x: number; y: number }[] = []
      for (let i = 0; i < 5; i++) {
        const pos = findIsometricDropPosition(400, 400, items)
        items.push(pos)
      }

      expect(items.length).toBe(5)
      expect(items[0]).toEqual({ x: 400, y: 400 })

      // Verify no two items share identical coordinates or are closer than minSpacing
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const dist = Math.hypot(items[i]!.x - items[j]!.x, items[i]!.y - items[j]!.y)
          expect(dist).toBeGreaterThanOrEqual(16)
        }
      }
    })

    it('avoids colliding with obstacles when isBlocked is provided', () => {
      const blockedCells = new Set([
        // Block (400, 424) which is the nearest (1, 1) candidate
        '400,424',
      ])
      const isBlocked = (x: number, y: number) => blockedCells.has(`${x},${y}`)

      const existing = [{ x: 400, y: 400 }]
      const pos = findIsometricDropPosition(400, 400, existing, isBlocked)
      expect(pos.x === 400 && pos.y === 424).toBe(false)
      expect(isBlocked(pos.x, pos.y)).toBe(false)
      expect(Math.hypot(pos.x - 400, pos.y - 400)).toBeGreaterThanOrEqual(16)
    })

    it('GameEngine.dropItem repeatedly spreads items out across isometric lattice without stacking', () => {
      const engine = new GameEngine(
        { widthPx: 1000, heightPx: 1000, overlap: () => 0 },
        {
          spawn: { x: 100, y: 100 },
          stats: [],
          xpTable: DEMO_EXPERIENCE,
          skills: DEMO_SKILLS,
          npcDefs: [],
          questDefs: DEMO_QUESTS,
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

      const d1 = engine.dropItem({ name: 'Item 1' } as any, 200, 200)
      const d2 = engine.dropItem({ name: 'Item 2' } as any, 200, 200)
      const d3 = engine.dropItem({ name: 'Item 3' } as any, 200, 200)

      expect(d1.x).toBe(200)
      expect(d1.y).toBe(200)
      // d2 and d3 must be dispersed and not stacked at (200, 200)
      expect(d2.x !== 200 || d2.y !== 200).toBe(true)
      expect(d3.x !== 200 || d3.y !== 200).toBe(true)
      expect(Math.hypot(d2.x - d1.x, d2.y - d1.y)).toBeGreaterThanOrEqual(16)
      expect(Math.hypot(d3.x - d1.x, d3.y - d1.y)).toBeGreaterThanOrEqual(16)
      expect(Math.hypot(d3.x - d2.x, d3.y - d2.y)).toBeGreaterThanOrEqual(16)
    })
  })

  describe('6. Issue #935 — 1.13c Ground Item Label Colors, No Border & 3-State Background (D2Client.dll 0x6FB6FEC0 / 0x6FB08FB0 & D2Win.dll 0x6F8F2E90 / 0x6F8F356C)', () => {
    it('renders Gold (gld) in White (#ffffff), not Gold (#d8b864)', () => {
      const meta = resolveGroundItemMetadata({ isGold: true, amount: 500, code: 'gld' })
      expect(meta.color).toBe('#ffffff')
    })

    it('renders Low Quality (quality=1 / low) items in White (#ffffff) when unsocketed & non-ethereal, and Gray (#a0a0a0) when socketed or ethereal', () => {
      const lowPlain = resolveGroundItemMetadata({ code: 'ssd', quality: 1 })
      expect(lowPlain.color).toBe('#ffffff')

      const lowSocketed = resolveGroundItemMetadata({ code: 'ssd', quality: 1, sockets: 2 })
      expect(lowSocketed.color).toBe('#a0a0a0')

      const lowSocketFlag = resolveGroundItemMetadata({ code: 'ssd', quality: 1, rawFlags: 0x800 })
      expect(lowSocketFlag.color).toBe('#a0a0a0')

      const lowEth = resolveGroundItemMetadata({ code: 'ssd', quality: 1, ethereal: true })
      expect(lowEth.color).toBe('#a0a0a0')
    })

    it("excludes Wirt's Leg (leg) from Quest Gold (#c4a060) per 0x6FB6FF75, while keeping genuine quest items Gold", () => {
      expect(CANONICAL_QUEST_ITEM_CODES.has('leg')).toBe(false)
      const legPlain = resolveGroundItemMetadata({ code: 'leg', quality: 2 })
      expect(legPlain.color).toBe('#ffffff')

      const legSocketed = resolveGroundItemMetadata({ code: 'leg', quality: 2, sockets: 3 })
      expect(legSocketed.color).toBe('#a0a0a0')

      const bks = resolveGroundItemMetadata({ code: 'bks', quality: 2 })
      expect(bks.color).toBe('#c4a060')
    })

    it('renders all 11 special codes (keys, organs, essences, token) and runes in Orange (#ffa500) per 0x6FB6FF86..0x6FB6FFE9', () => {
      const expectedCodes = ['ceh', 'bet', 'tes', 'fed', 'toa', 'dhn', 'bey', 'mbr', 'pk1', 'pk2', 'pk3']
      expect([...CANONICAL_ORANGE_SPECIAL_ITEM_CODES].sort()).toEqual([...expectedCodes].sort())
      for (const code of expectedCodes) {
        const meta = resolveGroundItemMetadata({ code, quality: 2 })
        expect(meta.color).toBe('#ffa500')
      }
      const runeMeta = resolveGroundItemMetadata({ code: 'r30', quality: 2 })
      expect(runeMeta.color).toBe('#ffa500')
    })

    it('draws ground item label boxes without any outer border and uses 3-state 1.13c background fills', () => {
      const hud = new HudManager()
      const filledRects: { fillStyle: string; x: number; y: number; w: number; h: number }[] = []
      const strokedRects: { strokeStyle: string; x: number; y: number; w: number; h: number }[] = []
      const mockCtx: any = {
        canvas: { width: 800, height: 600 },
        save: () => {},
        restore: () => {},
        clearRect: () => {},
        beginPath: () => {},
        closePath: () => {},
        rect: () => {},
        clip: () => {},
        fill: () => {},
        stroke: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        drawImage: () => {},
        fillText: () => {},
        strokeText: () => {},
        measureText: (t: string) => ({ width: t.length * 7 }),
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
        font: '',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        fillRect(x: number, y: number, w: number, h: number) {
          filledRects.push({ fillStyle: String(mockCtx.fillStyle), x, y, w, h })
        },
        strokeRect(x: number, y: number, w: number, h: number) {
          strokedRects.push({ strokeStyle: String(mockCtx.strokeStyle), x, y, w, h })
        },
      }

      hud.ctx = mockCtx
      const boxes = layoutGroundItemLabels([
        { id: 101, text: '500 Gold', color: '#ffffff', screenX: 200, screenY: 200, width: 80, height: 18, isHovered: false },
        { id: 102, text: 'Shako', color: '#c4a060', screenX: 400, screenY: 250, width: 70, height: 18, isHovered: true },
      ])
      expect(boxes[0]!.isHovered).toBe(false)
      expect(boxes[1]!.isHovered).toBe(true)

      // 1. Alt held (showGroundLabels = true): unhovered = rgba(0, 0, 0, 0.5), hovered = rgba(16, 36, 104, 0.85)
      hud.showGroundLabels = true
      hud.groundItemLabelBoxes = boxes
      hud.render(1000)

      const box0FillAlt = filledRects.find((r) => r.x === boxes[0]!.x && r.y === boxes[0]!.y && r.w === boxes[0]!.width && r.h === boxes[0]!.height)
      const box1FillAlt = filledRects.find((r) => r.x === boxes[1]!.x && r.y === boxes[1]!.y && r.w === boxes[1]!.width && r.h === boxes[1]!.height)
      expect(box0FillAlt?.fillStyle).toBe('rgba(0, 0, 0, 0.5)')
      expect(box1FillAlt?.fillStyle).toBe('rgba(16, 36, 104, 0.85)')
      const boxBorderStrokes = strokedRects.filter(
        (r) =>
          (Math.abs(r.x - boxes[0]!.x) <= 1 && Math.abs(r.y - boxes[0]!.y) <= 1) ||
          (Math.abs(r.x - boxes[1]!.x) <= 1 && Math.abs(r.y - boxes[1]!.y) <= 1),
      )
      expect(boxBorderStrokes).toHaveLength(0)

      // 2. Alt not held (showGroundLabels = false, single item hover): rgba(0, 0, 0, 0.75)
      filledRects.length = 0
      hud.showGroundLabels = false
      hud.groundItemLabelBoxes = [boxes[1]!]
      hud.render(1040)
      const singleHoverFill = filledRects.find((r) => r.x === boxes[1]!.x && r.y === boxes[1]!.y && r.w === boxes[1]!.width && r.h === boxes[1]!.height)
      expect(singleHoverFill?.fillStyle).toBe('rgba(0, 0, 0, 0.75)')
    })
  })
})
