import { describe, it, expect, beforeAll, vi } from 'vitest'
import * as fs from 'fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import type { D2Table } from '../src/common/world/acts.ts'
import { parseTable } from '../src/common/world/acts.ts'
import type { ItemBase } from '../src/common/items/items.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { loadArmor, ArmorTable } from '../src/common/items/armor.ts'
import { loadWeapons, type WeaponTable } from '../src/common/items/weapons.ts'
import {
  DIFFICULTY_LEVELS_TABLE_PATH,
  ITEM_UPGRADE_FLAG_EXCEPTIONAL,
  ITEM_UPGRADE_FLAG_ELITE,
  DifficultyLevelsTable,
  parseDifficultyLevelsTable,
  loadDifficultyLevels,
  rollBaseUpgrade,
  type UpgradableItemBase,
} from '../src/common/items/item-upgrade.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

/**
 * Creates a minimal fallback D2Table for Difficultylevels.txt
 * matching the canonical 1.13c table values.
 */
function createMinimalDifficultyLevelsTable(): D2Table {
  const header = [
    'Name',
    'ResistPenalty',
    'DeathExpPenalty',
    'UberCodeOddsNormal',
    'UberCodeOddsGood',
    'UltraCodeOddsNormal',
    'UltraCodeOddsGood',
  ]
  const rows = [
    ['Normal', '0', '0', '0', '0', '0', '0'],
    ['Nightmare', '-40', '5', '10', '20', '0', '0'],
    ['Hell', '-100', '10', '20', '40', '30', '40'],
  ]
  return { header, rows }
}

describe('Item Base Upgrade System (Issue #103)', () => {
  let diffTable: DifficultyLevelsTable
  let armorTable: ArmorTable | undefined
  let weaponTable: WeaponTable | undefined

  beforeAll(async () => {
    if (hasD2) {
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      diffTable = await loadDifficultyLevels(archives)
      armorTable = await loadArmor(archives)
      weaponTable = await loadWeapons(archives)
    } else {
      diffTable = parseDifficultyLevelsTable(createMinimalDifficultyLevelsTable())
    }
  })

  describe('Difficultylevels.txt loader & parser', () => {
    it('defines canonical MPQ path', () => {
      expect(DIFFICULTY_LEVELS_TABLE_PATH).toBe('data\\global\\excel\\Difficultylevels.txt')
    })

    it('loads and parses DifficultyLevelsTable with correct values', () => {
      expect(diffTable).toBeInstanceOf(DifficultyLevelsTable)
      expect(diffTable.length).toBeGreaterThanOrEqual(3)

      // Normal: 0, 0, 0, 0
      const normal = diffTable.normal
      expect(normal).toBeDefined()
      expect(normal.name).toBe('Normal')
      expect(normal.uberCodeOddsNormal).toBe(0)
      expect(normal.uberCodeOddsGood).toBe(0)
      expect(normal.ultraCodeOddsNormal).toBe(0)
      expect(normal.ultraCodeOddsGood).toBe(0)
      expect(normal.UberCodeOddsNormal).toBe(0)
      expect(normal.UberCodeOddsGood).toBe(0)
      expect(normal.UltraCodeOddsNormal).toBe(0)
      expect(normal.UltraCodeOddsGood).toBe(0)

      // Nightmare: 10, 20, 0, 0
      const nightmare = diffTable.nightmare
      expect(nightmare).toBeDefined()
      expect(nightmare.name).toBe('Nightmare')
      expect(nightmare.uberCodeOddsNormal).toBe(10)
      expect(nightmare.uberCodeOddsGood).toBe(20)
      expect(nightmare.ultraCodeOddsNormal).toBe(0)
      expect(nightmare.ultraCodeOddsGood).toBe(0)
      expect(nightmare.UberCodeOddsNormal).toBe(10)
      expect(nightmare.UberCodeOddsGood).toBe(20)
      expect(nightmare.UltraCodeOddsNormal).toBe(0)
      expect(nightmare.UltraCodeOddsGood).toBe(0)

      // Hell: 20, 40, 30, 40
      const hell = diffTable.hell
      expect(hell).toBeDefined()
      expect(hell.name).toBe('Hell')
      expect(hell.uberCodeOddsNormal).toBe(20)
      expect(hell.uberCodeOddsGood).toBe(40)
      expect(hell.ultraCodeOddsNormal).toBe(30)
      expect(hell.ultraCodeOddsGood).toBe(40)
      expect(hell.UberCodeOddsNormal).toBe(20)
      expect(hell.UberCodeOddsGood).toBe(40)
      expect(hell.UltraCodeOddsNormal).toBe(30)
      expect(hell.UltraCodeOddsGood).toBe(40)
    })

    it('supports case-insensitive lookup by difficulty name', () => {
      expect(diffTable.get('normal')?.uberCodeOddsNormal).toBe(0)
      expect(diffTable.get('Nightmare')?.uberCodeOddsGood).toBe(20)
      expect(diffTable.get('HELL')?.ultraCodeOddsGood).toBe(40)
    })

    it('exposes direct properties for Normal, Nightmare, and Hell', () => {
      expect(diffTable.Normal.name).toBe('Normal')
      expect(diffTable.Nightmare.name).toBe('Nightmare')
      expect(diffTable.Hell.name).toBe('Hell')
    })
  })

  describe('rollBaseUpgrade logic', () => {
    // Mock base items for isolated testing
    const capNormal: UpgradableItemBase = {
      id: 'cap',
      name: 'Cap',
      kind: 'armor',
      invWidth: 2,
      invHeight: 2,
      maxStack: 1,
      value: 12,
      damage: 0,
      defense: 5,
      tags: ['helm'],
      level: 1, // qlvl 1
      normcode: 'cap',
      ubercode: 'xap',
      ultracode: 'uap',
    }

    const warHatExceptional: UpgradableItemBase = {
      id: 'xap',
      name: 'War Hat',
      kind: 'armor',
      invWidth: 2,
      invHeight: 2,
      maxStack: 1,
      value: 800,
      damage: 0,
      defense: 53,
      tags: ['helm'],
      level: 34, // qlvl 34
      normcode: 'cap',
      ubercode: 'xap',
      ultracode: 'uap',
    }

    const shakoElite: UpgradableItemBase = {
      id: 'uap',
      name: 'Shako',
      kind: 'armor',
      invWidth: 2,
      invHeight: 2,
      maxStack: 1,
      value: 2400,
      damage: 0,
      defense: 141,
      tags: ['helm'],
      level: 58, // qlvl 58
      normcode: 'cap',
      ubercode: 'xap',
      ultracode: 'uap',
    }

    const mockLookup = (code: string): ItemBase | undefined => {
      const normalized = code.trim().toLowerCase()
      if (normalized === 'cap') return capNormal
      if (normalized === 'xap') return warHatExceptional
      if (normalized === 'uap') return shakoElite
      return undefined
    }

    it('Normal difficulty: odds are 0 -> base never upgrades and consumes 0 RNG rolls', () => {
      const rng = new D2Rng(12345)
      const randSpy = vi.spyOn(rng, 'rand')

      // Test with Normal difficulty odds (0, 0)
      const result = rollBaseUpgrade(capNormal, 0, 0, rng, mockLookup)
      expect(result.base).toBe(capNormal)
      expect(result.base.id).toBe('cap')
      expect(result.base.level).toBe(1)
      expect(result.isUber).toBe(false)
      expect(randSpy).not.toHaveBeenCalled()

      // Repeat multiple times with different seeds
      for (let seed = 1; seed <= 50; seed++) {
        const testRng = new D2Rng(seed)
        const res = rollBaseUpgrade(
          capNormal,
          diffTable.normal.uberCodeOddsNormal,
          diffTable.normal.ultraCodeOddsNormal,
          testRng,
          mockLookup,
        )
        expect(res.base.id).toBe('cap')
        expect(res.isUber).toBe(false)
      }
    })

    it('Test odds = 1024 -> base 100% upgrades to ubercode / ultracode', () => {
      // 1. Exceptional 100% upgrade (qf4 = 1024, qf5 = 0)
      const rng1 = new D2Rng(999)
      const resultUber = rollBaseUpgrade(capNormal, 1024, 0, rng1, mockLookup)
      expect(resultUber.base).toBe(warHatExceptional)
      expect(resultUber.base.id).toBe('xap')
      expect(resultUber.isUber).toBe(true)

      // 2. Elite 100% upgrade (qf4 = 0, qf5 = 1024)
      const rng2 = new D2Rng(888)
      const resultUltra = rollBaseUpgrade(capNormal, 0, 1024, rng2, mockLookup)
      expect(resultUltra.base).toBe(shakoElite)
      expect(resultUltra.base.id).toBe('uap')
      expect(resultUltra.isUber).toBe(true)

      // 3. Both 100% (qf4 = 1024, qf5 = 1024) -> elite takes priority
      const rng3 = new D2Rng(777)
      const resultBoth = rollBaseUpgrade(capNormal, 1024, 1024, rng3, mockLookup)
      expect(resultBoth.base).toBe(shakoElite)
      expect(resultBoth.base.id).toBe('uap')
      expect(resultBoth.isUber).toBe(true)
    })

    it('Handle empty or "xxx" gracefully without upgrading', () => {
      const rng = new D2Rng(42)

      // Base with 'xxx' for both ubercode and ultracode
      const xxxBase: UpgradableItemBase = {
        id: 'xxxitem',
        name: 'No Upgrades Item',
        kind: 'armor',
        invWidth: 1,
        invHeight: 1,
        maxStack: 1,
        value: 10,
        damage: 0,
        defense: 1,
        tags: [],
        level: 5,
        normcode: 'xxxitem',
        ubercode: 'xxx',
        ultracode: 'XXX',
      }

      // Even with 100% odds, it must not upgrade
      const resXxx = rollBaseUpgrade(xxxBase, 1024, 1024, rng, () => undefined)
      expect(resXxx.base).toBe(xxxBase)
      expect(resXxx.isUber).toBe(false)

      // Base with empty strings
      const emptyBase: UpgradableItemBase = {
        ...xxxBase,
        ubercode: '',
        ultracode: '   ',
      }
      const resEmpty = rollBaseUpgrade(emptyBase, 1024, 1024, rng, () => undefined)
      expect(resEmpty.base).toBe(emptyBase)
      expect(resEmpty.isUber).toBe(false)

      // Base without ubercode or ultracode fields
      const regularItemBase: ItemBase = {
        id: 'gold',
        name: 'Gold',
        kind: 'misc',
        invWidth: 1,
        invHeight: 1,
        maxStack: 50000,
        value: 1,
        damage: 0,
        defense: 0,
        tags: [],
        level: 1,
      }
      const resReg = rollBaseUpgrade(regularItemBase, 1024, 1024, rng, mockLookup)
      expect(resReg.base).toBe(regularItemBase)
      expect(resReg.isUber).toBe(false)

      // Ultracode is 'xxx' but ubercode is valid: falls back to exceptional
      const mixedBase: UpgradableItemBase = {
        ...capNormal,
        ubercode: 'xap',
        ultracode: 'xxx',
      }
      const resMixed = rollBaseUpgrade(mixedBase, 1024, 1024, rng, mockLookup)
      expect(resMixed.base).toBe(warHatExceptional)
      expect(resMixed.base.id).toBe('xap')
      expect(resMixed.isUber).toBe(true)

      // Lookup returns undefined (unrecognized code): gracefully keeps original base
      const unresolvableBase: UpgradableItemBase = {
        ...capNormal,
        ubercode: 'nonexistent',
        ultracode: 'unknown',
      }
      const resUnresolved = rollBaseUpgrade(unresolvableBase, 1024, 1024, rng, () => undefined)
      expect(resUnresolved.base).toBe(unresolvableBase)
      expect(resUnresolved.isUber).toBe(false)
    })

    it('RNG consumption: exactly two rand(1024) rolls', () => {
      const rng = new D2Rng(100)
      const randSpy = vi.spyOn(rng, 'rand')

      // Call with non-zero qf4 and qf5
      rollBaseUpgrade(capNormal, 20, 40, rng, mockLookup)

      expect(randSpy).toHaveBeenCalledTimes(2)
      expect(randSpy).toHaveBeenNthCalledWith(1, 1024)
      expect(randSpy).toHaveBeenNthCalledWith(2, 1024)
    })

    it('Switch to new base qlvl and sets isUber = true', () => {
      const rng = new D2Rng(123)

      // 1. Exceptional upgrade changes base to War Hat (qlvl 34, isUber = true)
      const resExceptional = rollBaseUpgrade(capNormal, 1024, 0, rng, mockLookup)
      expect(resExceptional.isUber).toBe(true)
      expect(resExceptional.base.level).toBe(34) // Switches to War Hat qlvl
      expect(resExceptional.base.defense).toBe(53)

      // 2. Elite upgrade changes base to Shako (qlvl 58, isUber = true)
      const resElite = rollBaseUpgrade(capNormal, 0, 1024, rng, mockLookup)
      expect(resElite.isUber).toBe(true)
      expect(resElite.base.level).toBe(58) // Switches to Shako qlvl
      expect(resElite.base.defense).toBe(141)

      // 3. Non-upgraded base retains original qlvl and isUber = false
      const resNormal = rollBaseUpgrade(capNormal, 0, 0, rng, mockLookup)
      expect(resNormal.isUber).toBe(false)
      expect(resNormal.base.level).toBe(1) // Cap qlvl
    })

    if (hasD2) {
      it('integrates with real Armor.txt bases and verifies tier progression', () => {
        expect(armorTable).toBeDefined()
        const cap = armorTable!.get('cap')
        expect(cap).toBeDefined()
        expect(cap?.ubercode).toBe('xap')
        expect(cap?.ultracode).toBe('uap')
        expect(cap?.level).toBe(1)

        const lookup = (code: string) => armorTable!.get(code)
        const rng = new D2Rng(54321)

        // Upgrade to exceptional
        const uberResult = rollBaseUpgrade(cap!, 1024, 0, rng, lookup)
        expect(uberResult.isUber).toBe(true)
        expect(uberResult.base.id).toBe('xap')
        expect(uberResult.base.level).toBe(34) // War Hat qlvl

        // Upgrade to elite
        const eliteResult = rollBaseUpgrade(cap!, 0, 1024, rng, lookup)
        expect(eliteResult.isUber).toBe(true)
        expect(eliteResult.base.id).toBe('uap')
        expect(eliteResult.base.level).toBe(58) // Shako qlvl
      })

      it('integrates with real Weapons.txt bases and verifies tier progression', () => {
        expect(weaponTable).toBeDefined()
        const handAxe = weaponTable!.get('hax')
        expect(handAxe).toBeDefined()
        expect(handAxe?.ubercode).toBe('9ha')
        expect(handAxe?.ultracode).toBe('7ha')
        expect(handAxe?.level).toBe(3)

        const lookup = (code: string) => weaponTable!.get(code)
        const rng = new D2Rng(65432)

        // Upgrade to exceptional (Hatchet)
        const uberResult = rollBaseUpgrade(handAxe!, 1024, 0, rng, lookup)
        expect(uberResult.isUber).toBe(true)
        expect(uberResult.base.id).toBe('9ha')
        expect(uberResult.base.level).toBe(31) // Hatchet qlvl

        // Upgrade to elite (Tomahawk)
        const eliteResult = rollBaseUpgrade(handAxe!, 0, 1024, rng, lookup)
        expect(eliteResult.isUber).toBe(true)
        expect(eliteResult.base.id).toBe('7ha')
        expect(eliteResult.base.level).toBe(54) // Tomahawk qlvl
      })
    }
  })

  describe('Disassembly alignment verification (D2Game!6FC32380 & 6FC31880)', () => {
    it('defines bitflags 0x04 for exceptional and 0x10 for elite', () => {
      expect(ITEM_UPGRADE_FLAG_EXCEPTIONAL).toBe(0x04)
      expect(ITEM_UPGRADE_FLAG_ELITE).toBe(0x10)
    })

    it('verifies rand < odds threshold condition with specific seed', () => {
      const base: UpgradableItemBase = {
        id: 'tst',
        name: 'Test',
        kind: 'armor',
        invWidth: 1,
        invHeight: 1,
        maxStack: 1,
        value: 10,
        damage: 0,
        defense: 1,
        tags: [],
        level: 1,
        ubercode: 'xtst',
        ultracode: 'utst',
      }
      const xtst: ItemBase = { ...base, id: 'xtst', level: 25 }
      const utst: ItemBase = { ...base, id: 'utst', level: 50 }
      const lookup = (c: string) => (c === 'xtst' ? xtst : c === 'utst' ? utst : undefined)

      // Test seed where we know exact rolls
      const rng = new D2Rng(0)
      const roll1 = rng.rand(1024)
      const roll2 = rng.rand(1024)

      // Reset seed to replay exact rolls
      const testRng = new D2Rng(0)
      // Set qf4 to roll1 (so roll1 < qf4 is false) and qf5 to roll2 + 1 (so roll2 < qf5 is true)
      const res = rollBaseUpgrade(base, roll1, roll2 + 1, testRng, lookup)
      expect(res.base.id).toBe('utst')
      expect(res.isUber).toBe(true)
    })
  })
})
