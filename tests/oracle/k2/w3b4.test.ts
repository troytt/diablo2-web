import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  D2COMMON_ITEMS_TXT_COUNT_VA_113C,
  D2COMMON_ITEMS_TXT_PTR_VA_113C,
  INVENTORY_AllocInventory113c,
  ITEMS_TXT_STRIDE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts'
import {
  MISSILE_AllocMissileData113c,
  MISSILE_GetRemainingFrames113c,
  MISSILE_GetTargetX113c,
  MISSILE_GetTargetY113c,
  MISSILE_SetLevel113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetSkill113c,
  MISSILE_SetTargetX113c,
  MISSILE_SetTargetY113c,
  MISSILE_SetTotalFrames113c,
} from '../../../src/d2kern-113c/common/missile.ts'
import {
  PATH_SetTargetUnit113c,
  PATH_SetVelocity113c,
} from '../../../src/d2kern-113c/common/path.ts'
import {
  SKILLS_SetParam1113c,
  SKILLS_GetParam1113c,
} from '../../../src/d2kern-113c/common/skills.ts'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import { ensureD2CommonPathGlobals113c } from '../../../src/d2kern-113c/game/tables-bootstrap-113c.ts'
import * as w3b4Exports from '../../../src/d2kern-113c/game/k2-w3b4-113c.ts'
import {
  CLIENTS_AllocAndLinkClient_6FC6A9B0_113c,
  CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c,
  MISSILE_SrvDo_CollisionPatternAndAnimFrame_6FC61980_113c,
  MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c,
  MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c,
  MISSILE_SrvDo_HomingTargetStep_6FC61240_113c,
  MISSILE_SrvDo_PeriodicSrvDoFunc_6FC60E10_113c,
  MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c,
  MISSILE_SrvDo_RadialRingSubMissile_6FC60CA0_113c,
  MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c,
  MISSILE_SrvDo_SpiralPath_6FC60BD0_113c,
  MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c,
  MISSILE_SrvDo_TrailInlineCoordSubMissile_6FC61520_113c,
  MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c,
  MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c,
  MISSILE_SrvDo_TrailVerifiedOwnerSubMissile_6FC61850_113c,
  REGPOP_SpawnMonsterFormation_6FC671E0_113c,
  SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c,
  SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c,
  SKILLS_AbsorbPhysicalDamageByBoneArmor_6FC6DFE0_113c,
  SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c,
  SKILLS_ApplySlowTargetOnHit_6FC6EF70_113c,
  SKILLS_AuraCallback_ApplyAuraStatListFromCtx_6FC6C220_113c,
  SKILLS_BloodGolemShareLifeSteal_6FC6E5F0_113c,
  SKILLS_HealBloodGolemFromPlayerHeal_6FC6EA30_113c,
  SKILLS_InitNecroSkeletonPetComponents_6FC6EB50_113c,
  SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c,
  SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c,
  SKILLS_LifeTapHealAttackerOnHit_6FC6E760_113c,
  SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c,
  SKILLS_SpawnBlazeTrailMissileOnStep_6FC639A0_113c,
  SKILLS_SpawnChargedSrvMissileWithTargetId_6FC65410_113c,
  SKILLS_SrvDo_ApplyAlliedTargetAuraStats_6FC62570_113c,
  SKILLS_SrvDo_ApplySelfAuraAndItemEvents_6FC62730_113c,
  SKILLS_SrvDo_ChargedStrikeBolts_6FC6D040_113c,
  SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c,
  SKILLS_SrvDo_DruidChargeUpHit_6FC66000_113c,
  SKILLS_SrvDo_DruidShapeShift_6FC65CE0_113c,
  SKILLS_SrvDo_LightningStrikeBounce_6FC6CE10_113c,
  SKILLS_SrvSt_DruidChargeUpMelee_6FC64C20_113c,
  SKILLS_SrvSt_MeleeWithElemConversion_6FC64D70_113c,
  SKILLS_SrvSt_MeleeWithSkillElemDamage_6FC6C3A0_113c,
  SKILLS_SrvSt_ValidateTargetInCalc1Range_6FC62360_113c,
  SKILLS_TransferGolemDamageToOwnerLife_6FC6E500_113c,
  SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c,
} from '../../../src/d2kern-113c/game/k2-w3b4-113c.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2DrlgLevelStrc,
  D2DrlgLevelStrc_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2RoomCollisionGridStrc,
  D2RoomCollisionGridStrc_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

interface W3B4World {
  m: SparseMemory113c
  pGame: number
  pDataTables: number
  pMissilesTxt: number
  pSkillsTxt: number
  pSkillCode: number
  pIscTxt: number
  pStatesTxt: number
  pMonStatsTxt: number
  pMonStats2Txt: number
  pMonLvlTxt: number
  pLevelsTxt: number
}

function createW3B4World(): W3B4World {
  const m = new SparseMemory113c()
  m.fill(0x6fd18000, 0x20000, 0)
  m.fill(0x6fdd6000, 0x20000, 0)

  const pDataTables = m.alloc(0x1000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  ensureD2CommonPathGlobals113c(m)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(0x6fd18be0))

  const missilesCount = 64
  const pMissilesTxt = m.alloc(missilesCount * 0x1a4)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, missilesCount)

  const skillsCount = 350
  const pSkillsTxt = m.alloc(skillsCount * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, skillsCount)

  const pSkillCode = m.alloc(0x400)
  m.setU32(pDataTables + 0x40, pSkillCode)
  m.setU32(pDataTables + 0x44, 0x400)

  const iscCount = 400
  const pIscTxt = m.alloc(iscCount * 0x144)
  m.setU32(pDataTables + 0xbcc, pIscTxt)
  m.setU32(pDataTables + 0xbd4, iscCount)

  const statesCount = 200
  const pStatesTxt = m.alloc(statesCount * 0x3c)
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xc4, statesCount)
  m.setU32(pDataTables + 0xbb8, pStatesTxt)
  m.setU32(pDataTables + 0xbc0, statesCount)

  const pCorpseStateMask = m.alloc(64)
  for (let off = 0xc8; off <= 0x178; off += 4) {
    m.setU32(pDataTables + off, pCorpseStateMask)
  }

  const pCharStatsTxt = m.alloc(8 * 0xc4)
  m.setU32(pDataTables + 0xbc4, pCharStatsTxt)
  m.setU32(pDataTables + 0xbc8, 8)

  const monStatsCount = 400
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    m.setU16(pMonStatsTxt + i * 0x1a8 + 0x06, i)
    m.setU16(pMonStatsTxt + i * 0x1a8 + 0x18, i)
  }

  const monStats2Count = 400
  const pMonStats2Txt = m.alloc(monStats2Count * 0x134)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, monStats2Count)

  const monLvlCount = 120
  const pMonLvlTxt = m.alloc(monLvlCount * 0x78)
  m.setU32(pDataTables + 0xb70, pMonLvlTxt)
  m.setU32(pDataTables + 0xb74, monLvlCount)

  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0x1dc, pLevelsTxt)
  m.setU32(pDataTables + 0x1e0, 140)
  for (let lvl = 1; lvl < 140; lvl++) {
    m.set(pLevelsTxt + lvl * D2LevelsTxt_SIZE, D2LevelsTxt.nAct, 0)
  }

  const pItemsTxt = m.alloc(32 * ITEMS_TXT_STRIDE_113C)
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA_113C, pItemsTxt)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA_113C, 32)

  // AnimData table + PlrMode globals
  const pAnimDataTable = m.alloc(0x500)
  const pEmptyBucket = m.alloc(16)
  for (let i = 0; i < 256; i++) {
    m.setU32(pAnimDataTable + i * 4, pEmptyBucket)
  }
  m.setU32(pAnimDataTable + 0x40c, 8)
  m.setU32(pAnimDataTable + 0x410, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13a4, 20)
  m.setU32(0x6fdf13b0, m.alloc(20 * 0x34))
  m.setU32(0x6fdf13c4, 20)
  m.setU32(0x6fdf13c8, 1)
  m.setU32(0x6fdf13cc, m.alloc(20 * 0x34))
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34))

  const pGame = m.alloc(0x2000)
  m.setU32(pGame + 0xa8, 100)
  m.setU32(pGame + 0x1d28, m.alloc(0x20))
  EVENT_InitTimerQueue113c(m, pGame)

  return {
    m,
    pGame,
    pDataTables,
    pMissilesTxt,
    pSkillsTxt,
    pSkillCode,
    pIscTxt,
    pStatesTxt,
    pMonStatsTxt,
    pMonStats2Txt,
    pMonLvlTxt,
    pLevelsTxt,
  }
}

function writeRpnImm32(m: SparseMemory113c, pSkillCode: number, offset: number, val: number): number {
  const addr = (pSkillCode + offset) >>> 0
  m.setU8(addr, 0x09)
  m.setU32((addr + 1) >>> 0, val >>> 0)
  m.setU8((addr + 5) >>> 0, 0x00)
  return offset
}

function allocRoomWithCollision(
  m: SparseMemory113c,
  subtileX = 100,
  subtileY = 200,
  width = 40,
  height = 40,
  nLevelId = 2,
): { pRoom: number; pGrid: number; pCells: number } {
  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
  const pRoomEx = m.alloc(D2RoomExStrc_SIZE)
  const pLevel = m.alloc(D2DrlgLevelStrc_SIZE)
  const pActFlag = m.alloc(16)
  const pGrid = m.alloc(D2RoomCollisionGridStrc_SIZE)
  const pCells = m.alloc(width * height * 2)

  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, pActFlag)
  m.set(pRoom, D2ActiveRoomStrc.pCollisionGrid, pGrid)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileX, subtileX)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileY, subtileY)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileWidth, width)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileHeight, height)

  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  m.set(pLevel, D2DrlgLevelStrc.nLevelId, nLevelId)

  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileX, subtileX)
  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileY, subtileY)
  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileWidth, width)
  m.set(pGrid, D2RoomCollisionGridStrc.nSubtileHeight, height)
  m.set(pGrid, D2RoomCollisionGridStrc.pMapStart, pCells)

  return { pRoom, pGrid, pCells }
}

function allocDynamicUnitWithRoom(
  m: SparseMemory113c,
  pGame: number,
  unitType: number,
  classId: number,
  unitId: number,
  pRoom: number,
  x = 110,
  y = 210,
): { pUnit: number; pPath: number; pUnitData: number; pStatListEx: number } {
  const pUnit = m.alloc(0x100)
  const pUnitData = m.alloc(0x100)
  const pPath = m.alloc(0x80)
  m.setU32(pUnit, unitType >>> 0)
  m.setU32(pUnit + 0x04, classId >>> 0)
  m.setU32(pUnit + 0x0c, unitId >>> 0)
  m.setU32(pUnit + 0x10, 1) // neutral/alive anim mode
  m.setU32(pUnit + 0x14, pUnitData)
  if (unitType === 1) {
    const pDataTables = m.u32(0x6fde9e1c)
    const pMonStatsTxt = m.u32(pDataTables + 0xa78)
    m.setU32(pUnitData, (pMonStatsTxt + classId * 0x1a8) >>> 0)
  }
  m.setU32(pUnit + 0x20, 0x12345678)
  m.setU32(pUnit + 0x24, 0x9abcdef0)
  m.setU32(pUnit + 0x2c, pPath)
  m.setU32(pUnit + 0x80, pGame)
  m.setU16(pPath + 0x02, x & 0xffff)
  m.setU16(pPath + 0x06, y & 0xffff)
  m.setU32(pPath + 0x1c, pRoom)
  m.setU32(pPath + 0x30, pUnit)
  const pStatListEx = STATLIST_CreateEx113c(m, pUnit, 0, 0)
  m.setU32(pUnit + 0x5c, pStatListEx)
  if (unitType === 0) {
    const pAlignList = STATLIST_AllocList113c(m, 0, 2, 0, 0, unitId)
    STATLIST_SetState113c(m, pAlignList, 0x69)
    STATLIST_SetStat113c(m, pAlignList, 0xac, 2, 0)
    STATLIST_MergeStatLists113c(m, pUnit, pAlignList, 1)
  }
  m.setU32(pUnit + 0xc4, 0x02) // UNITFLAG_TARGETABLE
  SUNIT_InsertServerUnit113c(m, pGame, pUnit)
  return { pUnit, pPath, pUnitData, pStatListEx }
}

function allocMissileUnit(
  m: SparseMemory113c,
  pGame: number,
  classId: number,
  unitId: number,
  pOwner: number,
  pRoom: number,
  nSkillId = 5,
  nLevel = 3,
  x = 112,
  y = 212,
): { pMissile: number; pPath: number; pMissileData: number } {
  const { pUnit: pMissile, pPath } = allocDynamicUnitWithRoom(m, pGame, 3, classId, unitId, pRoom, x, y)
  m.setU32(pMissile + 0x10, 0) // colMode = 0
  m.setU32(pMissile + 0x14, 0)
  MISSILE_AllocMissileData113c(m, pMissile)
  const pMissileData = m.u32(pMissile + 0x14)
  MISSILE_SetSkill113c(m, pMissile, nSkillId)
  MISSILE_SetLevel113c(m, pMissile, nLevel)
  MISSILE_SetTotalFrames113c(m, pMissile, 20)
  MISSILE_SetRemainingFrames113c(m, pMissile, 10)
  if (pOwner !== 0) {
    m.setU32(pMissile + 0x94, m.u32(pOwner))
    m.setU32(pMissile + 0x98, m.u32(pOwner + 0x0c))
    m.setU32(pMissile + 0xc8, m.u32(pMissile + 0xc8) | 0x400)
  }
  return { pMissile, pPath, pMissileData }
}

describe('K2 Wave 3 Batch 4 (w3b4: 45 functions across 0x6FC60070..0x6FC6F4D0)', () => {
  it('exports all 45 functions with exact _6FCXXXXX_113c naming', () => {
    const fnNames = Object.entries(w3b4Exports)
      .filter(([, v]) => typeof v === 'function')
      .map(([k]) => k)
    expect(fnNames.length).toBe(45)
    for (const name of fnNames) {
      expect(name).toMatch(/_6FC[0-9A-F]{5}_113c$/)
    }
  })

  it('verifies missile SrvDo scatter, trail, perpendicular, follow-owner, spiral, and radial ring (0x6FC60070..0x6FC60CA0)', () => {
    const { m, pGame, pMissilesTxt } = createW3B4World()
    const { pRoom } = allocRoomWithCollision(m)
    const { pUnit: pOwner } = allocDynamicUnitWithRoom(m, pGame, 0, 1, 10, pRoom, 110, 210)
    const { pMissile, pPath } = allocMissileUnit(m, pGame, 2, 50, pOwner, pRoom, 5, 3, 112, 212)

    // Configure MissilesTxt[2] with subMissile1 = 3, Param1 = 2, Param2 = 4, Param3 = 0, Param4 = 30
    const pMis2 = pMissilesTxt + 2 * 0x1a4
    m.setU16(pMis2 + 0x18, 3)
    m.setU32(pMis2 + 0x38, 2) // Param1
    m.setU32(pMis2 + 0x3c, 4) // Param2
    m.setU32(pMis2 + 0x40, 0) // Param3
    m.setU32(pMis2 + 0x44, 30) // Param4

    // 1. 0x6FC60070: MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c
    expect(MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c(m, pGame, 0)).toBe(2)
    MISSILE_SetTargetX113c(m, pMissile, 12345)
    expect(typeof MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c(m, pGame, pMissile)).toBe('number')
    expect(MISSILE_GetTargetX113c(m, pMissile)).not.toBe(12345)

    // 2. 0x6FC605E0: MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c
    expect(MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c(m, pGame, 0)).toBe(2)
    m.setU32(pPath + 0x44, 0x08) // PATH_CheckFlag08_113c
    expect(typeof MISSILE_SrvDo_TrailSubMissile_6FC605E0_113c(m, pGame, pMissile)).toBe('number')

    // 3. 0x6FC606D0: MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c
    expect(MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c(m, pGame, 0)).toBe(2)
    MISSILE_SetTotalFrames113c(m, pMissile, 10)
    MISSILE_SetRemainingFrames113c(m, pMissile, 10) // elapsed = 0 (< 2)
    m.setU16(pPath + 0x10, 118) // FirstPointX
    m.setU16(pPath + 0x12, 220) // FirstPointY
    expect(typeof MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c(m, pGame, pMissile)).toBe('number')

    // 4. 0x6FC60860: MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c
    expect(MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c(m, pGame, 0)).toBe(2)
    expect(MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c(m, pGame, pMissile)).toBe(1)

    // 5. 0x6FC60BD0: MISSILE_SrvDo_SpiralPath_6FC60BD0_113c
    expect(MISSILE_SrvDo_SpiralPath_6FC60BD0_113c(m, pGame, 0)).toBe(2)
    MISSILE_SetTotalFrames113c(m, pMissile, 10)
    MISSILE_SetRemainingFrames113c(m, pMissile, 10) // elapsed = 0, % nStep == 0
    MISSILE_SetTargetX113c(m, pMissile, 20)
    MISSILE_SetTargetY113c(m, pMissile, 10)
    expect(typeof MISSILE_SrvDo_SpiralPath_6FC60BD0_113c(m, pGame, pMissile)).toBe('number')
    expect(MISSILE_GetTargetX113c(m, pMissile)).toBe(5)
    expect(MISSILE_GetTargetY113c(m, pMissile)).toBe(15)

    // 6. 0x6FC60CA0: MISSILE_SrvDo_RadialRingSubMissile_6FC60CA0_113c
    expect(MISSILE_SrvDo_RadialRingSubMissile_6FC60CA0_113c(m, pGame, 0)).toBe(2)
    MISSILE_SetTotalFrames113c(m, pMissile, 10)
    MISSILE_SetRemainingFrames113c(m, pMissile, 10)
    MISSILE_SetTargetX113c(m, pMissile, 0)
    expect(typeof MISSILE_SrvDo_RadialRingSubMissile_6FC60CA0_113c(m, pGame, pMissile)).toBe('number')
    expect(MISSILE_GetTargetX113c(m, pMissile)).toBe(4)
  })

  it('verifies missile SrvDo periodic dispatch, homing, guided retarget, collision pattern, and Mana Shield (0x6FC60E10..0x6FC61FB0)', () => {
    const { m, pGame, pMissilesTxt, pSkillsTxt, pSkillCode } = createW3B4World()
    const { pRoom, pCells } = allocRoomWithCollision(m, 100, 200, 40, 40, 2)
    const { pUnit: pOwner } = allocDynamicUnitWithRoom(m, pGame, 0, 1, 11, pRoom, 110, 210)
    const { pUnit: pEnemy } = allocDynamicUnitWithRoom(m, pGame, 1, 5, 22, pRoom, 118, 218)
    const { pMissile, pPath } = allocMissileUnit(m, pGame, 4, 60, pOwner, pRoom, 5, 3, 112, 212)

    const pMis4 = pMissilesTxt + 4 * 0x1a4
    m.setU16(pMis4 + 0x18, 3)
    m.setU32(pMis4 + 0x38, 2) // Param1 = 2
    m.setU32(pMis4 + 0x3c, 30) // Param2 = 30
    m.setU32(pMis4 + 0x40, 2) // Param3 = 2
    m.setU8(pMis4 + 0x181, 6) // uStart = 6
    m.setU8(pMis4 + 0x182, 10) // uEnd = 10

    // 7. 0x6FC60E10: MISSILE_SrvDo_PeriodicSrvDoFunc_6FC60E10_113c
    expect(MISSILE_SrvDo_PeriodicSrvDoFunc_6FC60E10_113c(m, pGame, 0)).toBe(2)
    MISSILE_SetTotalFrames113c(m, pMissile, 10)
    MISSILE_SetRemainingFrames113c(m, pMissile, 10)
    expect(typeof MISSILE_SrvDo_PeriodicSrvDoFunc_6FC60E10_113c(m, pGame, pMissile)).toBe('number')

    // 8. 0x6FC61110: MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c
    expect(MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c(m, pGame, 0)).toBe(2)
    m.setU32(pPath + 0x44, 0x08)
    expect(typeof MISSILE_SrvDo_TrailOwnerSubMissile_6FC61110_113c(m, pGame, pMissile)).toBe('number')

    // 9. 0x6FC61240: MISSILE_SrvDo_HomingTargetStep_6FC61240_113c
    expect(MISSILE_SrvDo_HomingTargetStep_6FC61240_113c(m, pGame, 0)).toBe(2)
    PATH_SetTargetUnit113c(m, pPath, pEnemy)
    MISSILE_SetRemainingFrames113c(m, pMissile, 10) // 10 % 2 == 0
    expect(typeof MISSILE_SrvDo_HomingTargetStep_6FC61240_113c(m, pGame, pMissile)).toBe('number')

    // 10. 0x6FC61520: MISSILE_SrvDo_TrailInlineCoordSubMissile_6FC61520_113c
    expect(MISSILE_SrvDo_TrailInlineCoordSubMissile_6FC61520_113c(m, pGame, pMissile)).toBeDefined()

    // 11. 0x6FC61710: MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c
    expect(MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c(m, pGame, 0)).toBe(2)
    MISSILE_SetTargetX113c(m, pMissile, 1)
    MISSILE_SetRemainingFrames113c(m, pMissile, 10)
    expect(typeof MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c(m, pGame, pMissile)).toBe('number')

    // 12. 0x6FC61850: MISSILE_SrvDo_TrailVerifiedOwnerSubMissile_6FC61850_113c
    expect(MISSILE_SrvDo_TrailVerifiedOwnerSubMissile_6FC61850_113c(m, pGame, 0)).toBe(2)
    expect(typeof MISSILE_SrvDo_TrailVerifiedOwnerSubMissile_6FC61850_113c(m, pGame, pMissile)).toBe('number')

    // 13. 0x6FC61980: MISSILE_SrvDo_CollisionPatternAndAnimFrame_6FC61980_113c
    m.setU32(pMissile + 0x44, 5 << 8) // nFrame == uStart - 1 (5)
    expect(typeof MISSILE_SrvDo_CollisionPatternAndAnimFrame_6FC61980_113c(m, pGame, pMissile)).toBe('number')
    MISSILE_SetRemainingFrames113c(m, pMissile, 6) // rem == uStart
    m.setU32(pMissile + 0x44, 10 << 8)
    MISSILE_SrvDo_CollisionPatternAndAnimFrame_6FC61980_113c(m, pGame, pMissile)
    expect(m.u32(pMissile + 0x44) >> 8).toBe(3) // uStart - 3

    // 14. 0x6FC61AE0: MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c
    PATH_SetVelocity113c(m, pPath, 0)
    MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c(m, pGame, pMissile)
    const cellIdx = (212 - 200) * 40 + (112 - 100)
    expect(m.u16(pCells + cellIdx * 2) & 0x40).toBe(0x40)

    // 15. 0x6FC61FB0: SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c
    expect(SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c(m, 0, pEnemy, 0, 58, 5)).toBe(0)
    const pSkill58 = pSkillsTxt + 58 * 0x23c
    m.setU16(pSkill58 + 0x80, 30) // wAuraState = 30 (Energy Shield)
    m.setU16(pSkill58 + 0x10c, 15) // overlay
    m.setU32(pSkill58 + 0x138, writeRpnImm32(m, pSkillCode, 0x10, 50)) // 50% absorb
    m.setU32(pSkill58 + 0x13c, writeRpnImm32(m, pSkillCode, 0x20, 16)) // ratio = 16 (1:1 mana per damage)

    const pEsList = STATLIST_AllocList113c(m, 0, 2, 0, 0, 11)
    STATLIST_SetState113c(m, pEsList, 30)
    STATLIST_MergeStatLists113c(m, pOwner, pEsList, 1)
    STATES_ToggleGfxStateFlag113c(m, pOwner, 30, 1)
    STATLIST_SetUnitStat113c(m, pOwner, 8, 200, 0) // 200 mana

    const pDmg = m.alloc(0x70)
    m.setU32(pDmg + 0x08, 100) // 100 phys damage
    expect(SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c(m, pOwner, pEnemy, pDmg, 58, 5)).toBe(1)
    expect(m.u32(pDmg + 0x08)).toBe(50) // 50 absorbed
    expect(STATLIST_GetUnitStat113c(m, pOwner, 8, 0)).toBe(150) // 200 - 50 = 150 mana remaining
  })
  it('verifies range validation, allied/self aura stats, counter-missile, Blaze trail, and Cyclone Armor (0x6FC62360..0x6FC64600)', () => {
    const { m, pGame, pSkillsTxt, pSkillCode, pMissilesTxt } = createW3B4World()
    const { pRoom } = allocRoomWithCollision(m, 100, 200, 40, 40, 2) // level 2 (Blood Moor, not town)
    const { pUnit: pCaster, pPath: pCasterPath } = allocDynamicUnitWithRoom(m, pGame, 0, 1, 101, pRoom, 110, 210)
    const { pUnit: pEnemy } = allocDynamicUnitWithRoom(m, pGame, 1, 5, 202, pRoom, 113, 214) // distSq = 9 + 16 = 25

    // 16. 0x6FC62360: SKILLS_SrvSt_ValidateTargetInCalc1Range_6FC62360_113c
    const pSkill10 = pSkillsTxt + 10 * 0x23c
    m.setU16(pSkill10, 10)
    m.setU32(pSkill10 + 0x60, writeRpnImm32(m, pSkillCode, 0x30, 50)) // aura len = 50
    m.setU32(pSkill10 + 0x64, writeRpnImm32(m, pSkillCode, 0x40, 10)) // range = 10 -> rangeSq = 100
    m.setU16(pSkill10 + 0x54, 31) // wAuraStat1 = 31 (AC)
    m.setU16(pSkill10 + 0x56, 35) // wAuraStat2 = 35
    m.setU32(pSkill10 + 0x68, writeRpnImm32(m, pSkillCode, 0x50, 25)) // auraCalc1 = 25
    m.setU16(pSkill10 + 0x80, 12) // wAuraState = 12
    m.setU16(pSkill10 + 0x84, 1) // wAuraEvent1 = 1
    m.setU16(pSkill10 + 0x86, -1 & 0xffff)
    m.setU16(pSkill10 + 0x8a, 4) // wAuraEventFunc1 = 4
    m.setU16(pSkill10 + 0x48, 3) // wSrvMissile = 3

    PATH_SetTargetUnit113c(m, pCasterPath, pEnemy)
    expect(SKILLS_SrvSt_ValidateTargetInCalc1Range_6FC62360_113c(m, pGame, pCaster, 10, 3)).toBe(1)

    // Out of range check
    m.setU32(pSkill10 + 0x64, writeRpnImm32(m, pSkillCode, 0x60, 2)) // range = 2 -> rangeSq = 4 < 25
    expect(SKILLS_SrvSt_ValidateTargetInCalc1Range_6FC62360_113c(m, pGame, pCaster, 10, 3)).toBe(0)

    // 17. 0x6FC62570: SKILLS_SrvDo_ApplyAlliedTargetAuraStats_6FC62570_113c
    expect(SKILLS_SrvDo_ApplyAlliedTargetAuraStats_6FC62570_113c(m, pGame, pCaster, 10, 3)).toBe(1)
    expect(STATES_CheckState113c(m, pCaster, 12)).not.toBe(0)

    // 18. 0x6FC62730: SKILLS_SrvDo_ApplySelfAuraAndItemEvents_6FC62730_113c
    expect(SKILLS_SrvDo_ApplySelfAuraAndItemEvents_6FC62730_113c(m, pGame, pCaster, 10, 3)).toBe(1)

    // 19. 0x6FC634E0: SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c
    expect(SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c(m, pGame, 1, 0, 0, 0, 10, 3)).toBe(0)
    const { pMissile } = allocMissileUnit(m, pGame, 5, 303, pEnemy, pRoom, 10, 3, 111, 211)
    m.setU8(pMissilesTxt + 5 * 0x1a4 + 0x05, 0x02) // bit 1 at +0x05 set
    expect(
      SKILLS_ItemEvent_CounterMissileOnMissileHit_6FC634E0_113c(m, pGame, 1, pCaster, pMissile, 0, 10, 3),
    ).toBe(1)

    // 20. 0x6FC639A0: SKILLS_SpawnBlazeTrailMissileOnStep_6FC639A0_113c
    const pBlazeList = STATLIST_AllocList113c(m, 0, 2, 0, 0, 101)
    STATLIST_SetState113c(m, pBlazeList, 0x0d)
    STATLIST_SetStat113c(m, pBlazeList, 0x15e, 10, 0)
    STATLIST_SetStat113c(m, pBlazeList, 0x15f, 3, 0)
    STATLIST_MergeStatLists113c(m, pCaster, pBlazeList, 1)
    STATES_ToggleGfxStateFlag113c(m, pCaster, 0x0d, 1)
    m.setU32(pCasterPath + 0x44, 0x08) // PATH_CheckFlag08_113c
    SKILLS_SpawnBlazeTrailMissileOnStep_6FC639A0_113c(m, pCaster, pGame)

    // 21. 0x6FC64600: SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c
    expect(SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c(m, 0, pEnemy, 0, 235, 5)).toBe(0)
    const pSkill235 = pSkillsTxt + 235 * 0x23c
    m.setU16(pSkill235 + 0x80, 35) // Cyclone Armor state
    m.setU16(pSkill235 + 0x54, 100) // cur pool stat
    m.setU16(pSkill235 + 0x56, 101) // max pool stat
    const pCycList = STATLIST_AllocList113c(m, 0, 2, 0, 0, 101)
    STATLIST_SetState113c(m, pCycList, 35)
    STATLIST_SetStat113c(m, pCycList, 100, 120, 0)
    STATLIST_SetStat113c(m, pCycList, 101, 200, 0)
    STATLIST_MergeStatLists113c(m, pCaster, pCycList, 1)
    STATES_ToggleGfxStateFlag113c(m, pCaster, 35, 1)

    const pElemDmg = m.alloc(0x70)
    m.setU32(pElemDmg + 0x10, 40) // fire
    m.setU32(pElemDmg + 0x24, 30) // cold
    m.setU32(pElemDmg + 0x1c, 20) // light -> total 90 absorbed, 30 remaining in pool
    expect(
      SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c(m, pCaster, pEnemy, pElemDmg, 235, 5),
    ).toBe(1)
    expect(m.u32(pElemDmg + 0x10)).toBe(0)
    expect(m.u32(pElemDmg + 0x24)).toBe(0)
    expect(m.u32(pElemDmg + 0x1c)).toBe(0)
    expect(STATLIST_GetStatValue113c(m, pCycList, 100, 0)).toBe(30)
  })

  it('verifies Druid melee/shapeshift/charge-up skills, monster formation spawn, and nearest player sorted list (0x6FC64AC0..0x6FC6A460)', () => {
    const { m, pGame, pDataTables, pSkillsTxt, pSkillCode } = createW3B4World()
    const { pRoom } = allocRoomWithCollision(m, 100, 200, 40, 40, 2)
    const { pUnit: pDruid, pPath: pDruidPath } = allocDynamicUnitWithRoom(m, pGame, 0, 5, 111, pRoom, 110, 210)
    const { pUnit: pTarget } = allocDynamicUnitWithRoom(m, pGame, 1, 10, 222, pRoom, 111, 211)
    PATH_SetTargetUnit113c(m, pDruidPath, pTarget)
    STATLIST_SetUnitStat113c(m, pDruid, 19, 5000, 0) // high AR
    STATLIST_SetUnitStat113c(m, pTarget, 31, 10, 0) // low defense

    const pSkill223 = pSkillsTxt + 223 * 0x23c
    m.setU16(pSkill223, 223)
    m.setU16(pSkill223 + 0x48, 3) // wSrvMissile = 3
    m.setU16(pSkill223 + 0x80, 40) // wAuraState = 40
    m.setU16(pSkill223 + 0x82, 41) // wAuraState2 = 41
    m.setU32(pSkill223 + 0x60, writeRpnImm32(m, pSkillCode, 0x70, 100)) // duration = 100
    m.setU32(pSkill223 + 0x138, writeRpnImm32(m, pSkillCode, 0x80, 50)) // calc1 = 50
    m.setU32(pSkill223 + 0x13c, writeRpnImm32(m, pSkillCode, 0x90, 3)) // calc2 = 3 max charges
    m.setU32(pSkill223 + 0x144, writeRpnImm32(m, pSkillCode, 0xa0, 25)) // calc4 = 25% elem conv
    m.setU8(pSkill223 + 0x1dc, 1) // nEType = 1 (fire)

    // Attach SkillList + UsedSkill to pDruid
    const pSkillList = m.alloc(0x20)
    const pSkill = m.alloc(0x40)
    m.setU32(pSkill, pSkill223)
    m.setU32(pSkill + 0x28, 5) // nSkillLevel = 5
    m.setU32(pSkillList, pSkill)
    m.setU32(pSkillList + 0x10, pSkill)
    m.setU32(pDruid + 0xa8, pSkillList)

    // 22. 0x6FC64AC0: SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c
    const pStateArr = m.alloc(8)
    m.setU16(pStateArr, 40)
    m.setU32(pDataTables + 0x17c, pStateArr)
    m.setU16(pDataTables + 0x180, 1)
    expect(SKILLS_RollAuraStateToHitAndAllocCombat_6FC64AC0_113c(m, pGame, pDruid, 5)).toBe(1)

    // 26. 0x6FC65CE0: SKILLS_SrvDo_DruidShapeShift_6FC65CE0_113c (sets state 40 on pDruid)
    expect(SKILLS_SrvDo_DruidShapeShift_6FC65CE0_113c(m, pGame, pDruid, 223, 5)).toBe(1)
    expect(STATES_CheckState113c(m, pDruid, 40)).not.toBe(0)

    // 23. 0x6FC64C20: SKILLS_SrvSt_DruidChargeUpMelee_6FC64C20_113c
    const resChargeMelee = SKILLS_SrvSt_DruidChargeUpMelee_6FC64C20_113c(m, pGame, pDruid, 223, 5)
    expect(resChargeMelee === 0 || resChargeMelee === 1).toBe(true)

    // 24. 0x6FC64D70: SKILLS_SrvSt_MeleeWithElemConversion_6FC64D70_113c
    expect(SKILLS_SrvSt_MeleeWithElemConversion_6FC64D70_113c(m, pGame, pDruid, 223, 5)).toBe(1)

    // 25. 0x6FC65410: SKILLS_SpawnChargedSrvMissileWithTargetId_6FC65410_113c
    SKILLS_SpawnChargedSrvMissileWithTargetId_6FC65410_113c(m, 223, pDruid, pTarget, pGame, 5, 1)

    // 27. 0x6FC65EE0: SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c
    expect(SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c(m, pGame, pDruid, 75, 223, 5, 2)).toBe(1)
    expect(STATES_CheckState113c(m, pDruid, 41)).not.toBe(0)

    // 28. 0x6FC66000: SKILLS_SrvDo_DruidChargeUpHit_6FC66000_113c
    SKILLS_SetParam1113c(m, pSkill, 1)
    expect(SKILLS_SrvDo_DruidChargeUpHit_6FC66000_113c(m, pGame, pDruid, 223, 5)).toBe(1)
    expect(SKILLS_GetParam1113c(m, pSkill)).toBe(1)

    // 29. 0x6FC671E0: REGPOP_SpawnMonsterFormation_6FC671E0_113c
    const pFormation = m.alloc(0x30)
    m.setU32(pFormation, 0) // 0 entries -> succeeds on first attempt
    const pOutX = m.alloc(4)
    const pOutY = m.alloc(4)
    expect(
      REGPOP_SpawnMonsterFormation_6FC671E0_113c(m, pGame, pRoom, 0, 1, pFormation, pOutX, pOutY),
    ).toBe(1)
    expect(m.u32(pOutX)).toBeGreaterThanOrEqual(100)
    expect(m.u32(pOutY)).toBeGreaterThanOrEqual(200)

    // 30. 0x6FC6A460: SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c
    const pList = m.alloc(4 * 12)
    const pMaxDist = m.alloc(4)
    m.setU32(pGame + 0x3bc, 0)
    const { pUnit: pPlrNear } = allocDynamicUnitWithRoom(m, pGame, 0, 0, 501, pRoom, 102, 202)
    const { pUnit: pPlrFar } = allocDynamicUnitWithRoom(m, pGame, 0, 0, 502, pRoom, 120, 220)
    const { pUnit: pPlrClosest } = allocDynamicUnitWithRoom(m, pGame, 0, 0, 503, pRoom, 100, 201)

    SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c(m, 100, pList, pPlrFar, 200, pMaxDist, pGame, 2)
    SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c(m, 100, pList, pPlrNear, 200, pMaxDist, pGame, 2)
    SUNIT_InsertNearestPlayerIntoSortedList_6FC6A460_113c(m, 100, pList, pPlrClosest, 200, pMaxDist, pGame, 2)
    expect(m.u32(pGame + 0x3bc)).toBe(2)
    expect(m.u32(pList)).toBe(pPlrClosest) // head is closest player (dist = 1)
  })
  it('verifies CLIENTS_AllocAndLinkClient, portrait desc string, aura callback, and Amazon melee/lightning skills (0x6FC6A9B0..0x6FC6D040)', () => {
    const { m, pGame, pSkillsTxt, pSkillCode } = createW3B4World()
    const { pRoom } = allocRoomWithCollision(m, 100, 200, 40, 40, 2)
    const { pUnit: pAma, pPath: pAmaPath } = allocDynamicUnitWithRoom(m, pGame, 0, 0, 601, pRoom, 110, 210)
    const { pUnit: pMon1 } = allocDynamicUnitWithRoom(m, pGame, 1, 10, 701, pRoom, 111, 211)
    const { pUnit: pMon2 } = allocDynamicUnitWithRoom(m, pGame, 1, 10, 702, pRoom, 113, 213)
    PATH_SetTargetUnit113c(m, pAmaPath, pMon1)
    STATLIST_SetUnitStat113c(m, pAma, 19, 5000, 0)
    STATLIST_SetUnitStat113c(m, pAma, 0x0c, 42, 0) // level 42

    // 31. 0x6FC6A9B0: CLIENTS_AllocAndLinkClient_6FC6A9B0_113c
    const szChar = m.alloc(16)
    const szAcc = m.alloc(16)
    m.setU8(szChar, 0x48) // 'H'
    m.setU8(szChar + 1, 0x65) // 'e'
    m.setU8(szChar + 2, 0x72) // 'r'
    m.setU8(szChar + 3, 0x6f) // 'o'
    m.setU8(szAcc, 0x41) // 'A'
    m.setU8(szAcc + 1, 0x63) // 'c'
    m.setU32(0x6fd31c18, 0)
    expect(CLIENTS_AllocAndLinkClient_6FC6A9B0_113c(m, 77, pGame, 0, szChar, szAcc, 4, 1)).toBe(0)
    m.setU32(0x6fd31c18, 1)
    const pClient = CLIENTS_AllocAndLinkClient_6FC6A9B0_113c(m, 77, pGame, 0, szChar, szAcc, 4, 1)
    expect(pClient).not.toBe(0)
    expect(m.u32(pClient)).toBe(77)
    expect(m.u32(pGame + 0x88)).toBe(pClient)
    expect(m.u32(pGame + 0x8c)).toBe(1)

    // 32. 0x6FC6AE90: CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c
    const pDescBuf = m.alloc(0x40)
    expect(() => CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c(m, pDescBuf, 0)).toThrow(
      D2CommonAssertError,
    )
    m.setU8(pClient + 0x3d4, 1)
    m.setU32(pClient + 0x174, pAma)
    const pInv = INVENTORY_AllocInventory113c(m, 0, pAma)
    m.setU32(pAma + 0x60, pInv)
    CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c(m, pDescBuf, pClient)
    expect(m.u8(pDescBuf)).toBe((0x0d & 0xff) | 0x80)

    // 33. 0x6FC6C220: SKILLS_AuraCallback_ApplyAuraStatListFromCtx_6FC6C220_113c
    const pAuraCtx = m.alloc(0x20)
    const pSubCtx = m.alloc(0x20)
    m.setU32(pAuraCtx + 0x04, pAma)
    m.setU32(pAuraCtx + 0x0c, pSubCtx)
    m.setU32(pSubCtx + 0x00, 34) // skillId
    m.setU32(pSubCtx + 0x04, 3) // skillLevel
    m.setU32(pSubCtx + 0x08, 50) // duration
    m.setU32(pSubCtx + 0x0c, 45) // stateId
    m.setU32(pSubCtx + 0x10, 0xffffffff)
    expect(SKILLS_AuraCallback_ApplyAuraStatListFromCtx_6FC6C220_113c(m, pAuraCtx, pAma)).toBe(1)

    // Attach UsedSkill to pAma for 34, 35, 36
    const pSkill34 = pSkillsTxt + 34 * 0x23c
    m.setU16(pSkill34, 34)
    m.setU16(pSkill34 + 0x48, 3) // wSrvMissile = 3
    m.setU32(pSkill34 + 0x138, writeRpnImm32(m, pSkillCode, 0xb0, 3)) // calc1 = 3 bolts / radius 3
    m.setU32(pSkill34 + 0x13c, writeRpnImm32(m, pSkillCode, 0xc0, 4)) // calc2 = 4 chain hits
    m.setU32(pSkill34 + 0x144, writeRpnImm32(m, pSkillCode, 0xd0, 20)) // calc4 = 20%
    m.setU8(pSkill34 + 0x1dc, 2) // lightning
    const pSkillList = m.alloc(0x20)
    const pSkillNode = m.alloc(0x40)
    m.setU32(pSkillNode, pSkill34)
    m.setU32(pSkillNode + 0x28, 4)
    m.setU32(pSkillList, pSkillNode)
    m.setU32(pSkillList + 0x10, pSkillNode)
    m.setU32(pAma + 0xa8, pSkillList)

    // 34. 0x6FC6C3A0: SKILLS_SrvSt_MeleeWithSkillElemDamage_6FC6C3A0_113c
    expect(SKILLS_SrvSt_MeleeWithSkillElemDamage_6FC6C3A0_113c(m, pGame, pAma, 34, 4)).toBe(1)

    // 35. 0x6FC6CE10: SKILLS_SrvDo_LightningStrikeBounce_6FC6CE10_113c
    void pMon2
    const bounceRes = SKILLS_SrvDo_LightningStrikeBounce_6FC6CE10_113c(m, pGame, pAma, 34, 4)
    expect(bounceRes === 0 || bounceRes === 1).toBe(true)

    // 36. 0x6FC6D040: SKILLS_SrvDo_ChargedStrikeBolts_6FC6D040_113c
    expect(SKILLS_SrvDo_ChargedStrikeBolts_6FC6D040_113c(m, pGame, pAma, 34, 4)).toBe(1)
  })

  it('verifies Necromancer Bone Armor, Blood Golem, Life Tap, skeletons, slow target, Iron Maiden, and Corpse Explosion (0x6FC6DFE0..0x6FC6F4D0)', () => {
    const { m, pGame, pDataTables, pSkillsTxt, pSkillCode, pMonStatsTxt, pMonStats2Txt, pMonLvlTxt } =
      createW3B4World()
    const { pRoom } = allocRoomWithCollision(m, 100, 200, 40, 40, 2)
    const { pUnit: pNecro, pPath: pNecroPath, pUnitData: pNecroData } = allocDynamicUnitWithRoom(
      m,
      pGame,
      0,
      2,
      801,
      pRoom,
      110,
      210,
    )
    const { pUnit: pGolem, pUnitData: pGolemData } = allocDynamicUnitWithRoom(
      m,
      pGame,
      1,
      0x122,
      802,
      pRoom,
      111,
      211,
    )
    const { pUnit: pEnemy } = allocDynamicUnitWithRoom(m, pGame, 1, 10, 803, pRoom, 112, 212)

    STATLIST_SetUnitStat113c(m, pNecro, 6, 500 << 8, 0) // cur life
    STATLIST_SetUnitStat113c(m, pNecro, 7, 1000 << 8, 0) // max life
    STATLIST_SetUnitStat113c(m, pGolem, 6, 300 << 8, 0)
    STATLIST_SetUnitStat113c(m, pGolem, 7, 600 << 8, 0)
    STATLIST_SetUnitStat113c(m, pEnemy, 6, 400 << 8, 0)
    STATLIST_SetUnitStat113c(m, pEnemy, 7, 800 << 8, 0)

    // Link pGolem's AiGeneral pack leader to pNecro
    const pAiGeneral = m.alloc(0x50)
    m.setU32(pAiGeneral + 0x0c, pNecro)
    m.setU32(pAiGeneral + 0x28, pGame)
    m.setU32(pAiGeneral + 0x2c, 801)
    m.setU32(pAiGeneral + 0x30, 0)
    m.setU32(pGolemData + 0x28, pAiGeneral)

    // 37. 0x6FC6DFE0: SKILLS_AbsorbPhysicalDamageByBoneArmor_6FC6DFE0_113c
    const pSkill68 = pSkillsTxt + 68 * 0x23c
    m.setU16(pSkill68 + 0x80, 14) // Bone Armor state
    m.setU16(pSkill68 + 0x54, 100) // cur armor stat
    m.setU16(pSkill68 + 0x56, 101) // max armor stat
    const pBoneList = STATLIST_AllocList113c(m, 0, 2, 0, 0, 801)
    STATLIST_SetState113c(m, pBoneList, 14)
    STATLIST_SetStat113c(m, pBoneList, 100, 150, 0)
    STATLIST_SetStat113c(m, pBoneList, 101, 200, 0)
    STATLIST_MergeStatLists113c(m, pNecro, pBoneList, 1)
    STATES_ToggleGfxStateFlag113c(m, pNecro, 14, 1)

    const pPhysDmg = m.alloc(0x70)
    m.setU32(pPhysDmg + 0x08, 60)
    expect(SKILLS_AbsorbPhysicalDamageByBoneArmor_6FC6DFE0_113c(m, pNecro, pEnemy, pPhysDmg, 68, 5)).toBe(1)
    expect(m.u32(pPhysDmg + 0x08)).toBe(0)
    expect(STATLIST_GetStatValue113c(m, pBoneList, 100, 0)).toBe(90)

    // 38. 0x6FC6E500: SKILLS_TransferGolemDamageToOwnerLife_6FC6E500_113c
    const pMon0x122 = pMonStatsTxt + 0x122 * 0x1a8
    m.setU16(pMon0x122 + 0x170, 75) // Blood Golem skillId = 75
    m.setU8(pMon0x122 + 0xa0, 100) // drain eff = 100%
    const pMon10 = pMonStatsTxt + 10 * 0x1a8
    m.setU8(pMon10 + 0xa0, 100) // drain eff = 100%
    m.setU16(pMon10 + 0x06, 10) // wMonStatsEx = 10
    m.setU8(pMonStats2Txt + 10 * 0x134 + 0x04, 0x80) // selectable corpse bit (bit 7 of dwFlags)
    m.setU8(pMonStats2Txt + 10 * 0x134 + 0x05, 0x02) // curseable / state-targetable bit

    const pSkill75 = pSkillsTxt + 75 * 0x23c
    m.setU32(pSkill75 + 0x148, 30) // Param1 = 30
    m.setU32(pSkill75 + 0x14c, 100) // Param2 = 100
    m.setU32(pSkill75 + 0x150, 50) // Param3 = 50% owner share
    m.setU32(pSkill75 + 0x158, 25) // Param5 = 25% transfer
    m.setU32(pSkill75 + 0x15c, 30) // Param6 = 30% player heal share

    const pGolemHitDmg = m.alloc(0x70)
    m.setU32(pGolemHitDmg + 0x4c, 400)
    expect(
      SKILLS_TransferGolemDamageToOwnerLife_6FC6E500_113c(m, pGolem, pEnemy, pGolemHitDmg, 75, 5),
    ).toBe(1)
    expect(m.u32(pGolemHitDmg + 0x4c)).toBe(300) // 25% (100) transferred to owner

    // 39. 0x6FC6E5F0: SKILLS_BloodGolemShareLifeSteal_6FC6E5F0_113c
    m.setU32(pGolemHitDmg + 0x08, 1000)
    expect(
      SKILLS_BloodGolemShareLifeSteal_6FC6E5F0_113c(m, pGame, 1, pGolem, pEnemy, pGolemHitDmg, 75, 5),
    ).toBe(1)

    // 40. 0x6FC6E760: SKILLS_LifeTapHealAttackerOnHit_6FC6E760_113c
    const pSkill82 = pSkillsTxt + 82 * 0x23c
    m.setU16(pSkill82 + 0x82, 50) // wAuraState2 = 50 (Life Tap / Iron Maiden)
    m.setU16(pSkill82 + 0x10c, 20) // overlay
    m.setU32(pSkill82 + 0x138, writeRpnImm32(m, pSkillCode, 0xe0, 50)) // 50% heal / reflect
    m.setU32(pSkill82 + 0x13c, writeRpnImm32(m, pSkillCode, 0xf0, 50))
    m.setU32(pSkill82 + 0x140, writeRpnImm32(m, pSkillCode, 0x100, 50))
    const pCurseList = STATLIST_AllocList113c(m, 0, 2, 0, 0, 801)
    STATLIST_SetState113c(m, pCurseList, 50)
    STATLIST_MergeStatLists113c(m, pEnemy, pCurseList, 1)
    STATES_ToggleGfxStateFlag113c(m, pEnemy, 50, 1)

    expect(
      SKILLS_LifeTapHealAttackerOnHit_6FC6E760_113c(m, pGame, 1, pEnemy, pNecro, pGolemHitDmg, 82, 5),
    ).toBe(1)

    // 41. 0x6FC6EA30: SKILLS_HealBloodGolemFromPlayerHeal_6FC6EA30_113c
    m.setU32(pDataTables + 0xbf0, 8) // pet table count > 3
    const pPetHolder = m.alloc(8)
    const pPetBuckets = m.alloc(0x40)
    const pPetNode = m.alloc(0x20)
    m.setU8(pPetNode, 0)
    m.setU32(pPetNode + 0x04, 802) // pGolem guid
    m.setU32(pPetBuckets + 0x24, pPetNode)
    m.setU32(pPetHolder, pPetBuckets)
    m.setU32(pNecroData + 0x44, pPetHolder)
    const remHeal = SKILLS_HealBloodGolemFromPlayerHeal_6FC6EA30_113c(m, pNecro, 200, pGame)
    expect(remHeal).toBe(140) // 30% (60) shared with Blood Golem -> 140 remaining

    // 42. 0x6FC6EB50: SKILLS_InitNecroSkeletonPetComponents_6FC6EB50_113c
    const { pUnit: pSkelWarrior } = allocDynamicUnitWithRoom(m, pGame, 1, 0x16b, 804, pRoom, 113, 213)
    const { pUnit: pSkelMage } = allocDynamicUnitWithRoom(m, pGame, 1, 0x16c, 805, pRoom, 114, 214)
    SKILLS_InitNecroSkeletonPetComponents_6FC6EB50_113c(m, pSkelWarrior, pNecro, 70, 5)
    SKILLS_InitNecroSkeletonPetComponents_6FC6EB50_113c(m, pSkelMage, pNecro, 80, 5)

    // 43. 0x6FC6EF70: SKILLS_ApplySlowTargetOnHit_6FC6EF70_113c
    STATLIST_SetUnitStat113c(m, pNecro, 0x96, 35, 0) // 35% slow target
    expect(SKILLS_ApplySlowTargetOnHit_6FC6EF70_113c(m, pNecro, pEnemy, pGolemHitDmg, 0, 1)).toBe(1)
    expect(STATES_CheckState113c(m, pEnemy, 0x18)).not.toBe(0)

    // 44. 0x6FC6F090: SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c
    expect(
      SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c(m, pGame, 1, pEnemy, pGolem, pGolemHitDmg, 82, 5),
    ).toBe(1)

    // 45. 0x6FC6F4D0: SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c
    const { pUnit: pCorpse } = allocDynamicUnitWithRoom(m, pGame, 1, 10, 806, pRoom, 115, 215)
    m.setU32(pCorpse + 0x10, 0x0c) // dead mode 12 (selectable corpse)
    STATLIST_SetUnitStat113c(m, pCorpse, 0x0c, 5, 0) // monster level 5
    m.setU16(pMon10 + 0x10e, 50) // minHP
    m.setU16(pMon10 + 0x114, 100) // maxHP
    m.setU32(pMonLvlTxt + 5 * 0x78 + 0x18, 100) // MonLvl HP scale

    const pSkill74 = pSkillsTxt + 74 * 0x23c
    m.setU16(pSkill74, 74)
    m.setU32(pSkill74 + 0x64, writeRpnImm32(m, pSkillCode, 0x110, 8)) // radius = 8
    m.setU32(pSkill74 + 0x138, writeRpnImm32(m, pSkillCode, 0x120, 60)) // minPct = 60
    m.setU32(pSkill74 + 0x13c, writeRpnImm32(m, pSkillCode, 0x130, 100)) // maxPct = 100
    m.setU32(pSkill74 + 0x140, writeRpnImm32(m, pSkillCode, 0x140, 50)) // elemPct = 50% fire
    m.setU8(pSkill74 + 0x1dc, 1) // fire

    PATH_SetTargetUnit113c(m, pNecroPath, pCorpse)
    expect(SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c(m, pGame, pNecro, 74, 5)).toBe(1)
    expect(STATES_CheckState113c(m, pCorpse, 0x68)).not.toBe(0) // corpse consumed state set
  })
})
