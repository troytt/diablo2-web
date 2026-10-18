/**
 * Online Play Entry Point (`src/client/main.ts` for `play.html`, Milestone M5 — F16, F17, F18, F20).
 *
 * Integrates:
 * - Persistent 32px Top Toolbar (`Toolbar` + `SettingsStore`)
 * - Battle.net Pre-Game & Live Lobby (`FrontendRenderer` + `BnetFlowState` + `OnlineSession`)
 * - In-Game Isometric World + Automap + Lighting (`ClientWorldSceneSource`, `AutomapView`)
 * - Authentic D2 HUD Overlay (`HudManager` + `HudModel` + `CommandMapper` for every registered `ViewportProfile`)
 * - Hot-Swappable Plugin Host & Configuration Modal (`PluginHost` + `PluginMenu`)
 * - Graceful disconnect & error recovery banner (`#play-disconnect-banner`)
 * - PD2 presentation runtime (the only default; no PD2/1.13c switch): SGD2FreeRes viewport (settings default
 *   `1068x600`), `d2fps` motion smoothing (`SceneMotionSmoother`), D2GL HD cursor (`CursorController`)
 *
 * Strict import boundary: never imports `src/netproto/{bncs,mcp,d2gs,crypto}/**`.
 */

import {
  applyCreateAccountServerError,
  applyOnlineCharactersToFlowState,
  applyRealmGamesToFlowState,
  CAMPFIRE_CLASS_SPECS,
  createInitialFlowState,
  isDifficultyUnlocked,
  JOIN_GAME_LIST_REFRESH_INTERVAL_MS,
  openPopupModal,
  resetHeroAvatarAnims,
  returnToLoginAfterSessionLoss,
  setBnetConnectStage,
  stepFlowFrame,
  type BnetFlowState,
} from './frontend/flow-state.ts'
import { FrontendRenderer } from './frontend/frontend-renderer.ts'
import { buildAvatarSpecFromStatstring } from './frontend/avatar-compositor.ts'
import {
  PLAYER_CLASS_TOKENS,
  resolveCharacterAppearance,
  type EquippedAppearanceInput,
} from '../common/units/char-appearance.ts'
import { CHAT_INPUT_MAX_CHARS, resolveChatTblIndex } from '../common/chat/chat-113c.ts'
import { LightGrid } from '../common/drlg/light-grid.ts'
import type { LoadedMonsterArt } from './render/monster-art.ts'
import { getTblLang, lookupTbl, setLang, type GameLang } from './i18n/lang.ts'
import { BncsCreateAccountError, type CharClassId } from '../netproto/index.ts'
import { SpriteRenderer, type AtlasHandle } from './render/renderer.ts'
import { FpsCounter113c } from './render/fps-counter-113c.ts'
import {
  DEFAULT_BASES,
  EntityArtCache,
  loadCharacterArt,
  loadMonsterArtMap,
  type LoadedCharacter,
} from './scene/entity-art-loader.ts'
import { loadItemsAtlas } from './scene/ground-item-renderer.ts'
import {
  loadMissileArtMap,
  loadOverlayArtMap,
  type LoadedMissileArt,
  type LoadedOverlayArt,
} from './scene/missile-overlay-renderer.ts'
import {
  getPlayerPaperdollGpuCache,
  TileAtlasGpuCache,
  renderSceneSourceFrame,
  reportMissingArt,
} from './scene/world-renderer.ts'
import {
  BootProgressTracker,
  type BootProgressSnapshot,
} from './ui/boot-progress.ts'
import { isModalDomOverlayOpen } from './ui/dom-overlay.ts'
import { HudManager } from './ui/hud-manager.ts'
import { Minimap } from './ui/minimap.ts'
import {
  installBrowserGestureGuard,
  type BrowserGestureGuardHandle,
} from './input/browser-gesture-guard.ts'
import { CommandMapper } from './input/command-mapper.ts'
import { D2_LOGIC_TICK_MS, runOwedTicks } from './loop/logic-clock.ts'
import { MotionSmoothing } from './loop/motion-smoothing.ts'
import { SceneMotionSmoother } from './loop/scene-motion-smoothing.ts'
import { MapService } from './map/map-service.ts'
import type { D2WebPlugin, PluginQuickCastPort } from './plugin-host/api.ts'
import { PluginHost } from './plugin-host/plugin-host.ts'
import { PluginMenu } from './plugin-host/plugin-menu.ts'
import {
  OnlineSession,
  SessionLostError,
  formatLobbyGameEnterError,
} from './session/online-session.ts'
import type { GameCompletion113c } from './session/game-completion-113c.ts'
import { getGlobalSettingsStore, type SettingsStore } from './settings/settings-store.ts'
import {
  getAssetCacheStatus,
  registerAssetCache,
} from './sw/register.ts'
import { Toolbar } from './toolbar/toolbar.ts'
import { HudModel } from './ui-model/hud-model.ts'
import type { SceneFrameSnapshot } from './view/scene-source.ts'
import { syncCrispBackingStore } from './view/crisp-scale.ts'
import {
  applyViewportProfileToDom,
  getViewportProfile,
  type ViewportProfile,
} from './view/viewport-profile.ts'
import { loadWeatherAssetsSafe } from './weather/weather-assets.ts'
import {
  WeatherScenePass,
  weatherPanelFromSidePanels,
  weatherWorldDrawnFromSidePanels,
} from './weather/weather-render-pass.ts'

const togglePortFor = <K extends PropertyKey>(target: Record<K, boolean>, key: K) => ({
  isEnabled: () => target[key],
  setEnabled: (enabled: boolean) => void (target[key] = enabled),
})

const PRELOAD_MONSTER_IDS = [
  'fallen1',
  'FallenShaman1',
  'quillrat1',
  'zombie1',
  'skeleton1',
  'bighead1',
  'foulcrow1',
  'corruptrogue1',
  'goatman1',
  'brute1',
] as const

/**
 * Canonical 1.13c `CharStats.txt` (`item1`/`item1loc`, `item2`/`item2loc`) starter equipment per hero token,
 * used to prewarm the in-game paperdoll WebGL atlas for newly created characters in the lobby before
 * entering Rogue Encampment.
 */
const STARTER_EQUIP_BY_HERO_TOKEN: Readonly<Record<string, EquippedAppearanceInput>> = {
  am: { weapon1: 'jav', weapon2: 'buc' },
  so: { weapon1: 'sst' },
  ne: { weapon1: 'wnd' },
  pa: { weapon1: 'ssd', weapon2: 'buc' },
  ba: { weapon1: 'hax', weapon2: 'buc' },
  dz: { weapon1: 'clb', weapon2: 'buc' },
  ai: { weapon1: 'ktr', weapon2: 'buc' },
}

export interface PlayAppController {
  readonly ready: boolean
  readonly bootProgress: BootProgressSnapshot
  readonly bootProgressTracker: BootProgressTracker
  readonly settings: SettingsStore
  readonly settingsStore: SettingsStore
  readonly session: OnlineSession
  readonly plugins: PluginHost
  readonly pluginMenu: PluginMenu
  readonly toolbar: Toolbar
  readonly hudManager: HudManager
  readonly hudModel: HudModel
  readonly commandMapper: CommandMapper
  readonly gestureGuard: BrowserGestureGuardHandle
  readonly flowState: BnetFlowState
  readonly frontendRenderer: FrontendRenderer
  readonly renderer: SpriteRenderer
  readonly tileGpuCache: TileAtlasGpuCache
  readonly entityArtCache: EntityArtCache
  /**
   * #954: tear this controller's DOM listeners and render loop down so a
   * re-boot in the same JS context does not pin the retired session graph.
   */
  dispose(): void
  readonly lightGrid: LightGrid
  readonly minimap: Minimap
  readonly assetsReadyPromise: Promise<void>
  readonly getLastRenderSnapshot: () => SceneFrameSnapshot | null
  readonly isInGameView: () => boolean
  readonly returnToLobby: () => void
  readonly sendChat: (message: string) => void
  readonly replayD2Cap: (jsonlText: string) => number
  readonly simulateDisconnect: (reason?: string) => Promise<void>
  readonly renderFrame: (nowMs?: number) => void
}

declare global {
  interface Window {
    __d2SkipAutoBoot?: boolean
    __d2BootProgress?: BootProgressSnapshot
    __d2PlayApp?: PlayAppController
    __d2Play?: PlayAppController
  }
}

export async function startPlayApp(options?: {
  readonly plugins?: readonly D2WebPlugin[]
}): Promise<PlayAppController> {
  // #954 re-boot guard: dev HMR re-execution of the play.html module (and any
  // future in-page re-login flow) can call `startPlayApp` again in the SAME JS
  // context. Retire the previous controller's DOM listeners and rAF loop
  // first — otherwise every re-boot pins one full OnlineSession graph through
  // immortal window/stage listeners (measured 4 retained worlds / 811MB).
  const previousController = window.__d2Play
  if (previousController && typeof previousController.dispose === 'function') {
    try {
      previousController.dispose()
    } catch {
      // Best-effort teardown; the fresh boot re-registers its own listeners.
    }
  }

  /**
   * #954: DOM subscriptions owned by THIS boot. `controller.dispose()` runs
   * them all so a re-boot cannot accumulate listeners (and their captured
   * session graphs) across restarts.
   */
  const bootDisposers: (() => void)[] = []
  const trackListener = (
    target: Window | Document | HTMLElement,
    type: string,
    fn: (e: never) => void,
    options?: boolean | AddEventListenerOptions,
  ): void => {
    target.addEventListener(type, fn as EventListener, options)
    bootDisposers.push(() => {
      ;(target as Window).removeEventListener(type, fn as EventListener, options)
    })
  }

  window.__d2SkipAutoBoot = true

  const toolbarContainer = document.querySelector<HTMLElement>('#d2-toolbar-container')
  const workspaceEl = document.querySelector<HTMLElement>('#play-workspace')
  const stageWrapperEl = document.querySelector<HTMLElement>('#play-stage-wrapper')
  const stageEl = document.querySelector<HTMLElement>('#play-stage')
  const bnetShell = document.querySelector<HTMLElement>('#bnet-shell')
  const bnetCanvas = document.querySelector<HTMLCanvasElement>('#bnet-canvas')
  const viewCanvas = document.querySelector<HTMLCanvasElement>('#view')
  const hudCanvas = document.querySelector<HTMLCanvasElement>('#d2-hud-canvas')
  // #940 R3: dedicated cursor layer above the HUD; optional — HudManager falls
  // back to drawing the cursor on the HUD canvas when the host page lacks it.
  const cursorLayerCanvas = document.querySelector<HTMLCanvasElement>('#d2-cursor-canvas')
  const disconnectBanner = document.querySelector<HTMLElement>('#play-disconnect-banner')

  if (!stageEl || !bnetShell || !bnetCanvas || !viewCanvas || !hudCanvas) {
    throw new Error('Missing required DOM elements in play.html')
  }

  for (const el of [stageEl, bnetShell, bnetCanvas, viewCanvas, hudCanvas]) {
    if (el.style) {
      el.style.cursor = 'none'
    }
  }

  const bootProgress = new BootProgressTracker({ stageEl, expectedTotal: 180 }).install()

  const settingsStore = getGlobalSettingsStore()
  const initialSettings = settingsStore.get()
  setLang(initialSettings.lang)

  let sessionRef: OnlineSession | null = null
  let pluginMenuRef: PluginMenu | null = null
  let gestureReceivedBeforeSession = false

  const unlockAndWarmUiAudio = (): void => {
    gestureReceivedBeforeSession = true
    if (!sessionRef) return
    sessionRef.audioRuntime.unlock()
    const ctx = sessionRef.audioRuntime.getContext()
    if (ctx !== null) {
      void sessionRef.audioRuntime.loader.loadSoundBuffer(4, ctx).catch(() => {
        /* ignore transient decode/load errors */
      })
    }
  }

  for (const evtName of [
    'pointerdown',
    'mousedown',
    'mouseup',
    'click',
    'keydown',
    'touchstart',
  ] as const) {
    trackListener(window, evtName, unlockAndWarmUiAudio, true)
  }
  trackListener(
    window,
    'pointermove',
    () => {
      if (
        typeof navigator !== 'undefined' &&
        (navigator as { userActivation?: { hasBeenActive?: boolean } }).userActivation?.hasBeenActive
      ) {
        unlockAndWarmUiAudio()
      }
    },
    true,
  )

  const syncStageViewportFit = (
    profileOrId: ViewportProfile | typeof initialSettings.viewport = settingsStore.get().viewport,
  ): ViewportProfile => {
    const profile = applyViewportProfileToDom(profileOrId, {
      containerEl: stageWrapperEl ?? stageEl.parentElement,
      stageEl,
      glCanvas: viewCanvas,
      hudCanvas,
    })
    sessionRef?.hudManager.resize(profile.width, profile.height)
    sessionRef?.camera.resize(profile)
    return profile
  }

  const toolbar = new Toolbar({
    store: settingsStore,
    container: toolbarContainer,
    callbacks: {
      onLangChange: (lang: GameLang) => {
        setLang(lang)
        sessionRef?.hudManager.setLang(lang)
      },
      onViewportChange: (profile: ViewportProfile) => {
        syncStageViewportFit(profile)
      },
      onAutomapRevealChange: (mode) => {
        sessionRef?.automapView.setMode(mode)
      },
      onServerHostReconnect: (newHost) => {
        void sessionRef?.disconnect(`Reconnecting to ${newHost}`)
      },
      onPluginsToggle: () => {
        pluginMenuRef?.toggle()
      },
      onModalOpen: () => {
        pluginMenuRef?.close()
      },
      getBugReportContext: () => ({
        inGameView,
        flowStage: flowState.stage,
        sessionPhase: sessionRef?.phase ?? 'disconnected',
        accountName: flowState.accountName || '',
        selectedChar: sessionRef?.selectedChar ?? null,
        areaId: sessionRef?.world.areaId ?? 0,
        pingMs: sessionRef?.pingMs ?? null,
      }),
    },
  })

  const initialCacheStatus = await registerAssetCache()
  toolbar.setAssetCacheUsageBytes(initialCacheStatus.usageBytes)

  const minimap = new Minimap()
  const renderer = new SpriteRenderer(viewCanvas)
  const lightGrid = new LightGrid()
  const tileGpuCache = new TileAtlasGpuCache(renderer)
  const entityArtCache = new EntityArtCache(renderer, '')

  const characterArtByToken = new Map<string, LoadedCharacter>()
  const characterArtInflight = new Map<string, Promise<void>>()
  const failedCharacterArtTokens = new Set<string>()
  const monsterArtMap = new Map<string, LoadedMonsterArt>()
  let missileArtMap = new Map<string, LoadedMissileArt>()
  let overlayArtMap = new Map<string, LoadedOverlayArt>()
  let itemsAtlasHandle: AtlasHandle | undefined
  let lastRenderSnapshot: SceneFrameSnapshot | null = null
  let inGameAssetsPromise!: Promise<void>

  /**
   * On-demand hero animation pack loader (`char-<token>.r8`, one per class).
   * Original 1.13c only loads the played class at level entry; the remaining
   * classes stream in the first time an in-world unit actually needs them
   * (other players joining, Dopplezon/Valkyrie/Shadow disguises).
   * Hard-failed tokens are reported once and never retried (Anti-Silent-Failure).
   */
  const ensureCharacterArt = (token: string): Promise<void> => {
    const heroToken = token.trim().toLowerCase()
    if (!(PLAYER_CLASS_TOKENS as readonly string[]).includes(heroToken)) return Promise.resolve()
    if (characterArtByToken.has(heroToken) || failedCharacterArtTokens.has(heroToken)) {
      return Promise.resolve()
    }
    let inflight = characterArtInflight.get(heroToken)
    if (inflight === undefined) {
      inflight = loadCharacterArt(DEFAULT_BASES, null, renderer, '', 1, heroToken)
        .then((art) => {
          if (art !== null) {
            characterArtByToken.set(heroToken, art)
            characterArtByToken.set(heroToken.toUpperCase(), art)
          } else {
            failedCharacterArtTokens.add(heroToken)
            reportMissingArt('player', heroToken, `Character art not found for token=${heroToken}`)
          }
        })
        .catch((err: unknown) => {
          failedCharacterArtTokens.add(heroToken)
          reportMissingArt('player', heroToken, String(err))
        })
        .finally(() => {
          characterArtInflight.delete(heroToken)
        })
      characterArtInflight.set(heroToken, inflight)
    }
    return inflight
  }

  // #954 retention: track which class packs an actual draw resolved this
  // frame. Packs no unit has needed for 2 minutes are evicted (both case keys
  // point at the same LoadedCharacter). Present players/summons refresh their
  // token every frame, so this never touches packs that are on screen —
  // an evicted class simply streams back via ensureCharacterArt (the same
  // lazy path vanilla uses when another player joins).
  const CHARACTER_ART_STALE_MS = 120_000
  const CHARACTER_ART_SWEEP_INTERVAL_MS = 30_000
  const characterArtLastUseMs = new Map<string, number>()
  let lastCharacterArtSweepMs = 0
  const noteCharacterArtUse = (token: string): void => {
    characterArtLastUseMs.set(token, performance.now())
  }
  const sweepStaleCharacterArt = (nowMs: number): void => {
    if (nowMs - lastCharacterArtSweepMs < CHARACTER_ART_SWEEP_INTERVAL_MS) return
    lastCharacterArtSweepMs = nowMs
    for (const [token, lastUseMs] of characterArtLastUseMs) {
      if (token === ownHeroClassToken) continue
      if (nowMs - lastUseMs < CHARACTER_ART_STALE_MS) continue
      characterArtLastUseMs.delete(token)
      characterArtByToken.delete(token)
      characterArtByToken.delete(token.toUpperCase())
    }
  }

  // In-game chat input keyboard/IME sink (`D2Client.dll` `0x6fb20140` `CHAT_DrawChatInputBox` + `0x6fb1ef20` `CHAT_DrawCursor`
  // renders the authentic translucent box, wrapped `font16` text, and blinking `_` cursor directly on `hudCanvas`).
  const chatInputEl = document.createElement('input')
  chatInputEl.id = 'd2-ingame-chat-input'
  chatInputEl.type = 'text'
  chatInputEl.maxLength = CHAT_INPUT_MAX_CHARS
  chatInputEl.placeholder = ''
  chatInputEl.dataset.d2Synced = '1'
  chatInputEl.hidden = true
  chatInputEl.style.cssText =
    'position:absolute;left:127px;bottom:56px;width:1px;height:1px;opacity:0;pointer-events:none;border:none;padding:0;margin:0;outline:none;z-index:-1;'
  stageEl.appendChild(chatInputEl)

  const syncChatInputToHud = (): void => {
    hudManager.chatInputOpen = !chatInputEl.hidden
    hudManager.chatInputText = chatInputEl.value
    hudManager.syncPublishedState()
  }

  const toggleInGameChatInput = (): void => {
    if (!chatInputEl.hidden) {
      const msg = chatInputEl.value
      chatInputEl.value = ''
      chatInputEl.hidden = true
      syncChatInputToHud()
      chatInputEl.blur()
      if (msg.trim().length > 0 && sessionRef) {
        sessionRef.submitChatInput(msg)
      }
    } else {
      chatInputEl.placeholder = ''
      chatInputEl.hidden = false
      chatInputEl.value = ''
      syncChatInputToHud()
      if (sessionRef) {
        sessionRef.chatInputHistoryIndex = sessionRef.chatInputHistory.length
      }
      chatInputEl.focus()
    }
  }

  chatInputEl.addEventListener('input', () => {
    syncChatInputToHud()
  })

  chatInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      toggleInGameChatInput()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      chatInputEl.value = ''
      chatInputEl.hidden = true
      syncChatInputToHud()
      chatInputEl.blur()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      if (sessionRef) {
        chatInputEl.value = sessionRef.navigateChatInputHistory('up')
        syncChatInputToHud()
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      if (sessionRef) {
        chatInputEl.value = sessionRef.navigateChatInputHistory('down')
        syncChatInputToHud()
      }
    }
  })

  const hudManager = new HudManager(hudCanvas, {
    onRenderAutomapOverlay: (ctx, font, logicalWidth, logicalHeight) => minimap.drawHudOverlay(ctx, font, logicalWidth, logicalHeight),
    onToggleAutomap: () => {
      sessionRef?.hudModel.toggleAutomap()
    },
    onToggleAutomapMode: () => {
      minimap.toggleMode()
    },
    onCycleAutomapFade: () => {
      minimap.cycleFade()
    },
    onToggleAutomapNames: () => {
      minimap.toggleNames()
    },
    onResetAutomapPan: () => {
      minimap.resetPan()
    },
    onPanAutomap: (dx, dy) => minimap.pan(dx, dy),
    onEscapeMenuAction: (action) => {
      if (action === 'saveAndExit') {
        if (!chatInputEl.hidden) {
          chatInputEl.value = ''
          chatInputEl.hidden = true
          chatInputEl.blur()
        }
        void sessionRef?.leaveGame()
      }
    },
  },
  cursorLayerCanvas)

  // Map service with non-blocking background tile bundle fetching
  const mapService = MapService.fromPackedUrlsLazy('/act-packs/tiles')

  // 25fps idle throttle for the HUD 2D repaint (cursor moves still redraw at
  // full rate); tests construct HudManager directly and keep per-call renders.
  hudManager.enableIdleThrottle = true

  const session = new OnlineSession({
    settingsStore,
    hudManager,
    mapService,
    defaultHost: initialSettings.serverHost,
    onToggleChatInput: toggleInGameChatInput,
    onEscapeMenu: () => {
      session.hudModel.togglePanel('escapeMenu')
    },
  })
  sessionRef = session
  hudManager.configureEscapeMenuSettings({
    getSettings: () => {
      const s = settingsStore.get()
      return {
        masterVolume: s.masterVolume,
        audioMuted: s.audioMuted,
        viewport: s.viewport,
        worldRenderFps: s.worldRenderFps,
        keyBindings: s.keyBindings,
        fullscreenActive: toolbar.isFullscreenActive(),
        fullscreenSupported: toolbar.isFullscreenSupported(),
      }
    },
    onUpdateSettings: (patch) => {
      if (patch.masterVolume !== undefined) {
        toolbar.setMasterVolume(patch.masterVolume)
      }
      if (patch.audioMuted !== undefined) {
        toolbar.setAudioMuted(patch.audioMuted)
      }
      if (patch.viewport !== undefined) {
        toolbar.setViewport(patch.viewport)
      }
      if (patch.worldRenderFps !== undefined) {
        toolbar.setWorldRenderFps(patch.worldRenderFps)
      }
      if (patch.keyBindings !== undefined) {
        settingsStore.set({ keyBindings: patch.keyBindings })
      }
    },
    onToggleFullscreen: () => {
      toolbar.toggleFullscreen()
    },
  })
  // PD2 d2fps.dll motion smoothing (default on): the scene draws units and the camera between their
  // previous and current 25 Hz tick positions.
  const motionSmoother = new SceneMotionSmoother(new MotionSmoothing(), session.logicClock)
  session.sceneSource.setStateFilter((st) => motionSmoother.apply(st))
  // PD2 D2GL HD cursor (default on): start loading /cursor-pd2/ now; a missing manifest is reported and
  // both cursors fall back to the DC6 art.
  void hudManager.cursor.loadHdCursor()
  session.audioRuntime.playTitleMusic()
  session.audioRuntime.loader.prefetch('sfx-core')
  if (
    gestureReceivedBeforeSession ||
    (typeof navigator !== 'undefined' &&
      (navigator as { userActivation?: { hasBeenActive?: boolean } }).userActivation?.hasBeenActive)
  ) {
    unlockAndWarmUiAudio()
  }

  // 1.13c FPS counter 0x6fb0a9a0; its value gates the lightning flash (`cmp 0xa` @0x6fb306c2).
  const fpsCounter = new FpsCounter113c()
  const weatherPass = new WeatherScenePass({
    controller: session.weather,
    period: () => session.environment.period,
    panel: () =>
      weatherPanelFromSidePanels(session.hudManager.leftPanel !== 'none', session.hudManager.rightPanel !== 'none'),
    worldDrawn: () =>
      weatherWorldDrawnFromSidePanels(
        session.hudManager.leftPanel !== 'none',
        session.hudManager.rightPanel !== 'none',
      ),
    fps: () => fpsCounter.fps,
  })
  // NOT 1.13c: Quick Cast toggle port (Issue #952, PD2/D2R parity). Flips
  // CommandMapper.quickCastMode so bound skill-hotkey presses cast at the cursor instead
  // of switching the skill selection; the plugin host releases the claim automatically
  // when the quick-cast plugin is disabled, restoring vanilla select-on-press.
  const quickCastPort: PluginQuickCastPort = {
    isEnabled: () => session.commandMapper.quickCastMode,
    setEnabled: (enabled) => {
      session.commandMapper.quickCastMode = enabled
    },
  }
  const plugins = new PluginHost({
    plugins: options?.plugins ?? [],
    session,
    toolbar,
    settingsStore,
    enforceClientDefaults: true,
    quickCast: quickCastPort,
    dragInteract: togglePortFor(session.commandMapper, 'dragInteractMode'),
    stashDepositAll: togglePortFor(hudManager.worldPanels, 'stashDepositAllEnabled'),
    xpBar: togglePortFor(hudManager, 'showXpBar'),
    autoGoldPickup: togglePortFor(session.commandMapper, 'autoGoldPickup'),
    upgradeHints: togglePortFor(hudManager, 'upgradeHints'),
    monsterResists: togglePortFor(hudManager.worldPanels, 'showMonsterResists'),
    itemInfo: { getConfig: () => hudManager.itemInfo, setConfig: (config) => hudManager.setItemInfo(config) },
    autoCombat: { getKey: () => session.commandMapper.autoCombatKey, setKey: (key) => void (session.commandMapper.autoCombatKey = key) },
    autoPotion: {
      getThresholds: () => session.commandMapper.autoPotionThresholds,
      setThresholds: (thresholds) => void (session.commandMapper.autoPotionThresholds = thresholds),
    },
  })
  const pluginMenu = new PluginMenu({
    host: plugins,
    toolbar,
  })
  pluginMenuRef = pluginMenu

  // Apply the initial viewport profile's dimensions, stretched to fit the browser at its own aspect ratio
  syncStageViewportFit(settingsStore.get().viewport)

  trackListener(window, 'resize', () => {
    syncStageViewportFit()
  })

  if (typeof ResizeObserver !== 'undefined' && stageWrapperEl) {
    const stageResizeObserver = new ResizeObserver(() => {
      syncStageViewportFit()
    })
    stageResizeObserver.observe(stageWrapperEl)
    bootDisposers.push(() => stageResizeObserver.disconnect())
  }

  const flowState = createInitialFlowState()
  try {
    const savedAccount = window.localStorage?.getItem('d2_last_bnet_account')
    if (savedAccount && savedAccount.trim()) {
      flowState.accountName = savedAccount.trim().slice(0, 15)
    }
  } catch {
    // Ignore localStorage access errors in restricted contexts
  }
  const frontendRenderer = new FrontendRenderer(bnetCanvas, flowState)
  void frontendRenderer.cursor.loadHdCursor()
  frontendRenderer.onPlaySound = (soundId: number) => {
    unlockAndWarmUiAudio()
    session.audioRuntime.playUi(soundId)
    session.audioRuntime.uiTick(1)
  }

  let inGameView = false
  /** Own class' animation pack is requested exactly once per level entry. */
  let ownHeroArtKicked = false
  /** #954: the played class token — its pack is never staleness-evicted (fallback art insurance). */
  let ownHeroClassToken: string | undefined
  /** Deduplication key for lobby character asset preloading (`#1024`). */
  let lastPreloadedLobbyHeroSig: string | null = null
  /** Deduplication key for topological 1-hop level-graph asset preloading (`#1025`). */
  let lastPreloadedAreaSig: string | null = null
  let neighborPreloadTimer: ReturnType<typeof setTimeout> | null = null
  /** One login attempt at a time: concurrent attempts used to replace each other's live session. */
  let loginInFlight = false

  const clearPendingNeighborPreload = (): void => {
    lastPreloadedAreaSig = null
    if (neighborPreloadTimer !== null) {
      clearTimeout(neighborPreloadTimer)
      neighborPreloadTimer = null
    }
  }

  /**
   * Topological 1-hop level-graph preloader (`#1025`): whenever the active level (`areaId`)
   * changes in-game, immediately pre-warm the current level's R8 tile pages and preset/spawn
   * NPCs, monsters, and objects, and schedule the 1-hop neighbor levels (`Levels.txt` `dwVis`
   * + entrances) tile pages and monster pools on a background timer.
   */
  const preloadActiveAreaAssets = (): void => {
    const activeAreaId =
      session.world.areaId > 0 ? session.world.areaId : (mapService.getActiveAreaId() ?? 0)
    if (activeAreaId <= 0) return
    const activeSeed = mapService.getActiveSeed() ?? 0
    const activeDiff = mapService.getActiveDifficulty()
    const hasLoadedView = mapService.getLoadedLevelView(activeAreaId) !== undefined
    const sig = `${String(activeSeed)}:${String(activeDiff)}:${String(activeAreaId)}:${hasLoadedView ? '1' : '0'}`
    if (sig === lastPreloadedAreaSig) return
    const plan = mapService.getLevelPreloadPlan(activeAreaId)
    if (!plan) return
    lastPreloadedAreaSig = sig

    tileGpuCache.ensureActPalette(plan.actId)
    tileGpuCache.preloadPages(plan.currentTilePages)
    entityArtCache.preloadEntities({
      monsterClassIds: plan.currentMonsterHcIndices,
      objectClassIds: plan.currentObjectClassIds,
      act: plan.actId,
    })

    if (neighborPreloadTimer !== null) {
      clearTimeout(neighborPreloadTimer)
      neighborPreloadTimer = null
    }
    if (plan.neighborTilePages.length > 0 || plan.neighborMonsterHcIndices.length > 0) {
      neighborPreloadTimer = setTimeout(() => {
        neighborPreloadTimer = null
        if (!inGameView) return
        tileGpuCache.preloadPages(plan.neighborTilePages)
        entityArtCache.preloadEntities({
          monsterClassIds: plan.neighborMonsterHcIndices,
          act: plan.actId,
        })
      }, 120)
    }
  }

  /**
   * Smart lobby preloader (`#1024`): as soon as a character is created or selected in the pre-game
   * lobby (`char_select` / `bnet_lobby`), preload:
   * 1. All 30 class skill icons + universal skill icons (`SkillHotkeysHud` & `SkillTreePanel` shared cache)
   * 2. All 3 skill tree tab background images (`bg_<class>_0..2.png`)
   * 3. The played class' base animation pack (`char-<token>.r8`)
   * 4. The full 13-mode in-game paperdoll WebGL2 atlas (`PlayerPaperdollGpuCache.ensureAppearance`)
   *    using the character's MCP statstring appearance (or 1.13c `CharStats.txt` starter equipment for new heroes).
   */
  const preloadSelectedCharacterAssets = (st: BnetFlowState): void => {
    const selectedChar = st.roster[st.selectedSlotIndex]
    const campfireSpec =
      st.selectedClass !== null ? CAMPFIRE_CLASS_SPECS[st.selectedClass] : undefined
    const classKey = selectedChar?.classId ?? st.selectedClass ?? selectedChar?.heroToken
    const heroToken = selectedChar?.heroToken ?? campfireSpec?.heroToken
    if (!classKey && !heroToken) return
    const sig = `${classKey ?? ''}:${heroToken ?? ''}:${selectedChar?.id ?? ''}:${selectedChar?.avatarDesc?.cofSignature ?? ''}`
    if (sig === lastPreloadedLobbyHeroSig) return
    lastPreloadedLobbyHeroSig = sig

    if (classKey) {
      session.hudManager.preloadForCharacterClass(classKey)
    }
    if (heroToken) {
      ownHeroClassToken = heroToken
      ownHeroArtKicked = true
      void ensureCharacterArt(heroToken)
      const paperdollCache = getPlayerPaperdollGpuCache(renderer)
      if (selectedChar?.avatarDesc?.hasEquippedComponents) {
        const spec = buildAvatarSpecFromStatstring(heroToken, selectedChar.avatarDesc)
        void paperdollCache.ensureAppearance(spec)
      } else {
        const starterEquip = STARTER_EQUIP_BY_HERO_TOKEN[heroToken] ?? {}
        const starterSpec = resolveCharacterAppearance(heroToken, starterEquip)
        void paperdollCache.ensureAppearance(starterSpec)
      }
    }
  }

  settingsStore.subscribe((next, prev) => {
    if (next.viewport !== prev.viewport) {
      syncStageViewportFit(next.viewport)
    }
    if (next.lang !== prev.lang) {
      setLang(next.lang)
      session.hudManager.setLang(next.lang)
      if (!inGameView && frontendRenderer.ready) {
        if (flowState.stage === 'bnet_connecting') {
          setBnetConnectStage(
            flowState,
            flowState.bnetConnectStage ?? 0,
            frontendRenderer.getLocalizedStrings(),
          )
        }
        frontendRenderer.render(performance.now())
      }
    }
    if (next.automapReveal !== prev.automapReveal) {
      session.automapView.setMode(next.automapReveal)
    }
  })

  const syncVisibility = (): void => {
    bnetShell.style.display = inGameView ? 'none' : 'flex'
    if (disconnectBanner) {
      if (session.disconnectReason) {
        disconnectBanner.textContent = session.disconnectReason
        disconnectBanner.hidden = false
      } else {
        disconnectBanner.hidden = true
      }
    }
  }

  const returnToLobby = (): void => {
    inGameView = false
    ownHeroArtKicked = false
    clearPendingNeighborPreload()
    flowState.sceneReady = false
    session.hudManager.setCursorLayerActive(false)
    flowState.stage = 'bnet_lobby'
    flowState.lobbySubPanel = 'create'
    flowState.createGameError = null
    flowState.activeInput = 'gameName'
    flowState.stageTicks = 0
    flowState.doorFrame = 0
    flowState.tickAccumulatorMs = 0
    flowState.lastFrameTimeMs = null
    resetHeroAvatarAnims(flowState)
    session.audioRuntime.playTitleMusic()
    toolbar.setConnectionState({ phase: 'mcp', rttMs: session.pingMs })
    syncVisibility()
    frontendRenderer.render(performance.now())
  }

  /** D2Client victory screen `0x6faf3a70` after S2C `0x61 07`; dismissing it continues to the lobby. */
  const showVictoryScreen = (completion: GameCompletion113c): void => {
    inGameView = false
    ownHeroArtKicked = false
    clearPendingNeighborPreload()
    flowState.sceneReady = false
    session.hudManager.setCursorLayerActive(false)
    flowState.stage = 'end_game'
    flowState.endGame = { nameLine: completion.nameLine, titleLine: completion.titleLine, pressed: false }
    flowState.stageTicks = 0
    flowState.tickAccumulatorMs = 0
    flowState.lastFrameTimeMs = null
    toolbar.setConnectionState({ phase: 'mcp', rttMs: session.pingMs })
    syncVisibility()
    frontendRenderer.render(performance.now())
  }
  frontendRenderer.onEndGameDone = () => {
    returnToLobby()
  }

  let bnetConnectPending = false
  let joinListRefreshSeq = 0
  let joinListRefreshInFlight = false
  let lastJoinListRefreshMs: number | null = null

  const fetchJoinGameDetails = async (st: BnetFlowState, gameName: string): Promise<void> => {
    try {
      const info = await session.getGameInfo(gameName)
      if (st.selectedGameName === gameName && st.lobbySubPanel === 'join') {
        st.selectedGameInfo = info
      }
    } catch (err) {
      if (err instanceof SessionLostError) return
    }
    frontendRenderer.render(performance.now())
  }

  const refreshJoinGameList = async (st: BnetFlowState, nowMs = performance.now()): Promise<void> => {
    const seq = ++joinListRefreshSeq
    joinListRefreshInFlight = true
    lastJoinListRefreshMs = nowMs
    let infoFetchedInThisPass: string | null = null
    const selectedChar = st.roster[st.selectedSlotIndex]
    const flags = selectedChar?.isHardcore ? 0x800 : 0
    try {
      const games = await session.listGames('', {
        flags,
        onGame: (_game, partialGames) => {
          if (seq !== joinListRefreshSeq || st.stage !== 'bnet_lobby' || st.lobbySubPanel !== 'join') {
            return
          }
          const res = applyRealmGamesToFlowState(st, partialGames, { finalized: false })
          frontendRenderer.render(performance.now())
          if (
            res.shouldFetchGameInfo &&
            res.selectedGameName &&
            infoFetchedInThisPass !== res.selectedGameName
          ) {
            infoFetchedInThisPass = res.selectedGameName
            void fetchJoinGameDetails(st, res.selectedGameName)
          }
        },
      })
      if (seq !== joinListRefreshSeq || st.stage !== 'bnet_lobby' || st.lobbySubPanel !== 'join') {
        return
      }
      lastJoinListRefreshMs = performance.now()
      const res = applyRealmGamesToFlowState(st, games, { finalized: true })
      frontendRenderer.render(performance.now())
      if (
        res.shouldFetchGameInfo &&
        res.selectedGameName &&
        infoFetchedInThisPass !== res.selectedGameName
      ) {
        infoFetchedInThisPass = res.selectedGameName
        await fetchJoinGameDetails(st, res.selectedGameName)
      }
    } catch (err) {
      if (err instanceof SessionLostError) return
      if (seq === joinListRefreshSeq) {
        st.lastError = err instanceof Error ? err.message : String(err)
      }
    } finally {
      if (seq === joinListRefreshSeq) {
        joinListRefreshInFlight = false
      }
    }
    frontendRenderer.render(performance.now())
  }

  frontendRenderer.setAsyncHandlers({
    onConnect: async (st) => {
      bnetConnectPending = true
      setBnetConnectStage(st, 0, frontendRenderer.getLocalizedStrings())
      st.lastError = null
      st.loginError = null
      toolbar.setConnectionState({ phase: 'connecting', rttMs: null })
      frontendRenderer.render(performance.now())
      await Promise.resolve()
      if (st.stage !== 'bnet_connecting') {
        bnetConnectPending = false
        return
      }
      setBnetConnectStage(st, 2, frontendRenderer.getLocalizedStrings())
      frontendRenderer.render(performance.now())
      await Promise.resolve()
      if (st.stage === 'bnet_connecting') {
        bnetConnectPending = false
        setBnetConnectStage(st, 3, frontendRenderer.getLocalizedStrings())
        st.statusText = ''
        st.stage = 'bnet_login'
        st.stageTicks = 0
        st.activeInput = st.accountName.trim().length > 0 ? 'accountPassword' : 'accountName'
        frontendRenderer.render(performance.now())
      }
    },
    onLogin: async (st, createNewAccount) => {
      const username = st.accountName.trim()
      const password = st.accountPassword
      if (!username) {
        return
      }
      if (loginInFlight) return
      loginInFlight = true
      const localizedStrings = frontendRenderer.getLocalizedStrings() as unknown as Record<
        string,
        string | undefined
      >
      st.statusText = localizedStrings['5174'] ?? localizedStrings.accessingAccount ?? ''
      st.loginError = null
      st.lastError = null
      frontendRenderer.render(performance.now())
      const targetHost = settingsStore.get().serverHost || 'www.laiseek.xyz'
      try {
        const res = createNewAccount
          ? await session.createAccountAndLogin({ username, password, host: targetHost })
          : await session.login({ username, password, host: targetHost })
        try {
          window.localStorage?.setItem('d2_last_bnet_account', username)
        } catch {
          // Ignore localStorage write errors
        }
        if (res.realms[0]) {
          st.gateway = res.realms[0].title
        }
        st.statusText = ''
        applyOnlineCharactersToFlowState(st, res.characters, {
          stayOnCharSelect: Boolean(createNewAccount),
        })
        preloadSelectedCharacterAssets(st)
      } catch (err) {
        st.statusText = ''
        if (err instanceof BncsCreateAccountError) {
          applyCreateAccountServerError(
            st,
            err.status,
            frontendRenderer.getLocalizedStrings() as unknown as Record<string, unknown>,
          )
        } else if (!(err instanceof SessionLostError)) {
          // A lost session was already routed to the login screen by `onSessionLost`.
          st.loginError = err instanceof Error ? err.message : String(err)
          st.lastError = st.loginError
        }
      } finally {
        loginInFlight = false
      }
      frontendRenderer.render(performance.now())
    },
    onCreateCharacter: async (st) => {
      const name = st.charName.trim()
      if (!name || name.length < 2 || name.length > 15 || !st.selectedClass) {
        return
      }
      st.statusText = ''
      st.charCreateError = null
      st.lastError = null
      frontendRenderer.render(performance.now())
      try {
        const classMap: Record<string, CharClassId> = {
          am: 0,
          so: 1,
          ne: 2,
          pa: 3,
          ba: 4,
          dz: 5,
          as: 6,
        }
        const classId = st.selectedClass === null ? undefined : classMap[st.selectedClass]
        if (classId === undefined) throw new Error(`Unknown selected class ${String(st.selectedClass)}`)
        const chars = await session.createCharacter({
          name,
          classId,
          hardcore: st.isHardcore,
          expansion: st.isExpansion,
          ladder: st.isLadder,
        })
        session.audioRuntime.playTitleMusic()
        applyOnlineCharactersToFlowState(st, chars)
        preloadSelectedCharacterAssets(st)
      } catch (err) {
        if (err instanceof SessionLostError) return
        st.charCreateError = err instanceof Error ? err.message : String(err)
        st.lastError = st.charCreateError
      }
      frontendRenderer.render(performance.now())
    },
    onDeleteCharacter: async (st, charName) => {
      st.statusText = ''
      st.lastError = null
      frontendRenderer.render(performance.now())
      try {
        const chars = await session.deleteCharacter(charName)
        applyOnlineCharactersToFlowState(st, chars)
      } catch (err) {
        if (err instanceof SessionLostError) return
        st.lastError = err instanceof Error ? err.message : String(err)
      }
      frontendRenderer.render(performance.now())
    },
    onConvertCharacter: async (st, charName) => {
      st.statusText = ''
      st.lastError = null
      frontendRenderer.render(performance.now())
      try {
        const chars = await session.convertCharacterToExpansion(charName)
        applyOnlineCharactersToFlowState(st, chars)
      } catch (err) {
        if (err instanceof SessionLostError) return
        st.lastError = err instanceof Error ? err.message : String(err)
      }
      frontendRenderer.render(performance.now())
    },
    onSelectCharacter: async (st) => {
      const selected = st.roster[st.selectedSlotIndex]
      if (!selected) return
      st.statusText = ''
      st.lastError = null
      frontendRenderer.render(performance.now())
      try {
        await session.selectCharacter(selected.name)
        st.stage = 'bnet_lobby'
        st.stageTicks = 0
        resetHeroAvatarAnims(st)
        st.lobbySubPanel = 'create'
        st.createGameError = null
        st.activeInput = 'gameName'
        preloadSelectedCharacterAssets(st)
      } catch (err) {
        if (err instanceof SessionLostError) return
        st.lastError = err instanceof Error ? err.message : String(err)
      }
      frontendRenderer.render(performance.now())
    },
    onListGames: async (st) => {
      st.lobbySubPanel = 'join'
      st.activeInput = 'gameName'
      st.statusText = ''
      st.lastError = null
      frontendRenderer.render(performance.now())
      await refreshJoinGameList(st)
    },
    onSelectJoinGame: async (st, gameName) => {
      st.selectedGameInfo = null
      st.joinGameDetailsScroll = 0
      frontendRenderer.render(performance.now())
      await fetchJoinGameDetails(st, gameName)
    },
    onCreateGame: async (st) => {
      const gameName = st.gameName.trim()
      if (!gameName) {
        return
      }
      const maxPlayers = Number.parseInt(st.maxPlayers.trim(), 10)
      if (!Number.isFinite(maxPlayers) || maxPlayers < 1 || maxPlayers > 8) {
        return
      }
      let levelDiff = 0xff
      if (st.charDifferenceEnabled) {
        const parsedDiff = Number.parseInt(st.charDifference.trim(), 10)
        if (!Number.isFinite(parsedDiff) || parsedDiff < 1 || parsedDiff > 99) {
          return
        }
        levelDiff = parsedDiff
      }
      const selectedChar = st.roster[st.selectedSlotIndex]
      if (selectedChar && !isDifficultyUnlocked(selectedChar, st.difficulty)) {
        throw new Error(
          `Difficulty "${st.difficulty}" is not unlocked for character "${selectedChar.name}" (progression=${selectedChar.progression})`,
        )
      }
      const diffNum: 0 | 1 | 2 =
        st.difficulty === 'hell' ? 2 : st.difficulty === 'nightmare' ? 1 : 0
      st.stage = 'door_loading'
      st.stageTicks = 0
      st.doorFrame = 0
      st.sceneReady = false
      st.createGameError = null
      st.lastError = null
      st.popupModal = null
      st.popup = null
      st.statusText = ''
      frontendRenderer.render(performance.now())
      try {
        await inGameAssetsPromise
        await session.enterGame({
          mode: 'create',
          spec: {
            name: gameName,
            password: st.gamePassword,
            description: st.gameDescription,
            difficulty: diffNum,
            maxPlayers,
            levelDiff,
          },
        })
        st.sceneReady = true
        st.stage = 'in_game'
        st.stageTicks = 0
        st.tickAccumulatorMs = 0
        st.lastFrameTimeMs = null
        inGameView = true
        syncVisibility()
      } catch (err) {
        if (err instanceof SessionLostError) {
          inGameView = false
          ownHeroArtKicked = false
          session.audioRuntime.playTitleMusic()
          returnToLoginAfterSessionLoss(st, err.event.reason)
          syncVisibility()
          frontendRenderer.render(performance.now())
          return
        }
        const friendlyMsg = formatLobbyGameEnterError(
          err,
          selectedChar?.name ?? session.selectedChar,
        )
        session.audioRuntime.playTitleMusic()
        st.stage = 'bnet_lobby'
        st.stageTicks = 0
        st.doorFrame = 0
        st.sceneReady = false
        st.tickAccumulatorMs = 0
        st.lastFrameTimeMs = null
        resetHeroAvatarAnims(st)
        st.createGameError = friendlyMsg
        st.lastError = friendlyMsg
        openPopupModal(st, friendlyMsg, 'bnet_lobby')
        syncVisibility()
        frontendRenderer.render(performance.now())
      }
    },
    onJoinGame: async (st, gameName, gamePassword) => {
      const selectedChar = st.roster[st.selectedSlotIndex]
      st.stage = 'door_loading'
      st.stageTicks = 0
      st.doorFrame = 0
      st.sceneReady = false
      st.createGameError = null
      st.lastError = null
      st.popupModal = null
      st.popup = null
      st.statusText = ''
      frontendRenderer.render(performance.now())
      try {
        await inGameAssetsPromise
        await session.enterGame({
          mode: 'join',
          name: gameName,
          password: gamePassword,
        })
        st.sceneReady = true
        st.stage = 'in_game'
        st.stageTicks = 0
        st.tickAccumulatorMs = 0
        st.lastFrameTimeMs = null
        inGameView = true
        syncVisibility()
      } catch (err) {
        if (err instanceof SessionLostError) {
          inGameView = false
          ownHeroArtKicked = false
          session.audioRuntime.playTitleMusic()
          returnToLoginAfterSessionLoss(st, err.event.reason)
          syncVisibility()
          frontendRenderer.render(performance.now())
          return
        }
        const friendlyMsg = formatLobbyGameEnterError(
          err,
          selectedChar?.name ?? session.selectedChar,
        )
        session.audioRuntime.playTitleMusic()
        st.stage = 'bnet_lobby'
        st.stageTicks = 0
        st.doorFrame = 0
        st.sceneReady = false
        st.tickAccumulatorMs = 0
        st.lastFrameTimeMs = null
        resetHeroAvatarAnims(st)
        st.createGameError = friendlyMsg
        st.lastError = friendlyMsg
        openPopupModal(st, friendlyMsg, 'bnet_lobby')
        syncVisibility()
        frontendRenderer.render(performance.now())
      }
    },
    onSendChat: async (st, text) => {
      try {
        await session.sendLobbyChat(text)
      } catch (err) {
        if (err instanceof SessionLostError) return
        st.lastError = err instanceof Error ? err.message : String(err)
      }
      frontendRenderer.render(performance.now())
    },
  })

  await frontendRenderer.load('/ui/frontend')
  session.audioRuntime.playTitleMusic()
  bootProgress.setStageFloor(100, '主菜单与大厅界面')
  await bootProgress.waitForIdle(200)
  bootProgress.complete()

  // Background streaming of heavy in-game assets (map, HUD, weather, atlases)
  tileGpuCache.ensureActPalette(1)
  const dummyPalette = { rgb: new Uint8Array(768), size: 256 as const }
  const rawAssetsReadyPromise = (async (): Promise<void> => {
    await Promise.all([
      minimap.loadAtlases(renderer).catch((err) => {
        reportMissingArt('automap', 'Automap.dc6', String(err))
      }),
      loadItemsAtlas(renderer)
        .then((h) => {
          itemsAtlasHandle = h
        })
        .catch((err) => {
          reportMissingArt('item', 'items-atlas.png', String(err))
        }),
      loadMonsterArtMap(
        DEFAULT_BASES,
        PRELOAD_MONSTER_IDS,
        dummyPalette,
        renderer,
        '',
        1,
      )
        .then((res) => {
          for (const [k, art] of res.map.entries()) {
            monsterArtMap.set(k.toLowerCase(), art)
            monsterArtMap.set(`token:${art.token.toLowerCase()}`, art)
          }
        })
        .catch((err) => {
          reportMissingArt('monster', 'preload-monsters', String(err))
        }),
      entityArtCache
        .loadIndex()
        .then(async () => {
          for (const npcId of [146, 147, 148, 150, 154, 155]) {
            entityArtCache.getMonsterArt(npcId, 1)
          }
          for (const objId of [17, 26, 39, 119, 267]) {
            entityArtCache.getObjectArt(objId, 1)
          }
          await entityArtCache.waitForInflight()
        })
        .catch((err) => {
          reportMissingArt('entity-index', 'index.json', String(err))
        }),
      loadMissileArtMap(renderer)
        .then((map) => {
          missileArtMap = map
        })
        .catch((err) => {
          reportMissingArt('missile', 'missiles-manifest.json', String(err))
        }),
      loadOverlayArtMap(renderer)
        .then((map) => {
          overlayArtMap = map
        })
        .catch((err) => {
          reportMissingArt('overlay', 'overlays-manifest.json', String(err))
        }),
    ])
  })()

  inGameAssetsPromise = (async (): Promise<void> => {
    const [weatherAssets] = await Promise.all([
      loadWeatherAssetsSafe(),
      mapService.ensureLoaded(),
      hudManager.load('/ui'),
      rawAssetsReadyPromise,
    ])
    if (weatherAssets !== null) {
      session.weather.setAssets(weatherAssets)
    }
  })()

  void inGameAssetsPromise.then(async () => {
    const updatedStatus = await getAssetCacheStatus()
    toolbar.setAssetCacheUsageBytes(updatedStatus.usageBytes)
  })

  // Subscribe to OnlineSession state changes & disconnects
  session.onStateChange(async (snap) => {
    if (snap.phase === 'ingame' || snap.phase === 'replay') {
      await inGameAssetsPromise
      if (session.weather.assets === null) {
        // Attempt background recovery once if initial boot fetch encountered a transient network glitch
        void loadWeatherAssetsSafe().then((recovered) => {
          if (recovered !== null && session.weather.assets === null) {
            session.weather.setAssets(recovered)
          }
        })
      }
      if (session.phase !== 'ingame' && session.phase !== 'replay') return
      session.audioRuntime.prefetchBackground()
      inGameView = true
      flowState.sceneReady = true
      flowState.stage = 'in_game'
      flowState.stageTicks = 0
      flowState.tickAccumulatorMs = 0
      flowState.lastFrameTimeMs = null
      toolbar.setConnectionState({ phase: 'd2gs', rttMs: snap.pingMs })
    } else if (snap.phase === 'lobby') {
      if (inGameView || flowState.stage === 'in_game') {
        const completion = session.takeGameCompletion()
        if (completion?.showVictoryScreen) {
          showVictoryScreen(completion)
          return
        }
        returnToLobby()
        return
      }
      toolbar.setConnectionState({ phase: 'mcp', rttMs: snap.pingMs })
    } else if (snap.phase === 'connecting') {
      toolbar.setConnectionState({ phase: 'connecting', rttMs: null })
    } else if (snap.phase === 'disconnected' || snap.phase === 'error') {
      toolbar.setConnectionState({
        phase: snap.disconnectReason ? 'error' : 'disconnected',
        rttMs: null,
        diagnosticKind: snap.disconnectReason ? 'custom' : 'none',
        diagnosticMessage: snap.disconnectReason ?? undefined,
      })
    }
    syncVisibility()
  })

  session.onChatMessage((entry) => {
    if (inGameView) return
    const lobbyText =
      entry.kind === 'say' && entry.from && !entry.text.startsWith('<')
        ? `<${entry.from}> ${entry.rawText ?? entry.text}`
        : entry.text
    if (!lobbyText) return
    if (flowState.chatMessages[flowState.chatMessages.length - 1] === lobbyText) {
      return
    }
    flowState.chatMessages.push(lobbyText)
    flowState.chatEntries.push({
      text: lobbyText,
      color: entry.color ?? 0,
      kind:
        entry.kind === 'whisper'
          ? 'whisper'
          : entry.kind === 'system'
            ? 'system'
            : 'chat',
    })
    if (flowState.chatMessages.length > 14) {
      flowState.chatMessages.shift()
    }
    if (flowState.chatEntries.length > 14) {
      flowState.chatEntries.shift()
    }
    frontendRenderer.render(performance.now())
  })

  session.onSessionLost((ev) => {
    // Single handler for BNCS/MCP/D2GS loss on every screen: the session already disposed all
    // connections; show the login screen with the reason (no automatic reconnect).
    inGameView = false
    ownHeroArtKicked = false
    clearPendingNeighborPreload()
    session.hudManager.setCursorLayerActive(false)
    session.audioRuntime.playTitleMusic()
    returnToLoginAfterSessionLoss(flowState, ev.reason)
    toolbar.setConnectionState({
      phase: 'error',
      rttMs: null,
      diagnosticKind: 'custom',
      diagnosticMessage: ev.reason,
    })
    syncVisibility()
    frontendRenderer.render(performance.now())
  })

  // Issue #1310: Layered browser gesture, side-button (X1/X2), context-menu, wheel zoom,
  // history back-stack sentinel, and active-session beforeunload protection.
  const gestureGuard = installBrowserGestureGuard({
    stageEl,
    stageWrapperEl,
    workspaceEl,
    isSessionActive: () =>
      inGameView || (session.phase !== 'disconnected' && session.phase !== 'error'),
  })
  bootDisposers.push(() => gestureGuard.dispose())

  // Bind mouse & keyboard input
  const rawToStageCoords = (e: MouseEvent): { readonly x: number; readonly y: number } => {
    const rect = viewCanvas.getBoundingClientRect()
    const profile = getViewportProfile(settingsStore.get().viewport)
    const scaleX = rect.width > 0 ? profile.width / rect.width : 1
    const scaleY = rect.height > 0 ? profile.height / rect.height : 1
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const toStageCoords = (e: MouseEvent): { readonly x: number; readonly y: number } => {
    const profile = getViewportProfile(settingsStore.get().viewport)
    return gestureGuard.resolveStageCoords(e, rawToStageCoords, profile.width, profile.height)
  }

  const toFrontendCoords = (e: MouseEvent): { readonly x: number; readonly y: number } => {
    return gestureGuard.resolveStageCoords(
      e,
      (ev) => frontendRenderer.eventToCanvasCoords(ev),
      800,
      600,
    )
  }

  trackListener(stageEl, 'mousemove', (e: MouseEvent) => {
    if (!inGameView) {
      const pt = toFrontendCoords(e)
      frontendRenderer.handleMouseMove(pt.x, pt.y, performance.now())
      return
    }
    const pt = toStageCoords(e)
    session.commandMapper.handlePointerMove(pt.x, pt.y, performance.now())
  })

  // Issue #1310: When holding LMB/RMB in-game and the cursor slips into the 4:3 pillarbox
  // black bars (`#play-stage-wrapper`) or outside `#play-stage`, keep updating the clamped
  // stage pointer coordinates and ensure releasing the button outside `#play-stage` cleanly
  // ends the hold state.
  trackListener(window, 'mousemove', (e: MouseEvent) => {
    if (!inGameView) return
    if (!session.commandMapper.isPointerDown()) return
    const targetNode = e.target as Node | null
    if (targetNode && typeof stageEl.contains === 'function' && stageEl.contains(targetNode)) {
      return
    }
    const profile = getViewportProfile(settingsStore.get().viewport)
    const raw = rawToStageCoords(e)
    const clampedX = Math.max(0, Math.min(profile.width, raw.x))
    const clampedY = Math.max(0, Math.min(profile.height, raw.y))
    session.commandMapper.handlePointerMove(clampedX, clampedY, performance.now())
  })

  // The victory screen's handler table (D2Client 0x6fba4828) maps WM_RBUTTONDOWN/UP like the left button.
  const isFrontendClickButton = (button: number): boolean =>
    button === 0 || (button === 2 && flowState.stage === 'end_game')

  trackListener(stageEl, 'mousedown', (e: MouseEvent) => {
    session.audioRuntime.unlock()
    if (!inGameView) {
      ;(e as { _d2HandledByCommandMapper?: boolean })._d2HandledByCommandMapper = true
      if (isFrontendClickButton(e.button)) {
        const pt = toFrontendCoords(e)
        frontendRenderer.handleMouseDown(pt.x, pt.y, performance.now())
      }
      return
    }
    if (e.defaultPrevented) return
    ;(e as { _d2HandledByCommandMapper?: boolean })._d2HandledByCommandMapper = true
    const pt = toStageCoords(e)
    session.commandMapper.handlePointerDown(pt.x, pt.y, e.button, performance.now())
    if (session.hudManager.isPointInterceptedByHud(pt.x, pt.y)) {
      e.preventDefault()
    }
  })

  trackListener(stageEl, 'mouseup', (e: MouseEvent) => {
    if (!inGameView) {
      if (isFrontendClickButton(e.button)) {
        const pt = toFrontendCoords(e)
        frontendRenderer.handleMouseUp(pt.x, pt.y, performance.now())
      }
      return
    }
    session.commandMapper.handlePointerUp(e.button)
  })

  trackListener(window, 'mouseup', (e: MouseEvent) => {
    if (!inGameView) return
    if (!session.commandMapper.isPointerDown()) return
    const targetNode = e.target as Node | null
    if (targetNode && typeof stageEl.contains === 'function' && stageEl.contains(targetNode)) {
      return
    }
    session.commandMapper.handlePointerUp(e.button)
  })

  trackListener(stageEl, 'contextmenu', (e: Event) => {
    e.preventDefault()
  })

  trackListener(
    stageEl,
    'wheel',
    (e: WheelEvent) => {
      if (
        !inGameView &&
        (flowState.stage === 'bnet_terms_of_use' ||
          (flowState.stage === 'bnet_lobby' && flowState.lobbySubPanel === 'join'))
      ) {
        e.preventDefault()
        const pt = frontendRenderer.eventToCanvasCoords(e)
        frontendRenderer.handleWheel(e.deltaY, pt.x, pt.y)
        frontendRenderer.render(performance.now())
      } else if (inGameView && session?.hudManager) {
        if ((e as { _d2WheelHandled?: boolean })._d2WheelHandled) {
          return
        }
        if (session.hudManager.handleWheel(e.deltaY)) {
          ;(e as { _d2WheelHandled?: boolean })._d2WheelHandled = true
          e.preventDefault()
        }
      }
    },
    { passive: false },
  )

  // Capture-phase keydown listener so pre-game text inputs and CommandMapper hotkeys
  // do not double-trigger HudManager's bubble-phase listener.
  trackListener(
    window,
    'keydown',
    (e: KeyboardEvent) => {
      session.audioRuntime.unlock()
      if (isModalDomOverlayOpen()) {
        return
      }
      const activeEl = document.activeElement
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.tagName === 'TEXTAREA')
      ) {
        return
      }
      if (!inGameView) {
        e.stopImmediatePropagation()
        frontendRenderer.handleKeyDown(e)
        return
      }
      const handled = session.commandMapper.handleKeyDown(e, performance.now())
      if (handled) {
        e.stopImmediatePropagation()
      }
    },
    true,
  )

  trackListener(
    window,
    'keyup',
    (e: KeyboardEvent) => {
      if (isModalDomOverlayOpen()) {
        return
      }
      if (inGameView) {
        session.commandMapper.handleKeyUp(e)
      }
    },
    true,
  )

  trackListener(window, 'blur', () => {
    if (inGameView) {
      session.commandMapper.resetModifiers()
      session.commandMapper.handlePointerUp(0)
      session.commandMapper.handlePointerUp(2)
    }
  })

  // D2Client 1.13c tick schedule (`LogicClock`, 0x6FAF4C6F..0x6FAF4D79): owed 40 ms ticks are
  // all run before the frame is drawn, with no frame-time clamp dropping simulated time.
  let logicClockRunning = false
  const runOwedLogicTicks = (nowMs: number): void => {
    if (!logicClockRunning) {
      session.logicClock.reset(nowMs)
      logicClockRunning = true
    }
    runOwedTicks(session.logicClock, nowMs, (dtMs, tickNowMs) => {
      session.tick(dtMs, tickNowMs)
    })
  }

  // The original keeps looping while its window is inactive (at most a `Sleep(10)` per pass,
  // `push 0xa ; call [Sleep]` @0x6FAECB94). Hidden tabs get no requestAnimationFrame, so a
  // timer runs the owed ticks until the tab is visible again.
  let hiddenTickTimer: ReturnType<typeof setInterval> | null = null
  let nextWorldRenderMs: number | null = null
  trackListener(document, 'visibilitychange', () => {
    if (document.hidden) {
      if (hiddenTickTimer === null) {
        hiddenTickTimer = setInterval(() => {
          if (inGameView) {
            runOwedLogicTicks(performance.now())
          } else {
            logicClockRunning = false
            session.audioRuntime.uiTick(1)
          }
        }, D2_LOGIC_TICK_MS)
      }
    } else if (hiddenTickTimer !== null) {
      clearInterval(hiddenTickTimer)
      hiddenTickTimer = null
    }
  })

  const renderFrame = (nowMs = performance.now()): void => {
    if (!inGameView) {
      logicClockRunning = false
      const flowTicks = stepFlowFrame(flowState, nowMs)
      if (flowTicks > 0) {
        session.audioRuntime.uiTick(flowTicks)
      }
      if (bnetConnectPending && flowState.stage === 'bnet_connecting' && flowState.stageTicks >= 1) {
        bnetConnectPending = false
        ;(flowState as { bnetConnectStage?: number }).bnetConnectStage = 3
        flowState.statusText = ''
        flowState.stage = 'bnet_login'
        flowState.stageTicks = 0
        flowState.activeInput =
          flowState.accountName.trim().length > 0 ? 'accountPassword' : 'accountName'
      }
      if (flowState.stage === 'char_select' || flowState.stage === 'bnet_lobby') {
        preloadSelectedCharacterAssets(flowState)
      }
      if (flowState.stage === 'bnet_lobby' && flowState.lobbySubPanel === 'join') {
        if (
          !joinListRefreshInFlight &&
          (lastJoinListRefreshMs === null ||
            nowMs - lastJoinListRefreshMs >= JOIN_GAME_LIST_REFRESH_INTERVAL_MS)
        ) {
          lastJoinListRefreshMs = nowMs
          void refreshJoinGameList(flowState, nowMs)
        }
      } else {
        lastJoinListRefreshMs = null
      }
      if (flowState.stage === 'in_game' && (session.phase === 'ingame' || session.phase === 'replay')) {
        inGameView = true
        flowState.tickAccumulatorMs = 0
        flowState.lastFrameTimeMs = null
        syncVisibility()
      } else {
        frontendRenderer.render(nowMs)
        return
      }
    } else {
      flowState.tickAccumulatorMs = 0
      flowState.lastFrameTimeMs = null
    }

    // Kick the played class' `char-<token>.r8` exactly once per level entry so
    // the own hero's fallback art is ready when the world becomes visible
    // (units with equipment appearance use the paperdoll compositor instead).
    if (inGameView && !ownHeroArtKicked) {
      ownHeroArtKicked = true
      const campfireSpec = flowState.selectedClass !== null
        ? CAMPFIRE_CLASS_SPECS[flowState.selectedClass]
        : undefined
      const rosterChar = flowState.roster[flowState.selectedSlotIndex]
      const ownHeroToken: string | undefined =
        campfireSpec?.heroToken ?? rosterChar?.heroToken
      if (ownHeroToken !== undefined) {
        ownHeroClassToken = ownHeroToken
        void ensureCharacterArt(ownHeroToken)
      }
    }

    runOwedLogicTicks(nowMs)
    motionSmoother.beginFrame(nowMs)
    preloadActiveAreaAssets()
    sweepStaleCharacterArt(nowMs)

    // World render-rate cap (settings `worldRenderFps`: 60 = uncapped, 30 = ~half
    // the GPU raster). While capped, the 25Hz logic above keeps running untouched;
    // only the world+HUD draw is postponed.
    const worldRenderFpsCap = settingsStore.get().worldRenderFps === 30 ? 30 : 0
    if (worldRenderFpsCap > 0) {
      const frameMs = 1000 / worldRenderFpsCap
      if (nextWorldRenderMs !== null && nowMs < nextWorldRenderMs - 2) return
      nextWorldRenderMs = nextWorldRenderMs === null || nowMs - nextWorldRenderMs > frameMs ? nowMs + frameMs : nextWorldRenderMs + frameMs
    } else nextWorldRenderMs = null
    const currentSettings = settingsStore.get()
    const profile = getViewportProfile(currentSettings.viewport)
    renderer.setSceneViewportSize(profile.width, profile.height)

    const dpr =
      typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
        ? Math.min(window.devicePixelRatio, 2)
        : 1
    const cssW = viewCanvas.clientWidth > 0 ? viewCanvas.clientWidth : profile.width
    const cssH = viewCanvas.clientHeight > 0 ? viewCanvas.clientHeight : profile.height
    const useUpscaledBackbuffer =
      renderer.getDataMode() === 'pd2' &&
      renderer.isPostProcessEnabled() &&
      viewCanvas.clientWidth > 0 &&
      viewCanvas.clientHeight > 0
    if (useUpscaledBackbuffer) {
      const targetCanvasW = Math.max(profile.width, Math.round(cssW * dpr))
      const targetCanvasH = Math.max(profile.height, Math.round(cssH * dpr))
      if (viewCanvas.width !== targetCanvasW || viewCanvas.height !== targetCanvasH) {
        viewCanvas.width = targetCanvasW
        viewCanvas.height = targetCanvasH
      }
    }
    renderer.pixelScale = useUpscaledBackbuffer ? 1 : syncCrispBackingStore(viewCanvas, profile.width, profile.height)

    lastRenderSnapshot = renderSceneSourceFrame({
      source: session.sceneSource,
      lightingPreset: currentSettings.lightingPreset,
      lightingTargets: { lightGrid, renderer, lightQuality: currentSettings.lightQuality, nowMs },
      renderer,
      tileGpuCache,
      entityArtCache,
      characterArtByToken,
      ensureCharacterArt,
      noteCharacterArtUse,
      monsterArtMap,
      missileArtMap,
      overlayArtMap,
      itemsAtlasHandle,
      minimap,
      automapView: session.automapView,
      hudManager: session.hudManager,
      weather: weatherPass,
      nowMs,
    })
    // 1.13c FPS counter 0x6fb0a9a0 (called at 0x6faf4392): after the draw and the UI.
    // The weather driver of this frame read the value of the previous frames.
    fpsCounter.frame(Math.floor(performance.now()))
    session.hudManager.currentFps = fpsCounter.fps
    session.hudManager.pingMs = session.pingMs
    // 1.13c D2Client.dll 0x6faf4ea0 (`call D2Sound.#10035` SOUND_Tick): runs once per in-game render frame.
    if (lastRenderSnapshot.worldReady) {
      session.audioRuntime.soundTick(lastRenderSnapshot.tick)
    } else {
      session.audioRuntime.uiTick(1)
    }
  }

  // #954: `controller.dispose()` stops this boot's rAF self-scheduling so a
  // re-boot does not keep stepping the retired flowState/session.
  let renderLoopDisposed = false
  const loop = (now: number): void => {
    if (renderLoopDisposed) return
    requestAnimationFrame(loop)
    renderFrame(now)
  }
  renderFrame(performance.now())
  requestAnimationFrame(loop)

  await plugins.whenStarted()

  const controller: PlayAppController = {
    ready: true,
    bootProgress: bootProgress.getSnapshot(),
    bootProgressTracker: bootProgress,
    settings: settingsStore,
    settingsStore,
    session,
    plugins,
    pluginMenu,
    toolbar,
    hudManager: session.hudManager,
    hudModel: session.hudModel,
    commandMapper: session.commandMapper,
    gestureGuard,
    flowState,
    frontendRenderer,
    renderer,
    tileGpuCache,
    entityArtCache,
    lightGrid,
    minimap,
    assetsReadyPromise: inGameAssetsPromise,
    getLastRenderSnapshot: () => lastRenderSnapshot,
    dispose: (): void => {
      renderLoopDisposed = true
      clearPendingNeighborPreload()
      if (hiddenTickTimer !== null) {
        clearInterval(hiddenTickTimer)
        hiddenTickTimer = null
      }
      hudManager.dispose()
      for (const disposeOne of bootDisposers) disposeOne()
      chatInputEl.remove()
      toolbar.destroy()
      void plugins.destroy().catch(() => {
        // Best-effort teardown; plugin disposers already ran individually.
      })
    },
    isInGameView: () => inGameView,
    returnToLobby,
    sendChat: (message: string): void => {
      session.submitChatInput(message)
    },
    replayD2Cap: (jsonlText: string): number => {
      inGameView = true
      const count = session.loadD2CapReplay(jsonlText)
      session.replayAllD2Cap()
      syncVisibility()
      renderFrame(performance.now())
      return count
    },
    simulateDisconnect: async (reason = 'Lost connection to Battle.net / D2GS'): Promise<void> => {
      await session.disconnect(reason)
      syncVisibility()
      renderFrame(performance.now())
    },
    renderFrame,
  }

  window.__d2PlayApp = controller
  window.__d2Play = controller
  return controller
}
