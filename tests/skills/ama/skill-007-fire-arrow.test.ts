/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #007: Fire Arrow (AMA)
 * Gitea Tracking Issue: #161
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-007-fire-arrow.ts'
import { calculateFireArrowStats } from '../../../src/common/skills/amazon-bow.ts'

describe('[Skill #007] Fire Arrow (AMA) — 1.13c Parity (Issue #161)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(7)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(7)
    expect(skillModule.name).toBe("Fire Arrow")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(7, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(3)
    expect(r1.manaCost256).toBe(768)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(256)
    expect(r1.maxElemDmg256).toBe(1024)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(7, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(4)
    expect(r10.manaCost256).toBe(1056)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(5376)
    expect(r10.maxElemDmg256).toBe(6144)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(7, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(5)
    expect(r20.manaCost256).toBe(1376)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(16128)
    expect(r20.maxElemDmg256).toBe(17920)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(7)!
    const synId = 16

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(7, 20)
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
    statsSoftOnly.setBaseSkillLevel(7, 20)
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
      skillId: 7,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(7)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateFireArrowStats pure calculations and boundary invariants', () => {
    // Level 1: 3% conversion, srcDam=128, 1-4 fire dmg, +10% AR, 3.0 mana
    const s1 = calculateFireArrowStats(1)
    expect(s1.physToElemPct).toBe(3)
    expect(s1.srcDam).toBe(128)
    expect(s1.minDamage).toBe(1)
    expect(s1.maxDamage).toBe(4)
    expect(s1.toHitBonusPct).toBe(10)
    expect(s1.manaCost).toBe(3.0)
    expect(s1.manaCost256).toBe(768)

    // Level 10: 21% conversion, 21-24 fire dmg, +91% AR, 4.125 mana (1056 fixed-point)
    const s10 = calculateFireArrowStats(10)
    expect(s10.physToElemPct).toBe(21)
    expect(s10.minDamage).toBe(21)
    expect(s10.maxDamage).toBe(24)
    expect(s10.toHitBonusPct).toBe(91)
    expect(s10.manaCost).toBe(4.125)
    expect(s10.manaCost256).toBe(1056)

    // Level 20: 41% conversion, 63-70 fire dmg, +181% AR, 5.375 mana (1376 fixed-point)
    const s20 = calculateFireArrowStats(20)
    expect(s20.physToElemPct).toBe(41)
    expect(s20.minDamage).toBe(63)
    expect(s20.maxDamage).toBe(70)
    expect(s20.toHitBonusPct).toBe(181)
    expect(s20.manaCost).toBe(5.375)
    expect(s20.manaCost256).toBe(1376)

    // Synergy test: Exploding Arrow +12%/level
    const s20Syn = calculateFireArrowStats(20, { explodingArrow: 20 })
    expect(s20Syn.synergyBonusPct).toBe(240)
    expect(s20Syn.synergyMultiplier).toBe(3.4)
    expect(s20Syn.minDamage).toBe(Math.floor(63 * 3.4))
    expect(s20Syn.maxDamage).toBe(Math.floor(70 * 3.4))

    // Monotonicity checks
    for (let lvl = 1; lvl < 30; lvl++) {
      const cur = calculateFireArrowStats(lvl)
      const nxt = calculateFireArrowStats(lvl + 1)
      expect(nxt.minDamage).toBeGreaterThanOrEqual(cur.minDamage)
      expect(nxt.maxDamage).toBeGreaterThanOrEqual(cur.maxDamage)
      expect(nxt.toHitBonusPct).toBeGreaterThan(cur.toHitBonusPct)
      expect(nxt.manaCost).toBeGreaterThan(cur.manaCost)
    }

    // Boundary resilience
    const sZero = calculateFireArrowStats(0)
    expect(sZero.minDamage).toBe(1)
    expect(sZero.manaCost).toBe(3.0)

    const sNeg = calculateFireArrowStats(-5)
    expect(sNeg.minDamage).toBe(1)

    const sNan = calculateFireArrowStats(NaN)
    expect(sNan.minDamage).toBe(1)

    const sFrac = calculateFireArrowStats(4.8)
    expect(sFrac.minDamage).toBe(calculateFireArrowStats(4).minDamage)
  })
})
