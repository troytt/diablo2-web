import { describe, expect, it } from 'vitest';
import {
  ACT_FreeAllActRoomPortalLists113c,
  AIGENERAL_FlushAllAiCommands113c,
  CLIENTS_ForEachInGameClient113c,
  D2GAME_DISABLE_CLIENT_TIMEOUT_VA_113C,
  D2GAME_MINION_COMP_COUNT_VA_113C,
  D2GAME_MINION_COMP_TABLE_PTR_VA_113C,
  D2GAME_PERF_TICK_ARRAY_PTR_VA_113C,
  D2GAME_TOTAL_MEMPOOL_BYTES_VA_113C,
  EVENT_ExecuteItemEvents113c,
  EVENT_ExecuteMissileEvents113c,
  EVENT_ExecuteMonsterEvents113c,
  EVENT_ExecuteObjectEvents113c,
  EVENT_ExecutePlayerEvents113c,
  GAME_CheckAndDisconnectTimedOutClients113c,
  GAME_ExpireItemsAndMinionListsPeriodic113c,
  GAME_StepActEnvironmentCycles113c,
  GAME_StepClientJoinStatesAndTimeouts113c,
  GAME_SyncNewClientWithExistingPlayers113c,
  GAME_UpdateTickRateMetrics113c,
  MONREG_FindOrAllocActRoomNode113c,
  MONREG_FlushAndFreePendingSpawnNodes113c,
  MONREG_RestoreRoomMonstersFromNode113c,
  MONREG_UnlinkAndFreeActRoomNode113c,
  MONSTER_ApplyElementalDamageAndResistStats113c,
  MONSTER_CalcLifePercentage128_113c,
  MONSTER_DispatchMinionComponentCallbacks113c,
  MONSTER_GetHirelingLevelBonusFactor113c,
  MONSTER_SpawnPresetOrEvilUrn113c,
  NET_QueuePacketToClientBuffer113c,
  NET_SendFixed40BytePacketToClient113c,
  OBJECT_CheckRespawnOrPortalInRoom113c,
  OBJECT_SendUpdatePacketsToClient113c,
  OBJECT_SetAnimMode2Wrapper113c,
  OBJECT_SyncStateAndEventsToClient113c,
  QUEST_Act1TownPortalUpdateState113c,
  UNIT_FlushEventNotifyQueueToClient113c,
  UNIT_FreeEventNotifyList113c,
  UNIT_SendAllStatesBitstreamToClient113c,
  UNIT_SendFullUnitSyncToClient113c,
  UNIT_SendGfxStatesBitstreamToClient113c,
  UNIT_SyncStateAndStatsToClient113c,
} from '../../../src/d2kern-113c/game/boot-init-gap-a-113c.ts';
import { EVENT_InitTimerQueue113c, EVENT_SetEventFull113c } from '../../../src/d2kern-113c/game/timer-wheel.ts';
import { D2EventStrc, D2GameStrc, D2TimerStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

describe('K1R14-LaneJ2: D2Game.dll Boot/Init & Event/Sync Coverage Gap Closure Part 1 (36 VAs)', () => {
  it('verifies OBJECT_CheckRespawnOrPortalInRoom113c (0x6FC2BD10) & OBJECT_SetAnimMode2Wrapper113c (0x6FC4E750)', () => {
    const m = new SparseMemory113c();
    expect(OBJECT_CheckRespawnOrPortalInRoom113c(m, 0, 0)).toBe(1);

    const pUnit = m.alloc(0x100);
    const pRoom = m.alloc(0x100);
    const pPath = m.alloc(0x40);
    m.setU32(pUnit + 0x00, 2); // UNIT_OBJECT
    m.setU32(pUnit + 0x10, 0);
    m.setU32(pUnit + 0x2c, pPath);
    expect(OBJECT_CheckRespawnOrPortalInRoom113c(m, pUnit, pRoom)).toBe(1);

    OBJECT_SetAnimMode2Wrapper113c(m, 0, pUnit);
    expect(m.u32(pUnit + 0x10)).toBe(2);
  });

  it('verifies MONREG room node lifecycle & pending spawn flush (0x6FC3E960, 0x6FC3EA40, 0x6FC3FB40, 0x6FC3FB90)', () => {
    const m = new SparseMemory113c();
    const pActMonReg = m.alloc(0x320);
    const pGame = m.alloc(0x2000);
    const pRoom = m.alloc(0x100);
    m.setU32(pRoom + 0x10, 40);
    m.setU32(pRoom + 0x14, 80);

    const node1 = MONREG_FindOrAllocActRoomNode113c(m, pActMonReg, pGame, pRoom);
    expect(node1).toBeGreaterThan(0);
    expect(m.u32(pActMonReg + 0x308)).toBe(1);
    const node1Again = MONREG_FindOrAllocActRoomNode113c(m, pActMonReg, pGame, pRoom);
    expect(node1Again).toBe(node1);

    MONREG_UnlinkAndFreeActRoomNode113c(m, node1, pActMonReg, pGame);
    expect(m.u32(pActMonReg + 0x308)).toBe(0);

    const ppHead = m.alloc(4);
    const rec1 = m.alloc(0x40);
    const rec2 = m.alloc(0x40);
    m.setU32(rec1 + 0x30, rec2);
    m.setU32(ppHead, rec1);
    MONREG_FlushAndFreePendingSpawnNodes113c(m, pGame, ppHead);
    expect(m.u32(ppHead)).toBe(0);

    const emptyRoomNode = m.alloc(0x1c);
    MONREG_RestoreRoomMonstersFromNode113c(m, pRoom, pGame, emptyRoomNode);
    expect(m.u32(emptyRoomNode)).toBe(0);
  });

  it('verifies AI command flush & minion component callbacks (0x6FC41420, 0x6FC468E0)', () => {
    const m = new SparseMemory113c();
    const pMonster = m.alloc(0x100);
    const pMonData = m.alloc(0x80);
    const pAiGeneral = m.alloc(0x40);
    const pCmd1 = m.alloc(0x20);
    const pCmd2 = m.alloc(0x20);
    m.setU32(pMonster + 0x00, 1);
    m.setU32(pMonster + 0x14, pMonData);
    m.setU32(pMonData + 0x28, pAiGeneral);
    m.setU32(pCmd1 + 0x00, pCmd2);
    m.setU32(pCmd1 + 0x04, pCmd2);
    m.setU32(pCmd2 + 0x00, pCmd1);
    m.setU32(pCmd2 + 0x04, pCmd1);
    m.setU32(pAiGeneral + 0x20, pCmd1);
    m.setU32(pAiGeneral + 0x24, pCmd2);

    AIGENERAL_FlushAllAiCommands113c(m, 0, pMonster);
    expect(m.u32(pAiGeneral + 0x20)).toBe(0);
    expect(m.u32(pAiGeneral + 0x24)).toBe(0);

    const pTable = m.alloc(0x40);
    m.setU32(D2GAME_MINION_COMP_COUNT_VA_113C, 2);
    m.setU32(D2GAME_MINION_COMP_TABLE_PTR_VA_113C, pTable);
    m.setU32(pTable + 0x08, 0x6fc01111);

    const pCompNode = m.alloc(0x18);
    m.setU32(pCompNode + 0x00, 0);
    m.setU32(pMonData + 0x58, pCompNode);

    const seen: number[] = [];
    MONSTER_DispatchMinionComponentCallbacks113c(m, 0x2000, pMonster, 1, {
      onComponentCallback: (_m, pfn) => {
        seen.push(pfn);
      },
    });
    expect(seen).toEqual([0x6fc01111]);
    expect(m.u32(pMonData + 0x58)).toBe(0);
  });

  it('verifies client iteration, tick metrics, periodic expire, join sync & timeouts (0x6FC49820..0x6FC4D9B0)', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x2000);
    const pClient1 = m.alloc(0x500);
    const pClient2 = m.alloc(0x500);
    const pQueue1 = m.alloc(0x40c);
    const pQueue2 = m.alloc(0x40c);
    m.setU32(pClient1 + 0x04, 4);
    m.setU32(pClient1 + 0x1bc, pQueue1);
    m.setU32(pClient1 + 0x4a8, pClient2);
    m.setU32(pClient2 + 0x04, 2);
    m.setU32(pClient2 + 0x1bc, pQueue2);
    m.setU32(pGame + 0x88, pClient1);

    const visited: number[] = [];
    CLIENTS_ForEachInGameClient113c(m, pGame, 1, 0x99, (_m, pClient, ctx) => {
      visited.push(pClient, ctx);
    });
    expect(visited).toEqual([pClient1, 0x99]);

    const pPerf = m.alloc(0x20);
    m.setU32(D2GAME_PERF_TICK_ARRAY_PTR_VA_113C, pPerf);
    m.setU32(D2GAME_TOTAL_MEMPOOL_BYTES_VA_113C, 0);
    m.setU16(pGame + 0x28, 1);
    m.setU32(pGame + 0xa8, 50);
    m.setU32(pGame + 0xac, 1000);
    m.setU32(pGame + 0xb0, 25);
    GAME_UpdateTickRateMetrics113c(m, pGame, {
      getTickCountMs: () => 2000,
    });
    expect(m.u32(pGame + 0xb4)).toBe(25);
    expect(m.u32(pPerf + 4)).toBe(25);
    expect(D2GAME_TOTAL_MEMPOOL_BYTES_VA_113C).toBe(0x6fd4dc28);

    m.setU32(pGame + 0xa8, 128);
    GAME_ExpireItemsAndMinionListsPeriodic113c(m, pGame);

    m.setU32(pClient2 + 0x04, 4);
    let postJoinSynced = 0;
    GAME_SyncNewClientWithExistingPlayers113c(m, pGame, pClient2, {
      onPostClientJoinSync: () => {
        postJoinSynced++;
      },
    });
    expect(postJoinSynced).toBe(1);
    expect(m.u32(pClient1 + 0x1c4)).toBeGreaterThan(0);
    expect(m.u32(pClient2 + 0x1c4)).toBeGreaterThan(0);

    GAME_StepActEnvironmentCycles113c(m, pGame, {
      checkAct2EclipseQuest: () => 0,
    });

    m.setU32(D2GAME_DISABLE_CLIENT_TIMEOUT_VA_113C, 0);
    m.setU32(pClient1 + 0x484, 1000);
    const disconnected: number[] = [];
    GAME_CheckAndDisconnectTimedOutClients113c(m, pGame, 40000, {
      disconnectClient: (_m, _g, c) => {
        disconnected.push(c);
      },
    });
    expect(disconnected).toContain(pClient1);

    expect(GAME_StepClientJoinStatesAndTimeouts113c(m, pGame, 40000)).toBe(1);
  });

  it('verifies preset/EvilUrn spawn, Act1 portal quest, object sync, and monster stats (0x6FC66F70..0x6FC97240)', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x2000);
    const pRoom = m.alloc(0x100);

    const spawnedSu = MONSTER_SpawnPresetOrEvilUrn113c(m, pGame, pRoom, 1, 100, 200, 5, 0, {
      spawnSuperUniqueById: () => 1,
    });
    expect(spawnedSu).toBe(1);

    const pPortal = m.alloc(0x100);
    m.setU32(pPortal + 0x94, 0xffffffff);
    expect(QUEST_Act1TownPortalUpdateState113c(m, pPortal, pGame)).toBe(0);

    const pClient = m.alloc(0x500);
    const pQueue = m.alloc(0x40c);
    m.setU32(pClient + 0x1bc, pQueue);
    const pObj = m.alloc(0x100);
    m.setU32(pObj + 0x00, 2);
    m.setU32(pObj + 0x0c, 77);
    m.setU32(pObj + 0x10, 1);
    m.setU32(pObj + 0xc4, 0x8040);
    OBJECT_SendUpdatePacketsToClient113c(m, pClient, pObj);
    expect(m.u32(pClient + 0x1c4)).toBe(1);

    expect(OBJECT_SyncStateAndEventsToClient113c(m, pObj, pClient)).toBe(1);
    expect(m.u32(pClient + 0x1c4)).toBe(2);

    expect(MONSTER_CalcLifePercentage128_113c(m, 0)).toBe(0);

    m.setU32(pGame + 0x70, 0);
    expect(MONSTER_GetHirelingLevelBonusFactor113c(m, pGame, 0)).toBe(0);
    expect(MONSTER_GetHirelingLevelBonusFactor113c(m, pGame, 3)).toBe(16);
    expect(MONSTER_GetHirelingLevelBonusFactor113c(m, pGame, 8)).toBe(0);

    MONSTER_ApplyElementalDamageAndResistStats113c(m, pGame, 0, 0);
  });

  it('verifies unit state/event sync & network packet queue (0x6FC988B0..0x6FCAB400)', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x2000);
    const pClient = m.alloc(0x500);
    const pQueue = m.alloc(0x40c);
    m.setU32(pClient + 0x1bc, pQueue);

    const pUnit = m.alloc(0x100);
    const pPath = m.alloc(0x40);
    m.setU32(pUnit + 0x00, 5); // UNIT_TILE (hits default 0x09 branch in UNIT_SendFullUnitSyncToClient113c)
    m.setU32(pUnit + 0x04, 12);
    m.setU32(pUnit + 0x0c, 0x1234);
    m.setU32(pUnit + 0x2c, pPath);
    m.setU32(pUnit + 0x80, pGame);
    m.setU32(pUnit + 0xc4, 0x0400);
    m.setU16(pUnit + 0xd8, 0x55);

    const pNotify1 = m.alloc(0x14);
    const pNotify2 = m.alloc(0x14);
    m.setU8(pNotify1 + 0x04, 0xa4);
    m.setU16(pNotify1 + 0x08, 0x77);
    m.setU32(pNotify1 + 0x10, pNotify2);
    m.setU8(pNotify2 + 0x04, 0x9a);
    m.setU32(pUnit + 0xe8, pNotify1);

    let soundSent = 0;
    UNIT_SyncStateAndStatsToClient113c(m, pGame, pClient, pUnit, {
      sendUnitEventSound: (_m, _c, _u, wSound) => {
        soundSent = wSound;
      },
    });
    expect(soundSent).toBe(0x55);
    expect(m.u32(pClient + 0x1c4)).toBe(2);

    UNIT_FlushEventNotifyQueueToClient113c(m, pClient, pUnit);
    expect(m.u32(pClient + 0x1c4)).toBe(4);

    UNIT_FreeEventNotifyList113c(m, pUnit);
    expect(m.u32(pUnit + 0xe8)).toBe(0);

    UNIT_SendGfxStatesBitstreamToClient113c(m, pUnit, pClient);
    UNIT_SendAllStatesBitstreamToClient113c(m, pUnit, pClient);

    UNIT_SendFullUnitSyncToClient113c(m, pClient, pUnit, 0);
    expect(m.u32(pClient + 0x1c4)).toBe(5);

    const pPkt40 = m.alloc(0x28);
    m.setU8(pPkt40, 0x5b);
    expect(NET_SendFixed40BytePacketToClient113c(m, pClient, pPkt40)).toBe(1);
    expect(NET_QueuePacketToClientBuffer113c(m, pClient, 1, pPkt40, 10)).toBe(1);
  });

  it('verifies timer wheel partition executors (0x6FCAE9A0..0x6FCAEF20) & ACT_FreeAllActRoomPortalLists113c (0x6FCBD5B0)', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x2000);
    const pTimer = EVENT_InitTimerQueue113c(m, pGame);
    m.set(pGame, D2GameStrc.dwGameFrame, 9);

    const pRoom = m.alloc(0x100);
    const mkUnit = (uType: number): number => {
      const u = m.alloc(0x100);
      const pPath = m.alloc(0x40);
      m.setU32(u + 0x00, uType);
      m.setU32(u + 0x0c, uType + 1);
      m.setU32(u + 0x2c, pPath);
      m.setU32(pPath + 0x1c, pRoom);
      return u;
    };

    const uPlayer = mkUnit(0);
    const uMonster = mkUnit(1);
    const uObject = mkUnit(2);
    const uMissile = mkUnit(3);
    const uItem = mkUnit(4);

    EVENT_SetEventFull113c(m, pGame, uPlayer, 1, 10, 0, 11, 22);
    EVENT_SetEventFull113c(m, pGame, uMonster, 2, 10, 0, 33, 44);
    EVENT_SetEventFull113c(m, pGame, uObject, 3, 10, 0, 55, 66);
    EVENT_SetEventFull113c(m, pGame, uMissile, 4, 10, 0x6fc02222, 77, 88);
    EVENT_SetEventFull113c(m, pGame, uItem, 5, 10, 0x6fc03333, 99, 111);

    m.set(pGame, D2GameStrc.dwGameFrame, 10);

    const fired: string[] = [];
    const callees = {
      dispatchPlayerEvent: () => fired.push('player'),
      dispatchMonsterEvent: () => fired.push('monster'),
      dispatchObjectEvent: () => fired.push('object'),
      dispatchMissileEvent: () => fired.push('missile'),
      dispatchItemEvent: () => fired.push('item'),
    };

    EVENT_ExecutePlayerEvents113c(m, pGame, pTimer, 10, callees);
    EVENT_ExecuteMonsterEvents113c(m, pGame, pTimer, 10, callees);
    EVENT_ExecuteObjectEvents113c(m, pGame, pTimer, 10, callees);
    EVENT_ExecuteMissileEvents113c(m, pGame, pTimer, 10, callees);
    EVENT_ExecuteItemEvents113c(m, pGame, pTimer, 10, callees);

    expect(fired).toEqual(['player', 'monster', 'object', 'missile', 'item']);
    expect(m.get(pTimer, D2TimerStrc.pSavedNext)).toBe(0);
    expect(D2EventStrc.dwFrame.off).toBe(4);

    ACT_FreeAllActRoomPortalLists113c(m, pGame);
  });
});
