import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import type { D2Table } from '../src/common/world/acts.ts'
import { cell, parseTable } from '../src/common/world/acts.ts'
import type { ItemBase } from '../src/common/items/items.ts'
import {
  parseWeaponsTable,
  loadWeapons,
  getWeaponCell,
  WEAPONS_TABLE_PATH,
  type WeaponTable,
  type WeaponBase,
} from '../src/common/items/weapons.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

describe('Unit: Standalone Weapons Table Parsing', () => {
  const syntheticHeader = [
    'name', 'type', 'type2', 'code', 'alternateGfx', 'namestr', 'version', 'compactsave',
    'rarity', 'spawnable', 'mindam', 'maxdam', '1or2handed', '2handed', '2handmindam',
    '2handmaxdam', 'minmisdam', 'maxmisdam', '', 'rangeadder', 'speed', 'StrBonus',
    'DexBonus', 'reqstr', 'reqdex', 'durability', 'nodurability', 'level', 'levelreq',
    'cost', 'gamble cost', 'magic lvl', 'auto prefix', 'OpenBetaGfx', 'normcode', 'ubercode',
    'ultracode', 'wclass', '2handedwclass', 'component', 'hit class', 'invwidth', 'invheight',
    'stackable', 'minstack', 'maxstack', 'spawnstack', 'flippyfile', 'invfile', 'uniqueinvfile',
    'setinvfile', 'hasinv', 'gemsockets',
  ].join('\t')

  it('parses synthetic rows, handles empty col 18, and filters Expansion row', () => {
    const rawTsv = [
      syntheticHeader,
      // Regular 1H weapon
      ['Hand Axe', 'axe', '', 'hax', 'hax', 'hax', '0', '', '3', '1', '3', '6', '', '', '', '', '', '', '99', '0', '0', '100', '', '0', '0', '28', '', '3', '0', '170', '4510', '', '', 'hax', 'hax', '9ha', '7ha', '1hs', '1hs', '5', '1hsl', '1', '3', '', '', '', '', 'flphax', 'invhax', 'invhaxu', 'invhaxu', '1', '2'].join('\t'),
      // Expansion separator row
      ['Expansion', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''].join('\t'),
      // 2H weapon
      ['Two-Handed Sword', 'swor', '', '2hs', '2hs', '2hs', '0', '', '2', '1', '2', '9', '1', '1', '8', '17', '', '', '', '2', '0', '100', '', '35', '0', '44', '', '10', '0', '478', '9560', '', '', '2hs', '2hs', '92h', '72h', '1hs', '2hs', '5', '1hsl', '1', '4', '', '', '', '', 'flp2hs', 'inv2hs', 'inv2hsu', 'inv2hsu', '1', '3'].join('\t'),
      // Quest / special item with empty rarity
      ['Wirt\'s Leg', 'club', '', 'leg', 'leg', 'leg', '0', '', '', '0', '1', '8', '', '', '', '', '', '', '15', '0', '20', '100', '', '0', '0', '66', '', '1', '0', '1', '10', '', '', 'leg', 'leg', '', '', '1hs', '1hs', '5', '1hsl', '1', '3', '', '', '', '', 'flpleg', 'invleg', 'invleg', 'invleg', '1', '3'].join('\t'),
      // Stackable thrown weapon
      ['Throwing Knife', 'tkni', '', 'tkf', 'tkf', 'tkf', '0', '', '3', '1', '2', '3', '', '', '', '', '4', '9', '15', '0', '0', '100', '', '0', '21', '0', '1', '2', '0', '160', '3200', '', '', 'tkf', 'tkf', '9tk', '7tk', '1ht', '1ht', '5', '1ht', '1', '2', '1', '40', '160', '100', 'flptkf', 'invtkf', 'invtkfu', 'invtkfu', '1', '0'].join('\t'),
    ].join('\n')

    const table = parseWeaponsTable(rawTsv)

    expect(table.all).toHaveLength(4)
    expect(table.length).toBe(4)
    expect(table.get('Expansion')).toBeUndefined()

    // 1. Regular 1H weapon (hax)
    const hax = table.get('hax')!
    expect(hax).toBeDefined()
    expect(hax.name).toBe('Hand Axe')
    expect(hax.rarity).toBe(3)
    expect(hax.spawnable).toBe(true)
    expect(hax.rangeadder).toBe(0)
    // Verify col 18 value '99' did NOT pollute rangeadder or maxMisDam
    expect(hax.rangeadder).not.toBe(99)
    expect(hax.maxMisDam).toBeUndefined()

    // 2. 2H weapon (2hs)
    const twoHand = table.get('2hs')!
    expect(twoHand).toBeDefined()
    expect(twoHand.twoHanded).toBe(true)
    expect(twoHand.mindam).toBe(2)
    expect(twoHand.maxdam).toBe(9)
    expect(twoHand.twoHandedMindam).toBe(8)
    expect(twoHandedMaxdam(twoHand)).toBe(17)
    expect(twoHand.twoHandedWClass).toBe('2hs')

    // 3. Quest item with empty rarity (leg)
    const leg = table.get('leg')!
    expect(leg).toBeDefined()
    expect(leg.rarity).toBe(0) // Empty rarity MUST be parsed as 0
    expect(leg.spawnable).toBe(false)
    expect(leg.ubercode).toBe('')
    expect(leg.ultracode).toBe('')

    // 4. Stackable thrown weapon (tkf)
    const tkf = table.get('tkf')!
    expect(tkf).toBeDefined()
    expect(tkf.stackable).toBe(true)
    expect(tkf.minstack).toBe(40)
    expect(tkf.maxstack).toBe(160)
    expect(tkf.maxStack).toBe(160)
    expect(tkf.minMisDam).toBe(4)
    expect(tkf.maxMisDam).toBe(9)

    // ItemBase compliance
    const itemBase: ItemBase = hax
    expect(itemBase.id).toBe('hax')
    expect(itemBase.kind).toBe('weapon')
    expect(itemBase.defense).toBe(0)
    expect(itemBase.damage).toBe(6)
    expect(itemBase.value).toBe(170)
  })

  it('demonstrates column index 18 hazard in acts.ts cell() vs getWeaponCell()', () => {
    const rawTsv = [
      syntheticHeader,
      ['Throwing Knife', 'tkni', '', 'tkf', 'tkf', 'tkf', '0', '', '3', '1', '2', '3', '', '', '', '', '4', '9', '15', '0', '0', '100', '', '0', '21', '0', '1', '2', '0', '160', '3200', '', '', 'tkf', 'tkf', '9tk', '7tk', '1ht', '1ht', '5', '1ht', '1', '2', '1', '40', '160', '100', 'flptkf', 'invtkf', 'invtkfu', 'invtkfu', '1', '0'].join('\t'),
    ].join('\n')

    const d2Table = parseTable(new TextEncoder().encode(rawTsv))
    const row = d2Table.rows[0]!

    // In raw acts.ts cell(), querying '' returns column 18 because header[18] is ''
    expect(d2Table.header[18]).toBe('')
    expect(cell(d2Table, row, '')).toBe('15') // Confirms the dangerous hazard!

    // In getWeaponCell(), querying '' safely returns empty string
    expect(getWeaponCell(d2Table, row, '')).toBe('')
  })
})

function twoHandedMaxdam(w: WeaponBase): number | undefined {
  return w.twoHandedMaxdam
}

describe.skipIf(!hasD2)('Weapons.txt 1.13c Integration Tests (Issue #92)', () => {
  let archives: MountedArchives
  let rawTable: D2Table
  let weapons: WeaponTable

  beforeAll(async () => {
    archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
    }
    weapons = await loadWeapons(archives)
    const bytes = await archives.read(WEAPONS_TABLE_PATH)
    rawTable = parseTable(bytes)
  })

  it('loads weapons via canonical path WEAPONS_TABLE_PATH', () => {
    expect(WEAPONS_TABLE_PATH).toBe('data\\global\\excel\\Weapons.txt')
  })

  it('verifies 307 raw lines - 1 Expansion row = 306 real data rows', () => {
    // Exactly 307 raw rows in file
    expect(rawTable.rows.length).toBe(307)

    // Row index 175 is the Expansion separator
    const expansionIndex = rawTable.rows.findIndex(r => r[0] === 'Expansion')
    expect(expansionIndex).toBe(175)
    const expansionRow = rawTable.rows[expansionIndex]!
    expect(expansionRow[0]).toBe('Expansion')
    expect(expansionRow[3]).toBe('') // Code is empty

    // Exactly 306 data rows parsed
    expect(weapons.all).toHaveLength(306)
    expect(weapons.length).toBe(306)
    expect(weapons.byCode.size).toBe(306)

    // Verify Expansion is not in parsed table
    expect(weapons.get('Expansion')).toBeUndefined()
    expect(weapons.byCode.has('Expansion')).toBe(false)
  })

  it('verifies 0 failures and 0 duplicate codes across all 306 weapons', () => {
    const codeSet = new Set<string>()
    for (const w of weapons.all) {
      expect(w.code).toBeTruthy()
      expect(w.code.length).toBeGreaterThanOrEqual(3)
      expect(w.name).toBeTruthy()
      expect(w.type).toBeTruthy()
      expect(w.kind).toBe('weapon')
      expect(Number.isNaN(w.level)).toBe(false)
      expect(Number.isNaN(w.mindam)).toBe(false)
      expect(Number.isNaN(w.maxdam)).toBe(false)
      expect(Number.isNaN(w.cost)).toBe(false)
      expect(Number.isNaN(w.gambleCost)).toBe(false)
      expect(Number.isNaN(w.speed)).toBe(false)

      expect(codeSet.has(w.code), `Duplicate weapon code found: ${w.code}`).toBe(false)
      codeSet.add(w.code)
    }
    expect(codeSet.size).toBe(306)
  })

  it('verifies column index 18 empty header does not pollute any field', () => {
    expect(rawTable.header[18]).toBe('')

    // Exactly 166 rows in vanilla 1.13c have values in column 18
    const col18Rows = rawTable.rows.filter(r => r[0] !== 'Expansion' && r[18] !== '')
    expect(col18Rows.length).toBe(166)

    // Test specific weapon with column 18 value: 'jav' (Javelin) has '15' in column 18
    const jav = weapons.get('jav')!
    expect(jav).toBeDefined()
    expect(jav.name).toBe('Javelin')
    // Column 17 is maxmisdam = 14
    expect(jav.maxMisDam).toBe(14)
    // Column 19 is rangeadder = 2 (NOT 15 from column 18)
    expect(jav.rangeadder).toBe(2)
    expect(jav.speed).toBe(-10)
    expect(jav.mindam).toBe(1)
    expect(jav.maxdam).toBe(5)
    expect(jav.twoHanded).toBe(false)

    // Test 'pil' (Pilum): col 17 = 20, col 18 = 15, col 19 = 2
    const pil = weapons.get('pil')!
    expect(pil).toBeDefined()
    expect(pil.maxMisDam).toBe(20)
    expect(pil.rangeadder).toBe(2)

    // Lookup of empty string must be undefined
    expect(weapons.get('')).toBeUndefined()
    expect(weapons.byCode.get('')).toBeUndefined()
  })

  it('verifies exactly 15 items have rarity === 0', () => {
    const zeroRarityItems = weapons.all.filter(w => w.rarity === 0)
    expect(zeroRarityItems).toHaveLength(15)

    const zeroRarityCodes = zeroRarityItems.map(w => w.code).sort()
    // Expected 15 quest items, special weapons, and throwing potions
    const expectedZeroRarityCodes = [
      'd33', // decoy dagger
      'g33', // Gidbinn
      'gpl', // Strangling Gas Potion
      'gpm', // Choking Gas Potion
      'gps', // Rancid Gas Potion
      'hdm', // Horadric Malus
      'hfh', // Hellforge Hammer
      'hst', // Horadric Staff
      'leg', // Wirt's Leg
      'msf', // Staff of the Kings
      'opl', // Fulminating Potion
      'opm', // Exploding Potion
      'ops', // Oil Potion
      'qf1', // KhalimFlail
      'qf2', // SuperKhalimFlail
    ].sort()

    expect(zeroRarityCodes).toEqual(expectedZeroRarityCodes)

    // All remaining 291 items have rarity between 1 and 5
    const nonZeroRarityItems = weapons.all.filter(w => w.rarity > 0)
    expect(nonZeroRarityItems).toHaveLength(291)
    for (const w of nonZeroRarityItems) {
      expect(w.rarity).toBeGreaterThanOrEqual(1)
      expect(w.rarity).toBeLessThanOrEqual(5)
    }
  })

  it('verifies spawnable counts: exactly 297/306 are spawnable', () => {
    const spawnableItems = weapons.all.filter(w => w.spawnable)
    expect(spawnableItems).toHaveLength(297)

    const nonSpawnableItems = weapons.all.filter(w => !w.spawnable)
    expect(nonSpawnableItems).toHaveLength(9)
    // 9 non-spawnable items are the unique quest weapons
    const nonSpawnableCodes = nonSpawnableItems.map(w => w.code).sort()
    expect(nonSpawnableCodes).toEqual(['d33', 'g33', 'hdm', 'hfh', 'hst', 'leg', 'msf', 'qf1', 'qf2'].sort())
  })

  it('verifies level ranges from 0 to 86', () => {
    const levels = weapons.all.map(w => w.level)
    expect(Math.min(...levels)).toBe(0)
    expect(Math.max(...levels)).toBe(86)
  })

  it('sample check: hax (Hand Axe) damage, requirements, and codes', () => {
    const hax = weapons.get('hax')!
    expect(hax).toBeDefined()
    expect(hax).toMatchObject({
      id: 'hax',
      code: 'hax',
      name: 'Hand Axe',
      namestr: 'hax',
      version: 0,
      kind: 'weapon',
      spawnable: true,
      rarity: 3,
      level: 3,
      levelreq: 0,
      mindam: 3,
      maxdam: 6,
      twoHanded: false,
      speed: 0,
      reqstr: 0,
      reqdex: 0,
      durability: 28,
      cost: 170,
      gambleCost: 4510,
      type: 'axe',
      wclass: '1hs',
      twoHandedWClass: '1hs',
      stackable: false,
      rangeadder: 0,
      normcode: 'hax',
      ubercode: '9ha',
      ultracode: '7ha',
      gemsockets: 2,
      invWidth: 1,
      invHeight: 3,
      tags: ['axe'],
      damage: 6,
      value: 170,
      defense: 0,
      maxStack: 1,
    })
    expect(hax.twoHandedMindam).toBeUndefined()
    expect(hax.twoHandedMaxdam).toBeUndefined()
    expect(hax.minMisDam).toBeUndefined()
    expect(hax.maxMisDam).toBeUndefined()
    expect(hax.type2).toBeUndefined()
    expect(hax.minstack).toBeUndefined()
    expect(hax.maxstack).toBeUndefined()
  })

  it('sample check: crs (Crystal Sword) damage, requirements, and codes', () => {
    const crs = weapons.get('crs')!
    expect(crs).toBeDefined()
    expect(crs).toMatchObject({
      id: 'crs',
      code: 'crs',
      name: 'Crystal Sword',
      namestr: 'crs',
      version: 0,
      kind: 'weapon',
      spawnable: true,
      rarity: 2,
      level: 11,
      levelreq: 0,
      mindam: 5,
      maxdam: 15,
      twoHanded: false,
      speed: 0,
      reqstr: 43,
      reqdex: 0,
      durability: 20,
      cost: 2127,
      gambleCost: 31397,
      type: 'swor',
      wclass: '1hs',
      twoHandedWClass: '1hs',
      stackable: false,
      rangeadder: 1,
      normcode: 'crs',
      ubercode: '9cr',
      ultracode: '7cr',
      gemsockets: 6,
      invWidth: 2,
      invHeight: 3,
      tags: ['swor'],
      damage: 15,
      value: 2127,
      defense: 0,
      maxStack: 1,
    })
    expect(crs.twoHandedMindam).toBeUndefined()
    expect(crs.twoHandedMaxdam).toBeUndefined()
    expect(crs.minMisDam).toBeUndefined()
    expect(crs.maxMisDam).toBeUndefined()
  })

  it('verifies two-handed weapon archetypes (2hs, bow)', () => {
    // Two-Handed Sword (2hs)
    const twoHandedSword = weapons.get('2hs')!
    expect(twoHandedSword).toBeDefined()
    expect(twoHandedSword.twoHanded).toBe(true)
    expect(twoHandedSword.mindam).toBe(2)
    expect(twoHandedSword.maxdam).toBe(9)
    expect(twoHandedSword.twoHandedMindam).toBe(8)
    expect(twoHandedSword.twoHandedMaxdam).toBe(17)
    expect(twoHandedSword.wclass).toBe('1hs')
    expect(twoHandedSword.twoHandedWClass).toBe('2hs')

    // Short Bow (sbw)
    const bow = weapons.get('sbw')!
    expect(bow).toBeDefined()
    expect(bow.twoHanded).toBe(true)
    expect(bow.mindam).toBe(0)
    expect(bow.maxdam).toBe(0)
    expect(bow.twoHandedMindam).toBe(1)
    expect(bow.twoHandedMaxdam).toBe(4)
    expect(bow.wclass).toBe('bow')
    expect(bow.twoHandedWClass).toBe('bow')
  })

  it('verifies stackable missile weapon archetype (tkf)', () => {
    const tkf = weapons.get('tkf')!
    expect(tkf).toBeDefined()
    expect(tkf.stackable).toBe(true)
    expect(tkf.minstack).toBe(40)
    expect(tkf.maxstack).toBe(160)
    expect(tkf.maxStack).toBe(160)
    expect(tkf.mindam).toBe(2)
    expect(tkf.maxdam).toBe(3)
    expect(tkf.minMisDam).toBe(4)
    expect(tkf.maxMisDam).toBe(9)
  })

  it('supports case-insensitive and trimmed code lookups', () => {
    const hax = weapons.get('hax')!
    expect(weapons.get('HAX')).toBe(hax)
    expect(weapons.get('  hax  ')).toBe(hax)
    expect(weapons.byCode.get('HAX')).toBe(hax)
    expect(weapons.byCode.get('  Hax  ')).toBe(hax)
    expect(weapons.byCode.has('HAX')).toBe(true)

    const crs = weapons.get('crs')!
    expect(weapons.get('CRS')).toBe(crs)
    expect(weapons.byCode.get('CRS')).toBe(crs)
  })

  it('allows for-of iteration over WeaponTable', () => {
    let count = 0
    for (const w of weapons) {
      expect(w.kind).toBe('weapon')
      count++
    }
    expect(count).toBe(306)
  })

  it('conforms to ItemBase interface in items.ts', () => {
    const hax: ItemBase = weapons.get('hax')!
    expect(hax.id).toBe('hax')
    expect(hax.kind).toBe('weapon')
    expect(hax.damage).toBe(6)
    expect(hax.defense).toBe(0)
    expect(hax.invWidth).toBe(1)
    expect(hax.invHeight).toBe(3)
    expect(hax.tags).toEqual(['axe'])
  })
})
