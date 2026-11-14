import { describe, expect, it } from 'vitest';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts';
import {
  ACT1Q0_CheckWarrivIntroNpcAlert113c,
  ACT1Q1_CheckDenOfEvilNpcAlert113c,
  ACT1Q2_CheckAkaraIntroNpcAlert113c,
  ACT1Q2_CheckBloodRavenNpcAlert113c,
  ACT1Q3_CheckMalusNpcAlert113c,
  ACT1Q4_CheckCainTownNpcAlert113c,
  ACT1Q4_CheckSearchForCainNpcAlert113c,
  ACT1Q5_CheckCharsiImbueNpcAlert113c,
  ACT1Q6_CheckTravelEastNpcAlert113c,
  AITARGET_IterateRoomActiveClients113c,
  AITARGET_ScanUnitsByModeTable113c,
  AITHINK_CanPlayerStartSkillOrCast113c,
  AITHINK_CanPlayerSwitchToMode113c,
  AI_AcquireOrValidateCombatTarget113c,
  AI_FindNearestPlayerCallback113c,
  AI_FollowPackLeaderOrAttack113c,
  AI_HandleStunDoorOrLeaderFollow113c,
  AI_TryOpenNearbyClosedDoor113c,
  D2NET_SendPacket0x06BytesToClient113c,
  D2NET_SendUnitMovePacket0x10BytesToClient113c,
  D2NET_SendUnitPosSync0x15ToClient113c,
  PLAYER_FinishModeAndResetToNeutral113c,
  PLAYER_RecalcTargetUnitPath113c,
  PLAYER_SetNeutralOrTownNeutralMode113c,
  PLAYER_SetPathTargetCoordsAndWalk113c,
  PLAYER_StartWalkOrRunMode113c,
  PLAYER_StepAnimationModeTick113c,
  QUESTS_CheckNpcQuestInteractAlert113c,
  QUESTS_StepQuestTimers113c,
  SPLAYER_BroadcastUnitMovementToClient113c,
  SPLAYER_GetClientActNo113c,
  SUNIT_FindValidNextRoomInAct113c,
  SUNIT_UpdateUnitPositionAndRoom113c,
} from '../../../src/d2kern-113c/game/town-runtime-gap-113c.ts';

function createTestMem(): SparseMemory113c {
  const m = new SparseMemory113c();
  m.fill(0x6fdd6000, 0x20000, 0);
  const pDataTables = m.alloc(0x2000);
  initD2GameGlobalsInMem113c(m, pDataTables);
  return m;
}

describe('K1R14-LaneJ1: D2Game.dll F4..F78 + 0x6FCAC010 33 VAs', () => {
  it('ports F4 AI pack leader follow, door open, stun/door dispatch, and target validation (4 VAs)', () => {
    const m = createTestMem();
    const pGame = m.alloc(0x2000);
    const pUnit = m.alloc(0x100);
    m.setU32(pUnit, 1);
    m.setU32(pUnit + 4, 1);

    const pAiControl = m.alloc(0x40);
    m.setU32(pAiControl + 0xc, 0xffffffff);
    const pAiControlPtr = m.alloc(4);
    m.setU32(pAiControlPtr, pAiControl);

    expect(AI_FollowPackLeaderOrAttack113c(m, pAiControlPtr, pUnit, pGame)).toBe(0);

    const pMonStats = m.alloc(0x40);
    m.setU32(pAiControl + 0x1c, pMonStats);
    expect(AI_TryOpenNearbyClosedDoor113c(m, pAiControl, pUnit, pGame)).toBe(0);
    expect(AI_HandleStunDoorOrLeaderFollow113c(m, pUnit, pGame, pAiControl)).toBe(0);
    expect(AI_AcquireOrValidateCombatTarget113c(m, pAiControl, pUnit, pGame)).toBe(0);
  });

  it('ports F20 QUESTS_StepQuestTimers113c (0x6FC53B70)', () => {
    const m = createTestMem();
    const pGame = m.alloc(0x1200);
    const pQuestControl = m.alloc(0x30);
    m.setU32(pGame + 0x10f4, pQuestControl);
    m.setU32(pQuestControl + 0x14, 10);

    const pNode = m.alloc(0x20);
    m.setU32(pNode, 0x6fc53b70);
    m.setU32(pNode + 8, 5);
    m.setU32(pNode + 0xc, 25);
    m.setU32(pQuestControl + 0x10, pNode);

    QUESTS_StepQuestTimers113c(m, pGame);
    expect(m.u32(pQuestControl + 0x14)).toBe(11);
    expect(m.u32(pNode + 8)).toBe(36);
    expect(m.u32(pQuestControl + 4)).toBe(0);
  });

  it('ports F24 Act 1 NPC quest alerts, client packets, and AI target scanners (17 VAs)', () => {
    const m = createTestMem();
    const pClient = m.alloc(0x400);
    m.setU8(pClient + 0x1ac, 2);
    expect(SPLAYER_GetClientActNo113c(m, pClient)).toBe(2);

    const pQuest = m.alloc(0x100);
    const pQuestData = m.alloc(0x200);
    m.setU32(pQuest + 0x18, pQuestData);
    m.setU32(pQuest + 0xe0, 1);
    const pQuestFlags = m.alloc(0x80);
    const pPlayer = m.alloc(0x100);
    m.setU32(pPlayer + 0xc, 42);

    m.setU8(pQuest + 0xc, 1);
    expect(ACT1Q1_CheckDenOfEvilNpcAlert113c(m, pQuest, 0x96, pPlayer, pQuestFlags, 0)).toBe(1);
    expect(ACT1Q1_CheckDenOfEvilNpcAlert113c(m, pQuest, 0x94, pPlayer, pQuestFlags, 0)).toBe(0);

    m.setU8(pQuest + 9, 1);
    expect(ACT1Q2_CheckBloodRavenNpcAlert113c(m, pQuest, 0x94, pPlayer, pQuestFlags, 0)).toBe(1);

    expect(ACT1Q0_CheckWarrivIntroNpcAlert113c(m, pQuest, 0x9b, pPlayer, pQuestFlags, 0)).toBe(1);
    expect(ACT1Q0_CheckWarrivIntroNpcAlert113c(m, pQuest, 0x94, pPlayer, pQuestFlags, 0)).toBe(0);

    expect(ACT1Q6_CheckTravelEastNpcAlert113c(m, pQuest, 0x94, pPlayer, pQuestFlags, 0)).toBe(0);

    m.setU16(pQuestData + 0x80, 1);
    m.setU32(pQuestData, 42);
    expect(ACT1Q5_CheckCharsiImbueNpcAlert113c(m, pQuest, 0x109, pPlayer, pQuestFlags, 0)).toBe(1);

    m.setU16(pQuestData + 0x64, 1);
    m.setU32(pQuestData + 0x34, 42);
    expect(ACT1Q4_CheckCainTownNpcAlert113c(m, pQuest, 0x94, pPlayer, pQuestFlags, 0)).toBe(1);
    expect(ACT1Q4_CheckCainTownNpcAlert113c(m, pQuest, 0x9b, pPlayer, pQuestFlags, 0)).toBe(0);

    m.setU8(pQuest + 0xc, 1);
    expect(ACT1Q4_CheckSearchForCainNpcAlert113c(m, pQuest, 0x94, pPlayer, pQuestFlags, 0)).toBe(1);

    expect(ACT1Q3_CheckMalusNpcAlert113c(m, pQuest, 0x9a, pPlayer, pQuestFlags, 0)).toBe(1);

    const pGame = m.alloc(0x2000);
    m.setU32(pQuest + 4, pGame);
    const pPlayerData = m.alloc(0x100);
    m.setU32(pPlayer + 0x14, pPlayerData);
    m.setU32(pPlayerData + 0x10, pQuestFlags);
    const pIntroWrap = m.alloc(8);
    const pIntroInner = m.alloc(8);
    const pIntroBits = m.alloc(16);
    m.setU32(pPlayerData + 0x60, pIntroWrap);
    m.setU32(pIntroWrap, pIntroInner);
    m.setU32(pIntroInner, pIntroBits);
    expect(ACT1Q2_CheckAkaraIntroNpcAlert113c(m, pQuest, 0x94, pPlayer, pQuestFlags, 0)).toBe(1);

    const pNpc = m.alloc(0x100);
    m.setU32(pNpc, 1);
    m.setU32(pNpc + 4, 0);
    expect(QUESTS_CheckNpcQuestInteractAlert113c(m, pPlayer, pGame, pNpc)).toBe(0);

    const pkt6 = m.alloc(6);
    m.setU8(pkt6, 0x8a);
    m.setU8(pkt6 + 1, 1);
    m.setU32(pkt6 + 2, 0x12345678);
    D2NET_SendPacket0x06BytesToClient113c(m, pkt6, pClient);
    const pNetNode = m.u32(pClient + 0x1bc);
    expect(pNetNode).toBeGreaterThan(0);
    expect(m.u32(pNetNode)).toBe(6);
    expect(m.u8(pNetNode + 4)).toBe(0x8a);

    m.setU32(pClient + 0x1a8, pGame);
    D2NET_SendUnitPosSync0x15ToClient113c(m, 99, 1, pClient, 0, 100, 200, 0);

    const pPath = m.alloc(0x200);
    m.setU32(pPath + 0x30, pPlayer);
    m.setU32(pPlayer + 0x2c, pPath);
    const pPathSync = m.alloc(0x20);
    expect(PLAYER_RecalcTargetUnitPath113c(m, 5, pPathSync, pPlayer, 0)).toBe(0);

    expect(AITARGET_IterateRoomActiveClients113c(m, pGame, pPlayer, 0, 0)).toBe(0);
    expect(AITARGET_ScanUnitsByModeTable113c(m, 0, 0, pGame, pPlayer, 0)).toBe(0);
    expect(AI_FindNearestPlayerCallback113c(m, pGame, pNpc, 0, 0)).toBe(0);
  });

  it('ports F40/F67/F78/a1-town-walk player mode, room sync, and move packet VAs (11 VAs)', () => {
    const m = createTestMem();
    const pGame = m.alloc(0x2000);
    const pPlayer = m.alloc(0x400);
    const pPath = m.alloc(0x200);
    m.setU32(pPlayer, 0);
    m.setU32(pPlayer + 0x10, 1);
    m.setU32(pPlayer + 0x2c, pPath);

    expect(AITHINK_CanPlayerStartSkillOrCast113c(m, pPlayer, pGame, 2, 0, 0)).toBe(1);
    expect(AITHINK_CanPlayerSwitchToMode113c(m, pPlayer, pGame, 2)).toBe(1);

    const pClient = m.alloc(0x400);
    m.setU8(pClient + 0x3d4, 1);
    m.setU32(pClient + 0x174, 0);
    expect(SPLAYER_BroadcastUnitMovementToClient113c(m, pGame, pPlayer, pClient, 2)).toBe(1);

    expect(SUNIT_FindValidNextRoomInAct113c(m, pPlayer, pGame)).toBe(0);
    SUNIT_UpdateUnitPositionAndRoom113c(m, 0, pPlayer, pGame);

    D2NET_SendUnitMovePacket0x10BytesToClient113c(m, 0x0f, 1, pClient, 0x01, 5100, 5200, 0, 0, 5090, 5190);
    const pTail = m.u32(pClient + 0x1bc);
    expect(pTail).toBeGreaterThan(0);
    expect(m.u32(pTail)).toBe(32);
  });
});
