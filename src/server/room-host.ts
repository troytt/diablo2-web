/**
 * Authoritative Multi-Client Room Host (`src/server/room-host.ts`).
 *
 * Multiplexes up to 8 concurrent `ByteStream` clients (`'ts'` or `'d2gs'`) over a single
 * 25Hz `GameInstance` (`OPEN_BNET_POLICY` / `CLOSED_REALM_POLICY`) with per-client AOI spatial filtering
 * and Party roster sync.
 * Strictly isomorphic: zero DOM globals, zero Node built-ins, zero `Math.random()` or wall-clock calls.
 */

import type {
  ByteStream,
  ClientCommand,
  CloseReason,
  ServerEvent,
  UnitType,
} from '../netproto/index.ts'
import { unitTypeFromId, unitTypeToId } from '../netproto/index.ts'
import {
  GameInstance,
  OPEN_BNET_POLICY,
  type ConnectPlayerSpec,
  type GameModePolicy,
} from './engine/game-instance.ts'
import { MAX_CATCHUP_FRAMES, SERVER_FRAME_MS } from './loopback-adapter.ts'
import { AoiFilter, DEFAULT_AOI_RADIUS_SUBTILES } from './net/aoi.ts'
import { PartyManager } from './net/party.ts'
import { RoomClientSession, type RoomWireProtocol } from './net/session.ts'

export interface MultiClientRoomHostConfig {
  readonly game?: GameInstance | undefined
  readonly gameInstance?: GameInstance | undefined
  readonly gameName?: string | undefined
  readonly mapSeed?: number | undefined
  readonly seed?: number | undefined
  readonly difficulty?: 0 | 1 | 2 | undefined
  readonly act?: number | undefined
  readonly actId?: number | undefined
  readonly areaId?: number | undefined
  readonly maxPlayers?: number | undefined
  readonly aoiRadius?: number | undefined
  readonly policy?: Partial<GameModePolicy> | undefined
  readonly registry?: unknown
  readonly onPlayerSave?:
    | ((charName: string, d2sBytes: Uint8Array, playerUnitId: number) => void)
    | undefined
}

export interface ConnectClientSpec extends ConnectPlayerSpec {
  readonly protocol?: RoomWireProtocol | undefined
}

export class MultiClientRoomHost {
  readonly gameInstance: GameInstance
  readonly aoiFilter: AoiFilter
  readonly partyManager: PartyManager

  private readonly sessionsByPlayerId = new Map<number, RoomClientSession>()
  private readonly sessionsById = new Map<number, RoomClientSession>()
  private readonly savedByPlayerId = new Map<number, Uint8Array>()
  private readonly savedByCharName = new Map<string, Uint8Array>()
  private readonly onPlayerSave:
    | ((charName: string, d2sBytes: Uint8Array, playerUnitId: number) => void)
    | undefined

  private nextSessionId = 1
  private accumMs = 0
  private closed = false

  constructor(config: MultiClientRoomHostConfig = {}) {
    const basePolicy = config.policy ?? OPEN_BNET_POLICY
    const maxPlayers = Math.max(
      1,
      Math.min(8, Math.floor(config.maxPlayers ?? basePolicy.maxPlayers ?? 8)),
    )
    this.gameInstance =
      config.game ??
      config.gameInstance ??
      new GameInstance({
        mode: basePolicy.mode ?? 'open',
        gameName: config.gameName ?? 'MultiplayerRoom',
        mapSeed: config.mapSeed ?? config.seed,
        difficulty: config.difficulty ?? 0,
        act: config.act ?? config.actId,
        areaId: config.areaId,
        maxPlayers,
        registry: config.registry,
        policy: {
          ...OPEN_BNET_POLICY,
          ...config.policy,
          maxPlayers,
        },
      })
    this.aoiFilter = new AoiFilter(config.aoiRadius ?? DEFAULT_AOI_RADIUS_SUBTILES)
    this.partyManager = new PartyManager()
    this.onPlayerSave = config.onPlayerSave
  }

  get game(): GameInstance {
    return this.gameInstance
  }

  get maxPlayers(): number {
    return this.gameInstance.policy.maxPlayers
  }

  get clientCount(): number {
    return this.sessionsByPlayerId.size
  }

  get clients(): ReadonlyMap<number, RoomClientSession> {
    return this.sessionsByPlayerId
  }

  get sessions(): readonly RoomClientSession[] {
    return Array.from(this.sessionsByPlayerId.values())
  }

  getConnectedPlayerIds(): number[] {
    return Array.from(this.sessionsByPlayerId.keys())
  }

  getSession(playerUnitId: number): RoomClientSession | undefined {
    return this.sessionsByPlayerId.get(playerUnitId) ?? this.sessionsById.get(playerUnitId)
  }

  getSavedCharacterD2s(charName: string): Uint8Array | undefined {
    const lower = charName.trim().toLowerCase()
    const saved = this.savedByCharName.get(lower)
    if (saved) return new Uint8Array(saved)
    for (const sess of this.sessionsByPlayerId.values()) {
      if (sess.charName.toLowerCase() === lower) {
        return this.gameInstance.exportPlayerD2s(sess.playerUnitId)
      }
    }
    return undefined
  }

  connectClient(stream: ByteStream, spec: ConnectClientSpec = {}): number {
    if (this.closed) {
      throw new Error('MultiClientRoomHost: room host is closed')
    }
    if (this.sessionsByPlayerId.size >= this.maxPlayers) {
      throw new Error(
        `MultiClientRoomHost: room is at maximum capacity (${this.sessionsByPlayerId.size}/${this.maxPlayers})`,
      )
    }

    const playerUnitId = this.gameInstance.connectPlayer(spec)
    const pState = this.gameInstance.getPlayerState(playerUnitId)!
    const sessionId = this.nextSessionId++

    this.partyManager.addPlayer(
      playerUnitId,
      pState.name,
      pState.classId,
      pState.level,
      pState.areaId,
    )

    const session = new RoomClientSession({
      sessionId,
      playerUnitId,
      charName: pState.name,
      classId: pState.classId,
      stream,
      protocol: spec.protocol,
      onCommand: (sess, cmd) => this.handleClientCommand(sess, cmd),
      onDisconnect: (sess, _reason) => this.handleSessionDisconnected(sess),
    })

    this.sessionsByPlayerId.set(playerUnitId, session)
    this.sessionsById.set(sessionId, session)
    return playerUnitId
  }

  attachClient(stream: ByteStream, spec: ConnectClientSpec = {}): RoomClientSession {
    const pid = this.connectClient(stream, spec)
    return this.sessionsByPlayerId.get(pid)!
  }

  disconnectClient(
    target: number | RoomClientSession,
    _reason?: string,
  ): Uint8Array | null {
    const session =
      target instanceof RoomClientSession
        ? target
        : (this.sessionsByPlayerId.get(target) ?? this.sessionsById.get(target))
    if (!session || !this.sessionsByPlayerId.has(session.playerUnitId)) {
      return null
    }
    const pid = session.playerUnitId
    session.disconnect({ kind: 'local' })
    const saved = this.savedByPlayerId.get(pid)
    return saved ? new Uint8Array(saved) : null
  }

  detachClient(target: number | RoomClientSession): Uint8Array | null {
    return this.disconnectClient(target)
  }

  private handleClientCommand(session: RoomClientSession, cmd: ClientCommand): void {
    if (this.closed || session.isClosed) return
    if (cmd.type === 'LeaveGame') {
      session.disconnect({ kind: 'local' })
      return
    }
    if (cmd.type === 'Ping') {
      session.sendEvent({
        type: 'Pong',
        rttMs: 0,
        tickCount: this.gameInstance.tickCount,
      })
      return
    }
    if (cmd.type === 'Party' || cmd.type === 'PartyAction') {
      if (cmd.action === 0x06) {
        this.partyManager.invite(session.playerUnitId, cmd.targetPlayerId)
      } else if (cmd.action === 0x08) {
        this.partyManager.accept(session.playerUnitId, cmd.targetPlayerId)
      } else if (cmd.action === 0x07 || cmd.action === 0x09) {
        this.partyManager.leaveParty(session.playerUnitId)
      }
    }
    this.gameInstance.enqueueCommand(session.playerUnitId, cmd)
  }

  private handleSessionDisconnected(session: RoomClientSession): void {
    if (!this.sessionsByPlayerId.has(session.playerUnitId)) return

    const pid = session.playerUnitId
    this.sessionsByPlayerId.delete(pid)
    this.sessionsById.delete(session.sessionId)
    this.partyManager.removePlayer(pid)
    this.aoiFilter.removeViewer(pid)
    this.aoiFilter.removeEntity('player', pid)

    const d2s = this.gameInstance.disconnectPlayer(pid)
    if (d2s) {
      this.savedByPlayerId.set(pid, d2s)
      this.savedByCharName.set(session.charName.toLowerCase(), d2s)
      this.onPlayerSave?.(session.charName, d2s, pid)
    }
  }

  getGameInstance(): GameInstance {
    return this.gameInstance
  }

  computeFrameLockstepHash(): number {
    return this.gameInstance.computeFrameLockstepHash()
  }

  getLastLockstepHash(): number {
    return this.gameInstance.computeFrameLockstepHash()
  }

  stepFrame(): number {
    if (this.closed) return this.gameInstance.tickCount
    this.gameInstance.stepFrame()
    this.flushAllClientEvents()
    return this.gameInstance.tickCount
  }

  stepFrames(count: number): number {
    if (this.closed || !Number.isFinite(count) || count <= 0) {
      return this.gameInstance.tickCount
    }
    const n = Math.floor(count)
    for (let i = 0; i < n; i++) {
      this.stepFrame()
    }
    return this.gameInstance.tickCount
  }

  tick(dtMs: number = SERVER_FRAME_MS): number {
    if (this.closed) return 0
    const clamped = Math.max(
      0,
      Math.min(
        Number.isFinite(dtMs) ? dtMs : SERVER_FRAME_MS,
        MAX_CATCHUP_FRAMES * SERVER_FRAME_MS,
      ),
    )
    this.accumMs += clamped
    let steps = 0
    while (this.accumMs >= SERVER_FRAME_MS && steps < MAX_CATCHUP_FRAMES) {
      this.accumMs -= SERVER_FRAME_MS
      this.stepFrame()
      steps++
    }
    return steps
  }

  private flushAllClientEvents(): void {
    for (const session of Array.from(this.sessionsByPlayerId.values())) {
      if (session.isClosed) continue
      const events = this.gameInstance.drainEvents(session.playerUnitId)
      const viewer = this.gameInstance.getPlayerState(session.playerUnitId)
      if (!viewer) continue

      for (const ev of events) {
        this.deliverEventWithAoi(session, viewer, ev)
      }
    }
  }

  private deliverEventWithAoi(
    session: RoomClientSession,
    viewer: {
      readonly unitId: number
      readonly areaId: number
      readonly x: number
      readonly y: number
    },
    ev: ServerEvent,
  ): void {
    const spatial = this.extractSpatialTarget(ev)
    if (
      !spatial ||
      (spatial.unitType === 'player' && spatial.unitId === viewer.unitId)
    ) {
      session.sendEvent(ev)
      return
    }

    const inRange = this.aoiFilter.isInRange(viewer, spatial)
    const wasVisible = this.aoiFilter.isVisible(
      viewer.unitId,
      spatial.unitType,
      spatial.unitId,
    )

    if (!inRange) {
      if (wasVisible) {
        this.aoiFilter.markHidden(viewer.unitId, spatial.unitType, spatial.unitId)
        session.sendEvent({
          type: 'UnitRemove',
          unitType: spatial.rawUnitType,
          id: spatial.unitId,
          unitId: spatial.unitId,
        })
      }
      return
    }

    if (!wasVisible && ev.type !== 'UnitAssign' && ev.type !== 'PlayerAssign') {
      this.aoiFilter.markVisible(viewer.unitId, spatial)
      if (spatial.unitType === 'player') {
        const otherPlayer = this.gameInstance.getPlayerState(spatial.unitId)
        if (otherPlayer) {
          session.sendEvent({
            type: 'UnitAssign',
            unitType: 'player',
            unitId: otherPlayer.unitId,
            classId: otherPlayer.classId,
            name: otherPlayer.name,
            x: Math.round(otherPlayer.x),
            y: Math.round(otherPlayer.y),
            areaId: otherPlayer.areaId,
            unit: {
              unitType: 0,
              id: otherPlayer.unitId,
              classId: otherPlayer.classId,
              name: otherPlayer.name,
              x: Math.round(otherPlayer.x),
              y: Math.round(otherPlayer.y),
              mode: otherPlayer.mode,
            },
          })
        }
      }
    } else if (ev.type === 'UnitAssign' || ev.type === 'PlayerAssign') {
      this.aoiFilter.markVisible(viewer.unitId, spatial)
    }

    session.sendEvent(ev)
  }

  private extractSpatialTarget(
    ev: ServerEvent,
  ):
    | {
        readonly unitType: UnitType
        readonly rawUnitType: 0 | 1 | 2 | 3 | 4 | 5
        readonly unitId: number
        readonly areaId: number
        readonly x: number
        readonly y: number
      }
    | undefined {
    switch (ev.type) {
      case 'UnitAssign': {
        const rawType =
          ev.unit?.unitType ?? (ev.unitType !== undefined ? ev.unitType : 0)
        const unitType: UnitType =
          typeof rawType === 'string' ? rawType : unitTypeFromId(rawType)
        const rawUnitType = unitTypeToId(unitType)
        const unitId = Number(ev.unit?.id ?? ev.unitId ?? 0)
        const x = Number(ev.unit?.x ?? ev.x ?? 0)
        const y = Number(ev.unit?.y ?? ev.y ?? 0)
        const areaId = Number(ev.areaId ?? this.lookupUnitArea(unitType, unitId))
        return { unitType, rawUnitType, unitId, areaId, x, y }
      }
      case 'UnitMove': {
        const rawType = ev.unitType
        const unitType: UnitType =
          typeof rawType === 'string' ? rawType : unitTypeFromId(rawType)
        const rawUnitType = unitTypeToId(unitType)
        const unitId = Number(ev.id ?? ev.unitId ?? 0)
        const x = Number(ev.x ?? ev.from?.x ?? ev.to?.x ?? 0)
        const y = Number(ev.y ?? ev.from?.y ?? ev.to?.y ?? 0)
        const areaId = Number(ev.areaId ?? this.lookupUnitArea(unitType, unitId))
        return { unitType, rawUnitType, unitId, areaId, x, y }
      }
      case 'UnitReassign': {
        const rawType = ev.unitType
        const unitType: UnitType =
          typeof rawType === 'string' ? rawType : unitTypeFromId(rawType)
        const rawUnitType = unitTypeToId(unitType)
        const unitId = Number(ev.id ?? ev.unitId ?? 0)
        const x = Number(ev.at?.x ?? ev.x ?? 0)
        const y = Number(ev.at?.y ?? ev.y ?? 0)
        const areaId = Number(ev.areaId ?? this.lookupUnitArea(unitType, unitId))
        return { unitType, rawUnitType, unitId, areaId, x, y }
      }
      default:
        return undefined
    }
  }

  private lookupUnitArea(unitType: UnitType, unitId: number): number {
    if (unitType === 'player' || unitType === 0) {
      return this.gameInstance.getPlayerState(unitId)?.areaId ?? 1
    }
    if (unitType === 'monster' || unitType === 1) {
      return (
        this.gameInstance.getMonsterState(unitId)?.areaId ??
        this.gameInstance.getMercenaryOrPetArea(unitId) ??
        1
      )
    }
    return 1
  }

  exportPlayerD2s(playerUnitIdOrCharName: number | string): Uint8Array {
    if (typeof playerUnitIdOrCharName === 'number') {
      const live = this.gameInstance.getPlayerState(playerUnitIdOrCharName)
      if (live) {
        return this.gameInstance.exportPlayerD2s(playerUnitIdOrCharName)
      }
      const saved = this.savedByPlayerId.get(playerUnitIdOrCharName)
      if (saved) return new Uint8Array(saved)
      throw new Error(
        `MultiClientRoomHost.exportPlayerD2s: unknown playerId ${playerUnitIdOrCharName}`,
      )
    }
    const lower = playerUnitIdOrCharName.trim().toLowerCase()
    for (const sess of this.sessionsByPlayerId.values()) {
      if (sess.charName.toLowerCase() === lower) {
        return this.gameInstance.exportPlayerD2s(sess.playerUnitId)
      }
    }
    const saved = this.savedByCharName.get(lower)
    if (saved) return new Uint8Array(saved)
    throw new Error(
      `MultiClientRoomHost.exportPlayerD2s: unknown character "${playerUnitIdOrCharName}"`,
    )
  }

  close(reason: CloseReason = { kind: 'local' }): void {
    if (this.closed) return
    this.closed = true
    for (const session of Array.from(this.sessionsByPlayerId.values())) {
      session.disconnect(reason)
    }
  }
}
