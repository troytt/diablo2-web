/**
 * Diablo II 1.13c D2Client game-loop tick scheduler (remote-game branch).
 *
 * Ground truth: D2Client.dll 1.13c main-loop pass 0x6FAF4C6F..0x6FAF4D79 (loop back-edge
 * 0x6FAF4EBA → 0x6FAF4B87):
 *
 * ```
 * 6faf4c6f: mov  edi,[0x6fba4318]        ; 40 (.data, never written)
 * 6faf4c7a: mov  eax,[0x6fbc97ec]        ; now
 * 6faf4c7f: mov  edx,[0x6fbc97f0]        ; lastTick
 * 6faf4c87: sub  esi,edx                 ; elapsed = now - lastTick
 * 6faf4c89: cmp  esi,edi ; jb no_tick    ; elapsed < 40: no tick on this pass
 * 6faf4c8d: cmp  eax,[0x6fbc981c]        ; now vs noCatchUpUntil
 * 6faf4c93: mov  [0x6fbc97f0],eax        ; lastTick = now
 * 6faf4ca0: jae  normal
 * 6faf4ca2: lea  ecx,[edi-1]             ; no-catch-up window: 39
 * 6faf4ca5: sub  esi,edi ; cmp esi,ecx ; jge → ecx = 39 else ecx = elapsed - 40
 * 6faf4cb1: mov  [0x6fbc97f0],now-ecx    ; lastTick = now - min(elapsed - 40, 39)
 * 6faf4cbd: mov  esi,edi                 ; elapsed := 40
 * 6faf4d62: call 0x6faf4a80              ; ONE game tick
 * 6faf4d67..6faf4d79: lastTick += 40 - elapsed
 *                                        ; normal: lastTick = oldLastTick + 40 (debt kept)
 *                                        ; window: lastTick = now - min(elapsed - 40, 39)
 * ```
 *
 * The original runs at most one tick per loop pass, but passes are back-to-back while the
 * window is active (`Sleep(10)` only when the app is inactive, 0x6FAECB94), and the draw at
 * 0x6FAF4E6E is skipped while the client is behind (frame-skip counter `[0x6FBD3490]`).
 * One browser frame stands in for the passes made between two presented frames:
 * `advance(nowMs)` repeats the per-pass rule with the same `now` until no tick is due, and
 * the caller draws once afterwards.
 *
 * The no-catch-up deadline `[0x6FBC981C]` only ever rises (`cmp eax,ecx ; jbe skip`). Raised by:
 *  - 0x03 LoadAct → 0x6FB5DB50 → 0x6FAF3F90: `now + 10000` (`add eax,0x2710` @0x6FAF40A4);
 *  - 0x15 Reassign of the LOCAL player (`cmp esi,[0x6fbcbbfc]` @0x6FB5F6EC): `now + 3000`
 *    (`add eax,0xbb8` @0x6FB5F717). The `D2Common #10716` gate before it (@0x6FB5F6FB) is a
 *    1.13c stub that always returns 0 (`xor eax,eax ; ret 4` @0x6FD8C380).
 *
 * Each owed tick runs on real time, not on the time it fell due: the tick body 0x6FAF4A80
 * starts by re-reading GetTickCount into `[0x6FBC97EC]` (`call [0x6FB7EF5C]` @0x6FAF4A81,
 * `mov [0x6FBC97EC],eax` @0x6FAF4A89). A browser frame runs its owed ticks back-to-back, so
 * they all get the frame's `now`.
 */

/** `[0x6FBA4318]` = 40 ms: the 25 Hz game tick. */
export const D2_LOGIC_TICK_MS = 40

/** `lea ecx,[edi-1]` @0x6FAF4CA2: the most debt kept on a tick inside a no-catch-up window. */
export const NO_CATCH_UP_MAX_CARRY_MS = D2_LOGIC_TICK_MS - 1

/** 0x03 LoadAct → 0x6FAF3F90: `add eax,0x2710` @0x6FAF40A4. */
export const LOAD_ACT_NO_CATCH_UP_MS = 10000

/** 0x15 Reassign of the local player: `add eax,0xbb8` @0x6FB5F717. */
export const LOCAL_REASSIGN_NO_CATCH_UP_MS = 3000

/**
 * Maximum synchronous catch-up ticks in a single frame outside a no-catch-up window
 * (`LOAD_ACT_NO_CATCH_UP_MS / D2_LOGIC_TICK_MS` = 250 ticks = 10 s).
 * Prevents main-thread hang / tick storm when a background tab is suspended by browser
 * intensive wake-up throttling (60 s+) or OS sleep.
 */
export const MAX_CATCH_UP_TICKS = LOAD_ACT_NO_CATCH_UP_MS / D2_LOGIC_TICK_MS

function requireFiniteMs(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number of milliseconds, got ${String(value)}`)
  }
}

export class LogicClock {
  /** `[0x6FBC97F0]`. */
  private lastTickMs: number
  /** `[0x6FBC981C]` (zero-initialised `.bss`). */
  private noCatchUpUntilMs = 0

  constructor(startMs: number) {
    requireFiniteMs('startMs', startMs)
    this.lastTickMs = startMs
  }

  /** Restart the schedule at `nowMs` with no debt (entering the in-game loop). */
  reset(nowMs: number): void {
    requireFiniteMs('nowMs', nowMs)
    this.lastTickMs = nowMs
  }

  /**
   * Run the per-pass rule at `nowMs` until no tick is due.
   *
   * @returns how many ticks are owed now.
   */
  advance(nowMs: number): number {
    requireFiniteMs('nowMs', nowMs)
    let owed = 0
    for (;;) {
      const elapsed = nowMs - this.lastTickMs
      // `jb` @0x6FAF4C8B. GetTickCount never runs behind lastTick in the original; a browser
      // frame timestamp can sit slightly before a `performance.now()` read in the same frame.
      if (elapsed < D2_LOGIC_TICK_MS) {
        return owed
      }
      if (nowMs < this.noCatchUpUntilMs) {
        this.lastTickMs = nowMs - Math.min(elapsed - D2_LOGIC_TICK_MS, NO_CATCH_UP_MAX_CARRY_MS)
      } else {
        this.lastTickMs += D2_LOGIC_TICK_MS
      }
      owed++
      if (owed >= MAX_CATCH_UP_TICKS) {
        const remaining = nowMs - this.lastTickMs
        if (remaining >= D2_LOGIC_TICK_MS) {
          this.lastTickMs = nowMs - (remaining % D2_LOGIC_TICK_MS)
        }
        return owed
      }
    }
  }

  /** Raise the no-catch-up deadline `[0x6FBC981C]` to `untilMs` (never lowers it). */
  suppressCatchUp(untilMs: number): void {
    requireFiniteMs('untilMs', untilMs)
    if (untilMs > this.noCatchUpUntilMs) {
      this.noCatchUpUntilMs = untilMs
    }
  }

  /** The current no-catch-up deadline (diagnostics and tests). */
  getNoCatchUpUntilMs(): number {
    return this.noCatchUpUntilMs
  }

  /** The time the last tick fell due, `[0x6FBC97F0]` (diagnostics and tests). */
  getLastTickMs(): number {
    return this.lastTickMs
  }

  /**
   * Fraction of the current 40 ms tick that has elapsed at `nowMs`, in `[0, 1)`: the sub-tick
   * interpolation factor PD2's `d2fps.dll` motion smoothing renders with. Call after `advance(nowMs)`.
   * 1.13c itself never interpolates (see `motion-smoothing.ts`).
   */
  getTickAlpha(nowMs: number): number {
    requireFiniteMs('nowMs', nowMs)
    const elapsed = nowMs - this.lastTickMs
    if (elapsed <= 0) return 0
    if (elapsed >= D2_LOGIC_TICK_MS) return MAX_TICK_ALPHA
    return elapsed / D2_LOGIC_TICK_MS
  }
}

/** Largest alpha `getTickAlpha` returns (a tick that is due but not yet run still draws the old state). */
export const MAX_TICK_ALPHA = (D2_LOGIC_TICK_MS - 1) / D2_LOGIC_TICK_MS

/**
 * Run every tick owed at `nowMs`, each with the real `nowMs` (see the file comment).
 *
 * @returns how many ticks ran.
 */
export function runOwedTicks(
  clock: LogicClock,
  nowMs: number,
  tick: (dtMs: number, nowMs: number) => void,
): number {
  const owed = clock.advance(nowMs)
  for (let i = 0; i < owed; i++) {
    tick(D2_LOGIC_TICK_MS, nowMs)
  }
  return owed
}
