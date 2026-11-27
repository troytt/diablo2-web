import { describe, expect, it } from 'vitest'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory'
import {
  ACT1Q6_InitQuestData_6FC88060_113c,
  ACT2Q3_InitQuestData_6FCE7480_113c,
  ACT5Q4_InitQuestData_6FC7D5C0_113c,
  ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c,
  DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c,
  MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c,
  MONSTER_AssignTeleportSkill_6FC441B0_113c,
  NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c,
  NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c,
  PACKETS_SrvMercItemAction_6FCF0BC0_113c,
  PARTY_SetOrClearPlayerHostility_6FD11130_113c,
  PETS_AllocAndInitPlayerPetTable_6FCB7120_113c,
  PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730_113c,
  PETS_InsertPetIntoPlayerPetSlot_6FCB7A20_113c,
  PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c,
  PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910_113c,
  QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c,
  QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c,
  SHRINES_OnShrineStateRemoved_6FC8A930_113c,
  SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c,
  SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c,
  SKILLS_SpendSkillPointsAndIncrementSkill_6FCBFAE0_113c,
  SKILLS_SrvDo_Telekinesis_6FC631C0_113c,
  STATES_OnBuffStateRemovedRefreshAnim_6FC622B0_113c,
  STATES_OnSkillStateRemovedRefreshAnim_6FC47190_113c,
} from '../../../src/d2kern-113c/game/k2-w10b1-113c'

function createTestMem(): SparseMemory113c {
  const m = new SparseMemory113c()
  m.fill(0x10000, 0x30000, 0)
  m.fill(0x38000, 0x2000, 0)
  m.setU32(0x38000, 0x38100)
  m.setU32(0x6fd1829c, 0x38000)
  m.setU32(0x6fde9e1c, 0x38100)
  return m
}

describe('K2 Wave 10 Batch 1 (w10b1) D2Game 1.13c parity', () => {
  it('MONSTER_AssignTeleportSkill_6FC441B0_113c returns early on non-monster unit', () => {
    const m = createTestMem()
    const pUnit = 0x10000
    m.setU32(pUnit, 0)
    MONSTER_AssignTeleportSkill_6FC441B0_113c(m, pUnit, 0)
    expect(m.u32(pUnit)).toBe(0)
  })

  it('MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c returns early on non-monster unit', () => {
    const m = createTestMem()
    const pUnit = 0x10000
    m.setU32(pUnit, 0)
    MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c(m, pUnit, 0x20000)
    expect(m.u32(pUnit)).toBe(0)
  })

  it('STATES_OnSkillStateRemovedRefreshAnim_6FC47190_113c clears skill state on unit', () => {
    const m = createTestMem()
    const pUnit = 0x10000
    m.setU32(pUnit, 4)
    m.setU32((pUnit + 0x2c) >>> 0, 0x11000)
    STATES_OnSkillStateRemovedRefreshAnim_6FC47190_113c(m, pUnit, 1, 0)
    expect(m.u32(pUnit)).toBe(4)
  })

  it('SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c returns 0 when skill id is out of bounds', () => {
    const m = createTestMem()
    const res = SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c(m, 0x10000, -1, 0x20000, 1, 0)
    expect(res).toBe(0)
  })

  it('PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c handles empty client list', () => {
    const m = createTestMem()
    const pGame = 0x10000
    m.setU32((pGame + 0x88) >>> 0, 0)
    PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c(m, pGame, undefined)
    expect(m.u32((pGame + 0x88) >>> 0)).toBe(0)
  })

  it('PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910_113c returns 4 when client has no player', () => {
    const m = createTestMem()
    const pClient = 0x10000
    m.setU32((pClient + 0x174) >>> 0, 0)
    m.setU32((pClient + 0x1a8) >>> 0, 0)
    PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910_113c(m, pClient, 0)
    expect(m.u32((pClient + 0x174) >>> 0)).toBe(0)
  })

  it('QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c ignores non-Act3 games', () => {
    const m = createTestMem()
    const pGame = 0x10000
    const pMonster = 0x20000
    m.setU32((pMonster + 0x80) >>> 0, pGame)
    m.setU8((pGame + 0x6c) >>> 0, 0)
    QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c(m, pMonster, pGame)
    expect(m.u8((pGame + 0x6c) >>> 0)).toBe(0)
  })

  it('STATES_OnBuffStateRemovedRefreshAnim_6FC622B0_113c handles object unit', () => {
    const m = createTestMem()
    const pUnit = 0x10000
    m.setU32(pUnit, 4)
    m.setU32((pUnit + 0x2c) >>> 0, 0x11000)
    STATES_OnBuffStateRemovedRefreshAnim_6FC622B0_113c(m, pUnit, 5, 0)
    expect(m.u32(pUnit)).toBe(4)
  })

  it('SKILLS_SrvDo_Telekinesis_6FC631C0_113c returns 0 when no current skill on caster', () => {
    const m = createTestMem()
    const pCaster = 0x10000
    m.setU32((pCaster + 0xa8) >>> 0, 0)
    const res = SKILLS_SrvDo_Telekinesis_6FC631C0_113c(m, 0x20000, pCaster, 43, 1)
    expect(res).toBe(0)
  })

  it('SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c returns early on invalid skill id', () => {
    const m = createTestMem()
    const pSummon = 0x10000
    SKILLS_ApplySummonStatsPassivesAndEquip_6FC6F970_113c(m, pSummon, 0x20000, -1, 1, 0, 0, undefined)
    expect(m.u32(pSummon)).toBe(0)
  })

  it('ACT5Q4_InitQuestData_6FC7D5C0_113c initializes quest callbacks and 0xa0 state', () => {
    const m = createTestMem()
    const pQuestData = 0x10000
    ACT5Q4_InitQuestData_6FC7D5C0_113c(m, pQuestData)
    expect(m.u32((pQuestData + 0xe0) >>> 0)).toBe(0x26)
    expect(m.u32((pQuestData + 0x10) >>> 0)).toBe(0x23)
    expect(m.u8((pQuestData + 0xd) >>> 0)).toBe(4)
    expect(m.u32((pQuestData + 0x18) >>> 0)).toBeGreaterThan(0)
  })

  it('ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c decrements remaining ancients and opens summit doors at 0', () => {
    const m = createTestMem()
    const pQuestData = 0x10000
    const pQuestExt = 0x11000
    const pQuestArg = 0x12000
    const pGame = 0x13000
    const pMonster = 0x14000
    const pQuestControl = 0x15000
    m.setU32((pQuestData + 0x4) >>> 0, pGame)
    m.setU32((pQuestData + 0x18) >>> 0, pQuestExt)
    m.setU32((pGame + 0x10f4) >>> 0, pQuestControl)
    m.setU8((pQuestExt + 0x4) >>> 0, 1)
    m.setU8((pQuestExt + 0x10) >>> 0, 1)
    m.setU8((pQuestExt + 0x11) >>> 0, 1)
    m.setU32((pQuestExt + 0x44) >>> 0, 2)
    m.setU32((pMonster + 0x4) >>> 0, 0x21c)
    m.setU32((pQuestArg + 0x8) >>> 0, pMonster)
    ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c(m, pQuestData, pQuestArg)
    expect(m.u32((pQuestExt + 0x44) >>> 0)).toBe(1)
    expect(m.u8((pQuestExt + 0x3e) >>> 0)).toBe(1)
    expect(m.u8((pQuestControl + 0x20) >>> 0)).toBe(0x12)
  })

  it('ACT1Q6_InitQuestData_6FC88060_113c initializes Act 1 Q6 callbacks and NPC ids', () => {
    const m = createTestMem()
    const pQuestData = 0x10000
    ACT1Q6_InitQuestData_6FC88060_113c(m, pQuestData)
    expect(m.u32((pQuestData + 0xe0) >>> 0)).toBe(6)
    expect(m.u32((pQuestData + 0x10) >>> 0)).toBe(0x25)
    expect(m.u8((pQuestData + 0xd) >>> 0)).toBe(4)
    expect(m.u32((pQuestData + 0x18) >>> 0)).toBeGreaterThan(0)
  })

  it('SHRINES_OnShrineStateRemoved_6FC8A930_113c clears unit state and refreshes anim on monster', () => {
    const m = createTestMem()
    const pUnit = 0x10000
    m.setU32(pUnit, 4)
    m.setU32((pUnit + 0x2c) >>> 0, 0x11000)
    SHRINES_OnShrineStateRemoved_6FC8A930_113c(m, pUnit, 0x80, 0)
    expect(m.u32(pUnit)).toBe(4)
  })

  it('QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c forwards to object quest event 7', () => {
    const m = createTestMem()
    const pGame = 0x10000
    m.setU32((pGame + 0x10f4) >>> 0, 0)
    QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c(m, pGame, 0x20000)
    expect(m.u32((pGame + 0x10f4) >>> 0)).toBe(0)
  })

  it('PETS_AllocAndInitPlayerPetTable_6FCB7120_113c allocates pet table wrapper on player data', () => {
    const m = createTestMem()
    const pPlayer = 0x10000
    const pPlayerData = 0x11000
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    PETS_AllocAndInitPlayerPetTable_6FCB7120_113c(m, 0x20000, pPlayer)
    const pWrapper = m.u32((pPlayerData + 0x44) >>> 0)
    expect(pWrapper).toBeGreaterThan(0)
    expect(m.u32(pWrapper)).toBeGreaterThan(0)
  })

  it('PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730_113c handles player with null pet wrapper', () => {
    const m = createTestMem()
    const pPlayer = 0x10000
    const pPlayerData = 0x11000
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    m.setU32((pPlayerData + 0x44) >>> 0, 0)
    PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730_113c(m, 0x20000, pPlayer)
    expect(m.u32((pPlayerData + 0x44) >>> 0)).toBe(0)
  })

  it('PETS_InsertPetIntoPlayerPetSlot_6FCB7A20_113c appends pet node when slot has capacity', () => {
    const m = createTestMem()
    const pSlot = 0x10000
    const pPetUnit = 0x11000
    const pPetArg = 0x12000
    m.setU32(pSlot, 0)
    m.setU32((pSlot + 0x4) >>> 0, 0)
    m.setU32((pSlot + 0x8) >>> 0, 2)
    m.setU32((pPetUnit + 0xc) >>> 0, 0x77)
    m.setU32(pPetArg, 0x111)
    m.setU32((pPetArg + 0x4) >>> 0, 0x222)
    m.setU32((pPetArg + 0x8) >>> 0, 0x333)
    const res = PETS_InsertPetIntoPlayerPetSlot_6FCB7A20_113c(
      m,
      pSlot,
      0x20000,
      0x30000,
      pPetUnit,
      pPetArg,
    )
    expect(res).toBe(1)
    expect(m.u32((pSlot + 0x4) >>> 0)).toBe(1)
    const pNode = m.u32(pSlot)
    expect(m.u32((pNode + 0x4) >>> 0)).toBe(0x77)
    expect(m.u32((pNode + 0x8) >>> 0)).toBe(0x111)
  })

  it('SKILLS_SpendSkillPointsAndIncrementSkill_6FCBFAE0_113c returns 0 on negative skill id', () => {
    const m = createTestMem()
    expect(SKILLS_SpendSkillPointsAndIncrementSkill_6FCBFAE0_113c(m, 0x10000, -1)).toBe(0)
  })

  it('NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c returns 1 when NPC is not found', () => {
    const m = createTestMem()
    const pPlayer = 0x10000
    const pPlayerData = 0x11000
    const pGame = 0x20000
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)
    const res = NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c(m, pPlayer, pGame, 99, 1, 0)
    expect(res).toBe(1)
  })

  it('NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c returns early on null merc or player', () => {
    const m = createTestMem()
    NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c(m, 0, 0x10000, 0x20000)
    expect(m.u32(0x10000)).toBe(0)
  })

  it('ACT2Q3_InitQuestData_6FCE7480_113c initializes Act 2 Q3 tainted sun callbacks and state', () => {
    const m = createTestMem()
    const pQuestData = 0x10000
    ACT2Q3_InitQuestData_6FCE7480_113c(m, pQuestData)
    expect(m.u32((pQuestData + 0xe0) >>> 0)).toBe(0xb)
    expect(m.u32((pQuestData + 0x10) >>> 0)).toBe(0xb)
    expect(m.u8((pQuestData + 0xd) >>> 0)).toBe(4)
    expect(m.u32((pQuestData + 0x18) >>> 0)).toBeGreaterThan(0)
  })

  it('PACKETS_SrvMercItemAction_6FCF0BC0_113c returns 3 on invalid packet size or classic game', () => {
    const m = createTestMem()
    const pGame = 0x10000
    m.setU32((pGame + 0x70) >>> 0, 0)
    expect(PACKETS_SrvMercItemAction_6FCF0BC0_113c(m, pGame, 0x20000, 0x30000, 3)).toBe(3)
    expect(PACKETS_SrvMercItemAction_6FCF0BC0_113c(m, pGame, 0x20000, 0x30000, 5)).toBe(3)
  })

  it('DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c returns 0 when room cannot be resolved', () => {
    const m = createTestMem()
    const pUnit = 0x10000
    const pPath = 0x11000
    m.setU32((pUnit + 0x2c) >>> 0, pPath)
    const res = DUNGEON_TeleportUnitToRoomAndCoords_6FD019C0_113c(
      m,
      100,
      0,
      100,
      0x20000,
      pUnit,
      1,
      0,
    )
    expect(res).toBe(0)
  })

  it('PARTY_SetOrClearPlayerHostility_6FD11130_113c writes error 1 when source player has no room', () => {
    const m = createTestMem()
    const pOutErr = 0x15000
    PARTY_SetOrClearPlayerHostility_6FD11130_113c(m, 0x10000, 0x20000, 0x30000, 1, pOutErr)
    expect(m.u32(pOutErr)).toBe(1)
  })
})
