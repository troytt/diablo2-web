/**
 * D2GS C->S Skill & Attribute Allocation Packet Builders (0x05..0x11, 0x3A..0x3C, 1.13c).
 *
 * All twelve skill-use opcodes are emitted by ONE client function,
 * `1.13c D2Client 0x6faca060 SendSkillPacket(bOnUnit, ClickInfo*)`. The opcode is a pure function of
 * (button, unit-vs-location, ClickInfo flag 0x20 "stand still/shift", ClickInfo flag 0x8 "hold"):
 *
 * | Button | Target   | Shift (0x20) | Hold (0x8) | Opcode | 1.13c D2Client site |
 * |--------|----------|--------------|------------|--------|---------------------|
 * | L      | unit     | yes          | yes        | 0x0A   | 0x6faca15f          |
 * | L      | unit     | yes          | no         | 0x07   | 0x6faca25d          |
 * | L      | unit     | no           | yes        | 0x09   | 0x6faca35e          |
 * | L      | unit     | no           | no         | 0x06   | 0x6faca3ab          |
 * | R      | unit     | yes          | yes        | 0x11   | 0x6faca470          |
 * | R      | unit     | yes          | no         | 0x0E   | 0x6faca519          |
 * | R      | unit     | no           | yes        | 0x10   | 0x6faca61a          |
 * | R      | unit     | no           | no         | 0x0D   | 0x6faca70b          |
 * | L      | location | ignored      | yes        | 0x08   | 0x6faca838          |
 * | L      | location | ignored      | no         | 0x05   | 0x6faca886          |
 * | R      | location | ignored      | yes        | 0x0F   | 0x6faca94f          |
 * | R      | location | ignored      | no         | 0x0C   | 0x6facaa4a          |
 *
 * Location packets have NO shift variant: 0x08/0x0F mean "held", not "shift".
 * Packet sizes follow the D2Net table (`0x6fbfabd8`, mirrored by D2Client 0x6fad9fa0): unit = 9 B,
 * location = 5 B.
 */

import { ByteWriter } from '../../core/byte-writer.ts'
import { unitTypeToId, type Hand, type Pt, type UnitRef } from '../../domain/ids.ts'
import { validateC2sPacket } from '../framing-c2s.ts'

/**
 * Resolves the location skill opcode per `1.13c D2Client 0x6faca060 SendSkillPacket` (bOnUnit = 0).
 * L press 0x05 (0x6faca886) / L hold 0x08 (0x6faca838) / R press 0x0C (0x6facaa4a) / R hold 0x0F (0x6faca94f).
 */
export function c2sSkillAtOpcode(hand: Hand, hold: boolean): number {
  if (hand === 'left') return hold ? 0x08 : 0x05
  if (hand === 'right') return hold ? 0x0f : 0x0c
  throw new TypeError(`c2sSkillAtOpcode: invalid hand ${String(hand)}`)
}

/**
 * Resolves the unit skill opcode per `1.13c D2Client 0x6faca060 SendSkillPacket` (bOnUnit = 1).
 * L 0x06 / shift 0x07 / hold 0x09 / shift+hold 0x0A; R 0x0D / shift 0x0E / hold 0x10 / shift+hold 0x11.
 */
export function c2sSkillOnUnitOpcode(hand: Hand, shift: boolean, hold: boolean): number {
  if (hand === 'left') {
    if (shift) return hold ? 0x0a : 0x07 // 0x6faca15f / 0x6faca25d
    return hold ? 0x09 : 0x06 // 0x6faca35e / 0x6faca3ab
  }
  if (hand === 'right') {
    if (shift) return hold ? 0x11 : 0x0e // 0x6faca470 / 0x6faca519
    return hold ? 0x10 : 0x0d // 0x6faca61a / 0x6faca70b
  }
  throw new TypeError(`c2sSkillOnUnitOpcode: invalid hand ${String(hand)}`)
}

function requireBoolean(name: string, value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${name} must be a boolean (got ${String(value)}); 1.13c 0x6faca060 has no default`)
  }
  return value
}

/** 0x05 LeftSkillOnLocation (5B), 0x08 LeftSkillOnLocationHold (5B), 0x0C RightSkillOnLocation (5B), 0x0F RightSkillOnLocationHold (5B) */
export function encodeC2sSkillAt(hand: Hand, at: Pt, hold: boolean): Uint8Array {
  const opcode = c2sSkillAtOpcode(hand, requireBoolean('encodeC2sSkillAt hold', hold))
  const w = new ByteWriter(5)
  w.u8(opcode)
  w.u16LE(at.x & 0xffff)
  w.u16LE(at.y & 0xffff)
  return validateC2sPacket(w.toUint8Array())
}

/**
 * 0x06 LeftSkillOnUnit / 0x07 ShiftLeftSkillOnUnit / 0x09 LeftSkillOnUnitHold / 0x0A ShiftLeftSkillOnUnitHold,
 * 0x0D RightSkillOnUnit / 0x0E ShiftRightSkillOnUnit / 0x10 RightSkillOnUnitHold / 0x11 ShiftRightSkillOnUnitHold (all 9B).
 */
export function encodeC2sSkillOnUnit(hand: Hand, target: UnitRef, shift: boolean, hold: boolean): Uint8Array {
  const opcode = c2sSkillOnUnitOpcode(
    hand,
    requireBoolean('encodeC2sSkillOnUnit shift', shift),
    requireBoolean('encodeC2sSkillOnUnit hold', hold),
  )
  const w = new ByteWriter(9)
  w.u8(opcode)
  w.u32LE(unitTypeToId(target.unitType) >>> 0)
  w.u32LE(target.id >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x3C SelectSkill (9B): u8 0x3C | u16 skillId | u8 0 | u8 hand (0x80=left, 0x00=right) | u32 itemId */
export function encodeC2sSelectSkill(hand: Hand, skillId: number, itemId = 0xffffffff): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x3c)
  w.u16LE(skillId & 0xffff)
  w.u8(0x00)
  w.u8(hand === 'left' ? 0x80 : 0x00)
  w.u32LE(itemId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/**
 * 0x3A AddStatPoint (3B, D2Game.dll 0x6fcec960):
 * u8 0x3A | u8 statId (0..15) | u8 countMinusOne (0..99, i.e. 1..100 points)
 */
export function encodeC2sAddStatPoint(statId: number, count = 1): Uint8Array {
  const w = new ByteWriter(3)
  w.u8(0x3a)
  w.u8(statId & 0x0f)
  const clampedCountMinusOne = Math.min(99, Math.max(0, Math.trunc(count) - 1))
  w.u8(clampedCountMinusOne & 0xff)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x3B AddSkillPoint (3B, D2Game.dll 0x6fceca50): u8 0x3B | u16 skillId */
export function encodeC2sAddSkillPoint(skillId: number): Uint8Array {
  const w = new ByteWriter(3)
  w.u8(0x3b)
  w.u16LE(skillId & 0xffff)
  return validateC2sPacket(w.toUint8Array())
}

/**
 * 0x51 AssignSkillHotkey (9B, D2Client.dll 0x6faed260 / D2Game.dll 0x6fcebc70):
 * u8 0x51 | u8 skillLo | u8 ((skillHi & 0x7f) | (hand === 'left' ? 0x80 : 0)) | u16 slot (0..15) | u32 itemId
 * When unbinding (`skillId === 0xffff`, `0x7fff`, or `< 0`), bytes 1..2 are `0xff, 0xff` (`0x6faed276`).
 */
export function encodeC2sAssignSkillHotkey(
  slot: number,
  hand: Hand,
  skillId: number,
  itemId = 0xffffffff,
): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x51)
  const isUnbind = skillId < 0 || (skillId & 0xffff) === 0xffff || (skillId & 0xffff) === 0x7fff
  const rawSkill = isUnbind ? 0xffff : skillId & 0xffff
  w.u8(rawSkill & 0xff)
  const hi = isUnbind
    ? 0xff
    : ((rawSkill >>> 8) & 0x7f) | (hand === 'left' ? 0x80 : 0x00)
  w.u8(hi & 0xff)
  w.u16LE(slot & 0x0f)
  w.u32LE(itemId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}
