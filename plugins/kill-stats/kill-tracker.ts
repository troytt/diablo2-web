/**
 * Real-time in-game hostile monster death tracker (`KillTracker`) for `play.html`.
 *
 * Subscribes to `OnlineSession.onServerEvent` and `OnlineSession.onStateChange`, applies
 * 1.13c monster kill eligibility rules (`MonStats.txt` + `D2Game.dll` `0x6fcacd52..0x6fcacdb8`),
 * tracks per-GUID death/revive state transitions, batches deltas for 2 seconds, persists to
 * `KillStatsRepository`, and notifies open `stats.html` tabs via `BroadcastChannel`.
 */

import type {
  PluginLogger,
  PluginSessionView,
} from '../../src/client/plugin-host/api.ts'
import { getMonsterKindByClassId } from '../../src/common/units/monsters-data.ts'
import {
  unitTypeFromId,
  type CharClassId,
  type ServerEvent,
} from '../../src/netproto/index.ts'
import {
  KILL_STATS_CHANNEL_NAME,
  SUPERUNIQUE_COUNT,
  computeCharKey,
  computeDeltaKey,
  type KillCharacterProfile,
  type KillDifficulty,
  type KillStatsBroadcastMessage,
  type KillTallyDelta,
  type KillTallyKind,
} from './kill-stats-model.ts'
import {
  IndexedDbKillStatsRepository,
  type KillStatsRepository,
} from './kill-stats-store.ts'
import { isCountableKillClass } from './monster-kill-classes.ts'

export interface KillTrackerScheduler {
  setTimeout(cb: () => void, delayMs: number): unknown
  clearTimeout(handle: unknown): void
}

export interface BroadcastChannelLike {
  postMessage(message: unknown): void
  close(): void
}

export interface KillTrackerDocumentLike {
  readonly visibilityState?: string | undefined
  addEventListener?(type: string, listener: () => void): void
  removeEventListener?(type: string, listener: () => void): void
}

export interface KillTrackerWindowLike {
  addEventListener?(type: string, listener: () => void): void
  removeEventListener?(type: string, listener: () => void): void
  readonly document?: KillTrackerDocumentLike | undefined
}

export type SessionIdentityResolution =
  | { readonly ok: true; readonly profile: KillCharacterProfile }
  | { readonly ok: false; readonly reason: string }

export interface KillTrackerStatus {
  readonly pendingKills: number
  readonly pendingDeltasCount: number
  readonly lastFlushAt: number | null
  readonly lastError: string | null
  readonly lastSkipReason: string | null
  readonly difficulty: KillDifficulty | null
}

export interface KillTrackerOptions {
  readonly session: PluginSessionView
  readonly repository?: KillStatsRepository | undefined
  readonly resolveIdentity?:
    | ((session: PluginSessionView) => KillCharacterProfile | SessionIdentityResolution | null)
    | undefined
  readonly log?: PluginLogger | undefined
  readonly onStatusChange?: (() => void) | undefined
  readonly now?: (() => number) | undefined
  readonly scheduler?: KillTrackerScheduler | undefined
  readonly channelFactory?: ((name: string) => BroadcastChannelLike | null) | undefined
  readonly windowLike?: KillTrackerWindowLike | null | undefined
  readonly flushDelayMs?: number | undefined
  readonly maxBackoffMs?: number | undefined
}

interface TrackedMonsterUnit {
  readonly classId: number
  readonly isSuperUnique: boolean
  readonly superUniqueId: number | undefined
  state: 'armed' | 'dead'
}

interface PendingCharacterBatch {
  profile: KillCharacterProfile
  readonly deltas: Map<string, KillTallyDelta>
}

/**
 * Resolves the active 4-tuple character identity `(host, realm, account, charName)` and
 * character profile metadata from `PluginSessionView`.
 *
 * Fail-fast invariant: NEVER default `charClass` to `0`, `level` to `1`, or
 * `hardcore`/`expansion`/`ladder` to guessed values. Requires `hasGameFlags === true`,
 * valid integer `charClass` in `0..6`, and finite integer `level >= 1`.
 */
export function resolveSessionIdentity(
  session: PluginSessionView,
  hasGameFlags = true,
): SessionIdentityResolution {
  const host = (session.loginHost ?? '').trim()
  const snap = session.getSnapshot()
  const realm = (snap.selectedRealm?.title ?? '').trim()
  const account = (snap.username ?? '').trim()
  const charName = (snap.selectedChar ?? '').trim()

  if (!host || !realm || !account || !charName) {
    return {
      ok: false,
      reason: 'incomplete character identity (host, realm, account, charName)',
    }
  }

  if (!hasGameFlags) {
    return {
      ok: false,
      reason: 'GameFlags (0x01) difficulty has not been received in this game',
    }
  }

  const lowerName = charName.toLowerCase()
  const matchedChar = snap.characters.find(
    (c) => c.name.trim().toLowerCase() === lowerName,
  )

  const selfClass = session.world.self.charClass
  let charClass: CharClassId | null = null
  if (
    typeof selfClass === 'number' &&
    Number.isInteger(selfClass) &&
    selfClass >= 0 &&
    selfClass <= 6
  ) {
    charClass = selfClass as CharClassId
  } else if (
    matchedChar &&
    typeof matchedChar.charClass === 'number' &&
    Number.isInteger(matchedChar.charClass) &&
    matchedChar.charClass >= 0 &&
    matchedChar.charClass <= 6
  ) {
    charClass = matchedChar.charClass as CharClassId
  }
  if (charClass === null) {
    return {
      ok: false,
      reason: 'missing or invalid character class (expected integer 0..6)',
    }
  }

  const selfLevel = session.world.self.level
  let rawLevel: number | null = null
  if (
    typeof selfLevel === 'number' &&
    Number.isFinite(selfLevel) &&
    Math.trunc(selfLevel) >= 1
  ) {
    rawLevel = Math.trunc(selfLevel)
  } else if (
    matchedChar &&
    typeof matchedChar.level === 'number' &&
    Number.isFinite(matchedChar.level) &&
    Math.trunc(matchedChar.level) >= 1
  ) {
    rawLevel = Math.trunc(matchedChar.level)
  }
  if (rawLevel === null) {
    return {
      ok: false,
      reason: 'missing or invalid character level (expected finite integer >= 1)',
    }
  }
  const level = Math.min(99, rawLevel)

  if (
    typeof session.world.hardcore !== 'boolean' ||
    typeof session.world.expansion !== 'boolean' ||
    typeof session.world.ladder !== 'boolean'
  ) {
    return {
      ok: false,
      reason: 'missing authoritative world mode flags (hardcore, expansion, ladder)',
    }
  }

  const charKey = computeCharKey(host, realm, account, charName)

  return {
    ok: true,
    profile: {
      charKey,
      host,
      realm,
      account,
      charName,
      charClass,
      level,
      hardcore: session.world.hardcore,
      expansion: session.world.expansion,
      ladder: session.world.ladder,
    },
  }
}

const DEFAULT_SCHEDULER: KillTrackerScheduler = {
  setTimeout: (cb, delayMs) => globalThis.setTimeout(cb, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}

const DEFAULT_LOGGER: PluginLogger = {
  info: (msg, ...args) => console.info(`[KillTracker] ${msg}`, ...args),
  warn: (msg, ...args) => console.warn(`[KillTracker] ${msg}`, ...args),
  error: (msg, ...args) => console.error(`[KillTracker] ${msg}`, ...args),
}

function defaultChannelFactory(name: string): BroadcastChannelLike | null {
  if (typeof globalThis.BroadcastChannel !== 'function') return null
  try {
    return new globalThis.BroadcastChannel(name)
  } catch {
    return null
  }
}

export class KillTracker {
  readonly repository: KillStatsRepository
  private readonly session: PluginSessionView
  private readonly resolveIdentityFn: (
    session: PluginSessionView,
  ) => KillCharacterProfile | SessionIdentityResolution | null
  private readonly log: PluginLogger
  private readonly onStatusChange: (() => void) | undefined
  private readonly now: () => number
  private readonly scheduler: KillTrackerScheduler
  private readonly channel: BroadcastChannelLike | null
  private readonly windowLike: KillTrackerWindowLike | null
  private readonly flushDelayMs: number
  private readonly maxBackoffMs: number

  private difficulty: KillDifficulty | null = null
  private readonly units = new Map<number, TrackedMonsterUnit>()
  private readonly owned = new Set<number>()
  private warnedMissingGameFlags = false
  private warnedMissingIdentity = false
  private lastSkipReason: string | null = null
  private lastPhase: string

  private readonly pendingByChar = new Map<string, PendingCharacterBatch>()
  private flushTimer: unknown = null
  private retryAttempts = 0
  private lastFlushAt: number | null = null
  private lastError: string | null = null
  private inFlightFlush: Promise<void> | null = null

  private readonly unsubServerEvent: () => void
  private readonly unsubStateChange: () => void
  private readonly onVisibilityChangeBound: () => void
  private readonly onPageHideBound: () => void

  constructor(options: KillTrackerOptions) {
    this.session = options.session
    this.now = options.now ?? (() => Date.now())
    this.repository =
      options.repository ?? new IndexedDbKillStatsRepository({ now: this.now })
    this.resolveIdentityFn =
      options.resolveIdentity ??
      ((s) => resolveSessionIdentity(s, this.difficulty !== null))
    this.log = options.log ?? DEFAULT_LOGGER
    this.onStatusChange = options.onStatusChange
    this.scheduler = options.scheduler ?? DEFAULT_SCHEDULER
    const createChannel = options.channelFactory ?? defaultChannelFactory
    this.channel = createChannel(KILL_STATS_CHANNEL_NAME)
    this.windowLike =
      options.windowLike !== undefined
        ? options.windowLike
        : typeof globalThis.window !== 'undefined'
          ? (globalThis.window as unknown as KillTrackerWindowLike)
          : null
    this.flushDelayMs = options.flushDelayMs ?? 2000
    this.maxBackoffMs = options.maxBackoffMs ?? 60000
    this.lastPhase = this.session.phase

    this.unsubServerEvent = this.session.onServerEvent((ev) => {
      try {
        this.handleServerEvent(ev)
      } catch (err) {
        this.recordInternalError('Error in onServerEvent listener', err)
      }
    })

    this.unsubStateChange = this.session.onStateChange((snap) => {
      try {
        this.handlePhaseChange(snap.phase)
      } catch (err) {
        this.recordInternalError('Error in onStateChange listener', err)
      }
    })

    this.onVisibilityChangeBound = () => {
      try {
        if (this.windowLike?.document?.visibilityState === 'hidden') {
          void this.flushNow()
        }
      } catch (err) {
        this.recordInternalError('Error in visibilitychange listener', err)
      }
    }

    this.onPageHideBound = () => {
      try {
        void this.flushNow()
      } catch (err) {
        this.recordInternalError('Error in pagehide listener', err)
      }
    }

    this.windowLike?.document?.addEventListener?.(
      'visibilitychange',
      this.onVisibilityChangeBound,
    )
    this.windowLike?.addEventListener?.('pagehide', this.onPageHideBound)
  }

  getStatus(): KillTrackerStatus {
    let pendingKills = 0
    let pendingDeltasCount = 0
    for (const batch of this.pendingByChar.values()) {
      for (const delta of batch.deltas.values()) {
        pendingDeltasCount++
        if (delta.kind === 'monster') {
          pendingKills += delta.count
        }
      }
    }
    return {
      pendingKills,
      pendingDeltasCount,
      lastFlushAt: this.lastFlushAt,
      lastError: this.lastError,
      lastSkipReason: this.lastSkipReason,
      difficulty: this.difficulty,
    }
  }

  stopListening(): void {
    this.unsubServerEvent()
    this.unsubStateChange()
    this.windowLike?.document?.removeEventListener?.(
      'visibilitychange',
      this.onVisibilityChangeBound,
    )
    this.windowLike?.removeEventListener?.('pagehide', this.onPageHideBound)
    this.clearFlushTimer()
  }

  destroy(): void {
    this.stopListening()
    try {
      this.channel?.close()
    } catch {
      // Ignore channel close errors
    }
  }

  private recordInternalError(prefix: string, err: unknown): void {
    const detail = err instanceof Error ? err.message : String(err)
    this.lastError = `${prefix}: ${detail}`
    this.log.error(`${prefix}:`, err)
    this.onStatusChange?.()
  }

  private resetPerGameState(): void {
    this.difficulty = null
    this.units.clear()
    this.owned.clear()
    this.warnedMissingGameFlags = false
    this.warnedMissingIdentity = false
    this.lastSkipReason = null
  }

  private handlePhaseChange(nextPhase: string): void {
    const prevPhase = this.lastPhase
    this.lastPhase = nextPhase

    if (prevPhase !== 'ingame' && nextPhase === 'ingame') {
      this.resetPerGameState()
      this.onStatusChange?.()
    } else if (prevPhase === 'ingame' && nextPhase !== 'ingame') {
      this.resetPerGameState()
      this.onStatusChange?.()
      void this.flushNow()
    }
  }

  private handleServerEvent(ev: ServerEvent): void {
    if (this.session.phase !== 'ingame') {
      return
    }

    switch (ev.type) {
      case 'GameFlags': {
        this.resetPerGameState()
        if (ev.difficulty === 0 || ev.difficulty === 1 || ev.difficulty === 2) {
          this.difficulty = ev.difficulty
        }
        this.onStatusChange?.()
        return
      }

      case 'Merc': {
        if (ev.kind === 'assign' && ev.mercId !== undefined && ev.mercId !== 0) {
          this.owned.add(ev.mercId)
          this.units.delete(ev.mercId)
        }
        return
      }

      case 'UnitRemove': {
        if (unitTypeFromId(ev.unitType) === 'monster') {
          this.units.delete(ev.id)
        }
        return
      }

      case 'UnitAssign': {
        const u = ev.unit
        if (unitTypeFromId(u.unitType) !== 'monster') {
          return
        }
        if (u.ownerId !== undefined && u.ownerId !== 0) {
          this.owned.add(u.id)
          this.units.delete(u.id)
          return
        }
        if (this.owned.has(u.id)) {
          this.units.delete(u.id)
          return
        }
        if (!isCountableKillClass(u.classId)) {
          this.units.delete(u.id)
          return
        }

        const isAlive =
          (u.lifePct === undefined || u.lifePct > 0) &&
          u.mode !== 0 &&
          u.mode !== 12

        this.units.set(u.id, {
          classId: u.classId,
          isSuperUnique: Boolean(u.isSuperUnique),
          superUniqueId: u.superUniqueId,
          state: isAlive ? 'armed' : 'dead',
        })
        return
      }

      case 'UnitMode': {
        if (unitTypeFromId(ev.unitType) !== 'monster') {
          return
        }
        if (ev.mode === undefined) {
          return
        }
        if (this.owned.has(ev.id)) {
          return
        }
        const tracked = this.units.get(ev.id)
        if (!tracked) {
          return
        }

        if (tracked.state === 'armed' && (ev.mode === 0 || ev.mode === 12)) {
          tracked.state = 'dead'
          this.recordKill(tracked)
        } else if (
          tracked.state === 'dead' &&
          ev.mode >= 1 &&
          ev.mode <= 15 &&
          ev.mode !== 12
        ) {
          tracked.state = 'armed'
        }
        return
      }

      default:
        return
    }
  }

  private isSoloKillNow(): boolean {
    const selfId = this.session.world.selfId
    const selfName = (
      this.session.world.self.name ||
      this.session.getSnapshot().selectedChar ||
      ''
    )
      .trim()
      .toLowerCase()
    for (const member of this.session.world.party.values()) {
      if (member.unitId === 0 || member.unitId === selfId) {
        continue
      }
      if (
        selfId === 0 &&
        selfName.length > 0 &&
        member.charName &&
        member.charName.trim().toLowerCase() === selfName
      ) {
        continue
      }
      return false
    }
    return true
  }

  private evaluateIdentity(): SessionIdentityResolution {
    const raw = this.resolveIdentityFn(this.session)
    if (!raw) {
      return {
        ok: false,
        reason: 'incomplete character identity (host, realm, account, charName)',
      }
    }
    if ('ok' in raw) {
      return raw
    }
    if (
      !raw.host.trim() ||
      !raw.realm.trim() ||
      !raw.account.trim() ||
      !raw.charName.trim()
    ) {
      return {
        ok: false,
        reason: 'incomplete character identity (host, realm, account, charName)',
      }
    }
    return { ok: true, profile: raw }
  }

  private recordKill(unit: TrackedMonsterUnit): void {
    if (this.difficulty === null) {
      const reason = 'GameFlags (0x01) difficulty has not been received in this game'
      const changed = this.lastSkipReason !== reason
      this.lastSkipReason = reason
      if (!this.warnedMissingGameFlags) {
        this.warnedMissingGameFlags = true
        this.log.warn(`Skipping monster kill count: ${reason}`)
      }
      if (changed) {
        this.onStatusChange?.()
      }
      return
    }

    const identityRes = this.evaluateIdentity()
    if (!identityRes.ok) {
      const changed = this.lastSkipReason !== identityRes.reason
      this.lastSkipReason = identityRes.reason
      if (!this.warnedMissingIdentity) {
        this.warnedMissingIdentity = true
        this.log.warn(`Skipping monster kill count: ${identityRes.reason}`)
      }
      if (changed) {
        this.onStatusChange?.()
      }
      return
    }
    const profile = identityRes.profile
    if (this.lastSkipReason !== null) {
      this.lastSkipReason = null
      this.onStatusChange?.()
    }

    if (!isCountableKillClass(unit.classId)) {
      return
    }
    const kind = getMonsterKindByClassId(unit.classId)
    if (!kind || !kind.killable) {
      return
    }

    const difficulty = this.difficulty
    const isSolo = this.isSoloKillNow()
    const at = this.now()

    this.enqueueDelta(profile, 'monster', difficulty, unit.classId, isSolo, at)

    if (unit.isSuperUnique) {
      if (
        unit.superUniqueId !== undefined &&
        Number.isInteger(unit.superUniqueId) &&
        unit.superUniqueId >= 0 &&
        unit.superUniqueId < SUPERUNIQUE_COUNT
      ) {
        this.enqueueDelta(
          profile,
          'superunique',
          difficulty,
          unit.superUniqueId,
          isSolo,
          at,
        )
      } else {
        const msg = `Out-of-range superUniqueId ${String(unit.superUniqueId)} for monster classId ${unit.classId}`
        this.lastError = msg
        this.log.error(msg)
        this.onStatusChange?.()
      }
    } else if (kind.boss === true) {
      this.enqueueDelta(profile, 'boss', difficulty, unit.classId, isSolo, at)
    }

    if (this.flushTimer === null) {
      this.scheduleFlush(this.flushDelayMs)
    }
  }

  private enqueueDelta(
    profile: KillCharacterProfile,
    kind: KillTallyKind,
    difficulty: KillDifficulty,
    subject: number,
    isSolo: boolean,
    at: number,
  ): void {
    let charBatch = this.pendingByChar.get(profile.charKey)
    if (!charBatch) {
      charBatch = {
        profile,
        deltas: new Map<string, KillTallyDelta>(),
      }
      this.pendingByChar.set(profile.charKey, charBatch)
    } else {
      charBatch.profile = profile
    }

    const deltaKey = computeDeltaKey(profile.charKey, kind, difficulty, subject)
    const existing = charBatch.deltas.get(deltaKey)
    if (!existing) {
      charBatch.deltas.set(deltaKey, {
        charKey: profile.charKey,
        kind,
        difficulty,
        subject,
        count: 1,
        soloCount: isSolo ? 1 : 0,
        firstAt: at,
        lastAt: at,
      })
    } else {
      charBatch.deltas.set(deltaKey, {
        charKey: profile.charKey,
        kind,
        difficulty,
        subject,
        count: existing.count + 1,
        soloCount: existing.soloCount + (isSolo ? 1 : 0),
        firstAt: Math.min(existing.firstAt, at),
        lastAt: Math.max(existing.lastAt, at),
      })
    }
  }

  private mergeBatchBackOnFailure(failedBatch: PendingCharacterBatch): void {
    let currentBatch = this.pendingByChar.get(failedBatch.profile.charKey)
    if (!currentBatch) {
      currentBatch = {
        profile: failedBatch.profile,
        deltas: new Map<string, KillTallyDelta>(),
      }
      this.pendingByChar.set(failedBatch.profile.charKey, currentBatch)
    }

    for (const [deltaKey, failedDelta] of failedBatch.deltas.entries()) {
      const existing = currentBatch.deltas.get(deltaKey)
      if (!existing) {
        currentBatch.deltas.set(deltaKey, failedDelta)
      } else {
        currentBatch.deltas.set(deltaKey, {
          charKey: failedDelta.charKey,
          kind: failedDelta.kind,
          difficulty: failedDelta.difficulty,
          subject: failedDelta.subject,
          count: failedDelta.count + existing.count,
          soloCount: failedDelta.soloCount + existing.soloCount,
          firstAt: Math.min(failedDelta.firstAt, existing.firstAt),
          lastAt: Math.max(failedDelta.lastAt, existing.lastAt),
        })
      }
    }
  }

  private clearFlushTimer(): void {
    if (this.flushTimer !== null) {
      this.scheduler.clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }

  private scheduleFlush(delayMs: number): void {
    this.clearFlushTimer()
    this.flushTimer = this.scheduler.setTimeout(() => {
      this.flushTimer = null
      void this.flushNow()
    }, delayMs)
  }

  async flushNow(): Promise<void> {
    this.clearFlushTimer()
    if (this.inFlightFlush) {
      await this.inFlightFlush
    }
    if (this.pendingByChar.size === 0) {
      return
    }

    const run = async (): Promise<void> => {
      const batches = [...this.pendingByChar.values()]
      this.pendingByChar.clear()
      const flushAt = this.now()
      let anySucceeded = false
      let failedError: unknown = null

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]!
        const deltas = [...batch.deltas.values()]
        if (deltas.length === 0) continue
        try {
          await this.repository.applyBatch({
            character: batch.profile,
            deltas,
            at: flushAt,
          })
          anySucceeded = true
        } catch (err) {
          failedError = err
          for (let j = i; j < batches.length; j++) {
            this.mergeBatchBackOnFailure(batches[j]!)
          }
          break
        }
      }

      if (anySucceeded) {
        this.lastFlushAt = flushAt
        try {
          const msg: KillStatsBroadcastMessage = {
            type: 'updated',
            at: flushAt,
          }
          this.channel?.postMessage(msg)
        } catch {
          // Ignore BroadcastChannel errors
        }
      }

      if (failedError !== null) {
        this.retryAttempts++
        const msg =
          failedError instanceof Error ? failedError.message : String(failedError)
        this.lastError = msg
        this.log.error('Failed to flush kill stats batch:', failedError)
        this.onStatusChange?.()
        const backoffMs = Math.min(
          this.maxBackoffMs,
          this.flushDelayMs * Math.pow(2, this.retryAttempts - 1),
        )
        this.scheduleFlush(backoffMs)
      } else {
        this.retryAttempts = 0
        if (anySucceeded) {
          this.onStatusChange?.()
        }
        if (this.pendingByChar.size > 0 && this.flushTimer === null) {
          this.scheduleFlush(this.flushDelayMs)
        }
      }
    }

    const p = run()
    this.inFlightFlush = p
    try {
      await p
    } finally {
      if (this.inFlightFlush === p) {
        this.inFlightFlush = null
      }
    }
  }
}
