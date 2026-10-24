/**
 * 1.13c Diablo II TreasureClassEx Expansion Engine.
 *
 * Gold standard reference:
 * - D2Game!6FC32380 (TreasureClass roll execution and enumeration)
 * - D2Game!6FC32D60 (TreasureClass drop entry point / stack frame expansion)
 * - D2Game!6FC32690 (NoDrop player count scaling and item probability calculation)
 *
 * Architecture:
 * 1. 64-frame explicit stack:
 *    Avoids JavaScript call-stack overflow, enforces strict depth limits (<= 64),
 *    and supports deterministic pause/resume across nested sub-TC branches.
 * 2. Step budget guard:
 *    Terminates execution if total engine steps exceed MAX_STEP_BUDGET (10,000),
 *    preventing infinite loops from circular/self-referential custom tables.
 * 3. Precomputed prefix sum binary search:
 *    O(log K) interval sampling using precomputed cumulative probability arrays.
 * 4. Tail call reuse:
 *    When a parent frame has remaining picks == 0, its stack slot is reused
 *    directly for the child sub-TC, preventing unnecessary stack growth.
 * 5. Quality factor propagation:
 *    Child frames inherit quality modifiers (Unique, Set, Rare, Magic) using:
 *      child.qf[i] = (parent.qf[i] == 0) ? entry.qf[i] : Math.max(parent.qf[i], entry.qf[i])
 * 6. Deterministic enumeration for negative picks (`Picks < 0`):
 *    Bypasses NoDrop and RNG completely, iterating through items up to TotalProb.
 * 7. Double-precision NoDrop player count scaling (`Picks >= 0`):
 *    Calculated on EVERY pick:
 *      n = effectivePlayers = p + Math.trunc((g - p) / 2)
 *      if (NoDrop > 0 && n > 1):
 *        r = NoDrop / (NoDrop + TotalProb)
 *        NoDrop' = Math.trunc(TotalProb * (r ** n) / (1 - (r ** n)))
 *      else: NoDrop' = NoDrop
 * 8. Gold and forced quality flags:
 *    - `gld`: drops gold with multiplier 1.
 *    - `gld,mul=N`: drops gold with multiplier `N >> 8` (or `N / 256`).
 *    - `flags & 1`: forced unique item quality (skips quality roll).
 *    - `flags & 2`: forced set item quality (skips quality roll).
 */

import type { D2Rng } from '../rng/d2-rng.ts'
import {
  type TreasureClassTable,
  type TreasureClassNode,
  type TreasureClassItem,
  type TreasureClassItemKind,
  isAutoTC,
  isClassicValidItem,
} from './treasure-class.ts'

/** Maximum explicit stack depth allowed before throwing stack overflow error. */
export const MAX_STACK_DEPTH = 64

/** Maximum execution step budget allowed before aborting infinite recursion. */
export const MAX_STEP_BUDGET = 10000

/** Maximum items emitted per single monster/TC drop roll in 1.13c (D2Game!6FC51BB0). */
export const MAX_DROPPED_ITEMS = 6

/**
 * Quality factors array: [unique, set, rare, magic] (fractions of 1024).
 * Matches columns: Unique, Set, Rare, Magic in `TreasureClassEx.txt`.
 */
export type QualityFactors = [number, number, number, number]

/**
 * Virtual node representing an auto-TreasureClass (e.g. weap3..87, armo3..87, bow3..87, mele3..39).
 */
export interface AutoTcNode {
  readonly name: string
  readonly level?: number | undefined
  readonly picks?: number | undefined
  readonly unique?: number | undefined
  readonly set?: number | undefined
  readonly rare?: number | undefined
  readonly magic?: number | undefined
  readonly noDrop?: number | undefined
  readonly items: readonly (TreasureClassItem | {
    readonly item: string
    readonly prob: number
    readonly kind?: TreasureClassItemKind | undefined
    readonly isDangling?: boolean | undefined
    readonly isClassic?: boolean | undefined
    readonly multiplier?: number | undefined
  })[]
  readonly totalProbClassic?: number | undefined
  readonly totalProbExpansion?: number | undefined
  readonly cumulativeProbExpansion?: readonly number[] | undefined
  readonly flags?: number | undefined
}

/**
 * Execution context for rolling drops from a TreasureClass.
 */
export interface DropContext {
  /** 1.13c Diablo II Linear Congruential PRNG instance. */
  rng: D2Rng
  /** Total number of players in the game (defaults to 1). */
  gamePlayers?: number | undefined
  /** Number of party members nearby / in area (defaults to 1). */
  partyPlayers?: number | undefined
  /** Indexed TreasureClassEx table. */
  tcTable: TreasureClassTable
  /** Optional virtual auto-TreasureClass table (e.g. weap3, armo87). */
  autoTcTable?: Map<string, AutoTcNode> | undefined
  /** Whether Expansion (Lord of Destruction) items/runes are enabled (defaults to true). */
  isExpansion?: boolean | undefined
  /** Forced quality bitmask: 1 = forced unique, 2 = forced set. */
  flags?: number | undefined
  /** Maximum number of leaf items to emit (defaults to MAX_DROPPED_ITEMS = 6). */
  maxDrops?: number | undefined
}

/**
 * A single emitted item drop from TreasureClass expansion.
 */
export interface DroppedItemEntry {
  /** The item code (e.g. 'swd', 'rin', 'r01', 'gld'). */
  readonly code: string
  /** Alias for code matching item property. */
  readonly item: string
  /** Whether this drop represents gold. */
  readonly isGold: boolean
  /** Multiplier for gold drops if applicable (e.g. 5 for 1280 >> 8). */
  readonly goldMultiplier?: number | undefined
  /** Inherited quality factors [unique, set, rare, magic]. */
  readonly qualityFactors: QualityFactors
  /** Effective forced quality flags bitmask. */
  readonly flags: number
  /** Forced quality classification if set: 'unique' | 'set'. */
  readonly forcedQuality?: 'unique' | 'set' | undefined
  /** True if forced unique (flags & 1). */
  readonly forcedUnique: boolean
  /** True if forced set (flags & 2). */
  readonly forcedSet: boolean
}

/**
 * Calculates effective player count for NoDrop scaling:
 *   n = effectivePlayers = p + Math.trunc((g - p) / 2)
 *
 * @param gamePlayers - Total players in the game.
 * @param partyPlayers - Partied players nearby.
 * @returns Integer effective player count (>= 1).
 */
export function computeEffectivePlayers(gamePlayers?: number, partyPlayers?: number): number {
  const g = Math.max(1, Math.trunc(gamePlayers ?? 1))
  const p = Math.max(1, Math.min(g, Math.trunc(partyPlayers ?? 1)))
  return p + Math.trunc((g - p) / 2)
}

/**
 * Calculates player-scaled NoDrop weight using double precision floating point:
 *   if (NoDrop > 0 && n > 1):
 *     r = NoDrop / (NoDrop + TotalProb)
 *     NoDrop' = Math.trunc(TotalProb * (r ** n) / (1 - (r ** n)))
 *   else: NoDrop' = NoDrop
 *
 * @param noDrop - Base NoDrop weight from table row.
 * @param totalProb - Sum of probability weights for eligible items.
 * @param effectivePlayers - Effective player count (n).
 * @returns Scaled NoDrop weight (NoDrop').
 */
export function computeScaledNoDrop(noDrop: number, totalProb: number, effectivePlayers: number): number {
  if (noDrop <= 0 || effectivePlayers <= 1 || totalProb <= 0) {
    return Math.max(0, noDrop)
  }
  const r = noDrop / (noDrop + totalProb)
  const rn = Math.pow(r, effectivePlayers)
  if (rn >= 1) return 0
  const denom = 1 - rn
  if (denom <= 0) return 0
  return Math.trunc(totalProb * rn / denom)
}

/**
 * Propagates quality factors from parent frame to child frame:
 *   child.qf[i] = (parent.qf[i] == 0) ? entry.qf[i] : Math.max(parent.qf[i], entry.qf[i])
 *
 * @param parentQf - Quality factors of parent frame.
 * @param entryQf - Quality factors defined on child TC row.
 * @returns Newly combined QualityFactors tuple.
 */
export function propagateQualityFactors(parentQf: QualityFactors, entryQf: QualityFactors): QualityFactors {
  const result: QualityFactors = [0, 0, 0, 0]
  for (let i = 0; i < 4; i++) {
    result[i] = parentQf[i] === 0 ? entryQf[i] : Math.max(parentQf[i], entryQf[i])
  }
  return result
}

/**
 * Binary searches precomputed cumulative prefix sums for target value:
 * Finds the smallest index `i` such that `cumulativeProb[i] > target`.
 *
 * @param cumulativeProb - Prefix sum array [prob0, prob0+prob1, ...].
 * @param target - Target value in [0, TotalProb - 1].
 * @returns Index of matching item.
 */
export function binarySearchPrefixSum(cumulativeProb: readonly number[], target: number): number {
  let low = 0
  let high = cumulativeProb.length - 1
  let result = high
  while (low <= high) {
    const mid = (low + high) >> 1
    if (cumulativeProb[mid] > target) {
      result = mid
      high = mid - 1
    } else {
      low = mid + 1
    }
  }
  return result
}

/** Clean surrounding whitespace and quotes from an item or TC name. */
function cleanName(name: string): string {
  let s = name.trim()
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1).trim()
  }
  return s
}

/** Case-insensitive lookup in autoTcTable. */
function findAutoTc(autoTcTable: Map<string, AutoTcNode> | undefined, name: string): AutoTcNode | undefined {
  if (!autoTcTable) return undefined
  const direct = autoTcTable.get(name)
  if (direct !== undefined) return direct
  const lower = name.trim().toLowerCase()
  for (const [k, v] of autoTcTable.entries()) {
    if (k.trim().toLowerCase() === lower) return v
  }
  return undefined
}

/** Helper to construct a DroppedItemEntry complying with exactOptionalPropertyTypes. */
function buildDroppedItem(
  code: string,
  isGold: boolean,
  qualityFactors: QualityFactors,
  flags: number,
  goldMultiplier?: number | undefined,
  forcedQualityOverride?: 'unique' | 'set' | undefined,
): DroppedItemEntry {
  const forcedUnique = forcedQualityOverride === 'unique' || (flags & 1) !== 0
  const forcedSet = !forcedUnique && (forcedQualityOverride === 'set' || (flags & 2) !== 0)
  const forcedQuality: 'unique' | 'set' | undefined = forcedUnique ? 'unique' : forcedSet ? 'set' : undefined

  return {
    code,
    item: code,
    isGold,
    qualityFactors,
    flags,
    forcedUnique,
    forcedSet,
    ...(goldMultiplier !== undefined ? { goldMultiplier } : {}),
    ...(forcedQuality !== undefined ? { forcedQuality } : {}),
  }
}

/** Internal item representation ready for sampling or enumeration. */
interface ActiveItemEntry {
  readonly item: string
  readonly prob: number
  readonly multiplier?: number | undefined
}

/** A single frame on the explicit 64-frame stack. */
interface StackFrame {
  readonly node: TreasureClassNode | AutoTcNode
  readonly qf: QualityFactors
  readonly flags: number
  readonly isNegativePicks: boolean
  picksRemaining: number
  negativePickIndex: number
  // Negative picks enumeration list:
  readonly negativeItems?: readonly ActiveItemEntry[] | undefined
  // Positive picks precomputed items and prefix sums:
  readonly eligibleItems?: readonly ActiveItemEntry[] | undefined
  readonly totalProb?: number | undefined
  readonly cumulativeProb?: readonly number[] | undefined
}

/** Constructs an initialized stack frame for a TC node. */
function createFrame(
  node: TreasureClassNode | AutoTcNode,
  qf: QualityFactors,
  isExpansion: boolean,
  flags: number,
): StackFrame {
  const picks = node.picks ?? 1
  const nodeFlags = (node as any).flags ?? 0
  const combinedFlags = flags | nodeFlags

  if (picks < 0) {
    // Picks < 0: Deterministic enumeration up to TotalProb (each item repeated item.prob times)
    const negativeItems: ActiveItemEntry[] = []
    for (const it of node.items) {
      const itemCode = cleanName(typeof it === 'string' ? it : it.item)
      const prob = it.prob ?? 0
      if (prob <= 0) continue
      if (!isExpansion && !isClassicValidItem(itemCode)) continue
      const multiplier = (it as any).multiplier
      for (let k = 0; k < prob; k++) {
        negativeItems.push({
          item: itemCode,
          prob,
          ...(multiplier !== undefined ? { multiplier } : {}),
        })
      }
    }
    return {
      node,
      qf,
      flags: combinedFlags,
      isNegativePicks: true,
      picksRemaining: negativeItems.length,
      negativePickIndex: 0,
      negativeItems,
    }
  }

  // Picks >= 0: Probabilistic rolls
  let eligibleItems: ActiveItemEntry[]
  let totalProb: number
  let cumulativeProb: readonly number[]

  if (
    isExpansion &&
    'cumulativeProbExpansion' in node &&
    node.cumulativeProbExpansion &&
    node.cumulativeProbExpansion.length === node.items.length
  ) {
    eligibleItems = node.items.map(it => ({
      item: cleanName(it.item),
      prob: it.prob,
      ...((it as any).multiplier !== undefined ? { multiplier: (it as any).multiplier } : {}),
    }))
    totalProb = node.totalProbExpansion ?? 0
    cumulativeProb = node.cumulativeProbExpansion
  } else {
    eligibleItems = []
    const cProb: number[] = []
    let sum = 0
    for (const it of node.items) {
      const itemCode = cleanName(typeof it === 'string' ? it : it.item)
      const prob = it.prob ?? 0
      if (prob <= 0) continue
      if (!isExpansion && !isClassicValidItem(itemCode)) continue
      const multiplier = (it as any).multiplier
      eligibleItems.push({
        item: itemCode,
        prob,
        ...(multiplier !== undefined ? { multiplier } : {}),
      })
      sum += prob
      cProb.push(sum)
    }
    totalProb = sum
    cumulativeProb = cProb
  }

  return {
    node,
    qf,
    flags: combinedFlags,
    isNegativePicks: false,
    picksRemaining: Math.max(0, picks),
    negativePickIndex: 0,
    eligibleItems,
    totalProb,
    cumulativeProb,
  }
}

/**
 * Rolls a TreasureClass and expands all nested drops down to base item codes or gold.
 *
 * Implements:
 * - 64-frame explicit stack (stack overflow protection).
 * - Step budget guard (10,000 steps max).
 * - Quality factor propagation across frames.
 * - Tail call reuse when parent frame has remaining picks == 0.
 * - Deterministic enumeration for negative picks (`picks < 0`).
 * - Floating-point player-scaled NoDrop recalculation on every pick (`picks >= 0`).
 * - Gold multiplier handling (`gld,mul=N` -> `N >> 8`).
 * - Forced quality flags (`flags & 1` -> forced unique, `flags & 2` -> forced set).
 *
 * @param tcName - Name of the initial TreasureClass to roll.
 * @param context - Drop execution context (RNG, players, TC tables, mode).
 * @returns Array of dropped item entries.
 */
export function rollTreasureClass(tcName: string, context: DropContext): DroppedItemEntry[] {
  const isExpansion = context.isExpansion !== false
  const initialFlags = context.flags ?? 0
  const maxDrops = context.maxDrops ?? MAX_DROPPED_ITEMS
  if (maxDrops <= 0) {
    return []
  }

  const cleanedName = cleanName(tcName)
  const rootNode = context.tcTable.get(cleanedName) ?? findAutoTc(context.autoTcTable, cleanedName)
  if (!rootNode) {
    return []
  }

  // Initial root quality factors: propagate from [0, 0, 0, 0] to root's own factors
  const rootEntryQf: QualityFactors = [
    rootNode.unique ?? 0,
    rootNode.set ?? 0,
    rootNode.rare ?? 0,
    rootNode.magic ?? 0,
  ]
  const rootQf = propagateQualityFactors([0, 0, 0, 0], rootEntryQf)

  const rootFrame = createFrame(rootNode, rootQf, isExpansion, initialFlags)
  const stack: StackFrame[] = [rootFrame]
  const drops: DroppedItemEntry[] = []

  let steps = 0

  while (stack.length > 0 && drops.length < maxDrops) {
    steps++
    if (steps > MAX_STEP_BUDGET) {
      throw new Error(`TreasureClass step budget exceeded: ${MAX_STEP_BUDGET} steps`)
    }

    const frame = stack[stack.length - 1]!

    if (frame.picksRemaining <= 0) {
      stack.pop()
      continue
    }

    // Decrement remaining picks for this frame
    frame.picksRemaining--
    const remainingPicks = frame.picksRemaining

    let selectedItem: string
    let itemMultiplier: number | undefined

    if (frame.isNegativePicks) {
      // Deterministic enumeration: bypass NoDrop and RNG completely
      const entry = frame.negativeItems![frame.negativePickIndex++]!
      selectedItem = entry.item
      itemMultiplier = entry.multiplier
    } else {
      // Positive picks: calculate NoDrop' with player scaling
      const effectivePlayers = computeEffectivePlayers(context.gamePlayers, context.partyPlayers)
      const baseNoDrop = frame.node.noDrop ?? 0
      const totalProb = frame.totalProb ?? 0

      const scaledNoDrop = computeScaledNoDrop(baseNoDrop, totalProb, effectivePlayers)
      const totalWeight = scaledNoDrop + totalProb

      if (totalWeight <= 0) {
        // Nothing can drop
        if (remainingPicks === 0) {
          stack.pop()
        }
        continue
      }

      const roll = context.rng.rand(totalWeight)

      if (roll < scaledNoDrop) {
        // NoDrop roll: this pick drops nothing
        if (remainingPicks === 0) {
          stack.pop()
        }
        continue
      }

      // Hit an item: binary search on prefix sums for roll - scaledNoDrop
      const target = roll - scaledNoDrop
      const itemIndex = binarySearchPrefixSum(frame.cumulativeProb!, target)
      const entry = frame.eligibleItems![itemIndex]!
      selectedItem = entry.item
      itemMultiplier = entry.multiplier
    }

    // Effective flags for this item
    let effectiveFlags = frame.flags
    if (selectedItem === 'Annihilus') {
      effectiveFlags |= 1
    }

    // Classify node: Gold, Sub-TC, Auto-TC, or Base item
    if (selectedItem === 'gld') {
      drops.push(buildDroppedItem('gld', true, frame.qf, effectiveFlags, 1))
      if (remainingPicks === 0) {
        stack.pop()
      }
      continue
    }

    if (selectedItem.startsWith('gld,mul=')) {
      let rawMul = itemMultiplier
      if (rawMul === undefined) {
        const parsed = parseInt(selectedItem.slice('gld,mul='.length), 10)
        rawMul = isNaN(parsed) ? 256 : parsed
      }
      const goldMultiplier = rawMul >> 8
      drops.push(buildDroppedItem('gld', true, frame.qf, effectiveFlags, goldMultiplier))
      if (remainingPicks === 0) {
        stack.pop()
      }
      continue
    }

    // Check if sub-TC in tcTable or auto-TC in autoTcTable
    const childNode = context.tcTable.get(selectedItem) ?? findAutoTc(context.autoTcTable, selectedItem)

    if (childNode !== undefined) {
      // Sub-TC or Auto-TC: propagate quality factors and push/tail-call frame
      const childEntryQf: QualityFactors = [
        childNode.unique ?? 0,
        childNode.set ?? 0,
        childNode.rare ?? 0,
        childNode.magic ?? 0,
      ]
      const childQf = propagateQualityFactors(frame.qf, childEntryQf)
      const childFrame = createFrame(childNode, childQf, isExpansion, effectiveFlags)

      if (remainingPicks === 0) {
        // Tail call reuse: reuse parent frame's slot
        stack[stack.length - 1] = childFrame
      } else {
        // Push to stack: check max depth limit
        if (stack.length >= MAX_STACK_DEPTH) {
          throw new Error(`TreasureClass stack overflow: exceeded maximum depth of ${MAX_STACK_DEPTH}`)
        }
        stack.push(childFrame)
      }
      continue
    }

    // Leaf item drop (Base item code, Annihilus, or unexpanded auto-TC reference)
    drops.push(
      buildDroppedItem(
        selectedItem,
        false,
        frame.qf,
        effectiveFlags,
        undefined,
        selectedItem === 'Annihilus' ? 'unique' : undefined,
      ),
    )

    if (remainingPicks === 0) {
      stack.pop()
    }
  }

  return drops
}

/** Alias for rollTreasureClass conforming to spec nomenclature. */
export const expandTreasureClass = rollTreasureClass

export { resolveTreasureClassGroup } from './treasure-class.ts'

