import { describe, expect, it, beforeAll } from 'vitest'
import * as fs from 'fs'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { parseTable } from '../src/common/world/acts.ts'
import type { D2Table } from '../src/common/world/acts.ts'
import {
  parseItemStatCostTable,
  parsePropertiesTable,
  loadItemPropertiesAndStats,
  resolveProperty,
  setDefaultItemPropertiesAndStats,
} from '../src/common/items/properties.ts'
import type {
  ItemStatCostTable,
  PropertiesTable,
  ItemStatCostRecord,
  PropertyRecord,
  ResolvedStat,
} from '../src/common/items/properties.ts'

describe('Unit: Standalone Table Parsing', () => {
  it('parses synthetic ItemStatCost table rows correctly', () => {
    const rawTsv = [
      'Stat\tID\tSigned\tSend Bits\tSend Param Bits\tSaved\t1.09-Save Bits\t1.09-Save Add\tSave Bits\tSave Add\tSave Param Bits\top\top param\top base\top stat1\top stat2\top stat3\tdescpriority\tdescfunc\tdescval\tdescstrpos\tdescstrneg\tdescstr2\tdgrp\tdgrpfunc\tdgrpval\tdgrpstrpos\tdgrpstrneg\tdgrpstr2\t*eol',
      'strength\t0\t\t11\t\t1\t7\t32\t8\t32\t\t\t\t\t\t\t\t67\t1\t1\tModStr1a\tModStr1a\t\t1\t1\t1\tModitem2allattrib\tModitem2allattrib\t\t0',
      'armorclass\t31\t\t11\t\t1\t9\t10\t11\t10\t\t\t\t\t\t\t\t70\t1\t1\tModStr1h\tModStr1h\t\t\t\t\t\t\t\t0',
    ].join('\n')

    const d2Table = parseTable(new TextEncoder().encode(rawTsv))
    const isc = parseItemStatCostTable(d2Table)

    expect(isc.records).toHaveLength(2)
    expect(isc.rows).toHaveLength(2)

    const str = isc.get('strength')
    expect(str).toBeDefined()
    expect(str?.id).toBe(0)
    expect(str?.Stat).toBe('strength')
    expect(str?.stat).toBe('strength')
    expect(str?.saved).toBe(true)
    expect(str?.signed).toBe(false)
    expect(str?.sendBits).toBe(11)
    // Verify it picks Save Bits (8), NOT 1.09-Save Bits (7)
    expect(str?.saveBits).toBe(8)
    expect(str?.saveAdd).toBe(32)
    expect(str?.descPriority).toBe(67)
    expect(str?.descFunc).toBe(1)
    expect(str?.descVal).toBe(1)
    expect(str?.descStrPos).toBe('ModStr1a')
    expect(str?.dgrp).toBe(1)

    // Lookup by ID
    expect(isc.get(0)).toBe(str)
    expect(isc.getById(0)).toBe(str)
    expect(isc.getByStat('strength')).toBe(str)

    const ac = isc.get(31)
    expect(ac).toBeDefined()
    expect(ac?.Stat).toBe('armorclass')
    expect(ac?.saveBits).toBe(11)
    expect(ac?.saveAdd).toBe(10)
  })

  it('parses synthetic Properties table and filters Expansion row', () => {
    const rawTsv = [
      'code\t*done\tset1\tval1\tfunc1\tstat1\tset2\tval2\tfunc2\tstat2\t*desc\t*eol',
      'ac\t1\t\t\t1\tarmorclass\t\t\t\t\tDefense\t0',
      'Expansion\t0\t\t\t\t\t\t\t\t\tExpansion Separator\t0',
      'str\t1\t\t\t1\tstrength\t\t\t\t\tStrength\t0',
    ].join('\n')

    const d2Table = parseTable(new TextEncoder().encode(rawTsv))
    const propTable = parsePropertiesTable(d2Table)

    expect(propTable.records).toHaveLength(2)
    expect(propTable.get('Expansion')).toBeUndefined()

    const ac = propTable.get('ac')
    expect(ac).toBeDefined()
    expect(ac?.code).toBe('ac')
    expect(ac?.func1).toBe(1)
    expect(ac?.stat1).toBe('armorclass')
    expect(ac?.stats).toHaveLength(1)
    expect(ac?.stats[0]).toEqual({
      index: 1,
      set: 0,
      val: 0,
      func: 1,
      stat: 'armorclass',
    })

    const str = propTable.get('str')
    expect(str).toBeDefined()
    expect(str?.code).toBe('str')
    expect(str?.func1).toBe(1)
    expect(str?.stat1).toBe('strength')
  })
})

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

describe.skipIf(!hasD2)('ItemStatCost.txt & Properties.txt 1.13c Integration Tests', () => {
  let archives: MountedArchives
  let stats: ItemStatCostTable
  let properties: PropertiesTable

  beforeAll(async () => {
    archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
    }
    const loaded = await loadItemPropertiesAndStats(archives)
    stats = loaded.stats
    properties = loaded.properties
  })

  it('verifies 359 stats parsed in ItemStatCost.txt with sequential IDs 0..358', () => {
    expect(stats.records).toHaveLength(359)
    expect(stats.rows).toHaveLength(359)
    expect(stats.byStat.size).toBe(359)
    expect(stats.byId.size).toBe(359)

    // IDs must be 0..358 sequentially
    for (let id = 0; id <= 358; id++) {
      const record = stats.getById(id)
      expect(record).toBeDefined()
      expect(record?.id).toBe(id)
      expect(record?.Stat.length).toBeGreaterThan(0)
    }

    // Key stats verification
    const str = stats.getByStat('strength')!
    expect(str).toBeDefined()
    expect(str.id).toBe(0)
    expect(str.saved).toBe(true)
    expect(str.signed).toBe(false)
    expect(str.sendBits).toBe(11)
    expect(str.saveBits).toBe(8)
    expect(str.saveAdd).toBe(32)
    expect(str.descPriority).toBe(67)
    expect(str.descFunc).toBe(1)
    expect(str.descVal).toBe(1)
    expect(str.descStrPos).toBe('ModStr1a')
    expect(str.dgrp).toBe(1)

    const energy = stats.getByStat('energy')!
    expect(energy.id).toBe(1)
    expect(energy.saveBits).toBe(7)
    expect(energy.saveAdd).toBe(32)
    expect(energy.op).toBe(8)
    expect(energy.opStat1).toBe('maxmana')

    const dex = stats.getByStat('dexterity')!
    expect(dex.id).toBe(2)
    expect(dex.saveBits).toBe(7)
    expect(dex.saveAdd).toBe(32)

    const vit = stats.getByStat('vitality')!
    expect(vit.id).toBe(3)
    expect(vit.saveBits).toBe(7)
    expect(vit.saveAdd).toBe(32)
    expect(vit.op).toBe(9)
    expect(vit.opStat1).toBe('maxhp')
    expect(vit.opStat2).toBe('maxstamina')

    const ac = stats.getByStat('armorclass')!
    expect(ac.id).toBe(31)
    expect(ac.saveBits).toBe(11)
    expect(ac.saveAdd).toBe(10)

    const coldMin = stats.getByStat('coldmindam')!
    expect(coldMin.id).toBe(54)
    expect(coldMin.saveBits).toBe(8)
    expect(coldMin.saveAdd).toBe(0)

    const coldMax = stats.getByStat('coldmaxdam')!
    expect(coldMax.id).toBe(55)
    expect(coldMax.saveBits).toBe(9)
    expect(coldMax.saveAdd).toBe(0)

    const coldLen = stats.getByStat('coldlength')!
    expect(coldLen.id).toBe(56)
    expect(coldLen.saveBits).toBe(8)
    expect(coldLen.saveAdd).toBe(0)
  })

  it('verifies 268 properties parsed in Properties.txt (filtering out 1 Expansion row)', () => {
    expect(properties.records).toHaveLength(268)
    expect(properties.rows).toHaveLength(268)
    expect(properties.byCode.size).toBe(268)

    // Verify the separator row 'Expansion' was filtered out
    expect(properties.get('Expansion')).toBeUndefined()
    expect(properties.getByCode('Expansion')).toBeUndefined()

    // Verify common property codes exist
    expect(properties.get('ac')).toBeDefined()
    expect(properties.get('str')).toBeDefined()
    expect(properties.get('dex')).toBeDefined()
    expect(properties.get('vit')).toBeDefined()
    expect(properties.get('enr')).toBeDefined()
    expect(properties.get('all-stats')).toBeDefined()
    expect(properties.get('dmg-cold')).toBeDefined()
    expect(properties.get('res-all')).toBeDefined()
    expect(properties.get('sock')).toBeDefined()
  })

  it('verifies all non-empty stat entries in Properties map to a valid Stat in ItemStatCost', () => {
    let checkedStats = 0
    for (const prop of properties.records) {
      for (const entry of prop.stats) {
        if (entry.stat) {
          const match = stats.getByStat(entry.stat)
          expect(match, `Property ${prop.code} stat "${entry.stat}" must exist in ItemStatCost`).toBeDefined()
          expect(match?.Stat).toBe(entry.stat)
          checkedStats++
        }
      }
    }
    // Diablo II Properties.txt has over 200 mapped stat definitions
    expect(checkedStats).toBeGreaterThan(200)
  })

  it('tests property resolution for common properties (ac, str, dmg-cold, all-stats)', () => {
    // 1. ac (armor class)
    const acResolved = resolveProperty('ac', undefined, 10, 20)
    expect(acResolved).toHaveLength(1)
    expect(acResolved[0]).toMatchObject({
      stat: 'armorclass',
      statId: 31,
      id: 31,
      func: 1,
      min: 10,
      max: 20,
      value: 10,
      saveBits: 11,
      saveAdd: 10,
    })

    // 2. str (strength)
    const strResolved = resolveProperty('str', undefined, 15, 15)
    expect(strResolved).toHaveLength(1)
    expect(strResolved[0]).toMatchObject({
      stat: 'strength',
      statId: 0,
      id: 0,
      func: 1,
      min: 15,
      max: 15,
      value: 15,
      saveBits: 8,
      saveAdd: 32,
    })

    // 3. dmg-cold (cold min damage, cold max damage, cold length)
    // param = 75 (frames duration), min = 2, max = 4
    const coldResolved = resolveProperty('dmg-cold', 75, 2, 4)
    expect(coldResolved).toHaveLength(3)

    // Slot 1: coldmindam (func 15 -> uses min field)
    expect(coldResolved[0]).toMatchObject({
      stat: 'coldmindam',
      statId: 54,
      id: 54,
      func: 15,
      min: 2,
      max: 2,
      value: 2,
      param: 75,
      saveBits: 8,
      saveAdd: 0,
    })

    // Slot 2: coldmaxdam (func 16 -> uses max field)
    expect(coldResolved[1]).toMatchObject({
      stat: 'coldmaxdam',
      statId: 55,
      id: 55,
      func: 16,
      min: 4,
      max: 4,
      value: 4,
      param: 75,
      saveBits: 9,
      saveAdd: 0,
    })

    // Slot 3: coldlength (func 17 -> uses param field)
    expect(coldResolved[2]).toMatchObject({
      stat: 'coldlength',
      statId: 56,
      id: 56,
      func: 17,
      min: 75,
      max: 75,
      value: 75,
      param: 75,
      saveBits: 8,
      saveAdd: 0,
    })

    // 4. all-stats (strength, energy, dexterity, vitality)
    // Func 1 for strength, Func 3 for others (copies min-max range from preceding slot)
    const allStatsResolved = resolveProperty('all-stats', undefined, 5, 5)
    expect(allStatsResolved).toHaveLength(4)

    expect(allStatsResolved[0]).toMatchObject({
      stat: 'strength',
      statId: 0,
      id: 0,
      func: 1,
      min: 5,
      max: 5,
      value: 5,
      saveBits: 8,
      saveAdd: 32,
    })

    expect(allStatsResolved[1]).toMatchObject({
      stat: 'energy',
      statId: 1,
      id: 1,
      func: 3,
      min: 5,
      max: 5,
      value: 5,
      saveBits: 7,
      saveAdd: 32,
    })

    expect(allStatsResolved[2]).toMatchObject({
      stat: 'dexterity',
      statId: 2,
      id: 2,
      func: 3,
      min: 5,
      max: 5,
      value: 5,
      saveBits: 7,
      saveAdd: 32,
    })

    expect(allStatsResolved[3]).toMatchObject({
      stat: 'vitality',
      statId: 3,
      id: 3,
      func: 3,
      min: 5,
      max: 5,
      value: 5,
      saveBits: 7,
      saveAdd: 32,
    })

    // Also test range on all-stats
    const rangedAllStats = resolveProperty('all-stats', undefined, 10, 20)
    expect(rangedAllStats).toHaveLength(4)
    for (const s of rangedAllStats) {
      expect(s.min).toBe(10)
      expect(s.max).toBe(20)
      expect(s.value).toBe(10)
    }
  })

  it('verifies saveBits and saveAdd are accurately exposed for serialization', () => {
    // Specifically test stats where 1.10+ values differ from old 1.09 values:
    // 'strength': 1.09 had Save Bits = 7; 1.10+ has Save Bits = 8
    const str = stats.getByStat('strength')!
    expect(str.saveBits).toBe(8)
    expect(str.saveAdd).toBe(32)

    // 'fireresist': 1.09 had Save Add = 0; 1.10+ has Save Add = 50
    const fireRes = stats.getByStat('fireresist')!
    expect(fireRes.saveBits).toBe(8)
    expect(fireRes.saveAdd).toBe(50)

    // 'lightresist': Save Bits = 8, Save Add = 50
    const lightRes = stats.getByStat('lightresist')!
    expect(lightRes.saveBits).toBe(8)
    expect(lightRes.saveAdd).toBe(50)

    // 'coldresist': Save Bits = 8, Save Add = 50
    const coldRes = stats.getByStat('coldresist')!
    expect(coldRes.saveBits).toBe(8)
    expect(coldRes.saveAdd).toBe(50)

    // 'poisonresist': Save Bits = 8, Save Add = 50
    const poisRes = stats.getByStat('poisonresist')!
    expect(poisRes.saveBits).toBe(8)
    expect(poisRes.saveAdd).toBe(50)

    // 'item_fasterattackrate': Save Bits = 7, Save Add = 20
    const ias = stats.getByStat('item_fasterattackrate')!
    expect(ias.saveBits).toBe(7)
    expect(ias.saveAdd).toBe(20)

    // 'item_fastercastrate': Save Bits = 7, Save Add = 20
    const fcr = stats.getByStat('item_fastercastrate')!
    expect(fcr.saveBits).toBe(7)
    expect(fcr.saveAdd).toBe(20)

    // Verify propertiesTable.resolveProperty exposes accurate saveBits/saveAdd
    const resAll = properties.resolveProperty('res-all', undefined, 15, 15)
    expect(resAll).toHaveLength(4)
    for (const r of resAll) {
      expect(r.saveBits).toBe(8)
      expect(r.saveAdd).toBe(50)
    }
  })

  it('tests additional property resolutions: sock, class skills, and individual skill', () => {
    // sock (sockets) -> item_numsockets
    const sock = properties.resolveProperty('sock', undefined, 2, 4)
    expect(sock).toHaveLength(1)
    expect(sock[0].stat).toBe('item_numsockets')
    expect(sock[0].func).toBe(14)
    expect(sock[0].min).toBe(2)
    expect(sock[0].max).toBe(4)

    // ama (+ Amazon skills) -> item_addclassskills with val1 = 0
    const ama = properties.resolveProperty('ama', undefined, 2, 2)
    expect(ama).toHaveLength(1)
    expect(ama[0].stat).toBe('item_addclassskills')
    expect(ama[0].func).toBe(21)
    expect(ama[0].param).toBe(0) // Amazon class ID
    expect(ama[0].value).toBe(2)

    // pal (+ Paladin skills) -> item_addclassskills with val1 = 3
    const pal = properties.resolveProperty('pal', undefined, 1, 1)
    expect(pal).toHaveLength(1)
    expect(pal[0].stat).toBe('item_addclassskills')
    expect(pal[0].func).toBe(21)
    expect(pal[0].param).toBe(3) // Paladin class ID
    expect(pal[0].value).toBe(1)

    // skill (+ specific skill bonus) -> item_singleskill with skill ID in param
    const skill = properties.resolveProperty('skill', 54, 1, 1) // 54 = Teleport
    expect(skill).toHaveLength(1)
    expect(skill[0].stat).toBe('item_singleskill')
    expect(skill[0].func).toBe(22)
    expect(skill[0].param).toBe(54)
    expect(skill[0].value).toBe(1)
  })
})
