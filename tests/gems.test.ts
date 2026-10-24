import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import type { D2Table } from '../src/common/world/acts.ts'
import { parseTable, cell } from '../src/common/world/acts.ts'
import {
  parseGemsTable,
  loadGems,
  getGemModifiers,
  getMaxSockets,
  parseParam,
  parseNumber,
  GEMS_TABLE_PATH,
  type GemTable,
  type Gem,
} from '../src/common/items/gems.ts'
import {
  loadItemTypes,
  isA,
  type ItemTypeTable,
  type ItemTypeDefinition,
} from '../src/common/items/item-types.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq') && fs.existsSync('samples/d2/Patch_D2.mpq')

/**
 * Minimal mock D2Table containing Chipped Amethyst, Expansion row, and El Rune.
 */
function createMinimalMockGemsTable(): D2Table {
  const header = [
    'name', 'letter', 'transform', 'code', 'nummods',
    'weaponMod1Code', 'weaponMod1Param', 'weaponMod1Min', 'weaponMod1Max',
    'weaponMod2Code', 'weaponMod2Param', 'weaponMod2Min', 'weaponMod2Max',
    'weaponMod3Code', 'weaponMod3Param', 'weaponMod3Min', 'weaponMod3Max',
    'helmMod1Code', 'helmMod1Param', 'helmMod1Min', 'helmMod1Max',
    'helmMod2Code', 'helmMod2Param', 'helmMod2Min', 'helmMod2Max',
    'helmMod3Code', 'helmMod3Param', 'helmMod3Min', 'helmMod3Max',
    'shieldMod1Code', 'shieldMod1Param', 'shieldMod1Min', 'shieldMod1Max',
    'shieldMod2Code', 'shieldMod2Param', 'shieldMod2Min', 'shieldMod2Max',
    'shieldMod3Code', 'shieldMod3Param', 'shieldMod3Min', 'shieldMod3Max',
  ]

  const rows: string[][] = [
    // 0: Chipped Amethyst (gcv)
    [
      'Chipped Amethyst', '', '18', 'gcv', '3',
      'att', '0', '40', '40',
      '', '', '', '',
      '', '0', '0', '0',
      'str', '0', '3', '3',
      '', '0', '0', '0',
      '', '0', '0', '0',
      'ac', '0', '8', '8',
      '', '0', '0', '0',
      '', '0', '0', '0',
    ],
    // 1: Expansion row (separator to be filtered out)
    [
      'Expansion', '', '', '', '',
      '', '', '', '',
      '', '', '', '',
      '', '', '', '',
      '', '', '', '',
      '', '', '', '',
      '', '', '', '',
      '', '', '', '',
      '', '', '', '',
      '', '', '', '',
    ],
    // 2: El Rune (r01)
    [
      'El Rune', 'El', '18', 'r01', '1',
      'light', '', '1', '1',
      'att', '', '50', '50',
      '', '', '', '',
      'light', '', '1', '1',
      'ac', '', '15', '15',
      '', '', '', '',
      'light', '', '1', '1',
      'ac', '', '15', '15',
      '', '', '', '',
    ],
  ]

  return { header, rows }
}

describe('Gems and Runes Socketing (Issue #106)', () => {
  describe('Helper functions: parseParam & parseNumber', () => {
    it('parses empty and whitespace strings as undefined in parseParam', () => {
      expect(parseParam(undefined)).toBeUndefined()
      expect(parseParam('')).toBeUndefined()
      expect(parseParam('   ')).toBeUndefined()
      expect(parseParam('\t')).toBeUndefined()
    })

    it('parses numeric strings as numbers in parseParam', () => {
      expect(parseParam('0')).toBe(0)
      expect(parseParam('125')).toBe(125)
      expect(parseParam('-20')).toBe(-20)
      expect(typeof parseParam('125')).toBe('number')
    })

    it('preserves non-numeric strings in parseParam', () => {
      expect(parseParam('Oak Sage')).toBe('Oak Sage')
      expect(parseParam('cold')).toBe('cold')
    })

    it('parses numbers with fallback in parseNumber', () => {
      expect(parseNumber(undefined)).toBe(0)
      expect(parseNumber('')).toBe(0)
      expect(parseNumber('', 10)).toBe(10)
      expect(parseNumber('40')).toBe(40)
      expect(parseNumber('-15')).toBe(-15)
      expect(parseNumber('invalid', 99)).toBe(99)
    })
  })

  describe('Standalone Table Parsing', () => {
    it('parses D2Table and filters Expansion row', () => {
      const mockTable = createMinimalMockGemsTable()
      const gemTable = parseGemsTable(mockTable)

      expect(gemTable.length).toBe(2)
      expect(gemTable.all.length).toBe(2)

      const gcv = gemTable.get('gcv')
      expect(gcv).toBeDefined()
      expect(gcv?.name).toBe('Chipped Amethyst')
      expect(gcv?.isGem).toBe(true)
      expect(gcv?.isRune).toBe(false)
      expect(gcv?.transform).toBe(18)
      expect(gcv?.nummods).toBe(3)

      expect(gcv?.weaponMods).toHaveLength(1)
      expect(gcv?.weaponMods[0]).toEqual({ code: 'att', param: 0, par: 0, min: 40, max: 40 })

      expect(gcv?.helmMods).toHaveLength(1)
      expect(gcv?.helmMods[0]).toEqual({ code: 'str', param: 0, par: 0, min: 3, max: 3 })

      expect(gcv?.shieldMods).toHaveLength(1)
      expect(gcv?.shieldMods[0]).toEqual({ code: 'ac', param: 0, par: 0, min: 8, max: 8 })

      const r01 = gemTable.get('r01')
      expect(r01).toBeDefined()
      expect(r01?.name).toBe('El Rune')
      expect(r01?.letter).toBe('El')
      expect(r01?.isGem).toBe(false)
      expect(r01?.isRune).toBe(true)
      expect(r01?.weaponMods).toHaveLength(2)
    })

    it('supports TSV string and Uint8Array parsing', () => {
      const tsv = [
        'name\tletter\ttransform\tcode\tnummods\tweaponMod1Code\tweaponMod1Param\tweaponMod1Min\tweaponMod1Max\thelmMod1Code\thelmMod1Param\thelmMod1Min\thelmMod1Max\tshieldMod1Code\tshieldMod1Param\tshieldMod1Min\tshieldMod1Max',
        'Chipped Ruby\t\t1\tgcr\t3\tfire-min\t0\t3\t3\thp\t0\t10\t10\tres-fire\t0\t12\t12',
      ].join('\n')

      const fromString = parseGemsTable(tsv)
      expect(fromString.length).toBe(1)
      expect(fromString.get('gcr')?.name).toBe('Chipped Ruby')

      const fromBytes = parseGemsTable(new TextEncoder().encode(tsv))
      expect(fromBytes.length).toBe(1)
      expect(fromBytes.get('gcr')?.name).toBe('Chipped Ruby')
    })

    it('supports case-insensitive code and name lookup, iteration, and indexing', () => {
      const mockTable = createMinimalMockGemsTable()
      const table = parseGemsTable(mockTable)

      expect(table.get('GCV')?.name).toBe('Chipped Amethyst')
      expect(table.get('chipped amethyst')?.code).toBe('gcv')
      expect(table.byCode.get('R01')?.name).toBe('El Rune')
      expect(table.byName.get('EL RUNE')?.code).toBe('r01')

      const codes = [...table].map(g => g.code)
      expect(codes).toEqual(['gcv', 'r01'])

      expect(table[0]?.code).toBe('gcv')
      expect(table[1]?.code).toBe('r01')
      expect(table[2]).toBeUndefined()
    })
  })

  describe('Socket Modifier Dispatch (getGemModifiers)', () => {
    const mockTable = createMinimalMockGemsTable()
    const gemTable = parseGemsTable(mockTable)

    const mockIsA = (child: string, parent: string): boolean => {
      if (child === 'swor' && parent === 'weap') return true
      if (child === 'axe' && parent === 'weap') return true
      if (child === 'phlm' && parent === 'helm') return true
      if (child === 'circ' && parent === 'helm') return true
      if (child === 'ashd' && parent === 'shld') return true
      if (child === 'head' && parent === 'shld') return true
      return false
    }

    it('dispatches weaponMod1..3 for weapons', () => {
      const sworMods = getGemModifiers('gcv', 'swor', mockIsA, gemTable)
      expect(sworMods).toHaveLength(1)
      expect(sworMods[0]?.code).toBe('att')
      expect(sworMods[0]?.min).toBe(40)
      expect(sworMods[0]?.max).toBe(40)

      const swordLiteralMods = getGemModifiers('gcv', 'sword', mockIsA, gemTable)
      expect(swordLiteralMods).toEqual(sworMods)

      const axeMods = getGemModifiers('gcv', 'axe', mockIsA, gemTable)
      expect(axeMods).toEqual(sworMods)
    })

    it('dispatches helmMod1..3 for helmets AND body armor (tors)', () => {
      // Direct helm
      const helmMods = getGemModifiers('gcv', 'helm', mockIsA, gemTable)
      expect(helmMods).toHaveLength(1)
      expect(helmMods[0]?.code).toBe('str')
      expect(helmMods[0]?.min).toBe(3)
      expect(helmMods[0]?.max).toBe(3)

      // Primal helm (barbarian)
      const phlmMods = getGemModifiers('gcv', 'phlm', mockIsA, gemTable)
      expect(phlmMods).toEqual(helmMods)

      // CRITICAL: Body armor ('tors') uses helm modifiers!
      const torsoMods = getGemModifiers('gcv', 'tors', mockIsA, gemTable)
      expect(torsoMods).toHaveLength(1)
      expect(torsoMods[0]?.code).toBe('str')
      expect(torsoMods[0]?.min).toBe(3)
      expect(torsoMods[0]?.max).toBe(3)

      // Literal 'torso'
      const torsoLiteralMods = getGemModifiers('gcv', 'torso', mockIsA, gemTable)
      expect(torsoLiteralMods).toEqual(helmMods)
    })

    it('dispatches shieldMod1..3 for shields', () => {
      const shieldMods = getGemModifiers('gcv', 'shie', mockIsA, gemTable)
      expect(shieldMods).toHaveLength(1)
      expect(shieldMods[0]?.code).toBe('ac')
      expect(shieldMods[0]?.min).toBe(8)
      expect(shieldMods[0]?.max).toBe(8)

      const shldMods = getGemModifiers('gcv', 'shld', mockIsA, gemTable)
      expect(shldMods).toEqual(shieldMods)

      const ashdMods = getGemModifiers('gcv', 'ashd', mockIsA, gemTable)
      expect(ashdMods).toEqual(shieldMods)

      const headMods = getGemModifiers('gcv', 'head', mockIsA, gemTable)
      expect(headMods).toEqual(shieldMods)
    })

    it('verifies Chipped Amethyst (gcv): att 40 on sword, str 3 on helm, str 3 on torso, ac 8 on shield', () => {
      const sword = getGemModifiers('gcv', 'swor', mockIsA, gemTable)
      expect(sword).toEqual([
        expect.objectContaining({ code: 'att', min: 40, max: 40 }),
      ])

      const helm = getGemModifiers('gcv', 'helm', mockIsA, gemTable)
      expect(helm).toEqual([
        expect.objectContaining({ code: 'str', min: 3, max: 3 }),
      ])

      const torso = getGemModifiers('gcv', 'tors', mockIsA, gemTable)
      expect(torso).toEqual([
        expect.objectContaining({ code: 'str', min: 3, max: 3 }),
      ])

      const shield = getGemModifiers('gcv', 'shie', mockIsA, gemTable)
      expect(shield).toEqual([
        expect.objectContaining({ code: 'ac', min: 8, max: 8 }),
      ])
    })

    it('returns empty array for non-socketable item types or unknown gems', () => {
      expect(getGemModifiers('gcv', 'boot', mockIsA, gemTable)).toEqual([])
      expect(getGemModifiers('gcv', 'glov', mockIsA, gemTable)).toEqual([])
      expect(getGemModifiers('gcv', 'belt', mockIsA, gemTable)).toEqual([])
      expect(getGemModifiers('gcv', 'ring', mockIsA, gemTable)).toEqual([])
      expect(getGemModifiers('unknown', 'swor', mockIsA, gemTable)).toEqual([])
    })
  })

  describe('Max Sockets Calculation (getMaxSockets)', () => {
    const swordType: ItemTypeDefinition = {
      code: 'swor',
      name: 'Sword',
      equiv1: 'weap',
      equiv2: '',
      treasureClass: 0,
      rarity: 0,
      maxSock1: 3,
      maxSock25: 4,
      maxSock40: 6,
      magic: false,
      rare: false,
      normal: false,
      charm: false,
      gem: false,
      staffMods: '',
      body: true,
      bodyLoc1: 'rarm',
      bodyLoc2: 'larm',
      beltable: false,
      class: '',
    }

    const helmType: ItemTypeDefinition = {
      code: 'helm',
      name: 'Helm',
      equiv1: 'armo',
      equiv2: '',
      treasureClass: 0,
      rarity: 0,
      maxSock1: 2,
      maxSock25: 2,
      maxSock40: 3,
      magic: false,
      rare: false,
      normal: false,
      charm: false,
      gem: false,
      staffMods: '',
      body: true,
      bodyLoc1: 'head',
      bodyLoc2: '',
      beltable: false,
      class: '',
    }

    it('calculates max sockets correctly across ilvl tiers (ilvl 24, 25, 39, 40)', () => {
      // Crystal Sword (base gemsockets = 6)
      expect(getMaxSockets(6, swordType, 1)).toBe(3)
      expect(getMaxSockets(6, swordType, 24)).toBe(3)
      expect(getMaxSockets(6, swordType, 25)).toBe(4)
      expect(getMaxSockets(6, swordType, 39)).toBe(4)
      expect(getMaxSockets(6, swordType, 40)).toBe(6)
      expect(getMaxSockets(6, swordType, 85)).toBe(6)

      // Crown (base gemsockets = 3)
      expect(getMaxSockets(3, helmType, 1)).toBe(2)
      expect(getMaxSockets(3, helmType, 24)).toBe(2)
      expect(getMaxSockets(3, helmType, 25)).toBe(2)
      expect(getMaxSockets(3, helmType, 39)).toBe(2)
      expect(getMaxSockets(3, helmType, 40)).toBe(3)
    })

    it('correctly caps allowed sockets by base item gemsockets', () => {
      // Short Sword (base gemsockets = 2)
      expect(getMaxSockets(2, swordType, 24)).toBe(2)
      expect(getMaxSockets(2, swordType, 25)).toBe(2)
      expect(getMaxSockets(2, swordType, 40)).toBe(2)

      // Cap (base gemsockets = 2, helm maxSock40 = 3)
      expect(getMaxSockets(2, helmType, 40)).toBe(2)
    })

    it('returns 0 for base gemsockets <= 0', () => {
      expect(getMaxSockets(0, swordType, 50)).toBe(0)
      expect(getMaxSockets(-1, swordType, 50)).toBe(0)
    })
  })

  describe('Integration with samples/d2 MPQs', () => {
    let rawTable: D2Table
    let gemTable: GemTable
    let itemTypes: ItemTypeTable

    beforeAll(async () => {
      if (!hasD2) return

      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }

      const bytes = await archives.read(GEMS_TABLE_PATH)
      rawTable = parseTable(bytes)
      gemTable = await loadGems(archives)
      itemTypes = await loadItemTypes(archives)
    })

    it('verifies GEMS_TABLE_PATH is data\\global\\excel\\Gems.txt', () => {
      expect(GEMS_TABLE_PATH).toBe('data\\global\\excel\\Gems.txt')
    })

    it('parses exactly 68 rows from 69 raw rows in 1.13c Gems.txt', () => {
      if (!hasD2) return

      expect(rawTable.rows.length).toBe(69)
      expect(rawTable.header.length).toBe(41)

      // Expansion separator row at index 35
      const expansionRow = rawTable.rows[35]!
      expect(cell(rawTable, expansionRow, 'name')).toBe('Expansion')
      expect(cell(rawTable, expansionRow, 'code')).toBe('')

      // Exactly 68 valid rows parsed
      expect(gemTable.length).toBe(68)
      expect(gemTable.all.length).toBe(68)
      expect(gemTable.byCode.size).toBe(68)
    })

    it('verifies exactly 35 gems and 33 runes', () => {
      if (!hasD2) return

      expect(gemTable.gems.length).toBe(35)
      expect(gemTable.runes.length).toBe(33)

      expect(gemTable.gems.every(g => g.isGem && !g.isRune)).toBe(true)
      expect(gemTable.runes.every(r => r.isRune && !r.isGem)).toBe(true)

      // First gem is Chipped Amethyst (gcv), last gem is Perfect Skull (skz)
      expect(gemTable.gems[0]?.code).toBe('gcv')
      expect(gemTable.gems[0]?.name).toBe('Chipped Amethyst')
      expect(gemTable.gems[34]?.code).toBe('skz')
      expect(gemTable.gems[34]?.name).toBe('Perfect Skull')

      // First rune is El Rune (r01), last rune is Zod Rune (r33)
      expect(gemTable.runes[0]?.code).toBe('r01')
      expect(gemTable.runes[0]?.name).toBe('El Rune')
      expect(gemTable.runes[32]?.code).toBe('r33')
      expect(gemTable.runes[32]?.name).toBe('Zod Rune')
    })

    it('verifies Chipped Amethyst (gcv) modifier values against MPQ data', () => {
      if (!hasD2) return

      const gcv = gemTable.get('gcv')!
      expect(gcv).toBeDefined()
      expect(gcv.name).toBe('Chipped Amethyst')

      // Weapon: att 40
      expect(gcv.weaponMods).toEqual([
        expect.objectContaining({ code: 'att', min: 40, max: 40 }),
      ])

      // Helm: str 3
      expect(gcv.helmMods).toEqual([
        expect.objectContaining({ code: 'str', min: 3, max: 3 }),
      ])

      // Shield: ac 8
      expect(gcv.shieldMods).toEqual([
        expect.objectContaining({ code: 'ac', min: 8, max: 8 }),
      ])
    })

    it('verifies integration modifier dispatch using real ItemTypes isA', () => {
      if (!hasD2) return

      const isAPred = (type: string, target: string) => isA(type, target, itemTypes)

      // Sword -> weaponMods
      const swordMods = getGemModifiers('gcv', 'swor', isAPred, gemTable)
      expect(swordMods).toEqual([
        expect.objectContaining({ code: 'att', min: 40, max: 40 }),
      ])

      // Helm -> helmMods
      const helmMods = getGemModifiers('gcv', 'helm', isAPred, gemTable)
      expect(helmMods).toEqual([
        expect.objectContaining({ code: 'str', min: 3, max: 3 }),
      ])

      // Torso -> helmMods (CRITICAL: body armor gets helm mods)
      const torsoMods = getGemModifiers('gcv', 'tors', isAPred, gemTable)
      expect(torsoMods).toEqual([
        expect.objectContaining({ code: 'str', min: 3, max: 3 }),
      ])

      // Shield -> shieldMods
      const shieldMods = getGemModifiers('gcv', 'shie', isAPred, gemTable)
      expect(shieldMods).toEqual([
        expect.objectContaining({ code: 'ac', min: 8, max: 8 }),
      ])
    })

    it('verifies runes with duration params (Tal Rune r07, Thul Rune r10)', () => {
      if (!hasD2) return

      const isAPred = (type: string, target: string) => isA(type, target, itemTypes)

      // Tal Rune: poison length 125 frames (5s) on weapon
      const talWeapon = getGemModifiers('r07', 'swor', isAPred, gemTable)
      expect(talWeapon).toEqual([
        expect.objectContaining({ code: 'dmg-pois', param: 125, min: 154, max: 154 }),
      ])

      // Thul Rune: cold length 75 frames (3s) on weapon
      const thulWeapon = getGemModifiers('r10', 'swor', isAPred, gemTable)
      expect(thulWeapon).toEqual([
        expect.objectContaining({ code: 'dmg-cold', param: 75, min: 3, max: 14 }),
      ])

      // Tal Rune on shield: res-pois 35
      const talShield = getGemModifiers('r07', 'shie', isAPred, gemTable)
      expect(talShield).toEqual([
        expect.objectContaining({ code: 'res-pois', min: 35, max: 35 }),
      ])
    })

    it('verifies real ItemTypes socket tiers with getMaxSockets', () => {
      if (!hasD2) return

      const sworDef = itemTypes.byCode.get('swor')!
      expect(sworDef).toBeDefined()
      expect(sworDef.maxSock1).toBe(3)
      expect(sworDef.maxSock25).toBe(4)
      expect(sworDef.maxSock40).toBe(6)

      // Crystal sword (base gemsockets = 6)
      expect(getMaxSockets(6, sworDef, 24)).toBe(3)
      expect(getMaxSockets(6, sworDef, 25)).toBe(4)
      expect(getMaxSockets(6, sworDef, 39)).toBe(4)
      expect(getMaxSockets(6, sworDef, 40)).toBe(6)

      const helmDef = itemTypes.byCode.get('helm')!
      expect(helmDef).toBeDefined()
      expect(helmDef.maxSock1).toBe(2)
      expect(helmDef.maxSock25).toBe(2)
      expect(helmDef.maxSock40).toBe(3)

      // Crown (base gemsockets = 3)
      expect(getMaxSockets(3, helmDef, 24)).toBe(2)
      expect(getMaxSockets(3, helmDef, 25)).toBe(2)
      expect(getMaxSockets(3, helmDef, 39)).toBe(2)
      expect(getMaxSockets(3, helmDef, 40)).toBe(3)
    })
  })
})
