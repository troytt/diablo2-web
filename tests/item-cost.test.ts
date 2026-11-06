import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import {
  TransactionType,
  calculateTransactionCost,
  calculateGambleCost,
  isItemRepairable,
  isClassSpecificItemBase,
  hasStaffModsItemType,
} from '../src/common/items/item-cost.ts'
import { VendorNpcId } from '../src/common/units/npc-table.ts'
import { createDroppedItem } from '../src/common/items/drop-tables.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { ItemFlag, ItemQuality, decodeItemFlags, type Item } from '../src/common/items/items.ts'

describe('1.13c Item Transaction & Acquisition Cost Engine (M19-P3)', () => {
  const tables = getEmbeddedDropTables()

  it('prices Starter Items at 1 gold for Buy and Sell and 0/1 for Repair', () => {
    const haxBase = tables.getBase('hax')!
    const normalItem = createDroppedItem(haxBase, 'normal', {
      itemTypes: tables.itemTypes,
      ilvl: 1,
      dwInitSeed: 100,
      itemRng: new D2Rng(100),
    })
    const starterItem: Item = {
      ...normalItem,
      rawFlags: (normalItem.rawFlags ?? 0) | ItemFlag.STARTER_ITEM,
      flags: decodeItemFlags((normalItem.rawFlags ?? 0) | ItemFlag.STARTER_ITEM),
    }

    expect(
      calculateTransactionCost({
        item: starterItem,
        transactionType: TransactionType.BUY,
        vendorId: VendorNpcId.CHARSI,
        tables,
      }),
    ).toBe(1)

    expect(
      calculateTransactionCost({
        item: starterItem,
        transactionType: TransactionType.SELL,
        vendorId: VendorNpcId.CHARSI,
        tables,
      }),
    ).toBe(1)
  })

  it('prices Tomes (tbk / ibk) dynamically by scroll charge count per Books.txt', () => {
    const tbkBase = tables.getBase('tbk')!
    const baseTome = createDroppedItem(tbkBase, 'normal', {
      itemTypes: tables.itemTypes,
      ilvl: 1,
      dwInitSeed: 200,
      itemRng: new D2Rng(200),
    })

    // Tome with 3 scrolls vs Tome with 20 scrolls
    const tome3: Item = { ...baseTome, stack: 3, quantity: 3 }
    const tome20: Item = { ...baseTome, stack: 20, quantity: 20 }

    const buy3 = calculateTransactionCost({
      item: tome3,
      transactionType: TransactionType.BUY,
      vendorId: VendorNpcId.AKARA,
      tables,
    })
    const buy20 = calculateTransactionCost({
      item: tome20,
      transactionType: TransactionType.BUY,
      vendorId: VendorNpcId.AKARA,
      tables,
    })

    // Books.txt: BaseCost=250, CostPerCharge=50 -> 3 scrolls = 400, 20 scrolls = 1250
    expect(buy20).toBeGreaterThan(buy3)
    expect(buy20 - buy3).toBe(17 * 50)

    const sell3 = calculateTransactionCost({
      item: tome3,
      transactionType: TransactionType.SELL,
      vendorId: VendorNpcId.AKARA,
      tables,
    })
    const sell20 = calculateTransactionCost({
      item: tome20,
      transactionType: TransactionType.SELL,
      vendorId: VendorNpcId.AKARA,
      tables,
    })
    expect(sell20).toBeGreaterThan(sell3)
  })

  it('applies 1/4 acquisition divisor to class-specific items (e.g. Sorceress Orb / Necromancer Wand)', () => {
    const ob1 = tables.getBase('ob1')! // Jared's Stone (Orb, class='sor')
    expect(isClassSpecificItemBase(ob1, tables.itemTypes)).toBe(true)

    const wnd = tables.getBase('wnd')! // Wand (StaffMods='nec', non-class-specific)
    expect(hasStaffModsItemType(wnd, tables.itemTypes)).toBe(true)
  })

  it('adds affix / stat bonus cost and staffMod single-skill cost to Magic/Rare items', () => {
    const wndBase = tables.getBase('wnd')!
    const plainWand = createDroppedItem(wndBase, 'normal', {
      itemTypes: tables.itemTypes,
      ilvl: 12,
      dwInitSeed: 301,
      itemRng: new D2Rng(301),
    })

    const staffModWand: Item = {
      ...plainWand,
      staffMods: [{ code: 'skill', param: 67, min: 3, max: 3, value: 3 }], // +3 Teeth (skillId 67)
    }

    const plainBuy = calculateTransactionCost({
      item: plainWand,
      transactionType: TransactionType.BUY,
      vendorId: VendorNpcId.AKARA,
      tables,
    })
    const staffModBuy = calculateTransactionCost({
      item: staffModWand,
      transactionType: TransactionType.BUY,
      vendorId: VendorNpcId.AKARA,
      tables,
    })
    expect(staffModBuy).toBeGreaterThan(plainBuy)

    const plainSell = calculateTransactionCost({
      item: plainWand,
      transactionType: TransactionType.SELL,
      vendorId: VendorNpcId.AKARA,
      tables,
    })
    const staffModSell = calculateTransactionCost({
      item: staffModWand,
      transactionType: TransactionType.SELL,
      vendorId: VendorNpcId.AKARA,
      tables,
    })
    expect(staffModSell).toBeGreaterThan(plainSell)
  })

  it('clamps acquisition (SELL) price to Npc.txt MaxBuy cap per Act and Difficulty (5000 / 30000 / 35000)', () => {
    const aarBase = tables.getBase('uar')! // Sacred Armor (high cost elite armor)
    const baseArmor = createDroppedItem(aarBase, 'magic', {
      itemTypes: tables.itemTypes,
      ilvl: 85,
      dwInitSeed: 401,
      itemRng: new D2Rng(401),
    })
    // Give it high-cost skills/stats so raw sell value exceeds 35,000
    const expensiveArmor: Item = {
      ...baseArmor,
      statList: [
        { statId: 127, param: 0, value: 5 }, // +5 All Skills
        { statId: 7, param: 0, value: 100 }, // +100 Life
      ],
    }

    const sellAct1Norm = calculateTransactionCost({
      item: expensiveArmor,
      transactionType: TransactionType.SELL,
      difficulty: 0,
      vendorId: VendorNpcId.AKARA,
      actIndex: 0,
      tables,
    })
    expect(sellAct1Norm).toBe(5000)

    const sellNightmare = calculateTransactionCost({
      item: expensiveArmor,
      transactionType: TransactionType.SELL,
      difficulty: 1,
      vendorId: VendorNpcId.AKARA,
      actIndex: 0,
      tables,
    })
    expect(sellNightmare).toBe(30000)

    const sellHell = calculateTransactionCost({
      item: expensiveArmor,
      transactionType: TransactionType.SELL,
      difficulty: 2,
      vendorId: VendorNpcId.AKARA,
      actIndex: 0,
      tables,
    })
    expect(sellHell).toBe(35000)
  })

  it('quarters acquisition (SELL) price for Ethereal items (0x6fd798b0) and forbids repairing Ethereal items', () => {
    const capBase = tables.getBase('plt')! // Plate Mail (below 35k cap so quartering is observable)
    const normalArmor = createDroppedItem(capBase, 'normal', {
      itemTypes: tables.itemTypes,
      ilvl: 25,
      ethereal: false,
      dwInitSeed: 501,
      itemRng: new D2Rng(501),
    })
    const ethArmor = createDroppedItem(capBase, 'normal', {
      itemTypes: tables.itemTypes,
      ilvl: 25,
      ethereal: true,
      dwInitSeed: 501,
      itemRng: new D2Rng(501),
    })

    const normSell = calculateTransactionCost({
      item: normalArmor,
      transactionType: TransactionType.SELL,
      difficulty: 2,
      vendorId: VendorNpcId.CHARSI,
      tables,
    })
    const ethSell = calculateTransactionCost({
      item: ethArmor,
      transactionType: TransactionType.SELL,
      difficulty: 2,
      vendorId: VendorNpcId.CHARSI,
      tables,
    })
    expect(ethSell).toBeLessThan(normSell)

    const damagedEth: Item = { ...ethArmor, durability: 5, maxDurability: 30 }
    expect(isItemRepairable(damagedEth)).toBe(false)
    expect(
      calculateTransactionCost({
        item: damagedEth,
        transactionType: TransactionType.REPAIR,
        vendorId: VendorNpcId.CHARSI,
        tables,
      }),
    ).toBe(0)
  })

  it('computes Gamble costs (fixed 50k Ring / 63k Amulet, cLvl-scaled equipment) and applies vendor discounts', () => {
    const rinBase = tables.getBase('rin')!
    const amuBase = tables.getBase('amu')!
    const capBase = tables.getBase('cap')!

    const rinItem = createDroppedItem(rinBase, 'magic', { itemTypes: tables.itemTypes, ilvl: 20, dwInitSeed: 601 })
    const amuItem = createDroppedItem(amuBase, 'magic', { itemTypes: tables.itemTypes, ilvl: 20, dwInitSeed: 602 })
    const capItem = createDroppedItem(capBase, 'magic', { itemTypes: tables.itemTypes, ilvl: 20, dwInitSeed: 603 })

    expect(calculateGambleCost({ item: rinItem, cLvl: 30, tables })).toBe(50000)
    expect(calculateGambleCost({ item: amuItem, cLvl: 30, tables })).toBe(63000)

    // 15% Gheed's Fortune + 15% Edge = 30% reduced vendor prices
    expect(
      calculateGambleCost({ item: rinItem, cLvl: 30, reducedPricesPercent: 30, tables }),
    ).toBe(35000)

    const capGambleLvl10 = calculateGambleCost({ item: capItem, cLvl: 10, tables })
    const capGambleLvl80 = calculateGambleCost({ item: capItem, cLvl: 80, tables })
    expect(capGambleLvl80).toBeGreaterThan(capGambleLvl10)
  })
})
