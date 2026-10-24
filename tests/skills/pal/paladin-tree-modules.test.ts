/**
 * Comprehensive Unit Test Suite for Paladin Skill Tree Modules:
 * - src/server/skills/paladin-combat.ts
 * - src/server/skills/paladin-offensive-auras.ts
 * - src/server/skills/paladin-defensive-auras.ts
 *
 * Verifies that all 30 Paladin skill calculators and interfaces are correctly exposed,
 * maintain exact 1.13c ground truth parity, and adhere to strict parity rules.
 */

import { describe, expect, it } from 'vitest'
import {
  calculateSacrificeStats,
  calculateSmiteStats,
  calculateHolyBoltDamage,
  calculateHolyBoltHeal,
  calculateZealStats,
  calculateChargeStats,
  calculateVengeanceStats,
  calculateBlessedHammerDamage,
  calculateConversionStats,
  calculateHolyShieldStats,
  calculateFistOfTheHeavensDamage,
  calculateFistOfTheHeavensHolyBoltDamage,
} from '../../../src/server/skills/paladin-combat.ts'
import {
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
} from '../../../src/server/skills/paladin-offensive-auras.ts'
import {
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
} from '../../../src/server/skills/paladin-defensive-auras.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import { HudModel } from '../../../src/client/ui-model/hud-model.ts'
import { HudManager } from '../../../src/client/ui/hud-manager.ts'
import { STATE_COLOR_SHIFTS } from '../../../src/client/view/unit-drawables.ts'

describe('Paladin Skill Tree Modules — 1.13c Parity & Interface Contracts', () => {
  describe('paladin-combat.ts (10 Combat Skills)', () => {
    it('Sacrifice (#96): calculates %ED, AR, self-damage (strictly 8%) and synergies', () => {
      const s1 = calculateSacrificeStats(1)
      expect(s1.toHitBonusPct).toBe(20)
      expect(s1.damagePct).toBe(180)
      expect(s1.selfDamagePct).toBe(8)

      const s20 = calculateSacrificeStats(20, { redemption: 20, fanaticism: 20 })
      expect(s20.toHitBonusPct).toBe(20 + 19 * 7) // 153%
      expect(s20.damagePct).toBe(180 + 19 * 15 + 20 * 15 + 20 * 5) // 465 + 300 + 100 = 865%
      expect(s20.selfDamagePct).toBe(8)
    })

    it('Smite (#97): calculates shield damage, Holy Shield bonus, and stun scaling', () => {
      const s1 = calculateSmiteStats(1, 2, 5, { min: 3, max: 6 })
      expect(s1.damagePct).toBe(15)
      expect(s1.stunDurationFrames).toBe(15)
      expect(s1.minDamage).toBe(5)
      expect(s1.maxDamage).toBe(11)

      const s20 = calculateSmiteStats(20, 10, 20, { min: 57, max: 60 })
      expect(s20.damagePct).toBe(300)
      expect(s20.stunDurationFrames).toBe(110)
      expect(s20.minDamage).toBe(67)
      expect(s20.maxDamage).toBe(80)
    })

    it('Holy Bolt (#101): calculates undead magic damage and ally heal with synergies', () => {
      const dmg = calculateHolyBoltDamage(10, { blessedHammer: 10, fistOfTheHeavens: 5 })
      expect(dmg.min).toBeGreaterThan(0)
      expect(dmg.max).toBeGreaterThan(dmg.min)

      const heal = calculateHolyBoltHeal(10, 10)
      expect(heal.min).toBeGreaterThan(0)
      expect(heal.max).toBeGreaterThan(heal.min)
    })

    it('Zeal (#106): multi-hit progression clamps between 2 and 5 hits', () => {
      expect(calculateZealStats(1).hits).toBe(2)
      expect(calculateZealStats(2).hits).toBe(3)
      expect(calculateZealStats(3).hits).toBe(4)
      expect(calculateZealStats(4).hits).toBe(5)
      expect(calculateZealStats(20).hits).toBe(5)
    })

    it('Charge (#107): calculates %ED, AR, synergies, and 300% movement speed multiplier', () => {
      const c = calculateChargeStats(10, { vigor: 10, might: 10 })
      expect(c.speedMultiplier).toBe(3.0)
      expect(c.damagePct).toBe(100 + 9 * 25 + 20 * 20)
    })

    it('Vengeance (#111): calculates Fire, Cold, Lightning elemental percentages and chill duration', () => {
      const v = calculateVengeanceStats(10, { resistFire: 10, resistCold: 10, resistLightning: 10, salvation: 10 })
      expect(v.firePct).toBe(70 + 9 * 6 + 10 * 10 + 10 * 2)
      expect(v.coldPct).toBe(v.firePct)
      expect(v.ltngPct).toBe(v.firePct)
      expect(v.chillDurationFrames).toBe(30 + 9 * 15)
    })

    it('Blessed Hammer (#112): calculates magic damage, synergies, and Concentration 50% bonus', () => {
      const bh = calculateBlessedHammerDamage(20, { blessedAim: 20, vigor: 20 }, 300)
      expect(bh.concentrationBonusPct).toBe(150)
      expect(bh.min).toBeGreaterThan(1000)
      expect(bh.max).toBeGreaterThan(bh.min)
    })

    it('Conversion (#116): calculates dm34 conversion chance and 16s duration', () => {
      const conv = calculateConversionStats(10)
      expect(conv.durationSeconds).toBe(16)
      expect(conv.durationFrames).toBe(400)
      expect(conv.chancePct).toBe(34)
    })

    it('Holy Shield (#117): calculates duration, defense %, block %, and flat Smite bonus', () => {
      const hs = calculateHolyShieldStats(20, 20)
      expect(hs.durationFrames).toBe(750 + 19 * 625)
      expect(hs.defensePct).toBe(25 + 19 * 15 + 20 * 15)
      expect(hs.blockChancePct).toBe(35) // 1.13c dm56: 10 + Math.floor(66000 / 2600) = 35%
      expect(hs.smiteMinFlat).toBeGreaterThan(0)
      expect(hs.smiteMaxFlat).toBeGreaterThan(hs.smiteMinFlat)
    })

    it('Fist of the Heavens (#121): calculates primary celestial lightning and radial holy bolts', () => {
      const foh = calculateFistOfTheHeavensDamage(20, { holyShock: 20 })
      expect(foh.lightningMin).toBeGreaterThan(500)
      expect(foh.lightningMax).toBeGreaterThan(foh.lightningMin)

      const hb = calculateFistOfTheHeavensHolyBoltDamage(20, 20)
      expect(hb.holyBoltMin).toBeGreaterThan(100)
      expect(hb.holyBoltMax).toBeGreaterThan(hb.holyBoltMin)
    })
  })

  describe('paladin-offensive-auras.ts (10 Offensive Auras)', () => {
    it('Might (#98): calculates party %ED and radius scaling', () => {
      const m1 = calculateMightStats(1)
      expect(m1.damagePercent).toBe(40)
      const m10 = calculateMightStats(10)
      expect(m10.damagePercent).toBe(130)
    })

    it('Holy Fire (#102): calculates radial pulse and weapon fire damage with synergies', () => {
      const hf = calculateHolyFireStats(20, { resistFire: 20, salvation: 20 })
      expect(hf.synergyBonusPct).toBe(20 * 18 + 20 * 6)
      expect(hf.weaponFireMin).toBeGreaterThan(0)
      expect(hf.weaponFireMax).toBeGreaterThan(hf.weaponFireMin)
    })

    it('Thorns (#103): calculates physical melee reflection percentage', () => {
      expect(calculateThornsStats(1).reflectPct).toBe(250)
      expect(calculateThornsStats(10).reflectPct).toBe(250 + 9 * 40)
    })

    it('Blessed Aim (#108): calculates active AR and passive AR (+5%/blvl)', () => {
      const ba = calculateBlessedAimStats(10, 20)
      expect(ba.attackRatingPct).toBe(75 + 9 * 15)
      expect(ba.passiveArBonusPct).toBe(100) // 20 * 5%
    })

    it('Concentration (#113): calculates party %ED, 20% uninterruptible chance, and +50% Blessed Hammer synergy', () => {
      const c = calculateConcentrationStats(20)
      expect(c.damagePercent).toBe(60 + 19 * 15) // 345%
      expect(c.uninterruptedChancePct).toBe(20)
      expect(c.blessedHammerBonusPct).toBe(Math.trunc(345 / 2)) // 172%
    })

    it('Holy Freeze (#114): calculates slow % (capped at 54%), cold pulse, and weapon cold damage', () => {
      const hf = calculateHolyFreezeStats(20, { resistCold: 20, salvation: 20 })
      expect(hf.slowPct).toBeLessThanOrEqual(54)
      expect(hf.weaponColdMin).toBeGreaterThan(0)
      expect(hf.weaponColdMax).toBeGreaterThan(hf.weaponColdMin)
    })

    it('Holy Shock (#118): min damage is strictly 1, max scales with synergies', () => {
      const hsBase = calculateHolyShockStats(20)
      expect(hsBase.pulseMin).toBe(1)
      expect(hsBase.weaponLightningMin).toBe(1)
      expect(hsBase.weaponLightningMax).toBe(936)

      const hs = calculateHolyShockStats(20, { resistLightning: 20, salvation: 20 })
      expect(hs.weaponLightningMin).toBe(1)
      expect(hs.synergyBonusPct).toBe(320)
      expect(hs.weaponLightningMax).toBeGreaterThan(1000)
    })

    it('Sanctuary (#119): calculates undead %ED, AR, and magic pulse with Cleansing synergy', () => {
      const s = calculateSanctuaryStats(10, { cleansing: 10 })
      expect(s.undeadDamagePercent).toBe(150 + 9 * 30)
      expect(s.undeadAttackRating).toBe(100 + 9 * 50)
      expect(s.synergyBonusPct).toBe(70)
    })

    it('Fanaticism (#122): party %ED is strictly half of caster %ED', () => {
      const f1 = calculateFanaticismStats(1)
      expect(f1.casterDamagePercent).toBe(50)
      expect(f1.partyDamagePercent).toBe(25) // exactly half

      const f20 = calculateFanaticismStats(20)
      expect(f20.casterDamagePercent).toBe(50 + 19 * 17) // 373%
      expect(f20.partyDamagePercent).toBe(Math.trunc(373 / 2)) // 186%
    })

    it('Conviction (#123): capped at -150% res reduction, 1/5th immunity breaking', () => {
      const c1 = calculateConvictionStats(1)
      expect(c1.defenseReductionPct).toBe(49) // dm(40, 100, 1) = 49%
      expect(c1.resistanceReductionPct).toBe(30)
      expect(c1.immunityBreakingReductionPct).toBe(6)

      const c20 = calculateConvictionStats(20)
      expect(c20.defenseReductionPct).toBe(90) // dm(40, 100, 20) = 90%
      expect(c20.resistanceReductionPct).toBe(125)
      expect(c20.immunityBreakingReductionPct).toBe(25)

      const c30 = calculateConvictionStats(30)
      expect(c30.resistanceReductionPct).toBe(150) // capped at -150%
      expect(c30.immunityBreakingReductionPct).toBe(30)
    })
  })

  describe('paladin-defensive-auras.ts (10 Defensive Auras)', () => {
    it('Prayer (#99): periodic heal pulse and 1.13c pulse mana scaling', () => {
      const p1 = calculatePrayerStats(1)
      expect(p1.healAmount).toBe(2)
      expect(p1.manaCostPerFrame256).toBe(16)
      expect(p1.manaCostPerPulse256).toBe(256) // 1.0 mana per pulse at slvl 1

      const p20 = calculatePrayerStats(20)
      expect(p20.healAmount).toBe(25)
      expect(p20.manaCostPerFrame256).toBe(16)
      expect(p20.manaCostPerPulse256).toBe((16 + 3 * 19) << 4) // 1168 (4.5625 mana per pulse at slvl 20)
    })

    it('Resist Fire (#100): active fire res, active +1% max res/blvl, and passive +1% max res per 2 hard points', () => {
      const rf = calculateResistFireStats(10, 20)
      expect(rf.passiveMaxFireResistPct).toBe(10) // 20 / 2 = +10% passive
      expect(rf.maxFireResistBonusPct).toBe(20) // +20% when active (1% per hard point)
    })

    it('Defiance (#104): active party defense % scaling', () => {
      expect(calculateDefianceStats(1).defensePercent).toBe(70)
      expect(calculateDefianceStats(20).defensePercent).toBe(70 + 19 * 10)
    })

    it('Resist Cold (#105): active cold res, active +1% max res/blvl, and passive +1% max res per 2 hard points', () => {
      const rc = calculateResistColdStats(10, 14)
      expect(rc.passiveMaxColdResistPct).toBe(7)
      expect(rc.maxColdResistBonusPct).toBe(14)
    })

    it('Cleansing (#109): curse/poison length reduction and free Prayer heal synergy', () => {
      const c = calculateCleansingStats(10, 10)
      expect(c.curseReductionPct).toBeGreaterThan(0)
      expect(c.poisonLengthReductionPct).toBe(c.curseReductionPct)
      expect(c.prayerHealAmount).toBe(11) // Prayer slvl 10 heal amount
    })

    it('Resist Lightning (#110): active lightning res, active +1% max res/blvl, and passive +1% max res per 2 hard points', () => {
      const rl = calculateResistLightningStats(10, 18)
      expect(rl.passiveMaxLightningResistPct).toBe(9)
      expect(rl.maxLightningResistBonusPct).toBe(18)
    })

    it('Vigor (#115): FRW velocity %, stamina recovery %, max stamina %', () => {
      const v = calculateVigorStats(10)
      expect(v.velocityPercent).toBe(36)
      expect(v.staminaRecoveryBonusPct).toBe(50 + 9 * 25)
      expect(v.maxStaminaPercent).toBe(50 + 9 * 25)
    })

    it('Meditation (#120): active mana recovery % and free Prayer heal synergy', () => {
      const m = calculateMeditationStats(10, 10)
      expect(m.manaRecoveryBonusPct).toBe(300 + 9 * 25)
      expect(m.prayerHealAmount).toBe(11) // Prayer slvl 10 heal amount
    })

    it('Redemption (#124): 50-tick cadence, fixed 16 subtiles radius, dm34 chance, life/mana restore', () => {
      const r = calculateRedemptionStats(10)
      expect(r.radiusSubtiles).toBe(16)
      expect(r.lifeRecoverPts).toBe(70)
      expect(r.manaRecoverPts).toBe(70)
      expect(r.redemptionChancePct).toBe(71)
    })

    it('Salvation (#125): party All Res (Fire, Cold, Lightning) with identical values', () => {
      const s = calculateSalvationStats(10)
      expect(s.fireResistPct).toBe(98)
      expect(s.coldResistPct).toBe(98)
      expect(s.lightningResistPct).toBe(98)
    })
  })

  describe('Layer 4: ClientWorld, HudModel & UnitDrawables Paladin Aura & Combat Parity (#982, #992)', () => {
    it('HudModel & StatOpEngine: Defiance (state 37), Holy Shield Defiance synergy, Salvation (state 8), Resist Fire/Cold/Lightning (states 3/4/5), Vigor (state 41), and Blessed Hammer Concentration', () => {
      const world = new ClientWorld()
      world.selfId = 1
      ;(world.self as any).charClass = 3 // Paladin ('pal')
      ;(world.self as any).level = 30
      ;(world.self as any).stats.set(31, 100) // Base ArmorClass = 100
      ;(world.self as any).stats.set(11, 100 * 256) // Base MaxStamina = 100 (fixed-point 256ths)
      ;(world.self as any).leftSkill = 112 // Blessed Hammer
      ;(world.self as any).skillEntries.set(104, { skillId: 104, level: 10, baseLevel: 10, bonus: 0 }) // Defiance
      ;(world.self as any).skillEntries.set(117, { skillId: 117, level: 10, baseLevel: 10, bonus: 0 }) // Holy Shield
      ;(world.self as any).skillEntries.set(125, { skillId: 125, level: 10, baseLevel: 10, bonus: 0 }) // Salvation
      ;(world.self as any).skillEntries.set(100, { skillId: 100, level: 10, baseLevel: 10, bonus: 0 }) // Resist Fire
      ;(world.self as any).skillEntries.set(115, { skillId: 115, level: 10, baseLevel: 10, bonus: 0 }) // Vigor
      ;(world.self as any).skillEntries.set(112, { skillId: 112, level: 20, baseLevel: 20, bonus: 0 }) // Blessed Hammer
      ;(world.self as any).skillEntries.set(113, { skillId: 113, level: 20, baseLevel: 20, bonus: 0 }) // Concentration
      world.containers.applyItemEvent(
        6,
        {
          id: 901,
          itemId: 901,
          opcode: 0x9d,
          action: 6,
          category: 1,
          flags: 0x10,
          rawFlags: 0x10,
          version: 100,
          location: 1,
          container: 'equipped',
          bodyLoc: 5,
          equippedSlot: 5,
          gridX: 0,
          gridY: 0,
          storePage: 0,
          storagePage: 0,
          worldX: 0,
          worldY: 0,
          x: 0,
          y: 0,
          code: 'buc',
          rawCode: 'buc ',
          compact: false,
          simple: false,
          identified: true,
          socketed: false,
          ethereal: false,
          runeword: false,
          personalized: false,
          isEar: false,
          newItem: false,
          starterItem: false,
          broken: false,
          inSocket: false,
          equipped: true,
          socketedChildCount: 0,
          usedSockets: 0,
          totalSockets: 0,
          quality: 2,
          defense: 6,
          durability: 12,
          maxDurability: 12,
          invWidth: 2,
          invHeight: 2,
          stats: [],
          runewordStats: [],
          setBonusStats: [],
        } as any,
        'equipment',
      )

      const selfStates = world.self.states as Set<number>
      const hud = new HudManager()
      const model = new HudModel({ world, hudManager: hud })
      model.syncFromWorld()
      const baseDef = hud.charSheet.attrs.defense
      const baseMaxStam = hud.charSheet.attrs.maxStamina ?? 0
      const bhWithoutConc = hud.charSheet.attrs.leftSkillDmg
      // Passive Resist Fire (10 hard points) grants +5% maxFireRes when inactive
      expect(hud.charSheet.attrs.maxFireRes).toBe(80)

      // Activate Resist Fire (state 3) -> +10% maxFireRes (not +15%)
      selfStates.add(3)
      model.syncFromWorld()
      expect(hud.charSheet.attrs.maxFireRes).toBe(85)
      expect(hud.charSheet.attrs.fireRes).toBe(85)
      selfStates.delete(3)

      // Activate Salvation (state 8) -> +98% all elemental resist
      selfStates.add(8)
      model.syncFromWorld()
      expect(hud.charSheet.attrs.fireRes).toBe(80)
      expect(hud.charSheet.attrs.coldRes).toBe(75)
      expect(hud.charSheet.attrs.lightRes).toBe(75)
      selfStates.delete(8)

      // Activate Defiance (state 37) + Holy Shield (state 101) with 10 hard Defiance synergy
      selfStates.add(37)
      selfStates.add(101)
      model.syncFromWorld()
      expect(hud.charSheet.attrs.defense).toBeGreaterThan(baseDef * 4)
      selfStates.delete(37)
      selfStates.delete(101)

      // Activate Vigor (state 41) -> boosts maxStamina
      selfStates.add(41)
      model.syncFromWorld()
      expect(hud.charSheet.attrs.maxStamina).toBeGreaterThan(baseMaxStam)
      selfStates.delete(41)

      // Blessed Hammer (#112) with active Concentration (state 42)
      selfStates.add(42)
      model.syncFromWorld()
      expect(hud.charSheet.attrs.leftSkillDmgColor).toBe('blue')
      expect(hud.charSheet.attrs.leftSkillDmg).not.toBe(bhWithoutConc)
    })

    it('ClientWorld: SelectSkill right-hand aura sync, Sanctuary (#119) sanctuarybolt gleam, Redemption (#124) corpse state 99, and Holy Freeze state 44 color shift', () => {
      expect(STATE_COLOR_SHIFTS[44]).toEqual({
        stateId: 44,
        priority: 100,
        tintColor: [150, 215, 255],
        paletteRow: 1,
      })

      const world = new ClientWorld()
      world.selfId = 1
      world.areaId = 2 // Blood Moor (wilderness)
      const playerUnit = (world as any).ensureUnit('player', 1)
      playerUnit.x = 100
      playerUnit.y = 100

      // Selecting Sanctuary (#119) on right hand sets state 47
      world.noteOutgoingCommand({ type: 'SelectSkill', hand: 'right', skill: 119 } as any)
      expect(world.self.states.has(47)).toBe(true)
      expect(playerUnit.states.has(47)).toBe(true)

      // Spawn an undead monster nearby and step to tick 50 -> spawns 'sanctuarybolt' (perdelay=50, Range=14)
      const zombie = (world as any).ensureUnit('monster', 501)
      zombie.classId = 1 // Zombie
      zombie.x = 104
      zombie.y = 100
      zombie.mode = 1
      zombie.lifePct = 128
      ;(world as any)._monsters.set(501, zombie)
      world.frameCount = 49
      ;(world as any).stepDiscreteSimulationTick(40, 1000)
      const sancBolt = Array.from(world.units.values()).find(
        u => u.unitType === 'missile' && u.missileKey === 'sanctuarybolt',
      )
      expect(sancBolt).toBeDefined()
      expect(sancBolt?.maxTicks).toBe(14)

      // Switching right-hand skill to Blessed Hammer (#112) clears state 47
      world.noteOutgoingCommand({ type: 'SelectSkill', hand: 'right', skill: 112 } as any)
      expect(world.self.states.has(47)).toBe(false)
      expect(playerUnit.states.has(47)).toBe(false)

      // StateSet with state 99 (STATE_REDEEMED) on monster hides corpse and spawns 'redemption' missile (#173 RedemptionGhost)
      world.applyEvent({
        type: 'StateSet',
        unit: { unitType: 'monster', id: 501 },
        state: 99,
      } as any)
      expect((zombie as any).hidden).toBe(true)
      expect((zombie as any).redeemed).toBe(true)
      expect(zombie.overlays.some((o: any) => o.token === 'redemption')).toBe(false)
      const redemptionMissile = Array.from(world.units.values()).find(
        u => u.unitType === 'missile' && u.missileKey === 'redemption',
      )
      expect(redemptionMissile).toBeDefined()
      expect(redemptionMissile?.maxTicks).toBe(18)
    })

    it('ClientWorld & HudModel: Paladin Combat Skills (#96-#121) Character Sheet AR/Damage and Client Overlays (#992)', () => {
      const world = new ClientWorld()
      world.selfId = 1
      world.areaId = 2
      ;(world.self as any).charClass = 3 // Paladin ('pal')
      ;(world.self as any).level = 30
      ;(world.self as any).stats.set(0, 100) // Str 100
      ;(world.self as any).stats.set(2, 100) // Dex 100
      ;(world.self as any).stats.set(19, 500) // Base AR 500
      ;(world.self as any).skillEntries.set(96, { skillId: 96, level: 10, baseLevel: 10, bonus: 0 }) // Sacrifice
      ;(world.self as any).skillEntries.set(97, { skillId: 97, level: 10, baseLevel: 10, bonus: 0 }) // Smite
      ;(world.self as any).skillEntries.set(106, { skillId: 106, level: 10, baseLevel: 10, bonus: 0 }) // Zeal
      ;(world.self as any).skillEntries.set(107, { skillId: 107, level: 10, baseLevel: 10, bonus: 0 }) // Charge
      ;(world.self as any).skillEntries.set(111, { skillId: 111, level: 10, baseLevel: 10, bonus: 0 }) // Vengeance
      ;(world.self as any).skillEntries.set(116, { skillId: 116, level: 10, baseLevel: 10, bonus: 0 }) // Conversion
      ;(world.self as any).skillEntries.set(117, { skillId: 117, level: 10, baseLevel: 10, bonus: 0 }) // Holy Shield

      const hud = new HudManager()
      const model = new HudModel({ world, hudManager: hud })

      // Normal Attack baseline
      ;(world.self as any).leftSkill = 0
      model.syncFromWorld()
      const normalAr = hud.charSheet.attrs.leftAR ?? 0
      const normalDmg = hud.charSheet.attrs.leftSkillDmg

      // Zeal (#106) at slvl 10 (+100% AR, +42% ED + 120% Sacrifice synergy)
      ;(world.self as any).leftSkill = 106
      model.syncFromWorld()
      expect(hud.charSheet.attrs.leftAR).toBeGreaterThan(normalAr)
      expect(hud.charSheet.attrs.leftSkillDmg).not.toBe(normalDmg)

      // Conversion (#116) onClientSkillEffects does NOT unconditionally mark nearby monsters with state 53
      const playerUnit = (world as any).ensureUnit('player', 1)
      playerUnit.x = 100
      playerUnit.y = 100
      const monster = (world as any).ensureUnit('monster', 601)
      monster.classId = 1
      monster.x = 101
      monster.y = 100
      monster.mode = 1
      monster.lifePct = 128
      ;(world as any)._monsters.set(601, monster)

      ;(world as any).spawnMissilesForSkill(playerUnit, 116, 101, 100, 10)
      expect(monster.states.has(53)).toBe(false)

      // When monster has state 53 (converted), client cast of #116 adds no duplicate overlay (STATE_OVERLAYS[53] -> conversionaura)
      monster.states.add(53)
      ;(world as any).spawnMissilesForSkill(playerUnit, 116, 101, 100, 10)
      expect(monster.overlays).toHaveLength(0)

      // Sacrifice (#96) attaches no invented sacrifice_* overlays and spawns a blood missile (classId 18..20) at target
      monster.states.clear()
      ;(world as any).spawnMissilesForSkill(playerUnit, 96, 101, 100, 10)
      expect(playerUnit.overlays).toHaveLength(0)
      expect(monster.overlays).toHaveLength(0)
      const bloodMissiles = Array.from(world.units.values()).filter((u) => u.unitType === 'missile')
      expect(bloodMissiles).toHaveLength(1)
      expect(bloodMissiles[0]!.classId).toBeGreaterThanOrEqual(18)
      expect(bloodMissiles[0]!.classId).toBeLessThanOrEqual(20)

      // Smite (#97) client cast attaches no overlays and adds no client stun state
      monster.states.clear()
      ;(world as any).spawnMissilesForSkill(playerUnit, 97, 101, 100, 10)
      expect(monster.states.has(21)).toBe(false)
      expect(monster.overlays).toHaveLength(0)

      // Vengeance (#111) client cast attaches no overlays
      ;(world as any).spawnMissilesForSkill(playerUnit, 111, 101, 100, 10)
      expect(monster.overlays).toHaveLength(0)

      // Charge (#107) attaches no tgtoverlay/castoverlay/srvoverlay in 1.13c (Issue #1167)
      ;(world as any).spawnMissilesForSkill(playerUnit, 107, 101, 100, 10)
      expect(monster.overlays.some((o: any) => o.token === 'charge')).toBe(false)
    })
  })
})
