import { describe, expect, it } from 'vitest';
import {
  D2Game_6FC3E3D0_113c,
  D2Game_6FC3E640_113c,
  D2Game_6FC56470_113c,
  D2Game_6FC565E0_113c,
  D2Game_6FC7D690_113c,
  D2Game_6FC7DF70_113c,
  D2Game_6FC7E2A0_113c,
  D2Game_6FC8D620_113c,
  D2Game_6FC8E930_113c,
  D2Game_6FC8F4F0_113c,
  D2Game_6FC91E10_113c,
  D2Game_6FC92220_113c,
  D2Game_6FC93570_113c,
  D2Game_6FC93AA0_113c,
  D2Game_6FC93BA0_113c,
  D2Game_6FC98D00_113c,
  D2Game_6FCC3610_113c,
  D2Game_6FCCA4D0_113c,
  D2Game_6FCCA710_113c,
  D2Game_6FCCAC30_113c,
  D2Game_6FCCB070_113c,
  D2Game_6FCCB360_113c,
  D2Game_6FCCB580_113c,
  D2Game_6FCCC410_113c,
  D2Game_6FCDB4F0_113c,
  D2Game_6FCDE2A0_113c,
  D2Game_6FCDE640_113c,
  D2Game_6FCDEE30_113c,
  D2Game_6FCDF990_113c,
  D2Game_6FCE1030_113c,
  D2Game_6FCE1510_113c,
  D2Game_6FCEF0E0_113c,
  D2Game_6FCEF810_113c,
  D2Game_6FCF08B0_113c,
  D2Game_6FCF0910_113c,
  D2Game_6FCF12E0_113c,
  D2Game_6FCF7300_113c,
  D2Game_6FCF78C0_113c,
  D2Game_6FCF7CC0_113c,
  D2Game_6FCF8020_113c,
  D2Game_6FCF8600_113c,
  D2Game_6FD08EB0_113c,
  D2Game_6FD08F30_113c,
  D2Game_6FD095E0_113c,
} from '../../../src/d2kern-113c/game/k2-w13b1-113c';
import { INVENTORY_SetCursorItem113c } from '../../../src/d2kern-113c/common/inventory';
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c';
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory';

function createTestMem(): {
  m: SparseMemory113c;
  pDataTables: number;
  pObjectsBase: number;
  pMonStatsBase: number;
  pItemsTxtBase: number;
} {
  const m = new SparseMemory113c();
  const pDataTablesPtr = 0x100000;
  const pDataTables = 0x100100;
  const pSkillsBase = 0x110000;
  const pObjectsBase = 0x120000;
  const pMonStatsBase = 0x140000;
  const pStatCostBase = 0x150000;
  const pItemsTxtBase = 0x160000;
  const pItemsLinker = 0x170000;
  const pExpBin = 0x178000;
  const pBitMasks = 0x180000;
  const pInvBitMasks = 0x180200;

  m.fill(0x100000, 0x90000, 0);
  m.fill(0x200000, 0x80000, 0);
  m.fill(0x6fd18000, 0x1c000, 0);
  m.fill(0x6fdd8000, 0x1c000, 0);
  m.fill(0x7ef00000, 0x2c0000, 0);
  m.fill(0x7fd70000, 0x280000, 0);

  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pDataTablesPtr);
  m.setU32(0x6fd1829c, pDataTablesPtr);
  m.setU32(0x6fd270b0, pDataTablesPtr);
  m.setU32(pDataTablesPtr, pDataTables);
  m.setU32(0x6fde9e1c, pDataTables);

  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pBitMasks);
  m.setU32(0x6fd182a4, pBitMasks);
  m.setU32(0x6fd18be0, pBitMasks);
  m.setU32(0x6fd27060, pBitMasks);
  m.setU32(0x6fdd90b0, pBitMasks);
  m.setU32(0x6fd18bac, pInvBitMasks);
  for (let i = 0; i < 32; i++) {
    const bit = (1 << i) >>> 0;
    m.setU32(pBitMasks + i * 4, bit);
    m.setU32(pInvBitMasks + i * 4, ~bit >>> 0);
  }

  for (let c = 0; c < 8; c++) {
    m.setU32(pExpBin + c * 4, 99);
  }
  m.setU32(0x6fdf0b50, pExpBin);
  m.setU32(0x6fd18d10, 1000);
  m.setU32(0x6fdf0b54, pObjectsBase);
  m.setU32(0x6fdf0b58, 64);
  m.setU32(0x6fdf0b94, pObjectsBase);
  m.setU32(0x6fdf0b98, 64);
  m.setU32(0x6fdefb94, 16);
  m.setU32(0x6fdefb98, pItemsTxtBase);
  m.setU32(0x6fdeff6c, pItemsLinker);
  m.setU32(0x6fd27bb8 + 4, 0x6fc8cf90);

  m.setU32(pDataTables + 0x9c, pObjectsBase);
  m.setU32(pDataTables + 0xa4, 64);
  m.setU32(pDataTables + 0xa78, pMonStatsBase);
  m.setU32(pDataTables + 0xa80, 64);
  m.setU32(pDataTables + 0xb90, pSkillsBase);
  m.setU32(pDataTables + 0xb98, pSkillsBase);
  m.setU32(pDataTables + 0xba0, 256);
  m.setU32(pDataTables + 0xbcc, pStatCostBase);
  m.setU32(pDataTables + 0xbd4, 512);

  EVENT_InitTimerQueue113c(m, 0x200000);

  return { m, pDataTables, pObjectsBase, pMonStatsBase, pItemsTxtBase };
}

describe('K2 Wave 13 Batch 1 (44 D2Game VAs 0x6FC3E3D0..0x6FD095E0)', () => {
  it('1..5: Pet/Merc AI thinkers, quest item spawn/remove, and Act 5 Q35 object operate (0x6FC3E3D0..0x6FC7D690)', () => {
    const { m, pMonStatsBase } = createTestMem();
    const pGame = 0x200000;
    const pOwner = 0x208000;
    const pPlrData = 0x208800;
    const pUnit = 0x210000;
    const pMonData = 0x210400;
    const pAiGen = 0x210800;
    const pAiControl = 0x210c00;
    const pAiTickArgs = 0x220000;
    const pOwnerPath = 0x208400;
    const pUnitPath = 0x211000;

    m.setU32(pOwner, 0);
    m.setU32(pOwner + 0x0c, 77);
    m.setU32(pOwner + 0x14, pPlrData);
    m.setU32(pOwner + 0x2c, pOwnerPath);
    m.setU16(pOwnerPath + 0x02, 100);
    m.setU16(pOwnerPath + 0x06, 100);
    m.setU32(pOwnerPath + 0x30, pOwner);
    m.setU32(pGame + 0x1120 + ((77 & 0x7f) << 2), pOwner);

    m.setU32(pUnit, 1);
    m.setU32(pUnit + 0x14, pMonData);
    m.setU32(pUnit + 0x2c, pUnitPath);
    m.setU16(pUnitPath + 0x02, 102);
    m.setU16(pUnitPath + 0x06, 102);
    m.setU32(pUnitPath + 0x30, pUnit);
    m.setU32(pMonData + 0x28, pAiGen);
    m.setU32(pMonData + 0x2c, pAiControl);
    m.setU32(pAiGen + 0x28, pGame);
    m.setU32(pAiGen + 0x2c, 77);
    m.setU32(pAiGen + 0x30, 0);

    m.setU32(pAiTickArgs, pAiControl);
    m.setU32(pAiTickArgs + 0x1c, pMonStatsBase);

    // [1/44] 0x6FC3E3D0
    D2Game_6FC3E3D0_113c(m, pAiTickArgs, pUnit, pGame);
    expect(m.u32(pAiControl + 0x1c)).toBe(77);

    // [2/44] 0x6FC3E640
    m.setU32(pAiControl + 0x1c, 0);
    D2Game_6FC3E640_113c(m, pUnit, pAiTickArgs, pGame);
    expect(m.u32(pAiControl + 0x1c)).toBe(77);

    // [3/44] 0x6FC56470 (unmatched item code returns 0)
    expect(D2Game_6FC56470_113c(m, 10, 0x20787878, pOwner, pGame, 2, 0)).toBe(0);

    // [4/44] 0x6FC565E0 (cursor mode 4 clears cursor item on inventory)
    const pInv = 0x214000;
    const pCursorItem = 0x215000;
    const pCursorItemData = 0x215400;
    const pCursorItemPath = 0x215800;
    m.setU32(pOwner + 0x60, pInv);
    m.setU32(pInv, 0x01020304);
    m.setU32(pCursorItem, 4);
    m.setU32(pCursorItem + 0x0c, 501);
    m.setU32(pCursorItem + 0x10, 4);
    m.setU32(pCursorItem + 0x14, pCursorItemData);
    m.setU32(pCursorItem + 0x2c, pCursorItemPath);
    INVENTORY_SetCursorItem113c(m, pInv, pCursorItem);
    D2Game_6FC565E0_113c(m, pCursorItem, pOwner, pGame, pInv);
    expect(m.u32(pInv + 0x20)).toBe(0);

    // [5/44] 0x6FC7D690 (Quest 0x23 object mode 0 transitions anim mode to 1 and sets +0x60 = 2)
    const pQuestCtrl = 0x230000;
    const pQuest23 = 0x230200;
    const pQData23 = 0x230400;
    const pObj = 0x231000;
    const pObjPath = 0x231400;
    const pObjInteract = 0x232000;
    m.setU32(pGame + 0x10f4, pQuestCtrl);
    m.setU32(pQuestCtrl, pQuest23);
    m.setU32(pQuest23, 0x23);
    m.setU32(pQuest23 + 0x18, pQData23);
    m.setU8(pQData23, 0);
    m.setU32(pObj, 2);
    m.setU32(pObj + 0x10, 0);
    m.setU32(pObj + 0x2c, pObjPath);
    m.setU32(pObjInteract, pGame);
    m.setU32(pObjInteract + 0x04, pObj);
    m.setU32(pObjInteract + 0x08, pOwner);
    expect(D2Game_6FC7D690_113c(m, pObjInteract)).toBe(0);
    expect(m.u32(pObj + 0x10)).toBe(1);
    expect(m.u32(pQData23 + 0x60)).toBe(2);
  });

  it('6..10: Object operate handlers and Waypoint travel (0x6FC7DF70..0x6FC8F4F0)', () => {
    const { m, pObjectsBase } = createTestMem();
    const pGame = 0x200000;
    const pPlayer = 0x210000;
    const pPlrData = 0x210400;
    const pQuestFlags = 0x210800;
    const pQuestBits = 0x210840;
    const pQuestCtrl = 0x230000;
    const pQuest23 = 0x230200;
    const pQuest24 = 0x230400;
    const pQData23 = 0x230600;
    const pQData24 = 0x230800;
    const pObj = 0x240000;
    const pObjData = 0x240200;
    const pObjPath = 0x240400;
    const pObjInteract = 0x250000;

    m.setU32(pPlayer, 0);
    m.setU32(pPlayer + 0x14, pPlrData);
    m.setU32(pPlrData + 0x10, pQuestFlags);
    m.setU32(pQuestFlags, pQuestBits);

    m.setU32(pGame + 0x10f4, pQuestCtrl);
    m.setU32(pQuestCtrl, pQuest23);
    m.setU32(pQuest23, 0x23);
    m.setU32(pQuest23 + 0x18, pQData23);
    m.setU32(pQuest23 + 0xe0, 0x23);
    m.setU32(pQuest23 + 0xf4, pQuest24);
    m.setU32(pQuest24, 0x24);
    m.setU32(pQuest24 + 0x18, pQData24);

    m.setU32(pObj, 2);
    m.setU32(pObj + 0x04, 1);
    m.setU32(pObj + 0x0c, 42);
    m.setU32(pObj + 0x10, 0);
    m.setU32(pObj + 0x14, pObjData);
    m.setU32(pObj + 0x2c, pObjPath);
    m.setU32(pObjData, pObjectsBase + 0x1c0);
    m.setU8(pObjectsBase + 0x1c0 + 0x1b3, 1);

    m.setU32(pObjInteract, pGame);
    m.setU32(pObjInteract + 0x04, pObj);
    m.setU32(pObjInteract + 0x08, pPlayer);
    m.setU32(pObjInteract + 0x10, 1);

    // [6/44] 0x6FC7DF70
    expect(D2Game_6FC7DF70_113c(m, pObjInteract)).toBe(0);

    // [7/44] 0x6FC7E2A0
    expect(D2Game_6FC7E2A0_113c(m, pObjInteract)).toBe(0);

    // [8/44] 0x6FC8D620 (mode 0 -> transitions object anim mode to 1)
    expect(D2Game_6FC8D620_113c(m, pObjInteract)).toBe(0);
    expect(m.u32(pObj + 0x10)).toBe(1);

    // [9/44] 0x6FC8E930 (valid waypoint clears player interaction fields when destLevelId === 0)
    m.setU32(pGame + 0x1520 + ((42 & 0x7f) << 2), pObj);
    m.setU32(pPlayer + 0x64, 42);
    m.setU32(pPlayer + 0x68, 2);
    m.setU8(pPlayer + 0x6c, 1);
    D2Game_6FC8E930_113c(m, 42, pGame, pPlayer, 0);
    expect(m.u32(pPlayer + 0x64)).toBe(0xffffffff);
    expect(m.u32(pPlayer + 0x68)).toBe(6);
    expect(m.u8(pPlayer + 0x6c)).toBe(0);

    // [10/44] 0x6FC8F4F0 (mode !== 2 returns 0)
    expect(D2Game_6FC8F4F0_113c(m, pObjInteract)).toBe(0);
  });

  it('11..16: Player trade, Horadric Cube transmutation, and cursor item swap (0x6FC91E10..0x6FC98D00)', () => {
    const { m } = createTestMem();
    const pGame = 0x200000;
    const pPlayer1 = 0x210000;
    const pPlayer2 = 0x214000;
    const pPData1 = 0x210400;
    const pPData2 = 0x214400;
    const pTrade1 = 0x210800;
    const pTrade2 = 0x214800;
    const pInv1 = 0x211000;
    const pInv2 = 0x215000;
    const pClient1 = 0x212000;
    const pClient2 = 0x216000;

    m.setU32(pPlayer1, 0);
    m.setU32(pPlayer1 + 0x0c, 1);
    m.setU32(pPlayer1 + 0x14, pPData1);
    m.setU32(pPlayer1 + 0x60, pInv1);
    m.setU32(pPData1 + 0x5c, pTrade1);
    m.setU32(pPData1 + 0x9c, pClient1);
    m.setU32(pInv1, 0x01020304);

    m.setU32(pPlayer2, 0);
    m.setU32(pPlayer2 + 0x0c, 2);
    m.setU32(pPlayer2 + 0x14, pPData2);
    m.setU32(pPlayer2 + 0x60, pInv2);
    m.setU32(pPData2 + 0x5c, pTrade2);
    m.setU32(pPData2 + 0x9c, pClient2);
    m.setU32(pInv2, 0x01020304);

    // [11/44] 0x6FC91E10 (empty trade page succeeds with 1)
    expect(D2Game_6FC91E10_113c(m, pPlayer1, pGame, pPlayer2)).toBe(1);

    // [12/44] 0x6FC92220 (inactive cube recipe outputs return 0)
    const pCubeTxt = 0x220000;
    const pOutputArgs = 0x221000;
    expect(D2Game_6FC92220_113c(m, pGame, pPlayer1, pCubeTxt, pOutputArgs)).toBe(0);

    // [13/44] 0x6FC93570 (state 6 transitions trade state to 3 and clears +0xc8 mask)
    m.setU32(pPData1 + 0x50, 6);
    m.setU32(pPlayer1 + 0xc8, 0x00c00001);
    D2Game_6FC93570_113c(m, pGame, pPlayer1);
    expect(m.u32(pPData1 + 0x50)).toBe(3);
    expect(m.u32(pPlayer1 + 0xc8)).toBe(1);

    // [14/44] 0x6FC93AA0 (cancels trade interaction when partner is registered)
    m.setU32(pGame + 0x1120 + ((2 & 0x7f) << 2), pPlayer2);
    m.setU32(pPlayer1 + 0x64, 2);
    m.setU32(pPlayer1 + 0x68, 0);
    m.setU8(pPlayer1 + 0x6c, 1);
    D2Game_6FC93AA0_113c(m, pGame, pPlayer1);
    expect(m.u32(pPlayer1 + 0x64)).toBe(0xffffffff);
    expect(m.u32(pPlayer1 + 0x68)).toBe(6);
    expect(m.u8(pPlayer1 + 0x6c)).toBe(0);

    // [15/44] 0x6FC93BA0 (completes trade state 5 on both players)
    const pSnap1 = 0x210900;
    const pSnap2 = 0x214900;
    m.setU16(pSnap1, 0x4d4a);
    m.setU16(pSnap2, 0x4d4a);
    m.setU32(pTrade1 + 0x04, pSnap1);
    m.setU32(pTrade2 + 0x04, pSnap2);
    m.setU32(pTrade1 + 0x0c, 99);
    m.setU32(pTrade2 + 0x0c, 99);
    D2Game_6FC93BA0_113c(m, pPlayer1, pPlayer2, pGame, pPData1, pPData2);
    expect(m.u32(pPData1 + 0x50)).toBe(5);
    expect(m.u32(pPData2 + 0x50)).toBe(5);
    expect(m.u32(pTrade1 + 0x0c)).toBe(0);
    expect(m.u32(pTrade2 + 0x0c)).toBe(0);

    // [16/44] 0x6FC98D00 (replaces cursor item and updates item flags)
    const pItem = 0x225000;
    const pItemData = 0x225400;
    m.setU32(pItem, 4);
    m.setU32(pItem + 0x0c, 301);
    m.setU32(pItem + 0x14, pItemData);
    m.setU32(pItem + 0xc4, 2);
    INVENTORY_SetCursorItem113c(m, pInv1, pItem);
    D2Game_6FC98D00_113c(m, pPlayer1, pItem, pGame, 0);
    expect(m.u32(pInv1 + 0x20)).toBe(0);
    expect(m.u32(pItem + 0xc4) & 2).toBe(0);
  });

  it('17..24: Monster summon and pet/merc/shadow AI think routines (0x6FCC3610..0x6FCCC410)', () => {
    const { m, pMonStatsBase } = createTestMem();
    const pGame = 0x200000;
    const pOwner = 0x208000;
    const pOwnerPlrData = 0x208800;
    const pUnit = 0x210000;
    const pMonData = 0x210400;
    const pAiGen = 0x210800;
    const pAiControl = 0x210c00;
    const pAiTickParam = 0x220000;
    const pSpawnDesc = 0x230000;
    const pOwnerPath = 0x208400;
    const pUnitPath = 0x211000;

    m.setU32(pOwner, 0);
    m.setU32(pOwner + 0x0c, 88);
    m.setU32(pOwner + 0x14, pOwnerPlrData);
    m.setU32(pOwner + 0x2c, pOwnerPath);
    m.setU16(pOwnerPath + 0x02, 200);
    m.setU16(pOwnerPath + 0x06, 200);
    m.setU32(pOwnerPath + 0x30, pOwner);
    m.setU32(pGame + 0x1120 + ((88 & 0x7f) << 2), pOwner);

    // [17/44] 0x6FCC3610 (coords mode with unmapped room returns 0)
    m.setU8(pSpawnDesc, 1);
    m.setU32(pSpawnDesc + 0x04, pOwner);
    m.setU32(pSpawnDesc + 0x14, 50);
    m.setU32(pSpawnDesc + 0x18, 50);
    expect(D2Game_6FCC3610_113c(m, pSpawnDesc, pGame)).toBe(0);

    m.setU32(pUnit, 1);
    m.setU32(pUnit + 0x14, pMonData);
    m.setU32(pUnit + 0x2c, pUnitPath);
    m.setU16(pUnitPath + 0x02, 201);
    m.setU16(pUnitPath + 0x06, 201);
    m.setU32(pUnitPath + 0x30, pUnit);
    m.setU32(pMonData + 0x28, pAiGen);
    m.setU32(pMonData + 0x2c, pAiControl);
    m.setU32(pAiGen + 0x28, pGame);
    m.setU32(pAiGen + 0x2c, 88);
    m.setU32(pAiGen + 0x30, 0);

    m.setU16(pMonStatsBase + 0x170, 0xffff);
    m.setU16(pMonStatsBase + 0x172, 0xffff);
    m.setU16(pMonStatsBase + 0x68, 20);
    m.setU16(pMonStatsBase + 0x6e, 40);
    m.setU16(pMonStatsBase + 0x84, 10);

    m.setU32(pAiTickParam, pAiControl);
    m.setU32(pAiTickParam + 0x1c, pMonStatsBase);

    // [18/44] 0x6FCCA4D0
    D2Game_6FCCA4D0_113c(m, pGame, pUnit, pAiTickParam);

    // [19/44] 0x6FCCA710
    m.setU32(pAiControl + 0x1c, 0);
    D2Game_6FCCA710_113c(m, pUnit, pGame, 0, pAiTickParam);
    expect(m.u32(pAiControl + 0x1c)).toBe(88);

    // [20/44] 0x6FCCAC30
    m.setU32(pAiControl + 0x1c, 0);
    D2Game_6FCCAC30_113c(m, pAiTickParam, pUnit, pGame);
    expect(m.u32(pAiControl + 0x1c)).toBe(88);

    // [21/44] 0x6FCCB070
    D2Game_6FCCB070_113c(m, pGame, pUnit, pAiTickParam);

    // [22/44] 0x6FCCB360
    D2Game_6FCCB360_113c(m, pGame, pUnit, pAiTickParam);

    // [23/44] 0x6FCCB580 (with skill list attached, clears/stalls cleanly when target === 0)
    const pSkillList = 0x212000;
    m.setU32(pUnit + 0xa8, pSkillList);
    D2Game_6FCCB580_113c(m, pGame, pUnit, pAiTickParam);

    // [24/44] 0x6FCCC410 (decrements pAiControl + 0x18 counter and clamps < 0 to 0)
    m.setU32(pAiControl + 0x18, 5);
    m.setU16(pMonStatsBase + 0x68, 10);
    D2Game_6FCCC410_113c(m, pGame, pUnit, pAiTickParam);
    expect(m.u32(pAiControl + 0x18)).toBe(0);
  });

  it('25..31: Act 5 travel packet, NPC gamble/buy/shop/sell, and hireling vendor (0x6FCDB4F0..0x6FCE1510)', () => {
    const { m } = createTestMem();
    const pGame = 0x200000;
    const pArena = 0x205000;
    const pNpcCtrl = 0x206000;
    const pGambleIds = 0x206100;
    const pNpcTable = 0x206200;
    const pPlayer = 0x210000;
    const pPlrData = 0x210400;
    const pPlrPath = 0x210800;
    const pClient = 0x211000;
    const pQueue = 0x211400;
    const pNpc = 0x218000;
    const pShop = 0x219000;

    m.setU32(pGame + 0x1d24, pNpcCtrl);
    m.setU32(pNpcCtrl + 0x04, pNpcTable);
    m.setU32(pGame + 0x1d28, pArena);
    m.setU8(pArena + 0x08, 2);
    m.setU32(0x6fdefbf0 + 0x04, pGambleIds);
    m.setU32(pGambleIds, 999);

    m.setU32(pPlayer, 0);
    m.setU32(pPlayer + 0x0c, 11);
    m.setU32(pPlayer + 0x14, pPlrData);
    m.setU32(pPlayer + 0x2c, pPlrPath);
    m.setU32(pPlrData + 0x9c, pClient);
    m.setU32(pClient + 0x1bc, pQueue);

    m.setU32(pNpc, 1);
    m.setU32(pNpc + 0x04, 198);
    m.setU32(pNpc + 0x0c, 900);

    // [25/44] 0x6FCDB4F0 (queues 6-byte S2C 0x5D packet to client buffer)
    D2Game_6FCDB4F0_113c(m, pGame, pPlayer);
    expect(m.u32(pQueue + 0x00)).toBe(6);
    expect(m.u8(pQueue + 0x04)).toBe(0x5d);

    // [26/44] 0x6FCDE2A0 (allocates player gamble inventory node on shop +0x08)
    D2Game_6FCDE2A0_113c(m, pShop, pPlayer, pGame, pNpc);
    const pGambleNode = m.u32(pShop + 0x08);
    expect(pGambleNode).not.toBe(0);
    expect(m.u32(pGambleNode + 0x04)).toBe(11);

    // [27/44] 0x6FCDE640 (unknown item GUID queues 0x2A result 7 and returns 1)
    expect(D2Game_6FCDE640_113c(m, pGame, pPlayer, pNpc, 9999, 0, 0)).toBe(1);

    // [28/44] 0x6FCDEE30 (null NPC asserts at line 0xfe per 0x6fcdee4c)
    expect(() => D2Game_6FCDEE30_113c(m, pGame, 0x20706163, 0, pShop, 2, 10, 10)).toThrow();

    // [29/44] 0x6FCDF990 (item present, non-interacting NPC queues 0x2A result 9 and returns 1)
    const pSellItem = 0x220000;
    m.setU32(pSellItem, 4);
    m.setU32(pSellItem + 0x0c, 701);
    m.setU32(pGame + 0x1720 + ((701 & 0x7f) << 2), pSellItem);
    m.setU32(pGame + 0x1320 + ((900 & 0x7f) << 2), pNpc);
    expect(D2Game_6FCDF990_113c(m, 900, pGame, pPlayer, 701, 0)).toBe(1);

    // [30/44] 0x6FCE1030 (unregistered NPC record returns cleanly)
    D2Game_6FCE1030_113c(m, pGame, pPlayer, 198);

    // [31/44] 0x6FCE1510 (unregistered NPC record queues 0x2A result 9)
    m.setU32(pQueue + 0x00, 0);
    D2Game_6FCE1510_113c(m, pPlayer, pGame, pNpc, 1);
    expect(m.u32(pQueue + 0x00)).toBe(0x0f);
    expect(m.u8(pQueue + 0x04)).toBe(0x2a);
    expect(m.u8(pQueue + 0x06)).toBe(0x09);
  });

  it('32..36: C2S item buffer, portal creation, entity interaction, and unequip packets (0x6FCEF0E0..0x6FCF12E0)', () => {
    const { m, pDataTables } = createTestMem();
    const pGame = 0x200000;
    const pPlayer = 0x210000;
    const pPlrData = 0x210400;
    const pPlrPath = 0x210800;
    const pRoom = 0x220000;
    const pRoomEx = 0x220400;
    const pLevel = 0x220800;
    const pLevelsTxt = 0x130000;
    const pPacket = 0x230000;

    m.fill(pLevelsTxt, 10 * 0x220, 0);
    m.setU32(pDataTables + 0x04, pLevelsTxt);
    m.setU32(pDataTables + 0x0c, 10);

    m.setU32(pPlayer, 0);
    m.setU32(pPlayer + 0x0c, 55);
    m.setU32(pPlayer + 0x14, pPlrData);
    m.setU32(pPlayer + 0x2c, pPlrPath);
    m.setU16(pPlrPath + 0x02, 60);
    m.setU16(pPlrPath + 0x06, 60);
    m.setU32(pPlrPath + 0x1c, pRoom);
    m.setU32(pRoom + 0x10, pRoomEx);
    m.setU32(pRoomEx + 0x58, pLevel);
    m.setU32(pLevel + 0x1d0, 1);

    // [32/44] 0x6FCEF0E0 (packet length !== 0x11 returns 3)
    expect(D2Game_6FCEF0E0_113c(m, pGame, pPlayer, pPacket, 4)).toBe(3);

    // [33/44] 0x6FCEF810 (same-act town level 1 plays speech 0x18 and returns without throwing)
    D2Game_6FCEF810_113c(m, pPlayer, pGame, 2, 0x3b);
    expect(m.u16(pPlayer + 0x6e)).toBe(0x18);

    // [34/44] 0x6FCF08B0 (bad len -> 3, nType >= 6 -> 2, self-target type 0 -> 3)
    expect(D2Game_6FCF08B0_113c(m, pGame, pPlayer, pPacket, 5)).toBe(3);
    m.setU32(pPacket + 1, 6);
    expect(D2Game_6FCF08B0_113c(m, pGame, pPlayer, pPacket, 0x0d)).toBe(2);
    m.setU32(pPacket + 1, 0);
    m.setU32(pPacket + 5, 55);
    expect(D2Game_6FCF08B0_113c(m, pGame, pPlayer, pPacket, 0x0d)).toBe(3);

    // [35/44] 0x6FCF0910 (bad len -> 3, nType >= 6 -> 2, missing target propagates 0x6FCF01D0 -> 1)
    expect(D2Game_6FCF0910_113c(m, pGame, pPlayer, pPacket, 5)).toBe(3);
    m.setU32(pPacket + 1, 6);
    expect(D2Game_6FCF0910_113c(m, pGame, pPlayer, pPacket, 9)).toBe(2);
    m.setU32(pPacket + 1, 1);
    m.setU32(pPacket + 5, 999);
    expect(D2Game_6FCF0910_113c(m, pGame, pPlayer, pPacket, 9)).toBe(1);

    // [36/44] 0x6FCF12E0 (bad len -> 3, bodyLoc 0 or >= 11 -> 2)
    expect(D2Game_6FCF12E0_113c(m, pGame, pPlayer, pPacket, 2)).toBe(3);
    m.setU16(pPacket + 1, 0);
    expect(D2Game_6FCF12E0_113c(m, pGame, pPlayer, pPacket, 3)).toBe(2);
    m.setU16(pPacket + 1, 11);
    expect(D2Game_6FCF12E0_113c(m, pGame, pPlayer, pPacket, 3)).toBe(2);
  });

  it('37..44: Inventory/Cube/BodyLoc swaps and Act 1 Q4 Smith quest handlers (0x6FCF7300..0x6FD095E0)', () => {
    const { m, pItemsTxtBase } = createTestMem();
    const pGame = 0x200000;
    const pPlayer = 0x210000;
    const pInv = 0x211000;
    const pCursorItem = 0x220000;
    const pCursorData = 0x220400;
    const pTargetItem = 0x221000;
    const pTargetData = 0x221400;
    const pOutSwapped = 0x230000;
    const pOutFailed = 0x230004;

    m.setU32(pPlayer, 0);
    m.setU32(pPlayer + 0x60, pInv);
    m.setU32(pInv, 0x01020304);

    m.setU32(pCursorItem, 4);
    m.setU32(pCursorItem + 0x04, 1);
    m.setU32(pCursorItem + 0x0c, 801);
    m.setU32(pCursorItem + 0x10, 4);
    m.setU32(pCursorItem + 0x14, pCursorData);
    m.setU32(pGame + 0x1720 + ((801 & 0x7f) << 2), pCursorItem);

    m.setU32(pTargetItem, 4);
    m.setU32(pTargetItem + 0x04, 2);
    m.setU32(pTargetItem + 0x0c, 802);
    m.setU32(pTargetItem + 0x10, 0);
    m.setU32(pTargetItem + 0x14, pTargetData);
    m.setU8(pTargetData + 0x45, 2);
    m.setU32(pGame + 0x1720 + ((802 & 0x7f) << 2), pTargetItem);

    // Populate ItemsTxt[1] = 'cap ', ItemsTxt[2] = 'box ' (stride 0x1a8)
    m.setU32(pItemsTxtBase + 1 * 0x1a8 + 0x80, 0x20706163);
    m.setU32(pItemsTxtBase + 2 * 0x1a8 + 0x80, 0x20786f62);

    // [37/44] 0x6FCF7300 (trade page 2 sets *pOutFailed = 1 and returns 0)
    expect(
      D2Game_6FCF7300_113c(m, pPlayer, pGame, 801, 802, 0, 0, pOutSwapped, pOutFailed),
    ).toBe(0);
    expect(m.u32(pOutFailed)).toBe(1);

    // [38/44] 0x6FCF78C0 (box item with empty player inventory completes cleanly)
    D2Game_6FCF78C0_113c(m, pGame, pPlayer, pTargetItem);

    // [39/44] 0x6FCF7CC0 (non-box item 801 with mode 0 fails with *pOutFailed = 1)
    m.setU32(pCursorItem + 0x10, 0);
    expect(D2Game_6FCF7CC0_113c(m, 801, pPlayer, pGame, 802, pOutFailed)).toBe(0);
    expect(m.u32(pOutFailed)).toBe(1);

    // [40/44] 0x6FCF8020 (non-weapon bodyLoc 1 sets *pOutFailed = 1 and returns 0)
    m.setU32(pCursorItem + 0x10, 4);
    expect(D2Game_6FCF8020_113c(m, 801, pPlayer, pGame, 1, 0, pOutFailed)).toBe(0);
    expect(m.u32(pOutFailed)).toBe(1);

    // [41/44] 0x6FCF8600 (bodyLoc >= 0x0b returns 0; missing guid returns 0 and clears *pOutFailed = 0)
    expect(D2Game_6FCF8600_113c(m, 801, pPlayer, pGame, 11, 0, pOutFailed)).toBe(0);
    expect(D2Game_6FCF8600_113c(m, 999, pPlayer, pGame, 4, 0, pOutFailed)).toBe(0);
    expect(m.u32(pOutFailed)).toBe(0);

    // [42/44] 0x6FD08EB0 (active Quest 0x11 records object coords at pQData + 0x08/+0x0c and sets +0x18 = 1)
    const pQuestCtrl = 0x240000;
    const pQuest11 = 0x240200;
    const pQData11 = 0x240400;
    const pObjInteract = 0x241000;
    const pObj = 0x241200;
    m.setU32(pGame + 0x10f4, pQuestCtrl);
    m.setU32(pQuestCtrl, pQuest11);
    m.setU32(pQuest11, 0x11);
    m.setU8(pQuest11 + 0x09, 1);
    m.setU32(pQuest11 + 0x18, pQData11);
    m.setU32(pObj, 2);
    m.setU32(pObjInteract, pGame);
    m.setU32(pObjInteract + 0x04, pObj);
    m.setU32(pObjInteract + 0x14, 310);
    m.setU32(pObjInteract + 0x18, 420);
    D2Game_6FD08EB0_113c(m, pObjInteract);
    expect(m.u8(pQData11 + 0x18)).toBe(1);
    expect(m.u32(pQData11 + 0x08)).toBe(310);
    expect(m.u32(pQData11 + 0x0c)).toBe(420);

    // [43/44] 0x6FD08F30 (clears pQData + 0x05 = 0 and returns 1)
    m.setU8(pQData11 + 0x05, 1);
    expect(D2Game_6FD08F30_113c(m, pGame, pQuest11)).toBe(1);
    expect(m.u8(pQData11 + 0x05)).toBe(0);

    // [44/44] 0x6FD095E0 (object mode !== 2 returns 0 cleanly)
    m.setU32(pObj + 0x10, 1);
    expect(D2Game_6FD095E0_113c(m, pObjInteract)).toBe(0);
  });
});
