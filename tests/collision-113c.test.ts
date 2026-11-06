import { describe, expect, it } from 'vitest'
import {
  COLLIDE_DOOR,
  COLLIDE_MASK_INVALID,
  COLLIDE_MASK_LOS,
  COLLIDE_MASK_MISSILE,
  COLLIDE_MASK_PLAYER_FLYING,
  COLLIDE_MASK_PLAYER_PATH,
  COLLIDE_MISSILE_BARRIER,
  COLLIDE_NONE,
  COLLIDE_NOPLAYER,
  COLLIDE_OBJECT,
  COLLIDE_VISIBLE,
  COLLIDE_WALL,
  buildIsoMapScene,
  cellCentre,
  collisionCheckMask,
  collisionRayTrace,
  collisionResetMask,
  collisionSetMask,
  getCollisionMask,
  isBlockedAt,
  isLosBlockedAt,
  isMissileBlockedAt,
  subTileAt,
} from '../src/common/world/d2map.ts'
import type { CollisionGrid } from '../src/common/world/d2map.ts'
import { createIsoTerrain } from '../src/common/world/iso-terrain.ts'
import { tickProjectiles } from '../src/server/skills/skills.ts'
import { subTileFlagsOf } from '../src/common/formats/dt1.ts'
import type { Dt1, Dt1Tile } from '../src/common/formats/dt1.ts'
import type { Ds1 } from '../src/common/formats/ds1.ts'

function createMockGrid(cellsX: number, cellsY: number): CollisionGrid & { collisionMasks: Uint16Array } {
  const gridWidth = cellsX * 5
  const gridHeight = cellsY * 5
  return {
    originX: cellsY * 80,
    originY: 0,
    cellsX,
    cellsY,
    gridWidth,
    blocked: new Uint8Array(gridWidth * gridHeight),
    collisionMasks: new Uint16Array(gridWidth * gridHeight),
  }
}

function makeTestTile(type: number, style: number, sequence: number, rawFlag: number): Dt1Tile {
  const flags = Array.from({ length: 25 }, () => subTileFlagsOf(rawFlag))
  return {
    direction: type,
    roofHeight: 0,
    materialFlags: 0,
    height: -80,
    width: 160,
    type,
    style,
    sequence,
    rarityFrameIndex: 1,
    animated: 0,
    subTileFlags: flags,
    minBlockY: -80,
    bitmapHeight: 80,
    blocks: [
      {
        x: 0,
        y: -80,
        gridX: 0,
        gridY: 0,
        format: 1,
        pixels: new Uint8Array(160 * 80).fill(1),
      },
    ],
  }
}

describe('Blizzard D2 1.13c 16-bit Multi-Layer Collision Masks & RayTrace (Issue #75)', () => {
  it('defines canonical 1.13c D2C_CollisionMaskFlags bit values and composite masks', () => {
    expect(COLLIDE_NONE).toBe(0x0000)
    expect(COLLIDE_WALL).toBe(0x0001)
    expect(COLLIDE_VISIBLE).toBe(0x0002)
    expect(COLLIDE_MISSILE_BARRIER).toBe(0x0004)
    expect(COLLIDE_NOPLAYER).toBe(0x0008)
    expect(COLLIDE_OBJECT).toBe(0x0400)
    expect(COLLIDE_DOOR).toBe(0x0800)

    expect(COLLIDE_MASK_PLAYER_PATH & COLLIDE_WALL).toBe(COLLIDE_WALL)
    expect(COLLIDE_MASK_PLAYER_PATH & COLLIDE_DOOR).toBe(COLLIDE_DOOR)
    expect(COLLIDE_MASK_PLAYER_PATH & COLLIDE_OBJECT).toBe(COLLIDE_OBJECT)

    expect(COLLIDE_MASK_MISSILE & COLLIDE_WALL).toBe(0)
    expect(COLLIDE_MASK_MISSILE & COLLIDE_MISSILE_BARRIER).toBe(COLLIDE_MISSILE_BARRIER)
    expect(COLLIDE_MASK_MISSILE & COLLIDE_DOOR).toBe(COLLIDE_DOOR)

    expect(COLLIDE_MASK_LOS & COLLIDE_VISIBLE).toBe(COLLIDE_VISIBLE)
    expect(COLLIDE_MASK_LOS & COLLIDE_WALL).toBe(0)
    expect(COLLIDE_MASK_PLAYER_FLYING).toBe(COLLIDE_DOOR | COLLIDE_MISSILE_BARRIER)
  })

  it('stamps 16-bit multi-layer flags into collisionMasks while preserving exact blocked Uint8Array', () => {
    // Tile 0: walkable floor (0x00)
    // Tile 1: river/water floor (0x01 = blockWalk only, missiles/LoS pass)
    // Tile 2: solid stone wall (0x07 = blockWalk | blockLos | blockJump)
    // Tile 3: door wall (type 8, 0x07 -> gets COLLIDE_DOOR 0x0800 OR-ed)
    const dt1: Dt1 = {
      versionMajor: 7,
      versionMinor: 6,
      warnings: [],
      tiles: [
        makeTestTile(0, 1, 0, 0x00),
        makeTestTile(0, 1, 1, COLLIDE_WALL),
        makeTestTile(1, 2, 0, COLLIDE_WALL | COLLIDE_VISIBLE | COLLIDE_MISSILE_BARRIER),
        makeTestTile(8, 2, 1, COLLIDE_WALL | COLLIDE_VISIBLE | COLLIDE_MISSILE_BARRIER),
      ],
    }

    const ds1: Ds1 = {
      version: 18,
      width: 4,
      height: 1,
      act: 1,
      substitutionType: 0,
      wallLayers: 1,
      floorLayers: 1,
      objects: [],
      npcPathOffset: null,
      cells: [
        [
          {
            floors: [{ prop1: 1, sequence: 0, style: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [],
            shadows: [],
            substitutions: [],
          },
          {
            floors: [{ prop1: 1, sequence: 1, style: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [],
            shadows: [],
            substitutions: [],
          },
          {
            floors: [{ prop1: 1, sequence: 0, style: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [{ prop1: 1, sequence: 0, style: 2, type: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            shadows: [],
            substitutions: [],
          },
          {
            floors: [{ prop1: 1, sequence: 0, style: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [{ prop1: 1, sequence: 1, style: 2, type: 8, hidden: false, unknown1: 0, unknown2: 0 }],
            shadows: [],
            substitutions: [],
          },
        ],
      ],
    }

    const scene = buildIsoMapScene(ds1, [dt1], 42)
    expect(scene.collisionMasks).toBeInstanceOf(Uint16Array)
    expect(scene.collisionMasks.length).toBe(scene.blocked.length)

    // Cell (0,0): Clear floor
    const c0 = cellCentre(scene, 0, 0)
    expect(isBlockedAt(scene, c0.x, c0.y)).toBe(false)
    expect(isMissileBlockedAt(scene, c0.x, c0.y)).toBe(false)
    expect(isLosBlockedAt(scene, c0.x, c0.y)).toBe(false)

    // Cell (1,0): River / low barrier (COLLIDE_WALL = 0x0001 only)
    const c1 = cellCentre(scene, 1, 0)
    expect(isBlockedAt(scene, c1.x, c1.y)).toBe(true) // Blocks player walking
    expect(isMissileBlockedAt(scene, c1.x, c1.y)).toBe(false) // Projectiles fly across!
    expect(isLosBlockedAt(scene, c1.x, c1.y)).toBe(false) // Can see across river!

    // Cell (2,0): Solid wall (0x0007)
    const c2 = cellCentre(scene, 2, 0)
    expect(isBlockedAt(scene, c2.x, c2.y)).toBe(true)
    expect(isMissileBlockedAt(scene, c2.x, c2.y)).toBe(true)
    expect(isLosBlockedAt(scene, c2.x, c2.y)).toBe(true)

    // Cell (3,0): Door wall (type 8) -> has COLLIDE_DOOR (0x0800) set
    const c3 = cellCentre(scene, 3, 0)
    const sub3 = subTileAt(scene, c3.x, c3.y)
    expect(collisionCheckMask(scene, sub3.subX, sub3.subY, COLLIDE_DOOR)).toBe(true)
  })

  it('supports COLLISION_SetMask and COLLISION_ResetMask for dynamic doors and obstacles', () => {
    const grid = createMockGrid(3, 3)
    const doorSubX = 7
    const doorSubY = 7

    // Initially open
    expect(collisionCheckMask(grid, doorSubX, doorSubY, COLLIDE_MASK_PLAYER_PATH)).toBe(false)
    expect(grid.blocked[doorSubY * grid.gridWidth + doorSubX]).toBe(0)

    // Close door: set COLLIDE_DOOR | COLLIDE_VISIBLE | COLLIDE_MISSILE_BARRIER
    const doorFlags = COLLIDE_DOOR | COLLIDE_VISIBLE | COLLIDE_MISSILE_BARRIER
    collisionSetMask(grid, doorSubX, doorSubY, doorFlags, 2, 1)

    expect(collisionCheckMask(grid, doorSubX, doorSubY, COLLIDE_DOOR)).toBe(true)
    expect(collisionCheckMask(grid, doorSubX + 1, doorSubY, COLLIDE_MASK_PLAYER_PATH)).toBe(true)
    expect(collisionCheckMask(grid, doorSubX, doorSubY, COLLIDE_MASK_MISSILE)).toBe(true)
    expect(collisionCheckMask(grid, doorSubX, doorSubY, COLLIDE_MASK_LOS)).toBe(true)
    expect(grid.blocked[doorSubY * grid.gridWidth + doorSubX]).toBe(1)

    // Open door: reset door flags
    collisionResetMask(grid, doorSubX, doorSubY, doorFlags, 2, 1)

    expect(collisionCheckMask(grid, doorSubX, doorSubY, COLLIDE_DOOR)).toBe(false)
    expect(collisionCheckMask(grid, doorSubX, doorSubY, COLLIDE_MASK_PLAYER_PATH)).toBe(false)
    expect(collisionCheckMask(grid, doorSubX, doorSubY, COLLIDE_MASK_MISSILE)).toBe(false)
    expect(collisionCheckMask(grid, doorSubX, doorSubY, COLLIDE_MASK_LOS)).toBe(false)
    expect(grid.blocked[doorSubY * grid.gridWidth + doorSubX]).toBe(0)
  })

  it('performs sub-tile COLLISION_RayTrace and separates river flyover from wall hits in tickProjectiles', () => {
    const grid = createMockGrid(6, 6)

    // Place a river strip at subX = 10 (COLLIDE_WALL = 0x0001 only)
    collisionSetMask(grid, 10, 0, COLLIDE_WALL, 2, 30)

    // Place a solid pillar at subX = 20, subY = 10..15 (COLLIDE_WALL | COLLIDE_VISIBLE | COLLIDE_MISSILE_BARRIER)
    collisionSetMask(grid, 20, 10, COLLIDE_WALL | COLLIDE_VISIBLE | COLLIDE_MISSILE_BARRIER, 1, 6)

    // 1. RayTrace across river (subX 5 -> 15 at subY = 12):
    // Walking path raytrace hits the river at subX = 10:
    const walkRay = collisionRayTrace(grid, 5, 12, 15, 12, COLLIDE_MASK_PLAYER_PATH)
    expect(walkRay.hit).toBe(true)
    expect(walkRay.hitSubX).toBe(10)

    // Missile raytrace flies right over the river without hitting!
    const missileRayOverRiver = collisionRayTrace(grid, 5, 12, 15, 12, COLLIDE_MASK_MISSILE)
    expect(missileRayOverRiver.hit).toBe(false)
    expect(missileRayOverRiver.hitSubX).toBe(15)

    // LoS raytrace sees right across the river!
    const losRayOverRiver = collisionRayTrace(grid, 5, 12, 15, 12, COLLIDE_MASK_LOS)
    expect(losRayOverRiver.hit).toBe(false)

    // 2. Missile raytrace toward the solid pillar at subX = 20 stops at (20, 12):
    const missileRayIntoPillar = collisionRayTrace(grid, 5, 12, 25, 12, COLLIDE_MASK_MISSILE)
    expect(missileRayIntoPillar.hit).toBe(true)
    expect(missileRayIntoPillar.hitSubX).toBe(20)
    expect(missileRayIntoPillar.hitSubY).toBe(12)

    // 3. Verify tickProjectiles with createIsoTerrain allows arrows to fly over the river and hit a monster on the other side
    const terrain = createIsoTerrain(grid, 960, 480, { width: 16, height: 8 })
    const startPt = cellCentre(grid, 1, 2) // subX ~ 7, subY ~ 12
    const targetPt = cellCentre(grid, 3, 2) // subX ~ 17, subY ~ 12 (across the river at subX=10..11!)

    // Confirm river blocks walking between startPt and targetPt
    const riverPt = cellCentre(grid, 2, 2) // subX ~ 10..12
    collisionSetMask(grid, 10, 10, COLLIDE_WALL, 5, 5)
    expect(terrain.overlap(riverPt.x, riverPt.y)).toBeGreaterThan(0)

    // Fire a fast arrow from startPt directly to targetPt across the river
    const outcome = tickProjectiles(
      [
        {
          skillId: 'arrow',
          x: startPt.x,
          y: startPt.y,
          vx: targetPt.x - startPt.x,
          vy: targetPt.y - startPt.y,
          damage: 25,
          ttl: 5,
          fromPlayer: true,
        },
      ],
      [{ index: 0, x: targetPt.x, y: targetPt.y, radius: 16, alive: true }],
      terrain,
    )

    expect(outcome.wallHits).toBe(0)
    expect(outcome.hits).toHaveLength(1)
    expect(outcome.hits[0]?.damage).toBe(25)

    // Out-of-bounds returns COLLIDE_MASK_INVALID
    expect(getCollisionMask(grid, -1, -1)).toBe(COLLIDE_MASK_INVALID)
  })
})
