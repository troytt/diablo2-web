import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import type { D2Table } from '../src/common/world/acts.ts'
import { parseTable, cell } from '../src/common/world/acts.ts'
import type { ItemBase } from '../src/common/items/items.ts'
import {
  ARMOR_TABLE_PATH,
  ArmorTable,
  parseArmorTable,
  loadArmor,
  type ArmorBase,
} from '../src/common/items/armor.ts'

const hasD2 = fs.existsSync('samples/d2/d2data.mpq')

describe('Armor.txt loader (Issue #91)', () => {
  let table: ArmorTable
  let rawTable: D2Table | undefined

  beforeAll(async () => {
    if (!hasD2) {
      throw new Error(
        '[Preflight] samples/d2 MPQ files (d2data.mpq, d2exp.mpq, Patch_D2.mpq) are required for Armor table verification. ' +
        'Please symlink samples/d2 to your Diablo II 1.13c installation directory.'
      )
    }
    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
    }
    const bytes = await archives.read(ARMOR_TABLE_PATH)
    rawTable = parseTable(bytes)
    table = parseArmorTable(rawTable)
  })

  it('correctly uses the canonical MPQ table path', () => {
    expect(ARMOR_TABLE_PATH).toBe('data\\global\\excel\\Armor.txt')
  })

  it('loads armor table directly via loadArmor with MountedArchives', async () => {
    if (hasD2) {
      const archives = new MountedArchives()
      for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
        archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
      }
      const loaded = await loadArmor(archives)
      expect(loaded).toBeInstanceOf(ArmorTable)
      expect(loaded.all.length).toBe(202)
      expect(loaded.byCode.size).toBe(202)

      const cap = loaded.get('cap')
      expect(cap).toBeDefined()
      expect(cap?.code).toBe('cap')
      expect(cap?.level).toBe(1)
    }
  })

  it('parses exactly 202 valid data rows from 203 raw rows (excluding Expansion row)', () => {
    if (hasD2 && rawTable) {
      // 203 raw lines in Armor.txt: 1 header + 203 data/separator rows
      expect(rawTable.rows.length).toBe(203)

      // Find the Expansion separator row
      const expansionRowIndex = rawTable.rows.findIndex(
        r => cell(rawTable!, r, 'name').trim() === 'Expansion',
      )
      expect(expansionRowIndex).toBeGreaterThanOrEqual(0)
      expect(cell(rawTable, rawTable.rows[expansionRowIndex]!, 'code').trim()).toBe('')
    }

    expect(table.all.length).toBe(202)
    expect(table.byCode.size).toBe(202)
  })

  it('verifies 0 failures and 0 duplicate item codes', () => {
    const seenCodes = new Set<string>()
    const duplicates: string[] = []

    for (const armor of table.all) {
      if (seenCodes.has(armor.code)) {
        duplicates.push(armor.code)
      }
      seenCodes.add(armor.code)

      // Every armor row must have valid identifiers
      expect(armor.id).toBeTruthy()
      expect(armor.code).toBeTruthy()
      expect(armor.name).toBeTruthy()
      expect(armor.namestr).toBeTruthy()
      expect(armor.type).toBeTruthy()
      expect(armor.kind).toBe('armor')
      expect(armor.spawnable).toBe(true)
    }

    expect(duplicates).toEqual([])
    expect(seenCodes.size).toBe(table.all.length)
  })

  it('verifies rarity in 1..4 and level in 1..85 across all armor bases', () => {
    let minRarity = Infinity
    let maxRarity = -Infinity
    let minLevel = Infinity
    let maxLevel = -Infinity

    for (const armor of table.all) {
      expect(armor.rarity).toBeGreaterThanOrEqual(1)
      expect(armor.rarity).toBeLessThanOrEqual(4)
      if (armor.rarity < minRarity) minRarity = armor.rarity
      if (armor.rarity > maxRarity) maxRarity = armor.rarity

      expect(armor.level).toBeGreaterThanOrEqual(1)
      expect(armor.level).toBeLessThanOrEqual(85)
      if (armor.level < minLevel) minLevel = armor.level
      if (armor.level > maxLevel) maxLevel = armor.level
    }

    if (hasD2) {
      expect(minRarity).toBe(1)
      expect(maxRarity).toBe(4)
      expect(minLevel).toBe(1)
      expect(maxLevel).toBe(85)
    }
  })

  it('verifies row 0 "cap" attributes match gold standard specifications', () => {
    const cap = table.all[0]!
    expect(cap).toBeDefined()
    expect(cap.id).toBe('cap')
    expect(cap.code).toBe('cap')
    expect(cap.name).toBe('Cap/hat')
    expect(cap.namestr).toBe('cap')
    expect(cap.version).toBe(0)
    expect(cap.kind).toBe('armor')
    expect(cap.spawnable).toBe(true)
    expect(cap.rarity).toBe(1)
    expect(cap.level).toBe(1)
    expect(cap.levelreq).toBe(0)
    expect(cap.minac).toBe(3)
    expect(cap.maxac).toBe(5)
    expect(cap.defense).toBe(5)
    expect(cap.reqstr).toBe(0)
    expect(cap.durability).toBe(12)
    expect(cap.cost).toBe(64)
    expect(cap.gambleCost).toBe(3016)
    expect(cap.type).toBe('helm')
    expect(cap.gemsockets).toBe(2)
    expect(cap.gemapplytype).toBe(1)
    expect(cap.normcode).toBe('cap')
    expect(cap.ubercode).toBe('xap')
    expect(cap.ultracode).toBe('uap')
    expect(cap.invWidth).toBe(2)
    expect(cap.invHeight).toBe(2)
    expect(cap.tags).toEqual(['helm'])
    expect(cap.maxStack).toBe(1)
    expect(cap.value).toBe(64)
    expect(cap.damage).toBe(0)
  })

  it('supports case-insensitive and trimmed lookups via table.get and table.byCode.get', () => {
    const cap = table.get('cap')
    expect(cap).toBeDefined()
    expect(table.get('CAP')).toBe(cap)
    expect(table.get('  cap  ')).toBe(cap)
    expect(table.get('CaP')).toBe(cap)

    expect(table.byCode.get('cap')).toBe(cap)
    expect(table.byCode.get('CAP')).toBe(cap)
    expect(table.byCode.get('  cap  ')).toBe(cap)
    expect(table.byCode.has('cap')).toBe(true)
    expect(table.byCode.has('CAP')).toBe(true)

    expect(table.get('unknown_code')).toBeUndefined()
    expect(table.byCode.get('unknown_code')).toBeUndefined()
    expect(table.byCode.has('unknown_code')).toBe(false)
  })

  it('correctly links normal, exceptional, and elite tiers (cap -> xap -> uap)', () => {
    const cap = table.get('cap')!
    const xap = table.get('xap')!
    const uap = table.get('uap')!

    expect(cap).toBeDefined()
    expect(xap).toBeDefined()
    expect(uap).toBeDefined()

    // Normal tier: Cap (qlvl 1)
    expect(cap.level).toBe(1)
    expect(cap.normcode).toBe('cap')
    expect(cap.ubercode).toBe('xap')
    expect(cap.ultracode).toBe('uap')

    // Exceptional tier: War Hat (qlvl 34)
    expect(xap.name).toBe('War Hat')
    expect(xap.level).toBe(34)
    expect(xap.normcode).toBe('cap')
    expect(xap.ubercode).toBe('xap')
    expect(xap.ultracode).toBe('uap')
    expect(xap.minac).toBe(45)
    expect(xap.maxac).toBe(53)
    expect(xap.reqstr).toBe(20)

    // Elite tier: Shako (qlvl 58)
    expect(uap.name).toBe('Shako')
    expect(uap.level).toBe(58)
    expect(uap.normcode).toBe('cap')
    expect(uap.ubercode).toBe('xap')
    expect(uap.ultracode).toBe('uap')
    expect(uap.minac).toBe(98)
    expect(uap.maxac).toBe(141)
    expect(uap.reqstr).toBe(50)
  })

  it('conforms to ItemBase interface', () => {
    const cap = table.get('cap')!
    const itemBase: ItemBase = cap

    expect(itemBase.id).toBe('cap')
    expect(itemBase.name).toBe('Cap/hat')
    expect(itemBase.kind).toBe('armor')
    expect(itemBase.invWidth).toBe(2)
    expect(itemBase.invHeight).toBe(2)
    expect(itemBase.maxStack).toBe(1)
    expect(itemBase.value).toBe(64)
    expect(itemBase.damage).toBe(0)
    expect(itemBase.defense).toBe(5)
    expect(itemBase.tags).toEqual(['helm'])
    expect(itemBase.level).toBe(1)
  })
})

/**
 * Creates a minimal fallback table for test environments lacking the full MPQ archives.
 */
function createMinimalFallbackTable(): D2Table {
  const header = [
    'name', 'version', 'compactsave', 'rarity', 'spawnable', 'minac', 'maxac',
    'absorbs', 'speed', 'reqstr', 'block', 'durability', 'nodurability', 'level',
    'levelreq', 'cost', 'gamble cost', 'code', 'namestr', 'magic lvl', 'auto prefix',
    'alternategfx', 'OpenBetaGfx', 'normcode', 'ubercode', 'ultracode', 'spelloffset',
    'component', 'invwidth', 'invheight', 'hasinv', 'gemsockets', 'gemapplytype',
    'flippyfile', 'invfile', 'uniqueinvfile', 'setinvfile', 'rArm', 'lArm', 'Torso',
    'Legs', 'rSPad', 'lSPad', 'useable', 'throwable', 'stackable', 'minstack',
    'maxstack', 'type', 'type2', 'dropsound', 'dropsfxframe', 'usesound', 'unique',
    'transparent', 'transtbl', 'quivered', 'lightradius', 'belt', 'quest', 'missiletype',
    'durwarning', 'qntwarning', 'mindam', 'maxdam', 'StrBonus', 'DexBonus', 'gemoffset',
    'bitfield1', 'CharsiMin', 'CharsiMax', 'CharsiMagicMin', 'CharsiMagicMax', 'CharsiMagicLvl',
    'GheedMin', 'GheedMax', 'GheedMagicMin', 'GheedMagicMax', 'GheedMagicLvl',
    'AkaraMin', 'AkaraMax', 'AkaraMagicMin', 'AkaraMagicMax', 'AkaraMagicLvl',
    'FaraMin', 'FaraMax', 'FaraMagicMin', 'FaraMagicMax', 'FaraMagicLvl',
    'LysanderMin', 'LysanderMax', 'LysanderMagicMin', 'LysanderMagicMax', 'LysanderMagicLvl',
    'DrognanMin', 'DrognanMax', 'DrognanMagicMin', 'DrognanMagicMax', 'DrognanMagicLvl',
    'HraltiMin', 'HraltiMax', 'HraltiMagicMin', 'HraltiMagicMax', 'HratliMagicLvl',
    'AlkorMin', 'AlkorMax', 'AlkorMagicMin', 'AlkorMagicMax', 'AlkorMagicLvl',
    'OrmusMin', 'OrmusMax', 'OrmusMagicMin', 'OrmusMagicMax', 'OrmusMagicLvl',
    'ElzixMin', 'ElzixMax', 'ElzixMagicMin', 'ElzixMagicMax', 'ElzixMagicLvl',
    'AshearaMin', 'AshearaMax', 'AshearaMagicMin', 'AshearaMagicMax', 'AshearaMagicLvl',
    'CainMin', 'CainMax', 'CainMagicMin', 'CainMagicMax', 'CainMagicLvl',
    'HalbuMin', 'HalbuMax', 'HalbuMagicMin', 'HalbuMagicMax', 'HalbuMagicLvl',
    'JamellaMin', 'JamellaMax', 'JamellaMagicMin', 'JamellaMagicMax', 'JamellaMagicLvl',
    'LarzukMin', 'LarzukMax', 'LarzukMagicMin', 'LarzukMagicMax', 'LarzukMagicLvl',
    'MalahMin', 'MalahMax', 'MalahMagicMin', 'MalahMagicMax', 'MalahMagicLvl',
    'DrehyaMin', 'DrehyaMax', 'DrehyaMagicMin', 'DrehyaMagicMax', 'DrehyaMagicLvl',
    'Source Art', 'Game Art', 'Transform', 'InvTrans', 'SkipName', 'NightmareUpgrade',
    'HellUpgrade', 'mindam', 'maxdam', 'nameable',
  ]

  const makeRow = (name: string, code: string, level: string, minac: string, maxac: string, reqstr: string, durability: string, sockets: string, norm: string, uber: string, ultra: string, cost: string, gamble: string) => {
    const row = new Array(header.length).fill('')
    row[header.indexOf('name')] = name
    row[header.indexOf('code')] = code
    row[header.indexOf('namestr')] = code
    row[header.indexOf('version')] = '0'
    row[header.indexOf('spawnable')] = '1'
    row[header.indexOf('rarity')] = '1'
    row[header.indexOf('level')] = level
    row[header.indexOf('levelreq')] = '0'
    row[header.indexOf('minac')] = minac
    row[header.indexOf('maxac')] = maxac
    row[header.indexOf('reqstr')] = reqstr
    row[header.indexOf('durability')] = durability
    row[header.indexOf('cost')] = cost
    row[header.indexOf('gamble cost')] = gamble
    row[header.indexOf('type')] = 'helm'
    row[header.indexOf('gemsockets')] = sockets
    row[header.indexOf('gemapplytype')] = '1'
    row[header.indexOf('normcode')] = norm
    row[header.indexOf('ubercode')] = uber
    row[header.indexOf('ultracode')] = ultra
    row[header.indexOf('invwidth')] = '2'
    row[header.indexOf('invheight')] = '2'
    return row
  }

  const rows: string[][] = [
    makeRow('Cap/hat', 'cap', '1', '3', '5', '0', '12', '2', 'cap', 'xap', 'uap', '64', '3016'),
    makeRow('War Hat', 'xap', '34', '45', '53', '20', '12', '2', 'cap', 'xap', 'uap', '500', '10000'),
    makeRow('Shako', 'uap', '58', '98', '141', '50', '12', '2', 'cap', 'xap', 'uap', '2000', '50000'),
  ]

  return { header, rows }
}
