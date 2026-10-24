/**
 * 1.13c D2Client MonUMod 22 `questcomplete` boss-death controllers whose client logic lives in a missile CltDoFunc:
 *
 * - Blood Raven (MonStats 267): umod 22 event 1 handler `0x6fad0fb0` (mode 0) -> `0x6fb02320`, which creates three
 *   missiles on Blood Raven with `0x6fb630f0` {flags 1, owner = source = Blood Raven}: 0x11c = 284 `brdeathcontrol`
 *   (then D2Common #10637 SetTargetX(50)), 0x128 = 296 `brdeathspirits1` and 0x125 = 293 `brdeathsmokes1`. Each is
 *   created exactly once; the spirits / smokes S1 -> NU -> DT chains are their own ExplosionMissile columns.
 * - Shenk (overseer1, MonStats 479 with umod 22): `0x6fad0fb0` (mode 0) -> `0x6fb02bd0`, which creates 0x25a = 602
 *   `overseercontrol` at the monster's position (`0x6fb5ff10`) and calls #10637 SetTargetX(25).
 *
 * Missile data `+0x28` (#10637 set / #11018 get, "TargetX") is used by both CltDoFuncs as a frame countdown.
 *
 * MissCltDoFunc[21] `brdeathcontrol` (0x6fb686f0):
 *   if TargetX != 0: SetTargetX(TargetX - 1)
 *   else: create CltSubMissile1 (`brdeathlightningbolt`) {flags 2 = target relative to start, owner = source =
 *         the controller's owner}; with P = CltParam1 (20): dx = RAND(2P+1) - P, dy = RAND(2P+1) - P, and when both
 *         are 0, dx = RAND(P) + 1; the bolt gets SetTargetX(dx) / SetTargetY(dy); then
 *         SetTargetX(brDeathControlDelay(elapsed) - 1) with elapsed = #10985 (0x6fb60050).
 *
 * MissCltDoFunc[61] `overseercontrol` (0x6fb6a600):
 *   if TargetX != 0: SetTargetX(TargetX - 1)
 *   else: SEED step, low bit 1 -> 0x1a0 = 416 `catapult cold ball`, 0 -> 0x1a6 = 422 `catapult meteor ball`;
 *         `0x6fb63fc0` creates it {flags 1} at (owner.x + RAND(20) - 10, owner.y + RAND(20) - 10), asserts the row's
 *         Range is 25 and gives it a 3D trajectory: z = 400 px (0xc8000 >> 11), vz = -16 px / frame (0xffff8000),
 *         so it lands after the 25 frames of its Range; then SetTargetX(overseerControlDelay(elapsed) - 1)
 *         (0x6fb5ff80). No plague / charged / spike catapult missile is ever created.
 */

import { d2Rand, type D2Seed } from '../../common/drlg/light-grid.ts'
import type { Traj3dZ } from './quest-fx-horadric-113c.ts'

/** 0x6fb02320: SetTargetX(brdeathcontrol, 0x32). */
export const BR_DEATH_CONTROL_INITIAL_COUNTDOWN = 50
/** Missiles.txt `brdeathcontrol` (#284) CltParam1 = 20 ("radius"), read by 0x6fb6878a (missiles.bin +0x58). */
export const BR_DEATH_CONTROL_CLT_PARAM1 = 20
/** Missiles.txt `brdeathcontrol` (#284) CltSubMissile1 (missiles.bin +0x1e), created by 0x6fb687f1. */
export const BR_DEATH_CONTROL_CLT_SUBMISSILE1 = 'brdeathlightningbolt'
/** 0x6fb02bd0: SetTargetX(overseercontrol, 0x19). */
export const OVERSEER_CONTROL_INITIAL_COUNTDOWN = 25

/** 0x6fb02320: the missiles created once on Blood Raven, in creation order. */
export const BR_DEATH_MISSILES_113C = ['brdeathcontrol', 'brdeathspirits1', 'brdeathsmokes1'] as const

/** 0x6fb6a63f..0x6fb6a657: the two catapult rows overseercontrol picks between (seed & 1). */
export const OVERSEER_CONTROL_BALLS_113C = ['catapult meteor ball', 'catapult cold ball'] as const
export type OverseerControlBall = (typeof OVERSEER_CONTROL_BALLS_113C)[number]

/** 0x6fb60050: frames until the next brdeathlightningbolt, by elapsed frames (#10985). */
export function brDeathControlDelay(elapsed: number): number {
  if (elapsed < 125) return 25
  if (elapsed < 175) return 10
  if (elapsed < 300) return 3
  return 15
}

/** 0x6fb5ff80: frames until the next catapult ball, by elapsed frames (#10985). */
export function overseerControlDelay(elapsed: number): number {
  if (elapsed < 150) return 20
  if (elapsed < 200) return 15
  if (elapsed < 225) return 10
  if (elapsed < 375) return 5
  return 25
}

/** 0x6fb6a628..0x6fb6a657: one SEED step; low bit 1 = 416 `catapult cold ball`, 0 = 422 `catapult meteor ball`. */
export function pickOverseerControlBall(seed: D2Seed): OverseerControlBall {
  return (d2Rand(seed, 2) & 1) === 1 ? 'catapult cold ball' : 'catapult meteor ball'
}

/** 0x6fb64062..0x6fb640d7: the ball's start = owner + RAND(20) - 10 on each axis (x first). */
export function overseerControlBallStart(seed: D2Seed, ownerX: number, ownerY: number): { x: number; y: number } {
  const x = ownerX + d2Rand(seed, 20) - 10
  const y = ownerY + d2Rand(seed, 20) - 10
  return { x, y }
}

/** 0x6fb641a5 / 0x6fb641ce: z = 0xc8000 (400 px), vz = 0xffff8000 (-16 px per frame); the record's target z is 0. */
export function catapultBallTraj3d(): Traj3dZ {
  return { z: 0xc8000, vz: -0x8000, az: 0, targetZ: 0, rising: false, stopped: false }
}

/** 0x6fb6876a..0x6fb687e9: the brdeathlightningbolt target offset for CltParam1 = P. */
export function brDeathBoltOffset(seed: D2Seed, radius: number): { dx: number; dy: number } {
  let dx = d2Rand(seed, 2 * radius + 1) - radius
  const dy = d2Rand(seed, 2 * radius + 1) - radius
  if (dx === 0 && dy === 0) dx = d2Rand(seed, radius) + 1
  return { dx, dy }
}

/**
 * One frame of the shared countdown of CltDoFunc 21 / 61: returns `true` when the controller fires this frame
 * (TargetX reached 0) and updates the countdown (`delay - 1` after a shot, `TargetX - 1` otherwise).
 */
export function stepCltCountdown(
  unit: { cltCountdown?: number | undefined },
  initial: number,
  elapsed: number,
  delayFn: (elapsed: number) => number,
): boolean {
  const cur = unit.cltCountdown ?? initial
  if (cur !== 0) {
    unit.cltCountdown = cur - 1
    return false
  }
  unit.cltCountdown = delayFn(elapsed) - 1
  return true
}

/**
 * Mephisto (MonStats 242): `0x6fad0fb0` (mode 0) -> `0x6fb02270`, three `0x6fb630f0` calls {flags 1, owner = source
 * = Mephisto, level 1}, in this order (Issue #1208):
 *   1. 0x12b = 299 `mephistodeathcontrol`, then #10637 SetTargetX(75) and #10019 SetTargetY(75);
 *   2. 0x166 = 358 `mephistoholedelay` (its ExplosionMissile chain -> mephistoholebirth -> ...);
 *   3. 0x132 = 306 `mephistodonotdraw`.
 */
export const MEPHISTO_DEATH_MISSILES_113C = ['mephistodeathcontrol', 'mephistoholedelay', 'mephistodonotdraw'] as const
/** 0x6fb022ae / 0x6fb022b6: SetTargetX / SetTargetY(mephistodeathcontrol, 0x4b). */
export const MEPHISTO_DEATH_CONTROL_INITIAL_COUNTDOWN = 75

/** Missiles.txt `mephistodeathcontrol` (#299): pCltDoFunc 26, CltParam1..3 = 16 / 4 / 20, CltSubMissile1/2. */
export const MEPHISTO_DEATH_CONTROL_113C = {
  cltParam1: 16,
  cltParam2: 4,
  cltParam3: 20,
  cltSubMissile1: 'mephistofirewallmaker',
  cltSubMissile2: 'mephistoflyingrocksbig',
} as const
/** Missiles.txt `mephistodonotdraw` (#306): pCltDoFunc 28, CltParam1 = 15, CltSubMissile1 = corpseexplosion. */
export const MEPHISTO_DO_NOT_DRAW_113C = { cltParam1: 15, cltSubMissile1: 'corpseexplosion' } as const
/**
 * Missiles.txt `mephistoflyingrocksbig` (#302): pCltHitFunc 33, cHitPar1 = 20, CltHitSubMissile1 =
 * `mephistoflyingrockssmall` (whose own ExplosionMissile is `mephistoexplosionsmall`).
 */
export const MEPHISTO_FLYING_ROCKS_BIG_113C = { cHitPar1: 20, cltHitSubMissile1: 'mephistoflyingrockssmall' } as const
/** 0x6fb83e00 (x) / 0x6fb83df0 (y): the four corpseexplosion offsets of MissCltDoFunc[28]. */
export const MEPHISTO_DO_NOT_DRAW_OFFSETS_113C: readonly { readonly dx: number; readonly dy: number }[] = [
  { dx: -1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
]

/** D2Client 0x6fab1330 RAND(n): 0 without a seed step when n <= 0. */
export function rand113c(seed: D2Seed, n: number): number {
  return n <= 0 ? 0 : d2Rand(seed, n)
}

/**
 * 0x6fb682b0 (sub-missile create of CltDoFunc 26 for CltSubMissile1): {flags 2 = target relative to start, owner,
 * source = controller, level = controller level}; with P: dx = RAND(2P+1) - P, dy = RAND(2P+1) - P, and when both
 * are 0, dx = RAND(P - 1) + 1.
 */
export function cltDo26SubOffset(seed: D2Seed, p: number): { dx: number; dy: number } {
  let dx = rand113c(seed, 2 * p + 1) - p
  const dy = rand113c(seed, 2 * p + 1) - p
  if (dx === 0 && dy === 0) dx = rand113c(seed, p - 1) + 1
  return { dx, dy }
}

/**
 * 0x6fb6b829..0x6fb6b8cd (CltDoFunc 26, CltSubMissile2): {flags 0x102, owner, source = controller}; level =
 * RAND(5) + 1, then dx / dy like {@link cltDo26SubOffset} with P = CltParam3; the created rock gets
 * SetTargetX(RAND(5)) (the CltHitFunc 33 burst count).
 */
export function cltDo26RockSpawn(seed: D2Seed, p: number): { level: number; dx: number; dy: number } {
  const level = rand113c(seed, 5) + 1
  const { dx, dy } = cltDo26SubOffset(seed, p)
  return { level, dx, dy }
}

/**
 * MissCltDoFunc[26] `mephistodeathcontrol` (0x6fb6b780), one frame. Two independent countdowns on TargetX / TargetY
 * (75 / 75 from 0x6fb02270): TargetX != 0 -> TargetX - 1, else CltSubMissile1 (0x6fb682b0, P = CltParam3) and
 * TargetX = CltParam1 - 1; then TargetY != 0 -> TargetY - 1, else CltSubMissile2 and TargetY = CltParam2 - 1.
 */
export function stepCltDo26(unit: { cltCountdown?: number | undefined; cltCountdownY?: number | undefined }): {
  sub1: boolean
  sub2: boolean
} {
  const p = MEPHISTO_DEATH_CONTROL_113C
  const x = unit.cltCountdown ?? MEPHISTO_DEATH_CONTROL_INITIAL_COUNTDOWN
  let sub1 = false
  if (x > 0) unit.cltCountdown = x - 1
  else {
    sub1 = true
    unit.cltCountdown = p.cltParam1 - 1
  }
  const y = unit.cltCountdownY ?? MEPHISTO_DEATH_CONTROL_INITIAL_COUNTDOWN
  let sub2 = false
  if (y > 0) unit.cltCountdownY = y - 1
  else {
    sub2 = true
    unit.cltCountdownY = p.cltParam2 - 1
  }
  return { sub1, sub2 }
}

/**
 * MissCltHitFunc[33] `mephistoflyingrocksbig` (0x6fb65dd0), also run at range end (0x6fb615c8): P = max(3,
 * cHitPar1); TargetX times: {flags 0x102, owner, source = rock, CltHitSubMissile1}, level = RAND(5) + 1,
 * dx = RAND(2P+1) - P, dy = RAND(2P+1) - P, both 0 -> dx = RAND(P) + 1.
 */
export function cltHit33Bursts(
  seed: D2Seed,
  count: number,
  cHitPar1: number,
): { level: number; dx: number; dy: number }[] {
  const p = Math.max(3, cHitPar1)
  const out: { level: number; dx: number; dy: number }[] = []
  for (let i = 0; i < count; i++) {
    const level = rand113c(seed, 5) + 1
    let dx = rand113c(seed, 2 * p + 1) - p
    const dy = rand113c(seed, 2 * p + 1) - p
    if (dx === 0 && dy === 0) dx = rand113c(seed, p) + 1
    out.push({ level, dx, dy })
  }
  return out
}
