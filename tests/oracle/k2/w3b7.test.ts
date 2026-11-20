import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  DATATABLES_OFF_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { INVENTORY_AllocInventory113c } from '../../../src/d2kern-113c/common/inventory.ts'
import { STATLIST_CreateEx113c } from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  ACT1Q4_OnCainModeOrInteract_6FC88150_113c,
  ACT1Q4_StepCainObjectAnimAndReschedule_6FC88F00_113c,
  CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c,
  CUBE_ValidateRecipeInputSlot_6FC90240_113c,
  MISSILE_SendSyncPacket73_6FC8F740_113c,
  MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c,
  MONSTER_EventHoverMsgTimeout_6FC96570_113c,
  MONSTER_ModeChangeCorpse_6FC95460_113c,
  MONSTER_ModeChangeKnockback_6FC95160_113c,
  MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c,
  MONSTER_StartGetHitOrScheduleAi_6FC965E0_113c,
  MONSTER_StartMode8CastA_6FC96A50_113c,
  MONSTER_StartMode8CastB_6FC96B20_113c,
  MONSTER_StepSkillCastAnim_6FC96F20_113c,
  NET_SendEventMessagePacket5A_6FC90BF0_113c,
  OBJ_ApplyShrineAuraStatList_6FC8A960_113c,
  OBJ_ClearObject151OwnerIfMatchingPlayer_6FC8A1A0_113c,
  OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c,
  OBJ_EventHoverMsgTimeout_6FC8E470_113c,
  OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c,
  OBJ_HealLifeCurePoisonFreezeAndPurgeStates_6FC89DE0_113c,
  OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c,
  OBJ_IsEligibleMonsterForShrineUpgrade_6FC8A440_113c,
  OBJ_OnStaminaShrineStateRemoved_6FC8A900_113c,
  OBJ_OperateBookOrSpecialContainer_6FC8A7A0_113c,
  OBJ_OperateBreakawayObject_6FC8D8F0_113c,
  OBJ_OperateGenericMode0To1_6FC8DE00_113c,
  OBJ_OperateShrine_6FC8DA00_113c,
  OBJ_OperateToggleDoorWithCooldown_6FC8DEC0_113c,
  OBJ_OperateWaypoint_6FC8CF90_113c,
  OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c,
  OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c,
  OBJ_ShrineEffectFireNovaAndHpDamage_6FC8C900_113c,
  OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c,
  OBJ_SpawnCompanionObjectsA2AndA0_6FC8BF00_113c,
  OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c,
  OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c,
  OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c,
  OBJ_SyncObjectMode2Or5ByCollision_6FC8A220_113c,
  OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c,
  PLAYER_ClearCursorItemAndNotify42_6FC97D90_113c,
  PLAYER_FreePlayerDataField5CList_6FC900C0_113c,
  QUESTS_AllocBitBufferPair_6FC89360_113c,
  QUESTS_FreeBitBufferPair_6FC892D0_113c,
  SKILLS_CalcUnitSkillToHit_6FC89B00_113c,
} from '../../../src/d2kern-113c/game/k2-w3b7-113c.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ItemsTxt_SIZE,
  D2ItemStatCostTxt_SIZE,
  D2LevelsTxt_SIZE,
  D2MonStats2Txt_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { SG_ITEM_DATATABLES_VA_113C } from '../../../src/d2kern-113c/tables/item-tbls-113c.ts'

function createW3B7TestWorld() {
  const m = new SparseMemory113c()
  m.fill(0x6fde8000, 0xc000, 0)
  const pDataTables = m.alloc(0x1200)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  const pBitMasks = m.u32(0x6fd18be0)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)
  m.setU32(0x6fdeff6c, m.alloc(0x10))

  const monStatsCount = 600
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    const rec = pMonStatsTxt + i * 0x1a8
    m.setU16(rec + 0x02, i)
    m.setU16(rec + 0x18, i)
  }

  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, monStatsCount)

  const skillsCount = 300
  const pSkillsTxt = m.alloc(skillsCount * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, skillsCount)

  const iscCount = 360
  const pItemStatCostTxt = m.alloc(iscCount * D2ItemStatCostTxt_SIZE)
  m.setU32(pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt, pItemStatCostTxt)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount, iscCount)

  const itemsCount = 32
  const pItemsTxt = m.alloc(itemsCount * D2ItemsTxt_SIZE)
  m.setU32(SG_ITEM_DATATABLES_VA_113C, itemsCount)
  m.setU32(SG_ITEM_DATATABLES_VA_113C + 4, pItemsTxt)
  m.setU32(0x6fdefb94, itemsCount)
  m.setU32(0x6fdefb98, pItemsTxt)

  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, levelsCount)

  const pObjectsTxt = m.alloc(600 * 0x1c0)
  m.setU32(pDataTables + 0xc48, pObjectsTxt)
  m.setU32(pDataTables + 0xc50, 600)
  m.setU32(0x6fdf0b94, pObjectsTxt)
  m.setU32(0x6fdf0b98, 600)
  const pStateMaskExp = m.alloc(0x40)
  m.setU32(pStateMaskExp + 4 * 4, 1 << 6)
  m.setU32(pDataTables + 0xc4, 200)
  m.setU32(pDataTables + 0x100, pStateMaskExp)
  m.setU32(pDataTables + 0x104, pStateMaskExp)

  const pGame = m.alloc(0x1df4)
  m.setU32(pGame + 0x1c, 0x12340000)
  m.setU32(pGame + 0xa8, 100)
  m.setU16(pGame + 0x78, 101)
  m.setU32(pGame + 0x70, 1)
  EVENT_InitTimerQueue113c(m, pGame)

  return { m, pGame, pDataTables, pSkillsTxt, pObjectsTxt }
}

describe('D2Game 1.13c K2 Wave 3 Batch 7 (0x6FC88150..0x6FC97D90)', () => {
  it('[1/45]..[11/45] Act1Q4 Cain, Quests BitBuffer, Skill ToHit & Object Well/Heal/Effect/Ring/Owner/Collision', () => {
    const { m, pGame, pSkillsTxt } = createW3B7TestWorld()

    // [1/45] ACT1Q4_OnCainModeOrInteract_6FC88150_113c
    expect(ACT1Q4_OnCainModeOrInteract_6FC88150_113c(m, pGame, 0)).toBe(0)

    // [2/45] ACT1Q4_StepCainObjectAnimAndReschedule_6FC88F00_113c
    const pQuestData = m.alloc(0x100)
    m.setU32(pQuestData + 0x04, pGame)
    const pCainObj = m.alloc(0x100)
    const pCainPath = m.alloc(0x40)
    m.setU32(pCainObj, 2)
    m.setU32(pCainObj + 0x10, 1)
    m.setU32(pCainObj + 0x2c, pCainPath)
    ACT1Q4_StepCainObjectAnimAndReschedule_6FC88F00_113c(m, pQuestData, pCainObj)
    expect(m.u32(pCainObj + 0x10)).toBe(2)

    // [3/45] & [4/45] QUESTS_AllocBitBufferPair & QUESTS_FreeBitBufferPair
    const pPair = QUESTS_AllocBitBufferPair_6FC89360_113c(m, pGame)
    const pBuf0 = m.u32(pPair)
    const pBuf1 = m.u32(pPair + 4)
    expect(m.u32(pBuf0 + 4)).toBe(0x40)
    expect(m.u32(pBuf1 + 4)).toBe(0x40)
    QUESTS_FreeBitBufferPair_6FC892D0_113c(m, pPair, pGame)
    expect(m.u32(pPair)).toBe(0)
    expect(m.u32(pPair + 4)).toBe(0)

    // [5/45] SKILLS_CalcUnitSkillToHit_6FC89B00_113c
    const pUnit = m.alloc(0x100)
    m.setU32(pUnit, 0) // player
    m.setU32(pUnit + 0x60, INVENTORY_AllocInventory113c(m, 0, pUnit))
    STATLIST_CreateEx113c(m, pUnit, 0x80000000, pGame)
    const pSkill = m.alloc(0x40)
    m.setU32(pSkill, pSkillsTxt)
    m.setU32(pSkillsTxt + 0x198, 25)
    m.setU32(pSkillsTxt + 0x19c, 10)
    const pOutToHit = m.alloc(8)
    SKILLS_CalcUnitSkillToHit_6FC89B00_113c(m, 0, pSkill, pUnit, pOutToHit, 3)

    // [6/45] OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c
    const pWellObj = m.alloc(0x100)
    const pWellData = m.alloc(0x40)
    const pWellPath = m.alloc(0x40)
    const pWellTxt = m.alloc(0x1c0)
    m.setU32(pWellObj, 2)
    m.setU32(pWellObj + 0x10, 1)
    m.setU32(pWellObj + 0x14, pWellData)
    m.setU32(pWellObj + 0x2c, pWellPath)
    m.setU32(pWellData, pWellTxt)
    m.setU32(pWellTxt + 0x180, 10)
    m.setU8(pWellData + 0x04, 2)
    OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c(m, pGame, pWellObj)
    expect(m.u8(pWellData + 0x04)).toBe(3)

    // [7/45] OBJ_HealLifeCurePoisonFreezeAndPurgeStates_6FC89DE0_113c
    const pbHealed = m.alloc(4)
    expect(OBJ_HealLifeCurePoisonFreezeAndPurgeStates_6FC89DE0_113c(m, 0, pbHealed)).toBe(0)

    // [8/45] OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c
    m.setU32(0x6fd27e4c, 0)
    expect(OBJ_RollAndDispatchObjectEffectTable_6FC89E50_113c(m, 0, pWellObj, pGame)).toBe(0)

    // [9/45] OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c
    const pOpArgs = m.alloc(0x30)
    m.setU32(pOpArgs + 0x04, pWellObj)
    expect(OBJ_SpawnMonsterFromObjectInRings_6FC8A050_113c(m, -1, pOpArgs, 1)).toBe(0)

    // [10/45] OBJ_ClearObject151OwnerIfMatchingPlayer_6FC8A1A0_113c
    const pField7C = m.alloc(8)
    const pOwnerGuid = m.alloc(4)
    m.setU32(pOwnerGuid, 77)
    m.setU32(pField7C, pOwnerGuid)
    m.setU32(pWellObj + 0x04, 0x151)
    m.setU32(pWellObj + 0x0c, 999)
    m.setU32(pWellObj + 0x7c, pField7C)
    OBJ_ClearObject151OwnerIfMatchingPlayer_6FC8A1A0_113c(m, pGame, pWellObj, 0)
    expect(m.u32(pOwnerGuid)).toBe(0xffffffff)

    // [11/45] OBJ_SyncObjectMode2Or5ByCollision_6FC8A220_113c
    SUNIT_InsertServerUnit113c(m, pGame, pWellObj)
    OBJ_SyncObjectMode2Or5ByCollision_6FC8A220_113c(m, pGame, 999)
  })
  it('[12/45]..[28/45] Object operate dispatch, shrines, treasure, monster/companion spawn, waypoint & door', () => {
    const { m, pGame, pDataTables, pObjectsTxt } = createW3B7TestWorld()
    m.fill(0x7e780000, 0x1000, 0)
    m.fill(0x6fd1bc00, 0x400, 0)
    m.fill(0x6fd27b00, 0x400, 0)

    // [12/45]..[14/45]
    const pObj = m.alloc(0x100)
    const pObjData = m.alloc(0x40)
    const pObjPath = m.alloc(0x40)
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x04, 10)
    m.setU32(pObj + 0x0c, 1)
    m.setU32(pObj + 0x10, 0)
    m.setU32(pObj + 0x14, pObjData)
    m.setU32(pObj + 0x2c, pObjPath)
    m.setU32(pObj + 0x80, pGame)
    m.setU32(pObjData, pObjectsTxt)
    SUNIT_InsertServerUnit113c(m, pGame, pObj)

    const pOutFlag = m.alloc(4)
    expect(OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c(m, pOutFlag, 1, pGame, 0, 2)).toBe(0)
    expect(OBJ_IsEligibleMonsterForShrineUpgrade_6FC8A440_113c(m, 0, 0)).toBe(0)
    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x100)
    const pPlayerPath = m.alloc(0x80)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x2c, pPlayerPath)
    m.setU32(pPlayer + 0x60, INVENTORY_AllocInventory113c(m, 0, pPlayer))
    m.setU32(pPlayer + 0x80, pGame)
    STATLIST_CreateEx113c(m, pPlayer, 0x80000000, pGame)

    const pOpArgs = m.alloc(0x30)
    m.setU32(pOpArgs, pGame)
    m.setU32(pOpArgs + 0x04, pObj)
    m.setU32(pOpArgs + 0x08, pPlayer)
    m.setU32(pOpArgs + 0x10, 999)
    expect(OBJ_OperateBookOrSpecialContainer_6FC8A7A0_113c(m, pOpArgs)).toBe(1)
    expect(m.u32(pObj + 0x10)).toBe(0)

    // [15/45] OBJ_OnStaminaShrineStateRemoved_6FC8A900_113c
    const pStatList = m.u32(pPlayer + 0x5c)
    OBJ_OnStaminaShrineStateRemoved_6FC8A900_113c(m, pPlayer, 134, pStatList)

    // [16/45] OBJ_ApplyShrineAuraStatList_6FC8A960_113c
    OBJ_ApplyShrineAuraStatList_6FC8A960_113c(m, pGame, pPlayer, 128, 0, 0, -1, 500)

    // [17/45] OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c
    expect(OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c(m, 0x2078797a, pPlayer, pGame, 2)).toBe(0)

    // [18/45] OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c
    expect(OBJ_DropChestTreasureByActLevelTier_6FC8B570_113c(m, pOpArgs, 0)).toBe(0)

    // [19/45] OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c
    expect(OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c(m, pObj, pGame, 0)).toBe(0)

    // [20/45] OBJ_SpawnCompanionObjectsA2AndA0_6FC8BF00_113c
    m.setU32(pObjPath + 0x0c, 100)
    m.setU32(pObjPath + 0x10, 100)
    m.setU32(pObjPath + 0x1c, 0)
    OBJ_SpawnCompanionObjectsA2AndA0_6FC8BF00_113c(m, pGame, pObj)

    // [21/45], [22/45], [23/45] Shrine effects (Poison, Exploding, Fire)
    const pMissilesTxt = m.alloc(100 * 0x1a4)
    m.setU32(pDataTables + 0xb64, pMissilesTxt)
    m.setU32(pDataTables + 0xb6c, 100)
    const pShrineTxt = m.alloc(0x40)
    m.setU32(pShrineTxt + 0x04, 0)
    m.setU32(pShrineTxt + 0x08, 0)
    OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c(m, pOpArgs, pShrineTxt)
    OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c(m, pOpArgs, pShrineTxt)
    OBJ_ShrineEffectFireNovaAndHpDamage_6FC8C900_113c(m, pOpArgs, pShrineTxt)

    // [24/45] OBJ_OperateWaypoint_6FC8CF90_113c
    m.setU32(pObj + 0x10, 0)
    m.setU32(pOpArgs + 0x10, 10)
    expect(OBJ_OperateWaypoint_6FC8CF90_113c(m, pOpArgs)).toBe(1)
    expect(m.u32(pObj + 0x10)).toBe(1)

    // [25/45] OBJ_OperateBreakawayObject_6FC8D8F0_113c
    expect(OBJ_OperateBreakawayObject_6FC8D8F0_113c(m, pOpArgs)).toBe(1)

    // [26/45] OBJ_OperateShrine_6FC8DA00_113c
    expect(OBJ_OperateShrine_6FC8DA00_113c(m, pOpArgs)).toBe(0)

    // [27/45] OBJ_OperateGenericMode0To1_6FC8DE00_113c
    m.setU32(pObj + 0x10, 0)
    expect(OBJ_OperateGenericMode0To1_6FC8DE00_113c(m, pOpArgs)).toBe(1)
    expect(m.u32(pObj + 0x10)).toBe(1)

    // [28/45] OBJ_OperateToggleDoorWithCooldown_6FC8DEC0_113c
    expect(OBJ_OperateToggleDoorWithCooldown_6FC8DEC0_113c(m, pOpArgs, 0x2000)).toBe(1)
  })

  it('[29/45]..[45/45] Object events, Missile 73, Player 5C, Cube, Net 5A & Monster modes/cast', () => {
    const { m, pGame } = createW3B7TestWorld()
    m.fill(0x7e780000, 0x1000, 0)
    m.fill(0x6fd1bc00, 0x400, 0)

    const pObj = m.alloc(0x100)
    m.setU32(pObj, 2)
    // [29/45] & [30/45] Object events
    OBJ_EventHoverMsgTimeout_6FC8E470_113c(m, pGame, pObj)
    OBJ_EventPeriodicOrTimeOfDaySync_6FC8E4E0_113c(m, pGame, pObj)

    // [31/45] MISSILE_SendSyncPacket73_6FC8F740_113c
    MISSILE_SendSyncPacket73_6FC8F740_113c(m, pGame, 0, 0, 0)

    // [32/45] PLAYER_FreePlayerDataField5CList_6FC900C0_113c
    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x100)
    const pStruct5C = m.alloc(0x20)
    const pNode1 = m.alloc(0x20)
    m.setU32(pPlayer, 0)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayerData + 0x5c, pStruct5C)
    m.setU32(pStruct5C + 0x08, pNode1)
    PLAYER_FreePlayerDataField5CList_6FC900C0_113c(m, pPlayer, pGame)
    expect(m.u32(pPlayerData + 0x5c)).toBe(0)

    // [33/45] CUBE_ValidateRecipeInputSlot_6FC90240_113c
    expect(CUBE_ValidateRecipeInputSlot_6FC90240_113c(m, 0, pGame, 0, 0, 0, 0)).toBe(0)

    // [34/45] NET_SendEventMessagePacket5A_6FC90BF0_113c
    const szName = m.alloc(16)
    m.setU8(szName, 0x41)
    NET_SendEventMessagePacket5A_6FC90BF0_113c(m, szName, 2, pPlayer)

    // [35/45] CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c
    expect(CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c(m, pGame, 10, 1)).toBe(0)

    // [36/45]..[44/45] Monster mode changes & cast
    const pMon = m.alloc(0x100)
    const pMonData = m.alloc(0x80)
    const pMonPath = m.alloc(0x80)
    m.setU32(pMon, 1)
    m.setU32(pMon + 0x14, pMonData)
    m.setU32(pMon + 0x2c, pMonPath)
    m.setU32(pMonPath + 0x30, pMon)
    STATLIST_CreateEx113c(m, pMon, 0x80000000, pGame)
    const pModeArgs = m.alloc(0x30)
    m.setU32(pModeArgs + 0x04, pMon)

    expect(MONSTER_ModeChangeKnockback_6FC95160_113c(m, pGame, pModeArgs)).toBe(0)
    expect(MONSTER_ModeChangeCorpse_6FC95460_113c(m, pGame, pModeArgs)).toBe(1)
    expect(m.u32(pMon + 0x10)).toBe(12)

    MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c(m, pMon, pGame)
    MONSTER_NotifyOwnerOrDistributeExpOnDeath_6FC960F0_113c(m, pMon, pGame)
    MONSTER_EventHoverMsgTimeout_6FC96570_113c(m, pGame, pMon)
    MONSTER_StartGetHitOrScheduleAi_6FC965E0_113c(m, pGame, pMon)
    MONSTER_StartMode8CastA_6FC96A50_113c(m, pGame, pMon)
    MONSTER_StartMode8CastB_6FC96B20_113c(m, pGame, pMon)
    expect(MONSTER_StepSkillCastAnim_6FC96F20_113c(m, pGame, pMon)).toBe(1)
    m.setU32(pMon + 0x44, m.u32(pMon + 0x48))
    expect(MONSTER_StepSkillCastAnim_6FC96F20_113c(m, pGame, pMon)).toBe(2)

    // [45/45] PLAYER_ClearCursorItemAndNotify42_6FC97D90_113c
    m.setU32(pPlayer + 0x60, INVENTORY_AllocInventory113c(m, 0, pPlayer))
    PLAYER_ClearCursorItemAndNotify42_6FC97D90_113c(m, pPlayer, 0)
  })
})
