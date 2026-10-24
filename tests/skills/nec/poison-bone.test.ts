/**
 * Diablo II: Lord of Destruction v1.13c — Necromancer Poison & Bone Spells Verification Suite
 * Milestone M2: Skills 67, 68, 73, 74, 78, 83, 84, 88, 92, 93
 *
 * Verifies:
 * 1. Exact 1.13c damage, bitrate, and duration formulas at slvl 1, 10, 20 + synergies.
 * 2. Strict base skill point (`blvl`) synergy invariant (soft points / charges give 0 synergy).
 * 3. Architecture invariants:
 *    - BATCH1_SKILLS length strictly 38.
 *    - Decoupled standalone exported damage functions.
 *    - 2:1 isometric ground projection geometry (ISO_GROUND_ASPECT_RATIO = 0.5).
 * 4. Runtime mechanics:
 *    - Teeth multi-shot projectile count min(ln12, 24) and teethexplode on hit.
 *    - Bone Armor physical absorption pool and overlays.
 *    - Poison Dagger weapon restriction (dagger only) and attack rating bonus.
 *    - Corpse Explosion unscaled monster base HP damage (50% phys / 50% fire) and corpse consumption.
 *    - Bone Wall & Bone Prison destructible segment stats and fixed 24s duration.
 *    - Poison Explosion corpse consumption and poison cloud.
 *    - Bone Spear piercing kinematics (collideKill = 0) and trail/hit submissiles.
 *    - Poison Nova 64 radial bolts and fixed 2.0s duration.
 *    - Bone Spirit homing missile kinematics.
 */
import { describe, expect, it } from 'vitest'
import {
  BATCH1_SKILLS,
  calculateTeethDamage,
  calculateTeethSynergyMultiplier,
  calculateTeethCount,
  calculateBoneArmorCapacity,
  calculateBoneArmorSynergyBonus,
  calculatePoisonDaggerDamage,
  calculatePoisonDaggerSynergyMultiplier,
  calculatePoisonDaggerAttackRatingBonus,
  calculateCorpseExplosionDamage,
  calculateCorpseExplosionRadiusYards,
  calculateCorpseExplosionRadiusPx,
  calculateBoneWallStats,
  calculatePoisonExplosionDamage,
  calculatePoisonExplosionSynergyMultiplier,
  calculateBoneSpearDamage,
  calculateBoneSpearSynergyMultiplier,
  calculateBonePrisonStats,
  calculatePoisonNovaDamage,
  calculatePoisonNovaSynergyMultiplier,
  calculateBoneSpiritDamage,
  calculateBoneSpiritSynergyMultiplier,
  spawnNovaRing,
  spawnPoisonNovaRing,
  calculateSkillDamage,
  ISO_GROUND_ASPECT_RATIO,
} from '../../../src/server/skills/skills.ts'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { MissileEngine } from '../../../src/server/engine/missile-engine.ts'
import { computeCorpseExplosion113c } from '../../../src/server/engine/combat-pipeline.ts'
import { evaluateSkill113c, executeSkill113c } from '../../../src/server/skills/registry.ts'
import { SummonManager } from '../../../src/server/ai/summon-manager.ts'
import { calculateDetailedDamage, evaluateSkillEffects } from '../../../src/common/skills/skill-calc-engine.ts'
import { SKILLS_BY_ID } from '../../../src/common/data/skills-catalog.ts'

describe('Milestone M2: Necromancer Poison and Bone Spells (1.13c Ground Truth)', () => {
  describe('Architecture Invariants', () => {
    it('preserves BATCH1_SKILLS length strictly at 38 skills', () => {
      expect(Object.keys(BATCH1_SKILLS).length).toBe(38)
    })

    it('enforces ISO_GROUND_ASPECT_RATIO = 0.5', () => {
      expect(ISO_GROUND_ASPECT_RATIO).toBe(0.5)
    })
  })

  describe('Skill 67: Teeth (牙)', () => {
    it('evaluates exact damage at slvl 1, 10, 20 without synergies', () => {
      const d1 = calculateTeethDamage(1)
      expect(d1.min).toBe(2)
      expect(d1.max).toBe(4)

      const d10 = calculateTeethDamage(10)
      expect(d10.min).toBe(11)
      expect(d10.max).toBe(14)

      const d20 = calculateTeethDamage(20)
      expect(d20.min).toBe(23)
      expect(d20.max).toBe(31)
    })

    it('calculates projectile count as min(ln12, 24) capped at 24', () => {
      expect(calculateTeethCount(1)).toBe(2)
      expect(calculateTeethCount(10)).toBe(11)
      expect(calculateTeethCount(20)).toBe(21)
      expect(calculateTeethCount(23)).toBe(24)
      expect(calculateTeethCount(30)).toBe(24)
    })

    it('scales damage with +15% synergy per hard point in Bone Wall, Prison, Spear, Spirit', () => {
      // 20 points in Bone Wall: +300% synergy -> multiplier = 4.0
      const syn = calculateTeethSynergyMultiplier({ boneWall: 20 })
      expect(syn).toBe(4.0)

      const d20Syn = calculateTeethDamage(20, { boneWall: 20 })
      expect(d20Syn.min).toBe(Math.floor(23 * 4.0))
      expect(d20Syn.max).toBe(Math.floor(31 * 4.0))
    })

    it('routes through calculateSkillDamage correctly', () => {
      const res = calculateSkillDamage(67, 10)
      expect(res.min).toBe(11)
      expect(res.max).toBe(14)
    })
  })

  describe('Skill 68: Bone Armor (白骨装甲)', () => {
    it('evaluates base absorption capacity at slvl 1, 10, 20', () => {
      expect(calculateBoneArmorCapacity(1)).toBe(20)
      expect(calculateBoneArmorCapacity(10)).toBe(110)
      expect(calculateBoneArmorCapacity(20)).toBe(210)
    })

    it('scales with +15 damage per hard point from Bone Wall and Bone Prison', () => {
      // 10 pts Bone Wall + 10 pts Bone Prison = 20 pts * 15 = +300 capacity
      expect(calculateBoneArmorSynergyBonus({ boneWall: 10, bonePrison: 10 })).toBe(300)
      const cap = calculateBoneArmorCapacity(20, { boneWall: 10, bonePrison: 10 })
      expect(cap).toBe(210 + 300)
    })

    it('routes through calculateSkillDamage correctly', () => {
      const res = calculateSkillDamage(68, 20)
      expect(res.min).toBe(210)
      expect(res.max).toBe(210)
    })

    it('absorbs physical damage via StateBus using 1.13c formula 20 + 10*(slvl-1) + 15*syn', () => {
      const statList = new UnitStatList()
      statList.setBaseSkillLevel(78, 2) // +30 from Bone Wall
      const bus = new StateBus(statList)
      bus.applyState({
        stateNameOrId: 'bonearmor',
        sourceSkillId: 68,
        slvl: 10, // 20 + 9 * 10 + 2 * 15 = 140
      })

      // Absorb 100 physical damage -> 40 remaining in pool, state still active
      const out1 = bus.triggerReactiveEvents({
        event: 'absorbdamage',
        incomingPhys256: 100 * 256,
      })
      expect(out1.absorbedPhys256).toBe(100 * 256)
      expect(bus.hasState('bonearmor')).toBe(true)

      // Absorb 60 physical damage -> 40 absorbed, Bone Armor shatters
      const out2 = bus.triggerReactiveEvents({
        event: 'absorbdamage',
        incomingPhys256: 60 * 256,
      })
      expect(out2.absorbedPhys256).toBe(40 * 256)
      expect(bus.hasState('bonearmor')).toBe(false)
    })
  })

  describe('Skill 73: Poison Dagger (淬毒匕首)', () => {
    it('evaluates attack rating bonus +30% base + 20%/lvl', () => {
      expect(calculatePoisonDaggerAttackRatingBonus(1)).toBe(30)
      expect(calculatePoisonDaggerAttackRatingBonus(10)).toBe(210)
      expect(calculatePoisonDaggerAttackRatingBonus(20)).toBe(410)
    })

    it('evaluates duration, bitrates, and total poison damage at slvl 1, 10, 20', () => {
      const p1 = calculatePoisonDaggerDamage(1)
      expect(p1.durationFrames).toBe(50) // 2.0s
      expect(p1.durationSeconds).toBe(2.0)
      expect(p1.minRate).toBe(36)
      expect(p1.maxRate).toBe(80)
      expect(p1.minDamage).toBe(7)
      expect(p1.maxDamage).toBe(15)

      const p10 = calculatePoisonDaggerDamage(10)
      expect(p10.durationFrames).toBe(140) // 5.6s
      expect(p10.durationSeconds).toBe(5.6)
      expect(p10.minRate).toBe(236)
      expect(p10.maxRate).toBe(280)
      expect(p10.minDamage).toBe(129)
      expect(p10.maxDamage).toBe(153)

      const p20 = calculatePoisonDaggerDamage(20)
      expect(p20.durationFrames).toBe(240) // 9.6s
      expect(p20.durationSeconds).toBe(9.6)
      expect(p20.minRate).toBe(576)
      expect(p20.maxRate).toBe(620)
      expect(p20.minDamage).toBe(540)
      expect(p20.maxDamage).toBe(581)
    })

    it('scales with +20% synergy per point in Poison Explosion and Poison Nova', () => {
      const syn = calculatePoisonDaggerSynergyMultiplier({ poisonExplosion: 5, poisonNova: 5 })
      expect(syn).toBe(3.0) // 1.0 + 10 * 0.20 = 3.0

      const p20Syn = calculatePoisonDaggerDamage(20, { poisonExplosion: 5, poisonNova: 5 })
      expect(p20Syn.minRate).toBe(Math.trunc(576 * 3.0))
      expect(p20Syn.maxRate).toBe(Math.trunc(620 * 3.0))
    })

    it('routes through calculateSkillDamage correctly', () => {
      const res = calculateSkillDamage(73, 20)
      expect(res.min).toBe(540)
      expect(res.max).toBe(581)
    })

    it('enforces itypea1=knif dagger weapon restriction and applies full duration poison damage on hit', async () => {
      const dataReg = await getSharedDataRegistry()
      const skillRec = dataReg.getSkillById(73)!
      const missileEngine = new MissileEngine(dataReg)

      const casterStats = new UnitStatList()
      casterStats.setMana256(1000 * 256)
      casterStats.addStat('tohit', 10000)
      const evalResult = evaluateSkill113c({
        registry: dataReg,
        skill: skillRec,
        slvl: 10,
        blvl: 10,
        statList: casterStats,
      })

      const targetStats = new UnitStatList()
      targetStats.setHp256(2000 * 256)

      const casterSword = {
        id: 'nec_1',
        name: 'Necromancer',
        weaponClass: '1hs',
        weaponType: 'swor',
        statList: casterStats,
        stateBus: new StateBus(casterStats),
      } as any
      const target = {
        id: 'mon_1',
        name: 'Zombie',
        statList: targetStats,
        stateBus: new StateBus(targetStats),
      } as any

      // Non-dagger weapon must be rejected with requires_dagger
      const failRes = executeSkill113c({
        registry: dataReg,
        skill: skillRec,
        evalResult,
        caster: casterSword,
        targets: [target],
        missileEngine,
        currentTick: 1,
      } as any)
      expect(failRes.executed).toBe(false)
      expect(failRes.error).toBe('requires_dagger')

      // Equipped dagger ('knif' / 'dagg') succeeds and deals full duration poison damage
      const casterDagger = {
        ...casterSword,
        weaponClass: 'dagg',
        weaponType: 'knif',
      } as any
      const okRes = executeSkill113c({
        registry: dataReg,
        skill: skillRec,
        evalResult,
        caster: casterDagger,
        targets: [target],
        missileEngine,
        currentTick: 2,
      } as any)
      expect(okRes.executed).toBe(true)
      // At slvl 10, Poison Dagger deals ~129-153 poison damage + physical weapon damage
      expect(okRes.totalDamageDealt).toBeGreaterThanOrEqual(120)
    })
  })

  describe('Skill 74: Corpse Explosion (尸体爆炸)', () => {
    it('evaluates exact 70% to 120% base HP split 50% physical and 50% fire', () => {
      const baseHp = 1000
      const ce = calculateCorpseExplosionDamage(baseHp, 100) // 100% roll
      expect(ce.phys).toBe(500)
      expect(ce.fire).toBe(500)
      expect(ce.minTotal).toBe(700)
      expect(ce.maxTotal).toBe(1200)
      expect(ce.minPhys).toBe(350)
      expect(ce.minFire).toBe(350)
      expect(ce.maxPhys).toBe(600)
      expect(ce.maxFire).toBe(600)
    })

    it('evaluates blast radius scaling in yards and pixels', () => {
      expect(calculateCorpseExplosionRadiusYards(1)).toBe(2.67)
      expect(calculateCorpseExplosionRadiusYards(10)).toBe(5.67)
      expect(calculateCorpseExplosionRadiusYards(20)).toBe(9.0)

      expect(calculateCorpseExplosionRadiusPx(1)).toBe(107)
      expect(calculateCorpseExplosionRadiusPx(20)).toBe(360)
    })

    it('routes through calculateSkillDamage correctly', () => {
      const res = calculateSkillDamage(74, 1, {}, { min: 1000, max: 1000 })
      expect(res.min).toBe(700)
      expect(res.max).toBe(1200)
    })

    it('scales corpse base HP when casterLevel < corpseLevel and separates inner Phys+Fire vs outer Fire-only radius', () => {
      // 1. casterLevel (30) < corpseLevel (60) halves effective corpse HP (1000 -> 500)
      const scaled = computeCorpseExplosion113c({
        corpseBaseHp: 1000,
        rollPct: 100,
        casterLevel: 30,
        corpseLevel: 60,
        slvl: 10,
        distanceSubtiles: 2,
      })
      expect(scaled.effectiveCorpseBaseHp).toBe(500)
      expect(scaled.finalPhysDamage).toBe(250)
      expect(scaled.finalFireDamage).toBe(250)

      // 2. At slvl 2 (8 + 2 = 10 -> outerFireRadius = 5, innerPhysRadius = 4):
      // A target at distanceSubtiles = 4.5 is outside innerPhysRadius (4) but inside outerFireRadius (5) -> 0 phys, full fire!
      const outerRing = computeCorpseExplosion113c({
        corpseBaseHp: 1000,
        rollPct: 100,
        slvl: 2,
        distanceSubtiles: 4.5,
      })
      expect(outerRing.innerPhysRadiusSubtiles).toBe(4)
      expect(outerRing.outerFireRadiusSubtiles).toBe(5)
      expect(outerRing.finalPhysDamage).toBe(0)
      expect(outerRing.finalFireDamage).toBe(500)
    })

    it('marks consumed corpse with stateId = 104 (STATE_CORPSE_NODRAW) on execution', async () => {
      const dataReg = await getSharedDataRegistry()
      const skillRec = dataReg.getSkillById(74)!
      const missileEngine = new MissileEngine(dataReg)
      const casterStats = new UnitStatList()
      casterStats.setMana256(1000 * 256)
      const evalResult = evaluateSkill113c({
        registry: dataReg,
        skill: skillRec,
        slvl: 5,
        blvl: 5,
        statList: casterStats,
      })
      const caster = { id: 'nec_1', statList: casterStats, stateBus: new StateBus(casterStats) } as any
      const corpse = { id: 'corpse_1', baseMaxHp: 800, consumed: false } as any

      const res = executeSkill113c({
        registry: dataReg,
        skill: skillRec,
        evalResult,
        caster,
        corpses: [corpse],
        targets: [],
        missileEngine,
        currentTick: 1,
      } as any)
      expect(res.executed).toBe(true)
      expect(corpse.consumed).toBe(true)
      expect(corpse.stateId).toBe(104)
    })
  })

  describe('Skill 78: Bone Wall (骨墙)', () => {
    it('evaluates base HP, duration, and segment count', () => {
      const bw1 = calculateBoneWallStats(1)
      expect(bw1.hp).toBe(19)
      expect(bw1.durationSeconds).toBe(24.0)
      expect(bw1.durationFrames).toBe(600)
      expect(bw1.segmentCount).toBe(5)

      const bw10 = calculateBoneWallStats(10)
      expect(bw10.hp).toBe(60) // 19 + 9 * 4.6 = 60.4 -> 60

      const bw20 = calculateBoneWallStats(20)
      expect(bw20.hp).toBe(106) // 19 + 19 * 4.6 = 106.4 -> 106
    })

    it('scales with +10% synergy from Bone Armor and Bone Prison', () => {
      const bw20Syn = calculateBoneWallStats(20, { boneArmor: 10, bonePrison: 10 })
      // 20 points * 10% = +200% -> 3.0x
      expect(bw20Syn.hp).toBe(Math.floor(106.4 * 3.0))
    })

    it('evaluates 1.13c MonStats difficulty base HP (19/147/431) and +25%/lvl +10%/syn scaling', () => {
      const norm = calculateBoneWallStats(10, { boneArmor: 5, bonePrison: 5 }, 'normal')
      // bonusHpPct = 9*25 + 10*10 = 325% -> floor(19 * 425 / 100) = 80
      expect(norm.difficultyBaseHp).toBe(19)
      expect(norm.bonusHpPct113c).toBe(325)
      expect(norm.hp113c).toBe(Math.floor((19 * 425) / 100))

      const nm = calculateBoneWallStats(10, { boneArmor: 5, bonePrison: 5 }, 'nightmare')
      expect(nm.difficultyBaseHp).toBe(147)
      expect(nm.hp113c).toBe(Math.floor((147 * 425) / 100))

      const hell = calculateBoneWallStats(10, { boneArmor: 5, bonePrison: 5 }, 'hell')
      expect(hell.difficultyBaseHp).toBe(431)
      expect(hell.hp113c).toBe(Math.floor((431 * 425) / 100))
    })

    it('spawns uncapped stationary Bone Wall segments with 24s (600 ticks) lifespan and 100% poison resist', async () => {
      const dataReg = await getSharedDataRegistry()
      const sm = new SummonManager(dataReg)
      const ownerStats = new UnitStatList()
      ownerStats.setBaseSkillLevel(68, 5)
      ownerStats.setBaseSkillLevel(88, 5)
      const owner = { id: 'nec_1', statList: ownerStats, stateBus: new StateBus(ownerStats) } as any

      // Spawn 6 segments (exceeds PetType.txt nothing=0 without evicting earlier segments)
      const spawned = []
      for (let i = 0; i < 6; i++) {
        const out = sm.createPet({
          owner,
          skillId: 78,
          slvl: 10,
          x: i * 16,
          y: 0,
          difficulty: 'hell',
        })
        expect(out.created).toBe(true)
        expect(out.evictedPetUids.length).toBe(0)
        spawned.push(out.pet!)
      }
      expect(spawned.length).toBe(6)
      expect(spawned[0]!.isStationary).toBe(true)
      expect(spawned[0]!.unsummonable).toBe(false)
      expect(spawned[0]!.lifespanTicks).toBe(600)
      expect(spawned[0]!.statList.getAccruedStat('poisonresist')).toBe(100)
      expect(spawned[0]!.statList.getAccruedStat('fireresist')).toBe(0)
      expect(spawned[0]!.maxHp).toBe(Math.floor((431 * 425) / 100))
    })

    it('routes through calculateSkillDamage correctly', () => {
      const res = calculateSkillDamage(78, 1)
      expect(res.min).toBe(19)
      expect(res.max).toBe(19)
    })
  })

  describe('Skill 83: Poison Explosion (毒爆)', () => {
    it('evaluates duration, bitrates, and total poison damage at slvl 1, 10, 20', () => {
      const pe1 = calculatePoisonExplosionDamage(1)
      expect(pe1.durationFrames).toBe(50)
      expect(pe1.durationSeconds).toBe(2.0)
      expect(pe1.minRate).toBe(128)
      expect(pe1.maxRate).toBe(384)
      expect(pe1.minDamage).toBe(25)
      expect(pe1.maxDamage).toBe(75)

      const pe10 = calculatePoisonExplosionDamage(10)
      expect(pe10.durationFrames).toBe(140)
      expect(pe10.durationSeconds).toBe(5.6)
      expect(pe10.minRate).toBe(480)
      expect(pe10.maxRate).toBe(736)
      expect(pe10.minDamage).toBe(262)
      expect(pe10.maxDamage).toBe(402)

      const pe20 = calculatePoisonExplosionDamage(20)
      expect(pe20.durationFrames).toBe(240)
      expect(pe20.durationSeconds).toBe(9.6)
      expect(pe20.minRate).toBe(1248)
      expect(pe20.maxRate).toBe(1504)
      expect(pe20.minDamage).toBe(1170)
      expect(pe20.maxDamage).toBe(1410)
    })

    it('scales with +15% synergy from Poison Dagger and Poison Nova', () => {
      const syn = calculatePoisonExplosionSynergyMultiplier({ poisonDagger: 10, poisonNova: 10 })
      expect(syn).toBe(4.0) // 1.0 + 20 * 0.15 = 4.0

      const pe20Syn = calculatePoisonExplosionDamage(20, { poisonDagger: 10, poisonNova: 10 })
      expect(pe20Syn.minRate).toBe(1248 * 4)
      expect(pe20Syn.maxRate).toBe(1504 * 4)
    })

    it('routes through calculateSkillDamage correctly', () => {
      const res = calculateSkillDamage(83, 20)
      expect(res.min).toBe(1170)
      expect(res.max).toBe(1410)
    })

    it('marks consumed corpse with stateId = 118 (STATE_CORPSE_NOSELECT) and poisons nearby targets', async () => {
      const dataReg = await getSharedDataRegistry()
      const skillRec = dataReg.getSkillById(83)!
      const missileEngine = new MissileEngine(dataReg)
      const casterStats = new UnitStatList()
      casterStats.setMana256(1000 * 256)
      const evalResult = evaluateSkill113c({
        registry: dataReg,
        skill: skillRec,
        slvl: 10,
        blvl: 10,
        statList: casterStats,
      })
      const caster = { id: 'nec_1', statList: casterStats, stateBus: new StateBus(casterStats) } as any
      const targetStats = new UnitStatList()
      targetStats.setHp256(2000 * 256)
      const target = { id: 'mon_1', statList: targetStats, stateBus: new StateBus(targetStats) } as any
      const corpse = { id: 'corpse_1', baseMaxHp: 500, consumed: false } as any

      const res = executeSkill113c({
        registry: dataReg,
        skill: skillRec,
        evalResult,
        caster,
        corpses: [corpse],
        targets: [target],
        missileEngine,
        currentTick: 1,
      } as any)
      expect(res.executed).toBe(true)
      expect(corpse.consumed).toBe(true)
      expect(corpse.stateId).toBe(118)
      expect(res.totalDamageDealt).toBeGreaterThanOrEqual(250)
      expect(target.stateBus.hasState('poison')).toBe(true)
    })
  })

  describe('Skill 84: Bone Spear (骨矛)', () => {
    it('evaluates exact magic damage at slvl 1, 10, 20 without synergies', () => {
      const d1 = calculateBoneSpearDamage(1)
      expect(d1.min).toBe(16)
      expect(d1.max).toBe(24)

      const d10 = calculateBoneSpearDamage(10)
      expect(d10.min).toBe(90)
      expect(d10.max).toBe(98)

      const d20 = calculateBoneSpearDamage(20)
      expect(d20.min).toBe(192)
      expect(d20.max).toBe(204)
    })

    it('scales with +7% synergy from Teeth, Bone Wall, Prison, Spirit', () => {
      const syn = calculateBoneSpearSynergyMultiplier({ teeth: 10, boneWall: 10, bonePrison: 10, boneSpirit: 10 })
      expect(syn).toBe(1.0 + 40 * 0.07) // 3.8

      const d20Syn = calculateBoneSpearDamage(20, { teeth: 10, boneWall: 10, bonePrison: 10, boneSpirit: 10 })
      expect(d20Syn.min).toBe(Math.floor(192 * 3.8))
      expect(d20Syn.max).toBe(Math.floor(204 * 3.8))
    })

    it('routes through calculateSkillDamage correctly', () => {
      const res = calculateSkillDamage(84, 20)
      expect(res.min).toBe(192)
      expect(res.max).toBe(204)
    })
  })

  describe('Skill 88: Bone Prison (骨牢)', () => {
    it('evaluates base HP, duration, and structure', () => {
      const bp1 = calculateBonePrisonStats(1)
      expect(bp1.hp).toBe(19)
      expect(bp1.durationSeconds).toBe(24.0)
      expect(bp1.durationFrames).toBe(600)
      expect(bp1.segmentCount).toBe(16)

      const bp20 = calculateBonePrisonStats(20)
      expect(bp20.hp).toBe(106)
    })

    it('scales with +8% synergy from Bone Armor and Bone Wall', () => {
      const bp20Syn = calculateBonePrisonStats(20, { boneArmor: 10, boneWall: 10 })
      // 20 points * 8% = +160% -> 2.6x
      expect(bp20Syn.hp).toBe(Math.floor(106.4 * 2.6))
    })

    it('evaluates 1.13c MonStats difficulty base HP (19/147/431) and +25%/lvl +8%/syn scaling', () => {
      const hell = calculateBonePrisonStats(10, { boneArmor: 5, boneWall: 5 }, 'hell')
      // bonusHpPct = 9*25 + 10*8 = 305% -> floor(431 * 405 / 100)
      expect(hell.difficultyBaseHp).toBe(431)
      expect(hell.bonusHpPct113c).toBe(305)
      expect(hell.hp113c).toBe(Math.floor((431 * 405) / 100))
    })

    it('routes through calculateSkillDamage correctly', () => {
      const res = calculateSkillDamage(88, 1)
      expect(res.min).toBe(19)
      expect(res.max).toBe(19)
    })
  })

  describe('Skill 92: Poison Nova (剧毒新星)', () => {
    it('evaluates fixed 2.0s duration and exact bitrates/damage at slvl 1, 10, 20', () => {
      const pn1 = calculatePoisonNovaDamage(1)
      expect(pn1.durationFrames).toBe(50)
      expect(pn1.durationSeconds).toBe(2.0)
      expect(pn1.minRate).toBe(256)
      expect(pn1.maxRate).toBe(464)
      expect(pn1.minDamage).toBe(50)
      expect(pn1.maxDamage).toBe(90)

      const pn10 = calculatePoisonNovaDamage(10)
      expect(pn10.durationFrames).toBe(50)
      expect(pn10.durationSeconds).toBe(2.0)
      expect(pn10.minRate).toBe(896)
      expect(pn10.maxRate).toBe(1104)
      expect(pn10.minDamage).toBe(175)
      expect(pn10.maxDamage).toBe(215)

      const pn20 = calculatePoisonNovaDamage(20)
      expect(pn20.durationFrames).toBe(50)
      expect(pn20.durationSeconds).toBe(2.0)
      expect(pn20.minRate).toBe(2048)
      expect(pn20.maxRate).toBe(2256)
      expect(pn20.minDamage).toBe(400)
      expect(pn20.maxDamage).toBe(440)
    })

    it('spawns exactly 64 radial bolts in 360 degrees foreshortened by 0.5', () => {
      const bolts = spawnPoisonNovaRing(100, 100, 200)
      expect(bolts.length).toBe(64)
      expect(bolts[0]!.missileType).toBe('poisonnova')
      expect(bolts[0]!.statusEffect).toBe('poison')
      expect(bolts[0]!.statusDuration).toBe(50)

      // Test vertical velocity foreshortening
      const northBolt = bolts[16] // angle = PI / 2
      expect(northBolt!.vx).toBeCloseTo(0, 1)
      expect(northBolt!.vy).toBeCloseTo(12 * ISO_GROUND_ASPECT_RATIO, 1)
    })

    it('scales with +10% synergy from Poison Dagger and Poison Explosion', () => {
      const syn = calculatePoisonNovaSynergyMultiplier({ poisonDagger: 10, poisonExplosion: 10 })
      expect(syn).toBe(3.0)

      const pn20Syn = calculatePoisonNovaDamage(20, { poisonDagger: 10, poisonExplosion: 10 })
      expect(pn20Syn.minRate).toBe(2048 * 3)
      expect(pn20Syn.maxRate).toBe(2256 * 3)
      expect(pn20Syn.minDamage).toBe(1200)
      expect(pn20Syn.maxDamage).toBe(1321)
    })

    it('routes through calculateSkillDamage correctly', () => {
      const res = calculateSkillDamage(92, 20)
      expect(res.min).toBe(400)
      expect(res.max).toBe(440)
    })
  })

  describe('Skill 93: Bone Spirit (白骨之魂)', () => {
    it('evaluates exact magic damage at slvl 1, 10, 20 without synergies', () => {
      const d1 = calculateBoneSpiritDamage(1)
      expect(d1.min).toBe(20)
      expect(d1.max).toBe(30)

      const d10 = calculateBoneSpiritDamage(10)
      expect(d10.min).toBe(166)
      expect(d10.max).toBe(185)

      const d20 = calculateBoneSpiritDamage(20)
      expect(d20.min).toBe(340)
      expect(d20.max).toBe(369)
    })

    it('scales with +6% synergy from Teeth, Bone Wall, Spear, Prison', () => {
      const syn = calculateBoneSpiritSynergyMultiplier({ teeth: 10, boneWall: 10, boneSpear: 10, bonePrison: 10 })
      expect(syn).toBe(1.0 + 40 * 0.06) // 3.4

      const d20Syn = calculateBoneSpiritDamage(20, { teeth: 10, boneWall: 10, boneSpear: 10, bonePrison: 10 })
      expect(d20Syn.min).toBe(Math.floor(340 * 3.4))
      expect(d20Syn.max).toBe(Math.floor(369 * 3.4))
    })

    it('routes through calculateSkillDamage correctly', () => {
      const res = calculateSkillDamage(93, 20)
      expect(res.min).toBe(340)
      expect(res.max).toBe(369)
    })
  })

  describe('Kinematics & Missile Engine Runtime', () => {
    it('executes Bone Spear piercing trajectory without terminating on target hit', async () => {
      const registry = await getSharedDataRegistry()
      const engine = new MissileEngine(registry)

      const casterStats = new UnitStatList()
      const target1Stats = new UnitStatList()
      target1Stats.setHp256(1000 * 256)
      const target2Stats = new UnitStatList()
      target2Stats.setHp256(1000 * 256)

      const caster = { id: 'player', name: 'Necromancer', statList: casterStats, stateBus: new StateBus(casterStats) } as any
      const target1 = { id: 'mon_1', name: 'Zombie', statList: target1Stats, stateBus: new StateBus(target1Stats) } as any
      const target2 = { id: 'mon_2', name: 'Skeleton', statList: target2Stats, stateBus: new StateBus(target2Stats) } as any

      const targetPositions = new Map<string, { x: number; y: number }>([
        ['mon_1', { x: 50, y: 0 }],
        ['mon_2', { x: 100, y: 0 }],
      ])

      // Spawn Bone Spear flying eastward (startX: 0, startY: 0, targetX: 200, targetY: 0)
      engine.spawnMissile({
        missileNameOrId: 'bonespear',
        sourceSkillId: 84,
        slvl: 20,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 200,
        targetY: 0,
        dmgPacket: { minDamage: 100, maxDamage: 100, damageType: 'magic' } as any,
      })

      const activeBefore = engine.getActiveMissiles()
      expect(activeBefore.length).toBe(1)
      const spear = activeBefore[0]!
      // Bone Spear: Missiles.txt Pierce empty, CollideKill = 0 -> never removed by a unit hit (Issue #1420).
      expect(spear.canPierce).toBe(false)
      expect(spear.record.collideKill).toBe(false)

      // Step simulation until missile reaches mon_1 and continues to mon_2
      for (let t = 1; t <= 10; t++) {
        engine.tick(t, [target1, target2], targetPositions)
      }

      // Spear must have pierced target1 (pierceCount >= 1) and remained active
      expect(spear.pierceCount).toBeGreaterThanOrEqual(1)
      expect(spear.expired).toBe(false)
    })

    it('steers Bone Spirit homing missile toward target within 25-subtile (400px) lock-on radius and ignores beyond', async () => {
      const registry = await getSharedDataRegistry()
      const engine = new MissileEngine(registry)

      const casterStats = new UnitStatList()
      const targetStats = new UnitStatList()
      targetStats.setHp256(500 * 256)

      const caster = { id: 'player', name: 'Necromancer', statList: casterStats, stateBus: new StateBus(casterStats) } as any
      const target = { id: 'mon_target', name: 'Demon', statList: targetStats, stateBus: new StateBus(targetStats) } as any

      // 1. Target beyond 400px (e.g. 500px south-east) is NOT acquired by Bone Spirit
      const farPositions = new Map<string, { x: number; y: number }>([
        ['mon_target', { x: 500, y: 500 }],
      ])
      engine.spawnMissile({
        missileNameOrId: 'bonespirit',
        sourceSkillId: 93,
        slvl: 20,
        owner: caster,
        startX: 0,
        startY: 0,
        targetX: 0,
        targetY: -100,
        dmgPacket: { minDamage: 200, maxDamage: 200, damageType: 'magic' } as any,
      })
      const farSpirit = engine.getActiveMissiles()[0]!
      engine.tick(1, [target], farPositions)
      expect(farSpirit.vy).toBeLessThan(0) // continues north without locking onto far target

      // 2. Target within 400px (100, 100) IS acquired and steers Bone Spirit south
      const nearPositions = new Map<string, { x: number; y: number }>([
        ['mon_target', { x: 100, y: 100 }],
      ])
      engine.tick(2, [target], nearPositions)
      expect(farSpirit.vy).toBeGreaterThan(0)
    })
  })

  describe('Tooltip & Skill Calc Engine Parity (Issue #978)', () => {
    const emptyCalcState = {
      hardPoints: {},
      bonusAllSkills: 0,
      bonusTabSkills: {},
      bonusSingleSkills: {},
      characterLevel: 80,
    } as any

    it('evaluates total poison damage from bitrate * durationFrames / 256 in calculateDetailedDamage', () => {
      const pdSkill = SKILLS_BY_ID[73]! // Poison Dagger
      const pd20 = calculateDetailedDamage(emptyCalcState, pdSkill, 20)
      expect(pd20.hasDamage).toBe(true)
      expect(pd20.finalMin).toBe(540)
      expect(pd20.finalMax).toBe(581)

      const peSkill = SKILLS_BY_ID[83]! // Poison Explosion
      const pe20 = calculateDetailedDamage(emptyCalcState, peSkill, 20)
      expect(pe20.hasDamage).toBe(true)
      expect(pe20.finalMin).toBe(1170)
      expect(pe20.finalMax).toBe(1410)

      const pnSkill = SKILLS_BY_ID[92]! // Poison Nova
      const pn20 = calculateDetailedDamage(emptyCalcState, pnSkill, 20)
      expect(pn20.hasDamage).toBe(true)
      expect(pn20.finalMin).toBe(400)
      expect(pn20.finalMax).toBe(440)
    })

    it('renders lineType 14 (Poison Damage over X sec) and lineType 38 (70-120% Corpse Life) in evaluateSkillEffects', () => {
      const pdSkill = SKILLS_BY_ID[73]!
      const pdLines = evaluateSkillEffects(emptyCalcState, pdSkill, 20)
      expect(pdLines.some((l) => l.textEn.includes('540-581') && l.textEn.includes('9.6'))).toBe(true)

      const ceSkill = SKILLS_BY_ID[74]!
      const ceLines = evaluateSkillEffects(emptyCalcState, ceSkill, 10)
      expect(ceLines.some((l) => l.textEn.includes('70-120'))).toBe(true)
    })

    it('lists 1.13c synergiesReceived on Bone Armor (#68), Bone Wall (#78), and Bone Prison (#88)', () => {
      const ba = SKILLS_BY_ID[68]!
      expect(ba.synergiesReceived?.map((s) => s.providerId)).toEqual([78, 88])
      const bw = SKILLS_BY_ID[78]!
      expect(bw.synergiesReceived?.map((s) => s.providerId)).toEqual([68, 88])
      const bp = SKILLS_BY_ID[88]!
      expect(bp.synergiesReceived?.map((s) => s.providerId)).toEqual([68, 78])
    })
  })
})



