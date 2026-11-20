/**
 * D2GS S->C Waypoint Menu & Portal Packet Decoders (1.13c).
 * Verified against D2Client.dll:
 * - 0x60 TownPortalState (7B, 0x6fb5d2f0)
 * - 0x63 WaypointMenu (21B, 0x6fb5f8b0)
 * - 0x82 PortalOwnership (29B, 0x6fb5d160)
 */

import { ByteReader } from '../../core/byte-reader.ts'
import { ByteWriter } from '../../core/byte-writer.ts'
import type { ServerEvent } from '../../domain/server-event.ts'

/**
 * Encode S2C 0x63 WaypointMenu (21B), the exact inverse of `decode0x63WaypointMenu`:
 * - [0] u8 = 0x63
 * - [1..4] u32LE = waypoint object unit id
 * - [5..6] u16LE = per-difficulty waypoint struct header (`02 01`, as in the `.d2s` `WS` block)
 * - [7..20] 14 bytes = waypoint bitmask, bit i = waypoint index i (0..38, Acts 1..5)
 */
export function encode0x63WaypointMenu(ev: {
  readonly unitId: number
  readonly open: readonly number[]
}): Uint8Array {
  const w = new ByteWriter(21)
  w.u8(0x63)
  w.u32LE(ev.unitId >>> 0)
  w.u16LE(0x0102)
  const mask = new Uint8Array(14)
  for (const wp of ev.open) {
    if (!Number.isInteger(wp) || wp < 0 || wp > 38) {
      throw new Error(`encode0x63WaypointMenu: invalid waypoint index ${wp} (expected 0..38)`)
    }
    mask[wp >>> 3]! |= 1 << (wp & 7)
  }
  w.bytes(mask)
  return w.toUint8Array()
}

/** 0x63 WaypointMenu (21B, D2Client.dll 0x6fb5f8b0) */
export function decode0x63WaypointMenu(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x63
  const unitId = r.u32LE()
  r.u16LE() // unk
  // 14 bytes of waypoint bitmask (bits 0..38 correspond to the 39 waypoints across Acts 1..5)
  const maskBytes = r.bytes(14)
  const open: number[] = []
  for (let i = 0; i < 39; i++) {
    const byteIdx = i >>> 3
    const bitIdx = i & 7
    if (((maskBytes[byteIdx] ?? 0) & (1 << bitIdx)) !== 0) {
      open.push(i)
    }
  }
  return {
    type: 'WaypointMenu',
    unitId,
    open,
  }
}

/** 0x60 TownPortalState (7B, D2Client.dll 0x6fb5d2f0) */
export function decode0x60TownPortalState(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x60
  const flags = r.u8()
  const areaId = r.u8()
  const localId = r.u32LE()
  return {
    type: 'Portal',
    portalId: localId,
    areaId,
    localId,
    flags,
  }
}

/** 0x82 PortalOwnership (29B, D2Client.dll 0x6fb5d160) */
export function decode0x82PortalOwnership(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x82
  const ownerId = r.u32LE()
  const ownerName = r.fixedCString(16)
  const localId = r.u32LE()
  const remoteId = r.u32LE()
  return {
    type: 'Portal',
    portalId: localId,
    ownerId,
    ownerName,
    areaId: 0,
    localId,
    remoteId,
  }
}

