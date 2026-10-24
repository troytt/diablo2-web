/**
 * Diablo II v1.13c Character Animation Speed & One-Shot Lifecycle Math.
 *
 * Ground Truth (`D2Common.dll` / `D2Client.dll` + `data/global/AnimData.d2` + `Weapons.txt`):
 * - Engine simulation rate is 25Hz (40ms per tick).
 * - `AnimData.d2` stores per-clip `frames` (frames per direction) and `speed` in 8.8 fixed-point
 *   where `256` = 1.0 frame per 40ms tick.
 * - Diminishing returns on item FCR / IAS / FHR:
 *     `diminished = floor(120 * rate / (120 + rate))` (for `rate > 0`; clamped to `[-85, 75]`).
 * - Spell casting (`SC`, mode 10):
 *     `EFCR = clamp(diminished(fcr), -85, 75)`
 * - Weapon attacks (`A1` / `A2`, modes 7 / 8):
 *     `EIAS = clamp(diminished(itemIas) + skillIas - weaponWsm, -85, 75)`
 *   where `weaponWsm` is the equipped weapon's `speed` column from 1.13c `Weapons.txt`.
 * - Get Hit recovery (`GH`, mode 4):
 *     `EFHR = clamp(diminished(fhr), -85, 75)`
 * - Effective 8.8 fixed-point step speed:
 *     `stepSpeed256 = max(32, floor(baseSpeed * (100 + effRate) / 100))`
 * - Locomotion exception (wl/tw/rn, `UNITS_UpdateRunWalkAnimRateAndVelocity` 0x6FD83331):
 *     bases are the hardcoded 213 (walk) / 101 (run); the scale is the move velocity
 *     percent `max(25, EFRW + STAT_VELOCITYPERCENT)` (run +50% via CharStats 9/6) with
 *     `stepSpeed256 = trunc(base × pct / 100)` and NO 32 floor (the 25 floor is on the
 *     percent), e.g. naked walk 213 / naked run 151 (issue #869).
 * - One-shot animation duration:
 *     `ticks = ceil(frames * 256 / stepSpeed256)`
 *     `durationMs = ticks * 40`
 */

import { RAW_ARMOR, RAW_WEAPONS } from '../data/canonical-drop-data.ts'
import { parseWeaponsTable, type WeaponBase, type WeaponTable } from '../items/weapons.ts'
import { getMonsterPathRecord } from '../path/units.ts'
import { getSkillAnimModes, resolveSkillSequenceFrame } from '../skills/skill-anim-modes.ts'

/** 1.13c simulation tick duration in milliseconds (25Hz). */
export const D2_TICK_MS = 40

/** 1.13c `ItemStatCost.txt` stat IDs for animation rate and light radius modifiers. */
export const STAT_SKILL_IAS = 68
export const STAT_LIGHTRADIUS = 89
/** `item_lightcolor` (0xRRGGBB); 0 keeps the player light white (issue #830). */
export const STAT_LIGHTCOLOR = 90
export const STAT_FASTERATTACKRATE = 93
export const STAT_FASTERMOVEVELOCITY = 96
export const STAT_FASTERHITRECOVERY = 99
export const STAT_FASTERBLOCKRATE = 102
export const STAT_FASTERCASTRATE = 105

export type CharAnimClipKey =
  | 'wl'
  | 'nu'
  | 'rn'
  | 'a1'
  | 'a2'
  | 'bl'
  | 'sc'
  | 'th'
  | 'kk'
  | 's1'
  | 's2'
  | 's3'
  | 's4'
  | 'gh'
  | 'dt'
  | 'dd'
  | 'tn'
  | 'tw'

export interface CharAnimClip113c {
  readonly frames: number
  readonly framesPerDir: number
  readonly speed: number
  readonly animSpeed: number
  readonly actionFrame: number
  readonly loop: boolean
  readonly events: readonly { readonly f: number; readonly c: number }[]
}

function makeClip113c(
  frames: number,
  speed: number,
  loop: boolean,
  events: readonly { readonly f: number; readonly c: number }[],
): CharAnimClip113c {
  return {
    frames,
    framesPerDir: frames,
    speed,
    animSpeed: speed,
    actionFrame: events[0]?.f ?? 0,
    loop,
    events,
  }
}

/**
 * Canonical 1.13c `AnimData.d2` clip metadata for all 7 playable classes (`0..6`:
 * `am, so, ne, pa, ba, dz, ai`), matching `public/entities/char-*.json`.
 */
export const CHAR_ANIM_CLIPS_113C: Readonly<
  Record<number, Readonly<Record<CharAnimClipKey, CharAnimClip113c>>>
> = {
  // 0: Amazon (am)
  0: {
    wl: makeClip113c(8, 256, true, []),
    nu: makeClip113c(8, 128, true, []),
    rn: makeClip113c(8, 256, true, []),
    a1: makeClip113c(13, 256, false, [{ f: 6, c: 1 }]),
    a2: makeClip113c(13, 256, false, [{ f: 6, c: 1 }]),
    bl: makeClip113c(3, 256, false, []),
    sc: makeClip113c(20, 256, false, [{ f: 13, c: 1 }]),
    th: makeClip113c(16, 256, false, [{ f: 9, c: 2 }]),
    kk: makeClip113c(12, 256, false, [{ f: 5, c: 1 }]),
    s1: makeClip113c(9, 256, false, [{ f: 2, c: 1 }]),
    s2: makeClip113c(9, 256, false, [{ f: 2, c: 1 }]),
    s3: makeClip113c(9, 256, false, [{ f: 2, c: 1 }]),
    s4: makeClip113c(9, 256, false, [{ f: 2, c: 1 }]),
    gh: makeClip113c(6, 256, false, []),
    dt: makeClip113c(23, 256, false, []),
    dd: makeClip113c(1, 256, false, []),
    tn: makeClip113c(16, 80, true, []),
    tw: makeClip113c(8, 256, true, []),
  },
  // 1: Sorceress (so)
  1: {
    wl: makeClip113c(8, 256, true, []),
    nu: makeClip113c(8, 128, true, []),
    rn: makeClip113c(8, 256, true, []),
    a1: makeClip113c(16, 256, false, [{ f: 9, c: 1 }]),
    a2: makeClip113c(16, 256, false, [{ f: 8, c: 1 }]),
    bl: makeClip113c(5, 256, false, []),
    sc: makeClip113c(14, 256, false, [{ f: 7, c: 1 }]),
    th: makeClip113c(20, 256, false, [{ f: 10, c: 2 }]),
    kk: makeClip113c(12, 256, false, [{ f: 6, c: 1 }]),
    s1: makeClip113c(14, 256, false, [{ f: 7, c: 1 }]),
    s2: makeClip113c(14, 256, false, [{ f: 7, c: 1 }]),
    s3: makeClip113c(14, 256, false, [{ f: 7, c: 1 }]),
    s4: makeClip113c(14, 256, false, [{ f: 7, c: 1 }]),
    gh: makeClip113c(8, 256, false, []),
    dt: makeClip113c(24, 256, false, []),
    dd: makeClip113c(1, 256, false, []),
    tn: makeClip113c(16, 80, true, []),
    tw: makeClip113c(8, 256, true, []),
  },
  // 2: Necromancer (ne)
  2: {
    wl: makeClip113c(8, 256, true, []),
    nu: makeClip113c(8, 128, true, []),
    rn: makeClip113c(8, 256, true, []),
    a1: makeClip113c(15, 256, false, [{ f: 9, c: 1 }]),
    a2: makeClip113c(15, 256, false, [{ f: 9, c: 1 }]),
    bl: makeClip113c(6, 256, false, []),
    sc: makeClip113c(16, 256, false, [{ f: 8, c: 1 }]),
    th: makeClip113c(20, 256, false, [{ f: 10, c: 2 }]),
    kk: makeClip113c(12, 256, false, [{ f: 6, c: 1 }]),
    s1: makeClip113c(16, 256, false, [{ f: 8, c: 1 }]),
    s2: makeClip113c(16, 256, false, [{ f: 8, c: 1 }]),
    s3: makeClip113c(16, 256, false, [{ f: 8, c: 1 }]),
    s4: makeClip113c(16, 256, false, [{ f: 8, c: 1 }]),
    gh: makeClip113c(7, 256, false, []),
    dt: makeClip113c(27, 176, false, []),
    dd: makeClip113c(1, 256, false, []),
    tn: makeClip113c(16, 80, true, []),
    tw: makeClip113c(8, 256, true, []),
  },
  // 3: Paladin (pa)
  3: {
    wl: makeClip113c(10, 288, true, []),
    nu: makeClip113c(8, 184, true, []),
    rn: makeClip113c(8, 256, true, []),
    a1: makeClip113c(14, 256, false, [{ f: 7, c: 1 }]),
    a2: makeClip113c(14, 256, false, [{ f: 8, c: 1 }]),
    bl: makeClip113c(3, 256, false, []),
    sc: makeClip113c(16, 256, false, [{ f: 9, c: 1 }]),
    th: makeClip113c(12, 256, false, [{ f: 6, c: 2 }]),
    kk: makeClip113c(12, 256, false, [{ f: 5, c: 1 }]),
    s1: makeClip113c(12, 256, false, [{ f: 7, c: 1 }]),
    s2: makeClip113c(12, 256, false, [{ f: 7, c: 1 }]),
    s3: makeClip113c(12, 256, false, [{ f: 7, c: 1 }]),
    s4: makeClip113c(12, 256, false, [{ f: 7, c: 1 }]),
    gh: makeClip113c(5, 256, false, []),
    dt: makeClip113c(28, 256, false, []),
    dd: makeClip113c(1, 256, false, []),
    tn: makeClip113c(16, 128, true, []),
    tw: makeClip113c(10, 288, true, []),
  },
  // 4: Barbarian (ba)
  4: {
    wl: makeClip113c(8, 168, true, []),
    nu: makeClip113c(8, 96, true, []),
    rn: makeClip113c(8, 216, true, []),
    a1: makeClip113c(12, 256, false, [{ f: 7, c: 1 }]),
    a2: makeClip113c(12, 256, false, [{ f: 7, c: 1 }]),
    bl: makeClip113c(4, 256, false, []),
    sc: makeClip113c(14, 256, false, [{ f: 9, c: 1 }]),
    th: makeClip113c(16, 256, false, [{ f: 8, c: 2 }]),
    kk: makeClip113c(12, 256, false, [{ f: 4, c: 1 }]),
    s1: makeClip113c(15, 256, false, []),
    s2: makeClip113c(15, 256, false, []),
    s3: makeClip113c(12, 256, false, [{ f: 7, c: 1 }]),
    s4: makeClip113c(16, 256, false, [{ f: 9, c: 2 }]),
    gh: makeClip113c(5, 256, false, []),
    dt: makeClip113c(27, 240, false, []),
    dd: makeClip113c(1, 256, false, []),
    tn: makeClip113c(16, 80, true, []),
    tw: makeClip113c(8, 256, true, []),
  },
  // 5: Druid (dz)
  5: {
    wl: makeClip113c(8, 136, true, []),
    nu: makeClip113c(6, 120, true, []),
    rn: makeClip113c(8, 168, true, []),
    a1: makeClip113c(16, 256, false, [{ f: 8, c: 1 }]),
    a2: makeClip113c(16, 256, false, [{ f: 8, c: 1 }]),
    bl: makeClip113c(6, 256, false, []),
    sc: makeClip113c(15, 208, false, [{ f: 8, c: 1 }]),
    th: makeClip113c(18, 256, false, [{ f: 9, c: 2 }]),
    kk: makeClip113c(12, 256, false, [{ f: 5, c: 1 }]),
    s1: makeClip113c(15, 256, false, [{ f: 8, c: 1 }]),
    s2: makeClip113c(15, 256, false, [{ f: 8, c: 1 }]),
    s3: makeClip113c(15, 256, false, [{ f: 8, c: 1 }]),
    s4: makeClip113c(15, 256, false, [{ f: 8, c: 1 }]),
    gh: makeClip113c(7, 256, false, []),
    dt: makeClip113c(25, 176, false, []),
    dd: makeClip113c(1, 256, false, []),
    tn: makeClip113c(16, 96, true, []),
    tw: makeClip113c(8, 128, true, []),
  },
  // 6: Assassin (ai)
  6: {
    wl: makeClip113c(8, 256, true, []),
    nu: makeClip113c(8, 128, true, []),
    rn: makeClip113c(8, 256, true, []),
    a1: makeClip113c(11, 256, false, [{ f: 6, c: 1 }]),
    a2: makeClip113c(12, 256, false, [{ f: 6, c: 1 }]),
    bl: makeClip113c(3, 256, false, []),
    sc: makeClip113c(17, 256, false, [{ f: 9, c: 1 }]),
    th: makeClip113c(16, 256, false, [{ f: 7, c: 2 }]),
    kk: makeClip113c(13, 256, false, [{ f: 4, c: 1 }]),
    s1: makeClip113c(17, 256, false, [{ f: 10, c: 1 }]),
    s2: makeClip113c(8, 128, false, [{ f: 4, c: 2 }]),
    s3: makeClip113c(10, 256, false, []),
    s4: makeClip113c(12, 208, false, [{ f: 6, c: 1 }]),
    gh: makeClip113c(5, 256, false, []),
    dt: makeClip113c(20, 208, false, []),
    dd: makeClip113c(1, 256, false, []),
    tn: makeClip113c(12, 64, true, []),
    tw: makeClip113c(8, 256, true, []),
  },
}

const TOKEN_TO_CLASS_ID: Readonly<Record<string, number>> = {
  am: 0,
  ama: 0,
  amazon: 0,
  so: 1,
  sor: 1,
  sorceress: 1,
  ne: 2,
  nec: 2,
  necromancer: 2,
  pa: 3,
  pal: 3,
  paladin: 3,
  ba: 4,
  bar: 4,
  barbarian: 4,
  dz: 5,
  dru: 5,
  druid: 5,
  ai: 6,
  ass: 6,
  asn: 6,
  assassin: 6,
}

export const PLAYER_MODE_NUM_TO_CLIP: Readonly<Record<number, CharAnimClipKey>> = {
  0: 'dt',
  1: 'nu',
  2: 'wl',
  3: 'rn',
  4: 'gh',
  5: 'tn',
  6: 'tw',
  7: 'a1',
  8: 'a2',
  9: 'bl',
  10: 'sc',
  11: 'th', // TH (Throw)
  12: 'kk', // KK (Kick)
  13: 's1', // S1 (Skill 1)
  14: 's2', // S2 (Skill 2)
  15: 's3', // S3 (Skill 3)
  16: 's4', // S4 (Skill 4)
  17: 'dd',
  18: 'a1', // SQ (Sequence)
  19: 'gh', // KB (Knock back, token GH)
}

const VAMPIRE_MORPH_CLIPS_113C: Readonly<Partial<Record<CharAnimClipKey, CharAnimClip113c>>> = {
  wl: makeClip113c(8, 176, true, []),
  nu: makeClip113c(10, 176, true, []),
  rn: makeClip113c(8, 176, true, []),
  a1: makeClip113c(14, 240, false, [{ f: 4, c: 1 }]),
  a2: makeClip113c(14, 176, false, [{ f: 6, c: 2 }]),
  sc: makeClip113c(15, 160, false, [{ f: 3, c: 2 }]),
  s1: makeClip113c(15, 160, false, [{ f: 3, c: 2 }]),
  s2: makeClip113c(15, 160, false, [{ f: 3, c: 2 }]),
  s3: makeClip113c(15, 160, false, [{ f: 3, c: 2 }]),
  s4: makeClip113c(15, 160, false, [{ f: 3, c: 2 }]),
  gh: makeClip113c(6, 176, false, []),
  dt: makeClip113c(18, 240, false, []),
  dd: makeClip113c(1, 256, false, []),
  tn: makeClip113c(10, 176, true, []),
  tw: makeClip113c(8, 176, true, []),
}

const BONEFETISH_MORPH_CLIPS_113C: Readonly<Partial<Record<CharAnimClipKey, CharAnimClip113c>>> = {
  wl: makeClip113c(6, 256, true, []),
  nu: makeClip113c(12, 256, true, []),
  rn: makeClip113c(6, 256, true, []),
  a1: makeClip113c(12, 256, false, [{ f: 8, c: 1 }]),
  a2: makeClip113c(12, 256, false, [{ f: 8, c: 1 }]),
  bl: makeClip113c(10, 256, false, []),
  sc: makeClip113c(12, 256, false, [{ f: 8, c: 1 }]),
  s1: makeClip113c(12, 256, false, [{ f: 8, c: 1 }]),
  s2: makeClip113c(12, 256, false, [{ f: 8, c: 1 }]),
  s3: makeClip113c(12, 256, false, [{ f: 8, c: 1 }]),
  s4: makeClip113c(12, 256, false, [{ f: 8, c: 1 }]),
  gh: makeClip113c(10, 256, false, []),
  dt: makeClip113c(15, 256, false, []),
  dd: makeClip113c(1, 256, false, []),
  tn: makeClip113c(12, 256, true, []),
  tw: makeClip113c(6, 256, true, []),
}

/**
 * Canonical 1.13c `AnimData.d2` clip metadata for player shapeshift morphs
 * (`D2COMMON_11013_ConvertMode`: Werewolf state 139 -> 430 `40`, Werebear state 140 -> 431 `TG`,
 * Vampire state 176 `monsterset` -> `MonStats.txt` 135 `vampire5` token `VA`,
 * Delirium state 177 `delerium` -> `MonStats.txt` 212 `bonefetish1` token `FK`).
 */
export const MORPH_ANIM_CLIPS_113C: Readonly<
  Record<number, Readonly<Partial<Record<CharAnimClipKey, CharAnimClip113c>>>>
> = {
  // 430: Werewolf (token 40)
  430: {
    wl: makeClip113c(8, 224, true, []),
    nu: makeClip113c(8, 128, true, []),
    rn: makeClip113c(8, 240, true, []),
    a1: makeClip113c(13, 192, false, [{ f: 7, c: 1 }]),
    a2: makeClip113c(13, 216, false, [{ f: 9, c: 1 }]),
    bl: makeClip113c(7, 296, false, []),
    sc: makeClip113c(11, 168, false, [{ f: 5, c: 1 }]),
    s1: makeClip113c(12, 232, false, [{ f: 7, c: 1 }]),
    s2: makeClip113c(12, 232, false, [{ f: 7, c: 1 }]),
    s3: makeClip113c(10, 144, false, [{ f: 6, c: 1 }]),
    s4: makeClip113c(16, 256, false, []),
    gh: makeClip113c(7, 296, false, []),
    dt: makeClip113c(19, 256, false, []),
    dd: makeClip113c(1, 256, false, []),
    tn: makeClip113c(8, 128, true, []),
    tw: makeClip113c(8, 224, true, []),
  },
  // 431: Werebear (token TG)
  431: {
    wl: makeClip113c(8, 136, true, []),
    nu: makeClip113c(8, 96, true, []),
    rn: makeClip113c(8, 200, true, []),
    a1: makeClip113c(12, 160, false, [{ f: 7, c: 1 }]),
    a2: makeClip113c(12, 176, false, [{ f: 7, c: 1 }]),
    bl: makeClip113c(5, 200, false, []),
    sc: makeClip113c(10, 152, false, [{ f: 5, c: 1 }]),
    s1: makeClip113c(10, 152, false, [{ f: 5, c: 1 }]),
    s2: makeClip113c(10, 152, false, [{ f: 5, c: 1 }]),
    s3: makeClip113c(10, 208, false, [{ f: 6, c: 1 }]),
    s4: makeClip113c(7, 152, false, [{ f: 4, c: 1 }]),
    gh: makeClip113c(5, 184, false, []),
    dt: makeClip113c(13, 256, false, []),
    dd: makeClip113c(1, 256, false, []),
    tn: makeClip113c(8, 96, true, []),
    tw: makeClip113c(8, 136, true, []),
  },
  // 135: Vampire (`vampire5` in MonStats.txt, States.txt row 176 `monsterset` gfxclass=135, token VA)
  135: VAMPIRE_MORPH_CLIPS_113C,
  // 200: Legacy Vampire morph alias
  200: VAMPIRE_MORPH_CLIPS_113C,
  // 212: Bone Fetish (`bonefetish1` in MonStats.txt, States.txt row 177 `delerium` gfxclass=212, token FK)
  212: BONEFETISH_MORPH_CLIPS_113C,
}

/**
 * Per-weapon-class (`wclass`) 1.13c `AnimData.d2` overrides by player class (`0..6`) and mode.
 * Ground truth extracted directly from `data/global/AnimData.d2` (`public/anim/animdata.json`).
 */
export const CHAR_WCLASS_ANIM_CLIPS_113C: Readonly<
  Record<
    number,
    Readonly<Partial<Record<CharAnimClipKey, Readonly<Record<string, CharAnimClip113c>>>>>
  >
> = {
  // 0: Amazon (AM)
  0: {
    a1: {
      hth: makeClip113c(13, 256, false, [{ f: 8, c: 1 }]),
      bow: makeClip113c(14, 256, false, [{ f: 6, c: 2 }]),
      '1ht': makeClip113c(15, 256, false, [{ f: 9, c: 1 }]),
      '1hs': makeClip113c(16, 256, false, [{ f: 10, c: 1 }]),
      '2ht': makeClip113c(18, 256, false, [{ f: 11, c: 1 }]),
      '2hs': makeClip113c(20, 256, false, [{ f: 12, c: 1 }]),
      stf: makeClip113c(20, 256, false, [{ f: 12, c: 1 }]),
      xbw: makeClip113c(20, 256, false, [{ f: 9, c: 2 }]),
    },
    a2: {
      hth: makeClip113c(13, 256, false, [{ f: 8, c: 1 }]),
      bow: makeClip113c(14, 256, false, [{ f: 6, c: 2 }]),
      '1ht': makeClip113c(15, 256, false, [{ f: 9, c: 1 }]),
      '1hs': makeClip113c(16, 256, false, [{ f: 10, c: 1 }]),
      '2ht': makeClip113c(18, 256, false, [{ f: 11, c: 1 }]),
      '2hs': makeClip113c(20, 256, false, [{ f: 12, c: 1 }]),
      stf: makeClip113c(20, 256, false, [{ f: 12, c: 1 }]),
      xbw: makeClip113c(20, 256, false, [{ f: 9, c: 2 }]),
    },
    bl: {
      '1hs': makeClip113c(3, 88, false, []),
    },
    sc: {
      '2hs': makeClip113c(20, 256, false, [{ f: 10, c: 1 }]),
      '2ht': makeClip113c(20, 256, false, [{ f: 10, c: 1 }]),
      stf: makeClip113c(20, 256, false, [{ f: 11, c: 1 }]),
      bow: makeClip113c(20, 256, false, [{ f: 12, c: 1 }]),
    },
  },
  // 1: Sorceress (SO)
  1: {
    a1: {
      hth: makeClip113c(16, 256, false, [{ f: 9, c: 1 }]),
      bow: makeClip113c(17, 256, false, [{ f: 9, c: 2 }]),
      stf: makeClip113c(18, 256, false, [{ f: 11, c: 1 }]),
      '1ht': makeClip113c(19, 256, false, [{ f: 11, c: 1 }]),
      '1hs': makeClip113c(20, 256, false, [{ f: 12, c: 1 }]),
      xbw: makeClip113c(20, 256, false, [{ f: 11, c: 2 }]),
      '2ht': makeClip113c(23, 256, false, [{ f: 13, c: 1 }]),
      '2hs': makeClip113c(24, 256, false, [{ f: 14, c: 1 }]),
    },
    a2: {
      hth: makeClip113c(16, 256, false, [{ f: 8, c: 1 }]),
      bow: makeClip113c(17, 256, false, [{ f: 9, c: 2 }]),
      stf: makeClip113c(18, 256, false, [{ f: 11, c: 1 }]),
      '1ht': makeClip113c(19, 256, false, [{ f: 11, c: 1 }]),
      '1hs': makeClip113c(20, 256, false, [{ f: 12, c: 1 }]),
      xbw: makeClip113c(20, 256, false, [{ f: 11, c: 2 }]),
      '2ht': makeClip113c(23, 256, false, [{ f: 13, c: 1 }]),
      '2hs': makeClip113c(24, 256, false, [{ f: 14, c: 1 }]),
    },
  },
  // 2: Necromancer (NE)
  2: {
    a1: {
      hth: makeClip113c(15, 256, false, [{ f: 8, c: 1 }]),
      bow: makeClip113c(18, 256, false, [{ f: 9, c: 2 }]),
      '1hs': makeClip113c(19, 256, false, [{ f: 9, c: 1 }]),
      '1ht': makeClip113c(19, 256, false, [{ f: 9, c: 1 }]),
      stf: makeClip113c(20, 256, false, [{ f: 11, c: 1 }]),
      xbw: makeClip113c(20, 256, false, [{ f: 11, c: 2 }]),
      '2hs': makeClip113c(23, 256, false, [{ f: 11, c: 1 }]),
      '2ht': makeClip113c(24, 256, false, [{ f: 10, c: 1 }]),
    },
    a2: {
      hth: makeClip113c(15, 256, false, [{ f: 8, c: 1 }]),
      bow: makeClip113c(18, 256, false, [{ f: 9, c: 2 }]),
      '1hs': makeClip113c(19, 256, false, [{ f: 9, c: 1 }]),
      '1ht': makeClip113c(19, 256, false, [{ f: 9, c: 1 }]),
      stf: makeClip113c(20, 256, false, [{ f: 11, c: 1 }]),
      xbw: makeClip113c(20, 256, false, [{ f: 11, c: 2 }]),
      '2hs': makeClip113c(23, 256, false, [{ f: 11, c: 1 }]),
      '2ht': makeClip113c(24, 256, false, [{ f: 10, c: 1 }]),
    },
  },
  // 3: Paladin (PA)
  3: {
    a1: {
      hth: makeClip113c(14, 256, false, [{ f: 7, c: 1 }]),
      '1hs': makeClip113c(15, 256, false, [{ f: 7, c: 1 }]),
      bow: makeClip113c(16, 256, false, [{ f: 8, c: 2 }]),
      '1ht': makeClip113c(17, 256, false, [{ f: 8, c: 1 }]),
      '2hs': makeClip113c(18, 256, false, [{ f: 8, c: 1 }]),
      stf: makeClip113c(18, 256, false, [{ f: 9, c: 1 }]),
      '2ht': makeClip113c(20, 256, false, [{ f: 8, c: 1 }]),
      xbw: makeClip113c(20, 256, false, [{ f: 10, c: 2 }]),
    },
    a2: {
      hth: makeClip113c(14, 256, false, [{ f: 8, c: 1 }]),
      '1hs': makeClip113c(15, 256, false, [{ f: 7, c: 1 }]),
      bow: makeClip113c(16, 256, false, [{ f: 8, c: 2 }]),
      '1ht': makeClip113c(17, 256, false, [{ f: 8, c: 1 }]),
      stf: makeClip113c(18, 256, false, [{ f: 9, c: 1 }]),
      '2hs': makeClip113c(19, 256, false, [{ f: 8, c: 1 }]),
      '2ht': makeClip113c(20, 256, false, [{ f: 9, c: 1 }]),
      xbw: makeClip113c(20, 256, false, [{ f: 10, c: 2 }]),
    },
    th: {
      hth: makeClip113c(12, 256, false, [{ f: 6, c: 2 }]),
      '1hs': makeClip113c(16, 256, false, [{ f: 8, c: 2 }]),
      '1ht': makeClip113c(16, 256, false, [{ f: 8, c: 2 }]),
    },
    bl: {
      '2hs': makeClip113c(3, 168, false, []),
    },
    gh: {
      '2ht': makeClip113c(5, 192, false, []),
      stf: makeClip113c(5, 192, false, []),
    },
  },
  // 4: Barbarian (BA)
  4: {
    a1: {
      hth: makeClip113c(12, 256, false, [{ f: 6, c: 1 }]),
      bow: makeClip113c(15, 256, false, [{ f: 7, c: 2 }]),
      '1hs': makeClip113c(16, 256, false, [{ f: 7, c: 1 }]),
      '1ht': makeClip113c(16, 256, false, [{ f: 7, c: 1 }]),
      '1ss': makeClip113c(16, 256, false, [{ f: 7, c: 1 }]),
      '1st': makeClip113c(16, 256, false, [{ f: 7, c: 1 }]),
      '1js': makeClip113c(16, 256, false, [{ f: 7, c: 1 }]),
      '1jt': makeClip113c(16, 256, false, [{ f: 7, c: 1 }]),
      '2hs': makeClip113c(18, 256, false, [{ f: 8, c: 1 }]),
      '2ht': makeClip113c(19, 256, false, [{ f: 9, c: 1 }]),
      stf: makeClip113c(19, 256, false, [{ f: 9, c: 1 }]),
      xbw: makeClip113c(20, 256, false, [{ f: 10, c: 2 }]),
    },
    a2: {
      hth: makeClip113c(12, 256, false, [{ f: 6, c: 1 }]),
      bow: makeClip113c(15, 256, false, [{ f: 7, c: 2 }]),
      '1hs': makeClip113c(16, 256, false, [{ f: 7, c: 1 }]),
      '1ht': makeClip113c(16, 256, false, [{ f: 7, c: 1 }]),
      '1ss': makeClip113c(16, 256, false, [{ f: 7, c: 1 }]),
      '1st': makeClip113c(16, 256, false, [{ f: 7, c: 1 }]),
      '1js': makeClip113c(16, 256, false, [{ f: 8, c: 1 }]),
      '1jt': makeClip113c(16, 256, false, [{ f: 7, c: 1 }]),
      '2hs': makeClip113c(18, 256, false, [{ f: 8, c: 1 }]),
      '2ht': makeClip113c(19, 256, false, [{ f: 9, c: 1 }]),
      stf: makeClip113c(19, 256, false, [{ f: 9, c: 1 }]),
      xbw: makeClip113c(20, 256, false, [{ f: 10, c: 2 }]),
    },
    s3: {
      '1ss': makeClip113c(12, 256, false, [{ f: 7, c: 1 }]),
      '1st': makeClip113c(12, 256, false, [{ f: 7, c: 1 }]),
      '1js': makeClip113c(12, 256, false, [{ f: 8, c: 1 }]),
      '1jt': makeClip113c(12, 256, false, [{ f: 8, c: 1 }]),
    },
    s4: {
      '1ss': makeClip113c(16, 256, false, [{ f: 9, c: 2 }]),
      '1st': makeClip113c(16, 256, false, [{ f: 9, c: 2 }]),
      '1js': makeClip113c(16, 256, false, [{ f: 8, c: 2 }]),
      '1jt': makeClip113c(16, 256, false, [{ f: 8, c: 2 }]),
    },
  },
  // 5: Druid (DZ)
  5: {
    a1: {
      hth: makeClip113c(16, 256, false, [{ f: 8, c: 1 }]),
      bow: makeClip113c(16, 256, false, [{ f: 8, c: 2 }]),
      stf: makeClip113c(17, 256, false, [{ f: 9, c: 1 }]),
      '1hs': makeClip113c(19, 256, false, [{ f: 9, c: 1 }]),
      '1ht': makeClip113c(19, 256, false, [{ f: 8, c: 1 }]),
      xbw: makeClip113c(20, 256, false, [{ f: 10, c: 2 }]),
      '2hs': makeClip113c(21, 256, false, [{ f: 10, c: 1 }]),
      '2ht': makeClip113c(23, 256, false, [{ f: 9, c: 1 }]),
    },
    a2: {
      hth: makeClip113c(16, 256, false, [{ f: 8, c: 1 }]),
      bow: makeClip113c(16, 256, false, [{ f: 8, c: 2 }]),
      stf: makeClip113c(17, 256, false, [{ f: 9, c: 1 }]),
      '1hs': makeClip113c(19, 256, false, [{ f: 9, c: 1 }]),
      '1ht': makeClip113c(19, 256, false, [{ f: 8, c: 1 }]),
      xbw: makeClip113c(20, 256, false, [{ f: 10, c: 2 }]),
      '2hs': makeClip113c(21, 256, false, [{ f: 10, c: 1 }]),
      '2ht': makeClip113c(23, 256, false, [{ f: 9, c: 1 }]),
    },
    th: {
      hth: makeClip113c(18, 256, false, [{ f: 9, c: 2 }]),
      '1hs': makeClip113c(18, 256, false, [{ f: 8, c: 2 }]),
      '1ht': makeClip113c(18, 256, false, [{ f: 8, c: 2 }]),
    },
    kk: {
      '1hs': makeClip113c(12, 224, false, [{ f: 5, c: 1 }]),
      '2hs': makeClip113c(12, 224, false, [{ f: 5, c: 1 }]),
    },
    s1: {
      '2hs': makeClip113c(15, 208, false, [{ f: 8, c: 1 }]),
      '2ht': makeClip113c(15, 208, false, [{ f: 8, c: 1 }]),
      bow: makeClip113c(15, 208, false, [{ f: 8, c: 1 }]),
      stf: makeClip113c(15, 208, false, [{ f: 8, c: 1 }]),
      '1hs': makeClip113c(15, 256, false, [{ f: 9, c: 1 }]),
    },
    gh: {
      '1hs': makeClip113c(7, 248, false, []),
    },
  },
  // 6: Assassin (AI)
  6: {
    a1: {
      hth: makeClip113c(11, 256, false, [{ f: 6, c: 1 }]),
      ht1: makeClip113c(11, 208, false, [{ f: 6, c: 1 }]),
      ht2: makeClip113c(11, 208, false, [{ f: 6, c: 1 }]),
      '1hs': makeClip113c(15, 256, false, [{ f: 7, c: 1 }]),
      '1ht': makeClip113c(15, 256, false, [{ f: 7, c: 1 }]),
      bow: makeClip113c(16, 256, false, [{ f: 7, c: 2 }]),
      stf: makeClip113c(19, 256, false, [{ f: 9, c: 1 }]),
      xbw: makeClip113c(21, 256, false, [{ f: 10, c: 2 }]),
      '2hs': makeClip113c(23, 256, false, [{ f: 11, c: 1 }]),
      '2ht': makeClip113c(23, 256, false, [{ f: 10, c: 1 }]),
    },
    a2: {
      hth: makeClip113c(12, 256, false, [{ f: 6, c: 1 }]),
      ht1: makeClip113c(12, 208, false, [{ f: 6, c: 1 }]),
      ht2: makeClip113c(12, 208, false, [{ f: 6, c: 1 }]),
      '1hs': makeClip113c(15, 256, false, [{ f: 7, c: 1 }]),
      '1ht': makeClip113c(15, 256, false, [{ f: 7, c: 1 }]),
      bow: makeClip113c(16, 256, false, [{ f: 7, c: 2 }]),
      stf: makeClip113c(19, 256, false, [{ f: 9, c: 1 }]),
      xbw: makeClip113c(21, 256, false, [{ f: 10, c: 2 }]),
      '2hs': makeClip113c(23, 256, false, [{ f: 11, c: 1 }]),
      '2ht': makeClip113c(23, 256, false, [{ f: 10, c: 1 }]),
    },
    s1: {
      hth: makeClip113c(17, 256, false, [{ f: 10, c: 1 }]),
      ht1: makeClip113c(17, 256, false, [{ f: 10, c: 1 }]),
      ht2: makeClip113c(15, 256, false, [{ f: 10, c: 1 }]),
      '1hs': makeClip113c(15, 256, false, [{ f: 7, c: 1 }]),
      '1ht': makeClip113c(15, 256, false, [{ f: 7, c: 1 }]),
      '2hs': makeClip113c(15, 256, false, [{ f: 7, c: 1 }]),
      '2ht': makeClip113c(15, 256, false, [{ f: 7, c: 1 }]),
      bow: makeClip113c(15, 256, false, [{ f: 7, c: 1 }]),
      stf: makeClip113c(15, 256, false, [{ f: 7, c: 1 }]),
      xbw: makeClip113c(15, 256, false, [{ f: 7, c: 1 }]),
    },
    s4: {
      ht1: makeClip113c(12, 208, false, [{ f: 6, c: 1 }]),
      ht2: makeClip113c(12, 208, false, [{ f: 6, c: 1 }]),
    },
  },
}

/**
 * Resolves the canonical 1.13c `AnimData.d2` clip metadata for a given character class
 * (`0..6` or token `'am'|'so'|'ne'|'pa'|'ba'|'dz'|'ai'`) and mode (`0..18` or clip key),
 * honoring shapeshift morph records (`430` Werewolf, `431` Werebear, `135`/`200` Vampire,
 * `212` Bone Fetish) and weapon-class (`wclass`) variations in `AnimData.d2`.
 */
export function getCharAnimClip113c(
  classIdOrToken: number | string,
  modeOrClipKey: number | string,
  options?: {
    readonly weaponClass?: string | null | undefined
    readonly morphMonsterClassId?: number | null | undefined
  },
): CharAnimClip113c {
  const classId =
    typeof classIdOrToken === 'number'
      ? classIdOrToken >= 0 && classIdOrToken <= 6
        ? Math.trunc(classIdOrToken)
        : 1
      : (TOKEN_TO_CLASS_ID[classIdOrToken.trim().toLowerCase()] ?? 1)
  const classClips = CHAR_ANIM_CLIPS_113C[classId] ?? CHAR_ANIM_CLIPS_113C[1]!

  const clipKey: CharAnimClipKey =
    typeof modeOrClipKey === 'number'
      ? (PLAYER_MODE_NUM_TO_CLIP[Math.trunc(modeOrClipKey)] ?? 'nu')
      : ((modeOrClipKey.trim().toLowerCase() as CharAnimClipKey) in classClips
          ? (modeOrClipKey.trim().toLowerCase() as CharAnimClipKey)
          : 'nu')

  if (options?.morphMonsterClassId !== undefined && options.morphMonsterClassId !== null) {
    const morphClips = MORPH_ANIM_CLIPS_113C[Math.trunc(options.morphMonsterClassId)]
    if (morphClips?.[clipKey]) {
      return morphClips[clipKey]!
    }
  }

  const baseClip = classClips[clipKey] ?? classClips.nu
  const wclass = options?.weaponClass ? options.weaponClass.trim().toLowerCase() : ''
  if (wclass) {
    const modeWcMap = CHAR_WCLASS_ANIM_CLIPS_113C[classId]?.[clipKey]
    if (modeWcMap) {
      if (modeWcMap[wclass]) {
        return modeWcMap[wclass]!
      }
      if ((wclass === '1ss' || wclass === '1js') && modeWcMap['1hs']) {
        return modeWcMap['1hs']!
      }
      if ((wclass === '1st' || wclass === '1jt') && modeWcMap['1ht']) {
        return modeWcMap['1ht']!
      }
    }
  }

  return baseClip
}

/**
 * 1.13c diminishing returns formula (`D2Common.dll`):
 * `floor(120 * rate / (120 + rate))` for `rate > 0`.
 */
export function computeDiminishingRate113c(rate: number): number {
  if (!Number.isFinite(rate)) return 0
  if (rate <= 0) return Math.max(-85, Math.trunc(rate))
  return Math.trunc((120 * rate) / (120 + rate))
}

/**
 * Effective Faster Cast Rate (`EFCR = clamp(diminished(fcr), -85, 75)`).
 */
export function computeEffectiveFcr(fcr: number): number {
  return Math.max(-85, Math.min(75, computeDiminishingRate113c(fcr)))
}

/**
 * Effective Increased Attack Speed (`EIAS = clamp(diminished(itemIas) + skillIas - weaponWsm, -85, 75)`).
 * Accepts either an options object `{ itemIas, skillIas, weaponWsm }` or positional `(itemIas, skillIas, weaponWsm)`.
 */
export function computeEffectiveIas(
  input:
    | {
        readonly itemIas: number
        readonly skillIas?: number | undefined
        readonly weaponWsm?: number | undefined
      }
    | number,
  skillIasArg = 0,
  weaponWsmArg = 0,
): number {
  const itemIas = typeof input === 'number' ? input : input.itemIas
  const skillIas = typeof input === 'number' ? skillIasArg : (input.skillIas ?? 0)
  const weaponWsm = typeof input === 'number' ? weaponWsmArg : (input.weaponWsm ?? 0)
  const dimIas = computeDiminishingRate113c(itemIas)
  const safeSkillIas = Number.isFinite(skillIas) ? Math.trunc(skillIas) : 0
  const safeWsm = Number.isFinite(weaponWsm) ? Math.trunc(weaponWsm) : 0
  return Math.max(-85, Math.min(75, dimIas + safeSkillIas - safeWsm))
}

/**
 * Effective Faster Hit Recovery (`EFHR = clamp(diminished(fhr), -85, 75)`).
 */
export function computeEffectiveFhr(fhr: number): number {
  return Math.max(-85, Math.min(75, computeDiminishingRate113c(fhr)))
}

/**
 * Effective 8.8 fixed-point animation step speed:
 * `stepSpeed256 = max(32, floor(baseSpeed * (100 + effRate) / 100))`.
 */
export function computeStepSpeed256(baseSpeed: number, effRate = 0): number {
  const safeBase = Number.isFinite(baseSpeed) && baseSpeed > 0 ? baseSpeed : 256
  const safeRate = Number.isFinite(effRate) ? effRate : 0
  return Math.max(32, Math.floor((safeBase * (100 + safeRate)) / 100))
}

/** 1.13c `STAT_VELOCITYPERCENT` (ItemStatCost.txt id 67): total move velocity percent (base 100). */
export const STAT_VELOCITYPERCENT = 67

/** Player walk/town-walk base anim speed hardcode (`UNITS_GetBaseAnimSpeed`, 0x6FD7FB10). */
export const PLAYER_WALK_BASE_ANIM_SPEED_113C = 213

/** Player run base anim speed hardcode (`UNITS_GetBaseAnimSpeed`, 0x6FD7FB10). */
export const PLAYER_RUN_BASE_ANIM_SPEED_113C = 101

/**
 * D2Common.dll `UNITS_GetBaseAnimSpeed` (1.13c 0x6FD7FB10, D2MOO Units.cpp:1256): player
 * locomotion animation BASE speeds are HARDCODED for all 7 classes and IGNORE the per-COF
 * AnimData.d2 speeds:
 * - run (`PLRMODE_RUN` 3): 101 (0x65)
 * - every other player mode (walk 2 / town-walk 6 / neutral / attack / cast / …): 213 (0xD5)
 *
 * The run bonus is NOT baked into the base: the engine writes a temporary
 * `STAT_VELOCITYPERCENT` stat when a character enters run mode
 * (`UNITS_CharacterStartRunningOrKnockback`, Units.cpp:701:
 * `100 * RunVelocity / WalkVelocity - 100`), then scales the base by the total move velocity
 * percent (`UNITS_UpdateRunWalkAnimRateAndVelocity`, 0x6FD83331):
 * `trunc(base × max(25, EFRW + stat67) / 100)`. With the effective 1.13c
 * `CharStats.txt` (`Patch_D2.mpq`, all 7 classes `WalkVelocity=6` / `RunVelocity=9`) the
 * run bonus is +50%, so naked locomotion resolves to walk 213 / run 151.
 *
 * NOTE (issue #869): the previously baked `rn = 158` came from `100×157/100` with the
 * classic `d2data.mpq` `CharStats.txt` (`WalkVelocity=7` / `RunVelocity=11`, +57%) — a
 * pre-LoD table that `Patch_D2.mpq` overrides at MPQ-load time, so it is not the 1.13c
 * runtime truth (verified against the staged vanilla 1.13c MPQs and the SOE mod MPQs,
 * which all ship 6/9).
 *
 * AnimData per-COF speeds apply only to monsters/objects/missiles and to the player's
 * non-locomotion modes (cast/attack/gethit use `pAnimData->dwAnimSpeed` via the
 * mode-specific rate formulas). Using AnimData's 256/288/168 for player walk made
 * locomotion play ~1.2x (walk) to ~1.6x (run) faster than the native client (issue #852).
 */
export function resolvePlayerLocomotionBaseSpeed256(
  clipKey: string,
  animDataBaseSpeed: number,
): number {
  if (clipKey === 'rn') return PLAYER_RUN_BASE_ANIM_SPEED_113C
  if (clipKey === 'wl' || clipKey === 'tw') return PLAYER_WALK_BASE_ANIM_SPEED_113C
  return animDataBaseSpeed
}

/**
 * Diminishing-returns base for `STAT_ITEM_FASTERMOVEVELOCITY` (96)
 * (`gaAnimModeStatBasePercentage[ANIMMODESTAT_MOVEVELOCITY]` @ 0x6FDE4608: `{TRUE, 150, 96}`).
 */
export const MOVE_VELOCITY_DIMINISHING_BASE_113C = 150

/**
 * Effective item FRW: `trunc(150 × frw / (150 + frw))` for `frw > 0` (negative totals pass
 * through unchanged; `UNITS_GetAnimStatBasePercentage` skips the formula for zero).
 */
export function computeFrwDiminishing113c(frw: number): number {
  if (!Number.isFinite(frw)) return 0
  const v = Math.trunc(frw)
  if (v <= 0) return v
  return Math.trunc((MOVE_VELOCITY_DIMINISHING_BASE_113C * v) / (MOVE_VELOCITY_DIMINISHING_BASE_113C + v))
}

export interface MoveVelocityPercentSources113c {
  /**
   * Complete `STAT_VELOCITYPERCENT` (67) total for the unit — base 100 plus skill velocity
   * (Vigor/Burst of Speed), minus the armor items' implicit `-Armor.txt speed` stat and
   * chill/slow. When provided (nonzero) it is used as-is and neither the run bonus nor the
   * armor penalty is applied again; when absent the client synthesizes
   * `100 + run bonus − armorSpeedPenalty` (the native engine posts the run temp stat
   * client-side as well, `UNITS_SetAnimStartFrame` → `CharacterStartRunningOrKnockback`,
   * and the armor penalty is an implicit item stat).
   *
   * Armor penalty note (vanilla vs SOE): vanilla 1.13c ships medium 5 / heavy 10 torso
   * rows in `Armor.txt` (36 nonzero rows in Patch_D2.mpq); the SOE mod zeroes the whole
   * column. This port replicates vanilla 1.13c, so the penalty IS applied from the
   * canonical table when the server total is unavailable.
   */
  readonly stat67?: number | undefined
  /** Raw `STAT_ITEM_FASTERMOVEVELOCITY` (96) total from equipped items (diminishing base 150). */
  readonly itemFrw?: number | undefined
  /**
   * Sum of `Armor.txt` `speed` for equipped armor items (positive percent). Only used when
   * `stat67` is not provided; a server-provided total already contains the implicit
   * item stats.
   */
  readonly armorSpeedPenalty?: number | undefined
  /**
   * Skill velocity bonus (`STAT_VELOCITYPERCENT = 67`, e.g. Barbarian `#148 Increased Speed`
   * `dm12(7, 50)`, Paladin `#115 Vigor`, Assassin `#258 Burst of Speed`) added directly to
   * `stat67` without the 150-base item FRW diminishing returns when `stat67` is synthesized.
   */
  readonly skillVelocityPercent?: number | undefined
  /** Run mode active (`PLRMODE_RUN` 3): applies the CharStats run bonus (+50% at 9/6). */
  readonly running?: boolean | undefined
  /** `CharStats.txt` `WalkVelocity` (default 6, the effective 1.13c value). */
  readonly walkVelocity?: number | undefined
  /** `CharStats.txt` `RunVelocity` (default 9, the effective 1.13c value). */
  readonly runVelocity?: number | undefined
}

/**
 * Total move velocity percent (`UNITS_UpdateRunWalkAnimRateAndVelocity`, 0x6FD83331):
 * `max(25, EFRW + STAT_VELOCITYPERCENT)` — the 25 floor applies to the percent, NOT to the
 * resulting anim speed (so a floored run animates at `trunc(101×25/100) = 25`, not 32).
 */
export function computeMoveVelocityPercent113c(sources: MoveVelocityPercentSources113c = {}): number {
  const walk = sources.walkVelocity ?? 6
  const run = sources.runVelocity ?? 9
  const efrw = computeFrwDiminishing113c(sources.itemFrw ?? 0)
  let stat67: number
  if (Number.isFinite(sources.stat67) && Math.trunc(sources.stat67 as number) !== 0) {
    stat67 = Math.trunc(sources.stat67 as number)
  } else {
    const runBonus = sources.running && walk > 0 ? Math.trunc((100 * run) / walk) - 100 : 0
    const armorPenalty = Math.max(0, Math.trunc(sources.armorSpeedPenalty ?? 0))
    const skillVel = Number.isFinite(sources.skillVelocityPercent)
      ? Math.trunc(sources.skillVelocityPercent as number)
      : 0
    stat67 = 100 + runBonus + skillVel - armorPenalty
  }
  return Math.max(25, stat67 + efrw)
}

/**
 * Locomotion step speed (`UNITS_UpdateRunWalkAnimRateAndVelocity`, 0x6FD83331):
 * `trunc(base × velocityPercent / 100)` clamped to `[0, 32767]` with NO 32 floor — unlike
 * {@link computeStepSpeed256}, whose floor exists for the one-shot rate formulas only.
 */
export function computeLocomotionStepSpeed256(baseSpeed: number, velocityPercent: number): number {
  const safeBase = Number.isFinite(baseSpeed) && baseSpeed > 0 ? Math.trunc(baseSpeed) : 0
  const pct = Number.isFinite(velocityPercent) ? Math.trunc(velocityPercent) : 100
  const raw = Math.trunc((safeBase * pct) / 100)
  return Math.max(0, Math.min(32767, raw))
}

/**
 * Total 25Hz simulation ticks for a standard non-sequence one-shot animation
 * (`D2Common.dll` `#10426` `UNITS_IsAtEndOfFrameCycle`, `0x6FD7EF30` at `0x6FD7EF6D`:
 * `dwFrame + wAnimSpeed >= dwFrameCount` where `dwFrameCount = frames << 8`):
 * `max(1, ceil(frames * 256 / stepSpeed256) - 1)`.
 */
export function computeOneShotTicks(frames: number, stepSpeed256: number): number {
  const safeFrames = Math.max(1, Math.trunc(Number.isFinite(frames) ? frames : 1))
  const safeSpeed = Math.max(32, Math.trunc(Number.isFinite(stepSpeed256) ? stepSpeed256 : 256))
  if (safeFrames <= 1) return 1
  return Math.max(1, Math.ceil((safeFrames * 256) / safeSpeed) - 1)
}

/**
 * Total duration in milliseconds for a standard non-sequence one-shot animation at 25Hz (40ms per tick):
 * `computeOneShotTicks(frames, stepSpeed256) * 40`.
 */
export function computeOneShotDurationMs(frames: number, stepSpeed256: number): number {
  return computeOneShotTicks(frames, stepSpeed256) * D2_TICK_MS
}

/**
 * Total 25Hz simulation ticks for a `PLRMODE_SEQUENCE` (`SQ` mode 18) animation
 * (`D2Common.dll` `#10426` `0x6FD7EF57` when `pSeqRecord != NULL`: `dwFrame >= dwFrameCount`):
 * `max(1, ceil(totalSequenceFrames * 256 / stepSpeed256))`.
 */
export function computeSequenceTicks(totalSequenceFrames: number, stepSpeed256: number): number {
  const safeFrames = Math.max(
    1,
    Math.trunc(Number.isFinite(totalSequenceFrames) ? totalSequenceFrames : 1),
  )
  const safeSpeed = Math.max(32, Math.trunc(Number.isFinite(stepSpeed256) ? stepSpeed256 : 256))
  return Math.max(1, Math.ceil((safeFrames * 256) / safeSpeed))
}

/**
 * Total duration in milliseconds for a `PLRMODE_SEQUENCE` (`SQ` mode 18) animation at 25Hz (40ms per tick).
 */
export function computeSequenceDurationMs(
  totalSequenceFrames: number,
  stepSpeed256: number,
): number {
  return computeSequenceTicks(totalSequenceFrames, stepSpeed256) * D2_TICK_MS
}

/**
 * Simulation ticks from animation start (frame 0) until `dwFrame >= actionFrame << 8`:
 * `max(1, ceil(actionFrame * 256 / stepSpeed256))`.
 */
export function computeActionFrameTicks(actionFrame: number, stepSpeed256: number): number {
  return computeSequenceTicks(actionFrame, stepSpeed256)
}

let cachedWeaponsTable: WeaponTable | null = null

/**
 * Lazily parses and memoizes the canonical 1.13c `Weapons.txt` table (`RAW_WEAPONS`).
 */
export function getCanonicalWeaponsTable(): WeaponTable {
  if (!cachedWeaponsTable) {
    cachedWeaponsTable = parseWeaponsTable(RAW_WEAPONS)
  }
  return cachedWeaponsTable
}

/**
 * Resolves a weapon record from canonical 1.13c `Weapons.txt` by item code.
 */
export function resolveWeaponBase113c(code: string | undefined | null): WeaponBase | undefined {
  if (!code) return undefined
  const trimmed = code.trim()
  if (!trimmed) return undefined
  return getCanonicalWeaponsTable().get(trimmed)
}

/**
 * Resolves the 1.13c Weapon Speed Modifier (`WSM`, `speed` column in `Weapons.txt`) for an item code.
 * Unarmed (`hth`) or non-weapon codes return `0`.
 */
export function resolveWeaponWsm(code: string | undefined | null): number {
  const weapon = resolveWeaponBase113c(code)
  return weapon ? weapon.speed : 0
}

let cachedArmorSpeedsByCode: Map<string, number> | null = null

/**
 * Canonical 1.13c `Armor.txt` `speed` column by item code (vanilla values: medium torso
 * armors 5, heavy 10 — 36 nonzero rows; the SOE mod zeroes the column, but this port
 * replicates vanilla 1.13c).
 */
function getCanonicalArmorSpeeds(): Map<string, number> {
  if (!cachedArmorSpeedsByCode) {
    const map = new Map<string, number>()
    const lines = RAW_ARMOR.split(/\r?\n/).filter((l) => l.trim() !== '')
    const header = lines[0]?.split('\t') ?? []
    const codeIdx = header.indexOf('code')
    const speedIdx = header.indexOf('speed')
    if (codeIdx >= 0 && speedIdx >= 0) {
      for (const line of lines.slice(1)) {
        const cells = line.split('\t')
        const code = (cells[codeIdx] ?? '').trim()
        if (!code || code === 'Expansion') continue
        const raw = (cells[speedIdx] ?? '').trim()
        const val = raw === '' ? 0 : Number(raw)
        map.set(code.toLowerCase(), Number.isFinite(val) ? val : 0)
      }
    }
    cachedArmorSpeedsByCode = map
  }
  return cachedArmorSpeedsByCode
}

/**
 * Resolves the 1.13c `Armor.txt` `speed` value for an item code (0 for non-armor codes).
 * The engine bakes this into every armor item as an implicit
 * `STAT_VELOCITYPERCENT = -speed` stat (D2MOO `Items.cpp:5365`,
 * `ITEMS_CheckItemTypeId(pItem, ITEMTYPE_ANY_ARMOR)`), so the penalty applies to walk,
 * run and town-walk alike through the shared move velocity percent.
 */
export function resolveArmorSpeed113c(code: string | undefined | null): number {
  if (!code) return 0
  const trimmed = code.trim()
  if (!trimmed) return 0
  return getCanonicalArmorSpeeds().get(trimmed.toLowerCase()) ?? 0
}

export interface EquippedItemStatLike {
  readonly statId?: number | undefined
  readonly id?: number | undefined
  readonly param?: number | undefined
  readonly value: number
}

export interface EquippedItemLike {
  readonly id?: number | undefined
  readonly code?: string | undefined
  readonly equippedSlot?: number | undefined
  readonly equipSlot?: number | undefined
  readonly bodyLoc?: number | undefined
  readonly broken?: boolean | undefined
  readonly inSocket?: boolean | undefined
  readonly stats?: readonly EquippedItemStatLike[] | undefined
  readonly runewordStats?: readonly EquippedItemStatLike[] | undefined
  // Item-specific set lists are deliberately absent: they are only active per SetItems.txt
  // `add func` gating, so callers pass the already-gated `setBonusStats` source instead
  // (`computeSetBonusStats` in `src/client/ui-model/set-bonuses.ts`, PROJECT.md rule 18).
}

export interface StatListReaderLike {
  get(statId: number, param?: number): number
  has?(statId: number, param?: number): boolean
}

/**
 * Resolves the effective Weapon Speed Modifier (`WSM`) across equipped items.
 * Prefers primary/secondary weapon arm slots (4 = right arm, 5 = left arm); if dual-wielding two
 * weapons in slots 4 and 5, averages their WSM (`trunc((wsm4 + wsm5) / 2)`).
 */
export function resolveEquippedWeaponWsm(
  equipment?: Iterable<EquippedItemLike> | null,
): number {
  if (!equipment) return 0
  let slot4Wsm: number | undefined
  let slot5Wsm: number | undefined
  let fallbackWsm: number | undefined

  for (const item of equipment) {
    if (!item || item.broken || item.inSocket) continue
    const weapon = resolveWeaponBase113c(item.code)
    if (!weapon) continue
    const slot = item.equippedSlot ?? item.equipSlot ?? item.bodyLoc ?? 0
    if (slot === 4 && slot4Wsm === undefined) {
      slot4Wsm = weapon.speed
    } else if (slot === 5 && slot5Wsm === undefined) {
      slot5Wsm = weapon.speed
    } else if (fallbackWsm === undefined) {
      fallbackWsm = weapon.speed
    }
  }

  if (slot4Wsm !== undefined && slot5Wsm !== undefined) {
    return Math.trunc((slot4Wsm + slot5Wsm) / 2)
  }
  if (slot4Wsm !== undefined) return slot4Wsm
  if (slot5Wsm !== undefined) return slot5Wsm
  return fallbackWsm ?? 0
}

function sumItemStatList(
  stats: readonly EquippedItemStatLike[] | undefined,
  targetStatId: number,
): number {
  if (!stats || stats.length === 0) return 0
  let total = 0
  for (const s of stats) {
    const id = s.statId ?? s.id
    if (id === targetStatId && Number.isFinite(s.value)) {
      total += s.value
    }
  }
  return total
}

/**
 * Resolves the total value of `statId` for a character from both `StatList` (`unitStats` / `selfStats`)
 * and equipped items (`equipment` + socketed children in `sockets`), plus the already-gated set bonus
 * stats (`setBonusStats`, from `computeSetBonusStats`; omitted → set bonuses are excluded, never summed
 * from the items' raw set lists).
 */
export function resolveCharacterStatTotal(
  statId: number,
  sources: {
    readonly unitStats?: StatListReaderLike | null | undefined
    readonly selfStats?: StatListReaderLike | null | undefined
    readonly equipment?: Iterable<EquippedItemLike> | null | undefined
    readonly sockets?: ReadonlyMap<number, readonly EquippedItemLike[]> | null | undefined
    readonly setBonusStats?: readonly EquippedItemStatLike[] | null | undefined
  },
): number {
  const unitVal = sources.unitStats ? sources.unitStats.get(statId) : 0
  const selfVal = sources.selfStats ? sources.selfStats.get(statId) : 0
  // `StatSet` writes the same wire value to both `self.stats` and `selfUnit.stats`.
  // Use `unitVal` if non-zero, otherwise `selfVal` (e.g., if `StatSet` arrived before `UnitAssign`).
  const baseStatVal = unitVal !== 0 ? unitVal : selfVal

  let equipTotal = 0
  const visitedIds = new Set<number>()

  const addFromItem = (item: EquippedItemLike, includeRuneword: boolean): void => {
    if (!item || item.broken) return
    if (item.id !== undefined) {
      if (visitedIds.has(item.id)) return
      visitedIds.add(item.id)
    }
    equipTotal += sumItemStatList(item.stats, statId)
    if (includeRuneword) {
      equipTotal += sumItemStatList(item.runewordStats, statId)
    }
  }

  if (sources.equipment) {
    for (const item of sources.equipment) {
      if (!item || item.broken || item.inSocket) continue
      addFromItem(item, true)
      if (item.id !== undefined && sources.sockets) {
        const children = sources.sockets.get(item.id)
        if (children) {
          for (const child of children) {
            addFromItem(child, false)
          }
        }
      }
    }
  }

  equipTotal += sumItemStatList(sources.setBonusStats ?? undefined, statId)

  return baseStatVal + equipTotal
}

export interface RollbackSkillTiming113c {
  readonly skillId: number
  readonly rollbackPct: number
  readonly strikes: number
  readonly frames: number
  readonly actionFrame: number
  readonly rollbackFrame: number
  readonly stepSpeed256: number
  readonly firstHitTicks: number
  readonly intervalTicks: number
  readonly finalCycleTicks: number
  readonly totalTicks: number
  readonly durationMs: number
}

/**
 * Canonical 1.13c rollback multi-strike skill table (`Skills.txt` + `D2Game.dll` `0x6FC82F10`):
 * - `#26 Strafe`: `Param3 = 50` (50% rollback), `min(10, 3 + slvl)` strikes
 * - `#30 Fend`: `Param1 = 60` (60% rollback), 2+ strikes
 * - `#106 Zeal`: 100% rollback (`rollbackFrame = 0`), `min(5, 1 + slvl)` strikes
 * - `#248 Fury`: `Param1 = 70` (70% rollback), `min(5, 1 + slvl)` strikes
 * - `#255 Dragon Talon`: 100% rollback (`rollbackFrame = 0`), `1 + floor(slvl / 6)` strikes
 */
export const ROLLBACK_SKILLS_113C: Readonly<
  Record<
    number,
    {
      readonly rollbackPct: number
      readonly computeStrikes: (skillLevel: number) => number
    }
  >
> = {
  26: {
    rollbackPct: 50,
    computeStrikes: (slvl: number) => Math.min(10, 3 + Math.max(1, Math.trunc(slvl || 1))),
  },
  30: {
    rollbackPct: 60,
    computeStrikes: (_slvl: number) => 2,
  },
  106: {
    rollbackPct: 100,
    computeStrikes: (slvl: number) => Math.min(5, 1 + Math.max(1, Math.trunc(slvl || 1))),
  },
  248: {
    rollbackPct: 70,
    computeStrikes: (slvl: number) => Math.min(5, 1 + Math.max(1, Math.trunc(slvl || 1))),
  },
  255: {
    rollbackPct: 100,
    computeStrikes: (slvl: number) => 1 + Math.floor(Math.max(1, Math.trunc(slvl || 1)) / 6),
  },
}

/**
 * Computes 1.13c rollback multi-strike timing (`D2Game.dll` `0x6FC82F10`):
 * - `rollbackFrame = floor(actionFrame * (100 - rollbackPct) / 100)`
 * - First strike hits at `actionFrame` (`firstHitTicks = ceil(actionFrame * 256 / stepSpeed256)`).
 * - Each subsequent strike winds back to `rollbackFrame` and advances to `actionFrame`
 *   (`intervalFrames = max(1, actionFrame - rollbackFrame)`, `intervalTicks = ceil(intervalFrames * 256 / stepSpeed256)`).
 * - After the final strike triggers at `actionFrame`, the animation completes from `rollbackFrame`
 *   through `frames - 1` (`finalCycleTicks = computeOneShotTicks(frames - rollbackFrame, stepSpeed256)`).
 */
export function computeRollbackSkillTiming113c(params: {
  readonly skillId: number
  readonly frames: number
  readonly actionFrame: number
  readonly stepSpeed256: number
  readonly skillLevel?: number | undefined
  readonly strikes?: number | undefined
  readonly rollbackPctOverride?: number | undefined
}): RollbackSkillTiming113c | null {
  const spec = ROLLBACK_SKILLS_113C[params.skillId]
  if (!spec && params.rollbackPctOverride === undefined) return null
  const rollbackPct = Math.max(
    0,
    Math.min(100, Math.trunc(params.rollbackPctOverride ?? spec?.rollbackPct ?? 100)),
  )
  const slvl = Math.max(1, Math.trunc(params.skillLevel ?? 1))
  const strikes = Math.max(
    1,
    Math.trunc(params.strikes ?? (spec ? spec.computeStrikes(slvl) : 2)),
  )
  const frames = Math.max(1, Math.trunc(params.frames))
  const actionFrame = Math.max(
    1,
    Math.min(frames - 1, Math.trunc(params.actionFrame || Math.floor(frames / 2))),
  )
  const stepSpeed256 = Math.max(32, Math.trunc(params.stepSpeed256 || 256))
  const rollbackFrame = Math.max(
    0,
    Math.min(actionFrame - 1, Math.floor((actionFrame * (100 - rollbackPct)) / 100)),
  )
  const firstHitTicks = computeActionFrameTicks(actionFrame, stepSpeed256)
  const intervalFrames = Math.max(1, actionFrame - rollbackFrame)
  const intervalTicks = computeActionFrameTicks(intervalFrames, stepSpeed256)
  const finalCycleFrames = Math.max(1, frames - rollbackFrame)
  const finalCycleTicks = computeOneShotTicks(finalCycleFrames, stepSpeed256)
  const totalTicks =
    strikes <= 1
      ? computeOneShotTicks(frames, stepSpeed256)
      : (strikes - 1) * intervalTicks + finalCycleTicks
  return {
    skillId: params.skillId,
    rollbackPct,
    strikes,
    frames,
    actionFrame,
    rollbackFrame,
    stepSpeed256,
    firstHitTicks,
    intervalTicks,
    finalCycleTicks,
    totalTicks,
    durationMs: totalTicks * D2_TICK_MS,
  }
}

/**
 * 1.13c Barbarian `#151 Whirlwind` hit cadence in ticks (`D2Game.dll` `SKILLS_GetWhirlwindFrame` @ `0x6FC48A20`):
 * driven strictly by on-weapon `(weaponIas - weaponWsm)`, ignoring off-weapon IAS and Fanaticism/Burst of Speed.
 */
export function computeWhirlwindCadenceTicks113c(
  weaponWsm: number,
  weaponIas: number,
  isTwoHandedNonSword = false,
): number {
  const speed = Math.trunc(weaponIas || 0) - Math.trunc(weaponWsm || 0)
  if (isTwoHandedNonSword) {
    if (speed <= -30) return 14
    if (speed <= -15) return 12
    if (speed <= -1) return 10
    if (speed <= 14) return 8
    if (speed <= 29) return 6
    return 4
  }
  if (speed <= -45) return 16
  if (speed <= -26) return 14
  if (speed <= -15) return 12
  if (speed <= -10) return 10
  if (speed <= 10) return 8
  if (speed <= 33) return 6
  return 4
}

/**
 * Resolves the primary weapon's `Weapons.txt` `speed` (`WSM`) from equipped items or weapon code
 * (preferring slot 4, then slot 5, then fallback weapon without dual-wield averaging).
 */
export function resolvePrimaryWeaponWsm113c(
  equipment?: Iterable<EquippedItemLike> | null,
  weaponCode?: string | null,
): number {
  if (weaponCode) {
    return resolveWeaponWsm(weaponCode)
  }
  if (!equipment) return 0
  let slot4Wsm: number | undefined
  let slot5Wsm: number | undefined
  let fallbackWsm: number | undefined
  for (const item of equipment) {
    if (!item || item.broken || item.inSocket) continue
    const weapon = resolveWeaponBase113c(item.code)
    if (!weapon) continue
    const slot = item.equippedSlot ?? item.equipSlot ?? item.bodyLoc ?? 0
    if (slot === 4 && slot4Wsm === undefined) slot4Wsm = weapon.speed
    else if (slot === 5 && slot5Wsm === undefined) slot5Wsm = weapon.speed
    else if (fallbackWsm === undefined) fallbackWsm = weapon.speed
  }
  return slot4Wsm ?? slot5Wsm ?? fallbackWsm ?? 0
}

/**
 * Resolves `STAT_FASTERATTACKRATE` (`93`, on-weapon IAS) strictly from the active primary weapon
 * item + its socketed children + its `runewordStats`, excluding off-weapon armor/gloves/amulet/set IAS
 * (`D2Common.dll` `0x6FDA0CE0`: `STATLIST_GetUnitStatBonus(pWeapon, STAT_ITEM_FASTERATTACKRATE, 0)`).
 */
export function resolvePrimaryWeaponIas113c(sources: {
  readonly equipment?: Iterable<EquippedItemLike> | null | undefined
  readonly sockets?: ReadonlyMap<number, readonly EquippedItemLike[]> | null | undefined
  readonly weaponIasOverride?: number | null | undefined
}): number {
  if (sources.weaponIasOverride !== undefined && sources.weaponIasOverride !== null) {
    return Math.trunc(sources.weaponIasOverride)
  }
  if (!sources.equipment) return 0
  let slot4Item: EquippedItemLike | undefined
  let slot5Item: EquippedItemLike | undefined
  let fallbackItem: EquippedItemLike | undefined
  for (const item of sources.equipment) {
    if (!item || item.broken || item.inSocket) continue
    const weapon = resolveWeaponBase113c(item.code)
    if (!weapon) continue
    const slot = item.equippedSlot ?? item.equipSlot ?? item.bodyLoc ?? 0
    if (slot === 4 && !slot4Item) slot4Item = item
    else if (slot === 5 && !slot5Item) slot5Item = item
    else if (!fallbackItem) fallbackItem = item
  }
  const primary = slot4Item ?? slot5Item ?? fallbackItem
  if (!primary) return 0
  let total =
    sumItemStatList(primary.stats, STAT_FASTERATTACKRATE) +
    sumItemStatList(primary.runewordStats, STAT_FASTERATTACKRATE)
  if (primary.id !== undefined && sources.sockets) {
    const children = sources.sockets.get(primary.id)
    if (children) {
      for (const child of children) {
        if (!child || child.broken) continue
        total += sumItemStatList(child.stats, STAT_FASTERATTACKRATE)
      }
    }
  }
  return total
}

/**
 * Computes the 1.13c shapeshift (`430` Werewolf / `431` Werebear) weapon delay factor
 * (`D2Common.dll` `0x6FDA0CE0` `ShapeshiftWeaponDelay` + `0x6FD767F0` `ITEMS_GetWeaponDelay`):
 * - Unarmed (`!hasWeapon || weaponClass === 'hth'`): `19` (`0x13`).
 * - Armed: looks up the human character's `A1` clip for `(classId, weaponClass)`, scales its
 *   `AnimData.d2` speed by `(100 + weaponIas - weaponWsm) / 100`, and returns
 *   `max(1, floor(humanA1Frames * 256 / humanStep))`.
 */
export function computeShapeshiftWeaponDelay113c(
  classIdOrToken: number | string,
  weaponClass: string,
  weaponWsm: number,
  weaponIas: number,
  hasWeapon = weaponClass.trim().toLowerCase() !== 'hth',
): number {
  const wc = weaponClass.trim().toLowerCase()
  if (!hasWeapon || !wc || wc === 'hth') {
    return 19
  }
  const humanA1 = getCharAnimClip113c(classIdOrToken, 'a1', { weaponClass: wc })
  const humanStep = Math.floor(
    (humanA1.speed * (100 + Math.trunc(weaponIas || 0) - Math.trunc(weaponWsm || 0))) / 100,
  )
  return Math.max(1, Math.floor((humanA1.frames * 256) / Math.max(1, humanStep)))
}

export interface CharacterAnimSpeedParams {
  readonly clipKey: CharAnimClipKey
  readonly frames: number
  readonly baseSpeed: number
  readonly loop: boolean
  readonly effRate: number
  readonly stepSpeed256: number
  readonly durationMs: number
  /** Locomotion clips only (`wl`/`tw`/`rn`): the move velocity percent driving `stepSpeed256`. */
  readonly velocityPercent?: number | undefined
  /** Rollback multi-strike timing metadata when `skillId` is a rollback skill (`26, 30, 106, 248, 255`). */
  readonly rollbackTiming?: RollbackSkillTiming113c | undefined
  readonly fcr: number
  readonly itemIas: number
  readonly skillIas: number
  readonly weaponWsm: number
  readonly fhr: number
}

/**
 * Effective animation rate modifier (`[-85, 75]`) for a given player mode / clip key in 1.13c:
 * - `sc` (mode 10) uses `EFCR` (`fcr`).
 * - `sq` (mode 18): per `D2Common.dll` `UNITS_IsCastAnimMode` (`0x6FD80B80`) and
 *   `UNITS_UpdateAnimRateAndVelocity` (`0x6FD834CD`), if the skill's `seqTrans` is `'SC'` or `'SQ'`
 *   (`#41 Inferno`, `#49 Lightning`, `#53 Chain Lightning`, `#229 Molten Boulder`,
 *   `#230 Arctic Blast`, `#234 Fissure`, `#244 Volcano`), it uses `EFCR`; otherwise (`seqTrans === 'A1'`),
 *   it uses `EIAS` with the `-30` sequence penalty (`0x6FD834CD: sub esi, 0x1E`), plus `#133 Double Swing`'s
 *   intrinsic `+50%` skill EIAS (`D2Client.dll` `0x6FB76290` `SKILLS_CltSt27_DoubleSwing`).
 * - `a1`, `a2`, `th`, `kk`, `s1`, `s2` (Assassin trap-laying `#261, #262, #271, #272, #276`),
 *   `s3`, `s4` use `EIAS` (`itemIas + skillIas - weaponWsm`).
 * - `gh` (mode 4) and `bl` (mode 9) use `EFHR` / `EFBR` (`fhr` / `fbr`).
 */
export function computeEffectiveAnimRate113c(
  modeOrClipKey: number | string,
  stats: {
    readonly fcr?: number | undefined
    readonly itemIas?: number | undefined
    readonly ias?: number | undefined
    readonly skillIas?: number | undefined
    readonly weaponWsm?: number | undefined
    readonly wsm?: number | undefined
    readonly fhr?: number | undefined
    readonly fbr?: number | undefined
    readonly skillId?: number | undefined
    readonly seqTrans?: string | undefined
  } = {},
): number {
  const isSequenceMode =
    modeOrClipKey === 18 ||
    (typeof modeOrClipKey === 'string' && modeOrClipKey.trim().toLowerCase() === 'sq')
  if (isSequenceMode) {
    const seqTrans = (
      stats.seqTrans ??
      (stats.skillId !== undefined ? getSkillAnimModes(stats.skillId).seqTrans : 'A1')
    )
      .trim()
      .toUpperCase()
    if (seqTrans === 'SC' || seqTrans === 'SQ') {
      return computeEffectiveFcr(stats.fcr ?? 0)
    }
    const doubleSwingBonus = stats.skillId === 133 ? 50 : 0
    return computeEffectiveIas({
      itemIas: stats.itemIas ?? stats.ias ?? 0,
      skillIas: (stats.skillIas ?? 0) + doubleSwingBonus - 30,
      weaponWsm: stats.weaponWsm ?? stats.wsm ?? 0,
    })
  }
  const clipKey: CharAnimClipKey =
    typeof modeOrClipKey === 'number'
      ? (PLAYER_MODE_NUM_TO_CLIP[Math.trunc(modeOrClipKey)] ?? 'nu')
      : ((modeOrClipKey.trim().toLowerCase() as CharAnimClipKey) || 'nu')
  if (clipKey === 'sc') {
    return computeEffectiveFcr(stats.fcr ?? 0)
  }
  if (
    clipKey === 'a1' ||
    clipKey === 'a2' ||
    clipKey === 'th' ||
    clipKey === 'kk' ||
    clipKey === 's1' ||
    clipKey === 's2' ||
    clipKey === 's3' ||
    clipKey === 's4'
  ) {
    return computeEffectiveIas({
      itemIas: stats.itemIas ?? stats.ias ?? 0,
      skillIas: stats.skillIas ?? 0,
      weaponWsm: stats.weaponWsm ?? stats.wsm ?? 0,
    })
  }
  if (clipKey === 'gh') {
    return computeEffectiveFhr(stats.fhr ?? 0)
  }
  if (clipKey === 'bl') {
    return computeEffectiveFhr(stats.fbr ?? stats.fhr ?? 0)
  }
  return 0
}

/**
 * Resolves the effective weapon animation class (`wclass`, e.g. `'hth'`, `'1hs'`, `'1ht'`, `'2hs'`,
 * `'2ht'`, `'bow'`, `'xbw'`, `'stf'`, `'ht1'`, `'ht2'`, `'1ss'`, `'1st'`, `'1js'`, `'1jt'`)
 * from equipped items or weapon code (`D2Common.dll` `0x6FD849B0` `ITEMS_GetWeaponClassCode`).
 */
export function resolveEquippedWeaponClass(
  equipment?: Iterable<EquippedItemLike> | null,
  weaponCode?: string | null,
): string {
  if (weaponCode) {
    const base = resolveWeaponBase113c(weaponCode)
    if (base) {
      const wc = base.twoHanded ? (base.twoHandedWClass || base.wclass) : base.wclass
      if (wc) return wc.toLowerCase()
    }
  }
  if (equipment) {
    let slot4Weapon: WeaponBase | undefined
    let slot5Weapon: WeaponBase | undefined
    let fallbackWeapon: WeaponBase | undefined
    let hasNonWeaponHandItem = false
    for (const item of equipment) {
      if (!item || item.broken || item.inSocket) continue
      const slot = item.equippedSlot ?? item.equipSlot ?? item.bodyLoc ?? 0
      const w = resolveWeaponBase113c(item.code)
      if (!w) {
        if (slot === 4 || slot === 5) {
          hasNonWeaponHandItem = true
        }
        continue
      }
      if (slot === 4 && !slot4Weapon) slot4Weapon = w
      else if (slot === 5 && !slot5Weapon) slot5Weapon = w
      else if (!fallbackWeapon) fallbackWeapon = w
    }
    if (slot4Weapon && slot5Weapon) {
      const wc1 = (slot4Weapon.wclass || '1hs').toLowerCase()
      const wc2 = (slot5Weapon.wclass || '1hs').toLowerCase()
      if (wc1 === 'ht1' && wc2 === 'ht1') return 'ht2'
      if (wc1 === '1hs' && wc2 === '1hs') return '1ss'
      if (wc1 === '1ht' && wc2 === '1ht') return '1st'
      if (wc1 === '1hs' && wc2 === '1ht') return '1js'
      if (wc1 === '1ht' && wc2 === '1hs') return '1jt'
      return wc1
    }
    const primary = slot4Weapon ?? slot5Weapon ?? fallbackWeapon
    if (primary) {
      const useOneHandedStance = Boolean(primary.oneOrTwoHanded && hasNonWeaponHandItem)
      const activeWc =
        primary.twoHanded && !useOneHandedStance
          ? (primary.twoHandedWClass || primary.wclass)
          : primary.wclass
      if (activeWc) return activeWc.toLowerCase()
    }
  }
  return 'hth'
}

/**
 * Resolves full 1.13c animation speed parameters (`frames`, `baseSpeed`, `effRate`, `stepSpeed256`,
 * `durationMs`) for a character class and animation mode given their stats and equipped items.
 */
export function resolveCharacterAnimSpeedParams(
  classIdOrToken: number | string,
  modeOrClipKey: number | string,
  sources: {
    readonly unitStats?: StatListReaderLike | null | undefined
    readonly selfStats?: StatListReaderLike | null | undefined
    readonly equipment?: Iterable<EquippedItemLike> | null | undefined
    readonly sockets?: ReadonlyMap<number, readonly EquippedItemLike[]> | null | undefined
    readonly setBonusStats?: readonly EquippedItemStatLike[] | null | undefined
    readonly weaponCode?: string | null | undefined
    readonly weaponClass?: string | null | undefined
    readonly weaponWsmOverride?: number | null | undefined
    readonly weaponIasOverride?: number | null | undefined
    readonly skillId?: number | null | undefined
    readonly skillLevel?: number | null | undefined
    readonly strikes?: number | null | undefined
    /**
     * Complete `STAT_VELOCITYPERCENT` (67) total as tracked for the unit by the caller
     * (e.g. the server-reported move velocity percent). Overrides the stat-list lookup for
     * locomotion clips; when neither is present the base 100 (+50 run) is synthesized.
     */
    readonly stat67VelocityPercent?: number | null | undefined
    /**
     * Skill velocity bonus (`STAT_VELOCITYPERCENT = 67`, e.g. Barbarian `#148 Increased Speed`
     * `dm12(7, 50)`) added directly to `stat67` when `stat67` is synthesized.
     */
    readonly skillVelocityPercent?: number | null | undefined
    /**
     * Shapeshift monster class id (`D2COMMON_11013_ConvertMode`: Werewolf state 139 → 430,
     * Werebear state 140 → 431, Vampire state 176 → 135, Bone Fetish state 177 → 212).
     */
    readonly morphMonsterClassId?: number | null | undefined
  } = {},
): CharacterAnimSpeedParams {
  const equipmentList = sources.equipment ? Array.from(sources.equipment) : undefined
  const normalizedSources = {
    ...sources,
    equipment: equipmentList,
  }
  const resolvedWClass =
    sources.weaponClass && sources.weaponClass.trim() !== ''
      ? sources.weaponClass.trim().toLowerCase()
      : resolveEquippedWeaponClass(equipmentList, sources.weaponCode)

  const isSequenceMode =
    modeOrClipKey === 18 ||
    (typeof modeOrClipKey === 'string' && modeOrClipKey.trim().toLowerCase() === 'sq')

  const fcr = resolveCharacterStatTotal(STAT_FASTERCASTRATE, normalizedSources)
  const itemIas = resolveCharacterStatTotal(STAT_FASTERATTACKRATE, normalizedSources)
  const skillIas = resolveCharacterStatTotal(STAT_SKILL_IAS, normalizedSources)
  const fhr = resolveCharacterStatTotal(STAT_FASTERHITRECOVERY, normalizedSources)
  const fbr = resolveCharacterStatTotal(STAT_FASTERBLOCKRATE, normalizedSources)
  const weaponWsm =
    sources.weaponWsmOverride !== undefined && sources.weaponWsmOverride !== null
      ? sources.weaponWsmOverride
      : sources.weaponCode
        ? resolveWeaponWsm(sources.weaponCode)
        : resolveEquippedWeaponWsm(equipmentList)

  if (isSequenceMode) {
    const animModes =
      sources.skillId !== undefined && sources.skillId !== null
        ? getSkillAnimModes(sources.skillId)
        : undefined
    const seq0 =
      sources.skillId !== undefined && sources.skillId !== null
        ? resolveSkillSequenceFrame(sources.skillId, resolvedWClass, 0, 256)
        : null
    const subClipKey: CharAnimClipKey = (seq0?.clipKey ??
      (animModes?.seqTrans && animModes.seqTrans !== 'SQ'
        ? animModes.seqTrans.toLowerCase()
        : 'a1')) as CharAnimClipKey
    const subClip = getCharAnimClip113c(classIdOrToken, subClipKey, {
      weaponClass: resolvedWClass,
      morphMonsterClassId: sources.morphMonsterClassId,
    })
    const effRate = computeEffectiveAnimRate113c('sq', {
      fcr,
      itemIas,
      skillIas,
      weaponWsm,
      fhr,
      fbr,
      skillId: sources.skillId ?? undefined,
      seqTrans: animModes?.seqTrans,
    })
    const baseSpeed = subClip.speed
    const stepSpeed256 = computeStepSpeed256(baseSpeed, effRate)
    const frames = seq0 ? seq0.totalSequenceFrames : subClip.frames
    const durationMs = seq0
      ? computeSequenceDurationMs(frames, stepSpeed256)
      : computeOneShotDurationMs(frames, stepSpeed256)
    return {
      clipKey: subClipKey,
      frames,
      baseSpeed,
      loop: false,
      effRate,
      stepSpeed256,
      durationMs,
      fcr,
      itemIas,
      skillIas,
      weaponWsm,
      fhr,
    }
  }

  const clip = getCharAnimClip113c(classIdOrToken, modeOrClipKey, {
    weaponClass: resolvedWClass,
    morphMonsterClassId: sources.morphMonsterClassId,
  })
  const clipKey: CharAnimClipKey =
    typeof modeOrClipKey === 'number'
      ? (PLAYER_MODE_NUM_TO_CLIP[Math.trunc(modeOrClipKey)] ?? 'nu')
      : ((modeOrClipKey.trim().toLowerCase() as CharAnimClipKey) || 'nu')

  let effRate = computeEffectiveAnimRate113c(clipKey, {
    fcr,
    itemIas,
    skillIas,
    weaponWsm,
    fhr,
    fbr,
  })

  // Engine hardcode (D2Common UNITS_GetBaseAnimSpeed) replaces AnimData speeds
  // for player locomotion — see resolvePlayerLocomotionBaseSpeed256 (issue #852).
  let baseSpeed = resolvePlayerLocomotionBaseSpeed256(clipKey, clip.speed)

  // Shapeshift (`430` Werewolf / `431` Werebear) compound weapon-delay formula
  // (`D2Common.dll` `0x6FDA0CE0` `ShapeshiftWeaponDelay` + `0x6FD767F0` `ITEMS_GetWeaponDelay`):
  // For morph attack modes (`a1`, `a2`, `s3`, `s4`), `baseSpeed` is replaced by
  // `floor(morphFrames * 256 / weaponDelay)` and scaled by `EIAS(itemIas, skillIas, primaryWeaponWsm)`.
  if (
    (sources.morphMonsterClassId === 430 || sources.morphMonsterClassId === 431) &&
    (clipKey === 'a1' || clipKey === 'a2' || clipKey === 's3' || clipKey === 's4')
  ) {
    const primaryWsm =
      sources.weaponWsmOverride !== undefined && sources.weaponWsmOverride !== null
        ? sources.weaponWsmOverride
        : resolvePrimaryWeaponWsm113c(equipmentList, sources.weaponCode)
    const weaponIas = resolvePrimaryWeaponIas113c({
      equipment: equipmentList,
      sockets: sources.sockets,
      weaponIasOverride: sources.weaponIasOverride,
    })
    const hasEquippedWeapon =
      resolvedWClass !== 'hth' ||
      Boolean(sources.weaponCode) ||
      Boolean(
        equipmentList?.some(
          (it) => it && !it.broken && !it.inSocket && Boolean(resolveWeaponBase113c(it.code)),
        ),
      )
    const weaponDelay = computeShapeshiftWeaponDelay113c(
      classIdOrToken,
      resolvedWClass,
      primaryWsm,
      weaponIas,
      hasEquippedWeapon,
    )
    baseSpeed = Math.max(1, Math.floor((clip.frames * 256) / weaponDelay))
    effRate = computeEffectiveIas({
      itemIas,
      skillIas,
      weaponWsm: primaryWsm,
    })
  }

  // Locomotion clips (wl/tw/rn) scale by the move velocity percent, not by the one-shot
  // effRate formulas: stepSpeed = trunc(base × max(25, EFRW + stat67) / 100) (issue #869).
  if (clipKey === 'wl' || clipKey === 'tw' || clipKey === 'rn') {
    const morphRec =
      sources.morphMonsterClassId !== undefined && sources.morphMonsterClassId !== null
        ? getMonsterPathRecord(sources.morphMonsterClassId)
        : null
    const locomotionBaseSpeed = morphRec
      ? clipKey === 'rn'
        ? morphRec.runAnimSpeed
        : morphRec.walkAnimSpeed
      : baseSpeed
    const itemFrw = resolveCharacterStatTotal(STAT_FASTERMOVEVELOCITY, normalizedSources)
    let armorSpeedPenalty = 0
    if (equipmentList) {
      for (const item of equipmentList) {
        if (!item || item.broken || item.inSocket) continue
        armorSpeedPenalty += resolveArmorSpeed113c(item.code)
      }
    }
    const explicitStat67 = sources.stat67VelocityPercent
    const stat67 =
      explicitStat67 !== undefined && explicitStat67 !== null && Math.trunc(explicitStat67) !== 0
        ? Math.trunc(explicitStat67)
        : normalizedSources.unitStats && normalizedSources.unitStats.get(STAT_VELOCITYPERCENT) !== 0
          ? normalizedSources.unitStats.get(STAT_VELOCITYPERCENT)
          : normalizedSources.selfStats && normalizedSources.selfStats.get(STAT_VELOCITYPERCENT) !== 0
            ? normalizedSources.selfStats.get(STAT_VELOCITYPERCENT)
            : undefined
    const velocityPercent = computeMoveVelocityPercent113c({
      stat67,
      itemFrw,
      armorSpeedPenalty,
      skillVelocityPercent: sources.skillVelocityPercent ?? undefined,
      running: clipKey === 'rn',
    })
    const stepSpeed256 = computeLocomotionStepSpeed256(locomotionBaseSpeed, velocityPercent)
    return {
      clipKey,
      frames: clip.frames,
      baseSpeed: locomotionBaseSpeed,
      loop: clip.loop,
      effRate: 0,
      stepSpeed256,
      durationMs: computeOneShotDurationMs(clip.frames, stepSpeed256),
      velocityPercent,
      fcr,
      itemIas,
      skillIas,
      weaponWsm,
      fhr,
    }
  }

  const stepSpeed256 = computeStepSpeed256(baseSpeed, effRate)
  const rollbackTiming =
    sources.skillId !== undefined &&
    sources.skillId !== null &&
    sources.skillId in ROLLBACK_SKILLS_113C
      ? computeRollbackSkillTiming113c({
          skillId: sources.skillId,
          frames: clip.frames,
          actionFrame: clip.actionFrame || Math.max(1, Math.floor(clip.frames / 2)),
          stepSpeed256,
          skillLevel: sources.skillLevel ?? undefined,
          strikes: sources.strikes ?? undefined,
        })
      : null
  const durationMs = rollbackTiming
    ? rollbackTiming.durationMs
    : computeOneShotDurationMs(clip.frames, stepSpeed256)

  return {
    clipKey,
    frames: clip.frames,
    baseSpeed,
    loop: clip.loop,
    effRate,
    stepSpeed256,
    durationMs,
    ...(rollbackTiming ? { rollbackTiming } : {}),
    fcr,
    itemIas,
    skillIas,
    weaponWsm,
    fhr,
  }
}

/**
 * Computes the 0-based animation frame index at `nowMs` according to 1.13c 25Hz (40ms) fixed-point
 * progression (`stepSpeed256` where `256` = 1 frame per 40ms tick):
 * - For non-looping clips (`loop === false`, e.g. `sc`, `a1`, `a2`, `gh`, `dt`, `dd`), starts at
 *   frame `0` at `startedAtMs` and clamps at `frameCount - 1` (never wraps via `% frameCount`).
 * - When `skillId` is a rollback multi-strike skill (`#26 Strafe`, `#30 Fend`, `#106 Zeal`,
 *   `#248 Fury`, `#255 Dragon Talon`), cycles `rollbackFrame .. actionFrame` for each strike
 *   before completing `actionFrame .. frameCount - 1`.
 * - For looping clips (`loop === true`, e.g. `nu`, `wl`, `rn`, `tn`, `tw`), wraps cleanly via `% frameCount`.
 */
export function computeAnimFrameIndex(params: {
  readonly frameCount: number
  readonly stepSpeed256: number
  readonly loop: boolean
  readonly nowMs: number
  readonly startedAtMs?: number | undefined
  /** Floor applied to `stepSpeed256` (default 32). Locomotion clips pass 0: their floor is the velocity-percent 25 (`trunc(101×25/100)=25`), not 32. */
  readonly minStepSpeed256?: number | undefined
  readonly skillId?: number | undefined
  readonly skillLevel?: number | undefined
  readonly strikes?: number | undefined
  readonly actionFrame?: number | undefined
}): number {
  const frameCount = Math.max(1, Math.trunc(params.frameCount || 1))
  if (frameCount <= 1) return 0
  const minStepSpeed256 = params.minStepSpeed256 ?? 32
  const stepSpeed256 = Math.max(minStepSpeed256, Math.trunc(params.stepSpeed256 || 256))
  const elapsedMs =
    params.startedAtMs !== undefined && Number.isFinite(params.startedAtMs)
      ? Math.max(0, params.nowMs - params.startedAtMs)
      : Math.max(0, params.nowMs)
  if (
    !params.loop &&
    params.skillId !== undefined &&
    params.skillId in ROLLBACK_SKILLS_113C
  ) {
    const rb = computeRollbackSkillTiming113c({
      skillId: params.skillId,
      frames: frameCount,
      actionFrame: params.actionFrame ?? Math.max(1, Math.floor(frameCount / 2)),
      stepSpeed256,
      skillLevel: params.skillLevel,
      strikes: params.strikes,
    })
    if (rb && rb.strikes > 1) {
      const elapsedTicks = Math.floor(elapsedMs / D2_TICK_MS)
      if (elapsedTicks < rb.firstHitTicks) {
        const f = Math.floor((elapsedTicks * stepSpeed256) / 256)
        return Math.max(0, Math.min(rb.actionFrame, f))
      }
      const afterFirstTicks = elapsedTicks - rb.firstHitTicks
      const middleCycles = rb.strikes - 2
      const middleTotalTicks = middleCycles * rb.intervalTicks
      if (middleCycles > 0 && afterFirstTicks < middleTotalTicks) {
        const tickInCycle = afterFirstTicks % rb.intervalTicks
        const f = rb.rollbackFrame + Math.floor((tickInCycle * stepSpeed256) / 256)
        return Math.max(rb.rollbackFrame, Math.min(rb.actionFrame, f))
      }
      const finalTicks = afterFirstTicks - middleTotalTicks
      const f = rb.rollbackFrame + Math.floor((finalTicks * stepSpeed256) / 256)
      return Math.max(rb.rollbackFrame, Math.min(frameCount - 1, f))
    }
  }
  const rawFrame = Math.floor(((elapsedMs / D2_TICK_MS) * stepSpeed256) / 256)
  if (!params.loop) {
    return Math.max(0, Math.min(frameCount - 1, rawFrame))
  }
  return ((rawFrame % frameCount) + frameCount) % frameCount
}
