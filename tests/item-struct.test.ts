import { describe, it, expect } from 'vitest'
import {
  ItemFlag,
  ItemMode,
  EquippedSlot,
  StoragePage,
  ItemQuality,
  decodeItemFlags,
  encodeItemFlags,
  formatItemCode,
  getItemQualityName,
  createItem,
  goldItem,
  GOLD_BASE,
  Inventory,
} from '../src/common/items/items.ts'
import type {
  Item,
  ItemBase,
  ItemLocation,
  ItemAffixSlot,
  ItemStatEntry,
  ItemRunewordData,
  ItemEarData,
} from '../src/common/items/items.ts'
import { Rng } from '../src/common/rng/d2-rng.ts'

describe('Item Bit-Aligned Data Structure & Specifications (D2Common!6FD77180 / D2Common!6FD592C4)', () => {
  describe('Header Flags Bitmask & Encoders', () => {
    it('defines standard D2 item header flag bitmasks', () => {
      expect(ItemFlag.IDENTIFIED).toBe(0x00000001)
      expect(ItemFlag.SOCKETED).toBe(0x00000008)
      expect(ItemFlag.NEW_ITEM).toBe(0x00000010)
      expect(ItemFlag.IS_EAR).toBe(0x00000080)
      expect(ItemFlag.STARTER_ITEM).toBe(0x00000100)
      expect(ItemFlag.SIMPLE).toBe(0x00000800)
      expect(ItemFlag.ETHEREAL).toBe(0x00001000)
      expect(ItemFlag.ANY).toBe(0x00002000)
      expect(ItemFlag.PERSONALIZED).toBe(0x00004000)
      expect(ItemFlag.GAMBLE).toBe(0x00008000)
      expect(ItemFlag.RUNEWORD).toBe(0x00010000)
    })

    it('decodes and encodes 32-bit flags bitmask symmetrically', () => {
      const flags = {
        identified: true,
        socketed: true,
        newItem: false,
        isEar: false,
        starterItem: false,
        simple: false,
        ethereal: true,
        personalized: true,
        runeword: true,
      }
      const raw = encodeItemFlags(flags)
      expect(raw & ItemFlag.IDENTIFIED).toBeTruthy()
      expect(raw & ItemFlag.SOCKETED).toBeTruthy()
      expect(raw & ItemFlag.ETHEREAL).toBeTruthy()
      expect(raw & ItemFlag.PERSONALIZED).toBeTruthy()
      expect(raw & ItemFlag.RUNEWORD).toBeTruthy()
      expect(raw & ItemFlag.SIMPLE).toBeFalsy()

      const decoded = decodeItemFlags(raw)
      expect(decoded.identified).toBe(true)
      expect(decoded.socketed).toBe(true)
      expect(decoded.ethereal).toBe(true)
      expect(decoded.personalized).toBe(true)
      expect(decoded.runeword).toBe(true)
      expect(decoded.simple).toBe(false)
      expect(decoded.newItem).toBe(false)
    })
  })

  describe('Item Code & Quality Helpers', () => {
    it('formats 3-4 character item codes with right-padded spaces to 32 bits (4 bytes)', () => {
      expect(formatItemCode('swd')).toBe('swd ')
      expect(formatItemCode('gld')).toBe('gld ')
      expect(formatItemCode('hpot')).toBe('hpot')
      expect(formatItemCode('am01')).toBe('am01')
    })

    it('maps ItemQuality enums to names correctly', () => {
      expect(getItemQualityName(ItemQuality.LOW)).toBe('low')
      expect(getItemQualityName(ItemQuality.NORMAL)).toBe('normal')
      expect(getItemQualityName(ItemQuality.SUPERIOR)).toBe('superior')
      expect(getItemQualityName(ItemQuality.MAGIC)).toBe('magic')
      expect(getItemQualityName(ItemQuality.SET)).toBe('set')
      expect(getItemQualityName(ItemQuality.RARE)).toBe('rare')
      expect(getItemQualityName(ItemQuality.UNIQUE)).toBe('unique')
      expect(getItemQualityName(ItemQuality.CRAFTED)).toBe('crafted')
      expect(getItemQualityName(ItemQuality.TEMPERED)).toBe('tempered')
    })
  })

  describe('Simple / Compact Items (dwFlags.Simple == 1)', () => {
    it('creates gold item conforming to simple bitstream layout', () => {
      const gold = goldItem(1500)
      expect(gold.base.id).toBe('gold')
      expect(gold.code).toBe('gld ')
      expect(gold.stack).toBe(1500)
      expect(gold.quantity).toBe(1500)
      expect(gold.flags?.simple).toBe(true)
      expect(gold.rawFlags! & ItemFlag.SIMPLE).toBeTruthy()
      expect(gold.quality).toBe(ItemQuality.NORMAL)
      expect(gold.version).toBe(0x65)
    })

    it('populates simple potion/scroll item without extended fields', () => {
      const potionBase: ItemBase = {
        id: 'hp1',
        name: 'Minor Healing Potion',
        kind: 'misc',
        invWidth: 1,
        invHeight: 1,
        maxStack: 5,
        value: 20,
        damage: 0,
        defense: 0,
        tags: ['misc'],
        level: 1,
      }
      const item: Item = {
        base: potionBase,
        prefix: null,
        suffix: null,
        level: 1,
        name: 'Minor Healing Potion',
        stats: {},
        invWidth: 1,
        invHeight: 1,
        stack: 3,
        value: 20,
        code: 'hp1 ',
        rawFlags: ItemFlag.IDENTIFIED | ItemFlag.SIMPLE,
        flags: { identified: true, simple: true },
        version: 0x65,
        location: {
          mode: ItemMode.BELT,
          gridX: 2,
          gridY: 0,
          storagePage: StoragePage.BELT,
        },
        quantity: 3,
      }

      expect(item.code).toBe('hp1 ')
      expect(item.flags?.simple).toBe(true)
      expect(item.location?.mode).toBe(ItemMode.BELT)
      expect(item.location?.storagePage).toBe(StoragePage.BELT)
      expect(item.uniqueId).toBeUndefined()
      expect(item.statList).toBeUndefined()
    })
  })

  describe('Extended Item Structure & Location Modes (D2Common!6FD77180)', () => {
    const swordBase: ItemBase = {
      id: 'crs',
      name: 'Crystal Sword',
      kind: 'weapon',
      invWidth: 2,
      invHeight: 3,
      maxStack: 1,
      value: 1200,
      damage: 15,
      defense: 0,
      tags: ['weap', 'swor'],
      level: 11,
    }

    it('supports Stored Mode (Inventory, Cube, Stash)', () => {
      const storedLocation: ItemLocation = {
        mode: ItemMode.STORED,
        gridX: 4,
        gridY: 2,
        storagePage: StoragePage.INVENTORY,
      }
      expect(storedLocation.mode).toBe(ItemMode.STORED)
      expect(storedLocation.gridX).toBe(4)
      expect(storedLocation.gridY).toBe(2)
      expect(storedLocation.storagePage).toBe(StoragePage.INVENTORY)
      expect(storedLocation.worldX).toBeUndefined()
    })

    it('supports Equipped Mode on character body', () => {
      const equippedLocation: ItemLocation = {
        mode: ItemMode.EQUIPPED,
        equippedSlot: EquippedSlot.RIGHT_HAND,
        storagePage: StoragePage.EQUIPPED,
      }
      expect(equippedLocation.mode).toBe(ItemMode.EQUIPPED)
      expect(equippedLocation.equippedSlot).toBe(EquippedSlot.RIGHT_HAND)
      expect(equippedLocation.storagePage).toBe(StoragePage.EQUIPPED)
    })

    it('supports Ground and Dropping Modes with 16-bit world coordinates', () => {
      const groundLocation: ItemLocation = {
        mode: ItemMode.GROUND,
        worldX: 25140,
        worldY: 18420,
      }
      expect(groundLocation.mode).toBe(ItemMode.GROUND)
      expect(groundLocation.worldX).toBe(25140)
      expect(groundLocation.worldY).toBe(18420)
      expect(groundLocation.equippedSlot).toBeUndefined()
    })

    it('populates Magic Item with prefixId, suffixId, and stats list', () => {
      const statEntries: ItemStatEntry[] = [
        { statId: 21, statName: 'tohit', value: 75 },
        { statId: 0, statName: 'strength', value: 12 },
      ]
      const magicItem: Item = {
        base: swordBase,
        prefix: {
          id: 'bronze',
          name: 'Bronze',
          kind: 'prefix',
          level: 1,
          itemTypes: ['weap'],
          modifiers: [{ stat: 'tohit', min: 10, max: 20 }],
        },
        suffix: {
          id: 'of_might',
          name: 'of Might',
          kind: 'suffix',
          level: 5,
          itemTypes: ['weap'],
          modifiers: [{ stat: 'strength', min: 1, max: 5 }],
        },
        level: 25,
        name: 'Bronze Crystal Sword of Might',
        stats: { damage: 15, tohit: 75, strength: 12 },
        invWidth: 2,
        invHeight: 3,
        stack: 1,
        value: 2500,
        rawFlags: ItemFlag.IDENTIFIED,
        flags: { identified: true },
        version: 0x65,
        code: 'crs ',
        uniqueId: 0xdeadbeef,
        ilvl: 25,
        quality: ItemQuality.MAGIC,
        rarity: 'magic',
        magicPrefixId: 104,
        magicSuffixId: 215,
        durability: 20,
        maxDurability: 20,
        statList: statEntries,
      }

      expect(magicItem.quality).toBe(ItemQuality.MAGIC)
      expect(magicItem.magicPrefixId).toBe(104)
      expect(magicItem.magicSuffixId).toBe(215)
      expect(magicItem.statList?.length).toBe(2)
      expect(magicItem.statList?.[0]?.statId).toBe(21)
      expect(magicItem.uniqueId).toBe(0xdeadbeef)
    })

    it('populates Rare Item with 6 affix slots and dual rare names', () => {
      const rareAffixes: ItemAffixSlot[] = [
        { present: true, id: 105 },
        { present: true, id: 216 },
        { present: true, id: 310 },
        { present: false },
        { present: false },
        { present: false },
      ]
      const rareItem: Item = {
        base: swordBase,
        prefix: null,
        suffix: null,
        level: 45,
        name: 'Cruel Song Crystal Sword',
        stats: { damage: 45 },
        invWidth: 2,
        invHeight: 3,
        stack: 1,
        value: 12500,
        rawFlags: ItemFlag.IDENTIFIED,
        flags: { identified: true },
        version: 0x65,
        code: 'crs ',
        uniqueId: 0x98765432,
        ilvl: 45,
        quality: ItemQuality.RARE,
        rarity: 'rare',
        rareName1: 18,
        rareName2: 42,
        rareAffixes,
        durability: 35,
        maxDurability: 35,
      }

      expect(rareItem.quality).toBe(ItemQuality.RARE)
      expect(rareItem.rareName1).toBe(18)
      expect(rareItem.rareName2).toBe(42)
      expect(rareItem.rareAffixes?.length).toBe(6)
      expect(rareItem.rareAffixes?.[0]?.present).toBe(true)
      expect(rareItem.rareAffixes?.[0]?.id).toBe(105)
      expect(rareItem.rareAffixes?.[3]?.present).toBe(false)
      expect(rareItem.rareAffixes?.[3]?.id).toBeUndefined()
    })

    it('populates Set Item with setId and setBonuses stat list blocks', () => {
      const setItem: Item = {
        base: swordBase,
        prefix: null,
        suffix: null,
        level: 15,
        name: "Civerb's Cudgel",
        stats: { damage: 25 },
        invWidth: 2,
        invHeight: 3,
        stack: 1,
        value: 4000,
        rawFlags: ItemFlag.IDENTIFIED,
        flags: { identified: true },
        version: 0x65,
        code: 'crs ',
        uniqueId: 0x55aa55aa,
        ilvl: 20,
        quality: ItemQuality.SET,
        rarity: 'set',
        setId: 12,
        setBonuses: [
          [{ statId: 21, statName: 'tohit', value: 100 }],
          [{ statId: 17, statName: 'maxdamage', value: 23 }],
        ],
      }

      expect(setItem.quality).toBe(ItemQuality.SET)
      expect(setItem.setId).toBe(12)
      expect(setItem.setBonuses?.length).toBe(2)
      expect(setItem.setBonuses?.[0]?.[0]?.value).toBe(100)
    })

    it('populates Unique Item with uniqueId and graphic variant', () => {
      const uniqueItem: Item = {
        base: swordBase,
        prefix: null,
        suffix: null,
        level: 85,
        name: 'The Grandfather',
        stats: { damage: 180 },
        invWidth: 2,
        invHeight: 3,
        stack: 1,
        value: 50000,
        rawFlags: ItemFlag.IDENTIFIED | ItemFlag.ETHEREAL,
        flags: { identified: true, ethereal: true },
        version: 0x65,
        code: '7gd ',
        uniqueId: 254,
        ilvl: 85,
        quality: ItemQuality.UNIQUE,
        rarity: 'unique',
        hasGraphic: true,
        graphic: 2,
      }

      expect(uniqueItem.quality).toBe(ItemQuality.UNIQUE)
      expect(uniqueItem.uniqueId).toBe(254)
      expect(uniqueItem.hasGraphic).toBe(true)
      expect(uniqueItem.graphic).toBe(2)
      expect(uniqueItem.flags?.ethereal).toBe(true)
    })

    it('populates Runeword Item with 12-bit runewordId, param, and runewordStats', () => {
      const runewordData: ItemRunewordData = {
        id: 48,
        param: 5,
      }
      const runewordStats: ItemStatEntry[] = [
        { statId: 105, statName: 'fastercastrate', value: 35 },
        { statId: 21, statName: 'tohit', value: 250 },
      ]
      const runewordItem: Item = {
        base: swordBase,
        prefix: null,
        suffix: null,
        level: 54,
        name: 'Spirit Crystal Sword',
        stats: { fastercastrate: 35 },
        invWidth: 2,
        invHeight: 3,
        stack: 1,
        value: 15000,
        rawFlags: ItemFlag.IDENTIFIED | ItemFlag.SOCKETED | ItemFlag.RUNEWORD,
        flags: { identified: true, socketed: true, runeword: true },
        version: 0x65,
        code: 'crs ',
        uniqueId: 0x11223344,
        ilvl: 54,
        quality: ItemQuality.NORMAL,
        totalSockets: 4,
        socketedCount: 4,
        runeword: runewordData,
        runewordStats,
      }

      expect(runewordItem.flags?.runeword).toBe(true)
      expect(runewordItem.runeword?.id).toBe(48)
      expect(runewordItem.runeword?.param).toBe(5)
      expect(runewordItem.totalSockets).toBe(4)
      expect(runewordItem.runewordStats?.length).toBe(2)
    })

    it('populates Personalized and AutoAffix fields', () => {
      const personalizedItem: Item = {
        base: swordBase,
        prefix: null,
        suffix: null,
        level: 70,
        name: "Anya's Crystal Sword",
        stats: {},
        invWidth: 2,
        invHeight: 3,
        stack: 1,
        value: 5000,
        rawFlags: ItemFlag.IDENTIFIED | ItemFlag.PERSONALIZED,
        flags: { identified: true, personalized: true },
        version: 0x65,
        code: 'crs ',
        uniqueId: 0xaabbccdd,
        ilvl: 70,
        quality: ItemQuality.NORMAL,
        personalizedName: 'Anya',
        hasAutoAffix: true,
        autoAffixId: 302,
      }

      expect(personalizedItem.flags?.personalized).toBe(true)
      expect(personalizedItem.personalizedName).toBe('Anya')
      expect(personalizedItem.hasAutoAffix).toBe(true)
      expect(personalizedItem.autoAffixId).toBe(302)
    })

    it('populates Player Ear item with EarData (classIndex, level, name)', () => {
      const earData: ItemEarData = {
        classIndex: 1, // Sorceress
        level: 88,
        name: 'DarkSorceress',
      }
      const earItem: Item = {
        base: {
          id: 'ear',
          name: "Sorceress's Ear",
          kind: 'misc',
          invWidth: 1,
          invHeight: 1,
          maxStack: 1,
          value: 0,
          damage: 0,
          defense: 0,
          tags: ['ear'],
          level: 1,
        },
        prefix: null,
        suffix: null,
        level: 88,
        name: "DarkSorceress's Ear",
        stats: {},
        invWidth: 1,
        invHeight: 1,
        stack: 1,
        value: 0,
        rawFlags: ItemFlag.IDENTIFIED | ItemFlag.IS_EAR,
        flags: { identified: true, isEar: true },
        version: 0x65,
        code: 'ear ',
        earData,
      }

      expect(earItem.flags?.isEar).toBe(true)
      expect(earItem.code).toBe('ear ')
      expect(earItem.earData?.classIndex).toBe(1)
      expect(earItem.earData?.level).toBe(88)
      expect(earItem.earData?.name).toBe('DarkSorceress')
    })

    it('populates Armor defense and Durability fields', () => {
      const armorBase: ItemBase = {
        id: 'qui',
        name: 'Quilted Armor',
        kind: 'armor',
        invWidth: 2,
        invHeight: 3,
        maxStack: 1,
        value: 50,
        damage: 0,
        defense: 10,
        tags: ['armo'],
        level: 1,
      }
      const armorItem: Item = {
        base: armorBase,
        prefix: null,
        suffix: null,
        level: 5,
        name: 'Quilted Armor',
        stats: { defense: 11 },
        invWidth: 2,
        invHeight: 3,
        stack: 1,
        value: 50,
        rawFlags: ItemFlag.IDENTIFIED,
        flags: { identified: true },
        version: 0x65,
        code: 'qui ',
        defense: 11,
        durability: 20,
        maxDurability: 20,
      }

      expect(armorItem.defense).toBe(11)
      expect(armorItem.durability).toBe(20)
      expect(armorItem.maxDurability).toBe(20)
    })

    it('preserves unknown/unparsed bits for lossless round-trip', () => {
      const rawUnknownBits = new Uint8Array([0xfe, 0xca, 0x00, 0x12])
      const roundTripItem: Item = {
        base: swordBase,
        prefix: null,
        suffix: null,
        level: 30,
        name: 'Crystal Sword',
        stats: {},
        invWidth: 2,
        invHeight: 3,
        stack: 1,
        value: 1000,
        rawFlags: 0x00010809, // custom server bits + identified + socketed + runeword
        flags: { identified: true, socketed: true, runeword: true },
        version: 0x65,
        code: 'crs ',
        unknownBits: rawUnknownBits,
      }

      expect(roundTripItem.rawFlags).toBe(0x00010809)
      expect(roundTripItem.unknownBits).toEqual(rawUnknownBits)
    })
  })

  describe('Backward Compatibility with Gameplay & Inventory Systems', () => {
    it('createItem populates backward-compatible and bit-aligned fields', () => {
      const rng = new Rng(12345)
      const base: ItemBase = {
        id: 'swd',
        name: 'Short Sword',
        kind: 'weapon',
        invWidth: 1,
        invHeight: 3,
        maxStack: 1,
        value: 30,
        damage: 5,
        defense: 0,
        tags: ['weap'],
        level: 1,
      }
      const item = createItem(base, [], [], rng, { level: 5 })

      // Original fields:
      expect(item.base.id).toBe('swd')
      expect(item.level).toBe(5)
      expect(item.name).toBe('Short Sword')
      expect(item.invWidth).toBe(1)
      expect(item.invHeight).toBe(3)
      expect(item.stack).toBe(1)
      expect(item.value).toBe(30)
      expect(item.stats.damage).toBe(5)

      // Bitstream-aligned fields:
      expect(item.code).toBe('swd ')
      expect(item.ilvl).toBe(5)
      expect(item.quality).toBe(ItemQuality.NORMAL)
      expect(item.rarity).toBe('normal')
      expect(item.version).toBe(0x65)
      expect(item.rawFlags! & ItemFlag.IDENTIFIED).toBeTruthy()
      expect(item.quantity).toBe(1)
    })

    it('Inventory correctly adds, stacks, and updates quantity and stack', () => {
      const inv = new Inventory(10, 4)
      const potionBase: ItemBase = {
        id: 'hp1',
        name: 'Minor Healing Potion',
        kind: 'misc',
        invWidth: 1,
        invHeight: 1,
        maxStack: 5,
        value: 20,
        damage: 0,
        defense: 0,
        tags: ['misc'],
        level: 1,
      }
      const potion1: Item = {
        base: potionBase,
        prefix: null,
        suffix: null,
        level: 1,
        name: 'Minor Healing Potion',
        stats: {},
        invWidth: 1,
        invHeight: 1,
        stack: 2,
        value: 20,
        quantity: 2,
      }
      const potion2: Item = {
        ...potion1,
        stack: 2,
        quantity: 2,
      }

      const p1 = inv.add(potion1)
      expect(p1).not.toBeNull()
      expect(p1?.item.stack).toBe(2)

      const p2 = inv.add(potion2)
      expect(p2).not.toBeNull()
      expect(p2?.item.stack).toBe(4)
      expect(p2?.item.quantity).toBe(4)
      expect(inv.contents.length).toBe(1)
    })
  })
})
