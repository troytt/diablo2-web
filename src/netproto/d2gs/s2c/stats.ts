/**
 * D2GS S->C Player Life/Mana, Gold, Experience, and Attribute Packet Decoders (1.13c).
 * Verified against D2Client.dll:
 * - 0x18 HPMPUpdate (15B, 0x6fb5eca0 / 0x6fb5c240)
 * - 0x95 HPMPPotUpdate (13B, 0x6fb5ebe0 / 0x6fb5c1b0)
 * - 0x19..0x1F Gold / Exp / Attribute Byte/Word/Dword (0x6fb5edf0)
 * - 0x20 PlayerAttributeNotification (10B, 0x6fb5ed80)
 * - 0x3E UpdateItemStats (variable pkt[1], 0x6fb5e300)
 */

import { BitReader } from '../../core/bit-reader.ts'
import { BitWriter } from '../../core/bit-writer.ts'
import { ByteReader } from '../../core/byte-reader.ts'
import { ByteWriter } from '../../core/byte-writer.ts'
import type { ServerEvent } from '../../domain/server-event.ts'

function toSignedVelocity(rawByte: number): number {
  return rawByte > 0x80 ? rawByte - 0x100 : rawByte
}

function toUnsignedVelocityByte(v: number | undefined): number {
  if (v === undefined || v === 0) return 0
  const clamped = Math.max(-127, Math.min(128, Math.trunc(v)))
  return clamped < 0 ? (clamped + 0x100) & 0xff : clamped & 0xff
}

function clamp15BitPool(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(0x7fff, Math.max(0, Math.trunc(v)))
}

/**
 * Encode 1.13c `S2C 0x18` (`HPMPUpdate`, 15B, `D2Game.dll` `0x6FC3D9A0` / `D2Client.dll` `0x6FB5ECA0`).
 */
export function encode0x18LifeManaRegen(params: {
  readonly life: number
  readonly mana: number
  readonly stamina: number
  readonly lifeRegen?: number | undefined
  readonly manaRegen?: number | undefined
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly vx?: number | undefined
  readonly vy?: number | undefined
}): Uint8Array {
  const bw = new BitWriter()
  bw.writeBits(0x18, 8)
  bw.writeBits(clamp15BitPool(params.life), 15)
  bw.writeBits(clamp15BitPool(params.mana), 15)
  bw.writeBits(clamp15BitPool(params.stamina), 15)
  bw.writeBits((Math.trunc(params.lifeRegen ?? 0)) & 0x7f, 7)
  bw.writeBits((Math.trunc(params.manaRegen ?? 0)) & 0x7f, 7)
  bw.writeBits((Math.trunc(params.x ?? 0)) & 0xffff, 16)
  bw.writeBits((Math.trunc(params.y ?? 0)) & 0xffff, 16)
  bw.writeBits(toUnsignedVelocityByte(params.vx), 8)
  bw.writeBits(toUnsignedVelocityByte(params.vy), 8)
  const raw = bw.toUint8Array()
  const out = new Uint8Array(15)
  out.set(raw.subarray(0, 15))
  return out
}

/**
 * Encode 1.13c `S2C 0x95` (`HPMPPotUpdate` / `LifeManaPot`, 13B, `D2Game.dll` `0x6FC3D9A0` / `D2Client.dll` `0x6FB5EBE0`):
 * 8b packetId (`0x95`) | 15b life | 15b mana | 15b stamina | 16b x | 16b y | 8b vx | 8b vy.
 */
export function encode0x95LifeMana(params: {
  readonly life: number
  readonly mana: number
  readonly stamina: number
  readonly x?: number | undefined
  readonly y?: number | undefined
  readonly vx?: number | undefined
  readonly vy?: number | undefined
}): Uint8Array {
  const bw = new BitWriter()
  bw.writeBits(0x95, 8)
  bw.writeBits(clamp15BitPool(params.life), 15)
  bw.writeBits(clamp15BitPool(params.mana), 15)
  bw.writeBits(clamp15BitPool(params.stamina), 15)
  bw.writeBits((Math.trunc(params.x ?? 0)) & 0xffff, 16)
  bw.writeBits((Math.trunc(params.y ?? 0)) & 0xffff, 16)
  bw.writeBits(toUnsignedVelocityByte(params.vx), 8)
  bw.writeBits(toUnsignedVelocityByte(params.vy), 8)
  const raw = bw.toUint8Array()
  const out = new Uint8Array(13)
  out.set(raw.subarray(0, 13))
  return out
}

export const encode0x95LifeManaPot = encode0x95LifeMana

/**
 * Encode 1.13c player base/accrued attribute update (`D2Game.dll` `0x6FC3DF40` `D2GAME_SendStatUpdate_0x1D_0x1E_0x1F`):
 * - Negative values (`value < 0`, e.g. Nightmare `-40` / Hell `-100` resistances or Lower Resist / Conviction)
 *   MUST NEVER use unsigned `0x1D` (`u8`) or `0x1E` (`u16`), or `D2Client.dll` `0x6FB5EDF0` zero-extends them
 *   to `+156` / `+65436`; they are encoded as 32-bit two's-complement `0x1F` (`AttributeDword`).
 * - `0 <= value <= 0xFF` -> `0x1D` (3B, or `0x19` 2B when `stat === 14 && param === 1`).
 * - `0x100 <= value <= 0xFFFF` -> `0x1E` (4B).
 * - `value < 0 || value > 0xFFFF` -> `0x1F` (6B).
 */
export function encode0x1D_0x1E_0x1FStat(stat: number, value: number, param?: number): Uint8Array {
  const intVal = Math.trunc(value)
  if (stat === 14 && param === 1 && intVal >= 0 && intVal <= 0xff) {
    return new Uint8Array([0x19, intVal & 0xff])
  }
  if (intVal >= 0 && intVal <= 0xff) {
    return new Uint8Array([0x1d, stat & 0xff, intVal & 0xff])
  }
  if (intVal >= 0 && intVal <= 0xffff) {
    const w = new ByteWriter(4)
    w.u8(0x1e)
    w.u8(stat & 0xff)
    w.u16LE(intVal & 0xffff)
    return w.toUint8Array()
  }
  const w = new ByteWriter(6)
  w.u8(0x1f)
  w.u8(stat & 0xff)
  w.u32LE(intVal >>> 0)
  return w.toUint8Array()
}

/**
 * 0x18 HPMPUpdate (15B, D2Client.dll 0x6fb5eca0 + 0x6fb5c240):
 * 8b packetId (0x18) | 15b life | 15b mana | 15b stamina | 7b lifeRegen | 7b manaRegen | 16b x | 16b y | 8b vx | 8b vy
 */
export function decode0x18LifeManaRegen(pkt: Uint8Array): ServerEvent {
  const b = new BitReader(pkt)
  b.readBits(8) // 0x18
  const life = b.readBits(15)
  const mana = b.readBits(15)
  const stamina = b.readBits(15)
  const lifeRegen = b.readBits(7)
  const manaRegen = b.readBits(7)
  const x = b.readBits(16)
  const y = b.readBits(16)
  const vx = toSignedVelocity(b.readBits(8))
  const vy = toSignedVelocity(b.readBits(8))
  return {
    type: 'LifeMana',
    life,
    mana,
    stamina,
    lifeRegen,
    manaRegen,
    at: { x, y },
    vx,
    vy,
  }
}

/**
 * 0x95 HPMPPotUpdate (13B, D2Client.dll 0x6fb5ebe0 + 0x6fb5c1b0):
 * 8b packetId (0x95) | 15b life | 15b mana | 15b stamina | 16b x | 16b y | 8b vx | 8b vy
 */
export function decode0x95LifeMana(pkt: Uint8Array): ServerEvent {
  const b = new BitReader(pkt)
  b.readBits(8) // 0x95
  const life = b.readBits(15)
  const mana = b.readBits(15)
  const stamina = b.readBits(15)
  const x = b.readBits(16)
  const y = b.readBits(16)
  const vx = toSignedVelocity(b.readBits(8))
  const vy = toSignedVelocity(b.readBits(8))
  return {
    type: 'LifeMana',
    life,
    mana,
    stamina,
    at: { x, y },
    vx,
    vy,
  }
}

/** 0x19 GoldToInvByte (2B, D2Client.dll 0x6fb5edf0): adds u8 gold to stat 14 (gold) */
export function decode0x19GoldByte(pkt: Uint8Array): ServerEvent {
  return {
    type: 'StatSet',
    stat: 14,
    value: pkt[1]!,
    param: 1, // delta flag
  }
}

/** 0x1A AddExpByte (2B, D2Client.dll 0x6fb5edf0) */
export function decode0x1AExpByte(pkt: Uint8Array): ServerEvent {
  return {
    type: 'Experience',
    value: pkt[1]!,
    isDelta: true,
  }
}

/** 0x1B AddExpWord (3B, D2Client.dll 0x6fb5edf0) */
export function decode0x1BExpWord(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8()
  return {
    type: 'Experience',
    value: r.u16LE(),
    isDelta: true,
  }
}

/**
 * 0x1C SetExpDword (5B, D2Client.dll 0x6fb5edf0 / 0x6fb5ee80, D2Game.dll 0x6fcabda0 / 0x6fcabdd6):
 * Unlike 0x1A (u8 delta) and 0x1B (u16 delta), 0x1C carries the absolute 32-bit total experience.
 */
export function decode0x1CExpDword(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8()
  return {
    type: 'Experience',
    value: r.u32LE(),
    isDelta: false,
  }
}

/**
 * Normalize 1.13c stat values from 0x1D/0x1E/0x1F (D2Client.dll 0x6fb5edf0):
 * Note: For stats 6..11 (hp, maxhp, mana, maxmana, stamina, maxstamina) the value is passed through
 * unchanged: it is the engine's 8.8 fixed-point number (ItemStatCost.txt ValShift = 8), e.g. a fresh
 * level-1 Assassin's maxhp arrives as `1e 07 00 32` = 12800 = 50 << 8. Consumers apply `>> 8`.
 */
export function decode0x1DAttrByte(pkt: Uint8Array): ServerEvent {
  return {
    type: 'StatSet',
    stat: pkt[1]!,
    value: pkt[2]!,
  }
}

/** 0x1E BaseAttributeWord (4B, D2Client.dll 0x6fb5edf0) */
export function decode0x1EAttrWord(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8()
  const stat = r.u8()
  const value = r.u16LE()
  return {
    type: 'StatSet',
    stat,
    value,
  }
}

/** 0x1F BaseAttributeDword (6B, D2Client.dll 0x6fb5edf0 — signed 32-bit except stat 13 experience) */
export function decode0x1FAttrDword(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8()
  const stat = r.u8()
  const value = stat === 13 ? r.u32LE() : r.i32LE()
  return {
    type: 'StatSet',
    stat,
    value,
  }
}

/** 0x20 AttributeNotification (10B, D2Client.dll 0x6fb5ed80 — signed 32-bit except stat 13 experience) */
export function decode0x20AttrNotification(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x20
  const unitId = r.u32LE()
  const stat = r.u8()
  const value = stat === 13 ? r.u32LE() : r.i32LE()
  return {
    type: 'StatSet',
    stat,
    value,
    unit: { unitType: 0, id: unitId },
  }
}

/** 0x3E UpdateItemStats (variable pkt[1], D2Client.dll 0x6fb5e300) */
export function decode0x3EUpdateItemStats(pkt: Uint8Array, _tables?: unknown): ServerEvent {
  const b = new BitReader(pkt, 2)
  let itemId = 0
  if (b.readBit() === 0) {
    itemId = b.readBits(8)
  } else if (b.readBit() === 0) {
    itemId = b.readBits(16)
  } else {
    itemId = b.readBits(32)
  }

  const flag = b.readBit()
  const stat = b.readBits(9)

  let value = 0
  if (b.readBit() === 0) {
    value = b.readBits(8)
  } else if (b.readBit() === 0) {
    value = b.readBits(16)
  } else {
    const raw32 = b.readBits(32)
    value = stat === 13 ? raw32 >>> 0 : raw32 | 0
  }

  let param = 0
  if (b.bitsRemaining > 0) {
    if (b.readBit() === 0) {
      param = b.readBits(8)
    } else {
      param = b.readBits(16)
    }
  }

  return {
    type: 'StatSet',
    stat,
    value,
    param,
    flag,
    unit: { unitType: 4, id: itemId },
  }
}

