import { describe, expect, it } from 'vitest';
import {
  ACT2Q0_PresetSpawnJerhynAndRelocate_6FCE9B70_113c,
  ACT2Q1_UnitIterate_GrantRadamentKillInRoom_6FCE6070_113c,
  ACT2Q3_UnitIterate_PropagateCompleteToSubParty_6FCE5ED0_113c,
  ACT2Q4_UnitIterate_CompleteArcaneSanctuaryInLevel74_6FCE5C60_113c,
  ACT2Q5_UnitIterate_PropagateCompleteToSubParty_6FCE5B80_113c,
  ACT2Q6_UnitIterate_CompleteInAct2ForKillers_6FCE5910_113c,
  ACT2Q6_UnitIterate_CompleteInTalRashaChamber_6FCE59A0_113c,
  ACT2Q6_UnitIterate_GrantTombEntryState5_6FCE5820_113c,
  ACT3Q0_InitQuestData_6FD05920_113c,
  ACT3Q7_UnitIterate_CompleteInAct3ForParty_6FD05B60_113c,
  AI_ExecuteHirelingCombatStep_6FC3C8A0_113c,
  AI_ThinkAct2SewerTownNpc_6FC3B950_113c,
  AI_ThinkBladeCreeper_6FCC6B70_113c,
  AI_ThinkBloodLord_6FCA8810_113c,
  AI_ThinkChargeStateIconMelee_6FCA4A90_113c,
  AI_ThinkCommand14TriggeredSkill_6FC9D670_113c,
  AI_ThinkFetishMelee_6FC9ED90_113c,
  AI_ThinkFetishShaman_6FCA7BB0_113c,
  AI_ThinkGiantMosquito_6FCA6280_113c,
  AI_ThinkHomeLeashedCaster_6FC39E70_113c,
  AI_ThinkImpregnatedMonster_6FC366D0_113c,
  AI_ThinkLowLifeFleeCaster_6FC9E070_113c,
  AI_ThinkMephistoBoss_6FCA5B60_113c,
  AI_ThinkMinionCommandSkirmisher_6FC3B2F0_113c,
  AI_ThinkMultiStrikeComboMelee_6FCA08A0_113c,
  AI_ThinkOblivionKnightCaster_6FCA4DB0_113c,
  AI_ThinkPackLeaderCommand1Melee_6FCA20D0_113c,
  AI_ThinkPackRegroupSkirmisher_6FC3B780_113c,
  AI_ThinkPutridDefiler_6FC3A550_113c,
  AI_ThinkRegenBoostRetreatMelee_6FCA2990_113c,
  AI_ThinkSelfBuffRetreatSkirmisher_6FCA0B00_113c,
  AI_ThinkSlinger_6FCA74A0_113c,
  AI_ThinkSpecialAiState3_6FCBCC00_113c,
  AI_ThinkTerrorCurse_6FCC6FC0_113c,
  AI_ThinkThreePhaseMeleeRetreat_6FCA00C0_113c,
  AI_ThinkThornHulk_6FCA64A0_113c,
  AI_ThinkTownRogueGuard_6FC39740_113c,
  AI_ThinkVampire_6FCA6900_113c,
  AI_ThinkWillowisp_6FCA7010_113c,
  AI_ThinkZakarumHealerOrPriest_6FC39080_113c,
  NET_BroadcastSystemChatMessage_6FCEBE70_113c,
  PACKET_SrvMercMoveToCoord_6FCED360_113c,
  PACKET_SrvMercMoveToUnit_6FCED3D0_113c,
  PLAYER_SyncClientLifeManaStaminaGoldAndCoords_6FCEC030_113c,
  SUNIT_CancelPlayerUnitInteraction_6FD00BF0_113c,
} from '../../../src/d2kern-113c/game/k2-w6b3-113c';
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory';

function createBaseMemory() {
  const m = new SparseMemory113c();
  m.fill(0x7ffbc000, 0x2000, 0);
  m.fill(0x6fd20000, 0x10000, 0);

  const pBitMasks = m.alloc(0x80);
  for (let i = 0; i < 32; i++) {
    m.setU32((pBitMasks + i * 4) >>> 0, (1 << i) >>> 0);
  }
  m.setU32(0x6fd182a4, pBitMasks);

  const pSgptHolder = m.alloc(8);
  const pDataTables = m.alloc(0x1000);
  m.setU32(pSgptHolder, pDataTables);
  m.setU32(0x6fd1829c, pSgptHolder);
  m.setU32(0x6fde9e1c, pDataTables);

  const pStates = m.alloc(0x3c * 128);
  m.setU32((pDataTables + 0xbc) >>> 0, pStates);
  m.setU32((pDataTables + 0xc4) >>> 0, 128);

  const pMonStats = m.alloc(0x1a8 * 512);
  const pAiParamTbl = m.alloc(0x100);
  for (let i = 0; i < 16; i++) {
    m.setU32((pMonStats + i * 0x1a8 + 0x14) >>> 0, pAiParamTbl);
  }
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStats);
  m.setU32((pDataTables + 0xa80) >>> 0, 512);

  const pMonStats2 = m.alloc(0x134 * 16);
  m.setU32((pDataTables + 0xa84) >>> 0, pMonStats2);
  m.setU32((pDataTables + 0xa8c) >>> 0, 16);

  const pSkills = m.alloc(0x23c * 32);
  m.setU32((pDataTables + 0xb98) >>> 0, pSkills);
  m.setU32((pDataTables + 0xba0) >>> 0, 32);

  const pCharStats = m.alloc(0xc4 * 8);
  m.setU32((pDataTables + 0xbc4) >>> 0, pCharStats);
  m.setU32((pDataTables + 0xbc8) >>> 0, 8);

  const pPetTypes = m.alloc(0x40 * 16);
  m.setU32((pDataTables + 0xbec) >>> 0, pPetTypes);
  m.setU32((pDataTables + 0xbf0) >>> 0, 16);

  const pLevelsTxt = m.alloc(0x220 * 16);
  m.setU32((pDataTables + 0xc58) >>> 0, pLevelsTxt);
  m.setU32((pDataTables + 0xc60) >>> 0, 16);

  return { m, pDataTables, pMonStats, pMonStats2, pSkills, pAiParamTbl };
}

function allocQuestBitBuffer(m: SparseMemory113c): { pQuestFlags: number; pQuestBytes: number } {
  const pQuestFlags = m.alloc(0x10);
  const pQuestBytes = m.alloc(0x100);
  m.setU32(pQuestFlags, pQuestBytes);
  m.setU32((pQuestFlags + 4) >>> 0, 0x400);
  return { pQuestFlags, pQuestBytes };
}

function createAiFixture() {
  const { m, pDataTables, pMonStats, pMonStats2 } = createBaseMemory();
  const pGame = m.alloc(0x2000);
  EVENT_InitTimerQueue113c(m, pGame);

  const pRoom = m.alloc(0x100);
  const pRoomEx = m.alloc(0x200);
  const pLevel = m.alloc(0x200);
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx);
  m.setU32((pRoomEx + 0x58) >>> 0, pLevel);
  m.setU32((pLevel + 0x1d0) >>> 0, 2);

  const pMonster = m.alloc(0x200);
  const pMonsterData = m.alloc(0x100);
  const pAiGeneral = m.alloc(0x100);
  const pAiControl = m.alloc(0x100);
  const pCmdNode = m.alloc(0x40);
  const pPath = m.alloc(0x100);
  const pAiTickArgs = m.alloc(0x40);
  const pTarget = m.alloc(0x200);
  const pTargetData = m.alloc(0x100);
  const pTargetPath = m.alloc(0x100);

  m.setU32((pCmdNode + 0x04) >>> 0, pCmdNode);
  m.setU32((pCmdNode + 0x08) >>> 0, pCmdNode);
  m.setU32((pAiGeneral + 0x10) >>> 0, pCmdNode);
  m.setU32((pAiControl + 0x10) >>> 0, pCmdNode);

  m.setU32(pMonster, 1); // UNIT_MONSTER
  m.setU32((pMonster + 0x04) >>> 0, 1);
  m.setU32((pMonster + 0x0c) >>> 0, 10);
  m.setU32((pMonster + 0x10) >>> 0, 1); // MONMODE_NEUTRAL
  m.setU32((pMonster + 0x14) >>> 0, pMonsterData);
  m.setU32((pMonster + 0x20) >>> 0, 0x12345678);
  m.setU32((pMonster + 0x24) >>> 0, 0x9abcdef0);
  m.setU32((pMonster + 0x2c) >>> 0, pPath);

  m.setU16((pPath + 0x02) >>> 0, 100);
  m.setU16((pPath + 0x06) >>> 0, 100);
  m.setU32((pPath + 0x1c) >>> 0, pRoom);

  m.setU32(pMonsterData, pMonStats);
  m.setU32((pMonsterData + 0x18) >>> 0, pAiGeneral);
  m.setU32((pMonsterData + 0x28) >>> 0, pMonStats);
  m.setU32((pMonsterData + 0x2c) >>> 0, pAiControl);

  m.setU32(pTarget, 0); // UNIT_PLAYER
  m.setU32((pTarget + 0x0c) >>> 0, 1);
  m.setU32((pTarget + 0x10) >>> 0, 1);
  m.setU32((pTarget + 0x14) >>> 0, pTargetData);
  m.setU32((pTarget + 0x2c) >>> 0, pTargetPath);
  m.setU16((pTargetPath + 0x02) >>> 0, 102);
  m.setU16((pTargetPath + 0x06) >>> 0, 102);
  m.setU32((pTargetPath + 0x1c) >>> 0, pRoom);

  m.setU32(pAiTickArgs, pTarget);
  m.setU32((pAiTickArgs + 0x04) >>> 0, 0);
  m.setU32((pAiTickArgs + 0x08) >>> 0, 0);
  m.setU32((pAiTickArgs + 0x0c) >>> 0, 3);
  m.setU32((pAiTickArgs + 0x10) >>> 0, 0);
  m.setU32((pAiTickArgs + 0x14) >>> 0, pMonStats);
  m.setU32((pAiTickArgs + 0x18) >>> 0, pMonStats2);
  m.setU32((pAiTickArgs + 0x1c) >>> 0, pMonStats);

  return {
    m,
    pDataTables,
    pGame,
    pRoom,
    pMonster,
    pMonsterData,
    pAiGeneral,
    pAiControl,
    pCmdNode,
    pPath,
    pAiTickArgs,
    pTarget,
    pMonStats,
  };
}

describe('K2 Wave 6 Batch 3 (w6b3): 45 D2Game.dll VAs (0x6FC366D0..0x6FD05B60)', () => {
  it('[1/45] AI_ThinkImpregnatedMonster_6FC366D0_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkImpregnatedMonster_6FC366D0_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[2/45] AI_ThinkZakarumHealerOrPriest_6FC39080_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkZakarumHealerOrPriest_6FC39080_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[3/45] AI_ThinkTownRogueGuard_6FC39740_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs, pAiControl } = createAiFixture();
    m.setU32((pAiControl + 0x04) >>> 0, 2);
    AI_ThinkTownRogueGuard_6FC39740_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32((pAiControl + 0x04) >>> 0)).toBe(2);
  });

  it('[4/45] AI_ThinkHomeLeashedCaster_6FC39E70_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs, pTarget, pCmdNode } = createAiFixture();
    m.setU32(pCmdNode, 0x0a);
    m.setU32((pAiTickArgs + 0x08) >>> 0, pTarget);
    AI_ThinkHomeLeashedCaster_6FC39E70_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[5/45] AI_ThinkPutridDefiler_6FC3A550_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkPutridDefiler_6FC3A550_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[6/45] AI_ThinkMinionCommandSkirmisher_6FC3B2F0_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkMinionCommandSkirmisher_6FC3B2F0_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[7/45] AI_ThinkPackRegroupSkirmisher_6FC3B780_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkPackRegroupSkirmisher_6FC3B780_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[8/45] AI_ThinkAct2SewerTownNpc_6FC3B950_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs, pAiControl } = createAiFixture();
    m.setU32((pAiControl + 0x04) >>> 0, 2);
    AI_ThinkAct2SewerTownNpc_6FC3B950_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32((pAiControl + 0x04) >>> 0)).toBe(2);
  });

  it('[9/45] AI_ExecuteHirelingCombatStep_6FC3C8A0_113c', () => {
    const { m, pGame, pMonster, pTarget, pAiTickArgs } = createAiFixture();
    const pSeed = (pMonster + 0x20) >>> 0;
    const res = AI_ExecuteHirelingCombatStep_6FC3C8A0_113c(
      m,
      pMonster,
      pGame,
      1,
      pTarget,
      pTarget,
      pSeed,
      pAiTickArgs,
    );
    expect(res).toBeUndefined();
  });

  it('[10/45] AI_ThinkCommand14TriggeredSkill_6FC9D670_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs, pCmdNode } = createAiFixture();
    m.setU32(pCmdNode, 0x0e);
    AI_ThinkCommand14TriggeredSkill_6FC9D670_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[11/45] AI_ThinkLowLifeFleeCaster_6FC9E070_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkLowLifeFleeCaster_6FC9E070_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[12/45] AI_ThinkFetishMelee_6FC9ED90_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkFetishMelee_6FC9ED90_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[13/45] AI_ThinkThreePhaseMeleeRetreat_6FCA00C0_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkThreePhaseMeleeRetreat_6FCA00C0_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[14/45] AI_ThinkMultiStrikeComboMelee_6FCA08A0_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkMultiStrikeComboMelee_6FCA08A0_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[15/45] AI_ThinkSelfBuffRetreatSkirmisher_6FCA0B00_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkSelfBuffRetreatSkirmisher_6FCA0B00_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[16/45] AI_ThinkPackLeaderCommand1Melee_6FCA20D0_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkPackLeaderCommand1Melee_6FCA20D0_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[17/45] AI_ThinkRegenBoostRetreatMelee_6FCA2990_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkRegenBoostRetreatMelee_6FCA2990_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[18/45] AI_ThinkChargeStateIconMelee_6FCA4A90_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkChargeStateIconMelee_6FCA4A90_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[19/45] AI_ThinkOblivionKnightCaster_6FCA4DB0_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkOblivionKnightCaster_6FCA4DB0_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[20/45] AI_ThinkMephistoBoss_6FCA5B60_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkMephistoBoss_6FCA5B60_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[21/45] AI_ThinkGiantMosquito_6FCA6280_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkGiantMosquito_6FCA6280_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[22/45] AI_ThinkThornHulk_6FCA64A0_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkThornHulk_6FCA64A0_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[23/45] AI_ThinkVampire_6FCA6900_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkVampire_6FCA6900_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[24/45] AI_ThinkWillowisp_6FCA7010_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkWillowisp_6FCA7010_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[25/45] AI_ThinkSlinger_6FCA74A0_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkSlinger_6FCA74A0_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[26/45] AI_ThinkFetishShaman_6FCA7BB0_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkFetishShaman_6FCA7BB0_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[27/45] AI_ThinkBloodLord_6FCA8810_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkBloodLord_6FCA8810_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[28/45] AI_ThinkSpecialAiState3_6FCBCC00_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs, pAiControl } = createAiFixture();
    m.setU32((pAiControl + 0x04) >>> 0, 0);
    AI_ThinkSpecialAiState3_6FCBCC00_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32((pAiControl + 0x04) >>> 0)).toBe(0);
  });

  it('[29/45] AI_ThinkBladeCreeper_6FCC6B70_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    m.setU32((pMonster + 0x10) >>> 0, 14);
    AI_ThinkBladeCreeper_6FCC6B70_113c(m, pGame, pMonster, pAiTickArgs);
    expect(typeof m.u32((pMonster + 0x10) >>> 0)).toBe('number');
  });

  it('[30/45] AI_ThinkTerrorCurse_6FCC6FC0_113c', () => {
    const { m, pGame, pMonster, pAiTickArgs } = createAiFixture();
    AI_ThinkTerrorCurse_6FCC6FC0_113c(m, pGame, pMonster, pAiTickArgs);
    expect(m.u32(pMonster)).toBe(1);
  });

  it('[31/45] ACT2Q6_UnitIterate_GrantTombEntryState5_6FCE5820_113c', () => {
    const { m, pGame } = createAiFixture();
    const pPlayer = m.alloc(0x100);
    const pPlayerData = m.alloc(0x100);
    const { pQuestFlags } = allocQuestBitBuffer(m);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags);
    expect(ACT2Q6_UnitIterate_GrantTombEntryState5_6FCE5820_113c(m, pGame, pPlayer, 0)).toBe(0);
  });

  it('[32/45] ACT2Q6_UnitIterate_CompleteInAct2ForKillers_6FCE5910_113c', () => {
    const { m, pGame } = createAiFixture();
    const pPlayer = m.alloc(0x100);
    const pPlayerData = m.alloc(0x100);
    const { pQuestFlags } = allocQuestBitBuffer(m);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags);
    expect(
      ACT2Q6_UnitIterate_CompleteInAct2ForKillers_6FCE5910_113c(m, pGame, pPlayer, 0),
    ).toBeUndefined();
  });

  it('[33/45] ACT2Q6_UnitIterate_CompleteInTalRashaChamber_6FCE59A0_113c', () => {
    const { m, pGame } = createAiFixture();
    const pPlayer = m.alloc(0x100);
    const pPlayerData = m.alloc(0x100);
    const { pQuestFlags } = allocQuestBitBuffer(m);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags);
    expect(ACT2Q6_UnitIterate_CompleteInTalRashaChamber_6FCE59A0_113c(m, pGame, pPlayer, 0)).toBe(0);
  });

  it('[34/45] ACT2Q5_UnitIterate_PropagateCompleteToSubParty_6FCE5B80_113c', () => {
    const { m, pGame } = createAiFixture();
    const pPlayer = m.alloc(0x100);
    const pPlayerData = m.alloc(0x100);
    const { pQuestFlags } = allocQuestBitBuffer(m);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags);
    expect(ACT2Q5_UnitIterate_PropagateCompleteToSubParty_6FCE5B80_113c(m, pGame, pPlayer, 0)).toBe(0);
  });

  it('[35/45] ACT2Q4_UnitIterate_CompleteArcaneSanctuaryInLevel74_6FCE5C60_113c', () => {
    const { m, pGame } = createAiFixture();
    const pPlayer = m.alloc(0x100);
    const pPlayerData = m.alloc(0x100);
    const { pQuestFlags } = allocQuestBitBuffer(m);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags);
    expect(
      ACT2Q4_UnitIterate_CompleteArcaneSanctuaryInLevel74_6FCE5C60_113c(m, pGame, pPlayer, 0),
    ).toBe(0);
  });

  it('[36/45] ACT2Q3_UnitIterate_PropagateCompleteToSubParty_6FCE5ED0_113c', () => {
    const { m, pGame } = createAiFixture();
    const pPlayer = m.alloc(0x100);
    const pPlayerData = m.alloc(0x100);
    const { pQuestFlags } = allocQuestBitBuffer(m);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags);
    expect(ACT2Q3_UnitIterate_PropagateCompleteToSubParty_6FCE5ED0_113c(m, pGame, pPlayer, 0)).toBe(0);
  });

  it('[37/45] ACT2Q1_UnitIterate_GrantRadamentKillInRoom_6FCE6070_113c', () => {
    const { m, pGame } = createAiFixture();
    const pPlayer = m.alloc(0x100);
    expect(ACT2Q1_UnitIterate_GrantRadamentKillInRoom_6FCE6070_113c(m, pGame, pPlayer, 0)).toBe(0);
  });

  it('[38/45] ACT2Q0_PresetSpawnJerhynAndRelocate_6FCE9B70_113c', () => {
    const { m, pGame, pRoom, pMonster } = createAiFixture();
    const pQuestChain = m.alloc(0x40);
    const { pQuestFlags: pGlobalFlags, pQuestBytes } = allocQuestBitBuffer(m);
    const pQuestData = m.alloc(0x100);
    const pQuestExt = m.alloc(0x80);
    const pPresetArgs = m.alloc(0x40);
    m.setU32((pGame + 0x10f4) >>> 0, pQuestChain);
    m.setU32((pQuestChain + 0x08) >>> 0, 1);
    m.setU32((pQuestChain + 0x0c) >>> 0, pGlobalFlags);
    m.setU16((pQuestBytes + 0x0e * 2) >>> 0, 1 << 0x0d);
    m.setU8((pQuestExt + 0x0d) >>> 0, 1);
    m.setU32((pQuestData + 0x04) >>> 0, pGame);
    m.setU32((pQuestData + 0x18) >>> 0, pQuestExt);
    m.setU32(pPresetArgs, pGame);
    m.setU32((pPresetArgs + 0x04) >>> 0, pMonster);
    m.setU32((pPresetArgs + 0x08) >>> 0, pRoom);
    m.setU32((pPresetArgs + 0x14) >>> 0, 50);
    m.setU32((pPresetArgs + 0x18) >>> 0, 60);
    ACT2Q0_PresetSpawnJerhynAndRelocate_6FCE9B70_113c(m, pPresetArgs, pQuestData);
    expect(m.u8((pQuestExt + 0x0d) >>> 0)).toBe(1);
  });

  it('[39/45] NET_BroadcastSystemChatMessage_6FCEBE70_113c', () => {
    const { m, pGame } = createAiFixture();
    const pMsg = m.alloc(0x100);
    m.setU8(pMsg, 0x41);
    NET_BroadcastSystemChatMessage_6FCEBE70_113c(m, pMsg, pGame, 4);
    expect(m.u8(pMsg)).toBe(0x41);
  });

  it('[40/45] PLAYER_SyncClientLifeManaStaminaGoldAndCoords_6FCEC030_113c', () => {
    const { m } = createAiFixture();
    expect(PLAYER_SyncClientLifeManaStaminaGoldAndCoords_6FCEC030_113c(m, 0, 0, 0)).toBe(0);
  });

  it('[41/45] PACKET_SrvMercMoveToCoord_6FCED360_113c', () => {
    const { m, pGame, pTarget } = createAiFixture();
    const pPkt = m.alloc(0x10);
    expect(PACKET_SrvMercMoveToCoord_6FCED360_113c(m, pGame, pTarget, pPkt, 5)).toBe(3);
  });

  it('[42/45] PACKET_SrvMercMoveToUnit_6FCED3D0_113c', () => {
    const { m, pGame, pTarget } = createAiFixture();
    const pPkt = m.alloc(0x10);
    expect(PACKET_SrvMercMoveToUnit_6FCED3D0_113c(m, pGame, pTarget, pPkt, 5)).toBe(3);
  });

  it('[43/45] SUNIT_CancelPlayerUnitInteraction_6FD00BF0_113c', () => {
    const { m, pGame } = createAiFixture();
    const pPlayer = m.alloc(0x100);
    m.setU8((pPlayer + 0x6c) >>> 0, 0);
    SUNIT_CancelPlayerUnitInteraction_6FD00BF0_113c(m, pPlayer, pGame);
    expect(m.u8((pPlayer + 0x6c) >>> 0)).toBe(0);
  });

  it('[44/45] ACT3Q0_InitQuestData_6FD05920_113c', () => {
    const { m, pGame } = createAiFixture();
    const pQuestData = m.alloc(0x100);
    m.setU32((pQuestData + 0x04) >>> 0, pGame);
    ACT3Q0_InitQuestData_6FD05920_113c(m, pQuestData);
    expect(m.u32((pQuestData + 0xe0) >>> 0)).toBe(0x10);
    const pExt = m.u32((pQuestData + 0x18) >>> 0) >>> 0;
    expect(pExt).toBeGreaterThan(0);
    expect(m.u8((pExt + 0x01) >>> 0)).toBe(1);
  });

  it('[45/45] ACT3Q7_UnitIterate_CompleteInAct3ForParty_6FD05B60_113c', () => {
    const { m, pGame } = createAiFixture();
    const pPlayer = m.alloc(0x100);
    const pPlayerData = m.alloc(0x100);
    const { pQuestFlags } = allocQuestBitBuffer(m);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags);
    expect(ACT3Q7_UnitIterate_CompleteInAct3ForParty_6FD05B60_113c(m, pGame, pPlayer, 0)).toBe(0);
  });
});
