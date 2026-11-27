import { describe, expect, it } from 'vitest'
import {
  ACT1_InitAkaraIntroQuestDescriptor_6FC83CC0_113c,
  ACT1_InitCainIntroQuestDescriptor_6FC82FA0_113c,
  ACT1Q0_InitQuestDescriptor_6FC82D90_113c,
  ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c,
  ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c,
  ACT1Q6_SyncCompletionForPlayerOutsideAct1_6FC83000_113c,
  ACT1Q6_SyncCompletionInCatacombs4_6FC830D0_113c,
  ACT5Q3_RegisterAnyaObjectAndSpawnMonster200_6FC7EB30_113c,
  ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c,
  ACT5Q3_SpawnMonster202AndAttachQuestData_6FC7C5C0_113c,
  ACT5Q4_AdvanceObjectToMonsterSpawn_6FC7C480_113c,
  ACT5Q5_ActivateAncientStatueAndSpawnMonster_6FC7E420_113c,
  ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c,
  CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c,
  GAME_AssignUniqueGameName_6FC4BC90_113c,
  ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c,
  ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c,
  ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c,
  ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c,
  ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c,
  ITEMS_RollRareAffixesByFormat_6FC354F0_113c,
  ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c,
  MISSILE_SrvDmg_ApplyOwnerDmgPercentAndDemonUndeadBonus_6FC5AAA0_113c,
  MISSILE_SrvDmg_TriggerQuest24PortalSpawnOnExpire_6FC5BBB0_113c,
  MISSILE_SrvDo_LinearQuest24PortalTrigger_6FC5F670_113c,
  MISSILE_SrvDo_TriggerChargedAuraInDurationWindow_6FC5F7D0_113c,
  MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c,
  MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c,
  MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c,
  MONUMOD_SpectralHitMissileDamage_6FC43650_113c,
  OBJ_CalcShrineStatBonusValue_6FC89EE0_113c,
  OBJ_DropChestLootFromObjectUnit_6FC8B6F0_113c,
  OBJ_OperateFn19_ArmorStand_6FC8B2E0_113c,
  OBJ_OperateFn20_WeaponRack_6FC8B280_113c,
  OBJ_OperateFn28_Urn_6FC8D7B0_113c,
  OBJ_OperateFn48_TrappedSoul_6FC8CE10_113c,
  OBJ_SpawnMonster326FromObject_6FC8B880_113c,
  OBJ_SpawnMonster329FromObject_6FC8B870_113c,
  OBJ_SpawnMonster330FromObject_6FC8B890_113c,
  OBJ_SpawnMonster369FromObject_6FC8B860_113c,
  OBJ_SpawnRandomMonsterTrapFromObject_6FC8A4E0_113c,
  OBJ_TryOperateObjectIfInRange_6FC8A720_113c,
  PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c,
  PLRTRADE_TryInitiatePlayerTrade_6FC90D90_113c,
  STORM_TSListArrayResize_6FC22630_113c,
} from '../../../src/d2kern-113c/game/k2-w4b3-113c'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'

function initSparseGlobals(m: SparseMemory113c): number {
  m.fill(0x6fd18000, 0x30000, 0)
  m.fill(0x6fdd6000, 0x28000, 0)
  const pDataTables = m.alloc(0x2000)
  const ppDataTablesIat = m.alloc(8)
  m.setU32(ppDataTablesIat, pDataTables)
  m.setU32(0x6fd1829c, ppDataTablesIat)
  m.setU32(0x6fde9e1c, pDataTables)
  const pItemsTxt = m.alloc(0x1000)
  m.setU32(0x6fdefb94, 4)
  m.setU32(0x6fdefb98, pItemsTxt)
  const pItemTypesTxt = m.alloc(0x1000)
  for (let off = 0x10; off <= 0x18; off++) {
    m.setU8(pItemTypesTxt + off, 1)
  }
  m.setU32(pDataTables + 0xbf8, pItemTypesTxt)
  m.setU32(pDataTables + 0xbfc, 4)
  m.setU32(0x6fdeff6c, m.alloc(0x20))
  m.fill(0x6fd39fa0, 0x20, 0)
  m.fill(0x6fd1bd80, 0x80, 0)
  return pDataTables
}

function allocRoomWithLevel(m: SparseMemory113c, nLevelId = 1): number {
  const pRoom = m.alloc(0x100)
  const pRoomEx = m.alloc(0x100)
  const pLevel = m.alloc(0x200)
  m.setU32(pRoom + 0x10, pRoomEx)
  m.setU32(pRoomEx + 0x58, pLevel)
  m.setU32(pLevel + 0x1d0, nLevelId)
  return pRoom
}

describe('K2 Wave 4 Batch 3 (w4b3): 45 D2Game.dll VAs', () => {
  it('[1..5] STORM_TSListArrayResize & ITEMS quality/affix fallback helpers', () => {
    const m = new SparseMemory113c()
    initSparseGlobals(m)
    const pArr = m.alloc(0x20)
    const pOldBuf = m.alloc(0x30)
    m.setU32(pArr + 0x04, 2)
    m.setU32(pArr + 0x08, pOldBuf)
    for (let i = 0; i < 2; i++) {
      const pList = pOldBuf + i * 12
      m.setU32(pList + 0x00, 4)
      m.setU32(pList + 0x04, pList + 0x04)
      m.setU32(pList + 0x08, ~(pList + 0x04) >>> 0)
    }
    STORM_TSListArrayResize_6FC22630_113c(m, pArr, 4)
    expect(m.u32(pArr)).toBe(4)
    expect(m.u32(pArr + 0x08)).not.toBe(0)

    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(0x80)
    m.setU32(pItem + 0x00, 4)
    m.setU32(pItem + 0x14, pItemData)
    const ppItem = m.alloc(8)
    m.setU32(ppItem, pItem)
    const pdwSeed = m.alloc(8)
    m.setU32(pdwSeed, 0x12345678)
    const pDrop = m.alloc(0x90)
    expect(
      ITEMS_FallbackToMagicQualityAndRollAffixes_6FC304F0_113c(m, ppItem, pdwSeed, pDrop, {
        onTryRollAndApplyMagicAffixes_6FC303C0: () => 1,
      }),
    ).toBe(1)

    expect(
      ITEMS_FallbackToRareQualityAndRollAffixes_6FC30730_113c(m, ppItem, pdwSeed, pDrop),
    ).toBe(1)

    const pNonItem = m.alloc(0x100)
    m.setU32(pNonItem, 1)
    m.setU32(pDrop + 0x08, m.alloc(0x100))
    ITEMS_ApplyTypeSpecificCreatedItemMods_6FC30600_113c(m, pNonItem, pDrop)

    const pGame = m.alloc(0x2000)
    const pUnit = m.alloc(0x100)
    const pIlvl = m.alloc(8)
    const pOutDrop = m.alloc(0x90)
    expect(
      ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c(m, pGame, pUnit, 0, pIlvl, pOutDrop, 0, 0, {
        onRollWeightedDropClassIdByLevel_6FC2FFC0: () => -1,
      }),
    ).toBe(0)
  })

  it('[6..15] ITEMS room/gold drops, MONUMOD spectral/pack/boss, GAME name & missile dmg', () => {
    const m = new SparseMemory113c()
    initSparseGlobals(m)
    const pGame = m.alloc(0x2000)
    const pRoom = allocRoomWithLevel(m, 1)
    const pCoords = m.alloc(0x20)
    const pOutDrop = m.alloc(0x90)
    expect(
      ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c(m, pCoords, pGame, pRoom, pOutDrop, {
        onRollWeightedDropClassIdByLevel_6FC2FFC0: () => -1,
      }),
    ).toBe(0)

    const pPlayer = m.alloc(0x100)
    ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c(m, pGame, pPlayer, 0)

    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(0x80)
    m.setU32(pItem + 0x00, 4)
    m.setU32(pItem + 0x14, pItemData)
    m.setU16(pItemData + 0x30, 100)
    const pDrop = m.alloc(0x90)
    let expCalled = 0
    ITEMS_RollRareAffixesByFormat_6FC354F0_113c(m, pItem, pDrop, {
      onRollRareAffixesExpansion_6FC35240: () => {
        expCalled++
        return 1
      },
    })
    expect(expCalled).toBe(1)

    const pBoss = m.alloc(0x100)
    const pMonData = m.alloc(0x60)
    m.setU32(pBoss, 1)
    m.setU32(pBoss + 0x14, pMonData)
    const pDmg = m.alloc(0x80)
    m.setU32(pDmg + 0x04, 1)
    m.setU32(pDmg + 0x08, 200)
    const pMissileUnit = m.alloc(0x100)
    m.setU32(pMissileUnit, 3)
    let spectralCalled = 0
    MONUMOD_SpectralHitMissileDamage_6FC43650_113c(m, pGame, pMissileUnit, pBoss, pDmg, {
      onApplySpectralHitElemDamage_6FC42B60: () => {
        spectralCalled++
      },
    })
    expect(spectralCalled).toBe(1)

    MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c(m, pGame, pBoss)
    MONUMOD_RollChampionOrUniqueUMods_6FC43CA0_113c(m, pGame, pBoss, 1)
    MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c(m, pBoss, pGame, 8)

    const szBase = m.alloc(0x20)
    m.setU8(szBase, 0x41)
    m.setU8(szBase + 1, 0)
    GAME_AssignUniqueGameName_6FC4BC90_113c(m, pGame, szBase, {
      onIsGameNameAvailable_6FC4ABD0: (_mem, pStr) =>
        m.u8(pStr + 1) === 0x7e && m.u8(pStr + 2) === 0x31 ? 1 : 0,
    })
    expect(m.u8(pGame + 0x2a)).toBe(0x41)
    expect(m.u8(pGame + 0x2b)).toBe(0x7e)
    expect(m.u8(pGame + 0x2c)).toBe(0x31)

    expect(PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c(m, pGame, 99, pPlayer, 10)).toBe(0)

    const pMissile = m.alloc(0x100)
    const pTarget = m.alloc(0x100)
    m.setU32(pTarget, 1)
    MISSILE_SrvDmg_ApplyOwnerDmgPercentAndDemonUndeadBonus_6FC5AAA0_113c(
      m,
      pGame,
      pMissile,
      pTarget,
      pDmg,
    )
  })

  it('[16..25] MISSILE Quest24/ChargedAura & ACT5/ACT1 quest spawn helpers', () => {
    const m = new SparseMemory113c()
    initSparseGlobals(m)
    const pGame = m.alloc(0x2000)
    const pQuestCtrl = m.alloc(0x40)
    m.setU32(pQuestCtrl + 0x08, 1)
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    const pMissile = m.alloc(0x100)
    const pPath = m.alloc(0x80)
    const pRoom = allocRoomWithLevel(m, 1)
    m.setU32(pMissile, 3)
    m.setU32(pMissile + 0x2c, pPath)
    m.setU32(pPath + 0x1c, pRoom)
    expect(MISSILE_SrvDmg_TriggerQuest24PortalSpawnOnExpire_6FC5BBB0_113c(m, pGame, pMissile, 0)).toBe(0)
    expect(MISSILE_SrvDo_LinearQuest24PortalTrigger_6FC5F670_113c(m, pGame, pMissile)).toBeDefined()
    expect(MISSILE_SrvDo_TriggerChargedAuraInDurationWindow_6FC5F7D0_113c(m, pGame, 0, 1)).toBe(1)

    const pQuest = m.alloc(0x100)
    const pQuestData = m.alloc(0x140)
    m.setU32(pQuest + 0x18, pQuestData)
    expect(ACT5Q4_AdvanceObjectToMonsterSpawn_6FC7C480_113c(m, pGame, pQuest)).toBe(0)

    const pObj = m.alloc(0x100)
    const pObjPath = m.alloc(0x80)
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x2c, pObjPath)
    m.setU32(pObjPath + 0x00, pRoom)
    const pOp = m.alloc(0x30)
    m.setU32(pOp + 0x00, pGame)
    m.setU32(pOp + 0x04, pObj)
    ACT5Q3_SpawnMonster202AndAttachQuestData_6FC7C5C0_113c(m, pOp)
    ACT5Q3_SpawnFrozenAnyaAndObject189_6FC7C690_113c(m, pQuest, pQuestData)
    ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c(m, pQuest, pObj)
    ACT5Q5_ActivateAncientStatueAndSpawnMonster_6FC7E420_113c(m, pQuest, pObj)
    ACT5Q3_RegisterAnyaObjectAndSpawnMonster200_6FC7EB30_113c(m, pOp)
    const pPlayer = m.alloc(0x100)
    const pPlrData = m.alloc(0x100)
    const pQFlags = m.alloc(0x100)
    m.setU32(pQFlags, m.alloc(0x100))
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlrData)
    m.setU32(pPlrData + 0x10, pQFlags)
    ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c(m, pGame, pPlayer)
  })

  it('[26..35] ACT1 quest descriptors/Catacombs4 sync, Griswold, Shrine & WeaponRack', () => {
    const m = new SparseMemory113c()
    initSparseGlobals(m)
    const pQuest = m.alloc(0x100)
    const pGame = m.alloc(0x2000)
    m.setU32(pQuest + 0x0c, pGame)
    ACT1Q0_InitQuestDescriptor_6FC82D90_113c(m, pQuest)
    expect(m.u32(pQuest + 0xa0)).toBe(0x6fc82410)

    const pQuestCain = m.alloc(0x100)
    ACT1_InitCainIntroQuestDescriptor_6FC82FA0_113c(m, pQuestCain)
    expect(m.u32(pQuestCain + 0xa0)).toBe(0x6fc824d0)

    const pQuestAkara = m.alloc(0x100)
    ACT1_InitAkaraIntroQuestDescriptor_6FC83CC0_113c(m, pQuestAkara)
    expect(m.u32(pQuestAkara + 0xa0)).toBe(0x6fc82e50)

    const pPlayer = m.alloc(0x100)
    const pPlrData = m.alloc(0x100)
    const pQFlags = m.alloc(0x100)
    m.setU32(pQFlags, m.alloc(0x100))
    const pPlrPath = m.alloc(0x80)
    const pRoom = allocRoomWithLevel(m, 1)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlrData)
    m.setU32(pPlayer + 0x2c, pPlrPath)
    m.setU32(pPlrPath + 0x1c, pRoom)
    m.setU32(pPlrData + 0x10, pQFlags)
    m.setU32(pPlrData + 0x9c, m.alloc(0x40))
    const pQuestCtrl = m.alloc(0x100)
    const pQuest6 = m.alloc(0x100)
    m.setU32(pQuest6 + 0x00, 6)
    m.setU32(pQuest6 + 0x18, m.alloc(0x200))
    m.setU32(pQuestCtrl, pQuest6)
    m.setU32(pGame + 0x10f4, pQuestCtrl)
    const pArg = m.alloc(0x40)
    ACT1Q6_SyncCompletionForPlayerOutsideAct1_6FC83000_113c(m, pGame, pPlayer, pArg)
    expect(ACT1Q6_SyncCompletionInCatacombs4_6FC830D0_113c(m, pGame, pPlayer, pArg)).toBe(0)

    const pTristRoom = allocRoomWithLevel(m, 38)
    const pQData = m.alloc(0x100)
    m.setU32(pQuest + 0x18, pQData)
    ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c(m, pGame, pTristRoom, 100, 100)

    expect(OBJ_CalcShrineStatBonusValue_6FC89EE0_113c(m, pPlayer, 0, 50)).toBe(0)

    const pObj = m.alloc(0x100)
    const pObjPath = m.alloc(0x40)
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x2c, pObjPath)
    const pObjCtrl = m.alloc(0x100)
    const pRegion0 = m.alloc(0x40)
    m.setU32(pRegion0 + 0x1c, 0xffffffff)
    m.setU32(pObjCtrl + 0x48, pRegion0)
    m.setU32(pGame + 0xf0, m.alloc(0x40))
    m.setU32(pGame + 0x10f0, pObjCtrl)
    OBJ_SpawnRandomMonsterTrapFromObject_6FC8A4E0_113c(m, pGame, pObj)
    expect(OBJ_TryOperateObjectIfInRange_6FC8A720_113c(m, 2, pPlayer, pGame, 999)).toBe(0)

    const pOp = m.alloc(0x30)
    m.setU32(pOp + 0x00, pGame)
    m.setU32(pOp + 0x04, pObj)
    m.setU32(pObj + 0x10, 1)
    expect(OBJ_OperateFn20_WeaponRack_6FC8B280_113c(m, pOp)).toBe(1)
  })

  it('[36..45] ArmorStand, ChestLoot, SpawnMonster369/329/326/330, TrappedSoul, Urn, Cube & Trade', () => {
    const m = new SparseMemory113c()
    initSparseGlobals(m)
    const pGame = m.alloc(0x2000)
    const pObj = m.alloc(0x100)
    const pObjData = m.alloc(0x40)
    const pObjTxt = m.alloc(0x200)
    const pObjPath = m.alloc(0x40)
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x10, 1)
    m.setU32(pObj + 0x14, pObjData)
    m.setU32(pObj + 0x2c, pObjPath)
    m.setU32(pObjData + 0x00, pObjTxt)
    m.setU32(pObj + 0x80, pGame)

    const pOp = m.alloc(0x30)
    m.setU32(pOp + 0x00, pGame)
    m.setU32(pOp + 0x04, pObj)
    m.setU32(pOp + 0x0c, m.alloc(0x20))

    expect(OBJ_OperateFn19_ArmorStand_6FC8B2E0_113c(m, pOp)).toBe(1)
    expect(OBJ_DropChestLootFromObjectUnit_6FC8B6F0_113c(m, pGame, pObj)).toBe(0)

    expect(OBJ_SpawnMonster369FromObject_6FC8B860_113c(m, pGame, pObj)).toBe(0)
    expect(OBJ_SpawnMonster329FromObject_6FC8B870_113c(m, pGame, pObj)).toBe(0)
    expect(OBJ_SpawnMonster326FromObject_6FC8B880_113c(m, pGame, pObj)).toBe(0)
    expect(OBJ_SpawnMonster330FromObject_6FC8B890_113c(m, pGame, pObj)).toBe(0)

    expect(OBJ_OperateFn48_TrappedSoul_6FC8CE10_113c(m, pOp)).toBe(0)
    expect(OBJ_OperateFn28_Urn_6FC8D7B0_113c(m, pOp)).toBe(0)

    expect(CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c(m, 0, 0, 0, 0)).toBe(0)

    const pP1 = m.alloc(0x100)
    const pP2 = m.alloc(0x100)
    m.setU8(pP1 + 0x6c, 1)
    PLRTRADE_TryInitiatePlayerTrade_6FC90D90_113c(m, pP1, pP2, pGame)
  })
})
