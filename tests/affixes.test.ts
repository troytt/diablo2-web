import { describe, expect, it, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import {
  parseMagicAffixesTable,
  loadMagicAffixes,
  isAffixEligible,
  MAGIC_PREFIX_TABLE_PATH,
  MAGIC_SUFFIX_TABLE_PATH,
  type MagicAffix,
  type AffixTable,
} from '../src/common/items/affixes.ts'
import { parseTable } from '../src/common/world/acts.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { loadItemTypes, isA, type ItemTypeTable } from '../src/common/items/item-types.ts'

const MPQ_DIR = 'samples/d2'
const hasMpqs = fs.existsSync(`${MPQ_DIR}/d2exp.mpq`)

describe('MagicPrefix & MagicSuffix Standalone / Synthetic Parsing', () => {
  it('parses synthetic prefix TSV with 41 columns and etype1..5', () => {
    const syntheticPrefixTsv = [
      'Name\tversion\tspawnable\trare\tlevel\tmaxlevel\tlevelreq\tclassspecific\tclass\tclasslevelreq\tfrequency\tgroup\tmod1code\tmod1param\tmod1min\tmod1max\tmod2code\tmod2param\tmod2min\tmod2max\tmod3code\tmod3param\tmod3min\tmod3max\ttransform\ttransformcolor\titype1\titype2\titype3\titype4\titype5\titype6\titype7\tetype1\tetype2\tetype3\tetype4\tetype5\tdivide\tmultiply\tadd',
      'Sturdy\t0\t1\t1\t4\t\t3\t\t\t\t0\t101\tac%\t\t20\t30\t\t\t\t\t\t\t\t\t\t\tarmo\t\t\t\t\t\t\t\t\t\t\t\t0\t0\t0',
      'Expansion\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t',
      '\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t',
      'Knight\'s\t100\t1\t1\t50\t\t42\t\t\t\t2\t104\tatt\t\t101\t121\tdmg%\t\t51\t65\t\t\t\t\t1\tdgld\tarmo\tweap\t\t\t\t\t\t\t\t\t\t\t0\t0\t0',
      'Unspawnable\t100\t0\t1\t10\t\t5\t\t\t\t1\t999\thp\t\t5\t10\t\t\t\t\t\t\t\t\t\t\tarmo\t\t\t\t\t\t\t\t\t\t\t\t0\t0\t0',
    ].join('\n')

    const table = parseMagicAffixesTable(syntheticPrefixTsv, true)
    expect(table.isPrefix).toBe(true)
    // Real rows: Sturdy, Knight's, Unspawnable (Expansion and empty Name filtered)
    expect(table.length).toBe(3)
    expect(table.all).toHaveLength(3)

    const sturdy = table.all[0]!
    expect(sturdy.name).toBe('Sturdy')
    expect(sturdy.isPrefix).toBe(true)
    expect(sturdy.spawnable).toBe(true)
    expect(sturdy.rare).toBe(true)
    expect(sturdy.level).toBe(4)
    expect(sturdy.maxlevel).toBe(0)
    expect(sturdy.levelreq).toBe(3)
    expect(sturdy.group).toBe(101)
    expect(sturdy.mods).toEqual([{ code: 'ac%', min: 20, max: 30 }])
    expect(sturdy.itypes).toEqual(['armo'])
    expect(sturdy.etypes).toEqual([])

    const knights = table.all[1]!
    expect(knights.name).toBe("Knight's")
    expect(knights.transform).toBe(true)
    expect(knights.transformColor).toBe('dgld')
    expect(knights.mods).toEqual([
      { code: 'att', min: 101, max: 121 },
      { code: 'dmg%', min: 51, max: 65 },
    ])
    expect(knights.itypes).toEqual(['armo', 'weap'])

    // Lookups
    expect(table.byName.get('Sturdy')).toEqual([sturdy])
    expect(table.getByName("Knight's")).toEqual([knights])
    expect(table.getByGroup(101)).toEqual([sturdy])
    expect(table.getByGroup(104)).toEqual([knights])
  })

  it('parses synthetic suffix TSV with 39 columns and etype1..3', () => {
    const syntheticSuffixTsv = [
      'Name\tversion\tspawnable\trare\tlevel\tmaxlevel\tlevelreq\tclassspecific\tclass\tclasslevelreq\tfrequency\tgroup\tmod1code\tmod1param\tmod1min\tmod1max\tmod2code\tmod2param\tmod2min\tmod2max\tmod3code\tmod3param\tmod3min\tmod3max\ttransform\ttransformcolor\titype1\titype2\titype3\titype4\titype5\titype6\titype7\tetype1\tetype2\tetype3\tdivide\tmultiply\tadd',
      'of the Ox\t0\t1\t1\t18\t\t13\t\t\t\t0\t34\tstr\t\t7\t10\t\t\t\t\t\t\t\t\t\t\tmele\tbelt\tring\tamul\t\t\t\twand\tstaf\t\t0\t0\t0',
      'Expansion\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t',
      'of the Ox\t1\t1\t1\t26\t\t19\t\t\t\t3\t31\tstr\t\t6\t9\t\t\t\t\t\t\t\t\t\t\tamul\tbelt\tclub\thamm\tcirc\t\t\t\t\t\t0\t0\t0',
    ].join('\n')

    const table = parseMagicAffixesTable(syntheticSuffixTsv, false)
    expect(table.isPrefix).toBe(false)
    expect(table.length).toBe(2)

    const oxList = table.getByName('of the Ox')
    expect(oxList).toHaveLength(2)

    const oxClassic = oxList[0]!
    expect(oxClassic.name).toBe('of the Ox')
    expect(oxClassic.isPrefix).toBe(false)
    expect(oxClassic.group).toBe(34)
    expect(oxClassic.level).toBe(18)
    expect(oxClassic.mods).toEqual([{ code: 'str', min: 7, max: 10 }])
    expect(oxClassic.itypes).toEqual(['mele', 'belt', 'ring', 'amul'])
    expect(oxClassic.etypes).toEqual(['wand', 'staf'])

    const oxLod = oxList[1]!
    expect(oxLod.group).toBe(31)
    expect(oxLod.level).toBe(26)
    expect(oxLod.mods).toEqual([{ code: 'str', min: 6, max: 9 }])
  })
})

describe('isAffixEligible helper with mock isA', () => {
  const mockIsA = (type: string, target: string): boolean => {
    if (type === target) return true
    if (type === 'swor' && target === 'mele') return true
    if (type === 'wand' && target === 'mele') return true
    if (type === 'staf' && target === 'mele') return true
    if (type === 'tors' && target === 'armo') return true
    if (type === 'helm' && target === 'armo') return true
    return false
  }

  const sampleAffix: MagicAffix = {
    name: 'Sample',
    isPrefix: true,
    version: 100,
    spawnable: true,
    rare: false,
    level: 20,
    maxlevel: 50,
    levelreq: 15,
    frequency: 5,
    group: 1,
    mods: [{ code: 'hp', min: 10, max: 20 }],
    transform: false,
    itypes: ['mele', 'armo'],
    etypes: ['wand'],
  }

  it('rejects unspawnable affixes', () => {
    const unspawnable = { ...sampleAffix, spawnable: false }
    expect(isAffixEligible(unspawnable, 'swor', mockIsA, { alvl: 30 })).toBe(false)
  })

  it('enforces rare flag when options.isRare is true', () => {
    expect(isAffixEligible(sampleAffix, 'swor', mockIsA, { alvl: 30, isRare: true })).toBe(false)
    const rareAffix = { ...sampleAffix, rare: true }
    expect(isAffixEligible(rareAffix, 'swor', mockIsA, { alvl: 30, isRare: true })).toBe(true)
    // When isRare is false or undefined, non-rare affixes can spawn
    expect(isAffixEligible(sampleAffix, 'swor', mockIsA, { alvl: 30, isRare: false })).toBe(true)
    expect(isAffixEligible(sampleAffix, 'swor', mockIsA, { alvl: 30 })).toBe(true)
  })

  it('enforces level requirements and maxlevel constraints', () => {
    // level: 20, maxlevel: 50
    expect(isAffixEligible(sampleAffix, 'swor', mockIsA, { alvl: 19 })).toBe(false)
    expect(isAffixEligible(sampleAffix, 'swor', mockIsA, { alvl: 20 })).toBe(true)
    expect(isAffixEligible(sampleAffix, 'swor', mockIsA, { alvl: 50 })).toBe(true)
    expect(isAffixEligible(sampleAffix, 'swor', mockIsA, { alvl: 51 })).toBe(false)

    // maxlevel === 0 means no upper limit
    const uncapped = { ...sampleAffix, maxlevel: 0 }
    expect(isAffixEligible(uncapped, 'swor', mockIsA, { alvl: 99 })).toBe(true)
  })

  it('enforces etype exclusion blacklist before itype whitelist', () => {
    // wand is mele, but wand is in etypes: ['wand']
    expect(isAffixEligible(sampleAffix, 'wand', mockIsA, { alvl: 30 })).toBe(false)
    // swor is mele, and not wand -> eligible
    expect(isAffixEligible(sampleAffix, 'swor', mockIsA, { alvl: 30 })).toBe(true)
    // staf is mele, and not wand -> eligible
    expect(isAffixEligible(sampleAffix, 'staf', mockIsA, { alvl: 30 })).toBe(true)
  })

  it('enforces itype whitelist: item must match at least one itype', () => {
    // tors matches armo
    expect(isAffixEligible(sampleAffix, 'tors', mockIsA, { alvl: 30 })).toBe(true)
    // ring does not match mele or armo
    expect(isAffixEligible(sampleAffix, 'ring', mockIsA, { alvl: 30 })).toBe(false)

    // affix with no itypes cannot match any item
    const noItypes = { ...sampleAffix, itypes: [] }
    expect(isAffixEligible(noItypes, 'swor', mockIsA, { alvl: 30 })).toBe(false)
  })

  it('enforces classspecific restriction against explicit options.itemClass and inferred itemTypeCode class', () => {
    const classIsA = (type: string, target: string): boolean => {
      if (type === target) return true
      if ((type === 'swor' || type === 'abow' || type === 'orb') && target === 'weap') return true
      if (type === 'abow' && target === 'amaz') return true
      if (type === 'orb' && target === 'sorc') return true
      return false
    }

    const amaSpecificAffix: MagicAffix = {
      ...sampleAffix,
      name: 'Maiden\'s',
      classspecific: 'ama',
      class: 'ama',
      levelreq: 36,
      classlevelreq: 27,
      itypes: ['weap'],
      etypes: [],
    }

    // Generic sword ('swor'): must be false (both inferred and explicit itemClass: '')
    expect(isAffixEligible(amaSpecificAffix, 'swor', classIsA, { alvl: 30 })).toBe(false)
    expect(isAffixEligible(amaSpecificAffix, 'swor', classIsA, { alvl: 30, itemClass: '' })).toBe(false)

    // Sorceress orb ('orb' / itemClass: 'sor'): must be false
    expect(isAffixEligible(amaSpecificAffix, 'orb', classIsA, { alvl: 30 })).toBe(false)
    expect(isAffixEligible(amaSpecificAffix, 'orb', classIsA, { alvl: 30, itemClass: 'sor' })).toBe(false)

    // Amazon bow ('abow' / itemClass: 'ama'): must be true
    expect(isAffixEligible(amaSpecificAffix, 'abow', classIsA, { alvl: 30 })).toBe(true)
    expect(isAffixEligible(amaSpecificAffix, 'abow', classIsA, { alvl: 30, itemClass: 'ama' })).toBe(true)
  })
})

describe('Magic Affixes Integration with 1.13c MPQ Archives', () => {
  let prefixes: AffixTable
  let suffixes: AffixTable
  let itemTypes: ItemTypeTable
  let isAPred: (type: string, target: string) => boolean

  beforeAll(async () => {
    if (!hasMpqs) return

    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      const p = `${MPQ_DIR}/${name}`
      if (fs.existsSync(p)) {
        archives.add(name, await MpqArchive.open(await fileSource(p)))
      }
    }

    const affixData = await loadMagicAffixes(archives)
    prefixes = affixData.prefixes
    suffixes = affixData.suffixes

    itemTypes = await loadItemTypes(archives)
    isAPred = (type, target) => isA(type, target, itemTypes)
  })

  it('confirms canonical table paths', () => {
    expect(MAGIC_PREFIX_TABLE_PATH).toBe('data\\global\\excel\\MagicPrefix.txt')
    expect(MAGIC_SUFFIX_TABLE_PATH).toBe('data\\global\\excel\\MagicSuffix.txt')
  })

  it.runIf(hasMpqs)('parses exactly 637 prefixes and 741 suffixes (total 1378)', () => {
    expect(prefixes.length).toBe(637)
    expect(prefixes.all.length).toBe(637)

    expect(suffixes.length).toBe(741)
    expect(suffixes.all.length).toBe(741)

    expect(prefixes.length + suffixes.length).toBe(1378)
  })

  it.runIf(hasMpqs)('verifies spawnable=1 count: 587 prefixes, 575 suffixes (total 1162)', () => {
    const spawnablePrefixes = prefixes.all.filter(a => a.spawnable)
    const spawnableSuffixes = suffixes.all.filter(a => a.spawnable)

    expect(spawnablePrefixes.length).toBe(587)
    expect(spawnableSuffixes.length).toBe(575)
    expect(spawnablePrefixes.length + spawnableSuffixes.length).toBe(1162)
  })

  it.runIf(hasMpqs)('sample check: Sturdy (group 101, ac% 20-30, itype=armo)', () => {
    const sturdyList = prefixes.getByName('Sturdy')
    expect(sturdyList.length).toBeGreaterThanOrEqual(1)

    // Check classic version 0 entry: group 101, ac% 20-30, itypes: ['armo']
    const sturdyV0 = sturdyList.find(a => a.version === 0)
    expect(sturdyV0).toBeDefined()
    expect(sturdyV0?.group).toBe(101)
    expect(sturdyV0?.spawnable).toBe(true)
    expect(sturdyV0?.rare).toBe(true)
    expect(sturdyV0?.itypes).toEqual(['armo'])
    expect(sturdyV0?.etypes).toEqual([])
    expect(sturdyV0?.mods).toEqual([{ code: 'ac%', min: 20, max: 30 }])

    // Test eligibility with loaded itemTypes hierarchy
    // 'tors' (body armor) and 'shld' (shield) inherit from 'armo'
    expect(isAffixEligible(sturdyV0!, 'tors', isAPred, { alvl: 10 })).toBe(true)
    expect(isAffixEligible(sturdyV0!, 'shld', isAPred, { alvl: 10 })).toBe(true)
    // Weapons do not inherit from armo
    expect(isAffixEligible(sturdyV0!, 'swor', isAPred, { alvl: 10 })).toBe(false)
    // Level requirement check: level is 4, so alvl 2 must fail
    expect(isAffixEligible(sturdyV0!, 'tors', isAPred, { alvl: 2 })).toBe(false)
  })

  it.runIf(hasMpqs)('sample check: of the Ox (group 34, str 7-10, etype includes wand/staf)', () => {
    const oxList = suffixes.getByName('of the Ox')
    expect(oxList.length).toBeGreaterThanOrEqual(2)

    // Group 34 classic entry
    const oxGrp34 = oxList.find(a => a.group === 34 && a.etypes.includes('wand'))
    expect(oxGrp34).toBeDefined()
    expect(oxGrp34?.group).toBe(34)
    expect(oxGrp34?.spawnable).toBe(true)
    expect(oxGrp34?.level).toBe(18)
    expect(oxGrp34?.mods).toEqual([{ code: 'str', min: 7, max: 10 }])
    expect(oxGrp34?.itypes).toEqual(['mele', 'belt', 'ring', 'amul'])
    expect(oxGrp34?.etypes).toContain('wand')
    expect(oxGrp34?.etypes).toContain('staf')

    // Test eligibility:
    // 'swor' is mele, and is not wand or staf -> eligible
    expect(isAffixEligible(oxGrp34!, 'swor', isAPred, { alvl: 20 })).toBe(true)
    // 'wand' and 'staf' are melee weapons, but are blacklisted via etypes
    expect(isAffixEligible(oxGrp34!, 'wand', isAPred, { alvl: 20 })).toBe(false)
    expect(isAffixEligible(oxGrp34!, 'staf', isAPred, { alvl: 20 })).toBe(false)
    // 'ring' is in itypes directly -> eligible
    expect(isAffixEligible(oxGrp34!, 'ring', isAPred, { alvl: 20 })).toBe(true)
    // alvl below level 18 -> false
    expect(isAffixEligible(oxGrp34!, 'swor', isAPred, { alvl: 15 })).toBe(false)
  })

  it.runIf(hasMpqs)('verifies AffixTable indexing and iteration', () => {
    // Iterable
    const allPrefixes = [...prefixes]
    expect(allPrefixes.length).toBe(637)

    // byGroup
    const group101 = prefixes.getByGroup(101)
    expect(group101.length).toBeGreaterThan(0)
    for (const affix of group101) {
      expect(affix.group).toBe(101)
    }

    // getEligible on table
    const eligibleForArmor = prefixes.getEligible('tors', isAPred, { alvl: 5 })
    expect(eligibleForArmor.length).toBeGreaterThan(0)
    for (const affix of eligibleForArmor) {
      expect(affix.spawnable).toBe(true)
      expect(affix.level).toBeLessThanOrEqual(5)
    }
  })
})
