import { describe, expect, it } from 'vitest'
import {
  D2CommonAssertError,
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  MISSILE_SetLevel113c,
  MISSILE_SetRemainingFrames113c,
  MISSILE_SetSkill113c,
  MISSILE_SetTargetX113c,
  MISSILE_SetTargetY113c,
  MISSILE_SetTotalFrames113c,
} from '../../../src/d2kern-113c/common/missile.ts'
import { QUESTRECORD_AllocRecord113c } from '../../../src/d2kern-113c/common/quest-record.ts'
import { STATLIST_CreateEx113c, STATLIST_SetUnitStat113c } from '../../../src/d2kern-113c/common/statlist.ts'
import * as w3b3 from '../../../src/d2kern-113c/game/k2-w3b3-113c.ts'
import {
  D2GAME_IAT_GDW_BITMASKS_VA_113C,
  initD2GameGlobalsInMem113c,
} from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { EVENT_InitTimerQueue113c } from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2DrlgLevelStrc,
  D2DrlgLevelStrc_SIZE,
  D2LevelsTxt,
  D2LevelsTxt_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2UnitStrc,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function createEnv() {
  const m = new SparseMemory113c()
  m.fill(0x6fd20000, 0x20000, 0)
  m.fill(0x6fdd6000, 0x20000, 0)
  const pDataTables = m.alloc(0x2000)
  initD2GameGlobalsInMem113c(m, pDataTables)
  m.setU32(0x6fde9e1c, pDataTables)
  m.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, m.u32(D2GAME_IAT_GDW_BITMASKS_VA_113C))
  const pSkillsTxt = m.alloc(16 * 0x23c)
  m.setU32(pDataTables + 0xb98, pSkillsTxt)
  m.setU32(pDataTables + 0xba0, 16)
  const pMissilesTxt = m.alloc(16 * 0x1a4)
  m.setU32(pDataTables + 0xb64, pMissilesTxt)
  m.setU32(pDataTables + 0xb6c, 16)
  const pStatesTxt = m.alloc(16 * 0x40)
  m.setU32(pDataTables + 0xbc, pStatesTxt)
  m.setU32(pDataTables + 0xc4, 16)
  m.setU32(pDataTables + 0xbb8, pStatesTxt)
  m.setU32(pDataTables + 0xbc0, 16)
  m.setU32(pDataTables + 0xbc4, m.alloc(8 * 0xc4))
  m.setU32(pDataTables + 0xbc8, 8)
  m.setU32(pDataTables + 0x150, m.alloc(24))
  m.setU32(pDataTables + 0xbcc, m.alloc(360 * 0x144))
  m.setU32(pDataTables + 0xbd4, 360)
  const pAnimDataTable = m.alloc(0x500)
  const pEmptyAnimBucket = m.alloc(8)
  for (let i = 0; i < 256; i++) m.setU32(pAnimDataTable + i * 4, pEmptyAnimBucket)
  m.setU32(pAnimDataTable + 0x40c, 8)
  m.setU32(pAnimDataTable + 0x410, 256)
  m.setU32(0x6fdf0b4c, pAnimDataTable)
  m.setU32(0x6fdf13c4, 7)
  m.setU32(0x6fdf13c8, 1)
  m.setU32(0x6fdf13cc, m.alloc(20 * 0x34))
  m.setU32(0x6fdf13d0, m.alloc(20 * 0x34))
  const pLevelsTxt = m.alloc(140 * D2LevelsTxt_SIZE)
  m.setU32(pDataTables + 0x1dc, pLevelsTxt)
  m.setU32(pDataTables + 0x1e0, 140)
  for (let lvl = 1; lvl < 140; lvl++) {
    const act = lvl < 40 ? 0 : lvl < 75 ? 1 : lvl < 103 ? 2 : lvl < 109 ? 3 : 4
    m.set(pLevelsTxt + lvl * D2LevelsTxt_SIZE, D2LevelsTxt.nAct, act)
  }
  const pGame = m.alloc(0x1f00)
  EVENT_InitTimerQueue113c(m, pGame)
  const pAct = m.alloc(0x80)
  const pDrlg = m.alloc(0x500)
  m.setU32(pAct + 0x14, pDrlg)
  m.setU32(pDrlg + 0x3f4, 70)
  m.setU32(pGame + 0xc0, pAct)
  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
  const pRoomEx = m.alloc(D2RoomExStrc_SIZE)
  const pLevel = m.alloc(D2DrlgLevelStrc_SIZE)
  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, m.alloc(8))
  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  m.set(pLevel, D2DrlgLevelStrc.nLevelId, 1)
  const pPlayer = m.alloc(0x100)
  const pPlayerData = m.alloc(0x100)
  const pQuestFlags = QUESTRECORD_AllocRecord113c(m, 0)
  const pQuestIntro = m.alloc(0x10)
  const pIntroBitRecord = m.alloc(0x10)
  const pIntroBitBuf = m.alloc(0x40)
  m.setU32(pQuestIntro + 0x04, pIntroBitRecord)
  m.setU32(pIntroBitRecord, pIntroBitBuf)
  const pClient = m.alloc(0x600)
  const pPlayerPath = m.alloc(0x200)
  m.set(pPlayer, D2UnitStrc.dwUnitType, 0)
  m.set(pPlayer, D2UnitStrc.dwUnitId, 1)
  m.setU32(pPlayer + 0x10, 1)
  m.set(pPlayer, D2UnitStrc.pUnitData, pPlayerData)
  m.set(pPlayer, D2UnitStrc.pPath, pPlayerPath)
  m.set(pPlayer, D2UnitStrc.pAnimData, m.alloc(0x40))
  STATLIST_CreateEx113c(m, pPlayer, 0, 0)
  m.setU32(pPlayerPath + 0x1c, pRoom)
  m.setU32(pPlayerPath + 0x30, pPlayer)
  m.setU32(pPlayerPath + 0x00, (100 << 16) | 0)
  m.setU32(pPlayerPath + 0x04, (200 << 16) | 0)
  m.setU32(pPlayerData + 0x10, pQuestFlags)
  m.setU32(pPlayerData + 0x60, pQuestIntro)
  m.setU32(pPlayerData + 0x9c, pClient)
  m.setU32(pClient + 0x1bc, m.alloc(0x410))
  m.setU32(pGame + 0x1120 + (1 & 0x7f) * 4, pPlayer)
  const pMissile = m.alloc(0x100)
  const pMissileData = m.alloc(0x40)
  const pMissilePath = m.alloc(0x200)
  m.set(pMissile, D2UnitStrc.dwUnitType, 3)
  m.set(pMissile, D2UnitStrc.dwClassId, 1)
  m.set(pMissile, D2UnitStrc.dwUnitId, 10)
  m.set(pMissile, D2UnitStrc.pUnitData, pMissileData)
  m.set(pMissile, D2UnitStrc.pPath, pMissilePath)
  m.set(pMissile, D2UnitStrc.pAnimData, m.alloc(0x40))
  STATLIST_CreateEx113c(m, pMissile, 0, 0)
  m.setU32(pMissilePath + 0x1c, pRoom)
  m.setU32(pMissilePath + 0x30, pMissile)
  m.setU32(pMissilePath + 0x00, (100 << 16) | 0)
  m.setU32(pMissilePath + 0x04, (200 << 16) | 0)
  m.setU32(pMissile + 0x94, 0)
  m.setU32(pMissile + 0x98, 1)
  m.setU32(pMissile + 0xc8, 1 << 10)
  MISSILE_SetSkill113c(m, pMissile, 1)
  MISSILE_SetLevel113c(m, pMissile, 2)
  MISSILE_SetTotalFrames113c(m, pMissile, 10)
  MISSILE_SetRemainingFrames113c(m, pMissile, 6)
  return { m, pDataTables, pSkillsTxt, pMissilesTxt, pGame, pRoom, pLevel, pPlayer, pPlayerData, pQuestFlags, pQuestIntro, pClient, pMissile, pMissileData, pMissilePath }
}

describe('K2 Wave 3 Batch 3 (w3b3: 45 functions across 0x6FC533D0..0x6FC5FED0)', () => {
  it('verifies OBJECTS_InitFn05 and QUESTS routines (1..10)', () => {
    const { m, pGame, pRoom, pLevel, pPlayer, pQuestFlags, pQuestIntro } = createEnv()
    const pObj = m.alloc(0x100)
    const pObjData = m.alloc(0x40)
    const pObjectsTxt = m.alloc(0x200)
    m.setU32(pObj + 0x00, 2)
    m.setU32(pObj + 0x04, 0x3d)
    m.setU32(pObj + 0x0c, 77)
    m.setU32(pObj + 0x10, 1)
    m.setU32(pObj + 0x14, pObjData)
    const pObjInit = m.alloc(0x30)
    m.setU32(pObjInit + 0x00, pGame)
    m.setU32(pObjInit + 0x04, pObj)
    m.setU32(pObjInit + 0x08, pRoom)
    m.setU32(pObjInit + 0x10, pObjectsTxt)
    w3b3.OBJECTS_InitFn05_InitPortalDestLevel_6FC533D0_113c(m, pObjInit)
    expect(m.u8(pObjData + 0x04)).toBe(0x27)
    m.set(pLevel, D2DrlgLevelStrc.nLevelId, 111)
    w3b3.OBJECTS_InitFn05_InitPortalDestLevel_6FC533D0_113c(m, pObjInit)
    expect(m.u8(pObjData + 0x04)).toBe(0x7d)
    m.set(pLevel, D2DrlgLevelStrc.nLevelId, 1)

    expect(w3b3.QUESTS_CheckLevelTransitionBlocked_6FC54020_113c(m, pGame, 1, pPlayer, 1)).toBe(0)
    expect(w3b3.QUESTS_CheckLevelTransitionBlocked_6FC54020_113c(m, pGame, 0x76, pPlayer, 1)).toBe(0)

    const pIoCoord = m.alloc(8)
    const ppOutRoom = m.alloc(4)
    m.setU32(pIoCoord, 50)
    m.setU32(pIoCoord + 4, 60)
    w3b3.QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c(m, pRoom, pIoCoord, 1, 0x01, ppOutRoom, 1)
    expect(m.u32(ppOutRoom)).toBe(0)

    m.setU32(0x6fd2df68, 2)
    m.setU32(0x6fd2dbf0 + 0x04, 0)
    m.setU32(0x6fd2dbf0 + 0x10, 1)
    m.setU32(0x6fd2dbf0 + 0x18 + 0x04, 0)
    m.setU32(0x6fd2dbf0 + 0x18 + 0x10, 4)
    m.setU32(0x6fd2df8c, 1)
    w3b3.QUESTS_AllocAndInitGameQuests_6FC548A0_113c(m, pGame)
    const pQuestCtrl = m.u32(pGame + 0x10f4)
    expect(pQuestCtrl).not.toBe(0)
    m.setU32(pQuestCtrl + 0x08, 1)

    w3b3.QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c(m, 1, pPlayer, pGame)
    w3b3.QUESTS_SendQuestLogPackets50And52_6FC55640_113c(m, pGame, pPlayer)

    expect(() => w3b3.QUESTS_AttachUnitToQuest_6FC55890_113c(m, pObj, -1, pGame)).toThrow(D2CommonAssertError)
    const pQuest4 = w3b3.QUESTS_AttachUnitToQuest_6FC55890_113c(m, pObj, 4, pGame)
    expect(pQuest4).toBe(1)

    w3b3.QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c(m, pObj, pPlayer, pGame)
    w3b3.QUESTS_ApplyActNpcIntroFlags_6FC55C20_113c(m, pPlayer, 0, pGame)
    expect(m.u32(pQuestIntro + 0x04)).not.toBe(0)
    w3b3.QUESTS_SendNpcIntroPacket91_6FC55B60_113c(m, pPlayer, 0, pGame)
    expect(pQuestFlags).not.toBe(0)
  })
  it('verifies MISSILES cold length, path, conversion, heal, damage, aura, filters, and SrvDmg01..03 (11..23)', () => {
    const { m, pSkillsTxt, pMissilesTxt, pGame, pPlayer, pMissile } = createEnv()
    const m1 = pMissilesTxt + 1 * 0x1a4
    m.setU32(m1 + 0x78, 50)
    m.setU16(m1 + 0x96, 20)
    m.setU16(m1 + 0x98, 5)
    m.setU16(m1 + 0x24, 2)
    m.setU16(m1 + 0x26, 3)
    m.setU16(m1 + 0x28, 4)
    m.setU32(m1 + 0x4c, 2)
    STATLIST_SetUnitStat113c(m, pMissile, 0x38, 200, 0)
    const pDmg = m.alloc(0x70)
    w3b3.MISSILES_ApplyColdLengthToDamage_6FC59080_113c(m, pMissile, 0, pDmg)
    expect(m.u32(pDmg + 0x34)).toBe(100)

    w3b3.MISSILES_InitGuidedOrLinearPath_6FC597C0_113c(m, pMissile, pPlayer)
    m.setU32(pDmg + 0x08, 1000)
    w3b3.MISSILES_ConvertPhysToElemDamageByCalc_6FC59CE0_113c(m, pGame, pMissile, pPlayer, pDmg)
    expect(w3b3.MISSILES_SrvDmg05_DispatchSkillSrvDo_6FC59DA0_113c(m, pGame, pMissile, pPlayer)).toBe(1)

    STATLIST_SetUnitStat113c(m, pPlayer, 6, 50 << 8, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 7, 100 << 8, 0)
    expect(w3b3.MISSILES_SrvDmg14_HolyBoltHeal_6FC59E30_113c(m, pGame, pMissile, pPlayer)).toBe(0)
    expect(w3b3.MISSILES_SrvDmg15_HolyBoltHealOrUndeadFilter_6FC59FD0_113c(m, pGame, pMissile, pPlayer)).toBe(3)

    STATLIST_SetUnitStat113c(m, pMissile, 0x15, 10 << 8, 0)
    STATLIST_SetUnitStat113c(m, pMissile, 0x16, 20 << 8, 0)
    expect(w3b3.MISSILES_PopulateDamageByEType_6FC5A280_113c(m, pMissile, pDmg, 0)).toBeGreaterThanOrEqual(10 << 8)

    const s1 = pSkillsTxt + 1 * 0x23c
    m.setU16(s1 + 0x82, 1)
    expect(w3b3.MISSILES_SrvDmg09_ApplySkillAuraState_6FC5ABD0_113c(m, pGame, pMissile, pPlayer)).toBe(1)

    const pFilterCtx = m.alloc(0x20)
    m.setU32(pFilterCtx + 0x00, pMissile)
    m.setU32(pFilterCtx + 0x04, pGame)
    m.setU32(pFilterCtx + 0x08, m1)
    m.setU32(pFilterCtx + 0x0c, pPlayer)
    expect(w3b3.MISSILES_TargetFilter_PlayersAndAlignedMonsters_6FC5AD70_113c(m, 0, pFilterCtx)).toBe(0)
    expect(w3b3.MISSILES_TargetFilter_MonstersOnly_6FC5ADD0_113c(m, pPlayer, pFilterCtx)).toBe(0)

    expect(w3b3.MISSILES_SrvDmg01_SpawnRandomOffsetSubMissile_6FC5BED0_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(w3b3.MISSILES_SrvDmg02_PlagueJavelin8WaySubMissiles_6FC5C030_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(w3b3.MISSILES_SrvDmg03_SpawnSubMissiles123_6FC5C160_113c(m, pGame, pMissile, 0)).toBe(1)
  })

  it('verifies MISSILES SrvDmg04, Nova64, PoisonCloud, Radial8, AuraCallbacks, SrvDmg10, Ring18, RandomWalkable, Trailing, CircularArea, and Ring16 (24..36)', () => {
    const { m, pSkillsTxt, pMissilesTxt, pGame, pRoom, pPlayer, pMissile, pMissilePath } = createEnv()
    const m1 = pMissilesTxt + 1 * 0x1a4
    m.setU16(m1 + 0x24, 2)
    m.setU32(m1 + 0x4c, 8)
    const m2 = pMissilesTxt + 2 * 0x1a4
    m.setU32(m2 + 0x38, 4)
    m.setU32(m2 + 0x3c, 2)
    const s1 = pSkillsTxt + 1 * 0x23c
    m.setU32(s1 + 0x138, 0)

    expect(w3b3.MISSILES_SrvDmg04_SpawnSubMissileAlongPath_6FC5C260_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(w3b3.MISSILES_SrvDmg12_Nova64RingSubMissiles_6FC5C700_113c(m, pGame, pMissile, 0)).toBe(3)

    MISSILE_SetRemainingFrames113c(m, pMissile, 3)
    expect(w3b3.MISSILES_SrvDmg12B_Nova64RingOnExpire_6FC5C850_113c(m, pGame, pMissile, 0)).toBe(2)
    MISSILE_SetRemainingFrames113c(m, pMissile, 0)
    expect(w3b3.MISSILES_SrvDmg12B_Nova64RingOnExpire_6FC5C850_113c(m, pGame, pMissile, 0)).toBe(3)

    expect(w3b3.MISSILES_SrvDmg13_PoisonExplosionCloud_6FC5C990_113c(m, pGame, pMissile, 0)).toBe(1)
    expect(w3b3.MISSILES_SpawnRadial8SubMissiles_6FC5CB00_113c(m, pMissile, 2, pGame, pPlayer, 1, 2, 2)).toBe(1)

    const pAuraCtx = m.alloc(0x20)
    const pUserCtx = m.alloc(0x20)
    m.setU32(pAuraCtx + 0x00, pGame)
    m.setU32(pAuraCtx + 0x08, 1)
    m.setU32(pAuraCtx + 0x0c, pUserCtx)
    m.setU32(pUserCtx + 0x00, pPlayer)
    m.setU32(pUserCtx + 0x04, pMissile)
    m.setU32(pUserCtx + 0x08, 1)
    m.setU32(pUserCtx + 0x0c, 2)
    m.setU32(pUserCtx + 0x10, 2)
    m.setU32(pUserCtx + 0x14, 2)
    expect(w3b3.MISSILES_AuraCallback_SpawnSubMissileOnTarget_6FC5CC30_113c(m, pAuraCtx, pPlayer)).toBe(1)
    expect(w3b3.MISSILES_AuraCallback_SpawnSubMissileStrictCount_6FC5CD00_113c(m, pAuraCtx, pPlayer)).toBe(1)
    m.setU32(pAuraCtx + 0x08, 2)
    expect(w3b3.MISSILES_AuraCallback_SpawnSubMissileOnTarget_6FC5CC30_113c(m, pAuraCtx, pPlayer)).toBe(0)
    expect(w3b3.MISSILES_AuraCallback_SpawnSubMissileStrictCount_6FC5CD00_113c(m, pAuraCtx, pPlayer)).toBe(0)

    expect(w3b3.MISSILES_SrvDmg10_SpawnSubMissileAtSelfPos_6FC5CDD0_113c(m, pGame, pMissile, 0)).toBe(0)
    w3b3.MISSILES_SpawnRing18SubMissiles_6FC5CEC0_113c(m, pMissile, pGame, 2, 10, 6)

    MISSILE_SetTotalFrames113c(m, pMissile, 10)
    MISSILE_SetRemainingFrames113c(m, pMissile, 6)
    expect(
      w3b3.MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c(m, 2, pMissile, pGame, 2, 2, 0),
    ).toBe(0)

    expect(w3b3.MISSILES_SpawnTrailingSubMissileIfMoved_6FC5D320_113c(m, pMissile, 10, pGame, 2, 5)).toBe(0)
    m.setU32(pMissilePath + 0x3c, 8)
    expect(w3b3.MISSILES_SpawnTrailingSubMissileIfMoved_6FC5D320_113c(m, pMissile, 10, pGame, 2, 5)).toBe(0)

    m.setU32(pRoom + 0x0c, 0)
    w3b3.MISSILES_SpawnCircularAreaSubMissiles_6FC5D450_113c(m, pGame, pMissile, 1, 2, 5)
    expect(
      w3b3.MISSILES_SpawnRing16WithOptionalInnerRingSubMissiles_6FC5D680_113c(
        m,
        pMissile,
        2,
        pGame,
        pPlayer,
        1,
        2,
        4,
        4,
        10,
      ),
    ).toBe(1)
  })

  it('verifies MISSILES SrvDmg29, SrvDmg30, SrvDmg35, SrvDmg36, and SrvDo12..17 (37..45)', () => {
    const { m, pSkillsTxt, pMissilesTxt, pGame, pRoom, pPlayer, pMissile, pMissileData, pMissilePath } = createEnv()
    const m1 = pMissilesTxt + 1 * 0x1a4
    m.setU16(m1 + 0x18, 2)
    m.setU16(m1 + 0x24, 2)
    m.setU16(m1 + 0x26, -1 & 0xffff)
    m.setU16(m1 + 0x28, -1 & 0xffff)
    m.setU16(m1 + 0x2a, -1 & 0xffff)
    m.setU16(m1 + 0x36, 1)
    m.setU32(m1 + 0x38, 4)
    m.setU32(m1 + 0x3c, 2)
    m.setU32(m1 + 0x4c, 1)
    const s1 = pSkillsTxt + 1 * 0x23c
    m.setU16(s1 + 0x82, 2)
    for (let i = 0; i < 6; i++) m.setU16(s1 + 0x54 + i * 2, 0xffff)

    expect(w3b3.MISSILES_SrvDmg29_ApplySkillStateAndAuraStatsCalc1_6FC5E8A0_113c(m, pGame, pMissile, pPlayer)).toBe(3)
    expect(w3b3.MISSILES_SrvDmg30_ApplySkillStateAndAuraStatsCalc4_6FC5EC10_113c(m, pGame, pMissile, pPlayer)).toBe(0)
    expect(w3b3.MISSILES_SrvDmg35_SpawnSubMissilesAndCollide_6FC5F120_113c(m, pGame, pMissile, pPlayer)).toBe(1)
    expect(w3b3.MISSILES_SrvDmg36_SpawnSubMissilesAndCollideRet3_6FC5F220_113c(m, pGame, pMissile, pPlayer)).toBe(3)

    MISSILE_SetTotalFrames113c(m, pMissile, 10)
    MISSILE_SetRemainingFrames113c(m, pMissile, 6)
    m.setU32(pMissileData + 0x18, 0)
    m.setU32(pMissileData + 0x1c, 1)
    expect(w3b3.MISSILES_SrvDo12_RandomWalkStepProjectile_6FC5F890_113c(m, pGame, pMissile)).toBeTypeOf('number')

    m.setU32(pMissilePath + 0x3c, 8)
    expect(w3b3.MISSILES_SrvDo13_SpawnOppositeSubMissilesAlongStep_6FC5F9F0_113c(m, pGame, pMissile)).toBeTypeOf(
      'number',
    )

    m.set(pRoom, D2ActiveRoomStrc.nSubtileWidth, 220)
    m.set(pRoom, D2ActiveRoomStrc.nSubtileHeight, 220)
    MISSILE_SetTargetX113c(m, pMissile, 0)
    MISSILE_SetTargetY113c(m, pMissile, 1)
    MISSILE_SetTotalFrames113c(m, pMissile, 10)
    MISSILE_SetRemainingFrames113c(m, pMissile, 6)
    expect(w3b3.MISSILES_SrvDo15_FollowOwnerAndSpawnRandomSubMissile_6FC5FB40_113c(m, pGame, pMissile)).toBe(1)

    STATLIST_SetUnitStat113c(m, pPlayer, 6, 40 << 8, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 7, 100 << 8, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 8, 30 << 8, 0)
    STATLIST_SetUnitStat113c(m, pPlayer, 9, 100 << 8, 0)
    MISSILE_SetTotalFrames113c(m, pMissile, 10)
    MISSILE_SetRemainingFrames113c(m, pMissile, 6)
    expect(w3b3.MISSILES_SrvDo16_RedemptionManaHealOnFrame_6FC5FD30_113c(m, pGame, pMissile)).toBeTypeOf('number')
    MISSILE_SetTotalFrames113c(m, pMissile, 10)
    MISSILE_SetRemainingFrames113c(m, pMissile, 6)
    expect(w3b3.MISSILES_SrvDo17_RedemptionLifeHealOnFrame_6FC5FED0_113c(m, pGame, pMissile)).toBeTypeOf('number')

    const fnKeys = Object.keys(w3b3).filter((k) => typeof (w3b3 as Record<string, unknown>)[k] === 'function')
    expect(fnKeys.length).toBe(45)
  })
})
