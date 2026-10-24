/**
 * The 1.13c client FPS counter 0x6fb0a9a0 (called once per rendered game frame at 0x6faf4392, after
 * the UI). Its value `[0x6fbcc2ac]` gates the lightning flash (`cmp 0xa; jb` @0x6fb306c2).
 *
 * ```c
 * DWORD now = GetTickCount();                                       // [0x6fb7ef5c]
 * if ((DWORD)(now - windowStart) <= 1000) frames++;                 // 0x6fb0a9de `ja`
 * else { windowStart = now; fps = frames; frames = 0; }             // 0x6fb0a9fa..0x6fb0aa09
 * ```
 *
 * All three globals are BSS (`windowStart` 0x6fbcc2b0, `frames` 0x6fbcc2b4, `fps` 0x6fbcc2ac) and are
 * never reset per game: the first call publishes 0, and `fps` stays 0 for the first second. The port
 * feeds integer milliseconds of `performance.now()` instead of `GetTickCount` (same algorithm).
 */
export class FpsCounter113c {
  /** 0x6fbcc2b0 */
  private windowStart = 0
  /** 0x6fbcc2b4 */
  private frames = 0
  /** 0x6fbcc2ac */
  private fpsValue = 0

  /** Frames counted in the last completed window (`[0x6fbcc2ac]`). */
  get fps(): number {
    return this.fpsValue
  }

  /**
   * One rendered frame at `nowMs` (integer milliseconds; the subtraction wraps like a DWORD).
   *
   * @returns the published FPS value after this frame.
   */
  frame(nowMs: number): number {
    if (!Number.isInteger(nowMs) || nowMs < 0) throw new Error(`FpsCounter113c.frame: now ${String(nowMs)}`)
    const now = nowMs >>> 0
    if (((now - this.windowStart) >>> 0) <= 1000) {
      this.frames = (this.frames + 1) >>> 0
    } else {
      this.windowStart = now
      this.fpsValue = this.frames
      this.frames = 0
    }
    return this.fpsValue
  }
}
