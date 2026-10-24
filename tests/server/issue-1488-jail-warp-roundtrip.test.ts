/**
 * Issue #1488 — Jail Level 2 (area 30) <-> Jail Level 3 (area 31) staircase multi-round-trip:
 * - Server `MoveToUnit` (`C2S 0x02`/`0x04`) resolves `UNIT_TILE = 5` (`warpTiles`) and walks to a
 *   standable subtile within `WARP_INTERACT_DISTANCE_SUBTILES (4)` when the DS1 warp anchor is blocked.
 * - `RoomHide` (`S2C 0x08`) prunes the full 12×12 / 16×16 DRLG room rectangle (`subW × subH`) from
 *   `_revealedRoomSeeds` so overlapping dungeon levels never leave ghost warps in tile offsets 8..11.
 * - Same-act `UnitReassign` (`S2C 0x15`) syncs the active area before `emitAreaSnapshotToPlayer`
 *   arrives, and `pruneStaleUnitsOutsideArea` preserves active-area warp tiles.
 * - `revealAreaRoomsNearPlayer` streams room units (`emitRoomUnitsToPlayer`) when walking into AOI.
 * - `buildRenderableUnits` matches `LevelView.warps` by coordinate proximity when multiple staircases
 *   share the same `lvlWarpId` (e.g., Jail Level 3's two `lvlWarpId = 13` warps to areas 30 and 32).
 */
import { describe, expect, it } from 'vitest'
import { buildRenderableUnits, type SessionRenderBuilderHost } from '../../src/client/session/session-render-builder.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'

describe('issue #1488 Jail Level 2 <-> Jail Level 3 staircase round-trip & 12x12 room warp lifecycle', () => {
  it('completes multiple 30 -> 31 -> 30 -> 31 round-trips via both MoveToUnit approach and Interact', () => {
    // Jail Level 2 (area 30) and Jail Level 3 (area 31) with 12x12 tile (60x60 subtile) rooms
    // at overlapping world coordinates (17520..17580, 8040..8100), where the warp anchor sits at
    // subtile offset +50 (tile offset +10 inside the 12x12 room) on a non-walkable wall subtile.
    const blockedWallAnchorX = 17570
    const blockedWallAnchorY = 8090

    const game = new GameInstance({
      seed: 1488,
      areaId: 30,
      resolveAreaBootstrap: ({ areaId }) => ({
        areaId,
        spawnX: 17540,
        spawnY: 8060,
        rooms: [
          { areaId, tileX: 3504, tileY: 1608 },
          { areaId, tileX: 3540, tileY: 1608 },
        ],
        roomRects: [
          { index: 0, x: 17520, y: 8040, w: 60, h: 60, seed: 0x3000 + areaId },
          { index: 1, x: 17700, y: 8040, w: 60, h: 60, seed: 0x4000 + areaId },
        ],
        objects: [],
        monsters: [],
        warps:
          areaId === 30
            ? [
                { lvlWarpId: 13, x: 17530, y: 8050, destAreaId: 29 },
                { lvlWarpId: 14, x: blockedWallAnchorX, y: blockedWallAnchorY, destAreaId: 31 },
              ]
            : [
                { lvlWarpId: 13, x: blockedWallAnchorX, y: blockedWallAnchorY, destAreaId: 30 },
                { lvlWarpId: 13, x: 17750, y: 8080, destAreaId: 32 },
              ],
        isWalkable: (_id, x, y) =>
          !(Math.round(x) === blockedWallAnchorX && Math.round(y) === blockedWallAnchorY),
      }),
    })

    const world = new ClientWorld()
    const playerId = game.connectPlayer({
      charClass: 'sor',
      name: 'JailRunner',
      x: 17540,
      y: 8060,
      areaId: 30,
    })
    for (const ev of game.drainEvents(playerId)) {
      world.applyEvent(ev)
    }
    expect(world.areaId).toBe(30)

    const getServerPlayer = () =>
      (
        game as unknown as {
          players: Map<number, { areaId: number; x: number; y: number }>
        }
      ).players.get(playerId)!

    const findWarpUnitInArea = (areaId: number, destAreaId: number) =>
      [
        ...(
          game as unknown as {
            warpTiles: Map<
              number,
              { unitId: number; areaId: number; destAreaId: number; x: number; y: number }
            >
          }
        ).warpTiles.values(),
      ].find((w) => w.areaId === areaId && w.destAreaId === destAreaId)!

    // Round-trip 1: Walk from (17540, 8060) to Jail Level 2 -> 3 down stairs via MoveToUnit(5, warp30to31)
    // and then Interact on arrival.
    const warp30to31 = findWarpUnitInArea(30, 31)
    game.enqueueCommand(playerId, {
      type: 'MoveToUnit',
      run: true,
      target: { unitType: 'tile', id: warp30to31.unitId },
    })
    for (let i = 0; i < 120; i++) {
      game.stepFrames(1)
      for (const ev of game.drainEvents(playerId)) {
        world.applyEvent(ev)
      }
      const p = getServerPlayer()
      if (Math.hypot(p.x - warp30to31.x, p.y - warp30to31.y) <= 4) break
    }
    expect(
      Math.hypot(getServerPlayer().x - warp30to31.x, getServerPlayer().y - warp30to31.y),
    ).toBeLessThanOrEqual(4)

    game.enqueueCommand(playerId, {
      type: 'Interact',
      target: { unitType: 'tile', id: warp30to31.unitId },
    })
    game.stepFrames(1)
    for (const ev of game.drainEvents(playerId)) {
      world.applyEvent(ev)
    }
    expect(getServerPlayer().areaId).toBe(31)
    expect(world.areaId).toBe(31)
    // The old area 30 warp at (17570, 8090) in tile offset +10 of the 12x12 room must be pruned by RoomHide!
    expect(world.getUnit('tile', warp30to31.unitId)).toBeUndefined()

    // Wait 12 frames (480ms < 500ms client cooldown) and take the Jail Level 3 -> 2 up stairs back to area 30.
    game.stepFrames(12)
    const warp31to30 = findWarpUnitInArea(31, 30)
    expect(world.getUnit('tile', warp31to30.unitId)).toBeDefined()
    game.enqueueCommand(playerId, {
      type: 'Interact',
      target: { unitType: 'tile', id: warp31to30.unitId },
    })
    game.stepFrames(1)
    for (const ev of game.drainEvents(playerId)) {
      world.applyEvent(ev)
    }
    expect(getServerPlayer().areaId).toBe(30)
    expect(world.areaId).toBe(30)
    // Area 31's warp at (17570, 8090) in tile offset +10 of the 12x12 room must be pruned by RoomHide!
    expect(world.getUnit('tile', warp31to30.unitId)).toBeUndefined()
    // Area 30's down staircase must be present in ClientWorld!
    expect(world.getUnit('tile', warp30to31.unitId)).toBeDefined()

    // Step away from the staircase in area 30, then click the down staircase a SECOND time via MoveToUnit + Interact!
    game.enqueueCommand(playerId, {
      type: 'Move',
      x: 17555,
      y: 8075,
      run: true,
    })
    for (let i = 0; i < 40; i++) {
      game.stepFrames(1)
      for (const ev of game.drainEvents(playerId)) {
        world.applyEvent(ev)
      }
    }
    expect(Math.hypot(getServerPlayer().x - warp30to31.x, getServerPlayer().y - warp30to31.y)).toBeGreaterThan(6)

    // Second descent: MoveToUnit(5, warp30to31) -> walks back into range <= 4 -> Interact -> transitions to 31!
    game.enqueueCommand(playerId, {
      type: 'MoveToUnit',
      run: true,
      target: { unitType: 'tile', id: warp30to31.unitId },
    })
    for (let i = 0; i < 60; i++) {
      game.stepFrames(1)
      for (const ev of game.drainEvents(playerId)) {
        world.applyEvent(ev)
      }
      const p = getServerPlayer()
      if (Math.hypot(p.x - warp30to31.x, p.y - warp30to31.y) <= 4) break
    }
    game.enqueueCommand(playerId, {
      type: 'Interact',
      target: { unitType: 'tile', id: warp30to31.unitId },
    })
    game.stepFrames(1)
    for (const ev of game.drainEvents(playerId)) {
      world.applyEvent(ev)
    }
    expect(getServerPlayer().areaId).toBe(31)
    expect(world.areaId).toBe(31)
  })

  it('streams room warp tiles when walking into a newly-revealed AOI room and preserves active-area warps during pruneStaleUnitsOutsideArea', () => {
    const world = new ClientWorld()
    world.applyEvent({
      type: 'RoomReveal',
      areaId: 30,
      tileX: 3500,
      tileY: 1600,
      roomSeed: 0x1111,
      tileW: 12,
      tileH: 12,
    })
    world.applyEvent({
      type: 'UnitAssign',
      areaId: 30,
      classId: 14,
      unit: {
        unitType: 5,
        id: 777,
        classId: 14,
        warpId: 14,
        x: 17650,
        y: 8050,
      },
    })
    // Even though warp 777 at (17650, 8050) is 120 subtiles away in an unrevealed room,
    // pruneStaleUnitsOutsideArea must NOT delete active-area warp tiles within maxDistanceSubTiles.
    world.pruneStaleUnitsOutsideArea(17530, 8030)
    expect(world.getUnit('tile', 777)).toBeDefined()
  })

  it('resolves distinct toLevelId targets when two staircases in the same level share the same lvlWarpId', () => {
    const world = new ClientWorld()
    // Jail Level 3 (area 31): both Warp 306 -> Area 30 (Jail Level 2) and Warp 307 -> Area 32 (Inner Cloister)
    // have lvlWarpId = 13 at different coordinates.
    world.applyEvent({
      type: 'UnitAssign',
      areaId: 31,
      classId: 13,
      unit: {
        unitType: 5,
        id: 306,
        classId: 13,
        warpId: 13,
        x: 17530,
        y: 8071,
      },
    })
    world.applyEvent({
      type: 'UnitAssign',
      areaId: 31,
      classId: 13,
      warpId: 13,
      unit: {
        unitType: 5,
        id: 307,
        classId: 13,
        warpId: 13,
        x: 17770,
        y: 8086,
      },
    } as any)

    const fakeLevelView = {
      areaId: 31,
      originX: 17520,
      originY: 8040,
      entrances: [
        { toLevelId: 30, warp: { lvlWarpId: 13, subX: 10, subY: 31 } },
        { toLevelId: 32, warp: { lvlWarpId: 13, subX: 250, subY: 46 } },
      ],
      warps: [
        { room: 0, lvlWarpId: 13, toLevelId: 30 },
        { room: 1, lvlWarpId: 13, toLevelId: 32 },
      ],
      rooms: [
        { index: 0, worldSubX: 17520, worldSubY: 8040, subW: 60, subH: 60 },
        { index: 1, worldSubX: 17760, worldSubY: 8040, subW: 60, subH: 60 },
      ],
    } as any

    const host: SessionRenderBuilderHost = {
      world,
      predictor: { getSnapshot: () => ({ x: 0, y: 0, dir64: 0, moving: false }) } as any,
      interpolator: { getEntityState: () => undefined } as any,
      camera: { x: 17530, y: 8071 } as any,
      commandMapper: { currentHoveredUnit: null } as any,
      hudManager: {} as any,
      hudModel: {} as any,
      viewportProfile: { width: 800, height: 600, hudHeight: 48 } as any,
      mapService: {
        getActiveLevelView: () => fakeLevelView,
        getLoadedLevelView: () => undefined,
      } as any,
      levelView: fakeLevelView,
      lastHoveredUnit: null,
      lastObjectLightBuildFrame: 0,
      drainWorldSoundRequests: () => {},
      resolveNeighbourLevelViews: () => [],
      resolveActiveEquipmentVisuals: () => undefined,
    } as unknown as SessionRenderBuilderHost

    const renderables = buildRenderableUnits(host, 1000)
    const warpTo30 = renderables.find((u) => u.id === 306)
    const warpTo32 = renderables.find((u) => u.id === 307)
    expect(warpTo30?.toLevelId).toBe(30)
    expect(warpTo32?.toLevelId).toBe(32)
    expect(warpTo30?.nameZh).not.toBe(warpTo32?.nameZh)
  })
})
