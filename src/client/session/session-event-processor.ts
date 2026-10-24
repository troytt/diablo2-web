/**
 * Session Server Event Processor, Outbound Command Forwarding, & World SFX Queue Draining
 * (`src/client/session/session-event-processor.ts`).
 *
 * Extracted from `src/client/session/online-session.ts` (Phase 3 — Step 3.5, Refs #985).
 * Strict import boundary: imports only from `src/netproto/index.ts` (never `bncs/mcp/d2gs/crypto`).
 */

import {
  ClickButtonId,
  unitTypeFromId,
  unitTypeToId,
  type ClientCommand,
  type GameServerAdapter,
  type ServerEvent,
  type UnitType,
  type UnitTypeId,
} from '../../netproto/index.ts'
import {
  extractPlayersCommandCount,
  parseInGameChatInput,
  resolveChatTblIndex,
} from '../../common/chat/chat-113c.ts'
import { Environment } from '../../common/world/environment.ts'
import { getObjectsTxtRecord113c } from '../../common/world/objects-txt-113c.ts'
import type { AudioRuntime113c } from '../audio/audio-runtime-113c.ts'
import { periodOfDayToSoundEnvironTod113c } from '../audio/sound-environ-113c.ts'
import { unitSoundPosition113c } from '../audio/sound-records-113c.ts'
import type { AutomapView } from '../automap/automap-view.ts'
import { getTblLang } from '../i18n/lang.ts'
import type { CameraLike, CommandMapper } from '../input/command-mapper.ts'
import {
  LOAD_ACT_NO_CATCH_UP_MS,
  LOCAL_REASSIGN_NO_CATCH_UP_MS,
  type LogicClock,
} from '../loop/logic-clock.ts'
import type { LevelRoomView, LevelView } from '../map/level-view.ts'
import type { MapService } from '../map/map-service.ts'
import type { RemoteEntityInterpolator } from '../motion/interpolate.ts'
import type { LocalMovementPredictor, ServerPositionSource } from '../motion/predictor.ts'
import type { HudManager } from '../ui/hud-manager.ts'
import type { HudModel } from '../ui-model/hud-model.ts'
import {
  localReassignWeatherArg113c,
  unitSkillEventForcesLightning113c,
  type WeatherController,
} from '../weather/weather-controller.ts'
import type { ChatLogEntry, ClientWorld } from '../world/client-world.ts'
import { ENV_EFFECT_OBJECTS, type EnvEffectController } from '../world/env-effect.ts'
import { objectLitForMode, setObjectLight } from '../world/object-light.ts'
import { DEN_OF_EVIL_LEVEL_ID, type QuestFxLight } from '../world/quest-fx-light.ts'
import type { C2sIdenticalPacketDedupe113c } from './c2s-identical-dedupe-113c.ts'
import {
  CINEMATIC_COUNT_113C,
  CINEMATIC_GAME_COMPLETE_113C,
} from './game-completion-113c.ts'
import type { OnlineSessionLostCause, OnlineSessionPhase } from './online-session.ts'
import { classifyClientCommand, type OutboundRateLimiter } from './rate-limiter.ts'

export interface SessionEventProcessorHost {
  readonly world: ClientWorld
  readonly hudManager: HudManager
  readonly hudModel: HudModel
  readonly camera: CameraLike
  readonly mapService: MapService | null
  readonly automapView: AutomapView
  readonly predictor: LocalMovementPredictor
  readonly interpolator: RemoteEntityInterpolator
  readonly rateLimiter: OutboundRateLimiter
  readonly commandMapper: CommandMapper
  readonly logicClock: LogicClock
  readonly weather: WeatherController
  readonly audioRuntime: AudioRuntime113c
  levelView?: LevelView | null | undefined
  phaseValue: OnlineSessionPhase
  environmentValue: Environment
  clientActLoaded: boolean
  readonly envEffects: EnvEffectController
  readonly questFx: QuestFxLight
  readonly knownAreaIds: Set<number>
  prefetchedGateForAreaId: number
  lastSyncedAreaId: number
  pingMsValue: number
  gameAdapter: GameServerAdapter | null
  readonly outboundCommandsLog: ClientCommand[]
  readonly c2sDedupe: C2sIdenticalPacketDedupe113c
  readonly chatInputHistory: string[]
  chatInputHistoryIndex: number
  persistedPlayersCount: number | null
  appliedPersistedPlayersForGame: boolean
  readonly eventListeners: Set<(ev: ServerEvent) => void>
  readonly chatListeners: Set<(entry: ChatLogEntry) => void>
  setPhase(next: OnlineSessionPhase): void
  dispatchCommand(cmd: ClientCommand | Record<string, any>, nowMs?: number): boolean
  sendCommand(cmd: ClientCommand | Record<string, any>, nowMs?: number): boolean
  sendBncsChatCommand(command: string): boolean
  forwardCommandToAdapter(cmd: ClientCommand, nowMs?: number): void
  completeGame(): void
  handleUnexpectedDisconnect(
    reason: string,
    cause?: Extract<OnlineSessionLostCause, 'error' | 'closed'>,
    useTbl?: boolean,
  ): void
  verifyLocalPlayerPosition(x: number, y: number, source: ServerPositionSource): void
  prefetchGateNeighbourLevels(view: LevelView): void
  pruneMissingInterpolatorEntities(): void
  resolveReassignWeatherArg(ev: Extract<ServerEvent, { type: 'UnitReassign' }>): 0 | 1 | null
  unitKnownByRawType(rawUnitType: number, id: number): boolean
  syncActiveAreaFromPlayerPosition(options?: { readonly emitHudSync?: boolean }): LevelView | null
  runStateSetFunctions(ev: Extract<ServerEvent, { type: 'StateSet' }>): void
  findStoneAlphaNearLocalPlayer(): { readonly x: number; readonly y: number } | null
  spawnHoradricStaffIfOrificeNear(): void
  spawnDiabloAppearsIfInChaosSanctuary(): void
  isSubTileInTown(subX: number, subY: number): boolean
  syncAudioSkillPacks(): void
  drainWorldSoundRequests(): void
  resolveTargetUnitWorldPos(
    unitType: UnitType,
    unitId: number,
  ): { readonly x: number; readonly y: number } | null
}

/**
 * The weather arg 0x6fb57e20 passes for an S2C `0x15`, read before `ClientWorld` applies it;
 * `null` when there is no weather call: the unit is not the local player `[0x6fbcbbfc]` (none
 * before S2C 0x59), or it is dead (see `localReassignWeatherArg113c`).
 *
 * UNVERIFIED: the used skill is the port's current cast (`castState`). Vanilla reads
 * `pSkills->pUsedSkill`; when the client clears that pointer was not recovered (D2Game clears its
 * copy when a player mode without a skill starts).
 */
export function resolveReassignWeatherArg(
  host: SessionEventProcessorHost,
  ev: Extract<ServerEvent, { type: 'UnitReassign' }>,
): 0 | 1 | null {
  const selfId = host.world.selfId
  if (unitTypeToId(ev.unitType) !== 0 || selfId === 0 || ev.id !== selfId) return null
  const unit = host.world.getUnit(ev.unitType, ev.id)
  return localReassignWeatherArg113c({
    snap: ev.snap,
    dead: host.world.isSelfDead || unit?.dead === true,
    mode: unit?.mode ?? host.world.self.mode,
    usedSkillId: (unit?.castState ?? host.world.self.castState)?.skillId,
  })
}

/**
 * Whether the client knows the unit a packet names by its raw type byte and id (the unit lookup
 * 0x6fb54e20). Vanilla has no range check on the type: the 0xA3 handler takes the hash bucket at
 * `0x6fbba608 + type·0x200` (0x6fb5efc0..0x6fb5efc6, 0x6fb5efe9..0x6fb5efef), so a type above 5 reads
 * past the six-type table. What it finds there is UNVERIFIED; the port treats such a type as unknown.
 */
export function unitKnownByRawType(
  host: SessionEventProcessorHost,
  rawUnitType: number,
  id: number,
): boolean {
  if (!Number.isInteger(rawUnitType) || rawUnitType < 0 || rawUnitType > 5) return false
  return host.world.getUnit(rawUnitType as UnitTypeId, id) !== undefined
}

export function dispatchSessionCommand(
  host: SessionEventProcessorHost,
  cmd: ClientCommand | Record<string, any>,
  nowMs = performance.now(),
): boolean {
  if (!cmd || typeof cmd !== 'object') return false
  const rawCmd = cmd as Record<string, any>
  const normalized: ClientCommand =
    rawCmd.type === 'PlayerMove'
      ? {
          type: 'RunToLocation',
          x: Number(rawCmd.targetX ?? rawCmd.x ?? 0),
          y: Number(rawCmd.targetY ?? rawCmd.y ?? 0),
        }
      : (cmd as ClientCommand)
  if (normalized.type === 'Chat' && typeof normalized.text === 'string') {
    const playersCount = extractPlayersCommandCount(normalized.text)
    if (playersCount !== null) {
      host.persistedPlayersCount = playersCount
      host.appliedPersistedPlayersForGame = true
    }
  }
  const category = classifyClientCommand(normalized)
  // Non-movement commands (interaction, skill, UI) bypass generic rate limiter per 1.13c parity (#575)
  // to prevent player clicks and interactions from being silently swallowed.
  if (category !== 'movement') {
    host.forwardCommandToAdapter(normalized, nowMs)
    return true
  }
  const res = host.rateLimiter.tryAcquire(normalized, nowMs)
  if (res.allowed) {
    host.forwardCommandToAdapter(normalized, nowMs)
    return true
  }
  console.warn(
    `[OnlineSession] Outbound command throttled: ${normalized.type} (${res.reason ?? 'unknown'})`,
  )
  return false
}

export function navigateSessionChatInputHistory(
  host: SessionEventProcessorHost,
  direction: 'up' | 'down',
): string {
  if (host.chatInputHistory.length === 0) return ''
  if (direction === 'up') {
    host.chatInputHistoryIndex = Math.max(0, host.chatInputHistoryIndex - 1)
    return host.chatInputHistory[host.chatInputHistoryIndex] ?? ''
  }
  host.chatInputHistoryIndex = Math.min(
    host.chatInputHistory.length,
    host.chatInputHistoryIndex + 1,
  )
  if (host.chatInputHistoryIndex >= host.chatInputHistory.length) {
    return ''
  }
  return host.chatInputHistory[host.chatInputHistoryIndex] ?? ''
}

/**
 * Parse and execute an in-game chat input line (`Enter` key bar):
 * - `!text` -> `C2S 0x14` `OverheadChat` + local overhead speech bubble (`10,000 ms` TTL)
 * - `%<target> <msg>`, `/w <target> <msg>`, `/whisper <target> <msg>`, `/msg <target> <msg>` -> `C2S 0x15` (`type=0x02`)
 * - `/r <msg>`, `/reply <msg>` -> whispers `world.lastWhisperTarget`
 * - `/clear` -> clears active top-left overlay messages while preserving Message Log (`M`)
 * - `/fps` -> toggles FPS / Ping readout
 * - `/players N` -> sets player count and prints local confirmation
 * - Regular text -> `C2S 0x15` (`type=0x01`)
 */
export function submitSessionChatInput(
  host: SessionEventProcessorHost,
  rawInput: string,
  nowMs = performance.now(),
): boolean {
  const trimmed = rawInput.trim()
  if (!trimmed) return false
  if (host.chatInputHistory[host.chatInputHistory.length - 1] !== trimmed) {
    host.chatInputHistory.push(trimmed)
    if (host.chatInputHistory.length > 32) {
      host.chatInputHistory.shift()
    }
  }
  host.chatInputHistoryIndex = host.chatInputHistory.length

  const parsed = parseInGameChatInput(rawInput, host.world.lastWhisperTarget)
  switch (parsed.kind) {
    case 'noop':
      return false
    case 'say':
      return host.dispatchCommand({ type: 'Chat', text: parsed.text }, nowMs)
    case 'overhead':
      return host.dispatchCommand({ type: 'OverheadChat', text: parsed.text }, nowMs)
    case 'whisper':
      return host.dispatchCommand(
        { type: 'Chat', text: parsed.text, whisperTo: parsed.target },
        nowMs,
      )
    case 'bncs_command':
      return host.sendBncsChatCommand(parsed.command)
    case 'local_clear':
      host.world.clearActiveScreenMessages()
      host.hudModel.syncFromWorld()
      return true
    case 'local_fps':
      host.hudManager.showFps = !host.hudManager.showFps
      return true
    case 'local_players': {
      if (parsed.valid && parsed.count !== null) {
        host.persistedPlayersCount = parsed.count
        host.appliedPersistedPlayersForGame = true
        host.world.addSystemChatMessage(`players set to ${parsed.count}`, 0, nowMs)
        host.dispatchCommand({ type: 'Chat', text: `/players ${parsed.count}` }, nowMs)
        host.hudModel.syncFromWorld()
        return true
      }
      host.world.addSystemChatMessage('Usage: /players 1-8', 1, nowMs)
      host.hudModel.syncFromWorld()
      return false
    }
    case 'local_error': {
      const lang = getTblLang()
      const errMsg =
        parsed.errorKey === 'noReplyTarget'
          ? (resolveChatTblIndex(0x0f8a, lang) || 'No one has whispered you yet.')
          : parsed.errorKey === 'announceUsage'
            ? 'Usage: /ann <message>'
            : (resolveChatTblIndex(0x0f89, lang) || 'Usage: /w <name> <message>')
      host.world.addSystemChatMessage(errMsg, 1, nowMs)
      host.hudModel.syncFromWorld()
      return false
    }
  }
}

export function applyPersistedPlayersToCurrentGame(
  host: SessionEventProcessorHost,
  nowMs = performance.now(),
): boolean {
  const count = host.persistedPlayersCount
  if (count === null || count < 1 || count > 8 || host.appliedPersistedPlayersForGame) {
    return false
  }
  host.appliedPersistedPlayersForGame = true
  const msgText = `players set to ${count}`
  const alreadyShown = host.world.activeChatOverlayEntries.some(
    (m) => m.kind === 'system' && m.text.toLowerCase() === msgText.toLowerCase(),
  )
  if (!alreadyShown) {
    host.world.addSystemChatMessage(msgText, 0, nowMs)
  }
  host.dispatchCommand({ type: 'Chat', text: `/players ${count}` }, nowMs)
  host.hudModel.syncFromWorld()
  return true
}

export function forwardSessionCommandToAdapter(
  host: SessionEventProcessorHost,
  cmd: ClientCommand,
  nowMs?: number,
): void {
  // 1.13c D2Client 0x6fac43e0 SendPacket: drop byte-identical wire repeats inside the 50/200 ms window,
  // while still keeping local interaction state & predictor stop synchronized.
  if (!host.c2sDedupe.admitCommand(cmd, nowMs ?? performance.now())) {
    if (cmd.type === 'NpcInit' || cmd.type === 'Interact' || cmd.type === 'OperateObject') {
      const predSnap = host.predictor.getSnapshot()
      const selfX = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.x : undefined
      const selfY = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.y : undefined
      host.world.noteOutgoingCommand(cmd, nowMs, selfX, selfY)
      const selfUnit = host.world.getUnit('player', host.world.selfId || 1)
      if (selfUnit) {
        host.predictor.stop()
        host.predictor.setTargetDirection(selfUnit.targetDirection, false)
      }
      if (cmd.type === 'NpcInit') {
        host.hudModel.syncFromWorld()
      }
      host.drainWorldSoundRequests()
    }
    return
  }
  host.outboundCommandsLog.push(cmd)
  if (host.outboundCommandsLog.length > 512) {
    host.outboundCommandsLog.shift()
  }
  if (host.gameAdapter && host.gameAdapter.state !== 'closed') {
    try {
      host.gameAdapter.send(cmd)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      host.handleUnexpectedDisconnect(`Failed to send command ${cmd.type}: ${msg}`, 'error', true)
      return
    }
  }
  const predSnap = host.predictor.getSnapshot()
  const selfX = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.x : undefined
  const selfY = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.y : undefined
  host.world.noteOutgoingCommand(cmd, nowMs, selfX, selfY)
  if (host.world.selfId !== 0) {
    const selfUnit = host.world.getUnit('player', host.world.selfId)
    if (selfUnit?.castState && !host.predictor.getSnapshot().moving) {
      host.predictor.setTargetDirection(selfUnit.targetDirection, false)
    }
  }
  if (
    cmd.type === 'SkillAt' ||
    cmd.type === 'SkillOn' ||
    cmd.type === 'CastLeftSkillOnLocation' ||
    cmd.type === 'CastRightSkillOnLocation' ||
    cmd.type === 'CastLeftSkillOnTarget' ||
    cmd.type === 'CastRightSkillOnTarget' ||
    cmd.type === 'Interact' ||
    cmd.type === 'OperateObject' ||
    cmd.type === 'NpcInit'
  ) {
    const isPendingMeleeChase =
      (cmd.type === 'SkillOn' ||
        cmd.type === 'CastLeftSkillOnTarget' ||
        cmd.type === 'CastRightSkillOnTarget') &&
      host.world.pendingMeleeAttack !== null
    if (isPendingMeleeChase) {
      host.commandMapper.syncPendingMeleeChasePath()
    } else {
      const selfUnit = host.world.getUnit('player', host.world.selfId || 1)
      if (selfUnit) {
        host.predictor.stop()
        host.predictor.setTargetDirection(selfUnit.targetDirection, false)
      }
    }
  }
  if (cmd.type === 'NpcCancel') {
    host.audioRuntime.stopSpeech()
  }
  if (
    cmd.type === 'NpcInit' ||
    cmd.type === 'NpcCancel' ||
    cmd.type === 'OverheadChat' ||
    cmd.type === 'Chat' ||
    (cmd.type === 'ClickButton' &&
      (cmd.buttonId === ClickButtonId.CloseStash || cmd.button === ClickButtonId.CloseStash))
  ) {
    host.hudModel.syncFromWorld()
  }
  host.drainWorldSoundRequests()
}

/**
 * Process an authoritative `ServerEvent` across `ClientWorld`, `MapService`, `AutomapView`,
 * `LocalMovementPredictor`, `RemoteEntityInterpolator`, and `HudModel`.
 */
export function handleServerEvent(host: SessionEventProcessorHost, rawEv: ServerEvent): void {
  const prevChatCount = host.world.chatLog.length
  const evAny = rawEv as Record<string, any>
  let ev: ServerEvent = rawEv
  if (evAny.type === 'PortalOwner' || evAny.type === 'PortalInfo') {
    const portalId = Number(evAny.portalId ?? evAny.localId ?? evAny.unitId ?? 0)
    ev = {
      type: 'Portal',
      portalId,
      ownerId: evAny.ownerId,
      ownerName: evAny.ownerName,
      localId: portalId,
      remoteId: evAny.remoteId,
      areaId: Number(evAny.areaId ?? evAny.levelId ?? 0),
      flags: evAny.flags,
    }
  } else if (evAny.type === 'MercAssign') {
    ev = {
      type: 'Merc',
      kind: 'assign',
      ownerId: evAny.ownerId,
      mercId: evAny.mercId,
      classId: evAny.classId,
      nameId: evAny.nameId,
      ...(evAny.seed !== undefined ? { seed: evAny.seed, value: evAny.seed } : {}),
    }
  } else if (evAny.type === 'PlayerKill') {
    ev = {
      type: 'CorpseAssign',
      ownerId: Number(evAny.victimId ?? evAny.ownerId ?? host.world.selfId),
      corpseId: Number(evAny.corpseId ?? 0),
      assign: 1,
    } as unknown as ServerEvent
  } else if (
    evAny.type === 'SkillCast' &&
    (!evAny.caster || (evAny.target === undefined && evAny.targetX !== undefined))
  ) {
    ev = {
      ...evAny,
      type: 'SkillCast',
      caster: evAny.caster ?? evAny.unit ?? { unitType: evAny.unitType ?? 0, id: evAny.unitId ?? 1 },
      skill: Number(evAny.skill ?? evAny.skillId ?? 0),
      level: Number(evAny.level ?? evAny.skillLevel ?? 1),
      target:
        evAny.target ??
        (evAny.targetX !== undefined && evAny.targetY !== undefined
          ? { x: Number(evAny.targetX), y: Number(evAny.targetY) }
          : { x: 0, y: 0 }),
    } as ServerEvent
  } else if (evAny.type === 'UnitMove') {
    const uType =
      typeof evAny.unitType === 'number'
        ? unitTypeFromId(evAny.unitType)
        : (evAny.unitType ?? 'player')
    const uId = Number(evAny.id ?? evAny.unitId ?? 0)
    const hasFrom = evAny.from !== undefined || evAny.currentX !== undefined
    const from = hasFrom
      ? {
          x: Number(evAny.from?.x ?? evAny.currentX ?? 0),
          y: Number(evAny.from?.y ?? evAny.currentY ?? 0),
        }
      : undefined
    const toX = Number(evAny.to?.x ?? evAny.targetX ?? evAny.x ?? (from ? from.x : 0))
    const toY = Number(evAny.to?.y ?? evAny.targetY ?? evAny.y ?? (from ? from.y : 0))
    ev = {
      ...evAny,
      type: 'UnitMove',
      unitType: uType,
      id: uId,
      mode: evAny.mode ?? 'walk',
      ...(from ? { from } : {}),
      to: { x: toX, y: toY },
    } as ServerEvent
  }
  const preMoveUnit =
    ev.type === 'UnitMove'
      ? host.world.getUnit(
          (evAny.unitType ?? ev.unitType) as UnitType,
          Number(evAny.id ?? evAny.unitId ?? 1),
        )
      : undefined
  const preMoveUnitPos =
    preMoveUnit !== undefined && (preMoveUnit.x !== 0 || preMoveUnit.y !== 0)
      ? { x: preMoveUnit.x, y: preMoveUnit.y }
      : undefined
  let preRemoveNpcCancelId: number | null = null
  let preRemoveStashClose = false
  if (ev.type === 'UnitRemove') {
    const rmTypeId = unitTypeToId(ev.unitType)
    const rmId = Number((ev as any).id ?? (ev as any).unitId ?? 0)
    if (
      rmTypeId === 1 &&
      rmId > 0 &&
      host.world.npcInteraction.unitType !== 2 &&
      host.world.npcInteraction.npcId === rmId
    ) {
      preRemoveNpcCancelId = rmId
    } else if (
      rmTypeId === 2 &&
      rmId > 0 &&
      (host.world.npcInteraction.stashOpen || host.hudManager.leftPanel === 'stash')
    ) {
      const rmObj = host.world.getUnit('object', rmId)
      if (rmObj?.classId === 267) {
        preRemoveStashClose = true
      }
    }
  }
  // Before `apply`: ClientWorld clears the cast and revives a dead local player on 0x15.
  const reassignWeatherArg =
    ev.type === 'UnitReassign' ? host.resolveReassignWeatherArg(ev) : null
  // Before `apply`: D2Client 0xA8 / 0xAA drop the packet when the unit is unknown, but ClientWorld
  // creates a placeholder unit for it.
  const stateSetUnitKnown =
    ev.type === 'StateSet' && host.world.getUnit(ev.unit.unitType, ev.unit.id) !== undefined
  const preOpenUiArtisanNpcId =
    ev.type === 'OpenUi'
      ? (host.world.awaitingArtisanConfirmNpcId ??
        (host.world.npcInteraction.activeWindow === 'imbue' ||
        host.world.npcInteraction.activeWindow === 'add_sockets' ||
        host.world.npcInteraction.activeWindow === 'personalize' ||
        host.world.npcInteraction.activeWindow === 'orifice' ||
        host.hudManager.leftPanel === 'imbue' ||
        host.hudManager.leftPanel === 'add_sockets' ||
        host.hudManager.leftPanel === 'personalize' ||
        host.hudManager.leftPanel === 'orifice'
          ? (host.world.npcInteraction.npcId ??
              (host.hudManager.worldPanels as any)?.activeNpcId ??
              ev.unitId)
          : null))
      : null
  let skipDuplicatePlayersChatApply = false
  if (ev.type === 'Chat' && ev.kind === 'system' && typeof ev.text === 'string') {
    const playersSetMatch = /^players set to (\d+)$/i.exec(ev.text.trim())
    if (playersSetMatch && playersSetMatch[1] !== undefined) {
      const count = parseInt(playersSetMatch[1], 10)
      if (count >= 1 && count <= 8) {
        host.persistedPlayersCount = count
        host.appliedPersistedPlayersForGame = true
        const targetLower = ev.text.trim().toLowerCase()
        if (
          host.world.activeChatOverlayEntries.some(
            (m) => m.kind === 'system' && m.from === undefined && m.text.toLowerCase() === targetLower,
          )
        ) {
          skipDuplicatePlayersChatApply = true
        }
      }
    }
  }
  host.hudModel.suppressAutoSync = true
  try {
    if (!skipDuplicatePlayersChatApply) {
      host.world.apply(ev)
    }
  } finally {
    host.hudModel.suppressAutoSync = false
  }

  const isGameInitEvent =
    ev.type === 'LoadAct' ||
    ev.type === 'LoadComplete' ||
    (ev.type === 'UnitAssign' && Boolean(ev.isSelf))
  if (host.phaseValue === 'entering-game' && isGameInitEvent) {
    host.setPhase('ingame')
  }
  if (isGameInitEvent && !host.appliedPersistedPlayersForGame) {
    applyPersistedPlayersToCurrentGame(host)
  }

  if ((ev as any).type === 'Interact') {
    const raw = ev as any
    const actorType: UnitType = raw.actor?.unitType ?? raw.unit?.unitType ?? raw.unitType ?? 0
    const actorTypeId = unitTypeToId(actorType)
    const actorId = Number(
      raw.actor?.id ?? raw.unit?.id ?? raw.unitId ?? (host.world.selfId || 1),
    )
    const unit = host.world.getUnit(actorType, actorId)
    if (unit && !unit.dead) {
      const isLocalPlayer =
        actorTypeId === 0 && (actorId === host.world.selfId || host.world.selfId === 0)
      if (isLocalPlayer) {
        host.predictor.stop()
        host.predictor.setTargetDirection(unit.targetDirection, false)
      } else if (actorTypeId !== 1) {
        host.interpolator.setEntityTargetDirection(
          actorTypeId,
          actorId,
          unit.targetDirection,
          false,
        )
      }
    }
    host.hudModel.syncFromWorld()
    host.drainWorldSoundRequests()
    return
  }

  switch (ev.type) {
    case 'LoadAct': {
      // D2Client 0x6FB5DB50 → 0x6FAF3F90 ends with `[0x6FBC981C] = max(old, now + 10000)`
      // (0x6FAF4098..0x6FAF40AF): no tick catch-up for 10 s after an act load.
      host.logicClock.suppressCatchUp(performance.now() + LOAD_ACT_NO_CATCH_UP_MS)
      host.interpolator.clear()
      host.hudModel.closeAllPanels()
      host.hudManager.closeAllPanels()
      // 1.13c `0x03 LoadAct` (D2Client 0x6fb5db50) always names the level the player is being
      // loaded into. Without it (or without a buildable LevelView) the client cannot place the
      // player on the server's map, so fail fast instead of guessing a town (#539).
      if (ev.areaId <= 0) {
        host.handleUnexpectedDisconnect(
          `0x03 LoadAct carried no areaId (act=${String(ev.act)}): cannot build the level the server placed the player in`,
        )
        break
      }
      if (host.mapService) {
        try {
          host.mapService.onLoadActPacket(
            {
              act: ev.act,
              mapSeed: ev.mapSeed,
              areaId: ev.areaId,
            },
            { difficulty: host.world.difficulty },
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          host.handleUnexpectedDisconnect(
            `MapService failed to build area ${String(ev.areaId)} (act=${String(ev.act)}, seed=0x${(ev.mapSeed >>> 0).toString(16)}): ${msg}`,
          )
          break
        }
      }
      host.knownAreaIds.clear()
      host.knownAreaIds.add(ev.areaId)
      host.prefetchedGateForAreaId = -1
      const activeView =
        host.mapService?.getActiveLevelView() ??
        (host.levelView && host.levelView.areaId === ev.areaId ? host.levelView : undefined)
      if (activeView) {
        host.prefetchGateNeighbourLevels(activeView)
        host.prefetchedGateForAreaId = activeView.areaId
      }
      host.automapView.setContext(
        ev.mapSeed,
        host.world.difficulty,
        ev.areaId,
        activeView,
      )
      // The new client act gets a fresh environment clock (ENVIRONMENT_Alloc 0x6fd87ba0: noon,
      // ticks 0); S2C 0x53 then syncs it with the server's act.
      host.environmentValue = Environment.alloc()
      host.clientActLoaded = true
      // LoadWeather 0x6fb31750 runs from the render callback while the act load is pending.
      host.weather.onLoadAct(ev.areaId)
      host.lastSyncedAreaId = ev.areaId
      host.audioRuntime.enterLevel(
        ev.areaId,
        periodOfDayToSoundEnvironTod113c(host.environmentValue.period),
      )
      host.audioRuntime.playLevelMusic(ev.areaId)
      host.syncAudioSkillPacks()
      break
    }

    case 'CanGoToAct': {
      // D2Client.dll 0x6fb5f940 -> 0x6fb399a0(pkt[1]): S2C 0x61 plays cinematic `pkt[1]` from the 8-entry
      // table at 0x6fb91314 (see game-completion-113c.ts). An index >= 8 is a FatalAssert (0x6fb399b3).
      if (ev.act >= CINEMATIC_COUNT_113C) {
        host.handleUnexpectedDisconnect(
          `S2C 0x61 cinematic index ${ev.act} >= ${CINEMATIC_COUNT_113C}: D2Client 0x6fb399b3 asserts`,
        )
        break
      }
      // The Bink video (CINEMATIC_BINK_NAMES_113C) is not available in web form, so it is skipped.
      // After the video, D2Client sends C2S 0x48 CancelController (0x6fb39e38) to clear
      // pPlayerData->bBusy (+0x4c) in D2Game.dll (0x6fceb4e0). Without this,
      // D2Game.dll PLAYER_IsBusy (0x6fc57680) returns 1, permanently freezing
      // all movement, interact, and skill packets from this player!
      host.sendCommand({ type: 'CancelController' })
      if (ev.act === CINEMATIC_GAME_COMPLETE_113C) {
        // D2X_OUT: 0x6fb39e4d sets the "game completed" flag and 0x6faf2850 sends C2S 0x69 LeaveGame.
        host.completeGame()
        break
      }
      host.hudModel.syncFromWorld()
      break
    }

    case 'EnvironmentSync': {
      // S2C 0x53 (D2Client 0x6fb5e9c0): when the client act is the player's act, D2Common #10358
      // InitializeEnvironment(gpAct, GetRoom(player), cycle, ticks, eclipse), then the EnvEffect
      // refresh 0x6fb56680. The port keeps a single client act, so the act test always holds.
      if (host.world.selfId === 0) {
        // 0x6fb5e9c5 reads `player->pAct` without a null check.
        host.handleUnexpectedDisconnect(
          '0x53 EnvironmentSync before 0x59 AssignPlayer: the 1.13c handler dereferences the player unit',
        )
        break
      }
      if (!host.clientActLoaded) {
        host.handleUnexpectedDisconnect(
          '0x53 EnvironmentSync before 0x03 LoadAct: InitializeEnvironment (#10358) asserts on a null act',
        )
        break
      }
      const envLevelId =
        host.syncActiveAreaFromPlayerPosition({ emitHudSync: false })?.areaId ?? 0
      try {
        host.environmentValue.initialize(envLevelId, ev.cycleIndex, ev.ticks, ev.eclipse)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        host.handleUnexpectedDisconnect(`0x53 EnvironmentSync rejected: ${msg}`)
        break
      }
      host.envEffects.refresh(
        host.world.getUnitsByType('object'),
        host.environmentValue.period,
        performance.now(),
      )
      break
    }

    case 'OpenUi': {
      if (ev.uiId === 0) {
        host.hudModel.openArtisanWindow('orifice', ev.unitId)
      } else if (ev.uiId === 1) {
        host.hudModel.closeActiveNpcPanel()
      } else if (ev.uiId === 5) {
        host.hudModel.completeOrificeUi(ev.extra ?? 0)
      } else if (ev.uiId === 6) {
        if (preOpenUiArtisanNpcId !== null || ev.unitType === 0 || ev.unitId === 0) {
          host.hudModel.completeArtisanUi(6, preOpenUiArtisanNpcId || ev.unitId)
        } else {
          host.hudModel.openArtisanWindow('imbue', ev.unitId)
        }
      } else if (ev.uiId === 7) {
        if (preOpenUiArtisanNpcId !== null || ev.unitType === 0 || ev.unitId === 0) {
          host.hudModel.completeArtisanUi(7, preOpenUiArtisanNpcId || ev.unitId)
        } else {
          host.hudModel.openArtisanWindow('add_sockets', ev.unitId)
        }
      } else if (ev.uiId === 8) {
        host.hudModel.openArtisanWindow('personalize', ev.unitId)
      }
      break
    }

    case 'Chat': {
      // D2Client.dll 0x6fb50500 -> case 7: D2Client_OpenRecipeScrollUI (0x6fb29440)
      // Only S2C 0x26 chatType === 7 opens the recipe scroll; S2C 0x5A eventType === 7 is a party relation message.
      if (ev.kind !== 'event' && ev.eventType === 7) {
        host.hudManager.worldPanels.openRecipeScroll(ev.text)
        host.hudManager.setLeftPanel('recipescroll')
      }
      break
    }

    case 'RoomReveal': {
      if (ev.areaId > 0) {
        host.knownAreaIds.add(ev.areaId)
      }
      let revealedRoom: LevelRoomView | null = null
      if (host.mapService) {
        try {
          const res = host.mapService.onAddRoomDataPacket({
            roomX: ev.tileX,
            roomY: ev.tileY,
            areaId: ev.areaId,
          })
          revealedRoom = res.room
        } catch {
          // Ignore if act not yet loaded
        }
      }
      const roomForSeed =
        revealedRoom ??
        host.mapService
          ?.peekLevelView?.(ev.areaId, 'all')
          ?.rooms.find((r) => r.tileX === ev.tileX && r.tileY === ev.tileY) ??
        (host.levelView && host.levelView.areaId === ev.areaId
          ? host.levelView.rooms.find((r) => r.tileX === ev.tileX && r.tileY === ev.tileY)
          : undefined) ??
        null
      if (roomForSeed && typeof roomForSeed.room1InitSeed === 'number') {
        host.world.setRevealedRoomSeed(
          ev.areaId,
          ev.tileX,
          ev.tileY,
          roomForSeed.room1InitSeed,
          roomForSeed.worldSubX,
          roomForSeed.worldSubY,
          roomForSeed.subW,
          roomForSeed.subH,
          true,
        )
      }
      host.questFx.onRoomRevealed(ev.areaId, ev.tileX, ev.tileY, () => {
        const room =
          roomForSeed ??
          host.mapService
            ?.peekLevelView?.(DEN_OF_EVIL_LEVEL_ID, 'all')
            ?.rooms.find((r) => r.tileX === ev.tileX && r.tileY === ev.tileY) ??
          null
        if (room) {
          host.world.spawnDenOfEvilLightsInRoom(
            room.worldSubX,
            room.worldSubY,
            room.subW,
            room.subH,
          )
        }
      })
      host.automapView.onServerAddRoom(ev.tileX, ev.tileY, ev.areaId, {
        notifyMapService: false,
      })
      break
    }

    case 'RoomHide': {
      host.questFx.onRoomHidden(ev.areaId, ev.tileX, ev.tileY)
      if (host.mapService) {
        try {
          host.mapService.onRemoveRoomDataPacket({
            roomX: ev.tileX,
            roomY: ev.tileY,
            areaId: ev.areaId,
          })
        } catch {
          // Ignore if act not yet loaded
        }
      }
      host.automapView.onServerRemoveRoom(ev.tileX, ev.tileY, ev.areaId, {
        notifyMapService: false,
      })
      host.pruneMissingInterpolatorEntities()
      break
    }

    case 'UnitAssign': {
      const u = ev.unit
      const uTypeId = unitTypeToId(u.unitType)
      const isLocalPlayer =
        Boolean(ev.isSelf) ||
        (uTypeId === 0 && (host.world.selfId === u.id || host.world.selfId === 0))

      if (uTypeId === 0) {
        host.syncAudioSkillPacks()
      }
      if (isLocalPlayer) {
        if (u.x !== 0 || u.y !== 0) {
          host.predictor.setPosition(u.x, u.y)
          host.camera.snapTo(u.x, u.y)
        }
        if (u.direction !== undefined) {
          host.predictor.setDirection(u.direction)
        }
      } else if (uTypeId !== 1 && (u.x !== 0 || u.y !== 0)) {
        const assignedUnit = host.world.getUnit(u.unitType, u.id)
        host.interpolator.spawnOrSnap({
          unitType: uTypeId,
          unitId: u.id,
          x: u.x,
          y: u.y,
          ...(u.classId !== undefined
            ? { classId: u.classId }
            : assignedUnit?.classId !== undefined
              ? { classId: assignedUnit.classId }
              : {}),
          ...(u.direction !== undefined ? { dir64: u.direction } : {}),
          ...(assignedUnit?.dead ? { dead: true } : {}),
        })
      }
      if (uTypeId === 2) {
        // S2C 0x51 (D2Client 0x6fb57400) builds a new object unit and runs its init 0x6fad5490,
        // which applies the EnvEffect day/night switch 0x6fad5280 with the client act's period.
        const objectUnit = host.world.getUnit(u.unitType, u.id)
        if (objectUnit === undefined) {
          throw new Error(`UnitAssign: object ${String(u.id)} is missing from ClientWorld after apply`)
        }
        if (ENV_EFFECT_OBJECTS.has(objectUnit.classId) && !host.clientActLoaded) {
          // 0x6fad5294: the switch reads the period of `gpAct` (#11044 has no null check).
          host.handleUnexpectedDisconnect(
            `0x51 UnitAssign of EnvEffect object class ${String(objectUnit.classId)} before 0x03 LoadAct: its day/night switch reads the period of a null client act`,
          )
          break
        }
        if (
          !host.envEffects.onObjectCreated(
            objectUnit,
            host.environmentValue.period,
            performance.now(),
          )
        ) {
          // 0x6fad564e: without an EnvEffect switch, the init light is `Lit[mode]` of the packet mode.
          const objectRecord = getObjectsTxtRecord113c(objectUnit.classId)
          setObjectLight(objectUnit, objectRecord, objectLitForMode(objectRecord, objectUnit.mode))
        }
      }
      break
    }

    case 'UnitReassign': {
      const evTypeId = unitTypeToId(ev.unitType)
      const isLocalPlayer =
        evTypeId === 0 && (ev.id === host.world.selfId || host.world.selfId === 0)
      if (isLocalPlayer) {
        // 1.13c D2Client 0x6FB5F640 → 0x6FB57E20: `0x15` repositions the player directly, with
        // no tolerance check whatever its flag byte, and drops the path.
        host.predictor.setPosition(ev.at.x, ev.at.y)
        host.camera.snapTo(ev.at.x, ev.at.y)
        // Sync active area immediately on UnitReassign (before emitAreaSnapshotToPlayer's
        // UnitAssign packets arrive) so same-act warp/waypoint transitions prune stale units
        // from the old area now rather than pruning the new area's snapshot on the next render frame.
        if (host.lastSyncedAreaId > 0) {
          host.syncActiveAreaFromPlayerPosition({ emitHudSync: false })
        }
        // 0x6FB5F6EC `cmp esi,[0x6fbcbbfc]` (local player) → `[0x6FBC981C] = max(old, now + 3000)`
        // (0x6FB5F70B..0x6FB5F720). The `D2Common #10716` gate in between is a 1.13c stub
        // returning 0 (0x6FD8C380).
        host.logicClock.suppressCatchUp(performance.now() + LOCAL_REASSIGN_NO_CATCH_UP_MS)
        // 0x6fb58012: the weather 0x6fb31720 after the move (see `resolveReassignWeatherArg`).
        if (reassignWeatherArg !== null) host.weather.onLocalReassign(reassignWeatherArg)
      } else if (evTypeId !== 1) {
        host.interpolator.spawnOrSnap({
          unitType: evTypeId,
          unitId: ev.id,
          x: ev.at.x,
          y: ev.at.y,
        })
      }
      break
    }

    case 'StatSet': {
      if (
        !ev.unit ||
        (unitTypeToId(ev.unit.unitType) === 0 &&
          (ev.unit.id === host.world.selfId || host.world.selfId === 0))
      ) {
        const self = host.world.self
        if (
          self.maxStamina > 0 ||
          self.stats.has(10) ||
          self.stats.has(11)
        ) {
          host.predictor.setStaminaExhausted(self.stamina <= 0)
        }
      }
      break
    }

    case 'LifeMana': {
      const selfUnit = host.world.getUnit('player', host.world.selfId || 1)
      const isMovementSkillActive =
        Boolean(
          selfUnit?.castState &&
            (selfUnit.castState.skillId === 107 ||
              selfUnit.castState.skillId === 132 ||
              selfUnit.castState.skillId === 143 ||
              selfUnit.castState.skillId === 151),
        ) ||
        selfUnit?.states.has(18) === true ||
        host.world.self.states.has(18)

      if (!isMovementSkillActive && ev.at && (ev.at.x !== 0 || ev.at.y !== 0)) {
        const prevSnap = host.predictor.getSnapshot()
        if (prevSnap.logicalX === 0 && prevSnap.logicalY === 0) {
          host.predictor.setPosition(ev.at.x, ev.at.y)
          host.camera.snapTo(ev.at.x, ev.at.y)
        } else {
          if (ev.vx === undefined || ev.vy === undefined) {
            throw new Error(
              'LifeMana has a position but no vx/vy motion vector (0x18/0x95/0x96 always carry both)',
            )
          }
          host.verifyLocalPlayerPosition(ev.at.x, ev.at.y, {
            kind: 'life-mana',
            vx: ev.vx,
            vy: ev.vy,
          })
        }
      }
      const self = host.world.self
      if (
        self.maxStamina > 0 ||
        self.stats.has(10) ||
        self.stats.has(11)
      ) {
        host.predictor.setStaminaExhausted(self.stamina <= 0)
      }
      break
    }

    case 'UnitMove': {
      const evAny = ev as any
      const evTypeId =
        typeof evAny.unitType === 'number' ? evAny.unitType : unitTypeToId(ev.unitType)
      if (evTypeId === 1) {
        // Monsters are driven by `this.world.npcMotion` (1.13c D2Client + D2Common DynamicPath).
        break
      }
      const evUnitId = Number(evAny.id ?? evAny.unitId ?? (evTypeId === 0 ? 1 : 0))
      const unit = host.world.getUnit(evTypeId as UnitType, evUnitId)
      if (unit?.dead) {
        break
      }
      const rawToX = Number(evAny.to?.x ?? evAny.targetX ?? evAny.x ?? 0)
      const rawToY = Number(evAny.to?.y ?? evAny.targetY ?? evAny.y ?? 0)
      let toX =
        unit?.targetX !== undefined && (rawToX === 0 || evAny.target !== undefined)
          ? unit.targetX
          : rawToX
      let toY =
        unit?.targetY !== undefined && (rawToY === 0 || evAny.target !== undefined)
          ? unit.targetY
          : rawToY
      const explicitFromX = evAny.from?.x ?? evAny.currentX ?? evAny.x
      const explicitFromY = evAny.from?.y ?? evAny.currentY ?? evAny.y
      const existingInterp = host.interpolator.getEntityState(evTypeId, evUnitId)
      const fromX =
        explicitFromX !== undefined
          ? Number(explicitFromX)
          : !existingInterp && preMoveUnitPos !== undefined
            ? preMoveUnitPos.x
            : undefined
      const fromY =
        explicitFromY !== undefined
          ? Number(explicitFromY)
          : !existingInterp && preMoveUnitPos !== undefined
            ? preMoveUnitPos.y
            : undefined

      if (
        ev.target &&
        ((rawToX === 0 && rawToY === 0) ||
          (ev.from !== undefined && rawToX === ev.from.x && rawToY === ev.from.y))
      ) {
        const targetPos = host.resolveTargetUnitWorldPos(ev.target.unitType, ev.target.id)
        if (targetPos) {
          toX = targetPos.x
          toY = targetPos.y
        }
        if (unit && (toX !== 0 || toY !== 0)) {
          unit.targetX = toX
          unit.targetY = toY
        }
      }
      const isLocalPlayer =
        evTypeId === 0 && (evUnitId === host.world.selfId || host.world.selfId === 0)
      if (unit && unit.unitType === 'player') {
        const posForTownX = ev.mode === 'stop' ? toX : Number(fromX ?? unit.x ?? toX)
        const posForTownY = ev.mode === 'stop' ? toY : Number(fromY ?? unit.y ?? toY)
        const inTown = host.isSubTileInTown(posForTownX, posForTownY)
        const isStaminaDepleted =
          isLocalPlayer &&
          (host.predictor.isStaminaExhausted() ||
            ((host.world.self.maxStamina > 0 ||
              host.world.self.stats.has(10) ||
              host.world.self.stats.has(11)) &&
              host.world.self.stamina <= 0))
        if (ev.mode === 'stop') {
          unit.mode = inTown ? 5 : 1
        } else if (ev.mode === 'run' && !isStaminaDepleted) {
          unit.mode = 3
        } else if (ev.mode === 'knockback') {
          unit.mode = 19
        } else {
          unit.mode = inTown ? 6 : 2
          if (isStaminaDepleted && unit.moveMode === 'run') {
            unit.moveMode = 'walk'
          }
        }
      }
      if (isLocalPlayer) {
        if (ev.mode === 'stop') {
          host.verifyLocalPlayerPosition(toX, toY, { kind: 'player-stop' })
        }
      } else if (ev.mode === 'stop') {
        const motionState = host.interpolator.stopEntity({
          unitType: evTypeId,
          unitId: evUnitId,
          x: toX,
          y: toY,
        })
        if (unit) {
          unit.x = motionState.x
          unit.y = motionState.y
          unit.targetX = motionState.targetX
          unit.targetY = motionState.targetY
          unit.moving = motionState.moving
          if (motionState.moving && evTypeId === 0) {
            const unitInTown = host.isSubTileInTown(motionState.x, motionState.y)
            unit.mode = motionState.running ? 3 : unitInTown ? 6 : 2
            unit.moveMode = motionState.running ? 'run' : 'walk'
          } else {
            unit.moveMode = 'stop'
          }
          unit.targetUnit = undefined
          unit.syncTurnState(motionState.dir64, motionState.targetDir64, motionState.stepDir)
        }
      } else {
        const resolvedVelPct =
          ev.velocityPercent ??
          (evTypeId === 0 && unit
            ? host.world.resolvePlayerAnimSpeed(unit.mode, evUnitId).velocityPercent
            : undefined)
        const motionState = host.interpolator.startMove({
          unitType: evTypeId,
          unitId: evUnitId,
          classId: unit?.classId,
          ...(fromX !== undefined ? { currentX: fromX } : {}),
          ...(fromY !== undefined ? { currentY: fromY } : {}),
          targetX: toX,
          targetY: toY,
          running: ev.mode === 'run',
          ...(resolvedVelPct !== undefined ? { velocityPercent: resolvedVelPct } : {}),
          ...(ev.pathType !== undefined ? { pathType: ev.pathType } : {}),
        })
        if (unit) {
          unit.x = motionState.x
          unit.y = motionState.y
          unit.targetX = motionState.targetX
          unit.targetY = motionState.targetY
          unit.moving = motionState.moving
          unit.syncTurnState(motionState.dir64, motionState.targetDir64, motionState.stepDir)
        }
        const worldUnit = host.world.getUnit(ev.unitType, evUnitId)
        if (worldUnit && ev.target) {
          host.interpolator.setEntityTargetDirection(
            evTypeId,
            evUnitId,
            worldUnit.targetDirection,
            false,
          )
        }
      }
      break
    }

    case 'UnitSkillEvent': {
      // S2C 0xA3 handler 0x6fb5efb0: the packet is dropped when the caster is unknown (0x6fb5efd7);
      // the target lookup is not checked. Thunder Storm's client function (#84, 0x6fb24350) forces
      // the lightning here (see `unitSkillEventForcesLightning113c`), while `ClientWorld.apply`
      // spawns fn #84's `thunderstorm1` client missile and attaches its `lightning` overlay.
      const casterKnown = host.unitKnownByRawType(ev.caster.rawUnitType, ev.caster.id)
      const targetKnown = host.unitKnownByRawType(ev.target.rawUnitType, ev.target.id)
      if (unitSkillEventForcesLightning113c({ skill: ev.skill, casterKnown, targetKnown })) {
        host.weather.forceLightning()
      }
      break
    }

    case 'SkillCast': {
      const raw = ev as any
      const actorType: UnitType =
        raw.caster?.unitType ??
        raw.actor?.unitType ??
        raw.unit?.unitType ??
        (raw.kind === 'monsterAttack' ? 1 : (raw.unitType ?? raw.attackerType ?? 0))
      const actorTypeId = unitTypeToId(actorType)
      const actorId = Number(
        raw.caster?.id ??
          raw.actor?.id ??
          raw.unit?.id ??
          raw.monsterId ??
          raw.unitId ??
          raw.attackerId ??
          (host.world.selfId || 1),
      )
      const unit = host.world.getUnit(actorType, actorId)
      if (unit && !unit.dead) {
        const isLocalPlayer =
          actorTypeId === 0 && (actorId === host.world.selfId || host.world.selfId === 0)
        if (isLocalPlayer) {
          host.predictor.stop()
          host.predictor.setTargetDirection(unit.targetDirection, false)
        } else if (actorTypeId !== 1) {
          host.interpolator.setEntityTargetDirection(
            actorTypeId,
            actorId,
            unit.targetDirection,
            false,
          )
        }
      }
      break
    }

    case 'UnitMode': {
      if (ev.eventCode !== undefined) {
        // S2C 0x0E is queued on unit+0xd8 until the unit's 25 Hz tick (0x6fb5c630 / 0x6fb5bc20).
        break
      }
      const uType = unitTypeToId(ev.unitType)
      if (uType === 1) {
        // Monsters are driven by `this.world.npcMotion`.
        break
      }
      const uId = ev.id
      const isLocalPlayer = uType === 0 && (uId === host.world.selfId || host.world.selfId === 0)
      if (isLocalPlayer) {
        if (ev.mode === 0 || ev.mode === 17) {
          host.predictor.stop()
        }
      } else {
        const unit = host.world.getUnit(ev.unitType, uId)
        const isDeadMode =
          Boolean(unit?.dead) ||
          (uType === 0 && (ev.mode === 0 || ev.mode === 17)) ||
          (uType !== 0 && ev.lifePct !== undefined && ev.lifePct <= 0)
        if (isDeadMode) {
          const usePacketAt = ev.at !== undefined && (ev.at.x !== 0 || ev.at.y !== 0)
          const hasMotionState = host.interpolator.getEntityState(uType, uId) !== null
          const deathX = usePacketAt ? ev.at!.x : hasMotionState ? undefined : unit?.x
          const deathY = usePacketAt ? ev.at!.y : hasMotionState ? undefined : unit?.y
          const frozen = host.interpolator.freezeEntityAt({
            unitType: uType,
            unitId: uId,
            ...(deathX !== undefined ? { x: deathX } : {}),
            ...(deathY !== undefined ? { y: deathY } : {}),
          })
          if (unit) {
            unit.x = frozen.x
            unit.y = frozen.y
            unit.targetX = frozen.x
            unit.targetY = frozen.y
            unit.setDirection(frozen.dir64)
          }
        } else {
          host.interpolator.unfreezeEntity(uType, uId)
          const stopX = ev.at && (ev.at.x !== 0 || ev.at.y !== 0) ? ev.at.x : unit?.x
          const stopY = ev.at && (ev.at.x !== 0 || ev.at.y !== 0) ? ev.at.y : unit?.y
          const isMovingMode =
            ev.mode === 2 || ev.mode === 3 || ev.mode === 6 || ev.mode === 19
          if (stopX !== undefined && stopY !== undefined && !isMovingMode) {
            const isNeutralStop = ev.mode === 1 || ev.mode === 5
            const stopped = host.interpolator.stopEntity({
              unitType: uType,
              unitId: uId,
              x: stopX,
              y: stopY,
              ...(isNeutralStop ? {} : { hardSnapThreshold: 0 }),
            })
            if (unit) {
              unit.x = stopped.x
              unit.y = stopped.y
              unit.targetX = stopped.targetX
              unit.targetY = stopped.targetY
              unit.moving = stopped.moving
              if (stopped.moving && uType === 0 && isNeutralStop) {
                const unitInTown = host.isSubTileInTown(stopped.x, stopped.y)
                unit.mode = stopped.running ? 3 : unitInTown ? 6 : 2
                unit.moveMode = stopped.running ? 'run' : 'walk'
              } else {
                unit.moveMode = 'stop'
              }
              unit.targetUnit = undefined
              unit.syncTurnState(stopped.dir64, stopped.targetDir64, stopped.stepDir)
            }
          }
        }
      }
      break
    }

    case 'UnitRemove': {
      host.interpolator.removeEntity(unitTypeToId(ev.unitType), ev.id)
      if (preRemoveNpcCancelId !== null) {
        host.hudModel.cancelNpcSession(preRemoveNpcCancelId)
        if (host.hudManager.leftPanel === 'vendor') {
          host.hudManager.worldPanels.clearVendorShop()
          host.hudManager.hideLeftPanelFromWorld('vendor')
        }
      }
      if (preRemoveStashClose) {
        host.hudModel.closeStash()
        if (host.hudManager.leftPanel === 'stash') {
          host.hudManager.hideLeftPanelFromWorld('stash')
        }
      }
      break
    }

    case 'QuestState': {
      if (ev.kind === 'availability' || ev.source === 0x5e) {
        // S2C 0x5E handler 0x6fb5c090: the Den of Evil light reads byte 1 (A1Q1).
        if (ev.availabilityBytes === undefined) {
          throw new Error('S2C 0x5E GameQuestAvailability event without its 37 availability bytes')
        }
        host.questFx.onQuestAvailability(ev.availabilityBytes)
      } else if (ev.kind === 'special' || ev.source === 0x89) {
        const eventId = ev.specialEventId ?? ev.quests[0]
        if (eventId === undefined) {
          throw new Error('S2C 0x89 SpecialQuestEvent event without an event id')
        }
        host.questFx.onSpecialQuestEvent(eventId, {
          findStoneAlpha: () => host.findStoneAlphaNearLocalPlayer(),
          spawnCairnStones: (x, y) => {
            host.world.spawnCairnStonesController(x, y)
          },
          spawnDiabloAppearsIfInChaosSanctuary: () => {
            host.spawnDiabloAppearsIfInChaosSanctuary()
          },
          spawnHoradricStaffIfOrificeNear: () => {
            host.spawnHoradricStaffIfOrificeNear()
          },
        })
      } else if (
        ev.source === 0x28 &&
        ev.updateType === 0 &&
        ev.unitId !== undefined &&
        ev.unitId > 0 &&
        host.world.npcInteraction.npcId === ev.unitId &&
        host.gameAdapter &&
        host.gameAdapter.state !== 'closed'
      ) {
        // D2Client.dll 0x6fafb8a0 (at 0x6fafb9aa): S2C 0x28 UpdateQuestInfo with updateType === 0
        // sends C2S 0x2F NpcInit(1, unitId) after the server's MONSTER_Interact (0x6fc687a0) has set
        // pPlayer->bInteracting = 1 on frame + 1.
        try {
          host.gameAdapter.send({
            type: 'NpcInit',
            target: { unitType: 1, id: ev.unitId },
          })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          host.handleUnexpectedDisconnect(`Failed to send NpcInit on 0x28: ${msg}`, 'error', true)
        }
      }
      break
    }

    case 'StateSet': {
      if (stateSetUnitKnown) {
        host.runStateSetFunctions(ev)
      }
      break
    }

    case 'Pong': {
      if (ev.rttMs !== undefined) {
        host.pingMsValue = ev.rttMs
      }
      break
    }

    case 'GameLogout': {
      if (host.phaseValue === 'ingame' || host.phaseValue === 'entering-game') {
        host.handleUnexpectedDisconnect('Game session ended (GameLogout)')
      }
      break
    }

    default:
      break
  }

  // Emit any newly added chat entries
  if (host.world.chatLog.length > prevChatCount) {
    for (let i = prevChatCount; i < host.world.chatLog.length; i++) {
      const chatEntry = host.world.chatLog[i]
      if (chatEntry) {
        for (const listener of host.chatListeners) {
          listener(chatEntry)
        }
      }
    }
  }

  if (ev.type === 'RoomReveal' || ev.type === 'RoomHide') {
    const prevArea = host.lastSyncedAreaId > 0 ? host.lastSyncedAreaId : host.world.areaId
    host.syncActiveAreaFromPlayerPosition({ emitHudSync: false })
    if (host.world.areaId !== prevArea) {
      host.hudModel.syncFromWorld()
    } else {
      host.hudModel.syncTargetMonsterFromWorld()
    }
  } else if (
    host.hudModel.isFastPathMonsterEvent(ev) &&
    preRemoveNpcCancelId === null &&
    !preRemoveStashClose
  ) {
    host.hudModel.syncTargetMonsterFromWorld()
  } else if (
    host.hudModel.isFastPathVitalsEvent(ev) &&
    preRemoveNpcCancelId === null &&
    !preRemoveStashClose
  ) {
    const prevArea = host.lastSyncedAreaId > 0 ? host.lastSyncedAreaId : host.world.areaId
    host.syncActiveAreaFromPlayerPosition({ emitHudSync: false })
    if (host.world.areaId !== prevArea) {
      host.hudModel.syncFromWorld()
    } else {
      host.hudModel.syncVitalsFromWorld()
    }
  } else {
    // Synchronize active area and AutomapView from current player position (#549)
    host.syncActiveAreaFromPlayerPosition({ emitHudSync: false })

    // Synchronize HudManager via HudModel
    host.hudModel.syncFromWorld()
  }

  host.drainWorldSoundRequests()

  for (const listener of host.eventListeners) {
    listener(ev)
  }
}

export function syncAudioSkillPacks(host: SessionEventProcessorHost): void {
  if (host.hudManager?.tradeHallMode) return
  const classes: Array<number | string> = []
  const selfClass = host.world.self.charClass
  if (selfClass !== null && selfClass >= 0 && selfClass <= 6) {
    classes.push(selfClass)
  }
  for (const unit of host.world.getUnitsByType('player')) {
    if (unit.classId >= 0 && unit.classId <= 6 && !classes.includes(unit.classId)) {
      classes.push(unit.classId)
    }
  }
  for (const member of host.world.party.values()) {
    const mClass = member.charClass
    if (mClass !== undefined && mClass >= 0 && mClass <= 6 && !classes.includes(mClass)) {
      classes.push(mClass)
    }
  }
  if (classes.length > 0) {
    void host.audioRuntime?.preloadSkillPacksForClasses(classes)
  }
}

export function drainWorldSoundRequests(
  host: Pick<SessionEventProcessorHost, 'world' | 'audioRuntime' | 'resolveTargetUnitWorldPos'> & {
    readonly predictor?: LocalMovementPredictor | undefined
    readonly hudManager?: SessionEventProcessorHost['hudManager'] | undefined
  },
): void {
  const reqs = host.world.drainWorldSoundRequests()
  if (reqs.length === 0 || host.hudManager?.tradeHallMode) return
  const runtime = host.audioRuntime
  const predSnap = host.predictor?.getSnapshot()
  const selfPos = host.world?.self
  const listenerPos = {
    x: Math.round(
      predSnap && (predSnap.x !== 0 || predSnap.y !== 0) ? predSnap.x : (selfPos?.x ?? 0),
    ),
    y: Math.round(
      predSnap && (predSnap.x !== 0 || predSnap.y !== 0) ? predSnap.y : (selfPos?.y ?? 0),
    ),
  }
  const toRelPos = (
    worldX: number | undefined,
    worldY: number | undefined,
    soundId = 0,
  ): { readonly x?: number; readonly y?: number } => {
    if (worldX === undefined || worldY === undefined) return {}
    if (listenerPos.x === 0 && listenerPos.y === 0) {
      return { x: Math.round(worldX), y: Math.round(worldY) }
    }
    return unitSoundPosition113c(
      { x: Math.round(worldX), y: Math.round(worldY) },
      listenerPos,
      soundId,
    )
  }
  for (const req of reqs) {
    if (req.kind === 'skill-cast' && req.skillId !== undefined) {
      const rel = toRelPos(req.x, req.y)
      runtime?.onSkillCastStart({
        skillId: req.skillId,
        ...(req.charclass !== undefined ? { charclass: req.charclass } : {}),
        ...(req.unitId !== undefined ? { unitId: req.unitId } : {}),
        ...(req.unit !== undefined ? { unit: req.unit } : {}),
        ...(req.x !== undefined ? { worldX: req.x } : {}),
        ...(req.y !== undefined ? { worldY: req.y } : {}),
        ...rel,
        ...(req.local !== undefined ? { local: req.local } : {}),
      })
      continue
    }
    if (req.kind === 'skill-keyframe' && req.skillId !== undefined) {
      const rel = toRelPos(req.x, req.y)
      runtime?.onAnimKeyframe({
        skillId: req.skillId,
        flag: req.flag ?? 1,
        ...(req.weaponSoundId !== undefined ? { weaponSoundId: req.weaponSoundId } : {}),
        ...(req.x !== undefined ? { worldX: req.x } : {}),
        ...(req.y !== undefined ? { worldY: req.y } : {}),
        ...rel,
        ...(req.local !== undefined ? { local: req.local } : {}),
      })
      continue
    }
    if (req.kind === 'missile-spawn' && req.missileId !== undefined) {
      const rel = toRelPos(req.x, req.y)
      runtime?.onMissileSpawn({
        missileId: req.missileId,
        ...(req.entityId !== undefined ? { entityId: req.entityId } : {}),
        ...(req.x !== undefined ? { worldX: req.x } : {}),
        ...(req.y !== undefined ? { worldY: req.y } : {}),
        ...rel,
      })
      continue
    }
    if (req.kind === 'missile-tick' && req.entityId !== undefined) {
      const rel = toRelPos(req.x ?? 0, req.y ?? 0)
      runtime?.onMissileTick({
        entityId: req.entityId,
        ...(req.x !== undefined ? { worldX: req.x } : {}),
        ...(req.y !== undefined ? { worldY: req.y } : {}),
        x: rel.x ?? 0,
        y: rel.y ?? 0,
      })
      continue
    }
    if (req.kind === 'missile-destroy' && req.entityId !== undefined) {
      runtime?.onMissileDestroy({ entityId: req.entityId })
      continue
    }
    if (req.kind === 'missile-impact' && req.missileId !== undefined) {
      const rel = toRelPos(req.x, req.y)
      runtime?.onMissileImpact({
        missileId: req.missileId,
        ...(req.entityId !== undefined ? { entityId: req.entityId } : {}),
        ...(req.x !== undefined ? { worldX: req.x } : {}),
        ...(req.y !== undefined ? { worldY: req.y } : {}),
        ...rel,
        ...(req.prog !== undefined ? { prog: req.prog } : {}),
      })
      continue
    }
    if (req.kind === 'speech-stop' || req.kind === 'npc-cancel') {
      runtime?.stopSpeech()
      continue
    }
    if (req.kind === 'unit-loop-stop') {
      if (req.unit !== undefined) {
        runtime?.stopUnitLoopSound({
          unitType: req.unit.unitType,
          id: req.unit.id,
        })
      }
      continue
    }
    if (req.kind === 'unit-sound-stop' || req.kind === 'skill-cast-stop') {
      const unitRef =
        req.unit ??
        (req.unitId !== undefined ? { unitType: 'player' as const, id: req.unitId } : undefined)
      const stopSid =
        req.soundId !== undefined && req.soundId > 0
          ? req.soundId
          : req.skillId === 151
            ? 2531
            : 0
      if (unitRef !== undefined && stopSid > 0) {
        runtime?.stopUnitSound(
          {
            unitType: unitRef.unitType,
            id: unitRef.id,
          },
          stopSid,
        )
      }
      runtime?.skillSounds.onSkillCastStop(req)
      continue
    }
    if (
      req.stingerSoundId !== undefined &&
      req.stingerSoundId >= 4685 &&
      req.stingerSoundId <= 4698
    ) {
      runtime?.playQuestStinger(req.stingerSoundId)
    }
    if (req.speechSoundId !== undefined && req.speechSoundId > 0) {
      if (
        req.eventCode === 18 &&
        (Boolean(host.hudManager?.worldPanels.npcSpeech) ||
          Boolean(host.hudManager?.worldPanels.npcMenu) ||
          host.world.npcInteraction.npcId !== null)
      ) {
        continue
      }
      runtime?.playSpeech(req.speechSoundId)
      continue
    }
    const soundId = req.soundId
    if (soundId === undefined || soundId <= 0) continue
    if (soundId >= 4685 && soundId <= 4698) {
      if (req.stingerSoundId === undefined) {
        runtime?.playQuestStinger(soundId)
      }
      continue
    }
    const volume = req.volumeOverride ?? req.volume
    if (req.unit !== undefined) {
      const uTypeId = unitTypeToId(req.unit.unitType)
      const isLocalPlayer =
        req.unit.isLocalPlayer ??
        (uTypeId === 0 && (req.unit.id === host.world.selfId || host.world.selfId === 0))
      const livePos = host.resolveTargetUnitWorldPos(req.unit.unitType, req.unit.id)
      const fallbackX = req.x ?? req.unit.x ?? 0
      const fallbackY = req.y ?? req.unit.y ?? 0
      const unitX = livePos?.x ?? fallbackX
      const unitY = livePos?.y ?? fallbackY
      const unitRef = req.unit
      const existedInWorld =
        isLocalPlayer || host.world.getUnit(unitRef.unitType, unitRef.id) !== undefined
      const playOpts = {
        unit: {
          unitType: unitRef.unitType,
          id: unitRef.id,
          x: unitX,
          y: unitY,
          isLocalPlayer,
          getPos: () => {
            if (existedInWorld && !isLocalPlayer && !host.world.getUnit(unitRef.unitType, unitRef.id)) {
              return null
            }
            const p = host.resolveTargetUnitWorldPos(unitRef.unitType, unitRef.id)
            return p ?? { x: unitX, y: unitY }
          },
        },
        x: unitX,
        y: unitY,
        ...(req.local !== undefined ? { local: req.local } : {}),
        ...(req.delayTicks !== undefined ? { delayTicks: req.delayTicks } : {}),
        ...(volume !== undefined ? { volume } : {}),
      }
      if (req.kind === 'unit-loop-start') {
        runtime?.startUnitLoopSound(soundId, playOpts)
      } else {
        runtime?.playSound(soundId, playOpts)
      }
    } else {
      const rel = req.local ? {} : toRelPos(req.x, req.y, soundId)
      runtime?.playSound(soundId, {
        ...rel,
        ...(req.local !== undefined ? { local: req.local } : {}),
        ...(req.delayTicks !== undefined ? { delayTicks: req.delayTicks } : {}),
        ...(volume !== undefined ? { volume } : {}),
      })
    }
  }
}

export function resolveTargetUnitWorldPos(
  host: Pick<SessionEventProcessorHost, 'world' | 'predictor' | 'interpolator'>,
  unitType: UnitType,
  unitId: number,
): { readonly x: number; readonly y: number } | null {
  const targetTypeId = unitTypeToId(unitType)
  const isTargetLocalPlayer =
    targetTypeId === 0 && (unitId === host.world.selfId || host.world.selfId === 0)
  if (isTargetLocalPlayer) {
    const predSnap = host.predictor.getSnapshot()
    if (predSnap.x !== 0 || predSnap.y !== 0) {
      return { x: predSnap.x, y: predSnap.y }
    }
    if (host.world.self.x !== 0 || host.world.self.y !== 0) {
      return { x: host.world.self.x, y: host.world.self.y }
    }
  } else if (targetTypeId !== 1) {
    const targetInterp = host.interpolator.getEntityState(targetTypeId, unitId)
    if (targetInterp && (targetInterp.x !== 0 || targetInterp.y !== 0)) {
      return { x: targetInterp.x, y: targetInterp.y }
    }
  }
  const targetUnit = host.world.getUnit(unitType, unitId)
  if (targetUnit && (targetUnit.x !== 0 || targetUnit.y !== 0)) {
    return { x: targetUnit.x, y: targetUnit.y }
  }
  return null
}
