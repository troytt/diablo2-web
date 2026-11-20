import { describe, expect, it } from 'vitest'
import { INVENTORY_SIGNATURE_113C } from '../../../src/d2kern-113c/common/inventory.ts'
import {
  D2ActiveRoomStrc,
  D2DrlgLevelStrc,
  D2DynamicPathStrc,
  D2InventoryStrc,
  D2ItemDataStrc,
  D2RoomExStrc,
  D2SkillListStrc,
  D2SkillStrc,
  D2SkillsTxt,
  D2TextHeaderStrc,
  D2TextNodeStrc,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  SGPT_ITEMS_TXT_COUNT_VA,
  SGPT_ITEMS_TXT_PTR_VA,
  SGPT_MAGICAFFIX_TXT_COUNT_VA,
  SGPT_MAGICAFFIX_TXT_PTR_VA,
} from '../../../src/d2kern-113c/tables/datatbls-113c.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  AIGENERAL_GetField3C_113c,
  AIGENERAL_GetQuestDataPtr38_113c,
  AI_CheckAnyMinionDeadCallback113c,
  AI_InitBaalMinionSpawnState113c,
  AI_InitMonsterClearAiParam3_113c,
  AI_InitMonsterResetAiStateNeg1_113c,
  AI_InitMonsterSkillDelayFrame113c,
  AI_InitShadowMasterSkillSlot113c,
  AI_SelectBaalThroneSpawnClassId113c,
  CLIENTS_CaptureFirstInGameClientCallback113c,
  D2GAME_GLOBAL_SEED_OVERRIDE_VA_113C,
  D2GAME_MONUMOD_CALLBACK_MATRIX_VA_113C,
  D2GAME_MONUMOD_TABLE_VA_113C,
  D2GAME_SHADOW_MASTER_INIT_SLOTS_VA_113C,
  GAME_SetGlobalSeed113c,
  ITEMS_FindSuperiorQualityRecordIndex113c,
  ITEMS_HasAffixGroupOnItem113c,
  ITEMS_ScaleStatByPercentWithMin113c,
  MONSTER_Event7_MonUModEvent2_113c,
  MONUMOD_AppendUModToMonster113c,
  MONUMOD_ApplyToMinionCallback113c,
  MONUMOD_CopyMinionEligibleUMods113c,
  MONUMOD_CountUnitUMods113c,
  MONUMOD_DispatchOnKillEvent5_113c,
  MONUMOD_GetConstantValue113c,
  MONUMOD_GetMinionClassIdForBoss113c,
  MONUMOD_GetUModListPtr113c,
  MONUMOD_MarkBossAndIncrementUniqueCount113c,
  MONUMOD_RollBossOrMinionNameSeed113c,
  MONUMOD_SetSuperUniqueId113c,
  OBJECTS_InitFn05_NoOp113c,
  OBJECTS_InitFn16_DoubleActToSubType113c,
  OBJECTS_InitFn27_RollSubType3_113c,
  OBJECTS_LevelHookAlwaysTrue113c,
  OBJECTS_SetUnitField7CDword4_113c,
  OBJECTS_SubstituteObjectClassIdFromParm0_113c,
  PLAYER_CheckHostilePlayerCallback113c,
  PLAYER_IsBusyWithCursorOrNpcInteract113c,
  PLAYER_SetClientSkillHotkeySlot113c,
  QUESTS_AddNpcDialogTextNodes113c,
  QUESTS_GuidListAdd113c,
  QUESTS_GuidListContains113c,
  QUESTS_HasPlayerGuidInQuest113c,
  QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c,
  QUESTS_SendNpcMessagePacket27_113c,
  QUESTS_SendPlayerQuestLogPacket28_113c,
  QUESTS_SendQuestItemState2_5D_113c,
  QUESTS_SendQuestStateAlert5D_113c,
  SUNIT_FindItemEventNode113c,
} from '../../../src/d2kern-113c/game/k2-items-tc-w1-113c.ts'

/** Exact v1.13c `D2Game.dll` `.data` `monUModTable[0..42]` (`0x6FD2E550`). */
const MONUMOD_TABLE_43_113C = [
  0, 0x6fc43020, 0x6fc42fa0, 0, 0x6fc41e80, 0x6fc42bc0, 0x6fc42880, 0, 0x6fc41be0, 0x6fc42740,
  0, 0, 0, 0, 0, 0, 0x6fc42da0, 0x6fc42600, 0x6fc42490, 0, 0, 0, 0, 0x6fc42320, 0, 0x6fc421d0,
  0x6fc441b0, 0x6fc41be0, 0x6fc41be0, 0, 0x6fc44cd0, 0, 0, 0, 0, 0, 0x6fc43850, 0x6fc43810,
  0x6fc437c0, 0x6fc42d00, 0, 0x6fc469f0, 0,
] as const

function createTestMem(): { m: SparseMemory113c; pDataTables: number } {
  const m = new SparseMemory113c()
  m.fill(0, 0x100, 0)
  m.fill(0x6fdd6000, 0x20000, 0)
  const pDataTables = m.alloc(0x2000)
  initD2GameGlobalsInMem113c(m, pDataTables)

  // 0x6FD1CEE8: {2, 0}, {4, 0}, {1, 1}
  const shadowSlots = [2, 0, 4, 0, 1, 1]
  for (let i = 0; i < shadowSlots.length; i++) {
    m.setU32((D2GAME_SHADOW_MASTER_INIT_SLOTS_VA_113C + i * 4) >>> 0, shadowSlots[i]!)
  }
  m.setU32(D2GAME_GLOBAL_SEED_OVERRIDE_VA_113C, 0xffffffff)
  for (let i = 0; i < MONUMOD_TABLE_43_113C.length; i++) {
    m.setU32((D2GAME_MONUMOD_TABLE_VA_113C + i * 4) >>> 0, MONUMOD_TABLE_43_113C[i]!)
  }
  m.fill(D2GAME_MONUMOD_CALLBACK_MATRIX_VA_113C, 43 * 24, 0)
  // Populate sample v1.13c non-zero matrix entries: row 9 col 2 = 0x6FC466B0, row 19 col 5 = 0x6FC43670
  m.setU32((D2GAME_MONUMOD_CALLBACK_MATRIX_VA_113C + (9 * 6 + 2) * 4) >>> 0, 0x6fc466b0)
  m.setU32((D2GAME_MONUMOD_CALLBACK_MATRIX_VA_113C + (19 * 6 + 5) * 4) >>> 0, 0x6fc43670)
  return { m, pDataTables }
}

describe('[K2] Wave 1 Lane A: 45 D2Game.dll ITEMS / AI / MONUMOD / OBJECTS / QUESTS / PLAYER Ports', () => {
  it('verifies ITEMS_HasAffixGroupOnItem113c (0x6FC331E0), ITEMS_ScaleStatByPercentWithMin113c (0x6FC33230), and ITEMS_FindSuperiorQualityRecordIndex113c (0x6FC332A0)', () => {
    const { m } = createTestMem()

    // Setup 4 MagicAffixTxt records (1-based index, stride 0x90)
    const pAffixBase = m.alloc(4 * 0x90)
    m.setU32(SGPT_MAGICAFFIX_TXT_PTR_VA, pAffixBase)
    m.setU32(SGPT_MAGICAFFIX_TXT_COUNT_VA, 4)
    m.setU32(pAffixBase + 0 * 0x90 + 0x5c, 101) // affix 1 -> group 101
    m.setU32(pAffixBase + 1 * 0x90 + 0x5c, 202) // affix 2 -> group 202
    m.setU32(pAffixBase + 2 * 0x90 + 0x5c, 303) // affix 3 -> group 303
    m.setU32(pAffixBase + 3 * 0x90 + 0x5c, 404) // affix 4 -> group 404

    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(0x80)
    m.set(pItem, D2UnitStrc.dwUnitType, 4) // UNIT_ITEM
    m.set(pItem, D2UnitStrc.dwClassId, 2)
    m.set(pItem, D2UnitStrc.pUnitData, pItemData)

    // NULL item returns 0
    expect(ITEMS_HasAffixGroupOnItem113c(m, 0, 101)).toBe(0)

    // Prefix[0]=1 (101), Prefix[1]=2 (202), Suffix[0]=3 (303), Suffix[1]=0, Suffix[2]=4 (404)
    m.setU16(pItemData + D2ItemDataStrc.wMagicPrefix.off + 0, 1)
    m.setU16(pItemData + D2ItemDataStrc.wMagicPrefix.off + 2, 2)
    m.setU16(pItemData + D2ItemDataStrc.wMagicPrefix.off + 4, 0)
    m.setU16(pItemData + D2ItemDataStrc.wMagicSuffix.off + 0, 3)
    m.setU16(pItemData + D2ItemDataStrc.wMagicSuffix.off + 2, 0)
    m.setU16(pItemData + D2ItemDataStrc.wMagicSuffix.off + 4, 4)

    expect(ITEMS_HasAffixGroupOnItem113c(m, pItem, 202)).toBe(1)
    expect(ITEMS_HasAffixGroupOnItem113c(m, pItem, 303)).toBe(1)
    // Suffix[1]=0 causes immediate break out of suffix loop (0x6FC33216), so Suffix[2]=4 is not reached
    expect(ITEMS_HasAffixGroupOnItem113c(m, pItem, 404)).toBe(0)
    // Prefix[0]=0 causes immediate break to suffix loop (0x6FC331F5)
    m.setU16(pItemData + D2ItemDataStrc.wMagicPrefix.off + 0, 0)
    expect(ITEMS_HasAffixGroupOnItem113c(m, pItem, 202)).toBe(0)
    expect(ITEMS_HasAffixGroupOnItem113c(m, pItem, 303)).toBe(1)

    // 0x6FC33230: ITEMS_ScaleStatByPercentWithMin113c
    expect(ITEMS_ScaleStatByPercentWithMin113c(m, 100, 2, 75)).toBe(75)
    expect(ITEMS_ScaleStatByPercentWithMin113c(m, 9, 2, 75)).toBe(6)
    expect(ITEMS_ScaleStatByPercentWithMin113c(m, 2, 2, 75)).toBe(2) // (2*75)/100 = 1 -> clamped to 2
    expect(ITEMS_ScaleStatByPercentWithMin113c(m, 0, 1, 75)).toBe(1)
    expect(ITEMS_ScaleStatByPercentWithMin113c(m, -199, -5, 1)).toBe(-1) // (-199*1)/100 = -1 >= -5
    expect(ITEMS_ScaleStatByPercentWithMin113c(m, -199, -5, 100)).toBe(-5) // (-199*100)/100 = -199 < -5 -> -5

    // 0x6FC332A0: ITEMS_FindSuperiorQualityRecordIndex113c
    const pItemsTxt = m.alloc(4 * 0x1a8)
    m.setU32(SGPT_ITEMS_TXT_COUNT_VA, 4)
    m.setU32(SGPT_ITEMS_TXT_PTR_VA, pItemsTxt)
    const CODE_SWOR = 0x726f7773
    const CODE_SHLD = 0x646c6873
    m.setU32(pItemsTxt + 2 * 0x1a8 + 0x80, CODE_SWOR)

    const pQualTable = m.alloc(3 * 0x20)
    m.setU32(0x6fdefda0, 3) // nQualityItemsTxtRecordCount
    m.setU32(0x6fdefda4, pQualTable)
    m.setU32(pQualTable + 1 * 0x20 + 0x18, CODE_SWOR)
    m.setU32(pQualTable + 2 * 0x20 + 0x1c, CODE_SWOR)
    m.setU32(pQualTable + 0 * 0x20 + 0x18, CODE_SHLD)

    expect(ITEMS_FindSuperiorQualityRecordIndex113c(m, pItem, 1)).toBe(1)
    expect(ITEMS_FindSuperiorQualityRecordIndex113c(m, pItem, 0)).toBe(2)
    expect(ITEMS_FindSuperiorQualityRecordIndex113c(m, 0, 1)).toBe(3) // NULL item -> nCount
    m.setU32(pItemsTxt + 2 * 0x1a8 + 0x80, 0xdeadbeef)
    expect(ITEMS_FindSuperiorQualityRecordIndex113c(m, pItem, 1)).toBe(3) // miss -> nCount
    m.setU32(0x6fdefda4, 0)
    expect(ITEMS_FindSuperiorQualityRecordIndex113c(m, pItem, 1)).toBe(3)
  })

  it('verifies AI init & Baal throne spawn helpers (0x6FC35520, 0x6FC35530, 0x6FC35540, 0x6FC35570, 0x6FC355C0, 0x6FC356C0, 0x6FC35730)', () => {
    const { m, pDataTables } = createTestMem()

    const pGame = m.alloc(0x2000)
    m.setU32(pGame + 0xa8, 777) // dwGameFrame

    const pAiCtrl = m.alloc(0x50)
    const pAiTick = m.alloc(0x30)
    m.setU32(pAiTick, pAiCtrl)

    // 0x6FC35520
    m.setU32(pAiCtrl + 0x1c, 0x12345678)
    AI_InitMonsterClearAiParam3_113c(m, pGame, 0, pAiTick)
    expect(m.u32(pAiCtrl + 0x1c)).toBe(0)

    // 0x6FC35530
    m.setU32(pAiCtrl + 0x14, 42)
    AI_InitMonsterResetAiStateNeg1_113c(m, pGame, 0, pAiTick)
    expect(m.u32(pAiCtrl + 0x14)).toBe(0xffffffff)

    // 0x6FC35540
    m.setU32(pAiCtrl + 0x18, 99)
    m.setU32(pAiCtrl + 0x3c, 12)
    AI_InitBaalMinionSpawnState113c(m, pGame, 0, pAiTick)
    expect(m.u32(pAiCtrl + 0x14)).toBe(777)
    expect(m.u32(pAiCtrl + 0x18)).toBe(0)
    expect(m.u32(pAiCtrl + 0x3c)).toBe(0xffffffff)

    // 0x6FC35570
    const pOutDead = m.alloc(4)
    const pMinion = m.alloc(0x100)
    m.set(pMinion, D2UnitStrc.dwUnitType, 1)
    m.set(pMinion, D2UnitStrc.dwAnimMode, 2) // walk -> alive
    m.setU32(pOutDead, 0)
    AI_CheckAnyMinionDeadCallback113c(m, pMinion, pOutDead)
    expect(m.u32(pOutDead)).toBe(0)

    m.set(pMinion, D2UnitStrc.dwAnimMode, 12) // MONMODE_DEAD
    AI_CheckAnyMinionDeadCallback113c(m, pMinion, pOutDead)
    expect(m.u32(pOutDead)).toBe(1)

    m.setU32(pOutDead, 0)
    AI_CheckAnyMinionDeadCallback113c(m, 0, pOutDead) // NULL minion -> sets 1
    expect(m.u32(pOutDead)).toBe(1)

    // 0x6FC355C0: AI_InitShadowMasterSkillSlot113c
    const pMonStats = m.alloc(0x200)
    m.setU32(pAiTick + 0x1c, pMonStats)
    m.setU16(pMonStats + 2 * 2 + 0x170, 271) // wSkill[2] = 271
    m.setU16(pMonStats + 4 * 2 + 0x170, 279) // wSkill[4] = 279

    const pShadow = m.alloc(0x100)
    m.set(pShadow, D2UnitStrc.dwUnitType, 1)
    m.setU32(pShadow + 0x20, 1)
    m.setU32(pShadow + 0x24, 0)

    // No skills attached yet -> writes (0, 0)
    m.setU32(pAiCtrl + 0x18, 99)
    m.setU32(pAiCtrl + 0x1c, 99)
    AI_InitShadowMasterSkillSlot113c(m, pGame, pShadow, pAiTick)
    expect(m.u32(pAiCtrl + 0x18)).toBe(0)
    expect(m.u32(pAiCtrl + 0x1c)).toBe(0)

    // Attach skill 271 (slot 2) with nOwnerItemGuid = -1
    const pSkillList = m.alloc(0x20)
    const pSkillNode = m.alloc(0x40)
    const pSkillTxt271 = m.alloc(0x23c)
    m.set(pSkillTxt271, D2SkillsTxt.wSkillId, 271)
    m.set(pSkillNode, D2SkillStrc.pSkillsTxt, pSkillTxt271)
    m.set(pSkillNode, D2SkillStrc.nOwnerItemGuid, 0xffffffff)
    m.set(pSkillList, D2SkillListStrc.pFirstSkill, pSkillNode)
    m.set(pShadow, D2UnitStrc.pSkills, pSkillList)

    m.setU32(pShadow + 0x20, 2) // 2 * 0x6ac690c5 + 0 is even -> probes slot 4 (miss) then slot 2 (hit!)
    m.setU32(pShadow + 0x24, 0)
    AI_InitShadowMasterSkillSlot113c(m, pGame, pShadow, pAiTick)
    expect(m.u32(pAiCtrl + 0x18)).toBe(2)
    expect(m.u32(pAiCtrl + 0x1c)).toBe(0)

    // 0x6FC356C0: AI_InitMonsterSkillDelayFrame113c
    const pSkillsTable = m.alloc(10 * 0x23c)
    m.setU32(pDataTables + 0xb98, pSkillsTable)
    m.setU32(pDataTables + 0xba0, 10)
    m.setU32(pSkillsTable + 5 * 0x23c + 0x14c, 45) // skill 5 delay = 45

    m.setU16(pMonStats + 0x170, 0) // wSkill[0] == 0 -> untouched
    m.setU32(pAiCtrl + 0x14, 111)
    AI_InitMonsterSkillDelayFrame113c(m, pGame, pShadow, pAiTick)
    expect(m.u32(pAiCtrl + 0x14)).toBe(111)

    m.setU16(pMonStats + 0x170, 5) // wSkill[0] == 5 -> 777 + 45 = 822
    AI_InitMonsterSkillDelayFrame113c(m, pGame, pShadow, pAiTick)
    expect(m.u32(pAiCtrl + 0x14)).toBe(822)

    m.setU16(pMonStats + 0x170, 25) // out of bounds -> 777 + 0 = 777
    AI_InitMonsterSkillDelayFrame113c(m, pGame, pShadow, pAiTick)
    expect(m.u32(pAiCtrl + 0x14)).toBe(777)

    // 0x6FC35730: AI_SelectBaalThroneSpawnClassId113c
    const pMonStatsTable = m.alloc(600 * 0x1a8)
    m.setU32(pDataTables + 0xa78, pMonStatsTable)
    m.setU32(pDataTables + 0xa80, 600)
    // Mark monster 310 with bit 0x15 (byte +0x0E = 0x0C + 2, bit 5 = 0x20)
    m.setU8(pMonStatsTable + 310 * 0x1a8 + 0x0e, 0x20)

    const pMonData = m.alloc(0x60)
    m.setU32(pMonData + 0x58, 4) // Act 5 (index 4)
    m.setU32(pShadow + 0x14, pMonData)
    const pMonReg4 = m.alloc(0x300)
    m.setU32(pGame + 4 * 4 + 0xf0, pMonReg4)
    m.setU8(pMonReg4 + 0x10, 3) // 3 entries (non-power-of-2 branch)
    m.setU16(pMonReg4 + 0 * 0x34 + 0x14, 100) // lacks bit 0x15
    m.setU16(pMonReg4 + 1 * 0x34 + 0x14, 200) // lacks bit 0x15
    m.setU16(pMonReg4 + 2 * 0x34 + 0x14, 310) // has bit 0x15!

    const pOutSpawnId = m.alloc(4)
    m.setU32(pShadow + 0x20, 0)
    m.setU32(pShadow + 0x24, 0)
    // Rolled idx = 0 (100 lacks bit 0x15) -> linear scan finds 310!
    expect(AI_SelectBaalThroneSpawnClassId113c(m, pShadow, pGame, pOutSpawnId)).toBe(1)
    expect(m.u32(pOutSpawnId)).toBe(310)

    // Direct hit when entry 0 has bit 0x15 on power-of-2 count (2)
    m.setU8(pMonReg4 + 0x10, 2)
    m.setU16(pMonReg4 + 0 * 0x34 + 0x14, 310)
    m.setU32(pShadow + 0x20, 0)
    m.setU32(pShadow + 0x24, 0)
    expect(AI_SelectBaalThroneSpawnClassId113c(m, pShadow, pGame, pOutSpawnId)).toBe(1)
    expect(m.u32(pOutSpawnId)).toBe(310)

    // When no entry has bit 0x15 and count=600 > 0x1F0 -> falls back to 0x1F0 (496)
    m.setU16(pMonReg4 + 0 * 0x34 + 0x14, 100)
    m.setU16(pMonReg4 + 1 * 0x34 + 0x14, 200)
    expect(AI_SelectBaalThroneSpawnClassId113c(m, pShadow, pGame, pOutSpawnId)).toBe(1)
    expect(m.u32(pOutSpawnId)).toBe(0x1f0)

    // When nMonStatsCount <= 0x1F0 -> falls back to -1 (0xFFFFFFFF)
    m.setU32(pDataTables + 0xa80, 400)
    expect(AI_SelectBaalThroneSpawnClassId113c(m, pShadow, pGame, pOutSpawnId)).toBe(1)
    expect(m.u32(pOutSpawnId)).toBe(0xffffffff)
  })

  it('verifies AIGENERAL & MONUMOD suite (0x6FC40C60, 0x6FC40DE0, 0x6FC41840, 0x6FC41860, 0x6FC41880, 0x6FC41F60, 0x6FC41FB0, 0x6FC42920, 0x6FC42A10, 0x6FC42AF0, 0x6FC43020, 0x6FC43060, 0x6FC43260, 0x6FC469B0)', () => {
    const { m, pDataTables } = createTestMem()

    const pGame = m.alloc(0x2000)
    const pMonReg0 = m.alloc(0x300)
    m.setU32(pGame + 0xf0, pMonReg0)

    const pBoss = m.alloc(0x100)
    const pBossData = m.alloc(0x60)
    const pAiGen = m.alloc(0x50)
    m.setU32(pBoss, 1)
    m.setU32(pBoss + 0x04, 10) // classId 10
    m.setU32(pBoss + 0x14, pBossData)
    m.setU32(pBoss + 0x20, 0x12345678)
    m.setU32(pBoss + 0x24, 666)
    m.setU32(pBossData + 0x28, pAiGen)
    m.setU32(pAiGen + 0x3c, 0xfeedface)

    // 0x6FC40C60 & 0x6FC40DE0
    m.setU32(0x3c, 0xabcd0001)
    expect(AIGENERAL_GetField3C_113c(m, pBoss)).toBe(0xfeedface)
    expect(AIGENERAL_GetField3C_113c(m, 0)).toBe(0xabcd0001)
    expect(AIGENERAL_GetQuestDataPtr38_113c(m, pBoss)).toBe((pAiGen + 0x38) >>> 0)
    expect(AIGENERAL_GetQuestDataPtr38_113c(m, 0)).toBe(0x38)

    // 0x6FC42AF0, 0x6FC42920, 0x6FC41860, 0x6FC42A10
    expect(MONUMOD_GetUModListPtr113c(m, 0)).toBe(0)
    const pBossUMods = MONUMOD_GetUModListPtr113c(m, pBoss)
    expect(pBossUMods).toBe((pBossData + 0x1c) >>> 0)
    expect(MONUMOD_CountUnitUMods113c(m, pBossUMods)).toBe(0)

    MONUMOD_AppendUModToMonster113c(m, pBoss, 9)
    MONUMOD_AppendUModToMonster113c(m, pBoss, 19)
    MONUMOD_AppendUModToMonster113c(m, pBoss, 5)
    expect(MONUMOD_CountUnitUMods113c(m, pBossUMods)).toBe(3)
    expect([m.u8(pBossUMods), m.u8(pBossUMods + 1), m.u8(pBossUMods + 2)]).toEqual([9, 19, 5])

    const pFullUMods = m.alloc(12)
    m.fill(pFullUMods, 10, 7)
    expect(MONUMOD_CountUnitUMods113c(m, pFullUMods)).toBe(9)

    MONUMOD_SetSuperUniqueId113c(m, pBoss, 0x0123)
    expect(m.u16(pBossData + 0x26)).toBe(0x0123)

    // 0x6FC43260: MONUMOD_MarkBossAndIncrementUniqueCount113c
    expect(m.u32(pMonReg0 + 0x2c8)).toBe(0)
    MONUMOD_MarkBossAndIncrementUniqueCount113c(m, pBoss, pGame)
    expect(m.u32(pMonReg0 + 0x2c8)).toBe(1)
    expect(m.u8(pBossData + 0x16) & 0x08).toBe(0x08)
    // Second call does NOT increment again since 0x08 is now set
    MONUMOD_MarkBossAndIncrementUniqueCount113c(m, pBoss, pGame)
    expect(m.u32(pMonReg0 + 0x2c8)).toBe(1)

    // 0x6FC41F60 & 0x6FC41FB0 & 0x6FC43060
    const pMonStatsBase = m.alloc(30 * 0x1a8)
    m.setU32(pDataTables + 0xa78, pMonStatsBase)
    m.setU32(pDataTables + 0xa80, 30)
    m.setU16(pMonStatsBase + 10 * 0x1a8 + 0x26, 14) // class 10 -> minion 14
    expect(MONUMOD_GetMinionClassIdForBoss113c(m, 0)).toBe(-1)
    expect(MONUMOD_GetMinionClassIdForBoss113c(m, pBoss)).toBe(14)
    m.setU16(pMonStatsBase + 10 * 0x1a8 + 0x26, 0xffff) // -1 -> returns boss classId 10
    expect(MONUMOD_GetMinionClassIdForBoss113c(m, pBoss)).toBe(10)

    const pMonUModTxt = m.alloc(25 * 0x20)
    m.setU32(pDataTables + 0xc50, pMonUModTxt)
    m.setU32(pDataTables + 0xc54, 25)
    m.setU32(pMonUModTxt + 9 * 0x20 + 0x1c, 350)
    m.setU8(pMonUModTxt + 9 * 0x20 + 0x07, 1) // uMod 9 fMin = 1 (copied)
    m.setU8(pMonUModTxt + 19 * 0x20 + 0x07, 0) // uMod 19 fMin = 0 (skipped)
    m.setU8(pMonUModTxt + 5 * 0x20 + 0x07, 1) // uMod 5 fMin = 1 (copied)
    expect(MONUMOD_GetConstantValue113c(m, -1)).toBe(0)
    expect(MONUMOD_GetConstantValue113c(m, 25)).toBe(0)
    expect(MONUMOD_GetConstantValue113c(m, 9)).toBe(350)

    const pMinion = m.alloc(0x100)
    const pMinionData = m.alloc(0x60)
    m.setU32(pMinion, 1)
    m.setU32(pMinion + 0x14, pMinionData)
    m.setU8(pMinionData + 0x1c, 2) // existing minion uMod 2
    MONUMOD_CopyMinionEligibleUMods113c(m, pBoss, pMinion, 0)
    expect([
      m.u8(pMinionData + 0x1c),
      m.u8(pMinionData + 0x1d),
      m.u8(pMinionData + 0x1e),
      m.u8(pMinionData + 0x1f),
    ]).toEqual([2, 9, 5, 0])

    // 0x6FC41840 & 0x6FC43020
    m.setU32(pMinion + 0x20, 100)
    m.setU32(pMinion + 0x24, 666)
    MONUMOD_RollBossOrMinionNameSeed113c(m, pMinion, 1, 0) // bBoss == 0 -> no-op
    expect(m.u32(pMinion + 0x20)).toBe(100)
    expect(m.u16(pMinionData + 0x14)).toBe(0)

    MONUMOD_ApplyToMinionCallback113c(m, pMinion, 1, 1) // dispatches 0x6FC43020 with bBoss == 1
    expect(m.u32(pMinion + 0x20)).not.toBe(100)
    expect(m.u16(pMinionData + 0x14)).toBe(m.u32(pMinion + 0x20) & 0xffff)

    const uModCalls: Array<[number, number, number, number]> = []
    MONUMOD_ApplyToMinionCallback113c(m, pMinion, 2, 0, {
      onMonUMod: (_mem, pfn, unit, id, boss) => uModCalls.push([pfn, unit, id, boss]),
    })
    expect(uModCalls).toEqual([[0x6fc42fa0, pMinion, 2, 0]])

    // 0x6FC41880 (col 5) & 0x6FC469B0 (col 2)
    const pTarget = m.alloc(0x100)
    const matrixCalls: Array<[number, number, number, number, number]> = []
    const hooks = {
      onMonUModMatrixCallback: (
        _mem: unknown,
        pfn: number,
        g: number,
        t: number,
        id: number,
        boss: number,
      ) => {
        matrixCalls.push([pfn, g, t, id, boss])
      },
    }
    MONUMOD_DispatchOnKillEvent5_113c(m, pTarget, pBoss, pGame, hooks)
    expect(matrixCalls).toEqual([[0x6fc43670, pGame, pTarget, 19, 1]])

    matrixCalls.length = 0
    MONSTER_Event7_MonUModEvent2_113c(m, pGame, pBoss, 123, 456, hooks)
    expect(matrixCalls).toEqual([[0x6fc466b0, pGame, pBoss, 9, 1]])
  })

  it('verifies GAME & OBJECTS helpers (0x6FC4A0C0, 0x6FC4A210, 0x6FC4E4F0, 0x6FC4E5C0, 0x6FC4E720, 0x6FC4E760, 0x6FC4E8B0, 0x6FC4E9F0)', () => {
    const { m } = createTestMem()

    // 0x6FC4A0C0
    const pOutClient = m.alloc(4)
    CLIENTS_CaptureFirstInGameClientCallback113c(m, 0x11110000, pOutClient)
    CLIENTS_CaptureFirstInGameClientCallback113c(m, 0x22220000, pOutClient)
    expect(m.u32(pOutClient)).toBe(0x11110000)

    // 0x6FC4A210
    GAME_SetGlobalSeed113c(m, 0xcafebabe)
    expect(m.u32(D2GAME_GLOBAL_SEED_OVERRIDE_VA_113C)).toBe(0xcafebabe)

    // 0x6FC4E4F0
    const pPortal = m.alloc(0x100)
    const pPortalField7C = m.alloc(0x10)
    OBJECTS_SetUnitField7CDword4_113c(m, pPortal, 0x77) // dwField7C == 0 -> no-op
    m.set(pPortal, D2UnitStrc.dwField7C, pPortalField7C)
    OBJECTS_SetUnitField7CDword4_113c(m, pPortal, 0x77)
    expect(m.u32(pPortalField7C + 0x04)).toBe(0x77)

    // 0x6FC4E5C0 & 0x6FC4E720
    expect(OBJECTS_LevelHookAlwaysTrue113c(m, 1, 2, 3)).toBe(1)
    OBJECTS_InitFn05_NoOp113c(m, 0)

    // 0x6FC4E760 & 0x6FC4E9F0
    const pObjectsTxtBase = m.alloc(100 * 0x1c0)
    m.setU32(0x6fdf0b94, pObjectsTxtBase)
    m.setU32(0x6fdf0b98, 100)

    const pObj = m.alloc(0x100)
    const pObjData = m.alloc(0x40)
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x04, 12)
    m.setU32(pObj + 0x14, pObjData)

    const pObjCtrl = m.alloc(0x20)
    const pObjTxt12 = pObjectsTxtBase + 12 * 0x1c0
    m.setU8(pObjTxt12 + 0x180, 3)

    const pInitParam = m.alloc(0x24)
    m.setU32(pInitParam + 0x04, pObj)
    m.setU32(pInitParam + 0x0c, pObjCtrl)
    m.setU32(pInitParam + 0x10, pObjTxt12)

    OBJECTS_InitFn16_DoubleActToSubType113c(m, pInitParam)
    expect(m.u8(pObjData + 0x04)).toBe(6)

    // Seed {lo: 0, hi: 100} -> newLo = 100 -> 100 % 1000 = 100 < 333 -> uSubType = 3
    m.setU32(pObjCtrl, 0)
    m.setU32(pObjCtrl + 4, 100)
    OBJECTS_InitFn27_RollSubType3_113c(m, pInitParam)
    expect(m.u8(pObjData + 0x04)).toBe(3)

    // Seed {lo: 0, hi: 500} -> newLo = 500 -> 500 % 1000 = 500 >= 333 -> uSubType = 0
    m.setU32(pObjCtrl, 0)
    m.setU32(pObjCtrl + 4, 500)
    OBJECTS_InitFn27_RollSubType3_113c(m, pInitParam)
    expect(m.u8(pObjData + 0x04)).toBe(0)

    // 0x6FC4E8B0: OBJECTS_SubstituteObjectClassIdFromParm0_113c
    m.setU32(pObjTxt12 + 0x17c, 45)
    OBJECTS_SubstituteObjectClassIdFromParm0_113c(m, pObj)
    expect(m.u32(pObj + 0x04)).toBe(45)

    // On object 45, dwParm0 == 0 -> substitutes 0x54 (84)
    OBJECTS_SubstituteObjectClassIdFromParm0_113c(m, pObj)
    expect(m.u32(pObj + 0x04)).toBe(0x54)

    // On object 84, dwParm0 >= 0x23D -> substitutes 0x54
    m.setU32(pObjectsTxtBase + 0x54 * 0x1c0 + 0x17c, 0x23d)
    m.setU32(pObj + 0x04, 0x54)
    OBJECTS_SubstituteObjectClassIdFromParm0_113c(m, pObj)
    expect(m.u32(pObj + 0x04)).toBe(0x54)
  })

  it('verifies QUESTS GUID lists, NPC dialog nodes, state-bit removal, and S2C 0x5D / 0x27 / 0x28 packets (0x6FC537D0, 0x6FC53800, 0x6FC53880, 0x6FC53EB0, 0x6FC540C0, 0x6FC54AA0, 0x6FC54B20, 0x6FC54B80, 0x6FC54C00)', () => {
    const { m } = createTestMem()

    // 0x6FC537D0, 0x6FC53800, 0x6FC53880
    const pQuestData = m.alloc(0x100)
    const pGuidList = (pQuestData + 0x1c) >>> 0
    expect(QUESTS_GuidListContains113c(m, pGuidList, 77)).toBe(0)
    expect(QUESTS_HasPlayerGuidInQuest113c(m, pQuestData, 77)).toBe(0)

    QUESTS_GuidListAdd113c(m, pGuidList, 77)
    QUESTS_GuidListAdd113c(m, pGuidList, 88)
    QUESTS_GuidListAdd113c(m, pGuidList, 77) // duplicate ignored
    expect(m.u16(pGuidList + 0x80)).toBe(2)
    expect(QUESTS_GuidListContains113c(m, pGuidList, 77)).toBe(1)
    expect(QUESTS_HasPlayerGuidInQuest113c(m, pQuestData, 88)).toBe(1)
    expect(QUESTS_HasPlayerGuidInQuest113c(m, pQuestData, 99)).toBe(0)

    // Cap at 32 entries
    for (let g = 100; g < 140; g++) {
      QUESTS_GuidListAdd113c(m, pGuidList, g)
    }
    expect(m.u16(pGuidList + 0x80)).toBe(32)

    // 0x6FC53EB0: QUESTS_AddNpcDialogTextNodes113c
    const pMsgChains = m.alloc(3 * 0xc4)
    m.setU32(pQuestData + 0xdc, pMsgChains)
    const pTable1 = pMsgChains + 1 * 0xc4
    m.setU32(pTable1 + 0xc0, 3)
    // Entry 0: npc=148, str=2001, menu=1 -> mapped to 0
    m.setU32(pTable1 + 0x00, 148)
    m.setU16(pTable1 + 0x04, 2001)
    m.setU32(pTable1 + 0x08, 1)
    // Entry 1: npc=150 (skip)
    m.setU32(pTable1 + 0x0c, 150)
    m.setU16(pTable1 + 0x10, 2002)
    m.setU32(pTable1 + 0x14, 0)
    // Entry 2: npc=148, str=2003, menu=2 -> preserved as 2
    m.setU32(pTable1 + 0x18, 148)
    m.setU16(pTable1 + 0x1c, 2003)
    m.setU32(pTable1 + 0x20, 2)

    const pTextHdr = m.alloc(0x20)
    QUESTS_AddNpcDialogTextNodes113c(m, pQuestData, 1, pTextHdr, 148)
    expect(m.get(pTextHdr, D2TextHeaderStrc.wCount)).toBe(2)
    const n1 = m.get(pTextHdr, D2TextHeaderStrc.pFirstNode)
    expect(m.get(n1, D2TextNodeStrc.wStringId)).toBe(2003)
    expect(m.get(n1, D2TextNodeStrc.nMenuIndex)).toBe(2)
    const n0 = m.get(n1, D2TextNodeStrc.pNext)
    expect(m.get(n0, D2TextNodeStrc.wStringId)).toBe(2001)
    expect(m.get(n0, D2TextNodeStrc.nMenuIndex)).toBe(0)

    // 0x6FC540C0: QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c
    const pGame = m.alloc(0x200)
    m.setU8(pGame + 0x6d, 1) // Nightmare difficulty
    m.setU32(pQuestData + 0x04, pGame)
    m.setU32(pQuestData + 0xe0, 3) // quest #3
    m.setU16(pQuestData + 0x9c, 2)
    m.setU32(pQuestData + 0x1c, 77)
    m.setU32(pQuestData + 0x20, 88)

    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x100)
    const pClient = m.alloc(0x400)
    m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
    m.set(pPlayer, D2UnitStrc.dwUnitId, 77)
    m.set(pPlayer, D2UnitStrc.pUnitData, pPlayerData)
    m.setU32(pPlayerData + 0x9c, pClient)

    const pQuestRecord = m.alloc(0x10)
    const pQuestBits = m.alloc(0x60)
    for (let i = 0; i < 0x60; i++) m.setU8(pQuestBits + i, (i + 1) & 0xff)
    m.setU32(pQuestRecord, pQuestBits)
    m.setU32(pPlayerData + 1 * 4 + 0x10, pQuestRecord)

    const pQuestArg = m.alloc(0x20)
    m.setU32(pQuestArg + 0x0c, pPlayer)

    // Quest #3 bits reside at bitIdx = (3 << 4) + state = 48 + state => byte 6!
    m.setU8(pQuestBits + 6, 0x01) // state 0 set, state 1 clear -> not removed
    QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuestData, pQuestArg)
    expect(QUESTS_HasPlayerGuidInQuest113c(m, pQuestData, 77)).toBe(1)

    m.setU8(pQuestBits + 6, 0x03) // both state 0 and state 1 set -> removes 77!
    QUESTS_RemovePlayerGuidIfQuestState1AndNot0_113c(m, pQuestData, pQuestArg)
    expect(QUESTS_HasPlayerGuidInQuest113c(m, pQuestData, 77)).toBe(0)
    expect(QUESTS_HasPlayerGuidInQuest113c(m, pQuestData, 88)).toBe(1)

    // 0x6FC54AA0: QUESTS_SendQuestStateAlert5D_113c
    const pPath = m.alloc(0x80)
    const pRoom = m.alloc(0x80)
    const pRoomEx = m.alloc(0x80)
    const pLevel = m.alloc(0x200)
    m.set(pPlayer, D2UnitStrc.pPath, pPath)
    m.set(pPath, D2DynamicPathStrc.pRoom, pRoom)
    m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
    m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)

    // Level 1 (Act 0) < uMinAct=2 -> suppressed
    m.set(pLevel, D2DrlgLevelStrc.nLevelId, 1)
    QUESTS_SendQuestStateAlert5D_113c(m, pPlayer, 0x24, 2)
    expect(m.u32(pClient + 0x1b8)).toBe(0)

    // Level 40 (Act 1) >= uMinAct=1 -> queues 6-byte [0x5D, 0x24, 0x00, 0x0C, 0, 0]
    m.set(pLevel, D2DrlgLevelStrc.nLevelId, 40)
    QUESTS_SendQuestStateAlert5D_113c(m, pPlayer, 0x24, 1)
    const pPktBlock = m.u32(pClient + 0x1b8)
    expect(pPktBlock).not.toBe(0)
    expect(m.u32(pPktBlock)).toBe(6)
    expect(Array.from(m.readBytes(pPktBlock + 4, 6))).toEqual([0x5d, 0x24, 0x00, 0x0c, 0x00, 0x00])

    // 0x6FC54B20: appends 6-byte [0x5D, 0x16, 0x02, 0x00, 0, 0]
    QUESTS_SendQuestItemState2_5D_113c(m, pPlayer, 0x16)
    expect(m.u32(pPktBlock)).toBe(12)
    expect(Array.from(m.readBytes(pPktBlock + 4 + 6, 6))).toEqual([
      0x5d, 0x16, 0x02, 0x00, 0x00, 0x00,
    ])

    // 0x6FC54B80: appends 40-byte 0x27 packet
    const pNpcObj = m.alloc(0x40)
    m.setU32(pNpcObj + 0x0c, 0x11223344)
    QUESTS_SendNpcMessagePacket27_113c(m, pPlayer, pNpcObj, 0x4ec9)
    expect(m.u32(pPktBlock)).toBe(52)
    const pkt27 = m.readBytes(pPktBlock + 4 + 12, 40)
    expect(pkt27[0]).toBe(0x27)
    expect(pkt27[1]).toBe(0x02)
    expect(m.u32(pPktBlock + 4 + 12 + 2)).toBe(0x11223344)
    expect(pkt27[6]).toBe(0x01)
    expect(pkt27[8]).toBe(0x00)
    expect(m.u16(pPktBlock + 4 + 12 + 10)).toBe(0x4ec9)

    // 0x6FC54C00: appends 103-byte 0x28 quest log packet, testing free-list overflow block pop
    m.setU32(pPktBlock, 0x1f0) // force 0x1f0 + 0x67 > 0x200 overflow
    const pFreeBlock = m.alloc(0x208)
    m.setU32(pClient + 0x1c0, pFreeBlock)
    QUESTS_SendPlayerQuestLogPacket28_113c(m, pPlayer, pGame)
    expect(m.u32(pClient + 0x1bc)).toBe(pFreeBlock)
    expect(m.u32(pClient + 0x1c0)).toBe(0)
    expect(m.u32(pFreeBlock)).toBe(0x67)
    const pkt28 = m.readBytes(pFreeBlock + 4, 0x67)
    expect(Array.from(pkt28.slice(0, 7))).toEqual([0x28, 0x06, 0, 0, 0, 0, 0])
    expect(pkt28[7]).toBe(1)
    expect(pkt28[7 + 6]).toBe(0x03)
  })

  it('verifies SUNIT & PLAYER item-event, busy, hotkey, and hostility helpers (0x6FC570E0, 0x6FC57680, 0x6FC57890, 0x6FC57940)', () => {
    const { m } = createTestMem()

    // 0x6FC570E0: SUNIT_FindItemEventNode113c
    expect(SUNIT_FindItemEventNode113c(m, 0, 2, 10, 20)).toBe(0)
    const pUnit = m.alloc(0x100)
    const n1 = m.alloc(0x24)
    const n2 = m.alloc(0x24)
    m.setU32(n1 + 0x04, 2)
    m.setU32(n1 + 0x08, 10)
    m.setU32(n1 + 0x0c, 99)
    m.setU32(n1 + 0x1c, n2)
    m.setU32(n2 + 0x04, 2)
    m.setU32(n2 + 0x08, 10)
    m.setU32(n2 + 0x0c, 20)
    m.setU32(pUnit + 0x90, n1)
    expect(SUNIT_FindItemEventNode113c(m, pUnit, 2, 10, 20)).toBe(n2)
    expect(SUNIT_FindItemEventNode113c(m, pUnit, 2, 10, 55)).toBe(0)

    // 0x6FC57680: PLAYER_IsBusyWithCursorOrNpcInteract113c
    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0xb0)
    const pInv = m.alloc(0x40)
    const pClient = m.alloc(0x480)
    m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
    m.set(pPlayer, D2UnitStrc.dwUnitId, 1)
    m.set(pPlayer, D2UnitStrc.pUnitData, pPlayerData)
    m.set(pPlayer, D2UnitStrc.pInventory, pInv)
    m.set(pInv, D2InventoryStrc.dwSignature, INVENTORY_SIGNATURE_113C)
    m.setU32(pPlayerData + 0x9c, pClient)

    expect(PLAYER_IsBusyWithCursorOrNpcInteract113c(m, 0)).toBe(0)
    expect(PLAYER_IsBusyWithCursorOrNpcInteract113c(m, pPlayer)).toBe(0)
    m.setU32(pPlayerData + 0x4c, 3)
    expect(PLAYER_IsBusyWithCursorOrNpcInteract113c(m, pPlayer)).toBe(3)
    m.set(pInv, D2InventoryStrc.pCursorItem, 0xdead0001)
    expect(PLAYER_IsBusyWithCursorOrNpcInteract113c(m, pPlayer)).toBe(1)
    m.set(pInv, D2InventoryStrc.pCursorItem, 0)
    m.setU8(pPlayer + 0x6c, 1)
    expect(PLAYER_IsBusyWithCursorOrNpcInteract113c(m, pPlayer)).toBe(1)

    // 0x6FC57890: PLAYER_SetClientSkillHotkeySlot113c
    expect(PLAYER_SetClientSkillHotkeySlot113c(m, 0, 5, 54, 1, 0xffffffff)).toBe(0)
    expect(PLAYER_SetClientSkillHotkeySlot113c(m, pPlayer, 5, 54, 1, 0x89abcdef)).toBe(1)
    expect(m.u16(pClient + 5 * 8 + 0x3dc)).toBe(54)
    expect(m.u8(pClient + 5 * 8 + 0x3de)).toBe(1)
    expect(m.u32(pClient + 5 * 8 + 0x3e0)).toBe(0x89abcdef)

    // 0x6FC57940: PLAYER_CheckHostilePlayerCallback113c
    const pRival = m.alloc(0x100)
    m.set(pRival, D2UnitStrc.dwUnitType, 0)
    m.set(pRival, D2UnitStrc.dwUnitId, 42)

    const pRelNeutral = m.alloc(0x18)
    const pRelHostile = m.alloc(0x18)
    m.setU32(pRelNeutral, 99)
    m.setU32(pRelNeutral + 0x04, 0x08)
    m.setU32(pRelNeutral + 0x10, pRelHostile)
    m.setU32(pRelHostile, 42)
    m.setU32(pRelHostile + 0x04, 0x00) // not hostile yet
    m.setU32(pPlayerData + 0x38, pRelNeutral)

    const pCtx = m.alloc(8)
    m.setU32(pCtx, 0)
    m.setU32(pCtx + 4, pPlayer)

    // Self check ignored
    PLAYER_CheckHostilePlayerCallback113c(m, 0, pPlayer, pCtx)
    expect(m.u32(pCtx)).toBe(0)
    // Non-hostile rival ignored
    PLAYER_CheckHostilePlayerCallback113c(m, 0, pRival, pCtx)
    expect(m.u32(pCtx)).toBe(0)
    // Hostile flag 0x08 set -> marks *pCtx = 1
    m.setU32(pRelHostile + 0x04, 0x08)
    PLAYER_CheckHostilePlayerCallback113c(m, 0, pRival, pCtx)
    expect(m.u32(pCtx)).toBe(1)
  })
})
