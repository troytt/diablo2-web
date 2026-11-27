/**
 * 1.13c D2Client Hell Forge show: special quest event 14 (`0x6fb03220`, jump table `0x6fba2138[14]`) and the
 * Missiles.txt chain 373 `hfcontrol` -> 374 `hffragment1` -> 375 `hffragment2` -> 376 `hffragment3` -> 377 `hfspirit1`.
 *
 * ```
 * 0x6fb03220  gpPlayer + room; forge = #10754(room, UNIT_OBJECT, 0x178 = 376 Hellforge); none -> nothing
 *             song override 0x6faf5570(0x1251, 0, 0x15e, ...); PlaySound(0x23 quest_hellforge_smash, forge)
 *             0x6fb5ff10(0x175 hfcontrol, forge.x, forge.y, 0, 1); #10637(m, forge id); #10019(m, 0)
 * CltDo38 0x6fb6a7e0 hfcontrol: forge = object hash lookup of TargetX; elapsed == 10 -> 0x6fb64fb0 + screen shake
 *             (GetTickCount, rampUp 0x50, sustain 0x50, rampDown 0x190 ms, amplitude 4)
 * 0x6fb64fb0  14 x create { flags 0x8102 (target relative, range override), owner, source = hfcontrol,
 *             missile 0x176, target (dx[i], dy[i]), range = Range(374) * d / 6 }, d = (|a| + 2|b|) >> 1 with a / b the
 *             components ordered by the signed `dx >= dy` test; #10637(new, forge id); #10019(new, RAND(35) + 10)
 * CltDo39 0x6fb62480 hffragment1/2: with an owner, unit+0x44 (frame) = 0 every frame
 * CltHit42 0x6fb65300 hffragment1 end: create { flags 0, source = fragment, missile 0x177 }; #10637(new, TargetX)
 * CltHit43 0x6fb651c0 hffragment2 end: create { flags 0x8005, explicit start (fragment), velocity 0,
 *             missile 0x178, range = Range(373 hfcontrol) }; #10637(new, TargetX); #10019(new, RAND(35) + 10)
 * CltDo40 0x6fb6a880 hffragment3: with an owner, TargetY counts down; at 0 -> 0x6fb65380 and TargetY = RAND(35) + 10 - 1
 * 0x6fb65380  forge = object of TargetX; create { flags 0, source = fragment, missile 0x179 hfspirit1 }, 3D trajectory
 *             (z 0, vz 0x1000, az 0); #10637(new, frag.x - forge.x); #10019(new, frag.y - forge.y)
 * CltDo41 0x6fb624a0 hfspirit1: elapsed 8 -> az = 0x100, anim speed / 2; elapsed 35 -> anim speed * 2
 * ```
 * RAND = 0x6fab1330 on the missile seed (unit+0x20) of the missile that runs the code.
 */
import { SEED_RollLimitedRandomNumber, type D2SeedStrc } from '../../common/rng/d2-rng.ts'

export const HELLFORGE_OBJECT_CLASS = 0x178
export const HELLFORGE_SONG_SOUND = 0x1251
export const HELLFORGE_SMASH_SOUND = 0x23
export const HF_CONTROL_MISSILE = 0x175
export const HF_FRAGMENT1_MISSILE = 0x176
export const HF_FRAGMENT2_MISSILE = 0x177
export const HF_FRAGMENT3_MISSILE = 0x178
export const HF_SPIRIT1_MISSILE = 0x179
/** CltDo38: frame of the burst. */
export const HF_CONTROL_BURST_FRAME = 10
/** CltDo38 screen shake (0x6fb6a846-6a): [0x6fbbb9d0] ramp up, [0x6fbbb9d4] sustain, [0x6fbbb9d8] ramp down, amplitude. */
export const HF_SHAKE = Object.freeze({ rampUpMs: 0x50, sustainMs: 0x50, rampDownMs: 0x190, amplitude: 4 })
/** 0x6fb64fb0 stack tables (14 entries). */
export const HF_FRAGMENT_DX = Object.freeze([-4, 2, 4, -3, -2, 3, 5, -3, -5, 5, -6, -1, 0, 6] as const)
export const HF_FRAGMENT_DY = Object.freeze([6, 4, -4, -2, 1, 7, 0, 3, -4, -3, 4, -5, 5, -3] as const)
/** hfspirit1 3D trajectory (0x6fb654f7-0x6fb6551b) and the CltDo41 acceleration (0x6fb624e2). */
export const HF_SPIRIT_VZ = 0x1000
export const HF_SPIRIT_AZ = 0x100

/** `RAND(35) + 10` (0x6fb65190-9d / 0x6fb652d4-de / 0x6fb6a8cb-d2). */
export function hfFragmentDelay(seed: D2SeedStrc): number {
  return SEED_RollLimitedRandomNumber(seed, 0x23) + 10
}

/** Range override of fragment i (0x6fb65101-0x6fb65158), from Range of row 374. */
export function hfFragmentRange(i: number, fragment1Range: number): number {
  const dx = HF_FRAGMENT_DX[i]!
  const dy = HF_FRAGMENT_DY[i]!
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  const d = (dx >= dy ? ax + 2 * ay : ay + 2 * ax) >> 1
  // `imul 0x2aaaaaab; shr 31; add`: signed division by 6 truncated toward zero.
  return Math.trunc((fragment1Range * d) / 6)
}

/** CltDo40: one frame of the hffragment3 countdown; `spawn` when the spirit leaves this frame. */
export function hfFragment3Tick(targetY: number, seed: D2SeedStrc): { spawn: boolean; nextTargetY: number } {
  if (targetY !== 0) return { spawn: false, nextTargetY: targetY - 1 }
  return { spawn: true, nextTargetY: hfFragmentDelay(seed) - 1 }
}

/** CltDo41: anim-speed factor change of hfspirit1 on `elapsed` (null = none) and whether the upward acceleration starts. */
export function hfSpiritTick(elapsed: number): { accelerate: boolean; animSpeedFactor: number | null } {
  if (elapsed === 8) return { accelerate: true, animSpeedFactor: 0.5 }
  if (elapsed === 0x23) return { accelerate: false, animSpeedFactor: 2 }
  return { accelerate: false, animSpeedFactor: null }
}
