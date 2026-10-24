/**
 * 1.13c monster kill experience: level-difference penalty and party split.
 *
 * Reverse-engineered from `D2Game.dll`:
 * - `EXP_ComputeLevelDiffPenalty` `0x6FC9CE80`
 * - `EXP_DivideExperience` `0x6FC9D260`
 *
 * The caller applies `Experience.txt` `ExpRatio`, the Experience Shrine
 * (`State 137`, +50%) and `item_addexperience` (stat 85) afterwards, so this
 * module only handles the level-diff table and the party pool/share.
 */

/** `LEVEL_DIFF_EXP_MOD_UNDER25` (`clvl < 25`), indexed by `abs(clvl - mlvl)`. */
export const LEVEL_DIFF_EXP_MOD_UNDER25 = [
  256, 256, 256, 256, 256, 256, 207, 159, 110, 61, 13,
] as const

/**
 * Apply the 1.13c character/monster level difference modifier.
 *
 * - `clvl < 25`: 11-entry table, 100% down to 5% at `diff >= 10`.
 * - `clvl >= 25` and `clvl < mlvl`: `clvl / mlvl`.
 * - `clvl >= 25` and `clvl >= mlvl` with `diff > 5`: same table.
 * - otherwise: 100%.
 */
export function computeMonsterExpGrant113c(
  baseExp: number,
  clvl: number,
  mlvl: number,
): number {
  const exp = Math.max(0, Math.floor(baseExp))
  const characterLevel = Math.max(1, Math.floor(clvl))
  const monsterLevel = Math.max(1, Math.floor(mlvl))
  const diff = Math.abs(characterLevel - monsterLevel)
  if (characterLevel < 25) {
    const mod = LEVEL_DIFF_EXP_MOD_UNDER25[Math.min(10, diff)]!
    return Math.floor((exp * mod) / 256)
  }
  if (characterLevel < monsterLevel) {
    return Math.floor((exp * characterLevel) / monsterLevel)
  }
  if (diff > 5) {
    const mod = LEVEL_DIFF_EXP_MOD_UNDER25[Math.min(10, diff)]!
    return Math.floor((exp * mod) / 256)
  }
  return exp
}

/**
 * 1.13c party pool: every extra same-party member within two screens adds
 * `89/256` (34.76%) to the base kill experience.
 */
export function partyExpPool113c(baseExp: number, memberCount: number): number {
  const base = Math.max(0, Math.floor(baseExp))
  const members = Math.max(1, Math.floor(memberCount))
  if (members <= 1) return base
  return base + Math.floor((base * 89 * (members - 1)) / 256)
}

/** Split the party pool by each member's character level. */
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