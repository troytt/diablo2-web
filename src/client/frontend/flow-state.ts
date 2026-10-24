/**
 * Pure, deterministic state machine for the Diablo II v1.13c Front-End & Battle.net Flow:
 *
 * Stage 1: `main_menu`       — Title screen (`gameselectscreenEXP.dc6` + burning D2 logo)
 * Stage 2: `bnet_connecting` — Connecting modal (`PopUp_340x224.dc6`)
 *          `bnet_login`      — Battle.net Login (`Account Name`, `Password`, BNCS auth)
 * Stage 3: `char_create`     — 7-Class Campfire Character Creation (`charactercreationscreenEXP.dc6`)
 * Stage 4: `char_select`     — 8-Slot Character Selection Roster (`characterselectscreenEXP.dc6`)
 * Stage 5: `bnet_lobby`      — Battle.net Lobby & Create Game Room (`waitingroombkgd.dc6` + `creategamebckg.dc6`)
 * Stage 6: `door_loading`    — 10-Frame Dark Wanderer Door Opening Loading Screen (`Loadingscreen.dc6`)
 * Stage 7: `in_game`         — Act 1 Rogue Encampment (`src/scene/act-scene.ts`)
 */

import { getTblLang, hasExplicitLangContext, lookupTbl, requireTbl } from '../i18n/lang.ts'
import {
  AVATAR_COMPONENT_NAMES,
  D2WIN_COMPONENT_TABLE,
  D2_COLORS_TXT_PALETTE,
  TN_COF_LAYER_ORDERS,
  parseMcpAvatarStatstring,
  type AvatarComponentLayerSpec,
  type AvatarComponentName,
  type D2WinComponentEntry,
  type ParsedMcpAvatarStatstring,
} from './statstring-avatar.ts'

export {
  AVATAR_COMPONENT_NAMES,
  D2WIN_COMPONENT_TABLE,
  D2_COLORS_TXT_PALETTE,
  TN_COF_LAYER_ORDERS,
  parseMcpAvatarStatstring,
  type AvatarComponentLayerSpec,
  type AvatarComponentName,
  type D2WinComponentEntry,
  type ParsedMcpAvatarStatstring,
}

export type BnetFlowStage =
  | 'main_menu'
  | 'bnet_connecting'
  | 'bnet_login'
  | 'bnet_terms_of_use'
  | 'bnet_create_account'
  | 'bnet_please_read'
  | 'char_create'
  | 'char_select'
  | 'bnet_lobby'
  | 'door_loading'
  | 'in_game'
  | 'end_game'

export type FrontendScreen = BnetFlowStage

/**
 * D2Client.dll victory screen `0x6faf3a70`, shown after the game loop ends with the "game completed" flag
 * (S2C `0x61 07`, Baal's portal). Lines come from `computeGameCompletion113c`.
 */
export interface EndGameScreenState {
  /** Character name, Font42 gold at y_bottom 187 (`0x6faf2c70`). */
  readonly nameLine: string
  /** `GetCharacterTitle(...) + name`, Font42 gold at y_bottom 357 (`0x6faf2e47`). */
  readonly titleLine: string
  /** OK button pressed (`0x6fbcc410`, set by mouse-down inside the button, `0x6faf2f40`). */
  pressed: boolean
}

/** Campfire class IDs in left-to-right screen order (`D2Launch.dll` @ `0x6fa68df8`). */
export type CampfireClassId = 'am' | 'as' | 'ne' | 'ba' | 'pa' | 'so' | 'dz'

/** In-game entity token (`as` maps to `ai` for Assassin). */
export type HeroToken = 'am' | 'ai' | 'ne' | 'ba' | 'pa' | 'so' | 'dz'

export type CampfireAnimPhase = 'nu1' | 'nu2' | 'fw' | 'nu3' | 'bw'

export type GameDifficulty = 'normal' | 'nightmare' | 'hell'

/** Fixed 25fps front-end tick budget (40ms per tick, `D2Win.dll` @ `0x6f8f8980`). */
export const FRONTEND_TICK_MS = 40

/** Maximum catch-up ticks allowed in a single frame step to prevent spiral-of-death bursts. */
export const FRONTEND_MAX_CATCHUP_TICKS = 5

/** Maximum frame delta (in milliseconds) accumulated in a single frame step (`5 * 40ms = 200ms`). */
export const FRONTEND_MAX_FRAME_DELTA_MS = FRONTEND_TICK_MS * FRONTEND_MAX_CATCHUP_TICKS

/**
 * Frame-0 DC6 cel bounds (`w, h, anchorX, anchorY`) used by `D2Win.dll` `0x6f8f07c0`
 * (`ANIMIMAGE_ShouldMouseInputBeHandled`) for per-phase hit-testing.
 */
export interface CampfireFrame0Bounds {
  readonly w: number
  readonly h: number
  readonly anchorX: number
  readonly anchorY: number
}

export interface CampfireClassSlotState {
  readonly id: CampfireClassId
  readonly heroToken: HeroToken
  readonly classTblId: 4007 | 4008 | 4009 | 4010 | 4011 | 4012 | 4013
  readonly nameEn: string
  /** Screen anchor X (`D2Launch.dll` @ `0x6fa68df8`). */
  readonly anchorX: number
  /** Screen anchor Y (bottom edge, `D2Launch.dll` @ `0x6fa68df8`). */
  readonly anchorY: number
  /** Per-phase frame-0 cel bounds (`D2Win.dll` @ `0x6f8f07c0`). */
  frame0Bounds: Record<CampfireAnimPhase, CampfireFrame0Bounds>
  /** Interactive bounding box in 800x600 space for the current phase (`left, top, width, height`). */
  hitBox: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
  phase: CampfireAnimPhase
  frameIndex: number
  /** Ticks elapsed in the current animation frame (`0 .. rate - 1`). */
  phaseTicks: number
  frameCount: Record<CampfireAnimPhase, number>
  /** Per-phase tick multiplier (`durMs = rate * 40ms`, `D2Launch.dll` @ `0x6fa60c08`). */
  frameRate: Record<CampfireAnimPhase, number>
}

export interface HeroAvatarAnimState {
  readonly heroToken: HeroToken
  frameCount: number
  /** 8.8 fixed-point COF animation speed (`D2Win.dll` @ `0x6f8ec48b`). */
  animRate: number
  /** 8.8 fixed-point accumulator (`acc += animRate` once per 40ms tick, `D2Win.dll` @ `0x6f8ee836`). */
  acc: number
  /** Current frame index (`acc >> 8`, wraps when `frame >= framesPerDir - 1`). */
  frameIndex: number
}

export interface RosterCharacter {
  readonly id: string
  readonly name: string
  readonly classId: CampfireClassId
  readonly heroToken: HeroToken
  readonly className: string
  readonly level: number
  isExpansion: boolean
  readonly isHardcore: boolean
  readonly isLadder: boolean
  /** 5-bit character progression (`0..15`) from MCP 33-byte `(statString[27] >>> 1) & 0x1f` (`Fog.#10085` / `D2Launch.dll` 0x6fa4c887). */
  progression?: number | undefined
  /** Optional explicit highest unlocked difficulty override. */
  maxDifficulty?: GameDifficulty | undefined
  /** Unix timestamp (seconds) when character expires from MCP `0x19` (`MCP_CHARLIST2`), or `0`/`undefined`. */
  expiresAt?: number | undefined
  expiresAtSec?: number | undefined
  /** Remaining days until expiration (`floor((expiresAt - nowSec) / 86400)`), or `undefined`. */
  expirationDays?: number | undefined
  /** Raw 33-byte MCP `0x19` (`MCP_CHARLIST2`) statstring bytes. */
  statstring?: Uint8Array | undefined
  /** 9-byte equipment graphics array from `CharSummary`. */
  equipmentGraphics?: Uint8Array | undefined
  /** Parsed 11-component tokens (`HD, TR, LG, RA, LA, RH, LH, SH, S1..S3`) from MCP statstring (`0x6fa4a440`). */
  components?: Readonly<Record<AvatarComponentName, string>> | undefined
  /** Parsed 11-component `Colors.txt` dye palette indices (`1..21`, or `0xff` = un-dyed) from MCP statstring. */
  componentColors?: Readonly<Record<AvatarComponentName, number>> | undefined
  /** Derived weapon class token (`hth`, `1hs`, `1ht`, `2hs`, `2ht`, `bow`, `xbw`, `stf`, `1js`, `1jt`, `1ss`, `1st`) for `TN` composite avatar. */
  weaponClass?: string | undefined
  /** Parsed 11-component + 11-color `TN` composite avatar descriptor (`0x6fa4a440`). */
  avatarDesc?: ParsedMcpAvatarStatstring | undefined
  readonly createdAt: number
}

export interface LobbyChatEntry {
  readonly text: string
  readonly color?: number | undefined
  readonly kind?: 'system' | 'chat' | 'whisper' | 'emote' | 'gem' | undefined
  readonly tblId?: number | undefined
}

export type ActiveInputField =
  | 'accountName'
  | 'accountPassword'
  | 'accountVerifyPassword'
  | 'bnet_account'
  | 'bnet_password'
  | 'bnet_verify_password'
  | 'charName'
  | 'gameName'
  | 'gamePassword'
  | 'gameDescription'
  | 'maxPlayers'
  | 'charDifference'
  | 'chatInput'
  | null

export type FocusedField = ActiveInputField

export interface PopupModalState {
  readonly title?: string | undefined
  readonly message: string
  readonly body: string
  readonly returnScreen: BnetFlowStage
  readonly tblId?: number | undefined
  readonly strId?: number | undefined
}

export interface LobbyGameEntry {
  readonly name: string
  readonly description: string
  readonly players: number
  readonly maxPlayers: number
  readonly difficulty: GameDifficulty
}

/**
 * `MCP_GAMEINFO (0x06)` game details (`D2MCPClient.dll` `0x6fa26280` & `D2Multi.dll` `0x6f9e3280`).
 */
export interface LobbyJoinGameInfo {
  readonly name: string
  readonly status: number
  readonly uptimeSec: number
  readonly creatorLevel?: number | undefined
  readonly levelDiff?: number | undefined
  readonly maxPlayers: number
  readonly description?: string | undefined
  readonly players: readonly {
    readonly name: string
    readonly charClass: number
    readonly level: number
  }[]
}

export interface JoinGameDetailLine {
  readonly text: string
  readonly color: 0 | 5
}

/**
 * Canonical `.tbl` string IDs for the 7 BNCS connection stages (`D2Launch.dll` @ `0x6fa6158c`).
 */
export const BNCS_CONNECT_STAGE_TBL_IDS = [5171, 5172, 5173, 5174, 5175, 5176, 5177] as const

export type BnetConnectStageIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface BnetFlowState {
  stage: BnetFlowStage
  playMode?: 'single' | 'bnet' | undefined
  gateway: string
  /** Ticks elapsed in current stage (25 ticks = 1 second). */
  stageTicks: number
  /** Global animation tick counter (25fps). */
  globalTick: number
  /** Fractional millisecond accumulator for fixed 25fps (40ms/tick) stepping. */
  tickAccumulatorMs: number
  /** Last `requestAnimationFrame` timestamp (ms) observed by `stepFlowFrame`, or `null` initially. */
  lastFrameTimeMs: number | null
  /** Whether live D2OnlineFlow is active (falls back to mock when false). */
  onlineConnected?: boolean | undefined
  /** Current BNCS connection progress stage (`0..6` -> `.tbl` `5171..5177`, `0x6fa6158c`). */
  bnetConnectStage?: BnetConnectStageIndex | undefined

  // Stage 2: Battle.net Login & Create New Account
  accountName: string
  accountPassword: string
  accountVerifyPassword: string
  loginError: string | null
  termsScrollLine: number
  termsScrollOffset: number
  popupModal: PopupModalState | null
  popup: PopupModalState | null

  // Stage 3: Campfire Character Creation
  campfireClasses: Record<CampfireClassId, CampfireClassSlotState>
  hoveredClass: CampfireClassId | null
  selectedClass: CampfireClassId | null
  charName: string
  isExpansion: boolean
  isHardcore: boolean
  isLadder: boolean
  charCreateError: string | null

  // Stage 4: 8-Slot Character Selection & Lobby TN Avatar 8.8 Fixed-Point Accumulators
  roster: RosterCharacter[]
  avatarAnims: Record<HeroToken, HeroAvatarAnimState>
  selectedSlotIndex: number
  deleteConfirmOpen: boolean

  // Stage 5: Battle.net Lobby & Create/Join Game Room
  lobbySubPanel: 'create' | 'join' | 'channel' | 'ladder'
  gemActivated: boolean
  channelName: string
  chatMessages: string[]
  chatEntries: LobbyChatEntry[]
  chatInput: string
  gameName: string
  gamePassword: string
  gameDescription: string
  maxPlayers: string
  charDifferenceEnabled: boolean
  charDifference: string
  difficulty: GameDifficulty
  createGameError: string | null
  gameList?: LobbyGameEntry[] | undefined
  realmGames: readonly {
    readonly index: number
    readonly name: string
    readonly description: string
    readonly playerCount: number
    readonly flags: number
  }[]
  selectedGameName: string
  selectedGameInfo: LobbyJoinGameInfo | null
  joinGameListScroll: number
  joinGameDetailsScroll: number
  lastError: string | null
  statusText: string

  // Stage 6: 10-Frame Door Opening Loading Screen
  doorFrame: number
  sceneReady: boolean

  // Victory screen after S2C 0x61 07 (`end_game` stage)
  endGame: EndGameScreenState | null

  // Active keyboard focus
  activeInput: ActiveInputField
}

export type FrontendFlowState = BnetFlowState

export const CAMPFIRE_CLASS_ORDER: readonly CampfireClassId[] = [
  'am',
  'as',
  'ne',
  'ba',
  'pa',
  'so',
  'dz',
] as const

export const HERO_TOKENS: readonly HeroToken[] = [
  'am',
  'ai',
  'ne',
  'ba',
  'pa',
  'so',
  'dz',
] as const

/**
 * Canonical `.tbl` string IDs (`4007..4013`) for the 7 playable character classes (`D2Launch.dll` @ `0x6fa60c08`).
 */
export const CLASS_TBL_IDS: Readonly<
  Record<CampfireClassId, 4007 | 4008 | 4009 | 4010 | 4011 | 4012 | 4013>
> = {
  ba: 4007,
  pa: 4008,
  ne: 4009,
  so: 4010,
  am: 4011,
  dz: 4012,
  as: 4013,
} as const

/**
 * Canonical `D2Launch.dll` (`0x6fa63080`) Expansion campfire flame `D2WinAnimImage` control record:
 * `x = 345, y = 470, w = 110, h = 127, speed = 1, drawMode = 3 (DRAWMODE_MODULATE)`.
 */
export const CAMPFIRE_FLAME_CONTROL_SPEC = {
  va: 0x6fa63080,
  x: 345,
  y: 470,
  w: 110,
  h: 127,
  speed: 1,
  drawMode: 3,
} as const

/**
 * Canonical `D2Launch.dll` & `D2Multi.dll` control record table (`#711`).
 * Extracted from decompiled binary virtual addresses (`0x6fa61520`, `0x6fa6158c`, `0x6fa63080`, `0x6fa60c08`, `0x6fa68df8`, `0x6f9d2940`).
 */
export const D2LAUNCH_CONTROL_RECORDS = {
  mainMenuButtons: {
    singlePlayer: { x: 264, y: 290, w: 272, h: 35, tblId: 5106 },
    battleNet: { x: 264, y: 332, w: 272, h: 35, tblId: 5104 },
    gateway: { x: 264, y: 368, w: 272, h: 25 },
    otherMultiplayer: { x: 264, y: 400, w: 272, h: 35, tblId: 5107 },
    cinematics: { x: 264, y: 468, w: 272, h: 35, tblId: 5108 },
    credits: { x: 264, y: 508, w: 135, h: 25, tblId: 5109 },
    exitDiablo2: { x: 401, y: 508, w: 135, h: 25, tblId: 5110 },
  },
  bnetConnectingModal: {
    va: 0x6fa6158c,
    popupRect: { x: 230, y: 170, w: 340, h: 224 },
    titleCenter: { x: 400, y: 196, tblId: 5104 },
    statusText: { x: 250, y: 245, w: 300, h: 78, centerX: 400, centerY: 284 },
    cancelButton: { x: 336, y: 345, w: 128, h: 35, tblId: 5103 },
  },
  bnetLoginHeader: {
    va: 0x6fa61520,
    title: { x: 200, y: 210, w: 400, h: 24, centerX: 400, tblId: 5204 },
    instruction: { x: 200, y: 236, w: 400, h: 60, centerX: 400, tblId: 5205 },
  },
  campfireFlame: CAMPFIRE_FLAME_CONTROL_SPEC,
} as const

export const D2MULTI_CONTROL_RECORDS = {
  lobbyAvatar: {
    va: 0x6f9d2940,
    anchorX: 52,
    anchorY: 584,
  },
  channelTitle: {
    centerX: 224,
    y: 80,
  },
  chatGem: {
    x: 398,
    y: 474,
    w: 96,
    h: 96,
  },
} as const

/**
 * Canonical 1.13c `D2Launch.dll` (`0x6fa60c08` / `0x6fa68df8`) campfire class descriptors
 * and MPQ DC6 frame counts & frame-0 cel bounds.
 */
export const D2LAUNCH_CAMPFIRE_DESCRIPTORS: Readonly<
  Record<
    CampfireClassId,
    {
      readonly id: CampfireClassId
      readonly heroToken: HeroToken
      readonly classTblId: 4007 | 4008 | 4009 | 4010 | 4011 | 4012 | 4013
      readonly nameEn: string
      readonly anchorX: number
      readonly anchorY: number
      readonly frameCount: Readonly<Record<CampfireAnimPhase, number>>
      readonly frameRate: Readonly<Record<CampfireAnimPhase, number>>
      readonly frame0Bounds: Readonly<Record<CampfireAnimPhase, CampfireFrame0Bounds>>
    }
  >
> = {
  am: {
    id: 'am',
    heroToken: 'am',
    classTblId: 4011,
    nameEn: 'Amazon',
    anchorX: 100,
    anchorY: 337,
    frameCount: { nu1: 26, nu2: 26, fw: 54, nu3: 18, bw: 30 },
    frameRate: { nu1: 3, nu2: 3, fw: 1, nu3: 2, bw: 1 },
    frame0Bounds: {
      nu1: { w: 118, h: 198, anchorX: -75, anchorY: -118 },
      nu2: { w: 118, h: 198, anchorX: -75, anchorY: -118 },
      fw: { w: 124, h: 198, anchorX: -81, anchorY: -118 },
      nu3: { w: 121, h: 234, anchorX: -68, anchorY: -127 },
      bw: { w: 121, h: 233, anchorX: -67, anchorY: -127 },
    },
  },
  as: {
    id: 'as',
    heroToken: 'ai',
    classTblId: 4013,
    nameEn: 'Assassin',
    anchorX: 232,
    anchorY: 364,
    frameCount: { nu1: 31, nu2: 31, fw: 91, nu3: 31, bw: 51 },
    frameRate: { nu1: 3, nu2: 3, fw: 1, nu3: 2, bw: 1 },
    frame0Bounds: {
      nu1: { w: 51, h: 189, anchorX: -56, anchorY: -135 },
      nu2: { w: 51, h: 189, anchorX: -56, anchorY: -135 },
      fw: { w: 51, h: 189, anchorX: -56, anchorY: -135 },
      nu3: { w: 86, h: 187, anchorX: -41, anchorY: -120 },
      bw: { w: 86, h: 187, anchorX: -41, anchorY: -120 },
    },
  },
  ne: {
    id: 'ne',
    heroToken: 'ne',
    classTblId: 4009,
    nameEn: 'Necromancer',
    anchorX: 301,
    anchorY: 333,
    frameCount: { nu1: 12, nu2: 12, fw: 38, nu3: 12, bw: 28 },
    frameRate: { nu1: 3, nu2: 3, fw: 1, nu3: 2, bw: 1 },
    frame0Bounds: {
      nu1: { w: 58, h: 183, anchorX: -31, anchorY: -120 },
      nu2: { w: 58, h: 183, anchorX: -31, anchorY: -120 },
      fw: { w: 58, h: 183, anchorX: -31, anchorY: -120 },
      nu3: { w: 129, h: 233, anchorX: -51, anchorY: -131 },
      bw: { w: 129, h: 233, anchorX: -51, anchorY: -131 },
    },
  },
  ba: {
    id: 'ba',
    heroToken: 'ba',
    classTblId: 4007,
    nameEn: 'Barbarian',
    anchorX: 400,
    anchorY: 330,
    frameCount: { nu1: 16, nu2: 16, fw: 64, nu3: 26, bw: 19 },
    frameRate: { nu1: 2, nu2: 2, fw: 1, nu3: 1, bw: 1 },
    frame0Bounds: {
      nu1: { w: 86, h: 183, anchorX: -39, anchorY: -132 },
      nu2: { w: 86, h: 183, anchorX: -39, anchorY: -132 },
      fw: { w: 86, h: 183, anchorX: -39, anchorY: -132 },
      nu3: { w: 95, h: 201, anchorX: -50, anchorY: -134 },
      bw: { w: 95, h: 201, anchorX: -50, anchorY: -134 },
    },
  },
  pa: {
    id: 'pa',
    heroToken: 'pa',
    classTblId: 4008,
    nameEn: 'Paladin',
    anchorX: 521,
    anchorY: 339,
    frameCount: { nu1: 26, nu2: 26, fw: 80, nu3: 9, bw: 40 },
    frameRate: { nu1: 2, nu2: 2, fw: 1, nu3: 2, bw: 1 },
    frame0Bounds: {
      nu1: { w: 82, h: 179, anchorX: -35, anchorY: -127 },
      nu2: { w: 82, h: 179, anchorX: -35, anchorY: -127 },
      fw: { w: 84, h: 179, anchorX: -34, anchorY: -127 },
      nu3: { w: 131, h: 173, anchorX: -117, anchorY: -75 },
      bw: { w: 132, h: 173, anchorX: -117, anchorY: -75 },
    },
  },
  so: {
    id: 'so',
    heroToken: 'so',
    classTblId: 4010,
    nameEn: 'Sorceress',
    anchorX: 626,
    anchorY: 353,
    frameCount: { nu1: 32, nu2: 32, fw: 52, nu3: 12, bw: 30 },
    frameRate: { nu1: 2, nu2: 2, fw: 1, nu3: 1, bw: 1 },
    frame0Bounds: {
      nu1: { w: 89, h: 166, anchorX: -61, anchorY: -113 },
      nu2: { w: 89, h: 166, anchorX: -61, anchorY: -113 },
      fw: { w: 89, h: 166, anchorX: -61, anchorY: -113 },
      nu3: { w: 107, h: 209, anchorX: -52, anchorY: -135 },
      bw: { w: 107, h: 209, anchorX: -52, anchorY: -135 },
    },
  },
  dz: {
    id: 'dz',
    heroToken: 'dz',
    classTblId: 4012,
    nameEn: 'Druid',
    anchorX: 720,
    anchorY: 370,
    frameCount: { nu1: 21, nu2: 21, fw: 121, nu3: 21, bw: 40 },
    frameRate: { nu1: 2, nu2: 2, fw: 1, nu3: 2, bw: 1 },
    frame0Bounds: {
      nu1: { w: 87, h: 199, anchorX: -40, anchorY: -151 },
      nu2: { w: 87, h: 199, anchorX: -40, anchorY: -151 },
      fw: { w: 87, h: 199, anchorX: -40, anchorY: -151 },
      nu3: { w: 112, h: 241, anchorX: -75, anchorY: -163 },
      bw: { w: 112, h: 241, anchorX: -75, anchorY: -163 },
    },
  },
}

/**
 * Compute the dynamic frame-0 cel hit-test box for a campfire class slot in its current phase
 * per `D2Win.dll` `0x6f8f07c0` (`ANIMIMAGE_ShouldMouseInputBeHandled`):
 * `mouseX - offsetX in [ctrlX, ctrlX + w)` and `mouseY - offsetY in [ctrlY - h, ctrlY)`
 * -> `x = anchorX + f0.anchorX`, `y = anchorY + f0.anchorY`, `w = f0.w`, `h = f0.h`.
 */
export function getCampfireSlotHitBox(
  slot: Pick<CampfireClassSlotState, 'anchorX' | 'anchorY' | 'phase' | 'frame0Bounds'>,
): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  const f0 = slot.frame0Bounds[slot.phase]
  return {
    x: slot.anchorX + f0.anchorX,
    y: slot.anchorY + f0.anchorY,
    w: f0.w,
    h: f0.h,
  }
}

export const CAMPFIRE_CLASS_SPECS: Readonly<
  Record<
    CampfireClassId,
    {
      readonly id: CampfireClassId
      readonly heroToken: HeroToken
      readonly classTblId: 4007 | 4008 | 4009 | 4010 | 4011 | 4012 | 4013
      readonly nameEn: string
      readonly anchorX: number
      readonly anchorY: number
      readonly hitBox: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
      readonly frameCount: Readonly<Record<CampfireAnimPhase, number>>
      /** 1.13c `D2Launch.dll` `@ 0x6fa60c08` per-mode tick multiplier (`durMs = rate * 40ms`). */
      readonly frameRate: Readonly<Record<CampfireAnimPhase, number>>
      readonly frame0Bounds: Readonly<Record<CampfireAnimPhase, CampfireFrame0Bounds>>
    }
  >
> = {
  am: {
    ...D2LAUNCH_CAMPFIRE_DESCRIPTORS.am,
    hitBox: getCampfireSlotHitBox({
      anchorX: D2LAUNCH_CAMPFIRE_DESCRIPTORS.am.anchorX,
      anchorY: D2LAUNCH_CAMPFIRE_DESCRIPTORS.am.anchorY,
      phase: 'nu1',
      frame0Bounds: D2LAUNCH_CAMPFIRE_DESCRIPTORS.am.frame0Bounds,
    }),
  },
  as: {
    ...D2LAUNCH_CAMPFIRE_DESCRIPTORS.as,
    hitBox: getCampfireSlotHitBox({
      anchorX: D2LAUNCH_CAMPFIRE_DESCRIPTORS.as.anchorX,
      anchorY: D2LAUNCH_CAMPFIRE_DESCRIPTORS.as.anchorY,
      phase: 'nu1',
      frame0Bounds: D2LAUNCH_CAMPFIRE_DESCRIPTORS.as.frame0Bounds,
    }),
  },
  ne: {
    ...D2LAUNCH_CAMPFIRE_DESCRIPTORS.ne,
    hitBox: getCampfireSlotHitBox({
      anchorX: D2LAUNCH_CAMPFIRE_DESCRIPTORS.ne.anchorX,
      anchorY: D2LAUNCH_CAMPFIRE_DESCRIPTORS.ne.anchorY,
      phase: 'nu1',
      frame0Bounds: D2LAUNCH_CAMPFIRE_DESCRIPTORS.ne.frame0Bounds,
    }),
  },
  ba: {
    ...D2LAUNCH_CAMPFIRE_DESCRIPTORS.ba,
    hitBox: getCampfireSlotHitBox({
      anchorX: D2LAUNCH_CAMPFIRE_DESCRIPTORS.ba.anchorX,
      anchorY: D2LAUNCH_CAMPFIRE_DESCRIPTORS.ba.anchorY,
      phase: 'nu1',
      frame0Bounds: D2LAUNCH_CAMPFIRE_DESCRIPTORS.ba.frame0Bounds,
    }),
  },
  pa: {
    ...D2LAUNCH_CAMPFIRE_DESCRIPTORS.pa,
    hitBox: getCampfireSlotHitBox({
      anchorX: D2LAUNCH_CAMPFIRE_DESCRIPTORS.pa.anchorX,
      anchorY: D2LAUNCH_CAMPFIRE_DESCRIPTORS.pa.anchorY,
      phase: 'nu1',
      frame0Bounds: D2LAUNCH_CAMPFIRE_DESCRIPTORS.pa.frame0Bounds,
    }),
  },
  so: {
    ...D2LAUNCH_CAMPFIRE_DESCRIPTORS.so,
    hitBox: getCampfireSlotHitBox({
      anchorX: D2LAUNCH_CAMPFIRE_DESCRIPTORS.so.anchorX,
      anchorY: D2LAUNCH_CAMPFIRE_DESCRIPTORS.so.anchorY,
      phase: 'nu1',
      frame0Bounds: D2LAUNCH_CAMPFIRE_DESCRIPTORS.so.frame0Bounds,
    }),
  },
  dz: {
    ...D2LAUNCH_CAMPFIRE_DESCRIPTORS.dz,
    hitBox: getCampfireSlotHitBox({
      anchorX: D2LAUNCH_CAMPFIRE_DESCRIPTORS.dz.anchorX,
      anchorY: D2LAUNCH_CAMPFIRE_DESCRIPTORS.dz.anchorY,
      phase: 'nu1',
      frame0Bounds: D2LAUNCH_CAMPFIRE_DESCRIPTORS.dz.frame0Bounds,
    }),
  },
}

/**
 * 1.13c `D2Launch.dll` `@ 0x6fa60c08` campfire per-class, per-phase rate table (`durMs = rate * 40ms`).
 */
export const CAMPFIRE_ANIM_RATES: Readonly<
  Record<CampfireClassId, Readonly<Record<CampfireAnimPhase, number>>>
> = {
  am: D2LAUNCH_CAMPFIRE_DESCRIPTORS.am.frameRate,
  as: D2LAUNCH_CAMPFIRE_DESCRIPTORS.as.frameRate,
  ne: D2LAUNCH_CAMPFIRE_DESCRIPTORS.ne.frameRate,
  ba: D2LAUNCH_CAMPFIRE_DESCRIPTORS.ba.frameRate,
  pa: D2LAUNCH_CAMPFIRE_DESCRIPTORS.pa.frameRate,
  so: D2LAUNCH_CAMPFIRE_DESCRIPTORS.so.frameRate,
  dz: D2LAUNCH_CAMPFIRE_DESCRIPTORS.dz.frameRate,
}

/**
 * 1.13c Town Neutral (`TN` `HTH`) COF `frameCount` (`framesPerDir`) and 8.8 fixed-point `animRate` values
 * (`D2Win.dll` `@ 0x6f8ec48b`, `0x6f8ee836`):
 * - `am`, `so`, `ne`, `ba`: `80` (16 frames, ~7.8125 fps)
 * - `pa`: `128` (16 frames, 12.5 fps)
 * - `dz`: `96` (10 frames, 9.375 fps)
 * - `ai` (`as`): `64` (12 frames, 6.25 fps)
 */
export const HERO_TN_ANIM_SPECS: Readonly<
  Record<HeroToken, { readonly frameCount: number; readonly animRate: number }>
> = {
  am: { frameCount: 16, animRate: 80 },
  ai: { frameCount: 12, animRate: 64 },
  ne: { frameCount: 16, animRate: 80 },
  ba: { frameCount: 16, animRate: 80 },
  pa: { frameCount: 16, animRate: 128 },
  so: { frameCount: 16, animRate: 80 },
  dz: { frameCount: 10, animRate: 96 },
}

/**
 * Canonical 1.13c `.tbl` string table entries (`string.tbl`, `patchstring.tbl`, `expansionstring.tbl`)
 * referenced by `D2Launch.dll` and `D2Multi.dll` numeric indices when `manifest.strings` is not explicitly passed.
 */
export const CANONICAL_D2LAUNCH_TBL_BY_ID: Readonly<Record<number, string>> = {
  4007: 'Barbarian',
  4008: 'Paladin',
  4009: 'Necromancer',
  4010: 'Sorceress',
  4011: 'Amazon',
  4012: 'Druid',
  4013: 'Assassin',
  4057: 'Level',
  5017: 'Level %d',
  5098: 'Congratulations!',
  5099: 'You Have Vanquished Diablo',
  5100: 'Will Henceforth Be Known As',
  5101: 'EXIT',
  5102: 'OK',
  5103: 'CANCEL',
  5150: 'CREATE GAME',
  5151: 'JOIN GAME',
  5171: 'Connecting to Battle.net',
  5172: 'Querying gateway',
  5173: 'Connecting to the fastest server',
  5174: 'Accessing your account',
  5175: 'Checking versions',
  5176: 'Verifying CD-key',
  5177: 'Getting player profile',
  5180: 'Terms of Use',
  5181: 'AGREE',
  5182: 'DISAGREE',
  5204: 'Battle.net Log In',
  5205: "To use an existing Battle.net account, enter the information below and click 'Log In'. Otherwise, click 'Create New Account'.",
  5216: 'Account name must be at least 2 characters.',
  5217: "Account name can't be more than 15 characters.",
  5218: "Passwords don't match.",
  5219: 'Password must be at least 2 characters.',
  5220: "Password can't be more than 15 characters.",
  5221: 'CREATE NEW ACCOUNT',
  5222: 'Create Battle.net Account',
  5223: 'Enter the Name and Password for your new battle.net account.',
  5224: 'Account Name',
  5225: 'Password',
  5226: 'Verify Password',
  5227: 'PLEASE READ',
  5228: 'Please note that inactive accounts are deleted at regular times. If you create a new account, you must be logged into Battle.net long enough - either in one session, or spread over several - to have accumulated 2 hours of time within the first 48 hours.',
  5229: 'After that, your account becomes permanent so long as you continue to log into this account once every 90 days.',
  5230: 'PLEASE WRITE DOWN YOUR PASSWORD. BLIZZARD DOES NOT HAVE ACCESS TO PASSWORDS, AND CANNOT FIND OR REPLACE FORGOTTEN PASSWORDS.',
  5231: 'User names must be at least two characters in length. Please try again with a different name.',
  5232: 'Your user name contained one or more illegal characters.',
  5233: 'Your user name contained one or more disallowed words.',
  5234: 'Your previous account creation request is still being processed. Please wait a few moments and try logging in with the account you just created.',
  5235: 'Your name did not have enough alpha-numeric characters in it.',
  5236: 'Your name contained too many adjacent punctuation characters in it.',
  5237: 'Your name contained too many punctuation characters in it.',
  5238: 'The passwords you have typed do not match. Please enter the same password twice.',
  5239: 'An account already exists with the name you have chosen.  Please try again with a different name.',
  5249: 'Unable to Create Account',
  5269: 'Game Name',
  5271: 'Password',
  5275: 'Game Name Players',
  5334: 'Gem Activated',
  5335: 'Gem Deactivated',
  5336: 'Perfect Gem Activated',
  10834: 'Verify Password',
  11127: 'PLEASE WRITE DOWN YOUR PASSWORD.',
  11132: 'Expires Today',
  11133: 'Expires in %d days',
  11134: 'Character Expired',
  22731: 'EXPANSION CHARACTER',
}

export const CANONICAL_D2LAUNCH_CHI_TBL_BY_ID: Readonly<Record<number, string>> = {
  4007: '野蠻人',
  4008: '聖騎士',
  4009: '死靈法師',
  4010: '法師',
  4011: '亞馬遜',
  4012: '德魯伊',
  4013: '刺客',
  4057: '等級',
  5017: '等級%d',
  5101: '離開',
  5102: '好',
  5103: '取消',
  5150: '創造遊戲',
  5151: '加入遊戲',
  5171: '連接到Battle.net',
  5172: '查詢通訊閘',
  5173: '連接到最快速的伺服器',
  5174: '存取你的帳戶',
  5175: '檢查版本',
  5176: '查驗光碟密碼',
  5177: '取得玩者資料',
  5180: '使用宣告',
  5181: '同意',
  5182: '不同意',
  5204: 'Battle.net登錄',
  5205: '要使用一個現存的Battle.net帳戶，輸入以下的資料並點選「登錄」。否則請點選「創造新帳戶」。',
  5216: '帳戶名稱至少要輸入二個字。',
  5217: '帳戶名稱不能超過15個字母。',
  5218: '密碼不符。',
  5219: '密碼必須至少二個字。',
  5220: '密碼無法超過15個字母。',
  5221: '創造新帳戶',
  5222: '創造Battle.net帳戶',
  5223: '請為你的battle.net新帳戶輸入一個名字和密碼。',
  5224: '帳戶名稱',
  5225: '密碼',
  5226: '核對密碼',
  5227: '請閱讀',
  5228: '請注意，未啟用的帳戶在一定的時間之後會自動刪除。如果你創造了一個新帳戶，你必須登錄到Battle.net一段較長的時間-看你是要一次達到或是分為幾次-在48小時之內最少在Battle.Net上面待2小時。',
  5229: '在這之後，你的帳戶就會變成永久性帳戶；只要在90天以內的時間登錄一次，就可以保有這個帳戶中的資料。',
  5230: '請寫下你的密碼。BLIZZARD無法存取你的密碼，而且無法為你找回或置換掉你忘掉的密碼。',
  5231: '使用者名稱至少要二個字。請試試不同的名字。',
  5232: '你的使用者名稱包括了一個或一個以上的非法字元。',
  5233: '你的使用者名稱包括了一個或一個以上的禁用文字。',
  5234: '你上一次申請帳戶的動作仍在持續之中。請等一下並試用利用你剛剛開創的帳戶登錄。',
  5235: '你的姓名中並沒有足夠的字母與數字。',
  5236: '你的姓名中包括太多鄰近的標點符號。',
  5237: '你的名字包括了太多的標點符號。',
  5238: '你所輸入的密碼不符，請輸入相同的密碼二次。',
  5239: '你所選擇的名字已經有其他的帳戶使用了。請再試一次，並輸入不同的名字。',
  5249: '無法創造帳戶',
  5269: '遊戲名稱',
  5271: '密碼',
  5275: '遊戲名稱 玩者',
  5334: '寶石啟用',
  5335: '寶石停用',
  5336: '完美的寶石啟用',
  10834: '核對密碼',
  11127: '請寫下你的密碼。',
  11132: '今日失效',
  11133: '在 %d 天內失效',
  11134: '人物失效',
  22731: '資料片人物',
}

const DEFAULT_CHI_TERMS_OF_USE_TEXT = [
  'BATTLE.NET 使用宣告協議',
  '',
  'BATTLE.NET 服務係根據本使用宣告協議（「協議」）之條款與條件，以及 BLIZZARD ENTERTAINMENT（「BLIZZARD」）不定期發佈之任何營運規則或政策提供予您使用。',
  '',
  '請仔細閱讀以下條款與條件。點選下方的「同意」按鈕，即表示您已閱讀、理解並同意受本協議條款與條件之約束。',
  '',
  '1. 服務使用之有限授權',
  '在您同意並持續遵守本協議之前提下，Blizzard 特此授予您（且您特此接受）一項有限、非獨佔、不可轉讓之授權，僅供您個人非商業娛樂目的存取並使用 Battle.net 服務。',
  '',
  '2. 額外授權限制',
  '在任何情況下，您同意不會進行以下行為：',
  '(a) 使用作弊程式、自動化軟體（機器人）、駭客程式、修改器或任何其他未經授權之第三方軟體來修改 Battle.net 服務或遊戲體驗；',
  '(b) 將本遊戲或其任何部分（包括但不限於本服務）用於任何商業用途；',
  '(c) 修改或導致修改屬於本遊戲或本服務一部分之任何檔案；',
  '(d) 協助、建立或維持任何未經授權之遊戲或服務連線。',
  '',
  '3. 帳戶安全與行為準則',
  '在 Battle.net 創造帳戶時，您必須選擇帳戶名稱與密碼。您有責任維護密碼之機密性，並對您帳戶下發生之所有活動負完全責任。在使用 Battle.net 服務期間，請遵守公平競爭原則並尊重其他玩者。',
  '',
  '4. 帳戶失效與終止',
  '若 Battle.net 帳戶與人物長期未啟用，將會定期失效。超過九十（90）天未登錄之帳戶可能會被自動刪除。',
  '',
  '點選下方「同意」，即表示您確認已完整閱讀並接受本 BATTLE.NET 使用宣告協議。',
].join('\n')

export const CANONICAL_FRONTEND_STRINGS_CHI: Readonly<Record<string, any>> = {
  singlePlayer: '單一玩者',
  battleNet: 'BATTLE.NET',
  otherMultiplayer: '其他多人連線',
  exitDiablo2: '離開暗黑破壞神II',
  credits: '製作群',
  cinematics: '動畫片斷',
  gatewayPrefix: '閘道：',
  connectingToBattleNet: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5171]!,
  queryingGateway: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5172]!,
  connectingToFastest: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5173]!,
  accessingAccount: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5174]!,
  checkingVersions: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5175]!,
  verifyingCdKey: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5176]!,
  gettingPlayerProfile: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5177]!,
  loginTitle: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5204]!,
  bnetLoginTitle: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5204]!,
  loginInstruction: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5205]!,
  bnetLoginInstruction: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5205]!,
  accountName: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5224]!,
  password: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5225]!,
  verifyPassword: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[10834]!,
  logIn: '登錄',
  accountSettings: '帳號設定',
  createNewAccount: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5221]!,
  createBnetAccountTitle: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5222]!,
  exit: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5101]!,
  ok: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5102]!,
  cancel: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5103]!,
  createAccountInstruction: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5223]!,
  termsOfUseTitle: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5180]!,
  agree: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5181]!,
  disagree: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5182]!,
  dontAgree: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5182]!,
  pleaseReadTitle: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5227]!,
  pleaseReadPara1: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5228]!,
  pleaseReadPara2: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5229]!,
  pleaseReadPara3: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5230]!,
  errAccountTooShort: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5216]!,
  errAccountTooLong: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5217]!,
  errPasswordMismatch: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5218]!,
  errPasswordTooShort: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5219]!,
  errPasswordTooLong: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5220]!,
  errAccountDisallowed: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5231]!,
  errAccountInvalidChars: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5232]!,
  errAccountBannedWord: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5233]!,
  errAccountStillProcessing: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5234]!,
  errAccountNotEnoughAlphanum: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5235]!,
  errAccountAdjacentPunct: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5236]!,
  errAccountTooManyPunct: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5237]!,
  errAccountExistsSuggest: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5238]!,
  errAccountAlreadyExists: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5239]!,
  unableToCreateAccount: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5249]!,
  termsOfUseText: DEFAULT_CHI_TERMS_OF_USE_TEXT,
  levelLabel: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4057]!,
  levelFormat: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5017]!,
  expiresToday: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[11132]!,
  expiresInDays: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[11133]!,
  characterExpired: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[11134]!,
  gemActivated: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5334]!,
  gemDeactivated: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5335]!,
  perfectGemActivated: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5336]!,
  '4007': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4007]!,
  '4008': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4008]!,
  '4009': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4009]!,
  '4010': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4010]!,
  '4011': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4011]!,
  '4012': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4012]!,
  '4013': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4013]!,
  '4057': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4057]!,
  '5017': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5017]!,
  '5101': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5101]!,
  '5102': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5102]!,
  '5103': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5103]!,
  '5150': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5150]!,
  '5151': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5151]!,
  '5171': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5171]!,
  '5172': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5172]!,
  '5173': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5173]!,
  '5174': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5174]!,
  '5175': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5175]!,
  '5176': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5176]!,
  '5177': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5177]!,
  '5180': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5180]!,
  '5181': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5181]!,
  '5182': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5182]!,
  '5204': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5204]!,
  '5205': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5205]!,
  '5216': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5216]!,
  '5217': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5217]!,
  '5218': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5218]!,
  '5219': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5219]!,
  '5220': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5220]!,
  '5221': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5221]!,
  '5222': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5222]!,
  '5223': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5223]!,
  '5224': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5224]!,
  '5225': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5225]!,
  '5226': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5226]!,
  '5227': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5227]!,
  '5228': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5228]!,
  '5229': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5229]!,
  '5230': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5230]!,
  '5231': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5231]!,
  '5232': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5232]!,
  '5233': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5233]!,
  '5234': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5234]!,
  '5235': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5235]!,
  '5236': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5236]!,
  '5237': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5237]!,
  '5238': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5238]!,
  '5239': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5239]!,
  '5249': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5249]!,
  '5269': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5269]!,
  '5271': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5271]!,
  '5275': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5275]!,
  '5334': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5334]!,
  '5335': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5335]!,
  '5336': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5336]!,
  '10834': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[10834]!,
  '11127': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[11127]!,
  '11132': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[11132]!,
  '11133': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[11133]!,
  '11134': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[11134]!,
  '22731': CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[22731]!,
  chooseClassTitle: '選擇英雄的職業',
  characterName: '人物名稱',
  expansionCharacter: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[22731]!,
  hardcore: '專家級',
  ladderCharacter: '天梯人物',
  selectCharacterTitle: '選擇人物',
  createNewCharacter: '創造新人物',
  convertToExpansion: '轉換為資料片人物',
  deleteCharacter: '刪除人物',
  classes: {
    am: {
      name: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4011]!,
      desc: '精於用矛和弓箭，她是個極為多才多藝的戰士。',
    },
    as: {
      name: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4013]!,
      desc: '精通武學藝術，她的心智與身體就是致命的武器。',
    },
    ne: {
      name: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4009]!,
      desc: '召喚不死的僕從，並利用他的專長將敵人詛咒致死。',
    },
    ba: {
      name: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4007]!,
      desc: '他在近距離作戰和武器的專精程度無與倫比。',
    },
    pa: {
      name: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4008]!,
      desc: '他是天生的隊長，聖者，也是受到祝福的戰士。',
    },
    so: {
      name: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4010]!,
      desc: '她專精於元素方面的魔法-火焰、閃電、冰凍。',
    },
    dz: {
      name: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[4012]!,
      desc: '掌控自然的力量，他能召喚野獸與狂暴的風暴助戰。',
    },
  },
  lobby: {
    send: '發送',
    whisper: '耳語',
    help: '求助',
    squelch: '緘默',
    unsquelch: '解除緘默',
    emote: '行動',
    create: '開創',
    join: '加入',
    ladder: '天梯',
    channel: '頻道',
    quit: '結束',
    createGameTitle: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5150]!,
    joinGameTitle: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5151]!,
    joinGameBtn: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5151]!,
    joinGameListHeader: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5275]!,
    gameName: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5269]!,
    gamePassword: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5271]!,
    gameDescription: '遊戲說明',
    maxPlayers: '最多加入人數',
    charDifference: '人物差別',
    selectDifficulty: '選擇困難度',
    normal: '普通',
    nightmare: '惡夢',
    hell: '地獄',
    createGameBtn: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5150]!,
    gemActivated: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5334]!,
    gemDeactivated: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5335]!,
    perfectGemActivated: CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[5336]!,
  },
}

export function isChiFrontendActive(): boolean {
  return hasExplicitLangContext() && getTblLang() === 'CHI'
}

/**
 * Resolve a `.tbl` string by its numeric `tblId` (or optional semantic `keyFallback`) from `strings`
 * when provided, or from the canonical `.tbl` dictionary / `requireTbl`.
 * Throws an explicit Error if the string is missing — never falls back to hardcoded English literals.
 */
export function resolveStringByTblId(
  strings: Record<string, unknown> | undefined,
  tblId: number,
  keyFallback?: string,
): string {
  if (isChiFrontendActive()) {
    const chiById = CANONICAL_D2LAUNCH_CHI_TBL_BY_ID[tblId]
    if (typeof chiById === 'string' && chiById.length > 0) return chiById
    if (keyFallback) {
      const chiByKey = CANONICAL_FRONTEND_STRINGS_CHI[keyFallback]
      if (typeof chiByKey === 'string' && chiByKey.length > 0) return chiByKey
      if (keyFallback.includes('.')) {
        const [ns, subKey] = keyFallback.split('.', 2)
        const nsObj = ns ? CANONICAL_FRONTEND_STRINGS_CHI[ns] : undefined
        if (nsObj && typeof nsObj === 'object' && subKey) {
          const nested = (nsObj as Record<string, unknown>)[subKey]
          if (typeof nested === 'string' && nested.length > 0) return nested
        }
      }
    }
    const fromChiTbl =
      lookupTbl(String(tblId), 'CHI') ??
      (keyFallback ? lookupTbl(keyFallback, 'CHI') : undefined)
    if (fromChiTbl !== undefined) return fromChiTbl
  }
  if (strings) {
    const byId = strings[String(tblId)]
    if (typeof byId === 'string' && byId.length > 0) return byId
    if (keyFallback) {
      const byKey = strings[keyFallback]
      if (typeof byKey === 'string' && byKey.length > 0) return byKey
      if (keyFallback.includes('.')) {
        const [ns, subKey] = keyFallback.split('.', 2)
        const nsObj = ns ? strings[ns] : undefined
        if (nsObj && typeof nsObj === 'object' && subKey) {
          const nested = (nsObj as Record<string, unknown>)[subKey]
          if (typeof nested === 'string' && nested.length > 0) return nested
        }
      }
    }
  }
  const lang = getTblLang()
  const fromTbl =
    lookupTbl(String(tblId), lang) ??
    (keyFallback ? lookupTbl(keyFallback, lang) : undefined) ??
    CANONICAL_D2LAUNCH_TBL_BY_ID[tblId]
  if (fromTbl !== undefined) return fromTbl
  if (strings) {
    throw new Error(
      `Missing required .tbl string #${tblId}${keyFallback ? ` (${keyFallback})` : ''} in manifest strings`,
    )
  }
  return requireTbl(String(tblId), lang)
}

/**
 * Resolve localized class name via `.tbl` `4007..4013` (`CLASS_TBL_IDS`).
 */
export function resolveClassNameByTbl(
  classId: CampfireClassId,
  strings?: Record<string, unknown>,
): string {
  const tblId = CLASS_TBL_IDS[classId]
  return resolveStringByTblId(strings, tblId)
}

/**
 * Format localized `"Level %d <ClassName>"` via `.tbl` `5017` (`"Level %d"`) and `4007..4013`.
 */
export function formatCharacterLevelAndClass(
  level: number,
  classId: CampfireClassId,
  strings?: Record<string, unknown>,
): string {
  const levelPattern = resolveStringByTblId(strings, 5017)
  const levelText = levelPattern.includes('%d')
    ? levelPattern.replace('%d', String(level))
    : `${levelPattern} ${level}`
  const className = resolveClassNameByTbl(classId, strings)
  return `${levelText} ${className}`
}

export function createInitialHeroAvatarAnims(): Record<HeroToken, HeroAvatarAnimState> {
  const avatarAnims = {} as Record<HeroToken, HeroAvatarAnimState>
  for (const token of HERO_TOKENS) {
    const spec = HERO_TN_ANIM_SPECS[token]
    avatarAnims[token] = {
      heroToken: token,
      frameCount: spec.frameCount,
      animRate: spec.animRate,
      acc: 0,
      frameIndex: 0,
    }
  }
  return avatarAnims
}

export function resetHeroAvatarAnims(state: BnetFlowState): void {
  for (const token of HERO_TOKENS) {
    const anim = state.avatarAnims[token]
    anim.acc = 0
    anim.frameIndex = 0
  }
}

export function createInitialFlowState(initialRoster: RosterCharacter[] = []): BnetFlowState {
  const campfireClasses = {} as Record<CampfireClassId, CampfireClassSlotState>
  for (const id of CAMPFIRE_CLASS_ORDER) {
    const desc = D2LAUNCH_CAMPFIRE_DESCRIPTORS[id]
    const frame0Bounds: Record<CampfireAnimPhase, CampfireFrame0Bounds> = {
      nu1: { ...desc.frame0Bounds.nu1 },
      nu2: { ...desc.frame0Bounds.nu2 },
      fw: { ...desc.frame0Bounds.fw },
      nu3: { ...desc.frame0Bounds.nu3 },
      bw: { ...desc.frame0Bounds.bw },
    }
    campfireClasses[id] = {
      id: desc.id,
      heroToken: desc.heroToken,
      classTblId: desc.classTblId,
      nameEn: resolveClassNameByTbl(id),
      anchorX: desc.anchorX,
      anchorY: desc.anchorY,
      frame0Bounds,
      hitBox: getCampfireSlotHitBox({
        anchorX: desc.anchorX,
        anchorY: desc.anchorY,
        phase: 'nu1',
        frame0Bounds,
      }),
      phase: 'nu1',
      frameIndex: 0,
      phaseTicks: 0,
      frameCount: { ...desc.frameCount },
      frameRate: { ...desc.frameRate },
    }
  }

  return {
    stage: 'main_menu',
    playMode: 'bnet',
    gateway: '',
    stageTicks: 0,
    globalTick: 0,
    tickAccumulatorMs: 0,
    lastFrameTimeMs: null,
    bnetConnectStage: 0,

    // No prefilled credentials: the user (or a configured bot) must type them.
    accountName: '',
    accountPassword: '',
    accountVerifyPassword: '',
    loginError: null,
    termsScrollLine: 0,
    termsScrollOffset: 0,
    popupModal: null,
    popup: null,

    campfireClasses,
    hoveredClass: null,
    selectedClass: null,
    charName: '',
    isExpansion: true,
    isHardcore: false,
    isLadder: true,
    charCreateError: null,

    roster: [...initialRoster],
    avatarAnims: createInitialHeroAvatarAnims(),
    selectedSlotIndex: 0,
    deleteConfirmOpen: false,

    lobbySubPanel: 'create',
    gemActivated: false,
    channelName: '',
    chatMessages: [],
    chatEntries: [],
    chatInput: '',
    gameName: '',
    gamePassword: '',
    gameDescription: '',
    maxPlayers: '8',
    charDifferenceEnabled: false,
    charDifference: '99',
    difficulty: 'normal',
    createGameError: null,
    realmGames: [],
    selectedGameName: '',
    selectedGameInfo: null,
    joinGameListScroll: 0,
    joinGameDetailsScroll: 0,
    lastError: null,
    statusText: '',

    doorFrame: 0,
    sceneReady: false,

    endGame: null,

    activeInput: null,
  }
}

const FORBIDDEN_ACCOUNT_CHARS = new Set(['"', '#', '%', '*', ',', '/', '<', '>', '?', '\\'])

/**
 * Character filter for Battle.net account name (`D2Launch.dll` @ `0x6fa52630`).
 * Rejects control characters & space (`<= 0x20`), DEL and non-ASCII (`>= 0x7f`),
 * and the 10 forbidden characters: `" # % * , / < > ? \`.
 */
export function isValidAccountChar(ch: string): boolean {
  if (ch.length !== 1) return false
  const code = ch.charCodeAt(0)
  if (code <= 0x20 || code >= 0x7f) return false
  return !FORBIDDEN_ACCOUNT_CHARS.has(ch)
}

/**
 * Filter an arbitrary string down to valid Battle.net account name characters (max 15 chars).
 */
export function filterAccountName(input: string): string {
  let out = ''
  for (let i = 0; i < input.length && out.length < 15; i++) {
    const ch = input[i]!
    if (isValidAccountChar(ch)) {
      out += ch
    }
  }
  return out
}

export type AccountValidationResult =
  | { readonly valid: true }
  | {
      readonly valid: false
      readonly tblId: 5216 | 5217 | 5218 | 5219 | 5220
      readonly message: string
    }

/**
 * Client-side validation for Create New Account (`D2Launch.dll` @ `0x6fa59880`).
 * Evaluated in the exact binary check order (`5216` -> `5217` -> `5218` -> `5219` -> `5220`).
 */
export function validateNewAccountInputs(
  state: Pick<BnetFlowState, 'accountName' | 'accountPassword' | 'accountVerifyPassword'>,
  strings?: Record<string, unknown>,
): AccountValidationResult {
  if (state.accountName.length < 2) {
    return {
      valid: false,
      tblId: 5216,
      message: resolveStringByTblId(strings, 5216, 'errAccountTooShort'),
    }
  }
  if (state.accountName.length > 15) {
    return {
      valid: false,
      tblId: 5217,
      message: resolveStringByTblId(strings, 5217, 'errAccountTooLong'),
    }
  }
  if (state.accountPassword.toLowerCase() !== state.accountVerifyPassword.toLowerCase()) {
    return {
      valid: false,
      tblId: 5218,
      message: resolveStringByTblId(strings, 5218, 'errPasswordMismatch'),
    }
  }
  if (state.accountPassword.length < 2) {
    return {
      valid: false,
      tblId: 5219,
      message: resolveStringByTblId(strings, 5219, 'errPasswordTooShort'),
    }
  }
  if (state.accountPassword.length > 15) {
    return {
      valid: false,
      tblId: 5220,
      message: resolveStringByTblId(strings, 5220, 'errPasswordTooLong'),
    }
  }
  return { valid: true }
}

/**
 * Open the modal popup overlay (`PopUpOkCancel2.dc6`) on top of `returnScreen`.
 */
export function openPopupModal(
  state: BnetFlowState,
  message: string,
  returnScreen: BnetFlowStage = state.stage,
  title?: string,
  tblId?: number,
): BnetFlowState {
  const modal: PopupModalState = {
    ...(title ? { title } : {}),
    ...(tblId !== undefined ? { tblId, strId: tblId } : {}),
    message,
    body: message,
    returnScreen,
  }
  state.popupModal = modal
  state.popup = modal
  return state
}

/**
 * Dismiss the active modal popup overlay and restore `returnScreen`.
 */
export function dismissPopupModal(state: BnetFlowState): BnetFlowState {
  if (state.popupModal) {
    state.stage = state.popupModal.returnScreen
    state.popupModal = null
    state.popup = null
  }
  return state
}

/**
 * Transition `bnet_login` -> `bnet_terms_of_use` (`0x6fa59d00`).
 */
export function openTermsOfUse(state: BnetFlowState): BnetFlowState {
  state.stage = 'bnet_terms_of_use'
  state.stageTicks = 0
  state.termsScrollLine = 0
  state.termsScrollOffset = 0
  state.popupModal = null
  state.popup = null
  state.loginError = null
  state.activeInput = null
  return state
}

/**
 * Scroll the Terms of Use agreement text by `deltaLines`, clamped to `[0, maxScrollLine]`.
 */
export function scrollTermsOfUse(
  state: BnetFlowState,
  deltaLines: number,
  maxScrollLine = 100,
): BnetFlowState {
  if (state.stage !== 'bnet_terms_of_use' || state.popupModal !== null) return state
  const clampedMax = Math.max(0, maxScrollLine)
  const next = Math.max(0, Math.min(clampedMax, state.termsScrollLine + deltaLines))
  state.termsScrollLine = next
  state.termsScrollOffset = next
  return state
}

/**
 * Click `AGREE` on `bnet_terms_of_use` -> enters `bnet_create_account` (`0x6fa58ad0`).
 */
export function agreeTermsOfUse(state: BnetFlowState): BnetFlowState {
  state.stage = 'bnet_create_account'
  state.stageTicks = 0
  state.accountPassword = ''
  state.accountVerifyPassword = ''
  state.popupModal = null
  state.popup = null
  state.loginError = null
  state.activeInput = 'accountName'
  return state
}

/**
 * Click `DISAGREE` on `bnet_terms_of_use`, `EXIT` on `bnet_create_account`, or `CANCEL` on `bnet_please_read`
 * -> returns to `bnet_login`.
 */
export function returnToBnetLogin(state: BnetFlowState): BnetFlowState {
  state.stage = 'bnet_login'
  state.stageTicks = 0
  state.popupModal = null
  state.popup = null
  state.loginError = null
  state.activeInput = state.accountName ? 'accountPassword' : 'accountName'
  return state
}

export const disagreeTermsOfUse = returnToBnetLogin
export const cancelCreateAccount = returnToBnetLogin
export const cancelPleaseRead = returnToBnetLogin

/**
 * Cycle keyboard focus across the 3 edit boxes on `bnet_create_account`:
 * `accountName` -> `accountPassword` -> `accountVerifyPassword` -> `accountName`.
 */
export function cycleCreateAccountFocus(state: BnetFlowState, reverse = false): BnetFlowState {
  if (state.popupModal !== null) return state
  if (reverse) {
    if (state.activeInput === 'accountName' || state.activeInput === 'bnet_account') {
      state.activeInput = 'accountVerifyPassword'
    } else if (
      state.activeInput === 'accountVerifyPassword' ||
      state.activeInput === 'bnet_verify_password'
    ) {
      state.activeInput = 'accountPassword'
    } else {
      state.activeInput = 'accountName'
    }
    return state
  }
  if (state.activeInput === 'accountName' || state.activeInput === 'bnet_account') {
    state.activeInput = 'accountPassword'
  } else if (state.activeInput === 'accountPassword' || state.activeInput === 'bnet_password') {
    state.activeInput = 'accountVerifyPassword'
  } else {
    state.activeInput = 'accountName'
  }
  return state
}

/**
 * Append a single character to the focused field on `bnet_create_account`,
 * enforcing `isValidAccountChar` (`0x6fa52630`) on `accountName` and max 15 characters on all 3 fields.
 */
export function typeCreateAccountChar(state: BnetFlowState, ch: string): BnetFlowState {
  if (state.stage !== 'bnet_create_account' || state.popupModal !== null || ch.length !== 1) {
    return state
  }
  const f = state.activeInput
  if (f === 'accountName' || f === 'bnet_account') {
    if (state.accountName.length < 15 && isValidAccountChar(ch)) {
      state.accountName += ch
    }
  } else if (f === 'accountPassword' || f === 'bnet_password') {
    const code = ch.charCodeAt(0)
    if (code >= 0x20 && code <= 0x7e && state.accountPassword.length < 15) {
      state.accountPassword += ch
    }
  } else if (f === 'accountVerifyPassword' || f === 'bnet_verify_password') {
    const code = ch.charCodeAt(0)
    if (code >= 0x20 && code <= 0x7e && state.accountVerifyPassword.length < 15) {
      state.accountVerifyPassword += ch
    }
  }
  return state
}

/**
 * Remove the last character from the focused field on `bnet_create_account`.
 */
export function backspaceCreateAccountChar(state: BnetFlowState): BnetFlowState {
  if (state.stage !== 'bnet_create_account' || state.popupModal !== null) {
    return state
  }
  const f = state.activeInput
  if (f === 'accountName' || f === 'bnet_account') {
    state.accountName = state.accountName.slice(0, -1)
  } else if (f === 'accountPassword' || f === 'bnet_password') {
    state.accountPassword = state.accountPassword.slice(0, -1)
  } else if (f === 'accountVerifyPassword' || f === 'bnet_verify_password') {
    state.accountVerifyPassword = state.accountVerifyPassword.slice(0, -1)
  }
  return state
}

/**
 * Click `OK` or press `Enter` on `bnet_create_account` (`0x6fa59880`):
 * Validates all 3 fields; if invalid, opens the modal error popup; if valid, transitions to `bnet_please_read`.
 */
export function submitCreateAccountForm(
  state: BnetFlowState,
  strings?: Record<string, unknown>,
): boolean {
  if (state.stage !== 'bnet_create_account' || state.popupModal !== null) return false
  const check = validateNewAccountInputs(state, strings)
  if (!check.valid) {
    openPopupModal(state, check.message, 'bnet_create_account', undefined, check.tblId)
    return false
  }
  state.popupModal = null
  state.popup = null
  state.stage = 'bnet_please_read'
  state.stageTicks = 0
  state.activeInput = null
  return true
}

/**
 * Map server `SID_CREATEACCOUNT2` status code (`0x01..0x08`) to canonical `.tbl` string ID and message
 * (`D2Launch.dll` @ `0x6fa58e40`).
 */
export function mapCreateAccountServerStatus(
  status: number,
  strings?: Record<string, unknown>,
): {
  readonly tblId: 5231 | 5232 | 5233 | 5234 | 5235 | 5236 | 5237 | 5239
  readonly titleTblId: 5249
  readonly title: string
  readonly message: string
} {
  const title = resolveStringByTblId(strings, 5249, 'unableToCreateAccount')
  switch (status) {
    case 0x02:
      return {
        tblId: 5232,
        titleTblId: 5249,
        title,
        message: resolveStringByTblId(strings, 5232, 'errAccountInvalidChars'),
      }
    case 0x03:
      return {
        tblId: 5233,
        titleTblId: 5249,
        title,
        message: resolveStringByTblId(strings, 5233, 'errAccountBannedWord'),
      }
    case 0x04:
      return {
        tblId: 5239,
        titleTblId: 5249,
        title,
        message: resolveStringByTblId(strings, 5239, 'errAccountAlreadyExists'),
      }
    case 0x05:
      return {
        tblId: 5234,
        titleTblId: 5249,
        title,
        message: resolveStringByTblId(strings, 5234, 'errAccountStillProcessing'),
      }
    case 0x06:
      return {
        tblId: 5235,
        titleTblId: 5249,
        title,
        message: resolveStringByTblId(strings, 5235, 'errAccountNotEnoughAlphanum'),
      }
    case 0x07:
      return {
        tblId: 5236,
        titleTblId: 5249,
        title,
        message: resolveStringByTblId(strings, 5236, 'errAccountAdjacentPunct'),
      }
    case 0x08:
      return {
        tblId: 5237,
        titleTblId: 5249,
        title,
        message: resolveStringByTblId(strings, 5237, 'errAccountTooManyPunct'),
      }
    default:
      return {
        tblId: 5231,
        titleTblId: 5249,
        title,
        message: resolveStringByTblId(strings, 5231, 'errAccountDisallowed'),
      }
  }
}

/**
 * Apply a server-side `SID_CREATEACCOUNT2` rejection to `BnetFlowState` (`0x6fa58e40`):
 * Returns to `bnet_create_account`, preserves `accountName`, clears password fields,
 * and opens the `"Unable to Create Account"` (`5249`) modal popup.
 */
export function applyCreateAccountServerError(
  state: BnetFlowState,
  status: number,
  strings?: Record<string, unknown>,
): BnetFlowState {
  const mapped = mapCreateAccountServerStatus(status, strings)
  state.stage = 'bnet_create_account'
  state.stageTicks = 0
  state.accountPassword = ''
  state.accountVerifyPassword = ''
  state.activeInput = 'accountName'
  openPopupModal(state, mapped.message, 'bnet_create_account', mapped.title, mapped.tblId)
  return state
}

/**
 * Count the total number of hyphen (`'-'`) and underscore (`'_'`) characters in `text`
 * (`D2Launch.dll` @ `0x6fa52310` `CHARCREATE_CountHyphenUnderscore`).
 */
export function countHyphenUnderscore(text: string): number {
  let count = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '-' || ch === '_') {
      count += 1
    }
  }
  return count
}

/**
 * Per-keystroke character name filter (`D2Launch.dll` @ `0x6fa52360` `CHARCREATE_CharNameFilter`):
 * - Maximum length 15 characters
 * - Accepts ASCII letters `A-Z` and `a-z`
 * - Rejects digits `0-9` and all other punctuation/spaces
 * - Accepts `'-'` or `'_'` ONLY if `currentText.length > 0` (not the first char) AND
 *   `countHyphenUnderscore(currentText) < 1` (at most 1 hyphen or underscore total).
 */
export function canAcceptCharNameChar(currentText: string, ch: string): boolean {
  if (ch.length !== 1 || currentText.length >= 15) return false
  const code = ch.charCodeAt(0)
  const isUpper = code >= 0x41 && code <= 0x5a
  const isLower = code >= 0x61 && code <= 0x7a
  if (isUpper || isLower) return true
  if (ch === '-' || ch === '_') {
    return currentText.length > 0 && countHyphenUnderscore(currentText) < 1
  }
  return false
}

/**
 * Filter an arbitrary string through `canAcceptCharNameChar` (`0x6fa52360`).
 */
export function filterCharacterName(input: string): string {
  let out = ''
  for (let i = 0; i < input.length && out.length < 15; i++) {
    const ch = input[i]!
    if (canAcceptCharNameChar(out, ch)) {
      out += ch
    }
  }
  return out
}

/**
 * Validate character name per `D2Launch.dll` (`0x6fa54710` `CHARCREATE_OnCharNameChange` & `0x6fa52360`):
 * - 2 to 15 characters
 * - Only ASCII letters (`A-Z`, `a-z`), `'-'`, or `'_'` (digits `0-9` are forbidden)
 * - First and last character cannot be `'-'` or `'_'`
 * - Total count of `'-'` and `'_'` combined must be `< 2` (at most 1).
 */
export function isValidCharacterName(name: string): boolean {
  if (name.length < 2 || name.length > 15) return false
  if (!/^[A-Za-z_-]+$/.test(name)) return false
  const first = name[0]
  const last = name[name.length - 1]
  if (first === '-' || first === '_' || last === '-' || last === '_') return false
  if (countHyphenUnderscore(name) >= 2) return false
  return true
}

const BNCS_STAGE_FALLBACK_KEYS: Readonly<Record<BnetConnectStageIndex, string>> = {
  0: 'connectingToBattleNet',
  1: 'queryingGateway',
  2: 'connectingToFastest',
  3: 'accessingAccount',
  4: 'checkingVersions',
  5: 'verifyingCdKey',
  6: 'gettingPlayerProfile',
}

/**
 * Update the BNCS connection stage (`0..6` -> `.tbl` `5171..5177`, `D2Launch.dll` @ `0x6fa6158c`).
 */
export function setBnetConnectStage(
  state: BnetFlowState,
  stageIndex: BnetConnectStageIndex,
  strings?: Record<string, unknown>,
): string {
  state.bnetConnectStage = stageIndex
  const tblId = BNCS_CONNECT_STAGE_TBL_IDS[stageIndex]
  const text = resolveStringByTblId(strings, tblId, BNCS_STAGE_FALLBACK_KEYS[stageIndex])
  state.statusText = text
  return text
}

/**
 * Resolve the current BNCS connection stage status text (`5171..5177`, `0x6fa6158c`).
 */
export function resolveBnetConnectStageText(
  state: Pick<BnetFlowState, 'bnetConnectStage' | 'statusText'>,
  strings?: Record<string, unknown>,
): string {
  const idx: BnetConnectStageIndex = state.bnetConnectStage ?? 0
  const tblId = BNCS_CONNECT_STAGE_TBL_IDS[idx]
  return resolveStringByTblId(strings, tblId, BNCS_STAGE_FALLBACK_KEYS[idx])
}

/**
 * Transition from `bnet_connecting` to `bnet_login` once BNCS handshake completes (`stage 3` / `.tbl` `5174`).
 */
export function completeBnetConnect(
  state: BnetFlowState,
  strings?: Record<string, unknown>,
): void {
  setBnetConnectStage(state, 3, strings)
  state.stage = 'bnet_login'
  state.stageTicks = 0
  state.activeInput = state.accountName ? 'accountPassword' : 'accountName'
}

/**
 * Click `SINGLE PLAYER` on Stage 1 Main Menu -> enters `char_select` (if characters exist)
 * or `char_create` (if roster is empty) in Single Player mode (`playMode = 'single'`).
 */
export function clickSinglePlayerButton(state: BnetFlowState): void {
  if (state.stage !== 'main_menu') return
  state.playMode = 'single'
  state.onlineConnected = false
  state.popupModal = null
  state.popup = null
  state.loginError = null
  state.lastError = null
  state.stageTicks = 0
  if (state.roster.length === 0) {
    enterCharCreate(state)
  } else {
    state.stage = 'char_select'
    state.selectedSlotIndex = 0
    state.activeInput = null
    resetHeroAvatarAnims(state)
  }
}

/**
 * Click `BATTLE.NET` on Stage 1 Main Menu -> enters `bnet_connecting` at stage 0 (`.tbl` `5171`).
 */
export function clickBattleNetButton(
  state: BnetFlowState,
  strings?: Record<string, unknown>,
): void {
  if (state.stage !== 'main_menu') return
  state.playMode = 'bnet'
  state.stage = 'bnet_connecting'
  state.stageTicks = 0
  state.activeInput = null
  setBnetConnectStage(state, 0, strings)
}

/**
 * Cancel connecting modal -> returns to `main_menu`.
 */
export function cancelConnecting(state: BnetFlowState): void {
  if (state.stage !== 'bnet_connecting') return
  state.stage = 'main_menu'
  state.stageTicks = 0
}

/**
 * Submit Battle.net Login:
 * Requires non-empty `accountName`. If the user's character roster is empty, transitions
 * to Stage 3 (`char_create`); otherwise transitions to Stage 4 (`char_select`).
 */
export function submitBattleNetLogin(state: BnetFlowState): boolean {
  if (state.stage !== 'bnet_login') return false
  if (!state.accountName.trim()) {
    return false
  }
  state.loginError = null
  state.stageTicks = 0
  if (state.roster.length === 0) {
    enterCharCreate(state)
  } else {
    state.stage = 'char_select'
    state.selectedSlotIndex = 0
    state.activeInput = null
    resetHeroAvatarAnims(state)
  }
  return true
}

/**
 * Enter Stage 3 (`char_create`) and reset all 7 classes to campfire back idle (`nu1`).
 */
export function enterCharCreate(state: BnetFlowState): void {
  state.stage = 'char_create'
  state.stageTicks = 0
  state.hoveredClass = null
  state.selectedClass = null
  state.charName = ''
  state.isExpansion = true
  state.isHardcore = false
  state.isLadder = state.playMode !== 'single'
  state.charCreateError = null
  state.activeInput = null
  for (const id of CAMPFIRE_CLASS_ORDER) {
    const slot = state.campfireClasses[id]
    slot.phase = 'nu1'
    slot.frameIndex = 0
    slot.phaseTicks = 0
    slot.hitBox = getCampfireSlotHitBox(slot)
  }
}

/**
 * Hover a class at the campfire (`nu1` <-> `nu2`) per `D2Win.dll` `0x6f8f0966` (`ANIMIMAGE_OnMouseMove`):
 * Toggling between `nu1` and `nu2` preserves continuous `frameIndex` and `phaseTicks` without resetting to 0.
 */
export function hoverCampfireClass(state: BnetFlowState, classId: CampfireClassId | null): void {
  if (state.stage !== 'char_create') return
  const prev = state.hoveredClass
  if (prev === classId) return
  if (prev && state.campfireClasses[prev].phase === 'nu2') {
    const prevSlot = state.campfireClasses[prev]
    prevSlot.phase = 'nu1'
    const loopLen = Math.max(1, (prevSlot.frameCount.nu1 || 1) - 1)
    prevSlot.frameIndex = prevSlot.frameIndex % loopLen
    prevSlot.hitBox = getCampfireSlotHitBox(prevSlot)
  }
  state.hoveredClass = classId
  if (classId && state.campfireClasses[classId].phase === 'nu1') {
    const nextSlot = state.campfireClasses[classId]
    nextSlot.phase = 'nu2'
    const loopLen = Math.max(1, (nextSlot.frameCount.nu2 || 1) - 1)
    nextSlot.frameIndex = nextSlot.frameIndex % loopLen
    nextSlot.hitBox = getCampfireSlotHitBox(nextSlot)
  }
}

/**
 * Click one of the 7 classes at the campfire (`D2Launch.dll` @ `0x6fa5d780`):
 * - Previously selected class (if in `fw` or `nu3`) walks back (`bw` -> `nu1`)
 * - Newly clicked class walks forward (`fw` -> `nu3`) and focuses the `charName` input box.
 */
export function selectCampfireClass(state: BnetFlowState, classId: CampfireClassId): void {
  if (state.stage !== 'char_create') return
  const prev = state.selectedClass
  if (prev === classId) {
    state.activeInput = 'charName'
    return
  }
  if (prev) {
    const prevSlot = state.campfireClasses[prev]
    if (prevSlot.phase === 'fw' || prevSlot.phase === 'nu3') {
      prevSlot.phase = 'bw'
      prevSlot.frameIndex = 0
      prevSlot.phaseTicks = 0
      prevSlot.hitBox = getCampfireSlotHitBox(prevSlot)
    } else {
      prevSlot.phase = 'nu1'
      prevSlot.frameIndex = 0
      prevSlot.phaseTicks = 0
      prevSlot.hitBox = getCampfireSlotHitBox(prevSlot)
    }
  }
  state.selectedClass = classId
  state.charCreateError = null
  const nextSlot = state.campfireClasses[classId]
  nextSlot.phase = 'fw'
  nextSlot.frameIndex = 0
  nextSlot.phaseTicks = 0
  nextSlot.hitBox = getCampfireSlotHitBox(nextSlot)
  state.activeInput = 'charName'
}

/**
 * Confirm Character Creation (`OK` button on Stage 3):
 * Validates class selection & character name (`0x6fa54710`), adds the new character to `state.roster`,
 * and transitions to Stage 4 (`char_select`) with the newly created hero selected in Slot 0.
 */
export function submitCharacterCreate(
  state: BnetFlowState,
  strings?: Record<string, unknown>,
): RosterCharacter | null {
  if (state.stage !== 'char_create') return null
  if (!state.selectedClass) {
    return null
  }
  const trimmedName = state.charName.trim()
  if (!isValidCharacterName(trimmedName)) {
    return null
  }
  const spec = CAMPFIRE_CLASS_SPECS[state.selectedClass]
  const unequippedStatstring = new Uint8Array(33)
  unequippedStatstring.fill(0xff)
  unequippedStatstring[0] = 0x84
  unequippedStatstring[1] = 0x80
  unequippedStatstring[13] = CAMPFIRE_TO_CHAR_CLASS_ID[spec.id] + 1
  unequippedStatstring[25] = 1
  unequippedStatstring[26] =
    (state.isExpansion ? 0x20 : 0) | (state.isHardcore ? 0x04 : 0) | (state.isLadder ? 0x40 : 0)
  unequippedStatstring[27] = 0

  const avatarDesc = parseMcpAvatarStatstring(unequippedStatstring, spec.id)
  const newChar: RosterCharacter = {
    id: `${spec.heroToken}-${Date.now()}`,
    name: trimmedName,
    classId: spec.id,
    heroToken: spec.heroToken,
    className: resolveClassNameByTbl(spec.id, strings),
    level: 1,
    isExpansion: state.isExpansion,
    isHardcore: state.isHardcore,
    isLadder: state.isLadder,
    progression: 0,
    maxDifficulty: 'normal',
    statstring: unequippedStatstring,
    components: avatarDesc.components,
    componentColors: avatarDesc.componentColors,
    weaponClass: avatarDesc.weaponClass,
    avatarDesc,
    createdAt: Date.now(),
  }
  state.roster = [newChar, ...state.roster].slice(0, 8)
  state.selectedSlotIndex = 0
  state.stageTicks = 0
  state.activeInput = null
  if (state.playMode === 'single') {
    state.stage = 'door_loading'
    state.doorFrame = 0
    state.sceneReady = false
  } else {
    state.stage = 'char_select'
    resetHeroAvatarAnims(state)
  }
  return newChar
}

/**
 * Compute remaining days until character expiration (`D2Launch.dll` @ `0x6fa4b273`):
 * `days = floor((expiresAtSec - nowSec) / 86400)`. Returns `undefined` when `expiresAtSec` is absent or `0`.
 */
export function computeCharacterExpirationDays(
  expiresAtSec:
    | number
    | { readonly expiresAt?: number | undefined; readonly expiresAtSec?: number | undefined }
    | undefined,
  nowSec: number = Math.floor(Date.now() / 1000),
): number | undefined {
  const rawExpires =
    typeof expiresAtSec === 'number'
      ? expiresAtSec
      : expiresAtSec?.expiresAtSec ?? expiresAtSec?.expiresAt
  if (rawExpires === undefined || !Number.isFinite(rawExpires) || rawExpires <= 0) {
    return undefined
  }
  const diffSec = rawExpires - nowSec
  if (diffSec <= 0) return 0
  return Math.floor(diffSec / 86400)
}

/**
 * Format character expiration banner text per `D2Launch.dll` `0x6fa4b273..0x6fa4b30d`:
 * - Only displayed when `daysRemaining <= 60` (`cmp edx, 0x3c; ja skip`).
 * - `daysRemaining <= 0` -> `.tbl` `11134` (`"Character Expired"`, `isUrgent: true`)
 * - `daysRemaining === 1` -> `.tbl` `11132` (`"Expires Today"`, `isUrgent: true`)
 * - `2 <= daysRemaining <= 60` -> `.tbl` `11133` (`"Expires in %d days"`, `isUrgent: daysRemaining < 15`)
 */
export function formatCharacterExpirationText(
  daysRemaining: number | undefined,
  strings?: Record<string, unknown>,
): {
  readonly text: string
  readonly tblId: 11132 | 11133 | 11134
  readonly isUrgent: boolean
} | null {
  if (daysRemaining === undefined || !Number.isFinite(daysRemaining) || daysRemaining > 60) {
    return null
  }
  const days = Math.floor(daysRemaining)
  if (days <= 0) {
    return {
      text: resolveStringByTblId(strings, 11134, 'characterExpired'),
      tblId: 11134,
      isUrgent: true,
    }
  }
  if (days === 1) {
    return {
      text: resolveStringByTblId(strings, 11132, 'expiresToday'),
      tblId: 11132,
      isUrgent: true,
    }
  }
  const pattern = resolveStringByTblId(strings, 11133, 'expiresInDays')
  const text = pattern.replace('%d', String(days))
  return {
    text,
    tblId: 11133,
    isUrgent: days < 15,
  }
}

/**
 * Determine the highest unlocked difficulty for a character per 1.13c `D2Multi.dll` (`0x6f9e5182..0x6f9e52cd`):
 * - Expansion (`isExpansion === true`, 5 acts/difficulty):
 *   - `progression >= 10` -> `'hell'`
 *   - `progression >= 5`  -> `'nightmare'`
 *   - otherwise           -> `'normal'`
 * - Classic (`isExpansion === false`, 4 acts/difficulty):
 *   - `progression >= 8`  -> `'hell'`
 *   - `progression >= 4`  -> `'nightmare'`
 *   - otherwise           -> `'normal'`
 */
export function getCharacterMaxDifficulty(
  char: Pick<RosterCharacter, 'isExpansion' | 'progression' | 'maxDifficulty'> | undefined,
): GameDifficulty {
  if (!char) return 'normal'
  if (char.maxDifficulty) return char.maxDifficulty
  const prog = char.progression ?? 0
  if (char.isExpansion) {
    if (prog >= 10) return 'hell'
    if (prog >= 5) return 'nightmare'
    return 'normal'
  }
  if (prog >= 8) return 'hell'
  if (prog >= 4) return 'nightmare'
  return 'normal'
}

export function isDifficultyUnlocked(
  char: Pick<RosterCharacter, 'isExpansion' | 'progression' | 'maxDifficulty'> | undefined,
  difficulty: GameDifficulty,
): boolean {
  if (difficulty === 'normal') return true
  const maxDiff = getCharacterMaxDifficulty(char)
  if (difficulty === 'nightmare') return maxDiff === 'nightmare' || maxDiff === 'hell'
  return maxDiff === 'hell'
}

/**
 * Check whether the `CREATE GAME` button should be enabled per `D2Multi.dll` (`0x6f9e3af0..0x6f9e3c49`).
 */
export function canSubmitCreateGame(state: BnetFlowState): boolean {
  const trimmedGame = state.gameName.trim()
  if (trimmedGame.length < 1 || trimmedGame.length > 15) return false
  const maxP = Number.parseInt(state.maxPlayers.trim(), 10)
  if (!Number.isFinite(maxP) || maxP < 1 || maxP > 8) return false
  if (state.charDifferenceEnabled) {
    const diff = Number.parseInt(state.charDifference.trim(), 10)
    if (!Number.isFinite(diff) || diff < 1 || diff > 99) return false
  }
  const selectedChar = state.roster[state.selectedSlotIndex]
  if (selectedChar && !isDifficultyUnlocked(selectedChar, state.difficulty)) return false
  return true
}

/**
 * Check whether the `JOIN GAME` button should be enabled per `D2Multi.dll` (`0x6f9e1870`):
 * enabled iff `gameName` has length >= 1 (`cmp byte [eax], 0; sete al; not al; and al, 1`).
 */
export function canSubmitJoinGame(state: BnetFlowState): boolean {
  const trimmedGame = state.gameName.trim()
  return trimmedGame.length >= 1 && trimmedGame.length <= 15
}

const JOIN_GAME_CLASS_NAMES_113C: Readonly<Record<number, string>> = {
  0: 'Amazon',
  1: 'Sorceress',
  2: 'Necromancer',
  3: 'Paladin',
  4: 'Barbarian',
  5: 'Druid',
  6: 'Assassin',
} as const

/**
 * Format right-hand Game Details TextBox lines for a selected realm game in the Join Game sub-panel
 * per `D2Multi.dll` `0x6f9e3280` (`.rdata` format strings `0x6f9e7504..0x6f9e75d7`):
 * 1. If `description` is non-empty: `description` (color 0 White), then blank line `""`.
 * 2. `"Elapsed Time: %d:%02d:%02d"` (`0x6f9e75bc`, color 0).
 * 3. If `levelDiff < 100` (`0x64`):
 *    - `levelDiff === 0`: `"Level %d"` (`0x6f9e75a0`, `creatorLevel`, color 0).
 *    - `1 <= levelDiff < 100`: `"Level %d to %d"` (`0x6f9e75ac`, `max(1, creatorLevel - levelDiff)`..`min(99, creatorLevel + levelDiff)`, color 0).
 * 4. If `1 <= maxPlayers < 8`: `"Up to %d Players"` (`0x6f9e758c`, color 0).
 * 5. Blank line `""` (`0x6f9e75d7`).
 * 6. For each player with non-empty `name`:
 *    - `player.name` (color 0 White).
 *    - `"Level %d <ClassName>"` (`0x6f9e7504..0x6f9e757c`, color 5 DarkGray per `push 0x5; call 0x6f9d7c5c` @ `0x6f9e347f`).
 */
export function formatJoinGameDetailLines(
  info: LobbyJoinGameInfo | null | undefined,
  strings?: Record<string, unknown>,
): readonly JoinGameDetailLine[] {
  if (!info) {
    return []
  }
  // Per D2MCPClient.dll (0x6fa26280) & D2Multi.dll (0x6f9e3280):
  // Live d2cs MCP_GAMEINFO (0x06) sets `status` to the game status bitmask
  // (e.g. 0x00300004 where bit 0x04 = GAME_STAT_OPEN), whereas 0xffffffff / 0xfffffffe
  // or closed status ((status & 0x04) === 0 when status !== 0) indicates an unavailable game.
  const statusU32 = (info.status ?? 0) >>> 0
  if (
    statusU32 === 0xffffffff ||
    statusU32 === 0xfffffffe ||
    (statusU32 !== 0 && (statusU32 & 0x04) === 0) ||
    (statusU32 === 0 && info.maxPlayers === 0 && info.players.length === 0)
  ) {
    return []
  }
  const useChi = isChiFrontendActive()
  const lines: JoinGameDetailLine[] = []
  const desc = info.description ?? ''
  if (desc.length > 0) {
    lines.push({ text: desc, color: 0 })
    lines.push({ text: '', color: 0 })
  }

  const totalSec = Math.max(0, Math.floor(info.uptimeSec || 0))
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  const elapsedFormatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  lines.push({
    text: useChi ? `已進行時間：${elapsedFormatted}` : `Elapsed Time: ${elapsedFormatted}`,
    color: 0,
  })

  if (
    info.levelDiff !== undefined &&
    info.creatorLevel !== undefined &&
    info.levelDiff >= 0 &&
    info.levelDiff < 100
  ) {
    if (info.levelDiff === 0) {
      lines.push({
        text: useChi ? `等級 ${info.creatorLevel}` : `Level ${info.creatorLevel}`,
        color: 0,
      })
    } else {
      const minLvl = Math.max(1, info.creatorLevel - info.levelDiff)
      const maxLvl = Math.min(99, info.creatorLevel + info.levelDiff)
      lines.push({
        text: useChi ? `等級 ${minLvl} 到 ${maxLvl}` : `Level ${minLvl} to ${maxLvl}`,
        color: 0,
      })
    }
  }

  if (info.maxPlayers >= 1 && info.maxPlayers < 8) {
    lines.push({
      text: useChi ? `最多 ${info.maxPlayers} 位玩者` : `Up to ${info.maxPlayers} Players`,
      color: 0,
    })
  }

  lines.push({ text: '', color: 0 })

  for (const p of info.players) {
    if (!p.name) continue
    lines.push({ text: p.name, color: 0 })
    const campfireId = CHAR_CLASS_ID_TO_CAMPFIRE[p.charClass]
    const className = campfireId
      ? resolveClassNameByTbl(campfireId, strings)
      : JOIN_GAME_CLASS_NAMES_113C[p.charClass]
    lines.push({
      text: useChi
        ? className
          ? `等級 ${p.level} ${className}`
          : `等級 ${p.level}`
        : className
          ? `Level ${p.level} ${className}`
          : `Level ${p.level}`,
      color: 5,
    })
  }

  return lines
}

/**
 * Reset the Battle.net Lobby Create/Join Game form fields (`D2Multi.dll` `0x6f9e4bc0` & `0x6f9e533f..0x6f9e535c`)
 * when entering the lobby from Character Select or returning from an in-game session, preventing
 * stale `gameName` or `gamePassword` values from leaking into subsequent room creations.
 */
export function resetLobbyGameFormState(state: BnetFlowState): void {
  state.gameName = ''
  state.gamePassword = ''
  state.gameDescription = ''
  state.selectedGameName = ''
  state.selectedGameInfo = null
  state.joinGameListScroll = 0
  state.joinGameDetailsScroll = 0
  state.createGameError = null
}

/**
 * Confirm Character Selection (`OK` button or double-click on Stage 4):
 * Transitions to Stage 5 (`bnet_lobby`) with the Create Game sub-panel open.
 * Per `D2Multi.dll` (`0x6f9e4bc0` & `0x6f9e533f..0x6f9e535c`), `gameName` and `gameDescription`
 * are never prefilled, and `difficulty` is clamped to the character's unlocked difficulties.
 */
export function confirmCharacterSelect(state: BnetFlowState): boolean {
  if (state.stage !== 'char_select') return false
  const selected = state.roster[state.selectedSlotIndex]
  if (!selected) return false
  if (state.playMode === 'single') {
    if (!isDifficultyUnlocked(selected, state.difficulty)) {
      state.difficulty = 'normal'
    }
    state.stage = 'door_loading'
    state.stageTicks = 0
    state.doorFrame = 0
    state.sceneReady = false
    state.activeInput = null
    return true
  }
  state.stage = 'bnet_lobby'
  state.stageTicks = 0
  state.lobbySubPanel = 'create'
  resetLobbyGameFormState(state)
  if (!isDifficultyUnlocked(selected, state.difficulty)) {
    state.difficulty = 'normal'
  }
  state.activeInput = 'gameName'
  resetHeroAvatarAnims(state)
  return true
}

/**
 * Toggle the iconic Battle.net Lobby Chat Gem (`gembutton.dc6` at `(398, 474)`).
 * Resolves `.tbl` `5334` (`Gem Activated`), `5335` (`Gem Deactivated`), or `5336` (`Perfect Gem Activated`)
 * (`D2Multi.dll` @ `0x6f9dc660`) and records a structured chat entry with `color: 3` (Blue).
 */
export function toggleChatGem(
  state: BnetFlowState,
  strings?: Record<string, unknown>,
  options?: { readonly perfect?: boolean | undefined } | boolean,
): LobbyChatEntry | null {
  if (state.stage !== 'bnet_lobby') return null
  state.gemActivated = !state.gemActivated
  const isPerfect = typeof options === 'boolean' ? options : Boolean(options?.perfect)
  const tblId: 5334 | 5335 | 5336 = state.gemActivated
    ? isPerfect
      ? 5336
      : 5334
    : 5335
  const fallbackKey =
    tblId === 5336
      ? 'lobby.perfectGemActivated'
      : tblId === 5334
        ? 'lobby.gemActivated'
        : 'lobby.gemDeactivated'
  const text = resolveStringByTblId(strings, tblId, fallbackKey)
  const entry: LobbyChatEntry = {
    text,
    color: 3,
    kind: 'gem',
    tblId,
  }
  state.chatMessages.push(text)
  state.chatEntries.push(entry)
  if (state.chatMessages.length > 14) {
    state.chatMessages.shift()
  }
  if (state.chatEntries.length > 14) {
    state.chatEntries.shift()
  }
  return entry
}

/**
 * Click `CREATE GAME` on Stage 5 Battle.net Lobby -> transitions to Stage 6 (`door_loading`).
 */
export function submitCreateGame(state: BnetFlowState): boolean {
  if (state.stage !== 'bnet_lobby') return false
  if (!canSubmitCreateGame(state)) {
    return false
  }
  const trimmedGame = state.gameName.trim()
  const maxP = Number.parseInt(state.maxPlayers.trim(), 10)
  if (state.charDifferenceEnabled) {
    const diff = Number.parseInt(state.charDifference.trim(), 10)
    state.charDifference = String(diff)
  }
  state.gameName = trimmedGame
  state.maxPlayers = String(maxP)
  state.createGameError = null
  state.stage = 'door_loading'
  state.stageTicks = 0
  state.doorFrame = 0
  state.sceneReady = false
  state.activeInput = null
  return true
}

/**
 * Compute the current looping frame index for a `D2Win.dll` `AnimImage` control
 * (`0x6f8f0a50..0x6f8f0c3a`):
 * - Advances 1 frame every `rate` ticks (40ms * `rate` per frame).
 * - Wraps at `framesPerDir - 1` (`0x6f8f0ac6: lea eax, [ecx - 1]; cmp [esi + 0x5c], eax; jl ...; mov [esi + 0x5c], 0`).
 */
export function getAnimImageLoopFrame(tick: number, framesPerDir: number, rate = 1): number {
  const loopLen = Math.max(1, framesPerDir - 1)
  const stepRate = Math.max(1, rate | 0)
  return Math.floor(Math.max(0, tick) / stepRate) % loopLen
}

/**
 * Advance a single Character Selection / Lobby `TN` `HTH` hero avatar by 1 tick (40ms)
 * per `D2Win.dll` (`0x6f8ee81b..0x6f8ee850`):
 * - `acc += animRate` (8.8 fixed-point COF speed)
 * - `frame = acc >> 8`
 * - If `frame >= framesPerDir - 1`, wrap `acc = 0` (`frame = 0`).
 */
export function stepHeroAvatarAnim(anim: HeroAvatarAnimState): void {
  const wrapFrame = Math.max(1, anim.frameCount - 1)
  const nextAcc = anim.acc + anim.animRate
  const nextFrame = nextAcc >> 8
  if (nextFrame >= wrapFrame) {
    anim.acc = 0
    anim.frameIndex = 0
  } else {
    anim.acc = nextAcc
    anim.frameIndex = nextFrame
  }
}

/**
 * Advance the front-end state machine by 1 tick (25fps = 40ms per tick).
 */
export function stepFlowTick(state: BnetFlowState): void {
  state.globalTick += 1
  state.stageTicks += 1

  for (const token of HERO_TOKENS) {
    stepHeroAvatarAnim(state.avatarAnims[token])
  }

  if (state.stage === 'bnet_connecting') {
    // BNCS connection status is driven by protocol handshake state (0x6fa6158c), not a fake timer.
    return
  }

  if (state.stage === 'char_create') {
    for (const id of CAMPFIRE_CLASS_ORDER) {
      const slot = state.campfireClasses[id]
      const count = Math.max(1, slot.frameCount[slot.phase] || 1)
      const rate = Math.max(1, slot.frameRate[slot.phase] || 1)
      slot.phaseTicks += 1
      if (slot.phaseTicks < rate) {
        continue
      }
      slot.phaseTicks = 0

      if (slot.phase === 'fw') {
        // Per D2Win.dll 0x6f8f09d7 (`lea eax, [ebp-0x2]; cmp ecx, eax; jl`),
        // one-shot animations terminate at `count - 2` (the last two frames are not displayed).
        const oneShotEnd = Math.max(1, count - 2)
        if (slot.frameIndex + 1 < oneShotEnd) {
          slot.frameIndex += 1
        } else {
          slot.phase = 'nu3'
          slot.frameIndex = 0
          slot.phaseTicks = 0
          slot.hitBox = getCampfireSlotHitBox(slot)
        }
      } else if (slot.phase === 'bw') {
        const oneShotEnd = Math.max(1, count - 2)
        if (slot.frameIndex + 1 < oneShotEnd) {
          slot.frameIndex += 1
        } else {
          slot.phase = state.hoveredClass === id ? 'nu2' : 'nu1'
          slot.frameIndex = 0
          slot.phaseTicks = 0
          slot.hitBox = getCampfireSlotHitBox(slot)
        }
      } else {
        // Looping phases (nu1, nu2, nu3) wrap at framesPerDir - 1 per D2Win_AnimImage_Draw (0x6f8f0ac6)
        const loopCount = Math.max(1, count - 1)
        slot.frameIndex = (slot.frameIndex + 1) % loopCount
      }
    }
    return
  }

  if (state.stage === 'door_loading') {
    // Step door animation from Frame 0 to Frame 9 (every 3 ticks = ~120ms per door frame, ~1.2s total)
    const targetFrame = Math.min(9, Math.floor(state.stageTicks / 3))
    state.doorFrame = targetFrame
    if (state.doorFrame >= 9 && state.stageTicks >= 30 && state.sceneReady) {
      state.stage = 'in_game'
      state.stageTicks = 0
      state.tickAccumulatorMs = 0
      state.lastFrameTimeMs = null
    }
  }
}

const TICK_EPSILON_MS = 1e-6

/**
 * Advance the front-end state machine by an elapsed frame delta `dtMs` using a fixed
 * 40ms (25fps) accumulator and a bounded catch-up clamp (`FRONTEND_MAX_FRAME_DELTA_MS = 200ms`).
 * Returns the number of 25fps ticks executed during this frame.
 */
export function stepFlowByDeltaMs(state: BnetFlowState, dtMs: number): number {
  if (!Number.isFinite(dtMs) || dtMs <= 0) {
    return 0
  }
  const clampedDelta = Math.min(dtMs, FRONTEND_MAX_FRAME_DELTA_MS)
  state.tickAccumulatorMs = Math.min(
    state.tickAccumulatorMs + clampedDelta,
    FRONTEND_MAX_FRAME_DELTA_MS,
  )
  let steps = 0
  while (
    state.tickAccumulatorMs + TICK_EPSILON_MS >= FRONTEND_TICK_MS &&
    steps < FRONTEND_MAX_CATCHUP_TICKS
  ) {
    state.tickAccumulatorMs = Math.max(0, state.tickAccumulatorMs - FRONTEND_TICK_MS)
    stepFlowTick(state)
    steps += 1
  }
  return steps
}

/**
 * Advance the front-end state machine from a `requestAnimationFrame` timestamp `nowMs` (in ms).
 * On the first frame (`state.lastFrameTimeMs === null`), anchors `lastFrameTimeMs = nowMs` without
 * advancing a tick; subsequent frames compute `nowMs - state.lastFrameTimeMs` and step fixed 40ms ticks.
 */
export function stepFlowFrame(state: BnetFlowState, nowMs: number): number {
  if (!Number.isFinite(nowMs)) {
    return 0
  }
  if (state.lastFrameTimeMs === null) {
    state.lastFrameTimeMs = nowMs
    return 0
  }
  const dtMs = nowMs - state.lastFrameTimeMs
  if (dtMs <= 0) {
    return 0
  }
  state.lastFrameTimeMs = nowMs
  return stepFlowByDeltaMs(state, dtMs)
}

export const CHAR_CLASS_ID_TO_CAMPFIRE: Readonly<Record<number, CampfireClassId>> = {
  0: 'am',
  1: 'so',
  2: 'ne',
  3: 'pa',
  4: 'ba',
  5: 'dz',
  6: 'as',
} as const

export const CAMPFIRE_TO_CHAR_CLASS_ID: Readonly<Record<CampfireClassId, 0 | 1 | 2 | 3 | 4 | 5 | 6>> = {
  am: 0,
  so: 1,
  ne: 2,
  pa: 3,
  ba: 4,
  dz: 5,
  as: 6,
} as const

const CLASS_CODE_TO_CAMPFIRE: Readonly<Record<string, CampfireClassId>> = {
  ama: 'am',
  sor: 'so',
  nec: 'ne',
  pal: 'pa',
  bar: 'ba',
  dru: 'dz',
  ass: 'as',
} as const

export function charSummaryToRosterCharacter(
  summary: {
    readonly name: string
    readonly charClass?: number | undefined
    readonly classId?: number | CampfireClassId | string | undefined
    readonly level: number
    readonly expansion?: boolean | undefined
    readonly hardcore?: boolean | undefined
    readonly ladder?: boolean | undefined
    readonly progression?: number | undefined
    readonly difficulty?: 0 | 1 | 2 | undefined
    readonly expiresAt?: number | undefined
    readonly expiresAtSec?: number | undefined
    readonly equipmentGraphics?: Uint8Array | undefined
    readonly rawStatString?: Uint8Array | undefined
    readonly statstring?: Uint8Array | undefined
  },
  options?: {
    readonly nowSec?: number | undefined
    readonly strings?: Record<string, unknown> | undefined
  },
): RosterCharacter {
  const rawClass = summary.charClass ?? summary.classId
  const classId: CampfireClassId | undefined =
    typeof rawClass === 'string'
      ? (CLASS_CODE_TO_CAMPFIRE[rawClass] ?? (rawClass as CampfireClassId))
      : typeof rawClass === 'number'
        ? CHAR_CLASS_ID_TO_CAMPFIRE[rawClass]
        : undefined
  if (!classId || !(classId in CAMPFIRE_CLASS_SPECS)) {
    throw new Error(`MCP character "${summary.name}" has unknown class id ${String(rawClass)}`)
  }
  if (!Number.isInteger(summary.level) || summary.level < 1 || summary.level > 99) {
    throw new Error(
      `MCP character "${summary.name}" has invalid or missing level ${String(summary.level)}`,
    )
  }

  const statBytes = summary.rawStatString ?? summary.statstring
  let progression: number | undefined = summary.progression
  if (
    progression === undefined &&
    statBytes instanceof Uint8Array &&
    statBytes.length > 27 &&
    statBytes[27] !== 0xff
  ) {
    progression = (statBytes[27]! >>> 1) & 0x1f
  }
  if (
    progression === undefined ||
    !Number.isInteger(progression) ||
    progression < 0 ||
    progression > 31
  ) {
    throw new Error(
      `MCP character "${summary.name}" is missing required numeric progression in statstring`,
    )
  }

  const isExpansion = summary.expansion ?? true
  const isHardcore = summary.hardcore ?? false
  const isLadder = summary.ladder ?? true
  const expiresAtSec = summary.expiresAtSec ?? summary.expiresAt
  const spec = CAMPFIRE_CLASS_SPECS[classId]
  const maxDifficulty = getCharacterMaxDifficulty({
    isExpansion,
    progression,
  })
  const expirationDays = computeCharacterExpirationDays(expiresAtSec, options?.nowSec)
  const avatarDesc = parseMcpAvatarStatstring(statBytes, spec.id, summary.equipmentGraphics)

  return {
    id: `${spec.heroToken}-${summary.name}`,
    name: summary.name,
    classId: spec.id,
    heroToken: spec.heroToken,
    className: resolveClassNameByTbl(spec.id, options?.strings),
    level: summary.level,
    isExpansion,
    isHardcore,
    isLadder,
    progression,
    maxDifficulty,
    ...(expiresAtSec !== undefined ? { expiresAt: expiresAtSec, expiresAtSec } : {}),
    ...(expirationDays !== undefined ? { expirationDays } : {}),
    ...(statBytes ? { statstring: statBytes } : {}),
    ...(summary.equipmentGraphics ? { equipmentGraphics: summary.equipmentGraphics } : {}),
    components: avatarDesc.components,
    componentColors: avatarDesc.componentColors,
    weaponClass: avatarDesc.weaponClass,
    avatarDesc,
    createdAt: Date.now(),
  }
}

export function applyOnlineCharactersToFlowState(
  state: BnetFlowState,
  characters: readonly {
    readonly name: string
    readonly charClass: number
    readonly level: number
    readonly expansion: boolean
    readonly hardcore: boolean
    readonly ladder: boolean
    readonly progression?: number | undefined
    readonly difficulty?: 0 | 1 | 2 | undefined
    readonly expiresAt?: number | undefined
    readonly equipmentGraphics?: Uint8Array | undefined
    readonly rawStatString?: Uint8Array | undefined
  }[],
  options?: { readonly stayOnCharSelect?: boolean | undefined },
): void {
  state.onlineConnected = true
  state.popupModal = null
  state.popup = null
  state.roster = characters.slice(0, 8).map((ch) => charSummaryToRosterCharacter(ch))
  state.selectedSlotIndex = 0
  if (state.roster.length === 0 && !options?.stayOnCharSelect) {
    enterCharCreate(state)
  } else {
    state.stage = 'char_select'
    state.stageTicks = 0
    state.activeInput = null
    resetHeroAvatarAnims(state)
  }
}

/**
 * 1.13c Join Game sub-panel periodic `MCP_GAMELIST (0x05)` auto-refresh interval:
 * `0x3a98` = 15,000 ms (`D2Multi.dll` `0x6f9ddf3b..0x6f9ddf7f`).
 */
export const JOIN_GAME_LIST_REFRESH_INTERVAL_MS = 15_000

const RECENT_REALM_GAMES_STORAGE_KEY = 'd2_recent_realm_games_v1'
const RECENT_REALM_GAMES_TTL_MS = 30 * 60 * 1000
const RECENT_REALM_GAMES_MAX = 12

interface RecentRealmGameRecord {
  readonly name: string
  readonly host: string
  readonly updatedAt: number
}

const memoryRecentRealmGames: RecentRealmGameRecord[] = []

function readRecentRealmGameRecords(nowMs = Date.now()): RecentRealmGameRecord[] {
  const byKey = new Map<string, RecentRealmGameRecord>()
  const addRecord = (rec: RecentRealmGameRecord) => {
    const trimmed = rec.name.trim()
    if (!trimmed || nowMs - rec.updatedAt > RECENT_REALM_GAMES_TTL_MS) return
    const hostKey = (rec.host || 'default').trim().toLowerCase()
    const key = `${hostKey}::${trimmed.toLowerCase()}`
    const prev = byKey.get(key)
    if (!prev || rec.updatedAt >= prev.updatedAt) {
      byKey.set(key, { name: trimmed, host: hostKey, updatedAt: rec.updatedAt })
    }
  }
  for (const rec of memoryRecentRealmGames) {
    addRecord(rec)
  }
  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      const raw = globalThis.localStorage.getItem(RECENT_REALM_GAMES_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (
              item &&
              typeof item === 'object' &&
              typeof (item as { name?: unknown }).name === 'string' &&
              typeof (item as { updatedAt?: unknown }).updatedAt === 'number'
            ) {
              addRecord({
                name: (item as { name: string }).name,
                host:
                  typeof (item as { host?: unknown }).host === 'string'
                    ? (item as { host: string }).host
                    : 'default',
                updatedAt: (item as { updatedAt: number }).updatedAt,
              })
            }
          }
        }
      }
    }
  } catch {
    // Ignore storage access errors in headless/restricted environments
  }
  return [...byKey.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

function writeRecentRealmGameRecords(records: readonly RecentRealmGameRecord[]): void {
  const capped = records.slice(0, RECENT_REALM_GAMES_MAX * 2)
  memoryRecentRealmGames.length = 0
  memoryRecentRealmGames.push(...capped)
  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      globalThis.localStorage.setItem(RECENT_REALM_GAMES_STORAGE_KEY, JSON.stringify(capped))
    }
  } catch {
    // Ignore storage access errors
  }
}

/**
 * Record a known/recent realm room name (created, joined, or discovered via `0x1F` / `MCP_GAMEINFO`)
 * so `refreshJoinGameList` can probe `MCP_GAMEINFO (0x06)` for rooms that are still open on `d2cs`
 * (`GAME_STAT_OPEN = 0x04`) even when PvPGN `d2cs_gamelist_cb` omits `0`-player or passworded rooms
 * from `MCP_GAMELIST (0x05)`.
 */
export function recordRecentRealmGameName(
  gameName: string,
  host: string | null | undefined = 'default',
  nowMs = Date.now(),
): void {
  const trimmed = gameName.trim()
  if (!trimmed) return
  const hostKey = (host || 'default').trim().toLowerCase()
  const records = readRecentRealmGameRecords(nowMs).filter(
    (r) => !(r.host === hostKey && r.name.toLowerCase() === trimmed.toLowerCase()),
  )
  records.unshift({ name: trimmed, host: hostKey, updatedAt: nowMs })
  writeRecentRealmGameRecords(records)
}

export function removeRecentRealmGameName(
  gameName: string,
  host: string | null | undefined = 'default',
  nowMs = Date.now(),
): void {
  const trimmed = gameName.trim()
  if (!trimmed) return
  const hostKey = (host || 'default').trim().toLowerCase()
  const records = readRecentRealmGameRecords(nowMs).filter(
    (r) =>
      !(
        (r.host === hostKey || r.host === 'default') &&
        r.name.toLowerCase() === trimmed.toLowerCase()
      ),
  )
  writeRecentRealmGameRecords(records)
}

export function getRecentRealmGameNames(
  host: string | null | undefined = 'default',
  nowMs = Date.now(),
): readonly string[] {
  const hostKey = (host || 'default').trim().toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of readRecentRealmGameRecords(nowMs)) {
    if (r.host !== hostKey && r.host !== 'default') continue
    const k = r.name.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(r.name)
    if (out.length >= RECENT_REALM_GAMES_MAX) break
  }
  return out
}

/**
 * Returns `true` when an `MCP_GAMEINFO (0x06)` response represents an open game on `d2cs`
 * (`GAME_STAT_OPEN = 0x04` bit set, or `status === 0` with valid `maxPlayers > 0`).
 */
export function isRealmGameInfoOpen(info: LobbyJoinGameInfo | null | undefined): boolean {
  if (!info) return false
  const statusU32 = (info.status ?? 0) >>> 0
  if (statusU32 === 0xffffffff || statusU32 === 0xfffffffe) return false
  if (statusU32 !== 0) {
    return (statusU32 & 0x04) !== 0
  }
  return info.maxPlayers > 0 || info.players.length > 0
}

/**
 * Check whether an `MCP_GAMEINFO (0x06)` game status bitmask is compatible with the active
 * character's Hardcore (`0x00000800`) and Expansion (`0x00100000`) flags per `d2cs_gamelist_cb`.
 */
export function isRealmGameStatusCompatibleWithCharacter(
  status: number,
  char: Pick<RosterCharacter, 'isHardcore' | 'isExpansion'> | null | undefined,
): boolean {
  const statusU32 = status >>> 0
  if (statusU32 === 0 || !char) return true
  const gameIsHardcore = (statusU32 & 0x00000800) !== 0
  if (gameIsHardcore !== Boolean(char.isHardcore)) return false
  const gameIsExpansion = (statusU32 & 0x00100000) !== 0
  if (gameIsExpansion !== Boolean(char.isExpansion)) return false
  return true
}

/**
 * Apply an incoming or finalized `MCP_GAMELIST (0x05)` game list to `BnetFlowState`
 * (`D2Multi.dll` `0x6f9e2120` & `0x6f9e1f80`):
 * - Deduplicates games by `index` (when `index > 0`) and case-insensitive `name`.
 * - During incremental streaming (`finalized === false`), preserves existing `realmGames`
 *   entries that have not yet been replaced so periodic background refreshes never flicker.
 * - When `finalized` is true (`0x6f9e1f80` on end-of-list sentinel):
 *   - If `selectedGameName` is still present in the refreshed list, preserves it.
 *   - If `selectedGameName` is no longer present in the refreshed list, clears `selectedGameName`
 *     and `selectedGameInfo` (and clears `gameName` if it still held the vanished `selectedGameName`).
 * - If no game is currently selected (`selectedGameName === ''`) and `gameName` input is empty,
 *   auto-selects the first available game and sets `gameName` to it.
 */
export function applyRealmGamesToFlowState(
  state: BnetFlowState,
  games: readonly {
    readonly index?: number | undefined
    readonly name: string
    readonly description: string
    readonly playerCount: number
    readonly status?: number | undefined
    readonly flags?: number | undefined
  }[],
  options?: {
    readonly finalized?: boolean | undefined
  },
): {
  readonly selectedGameName: string
  readonly shouldFetchGameInfo: boolean
} {
  const finalized = options?.finalized ?? true
  const deduped: {
    readonly index: number
    readonly name: string
    readonly description: string
    readonly playerCount: number
    readonly flags: number
  }[] = []

  const addOrUpdate = (
    g: {
      readonly index?: number | undefined
      readonly name: string
      readonly description: string
      readonly playerCount: number
      readonly status?: number | undefined
      readonly flags?: number | undefined
    },
    fallbackIdx: number,
  ): void => {
    if (!g.name || g.playerCount < 0) return
    const rawFlags = (g.status ?? g.flags ?? 0) >>> 0
    if (rawFlags !== 0 && (rawFlags & 0x04) === 0) return
    const idxVal = g.index ?? fallbackIdx
    const lower = g.name.toLowerCase()
    const existingIdx = deduped.findIndex(
      (item) => (idxVal !== 0 && item.index === idxVal) || item.name.toLowerCase() === lower,
    )
    const entry = {
      index: idxVal,
      name: g.name,
      description: g.description,
      playerCount: g.playerCount,
      flags: rawFlags,
    }
    if (existingIdx >= 0) {
      deduped[existingIdx] = entry
    } else {
      deduped.push(entry)
    }
  }

  for (let i = 0; i < games.length; i++) {
    addOrUpdate(games[i]!, i)
  }

  if (!finalized && state.realmGames.length > 0) {
    for (let i = 0; i < state.realmGames.length; i++) {
      const prev = state.realmGames[i]!
      const lower = prev.name.toLowerCase()
      const alreadyInNew = deduped.some(
        (item) => (prev.index !== 0 && item.index === prev.index) || item.name.toLowerCase() === lower,
      )
      if (!alreadyInNew) {
        deduped.push(prev)
      }
    }
  }

  state.realmGames = deduped
  const maxListScroll = Math.max(0, deduped.length - 11)
  state.joinGameListScroll = Math.max(0, Math.min(state.joinGameListScroll, maxListScroll))

  const prevSelected = state.selectedGameName
  let shouldFetchGameInfo = false

  if (prevSelected !== '') {
    const matched = deduped.find((g) => g.name.toLowerCase() === prevSelected.toLowerCase())
    if (matched) {
      state.selectedGameName = matched.name
      if (
        state.lobbySubPanel === 'join' &&
        state.gameName.trim().toLowerCase() === prevSelected.toLowerCase()
      ) {
        state.gameName = matched.name
      }
      if (finalized) {
        shouldFetchGameInfo = true
      }
    } else if (finalized) {
      const wasMatchingInput = state.gameName.trim().toLowerCase() === prevSelected.toLowerCase()
      state.selectedGameName = ''
      state.selectedGameInfo = null
      state.joinGameDetailsScroll = 0
      if (wasMatchingInput && state.lobbySubPanel === 'join') {
        state.gameName = ''
      }
    }
  }

  if (state.selectedGameName === '') {
    const typedName = state.gameName.trim()
    if (typedName !== '') {
      const matchedByInput = deduped.find(
        (g) => g.name.toLowerCase() === typedName.toLowerCase(),
      )
      if (matchedByInput) {
        state.selectedGameName = matchedByInput.name
        state.selectedGameInfo = null
        state.joinGameDetailsScroll = 0
        if (state.lobbySubPanel === 'join') {
          state.gameName = matchedByInput.name
        }
        shouldFetchGameInfo = true
      }
    } else if (deduped[0]) {
      const firstName = deduped[0].name
      state.selectedGameName = firstName
      state.selectedGameInfo = null
      state.joinGameDetailsScroll = 0
      if (state.lobbySubPanel === 'join') {
        state.gameName = firstName
      }
      shouldFetchGameInfo = true
    }
  }

  return {
    selectedGameName: state.selectedGameName,
    shouldFetchGameInfo,
  }
}

/**
 * Battle.net session loss on any pre-game or in-game screen: return to the Battle.net login screen
 * with the reason shown (1.13c D2Launch tears the realm/BNCS connections down and re-shows the
 * login panel with the connection-lost message). Everything that belonged to the lost session
 * (roster, game list, pending errors) is dropped; the typed account name/password stay so the user
 * can log in again explicitly — nothing reconnects on its own.
 */
export function returnToLoginAfterSessionLoss(state: BnetFlowState, reason: string): void {
  state.stage = 'bnet_login'
  state.stageTicks = 0
  state.tickAccumulatorMs = 0
  state.lastFrameTimeMs = null
  state.onlineConnected = false
  state.popupModal = null
  state.popup = null
  state.loginError = reason
  state.lastError = reason
  state.statusText = ''
  state.roster = []
  state.selectedSlotIndex = 0
  state.deleteConfirmOpen = false
  state.charCreateError = null
  state.createGameError = null
  state.realmGames = []
  state.selectedGameName = ''
  state.selectedGameInfo = null
  state.joinGameListScroll = 0
  state.joinGameDetailsScroll = 0
  state.doorFrame = 0
  state.sceneReady = false
  state.activeInput = 'accountPassword'
  resetHeroAvatarAnims(state)
}
