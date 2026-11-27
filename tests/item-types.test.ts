import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import type { D2Table } from '../src/common/world/acts.ts'
import { cell, parseTable } from '../src/common/world/acts.ts'
import {
  parseItemTypesTable,
  loadItemTypes,
  isA,
  ITEM_TYPES_TABLE_PATH,
  type ItemTypeTable,
} from '../src/common/items/item-types.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

describe('ItemTypes loader & Equiv inheritance (Issue #89)', () => {
  let table: ItemTypeTable
  let rawTable: D2Table | undefined

  beforeAll(async () => {
    if (!hasD2) {
      throw new Error(
        '[Preflight] samples/d2 MPQ files (d2data.mpq, d2exp.mpq, Patch_D2.mpq) are required for ItemTypes table verification. ' +
        'Please symlink samples/d2 to your Diablo II 1.13c installation directory.'
      )
    }
    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
    }
    const bytes = await archives.read(ITEM_TYPES_TABLE_PATH)
    rawTable = parseTable(bytes)
    table = parseItemTypesTable(rawTable)
  })

  it('correctly uses the canonical MPQ table path', () => {
    expect(ITEM_TYPES_TABLE_PATH).toBe('data\\global\\excel\\ItemTypes.txt')
  })

  it('loads item types using loadItemTypes with mounted archives', async () => {
    if (hasD2) {
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      const loaded = await loadItemTypes(archives)
      expect(loaded.types.length).toBe(98)
      expect(loaded.byCode.size).toBe(98)
      expect(isA('shie', 'shld', loaded)).toBe(true)
    }
  })

  it('verifies 104 raw rows in original file and filters exactly 6 rows to yield 98 valid types', () => {
    if (hasD2 && rawTable) {
      expect(rawTable.rows.length).toBe(104)

      // Filtered indices:
      // Index 0 & 1: None placeholders
      expect(cell(rawTable, rawTable.rows[0]!, 'ItemType')).toBe('None')
      expect(cell(rawTable, rawTable.rows[0]!, 'Code')).toBe('')
      expect(cell(rawTable, rawTable.rows[1]!, 'ItemType')).toBe('None')
      expect(cell(rawTable, rawTable.rows[1]!, 'Code')).toBe('')

      // Index 14, 17, 23: Not Used placeholders
      expect(cell(rawTable, rawTable.rows[14]!, 'ItemType')).toBe('Not Used')
      expect(cell(rawTable, rawTable.rows[14]!, 'Code')).toBe('')
      expect(cell(rawTable, rawTable.rows[17]!, 'ItemType')).toBe('Not Used')
      expect(cell(rawTable, rawTable.rows[17]!, 'Code')).toBe('')
      expect(cell(rawTable, rawTable.rows[23]!, 'ItemType')).toBe('Not Used')
      expect(cell(rawTable, rawTable.rows[23]!, 'Code')).toBe('')

      // Index 58: Expansion separator row
      expect(cell(rawTable, rawTable.rows[58]!, 'ItemType')).toBe('Expansion')
      expect(cell(rawTable, rawTable.rows[58]!, 'Code')).toBe('')
    }

    expect(table.types.length).toBe(98)
    expect(table.byCode.size).toBe(98)

    // Ensure placeholders and separator are not in parsed types
    expect(table.byCode.has('')).toBe(false)
    expect(table.byCode.has('None')).toBe(false)
    expect(table.byCode.has('Not Used')).toBe(false)
    expect(table.byCode.has('Expansion')).toBe(false)
  })

  it('indexes rows by code with case-insensitive and trimmed lookup', () => {
    const shie = table.byCode.get('shie')
    expect(shie).toBeDefined()
    expect(shie?.name).toBe('Shield')

    // Case-insensitive & trimmed lookups
    expect(table.byCode.get('SHIE')).toBe(shie)
    expect(table.byCode.get('  shie  ')).toBe(shie)
    expect(table.byCode.get('ShIe')).toBe(shie)
    expect(table.byCode.has('SHIE')).toBe(true)
    expect(table.byCode.has('  shie  ')).toBe(true)
    expect(table.byCode.has('nonexistent')).toBe(false)
  })

  it('asserts exactly 5 rows have treasureClass === 1 (TreasureClass seeds)', () => {
    const tcSeeds = table.types.filter(t => t.treasureClass === 1)
    expect(tcSeeds.length).toBe(5)

    const seedCodes = tcSeeds.map(t => t.code)
    expect(seedCodes).toEqual(['bow', 'weap', 'mele', 'armo', 'abow'])

    const seedNames = tcSeeds.map(t => t.name)
    expect(seedNames).toEqual(['Bow', 'Weapon', 'Melee Weapon', 'Any Armor', 'Amazon Bow'])

    // All remaining 93 types must have treasureClass === 0
    const nonSeeds = table.types.filter(t => t.treasureClass === 0)
    expect(nonSeeds.length).toBe(93)
  })

  it('maps all ItemTypeDefinition fields accurately', () => {
    const shie = table.byCode.get('shie')!
    expect(shie.code).toBe('shie')
    expect(shie.name).toBe('Shield')
    expect(shie.equiv1).toBe('shld')
    expect(shie.equiv2).toBe('')
    expect(shie.treasureClass).toBe(0)
    expect(shie.rarity).toBe(3)
    expect(shie.maxSock1).toBe(3)
    expect(shie.maxSock25).toBe(3)
    expect(shie.maxSock40).toBe(4)
    expect(shie.magic).toBe(false)
    expect(shie.rare).toBe(true)
    expect(shie.normal).toBe(false)
    expect(shie.charm).toBe(false)
    expect(shie.gem).toBe(false)
    expect(shie.body).toBe(true)
    expect(shie.bodyLoc1).toBe('rarm')
    expect(shie.bodyLoc2).toBe('larm')
    expect(shie.beltable).toBe(false)
    expect(shie.class).toBe('')

    // StaffMods test (Paladin scepters, Necromancer wands, Sorceress staves)
    const scep = table.byCode.get('scep')!
    expect(scep.staffMods).toBe('pal')
    expect(scep.rarity).toBe(1)
    expect(scep.maxSock1).toBe(3)
    expect(scep.maxSock25).toBe(5)
    expect(scep.maxSock40).toBe(6)

    const wand = table.byCode.get('wand')!
    expect(wand.staffMods).toBe('nec')

    const staf = table.byCode.get('staf')!
    expect(staf.staffMods).toBe('sor')

    // Class-specific items
    const amaz = table.byCode.get('amaz')!
    expect(amaz.class).toBe('ama')

    const barb = table.byCode.get('barb')!
    expect(barb.class).toBe('bar')

    // Beltable potions
    const poti = table.byCode.get('poti')!
    expect(poti.beltable).toBe(true)
    expect(poti.body).toBe(false)

    // Charms & gems
    const char = table.byCode.get('char')!
    expect(char.charm).toBe(true)
    expect(char.magic).toBe(true)

    const gem = table.byCode.get('gem')!
    expect(gem.gem).toBe(true)
  })

  describe('Type inheritance check (isA)', () => {
    it('verifies direct inheritance: shie -> shld', () => {
      expect(isA('shie', 'shld', table)).toBe(true)
    })

    it('verifies melee to weapon inheritance: mele -> weap', () => {
      expect(isA('mele', 'weap', table)).toBe(true)
    })

    it('verifies wand/rod inheritance: wand -> rod', () => {
      expect(isA('wand', 'rod', table)).toBe(true)
      expect(isA('scep', 'rod', table)).toBe(true)
      expect(isA('staf', 'rod', table)).toBe(true)
    })

    it('verifies multi-hop inheritance chain: abow -> bow -> miss (and abow -> weap)', () => {
      expect(isA('abow', 'bow', table)).toBe(true)
      expect(isA('bow', 'miss', table)).toBe(true)
      expect(isA('abow', 'miss', table)).toBe(true)
      expect(isA('miss', 'weap', table)).toBe(true)
      expect(isA('abow', 'weap', table)).toBe(true)
    })

    it('verifies Equiv2 multi-parent inheritance: abow -> amaz -> clas', () => {
      expect(isA('abow', 'amaz', table)).toBe(true)
      expect(isA('amaz', 'clas', table)).toBe(true)
      expect(isA('abow', 'clas', table)).toBe(true)
    })

    it('verifies diamond inheritance: tkni -> comb -> mele/thro -> weap', () => {
      expect(isA('tkni', 'comb', table)).toBe(true)
      expect(isA('tkni', 'knif', table)).toBe(true)
      expect(isA('tkni', 'mele', table)).toBe(true)
      expect(isA('tkni', 'thro', table)).toBe(true)
      expect(isA('tkni', 'weap', table)).toBe(true)
    })

    it('verifies reflexive inheritance (typeCode === ancestorCode)', () => {
      expect(isA('shie', 'shie', table)).toBe(true)
      expect(isA('weap', 'weap', table)).toBe(true)
      expect(isA('armo', 'armo', table)).toBe(true)
    })

    it('correctly rejects non-ancestor relationships', () => {
      expect(isA('shie', 'weap', table)).toBe(false)
      expect(isA('bow', 'armo', table)).toBe(false)
      expect(isA('weap', 'mele', table)).toBe(false) // Parent is not a descendant of child
      expect(isA('shld', 'shie', table)).toBe(false)
      expect(isA('armo', 'shie', table)).toBe(false)
    })

    it('handles empty or unknown codes gracefully without throwing', () => {
      expect(isA('', 'weap', table)).toBe(false)
      expect(isA('shie', '', table)).toBe(false)
      expect(isA('', '', table)).toBe(false)
      expect(isA('unknown', 'weap', table)).toBe(false)
      expect(isA('shie', 'unknown', table)).toBe(false)
      expect(isA('unknown', 'unknown', table)).toBe(false)
    })

    it('supports case-insensitive and whitespace-padded arguments', () => {
      expect(isA('SHIE', 'shld', table)).toBe(true)
      expect(isA('shie', 'SHLD', table)).toBe(true)
      expect(isA('  abow  ', '  WEAP  ', table)).toBe(true)
      expect(isA('WAND', 'ROD', table)).toBe(true)
    })

    it('memoizes results in table._isACache', () => {
      const cache = table._isACache
      expect(cache).toBeDefined()

      // Query and check cache entry
      const result = isA('wand', 'rod', table)
      expect(result).toBe(true)
      expect(cache?.get('wand:rod')).toBe(true)

      // Negative query memoized
      const negResult = isA('wand', 'armo', table)
      expect(negResult).toBe(false)
      expect(cache?.get('wand:armo')).toBe(false)
    })

    it('safely handles circular inheritance chains without infinite loop', () => {
      const cyclicTable: ItemTypeTable = {
        types: [
          {
            code: 'cycA',
            name: 'Cyclic A',
            equiv1: 'cycB',
            equiv2: '',
            treasureClass: 0,
            rarity: 0,
            maxSock1: 0,
            maxSock25: 0,
            maxSock40: 0,
            magic: false,
            rare: false,
            normal: false,
            charm: false,
            gem: false,
            staffMods: '',
            body: false,
            bodyLoc1: '',
            bodyLoc2: '',
            beltable: false,
            class: '',
          },
          {
            code: 'cycB',
            name: 'Cyclic B',
            equiv1: 'cycA',
            equiv2: '',
            treasureClass: 0,
            rarity: 0,
            maxSock1: 0,
            maxSock25: 0,
            maxSock40: 0,
            magic: false,
            rare: false,
            normal: false,
            charm: false,
            gem: false,
            staffMods: '',
            body: false,
            bodyLoc1: '',
            bodyLoc2: '',
            beltable: false,
            class: '',
          },
          {
            code: 'target',
            name: 'Target',
            equiv1: '',
            equiv2: '',
            treasureClass: 0,
            rarity: 0,
            maxSock1: 0,
            maxSock25: 0,
            maxSock40: 0,
            magic: false,
            rare: false,
            normal: false,
            charm: false,
            gem: false,
            staffMods: '',
            body: false,
            bodyLoc1: '',
            bodyLoc2: '',
            beltable: false,
            class: '',
          },
        ],
        byCode: new Map([
          ['cyca', {
            code: 'cycA',
            name: 'Cyclic A',
            equiv1: 'cycB',
            equiv2: '',
            treasureClass: 0,
            rarity: 0,
            maxSock1: 0,
            maxSock25: 0,
            maxSock40: 0,
            magic: false,
            rare: false,
            normal: false,
            charm: false,
            gem: false,
            staffMods: '',
            body: false,
            bodyLoc1: '',
            bodyLoc2: '',
            beltable: false,
            class: '',
          }],
          ['cycb', {
            code: 'cycB',
            name: 'Cyclic B',
            equiv1: 'cycA',
            equiv2: '',
            treasureClass: 0,
            rarity: 0,
            maxSock1: 0,
            maxSock25: 0,
            maxSock40: 0,
            magic: false,
            rare: false,
            normal: false,
            charm: false,
            gem: false,
            staffMods: '',
            body: false,
            bodyLoc1: '',
            bodyLoc2: '',
            beltable: false,
            class: '',
          }],
          ['target', {
            code: 'target',
            name: 'Target',
            equiv1: '',
            equiv2: '',
            treasureClass: 0,
            rarity: 0,
            maxSock1: 0,
            maxSock25: 0,
            maxSock40: 0,
            magic: false,
            rare: false,
            normal: false,
            charm: false,
            gem: false,
            staffMods: '',
            body: false,
            bodyLoc1: '',
            bodyLoc2: '',
            beltable: false,
            class: '',
          }],
        ]),
      }

      // Should find direct parent
      expect(isA('cycA', 'cycB', cyclicTable)).toBe(true)
      expect(isA('cycB', 'cycA', cyclicTable)).toBe(true)

      // Should safely terminate and return false when target is not reached
      expect(isA('cycA', 'target', cyclicTable)).toBe(false)
      expect(isA('cycB', 'target', cyclicTable)).toBe(false)
    })
  })
})

/**
 * Creates a minimal fallback D2Table for environments where MPQ is missing.
 */
function createMinimalFallbackTable(): D2Table {
  const header = [
    'ItemType', 'Code', 'Equiv1', 'Equiv2', 'Repair', 'Body',
    'BodyLoc1', 'BodyLoc2', 'Shoots', 'Quiver', 'Throwable', 'Reload',
    'ReEquip', 'AutoStack', 'Magic', 'Rare', 'Normal', 'Charm',
    'Gem', 'Beltable', 'MaxSock1', 'MaxSock25', 'MaxSock40', 'TreasureClass',
    'Rarity', 'StaffMods', 'CostFormula', 'Class', 'VarInvGfx', 'InvGfx1',
    'InvGfx2', 'InvGfx3', 'InvGfx4', 'InvGfx5', 'InvGfx6', 'StorePage',
    '*eol',
  ]

  // Filtered rows + key types
  const rows: string[][] = [
    // 0, 1: None placeholders
    ['None', '', '', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '0'],
    ['None', '', '', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '0'],
    ['Shield', 'shie', 'shld', '', '1', '1', 'rarm', 'larm', '', '', '', '', '', '', '', '1', '', '', '', '', '3', '3', '4', '0', '3', '', '', '', '', '', '', '', '', '', '', 'armo', '0'],
    ['Armor', 'tors', 'armo', '', '1', '1', 'tors', 'tors', '', '', '', '', '', '', '', '1', '', '', '', '', '3', '4', '6', '0', '3', '', '', '', '', '', '', '', '', '', '', 'armo', '0'],
    ['Gold', 'gold', 'misc', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '1', '', '', '', '0', '0', '0', '0', '3', '', '', '', '', '', '', '', '', '', '', 'misc', '0'],
    // 14: Not Used placeholder
    ['Not Used', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '3', '', '', '', '', '', '', '', '', '', '', '', '0'],
    ['Scepter', 'scep', 'rod', '', '1', '1', 'rarm', 'larm', '', '', '', '', '', '', '', '1', '', '', '', '', '3', '5', '6', '0', '1', 'pal', '', '', '', '', '', '', '', '', '', 'weap', '0'],
    ['Wand', 'wand', 'rod', '', '1', '1', 'rarm', 'larm', '', '', '', '', '', '', '', '1', '', '', '', '', '2', '2', '2', '0', '1', 'nec', '', '', '', '', '', '', '', '', '', 'weap', '0'],
    ['Staff', 'staf', 'rod', '', '1', '1', 'rarm', 'larm', '', '', '', '', '', '', '', '1', '', '', '', '', '5', '6', '6', '0', '1', 'sor', '', '', '', '', '', '', '', '', '', 'weap', '0'],
    ['Bow', 'bow', 'miss', '', '1', '1', 'rarm', 'larm', '', '', '', '', '', '', '', '1', '', '', '', '', '3', '4', '6', '1', '3', '', '', '', '', '', '', '', '', '', '', 'weap', '0'],
    ['Weapon', 'weap', '', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '0', '0', '1', '3', '', '', '', '', '', '', '', '', '', '', 'weap', '0'],
    ['Melee Weapon', 'mele', 'weap', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '0', '0', '1', '3', '', '', '', '', '', '', '', '', '', '', 'weap', '0'],
    ['Missile Weapon', 'miss', 'weap', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '0', '0', '0', '3', '', '', '', '', '', '', '', '', '', '', 'weap', '0'],
    ['Thrown Weapon', 'thro', 'weap', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '0', '0', '0', '3', '', '', '', '', '', '', '', '', '', '', 'weap', '0'],
    ['Combo Weapon', 'comb', 'mele', 'thro', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '0', '0', '0', '3', '', '', '', '', '', '', '', '', '', '', 'weap', '0'],
    ['Any Armor', 'armo', '', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '0', '0', '1', '3', '', '', '', '', '', '', '', '', '', '', 'armo', '0'],
    ['Any Shield', 'shld', 'armo', 'seco', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '0', '0', '0', '3', '', '', '', '', '', '', '', '', '', '', 'armo', '0'],
    ['Second Hand', 'seco', '', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '0', '0', '0', '3', '', '', '', '', '', '', '', '', '', '', 'misc', '0'],
    ['Staves And Rods', 'rod', 'blun', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '0', '0', '0', '3', '', '', '', '', '', '', '', '', '', '', 'weap', '0'],
    ['Blunt', 'blun', 'mele', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '0', '0', '0', '3', '', '', '', '', '', '', '', '', '', '', 'weap', '0'],
    // 58: Expansion separator
    ['Expansion', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0'],
    ['Class Specific', 'clas', '', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '0', '0', '0', '0', '3', '', '', '', '', '', '', '', '', '', '', 'misc', '0'],
    ['Amazon Item', 'amaz', 'clas', '', '0', '0', '', '', '', '', '', '', '', '', '', '1', '', '', '', '', '0', '0', '0', '0', '1', '', '', 'ama', '', '', '', '', '', '', '', 'misc', '0'],
    ['Barbarian Item', 'barb', 'clas', '', '0', '0', '', '', '', '', '', '', '', '', '', '1', '', '', '', '', '0', '0', '0', '0', '1', '', '', 'bar', '', '', '', '', '', '', '', 'misc', '0'],
    ['Potion', 'poti', 'misc', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '', '1', '0', '0', '0', '0', '3', '', '', '', '', '', '', '', '', '', '', 'misc', '0'],
    ['Charm', 'char', 'misc', '', '0', '0', '', '', '', '', '', '', '', '', '1', '', '', '1', '', '', '0', '0', '0', '0', '3', '', '', '', '', '', '', '', '', '', '', 'misc', '0'],
    ['Gem', 'gem', 'sock', '', '0', '0', '', '', '', '', '', '', '', '', '', '', '', '', '1', '', '0', '0', '0', '0', '3', '', '', '', '', '', '', '', '', '', '', 'misc', '0'],
    ['Amazon Bow', 'abow', 'bow', 'amaz', '1', '1', 'rarm', 'larm', '', '', '', '', '', '', '', '1', '', '', '', '', '3', '4', '5', '1', '1', '', '', 'ama', '', '', '', '', '', '', '', 'weap', '0'],
    ['Throwing Knife', 'tkni', 'comb', 'knif', '1', '1', 'rarm', 'larm', '', '', '1', '1', '1', '1', '', '1', '', '', '', '', '0', '0', '0', '0', '3', '', '', '', '', '', '', '', '', '', '', 'weap', '0'],
    ['Knife', 'knif', 'mele', '', '1', '1', 'rarm', 'larm', '', '', '', '', '', '', '', '1', '', '', '', '', '2', '2', '3', '0', '3', '', '', '', '', '', '', '', '', '', '', 'weap', '0'],
  ]

  return { header, rows }
}
