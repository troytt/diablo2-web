/**
 * PD2 sub-tick motion smoothing (`d2fps.dll`, `d2fps.ini`).
 *
 * D2 simulates at 25 Hz (`LogicClock`, 40 ms per tick) and 1.13c draws each unit where the last tick
 * left it. PD2 ships `d2fps.dll` (a Rust plugin; the DLL carries `d2fps\src\weather.rs` and the ini
 * keys below) which unlocks the frame rate and, with `motion-smoothing=true`, draws units between their
 * previous and current tick positions. The d2fps source is not in this repo, so only the observable
 * contract is implemented: positions are lerped by the tick fraction `alpha` from
 * `LogicClock.getTickAlpha`. PD2 is the client default; an explicit `'113c'` always draws the current
 * tick (`alpha = 1`).
 *
 * `pd2-data/d2fps.ini` is parsed as-is; {@link PD2_D2FPS_CONFIG} pins the shipped values (re-read by
 * the test).
 */

import type { UiDataMode } from '../../common/ui/pd2-sgd2freeres.ts'
import type { LogicClock } from './logic-clock.ts'

export interface D2FpsConfig {
  /** `fps`: 0 = monitor rate; PD2 ships 8947 (effectively uncapped). Ratios like `101/2` are allowed. */
  readonly fps: number
  readonly bgFps: number
  readonly menuFps: boolean
  readonly gameFps: boolean
  /** `motion-smoothing` (requires `game-fps`). */
  readonly motionSmoothing: boolean
  readonly arcaneBg: boolean
  readonly animRateFixes: boolean
  readonly weatherSmoothing: boolean
  readonly reapplyPatches: boolean
  readonly integrityChecks: boolean
}

function parseRate(key: string, raw: string): number {
  const ratio = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/.exec(raw)
  const value = ratio ? Number(ratio[1]) / Number(ratio[2]) : Number(raw)
  if (!Number.isFinite(value) || value < 0) throw new Error(`d2fps.ini: ${key}=${raw} is not a rate`)
  return value
}

function parseBool(key: string, raw: string): boolean {
  if (raw === 'true') return true
  if (raw === 'false') return false
  throw new Error(`d2fps.ini: ${key}=${raw} is not true/false`)
}

/** Parse `d2fps.ini` (`key=value` lines, `;` comments). Every key below must be present. */
export function parseD2FpsIni(text: string): D2FpsConfig {
  const values = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (t === '' || t.startsWith(';') || t.startsWith('[')) continue
    const eq = t.indexOf('=')
    if (eq < 0) throw new Error(`d2fps.ini: cannot parse line "${t}"`)
    values.set(t.slice(0, eq).trim(), t.slice(eq + 1).trim())
  }
  const get = (key: string): string => {
    const v = values.get(key)
    if (v === undefined) throw new Error(`d2fps.ini: missing ${key}`)
    return v
  }
  return {
    fps: parseRate('fps', get('fps')),
    bgFps: parseRate('bg-fps', get('bg-fps')),
    menuFps: parseBool('menu-fps', get('menu-fps')),
    gameFps: parseBool('game-fps', get('game-fps')),
    motionSmoothing: parseBool('motion-smoothing', get('motion-smoothing')),
    arcaneBg: parseBool('arcane-bg', get('arcane-bg')),
    animRateFixes: parseBool('anim-rate-fixes', get('anim-rate-fixes')),
    weatherSmoothing: parseBool('weather-smoothing', get('weather-smoothing')),
    reapplyPatches: parseBool('reapply-patches', get('reapply-patches')),
    integrityChecks: parseBool('integrity-checks', get('integrity-checks')),
  }
}

/** `pd2-data/d2fps.ini` as shipped. */
export const PD2_D2FPS_CONFIG: D2FpsConfig = {
  fps: 8947,
  bgFps: 25,
  menuFps: true,
  gameFps: true,
  motionSmoothing: true,
  arcaneBg: true,
  animRateFixes: true,
  weatherSmoothing: true,
  reapplyPatches: true,
  integrityChecks: true,
}

export interface Point2 {
  readonly x: number
  readonly y: number
}

/** `prev + (curr - prev) * alpha`. */
export function lerpPoint(prev: Point2, curr: Point2, alpha: number): Point2 {
  if (!(alpha >= 0 && alpha <= 1)) throw new RangeError(`alpha must be in [0, 1], got ${String(alpha)}`)
  return { x: prev.x + (curr.x - prev.x) * alpha, y: prev.y + (curr.y - prev.y) * alpha }
}

/**
 * Chooses the render alpha for the data mode: 1.13c and PD2 with smoothing off draw the latest tick
 * (`1`); PD2 with `game-fps` and `motion-smoothing` draws at the tick fraction.
 */
export class MotionSmoothing {
  private mode: UiDataMode = 'pd2'

  constructor(
    private readonly config: D2FpsConfig = PD2_D2FPS_CONFIG,
    mode: UiDataMode = 'pd2',
  ) {
    this.setDataMode(mode)
  }

  setDataMode(mode: UiDataMode): void {
    if (mode !== '113c' && mode !== 'pd2') throw new Error(`MotionSmoothing: unknown data mode ${String(mode)}`)
    this.mode = mode
  }

  getDataMode(): UiDataMode {
    return this.mode
  }

  isEnabled(): boolean {
    return this.mode === 'pd2' && this.config.gameFps && this.config.motionSmoothing
  }

  renderAlpha(clock: LogicClock, nowMs: number): number {
    return this.isEnabled() ? clock.getTickAlpha(nowMs) : 1
  }
}

/**
 * Per-entity previous/current tick positions. `commitTick` once per simulated tick, `sample` once per
 * rendered frame. An entity seen for the first time (or after `snap`) has `prev === curr`, so it does
 * not slide in from the origin.
 */
export class TickPositionHistory<K> {
  private readonly entries = new Map<K, { prev: Point2; curr: Point2 }>()

  commitTick(key: K, pos: Point2): void {
    const e = this.entries.get(key)
    if (e) {
      e.prev = e.curr
      e.curr = pos
    } else {
      this.entries.set(key, { prev: pos, curr: pos })
    }
  }

  /** Place without interpolation (teleport, level change, spawn). */
  snap(key: K, pos: Point2): void {
    this.entries.set(key, { prev: pos, curr: pos })
  }

  remove(key: K): void {
    this.entries.delete(key)
  }

  clear(): void {
    this.entries.clear()
  }

  has(key: K): boolean {
    return this.entries.has(key)
  }

  keys(): IterableIterator<K> {
    return this.entries.keys()
  }

  get size(): number {
    return this.entries.size
  }

  sample(key: K, alpha: number): Point2 | undefined {
    const e = this.entries.get(key)
    return e ? lerpPoint(e.prev, e.curr, alpha) : undefined
  }
}
