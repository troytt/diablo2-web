/**
 * D2GS S->C Mercenary & Summon Packet Decoders (1.13c).
 * Verified against D2Client.dll:
 * - 0x4E MercForHire (7B, 0x6fb5c0b0)
 * - 0x4F MercForHireListStart (1B, 0x6fb5c0e0)
 * - 0x7A SummonAction (13B, 0x6fb5c720)
 * - 0x81 AssignMerc (20B, 0x6fb5eba0)
 * - 0x9B MercReviveCost (7B, 0x6fb5e1e0)
 * - 0x9E..0xA2 MercAttributeByte/Word/Dword & MercExpByte/Word (0x6fb5ea40)
 */

import { ByteReader } from '../../core/byte-reader.ts'
import type { ServerEvent } from '../../domain/server-event.ts'

/** 0x4E MercForHire (7B, D2Client.dll 0x6fb5c0b0) */
export function decode0x4EMercForHire(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x4E
  const nameId = r.u16LE()
  const seed = r.u32LE()
  return {
    type: 'Merc',
    kind: 'hireList',
    nameId,
    value: seed,
  }
}

/** 0x4F MercForHireListStart (1B, D2Client.dll 0x6fb5c0e0) */
export function decode0x4FMercForHireListStart(_pkt: Uint8Array): ServerEvent {
  return {
    type: 'Merc',
    kind: 'hireList',
  }
}

/** 0x7A SummonAction (13B, D2Client.dll 0x6fb5c720) */
export function decode0x7ASummonAction(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x7A
  const action = r.u8()
  const petType = r.u8()
  const classId = r.u16LE()
  const ownerId = r.u32LE()
  const mercId = r.u32LE()
  return {
    type: 'Merc',
    kind: 'assign',
    ownerId,
    mercId,
    classId,
    stat: action,
    value: petType,
    isSummonAction: true,
    summonAction: action,
    petType,
  }
}

/**
 * 0x81 AssignMerc (20B, D2Client.dll 0x6fb5eba0 -> 0x6fad1d60):
 * - [0]      = 0x81
 * - [1]      = u8 unk
 * - [2..3]   = u16LE classId
 * - [4..7]   = u32LE ownerId
 * - [8..11]  = u32LE mercId
 * - [12..15] = u32LE seed
 * - [16..17] = u16LE nameId
 * - [18..19] = u16LE pad
 */
export function decode0x81AssignMerc(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x81
  r.u8() // unk
  const classId = r.u16LE()
  const ownerId = r.u32LE()
  const mercId = r.u32LE()
  const seed12 = r.u32LE() // offset 12..15 (canonical 1.13c u32 seed)
  const nameId = r.u16LE() // offset 16..17
  const seed18 = r.remaining >= 4 ? r.u32LE() : r.remaining >= 2 ? r.u16LE() : 0 // offset 18+
  const seed = seed12 !== 0 ? seed12 : seed18
  return {
    type: 'Merc',
    kind: 'assign',
    ownerId,
    mercId,
    classId,
    nameId,
    seed,
    value: seed,
  }
}

/** 0x9B MercReviveCost (7B, D2Client.dll 0x6fb5e1e0) */
export function decode0x9BMercReviveCost(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x9B
  const nameId = r.u16LE()
  const cost = r.u32LE()
  return {
    type: 'Merc',
    kind: 'stat',
    nameId,
    value: cost,
  }
}

/** 0x9E MercAttributeByte (7B, D2Client.dll 0x6fb5ea40) */
export function decode0x9EMercAttrByte(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x9E
  const stat = r.u8()
  const mercId = r.u32LE()
  const value = r.u8()
  return {
    type: 'Merc',
    kind: 'stat',
    mercId,
    stat,
    value,
  }
}

/** 0x9F MercAttributeWord (8B, D2Client.dll 0x6fb5ea40) */
export function decode0x9FMercAttrWord(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x9F
  const stat = r.u8()
  const mercId = r.u32LE()
  const value = r.u16LE()
  return {
    type: 'Merc',
    kind: 'stat',
    mercId,
    stat,
    value,
  }
}

/** 0xA0 MercAttributeDword (10B, D2Client.dll 0x6fb5ea40) */
export function decode0xA0MercAttrDword(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xA0
  const stat = r.u8()
  const mercId = r.u32LE()
  const value = r.u32LE()
  return {
    type: 'Merc',
    kind: 'stat',
    mercId,
    stat,
    value,
  }
}

/** 0xA1 MercExpByte (7B, D2Client.dll 0x6fb5ea40) */
export function decode0xA1MercExpByte(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xA1
  const stat = r.u8()
  const mercId = r.u32LE()
  const value = r.u8()
  return {
    type: 'Merc',
    kind: 'exp',
    mercId,
    stat,
    value,
  }
}

/** 0xA2 MercExpWord (8B, D2Client.dll 0x6fb5ea40) */
export function decode0xA2MercExpWord(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xA2
  const stat = r.u8()
  const mercId = r.u32LE()
  const value = r.u16LE()
  return {
    type: 'Merc',
    kind: 'exp',
    mercId,
    stat,
    value,
  }
}
