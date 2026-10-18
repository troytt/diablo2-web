import type { ClientCommand } from '../../netproto/index.ts'

export type CommandRateCategory =
  | 'movement'
  | 'skill'
  | 'chat'
  | 'interaction'
  | 'heartbeat'

export interface OutboundRateLimiterConfig {
  /**
   * Opt-in minimum interval (ms) between consecutive movement packets (`0x01`..`0x04`). Default `0`:
   * 1.13c has no movement interval — the only send-side throttles are the hold-walk 7-frame gate
   * (D2Client 0x6fac86a0, input layer) and the identical-packet dedupe (D2Client 0x6fac43e0,
   * `c2s-identical-dedupe-113c.ts`).
   */
  readonly moveMinIntervalMs?: number | undefined
  /** Opt-in minimum interval (ms) between consecutive skill packets. Default `0` (1.13c has none). */
  readonly skillMinIntervalMs?: number | undefined
  /** Opt-in minimum interval (ms) between consecutive chat packets. Default `0`. */
  readonly chatMinIntervalMs?: number | undefined
  /** Opt-in minimum interval (ms) between object/item/NPC interaction packets. Default `0`. */
  readonly interactionMinIntervalMs?: number | undefined
  /** Opt-in token bucket burst capacity across all non-heartbeat outbound packets. */
  readonly burstCapacity?: number | undefined
  /** Opt-in token refill rate in tokens per second. */
  readonly refillPerSec?: number | undefined
}

export interface RateLimitDecision {
  readonly allowed: boolean
  readonly category: CommandRateCategory
  readonly reason?: 'category_cooldown' | 'token_bucket_empty' | undefined
  readonly retryAfterMs: number
  readonly coalesced?: boolean | undefined
}

export type RateLimitAcquireResult = RateLimitDecision
export type RateLimiterConfig = OutboundRateLimiterConfig

/**
 * Production defaults: 120ms movement coalescing cooldown (`0x01`..`0x04`) so hold movement
 * commands within the debounce window are coalesced into `pendingMove` and flushed
 * on `tick()`, while non-movement commands (skills, interactions, chat) have 0ms interval throttle
 * (#575). Byte-identical wire packet suppression lives in `c2s-identical-dedupe-113c.ts`.
 */
export const DEFAULT_RATE_LIMITS: Readonly<{
  moveMinIntervalMs: number
  skillMinIntervalMs: number
  chatMinIntervalMs: number
  interactionMinIntervalMs: number
  burstCapacity: number
  refillPerSec: number
}> = Object.freeze({
  moveMinIntervalMs: 120,
  skillMinIntervalMs: 0,
  chatMinIntervalMs: 0,
  interactionMinIntervalMs: 0,
  burstCapacity: 1000,
  refillPerSec: 1000,
})

export function classifyClientCommand(cmd: ClientCommand): CommandRateCategory {
  switch (cmd.type) {
    case 'Move':
    case 'MoveToUnit':
    case 'WalkToLocation':
    case 'RunToLocation':
    case 'WalkToTarget':
    case 'RunToTarget':
      return 'movement'
    case 'SkillAt':
    case 'SkillOn':
    case 'CastLeftSkillOnLocation':
    case 'CastLeftSkillOnTarget':
    case 'CastRightSkillOnLocation':
    case 'CastRightSkillOnTarget':
    case 'SelectSkill':
      return 'skill'
    case 'Chat':
    case 'OverheadChat':
      return 'chat'
    case 'Ping':
      return 'heartbeat'
    default:
      return 'interaction'
  }
}

/**
 * Outbound C→S packet rate limiter. Implements OPT-IN per-category minimum intervals, coalesced
 * trailing movement emission, and a global token bucket for tools/bots that need them.
 *
 * 1.13c parity: with `DEFAULT_RATE_LIMITS` nothing is throttled (#575 non-movement, #808 movement).
 * 1.13c's only send-side suppression is the identical-packet dedupe of D2Client 0x6fac43e0
 * (`c2s-identical-dedupe-113c.ts`, applied at the session's single send choke point) — the former
 * 350 ms "duplicate move" rule had no 1.13c counterpart and was removed.
 */
export class OutboundRateLimiter {
  private readonly moveMinIntervalMs: number
  private readonly skillMinIntervalMs: number
  private readonly chatMinIntervalMs: number
  private readonly interactionMinIntervalMs: number
  private readonly burstCapacity: number
  private readonly refillPerSec: number

  private tokens: number
  private lastRefillMs: number | null = null
  private readonly lastSentByCategory = new Map<CommandRateCategory, number>()
  private pendingMove: { readonly cmd: ClientCommand; readonly queuedAtMs: number } | null = null

  allowedCount = 0
  throttledCount = 0
  coalescedCount = 0

  constructor(config?: OutboundRateLimiterConfig) {
    this.moveMinIntervalMs = Math.max(0, config?.moveMinIntervalMs ?? DEFAULT_RATE_LIMITS.moveMinIntervalMs)
    this.skillMinIntervalMs = Math.max(0, config?.skillMinIntervalMs ?? DEFAULT_RATE_LIMITS.skillMinIntervalMs)
    this.chatMinIntervalMs = Math.max(0, config?.chatMinIntervalMs ?? DEFAULT_RATE_LIMITS.chatMinIntervalMs)
    this.interactionMinIntervalMs = Math.max(0, config?.interactionMinIntervalMs ?? DEFAULT_RATE_LIMITS.interactionMinIntervalMs)
    this.burstCapacity = Math.max(1, config?.burstCapacity ?? DEFAULT_RATE_LIMITS.burstCapacity)
    this.refillPerSec = Math.max(1, config?.refillPerSec ?? DEFAULT_RATE_LIMITS.refillPerSec)
    this.tokens = this.burstCapacity
  }

  private refillTokens(nowMs: number): void {
    if (this.lastRefillMs === null) {
      this.lastRefillMs = nowMs
      return
    }
    const elapsedSec = Math.max(0, (nowMs - this.lastRefillMs) / 1000)
    if (elapsedSec > 0) {
      this.tokens = Math.min(this.burstCapacity, this.tokens + elapsedSec * this.refillPerSec)
      this.lastRefillMs = nowMs
    }
  }

  private minIntervalForCategory(cat: CommandRateCategory): number {
    switch (cat) {
      case 'movement':
        return this.moveMinIntervalMs
      case 'skill':
        return this.skillMinIntervalMs
      case 'chat':
        return this.chatMinIntervalMs
      case 'interaction':
        return this.interactionMinIntervalMs
      case 'heartbeat':
        return 0
    }
  }

  /**
   * Evaluate whether `cmd` can be transmitted at `nowMs`.
   * If a movement command is throttled by cooldown, it is coalesced as `pendingMove`
   * so `flushPendingMove(nowMs)` can emit the latest cursor destination when the cooldown expires.
   */
  tryAcquire(cmd: ClientCommand, nowMs: number = performance.now(), options?: { readonly freshPress?: boolean }): RateLimitDecision {
    this.refillTokens(nowMs)
    const category = classifyClientCommand(cmd)

    // Heartbeat (Ping) always bypasses flood limits
    if (category === 'heartbeat') {
      this.allowedCount += 1
      return { allowed: true, category, retryAfterMs: 0 }
    }

    const minInterval = options?.freshPress && category === 'movement' ? 0 : this.minIntervalForCategory(category)
    const lastCatMs = this.lastSentByCategory.get(category)
    if (lastCatMs !== undefined && nowMs - lastCatMs < minInterval) {
      const retryAfterMs = Math.max(1, minInterval - (nowMs - lastCatMs))
      this.throttledCount += 1
      if (category === 'movement') {
        this.pendingMove = { cmd, queuedAtMs: nowMs }
        this.coalescedCount += 1
        return {
          allowed: false,
          category,
          reason: 'category_cooldown',
          retryAfterMs,
          coalesced: true,
        }
      }
      return {
        allowed: false,
        category,
        reason: 'category_cooldown',
        retryAfterMs,
      }
    }

    if (this.tokens < 1) {
      const deficit = 1 - this.tokens
      const retryAfterMs = Math.ceil((deficit / this.refillPerSec) * 1000)
      this.throttledCount += 1
      if (category === 'movement') {
        this.pendingMove = { cmd, queuedAtMs: nowMs }
        this.coalescedCount += 1
      }
      return {
        allowed: false,
        category,
        reason: 'token_bucket_empty',
        retryAfterMs: Math.max(1, retryAfterMs),
        coalesced: category === 'movement' ? true : undefined,
      }
    }

    this.tokens -= 1
    this.lastSentByCategory.set(category, nowMs)
    if (category === 'movement') {
      this.pendingMove = null
    }
    this.allowedCount += 1
    return {
      allowed: true,
      category,
      retryAfterMs: 0,
    }
  }

  /**
   * If a movement command was coalesced during cooldown and is now eligible to send at `nowMs`,
   * pops and returns it.
   */
  flushPendingMove(nowMs: number = performance.now()): ClientCommand | null {
    if (!this.pendingMove) return null
    const candidate = this.pendingMove.cmd
    const decision = this.tryAcquire(candidate, nowMs)
    if (decision.allowed) {
      return candidate
    }
    return null
  }

  /**
   * Discard any coalesced movement command when an interaction or stop supersedes it.
   */
  clearPendingMove(): void {
    this.pendingMove = null
  }

  getAvailableTokens(nowMs?: number): number {
    if (nowMs !== undefined) {
      this.refillTokens(nowMs)
    }
    return this.tokens
  }

  reset(): void {
    this.tokens = this.burstCapacity
    this.lastRefillMs = null
    this.lastSentByCategory.clear()
    this.pendingMove = null
    this.allowedCount = 0
    this.throttledCount = 0
    this.coalescedCount = 0
  }
}
