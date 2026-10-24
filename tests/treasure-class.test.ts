import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { parseTable } from '../src/common/world/acts.ts'
import {
  loadTreasureClasses,
  parseTreasureClassTable,
  TREASURE_CLASS_EX_TABLE_PATH,
  AUTO_TC_REGEX,
  isAutoTC,
  isClassicValidItem,
  type TreasureClassTable,
  type TreasureClassNode,
} from '../src/common/items/treasure-class.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

describe('TreasureClassEx Loader & Indexer (Issue #99)', () => {
  let archives: MountedArchives
  let table: TreasureClassTable

  beforeAll(async () => {
    if (!hasD2) {
      throw new Error('samples/d2 MPQ files required for TreasureClassEx test')
    }
    archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
    }
    const bytes = await archives.read(TREASURE_CLASS_EX_TABLE_PATH)
    const d2Table = parseTable(bytes)
    table = parseTreasureClassTable(d2Table)
  })

  it('correctly uses the canonical MPQ table path', () => {
    expect(TREASURE_CLASS_EX_TABLE_PATH).toBe('data\\global\\excel\\TreasureClassEx.txt')
  })

  it('loads treasure classes via loadTreasureClasses async helper', async () => {
    const loaded = await loadTreasureClasses(archives)
    expect(loaded.all.length).toBe(852)
    expect(loaded.byName.size).toBe(852)
    expect(loaded.get('Gold')?.name).toBe('Gold')
  })

  it('parses exactly 852 valid rows (853 raw data lines minus 1 blank line)', () => {
    expect(table.all.length).toBe(852)
    expect(table.byName.size).toBe(852)

    // First row is 'Gold'
    expect(table.all[0]?.name).toBe('Gold')

    // No blank row retained
    for (const node of table.all) {
      expect(node.name.trim()).not.toBe('')
    }
  })

  it('verifies group 1..18 sizes match the 1.13c gold standard', () => {
    const expectedGroupSizes: Record<number, number> = {
      1: 44,
      2: 36,
      3: 36,
      4: 36,
      5: 15,
      6: 45,
      7: 42,
      8: 42,
      9: 42,
      10: 42,
      11: 42,
      12: 42,
      13: 43,
      14: 42,
      15: 42,
      16: 15,
      17: 6,
      18: 90,
    }

    expect(table.byGroup.size).toBe(18)

    let totalGrouped = 0
    for (let g = 1; g <= 18; g++) {
      const groupList = table.byGroup.get(g)
      expect(groupList, `Group ${g} should exist`).toBeDefined()
      expect(groupList?.length, `Group ${g} size`).toBe(expectedGroupSizes[g])
      totalGrouped += groupList?.length ?? 0
    }

    expect(totalGrouped).toBe(702)

    // Ungrouped count: 852 - 702 = 150
    const ungrouped = table.all.filter(node => node.group === undefined)
    expect(ungrouped.length).toBe(150)
  })

  it('verifies each group is indexed with TCs sorted by level ascending', () => {
    for (let g = 1; g <= 18; g++) {
      const groupList = table.byGroup.get(g)!
      expect(groupList.length).toBeGreaterThan(0)
      for (let i = 1; i < groupList.length; i++) {
        const prev = groupList[i - 1]!
        const curr = groupList[i]!
        expect(
          curr.level,
          `Group ${g} index ${i} (${curr.name}, lvl ${curr.level}) should be >= index ${i - 1} (${prev.name}, lvl ${prev.level})`,
        ).toBeGreaterThanOrEqual(prev.level)
      }
    }

    // Special check for group 18 (which was unsorted in raw file: lvl 0 Ax..Cx after lvl 96)
    const g18 = table.byGroup.get(18)!
    expect(g18[0]?.level).toBe(0)
    expect(g18[g18.length - 1]?.level).toBe(96)
  })

  it('verifies item classification and exactly 218 dangling references (100 auto-TC + 118 base item codes)', () => {
    expect(table.danglingReferences.size).toBe(218)
    expect(table.autoTCDanglingReferences.size).toBe(100)
    expect(table.baseItemDanglingReferences.size).toBe(118)

    const allRecursiveTCs = new Set<string>()
    const allAutoTCs = new Set<string>()
    const allGolds = new Set<string>()
    const allGoldMuls = new Set<string>()
    const allUniqueItems = new Set<string>()
    const allBaseItems = new Set<string>()

    for (const node of table.all) {
      for (const it of node.items) {
        switch (it.kind) {
          case 'tc':
            allRecursiveTCs.add(it.item)
            expect(it.isDangling).toBe(false)
            expect(table.byName.has(it.item)).toBe(true)
            break
          case 'auto-tc':
            allAutoTCs.add(it.item)
            expect(it.isDangling).toBe(true)
            expect(isAutoTC(it.item)).toBe(true)
            break
          case 'gold':
            allGolds.add(it.item)
            expect(it.isDangling).toBe(true)
            expect(it.item).toBe('gld')
            break
          case 'gold-multiplier':
            allGoldMuls.add(it.item)
            expect(it.isDangling).toBe(true)
            expect(it.item.startsWith('gld,mul=')).toBe(true)
            break
          case 'unique-item':
            allUniqueItems.add(it.item)
            expect(it.isDangling).toBe(true)
            expect(it.item).toBe('Annihilus')
            break
          case 'base-item':
            allBaseItems.add(it.item)
            expect(it.isDangling).toBe(true)
            break
        }
      }
    }

    expect(allRecursiveTCs.size).toBe(357)
    expect(allAutoTCs.size).toBe(100)
    expect(allGolds.size).toBe(1)
    expect(allGoldMuls.size).toBe(3)
    expect(allUniqueItems.size).toBe(1)
    expect(allBaseItems.size).toBe(113)

    // 100 auto-TC + 118 other (1 gold + 3 gold muls + 1 Annihilus + 113 base items) = 218 dangling
    expect(allGolds.size + allGoldMuls.size + allUniqueItems.size + allBaseItems.size).toBe(118)
    expect(allAutoTCs.size + 118).toBe(218)

    // Total unique referenced item names: 357 TC + 218 dangling = 575
    const totalReferenced = new Set([...allRecursiveTCs, ...table.danglingReferences])
    expect(totalReferenced.size).toBe(575)
  })

  it('verifies gold multipliers are parsed correctly (gld,mul=...)', () => {
    const goldMulEntries = table.all
      .flatMap(node => node.items)
      .filter(it => it.kind === 'gold-multiplier')

    expect(goldMulEntries.length).toBeGreaterThan(0)

    for (const entry of goldMulEntries) {
      expect(entry.multiplier).toBeDefined()
      expect([1280, 1536, 2048]).toContain(entry.multiplier)
      expect(entry.item).toBe(`gld,mul=${entry.multiplier}`)
    }

    // Specific known boss drops
    const andarielNorm = table.get('Andariel')!
    expect(andarielNorm.items[0]?.item).toBe('gld,mul=1280')
    expect(andarielNorm.items[0]?.multiplier).toBe(1280)

    const andarielNightmare = table.get('Andariel (N)')!
    expect(andarielNightmare.items[0]?.item).toBe('gld,mul=1536')
    expect(andarielNightmare.items[0]?.multiplier).toBe(1536)

    const andarielHell = table.get('Andariel (H)')!
    expect(andarielHell.items[0]?.item).toBe('gld,mul=2048')
    expect(andarielHell.items[0]?.multiplier).toBe(2048)

    const durielHell = table.get('Duriel (H) - Base')!
    expect(durielHell.items[0]?.item).toBe('gld,mul=2048')
    expect(durielHell.items[0]?.multiplier).toBe(2048)
  })

  it('verifies Magic column is 1024 on all 231 non-empty rows', () => {
    const magicNodes = table.all.filter(node => node.magic > 0)
    expect(magicNodes.length).toBe(231)

    for (const node of magicNodes) {
      expect(node.magic).toBe(1024)
    }

    const nonMagicNodes = table.all.filter(node => node.magic === 0)
    expect(nonMagicNodes.length).toBe(852 - 231)
  })

  it('verifies prefix sums and classic vs expansion total probabilities', () => {
    // Jewelry A: rin:8, amu:4, jew:2, cm3:2, cm2:2, cm1:2
    const jewelryA = table.get('Jewelry A')!
    expect(jewelryA).toBeDefined()
    expect(jewelryA.items.length).toBe(6)
    expect(jewelryA.totalProbExpansion).toBe(20)
    expect(jewelryA.totalProbClassic).toBe(12)
    expect(jewelryA.cumulativeProbExpansion).toEqual([8, 12, 14, 16, 18, 20])

    // Act 2 Good: Jewelry B:20, Chipped Gem:12, Flawed Gem:4, Runes 1:3, Runes 2:3
    const act2Good = table.get('Act 2 Good')!
    expect(act2Good).toBeDefined()
    expect(act2Good.totalProbExpansion).toBe(42)
    expect(act2Good.totalProbClassic).toBe(36) // 42 - 3 (Runes 1) - 3 (Runes 2)
    expect(act2Good.cumulativeProbExpansion).toEqual([20, 32, 36, 39, 42])

    // Flying Scimitar (H): Act 2 (H) Good:3, scm:7, 9sm:18, 7sm:32
    const flyingScimitarH = table.get('Flying Scimitar (H)')!
    expect(flyingScimitarH).toBeDefined()
    expect(flyingScimitarH.totalProbExpansion).toBe(60)
    expect(flyingScimitarH.totalProbClassic).toBe(28) // 60 - 32 (7sm elite)

    // Check invariants across all 852 nodes
    for (const node of table.all) {
      expect(node.cumulativeProbExpansion.length).toBe(node.items.length)
      if (node.items.length > 0) {
        expect(node.cumulativeProbExpansion[node.cumulativeProbExpansion.length - 1]).toBe(
          node.totalProbExpansion,
        )
      }
      expect(node.totalProbClassic).toBeLessThanOrEqual(node.totalProbExpansion)
    }
  })

  it('verifies picks values match the 9 distinct signed values in 1.13c', () => {
    const distinctPicks = new Set(table.all.map(node => node.picks))
    expect(Array.from(distinctPicks).sort((a, b) => a - b)).toEqual([
      -4, -3, -2, 1, 2, 3, 4, 5, 7,
    ])

    // Countess has negative picks: -2
    expect(table.get('Countess')?.picks).toBe(-2)
    // Mephisto has positive picks: 7
    expect(table.get('Mephisto')?.picks).toBe(7)
  })

  it('supports case-insensitive lookup via .get() and .byName.get()', () => {
    expect(table.get('Gold')).toBeDefined()
    expect(table.get('gold')).toBeDefined()
    expect(table.get('  GOLD  ')).toBeDefined()
    expect(table.byName.get('gold')).toBeDefined()
    expect(table.byName.get('Act 1 Equip A')).toBeDefined()
    expect(table.byName.get('act 1 equip a')).toBeDefined()
    expect(table.get('NonExistentTC')).toBeUndefined()
  })

  it('verifies isClassicValidItem and isAutoTC helpers', () => {
    expect(isAutoTC('weap3')).toBe(true)
    expect(isAutoTC('armo87')).toBe(true)
    expect(isAutoTC('bow15')).toBe(true)
    expect(isAutoTC('mele39')).toBe(true)
    expect(isAutoTC('rin')).toBe(false)
    expect(isAutoTC('Gold')).toBe(false)

    // Classic valid items
    expect(isClassicValidItem('rin')).toBe(true)
    expect(isClassicValidItem('amu')).toBe(true)
    expect(isClassicValidItem('hp1')).toBe(true)
    expect(isClassicValidItem('gld')).toBe(true)
    expect(isClassicValidItem('scm')).toBe(true)
    expect(isClassicValidItem('9sm')).toBe(true)

    // Expansion-only items
    expect(isClassicValidItem('r01')).toBe(false)
    expect(isClassicValidItem('r33')).toBe(false)
    expect(isClassicValidItem('Runes 1')).toBe(false)
    expect(isClassicValidItem('jew')).toBe(false)
    expect(isClassicValidItem('cm1')).toBe(false)
    expect(isClassicValidItem('cm2')).toBe(false)
    expect(isClassicValidItem('cm3')).toBe(false)
    expect(isClassicValidItem('Annihilus')).toBe(false)
    expect(isClassicValidItem('7sm')).toBe(false)
    expect(isClassicValidItem('Countess Rune')).toBe(false)
    expect(isClassicValidItem('pk1')).toBe(false)
    expect(isClassicValidItem('tes')).toBe(false)
  })
})
