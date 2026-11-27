/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #021: Ice Arrow (AMA)
 * Gitea Tracking Issue: #175
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-021-ice-arrow.ts'
import { calculateIceArrowStats } from '../../../src/common/skills/amazon-bow.ts'

describe('[Skill #021] Ice Arrow (AMA) — 1.13c Parity (Issue #175)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(21)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(21)
    expect(skillModule.name).toBe("Ice Arrow")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(21, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(4)
    expect(r1.manaCost256).toBe(1024)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(1536)
    expect(r1.maxElemDmg256).toBe(2560)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(21, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(6)
    expect(r10.manaCost256).toBe(1600)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(18432)
    expect(r10.maxElemDmg256).toBe(19968)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(21, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(8)
    expect(r20.manaCost256).toBe(2240)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(55296)
    expect(r20.maxElemDmg256).toBe(59392)
    expect(r20.durationFrames).toBe(145)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(21)!
    const synId = 11

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(21, 20)
    if (synId !== null) {
      statsBase.setBaseSkillLevel(synId, 20)
    }
    const withHardPoints = skillModule.evaluate!({
      registry,
      skill: skillRec,
      slvl: 20,
      blvl: 20,
      statList: statsBase,
    })
    expect(withHardPoints.synergyBonusPct).toBe(160)

    // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(21, 20)
    statsSoftOnly.addStat('item_allskills', 20)
    if (synId !== null) {
      statsSoftOnly.setChargedSkillLevel(synId, 33)
    }
    const withSoftOnly = skillModule.evaluate!({
      registry,
      skill: skillRec,
      slvl: 20,
      blvl: 20,
      statList: statsSoftOnly,
    })
    expect(withSoftOnly.synergyBonusPct).toBe(0)
  })

  it('executes runtime skill effect in WorldArena (castCount, action frame, and combat/state/missile/summon outcome)', async () => {
    const registry = await getSharedDataRegistry()
    const arena = new WorldArena({
      registry,
      classCode: "ama",
      skillId: 21,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(21)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateIceArrowStats pure calculations and freeze invariants', () => {
    // Level 1: 6-10 cold dmg, 50 frames freeze duration, +20% AR, 4.0 mana
    const s1 = calculateIceArrowStats(1)
    expect(s1.minDamage).toBe(6)
    expect(s1.maxDamage).toBe(10)
    expect(s1.freezeFrames).toBe(50)
    expect(s1.toHitBonusPct).toBe(20)
    expect(s1.manaCost).toBe(4.0)

    // Level 10: 72-78 cold dmg, 95 frames freeze duration, +101% AR, 6.25 mana
    const s10 = calculateIceArrowStats(10)
    expect(s10.minDamage).toBe(72)
    expect(s10.maxDamage).toBe(78)
    expect(s10.freezeFrames).toBe(95)
    expect(s10.toHitBonusPct).toBe(101)
    expect(s10.manaCost).toBe(6.25)

    // Level 20: 216-232 cold dmg, 145 frames freeze duration, +191% AR, 8.75 mana
    const s20 = calculateIceArrowStats(20)
    expect(s20.minDamage).toBe(216)
    expect(s20.maxDamage).toBe(232)
    expect(s20.freezeFrames).toBe(145)
    expect(s20.toHitBonusPct).toBe(191)
    expect(s20.manaCost).toBe(8.75)

    // Synergies test: Cold Arrow +8% damage/lvl, Freezing Arrow +5% freeze length/lvl
    const s20Syn = calculateIceArrowStats(20, { coldArrow: 20, freezingArrow: 20 })
    expect(s20Syn.dmgSynergyMultiplier).toBe(2.6) // 1 + 20 * 0.08
    expect(s20Syn.lenSynergyMultiplier).toBe(2.0) // 1 + 20 * 0.05
    expect(s20Syn.minDamage).toBe(Math.floor(216 * 2.6))
    expect(s20Syn.maxDamage).toBe(Math.floor(232 * 2.6))
    expect(s20Syn.freezeFrames).toBe(Math.floor(145 * 2.0))

    // Monotonicity checks
    for (let lvl = 1; lvl < 30; lvl++) {
      const cur = calculateIceArrowStats(lvl)
      const nxt = calculateIceArrowStats(lvl + 1)
      expect(nxt.minDamage).toBeGreaterThanOrEqual(cur.minDamage)
      expect(nxt.maxDamage).toBeGreaterThanOrEqual(cur.maxDamage)
      expect(nxt.freezeFrames).toBeGreaterThan(cur.freezeFrames)
      expect(nxt.toHitBonusPct).toBeGreaterThan(cur.toHitBonusPct)
      expect(nxt.manaCost).toBeGreaterThan(cur.manaCost)
    }

    // Boundary resilience
    const sZero = calculateIceArrowStats(0)
    expect(sZero.minDamage).toBe(6)
    expect(sZero.manaCost).toBe(4.0)

    const sNeg = calculateIceArrowStats(-2)
    expect(sNeg.minDamage).toBe(6)

    const sNan = calculateIceArrowStats(NaN)
    expect(sNan.minDamage).toBe(6)

    const sFrac = calculateIceArrowStats(9.4)
    expect(sFrac.minDamage).toBe(calculateIceArrowStats(9).minDamage)
  })
})
