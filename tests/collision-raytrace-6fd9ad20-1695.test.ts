import { describe, expect, it } from 'vitest'
import {
  COLLIDE_MASK_LOS,
  COLLIDE_MASK_MISSILE,
  COLLIDE_MISSILE_BARRIER,
  COLLIDE_VISIBLE,
  COLLIDE_WALL,
  collisionRayTrace,
  collisionSetMask,
} from '../src/common/world/d2map.ts'
import type { CollisionGrid } from '../src/common/world/d2map.ts'

function grid(cellsX: number, cellsY: number): CollisionGrid & { collisionMasks: Uint16Array } {
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

const SOLID = COLLIDE_WALL | COLLIDE_VISIBLE | COLLIDE_MISSILE_BARRIER

/** Cells visited by the 1.13c single-major-axis Bresenham (acc starts at 0, minor step when acc >= major). */
function visitedCells(x0: number, y0: number, x1: number, y1: number): string[] {
  const g = grid(8, 8)
  const out: string[] = []
  // Probe each candidate cell individually: a cell is visited iff blocking it alone yields a hit there.
  for (let y = 0; y < 40; y += 1) {
    for (let x = 0; x < 40; x += 1) {
      g.collisionMasks.fill(0)
      collisionSetMask(g, x, y, SOLID)
      const r = collisionRayTrace(g, x0, y0, x1, y1, COLLIDE_MASK_MISSILE)
      if (r.hit && r.hitSubX === x && r.hitSubY === y) out.push(`${String(x)},${String(y)}`)
    }
  }
  return out.sort()
}

describe('#1695 COLLISION_RayTrace exact port (D2Common 1.13c 0x6FD9AD20)', () => {
  it('tests the begin sub-tile first: a shooter on a blocking sub-tile reports a hit at the begin cell', () => {
    const g = grid(4, 4)
    collisionSetMask(g, 5, 5, SOLID)
    const r = collisionRayTrace(g, 5, 5, 12, 5, COLLIDE_MASK_MISSILE)
    expect(r.hit).toBe(true)
    expect([r.hitSubX, r.hitSubY]).toEqual([5, 5])
    expect(r.steps).toBe(0)
  })

  it('X-major: 0-start accumulator, minor step only when acc >= major delta (no midpoint rounding)', () => {
    // (10,10)->(15,12): dx=5, dy=2 -> acc 2,4,6(step),3,5(step)
    expect(visitedCells(10, 10, 15, 12)).toEqual(
      ['10,10', '11,10', '12,10', '13,11', '14,11', '15,12'].sort(),
    )
  })

  it('Y-major mirrors the X-major loop and walks negative directions', () => {
    // (20,20)->(18,14): dx=2 (sx=-1), dy=6 (sy=-1) -> acc 2,4,6(step),2,4,6(step)
    expect(visitedCells(20, 20, 18, 14)).toEqual(
      ['20,20', '20,19', '20,18', '19,17', '19,16', '19,15', '18,14'].sort(),
    )
  })

  it('pure diagonal steps both axes together (no corner/supercover cells) and includes the end cell', () => {
    expect(visitedCells(2, 2, 5, 5)).toEqual(['2,2', '3,3', '4,4', '5,5'])
  })

  it('a clear ray reports no hit and returns the end sub-tile', () => {
    const g = grid(4, 4)
    const r = collisionRayTrace(g, 1, 1, 17, 9, COLLIDE_MASK_LOS)
    expect(r.hit).toBe(false)
    expect([r.hitSubX, r.hitSubY]).toEqual([17, 9])
  })

  it('leaving the reachable rooms is a hit even with an empty mask (DUNGEON_GetRoomAtPosition == NULL)', () => {
    const g = grid(2, 2) // 10x10 sub-tiles
    const r = collisionRayTrace(g, 5, 5, 14, 5, 0)
    expect(r.hit).toBe(true)
    expect([r.hitSubX, r.hitSubY]).toEqual([10, 5])
  })
})
