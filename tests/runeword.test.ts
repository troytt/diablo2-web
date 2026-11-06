import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import {
  parseRunesTable,
  loadRunewords,
  checkRunewordMatch,
  getRunewordDisplayName,
  normalizeRuneCode,
  parseSocketedRunes,
  isNormalQuality,
  getBaseItemSocketCount,
  getItemTypeCodes,
  CANONICAL_RUNES_TABLE,
  RUNES_TABLE_PATH,
  RUNE_NAME_TO_CODE,
  RUNE_CODE_TO_NAME,
  type RunewordTable,
  type RunewordDefinition,
  type RunewordMatchResult,
} from '../src/common/items/runeword.ts'
import { parseTable, type D2Table } from '../src/common/world/acts.ts'
import { ItemQuality, type Item, type ItemBase } from '../src/common/items/items.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { decodeTbl } from '../src/common/formats/tbl.ts'

const hasD2 = fs.existsSync('samples/d2/d2exp.mpq')

describe('Runes.txt Loading and Runeword Assembly (Issue #105)', () => {
  const shieldBase: ItemBase = {
    id: 'kit',
    name: 'Kite Shield',
    kind: 'armor',
    invWidth: 2,
    invHeight: 3,
    maxStack: 1,
    value: 100,
    damage: 0,
    defense: 18,
    tags: ['shld'],
    level: 15,
  }

  const swordBase: ItemBase = {
    id: 'crs',
    name: 'Crystal Sword',
    kind: 'weapon',
    invWidth: 2,
    invHeight: 3,
    maxStack: 1,
    value: 250,
    damage: 15,
    defense: 0,
    tags: ['swor', 'weap'],
    level: 11,
  }

  const armorBase: ItemBase = {
    id: 'fld',
    name: 'Field Plate',
    kind: 'armor',
    invWidth: 2,
    invHeight: 3,
    maxStack: 1,
    value: 400,
    damage: 0,
    defense: 105,
    tags: ['tors', 'armo'],
    level: 15,
  }

  function createTestShield(totalSockets = 3, quality = ItemQuality.NORMAL, extra: Partial<Item> = {}): Item {
    return {
      base: shieldBase,
      prefix: null,
      suffix: null,
      level: 25,
      name: 'Kite Shield',
      stats: {},
      invWidth: 2,
      invHeight: 3,
      stack: 1,
      value: 100,
      totalSockets,
      quality,
      ...extra,
    }
  }

  describe('Table Parsing & Counts (1.13c Gold Standard)', () => {
    it('parses exactly 169 rows, 78 complete runewords, and 23 ladder runewords from canonical data', () => {
      const table = CANONICAL_RUNES_TABLE
      expect(table.all.length).toBe(169)
      expect(table.rows.length).toBe(169)
      expect(table.length).toBe(169)

      expect(table.complete.length).toBe(78)
      expect(table.ladder.length).toBe(23)

      // All ladder runewords should be in the complete list
      for (const ladderItem of table.ladder) {
        expect(ladderItem.server).toBe(true)
        expect(ladderItem.ladder).toBe(true)
        expect(ladderItem.complete).toBe(true)
        expect(ladderItem.enabled).toBe(true)
      }

      // 55 non-ladder complete runewords (78 - 23)
      const nonLadderComplete = table.complete.filter(r => !r.server)
      expect(nonLadderComplete.length).toBe(55)
    })

    it('parses row 0 Ancient\'s Pledge properly', () => {
      const ap = CANONICAL_RUNES_TABLE.get('Runeword1')
      expect(ap).toBeDefined()
      expect(ap?.name).toBe('Runeword1')
      expect(ap?.runeName).toBe("Ancient's Pledge")
      expect(ap?.complete).toBe(true)
      expect(ap?.server).toBe(false)
      expect(ap?.runewordId).toBe(1)
      expect(ap?.itypes).toEqual(['shld'])
      expect(ap?.etypes).toEqual([])
      expect(ap?.runes).toEqual(['r08', 'r09', 'r07']) // Ral, Ort, Tal

      expect(ap?.t1Codes.length).toBe(4)
      expect(ap?.t1Codes[0]).toEqual({ code: 'res-cold', min: 30, max: 30 })
      expect(ap?.t1Codes[1]).toEqual({ code: 'res-all', min: 13, max: 13 })
      expect(ap?.t1Codes[2]).toEqual({ code: 'ac%', min: 50, max: 50 })
      expect(ap?.t1Codes[3]).toEqual({ code: 'dmg-to-mana', min: 10, max: 10 })

      expect(ap?.stats['res-cold']).toBe(30)
      expect(ap?.stats['res-all']).toBe(13)
      expect(ap?.stats['ac%']).toBe(50)
      expect(ap?.stats['dmg-to-mana']).toBe(10)
    })

    it('parses ladder runeword Spirit (Runeword130, row 49)', () => {
      const spirit = CANONICAL_RUNES_TABLE.get("Spirit")
      expect(spirit).toBeDefined()
      expect(spirit?.name).toBe('Runeword130')
      expect(spirit?.server).toBe(true)
      expect(spirit?.ladder).toBe(true)
      expect(spirit?.complete).toBe(true)
      expect(spirit?.itypes).toEqual(['swor', 'shld'])
      expect(spirit?.runes).toEqual(['r07', 'r10', 'r09', 'r11']) // Tal, Thul, Ort, Amn
    })

    it('parses non-empty params in modifiers (e.g. charged skill on Black / Runeword6)', () => {
      const black = CANONICAL_RUNES_TABLE.get('Black')
      expect(black).toBeDefined()
      expect(black?.name).toBe('Runeword6')
      const chargedProp = black?.t1Codes.find(p => p.code === 'charged')
      expect(chargedProp).toBeDefined()
      expect(chargedProp?.param).toBe('74')
      expect(chargedProp?.min).toBe(12)
      expect(chargedProp?.max).toBe(4)
    })
  })

  describe('Rune Normalization and Parsing Helpers', () => {
    it('normalizes rune names and codes to standard r01..r33 codes', () => {
      expect(normalizeRuneCode('Ral')).toBe('r08')
      expect(normalizeRuneCode('ral')).toBe('r08')
      expect(normalizeRuneCode('Ral Rune')).toBe('r08')
      expect(normalizeRuneCode('r08')).toBe('r08')
      expect(normalizeRuneCode('Ort')).toBe('r09')
      expect(normalizeRuneCode('ort')).toBe('r09')
      expect(normalizeRuneCode('Tal')).toBe('r07')
      expect(normalizeRuneCode('tal')).toBe('r07')
      expect(normalizeRuneCode('Zod')).toBe('r33')
      expect(normalizeRuneCode('El')).toBe('r01')
      expect(normalizeRuneCode('r1')).toBe('r01')
    })

    it('parses arrays and concatenated rune strings like RalOrtTal', () => {
      expect(parseSocketedRunes(['Ral', 'Ort', 'Tal'])).toEqual(['Ral', 'Ort', 'Tal'])
      expect(parseSocketedRunes(['r08', 'r09', 'r07'])).toEqual(['r08', 'r09', 'r07'])
      expect(parseSocketedRunes('RalOrtTal')).toEqual(['Ral', 'Ort', 'Tal'])
      expect(parseSocketedRunes(['RalOrtTal'])).toEqual(['Ral', 'Ort', 'Tal'])
      expect(parseSocketedRunes('TalThulOrtAmn')).toEqual(['Tal', 'Thul', 'Ort', 'Amn'])
      expect(parseSocketedRunes('JahIthBer')).toEqual(['Jah', 'Ith', 'Ber'])
    })

    it('verifies RUNE_NAME_TO_CODE and RUNE_CODE_TO_NAME tables', () => {
      expect(Object.keys(RUNE_NAME_TO_CODE).length).toBe(33)
      expect(Object.keys(RUNE_CODE_TO_NAME).length).toBe(33)
      expect(RUNE_NAME_TO_CODE['ber']).toBe('r30')
      expect(RUNE_CODE_TO_NAME['r30']).toBe('Ber')
    })
  })

  describe('Quality and Socket Extraction Helpers', () => {
    it('identifies normal, superior, and low quality items as valid', () => {
      const normalItem = createTestShield(3, ItemQuality.NORMAL)
      const superiorItem = createTestShield(3, ItemQuality.SUPERIOR)
      const lowItem = createTestShield(3, ItemQuality.LOW)
      expect(isNormalQuality(normalItem)).toBe(true)
      expect(isNormalQuality(superiorItem)).toBe(true)
      expect(isNormalQuality(lowItem)).toBe(true)
    })

    it('rejects magic, rare, set, unique, crafted, and tempered items', () => {
      expect(isNormalQuality(createTestShield(3, ItemQuality.MAGIC))).toBe(false)
      expect(isNormalQuality(createTestShield(3, ItemQuality.RARE))).toBe(false)
      expect(isNormalQuality(createTestShield(3, ItemQuality.SET))).toBe(false)
      expect(isNormalQuality(createTestShield(3, ItemQuality.UNIQUE))).toBe(false)
      expect(isNormalQuality(createTestShield(3, ItemQuality.CRAFTED))).toBe(false)
      expect(isNormalQuality(createTestShield(3, ItemQuality.TEMPERED))).toBe(false)

      const affixItem = createTestShield(3, ItemQuality.NORMAL, {
        prefix: { id: 'test', name: 'Sturdy', kind: 'prefix', level: 1, itemTypes: [], modifiers: [] },
      })
      expect(isNormalQuality(affixItem)).toBe(false)

      const rarityItem = createTestShield(3, undefined, { rarity: 'magic' })
      expect(isNormalQuality(rarityItem)).toBe(false)
    })

    it('extracts socket count from various item representations', () => {
      expect(getBaseItemSocketCount({ ...shieldBase, totalSockets: 3 } as any)).toBe(3)
      expect(getBaseItemSocketCount({ ...shieldBase, sockets: 4 } as any)).toBe(4)
      expect(getBaseItemSocketCount({ ...shieldBase, stats: { sockets: 2 } } as any)).toBe(2)
      expect(getBaseItemSocketCount({ base: { ...shieldBase, totalSockets: 5 } } as any)).toBe(5)
      expect(getBaseItemSocketCount(createTestShield(3))).toBe(3)
    })

    it('extracts item type codes from item and base tags', () => {
      const shield = createTestShield(3)
      const codes = getItemTypeCodes(shield)
      expect(codes).toContain('shld')
      expect(codes).toContain('kit')
      expect(codes).toContain('armo')
    })
  })

  describe('Runeword Assembly: checkRunewordMatch', () => {
    const isAIdentity = (type: string, target: string) => type.toLowerCase() === target.toLowerCase()

    it('valid assembly: Ancient\'s Pledge (RalOrtTal in 3-socket shield)', () => {
      const shield = createTestShield(3, ItemQuality.NORMAL)
      const runes = ['Ral', 'Ort', 'Tal']

      const match = checkRunewordMatch(shield, runes, isAIdentity, CANONICAL_RUNES_TABLE)
      expect(match).toBeDefined()
      expect(match?.name).toBe('Runeword1')
      expect(match?.runeName).toBe("Ancient's Pledge")
      expect(match?.runewordId).toBe(1)
      expect(match?.complete).toBe(true)
      expect(match?.server).toBe(false)
      expect(match?.runes).toEqual(['r08', 'r09', 'r07'])

      // Aggregated stats from T1Code1..4
      expect(match?.stats['res-cold']).toBe(30)
      expect(match?.stats['res-all']).toBe(13)
      expect(match?.stats['ac%']).toBe(50)
      expect(match?.stats['dmg-to-mana']).toBe(10)
    })

    it('valid assembly with item codes (r08, r09, r07)', () => {
      const shield = createTestShield(3, ItemQuality.NORMAL)
      const match = checkRunewordMatch(shield, ['r08', 'r09', 'r07'], isAIdentity, CANONICAL_RUNES_TABLE)
      expect(match).toBeDefined()
      expect(match?.name).toBe('Runeword1')
    })

    it('valid assembly with concatenated string (RalOrtTal)', () => {
      const shield = createTestShield(3, ItemQuality.NORMAL)
      const match = checkRunewordMatch(shield, ['RalOrtTal'], isAIdentity, CANONICAL_RUNES_TABLE)
      expect(match).toBeDefined()
      expect(match?.name).toBe('Runeword1')
    })

    it('socket count mismatch rejects (e.g. 2 runes in 3-socket base)', () => {
      const shield3 = createTestShield(3, ItemQuality.NORMAL)
      // Only 2 runes in 3-socket base
      const matchUnder = checkRunewordMatch(shield3, ['Ral', 'Ort'], isAIdentity, CANONICAL_RUNES_TABLE)
      expect(matchUnder).toBeUndefined()

      // 4 runes in 3-socket base
      const matchOver = checkRunewordMatch(shield3, ['Ral', 'Ort', 'Tal', 'Thul'], isAIdentity, CANONICAL_RUNES_TABLE)
      expect(matchOver).toBeUndefined()

      // 3 runes in 4-socket base
      const shield4 = createTestShield(4, ItemQuality.NORMAL)
      const match4 = checkRunewordMatch(shield4, ['Ral', 'Ort', 'Tal'], isAIdentity, CANONICAL_RUNES_TABLE)
      expect(match4).toBeUndefined()
    })

    it('rune sequence mismatch rejects', () => {
      const shield = createTestShield(3, ItemQuality.NORMAL)
      // Wrong sequence (Tal, Ort, Ral instead of Ral, Ort, Tal)
      const match1 = checkRunewordMatch(shield, ['Tal', 'Ort', 'Ral'], isAIdentity, CANONICAL_RUNES_TABLE)
      expect(match1).toBeUndefined()

      // Wrong sequence (Ral, Tal, Ort)
      const match2 = checkRunewordMatch(shield, ['Ral', 'Tal', 'Ort'], isAIdentity, CANONICAL_RUNES_TABLE)
      expect(match2).toBeUndefined()

      // Completely wrong runes
      const match3 = checkRunewordMatch(shield, ['El', 'Eld', 'Tir'], isAIdentity, CANONICAL_RUNES_TABLE)
      expect(match3).toBeUndefined()
    })

    it('quality mismatch rejects (e.g. magic base with sockets)', () => {
      const magicShield = createTestShield(3, ItemQuality.MAGIC)
      expect(checkRunewordMatch(magicShield, ['Ral', 'Ort', 'Tal'], isAIdentity, CANONICAL_RUNES_TABLE)).toBeUndefined()

      const rareShield = createTestShield(3, ItemQuality.RARE)
      expect(checkRunewordMatch(rareShield, ['Ral', 'Ort', 'Tal'], isAIdentity, CANONICAL_RUNES_TABLE)).toBeUndefined()

      const setShield = createTestShield(3, ItemQuality.SET)
      expect(checkRunewordMatch(setShield, ['Ral', 'Ort', 'Tal'], isAIdentity, CANONICAL_RUNES_TABLE)).toBeUndefined()

      const uniqueShield = createTestShield(3, ItemQuality.UNIQUE)
      expect(checkRunewordMatch(uniqueShield, ['Ral', 'Ort', 'Tal'], isAIdentity, CANONICAL_RUNES_TABLE)).toBeUndefined()

      const craftedShield = createTestShield(3, ItemQuality.CRAFTED)
      expect(checkRunewordMatch(craftedShield, ['Ral', 'Ort', 'Tal'], isAIdentity, CANONICAL_RUNES_TABLE)).toBeUndefined()
    })

    it('item type mismatch rejects (e.g. RalOrtTal in 3-socket sword or armor)', () => {
      const swordItem: Item = {
        base: swordBase,
        prefix: null,
        suffix: null,
        level: 25,
        name: 'Crystal Sword',
        stats: {},
        invWidth: 2,
        invHeight: 3,
        stack: 1,
        value: 250,
        totalSockets: 3,
        quality: ItemQuality.NORMAL,
      }
      expect(checkRunewordMatch(swordItem, ['Ral', 'Ort', 'Tal'], isAIdentity, CANONICAL_RUNES_TABLE)).toBeUndefined()

      const armorItem: Item = {
        base: armorBase,
        prefix: null,
        suffix: null,
        level: 25,
        name: 'Field Plate',
        stats: {},
        invWidth: 2,
        invHeight: 3,
        stack: 1,
        value: 400,
        totalSockets: 3,
        quality: ItemQuality.NORMAL,
      }
      expect(checkRunewordMatch(armorItem, ['Ral', 'Ort', 'Tal'], isAIdentity, CANONICAL_RUNES_TABLE)).toBeUndefined()
    })

    it('item type inheritance via isA allows Paladin shield (pash -> shld)', () => {
      const palaShieldBase: ItemBase = {
        id: 'pa1',
        name: 'Targe',
        kind: 'armor',
        invWidth: 2,
        invHeight: 2,
        maxStack: 1,
        value: 150,
        damage: 0,
        defense: 14,
        tags: ['pash'], // Paladin shield sub-type
        level: 3,
      }
      const palaShield: Item = {
        base: palaShieldBase,
        prefix: null,
        suffix: null,
        level: 20,
        name: 'Targe',
        stats: {},
        invWidth: 2,
        invHeight: 2,
        stack: 1,
        value: 150,
        totalSockets: 3,
        quality: ItemQuality.NORMAL,
      }

      // Without inheritance: fails
      expect(checkRunewordMatch(palaShield, ['Ral', 'Ort', 'Tal'], isAIdentity, CANONICAL_RUNES_TABLE)).toBeUndefined()

      // With isA inheritance: pash is a shld
      const isAWithPala = (type: string, target: string) => {
        if (type === 'pash' && target === 'shld') return true
        return type === target
      }
      const match = checkRunewordMatch(palaShield, ['Ral', 'Ort', 'Tal'], isAWithPala, CANONICAL_RUNES_TABLE)
      expect(match).toBeDefined()
      expect(match?.name).toBe('Runeword1')
    })

    it('handles excluded item types (etypes)', () => {
      // Create a synthetic table with an excluded type
      const rawTable: D2Table = {
        header: [
          'Name', 'Rune Name', 'complete', 'server',
          'itype1', 'itype2', 'itype3', 'itype4', 'itype5', 'itype6',
          'etype1', 'etype2', 'etype3',
          '*runes',
          'Rune1', 'Rune2', 'Rune3', 'Rune4', 'Rune5', 'Rune6',
          'T1Code1', 'T1Param1', 'T1Min1', 'T1Max1',
          'eol',
        ],
        rows: [
          [
            'Runeword999', 'Test Word', '1', '',
            'weap', '', '', '', '', '',
            'swor', '', '',
            '',
            'r01', 'r02', '', '', '', '',
            'dmg%', '', '50', '50',
            '0',
          ],
        ],
      }
      const testTable = parseRunesTable(rawTable)

      const swordItem: Item = {
        base: swordBase,
        prefix: null,
        suffix: null,
        level: 10,
        name: 'Crystal Sword',
        stats: {},
        invWidth: 2,
        invHeight: 3,
        stack: 1,
        value: 200,
        totalSockets: 2,
        quality: ItemQuality.NORMAL,
      }

      // Should be excluded because sword has tag 'swor', matching etype1 'swor'
      expect(checkRunewordMatch(swordItem, ['El', 'Eld'], isAIdentity, testTable)).toBeUndefined()

      // An axe (tags: ['axe', 'weap']) is not excluded
      const axeBase: ItemBase = {
        id: 'hax',
        name: 'Hand Axe',
        kind: 'weapon',
        invWidth: 1,
        invHeight: 3,
        maxStack: 1,
        value: 100,
        damage: 5,
        defense: 0,
        tags: ['axe', 'weap'],
        level: 3,
      }
      const axeItem: Item = {
        base: axeBase,
        prefix: null,
        suffix: null,
        level: 10,
        name: 'Hand Axe',
        stats: {},
        invWidth: 1,
        invHeight: 3,
        stack: 1,
        value: 100,
        totalSockets: 2,
        quality: ItemQuality.NORMAL,
      }
      const matchAxe = checkRunewordMatch(axeItem, ['El', 'Eld'], isAIdentity, testTable)
      expect(matchAxe).toBeDefined()
      expect(matchAxe?.name).toBe('Runeword999')
    })

    it('enforces ladder-only restriction (server === 1)', () => {
      // Spirit (Runeword130, server === 1, TalThulOrtAmn in 4-socket sword)
      const sword4: Item = {
        base: swordBase,
        prefix: null,
        suffix: null,
        level: 30,
        name: 'Crystal Sword',
        stats: {},
        invWidth: 2,
        invHeight: 3,
        stack: 1,
        value: 500,
        totalSockets: 4,
        quality: ItemQuality.NORMAL,
      }
      const spiritRunes = ['Tal', 'Thul', 'Ort', 'Amn']

      // In non-ladder or without options: rejected
      expect(checkRunewordMatch(sword4, spiritRunes, isAIdentity, CANONICAL_RUNES_TABLE)).toBeUndefined()
      expect(checkRunewordMatch(sword4, spiritRunes, isAIdentity, CANONICAL_RUNES_TABLE, { isLadder: false })).toBeUndefined()

      // In ladder mode: accepted
      const match = checkRunewordMatch(sword4, spiritRunes, isAIdentity, CANONICAL_RUNES_TABLE, { isLadder: true })
      expect(match).toBeDefined()
      expect(match?.name).toBe('Runeword130')
      expect(match?.runeName).toBe('Spirit')
      expect(match?.server).toBe(true)
    })
  })

  describe('Display Name Resolution: Name Key to string.tbl Key', () => {
    it('display name uses Name key (Runeword26 -> string.tbl key)', () => {
      const doom = CANONICAL_RUNES_TABLE.get('Runeword26')
      expect(doom).toBeDefined()
      expect(doom?.name).toBe('Runeword26')
      expect(doom?.runewordId).toBe(26)

      // Mock string table representing expansionstring.tbl
      const mockStringTable = new Map<string, string>([
        ['Runeword1', "Ancients' Pledge"],
        ['Runeword26', 'Doom'],
        ['Runeword33', 'Enigma'],
        ['Runeword130', 'Spirit'],
      ])

      expect(getRunewordDisplayName(doom!, mockStringTable)).toBe('Doom')
      expect(getRunewordDisplayName('Runeword26', mockStringTable)).toBe('Doom')

      const ap = CANONICAL_RUNES_TABLE.get('Runeword1')!
      expect(getRunewordDisplayName(ap, mockStringTable)).toBe("Ancients' Pledge")

      // Fallback when string table is not provided
      expect(getRunewordDisplayName(doom!)).toBe('Doomsayer') // fallback to runeName
      expect(getRunewordDisplayName('UnknownKey')).toBe('UnknownKey')
    })
  })

  describe.skipIf(!hasD2)('1.13c MPQ Integration Tests', () => {
    let archives: MountedArchives
    let mpqTable: RunewordTable

    beforeAll(async () => {
      archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      mpqTable = await loadRunewords(archives)
    })

    it('verifies RUNES_TABLE_PATH constant', () => {
      expect(RUNES_TABLE_PATH).toBe('data\\global\\excel\\Runes.txt')
    })

    it('loads exactly 169 rows, 78 complete, and 23 ladder runewords from MPQ', () => {
      expect(mpqTable.all.length).toBe(169)
      expect(mpqTable.complete.length).toBe(78)
      expect(mpqTable.ladder.length).toBe(23)
    })

    it('verifies exact parity between MPQ parsed table and CANONICAL_RUNES_TABLE', () => {
      for (let i = 0; i < mpqTable.all.length; i++) {
        const a = mpqTable.all[i]!
        const b = CANONICAL_RUNES_TABLE.all[i]!
        expect(a.name).toBe(b.name)
        expect(a.runeName).toBe(b.runeName)
        expect(a.complete).toBe(b.complete)
        expect(a.server).toBe(b.server)
        expect(a.runes).toEqual(b.runes)
        expect(a.itypes).toEqual(b.itypes)
        expect(a.etypes).toEqual(b.etypes)
        expect(a.t1Codes).toEqual(b.t1Codes)
        expect(a.stats).toEqual(b.stats)
      }
    })

    it('resolves real expansionstring.tbl display names for Runeword26 and Runeword1', async () => {
      const tblBytes = await archives.read('data\\local\\lng\\eng\\expansionstring.tbl')
      const tbl = decodeTbl(tblBytes)

      const doom = mpqTable.get('Runeword26')!
      expect(getRunewordDisplayName(doom, tbl)).toBe('Doom')

      const ap = mpqTable.get('Runeword1')!
      expect(getRunewordDisplayName(ap, tbl)).toBe("Ancients' Pledge")

      const enigma = mpqTable.get('Runeword33')!
      expect(getRunewordDisplayName(enigma, tbl)).toBe('Enigma')
    })
  })
})
