/**
 * 1.13c D2Client Tainted Sun show (#1493), Anya rescue show (#1494), Baal FX controller (#1501),
 * Lightning Trailing Javelin CltDo46/CltHit51 (#1507), Distraction CltDo43/44/45 & Molten Boulder Emerge CltHit53 (#1508),
 * and Healing Bolt CltHit40 (#1509).
 */

import { SEED_RollLimitedRandomNumber, type D2SeedStrc } from '../../common/rng/d2-rng.ts'

/** Objects.txt 149 `taintedsunaltar` (`0x95`), looked up by special quest event 6 (`0x6fb02c50`). */
export const TAINTED_SUN_ALTAR_OBJECT_CLASS = 0x95
/** Missiles.txt 350 `taintedsuncontrol` (`0x15e`), 351 `taintedsunflash` (`0x15f`), 352 `taintedsunball` (`0x160`). */
export const TAINTED_SUN_CONTROL_MISSILE = 0x15e
export const TAINTED_SUN_FLASH_MISSILE = 0x15f
export const TAINTED_SUN_BALL_MISSILE = 0x160
/** Overlay.txt 182 `horadric_light` (`0xb6`), attached by CltDo33 when remaining frames <= 1 (`0x6fb6499e`). */
export const TAINTED_SUN_ALTAR_OVERLAY = 0xb6
/** Altar white light set by CltDo33 at `rem <= 1` (`0x6fb649af..0x6fb649cf`): radius 60 (`0x3c`), RGB (255, 255, 255). */
export const TAINTED_SUN_ALTAR_LIGHT = Object.freeze({ radius: 0x3c, r: 0xff, g: 0xff, b: 0xff })

/**
 * 1.13c `D2Client.dll` `0x6fb8364c..0x6fb8367c` timeline table for `MissCltDoFunc[33]` (`taintedsuncontrol`, `0x6fb64760`):
 * Each entry is `{ threshold, interval, count }`. Scans while `rem <= threshold` across the first 4 entries, falling back to entry 4.
 */
export const TAINTED_SUN_TIMELINE_113C = Object.freeze([
  { threshold: 350, interval: 10, count: 1 },
  { threshold: 300, interval: 5, count: 1 },
  { threshold: 200, interval: 4, count: 1 },
  { threshold: 175, interval: 3, count: 1 },
  { threshold: 0, interval: 100, count: 0 },
] as const)

export interface TaintedSunControlTick {
  readonly flashes: readonly { readonly tx: number; readonly ty: number }[]
  readonly nextPhase: number | null
  readonly finishAltar: boolean
}

/**
 * `MissCltDoFunc[33]` (`0x6fb64760`, `taintedsuncontrol` #350) for one frame (`rem` = `#10737` before CltDo1 tail):
 * - Looks up the first row in `TAINTED_SUN_TIMELINE_113C` with `rem > threshold` (or row 4).
 * - When `rem % interval === 0`, spawns `count` flashes (`taintedsunflash` #351, `0x15f`) at `(x + dx * 2, y + dy * 2)`
 *   where `dx, dy = RAND(10) - 5` (if `|d| < 2` -> `5`). When each `taintedsunflash` expires after 12 frames,
 *   its `MissCltHitFunc[38]` (`0x6fb645d0`) spawns `taintedsunball` (#352, `0x160`, `pCltDoFunc=34`) toward the controller.
 * - Updates controller `TargetY` (`cltCountdownY`): `rem < 25` -> `3`; `25 <= rem < 75` -> `2`.
 * - When `rem <= 1`: attaches overlay `0xb6` (`taintedsun`) and white light to the altar (`TargetX`).
 */
export function taintedSunControlTick(
  rem: number,
  x: number,
  y: number,
  seed: D2SeedStrc,
): TaintedSunControlTick {
  let rowIdx = 0
  while (rowIdx < 4 && rem <= TAINTED_SUN_TIMELINE_113C[rowIdx]!.threshold) {
    rowIdx += 1
  }
  const row = TAINTED_SUN_TIMELINE_113C[rowIdx]!
  const flashes: { tx: number; ty: number }[] = []
  if (rem % row.interval === 0 && row.count > 0) {
    for (let i = 0; i < row.count; i++) {
      let dx = SEED_RollLimitedRandomNumber(seed, 10) - 5
      if (Math.abs(dx) < 2) dx = 5
      let dy = SEED_RollLimitedRandomNumber(seed, 10) - 5
      if (Math.abs(dy) < 2) dy = 5
      flashes.push({ tx: x + dx * 2, ty: y + dy * 2 })
    }
  }
  let nextPhase: number | null = null
  if (rem < 25) {
    nextPhase = 3
  } else if (rem < 75) {
    nextPhase = 2
  }
  return {
    flashes,
    nextPhase,
    finishAltar: rem <= 1,
  }
}

/** Objects.txt 460 `FrozenAnya` (`0x1cc`) and dynamic interactive `Objects.txt` 558 `anya_framing` (`0x22e`, #2020), looked up by special quest event 16 (`0x6fb02b70`). */
export const FROZEN_ANYA_OBJECT_CLASS = 0x1cc
export const FROZEN_ANYA_INTERACT_OBJECT_CLASS = 0x22e
/** Missiles.txt 528 `anya center` (`0x210`), 532 `anya icemagic` (`0x214`), 597 `anyasteam1` (`0x255`), 615 `anyasteamvent` (`0x267`), 616 `anyasteam` (`0x268`). */
export const ANYA_CENTER_MISSILE = 0x210
export const ANYA_ICEMAGIC_MISSILE = 0x214
export const ANYA_STEAM1_MISSILE = 0x255
export const ANYA_STEAMVENT_MISSILE = 0x267
export const ANYA_STEAM_MISSILE = 0x268
export const ANYA_INITIAL_TARGET_Y = 0x19

/** Screen shake triggered at `elapsed === 5` in `CltDo54` (`0x6fb69e32..0x6fb69e5b`). */
export const ANYA_SHAKE = Object.freeze({
  rampUpMs: 0x258,
  sustainMs: 0xfa0,
  rampDownMs: 0xbb8,
  amplitude: 3,
})

export interface AnyaSteamPiece {
  readonly sx: number
  readonly sy: number
  readonly vxFixed: number
  readonly vyFixed: number
  readonly vzFixed: number
}

export interface AnyaCenterTick {
  readonly spawnCenterIceMagic: boolean
  readonly steamPuffs: readonly AnyaSteamPiece[]
  readonly shake: boolean
  readonly steamVentOffset: { readonly dx: number; readonly dy: number } | null
}

/**
 * `MissCltDoFunc[54]` (`0x6fb69c10`, `anya center` #528) for one frame (`elapsed` = `#10985` before CltDo1 tail):
 * - At `elapsed === 0`: spawns `0x214` (`anya icemagic` #532) at `(x, y)` and `8` `0x255` (`anyasteam1` #597) pieces.
 * - For `0 < elapsed < 110`: spawns `elapsed < 50 ? 8 : elapsed < 80 ? 5 : 1` `anyasteam1` (#597) pieces at `(x + 2, y + 2)`
 *   with 3D trajectory velocity `((50 - RAND(100)) << 11, (50 - RAND(100)) << 11, (2 + (RAND() & 7)) << 11)`.
 * - At `elapsed === 5`: starts screen shake (`rampUp=600, sustain=4000, rampDown=3000, amp=3`).
 * - Otherwise when `elapsed < 200 && elapsed % 7 === 0`: runs `0x6fb639e0` to pick a nearby offset `(dx, dy)` in `[-16..17]`
 *   outside `[-1..1] × [-1..1]` and spawns `0x267` (`anyasteamvent` #615) + `0x268` (`anyasteam` #616).
 */
export function anyaCenterTick(
  elapsed: number,
  x: number,
  y: number,
  seed: D2SeedStrc,
  isBlocked?: (tx: number, ty: number) => boolean,
): AnyaCenterTick {
  const spawnCenterIceMagic = elapsed === 0
  const steamPuffs: AnyaSteamPiece[] = []
  if (elapsed < 0x6e) {
    const count = elapsed === 0 ? 8 : elapsed < 0x32 ? 8 : elapsed < 0x50 ? 5 : 1
    for (let i = 0; i < count; i++) {
      const vxSub = 50 - SEED_RollLimitedRandomNumber(seed, 100)
      const vySub = 50 - SEED_RollLimitedRandomNumber(seed, 100)
      const vzSub = 2 + SEED_RollLimitedRandomNumber(seed, 8)
      steamPuffs.push({
        sx: x + 2,
        sy: y + 2,
        vxFixed: vxSub << 11,
        vyFixed: vySub << 11,
        vzFixed: vzSub << 11,
      })
    }
  }
  const shake = elapsed === 5
  let steamVentOffset: { dx: number; dy: number } | null = null
  if (!shake && elapsed < 0xc8 && elapsed % 7 === 0) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const dx = 17 - SEED_RollLimitedRandomNumber(seed, 34)
      const dy = 17 - SEED_RollLimitedRandomNumber(seed, 34)
      if (dx >= -1 && dx <= 1 && dy >= -1) continue
      if (isBlocked && isBlocked(x + dx, y + dy)) continue
      steamVentOffset = { dx, dy }
      break
    }
  }
  return {
    spawnCenterIceMagic,
    steamPuffs,
    shake,
    steamVentOffset,
  }
}

/** Missiles.txt 625 `baalfx control` (`0x271`), 626 `baalfx spirit 1` (`0x272`), 631..634 (`0x277..0x27a`), MonStats 521 `tyrael3` (`0x209`). */
export const BAALFX_CONTROL_MISSILE = 0x271
export const BAALFX_SPIRIT1_MISSILE = 0x272
export const BAALFX_HEAD_APPEAR_MISSILE = 0x277
export const BAALFX_HEAD1_MISSILE = 0x278
export const BAALFX_HEAD2_MISSILE = 0x279
export const BAALFX_HEAD3_MISSILE = 0x27a
export const TYRAEL3_MONSTER_CLASS = 0x209

/**
 * 1.13c `D2Client.dll` `0x6fb835d4..0x6fb83604` timeline table for `MissCltDoFunc[64]` (`baalfx control`, `0x6fb69ff0`):
 */
export const BAALFX_TIMELINE_113C = Object.freeze([
  { threshold: 420, interval: 64, count: 0 },
  { threshold: 435, interval: 20, count: 1 },
  { threshold: 470, interval: 8, count: 1 },
  { threshold: 270, interval: 5, count: 1 },
  { threshold: 0, interval: 64, count: 0 },
] as const)

export interface BaalFxControlTick {
  readonly spirit: { readonly missileId: number; readonly tx: number; readonly ty: number } | null
  readonly nextPhaseY: number
  readonly headAppearMissile: { readonly missileId: number; readonly x: number; readonly y: number } | null
}

/**
 * `MissCltDoFunc[64]` (`0x6fb69ff0`, `baalfx control` #625) for one frame (`rem` = `#10737` before CltDo1 tail):
 * - Scans `BAALFX_TIMELINE_113C` while `rem <= threshold` across rows 0..3, falling back to row 4.
 * - When `rem % interval === 0 && count !== 0`, rolls spirit seed (`0x272`) and target `(x + RAND(40) - 20, y + RAND(40) - 20)`.
 * - Sets controller `TargetY` (`#10019`): `rem < 210` (`0xd2`) -> `2`, else `1`.
 * - Switch on `rem`:
 *   - `450` (`0x1c2`): spawns `0x277` (`baalfx baal head appear` #631) at `(x + 1, y + 1)`
 *   - `425` (`0x1a9`): spawns `0x278` (`baalfx baal head 1` #632) at `(x, y)`
 *   - `375` (`0x177`): spawns `0x279` (`baalfx baal head 2` #633) at `(x, y)`
 *   - `325` (`0x145`): spawns `0x27a` (`baalfx baal head 3` #634) at `(x, y)`
 */
export function baalFxControlTick(
  rem: number,
  x: number,
  y: number,
  seed: D2SeedStrc,
): BaalFxControlTick {
  let rowIdx = 0
  while (rowIdx < 4 && rem <= BAALFX_TIMELINE_113C[rowIdx]!.threshold) {
    rowIdx += 1
  }
  const row = BAALFX_TIMELINE_113C[rowIdx]!
  let spirit: { missileId: number; tx: number; ty: number } | null = null
  if (rem % row.interval === 0 && row.count !== 0) {
    // 0x6fb6a057..0x6fb6a076: advances seed once (unused modulo), then rolls dx = RAND(40) - 20, dy = RAND(40) - 20
    SEED_RollLimitedRandomNumber(seed, 1)
    const dx = SEED_RollLimitedRandomNumber(seed, 40) - 20
    const dy = SEED_RollLimitedRandomNumber(seed, 40) - 20
    spirit = {
      missileId: BAALFX_SPIRIT1_MISSILE,
      tx: x + dx,
      ty: y + dy,
    }
  }
  const nextPhaseY = rem < 0xd2 ? 2 : 1
  let headAppearMissile: { missileId: number; x: number; y: number } | null = null
  if (rem === 450) {
    headAppearMissile = { missileId: BAALFX_HEAD_APPEAR_MISSILE, x: x + 1, y: y + 1 }
  } else if (rem === 425) {
    headAppearMissile = { missileId: BAALFX_HEAD1_MISSILE, x, y }
  } else if (rem === 375) {
    headAppearMissile = { missileId: BAALFX_HEAD2_MISSILE, x, y }
  } else if (rem === 325) {
    headAppearMissile = { missileId: BAALFX_HEAD3_MISSILE, x, y }
  }
  return {
    spirit,
    nextPhaseY,
    headAppearMissile,
  }
}

/**
 * `0x6fb69470` helper called by `MissCltDoFunc[45]` (`0x6fb6b500`, `distraction fog` #394, Issue #1508):
 * Rolls `chance = CltParam1` (`36`), `count = CltParam2` (`1`), `radius = CltParam3` (`6`),
 * `subMissileId = CltSubMissile1` (`395` `distraction puff`).
 */
export function cltDo45DistractionFogPuffSpawns(
  rem: number,
  x: number,
  y: number,
  cltParam1: number,
  cltParam2: number,
  cltParam3: number,
  seed: D2SeedStrc,
): { readonly x: number; readonly y: number }[] {
  if (rem !== 0 && cltParam1 > 0 && SEED_RollLimitedRandomNumber(seed, cltParam1) > 0) {
    return []
  }
  const spawns: { x: number; y: number }[] = []
  const span = cltParam3 * 2
  for (let i = 0; i < cltParam2; i++) {
    const r1 = span > 0 ? SEED_RollLimitedRandomNumber(seed, span) - cltParam3 : -cltParam3
    const r2 = span > 0 ? SEED_RollLimitedRandomNumber(seed, span) - cltParam3 : -cltParam3
    const dx = r1 + (r1 >= 0 ? cltParam3 : -cltParam3)
    const dy = r2 + (r2 >= 0 ? cltParam3 : -cltParam3)
    spawns.push({ x: x + dx, y: y + dy })
  }
  return spawns
}
