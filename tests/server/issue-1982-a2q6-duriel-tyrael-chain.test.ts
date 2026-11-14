/**
 * Issue #1982: 1.13c A2Q6 The Seven Tombs (`D2Game.dll` `a2q6.cpp`):
 * - Non-`isDoor` collision barriers (`Objects.txt` `{129, 153, 449, 508}`) block walk/ray collision
 *   while `HasCollision[mode] === 1` and clear when opened (`mode === 2`); `OperateFn === 0` objects
 *   (`153` Tyrael's Door) reject direct player `InteractUnit` clicks.
 * - `computeA2Q6StatusByte113c` emits `S2C 0x5D` `filterStatus = 1` outside `Area 73` (`qstsa2q61a`
 *   True Tomb symbol when `a2q5` is done) and `2` inside `Area 73` (`qstsa2q62` "Kill Duriel.").
 * - Killing Duriel (`hcIdx = 211`) sets `0x1004` (`STARTED | PRIMARY_GOAL_DONE`, NOT `0x0001` or `0x2000`),
 *   opens `Objects.txt 153` (`mode = 2`), and spawns `Tyrael` (`hcIdx = 251`, `tyrael1`) if absent.
 * - Talking to `Tyrael (251)` opens a permanent ownerless `Objects.txt 59` portal (`Area 73 <-> Area 40`)
 *   and sets `0x0008` (`filterStatus = 5` -> `qstsa2q64` "Talk to Jerhyn.").
 * - Talking to `Jerhyn (201)` sets `0x0010` (`filterStatus = 6` -> `qstsa2q65` "Talk to Meshif.").
 * - Talking to `Meshif (210)` cleans up leftover `'hst'`/`'vip'`/`'msf'`, sets `0x2001` (`filterStatus = 13`
 *   -> `qstsComplete`), and unlocks Sail East (`CanGoToAct { act: 2 }` -> `Area 75`).
 */
import { describe, expect, it } from 'vitest'
import {
  A2Q6_QUEST_LOG_ROW,
  A2Q6_TRUE_TOMB_TEXT_KEY,
  buildQuestLogPage,
} from '../../src/client/world/quest-log-state.ts'
import {
  NON_ISDOOR_GATE_CLASS_IDS_113C,
  doesDoorOrGateBlockMode113c,
  isDoorOrGateObject113c,
} from '../../src/common/world/object-operate-113c.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_COMPLETED_NOW_113C,
  QUEST_FLAG_CUSTOM_3_113C,
  QUEST_FLAG_CUSTOM_4_113C,
  QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
  QUEST_FLAG_STARTED_113C,
  computeA2Q6StatusByte113c,
  questProtocolId113c,
  questWordIndex113c,
  setQuestFlag113c,
} from '../../src/server/engine/quests-113c.ts'

describe('Issue #1982: non-isDoor gate collision & OperateFn=0 click guard', () => {
  it('blocks walk/door collision for {129, 153, 449, 508} while closed and clears on mode 2, while rejecting player clicks on 153', () => {
    for (const classId of NON_ISDOOR_GATE_CLASS_IDS_113C) {
      expect(isDoorOrGateObject113c(classId)).toBe(true)
      expect(doesDoorOrGateBlockMode113c(classId, 0)).toBe(true)
      expect(doesDoorOrGateBlockMode113c(classId, 2)).toBe(false)
    }
    // Objects.txt 153 hasCollisionMask = 11 (bits 0, 1, 3): blocks in mode 1 as well.
    expect(doesDoorOrGateBlockMode113c(153, 1)).toBe(true)

    const game = new GameInstance({ seed: 198201, areaId: 73 })
    const p1 = game.connectPlayer({ charClass: 'sor', name: 'GateProbe', x: 10, y: 10, areaId: 73 })
    const doorId = game.spawnObject({ classId: 153, x: 12, y: 10, areaId: 73, mode: 0 })

    const internal = game as unknown as {
      isClosedDoorAt: (areaId: number, x: number, y: number) => boolean
      isWorldWalkableForPlayer: (areaId: number, x: number, y: number) => boolean
      objects: Map<number, { mode: number }>
      setObjectMode: (obj: unknown, mode: number) => void
    }
    expect(internal.isClosedDoorAt(73, 12, 10)).toBe(true)
    expect(internal.isWorldWalkableForPlayer(73, 12, 10)).toBe(false)

    // Direct player Interact click on Objects.txt 153 (OperateFn = 0) must NOT open the door!
    game.enqueueCommand(p1, {
      type: 'Interact',
      target: { unitType: 2, id: doorId },
    })
    game.stepFrames(3)
    expect(internal.objects.get(doorId)!.mode).toBe(0)
    expect(internal.isClosedDoorAt(73, 12, 10)).toBe(true)

    // Scripted transition to mode 2 clears collision immediately.
    internal.setObjectMode(internal.objects.get(doorId)!, 2)
    expect(internal.isClosedDoorAt(73, 12, 10)).toBe(false)
    expect(internal.isWorldWalkableForPlayer(73, 12, 10)).toBe(true)
  })
})

describe('Issue #1982: 1.13c A2Q6 Duriel -> Tyrael -> Jerhyn -> Meshif full quest chain', () => {
  it('progresses status bytes 1 -> 2 -> 3 -> 5 -> 6 -> 13, opens door 153 + permanent Tyrael portal, cleans up staff items, and gates Meshif Sail East on Jerhyn', () => {
    const a2q2Idx = questWordIndex113c('a2q2')!
    const a2q5Idx = questWordIndex113c('a2q5')!
    const a2q6Idx = questWordIndex113c('a2q6')!
    const a2q6Proto = questProtocolId113c('a2q6')!
    expect(a2q6Proto).toBe(0x0d)

    const game = new GameInstance({ seed: 198202, areaId: 74, maxPlayers: 2 })
    const p1 = game.connectPlayer({ charClass: 'sor', name: 'TombSorc', x: 10, y: 10, areaId: 74 })
    const internal = game as unknown as {
      players: Map<
        number,
        {
          unitId: number
          areaId: number
          x: number
          y: number
          questFlags: Uint16Array
          items: Array<{
            unitId: number
            code: string
            name: string
            quality: number
            level: number
            location: 'inventory'
            x: number
            y: number
            width: number
            height: number
            areaId: number
            ownerId: number
            bodyLoc: number
            storePage: number
            cost: number
            gamble: boolean
            identified: boolean
            ethereal: boolean
            socketed: boolean
            totalSockets: number
            durability: number
            maxDurability: number
            quantity: number
            stats: Map<number, number>
            socketedItems: never[]
          }>
        }
      >
      objects: Map<
        number,
        {
          unitId: number
          classId: number
          areaId: number
          mode: number
          destAreaId?: number
          portalOwnerId?: number
          linkedPortalId?: number
          x: number
          y: number
        }
      >
      monsters: Map<number, { unitId: number; hcIdx: number; areaId: number; x: number; y: number; dead: boolean }>
      transitionPlayerArea: (player: unknown, destAreaId: number, arrival: unknown) => boolean
      playerCanEnterArea: (player: unknown, areaId: number) => boolean
    }
    const player = internal.players.get(p1)!
    setQuestFlag113c(player.questFlags, 'a2q2', QUEST_FLAG_COMPLETED_113C)
    setQuestFlag113c(player.questFlags, 'a2q5', QUEST_FLAG_COMPLETED_113C)
    expect(player.questFlags[a2q2Idx]).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(player.questFlags[a2q5Idx]).toBe(QUEST_FLAG_COMPLETED_113C)

    // 1. Operate Horazon's Journal (Objects.txt 357) in Area 74 -> a2q6 STARTED (0x0004), filterStatus = 1 (True Tomb symbol!).
    const journalId = game.spawnObject({ classId: 357, x: 11, y: 10, areaId: 74, mode: 0 })
    game.drainEvents(p1)
    game.enqueueCommand(p1, {
      type: 'Interact',
      target: { unitType: 2, id: journalId },
    })
    game.stepFrames(2)
    const journalEvents = game.drainEvents(p1)
    const journalStatus = journalEvents.find(
      (e) => e.type === 'QuestState' && e.kind === 'status' && e.questStatus?.questId === a2q6Proto,
    )
    expect(journalStatus && journalStatus.type === 'QuestState' ? journalStatus.questStatus?.filterStatus : -1).toBe(1)
    expect(
      buildQuestLogPage({
        row: A2Q6_QUEST_LOG_ROW,
        playerWords: Array.from(player.questFlags),
        status: computeA2Q6StatusByte113c(player.questFlags, false),
        den: 0,
        barbs: 0,
      })?.text.key,
    ).toBe(A2Q6_TRUE_TOMB_TEXT_KEY)

    // Second party/peer player without a2q2 cannot enter Area 73 before Duriel dies.
    const p2 = game.connectPlayer({ charClass: 'pal', name: 'PeerPal', x: 10, y: 10, areaId: 40 })
    const peer = internal.players.get(p2)!
    expect(internal.playerCanEnterArea(peer, 73)).toBe(false)

    // 2. Enter Duriel's Lair (Area 73) -> filterStatus transitions to 2 ("Kill Duriel.").
    const tyraelDoorId = game.spawnObject({ classId: 153, x: 25, y: 12, areaId: 73, mode: 0 })
    const durielId = game.spawnMonster({
      classId: 211,
      name: 'Duriel',
      x: 14,
      y: 12,
      areaId: 73,
      hp: 50,
      maxHp: 50,
      aiDisabled: true,
    })
    game.drainEvents(p1)
    expect(internal.transitionPlayerArea(player, 73, { kind: 'townPortal', x: 12, y: 12 })).toBe(true)
    const enter73Events = game.drainEvents(p1)
    const enter73Status = enter73Events.find(
      (e) => e.type === 'QuestState' && e.kind === 'status' && e.questStatus?.questId === a2q6Proto,
    )
    expect(enter73Status && enter73Status.type === 'QuestState' ? enter73Status.questStatus?.filterStatus : -1).toBe(2)
    expect(
      buildQuestLogPage({
        row: A2Q6_QUEST_LOG_ROW,
        playerWords: Array.from(player.questFlags),
        status: computeA2Q6StatusByte113c(player.questFlags, true),
        den: 0,
        barbs: 0,
      })?.text.key,
    ).toBe('qstsa2q62')

    // 3. Slay Duriel (hcIdx 211) -> sets 0x1004 (NOT 0x0001 or 0x2000), opens door 153, spawns Tyrael (251).
    game.applyDamageToMonster(durielId, 500, p1)
    expect(player.questFlags[a2q6Idx]).toBe(
      QUEST_FLAG_STARTED_113C | QUEST_FLAG_PRIMARY_GOAL_DONE_113C,
    )
    expect(player.questFlags[a2q6Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(0)
    expect(player.questFlags[a2q6Idx]! & QUEST_FLAG_COMPLETED_NOW_113C).toBe(0)
    expect(computeA2Q6StatusByte113c(player.questFlags, true)).toBe(3)
    expect(internal.objects.get(tyraelDoorId)!.mode).toBe(2)

    const tyrael = [...internal.monsters.values()].find(
      (m) => m.areaId === 73 && m.hcIdx === 251 && !m.dead,
    )
    expect(tyrael).toBeDefined()

    // Spawn Lut Gholein (Area 40) Jerhyn (201) and Meshif (210) before talking to Tyrael.
    const jerhynId = game.spawnMonster({
      classId: 201,
      name: 'Jerhyn',
      x: 12,
      y: 12,
      areaId: 40,
      isNpc: true,
    })
    const meshifId = game.spawnMonster({
      classId: 210,
      name: 'Meshif',
      x: 14,
      y: 12,
      areaId: 40,
      isNpc: true,
    })

    // 4. Talk to Tyrael (251) -> sets 0x0008 (filterStatus = 5 -> qstsa2q64) and opens permanent ownerless Objects.txt 59 portal!
    player.x = tyrael!.x + 1
    player.y = tyrael!.y
    game.drainEvents(p1)
    game.enqueueCommand(p1, {
      type: 'NpcInit',
      target: { unitType: 1, id: tyrael!.unitId },
    } as never)
    game.stepFrames(1)
    const tyraelEvents = game.drainEvents(p1)
    expect(player.questFlags[a2q6Idx]! & QUEST_FLAG_CUSTOM_3_113C).toBe(QUEST_FLAG_CUSTOM_3_113C)
    expect(computeA2Q6StatusByte113c(player.questFlags, true)).toBe(5)
    expect(
      buildQuestLogPage({
        row: A2Q6_QUEST_LOG_ROW,
        playerWords: Array.from(player.questFlags),
        status: 5,
        den: 0,
        barbs: 0,
      })?.text.key,
    ).toBe('qstsa2q64')
    expect(tyraelEvents.some((e) => e.type === 'Portal' && e.destAreaId === 40)).toBe(true)

    const lairPortal = [...internal.objects.values()].find(
      (o) => o.areaId === 73 && o.classId === 59 && o.destAreaId === 40 && o.portalOwnerId === undefined,
    )
    const townPortal = [...internal.objects.values()].find(
      (o) => o.areaId === 40 && o.classId === 59 && o.destAreaId === 73 && o.portalOwnerId === undefined,
    )
    expect(lairPortal).toBeDefined()
    expect(townPortal).toBeDefined()
    expect(lairPortal!.linkedPortalId).toBe(townPortal!.unitId)
    expect(townPortal!.linkedPortalId).toBe(lairPortal!.unitId)

    // Enter Tyrael's portal (73 -> 40) and round-trip (40 -> 73 -> 40): portal stays permanently open!
    player.x = lairPortal!.x
    player.y = lairPortal!.y
    game.enqueueCommand(p1, {
      type: 'Interact',
      target: { unitType: 2, id: lairPortal!.unitId },
    })
    game.stepFrames(15)
    expect(player.areaId).toBe(40)
    expect(internal.objects.has(lairPortal!.unitId)).toBe(true)
    expect(internal.objects.has(townPortal!.unitId)).toBe(true)

    player.x = townPortal!.x
    player.y = townPortal!.y
    game.enqueueCommand(p1, {
      type: 'Interact',
      target: { unitType: 2, id: townPortal!.unitId },
    })
    game.stepFrames(15)
    expect(player.areaId).toBe(73)
    expect(internal.objects.has(lairPortal!.unitId)).toBe(true)
    expect(internal.objects.has(townPortal!.unitId)).toBe(true)

    player.x = lairPortal!.x
    player.y = lairPortal!.y
    game.enqueueCommand(p1, {
      type: 'Interact',
      target: { unitType: 2, id: lairPortal!.unitId },
    })
    game.stepFrames(15)
    expect(player.areaId).toBe(40)

    // Peer without a2q2 CAN enter Area 73 once peer has post-Duriel a2q6 flag.
    setQuestFlag113c(peer.questFlags, 'a2q6', QUEST_FLAG_PRIMARY_GOAL_DONE_113C)
    expect(internal.playerCanEnterArea(peer, 73)).toBe(true)

    // Talking to Meshif BEFORE Jerhyn must NOT unlock Act 3!
    player.x = 13
    player.y = 12
    game.drainEvents(p1)
    game.enqueueCommand(p1, {
      type: 'NpcInit',
      target: { unitType: 1, id: meshifId },
    } as never)
    game.stepFrames(1)
    const meshifBeforeJerhyn = game.drainEvents(p1)
    expect(meshifBeforeJerhyn.some((e) => e.type === 'CanGoToAct' && e.act === 2)).toBe(false)
    expect(player.questFlags[a2q6Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(0)

    // 5. Talk to Jerhyn (201) -> sets 0x0010 (filterStatus = 6 -> qstsa2q65 "Talk to Meshif.").
    game.enqueueCommand(p1, {
      type: 'NpcInit',
      target: { unitType: 1, id: jerhynId },
    } as never)
    game.stepFrames(1)
    game.drainEvents(p1)
    expect(player.questFlags[a2q6Idx]! & QUEST_FLAG_CUSTOM_4_113C).toBe(QUEST_FLAG_CUSTOM_4_113C)
    expect(computeA2Q6StatusByte113c(player.questFlags, false)).toBe(6)
    expect(
      buildQuestLogPage({
        row: A2Q6_QUEST_LOG_ROW,
        playerWords: Array.from(player.questFlags),
        status: 6,
        den: 0,
        barbs: 0,
      })?.text.key,
    ).toBe('qstsa2q65')

    // Give leftover 'vip' and 'msf' items to verify Meshif cleanup.
    player.items.push(
      {
        unitId: 9901,
        code: 'vip',
        name: 'Amulet of the Viper',
        quality: 7,
        level: 20,
        location: 'inventory',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        areaId: 40,
        ownerId: p1,
        bodyLoc: 0,
        storePage: 1,
        cost: 0,
        gamble: false,
        identified: true,
        ethereal: false,
        socketed: false,
        totalSockets: 0,
        durability: 0,
        maxDurability: 0,
        quantity: 1,
        stats: new Map(),
        socketedItems: [],
      },
      {
        unitId: 9902,
        code: 'msf',
        name: 'Staff of Kings',
        quality: 7,
        level: 20,
        location: 'inventory',
        x: 1,
        y: 0,
        width: 1,
        height: 3,
        areaId: 40,
        ownerId: p1,
        bodyLoc: 0,
        storePage: 1,
        cost: 0,
        gamble: false,
        identified: true,
        ethereal: false,
        socketed: false,
        totalSockets: 0,
        durability: 10,
        maxDurability: 10,
        quantity: 1,
        stats: new Map(),
        socketedItems: [],
      },
    )

    // 6. Talk to Meshif (210) -> cleans up 'vip'/'msf', sets 0x2001 (filterStatus = 13 -> qstsComplete), emits CanGoToAct { act: 2 }!
    game.enqueueCommand(p1, {
      type: 'NpcInit',
      target: { unitType: 1, id: meshifId },
    } as never)
    game.stepFrames(1)
    const meshifAfterJerhyn = game.drainEvents(p1)
    expect(meshifAfterJerhyn.some((e) => e.type === 'CanGoToAct' && e.act === 2)).toBe(true)
    expect(player.questFlags[a2q6Idx]! & QUEST_FLAG_COMPLETED_113C).toBe(QUEST_FLAG_COMPLETED_113C)
    expect(player.questFlags[a2q6Idx]! & QUEST_FLAG_COMPLETED_NOW_113C).toBe(
      QUEST_FLAG_COMPLETED_NOW_113C,
    )
    expect(computeA2Q6StatusByte113c(player.questFlags, false)).toBe(13)
    expect(
      player.items.some((it) => ['hst', 'vip', 'msf'].includes(it.code.toLowerCase())),
    ).toBe(false)
  })

  it('auto-opens Objects.txt 153 and spawns Tyrael (251) when joining a game with A2Q6 already post-Duriel', () => {
    const game = new GameInstance({ seed: 198203, areaId: 73 })
    const doorId = game.spawnObject({ classId: 153, x: 25, y: 12, areaId: 73, mode: 0 })
    const saved = new Uint16Array(48)
    setQuestFlag113c(saved, 'a2q2', QUEST_FLAG_COMPLETED_113C)
    setQuestFlag113c(saved, 'a2q6', QUEST_FLAG_COMPLETED_113C)

    game.connectPlayer({
      charClass: 'sor',
      name: 'RejoinSorc',
      x: 12,
      y: 12,
      areaId: 73,
      questFlags: saved,
    })

    const internal = game as unknown as {
      objects: Map<number, { mode: number }>
      monsters: Map<number, { hcIdx: number; areaId: number; dead: boolean }>
    }
    expect(internal.objects.get(doorId)!.mode).toBe(2)
    expect(
      [...internal.monsters.values()].some((m) => m.areaId === 73 && m.hcIdx === 251 && !m.dead),
    ).toBe(true)
  })
})
