import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  DATATABLES_OFF_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetState113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import * as w2b5Exports from '../../../src/d2kern-113c/game/k2-w2b5-113c.ts'
import {
  ARENA_AllocGameArenaCtrl_6FCD2560_113c,
  ARENA_AllocPlayerArenaUnit_6FCD24D0_113c,
  ARENA_CheckFlagBit8_6FCD2620_113c,
  ARENA_FreePlayerArenaUnit_6FCD2480_113c,
  ARENA_GetModeByte_6FCD22D0_113c,
  MONAI_AreUnitsInSameActWithin1020Subtiles_6FCC3E10_113c,
  MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c,
  MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c,
  MONAI_CalcScaledAiTickDelay_6FCC3AE0_113c,
  MONAI_ClearAiControlParam0_6FCC3980_113c,
  MONAI_CountSameClassAliveMonstersInRangeCallback_6FCD0DB0_113c,
  MONAI_EnableState172OnTarget_6FCCC910_113c,
  MONAI_FindClosestClosedDoorCallback_6FCD0DF0_113c,
  MONAI_GetUnitMeleeVelocity_6FCD08A0_113c,
  MONAI_InitAiControlAip3AndRandomParity_6FCC3C30_113c,
  MONAI_InitAiControlDefaultParams_6FCC3990_113c,
  MONAI_InitAiControlFrameAndMinusOne_6FCC39B0_113c,
  MONAI_InventoryContainsItemPointer_6FCCC9E0_113c,
  MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c,
  MONAI_IsUnitValidHostileCombatTarget_6FCD13B0_113c,
  MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c,
  MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c,
  MONAI_MatchSpawnMode0MonsterWithinRadiusCallback_6FCD0E30_113c,
  MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c,
  MONAI_NoOpRet4_6FCC3880_113c,
  MONAI_NoOpRet4_6FCC3920_113c,
  MONAI_NoOpRet4_6FCC3930_113c,
  MONAI_NoOpRet4_6FCC39D0_113c,
  MONAI_RecordPathTargetInteractByUnitType_6FCC5AC0_113c,
  MONAI_SetAiGeneralTargetGuidAndType_6FCD0BA0_113c,
  MONAI_Stall200IfUnitHasRoom_6FCC5D40_113c,
  MONAI_TrackPackCorpseInRangeCallback_6FCD12B0_113c,
  MONAI_TransferItemCellStatFromItemToUnit_6FCCCA20_113c,
  SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c,
  SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c,
  SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c,
  SKILLS_CheckPlayerClassMatchesSkillCharClass_6FCBEB30_113c,
  SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c,
  SKILLS_ExecuteMeleeEventsOnPathTarget_6FCC20C0_113c,
  SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c,
  SKILLS_ResolveSummonMonsterId_6FCBEE50_113c,
  SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c,
  SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c,
  SKILLS_SetElemDurationInDamageData_6FCBE9B0_113c,
  SKILLS_TargetRingScanCallback_6FCBED70_113c,
} from '../../../src/d2kern-113c/game/k2-w2b5-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

interface TestWorld {
  readonly m: SparseMemory113c
  readonly pDataTables: number
  readonly pMonStatsTxt: number
  readonly pSkillsTxt: number
  readonly pStatesTxt: number
}

function createTestWorld(): TestWorld {
  const m = new SparseMemory113c()
  const pDataTables = m.alloc(0x1000) >>> 0
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))

  const monStatsCount = 300
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8) >>> 0
  m.setU32((pDataTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pDataTables + 0xa80) >>> 0, monStatsCount)

  const pMonStats2Txt = m.alloc(monStatsCount * 0x134) >>> 0
  m.setU32((pDataTables + 0xa90) >>> 0, pMonStats2Txt)
  m.setU32((pDataTables + 0xa98) >>> 0, monStatsCount)
  for (let i = 0; i < monStatsCount; i++) {
    m.setU16((pMonStatsTxt + i * 0x1a8 + 0x02) >>> 0, i)
    m.setU8((pMonStats2Txt + i * 0x134 + 0x08) >>> 0, 1)
  }

  const skillsCount = 300
  const pSkillsTxt = m.alloc(skillsCount * 0x23c) >>> 0
  m.setU32((pDataTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pDataTables + 0xba0) >>> 0, skillsCount)

  const itemStatCostCount = 360
  const pItemStatCost = m.alloc(itemStatCostCount * 0x144) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0, pItemStatCost)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0, itemStatCostCount)

  const statesCount = 200
  const pStatesTxt = m.alloc(statesCount * 0x40) >>> 0
  m.setU32((pDataTables + DATATABLES_OFF_113C.pStatesTxt) >>> 0, pStatesTxt)
  m.setU32((pDataTables + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0, statesCount)

  const pStateMask33 = m.alloc(32) >>> 0
  m.setU32((pDataTables + 0x150) >>> 0, pStateMask33)

  return { m, pDataTables, pMonStatsTxt, pSkillsTxt, pStatesTxt }
}

describe('[K2] Wave 2 Batch 5 (w2b5) — 45 D2Game.dll functions (0x6FCBE4F0..0x6FCD2620)', () => {
  it('exports all 45 @va-tagged functions with _6FCXXXXX_113c names', () => {
    const fnNames = Object.keys(w2b5Exports).filter((k) => k.endsWith('_113c'))
    expect(fnNames.length).toBe(45)
  })

  it('[1..7] SKILLS throwing mastery, find-count callback, velocity statlist, channel period, elem duration, charclass check, and mana/Blood Mana cost', () => {
    const { m, pSkillsTxt } = createTestWorld()

    // [1/45] 0x6FCBE4F0: early return on null unit/missile/weapon and stat update on missile
    const pPlayer = m.alloc(0x100) >>> 0
    const pMissile = m.alloc(0x100) >>> 0
    const pWeapon = m.alloc(0x100) >>> 0
    m.setU32(pPlayer, 0)
    m.setU32(pMissile, 3)
    m.setU32(pWeapon, 4)
    STATLIST_CreateEx113c(m, pPlayer)
    STATLIST_CreateEx113c(m, pMissile)
    STATLIST_CreateEx113c(m, pWeapon)
    STATLIST_SetUnitStat113c(m, pMissile, 0x13, 25, 0)
    STATLIST_SetUnitStat113c(m, pMissile, 0x19, 10, 0)
    SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c(m, 0, pMissile, pWeapon)
    expect(STATLIST_GetUnitStat113c(m, pMissile, 0x13, 0)).toBe(25)
    SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c(m, pPlayer, pMissile, pWeapon)
    expect(STATLIST_GetUnitStat113c(m, pMissile, 0x13, 0)).toBe(25)
    expect(STATLIST_GetUnitStat113c(m, pMissile, 0x19, 0)).toBe(10)

    // [2/45] 0x6FCBE600: increments counter at [pFindData + 0x0C]
    const pFindData = m.alloc(0x20) >>> 0
    const pCounter = m.alloc(4) >>> 0
    m.setU32(pCounter, 7)
    m.setU32((pFindData + 0x0c) >>> 0, pCounter)
    expect(SKILLS_IncrementUnitFindCountCallback_6FCBE600_113c(m, pFindData)).toBe(1)
    expect(m.u32(pCounter)).toBe(8)

    // [3/45] 0x6FCBE7B0: allocates statlist (flags=4), merges onto unit, sets STAT_VELOCITYPERCENT (0x44)
    const pVelUnit = m.alloc(0x100) >>> 0
    m.setU32(pVelUnit, 4)
    m.setU32((pVelUnit + 0x0c) >>> 0, 0x42)
    STATLIST_CreateEx113c(m, pVelUnit)
    SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c(m, pVelUnit, 35)
    expect(STATLIST_GetUnitStat113c(m, pVelUnit, 0x44, 0)).toBe(35)

    // [4/45] 0x6FCBE970: channel period calc (clamped to >= 5)
    const pGame = m.alloc(0x200) >>> 0
    m.setU32((pGame + 0xa8) >>> 0, 12) // dwGameFrame = 12
    const pSkillRec4 = (pSkillsTxt + 10 * 0x23c) >>> 0
    m.setU32((pSkillRec4 + 0x128) >>> 0, 0xffffffff) // calc -> 0 -> clamped to 5
    // ((12 + 5 - 1) / 5) * 5 + 1 = 3 * 5 + 1 = 16
    expect(SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c(m, 1, 10, pSkillRec4, pGame, pPlayer)).toBe(16)

    // [5/45] 0x6FCBE9B0: switch on bEType (+0x1DC) for 4, 5, 9, 11, 12
    const pDmg = m.alloc(0x70) >>> 0
    const cases: ReadonlyArray<readonly [number, number]> = [
      [4, 0x30],
      [5, 0x2c],
      [9, 0x44],
      [11, 0x18],
      [12, 0x34],
    ]
    for (const [bEType, off] of cases) {
      m.setU8((pSkillRec4 + 0x1dc) >>> 0, bEType)
      SKILLS_SetElemDurationInDamageData_6FCBE9B0_113c(m, 10, 50 + bEType, pDmg)
      expect(m.u32((pDmg + off) >>> 0)).toBe(50 + bEType)
    }

    // [6/45] 0x6FCBEB30: player class vs pSkillsTxt->nCharClass (+0x0C)
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x04) >>> 0, 2) // Necromancer
    m.setU8((pSkillRec4 + 0x0c) >>> 0, 2)
    expect(SKILLS_CheckPlayerClassMatchesSkillCharClass_6FCBEB30_113c(m, 10, pPlayer)).toBe(1)
    m.setU8((pSkillRec4 + 0x0c) >>> 0, 3)
    expect(SKILLS_CheckPlayerClassMatchesSkillCharClass_6FCBEB30_113c(m, 10, pPlayer)).toBe(0)

    // [7/45] 0x6FCBED20: mana check and subtraction
    STATLIST_SetUnitStat113c(m, pPlayer, 8, 500, 0)
    expect(SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c(m, pPlayer, 600)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 8, 0)).toBe(500)
    expect(SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c(m, pPlayer, 200)).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pPlayer, 8, 0)).toBe(300)
  })

  it('[8..12] SKILLS ring target scan, summon monster ID, phys damage roll, attack hit flags, and path target melee events', () => {
    const { m, pSkillsTxt, pMonStatsTxt } = createTestWorld()

    // [8/45] 0x6FCBED70: target ring scan callback
    const pFindData = m.alloc(0x20) >>> 0
    const pCtx = m.alloc(0x20) >>> 0
    m.setU32((pFindData + 0x0c) >>> 0, pCtx)
    m.setU32((pCtx + 0x04) >>> 0, 0xffffffff) // dwBestAfterGuid
    m.setU32((pCtx + 0x0c) >>> 0, 0xffffffff) // dwMinGuid
    m.setU32((pCtx + 0x10) >>> 0, 10) // dwPrevGuid

    const pUnitGuid5 = m.alloc(0x20) >>> 0
    m.setU32((pUnitGuid5 + 0x0c) >>> 0, 5)
    const pUnitGuid15 = m.alloc(0x20) >>> 0
    m.setU32((pUnitGuid15 + 0x0c) >>> 0, 15)

    expect(SKILLS_TargetRingScanCallback_6FCBED70_113c(m, pFindData, pUnitGuid5)).toBe(1)
    expect(m.u32((pCtx + 0x08) >>> 0)).toBe(pUnitGuid5)
    expect(m.u32((pCtx + 0x0c) >>> 0)).toBe(5)
    expect(SKILLS_TargetRingScanCallback_6FCBED70_113c(m, pFindData, pUnitGuid15)).toBe(1)
    expect(m.u32(pCtx)).toBe(pUnitGuid15)
    expect(m.u32((pCtx + 0x04) >>> 0)).toBe(15)
    expect(m.u32((pCtx + 0x14) >>> 0)).toBe(2)

    // [9/45] 0x6FCBEE50: fallback to pMonsterData->pMonStatsTxt->wMinion1 (+0x3C)
    const pMonster = m.alloc(0x100) >>> 0
    const pMonData = m.alloc(0x60) >>> 0
    const pMonRec = (pMonStatsTxt + 5 * 0x1a8) >>> 0
    m.setU32(pMonster, 1)
    m.setU32((pMonster + 0x14) >>> 0, pMonData)
    m.setU32((pMonData + 0x28) >>> 0, pMonRec)
    m.setU32((pMonRec + 0x3c) >>> 0, 42)
    const pOutMode = m.alloc(4) >>> 0
    const pOutX = m.alloc(4) >>> 0
    const pOutY = m.alloc(4) >>> 0
    expect(
      SKILLS_ResolveSummonMonsterId_6FCBEE50_113c(m, pOutY, pOutX, pOutMode, pMonster, 0, -1, 0),
    ).toBe(42)

    // [10/45] 0x6FCBF1A0: rolls physical skill damage and adds to pDmg + 0x08
    const pRec12 = (pSkillsTxt + 12 * 0x23c) >>> 0
    m.setU8((pRec12 + 0x1a4) >>> 0, 8) // HitShift = 8
    m.setU32((pRec12 + 0x1a8) >>> 0, 10) // MinDam = 10
    m.setU32((pRec12 + 0x1ac) >>> 0, 20) // MaxDam = 20
    m.setU32((pRec12 + 0x1d8) >>> 0, 0xffffffff) // dwDmgSymPerCalc = -1
    m.setU32((pMonster + 0x20) >>> 0, 0x12345678)
    m.setU32((pMonster + 0x24) >>> 0, 0x9abcdef0)
    const pDmg = m.alloc(0x70) >>> 0
    m.setU32((pDmg + 0x08) >>> 0, 100)
    SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c(m, pMonster, 12, pDmg, 1)
    const rolledPhys = m.u32((pDmg + 0x08) >>> 0)
    expect(rolledPhys).toBeGreaterThanOrEqual(100 + (10 << 8))
    expect(rolledPhys).toBeLessThan(100 + (20 << 8))

    // [11/45] 0x6FCC11B0: auto-hit when wResultFlags & 1, else rolls via 0x6FCFE5A0
    m.setU16((pRec12 + 0x12e) >>> 0, 0x0021)
    expect(
      SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c(m, pRec12, pDmg, 1, 12, 0, pMonster, pMonster, 0),
    ).toBe(0x0021)
    expect(m.u16((pDmg + 0x04) >>> 0)).toBe(0x0021)

    m.setU16((pRec12 + 0x12e) >>> 0, 0x0020)
    expect(
      SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c(
        m,
        pRec12,
        pDmg,
        1,
        12,
        0,
        pMonster,
        pMonster,
        0,
        { onRollMeleeToHitFlags: () => 0x0005 },
      ),
    ).toBe(0x0025)
    expect(m.u16((pDmg + 0x04) >>> 0)).toBe(0x0025)

    // [12/45] 0x6FCC20C0: sets flag 0x40 and returns 0 when path has no target
    const pGame12 = m.alloc(0x200) >>> 0
    const pMonPath12 = m.alloc(0x200) >>> 0
    m.setU32((pMonster + 0x2c) >>> 0, pMonPath12)
    m.setU32((pMonster + 0xc4) >>> 0, 0)
    expect(SKILLS_ExecuteMeleeEventsOnPathTarget_6FCC20C0_113c(m, pGame12, pMonster)).toBe(0)
    expect(m.u32((pMonster + 0xc4) >>> 0) & 0x40).toBe(0x40)
  })

  it('[13..25] MONAI stubs, room level compare, AiControl mutators, object 0x233 filter, tick delay, aip3 init, skill radius, and same-act 1020-subtile check', () => {
    const { m, pMonStatsTxt } = createTestWorld()

    // [13, 15, 16, 20] No-op stubs
    MONAI_NoOpRet4_6FCC3880_113c(m)
    MONAI_NoOpRet4_6FCC3920_113c(m)
    MONAI_NoOpRet4_6FCC3930_113c(m)
    MONAI_NoOpRet4_6FCC39D0_113c(m)

    // [14/45] 0x6FCC38C0: asserts on null and compares room level IDs
    expect(() => MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c(m, 0, 1)).toThrow(D2CommonAssertError)
    expect(() => MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c(m, 1, 0)).toThrow(D2CommonAssertError)

    // [17..19] 0x6FCC3980, 0x6FCC3990, 0x6FCC39B0: AiControl parameter initialization
    const pGame = m.alloc(0x200) >>> 0
    m.setU32((pGame + 0xa8) >>> 0, 777)
    m.setU8((pGame + 0x6d) >>> 0, 1) // Nightmare difficulty
    const pAiControl = m.alloc(0x40) >>> 0
    const pAiArgs = m.alloc(0x30) >>> 0
    m.setU32(pAiArgs, pAiControl)

    MONAI_InitAiControlDefaultParams_6FCC3990_113c(m, pAiArgs)
    expect(m.u32((pAiControl + 0x14) >>> 0)).toBe(0xffffffff)
    expect(m.u32((pAiControl + 0x18) >>> 0)).toBe(1)
    expect(m.u32((pAiControl + 0x1c) >>> 0)).toBe(0)

    MONAI_ClearAiControlParam0_6FCC3980_113c(m, pAiArgs)
    expect(m.u32((pAiControl + 0x14) >>> 0)).toBe(0)

    MONAI_InitAiControlFrameAndMinusOne_6FCC39B0_113c(m, pGame, pAiArgs)
    expect(m.u32((pAiControl + 0x14) >>> 0)).toBe(777)
    expect(m.u32((pAiControl + 0x18) >>> 0)).toBe(0xffffffff)

    // [21/45] 0x6FCC39E0: matches object 0x233 within distance
    const pSelf = m.alloc(0x100) >>> 0
    const pSelfPath = m.alloc(0x200) >>> 0
    m.setU32(pSelf, 1)
    m.setU32((pSelf + 0x04) >>> 0, 1)
    m.setU32((pSelf + 0x2c) >>> 0, pSelfPath)
    m.setU16((pSelfPath + 0x02) >>> 0, 100)
    m.setU16((pSelfPath + 0x06) >>> 0, 100)

    const pObj233 = m.alloc(0x100) >>> 0
    const pObjPath = m.alloc(0x40) >>> 0
    const pObjData = m.alloc(0x40) >>> 0
    const pObjTxt = m.alloc(0x120) >>> 0
    m.setU32(pObjData, pObjTxt)
    m.setU32((pObjTxt + 0xd0) >>> 0, 2) // nSizeX = 2
    m.setU32(pObj233, 2)
    m.setU32((pObj233 + 0x04) >>> 0, 0x233)
    m.setU32((pObj233 + 0x14) >>> 0, pObjData)
    m.setU32((pObj233 + 0x2c) >>> 0, pObjPath)
    m.setU32((pObjPath + 0x0c) >>> 0, 104)
    m.setU32((pObjPath + 0x10) >>> 0, 103)

    const pScanCtx = m.alloc(0x10) >>> 0
    m.setU32((pScanCtx + 0x04) >>> 0, 10)
    expect(
      MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c(m, pGame, pSelf, pObj233, pScanCtx),
    ).toBe(pObj233)
    m.setU32((pScanCtx + 0x04) >>> 0, 2)
    expect(
      MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c(m, pGame, pSelf, pObj233, pScanCtx),
    ).toBe(0)

    // [22/45] 0x6FCC3AE0: Math.trunc(param2 / 3) + Math.trunc(skillLvl / 2)
    m.setU32((pAiControl + 0x1c) >>> 0, 9)
    expect(MONAI_CalcScaledAiTickDelay_6FCC3AE0_113c(m, 0, 0, pAiArgs)).toBe(3)

    // [23/45] 0x6FCC3C30: sets param0 = -1, param1 = aip3[diff] + 1, steps seed, param2 = seedLo & 1
    const pMonRec = (pMonStatsTxt + 3 * 0x1a8) >>> 0
    m.setU16((pMonRec + 0x62 + 1 * 2) >>> 0, 14) // aip3[Nightmare] = 14 -> +1 = 15
    m.setU32((pAiArgs + 0x1c) >>> 0, pMonRec)
    m.setU32((pSelf + 0x20) >>> 0, 1)
    m.setU32((pSelf + 0x24) >>> 0, 0)
    MONAI_InitAiControlAip3AndRandomParity_6FCC3C30_113c(m, pGame, pSelf, pAiArgs)
    expect(m.u32((pAiControl + 0x14) >>> 0)).toBe(0xffffffff)
    expect(m.u32((pAiControl + 0x18) >>> 0)).toBe(15)
    expect(m.u32((pSelf + 0x20) >>> 0)).toBe(0x6ac690c5)
    expect(m.u32((pAiControl + 0x1c) >>> 0)).toBe(1)

    // [24/45] 0x6FCC3D00: clamped skill bonus radius in [1, 24]
    expect(MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c(m, 0, 0, 0)).toBe(1)
    expect(MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c(m, 0, 0, 16)).toBe(8)
    expect(MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c(m, 0, 0, 100)).toBe(24)

    // [25/45] 0x6FCC3E10: same act and octile distance < 0x3FC (1020)
    m.setU8((pSelf + 0x18) >>> 0, 2)
    m.setU8((pObj233 + 0x18) >>> 0, 2)
    expect(MONAI_AreUnitsInSameActWithin1020Subtiles_6FCC3E10_113c(m, pSelf, pObj233)).toBe(1)
    m.setU8((pObj233 + 0x18) >>> 0, 3)
    expect(MONAI_AreUnitsInSameActWithin1020Subtiles_6FCC3E10_113c(m, pSelf, pObj233)).toBe(0)
  })

  it('[26..40] MONAI callbacks, interact target, room stall, state 172, inventory check, cell stat transfer, MonStats skills/velocity, and target validation', () => {
    const { m, pMonStatsTxt } = createTestWorld()

    const pGame = m.alloc(0x1e00) >>> 0
    EVENT_InitTimerQueue113c(m, pGame)

    const pSelf = m.alloc(0x100) >>> 0
    const pSelfPath = m.alloc(0x200) >>> 0
    m.setU32(pSelf, 1)
    m.setU32((pSelf + 0x04) >>> 0, 5)
    m.setU32((pSelf + 0x2c) >>> 0, pSelfPath)
    m.setU16((pSelfPath + 0x02) >>> 0, 50)
    m.setU16((pSelfPath + 0x06) >>> 0, 50)
    STATLIST_CreateEx113c(m, pSelf)

    // [26/45] 0x6FCC4180: returns 0 for non-impregnatable candidate
    expect(MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c(m, pGame, pSelf, 0)).toBe(0)

    // [27/45] 0x6FCC5AC0: records path target interact when target exists
    MONAI_RecordPathTargetInteractByUnitType_6FCC5AC0_113c(m, pGame, pSelf)

    // [28/45] 0x6FCC5D40: stalls 200 frames when unit has room
    const pRoom = m.alloc(0x80) >>> 0
    m.setU32(pSelfPath, pRoom)
    MONAI_Stall200IfUnitHasRoom_6FCC5D40_113c(m, pGame, pSelf)

    // [29/45] 0x6FCCC910: sets state 0xAC (172) on target
    expect(MONAI_EnableState172OnTarget_6FCCC910_113c(m, 0, pSelf)).toBe(0)
    expect(MONAI_EnableState172OnTarget_6FCCC910_113c(m, pSelf, pSelf)).toBe(1)
    expect(STATES_CheckState113c(m, pSelf, 0xac)).toBe(1 << (0xac & 31))
    STATES_ToggleGfxStateFlag113c(m, pSelf, 0xac, 0)

    // [30/45] 0x6FCCC9E0: checks if item is in unit's inventory
    expect(MONAI_InventoryContainsItemPointer_6FCCC9E0_113c(m, pSelf, 0xdeadbeef)).toBe(0)

    // [31/45] 0x6FCCCA20: transfers STAT_71 (0x47) from item into item's cell stat on destination unit
    const pItem = m.alloc(0x100) >>> 0
    const pItemData = m.alloc(0x80) >>> 0
    m.setU32(pItem, 4)
    m.setU32((pItem + 0x14) >>> 0, pItemData)
    m.setU32((pItemData + 0x28) >>> 0, 12) // dwItemCell = statId 12
    STATLIST_CreateEx113c(m, pItem)
    STATLIST_SetUnitStat113c(m, pItem, 0x47, 9, 0)
    expect(MONAI_TransferItemCellStatFromItemToUnit_6FCCCA20_113c(m, pSelf, pItem)).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pSelf, 12, 0)).toBe(9)

    // [32/45] 0x6FCD06F0: invokes filter callback when *pOutResult == 0
    const pFilterArgs = m.alloc(0x10) >>> 0
    const pOutResult = m.alloc(4) >>> 0
    m.setU32(pFilterArgs, 0x6fcd0e30)
    m.setU32((pFilterArgs + 0x04) >>> 0, pGame)
    m.setU32((pFilterArgs + 0x08) >>> 0, pSelf)
    const pMaxRad = m.alloc(4) >>> 0
    m.setU32(pMaxRad, 20)
    m.setU32((pFilterArgs + 0x0c) >>> 0, pMaxRad)
    m.setU32((pSelf + 0x10) >>> 0, 0) // mode 0
    MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c(m, pSelf, pFilterArgs, pOutResult)
    expect(m.u32(pOutResult)).toBe(pSelf)

    // [33/45] 0x6FCD0840: checks wSkill[0..7] at pMonStatsTxt + 0x170
    const pMonRec5 = (pMonStatsTxt + 5 * 0x1a8) >>> 0
    m.setU16((pMonRec5 + 0x170 + 3 * 2) >>> 0, 64)
    expect(MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c(m, pSelf, 64)).toBe(1)
    expect(MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c(m, pSelf, 65)).toBe(0)

    // [34/45] 0x6FCD08A0: returns 14 for player, pMonStatsTxt->nVelocity (+0x4E) for monster
    m.setU8((pMonRec5 + 0x4e) >>> 0, 9)
    expect(MONAI_GetUnitMeleeVelocity_6FCD08A0_113c(m, pSelf)).toBe(9)
    const pPlr = m.alloc(0x100) >>> 0
    m.setU32(pPlr, 0)
    expect(MONAI_GetUnitMeleeVelocity_6FCD08A0_113c(m, pPlr)).toBe(14)

    // [35/45] 0x6FCD0BA0: sets pAiGeneral->dwOwnerGuid (+0x0C) and eOwnerType (+0x10)
    const pMonData = m.alloc(0x60) >>> 0
    const pAiGeneral = m.alloc(0x40) >>> 0
    m.setU32((pSelf + 0x14) >>> 0, pMonData)
    m.setU32((pMonData + 0x28) >>> 0, pAiGeneral)
    m.setU32((pPlr + 0x0c) >>> 0, 0x99)
    MONAI_SetAiGeneralTargetGuidAndType_6FCD0BA0_113c(m, pSelf, pPlr)
    expect(m.u32((pAiGeneral + 0x0c) >>> 0)).toBe(0x99)
    expect(m.u32((pAiGeneral + 0x10) >>> 0)).toBe(0)
    MONAI_SetAiGeneralTargetGuidAndType_6FCD0BA0_113c(m, pSelf, 0)
    expect(m.u32((pAiGeneral + 0x0c) >>> 0)).toBe(0xffffffff)
    expect(m.u32((pAiGeneral + 0x10) >>> 0)).toBe(1)

    // [36/45] 0x6FCD0DB0: counts same-class alive monsters within range
    const pCountCtx = m.alloc(0x10) >>> 0
    m.setU32(pCountCtx, 5) // classId 5
    m.setU32((pCountCtx + 0x04) >>> 0, 10) // maxDist 10
    m.setU32((pSelf + 0x10) >>> 0, 1) // neutral mode (alive)
    expect(
      MONAI_CountSameClassAliveMonstersInRangeCallback_6FCD0DB0_113c(
        m,
        pGame,
        pSelf,
        pSelf,
        pCountCtx,
      ),
    ).toBe(0)
    expect(m.u32((pCountCtx + 0x08) >>> 0)).toBe(1)

    // [37..39] 0x6FCD0DF0, 0x6FCD0E30, 0x6FCD12B0
    const pDoorOut = m.alloc(8) >>> 0
    m.setU32((pDoorOut + 0x04) >>> 0, 100)
    expect(MONAI_FindClosestClosedDoorCallback_6FCD0DF0_113c(m, pGame, pSelf, 0, pDoorOut)).toBe(0)
    expect(
      MONAI_MatchSpawnMode0MonsterWithinRadiusCallback_6FCD0E30_113c(m, pGame, pSelf, 0, pMaxRad),
    ).toBe(0)
    const pCorpseCtx = m.alloc(0x10) >>> 0
    m.setU32((pCorpseCtx + 0x0c) >>> 0, 10)
    expect(
      MONAI_TrackPackCorpseInRangeCallback_6FCD12B0_113c(m, pGame, pSelf, pSelf, pCorpseCtx),
    ).toBe(0)

    // [40/45] 0x6FCD13B0: checks valid hostile combat target
    m.setU32((pPlr + 0x10) >>> 0, 1) // alive player
    m.setU32((pPlr + 0xc4) >>> 0, 0x04) // bit 2 set
    STATLIST_CreateEx113c(m, pPlr)
    const pPlrAlign = STATLIST_AllocList113c(m, 0, 0, 0, 0, 0)
    STATLIST_SetState113c(m, pPlrAlign, 0x69)
    STATLIST_SetStat113c(m, pPlrAlign, 0xac, 2, 0)
    STATLIST_MergeStatLists113c(m, pPlr, pPlrAlign, 1)
    expect(MONAI_IsUnitValidHostileCombatTarget_6FCD13B0_113c(m, pPlr, pGame, pSelf)).toBe(1)
  })

  it('[41..45] ARENA game control and player arena unit lifecycle (0x6FCD22D0..0x6FCD2620)', () => {
    const { m } = createTestWorld()
    const pGame = m.alloc(0x1e00) >>> 0
    m.setU32((pGame + 0x1c) >>> 0, 0x11110000)

    // [41 & 45] Assert when pGame->pArenaCtrl (+0x1D28) == 0
    expect(() => ARENA_GetModeByte_6FCD22D0_113c(m, pGame)).toThrow(D2CommonAssertError)
    expect(() => ARENA_CheckFlagBit8_6FCD2620_113c(m, pGame)).toThrow(D2CommonAssertError)

    // [44/45] 0x6FCD2560: allocates 16-byte D2ArenaStrc, masks flags with 0x3179C7, sets mode byte
    ARENA_AllocGameArenaCtrl_6FCD2560_113c(m, pGame, 0xffffffff, 7)
    const pArena = m.u32((pGame + 0x1d28) >>> 0) >>> 0
    expect(pArena).not.toBe(0)
    expect(m.u32((pArena + 0x08) >>> 0)).toBe(0x3179c7)
    expect(ARENA_GetModeByte_6FCD22D0_113c(m, pGame)).toBe(7)
    expect(ARENA_CheckFlagBit8_6FCD2620_113c(m, pGame)).toBe(1)

    // [42 & 43] 0x6FCD24D0 & 0x6FCD2480: allocates and frees player's D2ArenaUnitStrc at pPlayerData + 0x34
    const pPlayer = m.alloc(0x100) >>> 0
    const pPlayerData = m.alloc(0x60) >>> 0
    m.setU32(pPlayer, 0)
    m.setU32((pPlayer + 0x14) >>> 0, pPlayerData)

    ARENA_AllocPlayerArenaUnit_6FCD24D0_113c(m, pGame, pPlayer)
    const pArenaUnit = m.u32((pPlayerData + 0x34) >>> 0) >>> 0
    expect(pArenaUnit).not.toBe(0)
    expect(m.u32(pArenaUnit)).toBe(0)
    expect(m.u32((pArenaUnit + 0x04) >>> 0)).toBe(0)

    let freedPtr = 0
    ARENA_FreePlayerArenaUnit_6FCD2480_113c(m, pPlayer, pGame, {
      freePoolMemory: (_m, _pool, ptr) => {
        freedPtr = ptr >>> 0
      },
    })
    expect(freedPtr).toBe(pArenaUnit)
    expect(m.u32((pPlayerData + 0x34) >>> 0)).toBe(0)
  })
})
