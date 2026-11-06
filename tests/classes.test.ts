import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import {
  CHARACTER_CLASS_CODES,
  CHARACTER_SPRITE_TOKENS,
  CHARACTER_CLASS_NAMES,
  TOKEN_ALIASES,
  CANONICAL_CHARSTATS,
  resolveCharacterClass,
  getAllCharacterClasses,
  parseCharStatsTable,
  parseCharStatsRow,
  calculateVitalsAtLevel,
} from '../src/common/units/classes.ts'
import type { CharacterClassCode, CharacterSpriteToken } from '../src/common/units/classes.ts'
import { loadActTables, parseTable } from '../src/common/world/acts.ts'
import type { ActTables, D2Table } from '../src/common/world/acts.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { loadCharacterSheet } from '../src/common/units/character.ts'

const hasRealData = fs.existsSync('samples/d2/d2char.mpq') && fs.existsSync('samples/d2/Patch_D2.mpq')

describe('Diablo II Character Classes & 1.13c Data Specification (Milestone M1)', () => {
  describe('7 Canonical Classes Catalog & Identifiers', () => {
    it('defines exactly 7 canonical classes with matching codes and tokens', () => {
      expect(CHARACTER_CLASS_CODES).toHaveLength(7)
      expect(CHARACTER_SPRITE_TOKENS).toHaveLength(7)
      expect(CHARACTER_CLASS_NAMES).toHaveLength(7)

      const expectedCodes: CharacterClassCode[] = ['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass']
      const expectedTokens: CharacterSpriteToken[] = ['am', 'so', 'ne', 'pa', 'ba', 'dz', 'ai']
      const expectedNames = ['Amazon', 'Sorceress', 'Necromancer', 'Paladin', 'Barbarian', 'Druid', 'Assassin']

      expect(CHARACTER_CLASS_CODES).toEqual(expectedCodes)
      expect(CHARACTER_SPRITE_TOKENS).toEqual(expectedTokens)
      expect(CHARACTER_CLASS_NAMES).toEqual(expectedNames)
    })

    it('getAllCharacterClasses returns all 7 classes in canonical Blizzard order', () => {
      const classes = getAllCharacterClasses()
      expect(classes).toHaveLength(7)
      expect(classes.map(c => c.name)).toEqual([
        'Amazon', 'Sorceress', 'Necromancer', 'Paladin', 'Barbarian', 'Druid', 'Assassin',
      ])
      expect(classes.map(c => c.code)).toEqual(['ama', 'sor', 'nec', 'pal', 'bar', 'dru', 'ass'])
      expect(classes.map(c => c.token)).toEqual(['am', 'so', 'ne', 'pa', 'ba', 'dz', 'ai'])
    })
  })

  describe('Multi-Key Class Resolution (Name, 3-Letter Code, 2-Letter Token)', () => {
    const testCases: Array<{
      name: string
      code: CharacterClassCode
      token: CharacterSpriteToken
      queries: string[]
    }> = [
      {
        name: 'Amazon',
        code: 'ama',
        token: 'am',
        queries: ['Amazon', 'amazon', 'AMAZON', 'ama', 'AMA', 'am', 'AM'],
      },
      {
        name: 'Sorceress',
        code: 'sor',
        token: 'so',
        queries: ['Sorceress', 'sorceress', 'SORCERESS', 'sor', 'SOR', 'so', 'SO'],
      },
      {
        name: 'Necromancer',
        code: 'nec',
        token: 'ne',
        queries: ['Necromancer', 'necromancer', 'NECROMANCER', 'nec', 'NEC', 'ne', 'NE'],
      },
      {
        name: 'Paladin',
        code: 'pal',
        token: 'pa',
        queries: ['Paladin', 'paladin', 'PALADIN', 'pal', 'PAL', 'pa', 'PA'],
      },
      {
        name: 'Barbarian',
        code: 'bar',
        token: 'ba',
        queries: ['Barbarian', 'barbarian', 'BARBARIAN', 'bar', 'BAR', 'ba', 'BA'],
      },
      {
        name: 'Druid',
        code: 'dru',
        token: 'dz',
        queries: ['Druid', 'druid', 'DRUID', 'dru', 'DRU', 'dz', 'DZ', 'dr', 'DR'],
      },
      {
        name: 'Assassin',
        code: 'ass',
        token: 'ai',
        queries: ['Assassin', 'assassin', 'ASSASSIN', 'ass', 'ASS', 'ai', 'AI', 'as', 'AS'],
      },
    ]

    for (const tc of testCases) {
      it(`resolves ${tc.name} from all accepted queries (${tc.queries.join(', ')})`, () => {
        for (const query of tc.queries) {
          const resolved = resolveCharacterClass(query)
          expect(resolved.name).toBe(tc.name)
          expect(resolved.code).toBe(tc.code)
          expect(resolved.token).toBe(tc.token)
        }
      })
    }

    it('maps token alias "as" to canonical "ai" (Assassin)', () => {
      const fromAlias = resolveCharacterClass('as')
      const fromCanonical = resolveCharacterClass('ai')
      expect(fromAlias).toBe(fromCanonical)
      expect(fromAlias.name).toBe('Assassin')
      expect(fromAlias.token).toBe('ai')
      expect(TOKEN_ALIASES['as']).toBe('ai')
    })

    it('throws descriptive error on invalid or unknown class input', () => {
      expect(() => resolveCharacterClass('monk')).toThrowError(/Unknown character class: "monk"/)
      expect(() => resolveCharacterClass('wizard')).toThrowError(/Unknown character class: "wizard"/)
      expect(() => resolveCharacterClass('paladin123')).toThrowError(/Unknown character class: "paladin123"/)
      expect(() => resolveCharacterClass('')).toThrowError(/Invalid empty character class input/)
      expect(() => resolveCharacterClass('   ')).toThrowError(/Invalid empty character class input/)
      expect(() => resolveCharacterClass('constructor')).toThrowError(/Unknown character class: "constructor"/)
      expect(() => resolveCharacterClass('__proto__')).toThrowError(/Unknown character class: "__proto__"/)
      expect(() => resolveCharacterClass('valueOf')).toThrowError(/Unknown character class: "valueOf"/)
    })
  })

  describe('1.13c CharStats.txt Starting Attributes & Base Vitals Ground Truth', () => {
    it('Amazon starting stats match 1.13c ground truth', () => {
      const c = CANONICAL_CHARSTATS.ama
      expect(c.baseAttributes).toEqual({ strength: 20, dexterity: 25, vitality: 20, energy: 15 })
      expect(c.baseVitals).toEqual({ life: 50, mana: 15, stamina: 84 }) // life = vit + 30
      expect(c.perLevel).toEqual({ life: 2.0, mana: 1.5, stamina: 1.0, statPoints: 5 })
      expect(c.perStatPoint).toEqual({ lifePerVitality: 3.0, staminaPerVitality: 1.0, manaPerEnergy: 1.5 })
      expect(c.blockFactor).toBe(25)
      expect(c.runDrain).toBe(20)
      expect(c.toHitFactor).toBe(5)
      expect(c.manaRegenSeconds).toBe(120)
      expect(c.baseWClass).toBe('hth')
    })

    it('Sorceress starting stats match 1.13c ground truth', () => {
      const c = CANONICAL_CHARSTATS.sor
      expect(c.baseAttributes).toEqual({ strength: 10, dexterity: 25, vitality: 10, energy: 35 })
      expect(c.baseVitals).toEqual({ life: 40, mana: 35, stamina: 74 })
      expect(c.perLevel).toEqual({ life: 1.0, mana: 2.0, stamina: 1.0, statPoints: 5 })
      expect(c.perStatPoint).toEqual({ lifePerVitality: 2.0, staminaPerVitality: 1.0, manaPerEnergy: 2.0 })
      expect(c.blockFactor).toBe(20)
      expect(c.runDrain).toBe(20)
      expect(c.toHitFactor).toBe(-15)
      expect(c.startSkill).toBe('fire bolt')
    })

    it('Necromancer starting stats match 1.13c ground truth', () => {
      const c = CANONICAL_CHARSTATS.nec
      expect(c.baseAttributes).toEqual({ strength: 15, dexterity: 25, vitality: 15, energy: 25 })
      expect(c.baseVitals).toEqual({ life: 45, mana: 25, stamina: 79 })
      expect(c.perLevel).toEqual({ life: 1.5, mana: 2.0, stamina: 1.0, statPoints: 5 })
      expect(c.perStatPoint).toEqual({ lifePerVitality: 2.0, staminaPerVitality: 1.0, manaPerEnergy: 2.0 })
      expect(c.blockFactor).toBe(20)
      expect(c.runDrain).toBe(20)
      expect(c.toHitFactor).toBe(-10)
      expect(c.startSkill).toBe('raise skeleton')
    })

    it('Paladin starting stats match 1.13c ground truth', () => {
      const c = CANONICAL_CHARSTATS.pal
      expect(c.baseAttributes).toEqual({ strength: 25, dexterity: 20, vitality: 25, energy: 15 })
      expect(c.baseVitals).toEqual({ life: 55, mana: 15, stamina: 89 })
      expect(c.perLevel).toEqual({ life: 2.0, mana: 1.5, stamina: 1.0, statPoints: 5 })
      expect(c.perStatPoint).toEqual({ lifePerVitality: 3.0, staminaPerVitality: 1.0, manaPerEnergy: 1.5 })
      expect(c.blockFactor).toBe(30)
      expect(c.runDrain).toBe(20)
      expect(c.toHitFactor).toBe(20)
    })

    it('Barbarian starting stats match 1.13c ground truth', () => {
      const c = CANONICAL_CHARSTATS.bar
      expect(c.baseAttributes).toEqual({ strength: 30, dexterity: 20, vitality: 25, energy: 10 })
      expect(c.baseVitals).toEqual({ life: 55, mana: 10, stamina: 92 })
      expect(c.perLevel).toEqual({ life: 2.0, mana: 1.0, stamina: 1.0, statPoints: 5 })
      expect(c.perStatPoint).toEqual({ lifePerVitality: 4.0, staminaPerVitality: 1.0, manaPerEnergy: 1.0 })
      expect(c.blockFactor).toBe(25)
      expect(c.runDrain).toBe(20)
      expect(c.toHitFactor).toBe(20)
    })

    it('Druid starting stats match 1.13c ground truth', () => {
      const c = CANONICAL_CHARSTATS.dru
      expect(c.baseAttributes).toEqual({ strength: 15, dexterity: 20, vitality: 25, energy: 20 })
      expect(c.baseVitals).toEqual({ life: 55, mana: 20, stamina: 84 })
      expect(c.perLevel).toEqual({ life: 1.5, mana: 2.0, stamina: 1.0, statPoints: 5 })
      expect(c.perStatPoint).toEqual({ lifePerVitality: 2.0, staminaPerVitality: 1.0, manaPerEnergy: 2.0 })
      expect(c.blockFactor).toBe(20)
      expect(c.runDrain).toBe(20)
      expect(c.toHitFactor).toBe(5)
    })

    it('Assassin starting stats match 1.13c ground truth', () => {
      const c = CANONICAL_CHARSTATS.ass
      expect(c.baseAttributes).toEqual({ strength: 20, dexterity: 20, vitality: 20, energy: 25 })
      expect(c.baseVitals).toEqual({ life: 50, mana: 25, stamina: 95 })
      expect(c.perLevel).toEqual({ life: 2.0, mana: 1.5, stamina: 1.25, statPoints: 5 })
      expect(c.perStatPoint).toEqual({ lifePerVitality: 3.0, staminaPerVitality: 1.25, manaPerEnergy: 1.75 })
      expect(c.blockFactor).toBe(25)
      expect(c.runDrain).toBe(15) // Assassin has unique 15 runDrain (vs 20)
      expect(c.toHitFactor).toBe(15)
    })
  })

  describe('Level Progression & Vitals Formula Evaluation', () => {
    it('evaluates Level 1 base vitals without additional stat allocation', () => {
      const bar = CANONICAL_CHARSTATS.bar
      const vitals = calculateVitalsAtLevel(bar, 1)
      expect(vitals).toEqual({ life: 55, mana: 10, stamina: 92 })
    })

    it('evaluates Level 2 Barbarian vitals scaling with perLevel gains', () => {
      const bar = CANONICAL_CHARSTATS.bar
      const vitals = calculateVitalsAtLevel(bar, 2)
      // Level 2 Barbarian gains +2 Life, +1 Mana, +1 Stamina
      expect(vitals).toEqual({ life: 57, mana: 11, stamina: 93 })
    })

    it('evaluates Barbarian vitals with allocated Vitality stat points', () => {
      const bar = CANONICAL_CHARSTATS.bar
      // Barbarian receives +4 Life per Vitality point, +1 Stamina per Vitality
      const vitals = calculateVitalsAtLevel(bar, 1, { vitality: 10 })
      expect(vitals.life).toBe(55 + 10 * 4) // 95
      expect(vitals.stamina).toBe(92 + 10 * 1) // 102
      expect(vitals.mana).toBe(10)
    })

    it('evaluates fractional vitals scaling for Assassin (1.25 stamina per level)', () => {
      const ass = CANONICAL_CHARSTATS.ass
      const lvl2 = calculateVitalsAtLevel(ass, 2)
      expect(lvl2.stamina).toBe(95 + 1.25)
      const lvl5 = calculateVitalsAtLevel(ass, 5)
      expect(lvl5.stamina).toBe(95 + 4 * 1.25) // 100
      expect(lvl5.life).toBe(50 + 4 * 2.0) // 58
      expect(lvl5.mana).toBe(25 + 4 * 1.5) // 31
    })

    it('evaluates fractional vitals scaling for Necromancer (1.5 life per level)', () => {
      const nec = CANONICAL_CHARSTATS.nec
      const lvl3 = calculateVitalsAtLevel(nec, 3)
      expect(lvl3.life).toBe(45 + 2 * 1.5) // 48
      expect(lvl3.mana).toBe(25 + 2 * 2.0) // 29
    })
  })

  describe('CharStats.txt Dynamic Table Parser', () => {
    it('skips Expansion separator row and non-class rows', () => {
      const mockTable: D2Table = {
        header: ['class', 'str', 'dex', 'int', 'vit', 'stamina', 'hpadd'],
        rows: [
          ['Expansion', '0', '0', '0', '0', '0', '0'],
          ['', '0', '0', '0', '0', '0', '0'],
          ['Paladin', '25', '20', '15', '25', '89', '30'],
        ],
      }
      expect(parseCharStatsRow(mockTable, mockTable.rows[0]!)).toBeUndefined()
      expect(parseCharStatsRow(mockTable, mockTable.rows[1]!)).toBeUndefined()
      const palParsed = parseCharStatsRow(mockTable, mockTable.rows[2]!)
      expect(palParsed).toBeDefined()
      expect(palParsed!.name).toBe('Paladin')
      expect(palParsed!.baseAttributes.strength).toBe(25)
    })

    it('parseCharStatsTable parses valid rows and backfills missing classes from canonical defaults', () => {
      const mockTable: D2Table = {
        header: ['class', 'str', 'dex', 'int', 'vit', 'stamina', 'hpadd'],
        rows: [
          ['Barbarian', '35', '25', '10', '30', '95', '30'], // modified barbarian
        ],
      }
      const catalog = parseCharStatsTable(mockTable)
      expect(catalog.bar.baseAttributes.strength).toBe(35)
      expect(catalog.bar.baseAttributes.dexterity).toBe(25)
      expect(catalog.bar.baseVitals.life).toBe(60) // 30 vit + 30 hpadd
      // Unspecified classes should still be populated from canonical fallback
      expect(catalog.ama.name).toBe('Amazon')
      expect(catalog.sor.name).toBe('Sorceress')
      expect(catalog.nec.name).toBe('Necromancer')
      expect(catalog.pal.name).toBe('Paladin')
      expect(catalog.dru.name).toBe('Druid')
      expect(catalog.ass.name).toBe('Assassin')
    })
  })

  describe('ActTables Optional Table Loading & Fallback Resilience', () => {
    it('loads ActTables with undefined optional tables when archives lack CharStats / Skills / SkillDesc', async () => {
      // Construct a mock MountedArchives that has the 11 required tables, but no optional tables
      const mockLevelsTsv = 'Id\tName\tPal\tLevelType\tWaypoint\tSizeX\tSizeY\tVis0\tWarp0\r\n1\tAct 1 - Town\t0\t1\t255\t10\t10\t0\t-1\r\n'
      const mockLvlTypesTsv = 'Id\tName\tFile 1\r\n1\tAct 1 - Town\tAct1/Town/town.dt1\r\n'
      const mockLvlPrestTsv = 'Def\tLevelId\tFile1\tDt1Mask\r\n1\t1\tAct1/Town/town.ds1\t0\r\n'
      const mockEmptyTsv = 'Id\r\n'

      const mockArchives = {
        has(member: string) {
          const lower = member.toLowerCase()
          return !lower.includes('charstats') && !lower.includes('skills') && !lower.includes('skilldesc')
        },
        async read(member: string) {
          const lower = member.toLowerCase()
          if (lower.includes('levels.txt')) return new TextEncoder().encode(mockLevelsTsv)
          if (lower.includes('lvltypes.txt')) return new TextEncoder().encode(mockLvlTypesTsv)
          if (lower.includes('lvlprest.txt')) return new TextEncoder().encode(mockLvlPrestTsv)
          if (lower.includes('charstats') || lower.includes('skills') || lower.includes('skilldesc')) {
            throw new Error(`no member ${member}`)
          }
          return new TextEncoder().encode(mockEmptyTsv)
        },
      } as unknown as MountedArchives

      const tables = await loadActTables(mockArchives)

      expect(tables.levels).toBeDefined()
      expect(tables.lvltypes).toBeDefined()
      expect(tables.lvlprest).toBeDefined()
      expect(tables.charstats).toBeUndefined()
      expect(tables.skills).toBeUndefined()
      expect(tables.skilldesc).toBeUndefined()

      // When passed to class resolver, it still resolves without errors via canonical fallback
      const resolved = resolveCharacterClass('bar', tables)
      expect(resolved.name).toBe('Barbarian')
      expect(resolved.baseAttributes.strength).toBe(30)
    })
  })

  describe.runIf(hasRealData)('Authoritative MPQ Integration & Sprite Asset Verification', () => {
    let archives: MountedArchives

    it('loads Patch_D2.mpq and d2char.mpq successfully', async () => {
      archives = new MountedArchives()
      for (const m of ['d2char.mpq', 'd2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(m, await MpqArchive.open(await fileSource(`samples/d2/${m}`)))
      }
      expect(archives.size).toBe(4)
    })

    it('loads real CharStats.txt and confirms 100% parity with CANONICAL_CHARSTATS', async () => {
      const tables = await loadActTables(archives)
      expect(tables.charstats).toBeDefined()
      expect(tables.skills).toBeDefined()
      expect(tables.skilldesc).toBeDefined()

      const parsedCatalog = parseCharStatsTable(tables.charstats!)

      for (const code of CHARACTER_CLASS_CODES) {
        const parsed = parsedCatalog[code]
        const canonical = CANONICAL_CHARSTATS[code]

        expect(parsed.name).toBe(canonical.name)
        expect(parsed.code).toBe(canonical.code)
        expect(parsed.token).toBe(canonical.token)
        expect(parsed.baseAttributes).toEqual(canonical.baseAttributes)
        expect(parsed.baseVitals).toEqual(canonical.baseVitals)
        expect(parsed.perLevel).toEqual(canonical.perLevel)
        expect(parsed.perStatPoint).toEqual(canonical.perStatPoint)
        expect(parsed.blockFactor).toBe(canonical.blockFactor)
        expect(parsed.runDrain).toBe(canonical.runDrain)
        expect(parsed.toHitFactor).toBe(canonical.toHitFactor)
        expect(parsed.manaRegenSeconds).toBe(canonical.manaRegenSeconds)
        expect(parsed.baseWClass).toBe(canonical.baseWClass)
      }
    })

    it('verifies all 7 classes load character walk sheets (wl / hth) in 16 directions', async () => {
      for (const code of CHARACTER_CLASS_CODES) {
        const classDef = resolveCharacterClass(code)
        const sheet = await loadCharacterSheet(archives, classDef.token, 'wl', 'hth')
        expect(sheet.directions).toBe(16)
        expect(sheet.framesPerDirection).toBeGreaterThanOrEqual(8)
        expect(sheet.layers).toBeGreaterThanOrEqual(8)
      }
    })

    it('verifies Assassin sprite assets load with "ai" token and alias "as" resolves to "ai" without asset errors', async () => {
      // 1. Direct load of 'ai' succeeds
      const aiWalk = await loadCharacterSheet(archives, 'ai', 'wl', 'hth')
      expect(aiWalk.directions).toBe(16)
      expect(aiWalk.framesPerDirection).toBe(8)
      expect(aiWalk.layers).toBe(10)

      const aiTownNeutral = await loadCharacterSheet(archives, 'ai', 'tn', 'hth')
      expect(aiTownNeutral.directions).toBe(16)
      expect(aiTownNeutral.framesPerDirection).toBe(12)

      // 2. Unaliased 'as' does NOT exist in d2char.mpq
      expect(archives.has('data\\global\\chars\\as\\cof\\aswlhth.cof')).toBe(false)

      // 3. Resolving class via alias 'as' yields canonical 'ai' token, successfully loading animations
      const resolvedFromAlias = resolveCharacterClass('as')
      expect(resolvedFromAlias.token).toBe('ai')
      const walkFromAlias = await loadCharacterSheet(archives, resolvedFromAlias.token, 'wl', 'hth')
      expect(walkFromAlias.directions).toBe(16)
      expect(walkFromAlias.framesPerDirection).toBe(8)
    })

    it('verifies Druid sprite assets load with "dz" token without asset errors', async () => {
      const dzWalk = await loadCharacterSheet(archives, 'dz', 'wl', 'hth')
      expect(dzWalk.directions).toBe(16)
      expect(dzWalk.framesPerDirection).toBe(8)

      const dzTownNeutral = await loadCharacterSheet(archives, 'dz', 'tn', 'hth')
      expect(dzTownNeutral.directions).toBe(16)
      expect(dzTownNeutral.framesPerDirection).toBe(10)
    })
  })
})
