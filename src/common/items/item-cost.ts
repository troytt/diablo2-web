/**
 * LEGACY vendor pricing over the server-side `Item` model.
 *
 * The 1.13c ground-truth port is `./transaction-cost.ts`, which ports
 * `computeTransactionCost113c` (#10107, body 0x6fd78e80) and
 * `computeRepairAllCost113c` (#10071, 0x6fd7a210). New code must use it.
 *
 * This module came from a D2MOO (1.10) port. It stays because
 * `vendor-service.ts` and the legacy simulation tests price `Item` objects,
 * which carry rolled properties instead of a full/base stat list. The fake
 * addresses and permissive fallbacks have been removed:
 * - ItemsTxt fields are read from the canonical compiled tables.
 * - Missing Npc / Books / skill / ItemStatCost records throw.
 * - Gamble pricing delegates to the 1.13c port.
 */
import type { DropTables } from './drop-tables.ts'
import { ItemFlag, ItemQuality, type Item, type ItemBase, type RolledItemProp } from './items.ts'
import type { ItemTypeTable } from './item-types.ts'
import type { RolledAutoMagic } from './automagic.ts'
import { VendorNpcId, type NpcRecord } from '../units/npc-table.ts'
import {
  computeGambleBaseCost113c,
  fogMulDiv113c,
  getCanonicalTransactionCostTables,
  isItemCodeOfType113c,
  type ItemsTxtCostRecord,
} from './transaction-cost.ts'

/**
 * Canonical 1.13c transaction types (`D2C_TransactionTypes`).
 */
export const enum TransactionType {
  BUY = 0,
  SELL = 1,
  GAMBLE = 2,
  REPAIR = 3,
}

export interface TransactionCostOptions {
  readonly item: Item
  readonly transactionType: TransactionType
  readonly difficulty?: 0 | 1 | 2 | undefined
  readonly cLvl?: number | undefined
  readonly vendorId?: VendorNpcId | undefined
  readonly npcKey?: string | undefined
  /** Unused since the Npc.txt record is required; kept so existing callers compile. */
  readonly actIndex?: 0 | 1 | 2 | 3 | 4 | undefined
  readonly completedQuests?: ReadonlySet<number> | undefined
  readonly reducedPricesPercent?: number | undefined
  readonly tables: DropTables
}

/** `0x6fd760f0` caps stack sizes here. */
const MAX_STACK_CAP = 511
/** `0x6fd78e80` caps reduced prices here (no lower clamp). */
const REDUCED_PRICES_CAP = 99
/** Encode-2/3 param split. UNCONFIRMED; see `transaction-cost.ts`. */
const SKILL_PARAM_SHIFT = 6
const SKILL_PARAM_MASK = 0x3f

/** ItemsTxt record of a base; throws if the code is unknown. */
function txt(base: ItemBase): ItemsTxtCostRecord {
  const rec = getCanonicalTransactionCostTables().items.get(base.id)
  if (!rec) throw new Error(`item-cost: unknown ItemsTxt code '${base.id}'`)
  return rec
}

function primaryTypeOf(base: ItemBase, itemTypes: ItemTypeTable): ReturnType<ItemTypeTable['byCode']['get']> {
  const code = txt(base).type
  const def = itemTypes.byCode.get(code)
  if (!def) throw new Error(`item-cost: unknown ItemTypes code '${code}' for '${base.id}'`)
  return def
}

/**
 * Whether the primary ItemType is class-specific (`ItemTypes.Class` set, `nClass < 7`).
 * 0x6fd798b0 reads the primary type only, with no equivalences.
 */
export function isClassSpecificItemBase(base: ItemBase, itemTypes: ItemTypeTable): boolean {
  const def = primaryTypeOf(base, itemTypes)
  return Boolean(def?.class && def.class.trim().length > 0)
}

/** Whether the primary ItemType has StaffMods (`nStaffMods != 7`), as 0x6fd75970 checks. */
export function hasStaffModsItemType(base: ItemBase, itemTypes: ItemTypeTable): boolean {
  const def = primaryTypeOf(base, itemTypes)
  return Boolean(def?.staffMods && def.staffMods.trim().length > 0)
}

/** Primary ItemType `Quiver` set (0x6fd74e60). */
export function isQuiverItem(base: ItemBase): boolean {
  const t = getCanonicalTransactionCostTables().itemTypes.get(txt(base).type)
  if (!t) throw new Error(`item-cost: unknown ItemTypes code '${txt(base).type}'`)
  return t.quiver
}

/** `book` type, with equivalences (0x6fd74430). */
export function isBookItem(base: ItemBase): boolean {
  return isItemCodeOfType113c(getCanonicalTransactionCostTables(), base.id, 'book')
}

function isEthereal(item: Item): boolean {
  return Boolean(item.flags?.ethereal) || ((item.rawFlags ?? 0) & ItemFlag.ETHEREAL) !== 0
}

function maxStackOf(base: ItemBase): number {
  const n = txt(base).maxStack
  return n > MAX_STACK_CAP ? MAX_STACK_CAP : n
}

/**
 * LEGACY "needs repair" predicate used by the vendor UI. It is NOT
 * `ITEMS_IsRepairable` (0x6fd77090). That function is
 * `isItemRepairable113c` in `./transaction-cost.ts`, and it also returns true
 * for undamaged items.
 */
export function isItemRepairable(item: Item): boolean {
  if (isEthereal(item)) return false

  if (isQuiverItem(item.base) || isBookItem(item.base)) return false

  const hasIndestructible = Boolean(
    item.rolledProps?.some(p => p.code.toLowerCase() === 'indestruct') ||
      item.stats?.indestruct,
  )
  if (hasIndestructible) return false

  const rec = txt(item.base)
  const maxDur = item.maxDurability ?? (rec.noDurability ? 0 : rec.durability)
  const curDur = item.durability ?? maxDur
  if (maxDur > 0 && curDur < maxDur) {
    return true
  }

  // A stackable throwing weapon below its max stack can be refilled.
  if (rec.stackable && item.base.kind === 'weapon') {
    const maxStack = maxStackOf(item.base)
    const qty = item.quantity ?? item.stack ?? maxStack
    if (qty < maxStack) return true
  }

  // Charged skills that have been used can be recharged.
  if (item.rolledProps?.some(p => p.code.toLowerCase() === 'charged')) {
    return true
  }

  return false
}

/**
 * StaffMods pricing (`0x6fd75970`) for single-skill staffmods
 * (`STAT_ITEM_SINGLESKILL`) on StaffMods item types.
 */
export function calculateAdditionalCostsForItemSkill(
  item: Item,
  sellCost: number,
  buyCost: number,
  repCost: number,
  divisor: number,
  tables: DropTables,
): { sellCost: number; buyCost: number; repCost: number } {
  if (!hasStaffModsItemType(item.base, tables.itemTypes)) {
    return { sellCost, buyCost, repCost }
  }

  const staffMods: readonly RolledItemProp[] =
    item.staffMods ??
    (item.rolledProps?.filter(p => p.code.toLowerCase() === 'skill') ?? [])

  if (staffMods.length === 0) {
    return { sellCost, buyCost, repCost }
  }

  const skillCosts = tables.skillCosts
  if (!skillCosts) throw new Error('item-cost: DropTables.skillCosts is required for StaffMods pricing')

  let nSell = 0
  let nBuy = 0
  let nRep = 0

  for (const sm of staffMods) {
    const skillId = Number(sm.param)
    const slvl = Math.trunc(sm.value)
    const skillRec = skillCosts.get(skillId)
    if (!skillRec) throw new Error(`item-cost: no Skills.txt cost record for skill ${skillId}`)

    const factor = 2 * slvl - 1
    nSell += factor * (skillRec.costAdd + Math.trunc((sellCost * skillRec.costMult) / 1024))
    nBuy += factor * (skillRec.costAdd + Math.trunc((buyCost * skillRec.costMult) / 4096))
    nRep += factor * (skillRec.costAdd + Math.trunc((repCost * skillRec.costMult) / 1024))
  }

  return {
    sellCost: sellCost + Math.trunc(nSell / divisor),
    buyCost: buyCost + Math.trunc(nBuy / divisor),
    repCost: repCost + Math.trunc(nRep / divisor),
  }
}

/**
 * Bonus-stat pricing (`0x6fd78850`): applies `ItemStatCost.txt`
 * (`Encode`, `Add`, `Multiply`) or `Skills.txt` (`CostAdd`, `CostMult`) to each
 * rolled stat. `Divide` is not read by 1.13c.
 */
export function calculateAdditionalCostsForBonusStats(
  item: Item,
  sellCost: number,
  buyCost: number,
  repCost: number,
  divisor: number,
  tables: DropTables,
): { sellCost: number; buyCost: number; repCost: number } {
  const propertiesTable = tables.properties
  const statCostTable = tables.itemStatCost
  if (!statCostTable) throw new Error('item-cost: DropTables.itemStatCost is required for bonus-stat pricing')

  let nSell = 0
  let nBuy = 0
  let nRep = 0

  // Collect resolved stats. StaffMods 'skill' entries are priced by calculateAdditionalCostsForItemSkill.
  const staffModSet = new Set<RolledItemProp>(item.staffMods ?? [])
  const props = item.rolledProps ?? []

  interface StatBonusEntry {
    readonly statId: number
    readonly param: number
    readonly value: number
  }

  const entries: StatBonusEntry[] = []

  if (props.length > 0) {
    if (!propertiesTable) throw new Error('item-cost: DropTables.properties is required to resolve rolled properties')
    for (const prop of props) {
      if (staffModSet.has(prop)) continue
      if (prop.code.toLowerCase() === 'skill' && hasStaffModsItemType(item.base, tables.itemTypes)) {
        continue
      }
      const numParam =
        typeof prop.param === 'number'
          ? prop.param
          : typeof prop.param === 'string' && prop.param.trim() !== ''
            ? parseInt(prop.param, 10) || 0
            : 0
      const resolved = propertiesTable.resolveProperty(
        prop.code,
        numParam,
        prop.value,
        prop.value,
        statCostTable,
      )
      for (const r of resolved) {
        entries.push({ statId: r.statId, param: r.param ?? numParam, value: r.value })
      }
    }
  } else if (item.statList && item.statList.length > 0) {
    for (const s of item.statList) {
      entries.push({ statId: s.statId, param: s.param ?? 0, value: s.value })
    }
  }

  const skillCosts = tables.skillCosts
  const requireSkill = (id: number): { costAdd: number; costMult: number } => {
    const rec = skillCosts?.get(id)
    if (!rec) throw new Error(`item-cost: no Skills.txt cost record for skill ${id}`)
    return rec
  }

  for (const entry of entries) {
    const statRec = statCostTable.getById(entry.statId)
    if (!statRec) throw new Error(`item-cost: no ItemStatCost record for stat ${entry.statId}`)
    // STAT_ITEM_SINGLESKILL (107) on StaffMods items is priced by calculateAdditionalCostsForItemSkill.
    if (statRec.id === 107 && hasStaffModsItemType(item.base, tables.itemTypes)) {
      continue
    }
    const nBonusValue = entry.value
    if (!nBonusValue) continue

    switch (statRec.encode) {
      case 1: {
        const skillRec = requireSkill(entry.param)
        nSell += skillRec.costAdd + Math.trunc((nBonusValue * sellCost * skillRec.costMult) / 1024)
        nBuy += skillRec.costAdd + Math.trunc((nBonusValue * buyCost * skillRec.costMult) / 4096)
        nRep += skillRec.costAdd + Math.trunc((nBonusValue * repCost * skillRec.costMult) / 1024)
        break
      }
      case 2:
      case 3: {
        const skillRec = requireSkill(entry.param >> SKILL_PARAM_SHIFT)
        const slvl = entry.param & SKILL_PARAM_MASK
        nSell += skillRec.costAdd + Math.trunc((slvl * sellCost * skillRec.costMult) / 1024)
        nBuy += skillRec.costAdd + Math.trunc((slvl * buyCost * skillRec.costMult) / 4096)
        nRep += skillRec.costAdd + Math.trunc((slvl * repCost * skillRec.costMult) / 1024)
        break
      }
      default: {
        nSell += statRec.add + Math.trunc((nBonusValue * sellCost * statRec.multiply) / 1024)
        nBuy += statRec.add + Math.trunc((nBonusValue * buyCost * statRec.multiply) / 1024)
        nRep += statRec.add + Math.trunc((nBonusValue * repCost * statRec.multiply) / 1024)
        break
      }
    }
  }

  return {
    sellCost: sellCost + Math.trunc(nSell / divisor),
    buyCost: buyCost + Math.trunc(nBuy / divisor),
    repCost: repCost + Math.trunc(nRep / divisor),
  }
}

function capReducedPrices(pct: number): number {
  const v = Math.trunc(pct)
  return v >= REDUCED_PRICES_CAP ? REDUCED_PRICES_CAP : v
}

/**
 * Gamble price (`0x6fd78f38` → `0x6fd74840`), delegated to the 1.13c port.
 * There is no minimum clamp: the asm returns this value directly.
 */
export function calculateGambleCost(options: {
  readonly item: Item
  readonly cLvl: number
  readonly reducedPricesPercent?: number | undefined
  readonly tables: DropTables
}): number {
  const { item, cLvl, reducedPricesPercent = 0 } = options
  let cost = computeGambleBaseCost113c(item.base.id, Math.trunc(cLvl), getCanonicalTransactionCostTables())
  const rp = capReducedPrices(reducedPricesPercent)
  if (rp !== 0) cost = (cost - fogMulDiv113c(rp, cost, 100)) | 0
  return cost
}

/** Row index of the rolled AutoMagic affix. drop-tables.ts spreads `rolledAutoMagic` onto the item without a typed field. */
function rolledAutoMagicRow(item: Item): number | undefined {
  if (!('rolledAutoMagic' in item)) return undefined
  const rolled: unknown = item.rolledAutoMagic
  if (rolled === undefined) return undefined
  const parsed = rolled as Partial<RolledAutoMagic>
  if (!parsed.entry || typeof parsed.entry.id !== 'number') throw new Error('item-cost: malformed rolledAutoMagic')
  return parsed.entry.id
}

function resolveNpcRecord(tables: DropTables, vendorId?: VendorNpcId, npcKey?: string): NpcRecord {
  if (!tables.npcTable) throw new Error('item-cost: DropTables.npcTable is required')
  const rec =
    (npcKey ? tables.npcTable.get(npcKey) : undefined) ??
    (vendorId !== undefined ? tables.npcTable.getByVendorId(vendorId) : undefined)
  if (!rec) throw new Error(`item-cost: no Npc.txt record for npcKey=${npcKey ?? '-'} vendorId=${vendorId ?? '-'}`)
  return rec
}

/**
 * LEGACY transaction pricing over `Item` (structured after 0x6fd78e80).
 * Prefer `computeTransactionCost113c`.
 */
export function calculateTransactionCost(options: TransactionCostOptions): number {
  const {
    item,
    transactionType,
    difficulty = 0,
    cLvl = 1,
    vendorId,
    npcKey,
    completedQuests,
    reducedPricesPercent = 0,
    tables,
  } = options

  if (transactionType === TransactionType.REPAIR && !isItemRepairable(item)) {
    return 0
  }

  const isStarter =
    Boolean(item.flags?.starterItem) ||
    ((item.rawFlags ?? 0) & ItemFlag.STARTER_ITEM) !== 0
  if (isStarter) {
    return 1
  }

  if (transactionType === TransactionType.GAMBLE) {
    return calculateGambleCost({ item, cLvl, reducedPricesPercent, tables })
  }

  const rec = txt(item.base)
  const nQuantity = Math.max(1, Math.trunc(item.quantity ?? item.stack ?? 1))
  const rp = capReducedPrices(reducedPricesPercent)
  const baseCost = rec.cost

  let nSellCost = 0
  let nBuyCost = 0
  let nRepCost = 0
  let nDivisor = 1

  const isEar =
    Boolean(item.flags?.isEar) ||
    ((item.rawFlags ?? 0) & ItemFlag.IS_EAR) !== 0

  if (isEar) {
    const earLvl = item.earData?.level
    if (earLvl === undefined) throw new Error('item-cost: ear item has no earData.level')
    nSellCost = baseCost * earLvl
    nBuyCost = nSellCost
  } else if (isBookItem(item.base)) {
    const bookRec = tables.booksTable?.getByBookCode(item.base.id)
    if (!bookRec) throw new Error(`item-cost: no Books.txt record for '${item.base.id}'`)
    nSellCost = baseCost + nQuantity * bookRec.costPerCharge
    nBuyCost = nSellCost
  } else if (isQuiverItem(item.base)) {
    nSellCost = Math.trunc((nQuantity * baseCost) / 1024)
    nBuyCost = nSellCost
    nRepCost = Math.trunc((maxStackOf(item.base) * baseCost) / 1024)
  } else if (!rec.stackable) {
    nSellCost = baseCost
    nBuyCost = nSellCost
    nRepCost = nSellCost
  } else {
    nSellCost = baseCost
    nBuyCost = nSellCost
    nRepCost = nSellCost
    const maxStack = maxStackOf(item.base)
    nDivisor = maxStack > 1 ? maxStack : 1
  }

  // 0x6fd7900b: armor scales by base defense over max defense
  if (isItemCodeOfType113c(getCanonicalTransactionCostTables(), item.base.id, 'armo')) {
    const minAc = rec.minAc
    const maxAc = rec.maxAc
    if (maxAc !== 0 && maxAc - minAc !== -1) {
      // The Item model stores the final defense; strip ac% to recover the base roll.
      const rawDef = item.defense ?? item.stats?.defense
      if (rawDef === undefined) throw new Error(`item-cost: armor '${item.base.id}' has no defense value`)
      const acPct = item.stats?.['ac%'] ?? 0
      const baseAc =
        acPct > 0
          ? Math.min(maxAc + 1, Math.max(minAc, Math.round((rawDef * 100) / (100 + acPct))))
          : Math.min(maxAc, Math.max(1, rawDef))
      nSellCost = Math.trunc((baseAc * baseCost) / maxAc)
      nBuyCost = nSellCost
      nRepCost = nSellCost
    }
  }

  const quality = item.quality ?? ItemQuality.NORMAL

  // StaffMods before affixes for non-magic qualities
  if (quality < ItemQuality.MAGIC || quality > ItemQuality.TEMPERED) {
    const afterSkill = calculateAdditionalCostsForItemSkill(item, nSellCost, nBuyCost, nRepCost, nDivisor, tables)
    nSellCost = afterSkill.sellCost
    nBuyCost = afterSkill.buyCost
    nRepCost = afterSkill.repCost
  }

  const isIdentified =
    item.identified !== false && item.flags?.identified !== false && !item.isGambleMystery

  if (isIdentified) {
    let nSell = 0
    let nBuy = 0
    let nRep = 0
    const addTerm = (add: number, mult: number): void => {
      nSell += add + Math.trunc((nSellCost * mult) / 1024)
      nBuy += add + Math.trunc((nBuyCost * mult) / 1024)
      nRep += add + Math.trunc((nRepCost * mult) / 1024)
    }
    const applyBonus = (): void => {
      const afterBonus = calculateAdditionalCostsForBonusStats(item, nSellCost, nBuyCost, nRepCost, nDivisor, tables)
      nSellCost = afterBonus.sellCost
      nBuyCost = afterBonus.buyCost
      nRepCost = afterBonus.repCost
    }

    // AutoMagic affix cost
    const autoRow = rolledAutoMagicRow(item)
    if (autoRow !== undefined) {
      const auto = getCanonicalTransactionCostTables().autoMagic[autoRow]
      if (!auto) throw new Error(`item-cost: AutoMagic row ${autoRow} outside table`)
      addTerm(auto.add, auto.multiply)
    }

    switch (quality) {
      case ItemQuality.RARE:
      case ItemQuality.CRAFTED: {
        const rareAffixes = item.rolledRareAffixes?.affixes ?? []
        for (const entry of rareAffixes) {
          const affix = entry.affix ?? entry
          addTerm(Number(affix?.add) || 0, Number(affix?.multiply) || 0)
        }
        applyBonus()
        break
      }

      case ItemQuality.UNIQUE: {
        const uDef =
          item.uniqueItemDef ??
          tables.uniques.byCode.get(item.base.id)?.find(u => u.index === item.name)
        if (uDef) {
          addTerm(Number(uDef.costAdd) || 0, Number(uDef.costMult) || 0)
        } else {
          applyBonus()
        }
        break
      }

      case ItemQuality.SET: {
        const sDef =
          item.setItemDef ??
          tables.sets.items.entries.find(
            s => s.item.toLowerCase() === item.base.id.toLowerCase() && s.index === item.name,
          )
        if (sDef) addTerm(Number(sDef.costAdd) || 0, Number(sDef.costMult) || 0)
        break
      }

      case ItemQuality.MAGIC: {
        const pAffix = item.rolledMagicAffixes?.prefix?.affix
        if (pAffix) addTerm(Number(pAffix.add) || 0, Number(pAffix.multiply) || 0)
        const sAffix = item.rolledMagicAffixes?.suffix?.affix
        if (sAffix) addTerm(Number(sAffix.add) || 0, Number(sAffix.multiply) || 0)
        applyBonus()
        break
      }

      case ItemQuality.SUPERIOR:
      case ItemQuality.TEMPERED:
        applyBonus()
        break

      case ItemQuality.LOW: {
        nSell = -Math.trunc(nSellCost / 2)
        nBuy = -Math.trunc(nBuyCost / 2)
        nRep = -Math.trunc(nRepCost / 2)
        break
      }

      default:
        break
    }

    nSellCost += Math.trunc(nSell / nDivisor)
    nBuyCost += Math.trunc(nBuy / nDivisor)
    nRepCost += Math.trunc(nRep / nDivisor)

    if (quality >= ItemQuality.MAGIC && quality <= ItemQuality.TEMPERED) {
      const afterSkill = calculateAdditionalCostsForItemSkill(item, nSellCost, nBuyCost, nRepCost, nDivisor, tables)
      nSellCost = afterSkill.sellCost
      nBuyCost = afterSkill.buyCost
      nRepCost = afterSkill.repCost
    }
  }

  // 0x6fd74a50: socketed children add half their ItemsTxt cost
  for (const socketable of item.socketedItems ?? []) {
    const socketableCost = Math.trunc(txt(socketable.base).cost / 2)
    nSellCost += socketableCost
    nBuyCost += socketableCost
    nRepCost += socketableCost
  }

  // 0x6fd798b0: ethereal and class-specific quartering of the player-sell price
  const ethereal = isEthereal(item)
  if (ethereal) {
    nBuyCost = Math.trunc(nBuyCost / 4)
  }
  if (isClassSpecificItemBase(item.base, tables.itemTypes)) {
    nBuyCost = Math.trunc(nBuyCost / 4)
  }

  const maxDura = item.maxDurability ?? (rec.noDurability ? 0 : rec.durability)
  const curDura = item.durability ?? maxDura

  if (transactionType === TransactionType.SELL) {
    if (ethereal && maxDura > 0 && curDura <= 0) {
      nBuyCost = 0
    }
  } else if (transactionType === TransactionType.REPAIR) {
    if (maxDura > 0) {
      nRepCost = curDura < maxDura ? Math.trunc((nRepCost * (maxDura - curDura)) / maxDura) : 0
    }
  }

  // 0x6fd799d8 / 0x6fd79aa0: Npc.txt multipliers and quest discounts
  const npcRec = resolveNpcRecord(tables, vendorId, npcKey)
  nSellCost = Math.trunc((nSellCost * npcRec.sellMult) / 1024)
  nBuyCost = Math.trunc((nBuyCost * npcRec.buyMult) / 1024)
  nRepCost = Math.trunc((nRepCost * npcRec.repMult) / 1024)

  if (completedQuests && completedQuests.size > 0) {
    for (let i = 0; i < 3; i++) {
      const qFlag = npcRec.questFlag[i]!
      if (qFlag > 0 && completedQuests.has(qFlag)) {
        nSellCost = Math.trunc((nSellCost * npcRec.questSellMult[i]!) / 1024)
        nBuyCost = Math.trunc((nBuyCost * npcRec.questBuyMult[i]!) / 1024)
        nRepCost = Math.trunc((nRepCost * npcRec.questRepMult[i]!) / 1024)
      }
    }
  }

  // 0x6fd79b8d: quantity for non-book, non-quiver items
  if (!isBookItem(item.base) && !isQuiverItem(item.base)) {
    nSellCost *= nQuantity
    if (rec.stackable && isItemRepairable(item)) {
      const maxStack = maxStackOf(item.base)
      nRepCost = nQuantity < maxStack ? nRepCost * (maxStack - nQuantity) : 0
    }
    nBuyCost *= nQuantity
  }

  if (transactionType === TransactionType.SELL) {
    const cap = npcRec.maxBuy[difficulty]
    const nCost = nBuyCost > cap ? cap : nBuyCost
    return Math.max(1, nCost)
  }

  if (transactionType === TransactionType.REPAIR) {
    const nCost = rp !== 0 ? nRepCost - fogMulDiv113c(rp, nRepCost, 100) : nRepCost
    return Math.max(1, nCost)
  }

  const nCost = rp !== 0 ? nSellCost - fogMulDiv113c(rp, nSellCost, 100) : nSellCost
  return Math.max(1, nCost)
}
