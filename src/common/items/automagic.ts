/**
 * AutoMagic: item auto-affixes loaded from AutoMagic.txt.
 *
 * In Diablo II, certain item classes (e.g. Amazon weapons, Sorceress orbs,
 * Paladin shields, Necromancer heads) can spawn with "built-in" magical affixes
 * even as white (normal) items, based on the `auto prefix` group defined in
 * `weapons.txt` and `armor.txt`.
 *
 * In `.d2s` character saves, the `autoAffixId` is an 11-bit index referencing the
 * exact row index (0..35) in `AutoMagic.txt`. Therefore, row order and indices
 * must be strictly preserved without filtering or reordering.
 */
import { parseTable } from '../world/acts.ts'
import type { D2Table } from '../world/acts.ts'
import type { MountedArchives } from '../mpq/mount.ts'
import type { ItemBase, RolledItemProp } from './items.ts'
import { D2Rng } from '../rng/d2-rng.ts'
import type { ItemTypeTable } from './item-types.ts'
import {
  calculateAlvl,
  getItemTypeCode,
  getBaseQlvl,
  getBaseMagicLvl,
  NON_RANDOM_RANGE_CODES,
} from './affix-generator.ts'

/** One modifier on an AutoMagic entry. */
export interface AutoMagicMod {
  readonly code: string
  readonly param?: string
  readonly min: number
  readonly max: number
}

/** One record from AutoMagic.txt, preserving its exact row index as id. */
export interface AutoMagicEntry {
  /** Row index 0..35, matching .d2s autoAffixId. */
  readonly id: number
  /** Affix name (e.g. "Fletcher's", "of the Jackal"). */
  readonly name: string
  /** Version (100 for LoD). */
  readonly version: number
  /** Whether the automagic is spawnable (all 1 in 1.13c). */
  readonly spawnable: boolean
  /** Whether the automagic can spawn on rare items. */
  readonly rare: boolean
  /** Minimum item level required. */
  readonly level: number
  /** Maximum item level after which it will not spawn (0 if no limit). */
  readonly maxlevel: number
  /** Required character level to use. */
  readonly levelreq: number
  /** Class-specific restriction (e.g. "ama", "sor"), if any. */
  readonly class?: string
  /** Level requirement for that specific class, if any. */
  readonly classlevelreq?: number
  /** Spawn frequency / weight. */
  readonly frequency: number
  /** Auto prefix group (e.g. 300..305). */
  readonly group: number
  /** Rolled modifiers (up to 3). */
  readonly mods: AutoMagicMod[]
  /** Whether this automagic performs a color shift on the item. */
  readonly transform: boolean
  /** Color code for color shift (e.g. "cblu", "dgld"). */
  readonly transformColor?: string
  /** Allowed item types (itype1..7). */
  readonly itypes: string[]
  /** Excluded item types (etype1..3). */
  readonly etypes: string[]
  /** Price divide factor. */
  readonly divide?: number
  /** Price multiply factor. */
  readonly multiply?: number
  /** Price add factor. */
  readonly add?: number
}

/** Predicate checking whether an item type is or inherits from target type. */
export type IsAPredicate = (typeCode: string, targetType: string) => boolean

/** Options for filtering eligible AutoMagic affixes. */
export interface EligibleAutoMagicOptions {
  /** Filter to a specific auto-prefix group (e.g. 300..305). */
  readonly group?: number
  /** Whether the item is rare (if true, excludes entries where rare is false). */
  readonly rare?: boolean
  /** Specific character class (e.g. "ama", "sor"). */
  readonly class?: string
  /** AutoMagic table or entries to query from. */
  readonly table?: AutoMagicTable | readonly AutoMagicEntry[]
}

/** A collection of AutoMagic entries with fast id lookup and eligibility helpers. */
export interface AutoMagicTable {
  /** Every AutoMagic entry in exact row order (indices 0..35). */
  readonly entries: readonly AutoMagicEntry[]
  /** Fast lookup by row index / autoAffixId. */
  readonly byId: ReadonlyMap<number, AutoMagicEntry>
  /** Underlying D2Table, if loaded from one. */
  readonly table?: D2Table
  /** Get entry by row id (0..35). */
  get(id: number): AutoMagicEntry | undefined
  /** Filter eligible automagics for an item type and level. */
  getEligible(
    typeCode: string,
    alvl: number,
    isAOrRare?: IsAPredicate | boolean,
    options?: EligibleAutoMagicOptions,
  ): AutoMagicEntry[]
  /** Allow iteration over all entries. */
  [Symbol.iterator](): IterableIterator<AutoMagicEntry>
  /** Number of entries. */
  readonly length: number
  /** Alias for entries. */
  readonly rows: readonly AutoMagicEntry[]
  /** Direct index access. */
  readonly [index: number]: AutoMagicEntry | undefined
}

/** 1.13c gold standard AutoMagic.txt embedded TSV data. */
export const CANONICAL_AUTOMAGIC_TSV = `Name\tversion\tspawnable\trare\tlevel\tmaxlevel\tlevelreq\tclass\tclasslevelreq\tfrequency\tgroup\tmod1code\tmod1param\tmod1min\tmod1max\tmod2code\tmod2param\tmod2min\tmod2max\tmod3code\tmod3param\tmod3min\tmod3max\ttransform\ttransformcolor\titype1\titype2\titype3\titype4\titype5\titype6\titype7\tetype1\tetype2\tetype3\tdivide\tmultiply\tadd
Fletcher's\t100\t1\t1\t1\t\t15\t\t\t3\t300\tskilltab\t0\t1\t1\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Bowyer's\t100\t1\t1\t40\t\t30\t\t\t2\t300\tskilltab\t0\t2\t2\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Archer's\t100\t1\t\t60\t\t45\t\t\t1\t300\tskilltab\t0\t3\t3\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Acrobat's\t100\t1\t1\t1\t\t15\t\t\t3\t301\tskilltab\t1\t1\t1\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Gymnast's\t100\t1\t1\t40\t\t30\t\t\t2\t301\tskilltab\t1\t2\t2\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Athlete's\t100\t1\t\t60\t\t45\t\t\t1\t301\tskilltab\t1\t3\t3\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Harpoonist's\t100\t1\t1\t1\t\t15\t\t\t3\t302\tskilltab\t2\t1\t1\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Spearmaiden's\t100\t1\t1\t40\t\t30\t\t\t2\t302\tskilltab\t2\t2\t2\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Lancer's\t100\t1\t\t60\t\t45\t\t\t1\t302\tskilltab\t2\t3\t3\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
of the Jackal\t100\t1\t1\t1\t\t3\t\t\t6\t303\thp\t\t1\t5\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
of the Fox\t100\t1\t1\t11\t\t8\t\t\t5\t303\thp\t\t6\t10\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
of the Wolf\t100\t1\t1\t27\t\t20\t\t\t4\t303\thp\t\t11\t20\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
of the Tiger\t100\t1\t1\t43\t\t35\t\t\t3\t303\thp\t\t21\t30\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
of the Mammoth\t100\t1\t1\t59\t\t51\t\t\t2\t303\thp\t\t31\t40\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
of the Colossus\t100\t1\t\t75\t\t67\t\t\t1\t303\thp\t\t41\t60\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Lizard's\t100\t1\t1\t3\t\t2\t\t\t4\t303\tmana\t\t1\t5\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Snake's\t100\t1\t1\t12\t\t9\t\t\t3\t303\tmana\t\t5\t10\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Serpent's\t100\t1\t1\t23\t\t16\t\t\t2\t303\tmana\t\t11\t20\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Drake's\t100\t1\t1\t34\t\t26\t\t\t2\t303\tmana\t\t21\t30\t\t\t\t\t\t\t\t\t1\tcblu\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Dragon's\t100\t1\t1\t45\t\t37\t\t\t1\t303\tmana\t\t31\t40\t\t\t\t\t\t\t\t\t1\tcblu\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Wyrm's\t100\t1\t1\t56\t\t48\t\t\t1\t303\tmana\t\t41\t60\t\t\t\t\t\t\t\t\t1\tcblu\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Great Wyrm's\t100\t1\t\t67\t\t59\t\t\t1\t303\tmana\t\t61\t80\t\t\t\t\t\t\t\t\t1\tcblu\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Shimmering\t100\t1\t1\t1\t\t3\t\t\t8\t304\tres-all\t\t5\t10\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Rainbow\t100\t1\t1\t18\t\t13\t\t\t7\t304\tres-all\t\t8\t15\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Scintillating\t100\t1\t1\t28\t\t21\t\t\t6\t304\tres-all\t\t16\t30\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Prismatic\t100\t1\t1\t39\t\t31\t\t\t5\t304\tres-all\t\t25\t35\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Chromatic\t100\t1\t\t50\t\t42\t\t\t4\t304\tres-all\t\t35\t45\t\t\t\t\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Sharp\t100\t1\t1\t10\t\t5\t\t\t3\t304\tatt\t\t15\t30\tdmg%\t\t10\t20\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Fine\t100\t1\t1\t18\t\t13\t\t\t3\t304\tatt\t\t31\t60\tdmg%\t\t21\t30\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Warrior's\t100\t1\t1\t30\t\t23\t\t\t2\t304\tatt\t\t61\t80\tdmg%\t\t31\t40\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Soldier's\t100\t1\t1\t42\t\t34\t\t\t2\t304\tatt\t\t81\t100\tdmg%\t\t41\t50\t\t\t\t\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
Knight's\t100\t1\t1\t50\t\t42\t\t\t2\t304\tatt\t\t101\t121\tdmg%\t\t51\t65\t\t\t\t\t1\tdgld\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
of Blight\t100\t1\t1\t1\t\t3\t\t\t3\t305\tpois-min\t\t8\t8\tpois-max\t\t24\t24\tpois-len\t\t75\t75\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
of Venom\t100\t1\t1\t15\t\t11\t\t\t2\t305\tpois-min\t\t16\t16\tpois-max\t\t48\t48\tpois-len\t\t75\t75\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
of Pestilence\t100\t1\t1\t25\t\t18\t\t\t2\t305\tpois-min\t\t32\t32\tpois-max\t\t72\t72\tpois-len\t\t100\t100\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0
of Anthrax\t100\t1\t\t33\t\t25\t\t\t2\t305\tpois-min\t\t64\t64\tpois-max\t\t128\t128\tpois-len\t\t100\t100\t\t\tarmo\tweap\t\t\t\t\t\t\t\t\t0\t0\t0`

const DEFAULT_AUTOMAGIC_ISA: IsAPredicate = (typeCode, targetType) => {
  if (typeCode === targetType) return true
  if (targetType === 'armo') {
    return ['armo', 'ashd', 'head', 'phlm', 'pelt', 'circ', 'tors', 'shie', 'helm'].includes(typeCode)
  }
  if (targetType === 'weap') {
    return ['weap', 'abow', 'aspe', 'ajav', 'orb', 'wand', 'scep', 'staf', 'h2h', 'h2h2'].includes(typeCode)
  }
  return false
}

function createAutoMagicTable(entries: AutoMagicEntry[], table?: D2Table): AutoMagicTable {
  const byId = new Map<number, AutoMagicEntry>()
  for (const entry of entries) {
    byId.set(entry.id, entry)
  }
  const result: any = {
    entries,
    rows: entries,
    byId,
    table,
    get: (id: number) => byId.get(id),
    getEligible: (
      typeCode: string,
      alvl: number,
      isAOrRare?: IsAPredicate | boolean,
      options?: EligibleAutoMagicOptions,
    ) => {
      const isA = typeof isAOrRare === 'function' ? isAOrRare : DEFAULT_AUTOMAGIC_ISA
      const inferredGroup = ITEM_TYPE_AUTO_PREFIX_MAP[typeCode.trim().toLowerCase()]
      const mergedOptions: EligibleAutoMagicOptions = {
        ...(typeof isAOrRare === 'boolean' ? { rare: isAOrRare } : {}),
        ...(typeof isAOrRare !== 'function' && inferredGroup !== undefined ? { group: inferredGroup } : {}),
        ...options,
      }
      return filterEligibleAutoMagic(entries, typeCode, alvl, isA, mergedOptions)
    },
    [Symbol.iterator]: () => entries[Symbol.iterator](),
  }
  Object.defineProperty(result, 'length', {
    get: () => entries.length,
    enumerable: true,
  })
  for (let i = 0; i < entries.length; i++) {
    result[i] = entries[i]
  }
  return result as AutoMagicTable
}

/** Pre-parsed canonical 1.13c AutoMagic table. */
export const CANONICAL_AUTOMAGIC_TABLE: AutoMagicTable = parseAutoMagicTable(
  parseTable(new TextEncoder().encode(CANONICAL_AUTOMAGIC_TSV.trim())),
)

/**
 * Parse a D2Table (or Uint8Array/string) into an AutoMagicTable.
 *
 * Preserves the exact row order (indices 0..35) to maintain 1:1 parity with
 * .d2s autoAffixId references.
 *
 * @param table - the tab-separated D2Table.
 * @returns the parsed AutoMagicTable.
 */
export function parseAutoMagicTable(table: D2Table): AutoMagicTable
export function parseAutoMagicTable(bytes: Uint8Array): AutoMagicTable
export function parseAutoMagicTable(tsv: string): AutoMagicTable
export function parseAutoMagicTable(input: D2Table | Uint8Array | string): AutoMagicTable {
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
  if (!headerMap.has('name') || !headerMap.has('group')) {
    throw new Error('Invalid AutoMagic.txt header: missing required Name or group columns')
  }

  const getCell = (row: readonly string[], col: string): string => {
    const idx = headerMap.get(col.toLowerCase())
    if (idx === undefined) return ''
    return (row[idx] ?? '').trim()
  }

  const entries: AutoMagicEntry[] = []

  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i]!
    const name = getCell(row, 'name')
    if (!name || name.toLowerCase() === 'expansion') continue
    const rawVersion = getCell(row, 'version')
    const version = rawVersion ? Number.parseInt(rawVersion, 10) : 100
    const rawSpawnable = getCell(row, 'spawnable')
    const spawnable = rawSpawnable === '1'
    const rawRare = getCell(row, 'rare')
    const rare = rawRare === '1'
    const rawLevel = getCell(row, 'level')
    const level = rawLevel ? Number.parseInt(rawLevel, 10) : 0
    const rawMaxLevel = getCell(row, 'maxlevel')
    const maxlevel = rawMaxLevel ? Number.parseInt(rawMaxLevel, 10) : 0
    const rawLevelReq = getCell(row, 'levelreq')
    const levelreq = rawLevelReq ? Number.parseInt(rawLevelReq, 10) : 0

    const cls = getCell(row, 'class') || undefined
    const rawClassLevelReq = getCell(row, 'classlevelreq')
    const classlevelreq = rawClassLevelReq ? Number.parseInt(rawClassLevelReq, 10) : undefined

    const rawFreq = getCell(row, 'frequency')
    const frequency = rawFreq ? Number.parseInt(rawFreq, 10) : 0
    const rawGroup = getCell(row, 'group')
    const group = rawGroup ? Number.parseInt(rawGroup, 10) : 0

    const mods: AutoMagicMod[] = []
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

    const rawTransform = getCell(row, 'transform')
    const transform = rawTransform === '1'
    const transformColor = getCell(row, 'transformcolor') || undefined

    const itypes: string[] = []
    for (let slot = 1; slot <= 7; slot++) {
      const itype = getCell(row, `itype${slot}`)
      if (itype) itypes.push(itype)
    }

    const etypes: string[] = []
    for (let slot = 1; slot <= 3; slot++) {
      const etype = getCell(row, `etype${slot}`)
      if (etype) etypes.push(etype)
    }

    const rawDivide = getCell(row, 'divide')
    const rawMultiply = getCell(row, 'multiply')
    const rawAdd = getCell(row, 'add')
    const divide = rawDivide !== '' ? Number.parseInt(rawDivide, 10) : 0
    const multiply = rawMultiply !== '' ? Number.parseInt(rawMultiply, 10) : 0
    const add = rawAdd !== '' ? Number.parseInt(rawAdd, 10) : 0

    entries.push({
      id: entries.length,
      name,
      version,
      spawnable,
      rare,
      level,
      maxlevel,
      levelreq,
      ...(cls !== undefined ? { class: cls } : {}),
      ...(classlevelreq !== undefined ? { classlevelreq } : {}),
      frequency,
      group,
      mods,
      transform,
      ...(transformColor !== undefined ? { transformColor } : {}),
      itypes,
      etypes,
      divide,
      multiply,
      add,
    })
  }

  return createAutoMagicTable(entries, table)
}

/**
 * Load AutoMagic.txt from mounted MPQ archives.
 *
 * @param archives - mounted MPQ archives.
 * @returns the parsed AutoMagicTable.
 */
export async function loadAutoMagic(archives: MountedArchives): Promise<AutoMagicTable> {
  const candidatePaths = [
    'data/global/excel/AutoMagic.txt',
    'data\\global\\excel\\AutoMagic.txt',
    'data/global/excel/automagic.txt',
    'data\\global\\excel\\automagic.txt',
  ]
  let bytes: Uint8Array | undefined
  for (const p of candidatePaths) {
    if (archives.has(p)) {
      bytes = await archives.read(p)
      break
    }
  }
  if (!bytes) {
    bytes = await archives.read('data/global/excel/AutoMagic.txt')
  }
  return parseAutoMagicTable(parseTable(bytes))
}

function filterEligibleAutoMagic(
  entries: readonly AutoMagicEntry[],
  typeCode: string,
  alvl: number,
  isA: IsAPredicate,
  options?: EligibleAutoMagicOptions,
): AutoMagicEntry[] {
  return entries.filter(entry => {
    // 1. Must be spawnable
    if (!entry.spawnable) return false

    // 2. Minimum affix level requirement
    if (entry.level > alvl) return false

    // 3. Maximum affix level limit
    if (entry.maxlevel > 0 && alvl > entry.maxlevel) return false

    // 4. Rare check: rare items exclude non-rare affixes
    if (options?.rare && !entry.rare) return false

    // 5. Group filter (e.g. 300 for Amazon bows, 304 for Paladin shields)
    if (options?.group !== undefined && entry.group !== options.group) return false

    // 6. Class check if entry requires specific class
    if (entry.class && options?.class && entry.class !== options.class) return false

    // 7. Exclusion types (etype1..3)
    if (entry.etypes.length > 0 && entry.etypes.some(etype => etype === typeCode || isA(typeCode, etype))) {
      return false
    }

    // 8. Inclusion types (itype1..7)
    if (entry.itypes.length > 0 && !entry.itypes.some(itype => itype === typeCode || isA(typeCode, itype))) {
      return false
    }

    return true
  })
}

/**
 * Filter eligible AutoMagic entries for a given item type code and affix level.
 *
 * Supports flexible invocations:
 * - `getEligibleAutoMagic(typeCode, alvl, isA, options?)`
 * - `getEligibleAutoMagic(typeCode, alvl, isA, table, options?)`
 * - `getEligibleAutoMagic(table, typeCode, alvl, isA, options?)`
 */
export function getEligibleAutoMagic(
  typeCode: string,
  alvl: number,
  isA: IsAPredicate,
  tableOrOptionsOrGroup?: AutoMagicTable | readonly AutoMagicEntry[] | EligibleAutoMagicOptions | number | boolean,
  options?: EligibleAutoMagicOptions,
): AutoMagicEntry[]
export function getEligibleAutoMagic(
  table: AutoMagicTable | readonly AutoMagicEntry[],
  typeCode: string,
  alvl: number,
  isA: IsAPredicate,
  options?: EligibleAutoMagicOptions,
): AutoMagicEntry[]
export function getEligibleAutoMagic(
  first: string | AutoMagicTable | readonly AutoMagicEntry[],
  second: number | string,
  third: IsAPredicate | number,
  fourth?: AutoMagicTable | readonly AutoMagicEntry[] | EligibleAutoMagicOptions | number | boolean | IsAPredicate,
  fifth?: EligibleAutoMagicOptions,
): AutoMagicEntry[] {
  let entries: readonly AutoMagicEntry[] = CANONICAL_AUTOMAGIC_TABLE.entries
  let typeCode: string
  let alvl: number
  let isA: IsAPredicate
  let options: EligibleAutoMagicOptions | undefined

  if (typeof first === 'string') {
    typeCode = first
    alvl = second as number
    isA = third as IsAPredicate

    if (typeof fourth === 'number') {
      options = { group: fourth, ...fifth }
    } else if (typeof fourth === 'boolean') {
      options = { rare: fourth, ...fifth }
    } else if (Array.isArray(fourth)) {
      entries = fourth
      options = fifth
    } else if (fourth && typeof fourth === 'object') {
      if ('entries' in fourth) {
        entries = (fourth as AutoMagicTable).entries
        options = fifth
      } else if ('table' in fourth && fourth.table) {
        const t = fourth.table
        entries = Array.isArray(t) ? t : (t as AutoMagicTable).entries
        options = fourth as EligibleAutoMagicOptions
      } else {
        options = fourth as EligibleAutoMagicOptions
      }
    } else {
      options = fifth
    }
  } else {
    entries = Array.isArray(first) ? first : (first as AutoMagicTable).entries
    typeCode = second as string
    alvl = third as number
    isA = fourth as IsAPredicate
    options = fifth
  }

  return filterEligibleAutoMagic(entries, typeCode, alvl, isA, options)
}

/** Concrete rolled modifier from an AutoMagic entry. */
export interface RolledAutoMagicMod {
  readonly code: string
  readonly param?: string | undefined
  readonly min: number
  readonly max: number
  readonly value: number
}

/** Concrete rolled AutoMagic affix on an item. */
export interface RolledAutoMagic {
  readonly entry: AutoMagicEntry
  readonly id: number
  readonly name: string
  readonly group: number
  readonly level: number
  readonly levelreq: number
  readonly mods: readonly RolledAutoMagicMod[]
}

/**
 * Fallback mapping from 1.13c item type code to AutoMagic group (Armor.txt & Weapons.txt `auto prefix` column).
 * - `abow`: 300 (Amazon Bow -> Bow & Crossbow Skills)
 * - `aspe`: 302 (Amazon Spear -> Javelin & Spear Skills)
 * - `ajav`: 302 (Amazon Javelin -> Javelin & Spear Skills)
 * - `orb`:  303 (Sorceress Orb -> Life / Mana)
 * - `ashd`: 304 (Paladin Shield -> All Resistances / Enhanced Damage & Attack Rating)
 * - `head`: 305 (Necromancer Shrunken Head -> Poison Damage)
 */
export const ITEM_TYPE_AUTO_PREFIX_MAP: Readonly<Record<string, number>> = {
  abow: 300,
  aspe: 302,
  ajav: 302,
  orb: 303,
  ashd: 304,
  head: 305,
}

/**
 * Resolves the AutoMagic group (`auto prefix`, e.g. 300..305) for an item base.
 */
export function resolveAutoPrefixGroup(
  base: ItemBase,
  itemTypes?: ItemTypeTable,
  isA?: IsAPredicate,
): number | undefined {
  const explicit = (base as any).autoPrefix
  if (typeof explicit === 'number' && explicit > 0) {
    return explicit
  }

  const typeCode = getItemTypeCode(base).trim().toLowerCase()
  if (ITEM_TYPE_AUTO_PREFIX_MAP[typeCode] !== undefined) {
    return ITEM_TYPE_AUTO_PREFIX_MAP[typeCode]
  }

  if (base.tags) {
    for (const tag of base.tags) {
      const t = tag.trim().toLowerCase()
      if (ITEM_TYPE_AUTO_PREFIX_MAP[t] !== undefined) {
        return ITEM_TYPE_AUTO_PREFIX_MAP[t]
      }
    }
  }

  if (itemTypes) {
    const visited = new Set<string>()
    const queue: string[] = [typeCode, ...(base.tags ?? [])]
    while (queue.length > 0) {
      const curr = queue.shift()!.trim().toLowerCase()
      if (!curr || visited.has(curr)) continue
      visited.add(curr)
      if (ITEM_TYPE_AUTO_PREFIX_MAP[curr] !== undefined) {
        return ITEM_TYPE_AUTO_PREFIX_MAP[curr]
      }
      const def = itemTypes.byCode.get(curr)
      if (!def) continue
      if (def.equiv1) queue.push(def.equiv1)
      if (def.equiv2) queue.push(def.equiv2)
    }
  }

  if (isA) {
    for (const [candidateType, grp] of Object.entries(ITEM_TYPE_AUTO_PREFIX_MAP)) {
      if (isA(typeCode, candidateType)) {
        return grp
      }
    }
  }

  return undefined
}

/**
 * Rolls an innate AutoMagic affix for a class-specific item base (D2Common!Items).
 */
export function rollAutoMagic(
  base: ItemBase,
  ilvl: number,
  tableOrIsA?: AutoMagicTable | IsAPredicate,
  isAOrRng?: IsAPredicate | D2Rng,
  rngOrOptions?: D2Rng | { readonly group?: number | undefined; readonly isRare?: boolean | undefined },
  maybeOptions?: { readonly group?: number | undefined; readonly isRare?: boolean | undefined },
): RolledAutoMagic | null {
  let table: AutoMagicTable = CANONICAL_AUTOMAGIC_TABLE
  let isA: IsAPredicate = (a, b) => a === b
  let rng: D2Rng = new D2Rng(1)
  let options: { readonly group?: number | undefined; readonly isRare?: boolean | undefined } | undefined

  if (typeof tableOrIsA === 'function') {
    isA = tableOrIsA
    if (isAOrRng instanceof D2Rng) {
      rng = isAOrRng
    }
    if (rngOrOptions && !(rngOrOptions instanceof D2Rng)) {
      options = rngOrOptions
    } else {
      options = maybeOptions
    }
  } else {
    if (tableOrIsA) {
      table = tableOrIsA
    }
    if (typeof isAOrRng === 'function') {
      isA = isAOrRng
    }
    if (rngOrOptions instanceof D2Rng) {
      rng = rngOrOptions
    }
    options = maybeOptions
  }

  const group = options?.group ?? resolveAutoPrefixGroup(base, undefined, isA)
  if (!group || group <= 0) {
    return null
  }

  const qlvl = getBaseQlvl(base)
  const magicLvl = getBaseMagicLvl(base)
  const alvl = calculateAlvl(ilvl, qlvl, magicLvl)
  const typeCode = getItemTypeCode(base).trim().toLowerCase()

  const effectiveIsA: IsAPredicate = (child, parent) => {
    if (child === parent) return true
    if (isA(child, parent)) return true
    if (base.kind === 'armor' && parent === 'armo') return true
    if (base.kind === 'weapon' && parent === 'weap') return true
    if (base.tags?.some(t => t.toLowerCase() === parent.toLowerCase())) return true
    return false
  }

  const candidates = getEligibleAutoMagic(table, typeCode, alvl, effectiveIsA, {
    group,
    rare: Boolean(options?.isRare),
  })

  if (candidates.length === 0) {
    return null
  }

  let totalWeight = 0
  for (const c of candidates) {
    totalWeight += Math.max(0, c.frequency)
  }

  let picked: AutoMagicEntry = candidates[candidates.length - 1]!
  if (totalWeight <= 0) {
    picked = candidates[rng.rand(candidates.length)]!
  } else {
    const roll = rng.rand(totalWeight)
    let acc = 0
    for (const c of candidates) {
      acc += Math.max(0, c.frequency)
      if (roll < acc) {
        picked = c
        break
      }
    }
  }

  const mods: RolledAutoMagicMod[] = picked.mods.map(mod => {
    const codeLower = mod.code.toLowerCase()
    if (NON_RANDOM_RANGE_CODES.has(codeLower) || mod.min === mod.max) {
      return {
        code: mod.code,
        ...(mod.param !== undefined ? { param: mod.param } : {}),
        min: mod.min,
        max: mod.max,
        value: mod.min,
      }
    }
    const val = rng.randRange(mod.min, mod.max)
    return {
      code: mod.code,
      ...(mod.param !== undefined ? { param: mod.param } : {}),
      min: mod.min,
      max: mod.max,
      value: val,
    }
  })

  return {
    entry: picked,
    id: picked.id,
    name: picked.name,
    group: picked.group,
    level: picked.level,
    levelreq: picked.levelreq,
    mods,
  }
}

/**
 * Starting skill ID for each character class's 30 skills (6 tiers x 5 skills per tier) in Skills.txt.
 */
export const STAFF_MOD_CLASS_SKILL_START: Readonly<Record<string, number>> = {
  ama: 6,
  sor: 36,
  nec: 66,
  pal: 96,
  bar: 126,
  dru: 221,
  ass: 251,
}

/**
 * Fallback mapping from 1.13c item type code to `StaffMods` class code (`ItemTypes.txt`).
 */
export const ITEM_TYPE_STAFF_MODS_MAP: Readonly<Record<string, string>> = {
  scep: 'pal',
  wand: 'nec',
  staf: 'sor',
  orb: 'sor',
  head: 'nec',
  phlm: 'bar',
  pelt: 'dru',
  cloa: 'ass',
  h2h2: 'ass',
}

/**
 * Resolves the character class (`'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass'`) for StaffMods on an item base.
 * Traverses `ItemTypes.txt` via `equiv1` / `equiv2` and falls back to `ITEM_TYPE_STAFF_MODS_MAP`.
 */
export function resolveStaffModsClass(
  base: ItemBase,
  itemTypes?: ItemTypeTable,
): string | undefined {
  const typeCode = getItemTypeCode(base).trim().toLowerCase()

  if (itemTypes) {
    const visited = new Set<string>()
    const queue: string[] = [typeCode, ...(base.tags ?? [])]
    while (queue.length > 0) {
      const curr = queue.shift()!.trim().toLowerCase()
      if (!curr || visited.has(curr)) continue
      visited.add(curr)
      const def = itemTypes.byCode.get(curr)
      if (def) {
        const sm = def.staffMods?.trim().toLowerCase()
        if (sm && STAFF_MOD_CLASS_SKILL_START[sm] !== undefined) {
          return sm
        }
        if (def.equiv1) queue.push(def.equiv1)
        if (def.equiv2) queue.push(def.equiv2)
      }
      if (ITEM_TYPE_STAFF_MODS_MAP[curr]) {
        return ITEM_TYPE_STAFF_MODS_MAP[curr]
      }
    }
  }

  if (ITEM_TYPE_STAFF_MODS_MAP[typeCode]) {
    return ITEM_TYPE_STAFF_MODS_MAP[typeCode]
  }

  if (base.tags) {
    for (const tag of base.tags) {
      const t = tag.trim().toLowerCase()
      if (ITEM_TYPE_STAFF_MODS_MAP[t]) {
        return ITEM_TYPE_STAFF_MODS_MAP[t]
      }
    }
  }

  return undefined
}

/**
 * Rolls 1.13c StaffMods (`D2Common!ITEMMOD_ApplyStaffMods`) for eligible equipment bases.
 *
 * Rules:
 * - Each class has 30 skills across 6 tiers (reqLvl 1, 6, 12, 18, 24, 30; 5 skills per tier).
 * - Base tier by `ilvl`:
 *   - `ilvl >= 37` -> 5
 *   - `ilvl >= 25` -> 4
 *   - `ilvl >= 19` -> 3
 *   - `ilvl >= 12` -> 2
 *   - `ilvl < 12`  -> 1
 * - Skill count (`r = rng.rand(100)`):
 *   - `r >= 90` (10%): 3 skills
 *   - `r >= 70` (20%): 2 skills
 *   - `r >= 30` (40%): 1 skill
 *   - `r < 30`  (30%): 0 skills
 * - For each slot:
 *   - Tier offset (`tRoll = rng.rand(100)`):
 *     `>= 80` (+1, max 6), `>= 30` (+0), `>= 10` (-1, min 1), `< 10` (-2, min 1).
 *   - Pick 1 unselected skill ID from the 5 skills in that tier.
 *   - Bonus roll (`bonusRoll = rng.rand(100)`):
 *     `>= 90` -> `+3`, `>= 60` -> `+2`, else `+1`.
 *   - Emit `{ code: 'skill', param: skillId, min: bonus, max: bonus, value: bonus }`.
 */
export function rollStaffMods(
  base: ItemBase,
  ilvl: number,
  itemTypes?: ItemTypeTable,
  rng?: D2Rng,
): RolledItemProp[] {
  const classCode = resolveStaffModsClass(base, itemTypes)
  if (!classCode) {
    return []
  }
  const startSkillId = STAFF_MOD_CLASS_SKILL_START[classCode]
  if (startSkillId === undefined) {
    return []
  }

  const effectiveRng = rng ?? new D2Rng(1)

  let baseTier = 1
  if (ilvl >= 37) baseTier = 5
  else if (ilvl >= 25) baseTier = 4
  else if (ilvl >= 19) baseTier = 3
  else if (ilvl >= 12) baseTier = 2
  else baseTier = 1

  const r = effectiveRng.rand(100)
  let count = 0
  if (r >= 90) count = 3
  else if (r >= 70) count = 2
  else if (r >= 30) count = 1
  else count = 0

  if (count === 0) {
    return []
  }

  const selectedSkills = new Set<number>()
  const props: RolledItemProp[] = []

  for (let i = 0; i < count; i++) {
    const tRoll = effectiveRng.rand(100)
    let tierOffset = 0
    if (tRoll >= 80) tierOffset = 1
    else if (tRoll >= 30) tierOffset = 0
    else if (tRoll >= 10) tierOffset = -1
    else tierOffset = -2

    const tier = Math.max(1, Math.min(6, baseTier + tierOffset))
    const tierStart = startSkillId + (tier - 1) * 5
    const available: number[] = []
    for (let k = 0; k < 5; k++) {
      const candidateId = tierStart + k
      if (!selectedSkills.has(candidateId)) {
        available.push(candidateId)
      }
    }
    if (available.length === 0) {
      continue
    }

    const skillId = available[effectiveRng.rand(available.length)]!
    selectedSkills.add(skillId)

    const bonusRoll = effectiveRng.rand(100)
    const bonus = bonusRoll >= 90 ? 3 : bonusRoll >= 60 ? 2 : 1

    props.push({
      code: 'skill',
      param: skillId,
      min: bonus,
      max: bonus,
      value: bonus,
    })
  }

  return props
}

