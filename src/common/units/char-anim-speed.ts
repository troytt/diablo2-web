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
 * - Get Hit recovery (`GH`, player mode 4 / monster mode 3, `UNITS_UpdateAnimRateAndVelocity`
 *   `0x6FD83298..0x6FD832C7`): rate `50 + diminished(fhr)` (no clamp) — `effRate = EFHR - 50`.
 * - Block (`BL`, player mode 9 / monster mode 6, `0x6FD831FE..0x6FD83283`): rate `50 + diminished(fbr)`,
 *   `100 + diminished(fbr)` while state 101 `holyshield` is set — `effRate = EFBR - 50` (or `EFBR`).
 * - Knockback (player mode 19 / monster mode 13, `0x6FD832C9..0x6FD83318`): step speed is
 *   `UNITS_GetBaseAnimSpeed` (`0x6FD7FB10`, 213 for players), no rate stat.
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

import { ANIMDATA_PLAYER_CLIPS_113C } from './char-anim-clips-113c.generated.ts'
import { cltStAttackRate113c } from '../skills/clt-st-attackrate-113c.ts'
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

/** Player COF mode code per clip key (`<token><mode><wclass>` in AnimData.D2). */
const CLIP_KEY_MODE_CODE_113C: Readonly<Record<CharAnimClipKey, string>> = {
  wl: 'WL', nu: 'NU', rn: 'RN', a1: 'A1', a2: 'A2', bl: 'BL', sc: 'SC', th: 'TH', kk: 'KK',
  s1: 'S1', s2: 'S2', s3: 'S3', s4: 'S4', gh: 'GH', dt: 'DT', dd: 'DD', tn: 'TN', tw: 'TW',
}
const PLAYER_TOKENS_113C = ['AM', 'SO', 'NE', 'PA', 'BA', 'DZ', 'AI'] as const
const WCLASS_CODES_113C = ['HTH', 'BOW', '1HS', '1HT', 'STF', '2HS', '2HT', 'XBW', '1JS', '1JT', '1SS', '1ST', 'HT1', 'HT2'] as const
const LOOPING_CLIPS_113C: ReadonlySet<CharAnimClipKey> = new Set<CharAnimClipKey>(['wl', 'nu', 'rn', 'tn', 'tw'])

function clipFromAnimData113c(key: CharAnimClipKey, name: string): CharAnimClip113c | undefined {
  const t = ANIMDATA_PLAYER_CLIPS_113C[name]
  if (!t) return undefined
  return makeClip113c(t[0], t[1], LOOPING_CLIPS_113C.has(key), t[2].map(([f, c]) => ({ f, c })))
}

/**
 * Canonical 1.13c `AnimData.d2` clip metadata for all 7 playable classes (`0..6`:
 * `am, so, ne, pa, ba, dz, ai`): the bare-handed (`HTH`) record of every mode, built from the
 * generated AnimData.D2 extract (`char-anim-clips-113c.generated.ts`, D2Common `#10385` lookup).
 */
export const CHAR_ANIM_CLIPS_113C: Readonly<
  Record<number, Readonly<Record<CharAnimClipKey, CharAnimClip113c>>>
> = (() => {
  const out: Record<number, Record<CharAnimClipKey, CharAnimClip113c>> = {}
  PLAYER_TOKENS_113C.forEach((token, classId) => {
    const clips = {} as Record<CharAnimClipKey, CharAnimClip113c>
    for (const key of Object.keys(CLIP_KEY_MODE_CODE_113C) as CharAnimClipKey[]) {
      const code = CLIP_KEY_MODE_CODE_113C[key]
      let clip = clipFromAnimData113c(key, `${token}${code}HTH`)
      for (const w of WCLASS_CODES_113C) {
        if (clip) break
        clip = clipFromAnimData113c(key, `${token}${code}${w}`)
      }
      clips[key] = clip ?? makeClip113c(1, 256, false, [])
    }
    out[classId] = clips
  })
  return out
})()

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
 * Per-weapon-class (`wclass`) 1.13c `AnimData.d2` records by player class (`0..6`) and mode, for every
 * `<token><mode><wclass>` COF that exists in AnimData.D2 (generated extract, no hand edits).
 */
export const CHAR_WCLASS_ANIM_CLIPS_113C: Readonly<
  Record<number, Readonly<Partial<Record<CharAnimClipKey, Readonly<Record<string, CharAnimClip113c>>>>>>
> = (() => {
  const out: Record<number, Partial<Record<CharAnimClipKey, Record<string, CharAnimClip113c>>>> = {}
  PLAYER_TOKENS_113C.forEach((token, classId) => {
    const byKey: Partial<Record<CharAnimClipKey, Record<string, CharAnimClip113c>>> = {}
    for (const key of Object.keys(CLIP_KEY_MODE_CODE_113C) as CharAnimClipKey[]) {
      const byW: Record<string, CharAnimClip113c> = {}
      for (const w of WCLASS_CODES_113C) {
        const clip = clipFromAnimData113c(key, `${token}${CLIP_KEY_MODE_CODE_113C[key]}${w}`)
        if (clip) byW[w.toLowerCase()] = clip
      }
      if (Object.keys(byW).length > 0) byKey[key] = byW
    }
    out[classId] = byKey
  })
  return out
})()

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
 * 1.13c diminishing returns formula (`D2Common.dll` `0x6FD823E0`):
 * `trunc(120 * rate / (120 + rate))` for any non-zero `rate` (positive or negative).
 */
export function computeDiminishingRate113c(rate: number): number {
  if (!Number.isFinite(rate)) return 0
  const v = Math.trunc(rate)
  if (v === 0) return 0
  if (120 + v <= 0) return -100
  return Math.trunc((120 * v) / (120 + v))
}

/**
 * Unclamped 1.13c `D2Common.dll` `0x6FD823E0` diminishing-rate helper (table `0x6FDE4608`,
 * `base = 120` for indices `0..3`, `150` for index `4` FRW):
 * `v == 0 ? 0 : trunc(imul(base, v) / ((base + v) | 0))` (divides by zero at `v == -base`).
 */
export function computeRawDiminishingRate113c(rate: number, base = 120): number {
  const v = rate | 0
  const b = base | 0
  if (v === 0) return 0
  const den = (b + v) | 0
  if (den === 0) return 0
  return Math.trunc(Math.imul(b, v) / den) | 0
}

/**
 * Effective Faster Cast Rate (`EFCR = min(75, diminished(fcr))`, `D2Common.dll` `0x6FD8319E`:
 * cast rate `100 + dFCR` is clamped only at `<= 175`).
 */
export function computeEffectiveFcr(fcr: number): number {
  return Math.min(75, computeDiminishingRate113c(fcr))
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
 * Effective Faster Hit Recovery (`EFHR = diminished(fhr)`, base 120 at `0x6FDE4608` row 1).
 * `UNITS_UpdateAnimRateAndVelocity` (`0x6FD832AB..0x6FD832B6`) adds it to 50 with no clamp.
 */
export function computeEffectiveFhr(fhr: number): number {
  return computeDiminishingRate113c(fhr)
}

/**
 * Effective Faster Block Rate (`EFBR = diminished(fbr)`, base 120 at `0x6FDE4608` row 3).
 * Added to 50 (100 with state 101 `holyshield`) at `0x6FD83215..0x6FD8325A`, no clamp.
 */
export function computeEffectiveFbr(fbr: number): number {
  return computeDiminishingRate113c(fbr)
}

/** GetHit rate base (`0x6FD832B6: add ecx, 0x32`), player mode 4 / monster mode 3. */
export const GETHIT_ANIM_RATE_BASE_113C = 50
/** Block rate base (`0x6FD83220: mov ebx, 0x32`), player mode 9 / monster mode 6. */
export const BLOCK_ANIM_RATE_BASE_113C = 50
/** Block rate base while state 101 `holyshield` is set (`0x6FD83251: mov ebx, 0x64`). */
export const BLOCK_ANIM_RATE_BASE_HOLY_SHIELD_113C = 100
/** `States.txt` row 101 `holyshield`. */
export const STATE_HOLYSHIELD = 101

/**
 * `effRate` (rate − 100, consumed by {@link computeStepSpeed256}) for GetHit:
 * `rate = 50 + EFHR` (`0x6FD83298..0x6FD832C7`).
 */
export function computeGetHitEffRate113c(fhr: number): number {
  return GETHIT_ANIM_RATE_BASE_113C + computeEffectiveFhr(fhr) - 100
}

/**
 * `effRate` (rate − 100) for Block: `rate = 50 + EFBR`, or `100 + EFBR` with state 101
 * `holyshield` (`0x6FD831FE..0x6FD83283`).
 */
export function computeBlockEffRate113c(fbr: number, holyShield = false): number {
  const base = holyShield ? BLOCK_ANIM_RATE_BASE_HOLY_SHIELD_113C : BLOCK_ANIM_RATE_BASE_113C
  return base + computeEffectiveFbr(fbr) - 100
}

/**
 * Effective 8.8 fixed-point animation step speed (`D2Common.dll` `0x6FD83526`):
 * `stepSpeed256 = max(1, floor(baseSpeed * (100 + effRate) / 100))` (no 32 floor).
 */
export function computeStepSpeed256(baseSpeed: number, effRate = 0): number {
  const safeBase = Number.isFinite(baseSpeed) && baseSpeed > 0 ? baseSpeed : 256
  const safeRate = Number.isFinite(effRate) ? effRate : 0
  return Math.max(1, Math.floor((safeBase * (100 + safeRate)) / 100))
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
  const safeSpeed = Math.max(1, Math.trunc(Number.isFinite(stepSpeed256) ? stepSpeed256 : 256))
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
  const safeSpeed = Math.max(1, Math.trunc(Number.isFinite(stepSpeed256) ? stepSpeed256 : 256))
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

/**
 * 1.13c `D2Common.dll` weapon-class index table `0x6FDEF028` (`{code, index}` pairs read by `0x6FD72430`
 * from `ItemsTxt+0xC0`): `hth` 0 (no weapon), `bow` 1, `1hs` 2, `1ht` 3, `stf` 4, `2hs` 5, `2ht` 6, `xbw` 7,
 * `ht1` 12.
 */
const WCLASS_INDEX_113C: Readonly<Record<string, number>> = {
  HTH: 0, BOW: 1, '1HS': 2, '1HT': 3, STF: 4, '2HS': 5, '2HT': 6, XBW: 7, HT1: 12,
}

/**
 * 1.13c `D2Common.dll` animation starting-frame table `0x6FDE4480` (dwords indexed `wclassIdx * 7 + class`):
 * only Amazon (class 0) and Sorceress (class 1) have non-zero entries, `1` for `hth` and `2` for
 * `1hs`/`1ht`/`stf`/`2hs`/`2ht`; every other cell is 0.
 */
function animStartFrameTable113c(classId: number, wclassIdx: number): number {
  if (classId !== 0 && classId !== 1) return 0
  if (wclassIdx === 0) return 1
  return wclassIdx >= 2 && wclassIdx <= 6 ? 2 : 0
}

/**
 * 1.13c `D2Common.dll` `0x6FD82220` (`UNITS_GetAnimStartFrame`, called by the mode-start init `0x6FD835F0`
 * which stores `dwFrame = start << 8` at `0x6FD8363C`, and by the frame-wrap path `0x6FD8254C`). After the
 * transform remap `0x6FDA01E0` only player-type units (`type == 0`) can start late:
 * `PlayerMode - 7` through the byte table `0x6FD8231C` = `{0, 0, 2, 2, 2, 2, 2, 2, 1, 1}` selects
 * - A1 / A2 (7 / 8): `table[wclassIdx(weapon) * 7 + class]` (weapon from `0x6FD81B90(unit, 1)`, `hth`
 *   when none);
 * - S3 / S4 (15 / 16): the same lookup only for dual-wield units (`0x6FD80530`: player Barbarian /
 *   Assassin, monsters 417..418), whose table cells are all 0;
 * - every other mode: 0.
 * Oracle: Amazon (and the Amazon-transformed Valkyrie, state 93) A1 with a spear starts at frame 2
 * (`p52-amazon-defense` F1200 -> action F1206 -> NU F1211; `p52-amazon-valkyrie` F851 -> F860 -> F866).
 */
export function playerAnimStartFrame113c(classId: number, playerMode: number, wclass: string): number {
  if (playerMode !== 7 && playerMode !== 8) return 0
  // `0x6FD724A2`: a weapon class missing from the table returns index 0.
  const idx = WCLASS_INDEX_113C[wclass.trim().toUpperCase()] ?? 0
  return animStartFrameTable113c(classId, idx)
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

let cachedArmorBlocksByCode: Map<string, number> | null = null

/**
 * Canonical 1.13c `Armor.txt` `block` column by item code (`D2Common.dll` `0x6FD6FF40`
 * `ArmorTxt + 0x134`, baked into shield items as base `STAT_TOBLOCK` (`statId = 20`) on creation).
 */
function getCanonicalArmorBlocks(): Map<string, number> {
  if (!cachedArmorBlocksByCode) {
    const map = new Map<string, number>()
    const lines = RAW_ARMOR.split(/\r?\n/).filter((l) => l.trim() !== '')
    const header = lines[0]?.split('\t') ?? []
    const codeIdx = header.indexOf('code')
    const blockIdx = header.indexOf('block')
    if (codeIdx >= 0 && blockIdx >= 0) {
      for (const line of lines.slice(1)) {
        const cells = line.split('\t')
        const code = (cells[codeIdx] ?? '').trim()
        if (!code || code === 'Expansion') continue
        const raw = (cells[blockIdx] ?? '').trim()
        const val = raw === '' ? 0 : Number(raw)
        map.set(code.toLowerCase(), Number.isFinite(val) ? val : 0)
      }
    }
    cachedArmorBlocksByCode = map
  }
  return cachedArmorBlocksByCode
}

/**
 * Resolves the 1.13c `Armor.txt` `block` value for an item code (0 for non-shield/non-armor codes).
 */
export function resolveArmorBlock113c(code: string | undefined | null): number {
  if (!code) return 0
  const trimmed = code.trim()
  if (!trimmed) return 0
  return getCanonicalArmorBlocks().get(trimmed.toLowerCase()) ?? 0
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
  const stepSpeed256 = Math.max(1, Math.trunc(params.stepSpeed256 || 256))
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
 * Effective animation rate modifier `effRate` (= anim rate percent − 100, consumed by
 * {@link computeStepSpeed256}) for a given player mode / clip key in 1.13c:
 * - `sc` (mode 10) uses `EFCR` (`fcr`).
 * - `sq` (mode 18): per `D2Common.dll` `UNITS_IsCastAnimMode` (`0x6FD80B80`) and
 *   `UNITS_UpdateAnimRateAndVelocity` (`0x6FD834CD`), if the skill's `seqTrans` is `'SC'` or `'SQ'`
 *   (`#41 Inferno`, `#49 Lightning`, `#53 Chain Lightning`, `#229 Molten Boulder`,
 *   `#230 Arctic Blast`, `#234 Fissure`, `#244 Volcano`), it uses `EFCR`; otherwise (`seqTrans === 'A1'`),
 *   it uses `EIAS` with the `-30` sequence penalty (`0x6FD834CD: sub esi, 0x1E`).
 * - Every attack clip and `sq` add the temporary stat 68 a SkillCltStFunc applies (`D2Client.dll` `0x6FB50880`:
 *   CltSt27 #133 Double Swing `cltcalc1 = par5 = +50`, CltSt9 #270 Dragon Tail `Param4 = -40`).
 * - `a1`, `a2`, `th`, `kk`, `s1`, `s2` (Assassin trap-laying `#261, #262, #271, #272, #276`),
 *   `s3`, `s4` use `EIAS` (`itemIas + skillIas - weaponWsm`).
 * - `gh` (mode 4): rate `50 + EFHR` (`0x6FD83298..0x6FD832C7`), i.e. `effRate = EFHR - 50`.
 * - `bl` (mode 9): rate `50 + EFBR` (`100 + EFBR` with state 101 `holyshield`,
 *   `0x6FD831FE..0x6FD83283`), i.e. `effRate = EFBR - 50` (or `EFBR`).
 * - Knockback (numeric mode 19) has no rate stat (`0x6FD832C9`): returns 0.
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
    /** State 101 `holyshield` active (block rate base 100 instead of 50, `0x6FD83251`). */
    readonly holyShield?: boolean | undefined
  } = {},
): number {
  if (modeOrClipKey === 19) return 0
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
    return computeEffectiveIas({
      itemIas: stats.itemIas ?? stats.ias ?? 0,
      skillIas: (stats.skillIas ?? 0) + cltStAttackRate113c(stats.skillId) - 30,
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
      skillIas: (stats.skillIas ?? 0) + cltStAttackRate113c(stats.skillId),
      weaponWsm: stats.weaponWsm ?? stats.wsm ?? 0,
    })
  }
  if (clipKey === 'gh') {
    return computeGetHitEffRate113c(stats.fhr ?? 0)
  }
  if (clipKey === 'bl') {
    return computeBlockEffRate113c(stats.fbr ?? 0, stats.holyShield === true)
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
    /**
     * State 101 `holyshield` active on the unit: block (mode 9) rate base 100 instead of 50
     * (`UNITS_UpdateAnimRateAndVelocity` `0x6FD83231..0x6FD83251`).
     */
    readonly holyShield?: boolean | null | undefined
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
    skillId: sources.skillId ?? undefined,
    holyShield: sources.holyShield === true,
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

  // Knockback (PLRMODE_KNOCKBACK 19, token GH): `UNITS_UpdateAnimRateAndVelocity`
  // 0x6FD832C9..0x6FD83318 writes `clamp(UNITS_GetBaseAnimSpeed, 0, 0x7FFF)` directly — 213 for
  // players (0x6FD7FB50), MonStats `WalkAnimSpeed` for the shapeshift monster class — with no
  // FHR rate and no AnimData speed.
  if (modeOrClipKey === 19) {
    const morphRec =
      sources.morphMonsterClassId !== undefined && sources.morphMonsterClassId !== null
        ? getMonsterPathRecord(sources.morphMonsterClassId)
        : null
    const kbBase = morphRec ? morphRec.walkAnimSpeed : PLAYER_WALK_BASE_ANIM_SPEED_113C
    const kbStep = Math.max(0, Math.min(0x7fff, Math.trunc(kbBase)))
    return {
      clipKey,
      frames: clip.frames,
      baseSpeed: kbBase,
      loop: false,
      effRate: 0,
      stepSpeed256: kbStep,
      durationMs: computeOneShotDurationMs(clip.frames, Math.max(1, kbStep)),
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

/**
 * Raw 1.13c `D2Common #10385` (`ANIMDATA_GetAnimDataInfo` @ `0x6FD91EF0..0x6FD91F39`):
 * scans `0 .. min(frames, 0x90) - 1` for the first non-zero event byte; when none is non-zero,
 * returns `min(frames, 0x90)`.
 */
export function computeRawAnimDataActionFrame113c(clip: CharAnimClip113c): number {
  return clip.events[0]?.f ?? Math.min(clip.frames, 0x90)
}

function uDiv100_32(x: number): number {
  return Number(((BigInt(x >>> 0) * 0x51eb851fn) >> 32n) >> 5n) | 0
}

/**
 * Raw 1.13c `D2Common #10819` (`UNITS_UpdateAnimRateAndVelocity` @ `0x6FD83180..0x6FD835E4`)
 * 16-bit animation step speed (`pUnit->nActionFrame` / `wAnimSpeed`) for a non-morphed player
 * wielding a 0-WSM weapon (`weaponClass` default `'1hs'`).
 * - Cast (`mode === 10`), Block (`mode === 9`), GetHit (`mode === 4`), and Attack (`mode === 7`)
 *   use x86 unsigned magic `/ 100` (`mul 0x51eb851f; shr edx, 5`) on `imul(clip.speed, rate)`,
 *   treating negative intermediate products as unsigned 32-bit before clamping to `[0, 0x7fff]`
 *   (`[1, 0x7fff]` for Block).
 * - Walk (`mode === 2`) and Run (`mode === 3`) use signed `idiv 100` on `imul(base, max(25, stat67 + dim150(frw)))`
 *   where `base = 101` (Run) or `213` (Walk).
 */
export function computeRawPlayerAnimSpeed113c(params: {
  readonly mode: number
  readonly classId: number
  readonly statAcc: number
  readonly stat68Acc: number
  readonly stat67Acc: number
  readonly weaponClass?: string | undefined
  readonly holyShield?: boolean | undefined
}): number {
  const mode = params.mode | 0
  const clip = getCharAnimClip113c(params.classId | 0, mode, {
    weaponClass: params.weaponClass ?? '1hs',
  })
  if (mode === 10) {
    let rate = (computeRawDiminishingRate113c(params.statAcc | 0, 120) + 100) | 0
    if (rate > 175) rate = 175
    const edx = uDiv100_32(Math.imul(clip.speed, rate))
    return edx <= 0 ? 0 : edx >= 0x7fff ? 0x7fff : edx
  }
  if (mode === 9) {
    const base = params.holyShield ? 100 : 50
    const rate = (base + computeRawDiminishingRate113c(params.statAcc | 0, 120)) | 0
    const edx = uDiv100_32(Math.imul(clip.speed, rate))
    return edx < 1 ? 1 : edx >= 0x7fff ? 0x7fff : edx
  }
  if (mode === 4) {
    const rate = (computeRawDiminishingRate113c(params.statAcc | 0, 120) + 50) | 0
    const edx = uDiv100_32(Math.imul(clip.speed, rate))
    return edx <= 0 ? 0 : edx >= 0x7fff ? 0x7fff : edx
  }
  if (mode === 2 || mode === 3) {
    let esi = ((params.stat67Acc | 0) + computeRawDiminishingRate113c(params.statAcc | 0, 150)) | 0
    if (esi < 25) esi = 25
    const base = mode === 3 ? PLAYER_RUN_BASE_ANIM_SPEED_113C : PLAYER_WALK_BASE_ANIM_SPEED_113C
    const eax = Math.trunc(Math.imul(base, esi) / 100) | 0
    return eax <= 0 ? 0 : eax >= 0x7fff ? 0x7fff : eax
  }
  let ebp = ((params.stat68Acc | 0) + computeRawDiminishingRate113c(params.statAcc | 0, 120)) | 0
  if (ebp < 15) ebp = 15
  else if (ebp > 175) ebp = 175
  const edx = uDiv100_32(Math.imul(clip.speed, ebp))
  return edx <= 0 ? 0 : edx >= 0x7fff ? 0x7fff : edx
}

/**
 * Raw 1.13c one-shot tick count (`ceil((recFrames * 256) / speed) - 1`, or `-1` when `speed <= 0`).
 */
export function computeRawOneShotTicks113c(recFrames: number, speed: number): number {
  return speed > 0 ? Math.ceil(((recFrames | 0) * 256) / speed) - 1 : -1
}
