import { describe, expect, it } from 'vitest'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  DATATABLES_OFF_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import { INVENTORY_AllocInventory113c } from '../../../src/d2kern-113c/common/inventory.ts'
import {
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import {
  AI_AlternatingMeleeOrApproach_6FC9F9A0_113c,
  AI_AuraBuffAndLineOfSightSkillCaster_6FC9E640_113c,
  AI_BasicMeleeOrStepApproach_6FC9D7C0_113c,
  AI_CardinalBeamTurret_6FC9C910_113c,
  AI_CastSkillAtRandomOffsetAroundSelf_6FC9D400_113c,
  AI_ChargeRunOrTripleSkillMelee_6FC9FB30_113c,
  AI_ComboMeleeAndDualSkill_6FC9F760_113c,
  AI_FoulCrowNestSpawner_6FC9D170_113c,
  AI_InitialStall5ThenMeleeApproach_6FC9E4D0_113c,
  AI_LinkedOwnerTurretCycle_6FC9CB10_113c,
  AI_MeleeOrDualSkillPathType7_6FC9FE60_113c,
  AI_MeleeOrPathType13Approach_6FC9DF00_113c,
  AI_MeleeStrafeOrStepApproach_6FC9F370_113c,
  AI_MosquitoNestSpawner_6FC9CFD0_113c,
  AI_OneShotSkillTrap_6FC9D310_113c,
  AI_PackBroadcastOrMeleeApproach_6FC9D910_113c,
  AI_RegeneratingMultiStateMonster_6FCA0450_113c,
  AI_ScanCallbackFetishMinions_6FC9BB90_113c,
  AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c,
  AI_ScanCallbackLowestLifeBaseIdEBOrEE_6FC9BC70_113c,
  AI_ScanCallbackNearestBaseId136_6FC9BA40_113c,
  AI_ScanCallbackNearestLowLifeUnit_6FC9B860_113c,
  AI_ScanCallbackNearestSelectableCorpse_6FC9BB00_113c,
  AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c,
  AI_SelfBuffOrSkillAndStrafe_6FC9DB70_113c,
  AI_StationaryMeleeTrap_6FC9BF50_113c,
  AI_SubmergedOrStuckTransition_6FC9D550_113c,
  AI_TentacleMeleeAttack_6FC9C580_113c,
  AI_TentacleSkillCastA_6FC9C060_113c,
  AI_TentacleSkillCastB_6FC9C1D0_113c,
  AI_ThreeStageSuicideMinion_6FC9F5A0_113c,
  AI_TryCastTentacleSpawnAtDirection_6FC9C6E0_113c,
  AI_UnburrowAndScheduleThink_6FC9BE10_113c,
  AI_WallTrapHorizontalY_6FC9C340_113c,
  AI_WallTrapVerticalX_6FC9C460_113c,
  D2GAME_MON_ALIGN_TABLE_PTR_VA_113C,
  EVENT_HandleFreeHoverMsg_6FC99AA0_113c,
  PLAYER_CanLootCorpse_6FC97E70_113c,
  PLAYER_FinalizeDeathStateAndEvents_6FC98230_113c,
  PLAYER_PruneAndCountLiveCorpses_6FC97F00_113c,
  UNITMSG_QueuePacket23SetSkill_6FC9A020_113c,
  UNITMSG_QueuePacket9ACoords_6FC9A440_113c,
  UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c,
  UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c,
  UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c,
  UNIT_SendStatB2Packet11ToClient_6FC9A570_113c,
} from '../../../src/d2kern-113c/game/k2-w3b8-113c.ts'
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
  D2ItemStatCostTxt_SIZE,
  D2MonStats2Txt_SIZE,
  D2MonStatsTxt_SIZE,
  D2SkillsTxt_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function createW3B8World() {
  const m = new SparseMemory113c()
  const pGame = m.alloc(0x2000)
  const pDataTables = m.alloc(0x1000)
  const pSgptHolder = m.alloc(4)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(pSgptHolder, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pSgptHolder)

  const pBitMasks = m.alloc(32 * 4)
  for (let b = 0; b < 32; b++) {
    m.setU32(pBitMasks + b * 4, (1 << b) >>> 0)
  }
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)
  m.setU32(D2GAME_MON_ALIGN_TABLE_PTR_VA_113C, pBitMasks)
  for (let i = 0; i < 256; i++) {
    m.setU8(0x6fdef0b0 + i, i & 7)
    m.setU8(0x6fde4ec4 + i, 1)
    m.setU8(0x6fde4ee4 + i, 1)
  }

  const pIsc74 = m.alloc(0x80 * D2ItemStatCostTxt_SIZE)
  for (let id = 0; id < 0x80; id++) {
    m.setU16(pIsc74 + id * D2ItemStatCostTxt_SIZE, id)
    m.setU32(pIsc74 + id * D2ItemStatCostTxt_SIZE + 4, 0x04)
  }
  m.setU32(pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt, pIsc74)
  m.setU32(pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount, 0x80)

  const pMonStatsTxt = m.alloc(512 * D2MonStatsTxt_SIZE)
  for (let i = 0; i < 512; i++) {
    const rec = pMonStatsTxt + i * D2MonStatsTxt_SIZE
    m.setU16(rec, i)
    m.setU16(rec + 0x02, i)
    m.setU16(rec + 0x18, i)
  }
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, 512)

  const pMonStats2Txt = m.alloc(512 * D2MonStats2Txt_SIZE)
  for (let i = 0; i < 512; i++) {
    m.setU16(pMonStats2Txt + i * D2MonStats2Txt_SIZE, i)
  }
  m.setU32(pDataTables + 0xa84, pMonStats2Txt)
  m.setU32(pDataTables + 0xa8c, 512)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, 512)

  const pSkillsTxt = m.alloc(64 * D2SkillsTxt_SIZE)
  for (let i = 0; i < 64; i++) {
    m.setU16(pSkillsTxt + i * D2SkillsTxt_SIZE, i)
  }
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 64)

  EVENT_InitTimerQueue113c(m, pGame)
  m.setU32(pGame + 0xa8, 100)
  return { m, pGame, pDataTables, pMonStatsTxt, pMonStats2Txt, pSkillsTxt }
}

function allocMonsterWithAi(
  w: ReturnType<typeof createW3B8World>,
  guid: number,
  classId: number,
  x: number,
  y: number,
) {
  const { m, pGame, pMonStatsTxt, pMonStats2Txt } = w
  const pUnit = m.alloc(0x100)
  const pMonData = m.alloc(0x60)
  const pAiControl = m.alloc(0x40)
  const pPath = m.alloc(0x200)
  const pRoom = m.alloc(0x80)
  const pSkillList = m.alloc(0x40)
  m.setU32(pUnit + 0x00, 1)
  m.setU32(pUnit + 0x04, classId)
  m.setU32(pUnit + 0x0c, guid)
  m.setU32(pUnit + 0x10, 1)
  m.setU32(pUnit + 0x14, pMonData)
  m.setU32(pUnit + 0x20, 0x12345678)
  m.setU32(pUnit + 0x24, 0x0000029a)
  m.setU32(pUnit + 0x2c, pPath)
  m.setU32(pUnit + 0xa8, pSkillList)
  m.setU32(pUnit + 0xc4, 0x04)
  m.setU16(pPath + 0x02, x)
  m.setU16(pPath + 0x06, y)
  m.setU32(pPath + 0x1c, pRoom)
  m.setU32(pPath + 0x30, pUnit)
  const pMonRecord = pMonStatsTxt + classId * D2MonStatsTxt_SIZE
  const pMonStats2Record = pMonStats2Txt + classId * D2MonStats2Txt_SIZE
  m.setU32(pMonData + 0x00, pMonRecord)
  m.setU32(pMonData + 0x2c, pAiControl)
  const pStatList = STATLIST_CreateEx113c(m, pUnit, 0, 0)
  m.setU32(pUnit + 0x5c, pStatList)
  STATLIST_SetUnitStat113c(m, pUnit, 6, 100 << 8, 0)
  STATLIST_SetUnitStat113c(m, pUnit, 7, 100 << 8, 0)
  SUNIT_InsertServerUnit113c(m, pGame, pUnit)
  const pAiParam = m.alloc(0x30)
  m.setU32(pAiParam + 0x00, pAiControl)
  m.setU32(pAiParam + 0x1c, pMonRecord)
  m.setU32(pAiParam + 0x20, pMonStats2Record)
  return { pUnit, pMonData, pAiControl, pPath, pRoom, pMonRecord, pMonStats2Record, pAiParam }
}

describe('k2 w3b8 1.13c oracle', () => {
  it('verifies player corpse loot, prune, finalize death, hover msg, and unit packet helpers ([1/45]..[10/45])', () => {
    const w = createW3B8World()
    const { m, pGame } = w
    const pPlayer = m.alloc(0x100)
    const pPlayerData = m.alloc(0x180)
    const pClient = m.alloc(0x400)
    const pPlayerPath = m.alloc(0x200)
    const pPlayerRoom = m.alloc(0x80)
    m.setU16(pPlayerPath + 0x02, 100)
    m.setU16(pPlayerPath + 0x06, 100)
    m.setU32(pPlayerPath + 0x1c, pPlayerRoom)
    m.setU32(pPlayerPath + 0x30, pPlayer)
    m.setU32(pPlayer + 0x00, 0)
    m.setU32(pPlayer + 0x0c, 10)
    m.setU32(pPlayer + 0x10, 1)
    m.setU32(pPlayer + 0x14, pPlayerData)
    m.setU32(pPlayer + 0x2c, pPlayerPath)
    m.setU32(pPlayerData + 0x9c, pClient)
    const pInv = INVENTORY_AllocInventory113c(m, 0, pPlayer)
    m.setU32(pPlayer + 0x60, pInv)
    const pStatList = STATLIST_CreateEx113c(m, pPlayer, 0, 0)
    m.setU32(pPlayer + 0x5c, pStatList)
    SUNIT_InsertServerUnit113c(m, pGame, pPlayer)

    const pCorpse = m.alloc(0x100)
    m.setU32(pCorpse + 0x00, 0)
    m.setU32(pCorpse + 0x0c, 11)
    m.setU32(pCorpse + 0x10, 0)
    const pCorpseInv = INVENTORY_AllocInventory113c(m, 0, pCorpse)
    m.setU32(pCorpse + 0x60, pCorpseInv)
    SUNIT_InsertServerUnit113c(m, pGame, pCorpse)

    expect(PLAYER_CanLootCorpse_6FC97E70_113c(m, pPlayer, pGame, pCorpse)).toBe(0)
    expect(PLAYER_PruneAndCountLiveCorpses_6FC97F00_113c(m, pPlayer, pGame)).toBe(0)

    EVENT_SetEventFull113c(m, pGame, pPlayer, 8, 120, 0, 0, 0)
    m.setU32(pClient + 0x3d4, 0x03)
    PLAYER_FinalizeDeathStateAndEvents_6FC98230_113c(m, pPlayer, pGame)
    expect(m.u32(pClient + 0x3d4)).toBe(0x01)
    expect(EVENT_GetNextEventFrame113c(m, pPlayer, 8)).toBe(0)

    const pHover = m.alloc(0x110)
    m.setU32(pPlayer + 0xa4, pHover)
    m.setU32(pPlayer + 0xc4, 0x20)
    EVENT_HandleFreeHoverMsg_6FC99AA0_113c(m, pGame, pPlayer)
    expect(m.u32(pPlayer + 0xa4)).toBe(0)
    expect(m.u32(pPlayer + 0xc4) & 0x100).toBe(0x100)

    m.setU32(pPlayer + 0xec, 0)
    m.setU32(pPlayer + 0xf0, 0)
    UNITMSG_QueuePacket23SetSkill_6FC9A020_113c(m, pPlayer, 1, 0x24, 0xffffffff)
    expect(m.u8(m.u32(pPlayer + 0xf0) + 0x04)).toBe(0x23)

    UNITMSG_QueuePacketA5StateSkill_6FC9A0F0_113c(m, pPlayer, 42)
    expect(m.u8(m.u32(pPlayer + 0xf0) + 0x04)).toBe(0xa5)

    UNITMSG_QueuePacketA3AuraTargetFx_6FC9A190_113c(m, pPlayer, pCorpse, 12, 3, 100, 200, 7)
    expect(m.u8(m.u32(pPlayer + 0xf0) + 0x04)).toBe(0xa3)

    UNITMSG_QueuePacket9EMercStat_6FC9A3A0_113c(m, pPlayer, 6, 250)
    expect(m.u8(m.u32(pPlayer + 0xf0) + 0x04)).toBe(0x9e)

    UNITMSG_QueuePacket9ACoords_6FC9A440_113c(m, pPlayer, 500, 1, 600, 2, 3)
    expect(m.u8(m.u32(pPlayer + 0xf0) + 0x04)).toBe(0x9a)

    STATLIST_SetUnitStat113c(m, pPlayer, 0xb2, 77, 0)
    UNIT_SendStatB2Packet11ToClient_6FC9A570_113c(m, pPlayer, pClient)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 0xb2, 0)).toBe(77)
  })

  it('verifies AI radius scan callbacks and turret/trap/tentacle AI functions ([11/45]..[30/45])', () => {
    const w = createW3B8World()
    const { m, pGame } = w
    const self = allocMonsterWithAi(w, 20, 10, 100, 100)
    const ally = allocMonsterWithAi(w, 21, 10, 103, 104)
    STATLIST_SetUnitStat113c(m, ally.pUnit, 6, 40 << 8, 0)
    STATLIST_SetUnitStat113c(m, ally.pUnit, 7, 100 << 8, 0)

    const pCtxLowLife = m.alloc(0x10)
    m.setU32(pCtxLowLife + 0x04, 999)
    m.setU32(pCtxLowLife + 0x08, 50)
    AI_ScanCallbackNearestLowLifeUnit_6FC9B860_113c(m, self.pUnit, ally.pUnit, pCtxLowLife)
    expect(m.u32(pCtxLowLife)).toBe(ally.pUnit)
    expect(m.u32(pCtxLowLife + 0x04)).toBe(25)

    m.setU32(ally.pUnit + 0xc4, 0x02)
    m.setU8(ally.pMonRecord + 0x0d, 0xff)
    const pCtxResHeal = m.alloc(0x20)
    m.setU32(pCtxResHeal + 0x10, 100)
    m.setU32(pCtxResHeal + 0x14, 0)
    m.setU32(pCtxResHeal + 0x18, 1)
    AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c(m, self.pUnit, ally.pUnit, pCtxResHeal)
    expect(m.u32(pCtxResHeal + 0x04)).toBe(ally.pUnit)

    const mon136 = allocMonsterWithAi(w, 22, 0x136, 106, 108)
    m.setU32(mon136.pUnit + 0xc4, 0x02)
    const pCtx136 = m.alloc(0x18)
    m.setU32(pCtx136 + 0x08, 999)
    m.setU32(pCtx136 + 0x0c, 999)
    m.setU32(pCtx136 + 0x10, 999)
    AI_ScanCallbackNearestBaseId136_6FC9BA40_113c(m, self.pUnit, mon136.pUnit, pCtx136)
    expect(m.u32(pCtx136)).toBe(mon136.pUnit)

    const corpseMon = allocMonsterWithAi(w, 23, 12, 102, 102)
    m.setU32(corpseMon.pUnit + 0x10, 0x0c)
    m.setU32(corpseMon.pUnit + 0xc4, 0x02)
    m.setU32(corpseMon.pMonStats2Record + 0x04, 1 << 0x0c)
    const pCtxCorpse = m.alloc(0x10)
    m.setU32(pCtxCorpse + 0x04, 999)
    AI_ScanCallbackNearestSelectableCorpse_6FC9BB00_113c(
      m,
      self.pUnit,
      corpseMon.pUnit,
      pCtxCorpse,
    )
    expect(m.u32(pCtxCorpse)).toBe(corpseMon.pUnit)

    const fetish = allocMonsterWithAi(w, 24, 0x8d, 101, 101)
    m.setU32(fetish.pUnit + 0xc4, 0x02)
    const pCtxFetish = m.alloc(0x20)
    m.setU32(pCtxFetish + 0x08, 999)
    m.setU32(pCtxFetish + 0x10, 999)
    m.setU32(pCtxFetish + 0x18, 3)
    AI_ScanCallbackFetishMinions_6FC9BB90_113c(m, self.pUnit, fetish.pUnit, pCtxFetish)
    expect(m.u32(pCtxFetish + 0x14)).toBe(1)

    const monEB = allocMonsterWithAi(w, 25, 0xeb, 104, 104)
    STATLIST_SetUnitStat113c(m, monEB.pUnit, 6, 30 << 8, 0)
    const pCtxEB = m.alloc(0x18)
    m.setU32(pCtxEB + 0x0c, 100)
    AI_ScanCallbackLowestLifeBaseIdEBOrEE_6FC9BC70_113c(m, self.pUnit, monEB.pUnit, pCtxEB)
    expect(m.u32(pCtxEB)).toBe(monEB.pUnit)

    m.setU32(self.pUnit + 0x10, 0x0e)
    AI_UnburrowAndScheduleThink_6FC9BE10_113c(m, pGame, self.pUnit)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(112)

    m.setU32(self.pAiParam + 0x08, ally.pUnit)
    m.setU32(self.pAiParam + 0x18, 0)
    AI_StationaryMeleeTrap_6FC9BF50_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(140)

    m.setU32(self.pAiParam + 0x14, 5)
    m.setU16(self.pMonRecord + 0x56, 10)
    m.setU16(self.pMonRecord + 0x5c, 10)
    m.setU16(self.pMonRecord + 0x62, 11)
    m.setU16(self.pMonRecord + 0x170, 0xffff)
    AI_TentacleSkillCastA_6FC9C060_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(111)

    m.setU16(self.pMonRecord + 0x62, 12)
    AI_TentacleSkillCastB_6FC9C1D0_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(112)

    m.setU32(self.pAiParam + 0x14, 20)
    AI_WallTrapHorizontalY_6FC9C340_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(140)

    AI_WallTrapVerticalX_6FC9C460_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(140)

    m.setU32(self.pAiParam + 0x14, 5)
    m.setU32(self.pAiControl + 0x18, 1)
    m.setU16(self.pMonRecord + 0x62, 16)
    AI_TentacleMeleeAttack_6FC9C580_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(116)

    expect(
      AI_TryCastTentacleSpawnAtDirection_6FC9C6E0_113c(
        m,
        ally.pUnit,
        self.pUnit,
        self.pMonRecord,
        pGame,
      ),
    ).toBe(0)

    m.setU32(self.pAiControl + 0x14, 15)
    AI_CardinalBeamTurret_6FC9C910_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(115)

    const pAiGeneral = m.alloc(0x40)
    m.setU32(pAiGeneral + 0x28, 1)
    m.setU32(pAiGeneral + 0x2c, 21)
    m.setU32(pAiGeneral + 0x30, 1)
    m.setU32(self.pMonData + 0x28, pAiGeneral)
    m.setU16(self.pMonRecord + 0x170, 0xffff)
    m.setU16(self.pMonRecord + 0x172, 0xffff)
    m.setU16(self.pMonRecord + 0x6e, 18)
    AI_LinkedOwnerTurretCycle_6FC9CB10_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(118)

    const pMetrics = m.alloc(0x28)
    AI_ScanCallbackHostileTargetsMetrics_6FC9CF10_113c(
      m,
      pGame,
      self.pUnit,
      ally.pUnit,
      pMetrics,
    )
    expect(m.u32(pMetrics + 0x1c)).toBe(0)

    m.setU32(self.pAiParam + 0x14, 30)
    AI_MosquitoNestSpawner_6FC9CFD0_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(125)

    AI_FoulCrowNestSpawner_6FC9D170_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(125)

    m.setU16(self.pMonRecord + 0x170, 0xffff)
    m.setU32(self.pAiControl + 0x14, 0)
    m.setU16(self.pMonRecord + 0x56, 21)
    AI_OneShotSkillTrap_6FC9D310_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(121)
  })

  it('verifies monster AI functions [31/45]..[45/45] (0x6FC9D400..0x6FCA0450)', () => {
    const w = createW3B8World()
    const { m, pGame } = w
    const self = allocMonsterWithAi(w, 30, 15, 100, 100)
    const target = allocMonsterWithAi(w, 31, 16, 105, 105)
    m.setU32(self.pAiParam + 0x08, target.pUnit)
    m.setU16(self.pMonRecord + 0x170, 0xffff)
    m.setU16(self.pMonRecord + 0x172, 0xffff)
    m.setU16(self.pMonRecord + 0x174, 0xffff)

    m.setU16(self.pMonRecord + 0x5c, 12)
    AI_CastSkillAtRandomOffsetAroundSelf_6FC9D400_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(112)

    m.setU32(self.pUnit + 0x10, 0x0b)
    m.setU32(self.pAiControl + 0x14, 0)
    AI_SubmergedOrStuckTransition_6FC9D550_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(m.u32(self.pAiControl + 0x14)).toBe(1)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(101)

    m.setU32(self.pAiParam + 0x18, 0)
    m.setU16(self.pMonRecord + 0x56, 0)
    m.setU16(self.pMonRecord + 0x5c, 14)
    AI_BasicMeleeOrStepApproach_6FC9D7C0_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(114)

    m.setU32(self.pAiControl + 0x14, 0)
    m.setU32(self.pAiParam + 0x18, 0)
    m.setU32(self.pAiParam + 0x14, 20)
    m.setU16(self.pMonRecord + 0x62, 5)
    m.setU16(self.pMonRecord + 0x5c, 0)
    m.setU16(self.pMonRecord + 0x68, 15)
    AI_PackBroadcastOrMeleeApproach_6FC9D910_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(115)

    m.setU32(self.pAiParam + 0x18, 0)
    m.setU32(self.pAiControl + 0x18, 0)
    m.setU16(self.pMonRecord + 0x56, 0)
    m.setU16(self.pMonRecord + 0x7a, 0)
    m.setU16(self.pMonRecord + 0x80, 0)
    AI_SelfBuffOrSkillAndStrafe_6FC9DB70_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(115)

    m.setU32(self.pAiParam + 0x18, 0)
    m.setU16(self.pMonRecord + 0x62, 0)
    m.setU16(self.pMonRecord + 0x68, 17)
    AI_MeleeOrPathType13Approach_6FC9DF00_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(117)

    m.setU32(self.pAiControl + 0x14, 0)
    AI_InitialStall5ThenMeleeApproach_6FC9E4D0_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(m.u32(self.pAiControl + 0x14)).toBe(1)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(105)

    m.setU32(self.pAiControl + 0x14, 1)
    m.setU32(self.pAiControl + 0x18, 19)
    m.setU32(self.pAiControl + 0x1c, 2)
    m.setU32(self.pPath + 0x1c, 0)
    m.setU32(self.pAiParam + 0x18, 0)
    AI_AuraBuffAndLineOfSightSkillCaster_6FC9E640_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(m.u32(self.pAiControl + 0x18)).toBe(0)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(119)
    m.setU32(self.pPath + 0x1c, self.pRoom)

    m.setU32(self.pAiParam + 0x18, 0)
    m.setU16(self.pMonRecord + 0x56, 0)
    m.setU16(self.pMonRecord + 0x62, 20)
    AI_MeleeStrafeOrStepApproach_6FC9F370_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(120)

    m.setU32(self.pAiControl + 0x14, 0)
    m.setU32(self.pAiParam + 0x14, 30)
    m.setU16(self.pMonRecord + 0x5c, 5)
    m.setU16(self.pMonRecord + 0x62, 22)
    AI_ThreeStageSuicideMinion_6FC9F5A0_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(122)

    m.setU32(self.pAiParam + 0x18, 0)
    m.setU16(self.pMonRecord + 0x62, 0)
    m.setU16(self.pMonRecord + 0x68, 23)
    AI_ComboMeleeAndDualSkill_6FC9F760_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(m.u32(self.pAiControl + 0x14)).toBe(0)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(123)

    m.setU32(self.pAiParam + 0x18, 0)
    m.setU16(self.pMonRecord + 0x62, 0)
    m.setU16(self.pMonRecord + 0x68, 24)
    AI_AlternatingMeleeOrApproach_6FC9F9A0_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(124)

    m.setU32(self.pAiParam + 0x14, 5)
    m.setU32(self.pAiParam + 0x18, 0)
    m.setU16(self.pMonRecord + 0x6e, 10)
    m.setU16(self.pMonRecord + 0x56, 0)
    m.setU16(self.pMonRecord + 0x62, 26)
    AI_ChargeRunOrTripleSkillMelee_6FC9FB30_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(126)

    m.setU32(self.pAiParam + 0x18, 0)
    m.setU16(self.pMonRecord + 0x5c, 100)
    AI_MeleeOrDualSkillPathType7_6FC9FE60_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(EVENT_GetNextEventFrame113c(m, self.pUnit, 2)).toBe(105)

    m.setU32(self.pAiControl + 0x14, 0)
    STATLIST_SetUnitStat113c(m, self.pUnit, 0x4a, 16, 0)
    m.setU16(self.pMonRecord + 0x6e, 4)
    AI_RegeneratingMultiStateMonster_6FCA0450_113c(m, pGame, self.pUnit, self.pAiParam)
    expect(m.u32(self.pAiControl + 0x14)).toBe(1)
    expect(m.u32(self.pAiControl + 0x1c)).toBe(8)
    expect(STATLIST_GetUnitStat113c(m, self.pUnit, 0x4a, 0)).toBe(24)
  })
})
