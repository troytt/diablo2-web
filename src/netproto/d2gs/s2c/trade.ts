/**
 * D2GS S->C Trade & Button Action Packet Decoders (1.13c).
 * Verified against D2Client.dll:
 * - 0x77 ButtonActions (2B, 0x6fb5f930)
 * - 0x78 TradeAccepted (21B, 0x6fb5bfd0)
 * - 0x79 GoldInTrade (6B, 0x6fb5bfb0)
 * - 0x92 RemoveObjectTrade (6B, 0x6fb5e230)
 */

import { ByteReader } from '../../core/byte-reader.ts'
import type { ServerEvent } from '../../domain/server-event.ts'

/** 0x77 ButtonActions (2B, D2Client.dll 0x6fb5f930) */
export function decode0x77ButtonActions(pkt: Uint8Array): ServerEvent {
  return {
    type: 'Trade',
    action: pkt[1] ?? 0,
  }
}

/** 0x78 TradeAccepted (21B, D2Client.dll 0x6fb5bfd0) */
export function decode0x78TradeAccepted(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x78
  const partnerName = r.fixedCString(16)
  const partnerId = r.u32LE()
  return {
    type: 'Trade',
    action: 0x78,
    partnerId,
    partnerName,
  }
}

/** 0x79 GoldInTrade (6B, D2Client.dll 0x6fb5bfb0) */
export function decode0x79GoldInTrade(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x79
  const bySelf = r.u8()
  const gold = r.u32LE()
  return {
    type: 'Trade',
    action: 0x7900 | bySelf,
    gold,
  }
}

/** 0x92 RemoveObjectTrade (6B, D2Client.dll 0x6fb5e230) */
export function decode0x92RemoveObjectTrade(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x92
  const unitType = r.u8()
  const partnerId = r.u32LE()
  return {
    type: 'Trade',
    action: 0x9200 | unitType,
    partnerId,
  }
}
