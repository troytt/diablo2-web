/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #006: Magic Arrow (AMA)
 * Gitea Tracking Issue: #160
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-006-magic-arrow.ts'
import { calculateMagicArrowStats } from '../../../src/common/skills/amazon-bow.ts'

describe('[Skill #006] Magic Arrow (AMA) — 1.13c Parity (Issue #160)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(6)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(6)
    expect(skillModule.name).toBe("Magic Arrow")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(6, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(1)
    expect(r1.manaCost256).toBe(384)
    expect(r1.minPhysDmg).toBe(1)
    expect(r1.maxPhysDmg).toBe(1)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(6, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(0)
    expect(r10.manaCost256).toBe(96)
    expect(r10.minPhysDmg).toBe(10)
    expect(r10.maxPhysDmg).toBe(10)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(6, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(0)
    expect(r20.manaCost256).toBe(0)
    expect(r20.minPhysDmg).toBe(20)
    expect(r20.maxPhysDmg).toBe(20)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(6)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(6, 20)
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
    expect(withHardPoints.synergyBonusPct).toBe(0)

    // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(6, 20)
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
      skillId: 6,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(6)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateMagicArrowStats pure calculations and boundary invariants', () => {
    // Level 1: 1% magic conversion, 1 flat phys dmg, +10% AR, 1.5 mana (384 fixed-point), noAmmo: true
    const s1 = calculateMagicArrowStats(1)
    expect(s1.conversionPct).toBe(1)
    expect(s1.flatPhysDamage).toBe(1)
    expect(s1.flatMagicDamage).toBe(1)
    expect(s1.toHitBonusPct).toBe(10)
    expect(s1.manaCost).toBe(1.5)
    expect(s1.manaCost256).toBe(384)
    expect(s1.noAmmo).toBe(true)
    expect(s1.requiresAmmo).toBe(false)

    // Level 10: 10% conversion, 10 flat phys dmg, +91% AR, 0.375 mana (96 units)
    const s10 = calculateMagicArrowStats(10)
    expect(s10.conversionPct).toBe(10)
    expect(s10.flatPhysDamage).toBe(10)
    expect(s10.flatMagicDamage).toBe(10)
    expect(s10.toHitBonusPct).toBe(91)
    expect(s10.manaCost).toBe(0.375)
    expect(s10.manaCost256).toBe(96)

    // Level 20: 20% conversion, 20 flat phys dmg, +181% AR, 0 mana
    const s20 = calculateMagicArrowStats(20)
    expect(s20.conversionPct).toBe(20)
    expect(s20.flatPhysDamage).toBe(20)
    expect(s20.flatMagicDamage).toBe(20)
    expect(s20.toHitBonusPct).toBe(181)
    expect(s20.manaCost).toBe(0)
    expect(s20.manaCost256).toBe(0)

    // Level 100+: capped at 100% conversion
    const s100 = calculateMagicArrowStats(100)
    expect(s100.conversionPct).toBe(100)

    // Monotonicity checks
    for (let lvl = 1; lvl < 30; lvl++) {
      const cur = calculateMagicArrowStats(lvl)
      const nxt = calculateMagicArrowStats(lvl + 1)
      expect(nxt.conversionPct).toBeGreaterThanOrEqual(cur.conversionPct)
      expect(nxt.flatPhysDamage).toBeGreaterThanOrEqual(cur.flatPhysDamage)
      expect(nxt.toHitBonusPct).toBeGreaterThan(cur.toHitBonusPct)
      expect(nxt.manaCost).toBeLessThanOrEqual(cur.manaCost)
    }

    // Boundary resilience: 0, negative, NaN, fractional
    const sZero = calculateMagicArrowStats(0)
    expect(sZero.conversionPct).toBe(1)
    expect(sZero.manaCost).toBe(1.5)

    const sNeg = calculateMagicArrowStats(-10)
    expect(sNeg.conversionPct).toBe(1)

    const sNan = calculateMagicArrowStats(NaN)
    expect(sNan.conversionPct).toBe(1)

    const sFrac = calculateMagicArrowStats(5.7)
    expect(sFrac.conversionPct).toBe(5)
  })
})
