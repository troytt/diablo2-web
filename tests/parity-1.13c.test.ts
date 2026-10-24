import { describe, it, expect, beforeAll } from 'vitest'
import { getEmbeddedDropTables } from '../src/common/items/embedded-drop-tables.ts'
import * as fs from 'fs'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import {
  executeDropPipeline,
  loadDropTables,
  resolveItemTypeFlags,
  createDroppedItem,
  rollAutoMagic,
  rollStaffMods,
  resolveAutoPrefixGroup,
  resolveStaffModsClass,
  LOW_QUALITY_PREFIXES,
  rollItemEtherealAndSockets,
  type DropTables,
} from '../src/common/items/drop-tables.ts'
import {
  NON_RANDOM_RANGE_CODES,
  rollMagicAffixes,
  rollRareAffixes,
} from '../src/common/items/affix-generator.ts'
import {
  formatItemTooltip,
  aggregateAndSortProperties,
  setRuntimePropertyTables,
  getRuntimePropertyMetadata,
  getPropertyPriority,
  getPropertyStatId,
  PROP_STAT_ID,
} from '../src/common/items/item-tooltip.ts'
import { D2Rng } from '../src/common/rng/d2-rng.ts'
import { isAffixEligible, type MagicAffix, type AffixTable } from '../src/common/items/affixes.ts'
import type { RareNameTable } from '../src/common/items/rare-names.ts'
import type { UpgradableItemBase } from '../src/common/items/item-upgrade.ts'
import type { Item, ItemBase } from '../src/common/items/items.ts'
import { ACT_BOSSES, BOSS_LIST, runParityAudit, type BossDefinition } from '../tools/audit-parity.ts'

export type BaseTier = 'normal' | 'exceptional' | 'elite'

export function classifyItemBaseTier(item: Item): BaseTier | null {
  if (item.base.kind !== 'weapon' && item.base.kind !== 'armor') {
    return null
  }
  const b = item.base as UpgradableItemBase
  const id = (b.id ?? '').trim().toLowerCase()
  const uber = (b.ubercode ?? '').trim().toLowerCase()
  const ultra = (b.ultracode ?? '').trim().toLowerCase()

  if (ultra && ultra !== 'xxx' && id === ultra) {
    return 'elite'
  }
  if (uber && uber !== 'xxx' && id === uber) {
    return 'exceptional'
  }
  return 'normal'
}

describe('Diablo II 1.13c Parity Baseline & Boss monsterType=4 Upgrade Odds (Issue #126)', () => {
  let dropTables: DropTables

  beforeAll(() => {
    dropTables = getEmbeddedDropTables()
  })

  it('1. BOSS_LIST and ACT_BOSSES define monsterType === 4 for all 5 Act Bosses', () => {
    expect(BOSS_LIST).toBeDefined()
    expect(BOSS_LIST).toHaveLength(5)
    expect(BOSS_LIST).toBe(ACT_BOSSES)

    for (const boss of BOSS_LIST) {
      const def: BossDefinition = boss
      expect(def.monsterType, `Boss ${def.id} must explicitly set monsterType: 4`).toBe(4)
    }
  })

  it('2. Difficultylevels.txt Good odds (UberCodeOddsGood / UltraCodeOddsGood) exceed Normal odds in Nightmare and Hell', () => {
    const nmOdds = dropTables.difficultyLevels.get('Nightmare')!
    const hellOdds = dropTables.difficultyLevels.get('Hell')!

    expect(nmOdds.uberCodeOddsGood).toBeGreaterThan(nmOdds.uberCodeOddsNormal)
    expect(hellOdds.uberCodeOddsGood).toBeGreaterThan(hellOdds.uberCodeOddsNormal)
    expect(hellOdds.ultraCodeOddsGood).toBeGreaterThan(hellOdds.ultraCodeOddsNormal)
  })

  it('3. monsterType=4 (Boss) yields significantly higher Exceptional/Elite base upgrades than monsterType=1 (Normal) over identical seeds', () => {
    const sampleKills = 400
    let normalMonsterUpgraded = 0
    let normalMonsterEquipCount = 0
    let bossMonsterUpgraded = 0
    let bossMonsterEquipCount = 0

    for (let i = 0; i < sampleKills; i++) {
      const seed = (0x12600000 + i * 7919) >>> 0

      // Run with monsterType = 1 (Normal monster: uses uberCodeOddsNormal=20, ultraCodeOddsNormal=30)
      const dropsNormalType = executeDropPipeline({
        tcName: 'Mephistoq (H)',
        nLevel: 87,
        monsterType: 1,
        dropTables,
        difficulty: 'hell',
        playerMf: 250,
        gamePlayers: 1,
        partyPlayers: 1,
        monsterRng: seed,
      })

      for (const item of dropsNormalType) {
        const tier = classifyItemBaseTier(item)
        if (tier !== null) {
          normalMonsterEquipCount++
          if (tier === 'exceptional' || tier === 'elite') {
            normalMonsterUpgraded++
          }
        }
      }

      // Run with monsterType = 4 (Act Boss: uses uberCodeOddsGood=40, ultraCodeOddsGood=40)
      const dropsBossType = executeDropPipeline({
        tcName: 'Mephistoq (H)',
        nLevel: 87,
        monsterType: 4,
        dropTables,
        difficulty: 'hell',
        playerMf: 250,
        gamePlayers: 1,
        partyPlayers: 1,
        monsterRng: seed,
      })

      for (const item of dropsBossType) {
        const tier = classifyItemBaseTier(item)
        if (tier !== null) {
          bossMonsterEquipCount++
          if (tier === 'exceptional' || tier === 'elite') {
            bossMonsterUpgraded++
          }
        }
      }
    }

    expect(normalMonsterEquipCount).toBeGreaterThan(500)
    expect(bossMonsterEquipCount).toBe(normalMonsterEquipCount)

    const normalUpgradeRate = normalMonsterUpgraded / normalMonsterEquipCount
    const bossUpgradeRate = bossMonsterUpgraded / bossMonsterEquipCount

    // Boss (Good odds: 40/1024 + 40/1024) must strictly exceed Normal (20/1024 + 30/1024)
    expect(bossMonsterUpgraded).toBeGreaterThan(normalMonsterUpgraded)
    expect(bossUpgradeRate).toBeGreaterThan(normalUpgradeRate)
  })

  it('4. executeDropPipeline works properly with monsterType: 4 across all 5 Act Bosses in Hell', () => {
    for (const boss of BOSS_LIST) {
      const drops = executeDropPipeline({
        tcName: boss.questTc.hell,
        nLevel: boss.mlvl.hell,
        monsterType: boss.monsterType ?? 4,
        dropTables,
        difficulty: 'hell',
        playerMf: 250,
        gamePlayers: 1,
        partyPlayers: 1,
        monsterRng: 1337 + boss.act,
      })

      expect(drops.length).toBeGreaterThan(0)
      for (const item of drops) {
        expect(item.ilvl).toBe(boss.mlvl.hell)
      }
    }
  })

  it('5. runParityAudit generates structured JSON summary of quality, base upgrade, and affix distributions', () => {
    const summary = runParityAudit({
      kills: 100,
      bossId: 'mephisto',
      difficulty: 'hell',
      playerMf: 250,
      gamePlayers: 1,
    })

    expect(summary.config.boss).toBe('mephisto')
    expect(summary.config.monsterType).toBe(4)
    expect(summary.totalItems).toBeGreaterThan(0)
    expect(summary.baseTierUpgrade.totalEquipment).toBeGreaterThan(0)
    expect(summary.baseTierUpgrade.upgradedRatio).toBeGreaterThan(0)
  })
})

describe('ItemTypes.txt Quality Flags & classSpecific Propagation (Issue #127 / A2)', () => {
  let dropTables: DropTables

  beforeAll(() => {
    dropTables = getEmbeddedDropTables()
  })

  it('1. resolveItemTypeFlags returns isAlwaysMagic: true for rin, amu, jew, cm1, cm2, cm3', () => {
    const alwaysMagicCodes = ['rin', 'amu', 'jew', 'cm1', 'cm2', 'cm3']
    for (const code of alwaysMagicCodes) {
      const base = dropTables.getBase(code)
      expect(base, `Base ${code} must exist`).toBeDefined()
      const flags = resolveItemTypeFlags(base!, dropTables.itemTypes, dropTables.isA)
      expect(flags.isAlwaysMagic, `${code} must have isAlwaysMagic === true`).toBe(true)
      expect(flags.isNormalOnly, `${code} must have isNormalOnly === false`).toBe(false)
      if (code === 'cm1' || code === 'cm2' || code === 'cm3') {
        expect(flags.canBeRare, `${code} charm must have canBeRare === false`).toBe(false)
      } else {
        expect(flags.canBeRare, `${code} must have canBeRare === true`).toBe(true)
      }
    }
  })

  it('2. 200 rolls of Ring / Amulet / Small Charm at playerMf: -100 and 0, nLevel: 1 NEVER produce normal/superior/low (and cm1 NEVER produces rare)', () => {
    const validQualities = new Set(['magic', 'rare', 'set', 'unique'])
    const forbiddenQualities = new Set(['normal', 'superior', 'low'])

    for (const mf of [-100, 0]) {
      for (const code of ['rin', 'amu', 'cm1']) {
        let countNormalOrSuperiorOrLow = 0
        let countRare = 0
        let totalGenerated = 0

        for (let i = 0; i < 200; i++) {
          const drops = executeDropPipeline({
            tcName: code,
            nLevel: 1,
            monsterType: 1,
            dropTables,
            difficulty: 'normal',
            playerMf: mf,
            gamePlayers: 1,
            partyPlayers: 1,
            monsterRng: (0x12700000 + i * 1009 + (mf === 0 ? 500000 : 0)) >>> 0,
          })

          expect(drops.length).toBe(1)
          const item = drops[0]!
          totalGenerated++

          const q = item.rarity ?? ''
          if (forbiddenQualities.has(q)) {
            countNormalOrSuperiorOrLow++
          }
          if (q === 'rare') {
            countRare++
          }
          expect(validQualities.has(q), `Item ${item.name} (${code}) rolled invalid quality ${q} at MF=${mf}`).toBe(true)
          expect(item.name).not.toMatch(/^Cracked /)
          expect(item.name).not.toMatch(/^Superior /)
        }

        expect(totalGenerated).toBe(200)
        expect(countNormalOrSuperiorOrLow).toBe(0)
        if (code === 'cm1') {
          expect(countRare).toBe(0)
        }
      }
    }
  })

  it('3. resolveItemTypeFlags identifies class-specific equipment bases (Sorceress Orb, Paladin Shield, Amazon Bow, etc.) with isClassSpecific === true', () => {
    // Sorceress Orb: ob1 (Eagle Orb), obc (Eldritch Orb), obf (Dimensional Shard)
    // Paladin Auric Shield: pa1 (Targe), paa (Akaran Targe), paf (Vortex Shield)
    // Amazon Bow: am1 (Stag Bow), am6 (Ashwood Bow), amb (Matriarchal Bow)
    // Barbarian Primal Helm: ba1 (Jawbone Cap)
    // Druid Pelt: dr1 (Wolf Head)
    // Necromancer Voodoo Head: ne1 (Preserved Head)
    // Assassin Katar: ktr (Katar)
    const classSpecificCodes = ['ob1', 'obf', 'pa1', 'paf', 'am1', 'amb', 'ba1', 'dr1', 'ne1', 'ktr']
    for (const code of classSpecificCodes) {
      const base = dropTables.getBase(code)
      expect(base, `Class-specific base ${code} must exist`).toBeDefined()
      const flags = resolveItemTypeFlags(base!, dropTables.itemTypes, dropTables.isA)
      expect(flags.isClassSpecific, `${code} (${base!.name}) must have isClassSpecific === true`).toBe(true)
    }

    // Generic equipment bases must have isClassSpecific === false
    const genericCodes = ['cap', 'uap', 'uit', 'lsd', 'crn', 'rin', 'amu', 'cm1']
    for (const code of genericCodes) {
      const base = dropTables.getBase(code)
      expect(base, `Generic base ${code} must exist`).toBeDefined()
      const flags = resolveItemTypeFlags(base!, dropTables.itemTypes, dropTables.isA)
      expect(flags.isClassSpecific, `${code} (${base!.name}) must have isClassSpecific === false`).toBe(false)
    }
  })
})

describe('Magic & Rare Affix NON_RANDOM_RANGE_CODES Range & Skill Parameter Protection (Issue #128)', () => {
  const swordBase: ItemBase = {
    id: 'crs',
    name: 'Crystal Sword',
    kind: 'weapon',
    tags: ['swor', 'weap'],
    damage: 15,
    defense: 0,
    value: 1200,
    invWidth: 2,
    invHeight: 3,
    maxStack: 1,
    level: 11,
  }

  const mockIsA = (type: string, target: string): boolean => {
    if (type === target) return true
    if (type === 'swor' && (target === 'weap' || target === 'mele')) return true
    return false
  }

  const mockRareNames: { prefixes: RareNameTable; suffixes: RareNameTable } = {
    prefixes: {
      entries: [],
      getEligible: () => [{ index: 0, name: 'Fiend', version: 100, itypes: ['weap'], etypes: [], add: 0, multiply: 0, divide: 0 }],
    } as unknown as RareNameTable,
    suffixes: {
      entries: [],
      getEligible: () => [{ index: 0, name: 'Fang', version: 100, itypes: ['weap'], etypes: [], add: 0, multiply: 0, divide: 0 }],
    } as unknown as RareNameTable,
  }

  function makeAffix(
    name: string,
    isPrefix: boolean,
    group: number,
    mods: { code: string; param?: string; min: number; max: number }[],
  ): MagicAffix {
    return {
      name,
      isPrefix,
      version: 100,
      spawnable: true,
      rare: true,
      level: 1,
      maxlevel: 0,
      levelreq: 12,
      frequency: 10,
      group,
      mods,
      transform: false,
      itypes: ['swor'],
      etypes: [],
    }
  }

  it('1. exports NON_RANDOM_RANGE_CODES covering all elemental damage ranges, event procs, and charged skills', () => {
    const expectedCodes = [
      'dmg-fire',
      'dmg-cold',
      'dmg-ltng',
      'dmg-mag',
      'dmg-pois',
      'dmg-norm',
      'dmg-elem',
      'hit-skill',
      'att-skill',
      'gethit-skill',
      'kill-skill',
      'death-skill',
      'levelup-skill',
      'charged',
      'skill-rand',
    ]
    for (const c of expectedCodes) {
      expect(NON_RANDOM_RANGE_CODES.has(c), `NON_RANDOM_RANGE_CODES must include ${c}`).toBe(true)
    }
  })

  it('2. preserves dmg-fire (min=1, max=6) across rollMagicAffixes / rollRareAffixes -> createDroppedItem -> formatItemTooltip as "Adds 1-6 Fire Damage"', () => {
    const fieryPrefix = makeAffix('Fiery', true, 101, [{ code: 'dmg-fire', min: 1, max: 6 }])
    const auxPrefix1 = makeAffix('Bronze', true, 102, [{ code: 'att', min: 15, max: 15 }])
    const auxPrefix2 = makeAffix('Sharp', true, 103, [{ code: 'dmg%', min: 20, max: 20 }])
    const auxSuffix1 = makeAffix('of Craftsmanship', false, 201, [{ code: 'dmg-max', min: 1, max: 1 }])
    const auxSuffix2 = makeAffix('of Worth', false, 202, [{ code: 'dmg-min', min: 2, max: 2 }])
    const auxSuffix3 = makeAffix('of Strength', false, 203, [{ code: 'str', min: 5, max: 5 }])

    // Magic roll with only Fiery prefix
    const magicAffixes = rollMagicAffixes(
      swordBase,
      30,
      {
        prefixes: { all: [fieryPrefix] } as unknown as AffixTable,
        suffixes: { all: [] } as unknown as AffixTable,
      },
      mockIsA,
      new D2Rng(12345),
    )

    // Find a seed that selects prefix (slotChoice 0 or 2)
    let magicResult = magicAffixes
    for (let s = 1; s <= 20; s++) {
      const candidate = rollMagicAffixes(
        swordBase,
        30,
        {
          prefixes: { all: [fieryPrefix] } as unknown as AffixTable,
          suffixes: { all: [] } as unknown as AffixTable,
        },
        mockIsA,
        new D2Rng(s),
      )
      if (candidate.prefix) {
        magicResult = candidate
        break
      }
    }

    expect(magicResult.prefix).toBeDefined()
    expect(magicResult.prefix!.mods[0]).toEqual({
      code: 'dmg-fire',
      min: 1,
      max: 6,
      value: 1,
    })

    const magicItem = createDroppedItem(swordBase, 'magic', {
      magicAffixes: magicResult,
      ilvl: 30,
      dwInitSeed: 777,
    })
    expect(magicItem.rolledProps).toContainEqual({
      code: 'dmg-fire',
      param: undefined,
      min: 1,
      max: 6,
      value: 1,
    })

    const magicTooltip = formatItemTooltip(magicItem)
    const magicLines = magicTooltip.lines.map(l => l.text)
    expect(magicLines).toContain('Adds 1-6 Fire Damage')

    // Rare roll where Fiery is guaranteed to be chosen (3 prefixes, 3 suffixes)
    const rareResult = rollRareAffixes(
      swordBase,
      30,
      {
        prefixes: { all: [fieryPrefix] } as unknown as AffixTable,
        suffixes: { all: [auxSuffix1, auxSuffix2] } as unknown as AffixTable,
      },
      mockRareNames,
      mockIsA,
      new D2Rng(98765),
    )

    const fieryRolled = rareResult.affixes.find(a => a.name === 'Fiery')
    expect(fieryRolled).toBeDefined()
    expect(fieryRolled!.mods[0]).toEqual({
      code: 'dmg-fire',
      min: 1,
      max: 6,
      value: 1,
    })

    const rareItem = createDroppedItem(swordBase, 'rare', {
      rareAffixes: rareResult,
      ilvl: 30,
      dwInitSeed: 888,
    })
    expect(rareItem.rolledProps).toContainEqual({
      code: 'dmg-fire',
      param: undefined,
      min: 1,
      max: 6,
      value: 1,
    })

    const rareTooltip = formatItemTooltip(rareItem)
    const rareLines = rareTooltip.lines.map(l => l.text)
    expect(rareLines).toContain('Adds 1-6 Fire Damage')

    // Also verify when only rolledProps is present (without rolledMagicAffixes / rolledRareAffixes)
    const rarePropsOnlyItem = { ...rareItem, rolledRareAffixes: undefined } as Item
    expect(formatItemTooltip(rarePropsOnlyItem).lines.map(l => l.text)).toContain('Adds 1-6 Fire Damage')
  })

  it('3. preserves hit-skill (param="Amplify Damage"/66, min=5, max=1) and charged (param="Teleport"/54, min=20, max=2) across Magic and Rare generation and tooltip rendering', () => {
    const ampSuffix = makeAffix('of Amplify Damage', false, 301, [
      { code: 'hit-skill', param: '66', min: 5, max: 1 },
    ])
    const teleSuffix = makeAffix('of Teleportation', false, 302, [
      { code: 'charged', param: '54', min: 20, max: 2 },
    ])
    const bronzePrefix = makeAffix('Bronze', true, 101, [{ code: 'att', min: 10, max: 10 }])

    // Magic item with prefix=Bronze (or hit-skill) and suffix=charged
    const ampPrefix = makeAffix('Cursing', true, 102, [
      { code: 'hit-skill', param: 'Amplify Damage', min: 5, max: 1 },
    ])

    let magicResult = rollMagicAffixes(
      swordBase,
      40,
      {
        prefixes: { all: [ampPrefix] } as unknown as AffixTable,
        suffixes: { all: [teleSuffix] } as unknown as AffixTable,
      },
      mockIsA,
      new D2Rng(1),
    )
    for (let s = 1; s <= 30; s++) {
      const candidate = rollMagicAffixes(
        swordBase,
        40,
        {
          prefixes: { all: [ampPrefix] } as unknown as AffixTable,
          suffixes: { all: [teleSuffix] } as unknown as AffixTable,
        },
        mockIsA,
        new D2Rng(s),
      )
      if (candidate.prefix && candidate.suffix) {
        magicResult = candidate
        break
      }
    }

    expect(magicResult.prefix?.mods[0]).toEqual({
      code: 'hit-skill',
      param: 'Amplify Damage',
      min: 5,
      max: 1,
      value: 5,
    })
    expect(magicResult.suffix?.mods[0]).toEqual({
      code: 'charged',
      param: '54',
      min: 20,
      max: 2,
      value: 20,
    })

    const magicItem = createDroppedItem(swordBase, 'magic', {
      magicAffixes: magicResult,
      ilvl: 40,
      dwInitSeed: 555,
    })

    const magicTooltip = formatItemTooltip(magicItem)
    const magicLines = magicTooltip.lines.map(l => l.text)
    expect(magicLines.some(l => /^5% Chance to cast Level 1 Amplify Damage on striking$/i.test(l))).toBe(true)
    expect(magicLines).toContain('Level 2 Teleport (20/20 Charges)')

    // Rare item with both suffixes (66 and 54) + prefix
    const rareResult = rollRareAffixes(
      swordBase,
      40,
      {
        prefixes: { all: [bronzePrefix] } as unknown as AffixTable,
        suffixes: { all: [ampSuffix, teleSuffix] } as unknown as AffixTable,
      },
      mockRareNames,
      mockIsA,
      new D2Rng(42),
    )

    const rareItem = createDroppedItem(swordBase, 'rare', {
      rareAffixes: rareResult,
      ilvl: 40,
      dwInitSeed: 666,
    })

    const rareTooltip = formatItemTooltip(rareItem)
    const rareLines = rareTooltip.lines.map(l => l.text)
    expect(rareLines.some(l => /^5% Chance to cast Level 1 Amplify Damage on striking$/i.test(l))).toBe(true)
    expect(rareLines).toContain('Level 2 Teleport (20/20 Charges)')
  })
})

describe('AutoMagic.txt & 1.13c StaffMods Drop Pipeline & Tooltip Integration (Issue #129)', () => {
  let dropTables: DropTables

  beforeAll(() => {
    dropTables = getEmbeddedDropTables()
  })

  it('1. loads dropTables.autoMagic with 36 canonical entries and parses autoPrefix on class-specific bases', () => {
    expect(dropTables.autoMagic).toBeDefined()
    expect(dropTables.autoMagic!.length).toBe(36)
    expect(dropTables.autoMagic!.entries.length).toBe(36)

    const targe = dropTables.getBase('pa1')!
    const vortexShield = dropTables.getBase('paf')!
    const maidenJavelin = dropTables.getBase('am5')!
    const eagleOrb = dropTables.getBase('ob1')!
    const stagBow = dropTables.getBase('am1')!
    const preservedHead = dropTables.getBase('ne1')!

    expect(resolveAutoPrefixGroup(targe, dropTables.itemTypes, dropTables.isA)).toBe(304)
    expect(resolveAutoPrefixGroup(vortexShield, dropTables.itemTypes, dropTables.isA)).toBe(304)
    expect(resolveAutoPrefixGroup(maidenJavelin, dropTables.itemTypes, dropTables.isA)).toBe(302)
    expect(resolveAutoPrefixGroup(eagleOrb, dropTables.itemTypes, dropTables.isA)).toBe(303)
    expect(resolveAutoPrefixGroup(stagBow, dropTables.itemTypes, dropTables.isA)).toBe(300)
    expect(resolveAutoPrefixGroup(preservedHead, dropTables.itemTypes, dropTables.isA)).toBe(305)
  })

  it('2. Paladin Shields (pa1 / paf) and Amazon Javelins (am5) automatically carry AutoMagic affixes across Normal, Magic, and Rare drops and render in formatItemTooltip', () => {
    // Test Paladin Shield (paf Vortex Shield / pa1 Targe) across Normal, Magic, Rare
    const seenPalQualities = new Set<string>()
    for (let i = 0; i < 250; i++) {
      const mf = i < 40 ? -100 : i < 100 ? 100 : 800
      const drops = executeDropPipeline({
        tcName: i % 2 === 0 ? 'paf' : 'pa1',
        nLevel: 85,
        monsterType: 1,
        dropTables,
        difficulty: 'hell',
        playerMf: mf,
        gamePlayers: 1,
        partyPlayers: 1,
        monsterRng: (0x12900000 + i * 997) >>> 0,
      })
      expect(drops.length).toBe(1)
      const item = drops[0]!
      const q = item.rarity ?? 'normal'
      if (q === 'normal' || q === 'magic' || q === 'rare') {
        seenPalQualities.add(q)
        expect((item as any).rolledAutoMagic).toBeDefined()
        expect((item as any).rolledAutoMagic.group).toBe(304)

        const tooltip = formatItemTooltip(item)
        const texts = tooltip.lines.map(l => l.text)
        const hasResAll = texts.some(t => /^All Resistances \+\d+/.test(t) || /Resist \+\d+%/.test(t))
        const hasEdAndAr =
          texts.some(t => /\+\d+% Enhanced Damage/.test(t)) &&
          texts.some(t => /\+\d+ to Attack Rating/.test(t))
        expect(
          hasResAll || hasEdAndAr,
          `Paladin shield (${item.base.id}, quality=${q}) tooltip lines ${JSON.stringify(texts)} must include AutoMagic res-all or dmg%/att`,
        ).toBe(true)
      }
    }
    expect(seenPalQualities.has('normal')).toBe(true)
    expect(seenPalQualities.has('magic')).toBe(true)
    expect(seenPalQualities.has('rare')).toBe(true)

    // Test Amazon Javelin (am5 Maiden Javelin) across Normal, Magic, Rare
    const seenJavQualities = new Set<string>()
    for (let i = 0; i < 250; i++) {
      const mf = i < 40 ? -100 : i < 100 ? 100 : 800
      const drops = executeDropPipeline({
        tcName: 'am5',
        nLevel: 85,
        monsterType: 1,
        dropTables,
        difficulty: 'hell',
        playerMf: mf,
        gamePlayers: 1,
        partyPlayers: 1,
        monsterRng: (0x12950000 + i * 1013) >>> 0,
      })
      expect(drops.length).toBe(1)
      const item = drops[0]!
      const q = item.rarity ?? 'normal'
      if (q === 'normal' || q === 'magic' || q === 'rare') {
        seenJavQualities.add(q)
        expect((item as any).rolledAutoMagic).toBeDefined()
        expect((item as any).rolledAutoMagic.group).toBe(302)

        const tooltip = formatItemTooltip(item)
        const texts = tooltip.lines.map(l => l.text)
        expect(
          texts.some(t => /^\+[1-9]\d* to Javelin and Spear Skills \(Amazon Only\)$/.test(t)),
          `Amazon javelin (am5, quality=${q}) tooltip lines ${JSON.stringify(texts)} must include +X to Javelin and Spear Skills (Amazon Only)`,
        ).toBe(true)
      }
    }
    expect(seenJavQualities.has('normal')).toBe(true)
    expect(seenJavQualities.has('magic')).toBe(true)
    expect(seenJavQualities.has('rare')).toBe(true)
  })

  it('3. rollStaffMods generates +1..+3 to [Skill] ([Class] Only) for Sorceress Orb (ob1), Necromancer Wand (wnd), and Paladin Scepter (scp) by ilvl and renders in formatItemTooltip', () => {
    const orbBase = dropTables.getBase('ob1')!
    const wandBase = dropTables.getBase('wnd')!
    const scepterBase = dropTables.getBase('scp')!

    expect(resolveStaffModsClass(orbBase, dropTables.itemTypes)).toBe('sor')
    expect(resolveStaffModsClass(wandBase, dropTables.itemTypes)).toBe('nec')
    expect(resolveStaffModsClass(scepterBase, dropTables.itemTypes)).toBe('pal')

    const checkStaffModsForClass = (
      base: ItemBase,
      expectedClassLabel: string,
      minSkillId: number,
      maxSkillId: number,
    ) => {
      // Low ilvl (ilvl = 1 -> baseTier = 1, max tier = 2 -> first 10 skills of class)
      let lowIlvlModsFound = 0
      for (let s = 1; s <= 40; s++) {
        const mods = rollStaffMods(base, 1, dropTables.itemTypes, new D2Rng(s * 31337))
        for (const m of mods) {
          lowIlvlModsFound++
          expect(m.code).toBe('skill')
          const skillId = Number(m.param)
          expect(skillId).toBeGreaterThanOrEqual(minSkillId)
          expect(skillId).toBeLessThanOrEqual(minSkillId + 9) // Tier 1..2 only at ilvl 1
          expect(m.value).toBeGreaterThanOrEqual(1)
          expect(m.value).toBeLessThanOrEqual(3)
        }
      }
      expect(lowIlvlModsFound).toBeGreaterThan(0)

      // High ilvl (ilvl = 50 -> baseTier = 5, max tier = 6 -> up to 30th skill of class)
      let highTierSkillFound = false
      let renderedTooltipVerified = false
      for (let s = 1; s <= 60; s++) {
        const drops = executeDropPipeline({
          tcName: base.id,
          nLevel: 50,
          monsterType: 1,
          dropTables,
          difficulty: 'nightmare',
          playerMf: 50,
          gamePlayers: 1,
          partyPlayers: 1,
          monsterRng: (0x12980000 + s * 2027) >>> 0,
        })
        expect(drops.length).toBe(1)
        const item = drops[0]!
        const staffMods = (item as any).staffMods as { code: string; param: number; value: number }[] | undefined
        if (staffMods && staffMods.length > 0) {
          for (const sm of staffMods) {
            const skillId = Number(sm.param)
            expect(skillId).toBeGreaterThanOrEqual(minSkillId)
            expect(skillId).toBeLessThanOrEqual(maxSkillId)
            if (skillId >= minSkillId + 15) {
              highTierSkillFound = true
            }
          }
          const tooltip = formatItemTooltip(item)
          const texts = tooltip.lines.map(l => l.text)
          const classRegex = new RegExp(`^\\+[1-9]\\d* to .+ \\(${expectedClassLabel} Only\\)$`)
          expect(
            texts.some(t => classRegex.test(t)),
            `Expected ${base.id} tooltip ${JSON.stringify(texts)} to contain +X to [Skill] (${expectedClassLabel} Only)`,
          ).toBe(true)
          renderedTooltipVerified = true
        }
      }
      expect(highTierSkillFound).toBe(true)
      expect(renderedTooltipVerified).toBe(true)
    }

    checkStaffModsForClass(orbBase, 'Sorceress', 36, 65)
    checkStaffModsForClass(wandBase, 'Necromancer', 66, 95)
    checkStaffModsForClass(scepterBase, 'Paladin', 96, 125)
  })
})

describe('dgrp Exact-Equality Aggregation Rule (Issue #130 / C2)', () => {
  const amuletBase: ItemBase = {
    id: 'amu',
    name: 'Amulet',
    kind: 'armor',
    tags: ['amul'],
    damage: 0,
    defense: 0,
    value: 100,
    invWidth: 1,
    invHeight: 1,
    maxStack: 1,
    level: 1,
  }

  it('1. folds dgrp=2 into All Resistances +X ONLY when all 4 resistances are positive and strictly equal', () => {
    // 4 equal individual resistances (+15 each)
    const itemFromFour = createDroppedItem(amuletBase, 'normal', { ilvl: 80, dwInitSeed: 100 })
    ;(itemFromFour as any).rolledProps = [
      { code: 'res-fire', min: 15, max: 15, value: 15 },
      { code: 'res-cold', min: 15, max: 15, value: 15 },
      { code: 'res-ltng', min: 15, max: 15, value: 15 },
      { code: 'res-pois', min: 15, max: 15, value: 15 },
    ]
    expect(formatItemTooltip(itemFromFour).lines.map(l => l.text)).toEqual(['All Resistances +15'])

    // Pure res-all (+15)
    const itemFromResAll = createDroppedItem(amuletBase, 'normal', { ilvl: 80, dwInitSeed: 101 })
    ;(itemFromResAll as any).rolledProps = [{ code: 'res-all', min: 15, max: 15, value: 15 }]
    expect(formatItemTooltip(itemFromResAll).lines.map(l => l.text)).toEqual(['All Resistances +15'])
  })

  it('2. unfolds dgrp=2 into 4 separate resistance lines when res-all stacks with a single elemental resistance (+15 res-all + +20 res-fire)', () => {
    const item = createDroppedItem(amuletBase, 'normal', { ilvl: 80, dwInitSeed: 102 })
    ;(item as any).rolledProps = [
      { code: 'res-all', min: 15, max: 15, value: 15 },
      { code: 'res-fire', min: 20, max: 20, value: 20 },
    ]

    const texts = formatItemTooltip(item).lines.map(l => l.text)
    expect(texts).toEqual([
      'Cold Resist +15%',
      'Lightning Resist +15%',
      'Fire Resist +35%',
      'Poison Resist +15%',
    ])
    expect(texts.some(t => t.startsWith('All Resistances'))).toBe(false)
  })

  it('3. unfolds dgrp=1 into 4 separate attribute lines when all-stats stacks with a single attribute (+10 all-stats + +15 str), and folds ONLY when all 4 are strictly equal', () => {
    // Strictly equal (+10 to all 4)
    const equalAttrItem = createDroppedItem(amuletBase, 'normal', { ilvl: 80, dwInitSeed: 103 })
    ;(equalAttrItem as any).rolledProps = [{ code: 'all-stats', min: 10, max: 10, value: 10 }]
    expect(formatItemTooltip(equalAttrItem).lines.map(l => l.text)).toEqual(['+10 to All Attributes'])

    // Stacked (+10 all-stats + +15 str -> str=25, dex=10, vit=10, enr=10)
    const unequalAttrItem = createDroppedItem(amuletBase, 'normal', { ilvl: 80, dwInitSeed: 104 })
    ;(unequalAttrItem as any).rolledProps = [
      { code: 'all-stats', min: 10, max: 10, value: 10 },
      { code: 'str', min: 15, max: 15, value: 15 },
    ]
    const texts = formatItemTooltip(unequalAttrItem).lines.map(l => l.text)
    expect(texts).toEqual([
      '+25 to Strength',
      '+10 to Dexterity',
      '+10 to Vitality',
      '+10 to Energy',
    ])
    expect(texts.some(t => t.includes('All Attributes'))).toBe(false)

    // Verify aggregateAndSortProperties never puts 'all-res' or 'all-stats' into otherMerged when unequal
    const rawMerged = aggregateAndSortProperties([
      { code: 'all-res', min: 12, max: 12, value: 12 },
      { code: 'res-ltng', min: 18, max: 18, value: 18 },
      { code: 'all-stats', min: 5, max: 5, value: 5 },
      { code: 'dex', min: 7, max: 7, value: 7 },
    ])
    expect(rawMerged.map(p => `${p.code}:${p.value}`)).toEqual([
      'str:5',
      'dex:12',
      'vit:5',
      'enr:5',
      'res-cold:12',
      'res-ltng:30',
      'res-fire:12',
      'res-pois:12',
    ])
  })
})

describe('Superior, Low Quality, Ethereal & Sockets, and Rare Slot-by-Slot Allocation (Issue #131)', () => {
  let dropTables: DropTables

  beforeAll(() => {
    dropTables = getEmbeddedDropTables()
  })

  it('1. A3 — Superior weapons and armor generate +5..15% Enhanced Damage/Defense in rolledProps & stats and render enhanced blue stats in formatItemTooltip', () => {
    const monarchBase = dropTables.getBase('uit')! // Monarch: defense 148
    const swordBase = dropTables.getBase('crs')! // Crystal Sword: mindam 5, maxdam 15

    for (let s = 1; s <= 30; s++) {
      const supArmor = createDroppedItem(monarchBase, 'superior', {
        ilvl: 85,
        dwInitSeed: s * 1009,
      })
      expect(supArmor.name).toBe(`Superior ${monarchBase.name}`)
      expect(supArmor.rolledProps).toBeDefined()
      const acPctProp = supArmor.rolledProps!.find(p => p.code === 'ac%')
      expect(acPctProp).toBeDefined()
      expect(acPctProp!.value).toBeGreaterThanOrEqual(5)
      expect(acPctProp!.value).toBeLessThanOrEqual(15)
      expect(supArmor.stats['ac%']).toBe(acPctProp!.value)

      const armorTooltip = formatItemTooltip(supArmor)
      expect(armorTooltip.lines.map(l => l.text)).toContain(`+${acPctProp!.value}% Enhanced Defense`)
      expect(armorTooltip.defense).toBe(Math.floor(monarchBase.defense * (100 + acPctProp!.value) / 100))
      expect(armorTooltip.baseDefense).toBe(monarchBase.defense)

      const supWeapon = createDroppedItem(swordBase, 'superior', {
        ilvl: 85,
        dwInitSeed: s * 2003,
      })
      expect(supWeapon.name).toBe(`Superior ${swordBase.name}`)
      expect(supWeapon.rolledProps).toBeDefined()
      const dmgPctProp = supWeapon.rolledProps!.find(p => p.code === 'dmg%')
      expect(dmgPctProp).toBeDefined()
      expect(dmgPctProp!.value).toBeGreaterThanOrEqual(5)
      expect(dmgPctProp!.value).toBeLessThanOrEqual(15)
      expect(supWeapon.stats['dmg%']).toBe(dmgPctProp!.value)

      const weaponTooltip = formatItemTooltip(supWeapon)
      expect(weaponTooltip.lines.map(l => l.text)).toContain(`+${dmgPctProp!.value}% Enhanced Damage`)
      expect(weaponTooltip.oneHandDamage?.isEnhanced).toBe(true)
      expect(weaponTooltip.oneHandDamage?.baseMin).toBe((swordBase as any).mindam)
      expect(weaponTooltip.oneHandDamage?.baseMax).toBe((swordBase as any).maxdam)
    }
  })

  it('2. A4 — Low Quality items pick from LOW_QUALITY_PREFIXES (4 subtypes) and apply 1/3 durability & 0.75x base defense/damage penalty', () => {
    expect(LOW_QUALITY_PREFIXES).toEqual(['Low Quality', 'Cracked', 'Crude', 'Damaged'])

    const monarchBase = dropTables.getBase('uit')! // defense 148, durability 86
    const axeBase = dropTables.getBase('btx')! // mindam 12, maxdam 32, twoHandedMindam 21, twoHandedMaxdam 49, durability 32
    const seenPrefixes = new Set<string>()

    for (let s = 1; s <= 60; s++) {
      const lowArmor = createDroppedItem(monarchBase, 'low', {
        ilvl: 20,
        dwInitSeed: s * 313,
      })
      const prefixUsed = LOW_QUALITY_PREFIXES.find(p => lowArmor.name === `${p} ${monarchBase.name}`)
      expect(prefixUsed).toBeDefined()
      seenPrefixes.add(prefixUsed!)

      const expectedDur = Math.max(1, Math.floor((monarchBase as any).durability / 3))
      expect(lowArmor.maxDurability).toBe(expectedDur)
      expect(lowArmor.durability).toBe(expectedDur)

      const armorTip = formatItemTooltip(lowArmor)
      expect(armorTip.title).toBe(lowArmor.name)
      expect(armorTip.defense).toBe(Math.max(1, Math.floor(monarchBase.defense * 0.75)))
      expect(armorTip.baseDefense).toBe(monarchBase.defense)
      expect(armorTip.durability?.isEnhanced).toBe(true)
      expect(armorTip.durability?.max).toBe(expectedDur)
      expect(armorTip.durability?.baseMax).toBe((monarchBase as any).durability)
    }

    // All 4 prefixes must be sampled across seeds
    expect(seenPrefixes.size).toBe(4)

    const lowWeapon = createDroppedItem(axeBase, 'low', {
      ilvl: 20,
      dwInitSeed: 777,
    })
    const weapTip = formatItemTooltip(lowWeapon)
    expect(weapTip.twoHandDamage?.isEnhanced).toBe(true)
    expect(weapTip.twoHandDamage?.min).toBe(Math.max(1, Math.floor((axeBase as any).twoHandedMindam * 0.75)))
    expect(weapTip.twoHandDamage?.max).toBe(Math.max(1, Math.floor((axeBase as any).twoHandedMaxdam * 0.75)))
  })

  it('3. A5 — Ethereal & Sockets generation and formatItemTooltip 1.5x defense/damage, -10 requirements, and Ethereal/Socketed lines', () => {
    const monarchBase = dropTables.getBase('uit')! // def 148, reqstr 156, gemsockets 4
    const swordBase = dropTables.getBase('crs')! // mindam 5, maxdam 15, reqstr 43, gemsockets 6

    // Test Ethereal + Socketed Armor with +10% Superior ED
    const ethSockArmor = createDroppedItem(monarchBase, 'superior', {
      ilvl: 85,
      dwInitSeed: 42,
      ethereal: true,
      sockets: 4,
      rolledProps: [{ code: 'ac%', min: 10, max: 10, value: 10 }],
    })
    expect(ethSockArmor.flags?.ethereal).toBe(true)
    expect(ethSockArmor.flags?.socketed).toBe(true)
    expect((ethSockArmor as any).ethereal).toBe(true)
    expect((ethSockArmor as any).sockets).toBe(4)

    const armorTip = formatItemTooltip(ethSockArmor)
    const expectedEthBaseDef = Math.floor(monarchBase.defense * 1.5)
    const expectedFinalDef = Math.floor(expectedEthBaseDef * 1.1)
    expect(armorTip.defense).toBe(expectedFinalDef)
    expect(armorTip.baseDefense).toBe(monarchBase.defense)
    expect(armorTip.reqStr).toBe(Math.max(0, (monarchBase as any).reqstr - 10))
    expect(armorTip.baseReqStr).toBe((monarchBase as any).reqstr)
    expect(armorTip.lines.some(l => l.text.includes('Ethereal (Cannot be Repaired)') && l.isMagic)).toBe(true)
    expect(armorTip.lines.some(l => l.text.includes('Socketed (4)') && l.isMagic)).toBe(true)

    // Test Ethereal + Socketed Weapon with +15% Superior ED
    const ethSockWeapon = createDroppedItem(swordBase, 'superior', {
      ilvl: 85,
      dwInitSeed: 43,
      ethereal: true,
      sockets: 5,
      rolledProps: [{ code: 'dmg%', min: 15, max: 15, value: 15 }],
    })
    const weapTip = formatItemTooltip(ethSockWeapon)
    const ethMin = Math.floor((swordBase as any).mindam * 1.5)
    const ethMax = Math.floor((swordBase as any).maxdam * 1.5)
    expect(weapTip.oneHandDamage?.min).toBe(Math.floor(ethMin * 1.15))
    expect(weapTip.oneHandDamage?.max).toBe(Math.floor(ethMax * 1.15))
    expect(weapTip.reqStr).toBe(Math.max(0, (swordBase as any).reqstr - 10))
    expect(weapTip.lines.some(l => l.text.includes('Ethereal (Cannot be Repaired)'))).toBe(true)
    expect(weapTip.lines.some(l => l.text.includes('Socketed (5)'))).toBe(true)

    // Verify rollItemEtherealAndSockets never makes Set items ethereal and respects ilvl socket caps
    for (let s = 1; s <= 100; s++) {
      const setRoll = rollItemEtherealAndSockets(monarchBase, 'set', 85, new D2Rng(s), {
        itemTypes: dropTables.itemTypes,
      })
      expect(setRoll.ethereal).toBe(false)
      expect(setRoll.sockets).toBe(0)

      // Crystal Sword at ilvl 10: swor maxSock1 is 3 (even though crs gemsockets is 6)
      const lowIlvlSwordRoll = rollItemEtherealAndSockets(swordBase, 'normal', 10, new D2Rng(s * 17), {
        itemTypes: dropTables.itemTypes,
      })
      if (lowIlvlSwordRoll.sockets > 0) {
        expect(lowIlvlSwordRoll.sockets).toBeLessThanOrEqual(3)
      }
    }
  })

  it('4. B3 — rollRareAffixes allocates 3..6 affixes slot-by-slot with <=3 prefixes and <=3 suffixes (allowing 3-prefix/0-suffix or 0-prefix/3-suffix)', () => {
    const swordBase = dropTables.getBase('crs')!
    let sawThreeZero = false

    for (let s = 1; s <= 200; s++) {
      const rare = rollRareAffixes(
        swordBase,
        85,
        dropTables.magicAffixes,
        dropTables.rareNames,
        dropTables.isA,
        new D2Rng(s * 1337),
      )
      expect(rare.affixes.length).toBeGreaterThanOrEqual(3)
      expect(rare.affixes.length).toBeLessThanOrEqual(6)
      expect(rare.prefixes.length).toBeLessThanOrEqual(3)
      expect(rare.suffixes.length).toBeLessThanOrEqual(3)
      expect(rare.prefixes.length + rare.suffixes.length).toBe(rare.affixes.length)
      if (rare.prefixes.length === 3 && rare.suffixes.length === 0) {
        sawThreeZero = true
      }
      if (rare.prefixes.length === 0 && rare.suffixes.length === 3) {
        sawThreeZero = true
      }
    }
    expect(sawThreeZero).toBe(true)
  })
})

describe('Affix classspecific Restriction & classlevelreq Tooltip Level Requirement (Issue #132)', () => {
  let dropTables: DropTables

  beforeAll(() => {
    dropTables = getEmbeddedDropTables()
  })

  it('1. isAffixEligible blocks classspecific="ama" on generic sword (swor) and other class items (orb / sor), allowing only Amazon items (abow / ama)', () => {
    const amaPrefix: MagicAffix = {
      name: 'Valkyrie\'s',
      isPrefix: true,
      version: 100,
      spawnable: true,
      rare: true,
      level: 50,
      maxlevel: 0,
      levelreq: 42,
      classspecific: 'ama',
      class: 'ama',
      classlevelreq: 42,
      frequency: 5,
      group: 125,
      mods: [{ code: 'ama', min: 2, max: 2 }],
      transform: false,
      itypes: ['weap'],
      etypes: [],
    }

    // Generic weapon ('swor'): blocked both via inferred type and explicit itemClass: ''
    expect(isAffixEligible(amaPrefix, 'swor', dropTables.isA, { alvl: 60 })).toBe(false)
    expect(isAffixEligible(amaPrefix, 'swor', dropTables.isA, { alvl: 60, itemClass: '' })).toBe(false)

    // Sorceress orb ('orb'): blocked both via inferred type and explicit itemClass: 'sor'
    expect(isAffixEligible(amaPrefix, 'orb', dropTables.isA, { alvl: 60 })).toBe(false)
    expect(isAffixEligible(amaPrefix, 'orb', dropTables.isA, { alvl: 60, itemClass: 'sor' })).toBe(false)

    // Amazon bow ('abow'): allowed both via inferred type and explicit itemClass: 'ama'
    expect(isAffixEligible(amaPrefix, 'abow', dropTables.isA, { alvl: 60 })).toBe(true)
    expect(isAffixEligible(amaPrefix, 'abow', dropTables.isA, { alvl: 60, itemClass: 'ama' })).toBe(true)

    // Verify resolveItemTypeFlags returns exact 3-letter itemClass for all 7 classes and '' for generic items
    expect(resolveItemTypeFlags(dropTables.getBase('am1')!, dropTables.itemTypes, dropTables.isA).itemClass).toBe('ama')
    expect(resolveItemTypeFlags(dropTables.getBase('ob1')!, dropTables.itemTypes, dropTables.isA).itemClass).toBe('sor')
    expect(resolveItemTypeFlags(dropTables.getBase('ne1')!, dropTables.itemTypes, dropTables.isA).itemClass).toBe('nec')
    expect(resolveItemTypeFlags(dropTables.getBase('pa1')!, dropTables.itemTypes, dropTables.isA).itemClass).toBe('pal')
    expect(resolveItemTypeFlags(dropTables.getBase('ba1')!, dropTables.itemTypes, dropTables.isA).itemClass).toBe('bar')
    expect(resolveItemTypeFlags(dropTables.getBase('dr1')!, dropTables.itemTypes, dropTables.isA).itemClass).toBe('dru')
    expect(resolveItemTypeFlags(dropTables.getBase('ktr')!, dropTables.itemTypes, dropTables.isA).itemClass).toBe('ass')
    expect(resolveItemTypeFlags(dropTables.getBase('crs')!, dropTables.itemTypes, dropTables.isA).itemClass).toBe('')
  })

  it('2. formatItemTooltip uses classlevelreq when affix.class matches the equipment itemClass, and levelreq on generic items', () => {
    // Skilltab affix with levelreq=40 on generic items (e.g. gloves/circlet) but classlevelreq=30 on Amazon items (e.g. Stag Bow)
    const bowSkillPrefix: MagicAffix = {
      name: 'Fletcher\'s',
      isPrefix: true,
      version: 100,
      spawnable: true,
      rare: true,
      level: 20,
      maxlevel: 0,
      levelreq: 40,
      class: 'ama',
      classlevelreq: 30,
      frequency: 10,
      group: 125,
      mods: [{ code: 'skilltab', param: '0', min: 1, max: 1 }],
      transform: false,
      itypes: ['weap', 'miss', 'abow', 'swor'],
      etypes: [],
    }

    const stagBowBase = { ...dropTables.getBase('am1')!, levelreq: 14, itemClass: 'ama' } as ItemBase
    const crystalSwordBase = { ...dropTables.getBase('crs')!, levelreq: 11, itemClass: '' } as ItemBase

    const prefixesTable = { all: [bowSkillPrefix] } as unknown as AffixTable
    const suffixesTable = { all: [] } as unknown as AffixTable

    // Find seed that rolls prefix
    let rolledOnAmaBow = rollMagicAffixes(stagBowBase, 50, { prefixes: prefixesTable, suffixes: suffixesTable }, dropTables.isA, new D2Rng(1))
    let rolledOnGenericSword = rollMagicAffixes(crystalSwordBase, 50, { prefixes: prefixesTable, suffixes: suffixesTable }, dropTables.isA, new D2Rng(1))
    for (let s = 1; s <= 20; s++) {
      const c1 = rollMagicAffixes(stagBowBase, 50, { prefixes: prefixesTable, suffixes: suffixesTable }, dropTables.isA, new D2Rng(s))
      const c2 = rollMagicAffixes(crystalSwordBase, 50, { prefixes: prefixesTable, suffixes: suffixesTable }, dropTables.isA, new D2Rng(s))
      if (c1.prefix && c2.prefix) {
        rolledOnAmaBow = c1
        rolledOnGenericSword = c2
        break
      }
    }

    expect(rolledOnAmaBow.prefix?.class).toBe('ama')
    expect(rolledOnAmaBow.prefix?.classlevelreq).toBe(30)
    expect(rolledOnAmaBow.prefix?.levelreq).toBe(40)

    const amaBowItem = createDroppedItem(stagBowBase, 'magic', {
      magicAffixes: rolledOnAmaBow,
      ilvl: 50,
      dwInitSeed: 13201,
    })
    const genericSwordItem = createDroppedItem(crystalSwordBase, 'magic', {
      magicAffixes: rolledOnGenericSword,
      ilvl: 50,
      dwInitSeed: 13202,
    })

    // On Amazon Stag Bow (itemClass: 'ama'), affix.class === 'ama' -> uses classlevelreq (30) instead of levelreq (40)
    const amaTooltip = formatItemTooltip(amaBowItem)
    expect(amaTooltip.reqLevel).toBe(30)

    // On generic Crystal Sword (itemClass: ''), uses standard levelreq (40)
    const swordTooltip = formatItemTooltip(genericSwordItem)
    expect(swordTooltip.reqLevel).toBe(40)
  })
})

describe('Data-Driven Tooltip Properties (C1/C3) & 1.13c Drop Pipeline Alignment (A6/A8/B7) (Issue #133)', () => {
  const hasD2Mpq = fs.existsSync('samples/d2/d2data.mpq')

  it.skipIf(!hasD2Mpq)('1. C1 — loadDropTables(archives) loads Properties.txt (268) & ItemStatCost.txt (359), activates setRuntimePropertyTables, and matches 100% of core descPriority values', async () => {
    const archives = new MountedArchives()
    for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
      archives.add(name, await MpqArchive.open(await fileSource(`samples/d2/${name}`)))
    }

    const mpqDropTables = await loadDropTables(archives)
    expect(mpqDropTables.properties).toBeDefined()
    expect(mpqDropTables.itemStatCost).toBeDefined()
    expect(mpqDropTables.properties!.records).toHaveLength(268)
    expect(mpqDropTables.itemStatCost!.records).toHaveLength(359)

    const corePropertyCodes = [
      'ac',
      'ac%',
      'str',
      'dex',
      'vit',
      'enr',
      'hp',
      'mana',
      'fcr',
      'ias',
      'frw',
      'fhr',
      'fbr',
      'allskills',
      'skilltab',
      'res-fire',
      'res-cold',
      'res-ltng',
      'res-pois',
      'res-all',
      'all-stats',
      'dmg%',
      'dmg-min',
      'dmg-max',
      'dmg-fire',
      'dmg-ltng',
      'dmg-cold',
      'dmg-pois',
      'lifesteal',
      'manasteal',
      'mag%',
      'gold%',
      'crush',
      'deadly',
      'openwounds',
      'indestruct',
      'charged',
      'rep-dur',
      'ease',
      'sock',
    ]

    // Snapshot baseline priorities without runtime tables
    setRuntimePropertyTables(undefined, undefined)
    const baselinePriorities = new Map<string, number>()
    for (const code of corePropertyCodes) {
      baselinePriorities.set(code, getPropertyPriority(code))
    }

    // Re-activate runtime tables loaded from MPQ
    setRuntimePropertyTables(mpqDropTables.properties, mpqDropTables.itemStatCost)

    for (const code of corePropertyCodes) {
      const meta = getRuntimePropertyMetadata(code)
      expect(meta, `getRuntimePropertyMetadata('${code}') must be defined`).toBeDefined()
      expect(meta!.statId, `statId for '${code}' must be >= 0`).toBeGreaterThanOrEqual(0)
      expect(meta!.descPriority, `descPriority for '${code}' must match baseline`).toBe(
        baselinePriorities.get(code),
      )
      expect(getPropertyPriority(code)).toBe(baselinePriorities.get(code))
    }
  })

  it('2. C3 — aggregateAndSortProperties breaks descPriority ties using ascending 1.13c ItemStatCost statId while keeping identical properties stable', () => {
    // 1) prio = 88: extra-fire (passive_fire_mastery, statId=329) vs pierce-fire (passive_fire_pierce, statId=333)
    // 2) prio = 22: red-dmg (normal_damage_reduction, statId=34) vs red-dmg% (damageresist, statId=36)
    // 3) prio = 16: heal-kill (item_healafterkill, statId=86) vs mana-kill (item_manaafterkill, statId=138)
    // 4) prio = 3:  dur (maxdurability, statId=73) vs dur% (item_maxdurability_percent, statId=75)
    expect(getPropertyStatId('extra-fire')).toBe(329)
    expect(getPropertyStatId('pierce-fire')).toBe(333)
    expect(getPropertyStatId('red-dmg')).toBe(34)
    expect(getPropertyStatId('red-dmg%')).toBe(36)
    expect(getPropertyStatId('heal-kill')).toBe(86)
    expect(getPropertyStatId('mana-kill')).toBe(138)
    expect(getPropertyStatId('dur')).toBe(73)
    expect(getPropertyStatId('dur%')).toBe(75)

    // Pass reversed statId order within each tied descPriority group
    const sorted = aggregateAndSortProperties([
      { code: 'dur%', min: 15, max: 15, value: 15 },       // prio 3, statId 75
      { code: 'dur', min: 10, max: 10, value: 10 },        // prio 3, statId 73
      { code: 'mana-kill', min: 3, max: 3, value: 3 },     // prio 16, statId 138
      { code: 'heal-kill', min: 5, max: 5, value: 5 },     // prio 16, statId 86
      { code: 'red-dmg%', min: 10, max: 10, value: 10 },   // prio 22, statId 36
      { code: 'red-dmg', min: 7, max: 7, value: 7 },       // prio 22, statId 34
      { code: 'pierce-fire', min: 5, max: 5, value: 5 },   // prio 88, statId 333
      { code: 'extra-fire', min: 5, max: 5, value: 5 },    // prio 88, statId 329
      { code: 'lifesteal', min: 8, max: 8, value: 8 },     // prio 88, statId 60
      { code: 'hit-skill', param: 197, min: 5, max: 10, value: 5 }, // prio 160, statId 198 (1st)
      { code: 'hit-skill', param: 53, min: 8, max: 12, value: 8 },  // prio 160, statId 198 (2nd)
    ])

    expect(sorted.map(p => `${p.code}${p.param ? `:${p.param}` : ''}`)).toEqual([
      'hit-skill:197',
      'hit-skill:53',
      'lifesteal',
      'extra-fire',
      'pierce-fire',
      'red-dmg',
      'red-dmg%',
      'heal-kill',
      'mana-kill',
      'dur',
      'dur%',
    ])
  })

  it('3. A6 & A8 — executeDropPipeline clamps effectiveIlvl to [1, 99], uses 1.13c [floor(lvl/2), lvl*6] gold range, and prevents qlvl > effectiveIlvl inflation', () => {
    const dropTables = getEmbeddedDropTables()

    // Test A6 gold range & A8 nLevel clamping at nLevel = 120 (clamped to 99 -> gold base [49, 594])
    for (let i = 0; i < 40; i++) {
      const dropsHigh = executeDropPipeline({
        tcName: 'Act 1 H2H A',
        nLevel: 120,
        monsterType: 1,
        dropTables,
        difficulty: 'hell',
        playerMf: 0,
        monsterRng: (0x133000 + i * 37) >>> 0,
      })
      for (const item of dropsHigh) {
        if (item.code?.trim() === 'gld' || item.name === 'Gold') {
          const amt = item.stack ?? item.value ?? 0
          expect(amt).toBeGreaterThanOrEqual(49)
        } else {
          expect(item.ilvl).toBe(99)
        }
      }
    }

    // Test A8 clamping at nLevel = 0 (clamped to 1) on high-qlvl base ('uit' Monarch, qlvl=72)
    // Ensures ilvl === 1 and qlvl is clamped to 1 so D = ilvl - qlvl = 0 (not -71)
    for (let i = 0; i < 30; i++) {
      const dropsLow = executeDropPipeline({
        tcName: 'uit',
        nLevel: 0,
        monsterType: 1,
        dropTables,
        difficulty: 'normal',
        playerMf: 0,
        monsterRng: (0x233000 + i * 41) >>> 0,
      })
      expect(dropsLow).toHaveLength(1)
      expect(dropsLow[0]!.ilvl).toBe(1)
    }
  })

  it('4. B7 — rollRareAffixes prevents duplicate rarePrefix and rareSuffix names when eligibleRareSuffixes.length > 1', () => {
    const dropTables = getEmbeddedDropTables()
    const swordBase = dropTables.getBase('crs')!

    const collidingRareNames: { prefixes: RareNameTable; suffixes: RareNameTable } = {
      prefixes: {
        entries: [],
        getEligible: () => [
          { index: 0, name: 'Shadow', version: 100, itypes: ['weap'], etypes: [], add: 0, multiply: 0, divide: 0 },
        ],
      } as unknown as RareNameTable,
      suffixes: {
        entries: [],
        getEligible: () => [
          { index: 0, name: 'Shadow', version: 100, itypes: ['weap'], etypes: [], add: 0, multiply: 0, divide: 0 },
          { index: 1, name: 'Fang', version: 100, itypes: ['weap'], etypes: [], add: 0, multiply: 0, divide: 0 },
        ],
      } as unknown as RareNameTable,
    }

    for (let s = 1; s <= 30; s++) {
      const rolled = rollRareAffixes(
        swordBase,
        50,
        dropTables.magicAffixes,
        collidingRareNames,
        dropTables.isA,
        new D2Rng(s),
      )
      expect(rolled.rarePrefix?.name).toBe('Shadow')
      expect(rolled.rareSuffix?.name).toBe('Fang')
      expect(rolled.name).toBe('Shadow Fang')
    }
  })
})


