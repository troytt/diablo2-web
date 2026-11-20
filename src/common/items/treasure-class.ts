/**
 * Diablo II TreasureClassEx loader and indexer (`TreasureClassEx.txt`).
 *
 * `TreasureClassEx.txt` defines the loot drop hierarchy:
 * - Table structure: 852 data rows across 33 columns.
 * - Columns include TC name, group (1..18), level (0..96), picks (signed int),
 *   quality ratio modifiers (Unique, Set, Rare, Magic), NoDrop weight,
 *   and up to 10 item/probability pairs (Item1..10, Prob1..10).
 * - Prefix sums: precomputes `totalProbClassic`, `totalProbExpansion`,
 *   and `cumulativeProbExpansion` for O(1) interval sampling during drops.
 * - Item classification: classifies each item reference into sub-TCs (recursion),
 *   auto-TC virtual nodes, literal gold, gold multipliers, direct unique items,
 *   and base item codes.
 * - Group index: maps groups 1..18 with TCs sorted by level ascending.
 */
import type { D2Table } from '../world/acts.ts'
import { cell, parseTable } from '../world/acts.ts'
import type { MountedArchives } from '../mpq/mount.ts'
import { RAW_SET_ITEMS, RAW_UNIQUE_ITEMS } from '../data/canonical-drop-data.ts'
import { parseUniqueItemsTable, type UniqueItemsTable } from './unique-items.ts'
import { parseSetItemsTable, type SetItemTable } from './set-items.ts'

/** File path of `TreasureClassEx.txt` inside MPQ archives. */
export const TREASURE_CLASS_EX_TABLE_PATH = 'data\\global\\excel\\TreasureClassEx.txt'

/** Regex matching auto-TreasureClass virtual nodes (e.g. weap3..87, armo3..87, bow3..87, mele3..39). */
export const AUTO_TC_REGEX = /^(?:weap|armo|bow|mele)\d+$/

let _canonicalUniques: UniqueItemsTable | null = null
let _canonicalSets: SetItemTable | null = null

function getCanonicalUniqueItems(): UniqueItemsTable {
  if (!_canonicalUniques) {
    _canonicalUniques = parseUniqueItemsTable(parseTable(new TextEncoder().encode(RAW_UNIQUE_ITEMS)))
  }
  return _canonicalUniques
}

function getCanonicalSetItems(): SetItemTable {
  if (!_canonicalSets) {
    _canonicalSets = parseSetItemsTable(parseTable(new TextEncoder().encode(RAW_SET_ITEMS)))
  }
  return _canonicalSets
}

export interface ParseTreasureClassOptions {
  readonly uniques?: UniqueItemsTable | undefined
  readonly sets?: SetItemTable | undefined
}

export type ResolvedNamedTcItem =
  | { readonly kind: 'unique-item'; readonly uniqueIndex: number; readonly baseCode: string }
  | { readonly kind: 'set-item'; readonly setIndex: number; readonly baseCode: string }

/**
 * Resolves a named Unique or Set item reference in `TreasureClassEx.txt` `Item1..Item10`
 * per 1.13c `D2Common.dll` `0x6FDA4430` (`0x6FDA4540` `pUniqueItemsLinker` -> `0x6FDA4582` `pSetItemsLinker`).
 */
export function resolveNamedUniqueOrSetFromTcItem(
  rawItem: string,
  options?: ParseTreasureClassOptions,
): ResolvedNamedTcItem | undefined {
  const commaIdx = rawItem.indexOf(',')
  const itemKey = (commaIdx >= 0 ? rawItem.slice(0, commaIdx) : rawItem).trim()
  if (!itemKey) return undefined

  const uniques = options?.uniques ?? getCanonicalUniqueItems()
  const matchedUnique = uniques.byIndex.get(itemKey)
  if (matchedUnique && matchedUnique.code) {
    return {
      kind: 'unique-item',
      uniqueIndex: matchedUnique.id,
      baseCode: matchedUnique.code,
    }
  }

  const sets = options?.sets ?? getCanonicalSetItems()
  const matchedSet = sets.getByIndex(itemKey)
  if (matchedSet && matchedSet.item) {
    return {
      kind: 'set-item',
      setIndex: matchedSet.id,
      baseCode: matchedSet.item,
    }
  }

  return undefined
}

/**
 * Set of base items and TC names that only exist in Expansion (Lord of Destruction)
 * and cannot drop in Classic Diablo II mode.
 */
export const EXPANSION_ONLY_ITEMS: ReadonlySet<string> = new Set([
  // Jewels & Charms
  'jew',
  'cm1',
  'cm2',
  'cm3',
  // Essences & Keys (v1.11+ / 1.13c Pandemonium Event & Respec)
  'bet',
  'ceh',
  'dhn',
  'fed',
  'mbr',
  'pk1',
  'pk2',
  'pk3',
  'tes',
  'bey',
  // Elite base weapon explicitly present in table
  '7sm',
  // Expansion-only quest/event TCs
  'Countess Rune',
  'Countess Rune (N)',
  'Countess Rune (H)',
  'Pandemonium Key A',
  'Pandemonium Key B',
  'Pandemonium Key C',
  'Uber Andariel',
  'Uber Duriel',
  'Uber Izual',
  'ROP (H)',
])

/**
 * Tests whether an item or sub-TC is an auto-TreasureClass virtual node.
 */
export function isAutoTC(item: string): boolean {
  return AUTO_TC_REGEX.test(item)
}

/**
 * Checks whether an item or sub-TC reference is valid in Classic Diablo II mode.
 *
 * Excludes:
 * - Runes (`r01`..`r33`) and rune TCs (`Runes 1`..`Runes 17`, `Countess Rune*`)
 * - Charms (`cm1`..`cm3`) and jewels (`jew`)
 * - Named unique/set items resolved via `UniqueItems.txt` / `SetItems.txt` (`D2Common!0x6FDA457E` `0x11`, `0x6FDA45C0` `0x12`)
 * - Pandemonium event keys and essences
 * - Elite item `7sm`
 */
export function isClassicValidItem(item: string): boolean {
  if (EXPANSION_ONLY_ITEMS.has(item)) return false
  // D2Common.dll 0x6FDA457E (or al, 0x11) & 0x6FDA45C0 (or al, 0x12):
  // Named unique/set items in TreasureClassEx.txt always set flag 0x10 (Expansion-only).
  if (resolveNamedUniqueOrSetFromTcItem(item) !== undefined) return false
  // Runes r01..r33
  if (/^r(?:0[1-9]|[12]\d|3[0-3])$/.test(item)) return false
  // Rune treasure classes Runes 1..17
  if (/^Runes (?:1[0-7]|[1-9])$/.test(item)) return false
  return true
}

/**
 * Semantic classification of an item entry in a TreasureClass node.
 */
export type TreasureClassItemKind =
  | 'tc'
  | 'gold'
  | 'gold-multiplier'
  | 'auto-tc'
  | 'base-item'
  | 'unique-item'
  | 'set-item'

/**
 * An individual item or sub-TC candidate within a TreasureClass row.
 */
export interface TreasureClassItem {
  /** The item code or sub-TC name (surrounding quotes stripped). */
  readonly item: string
  /** Probability weight assigned to this item (Prob1..10 column). */
  readonly prob: number
  /** Semantic classification of this item. */
  readonly kind: TreasureClassItemKind
  /** Whether this reference is dangling (does not exist as a row in TreasureClassEx.txt). */
  readonly isDangling: boolean
  /** Whether this item can drop in Classic Diablo II. */
  readonly isClassic: boolean
  /** Multiplier for gold drops if kind is 'gold-multiplier' (e.g. 1280, 1536, 2048). */
  readonly multiplier?: number | undefined
  /** 0-based `UniqueItems.txt` row index when `kind === 'unique-item'` (`D2Common!0x6FDA4540`). */
  readonly uniqueIndex?: number | undefined
  /** 0-based `SetItems.txt` row index when `kind === 'set-item'` (`D2Common!0x6FDA4582`). */
  readonly setIndex?: number | undefined
  /** Resolved base item code when `kind === 'unique-item' | 'set-item'` (`pUniqueTxt->dwCode` / `pSetItemsTxt->dwCode`). */
  readonly baseCode?: string | undefined
}

/**
 * Definition of a TreasureClass row from `TreasureClassEx.txt`.
 */
export interface TreasureClassNode {
  /** Identifier name of the treasure class. */
  readonly name: string
  /** Group index (1..18), or undefined if this TC is ungrouped. */
  readonly group?: number | undefined
  /** Level requirement (0..96). */
  readonly level: number
  /** Number of picks (signed integer: -4, -3, -2, 1, 2, 3, 4, 5, 7). */
  readonly picks: number
  /** Unique item ratio modifier (fractions of 1024). */
  readonly unique: number
  /** Set item ratio modifier (fractions of 1024). */
  readonly set: number
  /** Rare item ratio modifier (fractions of 1024). */
  readonly rare: number
  /** Magic item ratio modifier (fractions of 1024). */
  readonly magic: number
  /** Probability weight for dropping nothing. */
  readonly noDrop: number
  /** All non-empty item candidates defined for this TC. */
  readonly items: readonly TreasureClassItem[]
  /** Sum of probability weights for items valid in Classic Diablo II. */
  readonly totalProbClassic: number
  /** Sum of probability weights for items in Expansion (LoD). */
  readonly totalProbExpansion: number
  /** Prefix sums of item probabilities: [Prob1, Prob1+Prob2, ...]. */
  readonly cumulativeProbExpansion: readonly number[]
}

import { CaseInsensitiveMap } from './tables.ts'

/**
 * Parsed and indexed collection of all TreasureClasses.
 */
export interface TreasureClassTable {
  /** All parsed treasure classes in file order (852 valid rows). */
  readonly all: TreasureClassNode[]
  /** Map of treasure classes keyed by name (supports case-insensitive lookup). */
  readonly byName: Map<string, TreasureClassNode>
  /** Map of treasure classes by group (1..18), sorted by level ascending. */
  readonly byGroup: Map<number, TreasureClassNode[]>
  /** Set of all 218 unique dangling references (100 auto-TC + 118 base item codes). */
  readonly danglingReferences: ReadonlySet<string>
  /** Set of all 100 unique auto-TC virtual node references. */
  readonly autoTCDanglingReferences: ReadonlySet<string>
  /** Set of all 118 unique base item and special references. */
  readonly baseItemDanglingReferences: ReadonlySet<string>
  /** Lookup a treasure class by name. */
  get(name: string): TreasureClassNode | undefined
}

/**
 * Concrete implementation of `TreasureClassTable`.
 */
class TreasureClassTableImpl implements TreasureClassTable {
  readonly all: TreasureClassNode[]
  readonly byName: Map<string, TreasureClassNode>
  readonly byGroup: Map<number, TreasureClassNode[]>
  readonly danglingReferences: ReadonlySet<string>
  readonly autoTCDanglingReferences: ReadonlySet<string>
  readonly baseItemDanglingReferences: ReadonlySet<string>

  constructor(
    all: TreasureClassNode[],
    byName: Map<string, TreasureClassNode>,
    byGroup: Map<number, TreasureClassNode[]>,
    danglingReferences: ReadonlySet<string>,
    autoTCDanglingReferences: ReadonlySet<string>,
    baseItemDanglingReferences: ReadonlySet<string>,
  ) {
    this.all = all
    this.byName = byName
    this.byGroup = byGroup
    this.danglingReferences = danglingReferences
    this.autoTCDanglingReferences = autoTCDanglingReferences
    this.baseItemDanglingReferences = baseItemDanglingReferences
  }

  get(name: string): TreasureClassNode | undefined {
    return this.byName.get(name)
  }
}

/**
 * Helper to extract an integer cell with a default fallback.
 */
function intCell(table: D2Table, row: readonly string[], column: string, fallback = 0): number {
  const value = cell(table, row, column).trim()
  if (value === '') return fallback
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? fallback : parsed
}

/**
 * Parses a `D2Table` representing `TreasureClassEx.txt` into an indexed `TreasureClassTable`.
 *
 * @param table - The parsed tab-separated table.
 * @param options - Optional `UniqueItemsTable` / `SetItemTable` overrides for named item resolution.
 * @returns The structured `TreasureClassTable`.
 */
export function parseTreasureClassTable(
  table: D2Table,
  options?: ParseTreasureClassOptions,
): TreasureClassTable {
  // Filter out blank rows (the table has 853 raw lines - 1 blank row = 852 real data rows)
  const validRows = table.rows.filter(row => cell(table, row, 'Treasure Class').trim() !== '')

  // First pass: collect all defined TC names for recursion resolution
  const tcNames = new Set<string>()
  for (const row of validRows) {
    tcNames.add(cell(table, row, 'Treasure Class').trim())
  }

  const all: TreasureClassNode[] = []
  const byName = new CaseInsensitiveMap<TreasureClassNode>()
  const byGroup = new Map<number, TreasureClassNode[]>()

  const danglingReferences = new Set<string>()
  const autoTCDanglingReferences = new Set<string>()
  const baseItemDanglingReferences = new Set<string>()

  for (const row of validRows) {
    const name = cell(table, row, 'Treasure Class').trim()
    const groupRaw = cell(table, row, 'group').trim()
    const group = groupRaw !== '' ? parseInt(groupRaw, 10) || undefined : undefined
    const level = intCell(table, row, 'level', 0)
    const picks = intCell(table, row, 'Picks', 0)
    const unique = intCell(table, row, 'Unique', 0)
    const set = intCell(table, row, 'Set', 0)
    const rare = intCell(table, row, 'Rare', 0)
    const magic = intCell(table, row, 'Magic', 0)
    const noDrop = intCell(table, row, 'NoDrop', 0)

    const items: TreasureClassItem[] = []
    let totalProbClassic = 0
    let totalProbExpansion = 0
    const cumulativeProbExpansion: number[] = []

    for (let i = 1; i <= 10; i++) {
      let rawItem = cell(table, row, `Item${i}`).trim()
      if (rawItem === '') continue

      // Strip surrounding double quotes if present (e.g. "gld,mul=1280")
      if (rawItem.startsWith('"') && rawItem.endsWith('"')) {
        rawItem = rawItem.slice(1, -1).trim()
      }

      const prob = intCell(table, row, `Prob${i}`, 0)

      let kind: TreasureClassItemKind
      let isDangling = false
      let multiplier: number | undefined
      let uniqueIndex: number | undefined
      let setIndex: number | undefined
      let baseCode: string | undefined

      if (tcNames.has(rawItem)) {
        kind = 'tc'
        isDangling = false
      } else {
        isDangling = true
        danglingReferences.add(rawItem)

        if (AUTO_TC_REGEX.test(rawItem)) {
          kind = 'auto-tc'
          autoTCDanglingReferences.add(rawItem)
        } else {
          baseItemDanglingReferences.add(rawItem)
          if (rawItem === 'gld') {
            kind = 'gold'
          } else if (rawItem.startsWith('gld,mul=')) {
            kind = 'gold-multiplier'
            const parsedMul = parseInt(rawItem.slice('gld,mul='.length), 10)
            multiplier = isNaN(parsedMul) ? undefined : parsedMul
          } else {
            const resolvedNamed = resolveNamedUniqueOrSetFromTcItem(rawItem, options)
            if (resolvedNamed?.kind === 'unique-item') {
              kind = 'unique-item'
              uniqueIndex = resolvedNamed.uniqueIndex
              baseCode = resolvedNamed.baseCode
            } else if (resolvedNamed?.kind === 'set-item') {
              kind = 'set-item'
              setIndex = resolvedNamed.setIndex
              baseCode = resolvedNamed.baseCode
            } else {
              kind = 'base-item'
            }
          }
        }
      }

      const isClassic =
        kind === 'unique-item' || kind === 'set-item' ? false : isClassicValidItem(rawItem)
      if (isClassic) {
        totalProbClassic += prob
      }
      totalProbExpansion += prob
      cumulativeProbExpansion.push(totalProbExpansion)

      items.push({
        item: rawItem,
        prob,
        kind,
        isDangling,
        isClassic,
        multiplier,
        ...(uniqueIndex !== undefined ? { uniqueIndex } : {}),
        ...(setIndex !== undefined ? { setIndex } : {}),
        ...(baseCode !== undefined ? { baseCode } : {}),
      })
    }

    const node: TreasureClassNode = {
      name,
      group,
      level,
      picks,
      unique,
      set,
      rare,
      magic,
      noDrop,
      items,
      totalProbClassic,
      totalProbExpansion,
      cumulativeProbExpansion,
    }

    all.push(node)
    byName.set(name, node)

    if (group !== undefined) {
      let groupList = byGroup.get(group)
      if (!groupList) {
        groupList = []
        byGroup.set(group, groupList)
      }
      groupList.push(node)
    }
  }

  // Sort each group ascending by level (Group index requirement)
  for (const groupList of byGroup.values()) {
    groupList.sort((a, b) => a.level - b.level)
  }

  return new TreasureClassTableImpl(
    all,
    byName,
    byGroup,
    danglingReferences,
    autoTCDanglingReferences,
    baseItemDanglingReferences,
  )
}

/**
 * Loads and parses `TreasureClassEx.txt` from mounted MPQ archives.
 *
 * @param archives - Mounted MPQ archives.
 * @returns Promise resolving to `TreasureClassTable`.
 */
export async function loadTreasureClasses(archives: MountedArchives): Promise<TreasureClassTable> {
  const bytes = await archives.read(TREASURE_CLASS_EX_TABLE_PATH)
  const d2Table = parseTable(bytes)
  return parseTreasureClassTable(d2Table)
}

/**
 * Resolves top-level TreasureClass group upgrade per Diablo II 1.13c rules (D2Game!6FC32D60).
 *
 * If initial TC has `group > 0`, searches candidate TCs in `tcTable.byGroup.get(group)`.
 * Selects the candidate with highest level that satisfies:
 *   `candidate.level <= nLevel && candidate.level >= initialNode.level`.
 * If no such candidate is found, returns the initialNode.
 *
 * @param tcTable - Parsed TreasureClassTable.
 * @param tcName - Base TreasureClass name from MonStats.
 * @param nLevel - Monster level (or area level).
 * @returns Upgraded or initial TreasureClassNode, or undefined if tcName is not found.
 */
export function resolveTreasureClassGroup(
  tcTable: TreasureClassTable,
  tcName: string,
  nLevel: number,
): TreasureClassNode | undefined {
  const initialNode = tcTable.byName.get(tcName)
  if (!initialNode) return undefined
  if (nLevel <= 0 || !initialNode.group || initialNode.group <= 0) return initialNode

  const idx = tcTable.all.indexOf(initialNode)
  if (idx !== -1) {
    let current = initialNode
    for (let i = idx + 1; i < tcTable.all.length; i++) {
      const next = tcTable.all[i]!
      if (next.group !== initialNode.group) break
      if (next.level < current.level) break // Stop when ascending sub-sequence ends
      if (next.level > nLevel) break
      current = next
    }
    return current
  }

  const candidates = tcTable.byGroup.get(initialNode.group)
  if (!candidates || candidates.length === 0) return initialNode

  let best = initialNode
  for (const candidate of candidates) {
    if (candidate.level <= nLevel && candidate.level >= initialNode.level) {
      if (candidate.level > best.level) {
        best = candidate
      }
    }
  }
  return best
}
