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
 *    Bypasses NoDrop and RNG completely (`0x6FC32498 -> 0x6FC3263F`), initializing
 *    `picksRemaining = max(|Picks|, 1)` (`0x6FC323DE..0x6FC323F8`, `0x6FC32764..0x6FC32786`)
 *    and picking at most `min(|Picks|, TotalProb)` times (`0x6FC3264D: cmp esi, TotalProb; jge pop`),
 *    selecting the item whose cumulative probability interval contains `k` (`0 <= k < min(|Picks|, TotalProb)`).
 * 7. Double-precision NoDrop player count scaling (`Picks >= 0`):
 *    Calculated on EVERY pick:
 *      n = effectivePlayers = p + Math.trunc((g - p) / 2)
 *      if (NoDrop > 0 && n > 1):
 *        r = NoDrop / (NoDrop + TotalProb)
 *        NoDrop' = Math.trunc(TotalProb * (r ** n) / (1 - (r ** n)))
 *      else: NoDrop' = NoDrop
 * 8. Gold and forced quality flags:
 *    - `gld`: drops gold with no TC multiplier (`wParam = 0`).
 *    - `gld,mul=N`: drops gold with raw WORD `wParam = N & 0xffff` (scaled as `(gold * wParam) >> 8` at `D2Game!0x6FC32A2C..0x6FC32A59`).
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
  resolveNamedUniqueOrSetFromTcItem,
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
  /**
   * Monster spawn player count (`stat 100 = monster_playercount`, set at monster initialization
   * `D2Game!0x6FCCF840` / `0x6FCCFF3B`). When defined (drop source is a monster, `0x6FC3250C`),
   * caps effective player count `n = min(n, max(1, monsterPlayerCount))` (`0x6FC32511..0x6FC32529`).
   */
  monsterPlayerCount?: number | undefined
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
  /**
   * 1.13c `D2Game.dll` `SrvDo072_FindItem` (`0x6FC476D0` -> `0x6FCFE290` / `0x6FC32720`, `a7 = 1`, #1810):
   * When true, skips `NoDrop` weight on every TreasureClass pick (`scaledNoDrop = 0`).
   */
  ignoreNoDrop?: boolean | undefined
  /** Alias for `ignoreNoDrop` (`noDropZero = true`). */
  noDropZero?: boolean | undefined
}

/**
 * A single emitted item drop from TreasureClass expansion.
 */
export interface DroppedItemEntry {
  /** The item code (e.g. 'swd', 'rin', 'r01', 'gld', or resolved base code 'cm1' for named uniques). */
  readonly code: string
  /** Raw TC item reference (or code when not a named unique/set). */
  readonly item: string
  /** Whether this drop represents gold. */
  readonly isGold: boolean
  /** Raw 16-bit TC `mul` parameter for gold drops if applicable (`D2Common!0x6FDA4614`: `wParam = N & 0xffff`, scaled via `(gold * wParam) >> 8` at `D2Game!0x6FC32A2C..0x6FC32A59`). */
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
  /** 0-based `UniqueItems.txt` row index when dropped from a named unique TC leaf (`D2Common!0x6FDA4540`, `D2Game!0x6FC328C8`). */
  readonly uniqueIndex?: number | undefined
  /** 0-based `SetItems.txt` row index when dropped from a named set TC leaf (`D2Common!0x6FDA4582`, `D2Game!0x6FC328EF`). */
  readonly setIndex?: number | undefined
}

/**
 * Calculates effective player count for NoDrop scaling (`D2Game!0x6FC324B5..0x6FC32529`):
 *   p = clamp(partyPlayers, 1, min(8, g))
 *   n = p + Math.trunc((g - p) / 2)
 *   if (monsterPlayerCount !== undefined):
 *     n = Math.min(n, Math.max(1, Math.trunc(monsterPlayerCount)))
 *
 * @param gamePlayers - Total players in the game.
 * @param partyPlayers - Partied players nearby (clamped to <= 8 at 0x6FC324E9).
 * @param monsterPlayerCount - Optional monster_playercount (stat 100) recorded when the monster spawned (0x6FC32511).
 * @returns Integer effective player count (>= 1).
 */
export function computeEffectivePlayers(
  gamePlayers?: number,
  partyPlayers?: number,
  monsterPlayerCount?: number,
): number {
  const g = Math.max(1, Math.trunc(gamePlayers ?? 1))
  const p = Math.max(1, Math.min(8, g, Math.trunc(partyPlayers ?? 1)))
  const n = p + Math.trunc((g - p) / 2)
  if (monsterPlayerCount !== undefined) {
    return Math.min(n, Math.max(1, Math.trunc(monsterPlayerCount)))
  }
  return n
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
  rawItem?: string | undefined,
  uniqueIndex?: number | undefined,
  setIndex?: number | undefined,
): DroppedItemEntry {
  const forcedUnique = forcedQualityOverride === 'unique' || (flags & 1) !== 0
  const forcedSet = !forcedUnique && (forcedQualityOverride === 'set' || (flags & 2) !== 0)
  const forcedQuality: 'unique' | 'set' | undefined = forcedUnique ? 'unique' : forcedSet ? 'set' : undefined

  return {
    code,
    item: rawItem ?? code,
    isGold,
    qualityFactors,
    flags,
    forcedUnique,
    forcedSet,
    ...(goldMultiplier !== undefined ? { goldMultiplier } : {}),
    ...(forcedQuality !== undefined ? { forcedQuality } : {}),
    ...(uniqueIndex !== undefined ? { uniqueIndex } : {}),
    ...(setIndex !== undefined ? { setIndex } : {}),
  }
}

/** Internal item representation ready for sampling or enumeration. */
interface ActiveItemEntry {
  readonly item: string
  readonly prob: number
  readonly kind?: TreasureClassItemKind | undefined
  readonly multiplier?: number | undefined
  readonly uniqueIndex?: number | undefined
  readonly setIndex?: number | undefined
  readonly baseCode?: string | undefined
}

function toActiveItemEntry(it: TreasureClassItem | {
  readonly item: string
  readonly prob: number
  readonly kind?: TreasureClassItemKind | undefined
  readonly multiplier?: number | undefined
  readonly uniqueIndex?: number | undefined
  readonly setIndex?: number | undefined
  readonly baseCode?: string | undefined
}): ActiveItemEntry {
  const itemCode = cleanName(typeof it === 'string' ? it : it.item)
  const multiplier = (it as any).multiplier as number | undefined
  let kind = (it as any).kind as TreasureClassItemKind | undefined
  let uniqueIndex = (it as any).uniqueIndex as number | undefined
  let setIndex = (it as any).setIndex as number | undefined
  let baseCode = (it as any).baseCode as string | undefined

  if (
    (kind === 'unique-item' || kind === 'set-item') &&
    (baseCode === undefined || (uniqueIndex === undefined && setIndex === undefined))
  ) {
    const resolved = resolveNamedUniqueOrSetFromTcItem(itemCode)
    if (resolved?.kind === 'unique-item') {
      uniqueIndex = uniqueIndex ?? resolved.uniqueIndex
      baseCode = baseCode ?? resolved.baseCode
    } else if (resolved?.kind === 'set-item') {
      setIndex = setIndex ?? resolved.setIndex
      baseCode = baseCode ?? resolved.baseCode
    }
  }

  return {
    item: itemCode,
    prob: it.prob ?? 0,
    ...(kind !== undefined ? { kind } : {}),
    ...(multiplier !== undefined ? { multiplier } : {}),
    ...(uniqueIndex !== undefined ? { uniqueIndex } : {}),
    ...(setIndex !== undefined ? { setIndex } : {}),
    ...(baseCode !== undefined ? { baseCode } : {}),
  }
}

/** A single frame on the explicit 64-frame stack. */
interface StackFrame {
  readonly node: TreasureClassNode | AutoTcNode
  readonly qf: QualityFactors
  readonly flags: number
  readonly isNegativePicks: boolean
  picksRemaining: number
  negativePickIndex: number
  // Precomputed eligible items and prefix sums (shared by Picks < 0 and Picks >= 0):
  readonly eligibleItems: readonly ActiveItemEntry[]
  readonly totalProb: number
  readonly cumulativeProb: readonly number[]
}

/**
 * Constructs an initialized stack frame for a TC node.
 *
 * Per 1.13c `D2Game!ITEMS_RollTreasureClass` (`0x6FC323DE..0x6FC323F8` & `0x6FC32764..0x6FC32786`):
 * - Both positive and negative `Picks` initialize `picksRemaining = Math.max(1, Math.abs(picks))`
 *   (so `Picks = 0` is clamped to `1`, and `Picks < 0` uses `-picks`).
 * - Both branches share the same `eligibleItems`, `totalProb`, and `cumulativeProb` prefix sums.
 */
function createFrame(
  node: TreasureClassNode | AutoTcNode,
  qf: QualityFactors,
  isExpansion: boolean,
  flags: number,
): StackFrame {
  const picks = node.picks ?? 1
  const nodeFlags = (node as any).flags ?? 0
  const combinedFlags = flags | nodeFlags

  let eligibleItems: ActiveItemEntry[]
  let totalProb: number
  let cumulativeProb: readonly number[]

  if (
    isExpansion &&
    'cumulativeProbExpansion' in node &&
    node.cumulativeProbExpansion &&
    node.cumulativeProbExpansion.length === node.items.length
  ) {
    eligibleItems = node.items.map(it => toActiveItemEntry(it))
    totalProb = node.totalProbExpansion ?? 0
    cumulativeProb = node.cumulativeProbExpansion
  } else {
    eligibleItems = []
    const cProb: number[] = []
    let sum = 0
    for (const it of node.items) {
      const entry = toActiveItemEntry(it)
      if (entry.prob <= 0) continue
      if (
        !isExpansion &&
        (entry.kind === 'unique-item' || entry.kind === 'set-item' || !isClassicValidItem(entry.item))
      ) {
        continue
      }
      eligibleItems.push(entry)
      sum += entry.prob
      cProb.push(sum)
    }
    totalProb = sum
    cumulativeProb = cProb
  }

  return {
    node,
    qf,
    flags: combinedFlags,
    isNegativePicks: picks < 0,
    picksRemaining: Math.max(1, Math.abs(picks)),
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
 * - Gold multiplier handling (`gld,mul=N` -> raw WORD `wParam = N & 0xffff`, scaled via `(gold * wParam) >> 8`).
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

    if (frame.picksRemaining <= 0 || frame.totalProb <= 0) {
      stack.pop()
      continue
    }

    let selectedEntry: ActiveItemEntry
    let remainingPicks: number

    if (frame.isNegativePicks) {
      // D2Game!0x6FC3263F..0x6FC326C8:
      // esi = k = |Picks| - picksRemaining (0-based pick index).
      // If k >= TotalProb, terminate this frame immediately (0x6FC3264D: cmp esi, TotalProb; jge 0x6FC32AB0).
      const k = frame.negativePickIndex++
      if (k >= frame.totalProb) {
        stack.pop()
        continue
      }
      frame.picksRemaining--
      remainingPicks = frame.picksRemaining
      const itemIndex = binarySearchPrefixSum(frame.cumulativeProb, k)
      selectedEntry = frame.eligibleItems[itemIndex]!
    } else {
      // Positive picks: decrement remaining picks and calculate NoDrop' with player scaling
      frame.picksRemaining--
      remainingPicks = frame.picksRemaining
      const effectivePlayers = computeEffectivePlayers(
        context.gamePlayers,
        context.partyPlayers,
        context.monsterPlayerCount,
      )
      const baseNoDrop = frame.node.noDrop ?? 0
      const totalProb = frame.totalProb

      const scaledNoDrop =
        context.ignoreNoDrop === true || context.noDropZero === true
          ? 0
          : computeScaledNoDrop(baseNoDrop, totalProb, effectivePlayers)
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
      const itemIndex = binarySearchPrefixSum(frame.cumulativeProb, target)
      selectedEntry = frame.eligibleItems[itemIndex]!
    }

    const selectedItem = selectedEntry.item
    const itemMultiplier = selectedEntry.multiplier
    const isNamedUnique = selectedEntry.kind === 'unique-item' || selectedEntry.uniqueIndex !== undefined
    const isNamedSet = !isNamedUnique && (selectedEntry.kind === 'set-item' || selectedEntry.setIndex !== undefined)

    // Effective flags for this item (D2Game!0x6FC328C8..0x6FC328EF: TCFLAG_UNIQUE=0x01, TCFLAG_SET=0x02)
    let effectiveFlags = frame.flags
    if (isNamedUnique) {
      effectiveFlags |= 1
    } else if (isNamedSet) {
      effectiveFlags |= 2
    }

    // Classify node: Gold, Sub-TC, Auto-TC, or Base/Named item
    // D2Common!0x6FDA4614..0x6FDA47A7 stores `,mul=N` as raw 16-bit WORD `wParam` at `pTcItem+0x0A` (0 when absent);
    // D2Game!0x6FC32A1A..0x6FC32A59 applies `(baseGold * wParam) >> 8` only when `wParam != 0`.
    if (selectedItem === 'gld') {
      const goldMultiplier = itemMultiplier !== undefined ? (itemMultiplier & 0xffff) : undefined
      drops.push(buildDroppedItem('gld', true, frame.qf, effectiveFlags, goldMultiplier))
      if (remainingPicks === 0) {
        stack.pop()
      }
      continue
    }

    if (selectedItem.startsWith('gld,mul=')) {
      let rawMul = itemMultiplier
      if (rawMul === undefined) {
        const parsed = parseInt(selectedItem.slice('gld,mul='.length), 10)
        rawMul = isNaN(parsed) ? 0 : parsed
      }
      const goldMultiplier = rawMul & 0xffff
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

    // Leaf item drop (Base item code, resolved named unique/set baseCode, or unexpanded auto-TC reference)
    const leafCode = selectedEntry.baseCode ?? selectedItem
    drops.push(
      buildDroppedItem(
        leafCode,
        false,
        frame.qf,
        effectiveFlags,
        undefined,
        isNamedUnique ? 'unique' : isNamedSet ? 'set' : undefined,
        selectedItem,
        selectedEntry.uniqueIndex,
        selectedEntry.setIndex,
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

