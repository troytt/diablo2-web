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

/**
 * 0x4B RequestEntityUpdate (9B): `u8 0x4B | u32 unitType | u32 unitId`.
 *
 * D2Game 0x6FCEC6E0 (`Rcv0x4B_RequestEntityUpdate`, dispatch table `0x6FD1A2D0`) looks up the
 * target unit (`SUNIT_GetServerUnit`), verifies `D2Common.#10394(pPlayer, pUnit)`, calls
 * `D2Common.#10424(pUnit)`, and sets `pUnit->dwFlagEx |= 0x10000` (`0x6FCEC732`), which causes
 * the next server tick (`0x6FC98936..0x6FC98961`) to invoke `0x6FCEBB10`
 * (`D2GAME_SendPacket0x15_ReassignPlayer(pUnit, pClient, bRefresh=1)`) and send S2C `0x15`
 * (`ReassignPlayer`, 11B) with the authoritative server coordinates regardless of distance.
 */
export function encodeC2sRequestEntityUpdate(unitType: number, unitId: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x4b)
  w.u32LE(unitType >>> 0)
  w.u32LE(unitId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}
