/**
 * D2GS C->S Unit Interaction, Waypoint, Button, Resurrect, and Weapon Swap Packet Builders (1.13c).
 */

import { ByteWriter } from '../../core/byte-writer.ts'
import { unitTypeToId, type UnitRef } from '../../domain/ids.ts'
import { validateC2sPacket } from '../framing-c2s.ts'

/** 0x13 InteractUnit (9B): u8 0x13 | u32 unitType | u32 unitId */
export function encodeC2sInteract(target: UnitRef): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x13)
  w.u32LE(unitTypeToId(target.unitType) >>> 0)
  w.u32LE(target.id >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x49 WaypointAction (9B): u8 0x49 | u32 waypointUnitId | u32 destAreaId */
export function encodeC2sWaypointGo(waypointId: number, destAreaId: number): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x49)
  w.u32LE(waypointId >>> 0)
  w.u32LE(destAreaId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/**
 * 0x4F ClickButton button ids (1.13c). Sender call sites in D2Client.dll; dispatcher D2Game.dll 0x6fc94200.
 * - 0x02 TradeCancel (TRADEBTN_CANCEL): cancel / decline trade or close trade window.
 * - 0x03 TradeAccept (TRADEBTN_PERFORM): accept incoming trade invitation (`0x77 0x01`).
 * - 0x04 TradeOk (TRADEBTN_ACCEPT): check the trade accept button (`buysellbtn.dc6` frame 16 -> 17).
 * - 0x07 TradeUnaccept (TRADEBTN_GREENCHECK): uncheck the trade accept button.
 * - 0x08 TradeGold (TRADEBTN_SENDGOLD): amount = gold offered in the trade window.
 * - 0x12 CloseStash: amount 0.
 * - 0x13 WithdrawGold: stash -> inventory, amount (D2Game 0x6fc917e0; rejected if gold + amount > clvl*10000).
 * - 0x14 DepositGold: inventory -> stash, amount (D2Game 0x6fc917e0; clamped to the 2,500,000 bank cap).
 * - 0x18 Transmute: Horadric Cube transmute, amount 0.
 */
export const ClickButtonId = {
  TradeCancel: 0x02,
  TradeAccept: 0x03,
  TradeOk: 0x04,
  TradeUnaccept: 0x07,
  TradeGold: 0x08,
  CloseStash: 0x12,
  WithdrawGold: 0x13,
  DepositGold: 0x14,
  CloseCube: 0x17,
  Transmute: 0x18,
} as const

/**
 * 0x4F ClickButton (7B): u8 0x4F | u16 buttonId | u16 ((amount >>> 16) & 0xffff) | u16 (amount & 0xffff).
 */
export function encodeC2sClickButton(buttonId: number, amount = 0): Uint8Array {
  if (!Number.isInteger(buttonId) || buttonId < 0 || buttonId > 0xffff) {
    throw new RangeError(`ClickButton: invalid buttonId ${buttonId}`)
  }
  if (!Number.isInteger(amount) || amount < 0 || amount > 0xffffffff) {
    throw new RangeError(`ClickButton: invalid amount ${amount}`)
  }
  const w = new ByteWriter(7)
  w.u8(0x4f)
  w.u16LE(buttonId)
  w.u16LE((amount >>> 16) & 0xffff)
  w.u16LE(amount & 0xffff)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x40 RequestQuestData (1B) — D2Client.dll 0x6faccac0 / 0x6fac4380 */
export function encodeC2sRequestQuestData(): Uint8Array {
  return validateC2sPacket(new Uint8Array([0x40]))
}

/** 0x41 Resurrect (1B) */
export function encodeC2sResurrect(): Uint8Array {
  return validateC2sPacket(new Uint8Array([0x41]))
}

/** 0x48 CancelController / ResetBusy (1B, D2Client.dll 0x6fb39a04 / D2Game.dll 0x6fceb4e0) */
export function encodeC2sCancelController(): Uint8Array {
  return validateC2sPacket(new Uint8Array([0x48]))
}

/** 0x60 SwapWeapons (1B) */
export function encodeC2sSwapWeapons(): Uint8Array {
  return validateC2sPacket(new Uint8Array([0x60]))
}

/**
 * 0x44 StaffInOrifice (17B, D2Client.dll 0x6fb4fd70 / D2Game.dll 0x6fc94360):
 * u8 0x44 | u32 playerUnitId (or 0xffffffff) | u32 orificeObjectId | u32 staffItemId | u32 state
 * - state = 3: Confirm / Accept staff placement (`0x6fb4f8cf`)
 * - state = 2: Cancel / Close orifice UI without completing (`0x6fb501ef`, staffItemId = 0)
 */
export function encodeC2sStaffInOrifice(
  orificeObjectId: number,
  staffItemId: number,
  state: number,
  playerUnitId = 0xffffffff,
): Uint8Array {
  const w = new ByteWriter(17)
  w.u8(0x44)
  w.u32LE(playerUnitId >>> 0)
  w.u32LE(orificeObjectId >>> 0)
  w.u32LE(staffItemId >>> 0)
  w.u32LE(state >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

export { encodeC2sWarpTo } from './movement.ts'


