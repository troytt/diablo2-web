import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import type { D2Table } from '../src/common/world/acts.ts'
import { cell, parseTable } from '../src/common/world/acts.ts'
import {
  parseMiscTable,
  loadMisc,
  MISC_TABLE_PATH,
  type MiscTable,
  type MiscBase,
} from '../src/common/items/misc-items.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

describe('Misc.txt loader & MiscBase mapping (Issue #93)', () => {
  let table: MiscTable
  let rawTable: D2Table | undefined

  beforeAll(async () => {
    if (hasD2) {
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      const bytes = await archives.read(MISC_TABLE_PATH)
      rawTable = parseTable(bytes)
      table = parseMiscTable(rawTable)
    } else {
      rawTable = createMinimalFallbackTable()
      table = parseMiscTable(rawTable)
    }
  })

  it('uses the canonical MPQ table path data\\global\\excel\\Misc.txt', () => {
    expect(MISC_TABLE_PATH).toBe('data\\global\\excel\\Misc.txt')
  })

  it('loads misc items via loadMisc with MountedArchives', async () => {
    if (hasD2) {
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      const loaded = await loadMisc(archives)
      expect(loaded.all.length).toBe(151)
      expect(loaded.byCode.size).toBe(151)
      expect(loaded.get('hp1')?.name).toBe('Lesser Healing Potion')
    }
  })

  it('verifies 152 raw rows in original file - 1 Expansion row = 151 real data rows with 0 duplicate codes', () => {
    if (hasD2 && rawTable) {
      expect(rawTable.rows.length).toBe(152)

      // Verify Expansion row at index 94
      const expRow = rawTable.rows[94]!
      expect(cell(rawTable, expRow, 'name')).toBe('Expansion')
      expect(cell(rawTable, expRow, 'code')).toBe('')

      expect(table.all.length).toBe(151)
      expect(table.byCode.size).toBe(151)

      // Verify 0 duplicate codes
      const seenCodes = new Set<string>()
      for (const item of table.all) {
        expect(seenCodes.has(item.code)).toBe(false)
        seenCodes.add(item.code)
      }
      expect(seenCodes.size).toBe(151)
    }

    // Verify Expansion row is excluded
    expect(table.byCode.has('Expansion')).toBe(false)
    expect(table.byCode.has('')).toBe(false)
  })

  it('loads ALL 151 rows including exactly 98 spawnable rows', () => {
    if (hasD2) {
      const spawnableCount = table.all.filter(i => i.spawnable).length
      expect(spawnableCount).toBe(98)

      const nonSpawnableCount = table.all.filter(i => !i.spawnable).length
      expect(nonSpawnableCount).toBe(53)
      expect(spawnableCount + nonSpawnableCount).toBe(151)
    }
  })

  it('verifies gld is recognized as gold (isGold === true, type === "gold")', () => {
    const gold = table.get('gld')
    expect(gold).toBeDefined()
    expect(gold?.isGold).toBe(true)
    expect(gold?.type).toBe('gold')
    expect(gold?.name).toBe('gold')
    expect(gold?.stackable).toBe(true)
    expect(gold?.maxstack).toBe(5000)

    // All other items must not be gold
    const nonGold = table.all.filter(i => i.code !== 'gld')
    for (const item of nonGold) {
      expect(item.isGold).toBe(false)
    }
  })

  it('verifies 33 runes r01..r33 are accessible by number 1..33 and have isRune === true', () => {
    if (hasD2) {
      const runes = table.all.filter(i => i.isRune)
      expect(runes.length).toBe(33)

      for (let num = 1; num <= 33; num++) {
        const rune = table.getRune(num)
        expect(rune).toBeDefined()
        expect(rune?.isRune).toBe(true)
        expect(rune?.runeNumber).toBe(num)

        const expectedCode = `r${String(num).padStart(2, '0')}`
        expect(rune?.code).toBe(expectedCode)
        expect(rune?.type).toBe('rune')
        expect(rune?.tags).toEqual(['rune'])
      }

      // Check specific first and last rune details
      const elRune = table.getRune(1)!
      expect(elRune.name).toBe('El Rune')
      expect(elRune.level).toBe(11)
      expect(elRune.cost).toBe(560)

      const zodRune = table.getRune(33)!
      expect(zodRune.name).toBe('Zod Rune')
      expect(zodRune.level).toBe(69)
      expect(zodRune.cost).toBe(134540)
    }

    // Boundary check for getRune
    expect(table.getRune(0)).toBeUndefined()
    expect(table.getRune(34)).toBeUndefined()
    expect(table.getRune(-1)).toBeUndefined()

    // Non-rune items starting with 'r' (e.g. rin, rvs, rvl, rps, rpl)
    for (const nonRuneCode of ['rin', 'rvs', 'rvl', 'rps', 'rpl']) {
      const item = table.get(nonRuneCode)
      if (item) {
        expect(item.isRune).toBe(false)
        expect(item.runeNumber).toBeUndefined()
      }
    }
  })

  describe('Sample item checks (hp1, rin, cm1)', () => {
    it('accurately parses Lesser Healing Potion (hp1)', () => {
      const hp1 = table.get('hp1')!
      expect(hp1).toBeDefined()
      expect(hp1.id).toBe('hp1')
      expect(hp1.code).toBe('hp1')
      expect(hp1.name).toBe('Lesser Healing Potion')
      expect(hp1.namestr).toBe('hp1')
      expect(hp1.version).toBe(0)
      expect(hp1.kind).toBe('misc')
      expect(hp1.spawnable).toBe(true)
      expect(hp1.rarity).toBe(1)
      expect(hp1.level).toBe(0)
      expect(hp1.type).toBe('hpot')
      expect(hp1.type2).toBeUndefined()
      expect(hp1.cost).toBe(30)
      expect(hp1.gambleCost).toBe(0)
      expect(hp1.invWidth).toBe(1)
      expect(hp1.invHeight).toBe(1)
      expect(hp1.stackable).toBe(false)
      expect(hp1.minstack).toBeUndefined()
      expect(hp1.maxstack).toBeUndefined()
      expect(hp1.spawnstack).toBeUndefined()
      expect(hp1.autobelt).toBe(true)
      expect(hp1.pSpell).toBe(3)
      expect(hp1.transmogrify).toBe(false)
      expect(hp1.tags).toEqual(['hpot'])
      expect(hp1.isGold).toBe(false)
      expect(hp1.isRune).toBe(false)
      expect(hp1.runeNumber).toBeUndefined()

      // ItemBase conformance
      expect(hp1.maxStack).toBe(1)
      expect(hp1.value).toBe(30)
      expect(hp1.damage).toBe(0)
      expect(hp1.defense).toBe(0)
    })

    it('accurately parses Ring (rin)', () => {
      const rin = table.get('rin')!
      expect(rin).toBeDefined()
      expect(rin.id).toBe('rin')
      expect(rin.code).toBe('rin')
      expect(rin.name).toBe('ring')
      expect(rin.namestr).toBe('rin')
      expect(rin.version).toBe(0)
      expect(rin.kind).toBe('misc')
      expect(rin.spawnable).toBe(true)
      expect(rin.rarity).toBe(4)
      expect(rin.level).toBe(1)
      expect(rin.type).toBe('ring')
      expect(rin.type2).toBeUndefined()
      expect(rin.cost).toBe(1800)
      expect(rin.gambleCost).toBe(50000)
      expect(rin.invWidth).toBe(1)
      expect(rin.invHeight).toBe(1)
      expect(rin.stackable).toBe(false)
      expect(rin.autobelt).toBe(false)
      expect(rin.pSpell).toBeUndefined()
      expect(rin.transmogrify).toBe(false)
      expect(rin.tags).toEqual(['ring'])
      expect(rin.isGold).toBe(false)
      expect(rin.isRune).toBe(false)
    })

    it('accurately parses Small Charm (cm1)', () => {
      const cm1 = table.get('cm1')!
      expect(cm1).toBeDefined()
      expect(cm1.id).toBe('cm1')
      expect(cm1.code).toBe('cm1')
      expect(cm1.name).toBe('Charm Small')
      expect(cm1.namestr).toBe('cm1')
      expect(cm1.version).toBe(100)
      expect(cm1.kind).toBe('misc')
      expect(cm1.spawnable).toBe(true)
      expect(cm1.rarity).toBe(4)
      expect(cm1.level).toBe(28)
      expect(cm1.type).toBe('scha')
      expect(cm1.type2).toBeUndefined()
      expect(cm1.cost).toBe(2000)
      expect(cm1.gambleCost).toBe(45000)
      expect(cm1.invWidth).toBe(1)
      expect(cm1.invHeight).toBe(1)
      expect(cm1.stackable).toBe(false)
      expect(cm1.autobelt).toBe(false)
      expect(cm1.pSpell).toBeUndefined()
      expect(cm1.transmogrify).toBe(false)
      expect(cm1.tags).toEqual(['scha'])
      expect(cm1.isGold).toBe(false)
      expect(cm1.isRune).toBe(false)
    })
  })

  describe('Caution item categories', () => {
    it('potions (hp1..hp5, mp1..mp5, rvs, rvl, vps)', () => {
      for (const code of ['hp1', 'hp2', 'hp3', 'hp4', 'hp5']) {
        const item = table.get(code)
        if (item) {
          expect(item.type).toBe('hpot')
          expect(item.autobelt).toBe(true)
        }
      }
      for (const code of ['mp1', 'mp2', 'mp3', 'mp4', 'mp5']) {
        const item = table.get(code)
        if (item) {
          expect(item.type).toBe('mpot')
          expect(item.autobelt).toBe(true)
        }
      }
      for (const code of ['rvs', 'rvl']) {
        const item = table.get(code)
        if (item) {
          expect(item.type).toBe('rpot')
          expect(item.autobelt).toBe(true)
        }
      }
      const vps = table.get('vps')
      if (vps) {
        expect(vps.type).toBe('spot')
        expect(vps.autobelt).toBe(false)
      }
    })

    it('scrolls (tsc, isc)', () => {
      const tsc = table.get('tsc')
      if (tsc) {
        expect(tsc.name).toBe('Town Portal Scroll')
        expect(tsc.type).toBe('scro')
      }

      const isc = table.get('isc')
      if (isc) {
        expect(isc.name).toBe('Identify Scroll')
        expect(isc.type).toBe('scro')
      }
    })

    it('charms (cm1..cm3)', () => {
      const cm1 = table.get('cm1')
      const cm2 = table.get('cm2')
      const cm3 = table.get('cm3')
      if (cm1) expect(cm1.type).toBe('scha')
      if (cm2) expect(cm2.type).toBe('mcha')
      if (cm3) expect(cm3.type).toBe('lcha')
    })

    it('jewels (jew)', () => {
      const jew = table.get('jew')
      if (jew) {
        expect(jew.name).toBe('Jewel')
        expect(jew.type).toBe('jewl')
      }
    })

    it('rings and amulets (rin, amu)', () => {
      const rin = table.get('rin')
      const amu = table.get('amu')
      if (rin) expect(rin.type).toBe('ring')
      if (amu) expect(amu.type).toBe('amul')
    })

    it('quivers (aqv, cqv)', () => {
      const aqv = table.get('aqv')
      if (aqv) {
        expect(aqv.type).toBe('bowq')
        expect(aqv.stackable).toBe(true)
        expect(aqv.minstack).toBe(100)
        expect(aqv.maxstack).toBe(350)
        expect(aqv.spawnstack).toBe(200)
      }

      const cqv = table.get('cqv')
      if (cqv) {
        expect(cqv.type).toBe('xboq')
        expect(cqv.stackable).toBe(true)
        expect(cqv.minstack).toBe(60)
        expect(cqv.maxstack).toBe(250)
        expect(cqv.spawnstack).toBe(150)
      }
    })
  })

  describe('Items with type2 and tags', () => {
    it('maps type and type2 into tags for chipped/perfect gems and skulls', () => {
      const gcv = table.get('gcv')
      if (gcv) {
        expect(gcv.name).toBe('Chipped Amethyst')
        expect(gcv.type).toBe('gema')
        expect(gcv.type2).toBe('gem0')
        expect(gcv.tags).toEqual(['gema', 'gem0'])
      }

      const gpw = table.get('gpw')
      if (gpw) {
        expect(gpw.name).toBe('Perfect Diamond')
        expect(gpw.type).toBe('gemd')
        expect(gpw.type2).toBe('gem4')
        expect(gpw.tags).toEqual(['gemd', 'gem4'])
      }

      const skz = table.get('skz')
      if (skz) {
        expect(skz.name).toBe('Perfect Skull')
        expect(skz.type).toBe('gemz')
        expect(skz.type2).toBe('gem4')
        expect(skz.tags).toEqual(['gemz', 'gem4'])
      }
    })
  })

  describe('Transmogrify flag', () => {
    it('sets transmogrify === true for horadric quest transmogrify items', () => {
      if (hasD2) {
        for (const code of ['hrt', 'brz', 'jaw', 'eyz', 'hrn', 'tal', 'fng', 'qll', 'sol', 'scz', 'spe']) {
          const item = table.get(code)!
          expect(item).toBeDefined()
          expect(item.transmogrify).toBe(true)
        }
      }
      expect(table.get('hp1')?.transmogrify).toBe(false)
    })
  })

  describe('Lookup & indexing flexibility', () => {
    it('supports case-insensitive and whitespace-tolerant get and byCode lookups', () => {
      const hp1 = table.get('hp1')!
      expect(table.get('HP1')).toBe(hp1)
      expect(table.get('  hp1  ')).toBe(hp1)
      expect(table.get('Hp1')).toBe(hp1)

      expect(table.byCode.get('HP1')).toBe(hp1)
      expect(table.byCode.get('  hp1  ')).toBe(hp1)
      expect(table.byCode.has('HP1')).toBe(true)
      expect(table.byCode.has('nonexistent')).toBe(false)
      expect(table.get('nonexistent')).toBeUndefined()
    })
  })

  describe('parseMiscTable overloads & standalone parsing', () => {
    it('parses directly from a TSV string with Expansion row filtering', () => {
      const tsv = [
        'name\tcode\tnamestr\tversion\tspawnable\trarity\tlevel\ttype\ttype2\tcost\tgamble cost\tinvwidth\tinvheight\tstackable\tminstack\tmaxstack\tspawnstack\tautobelt\tpSpell\tTransmogrify',
        'Lesser Healing Potion\thp1\thp1\t0\t1\t1\t0\thpot\t\t30\t\t1\t1\t0\t0\t0\t0\t1\t3\t0',
        'Expansion\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t',
        'El Rune\tr01\tr01\t100\t1\t1\t11\trune\t\t560\t\t1\t1\t0\t0\t0\t0\t0\t\t0',
        'gold\tgld\tgld\t0\t1\t0\t0\tgold\t\t1\t\t1\t1\t1\t0\t5000\t0\t0\t\t0',
        'Chipped Amethyst\tgcv\tgcv\t0\t1\t1\t1\tgema\tgem0\t240\t\t1\t1\t0\t0\t0\t0\t0\t\t0',
      ].join('\n')

      const parsed = parseMiscTable(tsv)
      expect(parsed.all.length).toBe(4)
      expect(parsed.byCode.size).toBe(4)
      expect(parsed.get('Expansion')).toBeUndefined()

      const hp1 = parsed.get('hp1')!
      expect(hp1).toBeDefined()
      expect(hp1.name).toBe('Lesser Healing Potion')
      expect(hp1.pSpell).toBe(3)
      expect(hp1.autobelt).toBe(true)

      const rune = parsed.getRune(1)!
      expect(rune).toBeDefined()
      expect(rune.code).toBe('r01')
      expect(rune.isRune).toBe(true)
      expect(rune.runeNumber).toBe(1)

      const gold = parsed.get('gld')!
      expect(gold.isGold).toBe(true)
      expect(gold.stackable).toBe(true)
      expect(gold.maxstack).toBe(5000)

      const gem = parsed.get('gcv')!
      expect(gem.tags).toEqual(['gema', 'gem0'])
    })

    it('parses directly from Uint8Array bytes', () => {
      const tsv = [
        'name\tcode\tnamestr\tversion\tspawnable\trarity\tlevel\ttype\ttype2\tcost\tgamble cost\tinvwidth\tinvheight\tstackable\tminstack\tmaxstack\tspawnstack\tautobelt\tpSpell\tTransmogrify',
        'Zod Rune\tr33\tr33\t100\t1\t30\t69\trune\t\t134540\t\t1\t1\t0\t0\t0\t0\t0\t\t0',
      ].join('\n')

      const bytes = new TextEncoder().encode(tsv)
      const parsed = parseMiscTable(bytes)
      expect(parsed.all.length).toBe(1)
      expect(parsed.getRune(33)?.name).toBe('Zod Rune')
    })
  })
})

/**
 * Minimal fallback D2Table for environments without MPQ assets.
 */
function createMinimalFallbackTable(): D2Table {
  const header = [
    'name', 'code', 'namestr', 'version', 'spawnable', 'rarity', 'level',
    'type', 'type2', 'cost', 'gamble cost', 'invwidth', 'invheight',
    'stackable', 'minstack', 'maxstack', 'spawnstack', 'autobelt', 'pSpell',
    'Transmogrify',
  ]

  const rows = [
    ['Lesser Healing Potion', 'hp1', 'hp1', '0', '1', '1', '0', 'hpot', '', '30', '', '1', '1', '0', '0', '0', '0', '1', '3', '0'],
    ['ring', 'rin', 'rin', '0', '1', '4', '1', 'ring', '', '1800', '50000', '1', '1', '0', '0', '0', '0', '0', '', '0'],
    ['Charm Small', 'cm1', 'cm1', '100', '1', '4', '28', 'scha', '', '2000', '45000', '1', '1', '0', '0', '0', '0', '0', '', '0'],
    ['gold', 'gld', 'gld', '0', '1', '0', '0', 'gold', '', '1', '', '1', '1', '1', '0', '5000', '0', '0', '', '0'],
    ['Expansion', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['El Rune', 'r01', 'r01', '100', '1', '1', '11', 'rune', '', '560', '', '1', '1', '0', '0', '0', '0', '0', '', '0'],
    ['Zod Rune', 'r33', 'r33', '100', '1', '30', '69', 'rune', '', '134540', '', '1', '1', '0', '0', '0', '0', '0', '', '0'],
  ]

  return { header, rows }
}
