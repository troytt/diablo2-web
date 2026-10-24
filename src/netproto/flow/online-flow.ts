/**
 * `D2OnlineFlow` orchestrating BNCS (port 6112) -> MCP (port 6113) -> D2GS (port 4000)
 * transitions and keeping BNCS/MCP alive while in-game.
 *
 * Connection loss is detected centrally here: every BNCS/MCP/D2GS connection the flow opens is
 * watched, and any close the flow did not ask for, any request timeout, any connect failure and any
 * command issued while its connection is gone produces exactly one `onSessionLost` event per flow.
 * Before that event is emitted the flow closes every remaining connection (no leaked sockets, timers or
 * reconnects) and enters state `closed`.
 */

import { BncsSession } from '../bncs/session.ts'
import { defaultClock } from '../core/clock.ts'
import { Emitter } from '../core/emitter.ts'
import { BncsCreateAccountError, ClosedError, ProtocolError, TimeoutError } from '../core/errors.ts'
import { resolveTextCodec } from '../core/text-codec.ts'
import { D2gsAdapter } from '../d2gs/adapter.ts'
import { D2gsSession } from '../d2gs/session.ts'
import type { GameServerAdapter } from '../domain/game-server-adapter.ts'
import type { CharClassId, ItemDataTables } from '../domain/ids.ts'
import type {
  CharCreateSpec,
  CharSummary,
  ChatEvent,
  GameCreateSpec,
  GameInfoDetail,
  GameListEntry,
  RealmInfo,
} from '../domain/lobby.ts'
import { McpSession } from '../mcp/session.ts'
import type { CloseReason } from '../transport/byte-stream.ts'
import type {
  D2OnlineConfig,
  D2OnlineSessionKind,
  D2OnlineSessionLost,
  D2OnlineSessionLostCause,
  D2OnlineState,
} from './config.ts'

export interface D2OnlineFlow {
  readonly state: D2OnlineState
  /** The loss that ended this flow, or `null` while the flow is healthy / was closed on purpose. */
  readonly sessionLost: D2OnlineSessionLost | null
  onState(cb: (s: D2OnlineState) => void): () => void
  /** Fires once when a BNCS/MCP/D2GS connection is lost (see `D2OnlineSessionLost`). */
  onSessionLost(cb: (ev: D2OnlineSessionLost) => void): () => void
  connectBnet(): Promise<void>
  connect(): Promise<void>
  createAccount(user: string, pass: string): Promise<void>
  login(user: string, pass: string): Promise<void>
  loginOrRegister(
    user: string,
    pass: string,
    opts?: {
      readonly register?: boolean | undefined
      readonly createNewAccount?: boolean | undefined
    },
  ): Promise<void>
  listRealms(): Promise<readonly RealmInfo[]>
  enterRealm(realm?: string): Promise<readonly CharSummary[]>
  realmLogon(realm?: string): Promise<readonly CharSummary[]>
  listCharacters(): Promise<readonly CharSummary[]>
  listChars(): Promise<readonly CharSummary[]>
  createCharacter(spec: CharCreateSpec): Promise<void>
  createChar(
    specOrName: CharCreateSpec | string,
    classId?: CharClassId,
    opts?: { readonly expansion?: boolean; readonly hardcore?: boolean; readonly ladder?: boolean },
  ): Promise<void>
  deleteCharacter(name: string): Promise<void>
  deleteChar(name: string): Promise<void>
  upgradeCharacter(name: string): Promise<void>
  upgradeChar(name: string): Promise<void>
  selectCharacter(name: string): Promise<void>
  charLogon(name: string): Promise<void>
  listGames(
    filter?: string,
    options?: {
      readonly flags?: number | undefined
      readonly onGame?: ((game: GameListEntry, games: readonly GameListEntry[]) => void) | undefined
    },
  ): Promise<readonly GameListEntry[]>
  getGameInfo(name: string): Promise<GameInfoDetail>
  createGame(spec: GameCreateSpec): Promise<void>
  joinGame(name: string, password?: string): Promise<GameServerAdapter>
  enterChat(): Promise<void>
  joinChannel(channel: string): Promise<void>
  sendChannelChat(text: string): Promise<void>
  sendChat(text: string): Promise<void>
  onChannelEvent(cb: (ev: ChatEvent) => void): () => void
  onChatEvent(cb: (ev: ChatEvent) => void): () => void
  leaveToLobby(): Promise<void>
  close(): Promise<void>
}

const FALLBACK_EMPTY_TABLES: ItemDataTables = {
  itemStatCost: new Map(),
  armor: new Map(),
  weapons: new Map(),
  misc: new Map(),
  getStatMeta: () => undefined,
  getStatCost: () => undefined,
  getItemBaseMeta: () => undefined,
  getItemMeta: () => undefined,
}

const SESSION_LABEL: Readonly<Record<D2OnlineSessionKind, string>> = {
  bncs: 'BNCS',
  mcp: 'MCP realm',
  d2gs: 'D2GS game',
}

type SessionLostInfo = Omit<D2OnlineSessionLost, 'flowState'>

/** Drop the `[ProtocolError conn=.. packet=.. offset=..]` prefix so user-facing reasons stay readable. */
function stripProtocolPrefix(message: string): string {
  return message.replace(/^\[ProtocolError [^\]]*\]\s*/, '')
}

function errorText(err: unknown): string {
  return stripProtocolPrefix(err instanceof Error ? err.message : String(err))
}

function describeClose(kind: D2OnlineSessionKind, reason: CloseReason): SessionLostInfo {
  const label = SESSION_LABEL[kind]
  if (reason.kind === 'error') {
    return {
      session: kind,
      cause: 'error',
      message: `${label} connection error: ${errorText(reason.error)}`,
      error: reason.error,
    }
  }
  const remoteReason = reason.kind === 'remote' && reason.reason ? reason.reason : undefined
  const details: string[] = []
  if (reason.code !== undefined) details.push(`code ${reason.code}`)
  if (remoteReason !== undefined) details.push(`reason "${remoteReason}"`)
  return {
    session: kind,
    cause: 'closed',
    message: `${label} connection closed${reason.kind === 'remote' ? ' by server' : ''}${
      details.length > 0 ? ` (${details.join(', ')})` : ''
    }`,
    ...(reason.code !== undefined ? { closeCode: reason.code } : {}),
    ...(remoteReason !== undefined ? { closeReason: remoteReason } : {}),
  }
}

/** Transport-level failures of a request/response exchange mean the connection is unusable. */
function classifyExchangeFailure(kind: D2OnlineSessionKind, err: unknown): SessionLostInfo | null {
  if (err instanceof TimeoutError) {
    return { session: kind, cause: 'timeout', message: `${SESSION_LABEL[kind]} ${errorText(err)}`, error: err }
  }
  if (err instanceof ClosedError) {
    return { session: kind, cause: 'error', message: `${SESSION_LABEL[kind]} ${errorText(err)}`, error: err }
  }
  return null
}

export function createD2OnlineFlow(config: D2OnlineConfig): D2OnlineFlow {
  const bnetHost = config.bnetHost
  const bnetPort = config.bnetPort ?? 6112
  const realmPort = config.realmPort ?? 6113
  const gamePort = config.gamePort ?? 4000
  const encoding = config.textEncoding ?? 'gbk'
  const textCodec = resolveTextCodec(encoding)
  const clock = config.clock ?? defaultClock
  const tables = config.itemTables ?? FALLBACK_EMPTY_TABLES

  const stateEmitter = new Emitter<D2OnlineState>()
  const chatEmitter = new Emitter<ChatEvent>()
  const lostEmitter = new Emitter<D2OnlineSessionLost>()

  let currentState: D2OnlineState = 'idle'
  let bncs: BncsSession | undefined
  let mcp: McpSession | undefined
  let d2gsSession: D2gsSession | undefined
  let d2gsAdapter: D2gsAdapter | undefined
  let selectedCharName = ''
  let selectedCharClass = 0
  let selectedCharHardcore = false
  let lastRealmTitle = ''
  let knownChars: readonly CharSummary[] = []
  let lost: D2OnlineSessionLost | null = null
  /** BNCS/MCP loss seen while a D2GS game runs: reported when that game ends instead of aborting it. */
  let pendingLost: D2OnlineSessionLost | null = null
  /** Bumped by every teardown so connections that finish opening afterwards are disposed, not adopted. */
  let epoch = 0

  function setState(next: D2OnlineState): void {
    if (currentState !== next) {
      currentState = next
      stateEmitter.emit(next)
    }
  }

  /**
   * Close every connection the flow owns. References are cleared before closing, so the resulting
   * close callbacks fail the identity checks in the watchers and are never reported as losses.
   */
  function teardownConnections(): void {
    epoch++
    const game = d2gsSession
    d2gsSession = undefined
    d2gsAdapter = undefined
    const realm = mcp
    mcp = undefined
    const bnet = bncs
    bncs = undefined
    if (game) {
      try {
        game.leaveAndClose()
      } catch {
        // The socket is already gone; nothing left to release.
      }
    }
    realm?.close()
    bnet?.close()
  }

  function declareLost(info: SessionLostInfo): void {
    if (lost) return
    const ev: D2OnlineSessionLost = { ...info, flowState: currentState }
    lost = ev
    pendingLost = null
    teardownConnections()
    setState('closed')
    lostEmitter.emit(ev)
  }

  function onConnectionLost(info: SessionLostInfo): void {
    if (lost) return
    if (info.session !== 'd2gs' && d2gsSession !== undefined && currentState === 'ingame') {
      pendingLost ??= { ...info, flowState: currentState }
      if (info.session === 'bncs') {
        bncs?.close()
        bncs = undefined
      } else {
        mcp?.close()
        mcp = undefined
      }
      return
    }
    declareLost(info)
  }

  function watchLobbyConnection(kind: 'bncs' | 'mcp', session: BncsSession | McpSession): void {
    session.onClose((reason) => {
      const active = kind === 'bncs' ? bncs : mcp
      if (lost || active !== session) return
      onConnectionLost(describeClose(kind, reason))
    })
  }

  function watchGameConnection(session: D2gsSession): void {
    session.onClose((reason) => {
      if (lost || d2gsSession !== session) return
      const info = describeClose('d2gs', reason)
      const earlier = pendingLost
      declareLost(earlier ? { ...info, message: `${info.message}; earlier: ${earlier.message}` } : info)
    })
  }

  async function exchange<T>(
    kind: 'bncs' | 'mcp',
    op: () => Promise<T>,
    otherFailureCause?: D2OnlineSessionLostCause,
  ): Promise<T> {
    try {
      return await op()
    } catch (err) {
      const info =
        classifyExchangeFailure(kind, err) ??
        (otherFailureCause !== undefined
          ? { session: kind, cause: otherFailureCause, message: `${SESSION_LABEL[kind]} ${errorText(err)}`, ...(err instanceof Error ? { error: err } : {}) }
          : null)
      if (info) onConnectionLost(info)
      throw err
    }
  }

  function notConnected(kind: 'bncs' | 'mcp', op: string): never {
    const message = `${SESSION_LABEL[kind]} session is not connected for ${op}`
    const err = new ProtocolError(message, { proto: kind })
    onConnectionLost({ session: kind, cause: 'not_connected', message, error: err })
    throw err
  }

  function requireBncs(op: string): BncsSession {
    return bncs ?? notConnected('bncs', op)
  }

  function requireMcp(op: string): McpSession {
    return mcp ?? notConnected('mcp', op)
  }

  function staleConnectionError(kind: 'bncs' | 'mcp'): ProtocolError {
    return new ProtocolError(`D2OnlineFlow was closed while ${SESSION_LABEL[kind]} was connecting`, { proto: kind })
  }

  /**
   * Per `D2Launch.dll` (`0x6fa5ac25..0x6fa5ac30`) and `D2Multi.dll` (`0x6f9de5cf..0x6f9de5d8`),
   * PvPGN `d2cs` (`handle_d2cs.c`) only accepts character-screen packets (`0x02 MCP_CHARCREATE`,
   * `0x0A MCP_CHARDELETE`, `0x18 MCP_CHARUPGRADE`, `0x07 MCP_CHARLOGON`) in `d2cs_conn_state_authed`
   * (`McpSession.state === 'ready'`). When returning from the lobby (`state === 'charLoggedIn'`) to
   * switch/create/delete/upgrade characters, `D2Multi.dll` closes the current MCP connection
   * (`D2MCPClient_10018`) and `D2Launch.dll` re-logs into the realm via `SID_LOGONREALMEX`.
   */
  async function ensureRealmReadyForCharSelect(op: string): Promise<McpSession> {
    let m = requireMcp(op)
    if (m.state === 'charLoggedIn') {
      await flow.enterRealm(lastRealmTitle || undefined)
      m = requireMcp(op)
    }
    return m
  }

  /**
   * Per `D2Launch.dll` (`0x6fa5ac25 -> D2MCPClient_10007`) and PvPGN `d2cs` (`handle_d2cs.c`),
   * lobby packets (`0x03 MCP_CREATEGAME`, `0x04 MCP_JOINGAME`, `0x05 MCP_GAMELIST`, `0x06 MCP_GAMEINFO`)
   * are only valid in `d2cs_conn_state_charloggedin` (`McpSession.state === 'charLoggedIn'`). Sending
   * `0x05 MCP_GAMELIST` in `state === 'ready'` causes `d2cs` to immediately close the MCP socket.
   */
  async function ensureCharLoggedInForLobby(op: string): Promise<McpSession> {
    const m = requireMcp(op)
    if (m.state === 'ready') {
      const charToSelect = selectedCharName || knownChars[0]?.name || ''
      if (charToSelect) {
        await flow.selectCharacter(charToSelect)
      }
    }
    return requireMcp(op)
  }

  const flow: D2OnlineFlow = {
    get state(): D2OnlineState {
      return currentState
    },

    get sessionLost(): D2OnlineSessionLost | null {
      return lost
    },

    onState(cb: (s: D2OnlineState) => void): () => void {
      return stateEmitter.on(cb)
    },

    onSessionLost(cb: (ev: D2OnlineSessionLost) => void): () => void {
      return lostEmitter.on(cb)
    },

    async connectBnet(): Promise<void> {
      // A (re)connect starts a fresh lifecycle for this flow.
      teardownConnections()
      lost = null
      pendingLost = null
      selectedCharName = ''
      selectedCharClass = 0
      selectedCharHardcore = false
      lastRealmTitle = ''
      knownChars = []
      const startEpoch = epoch
      setState('connecting_bnet')
      let stream
      try {
        stream = await config.resolver.open('bnet', bnetHost, bnetPort)
      } catch (err) {
        if (startEpoch === epoch) {
          declareLost({
            session: 'bncs',
            cause: 'connect_failed',
            message: `BNCS connect to ${bnetHost}:${bnetPort} failed: ${errorText(err)}`,
            ...(err instanceof Error ? { error: err } : {}),
          })
        }
        throw err
      }
      if (startEpoch !== epoch) {
        stream.close()
        throw staleConnectionError('bncs')
      }
      const session = new BncsSession(stream, {
        clock,
        textCodec,
        packetTap: config.tap,
        keepaliveIntervalMs: config.bncsKeepaliveIntervalMs,
      })
      bncs = session
      watchLobbyConnection('bncs', session)
      session.onChatEvent((ev) => chatEmitter.emit(ev))
      await exchange('bncs', () => session.handshake())
    },

    async connect(): Promise<void> {
      await flow.connectBnet()
    },

    async createAccount(user: string, pass: string): Promise<void> {
      if (!bncs) {
        await flow.connectBnet()
      }
      const session = requireBncs('createAccount')
      const res = await exchange('bncs', () => session.createAccount(user, pass))
      if (res.status !== 0) {
        throw new BncsCreateAccountError(res.status, res.nameSuggestion, user)
      }
    },

    async login(user: string, pass: string): Promise<void> {
      await flow.loginOrRegister(user, pass, { register: false })
    },

    async loginOrRegister(
      user: string,
      pass: string,
      opts?: {
        readonly register?: boolean | undefined
        readonly createNewAccount?: boolean | undefined
      },
    ): Promise<void> {
      if (!bncs) {
        await flow.connectBnet()
      }
      const session = requireBncs('login')
      if (opts?.createNewAccount) {
        const createRes = await exchange('bncs', () => session.createAccount(user, pass))
        if (createRes.status !== 0) {
          throw new BncsCreateAccountError(createRes.status, createRes.nameSuggestion, user)
        }
        const loginRes = await exchange('bncs', () => session.login(user, pass))
        if (loginRes.status !== 0) {
          throw new ProtocolError(
            `BNCS SID_LOGONRESPONSE2 failed after registration for "${user}" with status=0x${loginRes.status.toString(16)}`,
            { proto: 'bncs', packetId: 0x3a },
          )
        }
      } else if (opts?.register) {
        const firstLogin = await exchange('bncs', () => session.login(user, pass))
        if (firstLogin.status !== 0) {
          const createRes = await exchange('bncs', () => session.createAccount(user, pass))
          if (createRes.status !== 0) {
            throw new BncsCreateAccountError(createRes.status, createRes.nameSuggestion, user)
          }
          const secondLogin = await exchange('bncs', () => session.login(user, pass))
          if (secondLogin.status !== 0) {
            throw new ProtocolError(
              `BNCS SID_LOGONRESPONSE2 failed after registration for "${user}" with status=0x${secondLogin.status.toString(16)}`,
              { proto: 'bncs', packetId: 0x3a },
            )
          }
        }
      } else {
        const loginRes = await exchange('bncs', () => session.login(user, pass))
        if (loginRes.status !== 0) {
          throw new ProtocolError(
            `BNCS SID_LOGONRESPONSE2 failed for "${user}" with status=0x${loginRes.status.toString(16)}`,
            { proto: 'bncs', packetId: 0x3a },
          )
        }
      }
      setState('authenticated')
    },

    async listRealms(): Promise<readonly RealmInfo[]> {
      const session = requireBncs('listRealms')
      return await exchange('bncs', () => session.listRealms())
    },

    async enterRealm(realm?: string): Promise<readonly CharSummary[]> {
      const session = requireBncs('enterRealm')
      let targetRealm = realm ?? (lastRealmTitle || config.defaultRealm)
      if (!targetRealm) {
        const realms = await exchange('bncs', () => session.listRealms())
        targetRealm = realms[0]?.title ?? 'D2CS'
      }
      const realmTitle = targetRealm
      lastRealmTitle = realmTitle

      // Close any existing MCP realm session cleanly before opening a new one (`D2MCPClient_10018`).
      const prevMcp = mcp
      mcp = undefined
      prevMcp?.close()

      setState('connecting_realm')
      const realmData = await exchange('bncs', () => session.logonRealm(realmTitle))
      const port = realmPort || realmData.mcpPort
      const startEpoch = epoch
      let mcpStream
      try {
        mcpStream = await config.resolver.open('realm', bnetHost, port)
      } catch (err) {
        if (startEpoch === epoch) {
          declareLost({
            session: 'mcp',
            cause: 'connect_failed',
            message: `MCP realm connect to ${bnetHost}:${port} failed: ${errorText(err)}`,
            ...(err instanceof Error ? { error: err } : {}),
          })
        }
        throw err
      }
      if (startEpoch !== epoch) {
        mcpStream.close()
        throw staleConnectionError('mcp')
      }
      const realmSession = new McpSession(mcpStream, {
        clock,
        textCodec,
        packetTap: config.tap,
      })
      mcp = realmSession
      watchLobbyConnection('mcp', realmSession)
      await exchange('mcp', () => realmSession.startup(realmData), 'connect_failed')
      knownChars = await exchange('mcp', () => realmSession.listChars(8))
      setState('realm_ready')
      return knownChars
    },

    async realmLogon(realm?: string): Promise<readonly CharSummary[]> {
      return await flow.enterRealm(realm)
    },

    async listCharacters(): Promise<readonly CharSummary[]> {
      const m = await ensureRealmReadyForCharSelect('listCharacters')
      knownChars = await exchange('mcp', () => m.listChars(8))
      return knownChars
    },

    async listChars(): Promise<readonly CharSummary[]> {
      return await flow.listCharacters()
    },

    async createCharacter(spec: CharCreateSpec): Promise<void> {
      const m = await ensureRealmReadyForCharSelect('createCharacter')
      const status = await exchange('mcp', () =>
        m.createChar(spec.name, spec.classId, {
          expansion: spec.expansion,
          hardcore: spec.hardcore,
          ladder: spec.ladder,
        }),
      )
      if (status !== 0) {
        throw new ProtocolError(
          `MCP_CHARCREATE failed for "${spec.name}" with status=0x${status.toString(16)}`,
          { proto: 'mcp', packetId: 0x02 },
        )
      }
      selectedCharName = spec.name
      selectedCharClass = spec.classId
      selectedCharHardcore = Boolean(spec.hardcore)
      knownChars = await exchange('mcp', () => m.listChars(8))
    },

    async createChar(
      specOrName: CharCreateSpec | string,
      classId: CharClassId = 1,
      opts?: { readonly expansion?: boolean; readonly hardcore?: boolean; readonly ladder?: boolean },
    ): Promise<void> {
      if (typeof specOrName === 'string') {
        await flow.createCharacter({
          name: specOrName,
          classId,
          expansion: opts?.expansion,
          hardcore: opts?.hardcore,
          ladder: opts?.ladder,
        })
      } else {
        await flow.createCharacter(specOrName)
      }
    },

    async deleteCharacter(name: string): Promise<void> {
      const m = await ensureRealmReadyForCharSelect('deleteCharacter')
      await exchange('mcp', () => m.deleteChar(name))
      knownChars = await exchange('mcp', () => m.listChars(8))
    },

    async deleteChar(name: string): Promise<void> {
      await flow.deleteCharacter(name)
    },

    async upgradeCharacter(name: string): Promise<void> {
      const m = await ensureRealmReadyForCharSelect('upgradeCharacter')
      await exchange('mcp', () => m.upgradeChar(name))
      knownChars = await exchange('mcp', () => m.listChars(8))
    },

    async upgradeChar(name: string): Promise<void> {
      await flow.upgradeCharacter(name)
    },

    async selectCharacter(name: string): Promise<void> {
      let m = requireMcp('selectCharacter')
      if (m.state === 'charLoggedIn') {
        if (m.activeCharacter && m.activeCharacter.toLowerCase() === name.toLowerCase()) {
          selectedCharName = name
          const foundSame = knownChars.find((c) => c.name.toLowerCase() === name.toLowerCase())
          if (foundSame) {
            selectedCharClass = foundSame.charClass
            selectedCharHardcore = foundSame.hardcore
          }
          return
        }
        await flow.enterRealm(lastRealmTitle || undefined)
        m = requireMcp('selectCharacter')
      }
      const status = await exchange('mcp', () => m.charLogon(name))
      if (status !== 0) {
        throw new ProtocolError(
          `MCP_CHARLOGON failed for "${name}" with status=0x${status.toString(16)}`,
          { proto: 'mcp', packetId: 0x07 },
        )
      }
      selectedCharName = name
      const found = knownChars.find((c) => c.name.toLowerCase() === name.toLowerCase())
      if (found) {
        selectedCharClass = found.charClass
        selectedCharHardcore = found.hardcore
      }
    },

    async charLogon(name: string): Promise<void> {
      await flow.selectCharacter(name)
    },

    async listGames(
      filter = '',
      options?: {
        readonly flags?: number | undefined
        readonly onGame?: ((game: GameListEntry, games: readonly GameListEntry[]) => void) | undefined
      },
    ): Promise<readonly GameListEntry[]> {
      const m = await ensureCharLoggedInForLobby('listGames')
      // Per D2Multi.dll (0x6f9e4850 -> D2MCPClient.dll 0x6fa27230):
      // flags is 0x800 when the active character is Hardcore (`flags & 0x04`), else 0.
      const flags = options?.flags ?? (selectedCharHardcore ? 0x800 : 0)
      return await exchange('mcp', () =>
        m.listGames(filter, {
          flags,
          onGame: options?.onGame,
        }),
      )
    },

    async getGameInfo(name: string): Promise<GameInfoDetail> {
      const m = await ensureCharLoggedInForLobby('getGameInfo')
      return await exchange('mcp', () => m.getGameInfo(name))
    },

    async createGame(spec: GameCreateSpec): Promise<void> {
      const m = await ensureCharLoggedInForLobby('createGame')
      const res = await exchange('mcp', () => m.createGame(spec))
      if (res.status !== 0) {
        throw new ProtocolError(
          `MCP_CREATEGAME failed for "${spec.name}" with status=0x${res.status.toString(16)}`,
          { proto: 'mcp', packetId: 0x03 },
        )
      }
    },

    async joinGame(name: string, password = ''): Promise<GameServerAdapter> {
      requireMcp('joinGame')
      if (!selectedCharName) {
        throw new ProtocolError('Cannot joinGame before selectCharacter()', { proto: 'mcp' })
      }
      const m = await ensureCharLoggedInForLobby('joinGame')
      const ticket = await exchange('mcp', () => m.joinGame(name, password))
      if (ticket.status !== 0) {
        throw new ProtocolError(
          `MCP_JOINGAME failed for "${name}" with status=0x${ticket.status.toString(16)}`,
          { proto: 'mcp', packetId: 0x04 },
        )
      }
      setState('connecting_game')

      const startEpoch = epoch
      let gameStream
      try {
        gameStream = await config.resolver.open('game', bnetHost, gamePort)
      } catch (err) {
        if (startEpoch === epoch && !lost) setState(mcp ? 'realm_ready' : 'idle')
        throw err
      }
      if (startEpoch !== epoch) {
        gameStream.close()
        throw new ProtocolError('D2OnlineFlow was closed while D2GS was connecting', { proto: 'd2gs' })
      }
      const session = new D2gsSession({
        stream: gameStream,
        logon: {
          gameHash: ticket.gameHash,
          gameToken: ticket.gameToken,
          charClass: selectedCharClass,
          charName: selectedCharName,
        },
        clock,
        tap: config.tap,
      })
      const adapter = new D2gsAdapter({
        session,
        tables,
        encoding,
        clock,
      })
      d2gsSession = session
      d2gsAdapter = adapter

      try {
        const charNameForJoin = selectedCharName
        await new Promise<void>((resolve, reject) => {
          let settled = false
          let lastHandshakeState = session.state
          let cancelLogonTimer: (() => void) | undefined

          const cleanup = (): void => {
            if (cancelLogonTimer) {
              cancelLogonTimer()
              cancelLogonTimer = undefined
            }
            cancelTimer()
            unsubState()
            unsubErr()
          }

          const armLogonSentTimer = (): void => {
            if (cancelLogonTimer) return
            // PvPGN d2gs + d2dbs quirk (Issue #963): when `charName` is already locked in an active
            // game on d2dbs (`D2DBS_GETDATA_CHARLOCKED`), d2gs sends `[0xAF, 0x01]` and receives
            // `0x68 GameLogon` (`state = 'logonSent'`), then silently drops the logon without sending
            // `0x02 GameLogonSuccess` (which normally arrives in ~90ms). Fail fast after 3000ms with
            // an explicit duplicate-character message instead of hanging on the door animation.
            cancelLogonTimer = clock.setTimeout(() => {
              if (settled || session.state !== 'logonSent') return
              settled = true
              cleanup()
              reject(
                new ProtocolError(
                  `该角色 "${charNameForJoin}" 已经登录并处于游戏中，无法重复创建或加入房间 (Unable to enter game: D2GS handshake timed out in state=logonSent)`,
                  { proto: 'd2gs', packetId: 0x68 },
                ),
              )
            }, 3_000)
          }

          const cancelTimer = clock.setTimeout(() => {
            if (settled) return
            settled = true
            cleanup()
            if (session.state === 'logonSent') {
              reject(
                new ProtocolError(
                  `该角色 "${charNameForJoin}" 已经登录并处于游戏中，无法重复创建或加入房间 (Unable to enter game: D2GS handshake timed out in state=logonSent)`,
                  { proto: 'd2gs', packetId: 0x68 },
                ),
              )
              return
            }
            reject(new ProtocolError(`D2GS handshake timed out (state=${session.state})`, { proto: 'd2gs' }))
          }, 12_000)

          const handleState = (s: typeof session.state): void => {
            if (settled) return
            if (s === 'logonSent') {
              lastHandshakeState = 'logonSent'
              armLogonSentTimer()
              return
            }
            if (cancelLogonTimer && s !== 'connecting') {
              cancelLogonTimer()
              cancelLogonTimer = undefined
            }
            if (s === 'ingame') {
              settled = true
              cleanup()
              setState('ingame')
              resolve()
            } else if (s === 'closed') {
              settled = true
              cleanup()
              if (lastHandshakeState === 'logonSent') {
                reject(
                  new ProtocolError(
                    `该角色 "${charNameForJoin}" 已经登录并处于游戏中，无法重复创建或加入房间 (Unable to enter game: D2GS closed connection after GameLogon, state=logonSent)`,
                    { proto: 'd2gs', packetId: 0x68 },
                  ),
                )
              } else {
                reject(new ProtocolError('D2GS connection closed during handshake', { proto: 'd2gs' }))
              }
            } else {
              lastHandshakeState = s
            }
          }

          const unsubState = session.onState(handleState)
          const unsubErr = session.onError((err) => {
            if (settled) return
            settled = true
            cleanup()
            reject(err)
          })

          if (session.state !== 'connecting') {
            handleState(session.state)
          }
        })
      } catch (err) {
        // A failed game join leaves BNCS/MCP usable (1.13c returns to the lobby); only the D2GS
        // connection of this attempt is released.
        if (d2gsSession === session) {
          d2gsSession = undefined
          d2gsAdapter = undefined
          try {
            session.leaveAndClose()
          } catch {
            // Already closed.
          }
          if (!lost) setState(mcp ? 'realm_ready' : 'idle')
        }
        throw err
      }

      watchGameConnection(session)
      return adapter
    },

    async enterChat(): Promise<void> {
      const session = requireBncs('enterChat')
      await exchange('bncs', () => session.enterChat(selectedCharName))
    },

    async joinChannel(channel: string): Promise<void> {
      const session = requireBncs('joinChannel')
      try {
        session.joinChannel(channel)
      } catch (err) {
        const info = classifyExchangeFailure('bncs', err)
        if (info) onConnectionLost(info)
        throw err
      }
    },

    async sendChannelChat(text: string): Promise<void> {
      const session = requireBncs('sendChannelChat')
      try {
        session.sendChat(text)
      } catch (err) {
        const info = classifyExchangeFailure('bncs', err)
        if (info) onConnectionLost(info)
        throw err
      }
    },

    async sendChat(text: string): Promise<void> {
      await flow.sendChannelChat(text)
    },

    onChannelEvent(cb: (ev: ChatEvent) => void): () => void {
      return chatEmitter.on(cb)
    },

    onChatEvent(cb: (ev: ChatEvent) => void): () => void {
      return chatEmitter.on(cb)
    },

    async leaveToLobby(): Promise<void> {
      const game = d2gsSession
      d2gsSession = undefined
      d2gsAdapter = undefined
      if (game) {
        try {
          game.leaveAndClose()
        } catch {
          // Already closed.
        }
      }
      if (pendingLost) {
        const { flowState: _flowState, ...info } = pendingLost
        declareLost(info)
        return
      }
      setState(mcp ? 'realm_ready' : 'idle')
    },

    async close(): Promise<void> {
      pendingLost = null
      teardownConnections()
      setState('closed')
    },
  }

  return flow
}
