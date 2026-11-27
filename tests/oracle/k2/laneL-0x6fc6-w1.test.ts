import { describe, expect, it } from 'vitest'
import { D2CommonAssertError, D2COMMON_GDWBITMASKS_IAT_VA_113C } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  D2COMMON_ITEMS_TXT_COUNT_VA_113C,
  D2COMMON_ITEMS_TXT_PTR_VA_113C,
  INVENTORY_AllocInventory113c,
  ITEMS_TXT_STRIDE_113C,
} from '../../../src/d2kern-113c/common/inventory.ts'
import { PATH_SetTargetUnit113c } from '../../../src/d2kern-113c/common/path.ts'
import {
  STATES_CheckState113c,
  STATES_ToggleGfxStateFlag113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetStatValue113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
} from '../../../src/d2kern-113c/common/statlist.ts'
import { SUNIT_InsertServerUnit113c } from '../../../src/d2kern-113c/game/game-strc.ts'
import * as laneLExports from '../../../src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c.ts'
import {
  CLIENTS_FindClientByIdInGame_6FC69FE0_113c,
  CLIENTS_FreeSaveDataBuffer_6FC69630_113c,
  CLIENTS_GetClientByte08_6FC69BF0_113c,
  CLIENTS_GetClientField488_6FC69AB0_113c,
  CLIENTS_GetClientGame_6FC69A80_113c,
  CLIENTS_GetClientNamePtr_6FC69A20_113c,
  CLIENTS_GetSaveDataPtr_6FC69790_113c,
  CLIENTS_GetSaveDataSize_6FC69760_113c,
  CLIENTS_GetSaveHeaderPtr_6FC69240_113c,
  CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c,
  CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c,
  CLIENTS_RecordTrackedUnitPositions_6FC6A370_113c,
  CLIENTS_SetClientActNo_6FC69D70_113c,
  CLIENTS_SetClientFlag20_6FC69580_113c,
  CLIENTS_SetClientInitState_6FC69B70_113c,
  CLIENTS_StoreSaveDataBuffer_6FC696B0_113c,
  CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c,
  GAMETIME_GetElapsedMilliseconds_6FC72020_113c,
  MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c,
  MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c,
  PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c,
  REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c,
  SKILLS_AddDamagePercentStat_6FC6C190_113c,
  SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c,
  SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c,
  SKILLS_ApplyPaladinEighthMaxLifeCost_6FC6F450_113c,
  SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c,
  SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c,
  SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c,
  SKILLS_ApplySummonResistStatList_6FC6E180_113c,
  SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c,
  SKILLS_ClearState0CAndScheduleMonStats2Event_6FC63CA0_113c,
  SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c,
  SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c,
  SKILLS_InitNecroMageSkeletonComponents_6FC6E900_113c,
  SKILLS_InitNecroWarriorSkeletonComponents_6FC6E960_113c,
  SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c,
  SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c,
  SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c,
  SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c,
  SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c,
  SKILLS_SrvSt15_CheckRevivableCorpseOutsideTown_6FC6EF20_113c,
  SKILLS_SrvSt17_CheckSelectableCorpseOutsideTown_6FC6EEE0_113c,
  SKILLS_SrvSt19_CheckTargetOutsideTown_6FC6EE40_113c,
  SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c,
} from '../../../src/d2kern-113c/game/k2-laneL-0x6fc6-w1-113c.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_CreateNodeWithGrowth113c, EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import { D2EventStrc, D2UnitStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

interface LaneLTestWorld {
  m: SparseMemory113c
  pDataTables: number
  pMonStatsTxt: number
  pMonStats2Txt: number
  pSkillsTxt: number
  pSkillCode: number
  pIscTxt: number
  pStatesTxt: number
  pMonLvlTxt: number
  pItemsTxt: number
  pAnimDataTable: number
}

function createLaneLWorld(): LaneLTestWorld {
  const m = new SparseMemory113c()
  const pDataTables = m.alloc(0x1000)
  initD2GameGlobalsInMem113c(m, pDataTables)

  const pBitMasks = m.u32(0x6fd18be0)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, pBitMasks)

  const monStatsCount = 60
  const pMonStatsTxt = m.alloc(monStatsCount * 0x1a8)
  m.setU32(pDataTables + 0xa78, pMonStatsTxt)
  m.setU32(pDataTables + 0xa80, monStatsCount)

  const monStats2Count = 60
  const pMonStats2Txt = m.alloc(monStats2Count * 0x134)
  m.setU32(pDataTables + 0xa90, pMonStats2Txt)
  m.setU32(pDataTables + 0xa98, monStats2Count)

  const skillsCount = 120
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

  const statesCount = 185
  const pStatesTxt = m.alloc(statesCount * 0x3c)
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xc4, statesCount)
  m.setU32(pDataTables + 0xbb8, pStatesTxt)
  m.setU32(pDataTables + 0xbc0, statesCount)

  const pCorpseStateMask = m.alloc(24)
  m.setU32(pDataTables + 0xe4, pCorpseStateMask)
  m.setU32(pDataTables + 0x150, pCorpseStateMask)

  const pLevelsTxt = m.alloc(16 * 0x220)
  const pWarpData = m.alloc(0x80)
  m.setU32(pDataTables + 0xbd8, pLevelsTxt)
  m.setU32(pDataTables + 0xbe0, 16)
  m.setU32(pDataTables + 0xc58, pLevelsTxt)
  m.setU32(pDataTables + 0xc60, 16)
  m.setU32(pDataTables + 0xc64, pWarpData)
  const monLvlCount = 110
  const pMonLvlTxt = m.alloc(monLvlCount * 0x78)
  m.setU32(pDataTables + 0xb70, pMonLvlTxt)
  m.setU32(pDataTables + 0xb74, monLvlCount)

  const itemsCount = 30
  const pItemsTxt = m.alloc(itemsCount * ITEMS_TXT_STRIDE_113C)
  m.setU32(D2COMMON_ITEMS_TXT_PTR_VA_113C, pItemsTxt)
  m.setU32(D2COMMON_ITEMS_TXT_COUNT_VA_113C, itemsCount)

  // D2Common AnimData table + PlrType/PlrMode globals for UNITS_SetUnitAnimMode113c
  const pAnimDataTable = m.alloc(0x500)
  const pEmptyAnimBucket = m.alloc(8)
  for (let i = 0; i < 256; i++) {
    m.setU32(pAnimDataTable + i * 4, pEmptyAnimBucket)
  }
  m.setU32(pAnimDataTable + 0x404 + 0x08, 8)
  m.setU32(pAnimDataTable + 0x404 + 0x0c, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf0b50, 0)
  m.setU32(0x6fdf13c4, 7)
  m.setU32(0x6fdf13c8, 1)
  m.setU32(0x6fdf13cc, m.alloc(20 * 0x34))
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34))
  m.fill(0x6fddc5f8, 0x400, 0)
  m.fill(0x6fde4608, 0x60, 0)
  m.fill(0x6fd2e668, 0x120, 0)
  m.fill(0x6fd2e788, 148 * 16, 0)

  return {
    m,
    pDataTables,
    pMonStatsTxt,
    pMonStats2Txt,
    pSkillsTxt,
    pSkillCode,
    pIscTxt,
    pStatesTxt,
    pMonLvlTxt,
    pItemsTxt,
    pAnimDataTable,
  }
}

function writeRpnImm32(m: SparseMemory113c, pSkillCode: number, offset: number, val: number): number {
  const addr = (pSkillCode + offset) >>> 0
  m.setU8(addr, 0x09)
  m.setU32((addr + 1) >>> 0, val >>> 0)
  m.setU8((addr + 5) >>> 0, 0x00)
  return offset
}

function allocDynamicUnit(
  m: SparseMemory113c,
  unitType: number,
  classId: number,
  unitId: number,
  x = 100,
  y = 200,
): { pUnit: number; pPath: number; pUnitData: number; pStatListEx: number } {
  const pUnit = m.alloc(0x100)
  const pUnitData = m.alloc(0x100)
  const pPath = m.alloc(0x60)
  m.setU32(pUnit, unitType >>> 0)
  m.setU32(pUnit + 0x04, classId >>> 0)
  m.setU32(pUnit + 0x0c, unitId >>> 0)
  m.setU32(pUnit + 0x14, pUnitData)
  m.setU32(pUnit + 0x2c, pPath)
  m.setU16(pPath + 0x02, x & 0xffff)
  m.setU16(pPath + 0x06, y & 0xffff)
  const pStatListEx = STATLIST_CreateEx113c(m, pUnit, 0, 0)
  m.set(pUnit, D2UnitStrc.pStatListEx, pStatListEx)
  return { pUnit, pPath, pUnitData, pStatListEx }
}

function allocRoomWithLevel(m: SparseMemory113c, levelId: number): number {
  const pRoom = m.alloc(0x90)
  const pRoomEx = m.alloc(0xf0)
  const pLevel = m.alloc(0x200)
  m.setU32(pRoom + 0x10, pRoomEx)
  m.setU32(pRoomEx + 0x58, pLevel)
  m.setU32(pLevel + 0x1d0, levelId >>> 0)
  return pRoom
}

describe('Milestone 33 [K2] Lane K2-L: 45 D2Game 0x6FC62C70..0x6FC73260 Functions', () => {
  it('exports exact 45 113c-suffixed kernel functions', () => {
    const names = Object.keys(laneLExports)
    expect(names.length).toBe(45)
    for (const name of names) {
      expect(name.endsWith('113c')).toBe(true)
      expect(typeof (laneLExports as Record<string, unknown>)[name]).toBe('function')
    }
  })

  it('ports SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c (0x6FC62C70)', () => {
    const w = createLaneLWorld()
    const { m, pSkillsTxt, pSkillCode } = w
    const pGame = m.alloc(0x1df4)
    const { pUnit: pAttacker } = allocDynamicUnit(m, 0, 5, 1)
    const { pUnit: pTarget } = allocDynamicUnit(m, 1, 2, 2)

    const calcOff = writeRpnImm32(m, pSkillCode, 0x10, 75)
    const pSkillRec = pSkillsTxt + 10 * 0x23c
    m.setU32(pSkillRec + 0x138, calcOff)
    m.setU16(pSkillRec + 0x110, 0x2a)

    const pDmgZero = m.alloc(0x70)
    m.setU32(pDmgZero + 0x08, 0)
    expect(
      SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c(m, pGame, 2, pAttacker, pTarget, pDmgZero, 10, 5),
    ).toBe(0)

    const pDmgPos = m.alloc(0x70)
    m.setU32(pDmgPos + 0x08, 256)
    expect(
      SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c(m, pGame, 2, pAttacker, pTarget, pDmgPos, 10, -2),
    ).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pTarget, 0xb2, 0)).toBe(0x2a)

    expect(
      SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c(m, pGame, 2, 0, pTarget, 0, 10, 1),
    ).toBe(0)
    const { pUnit: pObject } = allocDynamicUnit(m, 2, 1, 3)
    expect(
      SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c(m, pGame, 2, pAttacker, pObject, 0, 10, 1),
    ).toBe(0)
    expect(
      SKILLS_SrvEvent02_ApplyCalcFreezeAndState_6FC62C70_113c(m, pGame, 2, pAttacker, pTarget, 0, -1, 1),
    ).toBe(0)
  })

  it('ports SKILLS_ClearState0CAndScheduleMonStats2Event_6FC63CA0_113c (0x6FC63CA0)', () => {
    const w = createLaneLWorld()
    const { m, pMonStatsTxt, pMonStats2Txt } = w
    const pGame = m.alloc(0x1df4)
    m.setU32(pGame + 0xa8, 500)
    EVENT_InitTimerQueue113c(m, pGame)

    const { pUnit } = allocDynamicUnit(m, 1, 4, 11)
    STATES_ToggleGfxStateFlag113c(m, pUnit, 0x0c, 1)
    expect(STATES_CheckState113c(m, pUnit, 0x0c)).not.toBe(0)

    m.setU16(pMonStatsTxt + 4 * 0x1a8 + 0x18, 3)
    m.setU8(pMonStats2Txt + 3 * 0x134 + 0x108, 17)

    // Attach two nType == 0 events (both freed; one stays marked freed in pool, one recycled for type 1)
    // plus one nType == 5 event (must remain untouched)
    const evKeep = EVENT_CreateNodeWithGrowth113c(m, pGame, pUnit)
    m.set(evKeep, D2EventStrc.nType, 5)
    m.set(evKeep, D2EventStrc.dwFrame, 600)
    const evFree1 = EVENT_CreateNodeWithGrowth113c(m, pGame, pUnit)
    m.set(evFree1, D2EventStrc.nType, 0)
    m.set(evFree1, D2EventStrc.dwFrame, 0xffffffff)
    const evFree2 = EVENT_CreateNodeWithGrowth113c(m, pGame, pUnit)
    m.set(evFree2, D2EventStrc.nType, 0)
    m.set(evFree2, D2EventStrc.dwFrame, 0xffffffff)

    SKILLS_ClearState0CAndScheduleMonStats2Event_6FC63CA0_113c(m, pGame, pUnit)

    expect(STATES_CheckState113c(m, pUnit, 0x0c)).toBe(0)
    expect(m.u16(evFree2 + 0x02)).toBe(2)

    const scheduledTypes: Array<{ type: number; frame: number }> = []
    for (let cur = m.u32(pUnit + 0xdc); cur !== 0; cur = m.u32(cur + 0x24)) {
      scheduledTypes.push({ type: m.u8(cur), frame: m.u32(cur + 0x04) })
    }
    expect(scheduledTypes).toEqual([
      { type: 1, frame: 517 },
      { type: 5, frame: 600 },
    ])
  })

  it('ports SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c & SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c (0x6FC647D0, 0x6FC648E0)', () => {
    const w = createLaneLWorld()
    const { m, pSkillsTxt, pSkillCode, pAnimDataTable } = w
    const { pUnit } = allocDynamicUnit(m, 0, 5, 1)
    const pPassiveList = STATLIST_AllocList113c(m, 0, 0, 1, 0, 0)
    const pAuraList = STATLIST_AllocList113c(m, 0, 0, 1, 0, 0)

    const off25 = writeRpnImm32(m, pSkillCode, 0x20, 25)
    const off40 = writeRpnImm32(m, pSkillCode, 0x30, 40)
    const offZero = writeRpnImm32(m, pSkillCode, 0x40, 0)

    const skillId = 7
    const pSkillRec = pSkillsTxt + skillId * 0x23c
    m.setU16(pSkillRec + 0x98 + 0, 0x44)
    m.setU32(pSkillRec + 0xa4 + 0, off25)
    m.setU16(pSkillRec + 0x98 + 2, 0x1f)
    m.setU32(pSkillRec + 0xa4 + 4, off40)
    m.setU16(pSkillRec + 0x98 + 4, 0x13)
    m.setU32(pSkillRec + 0xa4 + 8, offZero)
    m.setU16(pSkillRec + 0x98 + 6, 0xffff)
    m.setU16(pSkillRec + 0x98 + 8, 0xffff)

    SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c(m, 0, pUnit, pPassiveList, skillId, 3)
    expect(STATLIST_GetStatValue113c(m, pPassiveList, 0x44, 0)).toBe(25)
    expect(STATLIST_GetStatValue113c(m, pPassiveList, 0x45, 0)).toBe(25)
    expect(STATLIST_GetStatValue113c(m, pPassiveList, 0x1f, 0)).toBe(40)
    expect(STATLIST_GetStatValue113c(m, pPassiveList, 0x13, 0)).toBe(0)
    expect(m.u32(pUnit + 0x50)).toBe((pAnimDataTable + 0x404) >>> 0)

    m.setU32(pUnit + 0x50, 0)
    for (let i = 0; i < 6; i++) {
      m.setU16(pSkillRec + 0x54 + i * 2, 0xffff)
    }
    m.setU16(pSkillRec + 0x54 + 0, 0x44)
    m.setU32(pSkillRec + 0x68 + 0, off40)
    m.setU16(pSkillRec + 0x54 + 10, 0x27)
    m.setU32(pSkillRec + 0x68 + 20, off25)

    SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c(m, pSkillRec, pUnit, pAuraList, -1, 1)
    expect(STATLIST_GetStatValue113c(m, pAuraList, 0x44, 0)).toBe(40)
    expect(STATLIST_GetStatValue113c(m, pAuraList, 0x45, 0)).toBe(40)
    expect(STATLIST_GetStatValue113c(m, pAuraList, 0x27, 0)).toBe(25)
    expect(m.u32(pUnit + 0x50)).toBe((pAnimDataTable + 0x404) >>> 0)
  })

  it('ports SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c (0x6FC649F0)', () => {
    const w = createLaneLWorld()
    const { m, pDataTables, pStatesTxt } = w

    const { pUnit: pPlayer } = allocDynamicUnit(m, 0, 5, 1)
    expect(SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c(m, pPlayer, 10)).toBe(10)
    expect(SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c(m, 0, 7)).toBe(7)

    const { pUnit: pMonster } = allocDynamicUnit(m, 1, 12, 2)
    m.setU32(pMonster + 0xc8, 0x08)
    const pTransList = m.alloc(4)
    m.setU16(pTransList, 139)
    m.setU32(pDataTables + 0x17c, pTransList)
    m.setU16(pDataTables + 0x180, 1)
    m.setU8(pStatesTxt + 139 * 0x3c + 0x2d, 1)
    m.setU16(pStatesTxt + 139 * 0x3c + 0x2e, 20)
    STATES_ToggleGfxStateFlag113c(m, pMonster, 139, 1)

    const remapped = SKILLS_GetNonPlayerTransformAnimMode_6FC649F0_113c(m, pMonster, 10)
    expect(typeof remapped).toBe('number')
  })

  it('ports REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c (0x6FC670F0)', () => {
    const w = createLaneLWorld()
    const { m, pMonStatsTxt } = w
    const pGame = m.alloc(0x1df4)
    const pRoom = allocRoomWithLevel(m, 2)

    // Wire D2RoomExStrc.pLogicalRoomInfo (+0x64) with flag bit 0 -> D2RoomLogicalInfoStrc.pCoordList (+0x30)
    const pRoomEx = m.u32(pRoom + 0x10)
    const pLogical = m.alloc(0x40)
    const pCoordNode = m.alloc(0x30)
    m.setU8(pLogical, 1)
    m.setU32(pLogical + 0x30, pCoordNode)
    m.setU32(pRoomEx + 0x64, pLogical)
    m.setU32(pRoom + 0x4c, 0)
    m.setU32(pRoom + 0x50, 0)
    m.setU32(pRoom + 0x54, 40)
    m.setU32(pRoom + 0x58, 40)
    m.setU32(pCoordNode + 0x00, 0)
    m.setU32(pCoordNode + 0x04, 0)
    m.setU32(pCoordNode + 0x08, 40)
    m.setU32(pCoordNode + 0x0c, 40)
    m.setU8(pCoordNode + 0x14, 1)

    expect(REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c(m, 10, 10, -1, pGame, pRoom)).toBe(0)
    m.setU8(pMonStatsTxt + 5 * 0x1a8 + 0x2f, 4)
    m.setU8(pMonStatsTxt + 5 * 0x1a8 + 0x30, 2)
    expect(REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c(m, 10, 10, 5, pGame, pRoom)).toBe(0)

    m.setU8(pMonStatsTxt + 5 * 0x1a8 + 0x2f, 3)
    m.setU8(pMonStatsTxt + 5 * 0x1a8 + 0x30, 3)
    const { pUnit: fakeLeader, pPath: pLeaderPath } = allocDynamicUnit(m, 1, 5, 100, 8, 12)
    m.setU32(pLeaderPath + 0x1c, pRoom)
    m.setU32(fakeLeader + 0x20, 0x12345678)
    m.setU32(fakeLeader + 0x24, 666)
    let memberSpawns = 0
    const spawned = REGPOP_SpawnMonStatsGroupPackAtSubtile_6FC670F0_113c(m, 12, 8, 5, pGame, pRoom, {
      onMonsterCreate: (_mem, args) => {
        if (args.nMaxRadius === -1) return fakeLeader
        memberSpawns++
        return allocDynamicUnit(m, 1, 5, 100 + memberSpawns).pUnit
      },
    })
    expect(spawned).toBe(fakeLeader)
    expect(memberSpawns).toBe(2)
  })

  it('ports MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c & MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c (0x6FC68300, 0x6FC68410)', () => {
    const { m } = createLaneLWorld()
    const pGame = m.alloc(0x1df4)
    const { pUnit: pP1, pUnitData: pPD1 } = allocDynamicUnit(m, 0, 0, 10)
    const { pUnit: pP2, pUnitData: pPD2 } = allocDynamicUnit(m, 0, 1, 20)
    const { pUnit: pNpc, pUnitData: pNpcData } = allocDynamicUnit(m, 1, 148, 777)

    const pClient1 = m.alloc(0x520)
    const pQueue1 = m.alloc(0x40c)
    m.setU32(pClient1 + 0x1bc, pQueue1)
    m.setU32(pPD1 + 0x9c, pClient1)

    const pClient2 = m.alloc(0x520)
    const pQueue2 = m.alloc(0x40c)
    m.setU32(pClient2 + 0x1bc, pQueue2)
    m.setU32(pPD2 + 0x9c, pClient2)

    const pInteract = m.alloc(0x10)
    m.setU32(pNpcData + 0x30, pInteract)

    const n1 = m.alloc(0x0c)
    const n2 = m.alloc(0x0c)
    const n3 = m.alloc(0x0c)
    m.setU32(n1, pP1)
    m.setU32(n1 + 0x08, n2)
    m.setU32(n2, pP2)
    m.setU32(n2 + 0x08, n3)
    m.setU32(n3, 0xdeadbeef)
    m.setU32(pInteract, n1)

    MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c(m, pInteract, pP2, pGame)
    expect(m.u32(pInteract)).toBe(n1)
    expect(m.u32(n1 + 0x08)).toBe(n3)

    MONSTER_RemovePlayerFromNpcInteractList_6FC68300_113c(m, pInteract, pP1, pGame)
    expect(m.u32(pInteract)).toBe(n3)

    m.setU32(n1, pP1)
    m.setU32(n1 + 0x08, n2)
    m.setU32(n2, pP2)
    m.setU32(n2 + 0x08, 0)
    m.setU32(pInteract, n1)
    m.setU32(pP1 + 0x64, 777)
    m.setU32(pP1 + 0x68, 1)
    m.setU8(pP1 + 0x6c, 1)

    const cancelled: number[] = []
    MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c(
      m,
      pGame,
      pNpc,
      0x6fc79180,
      (_mem, pPlr) => cancelled.push(pPlr),
    )
    expect(m.u32(pInteract)).toBe(0)
    expect(cancelled).toEqual([pP1, pP2])
    expect(m.u32(pP1 + 0x64)).toBe(0xffffffff)
    expect(m.u32(pP1 + 0x68)).toBe(6)
    expect(m.u8(pP1 + 0x6c)).toBe(0)

    expect(m.u32(pQueue1 + 0x00)).toBe(7)
    expect(m.u8(pQueue1 + 0x04)).toBe(0x62)
    expect(m.u8(pQueue1 + 0x05)).toBe(0x01)
    expect(m.u32(pQueue1 + 0x06)).toBe(777)
    expect(m.u8(pQueue1 + 0x0a)).toBe(0x00)
  })

  it('ports CLIENTS getters, setters, save buffer lifecycle, and client lookup (0x6FC69240..0x6FC69FE0)', () => {
    const { m } = createLaneLWorld()
    const pGame = m.alloc(0x1df4)
    const pClient1 = m.alloc(0x520)
    const pClient2 = m.alloc(0x520)

    m.setU32(pClient1, 101)
    m.setU32(pClient1 + 0x1a8, pGame)
    m.setU32(pClient1 + 0x488, 0xabcdef12)
    m.setU8(pClient1 + 0x08, 0x04)
    m.setU32(pClient1 + 0x4a8, pClient2)
    m.setU32(pClient2, 202)
    m.setU32(pGame + 0x88, pClient1)

    expect(CLIENTS_GetSaveHeaderPtr_6FC69240_113c(m, pClient1)).toBe((pClient1 + 0x48c) >>> 0)
    expect(() => CLIENTS_GetSaveHeaderPtr_6FC69240_113c(m, 0)).toThrow(D2CommonAssertError)

    m.setU32(pClient1 + 0x3d4, 0x11)
    CLIENTS_SetClientFlag20_6FC69580_113c(m, pClient1)
    expect(m.u32(pClient1 + 0x3d4)).toBe(0x31)
    expect(() => CLIENTS_SetClientFlag20_6FC69580_113c(m, 0)).toThrow(D2CommonAssertError)

    const pSrc = m.alloc(0x20)
    for (let i = 0; i < 7; i++) {
      m.setU8(pSrc + i, 0x30 + i)
    }
    CLIENTS_StoreSaveDataBuffer_6FC696B0_113c(m, pClient1, 0, pSrc)
    expect(CLIENTS_GetSaveDataPtr_6FC69790_113c(m, pClient1)).toBe(0)
    expect(CLIENTS_GetSaveDataSize_6FC69760_113c(m, pClient1)).toBe(0)

    CLIENTS_StoreSaveDataBuffer_6FC696B0_113c(m, pClient1, 7, pSrc)
    const pBuf = CLIENTS_GetSaveDataPtr_6FC69790_113c(m, pClient1)
    expect(pBuf).not.toBe(0)
    expect(CLIENTS_GetSaveDataSize_6FC69760_113c(m, pClient1)).toBe(7)
    for (let i = 0; i < 7; i++) {
      expect(m.u8(pBuf + i)).toBe(0x30 + i)
    }

    m.setU32(pClient1 + 0x184, 9)
    m.setU32(pClient1 + 0x188, 7)
    CLIENTS_FreeSaveDataBuffer_6FC69630_113c(m, pClient1)
    expect(CLIENTS_GetSaveDataPtr_6FC69790_113c(m, pClient1)).toBe(0)
    expect(CLIENTS_GetSaveDataSize_6FC69760_113c(m, pClient1)).toBe(0)
    expect(m.u32(pClient1 + 0x184)).toBe(0)
    expect(m.u32(pClient1 + 0x188)).toBe(0)
    expect(m.u32(pClient1 + 0x3d4)).toBe(0x21)

    expect(() => CLIENTS_FreeSaveDataBuffer_6FC69630_113c(m, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_StoreSaveDataBuffer_6FC696B0_113c(m, 0, 4, pSrc)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_GetSaveDataSize_6FC69760_113c(m, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_GetSaveDataPtr_6FC69790_113c(m, 0)).toThrow(D2CommonAssertError)

    expect(CLIENTS_GetClientNamePtr_6FC69A20_113c(m, pClient1)).toBe((pClient1 + 0x0d) >>> 0)
    expect(CLIENTS_GetClientGame_6FC69A80_113c(m, pClient1)).toBe(pGame)
    expect(CLIENTS_GetClientField488_6FC69AB0_113c(m, pClient1)).toBe(0xabcdef12)
    CLIENTS_SetClientInitState_6FC69B70_113c(m, pClient1, 4)
    expect(m.u32(pClient1 + 0x04)).toBe(4)
    expect(CLIENTS_GetClientByte08_6FC69BF0_113c(m, pClient1)).toBe(0x04)

    expect(() => CLIENTS_GetClientNamePtr_6FC69A20_113c(m, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_GetClientGame_6FC69A80_113c(m, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_GetClientField488_6FC69AB0_113c(m, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_SetClientInitState_6FC69B70_113c(m, 0, 1)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_GetClientByte08_6FC69BF0_113c(m, 0)).toThrow(D2CommonAssertError)

    CLIENTS_SetClientActNo_6FC69D70_113c(m, pClient1, 4)
    expect(m.u8(pClient1 + 0x1ac)).toBe(4)
    expect(() => CLIENTS_SetClientActNo_6FC69D70_113c(m, 0, 0)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_SetClientActNo_6FC69D70_113c(m, pClient1, 5)).toThrow(D2CommonAssertError)

    expect(CLIENTS_FindClientByIdInGame_6FC69FE0_113c(m, pGame, 202)).toBe(pClient2)
    expect(CLIENTS_FindClientByIdInGame_6FC69FE0_113c(m, pGame, 999)).toBe(0)
    expect(() => CLIENTS_FindClientByIdInGame_6FC69FE0_113c(m, 0, 101)).toThrow(D2CommonAssertError)
  })

  it('ports CLIENTS_RecordTrackedUnitPositions_6FC6A370_113c (0x6FC6A370)', () => {
    const { m } = createLaneLWorld()
    const pClient = m.alloc(0x520)
    m.setU32(pClient + 0x3bc, 99)

    const { pUnit: pMon } = allocDynamicUnit(m, 1, 10, 0x11223344, 321, 654)
    const pObj = m.alloc(0x100)
    const pStaticPath = m.alloc(0x20)
    m.setU32(pObj, 2)
    m.setU32(pObj + 0x0c, 0x55667788)
    m.setU32(pObj + 0x2c, pStaticPath)
    m.setU32(pStaticPath + 0x0c, 444)
    m.setU32(pStaticPath + 0x10, 888)

    const pNodes = m.alloc(3 * 12)
    m.setU32(pNodes + 0, pMon)
    m.setU32(pNodes + 8, 1)
    m.setU32(pNodes + 12, pObj)
    m.setU32(pNodes + 20, 2)
    m.setU32(pNodes + 24, 0)
    m.setU32(pNodes + 32, 0)

    CLIENTS_RecordTrackedUnitPositions_6FC6A370_113c(m, pClient, pNodes)
    expect(m.u32(pClient + 0x3bc)).toBe(2)

    expect(m.u8(pClient + 0x1cc)).toBe(1)
    expect(m.u32(pClient + 0x1cd)).toBe(0x11223344)
    expect(m.u16(pClient + 0x1d1)).toBe(321)
    expect(m.u16(pClient + 0x1d3)).toBe(654)

    expect(m.u8(pClient + 0x1cc + 9)).toBe(2)
    expect(m.u32(pClient + 0x1cd + 9)).toBe(0x55667788)
    expect(m.u16(pClient + 0x1d1 + 9)).toBe(444)
    expect(m.u16(pClient + 0x1d3 + 9)).toBe(888)
  })

  it('ports CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c, CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c & CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c', () => {
    const { m } = createLaneLWorld()
    const pGame = m.alloc(0x1df4)
    const { pUnit: pPlayer, pUnitData: pPD } = allocDynamicUnit(m, 0, 0, 1)
    const pClient = m.alloc(0x520)
    m.setU32(pPD + 0x9c, pClient)
    m.setU32(pClient + 0x174, pPlayer)

    m.setU32(pGame + 0xa8, 1000)
    for (let i = 0; i < 4; i++) {
      CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c(m, pPlayer, pGame)
      expect(CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c(m, pPlayer, pGame)).toBe(0)
    }
    CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c(m, pPlayer, pGame)
    expect(CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c(m, pPlayer, pGame)).toBe(1)

    m.setU32(pGame + 0xa8, 1000 + 0x8cb)
    expect(CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c(m, pPlayer, pGame)).toBe(0)
    CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c(m, pPlayer, pGame)
    expect(m.u32(pClient + 0x3c0)).toBe(1000 + 0x8cb)

    expect(() => CLIENTS_IsActionRateLimitExceeded_6FC6A660_113c(m, 0, pGame)).toThrow(D2CommonAssertError)
    expect(() => CLIENTS_RecordActionRateLimitFrame_6FC6A6E0_113c(m, 0, pGame)).toThrow(D2CommonAssertError)

    // 0x6FC6B3C0 room update with self-near lists [pRoomA] and [pRoomB]
    m.setU32(0x6fdf1420, 0)
    m.setU32(0x6fdf1424, 0)
    const pDrlg = m.alloc(0x500)
    const pWarp = m.alloc(0x48)
    m.setU32(pWarp, 1)
    m.setU32(pDrlg + 0x90, pWarp)
    const pLevel = m.alloc(0x200)
    m.setU32(pLevel + 0x1b4, pDrlg)
    m.setU32(pLevel + 0x1d0, 1)
    const pRoom2 = m.alloc(0x100)
    m.setU32(pRoom2 + 0x58, pLevel)
    const pRoomA = m.alloc(0x90)
    const pNearA = m.alloc(4)
    m.setU32(pNearA, pRoomA)
    m.setU32(pRoomA + 0x00, pNearA)
    m.setU32(pRoomA + 0x10, pRoom2)
    m.setU32(pRoomA + 0x24, 1)
    m.setU32(pRoomA + 0x48, m.alloc(0x20))
    m.setU32(pRoomA + 0x74, 0)

    const pRoomB = m.alloc(0x90)
    const pNearB = m.alloc(4)
    m.setU32(pNearB, pRoomB)
    m.setU32(pRoomB + 0x00, pNearB)
    m.setU32(pRoomB + 0x10, pRoom2)
    m.setU32(pRoomB + 0x24, 1)
    m.setU32(pRoomB + 0x48, m.alloc(0x20))
    m.setU32(pRoomB + 0x74, 0)

    CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c(m, pClient, pRoomA)
    expect(m.u32(pClient + 0x1b4)).toBe(pRoomA)
    expect(m.u32(pRoomA + 0x78)).toBe(1)

    CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c(m, pClient, pRoomA)
    expect(m.u32(pRoomA + 0x78)).toBe(1)

    CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c(m, pClient, pRoomB)
    expect(m.u32(pClient + 0x1b4)).toBe(pRoomB)
    expect(m.u32(pRoomA + 0x78)).toBe(0)
    expect(m.u32(pRoomB + 0x78)).toBe(1)
    expect(() => CLIENTS_UpdateCurrentRoomIfChanged_6FC6B3C0_113c(m, 0, pRoomB)).toThrow(D2CommonAssertError)
  })

  it('ports SKILLS_AddDamagePercentStat_6FC6C190_113c, SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c & SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c', () => {
    const { m } = createLaneLWorld()
    const pGame = m.alloc(0x1df4)
    const { pUnit: pCaster, pPath } = allocDynamicUnit(m, 0, 2, 1)
    const { pUnit: pTarget } = allocDynamicUnit(m, 1, 5, 2)
    SUNIT_InsertServerUnit113c(m, pGame, pCaster)
    SUNIT_InsertServerUnit113c(m, pGame, pTarget)

    STATLIST_SetUnitStat113c(m, pCaster, 0x19, 40, 0)
    SKILLS_AddDamagePercentStat_6FC6C190_113c(m, pCaster, 0)
    expect(STATLIST_GetUnitStat113c(m, pCaster, 0x19, 0)).toBe(40)
    SKILLS_AddDamagePercentStat_6FC6C190_113c(m, pCaster, 35)
    expect(STATLIST_GetUnitStat113c(m, pCaster, 0x19, 0)).toBe(75)
    SKILLS_AddDamagePercentStat_6FC6C190_113c(m, pCaster, -15)
    expect(STATLIST_GetUnitStat113c(m, pCaster, 0x19, 0)).toBe(60)

    expect(SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c(m, pGame, pCaster, -1, 1)).toBe(0)
    expect(SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c(m, pGame, pCaster, 1, 1)).toBe(0)
    PATH_SetTargetUnit113c(m, pPath, pCaster)
    expect(SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c(m, pGame, pCaster, 1, 1)).toBe(0)
    PATH_SetTargetUnit113c(m, pPath, pTarget)
    expect(SKILLS_SrvSt05_CheckValidSkillTarget_6FC6C1C0_113c(m, pGame, pCaster, 1, 1)).toBe(1)

    STATLIST_SetUnitStat113c(m, pCaster, 7, 100 << 8, 0)
    STATLIST_SetUnitStat113c(m, pCaster, 6, 60 << 8, 0)
    expect(SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(m, 0, pCaster)).toBe(0)
    expect(SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(m, -100, pCaster)).toBe(0)
    expect(SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(m, 25 << 8, pCaster)).toBe(25 << 8)
    expect(STATLIST_GetUnitStat113c(m, pCaster, 6, 0)).toBe(85 << 8)
    expect(SKILLS_HealUnitLifeClampedToMax_6FC6DF20_113c(m, 30 << 8, pCaster)).toBe(15 << 8)
    expect(STATLIST_GetUnitStat113c(m, pCaster, 6, 0)).toBe(100 << 8)
  })

  it('ports SKILLS_ApplySummonResistStatList_6FC6E180_113c & SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c', () => {
    const w = createLaneLWorld()
    const { m, pMonLvlTxt } = w
    const pGame = m.alloc(0x1df4)
    const { pUnit: pOwner } = allocDynamicUnit(m, 0, 2, 1)
    const { pUnit: pPet } = allocDynamicUnit(m, 1, 363, 2)

    SKILLS_ApplySummonResistStatList_6FC6E180_113c(m, pOwner, pPet)
    expect(STATLIST_GetUnitStat113c(m, pPet, 0x27, 0)).toBe(0)

    STATLIST_SetUnitStat113c(m, pOwner, 0x15d, 44, 0)
    STATLIST_SetUnitStat113c(m, pPet, 0x8e, 10, 0)
    SKILLS_ApplySummonResistStatList_6FC6E180_113c(m, pOwner, pPet)
    expect(STATLIST_GetUnitStat113c(m, pPet, 0x27, 0)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pPet, 0x29, 0)).toBe(44)
    expect(STATLIST_GetUnitStat113c(m, pPet, 0x2b, 0)).toBe(44)
    expect(STATLIST_GetUnitStat113c(m, pPet, 0x2d, 0)).toBe(44)

    STATLIST_SetUnitStat113c(m, pOwner, 0x0c, 20, 0)
    m.setU8(pGame + 0x6d, 1)
    m.setU8(pGame + 0x6a, 1)
    const pRec17 = pMonLvlTxt + 17 * 0x78
    m.setU32(pRec17 + 4 * 4, 310)
    m.setU32(pRec17 + 10 * 4, 520)

    expect(SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c(m, pOwner, 0, pGame, pPet, 2)).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pPet, 0x0c, 0)).toBe(17)
    expect(STATLIST_GetUnitStat113c(m, pPet, 0x1f, 0)).toBe(310)
    expect(STATLIST_GetUnitStat113c(m, pPet, 0x13, 0)).toBe(520)
  })

  it('ports SKILLS_InitNecroMageSkeletonComponents_6FC6E900_113c & SKILLS_InitNecroWarriorSkeletonComponents_6FC6E960_113c', () => {
    const w = createLaneLWorld()
    const { m, pSkillsTxt } = w
    const { pUnit: pNecro } = allocDynamicUnit(m, 0, 2, 1)
    m.setU32(pNecro + 0x20, 0x11112222)
    m.setU32(pNecro + 0x24, 666)

    // Attach state 0x61 sublist with stat 0x15F = 9 (row 9 = [2, 3, 1, 0, 0, 1, 2, 2, 4])
    STATES_ToggleGfxStateFlag113c(m, pNecro, 0x61, 1)
    const pState61 = STATLIST_AllocList113c(m, 0, 0, 1, 0x61, 0)
    STATLIST_SetStat113c(m, pState61, 0x15f, 9, 0)
    STATLIST_MergeStatLists113c(m, pNecro, pState61, 1)

    const { pUnit: pMage, pUnitData: pMageData } = allocDynamicUnit(m, 1, 364, 10)
    const pAiGen = m.alloc(0x40)
    m.setU32(pMageData + 0x28, pAiGen)
    SKILLS_InitNecroMageSkeletonComponents_6FC6E900_113c(m, pNecro, pMage)
    expect(m.u8(pMageData + 0x04)).toBe(2)
    expect(m.u32(pAiGen + 0x14)).toBe(1)

    m.setU32(pSkillsTxt + 70 * 0x23c + 0x148, 100)
    const { pUnit: pWarrior, pUnitData: pWarData } = allocDynamicUnit(m, 1, 363, 11)
    SKILLS_InitNecroWarriorSkeletonComponents_6FC6E960_113c(m, 70, pNecro, pWarrior, 5)
    expect(m.u8(pWarData + 0x04)).toBe(2)
    expect(m.u8(pWarData + 0x0b)).toBe(3)
    expect(m.u8(pWarData + 0x09)).toBe(4)
  })

  it('ports SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c, SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c & SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c', () => {
    const w = createLaneLWorld()
    const { m, pMonStatsTxt, pMonStats2Txt } = w
    const pGame = m.alloc(0x1df4)

    const { pUnit: pMonA } = allocDynamicUnit(m, 1, 5, 30)
    const { pUnit: pMonB } = allocDynamicUnit(m, 1, 5, 31)
    m.setU32(pMonA + 0x80, pGame)
    m.setU32(pMonB + 0x80, pGame)

    const pUpdateNodeA = m.alloc(12)
    m.setU32(pUpdateNodeA, pMonA)
    m.setU32(pGame + 0x10f8 + 2 * 4, pUpdateNodeA)
    m.setU32(pMonA + 0xd0, 2)
    STATES_ToggleGfxStateFlag113c(m, pMonA, 0x39, 1)

    SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c(m, pMonA, 0x39, 0)
    expect(STATES_CheckState113c(m, pMonA, 0x39)).toBe(0)
    expect(m.u32(pMonA + 0xd0)).toBe(0x0b)
    expect(() => SKILLS_OnCurseExpireResetAlignmentA_6FC6EB90_113c(m, 0, 0x39)).toThrow(D2CommonAssertError)

    const pUpdateNodeB = m.alloc(12)
    m.setU32(pUpdateNodeB, pMonB)
    m.setU32(pGame + 0x10f8 + 3 * 4, pUpdateNodeB)
    m.setU32(pMonB + 0xd0, 3)
    STATES_ToggleGfxStateFlag113c(m, pMonB, 0x3b, 1)

    SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c(m, pMonB, 0x3b, 0)
    expect(STATES_CheckState113c(m, pMonB, 0x3b)).toBe(0)
    expect(m.u32(pMonB + 0xd0)).toBe(0x0b)
    expect(() => SKILLS_OnCurseExpireResetAlignmentB_6FC6EBE0_113c(m, 0, 0x3b)).toThrow(D2CommonAssertError)

    // 0x6FC6ECD0: curse target eligibility (MonStats2 mode bit 2 is at +0xF0)
    const { pUnit: pCaster } = allocDynamicUnit(m, 0, 2, 1)
    const pAlignSubList = STATLIST_AllocList113c(m, 0, 0, 1, 0x69, 0)
    STATLIST_SetStat113c(m, pAlignSubList, 0xac, 2, 0)
    STATLIST_MergeStatLists113c(m, pCaster, pAlignSubList, 1)
    const { pUnit: pCurseMon, pUnitData: pCurseMonData } = allocDynamicUnit(m, 1, 5, 40)
    m.setU32(pCurseMon + 0x10, 1)
    m.setU32(pCurseMon + 0xc4, 0x0e)
    m.setU16(pMonStatsTxt + 5 * 0x1a8 + 0x18, 2)
    m.setU8(pMonStats2Txt + 2 * 0x134 + 0xf0, 0x04)

    expect(SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c(m, pCurseMon, pGame, pCaster)).toBe(1)

    m.setU8(pCurseMonData + 0x16, 0x20)
    expect(SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c(m, pCurseMon, pGame, pCaster)).toBe(0)
    m.setU8(pCurseMonData + 0x16, 0x00)

    m.setU32(pCurseMon + 0xc4, 0x0c)
    expect(SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c(m, pCurseMon, pGame, pCaster)).toBe(0)
    expect(SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c(m, 0, pGame, pCaster)).toBe(0)
  })

  it('ports Necromancer SrvStFunc 15, 17, 19, 20 target validators (0x6FC6EDD0, 0x6FC6EE40, 0x6FC6EEE0, 0x6FC6EF20)', () => {
    const w = createLaneLWorld()
    const { m, pItemsTxt, pMonStatsTxt, pMonStats2Txt } = w
    const pGame = m.alloc(0x1df4)
    const pTownRoom = allocRoomWithLevel(m, 1)
    const pWildRoom = allocRoomWithLevel(m, 2)

    const { pUnit: pNecro, pPath } = allocDynamicUnit(m, 0, 2, 1)
    SUNIT_InsertServerUnit113c(m, pGame, pNecro)

    const pItem = m.alloc(0x100)
    const pItemData = m.alloc(0x80)
    m.setU32(pItem, 4)
    m.setU32(pItem + 0x04, 3)
    m.setU32(pItem + 0x0c, 50)
    m.setU32(pItem + 0x10, 3)
    m.setU32(pItem + 0x14, pItemData)
    m.setU32(pItemsTxt + 3 * ITEMS_TXT_STRIDE_113C + 0xdc, 0x02)
    m.setU32(pItemData + 0x18, 0x10)
    SUNIT_InsertServerUnit113c(m, pGame, pItem)

    PATH_SetTargetUnit113c(m, pPath, pItem)
    expect(SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c(m, pGame, pNecro, 94, 1)).toBe(1)

    m.setU32(pItemsTxt + 3 * ITEMS_TXT_STRIDE_113C + 0xdc, 0x00)
    expect(SKILLS_SrvSt20_CanCreateIronGolemOnItem_6FC6EDD0_113c(m, pGame, pNecro, 94, 1)).toBe(0)

    const { pUnit: pCorpse, pPath: pCorpsePath } = allocDynamicUnit(m, 1, 6, 60)
    m.setU32(pCorpse + 0x10, 12)
    m.setU32(pCorpsePath + 0x1c, pTownRoom)
    SUNIT_InsertServerUnit113c(m, pGame, pCorpse)

    m.setU16(pMonStatsTxt + 6 * 0x1a8 + 0x18, 4)
    m.setU16(pMonStatsTxt + 6 * 0x1a8 + 0x32, 0)
    m.setU8(pMonStats2Txt + 4 * 0x134 + 0x04, 0x80)

    PATH_SetTargetUnit113c(m, pPath, pCorpse)
    expect(SKILLS_SrvSt19_CheckTargetOutsideTown_6FC6EE40_113c(m, pGame, pNecro, 74, 1)).toBe(0)
    expect(SKILLS_SrvSt17_CheckSelectableCorpseOutsideTown_6FC6EEE0_113c(m, pGame, pNecro, 74, 1)).toBe(0)
    expect(SKILLS_SrvSt15_CheckRevivableCorpseOutsideTown_6FC6EF20_113c(m, pGame, pNecro, 95, 1)).toBe(0)

    m.setU32(pCorpsePath + 0x1c, pWildRoom)
    expect(SKILLS_SrvSt19_CheckTargetOutsideTown_6FC6EE40_113c(m, pGame, pNecro, 74, 1)).toBe(1)
    expect(SKILLS_SrvSt17_CheckSelectableCorpseOutsideTown_6FC6EEE0_113c(m, pGame, pNecro, 74, 1)).toBe(1)
    expect(SKILLS_SrvSt15_CheckRevivableCorpseOutsideTown_6FC6EF20_113c(m, pGame, pNecro, 95, 1)).toBe(0)

    m.setU16(pMonStatsTxt + 6 * 0x1a8 + 0x32, 6)
    expect(SKILLS_SrvSt15_CheckRevivableCorpseOutsideTown_6FC6EF20_113c(m, pGame, pNecro, 95, 1)).toBe(1)
  })

  it('ports Corpse Explosion AoE callback, Paladin 1/8 life cost, SrvDo32 & Curse AI transition (0x6FC6F370, 0x6FC6F450, 0x6FC6F920, 0x6FC700A0)', () => {
    const w = createLaneLWorld()
    const { m, pSkillsTxt, pMonStatsTxt } = w
    const pGame = m.alloc(0x1df4)
    EVENT_InitTimerQueue113c(m, pGame)

    const { pUnit: pAttacker } = allocDynamicUnit(m, 0, 2, 1, 100, 100)
    const { pUnit: pNearMon } = allocDynamicUnit(m, 1, 5, 2, 102, 100)
    const { pUnit: pFarMon } = allocDynamicUnit(m, 1, 5, 3, 110, 100)
    m.setU32(pAttacker + 0x10, 1)
    m.setU32(pNearMon + 0x10, 1)
    m.setU32(pFarMon + 0x10, 1)
    STATLIST_SetUnitStat113c(m, pNearMon, 6, 1000, 0)
    STATLIST_SetUnitStat113c(m, pFarMon, 6, 1000, 0)

    const pSrcDmg = m.alloc(0x70)
    m.setU32(pSrcDmg + 0x00, 0x8000)
    m.setU16(pSrcDmg + 0x04, 0x0001)
    m.setU32(pSrcDmg + 0x08, 200)
    m.setU32(pSrcDmg + 0x10, 150)

    const pSubCtx = m.alloc(0x10)
    m.setU32(pSubCtx + 0x00, pSrcDmg)
    m.setU32(pSubCtx + 0x04, 100)
    m.setU32(pSubCtx + 0x08, 100)
    m.setU32(pSubCtx + 0x0c, 25)

    const pAuraCtx = m.alloc(0x10)
    expect(SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c(m, pAuraCtx, pNearMon)).toBe(0)
    m.setU32(pAuraCtx + 0x00, pGame)
    m.setU32(pAuraCtx + 0x04, pAttacker)
    m.setU32(pAuraCtx + 0x0c, pSubCtx)

    expect(SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c(m, pAuraCtx, pNearMon)).toBe(1)
    expect(SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c(m, pAuraCtx, pFarMon)).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pNearMon, 6, 0)).toBeLessThan(
      STATLIST_GetUnitStat113c(m, pFarMon, 6, 0),
    )

    STATLIST_SetUnitStat113c(m, pAttacker, 7, 800, 0)
    STATLIST_SetUnitStat113c(m, pAttacker, 6, 800, 0)
    SKILLS_ApplyPaladinEighthMaxLifeCost_6FC6F450_113c(m, pAttacker, pGame)
    expect(STATLIST_GetUnitStat113c(m, pAttacker, 6, 0)).toBe(800)

    const { pUnit: pPaladin } = allocDynamicUnit(m, 0, 3, 4)
    m.setU32(pPaladin + 0x10, 1)
    STATLIST_SetUnitStat113c(m, pPaladin, 7, 800, 0)
    STATLIST_SetUnitStat113c(m, pPaladin, 6, 800, 0)
    SKILLS_ApplyPaladinEighthMaxLifeCost_6FC6F450_113c(m, pPaladin, pGame)
    expect(STATLIST_GetUnitStat113c(m, pPaladin, 6, 0)).toBe(700)

    const { pUnit: pMeleeUnit, pPath: pMeleePath } = allocDynamicUnit(m, 0, 4, 5)
    SUNIT_InsertServerUnit113c(m, pGame, pMeleeUnit)
    SUNIT_InsertServerUnit113c(m, pGame, pNearMon)
    expect(SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c(m, pGame, pMeleeUnit, 1, 1)).toBe(0)
    expect((m.u32(pMeleeUnit + 0xc4) & 0x40) !== 0).toBe(true)
    PATH_SetTargetUnit113c(m, pMeleePath, pNearMon)
    expect(SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c(m, pGame, pMeleeUnit, 1, 1)).toBe(1)

    const { pUnit: pCursedMon, pUnitData: pCursedData } = allocDynamicUnit(m, 1, 5, 6)
    const pAiGen = m.alloc(0x40)
    m.setU32(pCursedData, pMonStatsTxt + 5 * 0x1a8)
    m.setU16(pMonStatsTxt + 5 * 0x1a8 + 0x1e, 6)
    m.setU32(pCursedData + 0x28, pAiGen)
    m.setU32(pAiGen + 0x14, 99)

    m.setU16(pSkillsTxt + 86 * 0x23c + 0x82, 0x17)
    SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c(m, 86, pCursedMon, pGame)
    expect(m.u32(pAiGen)).toBe(0x0a)
    expect(m.u32(pAiGen + 0x14)).toBe(0)

    m.setU16(pSkillsTxt + 81 * 0x23c + 0x82, 0x1b)
    SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c(m, 81, pCursedMon, pGame)
    expect(m.u32(pAiGen)).toBe(0x0c)

    m.setU16(pSkillsTxt + 95 * 0x23c + 0x82, 0x38)
    SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c(m, 95, pCursedMon, pGame)
    expect(m.u32(pAiGen)).toBe(0x0b)

    STATES_ToggleGfxStateFlag113c(m, pCursedMon, 0x36, 1)
    expect(() => SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c(m, 95, pCursedMon, pGame)).toThrow(
      /0x36|0x1a6|422/,
    )
  })

  it('ports GAMETIME_GetElapsedMilliseconds_6FC72020_113c & PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c (0x6FC72020, 0x6FC73260)', () => {
    const { m } = createLaneLWorld()

    m.setU32(0x6fd303b0, 0)
    m.setU32(0x6fd18d10, 123456)
    expect(GAMETIME_GetElapsedMilliseconds_6FC72020_113c(m)).toBe(123456)
    expect(
      GAMETIME_GetElapsedMilliseconds_6FC72020_113c(m, { getTickCount: () => 654321 }),
    ).toBe(654321)

    m.setU32(0x6fd303b0, 1)
    m.setU32(0x6fd303a0, 10_000_000)
    m.setU32(0x6fd303a4, 0)
    expect(
      GAMETIME_GetElapsedMilliseconds_6FC72020_113c(m, {
        queryPerformanceCounter: (mem, pOut) => {
          mem.setU32(pOut, 0x2a05f200)
          mem.setU32((pOut + 4) >>> 0, 1)
          return 1
        },
      }),
    ).toBe(500_000)

    const pQpcCounter = m.alloc(8)
    m.setU32(pQpcCounter, 25_000_000)
    m.setU32(pQpcCounter + 4, 0)
    m.setU32(0x6fd18d08, pQpcCounter)
    expect(GAMETIME_GetElapsedMilliseconds_6FC72020_113c(m)).toBe(2500)

    m.setU32(0x6fd303a0, 0)
    expect(() => GAMETIME_GetElapsedMilliseconds_6FC72020_113c(m)).toThrow(RangeError)

    expect(PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c(m, 0)).toBe(0)

    const { pUnit: pOwner } = allocDynamicUnit(m, 0, 0, 1)
    const pInv = INVENTORY_AllocInventory113c(m, 0, pOwner)
    expect(PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c(m, pInv)).toBe(0)

    const mkItem = (id: number, unitType = 4): { pItem: number; pItemData: number } => {
      const pItem = m.alloc(0x100)
      const pItemData = m.alloc(0x80)
      m.setU32(pItem, unitType >>> 0)
      m.setU32(pItem + 0x0c, id >>> 0)
      m.setU32(pItem + 0x14, pItemData)
      return { pItem, pItemData }
    }

    const cursor = mkItem(10, 4)
    const item1 = mkItem(11, 4)
    const item2 = mkItem(12, 4)
    const nonItemTail = mkItem(13, 2)

    m.setU32(pInv + 0x20, cursor.pItem)
    m.setU32(pInv + 0x0c, item1.pItem)
    m.setU32(item1.pItemData + 0x64, item2.pItem)
    m.setU32(item2.pItemData + 0x64, nonItemTail.pItem)

    expect(PLAYERSAVE_CountInventoryAndCursorItems_6FC73260_113c(m, pInv)).toBe(3)
  })
})
