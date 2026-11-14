/**
 * Regression suite for mercenary death / resurrection + map transition freeze ("雇佣兵死亡之后切换地图卡死"):
 *
 * 1. Client `0x7A(action=0, petType=0, classId=0, ownerId=0, mercId)` parity (`D2Game.dll` `0x6FCB8205` /
 *    `0x6FCB74B5` -> `D2Client.dll` `0x6FB5C720 -> 0x6FAD1840`):
 *    - When a hireling dies on a 1.13c server, the 13-byte `0x7A` packet has `action=0`, `petType=0`,
 *      `classId=0`, `ownerId=0`, and `mercId` at `[9..12]`.
 *    - `ClientWorld` must match `mercId` against `this._merc.mercId` and mark `this._merc.isDead = true`,
 *      `this._merc.lifePct = 0` so subsequent map transitions (`LoadAct`, `RoomReveal`, `UnitReassign`)
 *      do not resurrect a ghost mercenary or desync client unit state.
 * 2. Server `GameInstance` + `AreaPathWorld113c` + `stepOracleHireableMerc113c` / `stepNecroPet113c`:
 *    - Mercenary death (`applyDamageToMerc`) zeroes `hp256`, sets `mode = 12`, clears in-flight AI state,
 *      removes the unit from `areaPathWorld`, and broadcasts `0x7A(action=0)` alongside `0x9B` and `0x0A`.
 *    - Town resurrection (`handleMercResurrect`) resets `merc.mode = 1`, restores `merc.hp256`, resets
 *      `oracleMercAi113c`, and spawns the dynamic path in `areaPathWorld` (`D2Game.dll` `0x6FCB8490`).
 *    - Cross-area map transition (`transitionPlayerArea` / `relocatePlayerFollowersToPlayer` /
 *      `stepSummonedPets`) resets active follower modes to `MONMODE_NEUTRAL (1)` and re-spawns dynamic
 *      paths in the destination area (`D2Game.dll` `0x6FCB71F0..0x6FCB7317`), preventing uncaught
 *      `has no dynamic path` exceptions on the next 25Hz frame.
 *    - Owner death (`killPlayer`) also kills any alive hireling (`D2Game.dll` `0x6FCB7730 -> 0x6FCB7420`).
 */

import { describe, expect, it } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import { decode0x7ASummonAction, decode0x9BMercReviveCost } from '../../src/netproto/d2gs/s2c/merc.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import { initOracleHireableMerc113c } from '../../src/server/engine/game-instance/hireable-ai-113c.ts'
import type { GameInstanceHost } from '../../src/server/engine/game-instance/host.ts'

describe('Mercenary death / resurrection + map switch freeze regression suite', () => {
  it('ClientWorld marks local mercenary dead on 1.13c 0x7A(action=0, petType=0, ownerId=0) wire packet and survives map transition', () => {
    const world = new ClientWorld()
    world.selfId = 1
    world.applyServerEvent({
      type: 'PlayerAssign',
      unitId: 1,
      charClass: 1,
      name: 'ttSorceress',
      x: 5100,
      y: 5050,
    })
    world.applyServerEvent({
      type: 'LoadAct',
      act: 1,
      mapSeed: 0x12345678,
      areaId: 46,
      objectSeed: 0,
    })
    world.applyServerEvent({
      type: 'UnitAssign',
      unitType: 'monster',
      unitId: 42,
      classId: 338,
      x: 5102,
      y: 5052,
      areaId: 46,
      unit: {
        unitType: 1,
        id: 42,
        classId: 338,
        x: 5102,
        y: 5052,
        mode: 1,
        lifePct: 128,
      },
    })
    world.applyServerEvent({
      type: 'Merc',
      kind: 'assign',
      ownerId: 1,
      mercId: 42,
      classId: 338,
      nameId: 10,
      seed: 0xdeadbeef,
    })
    expect(world.merc).not.toBeNull()
    expect(world.merc?.mercId).toBe(42)
    expect(world.merc?.isDead).toBe(false)

    // Exact 13-byte S2C 0x7A(action=0) emitted by D2Game.dll 0x6FCB8205 on mercenary death:
    // action=0, petType=0, classId=0, ownerId=0, mercId=42
    const raw0x7aDeath = new Uint8Array([
      0x7a,
      0x00,
      0x00,
      0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      42, 0x00, 0x00, 0x00,
    ])
    const ev7a = decode0x7ASummonAction(raw0x7aDeath)
    world.applyServerEvent(ev7a)

    // Even before 0x9B arrives, 0x7A(action=0) must mark the local mercenary dead
    expect(world.merc?.isDead).toBe(true)
    expect(world.merc?.lifePct).toBe(0)

    // Followed by 7-byte 0x9B MercReviveCost(nameId=10, reviveCost=50000)
    const raw0x9b = new Uint8Array([0x9b, 10, 0x00, 0x50, 0xc3, 0x00, 0x00])
    world.applyServerEvent(decode0x9BMercReviveCost(raw0x9b))
    expect(world.merc?.isDead).toBe(true)
    expect(world.merc?.reviveCost).toBe(50000)

    // Now switch maps into Tal Rasha's Tomb (Area 66) and walk
    world.applyServerEvent({
      type: 'LoadAct',
      act: 1,
      mapSeed: 0x12345678,
      areaId: 66,
      objectSeed: 0,
    })
    world.applyServerEvent({
      type: 'UnitReassign',
      unitType: 0,
      id: 1,
      unitId: 1,
      at: { x: 2500, y: 2500 },
      x: 2500,
      y: 2500,
      snap: true,
      areaId: 66,
    })
    world.applyServerEvent({
      type: 'UnitMove',
      unitType: 'player',
      id: 1,
      unitId: 1,
      from: { x: 2500, y: 2500 },
      to: { x: 2506, y: 2504 },
      x: 2506,
      y: 2504,
      mode: 'run',
      areaId: 66,
    })
    expect(world.areaId).toBe(66)
    expect(world.merc?.isDead).toBe(true)
    expect(world.monsters.has(42)).toBe(false)
  })

  it('GameInstance oracle Hireable mercenary: dead -> map switch -> walk, and resurrected -> map switch -> walk do not throw or freeze', () => {
    const game = new GameInstance({
      seed: 0x20261105,
      areaId: 1,
      difficulty: 2,
    })
    const playerId = game.connectPlayer({
      charClass: 'sor',
      name: 'ttSorceress',
      level: 85,
      areaId: 1,
    })
    const host = game as unknown as GameInstanceHost
    const player = host.players.get(playerId)!
    player.gold = 500_000

    // Spawn an oracle Hireable mercenary (saved .d2s path)
    const merc = initOracleHireableMerc113c(
      host,
      player,
      {
        seed: 0x13572468,
        nameId: 1,
        typeId: 7,
        experience: 4_630_500,
        dead: false,
      },
      true,
    )
    expect(merc).toBeDefined()
    expect(merc.alive).toBe(true)

    // Transition from Rogue Encampment (Area 1) to Blood Moor (Area 2) while merc is alive & walking (mode = 2)
    merc.mode = 2
    expect(host.transitionPlayerArea(player, 2, { kind: 'townPortal', x: 20, y: 20 })).toBe(true)
    expect(() => game.stepFrames(25)).not.toThrow()
    expect(merc.areaId).toBe(2)

    // Kill the mercenary in Area 2 while it is in walking mode (mode = 2)
    merc.mode = 2
    host.applyDamageToMerc(merc.unitId, merc.hp + 1000)
    expect(merc.alive).toBe(false)
    expect(merc.hp).toBe(0)
    expect(merc.hp256).toBe(0)
    expect(merc.mode).toBe(12)

    // Switch maps from Area 2 into Cold Plains (Area 3) while mercenary is dead and walk
    expect(host.transitionPlayerArea(player, 3, { kind: 'townPortal', x: 24, y: 24 })).toBe(true)
    game.enqueueCommand(playerId, {
      type: 'Move',
      to: { x: Math.round(player.x) + 4, y: Math.round(player.y) + 4 },
      run: true,
    })
    expect(() => game.stepFrames(30)).not.toThrow()

    // Return to Rogue Encampment (Area 1), resurrect the mercenary at Kashya (classId 150), and step
    expect(host.transitionPlayerArea(player, 1, { kind: 'townPortal', x: 18, y: 18 })).toBe(true)
    const kashyaId = game.spawnMonster({
      classId: 150,
      name: 'Kashya',
      x: player.x + 1,
      y: player.y + 1,
      areaId: 1,
      isNpc: true,
    })
    player.activeNpcId = kashyaId
    game.enqueueCommand(playerId, {
      type: 'MercResurrect',
      npcId: kashyaId,
    } as never)
    expect(() => game.stepFrames(30)).not.toThrow()
    expect(merc.alive).toBe(true)
    expect(merc.hp).toBe(merc.maxHp)
    expect(merc.hp256).toBe(merc.maxHp256 ?? merc.maxHp * 256)

    // Switch maps again from Area 1 -> Area 3 right after resurrection and walk
    expect(host.transitionPlayerArea(player, 3, { kind: 'townPortal', x: 24, y: 24 })).toBe(true)
    game.enqueueCommand(playerId, {
      type: 'Move',
      to: { x: Math.round(player.x) + 5, y: Math.round(player.y) - 3 },
      run: true,
    })
    expect(() => game.stepFrames(40)).not.toThrow()
    expect(merc.alive).toBe(true)
    expect(merc.areaId).toBe(3)
  })

  it('GameInstance killPlayer kills the player’s alive mercenary and emits 0x9B + 0x7A(action=0) (D2Game.dll 0x6FCB7730)', () => {
    const game = new GameInstance({ seed: 9911, areaId: 46, difficulty: 2 })
    const playerId = game.connectPlayer({
      charClass: 'sor',
      name: 'ttSorceress',
      level: 80,
      x: 20,
      y: 20,
      areaId: 46,
    })
    const mercId = game.hireMercenary(playerId, {
      act: 2,
      subType: 7,
      level: 78,
      difficulty: 3,
    })
    game.drainEvents(playerId)

    const host = game as unknown as GameInstanceHost
    const player = host.players.get(playerId)!
    const merc = host.mercenaries.get(mercId)!
    expect(merc.alive).toBe(true)

    host.killPlayer(player)
    expect(merc.alive).toBe(false)
    expect(merc.hp).toBe(0)

    const events = game.drainEvents(playerId)
    const reviveCostEvent = events.find(
      (ev) => ev.type === 'Merc' && (ev as { kind?: string }).kind === 'stat',
    )
    const summonRemoveEvent = events.find(
      (ev) =>
        ev.type === 'Merc' &&
        (ev as { kind?: string; isSummonAction?: boolean; summonAction?: number }).kind === 'assign' &&
        (ev as { isSummonAction?: boolean }).isSummonAction === true &&
        (ev as { summonAction?: number }).summonAction === 0,
    )
    expect(reviveCostEvent).toBeDefined()
    expect(summonRemoveEvent).toBeDefined()
  })
})
