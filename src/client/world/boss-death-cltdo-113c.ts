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
import { SEED_RollLimitedRandomNumber, type D2SeedStrc } from '../../common/rng/d2-rng.ts'

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

/** Missiles.txt 542 `ancient death cloud`, created by MissCltDoFunc[55]. */
export const ANCIENT_DEATH_CLOUD_MISSILE = 0x21e

/**
 * MissCltDoFunc[55] `ancient death center` (0x6fb63860), one frame (`elapsed` = #10985 before the CltDo1 tail):
 * ```
 * 0x6fb63867  elapsed % 3 != 0 -> CltDo1 only
 * 0x6fb6387c  ox = RAND(20); oy = RAND(20)                          (missile seed unit+0x20)
 * 0x6fb638f1  sx = x + (RAND() & 1) - 1;  sy = y + (RAND() & 1) - 1
 * 0x6fb6396c  create { flags 0x21, owner = 0x6fb560d0(m), start (sx, sy), target (sx + ox - 10, sy + oy - 10),
 *                      missile 0x21e }                               -> the cloud moves (Vel 3) for its own Range
 * ```
 * Returns `null` on frames without a cloud.
 */
export function ancientDeathCenterTick(
  elapsed: number,
  seed: D2SeedStrc,
  x: number,
  y: number,
): { sx: number; sy: number; tx: number; ty: number } | null {
  if (elapsed % 3 !== 0) return null
  const ox = SEED_RollLimitedRandomNumber(seed, 20)
  const oy = SEED_RollLimitedRandomNumber(seed, 20)
  const sx = x + SEED_RollLimitedRandomNumber(seed, 2) - 1
  const sy = y + SEED_RollLimitedRandomNumber(seed, 2) - 1
  return { sx, sy, tx: sx + ox - 10, ty: sy + oy - 10 }
}
/** MonStats 526 `nihlathakboss`, looked up by special quest event 17 (0x6fb02b06). */
export const NIHLATHAK_MONSTER_CLASS = 0x20e
/** Missiles.txt 606 `nehlithakcontrol` and 603 `nihlithak1` created by event 17 (0x6fb02b33 / 0x6fb02b45). */
export const NEHLITHAK_CONTROL_MISSILE = 0x25e
export const NIHLITHAK1_MISSILE = 0x25b
/** Missiles.txt 607 `nehlithakswoosh`; 608..611 `nehlithakdebris1..4`; 617 `nehlithakhole`; 285 `brdeathlightningbolt`. */
export const NEHLITHAK_SWOOSH_MISSILE = 0x25f
export const NEHLITHAK_DEBRIS1_MISSILE = 0x260
export const NEHLITHAK_HOLE_MISSILE = 0x269
export const NEHLITHAK_BOLT_MISSILE = 0x11d

/** 0x6fb63d60 step tables (stack, k = RAND() & 3): dx = {1, 0, -1, 0}, dy = {0, 1, 0, -1}. */
const NEHLITHAK_DX = [1, 0, -1, 0] as const
const NEHLITHAK_DY = [0, 1, 0, -1] as const

export interface NehlithakSwooshShot {
  readonly missile: number
  readonly sx: number
  readonly sy: number
  readonly tx: number
  readonly ty: number
  /** traj z >> 11 (0x6fb63f10: z = RAND(125) << 11, no velocity). */
  readonly altitude: number
}

/**
 * 0x6fb63d60 (eax = nehlithakcontrol, arg = its owner): one swoosh / debris piece.
 * ```
 * z = RAND(125); k = RAND() & 3; (dx, dy) = tables[k]
 * r = RAND(30): 0..3 -> 0x260 + r (debris1..4), else 0x25f (swoosh)
 * create { flags 3 (explicit start, target relative), start (x + dx, y + dy), target start + (dy, -dx) }
 * traj z = z << 11; #10637(new, x) / #10019(new, y): the piece remembers the controller cell (CltDo63 orbits it)
 * ```
 */
export function nehlithakSwooshShot(seed: D2SeedStrc, x: number, y: number): NehlithakSwooshShot {
  const altitude = SEED_RollLimitedRandomNumber(seed, 125)
  const k = SEED_RollLimitedRandomNumber(seed, 4)
  const dx = NEHLITHAK_DX[k]!
  const dy = NEHLITHAK_DY[k]!
  const r = SEED_RollLimitedRandomNumber(seed, 30)
  const missile = r <= 3 ? NEHLITHAK_DEBRIS1_MISSILE + r : NEHLITHAK_SWOOSH_MISSILE
  const sx = x + dx
  const sy = y + dy
  return { missile, sx, sy, tx: sx + dy, ty: sy - dx, altitude }
}

/**
 * 0x6fb63c40 (eax = nehlithakcontrol): one `brdeathlightningbolt` from the controller toward a relative target.
 * ```
 * ox = 20 - RAND(40); oy = 20 - RAND(40); if (ox == 0 && oy == 0) ox = RAND(19) + 1
 * create { flags 2 (target relative), source = controller, missile 0x11d, target (ox, oy) }
 * #10637(new, ox) / #10019(new, oy); traj (0, 0, z = -0x5000)
 * ```
 */
export function nehlithakBoltShot(seed: D2SeedStrc): { ox: number; oy: number; altitude: number } {
  let ox = 20 - SEED_RollLimitedRandomNumber(seed, 40)
  const oy = 20 - SEED_RollLimitedRandomNumber(seed, 40)
  if (ox === 0 && oy === 0) ox = SEED_RollLimitedRandomNumber(seed, 19) + 1
  return { ox, oy, altitude: -0x5000 >> 11 }
}

/**
 * MissCltDoFunc[62] `nehlithakcontrol` (0x6fb6a4a0), one frame (`elapsed` = #10985 before the CltDo1 tail):
 * no owner -> nothing; two 0x6fb63d60 pieces; `elapsed > 60 && elapsed % 20 == 0` -> 0x6fb63c40 bolt;
 * `elapsed == 25` -> 0x6fb5ff10(0x269 `nehlithakhole`, x + 2, y + 2).
 */
export function nehlithakControlPlan(elapsed: number): { readonly pieces: 2; readonly bolt: boolean; readonly hole: boolean } {
  return { pieces: 2, bolt: elapsed > 60 && elapsed % 20 === 0, hole: elapsed === 25 }
}

/**
 * MissCltDoFunc[63] (0x6fb61f20) `nehlithakswoosh` / `nehlithakdebris1..4`: each frame the path target becomes
 * (x + (y - cy), y - (x - cx)) around the remembered controller cell (cx, cy) = (TargetX, TargetY).
 */
export function nehlithakOrbitTarget(x: number, y: number, cx: number, cy: number): { tx: number; ty: number } {
  return { tx: x + (y - cy), ty: y - (x - cx) }
}

/**
 * 1.13c `D2Client.dll` `0x6FB83610` phase cadence table for `MissCltDoFunc[36]` (`durieldeathcontrol`, `0x6FB641F0`, Issue #1719):
 * 5 rows of `{ threshold, a, b }` (`int32[3]`). Selects the first row with `rem > threshold` (`0x6FB64246..0x6FB6425D`),
 * falling back to the 5th row `{ 0, 100, 5 }` when `rem <= 175`.
 * - If `rem % a === 0`: spawns missile `42` (`explodingarrowexp`) at `(x + RAND(40) - 20, y + RAND(40) - 20)`.
 * - If `rem % b === 0`: spawns missile `364` (`durieldeathrock`) at `(x + RAND(40) - 20, y + RAND(40) - 20)` with
 *   `z = 0x4B000` (150 px), `vz = -0x5000` (-10 px/tick), `range = 15`, `animSpeed = 0x80` (half speed = 8 in 16ths).
 */
export const DURIEL_DEATH_PHASES_113C = [
  { threshold: 350, a: 3, b: 5 },
  { threshold: 300, a: 2, b: 3 },
  { threshold: 200, a: 3, b: 2 },
  { threshold: 175, a: 5, b: 1 },
  { threshold: 0, a: 100, b: 5 },
] as const

export function durielDeathPhase113c(rem: number): { readonly threshold: number; readonly a: number; readonly b: number } {
  for (let i = 0; i < 4; i++) {
    if (rem > DURIEL_DEATH_PHASES_113C[i]!.threshold) {
      return DURIEL_DEATH_PHASES_113C[i]!
    }
  }
  return DURIEL_DEATH_PHASES_113C[4]!
}
