import { describe, expect, it, vi } from 'vitest'
import { AutomapView } from '../../src/client/automap/automap-view.js'
import { NpcMotion } from '../../src/client/motion/npc-motion.js'
import { OnlineSession } from '../../src/client/session/online-session.js'
import { HudModel } from '../../src/client/ui-model/hud-model.js'
import { ClientWorld } from '../../src/client/world/client-world.js'

describe('Teleport stutter & progressive slowdown fixes (#882–#886)', () => {
  it('Issue #882: ClientWorld.getRevealedAreaIds returns a stable array reference and OnlineSession.resolveCollisionLevelView hits cache across RoomReveal', () => {
    const world = new ClientWorld()
    world.apply({ type: 'RoomReveal', tileX: 100, tileY: 100, areaId: 2 })
    const ref1 = world.getRevealedAreaIds()
    const ref2 = world.getRevealedAreaIds()
    expect(ref1).toBe(ref2)
    expect(ref1).toEqual([2])

    const fakeLevelView = {
      areaId: 2,
      originSubX: 0,
      originSubY: 0,
      subWidth: 1000,
      subHeight: 1000,
      sampleCollisionMask: () => 0,
    } as any
    const findLevelViewSpy = vi.fn(() => fakeLevelView)
    const mapService = {
      findLevelViewAtWorldSubTile: findLevelViewSpy,
      getActiveLevelView: () => fakeLevelView,
      getLoadedLevelView: () => fakeLevelView,
      ensureLevelView: () => fakeLevelView,
      onAddRoomDataPacket: vi.fn(),
      onRemoveRoomDataPacket: vi.fn(),
    } as any

    const session = new OnlineSession({ world, mapService })
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 2 })
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Sorc',
        x: 500,
        y: 500,
      },
    })

    const v1 = (session as any).resolveCollisionLevelView()
    const v2 = (session as any).resolveCollisionLevelView()
    expect(v1).toBe(fakeLevelView)
    expect(v2).toBe(fakeLevelView)
    expect(findLevelViewSpy).toHaveBeenCalledTimes(1)

    // Same-area RoomReveal invalidates _revealedAreaIdsCache array instance, but value is still [2];
    // resolveCollisionLevelView should still hit its cache without calling findLevelViewAtWorldSubTile again.
    world.apply({ type: 'RoomReveal', tileX: 140, tileY: 100, areaId: 2 })
    const v3 = (session as any).resolveCollisionLevelView()
    expect(v3).toBe(fakeLevelView)
    expect(findLevelViewSpy).toHaveBeenCalledTimes(1)
  })

  it('Issue #882: NpcMotion lazily samples terrain collision per queried cell and prunes distant synthetic rooms', () => {
    let terrainSamples = 0
    const motion = new NpcMotion({
      isSubTileBlocked: () => {
        terrainSamples++
        return false
      },
    })

    // Spawning a monster and refreshing synthetic obstacles must NOT eagerly scan 40x40=1600 cells per room.
    motion.spawnMonster({ unitId: 10, classId: 1, x: 500, y: 500, mode: 1 })
    motion.refreshSyntheticObstacles(true)
    expect(terrainSamples).toBeLessThan(20)

    // Simulate long multi-area teleporting across 120 distant synthetic rooms.
    for (let i = 0; i < 120; i++) {
      motion.spawnMonster({
        unitId: 1000 + i,
        classId: 1,
        x: i * 200,
        y: i * 200,
        mode: 1,
      })
      if (i < 118) {
        motion.removeMonster(1000 + i)
      }
    }
    expect(motion.getSyntheticRoomCount()).toBeLessThanOrEqual(100)

    // Clear resets all synthetic rooms (used on area transition).
    motion.clear()
    expect(motion.getSyntheticRoomCount()).toBe(0)
  })

  it('Issue #883: AutomapView indexes serverRevealedRooms by areaId and precomputes O(1) cell reveal bitmaps', () => {
    const automap = new AutomapView()
    // Populate 600 rooms across areas 1..5 to simulate a long multi-act session.
    for (let area = 1; area <= 5; area++) {
      for (let i = 0; i < 120; i++) {
        automap.onServerAddRoom(i * 8, i * 8, area, { notifyMapService: false })
      }
    }
    const fakeView = {
      areaId: 3,
      tileOriginX: 0,
      tileOriginY: 0,
      cellsX: 64,
      cellsY: 64,
      rooms: [{ tileX: 0, tileY: 0, tileW: 8, tileH: 8, localTileX: 0, localTileY: 0 }],
    } as any

    const pred = (automap as any).createServerRevealedCellPredicate(3, fakeView)
    expect(pred(4, 4)).toBe(true)
    expect(pred(40, 8)).toBe(false)

    automap.onServerRemoveRoom(0, 0, 3, { notifyMapService: false })
    const predAfterRemove = (automap as any).createServerRevealedCellPredicate(3, fakeView)
    expect(predAfterRemove(2, 2)).toBe(false)
  })

  it('Issue #884 & #885: OnlineSession.handleServerEvent avoids duplicate HudModel.syncFromWorld and duplicate MapService room notifications during teleport packet bursts', () => {
    const addRoomSpy = vi.fn()
    const removeRoomSpy = vi.fn()
    const ensureLevelViewSpy = vi.fn(() => undefined)
    const fakeView = {
      areaId: 2,
      originX: 0,
      originY: 0,
      width: 40,
      height: 40,
      originSubX: 0,
      originSubY: 0,
      subWidth: 200,
      subHeight: 200,
      rooms: [],
      presetUnits: [],
      warpTiles: [],
      getFloorTilesAt: () => [],
      getWallTilesAt: () => [],
      sampleCollisionMask: () => 0,
    } as any

    const mapService = {
      onLoadActPacket: vi.fn(),
      onAddRoomDataPacket: addRoomSpy,
      onRemoveRoomDataPacket: removeRoomSpy,
      getActiveLevelView: () => fakeView,
      getLoadedLevelView: (id: number) => (id === 2 ? fakeView : undefined),
      ensureLevelView: ensureLevelViewSpy,
      findLevelViewAtWorldSubTile: () => fakeView,
      getAct: () => 0,
      getMapSeed: () => 123,
    } as any

    const world = new ClientWorld()
    const session = new OnlineSession({ world, mapService })
    const hudModel = session.hudModel

    const fullSyncSpy = vi.spyOn(hudModel, 'syncFromWorld')
    const targetSyncSpy = vi.spyOn(hudModel, 'syncTargetMonsterFromWorld')

    session.handleServerEvent({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Sorc',
        x: 50,
        y: 50,
      },
    })
    session.handleServerEvent({ type: 'LoadAct', act: 0, mapSeed: 123, areaId: 2 })

    fullSyncSpy.mockClear()
    targetSyncSpy.mockClear()
    addRoomSpy.mockClear()
    removeRoomSpy.mockClear()
    ensureLevelViewSpy.mockClear()

    // Simulate a Teleport packet burst: 18 RoomReveal, 18 RoomHide, 30 Monster/Object UnitAssign, 20 UnitRemove, 10 Monster StateSet
    for (let i = 0; i < 18; i++) {
      session.handleServerEvent({ type: 'RoomReveal', tileX: i * 8, tileY: 0, areaId: 2 })
      session.handleServerEvent({ type: 'RoomHide', tileX: (i + 20) * 8, tileY: 0, areaId: 2 })
    }
    for (let i = 0; i < 20; i++) {
      session.handleServerEvent({
        type: 'UnitAssign',
        unit: { unitType: 'monster', id: 200 + i, classId: 1, x: 60 + i, y: 60 },
      })
      session.handleServerEvent({
        type: 'StateSet',
        unit: { unitType: 'monster', id: 200 + i },
        state: 1,
        states: [{ state: 1, complete: true }],
      })
    }
    for (let i = 0; i < 10; i++) {
      session.handleServerEvent({
        type: 'UnitAssign',
        unit: { unitType: 'object', id: 500 + i, classId: 1, mode: 0, x: 70 + i, y: 70 },
      })
    }
    for (let i = 0; i < 20; i++) {
      session.handleServerEvent({
        type: 'UnitRemove',
        unitType: 'monster',
        id: 200 + i,
      })
    }

    // MapService must be notified exactly once per RoomReveal/RoomHide (not duplicated by AutomapView),
    // and getLoadedLevelView should prevent redundant ensureLevelView calls.
    expect(addRoomSpy).toHaveBeenCalledTimes(18)
    expect(removeRoomSpy).toHaveBeenCalledTimes(18)
    expect(ensureLevelViewSpy).toHaveBeenCalledTimes(0)

    // None of the same-area RoomReveal/RoomHide or non-merc monster/object UnitAssign/UnitRemove/StateSet
    // events should trigger a full HudModel.syncFromWorld() rebuild!
    expect(fullSyncSpy).toHaveBeenCalledTimes(0)
    expect(targetSyncSpy.mock.calls.length).toBeGreaterThan(0)
  })

  it('Issue #886: ClientWorld.pruneNonSelfUnitsOnAreaTransition clears object collision footprints and resets NpcMotion rooms', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 1, areaId: 2 })
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: { unitType: 'player', id: 1, classId: 1, name: 'Sorc', x: 100, y: 100 },
    })

    // Assign a solid chest/shrine object (classId 2 has HasCollision[0]=1, SizeX=2, SizeY=2 in Objects.txt)
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 'object', id: 777, classId: 2, mode: 0, x: 120, y: 120 },
    })
    expect(world.isSubTileBlocked(120, 120)).toBe(true)
    expect(world.hasExplicitBlockedSubTiles()).toBe(true)

    // Spawn a monster so NpcMotion allocates synthetic rooms
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 'monster', id: 888, classId: 1, x: 130, y: 130 },
    })
    expect(world.npcMotion.getSyntheticRoomCount()).toBeGreaterThan(0)

    // Transitioning area prunes non-self units via removeNonSelfUnit
    world.pruneNonSelfUnitsOnAreaTransition()

    // Object collision footprint and NpcMotion synthetic rooms must both be cleaned up!
    expect(world.isSubTileBlocked(120, 120)).toBe(false)
    expect(world.hasExplicitBlockedSubTiles()).toBe(false)
    expect(world.npcMotion.getSyntheticRoomCount()).toBe(0)
  })
})
