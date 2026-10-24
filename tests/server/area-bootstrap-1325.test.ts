/**
 * Issue #1325 — area bootstrap lives in the game server and runs on demand.
 *
 * `GameInstance` brings areas online through the server-side resolver (`src/server/world/area-bootstrap.ts`)
 * at game entry and on waypoint / town portal / warp transitions, placing the player on standable floor
 * of the target area (waypoint, the warp leading back, town entry) and sending LoadAct → MapAdd rooms →
 * reassign → the area's units. `LocalLoopbackAdapter` no longer runs the bootstrap itself.
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { MONSTATS_113C_ROWS } from '../../src/common/units/monsters-data.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { LocalLobbyProvider, LocalLoopbackAdapter } from '../../src/server/loopback-adapter.ts'
import {
  buildAreaBootstrap,
  createAreaBootstrapResolver,
  findStandableNear,
  isLevelSubTileWalkable,
} from '../../src/server/world/area-bootstrap.ts'
import type {
  LocalAreaLevelGeometry,
  LocalAreaLevelSource,
  ServerEvent,
} from '../../src/netproto/index.ts'

const WAYPOINT_ACT1_TOWN = 119 // Objects.txt 119 waypoint (Rogue Encampment)
const WAYPOINT_ACT1_WILD = 157
const AKARA = 148
const FALLEN = 19

/**
 * Synthetic 60x60 sub-tile level at world origin `(ox, oy)`: open floor with a solid 10x10 block in the
 * middle (so the geometric centre is not walkable), plus preset units and warps.
 */
function level(
  areaId: number,
  ox: number,
  oy: number,
  extra: Partial<Pick<LocalAreaLevelGeometry, 'presetUnits' | 'warps'>> = {},
): LocalAreaLevelGeometry {
  const w = 60
  const h = 60
  const blocked = new Uint8Array(w * h)
  for (let y = 25; y < 35; y++) for (let x = 25; x < 35; x++) blocked[y * w + x] = 1
  return {
    areaId,
    originX: ox,
    originY: oy,
    subWidth: w,
    subHeight: h,
    blocked,
    spawnTileX: 6, // sub-tile 32 = inside the solid block
    spawnTileY: 6,
    rooms: [
      { areaId, tileX: ox / 5, tileY: oy / 5 },
      { areaId, tileX: ox / 5 + 8, tileY: oy / 5 },
    ],
    roomRects: [],
    presetUnits: extra.presetUnits ?? [],
    warps: extra.warps ?? [],
  }
}

/** Rogue Encampment (1) ↔ Blood Moor (2) via a warp pair, Cold Plains (3) with a waypoint. */
function worldSource(builds: number[]): LocalAreaLevelSource {
  const levels = new Map<number, LocalAreaLevelGeometry>([
    [
      1,
      level(1, 1000, 1000, {
        presetUnits: [
          { type: 2, index: WAYPOINT_ACT1_TOWN, mode: 0, subX: 10, subY: 10 },
          { type: 1, index: AKARA, mode: 0, subX: 40, subY: 40 },
        ],
        warps: [{ lvlWarpId: 3, subX: 50, subY: 50, toLevelId: 2 }],
      }),
    ],
    [
      2,
      level(2, 2000, 2000, {
        presetUnits: [{ type: 1, index: FALLEN, mode: 1, subX: 45, subY: 15 }],
        warps: [{ lvlWarpId: 4, subX: 8, subY: 52, toLevelId: 1 }],
      }),
    ],
    [3, level(3, 3000, 3000, { presetUnits: [{ type: 2, index: WAYPOINT_ACT1_WILD, mode: 0, subX: 30, subY: 50 }] })],
  ])
  return (request) => {
    builds.push(request.areaId)
    return levels.get(request.areaId) ?? null
  }
}

function eventTypes(events: readonly ServerEvent[]): string[] {
  return events.map((e) => e.type)
}

describe('Issue #1325 — server-side area bootstrap resolver', () => {
  it('classifies presets with canonical tables, keeps warps and grounds the spawn on standable floor', () => {
    const geo = level(1, 1000, 1000, {
      presetUnits: [
        { type: 2, index: WAYPOINT_ACT1_TOWN, mode: 0, subX: 10, subY: 10 },
        { type: 2, index: -1, mode: 0, subX: 11, subY: 11 },
        { type: 2, index: 573, mode: 0, subX: 12, subY: 12 },
        { type: 1, index: AKARA, mode: 0, subX: 40, subY: 40 },
        // SuperUniques.txt preset (index past MonStats.txt): never spawned in towns.
        { type: 1, index: MONSTATS_113C_ROWS.length, mode: 0, subX: 41, subY: 41 },
      ],
      warps: [{ lvlWarpId: 3, subX: 50, subY: 50, toLevelId: 2 }],
    })
    const b = buildAreaBootstrap(geo)
    expect(b.objects).toEqual([
      { classId: WAYPOINT_ACT1_TOWN, x: 1010, y: 1010, areaId: 1, mode: 1, isWaypoint: true },
    ])
    expect(b.monsters).toHaveLength(1)
    expect(b.monsters[0]).toMatchObject({ classId: AKARA, isNpc: true, isVendor: true, isKillable: false })
    expect(b.warps).toEqual([{ lvlWarpId: 3, x: 1050, y: 1050, destAreaId: 2 }])
    // DRLG start (1032, 1032) is inside the solid block: the spawn moves to the nearest standable floor.
    const walk = (x: number, y: number): boolean => isLevelSubTileWalkable(geo, x, y)
    expect(walk(1032, 1032)).toBe(false)
    expect(walk(b.spawnX, b.spawnY)).toBe(true)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) expect(walk(b.spawnX + dx, b.spawnY + dy)).toBe(true)
    // Collision is per area; another area id or outside the grid is void.
    expect(b.isWalkable(1, 1001, 1001)).toBe(true)
    expect(b.isWalkable(2, 1001, 1001)).toBe(false)
    expect(b.isWalkable(1, 999, 1001)).toBe(false)
  })

  it('wild monsters are killable and AI-driven; wild waypoints start inactive', () => {
    const b = buildAreaBootstrap(
      level(3, 3000, 3000, {
        presetUnits: [
          { type: 2, index: WAYPOINT_ACT1_WILD, mode: 0, subX: 30, subY: 50 },
          { type: 1, index: FALLEN, mode: 1, subX: 5, subY: 5 },
          { type: 1, index: MONSTATS_113C_ROWS.length, mode: 0, subX: 40, subY: 10 },
        ],
      }),
    )
    // SuperUniques.txt row 0 (Bishibosh) keeps its row index for the boss + minions spawn.
    expect(b.monsters[1]).toMatchObject({ superUniqueIndex: 0, x: 3040, y: 3010 })
    expect(b.objects[0]).toMatchObject({ isWaypoint: true, mode: 0 })
    expect(b.monsters[0]).toMatchObject({ isNpc: false, isVendor: false, isKillable: true, aiDisabled: false })
  })

  it('refuses inconsistent level sources and void-only levels', () => {
    const resolver = createAreaBootstrapResolver(() => level(5, 0, 0))
    expect(() => resolver({ act: 0, areaId: 4, mapSeed: 1, difficulty: 0 })).toThrow(/level 5/)
    const solid = { ...level(4, 0, 0), blocked: new Uint8Array(60 * 60).fill(1) }
    expect(() => createAreaBootstrapResolver(() => solid)({ act: 0, areaId: 4, mapSeed: 1, difficulty: 0 })).toThrow(
      /no standable floor/,
    )
    expect(findStandableNear(() => false, 0, 0)).toBeNull()
  })
})

describe('Issue #1325 — GameInstance loads target areas on demand', () => {
  function startGame(builds: number[]) {
    const game = new GameInstance({
      mode: 'singlePlayer',
      mapSeed: 0x1234,
      resolveAreaBootstrap: createAreaBootstrapResolver(worldSource(builds)),
    })
    const pid = game.connectPlayer({ charName: 'Wanderer', classId: 4, areaId: 1 })
    return { game, pid }
  }

  it('game entry loads only the entry area and sends LoadAct → MapAdd rooms before the player', () => {
    const builds: number[] = []
    const { game, pid } = startGame(builds)
    expect(builds).toEqual([1])
    expect(game.isAreaLoaded(1)).toBe(true)
    expect(game.isAreaLoaded(2)).toBe(false)
    const events = game.drainEvents(pid)
    const types = eventTypes(events)
    const loadAct = types.indexOf('LoadAct')
    expect(types.slice(loadAct + 1, loadAct + 3)).toEqual(['RoomReveal', 'RoomReveal'])
    const self = events.find((e) => e.type === 'PlayerAssign') as { x: number; y: number }
    expect(self.x).not.toBe(128)
    // Warp tile of the entry area is assigned (S2C 0x09 → UnitAssign UNIT_TILE).
    const tile = events.find(
      (e) => e.type === 'UnitAssign' && (e as { unit?: { unitType?: unknown } }).unit?.unitType === 5,
    ) as { unit: { classId: number; x: number; y: number } } | undefined
    expect(tile?.unit).toMatchObject({ classId: 3, x: 1050, y: 1050 })
  })

  it('a warp tile interaction loads the destination and lands at the warp leading back', () => {
    const builds: number[] = []
    const { game, pid } = startGame(builds)
    game.drainEvents(pid)
    const [warp] = game.listWarpTiles(1)
    expect(warp).toBeDefined()
    const actor = (game as unknown as {
      players: Map<number, { x: number; y: number }>
    }).players.get(pid)!
    actor.x = warp!.x
    actor.y = warp!.y
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 5, id: warp!.unitId } } as never)
    game.stepFrame()
    expect(builds).toEqual([1, 2])
    expect(game.isAreaLoaded(2)).toBe(true)
    const events = game.drainEvents(pid)
    const types = eventTypes(events)
    // Same-act transition: no LoadAct (client keeps its act environment).
    expect(types).not.toContain('LoadAct')
    const reassignIdx = types.indexOf('UnitReassign')
    expect(reassignIdx).toBeGreaterThanOrEqual(0)
    expect(types.slice(0, reassignIdx)).toContain('RoomReveal')
    const reassign = events[reassignIdx] as { x: number; y: number }
    // Blood Moor's warp back to the Rogue Encampment is at (2008, 2052).
    expect(Math.hypot(reassign.x - 2008, reassign.y - 2052)).toBeLessThanOrEqual(3)
    // The destination's units (the Fallen) follow the reassign.
    expect(
      events.slice(reassignIdx + 1).some((e) => e.type === 'UnitAssign' && (e as { unitType?: string }).unitType === 'monster'),
    ).toBe(true)

    // Back through Blood Moor's warp: the encampment is not rebuilt, landing at its warp to Blood Moor.
    const [back] = game.listWarpTiles(2)
    game.stepFrames(13) // 500 ms warp click cooldown
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 5, id: back!.unitId } } as never)
    game.stepFrame()
    expect(builds).toEqual([1, 2])
    const ev2 = game.drainEvents(pid)
    const r2 = ev2.find((e) => e.type === 'UnitReassign') as { x: number; y: number }
    expect(Math.hypot(r2.x - 1050, r2.y - 1050)).toBeLessThanOrEqual(3)
  })

  it('WaypointGo lands on the target waypoint; Town Portal lands at the town entry', () => {
    const builds: number[] = []
    const { game, pid } = startGame(builds)
    game.drainEvents(pid)
    const st = game.getPlayerState(pid)!
    // Fresh characters own only the town waypoint; grant Cold Plains as if activated.
    ;(game as unknown as { players: Map<number, { waypoints: Set<number> }> }).players
      .get(pid)!
      .waypoints.add(3)
    const wp = game.spawnObject({ classId: 119, x: st.x, y: st.y, areaId: 1, isWaypoint: true })
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: wp })
    game.stepFrame()
    game.drainEvents(pid)
    game.enqueueCommand(pid, { type: 'WaypointGo', waypointId: 0, destAreaId: 3 })
    game.stepFrame()
    expect(builds).toEqual([1, 3])
    const events = game.drainEvents(pid)
    const reassign = events.find((e) => e.type === 'UnitReassign') as { x: number; y: number }
    expect(Math.hypot(reassign.x - 3030, reassign.y - 3050)).toBeLessThanOrEqual(3)

    ;(game as unknown as { players: Map<number, { items: any[] }> }).players.get(pid)!.items.push({
      unitId: 9001,
      code: 'tsc',
      location: 'inventory',
      x: 0,
      y: 0,
      quantity: 1,
      stats: new Map(),
      socketedItems: [],
    })
    game.enqueueCommand(pid, { type: 'TownPortal' } as never)
    game.stepFrame()
    const portalEv = game.drainEvents(pid).find((e) => e.type === 'Portal') as { portalId: number }
    expect(portalEv).toBeDefined()
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: portalEv.portalId })
    game.stepFrame()
    const tp = game.drainEvents(pid)
    // Town Portal to Act 1 stays in the same act: no LoadAct reload.
    expect(tp.some((e) => e.type === 'LoadAct')).toBe(false)
    const landing = tp.find((e) => e.type === 'UnitReassign') as { x: number; y: number }
    const entry = buildAreaBootstrap(worldSourceLevel(1))
    expect({ x: landing.x, y: landing.y }).toEqual({ x: entry.spawnX, y: entry.spawnY })
  })

  it('a transition into an area the resolver cannot build rolls back and notifies the client', () => {
    const builds: number[] = []
    const { game, pid } = startGame(builds)
    const record = (game as unknown as {
      players: Map<number, { areaId: number; waypoints: Set<number>; unlockedAct: number }>
    }).players.get(pid)!
    record.waypoints.add(40)
    record.unlockedAct = 1 // Act 2 reached
    const st = game.getPlayerState(pid)!
    const wp = game.spawnObject({ classId: 119, x: st.x, y: st.y, areaId: 1, isWaypoint: true })
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: wp })
    game.stepFrame()
    game.enqueueCommand(pid, { type: 'WaypointGo', waypointId: 0, destAreaId: 40 })
    expect(() => game.stepFrame()).not.toThrow()
    expect(record.areaId).toBe(1)
    expect(
      game.drainEvents(pid).some(
        (e) => e.type === 'Chat' && e.kind === 'system' && e.text.includes('area 40'),
      ),
    ).toBe(true)
  })
})

function worldSourceLevel(areaId: number): LocalAreaLevelGeometry {
  const geo = worldSource([])({ act: 0, areaId, mapSeed: 0, difficulty: 0 })
  if (!geo) throw new Error(`no synthetic level ${areaId}`)
  return geo
}

describe('Issue #1325 — LocalLoopbackAdapter delegates the bootstrap to GameInstance', () => {
  it('LocalLobbyProvider.enterGame wires the level source into the game server', async () => {
    const builds: number[] = []
    const lobby = new LocalLobbyProvider()
    await lobby.createCharacter({ name: 'Kashya', classId: 0 })
    const adapter = (await lobby.enterGame({
      charName: 'Kashya',
      difficulty: 0,
      areaLevelSource: worldSource(builds),
    })) as LocalLoopbackAdapter
    const game = adapter.getGameInstance()
    expect(builds).toEqual([1])
    expect(game.isAreaLoaded(1)).toBe(true)
    const events: ServerEvent[] = []
    adapter.onEvent((e) => events.push(e))
    adapter.connect()
    const types = eventTypes(events)
    expect(types[types.indexOf('LoadAct') + 1]).toBe('RoomReveal')
    adapter.leave()
  })
})

describe('Issue #1325 — full 1.13c level spectrum through the MapService DRLG host', () => {
  it('every level bootstraps on standable floor, every warp has a warp back, every waypoint level has a waypoint', async () => {
    const packedDir = path.resolve(process.cwd(), 'public/act-packs/tiles')
    if (!fs.existsSync(path.join(packedDir, 'drlg-bundle.json'))) return
    await import('../../tools/lib/node-map-loader.ts')
    const { MapService } = await import('../../src/client/map/map-service.ts')
    const { createMapServiceAreaLevelSource } = await import('../../src/client/map/map-service-area-source.ts')
    const { DRLG_GetActNoFromLevelId } = await import('../../src/common/drlg/drlg-drlg.ts')
    const svc = await MapService.fromPackedDir('public/act-packs/tiles')
    const resolver = createAreaBootstrapResolver(createMapServiceAreaLevelSource(svc))
    const boots = new Map<number, ReturnType<typeof buildAreaBootstrap>>()
    for (let areaId = 1; areaId <= 136; areaId++) {
      const b = resolver({ act: DRLG_GetActNoFromLevelId(areaId), areaId, mapSeed: 0x12345678, difficulty: 0 })
      expect(b, `level ${areaId}`).toBeTruthy()
      expect(b!.isWalkable(areaId, b!.spawnX, b!.spawnY), `level ${areaId} spawn`).toBe(true)
      boots.set(areaId, b!)
    }
    for (const [areaId, b] of boots) {
      for (const w of b.warps) {
        const dest = boots.get(w.destAreaId)
        expect(dest, `level ${areaId} warp ${w.lvlWarpId} → ${w.destAreaId}`).toBeDefined()
        const back = dest!.warps.find((x) => x.destAreaId === areaId)
        expect(back, `level ${w.destAreaId} has no warp back to ${areaId}`).toBeDefined()
        const landing = findStandableNear((x, y) => dest!.isWalkable(w.destAreaId, x, y), back!.x, back!.y)
        expect(landing, `landing at level ${w.destAreaId} warp back to ${areaId}`).not.toBeNull()
      }
    }
    const waypointLevels = [
      1, 3, 4, 5, 6, 27, 29, 32, 35, 40, 42, 43, 44, 46, 48, 52, 57, 74, 75, 76, 77, 78, 79, 80, 81, 83, 101,
      103, 106, 107, 109, 111, 112, 113, 115, 117, 118, 123, 129,
    ]
    for (const areaId of waypointLevels) {
      const b = boots.get(areaId)!
      const wp = b.objects.find((o) => o.isWaypoint)
      expect(wp, `waypoint level ${areaId}`).toBeDefined()
      expect(
        findStandableNear((x, y) => b.isWalkable(areaId, x, y), wp!.x, wp!.y),
        `waypoint landing at level ${areaId}`,
      ).not.toBeNull()
    }
  }, 300_000)

  it('Single Player end to end: OnlineSession + LocalLoopbackAdapter on real DRLG levels (town → waypoint → warp)', async () => {
    const packedDir = path.resolve(process.cwd(), 'public/act-packs/tiles')
    if (!fs.existsSync(path.join(packedDir, 'drlg-bundle.json'))) return
    await import('../../tools/lib/node-map-loader.ts')
    const { MapService } = await import('../../src/client/map/map-service.ts')
    const { createMapServiceAreaLevelSource } = await import('../../src/client/map/map-service-area-source.ts')
    const { OnlineSession } = await import('../../src/client/session/online-session.ts')
    const svc = await MapService.fromPackedDir('public/act-packs/tiles')
    const lobby = new LocalLobbyProvider()
    await lobby.createCharacter({ name: 'Rogue', classId: 0 })
    const adapter = (await lobby.enterGame({
      charName: 'Rogue',
      difficulty: 0,
      areaLevelSource: createMapServiceAreaLevelSource(svc),
    })) as LocalLoopbackAdapter
    const game = adapter.getGameInstance()
    const session = new OnlineSession()
    const lost: string[] = []
    session.onSessionLost((ev) => lost.push(ev.reason))
    session.attachGameServer(adapter, {
      localCharacter: {
        characters: await lobby.listCharacters(),
        selectedName: 'Rogue',
        writeProgression: (n, p) => lobby.writeCharacterProgression(n, p),
      },
    })
    let now = 0
    const run = (frames: number): void => {
      for (let i = 0; i < frames; i++) session.tick(40, (now += 40))
    }
    const selfPos = (): { x: number; y: number } => {
      const u = session.world.getUnit('player', session.world.selfId)!
      return { x: Math.round(u.x), y: Math.round(u.y) }
    }
    run(5)
    expect(session.world.areaId).toBe(1)
    expect(game.isAreaLoaded(3)).toBe(false)

    // A fresh character only owns the town waypoint; grant Cold Plains as if it had been activated.
    ;(game as unknown as { players: Map<number, { waypoints: Set<number> }> }).players
      .get(adapter.playerUnitId)!
      .waypoints.add(3)
    session.sendCommand({ type: 'WaypointGo', waypointId: 1, destAreaId: 3 })
    run(5)
    expect(game.isAreaLoaded(3)).toBe(true)
    expect(session.world.areaId).toBe(3)
    const wpObj = session.world
      .getUnitsByType('object')
      .find((o) => [119, 145, 156, 157, 237, 238, 288, 323, 324, 398, 402, 429, 494, 496, 511, 539].includes(o.classId))
    expect(wpObj).toBeDefined()
    const atWp = selfPos()
    expect(Math.hypot(atWp.x - wpObj!.x, atWp.y - wpObj!.y)).toBeLessThanOrEqual(LANDING_RADIUS_CHECK)

    const [warp] = game.listWarpTiles(3)
    expect(warp).toBeDefined()
    session.sendCommand({ type: 'Interact', target: { unitType: 5, id: warp!.unitId } } as never)
    run(5)
    expect(session.world.areaId).toBe(warp!.destAreaId)
    const back = game.listWarpTiles(warp!.destAreaId).find((t) => t.destAreaId === 3)!
    const atWarp = selfPos()
    expect(Math.hypot(atWarp.x - back.x, atWarp.y - back.y)).toBeLessThanOrEqual(LANDING_RADIUS_CHECK)
    expect(lost).toEqual([])
    await session.leaveGame()
    expect(lost).toEqual([])
  }, 300_000)
})

/** Landing must be within the landmark search radius (plus diagonal slack). */
const LANDING_RADIUS_CHECK = 36
