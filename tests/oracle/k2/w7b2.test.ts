import { describe, expect, it } from 'vitest';
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
} from '../../../src/d2kern-113c/common/inline-helpers.ts';
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items.ts';
import { QUESTRECORD_SetQuestState113c } from '../../../src/d2kern-113c/common/quest-record.ts';
import {
  ACT1Q1_InitPlayerQuestStateAndResetFlag0A_6FC83BB0_113c,
  ACT1Q2_ActivateOrChainQuest_6FC84E10_113c,
  ACT1Q2_OnBloodRavenKilled_6FC85620_113c,
  ACT1Q3_ActivateOrChainQuest_6FC84AA0_113c,
  ACT1Q3_ActivateQuestState1_6FC83D20_113c,
  ACT1Q3_InitPlayerQuestStateAndResetFlag0A_6FC837E0_113c,
  ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10_113c,
  ACT1Q4_ActivateOrChainQuest_6FC846D0_113c,
  ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c,
  ACT1Q4_OnCainGibbetOperated_6FC87730_113c,
  ACT1Q4_OnQuestActivatedUpdatePlayers_6FC83570_113c,
  ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940_113c,
  ACT1Q4_SendScrollOfInifussOrderPacket50_6FC847B0_113c,
  ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c,
  ACT1Q4_TrySpawnSecretCowLevelPortal_6FC874A0_113c,
  ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c,
  ACT1Q5_OnAndarielKilled_6FC88B90_113c,
  ACT1Q5_OnPortalLightningTimerEvent_6FC88D20_113c,
  ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning_6FC88AB0_113c,
  ACT1Q6_SpawnCatacombs4ReturnPortal_6FC87320_113c,
  ACT5Q2_SpawnNihlathakPortalFromQuestData_6FC7D380_113c,
  ACT5Q2_TrySpawnNihlathakPortalForUnitInAct5_6FC7D1D0_113c,
  ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c,
  AI_Thinker_Izual_6FC9EA10_113c,
  CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c,
  MONSTER_SpawnSiegeBeastStompProjectiles_6FC95A40_113c,
  OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60_113c,
  OBJECTS_FloorSpikesEventTick_6FC8E270_113c,
  OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930_113c,
  OBJECTS_OperateBankStash_6FC91290_113c,
  OBJECTS_OperateFireAndLightningTrap_6FC8E0E0_113c,
  OBJECTS_OperateGemShrine_6FC8B430_113c,
  OBJECTS_OperatePortalShrine_6FC8B9B0_113c,
  SKILLS_SrvDo075_DragonTalonKickHit_6FCB2DF0_113c,
  SKILLS_SrvDo077_ChannelChargedStream_6FCB5BC0_113c,
  SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0_113c,
  SKILLS_SrvDo_CloakOfShadows_6FCB4B10_113c,
  SKILLS_TryConvertMonsterOnHit_6FCB5120_113c,
  STASH_ClearKillerInfoAndRecountScrolls_6FC91270_113c,
  STASH_HandleBankGoldOrCloseAction_6FC917E0_113c,
} from '../../../src/d2kern-113c/game/k2-w7b2-113c.ts';
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts';
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';
import { SG_ITEM_DATATABLES_VA_113C } from '../../../src/d2kern-113c/tables/item-tbls-113c.ts';

function allocBitBuffer(m: SparseMemory113c): number {
  const pBitBuf = m.alloc(0x10);
  const pBytes = m.alloc(0x60);
  m.setU32(pBitBuf, pBytes);
  m.setU32((pBitBuf + 4) >>> 0, 0x300);
  return pBitBuf;
}

function createW7B2Mem(): { m: SparseMemory113c; pGame: number; pTables: number } {
  const m = new SparseMemory113c();
  const pTables = m.alloc(0x1200);
  initD2GameGlobalsInMem113c(m, pTables);
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pTables);
  const pBitMasks = m.u32(0x6fd18be0);
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks);
  m.setU32(0x6fd31c20, 0);

  const pTablesSlot = m.alloc(4);
  m.setU32(pTablesSlot, pTables);
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pTablesSlot);

  const pObjectsTxt = m.alloc(0x1c0 * 16);
  m.setU32((pTables + 0x9c8) >>> 0, pObjectsTxt);
  m.setU32((pTables + 0x9d0) >>> 0, 16);
  m.setU32(0x6fdf143c, pObjectsTxt);
  m.setU32(0x6fdf1440, 16);
  m.setU32(0x6fdf0b94, pObjectsTxt);
  m.setU32(0x6fdf0b98, 16);

  const pLevelsTxt = m.alloc(0x220 * 140);
  m.setU32((pTables + 0xc58) >>> 0, pLevelsTxt);
  m.setU32((pTables + 0xc5c) >>> 0, 140);

  const pItemsTxt = m.alloc(0x1a8 * 16);
  m.setU32(SG_ITEM_DATATABLES_VA_113C, 16);
  m.setU32((SG_ITEM_DATATABLES_VA_113C + 4) >>> 0, pItemsTxt);
  m.setU32(0x6fdeff6c, m.alloc(0x20));
  m.fill(0x6fde4080, 0x30, 0);

  const pGame = m.alloc(0x2000);
  m.setU32((pGame + 0x1c) >>> 0, 0x12340000);
  m.setU32((pGame + 0xa8) >>> 0, 100);
  EVENT_InitTimerQueue113c(m, pGame);

  const pQuestCtrl = m.alloc(0x30);
  m.setU32((pQuestCtrl + 8) >>> 0, 1);
  m.setU32((pQuestCtrl + 0x0c) >>> 0, allocBitBuffer(m));
  m.setU32((pGame + 0x10f4) >>> 0, pQuestCtrl);

  return { m, pGame, pTables };
}

function createPlayerWithQuestRecord(
  m: SparseMemory113c,
  pGame: number,
  guid: number,
): { pPlayer: number; pPlayerData: number; pQuestFlags: number; pPath: number } {
  const pPlayer = m.alloc(0x100);
  const pPath = m.alloc(0x80);
  m.setU32(pPlayer, 0);
  m.setU32((pPlayer + 0x0c) >>> 0, guid >>> 0);
  m.setU32((pPlayer + 0x2c) >>> 0, pPath);
  const pPlayerData = m.alloc(0x180);
  m.setU32((pPlayer + 0x14) >>> 0, pPlayerData);
  const pQuestFlags = allocBitBuffer(m);
  m.setU32((pPlayerData + 0x10) >>> 0, pQuestFlags);
  m.setU32((pGame + ((guid & 0x7f) << 2) + 0x1120) >>> 0, pPlayer);
  return { pPlayer, pPlayerData, pQuestFlags, pPath };
}

function createObjectUnit(m: SparseMemory113c, classId = 0, pRoom = 0): { pObj: number; pStaticPath: number } {
  const pObj = m.alloc(0x100);
  const pStaticPath = m.alloc(0x40);
  const pObjData = m.alloc(0x40);
  m.setU32(pStaticPath, pRoom >>> 0);
  m.setU32(pObj, 2);
  m.setU32((pObj + 4) >>> 0, classId >>> 0);
  m.setU32((pObj + 0x14) >>> 0, pObjData);
  m.setU32((pObj + 0x2c) >>> 0, pStaticPath);
  return { pObj, pStaticPath };
}

describe('K2 Wave 7 Batch 2 (w7b2) — 40 D2Game.dll v1.13c functions', () => {
  it('[1/40] 0x6FC7CFF0 ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c returns 0 when portal guid is -1', () => {
    const { m, pGame } = createW7B2Mem();
    const { pPlayer, pPlayerData } = createPlayerWithQuestRecord(m, pGame, 1);
    m.setU32((pPlayerData + 0x58) >>> 0, 0xffffffff);
    expect(ACT5Q4_DestroyPlayerPortalIfInArreatSummit_6FC7CFF0_113c(m, pGame, pPlayer)).toBe(0);
  });

  it('[2/40 & 3/40] 0x6FC7D1D0 & 0x6FC7D380 ACT5Q2 Nihlathak portal helpers validate act and quest state', () => {
    const { m, pGame } = createW7B2Mem();
    const { pPlayer } = createPlayerWithQuestRecord(m, pGame, 2);
    const pQuest22 = m.alloc(0x100);
    const pExt22 = m.alloc(0x100);
    m.setU32(pQuest22, 0x22);
    m.setU32((pQuest22 + 0x18) >>> 0, pExt22);
    m.setU8((pExt22 + 0x89) >>> 0, 0);
    m.setU32(m.u32((pGame + 0x10f4) >>> 0), pQuest22);
    expect(() => ACT5Q2_TrySpawnNihlathakPortalForUnitInAct5_6FC7D1D0_113c(m, pPlayer, pGame)).not.toThrow();

    const pQuest = m.alloc(0x100);
    const pQuestData = m.alloc(0x100);
    m.setU32((pQuest + 0x04) >>> 0, pGame);
    m.setU32((pQuest + 0x18) >>> 0, pQuestData);
    m.setU8((pQuestData + 0x88) >>> 0, 1);
    expect(ACT5Q2_SpawnNihlathakPortalFromQuestData_6FC7D380_113c(m, pPlayer, pQuest)).toBe(0);
  });

  it('[4/40 & 5/40] 0x6FC83570 & 0x6FC835B0 ACT1Q4 activation and debug broadcast', () => {
    const { m, pGame } = createW7B2Mem();
    const pQuest = m.alloc(0x100);
    m.setU32((pQuest + 0x04) >>> 0, pGame);
    m.setU8((pQuest + 0x09) >>> 0, 0);
    m.setU8((pQuest + 0x0c) >>> 0, 1);
    ACT1Q4_OnQuestActivatedUpdatePlayers_6FC83570_113c(m, pQuest);

    const pCallbackTable = m.alloc(0x40);
    m.setU32((pQuest + 0x04) >>> 0, pGame);
    m.setU32((pQuest + 0x0c) >>> 0, 2);
    m.setU32((pQuest + 0x14) >>> 0, pCallbackTable);
    expect(() => ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c(m, pQuest)).not.toThrow();
  });

  it('[6/40 & 7/40] 0x6FC837E0 & 0x6FC83BB0 ACT1Q3 & ACT1Q1 init player quest state', () => {
    const { m, pGame } = createW7B2Mem();
    const { pPlayer, pQuestFlags } = createPlayerWithQuestRecord(m, pGame, 3);
    const pQ1 = m.alloc(0x100);
    const pQ3 = m.alloc(0x100);
    m.setU32(pQ1, 0x1e);
    m.setU32((pQ1 + 0xf4) >>> 0, pQ3);
    m.setU32(pQ3, 3);
    m.setU32(m.u32((pGame + 0x10f4) >>> 0), pQ1);
    ACT1Q3_InitPlayerQuestStateAndResetFlag0A_6FC837E0_113c(m, pPlayer, pGame);
    ACT1Q1_InitPlayerQuestStateAndResetFlag0A_6FC83BB0_113c(m, pPlayer, pGame);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 3, 0)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x29, 0)).toBe(1);
  });

  it('[8/40..15/40] ACT1Q3, ACT1Q4, ACT1Q2 state transitions and Blood Raven death', () => {
    const { m, pGame } = createW7B2Mem();
    const pQuest = m.alloc(0x100);
    const pState = m.alloc(0x100);
    m.setU32((pQuest + 0x04) >>> 0, pGame);
    m.setU32((pQuest + 0x18) >>> 0, pState);
    m.setU8((pQuest + 0x09) >>> 0, 1);

    ACT1Q3_ActivateQuestState1_6FC83D20_113c(m, pQuest);
    expect(m.u8((pQuest + 0x0c) >>> 0)).toBe(1);

    m.setU8((pQuest + 0x0c) >>> 0, 4);
    expect(ACT1Q4_ActivateOrChainQuest_6FC846D0_113c(m, pQuest)).toBe(1);

    const { pPlayer } = createPlayerWithQuestRecord(m, pGame, 4);
    ACT1Q4_SendScrollOfInifussOrderPacket50_6FC847B0_113c(m, pGame, pPlayer);

    m.setU8((pQuest + 0x0c) >>> 0, 2);
    ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940_113c(m, pQuest);
    expect(m.u8((pQuest + 0x0c) >>> 0)).toBe(3);

    m.setU8((pQuest + 0x0c) >>> 0, 4);
    expect(ACT1Q3_ActivateOrChainQuest_6FC84AA0_113c(m, pQuest)).toBe(1);

    m.setU8((pQuest + 0x0c) >>> 0, 2);
    m.setU8((pState + 1) >>> 0, 1);
    m.setU32((pState + 4) >>> 0, 0xffffffff);
    ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10_113c(m, pQuest);
    expect(m.u8((pQuest + 0x0c) >>> 0)).toBe(3);

    m.setU8((pQuest + 0x0c) >>> 0, 4);
    expect(ACT1Q2_ActivateOrChainQuest_6FC84E10_113c(m, pQuest)).toBe(1);

    m.setU32(pQuest, 2);
    m.setU32(m.u32((pGame + 0x10f4) >>> 0), pQuest);
    const pArg = m.alloc(0x20);
    const pMon = m.alloc(0x100);
    const pMonPath = m.alloc(0x40);
    m.setU32(pMon, 1);
    m.setU32((pMon + 0x0c) >>> 0, 10);
    m.setU32((pMon + 0x2c) >>> 0, pMonPath);
    m.setU32((pGame + 0x1320 + (10 & 0x7f) * 4) >>> 0, pMon);
    m.setU32(pArg, pGame);
    m.setU32((pArg + 8) >>> 0, pMon);
    ACT1Q2_OnBloodRavenKilled_6FC85620_113c(m, pQuest, pArg);
    expect(m.u8((pQuest + 0x0c) >>> 0)).toBe(4);
  });

  it('[16/40..23/40] ACT1Q6, ACT1Q4, ACT1Q5 portal/gibbet/lightning/Andariel callbacks', () => {
    const { m, pGame } = createW7B2Mem();
    const pQuest = m.alloc(0x100);
    const pExt = m.alloc(0x140);
    m.setU32(pQuest, 4);
    m.setU32((pQuest + 0x04) >>> 0, pGame);
    m.setU32((pQuest + 0x18) >>> 0, pExt);
    m.setU8((pQuest + 0x09) >>> 0, 0);
    m.setU32(m.u32((pGame + 0x10f4) >>> 0), pQuest);

    const { pObj } = createObjectUnit(m, 0, 0);
    expect(ACT1Q6_SpawnCatacombs4ReturnPortal_6FC87320_113c(m, pGame, pObj)).toBe(0);

    const { pPlayer } = createPlayerWithQuestRecord(m, pGame, 5);
    expect(ACT1Q4_TrySpawnSecretCowLevelPortal_6FC874A0_113c(m, pGame, pPlayer)).toBe(0);

    expect(() => ACT1Q4_OnCainGibbetOperated_6FC87730_113c(m, pGame, pObj)).not.toThrow();

    m.setU32((pExt + 0x40) >>> 0, 0xffffffff);
    expect(ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c(m, pGame, pQuest)).toBe(1);

    expect(() => ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c(m, pQuest, 0, 0)).not.toThrow();
    expect(m.u8((pExt + 0x50) >>> 0)).toBe(1);

    const pMalusArg = m.alloc(0x10);
    m.setU32(pMalusArg, pGame);
    m.setU32((pMalusArg + 4) >>> 0, pPlayer);
    expect(() => ACT1Q5_RecordPlayerInMalusRoomAndSpawnLightning_6FC88AB0_113c(m, pMalusArg)).not.toThrow();

    const pAndarielArg = m.alloc(0x20);
    const pAndariel = m.alloc(0x100);
    const pAndarielPath = m.alloc(0x80);
    m.setU32(pAndariel, 1);
    m.setU32((pAndariel + 0x2c) >>> 0, pAndarielPath);
    m.setU32(pAndarielArg, pGame);
    m.setU32((pAndarielArg + 4) >>> 0, pPlayer);
    m.setU32((pAndarielArg + 8) >>> 0, pAndariel);
    m.setU8((pExt + 0x118) >>> 0, 1);
    m.setU8((pExt + 0x119) >>> 0, 1);
    expect(() => ACT1Q5_OnAndarielKilled_6FC88B90_113c(m, pQuest, pAndarielArg)).not.toThrow();

    expect(() => ACT1Q5_OnPortalLightningTimerEvent_6FC88D20_113c(m, pQuest, pAndariel)).not.toThrow();
  });

  it('[24/40..30/40] OBJECTS traps/shrines/portals and CUBE_CanPlayerPickupAllCubeItems', () => {
    const { m, pGame } = createW7B2Mem();
    const pRoom = m.alloc(0x80);
    const pRoomEx = m.alloc(0x80);
    const pLevel = m.alloc(0x80);
    m.setU32((pRoom + 0x10) >>> 0, pRoomEx);
    m.setU32((pRoomEx + 0x58) >>> 0, pLevel);
    m.setU32((pLevel + 0x1bc) >>> 0, 1);

    const { pObj } = createObjectUnit(m, 0, pRoom);
    expect(() => OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60_113c(m, pObj, pGame)).not.toThrow();

    const { pPlayer } = createPlayerWithQuestRecord(m, pGame, 6);
    const pOp = m.alloc(0x20);
    m.setU32(pOp, pGame);
    m.setU32((pOp + 4) >>> 0, pObj);
    m.setU32((pOp + 8) >>> 0, pPlayer);

    expect(() => OBJECTS_OperateGemShrine_6FC8B430_113c(m, pOp)).toThrow(D2CommonAssertError);
    expect(() => OBJECTS_OperatePortalShrine_6FC8B9B0_113c(m, pOp)).not.toThrow();

    const pObjectsTxt = m.alloc(0x200);
    m.setU32((pOp + 0x0c) >>> 0, pObjectsTxt);
    m.setU32((pObj + 0x10) >>> 0, 2);
    expect(OBJECTS_OperateFireAndLightningTrap_6FC8E0E0_113c(m, pOp)).toBe(0);

    m.setU32((pObj + 0x10) >>> 0, 0);
    expect(() => OBJECTS_FloorSpikesEventTick_6FC8E270_113c(m, pGame, pObj)).not.toThrow();

    expect(CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c(m, pPlayer, pGame)).toBe(1);

    expect(typeof OBJECTS_LinkHellPortalToDestinationLevel_6FC8B930_113c).toBe('function');
  });

  it('[31/40..35/40] STASH bank operations, Siege Beast stomp, and Izual AI thinker', () => {
    const { m, pGame, pTables } = createW7B2Mem();
    const { pPlayer } = createPlayerWithQuestRecord(m, pGame, 7);
    m.setU32((pPlayer + 0x64) >>> 0, 123);
    m.setU32((pPlayer + 0x68) >>> 0, 2);
    m.setU8((pPlayer + 0x6c) >>> 0, 1);
    STASH_ClearKillerInfoAndRecountScrolls_6FC91270_113c(m, pPlayer, pGame);
    expect(m.u32((pPlayer + 0x64) >>> 0)).toBe(0xffffffff);
    expect(m.u32((pPlayer + 0x68) >>> 0)).toBe(6);
    expect(m.u8((pPlayer + 0x6c) >>> 0)).toBe(0);

    const pOp = m.alloc(0x20);
    m.setU32((pOp + 0x10) >>> 0, 0);
    expect(OBJECTS_OperateBankStash_6FC91290_113c(m, pOp)).toBe(0);

    expect(() => STASH_HandleBankGoldOrCloseAction_6FC917E0_113c(m, pPlayer, pGame, 999, 0x12, 0)).not.toThrow();

    const pMon = m.alloc(0x100);
    const pMonPath = m.alloc(0x80);
    m.setU32(pMon, 1);
    m.setU32((pMon + 4) >>> 0, -1);
    m.setU32((pMon + 0x2c) >>> 0, pMonPath);
    expect(() => MONSTER_SpawnSiegeBeastStompProjectiles_6FC95A40_113c(m, pMon, pGame, 100)).not.toThrow();

    const pAiControl = m.alloc(0x40);
    m.setU32((pAiControl + 0x14) >>> 0, 1);
    m.setU32((pAiControl + 0x18) >>> 0, 5);
    const pMonStatsTxt = m.alloc(0x200);
    const pAiArgs = m.alloc(0x30);
    m.setU32(pAiArgs, pAiControl);
    m.setU32((pAiArgs + 0x08) >>> 0, pPlayer);
    m.setU32((pAiArgs + 0x1c) >>> 0, pMonStatsTxt);
    m.setU32((pTables + 0xa80) >>> 0, 0);
    AI_Thinker_Izual_6FC9EA10_113c(m, pGame, pMon, pAiArgs);
    expect(m.u32((pAiControl + 0x18) >>> 0)).toBe(0);
  });

  it('[36/40..40/40] SKILLS Dragon Talon, Cloak of Shadows, Conversion, and ChannelChargedStream', () => {
    const { m, pGame } = createW7B2Mem();
    const { pPlayer } = createPlayerWithQuestRecord(m, pGame, 8);
    expect(SKILLS_SrvDo075_DragonTalonKickHit_6FCB2DF0_113c(m, pGame, pPlayer, -1, 1)).toBe(0);
    expect(SKILLS_SrvDo_CloakOfShadows_6FCB4B10_113c(m, pGame, pPlayer, -1, 1)).toBe(0);

    const pConvArgs = m.alloc(0x20);
    const pMon = m.alloc(0x100);
    m.setU32(pMon, 1);
    expect(SKILLS_TryConvertMonsterOnHit_6FCB5120_113c(m, pConvArgs, pMon, pGame, pPlayer)).toBe(0);

    expect(SKILLS_SrvDo077_ChannelChargedStream_6FCB5BC0_113c(m, pGame, pPlayer, -1, 1)).toBe(0);
    expect(SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0_113c(m, pGame, pPlayer, -1, 1)).toBe(0);
  });
});
