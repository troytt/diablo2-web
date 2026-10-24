/**
 * Online Session Coordinator (`src/client/session/online-session.ts`, Milestone M5 — F16, F18, F20).
 *
 * Orchestrates the end-to-end client runtime across:
 * - `D2OnlineFlow` + `createWsBridgeResolver` (BNCS -> MCP -> D2GS in-game lifecycle)
 * - `ClientWorld` authoritative state mirror
 * - `MapService` + `AutomapView` (`off` | `level` | `act` reveal modes)
 * - `LocalMovementPredictor` (25Hz step + rubber-band / hard-snap server reconciliation)
 * - `RemoteEntityInterpolator` (remote monster/NPC/player smooth motion)
 * - `ClientWorldSceneSource` (feeding `WorldRenderer` across `800×600` and `1024×768`)
 * - `HudManager` + `HudModel` + `CommandMapper` + `OutboundRateLimiter`
 * - `SettingsStore` and deterministic `.d2cap` capture replay
 * - Graceful disconnect / error recovery without uncaught promise rejections or page crashes.
 *
 * Strict import boundary: imports only from `src/netproto/index.ts` (never `bncs/mcp/d2gs/crypto`).
 */

import {
  BncsCreateAccountError, D2gsS2cFramer, InMemoryPacketTap, createD2OnlineFlow, createWsBridgeResolver,
  type CharCreateSpec, type CharSummary, type ChatEvent, type ClientCommand, type CloseReason, type D2CapRecord,
  type D2OnlineConfig, type D2OnlineFlow, type D2OnlineSessionKind, type D2OnlineSessionLost,
  type D2OnlineSessionLostCause, type D2OnlineState, type EndpointResolver, type GameCreateSpec,
  type GameInfoDetail, type GameListEntry, type GameServerAdapter, type ItemDataTables,
  type RealmSummary, type ServerEvent, type UnitType,
} from '../../netproto/index.ts'
import {
  formatBncsChatEvent113c,
  type BncsChatEventFormatInput,
} from '../../common/chat/chat-113c.ts'
import { D2Rng } from '../../common/rng/d2-rng.ts'
import { Environment } from '../../common/world/environment.ts'
import { requireTbl } from '../i18n/lang.ts'
import { HudManager } from '../ui/hud-manager.ts'
import { AutomapView } from '../automap/automap-view.ts'
import { CommandMapper, ViewportCamera, type CameraLike } from '../input/command-mapper.ts'
import type { LevelView } from '../map/level-view.ts'
import type { MapService } from '../map/map-service.ts'
import { RemoteEntityInterpolator } from '../motion/interpolate.ts'
import { LocalMovementPredictor, type ServerPositionSource } from '../motion/predictor.ts'
import { getGlobalSettingsStore, type SettingsStore } from '../settings/settings-store.ts'
import { HudModel } from '../ui-model/hud-model.ts'
import { vendorPrice113c, vendorRepairAll113c } from '../ui-model/vendor-price.ts'
import { ClientWorldSceneSource, type SceneAmbientState } from '../view/scene-source.ts'
import type { RenderableUnitInput } from '../view/unit-drawables.ts'
import { getViewportProfile } from '../view/viewport-profile.ts'
import { WeatherController } from '../weather/weather-controller.ts'
import { ClientWorld, type ChatLogEntry } from '../world/client-world.ts'
import { EnvEffectController } from '../world/env-effect.ts'
import { getCanonicalItemDataTables } from '../world/item-tables-provider.ts'
import { QuestFxLight } from '../world/quest-fx-light.ts'
import type { ClientUnit } from '../world/client-unit.ts'
import { LogicClock } from '../loop/logic-clock.ts'
import { OutboundRateLimiter } from './rate-limiter.ts'
import { C2sIdenticalPacketDedupe113c } from './c2s-identical-dedupe-113c.ts'
import { computeGameCompletion113c, type GameCompletion113c } from './game-completion-113c.ts'
import { AudioRuntime113c } from '../audio/audio-runtime-113c.ts'
import {
  ACTIVE_CHAR_LEASE_HEARTBEAT_MS, DuplicateCharacterLoginError, createMemoryLeaseStorage,
  findConflictingCharacterLease, formatLobbyGameEnterError, formatMcpCreateGameStatusError,
  formatMcpJoinGameStatusError, getDefaultBrowserLeaseStorage, parseMcpGameErrorStatus,
  releaseActiveCharacterLease, writeActiveCharacterLease, type ActiveCharLeaseStorage,
} from './active-char-lock.ts'
import {
  decodeCapturedGameS2cPacket, extractSessionEventsFromReplayRecord, loadSessionD2CapReplay,
  replayAllSessionD2Cap, stepSessionD2CapReplay, type ReplayedD2CapFrame, type SessionReplayHost,
} from './session-d2cap-replay.ts'
import {
  applyViewRetention, enforceActiveInteractionRange113c, findObjectNearLocalPlayer,
  findObjectNearSubTile, findStoneAlphaNearLocalPlayer, getCandidateAreaIds, isLocalPlayerInTown,
  isSubTileBlockedInView, isSubTileInTown, isSubTileMissileBlockedInView, isWorldSubTileBlocked,
  isWorldSubTileMissileBlocked, prefetchGateNeighbourLevels, pruneMissingInterpolatorEntities,
  resolveCollisionLevelView, resolveNeighbourLevelViews, resolveSceneAmbient,
  resolveUnitRoomLevelId, runStateSetFunctions, spawnDiabloAppearsIfInChaosSanctuary,
  spawnHoradricStaffIfOrificeNear, syncActiveAreaFromPlayerPosition, verifyLocalPlayerPosition,
  type SessionLevelNavigationHost,
} from './session-level-navigation.ts'
import {
  applyPersistedPlayersToCurrentGame, dispatchSessionCommand, drainWorldSoundRequests,
  forwardSessionCommandToAdapter, handleServerEvent, navigateSessionChatInputHistory,
  resolveReassignWeatherArg, resolveTargetUnitWorldPos, submitSessionChatInput,
  syncAudioSkillPacks, unitKnownByRawType,
  type SessionEventProcessorHost,
} from './session-event-processor.ts'
import {
  buildRenderableUnits, buildSceneSnapshot, tickSessionFrame,
  type SelfAppearanceCacheEntry, type SessionRenderBuilderHost,
} from './session-render-builder.ts'

export * from './session-d2cap-replay.ts'
export * from './session-level-navigation.ts'
export * from './session-event-processor.ts'
export * from './session-render-builder.ts'
export {
  DuplicateCharacterLoginError,
  createMemoryLeaseStorage,
  formatLobbyGameEnterError,
  formatMcpCreateGameStatusError,
  formatMcpJoinGameStatusError,
  parseMcpGameErrorStatus,
  type ActiveCharLeaseStorage,
}

export type OnlineSessionPhase =
  | 'idle'
  | 'connecting'
  | 'lobby'
  | 'entering-game'
  | 'ingame'
  | 'replay'
  | 'disconnected'
  | 'error'

export interface OnlineSessionLoginParams {
  readonly host?: string | undefined
  readonly bncsPort?: number | undefined
  readonly wsBridgeBaseUrl?: string | undefined
  readonly username: string
  readonly password: string
  readonly realmIndex?: number | undefined
}

export interface OnlineSessionLobbySnapshot {
  readonly phase: OnlineSessionPhase
  readonly flowState: D2OnlineState
  readonly username: string
  readonly selectedRealm: RealmSummary | null
  readonly realms: readonly RealmSummary[]
  readonly characters: readonly CharSummary[]
  readonly selectedChar: string | null
  readonly games: readonly GameListEntry[]
  readonly activeGameName: string | null
  readonly disconnectReason: string | null
  readonly pingMs: number
}

export interface OnlineSessionOptions {
  readonly world?: ClientWorld | undefined
  readonly hudManager?: HudManager | undefined
  readonly camera?: CameraLike | undefined
  readonly mapService?: MapService | null | undefined
  readonly automapView?: AutomapView | undefined
  readonly predictor?: LocalMovementPredictor | undefined
  readonly interpolator?: RemoteEntityInterpolator | undefined
  readonly rateLimiter?: OutboundRateLimiter | undefined
  readonly settingsStore?: SettingsStore | undefined
  readonly resolver?: EndpointResolver | undefined
  readonly flowFactory?: ((config: D2OnlineConfig) => D2OnlineFlow) | undefined
  readonly itemTables?: ItemDataTables | undefined
  readonly defaultHost?: string | undefined
  readonly defaultBncsPort?: number | undefined
  readonly wsBridgeBaseUrl?: string | undefined
  readonly isExternalUiIntercepted?: ((screenX: number, screenY: number) => boolean) | undefined
  readonly onToggleChatInput?: (() => void) | undefined
  readonly onEscapeMenu?: (() => void) | undefined
  /** Weather RNG (tests inject a seed; defaults to a random seed, see `WeatherController`). */
  readonly weatherRng?: D2Rng | undefined
  /** 1.13c client sound runtime (`AudioRuntime113c`). */
  readonly audioRuntime?: AudioRuntime113c | undefined
  /** Optional cross-tab active character lease storage (`window.localStorage` by default in browsers). */
  readonly leaseStorage?: ActiveCharLeaseStorage | null | undefined
  /** Optional tab identifier for cross-tab active character lease coordination. */
  readonly tabId?: string | undefined
}

/**
 * Single Player character context handed to `attachGameServer` for a local (`LocalLoopbackAdapter`)
 * game. 1.13c keeps the same cached char info (`[0x6fbcb980]`) for open/SP and realm characters, so the
 * in-game lifecycle (S2C `0x61 07` → `completeGame`) needs the selected character in both modes.
 */
export interface LocalGameCharacterContext {
  /** Local character list (`LocalLobbyProvider.listCharacters`). */
  readonly characters: readonly CharSummary[]
  /** Canonical name of the character entering the game; must be one of `characters`. */
  readonly selectedName: string
  /**
   * Persist the progression rewritten by `0x6faf52fd` into the local `.d2s` header (`+0x25`), i.e.
   * `LocalLobbyProvider.writeCharacterProgression`. Called after the local game was saved and closed.
   */
  readonly writeProgression: (name: string, progression: number) => void
}

export interface AttachGameServerOptions {
  readonly localCharacter?: LocalGameCharacterContext | undefined
}

/** Which connection ended the session (`client` = ended on purpose by this client). */
export type OnlineSessionLostSource = D2OnlineSessionKind | 'client'
export type OnlineSessionLostCause = D2OnlineSessionLostCause | 'local'

export interface OnlineSessionLostEvent {
  /** User-facing reason (1.13c tbl text + technical detail), shown on the login screen. */
  readonly reason: string
  readonly session: OnlineSessionLostSource
  readonly cause: OnlineSessionLostCause
  /** Technical description (close code/reason, timed-out request, missing session, ...). */
  readonly technical: string
}

/**
 * Thrown by `OnlineSession` operations once the Battle.net session is gone. The loss itself has
 * already been handled centrally (connections disposed, `onSessionLost` notified), so UI callers
 * must not show it as an operation error on the current screen.
 */
export class SessionLostError extends Error {
  override readonly name = 'SessionLostError'
  constructor(readonly event: OnlineSessionLostEvent) {
    super(event.reason)
  }
}

/**
 * 1.13c tbl string for a session loss (ENG: the frontend bitmap fonts are byte glyphs):
 * - `string#5352` "Your connection to Battle.net has been lost."
 * - `string#5357` "Your connection has been interrupted" (realm / game server)
 * - `string#5349` "Timed out waiting for response."
 * - `string#5353` "Battle.net is not responding. Please try connecting again in a few minutes."
 * - `patchstring#1066` "Diablo II was unable to connect to the realm server. ..."
 * - `string#5351` "Lost Connection to battle.net."
 * Returns `null` when no 1.13c string matches; the technical reason is then shown alone.
 */
export function sessionLostTblKey(
  session: OnlineSessionLostSource,
  cause: OnlineSessionLostCause,
): string | null {
  if (session === 'client' || cause === 'local') return null
  switch (cause) {
    case 'timeout':
      return 'string#5349'
    case 'not_connected':
      return 'string#5351'
    case 'connect_failed':
      return session === 'bncs' ? 'string#5353' : session === 'mcp' ? 'patchstring#1066' : null
    case 'closed':
    case 'error':
      return session === 'bncs' ? 'string#5352' : 'string#5357'
  }
}

export function formatSessionLostReason(
  session: OnlineSessionLostSource,
  cause: OnlineSessionLostCause,
  technical: string,
): string {
  const key = sessionLostTblKey(session, cause)
  if (key === null) return technical
  const text = requireTbl(key, 'ENG').replace(/\s+/g, ' ').trim()
  return technical ? `${text} (${technical})` : text
}

const LOBBY_SESSION_LABEL: Readonly<Record<'bncs' | 'mcp', string>> = {
  bncs: 'BNCS',
  mcp: 'MCP realm',
}

export class OnlineSession {
  readonly world: ClientWorld
  readonly hudManager: HudManager
  readonly camera: CameraLike
  readonly mapService: MapService | null
  readonly automapView: AutomapView
  readonly predictor: LocalMovementPredictor
  readonly interpolator: RemoteEntityInterpolator
  readonly rateLimiter: OutboundRateLimiter
  readonly settingsStore: SettingsStore
  readonly packetTap: InMemoryPacketTap
  readonly hudModel: HudModel
  readonly commandMapper: CommandMapper
  readonly sceneSource: ClientWorldSceneSource
  /**
   * Act environment clock of the client act. 1.13c allocates a fresh one with every client act
   * (S2C 0x03 → ENVIRONMENT_Alloc 0x6fd87ba0) and syncs it with S2C 0x53.
   */
  get environment(): Environment {
    return this.environmentValue
  }
  /** Den / Act 4 / global-fade light state (D2Client 1.13c quest special ambient lights, #826). */
  get questFxLight(): QuestFxLight {
    return this.questFx
  }
  /**
   * 1.13c D2Client game-loop tick schedule (D2Client 0x6FAF4C6F..0x6FAF4D79). The frame loop
   * asks it which 40 ms ticks are owed; 0x03 and a local-player 0x15 raise its no-catch-up window.
   */
  readonly logicClock = new LogicClock(performance.now())
  /** 1.13c client weather (rain / snow / splashes / bubbles); drawn by `WeatherScenePass`. */
  readonly weather: WeatherController
  /** 1.13c client sound runtime (`SOUND_Tick` / `AudioRuntime113c`). */
  readonly audioRuntime: AudioRuntime113c
  levelView?: LevelView | null | undefined

  private resolver: EndpointResolver
  private readonly hasCustomResolver: boolean
  private readonly customWsBridgeBaseUrl: string | undefined
  private resolverWsBase: string
  private readonly flowFactory: (config: D2OnlineConfig) => D2OnlineFlow
  private readonly itemTables: ItemDataTables
  private readonly defaultHost: string
  private readonly defaultBncsPort: number
  private readonly replayS2cFramer = new D2gsS2cFramer(false)
  private replayQueue: D2CapRecord[] = []
  private replayCursor = 0
  private replaySeq = 0

  private environmentValue = Environment.alloc()
  /**
   * Whether a client act exists (`[0x6fbcc3b8]` non-null): set by a successful S2C 0x03 LoadAct,
   * cleared when a game is entered. The 25 Hz environment update needs it (#10135 asserts on a
   * null act).
   */
  private clientActLoaded = false
  /** EnvEffect objects; one per session like 1.13c's process-wide refresh cache `[0x6fbd3420]`. */
  private readonly envEffects = new EnvEffectController()
  /**
   * Game frame of the last object light easing, the `[0x6fbcbef8]` of 0x6fb3b1ac: the world draw builds the light grid
   * (LightUpdate 0x6fb59b50 per light) only when `world.frameCount` (`[0x6fbc97f8]`) moved past it.
   */
  private lastObjectLightBuildFrame = 0
  /**
   * #941: resolved self equipment appearance cache. Valid while the four slot item identities,
   * weapon set, and container revision are unchanged.
   */
  private selfAppearanceCache: SelfAppearanceCacheEntry | null = null
  /**
   * Quest special ambient lights (`CLIENT_GetAmbientLight` steps 1–3): per session like the
   * process-wide D2Client globals they port; `enterGame` runs their game-init reset.
   */
  private readonly questFx = new QuestFxLight()

  private flow: D2OnlineFlow | null = null
  private gameAdapter: GameServerAdapter | null = null
  private unsubGameEvent: (() => void) | null = null
  private unsubGameClose: (() => void) | null = null
  private unsubFlowState: (() => void) | null = null
  private unsubFlowLost: (() => void) | null = null
  private unsubFlowChat: (() => void) | null = null
  private unsubSettings: (() => void) | null = null
  /** The loss that ended the current session lifecycle (reset by `login` / `attachGameServer`). */
  private sessionLostValue: SessionLostError | null = null
  /** The flow that was active when `sessionLostValue` was handled. */
  private lostFlow: D2OnlineFlow | null = null
  private pendingFlowClose: Promise<void> = Promise.resolve()

  private phaseValue: OnlineSessionPhase = 'idle'
  private usernameValue = ''
  private loginHostValue: string | null = null
  private realmsValue: readonly RealmSummary[] = []
  private selectedRealmValue: RealmSummary | null = null
  private charactersValue: readonly CharSummary[] = []
  private selectedCharValue: string | null = null
  private mcpLoggedInChar: string | null = null
  private pendingGameCompletionValue: GameCompletion113c | null = null
  /** Single Player `.d2s` progression writer for the active local game (`null` online / idle). */
  private localProgressionWriter: ((name: string, progression: number) => void) | null = null
  /** The adapter `leaveGame` is closing on purpose; its `onClose` is not a lost session. */
  private leavingAdapter: GameServerAdapter | null = null
  private gamesValue: readonly GameListEntry[] = []
  private activeGameNameValue: string | null = null
  private disconnectReasonValue: string | null = null
  private pingMsValue = 0
  private tickCounter = 0
  private readonly knownAreaIds = new Set<number>()
  /** #954 view-retention state: stable-primary dwell + last applied keep-set signature. */
  private viewRetentionPrimaryAreaId = -1
  private viewRetentionStableSinceMs = 0
  private viewRetentionSignature: string | null = null

  private readonly outboundCommandsLog: ClientCommand[] = []
  private readonly outboundBncsChatLog: string[] = []
  /** 1.13c D2Client 0x6fac43e0 SendPacket identical-packet dedupe (50/200 ms, one shared slot). */
  private readonly c2sDedupe = new C2sIdenticalPacketDedupe113c()
  private readonly stateListeners = new Set<(snapshot: OnlineSessionLobbySnapshot) => void>()
  private readonly eventListeners = new Set<(ev: ServerEvent) => void>()
  private readonly chatListeners = new Set<(entry: ChatLogEntry) => void>()
  private readonly disconnectListeners = new Set<(reason: string) => void>()
  private readonly sessionLostListeners = new Set<(ev: OnlineSessionLostEvent) => void>()
  private readonly leaseStorage: ActiveCharLeaseStorage | null
  private readonly tabId: string
  private activeLeaseHost: string | null = null
  private activeLeaseChar: string | null = null
  private activeLeaseGame: string | null = null
  private leaseHeartbeatTimer: ReturnType<typeof setInterval> | null = null
  private unsubPageUnload: (() => void) | null = null

  constructor(options: OnlineSessionOptions = {}) {
    this.settingsStore = options.settingsStore ?? getGlobalSettingsStore()
    const currentSettings = this.settingsStore.get()
    const initialViewport = getViewportProfile(currentSettings.viewport)

    this.world = options.world ?? new ClientWorld()
    this.world.skipSelfTurnStep = true
    this.world.skipRemoteUnitStep = true
    this.camera = options.camera ?? new ViewportCamera(initialViewport)
    this.hudManager = options.hudManager ?? new HudManager()
    // Level entry title quest overrides (D2Client 0x6fb8be88) read `g_QuestAvail` (S2C 0x5E).
    this.hudManager.levelEntryQuestSource = this.questFx
    // 0x6fb6f0d0 reads the player's room level and skips frames without a room (#10331). After an act-changing
    // LoadAct the revealed rooms are pruned, so the interim act-town `areaId` never reaches the title.
    this.hudManager.levelEntryLevelSource = () => {
      const world = this.world
      if (world.areaId <= 0) return null
      return world.resolveAreaFromRevealedRooms(world.self.x, world.self.y) > 0 ? world.areaId : null
    }
    this.hudManager.resize(initialViewport.width, initialViewport.height)
    this.hudManager.setHudEnhancements({
      showBasePlusBonusStats: currentSettings.showBasePlusBonusStats,
      showBasePlusBonusSkills: currentSettings.showBasePlusBonusSkills,
      showStatGainTooltips: currentSettings.showStatGainTooltips,
      showWeaponDamageFormula: currentSettings.showWeaponDamageFormula,
      showAdvancedStatsButton: currentSettings.showAdvancedStatsButton,
      showRuneNumbers: currentSettings.showRuneNumbers,
    })
    this.hudManager.setGroundItemEnhancements({
      showUniqueSetBeams: currentSettings.showUniqueSetBeams,
      alwaysShowUniqueSetLabels: currentSettings.alwaysShowUniqueSetLabels,
    })

    this.mapService = options.mapService ?? null
    this.automapView =
      options.automapView ??
      new AutomapView({
        mapService: this.mapService,
        initialMode: currentSettings.automapReveal,
        initialRadar: {
          automapShowMonsters: currentSettings.automapShowMonsters,
          automapShowShrines: currentSettings.automapShowShrines,
          automapShowWaypoints: currentSettings.automapShowWaypoints,
        },
      })
    this.automapView.setRadarConfig({
      automapShowMonsters: currentSettings.automapShowMonsters,
      automapShowShrines: currentSettings.automapShowShrines,
      automapShowWaypoints: currentSettings.automapShowWaypoints,
    })

    this.predictor = options.predictor ?? new LocalMovementPredictor()
    this.interpolator = options.interpolator ?? new RemoteEntityInterpolator()
    const weatherRng = options.weatherRng ?? new D2Rng((Math.random() * 0x1_0000_0000) >>> 0, 0x5eed)
    this.weather = new WeatherController({
      rng: weatherRng,
      thunder: () => this.audioRuntime.triggerThunder(),
    })
    // NOT 1.13c: the weather-override plugin's setting ('off' = vanilla weather).
    this.weather.setOverride(currentSettings.weatherOverride)

    const audioRng = new D2Rng((Math.random() * 0x1_0000_0000) >>> 0, 0xa0d10)
    this.audioRuntime =
      options.audioRuntime ??
      new AudioRuntime113c({
        rng: audioRng,
        listenerPos: () => {
          const snap = this.predictor.getSnapshot()
          const x = snap.x !== 0 || snap.y !== 0 ? snap.x : this.world.self.x
          const y = snap.x !== 0 || snap.y !== 0 ? snap.y : this.world.self.y
          return { x: Math.round(x), y: Math.round(y) }
        },
        settings: {
          masterVolume: () => this.settingsStore.get().masterVolume,
          muted: () => this.settingsStore.get().audioMuted,
        },
      })

    this.world.setNearRoomObjectFinder((subX, subY, classId) =>
      this.findObjectNearSubTile(subX, subY, classId),
    )
    this.world.setCollisionChecker(
      (subX, subY) => isWorldSubTileBlocked(this.asNavHost(), subX, subY),
      () => this.resolveCollisionLevelView(),
    )
    this.world.setMissileCollisionChecker((subX, subY, collideType) =>
      isWorldSubTileMissileBlocked(this.asNavHost(), subX, subY, collideType),
    )
    this.interpolator.setCollisionChecker((x, y) => this.world.isSubTileBlocked(x, y))
    this.predictor.setCollisionChecker((x, y) => this.world.isSubTileBlocked(x, y))
    this.rateLimiter = options.rateLimiter ?? new OutboundRateLimiter()

    this.itemTables = options.itemTables ?? getCanonicalItemDataTables()

    this.packetTap = new InMemoryPacketTap(4000)

    this.hudModel = new HudModel({
      world: this.world,
      hudManager: this.hudManager,
      predictor: this.predictor,
      automap: this.automapView,
      onCommand: (cmd) => {
        this.dispatchCommand(cmd)
      },
      vendorPrice: vendorPrice113c,
      vendorRepairAll: vendorRepairAll113c,
      playUiSound: (soundId) => {
        if (this.hudManager.tradeHallMode) return
        this.audioRuntime.playUi(soundId)
      },
    })
    this.hudManager.worldPanels.onCloseNpcSpeech = () => {
      if (this.hudManager.tradeHallMode) return
      this.audioRuntime.onNpcDialogClose()
    }
    this.hudManager.worldPanels.onPlayNpcSpeech = (soundId) => {
      if (this.hudManager.tradeHallMode) return
      this.audioRuntime.playSpeech(soundId)
    }

    if (!this.hudManager.onEscapeMenuAction) {
      this.hudManager.onEscapeMenuAction = (action) => {
        if (action === 'saveAndExit') {
          void this.leaveGame()
        }
      }
    }

    if (!this.hudManager.worldPanels.getEscapeMenuSettings) {
      this.hudManager.configureEscapeMenuSettings({
        getSettings: () => {
          const s = this.settingsStore.get()
          return {
            masterVolume: s.masterVolume,
            audioMuted: s.audioMuted,
            viewport: s.viewport,
            worldRenderFps: s.worldRenderFps,
            keyBindings: s.keyBindings,
          }
        },
        onUpdateSettings: (patch) => {
          this.settingsStore.set(patch)
        },
      })
    }

    this.commandMapper = new CommandMapper({
      world: this.world,
      camera: this.camera,
      hudManager: this.hudManager,
      hudModel: this.hudModel,
      predictor: this.predictor,
      mapService: this.mapService ?? undefined,
      automapView: this.automapView,
      rateLimiter: this.rateLimiter,
      sendCommand: (cmd, nowMs) => {
        this.forwardCommandToAdapter(cmd, nowMs)
      },
      isExternalUiIntercepted: options.isExternalUiIntercepted,
      onToggleChatInput: options.onToggleChatInput,
      onEscapeMenu: options.onEscapeMenu,
    })

    this.sceneSource = new ClientWorldSceneSource(
      () => buildSceneSnapshot(this.asRenderHost()),
      initialViewport,
    )

    this.defaultHost = options.defaultHost ?? currentSettings.serverHost
    this.defaultBncsPort = options.defaultBncsPort ?? 6112
    this.hasCustomResolver = options.resolver !== undefined
    this.customWsBridgeBaseUrl = options.wsBridgeBaseUrl
    const wsBase = options.wsBridgeBaseUrl ?? this.resolveWsBridgeBaseUrl(currentSettings.serverHost)
    this.resolverWsBase = wsBase
    this.resolver = options.resolver ?? createWsBridgeResolver(this.parseWsBridgeUrl(wsBase))
    this.flowFactory = options.flowFactory ?? createD2OnlineFlow
    this.leaseStorage =
      options.leaseStorage !== undefined ? options.leaseStorage : getDefaultBrowserLeaseStorage()
    this.tabId =
      options.tabId ?? `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const onUnload = () => {
        this.releaseActiveCharLease()
      }
      window.addEventListener('pagehide', onUnload)
      window.addEventListener('beforeunload', onUnload)
      this.unsubPageUnload = () => {
        window.removeEventListener('pagehide', onUnload)
        window.removeEventListener('beforeunload', onUnload)
      }
    }

    // React to viewport, automap reveal, HUD enhancement, weather override & audio settings in SettingsStore
    this.unsubSettings = this.settingsStore.subscribe((next, prev) => {
      if (next.viewport !== prev.viewport) {
        const vp = getViewportProfile(next.viewport)
        this.camera.resize(vp)
        this.hudManager.resize(vp.width, vp.height)
        this.sceneSource.setViewportProfile(vp)
      }
      if (next.automapReveal !== prev.automapReveal) {
        this.automapView.setMode(next.automapReveal)
      }
      if (
        next.automapShowMonsters !== prev.automapShowMonsters ||
        next.automapShowShrines !== prev.automapShowShrines ||
        next.automapShowWaypoints !== prev.automapShowWaypoints
      ) {
        this.automapView.setRadarConfig({
          automapShowMonsters: next.automapShowMonsters,
          automapShowShrines: next.automapShowShrines,
          automapShowWaypoints: next.automapShowWaypoints,
        })
      }
      if (
        next.showBasePlusBonusStats !== prev.showBasePlusBonusStats ||
        next.showBasePlusBonusSkills !== prev.showBasePlusBonusSkills ||
        next.showStatGainTooltips !== prev.showStatGainTooltips ||
        next.showWeaponDamageFormula !== prev.showWeaponDamageFormula ||
        next.showAdvancedStatsButton !== prev.showAdvancedStatsButton ||
        next.showRuneNumbers !== prev.showRuneNumbers
      ) {
        this.hudManager.setHudEnhancements({
          showBasePlusBonusStats: next.showBasePlusBonusStats,
          showBasePlusBonusSkills: next.showBasePlusBonusSkills,
          showStatGainTooltips: next.showStatGainTooltips,
          showWeaponDamageFormula: next.showWeaponDamageFormula,
          showAdvancedStatsButton: next.showAdvancedStatsButton,
          showRuneNumbers: next.showRuneNumbers,
        })
      }
      if (
        next.showUniqueSetBeams !== prev.showUniqueSetBeams ||
        next.alwaysShowUniqueSetLabels !== prev.alwaysShowUniqueSetLabels
      ) {
        this.hudManager.setGroundItemEnhancements({
          showUniqueSetBeams: next.showUniqueSetBeams,
          alwaysShowUniqueSetLabels: next.alwaysShowUniqueSetLabels,
        })
      }
      if (next.weatherOverride !== prev.weatherOverride) {
        this.weather.setOverride(next.weatherOverride)
      }
      if (next.masterVolume !== prev.masterVolume || next.audioMuted !== prev.audioMuted) {
        this.audioRuntime.applySettings()
      }
    })
  }

  private asNavHost(): SessionLevelNavigationHost {
    return this as unknown as SessionLevelNavigationHost
  }

  private asEventHost(): SessionEventProcessorHost {
    return this as unknown as SessionEventProcessorHost
  }

  private asRenderHost(): SessionRenderBuilderHost {
    return this as unknown as SessionRenderBuilderHost
  }

  private asReplayHost(): SessionReplayHost {
    return this as unknown as SessionReplayHost
  }

  // ─── State & Listeners ───────────────────────────────────────

  get phase(): OnlineSessionPhase {
    return this.phaseValue
  }

  get loginHost(): string | null {
    return this.loginHostValue
  }

  get selectedChar(): string | null {
    return this.selectedCharValue
  }

  get disconnectReason(): string | null {
    return this.disconnectReasonValue
  }

  get pingMs(): number {
    return this.gameAdapter ? this.gameAdapter.stats.rttMs || this.pingMsValue : this.pingMsValue
  }

  getSentCommands(): readonly ClientCommand[] {
    return this.outboundCommandsLog
  }

  getSentBncsChatCommands(): readonly string[] {
    return this.outboundBncsChatLog
  }

  getSnapshot(): OnlineSessionLobbySnapshot {
    return {
      phase: this.phaseValue,
      flowState: this.flow?.state ?? 'idle',
      username: this.usernameValue,
      selectedRealm: this.selectedRealmValue,
      realms: this.realmsValue,
      characters: this.charactersValue,
      selectedChar: this.selectedCharValue,
      games: this.gamesValue,
      activeGameName: this.activeGameNameValue,
      disconnectReason: this.disconnectReasonValue,
      pingMs: this.pingMs,
    }
  }

  onStateChange(cb: (snapshot: OnlineSessionLobbySnapshot) => void): () => void {
    this.stateListeners.add(cb)
    return () => {
      this.stateListeners.delete(cb)
    }
  }

  onServerEvent(cb: (ev: ServerEvent) => void): () => void {
    this.eventListeners.add(cb)
    return () => {
      this.eventListeners.delete(cb)
    }
  }

  onChatMessage(cb: (entry: ChatLogEntry) => void): () => void {
    this.chatListeners.add(cb)
    return () => {
      this.chatListeners.delete(cb)
    }
  }

  onDisconnect(cb: (reason: string) => void): () => void {
    this.disconnectListeners.add(cb)
    return () => {
      this.disconnectListeners.delete(cb)
    }
  }

  /**
   * Fires once per session lifecycle when the Battle.net session ends: a BNCS/MCP/D2GS connection
   * closed or errored, a request timed out, a command was issued without its connection, or the
   * client ended the session itself (`disconnect`). All connections are already disposed when this
   * fires; the UI returns to the login screen with `ev.reason`.
   */
  onSessionLost(cb: (ev: OnlineSessionLostEvent) => void): () => void {
    this.sessionLostListeners.add(cb)
    return () => {
      this.sessionLostListeners.delete(cb)
    }
  }

  /** The loss that ended the current session lifecycle, or `null`. */
  get sessionLost(): OnlineSessionLostEvent | null {
    return this.sessionLostValue?.event ?? null
  }

  // ─── Online Flow Lifecycle (BNCS -> MCP -> D2GS) ─────────────

  /**
   * Connect to BNCS, authenticate account, and select Realm (MCP) to list characters.
   */
  async login(params: OnlineSessionLoginParams): Promise<{
    readonly realms: readonly RealmSummary[]
    readonly characters: readonly CharSummary[]
  }> {
    return await this.establishSession(params, false)
  }

  /**
   * Create a new Battle.net account on BNCS, log in, and enter the realm character screen.
   */
  async createAccountAndLogin(params: OnlineSessionLoginParams): Promise<{
    readonly realms: readonly RealmSummary[]
    readonly characters: readonly CharSummary[]
  }> {
    return await this.establishSession(params, true)
  }

  /**
   * Connect to BNCS, optionally create a new account (`createNewAccount: true`), authenticate, and enter the realm character screen.
   */
  async connectAndAuthenticate(
    params: OnlineSessionLoginParams & { readonly createNewAccount?: boolean | undefined },
  ): Promise<{
    readonly realms: readonly RealmSummary[]
    readonly characters: readonly CharSummary[]
  }> {
    return await this.establishSession(params, Boolean(params.createNewAccount))
  }

  private async establishSession(
    params: OnlineSessionLoginParams,
    createAccount: boolean,
  ): Promise<{
    readonly realms: readonly RealmSummary[]
    readonly characters: readonly CharSummary[]
  }> {
    this.releaseActiveCharLease()
    this.detachGameServerListeners()
    this.gameAdapter = null
    await this.closeFlowQuietly()
    this.sessionLostValue = null
    this.lostFlow = null
    this.disconnectReasonValue = null
    this.mcpLoggedInChar = null
    this.usernameValue = params.username
    this.loginHostValue = (params.host ?? this.defaultHost).trim() || this.defaultHost
    this.setPhase('connecting')

    let resolver: EndpointResolver
    if (params.wsBridgeBaseUrl) {
      resolver = createWsBridgeResolver(this.parseWsBridgeUrl(params.wsBridgeBaseUrl))
    } else if (!this.hasCustomResolver && !this.customWsBridgeBaseUrl) {
      const targetWsBase = this.resolveWsBridgeBaseUrl(this.loginHostValue)
      if (targetWsBase !== this.resolverWsBase) {
        this.resolverWsBase = targetWsBase
        this.resolver = createWsBridgeResolver(this.parseWsBridgeUrl(targetWsBase))
      }
      resolver = this.resolver
    } else {
      resolver = this.resolver
    }

    const flow = this.flowFactory({
      resolver,
      bnetHost: this.loginHostValue,
      bnetPort: params.bncsPort ?? this.defaultBncsPort,
      itemTables: this.itemTables,
      tap: this.packetTap,
    })

    this.bindFlowListeners(flow)
    this.flow = flow

    try {
      if (createAccount) {
        await flow.createAccount(params.username, params.password)
      }
      await flow.login(params.username, params.password)
      const realms = await flow.listRealms()
      this.realmsValue = realms
      const chosenRealm = realms[params.realmIndex ?? 0] ?? realms[0] ?? null
      this.selectedRealmValue = chosenRealm

      const characters = await flow.enterRealm(chosenRealm?.title)
      if (this.flow !== flow) {
        throw this.sessionLostFor(flow) ?? new Error('OnlineSession.login: superseded by a newer login')
      }
      this.charactersValue = characters
      if (characters.length > 0 && !this.selectedCharValue) {
        this.selectedCharValue = characters[0]!.name
      }
      this.setPhase('lobby')
      return { realms, characters }
    } catch (err) {
      const lost = this.sessionLostFor(flow)
      if (lost) throw lost
      if (this.flow !== flow) {
        // A newer login replaced this attempt; its state belongs to the newer attempt.
        throw err
      }
      // Rejected login or account creation: the attempt's connections are closed.
      // For BncsCreateAccountError, keep disconnectReasonValue null so the in-canvas
      // PopUpOkCancel2.dc6 modal displays without a redundant DOM disconnect banner.
      this.pendingFlowClose = this.closeFlowQuietly()
      this.disconnectReasonValue =
        err instanceof BncsCreateAccountError
          ? null
          : err instanceof Error
            ? err.message
            : String(err)
      this.setPhase('disconnected')
      throw err
    }
  }

  async refreshCharacters(): Promise<readonly CharSummary[]> {
    return await this.lobbyOp('refreshCharacters', 'mcp', async (flow) => {
      this.mcpLoggedInChar = null
      const chars = await flow.listCharacters()
      this.charactersValue = chars
      this.emitState()
      return chars
    })
  }

  async createCharacter(spec: CharCreateSpec): Promise<readonly CharSummary[]> {
    this.mcpLoggedInChar = null
    await this.lobbyOp('createCharacter', 'mcp', (flow) => flow.createCharacter(spec))
    this.selectedCharValue = spec.name
    return await this.refreshCharacters()
  }

  async deleteCharacter(name: string): Promise<readonly CharSummary[]> {
    this.mcpLoggedInChar = null
    await this.lobbyOp('deleteCharacter', 'mcp', (flow) => flow.deleteCharacter(name))
    if (this.selectedCharValue === name) {
      this.selectedCharValue = null
    }
    return await this.refreshCharacters()
  }

  async convertCharacterToExpansion(name: string): Promise<readonly CharSummary[]> {
    this.mcpLoggedInChar = null
    await this.lobbyOp('convertCharacterToExpansion', 'mcp', (flow) => flow.upgradeCharacter(name))
    return await this.refreshCharacters()
  }

  async selectCharacter(name: string): Promise<void> {
    await this.lobbyOp('selectCharacter', 'mcp', (flow) => flow.selectCharacter(name))
    this.selectedCharValue = name
    this.mcpLoggedInChar = name
    const charMeta = this.charactersValue.find((c) => c.name === name)
    if (charMeta) {
      this.world.self.name = charMeta.name
      this.world.self.charClass = charMeta.charClass
    } else {
      this.world.self.name = name
    }
    this.syncAudioSkillPacks()
    this.hudModel.syncFromWorld()
    this.emitState()
  }

  /**
   * Ensure the selected character has been logged into the MCP realm via `0x07 MCP_CHARLOGON`
   * before sending lobby packets (`0x05 MCP_GAMELIST`, `0x06 MCP_GAMEINFO`, `0x03 MCP_CREATEGAME`,
   * `0x04 MCP_JOINGAME`). On PvPGN `d2cs`, sending lobby packets in `d2cs_conn_state_authed`
   * immediately closes the MCP socket.
   */
  private async ensureMcpCharLoggedIn(flow: D2OnlineFlow): Promise<void> {
    const targetChar = this.selectedCharValue || this.charactersValue[0]?.name || null
    if (!targetChar) return
    if (
      this.mcpLoggedInChar === null ||
      this.mcpLoggedInChar.toLowerCase() !== targetChar.toLowerCase()
    ) {
      await flow.selectCharacter(targetChar)
      this.selectedCharValue = targetChar
      this.mcpLoggedInChar = targetChar
    }
  }

  async sendLobbyChat(text: string): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed) return
    if (trimmed.startsWith('/')) {
      this.outboundBncsChatLog.push(trimmed)
      if (this.outboundBncsChatLog.length > 512) {
        this.outboundBncsChatLog.shift()
      }
    }
    await this.lobbyOp('sendLobbyChat', 'bncs', (flow) => flow.sendChat(trimmed))
    // Slash commands (e.g. /ann, /w, /whoami, /friends) are BNCS server commands (`SID_CHATCOMMAND 0x0E`)
    // whose responses arrive asynchronously via `SID_CHATEVENT (0x0F)`; do not echo them as local room speech.
    if (trimmed.startsWith('/')) return
    const prevChatCount = this.world.chatLog.length
    this.world.apply({
      type: 'Chat',
      kind: 'say',
      from: this.selectedCharValue || this.usernameValue || 'Player',
      text: trimmed,
    })
    if (this.world.chatLog.length > prevChatCount) {
      const entry = this.world.chatLog[this.world.chatLog.length - 1]
      if (entry) {
        for (const listener of this.chatListeners) {
          listener(entry)
        }
      }
    }
  }

  /**
   * Send a Battle.net slash command (`SID_CHATCOMMAND 0x0E`, e.g. `/ann <msg>`, `/whoami`, `/f l`, `/time`)
   * from in-game chat (`D2Client.dll` `0x6fb20c27` -> `D2Multi.dll` `0x6f9db090` -> `Bnclient.dll` `0x6ff2c400`).
   */
  sendBncsChatCommand(command: string): boolean {
    const trimmed = command.trim()
    if (!trimmed) return false
    this.outboundBncsChatLog.push(trimmed)
    if (this.outboundBncsChatLog.length > 512) {
      this.outboundBncsChatLog.shift()
    }
    if (this.flow) {
      void this.flow.sendChat(trimmed).catch(() => {
        // Ignore transient BNCS send errors when in-game
      })
    }
    return true
  }

  /**
   * Ingest an incoming Battle.net `SID_CHATEVENT (0x0F)` packet (e.g. `EID_BROADCAST 0x06` from `/ann`,
   * `EID_INFO 0x12`, `EID_ERROR 0x13`, `EID_WHISPER 0x04`, `EID_WHISPERSENT 0x0A`, `EID_TALK 0x05`)
   * into `ClientWorld`, `HudModel`, and `onChatMessage` listeners (`D2Client.dll` `0x6fb1fce0`).
   */
  handleBncsChatEvent(ev: BncsChatEventFormatInput, nowMs = performance.now()): ChatLogEntry | null {
    const formatted = formatBncsChatEvent113c(ev, this.world.lang)
    if (!formatted) return null
    const prevCount = this.world.chatLog.length
    if (formatted.kind === 'whisper') {
      this.world.apply(
        {
          type: 'Chat',
          kind: 'whisper',
          eventType: formatted.eventType,
          from: formatted.sender,
          text: formatted.rawMessage,
          color: formatted.color,
        },
        nowMs,
      )
    } else if (formatted.kind === 'say') {
      this.world.apply(
        {
          type: 'Chat',
          kind: 'say',
          from: formatted.sender,
          text: formatted.rawMessage,
          color: formatted.color,
        },
        nowMs,
      )
    } else {
      this.world.apply(
        {
          type: 'Chat',
          kind: 'system',
          eventType: formatted.eventType,
          ...(formatted.sender ? { from: formatted.sender } : {}),
          text: formatted.text,
          color: formatted.color,
        },
        nowMs,
      )
    }
    this.hudModel.syncFromWorld()
    if (this.world.chatLog.length > prevCount) {
      const entry = this.world.chatLog[this.world.chatLog.length - 1]
      if (entry) {
        for (const listener of this.chatListeners) {
          listener(entry)
        }
        return entry
      }
    }
    return null
  }

  async listGames(
    filter = '',
    options?: {
      readonly flags?: number | undefined
      readonly onGame?: ((game: GameListEntry, games: readonly GameListEntry[]) => void) | undefined
    },
  ): Promise<readonly GameListEntry[]> {
    return await this.lobbyOp('listGames', 'mcp', async (flow) => {
      await this.ensureMcpCharLoggedIn(flow)
      const games = await flow.listGames(filter, {
        flags: options?.flags,
        onGame: (game, partialGames) => {
          this.gamesValue = [...partialGames]
          this.emitState()
          options?.onGame?.(game, this.gamesValue)
        },
      })
      this.gamesValue = games
      this.emitState()
      return games
    })
  }

  async getGameInfo(name: string): Promise<GameInfoDetail> {
    return await this.lobbyOp('getGameInfo', 'mcp', async (flow) => {
      await this.ensureMcpCharLoggedIn(flow)
      return await flow.getGameInfo(name)
    })
  }

  /**
   * Create & join or join an existing D2GS game, binding the `GameServerAdapter` to `ClientWorld`.
   */
  async enterGame(
    request:
      | { readonly mode: 'create'; readonly spec: GameCreateSpec }
      | { readonly mode: 'join'; readonly name: string; readonly password?: string | undefined },
  ): Promise<GameServerAdapter> {
    if (
      this.mapService &&
      typeof (this.mapService as { ensureLoaded?: () => Promise<unknown> }).ensureLoaded ===
        'function'
    ) {
      await (this.mapService as { ensureLoaded: () => Promise<unknown> }).ensureLoaded()
    }
    return await this.lobbyOp('enterGame', 'mcp', async (flow) => {
      await this.ensureMcpCharLoggedIn(flow)
      const charName = this.selectedCharValue || this.world.self.name
      const host = this.loginHostValue || this.defaultHost
      const targetGameName = request.mode === 'create' ? request.spec.name : request.name
      if (charName && this.leaseStorage) {
        const conflict = findConflictingCharacterLease(
          this.leaseStorage,
          host,
          charName,
          this.tabId,
        )
        if (conflict) {
          const dupErr = new DuplicateCharacterLoginError(charName, conflict.gameName)
          this.disconnectReasonValue = dupErr.message
          this.setPhase('lobby')
          throw dupErr
        }
      }
      this.acquireOrRefreshActiveCharLease(targetGameName)
      this.setPhase('entering-game')
      this.resetForGameInit()
      try {
        let adapter: GameServerAdapter
        if (request.mode === 'create') {
          await flow.createGame(request.spec)
          adapter = await flow.joinGame(request.spec.name, request.spec.password ?? '')
        } else {
          adapter = await flow.joinGame(request.name, request.password ?? '')
        }

        this.activeGameNameValue = targetGameName
        this.acquireOrRefreshActiveCharLease(targetGameName)
        this.attachGameServer(adapter)
        return adapter
      } catch (err) {
        this.releaseActiveCharLease()
        if (!this.sessionLostFor(flow)) {
          // Game creation/join refused while BNCS/MCP stay up (1.13c stays in the lobby).
          this.disconnectReasonValue = formatLobbyGameEnterError(err, charName)
          this.setPhase('lobby')
        }
        throw err
      }
    })
  }

  /**
   * Attach a live or mock `GameServerAdapter` directly to this session.
   *
   * Without an online flow (Single Player `LocalLoopbackAdapter`, replay harness, tests) the attach
   * starts a new game lifecycle, so it runs the same 1.13c game-init reset as `enterGame` every time a
   * new adapter is attached — also after `leaveGame` already cleared the previous adapter.
   * `options.localCharacter` binds the Single Player character so `completeGame` works offline.
   */
  attachGameServer(adapter: GameServerAdapter, options?: AttachGameServerOptions): void {
    const reattach = this.gameAdapter === adapter
    this.detachGameServerListeners()
    const local = options?.localCharacter
    if (local) {
      if (this.flow) {
        throw new Error(
          'OnlineSession.attachGameServer: a local character context needs a standalone (offline) session',
        )
      }
      const selected = local.characters.find((c) => c.name === local.selectedName)
      if (!selected) {
        throw new Error(
          `OnlineSession.attachGameServer: local character "${local.selectedName}" is not in the local character list`,
        )
      }
      this.charactersValue = [...local.characters]
      this.selectedCharValue = selected.name
      this.localProgressionWriter = local.writeProgression
      this.world.self.name = selected.name
      this.world.self.charClass = selected.charClass
    } else if (!this.flow && !reattach) {
      this.localProgressionWriter = null
    }
    if (!this.flow) {
      // A standalone adapter (single player, replay harness or tests) starts its own session lifecycle.
      if (!reattach) {
        this.resetForGameInit()
      }
      this.sessionLostValue = null
      this.lostFlow = null
    }
    if (!reattach) {
      this.appliedPersistedPlayersForGame = false
      this.c2sDedupe.reset()
    }
    this.rateLimiter.reset()
    this.gameAdapter = adapter
    this.disconnectReasonValue = null
    this.setPhase('ingame')

    this.unsubGameEvent = adapter.onEvent((ev) => {
      this.handleServerEvent(ev)
    })

    if (!reattach) {
      applyPersistedPlayersToCurrentGame(this.asEventHost())
    }

    if (typeof adapter.onClose === 'function') {
      this.unsubGameClose = adapter.onClose((reason: CloseReason) => {
        if (this.gameAdapter !== adapter) return
        // Our own LeaveGame (C2S 0x69 / local save-and-exit) closing the game is not a lost session.
        if (this.leavingAdapter === adapter) return
        if (this.phaseValue === 'ingame' || this.phaseValue === 'entering-game') {
          const technical =
            reason.kind === 'error'
              ? `D2GS game connection error: ${reason.error.message}`
              : reason.kind === 'remote'
                ? `D2GS game connection closed by server${reason.code !== undefined ? ` (code ${reason.code})` : ''}`
                : 'D2GS game connection closed'
          this.handleSessionLost({
            session: 'd2gs',
            cause: reason.kind === 'error' ? 'error' : 'closed',
            technical,
          })
        }
      })
    } else {
      this.unsubGameClose = null
    }
  }

  /**
   * 1.13c game-init reset shared by every game entry (`enterGame` online, standalone `attachGameServer`
   * for Single Player / replay): clears the client world and every per-game client subsystem while the
   * selected character's name and class survive.
   */
  private resetForGameInit(): void {
    const savedName = this.world.self.name
    const savedClass = this.world.self.charClass
    this.world.reset()
    this.lastObjectLightBuildFrame = 0
    this.environmentValue = Environment.alloc()
    this.clientActLoaded = false
    this.weather.onGameInit()
    this.audioRuntime.gameInit()
    this.questFx.resetForNewGame()
    this.knownAreaIds.clear()
    this.lastSyncedAreaId = 0
    this.appliedPersistedPlayersForGame = false
    this.c2sDedupe.reset()
    this.world.self.name = savedName
    this.world.self.charClass = savedClass
    this.syncAudioSkillPacks()
    this.predictor.setPosition(0, 0)
    this.interpolator.clear()
    this.hudModel.syncFromWorld()
  }

  /**
   * The completion recorded by the last S2C `0x61 07` (Baal's portal), handed to the frontend once.
   * `null` when no game was completed since the last call.
   */
  takeGameCompletion(): GameCompletion113c | null {
    const completion = this.pendingGameCompletionValue
    this.pendingGameCompletionValue = null
    return completion
  }

  /**
   * S2C `0x61 07` after the Bink `D2X_OUT` video: D2Client `0x6fb39e4d` flags the game as completed and
   * `0x6faf2850` sends C2S `0x69` LeaveGame. After the game loop, `0x6faf52b3` rewrites the cached character
   * progression and decides whether the victory screen `0x6faf3a70` runs (`computeGameCompletion113c`).
   */
  private completeGame(): void {
    const name = this.selectedCharValue
    const character = name === null ? undefined : this.charactersValue.find((c) => c.name === name)
    if (!character) {
      this.handleUnexpectedDisconnect(
        `S2C 0x61 7 (game completed): no realm character summary for ${name ?? '(no character selected)'}`,
      )
      return
    }
    if (character.progression === undefined) {
      this.handleUnexpectedDisconnect(
        `S2C 0x61 7 (game completed): realm character summary for ${character.name} has no progression`,
      )
      return
    }
    const completion = computeGameCompletion113c(this.world.difficulty, {
      name: character.name,
      charClass: character.charClass,
      hardcore: character.hardcore,
      expansion: character.expansion,
      progression: character.progression,
    })
    // 0x6faf52fd writes the new progression into the client's cached character info.
    this.charactersValue = this.charactersValue.map((c) =>
      c === character ? { ...c, progression: completion.newProgression } : c,
    )
    this.pendingGameCompletionValue = completion
    // Single Player: the cached char info is the local `.d2s` header, so the rewrite is persisted once the
    // local game has been saved and closed (realm characters are persisted by the realm instead).
    const writeProgression = this.localProgressionWriter
    void this.leaveGame(
      writeProgression
        ? () => writeProgression(character.name, completion.newProgression)
        : undefined,
    )
  }

  /**
   * Leave the active D2GS game and return to lobby (or idle if standalone).
   *
   * This is the intentional exit (save-and-exit, C2S `0x69` LeaveGame, game completion): the adapter
   * closing as a consequence is never reported as a lost session. `afterGameClosed` runs after the game
   * connection is closed (and the local game saved) but before the phase change is published.
   */
  async leaveGame(afterGameClosed?: () => void): Promise<void> {
    const flow = this.flow
    const adapter = this.gameAdapter
    this.leavingAdapter = adapter
    this.releaseActiveCharLease()
    this.detachGameServerListeners()
    this.hudModel.closeAllPanels()
    this.hudManager.closeAllPanels()
    try {
      if (flow && flow.state === 'ingame') {
        try {
          await flow.leaveToLobby()
        } catch {
          // Ignore close errors on leave
        }
      } else if (adapter) {
        try {
          if (typeof adapter.leave === 'function') {
            adapter.leave()
          } else if (typeof (adapter as any).disconnect === 'function') {
            ;(adapter as any).disconnect()
          }
        } catch {
          // Ignore close errors on leave
        }
        if (!flow) {
          const savedName = this.world.self.name
          const savedClass = this.world.self.charClass
          this.world.reset()
          this.world.self.name = savedName
          this.world.self.charClass = savedClass
          this.predictor.setPosition(0, 0)
          this.interpolator.clear()
          this.knownAreaIds.clear()
        }
      }
    } finally {
      if (this.leavingAdapter === adapter) this.leavingAdapter = null
    }
    this.gameAdapter = null
    this.activeGameNameValue = null
    this.lastSyncedAreaId = 0
    this.appliedPersistedPlayersForGame = false
    this.c2sDedupe.reset()
    let afterGameClosedError: unknown = null
    try {
      afterGameClosed?.()
    } catch (err) {
      afterGameClosedError = err
    }
    if (!flow) this.localProgressionWriter = null
    // `leaveToLobby` reports a BNCS/MCP loss deferred during the game; that already ended the session.
    if (flow && this.sessionLostFor(flow)) return
    this.setPhase(flow ? 'lobby' : 'idle')
    if (afterGameClosedError !== null) throw afterGameClosedError
  }

  /**
   * End the session on purpose: close every connection and transition to `'disconnected'` with
   * exactly `reason`. Routed through the same session-loss path so the UI returns to the login screen.
   */
  async disconnect(reason = 'Disconnected by user'): Promise<void> {
    this.handleSessionLost({ session: 'client', cause: 'local', technical: reason, reason })
    await this.pendingFlowClose
  }

  /**
   * Run a pre-game operation that needs a live BNCS/MCP session.
   */
  private async lobbyOp<T>(
    op: string,
    required: 'bncs' | 'mcp',
    fn: (flow: D2OnlineFlow) => Promise<T>,
  ): Promise<T> {
    const flow = this.flow
    if (!flow || this.sessionLostValue) {
      throw this.handleSessionLost({
        session: required,
        cause: 'not_connected',
        technical: `${LOBBY_SESSION_LABEL[required]} session is not connected for ${op}`,
      })
    }
    try {
      return await fn(flow)
    } catch (err) {
      throw this.sessionLostFor(flow) ?? err
    }
  }

  /** The handled loss if it ended `flow`'s lifecycle. */
  private sessionLostFor(flow: D2OnlineFlow): SessionLostError | null {
    return this.sessionLostValue && this.lostFlow === flow ? this.sessionLostValue : null
  }

  /**
   * Single place where a session ends. Idempotent per session lifecycle.
   */
  private handleSessionLost(input: {
    readonly session: OnlineSessionLostSource
    readonly cause: OnlineSessionLostCause
    readonly technical: string
    readonly reason?: string | undefined
  }): SessionLostError {
    if (this.sessionLostValue) return this.sessionLostValue
    this.releaseActiveCharLease()
    const event: OnlineSessionLostEvent = {
      reason: input.reason ?? formatSessionLostReason(input.session, input.cause, input.technical),
      session: input.session,
      cause: input.cause,
      technical: input.technical,
    }
    const error = new SessionLostError(event)
    this.sessionLostValue = error
    this.lostFlow = this.flow

    this.detachGameServerListeners()
    const adapter = this.gameAdapter
    this.gameAdapter = null
    this.localProgressionWriter = null
    this.activeGameNameValue = null
    this.lastSyncedAreaId = 0
    if (adapter && !this.flow) {
      // No flow owns this adapter (standalone attach), so release its connection here.
      try {
        adapter.leave()
      } catch {
        // Already closed.
      }
    }
    this.pendingFlowClose = this.closeFlowQuietly()

    this.disconnectReasonValue = event.reason
    this.setPhase('disconnected')
    for (const listener of [...this.sessionLostListeners]) {
      listener(event)
    }
    for (const listener of [...this.disconnectListeners]) {
      listener(event.reason)
    }
    return error
  }

  // ─── Local Player Server Position & Level Navigation (D2Client 1.13c) ───

  private cachedCollisionViewAreaId = -1
  private cachedCollisionViewSubX = Number.NaN
  private cachedCollisionViewSubY = Number.NaN
  private cachedCollisionRevealedAreas: readonly number[] | null = null
  private cachedCollisionView: LevelView | null = null
  private prefetchedGateForAreaId = -1
  private lastSyncedAreaId = 0

  private verifyLocalPlayerPosition(x: number, y: number, source: ServerPositionSource): void { verifyLocalPlayerPosition(this.asNavHost(), x, y, source) }
  private isSubTileBlockedInView(activeView: LevelView, subX: number, subY: number): boolean { return isSubTileBlockedInView(activeView, subX, subY) }
  private isSubTileMissileBlockedInView(activeView: LevelView, subX: number, subY: number, collideType = 3): boolean { return isSubTileMissileBlockedInView(activeView, subX, subY, collideType) }
  private prefetchGateNeighbourLevels(view: LevelView): void { prefetchGateNeighbourLevels(this.asNavHost(), view) }
  private resolveNeighbourLevelViews(primaryView: LevelView | null | undefined): readonly LevelView[] { return resolveNeighbourLevelViews(this.asNavHost(), primaryView) }
  private applyViewRetention(primaryView: LevelView, neighbours: readonly LevelView[]): void { applyViewRetention(this.asNavHost(), primaryView, neighbours) }
  private resolveCollisionLevelView(): LevelView | null | undefined { return resolveCollisionLevelView(this.asNavHost()) }
  private getCandidateAreaIds(): number[] { return getCandidateAreaIds(this.asNavHost()) }
  private pruneMissingInterpolatorEntities(): void { pruneMissingInterpolatorEntities(this.asNavHost()) }
  private resolveReassignWeatherArg(ev: Extract<ServerEvent, { type: 'UnitReassign' }>): 0 | 1 | null { return resolveReassignWeatherArg(this.asEventHost(), ev) }
  private unitKnownByRawType(rawUnitType: number, id: number): boolean { return unitKnownByRawType(this.asEventHost(), rawUnitType, id) }
  private syncActiveAreaFromPlayerPosition(options?: { readonly emitHudSync?: boolean }): LevelView | null { return syncActiveAreaFromPlayerPosition(this.asNavHost(), options) }
  private resolveSceneAmbient(levelView: LevelView, playerSubX: number, playerSubY: number): SceneAmbientState { return resolveSceneAmbient(this.asNavHost(), levelView, playerSubX, playerSubY) }
  private runStateSetFunctions(ev: Extract<ServerEvent, { type: 'StateSet' }>): void { runStateSetFunctions(this.asNavHost(), ev) }
  private resolveUnitRoomLevelId(ref: { readonly unitType: UnitType; readonly id: number }): number | null { return resolveUnitRoomLevelId(this.asNavHost(), ref) }
  private findStoneAlphaNearLocalPlayer(): { readonly x: number; readonly y: number } | null { return findStoneAlphaNearLocalPlayer(this.asNavHost()) }
  private findObjectNearLocalPlayer(classId: number): ClientUnit | null { return findObjectNearLocalPlayer(this.asNavHost(), classId) }
  private findObjectNearSubTile(px: number, py: number, classId: number): ClientUnit | null { return findObjectNearSubTile(this.asNavHost(), px, py, classId) }
  private spawnHoradricStaffIfOrificeNear(): void { spawnHoradricStaffIfOrificeNear(this.asNavHost()) }
  private spawnDiabloAppearsIfInChaosSanctuary(): void { spawnDiabloAppearsIfInChaosSanctuary(this.asNavHost()) }
  private isLocalPlayerInTown(): boolean | null { return isLocalPlayerInTown(this.asNavHost()) }
  private isSubTileInTown(subX: number, subY: number): boolean { return isSubTileInTown(this.asNavHost(), subX, subY) }

  // ─── Outbound ClientCommand Dispatch ─────────────────────────

  /**
   * Dispatch a `ClientCommand` through `OutboundRateLimiter` (used by `HudModel` and direct API callers).
   */
  dispatchCommand(cmd: ClientCommand | Record<string, any>, nowMs = performance.now()): boolean {
    return dispatchSessionCommand(this.asEventHost(), cmd, nowMs)
  }

  /**
   * Alias for `dispatchCommand` used by input/HUD callers.
   */
  sendCommand(cmd: ClientCommand | Record<string, any>, nowMs = performance.now()): boolean {
    return this.dispatchCommand(cmd, nowMs)
  }

  /** Recent in-game chat input lines for `ArrowUp` / `ArrowDown` recall (max 32). */
  readonly chatInputHistory: string[] = []
  chatInputHistoryIndex = 0
  /**
   * In-memory `/players N` (`1..8`) setting persisted across games within the current session
   * (`null` when the player has not set `/players N` in this session; resets to default on page reload).
   */
  persistedPlayersCount: number | null = null
  appliedPersistedPlayersForGame = false

  /**
   * Navigate the in-game chat input history (`ArrowUp` / `ArrowDown`).
   */
  navigateChatInputHistory(direction: 'up' | 'down'): string {
    return navigateSessionChatInputHistory(this.asEventHost(), direction)
  }

  /**
   * Parse and execute an in-game chat input line (`Enter` key bar).
   */
  submitChatInput(rawInput: string, nowMs = performance.now()): boolean {
    return submitSessionChatInput(this.asEventHost(), rawInput, nowMs)
  }

  /**
   * Casts the active left or right skill at world sub-tile `(x, y)`.
   */
  useSkillAt(x: number, y: number, hand: 'left' | 'right' = 'right'): boolean {
    const cmd: ClientCommand = { type: 'SkillAt', hand, at: { x: Math.round(x), y: Math.round(y) }, hold: false }
    this.world.noteOutgoingCommand(cmd)
    return this.dispatchCommand(cmd)
  }

  /**
   * Casts the active left or right skill on target unit `(unitKind, unitId)`.
   */
  useSkillOn(unitKind: UnitType, unitId: number, hand: 'left' | 'right' = 'right', shift = false): boolean {
    const cmd: ClientCommand = { type: 'SkillOn', hand, target: { unitType: unitKind, id: unitId }, shift, hold: false }
    const predSnap = this.predictor.getSnapshot()
    const selfX = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.x : undefined
    const selfY = predSnap.x !== 0 || predSnap.y !== 0 ? predSnap.y : undefined
    this.world.noteOutgoingCommand(cmd, undefined, selfX, selfY)
    return this.dispatchCommand(cmd)
  }

  /**
   * Attacks target unit `(unitKind, unitId)` using the active left-hand skill.
   */
  attackUnit(unitKind: UnitType, unitId: number, shift = false): boolean {
    return this.useSkillOn(unitKind, unitId, 'left', shift)
  }

  private forwardCommandToAdapter(cmd: ClientCommand, nowMs?: number): void {
    if (cmd.type === 'LeaveGame') {
      // D2Client 0x6faf2850: C2S 0x69 LeaveGame is the client's own exit. Route it through `leaveGame`
      // (which sends 0x69 via `leaveToLobby` online / saves and closes the local game) so the adapter
      // closing afterwards is the intentional leave, never an unexpected D2GS loss.
      void this.leaveGame()
      return
    }
    forwardSessionCommandToAdapter(this.asEventHost(), cmd, nowMs)
  }

  // ─── Authoritative ServerEvent Ingestion ─────────────────────

  /**
   * Decode a raw D2GS S2C packet byte buffer and ingest the resulting `ServerEvent`.
   */
  handleS2cPacket(rawBytes: Uint8Array): ServerEvent {
    const ev = decodeCapturedGameS2cPacket(rawBytes, this.itemTables)
    this.handleServerEvent(ev)
    return ev
  }

  /**
   * Process an authoritative `ServerEvent` across `ClientWorld`, `MapService`, `AutomapView`,
   * `LocalMovementPredictor`, `RemoteEntityInterpolator`, and `HudModel`.
   */
  handleServerEvent(rawEv: ServerEvent): void {
    handleServerEvent(this.asEventHost(), rawEv)
  }

  private syncAudioSkillPacks(): void { syncAudioSkillPacks(this as unknown as SessionEventProcessorHost) }
  private drainWorldSoundRequests(): void { drainWorldSoundRequests(this as unknown as SessionEventProcessorHost) }

  // ─── Frame Tick & Render State ───────────────────────────────

  private resolveTargetUnitWorldPos(unitType: UnitType, unitId: number): { readonly x: number; readonly y: number } | null {
    return resolveTargetUnitWorldPos(this as unknown as SessionEventProcessorHost, unitType, unitId)
  }

  /**
   * Alias for `tick(dtMs, nowMs)` for frame-step callers.
   */
  stepFrame(dtMs = 40, nowMs = performance.now()): void {
    this.tick(dtMs, nowMs)
  }

  /**
   * Step the session by `dtMs` milliseconds.
   *
   * An in-process game server (Single Player `LocalLoopbackAdapter`) is stepped first, from this one
   * 25 Hz `LogicClock` tick line: the adapter accumulates `dtMs` into whole 40 ms server frames and runs
   * only its pause frame while the local game is paused (`GameInstance.isPaused`). Remote adapters
   * (D2GS) have no `tick`.
   */
  tick(dtMs = 40, nowMs = performance.now()): void {
    const adapter = this.gameAdapter
    if (adapter && adapter.state !== 'closed' && typeof adapter.tick === 'function') {
      adapter.tick(dtMs)
    }
    tickSessionFrame(this.asRenderHost(), dtMs, nowMs)
  }

  private enforceActiveInteractionRange113c(): void { enforceActiveInteractionRange113c(this.asNavHost()) }

  /**
   * Build `RenderableUnitInput[]` from `ClientWorld` + `LocalMovementPredictor` + `RemoteEntityInterpolator`.
   */
  buildRenderableUnits(nowMs?: number): RenderableUnitInput[] {
    return buildRenderableUnits(this.asRenderHost(), nowMs)
  }

  // ─── Deterministic `.d2cap` Capture Replay (F20) ─────────────

  /**
   * Load a `.d2cap` JSONL capture into the session replay queue and transition to `'replay'` phase.
   */
  loadD2CapReplay(jsonlText: string): number {
    return loadSessionD2CapReplay(this.asReplayHost(), jsonlText)
  }

  /**
   * Step 1 packet from the loaded `.d2cap` capture, decoding `game` `s2c` packets into `ServerEvent`s.
   */
  stepD2CapReplay(): ReplayedD2CapFrame | null {
    return stepSessionD2CapReplay(this.asReplayHost())
  }

  /**
   * Replay all remaining records in the loaded `.d2cap` capture synchronously.
   */
  replayAllD2Cap(): number {
    return replayAllSessionD2Cap(this.asReplayHost())
  }

  private extractEventsFromReplayRecord(
    conn: ReplayedD2CapFrame['conn'],
    dir: ReplayedD2CapFrame['dir'],
    rawBytes: Uint8Array,
    record: ReplayedD2CapFrame['record'],
  ): readonly ServerEvent[] {
    return extractSessionEventsFromReplayRecord(this.asReplayHost(), conn, dir, rawBytes, record)
  }

  // ─── Internal Error & Lifecycle Helpers ──────────────────────

  resolveWsBridgeBaseUrl(serverHost?: string): string {
    const rawHost = (serverHost || 'www.laiseek.xyz').trim()
    const explicitSchemeMatch = /^(wss?|https?):\/\//i.exec(rawHost)
    const cleanHost = rawHost
      .replace(/^(wss?|https?):\/\//i, '')
      .replace(/\/.*$/, '')
    const isLocalHost =
      cleanHost === 'localhost' ||
      cleanHost.startsWith('localhost:') ||
      cleanHost === '127.0.0.1' ||
      cleanHost.startsWith('127.0.0.1:') ||
      cleanHost === '[::1]' ||
      cleanHost.startsWith('[::1]:')
    let scheme: 'wss' | 'ws'
    if (explicitSchemeMatch) {
      const proto = explicitSchemeMatch[1]!.toLowerCase()
      scheme = proto === 'wss' || proto === 'https' ? 'wss' : 'ws'
    } else {
      // All remote servers (e.g. d2.laiseek.xyz, www.laiseek.xyz) use wss:// over TLS 443
      // even when the web client itself is served from http://localhost:8080.
      scheme =
        !isLocalHost ||
        (typeof window !== 'undefined' && window.location?.protocol === 'https:')
          ? 'wss'
          : 'ws'
    }
    return `${scheme}://${cleanHost}/d2net`
  }

  private parseWsBridgeUrl(wsBase: string): {
    readonly host: string
    readonly scheme: 'wss' | 'ws'
    readonly basePath: string
  } {
    try {
      const parsed = new URL(wsBase)
      const scheme: 'wss' | 'ws' =
        parsed.protocol === 'wss:' || parsed.protocol === 'https:' ? 'wss' : 'ws'
      const basePath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/d2net'
      return {
        host: parsed.host || 'www.laiseek.xyz',
        scheme,
        basePath,
      }
    } catch {
      return {
        host: 'www.laiseek.xyz',
        scheme: 'wss',
        basePath: '/d2net',
      }
    }
  }

  private bindFlowListeners(flow: D2OnlineFlow): void {
    this.unsubFlowState?.()
    this.unsubFlowLost?.()
    this.unsubFlowChat?.()

    this.unsubFlowState = flow.onState(() => {
      if (this.flow !== flow) return
      this.emitState()
    })

    this.unsubFlowLost = flow.onSessionLost((ev: D2OnlineSessionLost) => {
      if (this.flow !== flow) return
      this.handleSessionLost({ session: ev.session, cause: ev.cause, technical: ev.message })
    })

    if (typeof flow.onChatEvent === 'function') {
      this.unsubFlowChat = flow.onChatEvent((ev: ChatEvent) => {
        if (this.flow !== flow) return
        this.handleBncsChatEvent(ev)
      })
    } else {
      this.unsubFlowChat = null
    }
  }

  /** The game ended for a client-side reason (bad server data, send failure, GameLogout). */
  private handleUnexpectedDisconnect(
    reason: string,
    cause: Extract<OnlineSessionLostCause, 'error' | 'closed'> = 'error',
    useTbl = false,
  ): void {
    this.handleSessionLost({
      session: 'd2gs',
      cause,
      technical: reason,
      ...(useTbl ? {} : { reason }),
    })
  }

  private detachGameServerListeners(): void {
    this.unsubGameEvent?.()
    this.unsubGameEvent = null
    this.unsubGameClose?.()
    this.unsubGameClose = null
  }

  /** Detach from and close the current flow (which closes every BNCS/MCP/D2GS connection it owns). */
  private async closeFlowQuietly(): Promise<void> {
    this.unsubFlowState?.()
    this.unsubFlowState = null
    this.unsubFlowLost?.()
    this.unsubFlowLost = null
    this.unsubFlowChat?.()
    this.unsubFlowChat = null
    if (this.flow) {
      const current = this.flow
      this.flow = null
      try {
        await current.close()
      } catch {
        // Ignore close errors
      }
    }
  }

  private acquireOrRefreshActiveCharLease(gameName: string): void {
    const charName = this.selectedCharValue || this.world.self.name
    const host = this.loginHostValue || this.defaultHost
    if (!charName || !this.leaseStorage) return
    this.activeLeaseHost = host
    this.activeLeaseChar = charName
    this.activeLeaseGame = gameName
    writeActiveCharacterLease(this.leaseStorage, {
      tabId: this.tabId,
      host,
      accountName: this.usernameValue,
      charName,
      gameName,
      updatedAt: Date.now(),
    })
    if (this.leaseHeartbeatTimer === null) {
      const timer = setInterval(() => {
        if (
          (this.phaseValue === 'entering-game' || this.phaseValue === 'ingame') &&
          this.activeLeaseHost &&
          this.activeLeaseChar
        ) {
          writeActiveCharacterLease(this.leaseStorage, {
            tabId: this.tabId,
            host: this.activeLeaseHost,
            accountName: this.usernameValue,
            charName: this.activeLeaseChar,
            gameName: this.activeLeaseGame ?? this.activeGameNameValue ?? '',
            updatedAt: Date.now(),
          })
        } else {
          this.releaseActiveCharLease()
        }
      }, ACTIVE_CHAR_LEASE_HEARTBEAT_MS)
      ;(timer as { unref?: () => void }).unref?.()
      this.leaseHeartbeatTimer = timer
    }
  }

  private releaseActiveCharLease(): void {
    if (this.leaseHeartbeatTimer !== null) {
      clearInterval(this.leaseHeartbeatTimer)
      this.leaseHeartbeatTimer = null
    }
    const host = this.activeLeaseHost ?? this.loginHostValue ?? this.defaultHost
    const charName = this.activeLeaseChar ?? this.selectedCharValue ?? this.world.self.name
    this.activeLeaseHost = null
    this.activeLeaseChar = null
    this.activeLeaseGame = null
    if (charName && this.leaseStorage) {
      releaseActiveCharacterLease(this.leaseStorage, host, charName, this.tabId)
    }
  }

  private setPhase(next: OnlineSessionPhase): void {
    const prev = this.phaseValue
    if (
      (prev === 'ingame' || prev === 'entering-game') &&
      next !== 'ingame' &&
      next !== 'entering-game'
    ) {
      this.releaseActiveCharLease()
    }
    if (
      (prev === 'ingame' || prev === 'replay' || prev === 'entering-game') &&
      next !== 'ingame' &&
      next !== 'replay' &&
      next !== 'entering-game'
    ) {
      this.audioRuntime.gameExit()
    }
    this.phaseValue = next
    this.emitState()
  }

  private emitState(): void {
    const snap = this.getSnapshot()
    for (const listener of this.stateListeners) {
      listener(snap)
    }
  }

  destroy(): void {
    this.releaseActiveCharLease()
    this.unsubPageUnload?.()
    this.unsubPageUnload = null
    this.audioRuntime.gameExit()
    this.detachGameServerListeners()
    void this.closeFlowQuietly()
    this.unsubSettings?.()
    this.unsubSettings = null
    this.hudModel.dispose()
  }
}
