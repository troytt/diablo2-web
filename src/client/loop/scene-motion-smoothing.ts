/**
 * PD2 `d2fps.dll` motion smoothing applied to the rendered scene.
 *
 * `ClientWorldSceneSource` reads the session state (`buildSceneSnapshot`) once per frame. Unit and local
 * player positions only change on simulated 25 Hz ticks (`tickSessionFrame`, numbered by
 * `ClientWorld.frameCount` = `ClientSceneWorldAdapter.tick`). This filter records each unit's previous and
 * current tick position ({@link TickPositionHistory}) whenever the tick number changes, and draws every
 * frame at `lerp(prev, curr, alpha)` with `alpha = MotionSmoothing.renderAlpha(logicClock, nowMs)`.
 * The camera follows because it is derived from the smoothed `playerSubX/Y`.
 *
 * With smoothing off (an explicit `'113c'`, or a d2fps config without `game-fps` / `motion-smoothing`)
 * the state passes through untouched, which is the 1.13c draw-the-latest-tick behaviour.
 *
 * Positions are snapped (no interpolation) on the first tick seen, for units that appear, and whenever
 * the level changes.
 */

import type { ClientSceneWorldAdapter } from '../view/scene-source.ts'
import type { RenderableUnitInput } from '../view/unit-drawables.ts'
import type { LogicClock } from './logic-clock.ts'
import { MotionSmoothing, TickPositionHistory } from './motion-smoothing.ts'

/** History key of the local player's camera anchor (`playerSubX/Y`); unit keys are `kind:id`. */
const PLAYER_ANCHOR_KEY = '@player'

function unitKey(unit: RenderableUnitInput): string {
  return `${unit.kind}:${String(unit.id)}`
}

export class SceneMotionSmoother {
  private readonly history = new TickPositionHistory<string>()
  private committedTick: number | null = null
  private committedLevel: number | undefined = undefined
  private alpha = 1

  constructor(
    readonly smoothing: MotionSmoothing,
    private readonly clock: LogicClock,
  ) {}

  /** Fix this frame's interpolation factor. Call after the owed logic ticks have run. */
  beginFrame(nowMs: number): number {
    this.alpha = this.smoothing.renderAlpha(this.clock, nowMs)
    return this.alpha
  }

  getAlpha(): number {
    return this.alpha
  }

  /** Forget all tick positions (the next tick snaps). */
  reset(): void {
    this.history.clear()
    this.committedTick = null
    this.committedLevel = undefined
  }

  /** The `ClientWorldSceneSource` state filter. */
  apply(st: ClientSceneWorldAdapter): ClientSceneWorldAdapter {
    if (!this.smoothing.isEnabled()) {
      if (this.committedTick !== null) this.reset()
      return st
    }
    const tick = st.tick
    if (tick === undefined) {
      throw new Error('d2fps motion smoothing needs the scene tick (ClientSceneWorldAdapter.tick)')
    }
    const level = st.levelId ?? st.levelView?.areaId
    if (level !== this.committedLevel) {
      this.history.clear()
      this.committedTick = null
      this.committedLevel = level
    }
    const units = Array.from(st.units)
    if (tick !== this.committedTick) this.commit(st, units)

    const alpha = this.alpha
    const anchor = this.history.sample(PLAYER_ANCHOR_KEY, alpha)
    let changed = false
    const smoothed = units.map((u) => {
      const p = this.history.sample(unitKey(u), alpha)
      if (!p || (p.x === u.x && p.y === u.y)) return u
      changed = true
      const light = this.history.sample(unitKey(u), 0) ?? p
      return { ...u, x: p.x, y: p.y, lightX: light.x, lightY: light.y }
    })
    const playerSubX = anchor ? anchor.x : st.playerSubX
    const playerSubY = anchor ? anchor.y : st.playerSubY
    if (!changed && playerSubX === st.playerSubX && playerSubY === st.playerSubY) {
      return { ...st, units }
    }
    const light = this.history.sample(PLAYER_ANCHOR_KEY, 0)
    return { ...st, playerSubX, playerSubY, units: smoothed, ...(light ? { lightSubX: light.x, lightSubY: light.y } : {}) }
  }

  private commit(st: ClientSceneWorldAdapter, units: readonly RenderableUnitInput[]): void {
    const first = this.committedTick === null
    const seen = new Set<string>([PLAYER_ANCHOR_KEY])
    const place = (key: string, x: number, y: number): void => {
      if (first) this.history.snap(key, { x, y })
      else this.history.commitTick(key, { x, y })
    }
    // (0, 0) is "no position yet" (`ClientWorldSceneSource.isWorldReady`): never interpolate out of it.
    if (st.playerSubX === 0 && st.playerSubY === 0) {
      this.history.remove(PLAYER_ANCHOR_KEY)
    } else if (!this.history.has(PLAYER_ANCHOR_KEY)) {
      this.history.snap(PLAYER_ANCHOR_KEY, { x: st.playerSubX, y: st.playerSubY })
    } else {
      place(PLAYER_ANCHOR_KEY, st.playerSubX, st.playerSubY)
    }
    for (const u of units) {
      const key = unitKey(u)
      seen.add(key)
      place(key, u.x, u.y)
    }
    for (const key of Array.from(this.history.keys())) {
      if (!seen.has(key)) this.history.remove(key)
    }
    this.committedTick = st.tick ?? null
  }
}
