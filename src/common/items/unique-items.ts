/**
 * Diablo II unique items loader (`UniqueItems.txt`).
 *
 * Gold standard reference: 1.13c MPQ `data/global/excel/UniqueItems.txt`.
 *
 * In Diablo II, unique items represent specific, named items with fixed
 * affixes and randomized ranges. Each item is tied to a base item (`code`)
 * and carries a quality level (`lvl`) and character level requirement (`levelreq`).
 *
 * Key data properties:
 * - 403 raw lines in 1.13c; minus the empty index row and 'Expansion' section
 *   separator row = exactly 401 real unique item records.
 * - Exactly 385 items are enabled (`enabled === 1`). 16 items have `enabled === 0`
 *   or blank, and are flagged as `enabled = false` so they do not enter the
 *   runtime generation pool (e.g. classic Azurewrath, Constricting Ring, Gore Ripper).
 * - Multi-value index: multiple unique items can share the same base item code
 *   (e.g., rings `rin` have 10 uniques in 1.13c, 9 enabled; amulets `amu` have 11 uniques).
 * - Up to 12 properties per item (`prop1..12`, `par1..12`, `min1..12`, `max1..12`).
 *   Parameters (`par`) can be numeric (skill IDs) or skill name strings (e.g. "Oak Sage").
 */
import type { D2Table } from '../world/acts.ts'
import { parseTable } from '../world/acts.ts'
import type { MountedArchives } from '../mpq/mount.ts'

/** File path of `UniqueItems.txt` inside MPQ archives. */
export const UNIQUE_ITEMS_TABLE_PATH = 'data\\global\\excel\\UniqueItems.txt'

/** One property modifier on a unique item. */
export interface UniqueItemProp {
  /** Property stat code (e.g. 'str', 'openwounds', 'crush', 'dmg%', 'charged'). */
  code: string
  /** Parameter (e.g. skill name string like 'Oak Sage', or skill ID number like 74). */
  par?: string | number
  /** Minimum roll value. */
  min: number
  /** Maximum roll value. */
  max: number
}

/** One unique item definition from UniqueItems.txt. */
export interface UniqueItem {
  /** 0-based data row index (0..400). */
  id: number
  /** Primary key and string.tbl translation key (e.g. "The Gnasher"). */
  index: string
  /** Version (0 for Classic, 100 for Expansion). */
  version: number
  /** Whether the item is enabled for generation (385 enabled, 16 disabled). */
  enabled: boolean
  /** Whether this is a ladder-only drop. */
  ladder: boolean
  /** Selection weight among uniques sharing the same base item code. */
  rarity: number
  /** Whether multiple copies of this unique can spawn in the same game. */
  nolimit: boolean
  /** Quality level (qlvl) — item generation ilvl must be >= lvl. */
  lvl: number
  /** Required character level to equip (from `lvl req`). */
  levelreq: number
  /** Base item code (e.g. 'hax', 'rin', 'amu'). */
  code: string
  /** Whether a character may carry only one copy in inventory (e.g. Annihilus, Torch). */
  carry1: boolean
  /** Price multiplier (from `cost mult`). */
  costMult: number
  /** Flat price addition (from `cost add`). */
  costAdd: number
  /** Character color transform code, if any (e.g. 'dyel', 'dgrn'). */
  chrtransform?: string
  /** Inventory icon color transform code, if any. */
  invtransform?: string
  /** Custom inventory graphic file name, if any (e.g. 'invhaxu'). */
  invfile?: string
  /** Item modifiers (up to 12). */
  props: UniqueItemProp[]
  /** Optional base item type name (from `*type`). */
  type?: string
  /** Whether this is an uber quest item (from `*uber`). */
  uber?: boolean
  /** Flippy animation file (from `flippyfile`). */
  flippyfile?: string
  /** Sound played on drop (from `dropsound`). */
  dropsound?: string
  /** Sound played on use (from `usesound`). */
  usesound?: string
}

import { CaseInsensitiveMap } from './tables.ts'
export { CaseInsensitiveMap }

/**
 * Parsed UniqueItems table providing list and indexed lookup access.
 */
export interface UniqueItemsTable {
  /** All 401 parsed unique item records (including disabled ones). */
  readonly all: UniqueItem[]
  /** Map of unique items by index name (case-insensitive). */
  readonly byIndex: Map<string, UniqueItem>
  /** Map of unique items by base item code (case-insensitive). */
  readonly byCode: Map<string, UniqueItem[]>
  /**
   * Returns all enabled unique items matching the specified base item code.
   * Excludes disabled items (`enabled === false`).
   */
  getEnabledByCode(code: string): UniqueItem[]
  /** Total number of unique items parsed (401 in 1.13c). */
  readonly length: number
  /** Direct lookup by index name (case-insensitive). */
  get(index: string): UniqueItem | undefined
  /** Direct lookup by row id (0..400). */
  getById(id: number): UniqueItem | undefined
  /** Iterates over all items. */
  [Symbol.iterator](): IterableIterator<UniqueItem>
}

/**
 * Parses a parameter cell (par1..12).
 *
 * In Diablo II UniqueItems.txt, a parameter can be:
 * - Empty string: returns undefined
 * - Numeric string (e.g. "74", "-5", "0"): returns parsed number
 * - Skill / stat name string (e.g. "Oak Sage", "Sanctuary", "Nova"): returns preserved string
 */
export function parsePar(val: string): string | number | undefined {
  const trimmed = val.trim()
  if (trimmed === '') return undefined
  if (/^-?\d+$/.test(trimmed)) {
    const num = Number(trimmed)
    if (Number.isFinite(num)) return num
  }
  return trimmed
}

/**
 * Parses a numeric cell with fallback.
 */
export function parseNumber(val: string, fallback = 0): number {
  const trimmed = val.trim()
  if (trimmed === '') return fallback
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : fallback
}

/**
 * Parses `UniqueItems.txt` from a raw tab-separated D2Table.
 *
 * @param table - Raw parsed tab-separated table.
 * @returns Parsed `UniqueItemsTable`.
 */
export function parseUniqueItemsTable(table: D2Table): UniqueItemsTable {
  const headerMap = new Map<string, number>()
  table.header.forEach((name, idx) => {
    headerMap.set(name.trim().toLowerCase(), idx)
  })

  const getCell = (row: readonly string[], ...names: string[]): string => {
    for (const name of names) {
      const idx = headerMap.get(name.toLowerCase())
      if (idx !== undefined && idx < row.length) {
        const val = (row[idx] ?? '').trim()
        if (val !== '') return val
      }
    }
    return ''
  }

  const all: UniqueItem[] = []
  const byIndex = new CaseInsensitiveMap<UniqueItem>()
  const byCode = new CaseInsensitiveMap<UniqueItem[]>()

  for (const row of table.rows) {
    const index = getCell(row, 'index')
    // Filter out rows where index is empty or 'Expansion' separator
    if (!index || index.toLowerCase() === 'expansion') {
      continue
    }

    const id = all.length
    const version = parseNumber(getCell(row, 'version'), 0)
    const enabled = getCell(row, 'enabled') === '1'
    const ladder = getCell(row, 'ladder') === '1'
    const rarity = parseNumber(getCell(row, 'rarity'), 0)
    const nolimit = getCell(row, 'nolimit') === '1'
    const lvl = parseNumber(getCell(row, 'lvl'), 0)
    const levelreq = parseNumber(getCell(row, 'lvl req', 'lvlreq', 'levelreq'), 0)
    const code = getCell(row, 'code')
    const carry1 = getCell(row, 'carry1') === '1'
    const costMult = parseNumber(getCell(row, 'cost mult', 'costmult'), 0)
    const costAdd = parseNumber(getCell(row, 'cost add', 'costadd'), 0)
    const chrtransform = getCell(row, 'chrtransform')
    const invtransform = getCell(row, 'invtransform')
    const invfile = getCell(row, 'invfile')

    const type = getCell(row, '*type', 'type')
    const uber = getCell(row, '*uber', 'uber') === '1'
    const flippyfile = getCell(row, 'flippyfile')
    const dropsound = getCell(row, 'dropsound')
    const usesound = getCell(row, 'usesound')

    const props: UniqueItemProp[] = []
    for (let slot = 1; slot <= 12; slot++) {
      const propCode = getCell(row, `prop${slot}`)
      if (!propCode) continue
      const par = parsePar(getCell(row, `par${slot}`))
      const min = parseNumber(getCell(row, `min${slot}`), 0)
      const max = parseNumber(getCell(row, `max${slot}`), 0)
      const prop: UniqueItemProp = {
        code: propCode,
        min,
        max,
        ...(par !== undefined ? { par } : {}),
      }
      props.push(prop)
    }

    const item: UniqueItem = {
      id,
      index,
      version,
      enabled,
      ladder,
      rarity,
      nolimit,
      lvl,
      levelreq,
      code,
      carry1,
      costMult,
      costAdd,
      props,
      ...(chrtransform ? { chrtransform } : {}),
      ...(invtransform ? { invtransform } : {}),
      ...(invfile ? { invfile } : {}),
      ...(type ? { type } : {}),
      ...(uber ? { uber: true } : {}),
      ...(flippyfile ? { flippyfile } : {}),
      ...(dropsound ? { dropsound } : {}),
      ...(usesound ? { usesound } : {}),
    }

    all.push(item)

    // Primary key lookup: enabled item takes precedence for duplicate indices like Azurewrath
    const existing = byIndex.get(index)
    if (!existing || (!existing.enabled && item.enabled)) {
      byIndex.set(index, item)
    }

    // Base code multi-value index
    if (code) {
      let codeList = byCode.get(code)
      if (!codeList) {
        codeList = []
        byCode.set(code, codeList)
      }
      codeList.push(item)
    }
  }

  const getEnabledByCode = (itemCode: string): UniqueItem[] => {
    const list = byCode.get(itemCode)
    if (!list) return []
    return list.filter(item => item.enabled)
  }

  return {
    all,
    byIndex,
    byCode,
    getEnabledByCode,
    length: all.length,
    get: (idx: string) => byIndex.get(idx),
    getById: (id: number) => (id >= 0 && id < all.length ? all[id] : undefined),
    [Symbol.iterator]() {
      return all[Symbol.iterator]()
    },
  }
}

/**
 * Loads and parses `UniqueItems.txt` from mounted MPQ archives.
 *
 * @param archives - Mounted MPQ archives.
 * @param tablePath - Optional path inside archive (defaults to UNIQUE_ITEMS_TABLE_PATH).
 * @returns Promise resolving to `UniqueItemsTable`.
 */
export async function loadUniqueItems(
  archives: MountedArchives,
  tablePath = UNIQUE_ITEMS_TABLE_PATH,
): Promise<UniqueItemsTable> {
  const bytes = await archives.read(tablePath)
  const d2Table = parseTable(bytes)
  return parseUniqueItemsTable(d2Table)
}
