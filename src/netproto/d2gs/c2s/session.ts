/**
 * D2GS C->S Session Lifecycle Packet Builders (0x68 GameLogon, 0x6B EnterGame, 0x6D Ping, 0x69 LeaveGame).
 * Verified against D2Net.dll 0x6fbfabd8 and live 1.13c D2GS handshake.
 */

import { ByteWriter } from '../../core/byte-writer.ts'
import { validateC2sPacket } from '../framing-c2s.ts'

export interface D2gsGameLogonParams {
  readonly gameHash: number
  readonly gameToken: number
  readonly charClass: number
  readonly charName: string
  readonly versionByte?: number | undefined
  readonly locale?: number | undefined
}

/**
 * 0x68 GameLogon (37 bytes, D2Net.dll 0x6fbfabd8[0x68] == 37):
 * u8 0x68 | u32 gameHash | u16 gameToken | u8 charClass | u32 versionByte (0x0d)
 * | u32 0x50564ded | u32 0x423553b4 | u8 locale (0) | char[16] charName
 */
export function encodeC2sGameLogon(params: D2gsGameLogonParams): Uint8Array {
  const w = new ByteWriter(37)
  w.u8(0x68)
  w.u32LE(params.gameHash >>> 0)
  w.u16LE(params.gameToken & 0xffff)
  w.u8(params.charClass & 0xff)
  w.u32LE((params.versionByte ?? 0x0d) >>> 0)
  w.u32LE(0x50564ded)
  w.u32LE(0x423553b4)
  w.u8((params.locale ?? 0x00) & 0xff)
  w.fixedCString(params.charName, 16, 'latin1')
  return validateC2sPacket(w.toUint8Array())
}

/** 0x6B EnterGame (1B) */
export function encodeC2sEnterGame(): Uint8Array {
  return validateC2sPacket(new Uint8Array([0x6b]))
}

/** 0x6D Ping (13B): u8 0x6D | u32 tickCount | u32 delay | u32 0 */
export function encodeC2sPing(tickCount: number, delay = 0): Uint8Array {
  const w = new ByteWriter(13)
  w.u8(0x6d)
  w.u32LE(tickCount >>> 0)
  w.u32LE(delay >>> 0)
  w.u32LE(0)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x69 LeaveGame (1B) */
export function encodeC2sLeaveGame(): Uint8Array {
  return validateC2sPacket(new Uint8Array([0x69]))
}
