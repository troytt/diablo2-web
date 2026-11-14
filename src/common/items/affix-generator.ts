/**
 * Diablo II Affix Generation System (alvl calculation, group mutex exclusion, magic & rare generation).
 *
 * Gold standard references:
 * - 1.13c MagicPrefix.txt & MagicSuffix.txt (1162 spawnable affixes)
 * - 1.13c RarePrefix.txt (46 rows) & RareSuffix.txt (155 rows)
 * - D2Common!6FD77180 / D2Common!Items.cpp (affix generation, alvl formula, and slot constraints)
 * - .d2s item bitstream specification (1 prefix + 1 suffix for Magic; up to 3 prefixes + 3 suffixes for Rare)
 */

import type { ItemBase } from './items.ts'
import type { MagicAffix, AffixTable, AffixEligibilityOptions } from './affixes.ts'
import { isAffixEligible } from './affixes.ts'
import type { RareNameEntry, RareNameTable } from './rare-names.ts'
import { isRareNameEligible } from './rare-names.ts'
import { resolveChargedSkillRoll113c } from './charged-skill.ts'
import type { D2Rng } from '../rng/d2-rng.ts'

/**
 * Rolled modifier entry with concrete rolled value.
 */
export interface RolledMod {
  readonly code: string
  readonly param?: string | undefined
  readonly min: number
  readonly max: number
  readonly value: number
}

/**
 * Concrete rolled affix instance on an item.
 */
export interface RolledAffix {
  readonly affix: MagicAffix
  readonly name: string
  readonly isPrefix: boolean
  readonly group: number
  readonly level: number
  readonly levelreq: number
  readonly classspecific?: string | undefined
  readonly class?: string | undefined
  readonly classlevelreq?: number | undefined
  readonly transform?: boolean | undefined
  readonly transformColor?: string | undefined
  readonly mods: readonly RolledMod[]
  readonly id?: number | undefined
}

/**
 * Result of rolling magic affixes on an item.
 */
export interface GeneratedAffixes {
  readonly name: string
  readonly alvl: number
  readonly prefix: RolledAffix | null
  readonly suffix: RolledAffix | null
  readonly prefixes: readonly RolledAffix[]
  readonly suffixes: readonly RolledAffix[]
  readonly affixes: readonly RolledAffix[]
  readonly baseName: string
  readonly dwInitSeed?: number | undefined
  readonly seed?: number | undefined
}

/**
 * Result of rolling rare affixes on an item.
 */
export interface GeneratedRareAffixes extends GeneratedAffixes {
  readonly rarePrefix?: RareNameEntry | undefined
  readonly rareSuffix?: RareNameEntry | undefined
}

/**
 * Type predicate for item type hierarchy testing.
 */
export type IsAFunction = (type: string, target: string) => boolean

/**
 * Computes affix level (alvl) according to the 1.13c Diablo II algorithm (`D2Game.dll` @ `0x6FC34604..0x6FC34657`).
 *
 * Formula:
 * - `i = Math.max(ilvl, qlvl)`
 * - `if (magicLvl > 0) alvl = i + magicLvl`
 * - `else if (i < 99 - Math.trunc(qlvl / 2)) alvl = i - Math.trunc(qlvl / 2)`
 * - `else alvl = 2 * i - 99`
 * - `alvl = Math.max(1, Math.min(alvl, 99))`
 *
 * @param ilvl - Item drop level (from monster mlvl or area alvl).
 * @param qlvl - Base item quality level.
 * @param magicLvl - Optional magic level bonus on base item (e.g. circlets, wands, staves, orbs).
 * @returns Calculated affix level (alvl, clamped to [1, 99]).
 */
export function calculateAlvl(ilvl: number, qlvl: number, magicLvl = 0): number {
  const i = Math.max(ilvl, qlvl)
  const halfQlvl = Math.trunc(qlvl / 2)
  let alvl: number
  if (magicLvl > 0) {
    alvl = i + magicLvl
  } else if (i < 99 - halfQlvl) {
    alvl = i - halfQlvl
  } else {
    alvl = 2 * i - 99
  }
  return Math.max(1, Math.min(alvl, 99))
}

/**
 * Resolves the primary item type code for an ItemBase.
 *
 * Checks:
 * 1. `base.type` (if present, e.g. from ArmorEntry/WeaponEntry/MiscItemEntry)
 * 2. Specific tag in `base.tags` (skipping generic categories 'weap', 'armo', 'misc')
 * 3. First tag in `base.tags`
 * 4. `base.code`
 * 5. `base.id`
 *
 * @param base - The base item definition.
 * @returns 3-4 character item type code (e.g. 'swor', 'helm', 'ring').
 */
export function getItemTypeCode(base: ItemBase): string {
  if ((base as any).type) {
    return (base as any).type
  }
  if (base.tags && base.tags.length > 0) {
    const specific = base.tags.find(t => t !== 'weap' && t !== 'armo' && t !== 'misc')
    if (specific) {
      return specific
    }
    return base.tags[0]!
  }
  if ((base as any).code) {
    return (base as any).code
  }
  return base.id
}

/**
 * Extracts quality level (qlvl) from an ItemBase.
 */
export function getBaseQlvl(base: ItemBase): number {
  return (base as any).qlvl ?? base.level ?? 1
}

/**
 * Extracts magic level (magicLvl) from an ItemBase.
 */
export function getBaseMagicLvl(base: ItemBase): number {
  return (base as any).magicLvl ?? (base as any).magicLevel ?? 0
}

/**
 * Filters eligible candidate affixes from an AffixTable taking into account group mutex and prior selections.
 */
function getEligibleCandidates(
  table: AffixTable,
  itemTypeCode: string,
  isA: IsAFunction,
  options: AffixEligibilityOptions,
  usedGroups: ReadonlySet<number>,
  usedAffixes: ReadonlySet<MagicAffix>,
): MagicAffix[] {
  const all = table.all ?? (Array.isArray(table) ? table : [])
  return all.filter(affix => {
    if (usedAffixes.has(affix)) {
      return false
    }
    if (affix.group > 0 && usedGroups.has(affix.group)) {
      return false
    }
    return isAffixEligible(affix, itemTypeCode, isA, options)
  })
}

/**
 * Computes the candidate weight for an affix per `D2Game.dll` @ `0x6FC3478B..0x6FC347B0`:
 * - When `magicLvl > 0` (`magic lvl` base such as wand, staff, orb, circlet): `frequency * level`
 * - Otherwise: `frequency`
 */
export function getAffixWeight(
  affix: { readonly frequency: number; readonly level: number },
  magicLvl = 0,
): number {
  const freq = Math.max(0, affix.frequency)
  if (magicLvl > 0) {
    return freq * Math.max(0, affix.level)
  }
  return freq
}

/**
 * Selects an affix from candidate list per `D2Game.dll` @ `0x6FC3478B..0x6FC34889`:
 * - Candidate weight is `magicLvl > 0 ? frequency * level : frequency`.
 * - If `totalWeight <= 0`, returns `null` (no uniform fallback).
 * - Rolls `rng.rand(totalWeight + 1)` and subtracts candidate weights until `< 0`.
 * - If `roll === totalWeight` (all weights subtracted and `roll >= 0`), returns `null`.
 */
export function pickWeightedAffix<T extends { readonly frequency: number; readonly level: number }>(
  candidates: readonly T[],
  rng: D2Rng,
  magicLvl = 0,
): T | null {
  if (candidates.length === 0) {
    return null
  }
  let totalWeight = 0
  for (const cand of candidates) {
    totalWeight += getAffixWeight(cand, magicLvl)
  }

  if (totalWeight <= 0) {
    return null
  }

  let roll = rng.rand(totalWeight + 1)
  for (const cand of candidates) {
    roll -= getAffixWeight(cand, magicLvl)
    if (roll < 0) {
      return cand
    }
  }

  return null
}

/**
 * Picks an affix for a Magic/Rare slot using `pickWeightedAffix`, falling through
 * to the last positive-weight candidate when `roll === totalWeight` per
 * `D2Game.dll` `0x6FC34851..0x6FC34855` (`jl 0x6FC3481E` falls through to `mov ebx, [edi]`).
 */
function pickCandidateAffix(
  candidates: readonly MagicAffix[],
  rng: D2Rng,
  magicLvl = 0,
): MagicAffix | null {
  const picked = pickWeightedAffix(candidates, rng, magicLvl)
  if (picked) {
    return picked
  }
  for (let i = candidates.length - 1; i >= 0; i--) {
    const cand = candidates[i]!
    if (getAffixWeight(cand, magicLvl) > 0) {
      return cand
    }
  }
  return null
}

/**
 * Property codes whose (min, max) define a damage range (e.g. dmg-fire 1-6)
 * or proc/charge parameters (e.g. hit-skill chance=min, slvl=max; charged charges=min, slvl=max)
 * rather than a single random value rolled between min and max.
 */
export const NON_RANDOM_RANGE_CODES: ReadonlySet<string> = new Set([
  'dmg-fire',
  'dmg-cold',
  'dmg-ltng',
  'dmg-mag',
  'dmg-pois',
  'dmg-norm',
  'dmg-elem',
  'hit-skill',
  'att-skill',
  'gethit-skill',
  'kill-skill',
  'death-skill',
  'levelup-skill',
  'charged',
  'skill-rand',
  'randclassskill',
  'randclassskill1',
  'randclassskill2',
  'splash',
  'item_splashonhit',
  'sorc-skill-rand-ctc',
])

/**
 * Rolls concrete values for all modifiers of a chosen affix using `rng.randRange(min, max)`.
 */
function rollAffixMods(affix: MagicAffix, rng: D2Rng, ilvl?: number): RolledMod[] {
  return affix.mods.map(mod => {
    const codeLower = mod.code.toLowerCase()
    if (codeLower === 'charged') {
      const { slvl, maxCharges } = resolveChargedSkillRoll113c(mod.min, mod.max, {
        ilvl,
        skillId: mod.param,
      })
      return {
        code: mod.code,
        ...(mod.param !== undefined ? { param: mod.param } : {}),
        min: maxCharges,
        max: slvl,
        value: maxCharges,
      }
    }
    if (NON_RANDOM_RANGE_CODES.has(codeLower)) {
      return {
        code: mod.code,
        ...(mod.param !== undefined ? { param: mod.param } : {}),
        min: mod.min,
        max: mod.max,
        value: mod.min,
      }
    }
    const rolled = rng.randRange(mod.min, mod.max)
    const value =
      mod.min === 0 && mod.max === 0 && mod.param !== undefined && mod.param !== '' && !Number.isNaN(Number(mod.param))
        ? Number(mod.param)
        : rolled
    return {
      code: mod.code,
      ...(mod.param !== undefined ? { param: mod.param } : {}),
      min: mod.min,
      max: mod.max,
      value,
    }
  })
}

/**
 * Creates a RolledAffix from a selected MagicAffix and rolled mods.
 */
export function createRolledAffix(affix: MagicAffix, rng: D2Rng, ilvl?: number): RolledAffix {
  const mods = rollAffixMods(affix, rng, ilvl)
  return {
    affix,
    name: affix.name,
    isPrefix: affix.isPrefix,
    group: affix.group,
    level: affix.level,
    levelreq: affix.levelreq,
    ...(affix.classspecific !== undefined ? { classspecific: affix.classspecific } : {}),
    ...(affix.class !== undefined ? { class: affix.class } : {}),
    ...(affix.classlevelreq !== undefined ? { classlevelreq: affix.classlevelreq } : {}),
    ...(affix.transform !== undefined ? { transform: affix.transform } : {}),
    ...(affix.transformColor !== undefined ? { transformColor: affix.transformColor } : {}),
    mods,
    id: (affix as any).id,
  }
}

/**
 * Retrieves eligible rare names from a RareNameTable.
 */
function getEligibleRareNames(
  table: RareNameTable,
  itemTypeCode: string,
  isA: IsAFunction,
): readonly RareNameEntry[] {
  if (typeof table.getEligible === 'function') {
    return table.getEligible(itemTypeCode, isA)
  }
  if (Array.isArray(table.entries)) {
    return table.entries.filter(entry => isRareNameEligible(entry, itemTypeCode, isA))
  }
  return []
}

/**
 * 1.13c Expansion rare item affix count lookup table (`D2Game.dll` `.rdata` @ `0x6FD1D058`,
 * indexed by `rng.rand(8)` at `0x6FC352E5..0x6FC35302`):
 * - 3 affixes: 1/8 (12.5%)
 * - 4 affixes: 2/8 (25.0%)
 * - 5 affixes: 3/8 (37.5%)
 * - 6 affixes: 2/8 (25.0%)
 */
export const RARE_AFFIX_COUNT_TABLE = [3, 4, 4, 5, 5, 5, 6, 6] as const

/**
 * Checks whether an `ItemBase` is a Jewel (`ItemTypes.txt` row 58 `'jewl'`, `Misc.txt` code `'jew'`)
 * per `D2Game.dll` `0x6FC352C4..0x6FC352D1` (`D2Common_GetItemType(pItem) == 58`).
 */
export function isJewelItemBase(
  base: ItemBase,
  itemTypeCode = getItemTypeCode(base),
  isA?: IsAFunction,
): boolean {
  const typeLower = itemTypeCode.trim().toLowerCase()
  if (typeLower === 'jewl' || typeLower === 'jew') {
    return true
  }
  const idLower = (base.id ?? '').trim().toLowerCase()
  if (idLower === 'jew' || idLower === 'jewl') {
    return true
  }
  if (base.tags?.some(t => {
    const tagLower = t.trim().toLowerCase()
    return tagLower === 'jewl' || tagLower === 'jew'
  })) {
    return true
  }
  if (isA && isA(itemTypeCode, 'jewl')) {
    return true
  }
  return false
}

/**
 * Rolls magic affixes for an item (`D2Game.dll` `0x6FC303C0` + `0x6FC344D0`):
 * - 1 prefix slot + 1 suffix slot.
 * - Prefix slot rolls `rng.rand(2)` (`0x6FC3458A..0x6FC345C8`, `bForce = 0`): 50% chance to attempt prefix.
 * - Suffix slot is forced (`bForce = 1` at `0x6FC30432..0x6FC30481`) if prefix was skipped or failed to roll;
 *   otherwise rolls `rng.rand(2)` (50% chance to also roll suffix).
 * - Resulting distribution when both pools are non-empty:
 *   - Prefix only: 1/4 (25%)
 *   - Suffix only: 1/2 (50%)
 *   - Prefix + Suffix: 1/4 (25%)
 * - Weighted selection by `frequency` (or `frequency * level` when `magicLvl > 0`).
 * - Group mutex: when an affix with `group > 0` is chosen, that group is excluded from subsequent rolls.
 * - Formats name as `[Prefix] [BaseName] [Suffix]`.
 *
 * @param base - Base item definition.
 * @param ilvl - Item level.
 * @param affixes - Tables containing prefix and suffix tables.
 * @param isA - Item type inheritance predicate.
 * @param rng - Unit PRNG instance (D2Rng).
 * @param options - Optional eligibility overrides (e.g. itemClass, isExpansion).
 * @returns Generated magic item affixes and metadata.
 */
export function rollMagicAffixes(
  base: ItemBase,
  ilvl: number,
  affixes: { prefixes: AffixTable; suffixes: AffixTable },
  isA: Function,
  rng: D2Rng,
  options?: { readonly itemClass?: string | undefined; readonly isExpansion?: boolean | undefined },
): GeneratedAffixes {
  const predicate = isA as IsAFunction
  const initialSeed = rng.lo
  const qlvl = getBaseQlvl(base)
  const magicLvl = getBaseMagicLvl(base)
  const alvl = calculateAlvl(ilvl, qlvl, magicLvl)
  const itemTypeCode = getItemTypeCode(base)
  const rawItemClass = options?.itemClass !== undefined ? options.itemClass : (base as any).itemClass ?? (base as any).class
  const itemClass = typeof rawItemClass === 'string' ? rawItemClass.trim().toLowerCase() : undefined
  const eligibilityOpts: AffixEligibilityOptions = {
    alvl,
    isRare: false,
    ...(options?.isExpansion !== undefined ? { isExpansion: options.isExpansion } : {}),
    ...(itemClass !== undefined ? { itemClass } : {}),
  }

  const usedGroups = new Set<number>()
  const usedAffixes = new Set<MagicAffix>()

  let rolledPrefix: RolledAffix | null = null
  let rolledSuffix: RolledAffix | null = null

  // Per D2Game.dll 0x6FC30408 -> 0x6FC344D0 (bForce = 0, 0x6FC3458A..0x6FC345C8):
  // Roll rand(2) (50% chance) to attempt a magic prefix.
  const wantsPrefix = rng.rand(2) !== 0
  if (wantsPrefix) {
    const candidates = getEligibleCandidates(
      affixes.prefixes,
      itemTypeCode,
      predicate,
      eligibilityOpts,
      usedGroups,
      usedAffixes,
    )
    const picked = pickCandidateAffix(candidates, rng, magicLvl)
    if (picked) {
      usedAffixes.add(picked)
      if (picked.group > 0) {
        usedGroups.add(picked.group)
      }
      rolledPrefix = createRolledAffix(picked, rng, ilvl)
    }
  }

  // Per D2Game.dll 0x6FC30432..0x6FC30481 -> 0x6FC344D0:
  // If no prefix was rolled (either wantsPrefix == false or prefix pool had no match),
  // bForce = 1 forces suffix without consuming rand(2); otherwise roll rand(2) for suffix.
  const wantsSuffix = !rolledPrefix || rng.rand(2) !== 0
  if (wantsSuffix) {
    const candidates = getEligibleCandidates(
      affixes.suffixes,
      itemTypeCode,
      predicate,
      eligibilityOpts,
      usedGroups,
      usedAffixes,
    )
    const picked = pickCandidateAffix(candidates, rng, magicLvl)
    if (picked) {
      usedAffixes.add(picked)
      if (picked.group > 0) {
        usedGroups.add(picked.group)
      }
      rolledSuffix = createRolledAffix(picked, rng, ilvl)
    }
  }

  // Name format: [Prefix] [BaseName] [Suffix]
  const nameParts: string[] = []
  if (rolledPrefix) {
    nameParts.push(rolledPrefix.name)
  }
  nameParts.push(base.name)
  if (rolledSuffix) {
    nameParts.push(rolledSuffix.name)
  }
  const name = nameParts.filter(p => p.trim().length > 0).join(' ')

  const prefixes = rolledPrefix ? [rolledPrefix] : []
  const suffixes = rolledSuffix ? [rolledSuffix] : []
  const allRolled = [...prefixes, ...suffixes]

  return {
    name,
    alvl,
    prefix: rolledPrefix,
    suffix: rolledSuffix,
    prefixes,
    suffixes,
    affixes: allRolled,
    baseName: base.name,
    dwInitSeed: initialSeed,
    seed: initialSeed,
  }
}

/**
 * Rolls rare affixes for an item (`D2Game.dll` `0x6FC35240` Expansion / `0x6FC34F20` Classic):
 * - Up to 3 prefix + up to 3 suffix slots.
 * - Total affixes:
 *   - Rare Jewels (`ItemType == 58` `'jewl'`): `3 + rng.rand(2)` (`3..4`, 50% each).
 *   - Classic non-jewels (`isExpansion === false`, `0x6FC34FC0..0x6FC34FDC`): `4 + rng.rand(3)` (`4..6` uniform).
 *   - Expansion non-jewels (`.rdata 0x6FD1D058` at `0x6FC352E5..0x6FC35302`):
 *     `RARE_AFFIX_COUNT_TABLE[rng.rand(8)]` (`[3, 4, 4, 5, 5, 5, 6, 6]`).
 * - Side selection (`0x6FC35330..0x6FC35430`):
 *   - Tracks `prefixFull` and `suffixFull` flags (marked true when a side reaches 3 affixes or fails to roll).
 *   - When a side fails to roll an eligible affix, marks that side full and decrements `slot` (`slot--`)
 *     so the current slot is retried on the opposite side without losing an affix count.
 * - Rare name: pick 1 eligible RarePrefix + 1 eligible RareSuffix.
 * - Mod values rolled using `itemRng.randRange(min, max)`.
 *
 * @param base - Base item definition.
 * @param ilvl - Item level.
 * @param affixes - Tables containing prefix and suffix tables.
 * @param rareNames - Tables containing rare prefix and suffix name tables.
 * @param isA - Item type inheritance predicate.
 * @param rng - Unit PRNG instance (D2Rng).
 * @param options - Optional eligibility overrides (e.g. itemClass, isExpansion).
 * @returns Generated rare item affixes and metadata.
 */
export function rollRareAffixes(
  base: ItemBase,
  ilvl: number,
  affixes: { prefixes: AffixTable; suffixes: AffixTable },
  rareNames: { prefixes: RareNameTable; suffixes: RareNameTable },
  isA: Function,
  rng: D2Rng,
  options?: { readonly itemClass?: string | undefined; readonly isExpansion?: boolean | undefined },
): GeneratedRareAffixes {
  const predicate = isA as IsAFunction
  const initialSeed = rng.lo
  const qlvl = getBaseQlvl(base)
  const magicLvl = getBaseMagicLvl(base)
  const alvl = calculateAlvl(ilvl, qlvl, magicLvl)
  const itemTypeCode = getItemTypeCode(base)
  const rawItemClass = options?.itemClass !== undefined ? options.itemClass : (base as any).itemClass ?? (base as any).class
  const itemClass = typeof rawItemClass === 'string' ? rawItemClass.trim().toLowerCase() : undefined
  const eligibilityOpts: AffixEligibilityOptions = {
    alvl,
    isRare: true,
    ...(options?.isExpansion !== undefined ? { isExpansion: options.isExpansion } : {}),
    ...(itemClass !== undefined ? { itemClass } : {}),
  }

  // 1. Pick Rare Name: 1 eligible RarePrefix + 1 eligible RareSuffix
  const eligibleRarePrefixes = getEligibleRareNames(rareNames.prefixes, itemTypeCode, predicate)
  const eligibleRareSuffixes = getEligibleRareNames(rareNames.suffixes, itemTypeCode, predicate)

  let rarePrefix: RareNameEntry | undefined
  if (eligibleRarePrefixes.length > 0) {
    const idx = rng.rand(eligibleRarePrefixes.length)
    rarePrefix = eligibleRarePrefixes[idx]
  }

  let rareSuffix: RareNameEntry | undefined
  if (eligibleRareSuffixes.length > 0) {
    const idx = rng.rand(eligibleRareSuffixes.length)
    rareSuffix = eligibleRareSuffixes[idx]
    if (
      eligibleRareSuffixes.length > 1 &&
      rarePrefix &&
      rareSuffix &&
      rareSuffix.name.trim().toLowerCase() === rarePrefix.name.trim().toLowerCase()
    ) {
      for (let offset = 1; offset < eligibleRareSuffixes.length; offset++) {
        const candidate = eligibleRareSuffixes[(idx + offset) % eligibleRareSuffixes.length]
        if (candidate && candidate.name.trim().toLowerCase() !== rarePrefix.name.trim().toLowerCase()) {
          rareSuffix = candidate
          break
        }
      }
    }
  }

  const rareNameParts = [rarePrefix?.name, rareSuffix?.name].filter(
    (n): n is string => typeof n === 'string' && n.trim().length > 0,
  )
  const name = rareNameParts.length > 0 ? rareNameParts.join(' ') : base.name

  // 2. Determine total affix count per 1.13c D2Game.dll 0x6FC35240 (Expansion) / 0x6FC34F20 (Classic):
  // - Rare Jewels (ItemType == 58 'jewl'): 3 + rng.rand(2) (3..4 affixes, 50% each)
  // - Classic non-jewels (0x6FC34FC0..0x6FC34FDC): 4 + rng.rand(3) (4..6 affixes)
  // - Expansion non-jewels (.rdata 0x6FD1D058): RARE_AFFIX_COUNT_TABLE[rng.rand(8)] ([3, 4, 4, 5, 5, 5, 6, 6])
  let totalAffixes: number
  if (isJewelItemBase(base, itemTypeCode, predicate)) {
    totalAffixes = 3 + rng.rand(2)
  } else if (options?.isExpansion === false) {
    totalAffixes = 4 + rng.rand(3)
  } else {
    totalAffixes = RARE_AFFIX_COUNT_TABLE[rng.rand(8)]!
  }

  const usedGroups = new Set<number>()
  const usedAffixes = new Set<MagicAffix>()
  const rolledPrefixes: RolledAffix[] = []
  const rolledSuffixes: RolledAffix[] = []

  const tryRollSide = (wantPrefix: boolean): boolean => {
    if (wantPrefix) {
      if (rolledPrefixes.length >= 3) return false
      const candidates = getEligibleCandidates(
        affixes.prefixes,
        itemTypeCode,
        predicate,
        eligibilityOpts,
        usedGroups,
        usedAffixes,
      )
      const picked = pickCandidateAffix(candidates, rng, magicLvl)
      if (!picked) return false
      usedAffixes.add(picked)
      if (picked.group > 0) {
        usedGroups.add(picked.group)
      }
      rolledPrefixes.push(createRolledAffix(picked, rng, ilvl))
      return true
    } else {
      if (rolledSuffixes.length >= 3) return false
      const candidates = getEligibleCandidates(
        affixes.suffixes,
        itemTypeCode,
        predicate,
        eligibilityOpts,
        usedGroups,
        usedAffixes,
      )
      const picked = pickCandidateAffix(candidates, rng, magicLvl)
      if (!picked) return false
      usedAffixes.add(picked)
      if (picked.group > 0) {
        usedGroups.add(picked.group)
      }
      rolledSuffixes.push(createRolledAffix(picked, rng, ilvl))
      return true
    }
  }

  // Side selection & failure retry loop per D2Game.dll 0x6FC35330..0x6FC35430:
  let prefixFull = false
  let suffixFull = false

  for (let slot = 0; slot < totalAffixes; slot++) {
    let pickPrefix: boolean
    if (prefixFull) {
      if (suffixFull) {
        break
      }
      pickPrefix = false
    } else if (suffixFull) {
      pickPrefix = true
    } else {
      pickPrefix = rng.rand(2) === 0
    }

    if (pickPrefix) {
      if (tryRollSide(true)) {
        if (rolledPrefixes.length >= 3) {
          prefixFull = true
        }
      } else {
        prefixFull = true
        slot--
      }
    } else {
      if (tryRollSide(false)) {
        if (rolledSuffixes.length >= 3) {
          suffixFull = true
        }
      } else {
        suffixFull = true
        slot--
      }
    }
  }

  const allRolled = [...rolledPrefixes, ...rolledSuffixes]

  return {
    name,
    alvl,
    rarePrefix,
    rareSuffix,
    prefix: rolledPrefixes[0] ?? null,
    suffix: rolledSuffixes[0] ?? null,
    prefixes: rolledPrefixes,
    suffixes: rolledSuffixes,
    affixes: allRolled,
    baseName: base.name,
    dwInitSeed: initialSeed,
    seed: initialSeed,
  }
}

export {
  rollAutoMagic,
  type RolledAutoMagic,
  type RolledAutoMagicMod,
  resolveAutoPrefixGroup,
  ITEM_TYPE_AUTO_PREFIX_MAP,
  rollStaffMods,
  resolveStaffModsClass,
  ITEM_TYPE_STAFF_MODS_MAP,
  STAFF_MOD_CLASS_SKILL_START,
} from './automagic.ts'

