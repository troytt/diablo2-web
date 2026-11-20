import { describe, expect, it } from 'vitest';
import { D2COMMON_SGPT_DATATABLES_VA_113C } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts';
import {
  ACT1Q1_Callback00_NpcActivateAkara_6FC83C40_113c,
  ACT1Q1_TimerPromoteState5_6FC83B50_113c,
  ACT1Q2_Callback00_NpcActivateKashya_6FC83AD0_113c,
  ACT1Q2_TimerPromoteState3_6FC83A80_113c,
  ACT1Q3_CompleteCharsiImbueQuestGlobal_6FC83350_113c,
  ACT1Q4_Callback00_NpcActivateAkaraOrCain_6FC835D0_113c,
  ACT1Q4_Callback02_OnGriswoldDeath_6FC85A70_113c,
  ACT1Q4_TimerRefreshCainMonsterState_6FC88250_113c,
  ACT1Q5_Callback00_NpcActivateCharsi_6FC83870_113c,
  ACT1Q5_DecrementCounterAndCheckState3_6FC836C0_113c,
  ACT1Q5_OnMoldyTomeActivated_6FC83730_113c,
  ACT1Q5_TimerPromoteState0D_6FC83210_113c,
  ACT1Q6_Callback00_NpcActivateCain_6FC83190_113c,
  ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c,
  ACT3Q2_RemoveAllCubePage3ItemsFromUnit_6FC911D0_113c,
  ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720_113c,
  ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c,
  ACT5Q1_OnShenkSpottedPromoteState2_6FC7A690_113c,
  ACT5Q2_Callback00_NpcActivateQualKehk_6FC7A530_113c,
  ACT5Q2_Callback02_MonsterKilled_6FC7A310_113c,
  ACT5Q2_PromoteState5IfPrisonersRemaining_6FC7A200_113c,
  ACT5Q2_RescueBarbarianSoldierGroup_6FC7B9B0_113c,
  ACT5Q3_Callback00_NpcActivateMalah_6FC7A0A0_113c,
  ACT5Q3_OnFrozenAnyaSpawnedPromoteState2_6FC79EF0_113c,
  ACT5Q3_OnFrozenRiverEnteredPromoteState2_6FC79F80_113c,
  ACT5Q4_OnHallsEnteredPromoteState3_6FC79C50_113c,
  ACT5Q4_TimerPromoteState4_6FC79CD0_113c,
  ACT5Q5_Callback00_NpcActivateQualKehk_6FC79BE0_113c,
  ACT5Q5_CheckSummitPlayerDeathResetAncients_6FC7E200_113c,
  ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920_113c,
  ACT5Q6_OnWorldstoneChamberEntered_6FC798B0_113c,
  ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c,
  ACT5Q6_RollBaalTauntMonsterIdAndBroadcastPacket50_6FC7A820_113c,
  AI_ThinkTyraelOrIzualGhost_6FC39880_113c,
  ITEMS_RollAndApplyWeaponDurabilityOrQuantityLoss_6FC6C9E0_113c,
  MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c,
  OBJECTS_OperateFn_SpawnRandomLevelMonster_6FC5BC00_113c,
  PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c,
  QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c,
  QUESTS_SetMainStateAndIterateLivingPlayers_6FC554A0_113c,
  SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c,
  SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c,
  SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760_113c,
  SKILLS_SrvDo_WhirlwindTick_6FC48BE0_113c,
  SKILLS_UpdateLeapMovementStep_6FC48740_113c,
} from '../../../src/d2kern-113c/game/k2-w6b4-113c.ts';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

function setupTables(m: SparseMemory113c): number {
  const pTables = m.alloc(0x1000);
  const pSkillsTxt = m.alloc(0x23c * 4);
  const pMonStatsTxt = m.alloc(0x1a8 * 4);
  const pLevelsTxt = m.alloc(0x220 * 4);
  const pItemsLinker = m.alloc(0x20);
  const pLinkerEntry = m.alloc(0x10);
  const pBitMasks = m.alloc(0x80);
  m.setU32(pLinkerEntry, 0x20737076);
  m.setU32((pLinkerEntry + 0x04) >>> 0, 0);
  m.setU32(pItemsLinker, 1);
  m.setU32((pItemsLinker + 0x08) >>> 0, pLinkerEntry);
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pTables);
  m.setU32(0x6fd1829c, D2COMMON_SGPT_DATATABLES_VA_113C);
  m.setU32(0x6fd18be0, pBitMasks);
  m.setU32(0x6fdeff6c, pItemsLinker);
  m.setU32(0x6fdf13c4, 0);
  m.setU32((pTables + 0xa78) >>> 0, pMonStatsTxt);
  m.setU32((pTables + 0xa80) >>> 0, 4);
  m.setU32((pTables + 0xb98) >>> 0, pSkillsTxt);
  m.setU32((pTables + 0xba0) >>> 0, 4);
  m.setU32((pTables + 0xbf8) >>> 0, pLevelsTxt);
  m.setU32((pTables + 0xc00) >>> 0, 4);
  return pTables;
}

function setupGameWithQuestArray(m: SparseMemory113c): {
  pGame: number;
  pQuestCtrl: number;
  pQuests: number[];
} {
  const pGame = m.alloc(0x2000);
  EVENT_InitTimerQueue113c(m, pGame);
  const pQuestCtrl = m.alloc(0x80);
  const pQuestBitBuf = m.alloc(0x20);
  const pQuestBitBufBytes = m.alloc(0x80);
  m.setU32(pQuestBitBuf, pQuestBitBufBytes);
  m.setU32((pQuestBitBuf + 0x04) >>> 0, 0x200);
  m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl);
  m.setU32((pQuestCtrl + 0x08) >>> 0, 1);
  m.setU32((pQuestCtrl + 0x0c) >>> 0, pQuestBitBuf);
  const pQuests: number[] = [];
  for (let i = 0; i < 42; i++) {
    const pQ = m.alloc(0x100);
    const pExt = m.alloc(0x100);
    m.setU32(pQ, i);
    m.setU32((pQ + 0x04) >>> 0, pGame);
    m.setU32((pQ + 0x18) >>> 0, pExt);
    pQuests.push(pQ);
  }
  const pQuestChain = pQuests[0]!;
  for (let i = 0; i < pQuests.length - 1; i++) {
    m.setU32((pQuests[i]! + 0xf4) >>> 0, pQuests[i + 1]!);
  }
  m.setU32(pQuestCtrl, pQuestChain);
  return { pGame, pQuestCtrl, pQuests };
}

describe('K2 Wave 6 Batch 4 (w6b4): D2Game 0x6FC2C760..0x6FCB2940', () => {
  it('ports [1..11] skills, AI, death splash, quest state helpers, portal cleanup, and durability', () => {
    const m = new SparseMemory113c();
    setupTables(m);
    const { pGame, pQuests } = setupGameWithQuestArray(m);

    const pUnit = m.alloc(0x100);
    const pPath = m.alloc(0x80);
    m.setU32((pUnit + 0x2c) >>> 0, pPath);
    const pSkill = m.alloc(0x80);
    expect(SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760_113c(m, pGame, pUnit, -1, 1)).toBe(0);
    expect(SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760_113c(m, pGame, pUnit, 1, 1)).toBe(0);

    const pAiArgs = m.alloc(0x40);
    AI_ThinkTyraelOrIzualGhost_6FC39880_113c(m, pGame, pUnit, pAiArgs);

    m.setU32((pUnit + 0x04) >>> 0, 0);
    MONSTER_ApplyDeathExplosionSplashDamage_6FC44300_113c(m, pGame, pUnit);

    expect(SKILLS_UpdateLeapMovementStep_6FC48740_113c(m, pUnit, pGame, pSkill)).toBe(0);
    expect(SKILLS_SrvDo_WhirlwindTick_6FC48BE0_113c(m, pGame, pUnit, -1, 1)).toBe(0);

    const pQ0 = pQuests[0]!;
    let cbCalled = 0;
    QUESTS_SetMainStateAndIterateLivingPlayers_6FC554A0_113c(
      m,
      () => {
        cbCalled++;
        return 0;
      },
      pQ0,
      0,
      3,
      0,
    );
    expect(m.u8((pQ0 + 0x0b) >>> 0)).toBe(3);
    expect(cbCalled).toBe(0);

    QUESTS_SetGameQuestFlag20AndSyncPlayers_6FC55E90_113c(m, pGame, 1);

    const pPlrData = m.alloc(0x100);
    m.setU32(pUnit, 0);
    m.setU32((pUnit + 0x14) >>> 0, pPlrData);
    PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c(m, pUnit, pGame);

    expect(() => OBJECTS_OperateFn_SpawnRandomLevelMonster_6FC5BC00_113c(m, pGame, pUnit)).toThrow();
    expect(
      SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c(m, pUnit, pGame, -1, 1, 1),
    ).toBe(0);

    ITEMS_RollAndApplyWeaponDurabilityOrQuantityLoss_6FC6C9E0_113c(m, 50, pUnit, 0, pGame, 1);
  });

  it('ports [12..29] Act 5 quest callbacks and timers (0x6FC798B0..0x6FC7E200)', () => {
    const m = new SparseMemory113c();
    setupTables(m);
    const { pGame, pQuests } = setupGameWithQuestArray(m);

    ACT5Q6_OnWorldstoneChamberEntered_6FC798B0_113c(m, pGame);

    const pQ24 = pQuests[0x24]!;
    m.setU8((pQ24 + 0x09) >>> 0, 1);
    m.setU8((pQ24 + 0x0c) >>> 0, 0);
    expect(ACT5Q6_PromoteQuest24ToState1AndSync_6FC79930_113c(m, pQ24)).toBe(1);
    expect(m.u8((pQ24 + 0x0b) >>> 0)).toBe(1);

    const pQuestArg = m.alloc(0x40);
    m.setU32(pQuestArg, pGame);
    ACT5Q5_Callback00_NpcActivateQualKehk_6FC79BE0_113c(m, pQuests[0x23]!, pQuestArg);

    ACT5Q4_OnHallsEnteredPromoteState3_6FC79C50_113c(m, pGame);
    expect(ACT5Q4_TimerPromoteState4_6FC79CD0_113c(m, pQuests[0x22]!)).toBe(1);

    ACT5Q3_OnFrozenAnyaSpawnedPromoteState2_6FC79EF0_113c(m, pQuestArg);
    ACT5Q3_OnFrozenRiverEnteredPromoteState2_6FC79F80_113c(m, pGame);
    ACT5Q3_Callback00_NpcActivateMalah_6FC7A0A0_113c(m, pQuests[0x21]!, pQuestArg);

    ACT5Q2_PromoteState5IfPrisonersRemaining_6FC7A200_113c(m, pGame);
    ACT5Q2_Callback02_MonsterKilled_6FC7A310_113c(m, pQuests[0x20]!, pQuestArg);
    ACT5Q2_Callback00_NpcActivateQualKehk_6FC7A530_113c(m, pQuests[0x20]!, pQuestArg);

    const pUnit = m.alloc(0x100);
    ACT5Q1_OnShenkSpottedPromoteState2_6FC7A690_113c(m, pGame, pUnit);
    ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720_113c(m, pQuests[0x1f]!, pQuestArg);

    ACT5Q6_RollBaalTauntMonsterIdAndBroadcastPacket50_6FC7A820_113c(m, pQuestArg);
    ACT5Q2_RescueBarbarianSoldierGroup_6FC7B9B0_113c(m, pGame, pUnit, pUnit);
    ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c(m, pQuests[0x1f]!, pQuestArg);
    ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920_113c(m, pQ24, pQuestArg);
    ACT5Q5_CheckSummitPlayerDeathResetAncients_6FC7E200_113c(m, pUnit, pGame);
  });

  it('ports [30..45] Act 1/2/3 quest callbacks, cube item helpers, and Dragon Talon kick hit', () => {
    const m = new SparseMemory113c();
    setupTables(m);
    const { pGame, pQuests } = setupGameWithQuestArray(m);

    const pQuestArg = m.alloc(0x40);
    const pTarget = m.alloc(0x100);
    const pTargetPath = m.alloc(0x80);
    m.setU32((pTarget + 0x2c) >>> 0, pTargetPath);
    const pPlayer = m.alloc(0x100);
    const pPlayerPath = m.alloc(0x80);
    const pPlayerData = m.alloc(0x100);
    const pPlayerQuestBuf = m.alloc(0x20);
    const pPlayerQuestBytes = m.alloc(0x80);
    m.setU32(pPlayerQuestBuf, pPlayerQuestBytes);
    m.setU32((pPlayerQuestBuf + 0x04) >>> 0, 0x200);
    m.setU32((pPlayerData + 0x10) >>> 0, pPlayerQuestBuf);
    m.setU32(pPlayer, 0);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    m.setU32((pPlayer + 0x2c) >>> 0, pPlayerPath);
    m.setU32(pQuestArg, pGame);
    m.setU32((pQuestArg + 0x08) >>> 0, pTarget);
    m.setU32((pQuestArg + 0x0c) >>> 0, pPlayer);

    ACT1Q6_Callback00_NpcActivateCain_6FC83190_113c(m, pQuests[6]!, pQuestArg);
    expect(ACT1Q5_TimerPromoteState0D_6FC83210_113c(m, pQuests[5]!)).toBe(1);
    ACT1Q3_CompleteCharsiImbueQuestGlobal_6FC83350_113c(m, pQuests[3]!);
    ACT1Q4_Callback00_NpcActivateAkaraOrCain_6FC835D0_113c(m, pQuests[4]!, pQuestArg);
    ACT1Q5_DecrementCounterAndCheckState3_6FC836C0_113c(m, pQuests[5]!);
    ACT1Q5_OnMoldyTomeActivated_6FC83730_113c(m, pQuests[5]!, pQuestArg);
    ACT1Q5_Callback00_NpcActivateCharsi_6FC83870_113c(m, pQuests[5]!, pQuestArg);
    expect(ACT1Q2_TimerPromoteState3_6FC83A80_113c(m, pQuests[2]!)).toBe(1);
    ACT1Q2_Callback00_NpcActivateKashya_6FC83AD0_113c(m, pQuests[2]!, pQuestArg);
    expect(ACT1Q1_TimerPromoteState5_6FC83B50_113c(m, pQuests[1]!)).toBe(1);
    ACT1Q1_Callback00_NpcActivateAkara_6FC83C40_113c(m, pQuests[1]!, pQuestArg);

    // [41/45] 0x6FC85A70: Griswold death sets 'vps ' (0x20737076) on pTarget+0xb8
    m.setU32((pQuestArg + 0x0c) >>> 0, 0);
    ACT1Q4_Callback02_OnGriswoldDeath_6FC85A70_113c(m, pQuests[4]!, pQuestArg);
    expect(m.u32((pTarget + 0xb8) >>> 0)).toBe(0x20737076);

    // [42/45] 0x6FC88250: clears pExt+0x46 and returns 1
    const pExt4 = m.u32((pQuests[4]! + 0x18) >>> 0) >>> 0;
    m.setU8((pExt4 + 0x46) >>> 0, 1);
    expect(ACT1Q4_TimerRefreshCainMonsterState_6FC88250_113c(m, pQuests[4]!)).toBe(1);
    expect(m.u8((pExt4 + 0x46) >>> 0)).toBe(0);

    // [43/45] 0x6FC8B070: returns 0 when unit has no room
    expect(ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c(m, pGame, pPlayer, 0x20786f62, 0)).toBe(
      0,
    );

    // [44/45] 0x6FC911D0: returns 0 when pInventory == 0
    expect(ACT3Q2_RemoveAllCubePage3ItemsFromUnit_6FC911D0_113c(m, pPlayer, 0, pGame)).toBe(0);

    // [45/45] 0x6FCB2940: returns 0 when skillId < 0 or no target unit
    expect(SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c(m, pGame, pPlayer, -1, 1)).toBe(0);
    m.setU32(pPlayer, 4);
    expect(SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c(m, pGame, pPlayer, 1, 1)).toBe(0);
  });
});
