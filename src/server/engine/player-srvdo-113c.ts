/**
 * 1.13c player `Skills.txt` `srvdofunc` missile dispatch (#1417).
 *
 * `D2Game.dll` `gpSkillSrvDoFnTable` @ `0x6FD274A8` (image base `0x6FC20000`, see
 * `kb/skills/d2-skills-missiles-dispatch-tables.md` and `kb/skills/player-srvdo-missile-volleys-113c.md`)
 * decides how many server missiles one cast creates. `GameInstance` used to launch exactly one
 * `srvmissile` / `srvmissilea` for every missile skill; the functions below pin the multi-missile
 * srvdofuncs to the original integer math so the production cast path can reproduce them:
 *
 * - SrvDo008 `0x6FC6D420` (Multiple Shot 12, Teeth 67, Shock Wave 243): `calc1` missiles fanned
 *   across a perpendicular line through the target point (`0x6FCBE490` / `0x6FCBE450` step vector);
 *   the middle `calc3` missiles (`0` = all) are created without the `0x10000` no-proc flag.
 * - SrvDo012 `0x6FC6DCD0` + SrvSt008 `0x6FC6C870` (Strafe 26): one arrow per target found inside
 *   `aurarangecalc`, `min(max(min(calc3, calc1), targets), calc1)` arrows, `calc2` = damage %.
 * - SrvDo017 `0x6FC63B60` (Charged Bolt 38): `calc1` bolts toward the target.
 * - SrvDo117 `0x6FC656B0` (Firestorm 225): `calc1` missiles (one straight + `calc1 - 1` seeded).
 * - SrvDo118 `0x6FC65600` (Twister 240, Tornado 245): `calc1` missiles toward the target.
 */

/** srvdofunc ids whose `D2Game.dll` function loops `calc1` missile creations. */
export const SRVDOFUNC_FAN_VOLLEY_113C = 8
export const SRVDOFUNC_STRAFE_113C = 12
export const SRVDOFUNC_CHARGED_BOLT_113C = 17
export const SRVDOFUNC_FIRESTORM_113C = 117
export const SRVDOFUNC_TWISTER_TORNADO_113C = 118

/**
 * srvdofuncs whose 1.13c function creates exactly one server missile per call
 * (`D2Game.dll` scan: a single `0x6FC8F930` / `0x6FCC28F0` missile-create call and no loop):
 * 10 Guided Arrow / Bone Spirit `0x6FC6D270`, 14 Lightning Strike `0x6FC6CE10`,
 * 26 Chain Lightning `0x6FC63720`, 28 Meteor / Blizzard / Eruption `0x6FC62D90`,
 * 73 Blessed Hammer `0x6FCB94C0`, 74 Double Throw `0x6FC47E30`, 80 Fist of the Heavens `0x6FCB93A0`.
 * `0` = no srvdofunc: the generic `srvmissile` launch.
 */
export const SRVDOFUNC_SINGLE_MISSILE_113C: ReadonlySet<number> = new Set([0, 10, 14, 26, 28, 73, 74, 80])

export type PlayerSrvDoMissileMode = 'fan' | 'strafe' | 'volley' | 'single' | 'unmodeled'

/** How `GameInstance` must create the server missiles of a cast with this `srvdofunc`. */
export function classifyPlayerSrvDoMissile113c(srvDoFunc: number): PlayerSrvDoMissileMode {
  if (srvDoFunc === SRVDOFUNC_FAN_VOLLEY_113C) return 'fan'
  if (srvDoFunc === SRVDOFUNC_STRAFE_113C) return 'strafe'
  if (
    srvDoFunc === SRVDOFUNC_CHARGED_BOLT_113C ||
    srvDoFunc === SRVDOFUNC_FIRESTORM_113C ||
    srvDoFunc === SRVDOFUNC_TWISTER_TORNADO_113C
  ) {
    return 'volley'
  }
  if (SRVDOFUNC_SINGLE_MISSILE_113C.has(srvDoFunc)) return 'single'
  return 'unmodeled'
}

/** C integer division by 2 (`cdq; sub eax, edx; sar eax, 1`): truncates toward zero. */
function half(v: number): number {
  return Math.trunc(v / 2)
}

/**
 * Per-missile target step of SrvDo008: `0x6FCBE490` scales a short aim vector (`|d|^2 < 4` x4,
 * then `< 16` x2), `0x6FCBE450` rotates it by 90 degrees (`(dy, -dx)`) and halves both components
 * until `|step|^2 <= 3`.
 */
export function srvdo008StepVector113c(dx: number, dy: number): { sx: number; sy: number } {
  let x = Math.trunc(dx)
  let y = Math.trunc(dy)
  let len = x * x + y * y
  if (len < 4) {
    x *= 4
    y *= 4
    len = x * x + y * y
  }
  if (len < 16) {
    x *= 2
    y *= 2
  }
  let px = y
  let py = -x
  while (px * px + py * py > 3) {
    px = half(px)
    py = half(py)
  }
  return { sx: px, sy: py }
}

export interface FanMissileTarget {
  readonly x: number
  readonly y: number
  /** Created without the `0x10000` flag (the middle `calc3` missiles): may trigger on-hit procs. */
  readonly canTriggerProcs: boolean
}

/**
 * SrvDo008 `0x6FC6D420` missile targets: start at `target - trunc(step * count / 2)` and advance
 * one `step` per missile. Three loops create `trunc((count - triggered) / 2)` no-proc missiles,
 * `triggered` proc missiles (`calc3`, `0` = `count`), then the remaining no-proc missiles.
 */
export function srvdo008FanTargets113c(
  casterX: number,
  casterY: number,
  targetX: number,
  targetY: number,
  count: number,
  triggeredCalc: number,
): FanMissileTarget[] {
  const cx = Math.trunc(casterX)
  const cy = Math.trunc(casterY)
  const tx = Math.trunc(targetX)
  const ty = Math.trunc(targetY)
  const n = Math.trunc(count)
  const { sx, sy } = srvdo008StepVector113c(tx - cx, ty - cy)
  let x = tx - half(sx * n)
  let y = ty - half(sy * n)
  const triggered = triggeredCalc !== 0 ? Math.trunc(triggeredCalc) : n
  const lead = half(n - triggered)
  const out: FanMissileTarget[] = []
  const emit = (times: number, canTriggerProcs: boolean): void => {
    for (let i = 0; i < times; i++) {
      out.push({ x, y, canTriggerProcs })
      x += sx
      y += sy
    }
  }
  emit(Math.max(0, lead), false)
  emit(Math.max(0, triggered), true)
  emit(Math.max(0, n - lead - triggered), false)
  return out
}

/**
 * SrvSt008 `0x6FC6C870` Strafe shot count: `calc3` (min shots) clamped to `calc1` (max shots), raised
 * to the number of targets found inside `aurarangecalc`, then clamped to `calc1` again.
 */
export function strafeShotCount113c(calc1: number, calc3: number, targetsInRange: number): number {
  let shots = calc3
  if (shots > calc1) shots = calc1
  if (targetsInRange > shots) shots = targetsInRange
  return Math.min(shots, calc1)
}
