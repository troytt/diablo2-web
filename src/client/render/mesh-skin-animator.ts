/**
 * Per-unit playback state for real-time mesh skins (`src/client/render/mesh-skin-animator.ts`).
 *
 * Owns, for every unit currently drawn with a mesh skin: the looping phase, the cross-fade from
 * the previous clip, the smoothed facing, and a short estimate of how fast the unit is actually
 * moving on screen (used to play locomotion clips without foot sliding).
 *
 * Gameplay timing is never decided here: one-shot actions receive their clip time from the caller,
 * which derives it from the 1.13c action progress.
 */

import {
  blendMeshSkinPoseFrom,
  copyMeshSkinPose,
  createMeshSkinPose,
  sampleMeshSkinClip,
  shortestDir64Delta,
  type MeshSkinClip,
  type MeshSkinModel,
  type MeshSkinPose,
} from '../../common/units/mesh-skin-model.ts'

/** Cross-fade length between two clips. */
export const MESH_SKIN_BLEND_MS = 120
/** Largest facing change per millisecond, in dir64 units (a half turn takes about 0.2 s). */
const TURN_RATE_DIR64_PER_MS = 0.16
/** Frame gaps longer than this break cross-fades, turn smoothing and the speed estimate. */
const MAX_FRAME_DT_MS = 100
/**
 * Frame gaps up to this still advance looping clips by the real elapsed time, so a slow or
 * throttled display shows the right pose instead of a frozen one. Longer gaps mean the unit
 * was not being drawn at all.
 */
const MAX_LOOP_DT_MS = 1000
const SPEED_SMOOTHING_MS = 150
const TELEPORT_DISTANCE_PX = 96
const STALE_STATE_MS = 5000
const MIN_LOCOMOTION_RATE = 0.5
const MAX_LOCOMOTION_RATE = 3

export type MeshSkinPlayMode = 'loop' | 'oneshot' | 'hold-end'

export interface MeshSkinPlayRequest {
  readonly unitKey: string
  readonly model: MeshSkinModel
  readonly clip: MeshSkinClip
  readonly mode: MeshSkinPlayMode
  /** Clip time for `'oneshot'`. */
  readonly timeMs?: number | undefined
  /** Playback rate for `'loop'` (default 1), used when `naturalSpeedPx` is not positive. */
  readonly rate?: number | undefined
  /**
   * For locomotion loops: the on-screen ground speed (scene px/s) at which the clip plays at
   * rate 1. When positive, the rate follows the unit's measured movement instead of `rate`.
   */
  readonly naturalSpeedPx?: number | undefined
  readonly nowMs: number
  /** Target facing as an integer dir64. */
  readonly dir64: number
  readonly worldX: number
  readonly worldY: number
}

export interface MeshSkinPlayResult {
  readonly pose: MeshSkinPose
  /** Smoothed, fractional dir64 facing. */
  readonly dir64: number
  /** Clip time that was sampled (diagnostics / tests). */
  readonly timeMs: number
}

interface UnitState {
  model: MeshSkinModel
  pose: MeshSkinPose
  from: MeshSkinPose
  clipName: string
  phaseMs: number
  lastNowMs: number
  blendStartMs: number
  dir64: number
  lastX: number
  lastY: number
  speedPx: number
  lastTimeMs: number
}

/** Read-only view of one unit's playback state (diagnostics / verification tooling). */
export interface MeshSkinUnitSnapshot {
  readonly unitKey: string
  readonly clip: string
  readonly timeMs: number
  readonly dir64: number
  readonly speedPx: number
}

export class MeshSkinAnimator {
  private readonly states = new Map<string, UnitState>()
  private lastPruneMs = 0

  get trackedUnitCount(): number {
    return this.states.size
  }

  clear(): void {
    this.states.clear()
  }

  snapshot(): readonly MeshSkinUnitSnapshot[] {
    return [...this.states.entries()].map(([unitKey, st]) => ({
      unitKey,
      clip: st.clipName,
      timeMs: st.lastTimeMs,
      dir64: st.dir64,
      speedPx: st.speedPx,
    }))
  }

  /** Drop the state of units that have not been drawn for a while. */
  prune(nowMs: number): void {
    if (nowMs - this.lastPruneMs < 1000 && nowMs >= this.lastPruneMs) return
    this.lastPruneMs = nowMs
    for (const [key, st] of this.states) {
      if (nowMs - st.lastNowMs > STALE_STATE_MS || nowMs < st.lastNowMs - STALE_STATE_MS) this.states.delete(key)
    }
  }

  play(req: MeshSkinPlayRequest): MeshSkinPlayResult {
    const { model, clip, nowMs } = req
    let st = this.states.get(req.unitKey)
    let fresh = false
    if (st === undefined || st.model !== model) {
      st = {
        model,
        pose: createMeshSkinPose(model),
        from: createMeshSkinPose(model),
        clipName: '',
        phaseMs: 0,
        lastNowMs: nowMs,
        blendStartMs: Number.NEGATIVE_INFINITY,
        dir64: req.dir64,
        lastX: req.worldX,
        lastY: req.worldY,
        speedPx: 0,
        lastTimeMs: 0,
      }
      this.states.set(req.unitKey, st)
      fresh = true
    }

    const rawDt = nowMs - st.lastNowMs
    const continuous = !fresh && rawDt >= 0 && rawDt <= MAX_FRAME_DT_MS
    const dt = continuous ? rawDt : 0
    const loopDt = !fresh && rawDt >= 0 && rawDt <= MAX_LOOP_DT_MS ? rawDt : 0

    // On-screen ground speed: screen Y is foreshortened 2:1 by the isometric projection.
    if (continuous && dt > 0) {
      const dx = req.worldX - st.lastX
      const dy = (req.worldY - st.lastY) * 2
      const dist = Math.hypot(dx, dy)
      if (dist <= TELEPORT_DISTANCE_PX) {
        const k = 1 - Math.exp(-dt / SPEED_SMOOTHING_MS)
        st.speedPx += ((dist / dt) * 1000 - st.speedPx) * k
      }
    } else if (!continuous) {
      st.speedPx = 0
    }
    st.lastX = req.worldX
    st.lastY = req.worldY

    if (st.clipName !== clip.name) {
      if (st.clipName !== '' && continuous) {
        copyMeshSkinPose(st.pose, st.from)
        st.blendStartMs = nowMs
      } else {
        st.blendStartMs = Number.NEGATIVE_INFINITY
      }
      st.clipName = clip.name
      st.phaseMs = 0
    } else if (!continuous) {
      st.blendStartMs = Number.NEGATIVE_INFINITY
    }

    let timeMs: number
    if (req.mode === 'loop') {
      let rate = req.rate !== undefined && req.rate > 0 ? req.rate : 1
      if (req.naturalSpeedPx !== undefined && req.naturalSpeedPx > 0) {
        rate = Math.min(MAX_LOCOMOTION_RATE, Math.max(MIN_LOCOMOTION_RATE, st.speedPx / req.naturalSpeedPx))
      }
      st.phaseMs = (st.phaseMs + loopDt * rate) % clip.durationMs
      timeMs = st.phaseMs
    } else if (req.mode === 'oneshot') {
      const t = req.timeMs ?? 0
      timeMs = t <= 0 ? 0 : t >= clip.durationMs ? clip.durationMs : t
    } else {
      timeMs = clip.durationMs
    }

    sampleMeshSkinClip(model, clip, timeMs, st.pose)
    const blendAge = nowMs - st.blendStartMs
    if (blendAge >= 0 && blendAge < MESH_SKIN_BLEND_MS) {
      blendMeshSkinPoseFrom(st.pose, st.from, 1 - blendAge / MESH_SKIN_BLEND_MS)
    }

    if (continuous) {
      const delta = shortestDir64Delta(st.dir64, req.dir64)
      const maxStep = dt * TURN_RATE_DIR64_PER_MS
      const step = delta > maxStep ? maxStep : delta < -maxStep ? -maxStep : delta
      st.dir64 = (((st.dir64 + step) % 64) + 64) % 64
    } else {
      st.dir64 = req.dir64
    }
    st.lastNowMs = nowMs
    st.lastTimeMs = timeMs

    return { pose: st.pose, dir64: st.dir64, timeMs }
  }
}
