import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
  DATATABLES_OFF_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  INVENTORY_AllocInventory113c,
  INVENTORY_LinkItemToInventoryList113c,
} from '../../../src/d2kern-113c/common/inventory.ts'
import {
  DRLGWARP_TestRoomTileBit113c,
  ITEMS_CheckCommandFlags113c,
  ITEMS_CheckItemFlag113c,
  ITEMS_SetBodyLocation113c,
  ITEMS_SetInvPage113c,
  ITEMS_SetItemQuality113c,
} from '../../../src/d2kern-113c/common/items.ts'
import { QUESTRECORD_SetQuestState113c } from '../../../src/d2kern-113c/common/quest-record.ts'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import {
  ACT3Q2_Callback14_RemovePlayerGuid_6FD03B30_113c,
  ACT3Q2_InitGidbinnAltarObject_6FD04120_113c,
  ACT3Q2_OnGidbinnItemRemoved_6FD02D00_113c,
  ACT3Q2_OnPlayerEnteredCheckGidbinn_6FD041A0_113c,
  ACT3Q3_CountPlayerMissingKhalimBrain_6FD04830_113c,
  ACT3Q3_CountPlayerMissingKhalimEye_6FD04890_113c,
  ACT3Q3_CountPlayerMissingKhalimHeart_6FD047D0_113c,
  ACT3Q3_InitSewerLeverObject_6FD04980_113c,
  ACT3Q3_InitSewerStairsObject_6FD02E00_113c,
  ACT3Q4_Callback14_RemovePlayerGuid_6FD05220_113c,
  ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c,
  ACT3Q4_CheckPlayerHasLamEsensTome_6FD05080_113c,
  ACT3Q4_GrantPlayerStatPointsReward_6FD06470_113c,
  ACT3Q4_OnAlkorInteractPlayVoice_6FD051C0_113c,
  ACT3Q5_Callback14_RemovePlayerGuid_6FD03390_113c,
  ACT3Q5_InitCompellingOrbObject_6FD02A00_113c,
  ACT3Q5_UpdatePlayerQuestState0E_6FD05CD0_113c,
  ACT3Q6_Callback14_RemovePlayerGuid_6FD03960_113c,
  ACT3Q6_UpdatePlayerQuestState0E_6FD05B10_113c,
  AI_ApproachTargetPathType13_6FD13000_113c,
  AI_RunTowardTarget_6FD12F00_113c,
  AI_ScheduleAiThinkTimer_6FD120C0_113c,
  AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c,
  AI_StartModeAtCoordsKeepSteps_6FD121E0_113c,
  AI_StartModeAtCoordsStep0_6FD11FA0_113c,
  AI_StartModeAtCoordsStep1_6FD11FF0_113c,
  AI_WalkTowardTarget_6FD12F30_113c,
  D2GAME_IAT_GET_TICK_COUNT_VA_113C,
  D2GAME_PLAYERLIST_CPP_STR_VA_113C,
  ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c,
  ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c,
  ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c,
  ITEMS_OnCharmPlacedInInventory_6FCF6710_113c,
  ITEMS_OnInsertOrEquipUpdateStats_6FCF4FF0_113c,
  ITEMS_PlaceItemInSocketInventory_6FCF1650_113c,
  MONSTER_SpawnAtCoords_6FD0F450_113c,
  MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c,
  PACKET_Recv12_ClearGfxState0C_6FCEB590_113c,
  PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c,
  PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c,
  PLAYERLIST_SetHostileDelayTick_6FD10090_113c,
  SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c,
  SUNIT_FreeCombatListAndChangeAnimMode_6FCFF980_113c,
  SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c,
  SUNIT_SetLastKillerInfo_6FCFFAE0_113c,
  SUNIT_SetPlayerClientPtr_6FD00040_113c,
  SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c,
} from '../../../src/d2kern-113c/game/k2-w2b8-113c.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  EVENT_GetNextEventFrame113c,
  EVENT_InitTimerQueue113c,
  EVENT_SetEventFull113c,
} from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ItemsTxt,
  D2ItemsTxt_SIZE,
  D2ItemStatCostTxt_SIZE,
  D2LevelsTxt_SIZE,
  D2MonStats2Txt_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { type Memory113c, SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { SG_ITEM_DATATABLES_VA_113C } from '../../../src/d2kern-113c/tables/item-tbls-113c.ts'

interface W2B8TestWorld {
  m: SparseMemory113c
  pGame: number
  pDataTables: number
  pMonStatsTxt: number
  pMonStats2Txt: number
  pSkillsTxt: number
  pItemsTxt: number
  pItemStatCostTxt: number
  pItemTypesEquiv: number
  pLevelsTxt: number
}

function createW2B8TestWorld(): W2B8TestWorld {
  const m = new SparseMemory113c()
  const pDataTables = m.alloc(0x1200)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)

  const pBitMasks = m.u32(0x6fd18be0)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)
  m.fill(0x6fd2e668, 0x120, 0)
  m.fill(0x6fd2e788, 0x94 * 16, 0)

  // Grid0 info for D2Common.#11139 / #10061 (13 body locations x 1)
  m.setU8(0x6fded378, 13)
  m.setU8(0x6fded379, 1)

  // MonStatsTxt (600 rows * 0x1A8)
  const monStatsCount = 600
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    const rec = pMonStatsTxt + i * 0x1a8
    m.setU16(rec + 0x02, i)
    m.setU16(rec + 0x18, i)
  }

  // MonStats2Txt (600 rows)
  const pMonStats2Txt = m.alloc(monStatsCount * D2MonStats2Txt_SIZE)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, monStatsCount)

  // SkillsTxt (300 rows * 0x23C)
  const skillsCount = 300
  const pSkillsTxt = m.alloc(skillsCount * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, skillsCount)

  // ItemStatCostTxt (360 rows)
  const iscCount = 360
  const pItemStatCostTxt = m.alloc(iscCount * D2ItemStatCostTxt_SIZE)
  m.setU32(pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt, pItemStatCostTxt)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount, iscCount)

  // ItemsTxt (100 rows)
  const itemsCount = 100
  const pItemsTxt = m.alloc(itemsCount * D2ItemsTxt_SIZE)
  m.setU32(SG_ITEM_DATATABLES_VA_113C, itemsCount)
  m.setU32(SG_ITEM_DATATABLES_VA_113C + 4, pItemsTxt)
  m.setU32(0x6fdefb94, itemsCount)
  m.setU32(0x6fdefb98, pItemsTxt)

  // ItemTypesTxt & equivalence bitset (64 item types, 2 dwords per row)
  const itemTypesCount = 64
  const equivDwords = 2
  const pItemTypesTxt = m.alloc(itemTypesCount * 0xe4)
  const pItemTypesEquiv = m.alloc(itemTypesCount * equivDwords * 4)
  m.setU32(pDataTables + 0xbf8, pItemTypesTxt)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nItemTypesTxtRecordCount, itemTypesCount)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nItemTypesEquivDwords, equivDwords)
  m.setU32(pDataTables + DATATABLES_OFF_113C.pItemTypesEquiv, pItemTypesEquiv)
  for (let t = 0; t < itemTypesCount; t++) {
    const col = t >> 5
    const bit = 1 << (t & 31)
    m.setU32(pItemTypesEquiv + (t * equivDwords + col) * 4, bit >>> 0)
  }

  // LevelsTxt (140 rows)
  const levelsCount = 140
  const pLevelsTxt = m.alloc(levelsCount * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc5c, levelsCount)

  // Game + Timer wheel
  const pGame = m.alloc(0x1df4)
  m.setU32(pGame + 0x1c, 0x12340000)
  m.setU32(pGame + 0xa8, 100)
  m.setU16(pGame + 0x78, 101)
  m.setU32(pGame + 0x70, 1)
  EVENT_InitTimerQueue113c(m, pGame)

  return {
    m,
    pGame,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pItemsTxt,
    pItemStatCostTxt,
    pItemTypesEquiv,
    pLevelsTxt,
  }
}

function allocPlayerUnit(
  m: SparseMemory113c,
  pGame: number,
  unitId = 1,
  classId = 0,
): { pPlayer: number; pPlayerData: number; pInventory: number; pPath: number; pQuestFlags: number } {
  const pPlayer = m.alloc(0x100)
  const pPlayerData = m.alloc(0x180)
  const pPath = m.alloc(0x100)
  const pQuestFlags = m.alloc(0x10)
  const pQuestBuf = m.alloc(0x60)
  m.setU32(pQuestFlags, pQuestBuf)
  m.setU32(pQuestFlags + 4, 0x300)
  const pInventory = INVENTORY_AllocInventory113c(m, 0, pPlayer)

  m.setU32(pPlayer, 0) // UNIT_PLAYER
  m.setU32(pPlayer + 0x04, classId)
  m.setU32(pPlayer + 0x0c, unitId)
  m.setU32(pPlayer + 0x14, pPlayerData)
  m.setU32(pPlayer + 0x2c, pPath)
  m.setU32(pPlayer + 0x60, pInventory)
  m.setU32(pPlayer + 0x80, pGame)
  m.setU32(pPlayerData + 0x10, pQuestFlags)
  m.setU32(pPlayerData + 0x14, pQuestFlags)
  m.setU32(pPlayerData + 0x18, pQuestFlags)
  STATLIST_CreateEx113c(m, pPlayer, 0x80000000, pGame)

  return { pPlayer, pPlayerData, pInventory, pPath, pQuestFlags }
}

function allocItemUnit(
  m: SparseMemory113c,
  pGame: number,
  classId: number,
  unitId: number,
  quality = 2,
): { pItem: number; pItemData: number; pPath: number } {
  const pItem = m.alloc(0x100)
  const pItemData = m.alloc(0x74)
  const pPath = m.alloc(0x20)
  m.setU32(pItem, 4) // UNIT_ITEM
  m.setU32(pItem + 0x04, classId)
  m.setU32(pItem + 0x0c, unitId)
  m.setU32(pItem + 0x14, pItemData)
  m.setU32(pItem + 0x2c, pPath)
  m.setU32(pItem + 0x80, pGame)
  ITEMS_SetItemQuality113c(m, pItem, quality)
  STATLIST_CreateEx113c(m, pItem, 0, pGame)
  return { pItem, pItemData, pPath }
}

function allocMonsterUnit(
  m: SparseMemory113c,
  pGame: number,
  classId: number,
  unitId: number,
  posX = 100,
  posY = 100,
  levelId = 2,
): {
  pMonster: number
  pMonData: number
  pAiGen: number
  pAiCtrl: number
  pPath: number
  pRoom: number
  pRoomEx: number
} {
  const pMonster = m.alloc(0x100)
  const pMonData = m.alloc(0x60)
  const pAiGen = m.alloc(0x48)
  const pAiCtrl = m.alloc(0x48)
  const pPath = m.alloc(0x100)
  const pSkills = m.alloc(0x20)

  const pRoom = m.alloc(0x100)
  const pRoomEx = m.alloc(0x90)
  const pLevel = m.alloc(0x200)
  m.setU32(pRoom + 0x10, pRoomEx)
  m.setU32(pRoom + 0x4c, posX - 10)
  m.setU32(pRoom + 0x50, posY - 10)
  m.setU32(pRoom + 0x54, 40)
  m.setU32(pRoom + 0x58, 40)
  m.setU32(pRoomEx + 0x58, pLevel)
  m.setU32(pLevel + 0x1d0, levelId)

  m.setU32(pPath + 0x00, posX << 16)
  m.setU32(pPath + 0x04, posY << 16)
  m.setU16(pPath + 0x02, posX)
  m.setU16(pPath + 0x06, posY)
  m.setU32(pPath + 0x1c, pRoom)

  m.setU32(pMonster, 1) // UNIT_MONSTER
  m.setU32(pMonster + 0x04, classId)
  m.setU32(pMonster + 0x0c, unitId)
  m.setU32(pMonster + 0x10, 1)
  m.setU32(pMonster + 0x14, pMonData)
  m.setU32(pMonster + 0x20, 12345)
  m.setU32(pMonster + 0x24, 666)
  m.setU32(pMonster + 0x2c, pPath)
  m.setU32(pMonster + 0x80, pGame)
  m.setU32(pMonster + 0xa8, pSkills)
  m.setU32(pMonster + 0xc4, 0x04)

  const pTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C))
  const pMonStatsBase = pTables !== 0 ? m.u32(pTables + 0xa78) : 0
  if (pMonStatsBase !== 0 && classId >= 0) {
    m.setU32(pMonData, pMonStatsBase + classId * 0x1a8)
  }
  m.setU32(pMonData + 0x28, pAiGen)
  m.setU32(pMonData + 0x2c, pAiCtrl)
  m.setU32(pAiGen + 0x28, pGame)
  m.setU32(pAiGen + 0x2c, 0xffffffff)
  m.setU32(pAiGen + 0x30, 1)
  STATLIST_CreateEx113c(m, pMonster, 0x80000000, pGame)

  return { pMonster, pMonData, pAiGen, pAiCtrl, pPath, pRoom, pRoomEx }
}

describe('D2Game.dll [K2] Wave 2 Batch 8 (w2b8: 0x6FCEB590..0x6FD13CB0)', () => {
  it('1. PACKET_Recv12_ClearGfxState0C_6FCEB590_113c validates length and clears state 0x0C', () => {
    const { m, pGame } = createW2B8TestWorld()
    const { pPlayer } = allocPlayerUnit(m, pGame, 1)
    const pPacket = m.alloc(8)
    m.setU8(pPacket, 0x12)

    STATES_ToggleGfxStateFlag113c(m, pPlayer, 0x0c, 1)
    expect(STATES_CheckState113c(m, pPlayer, 0x0c)).not.toBe(0)

    expect(PACKET_Recv12_ClearGfxState0C_6FCEB590_113c(m, pPlayer, pPacket, 2)).toBe(3)
    expect(STATES_CheckState113c(m, pPlayer, 0x0c)).not.toBe(0)

    expect(PACKET_Recv12_ClearGfxState0C_6FCEB590_113c(m, pPlayer, pPacket, 1)).toBe(0)
    expect(STATES_CheckState113c(m, pPlayer, 0x0c)).toBe(0)
  })

  it('2. PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c validates phrase bounds and sound flag', () => {
    const { m, pGame } = createW2B8TestWorld()
    const { pPlayer } = allocPlayerUnit(m, pGame, 1)
    const pPacket = m.alloc(8)
    m.setU8(pPacket, 0x3f)

    // Invalid packet length -> 3
    expect(PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c(m, pPlayer, pPacket, 2)).toBe(3)

    // Out-of-range phrase ID (< 0x19 or > 0x20) -> 0 without setting event sound
    m.setU16(pPacket + 1, 0x18)
    expect(PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c(m, pPlayer, pPacket, 3)).toBe(0)
    m.setU16(pPacket + 1, 0x21)
    expect(PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c(m, pPlayer, pPacket, 3)).toBe(0)

    // Valid phrase ID 0x1A while UNITFLAG bit 10 (0x400) is set -> 1
    m.setU16(pPacket + 1, 0x1a)
    m.setU32(pPlayer + 0xc4, 0x400)
    expect(PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c(m, pPlayer, pPacket, 3)).toBe(1)

    // Valid phrase ID 0x1A with bit 10 clear -> 0 and sets event sound on pPlayer (+0x6E)
    m.setU32(pPlayer + 0xc4, 0)
    expect(PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c(m, pPlayer, pPacket, 3)).toBe(0)
    expect((m.u32(pPlayer + 0xc4) & 0x400) !== 0).toBe(true)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x1a)
  })

  it('3. ITEMS_PlaceItemInSocketInventory_6FCF1650_113c asserts non-null and links socket item', () => {
    const { m, pGame } = createW2B8TestWorld()
    const { pPlayer, pInventory } = allocPlayerUnit(m, pGame, 1)
    const { pItem } = allocItemUnit(m, pGame, 5, 42)

    expect(() => ITEMS_PlaceItemInSocketInventory_6FCF1650_113c(m, 0, pItem)).toThrow(
      D2CommonAssertError,
    )
    expect(() => ITEMS_PlaceItemInSocketInventory_6FCF1650_113c(m, pPlayer, 0)).toThrow(
      D2CommonAssertError,
    )

    expect(ITEMS_PlaceItemInSocketInventory_6FCF1650_113c(m, pPlayer, pItem)).toBe(1)
    expect(m.u32(pItem + 0x10)).toBe(4)
    expect(ITEMS_CheckItemFlag113c(m, pItem, 0x100000)).not.toBe(0)
    expect(m.u32(m.u32(pInventory + 0x2c))).toBe(42)
    expect(m.u32(pPlayer + 0xc8) & 3).toBe(3)
  })

  it('4. ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c expires timed sublists at game frame', () => {
    const { m, pGame } = createW2B8TestWorld()
    const { pItem } = allocItemUnit(m, pGame, 1, 10)
    m.setU32(pGame + 0xa8, 250)
    ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c(m, pGame, pItem)
    expect(m.u32(pGame + 0xa8)).toBe(250)
  })

  it('5. ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c checks SKILLS_GetSkillUseFailReason', () => {
    const { m, pGame, pSkillsTxt } = createW2B8TestWorld()
    const { pPlayer } = allocPlayerUnit(m, pGame, 1)
    const pSkill = m.alloc(0x40)

    // pSkill with null pSkillsTxt -> fail reason 3 -> not 2 or 7 -> returns 1
    expect(ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c(m, pPlayer, pSkill)).toBe(1)

    // Valid pSkillsTxt with bit 3 of byte +0x05 set, but null pUnit -> fail reason 7 -> returns 0
    m.setU8(pSkillsTxt + 0x05, 0x04)
    m.setU32(pSkill, pSkillsTxt)
    expect(ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c(m, 0, pSkill)).toBe(0)
  })

  it('6. ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c resolves composite and off-hand weapon', () => {
    const { m, pGame, pItemsTxt } = createW2B8TestWorld()
    const { pPlayer, pInventory } = allocPlayerUnit(m, pGame, 1)
    const pOutPrimary = m.alloc(4)
    const pOutSecondary = m.alloc(4)

    // Configure item class 10 as weapon type 45 (0x2D), item class 11 as non-weapon type 2
    m.set(pItemsTxt + 10 * D2ItemsTxt_SIZE, D2ItemsTxt.wType1, 45)
    m.set(pItemsTxt + 11 * D2ItemsTxt_SIZE, D2ItemsTxt.wType1, 2)

    const { pItem: pWeaponR } = allocItemUnit(m, pGame, 10, 101)
    const { pItem: pWeaponL } = allocItemUnit(m, pGame, 10, 102)
    const { pItem: pShieldL } = allocItemUnit(m, pGame, 11, 103)

    // Initialize grid 0 by reading body loc 4, then populate slots 4 (RARM) and 5 (LARM)
    ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c(m, pPlayer, pOutPrimary, pOutSecondary)
    expect(m.u32(pOutPrimary)).toBe(0)
    expect(m.u32(pOutSecondary)).toBe(0)

    const pGrid0 = m.u32(pInventory + 0x14)
    const pBodySlots = m.u32(pGrid0 + 0x0c)
    m.setU32(pBodySlots + 4 * 4, pWeaponR)
    m.setU32(pBodySlots + 5 * 4, pWeaponL)
    m.setU32(pInventory + 0x1c, 101) // composite weapon GUID = pWeaponR

    ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c(m, pPlayer, pOutPrimary, pOutSecondary)
    expect(m.u32(pOutPrimary)).toBe(pWeaponR)
    expect(m.u32(pOutSecondary)).toBe(pWeaponL)

    // If left arm holds a shield (not type 0x2D), secondary is cleared to 0
    m.setU32(pBodySlots + 5 * 4, pShieldL)
    ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c(m, pPlayer, pOutPrimary, pOutSecondary)
    expect(m.u32(pOutPrimary)).toBe(pWeaponR)
    expect(m.u32(pOutSecondary)).toBe(0)
  })

  it('7. ITEMS_OnInsertOrEquipUpdateStats_6FCF4FF0_113c skips weapon swap slots and activates equipped stats', () => {
    const { m, pGame, pItemsTxt } = createW2B8TestWorld()
    const { pPlayer, pInventory } = allocPlayerUnit(m, pGame, 1)
    m.setU32(pPlayer + 0x2c, 0) // clear pPath so UNITS_SetUnitAnimMode113c is skipped in headless test
    m.set(pItemsTxt + 10 * D2ItemsTxt_SIZE, D2ItemsTxt.wType1, 45)
    const { pItem } = allocItemUnit(m, pGame, 10, 201)

    // Alt weapon swap slot 0x0B -> early return without updating weapon GUID
    m.setU32(pInventory + 0x1c, 0xffffffff)
    ITEMS_SetBodyLocation113c(m, pItem, 0x0b)
    ITEMS_OnInsertOrEquipUpdateStats_6FCF4FF0_113c(m, pPlayer, pItem, pGame)
    expect(m.u32(pInventory + 0x1c)).toBe(0xffffffff)

    // Primary weapon slot 4 in animMode 1 (EQUIP) -> updates weapon GUID and activates stats
    ITEMS_SetBodyLocation113c(m, pItem, 4)
    m.setU32(pItem + 0x10, 1)
    const pGrid0 = m.alloc(0x10)
    const pSlots = m.alloc(13 * 4)
    m.setU8(pGrid0 + 8, 13)
    m.setU8(pGrid0 + 9, 1)
    m.setU32(pGrid0 + 0x0c, pSlots)
    m.setU32(pSlots + 4 * 4, pItem)
    m.setU32(pInventory + 0x14, pGrid0)
    m.setU32(pInventory + 0x18, 1)

    ITEMS_OnInsertOrEquipUpdateStats_6FCF4FF0_113c(m, pPlayer, pItem, pGame)
    expect(m.u32(pInventory + 0x1c)).toBe(201)
  })

  it('8. ITEMS_OnCharmPlacedInInventory_6FCF6710_113c sets command flag 0x10 and checks charm usability', () => {
    const { m, pGame } = createW2B8TestWorld()
    const { pPlayer } = allocPlayerUnit(m, pGame, 1)
    const { pItem } = allocItemUnit(m, pGame, 15, 301)

    // Non-inventory mode (mode = 4) -> sets command flag 0x10 and returns early
    m.setU32(pItem + 0x10, 4)
    ITEMS_OnCharmPlacedInInventory_6FCF6710_113c(m, pPlayer, pItem, pGame)
    expect(ITEMS_CheckCommandFlags113c(m, pItem, 0x10)).not.toBe(0)

    // Inventory mode (mode = 0)
    m.setU32(pItem + 0x10, 0)
    ITEMS_OnCharmPlacedInInventory_6FCF6710_113c(m, pPlayer, pItem, pGame)
    expect(ITEMS_CheckCommandFlags113c(m, pItem, 0x10)).not.toBe(0)
  })

  it('9. SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c adds mana clamped to maxmana', () => {
    const { m, pGame } = createW2B8TestWorld()
    const { pPlayer } = allocPlayerUnit(m, pGame, 1)

    STATLIST_SetUnitStat113c(m, pPlayer, 9, 100 << 8, 0) // STAT_MAXMANA = 9
    STATLIST_SetUnitStat113c(m, pPlayer, 8, 60 << 8, 0) // STAT_MANA = 8

    expect(SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c(m, pPlayer, 0)).toBe(0)
    expect(SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c(m, pPlayer, -10)).toBe(0)

    expect(SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c(m, pPlayer, 25 << 8)).toBe(25 << 8)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 8, 0)).toBe(85 << 8)

    expect(SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c(m, pPlayer, 50 << 8)).toBe(15 << 8)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 8, 0)).toBe(100 << 8)
  })

  it('10. SUNIT_FreeCombatListAndChangeAnimMode_6FCFF980_113c frees combat list and changes anim mode', () => {
    const { m, pGame } = createW2B8TestWorld()
    const { pMonster } = allocMonsterUnit(m, pGame, 1, 50)
    SUNIT_FreeCombatListAndChangeAnimMode_6FCFF980_113c(m, pMonster, pGame, 2)
    expect(m.u32(pMonster + 0x10)).toBe(2)
  })

  it('11. SUNIT_SetLastKillerInfo_6FCFFAE0_113c records killer info only when bHasKiller is 0', () => {
    const { m, pGame } = createW2B8TestWorld()
    const { pPlayer } = allocPlayerUnit(m, pGame, 1)

    SUNIT_SetLastKillerInfo_6FCFFAE0_113c(m, pPlayer, 777, 1)
    expect(m.u32(pPlayer + 0x64)).toBe(1)
    expect(m.u32(pPlayer + 0x68)).toBe(777)
    expect(m.u8(pPlayer + 0x6c)).toBe(1)

    // Subsequent call when bHasKiller === 1 does not overwrite
    SUNIT_SetLastKillerInfo_6FCFFAE0_113c(m, pPlayer, 999, 0)
    expect(m.u32(pPlayer + 0x64)).toBe(1)
    expect(m.u32(pPlayer + 0x68)).toBe(777)
  })

  it('12. SUNIT_SetPlayerClientPtr_6FD00040_113c asserts player unit and stores pClient at +0x9C', () => {
    const { m, pGame } = createW2B8TestWorld()
    const { pPlayer, pPlayerData } = allocPlayerUnit(m, pGame, 1)
    const { pMonster } = allocMonsterUnit(m, pGame, 1, 2)

    expect(() => SUNIT_SetPlayerClientPtr_6FD00040_113c(m, 0, 0x55550000)).toThrow(
      D2CommonAssertError,
    )
    expect(() => SUNIT_SetPlayerClientPtr_6FD00040_113c(m, pMonster, 0x55550000)).toThrow(
      D2CommonAssertError,
    )

    SUNIT_SetPlayerClientPtr_6FD00040_113c(m, pPlayer, 0x55551234)
    expect(m.u32(pPlayerData + 0x9c)).toBe(0x55551234)
  })

  it('13. SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c clears timeout fields and deletes event 0x0E', () => {
    const { m, pGame } = createW2B8TestWorld()
    const { pPlayer, pPlayerData } = allocPlayerUnit(m, pGame, 1)
    const { pMonster } = allocMonsterUnit(m, pGame, 1, 2)

    expect(SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, 0)).toBe(0)
    expect(SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pMonster)).toBe(0)

    m.setU32(pPlayerData + 0x148, 111)
    m.setU32(pPlayerData + 0x14c, 222)
    EVENT_SetEventFull113c(m, pGame, pPlayer, 0x0e, 150, 0x6fd00410, 0, 0)
    expect(EVENT_GetNextEventFrame113c(m, pPlayer, 0x0e)).toBe(150)

    expect(SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c(m, pGame, pPlayer)).toBe(1)
    expect(m.u32(pPlayerData + 0x148)).toBe(0)
    expect(m.u32(pPlayerData + 0x14c)).toBe(0)
    expect(EVENT_GetNextEventFrame113c(m, pPlayer, 0x0e)).toBe(0)
  })

  it('14. SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c validates path target and rejects self-target', () => {
    const { m, pGame } = createW2B8TestWorld()
    const { pMonster, pPath } = allocMonsterUnit(m, pGame, 1, 10)
    const { pMonster: pTarget } = allocMonsterUnit(m, pGame, 1, 20)
    SUNIT_InsertServerUnit113c(m, pGame, pTarget)

    // Valid target in game
    m.setU32(pPath + 0x58, pTarget)
    m.setU32(pPath + 0x5c, 1)
    m.setU32(pPath + 0x60, 20)
    expect(SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(m, pMonster, pGame)).toBe(pTarget)

    // Self-target returns 0
    SUNIT_InsertServerUnit113c(m, pGame, pMonster)
    m.setU32(pPath + 0x58, pMonster)
    m.setU32(pPath + 0x5c, 1)
    m.setU32(pPath + 0x60, 10)
    expect(SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c(m, pMonster, pGame)).toBe(0)
  })

  it('15-20. Act 3 object init, Gidbinn item removal, and callback 14 wrappers (0x6FD02A00..0x6FD03B30)', () => {
    const { m, pGame, pItemsTxt } = createW2B8TestWorld()
    const pQuestControl = m.alloc(0x20)
    const pQuest10 = m.alloc(0x100)
    const pQuest11 = m.alloc(0x100)
    const pQuest13 = m.alloc(0x100)
    const pState10 = m.alloc(0x40)
    const pState11 = m.alloc(0x40)
    const pState13 = m.alloc(0x40)

    m.setU32(pGame + 0x10f4, pQuestControl)
    m.setU32(pQuestControl, pQuest10)
    m.setU32(pQuest10, 0x10)
    m.setU32(pQuest10 + 0x18, pState10)
    m.setU32(pQuest10 + 0xf4, pQuest11)
    m.setU32(pQuest11, 0x11)
    m.setU32(pQuest11 + 0x18, pState11)
    m.setU32(pQuest11 + 0xf4, pQuest13)
    m.setU32(pQuest13, 0x13)
    m.setU32(pQuest13 + 0x18, pState13)

    const pObj = m.alloc(0x100)
    const pObjPath = m.alloc(0x20)
    m.setU32(pObj, 2) // UNIT_OBJECT
    m.setU32(pObj + 0x0c, 500)
    m.setU32(pObj + 0x2c, pObjPath)
    const pObjInit = m.alloc(0x20)
    m.setU32(pObjInit, pGame)
    m.setU32(pObjInit + 4, pObj)

    // 15. ACT3Q5_InitCompellingOrbObject_6FD02A00_113c
    m.setU8(pState13 + 0x0c, 1)
    ACT3Q5_InitCompellingOrbObject_6FD02A00_113c(m, pObjInit)
    expect(m.u32(pObj + 0x10)).toBe(2)

    // 17. ACT3Q3_InitSewerStairsObject_6FD02E00_113c
    m.setU32(pObj + 0x10, 0)
    m.setU8(pQuest10 + 9, 0)
    ACT3Q3_InitSewerStairsObject_6FD02E00_113c(m, pObjInit)
    expect(m.u32(pObj + 0x10)).toBe(2)

    // 16. ACT3Q2_OnGidbinnItemRemoved_6FD02D00_113c
    m.set(pItemsTxt + 5 * D2ItemsTxt_SIZE, D2ItemsTxt.dwCode, 0x20333367) // 'g33 '
    const { pItem: pGidbinn } = allocItemUnit(m, pGame, 5, 600)
    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg + 8, pGidbinn)

    m.setU32(pState11 + 0x1c, 1)
    m.setU8(pState11, 1)
    m.setU8(pQuest11 + 9, 1)
    m.setU8(pQuest11 + 0x0c, 2)
    ACT3Q2_OnGidbinnItemRemoved_6FD02D00_113c(m, pQuest11, pQuestArg)
    expect(m.u32(pState11 + 0x1c)).toBe(0)
    expect(m.u8(pState11 + 0x20)).toBe(1)

    // 18, 19, 20, 29. Callback14 wrappers remove player GUID when quest bits 0 and 1 are set
    const { pPlayer, pQuestFlags } = allocPlayerUnit(m, pGame, 77)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU32(pQuest13 + 0x04, pGame)
    m.setU32(pQuest13 + 0xe0, 0x13)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x13, 0)
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x13, 1)

    m.setU32(pQuest13 + 0x1c, 77)
    m.setU16(pQuest13 + 0x9c, 1)
    ACT3Q5_Callback14_RemovePlayerGuid_6FD03390_113c(m, pQuest13, pQuestArg)
    expect(m.u16(pQuest13 + 0x9c)).toBe(0)

    m.setU32(pQuest13 + 0x1c, 77)
    m.setU16(pQuest13 + 0x9c, 1)
    ACT3Q6_Callback14_RemovePlayerGuid_6FD03960_113c(m, pQuest13, pQuestArg)
    expect(m.u16(pQuest13 + 0x9c)).toBe(0)

    m.setU32(pQuest13 + 0x1c, 77)
    m.setU16(pQuest13 + 0x9c, 1)
    ACT3Q2_Callback14_RemovePlayerGuid_6FD03B30_113c(m, pQuest13, pQuestArg)
    expect(m.u16(pQuest13 + 0x9c)).toBe(0)

    m.setU32(pQuest13 + 0x1c, 77)
    m.setU16(pQuest13 + 0x9c, 1)
    ACT3Q4_Callback14_RemovePlayerGuid_6FD05220_113c(m, pQuest13, pQuestArg)
    expect(m.u16(pQuest13 + 0x9c)).toBe(0)
  })

  it('21-26. Act 3 Gidbinn Altar, Khalim organ checks, and Sewer Lever init (0x6FD04120..0x6FD04980)', () => {
    const { m, pGame, pItemsTxt } = createW2B8TestWorld()
    const pQuestControl = m.alloc(0x20)
    const pQuest10 = m.alloc(0x100)
    const pQuest11 = m.alloc(0x100)
    const pState10 = m.alloc(0x40)
    const pState11 = m.alloc(0x40)

    m.setU32(pGame + 0x10f4, pQuestControl)
    m.setU32(pQuestControl, pQuest10)
    m.setU32(pQuest10, 0x10)
    m.setU32(pQuest10 + 0x18, pState10)
    m.setU32(pQuest10 + 0xf4, pQuest11)
    m.setU32(pQuest11, 0x11)
    m.setU32(pQuest11 + 0x18, pState11)

    // 21. ACT3Q2_InitGidbinnAltarObject_6FD04120_113c
    const pObj = m.alloc(0x100)
    const pObjPath = m.alloc(0x20)
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x0c, 888)
    m.setU32(pObj + 0x2c, pObjPath)
    const pObjInit = m.alloc(0x20)
    m.setU32(pObjInit, pGame)
    m.setU32(pObjInit + 4, pObj)
    m.setU32(pObjInit + 0x14, 5100)
    m.setU32(pObjInit + 0x18, 5200)
    m.setU32(pState11 + 0x2c, 1)

    ACT3Q2_InitGidbinnAltarObject_6FD04120_113c(m, pObjInit)
    expect(m.u32(pState11 + 0x28)).toBe(888)
    expect(m.u32(pState11 + 0x10)).toBe(5100)
    expect(m.u32(pState11 + 0x14)).toBe(5200)
    expect(m.u32(pObj + 0x10)).toBe(1)

    // 22. ACT3Q2_OnPlayerEnteredCheckGidbinn_6FD041A0_113c
    const { pPlayer, pInventory } = allocPlayerUnit(m, pGame, 1)
    m.set(pItemsTxt + 5 * D2ItemsTxt_SIZE, D2ItemsTxt.dwCode, 0x20333367) // 'g33 '
    const { pItem: pGidbinn } = allocItemUnit(m, pGame, 5, 601)
    ITEMS_SetInvPage113c(m, pGidbinn, 0)
    INVENTORY_LinkItemToInventoryList113c(m, pGidbinn, pInventory)

    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg, pGame)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU32(pState11 + 0x1c, 0)
    m.setU8(pState11 + 0x20, 1)
    ACT3Q2_OnPlayerEnteredCheckGidbinn_6FD041A0_113c(m, pQuest11, pQuestArg)
    expect(m.u32(pState11 + 0x1c)).toBe(1)
    expect(m.u8(pState11 + 0x20)).toBe(0)

    // 23, 24, 25. ACT3Q3_CountPlayerMissingKhalimHeart/Brain/Eye
    expect(ACT3Q3_CountPlayerMissingKhalimHeart_6FD047D0_113c(m, pGame, pPlayer)).toBe(0)
    expect(m.u32(pState10 + 0x0c)).toBe(1)
    expect(ACT3Q3_CountPlayerMissingKhalimBrain_6FD04830_113c(m, pGame, pPlayer)).toBe(0)
    expect(m.u32(pState10 + 0x0c)).toBe(2)
    expect(ACT3Q3_CountPlayerMissingKhalimEye_6FD04890_113c(m, pGame, pPlayer)).toBe(0)
    expect(m.u32(pState10 + 0x0c)).toBe(3)

    // 26. ACT3Q3_InitSewerLeverObject_6FD04980_113c
    m.setU8(pQuest10 + 9, 1)
    m.setU32(pState10 + 8, 1)
    ACT3Q3_InitSewerLeverObject_6FD04980_113c(m, pObjInit)
    expect(m.u8(pState10)).toBe(1)
    expect(m.u32(pState10 + 4)).toBe(888)
    expect(m.u32(pObj + 0x10)).toBe(1)

    m.setU8(pQuest10 + 9, 0)
    ACT3Q3_InitSewerLeverObject_6FD04980_113c(m, pObjInit)
    expect(m.u32(pObj + 0x10)).toBe(2)
  })

  it('27-33. Act 3 Quest 4/5/6 tome check, Alkor voice/alert, state 0E, and +5 stat reward (0x6FD05080..0x6FD06470)', () => {
    const { m, pGame, pItemsTxt } = createW2B8TestWorld()
    const pQuestControl = m.alloc(0x20)
    const pQuest0F = m.alloc(0x100)
    const pState0F = m.alloc(0x40)
    m.setU32(pGame + 0x10f4, pQuestControl)
    m.setU32(pQuestControl, pQuest0F)
    m.setU32(pQuest0F, 0x0f)
    m.setU32(pQuest0F + 0x04, pGame)
    m.setU32(pQuest0F + 0x18, pState0F)

    const { pPlayer, pInventory, pQuestFlags } = allocPlayerUnit(m, pGame, 55, 2)
    m.set(pItemsTxt + 7 * D2ItemsTxt_SIZE, D2ItemsTxt.dwCode, 0x20626262) // 'bbb '
    const { pItem: pTome } = allocItemUnit(m, pGame, 7, 701)
    ITEMS_SetInvPage113c(m, pTome, 0)
    INVENTORY_LinkItemToInventoryList113c(m, pTome, pInventory)

    // 27. ACT3Q4_CheckPlayerHasLamEsensTome_6FD05080_113c
    ACT3Q4_CheckPlayerHasLamEsensTome_6FD05080_113c(m, pGame, pPlayer)
    expect(m.u8(pState0F + 4)).toBe(1)

    // 28. ACT3Q4_OnAlkorInteractPlayVoice_6FD051C0_113c
    const pAlkor = m.alloc(0x100)
    m.setU32(pAlkor, 1)
    m.setU16(pAlkor + 4, 0xfe) // Alkor
    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg + 8, pAlkor)
    m.setU32(pQuestArg + 0x0c, pPlayer)
    m.setU8(pState0F + 0x0c, 1)
    m.setU32(pState0F + 0x10, 55)

    ACT3Q4_OnAlkorInteractPlayVoice_6FD051C0_113c(m, pQuest0F, pQuestArg)
    expect(m.u8(pState0F + 0x0c)).toBe(0)
    expect(m.u16(pPlayer + 0x6e)).toBe(0x43)

    // 30. ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c
    expect(ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c(m, pQuest0F, 0xfd, pPlayer, pQuestFlags)).toBe(0)
    // Player has 'bbb ' tome -> returns 1
    expect(ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c(m, pQuest0F, 0xfe, pPlayer, pQuestFlags)).toBe(1)

    // 31. ACT3Q6_UpdatePlayerQuestState0E_6FD05B10_113c
    expect(ACT3Q6_UpdatePlayerQuestState0E_6FD05B10_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x16, 0x0e)).toBe(1)

    // 32. ACT3Q5_UpdatePlayerQuestState0E_6FD05CD0_113c
    expect(ACT3Q5_UpdatePlayerQuestState0E_6FD05CD0_113c(m, pGame, pPlayer)).toBe(0)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x15, 0x0e)).toBe(1)

    // 33. ACT3Q4_GrantPlayerStatPointsReward_6FD06470_113c
    QUESTRECORD_SetQuestState113c(m, pQuestFlags, 0x11, 1)
    expect(ACT3Q4_GrantPlayerStatPointsReward_6FD06470_113c(m, pGame, pPlayer)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 4, 0)).toBe(5)
    expect(DRLGWARP_TestRoomTileBit113c(m, pQuestFlags, 0x11, 1)).toBe(0)
  })

  it('34-35. MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c and MONSTER_SpawnAtCoords_6FD0F450_113c', () => {
    const { m, pGame } = createW2B8TestWorld()
    const { pMonster: pLeader, pRoom } = allocMonsterUnit(m, pGame, 1, 10, 100, 100, 0)

    // Hidden / level 0 room -> returns 0
    expect(
      MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c(m, pLeader, 1, 0, pGame, 3, 0),
    ).toBe(0)

    // MONSTER_SpawnAtCoords_6FD0F450_113c with out-of-range classId returns 0 cleanly and restores stack pointer
    expect(
      MONSTER_SpawnAtCoords_6FD0F450_113c(m, 0xffffffff, -1, 1, pGame, pRoom, 100, 100, 3, 0),
    ).toBe(0)
  })

  it('36-37. PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c and PLAYERLIST_SetHostileDelayTick_6FD10090_113c', () => {
    const { m, pGame } = createW2B8TestWorld()
    const { pPlayer: pOwner, pPlayerData } = allocPlayerUnit(m, pGame, 1)
    const { pPlayer: pTarget1 } = allocPlayerUnit(m, pGame, 2)
    const { pPlayer: pTarget2 } = allocPlayerUnit(m, pGame, 3)

    const pNode1 = m.alloc(0x14)
    const pNode2 = m.alloc(0x14)
    m.setU32(pNode1, 2)
    m.setU32(pNode1 + 0x10, pNode2)
    m.setU32(pNode2, 3)
    m.setU32(pNode2 + 0x10, 0)
    m.setU32(pPlayerData + 0x38, pNode1)

    // 37. SetHostileDelayTick updates +0x08 on matching node and records tick count at +0x160
    const pTickVal = m.alloc(4)
    m.setU32(pTickVal, 987654)
    m.setU32(D2GAME_IAT_GET_TICK_COUNT_VA_113C, pTickVal)

    PLAYERLIST_SetHostileDelayTick_6FD10090_113c(m, pTarget2, pOwner, 5000)
    expect(m.u32(pNode2 + 8)).toBe(5000)
    expect(m.u32(pPlayerData + 0x160)).toBe(987654)

    PLAYERLIST_SetHostileDelayTick_6FD10090_113c(m, pTarget1, pOwner, 6000, {
      getTickCount: () => 123456,
    })
    expect(m.u32(pNode1 + 8)).toBe(6000)
    expect(m.u32(pPlayerData + 0x160)).toBe(123456)

    // 36. RemoveRelationNode unlinks pNode2 and invokes freePoolMemory hook
    const freed: Array<{ pool: number; mem: number; file: number; line: number }> = []
    PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c(m, pTarget2, pOwner, pGame, {
      freePoolMemory: (_m, pool, mem, file, line) => {
        freed.push({ pool, mem, file, line })
      },
    })
    expect(m.u32(pNode1 + 0x10)).toBe(0)
    expect(freed).toEqual([
      {
        pool: 0x12340000,
        mem: pNode2,
        file: D2GAME_PLAYERLIST_CPP_STR_VA_113C,
        line: 0x97,
      },
    ])

    // Remove head node pNode1
    PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c(m, pTarget1, pOwner, pGame)
    expect(m.u32(pPlayerData + 0x38)).toBe(0)
  })

  it('38-45. AI mode-start helpers, timer scheduling, approach wrappers, and resurrect skill/mode selector (0x6FD11FA0..0x6FD13CB0)', () => {
    const { m, pGame, pMonStats2Txt } = createW2B8TestWorld()
    const { pMonster, pAiGen, pAiCtrl, pPath } = allocMonsterUnit(m, pGame, 5, 10)
    const { pMonster: pTarget } = allocMonsterUnit(m, pGame, 1, 20)

    let lastModeArgs = { mode: -1, unit: 0, target: 0, x: 0, y: 0, step: -1 }
    const hooks = {
      onMonsterStartMode: (mem: Memory113c, _g: number, pArgs: number) => {
        lastModeArgs = {
          mode: mem.u32(pArgs) | 0,
          unit: mem.u32(pArgs + 4) >>> 0,
          target: mem.u32(pArgs + 8) >>> 0,
          x: mem.u32(pArgs + 0x0c) | 0,
          y: mem.u32(pArgs + 0x10) | 0,
          step: mem.u8(pPath + 0x93),
        }
        return 1
      },
    }

    // 38. AI_StartModeAtCoordsStep0_6FD11FA0_113c
    m.setU8(pPath + 0x93, 9)
    expect(AI_StartModeAtCoordsStep0_6FD11FA0_113c(m, pMonster, 2, pGame, 110, 120, hooks)).toBe(1)
    expect(lastModeArgs).toEqual({
      mode: 2,
      unit: pMonster,
      target: 0,
      x: 110,
      y: 120,
      step: 0,
    })

    // 39. AI_StartModeAtCoordsStep1_6FD11FF0_113c (PATH_SetStepNum(1) stores 1 - 1 = 0 at +0x93)
    m.setU8(pPath + 0x93, 9)
    expect(AI_StartModeAtCoordsStep1_6FD11FF0_113c(m, pMonster, 2, pGame, 130, 140, hooks)).toBe(1)
    expect(lastModeArgs).toEqual({
      mode: 2,
      unit: pMonster,
      target: 0,
      x: 130,
      y: 140,
      step: 0,
    })

    // 41. AI_StartModeAtCoordsKeepSteps_6FD121E0_113c
    m.setU8(pPath + 0x93, 7)
    expect(
      AI_StartModeAtCoordsKeepSteps_6FD121E0_113c(m, pMonster, 3, pGame, 150, 160, hooks),
    ).toBe(1)
    expect(lastModeArgs.step).toBe(7)
    expect(lastModeArgs.x).toBe(150)

    // 40. AI_ScheduleAiThinkTimer_6FD120C0_113c replaces existing EVENT_AITHINK (2) and defaults 0 delay to 1
    m.setU32(pGame + 0xa8, 500)
    EVENT_SetEventFull113c(m, pGame, pMonster, 2, 600, 0, 0, 0)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 2)).toBe(600)
    AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pMonster, 0)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 2)).toBe(501)
    AI_ScheduleAiThinkTimer_6FD120C0_113c(m, pGame, pMonster, 15)
    expect(EVENT_GetNextEventFrame113c(m, pMonster, 2)).toBe(515)

    // 42. AI_RunTowardTarget_6FD12F00_113c (defaults low byte 0 stepNum to 1 -> stores 0; downgrades mode 15 to 2 when state 0x3C active)
    m.setU8(pPath + 0x93, 7)
    expect(AI_RunTowardTarget_6FD12F00_113c(m, pMonster, pTarget, pGame, 0, hooks)).toBe(1)
    expect(lastModeArgs.mode).toBe(0x0f)
    expect(lastModeArgs.target).toBe(pTarget)
    expect(lastModeArgs.step).toBe(0)

    STATES_ToggleGfxStateFlag113c(m, pMonster, 0x3c, 1)
    m.setU32(pAiCtrl + 0x18, 99)
    expect(AI_RunTowardTarget_6FD12F00_113c(m, pMonster, pTarget, pGame, 5, hooks)).toBe(1)
    expect(lastModeArgs.mode).toBe(2)
    expect(m.u32(pAiCtrl + 0x18)).toBe(0)
    expect(lastModeArgs.step).toBe(4)

    // 43. AI_WalkTowardTarget_6FD12F30_113c
    expect(AI_WalkTowardTarget_6FD12F30_113c(m, pMonster, pTarget, pGame, 3, hooks)).toBe(1)
    expect(lastModeArgs.mode).toBe(2)
    expect(lastModeArgs.step).toBe(2)

    // 44. AI_ApproachTargetPathType13_6FD13000_113c sets dwPathType = 13 and handles failure flags (1|2|4)
    expect(
      AI_ApproachTargetPathType13_6FD13000_113c(m, pMonster, pTarget, pGame, 0x07, {
        onMonsterStartMode: () => 0,
      }),
    ).toBe(1)
    expect(m.u32(pAiCtrl + 0x18)).toBe(0x0d)
    expect((m.u8(pAiGen + 8) & 0x40) !== 0).toBe(true)

    // 45. AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c
    expect(AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c(m, pMonster, 0)).toBe(1)
    const pRec2 = pMonStats2Txt + 5 * D2MonStats2Txt_SIZE
    m.setU8(pRec2 + 0x10b, 11) // nResurrectMode = 11 (< 16)
    m.setU16(pRec2 + 0x10c, 25) // wResurrectSkill = 25
    expect(AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c(m, pMonster, 1)).toBe(11)

    m.setU8(pRec2 + 0x10b, 20) // >= 16 -> clamps to 1
    expect(AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c(m, pMonster, 1)).toBe(1)
  })
})
