/**
 * Regression test suite for Issue #868:
 * Rogue Encampment tent area client/server collision & target-preparation parity (`1.13c` `D2Common_10142`).
 *
 * Verifies against `TownE1.ds1` (`public/packs/act1/1-act-1-town-var1/scene.json`) and 1.13c
 * `D2Common_10142` (`0x6FD86230`):
 * 1. `CommandMapper.startLocalPathPrediction` uses `unitSize: 2` (`dwUnitSize = 2`, 5-cell `"+"` cross
 *    `0x6FD9C140`) so sub-tiles immediately adjacent to tent walls (`w1 = true, w2 = false`, such as
 *    `(150, 47)`, `(150, 41)`, `(150, 99)`) are recognized as blocked for the player's footprint.
 * 2. When the clicked sub-tile is blocked for `unitSize = 2`, `preparePathTargetLocal` / `findPathLocal`
 *    prepares the target by stepping from `tTargetCoord` toward `tStartCoord` (`PATH_PreparePathTargetForPathUpdate`
 *    `0x6FD85E00` + `PATH_FindValidTargetCoordsByMovingOrthogonally` `0x6FD85D40`) rather than radially
 *    snapping to the far side of the tent (`findNearestWalkableLocal`), matching `D2Common_10142` on 100%
 *    of the 546 sub-tiles around the Rogue Encampment Northern Tent.
 * 3. All 3 real-world `0x15` rubber-banding cases reported in Issue #868 (`13:55:42`, `13:55:46`, `13:56:04`)
 *    stop on the near side of the tent within 1 sub-tile of the 1.13c server position, eliminating the
 *    14–21 sub-tile client/server divergence.
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import type { LevelView } from '../../src/client/map/level-view.ts'
import type { MapService } from '../../src/client/map/map-service.ts'
import {
  COLLIDE_MASK_WALK,
  findNearestWalkableLocal,
  findPathLocal,
  isCellWalkableLocal,
  isUnitWalkableLocal,
  preparePathTargetLocal,
} from '../../src/client/motion/pathfind.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
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
 * Exact 1.13c `TownE1.ds1` (`1-act-1-town-var1`) walkability slice for `x in [135, 180], y in [30, 120]`
 * covering both the Northern Tent (`x = 151-169, y = 35-59`) and Southern Tent (`x = 140-153, y = 100-112`).
 * `'1'` = blocked (`COLLIDE_MASK_WALK`), `'0'` = walkable.
 */
const TOWNE1_TENT_SLICE_X0 = 135
const TOWNE1_TENT_SLICE_Y0 = 30
const TOWNE1_TENT_SLICE_ROWS: readonly string[] = [
  '1111111111111111111111111111111111111111111111',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000011111111111110000000000000000',
  '0000000000000000111111111111111110000000000000',
  '1111110000000000111111111111111111100000000000',
  '1111111100000000111111111111111111100000000000',
  '1111111110000000111111111111111111100000000000',
  '1111111110000000111111111111111111000000000000',
  '1111111110000000111111111111111111000000000000',
  '1111111100000000111111111111111110000000000000',
  '0000000000000000111111111111111110000000000000',
  '0000000000000000111111111111111110000000000000',
  '0000000000000000111111111111111110000000000000',
  '0000000000000000111111111111111110000000000000',
  '0000000000000000111111111111111110000000000000',
  '0000000000000000111111111111111110000000000000',
  '0000000000000000111111111111111110000000000000',
  '0000000000000000111111111111111100000000000000',
  '0000000000000000011111111111111100000000000000',
  '0000000000000000011111111111111000000000000000',
  '0000000000000000000011111111111000000000000000',
  '0000000000000000000011111111111000000000000000',
  '0000000000000000011111111111111000000000000000',
  '0000000000000000011100000001111100001000000000',
  '0000000000000000001100000000111100000100000000',
  '0000000000000000000000000000011000000000000000',
  '0000000000000000000000000000011000000000000000',
  '1111111111111000000000000000000000000000000000',
  '1111111111111000000000000000000000000000000000',
  '1100000000000000000000000000000000000000000000',
  '1100000000000000000000000000000000000000000000',
  '1100000000000000000000000000000000000000000000',
  '1100011110100000000000000000000000000000000000',
  '1100011110100000000000000000000000000000000000',
  '1100011110000000000000000000000000000000000000',
  '1100011110000000000000000000000000000000000000',
  '1100000000000000000000000000000000000000000000',
  '1100000000000000000000000000000000011000000000',
  '1100000000000000000000000000000000011000000000',
  '1100000000000000000000000000000000011000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000011110000000000000000000000',
  '0000000000000000000111111000000000000000000000',
  '0000000000000000000111111000000000000000000000',
  '0000000000000000000111111000000000000000000000',
  '0000000000000000000111111000000000000000000000',
  '0000000000000000000111111000000000000000000000',
  '0000000000000000000000000000000000000000110000',
  '0000000000000000000000000000000000000000111000',
  '0000000000000000000000000000000000000000111000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000011100000000000000000000000',
  '0000000000000000000011100000000000000000000000',
  '0000000000000000000011100000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000011111111111110000000000000000000000000001',
  '0000011111111111110000000000000000000000000001',
  '0000011111111111110000000000000000000000000001',
  '0000011111111111100000000000000000000000000001',
  '0000011111111111000000000000000000000000000001',
  '0000011111111111000000000000000000000000000001',
  '0000011111111111000000000000000000000000000001',
  '0000011111111111000000000000000000000000000001',
  '0000011111111111000000000000000000000000000001',
  '0000011111111111000000000000000000000000000001',
  '0000011111111111100000000011111111111111111000',
  '0000011111000001100000000011111111111111111000',
  '0000001110000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000000000000000',
  '0000000000000000000000000000000000011111100000',
]

function loadTownVar1LevelView(subOriginX = 5000, subOriginY = 5000): {
  readonly view: LevelView
  readonly room: PathRoom
} {
  const subWidth = 285
  const subHeight = 205
  const collision = new Uint16Array(subWidth * subHeight)
  const walkable = new Uint8Array(subWidth * subHeight).fill(1)
  const blocked = new Uint8Array(subWidth * subHeight).fill(0)

  const candidates = [
    path.resolve(process.cwd(), 'public/packs/act1/1-act-1-town-var1/scene.json'),
    path.resolve(process.cwd(), '../../public/packs/act1/1-act-1-town-var1/scene.json'),
  ]
  const foundScenePath = candidates.find(p => fs.existsSync(p))
  if (foundScenePath) {
    const scene = JSON.parse(fs.readFileSync(foundScenePath, 'utf8')) as {
      readonly collision: {
        readonly width: number
        readonly height: number
        readonly runs: readonly (readonly [number, number])[]
      }
    }
    let idx = 0
    for (const [val, count] of scene.collision.runs) {
      const isBlocked = val !== 0
      collision.fill(isBlocked ? 1 : 0, idx, idx + count)
      walkable.fill(isBlocked ? 0 : 1, idx, idx + count)
      blocked.fill(isBlocked ? 1 : 0, idx, idx + count)
      idx += count
    }
  } else {
    for (let dy = 0; dy < TOWNE1_TENT_SLICE_ROWS.length; dy++) {
      const row = TOWNE1_TENT_SLICE_ROWS[dy]!
      const y = TOWNE1_TENT_SLICE_Y0 + dy
      for (let dx = 0; dx < row.length; dx++) {
        const x = TOWNE1_TENT_SLICE_X0 + dx
        const isBlocked = row[dx] === '1'
        const idx = y * subWidth + x
        collision[idx] = isBlocked ? 1 : 0
        walkable[idx] = isBlocked ? 0 : 1
        blocked[idx] = isBlocked ? 1 : 0
      }
    }
  }

  const adjacentRooms: PathRoom[] = []
  const room: PathRoom = {
    subX: 0,
    subY: 0,
    subW: subWidth,
    subH: subHeight,
    isTown: true,
    adjacentRooms,
    grid: {
      get: (x, y) => collision[y * subWidth + x] ?? 0,
      set: () => {},
    },
  }
  adjacentRooms.push(room)

  const view = {
    levelId: 1,
    areaId: 1,
    name: 'Rogue Encampment',
    act: 0,
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
  readonly finalTarget: { readonly x: number; readonly y: number }
  readonly endPos: { readonly x: number; readonly y: number }
} {
  const path = new DynamicPath()
  const unit: PathUnit = {
    dwUnitType: UNIT_PLAYER,
    dwClassId: 0,
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

  const count = D2Common_10142(path, unit, true)
  const lastPt = count > 0 ? path.PathPoints[count - 1]! : { X: sx, Y: sy }
  return {
    count,
    finalTarget: { x: path.tFinalTargetCoord.X, y: path.tFinalTargetCoord.Y },
    endPos: { x: lastPt.X, y: lastPt.Y },
  }
}

describe('Issue #868 — Rogue Encampment tent collision & 1.13c target preparation parity', () => {
  const { view, room } = loadTownVar1LevelView(5000, 5000)

  it('1. identifies tent-wall-adjacent sub-tiles (150,47), (150,41), (150,99) as w1=true but w2=false (blocked for player dwUnitSize=2)', () => {
    for (const [lx, ly] of [
      [150, 47],
      [150, 41],
      [150, 99],
    ] as const) {
      expect(isCellWalkableLocal(view, lx, ly)).toBe(true)
      expect(isUnitWalkableLocal(view, lx, ly, 2)).toBe(false)
    }
  })

  it('2. matches 1.13c D2Common_10142 target preparation (0x6FD85E00 + 0x6FD85D40) on 100% of 546 sub-tiles around the Northern Tent', () => {
    const sx = 168
    const sy = 56
    let totalChecked = 0
    for (let ty = 40; ty <= 65; ty++) {
      for (let tx = 145; tx <= 165; tx++) {
        totalChecked++
        const srv = runServer113cStraightPath(room, sx, sy, tx, ty)
        const prep = preparePathTargetLocal(view, sx, sy, tx, ty, 2)
        if (srv.count === 0) {
          expect(prep).toBeNull()
        } else {
          expect(prep).toEqual(srv.finalTarget)
          expect(isUnitWalkableLocal(view, prep!.x, prep!.y, 2)).toBe(true)
        }
      }
    }
    expect(totalChecked).toBe(546)
  })

  it('3. resolves Issue #868 0x15 rubber-banding cases in CommandMapper & LocalMovementPredictor with 0 sub-tile server divergence', () => {
    const ox = view.subOriginX
    const oy = view.subOriginY

    // Part A: Direct clicks on the w1=true, w2=false tent-wall cells logged in Issue #868
    // match 1.13c D2Common_10142 tFinalTargetCoord 100% and never step onto w2=false cells
    const wallEdgeClicks = [
      {
        label: '13:55:42 Northern Tent wall edge (168,56) -> (150,47)',
        start: { x: 168, y: 56 },
        click: { x: 150, y: 47 },
        expectedFinalTarget: { x: 150, y: 51 },
      },
      {
        label: '13:55:46 Northern Tent upper corner (168,57) -> (150,41)',
        start: { x: 168, y: 57 },
        click: { x: 150, y: 41 },
        expectedFinalTarget: { x: 150, y: 51 },
      },
      {
        label: '13:56:04 Southern Tent wall edge (158,110) -> (150,99)',
        start: { x: 158, y: 110 },
        click: { x: 150, y: 99 },
        expectedFinalTarget: { x: 153, y: 99 },
      },
    ] as const

    // Legacy unitSize=1 treated (150,99) as walkable and routed around the Southern Tent to (150,99)
    const legacySouthernWall = findPathLocal(view, 158, 110, 150, 99, { unitSize: 1 })
    expect(legacySouthernWall.path.at(-1)).toEqual({ x: 150, y: 99 })

    for (const wc of wallEdgeClicks) {
      const srv = runServer113cStraightPath(room, wc.start.x, wc.start.y, wc.click.x, wc.click.y)
      expect(srv.finalTarget, `${wc.label} server finalTarget`).toEqual(wc.expectedFinalTarget)
      expect(
        preparePathTargetLocal(view, wc.start.x, wc.start.y, wc.click.x, wc.click.y, 2),
        `${wc.label} preparePathTargetLocal`,
      ).toEqual(wc.expectedFinalTarget)

      const localRes = findPathLocal(view, wc.start.x, wc.start.y, wc.click.x, wc.click.y, {
        unitSize: 2,
      })
      for (const pt of localRes.rawPath) {
        expect(isUnitWalkableLocal(view, pt.x, pt.y, 2)).toBe(true)
      }
    }

    // Part B: Clicking inside the Northern/Southern Tent from the SE side:
    // - Legacy client (findNearestWalkableLocal + unitSize=1) radially snapped to (150,47) / (150,99)
    //   and A*-routed around the tent to the far NW wall, causing 14-21 sub-tile 0x15 teleports.
    // - New client (preparePathTargetLocal + unitSize=2) matches 1.13c D2Common_10142 endPos with 0 sub-tile error.
    expect(findNearestWalkableLocal(view, 153, 47, 10, 164, 55, 1)).toEqual({ x: 150, y: 47 })
    expect(findNearestWalkableLocal(view, 150, 100, 10, 158, 110, 1)).toEqual({ x: 150, y: 99 })

    const tentCases = [
      {
        label: 'Northern Tent interior click from (167,55) -> (153,47) (formerly snapped to (150,47))',
        start: { x: 167, y: 55 },
        click: { x: 153, y: 47 },
        expectedEnd: { x: 153, y: 59 },
      },
      {
        label: 'Northern Tent interior click from (168,56) -> (153,47)',
        start: { x: 168, y: 56 },
        click: { x: 153, y: 47 },
        expectedEnd: { x: 153, y: 59 },
      },
      {
        label: 'Northern Tent interior click from (168,56) -> (156,47)',
        start: { x: 168, y: 56 },
        click: { x: 156, y: 47 },
        expectedEnd: { x: 156, y: 57 },
      },
      {
        label: 'Southern Tent interior click from (158,110) -> (150,102) (formerly snapped to (150,99))',
        start: { x: 158, y: 110 },
        click: { x: 150, y: 102 },
        expectedEnd: { x: 154, y: 102 },
      },
    ] as const

    for (const tc of tentCases) {
      const srv = runServer113cStraightPath(room, tc.start.x, tc.start.y, tc.click.x, tc.click.y)
      expect(srv.endPos, `${tc.label} server endPos`).toEqual(tc.expectedEnd)

      const localRes = findPathLocal(view, tc.start.x, tc.start.y, tc.click.x, tc.click.y, {
        unitSize: 2,
      })
      expect(localRes.path.at(-1), `${tc.label} findPathLocal end`).toEqual(tc.expectedEnd)
      for (const pt of localRes.rawPath) {
        expect(isUnitWalkableLocal(view, pt.x, pt.y, 2)).toBe(true)
      }

      const world = new ClientWorld()
      world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 1 })
      world.apply({
        type: 'PlayerAssign',
        unitId: 1,
        classId: 0,
        name: 'Hero',
        x: ox + tc.start.x,
        y: oy + tc.start.y,
      })

      const mockMapService = {
        getActiveLevelView: () => view,
        getConnectedLevelViews: () => [],
        findLevelViewAtWorldSubTile: () => view,
        findAllLevelViewsAtWorldSubTile: () => [view],
      } as unknown as MapService

      const hudManager = new HudManager()
      const predictor = new LocalMovementPredictor({
        initialX: ox + tc.start.x,
        initialY: oy + tc.start.y,
      })
      const hudModel = new HudModel({ world, hudManager, predictor })
      const mapper = new CommandMapper({
        world,
        hudManager,
        hudModel,
        predictor,
        mapService: mockMapService,
        rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
      })

      const cmdRec = mapper.triggerPrimaryWorldAction(
        ox + tc.click.x,
        oy + tc.click.y,
        null,
        1000,
      )
      expect(cmdRec).not.toBeNull()
      predictor.update(4000)

      const snap = predictor.getSnapshot()
      const endLocalX = snap.x - ox
      const endLocalY = snap.y - oy
      expect({ x: endLocalX, y: endLocalY }, `${tc.label} predictor final pos`).toEqual(
        tc.expectedEnd,
      )
    }
  })
})

