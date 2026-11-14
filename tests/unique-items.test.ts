import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import type { D2Table } from '../src/common/world/acts.ts'
import { parseTable } from '../src/common/world/acts.ts'
import {
  parseUniqueItemsTable,
  loadUniqueItems,
  parsePar,
  parseNumber,
  UNIQUE_ITEMS_TABLE_PATH,
  CaseInsensitiveMap,
  type UniqueItemsTable,
  type UniqueItem,
} from '../src/common/items/unique-items.ts'

const hasD2 = fs.existsSync('samples/d2/d2exp.mpq')

describe('UniqueItems Table Loader (Issue #97)', () => {
  describe('Helper functions: parsePar and parseNumber', () => {
    it('parses empty and whitespace strings as undefined in parsePar', () => {
      expect(parsePar('')).toBeUndefined()
      expect(parsePar('   ')).toBeUndefined()
      expect(parsePar('\t')).toBeUndefined()
    })

    it('parses numeric strings as numbers in parsePar', () => {
      expect(parsePar('74')).toBe(74)
      expect(parsePar('0')).toBe(0)
      expect(parsePar('-5')).toBe(-5)
      expect(parsePar('103')).toBe(103)
      expect(typeof parsePar('74')).toBe('number')
    })

    it('preserves skill and property names as strings in parsePar', () => {
      expect(parsePar('Oak Sage')).toBe('Oak Sage')
      expect(parsePar('Sanctuary')).toBe('Sanctuary')
      expect(parsePar('Nova')).toBe('Nova')
      expect(parsePar('Enchant')).toBe('Enchant')
      expect(typeof parsePar('Oak Sage')).toBe('string')
    })

    it('parses numbers with fallback in parseNumber', () => {
      expect(parseNumber('')).toBe(0)
      expect(parseNumber('', 42)).toBe(42)
      expect(parseNumber('100')).toBe(100)
      expect(parseNumber('-15')).toBe(-15)
      expect(parseNumber('invalid', 99)).toBe(99)
    })
  })

  describe('CaseInsensitiveMap', () => {
    it('supports case-insensitive lookups while preserving original keys', () => {
      const map = new CaseInsensitiveMap<number>()
      map.set('The Gnasher', 1)
      expect(map.get('The Gnasher')).toBe(1)
      expect(map.get('the gnasher')).toBe(1)
      expect(map.get('THE GNASHER')).toBe(1)
      expect(map.has('the gnasher')).toBe(true)
      expect(map.has('other')).toBe(false)
      expect(Array.from(map.keys())).toEqual(['The Gnasher'])
    })

    it('handles delete and clear properly', () => {
      const map = new CaseInsensitiveMap<string>()
      map.set('rin', 'ring')
      expect(map.has('RIN')).toBe(true)
      expect(map.delete('Rin')).toBe(true)
      expect(map.has('rin')).toBe(false)

      map.set('amu', 'amulet')
      map.clear()
      expect(map.has('amu')).toBe(false)
    })
  })

  describe('Synthetic parseUniqueItemsTable tests', () => {
    const header = [
      'index', 'version', 'enabled', 'ladder', 'rarity', 'nolimit', 'lvl', 'lvl req',
      'code', '*type', '*uber', 'carry1', 'cost mult', 'cost add', 'chrtransform', 'invtransform',
      'flippyfile', 'invfile', 'dropsound', 'dropsfxframe', 'usesound',
      'prop1', 'par1', 'min1', 'max1',
      'prop2', 'par2', 'min2', 'max2',
      '*eol',
    ]

    it('filters empty index and Expansion rows', () => {
      const rawTable: D2Table = {
        header,
        rows: [
          ['The Gnasher', '0', '1', '', '1', '', '7', '5', 'hax', 'Hand Axe', '', '', '5', '5000', 'dyel', '', '', 'invhaxu', '', '', '', 'str', '', '8', '8', '', '', '', '', '0'],
          ['Expansion', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0'],
          ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0'],
          ['Nagelring', '0', '1', '', '15', '', '10', '7', 'rin', 'ring', '', '', '5', '5000', '', '', '', '', '', '', '', 'mag%', '', '15', '30', 'att', '', '50', '75', '0'],
          ['Constricting Ring', '100', '0', '', '1', '', '95', '95', 'rin', 'ring', '', '', '5', '5000', '', '', '', '', '', '', '', 'res-all', '', '100', '100', '', '', '', '', '0'],
        ],
      }

      const table = parseUniqueItemsTable(rawTable)
      expect(table.all.length).toBe(3)
      expect(table.all[0]?.index).toBe('The Gnasher')
      expect(table.all[0]?.id).toBe(0)
      expect(table.all[1]?.index).toBe('Nagelring')
      expect(table.all[1]?.id).toBe(1)
      expect(table.all[2]?.index).toBe('Constricting Ring')
      expect(table.all[2]?.id).toBe(2)
      expect(table.all[2]?.enabled).toBe(false)

      const rings = table.byCode.get('rin')
      expect(rings?.length).toBe(2)
      const enabledRings = table.getEnabledByCode('rin')
      expect(enabledRings.length).toBe(1)
      expect(enabledRings[0]?.index).toBe('Nagelring')
    })
  })

  describe.skipIf(!hasD2)('1.13c MPQ Integration Tests (UniqueItems.txt)', () => {
    let archives: MountedArchives
    let rawTable: D2Table
    let table: UniqueItemsTable

    beforeAll(async () => {
      archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      const bytes = await archives.read(UNIQUE_ITEMS_TABLE_PATH)
      rawTable = parseTable(bytes)
      table = parseUniqueItemsTable(rawTable)
    })

    it('verifies archive path constant', () => {
      expect(UNIQUE_ITEMS_TABLE_PATH).toBe('data\\global\\excel\\UniqueItems.txt')
    })

    it('loads via loadUniqueItems with mounted archives', async () => {
      const loaded = await loadUniqueItems(archives)
      expect(loaded.all.length).toBe(401)
      expect(loaded.length).toBe(401)
      expect(loaded.byIndex.size).toBe(393)
    })

    it('parses exactly 401 real data rows from 403 raw lines', () => {
      expect(rawTable.rows.length).toBe(403)
      expect(table.all.length).toBe(401)
      expect(table.length).toBe(401)

      // Verifies row id 0..400
      for (let i = 0; i < table.all.length; i++) {
        expect(table.all[i]?.id).toBe(i)
        expect(table.getById(i)?.id).toBe(i)
      }
      expect(table.all[0]?.index).toBe('The Gnasher')
      expect(table.all[400]?.index).toBe('Hellfire Torch')
    })

    it('verifies exactly 385 enabled and 16 disabled unique items', () => {
      const enabledItems = table.all.filter(i => i.enabled)
      const disabledItems = table.all.filter(i => !i.enabled)

      expect(enabledItems.length).toBe(385)
      expect(disabledItems.length).toBe(16)

      const disabledIndices = disabledItems.map(i => i.index)
      expect(disabledIndices).toContain('Armor')
      expect(disabledIndices).toContain('Elite Uniques')
      expect(disabledIndices).toContain('Constricting Ring')
      expect(disabledIndices).toContain('Rings')
      expect(disabledIndices).toContain('Class Specific')
      expect(disabledIndices).toContain('Gore Ripper')
      expect(disabledIndices).toContain("Zakarum's Salvation")
      expect(disabledIndices).toContain('Odium')
      expect(disabledIndices).toContain("Larzuk's Champion")
      expect(disabledIndices).toContain('Giantmaimer')
      expect(disabledIndices).toContain('Darkfear')
      expect(disabledIndices).toContain('Nethercrow')
      expect(disabledIndices).toContain("Warriv's Warder")
      expect(disabledIndices).toContain("Merman's Speed")
      expect(disabledIndices).toContain("Sigurd's Staunch")
      // Classic Azurewrath (id 29) is disabled
      expect(table.all[29]?.index).toBe('Azurewrath')
      expect(table.all[29]?.enabled).toBe(false)
      expect(table.all[29]?.code).toBe('crs')
    })

    it('sample check: The Gnasher (code=hax, lvl=7, 4 props: str, openwounds, crush, dmg%)', () => {
      const gnasher = table.byIndex.get('The Gnasher')
      expect(gnasher).toBeDefined()
      expect(gnasher?.id).toBe(0)
      expect(gnasher?.index).toBe('The Gnasher')
      expect(gnasher?.code).toBe('hax')
      expect(gnasher?.lvl).toBe(7)
      expect(gnasher?.levelreq).toBe(5)
      expect(gnasher?.version).toBe(0)
      expect(gnasher?.enabled).toBe(true)
      expect(gnasher?.ladder).toBe(false)
      expect(gnasher?.rarity).toBe(1)
      expect(gnasher?.nolimit).toBe(false)
      expect(gnasher?.carry1).toBe(false)
      expect(gnasher?.costMult).toBe(5)
      expect(gnasher?.costAdd).toBe(5000)
      expect(gnasher?.chrtransform).toBe('dyel')
      expect(gnasher?.invfile).toBe('invhaxu')
      expect(gnasher?.invtransform).toBeUndefined()

      expect(gnasher?.props.length).toBe(4)
      expect(gnasher?.props[0]).toEqual({ code: 'str', min: 8, max: 8 })
      expect(gnasher?.props[1]).toEqual({ code: 'openwounds', min: 50, max: 50 })
      expect(gnasher?.props[2]).toEqual({ code: 'crush', min: 20, max: 20 })
      expect(gnasher?.props[3]).toEqual({ code: 'dmg%', min: 60, max: 70 })
    })

    it('verifies string parameter par: Nature\'s Peace with Oak Sage', () => {
      const peace = table.byIndex.get("Nature's Peace")
      expect(peace).toBeDefined()
      expect(peace?.code).toBe('rin')
      expect(peace?.lvl).toBe(77)
      expect(peace?.levelreq).toBe(69)
      expect(peace?.ladder).toBe(true)
      expect(peace?.version).toBe(100)
      expect(peace?.enabled).toBe(true)
      expect(peace?.chrtransform).toBe('dgrn')
      expect(peace?.invtransform).toBe('dgrn')

      const chargedProp = peace?.props.find(p => p.code === 'charged')
      expect(chargedProp).toBeDefined()
      expect(chargedProp?.par).toBe('Oak Sage')
      expect(typeof chargedProp?.par).toBe('string')
      expect(chargedProp?.min).toBe(27)
      expect(chargedProp?.max).toBe(5)

      // Other properties on Nature's Peace
      expect(peace?.props.find(p => p.code === 'noheal')).toEqual({ code: 'noheal', min: 1, max: 1 })
      expect(peace?.props.find(p => p.code === 'rip')).toEqual({ code: 'rip', min: 1, max: 1 })
      expect(peace?.props.find(p => p.code === 'red-dmg')).toEqual({ code: 'red-dmg', min: 7, max: 11 })
      expect(peace?.props.find(p => p.code === 'res-pois')).toEqual({ code: 'res-pois', min: 20, max: 30 })
    })

    it('verifies numeric parameter par in items like Maelstromwrath', () => {
      const maelstrom = table.byIndex.get('Maelstromwrath')
      expect(maelstrom).toBeDefined()
      expect(maelstrom?.code).toBe('ywn')

      const skillProps = maelstrom?.props.filter(p => p.code === 'skill')
      expect(skillProps?.length).toBe(4)
      expect(skillProps?.[0]?.par).toBe(74)
      expect(typeof skillProps?.[0]?.par).toBe('number')
      expect(skillProps?.[1]?.par).toBe(77)
      expect(skillProps?.[2]?.par).toBe(66)
      expect(skillProps?.[3]?.par).toBe(76)
    })

    it('verifies multi-value index code -> UniqueItem[] for rings and amulets', () => {
      // Rings
      const rings = table.byCode.get('rin')
      expect(rings).toBeDefined()
      expect(rings?.length).toBe(10)
      const ringNames = rings?.map(r => r.index)
      expect(ringNames).toEqual([
        'Nagelring',
        'Manald Heal',
        'The Stone of Jordan',
        'Constricting Ring',
        "Bul Katho's Wedding Band",
        'Dwarf Star',
        'Raven Frost',
        "Nature's Peace",
        'Wisp',
        'Carrion Wind',
      ])

      // Exactly 9 enabled rings (Constricting Ring is disabled)
      const enabledRings = table.getEnabledByCode('rin')
      expect(enabledRings.length).toBe(9)
      expect(enabledRings.some(r => r.index === 'Constricting Ring')).toBe(false)
      expect(enabledRings.every(r => r.enabled)).toBe(true)

      // Amulets: exactly 12 unique amulets, all enabled
      const amulets = table.byCode.get('amu')
      expect(amulets).toBeDefined()
      expect(amulets?.length).toBe(12)
      const enabledAmulets = table.getEnabledByCode('amu')
      expect(enabledAmulets.length).toBe(12)

      // Rainbow Facets (jew)
      const facets = table.byCode.get('jew')
      expect(facets?.length).toBe(8)
      expect(table.getEnabledByCode('jew').length).toBe(8)

      // Hand axe (hax)
      const hax = table.byCode.get('hax')
      expect(hax?.length).toBe(1)
      expect(hax?.[0]?.index).toBe('The Gnasher')

      // Case-insensitivity
      expect(table.byCode.get('RIN')?.length).toBe(10)
      expect(table.getEnabledByCode('RIN').length).toBe(9)
      expect(table.getEnabledByCode('unknown_code')).toEqual([])
    })

    it('verifies primary key lookup and duplicate resolution', () => {
      // Direct get and byIndex.get
      expect(table.get('The Gnasher')?.index).toBe('The Gnasher')
      expect(table.byIndex.get('the gnasher')?.index).toBe('The Gnasher')
      expect(table.byIndex.get('THE GNASHER')?.index).toBe('The Gnasher')

      // Azurewrath duplicate: enabled Phase Blade (id 301) takes precedence over disabled Crystal Sword (id 29)
      const azurewrath = table.byIndex.get('Azurewrath')
      expect(azurewrath).toBeDefined()
      expect(azurewrath?.enabled).toBe(true)
      expect(azurewrath?.code).toBe('7cr')
      expect(azurewrath?.lvl).toBe(87)
      expect(azurewrath?.id).toBe(301)
    })

    it('verifies carry1 items (Annihilus, Gheed\'s Fortune, Hellfire Torch)', () => {
      const carry1Items = table.all.filter(i => i.carry1)
      expect(carry1Items.length).toBe(3)
      const carry1Names = carry1Items.map(i => i.index).sort()
      expect(carry1Names).toEqual(['Annihilus', "Gheed's Fortune", 'Hellfire Torch'].sort())
    })

    it('verifies negative stats such as Gull dagger penalties', () => {
      const gull = table.byIndex.get('Gull')
      expect(gull).toBeDefined()
      expect(gull?.code).toBe('dgr')
      const manaProp = gull?.props.find(p => p.code === 'mana')
      expect(manaProp).toEqual({ code: 'mana', min: -5, max: -5 })
      const mfProp = gull?.props.find(p => p.code === 'mag%')
      expect(mfProp).toEqual({ code: 'mag%', min: 100, max: 100 })
    })

    it('supports iterable for..of loop across all items', () => {
      let count = 0
      for (const item of table) {
        expect(item.index).toBeTruthy()
        expect(item.id).toBe(count)
        count++
      }
      expect(count).toBe(401)
    })
  })
})
