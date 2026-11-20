import { describe, expect, it } from 'vitest'
import { INVENTORY_AllocInventory113c, INVENTORY_SetCursorItem113c } from '../../../src/d2kern-113c/common/inventory.js'
import { STATLIST_CreateEx113c, STATLIST_GetUnitStat113c, STATLIST_SetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.js'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.js'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.js'
import {
  A5Q3_SpawnRedPortalObject13E_6FCE8CD0_113c,
  A5Q4_OpenTemplePortalObject_6FCE94E0_113c,
  AIBAAL_SelectCombatAction_6FCC8E80_113c,
  AIBAAL_TrySpawnBaalClone_6FCD7D30_113c,
  AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c,
  AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c,
  C2S_Packet50_DropPlayerGold_6FCEEF40_113c,
  C2S_SyncObjectCollisionByGuid_6FCED440_113c,
  C2S_ValidateBeltItemOwnership_6FCECDB0_113c,
  C2S_ValidateCursorItem_6FCECF70_113c,
  C2S_ValidateInventoryOrCursorItem_6FCECE20_113c,
  C2S_ValidateNpcMonsterInteract_6FCECCF0_113c,
  C2S_ValidateStoredItem_6FCECF00_113c,
  C2S_ValidateStoredOrEquippedItem_6FCECE90_113c,
  C2S_ValidateWaypointInteraction_6FCECB50_113c,
  HIRELING_LevelUpHirelingAndSyncSkills_6FC68BA0_113c,
  ITEMS_UseFlatOrBuffPotion_6FCCEA40_113c,
  ITEMS_UseHealingOrManaPotion_6FCCEDC0_113c,
  ITEMS_UsePercentagePotion_6FCCE6D0_113c,
  MONAI_AuraKnightOrZealotThink_6FCA9430_113c,
  MONAI_BaalThroneThink_6FCC8430_113c,
  MONAI_BlunderboreThink_6FCA3CE0_113c,
  MONAI_CorpseSpitterThink_6FCA3FE0_113c,
  MONAI_CorruptRogueArcherThink_6FCA26B0_113c,
  MONAI_FetishShamanOrCasterThink_6FCA8D80_113c,
  MONAI_GloamPackLightningDanceThink_6FCA0F20_113c,
  MONAI_OblivionKnightThink_6FCA7E60_113c,
  MONAI_SandMaggotThink_6FCA1C80_113c,
  MONAI_SiegeRunnerThink_6FCC66E0_113c,
  MONAI_SuccubusThink_6FCA8A70_113c,
  MONAI_TentacleBeastHeadThink_6FCA43F0_113c,
  MONREG_SelectRegionMonsterTypes_6FCEA760_113c,
  NPCS_InitGameNpcControl_6FCAFBE0_113c,
  PACKET_DeliverChatIfNotSquelched_6FCECA00_113c,
  PACKET_DeliverOverheadOrPartyChat_6FCED530_113c,
  PLRMODES_SendPlayerStop0DAndSyncStatAF_6FCED2C0_113c,
  PLRMODES_SyncBaseStatsToOtherClient_6FCED0E0_113c,
  SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c,
  SKILLS_SpawnNovaRingOfGuidedProjectiles_6FCB4370_113c,
  SKILLS_SpawnNovaRingOfSpiralProjectiles_6FCB3D60_113c,
  SKILLS_SrvDo024_SpawnWallOfProjectiles_6FC6D420_113c,
  SKILLS_SrvDo_MonsterLeapStep_6FCD60C0_113c,
  SKILLS_SrvDo_PulseElementalAura_6FCBAF50_113c,
  SKILLS_SrvDo_PulseUndeadAura_6FCBABC0_113c,
  SKILLS_TestPathReachableToCoords_6FCED790_113c,
} from '../../../src/d2kern-113c/game/k2-w5b6-113c.js'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.js'

interface W5B6Fixture {
  m: SparseMemory113c
  pGame: number
  pDataTables: number
  pMonStatsBase: number
  pSkillsBase: number
  pStatesBase: number
  pIscBase: number
  pRoom: number
}

function rdI32(m: SparseMemory113c, addr: number): number {
  return m.u32(addr >>> 0) | 0
}

function createFixture(): W5B6Fixture {
  const m = new SparseMemory113c()
  m.fill(0x6fd18000, 0x1c000, 0)
  m.fill(0x6fdd9000, 0x19000, 0)
  m.fill(0x6ff7f400, 0x900, 0)
  const pMasks = m.alloc(0x80)
  for (let b = 0; b < 32; b++) {
    m.setU32((pMasks + b * 4) >>> 0, (1 << b) >>> 0)
  }
  m.setU32(D2GAME_IAT_GDW_BITMASKS_VA_113C, pMasks)
  m.setU32(0x6fde9e18, pMasks)
  m.setU32(0x6fdd90b0, pMasks)
  m.setU32(0x6fdeff6c, m.alloc(16))
  const pAnimDataTable = m.alloc(0x600)
  const pEmptyAnimBucket = m.alloc(8)
  for (let i = 0; i < 256; i++) {
    m.setU32((pAnimDataTable + 4 + i * 4) >>> 0, pEmptyAnimBucket)
  }
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13c4, 20)
  m.setU32(0x6fdf13c8, 1)
  m.setU32(0x6fdf13cc, m.alloc(0x34 * 20))
  m.setU32(0x6fdf13d0, m.alloc(0x34 * 20))

  const pDataTables = m.alloc(0x1000)
  const pPtrHolder = m.alloc(8)
  m.setU32(pPtrHolder, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pPtrHolder)
  m.setU32(0x6fde9e1c, pDataTables)

  const pStatesBase = m.alloc(0x3c * 160)
  m.setU32((pDataTables + 0xbc) >>> 0, pStatesBase)
  m.setU32((pDataTables + 0xc4) >>> 0, 160)
  const pEmptyStateMask = m.alloc(0x40)
  for (let i = 0; i < 0x28; i++) {
    m.setU32((pDataTables + 0xcc + i * 4) >>> 0, pEmptyStateMask)
  }

  const pMonStatsBase = m.alloc(0x1a8 * 8)
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsBase)
  m.setU32((pDataTables + 0xa80) >>> 0, 8)

  const pSkillsBase = m.alloc(0x23c * 300)
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsBase)
  m.setU32((pDataTables + 0xba0) >>> 0, 300)

  const pIscBase = m.alloc(0x144 * 400)
  m.setU32((pDataTables + 0xbcc) >>> 0, pIscBase)
  m.setU32((pDataTables + 0xbd4) >>> 0, 400)
  m.setU16((pIscBase + 6 * 0x144 + 0x32) >>> 0, 7)
  m.setU8((pIscBase + 6 * 0x144 + 0x18) >>> 0, 8)
  m.setU16((pIscBase + 8 * 0x144 + 0x32) >>> 0, 9)
  m.setU8((pIscBase + 8 * 0x144 + 0x18) >>> 0, 8)

  m.setU32((pDataTables + 0xc5c) >>> 0, 136)

  const pGame = m.alloc(0x2000)
  m.setU32((pGame + 0xa8) >>> 0, 100)
  m.setU32((pGame + 0x70) >>> 0, 1)
  EVENT_InitTimerQueue113c(m, pGame)

  const pRoom = m.alloc(0x100)
  const pRoom2 = m.alloc(0x100)
  const pDrlgRoom2 = m.alloc(0x80)
  const pLevel = m.alloc(0x200)
  const pColl = m.alloc(0x28)
  m.setU32((pColl + 0x08) >>> 0, 200)
  m.setU32((pColl + 0x0c) >>> 0, 200)
  m.setU32((pColl + 0x20) >>> 0, m.alloc(200 * 200 * 2))
  m.setU32((pRoom + 0x10) >>> 0, pRoom2)
  m.setU32((pRoom + 0x20) >>> 0, pColl)
  m.setU32((pRoom + 0x24) >>> 0, 1)
  m.setU32((pRoom + 0x54) >>> 0, 200)
  m.setU32((pRoom + 0x58) >>> 0, 200)
  m.setU32((pRoom2 + 0x58) >>> 0, pLevel)
  m.setU32((pLevel + 0x1ac) >>> 0, 1)
  void pDrlgRoom2
  const ppRooms = m.alloc(8)
  m.setU32(ppRooms, pRoom)
  m.setU32(pRoom, ppRooms)
  m.setU32((pRoom + 0x30) >>> 0, 1)

  return { m, pGame, pDataTables, pMonStatsBase, pSkillsBase, pStatesBase, pIscBase, pRoom }
}

function allocMonsterUnit(
  f: W5B6Fixture,
  classId: number,
  guid: number,
  x: number,
  y: number,
): { pUnit: number; pAiControl: number; pAiParam: number; pMonStats: number } {
  const { m, pGame, pMonStatsBase, pRoom } = f
  const pUnit = m.alloc(0x100)
  const pMonData = m.alloc(0x60)
  const pAiGen = m.alloc(0x40)
  const pAiControl = m.alloc(0x40)
  const pPath = m.alloc(0x80)
  m.setU32(pUnit, 1)
  m.setU32((pUnit + 0x04) >>> 0, classId >>> 0)
  m.setU32((pUnit + 0x0c) >>> 0, guid >>> 0)
  m.setU32((pUnit + 0x10) >>> 0, 1)
  m.setU32((pUnit + 0x14) >>> 0, pMonData)
  m.setU32((pUnit + 0x20) >>> 0, 0x12345678)
  m.setU32((pUnit + 0x24) >>> 0, 0x9abcdef0)
  m.setU32((pUnit + 0x2c) >>> 0, pPath)
  m.setU32((pUnit + 0x80) >>> 0, pGame)
  m.setU32((pUnit + 0xa8) >>> 0, m.alloc(0x18))
  m.setU16((pPath + 0x02) >>> 0, x & 0xffff)
  m.setU16((pPath + 0x06) >>> 0, y & 0xffff)
  m.setU32((pPath + 0x1c) >>> 0, pRoom)
  m.setU32((pPath + 0x30) >>> 0, pUnit)
  const pMonStats = (pMonStatsBase + classId * 0x1a8) >>> 0
  m.setU32(pMonData, pMonStats)
  m.setU32((pMonData + 0x28) >>> 0, pAiGen)
  m.setU32((pMonData + 0x2c) >>> 0, pAiControl)
  m.setU32((pMonData + 0x30) >>> 0, m.alloc(0x20))
  STATLIST_CreateEx113c(m, pUnit, 0, pGame)
  STATLIST_SetUnitStat113c(m, pUnit, 6, 100 << 8, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 7, 100 << 8, 0)
  m.setU32((pGame + 0x1320 + ((guid & 0x7f) << 2)) >>> 0, pUnit)

  const pAiParam = m.alloc(0x28)
  m.setU32(pAiParam, pAiControl)
  m.setU32((pAiParam + 0x1c) >>> 0, pMonStats)
  return { pUnit, pAiControl, pAiParam, pMonStats }
}

describe('K2 Wave 5 Batch 6 (w5b6: 0x6FC68BA0..0x6FCEEF40)', () => {
  it('covers hireling level-up [1/45] and wall projectile spawn [2/45]', () => {
    const f = createFixture()
    const { m, pGame, pSkillsBase, pRoom } = f
    const pPlayer = m.alloc(0x100)
    const pPlrData = m.alloc(0xc0)
    const pPath = m.alloc(0x80)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x14) >>> 0, pPlrData)
    m.setU32((pPlayer + 0x2c) >>> 0, pPath)
    m.setU16((pPath + 0x02) >>> 0, 80)
    m.setU16((pPath + 0x06) >>> 0, 80)
    m.setU32((pPath + 0x1c) >>> 0, pRoom)
    HIRELING_LevelUpHirelingAndSyncSkills_6FC68BA0_113c(m, pGame, pPlayer, 0, 10)
    expect(() => HIRELING_LevelUpHirelingAndSyncSkills_6FC68BA0_113c(m, 0, pPlayer, 0, 10)).toThrow()

    expect(SKILLS_SrvDo024_SpawnWallOfProjectiles_6FC6D420_113c(m, pGame, pPlayer, -1, 1)).toBe(0)
    m.setU16((pSkillsBase + 10 * 0x23c + 0x3a) >>> 0, 0xffff)
    expect(SKILLS_SrvDo024_SpawnWallOfProjectiles_6FC6D420_113c(m, pGame, pPlayer, 10, 1)).toBe(1)
  })

  it('covers monster AI think callbacks [3/45..12/45, 20/45, 21/45]', () => {
    const f = createFixture()
    const { m, pGame } = f
    const mon = allocMonsterUnit(f, 1, 10, 100, 100)
    const tgt = allocMonsterUnit(f, 2, 11, 104, 104)
    m.setU8((tgt.pMonStats + 0x4e) >>> 0, 5)
    m.setU32((mon.pAiParam + 0x08) >>> 0, tgt.pUnit)
    m.setU32((mon.pAiParam + 0x14) >>> 0, 6)
    m.setU32((mon.pAiParam + 0x18) >>> 0, 0)
    m.setU16((mon.pMonStats + 0x170) >>> 0, 0xffff)
    m.setU16((mon.pMonStats + 0x172) >>> 0, 0xffff)
    m.setU16((mon.pMonStats + 0x174) >>> 0, 0xffff)
    m.setU16((mon.pMonStats + 0x176) >>> 0, 0xffff)

    m.setU32((mon.pAiControl + 0x14) >>> 0, 6)
    m.setU32((mon.pAiControl + 0x1c) >>> 0, 5)
    MONAI_GloamPackLightningDanceThink_6FCA0F20_113c(m, pGame, mon.pUnit, mon.pAiParam)
    expect(rdI32(m, (mon.pAiControl + 0x14) >>> 0)).toBe(2)

    m.setU32((mon.pAiControl + 0x14) >>> 0, 99)
    MONAI_SandMaggotThink_6FCA1C80_113c(m, pGame, mon.pUnit, mon.pAiParam)
    expect(rdI32(m, (mon.pAiControl + 0x14) >>> 0)).toBe(0)

    MONAI_CorruptRogueArcherThink_6FCA26B0_113c(m, pGame, mon.pUnit, mon.pAiParam)
    MONAI_BlunderboreThink_6FCA3CE0_113c(m, pGame, mon.pUnit, mon.pAiParam)
    expect(rdI32(m, (mon.pAiControl + 0x18) >>> 0)).toBe(0x0d)

    m.setU32((mon.pAiControl + 0x14) >>> 0, 5)
    MONAI_CorpseSpitterThink_6FCA3FE0_113c(m, pGame, mon.pUnit, mon.pAiParam)
    expect(rdI32(m, (mon.pAiControl + 0x14) >>> 0)).toBe(0)

    MONAI_TentacleBeastHeadThink_6FCA43F0_113c(m, pGame, mon.pUnit, mon.pAiParam)
    MONAI_OblivionKnightThink_6FCA7E60_113c(m, pGame, mon.pUnit, mon.pAiParam)
    MONAI_SuccubusThink_6FCA8A70_113c(m, pGame, mon.pUnit, mon.pAiParam)
    MONAI_FetishShamanOrCasterThink_6FCA8D80_113c(m, pGame, mon.pUnit, mon.pAiParam)
    MONAI_AuraKnightOrZealotThink_6FCA9430_113c(m, pGame, mon.pUnit, mon.pAiParam)

    m.setU32((mon.pUnit + 0xd0) >>> 0, 0x0b)
    MONAI_SiegeRunnerThink_6FCC66E0_113c(m, pGame, mon.pUnit, mon.pAiParam)
    expect(rdI32(m, (mon.pUnit + 0xd0) >>> 0)).toBe(8)
    expect(m.u32((pGame + 0x1118) >>> 0)).not.toBe(0)

    m.setU32((mon.pAiControl + 0x1c) >>> 0, 200)
    MONAI_BaalThroneThink_6FCC8430_113c(m, pGame, mon.pUnit, mon.pAiParam)
    expect(m.u32((mon.pUnit + 0xdc) >>> 0)).not.toBe(0)
  })

  it('covers NPC init [13/45], kick damage [14/45], nova rings [15..16/45], and pulse auras [17..18/45]', () => {
    const f = createFixture()
    const { m, pGame, pSkillsBase, pMonStatsBase } = f
    m.setU8((pMonStatsBase + 1 * 0x1a8 + 0x0d) >>> 0, 2)
    NPCS_InitGameNpcControl_6FCAFBE0_113c(m, pGame)
    const pNpcCtrl = m.u32((pGame + 0x1d24) >>> 0) >>> 0
    expect(pNpcCtrl).not.toBe(0)
    expect(rdI32(m, pNpcCtrl)).toBe(1)
    expect(rdI32(m, m.u32((pNpcCtrl + 4) >>> 0))).toBe(1)

    const pAssn = m.alloc(0x100)
    const pAssnPath = m.alloc(0x80)
    m.setU32(pAssn, 0)
    m.setU32((pAssn + 0x20) >>> 0, 0x11112222)
    m.setU32((pAssn + 0x2c) >>> 0, pAssnPath)
    m.setU32((pAssn + 0xa8) >>> 0, m.alloc(0x18))
    m.setU16((pAssnPath + 0x02) >>> 0, 60)
    m.setU16((pAssnPath + 0x06) >>> 0, 60)
    m.setU32((pAssnPath + 0x1c) >>> 0, f.pRoom)
    STATLIST_CreateEx113c(m, pAssn, 0, pGame)
    STATLIST_SetUnitStat113c(m, pAssn, 0, 100, 0)
    STATLIST_SetUnitStat113c(m, pAssn, 2, 100, 0)
    m.setU8((pSkillsBase + 2 * 0x23c + 0x1a4) >>> 0, 8)
    m.setU32((pSkillsBase + 2 * 0x23c + 0x1a8) >>> 0, 20)
    m.setU32((pSkillsBase + 2 * 0x23c + 0x1ac) >>> 0, 40)
    m.setU32((pSkillsBase + 2 * 0x23c + 0x1d8) >>> 0, 0xffffffff)
    m.setU32((pSkillsBase + 2 * 0x23c + 0x1dc) >>> 0, 0xffffffff)
    m.setU32((pSkillsBase + 2 * 0x23c + 0x220) >>> 0, 0xffffffff)
    const pDmg = m.alloc(0x70)
    SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c(m, pAssn, pGame, pDmg, 0, 2, 5)
    expect(rdI32(m, (pDmg + 0x08) >>> 0)).toBeGreaterThan(0)

    SKILLS_SpawnNovaRingOfSpiralProjectiles_6FCB3D60_113c(m, 123, pGame, pAssn, -1, 50, 50, 1, 1, 16)
    SKILLS_SpawnNovaRingOfGuidedProjectiles_6FCB4370_113c(m, 456, pGame, pAssn, -1, 50, 50, 1, 1, 16)

    expect(SKILLS_SrvDo_PulseUndeadAura_6FCBABC0_113c(m, pGame, pAssn, -1, 1)).toBe(0)
    expect(SKILLS_SrvDo_PulseElementalAura_6FCBAF50_113c(m, pGame, pAssn, -1, 1)).toBe(0)
    m.setU16((pSkillsBase + 5 * 0x23c + 0x80) >>> 0, 0xffff)
    expect(SKILLS_SrvDo_PulseUndeadAura_6FCBABC0_113c(m, pGame, pAssn, 5, 1)).toBe(0)
    expect(SKILLS_SrvDo_PulseElementalAura_6FCBAF50_113c(m, pGame, pAssn, 5, 1)).toBe(0)
    m.setU16((pSkillsBase + 5 * 0x23c + 0x80) >>> 0, 10)
    m.setU16((pSkillsBase + 5 * 0x23c + 0x82) >>> 0, 0xffff)
    for (let i = 0; i < 5; i++) {
      m.setU16((pSkillsBase + 5 * 0x23c + 0x98 + i * 2) >>> 0, 0xffff)
      m.setU32((pSkillsBase + 5 * 0x23c + 0xa4 + i * 4) >>> 0, 0xffffffff)
    }
    expect(SKILLS_SrvDo_PulseUndeadAura_6FCBABC0_113c(m, pGame, pAssn, 5, 1)).toBe(1)
    expect(SKILLS_SrvDo_PulseElementalAura_6FCBAF50_113c(m, pGame, pAssn, 5, 1)).toBe(1)
  })

  it('covers threat evaluators [19,27/45], Baal selector & clone [22,28/45], potions [23..25/45], leap [26/45], and A5 portals [29..30/45]', () => {
    const f = createFixture()
    const { m, pGame, pDataTables } = f
    const att = allocMonsterUnit(f, 1, 20, 100, 100)
    const cand = allocMonsterUnit(f, 2, 21, 102, 102)
    m.setU8((cand.pMonStats + 0x4e) >>> 0, 5)
    STATLIST_SetUnitStat113c(m, cand.pUnit, 0x16, 40, 0)

    const pTether = m.alloc(0x18)
    m.setU32((pTether + 0x0c) >>> 0, 100)
    m.setU32((pTether + 0x10) >>> 0, 100)
    expect(AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c(m, pTether, cand.pUnit, att.pUnit)).toBeGreaterThan(0)
    expect(AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c(m, pTether, cand.pUnit, att.pUnit)).toBeGreaterThan(0)

    m.setU32((att.pAiControl + 0x14) >>> 0, 7)
    expect(AIBAAL_SelectCombatAction_6FCC8E80_113c(m, att.pAiControl, att.pUnit, cand.pUnit, 80, 0, pTether)).toBe(7)
    m.setU32((att.pAiControl + 0x14) >>> 0, 0)
    expect(AIBAAL_SelectCombatAction_6FCC8E80_113c(m, att.pAiControl, att.pUnit, 0, 80, 0, pTether)).toBeGreaterThan(0)

    const pPlayer = m.alloc(0x100)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x20) >>> 0, 0x33445566)
    STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
    STATLIST_SetUnitStat113c(m, pPlayer, 6, 50 << 8, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 7, 100 << 8, 0)

    const pItemsTxt = m.alloc(0x1b0)
    m.setU32((pDataTables + 0xba8) >>> 0, pItemsTxt)
    m.setU32((pDataTables + 0xba4) >>> 0, 1)
    m.setU16((pItemsTxt + 0x9e) >>> 0, 0xffff)
    const pPot = m.alloc(0x100)
    m.setU32(pPot, 4)
    m.setU32((pPot + 0x04) >>> 0, 0)
    expect(ITEMS_UsePercentagePotion_6FCCE6D0_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(ITEMS_UseFlatOrBuffPotion_6FCCEA40_113c(m, pGame, pPlayer, 0)).toBe(0)
    expect(ITEMS_UseHealingOrManaPotion_6FCCEDC0_113c(m, pGame, pPlayer, 0)).toBe(0)

    expect(SKILLS_SrvDo_MonsterLeapStep_6FCD60C0_113c(m, pGame, att.pUnit, 0, 1)).toBe(0)
    expect(AIBAAL_TrySpawnBaalClone_6FCD7D30_113c(m, att.pUnit, pGame, att.pAiControl)).toBe(0)

    const pQuestArg = m.alloc(0x28)
    const pQuestState = m.alloc(0x50)
    m.setU32((pQuestArg + 0x04) >>> 0, pGame)
    m.setU32((pQuestArg + 0x18) >>> 0, pQuestState)
    m.setU8((pQuestState + 0x0e) >>> 0, 1)
    A5Q3_SpawnRedPortalObject13E_6FCE8CD0_113c(m, att.pUnit, pQuestArg)
    m.setU8((pQuestState + 0x03) >>> 0, 5)
    m.setU8((pQuestState + 0x0d) >>> 0, 0)
    expect(A5Q4_OpenTemplePortalObject_6FCE94E0_113c(m, pGame, pQuestArg)).toBe(1)
    expect(m.u8((pQuestState + 0x03) >>> 0)).toBe(0)
  })

  it('covers MONREG species selection [31/45], chat delivery [32,43/45], C2S validators [33..39,42/45], PLRMODES sync [40..41/45], path reachability [44/45], and drop gold [45/45]', () => {
    const f = createFixture()
    const { m, pGame, pMonStatsBase, pRoom } = f

    m.setU8((pMonStatsBase + 1 * 0x1a8 + 0x0c) >>> 0, 1)
    m.setU8((pMonStatsBase + 1 * 0x1a8 + 0x2e) >>> 0, 3)
    m.setU8((pMonStatsBase + 2 * 0x1a8 + 0x0c) >>> 0, 1)
    m.setU8((pMonStatsBase + 2 * 0x1a8 + 0x2e) >>> 0, 4)

    const pLevelsTxt = m.alloc(0xc0)
    m.setU8((pLevelsTxt + 0x32) >>> 0, 2)
    m.setU8((pLevelsTxt + 0x33) >>> 0, 2)
    m.setU16((pLevelsTxt + 0x36) >>> 0, 1)
    m.setU16((pLevelsTxt + 0x38) >>> 0, 2)
    const pSeed = m.alloc(8)
    m.setU32(pSeed, 0xabcdef01)
    m.setU32((pSeed + 4) >>> 0, 0x12345678)
    const pMonReg = m.alloc(0x200)
    MONREG_SelectRegionMonsterTypes_6FCEA760_113c(m, 0, pSeed, pLevelsTxt, pMonReg)
    expect(m.u8((pMonReg + 0x10) >>> 0)).toBe(2)
    expect(m.u8((pMonReg + 0x11) >>> 0)).toBe(7)

    const pPlayer = m.alloc(0x100)
    const pPlrData = m.alloc(0xc0)
    const pPlrPath = m.alloc(0x80)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x0c) >>> 0, 50)
    m.setU32((pPlayer + 0x14) >>> 0, pPlrData)
    m.setU32((pPlayer + 0x2c) >>> 0, pPlrPath)
    m.setU16((pPlrPath + 0x02) >>> 0, 100)
    m.setU16((pPlrPath + 0x06) >>> 0, 100)
    m.setU32((pPlrPath + 0x1c) >>> 0, pRoom)
    const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer)
    m.setU32((pPlayer + 0x60) >>> 0, pInv)
    STATLIST_CreateEx113c(m, pPlayer, 0, pGame)
    STATLIST_SetUnitStat113c(m, pPlayer, 0x0c, 15, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 0xaf, 99, 0)

    const pClient = m.alloc(0x600)
    m.setU32((pClient + 0x04) >>> 0, 4)
    m.setU8((pClient + 0x0d) >>> 0, 0x61)
    m.setU8((pClient + 0x0e) >>> 0, 0)
    m.setU8((pClient + 0x3d4) >>> 0, 1)
    m.setU32((pClient + 0x174) >>> 0, pPlayer)
    m.setU32((pClient + 0x1a8) >>> 0, pGame)
    m.setU32((pClient + 0x1bc) >>> 0, m.alloc(0x410))
    m.setU32((pPlrData + 0x9c) >>> 0, pClient)

    const pRawChat = m.alloc(0x140)
    m.setU8((pRawChat + 0x103) >>> 0, 0x62)
    const pChatMsg = m.alloc(0x140)
    const pChatDesc = m.alloc(0x10)
    m.setU32(pChatDesc, pChatMsg)
    m.setU32((pChatDesc + 4) >>> 0, pRawChat)
    m.setU32((pChatDesc + 8) >>> 0, 0xffffffff)
    m.setU32(0x6fd301e0, 0)
    m.setU32(0x6fd301e4, 0)
    PACKET_DeliverChatIfNotSquelched_6FCECA00_113c(m, pClient, pChatDesc)
    expect(m.u32(0x6fd301e4)).toBe(0)
    PACKET_DeliverOverheadOrPartyChat_6FCED530_113c(m, pClient, pChatDesc)

    expect(C2S_ValidateWaypointInteraction_6FCECB50_113c(m, 999, pGame, pPlayer, 0)).toBe(1)
    const ppOutMon = m.alloc(8)
    expect(C2S_ValidateNpcMonsterInteract_6FCECCF0_113c(m, pGame, 999, ppOutMon, pPlayer, 1)).toBe(1)

    const pCursorItem = m.alloc(0x100)
    m.setU32(pCursorItem, 4)
    m.setU32((pCursorItem + 0x0c) >>> 0, 77)
    m.setU32((pCursorItem + 0x10) >>> 0, 4)
    m.setU32((pCursorItem + 0x14) >>> 0, m.alloc(0x80))
    m.setU32((pGame + 0x1720 + ((77 & 0x7f) << 2)) >>> 0, pCursorItem)
    INVENTORY_SetCursorItem113c(m, pInv, pCursorItem)

    expect(C2S_ValidateBeltItemOwnership_6FCECDB0_113c(m, pGame, 77, pPlayer)).toBe(1)
    expect(C2S_ValidateInventoryOrCursorItem_6FCECE20_113c(m, pGame, 77, pPlayer)).toBe(0)
    expect(C2S_ValidateStoredOrEquippedItem_6FCECE90_113c(m, pGame, 77, pPlayer)).toBe(1)
    expect(C2S_ValidateStoredItem_6FCECF00_113c(m, pGame, 77, pPlayer)).toBe(1)
    expect(C2S_ValidateCursorItem_6FCECF70_113c(m, pGame, 77, pPlayer)).toBe(0)

    const pOtherPlr = m.alloc(0x100)
    m.setU32(pOtherPlr, 0)
    STATLIST_CreateEx113c(m, pOtherPlr, 0, pGame)
    STATLIST_SetUnitStat113c(m, pOtherPlr, 0, 30, 0)
    PLRMODES_SyncBaseStatsToOtherClient_6FCED0E0_113c(m, pClient, pOtherPlr)
    PLRMODES_SendPlayerStop0DAndSyncStatAF_6FCED2C0_113c(m, pPlayer, pClient, 1)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 0xaf, 0)).toBe(99)

    const pObjPkt = m.alloc(8)
    expect(C2S_SyncObjectCollisionByGuid_6FCED440_113c(m, pGame, pPlayer, pObjPkt, 4)).toBe(3)
    expect(C2S_SyncObjectCollisionByGuid_6FCED440_113c(m, pGame, pPlayer, pObjPkt, 5)).toBe(1)

    expect(SKILLS_TestPathReachableToCoords_6FCED790_113c(m, 500, 500, pGame, pPlayer)).toBe(0)

    const pGoldPkt = m.alloc(16)
    m.setU32((pGoldPkt + 1) >>> 0, 50)
    m.setU32((pGoldPkt + 5) >>> 0, 0)
    expect(C2S_Packet50_DropPlayerGold_6FCEEF40_113c(m, pGame, pPlayer, pGoldPkt, 8)).toBe(3)
    expect(C2S_Packet50_DropPlayerGold_6FCEEF40_113c(m, pGame, pPlayer, pGoldPkt, 9)).toBe(3)
  })
})
