import { describe, expect, it, vi } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { ClientWorldSceneSource } from '../../src/client/view/scene-source.ts'
import { renderSceneSourceFrame } from '../../src/client/scene/world-renderer.ts'
import { AutomapView } from '../../src/client/automap/automap-view.ts'
import type { LevelView } from '../../src/client/map/level-view.ts'
import { LightGrid } from '../../src/common/drlg/light-grid.ts'

function createMockLevelView(areaId = 1, act = 0): LevelView {
  const cellsX = 16
  const cellsY = 16
  const gridWidth = cellsX * 5
  const gridHeight = cellsY * 5
  return {
    act,
    areaId,
    seed: 12345,
    difficulty: 0,
    tileOriginX: 0,
    tileOriginY: 0,
    subOriginX: 0,
    subOriginY: 0,
    isoOriginX: 0,
    isoOriginY: 0,
    cellsX,
    cellsY,
    gridWidth,
    gridHeight,
    blocked: new Uint8Array(gridWidth * gridHeight),
    collisionMasks: new Uint16Array(gridWidth * gridHeight),
    rooms: [
      {
        tileX: 0,
        tileY: 0,
        tileW: 8,
        tileH: 8,
        subX: 0,
        subY: 0,
        subW: 40,
        subH: 40,
        revealed: true,
      },
    ],
    floors: [],
    shadows: [],
    walls: [],
    roofs: [],
    presets: [],
    warps: [],
    entrances: [],
    automap: {
      floors: [{ xPixel: 0, yPixel: 0, celIndex: 1, cellX: 2, cellY: 2 }],
      walls: [],
      objects: [],
      extras: [],
    },
  } as unknown as LevelView
}

describe('Issue #810: Progressive map/act switch lag fixes', () => {
  it('prunes non-self units, corpses, ground items, portals, and revealed rooms on LoadAct area transition while preserving self player and inventory', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x1111, areaId: 1 })
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Hero',
        x: 50,
        y: 50,
        lifePct: 128,
        mode: 5,
      },
    })
    world.apply({
      type: 'RoomReveal',
      areaId: 2,
      tileX: 10,
      tileY: 10,
    })
    // Spawn monsters and dead corpses in Blood Moor (area 2)
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: {
        unitType: 'monster',
        id: 201,
        classId: 1,
        x: 60,
        y: 60,
        lifePct: 0,
        mode: 12,
      },
    })
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: {
        unitType: 'monster',
        id: 202,
        classId: 2,
        x: 65,
        y: 65,
        lifePct: 128,
        mode: 1,
      },
    })
    // Drop a ground item and add an inventory item
    world.apply({
      type: 'Item',
      action: 0,
      container: 'ground',
      item: {
        id: 501,
        code: 'hp1',
        classId: 587,
        quality: 2,
        x: 62,
        y: 62,
        width: 1,
        height: 1,
      },
    })
    world.apply({
      type: 'Item',
      action: 4,
      container: 'inventory',
      item: {
        id: 502,
        code: 'mp1',
        classId: 592,
        quality: 2,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    })

    expect(world.getUnit('monster', 201)).toBeDefined()
    expect(world.getUnit('monster', 202)).toBeDefined()
    expect(world.containers.ground.has(501)).toBe(true)
    expect(world.containers.inventory.has(502)).toBe(true)

    // Switch to Act 2 Lut Gholein (areaId = 40)
    world.apply({ type: 'LoadAct', act: 1, mapSeed: 0x1111, areaId: 40 })

    expect(world.getUnit('player', 1)).toBeDefined()
    expect(world.getUnit('monster', 201)).toBeUndefined()
    expect(world.getUnit('monster', 202)).toBeUndefined()
    expect(world.monsters.size).toBe(0)
    expect(world.containers.ground.size).toBe(0)
    expect(world.containers.allById.has(501)).toBe(false)
    // Inventory item must be preserved
    expect(world.containers.inventory.has(502)).toBe(true)
    expect(world.revealedRooms.size).toBe(0)
  })

  it('prunes dead corpses and units inside an 8x8 tile room when RoomHide (0x08) unloads that room', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x2222, areaId: 2 })
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Hero',
        x: 110,
        y: 110,
        lifePct: 128,
        mode: 1,
      },
    })
    // Reveal two 8x8 tile rooms: room A at (10, 10) -> subTiles [50..89], room B at (20, 20) -> subTiles [100..139]
    world.apply({ type: 'RoomReveal', areaId: 2, tileX: 10, tileY: 10 })
    world.apply({ type: 'RoomReveal', areaId: 2, tileX: 20, tileY: 20 })

    // Corpse in room A (subTile 60, 60 -> tile 12, 12)
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: {
        unitType: 'monster',
        id: 301,
        classId: 1,
        x: 60,
        y: 60,
        lifePct: 0,
        mode: 12,
      },
    })
    // Ground item in room A (subTile 65, 65 -> tile 13, 13)
    world.apply({
      type: 'Item',
      action: 0,
      container: 'ground',
      item: {
        id: 601,
        code: 'gld',
        classId: 523,
        quality: 1,
        x: 65,
        y: 65,
        width: 1,
        height: 1,
      },
    })
    // Monster in room B (subTile 115, 115 -> tile 23, 23)
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: {
        unitType: 'monster',
        id: 302,
        classId: 5,
        x: 115,
        y: 115,
        lifePct: 128,
        mode: 1,
      },
    })

    // Server sends RoomHide for room A (tile 10, 10)
    world.apply({ type: 'RoomHide', areaId: 2, tileX: 10, tileY: 10 })

    expect(world.getUnit('monster', 301)).toBeUndefined()
    expect(world.containers.ground.has(601)).toBe(false)
    // Monster in still-revealed room B and local player are preserved
    expect(world.getUnit('monster', 302)).toBeDefined()
    expect(world.getUnit('player', 1)).toBeDefined()
  })

  it('invokes stateProvider() strictly once per renderSceneSourceFrame and culls off-screen entities', () => {
    const levelView = createMockLevelView(1, 0)
    let stateProviderCalls = 0
    const source = new ClientWorldSceneSource(() => {
      stateProviderCalls += 1
      return {
        tick: 10,
        actId: 1,
        levelId: 1,
        playerSubX: 20,
        playerSubY: 20,
        ambient: null,
        levelView,
        units: [
          {
            id: 1,
            kind: 'player',
            classId: 1,
            x: 20,
            y: 20,
            mode: 5,
            direction: 0,
            hpRatio: 1,
            isLocalPlayer: true,
          },
          // Far-away corpse outside camera frustum
          {
            id: 999,
            kind: 'monster',
            classId: 1,
            x: 400,
            y: 400,
            mode: 12,
            direction: 0,
            hpRatio: 0,
            isCorpse: true,
          },
        ],
      }
    })

    const drawCalls: number[] = []
    const mockRenderer = {
      begin: vi.fn(),
      setLighting: vi.fn(),
      draw: vi.fn((_rect: unknown, x: number) => {
        drawCalls.push(x)
      }),
      drawSolidRect: vi.fn(),
      drawLine: vi.fn(),
      flush: vi.fn(),
    }

    renderSceneSourceFrame({
      source,
      renderer: mockRenderer as any,
      lightingPreset: 'off',
      lightingTargets: {
        lightGrid: new LightGrid(),
        renderer: {
          setLighting: vi.fn(),
        },
      },
    })

    // Previously stateProvider() was called 8 times per frame; now strictly 1 time!
    expect(stateProviderCalls).toBe(1)
  })

  it('prunes stale corpses, transient missiles, and far-away ground items via pruneStaleUnitsOutsideArea', () => {
    const world = new ClientWorld()
    world.apply({ type: 'LoadAct', act: 0, mapSeed: 0x3333, areaId: 3 })
    world.apply({
      type: 'UnitAssign',
      isSelf: true,
      unit: {
        unitType: 'player',
        id: 1,
        classId: 1,
        name: 'Hero',
        x: 500,
        y: 500,
        lifePct: 128,
        mode: 1,
      },
    })
    // Nearby live monster in Cold Plains (area 3)
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: {
        unitType: 'monster',
        id: 401,
        classId: 1,
        x: 510,
        y: 510,
        lifePct: 128,
        mode: 1,
      },
    })
    // Stale corpse left far behind in Blood Moor (area 2)
    world.apply({
      type: 'UnitAssign',
      isSelf: false,
      unit: {
        unitType: 'monster',
        id: 402,
        classId: 1,
        x: 100,
        y: 100,
        lifePct: 0,
        mode: 12,
      },
    })
    // Transient missile
    world.spawnMissileByKey('firebolt', 490, 490, 505, 505)

    const pruned = world.pruneStaleUnitsOutsideArea(500, 500)
    expect(pruned).toBeGreaterThanOrEqual(2)
    expect(world.getUnit('player', 1)).toBeDefined()
    expect(world.getUnit('monster', 401)).toBeDefined()
    expect(world.getUnit('monster', 402)).toBeUndefined()
    expect(world.getUnitsByType('missile').length).toBe(0)
  })

  it('caches AutomapView.buildMinimapLevel across frames until room/mode/level state mutates', () => {
    const view = createMockLevelView(1, 0)
    const automapView = new AutomapView({ initialMode: 'off' })
    automapView.setContext(12345, 0, 1, view)

    const first = automapView.buildMinimapLevel('ENG', 1)
    const second = automapView.buildMinimapLevel('ENG', 1)
    expect(second).toBe(first)

    // Revealing a room invalidates the cached MinimapLevel
    automapView.onServerAddRoom(0, 0, 1)
    const third = automapView.buildMinimapLevel('ENG', 1)
    expect(third).not.toBe(first)

    const fourth = automapView.buildMinimapLevel('ENG', 1)
    expect(fourth).toBe(third)
  })
})
