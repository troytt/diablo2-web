/**
 * D2GS S->C Party, Roster, and Player Relation Packet Decoders (1.13c).
 * Verified against D2Client.dll:
 * - 0x5B PlayerInGame (variable u16@1, 0x6fb5d8f0)
 * - 0x5C PlayerLeftGame (5B, 0x6fb5d8e0)
 * - 0x65 PlayerKillCount (7B, 0x6fb5d890)
 * - 0x66 PartyMemberUpdate (7B, 0x6fb5c040)
 * - 0x74 PlayerCorpseAssign (10B, 0x6fb5def0)
 * - 0x75 PlayerPartyInfo (13B, 0x6fb5d870)
 * - 0x7F PartyMemberState (10B, 0x6fb5d820)
 * - 0x8B PlayerPartyRelationship (6B, 0x6fb5d800)
 * - 0x8C RelationshipUpdate (11B, 0x6fb5d7b0)
 * - 0x8D AssignPlayerToParty (7B, 0x6fb5d780)
 * - 0x8E CorpseAssign (10B, 0x6fb5d130)
 * - 0x90 PartyMemberMapPos (13B, 0x6fb5d220)
 */

import { ByteReader } from '../../core/byte-reader.ts'
import type { ServerEvent } from '../../domain/server-event.ts'

/** 0x5B PlayerInGame (variable u16@1 = 36B, D2Client.dll 0x6fb5d8f0) */
export function decode0x5BPlayerInGame(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x5B
  r.u16LE() // packetLen
  const unitId = r.u32LE()
  const charClass = r.u8()
  const charName = r.fixedCString(16)
  const charLevel = r.u16LE()
  const partyId = r.u16LE()
  return {
    type: 'Party',
    kind: 'roster',
    source: 0x5b,
    unitId,
    charClass,
    charName,
    charLevel,
    partyId,
  }
}

/** 0x5C PlayerLeftGame (5B, D2Client.dll 0x6fb5d8e0) */
export function decode0x5CPlayerLeftGame(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x5C
  const unitId = r.u32LE()
  return {
    type: 'Party',
    kind: 'roster',
    source: 0x5c,
    unitId,
    partyId: 0xffff,
  }
}

/** 0x65 PlayerKillCount (7B, D2Client.dll 0x6fb5d890) */
export function decode0x65PlayerKillCount(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x65
  const unitId = r.u32LE()
  const count = r.u16LE()
  return {
    type: 'Party',
    kind: 'relation',
    source: 0x65,
    unitId,
    relation: count,
  }
}

/** 0x66 PartyMemberUpdate (7B, D2Client.dll 0x6fb5c040) */
export function decode0x66PartyMemberUpdate(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x66
  const unitId = r.u32LE()
  const lifePct = r.u16LE()
  return {
    type: 'Party',
    kind: 'memberState',
    source: 0x66,
    unitId,
    lifePct,
  }
}

/** 0x74 PlayerCorpseAssign (10B, D2Client.dll 0x6fb5def0) */
export function decode0x74PlayerCorpseAssign(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x74
  const assign = r.u8()
  const ownerId = r.u32LE()
  const corpseId = r.u32LE()
  return {
    type: 'CorpseAssign',
    assign,
    ownerId,
    corpseId,
  }
}

/** 0x75 PlayerPartyInfo (13B, D2Client.dll 0x6fb5d870) */
export function decode0x75PlayerPartyInfo(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x75
  const unitId = r.u32LE()
  const partyId = r.u16LE()
  const charLevel = r.u16LE()
  const relation = r.u16LE()
  const inParty = r.u16LE()
  return {
    type: 'Party',
    kind: 'roster',
    source: 0x75,
    unitId,
    partyId,
    charLevel,
    relation: (inParty << 16) | relation,
    inParty: inParty !== 0,
  }
}

/** 0x7F PartyMemberState (10B, D2Client.dll 0x6fb5d820) */
export function decode0x7FPartyMemberState(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x7F
  const isPlayer = r.u8()
  const lifePct = r.u16LE()
  const unitId = r.u32LE()
  const areaId = r.u16LE()
  return {
    type: 'Party',
    kind: 'memberState',
    source: 0x7f,
    unitId,
    lifePct,
    areaId,
    relation: isPlayer,
    isPlayer: isPlayer !== 0,
  }
}

/** 0x8B PlayerPartyRelationship (6B, D2Client.dll 0x6fb5d800) */
export function decode0x8BPlayerPartyRelation(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x8B
  const unitId = r.u32LE()
  const relation = r.u8()
  return {
    type: 'Party',
    kind: 'relation',
    source: 0x8b,
    unitId,
    relation,
  }
}

/** 0x8C RelationshipUpdate (11B, D2Client.dll 0x6fb5d7b0) */
export function decode0x8CRelationshipUpdate(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x8C
  const unitId = r.u32LE()
  const otherId = r.u32LE()
  const relation = r.u16LE()
  return {
    type: 'Party',
    kind: 'relation',
    source: 0x8c,
    unitId,
    otherId,
    relation,
  }
}

/** 0x8D AssignPlayerToParty (7B, D2Client.dll 0x6fb5d780) */
export function decode0x8DAssignPlayerToParty(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x8D
  const unitId = r.u32LE()
  const partyId = r.u16LE()
  return {
    type: 'Party',
    kind: 'roster',
    source: 0x8d,
    unitId,
    partyId,
  }
}

/** 0x8E CorpseAssign (10B, D2Client.dll 0x6fb5d130) */
export function decode0x8ECorpseAssign(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x8E
  const assign = r.u8()
  const ownerId = r.u32LE()
  const corpseId = r.u32LE()
  return {
    type: 'CorpseAssign',
    assign,
    ownerId,
    corpseId,
  }
}

/** 0x90 PartyMemberMapPos (13B, D2Client.dll 0x6fb5d220) */
export function decode0x90PartyMemberPos(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x90
  const unitId = r.u32LE()
  const x = r.u32LE()
  const y = r.u32LE()
  return {
    type: 'Party',
    kind: 'memberPos',
    source: 0x90,
    unitId,
    at: { x, y },
  }
}
