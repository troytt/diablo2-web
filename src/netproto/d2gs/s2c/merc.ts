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
import { requirePacketLength } from './packet-length.ts'

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

/**
 * 0x7A SummonAction (13B, D2Client.dll 0x6fb5c720; D2Game.dll 0x6fcab290 / 0x6fcb6810):
 * - [0]     = 0x7A
 * - [1]     = u8 action (0 = remove from g_pPetList 0x6fad1840, non-zero = add 0x6fad18c0)
 * - [2]     = u8 petType (PetType.txt row index)
 * - [3..4]  = u16LE classId (MonStats.txt hcIdx)
 * - [5..8]  = u32LE ownerId
 * - [9..12] = u32LE mercId (pet unitId)
 */
export function decode0x7ASummonAction(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x7A SummonAction', 13)
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
 * - [1]      = u8 kind (7 = hireling: 0x6fad1d6c / 0x6fad1db6)
 * - [2..3]   = u16LE classId
 * - [4..7]   = u32LE ownerId
 * - [8..11]  = u32LE mercId
 * - [12..15] = u32LE seed
 * - [16..19] = u32LE name dword
 * The handler copies `{u32 @0xC, u32 @0x10, 0}` into the owner's pet record (+0x24/+0x28/+0x2C, 0x6fad1dc2..
 * 0x6fad1dd0); for kind 7 it passes `{u32 @0xC, u16 (@0x10 & 0xFFFF)}` to the merc name setter 0x6fafef50
 * (0x6fad1dd5..0x6fad1e33). There is no fallback between the two fields (#1661).
 */
export function decode0x81AssignMerc(pkt: Uint8Array): ServerEvent {
  requirePacketLength(pkt, '0x81 AssignMerc', 20)
  const r = new ByteReader(pkt)
  r.u8() // 0x81
  r.u8() // kind
  const classId = r.u16LE()
  const ownerId = r.u32LE()
  const mercId = r.u32LE()
  const seed = r.u32LE() // @0xC
  const nameDword = r.u32LE() // @0x10
  const nameId = nameDword & 0xffff
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

/**
 * 0x9B MercReviveCost (7B, D2Client.dll 0x6fb5e1e0): the handler reads only two words,
 * `mov ax, word [eax+1]` (name id) and `movzx ecx, word [eax+3]` (cost), then jumps to 0x6fafa350;
 * bytes 5..6 are never read.
 */
export function decode0x9BMercReviveCost(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x9B
  const nameId = r.u16LE()
  const cost = r.u16LE()
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

/** 0xA0 MercAttributeDword (10B, D2Client.dll 0x6fb5ea40 — signed 32-bit except stat 13 experience) */
export function decode0xA0MercAttrDword(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xA0
  const stat = r.u8()
  const mercId = r.u32LE()
  const value = stat === 13 ? r.u32LE() : r.i32LE()
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
