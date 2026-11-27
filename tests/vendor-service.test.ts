import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import {
  VendorSessionManager,
  deductGoldFromPurse,
  addGoldToPurse,
  type GoldPurseState,
} from '../src/common/items/vendor-service.ts'
import { VendorNpcId, getTownNpcDescriptorByName } from '../src/common/units/npc-table.ts'
import { Inventory, ItemFlag, decodeItemFlags, type Item } from '../src/common/items/items.ts'
import { createDroppedItem } from '../src/common/items/drop-tables.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'

describe('1.13c Town NPC Service & Vendor Session Manager (M19-P4)', () => {
  const tables = getEmbeddedDropTables()

  it('deducts gold from inventory first and overflows into stash, and adds gold up to 10,000 * cLvl cap', () => {
    const purse: GoldPurseState = { inventoryGold: 3000, stashGold: 10000, cLvl: 1 }
    expect(deductGoldFromPurse(purse, 5000)).toBe(true)
    expect(purse.inventoryGold).toBe(0)
    expect(purse.stashGold).toBe(8000)

    expect(deductGoldFromPurse(purse, 9000)).toBe(false)
    expect(purse.stashGold).toBe(8000)

    // At cLvl 1, max inventory gold is 10,000; adding 15,000 puts 10,000 in inventory and 5,000 in stash
    addGoldToPurse(purse, 15000)
    expect(purse.inventoryGold).toBe(10000)
    expect(purse.stashGold).toBe(13000)
  })

  it('supports Shift-Buy of Scrolls into a non-full Tome up to 20 charges', () => {
    const manager = new VendorSessionManager(tables, 0x123456)
    const akara = getTownNpcDescriptorByName('Akara', 0)!
    manager.openTradeSession(akara, 0, 10)
    manager.setActiveTab('misc')

    const miscGrid = manager.getActiveTabInventory(0, 10)!
    const scrollPlacement = miscGrid.list().find(p => p.item.base.id === 'tp' || p.item.base.id === 'tsc')!
    expect(scrollPlacement).toBeDefined()

    // Put a Tome of Town Portal ('tbk') with 3 scrolls into player's inventory
    const playerInventory = new Inventory(10, 4)
    const tbkBase = tables.getBase('tbk')!
    const tomeItem: Item = {
      ...createDroppedItem(tbkBase, 'normal', { itemTypes: tables.itemTypes, ilvl: 1, dwInitSeed: 701 }),
      stack: 3,
      quantity: 3,
    }
    playerInventory.add(tomeItem)

    const purse: GoldPurseState = { inventoryGold: 10000, stashGold: 0, cLvl: 10 }
    const res = manager.buyItemAtCell({
      cellX: scrollPlacement.x,
      cellY: scrollPlacement.y,
      shiftBuy: true,
      purse,
      playerInventory,
      difficulty: 0,
    })

    expect(res.ok).toBe(true)
    expect(res.countPurchased).toBe(17) // 3 -> 20
    const updatedTome = playerInventory.list().find(p => p.item.base.id === 'tbk')!.item
    expect(updatedTome.quantity).toBe(20)
  })

  it('supports selling player items to NPC and placing non-permanent items into vendor tabs for Buyback', () => {
    const manager = new VendorSessionManager(tables, 0x654321)
    const charsi = getTownNpcDescriptorByName('Charsi', 0)!
    manager.openTradeSession(charsi, 0, 12)

    const capBase = tables.getBase('cap')!
    const magicCap = createDroppedItem(capBase, 'magic', {
      itemTypes: tables.itemTypes,
      ilvl: 12,
      dwInitSeed: 999,
      itemRng: new D2Rng(999),
    })

    const purse: GoldPurseState = { inventoryGold: 500, stashGold: 0, cLvl: 12 }
    const sellRes = manager.sellPlayerItem({
      item: magicCap,
      purse,
      difficulty: 0,
    })

    expect(sellRes.ok).toBe(true)
    expect(sellRes.goldEarned).toBeGreaterThan(0)
    expect(purse.inventoryGold).toBe(500 + sellRes.goldEarned)
    expect(sellRes.placedInTab).toBe('armor')

    // Verify quest items cannot be sold
    const hfhBase = tables.getBase('hfh') // Hellforge Hammer (quest > 0)
    if (hfhBase) {
      const questItem = createDroppedItem(hfhBase, 'normal', { itemTypes: tables.itemTypes, ilvl: 1, dwInitSeed: 702 })
      const qRes = manager.sellPlayerItem({ item: questItem, purse, difficulty: 0 })
      expect(qRes.ok).toBe(false)
    }
  })

  it('repairs single and all damaged items via blacksmith NPCs and identifies all items via Deckard Cain', () => {
    const manager = new VendorSessionManager(tables, 0xabcdef)
    const charsi = getTownNpcDescriptorByName('Charsi', 0)!
    manager.openTradeSession(charsi, 0, 20)

    const capBase = tables.getBase('cap')!
    const damagedCap: Item = {
      ...createDroppedItem(capBase, 'normal', { itemTypes: tables.itemTypes, ilvl: 10, dwInitSeed: 703 }),
      durability: 2,
      maxDurability: 12,
    }

    const equipped = new Map<string, Item>([['head', damagedCap]])
    const playerInventory = new Inventory(10, 4)
    const purse: GoldPurseState = { inventoryGold: 5000, stashGold: 0, cLvl: 20 }

    const repairRes = manager.repairAllItems({
      equippedItems: equipped,
      playerInventory,
      purse,
      difficulty: 0,
    })
    expect(repairRes.ok).toBe(true)
    expect(repairRes.repairedCount).toBe(1)
    expect(repairRes.goldSpent).toBeGreaterThan(0)
    expect(equipped.get('head')?.durability).toBe(12)

    // Deckard Cain Identify All
    const unidRawFlags = 0 // not identified
    const unidCap: Item = {
      ...createDroppedItem(capBase, 'magic', { itemTypes: tables.itemTypes, ilvl: 10, dwInitSeed: 704 }),
      rawFlags: unidRawFlags,
      flags: decodeItemFlags(unidRawFlags),
      identified: false,
    }
    playerInventory.add(unidCap)

    const idRes = manager.identifyAllItems({
      playerInventory,
      purse,
      cainRescued: true,
    })
    expect(idRes.ok).toBe(true)
    expect(idRes.identifiedCount).toBe(1)
    expect(idRes.goldSpent).toBe(0)
    expect(playerInventory.list()[0]?.item.flags?.identified).toBe(true)
  })
})
