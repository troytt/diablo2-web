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
import { ByteReader } from '../../core/byte-reader.ts'
import type { ServerEvent } from '../../domain/server-event.ts'

function toSignedVelocity(rawByte: number): number {
  return rawByte > 0x80 ? rawByte - 0x100 : rawByte
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

/** 0x1F BaseAttributeDword (6B, D2Client.dll 0x6fb5edf0) */
export function decode0x1FAttrDword(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8()
  const stat = r.u8()
  const value = r.u32LE()
  return {
    type: 'StatSet',
    stat,
    value,
  }
}

/** 0x20 AttributeNotification (10B, D2Client.dll 0x6fb5ed80) */
export function decode0x20AttrNotification(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x20
  const unitId = r.u32LE()
  const stat = r.u8()
  const value = r.u32LE()
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
    value = b.readBits(32)
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

