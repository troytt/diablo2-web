import { describe, expect, it } from 'vitest';
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts';
import { QUESTRECORD_SetQuestState113c } from '../../../src/d2kern-113c/common/quest-record.ts';
import {
  QUESTS_GuidListAdd113c,
  QUESTS_GuidListContains113c,
} from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c.ts';
import { QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c } from '../../../src/d2kern-113c/game/k2-w2b2-113c.ts';
import {
  ACT1Q0_Callback00_WarrivIntroActivate_6FC82410_113c,
  ACT1Q1_Callback00_NpcActivate_6FC82220_113c,
  ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c,
  ACT1Q1_CompleteDenOfEvilPartyCallback_6FC821B0_113c,
  ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c,
  ACT1Q2_Callback00_NpcActivate_6FC81F50_113c,
  ACT1Q2_Callback13_RefreshQuestState_6FC81E30_113c,
  ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c,
  ACT1Q2_CompleteBloodRavenPartyCallback_6FC81EC0_113c,
  ACT1Q2_PlayBloodRavenDefeatedSoundCallback_6FC82B40_113c,
  ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c,
  ACT1Q3_Callback00_NpcActivate_6FC81030_113c,
  ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c,
  ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c,
  ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c,
  ACT1Q3_OnCatacombsLevel4EnteredCallback_6FC80F70_113c,
  ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c,
  ACT1Q4_Callback13_RefreshQuestState_6FC81540_113c,
  ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c,
  ACT1Q4_InitInifussTreeObject_6FC828D0_113c,
  ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c,
  ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c,
  ACT1Q4_SpawnTristramPortalObject_6FC81340_113c,
  ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c,
  ACT1Q5_Callback00_NpcActivate_6FC81C60_113c,
  ACT1Q5_Callback13_RefreshQuestState_6FC81A80_113c,
  ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c,
  ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c,
  ACT1Q6_Callback00_NpcActivate_6FC80A80_113c,
  ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c,
  ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c,
  ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c,
  ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c,
  ACT1_IntroCainActivate_6FC824D0_113c,
  ACT1_IntroNpcActivate_6FC82E50_113c,
  ACT5Q2_UpdatePrisonDoorObjectTimer_6FC7EE30_113c,
  ACT5Q3_InitFrozenAnyaObject_6FC7E8D0_113c,
  ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c,
  ACT5Q3_UpdateAnyaObjectTimer_6FC7E840_113c,
  ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c,
  ACT5Q5_DeactivateAncientStatuesAndReset_6FC7E560_113c,
  ACT5Q5_ResetAncientMonsterToStatue_6FC7E000_113c,
  QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c,
  QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c,
  QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c,
} from '../../../src/d2kern-113c/game/k2-w3b6-113c.ts';
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

function seedBitMasks(m: SparseMemory113c): void {
  const bitMasks = m.alloc(32 * 4);
  for (let i = 0; i < 32; i++) {
    m.setU32(bitMasks + i * 4, (1 << i) >>> 0);
  }
  m.setU32(0x6fdd90b0, bitMasks);
}

function createPlayerWithQuestFlags(
  m: SparseMemory113c,
  nDiff = 0,
): {
  pGame: number;
  pPlayer: number;
  pPlayerData: number;
  pQuestFlags: number;
  pQuestBuf: number;
  pClient: number;
} {
  seedBitMasks(m);
  const pGame = m.alloc(0x1e00);
  m.setU8(pGame + 0x6d, nDiff & 0xff);
  EVENT_InitTimerQueue113c(m, pGame);

  const pPlayer = m.alloc(0x100);
  m.setU32(pPlayer + 0x00, 0);
  m.setU32(pPlayer + 0x0c, 0x1234);

  const pPlayerData = m.alloc(0x100);
  m.setU32(pPlayer + 0x14, pPlayerData);

  const pQuestFlags = m.alloc(0x10);
  const pQuestBuf = m.alloc(0x100);
  m.setU32(pQuestFlags, pQuestBuf);
  m.setU32(pPlayerData + 0x10 + nDiff * 4, pQuestFlags);

  const pIntroData = m.alloc(0x10);
  const pIntroHolder = m.alloc(0x10);
  m.setU32(pIntroHolder, m.alloc(0x40));
  m.setU32(pIntroData, pIntroHolder);
  m.setU32(pIntroData + 0x04, pIntroHolder);
  m.setU32(pPlayerData + 0x60 + nDiff * 4, pIntroData);

  const pClient = m.alloc(0x200);
  const pQueue = m.alloc(0x400);
  m.setU32(pClient + 0x1bc, pQueue);
  m.setU32(pPlayerData + 0x9c, pClient);

  return { pGame, pPlayer, pPlayerData, pQuestFlags, pQuestBuf, pClient };
}

function attachUnitRoomLevel(m: SparseMemory113c, pUnit: number, nLevelId: number): number {
  const uType = m.u32(pUnit + 0x00);
  if (uType === 2 && m.u32(pUnit + 0x14) === 0) {
    const pObjData = m.alloc(0x40);
    const pObjTxt = m.alloc(0x200);
    m.setU32(pObjData, pObjTxt);
    m.setU32(pUnit + 0x14, pObjData);
  }
  const pPath = m.alloc(0x40);
  const pRoom1 = m.alloc(0x80);
  const pRoom2 = m.alloc(0x80);
  const pLevel = m.alloc(0x200);
  m.setU32(pUnit + 0x2c, pPath);
  if (uType <= 1 || uType === 3) {
    m.setU32(pPath + 0x1c, pRoom1);
  } else {
    m.setU32(pPath + 0x00, pRoom1);
  }
  m.setU32(pRoom1 + 0x10, pRoom2);
  m.setU32(pRoom2 + 0x58, pLevel);
  m.setU32(pLevel + 0x1d0, nLevelId >>> 0);
  return pRoom1;
}

function linkQuestInGame(
  m: SparseMemory113c,
  pGame: number,
  nQuestId: number,
): { pQuest: number; pQuestDataEx: number } {
  let pChain = m.u32(pGame + 0x10f4);
  if (pChain === 0) {
    pChain = m.alloc(0x10);
    const pGlobalFlags = m.alloc(0x10);
    m.setU32(pGlobalFlags, m.alloc(0x100));
    m.setU32(pChain + 0x08, pGlobalFlags);
    m.setU32(pGame + 0x10f4, pChain);
  }
  const pQuest = m.alloc(0x120);
  const pQuestDataEx = m.alloc(0x200);
  const pMsgTables = m.alloc(6 * 0xc4);
  m.setU32(pQuest + 0x00, nQuestId >>> 0);
  m.setU32(pQuest + 0x04, pGame);
  m.setU32(pQuest + 0x18, pQuestDataEx);
  m.setU32(pQuest + 0xdc, pMsgTables);
  m.setU32(pQuest + 0xe0, nQuestId >>> 0);
  m.setU32(pQuest + 0xf4, m.u32(pChain));
  m.setU32(pChain, pQuest);
  return { pQuest, pQuestDataEx };
}

describe('k2-w3b6-113c oracle tests (45 D2Game.dll functions)', () => {
  it('ACT5Q5_ResetAncientMonsterToStatue_6FC7E000_113c returns 0 when missing and 1 when found in monster hash', () => {
    const m = new SparseMemory113c();
    const { pGame } = createPlayerWithQuestFlags(m);
    expect(ACT5Q5_ResetAncientMonsterToStatue_6FC7E000_113c(m, pGame, 0x55)).toBe(0);

    const pMon = m.alloc(0x100);
    m.setU32(pMon + 0x00, 1);
    m.setU32(pMon + 0x0c, 0x55);
    m.setU32(pGame + 0x1320 + (0x55 & 0x7f) * 4, pMon);
    expect(ACT5Q5_ResetAncientMonsterToStatue_6FC7E000_113c(m, pGame, 0x55)).toBe(1);
  });

  it('ACT5Q5_DeactivateAncientStatuesAndReset_6FC7E560_113c resets 3 ancient statue objects', () => {
    const m = new SparseMemory113c();
    const { pGame } = createPlayerWithQuestFlags(m);
    const { pQuest, pQuestDataEx } = linkQuestInGame(m, pGame, 0x23);

    for (let i = 0; i < 3; i++) {
      const guid = 0x10 + i;
      const pObj = m.alloc(0x100);
      m.setU32(pObj + 0x00, 2);
      m.setU32(pObj + 0x0c, guid);
      attachUnitRoomLevel(m, pObj, 0x78);
      m.setU32(pGame + 0x1520 + (guid & 0x7f) * 4, pObj);
      m.setU32(pQuestDataEx + 0x14 + i * 4, guid);
    }
    m.setU32(pQuestDataEx + 0x40, 2);
    m.setU32(pQuestDataEx + 0x44, 3);

    expect(ACT5Q5_DeactivateAncientStatuesAndReset_6FC7E560_113c(m, pQuest, pQuestDataEx)).toBe(1);
    expect(m.u32(pQuestDataEx + 0x30)).toBe(3);
    expect(m.u32(pQuestDataEx + 0x40)).toBe(0);
    expect(m.u32(pQuestDataEx + 0x44)).toBe(0);
  });

  it('ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c clears +0x04 and returns 1 when inactive or all objects present', () => {
    const m = new SparseMemory113c();
    const { pGame } = createPlayerWithQuestFlags(m);
    const { pQuest, pQuestDataEx } = linkQuestInGame(m, pGame, 0x23);
    m.setU8(pQuestDataEx + 0x04, 1);
    m.setU8(pQuestDataEx + 0x11, 0);

    expect(ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c(m, pGame, pQuest)).toBe(1);
    expect(m.u8(pQuestDataEx + 0x04)).toBe(0);
  });

  it('ACT5Q3_UpdateAnyaObjectTimer_6FC7E840_113c advances mode 1 to 2 and schedules event 7', () => {
    const m = new SparseMemory113c();
    const { pGame } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 0x21);
    const pObj = m.alloc(0x100);
    m.setU32(pObj + 0x00, 2);
    m.setU32(pObj + 0x10, 1);
    attachUnitRoomLevel(m, pObj, 1);

    ACT5Q3_UpdateAnyaObjectTimer_6FC7E840_113c(m, pQuest, pObj);
    expect(m.u32(pObj + 0x10)).toBe(2);
  });

  it('ACT5Q3_InitFrozenAnyaObject_6FC7E8D0_113c records object GUID at +0xF8 when quest 0x21 is active', () => {
    const m = new SparseMemory113c();
    const { pGame } = createPlayerWithQuestFlags(m);
    const { pQuest, pQuestDataEx } = linkQuestInGame(m, pGame, 0x21);
    m.setU8(pQuest + 0x09, 1);
    m.setU8(pQuestDataEx + 0xa4, 1);

    const pObj = m.alloc(0x100);
    m.setU32(pObj + 0x00, 2);
    m.setU32(pObj + 0x0c, 0x7788);
    const pObjInit = m.alloc(0x20);
    m.setU32(pObjInit + 0x00, pGame);
    m.setU32(pObjInit + 0x04, pObj);

    ACT5Q3_InitFrozenAnyaObject_6FC7E8D0_113c(m, pObjInit);
    expect(m.u32(pQuestDataEx + 0xf8)).toBe(0x7788);
  });

  it('ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c returns early when +0xA4 is already set', () => {
    const m = new SparseMemory113c();
    const { pGame } = createPlayerWithQuestFlags(m);
    const { pQuest, pQuestDataEx } = linkQuestInGame(m, pGame, 0x21);
    m.setU8(pQuest + 0x09, 1);
    m.setU8(pQuestDataEx + 0xa4, 1);
    const pUnit = m.alloc(0x100);

    ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c(m, pGame, pUnit);
    expect(m.u8(pQuestDataEx + 0xa4)).toBe(1);
  });

  it('ACT5Q2_UpdatePrisonDoorObjectTimer_6FC7EE30_113c transitions matching prison door from mode 1 to 2', () => {
    const m = new SparseMemory113c();
    const { pGame } = createPlayerWithQuestFlags(m);
    const { pQuest, pQuestDataEx } = linkQuestInGame(m, pGame, 0x20);
    const pObj = m.alloc(0x100);
    m.setU32(pObj + 0x00, 2);
    m.setU32(pObj + 0x0c, 0x333);
    m.setU32(pObj + 0x10, 1);
    attachUnitRoomLevel(m, pObj, 1);
    m.setU32(pQuestDataEx + 0xf0, 0x333);

    ACT5Q2_UpdatePrisonDoorObjectTimer_6FC7EE30_113c(m, pQuest, pObj);
    expect(m.u32(pObj + 0x10)).toBe(2);
  });

  it('QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c returns 1 when active or chains to next quest', () => {
    const m = new SparseMemory113c();
    const { pGame } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 1);
    m.setU8(pQuest + 0x09, 1);
    m.setU8(pQuest + 0x0c, 1);
    expect(QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c(m, pQuest)).toBe(1);

    m.setU8(pQuest + 0x09, 0);
    m.setU32(pQuest + 0x10, 99);
    expect(QUESTS_CheckFirstTimeActiveOrChainRefresh_6FC801B0_113c(m, pQuest)).toBe(0);
  });

  it('ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c removes GUID from first and second compact lists', () => {
    const m = new SparseMemory113c();
    const pQuestDataEx = m.alloc(0x80);
    m.setU32(pQuestDataEx + 0x00, 0x111);
    m.setU32(pQuestDataEx + 0x04, 0x222);
    m.setU16(pQuestDataEx + 0x30, 2);

    expect(ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c(m, pQuestDataEx, 0, 0x111)).toBe(1);
    expect(m.u16(pQuestDataEx + 0x30)).toBe(1);
    expect(m.u32(pQuestDataEx + 0x00)).toBe(0x222);

    m.setU32(pQuestDataEx + 0x34, 0x333);
    m.setU16(pQuestDataEx + 0x64, 1);
    expect(ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c(m, pQuestDataEx, 1, 0x333)).toBe(1);
    expect(m.u16(pQuestDataEx + 0x64)).toBe(0);
  });

  it('QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c checks bLastState != 5 && bNotIntro != 0 or chains', () => {
    const m = new SparseMemory113c();
    const { pGame } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 2);
    m.setU8(pQuest + 0x09, 1);
    m.setU8(pQuest + 0x0c, 3);
    expect(QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c(m, pQuest)).toBe(1);

    m.setU8(pQuest + 0x0c, 5);
    m.setU32(pQuest + 0x10, 99);
    expect(QUESTS_CheckActiveOrChainRefresh_6FC806E0_113c(m, pQuest)).toBe(0);
  });

  it('ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c updates fState and fLastState from player flags', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 6);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 4);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x00, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);

    ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c(m, pQuest, pQuestArg);
    expect(m.u8(pQuest + 0x0b)).toBe(2);
    expect(m.u8(pQuest + 0x0c)).toBe(3);
  });

  it('ACT1Q6_Callback00_NpcActivate_6FC80A80_113c handles Sisters to the Slaughter NPC dialog dispatch', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 6);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 6, 0);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x00, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);

    ACT1Q6_Callback00_NpcActivate_6FC80A80_113c(m, pQuest, pQuestArg);
    expect(m.u32(0x6fd2a024 + 4)).toBe(0);
  });

  it('ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c updates player quest 6 state from bLastState', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 6);
    m.setU8(pQuest + 0x0c, 2);

    expect(ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c(m, pGame, pPlayer)).toBe(0);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 2)).toBe(1);
  });

  it('ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c refreshes quest 5 state from player flags', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 5);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 5);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x00, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);

    ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c(m, pQuest, pQuestArg);
    expect(m.u8(pQuest + 0x0b)).toBe(3);
    expect(m.u8(pQuest + 0x0c)).toBe(2);
  });

  it('ACT1Q3_OnCatacombsLevel4EnteredCallback_6FC80F70_113c records player in level 0x19 and sets quest 5 bits 0 and 0x0D', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuestDataEx } = linkQuestInGame(m, pGame, 5);
    attachUnitRoomLevel(m, pPlayer, 0x19);

    expect(ACT1Q3_OnCatacombsLevel4EnteredCallback_6FC80F70_113c(m, pGame, pPlayer)).toBe(0);
    expect(QUESTS_GuidListContains113c(m, pQuestDataEx + 0x8c, 0x1234)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0x0d)).toBe(1);
  });

  it('ACT1Q3_Callback00_NpcActivate_6FC81030_113c handles Tools of the Trade NPC dialog dispatch', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 5);
    m.setU8(pQuest + 0x09, 1);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 5, 0);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x00, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);

    ACT1Q3_Callback00_NpcActivate_6FC81030_113c(m, pQuest, pQuestArg);
    expect(m.u32(0x6fd2a00c + 8)).toBe(0);
  });

  it('ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c removes player GUID from all 3 quest 5 lists', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer } = createPlayerWithQuestFlags(m);
    const { pQuest, pQuestDataEx } = linkQuestInGame(m, pGame, 5);
    QUESTS_GuidListAdd113c(m, pQuestDataEx + 0x8c, 0x1234);
    m.setU32(pQuestDataEx + 0x00, 0x1234);
    m.setU16(pQuestDataEx + 0x30, 1);
    m.setU32(pQuestDataEx + 0x34, 0x1234);
    m.setU16(pQuestDataEx + 0x64, 1);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x0c, pPlayer);
    ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c(m, pQuest, pQuestArg);

    expect(QUESTS_GuidListContains113c(m, pQuestDataEx + 0x8c, 0x1234)).toBe(0);
    expect(m.u16(pQuestDataEx + 0x30)).toBe(0);
    expect(m.u16(pQuestDataEx + 0x64)).toBe(0);
  });

  it('ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c maps quest 5 state to player flag bits', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 5);
    m.setU8(pQuest + 0x0c, 3);
    m.setU8(pQuest + 0x0b, 3);

    expect(ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c(m, pGame, pPlayer)).toBe(0);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 5)).toBe(1);
  });

  it('ACT1Q4_SpawnTristramPortalObject_6FC81340_113c shifts coordinates by +3 when no room contains subtile', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer } = createPlayerWithQuestFlags(m);
    const { pQuestDataEx } = linkQuestInGame(m, pGame, 4);
    m.setU32(pQuestDataEx + 0x9c, 100);
    m.setU32(pQuestDataEx + 0xa0, 200);

    expect(ACT1Q4_SpawnTristramPortalObject_6FC81340_113c(m, pGame, pPlayer)).toBe(1);
    expect(m.u32(pQuestDataEx + 0x9c)).toBe(103);
    expect(m.u32(pQuestDataEx + 0xa0)).toBe(203);
  });

  it('ACT1Q4_Callback13_RefreshQuestState_6FC81540_113c refreshes Search for Cain state from player flags', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest, pQuestDataEx } = linkQuestInGame(m, pGame, 4);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 4, 4);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x00, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);

    ACT1Q4_Callback13_RefreshQuestState_6FC81540_113c(m, pQuest, pQuestArg);
    expect(m.u8(pQuestDataEx + 0x4c)).toBe(1);
    expect(m.u8(pQuestDataEx + 0x4d)).toBe(1);
    expect(m.u8(pQuestDataEx + 0x4e)).toBe(1);
    expect(m.u8(pQuestDataEx + 0x58)).toBe(1);
    expect(m.u8(pQuestDataEx + 0x78)).toBe(1);
    expect(m.u8(pQuest + 0x0b)).toBe(4);
    expect(m.u8(pQuest + 0x0c)).toBe(5);
  });

  it('ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c sets quest 4 bit 0x0E and records player GUID', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuestDataEx } = linkQuestInGame(m, pGame, 4);

    expect(ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c(m, pGame, pPlayer)).toBe(0);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0x0e)).toBe(1);
    expect(QUESTS_GuidListContains113c(m, pQuestDataEx + 0xb4, 0x1234)).toBe(1);
  });

  it('ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c sets quest 4 bit 3 when bLastState is 4', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 4);
    m.setU8(pQuest + 0x0c, 4);

    expect(ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c(m, pGame, pPlayer)).toBe(0);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 3)).toBe(1);
  });

  it('ACT1Q5_Callback13_RefreshQuestState_6FC81A80_113c refreshes quest 3 state from player flags', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 3);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 3, 3);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x00, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);

    ACT1Q5_Callback13_RefreshQuestState_6FC81A80_113c(m, pQuest, pQuestArg);
    expect(m.u8(pQuest + 0x0c)).toBe(3);
    expect(m.u8(pQuest + 0x0b)).toBe(1);
  });

  it('ACT1Q5_Callback00_NpcActivate_6FC81C60_113c seeds dialog table and handles Charsi quest 3 activation', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 3);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 3, 0);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x00, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);

    ACT1Q5_Callback00_NpcActivate_6FC81C60_113c(m, pQuest, pQuestArg);
    expect(m.u32(0x6fd29390 + 4)).toBe(0);
  });

  it('ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c updates player quest 3 state', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 3);
    m.setU8(pQuest + 0x0c, 3);

    expect(ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c(m, pGame, pPlayer)).toBe(0);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 3)).toBe(1);
  });

  it('ACT1Q2_Callback13_RefreshQuestState_6FC81E30_113c refreshes quest 2 state from player flags', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 2);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 2, 4);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x00, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);

    ACT1Q2_Callback13_RefreshQuestState_6FC81E30_113c(m, pQuest, pQuestArg);
    expect(m.u8(pQuest + 0x0b)).toBe(2);
    expect(m.u8(pQuest + 0x0c)).toBe(3);
  });

  it('ACT1Q2_CompleteBloodRavenPartyCallback_6FC81EC0_113c marks quest 2 bits 0x0D and 1 for Act 1 players', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    attachUnitRoomLevel(m, pPlayer, 17);

    ACT1Q2_CompleteBloodRavenPartyCallback_6FC81EC0_113c(m, pGame, pPlayer);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 0x0d)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 1)).toBe(1);
  });

  it('ACT1Q2_Callback00_NpcActivate_6FC81F50_113c seeds dialog table and handles Kashya activation', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 2);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 2, 0);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x00, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);

    ACT1Q2_Callback00_NpcActivate_6FC81F50_113c(m, pQuest, pQuestArg);
    expect(m.u32(0x6fd28ee0 + 4)).toBe(0);
  });

  it('ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c updates player quest 2 state', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 2);
    m.setU8(pQuest + 0x0c, 3);
    m.setU8(pQuest + 0x0b, 2);

    expect(ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c(m, pGame, pPlayer)).toBe(0);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 4)).toBe(1);
  });

  it('ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c refreshes Den of Evil quest state', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 1);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 1, 3);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x00, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);

    ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c(m, pQuest, pQuestArg);
    expect(m.u8(pQuest + 0x0c)).toBe(3);
    expect(m.u8(pQuest + 0x0b)).toBe(1);
  });

  it('ACT1Q1_CompleteDenOfEvilPartyCallback_6FC821B0_113c marks quest 1 bits 0x0D and 1 for Act 1 players', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    attachUnitRoomLevel(m, pPlayer, 8);

    ACT1Q1_CompleteDenOfEvilPartyCallback_6FC821B0_113c(m, pGame, pPlayer);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 0x0d)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 1)).toBe(1);
  });

  it('ACT1Q1_Callback00_NpcActivate_6FC82220_113c seeds dialog table and handles Akara activation', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 1);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 1, 0);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x00, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);

    ACT1Q1_Callback00_NpcActivate_6FC82220_113c(m, pQuest, pQuestArg);
    expect(m.u32(0x6fd28a30 + 4)).toBe(0);
  });

  it('ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c updates player quest 1 state', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 1);
    m.setU8(pQuest + 0x0c, 2);

    expect(ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c(m, pGame, pPlayer)).toBe(0);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 1, 2)).toBe(1);
  });

  it('ACT1Q0_Callback00_WarrivIntroActivate_6FC82410_113c ignores non-Warriv NPCs and handles Warriv intro', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 0);
    const pNpc = m.alloc(0x40);
    m.setU32(pNpc + 0x04, 0x9b);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x08, pNpc);
    m.setU32(pQuestArg + 0x0c, pPlayer);

    ACT1Q0_Callback00_WarrivIntroActivate_6FC82410_113c(m, pQuest, pQuestArg);
    expect(m.u32(pNpc + 0x04)).toBe(0x9b);
  });

  it('ACT1_IntroCainActivate_6FC824D0_113c advances player seed when Cain (0x10A) is activated', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 1);
    m.setU32(pPlayer + 0x20, 12345);
    const pNpc = m.alloc(0x40);
    m.setU32(pNpc + 0x04, 0x10a);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg + 0x00, pGame);
    m.setU32(pQuestArg + 0x08, pNpc);
    m.setU32(pQuestArg + 0x0c, pPlayer);

    ACT1_IntroCainActivate_6FC824D0_113c(m, pQuest, pQuestArg);
    expect(m.u32(pPlayer + 0x20)).not.toBe(12345);
  });

  it('ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c sets quest 6 states 0x0D and 1 and updates client progress word', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags, pClient } = createPlayerWithQuestFlags(m, 1);
    m.setU16(pClient + 0x0a, 0x0020);

    ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c(m, pPlayer, pQuestFlags, pGame);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 0x0d)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 6, 1)).toBe(1);
    expect((m.u16(pClient + 0x0a) >>> 8) & 0x0f).toBe(6);
  });

  it('ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c completes quest 5 in level 0x19 and sets 0x0E elsewhere', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuestDataEx } = linkQuestInGame(m, pGame, 5);
    attachUnitRoomLevel(m, pPlayer, 0x19);

    expect(ACT1Q3_CompleteCharsiImbueInCatacombsCallback_6FC827A0_113c(m, pGame, pPlayer)).toBe(0);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0x0d)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 5, 0)).toBe(1);
    expect(m.u16(pQuestDataEx + 0x64)).toBe(1);
  });

  it('ACT1Q4_InitInifussTreeObject_6FC828D0_113c records Inifuss Tree object GUID (class 0x3D) on quest 4', () => {
    const m = new SparseMemory113c();
    const { pGame } = createPlayerWithQuestFlags(m);
    const { pQuestDataEx } = linkQuestInGame(m, pGame, 4);
    const pObj = m.alloc(0x100);
    m.setU32(pObj + 0x00, 2);
    m.setU32(pObj + 0x04, 0x3d);
    m.setU32(pObj + 0x0c, 0x7788);

    const pObjInit = m.alloc(0x10);
    m.setU32(pObjInit + 0x00, pGame);
    m.setU32(pObjInit + 0x04, pObj);

    ACT1Q4_InitInifussTreeObject_6FC828D0_113c(m, pObjInit);
    expect(m.u8(pQuestDataEx + 0x49)).toBe(1);
    expect(m.u32(pQuestDataEx + 0x28)).toBe(0x7788);
  });

  it('ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c sets quest 4 states 0x0D and 1 for Act 1 players', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    attachUnitRoomLevel(m, pPlayer, 1);

    ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c(m, pGame, pPlayer);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 0x0d)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 1)).toBe(1);
  });

  it('ACT1Q2_PlayBloodRavenDefeatedSoundCallback_6FC82B40_113c sets sound 0x22 on players with quest 2 bit 0x0D', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 2, 0x0d);

    expect(ACT1Q2_PlayBloodRavenDefeatedSoundCallback_6FC82B40_113c(m, pGame, pPlayer)).toBe(0);
    expect(m.u16(pPlayer + 0x6e)).toBe(0x22);
    expect(m.u32(pPlayer + 0xc4) & 0x400).toBe(0x400);
  });

  it('ACT1_IntroNpcActivate_6FC82E50_113c and ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c manage Act 1 NPC intro flags', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer } = createPlayerWithQuestFlags(m);
    const { pQuest } = linkQuestInGame(m, pGame, 0);
    const pNpc = m.alloc(0x40);
    m.setU32(pNpc + 0x04, 0x94);

    const pQuestArg = m.alloc(0x24);
    m.setU32(pQuestArg + 0x00, pGame);
    m.setU32(pQuestArg + 0x08, pNpc);
    m.setU32(pQuestArg + 0x0c, pPlayer);
    m.setU32(pQuestArg + 0x14, 0x94);
    m.setU16(pQuestArg + 0x18, 0x0b);

    ACT1_IntroNpcActivate_6FC82E50_113c(m, pQuest, pQuestArg);
    expect(QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(m, pPlayer, 0x94, pGame)).toBe(0);

    ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c(m, pQuest, pQuestArg);
    expect(QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c(m, pPlayer, 0x94, pGame)).toBe(4);
  });

  it('QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c completes quest and plays sound for GUID list players', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    m.setU32(pGame + 0x1120 + (0x1234 & 0x7f) * 4, pPlayer);

    const pGuidList = m.alloc(0x90);
    QUESTS_GuidListAdd113c(m, pGuidList, 0x1234);

    QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c(m, pGame, pGuidList, 2, 0x22);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 0x0d)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 0)).toBe(1);
    expect(m.u16(pPlayer + 0x6e)).toBe(0x22);
  });

  it('ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c completes quest 2 when player shares room with tracked monster', () => {
    const m = new SparseMemory113c();
    const { pGame, pPlayer, pQuestFlags } = createPlayerWithQuestFlags(m);
    const { pQuestDataEx } = linkQuestInGame(m, pGame, 2);
    const pRoom = attachUnitRoomLevel(m, pPlayer, 17);

    const pMon = m.alloc(0x100);
    m.setU32(pMon + 0x00, 1);
    m.setU32(pMon + 0x0c, 0x99);
    const pMonPath = m.alloc(0x40);
    m.setU32(pMonPath + 0x1c, pRoom);
    m.setU32(pMon + 0x2c, pMonPath);
    m.setU32(pGame + 0x1320 + (0x99 & 0x7f) * 4, pMon);

    m.setU8(pQuestDataEx + 0x02, 1);
    m.setU32(pQuestDataEx + 0x08, 0x99);

    expect(
      ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c(m, pGame, pPlayer, pMon),
    ).toBe(0);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 0x0d)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 2, 1)).toBe(1);
  });

  it('ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c marks cage flags and records cage coordinates', () => {
    const m = new SparseMemory113c();
    const { pGame } = createPlayerWithQuestFlags(m);
    const { pQuestDataEx } = linkQuestInGame(m, pGame, 4);

    const pCageObj = m.alloc(0x100);
    m.setU32(pCageObj + 0x00, 2);
    m.setU32(pCageObj + 0x0c, 0x333);
    const pObjPath = m.alloc(0x40);
    m.setU32(pObjPath + 0x0c, 150);
    m.setU32(pObjPath + 0x10, 250);
    m.setU32(pCageObj + 0x2c, pObjPath);
    m.setU32(pGame + 0x1520 + (0x333 & 0x7f) * 4, pCageObj);

    m.setU8(pQuestDataEx + 0x70, 1);
    m.setU32(pQuestDataEx + 0x6c, 0x333);

    ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c(m, pGame);
    expect(m.u8(pQuestDataEx + 0x91)).toBe(1);
    expect(m.u8(pQuestDataEx + 0x52)).toBe(1);
    expect(m.u32(pQuestDataEx + 0x84)).toBe(150);
    expect(m.u32(pQuestDataEx + 0x88)).toBe(250);
  });
});
