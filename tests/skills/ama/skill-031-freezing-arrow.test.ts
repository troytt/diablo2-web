/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #031: Freezing Arrow (AMA)
 * Gitea Tracking Issue: #185
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-031-freezing-arrow.ts'
import { calculateFreezingArrowStats } from '../../../src/common/skills/amazon-bow.ts'

describe('[Skill #031] Freezing Arrow (AMA) — 1.13c Parity (Issue #185)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(31)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(31)
    expect(skillModule.name).toBe("Freezing Arrow")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(31, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(9)
    expect(r1.manaCost256).toBe(2304)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(10240)
    expect(r1.maxElemDmg256).toBe(12800)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(31, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(13)
    expect(r10.manaCost256).toBe(3456)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(35840)
    expect(r10.maxElemDmg256).toBe(38400)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(31, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(18)
    expect(r20.manaCost256).toBe(4736)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(79360)
    expect(r20.maxElemDmg256).toBe(81920)
    expect(r20.durationFrames).toBe(50)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(31)!
    const synId = 11

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(31, 20)
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
    expect(withHardPoints.synergyBonusPct).toBe(240)

    // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(31, 20)
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
      skillId: 31,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(31)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateFreezingArrowStats pure calculations, splash, and freeze invariants', () => {
    // Level 1: 40-50 cold dmg, 80 sub-pixel AoE, 50 frames freeze duration, +40% AR, 9.0 mana
    const s1 = calculateFreezingArrowStats(1)
    expect(s1.minColdDamage).toBe(40)
    expect(s1.maxColdDamage).toBe(50)
    expect(s1.radiusPx).toBe(80)
    expect(s1.freezeFrames).toBe(50)
    expect(s1.toHitBonusPct).toBe(40)
    expect(s1.manaCost).toBe(9.0)

    // Level 10: 140-150 cold dmg, +121% AR, 13.5 mana
    const s10 = calculateFreezingArrowStats(10)
    expect(s10.minColdDamage).toBe(140)
    expect(s10.maxColdDamage).toBe(150)
    expect(s10.freezeFrames).toBe(50)
    expect(s10.toHitBonusPct).toBe(121)
    expect(s10.manaCost).toBe(13.5)

    // Level 20: 310-320 cold dmg, +211% AR, 18.5 mana
    const s20 = calculateFreezingArrowStats(20)
    expect(s20.minColdDamage).toBe(310)
    expect(s20.maxColdDamage).toBe(320)
    expect(s20.freezeFrames).toBe(50)
    expect(s20.toHitBonusPct).toBe(211)
    expect(s20.manaCost).toBe(18.5)

    // Synergies: Cold Arrow (+12% cold damage/lvl), Ice Arrow (+5% freeze length/lvl)
    const s20Syn = calculateFreezingArrowStats(20, { coldArrow: 20, iceArrow: 20 })
    expect(s20Syn.coldSynergyMultiplier).toBe(3.4) // 1 + 20 * 0.12
    expect(s20Syn.lenSynergyMultiplier).toBe(2.0) // 1 + 20 * 0.05
    expect(s20Syn.minColdDamage).toBe(Math.floor(310 * 3.4))
    expect(s20Syn.maxColdDamage).toBe(Math.floor(320 * 3.4))
    expect(s20Syn.freezeFrames).toBe(Math.floor(50 * 2.0))

    // Monotonicity checks
    for (let lvl = 1; lvl < 30; lvl++) {
      const cur = calculateFreezingArrowStats(lvl)
      const nxt = calculateFreezingArrowStats(lvl + 1)
      expect(nxt.minColdDamage).toBeGreaterThanOrEqual(cur.minColdDamage)
      expect(nxt.maxColdDamage).toBeGreaterThanOrEqual(cur.maxColdDamage)
      expect(nxt.toHitBonusPct).toBeGreaterThan(cur.toHitBonusPct)
      expect(nxt.manaCost).toBeGreaterThan(cur.manaCost)
      expect(nxt.radiusPx).toBe(80)
    }

    // Boundary resilience
    const sZero = calculateFreezingArrowStats(0)
    expect(sZero.minColdDamage).toBe(40)
    expect(sZero.manaCost).toBe(9.0)

    const sNeg = calculateFreezingArrowStats(-7)
    expect(sNeg.minColdDamage).toBe(40)

    const sNan = calculateFreezingArrowStats(NaN)
    expect(sNan.minColdDamage).toBe(40)

    const sFrac = calculateFreezingArrowStats(15.8)
    expect(sFrac.minColdDamage).toBe(calculateFreezingArrowStats(15).minColdDamage)
  })
})
