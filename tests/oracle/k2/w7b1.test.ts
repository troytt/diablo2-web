import { describe, expect, it } from 'vitest';
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';
import {
  AI_Think_CainAndAnyaPrisonPortal_6FC3BF60_113c,
  AI_Think_Overlord_6FC37CB0_113c,
  ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c,
  MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c,
  MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c,
  MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c,
  MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c,
  MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c,
  MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c,
  NPC_StartPlayerNpcInteraction_6FC687A0_113c,
  PALADIN_FindAndSpawnBlessedHammerOrAuraSubMissile_6FC67900_113c,
  PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c,
  QUESTS_Act1AndarielOnDeath_6FC7B690_113c,
  QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c,
  QUESTS_Act2TaintedSunTriggerAltarDarkness_6FC56C20_113c,
  QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c,
  QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c,
  QUESTS_Act5RescueBarbsOnPrisonDoorOpen_6FC7C850_113c,
  SKILLS_ApplyDimVisionToTarget_6FC70470_113c,
  SKILLS_ApplyTerrorOrConfusionCallback_6FC70DB0_113c,
  SKILLS_EventFunc05_MoltenBoulderOrPerFrameAura_6FC65AF0_113c,
  SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c,
  SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c,
  SKILLS_SrvDo006_SpawnSubClassIndexedMissile_6FC2D530_113c,
  SKILLS_SrvDo024_SpawnWeaponMissileWithToHitAndBonusDmg_6FC47E30_113c,
  SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c,
  SKILLS_SrvDo030_BarbarianChargeUpdateAndStrike_6FC493B0_113c,
  SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c,
  SKILLS_SrvDo042_SpawnSrvMissileWithDeltaAndRange_6FC63610_113c,
  SKILLS_SrvDo043_SpawnSrvMissileWithRange_6FC63720_113c,
  SKILLS_SrvDo046_EnchantOrRevivePetWithAuraState_6FC63FA0_113c,
  SKILLS_SrvDo047_SpawnSkillMissileAtTargetPos_6FC64390_113c,
  SKILLS_SrvDo051_SpawnMultipleBowOrCrossbowProjectiles_6FC656B0_113c,
  SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c,
  SKILLS_SrvDo062_StrikeTrackedPetTargetAndAdvanceChain_6FC6DAC0_113c,
  SKILLS_SrvDo063_RangedMultiShotAtTrackedPetTargets_6FC6DCD0_113c,
  SKILLS_SrvDo067_NecromancerCurseRadius_6FC705D0_113c,
  SKILLS_SrvDo070_NecromancerWeakenOrDecrepify_6FC71A90_113c,
  SKILLS_StartOrUpdateDelayedChannelSkillState_6FC643F0_113c,
  STORM_TSHashTableInsertOrCreateNode_6FC22090_113c,
} from '../../../src/d2kern-113c/game/k2-w7b1-113c.js';

function initDataTables(m: SparseMemory113c): number {
  const pDataTablesPtr = 0x100000;
  const pDataTables = 0x100100;
  const pSkillsTxt = 0x110000;
  const pStatCostTxt = 0x150000;
  const pBitMasks = 0x180000;
  m.fill(0x100000, 0x90000, 0);
  m.fill(0x200000, 0x10000, 0);
  m.fill(0x3000, 0x2000, 0);
  m.fill(0x7fd70000, 0x20000, 0);
  m.fill(0x7ffdf000, 0x2000, 0);
  m.setU32(0x6fd1829c, pDataTablesPtr);
  m.setU32(0x6fd270b0, pDataTablesPtr);
  m.setU32(pDataTablesPtr, pDataTables);
  m.setU32(0x6fde9e1c, pDataTables);
  m.setU32(0x6fdf0b50, pDataTables);
  m.setU32(0x6fd31c20, 0);
  m.setU32(0x6fd182a4, pBitMasks);
  m.setU32(0x6fd18be0, pBitMasks);
  m.setU32(0x6fd27060, pBitMasks);
  m.setU32(0x6fdd90b0, pBitMasks);
  for (let i = 0; i < 32; i++) {
    m.setU32(pBitMasks + i * 4, (1 << i) >>> 0);
  }
  m.setU32(pDataTables + 0xb64, 0x130000);
  m.setU32(pDataTables + 0xb6c, 512);
  m.setU32(pDataTables + 0xb98, pSkillsTxt);
  m.setU32(pDataTables + 0xba0, 256);
  m.setU32(pDataTables + 0xc4, 256);
  m.setU32(pDataTables + 0xbcc, pStatCostTxt);
  m.setU32(pDataTables + 0xbd4, 512);
  return pDataTables;
}

describe('K2 Wave 7 Batch 1 (40 D2Game VAs)', () => {
  it('ports [1..5/40] hash table, missile SrvDo, item duplicate, and Overlord AI', () => {
    const m = new SparseMemory113c();
    initDataTables(m);

    const pTable = 0x200000;
    const pBucketArr = 0x200100;
    const pNode = 0x200200;
    const pKey = 0x200300;
    m.setU32(pTable + 0x08, pNode);
    m.setU32(pTable + 0x1c, pBucketArr);
    m.setU32(pTable + 0x24, 3);
    expect(
      STORM_TSHashTableInsertOrCreateNode_6FC22090_113c(m, pTable, 7, pKey, 0, () => pNode),
    ).toBe(pNode);

    expect(SKILLS_SrvDo004_SpawnMissileWithDeltaTargetXY_6FC2D290_113c(m, 0x3000, 0x4000, -1, 1)).toBe(0);
    expect(SKILLS_SrvDo006_SpawnSubClassIndexedMissile_6FC2D530_113c(m, 0x3000, 0x4000, -1, 1)).toBe(0);
    expect(() => ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c(m, 0x3000, 0, 1)).toThrow();

    const pAiArgs = 0x201000;
    const pMonster = 0x202000;
    m.setU32(pAiArgs + 0x00, 0x201100);
    m.setU32(pAiArgs + 0x04, pMonster);
    m.setU32(pAiArgs + 0x0c, 0);
    m.setU32(pAiArgs + 0x1c, 0x201200);
    m.setU32(0x3000 + 0xac, 0x3500);
    AI_Think_Overlord_6FC37CB0_113c(m, 0x3000, pMonster, pAiArgs);
    expect(m.u32(pMonster)).toBe(0);
  });

  it('ports [6..10/40] Cain/Anya AI and monster death handlers', () => {
    const m = new SparseMemory113c();
    initDataTables(m);

    const pGame = 0x200000;
    const pUnit = 0x201000;
    const pAiArgs = 0x202000;
    const pAiCmd = 0x202500;
    EVENT_InitTimerQueue113c(m, pGame);
    m.setU32(pAiArgs + 0x04, pUnit);
    m.setU32(pAiArgs + 0x0c, pAiCmd);
    m.setU32(pUnit + 0x04, 0x220);
    AI_Think_CainAndAnyaPrisonPortal_6FC3BF60_113c(m, pGame, pUnit, pAiArgs);

    m.setU32(pUnit + 0x00, 2);
    const pPath = 0x203000;
    m.setU32(pUnit + 0x2c, pPath);
    m.setU32(pPath + 0x0c, 100);
    m.setU32(pPath + 0x10, 200);
    MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c(m, pGame, pUnit, 0, 0);
    MISSILE_SplitForkedProjectilesOnTarget_6FC45AD0_113c(m, pGame, pUnit, 0, 0);

    m.setU32(pUnit + 0x04, 9999);
    MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c(m, pGame, pUnit, 0, 0);
    MONSTER_OnDeathSpawnPoisonCloud_6FC46230_113c(m, pGame, pUnit, 0, 0);
    expect(m.u32(pPath + 0x0c)).toBe(100);
  });

  it('ports [11..15/40] fire/corpse explosion death handlers and SrvDo 24/29/30', () => {
    const m = new SparseMemory113c();
    initDataTables(m);

    const pGame = 0x200000;
    const pUnit = 0x201000;
    const pPath = 0x202000;
    m.setU32(pUnit + 0x00, 2);
    m.setU32(pUnit + 0x2c, pPath);
    m.setU32(pPath + 0x0c, 50);
    m.setU32(pPath + 0x10, 60);

    MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c(m, pGame, pUnit);
    MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c(m, pGame, pUnit);
    expect(SKILLS_SrvDo024_SpawnWeaponMissileWithToHitAndBonusDmg_6FC47E30_113c(m, pGame, 0, 1, 1)).toBe(0);
    expect(SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c(m, pGame, pUnit, -1, 1)).toBe(0);
    expect(SKILLS_SrvDo030_BarbarianChargeUpdateAndStrike_6FC493B0_113c(m, pGame, pUnit, 1, 1)).toBe(0);
  });

  it('ports [16..20/40] Leap landing, char save check, Act2/Act3 quest helpers', () => {
    const m = new SparseMemory113c();
    initDataTables(m);

    expect(SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c(m, 0x200000, 0, -1, 1)).toBe(0);

    const pClient = 0x201000;
    m.setU8(pClient + 0x3d4, 1);
    m.setU32(pClient + 0x174, 0);
    PLAYER_CheckAndSendCharSaveToClient_6FC4BE20_113c(m, pClient);

    const pQuestArg = 0x202000;
    QUESTS_Act2RadamentSetStateAndDebugPrint_6FC55EB0_113c(m, pQuestArg, 7);
    expect(m.u8(pQuestArg + 0x0c)).toBe(7);

    const pArgs = 0x203000;
    const pGame = 0x204000;
    m.setU32(pArgs, pGame);
    QUESTS_Act2TaintedSunTriggerAltarDarkness_6FC56C20_113c(m, pArgs);

    expect(QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c(m, pGame, 0, 1)).toBe(0);
  });
  it('ports [21..25/40] SrvDo 42/43/46/47 and delayed channel skill state', () => {
    const m = new SparseMemory113c();
    initDataTables(m);

    const pGame = 0x200000;
    const pUnit = 0x201000;
    expect(SKILLS_SrvDo042_SpawnSrvMissileWithDeltaAndRange_6FC63610_113c(m, pGame, pUnit, -1, 1)).toBe(0);
    expect(SKILLS_SrvDo043_SpawnSrvMissileWithRange_6FC63720_113c(m, pGame, pUnit, -1, 1)).toBe(0);
    expect(SKILLS_SrvDo046_EnchantOrRevivePetWithAuraState_6FC63FA0_113c(m, pGame, pUnit, -1, 1)).toBe(0);
    expect(SKILLS_SrvDo047_SpawnSkillMissileAtTargetPos_6FC64390_113c(m, pGame, pUnit, -1, 1)).toBe(0);
    expect(SKILLS_StartOrUpdateDelayedChannelSkillState_6FC643F0_113c(m, pUnit, pGame, -1, 1, 1)).toBe(0);
  });

  it('ports [26..30/40] spread projectiles, SrvDo 51, EventFunc 05, Blessed Hammer, NPC interact', () => {
    const m = new SparseMemory113c();
    initDataTables(m);

    const pGame = 0x200000;
    const pUnit = 0x201000;
    const pPath = 0x202000;
    m.setU32(pUnit + 0x00, 2);
    m.setU32(pUnit + 0x2c, pPath);
    m.setU32(pPath + 0x0c, 100);
    m.setU32(pPath + 0x10, 200);

    expect(
      SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c(m, pGame, pUnit, 1, 1, 1, 0, 0),
    ).toBe(1);
    expect(
      SKILLS_SrvDo051_SpawnMultipleBowOrCrossbowProjectiles_6FC656B0_113c(m, pGame, pUnit, -1, 1),
    ).toBe(0);
    expect(
      SKILLS_EventFunc05_MoltenBoulderOrPerFrameAura_6FC65AF0_113c(m, pGame, pUnit, -1, 1),
    ).toBe(0);

    PALADIN_FindAndSpawnBlessedHammerOrAuraSubMissile_6FC67900_113c(m, pGame, pUnit, 0, 1);

    const ppHead = 0x203000;
    expect(NPC_StartPlayerNpcInteraction_6FC687A0_113c(m, pUnit, 0, pGame, ppHead, 0)).toBe(0);
  });

  it('ports [31..35/40] Paladin Smite, SrvDo 62/63, Dim Vision, SrvDo 67', () => {
    const m = new SparseMemory113c();
    initDataTables(m);

    const pGame = 0x200000;
    const pUnit = 0x201000;
    expect(SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c(m, pGame, pUnit, -1, 1)).toBe(0);
    expect(
      SKILLS_SrvDo062_StrikeTrackedPetTargetAndAdvanceChain_6FC6DAC0_113c(m, pGame, pUnit, -1, 1),
    ).toBe(0);
    expect(
      SKILLS_SrvDo063_RangedMultiShotAtTrackedPetTargets_6FC6DCD0_113c(m, pGame, pUnit, -1, 1),
    ).toBe(0);

    m.setU32(0x100100 + 0xba0, 10);
    SKILLS_ApplyDimVisionToTarget_6FC70470_113c(m, pGame, pUnit, pUnit, 1);
    m.setU32(0x100100 + 0xba0, 256);

    expect(SKILLS_SrvDo067_NecromancerCurseRadius_6FC705D0_113c(m, pGame, pUnit, -1, 1)).toBe(0);
  });

  it('ports [36..40/40] Terror/Confusion callback, SrvDo 70, Andariel death, Ancients XP, Rescue Barbs', () => {
    const m = new SparseMemory113c();
    initDataTables(m);

    const pGame = 0x200000;
    const pUnit = 0x201000;
    const pCtx = 0x202000;
    m.setU32(pCtx, pGame);
    expect(SKILLS_ApplyTerrorOrConfusionCallback_6FC70DB0_113c(m, 0, pCtx)).toBe(0);
    expect(
      SKILLS_SrvDo070_NecromancerWeakenOrDecrepify_6FC71A90_113c(m, pGame, pUnit, -1, 1),
    ).toBe(0);

    const pQuestData = 0x203000;
    const pQuestArg = 0x204000;
    m.setU8(pQuestData + 0x09, 0);
    QUESTS_Act1AndarielOnDeath_6FC7B690_113c(m, pQuestData, pQuestArg);

    m.setU32(pUnit + 0x00, 0);
    m.setU32(pUnit + 0x14, 0x201500);
    m.setU32(0x201500 + 0x10, 0x201600);
    m.setU32(0x201600, 0x201700);
    QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c(m, pUnit, pGame);

    const pArgs = 0x205000;
    m.setU32(pArgs, pGame);
    m.setU32(pArgs + 0x10, 0x205500);
    QUESTS_Act5RescueBarbsOnPrisonDoorOpen_6FC7C850_113c(m, pArgs);
    expect(m.u32(pArgs)).toBe(pGame);
  });
});
