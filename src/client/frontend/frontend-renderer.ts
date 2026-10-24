/**
 * Diablo II v1.13c Authentic Front-End & Battle.net 800x600 Canvas Renderer (`src/frontend/frontend-renderer.ts`).
 *
 * Renders all 6 pre-game stages using 100% original English MPQ assets packed into `/ui/frontend/`:
 * - Stage 1 (`main_menu`):       `gameselectscreenEXP.dc6` + 2-layer additive burning D2 logo + engraved buttons
 * - Stage 2 (`bnet_connecting`): `PopUp_340x224.dc6` modal over `gameselectscreenEXP.dc6`
 * - Stage 2b (`bnet_login`):     Battle.net Account Name & Password login screen
 * - Stage 3 (`char_create`):     7-Class Campfire (`charactercreationscreenEXP.dc6` + `fire.dc6` + 7 class state machines)
 * - Stage 4 (`char_select`):     8-Slot Character Selection Roster (`characterselectscreenEXP.dc6` + `TN` avatars)
 * - Stage 5 (`bnet_lobby`):      Battle.net Lobby, Chat Gem (`gembutton.dc6`), and `Create Game` panel (`creategamebckg.dc6`)
 * - Stage 6 (`door_loading`):    10-Frame Dark Wanderer Door Opening Loading Screen (`Loadingscreen.dc6`)
 */

import { CursorController } from '../ui/cursor.ts'
import { syncCrispBackingStore } from '../view/crisp-scale.ts'
import type { FontAtlasMeta } from '../ui/font.ts'
import { SharedAssetPool } from '../multibox/shared-asset-pool.ts'
import {
  CAMPFIRE_CLASS_ORDER,
  CAMPFIRE_FLAME_CONTROL_SPEC,
  CANONICAL_FRONTEND_STRINGS_CHI,
  D2LAUNCH_CONTROL_RECORDS,
  D2MULTI_CONTROL_RECORDS,
  HERO_TOKENS,
  agreeTermsOfUse,
  backspaceCreateAccountChar,
  canAcceptCharNameChar,
  canSubmitCreateGame,
  canSubmitJoinGame,
  cancelConnecting,
  cancelCreateAccount,
  cancelPleaseRead,
  clickBattleNetButton,
  clickSinglePlayerButton,
  computeCharacterExpirationDays,
  confirmCharacterSelect,
  cycleCreateAccountFocus,
  disagreeTermsOfUse,
  dismissPopupModal,
  enterCharCreate,
  formatCharacterExpirationText,
  formatCharacterLevelAndClass,
  formatJoinGameDetailLines,
  getAnimImageLoopFrame,
  getCampfireSlotHitBox,
  hoverCampfireClass,
  isChiFrontendActive,
  isDifficultyUnlocked,
  isValidAccountChar,
  isValidCharacterName,
  openTermsOfUse,
  parseMcpAvatarStatstring,
  recordRecentRealmGameName,
  resetHeroAvatarAnims,
  resolveBnetConnectStageText,
  resolveStringByTblId,
  scrollTermsOfUse,
  selectCampfireClass,
  submitBattleNetLogin,
  submitCharacterCreate,
  submitCreateAccountForm,
  submitCreateGame,
  toggleChatGem,
  typeCreateAccountChar,
  type ActiveInputField,
  type BnetFlowState,
  type CampfireAnimPhase,
  type CampfireClassId,
  type GameDifficulty,
  type RosterCharacter,
} from './flow-state.ts'
import {
  ensureAvatarComposite,
  getReadyAvatarComposite,
} from './avatar-compositor.ts'

export interface PackedAnimFrame {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly anchorX: number
  readonly anchorY: number
}

export interface PackedAnimStripMeta {
  readonly file: string
  readonly width: number
  readonly height: number
  readonly frameCount: number
  readonly rate?: number | undefined
  readonly animRate?: number | undefined
  /** `D2Gdi` drawMode (`5` = `DRAWMODE_NORMAL` opaque, `3` = `DRAWMODE_MODULATE` screen/additive). */
  readonly drawMode?: number | undefined
  readonly frames: readonly PackedAnimFrame[]
}

/**
 * Required secondary overlay strips per campfire class and phase (`D2Launch.dll` @ `0x6fa5d236`, `0x6fa5d328`, `0x6fa5d4d5`, `0x6fa5d5b3`).
 */
export const CAMPFIRE_OVERLAY_SPECS: Readonly<
  Partial<
    Record<
      CampfireClassId,
      Readonly<
        Partial<Record<CampfireAnimPhase, { readonly stripKey: string; readonly drawMode: 3 | 5 }>>
      >
    >
  >
> = {
  ba: {
    fw: { stripKey: 'fw_ov', drawMode: 5 },
  },
  pa: {
    fw: { stripKey: 'fw_ov', drawMode: 5 },
  },
  ne: {
    nu3: { stripKey: 'nu3_ov', drawMode: 3 },
    fw: { stripKey: 'fw_ov', drawMode: 3 },
    bw: { stripKey: 'bw_ov', drawMode: 3 },
  },
  so: {
    nu3: { stripKey: 'nu3_ov', drawMode: 3 },
    fw: { stripKey: 'fw_ov', drawMode: 3 },
    bw: { stripKey: 'bw_ov', drawMode: 3 },
  },
} as const

export interface FrontendManifest {
  readonly version: string
  readonly decodedDc6Count: number
  readonly animStrips: Record<string, PackedAnimStripMeta>
  readonly campfireClasses: Record<string, Record<string, PackedAnimStripMeta>>
  readonly charAvatars: Record<string, PackedAnimStripMeta>
  readonly fontColors: readonly number[]
  readonly strings: {
    readonly singlePlayer: string
    readonly battleNet: string
    readonly otherMultiplayer: string
    readonly exitDiablo2: string
    readonly credits: string
    readonly cinematics: string
    readonly gatewayPrefix: string
    readonly connectingToFastest?: string
    readonly connectingToFastestServer?: string
    readonly checkingVersions: string
    readonly accessingAccount?: string
    readonly accessingYourAccount?: string
    readonly connected?: string
    readonly sendingLoginInformation?: string
    readonly waitingForReply?: string
    readonly disconnecting?: string
    readonly loginTitle?: string
    readonly loginInstruction?: string
    readonly accountName: string
    readonly password: string
    readonly verifyPassword?: string
    readonly logIn: string
    readonly accountSettings: string
    readonly createNewAccount: string
    readonly createAccountTitle?: string
    readonly createBnetAccountTitle?: string
    readonly createAccountSubtitle?: string
    readonly createAccountInstruction?: string
    readonly writeDownPasswordWarning?: string
    readonly termsOfUseTitle?: string
    readonly agree?: string
    readonly disagree?: string
    readonly dontAgree?: string
    readonly pleaseReadTitle?: string
    readonly pleaseReadLine1?: string
    readonly pleaseReadLine2?: string
    readonly longPasswordWarning?: string
    readonly pleaseReadPara1?: string
    readonly pleaseReadPara2?: string
    readonly pleaseReadPara3?: string
    readonly unableToCreateAccount?: string
    readonly termsOfUseText?: string
    readonly exit: string
    readonly ok: string
    readonly cancel: string
    readonly chooseClassTitle: string
    readonly characterName: string
    readonly expansionCharacter: string
    readonly hardcore: string
    readonly ladderCharacter: string
    readonly selectCharacterTitle: string
    readonly createNewCharacter: string
    readonly convertToExpansion: string
    readonly deleteCharacter: string
    readonly expiresToday?: string
    readonly expiresInDays?: string
    readonly characterExpired?: string
    readonly classes: Record<CampfireClassId, { readonly name: string; readonly desc: string }>
    readonly lobby: {
      readonly send: string
      readonly whisper: string
      readonly help: string
      readonly squelch: string
      readonly unsquelch: string
      readonly emote: string
      readonly create: string
      readonly join: string
      readonly ladder: string
      readonly channel: string
      readonly quit: string
      readonly createGameTitle: string
      readonly joinGameTitle?: string
      readonly joinGameBtn?: string
      readonly joinGameListHeader?: string
      readonly gameName: string
      readonly gamePassword: string
      readonly gameDescription: string
      readonly maxPlayers: string
      readonly charDifference: string
      readonly selectDifficulty: string
      readonly normal: string
      readonly nightmare: string
      readonly hell: string
      readonly createGameBtn: string
      readonly gemActivated: string
      readonly gemDeactivated: string
      readonly perfectGemActivated?: string
    }
    readonly [tblId: string]: unknown
  }
}

export type FrontendFontName =
  | 'font6'
  | 'font8'
  | 'font16'
  | 'font24'
  | 'font30'
  | 'font42'
  | 'fontexocet8'
  | 'fontexocet10'
  | 'fontformal10'
  | 'fontformal11'
  | 'fontformal12'
  | 'fontridiculous'

/**
 * PL2 text color indices (`D2Gfx_DrawChar` 0x6f876580..0x6f87658f):
 * 0 = White, 1 = Red, 2 = Green, 3 = Blue, 4 = Gold, 5 = DarkGray, 7 = Tan, 8 = Orange, 9 = Yellow
 */
export type FrontendColorIndex = 0 | 1 | 2 | 3 | 4 | 5 | 7 | 8 | 9

export interface UiButtonDef {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  readonly sprite: string
  readonly label?: string
  readonly font?: FrontendFontName
  readonly color?: FrontendColorIndex
  readonly disabled?: boolean
  readonly disabledFrameOffset?: number
  readonly onClick: () => void
}

/**
 * Victory screen (D2Client.dll `0x6faf3a70`) assets, all baked with `data\global\palette\endgame2\pal.pl2`
 * (the screen loads `Palette\<bg name>\pal.dat/pal.pl2` through D2Win #10128 at `0x6faf3b62`).
 */
export const END_GAME_UI_IMAGES_113C = [
  'endgame/endgame2.png',
  'endgame/endgameok.png',
  'endgame/font42-c4.png',
  'endgame/font16-c0.png',
] as const

/**
 * Expansion-game layout of `0x6faf3a70` (`0x6fbc9854 != 0`; the LastPortal only exists in Act V, so the
 * classic `endgame.dc6` / 640x480 branch with string 5099 never follows S2C `0x61 07`).
 * Text `y` values are D2Win #10150 bottoms; the OK button is a bottom-anchored DC6 cell.
 */
export const END_GAME_LAYOUT_113C = {
  /** 5098 "Congratulations!", Font42 gold (`0x6faf3738`). */
  congratsBottom: 100,
  /** Character name, Font42 gold (`0x6faf2cf3`). */
  nameBottom: 187,
  /** 5100 "Will Henceforth Be Known As", Font42 gold (`0x6faf379c`). */
  knownAsBottom: 272,
  /** Title + name, Font42 gold (`0x6faf2e47`). */
  titleBottom: 357,
  /** `endgameok.dc6` at (w/2 - 0x30, h - 0x50) (`0x6faf3ea4..0x6faf3ead`); 96x32 frames, frame 1 = pressed. */
  okX: 400 - 0x30,
  okBottom: 600 - 0x50,
  okW: 96,
  okH: 32,
  /** 5102 "OK", Font16 white at y_bottom h - 0x58, shifted (-2, +2) while pressed (`0x6faf3ee6..0x6faf3ef2`). */
  okLabelBottom: 600 - 0x58,
} as const

const STATIC_UI_IMAGES = [
  'bg-main-menu.png',
  'bg-char-create.png',
  'bg-char-select.png',
  'bg-waiting-room.png',
  'popup-340x224.png',
  'popup-okcancel.png',
  'terms-of-use-bg.png',
  'scrollbar.png',
  'btn-popup-small.png',
  'create-game-bg.png',
  'join-game-bg.png',
  'charselectbox.png',
  'realmselect.png',
  'btn-realm-thin.png',
  'btn-wide.png',
  'btn-3wide.png',
  'btn-wide02.png',
  'btn-medium.png',
  'btn-short.png',
  'btn-tall.png',
  'textbox.png',
  'clickbox.png',
  'joingameclickbox.png',
  'radiobutton.png',
  'gembutton.png',
  'btn-chatleft.png',
  'btn-chatrighttop.png',
  'btn-chatright.png',
  'btn-game.png',
  'btn-create-cancel.png',
  'btn-create-game.png',
  'grey-level-box.png',
  'logo-main-black.png',
  'logo-main-fire.png',
  'logo-bnet-black.png',
  'logo-bnet-fire.png',
  'campfire/fire-strip.png',
  'loading-door-strip.png',
  ...END_GAME_UI_IMAGES_113C,
] as const

export interface FrontendAsyncHandlers {
  readonly onSinglePlayer?: ((state: BnetFlowState) => Promise<void> | void) | undefined
  readonly onConnect?: ((state: BnetFlowState) => Promise<void> | void) | undefined
  readonly onLogin?: ((state: BnetFlowState, createNewAccount: boolean) => Promise<void> | void) | undefined
  readonly onCreateCharacter?: ((state: BnetFlowState) => Promise<void> | void) | undefined
  readonly onSelectCharacter?: ((state: BnetFlowState) => Promise<void> | void) | undefined
  readonly onDeleteCharacter?: ((state: BnetFlowState, charName: string) => Promise<void> | void) | undefined
  readonly onConvertCharacter?: ((state: BnetFlowState, charName: string) => Promise<void> | void) | undefined
  readonly onListGames?: ((state: BnetFlowState) => Promise<void> | void) | undefined
  readonly onSelectJoinGame?: ((state: BnetFlowState, gameName: string) => Promise<void> | void) | undefined
  readonly onTypeJoinGameName?: ((state: BnetFlowState, gameName: string) => Promise<void> | void) | undefined
  readonly onCreateGame?: ((state: BnetFlowState) => Promise<void> | void) | undefined
  readonly onJoinGame?: ((state: BnetFlowState, gameName: string, gamePassword: string) => Promise<void> | void) | undefined
  readonly onSendChat?: ((state: BnetFlowState, message: string) => Promise<void> | void) | undefined
}

/**
 * Front-end stages whose rendering is driven by the 25Hz flow tick — DCC anim
 * strips (burning logo, campfires, hero avatars, door loading) or tick-driven
 * status text. Only these need a redraw whenever `globalTick` advances;
 * static form screens (login, terms of use, ...) do not.
 */
const TICK_ANIMATED_STAGES: ReadonlySet<string> = new Set([
  'main_menu',
  'bnet_connecting',
  'char_select',
  'char_create',
  'bnet_lobby',
  'door_loading',
  'in_game',
])

/** Volatile inputs that can change a rendered menu frame. */
export interface MenuFrameDirtySignal {
  readonly stage?: string
  readonly tick: number
  readonly mouseX: number
  readonly mouseY: number
  readonly inputVersion: number
  /** Text-input caret blink phase: `Math.floor(nowMs / 250)` (matches the caret draw). */
  readonly blinkPhase: number
  /** Whether the current stage renders tick-driven animation. */
  readonly stageAnimates: boolean
}

/**
 * On-demand menu rendering: the front-end canvas used to repaint the whole
 * 800x600 scene on every `requestAnimationFrame` (~61/s measured) even though
 * the fastest visual change is the 25Hz flow tick, and idle menus are fully
 * static. A frame is drawn only when something the scene depends on changed:
 * - any stage transition (`stage`),
 * - any input (keys/clicks/wheel — `inputVersion`),
 * - mouse movement (hover states + software cursor),
 * - the caret blink phase (`Math.floor(nowMs / 250)`, mirrors the draw at the
 *   `activeInput` caret),
 * - a flow tick, but only on tick-animated stages,
 * - a 250ms heartbeat catching async state writes done outside the renderer
 *   (lobby game lists, chat lines, realm status text).
 */
export function shouldRenderMenuFrame(
  prev: MenuFrameDirtySignal | null,
  next: MenuFrameDirtySignal,
  nowMs: number,
  lastRenderMs: number | null,
  heartbeatMs = 250,
): boolean {
  if (prev === null) return true
  if (next.stage !== prev.stage) return true
  if (next.inputVersion !== prev.inputVersion) return true
  if (next.mouseX !== prev.mouseX || next.mouseY !== prev.mouseY) return true
  if (next.blinkPhase !== prev.blinkPhase) return true
  if (next.stageAnimates && next.tick !== prev.tick) return true
  if (lastRenderMs === null || nowMs - lastRenderMs >= heartbeatMs) return true
  return false
}

export class FrontendRenderer {
  readonly canvas: HTMLCanvasElement
  readonly ctx: CanvasRenderingContext2D
  readonly state: BnetFlowState
  readonly cursor = new CursorController()

  manifest: FrontendManifest | null = null
  fontMetas: Record<string, FontAtlasMeta> = {}
  images = new Map<string, HTMLImageElement>()
  cursorAtlas: HTMLImageElement | null = null
  pressedButtonId: string | null = null
  lastClickSlotTime = 0
  lastClickSlotIndex = -1
  lastClickJoinGameTime = 0
  lastClickJoinGameName = ''
  lastMouseX = 400
  lastMouseY = 300
  lastRenderNowMs = 0
  ready = false
  /** Bumped by every input entry point (keys/clicks/wheel) for on-demand menu rendering. */
  private inputVersion = 0
  private lastMenuFrameSignal: MenuFrameDirtySignal | null = null
  private lastMenuFrameRenderMs: number | null = null
  private renderedMenuFrameOnce = false

  /** Callback invoked when Stage 6 (`door_loading`) begins so `bnet-main.ts` can boot Act 1 in background. */
  onEnterDoorLoading?: (state: BnetFlowState) => void
  /** Called when the victory screen (`end_game`) is dismissed (OK released inside the button or any key). */
  onEndGameDone?: (state: BnetFlowState) => void
  /**
   * 1.13c UI button & control sound callback (`D2Win.dll` `Button_OnMouseUp` / `0x6f8ef6f0` ->
   * `D2Client` / `D2Launch` `PlaySound(4)` `cursor_button_click` `cursor\button.wav`).
   */
  onPlaySound?: (soundId: number) => void
  /**
   * Callback invoked whenever active keyboard focus changes (e.g. editbox clicked/tabbed/cleared).
   * When `focusSink` is false, the IME sink updates its value/bounds and blurs without opening the soft keyboard.
   */
  onActiveInputChange?: (field: ActiveInputField, focusSink?: boolean) => void
  onRenderSync?: () => void
  asyncHandlers: FrontendAsyncHandlers | null = null

  constructor(canvas: HTMLCanvasElement, state: BnetFlowState) {
    this.canvas = canvas
    if (this.canvas && this.canvas.style) {
      this.canvas.style.cursor = 'none'
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to acquire 2D context for bnet-canvas')
    ctx.imageSmoothingEnabled = false
    this.ctx = ctx
    this.state = state
    this.cursor.handleMouseMove(400, 300)
  }

  setAsyncHandlers(handlers: FrontendAsyncHandlers | null): void {
    this.asyncHandlers = handlers
  }

  markDirty(): void {
    this.inputVersion += 1
  }

  getActiveInput(): ActiveInputField {
    return this.state.activeInput
  }

  setActiveInput(field: ActiveInputField, focusSink = true): void {
    const changed = this.state.activeInput !== field
    this.state.activeInput = field
    this.markDirty()
    if (!focusSink) {
      this.onActiveInputChange?.(field, false)
    } else if (changed || field !== null) {
      this.onActiveInputChange?.(field)
    }
  }

  blurImeSink(): void {
    this.onActiveInputChange?.(this.state.activeInput, false)
  }

  getActiveInputBounds(field: ActiveInputField = this.state.activeInput): {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  } | null {
    if (!field) return null

    if (this.state.stage === 'bnet_login') {
      if (field === 'accountName' || field === 'bnet_account') {
        return { x: 278, y: 316, width: 243, height: 31 }
      }
      if (field === 'accountPassword' || field === 'bnet_password') {
        return { x: 278, y: 376, width: 243, height: 31 }
      }
    }

    if (this.state.stage === 'bnet_create_account') {
      if (field === 'accountName' || field === 'bnet_account') {
        return { x: 278, y: 318, width: 243, height: 34 }
      }
      if (field === 'accountPassword' || field === 'bnet_password') {
        return { x: 278, y: 372, width: 243, height: 39 }
      }
      if (field === 'accountVerifyPassword' || field === 'bnet_verify_password') {
        return { x: 278, y: 426, width: 243, height: 45 }
      }
    }

    if (this.state.stage === 'char_create') {
      if (field === 'charName') {
        return { x: 318, y: 485, width: 175, height: 28 }
      }
    }

    if (this.state.stage === 'bnet_lobby') {
      if (field === 'chatInput') {
        return { x: 28, y: 418, width: 335, height: 28 }
      }
      if (this.state.lobbySubPanel === 'join') {
        if (field === 'gameName') {
          return { x: 425, y: 123, width: 167, height: 25 }
        }
        if (field === 'gamePassword') {
          return { x: 599, y: 123, width: 168, height: 25 }
        }
      } else if (this.state.lobbySubPanel === 'create') {
        if (field === 'gameName') {
          return { x: 427, y: 137, width: 188, height: 25 }
        }
        if (field === 'gamePassword') {
          return { x: 427, y: 191, width: 188, height: 25 }
        }
        if (field === 'gameDescription') {
          return { x: 427, y: 245, width: 342, height: 25 }
        }
        if (field === 'maxPlayers') {
          return { x: 655, y: 278, width: 42, height: 29 }
        }
        if (field === 'charDifference') {
          return { x: 650, y: 313, width: 55, height: 33 }
        }
      }
    }

    return null
  }

  getLocalizedStrings(): FrontendManifest['strings'] {
    if (!this.manifest) {
      throw new Error('Cannot access frontend strings: manifest is not loaded')
    }
    if (isChiFrontendActive()) {
      return CANONICAL_FRONTEND_STRINGS_CHI as unknown as FrontendManifest['strings']
    }
    return this.manifest.strings
  }

  private requireStr(tblId: number, keyFallback?: string): string {
    if (!this.manifest) {
      throw new Error(`Cannot resolve .tbl string #${tblId}: manifest is not loaded`)
    }
    return resolveStringByTblId(
      this.getLocalizedStrings() as unknown as Record<string, unknown>,
      tblId,
      keyFallback,
    )
  }

  private async loadImage(url: string, key: string): Promise<void> {
    const img = await SharedAssetPool.getGlobal().loadImage(url)
    if (!img) {
      throw new Error(`Failed to load frontend image: ${url}`)
    }
    this.images.set(key, img)
  }

  async load(baseUrl = '/ui/frontend'): Promise<void> {
    const pool = SharedAssetPool.getGlobal()
    const [manifest, fontMetas] = await Promise.all([
      pool.fetchJson<FrontendManifest>(`${baseUrl}/manifest.json`),
      pool.fetchJson<Record<string, FontAtlasMeta>>(`${baseUrl}/fonts/metrics.json`),
    ])

    this.manifest = manifest
    this.fontMetas = fontMetas

    // Synchronize frame counts, playback rates, and frame-0 bounds from manifest into flow state; fail fast if missing.
    for (const id of CAMPFIRE_CLASS_ORDER) {
      const clsStrips = this.manifest.campfireClasses[id]
      if (!clsStrips) {
        throw new Error(`Missing campfire class strips for "${id}" in manifest.json`)
      }
      const slot = this.state.campfireClasses[id]
      for (const phase of ['nu1', 'nu2', 'fw', 'nu3', 'bw'] as const) {
        const strip = clsStrips[phase]
        if (!strip || strip.frames.length === 0) {
          throw new Error(`Missing campfire phase strip "${id}.${phase}" in manifest.json`)
        }
        slot.frameCount[phase] = strip.frameCount
        if (typeof strip.rate === 'number' && strip.rate > 0) {
          slot.frameRate[phase] = strip.rate
        }
        const f0 = strip.frames[0]!
        slot.frame0Bounds[phase] = {
          w: f0.w,
          h: f0.h,
          anchorX: f0.anchorX,
          anchorY: f0.anchorY,
        }
        const ovSpec = CAMPFIRE_OVERLAY_SPECS[id]?.[phase]
        if (ovSpec) {
          const ovStrip = clsStrips[ovSpec.stripKey]
          if (!ovStrip || ovStrip.frames.length === 0) {
            throw new Error(
              `Missing required campfire overlay strip "${id}.${ovSpec.stripKey}" in manifest.json`,
            )
          }
        }
      }
      slot.hitBox = getCampfireSlotHitBox(slot)
      const activeCount = Math.max(1, slot.frameCount[slot.phase] || 1)
      const activeBound =
        slot.phase === 'fw' || slot.phase === 'bw'
          ? Math.max(1, activeCount - 2)
          : Math.max(1, activeCount - 1)
      if (slot.frameIndex >= activeBound) {
        slot.frameIndex = 0
        slot.phaseTicks = 0
      }
    }

    for (const token of HERO_TOKENS) {
      const avatarStrip = this.manifest.charAvatars[token]
      if (!avatarStrip || avatarStrip.frames.length === 0) {
        throw new Error(`Missing character avatar strip for "${token}" in manifest.json`)
      }
      const anim = this.state.avatarAnims[token]
      anim.frameCount = avatarStrip.frameCount
      if (typeof avatarStrip.animRate === 'number' && avatarStrip.animRate > 0) {
        anim.animRate = avatarStrip.animRate
      }
      if (anim.frameIndex >= Math.max(1, anim.frameCount - 1)) {
        anim.acc = 0
        anim.frameIndex = 0
      }
    }

    const promises: Promise<void>[] = []
    for (const rel of STATIC_UI_IMAGES) {
      promises.push(this.loadImage(`${baseUrl}/${rel}`, rel))
    }

    // Load 7-class campfire strips (including all `_ov` overlay strips)
    for (const id of CAMPFIRE_CLASS_ORDER) {
      const clsStrips = this.manifest.campfireClasses[id]!
      for (const strip of Object.values(clsStrips)) {
        promises.push(this.loadImage(`${baseUrl}/${strip.file}`, strip.file))
      }
    }

    // Load 7-class TN avatar strips
    for (const strip of Object.values(this.manifest.charAvatars)) {
      promises.push(this.loadImage(`${baseUrl}/${strip.file}`, strip.file))
    }

    // Load primary bitmap font atlases used across Front-End & Battle.net screens
    const activeFonts: FrontendFontName[] = [
      'font6',
      'font8',
      'font16',
      'font24',
      'font30',
      'font42',
      'fontexocet10',
      'fontformal10',
      'fontformal11',
      'fontformal12',
      'fontridiculous',
    ]
    const activeColors: FrontendColorIndex[] = [0, 1, 2, 3, 4, 5, 7, 8, 9]
    for (const fn of activeFonts) {
      for (const c of activeColors) {
        const rel = `fonts/${fn}-c${c}.png`
        promises.push(this.loadImage(`${baseUrl}/${rel}`, rel))
      }
    }

    // Load full 34-frame cursor atlas (/ui/cursor.png, 256x176: protate, ohand, orotate, buysell)
    promises.push(
      pool.loadImage('/ui/cursor.png').then((img) => {
        if (!img) {
          throw new Error('Failed to load frontend cursor atlas: /ui/cursor.png')
        }
        this.cursorAtlas = img
      }),
    )

    await Promise.all(promises)
    this.ready = true
  }

  private getCjkFontPx(font: FrontendFontName, fallbackHeight: number): number {
    switch (font) {
      case 'font6':
        return 9
      case 'font8':
        return 11
      case 'font16':
        return 13
      case 'font24':
        return 18
      case 'font30':
        return 22
      case 'font42':
        return 30
      case 'fontexocet8':
        return 11
      case 'fontexocet10':
        return 13
      case 'fontformal10':
        return 11
      case 'fontformal11':
        return 12
      case 'fontformal12':
        return 13
      case 'fontridiculous':
        return 11
      default:
        return fallbackHeight
    }
  }

  private getCjkColorHex(color: FrontendColorIndex, isMultiplyButton: boolean): string {
    if (isMultiplyButton && color === 0) {
      // D2Win.dll Button_DrawText (0x6f8ef94e) draws fontexocet10 / fontridiculous with color=0
      // and blendMode=4 (multiply). In sky/pal.pl2, the glyph core is palette index 15 = #0c0c08,
      // producing engraved black text on stone buttons (matching ASCII "BATTLE.NET", "II", etc.).
      return '#0c0c08'
    }
    switch (color) {
      case 0:
        return '#d8d8d8' // sky/pal.pl2 c0 white (indices 31=#c4c4c4, 32=#f4f4f4)
      case 1:
        return '#c45454' // sky/pal.pl2 c1 red (index 32=#c45454)
      case 2:
        return '#18fc00' // sky/pal.pl2 c2 green (index 32=#18fc00)
      case 3:
        return '#6478d0' // sky/pal.pl2 c3 blue (index 32=#6478d0)
      case 4:
        return '#c0a080' // sky/pal.pl2 c4 gold (indices 31=#ac9c64, 32=#c0a080)
      case 5:
        return '#646464' // sky/pal.pl2 c5 gray (index 32=#646464)
      case 7:
        return '#d8b864' // sky/pal.pl2 c7 tan (index 32=#d8b864)
      case 8:
        return '#d08420' // sky/pal.pl2 c8 orange (index 32=#d08420)
      case 9:
        return '#fce874' // sky/pal.pl2 c9 yellow (index 32=#fce874)
    }
  }

  private tokenizeWrapText(text: string): { readonly token: string; readonly isCjk: boolean }[] {
    const tokens: { readonly token: string; readonly isCjk: boolean }[] = []
    let asciiBuf = ''
    const flushAscii = () => {
      if (!asciiBuf) return
      for (const w of asciiBuf.split(/\s+/)) {
        if (w) tokens.push({ token: w, isCjk: false })
      }
      asciiBuf = ''
    }
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i)
      if (code > 0xff) {
        flushAscii()
        tokens.push({ token: text[i]!, isCjk: true })
      } else {
        asciiBuf += text[i]!
      }
    }
    flushAscii()
    return tokens
  }

  /**
   * Measure pixel width of a single line of text in the specified D2 bitmap font.
   * Fails fast if font metrics or glyph metrics are missing (`#709`).
   */
  measureBitmapText(text: string, font: FrontendFontName): number {
    const meta = this.fontMetas[font]
    if (!meta) {
      throw new Error(`Missing bitmap font metrics for "${font}"`)
    }
    const cjkAdvance = this.getCjkFontPx(font, meta.lineHeight)
    let width = 0
    for (let i = 0; i < text.length; i++) {
      const rawCode = text.charCodeAt(i)
      if (rawCode > 0xff) {
        width += cjkAdvance
        continue
      }
      const code = rawCode & 0xff
      const g = meta.glyphs[code]
      if (!g) {
        throw new Error(`Missing glyph metric for charCode ${code} in font "${font}"`)
      }
      width += g.width
    }
    return width
  }

  /**
   * Draw a single line or multi-line (`\n`) string using pre-baked colored DC6 bitmap font atlases.
   * Fails fast if font metrics or atlas image are missing (`#709`).
   */
  drawBitmapText(
    text: string,
    x: number,
    y: number,
    options: {
      font?: FrontendFontName
      color?: FrontendColorIndex
      align?: 'left' | 'center' | 'right'
      vAlign?: 'top' | 'middle'
      lineGap?: number
      blendMode?: GlobalCompositeOperation
      /** Image key of a font atlas baked with another palette (same glyph layout as `fonts/<font>-c<color>.png`). */
      atlasKey?: string
    } = {},
  ): void {
    const font = options.font ?? 'font16'
    const color = options.color ?? 0
    const align = options.align ?? 'left'
    const vAlign = options.vAlign ?? 'top'
    const meta = this.fontMetas[font]
    const atlas = this.images.get(options.atlasKey ?? `fonts/${font}-c${color}.png`)
    if (!meta || !atlas) {
      throw new Error(
        `Missing bitmap font atlas or metrics for "${font}" color ${color}${options.atlasKey ? ` (${options.atlasKey})` : ''}`,
      )
    }

    const lines = text.split('\n')
    const frameH = meta.glyphs[65]?.frameH || meta.lineHeight
    const stepY = options.lineGap ?? Math.max(meta.lineHeight, Math.round(frameH * 0.78))
    const totalBlockH = frameH + (lines.length - 1) * stepY
    let curY = vAlign === 'middle' ? Math.round(y - totalBlockH / 2) : Math.round(y)
    const cjkAdvance = this.getCjkFontPx(font, meta.lineHeight)
    const isMultiplyBtn = options.blendMode === 'multiply'

    if (options.blendMode) {
      this.ctx.save()
      this.ctx.globalCompositeOperation = options.blendMode
    }

    for (const line of lines) {
      const lineW = this.measureBitmapText(line, font)
      let curX = Math.round(x)
      if (align === 'center') curX = Math.round(x - lineW / 2)
      else if (align === 'right') curX = Math.round(x - lineW)

      for (let i = 0; i < line.length; i++) {
        const rawCode = line.charCodeAt(i)
        if (rawCode > 0xff) {
          if (typeof this.ctx.fillText === 'function') {
            const ch = line[i]!
            const midOffset = font === 'fontformal12' ? 20 : Math.round(frameH * 0.54)
            const midY = curY + midOffset
            this.ctx.save()
            this.ctx.globalCompositeOperation = 'source-over'
            this.ctx.font = `bold ${cjkAdvance}px "SimSun", "NSimSun", "Songti SC", "Noto Serif SC", "Microsoft YaHei", sans-serif`
            this.ctx.textAlign = 'left'
            this.ctx.textBaseline = 'middle'
            if (isMultiplyBtn) {
              // Emulate fontexocet10/fontridiculous bottom-right 1px highlight (index 31=#c4c4c4)
              // with engraved black interior (index 15=#0c0c08) on stone buttons
              this.ctx.shadowColor = 'rgba(220, 216, 208, 0.35)'
              this.ctx.shadowOffsetX = 1
              this.ctx.shadowOffsetY = 1
              this.ctx.shadowBlur = 0
              this.ctx.fillStyle = this.getCjkColorHex(color, true)
              this.ctx.fillText(ch, curX, midY)
            } else {
              this.ctx.fillStyle = '#080604'
              this.ctx.fillText(ch, curX + 1, midY + 1)
              this.ctx.fillStyle = this.getCjkColorHex(color, false)
              this.ctx.fillText(ch, curX, midY)
            }
            this.ctx.restore()
          }
          curX += cjkAdvance
          continue
        }
        const code = rawCode & 0xff
        const g = meta.glyphs[code]
        if (!g) {
          throw new Error(`Missing glyph metric for charCode ${code} in font "${font}"`)
        }
        if (code !== 32 && g.frameW > 0 && g.frameH > 0) {
          this.ctx.drawImage(atlas, g.x, g.y, g.frameW, g.frameH, curX, curY, g.frameW, g.frameH)
        }
        curX += g.width
      }
      curY += stepY
    }

    if (options.blendMode) {
      this.ctx.restore()
    }
  }

  /**
   * Word-wrap text to `maxWidth` pixels and draw each line using `drawBitmapText`.
   */
  drawWrappedBitmapText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    options: {
      font?: FrontendFontName
      color?: FrontendColorIndex
      align?: 'left' | 'center'
      lineStep?: number
      /** Keep at most this many lines; the last kept line ends with '...' when text was cut. */
      maxLines?: number
    } = {},
  ): void {
    const font = options.font ?? 'font16'
    const tokens = this.tokenizeWrapText(text)
    const lines: string[] = []
    let current = ''
    let prevIsCjk = false
    for (const { token, isCjk } of tokens) {
      const sep = current && !prevIsCjk && !isCjk ? ' ' : ''
      const candidate = current ? `${current}${sep}${token}` : token
      if (this.measureBitmapText(candidate, font) <= maxWidth || !current) {
        current = candidate
        prevIsCjk = isCjk
      } else {
        lines.push(current)
        current = token
        prevIsCjk = isCjk
      }
    }
    if (current) lines.push(current)
    if (options.maxLines !== undefined && lines.length > options.maxLines) {
      lines.length = Math.max(1, options.maxLines)
      lines[lines.length - 1] = `${lines[lines.length - 1]!} ...`
    }

    const meta = this.fontMetas[font]
    const step = options.lineStep ?? ((meta?.lineHeight ?? 14) + 3)
    for (let i = 0; i < lines.length; i++) {
      this.drawBitmapText(lines[i]!, x, y + i * step, {
        font,
        color: options.color ?? 0,
        align: options.align ?? 'center',
      })
    }
  }

  /**
   * Draw an animated strip frame at `(controlX + frame.anchorX, controlY + frame.anchorY)`.
   * Supports `D2Gdi` `drawMode`:
   * - `drawMode === 5` (`DRAWMODE_NORMAL` / `false`): standard `'source-over'` opaque draw
   * - `drawMode === 3` (`DRAWMODE_MODULATE` / `true`): `'screen'` additive/modulate blend
   * - `drawMode === 1` (`DRAWMODE_TRANS50`): 50% alpha
   * Fails fast if strip or image is missing (`#709`).
   */
  private drawAnimStripFrame(
    strip: PackedAnimStripMeta | undefined,
    frameIdx: number,
    controlX: number,
    controlY: number,
    additiveOrDrawMode: boolean | number = false,
  ): void {
    if (!strip || strip.frames.length === 0) {
      throw new Error('Missing or empty animation strip metadata')
    }
    const img = this.images.get(strip.file)
    if (!img) {
      throw new Error(`Missing loaded image for animation strip "${strip.file}"`)
    }
    const safeIdx = ((frameIdx % strip.frames.length) + strip.frames.length) % strip.frames.length
    const f = strip.frames[safeIdx]!
    const mode =
      typeof additiveOrDrawMode === 'number'
        ? additiveOrDrawMode
        : additiveOrDrawMode
          ? 3
          : (strip.drawMode ?? 5)

    if (mode === 3) {
      this.ctx.save()
      this.ctx.globalCompositeOperation = 'screen'
      this.ctx.drawImage(
        img,
        f.x,
        f.y,
        f.w,
        f.h,
        controlX + f.anchorX,
        controlY + f.anchorY,
        f.w,
        f.h,
      )
      this.ctx.restore()
    } else if (mode === 1) {
      this.ctx.save()
      this.ctx.globalAlpha = 0.5
      this.ctx.drawImage(
        img,
        f.x,
        f.y,
        f.w,
        f.h,
        controlX + f.anchorX,
        controlY + f.anchorY,
        f.w,
        f.h,
      )
      this.ctx.restore()
    } else {
      this.ctx.drawImage(
        img,
        f.x,
        f.y,
        f.w,
        f.h,
        controlX + f.anchorX,
        controlY + f.anchorY,
        f.w,
        f.h,
      )
    }
  }

  /**
   * Draw a character TN avatar at the control point (#696, #719, #926):
   * - When the MCP 0x19 (MCP_CHARLIST2) statstring has equipped components,
   *   blits the runtime-composited CLASS-TN-WCLASS paperdoll (same /chars/<class>
   *   layer packs as in-game; D2Launch.dll 0x6fa4a440 statstring semantics).
   * - While that composite loads (or without layer packs), falls back to the
   *   baked base TN strip from manifest.charAvatars[char.heroToken].
   */
  private drawCharacterAvatar(
    char: RosterCharacter,
    frameIdx: number,
    controlX: number,
    controlY: number,
  ): void {
    const avatarStrip = this.manifest?.charAvatars[char.heroToken]

    const avatarDesc =
      char.avatarDesc ??
      parseMcpAvatarStatstring(char.statstring, char.classId, char.equipmentGraphics)

    // Issue #926: equipped looks come from the runtime paperdoll compositor
    // (same `/chars/<class>` layer packs as in-game). While it loads — or when
    // it is unavailable (no packs / node) — the baked naked TN strip remains
    // the fallback, replacing the never-implemented avatar-layers sprites.
    if (avatarDesc.hasEquippedComponents) {
      const composite = getReadyAvatarComposite(char.heroToken, avatarDesc)
      if (composite && composite.frames.length > 0) {
        const safeIdx2 =
          ((frameIdx % composite.frames.length) + composite.frames.length) %
          composite.frames.length
        const cf = composite.frames[safeIdx2]!
        this.ctx.drawImage(
          composite.sheet,
          cf.x,
          cf.y,
          cf.w,
          cf.h,
          controlX + cf.anchorX,
          controlY + cf.anchorY,
          cf.w,
          cf.h,
        )
        return
      }
      void ensureAvatarComposite(char.heroToken, avatarDesc)
    }

    this.drawAnimStripFrame(avatarStrip, frameIdx, controlX, controlY, false)
  }

  /**
   * Draw a button strictly following `D2Win.dll` `Button_Draw` (`0x6f8efa80`) and `Button_DrawText` (`0x6f8ef94e`):
   * - `h >= 35` (`0x23`): `fontexocet10` (`fontId = 9`), `yAdjust = 4`
   * - `h < 35`:           `fontridiculous` (`fontId = 10`), `yAdjust = h === 32 ? 3 : h > 20 ? 2 : 1`
   * - `color = 0`, `blendMode = 'multiply'` (`D2Gdi` `blendMode = 4` `multiplyBlend[src][dst]`)
   * - Pressed offset `(-2, +2)` (`0x6f8ef94e sub ebx, 2; add edi, 2`)
   * - Disabled state (`#706`): rendered with `DRAWMODE_TRANS50` (`globalAlpha = 0.5`) and disabled frame offset if present (never CSS `brightness`).
   */
  private drawButton(btn: UiButtonDef): void {
    const img = this.images.get(btn.sprite)
    const isDown = !btn.disabled && this.pressedButtonId === btn.id
    if (btn.disabled) {
      this.ctx.save()
      this.ctx.globalAlpha = 0.5
    }
    if (img) {
      const numFrames = btn.disabledFrameOffset !== undefined ? 3 : 2
      const stateW = Math.floor(img.width / numFrames)
      const stateH = img.height
      const frameIndex = btn.disabled
        ? (btn.disabledFrameOffset ?? 0)
        : isDown
          ? 1
          : 0
      const sx = frameIndex * stateW
      this.ctx.drawImage(img, sx, 0, stateW, stateH, btn.x, btn.y, btn.w, btn.h)
    }
    if (btn.label) {
      const dx = isDown ? -2 : 0
      const dy = isDown ? 2 : 0
      const font: FrontendFontName = btn.font ?? (btn.h >= 35 ? 'fontexocet10' : 'fontridiculous')
      const yAdjust = btn.h >= 35 ? 4 : btn.h === 32 ? 3 : btn.h > 20 ? 2 : 1
      const meta = this.fontMetas[font]
      const lineHeight = meta?.lineHeight ?? (btn.h >= 35 ? 13 : 8)
      const frameH = meta?.glyphs[65]?.frameH ?? lineHeight
      const centerX = btn.x + Math.floor(btn.w / 2) + dx
      const color: FrontendColorIndex = btn.color ?? 0

      if (btn.label.includes('\n')) {
        // Two-line button (`[esi+0x40] & 0x40` at 0x6f8ef954..0x6f8efa55)
        const lines = btn.label.split('\n')
        const third = Math.trunc((btn.h - lineHeight) / 3)
        const yBottom1 = btn.y + btn.h - 2 * third + yAdjust + dy
        const yBottom2 = btn.y + btn.h - third + yAdjust + dy
        this.drawBitmapText(lines[0] ?? '', centerX, yBottom1 - frameH, {
          font,
          color,
          align: 'center',
          vAlign: 'top',
          blendMode: 'multiply',
        })
        this.drawBitmapText(lines[1] ?? '', centerX, yBottom2 - frameH, {
          font,
          color,
          align: 'center',
          vAlign: 'top',
          blendMode: 'multiply',
        })
      } else {
        const yBottom = btn.y + btn.h - ((btn.h - lineHeight) >> 1) + yAdjust + dy
        this.drawBitmapText(btn.label, centerX, yBottom - frameH, {
          font,
          color,
          align: 'center',
          vAlign: 'top',
          blendMode: 'multiply',
        })
      }
    }
    if (btn.disabled) {
      this.ctx.restore()
    }
  }

  /**
   * Draw a Diablo II editbox (`textbox.png` or custom rect) with text and a 250ms blinking `"_"` underscore cursor
   * (`D2Win.dll` `0x6f8f1c70` / `D2WinEditBox.cpp:1184-1193`, `#705`).
   */
  private drawEditBox(
    field: Exclude<ActiveInputField, null>,
    x: number,
    y: number,
    w: number,
    h: number,
    value: string,
    options: {
      drawFrameImage?: boolean
      maskChar?: string
      font?: FrontendFontName
      color?: FrontendColorIndex
    } = {},
  ): void {
    if (options.drawFrameImage) {
      const tbImg = this.images.get('textbox.png')
      if (tbImg) {
        this.ctx.drawImage(tbImg, 0, 0, tbImg.width, tbImg.height, x, y, w, h)
      }
    }
    const displayValue = options.maskChar ? options.maskChar.repeat(value.length) : value
    const font = options.font ?? 'fontformal12'
    const color = options.color ?? 0
    const padX = 7
    this.drawBitmapText(displayValue, x + padX, y + Math.floor(h / 2), {
      font,
      color,
      align: 'left',
      vAlign: 'middle',
    })

    // Per D2WinEditBox.cpp:1184-1193 (`(GetTickCount() >>> 8) & 1` / `Math.floor(nowMs / 250) & 1`),
    // draw an underscore `"_"` glyph immediately after the typed text using the active bitmap font.
    if (this.state.activeInput === field && (Math.floor(this.lastRenderNowMs / 250) & 1) !== 0) {
      const textW = this.measureBitmapText(displayValue, font)
      this.drawBitmapText('_', x + padX + textW, y + Math.floor(h / 2), {
        font,
        color,
        align: 'left',
        vAlign: 'middle',
      })
    }
  }

  /**
   * Return the list of interactive buttons for the current stage (or only the modal popup OK button when `popupModal` is open).
   */
  getActiveButtons(): UiButtonDef[] {
    if (!this.manifest) return []

    if (this.state.popupModal !== null) {
      return [
        {
          id: 'popup_ok',
          x: 351,
          y: 305,
          w: 96,
          h: 32,
          sprite: 'btn-popup-small.png',
          label: this.requireStr(5102, 'ok'),
          onClick: () => {
            dismissPopupModal(this.state)
          },
        },
      ]
    }

    return this.getStageButtons()
  }

  private getStageButtons(): UiButtonDef[] {
    if (!this.manifest) return []
    const s = this.getLocalizedStrings()

    switch (this.state.stage) {
      case 'main_menu': {
        // Exact Expansion Main Menu coordinates from D2Launch.dll (0x6fa61190..0x6fa612d0)
        // Single Player and Other Multiplayer are disabled (grayed out via DRAWMODE_TRANS50); other main menu stone buttons are rendered at full stone brightness with engraved black labels.
        const buttons: UiButtonDef[] = [
          {
            id: 'single_player',
            x: 264,
            y: 289,
            w: 272,
            h: 35,
            sprite: 'btn-wide.png',
            label: this.requireStr(5106, 'singlePlayer'),
            disabled: true,
            onClick: () => {},
          },
          {
            id: 'battle_net',
            x: 264,
            y: 331,
            w: 272,
            h: 35,
            sprite: 'btn-wide.png',
            label: this.requireStr(5104, 'battleNet'),
            onClick: () => {
              clickBattleNetButton(
                this.state,
                s as unknown as Record<string, unknown>,
              )
              if (this.asyncHandlers?.onConnect) {
                void this.asyncHandlers.onConnect(this.state)
              }
            },
          },
        ]
        if (this.state.gateway.trim().length > 0) {
          buttons.push({
            id: 'gateway',
            x: 264,
            y: 366,
            w: 272,
            h: 25,
            sprite: 'btn-wide02.png',
            label: `${this.requireStr(5165, 'gatewayPrefix')}${this.state.gateway.toUpperCase()}`,
            onClick: () => {},
          })
        }
        buttons.push(
          {
            id: 'other_multiplayer',
            x: 264,
            y: 398,
            w: 272,
            h: 35,
            sprite: 'btn-wide.png',
            label: this.requireStr(5107, 'otherMultiplayer'),
            disabled: true,
            onClick: () => {},
          },
          {
            id: 'credits',
            x: 264,
            y: 503,
            w: 135,
            h: 25,
            sprite: 'btn-short.png',
            label: this.requireStr(5109, 'credits'),
            onClick: () => {},
          },
          {
            id: 'cinematics',
            x: 402,
            y: 503,
            w: 135,
            h: 25,
            sprite: 'btn-short.png',
            label: this.requireStr(5108, 'cinematics'),
            onClick: () => {},
          },
          {
            id: 'exit_d2',
            x: 264,
            y: 533,
            w: 272,
            h: 35,
            sprite: 'btn-3wide.png',
            label: this.requireStr(5110, 'exitDiablo2'),
            onClick: () => {},
          },
        )
        return buttons
      }

      case 'bnet_connecting':
        return [
          {
            id: 'cancel_connecting',
            x: 336,
            y: 367,
            w: 128,
            h: 35,
            sprite: 'btn-medium.png',
            label: this.requireStr(5103, 'cancel'),
            onClick: () => {
              cancelConnecting(this.state)
            },
          },
        ]

      case 'bnet_login':
        return [
          {
            id: 'bnet_login_btn',
            x: 264,
            y: 424,
            w: 272,
            h: 35,
            sprite: 'btn-wide.png',
            label: this.requireStr(5208, 'logIn'),
            onClick: () => {
              if (this.asyncHandlers?.onLogin) {
                void this.asyncHandlers.onLogin(this.state, false)
              } else {
                submitBattleNetLogin(this.state)
              }
            },
          },
          {
            id: 'bnet_account_settings',
            x: 264,
            y: 466,
            w: 272,
            h: 35,
            sprite: 'btn-wide.png',
            label: this.requireStr(5209, 'accountSettings'),
            onClick: () => {},
          },
          {
            id: 'bnet_create_account',
            x: 264,
            y: 508,
            w: 272,
            h: 35,
            sprite: 'btn-wide.png',
            label: this.requireStr(5210, 'createNewAccount'),
            onClick: () => {
              openTermsOfUse(this.state)
            },
          },
          {
            id: 'bnet_login_cancel',
            x: 33,
            y: 538,
            w: 128,
            h: 35,
            sprite: 'btn-medium.png',
            label: this.requireStr(5103, 'cancel'),
            onClick: () => {
              this.state.stage = 'main_menu'
              this.state.stageTicks = 0
              this.setActiveInput(null, false)
            },
          },
        ]

      case 'bnet_terms_of_use':
        return [
          {
            id: 'tou_disagree',
            x: 133,
            y: 478,
            w: 128,
            h: 35,
            sprite: 'btn-medium.png',
            label: this.requireStr(5182, 'disagree'),
            onClick: () => {
              disagreeTermsOfUse(this.state)
              this.setActiveInput(this.state.activeInput, false)
            },
          },
          {
            id: 'tou_agree',
            x: 525,
            y: 478,
            w: 128,
            h: 35,
            sprite: 'btn-medium.png',
            label: this.requireStr(5181, 'agree'),
            onClick: () => {
              agreeTermsOfUse(this.state)
              this.setActiveInput(this.state.activeInput, false)
            },
          },
        ]

      case 'bnet_create_account':
        return [
          {
            id: 'create_account_exit',
            x: 33,
            y: 537,
            w: 128,
            h: 35,
            sprite: 'btn-medium.png',
            label: this.requireStr(5101, 'exit'),
            onClick: () => {
              cancelCreateAccount(this.state)
              this.setActiveInput(this.state.activeInput, false)
            },
          },
          {
            id: 'create_account_ok',
            x: 627,
            y: 537,
            w: 128,
            h: 35,
            sprite: 'btn-medium.png',
            label: this.requireStr(5102, 'ok'),
            onClick: () => {
              submitCreateAccountForm(this.state, s as unknown as Record<string, unknown>)
              this.setActiveInput(this.state.activeInput, false)
            },
          },
        ]

      case 'bnet_please_read':
        return [
          {
            id: 'please_read_cancel',
            x: 133,
            y: 478,
            w: 128,
            h: 35,
            sprite: 'btn-medium.png',
            label: this.requireStr(5103, 'cancel'),
            onClick: () => {
              cancelPleaseRead(this.state)
              this.setActiveInput(this.state.activeInput, false)
            },
          },
          {
            id: 'please_read_ok',
            x: 525,
            y: 478,
            w: 128,
            h: 35,
            sprite: 'btn-medium.png',
            label: this.requireStr(5102, 'ok'),
            onClick: () => {
              this.confirmPleaseRead()
            },
          },
        ]

      case 'char_create':
        return [
          {
            id: 'char_create_exit',
            x: 33,
            y: 538,
            w: 128,
            h: 35,
            sprite: 'btn-medium.png',
            label: this.requireStr(5101, 'exit'),
            onClick: () => {
              if (this.state.roster.length > 0) {
                this.state.stage = 'char_select'
                this.state.stageTicks = 0
                this.setActiveInput(null, false)
                resetHeroAvatarAnims(this.state)
              } else if (this.state.playMode === 'single') {
                this.state.stage = 'main_menu'
                this.state.stageTicks = 0
                this.setActiveInput(null, false)
              } else {
                this.state.stage = 'bnet_login'
                this.state.stageTicks = 0
                this.setActiveInput('accountName', false)
              }
            },
          },
          {
            id: 'char_create_ok',
            x: 639,
            y: 538,
            w: 128,
            h: 35,
            sprite: 'btn-medium.png',
            label: this.requireStr(5102, 'ok'),
            disabled: !this.state.selectedClass || !isValidCharacterName(this.state.charName),
            onClick: () => {
              if (!this.state.selectedClass || !isValidCharacterName(this.state.charName)) {
                return
              }
              if (this.asyncHandlers?.onCreateCharacter) {
                void this.asyncHandlers.onCreateCharacter(this.state)
              } else {
                const created = submitCharacterCreate(
                  this.state,
                  s as unknown as Record<string, unknown>,
                )
                if (created && this.state.stage === 'door_loading') {
                  this.onEnterDoorLoading?.(this.state)
                }
              }
            },
          },
        ]

      case 'char_select': {
        const hasChars = this.state.roster.length > 0
        const selectedChar = this.state.roster[this.state.selectedSlotIndex]
        return [
          {
            id: 'char_select_create_new',
            x: 33,
            y: 468,
            w: 168,
            h: 60,
            sprite: 'btn-tall.png',
            label: this.requireStr(5273, 'createNewCharacter'),
            onClick: () => {
              enterCharCreate(this.state)
              this.setActiveInput(null, false)
            },
          },
          {
            id: 'char_select_convert_exp',
            x: 233,
            y: 468,
            w: 168,
            h: 60,
            sprite: 'btn-tall.png',
            label: this.requireStr(22729, 'convertToExpansion'),
            disabled: !selectedChar || selectedChar.isExpansion,
            onClick: () => {
              if (selectedChar && !selectedChar.isExpansion) {
                if (this.asyncHandlers?.onConvertCharacter) {
                  void this.asyncHandlers.onConvertCharacter(this.state, selectedChar.name)
                } else {
                  selectedChar.isExpansion = true
                }
              }
            },
          },
          {
            id: 'char_select_delete',
            x: 433,
            y: 468,
            w: 168,
            h: 60,
            sprite: 'btn-tall.png',
            label: this.requireStr(5274, 'deleteCharacter'),
            disabled: !selectedChar,
            onClick: () => {
              if (selectedChar) {
                if (this.asyncHandlers?.onDeleteCharacter) {
                  void this.asyncHandlers.onDeleteCharacter(this.state, selectedChar.name)
                } else {
                  this.state.roster.splice(this.state.selectedSlotIndex, 1)
                  this.state.selectedSlotIndex = Math.max(
                    0,
                    Math.min(this.state.selectedSlotIndex, this.state.roster.length - 1),
                  )
                  resetHeroAvatarAnims(this.state)
                }
              }
            },
          },
          {
            id: 'char_select_exit',
            x: 33,
            y: 538,
            w: 128,
            h: 35,
            sprite: 'btn-medium.png',
            label: this.requireStr(5101, 'exit'),
            onClick: () => {
              this.state.stage = 'main_menu'
              this.state.stageTicks = 0
              this.setActiveInput(null, false)
            },
          },
          {
            id: 'char_select_ok',
            x: 639,
            y: 538,
            w: 128,
            h: 35,
            sprite: 'btn-medium.png',
            label: this.requireStr(5102, 'ok'),
            disabled: !hasChars,
            onClick: () => {
              if (this.asyncHandlers?.onSelectCharacter) {
                void this.asyncHandlers.onSelectCharacter(this.state)
              } else if (confirmCharacterSelect(this.state) && this.state.stage === 'door_loading') {
                this.onEnterDoorLoading?.(this.state)
              }
            },
          },
        ]
      }

      case 'bnet_lobby': {
        const L = s.lobby
        return [
          // Left chat utility buttons (`chatleftbuttons.dc6` 78x20 at y=450 & y=470 per D2Multi.dll 0x6f9e9d28..0x6f9e9e20)
          {
            id: 'lobby_send',
            x: 27,
            y: 450,
            w: 78,
            h: 20,
            sprite: 'btn-chatleft.png',
            label: L.send,
            onClick: () => {
              this.sendChatMessage()
            },
          },
          {
            id: 'lobby_whisper',
            x: 107,
            y: 450,
            w: 78,
            h: 20,
            sprite: 'btn-chatleft.png',
            label: L.whisper,
            onClick: () => {},
          },
          {
            id: 'lobby_help',
            x: 187,
            y: 450,
            w: 78,
            h: 20,
            sprite: 'btn-chatleft.png',
            label: L.help,
            onClick: () => {},
          },
          {
            id: 'lobby_squelch',
            x: 27,
            y: 470,
            w: 78,
            h: 20,
            sprite: 'btn-chatleft.png',
            label: L.squelch,
            onClick: () => {},
          },
          {
            id: 'lobby_unsquelch',
            x: 107,
            y: 470,
            w: 78,
            h: 20,
            sprite: 'btn-chatleft.png',
            label: L.unsquelch,
            onClick: () => {},
          },
          {
            id: 'lobby_emote',
            x: 187,
            y: 470,
            w: 78,
            h: 20,
            sprite: 'btn-chatleft.png',
            label: L.emote,
            onClick: () => {},
          },
          // Right Game Command Bar (D2Multi.dll 0x6f9e9e50..0x6f9e9f10)
          {
            id: 'lobby_tab_create',
            x: 533,
            y: 449,
            w: 119,
            h: 20,
            sprite: 'btn-chatrighttop.png',
            label: L.create,
            onClick: () => {
              if (this.state.lobbySubPanel !== 'create') {
                this.state.gameName = ''
                this.state.gamePassword = ''
                this.state.gameDescription = ''
                this.state.selectedGameName = ''
                this.state.selectedGameInfo = null
                this.state.joinGameListScroll = 0
                this.state.joinGameDetailsScroll = 0
                this.state.createGameError = null
              }
              const selectedChar = this.state.roster[this.state.selectedSlotIndex]
              if (selectedChar && !isDifficultyUnlocked(selectedChar, this.state.difficulty)) {
                this.state.difficulty = 'normal'
              }
              this.state.lobbySubPanel = 'create'
              this.setActiveInput('gameName', false)
            },
          },
          {
            id: 'lobby_tab_join',
            x: 653,
            y: 449,
            w: 119,
            h: 20,
            sprite: 'btn-chatrighttop.png',
            label: L.join,
            onClick: () => {
              if (this.state.lobbySubPanel !== 'join') {
                const prevTypedName = this.state.gameName.trim()
                if (prevTypedName) {
                  recordRecentRealmGameName(prevTypedName)
                }
                this.state.gameName = ''
                this.state.gamePassword = ''
                this.state.selectedGameName = ''
                this.state.selectedGameInfo = null
                this.state.joinGameListScroll = 0
                this.state.joinGameDetailsScroll = 0
                this.state.createGameError = null
              }
              this.state.lobbySubPanel = 'join'
              this.setActiveInput('gameName', false)
              if (this.asyncHandlers?.onListGames) {
                void this.asyncHandlers.onListGames(this.state)
              }
            },
          },
          {
            id: 'lobby_tab_channel',
            x: 535,
            y: 470,
            w: 79,
            h: 20,
            sprite: 'btn-chatright.png',
            label: L.channel,
            onClick: () => {},
          },
          {
            id: 'lobby_tab_ladder',
            x: 614,
            y: 470,
            w: 79,
            h: 20,
            sprite: 'btn-chatright.png',
            label: L.ladder,
            onClick: () => {},
          },
          {
            id: 'lobby_tab_quit',
            x: 693,
            y: 470,
            w: 79,
            h: 20,
            sprite: 'btn-chatright.png',
            label: L.quit,
            onClick: () => {
              this.state.stage = 'char_select'
              this.state.stageTicks = 0
              this.setActiveInput(null, false)
              resetHeroAvatarAnims(this.state)
            },
          },
          // Create / Join Game sub-panel buttons (`CancelButtonBlank.dc6` 96x32 @ (433,401) & `GameButtonBlank.dc6` 172x32 @ (594,401))
          {
            id: 'create_game_cancel',
            x: 433,
            y: 401,
            w: 96,
            h: 32,
            sprite: 'btn-create-cancel.png',
            label: this.requireStr(5103, 'cancel'),
            onClick: () => {
              this.state.gameName = ''
              this.state.gamePassword = ''
              this.state.gameDescription = ''
              this.state.selectedGameName = ''
              this.state.selectedGameInfo = null
              this.state.joinGameDetailsScroll = 0
              this.state.createGameError = null
              this.setActiveInput('gameName', false)
            },
          },
          {
            id: 'create_game_submit',
            x: 594,
            y: 401,
            w: 172,
            h: 32,
            sprite: 'btn-game.png',
            label:
              this.state.lobbySubPanel === 'join'
                ? this.requireStr(5151, 'lobby.joinGameBtn')
                : this.requireStr(5150, 'lobby.createGameBtn'),
            disabled:
              this.state.lobbySubPanel === 'join'
                ? !canSubmitJoinGame(this.state)
                : !canSubmitCreateGame(this.state),
            onClick: () => {
              if (this.state.lobbySubPanel === 'join') {
                this.triggerJoinGame()
              } else {
                this.triggerCreateGame()
              }
            },
          },
        ]
      }

      default:
        return []
    }
  }

  private triggerCreateGame(): void {
    if (this.asyncHandlers?.onCreateGame) {
      void this.asyncHandlers.onCreateGame(this.state)
      return
    }
    if (submitCreateGame(this.state)) {
      this.onEnterDoorLoading?.(this.state)
    }
  }

  private triggerJoinGame(): void {
    const targetName = (this.state.gameName || this.state.selectedGameName).trim()
    if (!targetName) {
      return
    }
    this.state.gameName = targetName
    this.state.createGameError = null
    if (this.asyncHandlers?.onJoinGame) {
      void this.asyncHandlers.onJoinGame(this.state, targetName, this.state.gamePassword)
      return
    }
    if (submitCreateGame(this.state)) {
      this.onEnterDoorLoading?.(this.state)
    }
  }

  private sendChatMessage(): void {
    const trimmed = this.state.chatInput.trim()
    if (!trimmed) return
    // Battle.net slash commands (e.g. /ann, /w, /whoami) are sent as BNCS SID_CHATCOMMAND (0x0E)
    // and their responses arrive via SID_CHATEVENT (0x0F); only non-slash messages echo locally.
    if (!trimmed.startsWith('/')) {
      const selectedChar = this.state.roster[this.state.selectedSlotIndex]
      const speaker = selectedChar?.name ?? this.state.accountName
      const formatted = `<${speaker}> ${trimmed}`
      this.state.chatMessages.push(formatted)
      this.state.chatEntries.push({
        text: formatted,
        color: 0,
        kind: 'chat',
      })
      if (this.state.chatMessages.length > 14) {
        this.state.chatMessages.shift()
      }
      if (this.state.chatEntries.length > 14) {
        this.state.chatEntries.shift()
      }
    }
    this.state.chatInput = ''
    if (this.state.activeInput === 'chatInput') {
      this.onActiveInputChange?.('chatInput', false)
    }
    if (this.asyncHandlers?.onSendChat) {
      void this.asyncHandlers.onSendChat(this.state, trimmed)
    }
  }

  private confirmPleaseRead(): void {
    if (this.asyncHandlers?.onLogin) {
      void this.asyncHandlers.onLogin(this.state, true)
    } else {
      this.state.roster = []
      this.state.stage = 'char_select'
      this.state.stageTicks = 0
      this.setActiveInput(null, false)
    }
  }

  wrapText(text: string, maxWidth: number, font: FrontendFontName = 'font16'): string[] {
    const paragraphs = text.split('\n')
    const out: string[] = []
    for (const para of paragraphs) {
      const trimmed = para.trim()
      if (!trimmed) {
        out.push('')
        continue
      }
      const tokens = this.tokenizeWrapText(trimmed)
      let current = ''
      let prevIsCjk = false
      for (const { token, isCjk } of tokens) {
        const sep = current && !prevIsCjk && !isCjk ? ' ' : ''
        const candidate = current ? `${current}${sep}${token}` : token
        if (this.measureBitmapText(candidate, font) <= maxWidth || !current) {
          current = candidate
          prevIsCjk = isCjk
        } else {
          out.push(current)
          current = token
          prevIsCjk = isCjk
        }
      }
      if (current) out.push(current)
    }
    return out
  }

  private getTermsWrappedLines(): string[] {
    const raw = this.manifest ? (this.getLocalizedStrings().termsOfUseText ?? '') : ''
    if (!raw) return []
    return this.wrapText(raw, 515, 'fontformal12')
  }

  private getTermsMaxScrollLine(): number {
    const lines = this.getTermsWrappedLines()
    const visibleLines = 18
    return Math.max(0, lines.length - visibleLines)
  }

  /**
   * Render the active pre-game stage onto the 800x600 canvas.
   */
  render(nowMs = performance.now()): void {
    this.onRenderSync?.()
    if (!this.ready || !this.manifest) return
    // On-demand rendering: skip frames whose scene inputs did not change (see
    // shouldRenderMenuFrame) — an idle main menu stops repainting 800x600 at
    // display refresh rate and the GPU load drops with it.
    const signal: MenuFrameDirtySignal = {
      stage: `${this.state.stage}:${this.state.lobbySubPanel}:${this.state.activeInput ?? ''}:${this.state.popupModal?.message ?? ''}:${this.state.createGameError ?? ''}:${this.state.lastError ?? ''}:${this.state.realmGames.length}:${this.state.selectedGameName}:${this.state.selectedGameInfo?.name ?? ''}:${this.state.selectedGameInfo?.uptimeSec ?? -1}`,
      tick: this.state.globalTick,
      mouseX: this.lastMouseX,
      mouseY: this.lastMouseY,
      inputVersion: this.inputVersion,
      blinkPhase: Math.floor(nowMs / 250),
      stageAnimates: TICK_ANIMATED_STAGES.has(this.state.stage),
    }
    if (
      !this.renderedMenuFrameOnce ||
      shouldRenderMenuFrame(this.lastMenuFrameSignal, signal, nowMs, this.lastMenuFrameRenderMs)
    ) {
      this.lastMenuFrameSignal = signal
      this.lastMenuFrameRenderMs = nowMs
      this.renderedMenuFrameOnce = true
      this.renderInner(nowMs)
    }
  }

  private renderInner(nowMs: number): void {
    this.lastRenderNowMs = nowMs
    const ctx = this.ctx
    const pixelScale = syncCrispBackingStore(this.canvas, 800, 600)
    ctx.setTransform?.(pixelScale, 0, 0, pixelScale, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, 800, 600)

    switch (this.state.stage) {
      case 'main_menu':
        this.renderMainMenu(false)
        break
      case 'bnet_connecting':
        this.renderMainMenu(true)
        break
      case 'bnet_login':
        this.renderBnetLogin()
        break
      case 'bnet_terms_of_use':
        this.renderBnetTermsOfUse()
        break
      case 'bnet_create_account':
        this.renderBnetCreateAccount()
        break
      case 'bnet_please_read':
        this.renderBnetPleaseRead()
        break
      case 'char_create':
        this.renderCharCreate()
        break
      case 'char_select':
        this.renderCharSelect()
        break
      case 'bnet_lobby':
        this.renderBnetLobby()
        break
      case 'door_loading':
        this.renderDoorLoading()
        break
      case 'in_game':
        break
      case 'end_game':
        this.renderEndGame()
        break
    }

    if (this.state.popupModal !== null) {
      this.renderPopupModal(this.state.popupModal)
    }

    // Draw the authentic Diablo II animated hand cursor on top of all front-end screens
    if (this.state.stage !== 'in_game') {
      this.cursor.render(ctx, this.cursorAtlas, nowMs)
    }
  }

  private drawBurningMainLogo(): void {
    if (!this.manifest) return
    const tick = this.state.globalTick
    const blackStrip = this.manifest.animStrips['logoMainBlack']
    const fireStrip = this.manifest.animStrips['logoMainFire']
    if (blackStrip) {
      const frameIdx = getAnimImageLoopFrame(tick, blackStrip.frameCount, blackStrip.rate ?? 1)
      this.drawAnimStripFrame(blackStrip, frameIdx, 400, 120, false)
    }
    if (fireStrip) {
      const frameIdx = getAnimImageLoopFrame(tick, fireStrip.frameCount, fireStrip.rate ?? 1)
      this.drawAnimStripFrame(fireStrip, frameIdx, 400, 120, true)
    }
  }

  private renderMainMenu(showConnectingModal: boolean): void {
    const bg = this.images.get('bg-main-menu.png')
    if (bg) this.ctx.drawImage(bg, 0, 0)

    this.drawBurningMainLogo()

    if (!showConnectingModal) {
      for (const btn of this.getActiveButtons()) {
        this.drawButton(btn)
      }
    } else {
      // Render `PopUp_340x224.dc6` at (230, 188) and single BNCS stage status control (`0x6fa6158c`, #699)
      const popup = this.images.get('popup-340x224.png')
      if (popup) this.ctx.drawImage(popup, 230, 188)

      const modalSpec = D2LAUNCH_CONTROL_RECORDS.bnetConnectingModal
      const titleText = this.requireStr(modalSpec.titleCenter.tblId, 'battleNet')
      const stageStatusText = resolveBnetConnectStageText(
        this.state,
        this.getLocalizedStrings() as unknown as Record<string, unknown>,
      )

      this.drawBitmapText(titleText, modalSpec.titleCenter.x, 214, {
        font: 'font24',
        color: 4,
        align: 'center',
      })
      this.drawWrappedBitmapText(
        stageStatusText,
        modalSpec.statusText.centerX,
        modalSpec.statusText.centerY,
        modalSpec.statusText.w,
        {
          font: 'fontformal12',
          color: 0,
          align: 'center',
        },
      )

      for (const btn of this.getActiveButtons()) {
        this.drawButton(btn)
      }
    }

    // Version string at bottom-left (`D2Launch.dll` 0x6fa64310: x=0, w=200, y_bottom=599, h=40, align=2, Font16, color=0)
    this.drawBitmapText('v 1.13c', 100, 560, { font: 'font16', color: 0, align: 'center' })
  }

  private renderBnetLogin(): void {
    const bg = this.images.get('bg-main-menu.png')
    if (bg) this.ctx.drawImage(bg, 0, 0)

    this.drawBurningMainLogo()

    const headerSpec = D2LAUNCH_CONTROL_RECORDS.bnetLoginHeader
    // Title: .tbl 5204 ("Battle.net Log In") below the Expansion Set / Lord of Destruction banner
    this.drawBitmapText(
      this.requireStr(headerSpec.title.tblId, 'loginTitle'),
      headerSpec.title.centerX,
      headerSpec.title.y + 10,
      {
        font: 'font24',
        color: 4,
        align: 'center',
      },
    )

    const loginErr = this.state.loginError || this.state.lastError
    if (loginErr) {
      // Session-loss reasons (tbl text + technical detail) can be long: wrap them in the space
      // between the title and the Account Name label.
      this.drawWrappedBitmapText(loginErr, headerSpec.instruction.centerX, 244, 700, {
        font: 'fontformal11',
        color: 1,
        align: 'center',
        lineStep: 14,
        maxLines: 4,
      })
    } else {
      // Instruction: .tbl 5205 at (200, 244, 400, 60) (#700)
      this.drawWrappedBitmapText(
        this.requireStr(headerSpec.instruction.tblId, 'loginInstruction'),
        headerSpec.instruction.centerX,
        headerSpec.instruction.y + 8,
        headerSpec.instruction.w,
        {
          font: 'fontformal12',
          color: 0,
          align: 'center',
          lineStep: 18,
        },
      )
    }

    // Account Name label & editbox (D2Launch.dll 0x6fa61310..0x6fa616d0)
    this.drawBitmapText(this.requireStr(5206, 'accountName'), 278, 296, {
      font: 'font16',
      color: 4,
      align: 'left',
    })
    this.drawEditBox('accountName', 278, 316, 243, 31, this.state.accountName, {
      drawFrameImage: true,
      font: 'fontformal12',
      color: 0,
    })

    // Password label & editbox
    this.drawBitmapText(this.requireStr(5207, 'password'), 278, 356, {
      font: 'font16',
      color: 4,
      align: 'left',
    })
    this.drawEditBox('accountPassword', 278, 376, 243, 31, this.state.accountPassword, {
      drawFrameImage: true,
      maskChar: '*',
      font: 'fontformal12',
      color: 0,
    })

    for (const btn of this.getStageButtons()) {
      this.drawButton(btn)
    }
  }

  /**
   * Stage: Battle.net Terms of Use (`D2Launch.dll` `0x6fa51450`, layout `0x6fa60bf0`).
   */
  private renderBnetTermsOfUse(): void {
    const bg = this.images.get('bg-main-menu.png')
    if (bg) this.ctx.drawImage(bg, 0, 0)

    this.drawBurningMainLogo()

    const touBg = this.images.get('terms-of-use-bg.png')
    if (touBg) {
      this.ctx.drawImage(touBg, 103, 75)
    }

    this.drawBitmapText(this.requireStr(5180, 'termsOfUseTitle'), 388, 104, {
      font: 'font24',
      color: 4,
      align: 'center',
    })

    const lines = this.getTermsWrappedLines()
    const visibleLines = 18
    const lineStep = 16
    const maxScroll = Math.max(0, lines.length - visibleLines)
    const startLine = Math.max(0, Math.min(maxScroll, this.state.termsScrollLine))

    this.ctx.save()
    this.ctx.beginPath()
    this.ctx.rect(120, 149, 540, 318)
    this.ctx.clip()
    for (let i = 0; i < visibleLines; i++) {
      const lineText = lines[startLine + i]
      if (lineText === undefined) break
      if (lineText.length > 0) {
        this.drawBitmapText(lineText, 120, 149 + i * lineStep, {
          font: 'fontformal10',
          color: 0,
          align: 'left',
        })
      }
    }
    this.ctx.restore()

    const sbImg = this.images.get('scrollbar.png')
    if (sbImg) {
      const fw = 12
      const fh = 14
      this.ctx.drawImage(sbImg, 0, 0, fw, fh, 668, 149, fw, fh)
      this.ctx.drawImage(sbImg, fw, 0, fw, fh, 668, 453, fw, fh)
      const trackTop = 163
      const trackBottom = 439
      const ratio = maxScroll > 0 ? startLine / maxScroll : 0
      const thumbY = Math.round(trackTop + ratio * (trackBottom - trackTop))
      this.ctx.drawImage(sbImg, fw * 4, 0, fw, fh, 668, thumbY, fw, fh)
    }

    for (const btn of this.getStageButtons()) {
      this.drawButton(btn)
    }
  }

  /**
   * Stage: Create Battle.net Account (`D2Launch.dll` `0x6fa57780`, layout `0x6fa61310..0x6fa61fa0`).
   */
  private renderBnetCreateAccount(): void {
    const bg = this.images.get('bg-main-menu.png')
    if (bg) this.ctx.drawImage(bg, 0, 0)

    this.drawBurningMainLogo()

    // Instruction text (strId = 5223 "Enter the Name and Password for your new battle.net account."): (200, 250, 400, 100), font16, centered
    this.drawWrappedBitmapText(this.requireStr(5223, 'createAccountInstruction'), 400, 250, 400, {
      font: 'font16',
      color: 0,
      align: 'center',
      lineStep: 17,
    })

    // Field 1: Account Name (strId = 5224) label at (321, 308), frame/editbox at (319, 321, 169, 26)
    this.drawBitmapText(this.requireStr(5224, 'accountName'), 321, 308, {
      font: 'font16',
      color: 4,
      align: 'left',
    })
    this.drawEditBox('accountName', 319, 321, 169, 26, this.state.accountName, {
      drawFrameImage: true,
      font: 'fontformal12',
      color: 0,
    })

    // Field 2: Password (strId = 5225) label at (321, 362), frame/editbox at (319, 375, 169, 26)
    this.drawBitmapText(this.requireStr(5225, 'password'), 321, 362, {
      font: 'font16',
      color: 4,
      align: 'left',
    })
    this.drawEditBox('accountPassword', 319, 375, 169, 26, this.state.accountPassword, {
      drawFrameImage: true,
      maskChar: '*',
      font: 'fontformal12',
      color: 0,
    })

    // Field 3: Verify Password (strId = 10834) label at (321, 416), frame/editbox at (319, 429, 169, 26)
    this.drawBitmapText(this.requireStr(10834, 'verifyPassword'), 321, 416, {
      font: 'font16',
      color: 4,
      align: 'left',
    })
    this.drawEditBox(
      'accountVerifyPassword',
      319,
      429,
      169,
      26,
      this.state.accountVerifyPassword,
      {
        drawFrameImage: true,
        maskChar: '*',
        font: 'fontformal12',
        color: 0,
      },
    )

    for (const btn of this.getStageButtons()) {
      this.drawButton(btn)
    }
  }

  /**
   * Stage: PLEASE READ Confirmation (`D2Launch.dll` `0x6fa584d0`, layout `0x6fa620f0..0x6fa621e0`).
   */
  private renderBnetPleaseRead(): void {
    const bg = this.images.get('bg-main-menu.png')
    if (bg) this.ctx.drawImage(bg, 0, 0)

    this.drawBurningMainLogo()

    const touBg = this.images.get('terms-of-use-bg.png')
    if (touBg) {
      this.ctx.drawImage(touBg, 103, 75)
    }

    this.drawBitmapText(this.requireStr(5227, 'pleaseReadTitle'), 388, 104, {
      font: 'font24',
      color: 4,
      align: 'center',
    })

    const para1 = this.requireStr(5228, 'pleaseReadPara1')
    const para2 = this.requireStr(5229, 'pleaseReadPara2')
    const para3 = this.requireStr(5230, 'pleaseReadPara3')

    this.drawWrappedBitmapText(para1, 395, 162, 570, {
      font: 'fontformal12',
      color: 0,
      align: 'center',
      lineStep: 17,
    })
    this.drawWrappedBitmapText(para2, 395, 292, 570, {
      font: 'fontformal12',
      color: 0,
      align: 'center',
      lineStep: 17,
    })
    this.drawWrappedBitmapText(para3, 395, 382, 570, {
      font: 'fontformal12',
      color: 0,
      align: 'center',
      lineStep: 17,
    })

    for (const btn of this.getStageButtons()) {
      this.drawButton(btn)
    }
  }

  /**
   * Render a centered `PopUpOK.dc6` (`268x176`) modal popup at `(268, 212)` (`D2Launch.dll` `0x6fa55090`).
   */
  private renderPopupModal(modal: {
    readonly title?: string | undefined
    readonly message: string
  }): void {
    const popupImg = this.images.get('popup-okcancel.png')
    if (popupImg) {
      this.ctx.drawImage(popupImg, 268, 212)
    }

    if (modal.title) {
      this.drawWrappedBitmapText(modal.title, 400, 232, 224, {
        font: 'fontformal12',
        color: 1,
        align: 'center',
        lineStep: 15,
        maxLines: 2,
      })
      this.drawWrappedBitmapText(modal.message, 400, 256, 224, {
        font: 'fontformal12',
        color: 0,
        align: 'center',
        lineStep: 15,
        maxLines: 4,
      })
    } else {
      this.drawWrappedBitmapText(modal.message, 400, 238, 224, {
        font: 'fontformal12',
        color: 0,
        align: 'center',
        lineStep: 16,
        maxLines: 4,
      })
    }

    for (const btn of this.getActiveButtons()) {
      this.drawButton(btn)
    }
  }

  private renderCharCreate(): void {
    const bg = this.images.get('bg-char-create.png')
    if (bg) this.ctx.drawImage(bg, 0, 0)

    const s = this.getLocalizedStrings()

    // Top banner: "Choose a class for your campaign"
    this.drawBitmapText(s.chooseClassTitle, 400, 18, {
      font: 'font30',
      color: 4,
      align: 'center',
    })

    // Active or hovered class name & lore description under the title banner
    const activeClassId = this.state.hoveredClass ?? this.state.selectedClass
    if (activeClassId) {
      const clsInfo = s.classes[activeClassId]
      this.drawBitmapText(clsInfo.name, 400, 52, {
        font: 'font24',
        color: 4,
        align: 'center',
      })
      this.drawWrappedBitmapText(clsInfo.desc, 400, 80, 420, {
        font: 'font16',
        color: 0,
        align: 'center',
        lineStep: 17,
      })
    }

    // Draw back-row classes first (those in `nu1` or `nu2`), then campfire flame, then selected/stepping classes (`fw`, `nu3`, `bw`)
    const backClasses: CampfireClassId[] = []
    const frontClasses: CampfireClassId[] = []
    for (const id of CAMPFIRE_CLASS_ORDER) {
      const phase = this.state.campfireClasses[id].phase
      if (phase === 'fw' || phase === 'nu3' || phase === 'bw') {
        frontClasses.push(id)
      } else {
        backClasses.push(id)
      }
    }

    for (const id of backClasses) {
      this.drawCampfireClass(id)
    }

    // Expansion Campfire flame (`fire.dc6`, D2Launch.dll 0x6fa63080: control anchor (345, 470) minus f0.offset (-34, 132) -> (379, 338), #701)
    const flameStrip = this.manifest!.animStrips['campfireFlame']
    if (!flameStrip || flameStrip.frames.length === 0) {
      throw new Error('Missing campfireFlame strip in manifest.json')
    }
    const flameFrame = getAnimImageLoopFrame(
      this.state.globalTick,
      flameStrip.frameCount,
      flameStrip.rate ?? CAMPFIRE_FLAME_CONTROL_SPEC.speed,
    )
    const flameF0 = flameStrip.frames[0]!
    const flameDrawX = CAMPFIRE_FLAME_CONTROL_SPEC.x - flameF0.anchorX
    const flameDrawY = CAMPFIRE_FLAME_CONTROL_SPEC.y - (flameF0.anchorY + flameF0.h)
    this.drawAnimStripFrame(
      flameStrip,
      flameFrame,
      flameDrawX,
      flameDrawY,
      flameStrip.drawMode ?? CAMPFIRE_FLAME_CONTROL_SPEC.drawMode,
    )

    for (const id of frontClasses) {
      this.drawCampfireClass(id)
    }

    // Bottom character name input and checkboxes (visible once a class is selected)
    if (this.state.selectedClass) {
      this.drawBitmapText(s.characterName, 318, 466, {
        font: 'font16',
        color: 4,
        align: 'left',
      })
      this.drawEditBox('charName', 318, 485, 175, 28, this.state.charName, {
        drawFrameImage: true,
        font: 'fontformal12',
        color: 0,
      })

      this.drawCheckbox(
        318,
        520,
        this.state.isExpansion,
        this.requireStr(22731, 'expansionCharacter'),
        4,
      )
      this.drawCheckbox(318, 540, this.state.isHardcore, s.hardcore, this.state.isHardcore ? 1 : 4)
      if (this.state.playMode !== 'single') {
        this.drawCheckbox(
          318,
          560,
          this.state.isLadder,
          this.requireStr(10927, 'ladderCharacter'),
          4,
        )
      }
    }

    if (this.state.charCreateError || this.state.lastError) {
      this.drawBitmapText(this.state.charCreateError || this.state.lastError || '', 400, 444, {
        font: 'fontformal12',
        color: 1,
        align: 'center',
      })
    }

    for (const btn of this.getActiveButtons()) {
      this.drawButton(btn)
    }
  }

  /**
   * Draw a campfire class in its current phase along with its required secondary overlay (`#702`, `#709`):
   * - `ba.fw_ov` (`drawMode = 5`, `DRAWMODE_NORMAL` opaque)
   * - `pa.fw_ov` (`drawMode = 5`, `DRAWMODE_NORMAL` opaque)
   * - `ne.{nu3,fw,bw}_ov` (`drawMode = 3`, `DRAWMODE_MODULATE` screen)
   * - `so.{nu3,fw,bw}_ov` (`drawMode = 3`, `DRAWMODE_MODULATE` screen)
   */
  private drawCampfireClass(id: CampfireClassId): void {
    const slot = this.state.campfireClasses[id]
    const strips = this.manifest?.campfireClasses[id]
    if (!strips) {
      throw new Error(`Missing campfire class strips for "${id}"`)
    }
    const baseStrip = strips[slot.phase]
    if (!baseStrip) {
      throw new Error(`Missing campfire base strip "${id}.${slot.phase}"`)
    }
    this.drawAnimStripFrame(
      baseStrip,
      slot.frameIndex,
      slot.anchorX,
      slot.anchorY,
      baseStrip.drawMode ?? 5,
    )
    const ovSpec = CAMPFIRE_OVERLAY_SPECS[id]?.[slot.phase]
    if (ovSpec) {
      const ovStrip = strips[ovSpec.stripKey]
      if (!ovStrip) {
        throw new Error(`Missing required campfire overlay strip "${id}.${ovSpec.stripKey}"`)
      }
      this.drawAnimStripFrame(
        ovStrip,
        slot.frameIndex,
        slot.anchorX,
        slot.anchorY,
        ovStrip.drawMode ?? ovSpec.drawMode,
      )
    }
  }

  private drawCheckbox(
    x: number,
    y: number,
    checked: boolean,
    label: string,
    labelColor: FrontendColorIndex = 4,
    sprite = 'clickbox.png',
  ): void {
    const cbImg = this.images.get(sprite)
    if (cbImg) {
      const w = Math.floor(cbImg.width / 2)
      const h = cbImg.height
      this.ctx.drawImage(cbImg, checked ? w : 0, 0, w, h, x, y, w, h)
    }
    this.drawBitmapText(label, x + 22, y + 1, {
      font: 'font16',
      color: labelColor,
      align: 'left',
    })
  }

  private drawRadioButton(
    x: number,
    y: number,
    selected: boolean,
    label: string,
    disabled = false,
  ): void {
    const rbImg = this.images.get('radiobutton.png')
    if (rbImg) {
      const w = Math.floor(rbImg.width / 2)
      const h = rbImg.height
      if (disabled) {
        this.ctx.save()
        this.ctx.globalAlpha = 0.5
        this.ctx.drawImage(rbImg, 0, 0, w, h, x, y, w, h)
        this.ctx.restore()
      } else {
        this.ctx.drawImage(rbImg, selected ? w : 0, 0, w, h, x, y, w, h)
      }
    }
    this.drawBitmapText(label, x + 22, y + 1, {
      font: 'font16',
      color: disabled ? 5 : 4,
      align: 'left',
    })
  }

  private renderCharSelect(): void {
    const bg = this.images.get('bg-char-select.png')
    if (bg) this.ctx.drawImage(bg, 0, 0)

    const s = this.getLocalizedStrings()
    const sRecord = s as unknown as Record<string, unknown>
    this.drawBitmapText(this.requireStr(5272, 'selectCharacterTitle'), 309, 22, {
      font: 'font30',
      color: 4,
      align: 'center',
    })

    // Top-right Realm info (only drawn when a gateway/realm is active)
    if (this.state.gateway.trim().length > 0) {
      const realmLabel = isChiFrontendActive()
        ? `${this.state.gateway} 伺服器`
        : `${this.state.gateway} Realm`
      this.drawBitmapText(realmLabel, 690, 56, {
        font: 'font16',
        color: 4,
        align: 'center',
      })
    }

    if (this.state.lastError) {
      this.drawBitmapText(this.state.lastError, 300, 56, {
        font: 'fontformal11',
        color: 1,
        align: 'center',
      })
    }

    // 8 character slots (2 columns x 4 rows)
    // Col 0: x = 37, Col 1: x = 309
    // Row tops: y = 85, 178, 271, 364 (height = 93 each)
    const boxImg = this.images.get('charselectbox.png')
    for (let i = 0; i < 8; i++) {
      const char = this.state.roster[i]
      if (!char) continue
      const col = i % 2
      const row = Math.floor(i / 2)
      const slotX = col === 0 ? 37 : 309
      const slotY = 85 + row * 93

      if (i === this.state.selectedSlotIndex && boxImg) {
        this.ctx.drawImage(boxImg, slotX, slotY)
      }

      // Draw animated Town-Neutral (TN) composite avatar standing on left side of slot (#696)
      const avatarFrame = this.state.avatarAnims[char.heroToken]?.frameIndex ?? 0
      this.drawCharacterAvatar(char, avatarFrame, slotX + 36, slotY + 82)

      // Right side metadata per D2Launch.dll (0x6fa4b040..0x6fa4b302):
      // Name (gold=4 or red=1 if Hardcore), localized Level & Class (#707),
      // EXPANSION CHARACTER (#22731, green=2), LADDER CHARACTER (#10927, gold=4), dynamic Expiration (#698)
      const textX = slotX + 78
      let lineY = slotY + 6
      this.drawBitmapText(char.name, textX, lineY, {
        font: 'font16',
        color: char.isHardcore ? 1 : 4,
        align: 'left',
      })
      lineY += 16
      const levelAndClassText = formatCharacterLevelAndClass(char.level, char.classId, sRecord)
      this.drawBitmapText(levelAndClassText, textX, lineY, {
        font: 'font16',
        color: 0,
        align: 'left',
      })
      lineY += 16
      if (char.isExpansion) {
        this.drawBitmapText(this.requireStr(22731, 'expansionCharacter'), textX, lineY, {
          font: 'font16',
          color: 2, // Bright Green (0x6fa4b241: push 2)
          align: 'left',
        })
        lineY += 16
      }
      if (char.isLadder) {
        this.drawBitmapText(this.requireStr(10927, 'ladderCharacter'), textX, lineY, {
          font: 'font16',
          color: 4, // Gold (0x6fa4b269: push 4)
          align: 'left',
        })
        lineY += 16
      }

      const expDays = char.expirationDays ?? computeCharacterExpirationDays(char.expiresAt)
      const expBanner = formatCharacterExpirationText(expDays, sRecord)
      if (expBanner !== null) {
        this.drawBitmapText(expBanner.text, textX, lineY, {
          font: 'fontformal10',
          color: expBanner.isUrgent ? 1 : 9,
          align: 'left',
        })
      }
    }

    for (const btn of this.getActiveButtons()) {
      this.drawButton(btn)
    }
  }

  private renderBnetLobby(): void {
    const bg = this.images.get('bg-waiting-room.png')
    if (bg) this.ctx.drawImage(bg, 0, 0)

    const s = this.getLocalizedStrings()
    const sRecord = s as unknown as Record<string, unknown>
    const L = s.lobby

    // Top-left & Top-right small burning D2 logos (`D2logoBlackBnet.dc6` + `D2logoBnet.dc6` at (84, 52) & (726, 52) per D2Multi.dll 0x6f9ea1b0 & 0x6f9ea240)
    const bnetBlackStrip = this.manifest!.animStrips['logoBnetBlack']
    const bnetFireStrip = this.manifest!.animStrips['logoBnetFire']
    const bnetBlackFrame = bnetBlackStrip
      ? getAnimImageLoopFrame(
          this.state.globalTick,
          bnetBlackStrip.frameCount,
          bnetBlackStrip.rate ?? 1,
        )
      : 0
    const bnetFireFrame = bnetFireStrip
      ? getAnimImageLoopFrame(
          this.state.globalTick,
          bnetFireStrip.frameCount,
          bnetFireStrip.rate ?? 1,
        )
      : 0
    for (const logoX of [84, 726]) {
      this.drawAnimStripFrame(bnetBlackStrip, bnetBlackFrame, logoX, 52, false)
      this.drawAnimStripFrame(bnetFireStrip, bnetFireFrame, logoX, 52, true)
    }

    // Left Chat Window channel header & messages (`D2Multi.dll` 0x6f9ea120, #704)
    if (this.state.channelName.trim().length > 0) {
      this.drawBitmapText(
        this.state.channelName,
        D2MULTI_CONTROL_RECORDS.channelTitle.centerX,
        D2MULTI_CONTROL_RECORDS.channelTitle.y,
        {
          font: 'font16',
          color: 4,
          align: 'center',
        },
      )
    }
    const visibleMessages = this.state.chatMessages.slice(-14)
    const visibleEntries = this.state.chatEntries.slice(-14)
    const entryOffset = visibleMessages.length - visibleEntries.length
    for (let i = 0; i < visibleMessages.length; i++) {
      const msg = visibleMessages[i]!
      const entry = i >= entryOffset ? visibleEntries[i - entryOffset] : undefined
      const msgColor: FrontendColorIndex =
        entry && entry.text === msg && entry.color !== undefined
          ? (entry.color as FrontendColorIndex)
          : 0
      this.drawBitmapText(msg, 32, 114 + i * 20, {
        font: 'fontformal11',
        color: msgColor,
        align: 'left',
      })
    }

    // Chat Input box (`x = 28, y = 418, w = 335, h = 28` inside braided frame per D2Multi.dll 0x6f9ea150)
    this.drawEditBox('chatInput', 28, 418, 335, 28, this.state.chatInput, {
      drawFrameImage: false,
      font: 'fontformal11',
      color: 0,
    })

    // Center Chat Gem (`gembutton.dc6` at `(398, 461)` inside the Celtic knot medallion per D2Multi.dll 0x6f9ea270)
    const gemImg = this.images.get('gembutton.png')
    if (gemImg) {
      const gw = Math.floor(gemImg.width / 2)
      const gh = gemImg.height
      this.ctx.drawImage(gemImg, this.state.gemActivated ? gw : 0, 0, gw, gh, 398, 461, gw, gh)
    }

    // Right-hand `Create Game` (`create-game-bg.png` @ 0x6f9ea930) / `Join Game` (`join-game-bg.png` @ 0x6f9ea510) sub-panel at `(415, 74)`
    const isJoinPanel = this.state.lobbySubPanel === 'join'
    const panelBg = this.images.get(isJoinPanel ? 'join-game-bg.png' : 'create-game-bg.png')
    if (panelBg) {
      this.ctx.drawImage(panelBg, 415, 74)
    }

    if (isJoinPanel) {
      // Title: `strId = 5151` ("JOIN GAME"), `x = 496, y_top = 84, w = 200, h = 22` (`0x6f9ea540`)
      this.drawBitmapText(this.requireStr(5151, 'lobby.joinGameTitle'), 596, 84, {
        font: 'font24',
        color: 4,
        align: 'center',
      })

      // Side-by-side labels & editboxes (`0x6f9ea570..0x6f9ea630`):
      // - `Game Name` label at `(428, 109)`, editbox inside gold border `(425, 123, 167, 25)` (`x_text = 432`)
      // - `Password` label at `(602, 109)`, editbox inside gold border `(599, 123, 168, 25)` (`x_text = 606`)
      this.drawBitmapText(L.gameName, 428, 109, { font: 'font16', color: 4, align: 'left' })
      this.drawEditBox('gameName', 425, 123, 167, 25, this.state.gameName, {
        drawFrameImage: false,
        font: 'fontformal12',
        color: 0,
      })

      this.drawBitmapText(L.gamePassword, 602, 109, { font: 'font16', color: 4, align: 'left' })
      this.drawEditBox('gamePassword', 599, 123, 168, 25, this.state.gamePassword, {
        drawFrameImage: false,
        font: 'fontformal12',
        color: 0,
      })

      // Game list header: `strId = 5275` ("Game Name Players") at `(431, 196)` (`0x6f9ea5d0`)
      this.drawBitmapText(this.requireStr(5275, 'lobby.joinGameListHeader'), 431, 196, {
        font: 'font16',
        color: 4,
        align: 'left',
      })

      // Left Game List TextBox (`0x6f9ea660`: `x = 432, y = 220, w = 160, h = 173`, `fontformal10` via `0x6f9e9c60`, 2 columns at `+0` and `+0x87 = +135` per `0x6f9e4a8b..0x6f9e4aa5`)
      const games = this.state.realmGames
      const listVisibleRows = 11
      const listRowStep = 15
      const maxListScroll = Math.max(0, games.length - listVisibleRows)
      const listStartIdx = Math.max(0, Math.min(this.state.joinGameListScroll, maxListScroll))

      this.ctx.save()
      this.ctx.beginPath()
      this.ctx.rect(428, 216, 162, 177)
      this.ctx.clip()
      for (let i = 0; i < listVisibleRows; i++) {
        const g = games[listStartIdx + i]
        if (!g) break
        const rowY = 220 + i * listRowStep
        const isSelected =
          this.state.selectedGameName !== '' && this.state.selectedGameName === g.name
        if (isSelected) {
          this.ctx.fillStyle = 'rgba(210, 175, 85, 0.22)'
          this.ctx.fillRect(428, rowY, 162, listRowStep)
        }
        const rowColor: FrontendColorIndex = isSelected ? 4 : 0
        this.ctx.save()
        this.ctx.beginPath()
        this.ctx.rect(428, 216, 135, 177)
        this.ctx.clip()
        this.drawBitmapText(g.name, 432, rowY, {
          font: 'fontformal10',
          color: rowColor,
          align: 'left',
        })
        this.ctx.restore()
        this.drawBitmapText(String(g.playerCount), 567, rowY, {
          font: 'fontformal10',
          color: rowColor,
          align: 'left',
        })
      }
      this.ctx.restore()

      // Right Game Details TextBox (`0x6f9ea780`: `x = 609, y = 199, w = 143, h = 194`, formatted by `0x6f9e3280`)
      const detailLines = this.getWrappedJoinGameDetailLines()
      const detailVisibleRows = 14
      const detailRowStep = 13
      const maxDetailScroll = Math.max(0, detailLines.length - detailVisibleRows)
      const detailStartIdx = Math.max(
        0,
        Math.min(this.state.joinGameDetailsScroll, maxDetailScroll),
      )

      this.ctx.save()
      this.ctx.beginPath()
      this.ctx.rect(608, 195, 143, 198)
      this.ctx.clip()
      for (let i = 0; i < detailVisibleRows; i++) {
        const line = detailLines[detailStartIdx + i]
        if (!line) break
        if (line.text.length > 0) {
          this.drawBitmapText(line.text, 609, 199 + i * detailRowStep, {
            font: 'fontformal10',
            color: line.color,
            align: 'left',
          })
        }
      }
      this.ctx.restore()

      // Scrollbars (`joingamescrollbars.dc6` / `scrollbar.png`: left list @ `x = 592, y = 214..394`, right details @ `x = 753, y = 192..394`)
      const sbImg = this.images.get('scrollbar.png')
      if (sbImg) {
        const fw = 12
        const fh = 14
        // Left list scrollbar (`0x6f9e9c94`)
        this.ctx.drawImage(sbImg, 0, 0, fw, fh, 592, 214, fw, fh)
        this.ctx.drawImage(sbImg, fw, 0, fw, fh, 592, 380, fw, fh)
        const listRatio = maxListScroll > 0 ? listStartIdx / maxListScroll : 0
        const listThumbY = Math.round(228 + listRatio * (366 - 228))
        this.ctx.drawImage(sbImg, fw * 4, 0, fw, fh, 592, listThumbY, fw, fh)

        // Right details scrollbar (`0x6f9e9ca0`)
        this.ctx.drawImage(sbImg, 0, 0, fw, fh, 753, 192, fw, fh)
        this.ctx.drawImage(sbImg, fw, 0, fw, fh, 753, 380, fw, fh)
        const detailRatio = maxDetailScroll > 0 ? detailStartIdx / maxDetailScroll : 0
        const detailThumbY = Math.round(206 + detailRatio * (366 - 206))
        this.ctx.drawImage(sbImg, fw * 4, 0, fw, fh, 753, detailThumbY, fw, fh)
      }
    } else {
      this.drawBitmapText(L.createGameTitle, 596, 88, {
        font: 'font24',
        color: 4,
        align: 'center',
      })

      // 1. Game Name (`x = 427, y = 137, w = 188, h = 25` per D2Multi.dll 0x6f9ea990 & 0x6f9eaab0)
      this.drawBitmapText(L.gameName, 427, 119, { font: 'font16', color: 4, align: 'left' })
      this.drawEditBox('gameName', 427, 137, 188, 25, this.state.gameName, {
        drawFrameImage: false,
        font: 'fontformal12',
        color: 0,
      })

      // 2. Password (`x = 427, y = 191, w = 188, h = 25` per D2Multi.dll 0x6f9ea9c0 & 0x6f9eaae0)
      this.drawBitmapText(L.gamePassword, 427, 173, { font: 'font16', color: 4, align: 'left' })
      this.drawEditBox('gamePassword', 427, 191, 188, 25, this.state.gamePassword, {
        drawFrameImage: false,
        font: 'fontformal12',
        color: 0,
      })

      // 3. Game Description (`x = 427, y = 245, w = 342, h = 25` per D2Multi.dll 0x6f9ea9f0 & 0x6f9eab10)
      this.drawBitmapText(L.gameDescription, 427, 227, { font: 'font16', color: 4, align: 'left' })
      this.drawEditBox('gameDescription', 427, 245, 342, 25, this.state.gameDescription, {
        drawFrameImage: false,
        font: 'fontformal12',
        color: 0,
      })

      // 4. Max Number of Players (`x = 655, y = 278, w = 42, h = 29` per create-game-bg.png box & D2Multi.dll 0x6f9eaa20)
      this.drawBitmapText(L.maxPlayers, 427, 286, { font: 'font16', color: 4, align: 'left' })
      this.drawEditBox('maxPlayers', 655, 278, 42, 29, this.state.maxPlayers, {
        drawFrameImage: false,
        font: 'fontformal12',
        color: 0,
      })

      // 5. Character Difference (`x = 655, y = 315, w = 42, h = 29` per create-game-bg.png box & D2Multi.dll 0x6f9eaa50..0x6f9eac00)
      this.drawCheckbox(
        431,
        323,
        this.state.charDifferenceEnabled,
        L.charDifference,
        this.state.charDifferenceEnabled ? 4 : 5,
        'joingameclickbox.png',
      )
      if (!this.state.charDifferenceEnabled) {
        const glbImg = this.images.get('grey-level-box.png')
        if (glbImg) {
          this.ctx.drawImage(glbImg, 659, 316)
        }
      }
      this.drawEditBox('charDifference', 655, 315, 42, 29, this.state.charDifference, {
        drawFrameImage: false,
        font: 'fontformal12',
        color: this.state.charDifferenceEnabled ? 0 : 5,
      })

      // 6. Select Difficulty (`Normal`, `Nightmare`, `Hell` per D2Multi.dll 0x6f9eac30..0x6f9ead20 & 0x6f9e517b..0x6f9e535f)
      const selectedCharForDiff = this.state.roster[this.state.selectedSlotIndex]
      const nightmareUnlocked = isDifficultyUnlocked(selectedCharForDiff, 'nightmare')
      const hellUnlocked = isDifficultyUnlocked(selectedCharForDiff, 'hell')
      this.drawBitmapText(L.selectDifficulty, 427, 350, { font: 'font16', color: 4, align: 'left' })
      this.drawRadioButton(430, 368, this.state.difficulty === 'normal', L.normal, false)
      this.drawRadioButton(
        555,
        368,
        this.state.difficulty === 'nightmare' && nightmareUnlocked,
        L.nightmare,
        !nightmareUnlocked,
      )
      this.drawRadioButton(
        698,
        368,
        this.state.difficulty === 'hell' && hellUnlocked,
        L.hell,
        !hellUnlocked,
      )
    }

    const lobbyErr = this.state.createGameError || this.state.lastError
    if (lobbyErr) {
      this.drawWrappedBitmapText(lobbyErr, 596, isJoinPanel ? 158 : 383, 330, {
        font: 'fontformal10',
        color: 1,
        align: 'center',
        lineStep: 12,
        maxLines: 2,
      })
    }

    // Bottom Channel Character Lineup Bar (`y = 500..585` per D2Multi.dll 0x6f9ea0c0 / 0x6f9d2940, #696 & #707)
    const selectedChar = this.state.roster[this.state.selectedSlotIndex]
    if (selectedChar) {
      const avatarFrame = this.state.avatarAnims[selectedChar.heroToken]?.frameIndex ?? 0
      this.drawCharacterAvatar(selectedChar, avatarFrame, 64, 578)
      this.drawBitmapText(selectedChar.name, 134, 528, {
        font: 'font16',
        color: selectedChar.isHardcore ? 1 : 4,
        align: 'left',
      })
      const levelAndClassText = formatCharacterLevelAndClass(
        selectedChar.level,
        selectedChar.classId,
        sRecord,
      )
      this.drawBitmapText(levelAndClassText, 134, 548, {
        font: 'fontformal10',
        color: 0,
        align: 'left',
      })
    }

    for (const btn of this.getStageButtons()) {
      this.drawButton(btn)
    }
  }

  /**
   * Format and word-wrap the right-hand Game Details lines (`D2Multi.dll` `0x6f9e3280` & `0x6f9ea780`)
   * to fit inside the `w = 143` details box (`x = 609..752`) using `fontformal10`.
   */
  private getWrappedJoinGameDetailLines(): readonly {
    readonly text: string
    readonly color: FrontendColorIndex
  }[] {
    if (!this.state.selectedGameInfo || !this.manifest) return []
    const sRecord = this.getLocalizedStrings() as unknown as Record<string, unknown>
    const rawLines = formatJoinGameDetailLines(this.state.selectedGameInfo, sRecord)
    const wrapped: { readonly text: string; readonly color: FrontendColorIndex }[] = []
    const maxWidth = 140
    for (const entry of rawLines) {
      const color = entry.color as FrontendColorIndex
      if (entry.text.length === 0) {
        wrapped.push({ text: '', color })
        continue
      }
      const tokens = this.tokenizeWrapText(entry.text)
      let current = ''
      let prevIsCjk = false
      for (const { token, isCjk } of tokens) {
        const sep = current && !prevIsCjk && !isCjk ? ' ' : ''
        const candidate = current ? `${current}${sep}${token}` : token
        if (this.measureBitmapText(candidate, 'fontformal10') <= maxWidth || !current) {
          current = candidate
          prevIsCjk = isCjk
        } else {
          wrapped.push({ text: current, color })
          current = token
          prevIsCjk = isCjk
        }
      }
      if (current) {
        wrapped.push({ text: current, color })
      }
    }
    return wrapped
  }

  /**
   * D2Client.dll victory screen `0x6faf3a70` (expansion branch, 800x600):
   * `endgame2.dc6` (12 cells, bottoms 256/512/600), Font42 gold lines (`0x6faf3710`, `0x6faf2c70`) and the
   * `endgameok.dc6` button with string 5102 in Font16 white.
   */
  private renderEndGame(): void {
    const endGame = this.state.endGame
    if (!endGame) {
      throw new Error('end_game stage without victory screen state (S2C 0x61 7 completion)')
    }
    const L = END_GAME_LAYOUT_113C
    const bg = this.images.get('endgame/endgame2.png')
    const ok = this.images.get('endgame/endgameok.png')
    if (!bg || !ok) {
      throw new Error('Missing victory screen images endgame/endgame2.png / endgame/endgameok.png')
    }
    this.ctx.drawImage(bg, 0, 0)

    const font42 = this.fontMetas.font42
    const font16 = this.fontMetas.font16
    if (!font42 || !font16) {
      throw new Error('Missing font42 / font16 metrics for the victory screen')
    }
    const h42 = font42.glyphs[65]?.frameH ?? font42.lineHeight
    const h16 = font16.glyphs[65]?.frameH ?? font16.lineHeight
    const gold = { font: 'font42', color: 4, align: 'center', atlasKey: 'endgame/font42-c4.png' } as const
    this.drawBitmapText(this.requireStr(5098), 400, L.congratsBottom - h42, gold)
    this.drawBitmapText(endGame.nameLine, 400, L.nameBottom - h42, gold)
    this.drawBitmapText(this.requireStr(5100), 400, L.knownAsBottom - h42, gold)
    this.drawBitmapText(endGame.titleLine, 400, L.titleBottom - h42, gold)

    const frame = endGame.pressed ? 1 : 0
    this.ctx.drawImage(ok, frame * L.okW, 0, L.okW, L.okH, L.okX, L.okBottom - L.okH, L.okW, L.okH)
    const label = this.requireStr(5102, 'ok')
    const shift = endGame.pressed ? 2 : 0
    const labelX = 400 - Math.trunc(this.measureBitmapText(label, 'font16') / 2) - shift
    this.drawBitmapText(label, labelX, L.okLabelBottom + shift - h16, {
      font: 'font16',
      color: 0,
      atlasKey: 'endgame/font16-c0.png',
    })
  }

  /** OK button hit test of `0x6faf2e70` / `0x6faf2f00`: x in [w/2-48, w/2+48], y in [h-112, h-80] (inclusive). */
  private isInsideEndGameOk(x: number, y: number): boolean {
    const L = END_GAME_LAYOUT_113C
    return x >= L.okX && x <= L.okX + L.okW && y >= L.okBottom - L.okH && y <= L.okBottom
  }

  /** `0x6fbcc38c = 1`: the victory loop ends; the client continues to the lobby. */
  private finishEndGame(): void {
    if (!this.onEndGameDone) {
      throw new Error('FrontendRenderer.onEndGameDone is not set: the victory screen cannot return to the lobby')
    }
    this.state.endGame = null
    this.onEndGameDone(this.state)
  }

  private renderDoorLoading(): void {
    const ctx = this.ctx
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 800, 600)

    const doorStrip = this.manifest?.animStrips['loadingDoor']
    if (!doorStrip || doorStrip.frames.length === 0) {
      throw new Error('Missing loadingDoor animation strip in manifest.json')
    }
    const img = this.images.get(doorStrip.file)
    if (!img) {
      throw new Error(`Missing loaded image for loadingDoor strip "${doorStrip.file}"`)
    }
    const idx = Math.max(0, Math.min(doorStrip.frames.length - 1, this.state.doorFrame))
    const f = doorStrip.frames[idx]!
    // Per D2Client.dll 0x6fb71935..0x6fb71971:
    // Loadingscreen.dc6 is 256x256 (0x100x0x100), drawn 1:1 centered at:
    //   x = (screenW / 2) - 0x80 = 400 - 128 = 272
    //   y_bottom = (screenH / 2) + 0x80 = 300 + 128 = 428 -> y_top = 428 - 256 = 172
    const drawW = f.w
    const drawH = f.h
    const drawX = Math.floor((800 - drawW) / 2)
    const drawY = Math.floor((600 - drawH) / 2)
    ctx.drawImage(img, f.x, f.y, f.w, f.h, drawX, drawY, drawW, drawH)
  }

  /**
   * Convert a pointer event on `this.canvas` to 800x600 logical coordinates.
   */
  eventToCanvasCoords(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return { x: 400, y: 300 }
    const x = ((e.clientX - rect.left) / rect.width) * 800
    const y = ((e.clientY - rect.top) / rect.height) * 600
    return {
      x: Math.max(0, Math.min(792, x)),
      y: Math.max(0, Math.min(592, y)),
    }
  }

  handleMouseMove(x: number, y: number, nowMs = performance.now()): void {
    this.lastMouseX = x
    this.lastMouseY = y
    this.cursor.handleMouseMove(x, y, nowMs)
    if (this.state.stage === 'char_create') {
      let found: CampfireClassId | null = null
      for (const id of CAMPFIRE_CLASS_ORDER) {
        const hb = getCampfireSlotHitBox(this.state.campfireClasses[id])
        if (x >= hb.x && x < hb.x + hb.w && y >= hb.y && y < hb.y + hb.h) {
          found = id
          break
        }
      }
      hoverCampfireClass(this.state, found)
    }
  }

  handleMouseDown(x: number, y: number, nowMs = performance.now()): void {
    this.inputVersion += 1
    this.cursor.handleMouseDown(nowMs)
    this.pressedButtonId = null
    if (this.state.stage === 'end_game') {
      // 0x6faf2f00: pressed only when the button-down lands inside the OK button.
      if (this.state.endGame) this.state.endGame.pressed = this.isInsideEndGameOk(x, y)
      return
    }
    for (const btn of this.getActiveButtons()) {
      if (!btn.disabled && x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        this.pressedButtonId = btn.id
        return
      }
    }
  }

  handleMouseUp(x: number, y: number, nowMs = performance.now()): void {
    this.inputVersion += 1
    this.cursor.handleMouseUp(nowMs)
    const pressedId = this.pressedButtonId
    this.pressedButtonId = null

    if (this.state.stage === 'end_game') {
      // 0x6faf2e70: always releases the button; a release inside it ends the screen.
      if (this.state.endGame) this.state.endGame.pressed = false
      if (this.isInsideEndGameOk(x, y)) {
        this.onPlaySound?.(4)
        this.finishEndGame()
      }
      return
    }

    for (const btn of this.getActiveButtons()) {
      if (
        !btn.disabled &&
        btn.id === pressedId &&
        x >= btn.x &&
        x <= btn.x + btn.w &&
        y >= btn.y &&
        y <= btn.y + btn.h
      ) {
        this.onPlaySound?.(4)
        btn.onClick()
        this.blurImeSink()
        return
      }
    }

    if (this.state.popupModal !== null) {
      this.blurImeSink()
      return
    }

    // Stage-specific non-button interactions (editboxes, scrollbars, campfire heroes, character slots, checkboxes, radio buttons, chat gem)
    if (this.state.stage === 'bnet_terms_of_use') {
      const maxLine = this.getTermsMaxScrollLine()
      if (x >= 630 && x <= 682 && y >= 145 && y <= 165) {
        this.onPlaySound?.(4)
        scrollTermsOfUse(this.state, -1, maxLine)
      } else if (x >= 630 && x <= 682 && y >= 425 && y <= 469) {
        this.onPlaySound?.(4)
        scrollTermsOfUse(this.state, 1, maxLine)
      } else if (x >= 630 && x <= 682 && y > 165 && y < 425) {
        const ratio = Math.max(0, Math.min(1, (y - 165) / (425 - 165)))
        const targetLine = Math.round(ratio * maxLine)
        scrollTermsOfUse(this.state, targetLine - this.state.termsScrollLine, maxLine)
      }
      this.blurImeSink()
      return
    }

    if (this.state.stage === 'bnet_login') {
      if (x >= 278 && x <= 521 && y >= 316 && y <= 347) {
        this.setActiveInput('accountName')
      } else if (x >= 278 && x <= 521 && y >= 376 && y <= 407) {
        this.setActiveInput('accountPassword')
      } else {
        this.blurImeSink()
      }
      return
    }

    if (this.state.stage === 'bnet_create_account') {
      if (x >= 278 && x <= 521 && y >= 318 && y <= 352) {
        this.setActiveInput('accountName')
      } else if (x >= 278 && x <= 521 && y >= 372 && y <= 411) {
        this.setActiveInput('accountPassword')
      } else if (x >= 278 && x <= 521 && y >= 426 && y <= 471) {
        this.setActiveInput('accountVerifyPassword')
      } else {
        this.blurImeSink()
      }
      return
    }

    if (this.state.stage === 'char_create') {
      // Check if a campfire class was clicked using frame-0 cel bounds (`0x6f8f07c0`, #703)
      for (const id of CAMPFIRE_CLASS_ORDER) {
        const hb = getCampfireSlotHitBox(this.state.campfireClasses[id])
        if (x >= hb.x && x < hb.x + hb.w && y >= hb.y && y < hb.y + hb.h) {
          this.onPlaySound?.(4)
          selectCampfireClass(this.state, id)
          this.setActiveInput('charName', false)
          return
        }
      }
      if (this.state.selectedClass) {
        if (x >= 318 && x <= 493 && y >= 465 && y <= 515) {
          this.setActiveInput('charName')
          return
        }
        if (x >= 318 && x <= 520 && y >= 518 && y <= 536) {
          this.onPlaySound?.(4)
          this.state.isExpansion = !this.state.isExpansion
          this.blurImeSink()
          return
        }
        if (x >= 318 && x <= 480 && y >= 538 && y <= 556) {
          this.onPlaySound?.(4)
          this.state.isHardcore = !this.state.isHardcore
          this.blurImeSink()
          return
        }
        if (this.state.playMode !== 'single' && x >= 318 && x <= 510 && y >= 558 && y <= 576) {
          this.onPlaySound?.(4)
          this.state.isLadder = !this.state.isLadder
          this.blurImeSink()
          return
        }
      }
      this.blurImeSink()
      return
    }

    if (this.state.stage === 'char_select') {
      this.setActiveInput(null, false)
      for (let i = 0; i < this.state.roster.length; i++) {
        const col = i % 2
        const row = Math.floor(i / 2)
        const slotX = col === 0 ? 37 : 309
        const slotY = 85 + row * 93
        if (x >= slotX && x <= slotX + 272 && y >= slotY && y <= slotY + 93) {
          this.onPlaySound?.(4)
          if (this.lastClickSlotIndex === i && nowMs - this.lastClickSlotTime < 450) {
            this.state.selectedSlotIndex = i
            if (this.asyncHandlers?.onSelectCharacter) {
              void this.asyncHandlers.onSelectCharacter(this.state)
            } else if (confirmCharacterSelect(this.state) && this.state.playMode === 'single') {
              this.onEnterDoorLoading?.(this.state)
            }
          } else {
            this.state.selectedSlotIndex = i
            this.lastClickSlotIndex = i
            this.lastClickSlotTime = nowMs
          }
          return
        }
      }
      return
    }

    if (this.state.stage === 'bnet_lobby') {
      // Chat Gem at (398, 461, 20x24)
      if (x >= 392 && x <= 424 && y >= 455 && y <= 485) {
        this.onPlaySound?.(4)
        toggleChatGem(
          this.state,
          this.manifest
            ? (this.getLocalizedStrings() as unknown as Record<string, unknown>)
            : undefined,
        )
        this.blurImeSink()
        return
      }
      // Left Chat Input box
      if (x >= 28 && x <= 363 && y >= 418 && y <= 446) {
        this.setActiveInput('chatInput')
        return
      }
      if (this.state.lobbySubPanel === 'join') {
        // Side-by-side Join Game editboxes (`0x6f9ea600` & `0x6f9ea630`):
        // - `gameName` inside gold border `(425, 123, 167, 25)`
        // - `gamePassword` inside gold border `(599, 123, 168, 25)`
        if (x >= 425 && x <= 592 && y >= 123 && y <= 148) {
          this.setActiveInput('gameName')
          return
        }
        if (x >= 599 && x <= 767 && y >= 123 && y <= 148) {
          this.setActiveInput('gamePassword')
          return
        }
        // Left Game List scrollbar (`x = 592, y = 214..394`, `w = 12`)
        if (x >= 590 && x <= 606 && y >= 214 && y <= 394) {
          const maxListScroll = Math.max(0, this.state.realmGames.length - 11)
          if (y <= 228) {
            this.onPlaySound?.(4)
            this.state.joinGameListScroll = Math.max(0, this.state.joinGameListScroll - 1)
          } else if (y >= 380) {
            this.onPlaySound?.(4)
            this.state.joinGameListScroll = Math.min(
              maxListScroll,
              this.state.joinGameListScroll + 1,
            )
          } else {
            const ratio = Math.max(0, Math.min(1, (y - 228) / (380 - 228)))
            this.state.joinGameListScroll = Math.round(ratio * maxListScroll)
          }
          this.blurImeSink()
          return
        }
        // Right Game Details scrollbar (`x = 753, y = 192..394`, `w = 12`)
        if (x >= 751 && x <= 767 && y >= 192 && y <= 394) {
          const maxDetailScroll = Math.max(0, this.getWrappedJoinGameDetailLines().length - 14)
          if (y <= 206) {
            this.onPlaySound?.(4)
            this.state.joinGameDetailsScroll = Math.max(0, this.state.joinGameDetailsScroll - 1)
          } else if (y >= 380) {
            this.onPlaySound?.(4)
            this.state.joinGameDetailsScroll = Math.min(
              maxDetailScroll,
              this.state.joinGameDetailsScroll + 1,
            )
          } else {
            const ratio = Math.max(0, Math.min(1, (y - 206) / (380 - 206)))
            this.state.joinGameDetailsScroll = Math.round(ratio * maxDetailScroll)
          }
          this.blurImeSink()
          return
        }
        // Left Game List rows (`0x6f9ea660` & `0x6f9e4730`: `x = 432, y = 220 + i*15, w = 160, h = 173`)
        if (x >= 428 && x <= 589 && y >= 216 && y <= 393) {
          const listVisibleRows = 11
          const maxListScroll = Math.max(0, this.state.realmGames.length - listVisibleRows)
          const startIdx = Math.max(0, Math.min(this.state.joinGameListScroll, maxListScroll))
          const relRow = Math.floor(Math.max(0, y - 220) / 15)
          if (relRow >= 0 && relRow < listVisibleRows) {
            const game = this.state.realmGames[startIdx + relRow]
            if (game) {
              this.onPlaySound?.(4)
              this.state.selectedGameName = game.name
              this.state.gameName = game.name
              this.setActiveInput('gameName', false)
              this.state.joinGameDetailsScroll = 0
              this.state.createGameError = null
              if (
                this.lastClickJoinGameName === game.name &&
                nowMs - this.lastClickJoinGameTime < 500
              ) {
                this.lastClickJoinGameName = ''
                this.lastClickJoinGameTime = 0
                this.triggerJoinGame()
              } else {
                this.lastClickJoinGameName = game.name
                this.lastClickJoinGameTime = nowMs
                if (this.asyncHandlers?.onSelectJoinGame) {
                  void this.asyncHandlers.onSelectJoinGame(this.state, game.name)
                }
              }
            }
          }
          this.blurImeSink()
          return
        }
        this.blurImeSink()
        return
      }
      // Vertically stacked Create Game editboxes (`0x6f9ea990..0x6f9eab10`)
      if (x >= 427 && x <= 615 && y >= 137 && y <= 162) {
        this.setActiveInput('gameName')
        return
      }
      if (x >= 427 && x <= 615 && y >= 191 && y <= 216) {
        this.setActiveInput('gamePassword')
        return
      }
      if (x >= 427 && x <= 769 && y >= 245 && y <= 270) {
        this.setActiveInput('gameDescription')
        return
      }
      // Max Number of Players label & editbox (`x = 427..705, y = 276..310`)
      if (x >= 427 && x <= 705 && y >= 276 && y <= 310) {
        this.setActiveInput('maxPlayers')
        return
      }
      // Character Difference checkbox (`x = 431..649, y = 315..346`)
      if (x >= 431 && x <= 649 && y >= 315 && y <= 346) {
        this.onPlaySound?.(4)
        this.state.charDifferenceEnabled = !this.state.charDifferenceEnabled
        if (this.state.charDifferenceEnabled) {
          if (!this.state.charDifference.trim()) {
            this.state.charDifference = '99'
          }
          this.setActiveInput('charDifference')
        } else if (this.state.activeInput === 'charDifference') {
          this.setActiveInput('gameName', false)
        } else {
          this.blurImeSink()
        }
        return
      }
      // Character Difference editbox (`x = 650..705, y = 313..346`)
      if (x >= 650 && x <= 705 && y >= 313 && y <= 346) {
        this.state.charDifferenceEnabled = true
        if (!this.state.charDifference.trim()) {
          this.state.charDifference = '99'
        }
        this.setActiveInput('charDifference')
        return
      }
      // Difficulty radio buttons (`Normal`, `Nightmare`, `Hell` gated by character progression)
      const selectedChar = this.state.roster[this.state.selectedSlotIndex]
      const diffs: { id: GameDifficulty; x: number; w: number }[] = [
        { id: 'normal', x: 430, w: 95 },
        { id: 'nightmare', x: 555, w: 125 },
        { id: 'hell', x: 698, w: 80 },
      ]
      for (const d of diffs) {
        if (x >= d.x && x <= d.x + d.w && y >= 364 && y <= 388) {
          if (isDifficultyUnlocked(selectedChar, d.id)) {
            this.onPlaySound?.(4)
            this.state.difficulty = d.id
            this.state.createGameError = null
          }
          this.blurImeSink()
          return
        }
      }
      this.blurImeSink()
      return
    }
    this.blurImeSink()
  }

  handleWheel(deltaY: number, x?: number, y?: number): void {
    this.inputVersion += 1
    if (this.state.popupModal !== null) return
    if (this.state.stage === 'bnet_terms_of_use') {
      const deltaLines = deltaY > 0 ? 3 : deltaY < 0 ? -3 : 0
      if (deltaLines !== 0) {
        scrollTermsOfUse(this.state, deltaLines, this.getTermsMaxScrollLine())
      }
    } else if (this.state.stage === 'bnet_lobby' && this.state.lobbySubPanel === 'join') {
      const deltaLines = deltaY > 0 ? 3 : deltaY < 0 ? -3 : 0
      if (deltaLines !== 0) {
        const px = x ?? this.lastMouseX
        const py = y ?? this.lastMouseY
        if (px >= 605 && px <= 768 && py >= 191 && py <= 395) {
          const maxDetailScroll = Math.max(0, this.getWrappedJoinGameDetailLines().length - 14)
          this.state.joinGameDetailsScroll = Math.max(
            0,
            Math.min(maxDetailScroll, this.state.joinGameDetailsScroll + deltaLines),
          )
        } else if (px >= 425 && px < 605 && py >= 191 && py <= 395) {
          const maxListScroll = Math.max(0, this.state.realmGames.length - 11)
          this.state.joinGameListScroll = Math.max(
            0,
            Math.min(maxListScroll, this.state.joinGameListScroll + deltaLines),
          )
        }
      }
    }
  }

  handleKeyDown(e: KeyboardEvent): void {
    this.inputVersion += 1
    if (this.state.stage === 'in_game' || this.state.stage === 'door_loading') return

    if (this.state.stage === 'end_game') {
      // 0x6faf2170 (WM_KEYDOWN): any key that was not already down (lParam bit 30) ends the screen.
      e.preventDefault()
      if (!e.repeat) {
        this.onPlaySound?.(4)
        this.finishEndGame()
      }
      return
    }

    if (this.state.popupModal !== null) {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        e.preventDefault()
        this.onPlaySound?.(4)
        dismissPopupModal(this.state)
      }
      return
    }

    if (this.state.stage === 'bnet_terms_of_use') {
      const maxLine = this.getTermsMaxScrollLine()
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        scrollTermsOfUse(this.state, -2, maxLine)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        scrollTermsOfUse(this.state, 2, maxLine)
        return
      }
      if (e.key === 'PageUp') {
        e.preventDefault()
        scrollTermsOfUse(this.state, -15, maxLine)
        return
      }
      if (e.key === 'PageDown') {
        e.preventDefault()
        scrollTermsOfUse(this.state, 15, maxLine)
        return
      }
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      if (this.state.stage === 'bnet_connecting') {
        this.onPlaySound?.(4)
        cancelConnecting(this.state)
        this.setActiveInput(null, false)
      } else if (this.state.stage === 'bnet_login') {
        this.onPlaySound?.(4)
        this.state.stage = 'main_menu'
        this.state.stageTicks = 0
        this.setActiveInput(null, false)
      } else if (this.state.stage === 'bnet_terms_of_use') {
        this.onPlaySound?.(4)
        disagreeTermsOfUse(this.state)
        this.setActiveInput(this.state.activeInput, false)
      } else if (this.state.stage === 'bnet_create_account') {
        this.onPlaySound?.(4)
        cancelCreateAccount(this.state)
        this.setActiveInput(this.state.activeInput, false)
      } else if (this.state.stage === 'bnet_please_read') {
        this.onPlaySound?.(4)
        cancelPleaseRead(this.state)
        this.setActiveInput(this.state.activeInput, false)
      } else if (this.state.stage === 'char_create') {
        this.onPlaySound?.(4)
        if (this.state.roster.length > 0) {
          this.state.stage = 'char_select'
          this.state.stageTicks = 0
          this.setActiveInput(null, false)
          resetHeroAvatarAnims(this.state)
        } else if (this.state.playMode === 'single') {
          this.state.stage = 'main_menu'
          this.state.stageTicks = 0
          this.setActiveInput(null, false)
        } else {
          this.state.stage = 'bnet_login'
          this.state.stageTicks = 0
          this.setActiveInput('accountName', false)
        }
      } else if (this.state.stage === 'char_select') {
        this.onPlaySound?.(4)
        this.state.stage = 'main_menu'
        this.state.stageTicks = 0
        this.setActiveInput(null, false)
      } else if (this.state.stage === 'bnet_lobby') {
        this.onPlaySound?.(4)
        this.state.stage = 'char_select'
        this.state.stageTicks = 0
        this.setActiveInput(null, false)
        resetHeroAvatarAnims(this.state)
      }
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const localizedRecord = this.manifest
        ? (this.getLocalizedStrings() as unknown as Record<string, unknown>)
        : undefined
      if (this.state.stage === 'main_menu') {
        this.onPlaySound?.(4)
        clickBattleNetButton(this.state, localizedRecord)
        if (this.asyncHandlers?.onConnect) {
          void this.asyncHandlers.onConnect(this.state)
        }
      } else if (this.state.stage === 'bnet_login') {
        this.onPlaySound?.(4)
        if (this.asyncHandlers?.onLogin) {
          void this.asyncHandlers.onLogin(this.state, false)
        } else {
          submitBattleNetLogin(this.state)
        }
      } else if (this.state.stage === 'bnet_terms_of_use') {
        this.onPlaySound?.(4)
        agreeTermsOfUse(this.state)
      } else if (this.state.stage === 'bnet_create_account') {
        this.onPlaySound?.(4)
        submitCreateAccountForm(this.state, localizedRecord)
      } else if (this.state.stage === 'bnet_please_read') {
        this.onPlaySound?.(4)
        this.confirmPleaseRead()
      } else if (this.state.stage === 'char_create') {
        if (!this.state.selectedClass || !isValidCharacterName(this.state.charName)) {
          return
        }
        this.onPlaySound?.(4)
        if (this.asyncHandlers?.onCreateCharacter) {
          void this.asyncHandlers.onCreateCharacter(this.state)
        } else {
          const created = submitCharacterCreate(this.state, localizedRecord)
          if (created && this.state.playMode === 'single') {
            this.onEnterDoorLoading?.(this.state)
          }
        }
      } else if (this.state.stage === 'char_select') {
        this.onPlaySound?.(4)
        if (this.asyncHandlers?.onSelectCharacter) {
          void this.asyncHandlers.onSelectCharacter(this.state)
        } else if (confirmCharacterSelect(this.state) && this.state.playMode === 'single') {
          this.onEnterDoorLoading?.(this.state)
        }
      } else if (this.state.stage === 'bnet_lobby') {
        if (this.state.activeInput === 'chatInput') {
          this.onPlaySound?.(4)
          this.sendChatMessage()
        } else if (this.state.lobbySubPanel === 'join') {
          this.onPlaySound?.(4)
          this.triggerJoinGame()
        } else {
          this.onPlaySound?.(4)
          this.triggerCreateGame()
        }
      }
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (this.state.stage === 'bnet_login') {
        this.setActiveInput(
          this.state.activeInput === 'accountName' ? 'accountPassword' : 'accountName',
        )
      } else if (this.state.stage === 'bnet_create_account') {
        cycleCreateAccountFocus(this.state, e.shiftKey)
        this.setActiveInput(this.state.activeInput)
      } else if (this.state.stage === 'bnet_lobby') {
        const order: ActiveInputField[] =
          this.state.lobbySubPanel === 'join'
            ? ['gameName', 'gamePassword', 'chatInput']
            : [
                'gameName',
                'gamePassword',
                'gameDescription',
                'maxPlayers',
                ...(this.state.charDifferenceEnabled ? (['charDifference'] as const) : []),
                'chatInput',
              ]
        const idx = order.indexOf(this.state.activeInput)
        this.setActiveInput(order[(idx + 1) % order.length]!)
      }
      return
    }

    if (this.state.stage === 'bnet_create_account') {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        backspaceCreateAccountChar(this.state)
        return
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        typeCreateAccountChar(this.state, e.key)
      }
      return
    }

    const field = this.state.activeInput
    if (!field) return

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (field === 'maxPlayers') {
        e.preventDefault()
        const curNum = Number.parseInt(this.state.maxPlayers, 10)
        const base = Number.isFinite(curNum) ? curNum : 8
        const next = e.key === 'ArrowUp' ? Math.min(8, base + 1) : Math.max(1, base - 1)
        this.setFieldValue('maxPlayers', String(next))
        return
      }
      if (field === 'charDifference' && this.state.charDifferenceEnabled) {
        e.preventDefault()
        const curNum = Number.parseInt(this.state.charDifference, 10)
        const base = Number.isFinite(curNum) ? curNum : 99
        const next = e.key === 'ArrowUp' ? Math.min(99, base + 1) : Math.max(1, base - 1)
        this.setFieldValue('charDifference', String(next))
        return
      }
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault()
      this.setFieldValue(field, this.getFieldValue(field).slice(0, -1))
      return
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const ch = e.key
      const cur = this.getFieldValue(field)
      if (field === 'accountName' || field === 'bnet_account') {
        if (isValidAccountChar(ch) && cur.length < 15) {
          this.setFieldValue(field, cur + ch)
        }
      } else if (field === 'charName') {
        // Per D2Launch.dll 0x6fa52360 (`canAcceptCharNameChar`), only ASCII letters and at most 1 non-leading `-` or `_` (#697)
        if (canAcceptCharNameChar(cur, ch)) {
          this.setFieldValue(field, cur + ch)
        }
      } else if (field === 'gameName' || field === 'gamePassword') {
        if (/^[A-Za-z0-9_-]$/.test(ch) && cur.length < 15) {
          this.setFieldValue(field, cur + ch)
        }
      } else if (
        field === 'accountPassword' ||
        field === 'accountVerifyPassword' ||
        field === 'bnet_password' ||
        field === 'bnet_verify_password'
      ) {
        if (cur.length < 15) {
          this.setFieldValue(field, cur + ch)
        }
      } else if (field === 'maxPlayers') {
        if (/^[1-8]$/.test(ch)) {
          this.setFieldValue(field, ch)
        }
      } else if (field === 'charDifference') {
        if (this.state.charDifferenceEnabled && /^[0-9]$/.test(ch)) {
          if (cur.length === 0 || cur.length >= 2) {
            if (ch !== '0') {
              this.setFieldValue(field, ch)
            }
          } else {
            this.setFieldValue(field, cur + ch)
          }
        }
      } else if (field === 'gameDescription') {
        if (cur.length < 31) {
          this.setFieldValue(field, cur + ch)
        }
      } else if (field === 'chatInput') {
        if (cur.length < 38) {
          this.setFieldValue(field, cur + ch)
        }
      }
    }
  }

  getFieldValue(field: Exclude<ActiveInputField, null>): string {
    switch (field) {
      case 'accountName':
      case 'bnet_account':
        return this.state.accountName
      case 'accountPassword':
      case 'bnet_password':
        return this.state.accountPassword
      case 'accountVerifyPassword':
      case 'bnet_verify_password':
        return this.state.accountVerifyPassword
      case 'charName':
        return this.state.charName
      case 'gameName':
        return this.state.gameName
      case 'gamePassword':
        return this.state.gamePassword
      case 'gameDescription':
        return this.state.gameDescription
      case 'maxPlayers':
        return this.state.maxPlayers
      case 'charDifference':
        return this.state.charDifference
      case 'chatInput':
        return this.state.chatInput
    }
  }

  setFieldValue(field: Exclude<ActiveInputField, null>, val: string): void {
    switch (field) {
      case 'accountName':
      case 'bnet_account':
        this.state.accountName = val
        break
      case 'accountPassword':
      case 'bnet_password':
        this.state.accountPassword = val
        break
      case 'accountVerifyPassword':
      case 'bnet_verify_password':
        this.state.accountVerifyPassword = val
        break
      case 'charName':
        this.state.charName = val
        this.state.charCreateError = null
        break
      case 'gameName':
        this.state.gameName = val
        this.state.createGameError = null
        if (this.state.lobbySubPanel === 'join') {
          this.state.selectedGameName = ''
          this.state.selectedGameInfo = null
          this.state.joinGameDetailsScroll = 0
          const trimmed = val.trim()
          if (trimmed && this.asyncHandlers?.onTypeJoinGameName) {
            void this.asyncHandlers.onTypeJoinGameName(this.state, trimmed)
          }
        }
        break
      case 'gamePassword':
        this.state.gamePassword = val
        break
      case 'gameDescription':
        this.state.gameDescription = val
        break
      case 'maxPlayers':
        this.state.maxPlayers = val
        this.state.createGameError = null
        break
      case 'charDifference':
        this.state.charDifference = val
        this.state.createGameError = null
        break
      case 'chatInput':
        this.state.chatInput = val
        break
    }
  }
}
