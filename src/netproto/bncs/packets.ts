/**
 * BNCS (Battle.net Chat Server) packet encoders and decoders (`0x00..0x51`).
 * Verified against PvPGN `bnetd` and `Bnclient.dll` (1.13c).
 */

import { ByteReader } from '../core/byte-reader.ts'
import { ByteWriter } from '../core/byte-writer.ts'
import { defaultTextCodec, resolveTextCodec, type TextCodec } from '../core/text-codec.ts'
import type { HashedCdKeyBlock } from '../crypto/cdkey.ts'
import type { ChatEvent, ChatEventKind, RealmInfo } from '../domain/lobby.ts'
import { encodeBncsFrame, type BncsRawPacket } from './framing.ts'

export const BncsOpcode = {
  SID_NULL: 0x00,
  SID_STARTADVEX3: 0x1c,
  SID_MESSAGEBOX: 0x19,
  SID_NOTIFYJOIN: 0x22,
  SID_PING: 0x25,
  SID_LOGONRESPONSE: 0x29,
  SID_LOGONRESPONSE2: 0x3a,
  SID_CREATEACCOUNT2: 0x3d,
  SID_LOGONREALMEX: 0x3e,
  SID_QUERYREALMS2: 0x40,
  SID_AUTH_INFO: 0x50,
  SID_AUTH_CHECK: 0x51,
  SID_SETEMAIL: 0x59,
  SID_ENTERCHAT: 0x0a,
  SID_GETCHANNELLIST: 0x0b,
  SID_JOINCHANNEL: 0x0c,
  SID_CHATCOMMAND: 0x0e,
  SID_CHATEVENT: 0x0f,
} as const

export const BncsCreateAccountStatus = {
  OK: 0x00,
  TOO_SHORT: 0x01,
  INVALID_CHARS: 0x02,
  BANNED_WORD: 0x03,
  ALREADY_EXISTS: 0x04,
  STILL_PROCESSING: 0x05,
  NOT_ENOUGH_ALPHANUM: 0x06,
  ADJACENT_PUNCT: 0x07,
  TOO_MANY_PUNCT: 0x08,
} as const

export const FOURCC_IX86 = 0x49583836 // 'IX86' in LE: '68XI'
export const FOURCC_D2XP = 0x44325850 // 'D2XP' in LE: 'PX2D'
export const FOURCC_D2DV = 0x44324456 // 'D2DV' in LE: 'VD2D'

export interface BncsAuthInfoRequest {
  readonly protocolId?: number | undefined
  readonly platformId?: number | undefined
  readonly productId?: number | undefined
  readonly versionByte?: number | undefined
  readonly language?: number | undefined
  readonly localIp?: number | undefined
  readonly timeZoneBias?: number | undefined
  readonly localeId?: number | undefined
  readonly langId?: number | undefined
  readonly countryAbbr?: string | undefined
  readonly countryName?: string | undefined
}

export interface BncsAuthInfoResponse {
  readonly logonType: number
  readonly serverToken: number
  readonly udpValue: number
  readonly mpqFiletime: bigint
  readonly mpqFilename: string
  readonly formulaString: string
}

export interface BncsAuthCheckRequest {
  readonly clientToken: number
  readonly exeVersion: number
  readonly exeHash: number
  readonly keys: readonly HashedCdKeyBlock[]
  readonly spawnCdKey?: boolean | undefined
  readonly exeInfo: string
  readonly ownerName: string
}

export interface BncsAuthCheckResponse {
  readonly result: number
  readonly info: string
}

export interface BncsCreateAccountResponse {
  readonly status: number
  readonly suggestion: string
  readonly nameSuggestion: string
}

export interface BncsLogonResponse2 {
  readonly status: number
  readonly info?: string | undefined
}

export interface BncsRealmLogonToken {
  readonly mcpCookie: number
  readonly mcpStatus: number
  readonly mcpIp: string
  readonly mcpPort: number
  readonly mcpChunk1: Uint8Array // 8 bytes
  readonly mcpChunk2: Uint8Array // 48 bytes
  readonly uniqueName: string
}

export interface BncsEnterChatResponse {
  readonly uniqueName: string
  readonly statString: string
  readonly accountName: string
}

export type DecodedBncsS2cPacket =
  | { readonly type: 'SID_NULL' }
  | { readonly type: 'SID_PING'; readonly pingValue: number }
  | { readonly type: 'SID_AUTH_INFO'; readonly data: BncsAuthInfoResponse }
  | { readonly type: 'SID_AUTH_CHECK'; readonly data: BncsAuthCheckResponse }
  | { readonly type: 'SID_CREATEACCOUNT2'; readonly data: BncsCreateAccountResponse }
  | { readonly type: 'SID_LOGONRESPONSE2'; readonly data: BncsLogonResponse2 }
  | { readonly type: 'SID_QUERYREALMS2'; readonly realms: readonly RealmInfo[] }
  | { readonly type: 'SID_LOGONREALMEX'; readonly data: BncsRealmLogonToken }
  | { readonly type: 'SID_ENTERCHAT'; readonly data: BncsEnterChatResponse }
  | { readonly type: 'SID_GETCHANNELLIST'; readonly channels: readonly string[] }
  | { readonly type: 'SID_CHATEVENT'; readonly event: ChatEvent }
  | { readonly type: 'SID_MESSAGEBOX'; readonly style: number; readonly text: string; readonly caption: string }
  | { readonly type: 'SID_SETEMAIL' }
  | { readonly type: 'UNKNOWN'; readonly id: number; readonly payload: Uint8Array }

export function encodeBncsNull(): Uint8Array {
  return encodeBncsFrame(BncsOpcode.SID_NULL, new Uint8Array(0))
}

export function encodeBncsPing(pingValue: number): Uint8Array {
  const w = new ByteWriter(4)
  w.u32(pingValue)
  return encodeBncsFrame(BncsOpcode.SID_PING, w.toUint8Array())
}

export function encodeBncsAuthInfo(
  req: BncsAuthInfoRequest = {},
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  const w = new ByteWriter(64)
  w.u32(req.protocolId ?? 0)
  w.u32(req.platformId ?? FOURCC_IX86)
  w.u32(req.productId ?? FOURCC_D2XP)
  w.u32(req.versionByte ?? 0x0d)
  w.u32(req.language ?? 0x00000409)
  w.u32(req.localIp ?? 0x0100007f)
  w.u32(req.timeZoneBias ?? 480)
  w.u32(req.localeId ?? 1033)
  w.u32(req.langId ?? 1033)
  w.cstring(req.countryAbbr ?? 'USA', codec)
  w.cstring(req.countryName ?? 'United States', codec)
  return encodeBncsFrame(BncsOpcode.SID_AUTH_INFO, w.toUint8Array())
}

export function encodeBncsAuthCheck(
  req: BncsAuthCheckRequest,
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  const w = new ByteWriter(128)
  w.u32(req.clientToken)
  w.u32(req.exeVersion)
  w.u32(req.exeHash)
  w.u32(req.keys.length)
  w.u32(req.spawnCdKey ? 1 : 0)
  for (const k of req.keys) {
    w.u32(k.keyLength)
    w.u32(k.productValue)
    w.u32(k.publicValue)
    w.u32(k.unknown)
    w.bytes(k.hashedKeyData)
  }
  w.cstring(req.exeInfo, codec)
  w.cstring(req.ownerName, codec)
  return encodeBncsFrame(BncsOpcode.SID_AUTH_CHECK, w.toUint8Array())
}

export function encodeBncsCreateAccount2(
  username: string,
  passwordHash20: Uint8Array,
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  const w = new ByteWriter(32)
  w.bytes(passwordHash20)
  w.cstring(username, codec)
  return encodeBncsFrame(BncsOpcode.SID_CREATEACCOUNT2, w.toUint8Array())
}

export function encodeBncsLogonResponse2(
  clientToken: number,
  serverToken: number,
  passwordProof20: Uint8Array,
  username: string,
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  const w = new ByteWriter(48)
  w.u32(clientToken)
  w.u32(serverToken)
  w.bytes(passwordProof20)
  w.cstring(username, codec)
  return encodeBncsFrame(BncsOpcode.SID_LOGONRESPONSE2, w.toUint8Array())
}

export function encodeBncsQueryRealms2(): Uint8Array {
  return encodeBncsFrame(BncsOpcode.SID_QUERYREALMS2, new Uint8Array(0))
}

export function encodeBncsLogonRealmEx(
  clientToken: number,
  realmPasswordProof20: Uint8Array,
  realmTitle: string,
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  const w = new ByteWriter(40)
  w.u32(clientToken)
  w.bytes(realmPasswordProof20)
  w.cstring(realmTitle, codec)
  return encodeBncsFrame(BncsOpcode.SID_LOGONREALMEX, w.toUint8Array())
}

export function encodeBncsEnterChat(
  charName = '',
  realm = '',
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  const w = new ByteWriter(32)
  w.cstring(charName, codec)
  w.cstring(realm, codec)
  return encodeBncsFrame(BncsOpcode.SID_ENTERCHAT, w.toUint8Array())
}

export function encodeBncsGetChannelList(
  productId = FOURCC_D2XP,
): Uint8Array {
  const w = new ByteWriter(4)
  w.u32(productId)
  return encodeBncsFrame(BncsOpcode.SID_GETCHANNELLIST, w.toUint8Array())
}

export function encodeBncsJoinChannel(
  channel: string,
  flags = 0x02,
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  const w = new ByteWriter(32)
  w.u32(flags)
  w.cstring(channel, codec)
  return encodeBncsFrame(BncsOpcode.SID_JOINCHANNEL, w.toUint8Array())
}

/**
 * Encodes `SID_CHATCOMMAND (0x0E)`.
 * Per `Bnclient.dll!SendChatCommand` (`0x6ff2c400` -> `Storm.dll!#902` `0x6fc257a0`) and
 * `D2Client.dll` (`0x6fb1fe8c`) / `D2Multi.dll` (`0x6f9d9e03`) (`D2Lang!Unicode::utf8ToUnicode` `0x6fc08cd0`),
 * Battle.net chat commands and `SID_CHATEVENT (0x0F)` payloads use UTF-8 on the wire (raw GBK bytes are
 * rejected and truncated by `Unicode::utf8ToUnicode` `0x6fc08c40`).
 */
export function encodeBncsChatCommand(
  text: string,
  codec: TextCodec = resolveTextCodec('utf-8'),
): Uint8Array {
  const w = new ByteWriter(text.length * 3 + 4)
  w.cstring(text, codec)
  return encodeBncsFrame(BncsOpcode.SID_CHATCOMMAND, w.toUint8Array())
}

function mapChatEventId(eventId: number): ChatEventKind {
  switch (eventId) {
    case 0x01:
      return 'showUser'
    case 0x02:
      return 'join'
    case 0x03:
      return 'leave'
    case 0x04:
      return 'whisper'
    case 0x05:
      return 'talk'
    case 0x06:
      return 'broadcast'
    case 0x07:
      return 'channel'
    case 0x09:
      return 'userFlags'
    case 0x0a:
      return 'whisperSent'
    case 0x0d:
      return 'channelFull'
    case 0x0e:
      return 'channelDoesNotExist'
    case 0x0f:
      return 'channelRestricted'
    case 0x12:
      return 'info'
    case 0x13:
      return 'error'
    case 0x17:
      return 'emote'
    default:
      return 'unknown'
  }
}

export function decodeBncsS2cPacket(
  pkt: BncsRawPacket,
  codec: TextCodec = defaultTextCodec,
): DecodedBncsS2cPacket {
  const r = new ByteReader(pkt.payload, 0, 'bnet', pkt.id)
  switch (pkt.id) {
    case BncsOpcode.SID_NULL:
      return { type: 'SID_NULL' }

    case BncsOpcode.SID_PING:
      return { type: 'SID_PING', pingValue: r.u32() }

    case BncsOpcode.SID_AUTH_INFO: {
      const logonType = r.u32()
      const serverToken = r.u32()
      const udpValue = r.u32()
      const mpqFiletime = r.u64BigInt()
      const mpqFilename = r.cstring(codec)
      const formulaString = r.cstring(codec)
      return {
        type: 'SID_AUTH_INFO',
        data: {
          logonType,
          serverToken,
          udpValue,
          mpqFiletime,
          mpqFilename,
          formulaString,
        },
      }
    }

    case BncsOpcode.SID_AUTH_CHECK: {
      const result = r.u32()
      const info = r.remaining > 0 ? r.cstring(codec) : ''
      return {
        type: 'SID_AUTH_CHECK',
        data: { result, info },
      }
    }

    case BncsOpcode.SID_CREATEACCOUNT2: {
      const status = r.u32()
      const suggestion = r.remaining > 0 ? r.cstring(codec) : ''
      return {
        type: 'SID_CREATEACCOUNT2',
        data: { status, suggestion, nameSuggestion: suggestion },
      }
    }

    case BncsOpcode.SID_LOGONRESPONSE:
    case BncsOpcode.SID_LOGONRESPONSE2: {
      const status = r.u32()
      const info = r.remaining > 0 ? r.cstring(codec) : undefined
      return {
        type: 'SID_LOGONRESPONSE2',
        data: info !== undefined ? { status, info } : { status },
      }
    }

    case BncsOpcode.SID_QUERYREALMS2: {
      r.u32() // unknown
      const count = r.u32()
      const realms: RealmInfo[] = []
      for (let i = 0; i < count; i++) {
        const id = r.u32()
        const title = r.cstring(codec)
        const description = r.cstring(codec)
        realms.push({ id, title, description })
      }
      return { type: 'SID_QUERYREALMS2', realms }
    }

    case BncsOpcode.SID_LOGONREALMEX: {
      const mcpCookie = r.u32()
      const mcpStatus = r.u32()
      if (r.remaining < 16) {
        return {
          type: 'SID_LOGONREALMEX',
          data: {
            mcpCookie,
            mcpStatus,
            mcpIp: '0.0.0.0',
            mcpPort: 6113,
            mcpChunk1: new Uint8Array(8),
            mcpChunk2: new Uint8Array(48),
            uniqueName: '',
          },
        }
      }
      // Verified against D2MCPClient.dll 0x6fa27510:
      // +0x00: u32 mcpCookie
      // +0x04: u32 mcpStatus
      // +0x08: u32[2] mcpChunk1 (8 bytes)
      // +0x10: u32 mcpIp (4 bytes IPv4)
      // +0x14: u32 mcpPort (network byte order u16 at [0..1] or [2..3])
      // +0x18: u32[12] mcpChunk2 (48 bytes)
      // +0x48: cstring uniqueName
      const mcpChunk1 = r.bytes(8)
      const ipBytes = r.bytes(4)
      const portBytes = r.bytes(4)
      const mcpIp = `${ipBytes[0]!}.${ipBytes[1]!}.${ipBytes[2]!}.${ipBytes[3]!}`
      const pHi = (portBytes[0]! << 8) | portBytes[1]!
      const pLo = (portBytes[2]! << 8) | portBytes[3]!
      const mcpPort = pHi !== 0 ? pHi : pLo !== 0 ? pLo : 6113
      const mcpChunk2 = r.remaining >= 48 ? r.bytes(48) : new Uint8Array(48)
      const uniqueName = r.remaining > 0 ? r.cstring(codec) : ''
      return {
        type: 'SID_LOGONREALMEX',
        data: {
          mcpCookie,
          mcpStatus,
          mcpIp,
          mcpPort,
          mcpChunk1,
          mcpChunk2,
          uniqueName,
        },
      }
    }

    case BncsOpcode.SID_ENTERCHAT: {
      const uniqueName = r.cstring(codec)
      const statString = r.cstring(codec)
      const accountName = r.cstring(codec)
      return {
        type: 'SID_ENTERCHAT',
        data: { uniqueName, statString, accountName },
      }
    }

    case BncsOpcode.SID_GETCHANNELLIST: {
      const channels: string[] = []
      while (r.remaining > 0) {
        const ch = r.cstring(codec)
        if (ch.length === 0) break
        channels.push(ch)
      }
      return { type: 'SID_GETCHANNELLIST', channels }
    }

    case BncsOpcode.SID_CHATEVENT: {
      const eventId = r.u32()
      const userFlags = r.u32()
      const ping = r.u32()
      r.u32() // ip
      r.u32() // accountNumber
      r.u32() // registrationAuthority
      const username = r.cstring(codec)
      const text = r.cstring(codec)
      return {
        type: 'SID_CHATEVENT',
        event: {
          eventId,
          kind: mapChatEventId(eventId),
          userFlags,
          ping,
          username,
          text,
        },
      }
    }

    case BncsOpcode.SID_MESSAGEBOX: {
      const style = r.u32()
      const text = r.cstring(codec)
      const caption = r.cstring(codec)
      return { type: 'SID_MESSAGEBOX', style, text, caption }
    }

    case BncsOpcode.SID_SETEMAIL:
      return { type: 'SID_SETEMAIL' }

    default:
      return { type: 'UNKNOWN', id: pkt.id, payload: pkt.payload }
  }
}
