/**
 * Issue #941 — buildFrameSnapshot static-pass cache regression tests.
 *
 * Ground truth:
 * - The five tile-quad arrays depend only on (levelView identity, neighbours identity, actId,
 *   viewport, camera bucket, cull padding) — never on `tick`. Unchanged inputs must reuse the
 *   previous arrays (same references), and the returned snapshot still carries the exact
 *   per-frame camera.
 * - The camera is keyed by 64px buckets; the 240px default cull padding keeps the cached set a
 *   valid superset for any camera position inside one bucket. Crossing a bucket (or TP-scale
 *   jumps) must rebuild and cull exactly like the uncached brute force.
 * - Rebuilds refill pooled quad objects in place; recycled quads must not leak stale optional
 *   fields (type/fadeBox/noFade/...) from their previous tier.
 */
import { describe, expect, it } from 'vitest'
import { ClientWorldSceneSource } from '../../src/client/view/scene-source.ts'
import type { LevelDrawItem, LevelView } from '../../src/client/map/level-view.ts'

const VIEW_W = 800
const VIEW_H = 600

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

function makeSource(levelView: LevelView, playerSubX: number, playerSubY: number, tick = 1): ClientWorldSceneSource {
  let st = {
    tick,
    actId: 1 as const,
    levelId: 1,
    playerSubX,
    playerSubY,
    ambient: null,
    levelView,
    units: [],
  }
  const source = new ClientWorldSceneSource(() => st, '800x600')
  return source
}

/** Brute-force replica of the pre-#941 culling for floors. */
function expectedFloorCells(
  floors: LevelDrawItem[],
  camX: number,
  camY: number,
  padding = 240,
): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const f of floors) {
    const w = f.placement?.width ?? 0
    const h = f.placement?.height ?? 0
    if (f.x + w >= camX - padding && f.x <= camX + VIEW_W + padding && f.y + h >= camY - padding && f.y <= camY + VIEW_H + padding) {
      out.push([f.cellX, f.cellY])
    }
  }
  return out
}

// subX=3, subY=0 → playerWorld=(48,24) → cam=(-352, -292); both land mid 64px bucket
// (floor(-352/64)=-6 offset 32, floor(-292/64)=-5 offset 28), so small moves stay in-bucket.
const SUB_X = 3
const SUB_Y = 0

describe('#941 static-pass signature cache', () => {
  it('reuses the exact same quad arrays across frames when nothing changed (idle)', () => {
    const floors = [makeDraw({ x: -400, y: -350, cellX: 0, cellY: 0 }), makeDraw({ x: 0, y: 0, cellX: 20, cellY: 20 })]
    const source = makeSource(makeLevelView(floors, []), SUB_X, SUB_Y)
    const a = source.buildFrameSnapshot()
    const b = source.buildFrameSnapshot()
    expect(b.floorQuads).toBe(a.floorQuads)
    expect(b.shadowQuads).toBe(a.shadowQuads)
    expect(b.lowerWallQuads).toBe(a.lowerWallQuads)
    expect(b.upperWallQuads).toBe(a.upperWallQuads)
    expect(b.roofQuads).toBe(a.roofQuads)
    expect(b.floorQuads[0]).toBe(a.floorQuads[0])
  })

  it('tick advancing (animations) never invalidates the static quad arrays', () => {
    const floors = [makeDraw({ x: -400, y: -350, cellX: 0, cellY: 0 })]
    let tick = 1
    let playerSubX = SUB_X
    const levelView = makeLevelView(floors, [])
    let st = { tick, actId: 1 as const, levelId: 1, playerSubX, playerSubY: SUB_Y, ambient: null, levelView, units: [] }
    const source = new ClientWorldSceneSource(() => st, '800x600')
    const a = source.buildFrameSnapshot()
    st = { ...st, tick: tick + 100 }
    const b = source.buildFrameSnapshot()
    expect(b.floorQuads).toBe(a.floorQuads)
    expect(b.tick).toBe(101)
  })

  it('a small camera move within one 64px bucket still reuses the arrays but reports the exact camera', () => {
    const floors = [makeDraw({ x: -400, y: -350, cellX: 0, cellY: 0 })]
    const levelView = makeLevelView(floors, [])
    let st = { tick: 1, actId: 1 as const, levelId: 1, playerSubX: SUB_X, playerSubY: SUB_Y, ambient: null, levelView, units: [] }
    const source = new ClientWorldSceneSource(() => st, '800x600')
    const a = source.buildFrameSnapshot()
    // +1 sub-tile → +16px X / +8px Y: same buckets (-6, -5)
    st = { ...st, playerSubX: SUB_X + 1 }
    const b = source.buildFrameSnapshot()
    expect(b.floorQuads).toBe(a.floorQuads)
    expect(b.cameraTopLeft.x).toBe(a.cameraTopLeft.x + 16)
    expect(b.cameraTopLeft.y).toBe(a.cameraTopLeft.y + 8)
  })

  it('crossing a camera bucket (TP-scale jump) rebuilds and culls exactly like brute force', () => {
    // Two distant floor clusters: near the start camera and ~2600px away.
    const floors: LevelDrawItem[] = []
    for (let i = 0; i < 5; i++) {
      floors.push(makeDraw({ x: -400 + i * 100, y: -350 + i * 50, cellX: i, cellY: i }))
      floors.push(makeDraw({ x: 2600 + i * 100, y: 2600 / 2 + i * 50, cellX: 100 + i, cellY: 100 + i }))
    }
    const levelView = makeLevelView(floors, [])
    let st = { tick: 1, actId: 1 as const, levelId: 1, playerSubX: SUB_X, playerSubY: SUB_Y, ambient: null, levelView, units: [] }
    const source = new ClientWorldSceneSource(() => st, '800x600')
    const near = source.buildFrameSnapshot()
    // Capture the near contents BEFORE the far rebuild: pooled arrays are refilled
    // in place, so reading `near.floorQuads` after the rebuild would alias `far`.
    const nearCam = { x: near.cameraTopLeft.x, y: near.cameraTopLeft.y }
    const nearCells = near.floorQuads.map(q => [q.cellX, q.cellY])
    expect(nearCells).toEqual(expectedFloorCells(floors, nearCam.x, nearCam.y))

    // Teleport ~2600px away (+163 sub-tiles on X).
    st = { ...st, playerSubX: SUB_X + 163 }
    const far = source.buildFrameSnapshot()
    // Pooled arrays keep their identity across rebuilds, so prove the rebuild via
    // content: the visible set must swap to the far cluster and match brute force.
    const farCells = far.floorQuads.map(q => [q.cellX, q.cellY])
    expect(farCells).not.toEqual(nearCells)
    expect(farCells).toEqual(expectedFloorCells(floors, far.cameraTopLeft.x, far.cameraTopLeft.y))
  })

  it('recycled pooled quads never leak stale optional fields from a previous tier', () => {
    // Camera A: 3 floors then an upper wall carrying type/fadeBox/noFade.
    const wallDraw = makeDraw({ x: -200, y: -300, cellX: 5, cellY: 5, type: 1, noFade: true, fadeBox: { index: 2, x: 5, y: 5 } })
    const nearFloors = [
      makeDraw({ x: -400, y: -350, cellX: 0, cellY: 0 }),
      makeDraw({ x: -300, y: -350, cellX: 1, cellY: 0 }),
      makeDraw({ x: -200, y: -350, cellX: 2, cellY: 0 }),
    ]
    const levelView = makeLevelView(nearFloors, [wallDraw])
    let st = { tick: 1, actId: 1 as const, levelId: 1, playerSubX: SUB_X, playerSubY: SUB_Y, ambient: null, levelView, units: [] }
    const source = new ClientWorldSceneSource(() => st, '800x600')
    const a = source.buildFrameSnapshot()
    expect(a.upperWallQuads.length).toBe(1)
    expect(a.upperWallQuads[0]!.fadeBox).toEqual({ index: 2, x: 5, y: 5 })
    expect(a.upperWallQuads[0]!.noFade).toBe(true)

    // Camera B (far cluster): 6 plain floors, no walls — pool slots previously held the wall quad.
    const farFloors: LevelDrawItem[] = []
    for (let i = 0; i < 6; i++) farFloors.push(makeDraw({ x: 2600 + i * 100, y: 1300 + i * 50, cellX: 200 + i, cellY: 200 }))
    const farWalls = [makeDraw({ x: 2600, y: 1300, cellX: 210, cellY: 210, type: 1, noFade: true, fadeBox: { index: 3, x: 1, y: 1 } })]
    const farLevelView = makeLevelView(farFloors, farWalls)
    // Swap the level contents in place is unrealistic; instead point the state at a second level view
    // whose floors outnumber the first cluster so pooled wall slots get recycled as floors.
    st = { ...st, levelView: farLevelView }
    const b = source.buildFrameSnapshot()
    for (const q of b.floorQuads) {
      expect(q.type).toBeUndefined()
      expect(q.fadeBox).toBeUndefined()
      expect(q.noFade).toBeUndefined()
    }
  })

  it('cullPaddingPx below the bucket size falls back to exact camera matching', () => {
    // t1 is inside the A window but its right edge (-340) falls out of the +16px B window;
    // t2 (x=460) enters only after the +16px move. Padding 0 → exact camera keys → the
    // small move must rebuild and swap the visible set (bucket mode would wrongly reuse).
    const t1 = makeDraw({ x: -420, y: -260, cellX: 0, cellY: 0 })
    const t2 = makeDraw({ x: 460, y: -260, cellX: 1, cellY: 0 })
    const levelView = makeLevelView([t1, t2], [])
    let st = { tick: 1, actId: 1 as const, levelId: 1, playerSubX: SUB_X, playerSubY: SUB_Y, ambient: null, levelView, units: [] }
    const source = new ClientWorldSceneSource(() => st, '800x600')
    const a = source.buildFrameSnapshot(0)
    expect(a.floorQuads.map(q => q.cellX)).toEqual([0])
    st = { ...st, playerSubX: SUB_X + 1 }
    const b = source.buildFrameSnapshot(0)
    // padding 0 → exact camera keys → 16px move must rebuild (set swaps t1 -> t2)
    expect(b.floorQuads.map(q => q.cellX)).toEqual([1])
  })
})
