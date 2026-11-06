/**
 * Magic affix tables loader and eligibility system (`MagicPrefix.txt` & `MagicSuffix.txt`).
 *
 * In Diablo II (1.13c):
 * - MagicPrefix.txt: 670 raw rows - 32 empty Name - 1 Expansion = 637 real rows (587 spawnable=1).
 *   Columns: 41 (includes `etype1..etype5`).
 * - MagicSuffix.txt: 748 raw rows - 6 empty Name - 1 Expansion = 741 real rows (575 spawnable=1).
 *   Columns: 39 (only has `etype1..etype3`).
 * - Total: 1378 affixes (1162 spawnable=1).
 * - Name displays directly from the txt table (does NOT use string.tbl).
 */

import type { D2Table } from '../world/acts.ts'
import { parseTable } from '../world/acts.ts'
import type { MountedArchives } from '../mpq/mount.ts'

/** Canonical archive path for magic prefixes. */
export const MAGIC_PREFIX_TABLE_PATH = 'data\\global\\excel\\MagicPrefix.txt'

/** Canonical archive path for magic suffixes. */
export const MAGIC_SUFFIX_TABLE_PATH = 'data\\global\\excel\\MagicSuffix.txt'

/**
 * Modifier descriptor for a rolled affix.
 */
export interface AffixMod {
  readonly code: string
  readonly param?: string
  readonly min: number
  readonly max: number
}

/**
 * A single magic prefix or suffix record.
 */
export interface MagicAffix {
  /** 1-based compiled row index in MagicPrefix.txt / MagicSuffix.txt (D2Common.dll DATATBLS_CompileTxt 0x6fdaef40). */
  id?: number
  /** Affix name (direct display text, does NOT use string.tbl). */
  name: string
  /** True for prefixes, false for suffixes. */
  isPrefix: boolean
  /** Version flag (0 for Classic, 100 for Expansion). */
  version: number
  /** Whether this affix can naturally spawn. */
  spawnable: boolean
  /** Whether this affix can spawn on rare items. */
  rare: boolean
  /** Minimum required item quality level (qlvl). */
  level: number
  /** Maximum item level after which this affix will not spawn (0 if no limit). */
  maxlevel: number
  /** Character level requirement to use the item with this affix. */
  levelreq: number
  /** Class-specific restriction for prefixes (e.g. 'ama', 'sor', 'nec', etc.). */
  classspecific?: string
  /** Class-specific restriction for suffixes (e.g. 'sor', 'ama', etc.). */
  class?: string
  /** Class-specific level requirement. */
  classlevelreq?: number
  /** Frequency / spawn weight. */
  frequency: number
  /** Affix exclusivity group (only one affix from the same group can spawn). */
  group: number
  /** Rolled modifiers (up to 3 slots). */
  mods: AffixMod[]
  /** Whether this affix causes a color transformation on the item. */
  transform: boolean
  /** Color code for transformation (e.g. 'dgld', 'cblu'). */
  transformColor?: string
  /** Allowed item types (whitelist, up to 7 slots). */
  itypes: string[]
  /** Excluded item types (blacklist, up to 5 for prefix, up to 3 for suffix). */
  etypes: string[]
  /** Cost divisor. */
  divide?: number
  /** Cost multiplier. */
  multiply?: number
  /** Cost add amount. */
  add?: number
}

/** Options for filtering eligible magic affixes. */
export interface AffixEligibilityOptions {
  /** Affix level (alvl) of the item. */
  alvl?: number
  /** Whether the target item is rare. */
  isRare?: boolean
  /** Class-specific 3-letter class code for the target item (e.g. 'ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'; '' for generic). */
  readonly itemClass?: string | undefined
}

/**
 * Canonical 1.13c mapping from 3-letter class code to ItemTypes.txt class-specific type codes.
 */
export const CLASS_SPECIFIC_ITEM_TYPE_MAP: Readonly<Record<string, readonly string[]>> = {
  ama: ['amaz', 'abow', 'aspe', 'ajav'],
  sor: ['sorc', 'orb'],
  nec: ['necr', 'head'],
  pal: ['pala', 'ashd'],
  bar: ['barb', 'phlm'],
  dru: ['drui', 'pelt'],
  ass: ['assn', 'h2h', 'h2h2'],
}

/**
 * Infers the 3-letter class code ('ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass' | '')
 * for an `itemTypeCode` using `isA` hierarchy checks.
 */
export function inferItemClassFromType(
  itemTypeCode: string,
  isA?: (type: string, target: string) => boolean,
): string {
  const code = itemTypeCode.trim().toLowerCase()
  if (!code) return ''
  for (const [cls, targets] of Object.entries(CLASS_SPECIFIC_ITEM_TYPE_MAP)) {
    for (const target of targets) {
      if (code === target || (isA && isA(itemTypeCode, target))) {
        return cls
      }
    }
  }
  return ''
}

/**
 * Collection of magic affixes with grouped and indexed lookups.
 */
export interface AffixTable {
  /** All valid, non-empty, non-Expansion affixes in file order. */
  readonly all: MagicAffix[]
  /** Lookup map by 1-based compiled row id (matching D2GS packet affix id & D2Common.dll 0x6fdc1820). */
  readonly byId: ReadonlyMap<number, MagicAffix>
  /** Lookup map grouped by exact affix name. */
  readonly byName: Map<string, MagicAffix[]>
  /** Lookup map grouped by affix group number. */
  readonly byGroup: Map<number, MagicAffix[]>
  /** Whether this table contains prefixes (true) or suffixes (false). */
  readonly isPrefix: boolean
  /** Total number of affixes. */
  readonly length: number
  /** Get affix by 1-based compiled row id. */
  getById(id: number): MagicAffix | undefined
  /** Get all affixes matching name (case-insensitive fallback). */
  getByName(name: string): MagicAffix[]
  /** Get all affixes belonging to a group. */
  getByGroup(group: number): MagicAffix[]
  /** Filter eligible affixes for an item type. */
  getEligible(
    itemTypeCode: string,
    isA: (type: string, target: string) => boolean,
    options?: AffixEligibilityOptions,
  ): MagicAffix[]
  /** Iterable over all affixes. */
  [Symbol.iterator](): IterableIterator<MagicAffix>
}

/**
 * Tests whether a magic affix is eligible to spawn on an item of `itemTypeCode`.
 *
 * Checks:
 * 1. `affix.spawnable` must be true.
 * 2. If `options.isRare` is true, `affix.rare` must be true.
 * 3. If `options.alvl` is provided, `affix.level <= options.alvl` and (`affix.maxlevel === 0 || options.alvl <= affix.maxlevel`).
 * 4. If `affix.classspecific` is non-empty, the item's effective class (`options.itemClass` or inferred via `isA`) must match `affix.classspecific`.
 * 5. Item must NOT match any `etype` (`isA(itemTypeCode, etype) === true`).
 * 6. Item MUST match at least one `itype` (`isA(itemTypeCode, itype) === true`).
 *
 * @param affix - The magic affix to test.
 * @param itemTypeCode - Target item type code (e.g. 'swor', 'armo').
 * @param isA - Item type hierarchy predicate: `(type, target) => boolean`.
 * @param options - Optional filters (alvl, isRare, itemClass).
 * @returns `true` if the affix is eligible.
 */
export function isAffixEligible(
  affix: MagicAffix,
  itemTypeCode: string,
  isA: (type: string, target: string) => boolean,
  options?: AffixEligibilityOptions,
): boolean {
  // 1. Must be spawnable
  if (!affix.spawnable) {
    return false
  }

  // 2. Rare check: if options.isRare is true, affix.rare must be true
  if (options?.isRare && !affix.rare) {
    return false
  }

  // 3. Affix level check
  if (options?.alvl !== undefined) {
    if (affix.level > options.alvl) {
      return false
    }
    if (affix.maxlevel !== 0 && options.alvl > affix.maxlevel) {
      return false
    }
  }

  // 4. Class-specific restriction check (1.13c MagicPrefix.txt / MagicSuffix.txt `classspecific` column)
  const requiredClass = affix.classspecific?.trim().toLowerCase()
  if (requiredClass) {
    const effectiveItemClass =
      options?.itemClass !== undefined
        ? options.itemClass.trim().toLowerCase()
        : inferItemClassFromType(itemTypeCode, isA)
    if (effectiveItemClass !== requiredClass) {
      return false
    }
  }

  // 5. Blacklist check: item must NOT match any etype
  if (affix.etypes.length > 0 && affix.etypes.some(etype => isA(itemTypeCode, etype))) {
    return false
  }

  // 6. Whitelist check: item MUST match at least one itype
  if (affix.itypes.length === 0 || !affix.itypes.some(itype => isA(itemTypeCode, itype))) {
    return false
  }

  return true
}

/**
 * Construct an AffixTable wrapper around an array of MagicAffix entries.
 */
function createAffixTable(all: MagicAffix[], isPrefix: boolean): AffixTable {
  const byId = new Map<number, MagicAffix>()
  const byName = new Map<string, MagicAffix[]>()
  const byGroup = new Map<number, MagicAffix[]>()

  for (let idx = 0; idx < all.length; idx++) {
    const affix = all[idx]!
    const compiledId = typeof affix.id === 'number' && affix.id > 0 ? affix.id : idx + 1
    byId.set(compiledId, affix)

    // Index by name
    let nameList = byName.get(affix.name)
    if (!nameList) {
      nameList = []
      byName.set(affix.name, nameList)
    }
    nameList.push(affix)

    // Index by group
    let groupList = byGroup.get(affix.group)
    if (!groupList) {
      groupList = []
      byGroup.set(affix.group, groupList)
    }
    groupList.push(affix)
  }

  return {
    all,
    byId,
    byName,
    byGroup,
    isPrefix,
    get length(): number {
      return all.length
    },
    getById(id: number): MagicAffix | undefined {
      return byId.get(id)
    },
    getByName(name: string): MagicAffix[] {
      const direct = byName.get(name)
      if (direct) return direct
      const lower = name.trim().toLowerCase()
      for (const [k, v] of byName.entries()) {
        if (k.toLowerCase() === lower) return v
      }
      return []
    },
    getByGroup(group: number): MagicAffix[] {
      return byGroup.get(group) ?? []
    },
    getEligible(
      itemTypeCode: string,
      isA: (type: string, target: string) => boolean,
      options?: AffixEligibilityOptions,
    ): MagicAffix[] {
      return all.filter(affix => isAffixEligible(affix, itemTypeCode, isA, options))
    },
    [Symbol.iterator](): IterableIterator<MagicAffix> {
      return all[Symbol.iterator]()
    },
  }
}

/**
 * Parse a D2Table (or Uint8Array / TSV string) into an AffixTable.
 *
 * Filters out:
 * - Rows where Name is empty (trimmed) from `all`, while still incrementing the 1-based compiled row `id`
 *   per D2Common.dll DATATBLS_CompileTxt (0x6fdaef40) & DATATBLS_GetMagicAffixTxtRecord (0x6fdc1820).
 * - Rows where Name is 'Expansion' (case-insensitive)
 *
 * @param table - Raw tab-separated D2Table, raw Uint8Array, or TSV string.
 * @param isPrefix - True if parsing MagicPrefix.txt, false if parsing MagicSuffix.txt.
 * @returns The parsed AffixTable.
 */
export function parseMagicAffixesTable(table: D2Table, isPrefix: boolean): AffixTable
export function parseMagicAffixesTable(bytes: Uint8Array, isPrefix: boolean): AffixTable
export function parseMagicAffixesTable(tsv: string, isPrefix: boolean): AffixTable
export function parseMagicAffixesTable(
  input: D2Table | Uint8Array | string,
  isPrefix: boolean,
): AffixTable {
  let table: D2Table
  if (typeof input === 'string') {
    table = parseTable(new TextEncoder().encode(input.trim()))
  } else if (input instanceof Uint8Array) {
    table = parseTable(input)
  } else {
    table = input
  }

  const headerMap = new Map<string, number>()
  table.header.forEach((h, idx) => {
    headerMap.set(h.trim().toLowerCase(), idx)
  })

  const getCell = (row: readonly string[], col: string): string => {
    const idx = headerMap.get(col.toLowerCase())
    if (idx === undefined) return ''
    return (row[idx] ?? '').trim()
  }

  const all: MagicAffix[] = []
  let compiledId = 0

  for (const row of table.rows) {
    const name = getCell(row, 'name')
    // D2Common.dll DATATBLS_CompileTxt (0x6fdaef40) drops ONLY 'Expansion' separator rows;
    // empty-Name rows still occupy a 1-based compiled index in sgptDataTables->pMagicAffixDataTables.
    if (name.toLowerCase() === 'expansion') {
      continue
    }
    compiledId++
    if (!name) {
      continue
    }

    const rawVersion = getCell(row, 'version')
    const version = rawVersion ? Number.parseInt(rawVersion, 10) : 0
    const spawnable = getCell(row, 'spawnable') === '1'
    const rare = getCell(row, 'rare') === '1'
    const rawLevel = getCell(row, 'level')
    const level = rawLevel ? Number.parseInt(rawLevel, 10) : 0
    const rawMaxLevel = getCell(row, 'maxlevel')
    const maxlevel = rawMaxLevel ? Number.parseInt(rawMaxLevel, 10) : 0
    const rawLevelReq = getCell(row, 'levelreq')
    const levelreq = rawLevelReq ? Number.parseInt(rawLevelReq, 10) : 0

    const classspecific = getCell(row, 'classspecific') || undefined
    const cls = getCell(row, 'class') || undefined
    const rawClr = getCell(row, 'classlevelreq')
    const classlevelreq = rawClr ? Number.parseInt(rawClr, 10) : undefined

    const rawFreq = getCell(row, 'frequency')
    const frequency = rawFreq ? Number.parseInt(rawFreq, 10) : 0
    const rawGroup = getCell(row, 'group')
    const group = rawGroup ? Number.parseInt(rawGroup, 10) : 0

    const mods: AffixMod[] = []
    for (let slot = 1; slot <= 3; slot++) {
      const code = getCell(row, `mod${slot}code`)
      if (code) {
        const rawParam = getCell(row, `mod${slot}param`)
        const param = rawParam !== '' ? rawParam : undefined
        const rawMin = getCell(row, `mod${slot}min`)
        const rawMax = getCell(row, `mod${slot}max`)
        const min = rawMin !== '' ? Number.parseInt(rawMin, 10) : 0
        const max = rawMax !== '' ? Number.parseInt(rawMax, 10) : min
        mods.push({
          code,
          ...(param !== undefined ? { param } : {}),
          min,
          max,
        })
      }
    }

    const transform = getCell(row, 'transform') === '1'
    const transformColor = getCell(row, 'transformcolor') || undefined

    const itypes: string[] = []
    for (let slot = 1; slot <= 7; slot++) {
      const itype = getCell(row, `itype${slot}`)
      if (itype) {
        itypes.push(itype)
      }
    }

    const etypes: string[] = []
    for (let slot = 1; slot <= 5; slot++) {
      const etype = getCell(row, `etype${slot}`)
      if (etype) {
        etypes.push(etype)
      }
    }

    const rawDivide = getCell(row, 'divide')
    const rawMultiply = getCell(row, 'multiply')
    const rawAdd = getCell(row, 'add')
    const divide = rawDivide !== '' ? Number.parseInt(rawDivide, 10) : undefined
    const multiply = rawMultiply !== '' ? Number.parseInt(rawMultiply, 10) : undefined
    const add = rawAdd !== '' ? Number.parseInt(rawAdd, 10) : undefined

    all.push({
      id: compiledId,
      name,
      isPrefix,
      version,
      spawnable,
      rare,
      level,
      maxlevel,
      levelreq,
      ...(classspecific !== undefined ? { classspecific } : {}),
      ...(cls !== undefined ? { class: cls } : {}),
      ...(classlevelreq !== undefined ? { classlevelreq } : {}),
      frequency,
      group,
      mods,
      transform,
      ...(transformColor !== undefined ? { transformColor } : {}),
      itypes,
      etypes,
      ...(divide !== undefined ? { divide } : {}),
      ...(multiply !== undefined ? { multiply } : {}),
      ...(add !== undefined ? { add } : {}),
    })
  }

  return createAffixTable(all, isPrefix)
}

/**
 * Safely read a file from mounted MPQ archives with forward/backward slash normalization.
 */
async function readMpqFile(archives: MountedArchives, primaryPath: string): Promise<Uint8Array> {
  const normalized = primaryPath.replace(/\\/g, '/')
  const backslashed = primaryPath.replace(/\//g, '\\')
  const candidates = [
    primaryPath,
    backslashed,
    normalized,
    backslashed.toLowerCase(),
    normalized.toLowerCase(),
  ]
  for (const p of candidates) {
    if (archives.has(p)) {
      return archives.read(p)
    }
  }
  return archives.read(primaryPath)
}

/**
 * Loads both `MagicPrefix.txt` and `MagicSuffix.txt` from mounted MPQ archives.
 *
 * @param archives - Mounted MPQ archives.
 * @returns An object containing parsed `prefixes` and `suffixes` AffixTables.
 */
export async function loadMagicAffixes(archives: MountedArchives): Promise<{
  prefixes: AffixTable
  suffixes: AffixTable
}> {
  const [prefixBytes, suffixBytes] = await Promise.all([
    readMpqFile(archives, MAGIC_PREFIX_TABLE_PATH),
    readMpqFile(archives, MAGIC_SUFFIX_TABLE_PATH),
  ])
  return {
    prefixes: parseMagicAffixesTable(parseTable(prefixBytes), true),
    suffixes: parseMagicAffixesTable(parseTable(suffixBytes), false),
  }
}
