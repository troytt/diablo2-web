/**
 * D2GS C->S Chat (0x15) and Overhead Chat (0x14) Packet Builders (1.13c).
 */

import { ByteWriter } from '../../core/byte-writer.ts'
import type { TextEncoding } from '../../core/text-codec.ts'
import { validateC2sPacket } from '../framing-c2s.ts'

/** `D2Lang_GetLocaleId` (`#10000`) locale byte in `C2S 0x14`/`0x15` and `S2C 0x26` (`pkt[2]`, `gdwChatLocale` `0x6fbc3f60`). */
export const D2GS_CHAT_LOCALE_ENG = 0x00
export const D2GS_CHAT_LOCALE_CHI = 0x09

function hasNonAsciiText(str: string | undefined): boolean {
  if (!str) return false
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) >= 0x80) return true
  }
  return false
}

/**
 * Resolves `pkt[2]` (`gdwChatLocale`, `D2Client.dll` `0x6fb20afe` / `0x6fb20b34` -> `S2C 0x26` `0x6fb2f7ce` -> `0x6fb2b4f0`).
 * Native Windows clients check `pkt[2] in {6, 7, 9, 12}` in `0x6fb2b4f0` to decide whether to decode
 * multibyte chat via `MultiByteToWideChar(CP_ACP)` (`0x09` `LNG_CHI`) or single-byte Windows-1252 (`0x00`).
 */
export function resolveD2gsChatLocale(
  text: string,
  whisperTo?: string,
  encoding: TextEncoding = 'gbk',
): number {
  if (encoding === 'gbk' && (hasNonAsciiText(text) || hasNonAsciiText(whisperTo))) {
    return D2GS_CHAT_LOCALE_CHI
  }
  return D2GS_CHAT_LOCALE_ENG
}

/** 0x15 Chat (variable: u8 0x15 | u8 type | u8 locale | string msg\0 | string whisperTo\0 | u8 0) */
export function encodeC2sChat(
  text: string,
  whisperTo?: string,
  encoding: TextEncoding = 'gbk',
): Uint8Array {
  const w = new ByteWriter(64)
  w.u8(0x15)
  w.u8(whisperTo ? 0x02 : 0x01)
  w.u8(resolveD2gsChatLocale(text, whisperTo, encoding))
  w.cString(text, encoding)
  w.cString(whisperTo ?? '', encoding)
  w.u8(0x00)
  return validateC2sPacket(w.toUint8Array())
}

/** 0x14 OverheadChat (variable: u8 0x14 | u8 0 | u8 locale | string msg\0 | u8 0 | u8 0) */
export function encodeC2sOverheadChat(
  text: string,
  encoding: TextEncoding = 'gbk',
): Uint8Array {
  const w = new ByteWriter(64)
  w.u8(0x14)
  w.u8(0x00)
  w.u8(resolveD2gsChatLocale(text, undefined, encoding))
  w.cString(text, encoding)
  w.u8(0x00)
  w.u8(0x00)
  return validateC2sPacket(w.toUint8Array())
}

/**
 * 0x3F Say / Voice Emote (3B, D2Client.dll 0x6fae9c80..0x6fae9d60 -> 0x6fad9bf0):
 * u8 0x3F | u16 phraseId (0x19..0x20 = 25..32 for Numpad 0..7).
 */
export function encodeC2sSay(phraseId: number): Uint8Array {
  const w = new ByteWriter(3)
  w.u8(0x3f)
  w.u16LE(phraseId & 0xffff)
  return validateC2sPacket(w.toUint8Array())
}
