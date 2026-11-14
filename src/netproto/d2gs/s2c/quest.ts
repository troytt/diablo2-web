/**
 * D2GS S->C Quest Info and Quest Log Packet Decoders (1.13c).
 * Verified against D2Client.dll:
 * - 0x28 QuestInfo (103B, 0x6fb5fa70)
 * - 0x29 GameQuestLog (97B, 0x6fb5c330)
 * - 0x50 QuestItemState (15B, 0x6fb5d4b0)
 * - 0x52 QuestHistory /Intro (42B, 0x6fb5d520)
 * - 0x5D QuestStatus (6B, 0x6fb5f8f0)
 * - 0x5E GameQuestAvailability (38B, 0x6fb5c090)
 * - 0x89 SpecialQuestEvent (2B, 0x6fb5bfa0)
 */

import { ByteReader } from '../../core/byte-reader.ts'
import type { ServerEvent } from '../../domain/server-event.ts'

/** 0x28 QuestInfo (103B, D2Client.dll 0x6fb5fa70 -> 0x6fafb8a0 / D2Game.dll QUESTS_SendLogUpdateEx 0x6fc95230) */
export function decode0x28QuestInfo(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x28
  const updateType = r.u8() // +0x01
  const unitId = r.u32LE() // +0x02..0x05
  const timer = r.remaining >= 1 ? r.u8() : 0 // +0x06
  // +0x07..0x66 (bytes 7..102): 48 x u16LE quest bitflags (96 bytes)
  const quests = new Uint16Array(48)
  for (let i = 0; i < 48 && r.remaining >= 2; i++) {
    quests[i] = r.u16LE()
  }
  return {
    type: 'QuestState',
    kind: 'update',
    source: 0x28,
    updateType,
    unitId,
    timer,
    quests,
    flags: Array.from(quests),
  }
}

export const decode0x28UpdateQuestInfo = decode0x28QuestInfo

/** 0x29 GameQuestLog (97B, D2Client.dll 0x6fb5c330) */
export function decode0x29GameQuestLog(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x29
  const quests = new Uint16Array(48)
  for (let i = 0; i < 48 && r.remaining >= 2; i++) {
    quests[i] = r.u16LE()
  }
  return {
    type: 'QuestState',
    kind: 'log',
    source: 0x29,
    quests,
    flags: Array.from(quests),
  }
}

/** 0x50 QuestItemState (15B, D2Client.dll 0x6fb5d4b0) */
export function decode0x50QuestItemState(pkt: Uint8Array): ServerEvent {
  if (pkt.length < 15) throw new RangeError(`0x50 QuestItemState: expected at least 15 bytes, got ${pkt.length}`)
  const quests = new Uint16Array(7)
  const r = new ByteReader(pkt)
  r.u8() // 0x50
  for (let i = 0; i < 7 && r.remaining >= 2; i++) {
    quests[i] = r.u16LE()
  }
  return {
    type: 'QuestState',
    kind: 'item',
    source: 0x50,
    quests,
  }
}

/** 0x52 QuestHistory (42B: 0x52 + 41 u8 status bytes, D2Client.dll 0x6fb5d520) */
export function decode0x52QuestHistory(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x52
  const statusBytes = new Uint8Array(41)
  for (let i = 0; i < 41 && r.remaining >= 1; i++) {
    statusBytes[i] = r.u8()
  }
  return {
    type: 'QuestState',
    kind: 'history',
    source: 0x52,
    quests: new Uint16Array(statusBytes),
    statusBytes,
    historyBytes: statusBytes,
  }
}

/** 0x5D QuestStatus (6B, D2Client.dll 0x6fb5f8f0 -> 0x6face160) */
export function decode0x5DQuestStatus(pkt: Uint8Array): ServerEvent {
  if (pkt.length < 6) throw new RangeError(`0x5D QuestStatus: expected at least 6 bytes, got ${pkt.length}`)
  const r = new ByteReader(pkt)
  r.u8() // 0x5D
  const questId = r.u8()
  const alertFlags = r.u8()
  const filterStatus = r.u8()
  const extra = r.i16LE()
  return {
    type: 'QuestState',
    kind: 'status',
    source: 0x5d,
    quests: new Uint16Array([questId, (filterStatus << 8) | alertFlags, extra & 0xffff]),
    questStatus: {
      questId,
      alertFlags,
      filterStatus,
      extra,
    },
  }
}

/** 0x5E GameQuestAvailability (38B, D2Client.dll 0x6fb5c090) */
export function decode0x5EGameQuestAvailability(pkt: Uint8Array): ServerEvent {
  if (pkt.length < 38) throw new RangeError(`0x5E GameQuestAvailability: expected at least 38 bytes, got ${pkt.length}`)
  const r = new ByteReader(pkt)
  r.u8() // 0x5E
  const availabilityBytes = pkt.slice(1, Math.min(38, pkt.byteLength))
  const quests = new Uint16Array(18)
  for (let i = 0; i < 18 && r.remaining >= 2; i++) {
    quests[i] = r.u16LE()
  }
  return {
    type: 'QuestState',
    kind: 'availability',
    source: 0x5e,
    quests,
    availabilityBytes,
  }
}

/** 0x89 SpecialQuestEvent (2B, D2Client.dll 0x6fb5bfa0) */
export function decode0x89SpecialQuestEvent(pkt: Uint8Array): ServerEvent {
  const specialEventId = pkt[1] ?? 0
  return {
    type: 'QuestState',
    kind: 'special',
    source: 0x89,
    quests: new Uint16Array([specialEventId]),
    specialEventId,
  }
}
