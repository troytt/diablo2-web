import { describe, expect, it } from 'vitest';
import { INVENTORY_AllocInventory113c } from '../../../src/d2kern-113c/common/inventory';
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c';
import {
  ACT2Q2_InitQuestTableRecord_6FCE7ED0_113c,
  ACT2Q6_InitQuestTableRecord_6FCE9F60_113c,
  ACT3Q1_InitQuestTableRecord_6FD092D0_113c,
  ACT3Q2_InitQuestTableRecord_6FD09DC0_113c,
  ACT3Q4_InitQuestTableRecord_6FD093C0_113c,
  ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c,
  ACT3Q5_InitQuestTableRecord_6FD09200_113c,
  ACT4Q2_OnHellforgeObjectOperate_6FCDB8D0_113c,
  ACT4Q3_InitQuestTableRecord_6FCDC5F0_113c,
  ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c,
  ACT4Q3_OnSeal1Operate_6FCDC580_113c,
  ACT4Q3_OnSeal3Operate_6FCDC510_113c,
  ACT4Q3_OnSeal5Operate_6FCDC4A0_113c,
  ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c,
  ACT4Q3_OnSealObjectActivatedTriggerCheck_6FCDC220_113c,
  ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c,
  ACT4Q3_TimerCallback_CheckDiabloSpawnAndEndgame_6FCDBDC0_113c,
  ACT4Q3_TriggerEndgameOrSendPacket50_6FCDBCE0_113c,
  ACT5Q6_InitQuestTableRecord_6FC80080_113c,
  ACT5Q6_OnBaalKilledCompleteQuestAndSpawnPortal_6FC7FE30_113c,
  ACT5Q6_OnTyraelPortalEnteredTriggerEndgame_6FC7FD00_113c,
  C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c,
  C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c,
  C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c,
  C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c,
  C2S_HandlePacket4F_TradeButton_6FCF1470_113c,
  CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c,
  CLIENTS_DisconnectFlag20OrFallbackClient_6FC4E160_113c,
  CLIENTS_DrainAllPendingSaveChunks_6FC4D790_113c,
  CLIENTS_FlushPositionsSaveAndPacketQueue_6FC4D500_113c,
  CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c,
  CLIENTS_SendNextSaveChunkPacketB3_6FC4D140_113c,
  NPCS_HandleNpcMenuRequest_6FCE00C0_113c,
  NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c,
  OBJ_DeactivateShrineOrStashObject_6FC8F520_113c,
  OBJ_HandleShrineOrOrificeItemAction_6FC8E680_113c,
  PLAYER_ClearActiveInteractOnDeath_6FC58AB0_113c,
  PLAYER_CloseActiveInteractAndSendPacket62_6FC58930_113c,
  PLAYER_HandleDeathCorpseAndSave_6FC99730_113c,
  PLAYER_ProcessPlayerDeathAndPenalties_6FC99E40_113c,
  PLRTRADE_HandleClientTradeButton_6FC94200_113c,
  SKILLS_ClearPlayerCursorIdentifyOrUseState_6FCC1580_113c,
} from '../../../src/d2kern-113c/game/k2-w16b1-113c';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory';

function createMem(): SparseMemory113c {
  const m = new SparseMemory113c();
  m.fill(0, 0x80000, 0);
  m.fill(0x6fd00000, 0x100000, 0);
  m.setU32(0x6fdf0b98, 0x300);
  m.setU32(0x6fdf0b4c, 0x50000);
  for (let i = 0; i < 256; i += 1) {
    m.setU32(0x50000 + i * 4, 0x51000);
  }
  m.setU32(0x10000 + 0xb0, 0x45000);
  m.setU32(0x10000 + 0xb8, 0x45000);
  return m;
}

describe('K2 Wave 16 Batch 1 (w16b1) - 42 D2Game.dll v1.13c functions', () => {
  it('CLIENTS_SendNextSaveChunkPacketB3_6FC4D140_113c sends chunk and frees buffer when complete', () => {
    const m = createMem();
    const pClient = 0x10000;
    const pSaveBuf = 0x20000;
    m.setU8(pClient + 0x3d4, 0x10);
    m.setU32(pClient + 0x17c, pSaveBuf);
    m.setU32(pClient + 0x180, 12);
    m.setU32(pClient + 0x184, 0);
    m.setU32(pClient + 0x188, 0);
    m.setU32(pSaveBuf, 0x11223344);
    m.setU32(pSaveBuf + 4, 0x55667788);
    m.setU32(pSaveBuf + 8, 0x99aabbcc);
    CLIENTS_SendNextSaveChunkPacketB3_6FC4D140_113c(m, pClient, 0);
    expect(m.u32(pClient + 0x188)).toBe(0);
    expect(m.u32(pClient + 0x180)).toBe(0);
    expect(m.u32(pClient + 0x17c)).toBe(0);
  });

  it('CLIENTS_FlushPositionsSaveAndPacketQueue_6FC4D500_113c returns early on null client or non-state-4', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pClient = 0x20000;
    m.setU32(pClient + 4, 2);
    CLIENTS_FlushPositionsSaveAndPacketQueue_6FC4D500_113c(m, pClient, pGame, 0);
    expect(m.u32(pClient + 4)).toBe(2);
  });

  it('CLIENTS_DrainAllPendingSaveChunks_6FC4D790_113c drains pending save chunks', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pClient = 0x15000;
    const pBuf = 0x20000;
    m.setU8(pGame + 0x6a, 1);
    m.setU8(pClient + 0x3d4, 0x10);
    m.setU32(pClient + 0x17c, pBuf);
    m.setU32(pClient + 0x180, 8);
    m.setU32(pClient + 0x184, 0);
    m.setU32(pClient + 0x188, 0);
    CLIENTS_DrainAllPendingSaveChunks_6FC4D790_113c(m, pGame, pClient);
    expect(m.u32(pClient + 0x17c)).toBe(0);
  });

  it('CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c handles missing game cleanly', () => {
    const m = createMem();
    CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c(m, 0x9999, 1);
    expect(m.u32(0x9999)).toBe(0);
  });

  it('CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c processes single-player game', () => {
    const m = createMem();
    const pGame = 0x10000;
    m.setU32(pGame + 0x68, 3);
    CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c(m, pGame);
    expect(m.u32(pGame + 0x68)).toBe(3);
  });

  it('CLIENTS_DisconnectFlag20OrFallbackClient_6FC4E160_113c handles missing game key', () => {
    const m = createMem();
    CLIENTS_DisconnectFlag20OrFallbackClient_6FC4E160_113c(m, 0x1234);
    expect(m.u32(0x1234)).toBe(0);
  });

  it('PLAYER_CloseActiveInteractAndSendPacket62_6FC58930_113c clears interact state on player', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    const pData = 0x30000;
    const pObject = 0x35000;
    m.setU32(pObject, 2);
    m.setU32(pObject + 0x0c, 5);
    m.setU32(pGame + 0x1520 + 5 * 4, pObject);
    m.setU32(pPlayer + 0x14, pData);
    m.setU8(pPlayer + 0x6c, 1);
    m.setU32(pPlayer + 0x68, 2);
    m.setU32(pPlayer + 0x64, 5);
    PLAYER_CloseActiveInteractAndSendPacket62_6FC58930_113c(m, pPlayer, pGame);
    expect(m.u32(pPlayer + 0x64)).toBe(0xffffffff);
    expect(m.u32(pPlayer + 0x68)).toBe(6);
    expect(m.u8(pPlayer + 0x6c)).toBe(0);
  });

  it('PLAYER_ClearActiveInteractOnDeath_6FC58AB0_113c deactivates active object interaction', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    const pObject = 0x35000;
    m.setU32(pObject, 2);
    m.setU32(pObject + 0x0c, 5);
    m.setU32(pGame + 0x1520 + 5 * 4, pObject);
    m.setU8(pPlayer + 0x6c, 1);
    m.setU32(pPlayer + 0x68, 2);
    m.setU32(pPlayer + 0x64, 5);
    PLAYER_ClearActiveInteractOnDeath_6FC58AB0_113c(m, pPlayer, pGame);
    expect(m.u8(pPlayer + 0x6c)).toBe(0);
  });

  it('ACT5Q6_OnTyraelPortalEnteredTriggerEndgame_6FC7FD00_113c returns 0 when quest 0x24 not present', () => {
    const m = createMem();
    const pQuestArg = 0x10000;
    const pGame = 0x20000;
    m.setU32(pQuestArg, pGame);
    expect(ACT5Q6_OnTyraelPortalEnteredTriggerEndgame_6FC7FD00_113c(m, pQuestArg)).toBe(0);
  });

  it('ACT5Q6_OnBaalKilledCompleteQuestAndSpawnPortal_6FC7FE30_113c updates quest control 0x20 to 0x13', () => {
    const m = createMem();
    const pQuest = 0x10000;
    const pQuestState = 0x15000;
    const pGame = 0x20000;
    const pQc = 0x25000;
    const pQuestArg = 0x30000;
    const pVictim = 0x35000;
    m.setU32(pVictim, 1);
    m.setU32(pVictim + 0x2c, 0x36000);
    m.setU32(pQuest + 0x04, pGame);
    m.setU32(pQuest + 0x18, pQuestState);
    m.setU32(pGame + 0x10f4, pQc);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 0x08, pVictim);
    ACT5Q6_OnBaalKilledCompleteQuestAndSpawnPortal_6FC7FE30_113c(m, pQuest, pQuestArg);
    expect(m.u8(pQc + 0x20)).toBe(0x13);
  });

  it('ACT5Q6_InitQuestTableRecord_6FC80080_113c initializes quest 0x25 state and callbacks', () => {
    const m = createMem();
    const pQuest = 0x10000;
    const pGame = 0x20000;
    m.setU32(pQuest + 0x04, pGame);
    ACT5Q6_InitQuestTableRecord_6FC80080_113c(m, pQuest);
    expect(m.u32(pQuest + 0xc0)).toBe(0x6fc7fe30);
    expect(m.u32(pQuest + 0xe0)).toBe(0x28);
    expect(m.u32(pQuest + 0x10)).toBe(0x25);
    const pState = m.u32(pQuest + 0x18);
    expect(pState).not.toBe(0);
    expect(m.u32(pState + 0x94)).toBe(1);
    expect(m.u32(pState + 0x9c)).toBe(1);
  });

  it('OBJ_HandleShrineOrOrificeItemAction_6FC8E680_113c handles cancel action 2', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    const pObject = 0x30000;
    m.setU32(pPlayer + 0x0c, 1);
    m.setU32(pObject + 0x0c, 2);
    m.setU32(pGame + 0x1120 + 4, pPlayer);
    m.setU32(pGame + 0x1520 + 8, pObject);
    expect(OBJ_HandleShrineOrOrificeItemAction_6FC8E680_113c(m, 0, 1, pGame, 2, 2)).toBe(1);
    expect(m.u32(pPlayer + 0x64)).toBe(0xffffffff);
    expect(m.u32(pPlayer + 0x68)).toBe(6);
  });

  it('OBJ_DeactivateShrineOrStashObject_6FC8F520_113c resets player interaction and orifice mode', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    const pObject = 0x30000;
    m.setU16(pObject + 0x04, 0x98);
    m.setU32(pObject + 0x10, 1);
    OBJ_DeactivateShrineOrStashObject_6FC8F520_113c(m, pGame, pPlayer, pObject);
    expect(m.u32(pPlayer + 0x64)).toBe(0xffffffff);
    expect(m.u8(pPlayer + 0x6c)).toBe(0);
  });

  it('PLRTRADE_HandleClientTradeButton_6FC94200_113c handles inactive trade state and cube buttons', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    expect(PLRTRADE_HandleClientTradeButton_6FC94200_113c(m, pGame, pPlayer, 2, 0)).toBe(0);
    m.setU8(pPlayer + 0x6c, 1);
    m.setU32(pPlayer + 0x68, 4);
    expect(PLRTRADE_HandleClientTradeButton_6FC94200_113c(m, pGame, pPlayer, 0x17, 0)).toBe(0);
    expect(m.u8(pPlayer + 0x6c)).toBe(0);
  });

  it('PLAYER_HandleDeathCorpseAndSave_6FC99730_113c sets client flag 0x08 and mode 0x11', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    const pData = 0x30000;
    const pClient = 0x40000;
    m.fill(0x6fd40000, 0x4000, 0);
    initD2GameGlobalsInMem113c(m, m.alloc(0x2000));
    m.setU32(pGame + 0x90, 10);
    m.setU32(pPlayer + 0x0c, 1);
    m.setU32(pPlayer + 0x14, pData);
    INVENTORY_AllocInventory113c(m, 0, pPlayer);
    m.setU32(pPlayer + 0x2c, 0x25000);
    m.setU32(0x25000 + 0x1c, 0x26000);
    m.setU32(0x26100, 0x26000);
    m.setU32(0x26000, 0x26100);
    m.setU32(0x26000 + 0x10, 0x26200);
    m.setU32(0x26000 + 0x24, 1);
    m.setU32(0x26000 + 0x54, 100);
    m.setU32(0x26000 + 0x58, 100);
    m.setU32(0x26200 + 0x58, 0x26300);
    m.setU32(0x26300 + 0x1d0, 1);
    m.setU32(pData + 0x9c, pClient);
    m.setU32(0x6fd31c3c, 1);
    PLAYER_HandleDeathCorpseAndSave_6FC99730_113c(m, pGame, pPlayer);
    expect(m.u8(pClient + 0x0a) & 0x08).toBe(0x08);
    expect(m.u32(pPlayer + 0x10)).toBe(0x11);
  });

  it('PLAYER_ProcessPlayerDeathAndPenalties_6FC99E40_113c processes player death state', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pVictim = 0x20000;
    const pData = 0x30000;
    const pClient = 0x40000;
    m.setU32(pVictim + 0x14, pData);
    m.setU32(pVictim + 0x2c, 0x25000);
    m.setU32(pData + 0x9c, pClient);
    m.setU32(pVictim + 0xc4, 0x03);
    PLAYER_ProcessPlayerDeathAndPenalties_6FC99E40_113c(m, pGame, pVictim, 0, 0);
    expect(m.u8(pClient + 0x0a) & 0x08).toBe(0x08);
    expect(m.u32(pVictim + 0xc4) & 0x02).toBe(0);
  });

  it('SKILLS_ClearPlayerCursorIdentifyOrUseState_6FCC1580_113c clears flag 0x08 on cursor item', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    m.setU32(pPlayer + 0xc8, 0x40);
    SKILLS_ClearPlayerCursorIdentifyOrUseState_6FCC1580_113c(m, pPlayer, 1, pGame);
    expect(m.u32(pPlayer + 0xc8) & 0x40).toBe(0);
  });

  it('ACT4Q2_OnHellforgeObjectOperate_6FCDB8D0_113c advances Hellforge object mode', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pQc = 0x15000;
    const pQuest = 0x18000;
    const pState = 0x19000;
    const pObj = 0x20000;
    const pPlayer = 0x25000;
    const pData = 0x26000;
    const pHist = 0x27000;
    const pQuestArg = 0x30000;
    m.setU32(pGame + 0x10f4, pQc);
    m.setU32(pQc, pQuest);
    m.setU32(pQuest, 0x18);
    m.setU32(pQuest + 0x04, pGame);
    m.setU8(pQuest + 0x09, 1);
    m.setU8(pQuest + 0x0c, 0);
    m.setU32(pQuest + 0x18, pState);
    m.setU32(pPlayer + 0x14, pData);
    m.setU32(pData + 0x10, pHist);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 0x04, pObj);
    m.setU32(pQuestArg + 0x08, pPlayer);
    expect(ACT4Q2_OnHellforgeObjectOperate_6FCDB8D0_113c(m, pQuestArg)).toBe(0);
    expect(m.u8(pQuest + 0x0c)).toBe(1);
  });

  it('ACT4Q3_TriggerEndgameOrSendPacket50_6FCDBCE0_113c sends packet 0x50 in classic mode', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    const pData = 0x30000;
    const pHist = 0x35000;
    m.setU32(pPlayer + 0x14, pData);
    m.setU32(pData + 0x10, pHist);
    m.setU8(pPlayer + 0x6c, 0);
    expect(ACT4Q3_TriggerEndgameOrSendPacket50_6FCDBCE0_113c(m, pGame, pPlayer, 0)).toBe(0);
    expect(m.u32(pData + 0x4c)).toBe(1);
    expect(m.u8(0x6fd44ed0)).toBe(0x50);
  });

  it('ACT4Q3_TimerCallback_CheckDiabloSpawnAndEndgame_6FCDBDC0_113c triggers Diablo spawn on count 5', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pQuest = 0x15000;
    const pState = 0x18000;
    m.setU32(pQuest + 0x04, pGame);
    m.setU32(pQuest + 0x18, pState);
    m.setU8(pState + 0x02, 0);
    m.setU8(pState + 0x03, 1);
    m.setU8(pState + 0x04, 1);
    m.setU32(0x6fd18d10, 0x20000);
    expect(ACT4Q3_TimerCallback_CheckDiabloSpawnAndEndgame_6FCDBDC0_113c(m, pGame, pQuest)).toBe(1);
    expect(m.u8(pState + 0x03)).toBe(0);
  });

  it('ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c sets seal byte and checks all 5 seals', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pQc = 0x15000;
    const pQuest = 0x18000;
    const pState = 0x19000;
    const pObj = 0x20000;
    const pQuestArg = 0x30000;
    m.setU32(pGame + 0x10f4, pQc);
    m.setU32(pQc, pQuest);
    m.setU32(pQuest, 0x17);
    m.setU32(pQuest + 0x18, pState);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 0x04, pObj);
    m.setU32(pObj + 0x04, 0x188);
    m.setU32(pQuestArg + 0x10, 0x188);
    expect(ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c(m, pQuestArg)).toBe(0);
    expect(m.u8(pState + 0x0c)).toBe(1);
  });

  it('ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c returns cleanly when room is 0', () => {
    const m = createMem();
    const pCoord = 0x10000;
    const pQuestArg = 0x20000;
    const pObj = 0x30000;
    m.setU32(pObj, 2);
    m.setU32(pQuestArg + 0x04, pObj);
    ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c(m, pCoord, pQuestArg, 1);
    expect(m.u32(pCoord)).toBe(0);
  });

  it('ACT4Q3_OnSealObjectActivatedTriggerCheck_6FCDC220_113c records seal object guid', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pQc = 0x15000;
    const pQuest = 0x18000;
    const pState = 0x19000;
    const pObj = 0x20000;
    const pQuestArg = 0x30000;
    m.setU32(pGame + 0x10f4, pQc);
    m.setU32(pQc, pQuest);
    m.setU32(pQuest, 0x17);
    m.setU32(pQuest + 0x18, pState);
    m.setU32(pObj + 0x0c, 77);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 0x04, pObj);
    ACT4Q3_OnSealObjectActivatedTriggerCheck_6FCDC220_113c(m, pQuestArg);
    expect(m.u8(pState + 0x06)).toBe(1);
    expect(m.u32(pState + 0x08)).toBe(77);
  });

  it('ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c increments seal boss count and handles Diablo', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pQc = 0x15000;
    const pQuest = 0x18000;
    const pState = 0x19000;
    const pVictim = 0x20000;
    const pQuestArg = 0x30000;
    m.setU32(pGame + 0x10f4, pQc);
    m.setU32(pQuest + 0x04, pGame);
    m.setU32(pQuest + 0x18, pState);
    m.setU32(pVictim + 0x04, 0x100);
    m.setU32(pQuestArg + 0x08, pVictim);
    ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c(m, pQuest, pQuestArg);
    expect(m.u32(pState + 0x48)).toBe(1);
    m.setU32(pVictim + 0x04, 0xf3);
    ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c(m, pQuest, pQuestArg);
    expect(m.u8(pQc + 0x20)).toBe(0x0d);
    expect(m.u8(pState + 0x14)).toBe(1);
  });

  it('ACT4Q3_OnSeal5Operate_6FCDC4A0_113c offsets seal 5 coords (+0x20, +0x10)', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pQc = 0x15000;
    const pQuest = 0x18000;
    const pState = 0x19000;
    const pObj = 0x20000;
    const pPath = 0x21000;
    const pQuestArg = 0x30000;
    m.setU32(pObj, 2);
    m.setU32(pObj + 0x2c, pPath);
    m.setU32(pGame + 0x10f4, pQc);
    m.setU32(pQc, pQuest);
    m.setU32(pQuest, 0x17);
    m.setU32(pQuest + 0x18, pState);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 0x04, pObj);
    expect(ACT4Q3_OnSeal5Operate_6FCDC4A0_113c(m, pQuestArg)).toBe(0);
    expect(m.u32(pState + 0x34)).toBe(0x20);
    expect(m.u32(pState + 0x38)).toBe(0x10);
  });

  it('ACT4Q3_OnSeal3Operate_6FCDC510_113c offsets seal 3 coords (-0x27, +0x21)', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pQc = 0x15000;
    const pQuest = 0x18000;
    const pState = 0x19000;
    const pObj = 0x20000;
    const pPath = 0x21000;
    const pQuestArg = 0x30000;
    m.setU32(pObj, 2);
    m.setU32(pObj + 0x2c, pPath);
    m.setU32(pGame + 0x10f4, pQc);
    m.setU32(pQc, pQuest);
    m.setU32(pQuest, 0x17);
    m.setU32(pQuest + 0x18, pState);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 0x04, pObj);
    expect(ACT4Q3_OnSeal3Operate_6FCDC510_113c(m, pQuestArg)).toBe(0);
    expect(m.u32(pState + 0x2c)).toBe(0xffffffd9);
    expect(m.u32(pState + 0x30)).toBe(0x21);
  });

  it('ACT4Q3_OnSeal1Operate_6FCDC580_113c offsets seal 1 coords (-0x0c, -0x34)', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pQc = 0x15000;
    const pQuest = 0x18000;
    const pState = 0x19000;
    const pObj = 0x20000;
    const pPath = 0x21000;
    const pQuestArg = 0x30000;
    m.setU32(pObj, 2);
    m.setU32(pObj + 0x2c, pPath);
    m.setU32(pGame + 0x10f4, pQc);
    m.setU32(pQc, pQuest);
    m.setU32(pQuest, 0x17);
    m.setU32(pQuest + 0x18, pState);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 0x04, pObj);
    expect(ACT4Q3_OnSeal1Operate_6FCDC580_113c(m, pQuestArg)).toBe(0);
    expect(m.u32(pState + 0x24)).toBe(0xfffffff4);
    expect(m.u32(pState + 0x28)).toBe(0xffffffcc);
  });

  it('ACT4Q3_InitQuestTableRecord_6FCDC5F0_113c initializes quest 0x1a state', () => {
    const m = createMem();
    const pQuest = 0x10000;
    const pGame = 0x20000;
    m.setU32(pQuest + 0x04, pGame);
    ACT4Q3_InitQuestTableRecord_6FCDC5F0_113c(m, pQuest);
    expect(m.u32(pQuest + 0xc0)).toBe(0x6fcdc2c0);
    expect(m.u32(pQuest + 0xe0)).toBe(0x1a);
    expect(m.u32(pQuest + 0x18)).not.toBe(0);
  });

  it('NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c handles null npc cleanly', () => {
    const m = createMem();
    NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c(m, 0, 0x10000, 0x20000, 0, 0);
    expect(m.u32(0x10000)).toBe(0);
  });

  it('NPCS_HandleNpcMenuRequest_6FCE00C0_113c handles missing NPC cleanly', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    expect(NPCS_HandleNpcMenuRequest_6FCE00C0_113c(m, pPlayer, pGame, 1, 99, 0)).toBe(0);
  });

  it('ACT2Q2_InitQuestTableRecord_6FCE7ED0_113c initializes quest 0x0a state', () => {
    const m = createMem();
    const pQuest = 0x10000;
    const pGame = 0x20000;
    m.setU32(pQuest + 0x04, pGame);
    ACT2Q2_InitQuestTableRecord_6FCE7ED0_113c(m, pQuest);
    expect(m.u32(pQuest + 0xe0)).toBe(0x0a);
    expect(m.u8(pQuest + 0x0b)).toBe(0x0d);
    expect(m.u32(pQuest + 0x18)).not.toBe(0);
  });

  it('ACT2Q6_InitQuestTableRecord_6FCE9F60_113c initializes quest 0x0e state', () => {
    const m = createMem();
    const pQuest = 0x10000;
    const pGame = 0x20000;
    m.setU32(pQuest + 0x04, pGame);
    ACT2Q6_InitQuestTableRecord_6FCE9F60_113c(m, pQuest);
    expect(m.u32(pQuest + 0xe0)).toBe(0x0e);
    expect(m.u8(pQuest + 0x0d)).toBe(4);
    expect(m.u32(pQuest + 0x18)).not.toBe(0);
  });

  it('C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c validates packet length and guid', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    const pPkt = 0x30000;
    expect(C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c(m, pGame, pPlayer, pPkt, 4)).toBe(3);
    m.setU32(pPkt + 1, 0xffffffff);
    expect(C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c(m, pGame, pPlayer, pPkt, 5)).toBe(0);
  });

  it('C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c validates packet length 0x0d', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    const pPkt = 0x30000;
    expect(C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c(m, pGame, pPlayer, pPkt, 4)).toBe(3);
  });

  it('C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c validates packet length 0x11', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    const pPkt = 0x30000;
    expect(C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c(m, pGame, pPlayer, pPkt, 8)).toBe(3);
  });

  it('C2S_HandlePacket4F_TradeButton_6FCF1470_113c validates packet length 7 and dispatches', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    const pPkt = 0x30000;
    expect(C2S_HandlePacket4F_TradeButton_6FCF1470_113c(m, pGame, pPlayer, pPkt, 5)).toBe(3);
    expect(C2S_HandlePacket4F_TradeButton_6FCF1470_113c(m, pGame, pPlayer, pPkt, 7)).toBe(0);
  });

  it('C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c validates length and mode 0x11', () => {
    const m = createMem();
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    const pPkt = 0x30000;
    expect(C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c(m, pGame, pPlayer, pPkt, 2)).toBe(3);
    expect(C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c(m, pGame, pPlayer, pPkt, 1)).toBe(0);
  });

  it('ACT3Q5_InitQuestTableRecord_6FD09200_113c initializes quest 0x15 state', () => {
    const m = createMem();
    const pQuest = 0x10000;
    const pGame = 0x20000;
    m.setU32(pQuest + 0x04, pGame);
    ACT3Q5_InitQuestTableRecord_6FD09200_113c(m, pQuest);
    expect(m.u32(pQuest + 0x10)).toBe(0x14);
    expect(m.u32(pQuest + 0xe0)).toBe(0x15);
    expect(m.u32(pQuest + 0x18)).not.toBe(0);
  });

  it('ACT3Q1_InitQuestTableRecord_6FD092D0_113c initializes quest 0x14 state', () => {
    const m = createMem();
    const pQuest = 0x10000;
    const pGame = 0x20000;
    m.setU32(pQuest + 0x04, pGame);
    ACT3Q1_InitQuestTableRecord_6FD092D0_113c(m, pQuest);
    expect(m.u32(pQuest + 0x10)).toBe(0x10);
    expect(m.u32(pQuest + 0xe0)).toBe(0x14);
    const pState = m.u32(pQuest + 0x18);
    expect(m.u8(pState + 0x0c)).toBe(1);
    expect(m.u8(pState + 0x01)).toBe(1);
  });

  it('ACT3Q4_InitQuestTableRecord_6FD093C0_113c initializes quest 0x11 state', () => {
    const m = createMem();
    const pQuest = 0x10000;
    const pGame = 0x20000;
    m.setU32(pQuest + 0x04, pGame);
    ACT3Q4_InitQuestTableRecord_6FD093C0_113c(m, pQuest);
    expect(m.u32(pQuest + 0x10)).toBe(0x13);
    expect(m.u32(pQuest + 0xe0)).toBe(0x11);
    const pState = m.u32(pQuest + 0x18);
    expect(m.u8(pState)).toBe(1);
  });

  it('ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c returns 0 when quest 0x0f is absent', () => {
    const m = createMem();
    const pQuestArg = 0x10000;
    const pGame = 0x20000;
    m.setU32(pQuestArg, pGame);
    expect(ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c(m, pQuestArg)).toBe(0);
  });

  it('ACT3Q2_InitQuestTableRecord_6FD09DC0_113c initializes quest 0x13 state', () => {
    const m = createMem();
    const pQuest = 0x10000;
    const pGame = 0x20000;
    m.setU32(pQuest + 0x04, pGame);
    ACT3Q2_InitQuestTableRecord_6FD09DC0_113c(m, pQuest);
    expect(m.u32(pQuest + 0x10)).toBe(0x0f);
    expect(m.u32(pQuest + 0xe0)).toBe(0x13);
    expect(m.u32(pQuest + 0x18)).not.toBe(0);
  });
});
