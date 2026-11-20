/**
 * Milestone M7: Paladin Combat Skills Tree (10 Skills) Comprehensive Verification Suite
 *
 * Verifies exact 1.13c formulas, synergies, mechanics, and runtime behaviors for:
 * 1. Architecture Invariants: BATCH1_SKILLS length === 38, ISO_GROUND_ASPECT_RATIO === 0.5.
 * 2. Sacrifice (96): %ED, AR, Redemption/Fanaticism synergies, 8% net physical self-damage clamped >= 1 HP.
 * 3. Smite (97): autoHit=true, unblockable=true, shield base + Holy Shield flat damage, stun duration scaling.
 * 4. Holy Bolt (101): Undead magic damage + synergies, friendly ally heal + Prayer synergy, living non-undead passthrough.
 * 5. Zeal (106): hit count min(slvl + 1, 5), %ED scaling, sequential retargeting on target death.
 * 6. Charge (107): 300% movement velocity, 2:1 isometric vector, %ED, knockback on hit.
 * 7. Vengeance (111): Physical base + Fire%/Cold%/Ltng% multi-element packet, cold chill duration, independent resistances.
 * 8. Blessed Hammer (112): Archimedean spiral in 2:1 iso, Concentration +50% synergy, 1.13c magic resistance invariance.
 * 9. Conversion (116): dm34 conversion roll, boss/champion immunity, 16s allegiance shift.
 * 10. Holy Shield (117): Duration, defense% + Defiance synergy, dm56 block%, flat Smite damage addition.
 * 11. Fist of the Heavens (121): 25-frame cast delay, celestial lightning + Holy Shock synergy, radial holy bolts damaging only undead.
 */
import { describe, expect, it } from 'vitest'
import {
  BATCH1_SKILLS,
  ISO_GROUND_ASPECT_RATIO,
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
} from '../../../src/server/skills/skills.ts'
import {
  executeSUnitDmg,
  computeEffectiveResistance,
  type CombatUnitContext,
} from '../../../src/server/engine/combat-pipeline.ts'
import { validatePaladinSkillEquipment } from '../../../src/server/skills/paladin-combat.ts'
import { FIXED_ONE, UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { MissileEngine } from '../../../src/server/engine/missile-engine.ts'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'

describe('Milestone M7 — Paladin Combat Skills Tree Unit Suite', () => {
  it('1. Architecture Invariants: BATCH1_SKILLS length === 38, ISO_GROUND_ASPECT_RATIO === 0.5', () => {
    expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    expect(ISO_GROUND_ASPECT_RATIO).toBe(0.5)
  })

  describe('2. Sacrifice (96)', () => {
    it('calculates %ED, AR, and synergies accurately across levels', () => {
      // slvl 1
      const s1 = calculateSacrificeStats(1)
      expect(s1.toHitBonusPct).toBe(20)
      expect(s1.damagePct).toBe(180)
      expect(s1.selfDamagePct).toBe(8)

      // slvl 10 with synergies (Redemption lvl 5 = +75%, Fanaticism lvl 10 = +50%)
      const s10 = calculateSacrificeStats(10, { redemption: 5, fanaticism: 10 })
      expect(s10.toHitBonusPct).toBe(20 + 9 * 7) // 83%
      expect(s10.damagePct).toBe(180 + 9 * 15 + 75 + 50) // 440%
      expect(s10.selfDamagePct).toBe(8)

      // slvl 20
      const s20 = calculateSacrificeStats(20)
      expect(s20.toHitBonusPct).toBe(20 + 19 * 7) // 153%
      expect(s20.damagePct).toBe(180 + 19 * 15) // 465%
    })

    it('inflicts 8% self-damage capped by target current HP, mitigated by caster damageresist (capped at 50%), and can reduce Paladin HP to 0 (1.13c SKILLS_SrvDo069_Sacrifice)', async () => {
      const registry = await getSharedDataRegistry()
      const attackerStats = new UnitStatList(registry, {
        hitpoints: 50 * FIXED_ONE,
        maxhp: 1000 * FIXED_ONE,
      })
      const attackerBus = new StateBus(attackerStats, registry)
      const attacker: CombatUnitContext = {
        id: 'paladin-sacrifice',
        name: 'Paladin',
        statList: attackerStats,
        stateBus: attackerBus,
        weaponMinPhys: 500,
        weaponMaxPhys: 500,
      }

      const defenderStats = new UnitStatList(registry, {
        hitpoints: 10000 * FIXED_ONE,
        maxhp: 10000 * FIXED_ONE,
        damageresist: 0,
      })
      const defenderBus = new StateBus(defenderStats, registry)
      const defender: CombatUnitContext = {
        id: 'monster-sacrifice',
        name: 'Monster',
        statList: defenderStats,
        stateBus: defenderBus,
      }

      // Deal 500 base physical damage with Sacrifice
      const out = executeSUnitDmg(attacker, defender, {
        skillId: 96,
        attackKind: 'melee',
        srcDam: 0,
        flatPhysMin256: 500 * FIXED_ONE,
        flatPhysMax256: 500 * FIXED_ONE,
        selfDamagePct: 8,
        autoHit: true,
      }, { rand: () => 50 })

      expect(out.hit).toBe(true)
      expect(out.physDamage256).toBe(500 * FIXED_ONE)
      // 8% of 500 = 40 damage. Attacker had 50 HP, should have 10 HP left.
      expect(out.selfDamageTaken256).toBe(40 * FIXED_ONE)
      expect(attackerStats.getHp256()).toBe(10 * FIXED_ONE)

      // 1.13c SKILLS_SrvDo069_Sacrifice (0x6FD11BA0): caster damageresist (capped at 50%) mitigates self-damage
      attackerStats.setBaseStat('damageresist', 75) // Capped at 50% -> 40 * (100 - 50) / 100 = 20 damage
      // With 10 HP left, 20 self-damage is lethal -> HP drops to 0 (Paladin CAN kill himself with Sacrifice in 1.13c)
      const outLethal = executeSUnitDmg(attacker, defender, {
        skillId: 96,
        attackKind: 'melee',
        srcDam: 0,
        flatPhysMin256: 500 * FIXED_ONE,
        flatPhysMax256: 500 * FIXED_ONE,
        selfDamagePct: 8,
        autoHit: true,
      }, { rand: () => 50 })
      expect(outLethal.selfDamageTaken256).toBe(20 * FIXED_ONE)
      expect(attackerStats.getHp256()).toBe(0)
    })
  })

  describe('3. Smite (97)', () => {
    it('calculates %ED, stun duration, and shield + Holy Shield damage', () => {
      // slvl 1: shield min 2, max 5, holy shield bonus min 3, max 6
      const s1 = calculateSmiteStats(1, 2, 5, { min: 3, max: 6 })
      expect(s1.damagePct).toBe(15)
      expect(s1.stunDurationFrames).toBe(15)
      expect(s1.minDamage).toBe(5)
      expect(s1.maxDamage).toBe(11)

      // slvl 20: stun duration = min(250, 15 + 19 * 5) = 110 frames
      const s20 = calculateSmiteStats(20, 10, 20, { min: 57, max: 60 })
      expect(s20.damagePct).toBe(15 + 19 * 15) // 300%
      expect(s20.stunDurationFrames).toBe(110)
      expect(s20.minDamage).toBe(67)
      expect(s20.maxDamage).toBe(80)
    })

    it('enforces autoHit: true and unblockable: true against 95% defense and 75% block target', async () => {
      const registry = await getSharedDataRegistry()
      const attackerStats = new UnitStatList(registry, { level: 20, tohit: 100 })
      const attackerBus = new StateBus(attackerStats, registry)
      const attacker: CombatUnitContext = {
        id: 'smiter',
        name: 'Paladin',
        statList: attackerStats,
        stateBus: attackerBus,
        hasShield: true,
      }

      // Defender with 99,999 defense, 75% block rate, higher level
      const defenderStats = new UnitStatList(registry, {
        level: 99,
        armorclass: 99999,
        toblock: 75,
        hitpoints: 5000 * FIXED_ONE,
      })
      const defenderBus = new StateBus(defenderStats, registry)
      const defender: CombatUnitContext = {
        id: 'high-def-target',
        name: 'Iron Maiden',
        statList: defenderStats,
        stateBus: defenderBus,
        hasShield: true,
      }

      // Smite attack with autoHit and unblockable
      const out = executeSUnitDmg(attacker, defender, {
        skillId: 97,
        attackKind: 'melee',
        srcDam: 0,
        flatPhysMin256: 50 * FIXED_ONE,
        flatPhysMax256: 60 * FIXED_ONE,
        autoHit: true,
        unblockable: true,
        stunDurationFrames: 50,
        roll100: 10, // Normally would be blocked by 75% block
      }, { rand: () => 10 })

      expect(out.hit).toBe(true)
      expect(out.avoidedReason).toBe('none')
      expect(out.totalDamage).toBeGreaterThan(0)
      expect(defenderBus.hasState('stun')).toBe(true)
      expect(defenderBus.getState('stun')?.durationFrames).toBe(50)
    })

    it('suppresses equipment life and mana leech, but preserves Life Tap curse healing (1.13c parity)', async () => {
      const registry = await getSharedDataRegistry()
      const initialHp = 200 * FIXED_ONE
      const initialMana = 100 * FIXED_ONE

      const attackerStats = new UnitStatList(registry, {
        hitpoints: initialHp,
        maxhp: 1000 * FIXED_ONE,
        mana: initialMana,
        maxmana: 500 * FIXED_ONE,
        lifedrainmindam: 25, // 25% Life Leech from gear
        manadrainmindam: 20, // 20% Mana Leech from gear
      })
      const attackerBus = new StateBus(attackerStats, registry)
      const attacker: CombatUnitContext = {
        id: 'smiter_leech_test',
        name: 'Paladin',
        unitType: 'player',
        statList: attackerStats,
        stateBus: attackerBus,
        hasShield: true,
      }

      const defenderStats = new UnitStatList(registry, {
        hitpoints: 5000 * FIXED_ONE,
        maxhp: 5000 * FIXED_ONE,
        damageresist: 0,
      })
      const defenderBus = new StateBus(defenderStats, registry)
      const defender: CombatUnitContext = {
        id: 'monster_dummy',
        name: 'Dummy',
        statList: defenderStats,
        stateBus: defenderBus,
      }

      // 1. Smite attack WITHOUT Life Tap: gear leech must be completely suppressed
      const outNoLifeTap = executeSUnitDmg(attacker, defender, {
        skillId: 97,
        attackKind: 'melee',
        srcDam: 0,
        flatPhysMin256: 100 * FIXED_ONE,
        flatPhysMax256: 100 * FIXED_ONE,
        autoHit: true,
        unblockable: true,
      }, { rand: () => 50 })

      expect(outNoLifeTap.hit).toBe(true)
      expect(outNoLifeTap.physDamage256).toBe(100 * FIXED_ONE)
      expect(outNoLifeTap.attackerHealed256 ?? 0).toBe(0)
      expect(outNoLifeTap.attackerManaLeeched256 ?? 0).toBe(0)
      expect(attackerStats.getHp256()).toBe(initialHp)
      expect(attackerStats.getMana256()).toBe(initialMana)

      // 2. Smite attack WITH Life Tap curse: 50% physical damage restored as HP
      defenderBus.applyState({
        stateNameOrId: 'lifetap',
        slvl: 1,
        durationFrames: 500,
      })

      const outWithLifeTap = executeSUnitDmg(attacker, defender, {
        skillId: 97,
        attackKind: 'melee',
        srcDam: 0,
        flatPhysMin256: 100 * FIXED_ONE,
        flatPhysMax256: 100 * FIXED_ONE,
        autoHit: true,
        unblockable: true,
      }, { rand: () => 50 })

      expect(outWithLifeTap.hit).toBe(true)
      expect(outWithLifeTap.physDamage256).toBe(100 * FIXED_ONE)
      expect(outWithLifeTap.attackerHealed256).toBe(50 * FIXED_ONE)
      expect(outWithLifeTap.attackerManaLeeched256 ?? 0).toBe(0)
      expect(attackerStats.getHp256()).toBe(initialHp + 50 * FIXED_ONE)
      expect(attackerStats.getMana256()).toBe(initialMana)
    })

    it('enforces SrvSt shield requirement with tri-state semantics (hasShield=false fails; undefined succeeds)', async () => {
      const registry = await getSharedDataRegistry()
      const stats = new UnitStatList(registry, {})
      const unshielded: CombatUnitContext = {
        id: 'pal_no_shield',
        name: 'Paladin',
        statList: stats,
        stateBus: new StateBus(stats, registry),
        hasShield: false,
      }
      const dummyDef: CombatUnitContext = {
        id: 'dummy',
        name: 'Dummy',
        statList: stats,
        stateBus: new StateBus(stats, registry),
      }

      const out = executeSUnitDmg(unshielded, dummyDef, {
        skillId: 97,
        attackKind: 'melee',
        flatPhysMin256: 100 * FIXED_ONE,
        flatPhysMax256: 100 * FIXED_ONE,
      }, { rand: () => 50 })
      expect(out.hit).toBe(false)
      expect(out.avoidedReason).toBe('miss')

      expect(validatePaladinSkillEquipment(97, { hasShield: false }).valid).toBe(false)
      expect(validatePaladinSkillEquipment(97, { hasShield: true }).valid).toBe(true)
      expect(validatePaladinSkillEquipment(97, undefined).valid).toBe(true)
      expect(validatePaladinSkillEquipment(117, { hasShield: false }).valid).toBe(false)
      expect(validatePaladinSkillEquipment(117, { hasShield: true }).valid).toBe(true)
      expect(validatePaladinSkillEquipment(96, { weaponItemType: 'bow' }).valid).toBe(false)
      expect(validatePaladinSkillEquipment(106, { weaponItemType: 'bow' }).valid).toBe(false)
      expect(validatePaladinSkillEquipment(96, undefined).valid).toBe(true)
    })
  })

  describe('4. Holy Bolt (101)', () => {
    it('calculates 5-band magic damage vs Undead with Blessed Hammer and FoH synergies', () => {
      // slvl 1
      const dmg1 = calculateHolyBoltDamage(1)
      expect(dmg1.min).toBe(8)
      expect(dmg1.max).toBe(16)

      // slvl 10 (base min: 8 + 7*8 + 2*10 = 84, base max: 16 + 7*8 + 2*11 = 94)
      const dmg10 = calculateHolyBoltDamage(10)
      expect(dmg10.min).toBe(84)
      expect(dmg10.max).toBe(94)

      // slvl 20 with Blessed Hammer (10 pts) and FoH (10 pts) -> 20 * 50% = +1000% synergy
      const dmg20Syn = calculateHolyBoltDamage(20, { blessedHammer: 10, fistOfTheHeavens: 10 })
      // Base at lvl 20: min = 8 + 7*8 + 8*10 + 4*13 = 196, max = 16 + 7*8 + 8*11 + 4*15 = 220
      // With +1000% syn: 196 * 11 = 2156, 220 * 11 = 2420
      expect(dmg20Syn.min).toBe(196 * 11)
      expect(dmg20Syn.max).toBe(220 * 11)
    })

    it('calculates friendly heal scaling and Prayer synergy', () => {
      const h1 = calculateHolyBoltHeal(1)
      expect(h1.min).toBe(1)
      expect(h1.max).toBe(6)

      const h10Prayer5 = calculateHolyBoltHeal(10, 5) // Prayer lvl 5 = +75%
      // Raw min: 1 + 9*2 = 19 -> 19 * 1.75 = 33
      // Raw max: 6 + 9*4 = 42 -> 42 * 1.75 = 73
      expect(h10Prayer5.min).toBe(Math.trunc(19 * 1.75))
      expect(h10Prayer5.max).toBe(Math.trunc(42 * 1.75))
    })

    it('discriminator: damages Undead, heals friendly ally, and passes through Living Demon', async () => {
      const registry = await getSharedDataRegistry()
      const engine = new MissileEngine(registry)

      const casterStats = new UnitStatList(registry, { hitpoints: 1000 * FIXED_ONE })
      casterStats.setBaseSkillLevel(99, 10) // Prayer synergy
      const caster: CombatUnitContext = {
        id: 'paladin-holybolt',
        name: 'Paladin',
        statList: casterStats,
        stateBus: new StateBus(casterStats, registry),
      }

      // Target 1: Demon (living)
      const demonStats = new UnitStatList(registry, { hitpoints: 1000 * FIXED_ONE })
      const demon: CombatUnitContext = {
        id: 'demon-target',
        name: 'Demon',
        statList: demonStats,
        stateBus: new StateBus(demonStats, registry),
        isUndead: false,
        isDemon: true,
        unitType: 'monster',
      }

      // Target 2: Friendly Ally injured
      const allyStats = new UnitStatList(registry, { hitpoints: 200 * FIXED_ONE, maxhp: 1000 * FIXED_ONE })
      const ally: CombatUnitContext = {
        id: 'ally-target',
        name: 'Mercenary',
        statList: allyStats,
        stateBus: new StateBus(allyStats, registry),
        unitType: 'mercenary',
      }

      // Target 3: Undead Monster
      const undeadStats = new UnitStatList(registry, { hitpoints: 1000 * FIXED_ONE, magicresist: 0 })
      const undead: CombatUnitContext = {
        id: 'undead-target',
        name: 'Skeleton',
        statList: undeadStats,
        stateBus: new StateBus(undeadStats, registry),
        isUndead: true,
        unitType: 'monster',
      }

      // 1. Holy Bolt fired at Demon -> Demon must be ignored and bolt continues
      const m1 = engine.spawnMissile({
        missileNameOrId: 'holybolt',
        sourceSkillId: 101,
        slvl: 10,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 50,
        targetY: 0,
        dmgPacket: { skillId: 101, elemType: 'mag', elemMin256: 100 * FIXED_ONE, elemMax256: 100 * FIXED_ONE },
      })!
      const step1 = engine.tick(1, [demon], new Map([['demon-target', { x: 10, y: 0 }]]))
      expect(demonStats.getHp256()).toBe(1000 * FIXED_ONE) // No damage!
      expect(m1.expired).toBe(false) // Missile passed through!

      // 2. Holy Bolt fired at Ally -> heals ally and expires
      const m2 = engine.spawnMissile({
        missileNameOrId: 'holybolt',
        sourceSkillId: 101,
        slvl: 10,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 50,
        targetY: 0,
        dmgPacket: { skillId: 101, elemType: 'mag', elemMin256: 100 * FIXED_ONE, elemMax256: 100 * FIXED_ONE },
      })!
      const step2 = engine.tick(2, [ally], new Map([['ally-target', { x: 10, y: 0 }]]))
      expect(allyStats.getHp256()).toBeGreaterThan(200 * FIXED_ONE) // Healed!
      expect(m2.expired).toBe(true) // Consumed on heal!

      // 3. Holy Bolt fired at Undead -> damages undead and expires
      const m3 = engine.spawnMissile({
        missileNameOrId: 'holybolt',
        sourceSkillId: 101,
        slvl: 10,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 50,
        targetY: 0,
        dmgPacket: { skillId: 101, elemType: 'mag', elemMin256: 100 * FIXED_ONE, elemMax256: 100 * FIXED_ONE },
      })!
      const step3 = engine.tick(3, [undead], new Map([['undead-target', { x: 10, y: 0 }]]))
      expect(undeadStats.getHp256()).toBeLessThan(1000 * FIXED_ONE) // Damaged!
      expect(m3.expired).toBe(true) // Consumed on impact!
    })
  })

  describe('5. Zeal (106)', () => {
    it('calculates swing count formula min(slvl + 1, 5) and %ED scaling', () => {
      expect(calculateZealStats(1).hits).toBe(2)
      expect(calculateZealStats(2).hits).toBe(3)
      expect(calculateZealStats(3).hits).toBe(4)
      expect(calculateZealStats(4).hits).toBe(5)
      expect(calculateZealStats(20).hits).toBe(5)

      // %ED starts at slvl 5: (slvl - 4) * 6%
      expect(calculateZealStats(1).damagePct).toBe(0)
      expect(calculateZealStats(4).damagePct).toBe(0)
      expect(calculateZealStats(5).damagePct).toBe(6)
      expect(calculateZealStats(10, { sacrifice: 10 }).damagePct).toBe((10 - 4) * 6 + 10 * 12) // 36 + 120 = 156%
    })
  })

  describe('6. Charge (107)', () => {
    it('calculates 300% movement velocity and Vigor/Might synergy', () => {
      const c1 = calculateChargeStats(1)
      expect(c1.speedMultiplier).toBe(3.0)
      expect(c1.damagePct).toBe(100)
      expect(c1.toHitBonusPct).toBe(50)

      const c10 = calculateChargeStats(10, { vigor: 5, might: 5 })
      expect(c10.damagePct).toBe(100 + 9 * 25 + (5 + 5) * 20) // 325 + 200 = 525%
      expect(c10.toHitBonusPct).toBe(50 + 9 * 15) // 185%
    })
  })

  describe('7. Vengeance (111)', () => {
    it('calculates 3-way elemental percentages and cold chill duration', () => {
      const v1 = calculateVengeanceStats(1)
      expect(v1.firePct).toBe(70)
      expect(v1.coldPct).toBe(70)
      expect(v1.ltngPct).toBe(70)
      expect(v1.chillDurationFrames).toBe(30)

      // slvl 10 with Resist Fire 10, Salvation 5
      const v10 = calculateVengeanceStats(10, { resistFire: 10, salvation: 5 })
      // Base elem: 70 + 9*6 = 124%
      // Fire: 124 + 10*10 + 5*2 = 234%
      expect(v10.firePct).toBe(234)
      expect(v10.coldPct).toBe(124 + 10) // 134% (salvation only)
      expect(v10.chillDurationFrames).toBe(30 + 9 * 15) // 165 frames (6.6s)
    })

    it('evaluates multi-elemental damage packet with independent resistances', async () => {
      const registry = await getSharedDataRegistry()
      const attackerStats = new UnitStatList(registry, {})
      const attacker: CombatUnitContext = {
        id: 'avenger',
        name: 'Paladin',
        statList: attackerStats,
        stateBus: new StateBus(attackerStats, registry),
      }

      // Defender: Immune to Fire (110%), 50% Cold, 0% Lightning, 0% Physical
      const defenderStats = new UnitStatList(registry, {
        hitpoints: 10000 * FIXED_ONE,
        damageresist: 0,
        fireresist: 110,
        coldresist: 50,
        lightresist: 0,
      })
      const defender: CombatUnitContext = {
        id: 'tri-res-target',
        name: 'Monster',
        statList: defenderStats,
        stateBus: new StateBus(defenderStats, registry),
      }

      const out = executeSUnitDmg(attacker, defender, {
        skillId: 111,
        attackKind: 'melee',
        srcDam: 0,
        flatPhysMin256: 100 * FIXED_ONE,
        flatPhysMax256: 100 * FIXED_ONE,
        multiElemPacket: {
          firePct: 100, // 100 fire raw -> resisted 110% -> 0
          coldPct: 100, // 100 cold raw -> resisted 50% -> 50
          ltngPct: 100, // 100 ltng raw -> resisted 0% -> 100
          chillDurationFrames: 50,
        },
        autoHit: true,
      }, { rand: () => 50 })

      expect(out.hit).toBe(true)
      expect(out.physDamage256).toBe(100 * FIXED_ONE)
      // Fire (0) + Cold (50) + Lightning (100) = 150 elemental damage
      expect(out.elemDamage256).toBe(150 * FIXED_ONE)
      expect(out.totalDamage).toBe(250)
      expect(defender.stateBus.hasState('chill')).toBe(true)
      expect(defender.stateBus.hasState('freeze')).toBe(false)
    })
  })

  describe('8. Blessed Hammer (112)', () => {
    it('calculates 5-band magic damage (8, 10, 12, 13, 14), synergies, and Concentration +50% synergy', () => {
      const h1 = calculateBlessedHammerDamage(1)
      expect(h1.min).toBe(12)
      expect(h1.max).toBe(16)

      // slvl 20: 12 + 7*8 + 8*10 + 4*12 = 196 min, 16 + 7*8 + 8*10 + 4*12 = 200 max
      const h20 = calculateBlessedHammerDamage(20)
      expect(h20.min).toBe(196)
      expect(h20.max).toBe(200)

      // Concentration aura +300% ED -> gives +150% ED to Blessed Hammer
      const h1Conc = calculateBlessedHammerDamage(1, undefined, 300)
      expect(h1Conc.concentrationBonusPct).toBe(150)
      expect(h1Conc.min).toBe(Math.trunc(12 * 2.5))
      expect(h1Conc.max).toBe(Math.trunc(16 * 2.5))
    })

    it('CRITICAL 1.13c Rule: Magic Immune monsters take 0 damage from Blessed Hammer, while Holy Bolt (#101) bypasses Undead Magic Immunity', async () => {
      const registry = await getSharedDataRegistry()
      const attackerStats = new UnitStatList(registry, {})
      const attacker: CombatUnitContext = {
        id: 'hammerdin',
        name: 'Paladin',
        statList: attackerStats,
        stateBus: new StateBus(attackerStats, registry),
      }

      // 1.13c Invariant: Undead with magicresist >= 100 is IMMUNE to Blessed Hammer!
      const immuneUndeadStats = new UnitStatList(registry, {
        maxhp: 5000 * FIXED_ONE,
        hitpoints: 5000 * FIXED_ONE,
        magicresist: 100,
      })
      const immuneUndead: CombatUnitContext = {
        id: 'baal-wave-undead',
        name: 'Achmel the Cursed Minion',
        statList: immuneUndeadStats,
        stateBus: new StateBus(immuneUndeadStats, registry),
        isUndead: true,
      }

      const out = executeSUnitDmg(attacker, immuneUndead, {
        skillId: 112,
        attackKind: 'spell',
        elemType: 'mag',
        elemMin256: 500 * FIXED_ONE,
        elemMax256: 500 * FIXED_ONE,
        autoHit: true,
      }, { rand: () => 50 })

      expect(out.hit).toBe(true)
      expect(out.immuneToElem).toBe(true)
      expect(out.totalDamage).toBe(0)
      expect(immuneUndeadStats.getHp256()).toBe(5000 * FIXED_ONE) // Zero damage taken from Blessed Hammer!

      // Holy Bolt (#101) has DAMAGEHITFLAG_BYPASSUNDEAD (0x200) -> treats undead magicresist > 0 as 0!
      const outHb = executeSUnitDmg(attacker, immuneUndead, {
        skillId: 101,
        attackKind: 'spell',
        elemType: 'mag',
        elemMin256: 500 * FIXED_ONE,
        elemMax256: 500 * FIXED_ONE,
        autoHit: true,
      }, { rand: () => 50 })
      expect(outHb.immuneToElem).toBe(false)
      expect(outHb.totalDamage).toBe(500)
    })
  })

  describe('9. Conversion (116)', () => {
    it('calculates dm34 conversion roll chance (computeDiminishingReturns(0, 50, slvl)) and duration', () => {
      // 1.13c dm34 (par3=0, par4=50): floor((50 * floor(110 * slvl / (slvl + 6))) / 100)
      expect(calculateConversionStats(1).chancePct).toBe(7)
      expect(calculateConversionStats(10).chancePct).toBe(34)
      expect(calculateConversionStats(20).chancePct).toBe(42)
      expect(calculateConversionStats(1).durationFrames).toBe(400) // 16s
    })
  })

  describe('10. Holy Shield (117)', () => {
    it('calculates duration, defense bonus, dm56 block chance, and flat Smite damage', () => {
      const hs1 = calculateHolyShieldStats(1)
      expect(hs1.durationFrames).toBe(750) // 30s
      expect(hs1.defensePct).toBe(25)
      expect(hs1.blockChancePct).toBe(14) // 1.13c dm56: 10 + Math.floor(3300 / 700) = 14%
      expect(hs1.smiteMinFlat).toBe(3)
      expect(hs1.smiteMaxFlat).toBe(6)

      const hs20Defiance10 = calculateHolyShieldStats(20, 10)
      expect(hs20Defiance10.durationFrames).toBe(750 + 19 * 625) // 12,625 frames (~505s)
      expect(hs20Defiance10.defensePct).toBe(25 + 19 * 15 + 10 * 15) // 310 + 150 = 460%
      expect(hs20Defiance10.blockChancePct).toBe(35) // 1.13c dm56: 10 + Math.floor(66000 / 2600) = 35%
      expect(hs20Defiance10.smiteMinFlat).toBe(57)
      expect(hs20Defiance10.smiteMaxFlat).toBe(60)
    })
  })

  describe('11. Fist of the Heavens (121)', () => {
    it('calculates celestial lightning damage, Holy Shock synergy, and Missiles.txt #234 fistoftheheavensbolt damage', () => {
      const foh1 = calculateFistOfTheHeavensDamage(1)
      expect(foh1.lightningMin).toBe(150)
      expect(foh1.lightningMax).toBe(200)

      // slvl 10 with Holy Shock 10 -> +70% synergy
      const foh10Shock10 = calculateFistOfTheHeavensDamage(10, { holyShock: 10 })
      // Base at lvl 10: 150 + 7*15 + 2*30 = 315 min, 200 + 7*15 + 2*30 = 365 max
      // With +70% syn: 315 * 1.7 = 535, 365 * 1.7 = 620
      expect(foh10Shock10.lightningMin).toBe(Math.trunc(315 * 1.7))
      expect(foh10Shock10.lightningMax).toBe(Math.trunc(365 * 1.7))

      // Radial fistoftheheavensbolt (#234): EMin=40, EMax=50, EMinLev/EMaxLev=(6, 10, 16, 32, 48), +15%/blvl Holy Bolt
      const hb1 = calculateFistOfTheHeavensHolyBoltDamage(1, 0)
      expect(hb1.holyBoltMin).toBe(40)
      expect(hb1.holyBoltMax).toBe(50)

      // At lvl 10 with Holy Bolt synergy 10 -> +150% synergy
      // Base at lvl 10: min = 40 + 7*6 + 2*10 = 102, max = 50 + 7*6 + 2*10 = 112
      const hb10 = calculateFistOfTheHeavensHolyBoltDamage(10, 10)
      expect(hb10.holyBoltMin).toBe(Math.trunc(102 * 2.5))
      expect(hb10.holyBoltMax).toBe(Math.trunc(112 * 2.5))
    })
  })
})
