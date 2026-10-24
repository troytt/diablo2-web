/**
 * MCP (`d2cs` Realm Server) session state machine.
 */

import type { BncsRealmLogonToken } from '../bncs/packets.ts'
import { systemClock, type Clock } from '../core/clock.ts'
import { TypedEmitter } from '../core/emitter.ts'
import { ProtocolError, TimeoutError } from '../core/errors.ts'
import type { PacketTap } from '../core/packet-tap.ts'
import { defaultTextCodec, type TextCodec } from '../core/text-codec.ts'
import type { CharClassId } from '../domain/ids.ts'
import type { CharSummary, GameInfoDetail, GameSummary } from '../domain/lobby.ts'
import type { ByteStream, CloseReason } from '../transport/byte-stream.ts'
import { MCP_GREETING_BYTE, McpFramer } from './framing.ts'
import {
  decodeMcpS2cPacket,
  encodeMcpCharCreate,
  encodeMcpCharDelete,
  encodeMcpCharList2,
  encodeMcpCharLogon,
  encodeMcpCharUpgrade,
  encodeMcpCreateGame,
  encodeMcpGameInfo,
  encodeMcpGameList,
  encodeMcpJoinGame,
  encodeMcpMotd,
  encodeMcpStartup,
  McpCharFlag,
  type DecodedMcpS2cPacket,
  type McpCreateGameResponse,
  type McpJoinGameResponse,
} from './packets.ts'

export type McpSessionState = 'connecting' | 'ready' | 'charLoggedIn' | 'closed'

export interface McpSessionOptions {
  readonly clock?: Clock | undefined
  readonly textCodec?: TextCodec | undefined
  readonly packetTap?: PacketTap | undefined
  readonly timeoutMs?: number | undefined
}

export class McpSession {
  private readonly stream: ByteStream
  private readonly clock: Clock
  private readonly codec: TextCodec
  private readonly tap?: PacketTap | undefined
  private readonly framer = new McpFramer()
  private readonly packetEmitter = new TypedEmitter<DecodedMcpS2cPacket>()
  private readonly closeEmitter = new TypedEmitter<CloseReason>()
  private readonly timeoutMs: number
  private nextReqId = 1
  private _state: McpSessionState = 'connecting'
  private _activeChar: string | null = null

  constructor(stream: ByteStream, options: McpSessionOptions = {}) {
    this.stream = stream
    this.clock = options.clock ?? systemClock
    this.codec = options.textCodec ?? defaultTextCodec
    this.tap = options.packetTap
    this.timeoutMs = options.timeoutMs ?? 10_000

    this.stream.onData(chunk => this.handleChunk(chunk))
    this.stream.onClose(reason => {
      this._state = 'closed'
      this.closeEmitter.emit(reason)
    })
  }

  get state(): McpSessionState {
    return this._state
  }

  get activeCharacter(): string | null {
    return this._activeChar
  }

  private sendRaw(bytes: Uint8Array, packetId?: number, packetName?: string): void {
    this.tap?.record({
      t: this.clock.now(),
      conn: 'realm',
      dir: 'c2s',
      raw: bytes,
      ...(packetId !== undefined ? { packetId } : {}),
      ...(packetName !== undefined ? { packetName } : {}),
    })
    this.stream.write(bytes)
  }

  private handleChunk(chunk: Uint8Array): void {
    const rawPackets = this.framer.push(chunk)
    for (const rawPkt of rawPackets) {
      const decoded = decodeMcpS2cPacket(rawPkt, this.codec)
      this.tap?.record({
        t: this.clock.now(),
        conn: 'realm',
        dir: 's2c',
        raw: rawPkt.raw,
        packetId: rawPkt.id,
        packetName: decoded.type,
        decoded,
      })
      this.packetEmitter.emit(decoded)
    }
  }

  private waitForPacket<T extends DecodedMcpS2cPacket['type']>(
    type: T,
    opName = type,
    predicate?: (pkt: Extract<DecodedMcpS2cPacket, { readonly type: T }>) => boolean,
  ): Promise<Extract<DecodedMcpS2cPacket, { readonly type: T }>> {
    return new Promise((resolve, reject) => {
      let settled = false
      const cancelTimeout = this.clock.setTimeout(() => {
        if (settled) return
        settled = true
        unsubPkt()
        unsubClose()
        reject(new TimeoutError('realm', this.timeoutMs, opName))
      }, this.timeoutMs)

      const unsubPkt = this.packetEmitter.on(pkt => {
        if (
          pkt.type === type &&
          !settled &&
          (!predicate || predicate(pkt as Extract<DecodedMcpS2cPacket, { readonly type: T }>))
        ) {
          settled = true
          cancelTimeout()
          unsubPkt()
          unsubClose()
          resolve(pkt as Extract<DecodedMcpS2cPacket, { readonly type: T }>)
        }
      })

      const unsubClose = this.closeEmitter.on(reason => {
        if (settled) return
        settled = true
        cancelTimeout()
        unsubPkt()
        unsubClose()
        reject(
          reason.kind === 'error'
            ? reason.error
            : new ProtocolError('realm', null, 0, `MCP closed while waiting for ${opName} (${reason.kind})`),
        )
      })
    })
  }

  async startup(token: BncsRealmLogonToken): Promise<number> {
    const wait = this.waitForPacket('MCP_STARTUP', 'MCP_STARTUP')
    this.sendRaw(new Uint8Array([MCP_GREETING_BYTE]), undefined, 'MCP_GREETING')
    const pkt = encodeMcpStartup(token, this.codec)
    this.sendRaw(pkt, 0x01, 'MCP_STARTUP')
    const { status } = await wait
    if (status !== 0) {
      throw new ProtocolError('realm', 0x01, 0, `MCP_STARTUP failed with status 0x${status.toString(16)}`)
    }
    this._state = 'ready'
    return status
  }

  async listChars(maxChars = 8): Promise<readonly CharSummary[]> {
    const wait = this.waitForPacket('MCP_CHARLIST2', 'MCP_CHARLIST2')
    const pkt = encodeMcpCharList2(maxChars)
    this.sendRaw(pkt, 0x19, 'MCP_CHARLIST2')
    const { chars } = await wait
    return chars
  }

  async createChar(
    name: string,
    charClass: CharClassId,
    options: {
      readonly expansion?: boolean | undefined
      readonly hardcore?: boolean | undefined
      readonly ladder?: boolean | undefined
    } = {},
  ): Promise<number> {
    let flags = 0
    if (options.expansion ?? true) flags |= McpCharFlag.EXPANSION
    if (options.hardcore ?? false) flags |= McpCharFlag.HARDCORE
    if (options.ladder ?? true) flags |= McpCharFlag.LADDER

    const wait = this.waitForPacket('MCP_CHARCREATE', 'MCP_CHARCREATE')
    const pkt = encodeMcpCharCreate(name, charClass, flags, this.codec)
    this.sendRaw(pkt, 0x02, 'MCP_CHARCREATE')
    const { status } = await wait
    return status
  }

  async deleteChar(name: string): Promise<number> {
    const wait = this.waitForPacket('MCP_CHARDELETE', 'MCP_CHARDELETE')
    const pkt = encodeMcpCharDelete(name, 0, this.codec)
    this.sendRaw(pkt, 0x0a, 'MCP_CHARDELETE')
    const { status } = await wait
    return status
  }

  async upgradeChar(name: string): Promise<number> {
    const wait = this.waitForPacket('MCP_CHARUPGRADE', 'MCP_CHARUPGRADE')
    const pkt = encodeMcpCharUpgrade(name, this.codec)
    this.sendRaw(pkt, 0x18, 'MCP_CHARUPGRADE')
    const { status } = await wait
    return status
  }

  async charLogon(name: string): Promise<number> {
    const wait = this.waitForPacket('MCP_CHARLOGON', 'MCP_CHARLOGON')
    const pkt = encodeMcpCharLogon(name, this.codec)
    this.sendRaw(pkt, 0x07, 'MCP_CHARLOGON')
    const { status } = await wait
    if (status === 0) {
      this._state = 'charLoggedIn'
      this._activeChar = name
    }
    return status
  }

  async listGames(
    filter = '',
    options?: {
      readonly flags?: number | undefined
      readonly onGame?: ((game: GameSummary, games: readonly GameSummary[]) => void) | undefined
    },
  ): Promise<readonly GameSummary[]> {
    let reqId = this.nextReqId++ & 0xffff
    if (reqId === 0) {
      reqId = this.nextReqId++ & 0xffff
    }
    const games: GameSummary[] = []

    return new Promise((resolve, reject) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        cancelTimer()
        unsubPkt()
        unsubClose()
        resolve(games)
      }

      const cancelTimer = this.clock.setTimeout(() => {
        finish()
      }, 1500)

      const unsubPkt = this.packetEmitter.on(pkt => {
        if (pkt.type === 'MCP_GAMELIST' && pkt.requestId === reqId) {
          // Per D2MCPClient.dll (0x6fa263e0) and D2Multi.dll (0x6f9ddc48..0x6f9ddca5, 0x6f9e2120):
          // End-of-list is signaled by an empty game name (`name === ""`) or sentinel status
          // `0xfffffffe` (`-2`) / `0xffffffff` (`-1`). Closed status entries (`(status & 0x04) === 0`
          // when `status !== 0`) are skipped without terminating the stream, while non-empty open
          // games (`(status & 0x04) !== 0`) are retained even when `playerCount === 0`.
          const statusU32 = pkt.game.status >>> 0
          if (
            pkt.game.name.length === 0 ||
            statusU32 === 0xffffffff ||
            statusU32 === 0xfffffffe
          ) {
            finish()
            return
          }
          const isClosedStatus = statusU32 !== 0 && (statusU32 & 0x04) === 0
          if (isClosedStatus) {
            return
          }
          // Deduplicate by u16/u32 game index (`D2Multi.dll` 0x6f9e2120) or case-insensitive name
          const lowerName = pkt.game.name.toLowerCase()
          const existingIdx = games.findIndex(
            g =>
              (pkt.game.index !== 0 && g.index === pkt.game.index) ||
              g.name.toLowerCase() === lowerName,
          )
          if (existingIdx >= 0) {
            games[existingIdx] = pkt.game
          } else {
            games.push(pkt.game)
          }
          options?.onGame?.(pkt.game, games)
        }
      })

      const unsubClose = this.closeEmitter.on(reason => {
        if (settled) return
        settled = true
        cancelTimer()
        unsubPkt()
        unsubClose()
        reject(
          reason.kind === 'error'
            ? reason.error
            : new Error(`MCP closed during listGames (${reason.kind})`),
        )
      })

      const pkt = encodeMcpGameList(reqId, filter, options?.flags ?? 0, this.codec)
      this.sendRaw(pkt, 0x05, 'MCP_GAMELIST')
    })
  }

  async getGameInfo(
    gameName: string,
    options?: {
      readonly timeoutMs?: number | undefined
    },
  ): Promise<GameInfoDetail> {
    let reqId = this.nextReqId++ & 0xffff
    if (reqId === 0) {
      reqId = this.nextReqId++ & 0xffff
    }
    const timeoutMs = options?.timeoutMs ?? 1500
    const unavailableInfo: GameInfoDetail = {
      name: gameName,
      status: 0xffffffff,
      uptimeSec: 0,
      creatorLevel: 0,
      levelDiff: 0,
      maxPlayers: 0,
      description: '',
      players: [],
    }

    return new Promise((resolve, reject) => {
      let settled = false
      const cleanup = () => {
        cancelTimer()
        unsubPkt()
        unsubClose()
      }

      const cancelTimer = this.clock.setTimeout(() => {
        if (settled) return
        settled = true
        cleanup()
        // Per PvPGN d2cs handle_d2cs_gameinforeq: when a requested game name does not exist
        // or has already closed, d2cs returns 0 without sending an S2C 0x06 packet.
        // Resolve with an unavailable GameInfoDetail (status = 0xffffffff) rather than throwing
        // TimeoutError so D2OnlineFlow does not tear down the active MCP connection.
        resolve(unavailableInfo)
      }, timeoutMs)

      const unsubPkt = this.packetEmitter.on(pkt => {
        if (pkt.type === 'MCP_GAMEINFO' && pkt.requestId === reqId) {
          if (settled) return
          settled = true
          cleanup()
          resolve({ ...pkt.info, name: gameName })
        }
      })

      const unsubClose = this.closeEmitter.on(reason => {
        if (settled) return
        settled = true
        cleanup()
        reject(
          reason.kind === 'error'
            ? reason.error
            : new Error(`MCP closed during getGameInfo (${reason.kind})`),
        )
      })

      const pkt = encodeMcpGameInfo(reqId, gameName, this.codec)
      this.sendRaw(pkt, 0x06, 'MCP_GAMEINFO')
    })
  }

  async createGame(options: {
    readonly name: string
    readonly password?: string | undefined
    readonly description?: string | undefined
    readonly difficulty?: 0 | 1 | 2 | undefined
    readonly maxPlayers?: number | undefined
    readonly levelDiff?: number | undefined
  }): Promise<McpCreateGameResponse> {
    const reqId = this.nextReqId++ & 0xffff
    const wait = this.waitForPacket('MCP_CREATEGAME', 'MCP_CREATEGAME', pkt => pkt.requestId === reqId)
    const pkt = encodeMcpCreateGame(
      {
        requestId: reqId,
        difficulty: options.difficulty ?? 0,
        levelDiff: options.levelDiff ?? 0xff,
        maxPlayers: options.maxPlayers ?? 8,
        gameName: options.name,
        gamePassword: options.password ?? '',
        gameDescription: options.description ?? '',
      },
      this.codec,
    )
    this.sendRaw(pkt, 0x03, 'MCP_CREATEGAME')
    const { data } = await wait
    return data
  }

  async joinGame(gameName: string, gamePassword = ''): Promise<McpJoinGameResponse> {
    const reqId = this.nextReqId++ & 0xffff
    const wait = this.waitForPacket('MCP_JOINGAME', 'MCP_JOINGAME', pkt => pkt.requestId === reqId)
    const pkt = encodeMcpJoinGame(reqId, gameName, gamePassword, this.codec)
    this.sendRaw(pkt, 0x04, 'MCP_JOINGAME')
    const { data } = await wait
    return data
  }

  async requestMotd(): Promise<{ readonly headline: string; readonly body: string }> {
    const wait = this.waitForPacket('MCP_MOTD', 'MCP_MOTD')
    const pkt = encodeMcpMotd()
    this.sendRaw(pkt, 0x12, 'MCP_MOTD')
    const { headline, body } = await wait
    return { headline, body }
  }

  onClose(cb: (reason: CloseReason) => void): () => void {
    return this.closeEmitter.on(cb)
  }

  close(): void {
    this._state = 'closed'
    this.stream.close()
  }
}
