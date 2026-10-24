/**
 * D2GS S->C Chat, Overhead Speech, and Event Message Packet Decoders (1.13c).
 * Verified against D2Client.dll:
 * - 0x26 ChatMessage (variable null-terminated strings, 0x6fb5f9f0)
 * - 0x5A EventMessages (40B, 0x6fb5d6b0)
 */

import { ByteReader } from '../../core/byte-reader.ts'
import type { TextEncoding } from '../../core/text-codec.ts'
import { unitTypeToId } from '../../domain/ids.ts'
import type { ServerEvent } from '../../domain/server-event.ts'

/**
 * 0x26 ChatMessage (variable size, D2Client.dll 0x6fb5f9f0 -> 0x6fb2dee0):
 * u8 0x26 | u8 chatType | u8 locale | u8 unitType | u32 unitId | u8 color | u8 subType | string nick\0 | string msg\0
 */
export function decode0x26ChatMessage(pkt: Uint8Array, encoding: TextEncoding = 'gbk'): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x26
  const chatType = r.u8()
  r.u8() // locale
  const rawUnitType = r.u8()
  const unitType = unitTypeToId(rawUnitType)
  const unitId = r.u32LE()
  const color = r.u8()
  const subType = r.u8()
  const from = r.cString(encoding)
  const text = r.cString(encoding)

  let kind: 'say' | 'whisper' | 'overhead' | 'system' = 'say'
  if (chatType === 0x05) kind = 'overhead'
  else if (chatType === 0x02 || chatType === 0x06) kind = 'whisper'
  else if (chatType === 0x04) kind = 'system'

  return {
    type: 'Chat',
    kind,
    from: from.length > 0 ? from : undefined,
    unit: unitId !== 0 ? { unitType, id: unitId } : undefined,
    text,
    color,
    eventType: chatType,
    subType,
    name1: from,
    name2: text,
  }
}

/**
 * 0x5A EventMessages (40B, D2Client.dll 0x6fb5d6b0 -> 0x6fb2e200):
 * u8 0x5A | u8 eventType | u8 color | u32 arg | u8 unk(subType) | char[16] name1 | char[16] name2
 *
 * The packet handler 0x6fb5d6b0 only decodes these raw fields. The TBL message text and its colour are built
 * by the client message routine 0x6fb2e200, which `ClientWorld.apply('Chat')` runs for every `kind: 'event'`
 * message (`formatEventPacket0x5A` in `src/common/chat/chat-113c.ts`, ENG and CHI) — so the decoder carries
 * no free text (`text: ''`) and the raw `color`.
 */
export function decode0x5AEventMessage(pkt: Uint8Array, encoding: TextEncoding = 'gbk'): ServerEvent {
  const r = new ByteReader(pkt)
  r.u8() // 0x5A
  const eventType = r.u8()
  const color = r.u8()
  const arg = r.u32LE()
  const subType = r.u8()
  const name1 = r.fixedCString(16, encoding)
  const name2 = r.fixedCString(16, encoding)
  return {
    type: 'Chat',
    kind: 'event',
    from: name1 || undefined,
    text: '',
    color,
    eventType,
    arg,
    subType,
    name1,
    name2,
  }
}
