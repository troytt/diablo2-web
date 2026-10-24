/**
 * D2GS C->S Movement Packet Builders (0x01..0x04, 1.13c).
 */

import { ByteWriter } from '../../core/byte-writer.ts'
import { unitTypeToId, type Pt, type UnitRef } from '../../domain/ids.ts'
import { validateC2sPacket } from '../framing-c2s.ts'

/** 0x01 Walk (5B) or 0x03 Run (5B) */
export function encodeC2sMove(run: boolean, to: Pt): Uint8Array {
  const w = new ByteWriter(5)
  w.u8(run ? 0x03 : 0x01)
  w.u16LE(to.x & 0xffff)
  w.u16LE(to.y & 0xffff)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x02 WalkToUnit (9B) or 0x04 RunToUnit (9B) */
export function encodeC2sMoveToUnit(run: boolean, target: UnitRef): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(run ? 0x04 : 0x02)
  w.u32LE(unitTypeToId(target.unitType) >>> 0)
  w.u32LE(target.id >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x09 WarpTo (9B): u8 0x09 | u32 unitType (5 = tile) | u32 warpId */
export function encodeC2sWarpTo(warpId: number, unitType = 5): Uint8Array {
  const w = new ByteWriter(9)
  w.u8(0x09)
  w.u32LE(unitType >>> 0)
  w.u32LE(warpId >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/**
 * 0x59 MakeEntityMove (17B): u8 0x59 | u32 dwUnitType | u32 dwUnitGUID | u32 nX | u32 nY
 * Ground Truth: D2MOO PlrMsg.cpp:3679-3717 (D2GSPacketClt59), D2Net.dll 0x6fbfabd8.
 */
export function encode0x59MakeEntityMove(target: UnitRef, to?: Pt): Uint8Array {
  const w = new ByteWriter(17)
  w.u8(0x59)
  w.u32LE(unitTypeToId(target.unitType) >>> 0)
  w.u32LE(target.id >>> 0)
  w.u32LE((to?.x ?? 0) >>> 0)
  w.u32LE((to?.y ?? 0) >>> 0)
  return validateC2sPacket(w.toUint8Array())
}

/**
 * 0x53 TurnOnRun (1B) / 0x54 TurnOffRun (1B), D2Client.dll 0x6faeae40 / 0x6faeadf0.
 */
export function encodeC2sRunToggle(run: boolean): Uint8Array {
  const w = new ByteWriter(1)
  w.u8(run ? 0x53 : 0x54)
  return validateC2sPacket(w.toUint8Array())
}


