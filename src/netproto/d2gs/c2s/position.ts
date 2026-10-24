/**
 * D2GS C->S Player Position Resync Packet Builder (0x5F, 1.13c).
 */

import { ByteWriter } from '../../core/byte-writer.ts'
import { validateC2sPacket } from '../framing-c2s.ts'

function assertU16(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`0x5F UpdatePlayerPos ${what} must be a u16, got ${String(value)}`)
  }
}

/**
 * 0x5F UpdatePlayerPos (5B): `u8 0x5F | u16 x | u16 y`, the client's own sub-tile.
 *
 * D2Client 0x6FAC49E0 builds it when the position gate 0x6FADA1B0 finds the local player out
 * of tolerance; D2Game handles it at 0x6FC88530 (D2MOO `PlrMsg.cpp`
 * `D2GAME_PACKETCALLBACK_Rcv0x5F_UpdatePlayerPos`), answering with `0x15` when it disagrees.
 */
export function encodeC2sUpdatePlayerPos(x: number, y: number): Uint8Array {
  assertU16(x, 'x')
  assertU16(y, 'y')
  const w = new ByteWriter(5)
  w.u8(0x5f)
  w.u16LE(x)
  w.u16LE(y)
  return validateC2sPacket(w.toUint8Array())
}
