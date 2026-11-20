/**
 * Chat/Overhead Bubble Expiration and Player Squelch/Ignore Management (`src/client/world/world-chat-social.ts`).
 */

import {
  CHAT_LINE_TTL_MS,
  MESSAGE_LOG_MAX_ENTRIES,
  OVERHEAD_SPEECH_TTL_MS,
} from '../../common/chat/chat-113c.ts'
import type { ChatLogEntry, ClientWorldInternal } from './world-skill-state-tables.ts'

export function expireChatAndOverheadImpl(this: ClientWorldInternal, nowMs?: number): void {
  if (nowMs !== undefined && Number.isFinite(nowMs)) {
    this._clockMs = nowMs
    this._clockExplicit = true
  }
  const effNow =
    nowMs !== undefined && Number.isFinite(nowMs)
      ? nowMs
      : this._clockExplicit
        ? this._clockMs
        : typeof performance !== 'undefined'
          ? performance.now()
          : Date.now()
  for (let i = this._activeChatStream.length - 1; i >= 0; i--) {
    const entry = this._activeChatStream[i]!
    const expiredByElapsed = (entry.elapsedMs ?? 0) >= CHAT_LINE_TTL_MS
    const expiredByClock =
      effNow !== null &&
      entry.expireAtMs !== undefined &&
      entry.createdAtMs !== undefined &&
      effNow >= entry.expireAtMs &&
      effNow >= entry.createdAtMs
    if (expiredByElapsed || expiredByClock) {
      this._activeChatStream.splice(i, 1)
    }
  }
  for (const unit of this._units.values()) {
    if (unit.overheadText !== undefined && unit.overheadExpireMs !== undefined) {
      const prevElapsed = (unit as { _overheadElapsedMs?: number | undefined })._overheadElapsedMs ?? 0
      const expiredByElapsed = prevElapsed >= OVERHEAD_SPEECH_TTL_MS
      const expiredByClock = effNow !== null && effNow >= unit.overheadExpireMs
      if (expiredByElapsed || expiredByClock) {
        unit.overheadText = undefined
        unit.overheadExpireMs = undefined
        unit.overheadColor = undefined
        ;(unit as { _overheadElapsedMs?: number | undefined })._overheadElapsedMs = undefined
      }
    }
  }
}

export function addLocalSystemMessageImpl(this: ClientWorldInternal, text: string, color = 4, nowMs?: number): ChatLogEntry {
  const tNow = this.resolveEventNowMs(nowMs)
  const entry: ChatLogEntry = {
    id: this._nextChatEntryId++,
    kind: 'system',
    text,
    rawText: text,
    formattedEn: text,
    formattedZh: text,
    color,
    createdAtMs: tNow,
    expireAtMs: tNow + CHAT_LINE_TTL_MS,
    elapsedMs: 0,
  }
  this._chatLog.push(entry)
  while (this._chatLog.length > MESSAGE_LOG_MAX_ENTRIES) {
    this._chatLog.shift()
  }
  this._activeChatStream.push({ ...entry })
  while (this._activeChatStream.length > MESSAGE_LOG_MAX_ENTRIES) {
    this._activeChatStream.shift()
  }
  return entry
}

export function setPlayerSquelchedImpl(this: ClientWorldInternal, unitId: number, squelched: boolean): void {
  const member = this._party.get(unitId)
  if (squelched) {
    this._squelchedPlayerIds.add(unitId)
    if (member?.charName) {
      this._squelchedPlayerNames.add(member.charName.toLowerCase())
    }
  } else {
    this._squelchedPlayerIds.delete(unitId)
    if (member?.charName) {
      this._squelchedPlayerNames.delete(member.charName.toLowerCase())
    }
  }
  if (member) {
    member.squelched = squelched
  }
}

export function setPlayerIgnoredImpl(this: ClientWorldInternal, unitId: number, ignored: boolean): void {
  const member = this._party.get(unitId)
  if (ignored) {
    this._ignoredPlayerIds.add(unitId)
    if (member?.charName) {
      this._ignoredPlayerNames.add(member.charName.toLowerCase())
    }
  } else {
    this._ignoredPlayerIds.delete(unitId)
    if (member?.charName) {
      this._ignoredPlayerNames.delete(member.charName.toLowerCase())
    }
  }
  if (member) {
    member.ignored = ignored
  }
}

export function isPlayerSquelchedImpl(this: ClientWorldInternal, unitIdOrName?: number | string, charName?: string): boolean {
  const unitId = typeof unitIdOrName === 'number' ? unitIdOrName : undefined
  const nameArg = typeof unitIdOrName === 'string' ? unitIdOrName : charName
  if (unitId !== undefined && unitId !== 0) {
    if (this._squelchedPlayerIds.has(unitId)) return true
    if (this._party.get(unitId)?.squelched === true) return true
  }
  if (nameArg) {
    const lower = nameArg.toLowerCase()
    if (this._squelchedPlayerNames.has(lower)) return true
    for (const m of this._party.values()) {
      if (m.squelched && m.charName && m.charName.toLowerCase() === lower) {
        return true
      }
    }
  }
  return false
}

export function isPlayerIgnoredImpl(this: ClientWorldInternal, unitIdOrName?: number | string, charName?: string): boolean {
  const unitId = typeof unitIdOrName === 'number' ? unitIdOrName : undefined
  const nameArg = typeof unitIdOrName === 'string' ? unitIdOrName : charName
  if (unitId !== undefined && unitId !== 0) {
    if (this._ignoredPlayerIds.has(unitId)) return true
    if (this._party.get(unitId)?.ignored === true) return true
  }
  if (nameArg) {
    const lower = nameArg.toLowerCase()
    if (this._ignoredPlayerNames.has(lower)) return true
    for (const m of this._party.values()) {
      if (m.ignored && m.charName && m.charName.toLowerCase() === lower) {
        return true
      }
    }
  }
  return false
}
