/**
 * Cross-tab active character in-game lease and duplicate-login error formatting (Issue #963).
 *
 * When a player logs in and enters a room (`in_game`) in one browser tab/page, PvPGN `d2cs`
 * still allows `MCP_CHARLOGON (0x07)` and `MCP_CREATEGAME (0x03)` / `MCP_JOINGAME (0x04)` for
 * that same character in a second tab, only for `d2gs` / `d2dbs` to reject or silently drop
 * `0x68 GameLogon` because the character is locked (`D2DBS_GETDATA_CHARLOCKED`).
 *
 * This module provides:
 * 1. A lightweight `localStorage`-backed lease (`d2_active_char_lease_v1:<host>:<charName>`)
 *    refreshed by the active in-game tab so a second tab on the same browser can fail-fast
 *    before opening a redundant room or hanging on `door_loading`.
 * 2. Deterministic error formatting that turns cross-tab leases, D2GS `0xB4` (`reason=0x06`
 *    `D2GS_GAMELOGON_CHARLOCKED`), and `state=logonSent` char-lock timeouts into an explicit
 *    localized prompt indicating that the character is already logged in.
 */

import { getGameLang } from '../i18n/lang.ts'

export interface ActiveCharLeaseStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface ActiveCharacterLease {
  readonly tabId: string
  readonly host: string
  readonly accountName: string
  readonly charName: string
  readonly gameName: string
  readonly updatedAt: number
}

/** Lease time-to-live (ms) before an unrefreshed tab record is considered stale. */
export const ACTIVE_CHAR_LEASE_TTL_MS = 8_000

/** Heartbeat interval (ms) while a session is in `'entering-game'` or `'ingame'`. */
export const ACTIVE_CHAR_LEASE_HEARTBEAT_MS = 2_000

const LEASE_KEY_PREFIX = 'd2_active_char_lease_v1'

export function normalizeLeaseHost(host: string | null | undefined): string {
  return (host ?? '').trim().toLowerCase() || 'default'
}

export function normalizeLeaseCharName(charName: string | null | undefined): string {
  return (charName ?? '').trim().toLowerCase()
}

export function buildActiveCharLeaseKey(host: string, charName: string): string {
  return `${LEASE_KEY_PREFIX}:${normalizeLeaseHost(host)}:${normalizeLeaseCharName(charName)}`
}

export function getDefaultBrowserLeaseStorage(): ActiveCharLeaseStorage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
  } catch {
    // Ignore storage access errors in sandboxed contexts
  }
  return null
}

export function createMemoryLeaseStorage(): ActiveCharLeaseStorage {
  const map = new Map<string, string>()
  return {
    getItem(key: string): string | null {
      return map.get(key) ?? null
    },
    setItem(key: string, value: string): void {
      map.set(key, value)
    },
    removeItem(key: string): void {
      map.delete(key)
    },
  }
}

export function readActiveCharacterLease(
  storage: ActiveCharLeaseStorage | null | undefined,
  host: string,
  charName: string,
  nowMs = Date.now(),
): ActiveCharacterLease | null {
  if (!storage) return null
  const normChar = normalizeLeaseCharName(charName)
  if (!normChar) return null
  const key = buildActiveCharLeaseKey(host, charName)
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ActiveCharacterLease> | null
    if (
      !parsed ||
      typeof parsed.tabId !== 'string' ||
      !parsed.tabId ||
      typeof parsed.charName !== 'string' ||
      typeof parsed.updatedAt !== 'number' ||
      !Number.isFinite(parsed.updatedAt)
    ) {
      return null
    }
    if (nowMs - parsed.updatedAt >= ACTIVE_CHAR_LEASE_TTL_MS) {
      return null
    }
    return {
      tabId: parsed.tabId,
      host: typeof parsed.host === 'string' ? parsed.host : normalizeLeaseHost(host),
      accountName: typeof parsed.accountName === 'string' ? parsed.accountName : '',
      charName: parsed.charName,
      gameName: typeof parsed.gameName === 'string' ? parsed.gameName : '',
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return null
  }
}

export function findConflictingCharacterLease(
  storage: ActiveCharLeaseStorage | null | undefined,
  host: string,
  charName: string,
  selfTabId: string,
  nowMs = Date.now(),
): ActiveCharacterLease | null {
  const lease = readActiveCharacterLease(storage, host, charName, nowMs)
  if (!lease || lease.tabId === selfTabId) {
    return null
  }
  return lease
}

export function writeActiveCharacterLease(
  storage: ActiveCharLeaseStorage | null | undefined,
  lease: ActiveCharacterLease,
): void {
  if (!storage) return
  const normChar = normalizeLeaseCharName(lease.charName)
  if (!normChar) return
  const key = buildActiveCharLeaseKey(lease.host, lease.charName)
  try {
    storage.setItem(key, JSON.stringify(lease))
  } catch {
    // Ignore quota or sandboxed storage errors
  }
}

export function releaseActiveCharacterLease(
  storage: ActiveCharLeaseStorage | null | undefined,
  host: string,
  charName: string,
  selfTabId: string,
): void {
  if (!storage) return
  const normChar = normalizeLeaseCharName(charName)
  if (!normChar) return
  const key = buildActiveCharLeaseKey(host, charName)
  try {
    const raw = storage.getItem(key)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<ActiveCharacterLease> | null
    if (!parsed || parsed.tabId === selfTabId) {
      storage.removeItem(key)
    }
  } catch {
    // Ignore storage access errors
  }
}

export function formatDuplicateCharacterLoginMessage(
  charName?: string | null,
  lang: 'zh' | 'en' = getGameLang(),
): string {
  const trimmed = (charName ?? '').trim()
  if (lang === 'en') {
    return trimmed
      ? `Character "${trimmed}" is already logged in and in a game (该角色已经登录). Unable to enter game.`
      : 'This character is already logged in and in a game (该角色已经登录). Unable to enter game.'
  }
  return trimmed
    ? `该角色 "${trimmed}" 已经登录并处于游戏中，无法重复创建或加入房间`
    : '该角色已经登录并处于游戏中，无法重复创建或加入房间'
}

export class DuplicateCharacterLoginError extends Error {
  override readonly name = 'DuplicateCharacterLoginError'
  readonly charName: string
  readonly gameName: string | undefined

  constructor(charName: string, gameName?: string) {
    super(formatDuplicateCharacterLoginMessage(charName))
    this.charName = charName
    this.gameName = gameName
  }
}

/**
 * Extract the MCP opcode kind (`'join'` for `MCP_JOINGAME 0x04` or `'create'` for `MCP_CREATEGAME 0x03`)
 * and numeric status code from a thrown `ProtocolError` or error message string.
 */
export function parseMcpGameErrorStatus(
  err: unknown,
): { readonly kind: 'join' | 'create'; readonly status: number } | null {
  const raw = err instanceof Error ? err.message : String(err)
  const joinMatch = /MCP_JOINGAME\b[^\n]*?\bstatus=0x([0-9a-f]+)/i.exec(raw)
  if (joinMatch && joinMatch[1]) {
    const status = Number.parseInt(joinMatch[1], 16)
    if (Number.isFinite(status)) {
      return { kind: 'join', status: status >>> 0 }
    }
  }
  const createMatch = /MCP_CREATEGAME\b[^\n]*?\bstatus=0x([0-9a-f]+)/i.exec(raw)
  if (createMatch && createMatch[1]) {
    const status = Number.parseInt(createMatch[1], 16)
    if (Number.isFinite(status)) {
      return { kind: 'create', status: status >>> 0 }
    }
  }
  return null
}

/**
 * Format an `MCP_JOINGAME (0x04)` S2C status code into its authentic 1.13c `D2Multi.dll`
 * (`0x6F9DDD0E..0x6F9DDDFD`, jump table `0x6F9DE068`) `.tbl` localized string.
 */
export function formatMcpJoinGameStatusError(
  status: number,
  lang: 'zh' | 'en' = getGameLang(),
): string {
  const isEn = lang === 'en'
  switch (status >>> 0) {
    case 0x29: // strId 5160 (0x1428)
      return isEn ? "Game name and password don't match." : '遊戲名稱及密碼不符。'
    case 0x2a: // strId 5159 (0x1427)
      return isEn ? 'Game does not exist.' : '遊戲並不存在。'
    case 0x2b: // strId 5161 (0x1429)
      return isEn ? 'Game is Full.' : '遊戲人數已滿。'
    case 0x2c: // strId 5162 (0x142A)
      return isEn
        ? 'You do not meet the level restrictions for this game.'
        : '你未達到這個遊戲的等級限制。'
    case 0x71: // strId 5158 (0x1426)
      return isEn
        ? 'Hardcore and Normal Characters may not be in the same game.'
        : '專家級和一般級人物不能在同一個遊戲中。'
    case 0x73: // strId 21794 (0x5522)
      return isEn
        ? 'Unable to enter game. Your character must kill Baal to play in a Nightmare game.'
        : '無法進入遊戲。你的人物必須殺死巴爾才能進入惡夢級的遊戲。'
    case 0x74: // strId 21793 (0x5521)
      return isEn
        ? 'Unable to enter game. Your character must kill Baal in Nightmare difficulty to play in a Hell game.'
        : '無法進入遊戲。你的人物必須殺死惡夢級的巴爾才能進入地獄級的遊戲。'
    case 0x78: // strId 10101 (0x2775)
      return isEn
        ? 'Unable to enter game. A Diablo II character cannot join a game created by a Diablo II Expansion character.'
        : '無法進入遊戲。暗黑破壞神 II 的人物無法加入由資料片人物所開創的遊戲。'
    case 0x79: // strId 10102 (0x2776)
      return isEn
        ? 'Unable to enter game. A Diablo II Expansion character cannot join a game created by a Diablo II character.'
        : '無法進入遊戲。資料片的人物無法加入由暗黑破壞神 II 人物所開創的遊戲。'
    case 0x7d: // strId 10929 (0x2AB1)
      return isEn
        ? 'Unable to enter game. A Non-Ladder character cannot join a game created by a Ladder character.'
        : '無法進入遊戲。非天梯人物無法加入由天梯人物所開創的遊戲。'
    default: // strId 5141 (0x1415)
      return isEn ? 'Join Failed' : '加入失敗'
  }
}

/**
 * Format an `MCP_CREATEGAME (0x03)` S2C status code into its authentic 1.13c `D2Multi.dll`
 * (`0x6F9DDE2E..0x6F9DDEB3`, jump table `0x6F9DE118`) `.tbl` localized string.
 */
export function formatMcpCreateGameStatusError(
  status: number,
  lang: 'zh' | 'en' = getGameLang(),
): string {
  const isEn = lang === 'en'
  switch (status >>> 0) {
    case 0x1e: // strId 5137 (0x1411)
    case 0x32:
      return isEn ? 'Invalid Game Name' : '無效的遊戲名稱'
    case 0x1f: // strId 5138 (0x1412)
      return isEn ? 'A Game Already Exists With That Name' : '已經有相同名稱的遊戲存在'
    case 0x20: // strId 5139 (0x1413)
      return isEn ? 'Server Down' : '伺服器停機'
    case 0x6e: // strId 5304 (0x14B8)
      return isEn
        ? 'You cannot create or join games with a dead hardcore character.'
        : '你無法利用死亡的專家級人物，創造或是加入其他遊戲之中。'
    case 0x73: // strId 21794 (0x5522)
      return isEn
        ? 'Unable to enter game. Your character must kill Baal to play in a Nightmare game.'
        : '無法進入遊戲。你的人物必須殺死巴爾才能進入惡夢級的遊戲。'
    case 0x74: // strId 21793 (0x5521)
      return isEn
        ? 'Unable to enter game. Your character must kill Baal in Nightmare difficulty to play in a Hell game.'
        : '無法進入遊戲。你的人物必須殺死惡夢級的巴爾才能進入地獄級的遊戲。'
    default: // strId 5140 (0x1414)
      return isEn ? 'Error Creating Game' : '開創遊戲錯誤'
  }
}

/**
 * Detect whether a string contains raw protocol/developer diagnostics (`[ProtocolError ...]`,
 * `status=0x...`, `state=...`, `packet=0x...`, `progression=`, `d2gs`, `mcp_`, `bncs`, etc.)
 * that must never be rendered directly to players.
 */
export function isRawTechnicalErrorString(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  return (
    /\[ProtocolError/i.test(trimmed) ||
    /\b(?:status|reason|packet|opcode|code)=0x[0-9a-f]+\b/i.test(trimmed) ||
    /\b(?:state|progression|classId|conn)=[A-Za-z0-9_-]+\b/i.test(trimmed) ||
    /\b(?:SID_[A-Z0-9_]+|MCP_[A-Z0-9_]+|D2GS|BNCS|WebSocket)\b/.test(trimmed) ||
    /\btimed out(?:\s+after\s+\d+ms)?\b/i.test(trimmed) ||
    /\bconnection (?:closed|reset|refused)\b/i.test(trimmed) ||
    /\bnot connected for\b/i.test(trimmed) ||
    /\b(?:TypeError|ReferenceError|SyntaxError|RangeError):/i.test(trimmed)
  )
}

/**
 * Format Battle.net login / authentication errors (`SID_LOGONRESPONSE2 0x3A`, `SID_AUTH_CHECK 0x51`,
 * `SID_LOGONREALMEX 0x3E`, `MCP_STARTUP 0x01`, or socket/timeout errors) into authentic 1.13c
 * `D2Launch.dll` (`0x6FA4E510..0x6FA4ED40`) `.tbl` localized messages.
 */
export function formatBnetLoginError(
  err: unknown,
  lang: 'zh' | 'en' = getGameLang(),
): string {
  const isEn = lang === 'en'
  const raw = err instanceof Error ? err.message : String(err)
  const stripped = raw.replace(/^\[ProtocolError[^\]]*\]\s*/i, '').trim()

  const logonMatch = /SID_LOGONRESPONSE2\b[^\n]*?\bstatus=0x([0-9a-f]+)/i.exec(raw)
  if (logonMatch?.[1]) {
    const status = Number.parseInt(logonMatch[1], 16) >>> 0
    switch (status) {
      case 0x01: // strId 5208 (0x1458)
        return isEn
          ? "That account does not exist. If you have not been on Battle.net for 90 days with this account, please select 'Create New Account' to choose a new name and password."
          : '這個帳戶並不存在，如果你離開Battle.Net已經有90天以上的時間，也沒有使用這個帳戶登錄，請選擇「創造新帳戶」，並另選一個新的名稱和密碼。'
      case 0x02: // strId 5207 (0x1457)
        return isEn
          ? 'The password you have entered is incorrect. Please try again.'
          : '你所輸入的密碼並不正確，請重試一次。'
      case 0x06: // strId 5356 (0x14EC)
        return isEn
          ? 'You are banned from battle.net. Reconnect later.'
          : '你被battle.net排除，請稍後再試。'
      default: // strId 5244 (0x147C)
        return isEn ? 'Login Error' : '登錄錯誤'
    }
  }

  const authCheckMatch = /SID_AUTH_CHECK\b[^\n]*?\bresult=0x([0-9a-f]+)/i.exec(raw)
  if (authCheckMatch?.[1]) {
    const result = Number.parseInt(authCheckMatch[1], 16) >>> 0
    if (result === 0x100 || result === 0x101) {
      return isEn
        ? 'Versions do not match. Please log onto battle.net or go to http://www.blizzard.com/support/Diablo2 to get a patch'
        : '版本不合。請登錄到battle.net或是前往http://www.blizzard.com/support/Diablo2，把你的版本加以更新'
    }
    if (result === 0x201) {
      return isEn
        ? 'Only one registered instance of this application can use your CD key at a time. If your connection to Battle.net was just interrupted, please wait five minutes before trying to connect again.'
        : '這套軟體一次不容許二個使用相同CD序號的人士同時登錄。如果你連到Battle.net已經被切斷，請靜候五分鐘再嚐試一次。'
    }
    if (result === 0x202) {
      return isEn
        ? 'The CD Key that you installed with has been disabled. Please contact Blizzard Entertainment Technical Support for further assistance.'
        : '你安裝時輸入的CD序號已經被取消了。請和Blizzard Entertainment技術支援部門連繫，以尋求進一步的協助。'
    }
  }

  if (
    /no realms available|SID_LOGONREALMEX|SID_QUERYREALMS2|MCP_STARTUP|realm server/i.test(raw)
  ) {
    // strId 5290 (0x14AA)
    return isEn
      ? 'No Realms are available right now, please try again later.'
      : '目前沒有可以選擇的國度，請等一下再重試。'
  }

  if (/timed out|timeout/i.test(raw)) {
    // strId 5349 (0x14E5)
    return isEn ? 'Timed out waiting for response.' : '等候回應時間超過。'
  }

  if (
    /unable to connect|connect_failed|websocket|connection closed|connection reset|bncs/i.test(raw)
  ) {
    // strId 5189 (0x1445)
    return isEn ? 'Unable to connect to Battle.net.' : '無法連上Battle.net。'
  }

  if (isRawTechnicalErrorString(raw)) {
    return isEn ? 'Login Error' : '登錄錯誤'
  }
  return stripped || (isEn ? 'Login Error' : '登錄錯誤')
}

/**
 * Format `MCP_CHARCREATE (0x02)` errors into authentic 1.13c `D2Launch.dll` (`0x6FA4EB87`)
 * `.tbl` localized messages.
 */
export function formatCharacterCreateError(
  err: unknown,
  lang: 'zh' | 'en' = getGameLang(),
): string {
  const isEn = lang === 'en'
  const raw = err instanceof Error ? err.message : String(err)
  const stripped = raw.replace(/^\[ProtocolError[^\]]*\]\s*/i, '').trim()

  const match = /MCP_CHARCREATE\b[^\n]*?\bstatus=0x([0-9a-f]+)/i.exec(raw)
  if (match?.[1]) {
    const status = Number.parseInt(match[1], 16) >>> 0
    switch (status) {
      case 0x14: // strId 5165 (0x142D)
        return isEn
          ? 'That character name is already taken. Try another.'
          : '這個人物的名稱已經有人使用了，請輸入另一個名字。'
      case 0x15: // strId 5232 (0x1470)
        return isEn
          ? 'Your user name contained one or more illegal characters.'
          : '你的使用者名稱包括了一個或一個以上的非法字元。'
      default: // strId 5240 (0x1478)
        return isEn ? 'You have entered an invalid ID.' : '你輸入了一個無法使用的名字。'
    }
  }

  if (/timed out|timeout/i.test(raw)) {
    return isEn ? 'Timed out waiting for response.' : '等候回應時間超過。'
  }

  if (isRawTechnicalErrorString(raw)) {
    return isEn ? 'You have entered an invalid ID.' : '你輸入了一個無法使用的名字。'
  }
  return stripped || (isEn ? 'You have entered an invalid ID.' : '你輸入了一個無法使用的名字。')
}

/**
 * Format `MCP_CHARLOGON (0x07)`, `MCP_CHARDELETE (0x0A)`, and `MCP_CHARUPGRADE (0x18)` errors
 * into authentic 1.13c `D2Launch.dll` (`0x6FA4D627` / `0x6FA4DCFA`) `.tbl` localized messages.
 */
export function formatCharacterActionError(
  err: unknown,
  action: 'logon' | 'delete' | 'upgrade' = 'logon',
  lang: 'zh' | 'en' = getGameLang(),
): string {
  const isEn = lang === 'en'
  const raw = err instanceof Error ? err.message : String(err)
  const stripped = raw.replace(/^\[ProtocolError[^\]]*\]\s*/i, '').trim()

  const logonMatch = /MCP_CHARLOGON\b[^\n]*?\bstatus=0x([0-9a-f]+)/i.exec(raw)
  if (logonMatch?.[1]) {
    const status = Number.parseInt(logonMatch[1], 16) >>> 0
    switch (status) {
      case 0x46: // strId 5133 (0x140D)
        return isEn ? 'Player Not Found' : '找不到玩者'
      case 0x7b: // strId 11134 (0x2B7E)
        return isEn ? 'Character Expired' : '人物失效'
      default: // strId 5244 (0x147C)
        return isEn ? 'Login Error' : '登錄錯誤'
    }
  }

  const delOrUpgMatch = /MCP_CHAR(?:DELETE|UPGRADE)\b[^\n]*?\bstatus=0x([0-9a-f]+)/i.exec(raw)
  if (delOrUpgMatch?.[1]) {
    const status = Number.parseInt(delOrUpgMatch[1], 16) >>> 0
    if (status === 0x46) {
      return isEn ? 'Player Not Found' : '找不到玩者'
    }
    return isEn ? 'Cannot Connect to Server' : '無法連上伺服器'
  }

  if (/timed out|timeout/i.test(raw)) {
    return isEn ? 'Timed out waiting for response.' : '等候回應時間超過。'
  }

  if (isRawTechnicalErrorString(raw)) {
    if (action === 'logon') {
      return isEn ? 'Login Error' : '登錄錯誤'
    }
    return isEn ? 'Cannot Connect to Server' : '無法連上伺服器'
  }
  return stripped || (isEn ? 'Login Error' : '登錄錯誤')
}

/**
 * Format a `bnet_login` error or session-loss reason for canvas display, stripping any technical
 * parenthetical suffix (e.g. `(BNCS connection closed)`) and localizing standard 1.13c `.tbl`
 * session-loss strings to the active language (`zh` or `en`).
 */
export function formatLoginScreenErrorForDisplay(
  rawReason: string,
  lang: 'zh' | 'en' = getGameLang(),
): string {
  const isEn = lang === 'en'
  const trimmed = rawReason.trim()
  if (!trimmed) return ''

  // Strip trailing ` (<technical>)` appended by `formatSessionLostReason`
  const withoutTech = trimmed.replace(/\s*\([^()]*\)\s*$/, '').trim()

  if (withoutTech.startsWith('Your connection to Battle.net has been lost.')) {
    return isEn
      ? 'Your connection to Battle.net has been lost.'
      : '你和battle.net的連線已經中斷了。'
  }
  if (withoutTech.startsWith('Your connection has been interrupted')) {
    return isEn ? 'Your connection has been interrupted' : '你的連線被中斷了'
  }
  if (withoutTech.startsWith('Timed out waiting for response.')) {
    return isEn ? 'Timed out waiting for response.' : '等候回應時間超過。'
  }
  if (withoutTech.startsWith('Battle.net is not responding.')) {
    return isEn
      ? 'Battle.net is not responding. Please try connecting again in a few minutes.'
      : 'Battle.net沒有回應，請稍候數分鐘之後再重試。'
  }
  if (withoutTech.startsWith('Diablo II was unable to connect to the realm server.')) {
    return isEn
      ? 'No Realms are available right now, please try again later.'
      : '目前沒有可以選擇的國度，請等一下再重試。'
  }
  if (withoutTech.startsWith('Lost Connection to battle.net.')) {
    return isEn ? 'Lost Connection to battle.net.' : '與battle.net失去連線。'
  }
  if (/^Saved and exited the game/i.test(trimmed)) {
    return isEn
      ? 'Your connection to Battle.net has been lost.'
      : '你和battle.net的連線已經中斷了。'
  }

  return formatBnetLoginError(trimmed, lang)
}

/**
 * Strip internal `[ProtocolError ...]` prefixes and normalize duplicate-character / game-entry
 * errors into a clean, user-facing prompt suitable for the lobby panel and popup modal.
 */
export function formatLobbyGameEnterError(
  err: unknown,
  charName?: string | null,
  lang: 'zh' | 'en' = getGameLang(),
): string {
  const isEn = lang === 'en'
  if (err instanceof DuplicateCharacterLoginError) {
    return formatDuplicateCharacterLoginMessage(err.charName || charName, lang)
  }
  const mcpStatus = parseMcpGameErrorStatus(err)
  if (mcpStatus) {
    return mcpStatus.kind === 'join'
      ? formatMcpJoinGameStatusError(mcpStatus.status, lang)
      : formatMcpCreateGameStatusError(mcpStatus.status, lang)
  }
  const raw = err instanceof Error ? err.message : String(err)
  const stripped = raw.replace(/^\[ProtocolError[^\]]*\]\s*/i, '').trim()
  const lower = stripped.toLowerCase()
  if (
    lower.includes('已经登录') ||
    lower.includes('已在其他页面登录') ||
    lower.includes('already logged in') ||
    lower.includes('already in a game') ||
    lower.includes('reason=0x6') ||
    lower.includes('reason=0x06') ||
    lower.includes('state=logonsent') ||
    lower.includes('charlocked')
  ) {
    return formatDuplicateCharacterLoginMessage(charName, lang)
  }
  if (/difficulty\s+"?nightmare"?\s+is not unlocked/i.test(stripped)) {
    return formatMcpJoinGameStatusError(0x73, lang)
  }
  if (/difficulty\s+"?hell"?\s+is not unlocked/i.test(stripped)) {
    return formatMcpJoinGameStatusError(0x74, lang)
  }
  if (/MCP_CHARLOGON\b/i.test(raw)) {
    return formatCharacterActionError(err, 'logon', lang)
  }
  if (/timed out|timeout/i.test(stripped)) {
    return isEn ? 'Timed out waiting for response.' : '等候回應時間超過。'
  }
  if (/MCP_CREATEGAME\b/i.test(raw)) {
    return isEn ? 'Error Creating Game' : '開創遊戲錯誤'
  }
  if (isRawTechnicalErrorString(raw)) {
    return isEn ? 'Join Failed' : '加入失敗'
  }
  return stripped || (isEn ? 'Join Failed' : '加入失敗')
}
