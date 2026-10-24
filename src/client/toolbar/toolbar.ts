import {
  getGameLang,
  onLangChange,
  setLang,
  tToolbar,
  type GameLang,
} from '../i18n/lang.ts'
import {
  TOOLBAR_DROP_TRACKER_ICON_SVG,
  TOOLBAR_KILL_STATS_ICON_SVG,
  resolveLocalizedText,
  type ToolbarContributionHandle,
  type ToolbarContributionPatch,
} from '../plugin-host/api.ts'
import type { ToolbarContributionSpec } from '../plugin-host/plugin-host.ts'
import {
  VALID_VIEWPORT_RESOLUTIONS,
  validateServerHost,
  type AutomapRevealMode,
  type ClientLightingPreset,
  type ClientSettings,
  type ServerHostValidationResult,
  type ViewportResolution,
} from '../settings/client-settings.ts'
import { getGlobalSettingsStore, type SettingsStore } from '../settings/settings-store.ts'
import { FullscreenController, type FullscreenDocLike } from './fullscreen-controller.ts'
import {
  clearClientAssetCache,
  formatCacheBytesMb,
} from '../sw/register.ts'
import {
  DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS,
  formatViewportLabel,
  getViewportProfile,
  pickFallbackViewport,
  type ViewportProfile,
} from '../view/viewport-profile.ts'

export type ToolbarConnectionPhase =
  | 'disconnected'
  | 'connecting'
  | 'bncs'
  | 'mcp'
  | 'd2gs'
  | 'local'
  | 'error'

export type ToolbarDiagnosticKind =
  | 'none'
  | 'quota_exceeded'
  | 'tls_error'
  | 'bare_ip_on_https'
  | 'invalid_host'
  | 'custom'

export interface ToolbarConnectionState {
  readonly phase: ToolbarConnectionPhase
  readonly rttMs: number | null
  readonly diagnosticKind?: ToolbarDiagnosticKind | undefined
  readonly diagnosticMessage?: string | undefined
}

export type BugReportCategory =
  | 'gameplay'
  | 'render'
  | 'network'
  | 'audio'
  | 'ui'
  | 'other'

export const BUG_REPORT_CATEGORIES: readonly BugReportCategory[] = [
  'gameplay',
  'render',
  'network',
  'audio',
  'ui',
  'other',
] as const

export interface BugReportSubmission {
  readonly title: string
  readonly category: BugReportCategory
  readonly description: string
  readonly clientTimestamp: string
  readonly connection: ToolbarConnectionState
  readonly settings: ClientSettings
  readonly pageUrl?: string | undefined
  readonly userAgent?: string | undefined
  readonly gameContext?: Record<string, unknown> | undefined
}

export interface BugReportSaveResponse {
  readonly ok: boolean
  readonly id: string
  readonly savedAt?: string | undefined
  readonly file?: string | undefined
  readonly error?: string | undefined
}

export interface ToolbarCallbacks {
  readonly onServerHostReconnect?: ((newHost: string, prevHost: string) => void) | undefined
  readonly onLangChange?: ((lang: GameLang) => void) | undefined
  readonly onLightingChange?: ((preset: ClientLightingPreset) => void) | undefined
  readonly onAutomapRevealChange?: ((mode: AutomapRevealMode) => void) | undefined
  readonly onViewportChange?: ((profile: ViewportProfile) => void) | undefined
  readonly onPluginsToggle?: (() => void) | undefined
  readonly onClearCache?: (() => void | Promise<void>) | undefined
  /** Fullscreen enter/exit failed (default: `console.error`). */
  readonly onFullscreenError?: ((message: string) => void) | undefined
  /** Fired when a toolbar modal (`config` or `bug-report`) opens so other overlays can close. */
  readonly onModalOpen?: ((modal: 'config' | 'bug-report') => void) | undefined
  /** Optional runtime/session context attached to submitted bug reports. */
  readonly getBugReportContext?: (() => Record<string, unknown>) | undefined
  /** Fired after a bug report is successfully persisted to the server. */
  readonly onBugReportSubmitted?: ((
    res: BugReportSaveResponse,
    submission: BugReportSubmission,
  ) => void) | undefined
}

export interface ToolbarOptions {
  readonly store?: SettingsStore | undefined
  readonly container?: HTMLElement | null | undefined
  readonly pageProtocol?: string | undefined
  readonly allowedViewports?: readonly ViewportResolution[] | undefined
  readonly confirmReconnect?: ((message: string) => boolean) | undefined
  readonly submitBugReportFn?: ((
    submission: BugReportSubmission,
  ) => Promise<BugReportSaveResponse>) | undefined
  readonly callbacks?: ToolbarCallbacks | undefined
}

export interface ToolbarSnapshot {
  readonly connection: ToolbarConnectionState
  readonly settings: ClientSettings
  readonly viewportProfile: ViewportProfile
  readonly allowedViewports: readonly ViewportResolution[]
  readonly statusLabel: string
  readonly rttLabel: string
  readonly diagnosticBannerText: string | null
  readonly serverInputValue: string
  readonly serverInputValid: boolean
  readonly configModalOpen: boolean
  readonly bugModalOpen: boolean
}

interface ContributionEntry {
  spec: ToolbarContributionSpec
  readonly el: HTMLElement | null
  readonly iconEl: HTMLElement | null
  readonly labelEl: HTMLElement | null
  readonly selectEl: HTMLSelectElement | null
}

const DROP_BADGE_PATTERN =
  /^(掉落\s+|Drops\s+)(绿\d+|S:\d+)(\s*·\s*)(金\d+|U:\d+)(\s*·\s*)(符\d+|R:\d+)$/

/**
 * Persistent 32px Top DOM Toolbar (`#d2-toolbar`) with primary controls:
 * - Far Left: Plugins modal button (`#d2-toolbar-plugins-btn`) + Dynamic Plugin Contribution Slot (`#d2-toolbar-plugin-slot`)
 * - Far Right (`#d2-toolbar-right`): Connection Status + RTT (`ms`) | Language Switch Icon Button (`#d2-toolbar-lang-btn`) + Config Modal Icon Button (`#d2-toolbar-config-btn`) + Bug Report Icon Button (`#d2-toolbar-bug-btn`)
 * - Modals:
 *   - Config Modal (`#d2-config-modal-overlay`, `[data-d2-modal-overlay="config"]`): Fullscreen/Windowed, Resolution (`#d2-toolbar-viewport-select`), FPS (`#d2-toolbar-worldfps-select`), Master Volume (`#d2-toolbar-mute-btn` + `#d2-toolbar-volume-slider`), Clear Asset Cache (`#d2-toolbar-cache-clear-btn`)
 *   - Bug Report Modal (`#d2-bug-modal-overlay`, `[data-d2-modal-overlay="bug-report"]`): Submits structured bug reports to `POST /api/bugs`
 */
export const TOOLBAR_PLUGINS_ICON_SVG =
  '<svg class="d2-toolbar__icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" focusable="false" aria-hidden="true"><path d="M4 5h1.5v-.5a1.5 1.5 0 0 1 3 0V5H10a1 1 0 0 1 1 1v1.5h.5a1.5 1.5 0 0 1 0 3H11V12a1 1 0 0 1-1 1H8.5v-.4a1.5 1.5 0 0 0-3 0V13H4a1 1 0 0 1-1-1v-1.5h.4a1.5 1.5 0 0 0 0-3H3V6a1 1 0 0 1 1-1Z"/></svg>'

export const TOOLBAR_LANG_ICON_SVG =
  '<svg class="d2-toolbar__icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2a9.5 9.5 0 0 1 2.6 6A9.5 9.5 0 0 1 8 14a9.5 9.5 0 0 1-2.6-6A9.5 9.5 0 0 1 8 2Z"/></svg>'

export const TOOLBAR_CONFIG_ICON_SVG =
  '<svg class="d2-toolbar__icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1"/></svg>'

export const TOOLBAR_BUG_ICON_SVG =
  '<svg class="d2-toolbar__icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><rect x="5" y="5" width="6" height="7.5" rx="3"/><path d="M6.2 5V3.8a1.8 1.8 0 0 1 3.6 0V5M2.5 6.5L5 7.2M13.5 6.5L11 7.2M2 9.2h3M11 9.2h3M2.5 12l2.5-.8M13.5 12L11 11.2"/></svg>'

export const TOOLBAR_FULLSCREEN_ENTER_ICON_SVG =
  '<svg class="d2-toolbar__icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" focusable="false" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>'
export const TOOLBAR_FULLSCREEN_EXIT_ICON_SVG =
  '<svg class="d2-toolbar__icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" focusable="false" aria-hidden="true"><path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4"/></svg>'
export const TOOLBAR_CACHE_CLEAR_ICON_SVG =
  '<svg class="d2-toolbar__icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="M3 4h10M6 4V2.5h4V4M4.5 4l.6 9.5h5.8L11.5 4"/></svg>'

export const TOOLBAR_VOLUME_ON_ICON_SVG =
  '<svg class="d2-toolbar__icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="M2.5 6.2h2.6L8.5 3.5v9l-3.4-2.7H2.5v-3.6Z"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.8a6 6 0 0 1 0 8.4"/></svg>'

export const TOOLBAR_VOLUME_MUTE_ICON_SVG =
  '<svg class="d2-toolbar__icon-svg" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true"><path d="M2.5 6.2h2.6L8.5 3.5v9l-3.4-2.7H2.5v-3.6Z"/><path d="M11 6l3 4M14 6l-3 4"/></svg>'

export { TOOLBAR_DROP_TRACKER_ICON_SVG, TOOLBAR_KILL_STATS_ICON_SVG }

function resolveBugApiEndpoint(): string {
  if (typeof window !== 'undefined' && window.location?.pathname) {
    if (window.location.pathname.startsWith('/diablo2/')) {
      return '/diablo2/api/bugs'
    }
  }
  return '/api/bugs'
}

async function defaultSubmitBugReport(
  submission: BugReportSubmission,
): Promise<BugReportSaveResponse> {
  if (typeof fetch !== 'function') {
    throw new Error('fetch is not available in this environment')
  }
  const res = await fetch(resolveBugApiEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission),
  })
  let payload: Partial<BugReportSaveResponse> | null = null
  try {
    payload = (await res.json()) as Partial<BugReportSaveResponse>
  } catch {
    payload = null
  }
  if (!res.ok || !payload?.ok || !payload.id) {
    throw new Error(payload?.error || `HTTP ${res.status}`)
  }
  return {
    ok: true,
    id: payload.id,
    savedAt: payload.savedAt,
    file: payload.file,
  }
}

export class Toolbar {
  private readonly store: SettingsStore
  private readonly pageProtocol: string
  private readonly confirmReconnectFn: (message: string) => boolean
  private readonly submitBugReportFn: (
    submission: BugReportSubmission,
  ) => Promise<BugReportSaveResponse>
  private readonly callbacks: ToolbarCallbacks
  private connection: ToolbarConnectionState = {
    phase: 'disconnected',
    rttMs: null,
    diagnosticKind: 'none',
  }
  private allowedViewports: readonly ViewportResolution[]
  private serverInputValue: string
  private serverInputValid = true
  private cacheUsageBytes = 0
  private cacheClearedFlash = false
  private pluginsReady = false
  private pluginsHasWarning = false
  private pluginsMenuOpen = false
  private configModalOpen = false
  private bugModalOpen = false
  private bugSubmitting = false
  private bugStatusState: {
    readonly kind: 'none' | 'ok' | 'error'
    readonly message: string
  } = { kind: 'none', message: '' }
  private readonly contributions = new Map<string, ContributionEntry>()
  private unsubscribeStore: (() => void) | null = null
  private unsubscribeLang: (() => void) | null = null

  // Optional real DOM elements when mounted in browser
  private rootEl: HTMLElement | null = null
  private statusDotEl: HTMLElement | null = null
  private statusTextEl: HTMLElement | null = null
  private rttTextEl: HTMLElement | null = null
  private langBtnEl: HTMLButtonElement | null = null
  private langBtnIconEl: HTMLElement | null = null
  private langBtnBadgeEl: HTMLElement | null = null
  private configBtnEl: HTMLButtonElement | null = null
  private configBtnIconEl: HTMLElement | null = null
  private bugBtnEl: HTMLButtonElement | null = null
  private bugBtnIconEl: HTMLElement | null = null

  // Config modal DOM elements
  private configOverlayEl: HTMLElement | null = null
  private configTitleEl: HTMLElement | null = null
  private configSubtitleEl: HTMLElement | null = null
  private configCloseBtnEl: HTMLButtonElement | null = null
  private displayModeLabelEl: HTMLElement | null = null
  private viewportLabelEl: HTMLElement | null = null
  private viewportSelectEl: HTMLSelectElement | null = null
  private fpsLabelEl: HTMLElement | null = null
  private worldFpsSelectEl: HTMLSelectElement | null = null
  private volumeLabelEl: HTMLElement | null = null
  private muteBtnEl: HTMLButtonElement | null = null
  private muteBtnIconEl: HTMLElement | null = null
  private muteBtnLabelEl: HTMLElement | null = null
  private volumeSliderEl: HTMLInputElement | null = null
  private volumeValueEl: HTMLElement | null = null
  private cacheRowLabelEl: HTMLElement | null = null
  private fullscreenBtnEl: HTMLButtonElement | null = null
  private fullscreenBtnIconEl: HTMLElement | null = null
  private fullscreenBtnLabelEl: HTMLElement | null = null
  private fullscreen: FullscreenController | null = null
  private cacheClearBtnEl: HTMLButtonElement | null = null
  private cacheClearBtnIconEl: HTMLElement | null = null
  private cacheClearBtnLabelEl: HTMLElement | null = null
  private serverRowEl: HTMLElement | null = null
  private serverLabelEl: HTMLElement | null = null
  private serverInputEl: HTMLInputElement | null = null
  private serverApplyBtnEl: HTMLButtonElement | null = null
  private serverStatusEl: HTMLElement | null = null
  private multiboxSlotEl: HTMLElement | null = null
  private multiboxRowLabelEl: HTMLElement | null = null
  private multiboxToggleBtnEl: HTMLButtonElement | null = null
  private multiboxAlertBtnEl: HTMLButtonElement | null = null

  // Bug report modal DOM elements
  private bugOverlayEl: HTMLElement | null = null
  private bugTitleEl: HTMLElement | null = null
  private bugSubtitleEl: HTMLElement | null = null
  private bugCloseBtnEl: HTMLButtonElement | null = null
  private bugTitleLabelEl: HTMLElement | null = null
  private bugTitleInputEl: HTMLInputElement | null = null
  private bugCategoryLabelEl: HTMLElement | null = null
  private bugCategorySelectEl: HTMLSelectElement | null = null
  private bugDescLabelEl: HTMLElement | null = null
  private bugDescInputEl: HTMLTextAreaElement | null = null
  private bugStatusMsgEl: HTMLElement | null = null
  private bugCancelBtnEl: HTMLButtonElement | null = null
  private bugSubmitBtnEl: HTMLButtonElement | null = null

  private pluginsBtnEl: HTMLButtonElement | null = null
  private pluginsBtnIconEl: HTMLElement | null = null
  private pluginsBtnLabelEl: HTMLElement | null = null
  private pluginSlotEl: HTMLElement | null = null
  private diagBannerEl: HTMLElement | null = null

  private readonly handleWindowKeyDownCapture = (e: KeyboardEvent): void => {
    if (!this.configModalOpen && !this.bugModalOpen) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopImmediatePropagation()
      this.closeModals()
    }
  }

  private readonly handleWindowKeyBubble = (e: KeyboardEvent): void => {
    if (!this.configModalOpen && !this.bugModalOpen) return
    e.stopImmediatePropagation()
  }

  constructor(options?: ToolbarOptions) {
    this.store = options?.store ?? getGlobalSettingsStore()
    this.pageProtocol =
      options?.pageProtocol ??
      (typeof window !== 'undefined' && window.location ? window.location.protocol : 'https:')
    this.allowedViewports =
      options?.allowedViewports && options.allowedViewports.length > 0
        ? [...options.allowedViewports]
        : [...DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS]
    this.confirmReconnectFn =
      options?.confirmReconnect ??
      ((msg: string) =>
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(msg)
          : true)
    this.submitBugReportFn = options?.submitBugReportFn ?? defaultSubmitBugReport
    this.callbacks = options?.callbacks ?? {}
    this.serverInputValue = this.store.get().serverHost

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      this.mountDom(options?.container ?? null)
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('keydown', this.handleWindowKeyDownCapture, true)
      window.addEventListener('keydown', this.handleWindowKeyBubble, false)
      window.addEventListener('keyup', this.handleWindowKeyBubble, false)
    }

    this.unsubscribeStore = this.store.subscribe((next, prev, changedKeys) => {
      if (changedKeys.includes('serverHost')) {
        this.serverInputValue = next.serverHost
        this.serverInputValid = true
      }
      if (changedKeys.includes('lang') && next.lang !== prev.lang) {
        this.callbacks.onLangChange?.(next.lang)
      }
      if (changedKeys.includes('lightingPreset') && next.lightingPreset !== prev.lightingPreset) {
        this.callbacks.onLightingChange?.(next.lightingPreset)
      }
      if (changedKeys.includes('automapReveal') && next.automapReveal !== prev.automapReveal) {
        this.callbacks.onAutomapRevealChange?.(next.automapReveal)
      }
      if (changedKeys.includes('viewport') && next.viewport !== prev.viewport) {
        this.callbacks.onViewportChange?.(getViewportProfile(next.viewport))
      }
      this.syncDom()
    })

    this.unsubscribeLang = onLangChange(() => {
      this.syncDom()
    })
  }

  getElement(): HTMLElement | null {
    return this.rootEl
  }

  getSettings(): ClientSettings {
    return this.store.get()
  }

  getConnectionState(): ToolbarConnectionState {
    return this.connection
  }

  isActiveSession(): boolean {
    const p = this.connection.phase
    return p === 'connecting' || p === 'bncs' || p === 'mcp' || p === 'd2gs'
  }

  setConnectionState(
    next: Partial<ToolbarConnectionState> & { readonly phase: ToolbarConnectionPhase },
  ): void {
    this.connection = {
      phase: next.phase,
      rttMs: next.rttMs !== undefined ? next.rttMs : this.connection.rttMs,
      diagnosticKind:
        next.diagnosticKind ??
        (next.phase === 'error' ? this.connection.diagnosticKind ?? 'custom' : 'none'),
      diagnosticMessage: next.diagnosticMessage,
    }
    this.syncDom()
  }

  setRttMs(rttMs: number | null): void {
    this.connection = {
      ...this.connection,
      rttMs: rttMs !== null && Number.isFinite(rttMs) ? Math.max(0, Math.round(rttMs)) : null,
    }
    this.syncDom()
  }

  reportDiagnostic(kind: ToolbarDiagnosticKind, customMessage?: string): void {
    this.connection = {
      ...this.connection,
      phase: kind === 'none' ? this.connection.phase : 'error',
      diagnosticKind: kind,
      diagnosticMessage: customMessage,
    }
    this.syncDom()
  }

  clearDiagnostic(): void {
    this.connection = {
      ...this.connection,
      diagnosticKind: 'none',
      diagnosticMessage: undefined,
    }
    this.syncDom()
  }

  setDiagBanner(text: string | null): void {
    if (text && text.trim().length > 0) {
      this.reportDiagnostic('custom', text)
    } else {
      this.clearDiagnostic()
    }
  }

  /**
   * Attempt to apply a new `serverHost`.
   * - Validates against `validateServerHost` (rejects bare IP on `https:`).
   * - If currently in an active session (`connecting | bncs | mcp | d2gs`), asks for confirmation before disconnecting & reconnecting.
   */
  submitServerHost(rawHost: string): ServerHostValidationResult & { readonly applied: boolean } {
    this.serverInputValue = rawHost
    const check = validateServerHost(rawHost, this.pageProtocol)
    if (!check.valid) {
      this.serverInputValid = false
      const lang = this.store.get().lang
      const msg = lang === 'en' ? check.errorMessage : (check.errorMessageZh ?? check.errorMessage)
      this.connection = {
        ...this.connection,
        diagnosticKind: check.reason === 'bare_ip_on_https' ? 'bare_ip_on_https' : 'invalid_host',
        diagnosticMessage: msg,
      }
      this.syncDom()
      return { ...check, applied: false }
    }

    const prevHost = this.store.get().serverHost
    if (check.normalizedHost === prevHost) {
      this.serverInputValue = check.normalizedHost
      this.serverInputValid = true
      if (
        this.connection.diagnosticKind === 'bare_ip_on_https' ||
        this.connection.diagnosticKind === 'invalid_host'
      ) {
        this.clearDiagnostic()
      } else {
        this.syncDom()
      }
      return { ...check, applied: true }
    }

    if (this.isActiveSession()) {
      const confirmMsg = tToolbar('toolbar.server.confirmReconnect', this.store.get().lang)
      if (!this.confirmReconnectFn(confirmMsg)) {
        this.serverInputValue = prevHost
        this.serverInputValid = true
        this.syncDom()
        return { ...check, applied: false }
      }
    }

    this.serverInputValid = true
    this.serverInputValue = check.normalizedHost
    if (
      this.connection.diagnosticKind === 'bare_ip_on_https' ||
      this.connection.diagnosticKind === 'invalid_host'
    ) {
      this.connection = {
        ...this.connection,
        diagnosticKind: 'none',
        diagnosticMessage: undefined,
      }
    }
    this.store.setServerHost(check.normalizedHost, this.pageProtocol)
    this.callbacks.onServerHostReconnect?.(check.normalizedHost, prevHost)
    this.syncDom()
    return { ...check, applied: true }
  }

  setLanguage(lang: GameLang): void {
    this.store.set({ lang })
    setLang(lang)
    this.syncDom()
  }

  setLang(lang: GameLang): void {
    this.setLanguage(lang)
  }

  toggleLanguage(): GameLang {
    const next: GameLang = this.store.get().lang === 'en' ? 'zh' : 'en'
    this.setLanguage(next)
    return next
  }

  setMasterVolume(volume: number): number {
    const clamped = Number.isFinite(volume)
      ? Math.min(1, Math.max(0, Math.round(volume * 100) / 100))
      : this.store.get().masterVolume
    this.store.set({ masterVolume: clamped })
    if (clamped > 0 && this.store.get().audioMuted) {
      this.store.set({ audioMuted: false })
    }
    this.syncDom()
    return clamped
  }

  setAudioMuted(muted: boolean): void {
    this.store.set({ audioMuted: Boolean(muted) })
    this.syncDom()
  }

  toggleAudioMuted(): boolean {
    const next = !this.store.get().audioMuted
    this.setAudioMuted(next)
    return next
  }

  setMultiboxEnabled(enabled: boolean): void {
    this.store.set({ multiboxEnabled: Boolean(enabled) })
    this.syncDom()
  }

  toggleMultiboxEnabled(): boolean {
    const next = !(this.store.get().multiboxEnabled ?? false)
    this.setMultiboxEnabled(next)
    return next
  }

  setMultiboxAlertSoundEnabled(enabled: boolean): void {
    this.store.set({ multiboxAlertSoundEnabled: Boolean(enabled) })
    this.syncDom()
  }

  toggleMultiboxAlertSoundEnabled(): boolean {
    const next = !(this.store.get().multiboxAlertSoundEnabled ?? true)
    this.setMultiboxAlertSoundEnabled(next)
    return next
  }

  getMultiboxSlotElement(): HTMLElement | null {
    return this.multiboxSlotEl
  }

  isConfigModalOpen(): boolean {
    return this.configModalOpen
  }

  openConfigModal(): void {
    if (this.configModalOpen) return
    if (this.bugModalOpen) {
      this.bugModalOpen = false
    }
    this.configModalOpen = true
    this.serverInputValue = this.store.get().serverHost
    this.serverInputValid = true
    this.callbacks.onModalOpen?.('config')
    this.syncDom()
    if (this.configCloseBtnEl && typeof this.configCloseBtnEl.focus === 'function') {
      this.configCloseBtnEl.focus()
    }
  }

  closeConfigModal(): void {
    if (!this.configModalOpen) return
    this.configModalOpen = false
    this.serverInputValue = this.store.get().serverHost
    this.serverInputValid = true
    if (this.serverStatusEl) {
      this.serverStatusEl.hidden = true
    }
    if (this.serverInputEl) {
      this.serverInputEl.style.borderColor = ''
      this.serverInputEl.style.boxShadow = ''
    }
    this.syncDom()
    if (this.configBtnEl && typeof this.configBtnEl.focus === 'function') {
      this.configBtnEl.focus()
    }
  }

  toggleConfigModal(): boolean {
    if (this.configModalOpen) {
      this.closeConfigModal()
    } else {
      this.openConfigModal()
    }
    return this.configModalOpen
  }

  isBugModalOpen(): boolean {
    return this.bugModalOpen
  }

  openBugModal(): void {
    if (this.bugModalOpen) return
    if (this.configModalOpen) {
      this.configModalOpen = false
    }
    this.bugModalOpen = true
    this.bugStatusState = { kind: 'none', message: '' }
    this.callbacks.onModalOpen?.('bug-report')
    this.syncDom()
    if (this.bugTitleInputEl && typeof this.bugTitleInputEl.focus === 'function') {
      this.bugTitleInputEl.focus()
    }
  }

  closeBugModal(): void {
    if (!this.bugModalOpen) return
    this.bugModalOpen = false
    this.syncDom()
    if (this.bugBtnEl && typeof this.bugBtnEl.focus === 'function') {
      this.bugBtnEl.focus()
    }
  }

  toggleBugModal(): boolean {
    if (this.bugModalOpen) {
      this.closeBugModal()
    } else {
      this.openBugModal()
    }
    return this.bugModalOpen
  }

  closeModals(): void {
    if (this.configModalOpen) {
      this.closeConfigModal()
    }
    if (this.bugModalOpen) {
      this.closeBugModal()
    }
  }

  async submitBugReport(input?: {
    readonly title?: string | undefined
    readonly category?: BugReportCategory | undefined
    readonly description?: string | undefined
  }): Promise<BugReportSaveResponse> {
    const lang = this.store.get().lang || getGameLang()
    const rawTitle = input?.title ?? this.bugTitleInputEl?.value ?? ''
    const rawDesc = input?.description ?? this.bugDescInputEl?.value ?? ''
    const rawCat = (input?.category ??
      (this.bugCategorySelectEl?.value as BugReportCategory | undefined) ??
      'gameplay') as BugReportCategory
    const category: BugReportCategory = (
      BUG_REPORT_CATEGORIES as readonly string[]
    ).includes(rawCat)
      ? rawCat
      : 'gameplay'

    const title = rawTitle.trim()
    const description = rawDesc.trim()
    if (!title || !description) {
      const errMsg = tToolbar('toolbar.bug.errorEmpty', lang)
      this.bugStatusState = { kind: 'error', message: errMsg }
      this.syncDom()
      return { ok: false, id: '', error: errMsg }
    }

    const submission: BugReportSubmission = {
      title,
      category,
      description,
      clientTimestamp: new Date().toISOString(),
      connection: this.connection,
      settings: this.store.get(),
      pageUrl:
        typeof window !== 'undefined' && window.location ? window.location.href : undefined,
      userAgent:
        typeof navigator !== 'undefined' && navigator.userAgent
          ? navigator.userAgent
          : undefined,
      gameContext: this.callbacks.getBugReportContext?.(),
    }

    this.bugSubmitting = true
    this.bugStatusState = { kind: 'none', message: '' }
    this.syncDom()

    try {
      const res = await this.submitBugReportFn(submission)
      this.bugSubmitting = false
      if (!res.ok) {
        const msg = `${tToolbar('toolbar.bug.errorFailed', lang)}: ${res.error ?? 'Unknown'}`
        this.bugStatusState = { kind: 'error', message: msg }
        this.syncDom()
        return res
      }
      if (this.bugTitleInputEl) this.bugTitleInputEl.value = ''
      if (this.bugDescInputEl) this.bugDescInputEl.value = ''
      const savedText = `${tToolbar('toolbar.bug.saved', lang)} (#${res.id})`
      this.bugStatusState = { kind: 'ok', message: savedText }
      this.syncDom()
      this.callbacks.onBugReportSubmitted?.(res, submission)
      return res
    } catch (err) {
      this.bugSubmitting = false
      const detail = err instanceof Error ? err.message : String(err)
      const msg = `${tToolbar('toolbar.bug.errorFailed', lang)}: ${detail}`
      this.bugStatusState = { kind: 'error', message: msg }
      this.syncDom()
      return { ok: false, id: '', error: detail }
    }
  }

  setLightingPreset(preset: ClientLightingPreset): void {
    this.store.set({ lightingPreset: preset })
    this.syncDom()
  }

  setAutomapReveal(mode: AutomapRevealMode): void {
    this.store.set({ automapReveal: mode })
    this.syncDom()
  }

  getAllowedViewports(): readonly ViewportResolution[] {
    return this.allowedViewports
  }

  setAllowedViewports(resolutions: readonly ViewportResolution[]): void {
    const valid = resolutions.filter((r): r is ViewportResolution =>
      (VALID_VIEWPORT_RESOLUTIONS as readonly string[]).includes(r),
    )
    this.allowedViewports =
      valid.length > 0 ? valid : [...DEFAULT_ALLOWED_VIEWPORT_RESOLUTIONS]
    const current = this.store.get().viewport
    if (!this.allowedViewports.includes(current)) {
      this.store.set({ viewport: pickFallbackViewport(this.allowedViewports) })
    }
    this.syncDom()
  }

  setViewport(viewport: ViewportResolution): ViewportProfile {
    const target: ViewportResolution = this.allowedViewports.includes(viewport)
      ? viewport
      : pickFallbackViewport(this.allowedViewports)
    this.store.set({ viewport: target })
    this.syncDom()
    return getViewportProfile(target)
  }

  /** Advance to the next resolution in `allowedViewports` order, wrapping back to the first. */
  toggleViewport(): ViewportProfile {
    const order = this.allowedViewports
    const currentIdx = order.indexOf(this.store.get().viewport)
    const next = order[(currentIdx + 1) % order.length]!
    return this.setViewport(next)
  }

  setWorldRenderFps(fps: 30 | 60): 30 | 60 {
    const normalized: 30 | 60 = fps === 30 ? 30 : 60
    this.store.set({ worldRenderFps: normalized })
    this.syncDom()
    return normalized
  }

  isFullscreenActive(): boolean {
    return this.fullscreen ? this.fullscreen.isActive() : false
  }

  isFullscreenSupported(): boolean {
    return this.fullscreen ? this.fullscreen.isSupported() : false
  }

  toggleFullscreen(): void {
    if (this.fullscreen) {
      void this.fullscreen.toggle()
    }
  }

  setPluginsButtonState(state: {
    readonly ready: boolean
    readonly hasWarning: boolean
    readonly open?: boolean | undefined
  }): void {
    this.pluginsReady = state.ready
    this.pluginsHasWarning = state.hasWarning
    if (state.open !== undefined) {
      this.pluginsMenuOpen = state.open
      if (state.open) {
        this.configModalOpen = false
        this.bugModalOpen = false
      }
    }
    this.syncDom()
  }

  private resolveDefaultContributionIcon(
    _domId: string,
    explicitIconSvg?: string,
  ): string | undefined {
    // Core stays plugin-agnostic (arch Rule 9): plugins supply their own `iconSvg`; no per-plugin-ID fallbacks here.
    if (explicitIconSvg && explicitIconSvg.trim().length > 0) {
      return explicitIconSvg
    }
    return undefined
  }

  private renderContributionLabel(labelEl: HTMLElement, label: string): void {
    const match = typeof document !== 'undefined' ? DROP_BADGE_PATTERN.exec(label) : null
    if (match && typeof document !== 'undefined' && typeof document.createElement === 'function') {
      labelEl.textContent = ''
      const segments: ReadonlyArray<{ readonly cls: string; readonly text: string }> = [
        { cls: 'd2-toolbar__drop-prefix', text: match[1]! },
        { cls: 'd2-toolbar__drop-set', text: match[2]! },
        { cls: 'd2-toolbar__drop-sep', text: match[3]! },
        { cls: 'd2-toolbar__drop-unique', text: match[4]! },
        { cls: 'd2-toolbar__drop-sep', text: match[5]! },
        { cls: 'd2-toolbar__drop-rune', text: match[6]! },
      ]
      for (const seg of segments) {
        const span = document.createElement('span')
        span.className = seg.cls
        span.textContent = seg.text
        labelEl.appendChild(span)
      }
      return
    }
    labelEl.textContent = label
  }

  registerContribution(spec: ToolbarContributionSpec): ToolbarContributionHandle {
    return this.addContribution(spec)
  }

  addContribution(spec: ToolbarContributionSpec): ToolbarContributionHandle {
    const existing = this.contributions.get(spec.domId)

    let el: HTMLElement | null = null
    let iconEl: HTMLElement | null = null
    let labelEl: HTMLElement | null = null
    let selectEl: HTMLSelectElement | null = null

    if (typeof document !== 'undefined' && this.pluginSlotEl) {
      const lang = this.store.get().lang || getGameLang()
      const label = resolveLocalizedText(spec.label, lang)
      const tooltip = spec.tooltip ? resolveLocalizedText(spec.tooltip, lang) : label
      if (spec.kind === 'link' || spec.kind === 'button') {
        const node =
          spec.kind === 'link' ? document.createElement('a') : document.createElement('button')
        node.id = spec.domId
        node.className = 'd2-toolbar__btn'
        if (spec.kind === 'link') {
          const link = node as HTMLAnchorElement
          link.href = spec.href
          link.target = '_blank'
          link.rel = 'noopener'
        } else {
          const btn = node as HTMLButtonElement
          btn.type = 'button'
          btn.addEventListener('click', () => {
            spec.onClick()
          })
        }
        node.title = tooltip
        const resolvedIcon = this.resolveDefaultContributionIcon(spec.domId, spec.iconSvg)
        if (resolvedIcon) {
          const iconSpan = document.createElement('span')
          iconSpan.className = 'd2-toolbar__btn-icon'
          iconSpan.setAttribute('aria-hidden', 'true')
          iconSpan.innerHTML = resolvedIcon
          node.appendChild(iconSpan)
          iconEl = iconSpan
        }
        const lblSpan = document.createElement('span')
        lblSpan.className = 'd2-toolbar__btn-label'
        this.renderContributionLabel(lblSpan, label)
        node.appendChild(lblSpan)
        labelEl = lblSpan
        el = node
      } else {
        const group = document.createElement('div')
        group.id = spec.domId
        group.className = 'd2-toolbar__group'

        const lbl = document.createElement('label')
        lbl.className = 'd2-toolbar__label'
        lbl.htmlFor = spec.selectDomId
        lbl.textContent = label

        const sel = document.createElement('select')
        sel.id = spec.selectDomId
        sel.className = 'd2-toolbar__select'
        for (const optSpec of spec.options) {
          const opt = document.createElement('option')
          opt.value = optSpec.value
          opt.textContent = resolveLocalizedText(optSpec.label, lang)
          sel.appendChild(opt)
        }
        sel.value = spec.getValue()
        sel.addEventListener('change', () => {
          spec.onChange(sel.value)
        })

        group.appendChild(lbl)
        group.appendChild(sel)
        el = group
        labelEl = lbl
        selectEl = sel
      }
      if (existing?.el && existing.el.parentNode === this.pluginSlotEl) {
        if (typeof this.pluginSlotEl.replaceChild === 'function') {
          this.pluginSlotEl.replaceChild(el, existing.el)
        } else {
          const children = (this.pluginSlotEl as unknown as { children?: HTMLElement[] }).children
          const idx = Array.isArray(children) ? children.indexOf(existing.el) : -1
          if (idx >= 0 && Array.isArray(children)) {
            ;(existing.el as unknown as { parentNode: HTMLElement | null }).parentNode = null
            ;(el as unknown as { parentNode: HTMLElement | null }).parentNode = this.pluginSlotEl
            children[idx] = el
          } else {
            existing.el.remove()
            this.pluginSlotEl.appendChild(el)
          }
        }
      } else {
        existing?.el?.remove()
        this.pluginSlotEl.appendChild(el)
      }
    } else if (existing) {
      existing.el?.remove()
    }

    const entry: ContributionEntry = { spec, el, iconEl, labelEl, selectEl }
    this.contributions.set(spec.domId, entry)

    const dispose = (): void => {
      const current = this.contributions.get(spec.domId)
      if (current === entry) {
        current.el?.remove()
        this.contributions.delete(spec.domId)
      }
    }

    const update = (patch: ToolbarContributionPatch): void => {
      const current = this.contributions.get(spec.domId)
      if (!current) return
      current.spec = {
        ...current.spec,
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.tooltip !== undefined ? { tooltip: patch.tooltip } : {}),
        ...(patch.iconSvg !== undefined && current.spec.kind !== 'select'
          ? { iconSvg: patch.iconSvg }
          : {}),
      }
      this.syncDom()
    }

    return Object.assign(dispose, {
      dispose,
      update,
    })
  }

  setAssetCacheUsageBytes(bytes: number): void {
    this.cacheUsageBytes = Number.isFinite(bytes) && bytes > 0 ? bytes : 0
    this.syncDom()
  }

  async clearAssetCache(): Promise<number> {
    const res = await clearClientAssetCache()
    this.cacheUsageBytes = 0
    this.cacheClearedFlash = true
    this.syncDom()
    await this.callbacks.onClearCache?.()
    setTimeout(() => {
      this.cacheClearedFlash = false
      this.syncDom()
    }, 1500)
    return res.deletedEntries
  }

  getSnapshot(): ToolbarSnapshot {
    const settings = this.store.get()
    const lang = settings.lang || getGameLang()
    const statusKey = `toolbar.status.${this.connection.phase}` as const
    const statusLabel = tToolbar(statusKey, lang)
    const rttLabel =
      this.connection.phase === 'local' ? '' : this.connection.rttMs !== null ? `${this.connection.rttMs} ms` : '-- ms'

    let diagnosticBannerText: string | null = null
    const kind = this.connection.diagnosticKind ?? 'none'
    if (kind === 'quota_exceeded') {
      diagnosticBannerText = tToolbar('toolbar.diag.quotaExceeded', lang)
    } else if (kind === 'tls_error') {
      diagnosticBannerText = tToolbar('toolbar.diag.tlsError', lang)
    } else if (kind === 'bare_ip_on_https') {
      diagnosticBannerText =
        this.connection.diagnosticMessage ?? tToolbar('toolbar.diag.bareIpHttps', lang)
    } else if (kind === 'invalid_host' || kind === 'custom') {
      diagnosticBannerText = this.connection.diagnosticMessage ?? null
    }

    return {
      connection: this.connection,
      settings,
      viewportProfile: getViewportProfile(settings.viewport),
      allowedViewports: this.allowedViewports,
      statusLabel,
      rttLabel,
      diagnosticBannerText,
      serverInputValue: this.serverInputValue,
      serverInputValid: this.serverInputValid,
      configModalOpen: this.configModalOpen,
      bugModalOpen: this.bugModalOpen,
    }
  }

  destroy(): void {
    this.unsubscribeStore?.()
    this.unsubscribeStore = null
    this.unsubscribeLang?.()
    this.unsubscribeLang = null
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('keydown', this.handleWindowKeyDownCapture, true)
      window.removeEventListener('keydown', this.handleWindowKeyBubble, false)
      window.removeEventListener('keyup', this.handleWindowKeyBubble, false)
    }
    this.contributions.clear()
    this.fullscreen?.dispose()
    this.fullscreen = null
    if (this.rootEl && this.rootEl.parentNode) {
      this.rootEl.parentNode.removeChild(this.rootEl)
    }
    this.rootEl = null
  }

  private ensureStyles(doc: Document): void {
    if (!doc.head || doc.getElementById('d2-toolbar-styles')) return
    const styleEl = doc.createElement('style')
    styleEl.id = 'd2-toolbar-styles'
    styleEl.textContent = `
#d2-toolbar,
.d2-toolbar {
  position: relative;
  z-index: 1000;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  width: 100%;
  height: 32px;
  min-height: 32px;
  max-height: 32px;
  padding: 0 12px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #211b14 0%, #120f0a 55%, #0a0806 100%);
  border-bottom: 1px solid #634e2b;
  box-shadow: inset 0 1px 0 rgba(255, 226, 158, 0.14), 0 2px 8px rgba(0, 0, 0, 0.85);
  color: #e2cfa0;
  font-family: var(--font-body, "D2Formal436", "Noto Serif SC", "Songti SC", "PingFang SC", Georgia, serif);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  user-select: none;
}
.d2-toolbar__left,
.d2-toolbar__group {
  display: inline-flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
  white-space: nowrap;
}
.d2-toolbar__right {
  display: inline-flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
  margin-left: auto;
  white-space: nowrap;
}
.d2-toolbar__actions {
  gap: 5px;
}
.d2-toolbar > .d2-toolbar__group + .d2-toolbar__group {
  padding-left: 10px;
  border-left: 1px solid rgba(199, 179, 119, 0.2);
}
.d2-toolbar__divider {
  width: 1px;
  height: 18px;
  background: linear-gradient(180deg, rgba(199, 179, 119, 0.08) 0%, rgba(199, 179, 119, 0.48) 50%, rgba(199, 179, 119, 0.08) 100%);
  flex-shrink: 0;
}
.d2-toolbar__status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 22px;
  padding: 0 9px;
  box-sizing: border-box;
  border-radius: 3px;
  background: linear-gradient(180deg, #0e0b08 0%, #17130d 100%);
  border: 1px solid #463720;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.85), 0 1px 0 rgba(255, 226, 158, 0.06);
  color: #e4d4a8;
  font-size: 11.5px;
}
.d2-toolbar__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
  background: #6b6b6b;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
}
.d2-toolbar__status-dot--disconnected { background: #767676; }
.d2-toolbar__status-dot--connecting { background: #e6a822; box-shadow: 0 0 6px #e6a822; }
.d2-toolbar__status-dot--bncs { background: #4495e8; box-shadow: 0 0 6px #4495e8; }
.d2-toolbar__status-dot--mcp { background: #36c5d6; box-shadow: 0 0 6px #36c5d6; }
.d2-toolbar__status-dot--d2gs { background: #2ecc71; box-shadow: 0 0 6px #2ecc71; }
.d2-toolbar__status-dot--local { background: #d4a23c; box-shadow: 0 0 6px #d4a23c; }
.d2-toolbar__status-dot--error { background: #e74c3c; box-shadow: 0 0 6px #e74c3c; }
.d2-toolbar__rtt {
  padding-left: 6px;
  border-left: 1px solid #352a19;
  font-family: "JetBrains Mono", "Consolas", monospace;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: #a89974;
}
.d2-toolbar__label {
  color: #b89f65;
  font-family: var(--font-body, "D2Formal436", "Noto Serif SC", "Songti SC", Georgia, serif);
  font-size: 11.5px;
  letter-spacing: 0.03em;
}
.d2-toolbar__select {
  appearance: none;
  -webkit-appearance: none;
  height: 22px;
  padding: 0 22px 0 8px;
  box-sizing: border-box;
  background-color: #14100b;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23c7b377' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"),
    linear-gradient(180deg, #261f14 0%, #130f0a 100%);
  background-repeat: no-repeat, no-repeat;
  background-position: right 6px center, 0 0;
  border: 1px solid #5a482a;
  border-radius: 3px;
  box-shadow: inset 0 1px 0 rgba(255, 230, 165, 0.1), 0 1px 2px rgba(0, 0, 0, 0.55);
  color: #ebd9a8;
  font-family: "JetBrains Mono", "Consolas", var(--font-body, serif);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  outline: none;
}
.d2-toolbar__select option {
  background: #14100b;
  color: #ebd9a8;
}
.d2-toolbar__select:hover,
.d2-toolbar__btn:hover:not(:disabled) {
  border-color: #d4bc7c;
  color: #fff4ce;
  box-shadow: inset 0 1px 0 rgba(255, 240, 190, 0.22), 0 0 6px rgba(212, 180, 106, 0.2);
}
.d2-toolbar__btn,
a.d2-toolbar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 22px;
  padding: 0 9px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #2e2518 0%, #17120b 100%);
  border: 1px solid #5e4b2b;
  border-radius: 3px;
  box-shadow: inset 0 1px 0 rgba(255, 230, 165, 0.14), 0 1px 2px rgba(0, 0, 0, 0.55);
  color: #e6d29e;
  font-family: var(--font-body, "D2Formal436", "Noto Serif SC", "Songti SC", "PingFang SC", Georgia, serif);
  font-size: 11.5px;
  text-decoration: none;
  cursor: pointer;
}
.d2-toolbar__btn--icon {
  padding: 0 7px;
  min-width: 26px;
}
.d2-toolbar__btn--primary {
  background: linear-gradient(180deg, #5e4923 0%, #332711 100%);
  border-color: #c7a456;
  color: #fff5d6;
}
.d2-toolbar__btn:active:not(:disabled),
a.d2-toolbar__btn:active {
  transform: translateY(1px);
}
.d2-toolbar__btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  line-height: 0;
  color: #d4b872;
}
.d2-toolbar__btn-icon svg {
  width: 12px;
  height: 12px;
  display: block;
}
.d2-toolbar__btn-label {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}
.d2-toolbar__lang-badge {
  display: inline-flex;
  align-items: center;
  font-family: "JetBrains Mono", "Consolas", var(--font-body, serif);
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1;
  color: #efe1b6;
}
.d2-toolbar__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.d2-toolbar__btn--active {
  background: linear-gradient(180deg, #5e4923 0%, #332711 100%);
  border-color: #dfbe73;
  box-shadow: inset 0 1px 0 rgba(255, 244, 204, 0.32), 0 0 6px rgba(212, 180, 106, 0.25);
  color: #fff6db;
}
.d2-toolbar__btn--warn {
  border-color: #d4882a;
  color: #ffb84d;
}
.d2-toolbar__drop-prefix {
  margin-right: 4px;
}
.d2-toolbar__drop-set {
  color: #3ad649;
  font-family: "JetBrains Mono", "Consolas", monospace;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.d2-toolbar__drop-unique {
  color: #e2be68;
  font-family: "JetBrains Mono", "Consolas", monospace;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.d2-toolbar__drop-rune {
  color: #ff9c38;
  font-family: "JetBrains Mono", "Consolas", monospace;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.d2-toolbar__drop-sep {
  color: #7d6d4c;
  margin: 0 2px;
  font-family: "JetBrains Mono", "Consolas", monospace;
  font-size: 10px;
}
.d2-toolbar__diag {
  position: absolute;
  top: 32px;
  left: 12px;
  right: 12px;
  z-index: 1001;
  display: none;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(38, 12, 10, 0.96);
  border: 1px solid #a93226;
  border-top: none;
  border-radius: 0 0 4px 4px;
  color: #ffd6d1;
  font-size: 12px;
}
.d2-toolbar__diag--visible {
  display: flex;
}
.d2-toolbar-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
  background: rgba(4, 3, 2, 0.78);
  font-family: var(--font-body, "D2Formal436", "Noto Serif SC", "PingFang SC", Georgia, serif);
  color: #e6d6b0;
  white-space: normal;
  cursor: default;
}
.d2-toolbar-modal-overlay[hidden] {
  display: none !important;
}
.d2-toolbar-modal {
  width: 480px;
  max-width: 94vw;
  max-height: calc(100vh - 56px);
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #17130d 0%, #0b0906 100%);
  border: 1px solid #9c7c42;
  border-radius: 4px;
  box-shadow: 0 12px 42px rgba(0, 0, 0, 0.95), inset 0 0 18px rgba(156, 124, 66, 0.14);
  overflow: hidden;
}
.d2-toolbar-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
  border-bottom: 1px solid #4a3c24;
  background: rgba(27, 21, 14, 0.92);
  flex: 0 0 auto;
}
.d2-toolbar-modal__title {
  margin: 0;
  font-family: var(--font-display, "D2Exocet", "Cinzel", Georgia, serif);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #dfc478;
}
.d2-toolbar-modal__close {
  height: 24px;
  padding: 0 10px;
  background: linear-gradient(180deg, #2b2316 0%, #17120b 100%);
  border: 1px solid #6b5632;
  border-radius: 2px;
  color: #dfc991;
  font-family: var(--font-display, "D2Exocet", Georgia, serif);
  font-size: 11px;
  cursor: pointer;
}
.d2-toolbar-modal__close:hover {
  border-color: #d4b46a;
  color: #fff5d6;
}
.d2-toolbar-modal__subtitle {
  margin: 0;
  padding: 8px 16px;
  font-size: 12px;
  line-height: 1.4;
  color: #b5a178;
  background: rgba(16, 13, 9, 0.9);
  border-bottom: 1px solid #2e2517;
  flex: 0 0 auto;
}
.d2-toolbar-modal__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.d2-toolbar-modal__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  background: rgba(20, 16, 11, 0.72);
  border: 1px solid #352a19;
  border-radius: 3px;
}
.d2-toolbar-modal__row-label {
  color: #d8c28c;
  font-size: 12.5px;
  font-weight: 600;
}
.d2-toolbar-modal__row-control,
.d2-toolbar-modal__volume-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.d2-toolbar__slider {
  width: 120px;
  height: 6px;
  accent-color: #c7a456;
  cursor: pointer;
}
.d2-toolbar__volume-value {
  min-width: 36px;
  text-align: right;
  font-family: "JetBrains Mono", "Consolas", monospace;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: #ebd9a8;
}
.d2-toolbar-modal__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.d2-toolbar-modal__input,
.d2-toolbar-modal__textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 9px;
  background: #0d0a07;
  border: 1px solid #5a482a;
  border-radius: 3px;
  color: #efe1b6;
  font-family: var(--font-body, "D2Formal436", "Noto Serif SC", Georgia, serif);
  font-size: 12px;
  line-height: 1.45;
  outline: none;
  user-select: text;
}
.d2-toolbar-modal__input:focus,
.d2-toolbar-modal__textarea:focus {
  border-color: #d4bc7c;
  box-shadow: 0 0 6px rgba(212, 180, 106, 0.2);
}
.d2-toolbar-modal__textarea {
  resize: vertical;
  min-height: 84px;
}
.d2-toolbar-modal__select {
  width: 100%;
  height: 28px;
  font-size: 12px;
}
.d2-toolbar-modal__status {
  padding: 7px 10px;
  border-radius: 3px;
  font-size: 12px;
  line-height: 1.4;
}
.d2-toolbar-modal__status[hidden] {
  display: none !important;
}
.d2-toolbar-modal__status--ok {
  background: rgba(16, 48, 24, 0.9);
  border: 1px solid #2ecc71;
  color: #d4ffe4;
}
.d2-toolbar-modal__status--error {
  background: rgba(58, 16, 14, 0.92);
  border: 1px solid #e74c3c;
  color: #ffd6d1;
}
.d2-toolbar-modal__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid #352a19;
  background: rgba(18, 14, 10, 0.95);
}
.d2-toolbar__multibox-slot {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  max-width: 560px;
  overflow-x: auto;
  scrollbar-width: none;
}
.d2-toolbar__multibox-slot[hidden] {
  display: none !important;
}
.d2-multibox-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 7px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #1b150e 0%, #0f0c08 100%);
  border: 1px solid #4d3d22;
  border-radius: 3px;
  color: #cbb888;
  font-size: 11px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.d2-multibox-tab:hover {
  border-color: #8c703c;
  color: #f0dfaf;
}
.d2-multibox-tab--active {
  background: linear-gradient(180deg, #382a14 0%, #1d150a 100%);
  border-color: #d6b25e;
  color: #fff2c6;
  box-shadow: 0 0 6px rgba(214, 178, 94, 0.32);
}
.d2-multibox-tab--alert-damage {
  border-color: #e67e22;
  box-shadow: 0 0 6px rgba(230, 126, 34, 0.65);
}
.d2-multibox-tab--alert-low-hp,
.d2-multibox-tab--alert-dead {
  border-color: #e74c3c;
  background: linear-gradient(180deg, #4a1210 0%, #240807 100%);
  color: #ffd6d1;
  box-shadow: 0 0 8px rgba(231, 76, 60, 0.85);
}
.d2-multibox-tab__hp {
  width: 24px;
  height: 4px;
  background: #221010;
  border: 1px solid #552828;
  border-radius: 2px;
  overflow: hidden;
  display: inline-block;
}
.d2-multibox-tab__hp-fill {
  height: 100%;
  background: #c0392b;
  transition: width 120ms linear;
}
.d2-multibox-tab__speaker,
.d2-multibox-tab__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
  background: transparent;
  border: none;
  color: inherit;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.8;
}
.d2-multibox-tab__speaker:hover,
.d2-multibox-tab__close:hover {
  opacity: 1;
  color: #fff5d6;
}
.d2-multibox-add-btn {
  height: 22px;
  padding: 0 7px;
  font-size: 11px;
}
`
    doc.head.appendChild(styleEl)
  }

  private createFullscreenController(doc: Document): FullscreenController | null {
    const fsDoc = doc as Partial<FullscreenDocLike> & { documentElement?: HTMLElement | null }
    if (
      !fsDoc.documentElement ||
      typeof fsDoc.addEventListener !== 'function' ||
      typeof fsDoc.removeEventListener !== 'function' ||
      typeof fsDoc.exitFullscreen !== 'function'
    ) {
      return null
    }
    return new FullscreenController({
      doc: doc as unknown as FullscreenDocLike,
      target: fsDoc.documentElement,
      onChange: () => {
        this.syncDom()
      },
      onError: (kind, detail) => {
        const message = `${tToolbar('toolbar.fullscreen.failed', this.store.get().lang)} (${kind}): ${detail}`
        if (this.callbacks.onFullscreenError) {
          this.callbacks.onFullscreenError(message)
        } else {
          console.error('[toolbar]', message)
        }
        this.syncDom()
      },
    })
  }

  private mountDom(container: HTMLElement | null): void {
    const doc = document
    this.ensureStyles(doc)
    const root = doc.createElement('header')
    root.id = 'd2-toolbar'
    root.className = 'd2-toolbar'

    // Far Left: Plugins management button ([🧩 插件]) + Plugin Contribution Slot
    const pluginsBtn = doc.createElement('button')
    pluginsBtn.type = 'button'
    pluginsBtn.id = 'd2-toolbar-plugins-btn'
    pluginsBtn.className = 'd2-toolbar__btn'
    pluginsBtn.disabled = !this.pluginsReady
    const pluginsBtnIcon = doc.createElement('span')
    pluginsBtnIcon.className = 'd2-toolbar__btn-icon'
    pluginsBtnIcon.setAttribute('aria-hidden', 'true')
    pluginsBtnIcon.innerHTML = TOOLBAR_PLUGINS_ICON_SVG
    const pluginsBtnLabel = doc.createElement('span')
    pluginsBtnLabel.className = 'd2-toolbar__btn-label'
    pluginsBtn.appendChild(pluginsBtnIcon)
    pluginsBtn.appendChild(pluginsBtnLabel)
    pluginsBtn.addEventListener('click', () => {
      if (!this.pluginsReady) return
      this.closeModals()
      this.callbacks.onPluginsToggle?.()
    })

    const pluginSlot = doc.createElement('div')
    pluginSlot.id = 'd2-toolbar-plugin-slot'
    pluginSlot.className = 'd2-toolbar__group'

    // Far Right: Connection Status + Divider + 3 Icon Buttons (Language, Config, Bug Report)
    const rightContainer = doc.createElement('div')
    rightContainer.id = 'd2-toolbar-right'
    rightContainer.className = 'd2-toolbar__right'

    const statusGroup = doc.createElement('div')
    statusGroup.className = 'd2-toolbar__group'

    const statusBadge = doc.createElement('div')
    statusBadge.id = 'd2-toolbar-status'
    statusBadge.className = 'd2-toolbar__status'
    const dot = doc.createElement('span')
    dot.id = 'd2-toolbar-status-dot'
    dot.className = 'd2-toolbar__status-dot d2-toolbar__status-dot--disconnected'
    const statusText = doc.createElement('span')
    statusText.id = 'd2-toolbar-status-text'
    const rttText = doc.createElement('span')
    rttText.id = 'd2-toolbar-rtt'
    rttText.className = 'd2-toolbar__rtt'
    statusBadge.appendChild(dot)
    statusBadge.appendChild(statusText)
    statusBadge.appendChild(rttText)
    statusGroup.appendChild(statusBadge)

    const divider = doc.createElement('div')
    divider.className = 'd2-toolbar__divider'
    divider.setAttribute('role', 'separator')

    const actionsGroup = doc.createElement('div')
    actionsGroup.id = 'd2-toolbar-actions'
    actionsGroup.className = 'd2-toolbar__group d2-toolbar__actions'

    // Icon Button 1: Language Toggle (#d2-toolbar-lang-btn)
    const langBtn = doc.createElement('button')
    langBtn.type = 'button'
    langBtn.id = 'd2-toolbar-lang-btn'
    langBtn.className = 'd2-toolbar__btn d2-toolbar__btn--icon'
    const langBtnIcon = doc.createElement('span')
    langBtnIcon.className = 'd2-toolbar__btn-icon'
    langBtnIcon.setAttribute('aria-hidden', 'true')
    langBtnIcon.innerHTML = TOOLBAR_LANG_ICON_SVG
    const langBtnBadge = doc.createElement('span')
    langBtnBadge.id = 'd2-toolbar-lang-badge'
    langBtnBadge.className = 'd2-toolbar__lang-badge'
    langBtn.appendChild(langBtnIcon)
    langBtn.appendChild(langBtnBadge)
    langBtn.addEventListener('click', () => {
      this.toggleLanguage()
    })

    // Icon Button 2: Config Modal Toggle (#d2-toolbar-config-btn)
    const configBtn = doc.createElement('button')
    configBtn.type = 'button'
    configBtn.id = 'd2-toolbar-config-btn'
    configBtn.className = 'd2-toolbar__btn d2-toolbar__btn--icon'
    configBtn.setAttribute('aria-haspopup', 'dialog')
    configBtn.setAttribute('aria-expanded', 'false')
    const configBtnIcon = doc.createElement('span')
    configBtnIcon.className = 'd2-toolbar__btn-icon'
    configBtnIcon.setAttribute('aria-hidden', 'true')
    configBtnIcon.innerHTML = TOOLBAR_CONFIG_ICON_SVG
    configBtn.appendChild(configBtnIcon)
    configBtn.addEventListener('click', () => {
      this.toggleConfigModal()
    })

    // Icon Button 3: Bug Report Modal Toggle (#d2-toolbar-bug-btn)
    const bugBtn = doc.createElement('button')
    bugBtn.type = 'button'
    bugBtn.id = 'd2-toolbar-bug-btn'
    bugBtn.className = 'd2-toolbar__btn d2-toolbar__btn--icon'
    bugBtn.setAttribute('aria-haspopup', 'dialog')
    bugBtn.setAttribute('aria-expanded', 'false')
    const bugBtnIcon = doc.createElement('span')
    bugBtnIcon.className = 'd2-toolbar__btn-icon'
    bugBtnIcon.setAttribute('aria-hidden', 'true')
    bugBtnIcon.innerHTML = TOOLBAR_BUG_ICON_SVG
    bugBtn.appendChild(bugBtnIcon)
    bugBtn.addEventListener('click', () => {
      this.toggleBugModal()
    })

    actionsGroup.appendChild(langBtn)
    actionsGroup.appendChild(configBtn)
    actionsGroup.appendChild(bugBtn)

    // Multibox Tab Slot (#d2-multibox-slot, hidden when multiboxEnabled === false)
    const multiboxSlot = doc.createElement('div')
    multiboxSlot.id = 'd2-multibox-slot'
    multiboxSlot.className = 'd2-toolbar__group d2-toolbar__multibox-slot'
    multiboxSlot.hidden = !(this.store.get().multiboxEnabled ?? false)

    rightContainer.appendChild(multiboxSlot)
    rightContainer.appendChild(statusGroup)
    rightContainer.appendChild(divider)
    rightContainer.appendChild(actionsGroup)

    // Modal 1: Configuration Modal (#d2-config-modal-overlay)
    const configOverlay = doc.createElement('div')
    configOverlay.id = 'd2-config-modal-overlay'
    configOverlay.className = 'd2-toolbar-modal-overlay'
    configOverlay.setAttribute('data-d2-modal-overlay', 'config')
    configOverlay.hidden = true
    configOverlay.addEventListener('click', (ev) => {
      const target = (ev as unknown as { target?: unknown }).target
      if (target === configOverlay) {
        this.closeConfigModal()
      }
    })

    const configDialog = doc.createElement('div')
    configDialog.id = 'd2-config-modal'
    configDialog.className = 'd2-toolbar-modal'
    configDialog.setAttribute('role', 'dialog')
    configDialog.setAttribute('aria-modal', 'true')
    configDialog.setAttribute('aria-labelledby', 'd2-config-modal-title')

    const configHeader = doc.createElement('div')
    configHeader.className = 'd2-toolbar-modal__header'
    const configTitle = doc.createElement('h2')
    configTitle.id = 'd2-config-modal-title'
    configTitle.className = 'd2-toolbar-modal__title'
    const configCloseBtn = doc.createElement('button')
    configCloseBtn.type = 'button'
    configCloseBtn.id = 'd2-config-modal-close'
    configCloseBtn.className = 'd2-toolbar-modal__close'
    configCloseBtn.addEventListener('click', () => {
      this.closeConfigModal()
    })
    configHeader.appendChild(configTitle)
    configHeader.appendChild(configCloseBtn)

    const configSubtitle = doc.createElement('p')
    configSubtitle.id = 'd2-config-modal-subtitle'
    configSubtitle.className = 'd2-toolbar-modal__subtitle'

    const configBody = doc.createElement('div')
    configBody.className = 'd2-toolbar-modal__body'

    // Config Row 1: Display Mode (Fullscreen / Windowed)
    const displayRow = doc.createElement('div')
    displayRow.className = 'd2-toolbar-modal__row'
    const displayModeLabel = doc.createElement('span')
    displayModeLabel.id = 'd2-config-fullscreen-label'
    displayModeLabel.className = 'd2-toolbar-modal__row-label'
    const fullscreenBtn = doc.createElement('button')
    fullscreenBtn.type = 'button'
    fullscreenBtn.id = 'd2-toolbar-fullscreen-btn'
    fullscreenBtn.className = 'd2-toolbar__btn'
    const fullscreenBtnIcon = doc.createElement('span')
    fullscreenBtnIcon.className = 'd2-toolbar__btn-icon'
    fullscreenBtnIcon.setAttribute('aria-hidden', 'true')
    const fullscreenBtnLabel = doc.createElement('span')
    fullscreenBtnLabel.className = 'd2-toolbar__btn-label'
    fullscreenBtn.appendChild(fullscreenBtnIcon)
    fullscreenBtn.appendChild(fullscreenBtnLabel)
    this.fullscreen = this.createFullscreenController(doc)
    fullscreenBtn.addEventListener('click', () => {
      this.fullscreen?.toggle()
    })
    displayRow.appendChild(displayModeLabel)
    displayRow.appendChild(fullscreenBtn)

    // Config Row 2: Resolution (#d2-toolbar-viewport-select)
    const viewportRow = doc.createElement('div')
    viewportRow.className = 'd2-toolbar-modal__row'
    const viewportLabel = doc.createElement('label')
    viewportLabel.id = 'd2-config-viewport-label'
    viewportLabel.className = 'd2-toolbar__label d2-toolbar-modal__row-label'
    viewportLabel.htmlFor = 'd2-toolbar-viewport-select'
    const viewportSelect = doc.createElement('select')
    viewportSelect.id = 'd2-toolbar-viewport-select'
    viewportSelect.className = 'd2-toolbar__select'
    viewportSelect.addEventListener('change', () => {
      this.setViewport(viewportSelect.value as ViewportResolution)
    })
    viewportRow.appendChild(viewportLabel)
    viewportRow.appendChild(viewportSelect)

    // Config Row 3: Frame Rate (#d2-toolbar-worldfps-select)
    const fpsRow = doc.createElement('div')
    fpsRow.className = 'd2-toolbar-modal__row'
    const fpsLabel = doc.createElement('label')
    fpsLabel.id = 'd2-config-fps-label'
    fpsLabel.className = 'd2-toolbar__label d2-toolbar-modal__row-label'
    fpsLabel.htmlFor = 'd2-toolbar-worldfps-select'
    const fpsSelect = doc.createElement('select')
    fpsSelect.id = 'd2-toolbar-worldfps-select'
    fpsSelect.className = 'd2-toolbar__select'
    for (const fps of [60, 30] as const) {
      const opt = doc.createElement('option')
      opt.value = String(fps)
      opt.textContent = `${fps} FPS`
      fpsSelect.appendChild(opt)
    }
    fpsSelect.addEventListener('change', () => {
      this.store.set({ worldRenderFps: fpsSelect.value === '30' ? 30 : 60 })
    })
    fpsRow.appendChild(fpsLabel)
    fpsRow.appendChild(fpsSelect)

    // Config Row 4: Battle.net Server (#d2-config-server-row, #d2-toolbar-server-input, #d2-toolbar-server-apply-btn)
    const serverRow = doc.createElement('div')
    serverRow.id = 'd2-config-server-row'
    serverRow.className = 'd2-toolbar-modal__row'
    const serverLabel = doc.createElement('label')
    serverLabel.id = 'd2-config-server-label'
    serverLabel.className = 'd2-toolbar__label d2-toolbar-modal__row-label'
    serverLabel.htmlFor = 'd2-toolbar-server-input'

    const serverControls = doc.createElement('div')
    serverControls.className = 'd2-toolbar-modal__row-control'

    const serverInput = doc.createElement('input')
    serverInput.type = 'text'
    serverInput.id = 'd2-toolbar-server-input'
    serverInput.className = 'd2-toolbar-modal__input'
    serverInput.style.width = '180px'
    serverInput.setAttribute('maxlength', '120')
    serverInput.setAttribute('spellcheck', 'false')
    serverInput.setAttribute('autocomplete', 'off')
    serverInput.value = this.serverInputValue || this.store.get().serverHost

    const serverApplyBtn = doc.createElement('button')
    serverApplyBtn.type = 'button'
    serverApplyBtn.id = 'd2-toolbar-server-apply-btn'
    serverApplyBtn.className = 'd2-toolbar__btn'

    serverControls.appendChild(serverInput)
    serverControls.appendChild(serverApplyBtn)
    serverRow.appendChild(serverLabel)
    serverRow.appendChild(serverControls)

    const serverStatus = doc.createElement('div')
    serverStatus.id = 'd2-toolbar-server-status'
    serverStatus.className = 'd2-toolbar-modal__status d2-toolbar-modal__status--error'
    serverStatus.setAttribute('role', 'alert')
    serverStatus.hidden = true

    serverApplyBtn.addEventListener('click', () => {
      this.submitServerHost(serverInput.value)
    })
    serverInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault?.()
        this.submitServerHost(serverInput.value)
      }
    })
    serverInput.addEventListener('input', () => {
      this.serverInputValue = serverInput.value
      if (!this.serverInputValid) {
        this.serverInputValid = true
        serverStatus.hidden = true
        serverInput.style.borderColor = ''
        serverInput.style.boxShadow = ''
      }
    })

    // Config Row 5: Master Volume + Mute (#d2-toolbar-mute-btn, #d2-toolbar-volume-slider, #d2-toolbar-volume-value)
    const volumeRow = doc.createElement('div')
    volumeRow.className = 'd2-toolbar-modal__row'
    const volumeLabel = doc.createElement('label')
    volumeLabel.id = 'd2-config-volume-label'
    volumeLabel.className = 'd2-toolbar__label d2-toolbar-modal__row-label'
    volumeLabel.htmlFor = 'd2-toolbar-volume-slider'
    const volumeControls = doc.createElement('div')
    volumeControls.className = 'd2-toolbar-modal__volume-controls'

    const muteBtn = doc.createElement('button')
    muteBtn.type = 'button'
    muteBtn.id = 'd2-toolbar-mute-btn'
    muteBtn.className = 'd2-toolbar__btn'
    const muteBtnIcon = doc.createElement('span')
    muteBtnIcon.className = 'd2-toolbar__btn-icon'
    muteBtnIcon.setAttribute('aria-hidden', 'true')
    const muteBtnLabel = doc.createElement('span')
    muteBtnLabel.className = 'd2-toolbar__btn-label'
    muteBtn.appendChild(muteBtnIcon)
    muteBtn.appendChild(muteBtnLabel)
    muteBtn.addEventListener('click', () => {
      this.toggleAudioMuted()
    })

    const volumeSlider = doc.createElement('input')
    volumeSlider.type = 'range'
    volumeSlider.id = 'd2-toolbar-volume-slider'
    volumeSlider.className = 'd2-toolbar__slider'
    volumeSlider.setAttribute('min', '0')
    volumeSlider.setAttribute('max', '100')
    volumeSlider.setAttribute('step', '1')
    const onVolumeInput = (): void => {
      const pct = Number(volumeSlider.value)
      if (Number.isFinite(pct)) {
        this.setMasterVolume(pct / 100)
      }
    }
    volumeSlider.addEventListener('input', onVolumeInput)
    volumeSlider.addEventListener('change', onVolumeInput)

    const volumeValue = doc.createElement('span')
    volumeValue.id = 'd2-toolbar-volume-value'
    volumeValue.className = 'd2-toolbar__volume-value'

    volumeControls.appendChild(muteBtn)
    volumeControls.appendChild(volumeSlider)
    volumeControls.appendChild(volumeValue)
    volumeRow.appendChild(volumeLabel)
    volumeRow.appendChild(volumeControls)

    // Config Row 5: Asset Cache Clear (#d2-toolbar-cache-clear-btn)
    const cacheRow = doc.createElement('div')
    cacheRow.className = 'd2-toolbar-modal__row'
    const cacheRowLabel = doc.createElement('span')
    cacheRowLabel.id = 'd2-config-cache-label'
    cacheRowLabel.className = 'd2-toolbar-modal__row-label'
    const cacheClearBtn = doc.createElement('button')
    cacheClearBtn.type = 'button'
    cacheClearBtn.id = 'd2-toolbar-cache-clear-btn'
    cacheClearBtn.className = 'd2-toolbar__btn'
    const cacheClearBtnIcon = doc.createElement('span')
    cacheClearBtnIcon.className = 'd2-toolbar__btn-icon'
    cacheClearBtnIcon.setAttribute('aria-hidden', 'true')
    cacheClearBtnIcon.innerHTML = TOOLBAR_CACHE_CLEAR_ICON_SVG
    const cacheClearBtnLabel = doc.createElement('span')
    cacheClearBtnLabel.className = 'd2-toolbar__btn-label'
    cacheClearBtn.appendChild(cacheClearBtnIcon)
    cacheClearBtn.appendChild(cacheClearBtnLabel)
    cacheClearBtn.addEventListener('click', () => {
      void this.clearAssetCache()
    })
    cacheRow.appendChild(cacheRowLabel)
    cacheRow.appendChild(cacheClearBtn)

    // Config Row 6: Single-Tab Multibox (#1362 / #1363, default disabled)
    const multiboxRow = doc.createElement('div')
    multiboxRow.id = 'd2-config-multibox-row'
    multiboxRow.className = 'd2-toolbar-modal__row'
    const multiboxRowLabel = doc.createElement('span')
    multiboxRowLabel.id = 'd2-config-multibox-label'
    multiboxRowLabel.className = 'd2-toolbar-modal__row-label'
    const multiboxControls = doc.createElement('div')
    multiboxControls.className = 'd2-toolbar-modal__row-control'
    const multiboxToggleBtn = doc.createElement('button')
    multiboxToggleBtn.type = 'button'
    multiboxToggleBtn.id = 'd2-toolbar-multibox-btn'
    multiboxToggleBtn.className = 'd2-toolbar__btn'
    multiboxToggleBtn.addEventListener('click', () => {
      this.toggleMultiboxEnabled()
    })
    const multiboxAlertBtn = doc.createElement('button')
    multiboxAlertBtn.type = 'button'
    multiboxAlertBtn.id = 'd2-toolbar-multibox-alert-btn'
    multiboxAlertBtn.className = 'd2-toolbar__btn'
    multiboxAlertBtn.addEventListener('click', () => {
      this.toggleMultiboxAlertSoundEnabled()
    })
    multiboxControls.appendChild(multiboxToggleBtn)
    multiboxControls.appendChild(multiboxAlertBtn)
    multiboxRow.appendChild(multiboxRowLabel)
    multiboxRow.appendChild(multiboxControls)

    configBody.appendChild(displayRow)
    configBody.appendChild(viewportRow)
    configBody.appendChild(fpsRow)
    configBody.appendChild(serverRow)
    configBody.appendChild(serverStatus)
    configBody.appendChild(volumeRow)
    configBody.appendChild(multiboxRow)
    configBody.appendChild(cacheRow)

    configDialog.appendChild(configHeader)
    configDialog.appendChild(configSubtitle)
    configDialog.appendChild(configBody)
    configOverlay.appendChild(configDialog)

    // Modal 2: Bug Report Modal (#d2-bug-modal-overlay)
    const bugOverlay = doc.createElement('div')
    bugOverlay.id = 'd2-bug-modal-overlay'
    bugOverlay.className = 'd2-toolbar-modal-overlay'
    bugOverlay.setAttribute('data-d2-modal-overlay', 'bug-report')
    bugOverlay.hidden = true
    bugOverlay.addEventListener('click', (ev) => {
      const target = (ev as unknown as { target?: unknown }).target
      if (target === bugOverlay) {
        this.closeBugModal()
      }
    })

    const bugDialog = doc.createElement('div')
    bugDialog.id = 'd2-bug-modal'
    bugDialog.className = 'd2-toolbar-modal'
    bugDialog.setAttribute('role', 'dialog')
    bugDialog.setAttribute('aria-modal', 'true')
    bugDialog.setAttribute('aria-labelledby', 'd2-bug-modal-title')

    const bugHeader = doc.createElement('div')
    bugHeader.className = 'd2-toolbar-modal__header'
    const bugTitle = doc.createElement('h2')
    bugTitle.id = 'd2-bug-modal-title'
    bugTitle.className = 'd2-toolbar-modal__title'
    const bugCloseBtn = doc.createElement('button')
    bugCloseBtn.type = 'button'
    bugCloseBtn.id = 'd2-bug-modal-close'
    bugCloseBtn.className = 'd2-toolbar-modal__close'
    bugCloseBtn.addEventListener('click', () => {
      this.closeBugModal()
    })
    bugHeader.appendChild(bugTitle)
    bugHeader.appendChild(bugCloseBtn)

    const bugSubtitle = doc.createElement('p')
    bugSubtitle.id = 'd2-bug-modal-subtitle'
    bugSubtitle.className = 'd2-toolbar-modal__subtitle'

    const bugBody = doc.createElement('div')
    bugBody.className = 'd2-toolbar-modal__body'

    const titleField = doc.createElement('div')
    titleField.className = 'd2-toolbar-modal__field'
    const bugTitleLabel = doc.createElement('label')
    bugTitleLabel.id = 'd2-bug-title-label'
    bugTitleLabel.className = 'd2-toolbar__label d2-toolbar-modal__row-label'
    bugTitleLabel.htmlFor = 'd2-bug-title-input'
    const bugTitleInput = doc.createElement('input')
    bugTitleInput.type = 'text'
    bugTitleInput.id = 'd2-bug-title-input'
    bugTitleInput.className = 'd2-toolbar-modal__input'
    bugTitleInput.setAttribute('maxlength', '120')
    titleField.appendChild(bugTitleLabel)
    titleField.appendChild(bugTitleInput)

    const categoryField = doc.createElement('div')
    categoryField.className = 'd2-toolbar-modal__field'
    const bugCategoryLabel = doc.createElement('label')
    bugCategoryLabel.id = 'd2-bug-category-label'
    bugCategoryLabel.className = 'd2-toolbar__label d2-toolbar-modal__row-label'
    bugCategoryLabel.htmlFor = 'd2-bug-category-select'
    const bugCategorySelect = doc.createElement('select')
    bugCategorySelect.id = 'd2-bug-category-select'
    bugCategorySelect.className = 'd2-toolbar__select d2-toolbar-modal__select'
    for (const cat of BUG_REPORT_CATEGORIES) {
      const opt = doc.createElement('option')
      opt.value = cat
      bugCategorySelect.appendChild(opt)
    }
    bugCategorySelect.value = 'gameplay'
    categoryField.appendChild(bugCategoryLabel)
    categoryField.appendChild(bugCategorySelect)

    const descField = doc.createElement('div')
    descField.className = 'd2-toolbar-modal__field'
    const bugDescLabel = doc.createElement('label')
    bugDescLabel.id = 'd2-bug-desc-label'
    bugDescLabel.className = 'd2-toolbar__label d2-toolbar-modal__row-label'
    bugDescLabel.htmlFor = 'd2-bug-desc-input'
    const bugDescInput = doc.createElement('textarea')
    bugDescInput.id = 'd2-bug-desc-input'
    bugDescInput.className = 'd2-toolbar-modal__textarea'
    bugDescInput.setAttribute('rows', '4')
    bugDescInput.setAttribute('maxlength', '4000')
    descField.appendChild(bugDescLabel)
    descField.appendChild(bugDescInput)

    const bugStatusMsg = doc.createElement('div')
    bugStatusMsg.id = 'd2-bug-status-msg'
    bugStatusMsg.className = 'd2-toolbar-modal__status'
    bugStatusMsg.setAttribute('role', 'status')
    bugStatusMsg.hidden = true

    bugBody.appendChild(titleField)
    bugBody.appendChild(categoryField)
    bugBody.appendChild(descField)
    bugBody.appendChild(bugStatusMsg)

    const bugFooter = doc.createElement('div')
    bugFooter.className = 'd2-toolbar-modal__footer'
    const bugCancelBtn = doc.createElement('button')
    bugCancelBtn.type = 'button'
    bugCancelBtn.id = 'd2-bug-cancel-btn'
    bugCancelBtn.className = 'd2-toolbar__btn'
    bugCancelBtn.addEventListener('click', () => {
      this.closeBugModal()
    })
    const bugSubmitBtn = doc.createElement('button')
    bugSubmitBtn.type = 'button'
    bugSubmitBtn.id = 'd2-bug-submit-btn'
    bugSubmitBtn.className = 'd2-toolbar__btn d2-toolbar__btn--primary'
    bugSubmitBtn.addEventListener('click', () => {
      void this.submitBugReport()
    })
    bugFooter.appendChild(bugCancelBtn)
    bugFooter.appendChild(bugSubmitBtn)

    bugDialog.appendChild(bugHeader)
    bugDialog.appendChild(bugSubtitle)
    bugDialog.appendChild(bugBody)
    bugDialog.appendChild(bugFooter)
    bugOverlay.appendChild(bugDialog)

    // Diagnostic Banner
    const diagBanner = doc.createElement('div')
    diagBanner.id = 'd2-toolbar-diag-banner'
    diagBanner.className = 'd2-toolbar__diag'
    diagBanner.hidden = true

    root.appendChild(pluginsBtn)
    root.appendChild(pluginSlot)
    root.appendChild(rightContainer)
    root.appendChild(configOverlay)
    root.appendChild(bugOverlay)
    root.appendChild(diagBanner)

    const g = globalThis as Record<string, unknown>
    if (typeof g.Node === 'undefined') {
      class NodeShim {
        static readonly DOCUMENT_POSITION_DISCONNECTED = 1
        static readonly DOCUMENT_POSITION_PRECEDING = 2
        static readonly DOCUMENT_POSITION_FOLLOWING = 4
        static readonly DOCUMENT_POSITION_CONTAINS = 8
        static readonly DOCUMENT_POSITION_CONTAINED_BY = 16
        static readonly DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC = 32
      }
      g.Node = NodeShim
    }
    if (
      typeof (root as unknown as { compareDocumentPosition?: unknown }).compareDocumentPosition !==
      'function'
    ) {
      type TreeNode = {
        parentNode?: TreeNode | null
        childNodes?: TreeNode[]
        children?: TreeNode[]
      }
      const compareDocPos = function (this: TreeNode, other: unknown): number {
        if (!other || this === other) return 0
        let top: TreeNode = this
        while (top.parentNode) {
          top = top.parentNode
        }
        const order: TreeNode[] = []
        const walk = (n: TreeNode): void => {
          order.push(n)
          const kids = n.childNodes ?? n.children ?? []
          if (Array.isArray(kids)) {
            for (const c of kids) {
              walk(c)
            }
          }
        }
        walk(top)
        const selfIdx = order.indexOf(this)
        const otherIdx = order.indexOf(other as TreeNode)
        if (selfIdx < 0 || otherIdx < 0) return 1
        return otherIdx > selfIdx ? 4 : 2
      }
      const proto = Object.getPrototypeOf(root) as Record<string, unknown> | null
      if (proto && proto !== Object.prototype) {
        proto.compareDocumentPosition = compareDocPos
      }
      const attachCompare = (node: unknown): void => {
        if (!node || typeof node !== 'object') return
        const rec = node as Record<string, unknown>
        if (typeof rec.compareDocumentPosition !== 'function') {
          rec.compareDocumentPosition = compareDocPos
        }
        const kids = (rec.childNodes ?? rec.children) as unknown[] | undefined
        if (Array.isArray(kids)) {
          for (const k of kids) attachCompare(k)
        }
      }
      attachCompare(root)
    }

    if (container) {
      container.innerHTML = ''
      container.appendChild(root)
    }

    this.rootEl = root
    this.statusDotEl = dot
    this.statusTextEl = statusText
    this.rttTextEl = rttText
    this.langBtnEl = langBtn
    this.langBtnIconEl = langBtnIcon
    this.langBtnBadgeEl = langBtnBadge
    this.configBtnEl = configBtn
    this.configBtnIconEl = configBtnIcon
    this.bugBtnEl = bugBtn
    this.bugBtnIconEl = bugBtnIcon

    this.configOverlayEl = configOverlay
    this.configTitleEl = configTitle
    this.configSubtitleEl = configSubtitle
    this.configCloseBtnEl = configCloseBtn
    this.displayModeLabelEl = displayModeLabel
    this.viewportLabelEl = viewportLabel
    this.viewportSelectEl = viewportSelect
    this.fpsLabelEl = fpsLabel
    this.worldFpsSelectEl = fpsSelect
    this.volumeLabelEl = volumeLabel
    this.muteBtnEl = muteBtn
    this.muteBtnIconEl = muteBtnIcon
    this.muteBtnLabelEl = muteBtnLabel
    this.volumeSliderEl = volumeSlider
    this.volumeValueEl = volumeValue
    this.cacheRowLabelEl = cacheRowLabel
    this.fullscreenBtnEl = fullscreenBtn
    this.fullscreenBtnIconEl = fullscreenBtnIcon
    this.fullscreenBtnLabelEl = fullscreenBtnLabel
    this.cacheClearBtnEl = cacheClearBtn
    this.cacheClearBtnIconEl = cacheClearBtnIcon
    this.cacheClearBtnLabelEl = cacheClearBtnLabel
    this.serverRowEl = serverRow
    this.serverLabelEl = serverLabel
    this.serverInputEl = serverInput
    this.serverApplyBtnEl = serverApplyBtn
    this.serverStatusEl = serverStatus
    this.multiboxSlotEl = multiboxSlot
    this.multiboxRowLabelEl = multiboxRowLabel
    this.multiboxToggleBtnEl = multiboxToggleBtn
    this.multiboxAlertBtnEl = multiboxAlertBtn

    this.bugOverlayEl = bugOverlay
    this.bugTitleEl = bugTitle
    this.bugSubtitleEl = bugSubtitle
    this.bugCloseBtnEl = bugCloseBtn
    this.bugTitleLabelEl = bugTitleLabel
    this.bugTitleInputEl = bugTitleInput
    this.bugCategoryLabelEl = bugCategoryLabel
    this.bugCategorySelectEl = bugCategorySelect
    this.bugDescLabelEl = bugDescLabel
    this.bugDescInputEl = bugDescInput
    this.bugStatusMsgEl = bugStatusMsg
    this.bugCancelBtnEl = bugCancelBtn
    this.bugSubmitBtnEl = bugSubmitBtn

    this.pluginsBtnEl = pluginsBtn
    this.pluginsBtnIconEl = pluginsBtnIcon
    this.pluginsBtnLabelEl = pluginsBtnLabel
    this.pluginSlotEl = pluginSlot
    this.diagBannerEl = diagBanner

    this.syncDom()
  }

  private syncDom(): void {
    if (!this.rootEl) return
    const snap = this.getSnapshot()
    const lang = snap.settings.lang

    if (this.statusDotEl) {
      this.statusDotEl.className = `d2-toolbar__status-dot d2-toolbar__status-dot--${snap.connection.phase}`
    }
    if (this.statusTextEl) {
      this.statusTextEl.textContent = snap.statusLabel
    }
    if (this.rttTextEl) {
      this.rttTextEl.textContent = snap.rttLabel
      this.rttTextEl.hidden = snap.rttLabel === ''
    }
    if (this.pluginsBtnEl) {
      const baseLabel = tToolbar('toolbar.plugins.open', lang)
      const fullLabel = this.pluginsHasWarning ? `${baseLabel} ⚠` : baseLabel
      this.pluginsBtnEl.disabled = !this.pluginsReady
      if (this.pluginsBtnLabelEl) {
        this.pluginsBtnLabelEl.textContent = fullLabel
      } else {
        this.pluginsBtnEl.textContent = fullLabel
      }
      this.pluginsBtnEl.title = baseLabel
      this.pluginsBtnEl.setAttribute('aria-expanded', this.pluginsMenuOpen ? 'true' : 'false')
      this.pluginsBtnEl.setAttribute('aria-haspopup', 'dialog')
      let cls = 'd2-toolbar__btn'
      if (this.pluginsMenuOpen) cls += ' d2-toolbar__btn--active'
      if (this.pluginsHasWarning) cls += ' d2-toolbar__btn--warn'
      this.pluginsBtnEl.className = cls
    }
    for (const entry of this.contributions.values()) {
      if (!entry.el) continue
      const spec = entry.spec
      const label = resolveLocalizedText(spec.label, lang)
      if (spec.kind === 'select') {
        if (entry.labelEl) {
          entry.labelEl.textContent = label
        }
        if (entry.selectEl && typeof document !== 'undefined') {
          const currentOpts = Array.from(entry.selectEl.options)
          if (
            currentOpts.length !== spec.options.length ||
            currentOpts.some((o, idx) => o.value !== spec.options[idx]?.value)
          ) {
            entry.selectEl.innerHTML = ''
            for (const optSpec of spec.options) {
              const opt = document.createElement('option')
              opt.value = optSpec.value
              opt.textContent = resolveLocalizedText(optSpec.label, lang)
              entry.selectEl.appendChild(opt)
            }
          } else {
            for (let idx = 0; idx < spec.options.length; idx += 1) {
              const optSpec = spec.options[idx]!
              const optEl = currentOpts[idx]
              if (optEl) {
                optEl.textContent = resolveLocalizedText(optSpec.label, lang)
              }
            }
          }
          entry.selectEl.value = spec.getValue()
        }
      } else {
        const tooltip = spec.tooltip ? resolveLocalizedText(spec.tooltip, lang) : label
        const resolvedIcon = this.resolveDefaultContributionIcon(spec.domId, spec.iconSvg)
        if (entry.iconEl && resolvedIcon) {
          entry.iconEl.innerHTML = resolvedIcon
        }
        if (entry.labelEl) {
          if (entry.labelEl.parentNode !== entry.el) {
            entry.el.textContent = ''
            if (entry.iconEl && resolvedIcon) {
              entry.el.appendChild(entry.iconEl)
            }
            entry.el.appendChild(entry.labelEl)
          }
          this.renderContributionLabel(entry.labelEl, label)
        } else {
          entry.el.textContent = label
        }
        entry.el.title = tooltip
      }
    }

    // Right Icon Buttons: Language, Config, Bug Report
    if (this.langBtnEl) {
      const langTitle = tToolbar('toolbar.lang.toggle', lang)
      const badgeText = lang === 'en' ? tToolbar('toolbar.lang.en', lang) : tToolbar('toolbar.lang.zh', lang)
      if (this.langBtnIconEl) {
        this.langBtnIconEl.innerHTML = TOOLBAR_LANG_ICON_SVG
      }
      if (this.langBtnBadgeEl) {
        this.langBtnBadgeEl.textContent = badgeText
      }
      this.langBtnEl.title = langTitle
      this.langBtnEl.setAttribute('aria-label', langTitle)
      this.langBtnEl.setAttribute('data-lang', lang)
    }
    if (this.configBtnEl) {
      const cfgTitle = tToolbar('toolbar.config.open', lang)
      if (this.configBtnIconEl) {
        this.configBtnIconEl.innerHTML = TOOLBAR_CONFIG_ICON_SVG
      }
      this.configBtnEl.title = cfgTitle
      this.configBtnEl.setAttribute('aria-label', cfgTitle)
      this.configBtnEl.setAttribute('aria-expanded', this.configModalOpen ? 'true' : 'false')
      this.configBtnEl.className = this.configModalOpen
        ? 'd2-toolbar__btn d2-toolbar__btn--icon d2-toolbar__btn--active'
        : 'd2-toolbar__btn d2-toolbar__btn--icon'
    }
    if (this.bugBtnEl) {
      const bugTitle = tToolbar('toolbar.bug.open', lang)
      if (this.bugBtnIconEl) {
        this.bugBtnIconEl.innerHTML = TOOLBAR_BUG_ICON_SVG
      }
      this.bugBtnEl.title = bugTitle
      this.bugBtnEl.setAttribute('aria-label', bugTitle)
      this.bugBtnEl.setAttribute('aria-expanded', this.bugModalOpen ? 'true' : 'false')
      this.bugBtnEl.className = this.bugModalOpen
        ? 'd2-toolbar__btn d2-toolbar__btn--icon d2-toolbar__btn--active'
        : 'd2-toolbar__btn d2-toolbar__btn--icon'
    }

    // Config Modal Sync
    if (this.configOverlayEl) {
      this.configOverlayEl.hidden = !this.configModalOpen
    }
    if (this.configTitleEl) {
      this.configTitleEl.textContent = tToolbar('toolbar.config.title', lang)
    }
    if (this.configSubtitleEl) {
      this.configSubtitleEl.textContent = tToolbar('toolbar.config.subtitle', lang)
    }
    if (this.configCloseBtnEl) {
      this.configCloseBtnEl.textContent = tToolbar('toolbar.config.close', lang)
    }
    if (this.displayModeLabelEl) {
      this.displayModeLabelEl.textContent = tToolbar('toolbar.config.displayMode', lang)
    }
    if (this.viewportLabelEl) {
      this.viewportLabelEl.textContent = tToolbar('toolbar.viewport.label', lang)
    }
    if (this.fpsLabelEl) {
      this.fpsLabelEl.textContent = tToolbar('toolbar.config.fps', lang)
    }
    if (this.serverLabelEl) {
      this.serverLabelEl.textContent = tToolbar('toolbar.server.label', lang)
    }
    if (this.serverApplyBtnEl) {
      this.serverApplyBtnEl.textContent = tToolbar('toolbar.server.apply', lang)
    }
    if (this.serverInputEl) {
      if (typeof document !== 'undefined' && document.activeElement !== this.serverInputEl) {
        this.serverInputEl.value = this.serverInputValue || snap.settings.serverHost
      }
      this.serverInputEl.setAttribute(
        'placeholder',
        tToolbar('toolbar.server.placeholder', lang),
      )
      this.serverInputEl.title = this.serverInputValue || snap.settings.serverHost
      if (!this.serverInputValid) {
        this.serverInputEl.style.borderColor = '#e74c3c'
        this.serverInputEl.style.boxShadow = '0 0 6px rgba(231, 76, 60, 0.4)'
      } else {
        this.serverInputEl.style.borderColor = ''
        this.serverInputEl.style.boxShadow = ''
      }
    }
    if (this.serverStatusEl) {
      if (!this.serverInputValid && this.connection.diagnosticMessage) {
        this.serverStatusEl.textContent = this.connection.diagnosticMessage
        this.serverStatusEl.hidden = false
      } else {
        this.serverStatusEl.textContent = ''
        this.serverStatusEl.hidden = true
      }
    }
    if (this.volumeLabelEl) {
      this.volumeLabelEl.textContent = tToolbar('toolbar.config.volume', lang)
    }
    if (this.cacheRowLabelEl) {
      this.cacheRowLabelEl.textContent = tToolbar('toolbar.config.cache', lang)
    }
    const multiboxEnabled = Boolean(snap.settings.multiboxEnabled)
    const multiboxAlertOn = snap.settings.multiboxAlertSoundEnabled ?? true
    if (this.multiboxSlotEl) {
      this.multiboxSlotEl.hidden = !multiboxEnabled
    }
    if (this.multiboxRowLabelEl) {
      this.multiboxRowLabelEl.textContent = tToolbar('toolbar.config.multibox', lang)
    }
    if (this.multiboxToggleBtnEl) {
      const label = tToolbar(
        multiboxEnabled ? 'toolbar.config.multiboxOn' : 'toolbar.config.multiboxOff',
        lang,
      )
      this.multiboxToggleBtnEl.textContent = label
      this.multiboxToggleBtnEl.title = label
      this.multiboxToggleBtnEl.setAttribute('aria-pressed', multiboxEnabled ? 'true' : 'false')
      this.multiboxToggleBtnEl.className = multiboxEnabled
        ? 'd2-toolbar__btn d2-toolbar__btn--active'
        : 'd2-toolbar__btn'
    }
    if (this.multiboxAlertBtnEl) {
      this.multiboxAlertBtnEl.hidden = !multiboxEnabled
      const alertLabel = tToolbar(
        multiboxAlertOn ? 'toolbar.config.multiboxAlertOn' : 'toolbar.config.multiboxAlertOff',
        lang,
      )
      this.multiboxAlertBtnEl.textContent = alertLabel
      this.multiboxAlertBtnEl.title = alertLabel
      this.multiboxAlertBtnEl.setAttribute('aria-pressed', multiboxAlertOn ? 'true' : 'false')
      this.multiboxAlertBtnEl.className = multiboxAlertOn
        ? 'd2-toolbar__btn d2-toolbar__btn--active'
        : 'd2-toolbar__btn'
    }
    if (this.viewportSelectEl && typeof document !== 'undefined') {
      const existingValues = Array.from(this.viewportSelectEl.options).map((o) => o.value)
      const needsRebuild =
        existingValues.length !== this.allowedViewports.length ||
        existingValues.some((v, idx) => v !== this.allowedViewports[idx])
      if (needsRebuild) {
        this.viewportSelectEl.innerHTML = ''
        for (const vp of this.allowedViewports) {
          const opt = document.createElement('option')
          opt.value = vp
          opt.textContent = formatViewportLabel(vp)
          this.viewportSelectEl.appendChild(opt)
        }
      }
      this.viewportSelectEl.value = snap.settings.viewport
    }
    if (this.worldFpsSelectEl) {
      this.worldFpsSelectEl.value = String(snap.settings.worldRenderFps)
    }
    if (this.muteBtnEl) {
      const muted = snap.settings.audioMuted
      const muteLabel = tToolbar(
        muted ? 'toolbar.config.muted' : 'toolbar.config.mute',
        lang,
      )
      if (this.muteBtnIconEl) {
        this.muteBtnIconEl.innerHTML =
          muted || snap.settings.masterVolume <= 0
            ? TOOLBAR_VOLUME_MUTE_ICON_SVG
            : TOOLBAR_VOLUME_ON_ICON_SVG
      }
      if (this.muteBtnLabelEl) {
        this.muteBtnLabelEl.textContent = muteLabel
      } else {
        this.muteBtnEl.textContent = muteLabel
      }
      this.muteBtnEl.title = muteLabel
      this.muteBtnEl.setAttribute('aria-pressed', muted ? 'true' : 'false')
      this.muteBtnEl.className = muted
        ? 'd2-toolbar__btn d2-toolbar__btn--active'
        : 'd2-toolbar__btn'
    }
    const volPct = Math.round(snap.settings.masterVolume * 100)
    if (this.volumeSliderEl) {
      this.volumeSliderEl.value = String(volPct)
    }
    if (this.volumeValueEl) {
      this.volumeValueEl.textContent = snap.settings.audioMuted ? `0%` : `${volPct}%`
    }
    if (this.fullscreenBtnEl) {
      const active = this.fullscreen?.isActive() ?? false
      const label = tToolbar(active ? 'toolbar.fullscreen.exit' : 'toolbar.fullscreen.enter', lang)
      if (this.fullscreenBtnIconEl) {
        this.fullscreenBtnIconEl.innerHTML = active
          ? TOOLBAR_FULLSCREEN_EXIT_ICON_SVG
          : TOOLBAR_FULLSCREEN_ENTER_ICON_SVG
      }
      if (this.fullscreenBtnLabelEl) {
        this.fullscreenBtnLabelEl.textContent = label
      } else {
        this.fullscreenBtnEl.textContent = label
      }
      this.fullscreenBtnEl.title = label
      this.fullscreenBtnEl.disabled = !(this.fullscreen?.isSupported() ?? false)
      this.fullscreenBtnEl.setAttribute('aria-pressed', active ? 'true' : 'false')
      this.fullscreenBtnEl.className = active
        ? 'd2-toolbar__btn d2-toolbar__btn--active'
        : 'd2-toolbar__btn'
    }
    if (this.cacheClearBtnEl) {
      let labelText: string
      if (this.cacheClearedFlash) {
        labelText = tToolbar('toolbar.cache.cleared', lang)
      } else {
        const baseLabel = tToolbar('toolbar.cache.clear', lang)
        labelText =
          this.cacheUsageBytes > 0
            ? `${baseLabel} (${formatCacheBytesMb(this.cacheUsageBytes)})`
            : baseLabel
      }
      if (this.cacheClearBtnIconEl) {
        this.cacheClearBtnIconEl.innerHTML = TOOLBAR_CACHE_CLEAR_ICON_SVG
      }
      if (this.cacheClearBtnLabelEl) {
        this.cacheClearBtnLabelEl.textContent = labelText
      } else {
        this.cacheClearBtnEl.textContent = labelText
      }
      this.cacheClearBtnEl.title = labelText
    }

    // Bug Report Modal Sync
    if (this.bugOverlayEl) {
      this.bugOverlayEl.hidden = !this.bugModalOpen
    }
    if (this.bugTitleEl) {
      this.bugTitleEl.textContent = tToolbar('toolbar.bug.title', lang)
    }
    if (this.bugSubtitleEl) {
      this.bugSubtitleEl.textContent = tToolbar('toolbar.bug.subtitle', lang)
    }
    if (this.bugCloseBtnEl) {
      this.bugCloseBtnEl.textContent = tToolbar('toolbar.bug.close', lang)
    }
    if (this.bugTitleLabelEl) {
      this.bugTitleLabelEl.textContent = tToolbar('toolbar.bug.titleLabel', lang)
    }
    if (this.bugTitleInputEl) {
      this.bugTitleInputEl.setAttribute(
        'placeholder',
        tToolbar('toolbar.bug.titlePlaceholder', lang),
      )
    }
    if (this.bugCategoryLabelEl) {
      this.bugCategoryLabelEl.textContent = tToolbar('toolbar.bug.categoryLabel', lang)
    }
    if (this.bugCategorySelectEl) {
      const opts = Array.from(this.bugCategorySelectEl.options)
      for (let i = 0; i < BUG_REPORT_CATEGORIES.length; i += 1) {
        const cat = BUG_REPORT_CATEGORIES[i]!
        const optEl = opts[i]
        if (optEl) {
          optEl.textContent = tToolbar(`toolbar.bug.category.${cat}` as const, lang)
        }
      }
    }
    if (this.bugDescLabelEl) {
      this.bugDescLabelEl.textContent = tToolbar('toolbar.bug.descLabel', lang)
    }
    if (this.bugDescInputEl) {
      this.bugDescInputEl.setAttribute(
        'placeholder',
        tToolbar('toolbar.bug.descPlaceholder', lang),
      )
    }
    if (this.bugCancelBtnEl) {
      this.bugCancelBtnEl.textContent = tToolbar('toolbar.bug.cancel', lang)
    }
    if (this.bugSubmitBtnEl) {
      this.bugSubmitBtnEl.disabled = this.bugSubmitting
      this.bugSubmitBtnEl.textContent = tToolbar(
        this.bugSubmitting ? 'toolbar.bug.submitting' : 'toolbar.bug.submit',
        lang,
      )
    }
    if (this.bugStatusMsgEl) {
      if (this.bugStatusState.kind === 'none' || !this.bugStatusState.message) {
        this.bugStatusMsgEl.hidden = true
        this.bugStatusMsgEl.textContent = ''
        this.bugStatusMsgEl.className = 'd2-toolbar-modal__status'
      } else {
        this.bugStatusMsgEl.hidden = false
        this.bugStatusMsgEl.textContent = this.bugStatusState.message
        this.bugStatusMsgEl.className =
          this.bugStatusState.kind === 'ok'
            ? 'd2-toolbar-modal__status d2-toolbar-modal__status--ok'
            : 'd2-toolbar-modal__status d2-toolbar-modal__status--error'
      }
    }

    if (this.diagBannerEl) {
      if (snap.diagnosticBannerText) {
        this.diagBannerEl.hidden = false
        this.diagBannerEl.textContent = snap.diagnosticBannerText
        this.diagBannerEl.className = 'd2-toolbar__diag d2-toolbar__diag--visible'
      } else {
        this.diagBannerEl.hidden = true
        this.diagBannerEl.textContent = ''
        this.diagBannerEl.className = 'd2-toolbar__diag'
      }
    }
  }
}
