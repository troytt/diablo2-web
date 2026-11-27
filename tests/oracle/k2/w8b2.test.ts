import { describe, expect, it } from 'vitest';
import {
  GDW_BITMASKS_IAT_VA_113C,
  SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/common/skills.js';
import * as w8b2Exports from '../../../src/d2kern-113c/game/k2-w8b2-113c.js';
import {
  ACT1Q1_OnMonsterKilled_6FC85760_113c,
  ACT1Q4_OnCairnStoneInit_6FC87D20_113c,
  ACT1Q5_OnTreeOfInifussOperated_6FC85D40_113c,
  ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60_113c,
  ACT4Q1_OnNpcMessage_6FCDA5E0_113c,
  ACT4Q1_OnPlayerChangeLevel_6FCDA330_113c,
  AURA_ApplyRadialDamageCallback_6FCB54F0_113c,
  MONAI_SiegeMinionThinkDispatch_6FCC7530_113c,
  MONSTER_AutoEquipInteractItem_6FC98B60_113c,
  MONSTER_SpawnAndEquipMonEquipRecordItem_6FCCFCE0_113c,
  OBJ_OperateChestAndSparkyChest_6FC8F040_113c,
  OBJ_ThinkEventLightningSpire_6FC8E400_113c,
  OBJ_ThinkEventSparkyChest_6FC8E150_113c,
  PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c,
  PETS_OnPetOrMercKilled_6FCB8120_113c,
  PETS_UnsummonPetAndCheckNodeStillExists_6FCB8070_113c,
  PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00_113c,
  PETS_UnsummonSameGroupPetTypes_6FCB7C20_113c,
  SKILLS_OnHitEffect_HitBlindsTarget_6FCCE0E0_113c,
  SKILLS_SrvDo_BookOrScrollOfTownPortal_6FCCF450_113c,
  SKILLS_SrvDo_FindPotionOrConsumeBook_6FCCDFA0_113c,
  SKILLS_SrvDo_MonResurrectCorpse_6FCD5BD0_113c,
  SKILLS_SrvDo_SummonFallenShamanPack_6FCD4410_113c,
  SKILLS_SrvDo_Unsummon_6FCC2EA0_113c,
} from '../../../src/d2kern-113c/game/k2-w8b2-113c.js';
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.js';
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.js';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js';

function createBaseMemory(): { m: SparseMemory113c; pDataTables: number; pGame: number } {
  const m = new SparseMemory113c();
  const holder = m.alloc(4);
  const pDataTables = m.alloc(0x1000);
  initD2GameGlobalsInMem113c(m, pDataTables);
  const pMasks = m.alloc(128);
  for (let i = 0; i < 32; i++) {
    m.setU32((pMasks + i * 4) >>> 0, (1 << i) >>> 0);
  }
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pMasks);
  m.setU32(GDW_BITMASKS_IAT_VA_113C, pMasks);
  m.setU32(0x6fd31c20, 0);
  m.setU32(0x6fd18d10, 1000);

  m.setU32(holder, pDataTables);
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, holder);
  m.setU32(SGPT_DATATABLES_VA_113C, pDataTables);

  const pSkillsTxt = m.alloc(0x23c * 8);
  const pMonStatsTxt = m.alloc(0x1a8 * 8);
  const pObjectsTxt = m.alloc(0x1c0 * 8);
  const pLevelsTxt = m.alloc(0x220 * 8);
  const pPetTypeTxt = m.alloc(0xe0 * 8);
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt);
  m.setU32((pDataTables + 0xa80) >>> 0, 8);
  m.setU32((pDataTables + 0xab8) >>> 0, pObjectsTxt);
  m.setU32(0x6fdf0b94, pObjectsTxt);
  m.setU32(0x6fdf0b98, 8);
  m.setU32((pDataTables + 0xac0) >>> 0, 8);
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt);
  m.setU32((pDataTables + 0xba0) >>> 0, 8);
  m.setU32((pDataTables + 0xbc0) >>> 0, 64);
  m.setU32((pDataTables + 0xbe8) >>> 0, pPetTypeTxt);
  m.setU32((pDataTables + 0xbf0) >>> 0, 4);
  m.setU32((pDataTables + 0xbf8) >>> 0, pLevelsTxt);
  m.setU32((pDataTables + 0xc00) >>> 0, 8);

  const pGame = m.alloc(0x2000);
  const pGameSeed = m.alloc(0x10);
  m.setU32((pGame + 0xa8) >>> 0, 100);
  m.setU32((pGame + 0x10f0) >>> 0, pGameSeed);
  EVENT_InitTimerQueue113c(m, pGame);
  return { m, pDataTables, pGame };
}

describe('K2 Wave 8 Batch 2 (w8b2): 30 D2Game VAs 0x6FC85760..0x6FCDA5E0', () => {
  it('exports all 30 D2Game.dll v1.13c functions', () => {
    const fns = Object.values(w8b2Exports).filter((v) => typeof v === 'function');
    expect(fns.length).toBe(30);
  });

  it('verifies Act 1 quest handlers and object think/operate handlers', () => {
    const { m, pGame } = createBaseMemory();
    const pQuestData = m.alloc(0x100);
    const pQuestExt = m.alloc(0x200);
    const pQuestArg = m.alloc(0x20);
    const pDenStats = m.alloc(0x300);
    m.setU32((pGame + 0x110) >>> 0, pDenStats);
    m.setU32((pDenStats + 0x2cc) >>> 0, 5);
    m.setU32((pDenStats + 0x2d0) >>> 0, 2);
    m.setU8((pQuestData + 0x09) >>> 0, 0);
    m.setU32((pQuestData + 0x04) >>> 0, pGame);
    m.setU32((pQuestData + 0x18) >>> 0, pQuestExt);
    m.setU32(pQuestArg, pGame);
    ACT1Q1_OnMonsterKilled_6FC85760_113c(m, pQuestData, pQuestArg);
    expect(m.u8((pQuestData + 0x09) >>> 0)).toBe(0);

    const pOperateArgs = m.alloc(0x20);
    m.setU32(pOperateArgs, pGame);
    expect(ACT1Q5_OnTreeOfInifussOperated_6FC85D40_113c(m, pOperateArgs)).toBe(0);

    m.setU16((pQuestExt + 0x192) >>> 0, 3);
    expect(ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60_113c(m, pGame, pQuestData)).toBe(0);
    expect(m.u16((pQuestExt + 0x192) >>> 0)).toBe(4);

    const pStoneObj = m.alloc(0x100);
    m.setU32(pStoneObj, 2);
    m.setU32((pStoneObj + 0x10) >>> 0, 2);
    m.setU32((pOperateArgs + 0x04) >>> 0, pStoneObj);
    ACT1Q4_OnCairnStoneInit_6FC87D20_113c(m, pOperateArgs);
    expect(m.u32((pStoneObj + 0x10) >>> 0)).toBe(2);

    const pObj = m.alloc(0x100);
    const pStaticPath = m.alloc(0x40);
    m.setU32(pStaticPath, m.alloc(0x100));
    m.setU32(pObj, 2);
    m.setU32((pObj + 0x10) >>> 0, 2);
    m.setU32((pObj + 0x14) >>> 0, m.alloc(0x40));
    m.setU32((pObj + 0x2c) >>> 0, pStaticPath);
    OBJ_ThinkEventSparkyChest_6FC8E150_113c(m, pGame, pObj);
    expect(m.u32((pObj + 0x10) >>> 0)).toBe(2);

    m.setU32((pObj + 0x10) >>> 0, 1);
    OBJ_ThinkEventLightningSpire_6FC8E400_113c(m, pGame, pObj);
    expect(m.u32((pObj + 0x10) >>> 0)).toBe(2);

    m.setU32((pOperateArgs + 0x04) >>> 0, pObj);
    expect(OBJ_OperateChestAndSparkyChest_6FC8F040_113c(m, pOperateArgs)).toBe(1);
  });

  it('verifies Monster AutoEquip, Aura callback, Pets, AI, Skills, and Act4Q1 handlers', () => {
    const { m, pGame } = createBaseMemory();
    const pPlayer = m.alloc(0x100);
    const pPlayerData = m.alloc(0x100);
    const pQuestRec = m.alloc(0x100);
    const pQuestBits = m.alloc(0x100);
    m.setU32(pQuestRec, pQuestBits);
    m.setU32(pPlayer, 0);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    m.setU32((pPlayerData + 0x10) >>> 0, pQuestRec);

    const pMonster = m.alloc(0x100);
    const pPath = m.alloc(0x80);
    m.setU32(pMonster, 1);
    m.setU32((pMonster + 0x2c) >>> 0, pPath);
    MONSTER_AutoEquipInteractItem_6FC98B60_113c(m, pGame, pPlayer);

    const pAuraIterArgs = m.alloc(0x20);
    const pAuraDamageCtx = m.alloc(0x20);
    const pTemplateDmg = m.alloc(0x70);
    const pAttacker = m.alloc(0x100);
    const pDefender = m.alloc(0x100);
    m.setU32((pTemplateDmg + 0x04) >>> 0, 0x20);
    m.setU32(pAuraDamageCtx, pTemplateDmg);
    m.setU32((pAuraDamageCtx + 0x08) >>> 0, 1);
    m.setU32(pAuraIterArgs, pGame);
    m.setU32((pAuraIterArgs + 0x04) >>> 0, pAttacker);
    m.setU32((pAuraIterArgs + 0x0c) >>> 0, pAuraDamageCtx);
    expect(AURA_ApplyRadialDamageCallback_6FCB54F0_113c(m, pAuraIterArgs, pDefender, () => 0)).toBe(1);

    const pPetListWrapper = m.alloc(0x10);
    PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00_113c(m, pPetListWrapper, pGame, pPlayer, 400);
    PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c(m, 1, pPlayer, pGame, 2);
    PETS_UnsummonSameGroupPetTypes_6FCB7C20_113c(m, pGame, pPlayer, 1);
    expect(PETS_UnsummonPetAndCheckNodeStillExists_6FCB8070_113c(m, pMonster, pPlayer, pGame)).toBe(0);
    PETS_OnPetOrMercKilled_6FCB8120_113c(m, pGame, pPlayer, pMonster);
    expect(SKILLS_SrvDo_Unsummon_6FCC2EA0_113c(m, pGame, pPlayer)).toBe(0);

    const pAiThinkArg = m.alloc(0x30);
    m.setU32((pMonster + 0x04) >>> 0, 10);
    MONAI_SiegeMinionThinkDispatch_6FCC7530_113c(m, pGame, pMonster, pAiThinkArg);
    expect(SKILLS_SrvDo_FindPotionOrConsumeBook_6FCCDFA0_113c(m, pGame, pMonster, 1)).toBe(0);
    expect(SKILLS_OnHitEffect_HitBlindsTarget_6FCCE0E0_113c(m, pGame, 0, pMonster, pDefender)).toBe(0);
    expect(SKILLS_SrvDo_BookOrScrollOfTownPortal_6FCCF450_113c(m, pGame, pMonster)).toBe(0);

    const pRec = m.alloc(0x10);
    MONSTER_SpawnAndEquipMonEquipRecordItem_6FCCFCE0_113c(m, pPlayer, pRec, pGame, 1, 2);
    expect(SKILLS_SrvDo_SummonFallenShamanPack_6FCD4410_113c(m, pGame, pMonster, -1, 1)).toBe(0);
    expect(SKILLS_SrvDo_MonResurrectCorpse_6FCD5BD0_113c(m, pGame, pMonster, 1, 1)).toBe(0);

    const pQuestData = m.alloc(0x100);
    const pQuestExt = m.alloc(0x40);
    const pQuestArg = m.alloc(0x20);
    m.setU32((pQuestData + 0x04) >>> 0, pGame);
    m.setU32((pQuestData + 0x18) >>> 0, pQuestExt);
    m.setU8((pQuestData + 0x09) >>> 0, 0);
    m.setU32((pQuestArg + 0x0c) >>> 0, pPlayer);
    ACT4Q1_OnPlayerChangeLevel_6FCDA330_113c(m, pQuestData, pQuestArg);
    m.setU16((pQuestArg + 0x14) >>> 0, 0);
    m.setU16((pQuestArg + 0x18) >>> 0, 0);
    ACT4Q1_OnNpcMessage_6FCDA5E0_113c(m, pQuestData, pQuestArg);
    expect(m.u8((pQuestData + 0x0c) >>> 0)).toBe(0);
  });
});
