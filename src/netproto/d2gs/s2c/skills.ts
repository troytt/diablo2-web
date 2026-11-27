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
import { type Hand, type SkillLevel, wireUnitTypeId } from '../../domain/ids.ts'
import type { ServerEvent } from '../../domain/server-event.ts'
import { requirePacketLength, unitLookupMiss } from './packet-length.ts'
import { resolveMonsterCmdMode } from './units.ts'

/**
 * 0x21 UpdateSkill (12B, D2Client.dll 0x6fb5c910):
 * [0x21, u8 unitType, u8 flag, u32LE unitId, u16LE skillId, u8 baseLevel, u8 pad10, u8 pad11].
 * D2Client passes only `@2` as the flag argument to `0x6FABC550`; bytes 10..11 are uninitialized server
 * stack padding and are never read (#1654).
 */
export function decode0x21UpdateSkill(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x21
  const unitTypeRaw = r.u8()
  const unitType = wireUnitTypeId(unitTypeRaw)
  if (unitType === undefined) return unitLookupMiss(pkt) // #1656: D2Client unit lookup fails // unitType
  const flag = r.u8() // flag @2
  const unitId = r.u32LE()
  const skill = r.u16LE()
  const baseLevel = r.u8()
  return {
    type: 'SkillList',
    unitId,
    unitType,
    flag,
    skills: [{ skillId: skill, level: baseLevel, baseLevel, bonus: 0 }],
  }
}

/**
 * 0x22 UpdateSkillStatus (12B, D2Client.dll 0x6fb5c800):
 * [0x22, u8 unitType, u8 ?, u32LE unitId, u16LE skillId, u8 quantity, u8 ?, u8 playerBodySkip].
 * D2Game builder `0x6FCAD570` sets `@0xB = 1` when the unit has state 7 (`playerbody`, D2Common #10494)
 * and never writes `@2` / `@0xA` (uninitialized stack bytes). D2Client starts with
 * `mov al,[esi+0xb]; test al,al; jne return`, so the whole packet is ignored when `@0xB != 0`; otherwise it
 * sets the skill quantity (`@9`) on the player looked up by `@3` (#1654).
 */
export function decode0x22UpdateSkillStatus(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x22 UpdateSkillStatus', 12)
  const r = new ByteReader(pkt)
  r.u8() // 0x22
  r.u8() // @1: never read; D2Client looks the unit up in the player table only (0x6fb5c816, #1656)
  const unitType = 0 as const
  r.u8() // @2: never written by D2Game, never read by D2Client
  const unitId = r.u32LE()
  const skill = r.u16LE()
  const quantity = r.u8()
  r.u8() // @0xA: never written by D2Game, never read by D2Client
  const playerBodySkip = r.u8() !== 0
  return {
    type: 'SkillList',
    unitId,
    unitType,
    skills: playerBodySkip ? [] : [{ skillId: skill, level: quantity, quantity } as any],
    quantity,
    isSkillStatus: true,
    playerBodySkip,
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
  const casterTypeRaw = r.u8()
  const casterType = wireUnitTypeId(casterTypeRaw)
  if (casterType === undefined) return unitLookupMiss(pkt) // #1656: D2Client unit lookup fails
  const casterId = r.u32LE()
  const skill = r.u16LE()
  const level = r.u8()
  // D2Client 0x6fb5f1d0 copies target type @9 / id @10 into unit command 0x16 unchecked; a type outside 0..5 can
  // never resolve and `SkillCast` has no unresolvable-unit target, so the packet is dropped (#1656).
  const targetType = wireUnitTypeId(r.u8())
  if (targetType === undefined) return unitLookupMiss(pkt)
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
  const casterTypeRaw = r.u8()
  const casterType = wireUnitTypeId(casterTypeRaw)
  if (casterType === undefined) return unitLookupMiss(pkt) // #1656: D2Client unit lookup fails
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

/** Skills.txt data rows in 1.13c (`sgptDataTables->nSkillsTxtRecordCount`, ids 0..356). */
export const SKILLS_TXT_ROW_COUNT_113C = 357

/**
 * 0x7B AssignSkillHotkey (8B, D2Client.dll 0x6fb5c6d0): `[1]` slot, `[2..3]` u16 skill word, `[4..7]` itemId.
 * The skill id is `word & 0xFFF` and becomes -1 (unbound) when it exceeds the Skills.txt record count
 * (`and eax, 0xfff; cmp eax, [+0xBA0]; jle; or eax, -1` — note `jle`: an id equal to the count is kept);
 * bit 15 (`and edx, 0x8000`) selects the left hand.
 */
export function decode0x7BAssignSkillHotkey(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x7B
  const slot = r.u8()
  const word = r.u16LE()
  const masked = word & 0xfff
  const skill = masked > SKILLS_TXT_ROW_COUNT_113C ? -1 : masked
  const hand: Hand = (word & 0x8000) !== 0 ? 'left' : 'right'
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

/**
 * 0x99 SkillTriggeredOnTarget (16B, D2Client.dll 0x6fb5f0f0). Same wire layout as 0x4C: D2Game.dll
 * 0x6fcad210 builds both (`sete al; dec al; and al,0x4d; add al,0x4c` -> 0x4C or 0x99):
 * [1] casterType, [2..5] casterId, [6..7] skill, [8] level, [9] targetType, [10..13] targetId, [14..15] u16.
 * The client reads skill @6 (`movzx ecx, word [edi+6]`), level @8, target @9/@10 and calls 0x6fb79030.
 */
export function decode0x99SkillTriggeredOnTarget(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x99 SkillTriggeredOnTarget', 16)
  const r = new ByteReader(pkt)
  r.u8() // 0x99
  const casterTypeRaw = r.u8()
  const casterType = wireUnitTypeId(casterTypeRaw)
  if (casterType === undefined) return unitLookupMiss(pkt) // #1656: D2Client unit lookup fails
  const casterId = r.u32LE()
  const skill = r.u16LE()
  const level = r.u8()
  const targetType = wireUnitTypeId(r.u8())
  if (targetType === undefined) return unitLookupMiss(pkt) // #1656: target lookup 0x6fb5f12b fails -> return
  const targetId = r.u32LE()
  r.u16LE()
  return {
    type: 'SkillCast',
    caster: { unitType: casterType, id: casterId },
    skill,
    level,
    target: { unitType: targetType, id: targetId },
    triggered: true,
  }
}

/**
 * 0x9A SkillTriggeredOnLocation (17B, D2Client.dll 0x6fb5f090). Same wire layout as 0x4D: D2Game.dll
 * 0x6fc9ae67..0x6fc9aeaf writes [1] casterType, [2..5] casterId, [6..9] skill (dword), [10] level,
 * [11..12] x, [13..14] y, [15..16] u16. The client skips the packet when x or y is 0 (0x6fb5f0b9 / 0x6fb5f0c1).
 */
export function decode0x9ASkillTriggeredOnLocation(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x9A SkillTriggeredOnLocation', 17)
  const r = new ByteReader(pkt)
  r.u8() // 0x9A
  const casterTypeRaw = r.u8()
  const casterType = wireUnitTypeId(casterTypeRaw)
  if (casterType === undefined) return unitLookupMiss(pkt) // #1656: D2Client unit lookup fails
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
    triggered: true,
  }
}
