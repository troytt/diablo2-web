/**
 * Regression test suite for local walk/run prediction parity:
 * 1.13c player walk/run parity with D2Game (`0x6FCEB690` `<= 50` sub-tile per-axis packet gate)
 * and D2Common (`D2Common_10142` `0x6FD86230` + `PATH_Straight_Compute` `0x6FDB7AD0`).
 */

import { describe, expect, it } from 'vitest'
import {
  MAX_WALK_PACKET_AXIS_DELTA_113C,
  walkAdjust113c,
} from '../../src/client/input/click-rules-113c.ts'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import type { LevelView } from '../../src/client/map/level-view.ts'
import type { MapService } from '../../src/client/map/map-service.ts'
import {
  COLLIDE_MASK_WALK,
  findPlayerPathD2Common113c,
} from '../../src/client/motion/pathfind.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../../src/client/session/rate-limiter.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import {
  buildAdjacentRoomLists,
  D2Common_10142,
  D2COMMON_10170_PathSetTargetPos,
  PATH_AllocDynamicPath,
  UNIT_PLAYER,
  type PathRoom,
  type PathUnit,
} from '../../src/common/path/index.ts'
import type { ClientCommand } from '../../src/netproto/index.ts'

function createSyntheticLevelView(options: {
  readonly areaId: number
  readonly subOriginX?: number
  readonly subOriginY?: number
  readonly subWidth: number
  readonly subHeight: number
  readonly rooms?: LevelView['rooms']
}): LevelView {
  const subOriginX = options.subOriginX ?? 0
  const subOriginY = options.subOriginY ?? 0
  const { subWidth, subHeight, areaId } = options
  const walkable = new Uint8Array(subWidth * subHeight).fill(1)
  const blocked = new Uint8Array(subWidth * subHeight).fill(0)
  const collision = new Uint16Array(subWidth * subHeight).fill(0)

  return {
    id: areaId,
    areaId,
    levelId: areaId,
    act: 0,
    seed: 0x64a7932c,
    difficulty: 0,
    originX: subOriginX,
    originY: subOriginY,
    subOriginX,
    subOriginY,
    width: subWidth,
    height: subHeight,
    subWidth,
    subHeight,
    tileOriginX: Math.floor(subOriginX / 5),
    tileOriginY: Math.floor(subOriginY / 5),
    tileWidth: Math.floor(subWidth / 5),
    tileHeight: Math.floor(subHeight / 5),
    cellsX: Math.floor(subWidth / 5),
    cellsY: Math.floor(subHeight / 5),
    gridWidth: subWidth,
    gridHeight: subHeight,
    isoOriginX: subHeight * 16,
    isoOriginY: 0,
    collision,
    collisionMasks: collision,
    blocked,
    walkable,
    floors: [],
    shadows: [],
    walls: [],
    roofs: [],
    entrances: [],
    warps: [],
    landmarks: [],
    rooms:
      options.rooms ??
      [
        {
          index: 0,
          areaId,
          tileX: Math.floor(subOriginX / 5),
          tileY: Math.floor(subOriginY / 5),
          tileW: Math.floor(subWidth / 5),
          tileH: Math.floor(subHeight / 5),
          localTileX: 0,
          localTileY: 0,
          subX: 0,
          subY: 0,
          subW: subWidth,
          subH: subHeight,
          worldSubX: subOriginX,
          worldSubY: subOriginY,
          revealed: true,
        },
      ],
    spawnX: subOriginX + 10,
    spawnY: subOriginY + 10,
    automap: {
      layerId: 1,
      cells: [],
    },
    presetUnits: [],
    walkableCellCount: subWidth * subHeight,
    hasBoundaryWalls: false,
  } as unknown as LevelView
}

describe('1.13c Walk/Run Server Parity (D2Game 0x6FCEB690 + D2Common_10142 PATHTYPE_STRAIGHT)', () => {
  it('1. enforces D2Game 0x6FCEB690 any-axis > 50 sub-tile walk/run rejection in walkAdjust113c and CommandMapper', () => {
    expect(MAX_WALK_PACKET_AXIS_DELTA_113C).toBe(50)

    // |dx| = 50, |dy| = 50 -> accepted (cmp eax, 0x32 ; jg only rejects > 50)
    const ok50 = walkAdjust113c({
      phase: 'down',
      run: true,
      playerX: 5000,
      playerY: 5000,
      clickX: 5050,
      clickY: 4950,
      selfIsPlayer: true,
      selfMode: 1,
      frame: 100,
      lastWalkFrame: 0,
    })
    expect(ok50).toEqual({
      accepted: true,
      x: 5050,
      y: 4950,
      lastWalkFrame: 100,
    })

    // |dx| = 51 or |dy| = 51 -> rejected without updating lastWalkFrame
    const rejectX51 = walkAdjust113c({
      phase: 'down',
      run: true,
      playerX: 5000,
      playerY: 5000,
      clickX: 5051,
      clickY: 5000,
      selfIsPlayer: true,
      selfMode: 1,
      frame: 105,
      lastWalkFrame: 100,
    })
    expect(rejectX51).toEqual({
      accepted: false,
      lastWalkFrame: 100,
    })

    const rejectY51 = walkAdjust113c({
      phase: 'down',
      run: false,
      playerX: 5000,
      playerY: 5000,
      clickX: 5000,
      clickY: 4949,
      selfIsPlayer: true,
      selfMode: 1,
      frame: 105,
      lastWalkFrame: 100,
    })
    expect(rejectY51).toEqual({
      accepted: false,
      lastWalkFrame: 100,
    })

    // CommandMapper integration: widescreen corner clicks (> 50 sub-tiles on either axis)
    // must neither send C2S 0x01/0x03 nor start local path prediction.
    const view = createSyntheticLevelView({
      areaId: 1,
      subOriginX: 4900,
      subOriginY: 4900,
      subWidth: 250,
      subHeight: 250,
    })
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x64a7932c, areaId: 1 })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 1,
      name: 'Hero',
      x: 5000,
      y: 5000,
    })
    const sent: ClientCommand[] = []
    const hudManager = new HudManager()
    const predictor = new LocalMovementPredictor({ initialX: 5000, initialY: 5000 })
    const hudModel = new HudModel({ world, hudManager, predictor, onCommand: c => sent.push(c) })
    const mockMapService = {
      getActiveLevelView: () => view,
      getConnectedLevelViews: () => [],
      findLevelViewAtWorldSubTile: () => view,
      findAllLevelViewsAtWorldSubTile: () => [view],
    } as unknown as MapService
    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor,
      mapService: mockMapService,
      rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
      sendCommand: c => sent.push(c),
    })

    // Widescreen click at (-54, +27) and (+27, +66) -> dropped
    expect(mapper.triggerPrimaryWorldAction(4946, 5027, null, 1000)).toBeNull()
    expect(mapper.triggerPrimaryWorldAction(5027, 5066, null, 1100)).toBeNull()
    expect(sent).toHaveLength(0)
    expect(predictor.getSnapshot().moving).toBe(false)

    // Click at (+50, 0) -> accepted and predicted
    const okRec = mapper.triggerPrimaryWorldAction(5050, 5000, null, 1200)
    expect(okRec).not.toBeNull()
    expect(sent).toHaveLength(1)
    expect(okRec!.path.at(-1)).toEqual({ x: 5050, y: 5000 })
  })

  it('2. enforces 1.13c DUNGEON_GetRoomAtPosition 3x3 adjacentRooms neighborhood in findPlayerPathD2Common113c', () => {
    // Room 0 covers [0..40, 0..40).
    // Room 1 covers [40..80, 0..40) (adjacent: tile gap 0 < 6).
    // Room 2 covers [115..155, 0..40) (non-adjacent to Room 0: tile gap = (23 - 8) = 15 >= 6).
    const view = createSyntheticLevelView({
      areaId: 2,
      subWidth: 160,
      subHeight: 40,
      rooms: [
        {
          index: 0,
          areaId: 2,
          tileX: 0,
          tileY: 0,
          tileW: 8,
          tileH: 8,
          localTileX: 0,
          localTileY: 0,
          subX: 0,
          subY: 0,
          subW: 40,
          subH: 40,
          worldSubX: 0,
          worldSubY: 0,
          revealed: true,
          room1InitSeed: 0,
        },
        {
          index: 1,
          areaId: 2,
          tileX: 8,
          tileY: 0,
          tileW: 8,
          tileH: 8,
          localTileX: 8,
          localTileY: 0,
          subX: 40,
          subY: 0,
          subW: 40,
          subH: 40,
          worldSubX: 40,
          worldSubY: 0,
          revealed: true,
          room1InitSeed: 0,
        },
        {
          index: 2,
          areaId: 2,
          tileX: 23,
          tileY: 0,
          tileW: 8,
          tileH: 8,
          localTileX: 23,
          localTileY: 0,
          subX: 115,
          subY: 0,
          subW: 40,
          subH: 40,
          worldSubX: 115,
          worldSubY: 0,
          revealed: true,
          room1InitSeed: 0,
        },
      ],
    })

    // Target in adjacent Room 1: succeeds
    const adjRes = findPlayerPathD2Common113c(view, 35, 20, 55, 20)
    expect(adjRes.reachedGoal).toBe(true)
    expect(adjRes.path.at(-1)).toEqual({ x: 55, y: 20 })

    // Target in non-adjacent Room 2 (or in the unmapped void at x=90 between Room 1 and Room 2):
    // DUNGEON_GetRoomAtPosition returns null -> 0 path points!
    const voidRes = findPlayerPathD2Common113c(view, 35, 20, 82, 20)
    expect(voidRes.path).toEqual([])
    expect(voidRes.reachedGoal).toBe(false)
  })

  it('3. matches D2Common_10142 PATHTYPE_STRAIGHT 18-subtile (distSq <= 324) A* threshold in Town (no 64^2 town A* detour) and sub_6FDABA50 <= 1 ray stop rule', () => {
    const view = createSyntheticLevelView({
      areaId: 1, // Rogue Encampment (Town)
      subWidth: 120,
      subHeight: 120,
    })

    // Horizontal wall at y = 55, x = 45..55 blocking straight south walks from (50, 50)
    for (let x = 45; x <= 55; x++) {
      const idx = 55 * view.subWidth + x
      view.walkable[idx] = 0
      view.blocked[idx] = 1
      view.collision[idx] = COLLIDE_MASK_WALK
    }

    // Build ground-truth D2Common PathRoom for direct comparison
    const room: PathRoom & { adjacentRooms: readonly PathRoom[] } = {
      subX: 0,
      subY: 0,
      subW: view.subWidth,
      subH: view.subHeight,
      isTown: true,
      adjacentRooms: [],
      grid: {
        get: (x, y) => view.collision[y * view.subWidth + x] ?? COLLIDE_MASK_WALK,
        set: () => {},
      },
    }
    room.adjacentRooms = buildAdjacentRoomLists([room]).get(room) ?? [room]

    const runD2CommonServer = (sx: number, sy: number, tx: number, ty: number) => {
      const unit: PathUnit = {
        dwUnitType: UNIT_PLAYER,
        dwClassId: 0,
        dwUnitId: 1,
        dwAnimMode: 2,
        dwFlags: 1,
        dwFlagEx: 0,
        pDynamicPath: null,
        pStaticPath: null,
        objectTxt: null,
      }
      const path = PATH_AllocDynamicPath(room, sx, sy, unit, 0)
      D2COMMON_10170_PathSetTargetPos(path, tx, ty)
      const n = D2Common_10142(path, unit, 0)
      const last = n > 0 ? path.PathPoints[n - 1]! : { X: sx, Y: sy }
      return { n, end: { x: last.X, y: last.Y } }
    }

    // Case A: (50, 50) -> (50, 75) in Town: distSq = 25^2 = 625 > 324 (18^2).
    // Must NOT invoke 64^2 town A* to detour around the wall; must match D2Common_10142 and stop at (50, 53).
    const srvFar = runD2CommonServer(50, 50, 50, 75)
    const cliFar = findPlayerPathD2Common113c(view, 50, 50, 50, 75)
    expect(srvFar.end).toEqual({ x: 50, y: 53 })
    expect(cliFar.path.at(-1)).toEqual(srvFar.end)
    expect(cliFar.reachedGoal).toBe(false)

    // Case B: (50, 50) -> (50, 62) in Town: distSq = 12^2 = 144 <= 324 (18^2).
    // Invokes PATH_AStar_ComputePath (0x6FDCB630) and detours around the wall to reach (50, 62).
    const srvNear = runD2CommonServer(50, 50, 50, 62)
    const cliNear = findPlayerPathD2Common113c(view, 50, 50, 50, 62)
    expect(srvNear.end).toEqual({ x: 50, y: 62 })
    expect(cliNear.path.at(-1)).toEqual(srvNear.end)
    expect(cliNear.reachedGoal).toBe(true)
  })
})
