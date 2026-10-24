/**
 * #940 R3 — entity-pass view culling regression tests.
 *
 * Ground truth: `buildFrameSnapshot` feeds `buildSceneDrawables` only the units
 * whose projected iso position is inside the camera rect padded by
 * `SCENE_CULL_PADDING_PX` (240 — the same pad the static tile pass culls with)
 * plus a 256px sprite/light margin. A unit beyond that bound can neither overlap
 * nor light the viewport, so it must be dropped BEFORE drawable construction; a
 * unit between the raw view edge and the padded bound must survive (art anchored
 * at a unit's feet reaches that far past the anchor).
 *
 * Camera math (shared with the #941 static-cache tests): player sub-tile (3, 0)
 * projects to iso (48, 24); cameraTopLeft = (-352, -292) for the 800x600 profile.
 * Raw view: x ∈ [-352, 448], y ∈ [-292, 308]. Padded bound: x ∈ [-848, 944],
 * y ∈ [-788, 804]. Sub-tile → iso: ((sx - sy) * 16, (sx + sy) * 8).
 */
import { describe, expect, it } from 'vitest'
import { ClientWorldSceneSource, SCENE_CULL_PADDING_PX } from '../../src/client/view/scene-source.ts'
import type { LevelDrawItem, LevelView } from '../../src/client/map/level-view.ts'

function makeDraw(over: Partial<LevelDrawItem> & Pick<LevelDrawItem, 'x' | 'y' | 'cellX' | 'cellY'>): LevelDrawItem {
  return {
    library: 0,
    tile: 0,
    dt1Path: 'TEST.DT1',
    placement: { act: 1, page: 0, x: 0, y: 0, width: 80, height: 40 },
    blockCount: 1,
    ...over,
  } as LevelDrawItem
}

function makeLevelView(floors: LevelDrawItem[], walls: LevelDrawItem[]): LevelView {
  const cellsX = 64
  const cellsY = 64
  const gridWidth = cellsX * 5
  const gridHeight = cellsY * 5
  return {
    act: 0,
    areaId: 1,
    id: 1,
    levelId: 1,
    seed: 1,
    difficulty: 0,
    tileOriginX: 0,
    tileOriginY: 0,
    originX: 0,
    originY: 0,
    subOriginX: 0,
    subOriginY: 0,
    isoOriginX: 0,
    isoOriginY: 0,
    cellsX,
    cellsY,
    gridWidth,
    gridHeight,
    widthPx: gridWidth * 16,
    heightPx: gridHeight * 8,
    blocked: new Uint8Array(gridWidth * gridHeight),
    collisionMasks: new Uint16Array(gridWidth * gridHeight),
    rooms: [
      {
        index: 0,
        areaId: 1,
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
        room1InitSeed: 0,
        revealed: true,
      },
    ],
    floors,
    shadows: [],
    walls,
    roofs: [],
    presets: [],
    warps: [],
    entrances: [],
    logicalIndex: undefined,
    automap: { floors: [], walls: [], objects: [] },
  } as unknown as LevelView
}

function makeUnit(id: number, x: number, y: number) {
  return {
    kind: 'player' as const,
    id,
    classId: 1,
    x,
    y,
    direction: 0,
    token: 'SO',
    isLocalPlayer: id === 1,
  }
}

const SUB_X = 3
const SUB_Y = 0

describe('#940 R3 entity-pass view cull', () => {
  it('keeps the shared cull padding at the static-pass default (240px)', () => {
    expect(SCENE_CULL_PADDING_PX).toBe(240)
  })

  it('drops units outside the padded camera rect before drawable construction', () => {
    const levelView = makeLevelView([makeDraw({ x: -400, y: -350, cellX: 0, cellY: 0 })], [])
    const st = {
      tick: 1,
      actId: 1 as const,
      levelId: 1,
      playerSubX: SUB_X,
      playerSubY: SUB_Y,
      ambient: null,
      levelView,
      // (5, 2) → iso (48, 56) on-screen; (40, 3) → iso (592, 344) past the raw
      // right edge (448) but inside the +496px pad; (80, 5) → iso (1200, 680)
      // and (50, 51) → iso (-16, 808) are both far outside the padded bound.
      units: [makeUnit(1, 5, 2), makeUnit(2, 40, 3), makeUnit(3, 80, 5), makeUnit(4, 50, 51)],
    }
    const source = new ClientWorldSceneSource(() => st)
    const snap = source.buildFrameSnapshot()
    expect(snap.entities.unitDrawables.map(d => d.unitId)).toEqual([1, 2])
    // The cull happens after the units entered the pipeline: 4 inputs, 2 drawables.
    expect(st.units).toHaveLength(4)
  })
})
