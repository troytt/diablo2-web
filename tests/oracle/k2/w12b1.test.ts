import { describe, expect, it } from 'vitest';
import * as w12b1 from '../../../src/d2kern-113c/game/k2-w12b1-113c';
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory';

function createMem(): SparseMemory113c {
  const m = new SparseMemory113c();
  m.fill(0, 0x80000, 0);
  m.fill(0x00ff7000, 0x2000, 0);
  m.fill(0x6fd18000, 0x1000, 0);
  m.fill(0x6fd27d00, 0x200, 0);
  m.fill(0x6fd31000, 0x2000, 0);
  m.fill(0x6fd44e00, 0x400, 0);
  m.fill(0x6fddc000, 0x2000, 0);
  m.fill(0x6fde9e00, 0x200, 0);
  m.fill(0x6fdf0000, 0x2000, 0);
  m.setU32(0x6fd1829c, 0x6fde9e1c);
  m.setU32(0x6fde9e1c, 0x6fdf0000);
  m.setU32(0x6fdf0b98, 0x300);
  m.setU32(0x6fdf0b4c, 0x50000);
  for (let i = 0; i < 256; i += 1) {
    m.setU32(0x50000 + i * 4, 0x51000);
  }
  m.setU32(0x10000 + 0xb0, 0x45000);
  m.setU32(0x10000 + 0xb8, 0x45000);
  return m;
}

function fnByVa(vaHex: string): (m: SparseMemory113c, ...args: number[]) => number {
  const suffix = `_${vaHex.toUpperCase()}_113C`;
  const mod = w12b1 as Record<string, unknown>;
  for (const key of Object.keys(mod)) {
    if (key.toUpperCase().endsWith(suffix) && typeof mod[key] === 'function') {
      return mod[key] as (m: SparseMemory113c, ...args: number[]) => number;
    }
  }
  throw new Error(`Missing exported function for VA 0x${vaHex}`);
}

describe('K2 Wave 12 Batch 1 (w12b1) - 34 D2Game.dll v1.13c functions', () => {
  it('[1/34] 0x6FC2DBD0 SKILLS_SrvDo_ImpTeleportOrMountSiegeBeast returns 0 on negative skill id', () => {
    const m = createMem();
    const fn = fnByVa('6FC2DBD0');
    expect(fn(m, 0x10000, 0x20000, -1, 1)).toBe(0);
  });

  it('[2/34] 0x6FC3DD40 AI_ThinkMercenaryMain returns early when mercenary is in walk mode 2', () => {
    const m = createMem();
    const fn = fnByVa('6FC3DD40');
    const pGame = 0x10000;
    const pUnit = 0x20000;
    const pMonData = 0x21000;
    const pAiGen = 0x22000;
    const pOwner = 0x23000;
    const pAiTick = 0x24000;
    m.setU32(pUnit, 1);
    m.setU32(pUnit + 0x10, 2);
    m.setU32(pUnit + 0x14, pMonData);
    m.setU32(pMonData + 0x28, pAiGen);
    m.setU32(pAiGen + 0x28, 1);
    m.setU32(pAiGen + 0x2c, 1);
    m.setU32(pAiGen + 0x30, 0);
    m.setU32(pOwner, 0);
    m.setU32(pOwner + 0x0c, 1);
    m.setU32(pGame + 0x1120 + 1 * 4, pOwner);
    fn(m, pGame, pUnit, pAiTick);
    expect(m.u32(pUnit + 0x10)).toBe(2);
  });

  it('[3/34] 0x6FC3E140 AI_FollowOwnerOrTeleportIfFar returns 0 when within dungeon follow range', () => {
    const m = createMem();
    const fn = fnByVa('6FC3E140');
    const pGame = 0x10000;
    const pOwner = 0x20000;
    const pPet = 0x21000;
    const pPath = 0x22000;
    const pRoom = 0x23000;
    const pRoomEx = 0x25000;
    const pLevel = 0x26000;
    m.setU32(pOwner, 0);
    m.setU32(pOwner + 0x10, 1);
    m.setU32(pOwner + 0x14, 0x24000);
    m.setU32(pOwner + 0x2c, pPath);
    m.setU32(pPet, 1);
    m.setU32(pPet + 0x2c, pPath);
    m.setU32(pPath + 0x1c, pRoom);
    m.setU32(pRoom + 0x10, pRoomEx);
    m.setU32(pRoomEx + 0x58, pLevel);
    m.setU32(pLevel + 0x1d0, 2);
    expect(fn(m, pOwner, pGame, pPet, 1, 1, 0, 10)).toBe(0);
  });

  it('[4/34] 0x6FC44C70 MONUMOD_SpawnUniqueOrChampionBossPack returns 0 on invalid monster index', () => {
    const m = createMem();
    const fn = fnByVa('6FC44C70');
    expect(fn(m, 0x10000, 0x20000, 1, 100, 100, 0, 0, -1)).toBe(0);
  });

  it('[5/34] 0x6FC44E70 MONUMOD_SpawnPresetUniqueOrSuperUnique returns 0 on invalid monster index', () => {
    const m = createMem();
    const fn = fnByVa('6FC44E70');
    expect(fn(m, 0x10000, 0x20000, -1, 100, 100, -1, 0, 0, 0, 0, 0x30000)).toBe(0);
  });

  it('[6/34] 0x6FC451F0 MONUMOD_SpawnSuperUniqueMonsterPack returns 0 when difficulty >= 3', () => {
    const m = createMem();
    const fn = fnByVa('6FC451F0');
    const pGame = 0x10000;
    m.setU8(pGame + 0x6d, 3);
    expect(fn(m, pGame, 0x20000, 100, 100, 1)).toBe(0);
  });

  it('[7/34] 0x6FC679B0 MONSTER_SpawnUniqueBossWithChampionMinionPack returns 0 on invalid monster index', () => {
    const m = createMem();
    const fn = fnByVa('6FC679B0');
    const pGame = 0x10000;
    const pRoom = 0x20000;
    const pRoomEx = 0x25000;
    const pLevel = 0x26000;
    m.setU32(pRoom + 0x10, pRoomEx);
    m.setU32(pRoom + 0x4c, 100);
    m.setU32(pRoom + 0x50, 100);
    m.setU32(pRoom + 0x54, 16);
    m.setU32(pRoom + 0x58, 16);
    m.setU32(pRoom + 0x6c, 0x12345678);
    m.setU32(pRoom + 0x70, 0x0000029a);
    m.setU32(pRoomEx + 0x58, pLevel);
    m.setU32(pLevel + 0x1d0, 2);
    expect(fn(m, 0, pRoom, pGame, -1)).toBe(0);
  });

  it('[8/34] 0x6FC68FC0 HIRELING_AssignMercenaryToPlayer returns early on null player', () => {
    const m = createMem();
    const fn = fnByVa('6FC68FC0');
    fn(m, 0x10000, 0, 0x20000, 0, 0x30000, 0);
    expect(m.u32(0x20000 + 0xc4)).toBe(0);
  });

  it('[9/34] 0x6FC71340 SKILLS_SrvDo_MonsterConvert returns 0 when skill id is 0', () => {
    const m = createMem();
    const fn = fnByVa('6FC71340');
    expect(fn(m, 0x10000, 0x20000, 0, 1)).toBe(0);
  });

  it('[10/34] 0x6FC74420 ITEMS_PlaceLoadedPlayerOrMercItem returns 0x0d on mode 6 without target', () => {
    const m = createMem();
    const fn = fnByVa('6FC74420');
    const pItem = 0x20000;
    m.setU32(pItem + 0x10, 6);
    expect(fn(m, pItem, 0, 0x10000, 0x30000)).toBe(0x0d);
  });

  it('[11/34] 0x6FC745D0 ITEMS_PlaceLoadedPlayerItemWithSync returns 0x0c on mode 6 without target', () => {
    const m = createMem();
    const fn = fnByVa('6FC745D0');
    const pItem = 0x20000;
    const pStaticPath = 0x21000;
    m.setU32(pItem, 4);
    m.setU32(pItem + 0x10, 6);
    m.setU32(pItem + 0x14, 0x22000);
    m.setU32(pItem + 0x2c, pStaticPath);
    expect(fn(m, 0, pItem, 0x30000, 0x10000)).toBe(0x0c);
  });

  it('[12/34] 0x6FC74810 ITEMS_DeserializeAndPlaceItemListFromJMStream handles empty JM stream', () => {
    const m = createMem();
    const fn = fnByVa('6FC74810');
    const pStream = 0x20000;
    const pOutBytes = 0x21000;
    m.setU16(pStream, 0x4d4a);
    m.setU16(pStream + 2, 0);
    expect(fn(m, pStream, 0x10000, 0x30000, 0x60, 0x100, 0, pOutBytes)).toBe(0);
    expect(m.u32(pOutBytes)).toBe(4);
  });

  it('[13/34] 0x6FC8BCB0 OBJ_OperateFn_DungeonStairOrTileWarp returns 1 on mode 3', () => {
    const m = createMem();
    const fn = fnByVa('6FC8BCB0');
    const pArgs = 0x20000;
    const pObj = 0x21000;
    const pStaticPath = 0x22000;
    m.setU32(pArgs + 4, pObj);
    m.setU32(pObj, 2);
    m.setU32(pObj + 0x10, 3);
    m.setU32(pObj + 0x2c, pStaticPath);
    expect(fn(m, pArgs)).toBe(1);
  });

  it('[14/34] 0x6FC8BE40 OBJ_OperateFn_FindPairedObjectAndTeleportPad returns 0 when room is 0', () => {
    const m = createMem();
    const fn = fnByVa('6FC8BE40');
    const pArgs = 0x20000;
    const pObj = 0x21000;
    const pStaticPath = 0x22000;
    m.setU32(pArgs + 4, pObj);
    m.setU32(pObj, 2);
    m.setU32(pObj + 0x2c, pStaticPath);
    expect(fn(m, pArgs)).toBe(0);
  });

  it('[15/34] 0x6FC8DFC0 OBJ_OperateFn_TrapDoorOrDelayedTileWarp returns 1 on mode 3', () => {
    const m = createMem();
    const fn = fnByVa('6FC8DFC0');
    const pArgs = 0x20000;
    const pObj = 0x21000;
    const pStaticPath = 0x22000;
    m.setU32(pArgs + 4, pObj);
    m.setU32(pObj, 2);
    m.setU32(pObj + 0x10, 3);
    m.setU32(pObj + 0x2c, pStaticPath);
    expect(fn(m, pArgs)).toBe(1);
  });

  it('[16/34] 0x6FC8EDB0 OBJ_OperateFn_SparklyChestOrTrapSpawner returns 1 when chest already open', () => {
    const m = createMem();
    const fn = fnByVa('6FC8EDB0');
    const pArgs = 0x20000;
    const pObj = 0x21000;
    m.setU32(pArgs + 4, pObj);
    m.setU32(pObj + 0x10, 2);
    expect(fn(m, pArgs)).toBe(1);
  });

  it('[17/34] 0x6FC915E0 PLRTRADE_RestorePlayerInventoryAndGoldFromSnapshot restores empty JM snapshot', () => {
    const m = createMem();
    const fn = fnByVa('6FC915E0');
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    const pPlrData = 0x21000;
    const pTrade = 0x22000;
    const pStream = 0x23000;
    m.setU32(pPlayer, 0);
    m.setU32(pPlayer + 0x14, pPlrData);
    m.setU32(pPlrData + 0x5c, pTrade);
    m.setU32(pTrade + 0x04, pStream);
    m.setU16(pStream, 0x4d4a);
    m.setU16(pStream + 2, 0);
    fn(m, pPlayer, pGame);
    expect(m.u16(pStream)).toBe(0x4d4a);
  });

  it('[18/34] 0x6FC916D0 PLRTRADE_RollbackPlayerItemsToSnapshot returns early when trade record is 0', () => {
    const m = createMem();
    const fn = fnByVa('6FC916D0');
    const pPlayer = 0x20000;
    const pPlrData = 0x21000;
    m.setU32(pPlayer, 0);
    m.setU32(pPlayer + 0x14, pPlrData);
    m.setU32(pPlrData + 0x5c, 0);
    fn(m, 0x10000, pPlayer);
    expect(m.u32(pPlrData + 0x5c)).toBe(0);
  });

  it('[19/34] 0x6FC919A0 PLRTRADE_AbortTradeAndRollbackBothPlayers resets trade state on both players', () => {
    const m = createMem();
    const fn = fnByVa('6FC919A0');
    const pGame = 0x10000;
    const pPlayer1 = 0x20000;
    const pPlayer2 = 0x21000;
    const pPlrData1 = 0x22000;
    const pPlrData2 = 0x23000;
    m.setU32(pPlayer1, 0);
    m.setU32(pPlayer1 + 0x14, pPlrData1);
    m.setU32(pPlayer2, 0);
    m.setU32(pPlayer2 + 0x14, pPlrData2);
    fn(m, pGame, pPlayer1, pPlayer2, pPlrData1, pPlrData2, 9);
    expect(m.u32(pPlayer1 + 0x64)).toBe(0xffffffff);
    expect(m.u32(pPlayer2 + 0x64)).toBe(0xffffffff);
    expect(m.u32(pPlrData1 + 0x50)).toBe(9);
    expect(m.u32(pPlrData2 + 0x50)).toBe(9);
  });

  it('[20/34] 0x6FC91B00 PLRTRADE_MirrorItemToPartnerTradeGrid returns early when trade flag 0x6c is active', () => {
    const m = createMem();
    const fn = fnByVa('6FC91B00');
    const pGame = 0x10000;
    const pItem = 0x20000;
    const pPlayer = 0x21000;
    const pPlrData = 0x22000;
    m.setU32(pPlayer, 0);
    m.setU32(pPlayer + 0x14, pPlrData);
    m.setU8(pPlayer + 0x6c, 1);
    m.setU32(pPlayer + 0x68, 6);
    fn(m, pItem, pGame, pPlayer);
    expect(m.u8(pPlayer + 0x6c)).toBe(1);
  });

  it('[21/34] 0x6FCA9870 AI_Think_SandMaggot schedules think timer when state is 2 and target is 0', () => {
    const m = createMem();
    const fn = fnByVa('6FCA9870');
    const pGame = 0x10000;
    const pUnit = 0x20000;
    const pAiCtrl = 0x21000;
    const pAiArgs = 0x22000;
    m.setU32(pAiArgs, pAiCtrl);
    m.setU32(pAiCtrl + 0x1c, 2);
    fn(m, pGame, pUnit, pAiArgs);
    expect(m.u32(pAiCtrl + 0x1c)).toBe(2);
  });

  it('[22/34] 0x6FCA9C30 AI_Think_BurrowingScarabOrFrog stalls when target is 0 and burrowed', () => {
    const m = createMem();
    const fn = fnByVa('6FCA9C30');
    const pGame = 0x10000;
    const pUnit = 0x20000;
    const pPath = 0x21000;
    const pAiCtrl = 0x22000;
    const pAiArgs = 0x23000;
    m.setU32(pUnit, 1);
    m.setU32(pUnit + 0x2c, pPath);
    m.setU32(pAiArgs, pAiCtrl);
    m.setU32(pAiCtrl + 0x18, 1);
    fn(m, pGame, pUnit, pAiArgs);
    expect(m.u32(pAiCtrl + 0x18)).toBe(1);
  });

  it('[23/34] 0x6FCBE170 PLAYER_ChangeLevelOrActTransition handles cross-act transition when arena flag blocks warp', () => {
    const m = createMem();
    const fn = fnByVa('6FCBE170');
    const pGame = 0x10000;
    const pPlayer = 0x20000;
    const pPlrData = 0x21000;
    const pClient = 0x22000;
    const pPath = 0x23000;
    const pArena = 0x24000;
    m.setU32(pGame + 0x1d28, pArena);
    m.setU8(pArena + 0x08, 2);
    m.setU32(pPlayer, 0);
    m.setU32(pPlayer + 0x14, pPlrData);
    m.setU32(pPlayer + 0x2c, pPath);
    m.setU32(pPlrData + 0x9c, pClient);
    m.setU8(pClient + 0x1ac, 0);
    fn(m, pPlayer, 41, pGame, 0);
    expect(m.u8(pClient + 0x1ac)).toBe(0);
  });

  it('[24/34] 0x6FCC3090 SKILLS_RegisterSummonedMonsterPet sets high flag 0x80000000 on pet unit', () => {
    const m = createMem();
    const fn = fnByVa('6FCC3090');
    const pGame = 0x10000;
    const pSummonArg = 0x20000;
    const pPet = 0x21000;
    const pOwner = 0x22000;
    m.setU8(pSummonArg, 0);
    m.setU32(pSummonArg + 0x04, pOwner);
    m.setU32(pSummonArg + 0x20, 1);
    fn(m, pSummonArg, pPet, pGame);
    expect((m.u32(pPet + 0xc4) & 0x80000000) >>> 0).toBe(0x80000000);
  });

  it('[25/34] 0x6FCC9E80 AI_Think_ShadowWarriorAndMaster returns early when ai control is 0', () => {
    const m = createMem();
    const fn = fnByVa('6FCC9E80');
    const pAiArgs = 0x20000;
    fn(m, 0x10000, 0x21000, pAiArgs);
    expect(m.u32(pAiArgs)).toBe(0);
  });

  it('[26/34] 0x6FCCA1D0 AI_Think_Raven returns early when ai control is 0', () => {
    const m = createMem();
    const fn = fnByVa('6FCCA1D0');
    const pAiArgs = 0x20000;
    fn(m, 0x10000, 0x21000, pAiArgs);
    expect(m.u32(pAiArgs)).toBe(0);
  });

  it('[27/34] 0x6FCE8950 ACT2Q6_WarpPlayerThroughRoomTileUnit handles empty room unit list', () => {
    const m = createMem();
    const fn = fnByVa('6FCE8950');
    const pArgs = 0x20000;
    const pObj = 0x21000;
    const pStaticPath = 0x22000;
    const pRoom = 0x23000;
    m.setU32(pArgs + 0x04, pObj);
    m.setU32(pObj, 2);
    m.setU32(pObj + 0x2c, pStaticPath);
    m.setU32(pStaticPath, pRoom);
    fn(m, pArgs);
    expect(m.u32(pRoom + 0x74)).toBe(0);
  });

  it('[28/34] 0x6FCEFB90 C2S_Packet23_MercReviveHandler returns 3 on invalid packet length', () => {
    const m = createMem();
    const fn = fnByVa('6FCEFB90');
    const pGame = 0x10000;
    m.setU32(pGame + 0x70, 1);
    expect(fn(m, pGame, 0x20000, 0x21000, 4)).toBe(3);
  });

  it('[29/34] 0x6FCF01D0 C2S_ExecuteEntityInteractionOrRunToTarget returns 1 on unknown unit type', () => {
    const m = createMem();
    const fn = fnByVa('6FCF01D0');
    expect(fn(m, 6, 0x10000, 0, 0x20000, 1)).toBe(1);
  });

  it('[30/34] 0x6FCF3280 ITEMS_ClearInvalidRunewordOnItem returns early when game is 0', () => {
    const m = createMem();
    const fn = fnByVa('6FCF3280');
    fn(m, 0x20000, 0x21000, 0);
    expect(m.u32(0x20000)).toBe(0);
  });

  it('[31/34] 0x6FCF76A0 ITEMS_PlaceItemInUnitInventoryGrid returns 0 when game/owner are 0', () => {
    const m = createMem();
    const fn = fnByVa('6FCF76A0');
    expect(fn(m, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)).toBe(0);
  });

  it('[32/34] 0x6FCF7E30 belt overflow handler processes empty belt cleanly', () => {
    const m = createMem();
    const fn = fnByVa('6FCF7E30');
    const pUnit = 0x20000;
    const pInv = 0x21000;
    m.setU32(pUnit + 0x60, pInv);
    m.setU32(pInv, 0x10203040);
    fn(m, 0, pUnit, pUnit);
    expect(m.u32(pInv)).toBe(0x10203040);
  });

  it('[33/34] 0x6FCF8970 ITEMS_UnequipItemFromBodyLocToCursor returns 0 when cursor is occupied', () => {
    const m = createMem();
    const fn = fnByVa('6FCF8970');
    const pUnit = 0x20000;
    const pInv = 0x21000;
    const pCursor = 0x22000;
    const pOutErr = 0x23000;
    m.setU32(pUnit + 0x60, pInv);
    m.setU32(pInv, 0x10203040);
    m.setU32(pInv + 0x20, pCursor);
    m.setU32(pOutErr, 99);
    expect(fn(m, 0x10000, pUnit, 1, 1, pOutErr)).toBe(0);
    expect(m.u32(pOutErr)).toBe(0);
  });

  it('[34/34] 0x6FD08780 Radament boss pack spawner clears active spawn flag 0x04 on completion', () => {
    const m = createMem();
    const fn = fnByVa('6FD08780');
    const pGame = 0x10000;
    const pQuestState = 0x20000;
    const pRoom = 0x21000;
    const pRoomEx = 0x25000;
    const pLevel = 0x26000;
    m.setU32(pRoom + 0x10, pRoomEx);
    m.setU32(pRoom + 0x4c, 100);
    m.setU32(pRoom + 0x50, 100);
    m.setU32(pRoom + 0x54, 16);
    m.setU32(pRoom + 0x58, 16);
    m.setU32(pRoom + 0x6c, 0x12345678);
    m.setU32(pRoom + 0x70, 0x0000029a);
    m.setU32(pRoomEx + 0x58, pLevel);
    m.setU32(pLevel + 0x1d0, 28);
    m.setU8(pQuestState + 0x04, 1);
    fn(m, pQuestState, pRoom, pGame);
    expect(m.u8(pQuestState + 0x04)).toBe(0);
  });
});
