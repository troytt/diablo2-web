/**
 * Diablo II runtime auto-TreasureClass generation (`armo3..87`, `weap3..87`, `bow3..87`, `mele3..39`).
 *
 * Gold standard reference:
 * - 1.13c MPQ ItemTypes.txt, Armor.txt, Weapons.txt, and D2Mods KB #368.
 *
 * In Diablo II 1.10+, item types with `TreasureClass === 1` in `ItemTypes.txt` define auto-TC seeds:
 * - `bow` (Bow, rarity multiplier 3)
 * - `weap` (Weapon, rarity multiplier 3)
 * - `mele` (Melee Weapon, rarity multiplier 3)
 * - `armo` (Any Armor, rarity multiplier 3)
 * - `abow` (Amazon Bow, rarity multiplier 1)
 *
 * In 1.13c, `abow` is not referenced in TreasureClassEx rows. The referenced auto-TCs are:
 * - `weap3, weap6, ... weap87` (29 tiers, step 3)
 * - `armo3, armo6, ... armo87` (29 tiers, step 3)
 * - `bow3, bow6, ... bow87` (29 tiers, step 3)
 * - `mele3, mele6, ... mele39` (13 tiers, step 3)
 * Total: 29 + 29 + 29 + 13 = exactly 100 virtual auto-TC nodes.
 *
 * Bucket placement rule:
 * - For tier N, an item of matching type (using `isA` along Equiv chain from `item-types.ts`) belongs to bucket N if its `qlvl` (level in Armor/Weapons.txt) satisfies:
 *   `(N - 3) < qlvl <= N`. For tier 3, items have `1 <= qlvl <= 3`.
 * - ONLY items with `rarity > 0` are placed into auto-TC buckets!
 * - Item probability in the auto-TC bucket = `item.rarity`.
 */

import { isA, type ItemTypeTable } from '../../common/items/item-types.ts'
import type { ArmorTable } from '../../common/items/armor.ts'
import type { WeaponTable } from '../../common/items/weapons.ts'
import {
  isClassicValidItem,
  type TreasureClassItem,
  type TreasureClassNode,
  type TreasureClassTable,
} from '../../common/items/treasure-class.ts'

/** Supported auto-TC item type codes referenced in Diablo II 1.13c TreasureClassEx.txt. */
export type AutoTcTypeCode = 'weap' | 'armo' | 'bow' | 'mele'

/** Specification for an auto-TC series. */
export interface AutoTcSeriesSpec {
  /** Item type code seed. */
  readonly typeCode: AutoTcTypeCode
  /** Minimum tier level (always 3). */
  readonly minTier: number
  /** Maximum tier level (87 for weap/armo/bow, 39 for mele). */
  readonly maxTier: number
  /** Step increment between tiers (always 3). */
  readonly step: number
  /** Number of tiers in this series. */
  readonly count: number
}

/** The 4 auto-TC series referenced in Diablo II 1.13c TreasureClassEx.txt. */
export const AUTO_TC_SERIES: readonly AutoTcSeriesSpec[] = [
  { typeCode: 'weap', minTier: 3, maxTier: 87, step: 3, count: 29 },
  { typeCode: 'armo', minTier: 3, maxTier: 87, step: 3, count: 29 },
  { typeCode: 'bow', minTier: 3, maxTier: 87, step: 3, count: 29 },
  { typeCode: 'mele', minTier: 3, maxTier: 39, step: 3, count: 13 },
]

/** Total number of virtual auto-TreasureClass nodes in 1.13c (29 + 29 + 29 + 13 = 100). */
export const AUTO_TC_TOTAL_NODES = 100

/**
 * Precomputed set of all 100 canonical auto-TC node names.
 */
export const AUTO_TC_NAMES: ReadonlySet<string> = new Set(
  AUTO_TC_SERIES.flatMap(series => {
    const names: string[] = []
    for (let tier = series.minTier; tier <= series.maxTier; tier += series.step) {
      names.push(`${series.typeCode}${tier}`)
    }
    return names
  }),
)

import { CaseInsensitiveMap } from './tables.ts'

/**
 * An item candidate entry inside an auto-TreasureClass node.
 */
export interface AutoTcEntry {
  /** 3-4 character base item code (e.g. 'cap', 'hax'). */
  readonly itemCode: string
  /** Probability weight in the auto-TC bucket, equal to item.rarity. */
  readonly prob: number
}

/**
 * A virtual auto-TreasureClass node.
 */
export interface AutoTcNode {
  /** The auto-TC name (e.g. 'armo3', 'weap87'). */
  readonly name: string
  /** Group index, always 0 for auto-TC nodes. */
  readonly group: 0
  /** Level / tier requirement (e.g. 3, 6, ..., 87). */
  readonly level: number
  /** Number of item picks, always 1 for auto-TC nodes. */
  readonly picks: 1
  /** All eligible item entries in this tier bucket. */
  readonly entries: readonly AutoTcEntry[]
  /** Sum of all entry probabilities (weights). */
  readonly totalProb: number
}

/**
 * Parses an auto-TC name into its type code and tier.
 * Returns undefined if name is not one of the 100 valid auto-TC virtual node names.
 * Case-insensitive and trimmed.
 *
 * @param name - Auto-TC candidate name (e.g. 'armo3', 'weap87', 'mele39').
 * @returns Parsed { typeCode, tier } or undefined.
 */
export function parseAutoTcName(name: string): { typeCode: string; tier: number } | undefined {
  if (typeof name !== 'string') return undefined
  const trimmed = name.trim().toLowerCase()
  const match = trimmed.match(/^(weap|armo|bow|mele)(\d+)$/)
  if (!match) return undefined
  const typeCode = match[1]!
  const tier = parseInt(match[2]!, 10)
  const canonicalName = `${typeCode}${tier}`
  if (!AUTO_TC_NAMES.has(canonicalName)) {
    return undefined
  }
  return { typeCode, tier }
}

/**
 * Checks whether a given identifier is a valid auto-TreasureClass virtual node name
 * among the 100 canonical auto-TCs in Diablo II 1.13c.
 *
 * @param name - Name to test.
 */
export function isAutoTcName(name: string): boolean {
  return parseAutoTcName(name) !== undefined
}

/**
 * Generates all 100 virtual auto-TreasureClass nodes from ItemTypes, Armor, and Weapons tables.
 *
 * Rules:
 * - 4 types: weap (3..87), armo (3..87), bow (3..87), mele (3..39) in steps of 3 = 100 nodes.
 * - An item matches typeCode if `isA(item.type, typeCode, types)` or `(item.type2 && isA(item.type2, typeCode, types))`.
 * - For tier N: items must have `(N - 3) < qlvl <= N` (for tier 3, `1 <= qlvl <= 3`).
 * - Only items with `rarity > 0` are placed in the bucket.
 * - Each item's probability = `item.rarity`.
 * - Returned Map is keyed by auto-TC name and supports case-insensitive lookup.
 *
 * @param types - Parsed item types table (`ItemTypes.txt`).
 * @param armor - Parsed armor table (`Armor.txt`).
 * @param weapons - Parsed weapons table (`Weapons.txt`).
 * @returns Map of all 100 auto-TC nodes keyed by name.
 */
export function generateAutoTreasureClasses(
  types: ItemTypeTable,
  armor: ArmorTable,
  weapons: WeaponTable,
): Map<string, AutoTcNode> {
  const result = new CaseInsensitiveMap<AutoTcNode>()

  // Combine items in canonical table order: armor first, then weapons
  const allItems = [...armor.all, ...weapons.all]

  for (const series of AUTO_TC_SERIES) {
    for (let tier = series.minTier; tier <= series.maxTier; tier += series.step) {
      const name = `${series.typeCode}${tier}`
      const entries: AutoTcEntry[] = []
      let totalProb = 0

      for (const item of allItems) {
        if (item.rarity <= 0) continue
        const qlvl = item.level
        if (qlvl <= tier - 3 || qlvl > tier) continue

        const matches =
          isA(item.type, series.typeCode, types) ||
          (item.type2 ? isA(item.type2, series.typeCode, types) : false)

        if (matches) {
          entries.push({
            itemCode: item.code,
            prob: item.rarity,
          })
          totalProb += item.rarity
        }
      }

      const node: AutoTcNode = {
        name,
        group: 0,
        level: tier,
        picks: 1,
        entries,
        totalProb,
      }

      result.set(name, node)
    }
  }

  return result
}

/**
 * Converts an `AutoTcNode` into a full `TreasureClassNode` conforming to `TreasureClassEx.txt` structure.
 *
 * @param autoTc - The auto-TC virtual node to convert.
 * @returns Fully constructed `TreasureClassNode`.
 */
export function autoTcToTreasureClassNode(autoTc: AutoTcNode): TreasureClassNode {
  const items: TreasureClassItem[] = []
  let totalProbClassic = 0
  let totalProbExpansion = 0
  const cumulativeProbExpansion: number[] = []

  for (const entry of autoTc.entries) {
    const isClassic = isClassicValidItem(entry.itemCode)
    if (isClassic) {
      totalProbClassic += entry.prob
    }
    totalProbExpansion += entry.prob
    cumulativeProbExpansion.push(totalProbExpansion)

    items.push({
      item: entry.itemCode,
      prob: entry.prob,
      kind: 'base-item',
      isDangling: false,
      isClassic,
    })
  }

  return {
    name: autoTc.name,
    group: undefined,
    level: autoTc.level,
    picks: autoTc.picks,
    unique: 0,
    set: 0,
    rare: 0,
    magic: 0,
    noDrop: 0,
    items,
    totalProbClassic,
    totalProbExpansion,
    cumulativeProbExpansion,
  }
}

/**
 * Merges generated auto-TC virtual nodes into a `TreasureClassTable`, allowing seamless
 * resolution of auto-TC references via `table.get(name)` and `table.byName.get(name)`.
 *
 * @param tcTable - Target `TreasureClassTable` to enrich.
 * @param autoTcs - Map of generated `AutoTcNode`s.
 * @returns The mutated and enriched `TreasureClassTable`.
 */
export function mergeAutoTreasureClasses(
  tcTable: TreasureClassTable,
  autoTcs: Map<string, AutoTcNode>,
): TreasureClassTable {
  for (const autoNode of autoTcs.values()) {
    const tcNode = autoTcToTreasureClassNode(autoNode)
    const existing = tcTable.byName.get(tcNode.name)
    if (existing) {
      const idx = tcTable.all.indexOf(existing)
      if (idx !== -1) {
        tcTable.all[idx] = tcNode
      } else {
        tcTable.all.push(tcNode)
      }
    } else {
      tcTable.all.push(tcNode)
    }
    tcTable.byName.set(tcNode.name, tcNode)
  }
  return tcTable
}

/**
 * Queries a treasure class by name, checking regular TCs first and falling back
 * to auto-TC virtual nodes (converted to `TreasureClassNode`).
 *
 * @param tcTable - Base `TreasureClassTable`.
 * @param autoTcs - Map of generated `AutoTcNode`s.
 * @param name - Treasure class name to query.
 * @returns Found `TreasureClassNode` or undefined.
 */
export function queryTreasureClass(
  tcTable: TreasureClassTable,
  autoTcs: Map<string, AutoTcNode>,
  name: string,
): TreasureClassNode | undefined {
  const direct = tcTable.get(name)
  if (direct) return direct

  const autoNode = autoTcs.get(name)
  if (autoNode) {
    return autoTcToTreasureClassNode(autoNode)
  }
  return undefined
}

/**
 * Queries an auto-TC node directly from the auto-TC map.
 * Case-insensitive and trimmed.
 *
 * @param autoTcs - Map of generated `AutoTcNode`s.
 * @param name - Auto-TC name (e.g. 'armo3').
 * @returns Found `AutoTcNode` or undefined.
 */
export function queryAutoTreasureClass(
  autoTcs: Map<string, AutoTcNode>,
  name: string,
): AutoTcNode | undefined {
  return autoTcs.get(name)
}
