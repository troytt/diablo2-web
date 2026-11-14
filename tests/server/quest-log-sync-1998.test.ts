/**
 * Issue #1998: 1.13c Quest Log Request (`C2S 0x40`) & Quest Status Sync (`S2C 0x28`, `0x50`, `0x52`, `0x5D`).
 *
 * Verifies:
 * 1. `questProtocolId113c` maps every one of the 27 playable quests (`a1q1..a5q6`) to the exact
 *    `D2Client.dll` `0x6fba8188` `QUEST_LOG_DESCRIPTORS[wordIndex].questId` (`0x01..0x24`), so
 *    `QuestLogState.apply5D` (`questLogRowIndex`) updates/highlights the exact quest row without
 *    dropping `a2q6`/`a5q6` or colliding `a3q1`/`a5q2`.
 * 2. `C2S 0x40` (`RequestQuestData`) matches `D2Game.dll` `0x6fc55640` (`QUESTS_SendLogUpdate`):
 *    - emits `S2C 0x28` with `updateType = 6, unitId = 0, timer = 0` (`0x6fc54c00`);
 *    - emits `S2C 0x52` with `41` status filter bytes (`statusBytes[0..40]`);
 *    - conditionally emits `S2C 0x50` type `1` (`[1, den, tombOffset, barbs, 0, 0, 0]`) when
 *      `statusBytes[1] !== 0`, `statusBytes[36] !== 0`, or `(questFlags[12] & 0x2001) !== 0`,
 *      with `66 + tombOffset === game.trueTalRashaTombAreaId === getAct2StaffTombLevelId(seed)`.
 * 3. `A1Q1` Den of Evil (`0x6fc81d40`) & `A5Q2` Mount Arreat cages (`Objects.txt 473`, `0x6fc76b80`)
 *    emit `S2C 0x5D` with `alertFlags = 0x20` (`den` `5..1` / `barbs` `10 -> 5`) and guard re-operating
 *    already-opened cages (`useCount > 0`).
 * 4. `processSessionEvent` only overrides `automapView.setStaffTombLevelOverride` on `S2C 0x50` type `1`
 *    when `(world.quests[12] & 0x2001) !== 0` or `questTombOffset > 0`, preventing an Act 1 `A1Q1`
 *    `S2C 0x50` packet (`words[2] === 0`) from clobbering the seed-derived True Tomb before `a2q4`.
 */
import { describe, expect, it, vi } from 'vitest'
import { ClientWorld } from '../../src/client/world/client-world.ts'
import {
  A2Q6_QUEST_LOG_ROW,
  A2Q6_TRUE_TOMB_TEXT_KEY,
  QUEST_LOG_DESCRIPTORS,
  QuestLogState,
  buildQuestLogPage,
  questLogRowIndex,
  trueTombSymbolFrame113c,
} from '../../src/client/world/quest-log-state.ts'
import { handleServerEvent } from '../../src/client/session/session-event-processor.ts'
import { getAct2StaffTombLevelId } from '../../src/common/drlg/drlg-drlg.ts'
import { serverEventToS2cPackets } from '../../src/netproto/d2gs/s2c-encoder.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import {
  QUEST_FLAG_COMPLETED_113C,
  QUEST_FLAG_COMPLETED_NOW_113C,
  QUEST_FLAG_REWARD_PENDING_113C,
  QUEST_FLAG_STARTED_113C,
  QUEST_INFO_BY_ID_113C,
  questProtocolId113c,
  questWordIndex113c,
  setQuestFlag113c,
} from '../../src/server/engine/quests-113c.ts'

describe('Issue #1998: 1.13c Quest Log (C2S 0x40 -> S2C 0x28/0x50/0x52) & S2C 0x5D nQuest parity', () => {
  it('maps all 27 playable quests to exact D2Client QUEST_LOG_DESCRIPTORS nQuest IDs without collisions', () => {
    expect(QUEST_INFO_BY_ID_113C.size).toBe(27)
    for (const [questId, info] of QUEST_INFO_BY_ID_113C.entries()) {
      const proto = questProtocolId113c(questId)
      expect(proto).toBeDefined()
      const desc = QUEST_LOG_DESCRIPTORS[info.wordIndex]
      expect(desc).toBeDefined()
      expect(desc!.hasTable).toBe(true)
      expect(proto).toBe(desc!.questId)
      expect(questLogRowIndex(proto!)).toBe(info.wordIndex)
    }
    // Regression checks for previously colliding / dropped Acts 2-5 quests:
    expect(questProtocolId113c('a2q6')).toBe(0x0d)
    expect(questProtocolId113c('a3q1')).toBe(0x12)
    expect(questProtocolId113c('a5q2')).toBe(0x20)
    expect(questProtocolId113c('a5q6')).toBe(0x24)
  })

  it('exposes deterministic trueTalRashaTombAreaId (66..72) and syncs S2C 0x28 (updateType=6) + 0x50 + 0x52 on RequestQuestData', () => {
    // Pick a seed whose True Tomb is NOT 66 so non-zero tombOffset is verified end-to-end.
    let chosenSeed = 1001
    for (let s = 1000; s < 1200; s++) {
      if (getAct2StaffTombLevelId(s) !== 66) {
        chosenSeed = s
        break
      }
    }
    const expectedTombArea = getAct2StaffTombLevelId(chosenSeed)
    const expectedOffset = expectedTombArea - 66
    expect(expectedOffset).toBeGreaterThan(0)
    expect(expectedOffset).toBeLessThanOrEqual(6)

    const game = new GameInstance({ seed: chosenSeed, areaId: 74 })
    expect(game.trueTalRashaTombAreaId).toBe(expectedTombArea)
    expect(game.getTrueTalRashaTombAreaId()).toBe(expectedTombArea)

    const p1 = game.connectPlayer({ charClass: 'sor', name: 'LogSorc', x: 10, y: 10, areaId: 74 })
    game.drainEvents(p1)

    // 1. Before any quest is active and before a2q4 is read: RequestQuestData sends 0x28 (updateType=6, unitId=0) + 0x52 (all zeros), no 0x50.
    game.enqueueCommand(p1, { type: 'RequestQuestData' })
    game.stepFrames(1)
    const initialEvents = game.drainEvents(p1)
    const ev28Initial = initialEvents.find((e) => e.type === 'QuestState' && e.source === 0x28)
    const ev50Initial = initialEvents.find((e) => e.type === 'QuestState' && e.source === 0x50)
    const ev52Initial = initialEvents.find((e) => e.type === 'QuestState' && e.source === 0x52)
    expect(ev28Initial && ev28Initial.type === 'QuestState' ? ev28Initial.updateType : -1).toBe(6)
    expect(ev28Initial && ev28Initial.type === 'QuestState' ? ev28Initial.unitId : -1).toBe(0)
    const wire28 = serverEventToS2cPackets(ev28Initial!)
    expect(wire28).toHaveLength(1)
    expect(wire28[0]!.byteLength).toBe(103)
    expect(wire28[0]![1]).toBe(6)
    expect(ev50Initial).toBeUndefined()
    expect(ev52Initial && ev52Initial.type === 'QuestState' ? ev52Initial.statusBytes : undefined).toHaveLength(41)

    // 2. Read Horazon's Journal (Objects.txt 357) -> completes a2q4 (word 12) and starts a2q6 (word 14).
    const journalId = game.spawnObject({ classId: 357, x: 11, y: 10, areaId: 74, mode: 0 })
    game.enqueueCommand(p1, {
      type: 'Interact',
      target: { unitType: 2, id: journalId },
    })
    game.stepFrames(2)
    const journalEvents = game.drainEvents(p1)

    // S2C 0x5D for a2q6 uses nQuest = 0x0d (row 14), updating QuestLogState cleanly:
    const ql = new QuestLogState()
    ql.openQuestLog(1)
    for (const ev of journalEvents) {
      if (ev.type === 'QuestState' && ev.source === 0x5d && ev.questStatus) {
        ql.apply5D(
          ev.questStatus.questId,
          ev.questStatus.alertFlags,
          ev.questStatus.filterStatus,
          ev.questStatus.extra,
          { denQuestWord: 0, playerDeadOrDying: false },
        )
      }
    }
    expect(ql.statusBytes[A2Q6_QUEST_LOG_ROW]).toBe(1)

    // 3. Send RequestQuestData -> emits 0x28 + 0x50 (tombOffset = expectedOffset) + 0x52 (statusBytes[14] = 1, statusBytes[12] = 13).
    game.enqueueCommand(p1, { type: 'RequestQuestData' })
    game.stepFrames(1)
    const logEvents = game.drainEvents(p1)
    const ev28 = logEvents.find((e) => e.type === 'QuestState' && e.source === 0x28)
    const ev50 = logEvents.find((e) => e.type === 'QuestState' && e.source === 0x50)
    const ev52 = logEvents.find((e) => e.type === 'QuestState' && e.source === 0x52)
    expect(ev28).toBeDefined()
    expect(ev50).toBeDefined()
    expect(ev52).toBeDefined()

    const world = new ClientWorld()
    for (const ev of logEvents) {
      world.apply(ev)
    }
    expect(world.questTombOffset).toBe(expectedOffset)
    expect(world.questStatusBytes[12]).toBe(13)
    expect(world.questStatusBytes[A2Q6_QUEST_LOG_ROW]).toBe(1)

    const page = buildQuestLogPage({
      row: A2Q6_QUEST_LOG_ROW,
      playerWords: world.quests,
      status: world.questStatusBytes[A2Q6_QUEST_LOG_ROW]!,
      den: world.denMonstersRemaining,
      barbs: world.questBarbsRemaining,
    })
    expect(page?.text.key).toBe(A2Q6_TRUE_TOMB_TEXT_KEY)
    expect(trueTombSymbolFrame113c('a2q6', page, world.questTombOffset)).toBe(expectedOffset)
  })

  it('tracks A5Q2 Mount Arreat cages (10 -> 5 -> REWARD_PENDING), guards duplicate cage clicks, and updates QuestLogState.barbs via 0x5D (alertFlags=0x20)', () => {
    const game = new GameInstance({ seed: 199805, areaId: 111 })
    const p1 = game.connectPlayer({ charClass: 'sor', name: 'ArreatSorc', x: 10, y: 10, areaId: 111 })
    const cage1 = game.spawnObject({ classId: 473, x: 11, y: 10, areaId: 111, mode: 0 })
    const cage2 = game.spawnObject({ classId: 473, x: 12, y: 10, areaId: 111, mode: 0 })
    const cage3 = game.spawnObject({ classId: 473, x: 10, y: 11, areaId: 111, mode: 0 })
    game.drainEvents(p1)

    const ql = new QuestLogState()
    ql.openQuestLog(4)

    // Open cage 1 -> 10 soldiers remaining (q = 0x20, alertFlags = 0x20, filterStatus = 2, extra = 10)
    game.enqueueCommand(p1, { type: 'Interact', target: { unitType: 2, id: cage1 } })
    game.stepFrames(2)
    const evCage1 = game.drainEvents(p1)
    const st1 = evCage1.find((e) => e.type === 'QuestState' && e.source === 0x5d)
    expect(st1 && st1.type === 'QuestState' ? st1.questStatus : undefined).toEqual({
      questId: 0x20,
      alertFlags: 0x20,
      filterStatus: 2,
      extra: 10,
    })
    ql.apply5D(0x20, 0x20, 2, 10, { denQuestWord: 0, playerDeadOrDying: false })
    expect(ql.barbs).toBe(10)
    expect(ql.statusBytes[36]).toBe(2)

    // Re-interacting with already-opened cage 1 must NOT decrement soldiers or complete quest!
    game.enqueueCommand(p1, { type: 'Interact', target: { unitType: 2, id: cage1 } })
    game.stepFrames(2)
    expect(
      game.drainEvents(p1).some((e) => e.type === 'QuestState' && e.source === 0x5d),
    ).toBe(false)

    // RequestQuestData while 1 cage is opened -> S2C 0x50 words[3] = 10, S2C 0x52 statusBytes[36] = 2
    game.enqueueCommand(p1, { type: 'RequestQuestData' })
    game.stepFrames(1)
    const reqEvents = game.drainEvents(p1)
    const req50 = reqEvents.find((e) => e.type === 'QuestState' && e.source === 0x50)
    const req52 = reqEvents.find((e) => e.type === 'QuestState' && e.source === 0x52)
    expect(req50 && req50.type === 'QuestState' ? req50.quests[3] : -1).toBe(10)
    expect(req52 && req52.type === 'QuestState' ? req52.statusBytes?.[36] : -1).toBe(2)

    // Open cage 2 -> 5 soldiers remaining
    game.enqueueCommand(p1, { type: 'Interact', target: { unitType: 2, id: cage2 } })
    game.stepFrames(2)
    const evCage2 = game.drainEvents(p1)
    const st2 = evCage2.find((e) => e.type === 'QuestState' && e.source === 0x5d)
    expect(st2 && st2.type === 'QuestState' ? st2.questStatus : undefined).toEqual({
      questId: 0x20,
      alertFlags: 0x20,
      filterStatus: 2,
      extra: 5,
    })

    // Open cage 3 -> REWARD_PENDING (filterStatus = 3 -> qstsa5q23 "Return to Qual-Kehk")
    game.enqueueCommand(p1, { type: 'Interact', target: { unitType: 2, id: cage3 } })
    game.stepFrames(2)
    const evCage3 = game.drainEvents(p1)
    const st3 = evCage3.find((e) => e.type === 'QuestState' && e.source === 0x5d)
    expect(st3 && st3.type === 'QuestState' ? st3.questStatus?.questId : -1).toBe(0x20)
    expect(st3 && st3.type === 'QuestState' ? st3.questStatus?.filterStatus : -1).toBe(3)
    const internal = game as unknown as { players: Map<number, { questFlags: Uint16Array }> }
    const a5q2Word = internal.players.get(p1)!.questFlags[questWordIndex113c('a5q2')!]!
    expect(a5q2Word & QUEST_FLAG_REWARD_PENDING_113C).toBe(QUEST_FLAG_REWARD_PENDING_113C)
    expect(a5q2Word & QUEST_FLAG_STARTED_113C).toBe(QUEST_FLAG_STARTED_113C)
  })

  it('does not clobber automapView staffTombLevelOverride on pre-A2Q4 S2C 0x50 type 1 packets, and applies it once A2Q4 is completed', () => {
    const world = new ClientWorld()
    const setStaffTombLevelOverride = vi.fn()
    const host = {
      world,
      automapView: { setStaffTombLevelOverride },
      hudManager: { worldPanels: { openBarkscroll: vi.fn() }, setLeftPanel: vi.fn() },
      hudModel: {
        suppressAutoSync: false,
        isFastPathMonsterEvent: () => false,
        isFastPathVitalsEvent: () => false,
        syncFromWorld: vi.fn(),
        syncTargetMonsterFromWorld: vi.fn(),
        syncVitalsFromWorld: vi.fn(),
      },
      questFx: { onQuestAvailability: vi.fn(), onSpecialQuestEvent: vi.fn() },
      phaseValue: 'ingame',
      appliedPersistedPlayersForGame: true,
      lastSyncedAreaId: 1,
      syncActiveAreaFromPlayerPosition: vi.fn(() => null),
      drainWorldSoundRequests: vi.fn(),
      eventListeners: new Set(),
      chatListeners: new Set(),
    } as never

    // Act 1 Den of Evil S2C 0x50 type 1 (den=4, tombOffset=0) before A2Q4 (word 12 == 0):
    const evAct1 = {
      type: 'QuestState' as const,
      kind: 'item' as const,
      source: 0x50 as const,
      quests: new Uint16Array([1, 4, 0, 0, 0, 0, 0]),
    }
    handleServerEvent(host, evAct1)
    expect(setStaffTombLevelOverride).not.toHaveBeenCalled()

    // Once A2Q4 (word 12) has QFLAG_REWARDGRANTED (0x0001) or QFLAG_COMPLETEDNOW (0x2000), even tombOffset=0 (Area 66) overrides cleanly:
    setQuestFlag113c(world.quests, 'a2q4', QUEST_FLAG_COMPLETED_113C | QUEST_FLAG_COMPLETED_NOW_113C)
    const evTomb66 = {
      type: 'QuestState' as const,
      kind: 'item' as const,
      source: 0x50 as const,
      quests: new Uint16Array([1, 0, 0, 0, 0, 0, 0]),
    }
    handleServerEvent(host, evTomb66)
    expect(setStaffTombLevelOverride).toHaveBeenCalledWith(66)
  })
})
