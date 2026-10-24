/**
 * Centralized language detection & runtime state (`CHI` / `'zh'` vs `ENG` / `'en'`)
 * for Diablo II v1.13c web port (Issue #503).
 */

import { resolveTblKey } from '../../common/data/canonical-tbl-strings.ts'
import {
  setDefaultTblLang,
  setDefaultTblLangProvider,
  toGameLang,
  toTblLang,
  type GameLang,
  type TblLang,
} from '../../common/formats/tbl.ts'

export { toGameLang, toTblLang, type GameLang, type TblLang }

export function lookupTbl(key: string, lang: TblLang = getTblLang()): string | undefined {
  return resolveTblKey(key, lang)
}

/** Packed tbl string for `key`; throws when the key is not in the packed canonical dictionary. */
export function requireTbl(key: string, lang: TblLang): string {
  const v = resolveTblKey(key, lang)
  if (v === undefined) throw new Error(`tbl key "${key}" is not packed (src/baker/packers/pack-canonical-tbl.ts)`)
  return v
}

let overrideLang: GameLang | null = null
const listeners = new Set<(lang: TblLang) => void>()
const gameLangListeners = new Set<(lang: GameLang) => void>()

setDefaultTblLangProvider(
  () => getTblLang(),
  (tbl) => {
    overrideLang = tbl === 'ENG' ? 'en' : 'zh'
  },
)

/**
 * Default language for entry pages without an explicit language suffix (`acts.html`, `arena.html`,
 * `index.html`) or unrecognized paths, preserving backward compatibility with Chinese (`CHI` / `'zh'`)
 * per Issue #503 & Issue #712.
 */
export const DEFAULT_GAME_LANG: GameLang = 'zh'
export const DEFAULT_TBL_LANG: TblLang = 'CHI'

/** Canonical HTML entry pages that resolve to English (`ENG` / `'en'`). */
export const ENGLISH_ENTRY_PAGES = [
  'acts-en.html',
  'arena-en.html',
  'bnet.html',
  'play-en.html',
] as const

/**
 * Canonical HTML entry pages that resolve to Chinese (`CHI` / `'zh'`), including
 * backward-compatible unsuffixed pages (`acts.html`, `arena.html`, `index.html`).
 */
export const CHINESE_ENTRY_PAGES = [
  'acts-zh.html',
  'arena-zh.html',
  'acts.html',
  'arena.html',
  'index.html',
] as const

/**
 * Resolve `GameLang` from a URL pathname if it matches a known HTML entry page:
 * - `acts-en.html`, `arena-en.html`, `bnet.html`, `play-en.html` -> `'en'` (`ENG`)
 * - `acts-zh.html`, `arena-zh.html`, `acts.html`, `arena.html`, `index.html` -> `'zh'` (`CHI`)
 * - Any other pathname -> `null` (caller falls back to query param / localStorage / `<html lang>` / `DEFAULT_GAME_LANG`)
 */
export function resolveLangFromPathname(pathname: string): GameLang | null {
  const path = (pathname || '').toLowerCase()
  for (const page of ENGLISH_ENTRY_PAGES) {
    if (path === page || path.endsWith(`/${page}`)) {
      return 'en'
    }
  }
  for (const page of CHINESE_ENTRY_PAGES) {
    if (page === 'index.html') {
      if (path === 'index.html' || path === '/index.html') {
        return 'zh'
      }
      continue
    }
    if (path === page || path.endsWith(`/${page}`)) {
      return 'zh'
    }
  }
  return null
}

/**
 * Detect `TblLang` (`'CHI'` | `'ENG'`) from a URL string using deterministic precedence:
 * 1. Explicit `?lang=` query parameter (`en`/`eng`/`english` -> `'ENG'`; `zh`/`chi`/`zh-cn`/`cn`/`chinese` -> `'CHI'`).
 * 2. Known HTML entry-page filename via `resolveLangFromPathname` (`acts-en.html` -> `'ENG'`, `acts-zh.html` / `acts.html` -> `'CHI'`).
 * 3. Backward-compatible default `DEFAULT_TBL_LANG` (`'CHI'`) when an explicit URL string is provided without a recognized language suffix.
 * 4. Runtime `detectInitialLang()` when called with no URL argument.
 */
export function detectLangFromUrl(urlStr?: string): TblLang {
  if (typeof urlStr === 'string' && urlStr.trim() !== '') {
    const u = new URL(urlStr, 'http://localhost')
    const q = u.searchParams.get('lang')?.trim().toLowerCase()
    if (q === 'en' || q === 'eng' || q === 'english') return 'ENG'
    if (q === 'zh' || q === 'chi' || q === 'zh-cn' || q === 'cn' || q === 'chinese') return 'CHI'
    const fromPath = resolveLangFromPathname(u.pathname)
    if (fromPath !== null) {
      return fromPath === 'en' ? 'ENG' : 'CHI'
    }
    return DEFAULT_TBL_LANG
  }
  return detectInitialLang() === 'en' ? 'ENG' : 'CHI'
}

export interface DetectLangOptions {
  readonly preferStoredSetting?: boolean | undefined
}

export function detectInitialLang(options?: DetectLangOptions): GameLang {
  if (typeof window !== 'undefined' && window.location) {
    const params = new URLSearchParams(window.location.search || '')
    const q = params.get('lang')?.trim().toLowerCase()
    if (q === 'en' || q === 'eng' || q === 'english') return 'en'
    if (q === 'zh' || q === 'chi' || q === 'zh-cn' || q === 'cn' || q === 'chinese') return 'zh'

    const path = (window.location.pathname || '').toLowerCase()
    const fromPath = resolveLangFromPathname(path)
    if (fromPath !== null) {
      return fromPath
    }
    if (
      options?.preferStoredSetting === true ||
      path === 'play.html' ||
      path.endsWith('/play.html') ||
      path === 'drops.html' ||
      path.endsWith('/drops.html') ||
      path === 'stats.html' ||
      path.endsWith('/stats.html') ||
      path.endsWith('/index.html')
    ) {
      try {
        const raw = window.localStorage?.getItem('d2web.settings.v1')
        if (raw) {
          const parsed = JSON.parse(raw) as { lang?: unknown }
          if (parsed && (parsed.lang === 'en' || parsed.lang === 'zh')) {
            return parsed.lang
          }
        }
      } catch {
        // Ignore storage access errors in sandboxed contexts
      }
    }
  } else if (options?.preferStoredSetting === true && typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      const ls = (globalThis as { localStorage?: { getItem?: (k: string) => string | null } }).localStorage
      const raw = ls?.getItem?.('d2web.settings.v1')
      if (raw) {
        const parsed = JSON.parse(raw) as { lang?: unknown }
        if (parsed && (parsed.lang === 'en' || parsed.lang === 'zh')) {
          return parsed.lang
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }
  if (typeof document !== 'undefined' && document.documentElement?.lang) {
    const docLang = document.documentElement.lang.trim().toLowerCase()
    if (docLang.startsWith('en')) return 'en'
    if (docLang.startsWith('zh')) return 'zh'
  }
  return DEFAULT_GAME_LANG
}

export function getGameLang(): GameLang {
  return overrideLang ?? detectInitialLang()
}

export function getLang(): GameLang {
  return getGameLang()
}

export function getCurrentLang(): GameLang {
  return getGameLang()
}

export function getTblLang(): TblLang {
  return getGameLang() === 'en' ? 'ENG' : 'CHI'
}

export function isEn(): boolean {
  return getGameLang() === 'en'
}

export function isEnglish(): boolean {
  return getGameLang() === 'en'
}

export function hasExplicitLangContext(): boolean {
  return overrideLang !== null || typeof window !== 'undefined' || typeof document !== 'undefined'
}

function notifyListeners(): void {
  const gameLang = getGameLang()
  const tbl = gameLang === 'en' ? 'ENG' : 'CHI'
  setDefaultTblLang(tbl)
  const errors: unknown[] = []
  for (const fn of [...listeners]) {
    try {
      fn(tbl)
    } catch (err) {
      errors.push(err)
    }
  }
  for (const fn of [...gameLangListeners]) {
    try {
      fn(gameLang)
    } catch (err) {
      errors.push(err)
    }
  }
  if (errors.length === 1) {
    throw errors[0]
  }
  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      `${errors.length} language change listeners failed during notifyListeners`,
    )
  }
}

export function setGameLang(lang: GameLang | TblLang | null): void {
  if (lang === null) {
    overrideLang = null
    notifyListeners()
    return
  }
  overrideLang = toGameLang(lang)
  notifyListeners()
}

export function setLang(lang: GameLang | TblLang | null): void {
  setGameLang(lang)
}

export function setCurrentLang(lang: GameLang | TblLang | null): void {
  setGameLang(lang)
}

export function setTblLang(lang: TblLang | GameLang | null): void {
  setGameLang(lang)
}

export function initLangFromBrowser(options?: DetectLangOptions): TblLang {
  overrideLang = detectInitialLang(options)
  notifyListeners()
  return getTblLang()
}

export function onTblLangChange(listener: (lang: TblLang) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function onLangChange(listener: (lang: GameLang) => void): () => void {
  gameLangListeners.add(listener)
  return () => {
    gameLangListeners.delete(listener)
  }
}

export const onGameLangChange = onLangChange

export type ToolbarI18nKey =
  | 'toolbar.status.disconnected'
  | 'toolbar.status.connecting'
  | 'toolbar.status.bncs'
  | 'toolbar.status.mcp'
  | 'toolbar.status.d2gs'
  | 'toolbar.status.local'
  | 'toolbar.status.error'
  | 'toolbar.server.label'
  | 'toolbar.server.placeholder'
  | 'toolbar.server.apply'
  | 'toolbar.server.confirmReconnect'
  | 'toolbar.lang.label'
  | 'toolbar.lang.toggle'
  | 'toolbar.lang.zh'
  | 'toolbar.lang.en'
  | 'toolbar.lighting.label'
  | 'toolbar.automap.label'
  | 'toolbar.automap.off'
  | 'toolbar.automap.level'
  | 'toolbar.automap.act'
  | 'toolbar.viewport.label'
  | 'toolbar.plugins.open'
  | 'toolbar.config.open'
  | 'toolbar.config.title'
  | 'toolbar.config.subtitle'
  | 'toolbar.config.close'
  | 'toolbar.config.displayMode'
  | 'toolbar.config.fps'
  | 'toolbar.config.volume'
  | 'toolbar.config.mute'
  | 'toolbar.config.muted'
  | 'toolbar.config.cache'
  | 'toolbar.config.multibox'
  | 'toolbar.config.multiboxOff'
  | 'toolbar.config.multiboxOn'
  | 'toolbar.config.multiboxAlertOn'
  | 'toolbar.config.multiboxAlertOff'
  | 'toolbar.bug.open'
  | 'toolbar.bug.title'
  | 'toolbar.bug.subtitle'
  | 'toolbar.bug.close'
  | 'toolbar.bug.titleLabel'
  | 'toolbar.bug.titlePlaceholder'
  | 'toolbar.bug.categoryLabel'
  | 'toolbar.bug.category.gameplay'
  | 'toolbar.bug.category.render'
  | 'toolbar.bug.category.ui'
  | 'toolbar.bug.category.audio'
  | 'toolbar.bug.category.network'
  | 'toolbar.bug.category.other'
  | 'toolbar.bug.descLabel'
  | 'toolbar.bug.descPlaceholder'
  | 'toolbar.bug.cancel'
  | 'toolbar.bug.submit'
  | 'toolbar.bug.submitting'
  | 'toolbar.bug.errorEmpty'
  | 'toolbar.bug.saved'
  | 'toolbar.bug.errorFailed'
  | 'toolbar.cache.clear'
  | 'toolbar.fullscreen.enter'
  | 'toolbar.fullscreen.exit'
  | 'toolbar.fullscreen.failed'
  | 'toolbar.cache.cleared'
  | 'toolbar.diag.quotaExceeded'
  | 'toolbar.diag.tlsError'
  | 'toolbar.diag.bareIpHttps'

export const TOOLBAR_I18N: Readonly<Record<ToolbarI18nKey, { readonly zh: string; readonly en: string }>> = {
  'toolbar.status.disconnected': { zh: '未连接', en: 'Offline' },
  'toolbar.status.connecting': { zh: '连接中...', en: 'Connecting...' },
  'toolbar.status.bncs': { zh: '战网大厅 (BNCS)', en: 'Lobby (BNCS)' },
  'toolbar.status.mcp': { zh: '角色选择 (MCP)', en: 'Characters (MCP)' },
  'toolbar.status.d2gs': { zh: '游戏中 (D2GS)', en: 'In-Game (D2GS)' },
  'toolbar.status.local': { zh: '单机游戏', en: 'Single Player' },
  'toolbar.status.error': { zh: '连接异常', en: 'Conn Error' },
  'toolbar.server.label': { zh: '战网服务器', en: 'Battle.net Server' },
  'toolbar.server.placeholder': { zh: 'www.laiseek.xyz', en: 'www.laiseek.xyz' },
  'toolbar.server.apply': { zh: '连接', en: 'Apply' },
  'toolbar.server.confirmReconnect': {
    zh: '当前正在联机会话中，修改服务器地址将断开当前连接并重连，是否继续？',
    en: 'Changing server host while connected will disconnect the current session and reconnect. Continue?',
  },
  'toolbar.lang.label': { zh: '语言', en: 'Lang' },
  'toolbar.lang.toggle': { zh: '切换语言 (中 / EN)', en: 'Switch Language (ZH / EN)' },
  'toolbar.lang.zh': { zh: '中', en: '中' },
  'toolbar.lang.en': { zh: 'EN', en: 'EN' },
  'toolbar.lighting.label': { zh: '光照', en: 'Light' },
  'toolbar.automap.label': { zh: '全图', en: 'Map' },
  'toolbar.automap.off': { zh: '关闭', en: 'Off' },
  'toolbar.automap.level': { zh: '本层', en: 'Level' },
  'toolbar.automap.act': { zh: '全幕', en: 'Act' },
  'toolbar.viewport.label': { zh: '分辨率', en: 'Resolution' },
  'toolbar.plugins.open': { zh: '插件', en: 'Plugins' },
  'toolbar.config.open': { zh: '配置', en: 'Settings' },
  'toolbar.config.title': { zh: '游戏配置', en: 'Game Settings' },
  'toolbar.config.subtitle': {
    zh: '调整全屏/窗口显示、分辨率、帧率、战网服务器、音量及资源缓存。',
    en: 'Configure display mode, resolution, frame rate, battle.net server, volume, and asset cache.',
  },
  'toolbar.config.close': { zh: '关闭 (ESC)', en: 'Close (ESC)' },
  'toolbar.config.displayMode': { zh: '全屏 / 窗口', en: 'Display Mode' },
  'toolbar.config.fps': { zh: '渲染帧率 (FPS)', en: 'Frame Rate (FPS)' },
  'toolbar.config.volume': { zh: '音量', en: 'Volume' },
  'toolbar.config.mute': { zh: '静音', en: 'Mute' },
  'toolbar.config.muted': { zh: '已静音', en: 'Muted' },
  'toolbar.config.cache': { zh: '资源缓存', en: 'Asset Cache' },
  'toolbar.config.multibox': { zh: '单 Tab 多开', en: 'Single-Tab Multibox' },
  'toolbar.config.multiboxOff': { zh: '已关闭 (单实例)', en: 'Off (Single)' },
  'toolbar.config.multiboxOn': { zh: '已开启 (多实例)', en: 'Enabled (Multibox)' },
  'toolbar.config.multiboxAlertOn': { zh: '后台受击音: 开', en: 'Bg Alert: On' },
  'toolbar.config.multiboxAlertOff': { zh: '后台受击音: 关', en: 'Bg Alert: Off' },
  'toolbar.bug.open': { zh: '汇报 Bug', en: 'Report Bug' },
  'toolbar.bug.title': { zh: '汇报 Bug', en: 'Report a Bug' },
  'toolbar.bug.subtitle': {
    zh: '提交游戏中遇到的问题与复现步骤，报告将保存到服务器。',
    en: 'Submit an issue encountered in-game. Reports are saved to the server.',
  },
  'toolbar.bug.close': { zh: '关闭 (ESC)', en: 'Close (ESC)' },
  'toolbar.bug.titleLabel': { zh: '问题简述', en: 'Summary' },
  'toolbar.bug.titlePlaceholder': {
    zh: '简要描述问题（例如：某技能释放异常、卡地形等）',
    en: 'Brief summary of the issue...',
  },
  'toolbar.bug.categoryLabel': { zh: '问题分类', en: 'Category' },
  'toolbar.bug.category.gameplay': { zh: '游戏逻辑 / 技能 / 战斗', en: 'Gameplay / Skills / Combat' },
  'toolbar.bug.category.render': { zh: '画面 / 贴图 / 动画渲染', en: 'Graphics / Rendering' },
  'toolbar.bug.category.ui': { zh: '界面 / 面板 / 交互', en: 'UI / Panels / Input' },
  'toolbar.bug.category.audio': { zh: '音效 / 音乐 / 语音', en: 'Audio / Music / Speech' },
  'toolbar.bug.category.network': { zh: '联机 / 掉线 / 延迟', en: 'Network / Multiplayer' },
  'toolbar.bug.category.other': { zh: '其他问题', en: 'Other' },
  'toolbar.bug.descLabel': { zh: '详细描述与复现步骤', en: 'Description & Steps to Reproduce' },
  'toolbar.bug.descPlaceholder': {
    zh: '请填写复现步骤、角色职业、所在场景/关卡等详细信息...',
    en: 'Steps to reproduce, character class, act/level, etc...',
  },
  'toolbar.bug.cancel': { zh: '取消', en: 'Cancel' },
  'toolbar.bug.submit': { zh: '提交 Bug', en: 'Submit Bug' },
  'toolbar.bug.submitting': { zh: '正在保存...', en: 'Saving...' },
  'toolbar.bug.errorEmpty': {
    zh: '请填写问题标题与详细描述后再提交。',
    en: 'Please fill in both summary and description before submitting.',
  },
  'toolbar.bug.saved': {
    zh: 'Bug 报告已保存到服务器！',
    en: 'Bug report saved to server!',
  },
  'toolbar.bug.errorFailed': {
    zh: '保存失败',
    en: 'Failed to save bug report',
  },
  'toolbar.cache.clear': { zh: '清除缓存', en: 'Clear Cache' },
  'toolbar.fullscreen.enter': { zh: '全屏', en: 'Fullscreen' },
  'toolbar.fullscreen.exit': { zh: '退出全屏', en: 'Exit Fullscreen' },
  'toolbar.fullscreen.failed': { zh: '全屏失败', en: 'Fullscreen failed' },
  'toolbar.cache.cleared': { zh: '已清缓存', en: 'Cleared' },
  'toolbar.diag.quotaExceeded': {
    zh: '单 IP 桥接配额已满（上限 5 个并发连接），请关闭多余标签页后重试。',
    en: 'Bridge connection quota reached (max 5 connections per IP). Close extra tabs and retry.',
  },
  'toolbar.diag.tlsError': {
    zh: 'WSS TLS 握手失败：请确保使用有效的域名（如 www.laiseek.xyz）而非裸 IP。',
    en: 'WSS TLS handshake failed: ensure serverHost uses a valid TLS hostname (e.g. www.laiseek.xyz).',
  },
  'toolbar.diag.bareIpHttps': {
    zh: 'HTTPS 页面下无法对裸 IP 发起安全 WSS 连接，请使用域名（如 www.laiseek.xyz）。',
    en: 'Cannot open WSS to a bare IP address from an HTTPS page. Use a TLS hostname (e.g. www.laiseek.xyz).',
  },
}

export function tToolbar(key: ToolbarI18nKey, lang: GameLang = getGameLang()): string {
  const entry = TOOLBAR_I18N[key]
  return lang === 'en' ? entry.en : entry.zh
}

