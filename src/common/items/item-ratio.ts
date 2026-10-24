/**
 * Diablo II ItemRatio Quality Determination (`ItemRatio.txt`).
 *
 * Gold standard references:
 * - D2Game!6FC2FC40 (Quality determination algorithm & roll sequence)
 * - D2Game!6FC2E130 (Magic Find diminishing returns formula)
 * - D2Common!6FD510B0 / D2Common!6FD51180 (PRNG roll logic)
 *
 * In Diablo II, when an item base is dropped, the engine resolves its quality tier
 * through `ItemRatio.txt`. The row in `ItemRatio.txt` is looked up by:
 * - Version (0 = Classic, 1 = Expansion)
 * - Uber (0 = Normal, 1 = Exceptional / Elite)
 * - Class Specific (0 = Generic, 1 = Class-specific item like Orbs, Pelts, etc.)
 *
 * CRITICAL ENGINE PROPERTY:
 * The columns in `ItemRatio.txt` are listed as:
 *   Unique -> Rare -> Set -> Magic -> HiQuality -> Normal
 * BUT the actual in-engine roll sequence at D2Game!6FC2FC40 is strictly:
 *   Unique(7) -> Set(5) -> Rare(6) -> Magic(4) -> Superior(3) -> Normal(2) / Low(1)
 *
 * Every division in the algorithm uses 32-bit signed integer truncation toward zero
 * (replicated strictly via `Math.trunc`).
 */
import type { D2Table } from '../world/acts.ts'
import { cell, parseTable } from '../world/acts.ts'
import type { MountedArchives } from '../mpq/mount.ts'
import { D2Rng } from '../rng/d2-rng.ts'
import { ItemQuality } from './items.ts'

/** File path of `ItemRatio.txt` inside MPQ archives. */
export const ITEM_RATIO_TABLE_PATH = 'data\\global\\excel\\ItemRatio.txt'

/** Magic Find diminishing returns divisor factors (D2Game!6FC2E130). */
export const MF_FACTOR_UNIQUE = 250
export const MF_FACTOR_SET = 500
export const MF_FACTOR_RARE = 600

/** Quality tier names in strict roll order. */
export type ItemQualityTier =
  | 'unique'
  | 'set'
  | 'rare'
  | 'magic'
  | 'superior'
  | 'normal'
  | 'low'

/** Mapping from ItemQualityTier string to numeric ItemQuality enum value. */
export const QUALITY_TIER_TO_ITEM_QUALITY: Readonly<Record<ItemQualityTier, ItemQuality>> = {
  unique: ItemQuality.UNIQUE,
  set: ItemQuality.SET,
  rare: ItemQuality.RARE,
  magic: ItemQuality.MAGIC,
  superior: ItemQuality.SUPERIOR,
  normal: ItemQuality.NORMAL,
  low: ItemQuality.LOW,
}

/** One row from `ItemRatio.txt`. */
export interface ItemRatioRow {
  /** Optional function comment from table. */
  readonly function?: string | undefined
  /** 0 = Classic, 1 = Expansion. */
  readonly version: number
  /** 0 = Normal, 1 = Exceptional or Elite item. */
  readonly uber: number
  /** 0 = Generic, 1 = Class-specific item. */
  readonly classSpecific: number

  /** Unique base chance, divisor, and minimum chance floor. */
  readonly unique: number
  readonly uniqueDiv: number
  readonly uniqueMin: number

  /** Rare base chance, divisor, and minimum chance floor. */
  readonly rare: number
  readonly rareDiv: number
  readonly rareMin: number

  /** Set base chance, divisor, and minimum chance floor. */
  readonly set: number
  readonly setDiv: number
  readonly setMin: number

  /** Magic base chance, divisor, and minimum chance floor. */
  readonly magic: number
  readonly magicDiv: number
  readonly magicMin: number

  /** High Quality (Superior) base chance and divisor (no MF, min, or TC factor). */
  readonly hiQual: number
  readonly hiQualDiv: number

  /** Normal / Low quality base chance and divisor (no MF, min, or TC factor). */
  readonly normal: number
  readonly normalDiv: number

  // Compatibility aliases
  readonly uniqueDivisor?: number | undefined
  readonly rareDivisor?: number | undefined
  readonly setDivisor?: number | undefined
  readonly magicDivisor?: number | undefined
  readonly hiQuality?: number | undefined
  readonly hiQualityDivisor?: number | undefined
  readonly normalDivisor?: number | undefined
}

/**
 * Parsed ItemRatio table providing list and indexed lookup access.
 */
export interface ItemRatioTable {
  /** All parsed rows. */
  readonly rows: readonly ItemRatioRow[]
  /**
   * Looks up the appropriate row by version, uber flag, and classSpecific flag.
   */
  getRow(
    version: number | boolean,
    uber: number | boolean,
    classSpecific: number | boolean,
  ): ItemRatioRow | undefined
  /** Number of parsed rows (6 in vanilla 1.13c). */
  readonly length: number
  /** Iterates over all rows. */
  [Symbol.iterator](): IterableIterator<ItemRatioRow>
}

/** PRNG source interface providing `rand(max: number): number`. */
export interface QualityRollRng {
  rand(max: number): number
}

/** TreasureClass ratio factor modifiers (fractions of 1024, e.g. from TreasureClassEx.txt). */
export interface QualityRatioFactors {
  readonly unique?: number | undefined
  readonly set?: number | undefined
  readonly rare?: number | undefined
  readonly magic?: number | undefined
}

/** Context parameters passed to `rollItemQuality`. */
export interface QualityRollContext {
  /** Drop item level (e.g. monster level or area level). */
  readonly ilvl: number
  /** Quality level of the base item (from weapons/armor/misc.txt). */
  readonly qlvl: number
  /** Magic Find percentage (e.g. 0, 50, 100). */
  readonly magicFind?: number | undefined
  /** Alternative alias for magicFind. */
  readonly mf?: number | undefined

  /** ItemRatio row to use directly. */
  readonly row?: ItemRatioRow | undefined
  /** ItemRatio table to look up row from if `row` is not provided. */
  readonly table?: ItemRatioTable | undefined

  /** Game version: 0 = Classic, 1 = Expansion (LoD). Defaults to 1. */
  readonly version?: number | boolean | undefined
  /** Whether the item is exceptional or elite. Defaults to 0/false. */
  readonly uber?: number | boolean | undefined
  /** Whether the item is class-specific. Defaults to 0/false. */
  readonly classSpecific?: number | boolean | undefined

  /** TreasureClass quality modifiers (fractions of 1024). */
  readonly tcFactors?: QualityRatioFactors | undefined
  /** Single TC factor fallback (applied to all if specific tier not given). */
  readonly tcFactor?: number | undefined

  /** Explicit TC modifiers (fractions of 1024). */
  readonly tcUnique?: number | undefined
  readonly tcSet?: number | undefined
  readonly tcRare?: number | undefined
  readonly tcMagic?: number | undefined

  /** Optional quality filters: if false, that tier is bypassed during roll. */
  readonly allowUnique?: boolean | undefined
  readonly allowSet?: boolean | undefined
  readonly allowRare?: boolean | undefined
  readonly allowMagic?: boolean | undefined
  readonly allowSuperior?: boolean | undefined

  /** PRNG instance implementing `rand(max: number): number`. Defaults to new D2Rng(). */
  readonly rng?: QualityRollRng | undefined
}

/**
 * Calculates effective magic find with diminishing returns (D2Game!6FC2E130).
 *
 * For mf <= 10, no diminishing returns are applied: returns mf + 100.
 * For mf > 10: returns 100 + Math.trunc((mf * factor) / (mf + factor)).
 *
 * @param mf - Player/minion magic find percentage.
 * @param factor - Diminishing returns factor (250 for Unique, 500 for Set, 600 for Rare).
 * @returns Diminished multiplier (100-based).
 */
export function effectiveMF(mf: number, factor: number): number {
  const x = mf + 100
  if (x <= 110) {
    return x
  }
  return 100 + Math.trunc((mf * factor) / (mf + factor))
}

/**
 * Calculates final chance denominator for Unique quality (D2Game!6FC2FC40).
 */
export function calculateUniqueChance(
  row: ItemRatioRow,
  ilvl: number,
  qlvl: number,
  mf = 0,
  tcFactor = 0,
): number {
  const D = ilvl - qlvl
  const divisor = row.uniqueDiv || 1
  let chance = (row.unique - Math.trunc(D / divisor)) * 128
  if (mf !== 0 && mf > -100) {
    const e = effectiveMF(mf, MF_FACTOR_UNIQUE)
    if (e > 0) {
      chance = Math.trunc((chance * 100) / e)
    }
  }
  if (chance < row.uniqueMin) {
    chance = row.uniqueMin
  }
  chance -= Math.trunc((tcFactor * chance) / 1024)
  return chance
}

/**
 * Calculates final chance denominator for Set quality (D2Game!6FC2FC40).
 */
export function calculateSetChance(
  row: ItemRatioRow,
  ilvl: number,
  qlvl: number,
  mf = 0,
  tcFactor = 0,
): number {
  const D = ilvl - qlvl
  const divisor = row.setDiv || 1
  let chance = (row.set - Math.trunc(D / divisor)) * 128
  if (mf !== 0 && mf > -100) {
    const e = effectiveMF(mf, MF_FACTOR_SET)
    if (e > 0) {
      chance = Math.trunc((chance * 100) / e)
    }
  }
  if (chance < row.setMin) {
    chance = row.setMin
  }
  chance -= Math.trunc((tcFactor * chance) / 1024)
  return chance
}

/**
 * Calculates final chance denominator for Rare quality (D2Game!6FC2FC40).
 */
export function calculateRareChance(
  row: ItemRatioRow,
  ilvl: number,
  qlvl: number,
  mf = 0,
  tcFactor = 0,
): number {
  const D = ilvl - qlvl
  const divisor = row.rareDiv || 1
  let chance = (row.rare - Math.trunc(D / divisor)) * 128
  if (mf !== 0 && mf > -100) {
    const e = effectiveMF(mf, MF_FACTOR_RARE)
    if (e > 0) {
      chance = Math.trunc((chance * 100) / e)
    }
  }
  if (chance < row.rareMin) {
    chance = row.rareMin
  }
  chance -= Math.trunc((tcFactor * chance) / 1024)
  return chance
}

/**
 * Calculates final chance denominator for Magic quality (D2Game!6FC2FC40).
 * Magic has NO diminishing returns: divisor is `mf + 100`.
 */
export function calculateMagicChance(
  row: ItemRatioRow,
  ilvl: number,
  qlvl: number,
  mf = 0,
  tcFactor = 0,
): number {
  const D = ilvl - qlvl
  const divisor = row.magicDiv || 1
  let chance = (row.magic - Math.trunc(D / divisor)) * 128
  if (mf !== 0 && mf > -100) {
    const e = mf + 100
    if (e > 0) {
      chance = Math.trunc((chance * 100) / e)
    }
  }
  if (chance < row.magicMin) {
    chance = row.magicMin
  }
  chance -= Math.trunc((tcFactor * chance) / 1024)
  return chance
}

/**
 * Calculates chance denominator for Superior (High Quality) quality.
 * Superior does not take MF, has no min floor, and no TC factor.
 */
export function calculateSuperiorChance(
  row: ItemRatioRow,
  ilvl: number,
  qlvl: number,
): number {
  const D = ilvl - qlvl
  const divisor = row.hiQualDiv || 1
  return (row.hiQual - Math.trunc(D / divisor)) * 128
}

/**
 * Calculates chance denominator for Normal quality.
 * Normal does not take MF, has no min floor, and no TC factor.
 */
export function calculateNormalChance(
  row: ItemRatioRow,
  ilvl: number,
  qlvl: number,
): number {
  const D = ilvl - qlvl
  const divisor = row.normalDiv || 1
  return (row.normal - Math.trunc(D / divisor)) * 128
}

/**
 * Executes ItemRatio quality determination roll in exact order:
 * Unique(7) -> Set(5) -> Rare(6) -> Magic(4) -> Superior(3) -> Normal(2) / Low(1).
 *
 * @param context - Quality roll parameters (ilvl, qlvl, mf, factors, rng, etc.).
 * @returns Rolled ItemQualityTier.
 */
export function rollItemQuality(context: QualityRollContext): ItemQualityTier {
  const { ilvl, qlvl } = context
  const mf = context.magicFind ?? context.mf ?? 0
  const rng = context.rng ?? new D2Rng()

  let row = context.row
  if (!row) {
    const table = context.table ?? DEFAULT_ITEM_RATIO_TABLE
    row = table.getRow(
      context.version ?? 1,
      context.uber ?? 0,
      context.classSpecific ?? 0,
    )
  }
  if (!row) {
    throw new Error('rollItemQuality: no matching ItemRatio row found')
  }

  const tcUnique = context.tcFactors?.unique ?? context.tcUnique ?? context.tcFactor ?? 0
  const tcSet = context.tcFactors?.set ?? context.tcSet ?? context.tcFactor ?? 0
  const tcRare = context.tcFactors?.rare ?? context.tcRare ?? context.tcFactor ?? 0
  const tcMagic = context.tcFactors?.magic ?? context.tcMagic ?? context.tcFactor ?? 0

  const canRollMagicTiers = mf === 0 || mf > -100

  // 1. Unique (7)
  if (context.allowUnique !== false && canRollMagicTiers) {
    const chance = calculateUniqueChance(row, ilvl, qlvl, mf, tcUnique)
    if (chance <= 0 || rng.rand(chance) < 128) {
      return 'unique'
    }
  }

  // 2. Set (5)
  if (context.allowSet !== false && canRollMagicTiers) {
    const chance = calculateSetChance(row, ilvl, qlvl, mf, tcSet)
    if (chance <= 0 || rng.rand(chance) < 128) {
      return 'set'
    }
  }

  // 3. Rare (6)
  if (context.allowRare !== false && canRollMagicTiers) {
    const chance = calculateRareChance(row, ilvl, qlvl, mf, tcRare)
    if (chance <= 0 || rng.rand(chance) < 128) {
      return 'rare'
    }
  }

  // 4. Magic (4)
  if (context.allowMagic !== false && canRollMagicTiers) {
    const chance = calculateMagicChance(row, ilvl, qlvl, mf, tcMagic)
    if (chance <= 0 || rng.rand(chance) < 128) {
      return 'magic'
    }
  }

  // 5. Superior (3)
  if (context.allowSuperior !== false) {
    const chance = calculateSuperiorChance(row, ilvl, qlvl)
    if (chance <= 0 || rng.rand(chance) < 128) {
      return 'superior'
    }
  }

  // 6. Normal (2) / Low (1)
  const chance = calculateNormalChance(row, ilvl, qlvl)
  if (chance <= 0) {
    return 'normal'
  }
  return rng.rand(chance) < 128 ? 'normal' : 'low'
}

/**
 * Creates an ItemRatioTable from an array of ItemRatioRow records.
 */
export function createItemRatioTable(rows: readonly ItemRatioRow[]): ItemRatioTable {
  return {
    rows,
    length: rows.length,
    getRow(
      version: number | boolean,
      uber: number | boolean,
      classSpecific: number | boolean,
    ): ItemRatioRow | undefined {
      const v = typeof version === 'boolean' ? (version ? 1 : 0) : version
      const u = typeof uber === 'boolean' ? (uber ? 1 : 0) : uber
      const cs = typeof classSpecific === 'boolean' ? (classSpecific ? 1 : 0) : classSpecific

      // 1. Exact match
      let match = rows.find(r => r.version === v && r.uber === u && r.classSpecific === cs)
      if (match) return match

      // 2. Classic (v=0) classSpecific fallback to Expansion (v=1) classSpecific
      if (v === 0 && cs === 1) {
        match = rows.find(r => r.version === 1 && r.uber === u && r.classSpecific === 1)
        if (match) return match
      }

      // 3. Fallback matching version and uber
      match = rows.find(r => r.version === v && r.uber === u)
      if (match) return match

      // 4. Default to first row
      return rows[0]
    },
    [Symbol.iterator]() {
      return rows[Symbol.iterator]()
    },
  }
}

/** Parses cell value as integer. */
function parseNum(val: string, fallback = 0): number {
  const trimmed = val.trim()
  if (trimmed === '') return fallback
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Parses a D2Table (from ItemRatio.txt) into an ItemRatioTable.
 *
 * @param table - Parsed tab-separated table.
 * @returns Structured ItemRatioTable.
 */
export function parseItemRatioTable(table: D2Table): ItemRatioTable {
  const rows: ItemRatioRow[] = []
  for (const rawRow of table.rows) {
    if (rawRow.length === 0 || rawRow.every(c => c.trim() === '')) {
      continue
    }

    const fn = cell(table, rawRow, 'Function')
    const version = parseNum(cell(table, rawRow, 'Version'))
    const uber = parseNum(cell(table, rawRow, 'Uber'))
    const classSpecific = parseNum(
      cell(table, rawRow, 'Class Specific') ||
      cell(table, rawRow, 'ClassSpecific') ||
      cell(table, rawRow, 'class specific'),
    )

    const unique = parseNum(cell(table, rawRow, 'Unique'))
    const uniqueDiv = parseNum(cell(table, rawRow, 'UniqueDivisor') || cell(table, rawRow, 'UniqueDiv'))
    const uniqueMin = parseNum(cell(table, rawRow, 'UniqueMin'))

    const rare = parseNum(cell(table, rawRow, 'Rare'))
    const rareDiv = parseNum(cell(table, rawRow, 'RareDivisor') || cell(table, rawRow, 'RareDiv'))
    const rareMin = parseNum(cell(table, rawRow, 'RareMin'))

    const set = parseNum(cell(table, rawRow, 'Set'))
    const setDiv = parseNum(cell(table, rawRow, 'SetDivisor') || cell(table, rawRow, 'SetDiv'))
    const setMin = parseNum(cell(table, rawRow, 'SetMin'))

    const magic = parseNum(cell(table, rawRow, 'Magic'))
    const magicDiv = parseNum(cell(table, rawRow, 'MagicDivisor') || cell(table, rawRow, 'MagicDiv'))
    const magicMin = parseNum(cell(table, rawRow, 'MagicMin'))

    const hiQual = parseNum(cell(table, rawRow, 'HiQuality') || cell(table, rawRow, 'HiQual'))
    const hiQualDiv = parseNum(cell(table, rawRow, 'HiQualityDivisor') || cell(table, rawRow, 'HiQualDiv'))

    const normal = parseNum(cell(table, rawRow, 'Normal'))
    const normalDiv = parseNum(cell(table, rawRow, 'NormalDivisor') || cell(table, rawRow, 'NormalDiv'))

    rows.push({
      function: fn || undefined,
      version,
      uber,
      classSpecific,
      unique,
      uniqueDiv,
      uniqueMin,
      rare,
      rareDiv,
      rareMin,
      set,
      setDiv,
      setMin,
      magic,
      magicDiv,
      magicMin,
      hiQual,
      hiQualDiv,
      normal,
      normalDiv,
      uniqueDivisor: uniqueDiv,
      rareDivisor: rareDiv,
      setDivisor: setDiv,
      magicDivisor: magicDiv,
      hiQuality: hiQual,
      hiQualityDivisor: hiQualDiv,
      normalDivisor: normalDiv,
    })
  }

  return createItemRatioTable(rows)
}

/**
 * Loads and parses `ItemRatio.txt` from mounted MPQ archives.
 *
 * @param archives - Mounted MPQ archives.
 * @param tablePath - Optional path inside archive (defaults to ITEM_RATIO_TABLE_PATH).
 * @returns Promise resolving to `ItemRatioTable`.
 */
export async function loadItemRatio(
  archives: MountedArchives,
  tablePath = ITEM_RATIO_TABLE_PATH,
): Promise<ItemRatioTable> {
  const bytes = await archives.read(tablePath)
  const d2Table = parseTable(bytes)
  return parseItemRatioTable(d2Table)
}

/**
 * Canonical 1.13c ItemRatio.txt rows embedded as fallback defaults.
 */
export const DEFAULT_ITEM_RATIO_ROWS: readonly ItemRatioRow[] = [
  {
    function: 'Ratio - (Monster Level / Ratio Divisor)',
    version: 0,
    uber: 0,
    classSpecific: 0,
    unique: 400,
    uniqueDiv: 2,
    uniqueMin: 6400,
    rare: 160,
    rareDiv: 3,
    rareMin: 3200,
    set: 125,
    setDiv: 6,
    setMin: 5600,
    magic: 30,
    magicDiv: 16,
    magicMin: 192,
    hiQual: 12,
    hiQualDiv: 16,
    normal: 4,
    normalDiv: 8,
    uniqueDivisor: 2,
    rareDivisor: 3,
    setDivisor: 6,
    magicDivisor: 16,
    hiQuality: 12,
    hiQualityDivisor: 16,
    normalDivisor: 8,
  },
  {
    function: 'Uber',
    version: 0,
    uber: 1,
    classSpecific: 0,
    unique: 240,
    uniqueDiv: 2,
    uniqueMin: 6400,
    rare: 96,
    rareDiv: 3,
    rareMin: 3200,
    set: 96,
    setDiv: 6,
    setMin: 5600,
    magic: 3,
    magicDiv: 100,
    magicMin: 192,
    hiQual: 4,
    hiQualDiv: 16,
    normal: 1,
    normalDiv: 8,
    uniqueDivisor: 2,
    rareDivisor: 3,
    setDivisor: 6,
    magicDivisor: 100,
    hiQuality: 4,
    hiQualityDivisor: 16,
    normalDivisor: 8,
  },
  {
    function: 'Ratio - (Monster Level / Ratio Divisor)',
    version: 1,
    uber: 0,
    classSpecific: 0,
    unique: 400,
    uniqueDiv: 1,
    uniqueMin: 6400,
    rare: 100,
    rareDiv: 2,
    rareMin: 3200,
    set: 160,
    setDiv: 2,
    setMin: 5600,
    magic: 34,
    magicDiv: 3,
    magicMin: 192,
    hiQual: 12,
    hiQualDiv: 8,
    normal: 2,
    normalDiv: 2,
    uniqueDivisor: 1,
    rareDivisor: 2,
    setDivisor: 2,
    magicDivisor: 3,
    hiQuality: 12,
    hiQualityDivisor: 8,
    normalDivisor: 2,
  },
  {
    function: 'Uber',
    version: 1,
    uber: 1,
    classSpecific: 0,
    unique: 400,
    uniqueDiv: 1,
    uniqueMin: 6400,
    rare: 100,
    rareDiv: 2,
    rareMin: 3200,
    set: 160,
    setDiv: 2,
    setMin: 5600,
    magic: 34,
    magicDiv: 3,
    magicMin: 192,
    hiQual: 12,
    hiQualDiv: 8,
    normal: 1,
    normalDiv: 1,
    uniqueDivisor: 1,
    rareDivisor: 2,
    setDivisor: 2,
    magicDivisor: 3,
    hiQuality: 12,
    hiQualityDivisor: 8,
    normalDivisor: 1,
  },
  {
    function: 'Class Specific',
    version: 1,
    uber: 0,
    classSpecific: 1,
    unique: 240,
    uniqueDiv: 3,
    uniqueMin: 6400,
    rare: 80,
    rareDiv: 3,
    rareMin: 3200,
    set: 120,
    setDiv: 3,
    setMin: 5600,
    magic: 17,
    magicDiv: 6,
    magicMin: 192,
    hiQual: 9,
    hiQualDiv: 8,
    normal: 2,
    normalDiv: 2,
    uniqueDivisor: 3,
    rareDivisor: 3,
    setDivisor: 3,
    magicDivisor: 6,
    hiQuality: 9,
    hiQualityDivisor: 8,
    normalDivisor: 2,
  },
  {
    function: 'Class Specific Uber',
    version: 1,
    uber: 1,
    classSpecific: 1,
    unique: 240,
    uniqueDiv: 3,
    uniqueMin: 6400,
    rare: 80,
    rareDiv: 3,
    rareMin: 3200,
    set: 120,
    setDiv: 3,
    setMin: 5600,
    magic: 17,
    magicDiv: 6,
    magicMin: 192,
    hiQual: 9,
    hiQualDiv: 8,
    normal: 1,
    normalDiv: 1,
    uniqueDivisor: 3,
    rareDivisor: 3,
    setDivisor: 3,
    magicDivisor: 6,
    hiQuality: 9,
    hiQualityDivisor: 8,
    normalDivisor: 1,
  },
]

export const DEFAULT_ITEM_RATIO_TABLE = createItemRatioTable(DEFAULT_ITEM_RATIO_ROWS)
