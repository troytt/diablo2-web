import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import {
  calculateAlvl,
  rollMagicAffixes,
  rollRareAffixes,
  getItemTypeCode,
  getBaseQlvl,
  getBaseMagicLvl,
  getAffixWeight,
  pickWeightedAffix,
  RARE_AFFIX_COUNT_TABLE,
  isJewelItemBase,
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

describe('Affix Generator - alvl calculation (D2Game.dll 0x6FC34604..0x6FC34657, Issue #1429)', () => {
  it('matches 1.13c D2Game.dll 0x6FC34604..0x6FC34657 acceptance test vectors', () => {
    // i = max(ilvl, qlvl)
    // if (magicLvl > 0) alvl = i + magicLvl
    // else if (i < 99 - trunc(qlvl / 2)) alvl = i - trunc(qlvl / 2)
    // else alvl = 2 * i - 99
    // clamped to [1, 99]
    expect(calculateAlvl(85, 30, 0)).toBe(71) // i=85 >= 99-15=84 -> 2*85 - 99 = 71
    expect(calculateAlvl(40, 30, 0)).toBe(25) // i=40 < 84 -> 40 - 15 = 25
    expect(calculateAlvl(10, 30, 0)).toBe(15) // i=max(10,30)=30 < 84 -> 30 - 15 = 15
    expect(calculateAlvl(50, 3, 18)).toBe(68) // i=50, magicLvl=18 -> 50 + 18 = 68
    expect(calculateAlvl(99, 1, 0)).toBe(99)  // i=99 >= 99-0=99 -> 2*99 - 99 = 99
  })

  it('calculates alvl with magicLvl bonus using i = max(ilvl, qlvl)', () => {
    // ilvl=10, qlvl=20 -> i=20; 20 + 5 = 25
    expect(calculateAlvl(10, 20, 5)).toBe(25)
    // ilvl=20, qlvl=15 -> i=20; 20 + 3 = 23
    expect(calculateAlvl(20, 15, 3)).toBe(23)
    // Diadem (qlvl=85, magicLvl=18) at any ilvl -> i=85, 85+18=103 -> clamped to 99
    expect(calculateAlvl(1, 85, 18)).toBe(99)
    expect(calculateAlvl(85, 85, 18)).toBe(99)
    // Capped at 99
    expect(calculateAlvl(95, 80, 10)).toBe(99)
  })

  it('calculates alvl in low/mid branch (i < 99 - trunc(qlvl / 2)) without magicLvl', () => {
    // ilvl=30, qlvl=40 -> i=40 < 99-20=79 -> 40 - 20 = 20
    expect(calculateAlvl(30, 40)).toBe(20)
    expect(calculateAlvl(30, 40, 0)).toBe(20)

    // ilvl=20, qlvl=16 -> i=20 < 99-8=91 -> 20 - 8 = 12
    expect(calculateAlvl(20, 16)).toBe(12)

    // ilvl=50, qlvl=26 -> i=50 < 99-13=86 -> 50 - 13 = 37
    expect(calculateAlvl(50, 26)).toBe(37)

    // ilvl=50, qlvl=20 -> i=50 < 99-10=89 -> 50 - 10 = 40
    expect(calculateAlvl(50, 20)).toBe(40)
  })

  it('calculates alvl in high branch (i >= 99 - trunc(qlvl / 2)) as 2*i - 99', () => {
    // Exact boundary: ilvl=84, qlvl=30 -> halfQlvl=15, 99-15=84; i=84 >= 84 -> 2*84 - 99 = 69
    expect(calculateAlvl(84, 30, 0)).toBe(69)
    // Just below boundary: ilvl=83, qlvl=30 -> i=83 < 84 -> 83 - 15 = 68
    expect(calculateAlvl(83, 30, 0)).toBe(68)
    // ilvl=90, qlvl=60 -> i=90 >= 99-30=69 -> 2*90 - 99 = 81
    expect(calculateAlvl(90, 60, 0)).toBe(81)
    // Clamped to [1, 99]
    expect(calculateAlvl(105, 20, 0)).toBe(99)
    expect(calculateAlvl(1, 2, 0)).toBe(1)
  })

  it('defaults magicLvl to 0 when omitted', () => {
    expect(calculateAlvl(40, 50)).toBe(calculateAlvl(40, 50, 0))
    expect(calculateAlvl(60, 20)).toBe(calculateAlvl(60, 20, 0))
  })
})

describe('Affix Generator - magicLvl weighting & rand(total+1) roll (D2Game.dll 0x6FC3478B..0x6FC34889, Issue #1429)', () => {
  it('weights candidates by frequency * level when magicLvl > 0 (e.g. circlet/wand/staff/orb)', () => {
    const lowLevelAffix = { name: 'LowLvl', frequency: 4, level: 2 }
    const highLevelAffix = { name: 'HighLvl', frequency: 4, level: 25 }

    // magicLvl === 0 -> weight = frequency
    expect(getAffixWeight(lowLevelAffix, 0)).toBe(4)
    expect(getAffixWeight(highLevelAffix, 0)).toBe(4)

    // magicLvl > 0 (e.g. ci3=18, wand/staf/orb=1) -> weight = frequency * level
    expect(getAffixWeight(lowLevelAffix, 18)).toBe(8)
    expect(getAffixWeight(highLevelAffix, 18)).toBe(100)
    expect(getAffixWeight(lowLevelAffix, 1)).toBe(8)
    expect(getAffixWeight(highLevelAffix, 1)).toBe(100)

    const candidates = [lowLevelAffix, highLevelAffix]
    let highCountNormal = 0
    let highCountMagicLvl = 0
    for (let seed = 1; seed <= 300; seed++) {
      const pickedNormal = pickWeightedAffix(candidates, new D2Rng(seed), 0)
      if (pickedNormal?.name === 'HighLvl') highCountNormal++

      const pickedMagicLvl = pickWeightedAffix(candidates, new D2Rng(seed), 18)
      if (pickedMagicLvl?.name === 'HighLvl') highCountMagicLvl++
    }
    // With magicLvl=18, HighLvl has weight 100 vs LowLvl weight 8 (>90% of hits)
    expect(highCountMagicLvl).toBeGreaterThan(highCountNormal + 80)
  })

  it('returns null when rand(totalWeight + 1) hits totalWeight (0x6FC347FC..0x6FC34889)', () => {
    const candidates = [
      { name: 'A', frequency: 2, level: 1 },
      { name: 'B', frequency: 3, level: 1 },
    ]
    // totalWeight = 5, so rng.rand(6) is called.
    // Find a deterministic seed where new D2Rng(seed).rand(6) === 5
    let hitNullSeed = -1
    for (let seed = 1; seed <= 500; seed++) {
      const probe = new D2Rng(seed)
      if (probe.rand(6) === 5) {
        hitNullSeed = seed
        break
      }
    }
    expect(hitNullSeed).toBeGreaterThan(0)

    const rng = new D2Rng(hitNullSeed)
    expect(pickWeightedAffix(candidates, rng, 0)).toBeNull()
  })

  it('returns null without uniform fallback when totalWeight <= 0', () => {
    const zeroFreqCandidates = [
      { name: 'Zero1', frequency: 0, level: 10 },
      { name: 'Zero2', frequency: 0, level: 20 },
    ]
    expect(pickWeightedAffix(zeroFreqCandidates, new D2Rng(42), 0)).toBeNull()
    expect(pickWeightedAffix(zeroFreqCandidates, new D2Rng(42), 18)).toBeNull()
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

    expect(magicSword.alvl).toBe(45) // i=50 < 99-trunc(11/2)=94 -> 50 - 5 = 45
    expect(magicSword.affixes.length).toBeGreaterThanOrEqual(1)
    expect(magicSword.affixes.length).toBeLessThanOrEqual(2)
    expect(magicSword.name).toContain('Crystal Sword')

    // Roll a rare sword at ilvl 80
    const rngRare = new D2Rng(88888)
    const rareSword = rollRareAffixes(crystalSword, 80, affixes, rareNames, isAPredicate, rngRare)

    expect(rareSword.alvl).toBe(75) // i=80 < 99-5=94 -> 80 - 5 = 75
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


describe('Affix Generator - 1.13c Magic & Rare Affix Count / Slot Distributions (Issue #1430)', () => {
  const mockIsA = (type: string, target: string): boolean => {
    if (type === target) return true
    if (type === 'swor' && target === 'weap') return true
    if (type === 'jewl' && target === 'misc') return true
    return false
  }

  const swordBase: ItemBase = {
    id: 'crs',
    name: 'Crystal Sword',
    kind: 'weapon',
    invWidth: 2,
    invHeight: 3,
    maxStack: 1,
    value: 100,
    damage: 15,
    defense: 0,
    tags: ['weap', 'swor'],
    level: 11,
  }

  const jewelBase: ItemBase = {
    id: 'jew',
    name: 'Jewel',
    kind: 'misc',
    invWidth: 1,
    invHeight: 1,
    maxStack: 1,
    value: 100,
    damage: 0,
    defense: 0,
    tags: ['misc', 'jewl'],
    level: 1,
  }

  function createAffixPool(isPrefix: boolean, count: number, itype = 'swor'): MagicAffix[] {
    const out: MagicAffix[] = []
    for (let i = 1; i <= count; i++) {
      out.push({
        name: isPrefix ? `Pre${i}` : `of Suf${i}`,
        isPrefix,
        version: 1,
        spawnable: true,
        rare: true,
        level: 1,
        maxlevel: 0,
        levelreq: 1,
        frequency: 100,
        group: (isPrefix ? 100 : 200) + i,
        mods: [{ code: 'hp', min: 10, max: 10 }],
        transform: false,
        itypes: [itype],
        etypes: [],
      })
    }
    return out
  }

  const swordAffixes = {
    prefixes: { all: createAffixPool(true, 10, 'swor') } as unknown as AffixTable,
    suffixes: { all: createAffixPool(false, 10, 'swor') } as unknown as AffixTable,
  }

  const jewelAffixes = {
    prefixes: { all: createAffixPool(true, 10, 'jewl') } as unknown as AffixTable,
    suffixes: { all: createAffixPool(false, 10, 'jewl') } as unknown as AffixTable,
  }

  const mockRareNames = {
    prefixes: {
      getEligible: () => [{ index: 0, name: 'Raven', itypes: [], etypes: [] }],
    } as unknown as RareNameTable,
    suffixes: {
      getEligible: () => [{ index: 0, name: 'Song', itypes: [], etypes: [] }],
    } as unknown as RareNameTable,
  }

  it('exports RARE_AFFIX_COUNT_TABLE matching D2Game.dll .rdata 0x6FD1D058 ([3, 4, 4, 5, 5, 5, 6, 6])', () => {
    expect(RARE_AFFIX_COUNT_TABLE).toEqual([3, 4, 4, 5, 5, 5, 6, 6])
    expect(isJewelItemBase(jewelBase)).toBe(true)
    expect(isJewelItemBase(swordBase)).toBe(false)
  })

  it('Magic affix distribution over 100,000 rolls matches 1.13c D2Game.dll 0x6FC303C0 (25% prefix-only, 50% suffix-only, 25% both)', () => {
    const rng = new D2Rng(0x1337c0de)
    const total = 100_000
    let prefixOnly = 0
    let suffixOnly = 0
    let both = 0

    for (let i = 0; i < total; i++) {
      const res = rollMagicAffixes(swordBase, 50, swordAffixes, mockIsA, rng)
      if (res.prefix && !res.suffix) prefixOnly++
      else if (!res.prefix && res.suffix) suffixOnly++
      else if (res.prefix && res.suffix) both++
    }

    const prefixOnlyRatio = prefixOnly / total
    const suffixOnlyRatio = suffixOnly / total
    const bothRatio = both / total

    // Theoretical: 0.25, 0.50, 0.25 (with high totalWeight=1000, null pick is 1/1001 < 0.001)
    expect(prefixOnlyRatio).toBeGreaterThan(0.24)
    expect(prefixOnlyRatio).toBeLessThan(0.26)
    expect(suffixOnlyRatio).toBeGreaterThan(0.49)
    expect(suffixOnlyRatio).toBeLessThan(0.51)
    expect(bothRatio).toBeGreaterThan(0.24)
    expect(bothRatio).toBeLessThan(0.26)
  })

  it('Expansion Rare affix count distribution over 100,000 rolls matches D2Game.dll 0x6FC35240 (12.5% / 25% / 37.5% / 25%)', () => {
    const rng = new D2Rng(0xdeadbeef)
    const total = 100_000
    const counts: Record<number, number> = { 3: 0, 4: 0, 5: 0, 6: 0 }

    for (let i = 0; i < total; i++) {
      const res = rollRareAffixes(swordBase, 50, swordAffixes, mockRareNames, mockIsA, rng)
      const n = res.affixes.length
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(6)
      counts[n] = (counts[n] ?? 0) + 1
    }

    const r3 = counts[3]! / total
    const r4 = counts[4]! / total
    const r5 = counts[5]! / total
    const r6 = counts[6]! / total

    // Theoretical: 1/8 = 0.125, 2/8 = 0.25, 3/8 = 0.375, 2/8 = 0.25
    expect(r3).toBeGreaterThan(0.118)
    expect(r3).toBeLessThan(0.132)
    expect(r4).toBeGreaterThan(0.242)
    expect(r4).toBeLessThan(0.258)
    expect(r5).toBeGreaterThan(0.367)
    expect(r5).toBeLessThan(0.383)
    expect(r6).toBeGreaterThan(0.242)
    expect(r6).toBeLessThan(0.258)
  })

  it('Rare Jewel affix count is strictly 3 or 4 (~50% each) per D2Game.dll 0x6FC352C4..0x6FC352DF', () => {
    const rng = new D2Rng(0x42424242)
    const total = 10_000
    let count3 = 0
    let count4 = 0

    for (let i = 0; i < total; i++) {
      const res = rollRareAffixes(jewelBase, 50, jewelAffixes, mockRareNames, mockIsA, rng)
      const n = res.affixes.length
      expect(n === 3 || n === 4).toBe(true)
      expect(res.prefixes.length).toBeLessThanOrEqual(3)
      expect(res.suffixes.length).toBeLessThanOrEqual(3)
      if (n === 3) count3++
      if (n === 4) count4++
    }

    expect(count3 / total).toBeGreaterThan(0.48)
    expect(count3 / total).toBeLessThan(0.52)
    expect(count4 / total).toBeGreaterThan(0.48)
    expect(count4 / total).toBeLessThan(0.52)
  })

  it('Classic Rare non-jewel affix count is 4..6 uniform per D2Game.dll 0x6FC34FC0..0x6FC34FDC', () => {
    const rng = new D2Rng(0xabcdef01)
    const total = 15_000
    const counts: Record<number, number> = { 4: 0, 5: 0, 6: 0 }

    for (let i = 0; i < total; i++) {
      const res = rollRareAffixes(swordBase, 50, swordAffixes, mockRareNames, mockIsA, rng, {
        isExpansion: false,
      })
      const n = res.affixes.length
      expect(n).toBeGreaterThanOrEqual(4)
      expect(n).toBeLessThanOrEqual(6)
      counts[n] = (counts[n] ?? 0) + 1
    }

    expect(counts[4]! / total).toBeGreaterThan(0.31)
    expect(counts[4]! / total).toBeLessThan(0.35)
    expect(counts[5]! / total).toBeGreaterThan(0.31)
    expect(counts[5]! / total).toBeLessThan(0.35)
    expect(counts[6]! / total).toBeGreaterThan(0.31)
    expect(counts[6]! / total).toBeLessThan(0.35)
  })

  it('retries current slot on opposite side without losing slot when one side runs out of candidates (0x6FC35330..0x6FC35430)', () => {
    // Only 1 prefix available, 3 suffixes available -> any 4-affix roll must still produce 4 affixes (1 prefix + 3 suffixes)
    const onePreThreeSuf = {
      prefixes: { all: createAffixPool(true, 1, 'swor') } as unknown as AffixTable,
      suffixes: { all: createAffixPool(false, 3, 'swor') } as unknown as AffixTable,
    }
    const rng = new D2Rng(0x99887766)
    for (let i = 0; i < 200; i++) {
      const res = rollRareAffixes(swordBase, 50, onePreThreeSuf, mockRareNames, mockIsA, rng)
      expect(res.affixes.length).toBeGreaterThanOrEqual(3)
      expect(res.affixes.length).toBeLessThanOrEqual(4)
      expect(res.prefixes.length).toBeLessThanOrEqual(1)
      expect(res.suffixes.length).toBeLessThanOrEqual(3)
    }
  })
})
