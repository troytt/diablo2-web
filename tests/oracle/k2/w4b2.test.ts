import { describe, expect, it } from 'vitest';
import { D2COMMON_SGPT_DATATABLES_VA_113C } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import {
  ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c,
  ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c,
  ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c,
  ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c,
  ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c,
  ACT5Q0_InitQuest2ADescriptor_6FC7A7C0_113c,
  ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c,
  ACT5Q1_SpawnShenkAndAttachQuestData_6FC7C3A0_113c,
  ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c,
  ACT5Q2_SpawnMonster209NearUnitOffsetMinus5_6FC7C1F0_113c,
  ACT5Q3_ApplyScrollOfResistanceAcrossDifficulties_6FC7B0B0_113c,
  ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c,
  ACT5Q3_FindQuest21AndThawFrozenAnya_6FC7DEF0_113c,
  ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c,
  ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c,
  ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c,
  ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c,
  ACT5Q6_CallbackSendPacket50Quest24_6FC799D0_113c,
  ACT5Q6_CheckLevel84AndCompleteQuest28_6FC799E0_113c,
  ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c,
  ACT5Q6_SpawnDestructionsEndPortalObject_6FC7D760_113c,
  CLIENTS_AppendSaveDataChunk_6FC6A190_113c,
  CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c,
  MISSILE_SrvDmg_ApplyTargetDmgAndAuraSubMissiles_6FC5DB30_113c,
  MISSILE_SrvDmg_HealOwnerFromElemDamage_6FC5A920_113c,
  MISSILE_SrvDmg_SpawnAuraSubMissilesStrictCount_6FC5DD60_113c,
  MISSILE_SrvDmg_SpawnRadial8SubMissiles_6FC5DA60_113c,
  MISSILE_SrvDmg_SpawnRing16SubMissiles_6FC5D800_113c,
  MISSILE_SrvDmg_SpawnRing16WithOuterStepAndVel_6FC5E330_113c,
  MISSILE_SrvDo_GuidedWithPathFlag08SubMissile_6FC61DE0_113c,
  MISSILE_SrvDo_LinearWithParamScaledSubMissileMask05_6FC61670_113c,
  MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask05_6FC613D0_113c,
  MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask45_6FC604D0_113c,
  MISSILE_SrvDo_LinearWithTrailingCalc80SubMissile_6FC61B80_113c,
  MISSILE_SrvDo_StoppedRandomSlotSubMissile_6FC61C30_113c,
  MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c,
  MISSILES_ConvertPhysToElemByCalc90_6FC5A850_113c,
  MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c,
  PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0_113c,
  PLAYER_FreePlayerDataQuestAndList98_6FC576B0_113c,
  PLAYERSAVE_WriteInventoryOrCachedSaveBuffer_6FC73B40_113c,
  QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c,
  SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c,
  SKILLS_SrvDo_ApplyRadiusAuraStatList_6FC6C2A0_113c,
  SKILLS_SrvDo_CorpseRing16SubMissiles_6FC70190_113c,
} from '../../../src/d2kern-113c/game/k2-w4b2-113c.ts';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

function setupTables(m: SparseMemory113c): number {
  const pTables = m.alloc(0x1000);
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pTables);
  m.setU32(0x6fd1829c, D2COMMON_SGPT_DATATABLES_VA_113C);
  return pTables;
}

describe('K2 Wave 4 Batch 2 (w4b2): D2Game 0x6FC561E0..0x6FC82C00', () => {
  it('ports [1..5] QUESTS_SpawnQuestMonsterWithRetryRings, PLAYER quest buffers, and MISSILES damage helpers', () => {
    const m = new SparseMemory113c();
    const pTables = setupTables(m);

    // [1/45] 0x6FC561E0: returns 0 when pRoom == 0 and nMonsterId < 0
    expect(QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c(m, 0, 10, 10, 0, 0, -1)).toBe(0);

    // [3/45] 0x6FC576F0 & [2/45] 0x6FC576B0: alloc and free player quest bit buffers
    const pGame = m.alloc(0x100);
    const pPlayer = m.alloc(0x100);
    const pPlayerData = m.alloc(0x100);
    m.setU32(pPlayer, 0);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    PLAYER_AllocPlayerDataQuestBitBuffers_6FC576F0_113c(m, pPlayer, pGame);
    expect(m.u32((pPlayerData + 0x60) >>> 0)).not.toBe(0);
    expect(m.u32((pPlayerData + 0x64) >>> 0)).not.toBe(0);
    expect(m.u32((pPlayerData + 0x68) >>> 0)).not.toBe(0);
    PLAYER_FreePlayerDataQuestAndList98_6FC576B0_113c(m, pPlayer, pGame);
    expect(m.u32((pPlayerData + 0x60) >>> 0)).toBe(0);
    expect(m.u32((pPlayerData + 0x64) >>> 0)).toBe(0);
    expect(m.u32((pPlayerData + 0x68) >>> 0)).toBe(0);

    // [4/45] 0x6FC5A790: MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c
    const pMissilesTxt = m.alloc(0x400);
    m.setU32((pTables + 0xb64) >>> 0, pMissilesTxt);
    m.setU32((pTables + 0xb6c) >>> 0, 2);
    const pMissile = m.alloc(0x100);
    m.setU32(pMissile, 3);
    m.setU32((pMissile + 4) >>> 0, 1);
    const pTarget = m.alloc(0x100);
    m.setU32(pTarget, 0);
    const pDmg = m.alloc(0x80);
    m.setU32((pDmg + 0x10) >>> 0, 200);
    MISSILES_ApplyDemonUndeadElemBonus_6FC5A790_113c(m, pGame, pMissile, pTarget, pDmg);
    expect(m.u32((pDmg + 0x10) >>> 0)).toBe(200);

    // [5/45] 0x6FC5A850: MISSILES_ConvertPhysToElemByCalc90_6FC5A850_113c
    m.setU32((pDmg + 0x08) >>> 0, 100);
    MISSILES_ConvertPhysToElemByCalc90_6FC5A850_113c(m, pGame, pMissile, pTarget, pDmg);
    expect(m.u32((pDmg + 0x08) >>> 0)).toBe(100);
  });

  it('ports [6..15] MISSILE_SrvDmg and MISSILE_SrvDo handlers', () => {
    const m = new SparseMemory113c();
    const pTables = setupTables(m);
    const pMissilesTxt = m.alloc(0x400);
    m.setU32((pTables + 0xb64) >>> 0, pMissilesTxt);
    m.setU32((pTables + 0xb6c) >>> 0, 2);

    const pGame = m.alloc(0x2000);
    const pMissile = m.alloc(0x100);
    m.setU32(pMissile, 3);
    m.setU32((pMissile + 4) >>> 0, 99);
    const pTarget = m.alloc(0x100);

    expect(MISSILE_SrvDmg_HealOwnerFromElemDamage_6FC5A920_113c(m, pGame, pMissile, pTarget)).toBe(1);
    expect(MISSILE_SrvDmg_SpawnRing16SubMissiles_6FC5D800_113c(m, pGame, pMissile, pTarget)).toBe(1);
    expect(MISSILE_SrvDmg_SpawnRadial8SubMissiles_6FC5DA60_113c(m, pGame, pMissile, pTarget)).toBe(1);
    expect(MISSILE_SrvDmg_ApplyTargetDmgAndAuraSubMissiles_6FC5DB30_113c(m, pGame, 0, pTarget)).toBe(1);
    expect(MISSILE_SrvDmg_SpawnAuraSubMissilesStrictCount_6FC5DD60_113c(m, pGame, 0, pTarget)).toBe(1);
    expect(MISSILE_SrvDmg_SpawnRing16WithOuterStepAndVel_6FC5E330_113c(m, pGame, pMissile, pTarget)).toBe(3);
    expect(MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask45_6FC604D0_113c(m, pGame, 0)).toBe(2);
    expect(MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask05_6FC613D0_113c(m, pGame, 0)).toBe(2);
    expect(MISSILE_SrvDo_LinearWithParamScaledSubMissileMask05_6FC61670_113c(m, pGame, 0)).toBe(2);
    expect(MISSILE_SrvDo_LinearWithTrailingCalc80SubMissile_6FC61B80_113c(m, pGame, 0)).toBe(2);
  });

  it('ports [16..25] MISSILE_SrvDo, SKILLS, MONSTER merc packet, CLIENTS, PLAYERSAVE, and ACT5Q6 alert', () => {
    const m = new SparseMemory113c();
    const pTables = setupTables(m);
    const pMissilesTxt = m.alloc(0x400);
    m.setU32((pTables + 0xb64) >>> 0, pMissilesTxt);
    m.setU32((pTables + 0xb6c) >>> 0, 2);

    const pGame = m.alloc(0x2000);
    expect(MISSILE_SrvDo_StoppedRandomSlotSubMissile_6FC61C30_113c(m, pGame, 0)).toBe(2);
    expect(MISSILE_SrvDo_GuidedWithPathFlag08SubMissile_6FC61DE0_113c(m, pGame, 0)).toBe(2);
    expect(SKILLS_ApplySecondaryAuraAndSpawnChargedMissile_6FC663A0_113c(m, pGame, 0, 10, -1, 1, 0)).toBe(0);

    // [19/45] 0x6FC68950
    const pPlayer = m.alloc(0x100);
    m.setU32(pPlayer, 0);
    MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c(m, pPlayer, pGame);

    // [20/45] 0x6FC6A190
    m.setU32(0x6fd31c18, 1);
    const pClient = m.alloc(0x500);
    m.setU32(pClient, 7);
    m.setU32((0x6fd307b8 + (7 << 2)) >>> 0, pClient);
    const pChunk = m.alloc(8);
    m.setU8(pChunk, 0x4a);
    m.setU8((pChunk + 1) >>> 0, 0x4d);
    expect(CLIENTS_AppendSaveDataChunk_6FC6A190_113c(m, 7, pChunk, 2, 4, 0x11)).toBe(0);
    expect(m.u32((pClient + 0x180) >>> 0)).toBe(2);
    const pSaveBuf = m.u32((pClient + 0x17c) >>> 0);
    expect(m.u8(pSaveBuf)).toBe(0x4a);
    expect(m.u8((pSaveBuf + 1) >>> 0)).toBe(0x4d);

    // [21/45] 0x6FC6AD80
    const pRoom = m.alloc(0x100);
    const ppRooms = m.alloc(8);
    m.setU32(ppRooms, pRoom);
    m.setU32((pRoom + 0x00) >>> 0, ppRooms);
    m.setU32((pRoom + 0x04) >>> 0, 1);
    m.setU32((pClient + 0x1b4) >>> 0, pRoom);
    CLIENTS_CollectAndRecordNearbyPlayerPositions_6FC6AD80_113c(m, pClient, 8);

    // [22/45] 0x6FC6C2A0 & [23/45] 0x6FC70190
    expect(SKILLS_SrvDo_ApplyRadiusAuraStatList_6FC6C2A0_113c(m, pGame, pPlayer, -1, 1)).toBe(0);
    expect(SKILLS_SrvDo_CorpseRing16SubMissiles_6FC70190_113c(m, pGame, pPlayer, 0, 1)).toBe(0);

    // [24/45] 0x6FC73B40: cached save buffer copy path
    const pPlayerData = m.alloc(0x100);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    const pCached = m.alloc(0x10);
    const pCachedSrc = m.alloc(4);
    m.setU32(pCachedSrc, 0xdeadbeef);
    m.setU32(pCached, 4);
    m.setU32((pCached + 4) >>> 0, pCachedSrc);
    m.setU32((pPlayerData + 0x5c) >>> 0, pCached);
    const pDstBuf = m.alloc(8);
    expect(
      PLAYERSAVE_WriteInventoryOrCachedSaveBuffer_6FC73B40_113c(m, pPlayer, 0, pDstBuf, 8, 1, 0, 0),
    ).toBe(4);
    expect(m.u32(pDstBuf)).toBe(0xdeadbeef);

    // [25/45] 0x6FC78D40
    const pFlags = m.alloc(0x80);
    m.setU32(pFlags, m.alloc(0x80));
    m.setU32((pPlayerData + 0x10) >>> 0, pFlags);
    expect(ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c(m, pGame, pPlayer)).toBe(0);
  });
  it('ports [26..35] ACT5 quest alerts, ACT5Q0 descriptor init, Scroll of Resistance, and ACT5Q2/Q1 monster spawns', () => {
    const m = new SparseMemory113c();
    setupTables(m);

    const pGame = m.alloc(0x2000);
    const pPlayer = m.alloc(0x100);
    const pPlayerData = m.alloc(0x100);
    const pPath = m.alloc(0x80);
    m.setU32(pPlayer, 0);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    m.setU32((pPlayer + 0x2c) >>> 0, pPath);
    const pFlags = m.alloc(0x80);
    m.setU32(pFlags, m.alloc(0x80));
    m.setU32((pPlayerData + 0x10) >>> 0, pFlags);
    m.setU32((pPlayerData + 0x14) >>> 0, pFlags);
    m.setU32((pPlayerData + 0x18) >>> 0, pFlags);

    const pQuestControl = m.alloc(0x40);
    const pQuest24 = m.alloc(0x100);
    const pQuest24Data = m.alloc(0x100);
    m.setU32(pQuest24, 0x24);
    m.setU32((pQuest24 + 0x18) >>> 0, pQuest24Data);
    m.setU32(pQuestControl, pQuest24);
    m.setU32((pGame + 0x10f4) >>> 0, pQuestControl);

    // [26..32/45] 0x6FC78F90..0x6FC799E0
    expect(ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c(m, pGame, pPlayer)).toBe(0);
    expect(ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c(m, pGame, pPlayer)).toBe(0);
    expect(ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c(m, pGame, pPlayer)).toBe(0);
    expect(ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c(m, pGame, pPlayer)).toBe(0);
    expect(ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c(m, pGame, pPlayer)).toBe(0);
    expect(ACT5Q6_CallbackSendPacket50Quest24_6FC799D0_113c(m, pGame, pPlayer)).toBe(0);
    expect(ACT5Q6_CheckLevel84AndCompleteQuest28_6FC799E0_113c(m, pGame, pPlayer)).toBe(0);

    // [33/45] 0x6FC7A7C0
    const pQuest = m.alloc(0x100);
    ACT5Q0_InitQuest2ADescriptor_6FC7A7C0_113c(m, pQuest);
    expect(m.u32((pQuest + 0xa0) >>> 0)).toBe(0x6fc796b0);
    expect(m.u32((pQuest + 0xcc) >>> 0)).toBe(0x6fc797b0);
    expect(m.u32((pQuest + 0xdc) >>> 0)).toBe(0x6fd2a9a8);
    expect(m.u8((pQuest + 0x0a) >>> 0)).toBe(1);
    expect(m.u32((pQuest + 0xe0) >>> 0)).toBe(0x2a);
    expect(m.u32((pQuest + 0xe8) >>> 0)).toBe(0x6fc76ea0);
    expect(m.u32((pQuest + 0xec) >>> 0)).toBe(0x6fc79680);

    // [34/45] 0x6FC7B0B0 & [35/45] 0x6FC7C1F0
    ACT5Q3_ApplyScrollOfResistanceAcrossDifficulties_6FC7B0B0_113c(m, pPlayer, pGame);
    ACT5Q2_SpawnMonster209NearUnitOffsetMinus5_6FC7C1F0_113c(m, pPlayer, pGame, 0);
  });

  it('ports [36..45] ACT5Q1 Shenk, ACT5Q6 portal, ACT5Q3 Anya, ACT5Q5 Ancients reset, and ACT1 quest alerts', () => {
    const m = new SparseMemory113c();
    setupTables(m);

    const pGame = m.alloc(0x2000);
    const pPlayer = m.alloc(0x100);
    const pPlayerData = m.alloc(0x100);
    m.setU32(pPlayer, 0);
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
    const pFlags = m.alloc(0x80);
    m.setU32(pFlags, m.alloc(0x80));
    m.setU32((pPlayerData + 0x10) >>> 0, pFlags);

    // [36/45] 0x6FC7C3A0
    const pOp = m.alloc(0x40);
    m.setU32(pOp, pGame);
    ACT5Q1_SpawnShenkAndAttachQuestData_6FC7C3A0_113c(m, pOp);

    // [37/45] 0x6FC7D760
    expect(ACT5Q6_SpawnDestructionsEndPortalObject_6FC7D760_113c(m, pGame, pPlayer)).toBe(0);

    // [38/45] 0x6FC7DEF0
    ACT5Q3_FindQuest21AndThawFrozenAnya_6FC7DEF0_113c(m, pGame);

    // [39/45] 0x6FC7E0E0
    const pQuest = m.alloc(0x100);
    const pQuestData = m.alloc(0x140);
    m.setU32((pQuest + 0x04) >>> 0, pGame);
    m.setU32((pQuest + 0x18) >>> 0, pQuestData);
    m.setU8((pQuestData + 0x48) >>> 0, 1);
    m.setU32((pQuestData + 0x4c) >>> 0, 7);
    ACT5Q5_ResetAncientsToStatuesAndAltar_6FC7E0E0_113c(m, pGame, pQuest, pQuestData);
    expect(m.u8((pQuestData + 0x48) >>> 0)).toBe(0);
    expect(m.u32((pQuestData + 0x4c) >>> 0)).toBe(0);

    // [40/45] 0x6FC7EC30
    ACT5Q3_CleanupFrozenAnyaAndTownNpcState_6FC7EC30_113c(m, pQuest);
    expect(m.u32((pQuestData + 0x88) >>> 0)).toBe(1);

    // [41..45/45] 0x6FC82700..0x6FC82C00
    expect(ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c(m, pGame, pPlayer)).toBe(0);
    expect(ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c(m, pGame, pPlayer)).toBe(0);
    expect(ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c(m, pGame, pPlayer)).toBe(0);
    expect(ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c(m, pGame, pPlayer)).toBe(0);
    expect(ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c(m, pGame, pPlayer)).toBe(0);
  });
});
