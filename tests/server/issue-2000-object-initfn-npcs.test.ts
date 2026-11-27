import { describe, expect, it } from 'vitest'
import { GameInstance, SINGLE_PLAYER_POLICY } from '../../src/server/index.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_COMPLETED_NOW_113C,
  QUEST_FLAG_CUSTOM_3_113C,
  QUEST_FLAG_CUSTOM_4_113C,
  QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  hasQuestFlag113c,
  setQuestFlag113c,
} from '../../src/server/engine/quests-113c.ts'
import type { LocalAreaBootstrap, LocalAreaBootstrapResolver } from '../../src/netproto/index.ts'
import type { GameInstanceHost } from '../../src/server/engine/game-instance/host.ts'
import { ClientWorld } from '../../src/client/world/client-world.ts'

function createSyntheticTownAndVaughtResolver(): LocalAreaBootstrapResolver {
  return ({ areaId }): LocalAreaBootstrap | null => {
    const isWalkable = () => true
    const findActSpawnLocation = () => ({ x: 5100, y: 5100 })
    if (areaId === 1) {
      return {
        areaId: 1,
        spawnX: 5650,
        spawnY: 5920,
        rooms: [{ areaId: 1, tileX: 1120, tileY: 1180 }],
        roomRects: [{ index: 0, x: 5600, y: 5900, w: 100, h: 100, seed: 1 }],
        adjacentAreaIds: [2],
        isWalkable,
        findActSpawnLocation: () => ({ x: 5650, y: 5920 }),
        objects: [
          { classId: 267, x: 5658, y: 5925, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 385, x: 5664, y: 5931, mode: 0, isWaypoint: false, isShrine: false },
        ],
        monsters: [],
        warps: [],
      }
    }
    if (areaId === 40) {
      return {
        areaId: 40,
        spawnX: 5160,
        spawnY: 5060,
        rooms: [{ areaId: 40, tileX: 1010, tileY: 1010 }],
        roomRects: [{ index: 0, x: 5040, y: 5040, w: 180, h: 180, seed: 2 }],
        adjacentAreaIds: [41],
        isWalkable,
        findActSpawnLocation: () => ({ x: 5140, y: 5055 }),
        objects: [
          { classId: 121, x: 5147, y: 5191, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 122, x: 5071, y: 5148, mode: 0, isWaypoint: false, isShrine: false },
        ],
        monsters: [
          { classId: 210, x: 5205, y: 5058, name: 'Meshif', isNpc: true, isKillable: false, aiDisabled: true },
        ],
        warps: [],
      }
    }
    if (areaId === 75) {
      return {
        areaId: 75,
        spawnX: 5130,
        spawnY: 5170,
        rooms: [{ areaId: 75, tileX: 1020, tileY: 1000 }],
        roomRects: [{ index: 0, x: 5020, y: 5020, w: 220, h: 200, seed: 3 }],
        adjacentAreaIds: [76],
        isWalkable,
        findActSpawnLocation,
        objects: [
          { classId: 378, x: 5122, y: 5165, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 379, x: 5219, y: 5038, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 382, x: 5221, y: 5111, mode: 0, isWaypoint: false, isShrine: false },
        ],
        monsters: [],
        warps: [],
      }
    }
    if (areaId === 109) {
      return {
        areaId: 109,
        spawnX: 5098,
        spawnY: 5024,
        rooms: [{ areaId: 109, tileX: 1010, tileY: 1000 }],
        roomRects: [{ index: 0, x: 5000, y: 5000, w: 200, h: 200, seed: 5 }],
        adjacentAreaIds: [110],
        isWalkable,
        findActSpawnLocation,
        objects: [
          { classId: 459, x: 5107, y: 5114, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 461, x: 5076, y: 5126, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 542, x: 5138, y: 5030, mode: 0, isWaypoint: false, isShrine: false },
          { classId: 543, x: 5143, y: 5028, mode: 0, isWaypoint: false, isShrine: false },
        ],
        monsters: [],
        warps: [],
      }
    }
    if (areaId === 121) {
      return {
        areaId: 121,
        spawnX: 10050,
        spawnY: 13200,
        rooms: [{ areaId: 121, tileX: 2000, tileY: 2630 }],
        roomRects: [{ index: 0, x: 10000, y: 13150, w: 120, h: 120, seed: 6 }],
        adjacentAreaIds: [],
        isWalkable,
        findActSpawnLocation: () => ({ x: 10050, y: 13200 }),
        objects: [],
        monsters: [],
        warps: [],
      }
    }
    if (areaId === 124) {
      return {
        areaId: 124,
        spawnX: 12700,
        spawnY: 5015,
        rooms: [{ areaId: 124, tileX: 2535, tileY: 1000 }],
        roomRects: [{ index: 0, x: 12650, y: 4980, w: 120, h: 120, seed: 7 }],
        adjacentAreaIds: [],
        isWalkable,
        findActSpawnLocation: () => ({ x: 12700, y: 5015 }),
        objects: [
          { classId: 462, x: 12705, y: 5020, mode: 0, isWaypoint: false, isShrine: false },
        ],
        monsters: [],
        warps: [],
      }
    }
    return null
  }
}

describe('Issue #2000: 5-Act Objects.txt InitFn dynamic NPC & Nihlathak boss spawners', () => {
  it('Act 2 (Area 40): spawns Jerhyn (201) + Kaelan (331), relocates Jerhyn to Palace (122), removes Kaelan post-Duriel, and completes A2Q6 turn-in', () => {
    const game = new GameInstance({
      policy: SINGLE_PLAYER_POLICY,
      resolveAreaBootstrap: createSyntheticTownAndVaughtResolver(),
      areaId: 40,
    })
    const pid = game.connectPlayer({
      name: 'ActTwoSorc',
      classId: 1,
      level: 20,
      areaId: 40,
      x: 5150,
      y: 5185,
    })

    const initialNpcs = game.listMonsters(40)
    const jerhynInitial = initialNpcs.find((m) => m.classId === 201)
    const kaelanInitial = initialNpcs.find((m) => m.classId === 331)
    expect(jerhynInitial).toBeDefined()
    expect(Math.hypot(jerhynInitial!.x - 5147, jerhynInitial!.y - 5191)).toBeLessThanOrEqual(8)
    expect(kaelanInitial).toBeDefined()
    expect(Math.hypot(kaelanInitial!.x - 5072, kaelanInitial!.y - 5148)).toBeLessThanOrEqual(8)

    // ClientWorld hides BOTH Sync=1 static placeholders (121 & 122) while dynamic Jerhyn (201) is active
    const clientWorld = new ClientWorld()
    for (const ev of game.drainPlayerEvents(pid)) {
      clientWorld.apply(ev)
    }
    for (const u of clientWorld.units.values()) {
      if (u.unitType === 'object' && (u.classId === 121 || u.classId === 122)) {
        expect(u.hidden).toBe(true)
      }
    }

    // Advance A2Q6 to post-Duriel + Tyrael talked (`0x100C`: STARTED | PRIMARY_GOAL_DONE | CUSTOM_3)
    const host = game as unknown as GameInstanceHost
    const playerRec = host.players.get(pid)!
    host.setPlayerQuestFlag(
      playerRec,
      'a2q6',
      QUEST_FLAG_STARTED_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C | QUEST_FLAG_CUSTOM_3_113C,
    )

    // Jerhyn relocates to Palace anchor (122: 5071, 5148) and Kaelan (331) despawns
    const postDurielNpcs = game.listMonsters(40)
    expect(postDurielNpcs.filter((m) => m.classId === 201)).toHaveLength(1)
    expect(postDurielNpcs.find((m) => m.classId === 331)).toBeUndefined()
    const jerhynPalace = postDurielNpcs.find((m) => m.classId === 201)!
    expect(Math.hypot(jerhynPalace.x - 5071, jerhynPalace.y - 5148)).toBeLessThanOrEqual(8)

    // Interact with Jerhyn -> sets CUSTOM_4 (0x0010 "Talk to Meshif")
    game.movePlayer(pid, jerhynPalace.x + 1, jerhynPalace.y)
    game.enqueueCommand(pid, {
      type: 'NpcInit',
      target: { unitType: 1, id: jerhynPalace.unitId },
    })
    game.stepFrames(2)
    expect(hasQuestFlag113c(playerRec.questFlags, 'a2q6', QUEST_FLAG_CUSTOM_4_113C)).toBe(true)

    // Interact with Meshif (210) -> completes A2Q6 (`0x2001`)
    const meshif = postDurielNpcs.find((m) => m.classId === 210)!
    game.movePlayer(pid, meshif.x + 1, meshif.y)
    game.enqueueCommand(pid, {
      type: 'NpcInit',
      target: { unitType: 1, id: meshif.unitId },
    })
    game.stepFrames(2)
    expect(hasQuestFlag113c(playerRec.questFlags, 'a2q6', QUEST_FLAG_COMPLETED_113C)).toBe(true)
  })

  it('Act 3 (Area 75): spawns Hratli (253 vendor) + Natalya (297), relocates Hratli on progress, removes Natalya on A3Q6, and emits zero Sync=0 ghost objects', () => {
    const game = new GameInstance({
      policy: SINGLE_PLAYER_POLICY,
      resolveAreaBootstrap: createSyntheticTownAndVaughtResolver(),
      areaId: 75,
    })
    const pid = game.connectPlayer({
      name: 'ActThreeSorc',
      classId: 1,
      level: 24,
      areaId: 75,
      x: 5125,
      y: 5165,
    })

    const host = game as unknown as GameInstanceHost
    // Object 382 (Sync=0) must NOT exist as a world object
    expect([...host.objects.values()].some((o) => o.classId === 382)).toBe(false)

    const initialNpcs = game.listMonsters(75)
    const hratli = initialNpcs.find((m) => m.classId === 253)
    const natalya = initialNpcs.find((m) => m.classId === 297)
    expect(hratli).toBeDefined()
    expect(Math.hypot(hratli!.x - 5122, hratli!.y - 5165)).toBeLessThanOrEqual(8)
    expect(natalya).toBeDefined()
    expect(Math.hypot(natalya!.x - 5221, natalya!.y - 5111)).toBeLessThanOrEqual(8)

    // Starting A3Q1 relocates Hratli to forge anchor 379 (5219, 5038) while keeping Natalya
    const playerRec = host.players.get(pid)!
    host.setPlayerQuestFlag(playerRec, 'a3q1', QUEST_FLAG_STARTED_113C)
    expect(game.listMonsters(75).filter((m) => m.classId === 253)).toHaveLength(1)
    const hratliForge = game.listMonsters(75).find((m) => m.classId === 253)!
    expect(Math.hypot(hratliForge.x - 5219, hratliForge.y - 5038)).toBeLessThanOrEqual(8)
    expect(game.listMonsters(75).find((m) => m.classId === 297)).toBeDefined()

    // Completing A3Q6 (Mephisto) removes Natalya (297) from Kurast Docks
    host.setPlayerQuestFlag(
      playerRec,
      'a3q6',
      QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(game.listMonsters(75).find((m) => m.classId === 297)).toBeUndefined()
  })

  it('Act 5 (Area 109 & Area 124): spawns Larzuk (511) + Town Nihlathak (514), swaps 514 -> Anya (512) at 459, spawns SU 60 Nihlathak (526) in Area 124, and suppresses Sync=0 ghost objects', () => {
    const game = new GameInstance({
      policy: SINGLE_PLAYER_POLICY,
      resolveAreaBootstrap: createSyntheticTownAndVaughtResolver(),
      areaId: 109,
    })
    const pid = game.connectPlayer({
      name: 'ActFiveSorc',
      classId: 1,
      level: 32,
      areaId: 109,
      x: 5100,
      y: 5050,
    })
    const host = game as unknown as GameInstanceHost

    // Sync=0 spawner markers (459, 461, 542, 543) never spawn as client-visible objects
    for (const markerId of [459, 461, 542, 543]) {
      expect([...host.objects.values()].some((o) => o.classId === markerId)).toBe(false)
    }

    // Initially: Larzuk (511) + Town Nihlathak (514) present, Anya (512) absent
    const initial109 = game.listMonsters(109)
    expect(initial109.find((m) => m.classId === 511)).toBeDefined()
    expect(initial109.find((m) => m.classId === 514)).toBeDefined()
    expect(initial109.find((m) => m.classId === 512)).toBeUndefined()

    // Rescuing Anya (A5Q3 REWARD_PENDING) removes Town Nihlathak (514), spawns Town Anya (512) at Object 459 (5107, 5114), and opens red portal 60 -> 121
    const playerRec = host.players.get(pid)!
    host.setPlayerQuestFlag(playerRec, 'a5q3', QUEST_FLAG_REWARD_PENDING_113C)
    const postAnya109 = game.listMonsters(109)
    expect(postAnya109.find((m) => m.classId === 514)).toBeUndefined()
    const anya = postAnya109.find((m) => m.classId === 512)
    expect(anya).toBeDefined()
    expect(Math.hypot(anya!.x - 5107, anya!.y - 5114)).toBeLessThanOrEqual(8)
    expect(
      [...host.objects.values()].some(
        (o) => o.areaId === 109 && o.classId === 60 && o.destAreaId === 121,
      ),
    ).toBe(true)

    // Entering Halls of Vaught (Area 124) activates Object 462 (InitFn 69) -> spawns SuperUnique Nihlathak (SU 60, hcIdx 526) without ghost Object 462
    expect(
      host.transitionPlayerArea(playerRec, 124, {
        kind: 'townPortal',
        x: 12700,
        y: 5015,
      }),
    ).toBe(true)
    expect([...host.objects.values()].some((o) => o.areaId === 124 && o.classId === 462)).toBe(false)
    const vaughtMonsters = game.listMonsters(124)
    const bossNihlathak = vaughtMonsters.find((m) => m.classId === 526)
    expect(bossNihlathak).toBeDefined()
    expect(bossNihlathak!.isNpc).toBe(false)

    // Also verify pre-A5Q3 entry into 121..124 removes Town Nihlathak (514) per 0x6fc7f560
    const game2 = new GameInstance({
      policy: SINGLE_PLAYER_POLICY,
      resolveAreaBootstrap: createSyntheticTownAndVaughtResolver(),
      areaId: 109,
    })
    const qFlags = new Uint16Array(48)
    setQuestFlag113c(qFlags, 'a1q3', QUEST_FLAG_COMPLETED_113C)
    const pid2 = game2.connectPlayer({
      name: 'TempleEntryCheck',
      classId: 1,
      level: 32,
      areaId: 109,
      x: 5100,
      y: 5050,
      questFlags: qFlags,
    })
    expect(game2.listMonsters(109).find((m) => m.classId === 514)).toBeDefined()
    const host2 = game2 as unknown as GameInstanceHost
    const p2 = host2.players.get(pid2)!
    expect(
      host2.transitionPlayerArea(p2, 121, {
        kind: 'townPortal',
        x: 10050,
        y: 13200,
      }),
    ).toBe(true)
    expect(game2.listMonsters(109).find((m) => m.classId === 514)).toBeUndefined()
  })
})
