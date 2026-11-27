import { describe, expect, it } from 'vitest';
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
  DATATABLES_OFF_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.js';
import { SGPT_EXPERIENCE_TXT_PTR_VA_113C } from '../../../src/d2kern-113c/common/skills.js';
import { STATLIST_FLAG_EXTENDED } from '../../../src/d2kern-113c/common/statlist.js';
import {
  DATATABLES_LEVELS_TXT_COUNT_OFF_113C,
  DATATABLES_LEVELS_TXT_PTR_OFF_113C,
  GDW_WAYPOINT_TABLE_COUNT_VA_113C,
  GW_WAYPOINT_TABLE_BASE_VA_113C,
} from '../../../src/d2kern-113c/common/waypoint.js';
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.js';
import {
  ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c,
  ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c,
  ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c,
  ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c,
  ACT2Q2_IsQuestInState01_6FCE1B20_113c,
  ACT2Q2_IsQuestPastState01_6FCE1B60_113c,
  ACT2Q4_Callback00_Noop_6FCE1980_113c,
  ACT2Q4_CheckPlayerNearHorazonTomeCallback_6FCE1A40_113c,
  ACT2Q4_StatusFilter_6FCE1970_113c,
  ACT2Q5_StatusFilter_6FCE1960_113c,
  ACT4Prologue_ActiveFilter_6FCD8B50_113c,
  ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c,
  ACT4Prologue_StatusFilter_6FCD8B80_113c,
  ACT4Q0_StatusFilter_6FCD87D0_113c,
  ACT4Q1_BroadcastIzualQuestChatCallback_6FCD9C60_113c,
  ACT4Q1_Callback10_RemovePlayerGuid_6FCD94D0_113c,
  ACT4Q1_CheckPlayerNearIzualCallback_6FCD8A50_113c,
  ACT4Q1_SyncIzualQuestStateCallback_6FCD9CD0_113c,
  ACT4Q2_ActiveFilter_6FCD8810_113c,
  ACT4Q2_Callback04_ItemPickedUp_6FCD87F0_113c,
  ACT4Q2_Callback10_RemovePlayerGuid_6FCD8E60_113c,
  ACT4Q2_Callback14_PlayerJoined_6FCD8CC0_113c,
  ACT4Q2_InitHellforgeObject_6FCD8870_113c,
  ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c,
  ACT4Q2_SyncHellforgeQuestStateCallback_6FCD9920_113c,
  ACT4Q3_ActivateHarrogathWaypointForPlayer_6FCD9030_113c,
  ACT4Q3_Callback14_ClearState09IfAct5Incomplete_6FCD8FE0_113c,
  ACT4Q3_SyncDiabloQuestStateCallback_6FCD9BC0_113c,
  ACT4_InitObjectNoop_6FCD8930_113c,
  AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c,
  AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c,
  AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c,
  AIBAAL_NoopThink_6FCD6C80_113c,
  HIRELING_GetVendorNameIdRange_6FCDC7D0_113c,
  INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c,
  NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c,
  SKILLS_InitInfernoSeqFrames_6FCD3270_113c,
  SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c,
  SKILLS_SrvDo113_ExecuteCombatAndRestartSkill_6FCD4660_113c,
  SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c,
  SKILLS_SrvSt_AllocZeroDamageCombatForTarget_6FCD3EB0_113c,
  SKILLS_SrvSt_ClearUnitFlags0EAndMarkDeadCollision_6FCD31B0_113c,
  SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c,
  SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c,
  STATES_PurgeExpStateStatLists_6FCDC920_113c,
} from '../../../src/d2kern-113c/game/k2-w2b6-113c.js';
import { D2GAME_IAT_SGPT_DATATABLES_VA_113C } from '../../../src/d2kern-113c/game/regpop-spawn-113c.js';
import {
  D2HirelingTxt,
  D2HirelingTxt_SIZE,
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2SkillStrc,
  D2SkillsTxt,
  D2StatListExStrc,
  D2StatListStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.js';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js';
import {
  G_HIRELING_COUNT_VA_113C,
  G_HIRELING_TXT_VA_113C,
  HIRELING_TXT_SELLER_OFF_113C,
} from '../../../src/d2kern-113c/tables/monster-tbls-113c.js';

const ITEMS_TXT_COUNT_VA_113C = 0x6fdefb94;
const ITEMS_TXT_PTR_VA_113C = 0x6fdefb98;
const INVENTORY_SIGNATURE_113C = 0x01020304;
const ITEM_CODE_HELLFORGE_HAMMER_113C = 0x20686668;

function allocQuestRecord(m: SparseMemory113c): { pQuestRecord: number; pBuf: number } {
  const pQuestRecord = m.alloc(8);
  const pBuf = m.alloc(0x60);
  m.setU32(pQuestRecord, pBuf);
  return { pQuestRecord, pBuf };
}

function getQuestBit(m: SparseMemory113c, pQuestRecord: number, nQuest: number, nState: number): number {
  const pBuf = m.u32(pQuestRecord);
  const bitIdx = (nQuest << 4) + nState;
  return (m.u8(pBuf + (bitIdx >> 3)) & (1 << (bitIdx & 7))) !== 0 ? 1 : 0;
}

function setQuestBit(m: SparseMemory113c, pQuestRecord: number, nQuest: number, nState: number): void {
  const pBuf = m.u32(pQuestRecord);
  const bitIdx = (nQuest << 4) + nState;
  const addr = pBuf + (bitIdx >> 3);
  m.setU8(addr, m.u8(addr) | (1 << (bitIdx & 7)));
}

function linkQuestToGame(
  m: SparseMemory113c,
  pGame: number,
  nQuestId: number,
  bActive = 1,
  nQuestState = 1,
): { pQuest: number; pQuestDataEx: number } {
  let pQuestControl = m.u32(pGame + 0x10f4);
  if (pQuestControl === 0) {
    pQuestControl = m.alloc(0x20);
    m.setU32(pGame + 0x10f4, pQuestControl);
  }
  const pQuest = m.alloc(0x100);
  const pQuestDataEx = m.alloc(0x80);
  m.setU32(pQuest, nQuestId >>> 0);
  m.setU8(pQuest + 9, bActive & 0xff);
  m.setU8(pQuest + 0x0c, nQuestState & 0xff);
  m.setU32(pQuest + 0x18, pQuestDataEx);
  m.setU32(pQuest + 0xf4, m.u32(pQuestControl));
  m.setU32(pQuestControl, pQuest);
  return { pQuest, pQuestDataEx };
}

describe('K2 w2b6 (0x6FCD2E90..0x6FCE1F40)', () => {
  it('tests SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c and unit flag / collision skills', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    m.setU32(pUnit, 1); // monster
    m.setU32(pUnit + 0x44, 0x200); // dwFramePrecise -> nFrame = 2 > 0
    m.setU32(pUnit + 0x3c, 0x500);
    m.setU8(pUnit + 0x4e, 1);

    expect(SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c(m, 0, pUnit)).toBe(1);
    expect(m.u8(pUnit + 0x4e)).toBe(0);
    expect(m.u32(pUnit + 0x3c)).toBe(0x500);

    m.setU32(pUnit + 0x44, 0); // dwFramePrecise -> nFrame = 0 <= 0
    m.setU8(pUnit + 0x4e, 1);
    expect(SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c(m, 0, pUnit)).toBe(1);
    expect(m.u8(pUnit + 0x4e)).toBe(0);
    expect(m.u32(pUnit + 0x3c)).toBe(0);

    // SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c & SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c
    expect(SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c(m, 0, 0)).toBe(1);
    m.setU32(pUnit + 0xc4, 0x100);
    expect(SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c(m, 0, pUnit)).toBe(1);
    expect(m.u32(pUnit + 0xc4)).toBe(0x10e);

    expect(SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c(m, 0, 0)).toBe(1);
    expect(SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c(m, 0, pUnit)).toBe(1);
    expect(m.u32(pUnit + 0xc4)).toBe(0x100);

    // SKILLS_SrvSt_ClearUnitFlags0EAndMarkDeadCollision_6FCD31B0_113c
    const pPath = m.alloc(0x80);
    m.setU32(pUnit + 0x2c, pPath);
    m.setU32(pUnit + 0xc4, 0x10e);
    expect(SKILLS_SrvSt_ClearUnitFlags0EAndMarkDeadCollision_6FCD31B0_113c(m, 0, pUnit)).toBe(1);
    expect(m.u32(pUnit + 0xc4)).toBe(0x100);
  });

  it('tests SKILLS_InitInfernoSeqFrames_6FCD3270_113c for non-monsters and monsters', () => {
    const m = new SparseMemory113c();
    const pPlayer = m.alloc(0x100);
    const pSkillsTxt = m.alloc(0x200);
    m.setU32(pPlayer, 0); // UNIT_PLAYER
    m.setU32(pPlayer + 0x38, 0x35); // dwSeqFramePrecise lowByte = 0x35

    SKILLS_InitInfernoSeqFrames_6FCD3270_113c(m, pPlayer, pSkillsTxt);
    expect(m.u32(pPlayer + 0x38)).toBe(0x835);
    expect(m.u32(pPlayer + 0x48)).toBe(0x500);

    // Monster with valid MonStats2
    const pMonster = m.alloc(0x100);
    m.setU32(pMonster, 1); // UNIT_MONSTER
    m.setU32(pMonster + 4, 0); // classId 0
    m.setU32(pMonster + 0x38, 0x12);

    const sgptPtr = m.alloc(4);
    const pTables = m.alloc(0xc00);
    const pMonStats = m.alloc(0x200);
    const pMonStats2 = m.alloc(0x200);
    m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, sgptPtr);
    m.setU32(sgptPtr, pTables);
    m.setU32(pTables + 0xa80, 1); // nMonStatsCount = 1
    m.setU32(pTables + 0xa78, pMonStats);
    m.setU16(pMonStats + 0x18, 0); // wMonStatsEx = 0
    m.setU32(pTables + 0xa98, 1); // nMonStats2Count = 1
    m.setU32(pTables + 0xa90, pMonStats2);
    m.setU8(pMonStats2 + 0x109, 5); // uInfernoLen = 5

    // Anim mode != 0x0E -> sets +0x44 = 5 << 8
    m.setU8(pSkillsTxt + 0x11, 2);
    SKILLS_InitInfernoSeqFrames_6FCD3270_113c(m, pMonster, pSkillsTxt);
    expect(m.u32(pMonster + 0x44)).toBe(0x500);

    // Anim mode == 0x0E -> sets seqFrame = 4 and +0x48 = 6 << 8
    m.setU8(pSkillsTxt + 0x11, 0x0e);
    SKILLS_InitInfernoSeqFrames_6FCD3270_113c(m, pMonster, pSkillsTxt);
    expect(m.u32(pMonster + 0x38)).toBe(0x412);
    expect(m.u32(pMonster + 0x48)).toBe(0x600);
  });

  it('tests SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c, AllocZeroDamageCombat_6FCD3EB0, and ExecuteCombatAndRestartSkill_6FCD4660', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x1df4);
    const pUnit = m.alloc(0x100);
    const pTarget = m.alloc(0x100);
    const pPath = m.alloc(0x80);

    m.setU32(pUnit, 1);
    m.setU32(pUnit + 0x0c, 10);
    m.setU32(pUnit + 0x2c, pPath);

    m.setU32(pTarget, 1);
    m.setU32(pTarget + 0x0c, 20);
    SUNIT_InsertServerUnit113c(m, pGame, pTarget);

    // No target -> returns 0
    expect(SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c(m, pGame, pUnit)).toBe(0);
    expect(SKILLS_SrvSt_AllocZeroDamageCombatForTarget_6FCD3EB0_113c(m, pGame, pUnit)).toBe(0);
    expect(SKILLS_SrvDo113_ExecuteCombatAndRestartSkill_6FCD4660_113c(m, pGame, pUnit, 1, 1)).toBe(0);

    // Valid target registered in server unit hash
    m.setU32(pPath + 0x58, pTarget);
    m.setU32(pPath + 0x5c, 1);
    m.setU32(pPath + 0x60, 20);

    expect(SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c(m, pGame, pUnit)).toBe(1);
    expect(SKILLS_SrvSt_AllocZeroDamageCombatForTarget_6FCD3EB0_113c(m, pGame, pUnit)).toBe(1);
    const pCombat = m.u32(pUnit + D2UnitStrc.pCombat.off);
    expect(pCombat).not.toBe(0);

    // ExecuteCombatAndRestartSkill removes the combat node and attempts SKILLS_ExecuteSkillStart113c
    expect(SKILLS_SrvDo113_ExecuteCombatAndRestartSkill_6FCD4660_113c(m, pGame, pUnit, -1, 1)).toBe(0);
    expect(m.u32(pUnit + D2UnitStrc.pCombat.off)).toBe(0);
  });

  it('tests AIBAAL helpers (6FCD6C80..6FCD6D30)', () => {
    const m = new SparseMemory113c();
    AIBAAL_NoopThink_6FCD6C80_113c(m);

    // AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c
    const pExpTxt = m.alloc(0x20);
    m.setU32(pExpTxt, 99); // max skill level = 99
    m.setU32(SGPT_EXPERIENCE_TXT_PTR_VA_113C, pExpTxt);

    const pUnit = m.alloc(0x100);
    const pSkill = m.alloc(0x40);
    const pSkillsTxt = m.alloc(0x200);
    m.set(pSkill, D2SkillStrc.pSkillsTxt, pSkillsTxt);
    m.setU32(pSkill + 0x34, 0); // no bonus lookup

    expect(AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(m, 0, pUnit)).toBe(0);

    m.set(pSkillsTxt, D2SkillsTxt.wSkillId, 0x3b); // Blizzard
    expect(AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(m, pSkill, pUnit)).toBe(1);

    m.set(pSkillsTxt, D2SkillsTxt.wSkillId, 0x38); // Meteor
    expect(AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(m, pSkill, pUnit)).toBe(1);

    m.set(pSkillsTxt, D2SkillsTxt.wSkillId, 0x33); // Firewall (lvl > 3)
    m.setU32(pSkill + 0x28, 3);
    expect(AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(m, pSkill, pUnit)).toBe(0);
    m.setU32(pSkill + 0x28, 4);
    expect(AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(m, pSkill, pUnit)).toBe(1);

    m.set(pSkillsTxt, D2SkillsTxt.wSkillId, 0x1b); // Immolation Arrow (lvl > 7)
    m.setU32(pSkill + 0x28, 7);
    expect(AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(m, pSkill, pUnit)).toBe(0);
    m.setU32(pSkill + 0x28, 8);
    expect(AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(m, pSkill, pUnit)).toBe(1);

    m.set(pSkillsTxt, D2SkillsTxt.wSkillId, 0x20); // other skill
    expect(AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c(m, pSkill, pUnit)).toBe(0);

    // AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c
    const pSelfPtr = m.alloc(4);
    const pOutCount = m.alloc(4);
    const pMinion = m.alloc(0x100);
    m.setU32(pSelfPtr, pUnit);
    AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c(m, pUnit, pSelfPtr, pOutCount);
    AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c(m, 0, pSelfPtr, pOutCount);
    m.setU32(pMinion + 0x10, 0x0c); // corpse
    AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c(m, pMinion, pSelfPtr, pOutCount);
    expect(m.u32(pOutCount)).toBe(0);

    m.setU32(pMinion + 0x10, 1); // neutral/alive
    AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c(m, pMinion, pSelfPtr, pOutCount);
    expect(m.u32(pOutCount)).toBe(1);

    // AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c
    expect(() => AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c(m, 0, pMinion)).toThrow(D2CommonAssertError);
    expect(() => AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c(m, pUnit, 0)).toThrow(D2CommonAssertError);

    const pPath1 = m.alloc(0x40);
    const pPath2 = m.alloc(0x40);
    m.setU32(pUnit, 1);
    m.setU32(pMinion, 1);
    m.setU32(pUnit + 0x2c, pPath1);
    m.setU32(pMinion + 0x2c, pPath2);
    m.setU8(pUnit + 0x18, 4);
    m.setU8(pMinion + 0x18, 3);
    expect(AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c(m, pUnit, pMinion)).toBe(0);

    m.setU8(pMinion + 0x18, 4);
    m.setU16(pPath1 + 0x02, 100);
    m.setU16(pPath1 + 0x06, 100);
    m.setU16(pPath2 + 0x02, 110);
    m.setU16(pPath2 + 0x06, 110);
    expect(AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c(m, pUnit, pMinion)).toBe(1);

    m.setU16(pPath2 + 0x02, 2000);
    m.setU16(pPath2 + 0x06, 2000);
    expect(AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c(m, pUnit, pMinion)).toBe(0);
  });

  it('tests Act 4 quests and prologue helpers (6FCD87D0..6FCD9CD0)', () => {
    const m = new SparseMemory113c();
    expect(ACT4Q0_StatusFilter_6FCD87D0_113c(m)).toBe(0);
    expect(ACT4Prologue_StatusFilter_6FCD8B80_113c(m)).toBe(0);
    ACT4_InitObjectNoop_6FCD8930_113c(m);

    // Setup ItemsTxt table with item 0 = 'hfh '
    const pItemsTxt = m.alloc(D2ItemsTxt_SIZE * 2);
    m.setU32(ITEMS_TXT_COUNT_VA_113C, 2);
    m.setU32(ITEMS_TXT_PTR_VA_113C, pItemsTxt);
    m.set(pItemsTxt, D2ItemsTxt.dwCode, ITEM_CODE_HELLFORGE_HAMMER_113C);
    m.set(pItemsTxt + D2ItemsTxt_SIZE, D2ItemsTxt.dwCode, 0x20706163);

    const pGame = m.alloc(0x1df4);
    const { pQuest: pQ17, pQuestDataEx: pQ17Ex } = linkQuestToGame(m, pGame, 0x17, 1, 1);

    // ACT4Q2_Callback04_ItemPickedUp_6FCD87F0_113c
    const pHammer = m.alloc(0x100);
    m.setU32(pHammer, 4); // UNIT_ITEM
    m.setU32(pHammer + 4, 0); // classId 0 ('hfh ')
    const pQuestArg = m.alloc(0x40);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 8, pHammer);
    m.setU32(pQ17Ex + 0x10, 3);
    ACT4Q2_Callback04_ItemPickedUp_6FCD87F0_113c(m, pQ17, pQuestArg);
    expect(m.u32(pQ17Ex + 0x10)).toBe(2);

    // ACT4Q2_Callback14_PlayerJoined_6FCD8CC0_113c
    const pPlayer = m.alloc(0x100);
    const pPlayerData = m.alloc(0x100);
    const pInv = m.alloc(0x40);
    m.setU32(pPlayer, 0);
    m.setU32(pPlayer + 0x0c, 77);
    m.setU32(pPlayer + 0x14, pPlayerData);
    m.setU32(pPlayer + 0x60, pInv);
    m.setU32(pInv, INVENTORY_SIGNATURE_113C);
    m.setU32(pInv + 0x20, pHammer); // pCursorItem
    m.setU32(pQuestArg + 0x0c, pPlayer);
    ACT4Q2_Callback14_PlayerJoined_6FCD8CC0_113c(m, pQ17, pQuestArg);
    expect(m.u32(pQ17Ex + 0x10)).toBe(3);

    // ACT4Q2_ActiveFilter_6FCD8810_113c
    const { pQuestRecord } = allocQuestRecord(m);
    m.setU32(pPlayerData + 0x10, pQuestRecord);
    expect(ACT4Q2_ActiveFilter_6FCD8810_113c(m, pQ17, 0xf6, pPlayer, pQuestRecord)).toBe(1);
    expect(ACT4Q2_ActiveFilter_6FCD8810_113c(m, pQ17, 0x01, pPlayer, pQuestRecord)).toBe(0);
    m.setU8(pQ17Ex + 0x1c, 1);
    expect(ACT4Q2_ActiveFilter_6FCD8810_113c(m, pQ17, 0xf6, pPlayer, pQuestRecord)).toBe(0);

    // ACT4Q2_InitHellforgeObject_6FCD8870_113c
    const pObjInit = m.alloc(0x10);
    const pObject = m.alloc(0x100);
    m.setU32(pObjInit, pGame);
    m.setU32(pObjInit + 4, pObject);
    m.setU32(pQ17Ex + 0x40, 0);
    ACT4Q2_InitHellforgeObject_6FCD8870_113c(m, pObjInit);
    expect(m.u32(pQ17Ex + 0x40)).toBe(2);
    expect(m.u32(pObject + 0x10)).toBe(1);
    ACT4Q2_InitHellforgeObject_6FCD8870_113c(m, pObjInit);
    expect(m.u32(pObject + 0x10)).toBe(2);

    // ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c
    m.setU32(pGame + 0x70, 1); // expansion
    expect(ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c(m, pGame)).toBe(0);
    m.setU32(pGame + 0x70, 0); // classic
    m.setU8(pQ17Ex + 0x14, 0);
    expect(ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c(m, pGame)).toBe(0);
    m.setU8(pQ17Ex + 0x14, 1);
    expect(ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c(m, pGame)).toBe(1);

    // ACT4Q1_CheckPlayerNearIzualCallback_6FCD8A50_113c
    const pIzualEx = m.alloc(0x40);
    const pIzualGhost = m.alloc(0x100);
    m.setU32(pIzualEx + 0x14, pIzualGhost);
    ACT4Q1_CheckPlayerNearIzualCallback_6FCD8A50_113c(m, pGame, pPlayer, pIzualEx);
    expect(m.u8(pIzualEx + 0x18)).toBe(1);

    // ACT4Prologue_ActiveFilter_6FCD8B50_113c & ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c
    expect(ACT4Prologue_ActiveFilter_6FCD8B50_113c(m, pQ17, 0x16f, pPlayer, pQuestRecord)).toBe(1);
    expect(ACT4Prologue_ActiveFilter_6FCD8B50_113c(m, pQ17, 0x100, pPlayer, pQuestRecord)).toBe(0);
    m.setU16(pQuestArg + 0x14, 0x16f);
    m.setU16(pQuestArg + 0x18, 0x298);
    ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c(m, pQ17, pQuestArg);
    expect(getQuestBit(m, pQuestRecord, 0x18, 0)).toBe(1);
    expect(ACT4Prologue_ActiveFilter_6FCD8B50_113c(m, pQ17, 0x16f, pPlayer, pQuestRecord)).toBe(0);

    // ACT4Q2_Callback10_RemovePlayerGuid_6FCD8E60_113c & ACT4Q1_Callback10_RemovePlayerGuid_6FCD94D0_113c
    m.setU32(pQ17 + 0x1c, 77);
    m.setU16(pQ17 + 0x1c + 0x80, 1);
    expect(ACT4Q2_Callback10_RemovePlayerGuid_6FCD8E60_113c(m, pQ17, pQuestArg)).toBe(1);
    expect(m.u16(pQ17 + 0x1c + 0x80)).toBe(0);

    m.setU32(pQ17 + 0x1c, 77);
    m.setU16(pQ17 + 0x1c + 0x80, 1);
    expect(ACT4Q1_Callback10_RemovePlayerGuid_6FCD94D0_113c(m, pQ17, pQuestArg)).toBe(1);
    expect(m.u16(pQ17 + 0x1c + 0x80)).toBe(0);

    // ACT4Q3_Callback14_ClearState09IfAct5Incomplete_6FCD8FE0_113c
    m.setU32(pGame + 0x70, 1); // expansion
    setQuestBit(m, pQuestRecord, 0x1a, 9);
    ACT4Q3_Callback14_ClearState09IfAct5Incomplete_6FCD8FE0_113c(m, pQ17, pQuestArg);
    expect(getQuestBit(m, pQuestRecord, 0x1a, 9)).toBe(0);

    // ACT4Q3_ActivateHarrogathWaypointForPlayer_6FCD9030_113c
    const pTables = m.alloc(0xd00);
    const pLevelsBase = m.alloc(D2LevelsTxt_SIZE * 0x70);
    m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pTables);
    m.setU32(pTables + DATATABLES_LEVELS_TXT_COUNT_OFF_113C, 0x70);
    m.setU32(pTables + DATATABLES_LEVELS_TXT_PTR_OFF_113C, pLevelsBase);
    m.set(pLevelsBase + 0x6d * D2LevelsTxt_SIZE, D2LevelsTxt.nWaypoint, 30);
    m.setU32(GDW_WAYPOINT_TABLE_COUNT_VA_113C, 0x70);
    m.setU16(GW_WAYPOINT_TABLE_BASE_VA_113C + 30 * 4, 1);
    m.setU16(GW_WAYPOINT_TABLE_BASE_VA_113C + 30 * 4 + 2, 0x0040);
    const pWaypointData = m.alloc(0x20);
    m.setU32(pPlayerData + 0x1c, pWaypointData);
    ACT4Q3_ActivateHarrogathWaypointForPlayer_6FCD9030_113c(m, pGame, pPlayer);
    expect(m.u16(pWaypointData + 2) & 0x0040).toBe(0x0040);

    // Sync callbacks (6FCD9920, 6FCD9BC0, 6FCD9C60, 6FCD9CD0)
    expect(ACT4Q2_SyncHellforgeQuestStateCallback_6FCD9920_113c(m, pGame, pPlayer)).toBe(0);
    expect(getQuestBit(m, pQuestRecord, 0x1b, 0x0e)).toBe(1);

    expect(ACT4Q3_SyncDiabloQuestStateCallback_6FCD9BC0_113c(m, pGame, pPlayer)).toBe(0);
    expect(getQuestBit(m, pQuestRecord, 0x1a, 0x0e)).toBe(1);

    setQuestBit(m, pQuestRecord, 0x19, 0x0d);
    expect(ACT4Q1_BroadcastIzualQuestChatCallback_6FCD9C60_113c(m, pGame, pPlayer)).toBe(0);
    expect(m.u16(pPlayer + 0x6e)).toBe(0x4a);
    expect(m.u32(pPlayer + 0x70)).toBe(pPlayer);
    expect(m.u32(pPlayer + 0xc4) & 0x400).toBe(0x400);

    expect(ACT4Q1_SyncIzualQuestStateCallback_6FCD9CD0_113c(m, pGame, pPlayer)).toBe(0);
    expect(getQuestBit(m, pQuestRecord, 0x19, 0x0e)).toBe(1);
  });

  it('tests HIRELING, STATES, INVENTORY, and NPCTRADE helpers (6FCDC7D0..6FCDCB20)', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x1df4);
    const pOutLow = m.alloc(4);
    const pOutHigh = m.alloc(4);
    const pOutClass = m.alloc(4);

    // HIRELING_GetVendorNameIdRange_6FCDC7D0_113c: missing record
    const pHirelingBase = m.alloc(D2HirelingTxt_SIZE * 2);
    m.setU32(G_HIRELING_TXT_VA_113C, pHirelingBase);
    m.setU32(G_HIRELING_COUNT_VA_113C, 0);
    expect(
      HIRELING_GetVendorNameIdRange_6FCDC7D0_113c(m, 150, pOutLow, pOutHigh, pOutClass, pGame),
    ).toBe(-1);

    m.setU32(G_HIRELING_COUNT_VA_113C, 1);
    m.setU32(pHirelingBase + HIRELING_TXT_SELLER_OFF_113C, 150);
    m.set(pHirelingBase, D2HirelingTxt.dwDifficulty, 1);
    m.set(pHirelingBase, D2HirelingTxt.wVersion, 100);
    m.setU32(pHirelingBase + 8, 271);
    m.setU16(pHirelingBase + 0x114, 10);
    m.setU16(pHirelingBase + 0x116, 14);
    m.setU32(pGame + 0x70, 1); // expansion

    expect(
      HIRELING_GetVendorNameIdRange_6FCDC7D0_113c(m, 150, pOutLow, pOutHigh, pOutClass, pGame),
    ).toBe(5);
    expect(m.u32(pOutLow)).toBe(10);
    expect(m.u32(pOutHigh)).toBe(14);
    expect(m.u32(pOutClass)).toBe(271);

    // STATES_PurgeExpStateStatLists_6FCDC920_113c
    const sgptPtr = m.alloc(4);
    const pTables = m.alloc(0x200);
    const pExpMasks = m.alloc(0x20);
    const pBitMasks = m.alloc(0x80);
    for (let i = 0; i < 32; i++) {
      m.setU32(pBitMasks + i * 4, (1 << i) >>> 0);
    }
    m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks);
    m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pTables);
    m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, sgptPtr);
    m.setU32(sgptPtr, pTables);
    m.setU32(pTables + DATATABLES_OFF_113C.nStatesTxtRecordCount, 4);
    m.setU32(pTables + DATATABLES_OFF_113C.fStateMasksExp, pExpMasks);
    m.setU32(pExpMasks, 1 << 2); // state 2 is an exp state

    const pUnit = m.alloc(0x100);
    const pStatListEx = m.alloc(0x80);
    const pStateFlags = m.alloc(0x20);
    const pSubList = m.alloc(0x40);
    m.setU32(pUnit, 0);
    m.set(pUnit, D2UnitStrc.pStatListEx, pStatListEx);
    m.set(pStatListEx, D2StatListStrc.dwFlags, STATLIST_FLAG_EXTENDED);
    m.set(pStatListEx, D2StatListExStrc.pStateFlags, pStateFlags);
    m.setU32(pStateFlags, 1 << 2);
    m.set(pStatListEx, D2StatListExStrc.pMyLastList, pSubList);
    m.set(pSubList, D2StatListStrc.pParent, pStatListEx);
    m.set(pSubList, D2StatListStrc.dwStateNo, 2);

    expect(STATES_PurgeExpStateStatLists_6FCDC920_113c(m, pUnit)).toBe(1);
    expect(STATES_PurgeExpStateStatLists_6FCDC920_113c(m, pUnit)).toBe(0);

    // INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c
    expect(INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c(m, pUnit, 42)).toBe(0);
    const pInv = m.alloc(0x40);
    const pCursorItem = m.alloc(0x100);
    m.setU32(pInv, INVENTORY_SIGNATURE_113C);
    m.setU32(pInv + 0x20, pCursorItem);
    m.setU32(pCursorItem + 0x0c, 42);
    m.setU32(pUnit + 0x60, pInv);
    expect(INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c(m, pUnit, 42)).toBe(1);
    expect(INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c(m, pUnit, 99)).toBe(0);

    // NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c
    const pNpc = m.alloc(0x100);
    const pNpcControl = m.alloc(0x20);
    const pNpcTable = m.alloc(0x44 * 0x40);
    m.setU32(pNpc + 4, 148); // Akara
    m.setU32(pGame + 0x1d24, pNpcControl);
    m.setU32(pNpcControl + 4, pNpcTable);
    m.setU32(pNpcTable, 148);
    m.setU8(pNpcTable + 0x22, 0); // Act 1 -> cap 12

    m.setU8(pGame + 0x6d, 0); // Normal
    expect(NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c(m, pGame, pNpc, 25)).toBe(12);
    expect(NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c(m, pGame, pNpc, 8)).toBe(8);
    m.setU8(pGame + 0x6d, 1); // Nightmare -> unclamped
    expect(NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c(m, pGame, pNpc, 25)).toBe(25);
  });

  it('tests Act 2 quest helpers (6FCE1960..6FCE1F40)', () => {
    const m = new SparseMemory113c();
    expect(ACT2Q5_StatusFilter_6FCE1960_113c(m)).toBe(0);
    expect(ACT2Q4_StatusFilter_6FCE1970_113c(m)).toBe(0);
    ACT2Q4_Callback00_Noop_6FCE1980_113c(m);

    const pGame = m.alloc(0x1df4);
    // Before quest 0x0D is linked
    expect(ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c(m, pGame)).toBe(1);
    expect(ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c(m, pGame)).toBe(0);
    expect(ACT2Q2_IsQuestInState01_6FCE1B20_113c(m, pGame)).toBe(0);
    expect(ACT2Q2_IsQuestPastState01_6FCE1B60_113c(m, pGame)).toBe(1);

    const { pQuest: pQ0D, pQuestDataEx: pQ0DEx } = linkQuestToGame(m, pGame, 0x0d, 1, 1);
    expect(ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c(m, pGame)).toBe(0);
    expect(ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c(m, pGame)).toBe(1);
    expect(ACT2Q2_IsQuestInState01_6FCE1B20_113c(m, pGame)).toBe(1);
    expect(ACT2Q2_IsQuestPastState01_6FCE1B60_113c(m, pGame)).toBe(0);

    m.setU8(pQ0DEx + 0x0b, 1);
    m.setU8(pQ0D + 0x0c, 4);
    expect(ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c(m, pGame)).toBe(0);
    expect(ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c(m, pGame)).toBe(1);
    expect(ACT2Q2_IsQuestInState01_6FCE1B20_113c(m, pGame)).toBe(0);
    expect(ACT2Q2_IsQuestPastState01_6FCE1B60_113c(m, pGame)).toBe(1);

    // ACT2Q4_CheckPlayerNearHorazonTomeCallback_6FCE1A40_113c
    const pPlayer = m.alloc(0x100);
    const pTome = m.alloc(0x100);
    const pQ4Ex = m.alloc(0x60);
    m.setU32(pQ4Ex + 0x40, pTome);
    ACT2Q4_CheckPlayerNearHorazonTomeCallback_6FCE1A40_113c(m, pGame, pPlayer, pQ4Ex);
    expect(m.u8(pQ4Ex + 0x44)).toBe(1);

    // ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c & ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c
    const pOutCoord = m.alloc(8);
    expect(ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c(m, pGame, pOutCoord)).toBe(0);
    expect(ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c(m, pGame)).toBe(1);

    const { pQuestDataEx: pQ0BEx } = linkQuestToGame(m, pGame, 0x0b, 1, 1);
    m.setU32(pQ0BEx + 0x30, 500);
    m.setU32(pQ0BEx + 0x34, 600);
    m.setU8(pQ0BEx + 0x18, 1);
    expect(ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c(m, pGame, pOutCoord)).toBe(1);
    expect(m.u32(pOutCoord)).toBe(500);
    expect(m.u32(pOutCoord + 4)).toBe(600);
    expect(ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c(m, pGame)).toBe(0);

    m.setU8(pQ0BEx + 0x18, 0);
    m.setU8(pQ0BEx + 0x19, 1);
    expect(ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c(m, pGame, pOutCoord)).toBe(1);
    expect(m.u32(pOutCoord)).toBe(500);
    expect(m.u32(pOutCoord + 4)).toBe(596);
    expect(ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c(m, pGame)).toBe(0);

    m.setU8(pQ0BEx + 0x19, 0);
    expect(ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c(m, pGame, pOutCoord)).toBe(0);
    expect(ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c(m, pGame)).toBe(0);
    m.setU16(pQ0BEx + 0x40, 2);
    expect(ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c(m, pGame)).toBe(1);
  });
});
