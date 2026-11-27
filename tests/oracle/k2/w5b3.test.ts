import { describe, expect, it } from 'vitest';
import { D2COMMON_SGPT_DATATABLES_VA_113C } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts';
import {
  ACT4Prologue_InitQuestDescriptor_6FCD9D80_113c,
  ACT4Q1_PropagateQuestFailureToSubParty_6FCDA180_113c,
  ACT4Q2_InitHadrielQuestDescriptor_6FCD97D0_113c,
  ACT4Q3_CompleteQuestIfPlayerInAct4_6FCDA010_113c,
  ACT4Q3_CompleteQuestIfPlayerNearDiabloRoom_6FCD9F20_113c,
  ACT4Q3_SpawnChaosSealBossOrRetryEvent7_6FCDBC00_113c,
  AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c,
  AI_ScanRoomTargetAndCountAlliesCallback_6FCC5230_113c,
  AIBAAL_SelectAction_6FCD79B0_113c,
  AURA_FindClosestUnitInRadius_6FCC1000_113c,
  AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c,
  AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c,
  ITEMS_FindAutoStackCompatItemInInventory_6FCDC6B0_113c,
  ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c,
  ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c,
  MONAI_FindClosestLoSHostileMeleeAndRangedTargetCallback_6FCD15E0_113c,
  MONAI_FindClosestLoSHostileMeleeTargetCallback_6FCD1580_113c,
  MONAI_FindClosestWalkableHostileMeleeTargetCallback_6FCD1520_113c,
  MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c,
  SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c,
  SKILLS_CanSpawnObjectAtTargetCoords_6FCC0630_113c,
  SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c,
  SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c,
  SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c,
  SKILLS_DoBlazeOrInfernoStepMissile_6FCD56C0_113c,
  SKILLS_DoChargedBoltOrSpiderWebFan_6FCD4FF0_113c,
  SKILLS_DoChargeOrSmiteKnockbackStart_6FCD6380_113c,
  SKILLS_DoChargeStart_6FCB9620_113c,
  SKILLS_DoElemMeleeHitAndSetSkillIcon_6FCD3D60_113c,
  SKILLS_DoFeralRageOrHungerHit_6FCD3B20_113c,
  SKILLS_DoFindPotionOrGrimWardRadiusCurse_6FCD39F0_113c,
  SKILLS_DoImpaleOrRabiesStep_6FCD3F10_113c,
  SKILLS_DoRedemptionAuraPulse_6FCBA400_113c,
  SKILLS_DoSmiteOrTelekinesisCombatHit_6FCD4520_113c,
  SKILLS_DoTeethOrMultipleShotFan_6FCD4DE0_113c,
  SKILLS_DoUnsummonStart_6FCBFEF0_113c,
  SKILLS_EnsureWeaponOrQuiverElseStartModeCast_6FCC1600_113c,
  SKILLS_EvalAndApplySkillDelayOnPlayer_6FCC09A0_113c,
  SKILLS_ForEachUnitInCoordsRadius_6FCBF340_113c,
  SKILLS_ForEachUnitNearTargetCoords_6FCC06F0_113c,
  SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c,
  SKILLS_SrvDoArcticBlastChannelTick_6FCD6A60_113c,
  SKILLS_SrvDoInfernoChannelTick_6FCD6840_113c,
  SUNITDMG_ProcHitMonsterFleeOrTaunt_6FCCF2E0_113c,
  SUNITDMG_ProcHitOpenWounds_6FCCD410_113c,
} from '../../../src/d2kern-113c/game/k2-w5b3-113c.ts';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

function setupTables(m: SparseMemory113c): number {
  const pTables = m.alloc(0x1000);
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pTables);
  m.setU32(0x6fd1829c, D2COMMON_SGPT_DATATABLES_VA_113C);
  const pBitMasks = m.alloc(0x100);
  for (let i = 0; i < 32; i++) {
    m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0);
  }
  m.setU32(0x6fd18be0, pBitMasks);
  m.setU32(0x6fdefb94, 0);
  m.setU32(0x6fdefb98, 0);
  return pTables;
}

describe('K2 Wave 5 Batch 3 (w5b3): D2Game 0x6FCB9620..0x6FCDC6B0', () => {
  it('ports [1..12] Charge, Redemption, Unsummon, Projectile, Object spawn, Skill delay, and Aura radius helpers', () => {
    const m = new SparseMemory113c();
    const pTables = setupTables(m);
    const pSkillsTxt = m.alloc(0x600);
    m.setU32((pTables + 0xb98) >>> 0, pSkillsTxt);
    m.setU32((pTables + 0xba0) >>> 0, 2);
    m.setU32((pTables + 0xc4) >>> 0, 0xb8);

    const pGame = m.alloc(0x2000);
    const pPlayer = m.alloc(0x100);
    const pPath = m.alloc(0x80);
    m.setU32(pPlayer, 0);
    m.setU32((pPlayer + 0x2c) >>> 0, pPath);

    // [1/45] 0x6FCB9620 & [2/45] 0x6FCBA400
    expect(SKILLS_DoChargeStart_6FCB9620_113c(m, pGame, pPlayer, -1, 1)).toBe(0);
    expect(SKILLS_DoChargeStart_6FCB9620_113c(m, pGame, pPlayer, 0, 1)).toBe(0);
    m.setU16((pSkillsTxt + 0x80) >>> 0, 0xffff);
    expect(SKILLS_DoRedemptionAuraPulse_6FCBA400_113c(m, pGame, pPlayer, 0, 1)).toBe(0);

    // [3/45] 0x6FCBF120
    const pMonster = m.alloc(0x100);
    m.setU32(pMonster, 1);
    m.setU32((pMonster + 0x04) >>> 0, 0);
    m.setU32((pMonster + 0x10) >>> 0, 1);
    expect(SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c(m, pMonster, 4)).toBe(0);

    // [4/45] 0x6FCBF340 & [5/45] 0x6FCBFEF0
    SKILLS_ForEachUnitInCoordsRadius_6FCBF340_113c(m, 0, 10, pGame, 10, pPlayer, -1, 1, 0x6fcbedb0);
    expect(SKILLS_DoUnsummonStart_6FCBFEF0_113c(m, pGame, pPlayer, 0, 1)).toBe(0);

    // [6/45] 0x6FCC0000 & [7/45] 0x6FCC0630
    expect(SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c(m, 0, pGame, 0, 1, 1, 0, 0)).toBe(0);
    expect(SKILLS_CanSpawnObjectAtTargetCoords_6FCC0630_113c(m, -1, pGame, pPlayer)).toBe(0);

    // [8/45] 0x6FCC06F0, [9/45] 0x6FCC09A0, [10/45] 0x6FCC0AD0, [11/45] 0x6FCC1000
    expect(() =>
      SKILLS_ForEachUnitNearTargetCoords_6FCC06F0_113c(m, 5, pGame, pPlayer, 0, 0, 0),
    ).toThrow(/4167|0x1047/)
    SKILLS_EvalAndApplySkillDelayOnPlayer_6FCC09A0_113c(m, pPlayer, -1, pGame, 1);
    expect(AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c(m, pGame, 0, pPlayer, 5, 0, 0)).toBe(0);
    expect(AURA_FindClosestUnitInRadius_6FCC1000_113c(m, pPlayer, pGame, 5, 0)).toBe(0);

    // [12/45] 0x6FCC1210
    const pAuraCtx = m.alloc(0x20);
    const pDmgSrc = m.alloc(0x70);
    m.setU32(pAuraCtx, pGame);
    m.setU32((pAuraCtx + 0x04) >>> 0, pPlayer);
    m.setU32((pAuraCtx + 0x0c) >>> 0, pDmgSrc);
    expect(AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c(m, pAuraCtx, pMonster)).toBe(1);
  });

  it('ports [13..22] Weapon/Quiver quantity, Item aura event 9, Summon check, AI scan, SpellIcon, Open Wounds, Potion, and Taunt proc', () => {
    const m = new SparseMemory113c();
    const pTables = setupTables(m);
    const pSkillsTxt = m.alloc(0x600);
    m.setU32((pTables + 0xb98) >>> 0, pSkillsTxt);
    m.setU32((pTables + 0xba0) >>> 0, 2);
    m.setU32((pTables + 0xbf0) >>> 0, 10);

    const pGame = m.alloc(0x2000);
    EVENT_InitTimerQueue113c(m, pGame);
    const pPlayer = m.alloc(0x100);
    m.setU32(pPlayer, 0);
    const pMonster = m.alloc(0x100);
    m.setU32(pMonster, 1);
    m.setU32((pMonster + 0x04) >>> 0, 5);
    m.setU32((pMonster + 0x10) >>> 0, 1);

    // [13/45] 0x6FCC1600 & [14/45] 0x6FCC1790
    expect(SKILLS_EnsureWeaponOrQuiverElseStartModeCast_6FCC1600_113c(m, pGame, pMonster)).toBe(1);
    expect(SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c(m, pMonster, pGame)).toBe(0);

    // [15/45] 0x6FCC37D0 & [16/45] 0x6FCC3D60
    SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c(m, pGame, pPlayer, 0, -1);
    m.setU16((pSkillsTxt + 0xbc) >>> 0, 5);
    expect(SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c(m, pPlayer, 0, pMonster)).toBe(0);
    m.setU16((pSkillsTxt + 0xbc) >>> 0, 9);
    m.setU8((pSkillsTxt + 0xbe) >>> 0, 0xff);
    expect(SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c(m, pPlayer, 0, pMonster)).toBe(1);

    // [17/45] 0x6FCC4FD0 & [18/45] 0x6FCC5230
    const pAiTickArgs = m.alloc(0x30);
    const pAiControl = m.alloc(0x30);
    const pMonStats = m.alloc(0x1b0);
    m.setU32(pAiTickArgs, pAiControl);
    m.setU32((pAiTickArgs + 0x1c) >>> 0, pMonStats);
    m.setU32((pAiControl + 0x1c) >>> 0, 10);
    m.setU16((pMonStats + 0x5c) >>> 0, 15);
    m.setU32((pMonster + 0x20) >>> 0, 7);
    AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c(m, pGame, pMonster, pAiTickArgs);

    const pScanCtx = m.alloc(0x30);
    expect(AI_ScanRoomTargetAndCountAlliesCallback_6FCC5230_113c(m, pGame, pMonster, pMonster, pScanCtx)).toBe(0);

    // [19/45] 0x6FCCD0F0, [20/45] 0x6FCCD410, [21/45] 0x6FCCE4D0, [22/45] 0x6FCCF2E0
    expect(ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c(m, 0, 0, pGame, 0, 0, 0)).toBe(0);
    expect(SUNITDMG_ProcHitOpenWounds_6FCCD410_113c(m, pGame, 0, 0, pMonster, 0, 0)).toBe(0);
    expect(ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c(m, pGame, pPlayer, 0)).toBe(0);
    expect(SUNITDMG_ProcHitMonsterFleeOrTaunt_6FCCF2E0_113c(m, pGame, 0, pPlayer, pMonster, 0, 0)).toBe(0);
  });

  it('ports [23..35] MONAI target callbacks, Grim Ward, Feral Rage, Elem melee, Impale, Smite, Teeth, Charged Bolt, Blaze, and Knockback dash', () => {
    const m = new SparseMemory113c();
    const pTables = setupTables(m);
    const pSkillsTxt = m.alloc(0x600);
    m.setU32((pTables + 0xb98) >>> 0, pSkillsTxt);
    m.setU32((pTables + 0xba0) >>> 0, 2);
    m.setU32((pTables + 0xb6c) >>> 0, 2);

    const pGame = m.alloc(0x2000);
    const pMonster = m.alloc(0x100);
    const pPath = m.alloc(0x80);
    m.setU32(pMonster, 1);
    m.setU32((pMonster + 0x2c) >>> 0, pPath);

    // [23..26/45] 0x6FCD1520..0x6FCD1BC0
    const pBestCtx = m.alloc(0x20);
    m.setU32((pBestCtx + 0x08) >>> 0, pMonster);
    expect(
      MONAI_FindClosestWalkableHostileMeleeTargetCallback_6FCD1520_113c(m, pGame, pMonster, pMonster, pBestCtx),
    ).toBe(0);
    expect(
      MONAI_FindClosestLoSHostileMeleeTargetCallback_6FCD1580_113c(m, pGame, pMonster, pMonster, pBestCtx),
    ).toBe(0);
    expect(
      MONAI_FindClosestLoSHostileMeleeAndRangedTargetCallback_6FCD15E0_113c(m, pGame, pMonster, 0, pBestCtx),
    ).toBe(0);
    const pCanMelee = m.alloc(4);
    const pOutDist = m.alloc(4);
    expect(MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c(m, pMonster, pGame, pCanMelee, pOutDist)).toBe(0);
    expect(m.u32(pCanMelee)).toBe(0);
    expect(m.u32(pOutDist)).toBe(0x7fffffff);

    // [27..35/45] 0x6FCD39F0..0x6FCD6380
    expect(SKILLS_DoFindPotionOrGrimWardRadiusCurse_6FCD39F0_113c(m, pGame, pMonster, 0, 1)).toBe(0);
    expect(SKILLS_DoFeralRageOrHungerHit_6FCD3B20_113c(m, pGame, pMonster, -1, 1)).toBe(0);
    expect(SKILLS_DoElemMeleeHitAndSetSkillIcon_6FCD3D60_113c(m, pGame, pMonster, 0, 1)).toBe(1);
    expect(m.u32((pMonster + 0xc4) >>> 0) & 0x40).toBe(0x40);
    expect(SKILLS_DoImpaleOrRabiesStep_6FCD3F10_113c(m, pGame, pMonster, 0, 1)).toBe(0);
    expect(SKILLS_DoSmiteOrTelekinesisCombatHit_6FCD4520_113c(m, 0, pMonster, 0, pGame, 1)).toBe(0);
    m.setU16((pSkillsTxt + 0x48) >>> 0, 0xffff);
    expect(SKILLS_DoTeethOrMultipleShotFan_6FCD4DE0_113c(m, pGame, pMonster, 0, 1)).toBe(0);
    expect(SKILLS_DoChargedBoltOrSpiderWebFan_6FCD4FF0_113c(m, pGame, pMonster, 0, 1)).toBe(0);
    expect(SKILLS_DoBlazeOrInfernoStepMissile_6FCD56C0_113c(m, pGame, pMonster, 0, 1)).toBe(0);
    expect(SKILLS_DoChargeOrSmiteKnockbackStart_6FCD6380_113c(m, pGame, pMonster, 0, 1)).toBe(0);
  });

  it('ports [36..45] Inferno/ArcticBlast channel ticks, Baal action selector, Act4 quest descriptors/completion/seal boss, and AutoStack finder', () => {
    const m = new SparseMemory113c();
    const pTables = setupTables(m);
    const pSkillsTxt = m.alloc(0x600);
    const pMissilesTxt = m.alloc(0x400);
    m.setU32((pTables + 0xb98) >>> 0, pSkillsTxt);
    m.setU32((pTables + 0xba0) >>> 0, 2);
    m.setU32((pTables + 0xb64) >>> 0, pMissilesTxt);
    m.setU32((pTables + 0xb6c) >>> 0, 2);

    const pGame = m.alloc(0x2000);
    EVENT_InitTimerQueue113c(m, pGame);
    m.setU32((pGame + 0xa8) >>> 0, 50);
    const pMonster = m.alloc(0x100);
    const pPath = m.alloc(0x80);
    m.setU32(pMonster, 1);
    m.setU32((pMonster + 0x2c) >>> 0, pPath);

    // [36/45] 0x6FCD6840 & [37/45] 0x6FCD6A60
    expect(SKILLS_SrvDoInfernoChannelTick_6FCD6840_113c(m, pGame, pMonster, -1, 1)).toBe(0);
    expect(SKILLS_SrvDoInfernoChannelTick_6FCD6840_113c(m, pGame, pMonster, 0, 1)).toBe(0);
    expect(SKILLS_SrvDoArcticBlastChannelTick_6FCD6A60_113c(m, pGame, pMonster, -1, 1)).toBe(0);
    expect(SKILLS_SrvDoArcticBlastChannelTick_6FCD6A60_113c(m, pGame, pMonster, 0, 1)).toBe(0);

    // [38/45] 0x6FCD79B0: forced action at pAiState+0x14 and targetless collision check (4 on void room)
    const pAiState = m.alloc(0x30);
    m.setU32((pAiState + 0x14) >>> 0, 7);
    expect(AIBAAL_SelectAction_6FCD79B0_113c(m, pMonster, 0, pGame, pAiState, 0, 0, 0)).toBe(7);
    m.setU32((pAiState + 0x14) >>> 0, 0);
    expect(AIBAAL_SelectAction_6FCD79B0_113c(m, pMonster, 0, pGame, pAiState, 0, 0, 0)).toBe(4);

    // [39/45] 0x6FCD97D0 & [40/45] 0x6FCD9D80
    const pQuestHadriel = m.alloc(0x100);
    ACT4Q2_InitHadrielQuestDescriptor_6FCD97D0_113c(m, pQuestHadriel);
    expect(m.u32((pQuestHadriel + 0xa0) >>> 0)).toBe(0x6fcd8c00);
    expect(m.u32((pQuestHadriel + 0xdc) >>> 0)).toBe(0x6fd26fe8);
    expect(m.u8((pQuestHadriel + 0x0a) >>> 0)).toBe(1);
    expect(m.u32((pQuestHadriel + 0xe0) >>> 0)).toBe(0x21);
    expect(m.u32((pQuestHadriel + 0xe8) >>> 0)).toBe(0x6fcd87d0);
    expect(m.u32((pQuestHadriel + 0xec) >>> 0)).toBe(0x6fcd8b90);

    const pQuestPrologue = m.alloc(0x100);
    ACT4Prologue_InitQuestDescriptor_6FCD9D80_113c(m, pQuestPrologue);
    expect(m.u32((pQuestPrologue + 0xa0) >>> 0)).toBe(0x6fcd9730);
    expect(m.u32((pQuestPrologue + 0xcc) >>> 0)).toBe(0x6fcd97a0);
    expect(m.u32((pQuestPrologue + 0xdc) >>> 0)).toBe(0x6fd25f90);
    expect(m.u8((pQuestPrologue + 0x0a) >>> 0)).toBe(1);
    expect(m.u32((pQuestPrologue + 0xe0) >>> 0)).toBe(0x18);
    expect(m.u32((pQuestPrologue + 0xe8) >>> 0)).toBe(0x6fcd8b80);
    expect(m.u32((pQuestPrologue + 0xec) >>> 0)).toBe(0x6fcd8b50);

    // [41/45] 0x6FCD9F20, [42/45] 0x6FCDA010, [43/45] 0x6FCDA180
    const pPlayer = m.alloc(0x100);
    const pPlayerData = m.alloc(0x100);
    const pFlags = m.alloc(0x80);
    m.setU32(pFlags, m.alloc(0x80));
    m.setU32(pPlayer, 0);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    m.setU32((pPlayerData + 0x10) >>> 0, pFlags);
    expect(ACT4Q3_CompleteQuestIfPlayerNearDiabloRoom_6FCD9F20_113c(m, pGame, pPlayer)).toBe(0);
    ACT4Q3_CompleteQuestIfPlayerInAct4_6FCDA010_113c(m, pGame, pPlayer);
    expect(ACT4Q1_PropagateQuestFailureToSubParty_6FCDA180_113c(m, pGame, pPlayer)).toBe(0);

    // [44/45] 0x6FCDBC00
    const pQuestCtrl = m.alloc(0x20);
    const pQuest17 = m.alloc(0x100);
    const pCustom17 = m.alloc(0x50);
    m.setU32(pQuest17, 0x17);
    m.setU32((pQuest17 + 0x18) >>> 0, pCustom17);
    m.setU32((pCustom17 + 0x24) >>> 0, 999);
    m.setU32((pCustom17 + 0x28) >>> 0, 888);
    m.setU32(pQuestCtrl, pQuest17);
    m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl);
    ACT4Q3_SpawnChaosSealBossOrRetryEvent7_6FCDBC00_113c(m, pGame, pMonster);

    // [45/45] 0x6FCDC6B0
    const pOutSpace = m.alloc(4);
    const pItem = m.alloc(0x100);
    m.setU32(pItem, 4);
    expect(ITEMS_FindAutoStackCompatItemInInventory_6FCDC6B0_113c(m, pPlayer, pItem, pOutSpace)).toBe(0);
    expect(m.u32(pOutSpace)).toBe(1);
  });
});
