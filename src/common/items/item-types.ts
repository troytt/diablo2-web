/**
 * Diablo II item types loader and inheritance hierarchy (`ItemTypes.txt`).
 *
 * `ItemTypes.txt` establishes the item taxonomy:
 * - Direct attributes: sockets by item level tier, body equip locations, class specificity,
 *   rarity multipliers for auto-TC generation, and magic/rare/normal/charm/gem flags.
 * - Hierarchy: `Equiv1` and `Equiv2` define parent types (e.g., `shie -> shld`, `wand -> rod`,
 *   `abow -> bow -> miss -> weap`), forming a directed acyclic graph (DAG).
 *
 * Exactly 5 types in vanilla 1.13c seed TreasureClass generation (`treasureClass === 1`):
 * `bow`, `weap`, `mele`, `armo`, and `abow`.
 */
import type { D2Table } from '../world/acts.ts'
import { cell, parseTable } from '../world/acts.ts'
import type { MountedArchives } from '../mpq/mount.ts'

/** File path of `ItemTypes.txt` inside MPQ archives. */
export const ITEM_TYPES_TABLE_PATH = 'data\\global\\excel\\ItemTypes.txt'

/**
 * Definition of an individual item type row from `ItemTypes.txt`.
 */
export interface ItemTypeDefinition {
  /** 3-4 character type identifier code (e.g., 'shie', 'weap'). */
  readonly code: string
  /** Human-readable name from the `ItemType` column. */
  readonly name: string
  /** Primary parent type code from `Equiv1`. */
  readonly equiv1: string
  /** Secondary parent type code from `Equiv2`. */
  readonly equiv2: string
  /** Whether this type seeds an auto-TreasureClass (1 or 0). Exactly 5 types in 1.13c have 1. */
  readonly treasureClass: number
  /** Auto-TC weight multiplier (typically 3, 1, 2, or 0). */
  readonly rarity: number
  /** Maximum sockets for item level 1-24. */
  readonly maxSock1: number
  /** Maximum sockets for item level 25-39. */
  readonly maxSock25: number
  /** Maximum sockets for item level 40+. */
  readonly maxSock40: number
  /** Whether items of this type are always magic. */
  readonly magic: boolean
  /** Whether items of this type can spawn as rare. */
  readonly rare: boolean
  /** Whether items of this type are always normal/non-magical. */
  readonly normal: boolean
  /** Whether this type functions as an inventory charm. */
  readonly charm: boolean
  /** Whether this type functions as a socketable gem. */
  readonly gem: boolean
  /** Character class code receiving staff mods (e.g., 'pal', 'nec', 'sor'). */
  readonly staffMods: string
  /** Whether this item can be equipped on character body slots. */
  readonly body: boolean
  /** Primary body equipment slot code (e.g., 'rarm', 'tors', 'head'). */
  readonly bodyLoc1: string
  /** Secondary body equipment slot code (e.g., 'larm', 'tors', 'head'). */
  readonly bodyLoc2: string
  /** Whether this item can be placed in belt slots. */
  readonly beltable: boolean
  /** Character class code required for class-specific items (e.g., 'ama', 'bar', 'nec'). */
  readonly class: string
  /** Vendor store tab page code from StorePage column ('armo', 'weap', 'misc', or ''). */
  readonly storePage?: string | undefined
}

import { CaseInsensitiveMap } from './tables.ts'

/**
 * Parsed item types table providing array and indexed lookup access.
 */
export interface ItemTypeTable {
  /** All valid item type definitions in file order (98 types in vanilla 1.13c). */
  readonly types: readonly ItemTypeDefinition[]
  /** Lookup map indexed by item type code (case-insensitive and trimmed). */
  readonly byCode: ReadonlyMap<string, ItemTypeDefinition>
  /** @internal Memoization cache for isA queries. */
  readonly _isACache?: Map<string, boolean>
}

/**
 * Parses `ItemTypes.txt` from a raw tab-separated D2Table.
 *
 * Filters out:
 * - First 2 placeholder rows of `None` (indices 0 and 1)
 * - 3 unused placeholder rows of `Not Used` (indices 14, 17, 23)
 * - The `Expansion` separator row (index 58)
 * - Any rows with empty `Code`
 *
 * In vanilla Diablo II 1.13c, 104 rows - 6 filtered = exactly 98 valid types.
 *
 * @param table - Raw parsed tab-separated table.
 * @returns Parsed `ItemTypeTable` with list, code lookup, and inheritance cache.
 */
export function parseItemTypesTable(table: D2Table): ItemTypeTable {
  const types: ItemTypeDefinition[] = []
  const byCode = new CaseInsensitiveMap<ItemTypeDefinition>()

  for (const row of table.rows) {
    const code = cell(table, row, 'Code').trim()
    const name = cell(table, row, 'ItemType').trim()

    // Filter out rows with empty Code, placeholders (None, Not Used), and Expansion separator
    if (!code || name === 'None' || name === 'Not Used' || name === 'Expansion') {
      continue
    }

    const def: ItemTypeDefinition = {
      code,
      name,
      equiv1: cell(table, row, 'Equiv1').trim(),
      equiv2: cell(table, row, 'Equiv2').trim(),
      treasureClass: Number(cell(table, row, 'TreasureClass')) || 0,
      rarity: Number(cell(table, row, 'Rarity')) || 0,
      maxSock1: Number(cell(table, row, 'MaxSock1')) || 0,
      maxSock25: Number(cell(table, row, 'MaxSock25')) || 0,
      maxSock40: Number(cell(table, row, 'MaxSock40')) || 0,
      magic: cell(table, row, 'Magic').trim() === '1',
      rare: cell(table, row, 'Rare').trim() === '1',
      normal: cell(table, row, 'Normal').trim() === '1',
      charm: cell(table, row, 'Charm').trim() === '1',
      gem: cell(table, row, 'Gem').trim() === '1',
      staffMods: cell(table, row, 'StaffMods').trim(),
      body: cell(table, row, 'Body').trim() === '1',
      bodyLoc1: cell(table, row, 'BodyLoc1').trim(),
      bodyLoc2: cell(table, row, 'BodyLoc2').trim(),
      beltable: cell(table, row, 'Beltable').trim() === '1',
      class: cell(table, row, 'Class').trim(),
      storePage: cell(table, row, 'StorePage').trim(),
    }

    types.push(def)
    byCode.set(code, def)
  }

  return {
    types,
    byCode,
    _isACache: new Map<string, boolean>(),
  }
}

/**
 * Loads and parses `ItemTypes.txt` from mounted MPQ archives.
 *
 * @param archives - Mounted MPQ archives.
 * @returns Promise resolving to `ItemTypeTable`.
 */
export async function loadItemTypes(archives: MountedArchives): Promise<ItemTypeTable> {
  const bytes = await archives.read(ITEM_TYPES_TABLE_PATH)
  const d2Table = parseTable(bytes)
  return parseItemTypesTable(d2Table)
}

/** Fallback cache for tables that do not define `_isACache`. */
const fallbackCache = new WeakMap<ItemTypeTable, Map<string, boolean>>()

function getOrInitCache(table: ItemTypeTable): Map<string, boolean> {
  if (table._isACache) {
    return table._isACache
  }
  let cache = fallbackCache.get(table)
  if (!cache) {
    cache = new Map<string, boolean>()
    fallbackCache.set(table, cache)
  }
  return cache
}

/**
 * Recursive DFS traversal with cycle protection and intermediate cache lookup.
 */
function checkInheritance(
  current: string,
  target: string,
  table: ItemTypeTable,
  visited: Set<string>,
  cache: Map<string, boolean>,
): boolean {
  if (current === target) {
    return true
  }
  if (visited.has(current)) {
    return false
  }
  visited.add(current)

  const def = table.byCode.get(current)
  if (!def) {
    return false
  }

  if (def.equiv1) {
    const eq1 = def.equiv1.trim().toLowerCase()
    if (eq1) {
      const key1 = `${eq1}:${target}`
      const cached1 = cache.get(key1)
      if (cached1 === true) {
        return true
      }
      if (cached1 === undefined && checkInheritance(eq1, target, table, visited, cache)) {
        return true
      }
    }
  }

  if (def.equiv2) {
    const eq2 = def.equiv2.trim().toLowerCase()
    if (eq2) {
      const key2 = `${eq2}:${target}`
      const cached2 = cache.get(key2)
      if (cached2 === true) {
        return true
      }
      if (cached2 === undefined && checkInheritance(eq2, target, table, visited, cache)) {
        return true
      }
    }
  }

  return false
}

/**
 * Checks whether `typeCode` is or inherits from `ancestorCode`.
 *
 * - Returns `true` if `typeCode === ancestorCode` (reflexive).
 * - Recursively inspects `Equiv1` and `Equiv2` parent links.
 * - Protected against infinite cycles in cyclic inheritance chains.
 * - Memoized using table-specific cache for performance.
 * - Case-insensitive and whitespace-tolerant on both type codes.
 *
 * @param typeCode - Child type code to test (e.g., 'abow', 'shie').
 * @param ancestorCode - Ancestor type code to test for (e.g., 'weap', 'shld').
 * @param table - Item types table containing definitions.
 * @returns `true` if `typeCode` is or descends from `ancestorCode`.
 */
export function isA(
  typeCode: string,
  ancestorCode: string,
  table: ItemTypeTable,
): boolean {
  const code = typeCode.trim().toLowerCase()
  const ancestor = ancestorCode.trim().toLowerCase()

  if (!code || !ancestor) {
    return false
  }

  // Both must be valid item types in the table
  if (!table.byCode.has(code) || !table.byCode.has(ancestor)) {
    return false
  }

  if (code === ancestor) {
    return true
  }

  const cache = getOrInitCache(table)
  const cacheKey = `${code}:${ancestor}`
  const cached = cache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  const visited = new Set<string>()
  const result = checkInheritance(code, ancestor, table, visited, cache)
  cache.set(cacheKey, result)
  return result
}
