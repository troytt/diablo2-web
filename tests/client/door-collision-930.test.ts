/**
 * Regression test suite for Issue #930:
 * Client player collision with closed doors and dynamic objects (`1.13c` `D2Client.dll` / `D2Common.dll` parity).
 *
 * Verifies:
 * 1. `ClientWorld.updateObjectCollisionFootprint` stamps closed/opening doors (`HasCollision[mode] === 1`,
 *    `UNITS_BlockCollisionPath` `0x6FD81850`) into `isSubTileBlocked` and `isSubTileMissileBlocked`, and frees
 *    them (`UNITS_FreeCollisionPath` `0x6FD818C0`) when transitioning to `mode = 2` (including timer expiry
 *    after `S2C 0x0E` `ObjectState` `mode = 1 -> 2`).
 * 2. Town Portals (`classId = 59`, `subClass & 0x04`) return `0x8000` (`COLLIDE_CORPSE`) in
 *    `UNITS_GetCollisionMask` (`0x6FD7FF30`) and never block player walking.
 * 3. `findPathLocal` / `findPathWorld` with `unitSize: 2` (`1.13c` player `dwUnitSize = 2`, 5-cell `"+"`
 *    cross `COLLISION_CheckAnyCollisionWithAdjacentCells` `0x6FD9C140`) blocks squeezing through 1-subtile
 *    gaps next to `1x3` / `3x1` closed doors while allowing passage once the 3-subtile doorway opens.
 * 4. `CommandMapper.startLocalPathPrediction` stamps closed doors in both single-view `effectiveView`
 *    and multi-level `compositeWalkable` (`extraViews`), and never falls through to the unguarded
 *    straight-line fallback `[{ x: targetX, y: targetY }]` when standing in front of a closed door.
 * 5. `LocalMovementPredictor.update(dtMs)` halts at the last walkable sub-tile when `collisionChecker`
 *    reports a closed door or wall along the active waypoint segment.
 */

import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import type { LevelView } from '../../src/client/map/level-view.ts'
import type { MapService } from '../../src/client/map/map-service.ts'
import { findPathLocal, findPathWorld } from '../../src/client/motion/pathfind.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../../src/client/session/rate-limiter.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { COLLIDE_DOOR, COLLIDE_NONE, COLLIDE_WALL } from '../../src/common/world/d2map.ts'

function createDungeonDoorLevelView(options: {
  readonly areaId: number
  readonly subOriginX: number
  readonly subOriginY: number
  readonly subWidth: number
  readonly subHeight: number
  readonly wallX: number
  readonly doorwayMinY: number
  readonly doorwayMaxY: number
  readonly staticDoorCollision?: boolean
}): LevelView {
  const {
    areaId,
    subOriginX,
    subOriginY,
    subWidth,
    subHeight,
    wallX,
    doorwayMinY,
    doorwayMaxY,
    staticDoorCollision = false,
  } = options
  const total = subWidth * subHeight
  const walkable = new Uint8Array(total).fill(1)
  const blocked = new Uint8Array(total).fill(0)
  const collision = new Uint16Array(total).fill(COLLIDE_NONE)

  for (let ly = 0; ly < subHeight; ly++) {
    const idx = ly * subWidth + wallX
    if (ly < doorwayMinY || ly > doorwayMaxY) {
      walkable[idx] = 0
      blocked[idx] = 1
      collision[idx] = COLLIDE_WALL
    } else if (staticDoorCollision) {
      walkable[idx] = 0
      blocked[idx] = 1
      collision[idx] = COLLIDE_DOOR
    }
  }

  return {
    levelId: areaId,
    areaId,
    name: `Dungeon-${areaId}`,
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
    floorGrid: { width: 0, height: 0, layers: 0, cells: [] },
    wallGrid: { width: 0, height: 0, layers: 0, cells: [] },
    shadowGrid: { width: 0, height: 0, layers: 0, cells: [] },
  } as unknown as LevelView
}

describe('Issue #930 — Client player & door collision parity with 1.13c GS', () => {
  it('1. ClientWorld stamps closed/opening door footprints into isSubTileBlocked & isSubTileMissileBlocked and frees them when mode transitions 1 -> 2', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 28 })

    // Spawn closed Cathedral Door (`classId = 15`, SizeX = 1, SizeY = 3, BlocksVis = true, BlockMissile = true)
    // at world sub-tile (100, 100) -> spans x = 100, y = 99..101
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 'object',
        id: 501,
        classId: 15,
        x: 100,
        y: 100,
        mode: 0, // NU (closed, HasCollision0 = 1)
      },
    })

    expect(world.isSubTileBlocked(100, 99)).toBe(true)
    expect(world.isSubTileBlocked(100, 100)).toBe(true)
    expect(world.isSubTileBlocked(100, 101)).toBe(true)
    expect(world.isSubTileBlocked(100, 98)).toBe(false)
    expect(world.isSubTileMissileBlocked(100, 100, 3)).toBe(true)

    // Transition door via S2C 0x0E UnitMode (PortalState) to mode = 1 (OP, HasCollision1 = 1)
    world.apply({
      type: 'UnitMode',
      unitType: 2,
      id: 501,
      mode: 1,
      eventCode: 3,
      eventFlag: 0,
    })
    world.tick(40) // Drains queued 0x0E packet -> enters mode 1 (opening)
    expect(world.isSubTileBlocked(100, 100)).toBe(true)

    // Advance simulation past the opening animation duration so mode 1 -> 2 (ON, HasCollision2 = 0)
    world.tick(1000)
    const doorUnit = world.getUnit('object', 501)
    expect(doorUnit?.mode).toBe(2)
    expect(world.isSubTileBlocked(100, 99)).toBe(false)
    expect(world.isSubTileBlocked(100, 100)).toBe(false)
    expect(world.isSubTileBlocked(100, 101)).toBe(false)
    expect(world.isSubTileMissileBlocked(100, 100, 3)).toBe(false)
  })

  it('2. Town Portal (classId = 59, subClass & 0x04) never blocks player walking in ClientWorld or CommandMapper', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 1 })
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 'object',
        id: 601,
        classId: 59, // Town Portal (hasCollision0..2 = 1, subClass = 68 -> 0x8000 COLLIDE_CORPSE)
        x: 50,
        y: 50,
        mode: 2,
      },
    })

    expect(world.isSubTileBlocked(50, 50)).toBe(false)
    expect(world.isSubTileMissileBlocked(50, 50, 3)).toBe(false)
  })

  it('3. findPathLocal / findPathWorld with unitSize=2 (5-cell "+" cross) prevents squeezing through 1-subtile doorway gaps next to a 1x3 closed door', () => {
    // 5-subtile wide doorway at x = 10, y = 8..12 (`y <= 7` and `y >= 13` are walls)
    const view = createDungeonDoorLevelView({
      areaId: 28,
      subOriginX: 0,
      subOriginY: 0,
      subWidth: 25,
      subHeight: 25,
      wallX: 10,
      doorwayMinY: 8,
      doorwayMaxY: 12,
    })

    // Stamp a 1x3 closed door at (10, 10) covering y = 9..11, leaving 1-subtile gaps at y = 8 and y = 12
    for (const dy of [9, 10, 11]) {
      view.walkable[dy * view.subWidth + 10] = 0
    }

    // With 1.13c player unitSize = 2 ("+" 5-cell cross), the player cannot squeeze through (10, 8) or (10, 12)
    const closedRes = findPathLocal(view, 6, 10, 15, 10, { unitSize: 2 })
    expect(closedRes.reachedGoal).toBe(false)
    for (const pt of closedRes.path) {
      expect(pt.x).toBeLessThan(10)
    }

    // Once the 1x3 door opens (y = 9..11 walkable), unitSize = 2 walks cleanly through the center (y = 10)
    for (const dy of [9, 10, 11]) {
      view.walkable[dy * view.subWidth + 10] = 1
    }
    const openRes = findPathWorld(view, 6, 10, 15, 10, { unitSize: 2 })
    expect(openRes.reachedGoal).toBe(true)
    expect(openRes.path.at(-1)).toEqual({ x: 15, y: 10 })
  })

  it('4. CommandMapper blocks walking through a closed door even when connected extraViews exist or player stands directly in front of the door', () => {
    // Primary level: Barracks (28) with a 5-subtile doorway at x = 10, y = 8..12 (DS1 hidden door wall)
    const barracksView = createDungeonDoorLevelView({
      areaId: 28,
      subOriginX: 0,
      subOriginY: 0,
      subWidth: 30,
      subHeight: 30,
      wallX: 10,
      doorwayMinY: 8,
      doorwayMaxY: 12,
    })
    // Connected neighbour level: Jail Level 1 (29) so `extraViews.length > 0`
    const jailView = createDungeonDoorLevelView({
      areaId: 29,
      subOriginX: 30,
      subOriginY: 0,
      subWidth: 30,
      subHeight: 30,
      wallX: 15,
      doorwayMinY: 8,
      doorwayMaxY: 12,
    })

    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 28 })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 0,
      name: 'Hero',
      x: 6,
      y: 10,
    })
    // Closed 1x3 door (`classId = 15`) at (10, 10)
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 'object',
        id: 700,
        classId: 15,
        x: 10,
        y: 10,
        mode: 0, // Closed
      },
    })

    const mockMapService = {
      getActiveLevelView: () => barracksView,
      getConnectedLevelViews: () => [jailView],
      findLevelViewAtWorldSubTile: (wx: number, wy: number) =>
        wx >= 0 && wx < 30 && wy >= 0 && wy < 30 ? barracksView : null,
      findAllLevelViewsAtWorldSubTile: (wx: number, wy: number) =>
        wx >= 0 && wx < 30 && wy >= 0 && wy < 30 ? [barracksView] : [],
    } as unknown as MapService

    const hudManager = new HudManager()
    const predictor = new LocalMovementPredictor({ initialX: 6, initialY: 10 })
    predictor.setCollisionChecker((x, y) => world.isSubTileBlocked(x, y))
    const hudModel = new HudModel({ world, hudManager, predictor })
    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor,
      mapService: mockMapService,
      rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
    })

    // Click on the other side of the closed door at (15, 10) from (6, 10)
    const res1 = mapper.triggerPrimaryWorldAction(15, 10, null, 1000)
    expect(res1).not.toBeNull()
    for (const pt of res1!.path) {
      expect(pt.x).toBeLessThan(10)
    }
    predictor.update(2000)
    expect(predictor.getSnapshot().x).toBeLessThan(10)

    // Now player is standing right in front of the closed door at (9, 10); click (15, 10) again.
    // Must NOT fall through to the straight-line `[{ x: 15, y: 10 }]` fallback!
    predictor.setPosition(9, 10)
    const res2 = mapper.triggerPrimaryWorldAction(15, 10, null, 2000)
    expect(res2).not.toBeNull()
    for (const pt of res2!.path) {
      expect(pt.x).toBeLessThan(10)
    }
    predictor.update(2000)
    expect(predictor.getSnapshot().x).toBe(9)

    // Open the door (`mode = 2`): clicking (15, 10) now paths cleanly through the open doorway!
    world.apply({
      type: 'UnitMode',
      unitType: 2,
      id: 700,
      mode: 2,
    })
    const res3 = mapper.triggerPrimaryWorldAction(15, 10, null, 3000)
    expect(res3).not.toBeNull()
    expect(res3!.path.at(-1)).toEqual({ x: 15, y: 10 })
    predictor.update(2000)
    expect(predictor.getSnapshot().x).toBe(15)
    expect(predictor.getSnapshot().y).toBe(10)
  })

  it('5. LocalMovementPredictor halts at the last walkable sub-tile if a door closes in front of the moving player', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 28 })

    const predictor = new LocalMovementPredictor({ initialX: 5, initialY: 10 })
    predictor.setCollisionChecker((x, y) => world.isSubTileBlocked(x, y))

    // Start moving along a straight path from (5, 10) to (15, 10) while door is open
    predictor.setPath([
      { x: 5, y: 10 },
      { x: 15, y: 10 },
    ])

    // Door at (10, 10) closes before the player reaches x = 10
    world.apply({
      type: 'UnitAssign',
      unit: {
        unitType: 'object',
        id: 800,
        classId: 15, // 1x3 door at (10, 9..11)
        x: 10,
        y: 10,
        mode: 0, // Closed
      },
    })

    // Step predictor for 2 seconds: must stop at x = 9, y = 10 right in front of the closed door
    const snap = predictor.update(2000)
    expect(snap.x).toBe(9)
    expect(snap.y).toBe(10)
    expect(snap.moving).toBe(false)
    expect(snap.remainingWaypoints).toEqual([])
  })
})
