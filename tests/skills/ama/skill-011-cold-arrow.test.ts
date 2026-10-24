/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #011: Cold Arrow (AMA)
 * Gitea Tracking Issue: #165
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-011-cold-arrow.ts'
import { calculateColdArrowStats } from '../../../src/common/skills/amazon-bow.ts'
import { getSkillRange } from '../../../src/common/skills/weapon-combat-meta.ts'

describe('[Skill #011] Cold Arrow (AMA) — 1.13c Parity (Issue #165)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(11)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(11)
    expect(skillModule.name).toBe("Cold Arrow")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(11, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(3)
    expect(r1.manaCost256).toBe(896)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(768)
    expect(r1.maxElemDmg256).toBe(1024)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(11, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(4)
    expect(r10.manaCost256).toBe(1184)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(5632)
    expect(r10.maxElemDmg256).toBe(5888)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(11, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(5)
    expect(r20.manaCost256).toBe(1504)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(13568)
    expect(r20.maxElemDmg256).toBe(14336)
    expect(r20.durationFrames).toBe(670)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(11)!
    const synId = 21

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(11, 20)
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
    statsSoftOnly.setBaseSkillLevel(11, 20)
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
      skillId: 11,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(11)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateColdArrowStats pure calculations and boundary invariants', () => {
    expect(getSkillRange(11)).toBe(480)

    // Level 1: 3% conversion, srcDam=128, 3-4 cold dmg, 100 frames chill duration, +10% AR, 3.5 mana
    const s1 = calculateColdArrowStats(1)
    expect(s1.physToElemPct).toBe(3)
    expect(s1.srcDam).toBe(128)
    expect(s1.minDamage).toBe(3)
    expect(s1.maxDamage).toBe(4)
    expect(s1.durationFrames).toBe(100)
    expect(s1.toHitBonusPct).toBe(10)
    expect(s1.manaCost).toBe(3.5)
    expect(s1.manaCost256).toBe(896)

    // Level 10: 21% conversion, 22-23 cold dmg, 370 frames chill duration, +91% AR, 4.625 mana
    const s10 = calculateColdArrowStats(10)
    expect(s10.physToElemPct).toBe(21)
    expect(s10.minDamage).toBe(22)
    expect(s10.maxDamage).toBe(23)
    expect(s10.durationFrames).toBe(370)
    expect(s10.toHitBonusPct).toBe(91)
    expect(s10.manaCost).toBe(4.625)
    expect(s10.manaCost256).toBe(1184)

    // Level 20: 41% conversion, 53-56 cold dmg, 670 frames chill duration, +181% AR, 5.875 mana
    const s20 = calculateColdArrowStats(20)
    expect(s20.physToElemPct).toBe(41)
    expect(s20.minDamage).toBe(53)
    expect(s20.maxDamage).toBe(56)
    expect(s20.durationFrames).toBe(670)
    expect(s20.toHitBonusPct).toBe(181)
    expect(s20.manaCost).toBe(5.875)
    expect(s20.manaCost256).toBe(1504)

    // Synergy test: Ice Arrow +12% damage/blvl, +5% chill length/blvl
    const s20Syn = calculateColdArrowStats(20, { iceArrow: 20 })
    expect(s20Syn.synergyBonusPct).toBe(240)
    expect(s20Syn.synergyMultiplier).toBe(3.4)
    expect(s20Syn.lenSynergyMultiplier).toBe(2.0)
    expect(s20Syn.minDamage).toBe(Math.floor(53 * 3.4))
    expect(s20Syn.maxDamage).toBe(Math.floor(56 * 3.4))
    expect(s20Syn.durationFrames).toBe(1340)

    // Monotonicity checks
    for (let lvl = 1; lvl < 30; lvl++) {
      const cur = calculateColdArrowStats(lvl)
      const nxt = calculateColdArrowStats(lvl + 1)
      expect(nxt.minDamage).toBeGreaterThanOrEqual(cur.minDamage)
      expect(nxt.maxDamage).toBeGreaterThanOrEqual(cur.maxDamage)
      expect(nxt.durationFrames).toBeGreaterThan(cur.durationFrames)
      expect(nxt.toHitBonusPct).toBeGreaterThan(cur.toHitBonusPct)
      expect(nxt.manaCost).toBeGreaterThan(cur.manaCost)
    }

    // Boundary resilience
    const sZero = calculateColdArrowStats(0)
    expect(sZero.minDamage).toBe(3)
    expect(sZero.manaCost).toBe(3.5)

    const sNeg = calculateColdArrowStats(-1)
    expect(sNeg.minDamage).toBe(3)

    const sNan = calculateColdArrowStats(NaN)
    expect(sNan.minDamage).toBe(3)

    const sFrac = calculateColdArrowStats(7.2)
    expect(sFrac.minDamage).toBe(calculateColdArrowStats(7).minDamage)
  })
})
