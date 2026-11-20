import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { GameInstance, SINGLE_PLAYER_POLICY } from '../../src/server/index.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_CUSTOM_4_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  hasQuestFlag113c,
  setQuestFlag113c,
} from '../../src/server/engine/quests-113c.ts'
import {
  createAreaBootstrapResolver,
  resolvePresetPortalDestArea113c,
} from '../../src/server/world/area-bootstrap.ts'
import { NPC_PLACEHOLDER_OBJECTS } from '../../src/common/world/objects-meta.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import {
  ANYA_CENTER_MISSILE,
  ANYA_ICEMAGIC_MISSILE,
  ANYA_INITIAL_TARGET_Y,
  ANYA_STEAM1_MISSILE,
  FROZEN_ANYA_INTERACT_OBJECT_CLASS,
  FROZEN_ANYA_OBJECT_CLASS,
} from '../../src/client/world/quest-fx-tainted-anya-baal-113c.ts'
import {
  spawnAnyaRescueShowIfAnyaNear,
  type SessionLevelNavigationHost,
} from '../../src/client/session/session-level-navigation.ts'
import type { LocalAreaBootstrap, LocalAreaBootstrapResolver } from '../../src/netproto/index.ts'
import type { GameInstanceHost } from '../../src/server/engine/game-instance/host.ts'

function createSyntheticAct5InitFnResolver(): LocalAreaBootstrapResolver {
  return ({ areaId }): LocalAreaBootstrap | null => {
    const isWalkable = () => true
    if (areaId === 109) {
      return {
        areaId: 109,
        spawnX: 5098,
        spawnY: 5024,
        rooms: [{ areaId: 109, tileX: 1010, tileY: 1000 }],
        roomRects: [{ index: 0, x: 5000, y: 5000, w: 220, h: 220, seed: 109 }],
        adjacentAreaIds: [110],
        isWalkable,
        findActSpawnLocation: () => ({ x: 5098, y: 5024 }),
        objects: [
          { classId: 459, x: 5107, y: 5114, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 461, x: 5076, y: 5126, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 542, x: 5138, y: 5030, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 543, x: 5143, y: 5028, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 567, x: 5160, y: 5090, mode: 0, isWaypoint: false, isShrine: false },
        ],
        monsters: [
          {
            classId: 513,
            x: 5078,
            y: 5031,
            name: 'Malah',
            isNpc: true,
            isVendor: true,
            isKillable: false,
            aiDisabled: true,
          },
        ],
        warps: [],
      }
    }
    if (areaId === 114) {
      return {
        areaId: 114,
        spawnX: 10040,
        spawnY: 6760,
        rooms: [{ areaId: 114, tileX: 2000, tileY: 1350 }],
        roomRects: [{ index: 0, x: 10000, y: 6720, w: 120, h: 120, seed: 114 }],
        adjacentAreaIds: [],
        isWalkable,
        findActSpawnLocation: () => ({ x: 10040, y: 6760 }),
        objects: [
          { classId: 460, x: 10051, y: 6766, mode: 0, isWaypoint: false, isShrine: false },
        ],
        monsters: [],
        warps: [
          { lvlWarpId: 75, destAreaId: 113, x: 10010, y: 6730 },
        ],
      }
    }
    if (areaId === 118) {
      return {
        areaId: 118,
        spawnX: 10200,
        spawnY: 6800,
        rooms: [{ areaId: 118, tileX: 2030, tileY: 1350 }],
        roomRects: [{ index: 0, x: 10150, y: 6750, w: 120, h: 120, seed: 118 }],
        adjacentAreaIds: [],
        isWalkable,
        findActSpawnLocation: () => ({ x: 10200, y: 6800 }),
        objects: [],
        monsters: [],
        warps: [
          { lvlWarpId: 78, destAreaId: 120, x: 10205, y: 6805 },
        ],
      }
    }
    if (areaId === 120) {
      return {
        areaId: 120,
        spawnX: 10040,
        spawnY: 12640,
        rooms: [{ areaId: 120, tileX: 2000, tileY: 2520 }],
        roomRects: [{ index: 0, x: 10000, y: 12600, w: 120, h: 120, seed: 120 }],
        adjacentAreaIds: [],
        isWalkable,
        findActSpawnLocation: () => ({ x: 10040, y: 12640 }),
        objects: [
          { classId: 474, x: 10048, y: 12622, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 475, x: 10035, y: 12624, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 476, x: 10056, y: 12634, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 546, x: 10049, y: 12629, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 547, x: 10031, y: 12611, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 564, x: 10061, y: 12653, mode: 0, isWaypoint: false, isShrine: false },
        ],
        monsters: [],
        warps: [
          { lvlWarpId: 79, destAreaId: 118, x: 10061, y: 12653 },
          { lvlWarpId: 80, destAreaId: 128, x: 10031, y: 12611 },
        ],
      }
    }
    if (areaId === 128) {
      return {
        areaId: 128,
        spawnX: 5100,
        spawnY: 5100,
        rooms: [{ areaId: 128, tileX: 1010, tileY: 1010 }],
        roomRects: [{ index: 0, x: 5050, y: 5050, w: 120, h: 120, seed: 128 }],
        adjacentAreaIds: [],
        isWalkable,
        findActSpawnLocation: () => ({ x: 5100, y: 5100 }),
        objects: [],
        monsters: [],
        warps: [
          { lvlWarpId: 81, destAreaId: 120, x: 5102, y: 5102 },
        ],
      }
    }
    return null
  }
}

describe('Issue #2020 — Act 5 InitFn 67/73/76/79 parity: Frozen Anya (460 -> 558 + 0x89 ev 16), Zoo (567), & Arreat Summit (547/564)', () => {
  it('registers Objects.txt 460 in NPC_PLACEHOLDER_OBJECTS and maps SummitDoor 564 -> Area 118 in Area 120', () => {
    expect(NPC_PLACEHOLDER_OBJECTS[460]).toBe(527)
    expect(resolvePresetPortalDestArea113c(564, 120)).toBe(118)
    expect(resolvePresetPortalDestArea113c(564, 118)).toBeUndefined()
  })

  it('spawns Objects.txt 558 at Sync=0 marker 460 in Area 114, emits S2C 0x89 specialEventId 16 on thaw, suppresses 460/567, and removes 558 once rescued', () => {
    const game = new GameInstance({
      policy: SINGLE_PLAYER_POLICY,
      resolveAreaBootstrap: createSyntheticAct5InitFnResolver(),
      areaId: 109,
    })
    const pid = game.connectPlayer({
      name: 'FrozenRiverSorc',
      classId: 1,
      level: 28,
      areaId: 109,
      x: 5098,
      y: 5024,
    })
    const host = game as unknown as GameInstanceHost
    const player = host.players.get(pid)!

    // Sync=0 Zoo marker 567 in Harrogath (109) is never spawned as a visible object.
    expect([...host.objects.values()].some((o) => o.classId === 567)).toBe(false)

    // Enter Frozen River (Area 114): marker 460 is suppressed, interactive Frozen Anya (558) spawns at (10051, 6766) in mode 0.
    expect(
      host.transitionPlayerArea(player, 114, {
        kind: 'townPortal',
        x: 10049,
        y: 6765,
      }),
    ).toBe(true)
    expect([...host.objects.values()].some((o) => o.areaId === 114 && o.classId === 460)).toBe(false)
    const frozen558 = [...host.objects.values()].find(
      (o) => o.areaId === 114 && o.classId === 558,
    )
    expect(frozen558).toBeDefined()
    expect(frozen558!.x).toBe(10051)
    expect(frozen558!.y).toBe(6766)
    expect(frozen558!.mode).toBe(0)

    // Click Frozen Anya (558) without potion -> sets CUSTOM_4 (0x0010, "Talk to Malah") while staying frozen (mode 0).
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: frozen558!.unitId })
    game.stepFrames(1)
    expect(hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_CUSTOM_4_113C)).toBe(true)
    expect(frozen558!.mode).toBe(0)

    // Return to Harrogath (109), talk to Malah (513) -> receives Malah's Potion ('ice').
    expect(
      host.transitionPlayerArea(player, 109, {
        kind: 'townPortal',
        x: 5079,
        y: 5031,
      }),
    ).toBe(true)
    const malah = [...host.monsters.values()].find((m) => m.areaId === 109 && m.hcIdx === 513)!
    game.enqueueCommand(pid, { type: 'NpcInit', target: { unitType: 1, id: malah.unitId } } as never)
    game.stepFrames(1)
    expect(player.items.some((item) => item.code.trim().toLowerCase() === 'ice')).toBe(true)

    // Re-enter Frozen River (114), thaw 558 -> consumes 'ice', transitions 558 to mode 2 for current visit, and emits S2C 0x89 specialEventId 16!
    expect(
      host.transitionPlayerArea(player, 114, {
        kind: 'townPortal',
        x: 10049,
        y: 6765,
      }),
    ).toBe(true)
    game.drainEvents(pid)
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: frozen558!.unitId })
    game.stepFrames(1)
    const thawEvents = game.drainEvents(pid)
    expect(player.items.some((item) => item.code.trim().toLowerCase() === 'ice')).toBe(false)
    expect(frozen558!.mode).toBe(2)
    expect(hasQuestFlag113c(player.questFlags, 'a5q3', QUEST_FLAG_REWARD_PENDING_113C)).toBe(true)
    expect(
      thawEvents.some(
        (ev) =>
          ev.type === 'QuestState' &&
          ev.kind === 'special' &&
          ev.source === 0x89 &&
          ev.specialEventId === 16,
      ),
    ).toBe(true)

    // Leaving and re-entering Frozen River (114) after rescue removes 558 per InitFn 67 (0x6fc7e8d0 -> 0x6fc7e940).
    expect(
      host.transitionPlayerArea(player, 109, {
        kind: 'townPortal',
        x: 5098,
        y: 5024,
      }),
    ).toBe(true)
    expect(
      host.transitionPlayerArea(player, 114, {
        kind: 'townPortal',
        x: 10049,
        y: 6765,
      }),
    ).toBe(true)
    expect([...host.objects.values()].some((o) => o.areaId === 114 && o.classId === 558)).toBe(false)

    // Preloading Area 114 before a player with completed A5Q3 connects also cleans up 558 on connectPlayer.
    const resumedGame = new GameInstance({
      policy: SINGLE_PLAYER_POLICY,
      resolveAreaBootstrap: createSyntheticAct5InitFnResolver(),
      areaId: 114,
    })
    const resumedHost = resumedGame as unknown as GameInstanceHost
    resumedHost.loadArea(114)
    expect([...resumedHost.objects.values()].some((o) => o.areaId === 114 && o.classId === 558)).toBe(
      true,
    )
    const completedFlags = new Uint16Array(48)
    setQuestFlag113c(completedFlags, 'a5q3', QUEST_FLAG_STARTED_113C | QUEST_FLAG_COMPLETED_113C)
    resumedGame.connectPlayer({
      name: 'CompletedAnyaSorc',
      classId: 1,
      level: 30,
      areaId: 109,
      x: 5098,
      y: 5024,
      questFlags: completedFlags,
    })
    expect([...resumedHost.objects.values()].some((o) => o.areaId === 114 && o.classId === 558)).toBe(
      false,
    )
  })

  it('spawns client-side Anya rescue show (#528 anya center) on both Objects.txt 460 and dynamic Objects.txt 558', () => {
    for (const classId of [FROZEN_ANYA_OBJECT_CLASS, FROZEN_ANYA_INTERACT_OBJECT_CLASS]) {
      const world = new ClientWorld()
      world.selfId = 1
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'player',
          id: 1,
          classId: 1,
          name: 'Hero',
          x: 10050,
          y: 6765,
          mode: 1,
          lifePct: 100,
        },
        isSelf: true,
      })
      world.applyEvent({
        type: 'UnitAssign',
        unit: {
          unitType: 'object',
          id: 5580 + classId,
          classId,
          x: 10051,
          y: 6766,
          mode: 2,
          lifePct: 100,
        },
      })
      const fakeHost = {
        world,
        findObjectNearLocalPlayer: (cid: number) =>
          world.listUnits().find((u) => u.unitType === 'object' && u.classId === cid) ?? null,
      } as unknown as SessionLevelNavigationHost
      spawnAnyaRescueShowIfAnyaNear(fakeHost)

      const ctl = world.listUnits().find((u) => u.classId === ANYA_CENTER_MISSILE)
      expect(ctl).toBeDefined()
      expect(ctl!.cltCountdown).toBe(5580 + classId)
      expect(ctl!.cltCountdownY).toBe(ANYA_INITIAL_TARGET_Y)

      for (let i = 0; i < 6; i++) {
        world.tick(40)
      }
      const units = world.listUnits()
      expect(units.some((u) => u.classId === ANYA_ICEMAGIC_MISSILE)).toBe(true)
      expect(units.some((u) => u.classId === ANYA_STEAM1_MISSILE)).toBe(true)
    }
  })

  it('initializes SummitDoor 564 open (mode 2 -> Area 118), locks 564 + warp tile during Ancients, reopens 564 on TP reset & 3rd Ancient death, and spawns 547 open when A5Q5 is complete', () => {
    const game = new GameInstance({
      policy: SINGLE_PLAYER_POLICY,
      resolveAreaBootstrap: createSyntheticAct5InitFnResolver(),
      areaId: 120,
    })
    const pid = game.connectPlayer({
      name: 'SummitSorc',
      classId: 1,
      level: 28,
      areaId: 120,
      x: 10050,
      y: 12631,
    })
    const host = game as unknown as GameInstanceHost
    const player = host.players.get(pid)!

    const door564 = [...host.objects.values()].find((o) => o.areaId === 120 && o.classId === 564)!
    const gate547 = [...host.objects.values()].find((o) => o.areaId === 120 && o.classId === 547)!
    const altar546 = [...host.objects.values()].find((o) => o.areaId === 120 && o.classId === 546)!
    const warpTo118 = [...host.warpTiles.values()].find(
      (w) => w.areaId === 120 && w.destAreaId === 118,
    )!
    expect(door564.mode).toBe(2)
    expect(door564.destAreaId).toBe(118)
    expect(gate547.mode).toBe(0)
    expect(gate547.destAreaId).toBe(128)

    // Activate Altar 546 -> 564 closes to mode 0, blocking both OperateObject(564) and co-located UNIT_TILE(->118).
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: altar546.unitId })
    game.stepFrames(1)
    expect(door564.mode).toBe(0)

    player.x = door564.x
    player.y = door564.y
    player.targetX = door564.x
    player.targetY = door564.y
    game.drainEvents(pid)
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: door564.unitId })
    game.enqueueCommand(pid, { type: 'Interact', target: { unitType: 5, id: warpTo118.unitId } })
    game.stepFrames(1)
    expect(player.areaId).toBe(120)
    expect(door564.mode).toBe(0)
    expect(
      game.drainEvents(pid).some((ev) => ev.type === 'PlaySound' && ev.sound === 19),
    ).toBe(true)

    // Town Portal reset on Summit despawns Ancients AND reopens SummitDoor 564 back to mode 2!
    const tpId = host.openTownPortal(player, false)
    expect(tpId).toBeGreaterThan(0)
    expect(door564.mode).toBe(2)

    // Re-trigger Altar 546 -> 564 locks to mode 0 again -> killing all 3 Ancients reopens 564 to mode 2!
    player.x = altar546.x + 1
    player.y = altar546.y + 1
    player.targetX = player.x
    player.targetY = player.y
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: altar546.unitId })
    game.stepFrames(1)
    expect(door564.mode).toBe(0)
    for (const [mid, m] of host.monsters.entries()) {
      if (m.areaId === 120 && m.superUniqueId?.startsWith('Ancient Barbarian')) {
        game.applyDamageToMonster(mid, 500_000, pid, undefined, 'mag')
      }
    }
    game.stepFrames(1)
    expect(door564.mode).toBe(2)

    // Operating open SummitDoor 564 warps back to The Ancients' Way (Area 118) per OperateFn 71 (0x6fc7d690).
    player.x = door564.x - 1
    player.y = door564.y - 1
    player.targetX = player.x
    player.targetY = player.y
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: door564.unitId })
    game.stepFrames(1)
    expect(player.areaId).toBe(118)

    // InitFn 73 (0x6fc765b0): in a new game where A5Q5 is already completed, Gate 547 spawns directly in mode 2.
    const completedFlags = new Uint16Array(48)
    setQuestFlag113c(completedFlags, 'a5q5', QUEST_FLAG_COMPLETED_113C)
    const gameAfterA5Q5 = new GameInstance({
      policy: SINGLE_PLAYER_POLICY,
      resolveAreaBootstrap: createSyntheticAct5InitFnResolver(),
      areaId: 109,
    })
    const pid2 = gameAfterA5Q5.connectPlayer({
      name: 'PostAncientsSorc',
      classId: 1,
      level: 30,
      areaId: 109,
      x: 5098,
      y: 5024,
      questFlags: completedFlags,
    })
    const host2 = gameAfterA5Q5 as unknown as GameInstanceHost
    const p2 = host2.players.get(pid2)!
    expect(
      host2.transitionPlayerArea(p2, 120, {
        kind: 'townPortal',
        x: 10040,
        y: 12640,
      }),
    ).toBe(true)
    const postGate547 = [...host2.objects.values()].find(
      (o) => o.areaId === 120 && o.classId === 547,
    )!
    expect(postGate547.mode).toBe(2)
  })

  it('verifies real DRLG Area 109, Area 114 (Frozen River), and Area 120 (Arreat Summit) bootstrap parity', async () => {
    const packedDir = path.resolve(process.cwd(), 'public/act-packs/tiles')
    if (!fs.existsSync(path.join(packedDir, 'drlg-bundle.json'))) return
    await import('../../tools/lib/node-map-loader.ts')
    const { MapService } = await import('../../src/client/map/map-service.ts')
    const { createMapServiceAreaLevelSource } = await import(
      '../../src/client/map/map-service-area-source.ts'
    )
    const svc = await MapService.fromPackedDir('public/act-packs/tiles')
    const resolver = createAreaBootstrapResolver(createMapServiceAreaLevelSource(svc))

    const game = new GameInstance({
      mode: 'singlePlayer',
      mapSeed: 0x20200503,
      difficulty: 0,
      resolveAreaBootstrap: resolver,
      areaId: 109,
    })
    const pid = game.connectPlayer({ charClass: 'sor', name: 'DrlgAct5Sorc', areaId: 109, level: 30 })
    const host = game as unknown as GameInstanceHost
    const player = host.players.get(pid)!

    expect([...host.objects.values()].some((o) => o.areaId === 109 && o.classId === 567)).toBe(false)

    const area114 = host.loadArea(114)!
    expect(area114).not.toBeNull()
    expect([...host.objects.values()].some((o) => o.areaId === 114 && o.classId === 460)).toBe(false)
    const real558 = [...host.objects.values()].find(
      (o) => o.areaId === 114 && o.classId === 558,
    )
    expect(real558).toBeDefined()
    expect(real558!.mode).toBe(0)

    const area120 = host.loadArea(120)!
    expect(area120).not.toBeNull()
    const real564 = [...host.objects.values()].find(
      (o) => o.areaId === 120 && o.classId === 564,
    )
    const real547 = [...host.objects.values()].find(
      (o) => o.areaId === 120 && o.classId === 547,
    )
    expect(real564).toBeDefined()
    expect(real564!.mode).toBe(2)
    expect(real564!.destAreaId).toBe(118)
    expect(real547).toBeDefined()
    expect(real547!.mode).toBe(0)
    expect(real547!.destAreaId).toBe(128)

    // Verify player on Arreat Summit can operate open 564 to warp into real DRLG Area 118!
    expect(
      host.transitionPlayerArea(player, 120, {
        kind: 'townPortal',
        x: real564!.x - 2,
        y: real564!.y - 2,
      }),
    ).toBe(true)
    player.x = real564!.x - 1
    player.y = real564!.y - 1
    player.targetX = player.x
    player.targetY = player.y
    game.enqueueCommand(pid, { type: 'OperateObject', objectId: real564!.unitId })
    game.stepFrames(1)
    expect(player.areaId).toBe(118)
  }, 120_000)
})
