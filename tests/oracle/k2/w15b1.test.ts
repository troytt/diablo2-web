import { describe, expect, it } from 'vitest';
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers';
import {
  INVENTORY_AllocCorpse113c,
  INVENTORY_PlaceItemInBodyLoc113c,
  INVENTORY_SIGNATURE_113C,
  INVENTORY_SetCursorItem113c,
} from '../../../src/d2kern-113c/common/inventory';
import { DRLGWARP_TestRoomTileBit113c } from '../../../src/d2kern-113c/common/items';
import {
  QUESTRECORD_AllocRecord113c,
  QUESTRECORD_SetQuestState113c,
} from '../../../src/d2kern-113c/common/quest-record';
import {
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist';
import { GAME_AllocGameStrc113c } from '../../../src/d2kern-113c/game/game-strc';
import {
  ACT1Q2_InitQuestData_6FC89130_113c,
  ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c,
  ACT1Q4_InitQuestData_6FC887D0_113c,
  ACT1Q5_InitQuestData_6FC87210_113c,
  ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c,
  ACT2Q2_OnNpcSpeechComplete_6FCE7DC0_113c,
  ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c,
  ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c,
  ACT3Q2_OnNpcSpeechComplete_6FD09600_113c,
  ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c,
  ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c,
  ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c,
  ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c,
  ACT4Q2_InitQuestData_6FCDAD40_113c,
  ACT5Q2_InitQuestData_6FC7CC70_113c,
  ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c,
  ACT5Q3_InitQuestData_6FC7FC20_113c,
  C2S_Packet_DropCursorItem_6FCEF380_113c,
  C2S_Packet_HireMercenary_6FCF0060_113c,
  C2S_Packet_NpcBuyItem_6FCEF220_113c,
  CLIENT_NotifyAndDisconnectClient_6FC4D090_113c,
  D2GAME_SCRATCH_W15B1_113C,
  ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c,
  NPCS_BeginVendorOrGambleInteract_6FCDF730_113c,
  OBJ_OperateDuranceStairs_6FC8CD40_113c,
  PLAYER_CreateCorpseOnDeath_6FC99210_113c,
  PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c,
  QUESTS_OnBossActChangeOrBossKill_6FC56890_113c,
  SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c,
  SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c,
  SKILLS_SrvDo_SummonPetWithAiInit_6FCB6310_113c,
} from '../../../src/d2kern-113c/game/k2-w15b1-113c';
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory';

function allocItemUnit(m: SparseMemory113c, classId: number, guid = 500): number {
  const pItem = m.alloc(0x100);
  m.setU32(pItem, 4);
  m.setU32(pItem + 0x04, classId >>> 0);
  m.setU32(pItem + 0x0c, guid >>> 0);
  const pItemData = m.alloc(0x80);
  m.setU32(pItem + 0x14, pItemData);
  const pItemPath = m.alloc(0x20);
  m.setU32(pItem + 0x2c, pItemPath);
  return pItem;
}

function createTestEnv() {
  const m = new SparseMemory113c();
  m.fill(0x6fd00000, 0x100000, 0);
  m.fill(D2GAME_SCRATCH_W15B1_113C, 0x1000, 0);
  const pDataTables = m.alloc(0x2000);
  initD2GameGlobalsInMem113c(m, pDataTables);
  m.setU32(0x6fde9e1c, pDataTables);
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C));

  const pSkillsTxt = m.alloc(64 * 0x23c);
  m.setU32(pDataTables + 0xb98, pSkillsTxt);
  m.setU32(pDataTables + 0xba0, 64);

  const pItemsTxt = m.alloc(8 * 0x1b0);
  m.setU8(pItemsTxt + 0x10f, 1);
  m.setU8(pItemsTxt + 0x110, 1);
  m.setU32(pDataTables + 0xa78, pItemsTxt);
  m.setU32(pDataTables + 0xa80, pItemsTxt);
  m.setU32(pDataTables + 0xa84, 8);
  m.setU32(0x6fdefb94, 8);
  m.setU32(0x6fdefb98, pItemsTxt);

  const pObjectsTxt = m.alloc(8 * 0x1c0);
  m.setU32(pDataTables + 0xc98, pObjectsTxt);
  m.setU32(pDataTables + 0xc9c, 8);
  m.setU32(0x6fdf0b94, pObjectsTxt);
  m.setU32(0x6fdf0b98, 8);

  const pLevelsTxt = m.alloc(136 * 0x220);
  m.setU32(pDataTables + 0x9c8, pLevelsTxt);
  m.setU32(pDataTables + 0x9cc, 136);

  // Body-location grid0 dimensions (13 x 1) and ItemTypes equivalence table (type 45 = weapon)
  m.setU8(0x6fded378, 13);
  m.setU8(0x6fded379, 1);
  const pTypeEquiv = m.alloc(64 * 2 * 4);
  m.setU32(pDataTables + 0xbfc, 64);
  m.setU32(pDataTables + 0xc00, 2);
  m.setU32(pDataTables + 0xc04, pTypeEquiv);
  m.setU32(pTypeEquiv + (2 * 45 + 1) * 4, 1 << (45 & 31));

  const pGame = GAME_AllocGameStrc113c(m);
  const pQuestCtrl = m.alloc(0x80);
  m.setU32(pQuestCtrl + 0x08, 1);
  const pGlobalQuestFlags = QUESTRECORD_AllocRecord113c(m, 0);
  m.setU32(pQuestCtrl + 0x0c, pGlobalQuestFlags);
  m.setU32(pGame + 0x10f4, pQuestCtrl);

  const pPlayer = m.alloc(0x100);
  m.setU32(pPlayer, 0);
  m.setU32(pPlayer + 0x0c, 101);
  m.setU32(pPlayer + 0x80, pGame);
  STATLIST_CreateEx113c(m, pPlayer, 1, pGame);

  const pPlayerData = m.alloc(0xc0);
  m.setU32(pPlayer + 0x14, pPlayerData);
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0);
  m.setU32(pPlayerData + 0x10, pQuestFlags);

  const pIntro = m.alloc(0x10);
  const pIntroBits = QUESTRECORD_AllocRecord113c(m, 0);
  m.setU32(pIntro + 0x04, pIntroBits);
  m.setU32(pPlayerData + 0x60, pIntro);

  const pClient = m.alloc(0x520);
  m.setU32(pClient, 1);
  m.setU32(pClient + 0x1a8, pGame);
  m.setU32(pClient + 0x1bc, m.alloc(0x410));
  m.setU32(pPlayerData + 0x9c, pClient);

  const pInv = m.alloc(0x60);
  m.setU32(pInv, INVENTORY_SIGNATURE_113C);
  m.setU32(pInv + 0x08, pPlayer);
  m.setU32(pInv + 0x1c, 0xffffffff);
  m.setU32(pPlayer + 0x60, pInv);

  return {
    m,
    pDataTables,
    pSkillsTxt,
    pItemsTxt,
    pObjectsTxt,
    pLevelsTxt,
    pGame,
    pQuestCtrl,
    pGlobalQuestFlags,
    pPlayer,
    pPlayerData,
    pQuestFlags,
    pClient,
    pInv,
  };
}

describe('K2 Wave 15 Batch 1 (w15b1) — 30 D2Game 1.13c functions (0x6FC4D090..0x6FD0A140)', () => {
  it('1. CLIENT_NotifyAndDisconnectClient_6FC4D090_113c broadcasts 0x5A, unlinks client, sends 0xB0 and closes socket', () => {
    const { m, pGame } = createTestEnv();
    const pClient = m.alloc(0x520);
    m.setU32(pClient, 77);
    m.setU8(pClient + 0x0d, 0x48);
    m.setU8(pClient + 0x1d, 0x41);
    m.setU32(pGame + 0x88, pClient);

    let sentClientId = 0;
    let sentByte = 0;
    let closedClientId = 0;
    CLIENT_NotifyAndDisconnectClient_6FC4D090_113c(m, pClient, pGame, 4, {
      d2netSendPacket: (_q, cid, pPkt) => {
        sentClientId = cid;
        sentByte = m.u8(pPkt);
      },
      d2netCloseConnection: (cid) => {
        closedClientId = cid;
      },
    });

    expect(m.u32(pGame + 0x88)).toBe(0);
    expect(sentClientId).toBe(77);
    expect(sentByte).toBe(0xb0);
    expect(closedClientId).toBe(77);
  });

  it('2. QUESTS_OnBossActChangeOrBossKill_6FC56890_113c sets quest states on Andariel (0x9B), Duriel (0xD2), and Baal (0x16F)', () => {
    const { m, pGame, pQuestCtrl, pPlayer, pPlayerData, pQuestFlags } = createTestEnv();
    m.setU32(pGame + 0x70, 1);

    const pQuest4 = m.alloc(0x100);
    m.setU32(pQuest4, 4);
    m.setU32(pQuest4 + 0x04, pGame);
    ACT1Q4_InitQuestData_6FC887D0_113c(m, pQuest4);
    m.setU32(pQuestCtrl, pQuest4);

    const pAndariel = m.alloc(0x100);
    m.setU32(pAndariel, 1);
    m.setU32(pAndariel + 0x04, 0x9b);
    QUESTS_OnBossActChangeOrBossKill_6FC56890_113c(m, pAndariel, pPlayer, pGame);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 7, 0)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 7, 0x0d)).toBe(1);
    expect(m.u32(pPlayerData + 0x4c)).toBe(1);

    m.setU32(pPlayerData + 0x4c, 0);
    const pDuriel = m.alloc(0x100);
    m.setU32(pDuriel, 1);
    m.setU32(pDuriel + 0x04, 0xd2);
    QUESTS_OnBossActChangeOrBossKill_6FC56890_113c(m, pDuriel, pPlayer, pGame);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0f, 0)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0)).toBe(1);

    m.setU32(pPlayerData + 0x4c, 0);
    const pBaal = m.alloc(0x100);
    m.setU32(pBaal, 1);
    m.setU32(pBaal + 0x04, 0x16f);
    QUESTS_OnBossActChangeOrBossKill_6FC56890_113c(m, pBaal, pPlayer, pGame);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1c, 0)).toBe(1);
  });

  it('3. SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c spawns 12 radial minions and links pack leader', () => {
    const { m, pGame, pPlayer } = createTestEnv();
    const pPath = m.alloc(0x80);
    m.setU16(pPath + 0x02, 100);
    m.setU16(pPath + 0x06, 200);
    m.setU16(pPath + 0x10, 105);
    m.setU16(pPath + 0x12, 205);
    m.setU32(pPlayer + 0x2c, pPath);

    const spawnedCoords: Array<[number, number]> = [];
    const rc = SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c(m, pGame, pPlayer, 10, 3, {
      spawnRadialMinion: (_mem, _sk, _g, _u, nx, ny) => {
        spawnedCoords.push([nx, ny]);
        const pMinion = m.alloc(0x100);
        m.setU32(pMinion, 1);
        m.setU32(pMinion + 0x0c, 500 + spawnedCoords.length);
        const pMonData = m.alloc(0x60);
        const pAiGen = m.alloc(0x48);
        m.setU32(pMonData + 0x28, pAiGen);
        m.setU32(pMonData + 0x34, pAiGen);
        m.setU32(pMinion + 0x14, pMonData);
        const pMinPath = m.alloc(0x80);
        m.setU16(pMinPath + 0x02, nx);
        m.setU16(pMinPath + 0x06, ny);
        m.setU32(pMinion + 0x2c, pMinPath);
        return pMinion;
      },
    });
    expect(rc).toBe(1);
    expect(spawnedCoords.length).toBe(12);
    expect((m.u32(pPlayer + 0xc4) & 0x40) !== 0).toBe(true);
  });

  it('4. ACT5Q2_InitQuestData_6FC7CC70_113c initializes quest 0x24 and allocates 0x160 state', () => {
    const { m } = createTestEnv();
    const pQuest = m.alloc(0x100);
    ACT5Q2_InitQuestData_6FC7CC70_113c(m, pQuest);
    expect(m.u32(pQuest + 0xa0)).toBe(0x6fc783c0);
    expect(m.u32(pQuest + 0xe0)).toBe(0x24);
    expect(m.u32(pQuest + 0x10)).toBe(0x21);
    expect(m.u32(pQuest + 0x18)).toBeGreaterThan(0);
  });

  it('5. ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c handles missing and present ice potion', () => {
    const { m, pItemsTxt, pGame, pQuestCtrl, pPlayer, pQuestFlags, pInv } = createTestEnv();
    const pQuest = m.alloc(0x100);
    m.setU32(pQuest, 0x21);
    m.setU32(pQuest + 0x04, pGame);
    ACT5Q3_InitQuestData_6FC7FC20_113c(m, pQuest);
    m.setU8(pQuest + 0x0b, 1);
    m.setU32(pQuestCtrl, pQuest);

    const pObjRoom = m.alloc(0x80);
    const pObjRoomEx = m.alloc(0x80);
    m.setU32(pObjRoom + 0x10, pObjRoomEx);
    const pObject = m.alloc(0x100);
    m.setU32(pObject, 2);
    const pObjPath = m.alloc(0x40);
    m.setU32(pObjPath, pObjRoom);
    m.setU32(pObjPath + 0x0c, 55);
    m.setU32(pObjPath + 0x10, 66);
    m.setU32(pObject + 0x2c, pObjPath);

    const pOpArg = m.alloc(0x20);
    m.setU32(pOpArg, pGame);
    m.setU32(pOpArg + 0x04, pObject);
    m.setU32(pOpArg + 0x08, pPlayer);

    ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c(m, pOpArg);
    expect(m.u8(pQuest + 0x0b)).toBe(3);

    m.setU32(pItemsTxt + 0x80, 0x20656369); // 'ice '
    const pIceItem = allocItemUnit(m, 0, 701);
    INVENTORY_SetCursorItem113c(m, pInv, pIceItem);

    ACT5Q3_Callback02_OnFrozenAnyaObjectActivate_6FC7CD50_113c(m, pOpArg, {
      deletePlayerQuestItem: () => {},
    });
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 1)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x25, 0x0d)).toBe(1);
  });

  it('6. ACT5Q3_InitQuestData_6FC7FC20_113c initializes quest 0x25 and allocates 0x114 state', () => {
    const { m } = createTestEnv();
    const pQuest = m.alloc(0x100);
    ACT5Q3_InitQuestData_6FC7FC20_113c(m, pQuest);
    expect(m.u32(pQuest + 0xa0)).toBe(0x6fc7da70);
    expect(m.u32(pQuest + 0xe0)).toBe(0x25);
    expect(m.u32(pQuest + 0x10)).toBe(0x22);
    expect(m.u32(pQuest + 0x18)).toBeGreaterThan(0);
  });

  it('7. ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c progresses Cairn stones 1..5', () => {
    const { m, pItemsTxt, pGame, pQuestCtrl, pPlayer, pQuestFlags, pInv } = createTestEnv();
    const pQuest = m.alloc(0x100);
    m.setU32(pQuest, 4);
    m.setU32(pQuest + 0x04, pGame);
    ACT1Q4_InitQuestData_6FC887D0_113c(m, pQuest);
    m.setU8(pQuest + 0x09, 1);
    m.setU32(pQuestCtrl, pQuest);
    const pState = m.u32(pQuest + 0x18);
    m.setU8(pState + 0x4a, 1);
    for (let i = 0; i < 5; i++) {
      m.setU16(pState + i * 2, 17 + i);
    }

    m.setU32(pItemsTxt + 0x80, 0x20646b62); // 'bkd '
    const pScroll = allocItemUnit(m, 0, 702);
    INVENTORY_SetCursorItem113c(m, pInv, pScroll);

    const pRoom = m.alloc(0x80);
    m.setU32(pRoom + 0x2c, m.alloc(4));
    const pOpArg = m.alloc(0x20);
    m.setU32(pOpArg, pGame);
    m.setU32(pOpArg + 0x08, pPlayer);

    for (let i = 0; i < 5; i++) {
      const pStone = m.alloc(0x100);
      m.setU32(pStone, 2);
      m.setU32(pStone + 0x04, 17 + i);
      m.setU32(pStone + 0x0c, 300 + i);
      const pStonePath = m.alloc(0x40);
      m.setU32(pStonePath, pRoom);
      m.setU32(pStonePath + 0x0c, 50 + i);
      m.setU32(pStonePath + 0x10, 60 + i);
      m.setU32(pStone + 0x2c, pStonePath);
      m.setU32(pOpArg + 0x04, pStone);
      m.setU16(pOpArg + 0x10, 17 + i);
      ACT1Q4_Callback02_OnCairnStoneActivate_6FC864F0_113c(m, pOpArg, {
        deletePlayerQuestItem: () => {},
      });
    }
    expect(m.u16(pState + 0x0c)).toBe(5);
    expect(m.u8(pState + 0x4f)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 4, 4)).toBe(1);
  });

  it('8. ACT1Q5_InitQuestData_6FC87210_113c initializes quest 3 and allocates 0xA4 state', () => {
    const { m } = createTestEnv();
    const pQuest = m.alloc(0x100);
    ACT1Q5_InitQuestData_6FC87210_113c(m, pQuest);
    expect(m.u32(pQuest + 0xa0)).toBe(0x6fc81c60);
    expect(m.u32(pQuest + 0xe0)).toBe(3);
    expect(m.u32(pQuest + 0x18)).toBeGreaterThan(0);
  });

  it('9. ACT1Q4_InitQuestData_6FC887D0_113c initializes quest 4 and allocates 0x1BC state', () => {
    const { m } = createTestEnv();
    const pQuest = m.alloc(0x100);
    ACT1Q4_InitQuestData_6FC887D0_113c(m, pQuest);
    expect(m.u32(pQuest + 0xa0)).toBe(0x6fc86960);
    expect(m.u32(pQuest + 0xe0)).toBe(4);
    expect(m.u32(pQuest + 0x18)).toBeGreaterThan(0);
  });

  it('10. ACT1Q2_InitQuestData_6FC89130_113c initializes quest 2 and allocates 0x0C state', () => {
    const { m } = createTestEnv();
    const pQuest = m.alloc(0x100);
    ACT1Q2_InitQuestData_6FC89130_113c(m, pQuest);
    expect(m.u32(pQuest + 0xa0)).toBe(0x6fc81f50);
    expect(m.u32(pQuest + 0xe0)).toBe(2);
    expect(m.u32(pQuest + 0x18)).toBeGreaterThan(0);
  });

  it('11. OBJ_OperateDuranceStairs_6FC8CD40_113c checks quest 0x16 and warps player', () => {
    const { m, pGame, pPlayer, pQuestFlags } = createTestEnv();
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x16, 0);

    const pRoom = m.alloc(0x80);
    const pRoomEx = m.alloc(0x80);
    const pLevel = m.alloc(0x200);
    m.setU32(pLevel + 0x1d0, 0x65);
    m.setU32(pRoomEx + 0x58, pLevel);
    m.setU32(pRoom + 0x10, pRoomEx);

    const pObject = m.alloc(0x100);
    m.setU32(pObject, 2);
    m.setU32(pObject + 0x10, 2);
    const pObjPath = m.alloc(0x20);
    m.setU32(pObjPath, pRoom);
    m.setU32(pObject + 0x2c, pObjPath);

    const pOpArg = m.alloc(0x20);
    m.setU32(pOpArg, pGame);
    m.setU32(pOpArg + 0x04, pObject);
    m.setU32(pOpArg + 0x08, pPlayer);

    let warpCalled = false;
    const rc = OBJ_OperateDuranceStairs_6FC8CD40_113c(m, pOpArg, {
      operateStairsWarp: () => {
        warpCalled = true;
        return 1;
      },
    });
    expect(rc).toBe(0);
    expect(warpCalled).toBe(true);
  });

  it('12. PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c handles sub-actions 0x17 and 0x18', () => {
    const { m, pGame, pPlayer } = createTestEnv();
    m.setU8(pPlayer + 0x6c, 1);
    m.setU32(pPlayer + 0x68, 4);
    PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c(m, pPlayer, 0x17, pGame);
    expect(m.u32(pPlayer + 0x64)).toBe(0xffffffff);
    expect(m.u32(pPlayer + 0x68)).toBe(6);
    expect(m.u8(pPlayer + 0x6c)).toBe(0);

    let sub18Called = false;
    PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c(m, pPlayer, 0x18, pGame, {
      handleTradeSubAction18: () => {
        sub18Called = true;
      },
    });
    expect(sub18Called).toBe(true);
  });

  it('13. PLAYER_CreateCorpseOnDeath_6FC99210_113c drops equipment when corpse limit > 15', () => {
    const { m, pGame, pPlayer, pInv } = createTestEnv();
    for (let i = 0; i < 16; i++) {
      const corpseGuid = i + 1;
      INVENTORY_AllocCorpse113c(m, pInv, corpseGuid, 0, 1);
      const pCorpseUnit = m.alloc(0x100);
      m.setU32(pCorpseUnit + 0x0c, corpseGuid);
      const bucketIdx = corpseGuid & 0x7f;
      m.setU32(pCorpseUnit + 0xe4, m.u32(pGame + 0x1120 + bucketIdx * 4));
      m.setU32(pGame + 0x1120 + bucketIdx * 4, pCorpseUnit);
    }

    let dropAllCalled = false;
    const rc = PLAYER_CreateCorpseOnDeath_6FC99210_113c(m, pPlayer, pGame, {
      dropAllPlayerEquipmentAndGold: () => {
        dropAllCalled = true;
      },
    });
    expect(rc).toBe(0);
    expect(dropAllCalled).toBe(true);
  });

  it('14. SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c spawns monster from Skills.txt', () => {
    const { m, pGame, pPlayer, pSkillsTxt } = createTestEnv();
    m.setU16(pSkillsTxt + 5 * 0x23c + 0x3c, 42);
    const pPath = m.alloc(0x80);
    m.setU16(pPath + 0x10, 120);
    m.setU16(pPath + 0x12, 130);
    m.setU32(pPlayer + 0x2c, pPath);

    let spawnedHcIdx = -1;
    const rc = SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c(m, 5, pPlayer, pGame, {
      spawnSkillMonsterFromParams: (_mem, _u, _g, pParams) => {
        spawnedHcIdx = m.u32(pParams + 0x04) | 0;
        return m.alloc(0x100);
      },
    });
    expect(rc).toBe(1);
    expect(spawnedHcIdx).toBe(42);
  });

  it('15. SKILLS_SrvDo_SummonPetWithAiInit_6FCB6310_113c spawns pet, copies level stat, and schedules event 2', () => {
    const { m, pGame, pPlayer, pSkillsTxt } = createTestEnv();
    m.setU16(pSkillsTxt + 6 * 0x23c + 0x3c, 55);
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 24, 0);
    const pPath = m.alloc(0x80);
    m.setU16(pPath + 0x10, 140);
    m.setU16(pPath + 0x12, 150);
    m.setU32(pPlayer + 0x2c, pPath);

    let pCreatedPet = 0;
    const rc = SKILLS_SrvDo_SummonPetWithAiInit_6FCB6310_113c(m, pGame, pPlayer, 6, 5, {
      spawnSkillMonsterFromParams: () => {
        pCreatedPet = m.alloc(0x100);
        m.setU32(pCreatedPet, 1);
        m.setU32(pCreatedPet + 0x0c, 808);
        STATLIST_CreateEx113c(m, pCreatedPet, 0, pGame);
        const pMonData = m.alloc(0x60);
        const pAiGen = m.alloc(0x48);
        m.setU32(pMonData + 0x34, pAiGen);
        m.setU32(pCreatedPet + 0x14, pMonData);
        return pCreatedPet;
      },
    });
    expect(rc).toBe(1);
    expect(STATLIST_GetUnitStat113c(m, pCreatedPet, 0x0c, 0)).toBe(24);
    expect(m.u32(pCreatedPet + 0xdc)).toBeGreaterThan(0);
  });

  it('16. ACT4Q2_InitQuestData_6FCDAD40_113c initializes quest 0x1B and allocates 0x20 state', () => {
    const { m } = createTestEnv();
    const pQuest = m.alloc(0x100);
    ACT4Q2_InitQuestData_6FCDAD40_113c(m, pQuest);
    expect(m.u32(pQuest + 0xa0)).toBe(0x6fcd8ce0);
    expect(m.u32(pQuest + 0xe0)).toBe(0x1b);
    expect(m.u32(pQuest + 0x10)).toBe(0x17);
    expect(m.u32(pQuest + 0x18)).toBeGreaterThan(0);
  });

  it('17. ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c completes quest 0x1B when player is in Act 4', () => {
    const { m, pLevelsTxt, pGame, pQuestCtrl, pPlayer, pQuestFlags } = createTestEnv();
    m.setU8(pLevelsTxt + 103 * 0x220 + 0x02, 3);

    const pRoom = m.alloc(0x100);
    const pRoomEx = m.alloc(0x100);
    const pLevel = m.alloc(0x200);
    m.setU32(pLevel + 0x1bc, 103);
    m.setU32(pLevel + 0x1d0, 103);
    m.setU32(pRoomEx + 0x58, pLevel);
    m.setU32(pRoom + 0x10, pRoomEx);
    const pPath = m.alloc(0x80);
    m.setU32(pPath + 0x1c, pRoom);
    m.setU32(pPlayer + 0x2c, pPath);

    const pQuest18 = m.alloc(0x100);
    m.setU32(pQuest18, 0x18);
    m.setU32(pQuest18 + 0x04, pGame);
    const pState18 = m.alloc(0x40);
    m.setU32(pQuest18 + 0x18, pState18);
    m.setU32(pQuestCtrl, pQuest18);

    ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c(m, pGame, pPlayer);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 1)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x1b, 0x0d)).toBe(1);
    expect(m.u32(pState18 + 0x14)).toBe(1);
  });

  it('18. NPCS_BeginVendorOrGambleInteract_6FCDF730_113c opens vendor or gamble inventory', () => {
    const { m, pGame, pPlayer } = createTestEnv();
    const pNpcCtrl = m.alloc(0x40);
    const pSlots = m.alloc(0x40 * 0x44);
    m.setU32(pNpcCtrl + 0x04, pSlots);
    m.setU32(pSlots, 0x96);
    m.setU32(pSlots + 0x0c, 1);
    m.setU32(pGame + 0x1d24, pNpcCtrl);

    const pNpc = m.alloc(0x100);
    m.setU32(pNpc, 1);
    m.setU32(pNpc + 0x04, 0x96);

    let gambleCalled = false;
    NPCS_BeginVendorOrGambleInteract_6FCDF730_113c(m, pPlayer, pNpc, pGame, 1, {
      openGambleInventory: () => {
        gambleCalled = true;
      },
    });
    expect(gambleCalled).toBe(true);
  });

  it('19. ACT2Q2_OnNpcSpeechComplete_6FCE7DC0_113c sets quest 0x0A state bits on Cain messages 0x14F..0x153', () => {
    const { m, pGame, pPlayer, pQuestFlags } = createTestEnv();
    const pQuest = m.alloc(0x100);
    m.setU32(pQuest, 0x0a);
    m.setU32(pQuest + 0x04, pGame);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);
    m.setU16(pQuestArg + 0x14, 0xf4);
    m.setU16(pQuestArg + 0x18, 0x14f);

    ACT2Q2_OnNpcSpeechComplete_6FCE7DC0_113c(m, pQuest, pQuestArg);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 3)).toBe(1);

    m.setU16(pQuestArg + 0x18, 0x151);
    ACT2Q2_OnNpcSpeechComplete_6FCE7DC0_113c(m, pQuest, pQuestArg);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 5)).toBe(1);
  });

  it('20. ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c handles Meshif (0xD2, 0x1C2) and town messages', () => {
    const { m, pGame, pQuestCtrl, pPlayer, pQuestFlags } = createTestEnv();
    const pQuest = m.alloc(0x100);
    m.setU32(pQuest, 0x0d);
    m.setU32(pQuest + 0x04, pGame);
    const pState = m.alloc(0x80);
    m.setU32(pQuest + 0x18, pState);
    m.setU32(pQuestCtrl, pQuest);

    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0e, 4);
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x0e, 0x0d);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);
    m.setU16(pQuestArg + 0x14, 0xd2);
    m.setU16(pQuestArg + 0x18, 0x1c2);

    ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c(m, pQuest, pQuestArg);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 0)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0e, 4)).toBe(0);
    expect(m.u8(pQuest + 0x0b)).toBe(0x0d);
    expect(m.u8(pQuest + 0x0c)).toBe(5);
  });

  it('21. ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c completes quest 0x0A and activates quest 0x0D timer', () => {
    const { m, pGame, pQuestCtrl, pPlayer, pQuestFlags } = createTestEnv();
    const pQuest0D = m.alloc(0x100);
    m.setU32(pQuest0D, 0x0d);
    m.setU32(pQuest0D + 0x04, pGame);
    const pState0D = m.alloc(0x40);
    m.setU32(pQuest0D + 0x18, pState0D);
    m.setU32(pQuestCtrl, pQuest0D);

    ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c(m, pGame, pPlayer);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x0a, 0x0d)).toBe(1);
    expect(m.u8(pState0D + 0x0d)).toBe(1);
    expect(m.u8(pState0D + 0x0e)).toBe(1);
    expect(m.u8(pState0D + 0x03)).toBe(1);
    expect(m.u32(pQuestCtrl + 0x10)).toBeGreaterThan(0);
  });

  it('22. C2S_Packet_NpcBuyItem_6FCEF220_113c validates 0x11 length and unpacks fields', () => {
    const { m, pGame, pPlayer } = createTestEnv();
    const pPkt = m.alloc(0x20);
    expect(C2S_Packet_NpcBuyItem_6FCEF220_113c(m, pGame, pPlayer, pPkt, 5)).toBe(3);

    m.setU32(pPkt + 0x01, 11);
    m.setU32(pPkt + 0x05, 22);
    m.setU32(pPkt + 0x09, 3);
    m.setU16(pPkt + 0x0d, 500);
    let boughtCost = 0;
    const rc = C2S_Packet_NpcBuyItem_6FCEF220_113c(m, pGame, pPlayer, pPkt, 0x11, {
      npcBuyItemImpl: (_mem, _p, _g, _npc, _item, _tab, wCost) => {
        boughtCost = wCost;
      },
    });
    expect(rc).toBe(0);
    expect(boughtCost).toBe(500);
  });

  it('23. C2S_Packet_DropCursorItem_6FCEF380_113c validates length 5 and drops cursor item', () => {
    const { m, pGame, pPlayer, pInv } = createTestEnv();
    const pPkt = m.alloc(0x10);
    expect(C2S_Packet_DropCursorItem_6FCEF380_113c(m, pGame, pPlayer, pPkt, 4)).toBe(3);

    const pItem = allocItemUnit(m, 0, 999);
    m.setU32(pItem + 0x10, 4);
    INVENTORY_SetCursorItem113c(m, pInv, pItem);
    const bucketIdx = 999 & 0x7f;
    m.setU32(pGame + 0x1720 + bucketIdx * 4, pItem);
    m.setU32(pPkt + 0x01, 999);

    let droppedItem = 0;
    const rc = C2S_Packet_DropCursorItem_6FCEF380_113c(m, pGame, pPlayer, pPkt, 5, {
      dropItemAtPlayer: (_mem, _g, _p, it) => {
        droppedItem = it;
        return 1;
      },
    });
    expect(rc).toBe(0);
    expect(droppedItem).toBe(pItem);
  });

  it('24. C2S_Packet_HireMercenary_6FCF0060_113c validates length 9 and forwards wMercId', () => {
    const { m, pGame, pPlayer } = createTestEnv();
    const pPkt = m.alloc(0x10);
    expect(C2S_Packet_HireMercenary_6FCF0060_113c(m, pGame, pPlayer, pPkt, 4)).toBe(3);

    m.setU16(pPkt + 0x05, 7);
    let hiredId = -1;
    const rc = C2S_Packet_HireMercenary_6FCF0060_113c(m, pGame, pPlayer, pPkt, 9, {
      hireMercenaryImpl: (_mem, _g, _p, id) => {
        hiredId = id;
      },
    });
    expect(rc).toBe(0);
    expect(hiredId).toBe(7);
  });

  it('25. ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c rejects non-transmutable or null items', () => {
    const { m, pGame, pPlayer } = createTestEnv();
    expect(ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c(m, 0, pPlayer, 0)).toBe(0);
    const pItem = allocItemUnit(m, 0, 777);
    expect(ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c(m, pGame, pPlayer, pItem)).toBe(0);
  });

  it('26. ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c sets quest state on Ormus (0xFF, 0x252)', () => {
    const { m, pGame, pQuestCtrl, pPlayer } = createTestEnv();
    const pQuest = m.alloc(0x100);
    m.setU32(pQuest, 0x13);
    m.setU32(pQuest + 0x04, pGame);
    const pState = m.alloc(0x40);
    m.setU32(pQuest + 0x18, pState);
    m.setU32(pQuestCtrl, pQuest);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);
    m.setU16(pQuestArg + 0x14, 0xff);
    m.setU16(pQuestArg + 0x18, 0x252);

    ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c(m, pQuest, pQuestArg);
    expect(m.u8(pQuest + 0x0c)).toBe(3);
    expect(m.u8(pState + 0x04)).toBe(1);
  });

  it('27. ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c handles Cain and Alkor Golden Bird speech', () => {
    const { m, pGame, pQuestCtrl, pPlayer, pQuestFlags } = createTestEnv();
    const pQuest = m.alloc(0x100);
    m.setU32(pQuest, 0x12);
    m.setU32(pQuest + 0x04, pGame);
    const pState = m.alloc(0x40);
    m.setU32(pQuest + 0x18, pState);
    m.setU32(pQuestCtrl, pQuest);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);
    m.setU16(pQuestArg + 0x14, 0xf5);
    m.setU16(pQuestArg + 0x18, 0x20f);

    ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c(m, pQuest, pQuestArg);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x14, 2)).toBe(1);
    expect(m.u32(pState + 0x18)).toBe(2);
  });

  it('28. ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c sets quest state on Alkor (0xFE, 0x225)', () => {
    const { m, pGame, pQuestCtrl, pPlayer } = createTestEnv();
    const pQuest = m.alloc(0x100);
    m.setU32(pQuest, 0x0f);
    m.setU32(pQuest + 0x04, pGame);
    const pState = m.alloc(0x40);
    m.setU32(pQuest + 0x18, pState);
    m.setU32(pQuestCtrl, pQuest);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);
    m.setU16(pQuestArg + 0x14, 0xfe);
    m.setU16(pQuestArg + 0x18, 0x225);

    ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c(m, pQuest, pQuestArg);
    expect(m.u8(pQuest + 0x0c)).toBe(2);
    expect(m.u8(pQuest + 0x0b)).toBe(1);
  });

  it('29. ACT3Q2_OnNpcSpeechComplete_6FD09600_113c handles Hratli (0xFD, 0x23B) and Asheara (0xFC, 0x24D)', () => {
    const { m, pGame, pQuestCtrl, pPlayer, pQuestFlags } = createTestEnv();
    const pQuest = m.alloc(0x100);
    m.setU32(pQuest, 0x11);
    m.setU32(pQuest + 0x04, pGame);
    const pState = m.alloc(0x40);
    m.setU32(pQuest + 0x18, pState);
    m.setU32(pQuestCtrl, pQuest);

    const pQuestArg = m.alloc(0x20);
    m.setU32(pQuestArg, pGame);
    m.setU32(pQuestArg + 0x0c, pPlayer);
    m.setU16(pQuestArg + 0x14, 0xfc);
    m.setU16(pQuestArg + 0x18, 0x24d);

    let freeMercSeller = -1;
    ACT3Q2_OnNpcSpeechComplete_6FD09600_113c(m, pQuest, pQuestArg, {
      hireAct3FreeMercenary: (_mem, _g, _p, sellerClassId) => {
        freeMercSeller = sellerClassId;
      },
    });
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x13, 7)).toBe(1);
    expect(freeMercSeller).toBe(0xfc);
  });

  it('30. ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c increments orb hit count to 2 when wielding Khalim Will (qf2)', () => {
    const { m, pItemsTxt, pGame, pQuestCtrl, pPlayer, pQuestFlags, pInv } = createTestEnv();
    m.setU32(pGame + 0x1d2c, m.alloc(0x20));
    const pQuest = m.alloc(0x100);
    m.setU32(pQuest, 0x13);
    m.setU32(pQuest + 0x04, pGame);
    m.setU32(pQuest + 0xf0, 0x6fd02a40);
    const pState = m.alloc(0x60);
    m.setU32(pQuest + 0x18, pState);
    m.setU32(pQuestCtrl, pQuest);

    m.setU32(pItemsTxt + 0x80, 0x20326671); // 'qf2 '
    m.setU16(pItemsTxt + 0x11e, 45); // weapon type
    const pWeapon = allocItemUnit(m, 0, 888);
    INVENTORY_PlaceItemInBodyLoc113c(m, pInv, pWeapon, 4);
    m.setU32(pInv + 0x1c, 888);

    const pOrb = m.alloc(0x100);
    m.setU32(pOrb, 2);
    m.setU32(pOrb + 0x2c, m.alloc(0x20));
    const pOpArg = m.alloc(0x20);
    m.setU32(pOpArg, pGame);
    m.setU32(pOpArg + 0x04, pOrb);
    m.setU32(pOpArg + 0x08, pPlayer);

    ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c(m, pOpArg, {
      deleteAllPlayerQuestItems: () => 1,
    });
    expect(m.u32(pState + 0x38) | 0).toBe(1);

    ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c(m, pOpArg, {
      deleteAllPlayerQuestItems: () => 1,
    });
    expect(m.u32(pState + 0x38) | 0).toBe(2);
    expect(m.u8(pState + 0x0c)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 0)).toBe(1);
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x12, 0x0d)).toBe(1);
  });
});
