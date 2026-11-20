import { describe, expect, test } from 'vitest'
import * as fs from 'node:fs'
import {
  parseAutoMagicTable,
  loadAutoMagic,
  getEligibleAutoMagic,
  CANONICAL_AUTOMAGIC_TABLE,
  CANONICAL_AUTOMAGIC_TSV,
  type AutoMagicTable,
  type AutoMagicEntry,
  type IsAPredicate,
} from '../src/common/items/automagic.ts'
import { parseTable } from '../src/common/world/acts.ts'
import type { D2Table } from '../src/common/world/acts.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { fileSource } from '../src/baker/io/file-source.ts'

const MPQ_DIR = 'samples/d2'
const hasMpqs = fs.existsSync(`${MPQ_DIR}/d2exp.mpq`)

describe('AutoMagic.txt Table Structure & Parsing', () => {
  test('CANONICAL_AUTOMAGIC_TABLE loads exactly 36 rows, all spawnable=true', () => {
    expect(CANONICAL_AUTOMAGIC_TABLE.length).toBe(36)
    expect(CANONICAL_AUTOMAGIC_TABLE.entries.length).toBe(36)
    expect(CANONICAL_AUTOMAGIC_TABLE.rows.length).toBe(36)

    for (const entry of CANONICAL_AUTOMAGIC_TABLE.entries) {
      expect(entry.spawnable).toBe(true)
      expect(entry.version).toBe(100)
    }
  })

  test('Preservation of row indices 0..35 matches .d2s autoAffixId specification', () => {
    for (let index = 0; index < 36; index++) {
      const entry = CANONICAL_AUTOMAGIC_TABLE.entries[index]!
      expect(entry.id).toBe(index)
      expect(CANONICAL_AUTOMAGIC_TABLE.get(index)?.id).toBe(index)
      expect(CANONICAL_AUTOMAGIC_TABLE.byId.get(index)?.id).toBe(index)
      expect(CANONICAL_AUTOMAGIC_TABLE[index]?.id).toBe(index)
    }
  })

  test('Table header has 38 columns and does not have classspecific column', () => {
    const rawTable = parseTable(new TextEncoder().encode(CANONICAL_AUTOMAGIC_TSV.trim()))
    expect(rawTable.header.length).toBe(38)
    expect(rawTable.rows.length).toBe(36)

    // Contrast with MagicPrefix (41 columns and classspecific)
    const lowerHeaders = rawTable.header.map(h => h.toLowerCase())
    expect(lowerHeaders.includes('classspecific')).toBe(false)
    expect(lowerHeaders.includes('spawnable')).toBe(true)
    expect(lowerHeaders.includes('transformcolor')).toBe(true)
  })

  test('First entry (id: 0) is Fletcher\'s with single skilltab mod', () => {
    const first = CANONICAL_AUTOMAGIC_TABLE.get(0)!
    expect(first).toBeDefined()
    expect(first.id).toBe(0)
    expect(first.name).toBe("Fletcher's")
    expect(first.version).toBe(100)
    expect(first.spawnable).toBe(true)
    expect(first.rare).toBe(true)
    expect(first.level).toBe(1)
    expect(first.maxlevel).toBe(0)
    expect(first.levelreq).toBe(15)
    expect(first.frequency).toBe(3)
    expect(first.group).toBe(300)
    expect(first.transform).toBe(false)
    expect(first.transformColor).toBeUndefined()
    expect(first.itypes).toEqual(['armo', 'weap'])
    expect(first.etypes).toEqual([])

    expect(first.mods).toEqual([
      { code: 'skilltab', param: '0', min: 1, max: 1 },
    ])
  })

  test('Last entry (id: 35) is of Anthrax with 3 poison mods', () => {
    const last = CANONICAL_AUTOMAGIC_TABLE.get(35)!
    expect(last).toBeDefined()
    expect(last.id).toBe(35)
    expect(last.name).toBe('of Anthrax')
    expect(last.version).toBe(100)
    expect(last.spawnable).toBe(true)
    expect(last.rare).toBe(false) // cannot spawn on rare
    expect(last.level).toBe(33)
    expect(last.maxlevel).toBe(0)
    expect(last.levelreq).toBe(25)
    expect(last.frequency).toBe(2)
    expect(last.group).toBe(305)
    expect(last.transform).toBe(false)
    expect(last.itypes).toEqual(['armo', 'weap'])
    expect(last.etypes).toEqual([])

    expect(last.mods).toEqual([
      { code: 'pois-min', min: 64, max: 64 },
      { code: 'pois-max', min: 128, max: 128 },
      { code: 'pois-len', min: 100, max: 100 },
    ])
  })

  test('Transform flags and colors parsed accurately (Drake\'s..Great Wyrm\'s and Knight\'s)', () => {
    // Rows 18..21 (Drake's, Dragon's, Wyrm's, Great Wyrm's) have cblu
    for (let id = 18; id <= 21; id++) {
      const entry = CANONICAL_AUTOMAGIC_TABLE.get(id)!
      expect(entry.transform).toBe(true)
      expect(entry.transformColor).toBe('cblu')
    }

    // Row 31 (Knight's) has dgld
    const knights = CANONICAL_AUTOMAGIC_TABLE.get(31)!
    expect(knights.transform).toBe(true)
    expect(knights.transformColor).toBe('dgld')

    // Non-transform rows
    const jackal = CANONICAL_AUTOMAGIC_TABLE.get(9)!
    expect(jackal.transform).toBe(false)
    expect(jackal.transformColor).toBeUndefined()
  })

  test('2-mod entries (e.g. Sharp id 27) parse both attack rating and damage percent', () => {
    const sharp = CANONICAL_AUTOMAGIC_TABLE.get(27)!
    expect(sharp.name).toBe('Sharp')
    expect(sharp.group).toBe(304)
    expect(sharp.mods).toHaveLength(2)
    expect(sharp.mods[0]).toEqual({ code: 'att', min: 15, max: 30 })
    expect(sharp.mods[1]).toEqual({ code: 'dmg%', min: 10, max: 20 })
  })

  test('AutoMagicTable implements Iterable and Array-like index access', () => {
    const list = [...CANONICAL_AUTOMAGIC_TABLE]
    expect(list.length).toBe(36)
    expect(list[0]?.name).toBe("Fletcher's")
    expect(list[35]?.name).toBe('of Anthrax')
    expect(CANONICAL_AUTOMAGIC_TABLE[0]?.name).toBe("Fletcher's")
    expect(CANONICAL_AUTOMAGIC_TABLE[35]?.name).toBe('of Anthrax')
  })
})

describe('loadAutoMagic from MPQ archives', () => {
  test.runIf(hasMpqs)('loads AutoMagic.txt from d2exp.mpq and matches canonical table', async () => {
    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      const p = `${MPQ_DIR}/${name}`
      if (fs.existsSync(p)) {
        archives.add(name, await MpqArchive.open(await fileSource(p)))
      }
    }

    const table = await loadAutoMagic(archives)
    expect(table.length).toBe(36)

    for (let i = 0; i < 36; i++) {
      const fromMpq = table.get(i)!
      const fromCanonical = CANONICAL_AUTOMAGIC_TABLE.get(i)!
      expect(fromMpq.id).toBe(fromCanonical.id)
      expect(fromMpq.name).toBe(fromCanonical.name)
      expect(fromMpq.level).toBe(fromCanonical.level)
      expect(fromMpq.levelreq).toBe(fromCanonical.levelreq)
      expect(fromMpq.group).toBe(fromCanonical.group)
      expect(fromMpq.spawnable).toBe(fromCanonical.spawnable)
      expect(fromMpq.rare).toBe(fromCanonical.rare)
      expect(fromMpq.transform).toBe(fromCanonical.transform)
      expect(fromMpq.transformColor).toBe(fromCanonical.transformColor)
      expect(fromMpq.mods).toEqual(fromCanonical.mods)
      expect(fromMpq.itypes).toEqual(fromCanonical.itypes)
      expect(fromMpq.etypes).toEqual(fromCanonical.etypes)
    }
  })
})

describe('getEligibleAutoMagic Filtering', () => {
  const typeHierarchy: Record<string, string[]> = {
    abow: ['bow', 'weap'],
    ashd: ['shld', 'armo'],
    head: ['shld', 'armo'],
    orb: ['wand', 'weap'],
    swor: ['weap'],
    ring: ['misc'],
    boot: ['armo'],
  }

  const isA: IsAPredicate = (child, parent) => {
    if (child === parent) return true
    return typeHierarchy[child]?.includes(parent) ?? false
  }

  test('filters out items with incompatible item types (e.g. ring)', () => {
    const eligibleForRing = getEligibleAutoMagic('ring', 99, isA)
    expect(eligibleForRing).toHaveLength(0)
  })

  test('filters by level (alvl) correctly', () => {
    // Amazon Bow skill group (300):
    // Fletcher's: lvl 1
    // Bowyer's: lvl 40
    // Archer's: lvl 60
    const atLvl1 = getEligibleAutoMagic('abow', 1, isA, { group: 300 })
    expect(atLvl1.map(e => e.name)).toEqual(["Fletcher's"])

    const atLvl39 = getEligibleAutoMagic('abow', 39, isA, { group: 300 })
    expect(atLvl39.map(e => e.name)).toEqual(["Fletcher's"])

    const atLvl40 = getEligibleAutoMagic('abow', 40, isA, { group: 300 })
    expect(atLvl40.map(e => e.name)).toEqual(["Fletcher's", "Bowyer's"])

    const atLvl60 = getEligibleAutoMagic('abow', 60, isA, { group: 300 })
    expect(atLvl60.map(e => e.name)).toEqual(["Fletcher's", "Bowyer's", "Archer's"])
  })

  test('filters by rare compatibility', () => {
    // Group 300 at alvl 60:
    // Archer's has rare = false
    const forMagic = getEligibleAutoMagic('abow', 60, isA, { group: 300, rare: false })
    expect(forMagic.map(e => e.name)).toEqual(["Fletcher's", "Bowyer's", "Archer's"])

    const forRare = getEligibleAutoMagic('abow', 60, isA, { group: 300, rare: true })
    expect(forRare.map(e => e.name)).toEqual(["Fletcher's", "Bowyer's"])

    // Group 305 (Poison damage on Necromancer heads):
    // of Blight (lvl 1, rare: 1)
    // of Venom (lvl 15, rare: 1)
    // of Pestilence (lvl 25, rare: 1)
    // of Anthrax (lvl 33, rare: 0)
    const headsForRare = getEligibleAutoMagic('head', 50, isA, { group: 305, rare: true })
    expect(headsForRare.map(e => e.name)).toEqual(['of Blight', 'of Venom', 'of Pestilence'])
    expect(headsForRare.some(e => e.name === 'of Anthrax')).toBe(false)
  })

  test('filters by group (Paladin shields group 304)', () => {
    const palShields = getEligibleAutoMagic('ashd', 50, isA, { group: 304 })
    // All returned entries must be group 304
    expect(palShields.length).toBeGreaterThan(0)
    expect(palShields.every(e => e.group === 304)).toBe(true)
    expect(palShields.some(e => e.name === 'Shimmering')).toBe(true)
    expect(palShields.some(e => e.name === 'Chromatic')).toBe(true)
  })

  test('supports calling with table as first argument or method on table', () => {
    const res1 = getEligibleAutoMagic(CANONICAL_AUTOMAGIC_TABLE, 'ashd', 20, isA, { group: 304 })
    const res2 = CANONICAL_AUTOMAGIC_TABLE.getEligible('ashd', 20, isA, { group: 304 })
    const res3 = getEligibleAutoMagic('ashd', 20, isA, CANONICAL_AUTOMAGIC_TABLE, { group: 304 })

    expect(res1.map(e => e.id)).toEqual(res2.map(e => e.id))
    expect(res1.map(e => e.id)).toEqual(res3.map(e => e.id))
  })

  test('supports etype exclusions and maxlevel limits in mock table', () => {
    const mockTsv = `Name\tversion\tspawnable\trare\tlevel\tmaxlevel\tlevelreq\tclass\tclasslevelreq\tfrequency\tgroup\tmod1code\tmod1param\tmod1min\tmod1max\tmod2code\tmod2param\tmod2min\tmod2max\tmod3code\tmod3param\tmod3min\tmod3max\ttransform\ttransformcolor\titype1\titype2\titype3\titype4\titype5\titype6\titype7\tetype1\tetype2\tetype3\tdivide\tmultiply\tadd
TestA\t100\t1\t1\t1\t20\t1\t\t\t1\t999\thp\t\t5\t5\t\t\t\t\t\t\t\t\t\t\tweap\t\t\t\t\t\t\tswor\t\t\t0\t0\t0
TestB\t100\t1\t1\t10\t\t1\t\t\t1\t999\tmana\t\t5\t5\t\t\t\t\t\t\t\t\t\t\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0
NotSpawnable\t100\t0\t1\t1\t\t1\t\t\t1\t999\thp\t\t1\t1\t\t\t\t\t\t\t\t\t\t\tweap\t\t\t\t\t\t\t\t\t\t0\t0\t0`

    const mockTable = parseAutoMagicTable(mockTsv)
    expect(mockTable.length).toBe(3)
    expect(mockTable.get(2)?.spawnable).toBe(false)

    // TestA excludes 'swor' via etype1
    const sworEligible = getEligibleAutoMagic(mockTable, 'swor', 15, isA)
    expect(sworEligible.map(e => e.name)).toEqual(['TestB'])

    // TestA is allowed on 'abow', but has maxlevel = 20
    const bowAt15 = getEligibleAutoMagic(mockTable, 'abow', 15, isA)
    expect(bowAt15.map(e => e.name)).toEqual(['TestA', 'TestB'])

    const bowAt25 = getEligibleAutoMagic(mockTable, 'abow', 25, isA)
    // TestA has maxlevel = 20, so at alvl=25 it is excluded
    expect(bowAt25.map(e => e.name)).toEqual(['TestB'])
  })
})
