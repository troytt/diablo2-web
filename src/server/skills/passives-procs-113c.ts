/**
 * 1.13c item chance-to-cast (CtC) aggregation and passive-skill helpers (#1797, #1798, #1802, #1803, #1804).
 *
 * Ground truth:
 * - `ItemStatCost.txt`: `195 item_skillonattack`, `196 item_skillonkill`, `197 item_skillondeath`,
 *   `198 item_skillonhit`, `199 item_skillonlevelup`, `200 item_skillonskill`, `201 item_skillongethit`
 *   (`Encode = 2`: `param = (skillId << 6) | slvl`, `value = chance%`).
 * - `D2Game.dll` item event table `0x6FD27E48` (handlers `0x6FC89060..0x6FC894F0`): every equipped item
 *   event stat is grouped by `(skillId, slvl)` and its chances are summed (capped at 100); entries with a
 *   different `slvl` of the same skill stay separate and roll independently (`rand(100) < chance`).
 *   A successful roll calls `SKILLS_DoSkill` (`0x6FCC1A50`) with `bItemProc = 1`: no mana cost, no
 *   `delay` cooldown, caster hard points (`blvl`) still drive synergies.
 * - `D2Common.dll` `SKILLS_GetWeaponMasteryBonus` (`0x6FD9DC30` / ord `11024`): weapon masteries match the
 *   swinging weapon's `ItemTypes.txt` chain (`passiveitype`), throwing attacks read the throw stats.
 */
import {
  evaluateBarbarianMastery,
  isWeaponMatchingMastery,
  type WeaponMasteryStats,
} from './barbarian-masteries.ts'
import { computeDiminishingReturns } from '../../common/data/calc-ast.ts'

/** `ItemStatCost.txt` chance-to-cast event stat ids. */
export const CTC_STAT_ON_ATTACK_113C = 195
export const CTC_STAT_ON_KILL_113C = 196
export const CTC_STAT_ON_DEATH_113C = 197
export const CTC_STAT_ON_HIT_113C = 198
export const CTC_STAT_ON_LEVELUP_113C = 199
export const CTC_STAT_ON_SKILL_113C = 200
export const CTC_STAT_ON_GETHIT_113C = 201

export type CtcStatId113c = 195 | 196 | 197 | 198 | 199 | 200 | 201

export const CTC_STAT_IDS_113C: readonly CtcStatId113c[] = [195, 196, 197, 198, 199, 200, 201]

export interface CtcRawStat113c {
  readonly statId: number
  readonly param?: number | undefined
  readonly value: number
}

export interface CtcProcEntry113c {
  readonly statId: CtcStatId113c
  readonly skillId: number
  readonly slvl: number
  readonly chancePct: number
}

/**
 * Decodes an `Encode = 2` CtC `param` (`(skillId << 6) | slvl`). Legacy synthetic entries that store the
 * bare skill id (`param < 64`) are treated as slvl 1 (same rule as `extractMercenaryStrikeProcs113c`).
 */
export function decodeCtcParam113c(param: number | undefined): { readonly skillId: number; readonly slvl: number } {
  const raw = (param ?? 0) >>> 0
  if (raw >= 64) return { skillId: raw >>> 6, slvl: Math.max(1, raw & 0x3f) }
  return { skillId: raw, slvl: 1 }
}

/** Packs `(skillId, slvl)` into the `Encode = 2` CtC `param`. */
export function encodeCtcParam113c(skillId: number, slvl: number): number {
  return (((skillId & 0x3ff) << 6) | (slvl & 0x3f)) >>> 0
}

/**
 * Groups CtC stats of `statId` by `(skillId, slvl)` and sums their chance (capped at 100), preserving the
 * first-seen order (`0x6FC89060`).
 */
export function aggregateCtcProcs113c(
  stats: readonly CtcRawStat113c[],
  statId: CtcStatId113c,
): readonly CtcProcEntry113c[] {
  const merged = new Map<string, CtcProcEntry113c>()
  for (const st of stats) {
    if (st.statId !== statId || st.value <= 0) continue
    const { skillId, slvl } = decodeCtcParam113c(st.param)
    if (skillId <= 0) continue
    const key = `${skillId}:${slvl}`
    const prev = merged.get(key)
    merged.set(key, {
      statId,
      skillId,
      slvl,
      chancePct: Math.min(100, (prev?.chancePct ?? 0) + st.value),
    })
  }
  return [...merged.values()]
}

/**
 * Rolls each aggregated entry independently: `chance >= 100` always fires without consuming a roll,
 * otherwise `rand100() < chance`.
 */
export function rollCtcProcs113c(
  entries: readonly CtcProcEntry113c[],
  rand100: () => number,
): readonly CtcProcEntry113c[] {
  const out: CtcProcEntry113c[] = []
  for (const e of entries) {
    if (e.chancePct <= 0) continue
    if (e.chancePct >= 100 || rand100() < e.chancePct) out.push(e)
  }
  return out
}

/** `Skills.txt` `srvdofunc = 22` novas (Frost Nova 44, Nova 48, Poison Nova 92) expand around the event point. */
export function isCtcRadialNovaSkill113c(skillId: number): boolean {
  return skillId === 44 || skillId === 48 || skillId === 92
}

export interface WeaponMasteryBonus113c {
  readonly skillId: number
  readonly attackRatingPct: number
  readonly damagePct: number
  readonly criticalStrikePct: number
}

/**
 * Weapon mastery bonus for the swinging weapon (`SKILLS_GetWeaponMasteryBonus`): Barbarian `#127/#128/#129/
 * #134/#136` (melee) or `#135` (throw attacks), Assassin `#252 Claw Mastery` (melee claws). Returns
 * `undefined` when no learned mastery matches the weapon type.
 */
export function resolveWeaponMasteryBonus113c(
  weaponType: string | undefined,
  isThrowAttack: boolean,
  getSkillLevel: (skillId: number) => number,
): WeaponMasteryBonus113c | undefined {
  if (weaponType === undefined || weaponType.trim() === '') return undefined
  const ids: readonly number[] = isThrowAttack ? [135] : [127, 128, 129, 134, 136]
  for (const id of ids) {
    const slvl = getSkillLevel(id)
    if (slvl > 0 && isWeaponMatchingMastery(weaponType, id)) {
      const m = evaluateBarbarianMastery(id, slvl) as WeaponMasteryStats
      return {
        skillId: id,
        attackRatingPct: m.attackRatingBonusPct,
        damagePct: m.damageBonusPct,
        criticalStrikePct: m.criticalStrikeChancePct,
      }
    }
  }
  if (!isThrowAttack) {
    const slvl252 = getSkillLevel(252)
    if (slvl252 > 0 && isWeaponMatchingMastery(weaponType, 252)) {
      return {
        skillId: 252,
        attackRatingPct: 30 + (slvl252 - 1) * 10,
        damagePct: 35 + (slvl252 - 1) * 4,
        criticalStrikePct: computeDiminishingReturns(0, 25, slvl252),
      }
    }
  }
  return undefined
}

/** `ItemStatCost.txt` elemental mastery / pierce stats `329..336` copied from gear onto combat stat lists (#1801). */
export const ELEMENTAL_MASTERY_PIERCE_STATS_113C: readonly (readonly [number, string])[] = [
  [329, 'passive_fire_mastery'],
  [330, 'passive_ltng_mastery'],
  [331, 'passive_cold_mastery'],
  [332, 'passive_pois_mastery'],
  [333, 'passive_fire_pierce'],
  [334, 'passive_ltng_pierce'],
  [335, 'passive_cold_pierce'],
  [336, 'passive_pois_pierce'],
]
