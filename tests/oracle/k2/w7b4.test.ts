import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers'
import {
  ACT2Q1_OnRadamentKilled_6FCE7540_113c,
  ACT2Q6_OnDurielKilled_6FCE97D0_113c,
  ACT3Q0_ScheduleDarkWandererTimerOnPlayerSeen_6FD06760_113c,
  ACT3Q2_OnGidbinnBossKilled_6FD08140_113c,
  ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c,
  ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c,
  ACT3Q5_OnKhalimWillSmashedCompellingOrb_6FD073C0_113c,
  ACT3Q7_OnOrmusNpcActivateFilter_6FD07050_113c,
  ACT3Q7_PropagateMephistoCompletionToPartyCallback_6FD06850_113c,
  C2S_Packet24_RemoveBeltItemToCursor_6FCF0F80_113c,
  C2S_Packet27_IdentifyItemWithScroll_6FCEEFE0_113c,
  C2S_Packet28_SocketItem_6FCEEBD0_113c,
  C2S_Packet29_InsertScrollIntoTome_6FCEDB30_113c,
  C2S_Packet30_CancelNpcInteract_6FCED480_113c,
  C2S_Packet34_CainIdentifyItems_6FCEF070_113c,
  C2S_Packet3A_AddStatPoint_6FCEC960_113c,
  ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c,
  ITEMS_ConsumeSkeletonKeyFromInventory_6FCF4140_113c,
  ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c,
  ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c,
  ITEMS_FillTomeWithFirstMatchingScroll_6FCF3C40_113c,
  ITEMS_MergeCompatibleWeaponStackFromCursor_6FCF4230_113c,
  ITEMS_PickupGroundItemToCursor_6FCF7160_113c,
  ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c,
  ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c,
  ITEMS_SwapDualWieldOrTwoHandBodyLocWithCursor_6FCF5C30_113c,
  ITEMS_SwitchWeaponSlots_6FCF8EA0_113c,
  ITEMS_UseBeltItem_6FCF8BA0_113c,
  ITEMS_UseInventoryItem_6FCF9BF0_113c,
  ITEMS_UseScrollOrTomeOnTargetItem_6FCF9FB0_113c,
  MONREG_InitGameMonsterRegionsFromGameSeed_6FCEACC0_113c,
  MONSTER_SpawnFallenShamanPack_6FD0FB80_113c,
  OBJECTS_ExecuteUrnSporeTrapAndChain_6FC8AD60_113c,
  OBJECTS_OperateEvilUrnSporeTrap_6FC8D740_113c,
  PARTY_DeclareHostility_6FD10CD0_113c,
  PARTY_ToggleLootPermission_6FD10F40_113c,
  PLAYERSAVE_WriteSaveFileBuffer_6FD0C7F0_113c,
  PLRTRADE_RemoveTradeItemToCursorAndResetAccept_6FC91330_113c,
  SUNITDMG_GrantExpToPlayerOrHireling_6FCFE870_113c,
} from '../../../src/d2kern-113c/game/k2-w7b4-113c'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'

function setupTables(m: SparseMemory113c): {
  pDataTables: number
  pObjectsBase: number
  pMonStatsBase: number
} {
  const pDataTablesPtr = 0x100000
  const pDataTables = 0x100100
  const pObjectsBase = 0x120000
  const pMonStatsBase = 0x140000
  const pBitMasks = 0x180000
  m.fill(pDataTables, 0xd00, 0)
  m.fill(pObjectsBase, 30 * 0x1c0, 0)
  m.fill(pMonStatsBase, 50 * 0x1a8, 0)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pDataTablesPtr)
  m.setU32(pDataTablesPtr, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(0x6fd1829c, pDataTablesPtr)
  m.setU32(0x6fd31c20, 0)
  m.setU32(0x6fd18d10, 1000)
  m.setU32(0x6fdf0b54, pObjectsBase)
  m.setU32(0x6fdf0b58, 10)
  m.fill(0x6fd1b14c, 0x20, 0)
  m.setU32(pDataTables + 0x9c, pObjectsBase)
  m.setU32(pDataTables + 0xa4, 30)
  m.setU32(pDataTables + 0xa78, pMonStatsBase)
  m.setU32(pDataTables + 0xa80, 50)
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pBitMasks)
  for (let i = 0; i < 32; i++) {
    m.setU32(pBitMasks + i * 4, (1 << i) >>> 0)
  }
  return { pDataTables, pObjectsBase, pMonStatsBase }
}

describe('K2 Wave 7 Batch 4 (w7b4: 39 D2Game.dll 1.13c functions)', () => {
  it('[1/39..5/39] tests Act2 quest callbacks, monster region init, and C2S 0x3A / 0x30', () => {
    const m = new SparseMemory113c()
    setupTables(m)

    const pQuestData = 0x200000
    const pGame = 0x201000
    const pQuestState = 0x213000
    const pCallbackArg = 0x214000
    const pQuestCtrl = 0x215000
    const pQuestFlags = 0x216000
    const pQuestBytes = 0x216100
    const pMonUnit = 0x217000
    const pMonPath = 0x217200
    const pRoom = 0x217400
    m.fill(pQuestData, 0x120, 0)
    m.fill(pGame, 0x2000, 0)
    m.fill(pQuestState, 0x100, 0)
    m.fill(pCallbackArg, 0x40, 0)
    m.fill(pQuestCtrl, 0x40, 0)
    m.fill(pQuestFlags, 0x200, 0)
    m.fill(pMonUnit, 0x100, 0)
    m.fill(pMonPath, 0x80, 0)
    m.fill(pRoom, 0x100, 0)
    m.setU32(pMonUnit, 1)
    m.setU32(pMonUnit + 0x2c, pMonPath)
    m.setU32(pMonPath + 0x1c, pRoom)
    m.setU32(pCallbackArg + 0x08, pMonUnit)
    m.setU32(pQuestFlags, pQuestBytes)
    m.setU32(pQuestFlags + 4, 0x60)
    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0x18, pQuestState)
    m.setU8(pQuestData + 0x09, 1)
    m.setU8(pQuestState + 0x0a, 1)
    m.setU32(pCallbackArg, pGame)
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    m.setU32(pQuestCtrl + 0x08, 1)
    m.setU32(pQuestCtrl + 0x0c, pQuestFlags)
    ACT2Q1_OnRadamentKilled_6FCE7540_113c(m, pQuestData, pCallbackArg)
    expect(m.u8(pQuestState)).toBe(1)

    m.setU8(pQuestData + 0x09, 0)
    ACT2Q6_OnDurielKilled_6FCE97D0_113c(m, pQuestData, pCallbackArg)
    expect(m.u32(pQuestState + 0x18)).toBe(2)

    m.setU32(pGame + 0xd0, 0x12345678)
    m.setU32(pGame + 0xd4, 1)
    MONREG_InitGameMonsterRegionsFromGameSeed_6FCEACC0_113c(m, pGame)
    expect(m.u32(pGame + 0xec) !== 0).toBe(true)

    const pPacket = 0x210000
    m.fill(pPacket, 0x20, 0)
    expect(C2S_Packet3A_AddStatPoint_6FCEC960_113c(m, pGame, 0, pPacket, 3)).toBe(2)
    expect(C2S_Packet30_CancelNpcInteract_6FCED480_113c(m, pGame, 0, pPacket, 9)).toBe(1)
  })

  it('[6/39..10/39] tests C2S packets 0x29, 0x28, 0x27, 0x34, 0x24', () => {
    const m = new SparseMemory113c()
    setupTables(m)

    const pGame = 0x201000
    const pPlayer = 0x203000
    const pPacket = 0x204000
    m.fill(pGame, 0x1800, 0)
    m.fill(pPlayer, 0x100, 0)
    m.fill(pPacket, 0x20, 0)

    expect(C2S_Packet29_InsertScrollIntoTome_6FCEDB30_113c(m, pGame, pPlayer, pPacket, 4)).toBe(3)
    expect(C2S_Packet28_SocketItem_6FCEEBD0_113c(m, pGame, pPlayer, pPacket, 4)).toBe(3)
    expect(C2S_Packet27_IdentifyItemWithScroll_6FCEEFE0_113c(m, pGame, pPlayer, pPacket, 4)).toBe(3)
    expect(C2S_Packet34_CainIdentifyItems_6FCEF070_113c(m, pGame, pPlayer, pPacket, 4)).toBe(3)
    expect(C2S_Packet24_RemoveBeltItemToCursor_6FCF0F80_113c(m, pGame, pPlayer, pPacket, 2)).toBe(3)
  })

  it('[11/39..15/39] tests ITEMS scroll fill, skeleton key, stack merge, auto-equip, and repair', () => {
    const m = new SparseMemory113c()
    setupTables(m)

    const pGame = 0x201000
    const pPlayer = 0x203000
    const pItem = 0x204000
    const pInventory = 0x205000
    const pOutErr = 0x206000
    m.fill(pGame, 0x1800, 0)
    m.fill(pPlayer, 0x100, 0)
    m.fill(pItem, 0x100, 0)
    m.fill(pInventory, 0x80, 0)
    m.fill(pOutErr, 0x20, 0)
    m.setU32(pPlayer + 0x60, pInventory)

    expect(ITEMS_FillTomeWithFirstMatchingScroll_6FCF3C40_113c(m, pGame, pPlayer, pItem)).toBe(0)
    expect(ITEMS_ConsumeSkeletonKeyFromInventory_6FCF4140_113c(m, pGame, pPlayer)).toBe(0)
    expect(() =>
      ITEMS_MergeCompatibleWeaponStackFromCursor_6FCF4230_113c(m, 1, 2, 0, pPlayer, pOutErr),
    ).toThrow(D2CommonAssertError)
    expect(ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c(m, pItem, pPlayer, 1)).toBe(0)
    expect(() =>
      ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c(m, pPlayer, 0, pGame),
    ).toThrow(D2CommonAssertError)
  })

  it('[16/39..20/39] tests ITEMS equip stored/swap/cursor, pickup to cursor, and belt use', () => {
    const m = new SparseMemory113c()
    setupTables(m)

    const pGame = 0x201000
    const pPlayer = 0x213000
    const pPlayerData = 0x213200
    const pInventory = 0x215000
    const pOutErr = 0x216000
    m.fill(pGame, 0x2000, 0)
    m.fill(pPlayer, 0x100, 0)
    m.fill(pPlayerData, 0x100, 0)
    m.fill(pInventory, 0x80, 0)
    m.fill(pOutErr, 0x20, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x60, pInventory)

    expect(() =>
      ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c(m, pPlayer, 0, 1, 1),
    ).toThrow(D2CommonAssertError)
    expect(() =>
      ITEMS_SwapDualWieldOrTwoHandBodyLocWithCursor_6FCF5C30_113c(m, 1, 0, pPlayer, 4, pOutErr),
    ).toThrow(D2CommonAssertError)
    expect(() =>
      ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c(m, 1, pPlayer, 0, 1, 0, pOutErr),
    ).toThrow(D2CommonAssertError)
    ITEMS_PickupGroundItemToCursor_6FCF7160_113c(m, pPlayer, pGame, 99, pOutErr)
    expect(m.u32(pOutErr)).toBe(0)
    expect(ITEMS_UseBeltItem_6FCF8BA0_113c(m, pOutErr, 99, pGame, pPlayer, 0, 0, 0)).toBe(0)
  })

  it('[21/39..25/39] tests weapon switch, inventory item use, scroll on target, exp grant, and Act3Q0 timer', () => {
    const m = new SparseMemory113c()
    setupTables(m)

    const pGame = 0x201000
    const pPlayer = 0x203000
    const pOutErr = 0x206000
    m.fill(pGame, 0x1800, 0)
    m.fill(pPlayer, 0x100, 0)
    m.fill(pOutErr, 0x20, 0)

    expect(() => ITEMS_SwitchWeaponSlots_6FCF8EA0_113c(m, pPlayer, 0, pOutErr)).toThrow(
      D2CommonAssertError,
    )
    expect(() => ITEMS_UseInventoryItem_6FCF9BF0_113c(m, 1, 0, pPlayer, 10, 10, pOutErr)).toThrow(
      D2CommonAssertError,
    )
    expect(() =>
      ITEMS_UseScrollOrTomeOnTargetItem_6FCF9FB0_113c(m, 1, pPlayer, 2, 0, pOutErr),
    ).toThrow(D2CommonAssertError)
    SUNITDMG_GrantExpToPlayerOrHireling_6FCFE870_113c(m, 0, 100, pGame)

    const pQuestCtrl = 0x207000
    const pQuestNode = 0x208000
    const pQuestExt = 0x209000
    m.fill(pQuestCtrl, 0x40, 0)
    m.fill(pQuestNode, 0x120, 0)
    m.fill(pQuestExt, 0x40, 0)
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    m.setU32(pQuestCtrl, pQuestNode)
    m.setU32(pQuestNode, 0x1c)
    m.setU32(pQuestNode + 0x04, pGame)
    m.setU32(pQuestNode + 0x18, pQuestExt)
    ACT3Q0_ScheduleDarkWandererTimerOnPlayerSeen_6FD06760_113c(m, pGame, pPlayer)
    expect(m.u8(pQuestExt + 0x0d)).toBe(1)
  })

  it('[26/39..30/39] tests Act3 quests Q7 Mephisto/Ormus, Q5 Compelling Orb, and Q4 Lam Esen Tome', () => {
    const m = new SparseMemory113c()
    setupTables(m)

    const pGame = 0x201000
    const pPlayer = 0x212000
    const pPlayerData = 0x212200
    const pQuestFlags = 0x212400
    const pQuestBytes = 0x212500
    const pQuestData = 0x213000
    const pCallbackArg = 0x214000
    const pQuestExt = 0x215000
    m.fill(pGame, 0x2000, 0)
    m.fill(pPlayer, 0x100, 0)
    m.fill(pPlayerData, 0x100, 0)
    m.fill(pQuestFlags, 0x200, 0)
    m.setU32(pQuestFlags, pQuestBytes)
    m.setU32(pQuestFlags + 4, 0x60)
    m.fill(pQuestData, 0x120, 0)
    m.fill(pCallbackArg, 0x40, 0)
    m.fill(pQuestExt, 0x180, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x10, pQuestFlags)
    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0x18, pQuestExt)

    expect(
      ACT3Q7_PropagateMephistoCompletionToPartyCallback_6FD06850_113c(m, pGame, pPlayer, 0),
    ).toBe(0)

    expect(ACT3Q7_OnOrmusNpcActivateFilter_6FD07050_113c(m, pQuestData, pCallbackArg)).toBe(1)

    ACT3Q5_OnKhalimWillSmashedCompellingOrb_6FD073C0_113c(m, pGame, pPlayer)

    m.setU8(pQuestData + 0x09, 1)
    ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c(m, pQuestData, pCallbackArg)
    expect(m.u8(pQuestData + 0x0c)).toBe(3)

    ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c(m, pQuestData, pCallbackArg)
    expect(m.u8(pQuestData + 0x0c)).toBe(4)
  })

  it('[31/39..35/39] tests Act3Q2 Gidbinn boss, player save buffer, Fallen Shaman pack, and party hostility/loot', () => {
    const m = new SparseMemory113c()
    setupTables(m)

    const pGame = 0x201000
    const pQuestData = 0x203000
    const pCallbackArg = 0x204000
    const pQuestExt = 0x205000
    m.fill(pGame, 0x1800, 0)
    m.fill(pQuestData, 0x120, 0)
    m.fill(pCallbackArg, 0x40, 0)
    m.fill(pQuestExt, 0x80, 0)
    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0x18, pQuestExt)
    ACT3Q2_OnGidbinnBossKilled_6FD08140_113c(m, pQuestData, pCallbackArg)
    expect(m.u8(pQuestExt)).toBe(0)

    const pOutLen = 0x206000
    m.setU32(pOutLen, 0)
    expect(
      PLAYERSAVE_WriteSaveFileBuffer_6FD0C7F0_113c(m, 0, pGame, 0x207000, pOutLen, 0x2000, 0, 0),
    ).toBe(2)

    expect(MONSTER_SpawnFallenShamanPack_6FD0FB80_113c(m, 0, 0, pGame, 0, 10, 10, 0)).toBe(0)

    const pPlayer = 0x208000
    const pPlayerData = 0x208200
    const pClient = 0x208400
    m.fill(pPlayer, 0x100, 0)
    m.fill(pPlayerData, 0x100, 0)
    m.fill(pClient, 0x40, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x9c, pClient)
    PARTY_DeclareHostility_6FD10CD0_113c(m, pGame, pPlayer, pPlayer)
    PARTY_ToggleLootPermission_6FD10F40_113c(m, pGame, pPlayer, pPlayer, 1)
  })

  it('[36/39..39/39] tests mutually recursive SCCs 0x6FC8AD60<->0x6FC8D740 and 0x6FC91330<->0x6FCF62E0', () => {
    const m = new SparseMemory113c()
    setupTables(m)

    const pGame = 0x201000
    const pObj = 0x203000
    const pRoom = 0x204000
    const pPath = 0x205000
    const pOperateArgs = 0x206000
    m.fill(pGame, 0x1800, 0)
    m.fill(pObj, 0x100, 0)
    m.fill(pRoom, 0x100, 0)
    m.fill(pPath, 0x80, 0)
    m.fill(pOperateArgs, 0x20, 0)

    m.setU32(pObj, 2)
    m.setU32(pObj + 0x10, 1)
    m.setU32(pObj + 0x2c, pPath)
    m.setU32(pPath, pRoom)
    m.setU32(pPath + 0x04, pRoom)
    m.setU32(pPath + 0x1c, pRoom)
    m.setU32(pOperateArgs, pGame)
    m.setU32(pOperateArgs + 4, pObj)

    expect(OBJECTS_OperateEvilUrnSporeTrap_6FC8D740_113c(m, pOperateArgs)).toBe(0)
    expect(OBJECTS_ExecuteUrnSporeTrapAndChain_6FC8AD60_113c(m, pOperateArgs)).toBe(0)

    const pPlayer = 0x207000
    m.fill(pPlayer, 0x100, 0)
    expect(() =>
      PLRTRADE_RemoveTradeItemToCursorAndResetAccept_6FC91330_113c(m, 0, pPlayer, 0),
    ).toThrow(D2CommonAssertError)
    expect(() =>
      ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c(m, 0, pPlayer, 0, 1, 0x208000, 1, 1, 0),
    ).toThrow(D2CommonAssertError)
  })
})
