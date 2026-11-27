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
  /** Maximum sockets for item level 1-25 (`D2Common.dll #11151` `0x6FD74660`: `ilvl <= 25`). */
  readonly maxSock1: number
  /** Maximum sockets for item level 26-40 (`D2Common.dll #11151` `0x6FD7466D`: `ilvl <= 40`). */
  readonly maxSock25: number
  /** Maximum sockets for item level 41+ (`D2Common.dll #11151` `0x6FD74670`: `ilvl > 40`). */
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

/**
 * Baked 1.13c `ItemTypes.txt` `Code -> { equiv1, equiv2 }` equivalence hierarchy
 * (`samples/d2/excel/ItemTypes.txt`, 98 valid item type rows).
 *
 * Used by `itemTypeIsA` (`D2Common.dll` `0x6FD74430` `ITEMS_CheckItemTypeId`) for
 * synchronous server/client skill `passiveitype` and `itypea1..3` / `itypeb1..3` / `etypea1..2`
 * weapon type checks without requiring async MPQ archive mounting.
 */
export const ITEM_TYPES_EQUIV_113C: Readonly<
  Record<string, { readonly equiv1: string; readonly equiv2: string }>
> = {
  shie: { equiv1: 'shld', equiv2: '' }, // Shield
  tors: { equiv1: 'armo', equiv2: '' }, // Armor
  gold: { equiv1: 'misc', equiv2: '' }, // Gold
  bowq: { equiv1: 'misl', equiv2: '' }, // Bow Quiver
  xboq: { equiv1: 'misl', equiv2: '' }, // Crossbow Quiver
  play: { equiv1: 'misc', equiv2: '' }, // Player Body Part
  herb: { equiv1: 'misc', equiv2: '' }, // Herb
  poti: { equiv1: 'misc', equiv2: '' }, // Potion
  ring: { equiv1: 'misc', equiv2: '' }, // Ring
  elix: { equiv1: 'misc', equiv2: '' }, // Elixir
  amul: { equiv1: 'misc', equiv2: '' }, // Amulet
  char: { equiv1: 'misc', equiv2: '' }, // Charm
  boot: { equiv1: 'armo', equiv2: '' }, // Boots
  glov: { equiv1: 'armo', equiv2: '' }, // Gloves
  book: { equiv1: 'misc', equiv2: '' }, // Book
  belt: { equiv1: 'armo', equiv2: '' }, // Belt
  gem: { equiv1: 'sock', equiv2: '' }, // Gem
  torc: { equiv1: 'misc', equiv2: '' }, // Torch
  scro: { equiv1: 'misc', equiv2: '' }, // Scroll
  scep: { equiv1: 'rod', equiv2: '' }, // Scepter
  wand: { equiv1: 'rod', equiv2: '' }, // Wand
  staf: { equiv1: 'rod', equiv2: '' }, // Staff
  bow: { equiv1: 'miss', equiv2: '' }, // Bow
  axe: { equiv1: 'mele', equiv2: '' }, // Axe
  club: { equiv1: 'blun', equiv2: '' }, // Club
  swor: { equiv1: 'mele', equiv2: '' }, // Sword
  hamm: { equiv1: 'blun', equiv2: '' }, // Hammer
  knif: { equiv1: 'mele', equiv2: '' }, // Knife
  spea: { equiv1: 'mele', equiv2: '' }, // Spear
  pole: { equiv1: 'mele', equiv2: '' }, // Polearm
  xbow: { equiv1: 'miss', equiv2: '' }, // Crossbow
  mace: { equiv1: 'blun', equiv2: '' }, // Mace
  helm: { equiv1: 'armo', equiv2: '' }, // Helm
  tpot: { equiv1: 'thro', equiv2: '' }, // Missile Potion
  ques: { equiv1: '', equiv2: '' }, // Quest
  body: { equiv1: 'misc', equiv2: '' }, // Body Part
  key: { equiv1: 'misc', equiv2: '' }, // Key
  tkni: { equiv1: 'comb', equiv2: 'knif' }, // Throwing Knife
  taxe: { equiv1: 'comb', equiv2: 'axe' }, // Throwing Axe
  jave: { equiv1: 'comb', equiv2: 'spea' }, // Javelin
  weap: { equiv1: '', equiv2: '' }, // Weapon
  mele: { equiv1: 'weap', equiv2: '' }, // Melee Weapon
  miss: { equiv1: 'weap', equiv2: '' }, // Missile Weapon
  thro: { equiv1: 'weap', equiv2: '' }, // Thrown Weapon
  comb: { equiv1: 'mele', equiv2: 'thro' }, // Combo Weapon
  armo: { equiv1: '', equiv2: '' }, // Any Armor
  shld: { equiv1: 'armo', equiv2: 'seco' }, // Any Shield
  misc: { equiv1: '', equiv2: '' }, // Miscellaneous
  sock: { equiv1: 'misc', equiv2: '' }, // Socket Filler
  seco: { equiv1: '', equiv2: '' }, // Second Hand
  rod: { equiv1: 'blun', equiv2: '' }, // Staves And Rods
  misl: { equiv1: 'misc', equiv2: '' }, // Missile
  blun: { equiv1: 'mele', equiv2: '' }, // Blunt
  jewl: { equiv1: 'sock', equiv2: '' }, // Jewel
  clas: { equiv1: '', equiv2: '' }, // Class Specific
  amaz: { equiv1: 'clas', equiv2: '' }, // Amazon Item
  barb: { equiv1: 'clas', equiv2: '' }, // Barbarian Item
  necr: { equiv1: 'clas', equiv2: '' }, // Necromancer Item
  pala: { equiv1: 'clas', equiv2: '' }, // Paladin Item
  sorc: { equiv1: 'clas', equiv2: '' }, // Sorceress Item
  assn: { equiv1: 'clas', equiv2: '' }, // Assassin Item
  drui: { equiv1: 'clas', equiv2: '' }, // Druid Item
  h2h: { equiv1: 'mele', equiv2: 'assn' }, // Hand to Hand
  orb: { equiv1: 'weap', equiv2: 'sorc' }, // Orb
  head: { equiv1: 'shld', equiv2: 'necr' }, // Voodoo Heads
  ashd: { equiv1: 'shld', equiv2: 'pala' }, // Auric Shields
  phlm: { equiv1: 'helm', equiv2: 'barb' }, // Primal Helm
  pelt: { equiv1: 'helm', equiv2: 'drui' }, // Pelt
  cloa: { equiv1: 'tors', equiv2: 'assn' }, // Cloak
  rune: { equiv1: 'sock', equiv2: '' }, // Rune
  circ: { equiv1: 'helm', equiv2: '' }, // Circlet
  hpot: { equiv1: 'poti', equiv2: '' }, // Healing Potion
  mpot: { equiv1: 'poti', equiv2: '' }, // Mana Potion
  rpot: { equiv1: 'hpot', equiv2: 'mpot' }, // Rejuv Potion
  spot: { equiv1: 'poti', equiv2: '' }, // Stamina Potion
  apot: { equiv1: 'poti', equiv2: '' }, // Antidote Potion
  wpot: { equiv1: 'poti', equiv2: '' }, // Thawing Potion
  scha: { equiv1: 'char', equiv2: '' }, // Small Charm
  mcha: { equiv1: 'char', equiv2: '' }, // Medium Charm
  lcha: { equiv1: 'char', equiv2: '' }, // Large Charm
  abow: { equiv1: 'bow', equiv2: 'amaz' }, // Amazon Bow
  aspe: { equiv1: 'spea', equiv2: 'amaz' }, // Amazon Spear
  ajav: { equiv1: 'jave', equiv2: 'amaz' }, // Amazon Javelin
  h2h2: { equiv1: 'h2h', equiv2: '' }, // Hand to Hand 2
  mboq: { equiv1: 'bowq', equiv2: '' }, // Magic Bow Quiv
  mxbq: { equiv1: 'xboq', equiv2: '' }, // Magic Xbow Quiv
  gem0: { equiv1: 'gem', equiv2: '' }, // Chipped Gem
  gem1: { equiv1: 'gem', equiv2: '' }, // Flawed Gem
  gem2: { equiv1: 'gem', equiv2: '' }, // Standard Gem
  gem3: { equiv1: 'gem', equiv2: '' }, // Flawless Gem
  gem4: { equiv1: 'gem', equiv2: '' }, // Perfect Gem
  gema: { equiv1: 'gem', equiv2: '' }, // Amethyst
  gemd: { equiv1: 'gem', equiv2: '' }, // Diamond
  geme: { equiv1: 'gem', equiv2: '' }, // Emerald
  gemr: { equiv1: 'gem', equiv2: '' }, // Ruby
  gems: { equiv1: 'gem', equiv2: '' }, // Sapphire
  gemt: { equiv1: 'gem', equiv2: '' }, // Topaz
  gemz: { equiv1: 'gem', equiv2: '' }, // Skull
}

const canonicalItemTypeIsACache = new Map<string, boolean>()

/**
 * Checks whether `code` equals or inherits from `target` via BFS traversal of
 * the canonical 1.13c `ItemTypes.txt` `Equiv1` / `Equiv2` parent chain
 * (`D2Common.dll` `0x6FD74430` `ITEMS_CheckItemTypeId`).
 *
 * - Strictly accepts only `ItemTypes.txt` `Code` identifiers (e.g. `Weapons.txt` `type` / `type2`).
 * - Rejects item names (`Phase Blade`, `Cryptic Axe`, `staff`) and empty/unknown strings (`false`).
 */
export function itemTypeIsA(
  code: string | null | undefined,
  target: string | null | undefined,
): boolean {
  if (!code || !target) {
    return false
  }
  const normCode = code.trim().toLowerCase()
  const normTarget = target.trim().toLowerCase()
  if (!normCode || !normTarget) {
    return false
  }
  if (
    !Object.prototype.hasOwnProperty.call(ITEM_TYPES_EQUIV_113C, normCode) ||
    !Object.prototype.hasOwnProperty.call(ITEM_TYPES_EQUIV_113C, normTarget)
  ) {
    return false
  }
  if (normCode === normTarget) {
    return true
  }

  const cacheKey = `${normCode}:${normTarget}`
  const cached = canonicalItemTypeIsACache.get(cacheKey)
  if (cached !== undefined) {
    return cached
  }

  const visited = new Set<string>([normCode])
  const queue: string[] = [normCode]
  while (queue.length > 0) {
    const cur = queue.shift()!
    if (cur === normTarget) {
      canonicalItemTypeIsACache.set(cacheKey, true)
      return true
    }
    const entry = ITEM_TYPES_EQUIV_113C[cur]
    if (!entry) continue
    for (const parent of [entry.equiv1, entry.equiv2]) {
      if (!parent) continue
      if (parent === normTarget) {
        canonicalItemTypeIsACache.set(cacheKey, true)
        return true
      }
      if (!visited.has(parent) && Object.prototype.hasOwnProperty.call(ITEM_TYPES_EQUIV_113C, parent)) {
        visited.add(parent)
        queue.push(parent)
      }
    }
  }

  canonicalItemTypeIsACache.set(cacheKey, false)
  return false
}

