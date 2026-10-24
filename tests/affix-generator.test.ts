import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import {
  calculateAlvl,
  rollMagicAffixes,
  rollRareAffixes,
  getItemTypeCode,
  getBaseQlvl,
  getBaseMagicLvl,
} from '../src/common/items/affix-generator.ts'
import type { ItemBase } from '../src/common/items/items.ts'
import type { MagicAffix, AffixTable } from '../src/common/items/affixes.ts'
import { parseMagicAffixesTable } from '../src/common/items/affixes.ts'
import type { RareNameEntry, RareNameTable } from '../src/common/items/rare-names.ts'
import { parseRareNamesTable } from '../src/common/items/rare-names.ts'
import { parseTable } from '../src/common/world/acts.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { loadItemTypes, isA as realIsA } from '../src/common/items/item-types.ts'

describe('Affix Generator - alvl calculation (Issue #104)', () => {
  it('calculates alvl with magicLvl bonus', () => {
    // if (magicLvl > 0) alvl = ilvl + magicLvl
    expect(calculateAlvl(10, 20, 5)).toBe(15)
    expect(calculateAlvl(20, 15, 3)).toBe(23)
    // Diadem (magicLvl = 18) capped at 99
    expect(calculateAlvl(85, 85, 18)).toBe(99)
    // Capped at 99
    expect(calculateAlvl(95, 80, 10)).toBe(99)
  })

  it('calculates alvl when qlvl > Math.trunc(ilvl / 2) without magicLvl', () => {
    // else if (qlvl > Math.trunc(ilvl / 2)) alvl = ilvl - Math.trunc(qlvl / 2)
    // ilvl = 30, qlvl = 40 -> trunc(30/2)=15, 40 > 15 -> 30 - 20 = 10
    expect(calculateAlvl(30, 40)).toBe(10)
    expect(calculateAlvl(30, 40, 0)).toBe(10)

    // ilvl = 20, qlvl = 16 -> trunc(20/2)=10, 16 > 10 -> 20 - 8 = 12
    expect(calculateAlvl(20, 16)).toBe(12)

    // ilvl = 50, qlvl = 26 -> trunc(50/2)=25, 26 > 25 -> 50 - 13 = 37
    expect(calculateAlvl(50, 26)).toBe(37)

    // ilvl = 15, qlvl = 10 -> trunc(15/2)=7, 10 > 7 -> 15 - 5 = 10
    expect(calculateAlvl(15, 10)).toBe(10)
  })

  it('calculates alvl when qlvl <= Math.trunc(ilvl / 2) without magicLvl', () => {
    // else alvl = ilvl
    // ilvl = 50, qlvl = 20 -> trunc(50/2)=25, 20 <= 25 -> 50
    expect(calculateAlvl(50, 20)).toBe(50)

    // Exact boundary: ilvl = 50, qlvl = 25 -> trunc(50/2)=25, 25 <= 25 -> 50
    expect(calculateAlvl(50, 25)).toBe(50)

    // ilvl = 80, qlvl = 30 -> trunc(80/2)=40, 30 <= 40 -> 80
    expect(calculateAlvl(80, 30)).toBe(80)

    // ilvl = 105, qlvl = 20 -> 105 capped at 99
    expect(calculateAlvl(105, 20)).toBe(99)
  })

  it('defaults magicLvl to 0 when omitted', () => {
    expect(calculateAlvl(40, 50)).toBe(calculateAlvl(40, 50, 0))
    expect(calculateAlvl(60, 20)).toBe(calculateAlvl(60, 20, 0))
  })
})

describe('ItemBase helper functions', () => {
  it('extracts itemTypeCode, qlvl, and magicLvl correctly', () => {
    const baseWithExplicitType: any = {
      id: 'hax',
      name: 'Hand Axe',
      kind: 'weapon',
      invWidth: 1,
      invHeight: 3,
      maxStack: 1,
      value: 100,
      damage: 10,
      defense: 0,
      tags: ['weap', 'axe'],
      type: 'axe',
      level: 3,
      magicLvl: 2,
    }
    expect(getItemTypeCode(baseWithExplicitType)).toBe('axe')
    expect(getBaseQlvl(baseWithExplicitType)).toBe(3)
    expect(getBaseMagicLvl(baseWithExplicitType)).toBe(2)

    const baseWithTagsOnly: ItemBase = {
      id: 'crs',
      name: 'Crystal Sword',
      kind: 'weapon',
      invWidth: 2,
      invHeight: 3,
      maxStack: 1,
      value: 500,
      damage: 15,
      defense: 0,
      tags: ['weap', 'swor'],
      level: 11,
    }
    expect(getItemTypeCode(baseWithTagsOnly)).toBe('swor')
    expect(getBaseQlvl(baseWithTagsOnly)).toBe(11)
    expect(getBaseMagicLvl(baseWithTagsOnly)).toBe(0)

    const baseMinimal: ItemBase = {
      id: 'rin',
      name: 'Ring',
      kind: 'misc',
      invWidth: 1,
      invHeight: 1,
      maxStack: 1,
      value: 100,
      damage: 0,
      defense: 0,
      tags: ['ring'],
      level: 1,
    }
    expect(getItemTypeCode(baseMinimal)).toBe('ring')
    expect(getBaseQlvl(baseMinimal)).toBe(1)
  })
})

describe('Affix Generator - Group exclusion & Rare Generation (Issue #104)', () => {
  const mockIsA = (type: string, target: string): boolean => {
    if (type === target) return true
    if (type === 'swor' && target === 'weap') return true
    if (type === 'swor' && target === 'mele') return true
    return false
  }

  const swordBase: ItemBase = {
    id: 'swor',
    name: 'Broad Sword',
    kind: 'weapon',
    invWidth: 1,
    invHeight: 3,
    maxStack: 1,
    value: 100,
    damage: 10,
    defense: 0,
    tags: ['swor'],
    level: 15,
  }

  // Helper to create mock MagicAffix
  function createMockAffix(
    name: string,
    isPrefix: boolean,
    group: number,
    frequency: number,
    level = 1,
    mods = [{ code: 'att', min: 10, max: 20 }],
  ): MagicAffix {
    return {
      name,
      isPrefix,
      version: 100,
      spawnable: true,
      rare: true,
      level,
      maxlevel: 0,
      levelreq: 1,
      frequency,
      group,
      mods,
      transform: false,
      itypes: ['swor'],
      etypes: [],
    }
  }

  it('enforces group mutex: affixes with same group > 0 never co-occur on the same item', () => {
    // 3 prefixes in group 10 ("Bronze", "Iron", "Steel"), 2 prefixes in group 20 ("Sharp", "Fine")
    const prefixes: MagicAffix[] = [
      createMockAffix('Bronze', true, 10, 5),
      createMockAffix('Iron', true, 10, 5),
      createMockAffix('Steel', true, 10, 5),
      createMockAffix('Sharp', true, 20, 5),
      createMockAffix('Fine', true, 20, 5),
      createMockAffix('Godly', true, 30, 5),
    ]

    // 2 suffixes in group 10 ("of the Titan", "of the Colossus"), 3 suffixes in group 40 ("of Leech", "of Blood", "of Bat")
    const suffixes: MagicAffix[] = [
      createMockAffix('of the Titan', false, 10, 5),
      createMockAffix('of the Colossus', false, 10, 5),
      createMockAffix('of Leech', false, 40, 5),
      createMockAffix('of Blood', false, 40, 5),
      createMockAffix('of Bat', false, 50, 5),
      createMockAffix('of Speed', false, 60, 5),
    ]

    const mockAffixes = {
      prefixes: { all: prefixes } as unknown as AffixTable,
      suffixes: { all: suffixes } as unknown as AffixTable,
    }

    const mockRareNames = {
      prefixes: {
        entries: [{ index: 0, name: 'Storm', version: 0, itypes: [], etypes: [], add: 0, multiply: 0, divide: 0 }],
        getEligible: () => [{ index: 0, name: 'Storm', version: 0, itypes: [], etypes: [], add: 0, multiply: 0, divide: 0 }],
      } as unknown as RareNameTable,
      suffixes: {
        entries: [{ index: 0, name: 'Spur', version: 0, itypes: [], etypes: [], add: 0, multiply: 0, divide: 0 }],
        getEligible: () => [{ index: 0, name: 'Spur', version: 0, itypes: [], etypes: [], add: 0, multiply: 0, divide: 0 }],
      } as unknown as RareNameTable,
    }

    // Run 50 rare rolls with varying seeds
    for (let seed = 1000; seed < 1050; seed++) {
      const rng = new D2Rng(seed)
      const rare = rollRareAffixes(swordBase, 50, mockAffixes, mockRareNames, mockIsA, rng)

      // Count occurrences of each group > 0
      const groupCounts = new Map<number, number>()
      for (const rolled of rare.affixes) {
        if (rolled.group > 0) {
          groupCounts.set(rolled.group, (groupCounts.get(rolled.group) ?? 0) + 1)
        }
      }

      // Group mutex constraint: every group > 0 must appear at most once!
      for (const [group, count] of groupCounts.entries()) {
        expect(count, `Group ${group} appeared ${count} times on the same item!`).toBe(1)
      }

      // Explicit check for cross-prefix/suffix conflict on group 10
      const group10Affixes = rare.affixes.filter(a => a.group === 10)
      expect(group10Affixes.length).toBeLessThanOrEqual(1)
    }
  })

  it('allows affixes with group 0 to co-occur if they are distinct affixes', () => {
    const prefixes: MagicAffix[] = [
      createMockAffix('SpecialPrefix1', true, 0, 10),
      createMockAffix('SpecialPrefix2', true, 0, 10),
      createMockAffix('SpecialPrefix3', true, 0, 10),
    ]
    const suffixes: MagicAffix[] = [
      createMockAffix('of Special1', false, 0, 10),
      createMockAffix('of Special2', false, 0, 10),
      createMockAffix('of Special3', false, 0, 10),
    ]

    const mockAffixes = {
      prefixes: { all: prefixes } as unknown as AffixTable,
      suffixes: { all: suffixes } as unknown as AffixTable,
    }

    const mockRareNames = {
      prefixes: {
        getEligible: () => [{ index: 0, name: 'Shadow', itypes: [], etypes: [] }],
      } as unknown as RareNameTable,
      suffixes: {
        getEligible: () => [{ index: 0, name: 'Bite', itypes: [], etypes: [] }],
      } as unknown as RareNameTable,
    }

    const rng = new D2Rng(42)
    const rare = rollRareAffixes(swordBase, 50, mockAffixes, mockRareNames, mockIsA, rng)
    expect(rare.affixes.length).toBeGreaterThanOrEqual(3)

    // All affixes have group 0, and they can co-occur
    const group0Count = rare.affixes.filter(a => a.group === 0).length
    expect(group0Count).toBeGreaterThanOrEqual(3)

    // But no duplicate affix instance
    const names = rare.affixes.map(a => a.name)
    const uniqueNames = new Set(names)
    expect(names.length).toBe(uniqueNames.size)
  })
})

describe('Affix Generator - Quality specific rolls (Issue #104)', () => {
  const mockIsA = (type: string, target: string): boolean => {
    if (type === target) return true
    if (type === 'swor' && target === 'weap') return true
    return false
  }

  const swordBase: ItemBase = {
    id: 'swor',
    name: 'Broad Sword',
    kind: 'weapon',
    invWidth: 1,
    invHeight: 3,
    maxStack: 1,
    value: 100,
    damage: 10,
    defense: 0,
    tags: ['swor'],
    level: 15,
  }

  function createMockAffix(name: string, isPrefix: boolean, group: number): MagicAffix {
    return {
      name,
      isPrefix,
      version: 100,
      spawnable: true,
      rare: true,
      level: 1,
      maxlevel: 0,
      levelreq: 1,
      frequency: 5,
      group,
      mods: [{ code: 'hp', min: 10, max: 20 }],
      transform: false,
      itypes: ['swor'],
      etypes: [],
    }
  }

  const prefixes = [
    createMockAffix('Sturdy', true, 1),
    createMockAffix('Strong', true, 2),
    createMockAffix('Glorious', true, 3),
  ]

  const suffixes = [
    createMockAffix('of the Ox', false, 4),
    createMockAffix('of the Giant', false, 5),
    createMockAffix('of the Titan', false, 6),
  ]

  const mockAffixes = {
    prefixes: { all: prefixes } as unknown as AffixTable,
    suffixes: { all: suffixes } as unknown as AffixTable,
  }

  const mockRareNames = {
    prefixes: {
      getEligible: () => [
        { index: 0, name: 'Doom', itypes: [], etypes: [] },
        { index: 1, name: 'Beast', itypes: [], etypes: [] },
      ],
    } as unknown as RareNameTable,
    suffixes: {
      getEligible: () => [
        { index: 0, name: 'Bite', itypes: [], etypes: [] },
        { index: 1, name: 'Casque', itypes: [], etypes: [] },
      ],
    } as unknown as RareNameTable,
  }

  describe('Magic items: 1 prefix slot + 1 suffix slot', () => {
    it('generates at most 1 prefix and 1 suffix, correctly formatted', () => {
      let sawPrefixOnly = false
      let sawSuffixOnly = false
      let sawBoth = false

      for (let seed = 1; seed <= 60; seed++) {
        const rng = new D2Rng(seed)
        const magic = rollMagicAffixes(swordBase, 20, mockAffixes, mockIsA, rng)

        // Slot constraints
        expect(magic.prefixes.length).toBeLessThanOrEqual(1)
        expect(magic.suffixes.length).toBeLessThanOrEqual(1)
        expect(magic.affixes.length).toBeGreaterThanOrEqual(1)
        expect(magic.affixes.length).toBeLessThanOrEqual(2)

        if (magic.prefix && !magic.suffix) {
          sawPrefixOnly = true
          expect(magic.name).toBe(`${magic.prefix.name} ${swordBase.name}`)
          expect(magic.prefixes).toEqual([magic.prefix])
          expect(magic.suffixes).toEqual([])
        } else if (!magic.prefix && magic.suffix) {
          sawSuffixOnly = true
          expect(magic.name).toBe(`${swordBase.name} ${magic.suffix.name}`)
          expect(magic.prefixes).toEqual([])
          expect(magic.suffixes).toEqual([magic.suffix])
        } else if (magic.prefix && magic.suffix) {
          sawBoth = true
          expect(magic.name).toBe(`${magic.prefix.name} ${swordBase.name} ${magic.suffix.name}`)
          expect(magic.prefixes).toEqual([magic.prefix])
          expect(magic.suffixes).toEqual([magic.suffix])
        }
      }

      // Verify all 3 random choices ({prefix only}, {suffix only}, {both}) occur
      expect(sawPrefixOnly).toBe(true)
      expect(sawSuffixOnly).toBe(true)
      expect(sawBoth).toBe(true)
    })
  })

  describe('Rare items: 3 to 6 affixes, <=3 prefixes, <=3 suffixes', () => {
    it('satisfies 3..6 total affixes, 0..3 prefixes, 0..3 suffixes, and picks rare name', () => {
      for (let seed = 1; seed <= 50; seed++) {
        const rng = new D2Rng(seed * 77)
        const rare = rollRareAffixes(swordBase, 30, mockAffixes, mockRareNames, mockIsA, rng)

        // Total affixes: 3 to 6
        expect(rare.affixes.length).toBeGreaterThanOrEqual(3)
        expect(rare.affixes.length).toBeLessThanOrEqual(6)

        // Up to 3 prefix + up to 3 suffix slots
        expect(rare.prefixes.length).toBeGreaterThanOrEqual(0)
        expect(rare.prefixes.length).toBeLessThanOrEqual(3)
        expect(rare.suffixes.length).toBeGreaterThanOrEqual(0)
        expect(rare.suffixes.length).toBeLessThanOrEqual(3)

        // Total equals sum
        expect(rare.prefixes.length + rare.suffixes.length).toBe(rare.affixes.length)

        // Rare name
        expect(rare.rarePrefix).toBeDefined()
        expect(rare.rareSuffix).toBeDefined()
        expect(rare.name).toBe(`${rare.rarePrefix!.name} ${rare.rareSuffix!.name}`)
      }
    })
  })
})

describe('Mod Values Roll (Issue #104)', () => {
  const mockIsA = (type: string, target: string): boolean => type === target

  const swordBase: ItemBase = {
    id: 'swor',
    name: 'Broad Sword',
    kind: 'weapon',
    invWidth: 1,
    invHeight: 3,
    maxStack: 1,
    value: 100,
    damage: 10,
    defense: 0,
    tags: ['swor'],
    level: 10,
  }

  it('rolls mod values within [min, max] using item rng', () => {
    const affixWithRangedMod: MagicAffix = {
      name: 'Vitality',
      isPrefix: true,
      version: 100,
      spawnable: true,
      rare: true,
      level: 1,
      maxlevel: 0,
      levelreq: 1,
      frequency: 1,
      group: 1,
      mods: [
        { code: 'hp', min: 10, max: 20 },
        { code: 'str', min: 5, max: 5 },
      ],
      transform: false,
      itypes: ['swor'],
      etypes: [],
    }

    const mockAffixes = {
      prefixes: { all: [affixWithRangedMod] } as unknown as AffixTable,
      suffixes: { all: [] } as unknown as AffixTable,
    }

    for (let seed = 1; seed <= 30; seed++) {
      const rng = new D2Rng(seed)
      const result = rollMagicAffixes(swordBase, 20, mockAffixes, mockIsA, rng)
      if (result.prefix) {
        const hpMod = result.prefix.mods.find(m => m.code === 'hp')!
        expect(hpMod).toBeDefined()
        expect(hpMod.value).toBeGreaterThanOrEqual(10)
        expect(hpMod.value).toBeLessThanOrEqual(20)

        const strMod = result.prefix.mods.find(m => m.code === 'str')!
        expect(strMod).toBeDefined()
        expect(strMod.value).toBe(5)
      }
    }
  })

  it('weights affix selection by affix.frequency', () => {
    const commonPrefix: MagicAffix = {
      name: 'Common',
      isPrefix: true,
      version: 100,
      spawnable: true,
      rare: true,
      level: 1,
      maxlevel: 0,
      levelreq: 1,
      frequency: 90,
      group: 1,
      mods: [{ code: 'hp', min: 1, max: 1 }],
      transform: false,
      itypes: ['swor'],
      etypes: [],
    }
    const rarePrefix: MagicAffix = {
      name: 'UltraRare',
      isPrefix: true,
      version: 100,
      spawnable: true,
      rare: true,
      level: 1,
      maxlevel: 0,
      levelreq: 1,
      frequency: 10,
      group: 2,
      mods: [{ code: 'hp', min: 1, max: 1 }],
      transform: false,
      itypes: ['swor'],
      etypes: [],
    }

    const mockAffixes = {
      prefixes: { all: [commonPrefix, rarePrefix] } as unknown as AffixTable,
      suffixes: { all: [] } as unknown as AffixTable,
    }

    let commonCount = 0
    let rareCount = 0
    const totalRuns = 200

    for (let seed = 1; seed <= totalRuns; seed++) {
      const rng = new D2Rng(seed)
      const res = rollMagicAffixes(swordBase, 20, mockAffixes, mockIsA, rng)
      if (res.prefix?.name === 'Common') commonCount++
      if (res.prefix?.name === 'UltraRare') rareCount++
    }

    // Common (freq 90) should spawn much more often than UltraRare (freq 10)
    expect(commonCount).toBeGreaterThan(rareCount * 3)
    expect(commonCount + rareCount).toBeGreaterThan(0)
  })
})

describe('Affix Generator - Determinism & Reproducibility (Issue #104)', () => {
  const mockIsA = (type: string, target: string): boolean => type === target

  const swordBase: ItemBase = {
    id: 'swor',
    name: 'Broad Sword',
    kind: 'weapon',
    invWidth: 1,
    invHeight: 3,
    maxStack: 1,
    value: 100,
    damage: 10,
    defense: 0,
    tags: ['swor'],
    level: 25,
  }

  function createMockAffix(name: string, isPrefix: boolean, group: number): MagicAffix {
    return {
      name,
      isPrefix,
      version: 100,
      spawnable: true,
      rare: true,
      level: 1,
      maxlevel: 0,
      levelreq: 1,
      frequency: 5,
      group,
      mods: [{ code: 'att', min: 10, max: 50 }],
      transform: false,
      itypes: ['swor'],
      etypes: [],
    }
  }

  const mockAffixes = {
    prefixes: {
      all: [
        createMockAffix('Bronze', true, 1),
        createMockAffix('Iron', true, 2),
        createMockAffix('Steel', true, 3),
      ],
    } as unknown as AffixTable,
    suffixes: {
      all: [
        createMockAffix('of Craft', false, 4),
        createMockAffix('of Master', false, 5),
        createMockAffix('of Titan', false, 6),
      ],
    } as unknown as AffixTable,
  }

  const mockRareNames = {
    prefixes: {
      getEligible: () => [{ index: 0, name: 'Gale', itypes: [], etypes: [] }],
    } as unknown as RareNameTable,
    suffixes: {
      getEligible: () => [{ index: 0, name: 'Claw', itypes: [], etypes: [] }],
    } as unknown as RareNameTable,
  }

  it('reproduces exact identical magic rolls with same seed', () => {
    const fixedSeed = 0x12345678

    const rng1 = new D2Rng(fixedSeed)
    const magic1 = rollMagicAffixes(swordBase, 30, mockAffixes, mockIsA, rng1)

    const rng2 = new D2Rng(fixedSeed)
    const magic2 = rollMagicAffixes(swordBase, 30, mockAffixes, mockIsA, rng2)

    expect(magic1.name).toBe(magic2.name)
    expect(magic1.alvl).toBe(magic2.alvl)
    expect(magic1.prefixes).toEqual(magic2.prefixes)
    expect(magic1.suffixes).toEqual(magic2.suffixes)
    expect(magic1.affixes).toEqual(magic2.affixes)
    expect(magic1.dwInitSeed).toBe(magic2.dwInitSeed)
  })

  it('reproduces exact identical rare rolls with same seed', () => {
    const fixedSeed = 0x87654321

    const rng1 = new D2Rng(fixedSeed)
    const rare1 = rollRareAffixes(swordBase, 30, mockAffixes, mockRareNames, mockIsA, rng1)

    const rng2 = new D2Rng(fixedSeed)
    const rare2 = rollRareAffixes(swordBase, 30, mockAffixes, mockRareNames, mockIsA, rng2)

    expect(rare1.name).toBe(rare2.name)
    expect(rare1.alvl).toBe(rare2.alvl)
    expect(rare1.rarePrefix).toEqual(rare2.rarePrefix)
    expect(rare1.rareSuffix).toEqual(rare2.rareSuffix)
    expect(rare1.prefixes).toEqual(rare2.prefixes)
    expect(rare1.suffixes).toEqual(rare2.suffixes)
    expect(rare1.affixes).toEqual(rare2.affixes)
    expect(rare1.dwInitSeed).toBe(rare2.dwInitSeed)
  })
})

describe('Affix Generator - Real MPQ Data Integration (when samples/d2 exists)', () => {
  const hasMpqs = fs.existsSync('samples/d2/d2exp.mpq')

  it.skipIf(!hasMpqs)('rolls realistic magic and rare items from vanilla 1.13c game data', async () => {
    const archives = new MountedArchives()
    archives.add('d2data.mpq', await MpqArchive.open(await fileSource('samples/d2/d2data.mpq')))
    archives.add('d2exp.mpq', await MpqArchive.open(await fileSource('samples/d2/d2exp.mpq')))

    // Load tables
    const prefixBytes = await archives.read('data\\global\\excel\\MagicPrefix.txt')
    const suffixBytes = await archives.read('data\\global\\excel\\MagicSuffix.txt')
    const rarePrefixBytes = await archives.read('data\\global\\excel\\RarePrefix.txt')
    const rareSuffixBytes = await archives.read('data\\global\\excel\\RareSuffix.txt')

    const prefixes = parseMagicAffixesTable(prefixBytes, true)
    const suffixes = parseMagicAffixesTable(suffixBytes, false)
    const rarePrefixes = parseRareNamesTable(parseTable(rarePrefixBytes))
    const rareSuffixes = parseRareNamesTable(parseTable(rareSuffixBytes))
    const itemTypeTable = await loadItemTypes(archives)

    const isAPredicate = (type: string, target: string) => realIsA(type, target, itemTypeTable)

    const crystalSword: ItemBase = {
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

    const affixes = { prefixes, suffixes }
    const rareNames = { prefixes: rarePrefixes, suffixes: rareSuffixes }

    // Roll a magic sword at ilvl 50
    const rngMagic = new D2Rng(99999)
    const magicSword = rollMagicAffixes(crystalSword, 50, affixes, isAPredicate, rngMagic)

    expect(magicSword.alvl).toBe(50) // qlvl=11 <= trunc(50/2)=25 -> alvl=50
    expect(magicSword.affixes.length).toBeGreaterThanOrEqual(1)
    expect(magicSword.affixes.length).toBeLessThanOrEqual(2)
    expect(magicSword.name).toContain('Crystal Sword')

    // Roll a rare sword at ilvl 80
    const rngRare = new D2Rng(88888)
    const rareSword = rollRareAffixes(crystalSword, 80, affixes, rareNames, isAPredicate, rngRare)

    expect(rareSword.alvl).toBe(80)
    expect(rareSword.affixes.length).toBeGreaterThanOrEqual(3)
    expect(rareSword.affixes.length).toBeLessThanOrEqual(6)
    expect(rareSword.prefixes.length).toBeGreaterThanOrEqual(0)
    expect(rareSword.prefixes.length).toBeLessThanOrEqual(3)
    expect(rareSword.suffixes.length).toBeGreaterThanOrEqual(0)
    expect(rareSword.suffixes.length).toBeLessThanOrEqual(3)
    expect(rareSword.rarePrefix).toBeDefined()
    expect(rareSword.rareSuffix).toBeDefined()
    expect(rareSword.name).toBe(`${rareSword.rarePrefix!.name} ${rareSword.rareSuffix!.name}`)

    // Verify group mutex holds across all rolled affixes
    const seenGroups = new Set<number>()
    for (const affix of rareSword.affixes) {
      if (affix.group > 0) {
        expect(seenGroups.has(affix.group)).toBe(false)
        seenGroups.add(affix.group)
      }
    }
  })
})
