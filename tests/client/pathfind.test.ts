/**
 * Authentic PATHTYPE_STRAIGHT Local Pathfinding Tests (Issue #588).
 *
 * Verifies Diablo II v1.13c ground truth (D2Common/src/Path/PathMisc.cpp:583-620):
 * - Target coordinate delta > 100 sub-tiles is rejected
 * - Straight line of sight raycast proceeds directly to target when unobstructed
 * - When blocked AND Euclidean distance squared <= 18^2 (324), invokes local A* around obstacle
 * - When blocked AND distance squared > 324, does not run A*, stops directly at the obstacle
 * - Diagonal wall corner pinching is strictly prevented
 * - Maximum path length is capped at MAXPATHLEN (78)
 */

import { describe, expect, it } from 'vitest'
import {
  findPathLocal,
  hasLineOfSightLocal,
  MAX_ASTAR_OBSTACLE_DISTANCE_SQ,
  MAX_STRAIGHT_DISTANCE_DELTA,
  MAXPATHLEN,
  type SubTileWalkabilityGrid,
} from '../../src/client/motion/pathfind.ts'

function createGrid(
  width: number,
  height: number,
  isBlocked: (x: number, y: number) => boolean = () => false,
): SubTileWalkabilityGrid {
  const walkable = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      walkable[y * width + x] = isBlocked(x, y) ? 0 : 1
    }
  }
  return { subWidth: width, subHeight: height, walkable }
}

describe('PATHTYPE_STRAIGHT Pathfinding (Issue #588)', () => {
  it('exports authentic 1.13c constants', () => {
    expect(MAXPATHLEN).toBe(78)
    expect(MAX_STRAIGHT_DISTANCE_DELTA).toBe(100)
    expect(MAX_ASTAR_OBSTACLE_DISTANCE_SQ).toBe(324)
  })

  it('rejects target coordinate delta > 100 sub-tiles', () => {
    const grid = createGrid(200, 200)

    // Delta X > 100 (from 10 to 111 = delta 101)
    const resX = findPathLocal(grid, 10, 10, 111, 10)
    expect(resX.path).toEqual([])
    expect(resX.reachedGoal).toBe(false)

    // Delta Y > 100 (from 10 to 111 = delta 101)
    const resY = findPathLocal(grid, 10, 10, 10, 111)
    expect(resY.path).toEqual([])
    expect(resY.reachedGoal).toBe(false)

    // Delta = 100 is allowed
    const resValid = findPathLocal(grid, 10, 10, 110, 10)
    expect(resValid.reachedGoal).toBe(true)
    expect(resValid.path.length).toBeGreaterThan(0)
  })

  it('proceeds along straight line of sight when unobstructed', () => {
    const grid = createGrid(50, 50)
    const res = findPathLocal(grid, 5, 5, 20, 15, { smooth: true })

    expect(res.reachedGoal).toBe(true)
    expect(res.path).toEqual([
      { x: 5, y: 5 },
      { x: 20, y: 15 },
    ])
    // Line of sight confirmed
    expect(hasLineOfSightLocal(grid, 5, 5, 20, 15)).toBe(true)
  })

  it('invokes local A* when blocked and distance squared <= 324 (18 subtiles)', () => {
    // 30x30 grid with a wall blocking the direct line at x=10
    // Start (5, 10), Goal (15, 10): dx = 10, dy = 0, distSq = 100 <= 324
    // Wall at x=10 from y=8 to y=12
    const grid = createGrid(30, 30, (x, y) => x === 10 && y >= 8 && y <= 12)

    // Direct ray is blocked by wall
    expect(hasLineOfSightLocal(grid, 5, 10, 15, 10)).toBe(false)

    const res = findPathLocal(grid, 5, 10, 15, 10)
    expect(res.reachedGoal).toBe(true)
    // A* successfully navigated around the obstacle
    expect(res.path.length).toBeGreaterThan(1)
    expect(res.path[0]).toEqual({ x: 5, y: 10 })
    expect(res.path[res.path.length - 1]).toEqual({ x: 15, y: 10 })

    // Verify none of the waypoints intersect the wall
    for (const pt of res.path) {
      expect(pt.x === 10 && pt.y >= 8 && pt.y <= 12).toBe(false)
    }
  })

  it('stops directly at obstacle without invoking A* when distance squared > 324', () => {
    // 50x50 grid with a wall blocking the line at x=20
    // Start (0, 10), Goal (30, 10): dx = 30, dy = 0, distSq = 900 > 324
    // Wall at x=20 from y=0 to y=20
    const grid = createGrid(50, 50, (x, y) => x === 20 && y >= 0 && y <= 20)

    const res = findPathLocal(grid, 0, 10, 30, 10)
    // 1.13c parity: does NOT reach goal, stops at the wall obstacle along straight ray
    expect(res.reachedGoal).toBe(false)
    expect(res.expandedNodes).toBe(1) // raycast only, A* not expanded
    expect(res.path.length).toBeGreaterThan(0)
    // The last point in the path is right in front of the wall (x=19)
    const lastPoint = res.path[res.path.length - 1]!
    expect(lastPoint.x).toBe(19)
    expect(lastPoint.y).toBe(10)
  })

  it('invokes local A* beyond 18 sub-tiles with the town detour budget (#1318)', () => {
    // Same >324 scenario as the vanilla stop test, but town interaction clicks
    // pass TOWN_ASTAR_OBSTACLE_DISTANCE_SQ (64^2) so the A* can round the wall.
    const grid = createGrid(50, 50, (x, y) => x === 20 && y >= 0 && y <= 20)

    const res = findPathLocal(grid, 0, 10, 30, 10, {
      maxAstarObstacleDistanceSq: 4096,
    })

    expect(res.reachedGoal).toBe(true)
    expect(res.expandedNodes).toBeGreaterThan(1)
    expect(res.path[res.path.length - 1]).toEqual({ x: 30, y: 10 })
    for (const pt of res.path) {
      expect(pt.x === 20 && pt.y >= 0 && pt.y <= 20).toBe(false)
    }
  })

  it('prevents diagonal corner cutting through pinch walls', () => {
    // Diagonal pinch: wall at (1, 0) and (0, 1)
    // Transition (0, 0) to (1, 1) should be blocked
    const grid = createGrid(5, 5, (x, y) => (x === 1 && y === 0) || (x === 0 && y === 1))

    expect(hasLineOfSightLocal(grid, 0, 0, 1, 1)).toBe(false)
    const res = findPathLocal(grid, 0, 0, 1, 1)
    // Because (1,0) and (0,1) are blocked, unit cannot cut corner to (1,1)
    expect(res.reachedGoal).toBe(false)
  })

  it('caps path length at MAXPATHLEN (78)', () => {
    const grid = createGrid(100, 100)
    // Un-smoothed long path along straight line of 90 cells
    const res = findPathLocal(grid, 5, 5, 95, 5, { smooth: false })
    expect(res.path.length).toBeLessThanOrEqual(MAXPATHLEN)
    expect(res.rawPath.length).toBeLessThanOrEqual(MAXPATHLEN)
  })
})
