import { describe, expect, it } from 'vitest';
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.js';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js';
import {
  CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c,
  ACT_AllocGameActAndInitEclipse_6FCBD6F0_113c,
  SKILLS_AllocAndFindUnitsInRadius_6FCBE570_113c,
  SKILLS_ClampLifeManaStaminaToMaxAndRefreshAnim_6FCBE6B0_113c,
  SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c,
  SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c,
  SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c,
  STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c,
  SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c,
  SKILLS_FindClosestUnitCallback_6FCBEDB0_113c,
  SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c,
  SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c,
  SKILLS_ConsumeEquippedItemSkillCharge_6FCBF4A0_113c,
  SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c,
  SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c,
  SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c,
  STATES_SetupAndCreateSkillAuraStatList_6FCC09F0_113c,
  SKILLS_AllocSkillMinDamCombatOnPathTarget_6FCC0E80_113c,
  SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c,
  SKILLS_CountUnitsInRadius_6FCC0FC0_113c,
  SKILLS_RollAvoidAndApplySkillDamage_6FCC10B0_113c,
  SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c,
  SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c,
  SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c,
  SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c,
  SKILLS_FreeOrDistributeExpForLinkedMonster_6FCC2EE0_113c,
  SKILLS_ApplyStunStateAndNeutralModeToMonster_6FCC2F90_113c,
  SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c,
  SKILLS_ApplyMeleeHitAuraStatesAndExecuteEvents_6FCC3220_113c,
  SKILLS_CreateTimedAuraStatListOnTarget_6FCC34E0_113c,
  STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c,
  SKILLS_CheckMonsterDeadAlongReverseVelocitySteps_6FCC3B50_113c,
  SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c,
  AI_SetStateDirAndStartWalkMode_6FCC41B0_113c,
  AI_InitSummonSkillLevelAndBasicAttack_6FCC4260_113c,
  AI_SyncSummonSkillLevelFromOwner_6FCC4450_113c,
  AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c,
  AI_AttackWestOffsetThenDie_6FCC4B90_113c,
  AI_TickSummonedTimedAttacker_6FCC4D10_113c,
  AI_CastSkill286AtOffsetY13_6FCC4E40_113c,
  AI_TickAncientStatueRevertCheck_6FCC4F40_113c,
  AI_TickSummonedFollowTeleportSkill292_6FCC5350_113c,
  AI_TickEmergeQuadrantAttackAndSubmerge_6FCC5580_113c,
  AI_TickTimedSkillCasterOrExpire_6FCC57E0_113c,
  AI_TickAmbientMode8OrStall30_6FCC58D0_113c,
} from '../../../src/d2kern-113c/game/k2-w4b6-113c.js';

describe('K2 Wave 4 Batch 6 (w4b6: 0x6FCBD610..0x6FCC58D0)', () => {
  it('1. CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c throws on null client and queues packets', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x200);
    expect(() => CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c(m, 0, pGame)).toThrow();

    const pClient = m.alloc(0x200);
    const pAct = m.alloc(0x80);
    const pEnv = m.alloc(0x80);
    m.setU8(pClient + 0x1ac, 0);
    m.setU32(pGame + 0xbc, pAct);
    m.setU32(pAct + 0x04, pEnv);
    const res = CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c(m, pClient, pGame);
    expect(typeof res).toBe('number');
  });

  it('2. ACT_AllocGameActAndInitEclipse_6FCBD6F0_113c throws when pArena is null', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x2000);
    expect(() => ACT_AllocGameActAndInitEclipse_6FCBD6F0_113c(m, pGame, 0)).toThrow();
  });

  it('3. SKILLS_AllocAndFindUnitsInRadius_6FCBE570_113c allocates and initializes unit find data', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x100);
    const pUnit = m.alloc(0x100);
    const pFind = SKILLS_AllocAndFindUnitsInRadius_6FCBE570_113c(m, 20, pGame, pUnit, 5, 10);
    expect(pFind).toBeGreaterThan(0);
  });

  it('4. SKILLS_ClampLifeManaStaminaToMaxAndRefreshAnim_6FCBE6B0_113c clamps stats cleanly', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    m.setU32(pUnit, 4);
    SKILLS_ClampLifeManaStaminaToMaxAndRefreshAnim_6FCBE6B0_113c(m, pUnit);
    expect(m.u32(pUnit)).toBe(4);
  });

  it('5. SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c reads player and default walk speeds', () => {
    const m = new SparseMemory113c();
    expect(SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c(m, 0)).toBe(0x600);

    const pPlayer = m.alloc(0x100);
    m.setU32(pPlayer + 0x00, 0);
    m.setU32(pPlayer + 0x04, 0);
    const pDt = m.alloc(0x1000);
    const pCharStats = m.alloc(0x200);
    m.setU32(0x6fd1829c, 0x6fde9e1c);
    m.setU32(0x6fde9e1c, pDt);
    m.setU32(pDt + 0xbc4, pCharStats);
    m.setU32(pDt + 0xbc8, 7);
    m.setU8(pCharStats + 0x40, 9);
    expect(SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c(m, pPlayer)).toBe(9 << 8);
  });

  it('6. SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c returns 0 when caster or skill level is invalid', () => {
    const m = new SparseMemory113c();
    const pCenter = m.alloc(0x100);
    const pCaster = m.alloc(0x100);
    expect(SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c(m, pCenter, pCaster, 0)).toBe(0);
  });

  it('7. SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c returns 0 on non-positive skill ID', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x100);
    const pUnit = m.alloc(0x100);
    expect(SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c(m, pGame, pUnit, 0, 1)).toBe(0);
  });

  it('8. STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c ignores state with zero group', () => {
    const m = new SparseMemory113c();
    const pDt = m.alloc(0x1000);
    const pStates = m.alloc(0x200);
    m.setU32(0x6fd1829c, 0x6fde9e1c);
    m.setU32(0x6fde9e1c, pDt);
    m.setU32(pDt + 0xbc, pStates);
    m.setU32(pDt + 0xc4, 2);
    m.setU16(pStates + 0x1e, 0);
    const pUnit = m.alloc(0x100);
    expect(STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c(m, pUnit, 0, 0)).toBe(0);
  });

  it('9. SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c returns 1 for non-player unit', () => {
    const m = new SparseMemory113c();
    const pMonster = m.alloc(0x100);
    m.setU32(pMonster + 0x00, 1);
    expect(SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c(m, pMonster)).toBe(1);
  });

  it('10. SKILLS_FindClosestUnitCallback_6FCBEDB0_113c updates closest target when closer', () => {
    const m = new SparseMemory113c();
    const pFindArg = m.alloc(0x20);
    const pClosestCtx = m.alloc(0x20);
    const pCandidate = m.alloc(0x100);
    const pPath = m.alloc(0x40);
    m.setU32(pFindArg + 0x0c, pClosestCtx);
    m.setU32(pClosestCtx + 0x04, 100);
    m.setU32(pClosestCtx + 0x08, 10);
    m.setU32(pClosestCtx + 0x0c, 10);
    m.setU32(pCandidate + 0x00, 2);
    m.setU32(pCandidate + 0x2c, pPath);
    m.setU32(pPath + 0x0c, 13);
    m.setU32(pPath + 0x10, 14);
    expect(SKILLS_FindClosestUnitCallback_6FCBEDB0_113c(m, pFindArg, pCandidate)).toBe(1);
    expect(m.u32(pClosestCtx + 0x00)).toBe(pCandidate);
    expect(m.u32(pClosestCtx + 0x04)).toBe(25);
  });

  it('11. SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c throws on null search spec or callback', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x100);
    expect(() => SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c(m, 0, pGame)).toThrow();
  });

  it('12. SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c returns 0 on negative skill ID', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    const pDmg = m.alloc(0x80);
    expect(SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c(m, -1, pUnit, pDmg, 1)).toBe(0);
  });

  it('13. SKILLS_ConsumeEquippedItemSkillCharge_6FCBF4A0_113c returns 0 when item GUID is not found', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x2000);
    const pUnit = m.alloc(0x100);
    const pSkill = m.alloc(0x60);
    expect(SKILLS_ConsumeEquippedItemSkillCharge_6FCBF4A0_113c(m, pGame, pUnit, 99, pSkill)).toBe(0);
  });

  it('14. SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c ignores non-monster unit', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    m.setU32(pUnit + 0x00, 0);
    SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c(m, pUnit);
    expect(m.u32(pUnit)).toBe(0);
  });

  it('15. SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c reads target unit coordinates', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    const pTarget = m.alloc(0x100);
    const pUnitPath = m.alloc(0x60);
    const pTargetPath = m.alloc(0x60);
    const pGame = m.alloc(0x2000);
    const pOutX = m.alloc(8);
    const pOutY = m.alloc(8);
    m.setU32(pUnit + 0x2c, pUnitPath);
    m.setU32(pUnitPath + 0x58, pTarget);
    m.setU32(pTarget + 0x00, 2);
    m.setU32(pTarget + 0x2c, pTargetPath);
    m.setU32(pTargetPath + 0x0c, 120);
    m.setU32(pTargetPath + 0x10, 240);
    const res = SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c(m, pUnit, pGame, pOutX, pOutY);
    expect(typeof res).toBe('number');
  });

  it('16. SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c ignores non-player or zero delay', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x100);
    const pUnit = m.alloc(0x100);
    m.setU32(pUnit + 0x00, 1);
    SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c(m, 10, pUnit, pGame);
    expect(m.u32(pUnit)).toBe(1);
  });

  it('17. STATES_SetupAndCreateSkillAuraStatList_6FCC09F0_113c throws when target is null', () => {
    const m = new SparseMemory113c();
    const pOwner = m.alloc(0x100);
    expect(() => STATES_SetupAndCreateSkillAuraStatList_6FCC09F0_113c(m, 1, -1, 0, pOwner, 0, 0, -1)).toThrow();
  });

  it('18. SKILLS_AllocSkillMinDamCombatOnPathTarget_6FCC0E80_113c returns 0 when no target unit', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x2000);
    const pUnit = m.alloc(0x100);
    const pPath = m.alloc(0x60);
    m.setU32(pUnit + 0x2c, pPath);
    expect(SKILLS_AllocSkillMinDamCombatOnPathTarget_6FCC0E80_113c(m, pGame, pUnit, -1, 1)).toBe(0);
  });

  it('19. SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c returns 0 and writes 0 count when no room', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x100);
    const pUnit = m.alloc(0x100);
    const pOutCount = m.alloc(8);
    expect(SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c(m, 0, 5, 2, pOutCount, 10, pGame, pUnit, 20)).toBe(0);
    expect(m.u32(pOutCount)).toBe(0);
  });

  it('20. SKILLS_CountUnitsInRadius_6FCC0FC0_113c returns 0 when center has no room', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x100);
    const pUnit = m.alloc(0x100);
    expect(SKILLS_CountUnitsInRadius_6FCC0FC0_113c(m, 0, 5, 10, pGame, pUnit, 20)).toBe(0);
  });

  it('21. SKILLS_RollAvoidAndApplySkillDamage_6FCC10B0_113c returns early on zero hit flags', () => {
    const m = new SparseMemory113c();
    const pAttacker = m.alloc(0x100);
    const pDefender = m.alloc(0x100);
    const pDmg = m.alloc(0x80);
    const pGame = m.alloc(0x100);
    m.setU32(pAttacker + 0x00, 0);
    m.setU16(pDmg + 0x04, 0);
    SKILLS_RollAvoidAndApplySkillDamage_6FCC10B0_113c(m, pAttacker, pDmg, pGame, pDefender);
    expect(m.u16(pDmg + 0x04)).toBe(0);
  });

  it('22. SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c returns 0 when item code is unknown', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    const pGame = m.alloc(0x100);
    const pLinker = m.alloc(0x40);
    const pDt = m.alloc(0x1000);
    m.setU32(0x6fdeff6c, pLinker);
    m.setU32(0x6fde9e1c, pDt);
    expect(SKILLS_CreateDroppedItemByCodeAtUnit_6FCC1350_113c(m, 0x3f3f3f3f, pUnit, pGame, 2)).toBe(0);
  });

  it('23. SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c returns 0 on null item', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x100);
    const pOwner = m.alloc(0x100);
    expect(SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c(m, 0, pGame, pOwner)).toBe(0);
  });

  it('24. SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c asserts when count exceeds ring capacity', () => {
    const m = new SparseMemory113c();
    const pParams = m.alloc(0x80);
    const pGame = m.alloc(0x100);
    let fault = 0;
    SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c(m, pParams, pGame, 42, {
      assertFault: (line) => {
        fault = line;
      },
    });
    expect(fault).toBe(0xf0d);
  });

  it('25. SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c asserts on null pointers', () => {
    const m = new SparseMemory113c();
    let fault = 0;
    SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c(m, 0, 1, 1, {
      assertFault: (line) => {
        fault = line;
      },
    });
    expect(fault).toBe(0x1211);
  });

  it('26. SKILLS_FreeOrDistributeExpForLinkedMonster_6FCC2EE0_113c resets linked monster GUID to -1', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    const pMonData = m.alloc(0x80);
    const pGame = m.alloc(0x2000);
    m.setU32(pUnit + 0x14, pMonData);
    m.setU32(pMonData + 0x40, 12);
    SKILLS_FreeOrDistributeExpForLinkedMonster_6FCC2EE0_113c(m, pUnit, pGame);
    expect(m.u32(pMonData + 0x40) | 0).toBe(-1);
  });

  it('27. SKILLS_ApplyStunStateAndNeutralModeToMonster_6FCC2F90_113c ignores non-monster unit', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    const pGame = m.alloc(0x100);
    m.setU32(pUnit + 0x00, 0);
    SKILLS_ApplyStunStateAndNeutralModeToMonster_6FCC2F90_113c(m, 25, pUnit, pGame);
    expect(m.u32(pUnit)).toBe(0);
  });

  it('28. SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c returns 0 on negative skill ID', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x100);
    const pUnit = m.alloc(0x100);
    expect(SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c(m, -1, 1, pGame, pUnit, 1, 0)).toBe(0);
  });

  it('29. SKILLS_ApplyMeleeHitAuraStatesAndExecuteEvents_6FCC3220_113c returns 0 on negative skill ID', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x100);
    const pUnit = m.alloc(0x100);
    expect(SKILLS_ApplyMeleeHitAuraStatesAndExecuteEvents_6FCC3220_113c(m, pGame, pUnit, -1, 1)).toBe(0);
  });

  it('30. SKILLS_CreateTimedAuraStatListOnTarget_6FCC34E0_113c returns 0 on negative skill ID', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x100);
    const pCaster = m.alloc(0x100);
    const pTarget = m.alloc(0x100);
    expect(
      SKILLS_CreateTimedAuraStatListOnTarget_6FCC34E0_113c(m, pGame, pCaster, pTarget, 10, -1, 1),
    ).toBe(0);
  });

  it('31. STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c returns 0 on negative state', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    expect(STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c(m, pUnit, -1)).toBe(0);
  });

  it('32. SKILLS_CheckMonsterDeadAlongReverseVelocitySteps_6FCC3B50_113c asserts when unit has no room', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x100);
    const pUnit = m.alloc(0x100);
    let fault = 0;
    SKILLS_CheckMonsterDeadAlongReverseVelocitySteps_6FCC3B50_113c(m, pGame, pUnit, {
      assertFault: (line) => {
        fault = line;
      },
    });
    expect(fault).toBe(0x141b);
  });

  it('33. SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c rejects self or null target', () => {
    const m = new SparseMemory113c();
    const pCaster = m.alloc(0x100);
    expect(SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c(m, 0, pCaster)).toBe(0);
    expect(SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c(m, pCaster, pCaster)).toBe(0);
  });

  it('34. AI_SetStateDirAndStartWalkMode_6FCC41B0_113c updates AI control state and clamped step direction', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    const pMonData = m.alloc(0x60);
    const pAiCtrl = m.alloc(0x40);
    const pGame = m.alloc(0x100);
    m.setU32(pUnit + 0x00, 1);
    m.setU32(pUnit + 0x14, pMonData);
    m.setU32(pMonData + 0x2c, pAiCtrl);
    AI_SetStateDirAndStartWalkMode_6FCC41B0_113c(m, 1, 0x60, pUnit, pGame, 0);
    expect(m.u32(pAiCtrl + 0x18)).toBe(7);
    expect(m.u8(pAiCtrl + 0x20)).toBe(0x4d);
  });

  it('35. AI_InitSummonSkillLevelAndBasicAttack_6FCC4260_113c initializes default AI skill level 1', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    const pAiArgs = m.alloc(0x40);
    const pAiCmd = m.alloc(0x40);
    m.setU32(pAiArgs + 0x00, pAiCmd);
    AI_InitSummonSkillLevelAndBasicAttack_6FCC4260_113c(m, pUnit, pAiArgs);
    expect(m.u32(pAiCmd + 0x1c)).toBe(1);
  });

  it('36. AI_SyncSummonSkillLevelFromOwner_6FCC4450_113c sets default AI skill level 1', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    const pAiArgs = m.alloc(0x40);
    const pAiCmd = m.alloc(0x40);
    m.setU32(pAiArgs + 0x00, pAiCmd);
    AI_SyncSummonSkillLevelFromOwner_6FCC4450_113c(m, pUnit, pAiArgs);
    expect(m.u32(pAiCmd + 0x1c)).toBe(1);
  });

  it('37. AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c returns 1 when owner is missing', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    const pGame = m.alloc(0x200);
    EVENT_InitTimerQueue113c(m, pGame);
    m.setU32(pUnit + 0x00, 1);
    m.setU32(pUnit + 0x10, 1);
    const pAiArgs = m.alloc(0x40);
    expect(AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10_113c(m, pUnit, pGame, pAiArgs, 1)).toBe(1);
  });

  it('38. AI_AttackWestOffsetThenDie_6FCC4B90_113c sets unit flag 0x20000 when stage is 1', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x200);
    EVENT_InitTimerQueue113c(m, pGame);
    const pUnit = m.alloc(0x100);
    m.setU32(pUnit + 0x00, 1);
    m.setU32(pUnit + 0x10, 1);
    const pAiArgs = m.alloc(0x40);
    const pAiCmd = m.alloc(0x40);
    m.setU32(pAiArgs + 0x00, pAiCmd);
    m.setU32(pAiCmd + 0x18, 1);
    AI_AttackWestOffsetThenDie_6FCC4B90_113c(m, pGame, pUnit, pAiArgs);
    expect((m.u32(pUnit + 0xc4) & 0x20000) !== 0).toBe(true);
  });

  it('39. AI_TickSummonedTimedAttacker_6FCC4D10_113c distributes exp when summon flag is absent', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x100);
    const pUnit = m.alloc(0x100);
    const pAiArgs = m.alloc(0x40);
    AI_TickSummonedTimedAttacker_6FCC4D10_113c(m, pGame, pUnit, pAiArgs);
    expect(m.u32(pUnit + 0xc8)).toBe(0);
  });

  it('40. AI_CastSkill286AtOffsetY13_6FCC4E40_113c asserts when skill 0x11e is missing on unit', () => {
    const m = new SparseMemory113c();
    const pUnit = m.alloc(0x100);
    const pAiArgs = m.alloc(0x40);
    const pDt = m.alloc(0x1000);
    m.setU32(0x6fd1829c, 0x6fde9e1c);
    m.setU32(0x6fde9e1c, pDt);
    let fault = 0;
    AI_CastSkill286AtOffsetY13_6FCC4E40_113c(m, pUnit, pAiArgs, 5, {
      assertFault: (line) => {
        fault = line;
      },
    });
    expect(fault).toBe(0x1702);
  });

  it('41. AI_TickAncientStatueRevertCheck_6FCC4F40_113c stalls 25 frames when quest 35 is not present', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x2000);
    const pTimer = m.alloc(0xb00);
    const pUnit = m.alloc(0x100);
    m.setU32(pGame + 0xb8, pTimer);
    AI_TickAncientStatueRevertCheck_6FCC4F40_113c(m, pGame, pUnit, 0);
    expect(m.u32(pGame + 0x10f4)).toBe(0);
  });

  it('42. AI_TickSummonedFollowTeleportSkill292_6FCC5350_113c stalls when cooldown has not expired', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x200);
    const pTimer = m.alloc(0xb00);
    const pUnit = m.alloc(0x100);
    const pAiArgs = m.alloc(0x40);
    const pAiCmd = m.alloc(0x40);
    const pMonStats = m.alloc(0x100);
    m.setU32(pGame + 0xb8, pTimer);
    m.setU32(pAiArgs + 0x00, pAiCmd);
    m.setU32(pAiArgs + 0x1c, pMonStats);
    m.setU32(pAiCmd + 0x14, 100);
    m.setU32(pGame + 0xa8, 50);
    m.setU16(pMonStats + 0x5c, 15);
    AI_TickSummonedFollowTeleportSkill292_6FCC5350_113c(m, pGame, pUnit, pAiArgs);
    expect(m.u32(pAiCmd + 0x14)).toBe(100);
  });

  it('43. AI_TickEmergeQuadrantAttackAndSubmerge_6FCC5580_113c sets unit flag 0x20000 and emerges when close', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x200);
    EVENT_InitTimerQueue113c(m, pGame);
    const pUnit = m.alloc(0x100);
    m.setU32(pUnit + 0x00, 1);
    m.setU32(pUnit + 0x10, 1);
    const pTarget = m.alloc(0x100);
    const pAiArgs = m.alloc(0x40);
    const pAiCmd = m.alloc(0x40);
    const pDt = m.alloc(0x1000);
    m.setU32(0x6fd1829c, 0x6fde9e1c);
    m.setU32(0x6fde9e1c, pDt);
    m.setU32(pAiArgs + 0x00, pAiCmd);
    m.setU32(pAiArgs + 0x08, pTarget);
    m.setU32(pAiArgs + 0x14, 3);
    m.setU32(pGame + 0xa8, 77);
    AI_TickEmergeQuadrantAttackAndSubmerge_6FCC5580_113c(m, pGame, pUnit, pAiArgs);
    expect((m.u32(pUnit + 0xc4) & 0x20000) !== 0).toBe(true);
    expect(m.u32(pAiCmd + 0x14)).toBe(1);
    expect(m.u32(pAiCmd + 0x18)).toBe(77);
  });

  it('44. AI_TickTimedSkillCasterOrExpire_6FCC57E0_113c expires when current game frame exceeds timer', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x200);
    EVENT_InitTimerQueue113c(m, pGame);
    const pUnit = m.alloc(0x100);
    m.setU32(pUnit + 0x00, 1);
    m.setU32(pUnit + 0x10, 1);
    const pAiArgs = m.alloc(0x40);
    const pAiCmd = m.alloc(0x40);
    const pMonStats = m.alloc(0x200);
    m.setU32(pAiArgs + 0x00, pAiCmd);
    m.setU32(pAiArgs + 0x1c, pMonStats);
    m.setU32(pAiCmd + 0x14, 10);
    m.setU32(pGame + 0xa8, 20);
    AI_TickTimedSkillCasterOrExpire_6FCC57E0_113c(m, pGame, pUnit, pAiArgs);
    expect(m.u32(pAiCmd + 0x14)).toBe(10);
  });

  it('45. AI_TickAmbientMode8OrStall30_6FCC58D0_113c advances PRNG and dispatches mode 8 or stall 30', () => {
    const m = new SparseMemory113c();
    const pGame = m.alloc(0x200);
    const pTimer = m.alloc(0xb00);
    const pUnit = m.alloc(0x100);
    const pDt = m.alloc(0x1000);
    m.setU32(0x6fd1829c, 0x6fde9e1c);
    m.setU32(0x6fde9e1c, pDt);
    m.setU32(pGame + 0xb8, pTimer);
    m.setU32(pUnit + 0x20, 12345);
    m.setU32(pUnit + 0x24, 67890);
    AI_TickAmbientMode8OrStall30_6FCC58D0_113c(m, pGame, pUnit, 0);
    expect(m.u32(pUnit + 0x20)).not.toBe(12345);
  });
});
