/**
 * Regression Tests for Issue #1401:
 * - Widescreen (1068x600, 1280x720, 1280x960, 1424x800) render camera vs ViewportCamera / CommandMapper 1:1 parity
 * - Indoor dungeon (Levels.txt IsInside == 1, e.g. Catacombs Level 4 areaId=37) void preservation (no fake skirt floor quads)
 * - subTileToScreen / screenToSubTile exact vertical alignment with worldToScreen / screenToWorld (CAMERA_Y_OFFSET = -16)
 * - renderSceneSourceFrame single-application of shakeOffsetX / shakeOffsetY
 */
import { describe, expect, it } from 'vitest'
import { ViewportCamera } from '../../src/client/input/command-mapper.ts'
import type { LevelDrawItem, LevelView } from '../../src/client/map/level-view.ts'
import { renderSceneSourceFrame } from '../../src/client/scene/world-renderer.ts'
import { ClientWorldSceneSource } from '../../src/client/view/scene-source.ts'
import {
  CAMERA_Y_OFFSET,
  computePanelCameraShift,
  getViewportProfile,
  panelDockWidth,
  screenToSubTile,
  screenToWorld,
  subTileToScreen,
  subTileToWorldOrtho,
  VIEWPORT_PROFILES,
  worldToScreen,
} from '../../src/client/view/viewport-profile.ts'
import { CANONICAL_LEVEL_LIGHTING } from '../../src/common/world/levels-meta.ts'

function createDungeonLevelView(areaId: number, cellsX = 24, cellsY = 24, floors: readonly LevelDrawItem[] = []): LevelView {
  const subW = cellsX * 5
  const subH = cellsY * 5
  return {
    id: areaId,
    areaId,
    levelId: areaId,
    act: 0,
    seed: 0xdeadbeef,
    difficulty: 0,
    originX: 0,
    originY: 0,
    subOriginX: 0,
    subOriginY: 0,
    width: subW,
    height: subH,
    subWidth: subW,
    subHeight: subH,
    tileOriginX: 0,
    tileOriginY: 0,
    tileWidth: cellsX - 1,
    tileHeight: cellsY - 1,
    cellsX,
    cellsY,
    gridWidth: subW,
    gridHeight: subH,
    isoOriginX: subH * 16,
    isoOriginY: 0,
    collision: new Uint16Array(subW * subH),
    collisionMasks: new Uint16Array(subW * subH),
    blocked: new Uint8Array(subW * subH),
    walkable: new Uint8Array(subW * subH).fill(1),
    floors,
    shadows: [],
    walls: [],
    roofs: [],
    entrances: [],
    warps: [],
    landmarks: [],
    rooms: [],
    spawnX: 10,
    spawnY: 10,
    automap: {
      layerId: 1,
      levelTypeId: 1,
      floors: [],
      walls: [],
      objects: [],
      extras: [],
    },
  } as unknown as LevelView
}

describe('Issue #1401: Widescreen Render vs Input Camera Parity & Indoor Void Protection', () => {
  it('1. aligns subTileToScreen / screenToSubTile with worldToScreen / screenToWorld to 0px across all viewport profiles', () => {
    for (const profile of Object.values(VIEWPORT_PROFILES)) {
      for (const [leftOpen, rightOpen] of [
        [false, false],
        [true, false],
        [false, true],
        [true, true],
      ] as const) {
        const panelShiftX = computePanelCameraShift(leftOpen, rightOpen, panelDockWidth(profile))
        const camSubX = 85
        const camSubY = 65
        const targetSubX = 92
        const targetSubY = 58

        const playerWorld = subTileToWorldOrtho(camSubX, camSubY, 1920, 0)
        const targetWorld = subTileToWorldOrtho(targetSubX, targetSubY, 1920, 0)
        const camCenterX = playerWorld.x + panelShiftX
        const camCenterY = playerWorld.y + CAMERA_Y_OFFSET

        const expectedScreen = worldToScreen(
          targetWorld.x,
          targetWorld.y,
          camCenterX,
          camCenterY,
          profile,
        )
        const actualScreen = subTileToScreen(
          targetSubX,
          targetSubY,
          camSubX,
          camSubY,
          profile,
          panelShiftX,
        )

        expect(actualScreen.x).toBe(expectedScreen.x)
        expect(actualScreen.y).toBe(expectedScreen.y)

        const roundTripSub = screenToSubTile(
          actualScreen.x,
          actualScreen.y,
          camSubX,
          camSubY,
          profile,
          panelShiftX,
        )
        expect(roundTripSub.x).toBeCloseTo(targetSubX, 6)
        expect(roundTripSub.y).toBeCloseTo(targetSubY, 6)

        const roundTripWorld = screenToWorld(
          actualScreen.x,
          actualScreen.y,
          camCenterX,
          camCenterY,
          profile,
        )
        expect(roundTripWorld.x).toBe(targetWorld.x)
        expect(roundTripWorld.y).toBe(targetWorld.y)
      }
    }
  })

  it('2. eliminates 1424x800 widescreen mouse drift in Catacombs Level 4 (areaId=37) across both rooms', () => {
    const catacombs4 = createDungeonLevelView(37, 24, 24)
    const profile = getViewportProfile('1424x800')
    const camera = new ViewportCamera(profile)

    // Test both room extremes from Video_1792728682383_141.mp4:
    // - Bottom-Right stairs room (large subX = 115, subY = 40)
    // - Bottom-Left Andariel blood-pool hall (subX = 40, large subY = 115)
    for (const [playerSubX, playerSubY] of [
      [115, 40],
      [40, 115],
    ] as const) {
      const itemSubX = playerSubX - 8
      const itemSubY = playerSubY + 4

      const source = new ClientWorldSceneSource(
        () => ({
          tick: 10,
          actId: 1,
          levelId: 37,
          playerSubX,
          playerSubY,
          ambient: null,
          levelView: catacombs4,
          neighbourLevelViews: [],
          units: [
            {
              id: 777,
              kind: 'item',
              classId: 50,
              mode: 3,
              x: itemSubX,
              y: itemSubY,
              name: 'Trident',
              nameZh: '三叉戟',
            },
          ],
        }),
        profile,
      )

      const snapshot = source.buildFrameSnapshot()
      camera.snapTo(playerSubX, playerSubY)

      // Item screen coordinate from render snapshot cameraTopLeft
      const itemDrawable = snapshot.entities.unitDrawables.find((u) => u.unitId === 777)!
      expect(itemDrawable).toBeDefined()
      const renderedScreenX = itemDrawable.worldX - snapshot.cameraTopLeft.x
      const renderedScreenY = itemDrawable.worldY - snapshot.cameraTopLeft.y

      // Item screen coordinate from input ViewportCamera
      const inputScreen = camera.subtileToScreen(itemSubX, itemSubY)
      expect(inputScreen.x).toBe(renderedScreenX)
      expect(inputScreen.y).toBe(renderedScreenY)

      // Clicking at renderedScreenX/Y via ViewportCamera maps back to exact item subtile (0 drift!)
      const clickedSub = camera.screenToSubtile(renderedScreenX, renderedScreenY)
      expect(clickedSub.x).toBe(itemSubX)
      expect(clickedSub.y).toBe(itemSubY)

      // pickUnitAtScreen hits the item at its exact rendered screen position
      const picked = source.pickUnitAtScreen(renderedScreenX, renderedScreenY, 36, profile)
      expect(picked?.unitId).toBe(777)
    }
  })

  it('3. suppresses widescreen border skirt floor quads on all 89 indoor levels (IsInside == 1)', () => {
    const sampleFloor: LevelDrawItem = {
      x: 0,
      y: 0,
      cellX: 0,
      cellY: 0,
      act: 1,
      library: 1,
      tile: 1,
      dt1Path: 'test.dt1',
      placement: { act: 1, page: 0, x: 0, y: 0, width: 80, height: 40 },
      blockCount: 1,
      frameIndex: 0,
    } as unknown as LevelDrawItem

    let indoorCount = 0
    for (const def of Object.values(CANONICAL_LEVEL_LIGHTING)) {
      if (!def.isInside) continue
      indoorCount++
      const lv = createDungeonLevelView(def.id, 4, 4, [sampleFloor])
      const source = new ClientWorldSceneSource(
        () => ({
          tick: 1,
          actId: def.act as 1 | 2 | 3 | 4 | 5,
          levelId: def.id,
          playerSubX: 10,
          playerSubY: 10,
          ambient: null,
          levelView: lv,
          neighbourLevelViews: [],
          units: [],
        }),
        '1424x800',
      )
      const snap = source.buildFrameSnapshot()
      const skirtQuads = snap.floorQuads.filter(
        (q) => q.cellX < 0 || q.cellX >= 4 || q.cellY < 0 || q.cellY >= 4,
      )
      expect(skirtQuads.length).toBe(0)
    }
    expect(indoorCount).toBe(89)
  })

  it('4. applies shakeOffsetX / shakeOffsetY once (not twice) in renderSceneSourceFrame', () => {
    const lv = createDungeonLevelView(37, 16, 16)
    const source = new ClientWorldSceneSource(
      () => ({
        tick: 5,
        actId: 1,
        levelId: 37,
        playerSubX: 40,
        playerSubY: 40,
        shakeOffsetX: 12,
        shakeOffsetY: -9,
        ambient: null,
        levelView: lv,
        neighbourLevelViews: [],
        units: [],
      }),
      '1424x800',
    )

    let capturedBeginCam: { x: number; y: number } | null = null
    const mockRenderer = {
      begin: (cam: { x: number; y: number }) => {
        capturedBeginCam = cam
      },
      setLighting: () => {},
      draw: () => {},
      flush: () => {},
      end: () => {},
    }

    const snap = renderSceneSourceFrame({
      source,
      renderer: mockRenderer as any,
      lightingPreset: '113c' as any,
    })

    expect(capturedBeginCam).not.toBeNull()
    expect(capturedBeginCam!.x).toBe(snap.playerWorld.x + 12)
    expect(capturedBeginCam!.y).toBe(snap.playerWorld.y + CAMERA_Y_OFFSET - 9)
  })
})
