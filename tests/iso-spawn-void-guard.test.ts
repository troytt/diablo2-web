import { describe, expect, it } from 'vitest'
import type { Ds1, Ds1Cell } from '../src/common/formats/ds1.ts'
import type { Dt1, Dt1Tile } from '../src/common/formats/dt1.ts'
import {
  buildIsoMapScene,
  cellAt,
  cellCentre,
  findIsoSpawn as findIsoSpawnFromMap,
  isBlockedAt,
  COLLIDE_BLANK,
  COLLIDE_MASK_INVALID,
  COLLIDE_WALL,
} from '../src/common/world/d2map.ts'
import { findIsoSpawn as findIsoSpawnFromLinks } from '../src/common/world/level-links.ts'
import { SUB_TILES_PER_TILE } from '../src/common/world/map.ts'

/**
 * Creates a minimal synthetic DT1 tile with uniform 5x5 sub-tile collision flags.
 */
function makeTestTile(type: number, style: number, sequence: number, flagRaw: number): Dt1Tile {
  const flags = Array.from({ length: 25 }, () => ({
    blockWalk: (flagRaw & COLLIDE_WALL) !== 0,
    blockPlayerWalk: (flagRaw & COLLIDE_WALL) !== 0,
    blockLight: false,
    blockLos: (flagRaw & 0x0002) !== 0,
    blockJump: (flagRaw & 0x0004) !== 0,
    raw: flagRaw,
  }))

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

describe('Issue #114: Void cell collision masking & player spawn void guard', () => {
  const dt1: Dt1 = {
    versionMajor: 7,
    versionMinor: 6,
    warnings: [],
    tiles: [
      // Type 0, Style 1, Sequence 0: walkable floor (0x00)
      makeTestTile(0, 1, 0, 0x0000),
      // Type 0, Style 1, Sequence 1: blocked floor (COLLIDE_WALL)
      makeTestTile(0, 1, 1, COLLIDE_WALL),
    ],
  }

  it('marks cells outside an isolated 4x4 room in a 16x16 canvas as blocked and COLLIDE_MASK_INVALID', () => {
    const cells: (Ds1Cell | undefined)[][] = []

    for (let y = 0; y < 16; y += 1) {
      const row: (Ds1Cell | undefined)[] = []
      for (let x = 0; x < 16; x += 1) {
        // 4x4 room placed at cellX: 2..5, cellY: 2..5
        if (x >= 2 && x <= 5 && y >= 2 && y <= 5) {
          row.push({
            floors: [{ prop1: 1, sequence: 0, style: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [],
            shadows: [],
            substitutions: [],
          })
        } else if (x === 0 && y === 0) {
          // Explicit empty cell with no floor array entries
          row.push({
            floors: [],
            walls: [],
            shadows: [],
            substitutions: [],
          })
        } else if (x === 1 && y === 1) {
          // Explicit cell with placeholder / hidden floor slots (prop1 === 0 or hidden === true)
          row.push({
            floors: [
              { prop1: 0, sequence: 0, style: 1, hidden: false, unknown1: 0, unknown2: 0 },
              { prop1: 1, sequence: 0, style: 1, hidden: true, unknown1: 0, unknown2: 0 },
            ],
            walls: [],
            shadows: [],
            substitutions: [],
          })
        } else {
          // Unplaced cell: undefined in cells array
          row.push(undefined)
        }
      }
      cells.push(row)
    }

    const ds1: Ds1 = {
      version: 18,
      width: 16,
      height: 16,
      act: 1,
      substitutionType: 0,
      wallLayers: 1,
      floorLayers: 1,
      objects: [],
      npcPathOffset: null,
      cells: cells as unknown as Ds1['cells'],
    }

    const scene = buildIsoMapScene(ds1, [dt1], 0)
    expect(scene.cellsX).toBe(16)
    expect(scene.cellsY).toBe(16)

    // Verify 1: Cells outside the 4x4 room must have all 25 sub-tiles blocked and marked COLLIDE_MASK_INVALID
    const gridWidth = 16 * SUB_TILES_PER_TILE
    for (let cy = 0; cy < 16; cy += 1) {
      for (let cx = 0; cx < 16; cx += 1) {
        const isInsideRoom = cx >= 2 && cx <= 5 && cy >= 2 && cy <= 5
        const cPt = cellCentre(scene, cx, cy)

        if (isInsideRoom) {
          // Inside room: floors exist, should be walkable
          expect(isBlockedAt(scene, cPt.x, cPt.y)).toBe(false)
        } else {
          // Outside room: must be completely blocked
          expect(isBlockedAt(scene, cPt.x, cPt.y)).toBe(true)

          // Check every sub-tile of the void cell
          for (let sy = 0; sy < SUB_TILES_PER_TILE; sy += 1) {
            for (let sx = 0; sx < SUB_TILES_PER_TILE; sx += 1) {
              const gx = cx * SUB_TILES_PER_TILE + sx
              const gy = cy * SUB_TILES_PER_TILE + sy
              const idx = gy * gridWidth + gx
              expect(scene.blocked[idx]).toBe(1)
              expect(scene.collisionMasks![idx]! & COLLIDE_MASK_INVALID).toBe(COLLIDE_MASK_INVALID)
              expect(scene.collisionMasks![idx]! & COLLIDE_BLANK).toBe(COLLIDE_BLANK)
              expect(scene.collisionMasks![idx]! & COLLIDE_WALL).toBe(COLLIDE_WALL)
            }
          }
        }
      }
    }

    // Verify 2: Canvas center at (8, 8) is in the void and must be blocked
    const centerPt = cellCentre(scene, 8, 8)
    expect(isBlockedAt(scene, centerPt.x, centerPt.y)).toBe(true)

    // Verify 3: findIsoSpawn must find a spawn inside the 4x4 room, never in the void
    const spawnFromMap = findIsoSpawnFromMap(scene)
    expect(spawnFromMap).not.toBeNull()
    expect(isBlockedAt(scene, spawnFromMap!.x, spawnFromMap!.y)).toBe(false)

    const cellOfSpawnMap = cellAt(scene, spawnFromMap!.x, spawnFromMap!.y)
    const floorCellXMap = Math.floor(cellOfSpawnMap.x)
    const floorCellYMap = Math.floor(cellOfSpawnMap.y)
    expect(floorCellXMap).toBeGreaterThanOrEqual(2)
    expect(floorCellXMap).toBeLessThanOrEqual(5)
    expect(floorCellYMap).toBeGreaterThanOrEqual(2)
    expect(floorCellYMap).toBeLessThanOrEqual(5)

    // Verify 4: Re-exported findIsoSpawn from level-links.ts produces identical result
    const spawnFromLinks = findIsoSpawnFromLinks(scene)
    expect(spawnFromLinks).toEqual(spawnFromMap)
  })

  it('prioritizes valid entrance warps inside rooms and rejects void warps', () => {
    const cells: (Ds1Cell | undefined)[][] = []
    for (let y = 0; y < 16; y += 1) {
      const row: (Ds1Cell | undefined)[] = []
      for (let x = 0; x < 16; x += 1) {
        if (x >= 10 && x <= 13 && y >= 10 && y <= 13) {
          row.push({
            floors: [{ prop1: 1, sequence: 0, style: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [],
            shadows: [],
            substitutions: [],
          })
        } else {
          row.push(undefined)
        }
      }
      cells.push(row)
    }

    const ds1: Ds1 = {
      version: 18,
      width: 16,
      height: 16,
      act: 1,
      substitutionType: 0,
      wallLayers: 1,
      floorLayers: 1,
      objects: [],
      npcPathOffset: null,
      cells: cells as unknown as Ds1['cells'],
    }

    const scene = buildIsoMapScene(ds1, [dt1], 0)

    // 1. Warp located in the void at cell (0, 0) -> arriveX: 2, arriveY: 2 (in void)
    const voidWarp = {
      toLevelId: 2,
      warpId: 1,
      direction: 'in' as const,
      label: 'Void Warp',
      x: 0,
      y: 0,
      arriveX: 2,
      arriveY: 2,
      selectX: 0,
      selectY: 0,
      selectDX: 0,
      selectDY: 0,
      exitWalkX: 0,
      exitWalkY: 0,
      source: 'tile' as const,
    }

    // Spawn should reject the void warp and spawn in the 4x4 room (10..13, 10..13)
    const spawnWithVoidWarp = findIsoSpawnFromMap(scene, { warps: [voidWarp] })
    expect(spawnWithVoidWarp).not.toBeNull()
    const cellWithVoidWarp = cellAt(scene, spawnWithVoidWarp!.x, spawnWithVoidWarp!.y)
    expect(Math.floor(cellWithVoidWarp.x)).toBeGreaterThanOrEqual(10)
    expect(Math.floor(cellWithVoidWarp.y)).toBeGreaterThanOrEqual(10)

    // 2. Warp located inside the room at cell (11, 11) -> sub-tile (56, 56)
    const roomWarp = {
      toLevelId: 3,
      warpId: 2,
      direction: 'in' as const,
      label: 'Room Entrance',
      x: 55,
      y: 55,
      arriveX: 56,
      arriveY: 56,
      selectX: 0,
      selectY: 0,
      selectDX: 0,
      selectDY: 0,
      exitWalkX: 0,
      exitWalkY: 0,
      source: 'tile' as const,
    }

    const spawnWithRoomWarp = findIsoSpawnFromMap(scene, { warps: [roomWarp] })
    expect(spawnWithRoomWarp).not.toBeNull()
    const cellWithRoomWarp = cellAt(scene, spawnWithRoomWarp!.x, spawnWithRoomWarp!.y)
    expect(Math.floor(cellWithRoomWarp.x)).toBe(11)
    expect(Math.floor(cellWithRoomWarp.y)).toBe(11)
    expect(isBlockedAt(scene, spawnWithRoomWarp!.x, spawnWithRoomWarp!.y)).toBe(false)
  })

  it('selects spawn within the largest walkable region containing floors when multiple pockets exist', () => {
    const cells: (Ds1Cell | undefined)[][] = []
    for (let y = 0; y < 16; y += 1) {
      const row: (Ds1Cell | undefined)[] = []
      for (let x = 0; x < 16; x += 1) {
        // Tiny 1x1 pocket at (0, 0)
        if (x === 0 && y === 0) {
          row.push({
            floors: [{ prop1: 1, sequence: 0, style: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [],
            shadows: [],
            substitutions: [],
          })
        }
        // Main 4x4 room at (4..7, 4..7)
        else if (x >= 4 && x <= 7 && y >= 4 && y <= 7) {
          row.push({
            floors: [{ prop1: 1, sequence: 0, style: 1, hidden: false, unknown1: 0, unknown2: 0 }],
            walls: [],
            shadows: [],
            substitutions: [],
          })
        } else {
          row.push(undefined)
        }
      }
      cells.push(row)
    }

    const ds1: Ds1 = {
      version: 18,
      width: 16,
      height: 16,
      act: 1,
      substitutionType: 0,
      wallLayers: 1,
      floorLayers: 1,
      objects: [],
      npcPathOffset: null,
      cells: cells as unknown as Ds1['cells'],
    }

    const scene = buildIsoMapScene(ds1, [dt1], 0)
    const spawn = findIsoSpawnFromMap(scene)
    expect(spawn).not.toBeNull()

    // Must spawn in the 4x4 room (4..7, 4..7), not the 1x1 pocket at (0, 0)
    const spawnCell = cellAt(scene, spawn!.x, spawn!.y)
    expect(Math.floor(spawnCell.x)).toBeGreaterThanOrEqual(4)
    expect(Math.floor(spawnCell.x)).toBeLessThanOrEqual(7)
    expect(Math.floor(spawnCell.y)).toBeGreaterThanOrEqual(4)
    expect(Math.floor(spawnCell.y)).toBeLessThanOrEqual(7)
  })

  it('returns null when the entire level has no walkable floors', () => {
    const ds1: Ds1 = {
      version: 18,
      width: 4,
      height: 4,
      act: 1,
      substitutionType: 0,
      wallLayers: 1,
      floorLayers: 1,
      objects: [],
      npcPathOffset: null,
      cells: Array.from({ length: 4 }, () =>
        Array.from({ length: 4 }, () => ({
          floors: [],
          walls: [],
          shadows: [],
          substitutions: [],
        }))
      ),
    }

    const scene = buildIsoMapScene(ds1, [dt1], 0)
    const spawn = findIsoSpawnFromMap(scene)
    expect(spawn).toBeNull()
  })
})
