import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { loadItemTypes, type ItemTypeTable, type ItemTypeDefinition } from '../src/common/items/item-types.ts'
import { loadArmor, ArmorTable, type ArmorBase } from '../src/common/items/armor.ts'
import { loadWeapons, type WeaponTable, type WeaponBase } from '../src/common/items/weapons.ts'
import {
  loadTreasureClasses,
  type TreasureClassTable,
} from '../src/common/items/treasure-class.ts'
import {
  AUTO_TC_NAMES,
  AUTO_TC_SERIES,
  AUTO_TC_TOTAL_NODES,
  isAutoTcName,
  parseAutoTcName,
  generateAutoTreasureClasses,
  autoTcToTreasureClassNode,
  mergeAutoTreasureClasses,
  queryTreasureClass,
  queryAutoTreasureClass,
  type AutoTcNode,
} from '../src/server/items/auto-tc.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

describe('Auto-TC Runtime Generation (Issue #100)', () => {
  describe('Constants and Specifications', () => {
    it('defines exactly 100 auto-TC nodes across 4 series', () => {
      expect(AUTO_TC_TOTAL_NODES).toBe(100)
      expect(AUTO_TC_NAMES.size).toBe(100)

      const weapSeries = AUTO_TC_SERIES.find(s => s.typeCode === 'weap')!
      expect(weapSeries).toBeDefined()
      expect(weapSeries.count).toBe(29)
      expect(weapSeries.minTier).toBe(3)
      expect(weapSeries.maxTier).toBe(87)

      const armoSeries = AUTO_TC_SERIES.find(s => s.typeCode === 'armo')!
      expect(armoSeries).toBeDefined()
      expect(armoSeries.count).toBe(29)
      expect(armoSeries.minTier).toBe(3)
      expect(armoSeries.maxTier).toBe(87)

      const bowSeries = AUTO_TC_SERIES.find(s => s.typeCode === 'bow')!
      expect(bowSeries).toBeDefined()
      expect(bowSeries.count).toBe(29)
      expect(bowSeries.minTier).toBe(3)
      expect(bowSeries.maxTier).toBe(87)

      const meleSeries = AUTO_TC_SERIES.find(s => s.typeCode === 'mele')!
      expect(meleSeries).toBeDefined()
      expect(meleSeries.count).toBe(13)
      expect(meleSeries.minTier).toBe(3)
      expect(meleSeries.maxTier).toBe(39)

      // Total count across all series: 29 + 29 + 29 + 13 = 100
      const totalCount = AUTO_TC_SERIES.reduce((sum, s) => sum + s.count, 0)
      expect(totalCount).toBe(100)
    })

    it('contains all expected 100 canonical names', () => {
      // Boundaries
      expect(AUTO_TC_NAMES.has('weap3')).toBe(true)
      expect(AUTO_TC_NAMES.has('weap87')).toBe(true)
      expect(AUTO_TC_NAMES.has('armo3')).toBe(true)
      expect(AUTO_TC_NAMES.has('armo87')).toBe(true)
      expect(AUTO_TC_NAMES.has('bow3')).toBe(true)
      expect(AUTO_TC_NAMES.has('bow87')).toBe(true)
      expect(AUTO_TC_NAMES.has('mele3')).toBe(true)
      expect(AUTO_TC_NAMES.has('mele39')).toBe(true)

      // Excluded / Out of bounds
      expect(AUTO_TC_NAMES.has('mele42')).toBe(false)
      expect(AUTO_TC_NAMES.has('armo90')).toBe(false)
      expect(AUTO_TC_NAMES.has('weap90')).toBe(false)
      expect(AUTO_TC_NAMES.has('abow3')).toBe(false)
      expect(AUTO_TC_NAMES.has('weap0')).toBe(false)
    })
  })

  describe('isAutoTcName & parseAutoTcName APIs', () => {
    it('correctly parses valid auto-TC names', () => {
      expect(parseAutoTcName('weap3')).toEqual({ typeCode: 'weap', tier: 3 })
      expect(parseAutoTcName('weap87')).toEqual({ typeCode: 'weap', tier: 87 })
      expect(parseAutoTcName('armo3')).toEqual({ typeCode: 'armo', tier: 3 })
      expect(parseAutoTcName('armo87')).toEqual({ typeCode: 'armo', tier: 87 })
      expect(parseAutoTcName('bow15')).toEqual({ typeCode: 'bow', tier: 15 })
      expect(parseAutoTcName('bow87')).toEqual({ typeCode: 'bow', tier: 87 })
      expect(parseAutoTcName('mele3')).toEqual({ typeCode: 'mele', tier: 3 })
      expect(parseAutoTcName('mele39')).toEqual({ typeCode: 'mele', tier: 39 })
    })

    it('supports case-insensitivity and whitespace padding', () => {
      expect(parseAutoTcName('ARMO3')).toEqual({ typeCode: 'armo', tier: 3 })
      expect(parseAutoTcName('  weap6  ')).toEqual({ typeCode: 'weap', tier: 6 })
      expect(parseAutoTcName('MeLe39')).toEqual({ typeCode: 'mele', tier: 39 })
      expect(isAutoTcName('  ARMO87  ')).toBe(true)
      expect(isAutoTcName('BoW3')).toBe(true)
    })

    it('rejects invalid or non-auto-TC names', () => {
      // Non-existent prefixes or item codes
      expect(parseAutoTcName('abow3')).toBeUndefined()
      expect(parseAutoTcName('cap')).toBeUndefined()
      expect(parseAutoTcName('hax')).toBeUndefined()
      expect(parseAutoTcName('Gold')).toBeUndefined()
      expect(parseAutoTcName('')).toBeUndefined()

      // Invalid steps (not multiple of 3)
      expect(parseAutoTcName('armo4')).toBeUndefined()
      expect(parseAutoTcName('weap1')).toBeUndefined()
      expect(parseAutoTcName('bow2')).toBeUndefined()

      // Tiers out of 1.13c range
      expect(parseAutoTcName('mele42')).toBeUndefined()
      expect(parseAutoTcName('armo90')).toBeUndefined()
      expect(parseAutoTcName('weap90')).toBeUndefined()
      expect(parseAutoTcName('weap0')).toBeUndefined()

      expect(isAutoTcName('abow3')).toBe(false)
      expect(isAutoTcName('mele42')).toBe(false)
      expect(isAutoTcName('Gold')).toBe(false)
      expect(isAutoTcName('armo4')).toBe(false)
    })
  })

  describe('Integration with 1.13c MPQ data (samples/d2)', () => {
    let types: ItemTypeTable
    let armor: ArmorTable
    let weapons: WeaponTable
    let autoTcs: Map<string, AutoTcNode>

    beforeAll(async () => {
      if (!hasD2) {
        throw new Error('samples/d2 MPQ files required for Auto-TC test')
      }
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      types = await loadItemTypes(archives)
      armor = await loadArmor(archives)
      weapons = await loadWeapons(archives)
      autoTcs = generateAutoTreasureClasses(types, armor, weapons)
    })

    it('generates exactly 100 auto-TC nodes', () => {
      expect(autoTcs.size).toBe(100)

      for (const name of AUTO_TC_NAMES) {
        expect(autoTcs.has(name)).toBe(true)
        const node = autoTcs.get(name)
        expect(node).toBeDefined()
        expect(node?.name).toBe(name)
      }
    })

    it('verifies AutoTcNode structure invariants across all 100 nodes', () => {
      for (const [name, node] of autoTcs) {
        const parsed = parseAutoTcName(name)!
        expect(parsed).toBeDefined()

        expect(node.name).toBe(name)
        expect(node.group).toBe(0)
        expect(node.level).toBe(parsed.tier)
        expect(node.picks).toBe(1)
        expect(Array.isArray(node.entries)).toBe(true)

        // totalProb must strictly equal sum of entry probabilities
        const calculatedProb = node.entries.reduce((sum, e) => sum + e.prob, 0)
        expect(node.totalProb).toBe(calculatedProb)
      }
    })

    it('verifies all items in each bucket have rarity > 0', () => {
      let totalItemEntries = 0
      for (const [, node] of autoTcs) {
        for (const entry of node.entries) {
          totalItemEntries++
          expect(entry.prob).toBeGreaterThan(0)

          const base = armor.get(entry.itemCode) ?? weapons.get(entry.itemCode)
          expect(base, `Item ${entry.itemCode} should exist in armor or weapons`).toBeDefined()
          expect(base!.rarity).toBeGreaterThan(0)
          expect(entry.prob).toBe(base!.rarity)
        }
      }
      expect(totalItemEntries).toBe(637)
    })

    it('verifies tier N items strictly satisfy (N - 3) < qlvl <= N', () => {
      for (const [name, node] of autoTcs) {
        const tier = node.level
        for (const entry of node.entries) {
          const base = armor.get(entry.itemCode) ?? weapons.get(entry.itemCode)
          expect(base).toBeDefined()
          const qlvl = base!.level

          expect(
            qlvl,
            `In node ${name}, item ${base!.code} with qlvl ${qlvl} must be > ${tier - 3}`,
          ).toBeGreaterThan(tier - 3)
          expect(
            qlvl,
            `In node ${name}, item ${base!.code} with qlvl ${qlvl} must be <= ${tier}`,
          ).toBeLessThanOrEqual(tier)

          if (tier === 3) {
            expect(qlvl).toBeGreaterThanOrEqual(1)
            expect(qlvl).toBeLessThanOrEqual(3)
          }
        }
      }
    })

    it('sample checks: armo3 contains cap (qlvl 1, rarity 1); weap3 contains hax (qlvl 3, rarity 3)', () => {
      // 1. armo3 check
      const armo3 = autoTcs.get('armo3')!
      expect(armo3).toBeDefined()
      expect(armo3.name).toBe('armo3')
      expect(armo3.level).toBe(3)
      expect(armo3.group).toBe(0)
      expect(armo3.picks).toBe(1)

      const capEntry = armo3.entries.find(e => e.itemCode === 'cap')
      expect(capEntry).toBeDefined()
      expect(capEntry?.itemCode).toBe('cap')
      expect(capEntry?.prob).toBe(1)

      const capBase = armor.get('cap')!
      expect(capBase).toBeDefined()
      expect(capBase.level).toBe(1)
      expect(capBase.rarity).toBe(1)

      // Verify all items in armo3: cap, qui, lea, buc, lgl, lbt, lbl
      const armo3Codes = armo3.entries.map(e => e.itemCode)
      expect(armo3Codes).toEqual(['cap', 'qui', 'lea', 'buc', 'lgl', 'lbt', 'lbl'])
      expect(armo3.totalProb).toBe(9)

      // 2. weap3 check
      const weap3 = autoTcs.get('weap3')!
      expect(weap3).toBeDefined()
      expect(weap3.name).toBe('weap3')
      expect(weap3.level).toBe(3)

      const haxEntry = weap3.entries.find(e => e.itemCode === 'hax')
      expect(haxEntry).toBeDefined()
      expect(haxEntry?.itemCode).toBe('hax')

      const haxBase = weapons.get('hax')!
      expect(haxBase).toBeDefined()
      expect(haxBase.level).toBe(3)
      expect(haxBase.rarity).toBe(3)
      expect(haxEntry?.prob).toBe(haxBase.rarity)

      // Also verify wand and club in weap3 have rarity 1
      const wndEntry = weap3.entries.find(e => e.itemCode === 'wnd')!
      expect(wndEntry).toBeDefined()
      expect(wndEntry.prob).toBe(1)

      const clbEntry = weap3.entries.find(e => e.itemCode === 'clb')!
      expect(clbEntry).toBeDefined()
      expect(clbEntry.prob).toBe(1)

      expect(weap3.entries.length).toBe(12)
      expect(weap3.totalProb).toBe(26)
    })

    it('sample checks: mele3 and bow3 buckets', () => {
      // mele3 contains melee weapons (excludes short bow sbw and eagle orb ob1)
      const mele3 = autoTcs.get('mele3')!
      expect(mele3).toBeDefined()
      expect(mele3.level).toBe(3)
      expect(mele3.entries.length).toBe(10)
      expect(mele3.entries.some(e => e.itemCode === 'hax')).toBe(true)
      expect(mele3.entries.some(e => e.itemCode === 'sbw')).toBe(false)
      expect(mele3.entries.some(e => e.itemCode === 'ob1')).toBe(false)
      expect(mele3.totalProb).toBe(22)

      // bow3 contains Short Bow
      const bow3 = autoTcs.get('bow3')!
      expect(bow3).toBeDefined()
      expect(bow3.level).toBe(3)
      expect(bow3.entries.length).toBe(1)
      expect(bow3.entries[0]?.itemCode).toBe('sbw')
      expect(bow3.entries[0]?.prob).toBe(2)
      expect(bow3.totalProb).toBe(2)
    })

    it('correctly handles sparse/empty buckets (e.g. bow15)', () => {
      const bow15 = autoTcs.get('bow15')!
      expect(bow15).toBeDefined()
      expect(bow15.name).toBe('bow15')
      expect(bow15.level).toBe(15)
      expect(bow15.entries.length).toBe(0)
      expect(bow15.totalProb).toBe(0)

      // Converted to TreasureClassNode
      const tcNode = autoTcToTreasureClassNode(bow15)
      expect(tcNode.name).toBe('bow15')
      expect(tcNode.items.length).toBe(0)
      expect(tcNode.totalProbExpansion).toBe(0)
      expect(tcNode.totalProbClassic).toBe(0)
      expect(tcNode.cumulativeProbExpansion).toEqual([])
    })

    it('verifies 1:1 match with TreasureClassEx.txt autoTCDanglingReferences', async () => {
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      const tcTable = await loadTreasureClasses(archives)

      // TreasureClassEx.txt references exactly 100 auto-TCs
      expect(tcTable.autoTCDanglingReferences.size).toBe(100)

      // Every referenced auto-TC must exist in the generated map
      for (const ref of tcTable.autoTCDanglingReferences) {
        expect(autoTcs.has(ref), `Auto-TC ${ref} should be generated`).toBe(true)
      }

      // Every generated auto-TC must be in tcTable.autoTCDanglingReferences
      for (const key of autoTcs.keys()) {
        expect(tcTable.autoTCDanglingReferences.has(key)).toBe(true)
      }
    })

    it('supports autoTcToTreasureClassNode conversion', () => {
      const armo3 = autoTcs.get('armo3')!
      const tcNode = autoTcToTreasureClassNode(armo3)

      expect(tcNode.name).toBe('armo3')
      expect(tcNode.level).toBe(3)
      expect(tcNode.picks).toBe(1)
      expect(tcNode.unique).toBe(0)
      expect(tcNode.set).toBe(0)
      expect(tcNode.rare).toBe(0)
      expect(tcNode.magic).toBe(0)
      expect(tcNode.noDrop).toBe(0)
      expect(tcNode.items.length).toBe(armo3.entries.length)
      expect(tcNode.totalProbExpansion).toBe(armo3.totalProb)
      expect(tcNode.totalProbClassic).toBe(armo3.totalProb) // all armo3 items are classic
      expect(tcNode.cumulativeProbExpansion.length).toBe(armo3.entries.length)

      const capItem = tcNode.items.find(it => it.item === 'cap')
      expect(capItem).toBeDefined()
      expect(capItem?.kind).toBe('base-item')
      expect(capItem?.prob).toBe(1)
      expect(capItem?.isDangling).toBe(false)
      expect(capItem?.isClassic).toBe(true)
    })

    it('supports mergeAutoTreasureClasses into TreasureClassTable', async () => {
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      const tcTable = await loadTreasureClasses(archives)

      // Before merge: auto-TCs return undefined
      expect(tcTable.get('armo3')).toBeUndefined()
      expect(tcTable.get('weap87')).toBeUndefined()

      const initialTotal = tcTable.all.length
      expect(initialTotal).toBe(852)

      // Merge
      const merged = mergeAutoTreasureClasses(tcTable, autoTcs)
      expect(merged).toBe(tcTable)
      expect(tcTable.all.length).toBe(852 + 100)

      // After merge: auto-TCs are accessible via .get() and .byName.get()
      const armo3 = tcTable.get('armo3')
      expect(armo3).toBeDefined()
      expect(armo3?.name).toBe('armo3')
      expect(armo3?.level).toBe(3)
      expect(armo3?.items.length).toBe(7)

      const armo3Upper = tcTable.get('ARMO3')
      expect(armo3Upper).toBe(armo3)

      const weap87 = tcTable.get('weap87')
      expect(weap87).toBeDefined()
      expect(weap87?.level).toBe(87)

      const mele39 = tcTable.get('mele39')
      expect(mele39).toBeDefined()
      expect(mele39?.level).toBe(39)

      // Merging a second time is idempotent (doesn't duplicate nodes in all)
      mergeAutoTreasureClasses(tcTable, autoTcs)
      expect(tcTable.all.length).toBe(852 + 100)
    })

    it('supports queryTreasureClass and queryAutoTreasureClass helpers', async () => {
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      const tcTable = await loadTreasureClasses(archives)

      // Direct TC query
      const gold = queryTreasureClass(tcTable, autoTcs, 'Gold')
      expect(gold).toBeDefined()
      expect(gold?.name).toBe('Gold')

      // Auto TC fallback query
      const armo3 = queryTreasureClass(tcTable, autoTcs, 'armo3')
      expect(armo3).toBeDefined()
      expect(armo3?.name).toBe('armo3')
      expect(armo3?.items.length).toBe(7)

      // Non-existent query
      expect(queryTreasureClass(tcTable, autoTcs, 'NonExistent')).toBeUndefined()

      // queryAutoTreasureClass
      expect(queryAutoTreasureClass(autoTcs, 'armo3')?.name).toBe('armo3')
      expect(queryAutoTreasureClass(autoTcs, 'ARMO3')?.name).toBe('armo3')
      expect(queryAutoTreasureClass(autoTcs, 'Gold')).toBeUndefined()
    })
  })

  describe('Synthetic Hermetic Unit Tests (no MPQs required)', () => {
    function createMockTypes(): ItemTypeTable {
      const defs: ItemTypeDefinition[] = [
        {
          code: 'armo',
          name: 'Any Armor',
          equiv1: '',
          equiv2: '',
          treasureClass: 1,
          rarity: 3,
          maxSock1: 0,
          maxSock25: 0,
          maxSock40: 0,
          magic: false,
          rare: true,
          normal: false,
          charm: false,
          gem: false,
          staffMods: '',
          body: true,
          bodyLoc1: 'tors',
          bodyLoc2: '',
          beltable: false,
          class: '',
        },
        {
          code: 'helm',
          name: 'Helm',
          equiv1: 'armo',
          equiv2: '',
          treasureClass: 0,
          rarity: 3,
          maxSock1: 2,
          maxSock25: 3,
          maxSock40: 3,
          magic: false,
          rare: true,
          normal: false,
          charm: false,
          gem: false,
          staffMods: '',
          body: true,
          bodyLoc1: 'head',
          bodyLoc2: '',
          beltable: false,
          class: '',
        },
        {
          code: 'weap',
          name: 'Weapon',
          equiv1: '',
          equiv2: '',
          treasureClass: 1,
          rarity: 3,
          maxSock1: 0,
          maxSock25: 0,
          maxSock40: 0,
          magic: false,
          rare: true,
          normal: false,
          charm: false,
          gem: false,
          staffMods: '',
          body: true,
          bodyLoc1: 'rarm',
          bodyLoc2: '',
          beltable: false,
          class: '',
        },
        {
          code: 'axe',
          name: 'Axe',
          equiv1: 'mele',
          equiv2: '',
          treasureClass: 0,
          rarity: 3,
          maxSock1: 2,
          maxSock25: 4,
          maxSock40: 6,
          magic: false,
          rare: true,
          normal: false,
          charm: false,
          gem: false,
          staffMods: '',
          body: true,
          bodyLoc1: 'rarm',
          bodyLoc2: '',
          beltable: false,
          class: '',
        },
        {
          code: 'mele',
          name: 'Melee Weapon',
          equiv1: 'weap',
          equiv2: '',
          treasureClass: 1,
          rarity: 3,
          maxSock1: 0,
          maxSock25: 0,
          maxSock40: 0,
          magic: false,
          rare: true,
          normal: false,
          charm: false,
          gem: false,
          staffMods: '',
          body: true,
          bodyLoc1: 'rarm',
          bodyLoc2: '',
          beltable: false,
          class: '',
        },
        {
          code: 'bow',
          name: 'Bow',
          equiv1: 'miss',
          equiv2: '',
          treasureClass: 1,
          rarity: 3,
          maxSock1: 3,
          maxSock25: 4,
          maxSock40: 6,
          magic: false,
          rare: true,
          normal: false,
          charm: false,
          gem: false,
          staffMods: '',
          body: true,
          bodyLoc1: 'rarm',
          bodyLoc2: 'larm',
          beltable: false,
          class: '',
        },
        {
          code: 'miss',
          name: 'Missile Weapon',
          equiv1: 'weap',
          equiv2: '',
          treasureClass: 0,
          rarity: 3,
          maxSock1: 0,
          maxSock25: 0,
          maxSock40: 0,
          magic: false,
          rare: true,
          normal: false,
          charm: false,
          gem: false,
          staffMods: '',
          body: true,
          bodyLoc1: 'rarm',
          bodyLoc2: '',
          beltable: false,
          class: '',
        },
      ]

      const byCode = new Map<string, ItemTypeDefinition>()
      for (const d of defs) {
        byCode.set(d.code, d)
      }
      return { types: defs, byCode, _isACache: new Map() }
    }

    function createMockArmor(): ArmorTable {
      const items: ArmorBase[] = [
        {
          id: 'cap',
          code: 'cap',
          name: 'Cap',
          namestr: 'cap',
          version: 0,
          kind: 'armor',
          spawnable: true,
          rarity: 1,
          level: 1,
          levelreq: 0,
          minac: 3,
          maxac: 5,
          reqstr: 0,
          durability: 12,
          cost: 12,
          gambleCost: 100,
          type: 'helm',
          gemsockets: 2,
          gemapplytype: 0,
          normcode: 'cap',
          ubercode: 'xap',
          ultracode: 'uap',
          invWidth: 1,
          invHeight: 2,
          tags: ['helm'],
          defense: 5,
          maxStack: 1,
          value: 12,
          damage: 0,
        },
        // Excluded: rarity 0
        {
          id: 'zer',
          code: 'zer',
          name: 'Zero Armor',
          namestr: 'zer',
          version: 0,
          kind: 'armor',
          spawnable: true,
          rarity: 0,
          level: 2,
          minac: 0,
          maxac: 0,
          reqstr: 0,
          durability: 0,
          cost: 0,
          gambleCost: 0,
          type: 'helm',
          gemsockets: 0,
          gemapplytype: 0,
          normcode: '',
          ubercode: '',
          ultracode: '',
          invWidth: 1,
          invHeight: 1,
          tags: ['helm'],
          defense: 0,
          maxStack: 1,
          value: 0,
          damage: 0,
          levelreq: 0,
        },
      ]
      const byCode = new Map<string, ArmorBase>()
      for (const it of items) byCode.set(it.code, it)
      return new ArmorTable(items, byCode)
    }

    function createMockWeapons(): WeaponTable {
      const items: WeaponBase[] = [
        {
          id: 'hax',
          code: 'hax',
          name: 'Hand Axe',
          namestr: 'hax',
          version: 0,
          kind: 'weapon',
          spawnable: true,
          rarity: 3,
          level: 3,
          levelreq: 0,
          mindam: 3,
          maxdam: 6,
          twoHanded: false,
          strBonus: 100,
          dexBonus: 0,
          speed: 0,
          reqstr: 0,
          reqdex: 0,
          durability: 28,
          cost: 170,
          gambleCost: 4510,
          type: 'axe',
          wclass: '1hs',
          stackable: false,
          rangeadder: 0,
          normcode: 'hax',
          ubercode: '9ha',
          ultracode: '7ha',
          gemsockets: 2,
          invWidth: 1,
          invHeight: 3,
          tags: ['axe'],
          damage: 6,
          value: 170,
          defense: 0,
          maxStack: 1,
        },
      ]
      const byCode = new Map<string, WeaponBase>()
      for (const it of items) byCode.set(it.code, it)
      return {
        all: items,
        byCode,
        get: (c: string) => byCode.get(c.trim().toLowerCase()),
        length: items.length,
      } as unknown as WeaponTable
    }

    it('filters out rarity === 0 items and populates armo3 and weap3', () => {
      const mockTypes = createMockTypes()
      const mockArmor = createMockArmor()
      const mockWeapons = createMockWeapons()

      const result = generateAutoTreasureClasses(mockTypes, mockArmor, mockWeapons)
      expect(result.size).toBe(100)

      const armo3 = result.get('armo3')!
      expect(armo3.entries).toEqual([{ itemCode: 'cap', prob: 1 }])
      expect(armo3.totalProb).toBe(1)

      const weap3 = result.get('weap3')!
      expect(weap3.entries).toEqual([{ itemCode: 'hax', prob: 3 }])
      expect(weap3.totalProb).toBe(3)

      const mele3 = result.get('mele3')!
      expect(mele3.entries).toEqual([{ itemCode: 'hax', prob: 3 }])
      expect(mele3.totalProb).toBe(3)

      const bow3 = result.get('bow3')!
      expect(bow3.entries).toEqual([])
      expect(bow3.totalProb).toBe(0)
    })
  })
})
