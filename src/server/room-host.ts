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
import { AoiFilter, type AoiEntityPos } from './net/aoi.ts'
import { PartyManager } from './net/party.ts'
import { RoomClientSession, type RoomWireProtocol } from './net/session.ts'

/**
 * 1.13c `D2Game.dll` (`SUB_UpdatePlayerVisionRooms` `0x6FC395B0`):
 * Server enforces ~9-Room (`±2 DrlgRoom` = ~80..100 subtiles) vision radius by default.
 */
export const DEFAULT_AOI_RADIUS_SUBTILES = 100

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
  readonly playersX?: number | undefined
  readonly aoiRadius?: number | undefined
  readonly worldEventSojThreshold?: number | undefined
  readonly animActionWindup?: boolean | undefined
  readonly policy?: Partial<GameModePolicy> | undefined
  readonly registry?: unknown
  readonly onPlayerSave?:
    | ((charName: string, d2sBytes: Uint8Array, playerUnitId: number) => void)
    | undefined
}

export interface ConnectClientSpec extends ConnectPlayerSpec {
  readonly protocol?: RoomWireProtocol | undefined
}

type WorldAoiUnitType = 'player' | 'monster' | 'object' | 'item' | 'missile' | 'tile'

function isGroundItemEvent(ev: Extract<ServerEvent, { readonly type: 'ItemEvent' }>): boolean {
  if (ev.container === 'ground') return true
  if (ev.container !== undefined) return false
  const act = ev.action
  return (
    act === 'groundSpawn' ||
    act === 'drop' ||
    act === 0x00 ||
    act === 0x02 ||
    act === 0x03
  )
}

export class MultiClientRoomHost {
  readonly gameInstance: GameInstance
  readonly aoiFilter: AoiFilter
  readonly hasExplicitAoi: boolean
  readonly aoiEnabled: boolean
  private readonly roomDifficulty: 0 | 1 | 2

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
    this.roomDifficulty = config.difficulty ?? 0
    this.gameInstance =
      config.game ??
      config.gameInstance ??
      new GameInstance({
        mode: basePolicy.mode ?? 'open',
        gameName: config.gameName ?? 'MultiplayerRoom',
        mapSeed: config.mapSeed ?? config.seed,
        difficulty: this.roomDifficulty,
        act: config.act ?? config.actId,
        areaId: config.areaId,
        maxPlayers,
        playersX: config.playersX,
        worldEventSojThreshold: config.worldEventSojThreshold,
        animActionWindup: config.animActionWindup ?? true,
        registry: config.registry,
        policy: {
          ...OPEN_BNET_POLICY,
          ...config.policy,
          maxPlayers,
        },
      })
    this.hasExplicitAoi = config.aoiRadius !== undefined && config.aoiRadius > 0
    this.aoiEnabled = config.aoiRadius === undefined ? true : config.aoiRadius > 0
    this.aoiFilter = new AoiFilter(
      config.aoiRadius !== undefined ? config.aoiRadius : DEFAULT_AOI_RADIUS_SUBTILES,
    )
    this.onPlayerSave = config.onPlayerSave
  }

  get partyManager(): PartyManager {
    return this.gameInstance.partyManager
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

    const playerUnitId = this.gameInstance.connectPlayer({
      ...spec,
      restoreMercenary: spec.restoreMercenary ?? Boolean(spec.d2s ?? spec.d2sBytes),
    })
    const pState = this.gameInstance.getPlayerState(playerUnitId)!
    const sessionId = this.nextSessionId++

    const session = new RoomClientSession({
      sessionId,
      playerUnitId,
      charName: pState.name,
      classId: pState.classId,
      stream,
      protocol: spec.protocol,
      difficulty: this.roomDifficulty,
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
    this.gameInstance.enqueueCommand(session.playerUnitId, cmd)
  }

  private handleSessionDisconnected(session: RoomClientSession): void {
    if (!this.sessionsByPlayerId.has(session.playerUnitId)) return

    const pid = session.playerUnitId
    this.sessionsByPlayerId.delete(pid)
    this.sessionsById.delete(session.sessionId)
    this.aoiFilter.removeViewer(pid)

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
    try {
      this.gameInstance.stepFrame()
    } finally {
      this.flushAllClientEvents()
    }
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
    const worldEntities: readonly AoiEntityPos[] = this.aoiEnabled
      ? this.gameInstance.getAoiWorldEntities()
      : []

    for (const session of Array.from(this.sessionsByPlayerId.values())) {
      if (session.isClosed) continue
      const events = this.gameInstance.drainEvents(session.playerUnitId)
      const viewer = this.gameInstance.getPlayerState(session.playerUnitId)
      if (!viewer) continue

      session.beginEventBatch()
      try {
        for (const ev of events) {
          if (this.aoiEnabled) {
            this.deliverEventWithAoi(session, viewer, ev)
          } else {
            session.sendEvent(ev)
          }
        }
        if (this.aoiEnabled) {
          this.syncViewerAoiWorld(session, viewer, worldEntities)
        }
      } finally {
        session.endEventBatch()
      }
    }
  }

  private syncViewerAoiWorld(
    session: RoomClientSession,
    viewer: {
      readonly unitId: number
      readonly areaId: number
      readonly x: number
      readonly y: number
    },
    worldEntities: readonly AoiEntityPos[],
  ): void {
    const diff = this.aoiFilter.computeViewerDiff(
      viewer.unitId,
      viewer,
      worldEntities,
      (viewerArea, targetArea) =>
        this.gameInstance.isAreaSeamAdjacent(viewerArea, targetArea),
    )

    for (const ent of diff.entered) {
      const unitType = ent.unitType as WorldAoiUnitType
      const enterEvents = this.gameInstance.buildEntityEnterAoiEvents(
        unitType,
        ent.unitId,
      )
      for (const ev of enterEvents) {
        session.sendEvent(ev)
      }
    }

    for (const oldEnt of diff.exited) {
      const unitType = oldEnt.unitType as WorldAoiUnitType
      if (unitType === 'missile' || unitType === 'tile') continue
      if (!this.gameInstance.hasLiveWorldEntity(unitType, oldEnt.unitId)) continue
      session.sendEvent({
        type: 'UnitRemove',
        unitType: unitTypeToId(oldEnt.unitType),
        id: oldEnt.unitId,
        unitId: oldEnt.unitId,
      })
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
    const anyEv = ev as Record<string, unknown>
    if (ev.type === 'LoadAct' || anyEv.type === 'ActDataLoaded') {
      this.aoiFilter.clearViewer(viewer.unitId)
      session.sendEvent(ev)
      return
    }

    if (ev.type === 'UnitRemove') {
      const rawType = ev.unitType
      const unitType: UnitType =
        typeof rawType === 'string' ? rawType : unitTypeFromId(rawType)
      const unitId = Number(ev.id ?? ev.unitId ?? 0)
      if (unitType === 'player' && unitId === viewer.unitId) {
        session.sendEvent(ev)
        return
      }
      if (this.aoiFilter.markHidden(viewer.unitId, unitType, unitId)) {
        session.sendEvent(ev)
      }
      return
    }
    if (anyEv.type === 'EntityRemove') {
      const rawType = anyEv.unitType
      const unitType: UnitType =
        typeof rawType === 'string'
          ? (rawType as UnitType)
          : unitTypeFromId(typeof rawType === 'number' ? rawType : 1)
      const unitId = Number(anyEv.id ?? anyEv.unitId ?? 0)
      if (this.aoiFilter.markHidden(viewer.unitId, unitType, unitId)) {
        session.sendEvent(ev)
      }
      return
    }

    if (ev.type === 'ItemEvent' && ev.container === 'socket') {
      const rawSocketEv = ev as { readonly ownerType?: number; readonly ownerId?: number }
      if (rawSocketEv.ownerType === 4 || ev.item?.ownerType === 4) {
        const hostId = Number(rawSocketEv.ownerId ?? ev.item?.ownerId ?? 0)
        if (hostId > 0 && this.gameInstance.hasLiveWorldEntity('item', hostId)) {
          if (this.aoiFilter.isVisible(viewer.unitId, 'item', hostId)) {
            session.sendEvent(ev)
          }
          return
        }
      }
    }

    const spatial = this.extractSpatialTarget(ev, viewer.areaId)
    if (
      !spatial ||
      (spatial.unitType === 'player' && spatial.unitId === viewer.unitId)
    ) {
      session.sendEvent(ev)
      return
    }

    const isSeam =
      spatial.areaId > 0 &&
      this.gameInstance.isAreaSeamAdjacent(viewer.areaId, spatial.areaId)
    const inRange = this.aoiFilter.isInRange(viewer, spatial, undefined, isSeam)
    const wasVisible = this.aoiFilter.isVisible(
      viewer.unitId,
      spatial.unitType,
      spatial.unitId,
    )

    if (!inRange) {
      if (wasVisible) {
        this.aoiFilter.markHidden(viewer.unitId, spatial.unitType, spatial.unitId)
        if (spatial.unitType !== 'missile' && spatial.unitType !== 'tile') {
          session.sendEvent({
            type: 'UnitRemove',
            unitType: spatial.rawUnitType,
            id: spatial.unitId,
            unitId: spatial.unitId,
          })
        }
      }
      return
    }

    const isSelfDescribingSpawn =
      ev.type === 'UnitAssign' ||
      ev.type === 'PlayerAssign' ||
      ev.type === 'CreateMissile' ||
      (ev.type === 'ItemEvent' && spatial.unitType === 'item')

    if (!wasVisible && !isSelfDescribingSpawn) {
      this.aoiFilter.markVisible(viewer.unitId, spatial)
      const enterEvents = this.gameInstance.buildEntityEnterAoiEvents(
        spatial.unitType as WorldAoiUnitType,
        spatial.unitId,
      )
      for (const enterEv of enterEvents) {
        session.sendEvent(enterEv)
      }
    } else if (!wasVisible) {
      this.aoiFilter.markVisible(viewer.unitId, spatial)
    } else {
      this.aoiFilter.markVisible(viewer.unitId, spatial)
    }

    session.sendEvent(ev)
  }

  private extractSpatialTarget(
    ev: ServerEvent,
    viewerAreaId?: number,
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
        const areaId = Number(
          ev.areaId ?? this.lookupUnitArea(unitType, unitId) ?? viewerAreaId ?? 0,
        )
        return { unitType, rawUnitType, unitId, areaId, x, y }
      }
      case 'UnitMove': {
        const unitRef = (ev as { unit?: { unitType?: UnitType | number; id?: number } }).unit
        const rawType = unitRef?.unitType ?? ev.unitType ?? 0
        const unitType: UnitType =
          typeof rawType === 'string' ? rawType : unitTypeFromId(rawType)
        const rawUnitType = unitTypeToId(unitType)
        const unitId = Number(unitRef?.id ?? ev.id ?? ev.unitId ?? 0)
        const x = Number(ev.x ?? ev.from?.x ?? ev.to?.x ?? 0)
        const y = Number(ev.y ?? ev.from?.y ?? ev.to?.y ?? 0)
        const areaId = Number(
          ev.areaId ?? this.lookupUnitArea(unitType, unitId) ?? viewerAreaId ?? 0,
        )
        return { unitType, rawUnitType, unitId, areaId, x, y }
      }
      case 'UnitReassign': {
        const unitRef = (ev as { unit?: { unitType?: UnitType | number; id?: number } }).unit
        const rawType = unitRef?.unitType ?? ev.unitType ?? 0
        const unitType: UnitType =
          typeof rawType === 'string' ? rawType : unitTypeFromId(rawType)
        const rawUnitType = unitTypeToId(unitType)
        const unitId = Number(unitRef?.id ?? ev.id ?? ev.unitId ?? 0)
        const x = Number(ev.at?.x ?? ev.x ?? 0)
        const y = Number(ev.at?.y ?? ev.y ?? 0)
        const areaId = Number(
          ev.areaId ?? this.lookupUnitArea(unitType, unitId) ?? viewerAreaId ?? 0,
        )
        return { unitType, rawUnitType, unitId, areaId, x, y }
      }
      case 'ItemEvent': {
        if (!isGroundItemEvent(ev)) return undefined
        const unitId = Number(ev.itemId ?? ev.item?.id ?? 0)
        if (unitId <= 0) return undefined
        const x = Number(ev.x ?? ev.item?.worldX ?? ev.item?.x ?? 0)
        const y = Number(ev.y ?? ev.item?.worldY ?? ev.item?.y ?? 0)
        const areaId = Number(
          this.lookupUnitArea('item', unitId) ?? viewerAreaId ?? 0,
        )
        return {
          unitType: 'item',
          rawUnitType: 4,
          unitId,
          areaId,
          x,
          y,
        }
      }
      case 'CreateMissile': {
        const unitId = Number(ev.missileId ?? 0)
        const x = Number(ev.at?.x ?? ev.x ?? 0)
        const y = Number(ev.at?.y ?? ev.y ?? 0)
        const areaId = Number(
          ev.areaId ??
            (unitId > 0 ? this.lookupUnitArea('missile', unitId) : undefined) ??
            viewerAreaId ??
            0,
        )
        return {
          unitType: 'missile',
          rawUnitType: 3,
          unitId,
          areaId,
          x,
          y,
        }
      }
      case 'Portal': {
        const unitId = Number(ev.portalId ?? ev.localId ?? 0)
        if (unitId <= 0) return undefined
        const areaId = Number(
          ev.areaId ?? this.lookupUnitArea('object', unitId) ?? viewerAreaId ?? 0,
        )
        const assign = this.gameInstance.buildUnitAssignEvent('object', unitId) as
          | { readonly x?: number; readonly y?: number }
          | undefined
        return {
          unitType: 'object',
          rawUnitType: 2,
          unitId,
          areaId,
          x: Number(ev.x ?? assign?.x ?? 0),
          y: Number(ev.y ?? assign?.y ?? 0),
        }
      }
      case 'SkillCast': {
        const rawCasterType = ev.caster.unitType
        const casterType: UnitType =
          typeof rawCasterType === 'string'
            ? rawCasterType
            : unitTypeFromId(rawCasterType)
        if (casterType !== 'monster') return undefined
        const unitId = Number(ev.caster.id ?? 0)
        if (unitId <= 0) return undefined
        const mon = this.gameInstance.getMonsterState(unitId)
        if (!mon) return undefined
        return {
          unitType: 'monster',
          rawUnitType: 1,
          unitId,
          areaId: mon.areaId,
          x: Math.round(ev.at?.x ?? mon.x),
          y: Math.round(ev.at?.y ?? mon.y),
        }
      }
      case 'UnitMode':
      case 'StateSet':
      case 'StateSkillEffect': {
        const unitRef = (ev as { unit?: { unitType?: UnitType | number; id?: number } }).unit
        const rawType =
          unitRef?.unitType ??
          (ev as { unitType?: UnitType | number }).unitType
        if (rawType === undefined) return undefined
        const unitType: UnitType =
          typeof rawType === 'string' ? rawType : unitTypeFromId(rawType)
        const unitId = Number(
          unitRef?.id ??
            (ev as { id?: number; unitId?: number }).id ??
            (ev as { unitId?: number }).unitId ??
            0,
        )
        if (unitId <= 0) return undefined
        if (unitType === 'object' && ev.type === 'UnitMode') {
          const areaId = this.lookupUnitArea('object', unitId)
          if (areaId === undefined) return undefined
          const assign = this.gameInstance.buildUnitAssignEvent('object', unitId) as
            | { readonly x?: number; readonly y?: number }
            | undefined
          return {
            unitType: 'object',
            rawUnitType: 2,
            unitId,
            areaId,
            x: Number(ev.at?.x ?? assign?.x ?? 0),
            y: Number(ev.at?.y ?? assign?.y ?? 0),
          }
        }
        if (unitType !== 'monster') return undefined
        const mon = this.gameInstance.getMonsterState(unitId)
        if (!mon || (mon.dead && ev.type !== 'UnitMode')) return undefined
        const at = (ev as { at?: { x: number; y: number } }).at
        return {
          unitType: 'monster',
          rawUnitType: 1,
          unitId,
          areaId: mon.areaId,
          x: Math.round(at?.x ?? mon.x),
          y: Math.round(at?.y ?? mon.y),
        }
      }
      default:
        return undefined
    }
  }

  private lookupUnitArea(unitType: UnitType, unitId: number): number | undefined {
    const key: WorldAoiUnitType =
      unitType === 'player' || unitType === 0
        ? 'player'
        : unitType === 'monster' || unitType === 1
          ? 'monster'
          : unitType === 'object' || unitType === 2
            ? 'object'
            : unitType === 'missile' || unitType === 3
              ? 'missile'
              : unitType === 'item' || unitType === 4
                ? 'item'
                : 'tile'
    return this.gameInstance.lookupWorldUnitArea(key, unitId)
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
