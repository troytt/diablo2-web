/**
 * src/common/items/damage-merge.ts
 *
 * Diablo II v1.13c item tooltip damage-pair merging, ported from `D2Client.dll`:
 *
 *  - `0x6FB04000` pre-pass: collects mindamage/maxdamage (falling back to secondary_min/maxdamage 23/24),
 *    fire/light/magic/cold/poison min+max, poisonlength and `poison_count` (stat 326). A pair is flagged
 *    "combine" only when **both** halves are > 0.
 *  - `0x6FB04280` per-stat printer:
 *      physical (0x6FB0453F): `min < max` → `strModMinDamageRange` "Adds %d-%d damage"; otherwise the
 *        combine flag is cleared and both stats print their own descfunc lines.
 *      fire/lightning/magic/cold (0x6FB04328/0x6FB043AC/0x6FB04407/0x6FB0436A): `min < max` →
 *        `strMod<E>DamageRange` "Adds %d-%d <e> damage"; otherwise `strMod<E>Damage` "+%d <e> damage" with **max**.
 *      poison (0x6FB0446B): `len /= max(1, poison_count)`; `min = (min*len + 128) >> 8`, `max` likewise;
 *        `sec = len / 25`; `min < max` → `strModPoisonDamageRange`, otherwise `strModPoisonDamage` with max.
 *  - Strings come from the canonical string tables (patchstring overrides drop the trailing `\n`).
 */
import { CANONICAL_CHI_TBL_DICT, CANONICAL_ENG_TBL_DICT } from '../data/canonical-tbl-strings.ts'

export type DamageMergeLocale = 'en' | 'zh'

export type ElementalDamageKind = 'fire' | 'ltng' | 'cold' | 'mag'

const ELEMENT_TBL: Record<ElementalDamageKind, { single: string; range: string }> = {
  fire: { single: 'strModFireDamage', range: 'strModFireDamageRange' },
  ltng: { single: 'strModLightningDamage', range: 'strModLightningDamageRange' },
  cold: { single: 'strModColdDamage', range: 'strModColdDamageRange' },
  mag: { single: 'strModMagicDamage', range: 'strModMagicDamageRange' },
}

function tbl(key: string, locale: DamageMergeLocale): string {
  const dict = locale === 'en' ? CANONICAL_ENG_TBL_DICT : CANONICAL_CHI_TBL_DICT
  const v = dict[key] ?? CANONICAL_ENG_TBL_DICT[key]
  if (v === undefined) throw new Error(`damage-merge: tbl key '${key}' missing`)
  return v.replace(/\n$/, '')
}

function fmt(template: string, ...args: number[]): string {
  let i = 0
  return template.replace(/%d/g, () => String(args[i++] ?? 0))
}

/** `0x6FB0453F`: physical pair printed as one line only when both > 0 and `min < max`. */
export function physicalPairCombines(min: number, max: number): boolean {
  return min > 0 && max > 0 && min < max
}

export function formatPhysicalRange(min: number, max: number, locale: DamageMergeLocale): string {
  return fmt(tbl('strModMinDamageRange', locale), min, max)
}

/** Elemental pair: combined when both > 0 (then range or single "+max"). */
export function elementalPairCombines(min: number, max: number): boolean {
  return min > 0 && max > 0
}

export function formatElementalPair(kind: ElementalDamageKind, min: number, max: number, locale: DamageMergeLocale): string {
  const t = ELEMENT_TBL[kind]
  return min < max ? fmt(tbl(t.range, locale), min, max) : fmt(tbl(t.single, locale), max)
}

/**
 * Poison pair (`0x6FB0446B`). `rawMin`/`rawMax` are the poisonmindam/poisonmaxdam stat values (256ths per frame),
 * `length` the summed poisonlength and `count` the poison_count stat (each `dmg-pois` property adds one).
 */
export function computePoisonPair(rawMin: number, rawMax: number, length: number, count: number): { min: number; max: number; seconds: number } {
  const len = Math.trunc(length / (count > 0 ? count : 1))
  return {
    min: (rawMin * len + 0x80) >> 8,
    max: (rawMax * len + 0x80) >> 8,
    seconds: Math.trunc(len / 25),
  }
}

export function formatPoisonPair(rawMin: number, rawMax: number, length: number, count: number, locale: DamageMergeLocale): string {
  const p = computePoisonPair(rawMin, rawMax, length, count)
  return p.min < p.max
    ? fmt(tbl('strModPoisonDamageRange', locale), p.min, p.max, p.seconds)
    : fmt(tbl('strModPoisonDamage', locale), p.max, p.seconds)
}
