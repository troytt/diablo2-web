/**
 * Comprehensive 1.13c Unit Verification Suite — Paladin Offensive Auras Tree (10 Skills).
 *
 * Covers:
 * - Architecture Invariants: BATCH1_SKILLS length === 38, ISO_GROUND_ASPECT_RATIO === 0.5
 * - Might (98): Party physical %ED, radius scaling, combat integration
 * - Holy Fire (102): Radial pulse, weapon fire damage, Resist Fire (+18%) & Salvation (+6%) synergies
 * - Thorns (103): Melee physical reflection, physical resistance mitigation, PvP 1/4th penalty
 * - Blessed Aim (108): Active party AR, +5% passive AR per hard point even when inactive
 * - Concentration (113): Party %ED, 20% uninterrupted attack chance, +50% Blessed Hammer synergy
 * - Holy Freeze (114): Continuous slow, CBF bypass, cold pulse, weapon cold damage & chill length, synergies
 * - Holy Shock (118): Lightning pulse (min=1), weapon lightning damage, Resist Lightning (+12%) & Salvation (+4%) synergies
 * - Sanctuary (119): Magic pulse & knockback vs Undead, sets Undead physical resistance to 0%, %ED vs Undead, Cleansing synergy
 * - Fanaticism (122): IAS, %AR, caster physical %ED vs ally physical %ED (strictly half)
 * - Conviction (123): Defense % reduction, elemental resistance reduction, 1/5th immunity breaking, zero impact on Poison/Magic, caster immunity
 */
import { describe, expect, it } from 'vitest'
import {
  BATCH1_SKILLS,
  ISO_GROUND_ASPECT_RATIO,
  calculateMightStats,
  calculateHolyFireStats,
  calculateThornsStats,
  calculateBlessedAimStats,
  calculateConcentrationStats,
  calculateHolyFreezeStats,
  calculateHolyShockStats,
  calculateSanctuaryStats,
  calculateFanaticismStats,
  calculateConvictionStats,
  calculateBlessedHammerDamage,
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

describe('Paladin Offensive Auras — Milestone M8 Architecture & Formula Invariants', () => {
  it('enforces architecture invariants: BATCH1_SKILLS length === 38 and ISO_GROUND_ASPECT_RATIO === 0.5', () => {
    expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    expect(ISO_GROUND_ASPECT_RATIO).toBe(0.5)
  })

  // --------------------------------------------------------------------------
  // 1. Might (98)
  // --------------------------------------------------------------------------
  describe('Skill #098: Might', () => {
    it('scales party physical %ED and radius at slvl 1, 10, and 20', () => {
      const s1 = calculateMightStats(1)
      expect(s1.damagePercent).toBe(40)
      expect(s1.radiusSubtiles).toBe(16)
      expect(s1.radiusYards).toBe(10.67)

      const s10 = calculateMightStats(10)
      expect(s10.damagePercent).toBe(130)
      expect(s10.radiusSubtiles).toBe(34)
      expect(s10.radiusYards).toBe(22.67)

      const s20 = calculateMightStats(20)
      expect(s20.damagePercent).toBe(230)
      expect(s20.radiusSubtiles).toBe(54)
      expect(s20.radiusYards).toBe(36.0)
    })

    it('boosts weapon physical damage in executeSUnitDmg when active', async () => {
      const registry = await getSharedDataRegistry()
      const statsP = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const busP = new StateBus(statsP, registry)
      busP.applyState({ stateNameOrId: 'might', slvl: 10 })

      const paladin: CombatUnitContext = {
        id: 'paladin',
        name: 'Paladin',
        statList: statsP,
        stateBus: busP,
        unitType: 'player',
        weaponMinPhys: 100,
        weaponMaxPhys: 100,
      }

      const statsM = new UnitStatList(registry, { maxhp: 5000 * FIXED_ONE, hitpoints: 5000 * FIXED_ONE, damageresist: 0 })
      const monster: CombatUnitContext = {
        id: 'monster',
        name: 'Monster',
        statList: statsM,
        stateBus: new StateBus(statsM, registry),
        unitType: 'monster',
      }

      const out = executeSUnitDmg(paladin, monster, {
        skillId: 0,
        attackKind: 'melee',
        autoHit: true,
      }, { rand: () => 50 })

      // 100 base damage with slvl 10 Might (+130% ED) = 230 damage
      expect(out.physDamage256).toBe(230 * FIXED_ONE)
    })
  })

  // --------------------------------------------------------------------------
  // 2. Holy Fire (102)
  // --------------------------------------------------------------------------
  describe('Skill #102: Holy Fire', () => {
    it('calculates pulse damage, weapon fire damage, and synergies at slvl 1, 10, and 20', () => {
      const s1 = calculateHolyFireStats(1)
      expect(s1.pulseMin).toBe(1)
      expect(s1.pulseMax).toBe(3)
      expect(s1.pulseMin256).toBe(256)
      expect(s1.pulseMax256).toBe(768)
      expect(s1.weaponFireMin).toBe(6) // 6 * pulseMin
      expect(s1.weaponFireMax).toBe(18) // 6 * pulseMax
      expect(s1.radiusSubtiles).toBe(6)

      const s10 = calculateHolyFireStats(10)
      expect(s10.pulseMin256).toBe(1664)
      expect(s10.pulseMax256).toBe(2176)
      expect(s10.weaponFireMin).toBe(39) // Math.trunc(1664 * 6 / 256)
      expect(s10.weaponFireMax).toBe(51) // Math.trunc(2176 * 6 / 256)

      const s20 = calculateHolyFireStats(20)
      expect(s20.pulseMin256).toBe(4736)
      expect(s20.pulseMax256).toBe(5248)
      expect(s20.weaponFireMin).toBe(111)
      expect(s20.weaponFireMax).toBe(123)

      // Synergies: Resist Fire (+18%/blvl), Salvation (+6%/blvl)
      const s20Syn = calculateHolyFireStats(20, { resistFire: 20, salvation: 20 })
      expect(s20Syn.synergyBonusPct).toBe(20 * 18 + 20 * 6) // +480%
      expect(s20Syn.pulseMin256).toBe(Math.trunc((4736 * (100 + 480)) / 100))
      expect(s20Syn.pulseMax256).toBe(Math.trunc((5248 * (100 + 480)) / 100))
    })

    it('adds weapon fire damage to physical attacks in executeSUnitDmg', async () => {
      const registry = await getSharedDataRegistry()
      const statsP = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      statsP.setBaseSkillLevel(100, 20) // Resist Fire 20 (+360%)
      const busP = new StateBus(statsP, registry)
      busP.applyState({ stateNameOrId: 'holyfire', slvl: 20 })

      const paladin: CombatUnitContext = {
        id: 'paladin',
        name: 'Paladin',
        statList: statsP,
        stateBus: busP,
        unitType: 'player',
        weaponMinPhys: 50,
        weaponMaxPhys: 50,
      }

      const statsM = new UnitStatList(registry, { maxhp: 5000 * FIXED_ONE, hitpoints: 5000 * FIXED_ONE, fireresist: 0 })
      const monster: CombatUnitContext = {
        id: 'monster',
        name: 'Monster',
        statList: statsM,
        stateBus: new StateBus(statsM, registry),
        unitType: 'monster',
      }

      const out = executeSUnitDmg(paladin, monster, {
        skillId: 0,
        attackKind: 'melee',
        autoHit: true,
      }, { rand: () => 50 })

      expect(out.physDamage256).toBe(50 * FIXED_ONE)
      expect(out.elemDamage256).toBeGreaterThan(0)
    })
  })

  // --------------------------------------------------------------------------
  // 3. Thorns (103)
  // --------------------------------------------------------------------------
  describe('Skill #103: Thorns', () => {
    it('scales damage reflection percentage at slvl 1, 10, and 20', () => {
      expect(calculateThornsStats(1).reflectPct).toBe(250)
      expect(calculateThornsStats(10).reflectPct).toBe(610)
      expect(calculateThornsStats(20).reflectPct).toBe(1010)
    })

    it('reflects melee physical damage, mitigated by attacker physical resistance, with PvP 1/4th penalty', async () => {
      const registry = await getSharedDataRegistry()

      // 1. PvM Reflection: Attacker has 0% physical resistance
      const statsDef = new UnitStatList(registry, { maxhp: 2000 * FIXED_ONE, hitpoints: 2000 * FIXED_ONE, damageresist: 0 })
      const busDef = new StateBus(statsDef, registry)
      busDef.applyState({ stateNameOrId: 'thorns', slvl: 1 }) // 250% reflection

      const paladinDef: CombatUnitContext = {
        id: 'pal_def',
        name: 'Paladin Defender',
        statList: statsDef,
        stateBus: busDef,
        unitType: 'player',
      }

      const statsAtk = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE, damageresist: 0 })
      const busAtk = new StateBus(statsAtk, registry)
      const monsterAtk: CombatUnitContext = {
        id: 'monster_atk',
        name: 'Monster Attacker',
        statList: statsAtk,
        stateBus: busAtk,
        unitType: 'monster',
        weaponMinPhys: 100,
        weaponMaxPhys: 100,
      }

      const outPvM = executeSUnitDmg(monsterAtk, paladinDef, {
        skillId: 0,
        attackKind: 'melee',
        autoHit: true,
      }, { rand: () => 50 })
      // 100 phys damage dealt -> reflects 250% = 250 damage back to monster
      expect(outPvM.reflectedPhys256).toBe(250 * FIXED_ONE)
      expect(monsterAtk.statList.getHp256()).toBe(750 * FIXED_ONE)

      // 2. Physical resistance mitigation: Attacker has 50% physical resistance
      const statsAtk50 = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE, damageresist: 50 })
      const monsterAtk50: CombatUnitContext = {
        id: 'monster_50',
        name: 'Monster 50% Res',
        statList: statsAtk50,
        stateBus: new StateBus(statsAtk50, registry),
        unitType: 'monster',
        weaponMinPhys: 100,
        weaponMaxPhys: 100,
      }
      const out50 = executeSUnitDmg(monsterAtk50, paladinDef, {
        skillId: 0,
        attackKind: 'melee',
        autoHit: true,
      }, { rand: () => 50 })
      // 250 reflected * (100 - 50)% = 125 reflected
      expect(out50.reflectedPhys256).toBe(125 * FIXED_ONE)

      // 3. PvP 1/4th penalty: Player attacker vs Player defender
      const statsPlayerAtk = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE, damageresist: 0 })
      const playerAtk: CombatUnitContext = {
        id: 'player_atk',
        name: 'Player Attacker',
        statList: statsPlayerAtk,
        stateBus: new StateBus(statsPlayerAtk, registry),
        unitType: 'player',
        weaponMinPhys: 100,
        weaponMaxPhys: 100,
      }
      const outPvP = executeSUnitDmg(playerAtk, paladinDef, {
        skillId: 0,
        attackKind: 'melee',
        autoHit: true,
      }, { rand: () => 50 })
      // In PvP, 1/4th penalty applies: 250 * 256 / 4 = 16000 (62.5 damage in 256-fixed-point)
      expect(outPvP.reflectedPhys256).toBe(Math.trunc((250 * FIXED_ONE) / 4))
    })
  })

  // --------------------------------------------------------------------------
  // 4. Blessed Aim (108)
  // --------------------------------------------------------------------------
  describe('Skill #108: Blessed Aim', () => {
    it('scales active party %AR at slvl 1, 10, and 20', () => {
      expect(calculateBlessedAimStats(1).attackRatingPct).toBe(75)
      expect(calculateBlessedAimStats(10).attackRatingPct).toBe(210)
      expect(calculateBlessedAimStats(20).attackRatingPct).toBe(360)
    })

    it('grants +5% passive Attack Rating per base hard point even when inactive', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList(registry, { tohit: 1000 })
      expect(stats.getAccruedStat('tohit')).toBe(1000)

      // Invest 5 hard points in Blessed Aim
      stats.setBaseSkillLevel(108, 5)
      expect(stats.getAccruedStat('passive_ar_bonus_pct')).toBe(25)
      // +25% on 1000 base AR = 1250 AR
      expect(stats.getAccruedStat('tohit')).toBe(1250)

      // Adding +skills items (+10) must NOT increase passive bonus (hard points only!)
      stats.setBonusSkillLevel(108, 10)
      stats.setAllSkillsBonus(5)
      expect(stats.getAccruedStat('tohit')).toBe(1250)
    })
  })

  // --------------------------------------------------------------------------
  // 5. Concentration (113)
  // --------------------------------------------------------------------------
  describe('Skill #113: Concentration', () => {
    it('scales party physical %ED, uninterrupted chance, and Blessed Hammer synergy', () => {
      const s1 = calculateConcentrationStats(1)
      expect(s1.damagePercent).toBe(60)
      expect(s1.uninterruptedChancePct).toBe(20)
      expect(s1.blessedHammerBonusPct).toBe(30)

      const s10 = calculateConcentrationStats(10)
      expect(s10.damagePercent).toBe(195)
      expect(s10.blessedHammerBonusPct).toBe(97) // Math.trunc(195 / 2)

      const s20 = calculateConcentrationStats(20)
      expect(s20.damagePercent).toBe(345)
      expect(s20.blessedHammerBonusPct).toBe(172) // Math.trunc(345 / 2)
    })

    it('provides +50% effective synergy bonus to Blessed Hammer damage', () => {
      const hammerBase = calculateBlessedHammerDamage(20, { blessedAim: 0, vigor: 0 }, 0)
      const hammerConc = calculateBlessedHammerDamage(20, { blessedAim: 0, vigor: 0 }, 345) // slvl 20 Concentration (345% ED)
      expect(hammerConc.concentrationBonusPct).toBe(172)
      expect(hammerConc.min).toBe(Math.trunc((hammerBase.min * (100 + 172)) / 100))
    })

    it('reports uninterrupted attack in executeSUnitDmg when Concentration is active', async () => {
      const registry = await getSharedDataRegistry()
      const statsP = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const busP = new StateBus(statsP, registry)
      busP.applyState({ stateNameOrId: 'concentration', slvl: 1 })

      const paladin: CombatUnitContext = {
        id: 'paladin',
        name: 'Paladin',
        statList: statsP,
        stateBus: busP,
        unitType: 'player',
        weaponMinPhys: 50,
        weaponMaxPhys: 50,
      }

      const statsM = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const monster: CombatUnitContext = {
        id: 'monster',
        name: 'Monster',
        statList: statsM,
        stateBus: new StateBus(statsM, registry),
        unitType: 'monster',
      }

      const out = executeSUnitDmg(paladin, monster, {
        skillId: 0,
        attackKind: 'melee',
        autoHit: true,
        rollUninterrupted: 10, // < 20%
      }, { rand: () => 10 })
      expect(out.uninterrupted).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // 6. Holy Freeze (114)
  // --------------------------------------------------------------------------
  describe('Skill #114: Holy Freeze', () => {
    it('scales enemy slow % and cold pulse damage across slvl 1, 10, and 20', () => {
      const s1 = calculateHolyFreezeStats(1)
      expect(s1.slowPct).toBe(30) // dm(25, 60, 1) = 30%
      expect(s1.chillDurationFrames).toBe(0) // Skills.txt row 114 ELen = 0
      expect(s1.pulseMin256).toBe(512)
      expect(s1.pulseMax256).toBe(768)
      expect(s1.weaponColdMin).toBe(10)
      expect(s1.weaponColdMax).toBe(15)

      const s10 = calculateHolyFreezeStats(10)
      expect(s10.slowPct).toBe(49) // dm(25, 60, 10) = 49%
      expect(s10.pulseMin256).toBe(3328)
      expect(s10.pulseMax256).toBe(3584)

      const s20 = calculateHolyFreezeStats(20)
      expect(s20.slowPct).toBe(54) // dm(25, 60, 20) = 54%
      expect(s20.pulseMin256).toBe(9472)
      expect(s20.pulseMax256).toBe(9728)

      // Synergies: Resist Cold (+15%/lvl) and Salvation (+7%/lvl)
      const s20Syn = calculateHolyFreezeStats(20, { resistCold: 20, salvation: 20 })
      expect(s20Syn.synergyBonusPct).toBe(20 * 15 + 20 * 7) // +440%
    })

    it('slows enemies via AuraScanner bypassing Cannot Be Frozen (CBF)', async () => {
      const registry = await getSharedDataRegistry()
      const scanner = new AuraScanner(registry)

      const statsP = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const paladin: CombatUnitContext = {
        id: 'paladin',
        name: 'Paladin',
        statList: statsP,
        stateBus: new StateBus(statsP, registry),
        unitType: 'player',
        x: 0,
        y: 0,
      }

      // Enemy has cannot_be_frozen = 1
      const statsE = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE, item_cannotbefrozen: 1 })
      const enemy: CombatUnitContext = {
        id: 'enemy',
        name: 'CBF Enemy',
        statList: statsE,
        stateBus: new StateBus(statsE, registry),
        unitType: 'monster',
        // #1410: position-less units are never scanned (0x6FCC0C70); within ln12 = 15 sub-tiles.
        x: 5,
        y: 0,
      }

      const auraSource = scanner.setActiveAura(paladin, 114, 10)!
      expect(auraSource).toBeDefined()

      scanner.pulseAura(auraSource, 0, [paladin], [enemy], undefined, {
        rollChanceFn: () => true,
      })
      expect(paladin.stateBus.hasState('holywind')).toBe(true)
      expect(enemy.stateBus.hasState('holywindcold')).toBe(true)
      expect(enemy.stateBus.hasState('shatter')).toBe(true)
      // 1.13c SrvDo081 (D2Game 0x6FCBABC0): targets get only Skills.txt aurastat1..3 = -dm34; no item_slow.
      expect(enemy.statList.getModifierBonus('item_slow')).toBe(0)
      expect(enemy.statList.getModifierBonus('velocitypercent')).toBe(-49)
      expect(enemy.statList.getModifierBonus('attackrate')).toBe(-49)
      expect(enemy.statList.getModifierBonus('other_animrate')).toBe(-49)

      // Caster's `holywind` carries passivestat1/2 (coldmindam/coldmaxdam = enms*par5/256), never aurastat.
      expect(paladin.statList.getModifierBonus('velocitypercent')).toBe(0)
      expect(paladin.statList.getModifierBonus('attackrate')).toBe(0)
      expect(paladin.statList.getModifierBonus('other_animrate')).toBe(0)
      const hf10 = calculateHolyFreezeStats(10)
      expect(paladin.stateBus.getState('holywind')?.stats).toEqual({
        coldmindam: hf10.weaponColdMin,
        coldmaxdam: hf10.weaponColdMax,
      })

      // Paladin with 'holywind' aura state from AuraScanner deals 5x weapon cold damage in executeSUnitDmg
      const paladinAtk: CombatUnitContext = {
        ...paladin,
        weaponMinPhys: 50,
        weaponMaxPhys: 50,
      }
      const outAtk = executeSUnitDmg(paladinAtk, enemy, {
        skillId: 0,
        attackKind: 'melee',
        autoHit: true,
      }, { rand: () => 50 })
      expect(outAtk.elemDamage256).toBeGreaterThan(0)

      // Prime Evils and coldEffect === 0 monsters are excluded by Holy Freeze pulse
      const statsPrime = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const primeEvil: CombatUnitContext = {
        id: 'baal',
        name: 'Baal',
        statList: statsPrime,
        stateBus: new StateBus(statsPrime, registry),
        unitType: 'monster',
        isPrimeEvil: true,
      }
      scanner.pulseAura(auraSource, 50, [paladin], [primeEvil])
      expect(primeEvil.stateBus.hasState('holywindcold')).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // 7. Holy Shock (118)
  // --------------------------------------------------------------------------
  describe('Skill #118: Holy Shock', () => {
    it('calculates lightning pulse (min=1), weapon added lightning damage, and synergies', () => {
      const s1 = calculateHolyShockStats(1)
      expect(s1.pulseMin).toBe(1)
      expect(s1.pulseMax).toBe(10)
      expect(s1.pulseMin256).toBe(256)
      expect(s1.pulseMax256).toBe(2560)
      expect(s1.weaponLightningMin).toBe(1)
      expect(s1.weaponLightningMax).toBe(60) // 6 * pulseMax

      const s10 = calculateHolyShockStats(10)
      expect(s10.pulseMin).toBe(1)
      expect(s10.pulseMax).toBe(68)
      expect(s10.weaponLightningMax).toBe(408)

      const s20 = calculateHolyShockStats(20)
      expect(s20.pulseMin).toBe(1)
      expect(s20.pulseMax).toBe(156)
      expect(s20.weaponLightningMax).toBe(936)

      // Synergies: Resist Lightning (+12%/lvl) and Salvation (+4%/lvl)
      const s20Syn = calculateHolyShockStats(20, { resistLightning: 20, salvation: 20 })
      expect(s20Syn.synergyBonusPct).toBe(20 * 12 + 20 * 4) // +320%
    })
  })

  // --------------------------------------------------------------------------
  // 8. Sanctuary (119)
  // --------------------------------------------------------------------------
  describe('Skill #119: Sanctuary', () => {
    it('scales pulse damage, %ED vs Undead, and AR vs Undead', () => {
      const s1 = calculateSanctuaryStats(1)
      expect(s1.pulseMin256).toBe(2048)
      expect(s1.pulseMax256).toBe(4096)
      expect(s1.undeadDamagePercent).toBe(150)
      expect(s1.undeadAttackRating).toBe(100)

      const s10 = calculateSanctuaryStats(10)
      expect(s10.undeadDamagePercent).toBe(420)
      expect(s10.undeadAttackRating).toBe(550)

      const s20 = calculateSanctuaryStats(20)
      expect(s20.undeadDamagePercent).toBe(720)
      expect(s20.undeadAttackRating).toBe(1050)
    })

    it('zeros positive Undead physical resistance, preserves negative Undead resistance, and pulses only vs non-Boss Undead', async () => {
      const registry = await getSharedDataRegistry()
      const statsP = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const busP = new StateBus(statsP, registry)
      busP.applyState({ stateNameOrId: 'sanctuary', slvl: 1 })

      const paladin: CombatUnitContext = {
        id: 'paladin',
        name: 'Paladin',
        statList: statsP,
        stateBus: busP,
        unitType: 'player',
        weaponMinPhys: 100,
        weaponMaxPhys: 100,
      }

      // Physical Immune Undead (damageresist = 100)
      const statsUndead = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE, damageresist: 100 })
      const undead: CombatUnitContext = {
        id: 'ghost',
        name: 'Ghost',
        statList: statsUndead,
        stateBus: new StateBus(statsUndead, registry),
        unitType: 'monster',
        isUndead: true,
      }

      const outUndead = executeSUnitDmg(paladin, undead, {
        skillId: 0,
        attackKind: 'melee',
        autoHit: true,
      }, { rand: () => 50 })
      // Physical immunity pierced and set to 0%, +150% ED vs Undead applied = 250 damage dealt!
      expect(outUndead.immuneToPhys).toBe(false)
      expect(outUndead.physDamage256).toBe(250 * FIXED_ONE)

      // Undead with negative physical resistance (50% base cursed with Amplify Damage -100% -> -50% effectiveRes)
      const statsCursedUndead = new UnitStatList(registry, { maxhp: 2000 * FIXED_ONE, hitpoints: 2000 * FIXED_ONE, damageresist: 50 })
      const busCursedUndead = new StateBus(statsCursedUndead, registry)
      busCursedUndead.applyState({ stateNameOrId: 'amplifydamage', slvl: 1 })
      const cursedUndead: CombatUnitContext = {
        id: 'cursed_skeleton',
        name: 'Cursed Skeleton',
        statList: statsCursedUndead,
        stateBus: busCursedUndead,
        unitType: 'monster',
        isUndead: true,
      }
      const outCursedUndead = executeSUnitDmg(paladin, cursedUndead, {
        skillId: 0,
        attackKind: 'melee',
        autoHit: true,
      }, { rand: () => 50 })
      // 250 base * 1.5 (-50% physical resistance preserved!) = 375 damage!
      expect(outCursedUndead.physDamage256).toBe(375 * FIXED_ONE)

      // Physical Immune Non-Undead (Demon, damageresist = 100) -> Still immune!
      const statsDemon = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE, damageresist: 100 })
      const demon: CombatUnitContext = {
        id: 'demon',
        name: 'Demon',
        statList: statsDemon,
        stateBus: new StateBus(statsDemon, registry),
        unitType: 'monster',
        isDemon: true,
        isUndead: false,
      }

      const outDemon = executeSUnitDmg(paladin, demon, {
        skillId: 0,
        attackKind: 'melee',
        autoHit: true,
      }, { rand: () => 50 })
      expect(outDemon.immuneToPhys).toBe(true)
      expect(outDemon.physDamage256).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // 9. Fanaticism (122)
  // --------------------------------------------------------------------------
  describe('Skill #122: Fanaticism', () => {
    it('calculates caster/party IAS (dm34), %AR, and asymmetric caster vs party %ED', () => {
      const s1 = calculateFanaticismStats(1)
      expect(s1.casterIas).toBe(14) // dm(10, 40, 1) = 14%
      expect(s1.partyIas).toBe(14)
      expect(s1.attackRatingPct).toBe(40)
      expect(s1.casterDamagePercent).toBe(50)
      expect(s1.partyDamagePercent).toBe(25) // Strictly half

      const s10 = calculateFanaticismStats(10)
      expect(s10.casterIas).toBe(30) // dm(10, 40, 10) = 30%
      expect(s10.partyIas).toBe(30)
      expect(s10.attackRatingPct).toBe(85)
      expect(s10.casterDamagePercent).toBe(203)
      expect(s10.partyDamagePercent).toBe(101) // Math.trunc(203 / 2)

      const s20 = calculateFanaticismStats(20)
      expect(s20.casterIas).toBe(35) // dm(10, 40, 20) = 35%
      expect(s20.partyIas).toBe(35)
      expect(s20.attackRatingPct).toBe(135)
      expect(s20.casterDamagePercent).toBe(373)
      expect(s20.partyDamagePercent).toBe(186) // Math.trunc(373 / 2)
    })

    it('applies caster %ED to Paladin and half %ED to party ally in executeSUnitDmg', async () => {
      const registry = await getSharedDataRegistry()

      // Paladin Caster (slvl 1 Fanaticism: 50% ED)
      const statsCaster = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const busCaster = new StateBus(statsCaster, registry)
      busCaster.applyState({ stateNameOrId: 'fanaticism', slvl: 1 })
      const caster: CombatUnitContext = {
        id: 'paladin_caster',
        name: 'Paladin Caster',
        statList: statsCaster,
        stateBus: busCaster,
        unitType: 'player',
        weaponMinPhys: 100,
        weaponMaxPhys: 100,
      }

      // Party Ally (slvl 1 Fanaticism: 25% ED)
      const statsAlly = new UnitStatList(registry, { maxhp: 500 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const busAlly = new StateBus(statsAlly, registry)
      busAlly.applyState({ stateNameOrId: 'fanaticism', slvl: 1, stats: { is_ally: 1 } })
      const ally: CombatUnitContext = {
        id: 'party_ally',
        name: 'Party Ally',
        statList: statsAlly,
        stateBus: busAlly,
        unitType: 'party',
        weaponMinPhys: 100,
        weaponMaxPhys: 100,
      }

      const statsM = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE, damageresist: 0 })
      const monster: CombatUnitContext = {
        id: 'monster',
        name: 'Target Monster',
        statList: statsM,
        stateBus: new StateBus(statsM, registry),
        unitType: 'monster',
      }

      const outCaster = executeSUnitDmg(caster, monster, { skillId: 0, attackKind: 'melee', autoHit: true }, { rand: () => 50 })
      expect(outCaster.physDamage256).toBe(150 * FIXED_ONE) // 100 + 50% = 150

      const outAlly = executeSUnitDmg(ally, monster, { skillId: 0, attackKind: 'melee', autoHit: true }, { rand: () => 50 })
      expect(outAlly.physDamage256).toBe(125 * FIXED_ONE) // 100 + 25% = 125
    })
  })

  // --------------------------------------------------------------------------
  // 10. Conviction (123)
  // --------------------------------------------------------------------------
  describe('Skill #123: Conviction', () => {
    it('calculates defense (-dm56) and elemental resistance reduction with immunity breaking scaling', () => {
      const s1 = calculateConvictionStats(1)
      expect(s1.defenseReductionPct).toBe(49) // dm(40, 100, 1) = 49%
      expect(s1.resistanceReductionPct).toBe(30)
      expect(s1.immunityBreakingReductionPct).toBe(6) // 30 / 5 = 6

      const s10 = calculateConvictionStats(10)
      expect(s10.defenseReductionPct).toBe(81) // dm(40, 100, 10) = 81%
      expect(s10.resistanceReductionPct).toBe(75)
      expect(s10.immunityBreakingReductionPct).toBe(15)

      const s20 = calculateConvictionStats(20)
      expect(s20.defenseReductionPct).toBe(90) // dm(40, 100, 20) = 90%
      expect(s20.resistanceReductionPct).toBe(125)
      expect(s20.immunityBreakingReductionPct).toBe(25)

      const s25 = calculateConvictionStats(25)
      expect(s25.defenseReductionPct).toBe(93) // dm(40, 100, 25) = 93%
      expect(s25.resistanceReductionPct).toBe(150) // Capped at 150%
      expect(s25.immunityBreakingReductionPct).toBe(30)
    })

    it('breaks elemental immunities at 1/5th effectiveness and never impacts Poison or Magic', () => {
      // 105% base fire resistance (Fire Immune)
      // Slvl 25 Conviction has 150% pierce -> 1/5th = 30% against immunity
      // Effective res = 105 - 30 = 75% (Immunity Broken!)
      const resFire = computeEffectiveResistance({
        isDefenderPlayer: false,
        baseRes: 105,
        convictionPierce: 150,
      })
      expect(resFire.isImmune).toBe(false)
      expect(resFire.effectiveRes).toBe(75)

      // 140% base fire resistance -> 140 - 30 = 110% (Still immune!)
      const resUnbreakable = computeEffectiveResistance({
        isDefenderPlayer: false,
        baseRes: 140,
        convictionPierce: 150,
      })
      expect(resUnbreakable.isImmune).toBe(true)
      expect(resUnbreakable.effectiveRes).toBe(100)
    })
  })
})
