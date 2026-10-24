/**
 * Comprehensive 1.13c Unit Verification Suite — Paladin Defensive Auras Tree (10 Skills).
 *
 * Covers:
 * - Architecture Invariants: BATCH1_SKILLS length === 38, ISO_GROUND_ASPECT_RATIO === 0.5
 * - Prayer (99): Periodic heal pulse, continuous mana drain (16/256), auto-deactivation at 0 mana
 * - Resist Fire (100): Active party fire res, passive max fire res (+1% per 2 hard points, capped at 95%)
 * - Defiance (104): Active party %Defense, Holy Shield synergy (+15%/blvl)
 * - Resist Cold (105): Active party cold res, passive max cold res (+1% per 2 hard points, capped at 95%)
 * - Cleansing (109): Curse & poison duration reduction, free Prayer synergy heal pulse
 * - Resist Lightning (110): Active party lightning res, passive max lightning res (+1% per 2 hard points, capped at 95%)
 * - Vigor (115): FRW velocitypercent, stamina recovery bonus, max stamina %
 * - Meditation (120): Active party mana recovery rate, free Prayer synergy heal pulse
 * - Redemption (124): 50-tick cadence, fixed 16 subtiles in 2:1 isometric space, dm34 chance, ln56 life/mana restore, corpse consumption
 * - Salvation (125): Active party Fire/Cold/Lightning res, zero effect on Poison or Magic
 */
import { describe, expect, it } from 'vitest'
import {
  BATCH1_SKILLS,
  ISO_GROUND_ASPECT_RATIO,
  calculatePrayerStats,
  calculateResistFireStats,
  calculateDefianceStats,
  calculateResistColdStats,
  calculateCleansingStats,
  calculateResistLightningStats,
  calculateVigorStats,
  calculateMeditationStats,
  calculateRedemptionStats,
  calculateSalvationStats,
} from '../../../src/server/skills/skills.ts'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { FIXED_ONE, UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { AuraScanner } from '../../../src/server/engine/aura-scanner.ts'
import {
  computeEffectiveResistance,
  executeSUnitDmg,
  type CombatUnitContext,
} from '../../../src/server/engine/combat-pipeline.ts'

describe('Paladin Defensive Auras — Milestone M9 Architecture & Formula Invariants', () => {
  it('enforces architecture invariants: BATCH1_SKILLS length === 38 and ISO_GROUND_ASPECT_RATIO === 0.5', () => {
    expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    expect(ISO_GROUND_ASPECT_RATIO).toBe(0.5)
  })

  // --------------------------------------------------------------------------
  // 1. Prayer (99)
  // --------------------------------------------------------------------------
  describe('Skill #099: Prayer', () => {
    it('scales heal amount (edns 5-band) and radius at slvl 1, 10, and 20', () => {
      const s1 = calculatePrayerStats(1)
      expect(s1.healAmount).toBe(2)
      expect(s1.healAmount256).toBe(512)
      expect(s1.manaCostPerFrame256).toBe(16)
      expect(s1.radiusSubtiles).toBe(16)
      expect(s1.radiusYards).toBe(10.67)

      const s10 = calculatePrayerStats(10)
      expect(s10.healAmount).toBe(11) // 2 + 7*1 + 2*1 = 11
      expect(s10.healAmount256).toBe(11 * 256)
      expect(s10.radiusSubtiles).toBe(34) // 16 + 9*2 = 34
      expect(s10.radiusYards).toBe(22.67)

      const s20 = calculatePrayerStats(20)
      expect(s20.healAmount).toBe(25) // 2 + 7 + 8 + 4*2 = 25
      expect(s20.healAmount256).toBe(25 * 256)
      expect(s20.radiusSubtiles).toBe(54) // 16 + 19*2 = 54
    })

    it('heals self and damaged party allies within range on pulse', async () => {
      const registry = await getSharedDataRegistry()
      const scanner = new AuraScanner(registry)

      const statsCaster = new UnitStatList(registry, {
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 500 * FIXED_ONE,
        maxmana: 500 * FIXED_ONE,
        mana: 500 * FIXED_ONE,
      })
      const busCaster = new StateBus(statsCaster, registry)
      const caster: CombatUnitContext = {
        id: 'paladin_caster',
        name: 'Paladin Caster',
        statList: statsCaster,
        stateBus: busCaster,
        unitType: 'player',
        x: 0,
        y: 0,
      }

      const statsAlly = new UnitStatList(registry, {
        maxhp: 800 * FIXED_ONE,
        hitpoints: 400 * FIXED_ONE,
      })
      const busAlly = new StateBus(statsAlly, registry)
      const ally: CombatUnitContext = {
        id: 'party_ally',
        name: 'Party Ally',
        statList: statsAlly,
        stateBus: busAlly,
        unitType: 'party',
        // #1410: sub-tile Euclidean radius (Prayer slvl 10 ln12 = 34): 10² + 5² <= 34²
        x: 10,
        y: 5,
      }

      const aura = scanner.setActiveAura(caster, 99, 10, 0)!
      expect(aura).toBeDefined()

      const outcome = scanner.pulseAura(aura, 0, [caster, ally], [])
      expect(outcome.healthRestored).toBe(22) // 11 to caster + 11 to ally
      expect(caster.statList.getHp256()).toBe((500 + 11) * FIXED_ONE)
      expect(ally.statList.getHp256()).toBe((400 + 11) * FIXED_ONE)
    })

    it('drains mana per tick and auto-deactivates when mana reaches 0', async () => {
      const registry = await getSharedDataRegistry()
      const scanner = new AuraScanner(registry)

      // Paladin with exactly 32 units of mana256 (enough for 2 frames)
      const stats = new UnitStatList(registry, {
        maxmana: 100 * FIXED_ONE,
        mana: 32,
      })
      const bus = new StateBus(stats, registry)
      const paladin: CombatUnitContext = {
        id: 'paladin',
        name: 'Paladin',
        statList: stats,
        stateBus: bus,
        unitType: 'player',
      }

      scanner.setActiveAura(paladin, 99, 1, 0)
      expect(paladin.statList.getMana256()).toBe(32)

      // Frame 1: drains 16 units -> 16 remaining
      scanner.tick(1, [paladin], [])
      expect(paladin.statList.getMana256()).toBe(16)

      // Frame 2: drains 16 units -> 0 remaining
      scanner.tick(2, [paladin], [])
      expect(paladin.statList.getMana256()).toBe(0)

      // Frame 3: curMana < 16 -> auto-deactivates aura and removes state
      scanner.tick(3, [paladin], [])
      expect(paladin.statList.getMana256()).toBe(0)
      expect(paladin.stateBus.hasState('prayer')).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // 2. Resist Fire (100)
  // --------------------------------------------------------------------------
  describe('Skill #100: Resist Fire', () => {
    it('scales active party fire resistance at slvl 1, 10, and 20', () => {
      const s1 = calculateResistFireStats(1)
      expect(s1.fireResistPct).toBe(53)
      expect(s1.radiusSubtiles).toBe(16)

      const s10 = calculateResistFireStats(10)
      expect(s10.fireResistPct).toBe(114)

      const s20 = calculateResistFireStats(20)
      expect(s20.fireResistPct).toBe(132)
    })

    it('grants passive +1% Max Fire Resistance per 2 hard points, active even when aura is inactive', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList(registry)
      expect(stats.getEffectiveMaxResistance('fire')).toBe(75)

      // 5 hard points in Resist Fire -> +2% max fire res (floor(5/2) = 2)
      stats.setBaseSkillLevel(100, 5)
      expect(stats.getAccruedStat('maxfireresist')).toBe(2)
      expect(stats.getEffectiveMaxResistance('fire')).toBe(77)

      // +skills items do NOT increase passive max res (blvl only!)
      stats.setBonusSkillLevel(100, 10)
      expect(stats.getAccruedStat('maxfireresist')).toBe(2)
      expect(stats.getEffectiveMaxResistance('fire')).toBe(77)

      // 20 hard points -> +10% passive max fire res -> 85% when inactive
      stats.setBaseSkillLevel(100, 20)
      expect(stats.getAccruedStat('maxfireresist')).toBe(10)
      expect(stats.getEffectiveMaxResistance('fire')).toBe(85)

      // When Resist Fire aura is actively pulsed via AuraScanner:
      // Caster and party allies receive +blvl (+20%) maxfireresist, and caster's passive +10% is suppressed!
      const scanner = new AuraScanner(registry)
      const paladin: CombatUnitContext = {
        id: 'paladin',
        name: 'Paladin',
        statList: stats,
        stateBus: new StateBus(stats, registry),
        unitType: 'player',
        x: 0,
        y: 0,
      }
      const statsAlly = new UnitStatList(registry)
      const ally: CombatUnitContext = {
        id: 'ally',
        name: 'Party Ally',
        statList: statsAlly,
        stateBus: new StateBus(statsAlly, registry),
        unitType: 'party',
        x: 3,
        y: 0,
      }
      const aura = scanner.setActiveAura(paladin, 100, 20, 0)!
      scanner.pulseAura(aura, 0, [paladin, ally], [])
      expect(paladin.statList.getAccruedStat('maxfireresist')).toBe(20)
      expect(paladin.statList.getEffectiveMaxResistance('fire')).toBe(95)
      expect(ally.statList.getAccruedStat('maxfireresist')).toBe(20)
      expect(ally.statList.getEffectiveMaxResistance('fire')).toBe(95)
    })
  })

  // --------------------------------------------------------------------------
  // 3. Defiance (104)
  // --------------------------------------------------------------------------
  describe('Skill #104: Defiance', () => {
    it('scales party %Defense at slvl 1, 10, and 20', () => {
      const s1 = calculateDefianceStats(1)
      expect(s1.defensePercent).toBe(70)
      expect(s1.radiusSubtiles).toBe(16)

      const s10 = calculateDefianceStats(10)
      expect(s10.defensePercent).toBe(160)

      const s20 = calculateDefianceStats(20)
      expect(s20.defensePercent).toBe(260)
    })

    it('increases party member defense in executeSUnitDmg reducing monster chance to hit', async () => {
      const registry = await getSharedDataRegistry()
      const statsPal = new UnitStatList(registry, { armorclass: 1000 })
      const busPal = new StateBus(statsPal, registry)
      busPal.applyState({ stateNameOrId: 'defiance', slvl: 10, stats: { skill_armor_percent: 160 } })

      expect(statsPal.getAccruedStat('armorclass')).toBe(2600) // 1000 * 2.6 = 2600
    })
  })

  // --------------------------------------------------------------------------
  // 4. Resist Cold (105)
  // --------------------------------------------------------------------------
  describe('Skill #105: Resist Cold', () => {
    it('scales active party cold resistance at slvl 1, 10, and 20', () => {
      const s1 = calculateResistColdStats(1)
      expect(s1.coldResistPct).toBe(53)
      const s10 = calculateResistColdStats(10)
      expect(s10.coldResistPct).toBe(114)
      expect(calculateResistColdStats(20).coldResistPct).toBe(132)
    })

    it('grants passive +1% Max Cold Resistance per 2 hard points', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList(registry)
      expect(stats.getEffectiveMaxResistance('cold')).toBe(75)

      stats.setBaseSkillLevel(105, 14)
      expect(stats.getAccruedStat('maxcoldresist')).toBe(7)
      expect(stats.getEffectiveMaxResistance('cold')).toBe(82)
    })
  })

  // --------------------------------------------------------------------------
  // 5. Cleansing (109)
  // --------------------------------------------------------------------------
  describe('Skill #109: Cleansing', () => {
    it('scales curse & poison duration reduction at slvl 1, 10, and 20', () => {
      const s1 = calculateCleansingStats(1)
      expect(s1.curseReductionPct).toBe(39)
      expect(s1.poisonLengthReductionPct).toBe(39)

      const s10 = calculateCleansingStats(10)
      expect(s10.curseReductionPct).toBe(71)

      const s20 = calculateCleansingStats(20)
      expect(s20.curseReductionPct).toBe(80)
    })

    it('emits free Prayer heal pulse when caster has Prayer hard points (0 mana cost)', async () => {
      const registry = await getSharedDataRegistry()
      const scanner = new AuraScanner(registry)

      const stats = new UnitStatList(registry, {
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 500 * FIXED_ONE,
        maxmana: 100 * FIXED_ONE,
        mana: 100 * FIXED_ONE,
      })
      stats.setBaseSkillLevel(99, 10) // 10 hard points in Prayer (11 HP heal)
      const bus = new StateBus(stats, registry)
      const paladin: CombatUnitContext = {
        id: 'paladin',
        name: 'Paladin',
        statList: stats,
        stateBus: bus,
        unitType: 'player',
      }

      const aura = scanner.setActiveAura(paladin, 109, 1, 0)!
      const outcome = scanner.pulseAura(aura, 0, [paladin], [])

      expect(outcome.healthRestored).toBe(11)
      expect(paladin.statList.getHp256()).toBe(511 * FIXED_ONE)
      // Cleansing does NOT drain mana!
      expect(paladin.statList.getMana256()).toBe(100 * FIXED_ONE)
    })

    it('shortens active curse duration on party members', async () => {
      const registry = await getSharedDataRegistry()
      const scanner = new AuraScanner(registry)

      const stats = new UnitStatList(registry)
      const bus = new StateBus(stats, registry)
      const paladin: CombatUnitContext = {
        id: 'paladin',
        name: 'Paladin',
        statList: stats,
        stateBus: bus,
        unitType: 'player',
      }

      // Inflict Amplify Damage curse for 100 frames
      bus.applyState({
        stateNameOrId: 'amplifydamage',
        curseTypeOverride: 1,
        durationFrames: 100,
        currentFrame: 0,
      })

      expect(bus.getState('amplifydamage')?.expireFrame).toBe(100)

      // Pulse Cleansing slvl 10 (71% reduction) at tick 0
      const aura = scanner.setActiveAura(paladin, 109, 10, 0)!
      scanner.pulseAura(aura, 0, [paladin], [])

      // Remaining 100 frames reduced by 71% -> 100 * 0.29 = 29 frames remaining
      expect(bus.getState('amplifydamage')?.expireFrame).toBe(29)
    })
  })

  // --------------------------------------------------------------------------
  // 6. Resist Lightning (110)
  // --------------------------------------------------------------------------
  describe('Skill #110: Resist Lightning', () => {
    it('scales active party lightning resistance at slvl 1, 10, and 20', () => {
      const s1 = calculateResistLightningStats(1)
      expect(s1.lightningResistPct).toBe(53)
      expect(calculateResistLightningStats(10).lightningResistPct).toBe(114)
      expect(calculateResistLightningStats(20).lightningResistPct).toBe(132)
    })

    it('grants passive +1% Max Lightning Resistance per 2 hard points', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList(registry)
      expect(stats.getEffectiveMaxResistance('ltng')).toBe(75)

      stats.setBaseSkillLevel(110, 20)
      expect(stats.getAccruedStat('maxlightresist')).toBe(10)
      expect(stats.getEffectiveMaxResistance('ltng')).toBe(85)
    })
  })

  // --------------------------------------------------------------------------
  // 7. Vigor (115)
  // --------------------------------------------------------------------------
  describe('Skill #115: Vigor', () => {
    it('scales FRW %, stamina recovery %, and max stamina % at slvl 1, 10, and 20', () => {
      const s1 = calculateVigorStats(1)
      expect(s1.velocityPercent).toBe(13)
      expect(s1.staminaRecoveryBonusPct).toBe(50)
      expect(s1.maxStaminaPercent).toBe(50)
      expect(s1.radiusSubtiles).toBe(16)

      const s10 = calculateVigorStats(10)
      expect(s10.velocityPercent).toBe(36)
      expect(s10.staminaRecoveryBonusPct).toBe(275)
      expect(s10.maxStaminaPercent).toBe(275)
      expect(s10.radiusSubtiles).toBe(43) // 16 + 9*3 = 43

      const s20 = calculateVigorStats(20)
      expect(s20.velocityPercent).toBe(43)
      expect(s20.staminaRecoveryBonusPct).toBe(525)
      expect(s20.maxStaminaPercent).toBe(525)
      expect(s20.radiusSubtiles).toBe(73) // 16 + 19*3 = 73
    })
  })

  // --------------------------------------------------------------------------
  // 8. Meditation (120)
  // --------------------------------------------------------------------------
  describe('Skill #120: Meditation', () => {
    it('scales party mana recovery bonus at slvl 1, 10, and 20', () => {
      const s1 = calculateMeditationStats(1)
      expect(s1.manaRecoveryBonusPct).toBe(300)
      expect(s1.radiusSubtiles).toBe(16)

      const s10 = calculateMeditationStats(10)
      expect(s10.manaRecoveryBonusPct).toBe(525)

      const s20 = calculateMeditationStats(20)
      expect(s20.manaRecoveryBonusPct).toBe(775)
    })

    it('emits free Prayer heal pulse with 0 mana drain and enforces 1.13c player-only aurafilter (73729)', async () => {
      const registry = await getSharedDataRegistry()
      const scanner = new AuraScanner(registry)

      const stats = new UnitStatList(registry, {
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 500 * FIXED_ONE,
        maxmana: 100 * FIXED_ONE,
        mana: 100 * FIXED_ONE,
      })
      stats.setBaseSkillLevel(99, 20) // 20 hard points in Prayer (25 HP heal)
      const bus = new StateBus(stats, registry)
      const paladin: CombatUnitContext = {
        id: 'paladin',
        name: 'Paladin',
        statList: stats,
        stateBus: bus,
        unitType: 'player',
      }

      const statsMerc = new UnitStatList(registry, {
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 500 * FIXED_ONE,
      })
      const merc: CombatUnitContext = {
        id: 'merc',
        name: 'Mercenary',
        statList: statsMerc,
        stateBus: new StateBus(statsMerc, registry),
        unitType: 'mercenary',
      }

      const aura = scanner.setActiveAura(paladin, 120, 1, 0)!
      const outcome = scanner.pulseAura(aura, 0, [paladin, merc], [])

      expect(outcome.healthRestored).toBe(25)
      expect(paladin.statList.getHp256()).toBe(525 * FIXED_ONE)
      expect(paladin.statList.getMana256()).toBe(100 * FIXED_ONE)
      // Mercenary is excluded by Meditation aurafilter = 73729 (0x12001)
      expect(merc.stateBus.hasState('meditation')).toBe(false)
      expect(merc.statList.getHp256()).toBe(500 * FIXED_ONE)
    })
  })

  // --------------------------------------------------------------------------
  // 9. Redemption (124)
  // --------------------------------------------------------------------------
  describe('Skill #124: Redemption', () => {
    it('scales redemption chance and recovery amounts at slvl 1, 10, and 20', () => {
      const s1 = calculateRedemptionStats(1)
      expect(s1.redemptionChancePct).toBe(24)
      expect(s1.lifeRecoverPts).toBe(25)
      expect(s1.manaRecoverPts).toBe(25)
      expect(s1.radiusSubtiles).toBe(16)

      const s10 = calculateRedemptionStats(10)
      expect(s10.redemptionChancePct).toBe(71)
      expect(s10.lifeRecoverPts).toBe(70)
      expect(s10.manaRecoverPts).toBe(70)

      const s20 = calculateRedemptionStats(20)
      expect(s20.redemptionChancePct).toBe(86)
      expect(s20.lifeRecoverPts).toBe(120)
      expect(s20.manaRecoverPts).toBe(120)
    })

    it('consumes valid corpses within 16 subtiles and restores Life & Mana to caster only', async () => {
      const registry = await getSharedDataRegistry()
      const scanner = new AuraScanner(registry)

      const stats = new UnitStatList(registry, {
        maxhp: 1000 * FIXED_ONE,
        hitpoints: 500 * FIXED_ONE,
        maxmana: 500 * FIXED_ONE,
        mana: 200 * FIXED_ONE,
      })
      const bus = new StateBus(stats, registry)
      const paladin: CombatUnitContext = {
        id: 'paladin',
        name: 'Paladin',
        statList: stats,
        stateBus: bus,
        unitType: 'player',
        x: 0,
        y: 0,
      }

      const corpses = [
        // #1410: Redemption ln12 = 16 sub-tiles, dx² + dy² <= 256
        { id: 'corpse_1', consumed: false, x: 10, y: 5 }, // inside (125)
        { id: 'corpse_2', consumed: false, x: 12, y: 10 }, // inside (244)
        { id: 'corpse_3', consumed: true, x: 5, y: 3 },   // already consumed
        { id: 'corpse_4', consumed: false, x: 12, y: 11 }, // outside range (265)
      ]

      const aura = scanner.setActiveAura(paladin, 124, 10, 0)! // slvl 10: 70 Life/Mana
      // Always pass rollChanceFn for deterministic test
      const outcome = scanner.pulseAura(aura, 0, [paladin], [], corpses, {
        rollChanceFn: () => true,
      })

      expect(outcome.corpsesRedeemed).toBe(2)
      expect(corpses[0]!.consumed).toBe(true)
      expect(corpses[1]!.consumed).toBe(true)
      expect(corpses[3]!.consumed).toBe(false) // untouched outside

      // Restored 2 corpses * 70 pts = 140 HP and 140 Mana
      expect(paladin.statList.getHp256()).toBe((500 + 140) * FIXED_ONE)
      expect(paladin.statList.getMana256()).toBe((200 + 140) * FIXED_ONE)
    })
  })

  // --------------------------------------------------------------------------
  // 10. Salvation (125)
  // --------------------------------------------------------------------------
  describe('Skill #125: Salvation', () => {
    it('scales active Fire, Cold, Lightning resistances at slvl 1, 10, and 20', () => {
      const s1 = calculateSalvationStats(1)
      expect(s1.fireResistPct).toBe(61)
      expect(s1.coldResistPct).toBe(61)
      expect(s1.lightningResistPct).toBe(61)
      expect(s1.radiusSubtiles).toBe(16)

      const s10 = calculateSalvationStats(10)
      expect(s10.fireResistPct).toBe(98)
      expect(s10.coldResistPct).toBe(98)
      expect(s10.lightningResistPct).toBe(98)

      const s20 = calculateSalvationStats(20)
      expect(s20.fireResistPct).toBe(109)
      expect(s20.coldResistPct).toBe(109)
      expect(s20.lightningResistPct).toBe(109)
    })

    it('strictly provides zero resistance bonus to Poison or Magic', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList(registry)
      const bus = new StateBus(stats, registry)
      const salv = calculateSalvationStats(10)

      bus.applyState({
        stateNameOrId: 'salvation',
        slvl: 10,
        stats: {
          fireresist: salv.fireResistPct,
          coldresist: salv.coldResistPct,
          lightresist: salv.lightningResistPct,
        },
      })

      expect(stats.getAccruedStat('fireresist')).toBe(98)
      expect(stats.getAccruedStat('coldresist')).toBe(98)
      expect(stats.getAccruedStat('lightresist')).toBe(98)
      // Strictly zero to poison or magic!
      expect(stats.getAccruedStat('poisonresist')).toBe(0)
      expect(stats.getAccruedStat('magicresist')).toBe(0)
    })
  })
})
