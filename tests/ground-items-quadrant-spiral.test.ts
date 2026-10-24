import { describe, expect, it } from 'vitest'
import {
  findSafeDropPosition,
  getIsometricRingCandidates,
} from '../src/common/items/ground-items.ts'
import {
  COLLIDE_NONE,
  COLLIDE_WALL,
  COLLIDE_BLANK,
  COLLIDE_MASK_INVALID,
  COLLIDE_DOOR,
  COLLIDE_WATER,
  ORTHO_CELL_WIDTH,
  ORTHO_CELL_HEIGHT,
  type CollisionGrid,
} from '../src/common/world/d2map.ts'
import { GameEngine, worldToCell } from '../src/server/engine/game-engine.ts'

describe('Issue #422: Grid Quadrant Spiral Drop Coordinates (1.13c Parity)', () => {
  describe('Suite 1: Discrete Collision Grid Quadrant Spiral Search', () => {
    it('1.1: places item directly on origin when origin is unblocked and unoccupied', () => {
      const mockGrid = { isBlocked: () => false }
      const pos = findSafeDropPosition(mockGrid, 12, 18, 3)
      expect(pos.cellX).toBe(12)
      expect(pos.cellY).toBe(18)
    })

    it('1.2: rejects COLLIDE_WALL (0x0001) and selects nearest cardinal neighbor in Ring 1', () => {
      const width = 5
      const height = 5
      const masks = new Uint16Array(width * height)
      masks[2 * width + 2] = COLLIDE_WALL // origin (2, 2) blocked
      const grid = { width, height, collisionMasks: masks }

      const pos = findSafeDropPosition(grid, 2, 2, 2)
      expect(pos.cellX !== 2 || pos.cellY !== 2).toBe(true)
      const manhattan = Math.abs(pos.cellX - 2) + Math.abs(pos.cellY - 2)
      expect(manhattan).toBe(1) // Nearest cardinal axis neighbor
    })

    it('1.3: rejects COLLIDE_BLANK (sparse void cells) per Diablo II user rules', () => {
      const width = 5
      const height = 5
      const masks = new Uint16Array(width * height)
      masks[2 * width + 2] = COLLIDE_BLANK // void at (2, 2)
      masks[2 * width + 1] = COLLIDE_BLANK // void at (1, 2)
      masks[2 * width + 3] = COLLIDE_NONE  // walkable floor at (3, 2)
      const grid = { width, height, collisionMasks: masks }

      const pos = findSafeDropPosition(grid, 2, 2, 2)
      expect(pos.cellX).toBe(3)
      expect(pos.cellY).toBe(2)
    })

    it('1.4: rejects COLLIDE_MASK_INVALID on unindexed cells and map boundaries', () => {
      const width = 10
      const height = 10
      const masks = new Uint16Array(width * height)
      masks[0] = COLLIDE_MASK_INVALID
      const grid = { width, height, collisionMasks: masks }

      const pos = findSafeDropPosition(grid, 0, 0, 2)
      expect(pos.cellX).toBeGreaterThanOrEqual(0)
      expect(pos.cellY).toBeGreaterThanOrEqual(0)
      expect(pos.cellX !== 0 || pos.cellY !== 0).toBe(true)
    })

    it('1.5: concentric quadrant rings strictly order cardinal axes before diagonals', () => {
      const ring1 = getIsometricRingCandidates(1)
      expect(ring1.length).toBe(8)
      // First 4 candidates must be cardinal axes (L1 = 1)
      for (let i = 0; i < 4; i++) {
        expect(ring1[i]!.l1).toBe(1)
      }
      // Remaining 4 candidates must be diagonals (L1 = 2)
      for (let i = 4; i < 8; i++) {
        expect(ring1[i]!.l1).toBe(2)
      }
    })
  })

  describe('Suite 2: Multi-Item Burst Dispersal & Anti-Stacking', () => {
    it('2.1: 6-item drop burst from a single monster disperses into 6 distinct cells', () => {
      const occupied: { cellX: number; cellY: number }[] = []
      const grid = { isBlocked: () => false }

      for (let i = 0; i < 6; i++) {
        const pos = findSafeDropPosition(grid, 15, 15, 3, occupied)
        occupied.push(pos)
      }

      expect(occupied.length).toBe(6)
      const uniqueKeys = new Set(occupied.map(p => `${p.cellX},${p.cellY}`))
      expect(uniqueKeys.size).toBe(6)
    })

    it('2.2: existing ground items force subsequent drops to spiral outward', () => {
      const existing = [{ cellX: 10, cellY: 10 }]
      const grid = { isBlocked: () => false }

      const pos = findSafeDropPosition(grid, 10, 10, 3, existing)
      expect(pos.cellX !== 10 || pos.cellY !== 10).toBe(true)
      const dist = Math.hypot(pos.cellX - 10, pos.cellY - 10)
      expect(dist).toBeGreaterThanOrEqual(1)
    })

    it('2.3: room saturation fallback stacks on first walkable floor when radius is saturated', () => {
      // 1x1 sealed walkable room surrounded by void
      const width = 3
      const height = 3
      const masks = new Uint16Array(width * height).fill(COLLIDE_WALL)
      masks[1 * width + 1] = COLLIDE_NONE // only (1, 1) is walkable floor
      const grid = { width, height, collisionMasks: masks }

      const item1 = findSafeDropPosition(grid, 1, 1, 1, [])
      expect(item1.cellX).toBe(1)
      expect(item1.cellY).toBe(1)

      // Item 2 drops into the same saturated room: must fallback to walkable cell (1, 1) rather than wall
      const item2 = findSafeDropPosition(grid, 1, 1, 1, [item1])
      expect(item2.cellX).toBe(1)
      expect(item2.cellY).toBe(1)
    })
  })

  describe('Suite 3: Varied Map Collision Layouts Parity', () => {
    it('3.1: Corridor Layout (1-cell wide hallway): drops spread along corridor floor, never in walls', () => {
      const width = 20
      const height = 20
      const masks = new Uint16Array(width * height)
      // East-West corridor along y = 10; walls along y = 9 and y = 11
      for (let x = 0; x < width; x++) {
        masks[9 * width + x] = COLLIDE_WALL
        masks[11 * width + x] = COLLIDE_WALL
      }
      const grid = { width, height, collisionMasks: masks }

      const placed: { cellX: number; cellY: number }[] = []
      for (let i = 0; i < 5; i++) {
        const pos = findSafeDropPosition(grid, 10, 10, 4, placed)
        placed.push(pos)
        // All drops must strictly remain inside corridor floor (y = 10)
        expect(pos.cellY).toBe(10)
        expect(pos.cellX).toBeGreaterThanOrEqual(8)
        expect(pos.cellX).toBeLessThanOrEqual(12)
      }
    })

    it('3.2: Corner / L-Shape Room Layout: drops exclusively populate open walkable quadrant', () => {
      const width = 10
      const height = 10
      const masks = new Uint16Array(width * height)
      // Corner at (1, 1): walls at x = 0 and y = 0
      for (let i = 0; i < width; i++) {
        masks[0 * width + i] = COLLIDE_WALL
        masks[i * width + 0] = COLLIDE_WALL
      }
      const grid = { width, height, collisionMasks: masks }

      const placed: { cellX: number; cellY: number }[] = []
      for (let i = 0; i < 4; i++) {
        const pos = findSafeDropPosition(grid, 1, 1, 3, placed)
        placed.push(pos)
        expect(pos.cellX).toBeGreaterThanOrEqual(1)
        expect(pos.cellY).toBeGreaterThanOrEqual(1)
      }
    })

    it('3.3: Moat / River Boundary (Mephisto moat parity): drops stay on ground bank, 0 in water', () => {
      const width = 30
      const height = 30
      const masks = new Uint16Array(width * height)
      // Moat water from x = 15 to 30
      for (let y = 0; y < height; y++) {
        for (let x = 15; x < width; x++) {
          masks[y * width + x] = COLLIDE_WALL | COLLIDE_WATER
        }
      }
      const grid = { width, height, collisionMasks: masks }

      // Mephisto dies on stone bank adjacent to water (14, 15)
      const placed: { cellX: number; cellY: number }[] = []
      for (let i = 0; i < 6; i++) {
        const pos = findSafeDropPosition(grid, 14, 15, 4, placed)
        placed.push(pos)
        expect(pos.cellX).toBeLessThan(15) // Never in moat
      }
    })

    it('3.4: Monster dying inside a wall cell: items safely spiral out to nearest walkable floor', () => {
      const width = 10
      const height = 10
      const masks = new Uint16Array(width * height)
      masks[5 * width + 5] = COLLIDE_WALL // monster died inside wall
      const grid = { width, height, collisionMasks: masks }

      const pos = findSafeDropPosition(grid, 5, 5, 3)
      expect(pos.cellX !== 5 || pos.cellY !== 5).toBe(true)
      expect(masks[pos.cellY * width + pos.cellX]).toBe(COLLIDE_NONE)
    })
  })

  describe('Suite 4: GameEngine & CollisionGrid Integration', () => {
    it('4.1: GameEngine.dropItem spreads items cleanly across discrete cell coordinates', () => {
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

      const d1 = engine.dropItem({ name: 'Item 1' } as any, 200, 200)
      const d2 = engine.dropItem({ name: 'Item 2' } as any, 200, 200)
      const d3 = engine.dropItem({ name: 'Item 3' } as any, 200, 200)

      expect(d1.x).toBe(200)
      expect(d1.y).toBe(200)
      expect(d2.x !== 200 || d2.y !== 200).toBe(true)
      expect(d3.x !== 200 || d3.y !== 200).toBe(true)
      expect(Math.hypot(d2.x - d1.x, d2.y - d1.y)).toBeGreaterThanOrEqual(16)
      expect(Math.hypot(d3.x - d1.x, d3.y - d1.y)).toBeGreaterThanOrEqual(16)
    })

    it('4.2: GameEngine drops adhere to real CollisionGrid sub-tile masks', () => {
      const cellsX = 10
      const cellsY = 10
      const gridWidth = cellsX * 5
      const blocked = new Uint8Array(gridWidth * cellsY * 5)
      const collisionMasks = new Uint16Array(gridWidth * cellsY * 5)

      // Block cell (3, 3) center sub-tile
      collisionMasks[(3 * 5 + 2) * gridWidth + (3 * 5 + 2)] = COLLIDE_WALL

      const collisionGrid: CollisionGrid = {
        cellsX,
        cellsY,
        gridWidth,
        originX: 0,
        originY: 0,
        blocked,
        collisionMasks,
      }

      const terrain = {
        widthPx: 1000,
        heightPx: 1000,
        grid: collisionGrid,
        overlap: () => 0,
      }

      const pos = findSafeDropPosition(terrain, 3, 3, 2)
      expect(pos.cellX !== 3 || pos.cellY !== 3).toBe(true)
      const mask = collisionMasks[(pos.cellY * 5 + 2) * gridWidth + (pos.cellX * 5 + 2)]
      expect((mask & COLLIDE_WALL)).toBe(0)
    })
  })
})
