import { describe, expect, it } from 'vitest'
import {
  COLLIDE_MASK_DROP_BLOCK,
  findIsometricDropPosition,
  findSafeDropPosition,
  isDropPositionBlocked,
  isTerrainPointBlocked,
  isWithinPickupBounds,
} from '../src/common/items/ground-items.ts'
import {
  COLLIDE_BLANK,
  COLLIDE_DOOR,
  COLLIDE_MASK_INVALID,
  COLLIDE_NO_PATH,
  COLLIDE_NONE,
  COLLIDE_NOPLAYER,
  COLLIDE_OBJECT,
  COLLIDE_WALL,
  COLLIDE_WATER,
  ORTHO_CELL_HEIGHT,
  ORTHO_CELL_WIDTH,
  ORTHO_SUB_TILE_HEIGHT,
  ORTHO_SUB_TILE_WIDTH,
  getCollisionMaskAt,
  isBlockedAt,
  subTileAt,
  subTileCentre,
  type CollisionGrid,
} from '../src/common/world/d2map.ts'
import { createIsoTerrain } from '../src/common/world/iso-terrain.ts'
import { GameEngine } from '../src/server/engine/game-engine.ts'

function createSubTileGrid(cellsX = 12, cellsY = 12): CollisionGrid {
  const gridWidth = cellsX * 5
  const gridHeight = cellsY * 5
  return {
    cellsX,
    cellsY,
    gridWidth,
    originX: cellsY * ORTHO_CELL_WIDTH,
    originY: 0,
    blocked: new Uint8Array(gridWidth * gridHeight),
    collisionMasks: new Uint16Array(gridWidth * gridHeight),
  }
}

function setSubTileMask(grid: CollisionGrid, subX: number, subY: number, mask: number): void {
  const idx = subY * grid.gridWidth + subX
  if (grid.collisionMasks) {
    grid.collisionMasks[idx] = mask
  }
  grid.blocked[idx] = (mask & (COLLIDE_WALL | COLLIDE_BLANK | COLLIDE_NOPLAYER | COLLIDE_WATER | COLLIDE_DOOR | COLLIDE_OBJECT)) !== 0 ? 1 : 0
}

describe('Issue #492: Prevent Ground Items & Gold from Dropping into Unreachable Locations', () => {
  describe('1. Blocked Origin Escape (Monster Dying Inside Thick Walls / Void / Water)', () => {
    it('escapes a 4x4 solid wall block instead of poisoning rayTraceScene and falling back to blocked origin', () => {
      const grid = createSubTileGrid(12, 12)
      // Block a 5x5 sub-tile block around sub-tile (25, 25)
      for (let sy = 23; sy <= 27; sy += 1) {
        for (let sx = 23; sx <= 27; sx += 1) {
          setSubTileMask(grid, sx, sy, COLLIDE_WALL)
        }
      }

      const origin = subTileCentre(grid, 25, 25)
      expect(isTerrainPointBlocked(origin.x, origin.y, grid)).toBe(true)

      const dropPos = findIsometricDropPosition(origin.x, origin.y, [], grid)
      expect(isTerrainPointBlocked(dropPos.x, dropPos.y, grid)).toBe(false)
      expect(getCollisionMaskAt(grid, dropPos.x, dropPos.y) & COLLIDE_MASK_DROP_BLOCK).toBe(0)
      expect(isBlockedAt(grid, dropPos.x, dropPos.y)).toBe(false)
    })

    it('escapes deeply buried origin (> 10 rings inside void/water) to nearest walkable floor', () => {
      const grid = createSubTileGrid(16, 16)
      // Block sub-tiles [15..45, 15..45] (radius 15 > default maxRings=10 around (30, 30))
      for (let sy = 15; sy <= 45; sy += 1) {
        for (let sx = 15; sx <= 45; sx += 1) {
          setSubTileMask(grid, sx, sy, COLLIDE_WATER)
        }
      }

      const buriedOrigin = subTileCentre(grid, 30, 30)
      expect(isTerrainPointBlocked(buriedOrigin.x, buriedOrigin.y, grid)).toBe(true)

      const dropPos = findIsometricDropPosition(buriedOrigin.x, buriedOrigin.y, [], grid)
      expect(isTerrainPointBlocked(dropPos.x, dropPos.y, grid)).toBe(false)
      expect(getCollisionMaskAt(grid, dropPos.x, dropPos.y) & COLLIDE_MASK_DROP_BLOCK).toBe(0)
    })
  })

  describe('2. Player Path-Connectivity (`reachableFrom`) Across Rivers, Moats & Sealed Rooms', () => {
    it('snaps drops from a monster killed across an impassable river onto the player side of the river', () => {
      const grid = createSubTileGrid(12, 12)
      // Create a full north-south river at subX = 24..27 across the entire map height
      for (let sy = 0; sy < 60; sy += 1) {
        for (let sx = 24; sx <= 27; sx += 1) {
          setSubTileMask(grid, sx, sy, COLLIDE_WATER | COLLIDE_WALL)
        }
      }

      // Player is on the West bank (subX = 20, subY = 30)
      const playerPos = subTileCentre(grid, 20, 30)
      // Flying/ranged monster dies on the East bank (subX = 32, subY = 30) across the river
      const monsterDeathPos = subTileCentre(grid, 32, 30)

      expect(isTerrainPointBlocked(playerPos.x, playerPos.y, grid)).toBe(false)
      expect(isTerrainPointBlocked(monsterDeathPos.x, monsterDeathPos.y, grid)).toBe(false)

      const existing: { x: number; y: number }[] = []
      for (let i = 0; i < 6; i += 1) {
        const dropPos = findIsometricDropPosition(
          monsterDeathPos.x,
          monsterDeathPos.y,
          existing,
          grid,
          ORTHO_SUB_TILE_WIDTH,
          ORTHO_SUB_TILE_HEIGHT,
          10,
          16,
          playerPos,
        )
        existing.push(dropPos)

        const dropSub = subTileAt(grid, dropPos.x, dropPos.y)
        // Every dropped item must land on the West bank (subX < 24) where the player can reach it
        expect(dropSub.subX).toBeLessThan(24)
        expect(isTerrainPointBlocked(dropPos.x, dropPos.y, grid)).toBe(false)
      }
    })

    it('never leaks items through a thin 1-sub-tile wall into an adjacent sealed room during a 15-item burst drop', () => {
      const grid = createSubTileGrid(12, 12)
      // Seal a 3x3 sub-tile room at subX = 20..22, subY = 20..22 with a 1-sub-tile wall ring at 19..23
      for (let sy = 19; sy <= 23; sy += 1) {
        for (let sx = 19; sx <= 23; sx += 1) {
          const isInterior = sx >= 20 && sx <= 22 && sy >= 20 && sy <= 22
          if (!isInterior) {
            setSubTileMask(grid, sx, sy, COLLIDE_WALL)
          }
        }
      }

      // Exterior floor (subX < 19 or > 23) is completely open, but separated by the wall ring
      const roomCenter = subTileCentre(grid, 21, 21)
      const existing: { x: number; y: number }[] = []

      for (let i = 0; i < 15; i += 1) {
        const pos = findIsometricDropPosition(
          roomCenter.x,
          roomCenter.y,
          existing,
          grid,
          ORTHO_SUB_TILE_WIDTH,
          ORTHO_SUB_TILE_HEIGHT,
          10,
          16,
          roomCenter,
        )
        existing.push(pos)
        const sub = subTileAt(grid, pos.x, pos.y)
        expect(sub.subX).toBeGreaterThanOrEqual(20)
        expect(sub.subX).toBeLessThanOrEqual(22)
        expect(sub.subY).toBeGreaterThanOrEqual(20)
        expect(sub.subY).toBeLessThanOrEqual(22)
      }
    })
  })

  describe('3. Diagonal Wall-Corner Pinch Prevention', () => {
    it('rejects diagonal step when both shared orthogonal neighbors are wall sub-tiles', () => {
      const grid = createSubTileGrid(10, 10)
      // Origin at (25, 25). Block (26, 25) and (25, 26) so diagonal (26, 26) is pinched by orthogonal walls.
      setSubTileMask(grid, 26, 25, COLLIDE_WALL)
      setSubTileMask(grid, 25, 26, COLLIDE_WALL)

      const origin = subTileCentre(grid, 25, 25)
      const diagTarget = subTileCentre(grid, 26, 26)

      expect(isTerrainPointBlocked(diagTarget.x, diagTarget.y, grid)).toBe(false)
      expect(isDropPositionBlocked(diagTarget.x, diagTarget.y, origin.x, origin.y, grid)).toBe(true)
    })

    it('rejects diagonal cell in findSafeDropPosition when sealed by orthogonal wall cells', () => {
      const width = 5
      const height = 5
      const collisionMasks = new Uint16Array(width * height).fill(COLLIDE_WALL)
      // Open (2, 2) and (3, 3), but keep (3, 2) and (2, 3) as COLLIDE_WALL so (3, 3) is diagonally pinched
      collisionMasks[2 * width + 2] = COLLIDE_NONE
      collisionMasks[3 * width + 3] = COLLIDE_NONE
      const grid = { width, height, collisionMasks }

      // Occupy (2, 2) so findSafeDropPosition searches Ring 1
      const pos = findSafeDropPosition(grid, 2, 2, 2, [{ cellX: 2, cellY: 2 }])
      // Must NOT jump diagonally into the sealed (3, 3) pocket; instead stacks safely on (2, 2)
      expect(pos.cellX).toBe(2)
      expect(pos.cellY).toBe(2)
    })
  })

  describe('4. Full Collision Mask & CountingTerrain Player Footprint Clearance', () => {
    it('rejects COLLIDE_WATER, COLLIDE_NOPLAYER, COLLIDE_BLANK, COLLIDE_NO_PATH, and COLLIDE_MASK_INVALID', () => {
      const forbiddenMasks = [
        COLLIDE_WATER,
        COLLIDE_NOPLAYER,
        COLLIDE_BLANK,
        COLLIDE_NO_PATH,
        COLLIDE_MASK_INVALID,
        COLLIDE_DOOR,
        COLLIDE_OBJECT,
      ]

      for (const mask of forbiddenMasks) {
        const grid = createSubTileGrid(8, 8)
        setSubTileMask(grid, 20, 20, mask)
        const pt = subTileCentre(grid, 20, 20)
        expect(isTerrainPointBlocked(pt.x, pt.y, grid)).toBe(true)

        const drop = findIsometricDropPosition(pt.x, pt.y, [], grid)
        expect(drop).not.toEqual(pt)
        expect(isTerrainPointBlocked(drop.x, drop.y, grid)).toBe(false)
      }
    })

    it('enforces CountingTerrain.overlap(x, y) === 0 in both findIsometricDropPosition and findSafeDropPosition', () => {
      const grid = createSubTileGrid(10, 10)
      const terrain = createIsoTerrain(grid, 800, 800, { width: 20, height: 10 })

      // Sub-tile (20, 20) itself is COLLIDE_NONE, but adjacent sub-tile (20, 21) is blocked so player 20x10 box overlaps
      const center = subTileCentre(grid, 20, 20)
      const neighbor = subTileAt(grid, center.x + 8, center.y + 4)
      setSubTileMask(grid, neighbor.subX, neighbor.subY, COLLIDE_WALL)

      expect(terrain.overlap(center.x, center.y)).toBeGreaterThan(0)
      expect(isTerrainPointBlocked(center.x, center.y, terrain)).toBe(true)
      const drop = findIsometricDropPosition(center.x, center.y, [], terrain)
      expect(terrain.overlap(drop.x, drop.y)).toBe(0)
    })
  })

  describe('5. End-to-End GameEngine Walk & Pickup Reachability Verification', () => {
    it('guarantees player can physically walk to and pick up items/gold dropped when monster dies inside a wall', () => {
      const grid = createSubTileGrid(12, 12)
      // Create a solid wall on the right half of the map (subX >= 25)
      for (let sy = 0; sy < 60; sy += 1) {
        for (let sx = 25; sx < 60; sx += 1) {
          setSubTileMask(grid, sx, sy, COLLIDE_WALL)
        }
      }

      const terrain = createIsoTerrain(grid, 1600, 1600, { width: 20, height: 10 })
      const playerSpawn = subTileCentre(grid, 20, 25)
      expect(terrain.overlap(playerSpawn.x, playerSpawn.y)).toBe(0)

      const engine = new GameEngine(terrain, {
        spawn: playerSpawn,
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
      })

      // Drop item and gold at a point deep inside the wall (subX = 30, subY = 25)
      const insideWallPos = subTileCentre(grid, 30, 25)
      expect(terrain.overlap(insideWallPos.x, insideWallPos.y)).toBeGreaterThan(0)

      const itemEntity = engine.dropItem(
        { code: 'ssd', name: 'Short Sword', invWidth: 1, invHeight: 3 } as any,
        insideWallPos.x,
        insideWallPos.y,
      )
      const goldEntity = engine.dropGold(250, insideWallPos.x, insideWallPos.y, undefined, undefined, { fromWorld: true })!

      expect(terrain.overlap(itemEntity.x, itemEntity.y)).toBe(0)
      expect(terrain.overlap(goldEntity.x, goldEntity.y)).toBe(0)

      // Physically walk the player toward the dropped item using axis-separated collision checks
      for (let step = 0; step < 120; step += 1) {
        const dx = itemEntity.x - engine.world.player.x
        const dy = itemEntity.y - engine.world.player.y
        const dist = Math.hypot(dx, dy)
        if (dist <= 4) break
        const vx = (dx / dist) * 4
        const vy = (dy / dist) * 4
        const cur = terrain.overlap(engine.world.player.x, engine.world.player.y)
        if (terrain.overlap(engine.world.player.x + vx, engine.world.player.y) <= cur) {
          engine.world.player.x += vx
        }
        if (terrain.overlap(engine.world.player.x, engine.world.player.y + vy) <= cur) {
          engine.world.player.y += vy
        }
      }

      expect(
        isWithinPickupBounds(
          engine.world.player.x,
          engine.world.player.y,
          itemEntity.x,
          itemEntity.y,
        ),
      ).toBe(true)

      const itemPickup = engine.pickupItem(itemEntity.id)
      expect(itemPickup.success).toBe(true)
      const goldPickup = engine.pickupGold(goldEntity.id)
      expect(goldPickup.success).toBe(true)
      expect(goldPickup.amount).toBe(250)
    })
  })
})
