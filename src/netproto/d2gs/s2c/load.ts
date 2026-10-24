/**
 * D2GS S->C Game Loading, Act, Room, and Session Lifecycle Packet Decoders (1.13c).
 * Verified against D2Client.dll handler table at 0x6fb8de60 and system dispatch at 0x6fb5d450.
 */

import { ByteReader } from '../../core/byte-reader.ts'
import type { UnitType } from '../../domain/ids.ts'
import type { ServerEvent } from '../../domain/server-event.ts'

/** 0x00 GameLoading (1B, D2Client.dll 0x6fb5c520) */
export function decode0x00GameLoading(_pkt: Uint8Array): ServerEvent {
  return { type: 'GameLoading' }
}

/** 0x01 GameFlags / GameLogonReceipt (8B, D2Client.dll 0x6fb5fa90) */
export function decode0x01GameFlags(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x01
  const difficultyRaw = r.u8()
  const difficulty = (difficultyRaw <= 2 ? difficultyRaw : 0) as 0 | 1 | 2
  const arenaFlags = r.u32LE()
  const expansionByte = r.u8()
  const ladderByte = r.u8()
  return {
    type: 'GameFlags',
    difficulty,
    hardcore: (arenaFlags & 0x0800) !== 0,
    expansion: expansionByte !== 0,
    ladder: ladderByte !== 0,
  }
}

/** 0x02 GameLogonSuccess (1B, D2Client.dll 0x6fb5c4f0) */
export function decode0x02GameLogonSuccess(_pkt: Uint8Array): ServerEvent {
  return { type: 'GameLoading' }
}

/** 0x03 LoadAct (12B, D2Client.dll 0x6fb5db50) */
export function decode0x03LoadAct(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x03
  const act = r.u8()
  const mapSeed = r.u32LE()
  const areaId = r.u16LE()
  const objectSeed = r.u32LE()
  return {
    type: 'LoadAct',
    act,
    mapSeed,
    areaId,
    objectSeed,
  }
}

/** 0x04 LoadDone (1B, D2Client.dll 0x6fb5dfe0) */
export function decode0x04LoadDone(_pkt: Uint8Array): ServerEvent {
  return { type: 'LoadComplete' }
}

/** 0x05 UnloadDone (1B, D2Client.dll 0x6fb5cb70) */
export function decode0x05UnloadDone(_pkt: Uint8Array): ServerEvent {
  return { type: 'UnloadComplete' }
}

/** 0x06 GameLogoutSuccess (1B, D2Client.dll 0x6fb5caa0) */
export function decode0x06GameLogout(_pkt: Uint8Array): ServerEvent {
  return { type: 'GameLogout' }
}

/** 0x07 MapAdd / RoomReveal (6B, D2Client.dll 0x6fb5c440) */
export function decode0x07RoomReveal(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x07
  const tileX = r.u16LE()
  const tileY = r.u16LE()
  const areaId = r.u8()
  return {
    type: 'RoomReveal',
    areaId,
    tileX,
    tileY,
  }
}

/** 0x08 MapRemove / RoomHide (6B, D2Client.dll 0x6fb5c3d0) */
export function decode0x08RoomHide(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x08
  const tileX = r.u16LE()
  const tileY = r.u16LE()
  const areaId = r.u8()
  return {
    type: 'RoomHide',
    areaId,
    tileX,
    tileY,
  }
}

/** 0x0B GameHandshake (6B, D2Client.dll 0x6fb5d6e0) */
export function decode0x0BGameHandshake(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x0B
  const unitType = (r.u8() & 0x07) as UnitType
  const id = r.u32LE()
  return {
    type: 'UnitAssign',
    classId: -1,
    unit: {
      unitType,
      id,
      classId: -1,
      x: 0,
      y: 0,
    },
    isSelf: true,
  }
}

/** 0xB0 ConnectionTerminated (1B, D2Client.dll 0x6fb5d450) */
export function decode0xB0ConnectionTerminated(_pkt: Uint8Array): ServerEvent {
  return { type: 'GameLogout' }
}

/** 0xB3 SaveChunk (variable pkt[1], D2Client.dll 0x6fb5cd70) */
export function decode0xB3SaveChunk(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0xB3
  const chunkLen = r.u8()
  const isFirst = r.u8() === 0
  const totalSize = r.u32LE()
  const payloadLen = Math.max(0, Math.min(pkt.byteLength - 7, chunkLen))
  const chunk = r.bytes(payloadLen)
  return {
    type: 'SaveChunk',
    isFirst,
    totalSize,
    chunk,
  }
}

/** 0xB4 TimeoutReason / CantEnterGame (5B, D2Client.dll 0x6fb5cbf0) */
export function decode0xB4TimeoutReason(pkt: Uint8Array): ServerEvent {
  if (pkt.byteLength >= 5) {
    const r = new ByteReader(pkt)
    r.u8() // 0xB4
    const reason = r.u32LE()
    return { type: 'GameLogout', reason }
  }
  return { type: 'GameLogout' }
}
