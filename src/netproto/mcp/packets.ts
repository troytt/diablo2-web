/**
 * MCP (`d2cs` Realm Server) packet encoders, decoders, and 33-byte `charStatString` parser.
 * Verified against `D2MCPClient.dll` (`0x6fa25e80..0x6fa26050`) and `d2cs` wire captures.
 */

import { ByteReader } from '../core/byte-reader.ts'
import { ByteWriter } from '../core/byte-writer.ts'
import { defaultTextCodec, type TextCodec } from '../core/text-codec.ts'
import type { BncsRealmLogonToken } from '../bncs/packets.ts'
import type { CharClassId } from '../domain/ids.ts'
import type { CharSummary, GameInfoDetail, GameSummary } from '../domain/lobby.ts'
import { encodeMcpFrame, type McpRawPacket } from './framing.ts'

export const McpOpcode = {
  MCP_STARTUP: 0x01,
  MCP_CHARCREATE: 0x02,
  MCP_CREATEGAME: 0x03,
  MCP_JOINGAME: 0x04,
  MCP_GAMELIST: 0x05,
  MCP_GAMEINFO: 0x06,
  MCP_CHARLOGON: 0x07,
  MCP_CHARDELETE: 0x0a,
  MCP_MOTD: 0x12,
  MCP_CHARLIST: 0x17,
  MCP_CHARUPGRADE: 0x18,
  MCP_CHARLIST2: 0x19,
} as const

export const McpCharFlag = {
  HARDCORE: 0x04,
  DEAD: 0x08,
  EXPANSION: 0x20,
  LADDER: 0x40,
} as const

export interface McpCreateGameRequest {
  readonly requestId: number
  readonly difficulty: 0 | 1 | 2
  readonly levelDiff?: number | undefined
  readonly maxPlayers?: number | undefined
  readonly gameName: string
  readonly gamePassword?: string | undefined
  readonly gameDescription?: string | undefined
}

export interface McpCreateGameResponse {
  readonly requestId: number
  readonly gameToken: number
  readonly unknown: number
  readonly status: number
}

export interface McpJoinGameResponse {
  readonly requestId: number
  readonly gameToken: number
  readonly unknown: number
  readonly d2gsIp: string
  readonly d2gsIpRaw: number
  readonly gameHash: number
  readonly status: number
}

export type DecodedMcpS2cPacket =
  | { readonly type: 'MCP_STARTUP'; readonly status: number }
  | { readonly type: 'MCP_CHARCREATE'; readonly status: number }
  | { readonly type: 'MCP_CHARLOGON'; readonly status: number }
  | { readonly type: 'MCP_CHARDELETE'; readonly status: number }
  | { readonly type: 'MCP_CHARUPGRADE'; readonly status: number }
  | { readonly type: 'MCP_CHARLIST2'; readonly totalChars: number; readonly chars: readonly CharSummary[] }
  | { readonly type: 'MCP_CREATEGAME'; readonly requestId: number; readonly data: McpCreateGameResponse }
  | { readonly type: 'MCP_JOINGAME'; readonly requestId: number; readonly data: McpJoinGameResponse }
  | { readonly type: 'MCP_GAMELIST'; readonly requestId: number; readonly game: GameSummary }
  | { readonly type: 'MCP_GAMEINFO'; readonly requestId: number; readonly info: GameInfoDetail }
  | { readonly type: 'MCP_MOTD'; readonly headline: string; readonly body: string }
  | { readonly type: 'UNKNOWN'; readonly id: number; readonly payload: Uint8Array }

/**
 * Parses the 33-byte (plus NUL) character portrait statstring from `MCP_CHARLIST2` (`0x19`):
 * - `[0..1]`: `0x84, 0x80` (or `0x8d, 0x80` when `bytes[1] === 0x80`)
 * - `[2..12]`: 11 equipment component graphics bytes (`HD, TR, LG, RA, LA, RH, LH, SH, S1, S2, S3`, `0xFF` = none)
 * - `[13]`: `charClass + 1` (`1..7` -> `0..6`)
 * - `[14..24]`: 11 equipment component dye color bytes (`0xFF` = default, `((raw - 1) & 0x1f)` = `Colors.txt` index)
 * - `[25]`: `charLevel` (`1..99`)
 * - `[26]`: `charFlags` low 7 bits | `0x80` (`0x04` Hardcore, `0x08` Dead, `0x20` Expansion, `0x40` Ladder)
 * - `[27]`: `actAndDiff` (`(nPackedValue >>> 7) | 0x80`, where `bits 1..5` = 5-bit `nProgression`)
 */
export function parseMcpCharStatString(
  name: string,
  expiresAt: number,
  statBytes: Uint8Array,
): CharSummary {
  const equipmentGraphics = new Uint8Array(11)
  equipmentGraphics.fill(0xff)
  for (let i = 0; i < 11 && i + 2 < statBytes.length; i++) {
    equipmentGraphics[i] = statBytes[i + 2]!
  }

  // Standard 33-byte statString (2B header + 11B comp + 1B class + 11B color + 1B level + 1B flags + 6B act/diff/padding)
  const isFull33 = statBytes.length >= 27
  const rawClass = isFull33 ? statBytes[13]! : statBytes.length > 11 ? statBytes[11]! : 1
  const classIdx = Math.max(0, Math.min(6, rawClass > 0 && rawClass <= 7 ? rawClass - 1 : 0)) as CharClassId
  const rawLevel = isFull33 ? statBytes[25]! : statBytes.length > 12 ? statBytes[12]! : 1
  const level = rawLevel === 0xff || rawLevel === 0 ? 1 : rawLevel
  const flags = isFull33 ? statBytes[26]! : statBytes.length > 13 ? statBytes[13]! : McpCharFlag.EXPANSION
  const expansion = (flags & McpCharFlag.EXPANSION) !== 0
  const actAndDiff = isFull33 && statBytes.length > 27 ? statBytes[27]! : statBytes.length > 26 ? statBytes[26]! : 0
  // Per D2Game.dll CLIENTS_FillCharacterPreviewInfo (0x6FC32810), Fog.#10085 FOG_Encode14BitsToString,
  // and D2Launch.dll (0x6fa4c887..0x6fa4c910):
  // D2PackedClientSaveFlags packs 5-bit nProgression at bits 8..12 (CLIENTSAVEFLAG_CHARACTER_PROGRESSION_BIT = 8).
  // FOG_Encode14BitsToString splits the 14-bit value into two 7-bit bytes with 0x80 set:
  //   statBytes[26] = (nPackedValue & 0x7f) | 0x80
  //   statBytes[27] = ((nPackedValue >>> 7) & 0x7f) | 0x80
  // Therefore bits 1..5 of statBytes[27] hold the 5-bit character progression: (statBytes[27] >>> 1) & 0x1f.
  // Expansion (5 acts/difficulty): >= 10 -> Hell (2), >= 5 -> Nightmare (1), else Normal (0).
  // Classic (4 acts/difficulty):   >= 8  -> Hell (2), >= 4 -> Nightmare (1), else Normal (0).
  const progression = (actAndDiff >>> 1) & 0x1f
  const actsPerDiff = expansion ? 5 : 4
  const act = (progression % actsPerDiff) + 1
  const difficulty: 0 | 1 | 2 = expansion
    ? progression >= 10
      ? 2
      : progression >= 5
        ? 1
        : 0
    : progression >= 8
      ? 2
      : progression >= 4
        ? 1
        : 0

  return {
    name,
    charClass: classIdx,
    level,
    hardcore: (flags & McpCharFlag.HARDCORE) !== 0,
    dead: (flags & McpCharFlag.DEAD) !== 0,
    expansion,
    ladder: (flags & McpCharFlag.LADDER) !== 0,
    act,
    difficulty,
    progression,
    expiresAt,
    equipmentGraphics,
    rawStatString: statBytes.slice(),
  }
}

export function encodeMcpStartup(
  token: BncsRealmLogonToken,
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  const w = new ByteWriter(80)
  w.u32(token.mcpCookie)
  w.u32(token.mcpStatus)
  w.bytes(token.mcpChunk1)
  w.bytes(token.mcpChunk2)
  w.cstring(token.uniqueName, codec)
  return encodeMcpFrame(McpOpcode.MCP_STARTUP, w.toUint8Array())
}

export function encodeMcpCharList2(maxChars = 8): Uint8Array {
  const w = new ByteWriter(4)
  w.u32(maxChars)
  return encodeMcpFrame(McpOpcode.MCP_CHARLIST2, w.toUint8Array())
}

export function encodeMcpCharCreate(
  name: string,
  charClass: CharClassId,
  flagsOrOpts:
    | number
    | {
        readonly expansion?: boolean | undefined
        readonly hardcore?: boolean | undefined
        readonly ladder?: boolean | undefined
      } = McpCharFlag.EXPANSION | McpCharFlag.LADDER,
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  let flags = 0
  if (typeof flagsOrOpts === 'number') {
    flags = flagsOrOpts
  } else {
    if (flagsOrOpts.expansion ?? true) flags |= McpCharFlag.EXPANSION
    if (flagsOrOpts.hardcore ?? false) flags |= McpCharFlag.HARDCORE
    if (flagsOrOpts.ladder ?? true) flags |= McpCharFlag.LADDER
  }
  const w = new ByteWriter(32)
  w.u32(charClass)
  w.u16(flags)
  w.cstring(name, codec)
  return encodeMcpFrame(McpOpcode.MCP_CHARCREATE, w.toUint8Array())
}

export function encodeMcpCharLogon(
  name: string,
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  const w = new ByteWriter(24)
  w.cstring(name, codec)
  return encodeMcpFrame(McpOpcode.MCP_CHARLOGON, w.toUint8Array())
}

export function encodeMcpCharDelete(
  name: string,
  flags = 0,
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  const w = new ByteWriter(24)
  w.u16(flags)
  w.cstring(name, codec)
  return encodeMcpFrame(McpOpcode.MCP_CHARDELETE, w.toUint8Array())
}

export function encodeMcpCharUpgrade(
  name: string,
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  const w = new ByteWriter(24)
  w.cstring(name, codec)
  return encodeMcpFrame(McpOpcode.MCP_CHARUPGRADE, w.toUint8Array())
}

export function encodeMcpCreateGame(
  reqOrRequestId: McpCreateGameRequest | number,
  codecOrOpts?:
    | TextCodec
    | {
        readonly name: string
        readonly password?: string | undefined
        readonly description?: string | undefined
        readonly difficulty?: 0 | 1 | 2 | number | undefined
        readonly maxPlayers?: number | undefined
        readonly levelDiff?: number | undefined
      },
  maybeCodec?: TextCodec,
): Uint8Array {
  let req: McpCreateGameRequest
  let codec: TextCodec = defaultTextCodec
  if (typeof reqOrRequestId === 'number') {
    const opts = (codecOrOpts ?? { name: '' }) as {
      readonly name: string
      readonly password?: string | undefined
      readonly description?: string | undefined
      readonly difficulty?: 0 | 1 | 2 | number | undefined
      readonly maxPlayers?: number | undefined
      readonly levelDiff?: number | undefined
    }
    codec = maybeCodec ?? defaultTextCodec
    req = {
      requestId: reqOrRequestId,
      difficulty: ((opts.difficulty ?? 0) as 0 | 1 | 2),
      levelDiff: opts.levelDiff ?? 0xff,
      maxPlayers: opts.maxPlayers ?? 8,
      gameName: opts.name,
      gamePassword: opts.password ?? '',
      gameDescription: opts.description ?? '',
    }
  } else {
    req = reqOrRequestId
    if (codecOrOpts && 'encode' in codecOrOpts) {
      codec = codecOrOpts
    }
  }
  const w = new ByteWriter(64)
  w.u16(req.requestId)
  const diffFlag = req.difficulty === 1 ? 0x1000 : req.difficulty === 2 ? 0x2000 : 0x0000
  w.u32(diffFlag)
  w.u8(1) // unknown
  w.u8(req.levelDiff ?? 0xff)
  w.u8(req.maxPlayers ?? 8)
  w.cstring(req.gameName, codec)
  w.cstring(req.gamePassword ?? '', codec)
  w.cstring(req.gameDescription ?? '', codec)
  return encodeMcpFrame(McpOpcode.MCP_CREATEGAME, w.toUint8Array())
}

export function encodeMcpJoinGame(
  requestId: number,
  gameName: string,
  gamePassword = '',
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  const w = new ByteWriter(48)
  w.u16(requestId)
  w.cstring(gameName, codec)
  w.cstring(gamePassword, codec)
  return encodeMcpFrame(McpOpcode.MCP_JOINGAME, w.toUint8Array())
}

export function encodeMcpGameList(
  requestId: number,
  filter = '',
  flagsOrCodec: number | TextCodec = 0,
  maybeCodec: TextCodec = defaultTextCodec,
): Uint8Array {
  const flags = typeof flagsOrCodec === 'number' ? flagsOrCodec : 0
  const codec = typeof flagsOrCodec === 'number' ? maybeCodec : flagsOrCodec
  const w = new ByteWriter(32)
  w.u16(requestId)
  w.u32(flags >>> 0)
  w.cstring(filter, codec)
  return encodeMcpFrame(McpOpcode.MCP_GAMELIST, w.toUint8Array())
}

export function encodeMcpGameInfo(
  requestId: number,
  gameName: string,
  codec: TextCodec = defaultTextCodec,
): Uint8Array {
  const w = new ByteWriter(32)
  w.u16(requestId)
  w.cstring(gameName, codec)
  return encodeMcpFrame(McpOpcode.MCP_GAMEINFO, w.toUint8Array())
}

export function encodeMcpMotd(): Uint8Array {
  return encodeMcpFrame(McpOpcode.MCP_MOTD, new Uint8Array(0))
}

export function decodeMcpS2cPacket(
  pkt: McpRawPacket,
  codec: TextCodec = defaultTextCodec,
): DecodedMcpS2cPacket {
  const r = new ByteReader(pkt.payload, 0, 'realm', pkt.id)
  switch (pkt.id) {
    case McpOpcode.MCP_STARTUP:
      return { type: 'MCP_STARTUP', status: r.u32() }

    case McpOpcode.MCP_CHARCREATE:
      return { type: 'MCP_CHARCREATE', status: r.u32() }

    case McpOpcode.MCP_CHARLOGON:
      return { type: 'MCP_CHARLOGON', status: r.u32() }

    case McpOpcode.MCP_CHARDELETE:
      return { type: 'MCP_CHARDELETE', status: r.u32() }

    case McpOpcode.MCP_CHARUPGRADE:
      return { type: 'MCP_CHARUPGRADE', status: r.u32() }

    case McpOpcode.MCP_CHARLIST2:
    case McpOpcode.MCP_CHARLIST: {
      const isList2 = pkt.id === McpOpcode.MCP_CHARLIST2
      r.u16() // requested
      const totalChars = r.u32()
      const returned = r.u16()
      const chars: CharSummary[] = []
      for (let i = 0; i < returned && r.remaining > 0; i++) {
        const expiresAt = isList2 ? r.u32() : 0
        const name = r.cstring(codec)
        // Read null-terminated stat string bytes directly without UTF-8/GBK corruption
        const statStart = r.offset
        let statLen = 0
        while (r.remaining > 0 && r.peekU8() !== 0) {
          r.u8()
          statLen += 1
        }
        if (r.remaining > 0) {
          r.u8() // consume NUL
        }
        const statBytes = pkt.payload.subarray(statStart, statStart + statLen)
        chars.push(parseMcpCharStatString(name, expiresAt, statBytes))
      }
      return { type: 'MCP_CHARLIST2', totalChars, chars }
    }

    case McpOpcode.MCP_CREATEGAME: {
      const requestId = r.u16()
      const gameToken = r.u16()
      const unknown = r.u16()
      const status = r.u32()
      return {
        type: 'MCP_CREATEGAME',
        requestId,
        data: { requestId, gameToken, unknown, status },
      }
    }

    case McpOpcode.MCP_JOINGAME: {
      const requestId = r.u16()
      const gameToken = r.u16()
      const unknown = r.u16()
      const ipBytes = r.bytes(4)
      const d2gsIp = `${ipBytes[0]!}.${ipBytes[1]!}.${ipBytes[2]!}.${ipBytes[3]!}`
      const d2gsIpRaw =
        (ipBytes[0]! | (ipBytes[1]! << 8) | (ipBytes[2]! << 16) | (ipBytes[3]! << 24)) >>> 0
      const gameHash = r.u32()
      const status = r.u32()
      return {
        type: 'MCP_JOINGAME',
        requestId,
        data: { requestId, gameToken, unknown, d2gsIp, d2gsIpRaw, gameHash, status },
      }
    }

    case McpOpcode.MCP_GAMELIST: {
      const requestId = r.u16()
      const index = r.u32()
      const playerCount = r.u8()
      const status = r.u32()
      const name = r.remaining > 0 ? r.cstring(codec) : ''
      const description = r.remaining > 0 ? r.cstring(codec) : ''
      return {
        type: 'MCP_GAMELIST',
        requestId,
        game: { name, description, playerCount, index, status },
      }
    }

    case McpOpcode.MCP_GAMEINFO: {
      const requestId = r.u16()
      const status = r.u32()
      const uptimeSec = r.u32()
      const creatorLevel = r.u8()
      const levelDiff = r.u8()
      const maxPlayers = r.u8()
      const count = r.u8()
      const classes = r.bytes(16)
      const levels = r.bytes(16)
      const description = r.remaining > 0 ? r.cstring(codec) : ''
      const players: { name: string; charClass: CharClassId; level: number }[] = []
      for (let i = 0; i < 16 && i < count && r.remaining > 0; i++) {
        const pName = r.cstring(codec)
        if (pName.length > 0) {
          players.push({
            name: pName,
            charClass: Math.min(6, classes[i]!) as CharClassId,
            level: levels[i]!,
          })
        }
      }
      return {
        type: 'MCP_GAMEINFO',
        requestId,
        info: {
          name: '',
          status,
          uptimeSec,
          creatorLevel,
          levelDiff,
          maxPlayers,
          description,
          players,
        },
      }
    }

    case McpOpcode.MCP_MOTD: {
      r.u8() // unknown
      const headline = r.remaining > 0 ? r.cstring(codec) : ''
      const body = r.remaining > 0 ? r.cstring(codec) : ''
      return { type: 'MCP_MOTD', headline, body }
    }

    default:
      return { type: 'UNKNOWN', id: pkt.id, payload: pkt.payload }
  }
}
