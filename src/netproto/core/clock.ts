/**
 * Injectable Clock abstraction for deterministic session heartbeats and timeout testing.
 * Avoids ambient DOM/Node timer return types so `tsconfig.netproto.json` compiles with `types: []`.
 */

export interface Clock {
  now(): number
  setTimeout(cb: () => void, ms: number): () => void
  setInterval(cb: () => void, ms: number): () => void
}

interface RuntimeTimers {
  setTimeout(cb: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
  setInterval(cb: () => void, ms: number): unknown
  clearInterval(handle: unknown): void
  performance?: { now(): number }
}

export const systemClock: Clock = {
  now(): number {
    return Date.now()
  },
  setTimeout(cb: () => void, ms: number): () => void {
    const g = globalThis as unknown as RuntimeTimers
    const handle = g.setTimeout(cb, ms)
    return () => {
      g.clearTimeout(handle)
    }
  },
  setInterval(cb: () => void, ms: number): () => void {
    const g = globalThis as unknown as RuntimeTimers
    const handle = g.setInterval(cb, ms)
    return () => {
      g.clearInterval(handle)
    }
  },
}

export const defaultClock: Clock = systemClock

interface ScheduledTimer {
  readonly id: number
  dueMs: number
  readonly intervalMs: number | null
  readonly cb: () => void
  cancelled: boolean
}

export class FakeClock implements Clock {
  private currentMs: number
  private nextId = 1
  private readonly timers: ScheduledTimer[] = []

  constructor(initialMs = 1000) {
    this.currentMs = initialMs
  }

  now(): number {
    return this.currentMs
  }

  setTimeout(cb: () => void, ms: number): () => void {
    const timer: ScheduledTimer = {
      id: this.nextId++,
      dueMs: this.currentMs + Math.max(0, ms),
      intervalMs: null,
      cb,
      cancelled: false,
    }
    this.timers.push(timer)
    return () => {
      timer.cancelled = true
    }
  }

  setInterval(cb: () => void, ms: number): () => void {
    const step = Math.max(1, ms)
    const timer: ScheduledTimer = {
      id: this.nextId++,
      dueMs: this.currentMs + step,
      intervalMs: step,
      cb,
      cancelled: false,
    }
    this.timers.push(timer)
    return () => {
      timer.cancelled = true
    }
  }

  advance(deltaMs: number): void {
    const target = this.currentMs + Math.max(0, deltaMs)
    while (true) {
      let earliest: ScheduledTimer | null = null
      for (const t of this.timers) {
        if (t.cancelled || t.dueMs > target) continue
        if (earliest === null || t.dueMs < earliest.dueMs || (t.dueMs === earliest.dueMs && t.id < earliest.id)) {
          earliest = t
        }
      }
      if (earliest === null) break
      this.currentMs = earliest.dueMs
      if (earliest.intervalMs !== null) {
        earliest.dueMs += earliest.intervalMs
      } else {
        earliest.cancelled = true
      }
      earliest.cb()
    }
    this.currentMs = target
  }
}
