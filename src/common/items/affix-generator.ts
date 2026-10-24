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
 * Computes affix level (alvl) according to the 1.13c Diablo II algorithm.
 *
 * Formula:
 * - if (magicLvl > 0) alvl = ilvl + magicLvl
 * - else if (qlvl > Math.trunc(ilvl / 2)) alvl = ilvl - Math.trunc(qlvl / 2)
 * - else alvl = ilvl
 * - alvl = Math.min(alvl, 99)
 *
 * @param ilvl - Item drop level (from monster mlvl or area alvl).
 * @param qlvl - Base item quality level.
 * @param magicLvl - Optional magic level bonus on base item (e.g. circlets, wands, staves).
 * @returns Calculated affix level (alvl, capped at 99).
 */
export function calculateAlvl(ilvl: number, qlvl: number, magicLvl = 0): number {
  let alvl: number
  if (magicLvl > 0) {
    alvl = ilvl + magicLvl
  } else if (qlvl > Math.trunc(ilvl / 2)) {
    alvl = ilvl - Math.trunc(qlvl / 2)
  } else {
    alvl = ilvl
  }
  alvl = Math.max(1, Math.min(alvl, 99))
  return alvl
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
 * Selects an affix from candidate list weighted by `affix.frequency`.
 *
 * If all frequencies are 0 (or total weight <= 0), chooses uniformly at random.
 */
function pickWeightedAffix(candidates: readonly MagicAffix[], rng: D2Rng): MagicAffix | null {
  if (candidates.length === 0) {
    return null
  }
  let totalWeight = 0
  for (const cand of candidates) {
    totalWeight += Math.max(0, cand.frequency)
  }

  if (totalWeight <= 0) {
    const index = rng.rand(candidates.length)
    return candidates[index] ?? null
  }

  const roll = rng.rand(totalWeight)
  let acc = 0
  for (const cand of candidates) {
    acc += Math.max(0, cand.frequency)
    if (roll < acc) {
      return cand
    }
  }

  return candidates[candidates.length - 1] ?? null
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
])

/**
 * Rolls concrete values for all modifiers of a chosen affix using `rng.randRange(min, max)`.
 */
function rollAffixMods(affix: MagicAffix, rng: D2Rng): RolledMod[] {
  return affix.mods.map(mod => {
    const codeLower = mod.code.toLowerCase()
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
function createRolledAffix(affix: MagicAffix, rng: D2Rng): RolledAffix {
  const mods = rollAffixMods(affix, rng)
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
 * Rolls magic affixes for an item:
 * - 1 prefix slot + 1 suffix slot.
 * - Randomly choose: {prefix only}, {suffix only}, or {prefix + suffix}.
 * - Weighted selection by `frequency`.
 * - Group mutex: when an affix with `group > 0` is chosen, that group is excluded from subsequent rolls.
 * - Formats name as `[Prefix] [BaseName] [Suffix]`.
 *
 * @param base - Base item definition.
 * @param ilvl - Item level.
 * @param affixes - Tables containing prefix and suffix tables.
 * @param isA - Item type inheritance predicate.
 * @param rng - Unit PRNG instance (D2Rng).
 * @param options - Optional eligibility overrides (e.g. itemClass).
 * @returns Generated magic item affixes and metadata.
 */
export function rollMagicAffixes(
  base: ItemBase,
  ilvl: number,
  affixes: { prefixes: AffixTable; suffixes: AffixTable },
  isA: Function,
  rng: D2Rng,
  options?: { readonly itemClass?: string | undefined },
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
    ...(itemClass !== undefined ? { itemClass } : {}),
  }

  const usedGroups = new Set<number>()
  const usedAffixes = new Set<MagicAffix>()

  // Randomly choose {prefix only}, {suffix only}, or {prefix + suffix}
  // 0 = prefix only, 1 = suffix only, 2 = prefix + suffix
  const slotChoice = rng.rand(3)
  const wantsPrefix = slotChoice === 0 || slotChoice === 2
  const wantsSuffix = slotChoice === 1 || slotChoice === 2

  let rolledPrefix: RolledAffix | null = null
  let rolledSuffix: RolledAffix | null = null

  if (wantsPrefix) {
    const candidates = getEligibleCandidates(
      affixes.prefixes,
      itemTypeCode,
      predicate,
      eligibilityOpts,
      usedGroups,
      usedAffixes,
    )
    const picked = pickWeightedAffix(candidates, rng)
    if (picked) {
      usedAffixes.add(picked)
      if (picked.group > 0) {
        usedGroups.add(picked.group)
      }
      rolledPrefix = createRolledAffix(picked, rng)
    }
  }

  if (wantsSuffix) {
    const candidates = getEligibleCandidates(
      affixes.suffixes,
      itemTypeCode,
      predicate,
      eligibilityOpts,
      usedGroups,
      usedAffixes,
    )
    const picked = pickWeightedAffix(candidates, rng)
    if (picked) {
      usedAffixes.add(picked)
      if (picked.group > 0) {
        usedGroups.add(picked.group)
      }
      rolledSuffix = createRolledAffix(picked, rng)
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
 * Rolls rare affixes for an item:
 * - Up to 3 prefix + up to 3 suffix slots.
 * - Total affixes: 3 to 6 (at least 1 prefix and 1 suffix, max 3 each).
 * - Rare name: pick 1 eligible RarePrefix + 1 eligible RareSuffix.
 * - Mod values rolled using `itemRng.randRange(min, max)`.
 *
 * @param base - Base item definition.
 * @param ilvl - Item level.
 * @param affixes - Tables containing prefix and suffix tables.
 * @param rareNames - Tables containing rare prefix and suffix name tables.
 * @param isA - Item type inheritance predicate.
 * @param rng - Unit PRNG instance (D2Rng).
 * @param options - Optional eligibility overrides (e.g. itemClass).
 * @returns Generated rare item affixes and metadata.
 */
export function rollRareAffixes(
  base: ItemBase,
  ilvl: number,
  affixes: { prefixes: AffixTable; suffixes: AffixTable },
  rareNames: { prefixes: RareNameTable; suffixes: RareNameTable },
  isA: Function,
  rng: D2Rng,
  options?: { readonly itemClass?: string | undefined },
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

  // 2. Determine slot distribution (1.13c D2Game!6FC31350):
  // Total affixes: 3 to 6, rolled slot-by-slot with rng.rand(2) and max 3 prefixes / 3 suffixes
  const totalAffixes = rng.randRange(3, 6)

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
      const picked = pickWeightedAffix(candidates, rng)
      if (!picked) return false
      usedAffixes.add(picked)
      if (picked.group > 0) {
        usedGroups.add(picked.group)
      }
      rolledPrefixes.push(createRolledAffix(picked, rng))
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
      const picked = pickWeightedAffix(candidates, rng)
      if (!picked) return false
      usedAffixes.add(picked)
      if (picked.group > 0) {
        usedGroups.add(picked.group)
      }
      rolledSuffixes.push(createRolledAffix(picked, rng))
      return true
    }
  }

  for (let slot = 0; slot < totalAffixes; slot++) {
    let pickPrefix: boolean
    if (rolledPrefixes.length >= 3) {
      pickPrefix = false
    } else if (rolledSuffixes.length >= 3) {
      pickPrefix = true
    } else {
      pickPrefix = rng.rand(2) === 0
    }

    if (!tryRollSide(pickPrefix)) {
      tryRollSide(!pickPrefix)
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

