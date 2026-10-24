/**
 * Unit tests for rare prefix and suffix tables (RarePrefix.txt & RareSuffix.txt).
 *
 * Gold standard reference: 1.13c MPQ data\\global\\excel\\RarePrefix.txt (46 rows)
 * and RareSuffix.txt (155 rows) from d2exp.mpq.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import {
  loadRareNames,
  parseRareNamesTable,
  isRareNameEligible,
  getEligibleRarePrefixes,
  getEligibleRareSuffixes,
  CANONICAL_RARE_PREFIXES,
  CANONICAL_RARE_SUFFIXES,
  CANONICAL_RARE_PREFIXES_TABLE,
  CANONICAL_RARE_SUFFIXES_TABLE,
  RARE_PREFIX_TABLE_PATH,
  RARE_SUFFIX_TABLE_PATH,
} from '../src/common/items/rare-names.ts'
import type { RareNameEntry, RareNameTable } from '../src/common/items/rare-names.ts'
import { parseTable } from '../src/common/world/acts.ts'
import type { D2Table } from '../src/common/world/acts.ts'

const hasD2 = fs.existsSync('samples/d2/d2exp.mpq')

describe('Rare Names Tables (Issue #95)', () => {
  describe('Row and column counts', () => {
    it('verifies 46 prefixes and 155 suffixes are parsed from canonical tables', () => {
      expect(CANONICAL_RARE_PREFIXES.entries.length).toBe(46)
      expect(CANONICAL_RARE_PREFIXES.length).toBe(46)
      expect(CANONICAL_RARE_PREFIXES_TABLE.rows.length).toBe(46)

      expect(CANONICAL_RARE_SUFFIXES.entries.length).toBe(155)
      expect(CANONICAL_RARE_SUFFIXES.length).toBe(155)
      expect(CANONICAL_RARE_SUFFIXES_TABLE.rows.length).toBe(155)
    })

    it('verifies 16 columns in table header', () => {
      const expectedColumns = [
        'name',
        'version',
        'itype1',
        'itype2',
        'itype3',
        'itype4',
        'itype5',
        'itype6',
        'itype7',
        'etype1',
        'etype2',
        'etype3',
        'etype4',
        'add',
        'multiply',
        'divide',
      ]
      expect(CANONICAL_RARE_PREFIXES_TABLE.header).toEqual(expectedColumns)
      expect(CANONICAL_RARE_SUFFIXES_TABLE.header).toEqual(expectedColumns)
    })
  })

  describe('8-bit index preservation (.d2s character save alignment)', () => {
    it('verifies all prefix indices fit in 8 bits (0..255) and match 0-based row order', () => {
      expect(CANONICAL_RARE_PREFIXES.entries.length).toBeLessThanOrEqual(256)

      CANONICAL_RARE_PREFIXES.entries.forEach((entry, idx) => {
        expect(entry.index).toBe(idx)
        expect(entry.index).toBeGreaterThanOrEqual(0)
        expect(entry.index).toBeLessThanOrEqual(255)
        expect(CANONICAL_RARE_PREFIXES.byIndex(idx)).toBe(entry)
      })

      // Spot check specific known prefixes
      expect(CANONICAL_RARE_PREFIXES.entries[0]?.name).toBe('Beast')
      expect(CANONICAL_RARE_PREFIXES.entries[43]?.name).toBe('Warp')
      expect(CANONICAL_RARE_PREFIXES.entries[44]?.name).toBe('Rift')
      expect(CANONICAL_RARE_PREFIXES.entries[45]?.name).toBe('Corruption')
    })

    it('verifies all suffix indices fit in 8 bits (0..255) and match 0-based row order', () => {
      expect(CANONICAL_RARE_SUFFIXES.entries.length).toBeLessThanOrEqual(256)

      CANONICAL_RARE_SUFFIXES.entries.forEach((entry, idx) => {
        expect(entry.index).toBe(idx)
        expect(entry.index).toBeGreaterThanOrEqual(0)
        expect(entry.index).toBeLessThanOrEqual(255)
        expect(CANONICAL_RARE_SUFFIXES.byIndex(idx)).toBe(entry)
      })

      // Spot check specific known suffixes
      expect(CANONICAL_RARE_SUFFIXES.entries[0]?.name).toBe('bite')
      expect(CANONICAL_RARE_SUFFIXES.entries[1]?.name).toBe('scratch')
      expect(CANONICAL_RARE_SUFFIXES.entries[154]?.name).toBe('flange')
    })
  })

  describe('Wildcard items (empty itypes match any type)', () => {
    it('verifies Warp (index 43) and Rift (index 44) have empty itypes', () => {
      const warp = CANONICAL_RARE_PREFIXES.byIndex(43)!
      expect(warp).toBeDefined()
      expect(warp.name).toBe('Warp')
      expect(warp.itypes).toEqual([])
      expect(warp.etypes).toEqual([])

      const rift = CANONICAL_RARE_PREFIXES.byIndex(44)!
      expect(rift).toBeDefined()
      expect(rift.name).toBe('Rift')
      expect(rift.itypes).toEqual([])
      expect(rift.etypes).toEqual([])
    })

    it('verifies wildcard entries match any item type', () => {
      const warp = CANONICAL_RARE_PREFIXES.byIndex(43)!
      const testTypes = ['ring', 'amul', 'swor', 'helm', 'boot', 'tors', 'shld', 'wand', 'bow', 'custom_type']

      for (const typeCode of testTypes) {
        expect(isRareNameEligible(warp, typeCode)).toBe(true)
      }

      const rift = CANONICAL_RARE_PREFIXES.byIndex(44)!
      for (const typeCode of testTypes) {
        expect(isRareNameEligible(rift, typeCode)).toBe(true)
      }
    })

    it('verifies synthetic wildcard entry matches everything unless excluded', () => {
      const wildcardWithExclusion: RareNameEntry = {
        index: 0,
        name: 'Wild',
        version: 0,
        itypes: [],
        etypes: ['bow'],
        add: 0,
        multiply: 0,
        divide: 0,
      }

      expect(isRareNameEligible(wildcardWithExclusion, 'swor')).toBe(true)
      expect(isRareNameEligible(wildcardWithExclusion, 'ring')).toBe(true)
      expect(isRareNameEligible(wildcardWithExclusion, 'bow')).toBe(false)
    })
  })

  describe('Specific items (e.g. itype1=ring, itype2=amul)', () => {
    it('verifies jewelry-only prefixes match only rings and amulets', () => {
      // In RarePrefix.txt:
      // Row 39: Entropy (ring, amul)
      // Row 40: Chaos (ring, amul)
      // Row 45: Corruption (ring, amul)
      const jewelryPrefixes = [
        CANONICAL_RARE_PREFIXES.byIndex(39)!,
        CANONICAL_RARE_PREFIXES.byIndex(40)!,
        CANONICAL_RARE_PREFIXES.byIndex(45)!,
      ]

      for (const entry of jewelryPrefixes) {
        expect(entry.itypes).toEqual(['ring', 'amul'])
        expect(entry.etypes).toEqual([])

        // Must match ring and amul
        expect(isRareNameEligible(entry, 'ring')).toBe(true)
        expect(isRareNameEligible(entry, 'amul')).toBe(true)

        // Must NOT match other item types
        expect(isRareNameEligible(entry, 'swor')).toBe(false)
        expect(isRareNameEligible(entry, 'helm')).toBe(false)
        expect(isRareNameEligible(entry, 'tors')).toBe(false)
        expect(isRareNameEligible(entry, 'boot')).toBe(false)
        expect(isRareNameEligible(entry, 'weap')).toBe(false)
        expect(isRareNameEligible(entry, 'armo')).toBe(false)
      }
    })

    it('verifies weapon-only or rod-only prefixes match their respective types', () => {
      // Row 22: Empyrion (rod)
      const empyrion = CANONICAL_RARE_PREFIXES.byIndex(22)!
      expect(empyrion.name).toBe('Empyrion')
      expect(empyrion.itypes).toEqual(['rod'])
      expect(isRareNameEligible(empyrion, 'rod')).toBe(true)
      expect(isRareNameEligible(empyrion, 'ring')).toBe(false)
      expect(isRareNameEligible(empyrion, 'swor')).toBe(false)

      // Row 42: Rule (rod)
      const rule = CANONICAL_RARE_PREFIXES.byIndex(42)!
      expect(rule.name).toBe('Rule')
      expect(rule.itypes).toEqual(['rod'])
      expect(isRareNameEligible(rule, 'rod')).toBe(true)
      expect(isRareNameEligible(rule, 'ring')).toBe(false)

      // Row 41: Order (ring, amul, scep)
      const order = CANONICAL_RARE_PREFIXES.byIndex(41)!
      expect(order.name).toBe('Order')
      expect(order.itypes).toEqual(['ring', 'amul', 'scep'])
      expect(isRareNameEligible(order, 'ring')).toBe(true)
      expect(isRareNameEligible(order, 'amul')).toBe(true)
      expect(isRareNameEligible(order, 'scep')).toBe(true)
      expect(isRareNameEligible(order, 'swor')).toBe(false)
      expect(isRareNameEligible(order, 'helm')).toBe(false)
    })
  })

  describe('Item type inheritance with isA', () => {
    it('uses isA callback to resolve type hierarchy', () => {
      // Beast: armo, weap, misc
      const beast = CANONICAL_RARE_PREFIXES.byIndex(0)!

      // A hierarchy where sword is a weapon and crystal sword is a sword
      const isA = (type: string, target: string): boolean => {
        if (type === target) return true
        if (type === 'swor' && target === 'weap') return true
        if (type === 'crs' && target === 'swor') return true
        if (type === 'crs' && target === 'weap') return true
        return false
      }

      expect(isRareNameEligible(beast, 'weap', isA)).toBe(true)
      expect(isRareNameEligible(beast, 'swor', isA)).toBe(true)
      expect(isRareNameEligible(beast, 'crs', isA)).toBe(true)
      expect(isRareNameEligible(beast, 'ring', isA)).toBe(false)
    })

    it('respects etype exclusions with isA', () => {
      const weaponNotBow: RareNameEntry = {
        index: 0,
        name: 'MeleeOnly',
        version: 0,
        itypes: ['weap'],
        etypes: ['bow'],
        add: 0,
        multiply: 0,
        divide: 0,
      }

      const isA = (type: string, target: string): boolean => {
        if (type === target) return true
        if (type === 'swor' && target === 'weap') return true
        if (type === 'bow' && target === 'weap') return true
        return false
      }

      expect(isRareNameEligible(weaponNotBow, 'swor', isA)).toBe(true)
      // bow is a weapon, but matches excluded etype 'bow'
      expect(isRareNameEligible(weaponNotBow, 'bow', isA)).toBe(false)
    })
  })

  describe('getEligibleRarePrefixes & getEligibleRareSuffixes', () => {
    it('returns eligible prefixes for ring', () => {
      const ringPrefixes = getEligibleRarePrefixes('ring', (t, target) => t === target)
      const names = ringPrefixes.map(p => p.name)

      // Must include jewelry prefixes
      expect(names).toContain('Entropy')
      expect(names).toContain('Chaos')
      expect(names).toContain('Corruption')
      expect(names).toContain('Order')

      // Must include wildcards
      expect(names).toContain('Warp')
      expect(names).toContain('Rift')

      // Must NOT include armor/weapon-only prefixes like Bramble or Holocaust
      expect(names).not.toContain('Bramble')
      expect(names).not.toContain('Holocaust')
    })

    it('supports calling getEligibleRarePrefixes with table first or table third', () => {
      const ringPrefixes1 = getEligibleRarePrefixes(CANONICAL_RARE_PREFIXES, 'ring', (t, target) => t === target)
      const ringPrefixes2 = getEligibleRarePrefixes('ring', (t, target) => t === target, CANONICAL_RARE_PREFIXES)
      const ringPrefixes3 = getEligibleRarePrefixes('ring', (t, target) => t === target)

      expect(ringPrefixes1.map(p => p.name)).toEqual(ringPrefixes2.map(p => p.name))
      expect(ringPrefixes1.map(p => p.name)).toEqual(ringPrefixes3.map(p => p.name))
    })

    it('returns eligible suffixes for swor', () => {
      const sworSuffixes = getEligibleRareSuffixes('swor', (t, target) => t === target)
      const names = sworSuffixes.map(s => s.name)

      // Suffix 0 is 'bite', which allows swor, knif, spea, pole, axe, h2h
      expect(names).toContain('bite')
      expect(names).toContain('scratch')
      expect(names).toContain('scalpel')

      // Suffix 151 is 'stake' which allows spea, pole (not swor)
      expect(names).not.toContain('stake')
    })

    it('supports calling getEligibleRareSuffixes with table first or table third', () => {
      const sworSuffixes1 = getEligibleRareSuffixes(CANONICAL_RARE_SUFFIXES, 'swor', (t, target) => t === target)
      const sworSuffixes2 = getEligibleRareSuffixes('swor', (t, target) => t === target, CANONICAL_RARE_SUFFIXES)
      const sworSuffixes3 = getEligibleRareSuffixes('swor', (t, target) => t === target)

      expect(sworSuffixes1.map(s => s.name)).toEqual(sworSuffixes2.map(s => s.name))
      expect(sworSuffixes1.map(s => s.name)).toEqual(sworSuffixes3.map(s => s.name))
    })
  })

  describe('Lookup helpers and iterable support', () => {
    it('looks up entries by name case-insensitively', () => {
      expect(CANONICAL_RARE_PREFIXES.byName('warp')?.name).toBe('Warp')
      expect(CANONICAL_RARE_PREFIXES.byName('WARP')?.name).toBe('Warp')
      expect(CANONICAL_RARE_PREFIXES.byName('Rift')?.index).toBe(44)
      expect(CANONICAL_RARE_PREFIXES.byName('nonexistent')).toBeUndefined()

      expect(CANONICAL_RARE_SUFFIXES.byName('BITE')?.name).toBe('bite')
      expect(CANONICAL_RARE_SUFFIXES.byName('Flange')?.index).toBe(154)
    })

    it('supports iterating over RareNameTable', () => {
      let count = 0
      for (const entry of CANONICAL_RARE_PREFIXES) {
        expect(entry.name).toBeTruthy()
        count++
      }
      expect(count).toBe(46)
    })
  })

  describe.skipIf(!hasD2)('Real MPQ loading via loadRareNames (1.13c d2exp.mpq)', () => {
    let archives: MountedArchives
    let loaded: { prefixes: RareNameTable; suffixes: RareNameTable }

    beforeAll(async () => {
      archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      loaded = await loadRareNames(archives)
    })

    it('loads 46 prefixes and 155 suffixes from MPQ archives', () => {
      expect(loaded.prefixes.entries.length).toBe(46)
      expect(loaded.suffixes.entries.length).toBe(155)
    })

    it('matches the canonical table data exactly row for row', () => {
      for (let i = 0; i < 46; i++) {
        const fromMpq = loaded.prefixes.entries[i]!
        const canonical = CANONICAL_RARE_PREFIXES.entries[i]!
        expect(fromMpq.name).toBe(canonical.name)
        expect(fromMpq.version).toBe(canonical.version)
        expect(fromMpq.itypes).toEqual(canonical.itypes)
        expect(fromMpq.etypes).toEqual(canonical.etypes)
        expect(fromMpq.add).toBe(canonical.add)
        expect(fromMpq.multiply).toBe(canonical.multiply)
        expect(fromMpq.divide).toBe(canonical.divide)
      }

      for (let i = 0; i < 155; i++) {
        const fromMpq = loaded.suffixes.entries[i]!
        const canonical = CANONICAL_RARE_SUFFIXES.entries[i]!
        expect(fromMpq.name).toBe(canonical.name)
        expect(fromMpq.version).toBe(canonical.version)
        expect(fromMpq.itypes).toEqual(canonical.itypes)
        expect(fromMpq.etypes).toEqual(canonical.etypes)
        expect(fromMpq.add).toBe(canonical.add)
        expect(fromMpq.multiply).toBe(canonical.multiply)
        expect(fromMpq.divide).toBe(canonical.divide)
      }
    })
  })
})
