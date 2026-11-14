import type { WorldPanelsHud } from '../world-panels.ts'
import { D2FontRenderer, type D2ColorCode } from '../font.ts'
import { getLang } from '../../i18n/lang.ts'
import {
  assignKeyBinding,
  clearKeyBindingSlot,
  cloneKeyBindings,
  CONTROL_ACTION_DEFINITIONS,
  createDefaultKeyBindings,
  DEFAULT_AUDIO_MUTED,
  DEFAULT_CONTRAST_113C,
  DEFAULT_GAMMA_113C,
  DEFAULT_KEY_BINDINGS,
  DEFAULT_MASTER_VOLUME,
  DEFAULT_VIEWPORT_RESOLUTION,
  formatKeyBindingCode,
  normalizeKeyEventToBindingCode,
  VALID_VIEWPORT_RESOLUTIONS,
  type ControlActionId,
  type KeyBindingsConfig,
  type ViewportResolution,
} from '../../settings/client-settings.ts'
import {
  contrastFromSliderStep113c,
  gammaFromSliderStep113c,
  normalizeContrast113c,
  normalizeGamma113c,
  sliderStepFromContrast113c,
  sliderStepFromGamma113c,
} from '../../../common/gfx/gamma-contrast-113c.ts'
import {
  ESCAPE_MENU_PENTSPIN_FRAMES,
  ESCAPE_MENU_PENTSPIN_INTERVAL_MS,
  ESCAPE_MENU_PENTSPIN_MAX_WIDTH,
  type EscapeMenuPentPlacement,
} from './escape-monster-tooltip.ts'
import { drawStoneBoxFrame } from './npc-dialog-menu.ts'
import { STONE_BOX_BG_FILL } from './panel-layout-constants.ts'

export type EscapeMenuScreen = 'main' | 'options' | 'sound' | 'video' | 'automap' | 'controls'

export type OptionsMainRowId =
  | 'soundOptions'
  | 'videoOptions'
  | 'automapOptions'
  | 'configureControls'
  | 'previousMenu'
export type SoundOptionsRowId =
  | 'soundVolume'
  | 'musicVolume'
  | 'npcSpeech'
  | 'muteSound'
  | 'previousMenu'
export type VideoOptionsRowId =
  | 'displayMode'
  | 'resolution'
  | 'frameRate'
  | 'gamma'
  | 'contrast'
  | 'previousMenu'
export type AutomapOptionsRowId =
  | 'automapSize'
  | 'automapFade'
  | 'automapCenter'
  | 'automapParty'
  | 'automapNames'
  | 'previousMenu'
export type NpcSpeechMode = 'audioAndText' | 'audioOnly' | 'textOnly'
export type AutomapSizeMode = 'full' | 'mini'
export type AutomapFadeMode = 'no' | 'center' | 'yes'
export type ControlsButtonId = 'default' | 'accept' | 'cancel'

export const DEFAULT_MUSIC_VOLUME = 0.8
export const DEFAULT_NPC_SPEECH_MODE: NpcSpeechMode = 'audioAndText'
export const DEFAULT_AUTOMAP_SIZE_MODE: AutomapSizeMode = 'full'
export const DEFAULT_AUTOMAP_FADE_MODE: AutomapFadeMode = 'yes'

export interface EscapeMenuSettingsSnapshot {
  readonly masterVolume: number
  readonly musicVolume?: number
  readonly npcSpeech?: NpcSpeechMode
  readonly audioMuted: boolean
  readonly viewport: ViewportResolution
  readonly worldRenderFps: 30 | 60
  readonly gamma?: number | undefined
  readonly contrast?: number | undefined
  readonly keyBindings: KeyBindingsConfig
  readonly fullscreenActive: boolean
  readonly fullscreenSupported: boolean
  readonly automapSize?: AutomapSizeMode
  readonly automapFade?: AutomapFadeMode
  readonly automapCenter?: boolean
  readonly automapParty?: boolean
  readonly automapNames?: boolean
}

export interface EscapeMenuSettingsPatch {
  readonly masterVolume?: number
  readonly musicVolume?: number
  readonly npcSpeech?: NpcSpeechMode
  readonly audioMuted?: boolean
  readonly viewport?: ViewportResolution
  readonly worldRenderFps?: 30 | 60
  readonly gamma?: number
  readonly contrast?: number
  readonly keyBindings?: KeyBindingsConfig
  readonly automapSize?: AutomapSizeMode
  readonly automapFade?: AutomapFadeMode
  readonly automapCenter?: boolean
  readonly automapParty?: boolean
  readonly automapNames?: boolean
}

export interface OptionsSubmenuRowLayout {
  readonly index: number
  readonly id: string
  readonly label: string
  readonly valueText?: string | undefined
  readonly centered: boolean
  readonly rowY: number
  readonly rowHeight: number
  readonly hitMinX: number
  readonly hitMaxX: number
  readonly hitMinY: number
  readonly hitMaxY: number
  readonly sliderBounds?: {
    readonly left: number
    readonly right: number
    readonly top: number
    readonly bottom: number
    readonly width: number
    readonly stepIndex: number // 0..20
  } | undefined
}

export interface OptionsSubmenuLayout {
  readonly screen: 'options' | 'sound' | 'video' | 'automap'
  readonly titleText?: string | undefined
  readonly titleY?: number | undefined
  readonly centerX: number
  readonly topY: number
  readonly rowStepY: number
  readonly totalHeight: number
  readonly selectedIndex: number
  readonly rows: readonly OptionsSubmenuRowLayout[]
  readonly leftPent: EscapeMenuPentPlacement
  readonly rightPent: EscapeMenuPentPlacement
}

export const CONTROLS_VISIBLE_ROWS = 14
export const CONTROLS_ROW_HEIGHT = 22
export const CONTROLS_BOX_WIDTH = 554
export const CONTROLS_BOX_HEIGHT = 350
export const CONTROLS_BUTTON_WIDTH = 128
export const CONTROLS_BUTTON_HEIGHT = 35

export interface ControlsRowLayout {
  readonly visibleIndex: number
  readonly actionIndex: number
  readonly actionId: ControlActionId
  readonly label: string
  readonly primaryCode: string | null
  readonly secondaryCode: string | null
  readonly primaryText: string
  readonly secondaryText: string
  readonly rowTop: number
  readonly rowBottom: number
  readonly primaryMinX: number
  readonly primaryMaxX: number
  readonly secondaryMinX: number
  readonly secondaryMaxX: number
}

export interface ControlsButtonLayout {
  readonly id: ControlsButtonId
  readonly label: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface ControlsMenuLayout {
  readonly centerX: number
  readonly boxLeft: number
  readonly boxTop: number
  readonly boxWidth: number
  readonly boxHeight: number
  readonly headerY: number
  readonly listTop: number
  readonly listBottom: number
  readonly listLeft: number
  readonly listRight: number
  readonly primaryColLeft: number
  readonly primaryColRight: number
  readonly secondaryColLeft: number
  readonly secondaryColRight: number
  readonly scrollbar: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly upButtonBottom: number
    readonly downButtonTop: number
    readonly trackTop: number
    readonly trackBottom: number
    readonly thumbY: number
    readonly maxScroll: number
  }
  readonly rows: readonly ControlsRowLayout[]
  readonly buttons: readonly [ControlsButtonLayout, ControlsButtonLayout, ControlsButtonLayout]
}

function computePentPlacements(
  centerX: number,
  pentBaselineY: number,
  nowMs: number,
  halfSpan = 249,
): { leftPent: EscapeMenuPentPlacement; rightPent: EscapeMenuPentPlacement } {
  const spinFrame = Math.floor(Math.max(0, nowMs) / ESCAPE_MENU_PENTSPIN_INTERVAL_MS) & 7
  const leftFrameIndex = (8 - spinFrame) & 7
  const rightFrameIndex = spinFrame
  const leftFrame = ESCAPE_MENU_PENTSPIN_FRAMES[leftFrameIndex]!
  const rightFrame = ESCAPE_MENU_PENTSPIN_FRAMES[rightFrameIndex]!

  const leftAnchorX = centerX - ESCAPE_MENU_PENTSPIN_MAX_WIDTH - halfSpan
  const rightAnchorX = centerX + halfSpan

  return {
    leftPent: {
      frameIndex: leftFrameIndex,
      frame: leftFrame,
      anchorX: leftAnchorX,
      baselineY: pentBaselineY,
      x: leftAnchorX + leftFrame.offsetX,
      y: pentBaselineY - leftFrame.h + leftFrame.offsetY,
    },
    rightPent: {
      frameIndex: rightFrameIndex,
      frame: rightFrame,
      anchorX: rightAnchorX,
      baselineY: pentBaselineY,
      x: rightAnchorX + rightFrame.offsetX,
      y: pentBaselineY - rightFrame.h + rightFrame.offsetY,
    },
  }
}

export function resolveEscapeMenuSettings(hud: WorldPanelsHud): EscapeMenuSettingsSnapshot {
  const fallback = hud.escapeMenuFallbackSettings
  const external = hud.getEscapeMenuSettings?.() ?? {}
  return {
    masterVolume:
      typeof external.masterVolume === 'number' && Number.isFinite(external.masterVolume)
        ? Math.max(0, Math.min(1, external.masterVolume))
        : fallback.masterVolume,
    musicVolume:
      typeof external.musicVolume === 'number' && Number.isFinite(external.musicVolume)
        ? Math.max(0, Math.min(1, external.musicVolume))
        : (fallback.musicVolume ?? DEFAULT_MUSIC_VOLUME),
    npcSpeech: external.npcSpeech ?? fallback.npcSpeech ?? DEFAULT_NPC_SPEECH_MODE,
    audioMuted:
      typeof external.audioMuted === 'boolean' ? external.audioMuted : fallback.audioMuted,
    viewport: external.viewport ?? fallback.viewport,
    worldRenderFps: external.worldRenderFps === 30 ? 30 : external.worldRenderFps === 60 ? 60 : fallback.worldRenderFps,
    gamma: normalizeGamma113c(external.gamma ?? fallback.gamma ?? DEFAULT_GAMMA_113C),
    contrast: normalizeContrast113c(external.contrast ?? fallback.contrast ?? DEFAULT_CONTRAST_113C),
    keyBindings: external.keyBindings ?? fallback.keyBindings,
    fullscreenActive:
      typeof external.fullscreenActive === 'boolean'
        ? external.fullscreenActive
        : fallback.fullscreenActive,
    fullscreenSupported:
      typeof external.fullscreenSupported === 'boolean'
        ? external.fullscreenSupported
        : fallback.fullscreenSupported,
    automapSize: external.automapSize ?? fallback.automapSize ?? DEFAULT_AUTOMAP_SIZE_MODE,
    automapFade: external.automapFade ?? fallback.automapFade ?? DEFAULT_AUTOMAP_FADE_MODE,
    automapCenter:
      typeof external.automapCenter === 'boolean'
        ? external.automapCenter
        : (fallback.automapCenter ?? true),
    automapParty:
      typeof external.automapParty === 'boolean'
        ? external.automapParty
        : (fallback.automapParty ?? true),
    automapNames:
      typeof external.automapNames === 'boolean'
        ? external.automapNames
        : (fallback.automapNames ?? true),
  }
}

export function applyEscapeMenuSettingsPatch(
  hud: WorldPanelsHud,
  patch: EscapeMenuSettingsPatch,
): void {
  if (patch.masterVolume !== undefined) {
    hud.escapeMenuFallbackSettings.masterVolume = Math.max(0, Math.min(1, patch.masterVolume))
  }
  if (patch.musicVolume !== undefined) {
    hud.escapeMenuFallbackSettings.musicVolume = Math.max(0, Math.min(1, patch.musicVolume))
  }
  if (patch.npcSpeech !== undefined) {
    hud.escapeMenuFallbackSettings.npcSpeech = patch.npcSpeech
  }
  if (patch.audioMuted !== undefined) {
    hud.escapeMenuFallbackSettings.audioMuted = patch.audioMuted
  }
  if (patch.viewport !== undefined) {
    hud.escapeMenuFallbackSettings.viewport = patch.viewport
  }
  if (patch.worldRenderFps !== undefined) {
    hud.escapeMenuFallbackSettings.worldRenderFps = patch.worldRenderFps
  }
  if (patch.gamma !== undefined) {
    hud.escapeMenuFallbackSettings.gamma = normalizeGamma113c(patch.gamma)
  }
  if (patch.contrast !== undefined) {
    hud.escapeMenuFallbackSettings.contrast = normalizeContrast113c(patch.contrast)
  }
  if (patch.keyBindings !== undefined) {
    hud.escapeMenuFallbackSettings.keyBindings = cloneKeyBindings(patch.keyBindings)
  }
  if (patch.automapSize !== undefined) {
    hud.escapeMenuFallbackSettings.automapSize = patch.automapSize
    hud.onAutomapOptionChanged?.('automapSize')
  }
  if (patch.automapFade !== undefined) {
    hud.escapeMenuFallbackSettings.automapFade = patch.automapFade
    hud.onAutomapOptionChanged?.('automapFade')
  }
  if (patch.automapCenter !== undefined) {
    hud.escapeMenuFallbackSettings.automapCenter = patch.automapCenter
    hud.onAutomapOptionChanged?.('automapCenter')
  }
  if (patch.automapParty !== undefined) {
    hud.escapeMenuFallbackSettings.automapParty = patch.automapParty
    hud.onAutomapOptionChanged?.('automapParty')
  }
  if (patch.automapNames !== undefined) {
    hud.escapeMenuFallbackSettings.automapNames = patch.automapNames
    hud.onAutomapOptionChanged?.('automapNames')
  }
  hud.onUpdateEscapeMenuSettings?.(patch)
}

export function computeOptionsSubmenuLayout(
  screen: 'options' | 'sound' | 'video' | 'automap',
  hudWidth = 800,
  hudHeight = 600,
  selectedIndex = 0,
  nowMs = 0,
  settings?: EscapeMenuSettingsSnapshot,
  locale: 'en' | 'zh' = getLang(),
): OptionsSubmenuLayout {
  const isEn = locale === 'en'
  const centerX = Math.trunc(hudWidth / 2)
  const snap: EscapeMenuSettingsSnapshot = settings ?? {
    masterVolume: DEFAULT_MASTER_VOLUME,
    musicVolume: DEFAULT_MUSIC_VOLUME,
    npcSpeech: DEFAULT_NPC_SPEECH_MODE,
    audioMuted: DEFAULT_AUDIO_MUTED,
    viewport: DEFAULT_VIEWPORT_RESOLUTION,
    worldRenderFps: 60,
    keyBindings: DEFAULT_KEY_BINDINGS,
    fullscreenActive: false,
    fullscreenSupported: true,
    automapSize: DEFAULT_AUTOMAP_SIZE_MODE,
    automapFade: DEFAULT_AUTOMAP_FADE_MODE,
    automapCenter: true,
    automapParty: true,
    automapNames: true,
  }

  if (screen === 'options') {
    const rowDefs: readonly { id: OptionsMainRowId; label: string }[] = [
      { id: 'soundOptions', label: isEn ? 'SOUND OPTIONS' : '音效選項' },
      { id: 'videoOptions', label: isEn ? 'VIDEO OPTIONS' : '影像選項' },
      { id: 'automapOptions', label: isEn ? 'AUTOMAP OPTIONS' : '自動地圖選項' },
      { id: 'configureControls', label: isEn ? 'CONFIGURE CONTROLS' : '設定控制項' },
      { id: 'previousMenu', label: isEn ? 'PREVIOUS MENU' : '上一個選單' },
    ]
    const rowStepY = 50
    const totalHeight = rowDefs.length * rowStepY
    const topY = Math.trunc((hudHeight - 80) / 2) - Math.trunc(totalHeight / 2)
    const clampedSel = Math.max(0, Math.min(rowDefs.length - 1, selectedIndex))

    const rows: OptionsSubmenuRowLayout[] = rowDefs.map((def, idx) => {
      const rowY = topY + idx * rowStepY
      return {
        index: idx,
        id: def.id,
        label: def.label,
        centered: true,
        rowY,
        rowHeight: rowStepY,
        hitMinX: centerX - 260,
        hitMaxX: centerX + 260,
        hitMinY: rowY,
        hitMaxY: rowY + rowStepY,
      }
    })

    const pentBaselineY = topY + clampedSel * rowStepY + 51
    const { leftPent, rightPent } = computePentPlacements(centerX, pentBaselineY, nowMs, 249)

    return {
      screen,
      centerX,
      topY,
      rowStepY,
      totalHeight,
      selectedIndex: clampedSel,
      rows,
      leftPent,
      rightPent,
    }
  }

  if (screen === 'sound') {
    const rowStepY = 44
    const rowCount = 5
    const totalHeight = rowCount * rowStepY
    const topY = Math.trunc((hudHeight - 80) / 2) - Math.trunc(totalHeight / 2) + 12
    const clampedSel = Math.max(0, Math.min(rowCount - 1, selectedIndex))
    const stepIndex = Math.round(Math.max(0, Math.min(1, snap.masterVolume)) * 20)
    const pct = Math.round(Math.max(0, Math.min(1, snap.masterVolume)) * 100)
    const musicVol = snap.musicVolume ?? DEFAULT_MUSIC_VOLUME
    const musicStepIndex = Math.round(Math.max(0, Math.min(1, musicVol)) * 20)
    const musicPct = Math.round(Math.max(0, Math.min(1, musicVol)) * 100)
    const npcSpeech = snap.npcSpeech ?? DEFAULT_NPC_SPEECH_MODE
    const npcSpeechText =
      npcSpeech === 'audioOnly'
        ? isEn
          ? 'AUDIO ONLY'
          : '僅語音'
        : npcSpeech === 'textOnly'
          ? isEn
            ? 'TEXT ONLY'
            : '僅文字'
          : isEn
            ? 'AUDIO AND TEXT'
            : '語音與文字'
    const sliderLeft = centerX - 59
    const sliderWidth = 288
    const sliderRight = sliderLeft + sliderWidth

    const rows: OptionsSubmenuRowLayout[] = [
      {
        index: 0,
        id: 'soundVolume',
        label: isEn ? 'SOUND' : '音效音量',
        valueText: `${pct}%`,
        centered: false,
        rowY: topY,
        rowHeight: rowStepY,
        hitMinX: centerX - 260,
        hitMaxX: centerX + 260,
        hitMinY: topY,
        hitMaxY: topY + rowStepY,
        sliderBounds: {
          left: sliderLeft,
          right: sliderRight,
          top: topY + 6,
          bottom: topY + rowStepY - 6,
          width: sliderWidth,
          stepIndex,
        },
      },
      {
        index: 1,
        id: 'musicVolume',
        label: isEn ? 'MUSIC' : '音樂音量',
        valueText: `${musicPct}%`,
        centered: false,
        rowY: topY + rowStepY,
        rowHeight: rowStepY,
        hitMinX: centerX - 260,
        hitMaxX: centerX + 260,
        hitMinY: topY + rowStepY,
        hitMaxY: topY + 2 * rowStepY,
        sliderBounds: {
          left: sliderLeft,
          right: sliderRight,
          top: topY + rowStepY + 6,
          bottom: topY + 2 * rowStepY - 6,
          width: sliderWidth,
          stepIndex: musicStepIndex,
        },
      },
      {
        index: 2,
        id: 'npcSpeech',
        label: isEn ? 'NPC SPEECH' : 'NPC 語音',
        valueText: npcSpeechText,
        centered: false,
        rowY: topY + 2 * rowStepY,
        rowHeight: rowStepY,
        hitMinX: centerX - 260,
        hitMaxX: centerX + 260,
        hitMinY: topY + 2 * rowStepY,
        hitMaxY: topY + 3 * rowStepY,
      },
      {
        index: 3,
        id: 'muteSound',
        label: isEn ? 'MUTE SOUND' : '靜音',
        valueText: snap.audioMuted ? (isEn ? 'ON' : '開') : (isEn ? 'OFF' : '關'),
        centered: false,
        rowY: topY + 3 * rowStepY,
        rowHeight: rowStepY,
        hitMinX: centerX - 260,
        hitMaxX: centerX + 260,
        hitMinY: topY + 3 * rowStepY,
        hitMaxY: topY + 4 * rowStepY,
      },
      {
        index: 4,
        id: 'previousMenu',
        label: isEn ? 'PREVIOUS MENU' : '上一個選單',
        centered: true,
        rowY: topY + 4 * rowStepY,
        rowHeight: rowStepY,
        hitMinX: centerX - 260,
        hitMaxX: centerX + 260,
        hitMinY: topY + 4 * rowStepY,
        hitMaxY: topY + 5 * rowStepY,
      },
    ]

    const pentBaselineY = topY + clampedSel * rowStepY + 48
    const { leftPent, rightPent } = computePentPlacements(centerX, pentBaselineY, nowMs, 249)

    return {
      screen,
      titleText: isEn ? 'SOUND OPTIONS' : '音效選項',
      titleY: topY - 54,
      centerX,
      topY,
      rowStepY,
      totalHeight,
      selectedIndex: clampedSel,
      rows,
      leftPent,
      rightPent,
    }
  }

  if (screen === 'automap') {
    const rowStepY = 42
    const rowCount = 6
    const totalHeight = rowCount * rowStepY
    const topY = Math.trunc((hudHeight - 80) / 2) - Math.trunc(totalHeight / 2) + 12
    const clampedSel = Math.max(0, Math.min(rowCount - 1, selectedIndex))
    const amSize = snap.automapSize ?? DEFAULT_AUTOMAP_SIZE_MODE
    const amFade = snap.automapFade ?? DEFAULT_AUTOMAP_FADE_MODE
    const amCenter = snap.automapCenter ?? true
    const amParty = snap.automapParty ?? true
    const amNames = snap.automapNames ?? true
    const fadeText =
      amFade === 'no'
        ? isEn
          ? 'NO'
          : '否'
        : amFade === 'center'
          ? isEn
            ? 'CENTER'
            : '置中'
          : isEn
            ? 'YES'
            : '是'

    const rows: OptionsSubmenuRowLayout[] = [
      {
        index: 0,
        id: 'automapSize',
        label: isEn ? 'AUTOMAP SIZE' : '自動地圖大小',
        valueText: amSize === 'mini' ? (isEn ? 'MINI MAP' : '迷你地圖') : (isEn ? 'FULL SCREEN' : '全螢幕'),
        centered: false,
        rowY: topY,
        rowHeight: rowStepY,
        hitMinX: centerX - 260,
        hitMaxX: centerX + 260,
        hitMinY: topY,
        hitMaxY: topY + rowStepY,
      },
      {
        index: 1,
        id: 'automapFade',
        label: isEn ? 'FADE' : '淡化',
        valueText: fadeText,
        centered: false,
        rowY: topY + rowStepY,
        rowHeight: rowStepY,
        hitMinX: centerX - 260,
        hitMaxX: centerX + 260,
        hitMinY: topY + rowStepY,
        hitMaxY: topY + 2 * rowStepY,
      },
      {
        index: 2,
        id: 'automapCenter',
        label: isEn ? 'CENTER WHEN CLEARED' : '清除時置中',
        valueText: amCenter ? (isEn ? 'YES' : '是') : (isEn ? 'NO' : '否'),
        centered: false,
        rowY: topY + 2 * rowStepY,
        rowHeight: rowStepY,
        hitMinX: centerX - 260,
        hitMaxX: centerX + 260,
        hitMinY: topY + 2 * rowStepY,
        hitMaxY: topY + 3 * rowStepY,
      },
      {
        index: 3,
        id: 'automapParty',
        label: isEn ? 'SHOW PARTY' : '顯示隊伍',
        valueText: amParty ? (isEn ? 'YES' : '是') : (isEn ? 'NO' : '否'),
        centered: false,
        rowY: topY + 3 * rowStepY,
        rowHeight: rowStepY,
        hitMinX: centerX - 260,
        hitMaxX: centerX + 260,
        hitMinY: topY + 3 * rowStepY,
        hitMaxY: topY + 4 * rowStepY,
      },
      {
        index: 4,
        id: 'automapNames',
        label: isEn ? 'SHOW NAMES' : '顯示名稱',
        valueText: amNames ? (isEn ? 'YES' : '是') : (isEn ? 'NO' : '否'),
        centered: false,
        rowY: topY + 4 * rowStepY,
        rowHeight: rowStepY,
        hitMinX: centerX - 260,
        hitMaxX: centerX + 260,
        hitMinY: topY + 4 * rowStepY,
        hitMaxY: topY + 5 * rowStepY,
      },
      {
        index: 5,
        id: 'previousMenu',
        label: isEn ? 'PREVIOUS MENU' : '上一個選單',
        centered: true,
        rowY: topY + 5 * rowStepY,
        rowHeight: rowStepY,
        hitMinX: centerX - 260,
        hitMaxX: centerX + 260,
        hitMinY: topY + 5 * rowStepY,
        hitMaxY: topY + 6 * rowStepY,
      },
    ]

    const pentBaselineY = topY + clampedSel * rowStepY + 46
    const { leftPent, rightPent } = computePentPlacements(centerX, pentBaselineY, nowMs, 249)

    return {
      screen,
      titleText: isEn ? 'AUTOMAP OPTIONS' : '自動地圖選項',
      titleY: topY - 54,
      centerX,
      topY,
      rowStepY,
      totalHeight,
      selectedIndex: clampedSel,
      rows,
      leftPent,
      rightPent,
    }
  }

  // screen === 'video'
  const rowStepY = 44
  const rowCount = 6
  const totalHeight = rowCount * rowStepY
  const topY = Math.trunc((hudHeight - 80) / 2) - Math.trunc(totalHeight / 2) + 12
  const clampedSel = Math.max(0, Math.min(rowCount - 1, selectedIndex))
  const gammaVal = normalizeGamma113c(snap.gamma ?? DEFAULT_GAMMA_113C)
  const gammaStep = sliderStepFromGamma113c(gammaVal)
  const contrastVal = normalizeContrast113c(snap.contrast ?? DEFAULT_CONTRAST_113C)
  const contrastStep = sliderStepFromContrast113c(contrastVal)
  const videoSliderLeft = centerX - 59
  const videoSliderWidth = 288
  const videoSliderRight = videoSliderLeft + videoSliderWidth

  const rows: OptionsSubmenuRowLayout[] = [
    {
      index: 0,
      id: 'displayMode',
      label: isEn ? 'DISPLAY MODE' : '顯示模式',
      valueText: snap.fullscreenActive
        ? isEn
          ? 'FULLSCREEN'
          : '全螢幕'
        : isEn
          ? 'WINDOWED'
          : '視窗模式',
      centered: false,
      rowY: topY,
      rowHeight: rowStepY,
      hitMinX: centerX - 260,
      hitMaxX: centerX + 260,
      hitMinY: topY,
      hitMaxY: topY + rowStepY,
    },
    {
      index: 1,
      id: 'resolution',
      label: isEn ? 'RESOLUTION' : '解析度',
      valueText: snap.viewport,
      centered: false,
      rowY: topY + rowStepY,
      rowHeight: rowStepY,
      hitMinX: centerX - 260,
      hitMaxX: centerX + 260,
      hitMinY: topY + rowStepY,
      hitMaxY: topY + 2 * rowStepY,
    },
    {
      index: 2,
      id: 'frameRate',
      label: isEn ? 'FRAME RATE' : '幀率',
      valueText: `${snap.worldRenderFps} FPS`,
      centered: false,
      rowY: topY + 2 * rowStepY,
      rowHeight: rowStepY,
      hitMinX: centerX - 260,
      hitMaxX: centerX + 260,
      hitMinY: topY + 2 * rowStepY,
      hitMaxY: topY + 3 * rowStepY,
    },
    {
      index: 3,
      id: 'gamma',
      label: isEn ? 'GAMMA' : '亮度',
      valueText: String(gammaVal),
      centered: false,
      rowY: topY + 3 * rowStepY,
      rowHeight: rowStepY,
      hitMinX: centerX - 260,
      hitMaxX: centerX + 260,
      hitMinY: topY + 3 * rowStepY,
      hitMaxY: topY + 4 * rowStepY,
      sliderBounds: {
        left: videoSliderLeft,
        right: videoSliderRight,
        top: topY + 3 * rowStepY + 6,
        bottom: topY + 4 * rowStepY - 6,
        width: videoSliderWidth,
        stepIndex: gammaStep,
      },
    },
    {
      index: 4,
      id: 'contrast',
      label: isEn ? 'CONTRAST' : '對比度',
      valueText: `${contrastVal}%`,
      centered: false,
      rowY: topY + 4 * rowStepY,
      rowHeight: rowStepY,
      hitMinX: centerX - 260,
      hitMaxX: centerX + 260,
      hitMinY: topY + 4 * rowStepY,
      hitMaxY: topY + 5 * rowStepY,
      sliderBounds: {
        left: videoSliderLeft,
        right: videoSliderRight,
        top: topY + 4 * rowStepY + 6,
        bottom: topY + 5 * rowStepY - 6,
        width: videoSliderWidth,
        stepIndex: contrastStep,
      },
    },
    {
      index: 5,
      id: 'previousMenu',
      label: isEn ? 'PREVIOUS MENU' : '上一個選單',
      centered: true,
      rowY: topY + 5 * rowStepY,
      rowHeight: rowStepY,
      hitMinX: centerX - 260,
      hitMaxX: centerX + 260,
      hitMinY: topY + 5 * rowStepY,
      hitMaxY: topY + 6 * rowStepY,
    },
  ]

  const pentBaselineY = topY + clampedSel * rowStepY + 48
  const { leftPent, rightPent } = computePentPlacements(centerX, pentBaselineY, nowMs, 249)

  return {
    screen,
    titleText: isEn ? 'VIDEO OPTIONS' : '影像選項',
    titleY: topY - 54,
    centerX,
    topY,
    rowStepY,
    totalHeight,
    selectedIndex: clampedSel,
    rows,
    leftPent,
    rightPent,
  }
}

export function computeControlsMenuLayout(
  hudWidth = 800,
  hudHeight = 600,
  scrollOffset = 0,
  bindings: KeyBindingsConfig = DEFAULT_KEY_BINDINGS,
  locale: 'en' | 'zh' = getLang(),
): ControlsMenuLayout {
  const isEn = locale === 'en'
  const centerX = Math.trunc(hudWidth / 2)
  const boxWidth = CONTROLS_BOX_WIDTH
  const boxHeight = CONTROLS_BOX_HEIGHT
  const boxLeft = centerX - Math.trunc(boxWidth / 2)
  const boxTop = Math.max(20, Math.trunc((hudHeight - 80) / 2) - 195)

  const headerY = boxTop + 28
  const listTop = boxTop + 36
  const listBottom = listTop + CONTROLS_VISIBLE_ROWS * CONTROLS_ROW_HEIGHT
  const listLeft = boxLeft + 14
  const listRight = boxLeft + boxWidth - 26

  const primaryColLeft = boxLeft + 250
  const primaryColRight = boxLeft + 390
  const secondaryColLeft = boxLeft + 390
  const secondaryColRight = listRight

  const totalActions = CONTROL_ACTION_DEFINITIONS.length
  const maxScroll = Math.max(0, totalActions - CONTROLS_VISIBLE_ROWS)
  const clampedScroll = Math.max(0, Math.min(maxScroll, scrollOffset))

  const rows: ControlsRowLayout[] = []
  for (let r = 0; r < CONTROLS_VISIBLE_ROWS; r++) {
    const actionIndex = clampedScroll + r
    const def = CONTROL_ACTION_DEFINITIONS[actionIndex]
    if (!def) break
    const slot = bindings[def.id] ?? { primary: def.defaultPrimary, secondary: def.defaultSecondary }
    const rowTop = listTop + r * CONTROLS_ROW_HEIGHT
    rows.push({
      visibleIndex: r,
      actionIndex,
      actionId: def.id,
      label: isEn ? def.labelEn : def.labelZh,
      primaryCode: slot.primary,
      secondaryCode: slot.secondary,
      primaryText: formatKeyBindingCode(slot.primary, locale),
      secondaryText: formatKeyBindingCode(slot.secondary, locale),
      rowTop,
      rowBottom: rowTop + CONTROLS_ROW_HEIGHT,
      primaryMinX: primaryColLeft,
      primaryMaxX: primaryColRight,
      secondaryMinX: secondaryColLeft,
      secondaryMaxX: secondaryColRight,
    })
  }

  const scrollX = boxLeft + boxWidth - 22
  const scrollY = listTop
  const scrollH = CONTROLS_VISIBLE_ROWS * CONTROLS_ROW_HEIGHT
  const trackTop = scrollY + 13
  const trackBottom = scrollY + scrollH - 13
  const trackRange = Math.max(0, trackBottom - trackTop - 13)
  const ratio = maxScroll > 0 ? clampedScroll / maxScroll : 0
  const thumbY = Math.round(trackTop + ratio * trackRange)

  const btnY = boxTop + boxHeight + 14
  const buttons: readonly [ControlsButtonLayout, ControlsButtonLayout, ControlsButtonLayout] = [
    {
      id: 'default',
      label: isEn ? 'DEFAULT' : '預設值',
      x: boxLeft,
      y: btnY,
      width: CONTROLS_BUTTON_WIDTH,
      height: CONTROLS_BUTTON_HEIGHT,
    },
    {
      id: 'accept',
      label: isEn ? 'ACCEPT' : '接受',
      x: centerX - Math.trunc(CONTROLS_BUTTON_WIDTH / 2),
      y: btnY,
      width: CONTROLS_BUTTON_WIDTH,
      height: CONTROLS_BUTTON_HEIGHT,
    },
    {
      id: 'cancel',
      label: isEn ? 'CANCEL' : '取消',
      x: boxLeft + boxWidth - CONTROLS_BUTTON_WIDTH,
      y: btnY,
      width: CONTROLS_BUTTON_WIDTH,
      height: CONTROLS_BUTTON_HEIGHT,
    },
  ]

  return {
    centerX,
    boxLeft,
    boxTop,
    boxWidth,
    boxHeight,
    headerY,
    listTop,
    listBottom,
    listLeft,
    listRight,
    primaryColLeft,
    primaryColRight,
    secondaryColLeft,
    secondaryColRight,
    scrollbar: {
      x: scrollX,
      y: scrollY,
      width: 12,
      height: scrollH,
      upButtonBottom: scrollY + 13,
      downButtonTop: scrollY + scrollH - 13,
      trackTop,
      trackBottom,
      thumbY,
      maxScroll,
    },
    rows,
    buttons,
  }
}

export function drawOptionsSubmenu(
  hud: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  hudWidth: number,
  hudHeight: number,
  nowMs: number,
  assets: {
    pentSpinImg: HTMLImageElement | null
    font?: D2FontRenderer | undefined
  },
): void {
  const screen = hud.escapeMenuScreen
  if (
    screen !== 'options' &&
    screen !== 'sound' &&
    screen !== 'automap' &&
    screen !== 'video'
  ) {
    return
  }
  const locale = getLang()
  const settings = resolveEscapeMenuSettings(hud)
  const layout = computeOptionsSubmenuLayout(
    screen,
    hudWidth,
    hudHeight,
    hud.optionsSubmenuSelectedIndex,
    nowMs,
    settings,
    locale,
  )
  const font = assets.font ?? new D2FontRenderer()

  // Subtle dark plaque behind GMenu options for legibility over bright world areas
  const backdropTop = (layout.titleY ?? layout.topY) - 10
  const backdropBottom = layout.topY + layout.totalHeight + 14
  ctx.save()
  ctx.fillStyle = 'rgba(0, 0, 0, 0.52)'
  ctx.fillRect(layout.centerX - 285, backdropTop, 570, backdropBottom - backdropTop)
  ctx.strokeStyle = 'rgba(148, 128, 84, 0.45)'
  ctx.lineWidth = 1
  ctx.strokeRect(layout.centerX - 285 + 0.5, backdropTop + 0.5, 569, backdropBottom - backdropTop - 1)
  ctx.restore()

  if (layout.titleText && layout.titleY !== undefined) {
    font.drawText(ctx, layout.titleText, layout.centerX, layout.titleY + 31, {
      font: 'font30',
      color: 'white',
      align: 'center',
    })
  }

  for (const row of layout.rows) {
    const isSelected = row.index === layout.selectedIndex
    const rowColor: D2ColorCode = isSelected ? 'gold' : 'gold'
    const textY = row.rowY + Math.round(row.rowHeight / 2) + 9

    if (row.centered) {
      font.drawText(ctx, row.label, layout.centerX, textY, {
        font: 'font30',
        color: rowColor,
        align: 'center',
      })
      continue
    }

    // Left label
    font.drawText(ctx, row.label, layout.centerX - 230, textY, {
      font: 'font30',
      color: rowColor,
      align: 'left',
    })

    // Sound Volume OptBar slider (`[centerX - 59 .. centerX + 229]`)
    if (row.sliderBounds) {
      const sb = row.sliderBounds
      const ticks = 21
      const tickSpacing = Math.floor((sb.width - 12) / (ticks - 1))
      ctx.save()
      // Track baseline
      ctx.fillStyle = 'rgba(18, 16, 12, 0.88)'
      ctx.fillRect(sb.left, row.rowY + 14, sb.width, 16)
      ctx.strokeStyle = 'rgba(140, 120, 75, 0.7)'
      ctx.strokeRect(sb.left + 0.5, row.rowY + 14.5, sb.width - 1, 15)

      const sliderDisabled = screen === 'sound' && settings.audioMuted
      for (let t = 0; t < ticks; t++) {
        const tx = sb.left + 4 + t * tickSpacing
        const active = t <= sb.stepIndex && !sliderDisabled
        ctx.fillStyle = active ? '#c7b377' : '#4a4436'
        ctx.fillRect(tx, row.rowY + 17, 4, 10)
      }

      // Slider thumb
      const thumbX = sb.left + 2 + sb.stepIndex * tickSpacing
      ctx.fillStyle = isSelected ? '#e8d28c' : '#b8a264'
      ctx.fillRect(thumbX - 2, row.rowY + 11, 8, 22)
      ctx.strokeStyle = '#18140c'
      ctx.strokeRect(thumbX - 1.5, row.rowY + 11.5, 7, 21)
      ctx.restore()

      if (row.valueText) {
        font.drawText(ctx, row.valueText, sb.left - 12, row.rowY + 27, {
          font: 'font16',
          color: sliderDisabled ? 'gray' : 'white',
          align: 'right',
        })
      }
      continue
    }

    if (row.valueText) {
      font.drawText(ctx, row.valueText, layout.centerX + 230, textY, {
        font: 'font30',
        color: 'white',
        align: 'right',
      })
    }
  }

  if (assets.pentSpinImg) {
    const lp = layout.leftPent
    ctx.drawImage(
      assets.pentSpinImg,
      lp.frame.x,
      lp.frame.y,
      lp.frame.w,
      lp.frame.h,
      lp.x,
      lp.y,
      lp.frame.w,
      lp.frame.h,
    )
    const rp = layout.rightPent
    ctx.drawImage(
      assets.pentSpinImg,
      rp.frame.x,
      rp.frame.y,
      rp.frame.w,
      rp.frame.h,
      rp.x,
      rp.y,
      rp.frame.w,
      rp.frame.h,
    )
  }
}

export function drawControlsMenu(
  hud: WorldPanelsHud,
  ctx: CanvasRenderingContext2D,
  hudWidth: number,
  hudHeight: number,
  nowMs: number,
  assets: {
    boxPiecesImg?: HTMLImageElement | null | undefined
    textSlidImg?: HTMLImageElement | null | undefined
    focus16Img?: HTMLImageElement | null | undefined
    btnMediumImg?: HTMLImageElement | null | undefined
    font?: D2FontRenderer | undefined
  },
): void {
  const locale = getLang()
  const isEn = locale === 'en'
  const font = assets.font ?? new D2FontRenderer()
  const bindings = hud.controlsDraftBindings ?? resolveEscapeMenuSettings(hud).keyBindings
  const layout = computeControlsMenuLayout(
    hudWidth,
    hudHeight,
    hud.controlsScrollOffset,
    bindings,
    locale,
  )

  // 1. Stone bordered table box
  if (assets.boxPiecesImg && assets.boxPiecesImg.width > 0) {
    drawStoneBoxFrame(
      ctx,
      layout.boxLeft,
      layout.boxTop,
      layout.boxWidth,
      layout.boxHeight,
      assets.boxPiecesImg,
    )
  } else {
    ctx.save()
    ctx.fillStyle = STONE_BOX_BG_FILL
    ctx.fillRect(layout.boxLeft, layout.boxTop, layout.boxWidth, layout.boxHeight)
    ctx.strokeStyle = '#948054'
    ctx.lineWidth = 2
    ctx.strokeRect(layout.boxLeft + 1, layout.boxTop + 1, layout.boxWidth - 2, layout.boxHeight - 2)
    ctx.restore()
  }

  // 2. Column headers & dividers
  const primaryCenterX = Math.trunc((layout.primaryColLeft + layout.primaryColRight) / 2)
  const secondaryCenterX = Math.trunc((layout.secondaryColLeft + layout.secondaryColRight) / 2)

  font.drawText(ctx, isEn ? 'CONFIGURE CONTROLS' : '設定控制項', layout.boxLeft + 18, layout.headerY, {
    font: 'font16',
    color: 'gold',
    align: 'left',
  })
  font.drawText(ctx, isEn ? 'Primary' : '主要按鍵', primaryCenterX, layout.headerY, {
    font: 'font16',
    color: 'gold',
    align: 'center',
  })
  font.drawText(ctx, isEn ? 'Secondary' : '次要按鍵', secondaryCenterX, layout.headerY, {
    font: 'font16',
    color: 'gold',
    align: 'center',
  })

  ctx.save()
  ctx.strokeStyle = 'rgba(148, 128, 84, 0.65)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(layout.listLeft, layout.listTop - 2.5)
  ctx.lineTo(layout.listRight, layout.listTop - 2.5)
  ctx.moveTo(layout.primaryColLeft + 0.5, layout.boxTop + 12)
  ctx.lineTo(layout.primaryColLeft + 0.5, layout.listBottom)
  ctx.moveTo(layout.secondaryColLeft + 0.5, layout.boxTop + 12)
  ctx.lineTo(layout.secondaryColLeft + 0.5, layout.listBottom)
  ctx.stroke()
  ctx.restore()

  // 3. Visible rows
  for (const row of layout.rows) {
    const isRowSelected = row.actionIndex === hud.controlsSelectedRow
    const textY = row.rowTop + 16

    if (isRowSelected) {
      ctx.save()
      ctx.fillStyle = 'rgba(199, 179, 119, 0.16)'
      ctx.fillRect(layout.listLeft, row.rowTop, layout.listRight - layout.listLeft, CONTROLS_ROW_HEIGHT)
      const colLeft =
        hud.controlsSelectedCol === 'primary' ? layout.primaryColLeft : layout.secondaryColLeft
      const colRight =
        hud.controlsSelectedCol === 'primary' ? layout.primaryColRight : layout.secondaryColRight
      ctx.strokeStyle = hud.controlsAwaitingBinding ? '#f5d76e' : 'rgba(199, 179, 119, 0.75)'
      ctx.lineWidth = 1
      ctx.strokeRect(colLeft + 1.5, row.rowTop + 1.5, colRight - colLeft - 3, CONTROLS_ROW_HEIGHT - 3)
      ctx.restore()
    }

    font.drawText(ctx, row.label, layout.listLeft + 6, textY, {
      font: 'font16',
      color: isRowSelected ? 'gold' : 'white',
      align: 'left',
    })

    const awaitingPrimary =
      isRowSelected && hud.controlsAwaitingBinding && hud.controlsSelectedCol === 'primary'
    const awaitingSecondary =
      isRowSelected && hud.controlsAwaitingBinding && hud.controlsSelectedCol === 'secondary'

    if (awaitingPrimary) {
      drawAwaitingFocusSpinner(ctx, font, assets.focus16Img ?? null, primaryCenterX, row.rowTop, nowMs, isEn)
    } else {
      font.drawText(ctx, row.primaryText, primaryCenterX, textY, {
        font: 'font16',
        color: row.primaryCode ? (isRowSelected && hud.controlsSelectedCol === 'primary' ? 'gold' : 'white') : 'gray',
        align: 'center',
      })
    }

    if (awaitingSecondary) {
      drawAwaitingFocusSpinner(ctx, font, assets.focus16Img ?? null, secondaryCenterX, row.rowTop, nowMs, isEn)
    } else {
      font.drawText(ctx, row.secondaryText, secondaryCenterX, textY, {
        font: 'font16',
        color: row.secondaryCode
          ? isRowSelected && hud.controlsSelectedCol === 'secondary'
            ? 'gold'
            : 'white'
          : 'gray',
        align: 'center',
      })
    }
  }

  // 4. Right scrollbar (`textSlid.png`)
  drawControlsScrollbar(ctx, layout.scrollbar, assets.textSlidImg ?? null)

  // 5. Bottom 3 stone buttons (`DEFAULT`, `ACCEPT`, `CANCEL`)
  for (const btn of layout.buttons) {
    const pressed = hud.controlsPressedButtonId === btn.id
    if (assets.btnMediumImg && assets.btnMediumImg.width >= 256) {
      const sx = pressed ? 128 : 0
      ctx.drawImage(
        assets.btnMediumImg,
        sx,
        0,
        128,
        35,
        btn.x,
        btn.y,
        btn.width,
        btn.height,
      )
    } else {
      ctx.save()
      ctx.fillStyle = pressed ? '#2b251c' : '#3d3528'
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height)
      ctx.strokeStyle = '#948054'
      ctx.lineWidth = 2
      ctx.strokeRect(btn.x + 1, btn.y + 1, btn.width - 2, btn.height - 2)
      ctx.restore()
    }
    const labelOffsetX = pressed ? -2 : 0
    const labelOffsetY = pressed ? 2 : 0
    font.drawText(
      ctx,
      btn.label,
      btn.x + Math.trunc(btn.width / 2) + labelOffsetX,
      btn.y + 23 + labelOffsetY,
      {
        font: 'font16',
        color: 'gold',
        align: 'center',
      },
    )
  }
}

function drawAwaitingFocusSpinner(
  ctx: CanvasRenderingContext2D,
  font: D2FontRenderer,
  focus16Img: HTMLImageElement | null,
  centerX: number,
  rowTop: number,
  nowMs: number,
  isEn: boolean,
): void {
  if (focus16Img && focus16Img.width >= 160) {
    const frameIdx = Math.floor(Math.max(0, nowMs) / 60) & 7
    ctx.drawImage(focus16Img, frameIdx * 20, 0, 20, 20, centerX - 10, rowTop + 1, 20, 20)
  } else {
    font.drawText(ctx, isEn ? '<Press Key>' : '<請按鍵>', centerX, rowTop + 16, {
      font: 'font16',
      color: 'gold',
      align: 'center',
    })
  }
}

function drawControlsScrollbar(
  ctx: CanvasRenderingContext2D,
  sb: ControlsMenuLayout['scrollbar'],
  textSlidImg: HTMLImageElement | null,
): void {
  const frameW = 12
  const frameH = 13
  if (textSlidImg && textSlidImg.width >= frameW * 17) {
    // Up arrow (frame 9)
    ctx.drawImage(textSlidImg, 9 * frameW, 0, frameW, frameH, sb.x, sb.y, frameW, frameH)
    // Track tiles (frame 13)
    for (let ty = sb.trackTop; ty < sb.trackBottom; ty += frameH) {
      const h = Math.min(frameH, sb.trackBottom - ty)
      ctx.drawImage(textSlidImg, 13 * frameW, 0, frameW, h, sb.x, ty, frameW, h)
    }
    // Down arrow (frame 8)
    ctx.drawImage(textSlidImg, 8 * frameW, 0, frameW, frameH, sb.x, sb.downButtonTop, frameW, frameH)
    // Thumb (frame 16 active / 14 disabled)
    const thumbFrame = sb.maxScroll > 0 ? 16 : 14
    ctx.drawImage(textSlidImg, thumbFrame * frameW, 0, frameW, frameH, sb.x, sb.thumbY, frameW, frameH)
  } else {
    ctx.save()
    ctx.fillStyle = '#1b1812'
    ctx.fillRect(sb.x, sb.y, sb.width, sb.height)
    ctx.strokeStyle = '#7c6b46'
    ctx.strokeRect(sb.x + 0.5, sb.y + 0.5, sb.width - 1, sb.height - 1)
    ctx.fillStyle = '#c7b377'
    ctx.fillRect(sb.x + 1, sb.thumbY, sb.width - 2, frameH)
    ctx.restore()
  }
}

export function cycleViewportResolution(
  current: ViewportResolution,
  direction: 1 | -1,
): ViewportResolution {
  const idx = VALID_VIEWPORT_RESOLUTIONS.indexOf(current)
  const baseIdx = idx >= 0 ? idx : 0
  const nextIdx =
    (baseIdx + direction + VALID_VIEWPORT_RESOLUTIONS.length) %
    VALID_VIEWPORT_RESOLUTIONS.length
  return VALID_VIEWPORT_RESOLUTIONS[nextIdx]!
}

const VALID_NPC_SPEECH_MODES: readonly NpcSpeechMode[] = [
  'audioAndText',
  'audioOnly',
  'textOnly',
]

export function cycleNpcSpeechMode(
  current: NpcSpeechMode,
  direction: 1 | -1,
): NpcSpeechMode {
  const idx = VALID_NPC_SPEECH_MODES.indexOf(current)
  const baseIdx = idx >= 0 ? idx : 0
  const nextIdx =
    (baseIdx + direction + VALID_NPC_SPEECH_MODES.length) %
    VALID_NPC_SPEECH_MODES.length
  return VALID_NPC_SPEECH_MODES[nextIdx]!
}

const VALID_AUTOMAP_FADE_MODES: readonly AutomapFadeMode[] = ['no', 'center', 'yes']

export function cycleAutomapFadeMode(
  current: AutomapFadeMode,
  direction: 1 | -1,
): AutomapFadeMode {
  const idx = VALID_AUTOMAP_FADE_MODES.indexOf(current)
  const baseIdx = idx >= 0 ? idx : 0
  const nextIdx =
    (baseIdx + direction + VALID_AUTOMAP_FADE_MODES.length) %
    VALID_AUTOMAP_FADE_MODES.length
  return VALID_AUTOMAP_FADE_MODES[nextIdx]!
}

export function enterEscapeMenuScreen(
  hud: WorldPanelsHud,
  screen: EscapeMenuScreen,
  defaultSelectedIndex = 0,
): void {
  hud.escapeMenuScreen = screen
  hud.optionsSubmenuSelectedIndex = defaultSelectedIndex
  hud.soundDraggingSlider = false
  hud.controlsAwaitingBinding = false
  hud.controlsPressedButtonId = null
  if (screen === 'controls') {
    const snap = resolveEscapeMenuSettings(hud)
    hud.controlsDraftBindings = cloneKeyBindings(snap.keyBindings)
    hud.controlsScrollOffset = 0
    hud.controlsSelectedRow = 0
    hud.controlsSelectedCol = 'primary'
  }
}

/**
 * Steps back one level in the Escape / Options menu hierarchy.
 * Returns `true` if still inside an Escape menu screen, or `false` if the Escape menu was closed.
 */
export function navigateEscapeMenuBack(hud: WorldPanelsHud): boolean {
  if (!hud.escapeMenuOpen) return false
  if (hud.escapeMenuScreen === 'controls') {
    if (hud.controlsAwaitingBinding) {
      hud.controlsAwaitingBinding = false
      return true
    }
    hud.controlsDraftBindings = null
    enterEscapeMenuScreen(hud, 'options', 3)
    return true
  }
  if (hud.escapeMenuScreen === 'sound') {
    enterEscapeMenuScreen(hud, 'options', 0)
    return true
  }
  if (hud.escapeMenuScreen === 'video') {
    enterEscapeMenuScreen(hud, 'options', 1)
    return true
  }
  if (hud.escapeMenuScreen === 'automap') {
    enterEscapeMenuScreen(hud, 'options', 2)
    return true
  }
  if (hud.escapeMenuScreen === 'options') {
    enterEscapeMenuScreen(hud, 'main', 0)
    hud.escapeMenuSelectedIndex = 0
    return true
  }
  hud.escapeMenuOpen = false
  hud.escapeMenuScreen = 'main'
  return false
}

export function getEscapeSubmenuRowCount(screen: EscapeMenuScreen): number {
  switch (screen) {
    case 'main':
      return 3
    case 'options':
      return 5
    case 'sound':
      return 5
    case 'automap':
      return 6
    case 'video':
      return 6
    case 'controls':
      return CONTROL_ACTION_DEFINITIONS.length
  }
}

export function moveEscapeSubmenuSelection(hud: WorldPanelsHud, delta: -1 | 1): number {
  const screen = hud.escapeMenuScreen
  if (screen === 'controls') {
    if (hud.controlsAwaitingBinding) return hud.controlsSelectedRow
    const total = CONTROL_ACTION_DEFINITIONS.length
    const nextRow = Math.max(0, Math.min(total - 1, hud.controlsSelectedRow + delta))
    hud.controlsSelectedRow = nextRow
    if (nextRow < hud.controlsScrollOffset) {
      hud.controlsScrollOffset = nextRow
    } else if (nextRow >= hud.controlsScrollOffset + CONTROLS_VISIBLE_ROWS) {
      hud.controlsScrollOffset = nextRow - CONTROLS_VISIBLE_ROWS + 1
    }
    return nextRow
  }
  const count = getEscapeSubmenuRowCount(screen)
  const next = (hud.optionsSubmenuSelectedIndex + delta + count) % count
  hud.optionsSubmenuSelectedIndex = next
  return next
}

export function adjustEscapeSubmenuHorizontal(hud: WorldPanelsHud, direction: -1 | 1): boolean {
  const screen = hud.escapeMenuScreen
  const snap = resolveEscapeMenuSettings(hud)

  if (screen === 'sound') {
    const idx = hud.optionsSubmenuSelectedIndex
    if (idx === 0) {
      // 21-step (5% per step) sound volume slider
      const currentStep = Math.round(snap.masterVolume * 20)
      const nextStep = Math.max(0, Math.min(20, currentStep + direction))
      const nextVolume = Number((nextStep / 20).toFixed(2))
      const patch: EscapeMenuSettingsPatch =
        nextVolume > 0 && snap.audioMuted
          ? { masterVolume: nextVolume, audioMuted: false }
          : { masterVolume: nextVolume }
      applyEscapeMenuSettingsPatch(hud, patch)
      return true
    }
    if (idx === 1) {
      // 21-step (5% per step) music volume slider
      const currentStep = Math.round((snap.musicVolume ?? snap.masterVolume) * 20)
      const nextStep = Math.max(0, Math.min(20, currentStep + direction))
      const nextVolume = Number((nextStep / 20).toFixed(2))
      applyEscapeMenuSettingsPatch(hud, { musicVolume: nextVolume })
      return true
    }
    if (idx === 2) {
      applyEscapeMenuSettingsPatch(hud, {
        npcSpeech: cycleNpcSpeechMode(snap.npcSpeech ?? 'audioAndText', direction),
      })
      return true
    }
    if (idx === 3) {
      applyEscapeMenuSettingsPatch(hud, { audioMuted: !snap.audioMuted })
      return true
    }
    return false
  }

  if (screen === 'automap') {
    const idx = hud.optionsSubmenuSelectedIndex
    if (idx === 0) {
      applyEscapeMenuSettingsPatch(hud, {
        automapSize: (snap.automapSize ?? 'full') === 'mini' ? 'full' : 'mini',
      })
      hud.onAutomapOptionChanged?.('automapSize')
      return true
    }
    if (idx === 1) {
      applyEscapeMenuSettingsPatch(hud, {
        automapFade: cycleAutomapFadeMode(snap.automapFade ?? 'no', direction),
      })
      hud.onAutomapOptionChanged?.('automapFade')
      return true
    }
    if (idx === 2) {
      applyEscapeMenuSettingsPatch(hud, { automapCenter: !(snap.automapCenter ?? true) })
      hud.onAutomapOptionChanged?.('automapCenter')
      return true
    }
    if (idx === 3) {
      applyEscapeMenuSettingsPatch(hud, { automapParty: !(snap.automapParty ?? true) })
      hud.onAutomapOptionChanged?.('automapParty')
      return true
    }
    if (idx === 4) {
      applyEscapeMenuSettingsPatch(hud, { automapNames: !(snap.automapNames ?? true) })
      hud.onAutomapOptionChanged?.('automapNames')
      return true
    }
    return false
  }

  if (screen === 'video') {
    const idx = hud.optionsSubmenuSelectedIndex
    if (idx === 0) {
      hud.escapeMenuFallbackSettings.fullscreenActive = !snap.fullscreenActive
      hud.onToggleEscapeMenuFullscreen?.()
      return true
    }
    if (idx === 1) {
      const nextRes = cycleViewportResolution(snap.viewport, direction)
      applyEscapeMenuSettingsPatch(hud, { viewport: nextRes })
      return true
    }
    if (idx === 2) {
      const nextFps: 30 | 60 = snap.worldRenderFps === 60 ? 30 : 60
      applyEscapeMenuSettingsPatch(hud, { worldRenderFps: nextFps })
      return true
    }
    if (idx === 3) {
      // D2Client.dll 0x6FB14150: 21-step Gamma slider (55..255, step 10, default 155 -> step 10)
      const currentStep = sliderStepFromGamma113c(snap.gamma ?? DEFAULT_GAMMA_113C)
      const nextStep = Math.max(0, Math.min(20, currentStep + direction))
      applyEscapeMenuSettingsPatch(hud, { gamma: gammaFromSliderStep113c(nextStep) })
      return true
    }
    if (idx === 4) {
      // D2Client.dll 0x6FB14110: 21-step Contrast slider (0..100, step 5, default 100 -> step 20)
      const currentStep = sliderStepFromContrast113c(snap.contrast ?? DEFAULT_CONTRAST_113C)
      const nextStep = Math.max(0, Math.min(20, currentStep + direction))
      applyEscapeMenuSettingsPatch(hud, { contrast: contrastFromSliderStep113c(nextStep) })
      return true
    }
    return false
  }

  if (screen === 'controls') {
    if (hud.controlsAwaitingBinding) return true
    hud.controlsSelectedCol = hud.controlsSelectedCol === 'primary' ? 'secondary' : 'primary'
    return true
  }

  return false
}

export function activateEscapeSubmenuRow(
  hud: WorldPanelsHud,
  rowIndex = hud.optionsSubmenuSelectedIndex,
): string | null {
  const screen = hud.escapeMenuScreen
  const snap = resolveEscapeMenuSettings(hud)

  if (screen === 'options') {
    hud.optionsSubmenuSelectedIndex = rowIndex
    if (rowIndex === 0) {
      enterEscapeMenuScreen(hud, 'sound', 0)
      return 'soundOptions'
    }
    if (rowIndex === 1) {
      enterEscapeMenuScreen(hud, 'video', 0)
      return 'videoOptions'
    }
    if (rowIndex === 2) {
      enterEscapeMenuScreen(hud, 'automap', 0)
      return 'automapOptions'
    }
    if (rowIndex === 3) {
      enterEscapeMenuScreen(hud, 'controls', 0)
      return 'configureControls'
    }
    if (rowIndex === 4) {
      enterEscapeMenuScreen(hud, 'main', 0)
      hud.escapeMenuSelectedIndex = 0
      return 'previousMenu'
    }
    return null
  }

  if (screen === 'sound') {
    hud.optionsSubmenuSelectedIndex = rowIndex
    if (rowIndex === 0) {
      return 'soundVolume'
    }
    if (rowIndex === 1) {
      return 'musicVolume'
    }
    if (rowIndex === 2) {
      applyEscapeMenuSettingsPatch(hud, {
        npcSpeech: cycleNpcSpeechMode(snap.npcSpeech ?? 'audioAndText', 1),
      })
      return 'npcSpeech'
    }
    if (rowIndex === 3) {
      applyEscapeMenuSettingsPatch(hud, { audioMuted: !snap.audioMuted })
      return 'muteSound'
    }
    if (rowIndex === 4) {
      enterEscapeMenuScreen(hud, 'options', 0)
      return 'previousMenu'
    }
    return null
  }

  if (screen === 'automap') {
    hud.optionsSubmenuSelectedIndex = rowIndex
    if (rowIndex === 0) {
      applyEscapeMenuSettingsPatch(hud, {
        automapSize: (snap.automapSize ?? 'full') === 'mini' ? 'full' : 'mini',
      })
      hud.onAutomapOptionChanged?.('automapSize')
      return 'automapSize'
    }
    if (rowIndex === 1) {
      applyEscapeMenuSettingsPatch(hud, {
        automapFade: cycleAutomapFadeMode(snap.automapFade ?? 'no', 1),
      })
      hud.onAutomapOptionChanged?.('automapFade')
      return 'automapFade'
    }
    if (rowIndex === 2) {
      applyEscapeMenuSettingsPatch(hud, { automapCenter: !(snap.automapCenter ?? true) })
      hud.onAutomapOptionChanged?.('automapCenter')
      return 'automapCenter'
    }
    if (rowIndex === 3) {
      applyEscapeMenuSettingsPatch(hud, { automapParty: !(snap.automapParty ?? true) })
      hud.onAutomapOptionChanged?.('automapParty')
      return 'automapParty'
    }
    if (rowIndex === 4) {
      applyEscapeMenuSettingsPatch(hud, { automapNames: !(snap.automapNames ?? true) })
      hud.onAutomapOptionChanged?.('automapNames')
      return 'automapNames'
    }
    if (rowIndex === 5) {
      enterEscapeMenuScreen(hud, 'options', 2)
      return 'previousMenu'
    }
    return null
  }

  if (screen === 'video') {
    hud.optionsSubmenuSelectedIndex = rowIndex
    if (rowIndex === 0) {
      hud.escapeMenuFallbackSettings.fullscreenActive = !snap.fullscreenActive
      hud.onToggleEscapeMenuFullscreen?.()
      return 'displayMode'
    }
    if (rowIndex === 1) {
      const nextRes = cycleViewportResolution(snap.viewport, 1)
      applyEscapeMenuSettingsPatch(hud, { viewport: nextRes })
      return 'resolution'
    }
    if (rowIndex === 2) {
      const nextFps: 30 | 60 = snap.worldRenderFps === 60 ? 30 : 60
      applyEscapeMenuSettingsPatch(hud, { worldRenderFps: nextFps })
      return 'frameRate'
    }
    if (rowIndex === 3) {
      return 'gamma'
    }
    if (rowIndex === 4) {
      return 'contrast'
    }
    if (rowIndex === 5) {
      enterEscapeMenuScreen(hud, 'options', 1)
      return 'previousMenu'
    }
    return null
  }

  if (screen === 'controls') {
    hud.controlsAwaitingBinding = true
    return 'awaitingBinding'
  }

  return null
}

function updateSoundVolumeFromSliderX(
  hud: WorldPanelsHud,
  logicalX: number,
  sliderLeft: number,
  sliderWidth: number,
  rowId: 'soundVolume' | 'musicVolume' | 'gamma' | 'contrast' = 'soundVolume',
): void {
  const ratio = Math.max(0, Math.min(1, (logicalX - sliderLeft) / Math.max(1, sliderWidth)))
  const step = Math.round(ratio * 20)
  if (rowId === 'gamma') {
    applyEscapeMenuSettingsPatch(hud, { gamma: gammaFromSliderStep113c(step) })
    return
  }
  if (rowId === 'contrast') {
    applyEscapeMenuSettingsPatch(hud, { contrast: contrastFromSliderStep113c(step) })
    return
  }
  const nextVolume = Number((step / 20).toFixed(2))
  if (rowId === 'musicVolume') {
    applyEscapeMenuSettingsPatch(hud, { musicVolume: nextVolume })
    return
  }
  const snap = resolveEscapeMenuSettings(hud)
  const patch: EscapeMenuSettingsPatch =
    nextVolume > 0 && snap.audioMuted
      ? { masterVolume: nextVolume, audioMuted: false }
      : { masterVolume: nextVolume }
  applyEscapeMenuSettingsPatch(hud, patch)
}

export function handleEscapeSubmenuMouseMove(
  hud: WorldPanelsHud,
  logicalX: number,
  logicalY: number,
  hudWidth = 800,
  hudHeight = 600,
): boolean {
  const screen = hud.escapeMenuScreen
  if ((screen === 'sound' || screen === 'video') && hud.soundDraggingSlider) {
    const layout = computeOptionsSubmenuLayout(
      screen,
      hudWidth,
      hudHeight,
      hud.optionsSubmenuSelectedIndex,
      0,
      resolveEscapeMenuSettings(hud),
    )
    const dragRowId = hud.soundDraggingRowId ?? 'soundVolume'
    const sliderRow = layout.rows.find((r) => r.id === dragRowId) ?? layout.rows[0]
    if (sliderRow?.sliderBounds) {
      updateSoundVolumeFromSliderX(
        hud,
        logicalX,
        sliderRow.sliderBounds.left,
        sliderRow.sliderBounds.width,
        dragRowId,
      )
      return true
    }
  }

  if (
    screen === 'options' ||
    screen === 'sound' ||
    screen === 'automap' ||
    screen === 'video'
  ) {
    const layout = computeOptionsSubmenuLayout(
      screen,
      hudWidth,
      hudHeight,
      hud.optionsSubmenuSelectedIndex,
      0,
      resolveEscapeMenuSettings(hud),
    )
    for (const r of layout.rows) {
      if (
        logicalX >= r.hitMinX &&
        logicalX <= r.hitMaxX &&
        logicalY >= r.hitMinY &&
        logicalY < r.hitMaxY
      ) {
        if (hud.optionsSubmenuSelectedIndex !== r.index) {
          hud.optionsSubmenuSelectedIndex = r.index
        }
        return true
      }
    }
    return false
  }

  if (screen === 'controls') {
    const layout = computeControlsMenuLayout(
      hudWidth,
      hudHeight,
      hud.controlsScrollOffset,
      hud.controlsDraftBindings ?? resolveEscapeMenuSettings(hud).keyBindings,
    )
    const inBox =
      logicalX >= layout.boxLeft &&
      logicalX <= layout.boxLeft + layout.boxWidth &&
      logicalY >= layout.boxTop &&
      logicalY <= layout.boxTop + layout.boxHeight
    const inBtn = layout.buttons.some(
      (b) =>
        logicalX >= b.x &&
        logicalX < b.x + b.width &&
        logicalY >= b.y &&
        logicalY < b.y + b.height,
    )
    return inBox || inBtn
  }

  return false
}

export function handleEscapeSubmenuMouseDown(
  hud: WorldPanelsHud,
  logicalX: number,
  logicalY: number,
  hudWidth = 800,
  hudHeight = 600,
): string | null {
  const screen = hud.escapeMenuScreen
  if (
    screen === 'options' ||
    screen === 'sound' ||
    screen === 'automap' ||
    screen === 'video'
  ) {
    const settings = resolveEscapeMenuSettings(hud)
    const layout = computeOptionsSubmenuLayout(
      screen,
      hudWidth,
      hudHeight,
      hud.optionsSubmenuSelectedIndex,
      0,
      settings,
    )
    for (const row of layout.rows) {
      if (
        logicalX >= row.hitMinX &&
        logicalX <= row.hitMaxX &&
        logicalY >= row.hitMinY &&
        logicalY < row.hitMaxY
      ) {
        hud.optionsSubmenuSelectedIndex = row.index
        if (
          ((screen === 'sound' && (row.id === 'soundVolume' || row.id === 'musicVolume')) ||
            (screen === 'video' && (row.id === 'gamma' || row.id === 'contrast'))) &&
          row.sliderBounds
        ) {
          const sb = row.sliderBounds
          if (logicalX >= sb.left - 12 && logicalX <= sb.right + 12) {
            hud.soundDraggingSlider = true
            hud.soundDraggingRowId = row.id as 'soundVolume' | 'musicVolume' | 'gamma' | 'contrast'
            updateSoundVolumeFromSliderX(
              hud,
              logicalX,
              sb.left,
              sb.width,
              row.id as 'soundVolume' | 'musicVolume' | 'gamma' | 'contrast',
            )
            return row.id
          }
        }
        return activateEscapeSubmenuRow(hud, row.index)
      }
    }
    return null
  }

  if (screen === 'controls') {
    if (hud.controlsAwaitingBinding) {
      hud.controlsAwaitingBinding = false
      return 'cancelCapture'
    }
    const bindings = hud.controlsDraftBindings ?? resolveEscapeMenuSettings(hud).keyBindings
    const layout = computeControlsMenuLayout(
      hudWidth,
      hudHeight,
      hud.controlsScrollOffset,
      bindings,
    )

    // 1. Check bottom buttons
    for (const btn of layout.buttons) {
      if (
        logicalX >= btn.x &&
        logicalX < btn.x + btn.width &&
        logicalY >= btn.y &&
        logicalY < btn.y + btn.height
      ) {
        hud.controlsPressedButtonId = btn.id
        return `press:${btn.id}`
      }
    }

    // 2. Check scrollbar
    const sb = layout.scrollbar
    if (
      logicalX >= sb.x &&
      logicalX <= sb.x + sb.width &&
      logicalY >= sb.y &&
      logicalY <= sb.y + sb.height
    ) {
      if (logicalY <= sb.upButtonBottom) {
        hud.controlsScrollOffset = Math.max(0, hud.controlsScrollOffset - 1)
        return 'scrollUp'
      }
      if (logicalY >= sb.downButtonTop) {
        hud.controlsScrollOffset = Math.min(sb.maxScroll, hud.controlsScrollOffset + 1)
        return 'scrollDown'
      }
      const ratio = Math.max(
        0,
        Math.min(1, (logicalY - sb.trackTop) / Math.max(1, sb.trackBottom - sb.trackTop)),
      )
      hud.controlsScrollOffset = Math.round(ratio * sb.maxScroll)
      return 'scrollTrack'
    }

    // 3. Check rows
    for (const row of layout.rows) {
      if (
        logicalX >= layout.listLeft &&
        logicalX <= layout.listRight &&
        logicalY >= row.rowTop &&
        logicalY < row.rowBottom
      ) {
        const col: 'primary' | 'secondary' =
          logicalX >= layout.secondaryColLeft ? 'secondary' : 'primary'
        const sameSelection =
          hud.controlsSelectedRow === row.actionIndex && hud.controlsSelectedCol === col
        hud.controlsSelectedRow = row.actionIndex
        hud.controlsSelectedCol = col
        if (sameSelection || logicalX >= layout.primaryColLeft) {
          hud.controlsAwaitingBinding = true
          return 'awaitingBinding'
        }
        return 'selectRow'
      }
    }
  }

  return null
}

export function handleEscapeSubmenuMouseUp(
  hud: WorldPanelsHud,
  logicalX: number,
  logicalY: number,
  hudWidth = 800,
  hudHeight = 600,
): string | null {
  if (hud.soundDraggingSlider) {
    hud.soundDraggingSlider = false
    return 'releaseSlider'
  }
  if (hud.escapeMenuScreen === 'controls' && hud.controlsPressedButtonId) {
    const pressedId = hud.controlsPressedButtonId
    hud.controlsPressedButtonId = null
    const bindings = hud.controlsDraftBindings ?? resolveEscapeMenuSettings(hud).keyBindings
    const layout = computeControlsMenuLayout(
      hudWidth,
      hudHeight,
      hud.controlsScrollOffset,
      bindings,
    )
    const btn = layout.buttons.find((b) => b.id === pressedId)
    if (
      btn &&
      logicalX >= btn.x &&
      logicalX < btn.x + btn.width &&
      logicalY >= btn.y &&
      logicalY < btn.y + btn.height
    ) {
      return executeControlsButtonAction(hud, pressedId)
    }
  }
  return null
}

export function executeControlsButtonAction(
  hud: WorldPanelsHud,
  buttonId: ControlsButtonId,
): string {
  if (buttonId === 'default') {
    hud.controlsDraftBindings = createDefaultKeyBindings()
    hud.controlsAwaitingBinding = false
    return 'default'
  }
  if (buttonId === 'accept') {
    if (hud.controlsDraftBindings) {
      applyEscapeMenuSettingsPatch(hud, { keyBindings: hud.controlsDraftBindings })
    }
    hud.controlsDraftBindings = null
    enterEscapeMenuScreen(hud, 'options', 3)
    return 'accept'
  }
  // cancel
  hud.controlsDraftBindings = null
  enterEscapeMenuScreen(hud, 'options', 3)
  return 'cancel'
}

export function handleEscapeSubmenuWheel(hud: WorldPanelsHud, deltaY: number): boolean {
  if (!hud.escapeMenuOpen || hud.escapeMenuScreen !== 'controls') return false
  if (deltaY === 0) return true
  const maxScroll = Math.max(0, CONTROL_ACTION_DEFINITIONS.length - CONTROLS_VISIBLE_ROWS)
  const step = deltaY > 0 ? 1 : -1
  hud.controlsScrollOffset = Math.max(0, Math.min(maxScroll, hud.controlsScrollOffset + step))
  return true
}

export function handleEscapeSubmenuKeyDown(
  hud: WorldPanelsHud,
  event: {
    code?: string | undefined
    key?: string | undefined
    preventDefault?: (() => void) | undefined
  },
): boolean {
  if (!hud.escapeMenuOpen || hud.escapeMenuScreen === 'main') return false
  const key = event.key ?? ''
  const code = event.code ?? ''

  // 1. Key capture inside Configure Controls
  if (hud.escapeMenuScreen === 'controls' && hud.controlsAwaitingBinding) {
    event.preventDefault?.()
    if (key === 'Escape' || code === 'Escape') {
      hud.controlsAwaitingBinding = false
      return true
    }
    const def = CONTROL_ACTION_DEFINITIONS[hud.controlsSelectedRow]
    if (!def) {
      hud.controlsAwaitingBinding = false
      return true
    }
    const draft =
      hud.controlsDraftBindings ??
      cloneKeyBindings(resolveEscapeMenuSettings(hud).keyBindings)
    if (key === 'Backspace' || key === 'Delete' || code === 'Backspace' || code === 'Delete') {
      hud.controlsDraftBindings = clearKeyBindingSlot(draft, def.id, hud.controlsSelectedCol)
      hud.controlsAwaitingBinding = false
      return true
    }
    const normCode = normalizeKeyEventToBindingCode(event)
    if (normCode) {
      hud.controlsDraftBindings = assignKeyBinding(
        draft,
        def.id,
        hud.controlsSelectedCol,
        normCode,
      )
      hud.controlsAwaitingBinding = false
    }
    return true
  }

  // 2. Escape navigates back one level
  if (key === 'Escape' || code === 'Escape') {
    event.preventDefault?.()
    navigateEscapeMenuBack(hud)
    return true
  }

  // 3. Up / Down navigation
  if (key === 'ArrowUp' || code === 'ArrowUp') {
    event.preventDefault?.()
    moveEscapeSubmenuSelection(hud, -1)
    return true
  }
  if (key === 'ArrowDown' || code === 'ArrowDown') {
    event.preventDefault?.()
    moveEscapeSubmenuSelection(hud, 1)
    return true
  }

  // 4. Left / Right adjustment
  if (key === 'ArrowLeft' || code === 'ArrowLeft') {
    event.preventDefault?.()
    adjustEscapeSubmenuHorizontal(hud, -1)
    return true
  }
  if (key === 'ArrowRight' || code === 'ArrowRight') {
    event.preventDefault?.()
    adjustEscapeSubmenuHorizontal(hud, 1)
    return true
  }

  // 5. Delete / Backspace on selected slot in Configure Controls (even when not awaiting capture)
  if (
    hud.escapeMenuScreen === 'controls' &&
    (key === 'Backspace' || key === 'Delete' || code === 'Backspace' || code === 'Delete')
  ) {
    event.preventDefault?.()
    const def = CONTROL_ACTION_DEFINITIONS[hud.controlsSelectedRow]
    if (def) {
      const draft =
        hud.controlsDraftBindings ??
        cloneKeyBindings(resolveEscapeMenuSettings(hud).keyBindings)
      hud.controlsDraftBindings = clearKeyBindingSlot(draft, def.id, hud.controlsSelectedCol)
    }
    return true
  }

  // 6. Enter / Space activates row or begins key capture
  if (key === 'Enter' || key === ' ' || code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
    event.preventDefault?.()
    activateEscapeSubmenuRow(hud, hud.optionsSubmenuSelectedIndex)
    return true
  }

  return true
}

