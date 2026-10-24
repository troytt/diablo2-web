/**
 * D2GS S->C Skill List, Active Skill, and Skill Cast Packet Decoders (1.13c).
 * Verified against D2Client.dll:
 * - 0x21 UpdateSkill (12B, 0x6fb5c910)
 * - 0x22 UpdateSkillStatus / ItemSkillBonus (12B, 0x6fb5c800)
 * - 0x23 AssignSkill (13B, 0x6fb5c780)
 * - 0x4C UnitUseSkillOnTarget (16B, 0x6fb5f1d0)
 * - 0x4D UnitUseSkill (17B, 0x6fb5f160)
 * - 0x6C NPCAttack (16B, 0x6fb5f750)
 * - 0x7B AssignSkillHotkey (8B, 0x6fb5c6d0)
 * - 0x94 BaseSkillLevels (variable 6 + 3*pkt[1], 0x6fb5c880)
 * - 0x99 SkillTriggeredOnTarget (16B, 0x6fb5f0f0)
 * - 0x9A SkillTriggeredOnLocation (17B, 0x6fb5f090)
 */

import { ByteReader } from '../../core/byte-reader.ts'
import { type Hand, type SkillLevel, unitTypeToId } from '../../domain/ids.ts'
import type { ServerEvent } from '../../domain/server-event.ts'
import { requirePacketLength } from './packet-length.ts'
import { resolveMonsterCmdMode } from './units.ts'

/**
 * 0x21 UpdateSkill (12B, D2Client.dll 0x6fb5c910):
 * [0x21, u8 unitType, u8 flag, u32LE unitId, u16LE skillId, u8 baseLevel, u8 pad10, u8 pad11].
 * Bytes 10..11 are uninitialized server stack padding and must be ignored.
 */
export function decode0x21UpdateSkill(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x21
  const unitType = unitTypeToId(r.u8()) // unitType
  const flag = r.u8() // flag
  const unitId = r.u32LE()
  const skill = r.u16LE()
  const baseLevel = r.u8()
  const pad10 = r.u8()
  const flag11 = r.u8()
  return {
    type: 'SkillList',
    unitId,
    unitType,
    flag: flag || flag11 || pad10,
    skills: [{ skillId: skill, level: baseLevel, baseLevel, bonus: 0 }],
  }
}

/** 0x22 UpdateSkillStatus (12B, D2Client.dll 0x6fb5c800) */
export function decode0x22UpdateSkillStatus(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x22
  const unitType = unitTypeToId(r.u8())
  const flag2 = r.u8()
  const unitId = r.u32LE()
  const skill = r.u16LE()
  const quantity = r.u8()
  const flag10 = r.u8()
  r.u8()
  return {
    type: 'SkillList',
    unitId,
    unitType,
    flag: flag10 || flag2,
    skills: [{ skillId: skill, level: quantity, quantity } as any],
    quantity,
    isSkillStatus: true,
  } as ServerEvent
}

/** 0x23 AssignSkill (13B, D2Client.dll 0x6fb5c780) */
export function decode0x23AssignSkill(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x23
  r.u8() // unitType (0)
  const unitId = r.u32LE()
  const handByte = r.u8()
  const skill = r.u16LE()
  const itemId = r.u32LE()
  const hand: Hand = handByte === 0 ? 'right' : 'left'
  return {
    type: 'ActiveSkill',
    unitId,
    hand,
    skill,
    itemId,
  }
}

/** 0x4C UnitUseSkillOnTarget (16B, D2Client.dll 0x6fb5f1d0) */
export function decode0x4CSkillOnTarget(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x4C
  const casterType = unitTypeToId(r.u8())
  const casterId = r.u32LE()
  const skill = r.u16LE()
  const level = r.u8()
  const targetType = unitTypeToId(r.u8())
  const targetId = r.u32LE()
  r.u16LE()
  return {
    type: 'SkillCast',
    caster: { unitType: casterType, id: casterId },
    skill,
    level,
    target: { unitType: targetType, id: targetId },
  }
}

/** 0x4D UnitUseSkill (17B, D2Client.dll 0x6fb5f160) */
export function decode0x4DSkillOnLocation(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x4D
  const casterType = unitTypeToId(r.u8())
  const casterId = r.u32LE()
  const skill = r.u32LE() & 0xffff
  const level = r.u8()
  const x = r.u16LE()
  const y = r.u16LE()
  r.u16LE()
  return {
    type: 'SkillCast',
    caster: { unitType: casterType, id: casterId },
    skill,
    level,
    target: { x, y },
  }
}

/**
 * 0x6C NPCAttack (16B, D2Client.dll 0x6fb5f750, D2MOO MonsterMsg.cpp:318-325): drift check at
 * (u16 @0C, u16 @0E) (0x6FB5F76A), then the 0x6A builder `s = {target type @06, target id @07,
 * u8 @0B, 2, 0, 4, <uninitialised>}`. Byte @0B is the command's s2 argument, not a direction.
 */
export function decode0x6CNpcAttack(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x6C NPCAttack', 16)
  const r = new ByteReader(pkt)
  r.u8() // 0x6C
  const id = r.u32LE()
  const rawCmd = r.u8()
  const rawTargetType = r.u8()
  const targetId = r.u32LE()
  const b0B = r.u8()
  const x = r.u16LE()
  const y = r.u16LE()
  const mode = resolveMonsterCmdMode(rawCmd)
  return {
    type: 'UnitMode',
    unitType: 1,
    id,
    mode,
    npc: {
      opcode: 0x6c,
      cmd: rawCmd,
      s: [rawTargetType, targetId, b0B, 2, 0, 4, null],
      driftCheckAt: { x, y },
    },
  }
}

/** 0x7B AssignSkillHotkey (8B, D2Client.dll 0x6fb5c6d0) */
export function decode0x7BAssignSkillHotkey(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x7B
  const slot = r.u8()
  const skill = r.u8() | ((r.u8() & 0x7f) << 8)
  const hand: Hand = (pkt[3]! & 0x80) !== 0 ? 'left' : 'right'
  const itemId = r.u32LE()
  return {
    type: 'ActiveSkill',
    unitId: slot,
    hand,
    skill,
    itemId,
    slot,
    isHotkey: true,
  } as ServerEvent
}

/** 0x94 BaseSkillLevels (variable 6 + 3 * pkt[1], D2Client.dll 0x6fb5c880) */
export function decode0x94BaseSkillLevels(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x94
  const count = r.u8()
  const unitId = r.u32LE()
  const skills: SkillLevel[] = []
  for (let i = 0; i < count && r.remaining >= 3; i++) {
    const skillId = r.u16LE()
    const level = r.u8()
    skills.push({ skillId, level })
  }
  return {
    type: 'SkillList',
    unitId,
    skills,
  }
}

/** 0x99 SkillTriggeredOnTarget (16B, D2Client.dll 0x6fb5f0f0) */
export function decode0x99SkillTriggeredOnTarget(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x99
  const casterType = unitTypeToId(r.u8())
  const casterId = r.u32LE()
  const targetType = unitTypeToId(r.u8())
  const targetId = r.u32LE()
  const skill = r.u16LE()
  const level = r.u8()
  r.u16LE()
  return {
    type: 'SkillCast',
    caster: { unitType: casterType, id: casterId },
    skill,
    level,
    target: { unitType: targetType, id: targetId },
  }
}

/** 0x9A SkillTriggeredOnLocation (17B, D2Client.dll 0x6fb5f090) */
export function decode0x9ASkillTriggeredOnLocation(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x9A
  const casterType = unitTypeToId(r.u8())
  const casterId = r.u32LE()
  const x = r.u16LE()
  const y = r.u16LE()
  r.u16LE()
  const skill = r.u16LE()
  const level = r.u8()
  r.u16LE()
  return {
    type: 'SkillCast',
    caster: { unitType: casterType, id: casterId },
    skill,
    level,
    target: { x, y },
  }
}
