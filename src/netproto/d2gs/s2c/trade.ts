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

/**
 * 0x92 (6B, D2Client.dll 0x6fb5e230 -> 0x6fb34c60): looks up unit (type @1, id @2) and walks its inventory,
 * removing items by node (node 3 always, node 1 on a #10970 match; Item.cpp), then refreshes the unit
 * (0x6fb32fe0). It has nothing to do with the trade window. D2Game.dll 0x6fc90c90 sends `0x92, 0, playerId`.
 */
export function decode0x92RemoveObjectTrade(pkt: Uint8Array): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x92
  const rawUnitType = r.u8()
  const id = r.u32LE()
  return {
    type: 'ProtocolSync',
    opcode: 0x92,
    byteLength: pkt.byteLength,
    unit: { rawUnitType, id },
  }
}
