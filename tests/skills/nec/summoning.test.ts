/**
 * Diablo II: Lord of Destruction v1.13c — Necromancer Summoning Spells Tree Verification Suite
 * Milestone M4: Skills 69, 70, 75, 79, 80, 85, 89, 90, 94, 95
 *
 * Verifies:
 * 1. Architecture invariants:
 *    - BATCH1_SKILLS length strictly 38.
 *    - ISO_GROUND_ASPECT_RATIO = 0.5.
 *    - Decoupled standalone summon formulas.
 *    - calculateSkillDamage returns { min: 0, max: 0 } for all 10 summoning skills.
 * 2. Skeleton Mastery (69): flat HP, flat damage, life %, dmg %, defense scaling.
 * 3. Raise Skeleton (70): max count formula ((slvl < 4) ? slvl : 2 + floor(slvl/3)), corpse requirement.
 * 4. Clay Golem (75): Golem Group 3 exclusivity, slow-on-hit effect against targets and melee attackers.
 * 5. Golem Mastery (79): passive HP % (20% + 25%/lvl) and run/walk speed bonuses.
 * 6. Raise Skeletal Mage (80): max count matching warriors, 4 elemental types, ranged elemental missile firing.
 * 7. Blood Golem (85): 70% life link healing on damage dealt, damage sharing with player.
 * 8. Summon Resist (89): diminishing passive elemental & poison resistances (dm56(28, 75)) capped at 75%.
 * 9. Iron Golem (90): consumes metallic item, inherits properties, innate Thorns reflection (150% + 15%/lvl).
 * 10. Fire Golem (94): Holy Fire pulse aura every 50 ticks, fire absorption healing, Fire Nova death explosion.
 * 11. Revive (95): max count = slvl, copies target monster stats with +200% HP and +215% damage, 180s (4500 frames) lifespan timer.
 */
import { describe, expect, it } from 'vitest'
import {
  BATCH1_SKILLS,
  calculateSkillDamage,
  ISO_GROUND_ASPECT_RATIO,
  calculateSkeletonMaxCount,
  calculateSkeletalMageMaxCount,
  calculateReviveMaxCount,
  calculateSkeletonMasteryStats,
  calculateGolemMasteryStats,
  calculateSummonResistPct,
  calculateClayGolemStats,
  calculateBloodGolemStats,
  calculateIronGolemStats,
  calculateFireGolemStats,
  calculateReviveStats,
} from '../../../src/server/skills/skills.ts'
import {
  executeSUnitDmg,
  type CombatUnitContext,
} from '../../../src/server/engine/combat-pipeline.ts'
import { FIXED_ONE, UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { SummonManager } from '../../../src/server/ai/summon-manager.ts'
import { MissileEngine } from '../../../src/server/engine/missile-engine.ts'
import { AuraScanner } from '../../../src/server/engine/aura-scanner.ts'
import {
  buildTooltipViewModel,
  createInitialState,
} from '../../../src/common/skills/skill-calc-engine.ts'
import { CommandMapper } from '../../../src/client/input/command-mapper.ts'
import { STATE_COLOR_SHIFTS } from '../../../src/client/view/unit-drawables.ts'

describe('Milestone M4: Necromancer Summoning Spells Tree (1.13c Ground Truth)', () => {
  // =========================================================================
  // 1. Architecture Invariants
  // =========================================================================
  describe('1. Architecture Invariants', () => {
    it('preserves BATCH1_SKILLS length strictly at 38 skills', () => {
      expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    })

    it('enforces ISO_GROUND_ASPECT_RATIO === 0.5', () => {
      expect(ISO_GROUND_ASPECT_RATIO).toBe(0.5)
    })

    it('returns { min: 0, max: 0 } from calculateSkillDamage for all 10 summoning skills', () => {
      const summonSkillIds = [69, 70, 75, 79, 80, 85, 89, 90, 94, 95]
      for (const id of summonSkillIds) {
        const dmg = calculateSkillDamage(id, 20)
        expect(dmg).toEqual({ min: 0, max: 0 })
      }
    })
  })

  // =========================================================================
  // 2. Skeleton Mastery (Skill 69)
  // =========================================================================
  describe('2. Skeleton Mastery (Skill 69)', () => {
    it('calculates flat HP, flat damage, revive HP %, damage %, and defense at slvl 1, 10, 20', () => {
      const sm1 = calculateSkeletonMasteryStats(1)
      expect(sm1.skeletonHp).toBe(8)
      expect(sm1.skeletonDamage).toBe(2)
      expect(sm1.reviveHpPct).toBe(5)
      expect(sm1.damagePct).toBe(10)
      expect(sm1.defense).toBe(10)

      const sm10 = calculateSkeletonMasteryStats(10)
      expect(sm10.skeletonHp).toBe(80)
      expect(sm10.skeletonDamage).toBe(20)
      expect(sm10.reviveHpPct).toBe(50)
      expect(sm10.damagePct).toBe(100)
      expect(sm10.defense).toBe(100)

      const sm20 = calculateSkeletonMasteryStats(20)
      expect(sm20.skeletonHp).toBe(160)
      expect(sm20.skeletonDamage).toBe(40)
      expect(sm20.reviveHpPct).toBe(100)
      expect(sm20.damagePct).toBe(200)
      expect(sm20.defense).toBe(200)
    })
  })

  // =========================================================================
  // 3. Raise Skeleton (Skill 70)
  // =========================================================================
  describe('3. Raise Skeleton (Skill 70)', () => {
    it('calculates exact 1.13c max skeleton count formula', () => {
      expect(calculateSkeletonMaxCount(1)).toBe(1)
      expect(calculateSkeletonMaxCount(2)).toBe(2)
      expect(calculateSkeletonMaxCount(3)).toBe(3)
      expect(calculateSkeletonMaxCount(4)).toBe(3)
      expect(calculateSkeletonMaxCount(5)).toBe(3)
      expect(calculateSkeletonMaxCount(6)).toBe(4)
      expect(calculateSkeletonMaxCount(9)).toBe(5)
      expect(calculateSkeletonMaxCount(10)).toBe(5)
      expect(calculateSkeletonMaxCount(20)).toBe(8)
    })

    it('requires and synchronously consumes an unconsumed non-boss corpse', async () => {
      const registry = await getSharedDataRegistry()
      const sm = new SummonManager(registry)
      const stats = new UnitStatList(registry)
      const owner: CombatUnitContext = {
        id: 'player',
        name: 'Necro',
        statList: stats,
        stateBus: new StateBus(stats, registry),
      }

      // No corpses available -> fails with 'missing_corpse'
      const failRes = sm.createPet({
        owner,
        skillId: 70,
        slvl: 1,
        corpses: [],
      })
      expect(failRes.created).toBe(false)
      expect(failRes.reason).toBe('missing_corpse')

      // Boss corpse available -> fails
      const bossCorpse = [{ id: 'corpse-boss', consumed: false, baseMaxHp: 5000, isBoss: true }]
      const failBoss = sm.createPet({
        owner,
        skillId: 70,
        slvl: 1,
        corpses: bossCorpse,
      })
      expect(failBoss.created).toBe(false)
      expect(failBoss.reason).toBe('missing_corpse')
      expect(bossCorpse[0]!.consumed).toBe(false)

      // Valid corpse available -> succeeds and marks corpse consumed
      const validCorpse = [{ id: 'corpse-1', consumed: false, baseMaxHp: 500, isBoss: false }]
      const successRes = sm.createPet({
        owner,
        skillId: 70,
        slvl: 1,
        corpses: validCorpse,
      })
      expect(successRes.created).toBe(true)
      expect(validCorpse[0]!.consumed).toBe(true)
      expect(successRes.pet?.kind).toBe('skeleton')
    })
  })

  // =========================================================================
  // 4. Clay Golem (Skill 75)
  // =========================================================================
  describe('4. Clay Golem (Skill 75)', () => {
    it('evaluates dm34(0, 75) slow percentage, multiplicative calc1 HP, and cross-golem synergies', () => {
      const c1 = calculateClayGolemStats(1, 0, 0)
      expect(c1.slowPct).toBe(11)
      expect(c1.baseHp).toBe(100)
      expect(c1.maxHp).toBe(100)
      expect(c1.defense).toBe(100)
      expect(c1.attackRating).toBe(60) // 40 + 20*1
      expect(c1.minDamage).toBe(2)
      expect(c1.maxDamage).toBe(5)

      const c10 = calculateClayGolemStats(10, 0, 0)
      expect(c10.slowPct).toBe(51) // dm34(0, 75) at slvl 10 = floor(1100*75 / 1600) = 51
      expect(c10.selfHpPct).toBe(315) // 9 * 35
      expect(c10.maxHp).toBe(415) // 100 * (100 + 315) / 100
      expect(c10.minDamage).toBe(8) // floor(2 * 415 / 100)
      expect(c10.maxDamage).toBe(20) // floor(5 * 415 / 100)

      const c20 = calculateClayGolemStats(20, 0, 0)
      expect(c20.slowPct).toBe(63) // dm34(0, 75) at slvl 20 = floor(2200*75 / 2600) = 63
      expect(c20.selfHpPct).toBe(665) // 19 * 35
      expect(c20.maxHp).toBe(765)

      // Multiplicative calc1: (100 + 35*(lvl-1)) * (100 + GM.ln12 + 5*BG.blvl) / 100 - 100
      // At slvl 20 (selfHpPct = 665), GM = 10 (+200%), BG.blvl = 10 (+50%):
      // floor(765 * 350 / 100) - 100 = 2677 - 100 = 2577% => maxHp = 2677 (Normal), 7361 (Hell 275 base)
      const c20Syn = calculateClayGolemStats(20, 10, 10, {
        bloodGolemBlvl: 10,
        ironGolemBlvl: 10,
        fireGolemBlvl: 10,
        difficulty: 2,
      })
      expect(c20Syn.hpBonusPct).toBe(2577)
      expect(c20Syn.maxHp).toBe(7361) // floor(275 * 2677 / 100)
      expect(c20Syn.defense).toBe(450) // 100 + 10*35
      expect(c20Syn.attackRating).toBe(742) // 92 (Hell) + 20*20 + 10*25
      expect(c20Syn.damageBonusPct).toBe(725) // 665 + 10*6
    })

    it('enforces Golem Group 3 exclusivity, innate resistances, and 750-frame slow-on-hit / damagedinmelee', async () => {
      const registry = await getSharedDataRegistry()
      const sm = new SummonManager(registry)
      const stats = new UnitStatList(registry)
      stats.setBaseSkillLevel(79, 5) // Golem Mastery lvl 5
      stats.setBaseSkillLevel(85, 10) // Blood Golem blvl = 10 (+50% HP)
      stats.setBonusSkillLevel(85, 10) // +10 soft points must NOT count for synergy
      const owner: CombatUnitContext = {
        id: 'player',
        name: 'Necro',
        statList: stats,
        stateBus: new StateBus(stats, registry),
      }

      // Summon Clay Golem
      const clay = sm.createPet({ owner, skillId: 75, slvl: 10 })
      expect(clay.created).toBe(true)
      expect(sm.getActivePets().length).toBe(1)
      const clayPet = clay.pet!
      expect(clayPet.kind).toBe('clay_golem')
      // Innate MonStats.txt resistances: ResDm=25, ResLi=20, ResCo=50
      expect(clayPet.statList.getAccruedStat('damageresist')).toBe(25)
      expect(clayPet.statList.getAccruedStat('lightresist')).toBe(20)
      expect(clayPet.statList.getAccruedStat('coldresist')).toBe(50)
      expect(clayPet.statList.getAccruedStat('velocitypercent')).toBe(calculateGolemMasteryStats(5).speedBonusPct)
      expect(clayPet.statList.getAccruedStat('tohit')).toBe(40 + 20 * 10 + 5 * 25)

      // Enemy hits Clay Golem in melee -> EventFunc27_SlowTarget applies 750-frame slow (51%)
      const enemyStats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 1000 * FIXED_ONE })
      const enemy: CombatUnitContext = {
        id: 'enemy-1',
        name: 'Melee Attacker',
        statList: enemyStats,
        stateBus: new StateBus(enemyStats, registry),
      }
      executeSUnitDmg(enemy, clayPet, {
        skillId: 0,
        attackKind: 'melee',
        flatPhysMin256: 20 * FIXED_ONE,
        flatPhysMax256: 20 * FIXED_ONE,
        autoHit: true,
      }, { rand: () => 50 })
      expect(enemy.stateBus.getState('slowed')?.durationFrames).toBe(750)
      expect(enemy.statList.getAccruedStat('item_slow')).toBe(51)

      // Summon Blood Golem -> evicts Clay Golem!
      const blood = sm.createPet({ owner, skillId: 85, slvl: 1 })
      expect(blood.created).toBe(true)
      expect(blood.evictedPetUids).toContain(clayPet.uid)
      expect(sm.getActivePets().length).toBe(1)
      expect(sm.getActivePets()[0]!.kind).toBe('blood_golem')
    })
  })

  // =========================================================================
  // 5. Golem Mastery (Skill 79)
  // =========================================================================
  describe('5. Golem Mastery (Skill 79)', () => {
    it('calculates passive HP % (+20%/lvl), dm34(0, 40) velocity %, and +25/lvl Attack Rating (0 when unlearned)', () => {
      const gm0 = calculateGolemMasteryStats(0)
      expect(gm0.hpBonusPct).toBe(0)
      expect(gm0.speedBonusPct).toBe(0)
      expect(gm0.attackRatingBonus).toBe(0)

      const gm1 = calculateGolemMasteryStats(1)
      expect(gm1.hpBonusPct).toBe(20)
      expect(gm1.speedBonusPct).toBe(6) // floor(110 * 40 / 700) = 6
      expect(gm1.attackRatingBonus).toBe(25)

      const gm10 = calculateGolemMasteryStats(10)
      expect(gm10.hpBonusPct).toBe(200) // 10 * 20 = 200
      expect(gm10.speedBonusPct).toBe(27) // floor(1100 * 40 / 1600) = 27
      expect(gm10.attackRatingBonus).toBe(250) // 10 * 25 = 250

      const gm20 = calculateGolemMasteryStats(20)
      expect(gm20.hpBonusPct).toBe(400) // 20 * 20 = 400
      expect(gm20.speedBonusPct).toBe(33) // floor(2200 * 40 / 2600) = 33
      expect(gm20.attackRatingBonus).toBe(500) // 20 * 25 = 500
    })
  })

  // =========================================================================
  // 6. Raise Skeletal Mage (Skill 80)
  // =========================================================================
  describe('6. Raise Skeletal Mage (Skill 80)', () => {
    it('calculates max count formula matching warriors', () => {
      expect(calculateSkeletalMageMaxCount(1)).toBe(1)
      expect(calculateSkeletalMageMaxCount(3)).toBe(3)
      expect(calculateSkeletalMageMaxCount(4)).toBe(3)
      expect(calculateSkeletalMageMaxCount(6)).toBe(4)
      expect(calculateSkeletalMageMaxCount(20)).toBe(8)
    })

    it('spawns elemental variants that fire ranged missiles', async () => {
      const registry = await getSharedDataRegistry()
      const sm = new SummonManager(registry)
      const stats = new UnitStatList(registry)
      const owner: CombatUnitContext = {
        id: 'player',
        name: 'Necro',
        statList: stats,
        stateBus: new StateBus(stats, registry),
      }

      const corpses = [{ id: 'corpse-1', consumed: false, baseMaxHp: 500, isBoss: false }]
      const res = sm.createPet({ owner, skillId: 80, slvl: 5, corpses })
      expect(res.created).toBe(true)
      expect(res.pet?.kind).toBe('skeleton_mage')
      expect(['fire', 'cold', 'lightning', 'poison']).toContain(res.pet?.mageElement)

      // Test missile firing in tickPets
      const me = new MissileEngine(registry)
      const auraScanner = new AuraScanner(registry)
      const dummyStats = new UnitStatList(registry, { maxhp: 5000 * FIXED_ONE, hitpoints: 5000 * FIXED_ONE })
      const enemy: CombatUnitContext = {
        id: 'enemy-1',
        name: 'Target Dummy',
        statList: dummyStats,
        stateBus: new StateBus(dummyStats, registry),
      }
      const enemyPositions = new Map([['enemy-1', { x: 100, y: 100 }]])

      const tickRes = sm.tickPets({
        currentTick: 1,
        owner,
        enemies: [enemy],
        enemyPositions,
        missileEngine: me,
        auraScanner,
      })

      expect(tickRes.petAttacks).toBeGreaterThanOrEqual(1)
      expect(me.getActiveMissiles().length).toBeGreaterThanOrEqual(1)
    })
  })

  // =========================================================================
  // 7. Blood Golem (Skill 85)
  // =========================================================================
  describe('7. Blood Golem (Skill 85)', () => {
    it('evaluates dm12(75, 150) life steal, 30/70 split, 25% damage link, and synergies', () => {
      const bg1 = calculateBloodGolemStats(1, 0)
      expect(bg1.lifeLeechPct).toBe(86) // 75 + floor(110*75 / 700) = 86
      expect(bg1.ownerHealSplitPct).toBe(30)
      expect(bg1.golemHealSplitPct).toBe(70)
      expect(bg1.damageSharePct).toBe(25)
      expect(bg1.baseHp).toBe(201)
      expect(bg1.minDamage).toBe(6)
      expect(bg1.maxDamage).toBe(16)

      const bg10 = calculateBloodGolemStats(10, 5, {
        clayGolemBlvl: 10,
        ironGolemBlvl: 10,
        fireGolemBlvl: 10,
      })
      expect(bg10.lifeLeechPct).toBe(126) // 75 + floor(1100*75 / 1600) = 126
      expect(bg10.maxHp).toBe(402) // 201 * (100 + 100) / 100
      expect(bg10.defense).toBe(470) // 120 + 10*35
      expect(bg10.attackRating).toBe(385) // 60 + 5*25 + 10*20
      expect(bg10.damageBonusPct).toBe(375) // 9*35 + 10*6
    })

    it('splits stolen life 30% to owner / 70% to golem (with overflow) and links 25% damage taken to owner (clamped >= 1 HP)', async () => {
      const registry = await getSharedDataRegistry()
      const sm = new SummonManager(registry)
      const stats = new UnitStatList(registry, { maxhp: 1000 * FIXED_ONE, hitpoints: 500 * FIXED_ONE })
      const owner: CombatUnitContext = {
        id: 'player',
        name: 'Necro',
        statList: stats,
        stateBus: new StateBus(stats, registry),
      }

      const created = sm.createPet({ owner, skillId: 85, slvl: 10 })
      const bgPet = created.pet!
      // Damage the Blood Golem slightly so both golem and owner can heal
      bgPet.statList.setHp256(100 * FIXED_ONE)

      const dummyStats = new UnitStatList(registry, { maxhp: 5000 * FIXED_ONE, hitpoints: 5000 * FIXED_ONE })
      const enemy: CombatUnitContext = {
        id: 'enemy-1',
        name: 'Target Dummy',
        statList: dummyStats,
        stateBus: new StateBus(dummyStats, registry),
      }
      const enemyPositions = new Map([['enemy-1', { x: 20, y: 60 }]])

      const me = new MissileEngine(registry)
      const auraScanner = new AuraScanner(registry)

      sm.tickPets({
        currentTick: 10,
        owner,
        enemies: [enemy],
        enemyPositions,
        missileEngine: me,
        auraScanner,
      })

      // Both owner (30%) and Blood Golem (70%) must receive healing from EventFunc23_LifeBloodLink
      expect(owner.statList.getHp256()).toBeGreaterThan(500 * FIXED_ONE)
      expect(bgPet.statList.getHp256()).toBeGreaterThan(100 * FIXED_ONE)

      // EventFunc26_DamageLink: when Blood Golem takes 100 melee damage, owner takes 25% (25 HP), clamped >= 1 HP
      owner.statList.setHp256(10 * FIXED_ONE)
      executeSUnitDmg(enemy, bgPet, {
        skillId: 0,
        attackKind: 'melee',
        flatPhysMin256: 100 * FIXED_ONE,
        flatPhysMax256: 100 * FIXED_ONE,
        autoHit: true,
      }, { rand: () => 50 })
      // Clamped at FIXED_ONE (never kills owner)
      expect(owner.statList.getHp256()).toBe(FIXED_ONE)
    })
  })

  // =========================================================================
  // 8. Summon Resist (Skill 89)
  // =========================================================================
  describe('8. Summon Resist (Skill 89)', () => {
    it('calculates exact dm12 diminishing curve with 75% cap and excludes Fire Golem fireresist per 0x6FD0C2E0', async () => {
      expect(calculateSummonResistPct(1)).toBe(28)
      expect(calculateSummonResistPct(5)).toBe(47)
      expect(calculateSummonResistPct(10)).toBe(57)
      expect(calculateSummonResistPct(20)).toBe(66)
      expect(calculateSummonResistPct(60)).toBe(75) // Capped at 75%

      const registry = await getSharedDataRegistry()
      const sm = new SummonManager(registry)
      const stats = new UnitStatList(registry)
      stats.setBaseSkillLevel(89, 10) // Summon Resist slvl 10 (+57%)
      const owner: CombatUnitContext = {
        id: 'player',
        name: 'Necro',
        statList: stats,
        stateBus: new StateBus(stats, registry),
      }

      // Summon Fire Golem at slvl 1 (fireAbsorbPct = 36%, innate fireresist = 64%) with Summon Resist slvl 10 (+57%)
      const fgRes = sm.createPet({ owner, skillId: 94, slvl: 1 })
      const fgPet = fgRes.pet!
      // Fire Golem does NOT gain fireresist from Summon Resist (stays at 100 - dm12 = 64%), while cold/light/poison gain +57%
      expect(fgPet.statList.getAccruedStat('fireresist')).toBe(64)
      expect(fgPet.statList.getAccruedStat('coldresist')).toBe(57)
      expect(fgPet.statList.getAccruedStat('lightresist')).toBe(57)
      expect(fgPet.statList.getAccruedStat('poisonresist')).toBe(57)
    })
  })

  // =========================================================================
  // 9. Iron Golem (Skill 90)
  // =========================================================================
  describe('9. Iron Golem (Skill 90)', () => {
    it('calculates innate Thorns reflection (150% + 15%*(slvl-1)) and 35*slvl defense bonus', () => {
      const ig1 = calculateIronGolemStats(1)
      expect(ig1.thornsReturnPct).toBe(150)
      expect(ig1.defenseBonus).toBe(35) // lvl * par8 = 1 * 35
      expect(ig1.defense).toBe(175) // 140 + 35

      const ig10 = calculateIronGolemStats(10)
      expect(ig10.thornsReturnPct).toBe(285) // 150 + 9*15 = 285
      expect(ig10.defenseBonus).toBe(350) // 10*35 = 350
      expect(ig10.defense).toBe(490) // 140 + 350

      const ig20 = calculateIronGolemStats(20)
      expect(ig20.thornsReturnPct).toBe(435) // 150 + 19*15 = 435
      expect(ig20.defenseBonus).toBe(700) // 20*35 = 700
      expect(ig20.defense).toBe(840) // 140 + 700
    })

    it('requires and consumes a metallic ground item (TargetItem=1) and inherits item stats', async () => {
      const item = { baseDamage: 45, defense: 350, auras: [98], isEthereal: true } // Might aura
      const ig = calculateIronGolemStats(5, item)
      expect(ig.inheritedDamage).toBe(45)
      expect(ig.inheritedDefense).toBe(350)
      expect(ig.inheritedAuras).toEqual([98])
      expect(ig.translucentFade).toBe(16)

      const registry = await getSharedDataRegistry()
      const sm = new SummonManager(registry)
      const stats = new UnitStatList(registry)
      const owner: CombatUnitContext = {
        id: 'player',
        name: 'Necro',
        statList: stats,
        stateBus: new StateBus(stats, registry),
      }

      // Rejects when groundItems is empty
      const emptyRes = sm.createPet({ owner, skillId: 90, slvl: 5, groundItems: [] })
      expect(emptyRes.created).toBe(false)
      expect(emptyRes.reason).toBe('invalid_item')

      // Rejects non-metallic item
      const nonMetalRes = sm.createPet({
        owner,
        skillId: 90,
        slvl: 5,
        ironGolemItem: { isMetallic: false, baseDamage: 10 },
      })
      expect(nonMetalRes.created).toBe(false)
      expect(nonMetalRes.reason).toBe('invalid_item')

      // Consumes valid metallic ground item and applies innate resistances (ResLi=50, ResPo=100)
      const groundItems = [{ id: 'metal-sword-1', isMetallic: true, baseDamage: 30, defense: 100, consumed: false }]
      const validRes = sm.createPet({ owner, skillId: 90, slvl: 5, groundItems })
      expect(validRes.created).toBe(true)
      expect(groundItems[0]!.consumed).toBe(true)
      expect(validRes.pet?.statList.getAccruedStat('lightresist')).toBe(50)
      expect(validRes.pet?.statList.getAccruedStat('poisonresist')).toBe(100)
    })
  })

  // =========================================================================
  // 10. Fire Golem (Skill 94)
  // =========================================================================
  describe('10. Fire Golem (Skill 94)', () => {
    it('calculates Holy Fire aura level min(30, 7 + slvl), pulse damage, dm12(25, 100) fire absorb, and 0 death explosion', () => {
      const fg1 = calculateFireGolemStats(1)
      expect(fg1.holyFireAuraLevel).toBe(8) // min(30, 7 + 1) = 8
      expect(fg1.holyFirePulseMin).toBe(4) // Holy Fire lvl 8: (2 + 7*1) >> 1 = 4
      expect(fg1.holyFirePulseMax).toBe(6) // Holy Fire lvl 8: (6 + 7*1) >> 1 = 6
      expect(fg1.meleeFireMin).toBe(34) // 10 + 4*6 = 34
      expect(fg1.meleeFireMax).toBe(63) // 27 + 6*6 = 63
      expect(fg1.fireAbsorbPct).toBe(36) // dm12(25, 100) at slvl 1 = 25 + floor(110*75/700) = 36%
      expect(fg1.fireResist).toBe(64) // 100 - 36 = 64%
      expect(fg1.deathExplosionDmg).toBe(0)

      const fg10 = calculateFireGolemStats(10)
      expect(fg10.holyFireAuraLevel).toBe(17) // min(30, 7 + 10) = 17
      expect(fg10.holyFirePulseMin).toBe(14) // Holy Fire lvl 17: (2 + 7 + 16 + 3) >> 1 = 14
      expect(fg10.holyFirePulseMax).toBe(16) // Holy Fire lvl 17: (6 + 7 + 16 + 3) >> 1 = 16
      expect(fg10.fireAbsorbPct).toBe(76) // dm12(25, 100) at slvl 10 = 25 + floor(1100*75/1600) = 76%
      expect(fg10.fireResist).toBe(24)
      expect(fg10.deathExplosionDmg).toBe(0)

      const fg20 = calculateFireGolemStats(20)
      expect(fg20.holyFireAuraLevel).toBe(27) // min(30, 7 + 20) = 27
      expect(fg20.holyFirePulseMin).toBe(34) // Holy Fire lvl 27: (2 + 7 + 16 + 18 + 25) >> 1 = 34
      expect(fg20.holyFirePulseMax).toBe(36) // Holy Fire lvl 27: (6 + 7 + 16 + 18 + 25) >> 1 = 36
      expect(fg20.fireAbsorbPct).toBe(88) // dm12(25, 100) at slvl 20 = 25 + floor(2200*75/2600) = 88%
      expect(fg20.fireResist).toBe(12)
      expect(fg20.deathExplosionDmg).toBe(0)
    })

    it('emits Holy Fire radial pulse every 50 ticks and heals by fireAbsorbPct when hit by fire', async () => {
      const registry = await getSharedDataRegistry()
      const sm = new SummonManager(registry)
      const stats = new UnitStatList(registry)
      const owner: CombatUnitContext = {
        id: 'player',
        name: 'Necro',
        statList: stats,
        stateBus: new StateBus(stats, registry),
      }

      const fgRes = sm.createPet({ owner, skillId: 94, slvl: 10 })
      const fgPet = fgRes.pet!
      const dummyStats = new UnitStatList(registry, { maxhp: 5000 * FIXED_ONE, hitpoints: 5000 * FIXED_ONE })
      const enemy: CombatUnitContext = {
        id: 'enemy-1',
        name: 'Target Dummy',
        statList: dummyStats,
        stateBus: new StateBus(dummyStats, registry),
      }
      const enemyPositions = new Map([['enemy-1', { x: 10, y: 70 }]])

      const me = new MissileEngine(registry)
      const auraScanner = new AuraScanner(registry)

      // Step at tick 50 (Holy Fire pulse tick)
      const tickRes = sm.tickPets({
        currentTick: 50,
        owner,
        enemies: [enemy],
        enemyPositions,
        missileEngine: me,
        auraScanner,
      })

      expect(tickRes.damageDealt).toBeGreaterThanOrEqual(14)

      // Damage Fire Golem down to 100 HP, then hit it with 100 fire damage -> heals by 76% (76 HP)
      fgPet.statList.setHp256(100 * FIXED_ONE)
      const fireHit = executeSUnitDmg(enemy, fgPet, {
        skillId: 0,
        attackKind: 'spell',
        elemType: 'fire',
        elemMin256: 100 * FIXED_ONE,
        elemMax256: 100 * FIXED_ONE,
        autoHit: true,
      }, { rand: () => 50 })
      expect(fireHit.elemDamage256).toBe(0)
      expect(fgPet.statList.getHp256()).toBe(176 * FIXED_ONE)
    })
  })

  // =========================================================================
  // 11. Revive (Skill 95)
  // =========================================================================
  describe('11. Revive (Skill 95)', () => {
    it('calculates max count = slvl, duration = 4500 frames (180s), multipliers, and caster-level HP clamping', () => {
      expect(calculateReviveMaxCount(1)).toBe(1)
      expect(calculateReviveMaxCount(10)).toBe(10)
      expect(calculateReviveMaxCount(20)).toBe(20)

      const rev0 = calculateReviveStats(1, 0)
      expect(rev0.durationFrames).toBe(4500)
      expect(rev0.hpMultiplier).toBe(3.0) // +200% base (auraastat1='maxhp_percent', par3=200)
      expect(rev0.damageMultiplier).toBe(1.0) // 1.13c Revive has no innate base damage%; only +10%/lvl from Skeleton Mastery
      expect(rev0.velocityBonusPct).toBe(50) // auraastat2='velocitypercent', par4=50

      // Boosted by Skeleton Mastery: +5%/lvl HP and +10%/lvl damage
      const rev10 = calculateReviveStats(1, 10)
      expect(rev10.hpMultiplier).toBe(3.5) // 3.0 + 10 * 0.05
      expect(rev10.damageMultiplier).toBe(2.0) // 1.0 + 10 * 0.10
      expect(rev10.damageBonusPct).toBe(100)

      // 1.13c SKILLS_SrvDo058_Revive (0x6FC71340): casterLevel < monsterLevel clamps base HP proportionally
      // Corpse baseMaxHp = 1000, monsterLevel = 80, casterLevel = 40 -> clampedBaseMaxHp = floor(1000 * 40 / 80) = 500
      // With SM = 10 (hpMultiplier = 3.5): maxHp = floor(500 * 350 / 100) = 1750
      const clampedRev = calculateReviveStats(5, 10, {
        baseMaxHp: 1000,
        monsterLevel: 80,
        casterLevel: 40,
        baseMinDamage: 40,
        baseMaxDamage: 80,
      })
      expect(clampedRev.clampedCorpseBaseHp).toBe(500)
      expect(clampedRev.maxHp).toBe(1750)
      expect(clampedRev.minDamage).toBe(80) // 40 * (100 + 100) / 100
      expect(clampedRev.maxDamage).toBe(160) // 80 * (100 + 100) / 100

      // When casterLevel >= monsterLevel, no clamping occurs
      const unclampedRev = calculateReviveStats(5, 10, {
        baseMaxHp: 1000,
        monsterLevel: 80,
        casterLevel: 85,
      })
      expect(unclampedRev.clampedCorpseBaseHp).toBe(1000)
      expect(unclampedRev.maxHp).toBe(3500)
    })

    it('enforces 1.13c corpse eligibility (MonStats2 revive flag, non-boss/unique/champion/superunique, no re-revive), inherits monster stats/resistances, applies STATE_REVIVE (#96), and deals corpse-scaled melee damage', async () => {
      const registry = await getSharedDataRegistry()
      const sm = new SummonManager(registry)
      const stats = new UnitStatList(registry, { level: 30 })
      stats.setBaseSkillLevel(69, 10) // Skeleton Mastery lvl 10 (+50% HP, +100% dmg)
      stats.setBaseSkillLevel(89, 5) // Summon Resist lvl 5 (+47% all res)
      const owner: CombatUnitContext = {
        id: 'player',
        name: 'Necro',
        charClass: 'nec',
        statList: stats,
        stateBus: new StateBus(stats, registry),
      }

      // 1. Rejects non-revivable corpses (Unique, Champion, SuperUnique, alreadyRevived, MonStats2 revive=0 e.g. doomknight3 classId 312)
      const invalidCorpses = [
        { id: 'c-uniq', consumed: false, baseMaxHp: 500, isUnique: true },
        { id: 'c-champ', consumed: false, baseMaxHp: 500, isChampion: true },
        { id: 'c-suniq', consumed: false, baseMaxHp: 500, isSuperUnique: true },
        { id: 'c-prev', consumed: false, baseMaxHp: 500, alreadyRevived: true },
        { id: 'c-state96', consumed: false, baseMaxHp: 500, states: new Set([96]) },
        { id: 'c-monstats2-no', consumed: false, baseMaxHp: 500, monId: 'maggotegg1' }, // revive=0 in MonStats2.txt
      ]
      const failRes = sm.createPet({ owner, skillId: 95, slvl: 5, corpses: invalidCorpses })
      expect(failRes.created).toBe(false)

      // 2. Revives valid corpse (megademon1 / Balrog, revive=1 in MonStats2.txt), clamping level 60 -> owner level 30
      const balrogCorpse = {
        id: 'c-balrog',
        consumed: false,
        baseMaxHp: 1200,
        monId: 'megademon1',
        monsterLevel: 60,
        minDamage: 50,
        maxDamage: 50,
        defense: 400,
        attackRating: 900,
      }
      const okRes = sm.createPet({ owner, skillId: 95, slvl: 5, corpses: [balrogCorpse] })
      expect(okRes.created).toBe(true)
      expect(balrogCorpse.consumed).toBe(true)
      expect((balrogCorpse as any).alreadyRevived).toBe(true)

      const pet = okRes.pet!
      expect(pet.monId).toBe('megademon1')
      expect(pet.monsterLevel).toBe(30) // clamped from 60 to owner level 30
      expect(pet.statList.getAccruedStat('level')).toBe(30)
      // Clamped base HP: floor(1200 * 30 / 60) = 600; with +200% base + 50% SM = 350% -> 2100 HP
      expect(pet.statList.getMaxHp256()).toBe(2100 * FIXED_ONE)
      expect(pet.statList.getAccruedStat('velocitypercent')).toBe(50)
      expect(pet.statList.getAccruedStat('armorclass')).toBe(400)
      expect(pet.statList.getAccruedStat('tohit')).toBe(900)
      expect(pet.minDamage).toBe(100) // 50 * (100 + 10*10) / 100
      expect(pet.maxDamage).toBe(100)

      // STATE_REVIVE (#96, 'revive') active on revived unit & registered in STATE_COLOR_SHIFTS
      expect(pet.stateBus.hasState('revive')).toBe(true)
      expect(STATE_COLOR_SHIFTS[96]).toEqual({
        stateId: 96,
        priority: 85,
        tintColor: [112, 112, 112],
        paletteRow: 0,
      })

      // Combat tick deals pet's inherited melee damage scaled by Skeleton Mastery (100), NOT (20 + slvl * 10) = 70
      const dummyStats = new UnitStatList(registry, { maxhp: 2000 * FIXED_ONE, hitpoints: 2000 * FIXED_ONE })
      const enemy: CombatUnitContext = {
        id: 'enemy-1',
        name: 'Target Dummy',
        statList: dummyStats,
        stateBus: new StateBus(dummyStats, registry),
      }
      const me = new MissileEngine(registry)
      const auraScanner = new AuraScanner(registry)
      const tickRes = sm.tickPets({
        currentTick: 10,
        owner,
        enemies: [enemy],
        enemyPositions: new Map([['enemy-1', { x: 10, y: 10 }]]),
        missileEngine: me,
        auraScanner,
      })
      expect(tickRes.damageDealt).toBe(100)
    })

    it('applies 12.5% (1/8 MaxHP) life backlash when a Paladin casts Revive via item charges', async () => {
      const registry = await getSharedDataRegistry()
      const sm = new SummonManager(registry)
      const palStats = new UnitStatList(registry, {
        level: 80,
        maxhp: 800 * FIXED_ONE,
        hitpoints: 800 * FIXED_ONE,
      })
      const paladin: CombatUnitContext = {
        id: 'paladin-1',
        name: 'Paladin',
        charClass: 'pal',
        statList: palStats,
        stateBus: new StateBus(palStats, registry),
      }
      const corpses = [{ id: 'c-1', consumed: false, baseMaxHp: 400, monId: 'skeleton1' }]
      const res = sm.createPet({ owner: paladin, skillId: 95, slvl: 20, corpses })
      expect(res.created).toBe(true)
      // 800 - (800 / 8) = 700 HP
      expect(palStats.getHp256()).toBe(700 * FIXED_ONE)
    })

    it('ticks down lifespan and despawns after 4500 frames', async () => {
      const registry = await getSharedDataRegistry()
      const sm = new SummonManager(registry)
      const stats = new UnitStatList(registry)
      const owner: CombatUnitContext = {
        id: 'player',
        name: 'Necro',
        statList: stats,
        stateBus: new StateBus(stats, registry),
      }

      const corpses = [{ id: 'corpse-1', consumed: false, baseMaxHp: 800, isBoss: false }]
      const res = sm.createPet({ owner, skillId: 95, slvl: 1, corpses })
      expect(res.created).toBe(true)
      expect(sm.getActivePets().length).toBe(1)

      const pet = res.pet!
      expect(pet.lifespanTicks).toBe(4500)

      const me = new MissileEngine(registry)
      const auraScanner = new AuraScanner(registry)

      // Set lifespan to 1 tick remaining
      pet.lifespanTicks = 1
      sm.tickPets({
        currentTick: 1,
        owner,
        enemies: [],
        enemyPositions: new Map(),
        missileEngine: me,
        auraScanner,
      })

      // Must be expired and removed from active pets
      expect(sm.getActivePets().length).toBe(0)
    })
  })

  // =========================================================================
  // 12. Golem SkillDesc Tooltips & Client Targeting (Issue #966)
  // =========================================================================
  describe('12. Golem SkillDesc Tooltips & Client Targeting (Issue #966)', () => {
    it('evaluates Golem tooltips with unlearned Golem Mastery = 0, lt=39 damage% scaling, lt=35/41 Fire Golem lines, and blvl-only synergies', () => {
      const nec = createInitialState('nec')
      // Level 1 Clay Golem with unlearned Golem Mastery (0 points)
      nec.hardPoints[75] = 1
      const vmClay1 = buildTooltipViewModel(nec, 75, 99)!
      const clayLife1 = vmClay1.current.effects.find(e => e.lineType === 13)
      const clayAtk1 = vmClay1.current.effects.find(e => e.textEn.startsWith('Attack:'))
      const clayDmg1 = vmClay1.current.effects.find(e => e.lineType === 39)
      expect(clayLife1?.textEn).toBe('Life: 100')
      expect(clayAtk1?.textEn).toBe('Attack: 60')
      expect(clayDmg1?.textEn).toBe('Damage: 2 - 5')

      // Level 10 Clay Golem + 10 Fire Golem hard points (+60% dmg) + +10 All Skills (soft points)
      nec.hardPoints[75] = 10
      nec.hardPoints[94] = 10
      nec.allSkillsSoftPoints = 5 // Clay Golem effLvl = 15, Iron Golem hardPoints = 0 (effLvl = 0)
      const vmClay15 = buildTooltipViewModel(nec, 75, 99)!
      const clayDef15 = vmClay15.current.effects.find(e => e.textEn.startsWith('Defense:'))
      const clayDmg15 = vmClay15.current.effects.find(e => e.lineType === 39)
      // Iron Golem has 0 hard points -> Defense stays at 100
      expect(clayDef15?.textEn).toBe('Defense: 100')
      // Clay Golem effLvl 15: selfDmgPct = 14*35 = 490%, fgBlvl = 10 -> +60%, total = +550%
      // min = floor(2 * 650 / 100) = 13, max = floor(5 * 650 / 100) = 32
      expect(clayDmg15?.textEn).toBe('Damage: 13 - 32')

      // Level 1 Fire Golem (no soft skills) -> Holy Fire Damage: 4 - 6, Fire Damage: 34 - 63
      const necFg = createInitialState('nec')
      necFg.hardPoints[94] = 1
      const vmFg1 = buildTooltipViewModel(necFg, 94, 99)!
      const hfLine = vmFg1.current.effects.find(e => e.lineType === 35)
      const fireLine = vmFg1.current.effects.find(e => e.lineType === 41)
      expect(hfLine?.textEn).toBe('Holy Fire Damage: 4 - 6')
      expect(fireLine?.textEn).toBe('Fire Damage: 34 - 63')
    })

    it('restricts Iron Golem (#90) client CommandMapper targeting strictly to metallic ground items', () => {
      const checkTarget = (unit: Record<string, unknown>) =>
        CommandMapper.prototype.isValidSkillTargetUnit.call({} as any, unit as any, 90, {} as any)

      expect(
        checkTarget({
          id: 101,
          unitType: 'item',
          name: 'Iron Sword',
          itemCode: 'lsd',
          isGold: false,
          mode: 3,
        }),
      ).toBe(true)

      // Rejects leather/cloth/wooden items, gold, monsters, and airborne items
      expect(
        checkTarget({
          id: 102,
          unitType: 'item',
          name: 'Leather Armor',
          itemCode: 'lea',
          isGold: false,
          mode: 3,
        }),
      ).toBe(false)
      expect(
        checkTarget({
          id: 103,
          unitType: 'item',
          name: 'Gold',
          itemCode: 'gld',
          isGold: true,
          mode: 3,
        }),
      ).toBe(false)
      expect(
        checkTarget({
          id: 104,
          unitType: 'item',
          name: 'Iron Sword',
          itemCode: 'lsd',
          isGold: false,
          mode: 5, // airborne
        }),
      ).toBe(false)
      expect(
        checkTarget({
          id: 201,
          unitType: 'monster',
          name: 'Fallen',
          hp: 50,
          isCorpse: false,
        }),
      ).toBe(false)
    })
  })
})
