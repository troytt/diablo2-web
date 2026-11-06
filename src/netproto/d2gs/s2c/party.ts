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
import { ByteWriter } from '../../core/byte-writer.ts'
import type { ServerEvent } from '../../domain/server-event.ts'

/**
 * 0x5B PlayerInGame (variable u16@1, D2Client.dll 0x6fb5d8f0 -> 0x6fb4e3d0 -> 0x6fb4d310):
 * id @3, class @7, name[16] @8, level @0x18 (roster+0x20), partyId @0x1A (roster+0x22), u16 @0x1C (passed
 * along but never stored), relation @0x1E (roster+0x30, the same field 0x8B writes), u16 @0x20 (roster+0x44),
 * then two NUL-terminated strings from @0x22 (roster+0x46 / +0x4A). When the first string is non-empty the
 * roster display name is `"%s {%s}"` (name, string), otherwise the plain name (0x6fb4d37c..0x6fb4d3a8).
 */
export function decode0x5BPlayerInGame(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x5B
  r.u16LE() // packetLen
  const unitId = r.u32LE()
  const charClass = r.u8()
  const charName = r.fixedCString(16)
  const charLevel = r.u16LE()
  const partyId = r.u16LE()
  r.u16LE() // @0x1C: forwarded to 0x6fb4e3d0 but dropped by 0x6fb4d310
  const relation = r.u16LE()
  const rosterWord44 = r.u16LE()
  const strings: string[] = []
  let p = 0x22
  for (let k = 0; k < 2 && p < pkt.byteLength; k++) {
    let e = p
    while (e < pkt.byteLength && pkt[e] !== 0) e++
    strings.push(String.fromCharCode(...pkt.subarray(p, e)))
    p = e + 1
  }
  const nameSuffix = strings[0] ?? ''
  return {
    type: 'Party',
    kind: 'roster',
    action: 'join',
    source: 0x5b,
    unitId,
    playerId: unitId,
    charClass,
    charName,
    charLevel,
    partyId,
    relation,
    rosterWord44,
    nameSuffix,
    nameSuffix2: strings[1] ?? '',
    displayName: nameSuffix.length > 0 ? `${charName} {${nameSuffix}}` : charName,
  }
}

export function encode0x5BPlayerInGame(params: {
  readonly playerId: number
  readonly charClass: number
  readonly charName: string
  readonly charLevel: number
  readonly partyId: number
}): Uint8Array {
  const w = new ByteWriter(36)
  w.u8(0x5b)
  w.u16LE(36)
  w.u32LE(params.playerId)
  w.u8(params.charClass)
  w.fixedString(params.charName, 16)
  w.u16LE(params.charLevel)
  w.u16LE(params.partyId)
  w.u32LE(0)
  w.u32LE(0)
  return w.toUint8Array()
}

/** 0x5C PlayerLeftGame (5B, D2Client.dll 0x6fb5d8e0) */
export function decode0x5CPlayerLeftGame(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x5C
  const unitId = r.u32LE()
  return {
    type: 'Party',
    kind: 'roster',
    action: 'leave',
    source: 0x5c,
    unitId,
    playerId: unitId,
    partyId: 0xffff,
  }
}

export function encode0x5CPlayerLeftGame(playerId: number): Uint8Array {
  const w = new ByteWriter(5)
  w.u8(0x5c)
  w.u32LE(playerId)
  return w.toUint8Array()
}

/** 0x65 PlayerKillCount (7B, D2Client.dll 0x6fb5d890) */
/**
 * 0x65 PlayerKillCount (7B, D2Client.dll 0x6fb5d890): u32 player id @1, u16 count @5 read as signed
 * (`test esi, 0x8000` -> `sub ecx, 0x10000`), stored at roster+0x18 before the party panel refresh (0x6fb272e0).
 */
export function decode0x65PlayerKillCount(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x65
  const unitId = r.u32LE()
  const killCount = r.i16LE()
  return {
    type: 'Party',
    kind: 'relation',
    source: 0x65,
    unitId,
    killCount,
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
    playerId: unitId,
    partyId,
    charLevel,
    relation: (inParty << 16) | relation,
    inParty: inParty !== 0,
  }
}

export function encode0x75PlayerPartyInfo(params: {
  readonly unitId: number
  readonly partyId: number
  readonly charLevel: number
  readonly relationship: number
  readonly inYourParty: number
}): Uint8Array {
  const w = new ByteWriter(13)
  w.u8(0x75)
  w.u32LE(params.unitId)
  w.u16LE(params.partyId)
  w.u16LE(params.charLevel)
  w.u16LE(params.relationship)
  w.u16LE(params.inYourParty)
  return w.toUint8Array()
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
    playerId: unitId,
    lifePct,
    areaId,
    relation: isPlayer,
    isPlayer: isPlayer !== 0,
  }
}

export function encode0x7FPartyMemberPulse(params: {
  readonly isPlayer: number
  readonly lifePercent: number
  readonly unitId: number
  readonly areaId: number
}): Uint8Array {
  const w = new ByteWriter(10)
  w.u8(0x7f)
  w.u8(params.isPlayer)
  w.u16LE(params.lifePercent)
  w.u32LE(params.unitId)
  w.u16LE(params.areaId)
  return w.toUint8Array()
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
    playerId: unitId,
    relation,
  }
}

export function encode0x8BPartyInvite(unitId: number, state: number): Uint8Array {
  const w = new ByteWriter(6)
  w.u8(0x8b)
  w.u32LE(unitId)
  w.u8(state)
  return w.toUint8Array()
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
    playerId: unitId,
    otherId,
    relation,
  }
}

export function encode0x8CPlayerRelation(
  player1Id: number,
  player2Id: number,
  relationState: number,
): Uint8Array {
  const w = new ByteWriter(11)
  w.u8(0x8c)
  w.u32LE(player1Id)
  w.u32LE(player2Id)
  w.u16LE(relationState)
  return w.toUint8Array()
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
    action: 'update',
    source: 0x8d,
    unitId,
    playerId: unitId,
    partyId,
  }
}

export function encode0x8DAssignPlayerToParty(unitId: number, partyNumber: number): Uint8Array {
  const w = new ByteWriter(7)
  w.u8(0x8d)
  w.u32LE(unitId)
  w.u16LE(partyNumber)
  return w.toUint8Array()
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
    playerId: unitId,
    at: { x, y },
  }
}

export function encode0x90MapPartyPulse(unitId: number, x: number, y: number): Uint8Array {
  const w = new ByteWriter(13)
  w.u8(0x90)
  w.u32LE(unitId)
  w.i32LE(x)
  w.i32LE(y)
  return w.toUint8Array()
}
