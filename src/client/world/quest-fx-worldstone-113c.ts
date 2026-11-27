/**
 * 1.13c D2Client worldstone shake (Missiles.txt 639 `worldstone shake`, MissCltDoFunc[66] / MissCltHitFunc[61]).
 *
 * ```
 * 0x6fb02410  special quest event 19: [0x6fbcc2ec] = 1                               (armed)
 * 0x6fb032c0  (eax = new room of the local player; reached from the room-change handler 0x6facbe90 and 0x6fb033d7)
 *             GetLevelId(room) in [0x83, 0x84] (131 / 132): when [0x6fbd3478] == 0 && armed && gpPlayer ->
 *             0x6fb515c0(0x27f, 0, 1) from the local player, [0x6fbd3478] = 1; any other level -> [0x6fbd3478] = 0
 * CltDo66 0x6fb69ea0  owner = 0x6fb560d0(m); no owner or owner level not 131 / 132 -> 0x6fb61720 (remove)
 *             #11121(m, owner) / #10759(m): the missile stays on its owner; the CltDo1 tail is NOT called (it never
 *             ages while it lives)
 *             TargetX == 0 || (RAND() & 0x3f) == 0 -> screen shake ([0x6fbbb9cc] = GetTickCount, ramp up 0x7d0,
 *             sustain 0xbb8, ramp down 0x7d0 ms, amplitude 6), #10637(m, 1)
 *             RAND() % 10 == 0 -> ox = RAND(60) - 30, oy = RAND(60) - 30 -> 0x6fb63b40(m, x + ox, y + oy)
 * 0x6fb63b40  #10573(room, x, y, 3, 1) blocked -> nothing; else create { flags 0x2001, explicit start (x, y),
 *             missile 0x27b + RAND(3) (635..637 baalfx tyreal debris 1..3) }, 3D trajectory z 0x7d000, vz -0x5000,
 *             range 25 (#10558 / #10970), anim speed 0x80
 * CltHit61 0x6fb5ffe0  no hit unit: clears the shake ([0x6fbcbefc], [0x6fbcbf00], [0x6fbbb9dc] = 0)
 * ```
 * RAND = 0x6fab1330 on the worldstone shake missile seed (unit+0x20).
 */
import { SEED_RollLimitedRandomNumber, type D2SeedStrc } from '../../common/rng/d2-rng.ts'

export const WORLDSTONE_SHAKE_MISSILE = 0x27f
export const WORLDSTONE_DEBRIS1_MISSILE = 0x27b
export const WORLDSTONE_SHAKE_LEVELS: readonly number[] = Object.freeze([0x83, 0x84])
export const WORLDSTONE_SHAKE = Object.freeze({ rampUpMs: 0x7d0, sustainMs: 0xbb8, rampDownMs: 0x7d0, amplitude: 6 })
/** 0x6fb63bf5 / 0x6fb63c10 / 0x6fb63c17: debris trajectory and lifetime. */
export const WORLDSTONE_DEBRIS_Z = 0x7d000
export const WORLDSTONE_DEBRIS_VZ = -0x5000
export const WORLDSTONE_DEBRIS_RANGE = 0x19

export function isWorldstoneShakeLevel(levelId: number): boolean {
  return WORLDSTONE_SHAKE_LEVELS.includes(levelId)
}

export interface WorldstoneShakeTick {
  readonly shake: boolean
  readonly nextTargetX: number
  /** Debris cell offset (before the 0x6fb63b40 collision test), or null. */
  readonly debris: { readonly ox: number; readonly oy: number } | null
}

/** The RAND part of CltDo66 for one frame (after the owner / level checks). */
export function worldstoneShakeTick(targetX: number, seed: D2SeedStrc): WorldstoneShakeTick {
  let shake = false
  let nextTargetX = targetX
  if (targetX === 0 || SEED_RollLimitedRandomNumber(seed, 0x40) === 0) {
    shake = true
    nextTargetX = 1
  }
  let debris: { ox: number; oy: number } | null = null
  if (SEED_RollLimitedRandomNumber(seed, 10) === 0) {
    const ox = SEED_RollLimitedRandomNumber(seed, 60) - 30
    const oy = SEED_RollLimitedRandomNumber(seed, 60) - 30
    debris = { ox, oy }
  }
  return { shake, nextTargetX, debris }
}

/** 0x6fb63b9f-0x6fb63baa: the debris row (after a free cell). */
export function worldstoneDebrisMissile(seed: D2SeedStrc): number {
  return WORLDSTONE_DEBRIS1_MISSILE + SEED_RollLimitedRandomNumber(seed, 3)
}
