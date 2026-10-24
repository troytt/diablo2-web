/**
 * Regression suite for Act 2 Lut Gholein Palace & Harem Level 1 occlusion, warp hitbox,
 * circular stairwell pathfinding, and Dummy ('一股邪恶力量' / 'An Evil Force') filtering
 * (Issues #1330, #1331, #1332, #1333).
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { resolveLvlWarpBounds } from '../../src/common/world/level-warps-meta.ts'
import { getMonsterKindByClassId } from '../../src/common/units/monsters-data.ts'
import { isTownNpcHcIdx } from '../../src/common/units/npc-table.ts'
import { WallFadeTracker113c, type PopBoxInput } from '../../src/client/scene/wall-fade-113c.ts'
import {
  classifyAutomapMonsterMarker,
  renderSceneSourceFrame,
  type SceneSourceRenderContext,
} from '../../src/client/scene/world-renderer.ts'
import { wallSortY, type SceneTileQuad } from '../../src/client/view/scene-source.ts'
import { buildSceneDrawables } from '../../src/client/view/unit-drawables.ts'
import { ClientUnit } from '../../src/client/world/client-unit.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import { isWarpInInteractRange113c } from '../../src/client/input/click-rules-113c.ts'
import type { LevelView } from '../../src/client/map/level-view.ts'
import type { MapService } from '../../src/client/map/map-service.ts'
import {
  findPathLocal,
  isCellWalkableLocal,
  isUnitWalkableLocal,
} from '../../src/client/motion/pathfind.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../../src/client/session/rate-limiter.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import {
  VIEWPORT_800x600,
  subTileToScreen,
  subTileToWorldOrtho,
} from '../../src/client/view/viewport-profile.ts'

if (typeof globalThis.window === 'undefined') {
  ;(globalThis as unknown as { window: Record<string, unknown> }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
  }
}

function loadSceneWalkableView(sceneJsonPath: string, areaId: number): LevelView {
  const scene = JSON.parse(fs.readFileSync(sceneJsonPath, 'utf8')) as {
    readonly collision: {
      readonly width: number
      readonly height: number
      readonly runs: readonly (readonly [number, number])[]
    }
  }
  const subWidth = scene.collision.width
  const subHeight = scene.collision.height
  const walkable = new Uint8Array(subWidth * subHeight)
  const blocked = new Uint8Array(subWidth * subHeight)
  const collision = new Uint16Array(subWidth * subHeight)
  let idx = 0
  for (const [val, count] of scene.collision.runs) {
    const isBlocked = (val & 1) !== 0
    walkable.fill(isBlocked ? 0 : 1, idx, idx + count)
    blocked.fill(isBlocked ? 1 : 0, idx, idx + count)
    collision.fill(val, idx, idx + count)
    idx += count
  }
  return {
    levelId: areaId,
    areaId,
    name: `Area ${areaId}`,
    act: 1,
    tileOriginX: 0,
    tileOriginY: 0,
    tileWidth: Math.floor(subWidth / 5),
    tileHeight: Math.floor(subHeight / 5),
    subOriginX: 0,
    subOriginY: 0,
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
    warps: [],
  } as unknown as LevelView
}

describe('Issue #1330: 1.13c DrawGrid upper-wall vs unit depth order & initial POPS roof suppression', () => {
  it('draws walkable foreground subtiles inside (cellX, cellY) on top of their own cell palm tree / pillar / wall while occluding behind-cell units', () => {
    // Lut Gholein Palace courtyard cell (11, 29): palm tree wallType=3 (`mainIndex=4, subIndex=1`)
    // blocks only north corner `(55..56, 145..146)` and leaves `(57..59, 147..149)` walkable.
    const treeSortY = wallSortY(11, 29, 3)
    const fgPos = subTileToWorldOrtho(57, 147)
    expect(fgPos.y).toBeGreaterThan(treeSortY)

    const entities = buildSceneDrawables({
      units: [
        {
          id: 1,
          kind: 'item',
          classId: 0,
          code: 'gld',
          x: 54,
          y: 146,
          mode: 3,
          direction: 0,
        },
        {
          id: 2,
          kind: 'item',
          classId: 0,
          code: 'gld',
          x: 57,
          y: 147,
          mode: 3,
          direction: 0,
        },
      ],
    })

    const wallQuad: SceneTileQuad = {
      cellX: 11,
      cellY: 29,
      worldX: 111,
      worldY: 0,
      sortY: treeSortY,
      act: 2,
      library: 0,
      tile: 111,
      type: 3,
      dt1Path: 'palace',
      placement: { page: 0, x: 0, y: 0, width: 8, height: 8, act: 2 } as SceneTileQuad['placement'],
    }

    const draws: string[] = []
    const renderer = {
      begin: vi.fn(),
      flush: vi.fn(),
      setLighting: vi.fn(),
      setUnitLight: vi.fn(),
      setBlendMode: vi.fn(),
      draw: vi.fn((_f: unknown, x: number) => {
        if (Math.round(x) === 111) {
          draws.push('tree-wall')
        } else if (x < -1455) {
          draws.push('behind-unit')
        } else {
          draws.push('foreground-player')
        }
      }),
    }
    const snapshot = {
      tick: 1,
      worldReady: true,
      actId: 2,
      levelId: 40,
      viewportProfile: { width: 800, height: 600, hudHeight: 48 },
      playerWorld: fgPos,
      playerSubTile: { x: 57, y: 147 },
      playerLocalSubTile: { x: 57, y: 147 },
      cameraTopLeft: { x: 0, y: 0 },
      floorQuads: [],
      shadowQuads: [],
      lowerWallQuads: [],
      upperWallQuads: [wallQuad],
      roofQuads: [],
      entities,
    }
    const source = {
      buildFrameSnapshot: () => snapshot,
      getLevelView: () => null,
    }
    const ctx = {
      nowMs: 100,
      renderer,
      tileGpuCache: {
        ensureActPalette: vi.fn(),
        getPageHandle: () => ({ texture: {}, width: 64, height: 64 }),
      },
      itemsAtlasHandle: { texture: {}, width: 64, height: 64 },
      source,
    } as unknown as SceneSourceRenderContext

    renderSceneSourceFrame(ctx)

    // Behind-wall unit (subtile 54,146 in cell 10+29=39) is drawn BEFORE tree-wall (x=111, cell 11+29=40),
    // and foreground player (subtile 57,147 in cell 11+29=40) is drawn AFTER tree-wall!
    expect(draws).toEqual(['behind-unit', 'tree-wall', 'foreground-player'])
  })

  it('immediately hides POPS roofs on frame 0 when spawning inside a POPS region without a 500ms roof flash', () => {
    const tracker = new WallFadeTracker113c()
    const pops: readonly PopBoxInput[] = [
      {
        index: 1,
        subIndex: 1,
        pad: 0,
        mapIndex: 0,
        box: { x: 8, y: 25, width: 7, height: 8 },
      },
    ]
    // Initial spawn inside Palace POPS #1 at (51, 141)
    tracker.updatePops(pops, 51, 141, 1000)
    const roofTile = { cellX: 11, cellY: 28, library: 1, tile: 10, type: 15, style: 1 }
    const roofSample = tracker.samplePopTile(roofTile, pops, 1000)
    expect(roofSample).toEqual({ visible: false, alpha: 0 })
    const cutawayTile = {
      cellX: 11,
      cellY: 28,
      library: 1,
      tile: 20,
      type: 0,
      style: 1,
      revealHidden: true,
    }
    const cutawaySample = tracker.samplePopTile(cutawayTile, pops, 1000)
    expect(cutawaySample).toEqual({ visible: true, alpha: 255 })

    // Walking out of the POPS region later still uses the smooth 500ms fade-in ramp
    tracker.updatePops(pops, 90, 180, 2000)
    const midRamp = tracker.samplePopTile(roofTile, pops, 2250)
    expect(midRamp?.visible).toBe(true)
    expect(midRamp?.alpha).toBeGreaterThan(100)
    expect(midRamp?.alpha).toBeLessThan(150)
  })
})

describe('Issue #1331: LvlWarp.txt SelectX/SelectY/SelectDX/SelectDY hitbox across all 83 warps', () => {
  it('uses LvlWarp.txt SelectX/SelectY/SelectDX/SelectDY for every warp with non-zero SelectDX/SelectDY', () => {
    for (let warpId = 0; warpId < 83; warpId++) {
      const bounds = resolveLvlWarpBounds(warpId)
      const unit = new ClientUnit({
        id: 1000 + warpId,
        unitType: 'tile',
        classId: warpId,
        warpId,
        x: 5,
        y: 43,
      })
      const hb = unit.getHitBox()
      if (bounds.selectDX > 0 && bounds.selectDY > 0) {
        expect(hb).toEqual({
          left: bounds.selectX,
          top: bounds.selectY,
          width: bounds.selectDX,
          height: bounds.selectDY,
        })
      } else {
        expect(hb).toEqual({ left: -32, top: -32, width: 64, height: 48 })
      }
    }
  })

  it('Lut Gholein Palace to Harem (warpId=24, SelectX=-120..30, SelectY=-20..110) hit-tests across its full LvlWarp.txt stairwell box', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 1, mapSeed: 123, areaId: 40 })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 1,
      name: 'Hero',
      x: 52,
      y: 141,
    })
    world.apply({
      type: 'UnitAssign',
      unit: {
        id: 99,
        unitType: 'tile',
        classId: 24,
        warpId: 24,
        x: 50,
        y: 142,
        name: 'Harem Level 1',
      },
    })

    const hudManager = new HudManager()
    const predictor = new LocalMovementPredictor({ initialX: 52, initialY: 141 })
    const hudModel = new HudModel({ world, hudManager, predictor })
    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor,
      rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
    })

    const rawAnchorScreen = subTileToScreen(50, 142, 52, 141, VIEWPORT_800x600)
    // Left side of stairwell at offset (-80, +40), inside LvlWarp.txt SelectX=-120..+30, SelectY=-20..+110
    // (previously missed by hardcoded -32..+32 x -32..+16 box!)
    const targetOnStairs = mapper.resolvePointerTarget(rawAnchorScreen.x - 80, rawAnchorScreen.y + 40)
    expect(targetOnStairs.hoveredUnit?.id).toBe(99)

    // Far right of stairwell (+80px, outside SelectX + SelectDX = +30) does NOT hit the warp
    const targetOutside = mapper.resolvePointerTarget(rawAnchorScreen.x + 80, rawAnchorScreen.y - 40)
    expect(targetOutside.hoveredUnit).toBeNull()
  })
})

describe('Issue #1332: Circular stairwell alcove pathfinding & walk-to-warp entrance resolution', () => {
  const act2ScenePath = path.resolve(
    process.cwd(),
    'public/packs/act2/40-act-2-town-var1/scene.json',
  )
  const haremScenePath = path.resolve(
    process.cwd(),
    'public/packs/act2/50-act-2-harem-var1/scene.json',
  )

  it.skipIf(!fs.existsSync(act2ScenePath))(
    'routes around the Lut Gholein Palace circular stairwell wall into Harem entrance (50, 142) from outside (56, 150)',
    () => {
      const grid = loadSceneWalkableView(act2ScenePath, 40)

      // (50, 142) is walkable at unitSize=1 but blocked at unitSize=2 due to adjacent stairwell wall
      expect(isCellWalkableLocal(grid, 50, 142)).toBe(true)
      expect(isUnitWalkableLocal(grid, 50, 142, 2)).toBe(false)

      for (const [gx, gy] of [
        [50, 142],
        [51, 142],
        [52, 142],
      ] as const) {
        const res = findPathLocal(grid, 56, 150, gx, gy, { unitSize: 2 })
        expect(res.reachedGoal).toBe(true)
        expect(res.path.length).toBeGreaterThan(2)
        const end = res.path[res.path.length - 1]!
        // Must land inside the stairwell opening within 1.13c warp interaction range of (50, 142)
        expect(isWarpInInteractRange113c(end.x, end.y, 50, 142)).toBe(true)
      }
    },
  )

  it.skipIf(!fs.existsSync(haremScenePath))(
    'paths to a walkable staircase subtile within warp interaction range when clicking Harem Level 1 warp (5, 43) from outside range',
    () => {
      const levelView = loadSceneWalkableView(haremScenePath, 50)

      const world = new ClientWorld()
      world.apply({ type: 'LoadAct', act: 1, mapSeed: 123, areaId: 50 })
      world.apply({
        type: 'PlayerAssign',
        unitId: 1,
        classId: 1,
        name: 'Hero',
        x: 15,
        y: 43,
      })
      world.apply({
        type: 'UnitAssign',
        unit: {
          id: 250,
          unitType: 'tile',
          classId: 25,
          warpId: 25,
          x: 5,
          y: 43,
        },
      })

      const mockMapService = {
        getActiveLevelView: () => levelView,
        getConnectedLevelViews: () => [],
        findLevelViewAtWorldSubTile: () => levelView,
        findAllLevelViewsAtWorldSubTile: () => [levelView],
      } as unknown as MapService
      const hudManager = new HudManager()
      const predictor = new LocalMovementPredictor({ initialX: 15, initialY: 43 })
      const hudModel = new HudModel({ world, hudManager, predictor })
      const mapper = new CommandMapper({
        world,
        hudManager,
        hudModel,
        predictor,
        mapService: mockMapService,
        rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
      })

      const warpUnit = world.getUnit('tile', 250)!
      const cmdRec = mapper.triggerPrimaryWorldAction(5, 43, warpUnit, 1000)
      expect(cmdRec?.command.type).toBe('MoveToUnit')
      const end = cmdRec?.path?.[cmdRec.path.length - 1]
      expect(end).toBeDefined()
      expect(isWarpInInteractRange113c(end!.x, end!.y, 5, 43)).toBe(true)
    },
  )
})

describe('Issue #1333: Suppress MonStats.txt NameStr=Dummy ("一股邪恶力量" / "An Evil Force") across all 733 monsters', () => {
  it('suppresses all MonStats.txt NameStr=Dummy and non-interact ambient monsters from automap NPC markers', () => {
    const dummyIds: number[] = []
    for (let cid = 0; cid < 733; cid++) {
      const mk = getMonsterKindByClassId(cid)
      if (!mk) continue
      if (mk.nameKey?.toLowerCase() === 'dummy' && !isTownNpcHcIdx(cid)) {
        dummyIds.push(cid)
        const baseInput = {
          classId: cid,
          worldX: 100,
          worldY: 200,
          mode: 1,
          lifePct: 100,
          isCorpse: false,
          isNpc: undefined,
          flags: undefined,
          isChampion: undefined,
          isUnique: undefined,
          isSuperUnique: undefined,
          superUniqueId: undefined,
          ownerType: undefined,
          ownerId: undefined,
          name: undefined,
          nameZh: undefined,
        }
        const markerZh = classifyAutomapMonsterMarker(baseInput, true, false)
        const markerEn = classifyAutomapMonsterMarker(baseInput, true, true)
        expect(markerZh?.kind).not.toBe('npc')
        expect(markerEn?.kind).not.toBe('npc')
        expect(markerZh?.name).not.toBe('一股邪恶力量')
        expect(markerEn?.name).not.toBe('An Evil Force')
      }
    }
    // Includes act2guard1 (203), camel (185), act2male/female/child (195..197), act2vendor1/2 (204..205), etc.
    expect(dummyIds).toContain(203)
    expect(dummyIds).toContain(185)
    expect(dummyIds).toContain(195)
  })

  it('does not select or hover non-selectable ambient town guard act2guard1 (cid=203) at the Palace gate', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 1, mapSeed: 123, areaId: 40 })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 1,
      name: 'Hero',
      x: 75,
      y: 152,
    })
    world.apply({
      type: 'UnitAssign',
      unit: {
        id: 2030,
        unitType: 'monster',
        classId: 203, // act2guard1 (MonStats2 isSel=0, MonStats NameStr=Dummy)
        x: 73,
        y: 152,
        mode: 1,
      },
    })

    const hudManager = new HudManager()
    const predictor = new LocalMovementPredictor({ initialX: 75, initialY: 152 })
    const hudModel = new HudModel({ world, hudManager, predictor })
    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor,
      rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
    })
    const guardScreen = subTileToScreen(73, 152, 75, 152, VIEWPORT_800x600)
    const target = mapper.resolvePointerTarget(guardScreen.x, guardScreen.y - 20)
    expect(target.hoveredUnit).toBeNull()
  })
})
