import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { parseTable } from '../src/common/world/acts.ts'
import {
  ITEM_RATIO_TABLE_PATH,
  MF_FACTOR_UNIQUE,
  MF_FACTOR_SET,
  MF_FACTOR_RARE,
  DEFAULT_ITEM_RATIO_ROWS,
  DEFAULT_ITEM_RATIO_TABLE,
  effectiveMF,
  calculateUniqueChance,
  calculateSetChance,
  calculateRareChance,
  calculateMagicChance,
  calculateSuperiorChance,
  calculateNormalChance,
  rollItemQuality,
  parseItemRatioTable,
  loadItemRatio,
  type ItemRatioRow,
  type ItemRatioTable,
  type QualityRollRng,
} from '../src/common/items/item-ratio.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

describe('ItemRatio Quality Determination (Issue #102)', () => {
  let archives: MountedArchives
  let loadedTable: ItemRatioTable

  beforeAll(async () => {
    if (hasD2) {
      archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      loadedTable = await loadItemRatio(archives)
    }
  })

  describe('1. Table Loading and Row Lookup', () => {
    it('uses the canonical MPQ table path', () => {
      expect(ITEM_RATIO_TABLE_PATH).toBe('data\\global\\excel\\ItemRatio.txt')
    })

    it('parses exactly 6 rows from MPQ table', () => {
      if (!hasD2) return
      expect(loadedTable.length).toBe(6)
      expect(loadedTable.rows.length).toBe(6)
    })

    it('matches canonical 1.13c values in default and loaded table', () => {
      const table = loadedTable ?? DEFAULT_ITEM_RATIO_TABLE

      // Row 0: Classic, Normal, Generic (version=0, uber=0, classSpecific=0)
      const r0 = table.getRow(0, 0, 0)!
      expect(r0).toBeDefined()
      expect(r0.version).toBe(0)
      expect(r0.uber).toBe(0)
      expect(r0.classSpecific).toBe(0)
      expect(r0.unique).toBe(400)
      expect(r0.uniqueDiv).toBe(2)
      expect(r0.uniqueMin).toBe(6400)
      expect(r0.rare).toBe(160)
      expect(r0.rareDiv).toBe(3)
      expect(r0.rareMin).toBe(3200)
      expect(r0.set).toBe(125)
      expect(r0.setDiv).toBe(6)
      expect(r0.setMin).toBe(5600)
      expect(r0.magic).toBe(30)
      expect(r0.magicDiv).toBe(16)
      expect(r0.magicMin).toBe(192)
      expect(r0.hiQual).toBe(12)
      expect(r0.hiQualDiv).toBe(16)
      expect(r0.normal).toBe(4)
      expect(r0.normalDiv).toBe(8)

      // Row 2: Expansion, Normal, Generic (version=1, uber=0, classSpecific=0)
      const r2 = table.getRow(1, 0, 0)!
      expect(r2).toBeDefined()
      expect(r2.version).toBe(1)
      expect(r2.uber).toBe(0)
      expect(r2.classSpecific).toBe(0)
      expect(r2.unique).toBe(400)
      expect(r2.uniqueDiv).toBe(1)
      expect(r2.uniqueMin).toBe(6400)
      expect(r2.rare).toBe(100)
      expect(r2.rareDiv).toBe(2)
      expect(r2.rareMin).toBe(3200)
      expect(r2.set).toBe(160)
      expect(r2.setDiv).toBe(2)
      expect(r2.setMin).toBe(5600)
      expect(r2.magic).toBe(34)
      expect(r2.magicDiv).toBe(3)
      expect(r2.magicMin).toBe(192)
      expect(r2.hiQual).toBe(12)
      expect(r2.hiQualDiv).toBe(8)
      expect(r2.normal).toBe(2)
      expect(r2.normalDiv).toBe(2)

      // Row 4: Expansion, Normal, ClassSpecific (version=1, uber=0, classSpecific=1)
      const r4 = table.getRow(1, 0, 1)!
      expect(r4).toBeDefined()
      expect(r4.version).toBe(1)
      expect(r4.uber).toBe(0)
      expect(r4.classSpecific).toBe(1)
      expect(r4.unique).toBe(240)
      expect(r4.uniqueDiv).toBe(3)
      expect(r4.magic).toBe(17)
      expect(r4.magicDiv).toBe(6)

      // Row 5: Expansion, Uber, ClassSpecific (version=1, uber=1, classSpecific=1)
      const r5 = table.getRow(1, 1, 1)!
      expect(r5).toBeDefined()
      expect(r5.version).toBe(1)
      expect(r5.uber).toBe(1)
      expect(r5.classSpecific).toBe(1)
      expect(r5.normal).toBe(1)
      expect(r5.normalDiv).toBe(1)
    })

    it('correctly handles boolean flags in getRow', () => {
      const table = DEFAULT_ITEM_RATIO_TABLE
      const row = table.getRow(true, false, true)
      expect(row).toBeDefined()
      expect(row?.version).toBe(1)
      expect(row?.uber).toBe(0)
      expect(row?.classSpecific).toBe(1)
    })

    it('falls back gracefully when querying classic class-specific row', () => {
      // Classic has no class-specific items in vanilla, falls back to LoD class-specific
      const table = DEFAULT_ITEM_RATIO_TABLE
      const row = table.getRow(0, 0, 1)
      expect(row).toBeDefined()
      expect(row?.classSpecific).toBe(1)
    })

    it('parses D2Table via parseItemRatioTable with custom headers', () => {
      const sampleText =
        'Function\tVersion\tUber\tClass Specific\tUnique\tUniqueDiv\tUniqueMin\tRare\tRareDiv\tRareMin\tSet\tSetDiv\tSetMin\tMagic\tMagicDiv\tMagicMin\tHiQual\tHiQualDiv\tNormal\tNormalDiv\n' +
        'Custom\t1\t0\t0\t500\t2\t6000\t120\t3\t3000\t180\t4\t5000\t40\t5\t200\t15\t10\t5\t3\n'
      const rawBytes = new TextEncoder().encode(sampleText)
      const d2t = parseTable(rawBytes)
      const parsed = parseItemRatioTable(d2t)
      expect(parsed.length).toBe(1)
      const r = parsed.getRow(1, 0, 0)!
      expect(r.unique).toBe(500)
      expect(r.uniqueDiv).toBe(2)
      expect(r.uniqueMin).toBe(6000)
      expect(r.rare).toBe(120)
      expect(r.set).toBe(180)
      expect(r.magic).toBe(40)
      expect(r.hiQual).toBe(15)
      expect(r.normal).toBe(5)
    })
  })

  describe('2. Effective Magic Find Formula (D2Game!6FC2E130)', () => {
    it('has NO diminishing returns when mf <= 10', () => {
      // When x = mf + 100 <= 110, returns x
      expect(effectiveMF(-20, MF_FACTOR_UNIQUE)).toBe(80)
      expect(effectiveMF(0, MF_FACTOR_UNIQUE)).toBe(100)
      expect(effectiveMF(1, MF_FACTOR_UNIQUE)).toBe(101)
      expect(effectiveMF(5, MF_FACTOR_UNIQUE)).toBe(105)
      expect(effectiveMF(10, MF_FACTOR_UNIQUE)).toBe(110)
      expect(effectiveMF(10, MF_FACTOR_SET)).toBe(110)
      expect(effectiveMF(10, MF_FACTOR_RARE)).toBe(110)
    })

    it('applies diminishing returns strictly when mf > 10', () => {
      // mf = 11 for Unique (factor = 250):
      // 100 + Math.trunc((11 * 250) / (11 + 250)) = 100 + Math.trunc(2750 / 261) = 100 + 10 = 110
      expect(effectiveMF(11, MF_FACTOR_UNIQUE)).toBe(110)

      // mf = 12 for Unique:
      // 100 + Math.trunc((12 * 250) / (12 + 250)) = 100 + Math.trunc(3000 / 262) = 100 + 11 = 111
      expect(effectiveMF(12, MF_FACTOR_UNIQUE)).toBe(111)

      // mf = 100:
      // Unique (250): 100 + Math.trunc((100 * 250) / 350) = 100 + Math.trunc(25000 / 350) = 100 + 71 = 171
      expect(effectiveMF(100, MF_FACTOR_UNIQUE)).toBe(171)
      // Set (500): 100 + Math.trunc((100 * 500) / 600) = 100 + Math.trunc(50000 / 600) = 100 + 83 = 183
      expect(effectiveMF(100, MF_FACTOR_SET)).toBe(183)
      // Rare (600): 100 + Math.trunc((100 * 600) / 700) = 100 + Math.trunc(60000 / 700) = 100 + 85 = 185
      expect(effectiveMF(100, MF_FACTOR_RARE)).toBe(185)

      // mf = 300:
      // Unique (250): 100 + Math.trunc((300 * 250) / 550) = 100 + Math.trunc(75000 / 550) = 100 + 136 = 236
      expect(effectiveMF(300, MF_FACTOR_UNIQUE)).toBe(236)
      // Set (500): 100 + Math.trunc((300 * 500) / 800) = 100 + Math.trunc(150000 / 800) = 100 + 187 = 287
      expect(effectiveMF(300, MF_FACTOR_SET)).toBe(287)
      // Rare (600): 100 + Math.trunc((300 * 600) / 900) = 100 + Math.trunc(180000 / 900) = 100 + 200 = 300
      expect(effectiveMF(300, MF_FACTOR_RARE)).toBe(300)
    })
  })

  describe('3. Exact Integer Truncation at Each Step (D2Game!6FC2FC40)', () => {
    const row = DEFAULT_ITEM_RATIO_ROWS[2] // Expansion, Normal, Generic

    it('strictly replicates Andariel Hell ring drop example from KB 320', () => {
      // Ring (qlvl=1) dropped by Hell Andariel (ilvl=78), MF=300, TC factor=995
      // D = 78 - 1 = 77
      // divisor = 1
      // base chance = (400 - 77) * 128 = 323 * 128 = 41344
      // e = effectiveMF(300, 250) = 236
      // chance after MF = Math.trunc(41344 * 100 / 236) = Math.trunc(4134400 / 236) = 17518
      // uniqueMin = 6400 (17518 > 6400, no clamp)
      // tcFactor reduction = Math.trunc(995 * 17518 / 1024) = Math.trunc(17430410 / 1024) = 17021
      // final chance = 17518 - 17021 = 497
      const chance = calculateUniqueChance(row, 78, 1, 300, 995)
      expect(chance).toBe(497)
    })

    it('handles negative D (ilvl < qlvl) with strict signed integer truncation toward zero', () => {
      // ilvl = 20, qlvl = 35 => D = -15
      // divisor = 2 (using Row 0: uniqueDiv = 2)
      // Math.trunc(-15 / 2) = -7 (NOT Math.floor which would be -8)
      // base = 400 => 400 - (-7) = 407
      // chance = 407 * 128 = 52096
      const classicRow = DEFAULT_ITEM_RATIO_ROWS[0]
      const chance = calculateUniqueChance(classicRow, 20, 35, 0, 0)
      expect(chance).toBe(52096)
    })

    it('clamps chance up to uniqueMin when calculated chance is lower', () => {
      // If ilvl is very high and qlvl is 1, chance without clamp would drop below 6400
      // row.unique = 400, uniqueDiv = 1, ilvl = 95, qlvl = 1 => D = 94
      // chance = (400 - 94) * 128 = 306 * 128 = 39168
      // With high MF (e.g. 1000):
      // e = 100 + Math.trunc(250000 / 1250) = 100 + 200 = 300
      // chance = Math.trunc(39168 * 100 / 300) = 13056
      // Now suppose base is modified or tcFactor is 0:
      const customRow: ItemRatioRow = {
        ...row,
        unique: 50,
        uniqueDiv: 1,
        uniqueMin: 6400,
      }
      // D = 40, base - D = 10, 10 * 128 = 1280 < 6400
      const chance = calculateUniqueChance(customRow, 41, 1, 0, 0)
      expect(chance).toBe(6400) // Clamped to uniqueMin!
    })

    it('Magic quality has NO diminishing returns', () => {
      // Magic formula: chance = Math.trunc(chance * 100 / (mf + 100))
      // Row 2: magic = 34, magicDiv = 3, magicMin = 192
      // ilvl = 10, qlvl = 1 => D = 9 => Math.trunc(9 / 3) = 3
      // base chance = (34 - 3) * 128 = 31 * 128 = 3968
      // With MF = 300: divisor is mf + 100 = 400 (NOT diminished e = 236/287/300)
      // chance = Math.trunc(3968 * 100 / 400) = Math.trunc(396800 / 400) = 992
      const chance = calculateMagicChance(row, 10, 1, 300, 0)
      expect(chance).toBe(992)
    })

    it('Superior and Normal do NOT take MF', () => {
      // Superior: (hiQual - Math.trunc(D / hiQualDiv)) * 128
      // Normal: (normal - Math.trunc(D / normalDiv)) * 128
      const sup0 = calculateSuperiorChance(row, 50, 10)
      const sup1000 = calculateSuperiorChance(row, 50, 10)
      expect(sup0).toBe(sup1000)

      const norm0 = calculateNormalChance(row, 50, 10)
      const norm1000 = calculateNormalChance(row, 50, 10)
      expect(norm0).toBe(norm1000)

      // Verify exact calculation for Superior:
      // Row 2: hiQual = 12, hiQualDiv = 8
      // ilvl = 50, qlvl = 10 => D = 40 => Math.trunc(40 / 8) = 5
      // (12 - 5) * 128 = 7 * 128 = 896
      expect(sup0).toBe(896)

      // Verify exact calculation for Normal:
      // Row 2: normal = 2, normalDiv = 2
      // D = 40 => Math.trunc(40 / 2) = 20
      // (2 - 20) * 128 = -18 * 128 = -2304
      expect(norm0).toBe(-2304)
    })

    it('tcFactor = 1024 guarantees hit (chance <= 0)', () => {
      // tcFactor reduction: Math.trunc(1024 * chance / 1024) = chance
      // chance - chance = 0 <= 0
      const uniqueChance = calculateUniqueChance(row, 10, 1, 0, 1024)
      expect(uniqueChance).toBe(0)

      const setChance = calculateSetChance(row, 10, 1, 0, 1024)
      expect(setChance).toBe(0)

      const rareChance = calculateRareChance(row, 10, 1, 0, 1024)
      expect(rareChance).toBe(0)

      const magicChance = calculateMagicChance(row, 10, 1, 0, 1024)
      expect(magicChance).toBe(0)
    })
  })

  describe('4. Quality Roll Sequence: Unique -> Set -> Rare -> Magic -> Superior -> Normal/Low', () => {
    it('returns "unique" when unique roll succeeds', () => {
      // Mock RNG that always returns 0 (< 128)
      const mockRng: QualityRollRng = { rand: () => 0 }
      const quality = rollItemQuality({
        ilvl: 80,
        qlvl: 10,
        mf: 100,
        rng: mockRng,
      })
      expect(quality).toBe('unique')
    })

    it('CRITICAL: rolls Set BEFORE Rare even though table columns are Unique->Rare->Set', () => {
      // Sequence of RNG rolls:
      // 1st roll (Unique): returns 200 (>= 128, fails)
      // 2nd roll (Set): returns 50 (< 128, succeeds!)
      // If order were Unique->Rare->Set, Rare would have consumed 50 and returned rare.
      // Because order is Unique->Set->Rare, Set consumes 50 and returns 'set'!
      const rolls = [200, 50, 200, 200]
      let index = 0
      const mockRng: QualityRollRng = {
        rand: () => rolls[index++] ?? 200,
      }

      const quality = rollItemQuality({
        ilvl: 50,
        qlvl: 10,
        rng: mockRng,
      })
      expect(quality).toBe('set')
      expect(index).toBe(2) // Exactly 2 rolls were consumed: Unique, then Set!
    })

    it('rolls Rare if Unique and Set fail', () => {
      const rolls = [200, 200, 50, 200]
      let index = 0
      const mockRng: QualityRollRng = {
        rand: () => rolls[index++] ?? 200,
      }

      const quality = rollItemQuality({
        ilvl: 50,
        qlvl: 10,
        rng: mockRng,
      })
      expect(quality).toBe('rare')
      expect(index).toBe(3) // Unique, Set, Rare!
    })

    it('rolls Magic if Unique, Set, and Rare fail', () => {
      const rolls = [200, 200, 200, 50]
      let index = 0
      const mockRng: QualityRollRng = {
        rand: () => rolls[index++] ?? 200,
      }

      const quality = rollItemQuality({
        ilvl: 50,
        qlvl: 10,
        rng: mockRng,
      })
      expect(quality).toBe('magic')
      expect(index).toBe(4) // Unique, Set, Rare, Magic!
    })

    it('rolls Superior if Unique, Set, Rare, and Magic fail', () => {
      const rolls = [200, 200, 200, 200, 50]
      let index = 0
      const mockRng: QualityRollRng = {
        rand: () => rolls[index++] ?? 200,
      }

      const quality = rollItemQuality({
        ilvl: 50,
        qlvl: 10,
        rng: mockRng,
      })
      expect(quality).toBe('superior')
      expect(index).toBe(5) // Unique, Set, Rare, Magic, Superior!
    })

    it('rolls Normal if Superior fails and Normal roll succeeds', () => {
      const rolls = [200, 200, 200, 200, 200, 50]
      let index = 0
      const mockRng: QualityRollRng = {
        rand: () => rolls[index++] ?? 200,
      }

      const quality = rollItemQuality({
        ilvl: 5,
        qlvl: 10, // D = -5 so Normal chance > 0
        rng: mockRng,
      })
      expect(quality).toBe('normal')
      expect(index).toBe(6)
    })

    it('rolls Low if Superior fails and Normal roll fails', () => {
      const rolls = [200, 200, 200, 200, 200, 200]
      let index = 0
      const mockRng: QualityRollRng = {
        rand: () => rolls[index++] ?? 200,
      }

      const quality = rollItemQuality({
        ilvl: 5,
        qlvl: 10,
        rng: mockRng,
      })
      expect(quality).toBe('low')
      expect(index).toBe(6)
    })

    it('guarantees quality without consuming RNG if tcFactor = 1024', () => {
      let rngCalled = false
      const mockRng: QualityRollRng = {
        rand: () => {
          rngCalled = true
          return 999
        },
      }

      const quality = rollItemQuality({
        ilvl: 10,
        qlvl: 10,
        tcFactor: 1024,
        rng: mockRng,
      })
      expect(quality).toBe('unique')
      expect(rngCalled).toBe(false) // chance <= 0 returns immediately without RNG
    })

    it('respects quality disable flags', () => {
      // If allowUnique = false, jumps straight to Set
      const mockRng: QualityRollRng = { rand: () => 0 }
      const quality = rollItemQuality({
        ilvl: 50,
        qlvl: 10,
        allowUnique: false,
        rng: mockRng,
      })
      expect(quality).toBe('set')
    })
  })

  describe('5. Negative Magic Find & Extreme Penalty Parity (Issue #417)', () => {
    const row = DEFAULT_ITEM_RATIO_ROWS[2] // Expansion, Normal, Generic

    it('negative MF within (-100, 0) penalizes drop quality by increasing denominator', () => {
      // Zero MF:
      // ilvl = 50, qlvl = 10 => D = 40 => Math.trunc(40 / 1) = 40
      // base = (400 - 40) * 128 = 360 * 128 = 46080
      const zeroChance = calculateUniqueChance(row, 50, 10, 0, 0)
      expect(zeroChance).toBe(46080)

      // Negative MF = -20:
      // e = effectiveMF(-20, 250) = 80
      // chance = Math.trunc(46080 * 100 / 80) = 57600 (> 46080, rarer!)
      const negChance = calculateUniqueChance(row, 50, 10, -20, 0)
      expect(negChance).toBe(57600)
      expect(negChance).toBeGreaterThan(zeroChance)
    })

    it('negative MF applies to Set, Rare, and Magic quality chances', () => {
      const set0 = calculateSetChance(row, 50, 10, 0, 0)
      const setNeg = calculateSetChance(row, 50, 10, -50, 0) // e = 50 => chance doubles
      expect(setNeg).toBe(set0 * 2)

      const rare0 = calculateRareChance(row, 50, 10, 0, 0)
      const rareNeg = calculateRareChance(row, 50, 10, -50, 0)
      expect(rareNeg).toBe(rare0 * 2)

      const magic0 = calculateMagicChance(row, 50, 10, 0, 0)
      const magicNeg = calculateMagicChance(row, 50, 10, -50, 0)
      expect(magicNeg).toBe(magic0 * 2)
    })

    it('MF <= -100 completely suppresses Unique, Set, Rare, and Magic in rollItemQuality', () => {
      // Mock RNG that always rolls 0 (would hit unique/set/rare/magic if enabled)
      const mockRng: QualityRollRng = { rand: () => 0 }
      const quality = rollItemQuality({
        ilvl: 80,
        qlvl: 10,
        mf: -100,
        rng: mockRng,
      })
      // Cannot roll unique, set, rare, or magic: falls through to superior or normal!
      expect(['superior', 'normal']).toContain(quality)
    })
  })
})
