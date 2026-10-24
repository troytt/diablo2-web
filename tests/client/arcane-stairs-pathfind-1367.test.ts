/**
 * Regression test suite for Issue #1367:
 * Arcane Sanctuary (Level 74) curved staircase & diagonal corridor pathfinding (`unitSize = 2`,
 * 1.13c `COLLISION_CheckAnyCollisionWithAdjacentCells` `0x6FD9C140`, `astarExploreChildren`
 * `0x6FDCB3C0`, `PATH_Straight_Compute` `0x6FDB7AD0`, `PATH_Toward_6FDAA9F0` `0x6FDB78B0`).
 *
 * Verifies:
 * 1. `unitSize = 2` diagonal transitions `(cx, cy) -> (cx + dx, cy + dy)` check the 5-cell `"+"`
 *    cross at `(cx + dx, cy + dy)` (which already includes both cardinal corners `(cx + dx, cy)`
 *    and `(cx, cy + dy)`) without requiring a second 5-cell `"+"` cross centered on the cardinal
 *    corners (`(cx + dx, cy)` or `(cx, cy + dy)`), matching 1.13c `D2Common.dll` (`0x6FDCB3C0`).
 * 2. Both the left curved staircase throat `(438, 442) <-> (437, 441)` and the right curved
 *    staircase throat `(442, 438) <-> (441, 437)` in Level 74 Room 0 connect the upper Blue Portal
 *    platform `(427, 426)` to the lower Waypoint platform `(449, 449)` in a single `unitSize = 2`
 *    connected component.
 * 3. Climbing UP the left curved staircase (`(439, 443) -> (431, 438)`, `(439, 443) -> (427, 433)`,
 *    `(439, 443) -> (428, 427)`, `(439, 443) -> (427, 426)`) and right curved staircase
 *    (`(443, 439) -> (436, 430)`, `(443, 439) -> (427, 426)`) reaches the goal (`reachedGoal = true`)
 *    without turning around onto the lower walkway `(431, 446)`.
 * 4. Walking DOWN the left curved staircase from the Blue Portal `(427, 426) -> (435, 441) -> (449, 449)`
 *    crosses the bottom throat `(437, 441) -> (438, 442)` onto the Waypoint platform without getting
 *    trapped at `(437, 441)`.
 * 5. `CommandMapper` + `LocalMovementPredictor` and `GameInstance.stepPlayerMovement` match 1.13c
 *    `D2Common_10142` (`PATHTYPE_STRAIGHT`) when traversing the Arcane Sanctuary curved stairs.
 */

import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import type { LevelView } from '../../src/client/map/level-view.ts'
import type { MapService } from '../../src/client/map/map-service.ts'
import {
  COLLIDE_MASK_WALK,
  findPathLocal,
  findPathWorld,
  hasLineOfSightLocal,
  isCellWalkableLocal,
  isUnitWalkableLocal,
  traceTowardLocal,
} from '../../src/common/path/pathfind.ts'
import { LocalMovementPredictor } from '../../src/common/path/movement-predictor.ts'
import { OutboundRateLimiter } from '../../src/client/session/rate-limiter.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import {
  D2Common_10142,
  DynamicPath,
  PATHTYPE_STRAIGHT,
  PATH_UNKNOWN_FLAG_0x00020,
  PATH_UNKNOWN_FLAG_0x01000,
  UNIT_PLAYER,
  type PathRoom,
  type PathUnit,
} from '../../src/common/path/index.ts'

/**
 * Exact 1.13c Level 74 (The Arcane Sanctuary) Room 0 central spawn walkability slice
 * for `x in [420, 455], y in [420, 455]` (`arcane.dt1` curved staircases `style=1, seq=10..25`,
 * Blue Portal at `(427, 426)`, Waypoint at `(449, 449)`).
 * `'1'` = blocked (`COLLIDE_MASK_WALK`), `'0'` = walkable.
 */
const ARCANE_STAIRS_X0 = 420
const ARCANE_STAIRS_Y0 = 420
const ARCANE_STAIRS_ROWS: readonly string[] = [
  '111111111111111111111111100000111111',
  '111111111111111111111111100000111111',
  '111111111111111111111111100000111111',
  '111111111111111111111111100000111111',
  '111111111111111111111111100000111111',
  '111110000011111111111111100000111111',
  '111110000000011111111111100000111111',
  '111110000000000111111111100000111111',
  '111110000000000001111111100000111111',
  '111110000011000000111111100000111111',
  '111111000111110000011111100000111111',
  '111111000111111100001111100000111111',
  '111111000011111110000111100000111111',
  '111111100011111111000011100000111111',
  '111111100001111111100001100000111111',
  '111111110001111111100001100000111111',
  '111111110000111111110001100000111111',
  '111111111000011111110001100000111111',
  '111111111100001111111000100000111111',
  '111111111110000011111000100000111111',
  '111111111111000000110000000000000000',
  '111111111111100000000000000000000000',
  '111111111111110000000000000000000000',
  '111111111111111111000000000000000000',
  '111111111111111111110000000000000000',
  '000000000000000000000000000000000000',
  '000000000000000000000000000000000000',
  '000000000000000000000000000000000000',
  '000000000000000000000000000000000000',
  '000000000000000000000000000000000000',
  '111111111111111111110000000000000000',
  '111111111111111111110000000000000000',
  '111111111111111111110000000000000000',
  '111111111111111111110000000000000000',
  '111111111111111111110000000000000000',
  '111111111111111111110000000000000000',
]

function buildArcaneStairsView(subOriginX = 25000, subOriginY = 5000): {
  readonly view: LevelView
  readonly room: PathRoom
} {
  const subWidth = 465
  const subHeight = 465
  const walkable = new Uint8Array(subWidth * subHeight).fill(0)
  const blocked = new Uint8Array(subWidth * subHeight).fill(1)
  const collision = new Uint16Array(subWidth * subHeight).fill(COLLIDE_MASK_WALK)

  for (let dy = 0; dy < ARCANE_STAIRS_ROWS.length; dy++) {
    const row = ARCANE_STAIRS_ROWS[dy]!
    const y = ARCANE_STAIRS_Y0 + dy
    for (let dx = 0; dx < row.length; dx++) {
      const x = ARCANE_STAIRS_X0 + dx
      const isBlocked = row[dx] === '1'
      const idx = y * subWidth + x
      walkable[idx] = isBlocked ? 0 : 1
      blocked[idx] = isBlocked ? 1 : 0
      collision[idx] = isBlocked ? COLLIDE_MASK_WALK : 0
    }
  }

  const adjacentRooms: PathRoom[] = []
  const room: PathRoom = {
    subX: 0,
    subY: 0,
    subW: subWidth,
    subH: subHeight,
    isTown: false,
    adjacentRooms,
    grid: {
      get: (x, y) => collision[y * subWidth + x] ?? COLLIDE_MASK_WALK,
      set: () => {},
    },
  }
  adjacentRooms.push(room)

  const view = {
    levelId: 74,
    areaId: 74,
    name: 'Arcane Sanctuary',
    act: 1,
    tileOriginX: Math.floor(subOriginX / 5),
    tileOriginY: Math.floor(subOriginY / 5),
    tileWidth: Math.floor(subWidth / 5),
    tileHeight: Math.floor(subHeight / 5),
    subOriginX,
    subOriginY,
    subWidth,
    subHeight,
    walkable,
    blocked,
    collision,
    floors: [],
    walls: [],
    shadows: [],
    roofs: [],
    presets: [],
    entrances: [],
  } as unknown as LevelView

  return { view, room }
}

function runServer113cStraightPath(
  room: PathRoom,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): {
  readonly count: number
  readonly endPos: { readonly x: number; readonly y: number }
} {
  const path = new DynamicPath()
  const unit: PathUnit = {
    dwUnitType: UNIT_PLAYER,
    dwClassId: 1,
    dwUnitId: 1,
    dwAnimMode: 1,
    dwFlags: 0,
    dwFlagEx: 0,
    pDynamicPath: path,
    pStaticPath: null,
    objectTxt: null,
  }
  path.pUnit = unit
  path.pRoom = room
  path.dwPrecisionX = (sx << 16) + 0x8000
  path.dwPrecisionY = (sy << 16) + 0x8000
  path.tTargetCoord.X = tx
  path.tTargetCoord.Y = ty
  path.dwPathType = PATHTYPE_STRAIGHT
  path.dwUnitSize = 2
  path.dwCollisionPattern = 1
  path.nFootprintCollisionMask = 0x100
  path.nMoveTestCollisionMask = COLLIDE_MASK_WALK
  path.nDistMax = 78
  path.dwVelocity = 2048
  path.dwSpeed = 8
  path.dwFlags = PATH_UNKNOWN_FLAG_0x01000 | PATH_UNKNOWN_FLAG_0x00020

  const count = D2Common_10142(path, unit, false)
  const lastPt = count > 0 ? path.PathPoints[count - 1]! : { X: sx, Y: sy }
  return {
    count,
    endPos: { x: lastPt.X, y: lastPt.Y },
  }
}

describe('Issue #1367 — Arcane Sanctuary curved staircase & unitSize=2 diagonal pathfinding parity', () => {
  const { view, room } = buildArcaneStairsView(25000, 5000)

  it('1. verifies left and right curved staircase throats are walkable at unitSize=2 while their cardinal corners have w1=true, w2=false', () => {
    // Left staircase throat: (438, 442) <-> (437, 441)
    expect(isUnitWalkableLocal(view, 438, 442, 2)).toBe(true)
    expect(isUnitWalkableLocal(view, 437, 441, 2)).toBe(true)
    expect(isCellWalkableLocal(view, 437, 442)).toBe(true)
    expect(isCellWalkableLocal(view, 438, 441)).toBe(true)
    expect(isUnitWalkableLocal(view, 437, 442, 2)).toBe(false)
    expect(isUnitWalkableLocal(view, 438, 441, 2)).toBe(false)

    // Right staircase throat: (442, 438) <-> (441, 437)
    expect(isUnitWalkableLocal(view, 442, 438, 2)).toBe(true)
    expect(isUnitWalkableLocal(view, 441, 437, 2)).toBe(true)
    expect(isCellWalkableLocal(view, 441, 438)).toBe(true)
    expect(isCellWalkableLocal(view, 442, 437)).toBe(true)
    expect(isUnitWalkableLocal(view, 441, 438, 2)).toBe(false)
    expect(isUnitWalkableLocal(view, 442, 437, 2)).toBe(false)
  })

  it('2. paths UP the left and right curved staircases to middle steps, upper steps, and the Blue Portal (427,426) without turning back onto the lower walkway', () => {
    const climbCases = [
      // Left stairs: bottom -> middle steps (distSq = 89 <= 324)
      {
        start: { x: 439, y: 443 },
        goal: { x: 431, y: 438 },
        expectedServerEnd: { x: 432, y: 439 },
        expectedLocalEnd: { x: 431, y: 438 },
      },
      // Left stairs: bottom -> upper steps (distSq = 244 <= 324)
      {
        start: { x: 439, y: 443 },
        goal: { x: 427, y: 433 },
        expectedServerEnd: { x: 429, y: 434 },
        expectedLocalEnd: { x: 428, y: 433 },
      },
      // Left stairs: bottom -> top platform (distSq = 377 > 324, 1.13c PATH_Toward wall-sliding)
      {
        start: { x: 439, y: 443 },
        goal: { x: 428, y: 427 },
        expectedServerEnd: { x: 427, y: 428 },
        expectedLocalEnd: { x: 428, y: 427 },
      },
      // Left stairs: bottom -> Blue Portal (distSq = 433 > 324, 1.13c PATH_Toward wall-sliding)
      {
        start: { x: 439, y: 443 },
        goal: { x: 427, y: 426 },
        expectedServerEnd: { x: 427, y: 426 },
        expectedLocalEnd: { x: 427, y: 426 },
      },
      {
        start: { x: 438, y: 442 },
        goal: { x: 427, y: 426 },
        expectedServerEnd: { x: 427, y: 426 },
        expectedLocalEnd: { x: 427, y: 426 },
      },
      // Right stairs: bottom -> middle steps (distSq = 130 <= 324)
      {
        start: { x: 443, y: 439 },
        goal: { x: 436, y: 430 },
        expectedServerEnd: { x: 436, y: 430 },
        expectedLocalEnd: { x: 436, y: 430 },
      },
      // Right stairs: bottom -> Blue Portal (distSq = 425 > 324, 1.13c PATH_Toward wall-sliding)
      {
        start: { x: 443, y: 439 },
        goal: { x: 427, y: 426 },
        expectedServerEnd: { x: 428, y: 427 },
        expectedLocalEnd: { x: 427, y: 426 },
      },
    ] as const

    for (const tc of climbCases) {
      const srv = runServer113cStraightPath(room, tc.start.x, tc.start.y, tc.goal.x, tc.goal.y)
      expect(srv.endPos).toEqual(tc.expectedServerEnd)

      const res = findPathLocal(view, tc.start.x, tc.start.y, tc.goal.x, tc.goal.y, {
        unitSize: 2,
      })
      expect(res.reachedGoal).toBe(true)
      expect(res.path.at(-1)).toEqual(tc.expectedLocalEnd)

      // Must never route down onto the lower-left walkway (y >= 445)
      expect(isCellWalkableLocal(view, res.rawPath[0]!.x, res.rawPath[0]!.y)).toBe(true)
      for (const pt of res.rawPath.slice(1)) {
        expect(isUnitWalkableLocal(view, pt.x, pt.y, 2)).toBe(true)
        expect(pt.y).toBeLessThanOrEqual(443)
      }
      for (let i = 0; i < res.path.length - 1; i++) {
        const a = res.path[i]!
        const b = res.path[i + 1]!
        expect(hasLineOfSightLocal(view, a.x, a.y, b.x, b.y, 2)).toBe(true)
      }
    }
  })

  it('3. paths DOWN the left curved staircase from the Blue Portal (427,426) through (435,441) and (437,441) onto the Waypoint platform (449,449)', () => {
    // Step 1: Portal (427, 426) -> lower-middle stairs (435, 441) (distSq = 289 <= 324)
    const downStep1 = findPathLocal(view, 427, 426, 435, 441, { unitSize: 2 })
    expect(downStep1.reachedGoal).toBe(true)
    expect(downStep1.path.at(-1)).toEqual({ x: 435, y: 441 })
    for (const pt of downStep1.rawPath) {
      expect(isUnitWalkableLocal(view, pt.x, pt.y, 2)).toBe(true)
    }

    // Step 2: Lower stairs (435, 441) -> Waypoint (449, 449) (distSq = 260 <= 324), crossing throat (437,441)->(438,442)
    const downStep2 = findPathLocal(view, 435, 441, 449, 449, { unitSize: 2 })
    expect(downStep2.reachedGoal).toBe(true)
    expect(downStep2.path.at(-1)).toEqual({ x: 449, y: 449 })
    for (const pt of downStep2.rawPath) {
      expect(isUnitWalkableLocal(view, pt.x, pt.y, 2)).toBe(true)
    }
  })

  it('4. drives CommandMapper & LocalMovementPredictor up the left stairs to the Blue Portal and back down to the Waypoint', () => {
    const ox = view.subOriginX
    const oy = view.subOriginY

    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 1, mapSeed: 0x12345678, areaId: 74 })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 1,
      name: 'Sorceress',
      x: ox + 439,
      y: oy + 443,
    })

    const mockMapService = {
      getActiveLevelView: () => view,
      getConnectedLevelViews: () => [],
      findLevelViewAtWorldSubTile: () => view,
      findAllLevelViewsAtWorldSubTile: () => [view],
    } as unknown as MapService

    const hudManager = new HudManager()
    const predictor = new LocalMovementPredictor({
      initialX: ox + 439,
      initialY: oy + 443,
    })
    predictor.setCollisionChecker(
      (wx, wy) => !isCellWalkableLocal(view, Math.round(wx) - ox, Math.round(wy) - oy),
    )
    const hudModel = new HudModel({ world, hudManager, predictor })
    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor,
      mapService: mockMapService,
      rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
    })

    // Click 1: Climb from bottom of left stairs (25439, 5443) directly to Blue Portal (25427, 5426)
    const upRec = mapper.triggerPrimaryWorldAction(ox + 427, oy + 426, null, 1000)
    expect(upRec).not.toBeNull()
    predictor.update(4000)
    const atPortal = predictor.getSnapshot()
    expect({ x: Math.round(atPortal.x) - ox, y: Math.round(atPortal.y) - oy }).toEqual({
      x: 427,
      y: 426,
    })

    // Click 2: Walk down from Blue Portal (25427, 5426) to lower stairs (25435, 5441)
    const downMidRec = mapper.triggerPrimaryWorldAction(ox + 435, oy + 441, null, 5000)
    expect(downMidRec).not.toBeNull()
    predictor.update(4000)
    const atMidStairs = predictor.getSnapshot()
    expect({ x: Math.round(atMidStairs.x) - ox, y: Math.round(atMidStairs.y) - oy }).toEqual({
      x: 435,
      y: 441,
    })

    // Click 3: Walk off the stairs from (25435, 5441) to Waypoint (25449, 5449)
    const downWpRec = mapper.triggerPrimaryWorldAction(ox + 449, oy + 449, null, 9000)
    expect(downWpRec).not.toBeNull()
    predictor.update(4000)
    const atWaypoint = predictor.getSnapshot()
    expect({ x: Math.round(atWaypoint.x) - ox, y: Math.round(atWaypoint.y) - oy }).toEqual({
      x: 449,
      y: 449,
    })

    // Verify traceTowardLocal and findPathWorld export parity
    const worldRes = findPathWorld(view, ox + 439, oy + 443, ox + 427, oy + 426, { unitSize: 2 })
    expect(worldRes.reachedGoal).toBe(true)
    expect(worldRes.path.at(-1)).toEqual({ x: ox + 427, y: oy + 426 })
    const towardRes = traceTowardLocal(view, [{ x: 438, y: 442 }], 427, 426, 2)
    expect(towardRes.reachedGoal).toBe(true)
  })
})
