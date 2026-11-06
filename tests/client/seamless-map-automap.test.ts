import { describe, expect, it } from 'vitest'
import { AutomapView } from '../../src/client/automap/automap-view.ts'
import { CommandMapper } from '../../src/client/input/command-mapper.ts'
import type { LevelDrawItem, LevelView } from '../../src/client/map/level-view.ts'
import type { MapService } from '../../src/client/map/map-service.ts'
import { LocalMovementPredictor } from '../../src/client/motion/predictor.ts'
import { OutboundRateLimiter } from '../../src/client/session/rate-limiter.ts'
import { HudModel } from '../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../src/client/ui/hud-manager.ts'
import { Minimap } from '../../src/client/ui/minimap.ts'
import {
  ClientWorldSceneSource,
  buildCollisionGridFromLevelView,
} from '../../src/client/view/scene-source.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { computeAutomapTilePixelCoords } from '../../src/common/formats/automap-table.ts'
import { COLLIDE_MASK_INVALID, COLLIDE_NONE, COLLIDE_WALL } from '../../src/common/world/d2map.ts'

function makeBorderTestLevelView(options: {
  areaId: number
  tileOriginX: number
  tileOriginY: number
  cellsX?: number
  cellsY?: number
  layerId?: number
  floors?: readonly LevelDrawItem[]
  walls?: readonly LevelDrawItem[]
  entrances?: LevelView['entrances']
}): LevelView {
  const cellsX = options.cellsX ?? 16
  const cellsY = options.cellsY ?? 16
  const subW = cellsX * 5
  const subH = cellsY * 5
  const subOriginX = options.tileOriginX * 5
  const subOriginY = options.tileOriginY * 5
  const walkable = new Uint8Array(subW * subH)
  walkable.fill(1)
  const blocked = new Uint8Array(subW * subH)
  const collision = new Uint16Array(subW * subH)
  collision.fill(COLLIDE_NONE)

  const nearCoords = computeAutomapTilePixelCoords(2, 2, 0)
  const farCoords = computeAutomapTilePixelCoords(12, 12, 0)

  return {
    id: options.areaId,
    areaId: options.areaId,
    levelId: options.areaId,
    act: 0,
    seed: 0x12345678,
    difficulty: 0,
    originX: subOriginX,
    originY: subOriginY,
    subOriginX,
    subOriginY,
    width: subW,
    height: subH,
    subWidth: subW,
    subHeight: subH,
    tileOriginX: options.tileOriginX,
    tileOriginY: options.tileOriginY,
    tileWidth: cellsX - 1,
    tileHeight: cellsY - 1,
    cellsX,
    cellsY,
    gridWidth: subW,
    gridHeight: subH,
    isoOriginX: subH * 16,
    isoOriginY: 0,
    collision,
    collisionMasks: collision,
    blocked,
    walkable,
    floors: options.floors ?? [],
    shadows: [],
    walls: options.walls ?? [],
    roofs: [],
    entrances: options.entrances ?? [],
    warps: [],
    landmarks: [],
    rooms: [
      {
        index: 0,
        areaId: options.areaId,
        tileX: options.tileOriginX,
        tileY: options.tileOriginY,
        tileW: 8,
        tileH: 8,
        localTileX: 0,
        localTileY: 0,
        subX: 0,
        subY: 0,
        subW: 40,
        subH: 40,
        worldSubX: subOriginX,
        worldSubY: subOriginY,
        revealed: true,
      },
      {
        index: 1,
        areaId: options.areaId,
        tileX: options.tileOriginX + 8,
        tileY: options.tileOriginY + 8,
        tileW: 8,
        tileH: 8,
        localTileX: 8,
        localTileY: 8,
        subX: 40,
        subY: 40,
        subW: 40,
        subH: 40,
        worldSubX: subOriginX + 40,
        worldSubY: subOriginY + 40,
        revealed: true,
      },
    ],
    spawnX: subOriginX + 10,
    spawnY: subOriginY + 10,
    automap: {
      layerId: options.layerId ?? 1,
      levelTypeId: 1,
      floors: [
        {
          cellNo: 5,
          xPixel: nearCoords.xPixel,
          yPixel: nearCoords.yPixel,
          cellX: 2,
          cellY: 2,
          fSaved: 0,
          weight: 0,
        },
        {
          cellNo: 6,
          xPixel: farCoords.xPixel,
          yPixel: farCoords.yPixel,
          cellX: 12,
          cellY: 12,
          fSaved: 0,
          weight: 0,
        },
      ],
      walls: [
        {
          cellNo: 42,
          xPixel: nearCoords.xPixel,
          yPixel: nearCoords.yPixel,
          cellX: 2,
          cellY: 2,
          fSaved: 0,
          weight: 0,
        },
      ],
      objects: [],
      extras: [],
    },
  } as unknown as LevelView
}

function makeFakeDrawItem(
  cellX: number,
  cellY: number,
  isoOriginX: number,
  isoOriginY = 0,
  style = 1,
  seq = 0,
): LevelDrawItem {
  const subX = cellX * 5
  const subY = cellY * 5
  const x = (subX - subY) * 16 + isoOriginX
  const y = (subX + subY) * 8 + isoOriginY
  return {
    cellX,
    cellY,
    x,
    y,
    library: 0,
    tile: style,
    mainIndex: style,
    subIndex: seq,
    frame: 0,
    order: cellX + cellY,
    roofHeight: 0,
    flags: 0,
    dt1Index: 0,
    tileIndex: 0,
    dt1Path: 'data/global/tiles/act1/town/floor.dt1',
    placement: {
      page: 0,
      x: 0,
      y: 0,
      width: 160,
      height: 80,
      act: 1,
      nonEmptyPixels: 0,
      hash: 'test',
    },
  } as unknown as LevelDrawItem
}

describe('Seamless Multi-Level Big Map & Automap Rendering (No Discrete Level Switch Required)', () => {
  it('projects neighbour LevelViews into the primary LevelView ortho coordinate space and deduplicates shared border cells', () => {
    // Area 1 (Rogue Encampment) at world tiles [0..15, 0..15] (sub [0..80, 0..80])
    // Area 2 (Blood Moor) adjacent at world tiles [15..30, 0..15] (sub [75..155, 0..80]), sharing border tile X = 15
    const townIsoOriginX = 80 * 16
    const moorIsoOriginX = 80 * 16

    const townView = makeBorderTestLevelView({
      areaId: 1,
      tileOriginX: 0,
      tileOriginY: 0,
      floors: [
        makeFakeDrawItem(14, 5, townIsoOriginX, 0, 1, 0),
        // Shared border cell at world tile (15, 5) -> town local (15, 5)
        makeFakeDrawItem(15, 5, townIsoOriginX, 0, 2, 0),
      ],
      entrances: [{ x: 15, y: 5, interiorX: 15, interiorY: 5, toLevelId: 2, side: null, kind: 'gate' }],
    })

    const moorView = makeBorderTestLevelView({
      areaId: 2,
      tileOriginX: 15,
      tileOriginY: 0,
      floors: [
        // Shared border cell at world tile (15, 5) -> moor local (0, 5) (must be deduplicated!)
        makeFakeDrawItem(0, 5, moorIsoOriginX, 0, 2, 0),
        // Blood Moor interior cell at world tile (16, 5) -> moor local (1, 5) -> projected town local (16, 5)
        makeFakeDrawItem(1, 5, moorIsoOriginX, 0, 3, 0),
      ],
      entrances: [{ x: 0, y: 5, interiorX: 0, interiorY: 5, toLevelId: 1, side: null, kind: 'gate' }],
    })

    // Mark town's border cell (15, 5) as void/unallocated in townView, but walkable in moorView
    const seamSubX = 75
    const seamSubY = 25
    townView.walkable[seamSubY * townView.subWidth + seamSubX] = 0
    townView.blocked[seamSubY * townView.subWidth + seamSubX] = 1
    townView.collision[seamSubY * townView.subWidth + seamSubX] = COLLIDE_MASK_INVALID

    const sceneSource = new ClientWorldSceneSource(() => ({
      levelView: townView,
      neighbourLevelViews: [moorView],
      playerSubX: 74,
      playerSubY: 25,
      ambient: null,
      units: [],
    }))

    // Walkability seamlessly queries moorView when townView has a border void cell or when subX is in moorView
    expect(sceneSource.isSubTileWalkable(75, 25)).toBe(true)
    expect(sceneSource.isSubTileWalkable(82, 25)).toBe(true)

    const snap = sceneSource.buildFrameSnapshot()
    // Should contain: town (14,5), shared border (15,5) once, and projected moor (16,5)
    expect(snap.floorQuads.length).toBe(3)
    const cells = snap.floorQuads.map((f) => `${f.cellX},${f.cellY}`)
    expect(cells).toContain('14,5')
    expect(cells).toContain('15,5')
    expect(cells).toContain('16,5')

    const projectedMoorTile = snap.floorQuads.find((f) => f.cellX === 16 && f.cellY === 5)!
    expect(projectedMoorTile).toBeDefined()
    // Exact ortho worldX/worldY in townView's coordinate space:
    // subX = 16 * 5 = 80, subY = 5 * 5 = 25 -> worldX = (80 - 25) * 16 + townIsoOriginX, worldY = (80 + 25) * 8
    expect(projectedMoorTile.worldX).toBe((80 - 25) * 16 + townIsoOriginX)
    expect(projectedMoorTile.worldY).toBe((80 + 25) * 8)

    // Lighting collision grid patches townView's void cell at (75, 25) using moorView's COLLIDE_NONE
    const collisionGrid = buildCollisionGridFromLevelView(townView, [moorView])
    expect(collisionGrid.collisionMasks![seamSubY * townView.subWidth + seamSubX]).toBe(COLLIDE_NONE)
    expect(collisionGrid.blocked[seamSubY * townView.subWidth + seamSubX]).toBe(0)
  })

  it('computes a continuous cross-border A* path across connected LevelViews in CommandMapper', () => {
    const townView = makeBorderTestLevelView({
      areaId: 1,
      tileOriginX: 0,
      tileOriginY: 0,
      entrances: [{ x: 15, y: 5, interiorX: 15, interiorY: 5, toLevelId: 2, side: null, kind: 'gate' }],
    })
    const moorView = makeBorderTestLevelView({
      areaId: 2,
      tileOriginX: 15,
      tileOriginY: 0,
      entrances: [{ x: 0, y: 5, interiorX: 0, interiorY: 5, toLevelId: 1, side: null, kind: 'gate' }],
    })

    // Block local border seam in townView at x=75..79 except where moorView overlaps at x=75..79
    for (let y = 0; y < townView.subHeight; y++) {
      for (let x = 75; x < 80; x++) {
        townView.walkable[y * townView.subWidth + x] = 0
        townView.blocked[y * townView.subWidth + x] = 1
        townView.collision[y * townView.subWidth + x] = COLLIDE_WALL
      }
    }

    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x12345678, areaId: 1 })
    world.apply({
      type: 'PlayerAssign',
      unitId: 1,
      classId: 0,
      name: 'Hero',
      x: 70,
      y: 25,
    })

    const mockMapService = {
      getActiveLevelView: () => townView,
      getConnectedLevelViews: () => [moorView],
      findAllLevelViewsAtWorldSubTile: (wx: number, wy: number) =>
        [townView, moorView].filter(
          (v) =>
            wx >= v.subOriginX &&
            wx < v.subOriginX + v.subWidth &&
            wy >= v.subOriginY &&
            wy < v.subOriginY + v.subHeight,
        ),
      findLevelViewAtWorldSubTile: (wx: number, wy: number) =>
        [moorView, townView].find(
          (v) =>
            wx >= v.subOriginX &&
            wx < v.subOriginX + v.subWidth &&
            wy >= v.subOriginY &&
            wy < v.subOriginY + v.subHeight,
        ) ?? null,
    } as unknown as MapService

    const hudManager = new HudManager()
    const predictor = new LocalMovementPredictor()
    predictor.setPosition(70, 25)
    const hudModel = new HudModel({ world, hudManager })
    const mapper = new CommandMapper({
      world,
      hudManager,
      hudModel,
      predictor,
      rateLimiter: new OutboundRateLimiter({ moveMinIntervalMs: 0 }),
      mapService: mockMapService,
    })

    // Trigger primary movement toward world sub-tile (90, 25) inside Blood Moor (area 2) while player is at (70, 25) in Town (area 1)
    const res = mapper.triggerPrimaryWorldAction(90, 25, null, 1000)

    expect(res).not.toBeNull()
    expect(res!.command.type).toBe('Move')
    expect(res!.path.length).toBeGreaterThan(0)
    const endPt = res!.path[res!.path.length - 1]!
    expect(endPt.x).toBe(90)
    expect(endPt.y).toBe(25)
  })

  it('updates world.areaId from RoomReveal without a MapService', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x12345678, areaId: 1 })
    world.apply({ type: 'PlayerAssign', unitId: 1, classId: 0, name: 'Hero', x: 80, y: 25 })
    world.apply({
      type: 'RoomReveal',
      areaId: 2,
      tileX: 15,
      tileY: 0,
      tileW: 8,
      tileH: 8,
      roomSeed: 1,
    })
    expect(world.areaId).toBe(2)
  })

  it('retains live monsters and ground items in adjacent revealed rooms across area borders', () => {
    const world = new ClientWorld()
    world.apply({ type: 'MapReveal', roomX: 0, roomY: 0, areaId: 1 })
    world.apply({ type: 'MapReveal', roomX: 15, roomY: 0, areaId: 2 })
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 0,
        x: 72,
        y: 20,
      },
    })
    // Live monster standing just across the border in Blood Moor (area 2, subX = 80, subY = 20)
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: {
        unitType: 'monster',
        id: 201,
        classId: 1,
        x: 80,
        y: 20,
        lifePct: 100,
        mode: 1,
      },
    })
    // Ground item lying just across the border in Blood Moor (area 2, subX = 82, subY = 20)
    world.apply({
      type: 'ItemAction',
      action: 0,
      container: 'ground',
      item: {
        id: 301,
        code: 'hpot',
        baseId: 587,
        category: 'misc',
        quality: 'normal',
        identified: true,
        ethereal: false,
        sockets: 0,
        socketedItems: [],
        container: 'ground',
        x: 82,
        y: 20,
        width: 1,
        height: 1,
        itemLevel: 1,
        stats: [],
      },
    })

    world.pruneStaleUnitsOutsideArea(72, 20)
    expect(world.getUnit('monster', 201)).toBeDefined()
    expect(world.containers.ground.has(301)).toBe(true)
  })

  it('stitches connected same-layer LevelViews in AutomapView and preserves exploration + pan in Minimap across borders', () => {
    const townView = makeBorderTestLevelView({
      areaId: 1,
      tileOriginX: 0,
      tileOriginY: 0,
      layerId: 1,
      entrances: [{ x: 15, y: 5, interiorX: 15, interiorY: 5, toLevelId: 2, side: null, kind: 'gate' }],
    })
    const moorView = makeBorderTestLevelView({
      areaId: 2,
      tileOriginX: 15,
      tileOriginY: 0,
      layerId: 1,
      entrances: [{ x: 0, y: 5, interiorX: 0, interiorY: 5, toLevelId: 1, side: null, kind: 'gate' }],
    })

    const mockMapService = {
      getActiveAct: () => 0,
      loadAct: () => townView,
      getLevelView: (areaId: number) => (areaId === 1 ? townView : moorView),
      peekLevelView: (areaId: number) => (areaId === 1 ? townView : moorView),
      getLoadedLevelView: (areaId: number) => (areaId === 1 ? townView : moorView),
      getConnectedLevelViews: (primaryAreaId: number) =>
        primaryAreaId === 1 ? [moorView] : [townView],
    } as unknown as MapService

    const automapView = new AutomapView({
      mapService: mockMapService,
      initialMode: 'off',
    })
    automapView.setContext(0x12345678, 0, 1, townView)

    const townMinimapLevel = automapView.buildMinimapLevel('ENG', 1)
    expect(townMinimapLevel.layerKey).toBe('automap_layer_305419896_0_1_1')
    expect(townMinimapLevel.tileOriginX).toBe(0)
    expect(townMinimapLevel.tileOriginY).toBe(0)
    // Stitched floors: 2 from townView + 2 from moorView = 4
    expect(townMinimapLevel.automap.floors.length).toBe(4)

    // Verify 1.13c pixel shift for moorView cell (2, 2) with dCellX = 15, dCellY = 0:
    // dxPixel = (15 - 0) * 8 = 120, dyPixel = (15 + 0) * 4 = 60
    const baseNear = computeAutomapTilePixelCoords(2, 2, 0)
    const stitchedMoorNear = townMinimapLevel.automap.floors.find(
      (c) => c.cellX === 17 && c.cellY === 2,
    )
    expect(stitchedMoorNear).toBeDefined()
    expect(stitchedMoorNear!.xPixel).toBe(baseNear.xPixel + 120)
    expect(stitchedMoorNear!.yPixel).toBe(baseNear.yPixel + 60)
    // In 'off' mode before Blood Moor room (15, 0) is revealed by server, stitchedMoorNear has preRevealed: false
    expect(stitchedMoorNear!.preRevealed).toBe(false)

    // Server reveals Blood Moor room (15, 0) while player is still in Town
    automapView.onServerAddRoom(15, 0, 2)
    const townWithMoorRoom = automapView.buildMinimapLevel('ENG', 1)
    const revealedMoorNear = townWithMoorRoom.automap.floors.find(
      (c) => c.cellX === 17 && c.cellY === 2,
    )
    const unrevealedMoorFar = townWithMoorRoom.automap.floors.find(
      (c) => c.cellX === 27 && c.cellY === 12,
    )
    expect(revealedMoorNear?.preRevealed).toBe(true)
    expect(unrevealedMoorFar?.preRevealed).toBe(false)

    // Verify Minimap exploration & manual pan persistence across area transition (1 -> 2)
    const minimap = new Minimap()
    minimap.mode = 'full'
    minimap.reveal(townWithMoorRoom, 14, 5, 70 * 16, 25 * 16, true)
    minimap.pan(32, -16)
    expect(minimap.panX).toBe(32)
    expect(minimap.panY).toBe(-16)

    // Transition into Blood Moor (area 2)
    automapView.syncActiveLevel(2, moorView)
    const moorMinimapLevel = automapView.buildMinimapLevel('ENG', 2)
    expect(moorMinimapLevel.layerKey).toBe(townWithMoorRoom.layerKey)
    expect(moorMinimapLevel.tileOriginX).toBe(15)
    expect(moorMinimapLevel.tileOriginY).toBe(0)

    // Town cells stitched into moorMinimapLevel have negative local cellX (2 - 15 = -13) and preRevealed: true
    const stitchedTownCell = moorMinimapLevel.automap.floors.find(
      (c) => c.cellX === -13 && c.cellY === 2,
    )
    expect(stitchedTownCell).toBeDefined()
    expect(stitchedTownCell!.preRevealed).toBe(true)

    // Border tile (world tile 15, 5 -> moor local cell 0, 5) was already explored in worldSet when player stood at (14, 5) in Town!
    expect(minimap.isCellExplored(moorMinimapLevel, 0, 5)).toBe(true)
  })

  it('labels only exits leading out of the current area, not a stitched neighbour exit back into it', () => {
    const townView = makeBorderTestLevelView({
      areaId: 1,
      tileOriginX: 0,
      tileOriginY: 0,
      layerId: 1,
      entrances: [{ x: 15, y: 5, interiorX: 15, interiorY: 5, toLevelId: 2, side: null, kind: 'gate' }],
    })
    const moorView = makeBorderTestLevelView({
      areaId: 2,
      tileOriginX: 15,
      tileOriginY: 0,
      layerId: 1,
      entrances: [
        { x: 0, y: 5, interiorX: 0, interiorY: 5, toLevelId: 1, side: null, kind: 'gate' },
        { x: 14, y: 9, interiorX: 14, interiorY: 9, toLevelId: 8, side: null, kind: 'preset' },
      ],
    })
    const viewFor = (areaId: number) => (areaId === 1 ? townView : moorView)
    const automapView = new AutomapView({
      mapService: {
        getActiveAct: () => 0,
        loadAct: () => townView,
        getLevelView: viewFor,
        peekLevelView: viewFor,
        getLoadedLevelView: viewFor,
        getConnectedLevelViews: (primaryAreaId: number) => (primaryAreaId === 1 ? [moorView] : [townView]),
      } as unknown as MapService,
      initialMode: 'off',
    })
    automapView.setContext(0x12345678, 0, 1, townView)

    const exits = automapView.buildMinimapLevel('ENG', 1).markers.filter((m) => m.kind === 'exit')
    expect(exits.map((m) => m.toLevelId).sort()).toEqual([2, 8])
  })
})
