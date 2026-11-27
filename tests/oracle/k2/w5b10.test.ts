import { describe, expect, it } from 'vitest'
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts'
import {
  AI_CastSkillWithModeRandomScatter_6FD12420_113c,
  AI_CircleStrafeTarget_6FD126B0_113c,
  AI_FindTargetOrUnstickOverlap_6FD13150_113c,
  AI_RunFleeFromUnit_6FD12C10_113c,
  AI_RunWanderAroundUnit_6FD12750_113c,
  AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c,
  AI_WalkToLeashDistanceFromUnit_6FD11C30_113c,
  AI_WalkWanderAroundSelf_6FD129B0_113c,
  AI_WalkWanderAroundUnitOrSelf_6FD12870_113c,
  NET_SendMonsterSkillCastPacket4COr4D_6FD134C0_113c,
  NET_SendPacket57MonsterUniqueEnchants_6FD13410_113c,
  OBJECTS_RollScaledByte19C_6FD14260_113c,
} from '../../../src/d2kern-113c/game/k2-w5b10-113c.ts'
import { initD2GameGlobalsInMem113c } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import {
  EVENT_GetNextEventFrame113c,
  EVENT_InitTimerQueue113c,
} from '../../../src/d2kern-113c/game/timer-wheel.ts'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2AiControlStrc_SIZE,
  D2AiGeneralStrc_SIZE,
  D2DynamicPathStrc,
  D2DynamicPathStrc_SIZE,
  D2GameStrc,
  D2GameStrc_SIZE,
  D2MonsterDataStrc,
  D2MonsterDataStrc_SIZE,
  D2UnitStrc,
  D2UnitStrc_SIZE,
} from '../../../src/d2kern-113c/mem/layout.generated.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

function createKernelTestHarness() {
  const m = new SparseMemory113c()
  const pTables = m.alloc(0x1000)
  initD2GameGlobalsInMem113c(m, pTables)

  // MonStats2Txt (stride 0x134) & MonStatsTxt (stride 0x1a8) & SkillsTxt (stride 0x23c)
  const pMonStatsTxt = m.alloc(0x1a8 * 4)
  m.setU32((pTables + 0xa78) >>> 0, pMonStatsTxt)
  m.setU32((pTables + 0xa80) >>> 0, 4)

  const pMonStats2Txt = m.alloc(0x134 * 4)
  m.setU32((pTables + 0xa88) >>> 0, pMonStats2Txt)
  m.setU32((pTables + 0xa90) >>> 0, 4)
  // Enable walk bit (mode 2 -> bit 2 = 0x04) in MonStats2 + 0x08 (`dwModeFlags`)
  m.setU32((pMonStats2Txt + 0x134 * 1 + 0x08) >>> 0, 0xffff)

  const pSkillsTxt = m.alloc(0x23c * 64)
  m.setU32((pTables + 0xb98) >>> 0, pSkillsTxt)
  m.setU32((pTables + 0xba0) >>> 0, 64)

  // ExperienceTxt max skill level pointer (`0x6fdf0b50`)
  const pExpMaxLvl = m.alloc(0x10)
  m.setU32(pExpMaxLvl, 99)
  m.setU32(0x6fdf0b50, pExpMaxLvl)

  const pGame = m.alloc(D2GameStrc_SIZE)
  m.set(pGame, D2GameStrc.dwGameFrame, 100)
  EVENT_InitTimerQueue113c(m, pGame)

  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
  const pRoomCoords = m.alloc(0x40)
  m.setU32((pRoom + 0x0c) >>> 0, pRoomCoords)

  function allocDynamicUnit(unitType: number, classId: number, unitId: number, x: number, y: number) {
    const pUnit = m.alloc(D2UnitStrc_SIZE)
    const pPath = m.alloc(D2DynamicPathStrc_SIZE)
    m.set(pUnit, D2UnitStrc.dwUnitType, unitType)
    m.set(pUnit, D2UnitStrc.dwClassId, classId)
    m.set(pUnit, D2UnitStrc.dwUnitId, unitId)
    m.set(pUnit, D2UnitStrc.dwAnimMode, 1)
    m.set(pUnit, D2UnitStrc.pGame, pGame)
    m.set(pUnit, D2UnitStrc.pPath, pPath)
    m.set(pUnit, D2UnitStrc.seedLo, 0x12345678)
    m.set(pUnit, D2UnitStrc.seedHi, 0x9abcdef0)

    m.set(pPath, D2DynamicPathStrc.pUnit, pUnit)
    m.set(pPath, D2DynamicPathStrc.pRoom, pRoom)
    m.set(pPath, D2DynamicPathStrc.wPosX, x)
    m.set(pPath, D2DynamicPathStrc.wPosY, y)

    if (unitType === 1) {
      const pMonData = m.alloc(D2MonsterDataStrc_SIZE)
      const pAiGen = m.alloc(D2AiGeneralStrc_SIZE)
      const pAiCtrl = m.alloc(D2AiControlStrc_SIZE)
      m.set(pMonData, D2MonsterDataStrc.pMonStatsTxt, pMonStatsTxt + classId * 0x1a8)
      m.set(pMonData, D2MonsterDataStrc.pAiGeneral, pAiGen)
      m.set(pMonData, D2MonsterDataStrc.pAiControl, pAiCtrl)
      m.set(pUnit, D2UnitStrc.pUnitData, pMonData)
    }

    const pSkillList = m.alloc(0x20)
    m.setU32((pUnit + 0xa8) >>> 0, pSkillList)

    return { pUnit, pPath, pSkillList }
  }

  return { m, pTables, pSkillsTxt, pGame, pRoom, allocDynamicUnit }
}

describe('K2 Wave 5 Batch 10 (w5b10): D2Game 0x6FD11C30..0x6FD14260', () => {
  it('[1/12] AI_WalkToLeashDistanceFromUnit_6FD11C30_113c interpolates ray coordinates and starts walk mode', () => {
    const { m, pGame, allocDynamicUnit } = createKernelTestHarness()
    const leader = allocDynamicUnit(1, 1, 10, 100, 200)
    const minion = allocDynamicUnit(1, 1, 11, 100, 200)

    // Same position -> approximate distance 0 -> returns 0
    expect(
      AI_WalkToLeashDistanceFromUnit_6FD11C30_113c(m, leader.pUnit, minion.pUnit, pGame, 6),
    ).toBe(0)

    // Move minion to (110, 200): distance = 10, leash = 5 -> target = (105, 200)
    m.set(minion.pPath, D2DynamicPathStrc.wPosX, 110)
    const fakeSkill = m.alloc(0x40)
    m.setU32((minion.pSkillList + 0x10) >>> 0, fakeSkill)

    const res = AI_WalkToLeashDistanceFromUnit_6FD11C30_113c(
      m,
      leader.pUnit,
      minion.pUnit,
      pGame,
      5,
    )
    expect(res).toBe(1)
    expect(m.u32((minion.pSkillList + 0x10) >>> 0)).toBe(0)
    expect(m.get(minion.pUnit, D2UnitStrc.dwAnimMode)).toBe(2)
    expect(m.get(minion.pPath, D2DynamicPathStrc.wTargetX)).toBe(105)
    expect(m.get(minion.pPath, D2DynamicPathStrc.wTargetY)).toBe(200)
  })

  it('[2/12] AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c preserves earlier timer and replaces later timer', () => {
    const { m, pGame, allocDynamicUnit } = createKernelTestHarness()
    const mon = allocDynamicUnit(1, 1, 12, 50, 50)

    // No pending event -> schedules at 100 + 20 = 120
    AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, pGame, mon.pUnit, 20)
    expect(EVENT_GetNextEventFrame113c(m, mon.pUnit, 2)).toBe(120)

    // Requesting delay 30 (target 130 > 120) preserves existing frame 120
    AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, pGame, mon.pUnit, 30)
    expect(EVENT_GetNextEventFrame113c(m, mon.pUnit, 2)).toBe(120)

    // Requesting delay 5 (target 105 < 120) frees 120 and schedules 105
    AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, pGame, mon.pUnit, 5)
    expect(EVENT_GetNextEventFrame113c(m, mon.pUnit, 2)).toBe(105)

    // Delay 0 defaults to 1 (target 101 < 105)
    AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c(m, pGame, mon.pUnit, 0)
    expect(EVENT_GetNextEventFrame113c(m, mon.pUnit, 2)).toBe(101)
  })

  it('[3/12] AI_CastSkillWithModeRandomScatter_6FD12420_113c rolls scatter target and initiates skill mode', () => {
    const { m, pSkillsTxt, allocDynamicUnit } = createKernelTestHarness()
    const caster = allocDynamicUnit(1, 1, 13, 80, 90)

    // Attach skill 36 (Firebolt) to caster's skill list
    const pSkill = m.alloc(0x40)
    const pFireboltTxt = (pSkillsTxt + 36 * 0x23c) >>> 0
    m.setU16(pFireboltTxt, 36)
    m.setU32(pSkill, pFireboltTxt)
    m.setU32((pSkill + 0x28) >>> 0, 4)
    m.setU32((pSkill + 0x34) >>> 0, 0xffffffff)
    m.setU32(caster.pSkillList, pSkill)

    let capturedX = 0
    let capturedY = 0
    let capturedMode = -1
    const res = AI_CastSkillWithModeRandomScatter_6FD12420_113c(m, caster.pUnit, 6, 36, 8, {
      onMonsterStartMode: (mem, _g, sp) => {
        capturedMode = mem.u32(sp) | 0
        capturedX = mem.u32((sp + 0x0c) >>> 0) | 0
        capturedY = mem.u32((sp + 0x10) >>> 0) | 0
        return 1
      },
    })
    expect(res).toBe(1)
    expect(capturedMode).toBe(8)
    expect(capturedX).toBeGreaterThanOrEqual(74)
    expect(capturedX).toBeLessThan(86)
    expect(capturedY).toBeGreaterThanOrEqual(84)
    expect(capturedY).toBeLessThan(96)
    expect((m.u32((caster.pUnit + 0xc4) >>> 0) & 0x40) !== 0).toBe(true)
  })

  it('[4/12] AI_CircleStrafeTarget_6FD126B0_113c sets pathType 5/6 and clamps bNewDist at 0x4D', () => {
    const { m, pGame, allocDynamicUnit } = createKernelTestHarness()
    const mon = allocDynamicUnit(1, 1, 14, 40, 40)
    const player = allocDynamicUnit(0, 0, 1, 50, 50)

    const res = AI_CircleStrafeTarget_6FD126B0_113c(m, mon.pUnit, 1, pGame, player.pUnit, 0x70)
    expect(res).toBe(1)

    const pMonData = m.get(mon.pUnit, D2UnitStrc.pUnitData)
    const pAiCtrl = m.get(pMonData, D2MonsterDataStrc.pAiControl)
    const pathType = m.u32((pAiCtrl + 0x18) >>> 0)
    expect(pathType === 5 || pathType === 6).toBe(true)
    expect(m.u8((pAiCtrl + 0x20) >>> 0)).toBe(0x4d)
    expect(m.get(mon.pUnit, D2UnitStrc.dwAnimMode)).toBe(2)
  })

  it('[5/12..7/12] RunWanderAroundUnit, WalkWanderAroundUnitOrSelf, and WalkWanderAroundSelf step 4 LCG draws', () => {
    const { m, pGame, allocDynamicUnit } = createKernelTestHarness()
    const origin = allocDynamicUnit(1, 1, 15, 200, 300)
    const runner = allocDynamicUnit(1, 1, 16, 210, 310)

    // [5/12] 0x6FD12750: run wander around origin in mode 15
    const r5 = AI_RunWanderAroundUnit_6FD12750_113c(m, origin.pUnit, 7, pGame, runner.pUnit)
    expect(r5).toBe(1)
    expect(m.get(runner.pUnit, D2UnitStrc.dwAnimMode)).toBe(15)
    const tx5 = m.get(runner.pPath, D2DynamicPathStrc.wTargetX)
    const ty5 = m.get(runner.pPath, D2DynamicPathStrc.wTargetY)
    expect(Math.abs(tx5 - 200) === 7 || Math.abs(ty5 - 300) === 7).toBe(true)

    // [6/12] 0x6FD12870: walk wander with pOriginUnit == 0 falls back to self range 2
    const walker = allocDynamicUnit(1, 1, 17, 150, 250)
    const r6Fallback = AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(m, 0, 9, pGame, walker.pUnit)
    expect(r6Fallback).toBe(1)
    expect(m.get(walker.pUnit, D2UnitStrc.dwAnimMode)).toBe(2)
    const tx6a = m.get(walker.pPath, D2DynamicPathStrc.wTargetX)
    const ty6a = m.get(walker.pPath, D2DynamicPathStrc.wTargetY)
    expect(Math.abs(tx6a - 150) === 2 || Math.abs(ty6a - 250) === 2).toBe(true)

    // [6/12] 0x6FD12870: walk wander around explicit origin with range 6
    const r6Origin = AI_WalkWanderAroundUnitOrSelf_6FD12870_113c(
      m,
      origin.pUnit,
      6,
      pGame,
      walker.pUnit,
    )
    expect(r6Origin).toBe(1)
    const tx6b = m.get(walker.pPath, D2DynamicPathStrc.wTargetX)
    const ty6b = m.get(walker.pPath, D2DynamicPathStrc.wTargetY)
    expect(Math.abs(tx6b - 200) === 6 || Math.abs(ty6b - 300) === 6).toBe(true)

    // [7/12] 0x6FD129B0: walk wander around self with range 4
    const selfWalker = allocDynamicUnit(1, 1, 18, 120, 140)
    const r7 = AI_WalkWanderAroundSelf_6FD129B0_113c(m, 4, pGame, selfWalker.pUnit)
    expect(r7).toBe(1)
    expect(m.get(selfWalker.pUnit, D2UnitStrc.dwAnimMode)).toBe(2)
    const tx7 = m.get(selfWalker.pPath, D2DynamicPathStrc.wTargetX)
    const ty7 = m.get(selfWalker.pPath, D2DynamicPathStrc.wTargetY)
    expect(Math.abs(tx7 - 120) === 4 || Math.abs(ty7 - 140) === 4).toBe(true)
  })

  it('[8/12] AI_RunFleeFromUnit_6FD12C10_113c flees along sign vector and updates bNewDist when > 5', () => {
    const { m, pGame, allocDynamicUnit } = createKernelTestHarness()
    const threat = allocDynamicUnit(0, 0, 1, 90, 130)
    const coward = allocDynamicUnit(1, 1, 19, 100, 120)

    // unit=(100,120), from=(90,130) -> sx=+1, sy=-1; dist=12 -> target=(112, 108)
    const res = AI_RunFleeFromUnit_6FD12C10_113c(m, threat.pUnit, coward.pUnit, pGame, 12, 1)
    expect(res).toBe(1)
    expect(m.get(coward.pUnit, D2UnitStrc.dwAnimMode)).toBe(15)
    expect(m.get(coward.pPath, D2DynamicPathStrc.wTargetX)).toBe(112)
    expect(m.get(coward.pPath, D2DynamicPathStrc.wTargetY)).toBe(108)

    const pMonData = m.get(coward.pUnit, D2UnitStrc.pUnitData)
    const pAiCtrl = m.get(pMonData, D2MonsterDataStrc.pAiControl)
    expect(m.u8((pAiCtrl + 0x20) >>> 0)).toBe(12)
  })

  it('[9/12] AI_FindTargetOrUnstickOverlap_6FD13150_113c resolves nearby player or schedules 20-frame AI timer', () => {
    const { m, pGame, pRoom, allocDynamicUnit } = createKernelTestHarness()
    const mon = allocDynamicUnit(1, 1, 20, 60, 60)
    const pMonData = m.get(mon.pUnit, D2UnitStrc.pUnitData)
    const pAiCtrl = m.get(pMonData, D2MonsterDataStrc.pAiControl)
    m.setU16((pAiCtrl + 0x08) >>> 0, 0x0040)

    // Set up empty collision grid on pRoom so unengaged check runs cleanly
    const pCollGrid = m.alloc(0x40)
    const pCollMaskBuf = m.alloc(0x200)
    m.setU32((pRoom + 0x14) >>> 0, pCollGrid)
    m.setU32(pCollGrid, 50)
    m.setU32((pCollGrid + 0x04) >>> 0, 50)
    m.setU32((pCollGrid + 0x08) >>> 0, 20)
    m.setU32((pCollGrid + 0x0c) >>> 0, 20)
    m.setU32((pCollGrid + 0x24) >>> 0, pCollMaskBuf)

    const pOutMelee = m.alloc(4)
    const pOutDist = m.alloc(4)

    // Unengaged: no player in room -> schedules AI think timer at 100 + 20 = 120 and returns 0
    const noTarget = AI_FindTargetOrUnstickOverlap_6FD13150_113c(
      m,
      pOutMelee,
      pOutDist,
      pAiCtrl,
      pGame,
      mon.pUnit,
    )
    expect(noTarget).toBe(0)
    expect((m.u16((pAiCtrl + 0x08) >>> 0) & 0x40) === 0).toBe(true)
    expect(EVENT_GetNextEventFrame113c(m, mon.pUnit, 2)).toBe(120)

    // Add an alive player to pRoom.pUnitFirst within melee range
    const player = allocDynamicUnit(0, 0, 1, 61, 60)
    m.set(pRoom, D2ActiveRoomStrc.pUnitFirst, player.pUnit)

    const foundTarget = AI_FindTargetOrUnstickOverlap_6FD13150_113c(
      m,
      pOutMelee,
      pOutDist,
      pAiCtrl,
      pGame,
      mon.pUnit,
    )
    expect(foundTarget).toBe(player.pUnit)
    expect(m.u32(pOutMelee)).toBe(1)
    expect(m.u32(pOutDist)).toBe(1)
    expect((m.u8((pAiCtrl + 0x08) >>> 0) & 0x08) !== 0).toBe(true)
  })

  it('[10/12] NET_SendPacket57MonsterUniqueEnchants_6FD13410_113c serializes 14-byte S2C 0x57 packet', () => {
    const { m, allocDynamicUnit } = createKernelTestHarness()
    const boss = allocDynamicUnit(1, 1, 0x11223344, 70, 70)
    const pMonData = m.get(boss.pUnit, D2UnitStrc.pUnitData)

    const pClient = m.alloc(0x200)
    const pQueue = m.alloc(0x40c)
    m.setU32((pClient + 0x1bc) >>> 0, pQueue)

    // Flag bit 0 at +0x5C clear -> no packet queued
    NET_SendPacket57MonsterUniqueEnchants_6FD13410_113c(m, boss.pUnit, pClient)
    expect(m.u32((pQueue + 0x00) >>> 0)).toBe(0)

    // Populate unique name, champion bit, enchants, and +0x5C flag
    m.setU16((pMonData + 0x14) >>> 0, 0x01ab)
    m.setU8((pMonData + 0x16) >>> 0, 0x04) // (0x04 >> 2) & 1 == 1
    m.setU8((pMonData + 0x1c) >>> 0, 5)
    m.setU8((pMonData + 0x1d) >>> 0, 9)
    m.setU8((pMonData + 0x1e) >>> 0, 27)
    m.setU8((pMonData + 0x5c) >>> 0, 1)

    NET_SendPacket57MonsterUniqueEnchants_6FD13410_113c(m, boss.pUnit, pClient)
    expect(m.u32((pQueue + 0x00) >>> 0)).toBe(14)

    const pkt = (pQueue + 0x04) >>> 0
    expect(m.u8(pkt)).toBe(0x57)
    expect(m.u32((pkt + 0x01) >>> 0)).toBe(0x11223344)
    expect(m.u8((pkt + 0x05) >>> 0)).toBe(1)
    expect(m.u16((pkt + 0x06) >>> 0)).toBe(0x01ab)
    expect(m.u8((pkt + 0x08) >>> 0)).toBe(5)
    expect(m.u8((pkt + 0x09) >>> 0)).toBe(9)
    expect(m.u16((pkt + 0x0a) >>> 0)).toBe(27)
    expect(m.u16((pkt + 0x0c) >>> 0)).toBe(1)
  })

  it('[11/12] NET_SendMonsterSkillCastPacket4COr4D_6FD134C0_113c sends 0x4D ground packet or 0x4C unit packet', () => {
    const { m, pGame, pRoom, pSkillsTxt, allocDynamicUnit } = createKernelTestHarness()
    const caster = allocDynamicUnit(1, 1, 0x55667788, 100, 110)
    m.set(caster.pPath, D2DynamicPathStrc.wTargetX, 123)
    m.set(caster.pPath, D2DynamicPathStrc.wTargetY, 456)

    // Equip used skill (ID 47 = Fireball, level 7)
    const pSkill = m.alloc(0x40)
    const pFireballTxt = (pSkillsTxt + 47 * 0x23c) >>> 0
    m.setU16(pFireballTxt, 47)
    m.setU32(pSkill, pFireballTxt)
    m.setU32((pSkill + 0x28) >>> 0, 7)
    m.setU32((pSkill + 0x34) >>> 0, 0) // non-0xffffffff skips stat bonus lookup
    m.setU32((caster.pSkillList + 0x10) >>> 0, pSkill)

    const pClient = m.alloc(0x200)
    const pQueue = m.alloc(0x40c)
    m.setU32((pClient + 0x1a8) >>> 0, pGame)
    m.setU32((pClient + 0x1bc) >>> 0, pQueue)

    // Case A: pTargetUnit == 0 -> queues 17-byte 0x4D ground packet
    NET_SendMonsterSkillCastPacket4COr4D_6FD134C0_113c(m, caster.pUnit, pClient, 0)
    expect(m.u32((pQueue + 0x00) >>> 0)).toBe(17)
    const pkt4d = (pQueue + 0x04) >>> 0
    expect(m.u8(pkt4d)).toBe(0x4d)
    expect(m.u8((pkt4d + 0x01) >>> 0)).toBe(1)
    expect(m.u32((pkt4d + 0x02) >>> 0)).toBe(0x55667788)
    expect(m.u32((pkt4d + 0x06) >>> 0)).toBe(47)
    expect(m.u8((pkt4d + 0x0a) >>> 0)).toBe(7)
    expect(m.u16((pkt4d + 0x0b) >>> 0)).toBe(123)
    expect(m.u16((pkt4d + 0x0d) >>> 0)).toBe(456)
    expect(m.u16((pkt4d + 0x0f) >>> 0)).toBe(0)

    // Case B: pTargetUnit in pRoom whose ppClients contains pClient -> delegates to 16-byte 0x4C packet
    m.setU32((pQueue + 0x00) >>> 0, 0)
    const target = allocDynamicUnit(0, 0, 99, 130, 140)
    const ppClients = m.alloc(8)
    m.setU32(ppClients, pClient)
    m.setU32((pRoom + 0x48) >>> 0, ppClients)
    m.setU32((pRoom + 0x78) >>> 0, 1)

    NET_SendMonsterSkillCastPacket4COr4D_6FD134C0_113c(m, caster.pUnit, pClient, target.pUnit)
    expect(m.u32((pQueue + 0x00) >>> 0)).toBe(16)
    const pkt4c = (pQueue + 0x04) >>> 0
    expect(m.u8(pkt4c)).toBe(0x4c)
    expect(m.u8((pkt4c + 0x01) >>> 0)).toBe(1)
    expect(m.u32((pkt4c + 0x02) >>> 0)).toBe(0x55667788)
    expect(m.u16((pkt4c + 0x06) >>> 0)).toBe(47)
    expect(m.u8((pkt4c + 0x08) >>> 0)).toBe(7)
    expect(m.u8((pkt4c + 0x09) >>> 0)).toBe(0)
    expect(m.u32((pkt4c + 0x0a) >>> 0)).toBe(99)
  })

  it('[12/12] OBJECTS_RollScaledByte19C_6FD14260_113c scales ObjectsTxt+0x19C and asserts on invalid bounds/zero', () => {
    const m = new SparseMemory113c()
    const pObjectsTxt = m.alloc(0x1c0 * 4)
    m.setU32(0x6fdf0b94, pObjectsTxt)
    m.setU32(0x6fdf0b98, 4)

    // Object class 2: bByte19C = 50
    m.setU8((pObjectsTxt + 2 * 0x1c0 + 0x19c) >>> 0, 50)

    const pObj = m.alloc(D2UnitStrc_SIZE)
    m.set(pObj, D2UnitStrc.dwUnitType, 2)
    m.set(pObj, D2UnitStrc.dwClassId, 2)
    m.set(pObj, D2UnitStrc.seedLo, 0xabcdef01)
    m.set(pObj, D2UnitStrc.seedHi, 0x10203040)

    // nMinPct > nMaxPct -> D2CommonAssertError line 20 (0x14)
    expect(() => OBJECTS_RollScaledByte19C_6FD14260_113c(m, 100, 200, pObj)).toThrow(
      D2CommonAssertError,
    )

    // Valid roll in [200, 200 + 256) = [200, 455] -> 50 * pct / 100 in [100, 227]
    const scaled = OBJECTS_RollScaledByte19C_6FD14260_113c(m, 200, 200, pObj)
    expect(scaled).toBeGreaterThanOrEqual(100)
    expect(scaled).toBeLessThanOrEqual(227)

    // Object class 3: bByte19C = 0 -> D2CommonAssertError line 27 (0x1b)
    m.set(pObj, D2UnitStrc.dwClassId, 3)
    expect(() => OBJECTS_RollScaledByte19C_6FD14260_113c(m, 100, 100, pObj)).toThrow(
      D2CommonAssertError,
    )
  })
})
