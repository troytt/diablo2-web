/**
 * 1.13c monster kill experience pipeline: level-difference scaling, `Experience.txt`
 * `ExpRatio`, signed `item_addexperience` (stat 85, including Experience Shrine
 * `state 137` `+50`), and party experience pool/split.
 *
 * Reverse-engineered from `samples/d2/D2Game.dll` (image base `0x6FC20000`):
 * - `SUNITDMG_ApplyExpRatio` (`0x6FCFA9E0`)
 * - `SUNITDMG_ComputeLevelDiffExp` (`0x6FCFAA40`, `.rdata` tables `0x6FD1A01C` & `0x6FD1A048`)
 * - `SUNITDMG_ClampMercenaryExpGain` (`0x6FCFB6B0`)
 * - `SUNITDMG_CalculateExperienceGain` (`0x6FCFC030`)
 * - `SUNITDMG_AddMercenaryExperience` (`0x6FCFDCB0`)
 * - `SUNITDMG_AddPlayerExperience` (`0x6FCFDCF0`)
 * - `SUNITDMG_PartyExpCallback` (`0x6FCFAED0`) & `SUNITDMG_DistributeExperience` (`0x6FCFE8F0`)
 * - `SUNITDMG_AddExperienceForKill` (`0x6FCFEA00`)
 * - `PLAYER_DropGoldPile` (`0x6FC57F80`) & `PLAYER_ApplyDeathGoldPenalty` (`0x6FC58180`)
 * - `PLAYER_ApplyDeathPenalties` (`0x6FC583A0`) & `PLAYER_ApplyDeathExpPenalty` (`0x6FC57730`)
 */

import { RAW_DIFFICULTY_LEVELS } from '../data/canonical-drop-data.ts'
import { mulDiv113c } from '../data/mul-div-113c.ts'
import {
  EXPERIENCE_TXT_RAW,
  PARSED_EXPERIENCE_TABLE,
  getExperienceForLevel,
} from '../skills/formulas.ts'

/**
 * `.rdata` `0x6FD1A01C` (`11 × int32`, `/256`): level-difference experience multiplier
 * when `clvl >= mlvl` (`mlvl <= clvl`), indexed by `Math.min(10, clvl - mlvl)`.
 */
export const LEVEL_DIFF_EXP_MOD_ABOVE_OR_EQUAL = [
  256, 256, 256, 256, 256, 256, 207, 159, 110, 61, 13,
] as const

/**
 * `.rdata` `0x6FD1A048` (`11 × int32`, `/256`): level-difference experience multiplier
 * when `clvl < 25` and `mlvl > clvl`, indexed by `Math.min(10, mlvl - clvl)`.
 */
export const LEVEL_DIFF_EXP_MOD_UNDER25_HIGHER_MLVL = [
  256, 256, 256, 256, 256, 256, 225, 174, 92, 38, 5,
] as const

/** Backward-compatible alias for `LEVEL_DIFF_EXP_MOD_ABOVE_OR_EQUAL` (`0x6FD1A01C`). */
export const LEVEL_DIFF_EXP_MOD_UNDER25 = LEVEL_DIFF_EXP_MOD_ABOVE_OR_EQUAL

/** `D2Game.dll` `0x6FCFC03A..0x6FCFC047`: single-call raw experience cap (`0x7FFFFF` = `8,388,607`). */
export const MAX_SINGLE_EXP_GAIN_113C = 0x7fffff

/** `D2Common.dll` `#10628` (`D2Common_GetMaxLevel`, checked at `D2Game.dll` `0x6FCFC05C..0x6FCFC066`). */
export const MAX_CHARACTER_LEVEL_113C = 99

/**
 * Apply the 1.13c character/monster level difference modifier (`D2Game.dll` `0x6FCFAA40`):
 *
 * - Branch 1 (`mlvl <= clvl`, `0x6FCFAA44..0x6FCFAA65`):
 *   `diff = Math.min(10, clvl - mlvl)`, `mod = LEVEL_DIFF_EXP_MOD_ABOVE_OR_EQUAL[diff]` (`0x6FD1A01C`).
 *   If `mod === 256`, return `baseExp`; else `Math.floor((baseExp * mod) / 256)`.
 * - Branch 2 (`mlvl > clvl && clvl < 25`, `0x6FCFAA67..0x6FCFAA8C`):
 *   `diff = Math.min(10, mlvl - clvl)`, `mod = LEVEL_DIFF_EXP_MOD_UNDER25_HIGHER_MLVL[diff]` (`0x6FD1A048`).
 *   If `mod === 256`, return `baseExp`; else `Math.floor((baseExp * mod) / 256)`.
 * - Branch 3 (`mlvl > clvl && clvl >= 25`, `0x6FCFAA8D..0x6FCFAA96`):
 *   `Math.floor((baseExp * clvl) / mlvl)` (`0x6FC214D0`).
 */
export function computeMonsterExpGrant113c(
  baseExp: number,
  clvl: number,
  mlvl: number,
): number {
  const exp = Math.max(0, Math.floor(baseExp))
  if (exp <= 0) return 0
  const characterLevel = Math.max(1, Math.floor(clvl))
  const monsterLevel = Math.max(1, Math.floor(mlvl))
  // Scaling goes through the D2Game mulDiv 0x6FC214D0 with `edx = exp` (0x6FCFAA7C..0x6FCFAA81), which
  // divides first for exp > 0x100000: `(exp / 256) * mod` / `(exp / mlvl) * clvl`.
  if (monsterLevel <= characterLevel) {
    const diff = Math.min(10, characterLevel - monsterLevel)
    const mod = LEVEL_DIFF_EXP_MOD_ABOVE_OR_EQUAL[diff]!
    if (mod === 256) return exp
    return mulDiv113c(mod, exp, 256)
  }
  if (characterLevel < 25) {
    const diff = Math.min(10, monsterLevel - characterLevel)
    const mod = LEVEL_DIFF_EXP_MOD_UNDER25_HIGHER_MLVL[diff]!
    if (mod === 256) return exp
    return mulDiv113c(mod, exp, 256)
  }
  return mulDiv113c(characterLevel, exp, monsterLevel)
}

/**
 * Apply `Experience.txt` `ExpRatio` (`D2Game.dll` `0x6FCFA9E0`):
 * - If `exp <= 0`, returns `0`.
 * - Multiplies by `ExpRatio[clvl]` and shifts right by `10` (`/ 1024`), with no `Math.max(1)` floor.
 */
export function applyExpRatio113c(exp: number, clvl: number): number {
  const current = Math.floor(exp)
  if (current <= 0) return 0
  const clampedLevel = Math.max(1, Math.min(MAX_CHARACTER_LEVEL_113C, Math.floor(clvl)))
  const expRatio = PARSED_EXPERIENCE_TABLE.expRatios[clampedLevel] ?? 1024
  // 0x6FCFAA04..0x6FCFAA2C: shift = Experience.txt MaxLvl-row ExpRatio (10); if
  // `exp > 0x7FFFFFFF >> (shift + (ratio >> shift))` the original computes `(exp >> shift) * ratio`
  // (drops the low bits), otherwise `(ratio * exp) >> shift`.
  const shift = EXP_RATIO_SHIFT_113C
  const limit = 0x7fffffff >> ((shift + (expRatio >> shift)) & 31)
  if (current > limit) return Math.imul(current >> shift, expRatio)
  return Math.imul(expRatio, current) >> shift
}

/** `Experience.txt` `MaxLvl` row `ExpRatio` (= 10), read through `#10989(0)` at `0x6FCFA9F6`. */
export const EXP_RATIO_SHIFT_113C = 10

/**
 * Unclamped 1.13c `D2Game.dll` `0x6FCFAA40` (`SUNITDMG_ComputeLevelDiffExp`):
 * `eax = clvl`, `ecx = mlvl`, `edx = exp`, tail-jumping to `0x6FC214D0` (`mulDiv113c`) when `mod != 256`
 * and returning `edx` unchanged (`mov eax, edx; ret`) when `mod == 256`.
 */
export function computeRawMonsterExpGrant113c(clvl: number, mlvl: number, exp: number): number {
  const eax = clvl | 0
  const ecx = mlvl | 0
  const edx = exp | 0
  if (ecx <= eax) {
    const diff = (eax - ecx) | 0
    const idx = diff < 11 ? (diff < 0 ? 0 : diff) : 10
    const mod = LEVEL_DIFF_EXP_MOD_ABOVE_OR_EQUAL[idx]!
    return mod === 256 ? edx : mulDiv113c(mod, edx, 256)
  }
  if (eax >= 25 && ecx > 0) {
    return mulDiv113c(eax, edx, ecx)
  }
  const diff = (ecx - eax) | 0
  const idx = diff < 11 ? (diff < 0 ? 0 : diff) : 10
  const mod = LEVEL_DIFF_EXP_MOD_UNDER25_HIGHER_MLVL[idx]!
  return mod === 256 ? edx : mulDiv113c(mod, edx, 256)
}

/**
 * Unclamped 1.13c `D2Common #10989` (`0x6FDAE840`) + `D2Game 0x6FCFA9E0` (`SUNITDMG_ApplyExpRatio`):
 * - `exp <= 0` returns `exp` unchanged (`0x6FCFA9E3: test edi, edi; jle`).
 * - `#10989(clvl)`: `clvl <= 0` returns row-0 `ExpRatio` (`10`); `clvl > 99` returns `0`;
 *   `1 <= clvl <= 99` returns `Experience.txt` `ExpRatio[clvl]`.
 */
export function applyRawExpRatio113c(exp: number, clvl: number): number {
  const edi = exp | 0
  if (edi <= 0) return edi
  const lv = clvl | 0
  const esi =
    lv <= 0
      ? EXP_RATIO_SHIFT_113C
      : lv > MAX_CHARACTER_LEVEL_113C
        ? 0
        : (PARSED_EXPERIENCE_TABLE.expRatios[lv] ?? 0)
  const shift = EXP_RATIO_SHIFT_113C
  const limit = 0x7fffffff >> ((shift + (esi >> shift)) & 31)
  if (edi > limit) return Math.imul(edi >> shift, esi)
  return Math.imul(esi, edi) >> shift
}

export const MAX_MERCENARY_LEVEL_113C = 98

export interface KillExperienceGainParams113c {
  readonly rawExp: number
  readonly clvl: number
  readonly mlvl?: number | undefined
  readonly addExpPct?: number | undefined
  readonly maxLevel?: number | undefined
  /**
   * Optional `Hireling.txt` `Exp/Lvl` scale factor (`D2HirelingTxt + 0x2C`).
   * When positive, applies `SUNITDMG_ClampMercExp` (`D2Game.dll` `0x6FCFB6B0`) at the tail of
   * `0x6FCFC030` (`0x6FCFC0A7`).
   */
  readonly expPerLvl?: number | undefined
}

/**
 * Full 1.13c per-kill experience calculation (`D2Game.dll` `0x6FCFC030` `SUNITDMG_CalculateExperienceGain`):
 * 1. Clamp `rawExp` to `0x7FFFFF` (`8,388,607`); if `rawExp <= 0`, return `1` (unless `clvl >= maxLevel`).
 * 2. If `clvl >= maxLevel` (`99` for players, `98` for mercenaries), return `0`.
 * 3. Apply level-difference scaling (`0x6FCFAA40` `computeMonsterExpGrant113c`).
 * 4. Apply `Experience.txt` `ExpRatio >> 10` (`0x6FCFA9E0` `applyExpRatio113c`).
 * 5. Apply signed `stat 85` (`item_addexperience`, including Experience Shrine `state 137` `+50`):
 *    `exp += Math.trunc((exp * addExpPct) / 100)`.
 * 6. For mercenaries (`expPerLvl > 0`), clamp via `0x6FCFB6B0` (`clampMercenaryExpGain113c`).
 */
export function calculateKillExperienceGain113c(params: KillExperienceGainParams113c): number
export function calculateKillExperienceGain113c(
  rawExp: number,
  clvl: number,
  mlvl?: number,
  addExpPct?: number,
  maxLevel?: number,
): number
export function calculateKillExperienceGain113c(
  rawExpOrParams: number | KillExperienceGainParams113c,
  clvlArg?: number,
  mlvlArg?: number,
  addExpPctArg = 0,
  maxLevelArg = MAX_CHARACTER_LEVEL_113C,
): number {
  const rawExp = typeof rawExpOrParams === 'number' ? rawExpOrParams : rawExpOrParams.rawExp
  const clvl = typeof rawExpOrParams === 'number' ? (clvlArg ?? 1) : rawExpOrParams.clvl
  const mlvl = typeof rawExpOrParams === 'number' ? mlvlArg : rawExpOrParams.mlvl
  const addExpPct = typeof rawExpOrParams === 'number' ? addExpPctArg : (rawExpOrParams.addExpPct ?? 0)
  const maxLevel = typeof rawExpOrParams === 'number' ? maxLevelArg : (rawExpOrParams.maxLevel ?? MAX_CHARACTER_LEVEL_113C)
  const expPerLvl = typeof rawExpOrParams === 'number' ? undefined : rawExpOrParams.expPerLvl

  const characterLevel = Math.max(1, Math.floor(clvl))
  if (characterLevel >= maxLevel) return 0

  let exp = Math.trunc(rawExp)
  if (exp > MAX_SINGLE_EXP_GAIN_113C) {
    exp = MAX_SINGLE_EXP_GAIN_113C
  } else if (exp <= 0) {
    return 1
  }

  const effectiveMlvl = mlvl !== undefined && mlvl > 0 ? Math.floor(mlvl) : characterLevel
  exp = computeMonsterExpGrant113c(exp, characterLevel, effectiveMlvl)
  exp = applyExpRatio113c(exp, characterLevel)

  const stat85 = Math.trunc(addExpPct)
  if (stat85 !== 0) {
    // 0x6FCFC090..0x6FCFC09C: exp += mulDiv(eax = stat85, edx = exp, 100) (0x6FC214D0).
    exp += mulDiv113c(stat85, exp, 100)
  }
  exp = Math.max(0, exp)
  if (expPerLvl !== undefined && expPerLvl > 0) {
    exp = clampMercenaryExpGain113c(exp, characterLevel, expPerLvl)
  }
  return exp
}

/**
 * `D2Game.dll` `0x6FCFAED0` (`SUNITDMG_PartyExpCallback`, `0x6FCFAFCA: cmp eax, 0x1900; ja 0x6FCFB024`):
 * Maximum squared sub-tile distance (`dx * dx + dy * dy <= 6400`, radius `80` sub-tiles) from the killed
 * monster for a same-party member in the same area to share kill experience.
 */
export const PARTY_EXP_MAX_DIST_SQ_113C = 0x1900

/** `D2Game.dll` `0x6FCFAED0`: maximum sub-tile radius (`sqrt(0x1900) = 80`) for party experience sharing. */
export const PARTY_EXP_MAX_RADIUS_SUBTILES_113C = 80

/** `D2Game.dll` `0x6FCFAED0` (`0x6FCFAFD8: cmp [esi+0x44], 8`): maximum party members in experience split. */
export const PARTY_EXP_MAX_MEMBERS_113C = 8

/**
 * `D2Game.dll` `0x6FCFAED0` (`0x6FCFAFA2..0x6FCFAFCF`): integer sub-tile distance check
 * `dx * dx + dy * dy <= 0x1900` (`6400`, `80` sub-tiles).
 */
export function isWithinPartyExpRange113c(
  playerX: number,
  playerY: number,
  monsterX: number,
  monsterY: number,
): boolean {
  const dx = Math.trunc(monsterX) - Math.trunc(playerX)
  const dy = Math.trunc(monsterY) - Math.trunc(playerY)
  return dx * dx + dy * dy <= PARTY_EXP_MAX_DIST_SQ_113C
}

/**
 * 1.13c party pool (`D2Game.dll` `0x6FCFE8F0` at `0x6FCFE96D..0x6FCFE988`): every extra
 * same-party member within `dx^2 + dy^2 <= 6400` (`80` sub-tiles, up to `8` members, `0x6FCFAED0`)
 * adds `89/256` (34.76%) to the base kill experience.
 */
export function partyExpPool113c(baseExp: number, memberCount: number): number {
  const base = Math.max(0, Math.floor(baseExp))
  const members = Math.max(1, Math.min(PARTY_EXP_MAX_MEMBERS_113C, Math.floor(memberCount)))
  if (members <= 1) return base
  return base + Math.floor((base * 89 * (members - 1)) / 256)
}

/** Split the party pool by each member's character level (`0x6FCFE9BE..0x6FCFE9DA`). */
export function partyExpShare113c(
  totalExp: number,
  memberLevel: number,
  sumLevels: number,
): number {
  const total = Math.max(0, Math.floor(totalExp))
  const level = Math.max(1, Math.floor(memberLevel))
  const sum = Math.max(1, Math.floor(sumLevels))
  return Math.floor((total * level) / sum)
}

/**
 * 1.13c hireling cumulative experience threshold to reach `level`
 * (`D2Common.dll` ordinal `#10448` `0x6FD7C990` / `#10458` `0x6FD7CCC0` at `0x6FD7CE72`):
 * `((level + 1) * level * level * expPerLvl)`.
 */
export function hirelingExpThreshold(level: number, expPerLvl: number): number {
  const l = Math.floor(level)
  const scale = Math.floor(expPerLvl)
  if (l <= 0 || scale <= 0) return 0
  return (l + 1) * l * l * scale
}

/**
 * 1.13c `D2Game.dll` `0x6FCFB6B0` (`SUNITDMG_ClampMercExp`):
 * Caps a mercenary's single-kill experience gain to `1/64` (`>> 6`) of the experience span
 * between `mercLevel` and `mercLevel + 1`:
 * `maxGain = (hirelingExpThreshold(mercLevel + 1, expPerLvl) - hirelingExpThreshold(mercLevel, expPerLvl)) >>> 6`.
 */
export function clampMercenaryExpGain113c(
  exp: number,
  mercLevel: number,
  expPerLvl: number,
): number {
  const current = Math.floor(exp)
  if (current <= 0) return 0
  const lvl = Math.max(1, Math.floor(mercLevel))
  const scale = Math.max(0, Math.floor(expPerLvl))
  if (scale <= 0) return current
  const maxGain = (hirelingExpThreshold(lvl + 1, scale) - hirelingExpThreshold(lvl, scale)) >>> 6
  return current > maxGain ? maxGain : current
}

/**
 * 1.13c `D2Game.dll` `0x6FD0DA40` (`0x6FD0DA99..0x6FD0DACF`):
 * Resolves a hireling's level (`1..98`) from saved `.d2s` cumulative experience and `Hireling.txt` `Exp/Lvl`.
 */
export function hirelingLevelFromExp(
  exp: number,
  expPerLvl: number,
  maxLevel = MAX_MERCENARY_LEVEL_113C,
): number {
  const curExp = Math.max(0, Math.floor(exp))
  const scale = Math.max(0, Math.floor(expPerLvl))
  const cap = Math.max(1, Math.min(MAX_MERCENARY_LEVEL_113C, Math.floor(maxLevel)))
  if (scale <= 0) return 1
  let lvl = 1
  while (lvl < cap && curExp >= hirelingExpThreshold(lvl + 1, scale)) {
    lvl += 1
  }
  return lvl
}

export interface MercenaryKillExperienceParams113c {
  readonly rawExp: number
  readonly mercLevel: number
  readonly ownerLevel: number
  readonly currentExp: number
  readonly expPerLvl: number
  readonly mlvl?: number | undefined
  readonly addExpPct?: number | undefined
  readonly lastHitByMerc?: boolean | undefined
}

export interface MercenaryKillExperienceOutcome113c {
  /** Post-share (`100%` or `86/256`) and post-`0x6FCFB6B0` clamped experience passed into `0x6FCFDCB0`. */
  readonly expGain: number
  /** Actual experience added to `STAT_EXPERIENCE (13)` (`2 * expGain` per `0x6FCFDD24`, or `0` if capped by owner/max level). */
  readonly expAdded: number
  readonly newExp: number
  readonly newLevel: number
  readonly leveledUp: boolean
}

/**
 * Full 1.13c mercenary kill-experience & level-up evaluation
 * (`D2Game.dll` `0x6FCFEA00` -> `0x6FCFC030` -> `0x6FCFB6B0` -> `0x6FCFDCB0`):
 * 1. `0x6FCFDCB0` (`0x6FCFDD10..0x6FCFDD3B`): if `mercLevel >= ownerLevel` or `mercLevel >= 98`,
 *    returns immediately without adding experience.
 * 2. `0x6FCFC030`: computes level-diff (`0x6FCFAA40`), `ExpRatio` (`0x6FCFA9E0`), `stat 85`,
 *    and clamps via `0x6FCFB6B0` (`(Threshold(lvl + 1) - Threshold(lvl)) >> 6`).
 * 3. `0x6FCFEB1B..0x6FCFEB2C`: if `!lastHitByMerc`, scales by `floor(exp * 86 / 256)` (`~33.59%`).
 * 4. `0x6FCFDCB0` (`0x6FCFDD24: lea edi, [ebx + edi*2]`): adds `2 * expGain` to `STAT_EXPERIENCE (13)`
 *    and increments `newLevel` while `newLevel < 98 && newLevel < ownerLevel && newExp >= Threshold(newLevel + 1, expPerLvl)`.
 */
export function evaluateMercenaryKillExperience113c(
  params: MercenaryKillExperienceParams113c,
): MercenaryKillExperienceOutcome113c {
  const mercLevel = Math.max(1, Math.floor(params.mercLevel))
  const ownerLevel = Math.max(1, Math.floor(params.ownerLevel))
  const currentExp = Math.max(0, Math.floor(params.currentExp))
  const expPerLvl = Math.max(1, Math.floor(params.expPerLvl))

  if (mercLevel >= ownerLevel || mercLevel >= MAX_MERCENARY_LEVEL_113C) {
    return {
      expGain: 0,
      expAdded: 0,
      newExp: currentExp,
      newLevel: mercLevel,
      leveledUp: false,
    }
  }

  const calcExp = calculateKillExperienceGain113c({
    rawExp: params.rawExp,
    clvl: mercLevel,
    mlvl: params.mlvl,
    addExpPct: params.addExpPct ?? 0,
    maxLevel: MAX_MERCENARY_LEVEL_113C,
    expPerLvl,
  })
  const sharedExp = params.lastHitByMerc ? calcExp : Math.floor((calcExp * 86) / 256)
  const expGain = clampMercenaryExpGain113c(sharedExp, mercLevel, expPerLvl)
  if (expGain <= 0) {
    return {
      expGain: 0,
      expAdded: 0,
      newExp: currentExp,
      newLevel: mercLevel,
      leveledUp: false,
    }
  }

  const expAdded = expGain * 2
  const newExp = currentExp + expAdded
  let newLevel = mercLevel
  while (
    newLevel < MAX_MERCENARY_LEVEL_113C &&
    newLevel < ownerLevel &&
    newExp >= hirelingExpThreshold(newLevel + 1, expPerLvl)
  ) {
    newLevel += 1
  }

  return {
    expGain,
    expAdded,
    newExp,
    newLevel,
    leveledUp: newLevel > mercLevel,
  }
}

function parseRow99ExpThreshold(rawTxt: string): number {
  for (const line of rawTxt.split(/\r?\n/)) {
    const parts = line.trim().split('\t')
    if (parts[0]?.trim() === '99') {
      const val = parseInt(parts[1] ?? '0', 10)
      if (!Number.isNaN(val) && val > 0) return val
    }
  }
  return 3837739017
}

function parseDifficultyDeathExpPenalties(rawTxt: string): readonly [number, number, number] {
  const lines = rawTxt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const header = (lines[0] ?? '').split('\t').map((h) => h.trim())
  const col = header.indexOf('DeathExpPenalty')
  if (col < 0) {
    throw new Error('DifficultyLevels.txt: missing DeathExpPenalty column')
  }
  const values = [1, 2, 3].map((lineIdx) => {
    const parts = (lines[lineIdx] ?? '').split('\t')
    const val = Number((parts[col] ?? '').trim())
    if (!Number.isInteger(val)) {
      throw new Error(`DifficultyLevels.txt: invalid DeathExpPenalty on line ${String(lineIdx)}`)
    }
    return val
  })
  return [values[0]!, values[1]!, values[2]!]
}

const EXP_ROW_99_THRESHOLD_113C = parseRow99ExpThreshold(EXPERIENCE_TXT_RAW)
const DIFFICULTY_DEATH_EXP_PENALTIES_113C = parseDifficultyDeathExpPenalties(RAW_DIFFICULTY_LEVELS)

/**
 * 1.13c `D2Common.dll` `#10399` (`0x6FDAE810` `DATATBLS_GetExpThreshold(classId, rowIndex)`):
 * returns the `Experience.txt` threshold at `rowIndex` (`0..99`).
 * - `rowIndex = clvl - 1` (`0..98`) is the minimum total XP for `clvl` (`1..99`).
 * - `rowIndex = clvl` (`1..98`) is the total XP required to reach `clvl + 1` (`2..99`).
 * - `rowIndex = 99` is row `99` in `Experience.txt` (`3,837,739,017`).
 */
export function getExpThreshold113c(rowIndex: number, charClass?: string): number {
  const idx = Math.floor(rowIndex)
  if (idx <= 0) return 0
  if (idx >= MAX_CHARACTER_LEVEL_113C) return EXP_ROW_99_THRESHOLD_113C
  return getExperienceForLevel(idx + 1, charClass)
}

/**
 * `DifficultyLevels.txt` `DeathExpPenalty` (record offset `+0x04`): `0` (Normal), `5` (Nightmare), `10` (Hell).
 */
export function getDeathExpPenaltyPct113c(
  difficulty: number | 'normal' | 'nightmare' | 'hell',
): number {
  if (typeof difficulty === 'string') {
    const key = difficulty.trim().toLowerCase()
    if (key === 'hell') return DIFFICULTY_DEATH_EXP_PENALTIES_113C[2]
    if (key === 'nightmare') return DIFFICULTY_DEATH_EXP_PENALTIES_113C[1]
    return DIFFICULTY_DEATH_EXP_PENALTIES_113C[0]
  }
  const idx = Math.max(0, Math.min(2, Math.floor(difficulty))) as 0 | 1 | 2
  return DIFFICULTY_DEATH_EXP_PENALTIES_113C[idx]
}

export type DeathKillerKind113c =
  | 'monster'
  | 'player'
  | 'player_pet'
  | 'pet'
  | 'summon'
  | 'mercenary'
  | 'hireling'
  | 'trap'
  | 'object'
  | 'shrine'
  | 'environment'
  | 'null'
  | 0
  | 1
  | 2
  | null
  | undefined

/**
 * `D2Game.dll` `0x6FC583A0` (`0x6FC583AD..0x6FC583E3`):
 * Death experience penalty is skipped when the killer is a player (`dwUnitType == 0`) or a
 * monster unit (`dwUnitType == 1`) whose AI owner is a player (`owner->dwUnitType == 0`,
 * i.e. player summon/pet/mercenary). Hostile monsters, traps/objects, shrines, and null
 * killers apply the penalty (`0x6FC583E5`).
 */
export function isPlayerOrPlayerPetKiller113c(killerType?: DeathKillerKind113c): boolean {
  if (killerType === 0) return true
  if (typeof killerType !== 'string') return false
  const norm = killerType.trim().toLowerCase()
  return (
    norm === 'player' ||
    norm === 'player_pet' ||
    norm === 'pet' ||
    norm === 'summon' ||
    norm === 'mercenary' ||
    norm === 'hireling'
  )
}

export interface DeathExperiencePenaltyParams113c {
  readonly clvl: number
  readonly currentExp: number
  readonly difficulty?: number | 'normal' | 'nightmare' | 'hell' | undefined
  readonly penaltyPct?: number | undefined
  readonly killerType?: DeathKillerKind113c
  readonly charClass?: string | undefined
}

export interface DeathExperiencePenaltyResult113c {
  readonly newExp: number
  readonly expLost: number
  readonly rawLoss: number
  readonly minExp: number
  readonly nextExp: number
  readonly penaltyPct: number
}

/**
 * Evaluate the 1.13c player death experience penalty (`D2Game.dll` `0x6FC583A0` -> `0x6FC57730`):
 * - Skip if `clvl <= 1` (`0x6FC5775B: cmp esi, 1; jle`), `penaltyPct <= 0` (`0x6FC577A0: test esi, esi; je`),
 *   `currentExp <= minExp`, or killer is a player / player's pet (`0x6FC583AD..0x6FC583E3`).
 * - Current level span: `span = ExpThreshold(classId, clvl) - ExpThreshold(classId, clvl - 1)` (`0x6FC57767..0x6FC57781`).
 * - Raw loss: `rawLoss = Math.floor((span * DeathExpPenalty) / 100)` (`0x6FC5778E..0x6FC5779D`).
 * - Floor clamp (`0x6FC577A4..0x6FC577B2`): if `currentExp - rawLoss <= minExp`, clamp `newExp` to
 *   `minExp + 1` (never de-levels) and record `expLost = currentExp - minExp` (`[pClient + 0x508]`).
 */
export function evaluateDeathExperiencePenalty113c(
  params: DeathExperiencePenaltyParams113c,
): DeathExperiencePenaltyResult113c {
  const clvl = Math.max(1, Math.min(MAX_CHARACTER_LEVEL_113C, Math.floor(params.clvl)))
  const exp = Math.max(0, Math.floor(params.currentExp))
  const minExp = getExpThreshold113c(clvl - 1, params.charClass)
  const nextExp = getExpThreshold113c(clvl, params.charClass)
  const penaltyPct =
    params.penaltyPct !== undefined
      ? Math.max(0, Math.floor(params.penaltyPct))
      : getDeathExpPenaltyPct113c(params.difficulty ?? 0)

  if (
    clvl <= 1 ||
    penaltyPct <= 0 ||
    exp <= minExp ||
    isPlayerOrPlayerPetKiller113c(params.killerType)
  ) {
    return {
      newExp: exp,
      expLost: 0,
      rawLoss: 0,
      minExp,
      nextExp,
      penaltyPct,
    }
  }

  const span = Math.max(0, nextExp - minExp)
  const rawLoss = Math.floor((span * penaltyPct) / 100)
  if (rawLoss <= 0) {
    return {
      newExp: exp,
      expLost: 0,
      rawLoss: 0,
      minExp,
      nextExp,
      penaltyPct,
    }
  }

  if (exp - rawLoss <= minExp) {
    const newExp = minExp + 1
    const expLost = Math.max(0, exp - minExp)
    return {
      newExp,
      expLost,
      rawLoss,
      minExp,
      nextExp,
      penaltyPct,
    }
  }

  const newExp = exp - rawLoss
  return {
    newExp,
    expLost: rawLoss,
    rawLoss,
    minExp,
    nextExp,
    penaltyPct,
  }
}

/**
 * Compute the post-death experience (`newExp`) per `D2Game.dll` `0x6FC583A0` & `0x6FC57730`.
 */
export function calculateDeathExperiencePenalty113c(
  params: DeathExperiencePenaltyParams113c,
): number
export function calculateDeathExperiencePenalty113c(
  clvl: number,
  currentExp: number,
  difficulty?: number | 'normal' | 'nightmare' | 'hell',
  killerType?: DeathKillerKind113c,
  charClass?: string,
): number
export function calculateDeathExperiencePenalty113c(
  clvlOrParams: number | DeathExperiencePenaltyParams113c,
  currentExpArg?: number,
  difficultyArg: number | 'normal' | 'nightmare' | 'hell' = 0,
  killerTypeArg?: DeathKillerKind113c,
  charClassArg?: string,
): number {
  if (typeof clvlOrParams === 'object' && clvlOrParams !== null) {
    return evaluateDeathExperiencePenalty113c(clvlOrParams).newExp
  }
  return evaluateDeathExperiencePenalty113c({
    clvl: clvlOrParams,
    currentExp: currentExpArg ?? 0,
    difficulty: difficultyArg,
    killerType: killerTypeArg,
    charClass: charClassArg,
  }).newExp
}

export interface DeathGoldPenaltyOptions113c {
  readonly killerType?: DeathKillerKind113c
  readonly isPvp?: boolean | undefined
  readonly gameType?: number | undefined
}

export interface DeathGoldPenaltyResult113c {
  readonly newGold: number
  readonly newBank: number
  readonly dropAmount: number
  readonly goldLost: number
  readonly penaltyPct: number
}

/**
 * Evaluate the 1.13c player death gold penalty (`D2Game.dll` `0x6FC58180` `PLAYER_ApplyDeathGoldPenalty`
 * and `0x6FC57F80` `PLAYER_DropGoldPile`):
 * 1. `pct = Math.min(clvl, 20)` (`0x6FC581B3..0x6FC581BD`).
 * 2. `total = gold + bank` (`stat 14 + stat 15`), `loss = Math.trunc((total * pct) / 100)` (`0x6FC581AA..0x6FC581E5`).
 * 3. When `gameType === 3` (`[pGame + 0x6A] == 3`, `0x6FC5822E..0x6FC58250`):
 *    - If `total - loss < clvl * 500`, clamp `loss = Math.max(0, total - clvl * 500)`.
 *    - Cap `loss = Math.min(loss, gold)` and never deduct from `bank` (`0x6FC58313`).
 * 4. PK branch (`0x6FC58256..0x6FC582E7`, killer is another player or player-owned pet):
 *    - Drops `loss` on the ground (`dropAmount = loss`).
 *    - If `loss <= gold`: `newGold = gold - loss`, `newBank = bank`.
 *    - If `loss > gold`: `newGold = 0`, `newBank = Math.max(0, bank - (loss - gold))`.
 * 5. Non-PK branch (`0x6FC582E9..0x6FC58360`, monster / trap / environment):
 *    - If `loss <= gold`: drops `gold - loss` on the ground (`dropAmount = gold - loss`), `newBank = bank`.
 *    - If `loss > gold`: deducts `loss - gold` from `bank` (`newBank = Math.max(0, bank - (loss - gold))`), `dropAmount = 0`.
 *    - Unconditionally sets carried `STAT_GOLD (14)` to `0` (`newGold = 0`, `0x6FC5834A..0x6FC58360`).
 */
export function applyDeathGoldPenalty113c(
  clvl: number,
  gold: number,
  bank: number,
  options?: DeathGoldPenaltyOptions113c,
): DeathGoldPenaltyResult113c {
  const level = Math.max(0, Math.trunc(clvl))
  const g = Math.max(0, Math.trunc(gold))
  const b = Math.max(0, Math.trunc(bank))
  const pct = Math.min(level, 20)
  const total = g + b
  let loss = Math.trunc((total * pct) / 100)

  if (options?.gameType === 3) {
    const floorGold = level * 500
    if (total - loss < floorGold) {
      loss = Math.max(0, total - floorGold)
    }
    if (loss > g) {
      loss = g
    }
  }

  const isPvp = options?.isPvp ?? isPlayerOrPlayerPetKiller113c(options?.killerType)
  if (isPvp) {
    if (loss <= g) {
      return {
        newGold: g - loss,
        newBank: b,
        dropAmount: loss,
        goldLost: loss,
        penaltyPct: pct,
      }
    }
    return {
      newGold: 0,
      newBank: Math.max(0, b - (loss - g)),
      dropAmount: loss,
      goldLost: loss,
      penaltyPct: pct,
    }
  }

  if (loss <= g) {
    return {
      newGold: 0,
      newBank: b,
      dropAmount: g - loss,
      goldLost: loss,
      penaltyPct: pct,
    }
  }
  return {
    newGold: 0,
    newBank: options?.gameType === 3 ? b : Math.max(0, b - (loss - g)),
    dropAmount: 0,
    goldLost: loss,
    penaltyPct: pct,
  }
}

