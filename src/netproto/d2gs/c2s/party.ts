/**
 * D2GS C->S Party & Hostility Packet Builders (0x5D, 0x5E, 1.13c).
 */

import { ByteWriter } from '../../core/byte-writer.ts'
import { validateC2sPacket } from '../framing-c2s.ts'

/** 0x5D SetPlayerRelationship (7B): u8 0x5D | u8 button | u8 state | u32 targetPlayerId */
export function encodeC2sHostile(targetPlayerId: number, hostile: boolean, button = 0x01): Uint8Array {
  const w = new ByteWriter(7)
  w.u8(0x5d)
  w.u8(button & 0xff)
  w.u8(hostile ? 0x01 : 0x00)
  w.u32LE(targetPlayerId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x5E PartyRequest (6B): u8 0x5E | u8 action | u32 targetPlayerId */
export function encodeC2sParty(action: number, targetPlayerId: number): Uint8Array {
  const w = new ByteWriter(6)
  w.u8(0x5e)
  w.u8(action & 0xff)
  w.u32LE(targetPlayerId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

export const encodeC2sPartyAction = encodeC2sParty

