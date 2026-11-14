import { describe, expect, it } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import {
  VendorNpcId,
  VENDOR_COLUMN_PREFIXES,
  TOWN_NPC_DESCRIPTORS,
  getTownNpcDescriptorByName,
} from '../src/common/units/npc-table.ts'
import {
  computeVendorItemLevel,
  resolveVendorBaseUpgrade,
  generateVendorStoreInventory,
  generateGambleInventory,
  resolveGambledItem,
  VENDOR_NORMAL_ILVL_CAPS,
} from '../src/common/items/vendor-generator.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { ItemQuality } from '../src/common/items/items.ts'

describe('1.13c Vendor Economic & Inventory Tables (M19-P1 & M19-P2)', () => {
  const dropTables = getEmbeddedDropTables()

  it('parses all 17 canonical vendors in Npc.txt, Gamble.txt, Books.txt, and LowQualityItems.txt', () => {
    expect(VENDOR_COLUMN_PREFIXES).toHaveLength(17)
    // Blizzard's historical typo in Weapons.txt/Armor.txt/Misc.txt is 'Hralti' at index 6
    expect(VENDOR_COLUMN_PREFIXES[6]).toBe('Hralti')

    expect(dropTables.npcTable!.size).toBeGreaterThanOrEqual(17)
    const akara = dropTables.npcTable!.getByVendorId(VendorNpcId.AKARA)
    expect(akara).toBeDefined()
    expect(akara?.npc.toLowerCase()).toBe('akara')
    expect(akara?.maxBuy).toEqual([5000, 30000, 35000])

    const charsi = dropTables.npcTable!.getByVendorId(VendorNpcId.CHARSI)
    expect(charsi).toBeDefined()
    expect(charsi?.npc.toLowerCase()).toBe('charsi')
    expect(charsi?.repMult).toBeGreaterThan(0)

    expect(dropTables.gambleCodes!.length).toBeGreaterThan(30)
    expect(dropTables.gambleCodes).toContain('rin')
    expect(dropTables.gambleCodes).toContain('amu')
    expect(dropTables.gambleCodes).toContain('ci0')

    const tbk = dropTables.booksTable!.getByBookCode('tbk')
    expect(tbk).toBeDefined()
    expect(tbk?.scrollSpellCode).toBe('tsc')
    expect(tbk?.baseCost).toBe(250)
    expect(tbk?.costPerCharge).toBe(50)

    const ibk = dropTables.booksTable!.getByBookCode('ibk')
    expect(ibk).toBeDefined()
    expect(ibk?.scrollSpellCode).toBe('isc')

    expect(dropTables.lowQualityItems).toHaveLength(4)
    expect(dropTables.lowQualityItems![0]).toBe('Crude')
  })

  it('resolves all Town NPC descriptors across Acts 1-5 including healers, traders, gamblers, and Cain', () => {
    expect(TOWN_NPC_DESCRIPTORS.length).toBeGreaterThanOrEqual(25)

    const akara = getTownNpcDescriptorByName('Akara', 0)
    expect(akara?.vendorId).toBe(VendorNpcId.AKARA)
    expect(akara?.canTrade).toBe(true)
    expect(akara?.canHeal).toBe(true)

    const gheed = getTownNpcDescriptorByName('Gheed', 0)
    expect(gheed?.vendorId).toBe(VendorNpcId.GHEED)
    expect(gheed?.canTrade).toBe(true)
    expect(gheed?.canGamble).toBe(true)

    const charsi = getTownNpcDescriptorByName('Charsi', 0)
    expect(charsi?.vendorId).toBe(VendorNpcId.CHARSI)
    expect(charsi?.canTrade).toBe(true)
    expect(charsi?.canRepair).toBe(true)

    const cainA1 = getTownNpcDescriptorByName('Deckard Cain', 0)
    expect(cainA1?.canIdentify).toBe(true)

    const atma = getTownNpcDescriptorByName('Atma', 1)
    expect(atma?.canHeal).toBe(true)

    const hratli = getTownNpcDescriptorByName('Hratli', 2)
    expect(hratli?.vendorId).toBe(VendorNpcId.HRATLI)
    expect(hratli?.canTrade).toBe(true)
    expect(hratli?.canRepair).toBe(true)

    const larzuk = getTownNpcDescriptorByName('Larzuk', 4)
    expect(larzuk?.vendorId).toBe(VendorNpcId.LARZUK)
    expect(larzuk?.canTrade).toBe(true)
    expect(larzuk?.canRepair).toBe(true)
  })

  it('computes 1.13c vendor ilvl with Normal Act caps [12, 20, 28, 36, 45] and uncapped NM/Hell cLvl + 5', () => {
    expect(VENDOR_NORMAL_ILVL_CAPS).toEqual([12, 20, 28, 36, 45])

    // Normal difficulty: capped by Act
    expect(computeVendorItemLevel(VendorNpcId.AKARA, 0, 1, 0)).toBe(6)
    expect(computeVendorItemLevel(VendorNpcId.AKARA, 0, 10, 0)).toBe(12) // Act 1 cap 12
    expect(computeVendorItemLevel(VendorNpcId.FARA, 0, 30, 1)).toBe(20) // Act 2 cap 20
    expect(computeVendorItemLevel(VendorNpcId.HRATLI, 0, 30, 2)).toBe(28) // Act 3 cap 28
    expect(computeVendorItemLevel(VendorNpcId.HALBU, 0, 40, 3)).toBe(36) // Act 4 cap 36
    expect(computeVendorItemLevel(VendorNpcId.LARZUK, 0, 50, 4)).toBe(45) // Act 5 cap 45

    // Nightmare & Hell: uncapped cLvl + 5 clamped to [1..99]
    expect(computeVendorItemLevel(VendorNpcId.AKARA, 1, 40, 0)).toBe(45)
    expect(computeVendorItemLevel(VendorNpcId.AKARA, 2, 85, 0)).toBe(90)
    expect(computeVendorItemLevel(VendorNpcId.LARZUK, 2, 97, 4)).toBe(99)
  })

  it('upgrades Normal base items to Exceptional/Elite in Nightmare and Hell according to 1.13c formulas', () => {
    const cap = dropTables.getBase('cap')!

    // Normal difficulty never upgrades base item tier
    const rngNorm = new D2Rng(12345)
    for (let i = 0; i < 20; i++) {
      const res = resolveVendorBaseUpgrade(cap, 80, 12, 0, true, dropTables, rngNorm)
      expect(res.id).toBe('cap')
    }

    // Hell difficulty at high cLvl upgrades some items to ubercode ('xap') or ultracode ('uap')
    const rngHell = new D2Rng(54321)
    const seenIds = new Set<string>()
    for (let i = 0; i < 60; i++) {
      const res = resolveVendorBaseUpgrade(cap, 85, 90, 2, true, dropTables, rngHell)
      seenIds.add(res.id)
    }
    expect(seenIds.has('xap') || seenIds.has('uap')).toBe(true)
  })

  it('generates Akara, Charsi, Hratli, and Larzuk store inventories across difficulties and cLvls', () => {
    // Akara (Vendor 0) in Normal at cLvl 1
    const akaraStore = generateVendorStoreInventory({
      vendorId: VendorNpcId.AKARA,
      difficulty: 0,
      cLvl: 1,
      tables: dropTables,
      rng: new D2Rng(1001),
    })
    expect(akaraStore.vendorId).toBe(VendorNpcId.AKARA)
    expect(akaraStore.nItemLevel).toBe(6)
    const akaraMisc = akaraStore.tabs.misc.list()
    expect(akaraMisc.length).toBeGreaterThan(0)
    // Akara permanently sells Tomes/Scrolls/Potions/Keys
    const akaraCodes = new Set(akaraMisc.map(p => p.item.base.id))
    expect(akaraCodes.has('isc')).toBe(true)
    expect(akaraCodes.has('tsc')).toBe(true)
    expect(akaraCodes.has('ibk')).toBe(true)
    expect(akaraCodes.has('tbk')).toBe(true)
    expect(akaraCodes.has('hp1')).toBe(true)
    expect(akaraCodes.has('mp1')).toBe(true)

    for (const placed of akaraMisc) {
      if (['isc', 'tsc', 'ibk', 'tbk', 'hp1', 'mp1', 'key'].includes(placed.item.base.id)) {
        expect(placed.item.permStore).toBe(true)
        expect(placed.item.quality).toBe(ItemQuality.NORMAL)
      }
    }

    // Charsi (Vendor 2) in Normal at cLvl 12
    const charsiStore = generateVendorStoreInventory({
      vendorId: VendorNpcId.CHARSI,
      difficulty: 0,
      cLvl: 12,
      tables: dropTables,
      rng: new D2Rng(2002),
    })
    expect(charsiStore.nItemLevel).toBe(12)
    const charsiArmor = charsiStore.tabs.armor.list()
    const charsiWeap1 = charsiStore.tabs.weapons1.list()
    expect(charsiArmor.length).toBeGreaterThan(0)
    expect(charsiWeap1.length).toBeGreaterThan(0)

    // Verify magic items generated by Charsi are already identified and have affixes
    const magicArmors = charsiArmor.filter(p => p.item.quality === ItemQuality.MAGIC)
    expect(magicArmors.length).toBeGreaterThan(0)
    for (const m of magicArmors) {
      expect(m.item.flags?.identified).toBe(true)
      expect(Boolean(m.item.prefix || m.item.suffix)).toBe(true)
    }

    // Hratli (Vendor 6, 'Hralti' column) in Nightmare at cLvl 45
    const hratliStore = generateVendorStoreInventory({
      vendorId: VendorNpcId.HRATLI,
      difficulty: 1,
      cLvl: 45,
      tables: dropTables,
      rng: new D2Rng(3003),
    })
    expect(hratliStore.nItemLevel).toBe(50)
    expect(hratliStore.tabs.armor.list().length).toBeGreaterThan(0)
    expect(hratliStore.tabs.weapons1.list().length).toBeGreaterThan(0)

    // Larzuk (Vendor 15) in Hell at cLvl 80
    const larzukStore = generateVendorStoreInventory({
      vendorId: VendorNpcId.LARZUK,
      difficulty: 2,
      cLvl: 80,
      tables: dropTables,
      rng: new D2Rng(4004),
    })
    expect(larzukStore.nItemLevel).toBe(85)
    expect(larzukStore.tabs.armor.list().length).toBeGreaterThan(0)
    expect(larzukStore.tabs.weapons1.list().length).toBeGreaterThan(0)
  })

  it('generates Gamble inventory and resolves mystery items on purchase', () => {
    const rng = new D2Rng(7777)
    const gambleGrid = generateGambleInventory({
      vendorId: VendorNpcId.GHEED,
      cLvl: 50,
      tables: dropTables,
      rng,
    })

    const allGambleItems = gambleGrid.list()
    expect(allGambleItems.length).toBeGreaterThan(5)

    // Ring and Amulet are part of the Gamble.txt candidate pool; 1.13c no
    // longer forces them into the first two slots.
    expect(dropTables.gambleCodes ?? []).toEqual(expect.arrayContaining(['rin', 'amu']))

    for (const placed of allGambleItems) {
      expect(placed.item.isGambleMystery).toBe(true)
      expect(placed.item.identified).toBe(false)
      expect(placed.item.ilvl).toBeGreaterThanOrEqual(45)
      expect(placed.item.ilvl).toBeLessThanOrEqual(54)
    }

    // Resolve gambled items across multiple rolls and verify quality & identification
    const rarities = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const target = allGambleItems[i % allGambleItems.length]!.item
      const resolved = resolveGambledItem({
        mysteryItem: target,
        cLvl: 50,
        tables: dropTables,
        rng,
      })
      expect(resolved.identified).toBe(true)
      expect(resolved.isGambleMystery).toBe(false)
      rarities.add(resolved.rarity ?? 'normal')
    }
    expect(rarities.has('magic')).toBe(true)
  })
})
