/**
 * Diablo II 1.13c item transaction pricing, ported from `D2Common.dll`.
 *
 * - `#10107` (`ITEMS_GetTransactionCost`) is a thunk at `0x6fd79d60` that
 *   forwards to the real body at `0x6fd78e80`. That body is
 *   {@link computeTransactionCost113c}.
 * - `#10071` at `0x6fd7a210` totals the repair cost of everything the player
 *   has equipped. That is {@link computeRepairAllCost113c}.
 *
 * Every branch carries the address it was read from. All arithmetic is int32
 * (`Math.imul`, `| 0`, truncating division), as the x86 code does it,
 * including the asm's quirks; those are marked `(sic)`.
 *
 * The input does not depend on any protocol. A client fills it from a
 * server item packet; a server fills it from its own unit. The caller must
 * supply the item's stat list (`full` and `base` values, the same split as
 * `STATLIST_GetUnitStat*` 0x6fd88a80 / 0x6fd88b00). Durability, quantity, base
 * defense and the like are read from that list, as the asm does.
 *
 * Names used below:
 * - A = player buy price (vendor's "sell" side; Npc.txt `sell mult`).
 * - B = player sell price (vendor's "buy" side; Npc.txt `buy mult`). The asm
 *   later moves it into `ebp`.
 * - C = repair base. The asm later moves it into `edi`.
 * - D = divisor applied to affix terms (stack size for stackables).
 */
import { RAW_ARMOR, RAW_ITEM_TYPES, RAW_MAGIC_PREFIX, RAW_MAGIC_SUFFIX, RAW_MISC, RAW_MONSTATS, RAW_SET_ITEMS, RAW_UNIQUE_ITEMS, RAW_WEAPONS } from '../data/canonical-drop-data.ts'
import { CANONICAL_SKILL_COSTS, RAW_BOOKS, RAW_ITEM_STAT_COST, RAW_NPC } from '../data/canonical-vendor-data.ts'
import { SKILLS_BY_ID } from '../data/skills-catalog.ts'
import { parseTable, type D2Table } from '../world/acts.ts'
import { CANONICAL_AUTOMAGIC_TSV } from './automagic.ts'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * `D2C_TransactionTypes`: 0 = buy, 1 = sell, 2 = gamble, 3 = repair.
 */
export type TransactionType113c = 0 | 1 | 2 | 3

/** One entry of the item's stat list. */
export interface TransactionCostStat {
  readonly statId: number
  /** Stat param (layer). Skill stats carry the skill id, or `skill << 6 | level`. */
  readonly param: number
  /** Accumulated value (`0x6fd88a80`). */
  readonly value: number
  /** Value in the item's own base list (`0x6fd88b00`). Magic properties are excluded. */
  readonly base: number
}

/** Item quality as defined by `D2C_ItemQuality` (1 = low ... 9 = tempered). */
export type ItemQuality113c = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** What the pricing reads from one item. Ids are the ones the item packet carries. */
export interface TransactionCostInput {
  /** ItemsTxt code (`szCode`, 3-4 chars). */
  readonly code: string
  /**
   * `ItemData.wItemFormat` (+0x30), which is the packet's 10-bit `version`
   * field. Only the gamble branch reads it (0x6fd78f38).
   */
  readonly itemFormat: number
  readonly quality: ItemQuality113c
  /** `IFLAG_IDENTIFIED` (0x10). */
  readonly identified: boolean
  /** `IFLAG_ETHEREAL` (0x400000). */
  readonly ethereal: boolean
  /** `IFLAG_STARTER` (0x20000). */
  readonly starterItem: boolean
  /** `IFLAG_ISEAR` (0x10000). */
  readonly isEar: boolean
  /** Ear level (`ItemData+0x48`). Required when `isEar`. */
  readonly earLevel?: number | undefined
  /** MonStats index (hcIdx) stored in `dwFileIndex` of a body part. Required for `body` items. */
  readonly bodyPartMonsterClass?: number | undefined
  /** Books.txt row (`wMagicSuffix[0]`, the packet's 5-bit tome/scroll id). Required for `book` items. */
  readonly bookId?: number | undefined
  /** Packet magic prefix id: 1-based into MagicPrefix.txt, 0 = none. Required for quality 4, and for 7 when the unique id is invalid. */
  readonly magicPrefixId?: number | undefined
  /** Packet magic suffix id: 1-based into MagicSuffix.txt, 0 = none. */
  readonly magicSuffixId?: number | undefined
  /** Three packet prefix ids for rare/crafted items (0 = none). */
  readonly rarePrefixIds?: readonly [number, number, number] | undefined
  /** Three packet suffix ids for rare/crafted items (0 = none). */
  readonly rareSuffixIds?: readonly [number, number, number] | undefined
  /** Packet automagic id: 1-based into AutoMagic.txt, 0 = none. */
  readonly autoAffixId?: number | undefined
  /** UniqueItems.txt record index (`dwFileIndex`). Required for quality 7. */
  readonly uniqueItemId?: number | undefined
  /** SetItems.txt record index (`dwFileIndex`). Required for quality 5. */
  readonly setItemId?: number | undefined
  /** The item's stat list (full and base values). */
  readonly stats: readonly TransactionCostStat[]
  /** ItemsTxt codes of the items socketed into this one. */
  readonly socketedChildCodes: readonly string[]
}

/** Item-independent state of the transaction. */
export interface TransactionCostContext {
  /** Player `STAT_LEVEL` (12). */
  readonly playerLevel: number
  /** Player full `STAT_ITEM_REDUCEDPRICES` (87). The asm only caps it at 99. */
  readonly playerReducedPricesPct: number
  readonly difficulty: 0 | 1 | 2
  /** MonStats index (hcIdx) of the NPC (`Npc.txt` is searched on it). Not read for gamble. */
  readonly npcClass: number
  /** Quest-flag test `0x6fd7d0f0`: bit `quest * 16 + state` of the player's quest record. */
  readonly isQuestFlagSet: (questId: number, state: 0 | 1) => boolean
  readonly tables: TransactionCostTables
}

export interface ItemsTxtCostRecord {
  readonly code: string
  readonly type: string
  readonly type2: string
  /** +0xe0 */
  readonly cost: number
  /** +0xd4 */
  readonly gambleCost: number
  /** +0xe4 / +0xe8 */
  readonly minStack: number
  readonly maxStack: number
  /** +0x132 */
  readonly stackable: boolean
  /** +0x112 (byte) */
  readonly durability: number
  /** +0x113 */
  readonly noDurability: boolean
  /** +0xfd (byte) */
  readonly level: number
  /** +0x84 / +0x88 / +0x8c. Empty string when the field is 0. */
  readonly normCode: string
  readonly uberCode: string
  readonly ultraCode: string
  /** +0xcc / +0xd0 */
  readonly minAc: number
  readonly maxAc: number
}

export interface ItemTypeCostRecord {
  readonly code: string
  readonly equiv1: string
  readonly equiv2: string
  /** +0x08 */
  readonly repair: boolean
  /** +0x0e: the `Quiver` word is non-zero */
  readonly quiver: boolean
  /** +0x10 */
  readonly throwable: boolean
  /** +0x1f: `StaffMods` is a class (not 7 = none) */
  readonly staffMods: boolean
  /** +0x21: `Class` < 7 */
  readonly classSpecific: boolean
}

export interface CostMultAdd {
  readonly name: string
  readonly multiply: number
  readonly add: number
}

export interface ItemStatCostRecord {
  readonly id: number
  /** +0x30 */
  readonly encode: number
  /** +0x14 */
  readonly add: number
  /** +0x10 */
  readonly multiply: number
  /** +0x18 */
  readonly valShift: number
}

export interface SkillCostRecord {
  readonly id: number
  /** Skills.txt +0x234 */
  readonly costMult: number
  /** Skills.txt +0x238 */
  readonly costAdd: number
  /** Skills.txt +0x174. Undefined when the embedded data has no value; recharge pricing then throws. */
  readonly reqLevel: number | undefined
}

export interface BookCostRecord {
  readonly name: string
  /** +0x10. The pricing does not read it (it uses ItemsTxt cost). */
  readonly baseCost: number
  /** +0x14 */
  readonly costPerCharge: number
}

export interface NpcCostRecord {
  readonly name: string
  /** +0x00: MonStats hcIdx */
  readonly npcClass: number
  /** +0x04: Npc.txt `sell mult`, applied to A (player buy price) */
  readonly sellMult: number
  /** +0x08: Npc.txt `buy mult`, applied to B (player sell price) */
  readonly buyMult: number
  /** +0x0c */
  readonly repMult: number
  /** +0x10 */
  readonly questFlags: readonly [number, number, number]
  /** +0x1c, applied to A */
  readonly questSellMults: readonly [number, number, number]
  /** +0x28, applied to B */
  readonly questBuyMults: readonly [number, number, number]
  /** +0x34 */
  readonly questRepMults: readonly [number, number, number]
  /** +0x40, one per difficulty */
  readonly maxBuy: readonly [number, number, number]
}

/** Compiled data the pricing reads. Build it with {@link buildTransactionCostTables}. */
export interface TransactionCostTables {
  readonly items: ReadonlyMap<string, ItemsTxtCostRecord>
  readonly itemTypes: ReadonlyMap<string, ItemTypeCostRecord>
  /** Compiled rows (with "Expansion" rows removed), 0-based. Packet id `n` is row `n - 1`. */
  readonly magicPrefixes: readonly CostMultAdd[]
  readonly magicSuffixes: readonly CostMultAdd[]
  readonly autoMagic: readonly CostMultAdd[]
  /** Compiled rows (with "Expansion" rows removed), indexed directly by `dwFileIndex`. */
  readonly uniqueItems: readonly CostMultAdd[]
  readonly setItems: readonly CostMultAdd[]
  readonly itemStatCost: ReadonlyMap<number, ItemStatCostRecord>
  readonly skills: ReadonlyMap<number, SkillCostRecord>
  readonly books: readonly BookCostRecord[]
  readonly npcs: ReadonlyMap<number, NpcCostRecord>
  /** Lower-cased `npc` name → MonStats hcIdx, for callers that know NPCs by name. */
  readonly npcClassByName: ReadonlyMap<string, number>
  /** MonStats `Level`, `Level(N)`, `Level(H)` (+0xaa/+0xac/+0xae) by hcIdx. */
  readonly monsterLevels: readonly (readonly [number, number, number])[]
  /** Bit split of encode-2/3 stat params (DataTables +0xc6c / +0xc70). */
  readonly skillParamShift: number
  readonly skillParamMask: number
}

/** Raw tables used to build {@link TransactionCostTables}. */
export interface TransactionCostRawTables {
  readonly weapons: D2Table
  readonly armor: D2Table
  readonly misc: D2Table
  readonly itemTypes: D2Table
  readonly magicPrefix: D2Table
  readonly magicSuffix: D2Table
  readonly autoMagic: D2Table
  readonly uniqueItems: D2Table
  readonly setItems: D2Table
  readonly itemStatCost: D2Table
  readonly books: D2Table
  readonly npc: D2Table
  readonly monStats: D2Table
  readonly skills: readonly SkillCostRecord[]
}

// ---------------------------------------------------------------------------
// Stat ids read by the asm
// ---------------------------------------------------------------------------

const STAT_ARMORCLASS = 31
const STAT_QUANTITY = 70
const STAT_DURABILITY = 72
const STAT_MAXDURABILITY = 73
const STAT_ITEM_SINGLESKILL = 107
const STAT_ITEM_INDESTRUCTIBLE = 152
const STAT_ITEM_CHARGED_SKILL = 204
const STAT_ITEM_REPLENISH_DURABILITY = 252
const STAT_ITEM_REPLENISH_QUANTITY = 253
const STAT_ITEM_EXTRA_STACK = 254

/** `0x6fd760f0` caps the stack size here. */
const MAX_STACK_CAP = 511
/** `0x6fd78e80` caps reduced prices here (with no lower clamp). */
const REDUCED_PRICES_CAP = 99

// ---------------------------------------------------------------------------
// int32 helpers
// ---------------------------------------------------------------------------

const imul = Math.imul

/** Signed `idiv`, truncating; throws on division by zero (#DE in the original). */
function idiv(a: number, b: number, where: string): number {
  if (b === 0) throw new Error(`transaction-cost: integer division by zero at ${where}`)
  return (a / b) | 0
}

/** Signed division by a power of two as compiled (`cdq; and; add; sar`), which truncates toward zero. */
function sdiv(a: number, d: 1024 | 4096 | 4 | 2): number {
  return (a / d) | 0
}

/** Unsigned `div` of an accumulator by the divisor; the result is put back into int32. */
function udiv(acc: number, d: number, where: string): number {
  if (d === 0) throw new Error(`transaction-cost: unsigned division by zero at ${where}`)
  return Math.floor((acc >>> 0) / (d >>> 0)) | 0
}

/**
 * `FOG_10182`-style mul-div at `0x6fd511e0` (eax = a, edx = b, ecx = c).
 * Computes `a * b / c` without overflowing, choosing the path by magnitude.
 */
export function fogMulDiv113c(a: number, b: number, c: number): number {
  if (c === 0) return 0
  const int64 = (): number => Number(BigInt.asIntN(32, (BigInt(a) * BigInt(b)) / BigInt(c)))
  if (b > 0x100000) {
    return c > b >> 4 ? int64() : imul(idiv(b, c, '0x6fd511e0'), a)
  }
  if (a > 0x10000) {
    return c > a >> 4 ? int64() : imul(idiv(a, c, '0x6fd511e0'), b)
  }
  return idiv(imul(a, b), c, '0x6fd511e0')
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

function requireItem(tables: TransactionCostTables, code: string): ItemsTxtCostRecord {
  const rec = tables.items.get(code)
  if (!rec) throw new Error(`transaction-cost: unknown ItemsTxt code '${code}'`)
  return rec
}

function requireItemType(tables: TransactionCostTables, code: string): ItemTypeCostRecord {
  const rec = tables.itemTypes.get(code)
  if (!rec) throw new Error(`transaction-cost: unknown ItemTypes code '${code}'`)
  return rec
}

function requireSkill(tables: TransactionCostTables, id: number): SkillCostRecord {
  const rec = tables.skills.get(id)
  if (!rec) throw new Error(`transaction-cost: unknown skill id ${id}`)
  return rec
}

function requireIsc(tables: TransactionCostTables, id: number): ItemStatCostRecord {
  const rec = tables.itemStatCost.get(id)
  if (!rec) throw new Error(`transaction-cost: unknown ItemStatCost id ${id}`)
  return rec
}

/**
 * Magic affix lookup (`0x6fdc1820`, records 1..count, 0 = none).
 * The asm returns null for an out-of-range id. Here a non-zero id outside
 * the table throws, because the combined table would otherwise resolve it to
 * a record from a neighbouring table.
 */
function affixRecord(rows: readonly CostMultAdd[], id: number, what: string): CostMultAdd | null {
  if (!Number.isInteger(id) || id < 0) throw new Error(`transaction-cost: invalid ${what} id ${id}`)
  if (id === 0) return null
  const rec = rows[id - 1]
  if (!rec) throw new Error(`transaction-cost: ${what} id ${id} outside table (${rows.length} rows)`)
  return rec
}

function requireDefined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`transaction-cost: missing input '${what}'`)
  return value
}

/** Full value of `(stat, param 0)`, i.e. `0x6fd88a80`. */
function fullStat(item: TransactionCostInput, statId: number): number {
  for (const s of item.stats) if (s.statId === statId && s.param === 0) return s.value | 0
  return 0
}

/** Base value of `(stat, param 0)`, i.e. `0x6fd88b00`. */
function baseStat(item: TransactionCostInput, statId: number): number {
  for (const s of item.stats) if (s.statId === statId && s.param === 0) return s.base | 0
  return 0
}

/** `ITEMS_CheckItemTypeId` at `0x6fd74430`: type or type2, walking Equiv1/Equiv2. */
function isItemOfType(tables: TransactionCostTables, rec: ItemsTxtCostRecord, target: string): boolean {
  const seen = new Set<string>()
  const queue: string[] = []
  if (rec.type) queue.push(rec.type)
  if (rec.type2) queue.push(rec.type2)
  while (queue.length > 0) {
    const code = queue.pop()!
    if (code === target) return true
    if (seen.has(code)) continue
    seen.add(code)
    const t = requireItemType(tables, code)
    if (t.equiv1) queue.push(t.equiv1)
    if (t.equiv2) queue.push(t.equiv2)
  }
  return false
}

/** `0x6fd74430` for an ItemsTxt code: whether its type/type2 is, or is equivalent to, `target`. */
export function isItemCodeOfType113c(tables: TransactionCostTables, code: string, target: string): boolean {
  return isItemOfType(tables, requireItem(tables, code), target)
}

/** The primary ItemTypes record. ItemTypes flags are read from it only, with no equivalences. */
function primaryType(tables: TransactionCostTables, rec: ItemsTxtCostRecord): ItemTypeCostRecord {
  return requireItemType(tables, rec.type)
}

/** `0x6fd88ff0`: max durability is the full value of stat 73 only if its base is non-zero. */
function maxDurability(item: TransactionCostInput): number {
  return baseStat(item, STAT_MAXDURABILITY) !== 0 ? fullStat(item, STAT_MAXDURABILITY) : 0
}

/** `0x6fd76d40` */
function hasDurability(item: TransactionCostInput, rec: ItemsTxtCostRecord): boolean {
  return (
    !rec.noDurability &&
    rec.durability > 0 &&
    maxDurability(item) !== 0 &&
    fullStat(item, STAT_ITEM_INDESTRUCTIBLE) <= 0
  )
}

/** `0x6fd760f0` */
function maxStack(item: TransactionCostInput, rec: ItemsTxtCostRecord): number {
  const n = (rec.maxStack + fullStat(item, STAT_ITEM_EXTRA_STACK)) | 0
  return n > MAX_STACK_CAP ? MAX_STACK_CAP : n
}

/** `0x6fd74f00`: a stackable throwing weapon that can be refilled. */
function isRefillableThrowing(tables: TransactionCostTables, item: TransactionCostInput, rec: ItemsTxtCostRecord): boolean {
  const t = primaryType(tables, rec)
  return t.repair && t.throwable && rec.stackable && !item.ethereal
}

function hasMissingCharges(item: TransactionCostInput): boolean {
  for (const s of item.stats) {
    if (s.statId !== STAT_ITEM_CHARGED_SKILL) continue
    if ((s.value & 0xff) < (s.value >> 8)) return true
  }
  return false
}

/** `ITEMS_IsRepairable` at `0x6fd77090`. */
export function isItemRepairable113c(item: TransactionCostInput, tables: TransactionCostTables): boolean {
  if (!item.identified) return false
  if (item.ethereal) return false
  if (hasMissingCharges(item)) return true
  const rec = requireItem(tables, item.code)
  if (!primaryType(tables, rec).repair) return false
  if (isRefillableThrowing(tables, item, rec)) return true
  return hasDurability(item, rec)
}

// ---------------------------------------------------------------------------
// Cost terms
// ---------------------------------------------------------------------------

interface Triple {
  a: number
  b: number
  c: number
}

/**
 * Affix / unique / set term (0x6fd790ce, 0x6fd7954f, 0x6fd79458, 0x6fd79720).
 * The overflow guard looks at A only and is applied to all three.
 */
function multAddTerm(x: Triple, mult: number, add: number): Triple {
  if (x.a > 0xffff && mult !== 0) {
    return {
      a: (imul(sdiv(x.a, 1024), mult) + add) | 0,
      b: (imul(sdiv(x.b, 1024), mult) + add) | 0,
      c: (imul(sdiv(x.c, 1024), mult) + add) | 0,
    }
  }
  return {
    a: (sdiv(imul(mult, x.a), 1024) + add) | 0,
    b: (sdiv(imul(mult, x.b), 1024) + add) | 0,
    c: (sdiv(imul(mult, x.c), 1024) + add) | 0,
  }
}

function addInto(acc: Triple, t: Triple): void {
  acc.a = (acc.a + t.a) | 0
  acc.b = (acc.b + t.b) | 0
  acc.c = (acc.c + t.c) | 0
}

/** `ITEMS_CalculateAdditionalCostsForItemSkill` at `0x6fd75970` (StaffMods, stat 107). */
function applyStaffMods(tables: TransactionCostTables, item: TransactionCostInput, rec: ItemsTxtCostRecord, x: Triple, divisor: number): void {
  if (!primaryType(tables, rec).staffMods) return
  let accA = 0
  let accB = 0
  let accC = 0
  for (const s of item.stats) {
    if (s.statId !== STAT_ITEM_SINGLESKILL) continue
    const skill = requireSkill(tables, s.param)
    const mult = skill.costMult
    const add = skill.costAdd
    const f = (2 * s.value - 1) | 0
    if (x.a > 0xffff && mult !== 0) {
      // (sic) the mult is pre-divided here, unlike the other guards.
      accA = (accA + imul((imul(sdiv(mult, 1024), x.a) + add) | 0, f)) | 0
      accB = (accB + imul((imul(sdiv(mult, 4096), x.b) + add) | 0, f)) | 0
      accC = (accC + imul((imul(x.c, sdiv(mult, 1024)) + add) | 0, f)) | 0
    } else {
      accA = (accA + imul((sdiv(imul(mult, x.a), 1024) + add) | 0, f)) | 0
      accB = (accB + imul((sdiv(imul(x.b, mult), 4096) + add) | 0, f)) | 0
      accC = (accC + imul((sdiv(imul(x.c, mult), 1024) + add) | 0, f)) | 0
    }
  }
  x.a = (x.a + udiv(accA, divisor, '0x6fd75970')) | 0
  x.b = (x.b + udiv(accB, divisor, '0x6fd75970')) | 0
  x.c = (x.c + udiv(accC, divisor, '0x6fd75970')) | 0
}

/** `ITEMS_CalculateAdditionalCostsForBonusStats` at `0x6fd78850`. */
function applyBonusStats(tables: TransactionCostTables, item: TransactionCostInput, x: Triple, divisor: number): void {
  let accA = 0
  let accB = 0
  let accC = 0
  const accumulate = (mult: number, add: number, v: number, bDiv: 1024 | 4096): void => {
    const av = imul(x.a, v)
    if (av > 0xffff && mult !== 0) {
      accA = (accA + imul(sdiv(av, 1024), mult) + add) | 0
      accB = (accB + imul(sdiv(imul(x.b, v), bDiv), mult) + add) | 0
      accC = (accC + imul(sdiv(imul(x.c, v), 1024), mult) + add) | 0
    } else {
      accA = (accA + sdiv(imul(imul(mult, x.a), v), 1024) + add) | 0
      accB = (accB + sdiv(imul(imul(x.b, mult), v), bDiv) + add) | 0
      accC = (accC + sdiv(imul(imul(x.c, mult), v), 1024) + add) | 0
    }
  }
  let visited = 0
  for (const s of item.stats) {
    if (visited++ >= MAX_STACK_CAP) break // the stat array walk is bounded at 511 entries
    let bonus = (s.value - s.base) | 0
    if (bonus === 0) continue
    const isc = requireIsc(tables, s.statId)
    bonus >>= isc.valShift
    switch (isc.encode) {
      case 1: {
        const skill = requireSkill(tables, s.param)
        accumulate(skill.costMult, skill.costAdd, bonus, 4096)
        break
      }
      case 2:
      case 3: {
        const level = s.param & tables.skillParamMask
        const skill = requireSkill(tables, s.param >> tables.skillParamShift)
        accumulate(skill.costMult, skill.costAdd, level, 4096)
        break
      }
      case 4: {
        const min = ((bonus >> 2) & 0x3ff) - 0x100
        const max = ((bonus >> 12) & 0x3ff) - 0x100
        accumulate(isc.multiply, isc.add, sdiv(min + max, 2), 1024)
        break
      }
      default:
        accumulate(isc.multiply, isc.add, bonus, 1024)
        break
    }
  }
  x.a = (x.a + udiv(accA, divisor, '0x6fd78850')) | 0
  x.b = (x.b + udiv(accB, divisor, '0x6fd78850')) | 0
  x.c = (x.c + udiv(accC, divisor, '0x6fd78850')) | 0
}

/** Recharge cost of depleted charged skills (stat 204), at `0x6fd75810`. */
function rechargeCost(tables: TransactionCostTables, item: TransactionCostInput): number {
  let acc = 0
  for (const s of item.stats) {
    if (s.statId !== STAT_ITEM_CHARGED_SKILL) continue
    const level = s.param & tables.skillParamMask
    const skill = requireSkill(tables, s.param >> tables.skillParamShift)
    const charges = s.value & 0xff
    const maxCharges = s.value >> 8
    if (charges >= maxCharges) continue
    if (skill.reqLevel === undefined) {
      throw new Error(`transaction-cost: skill ${skill.id} has no reqlevel; cannot price recharge`)
    }
    const l = (level + 2 * idiv(skill.reqLevel, 6, '0x6fd75810') + 2) | 0
    const x = imul(l, 10000)
    let t = x > 0xffff && skill.costMult !== 0
      ? imul(sdiv(x, 1024), skill.costMult)
      : sdiv(imul(imul(skill.costMult, l), 10000), 1024)
    t = (t + skill.costAdd) | 0
    acc = (acc + idiv(imul(maxCharges - charges, t), maxCharges, '0x6fd75810')) | 0
  }
  return acc
}

/**
 * Gamble price of an item code at a character level (`0x6fd74840`).
 * The record used is `normcode` (falling back to the item's own code, as `0x6fd72ff0` does).
 */
export function computeGambleBaseCost113c(code: string, playerLevel: number, tables: TransactionCostTables): number {
  const own = requireItem(tables, code)
  const rec = own.normCode ? requireItem(tables, own.normCode) : own
  if (rec.code === 'rin' || rec.code === 'amu') return rec.gambleCost // 0x6fd748b7 / 0x6fd74a40
  let avgStack = sdiv((rec.minStack + rec.maxStack) | 0, 2)
  if (avgStack < 1) avgStack = 1
  const base = imul(rec.cost, avgStack)
  let uberW = 0
  let uberCost = 0
  // 0x6fd7490c: a 0 field or "0   " is skipped. A code that does not resolve throws here (the asm skips it).
  if (rec.uberCode && rec.uberCode !== '0') {
    const uber = requireItem(tables, rec.uberCode)
    uberW = (sdiv(imul(playerLevel - uber.level, 100), 2) + 1) | 0
    if (uberW < 0) uberW = 0
    uberCost = uber.cost
  }
  let ultraW = 0
  let ultraCost = 0
  if (rec.ultraCode && rec.ultraCode !== '0') {
    // 0x6fd7494d
    const ultra = requireItem(tables, rec.ultraCode)
    ultraW = (sdiv(imul(playerLevel - ultra.level, 100), 4) + 1) | 0
    if (ultraW < 0) ultraW = 0
    ultraCost = ultra.cost
  }
  // 0x6fd74998
  const mixed = (imul((10000 - ultraW - uberW) | 0, base) + imul(ultraCost, ultraW) + imul(uberCost, uberW)) | 0
  const s = idiv(mixed, 10000, '0x6fd749b8')
  const l = playerLevel > 5 ? playerLevel : 5 // 0x6fd749c9
  const qlvl = rec.level
  const over = qlvl - 45 < 0 ? 0 : qlvl - 45
  const t = idiv(imul((over - sdiv(qlvl, 2) + l) | 0, 250), 3, '0x6fd749f6')
  const f = (idiv((2 * l + 1) | 0, 3, '0x6fd74a0a') + 20) | 0
  return idiv(imul((t + s) | 0, f), 15, '0x6fd74a20')
}

// ---------------------------------------------------------------------------
// #10107
// ---------------------------------------------------------------------------

function requireNpc(tables: TransactionCostTables, npcClass: number): NpcCostRecord {
  const npc = tables.npcs.get(npcClass)
  if (!npc) throw new Error(`transaction-cost: no Npc.txt record for npc class ${npcClass}`) // fatal 0xcdd
  return npc
}

/** Npc multiplier with the asm's guard (0x6fd799d8). */
function npcScale(value: number, guardValue: number, guardMult: number, mult: number): number {
  if (guardValue > 0xffff && guardMult !== 0) return imul(sdiv(value, 1024), mult)
  return sdiv(imul(mult, value), 1024)
}

/**
 * `ITEMS_GetTransactionCost` (D2Common #10107, body at 0x6fd78e80).
 *
 * @param item - the item being priced.
 * @param ctx - player, NPC and table state.
 * @param type - 0 buy, 1 sell, 2 gamble, 3 repair.
 * @returns the gold amount.
 */
export function computeTransactionCost113c(
  item: TransactionCostInput,
  ctx: TransactionCostContext,
  type: TransactionType113c,
): number {
  const { tables } = ctx
  const rec = requireItem(tables, item.code)
  const quantityStat = fullStat(item, STAT_QUANTITY)
  const q = quantityStat <= 0 ? 1 : quantityStat
  let rp = ctx.playerReducedPricesPct | 0
  if (rp >= REDUCED_PRICES_CAP) rp = REDUCED_PRICES_CAP
  const clvl = ctx.playerLevel | 0

  // 0x6fd78eb4
  if (type === 3 && !isItemRepairable113c(item, tables)) return 0
  // 0x6fd78ecd
  if (item.starterItem) return 1

  // 0x6fd78f38: gamble
  if (type === 2) {
    if ((item.itemFormat & 0xffff) >= 1) {
      let cost = computeGambleBaseCost113c(item.code, clvl, tables)
      if (rp !== 0) cost = (cost - fogMulDiv113c(rp, cost, 100)) | 0
      return cost // no clamp here
    }
    const own = rec.normCode ? requireItem(tables, rec.normCode) : rec
    return own.gambleCost
  }

  const x: Triple = { a: 0, b: 0, c: 0 }
  let divisor = 1

  // Base costs, first match wins.
  if (item.isEar) {
    // 0x6fd78fb0
    const lvl = requireDefined(item.earLevel, 'earLevel') & 0xff
    x.a = x.b = imul(lvl, rec.cost)
  } else if (isItemOfType(tables, rec, 'body')) {
    // 0x6fd78fc9
    const cls = requireDefined(item.bodyPartMonsterClass, 'bodyPartMonsterClass')
    const levels = tables.monsterLevels[cls]
    if (!levels) throw new Error(`transaction-cost: no MonStats record ${cls}`)
    x.a = x.b = (rec.cost + (levels[ctx.difficulty] << 3)) | 0
  } else if (isItemOfType(tables, rec, 'book')) {
    // 0x6fd7913e
    const bookId = requireDefined(item.bookId, 'bookId')
    const book = tables.books[bookId]
    if (!book) throw new Error(`transaction-cost: no Books.txt record ${bookId}`) // fatal 0xbbb
    x.a = x.b = (imul(book.costPerCharge, q) + rec.cost) | 0
  } else if (primaryType(tables, rec).quiver) {
    // 0x6fd7917a
    x.a = x.b = sdiv(imul(rec.cost, q), 1024)
    x.c = sdiv(imul(maxStack(item, rec), rec.cost), 1024)
  } else if (rec.stackable) {
    // 0x6fd791c5
    x.a = x.b = x.c = rec.cost
    const ms = maxStack(item, rec)
    divisor = ms > 1 ? ms : 1
  } else {
    x.a = x.b = x.c = rec.cost
  }

  // 0x6fd7900b: armor scales by base defense over max defense
  if (isItemOfType(tables, rec, 'armo')) {
    if (((rec.maxAc - rec.minAc + 1) | 0) !== 0 && rec.maxAc !== 0) {
      const ac = baseStat(item, STAT_ARMORCLASS) || rec.minAc || rec.maxAc
      const v = idiv(imul(rec.cost, ac), rec.maxAc, '0x6fd79044')
      x.a = x.b = x.c = v
    }
  }

  // 0x6fd74210: magic, set, rare, unique, crafted, tempered
  const magicish = item.quality >= 4 && item.quality <= 9
  if (!magicish) applyStaffMods(tables, item, rec, x, divisor) // 0x6fd7909c

  if (item.identified) {
    // 0x6fd790b8: automagic
    const n: Triple = { a: 0, b: 0, c: 0 }
    const auto = affixRecord(tables.autoMagic, item.autoAffixId ?? 0, 'automagic')
    if (auto) addInto(n, multAddTerm(x, auto.multiply, auto.add))

    const magicPath = (): void => {
      // 0x6fd7954f
      const p = affixRecord(tables.magicPrefixes, requireDefined(item.magicPrefixId, 'magicPrefixId'), 'magic prefix')
      if (p) addInto(n, multAddTerm(x, p.multiply, p.add))
      const s = affixRecord(tables.magicSuffixes, requireDefined(item.magicSuffixId, 'magicSuffixId'), 'magic suffix')
      if (s) addInto(n, multAddTerm(x, s.multiply, s.add))
      applyBonusStats(tables, item, x, divisor)
    }

    switch (item.quality) {
      case 1: // 0x6fd797fc: low quality replaces the automagic term (sic)
        n.a = -sdiv(x.a, 2)
        n.b = -sdiv(x.b, 2)
        n.c = -sdiv(x.c, 2)
        break
      case 2:
        break
      case 3: // 0x6fd79823
      case 9:
        applyBonusStats(tables, item, x, divisor)
        break
      case 4:
        magicPath()
        break
      case 5: {
        // 0x6fd79720: a missing record is skipped; no bonus stats
        const id = requireDefined(item.setItemId, 'setItemId')
        const set = id >= 0 ? tables.setItems[id] : undefined
        if (set) addInto(n, multAddTerm(x, set.multiply, set.add))
        break
      }
      case 6: // 0x6fd79269
      case 8: {
        const pre = requireDefined(item.rarePrefixIds, 'rarePrefixIds')
        const suf = requireDefined(item.rareSuffixIds, 'rareSuffixIds')
        for (let i = 0; i < 3; i++) {
          const p = affixRecord(tables.magicPrefixes, pre[i]!, 'rare prefix')
          if (p) addInto(n, multAddTerm(x, p.multiply, p.add))
          const s = affixRecord(tables.magicSuffixes, suf[i]!, 'rare suffix')
          if (s) addInto(n, multAddTerm(x, s.multiply, s.add))
        }
        applyBonusStats(tables, item, x, divisor)
        break
      }
      case 7: {
        // 0x6fd79458: an invalid unique id falls back to the magic path
        const id = requireDefined(item.uniqueItemId, 'uniqueItemId')
        const uniq = id >= 0 ? tables.uniqueItems[id] : undefined
        if (uniq) addInto(n, multAddTerm(x, uniq.multiply, uniq.add))
        else magicPath()
        break
      }
    }
    // 0x6fd79844: signed division of the terms by the divisor
    x.a = (x.a + idiv(n.a, divisor, '0x6fd79844')) | 0
    x.b = (x.b + idiv(n.b, divisor, '0x6fd79844')) | 0
    x.c = (x.c + idiv(n.c, divisor, '0x6fd79844')) | 0
    if (magicish) applyStaffMods(tables, item, rec, x, divisor)
  }

  // 0x6fd74a50: sockets, counted even when unidentified
  for (const childCode of item.socketedChildCodes) {
    const half = sdiv(requireItem(tables, childCode).cost, 2)
    x.a = (x.a + half) | 0
    x.b = (x.b + half) | 0
    x.c = (x.c + half) | 0
  }

  // 0x6fd798b0: quarter the player-sell price
  let ebp = x.b
  if (item.ethereal) ebp = sdiv(ebp, 4)
  if (primaryType(tables, rec).classSpecific) ebp = sdiv(ebp, 4)

  // 0x6fd798f5: per-type adjustment
  let edi = x.c
  if (type === 1) {
    if (item.ethereal && hasDurability(item, rec) && fullStat(item, STAT_DURABILITY) <= 0) ebp = 0
  } else if (type === 3) {
    const t = primaryType(tables, rec)
    if (!t.quiver && !t.throwable && hasDurability(item, rec)) {
      const cur = fullStat(item, STAT_DURABILITY)
      const max = maxDurability(item)
      if (max !== 0 && cur < max) {
        if (fullStat(item, STAT_ITEM_REPLENISH_DURABILITY) !== 0) {
          // (sic) self-repairing items are charged as if one point were missing, or nothing
          edi = cur < max - 1 ? idiv(imul(max - 1, x.c), max, '0x6fd7995e') : 0
        } else {
          edi = idiv(imul(max - cur, x.c), max, '0x6fd79988')
        }
      } else {
        edi = 0
      }
    }
  }

  // 0x6fd799d8: Npc.txt multipliers
  const npc = requireNpc(tables, ctx.npcClass)
  let a = npcScale(x.a, x.a, npc.sellMult, npc.sellMult)
  ebp = npcScale(ebp, ebp, npc.sellMult, npc.buyMult) // (sic) guard tests sellMult
  edi = npcScale(edi, edi, npc.repMult, npc.repMult)

  // 0x6fd79aa0: quest discounts
  for (let i = 0; i < 3; i++) {
    const flag = npc.questFlags[i]!
    if (flag === 0) continue
    if (!ctx.isQuestFlagSet(flag, 0) && !ctx.isQuestFlagSet(flag, 1)) continue
    a = npcScale(a, a, npc.questSellMults[i]!, npc.questSellMults[i]!)
    ebp = npcScale(ebp, ebp, npc.questBuyMults[i]!, npc.questBuyMults[i]!)
    edi = npcScale(edi, edi, npc.questRepMults[i]!, npc.questRepMults[i]!)
  }

  // 0x6fd79b8d: quantity
  if (!isItemOfType(tables, rec, 'book') && !primaryType(tables, rec).quiver) {
    a = imul(a, q)
    if (rec.stackable && isItemRepairable113c(item, tables)) {
      const max = maxStack(item, rec)
      if (q >= max || fullStat(item, STAT_ITEM_REPLENISH_QUANTITY) !== 0) {
        ebp = imul(max, ebp)
        edi = 0
      } else {
        ebp = (imul(max, ebp) - imul(edi, max - q)) | 0
        edi = imul(edi, max - q)
      }
    } else {
      ebp = imul(ebp, q)
    }
  }

  // 0x6fd79c0d: recharge, added after the Npc multipliers
  if (type === 3 && !item.ethereal) edi = (edi + rechargeCost(tables, item)) | 0

  // 0x6fd79c2c: cap the player-sell price
  const cap = npc.maxBuy[ctx.difficulty]
  if (ebp > cap) ebp = cap

  if (type === 1) return ebp < 1 ? 1 : ebp
  if (type === 3) {
    if (rp !== 0) edi = (edi - fogMulDiv113c(rp, edi, 100)) | 0
    return edi < 1 ? 1 : edi
  }
  if (rp !== 0) a = (a - fogMulDiv113c(rp, a, 100)) | 0
  return a < 1 ? 1 : a
}

// ---------------------------------------------------------------------------
// #10071
// ---------------------------------------------------------------------------

/**
 * Repair-all cost (D2Common #10071 at 0x6fd7a210).
 *
 * @param equipped - the 13 body locations (0..12, both weapon sets); `null` for an empty slot.
 * @param ctx - same context as a single repair.
 * @returns the total gold. Items that need nothing contribute 0.
 */
export function computeRepairAllCost113c(
  equipped: readonly (TransactionCostInput | null)[],
  ctx: TransactionCostContext,
): number {
  const { tables } = ctx
  let total = 0
  for (const item of equipped) {
    if (!item) continue
    const rec = requireItem(tables, item.code)
    const maxDur = maxDurability(item)
    const needs =
      (isItemRepairable113c(item, tables) &&
        hasDurability(item, rec) &&
        maxDur !== 0 &&
        fullStat(item, STAT_DURABILITY) !== maxDur) ||
      (isRefillableThrowing(tables, item, rec) && fullStat(item, STAT_QUANTITY) < maxStack(item, rec)) ||
      hasMissingCharges(item)
    if (!needs) continue
    total = (total + computeTransactionCost113c(item, ctx, 3)) | 0
  }
  return total
}

// ---------------------------------------------------------------------------
// Table building
// ---------------------------------------------------------------------------

function column(t: D2Table, name: string, what: string): number {
  const i = t.header.indexOf(name)
  if (i < 0) throw new Error(`transaction-cost: ${what} has no column '${name}'`)
  return i
}

/** Integer txt field. An empty cell compiles to 0, as the txt compiler does. */
function intField(t: D2Table, row: readonly string[], name: string, what: string): number {
  const raw = (row[column(t, name, what)] ?? '').trim()
  if (raw === '') return 0
  if (!/^-?\d+$/.test(raw)) throw new Error(`transaction-cost: ${what}.${name} is not an integer: '${raw}'`)
  return Number(raw) | 0
}

function strField(t: D2Table, row: readonly string[], name: string, what: string): string {
  return (row[column(t, name, what)] ?? '').trim()
}

/** Compiled rows: the txt compiler drops rows whose first column is "Expansion". */
function compiledRows(t: D2Table): readonly (readonly string[])[] {
  return t.rows.filter(r => (r[0] ?? '').trim() !== 'Expansion')
}

function multAddRows(t: D2Table, nameCol: string, multCol: string, addCol: string, what: string): CostMultAdd[] {
  return compiledRows(t).map(r => ({
    name: strField(t, r, nameCol, what),
    multiply: intField(t, r, multCol, what),
    add: intField(t, r, addCol, what),
  }))
}

/** Which optional columns a items table has. Misc.txt has no durability, AC or tier columns; they compile to 0. */
interface ItemsTableShape {
  readonly hasAc: boolean
  readonly hasTiers: boolean
  readonly hasDurability: boolean
}

function addItems(out: Map<string, ItemsTxtCostRecord>, t: D2Table, what: string, shape: ItemsTableShape): void {
  const { hasAc, hasTiers } = shape
  for (const r of compiledRows(t)) {
    const code = strField(t, r, 'code', what)
    if (!code) continue
    if (out.has(code)) throw new Error(`transaction-cost: duplicate ItemsTxt code '${code}'`)
    const tier = (name: string): string => {
      if (!hasTiers) return ''
      const v = strField(t, r, name, what)
      return v === '0' ? '' : v
    }
    out.set(code, {
      code,
      type: strField(t, r, 'type', what),
      type2: strField(t, r, 'type2', what),
      cost: intField(t, r, 'cost', what),
      gambleCost: intField(t, r, 'gamble cost', what),
      minStack: intField(t, r, 'minstack', what),
      maxStack: intField(t, r, 'maxstack', what),
      stackable: intField(t, r, 'stackable', what) !== 0,
      durability: shape.hasDurability ? intField(t, r, 'durability', what) & 0xff : 0,
      noDurability: intField(t, r, 'nodurability', what) !== 0,
      level: intField(t, r, 'level', what) & 0xff,
      normCode: tier('normcode'),
      uberCode: tier('ubercode'),
      ultraCode: tier('ultracode'),
      minAc: hasAc ? intField(t, r, 'minac', what) : 0,
      maxAc: hasAc ? intField(t, r, 'maxac', what) : 0,
    })
  }
}

/** Build the compiled tables from raw txt tables. */
export function buildTransactionCostTables(raw: TransactionCostRawTables): TransactionCostTables {
  const items = new Map<string, ItemsTxtCostRecord>()
  addItems(items, raw.weapons, 'Weapons', { hasAc: false, hasTiers: true, hasDurability: true })
  addItems(items, raw.armor, 'Armor', { hasAc: true, hasTiers: true, hasDurability: true })
  addItems(items, raw.misc, 'Misc', { hasAc: false, hasTiers: false, hasDurability: false })

  const itemTypes = new Map<string, ItemTypeCostRecord>()
  for (const r of compiledRows(raw.itemTypes)) {
    const w = 'ItemTypes'
    const code = strField(raw.itemTypes, r, 'Code', w)
    if (!code) continue
    itemTypes.set(code, {
      code,
      equiv1: strField(raw.itemTypes, r, 'Equiv1', w),
      equiv2: strField(raw.itemTypes, r, 'Equiv2', w),
      repair: intField(raw.itemTypes, r, 'Repair', w) !== 0,
      quiver: strField(raw.itemTypes, r, 'Quiver', w) !== '',
      throwable: intField(raw.itemTypes, r, 'Throwable', w) !== 0,
      staffMods: strField(raw.itemTypes, r, 'StaffMods', w) !== '',
      classSpecific: strField(raw.itemTypes, r, 'Class', w) !== '',
    })
  }

  const itemStatCost = new Map<number, ItemStatCostRecord>()
  for (const r of compiledRows(raw.itemStatCost)) {
    const w = 'ItemStatCost'
    if (strField(raw.itemStatCost, r, 'ID', w) === '') continue
    const id = intField(raw.itemStatCost, r, 'ID', w)
    itemStatCost.set(id, {
      id,
      encode: intField(raw.itemStatCost, r, 'Encode', w),
      add: intField(raw.itemStatCost, r, 'Add', w),
      multiply: intField(raw.itemStatCost, r, 'Multiply', w),
      valShift: intField(raw.itemStatCost, r, 'ValShift', w),
    })
  }

  const skills = new Map<number, SkillCostRecord>()
  for (const s of raw.skills) skills.set(s.id, s)

  const books = compiledRows(raw.books).map(r => ({
    name: strField(raw.books, r, 'Name', 'Books'),
    baseCost: intField(raw.books, r, 'BaseCost', 'Books'),
    costPerCharge: intField(raw.books, r, 'CostPerCharge', 'Books'),
  }))

  const monRows = compiledRows(raw.monStats)
  const npcClassByName = new Map<string, number>()
  const monsterLevels = monRows.map((r, i) => {
    const id = strField(raw.monStats, r, 'Id', 'MonStats').toLowerCase()
    if (id && !npcClassByName.has(id)) npcClassByName.set(id, i)
    return [
      intField(raw.monStats, r, 'Level', 'MonStats'),
      intField(raw.monStats, r, 'Level(N)', 'MonStats'),
      intField(raw.monStats, r, 'Level(H)', 'MonStats'),
    ] as const
  })

  const npcs = new Map<number, NpcCostRecord>()
  const npcNames = new Map<string, number>()
  for (const r of compiledRows(raw.npc)) {
    const t = raw.npc
    const w = 'Npc'
    const name = strField(t, r, 'npc', w)
    if (!name) continue
    const npcClass = npcClassByName.get(name.toLowerCase())
    if (npcClass === undefined) throw new Error(`transaction-cost: Npc.txt '${name}' has no MonStats row`)
    const abc = (prefix: string): [number, number, number] => [
      intField(t, r, `${prefix} A`, w),
      intField(t, r, `${prefix} B`, w),
      intField(t, r, `${prefix} C`, w),
    ]
    npcs.set(npcClass, {
      name,
      npcClass,
      sellMult: intField(t, r, 'sell mult', w),
      buyMult: intField(t, r, 'buy mult', w),
      repMult: intField(t, r, 'rep mult', w),
      questFlags: abc('questflag'),
      questSellMults: abc('questsellmult'),
      questBuyMults: abc('questbuymult'),
      questRepMults: abc('questrepmult'),
      maxBuy: [intField(t, r, 'max buy', w), intField(t, r, 'max buy (N)', w), intField(t, r, 'max buy (H)', w)],
    })
    npcNames.set(name.toLowerCase(), npcClass)
  }

  return {
    items,
    itemTypes,
    magicPrefixes: multAddRows(raw.magicPrefix, 'Name', 'multiply', 'add', 'MagicPrefix'),
    magicSuffixes: multAddRows(raw.magicSuffix, 'Name', 'multiply', 'add', 'MagicSuffix'),
    autoMagic: multAddRows(raw.autoMagic, 'Name', 'multiply', 'add', 'AutoMagic'),
    uniqueItems: multAddRows(raw.uniqueItems, 'index', 'cost mult', 'cost add', 'UniqueItems'),
    setItems: multAddRows(raw.setItems, 'index', 'cost mult', 'cost add', 'SetItems'),
    itemStatCost,
    skills,
    books,
    npcs,
    npcClassByName: npcNames,
    monsterLevels,
    // UNCONFIRMED: the writer of DataTables +0xc6c/+0xc70 was not located; 6/0x3f is the
    // split the old-format conversion at 0x6fd7bd2c uses.
    skillParamShift: 6,
    skillParamMask: 0x3f,
  }
}

let canonicalTables: TransactionCostTables | undefined

/** Tables built from the embedded canonical 1.13c data. Built once, on first call. */
export function getCanonicalTransactionCostTables(): TransactionCostTables {
  if (canonicalTables) return canonicalTables
  const parse = (text: string): D2Table => parseTable(new TextEncoder().encode(text))
  const skills: SkillCostRecord[] = CANONICAL_SKILL_COSTS.map(s => ({
    id: s.id,
    costMult: s.costMult,
    costAdd: s.costAdd,
    reqLevel: SKILLS_BY_ID[s.id]?.reqlevel,
  }))
  canonicalTables = buildTransactionCostTables({
    weapons: parse(RAW_WEAPONS),
    armor: parse(RAW_ARMOR),
    misc: parse(RAW_MISC),
    itemTypes: parse(RAW_ITEM_TYPES),
    magicPrefix: parse(RAW_MAGIC_PREFIX),
    magicSuffix: parse(RAW_MAGIC_SUFFIX),
    autoMagic: parse(CANONICAL_AUTOMAGIC_TSV.trim()),
    uniqueItems: parse(RAW_UNIQUE_ITEMS),
    setItems: parse(RAW_SET_ITEMS),
    itemStatCost: parse(RAW_ITEM_STAT_COST),
    books: parse(RAW_BOOKS),
    npc: parse(RAW_NPC),
    monStats: parse(RAW_MONSTATS),
    skills,
  })
  return canonicalTables
}


