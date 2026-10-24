/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #033: Pierce (AMA)
 * Gitea Tracking Issue: #187
 */
import { describe, expect, it } from 'vitest'
import { resolveUnitPierceTotal, rollMissilePierceIdx } from '../../../src/server/engine/missile-pierce.ts'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-033-pierce.ts'
import { calculatePierceStats } from '../../../src/common/skills/amazon-passive.ts'

describe('[Skill #033] Pierce (AMA) — 1.13c Parity (Issue #187)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(33)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(33)
    expect(skillModule.name).toBe("Pierce")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(33, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(0)
    expect(r1.manaCost256).toBe(0)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(33, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(0)
    expect(r10.manaCost256).toBe(0)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(33, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(0)
    expect(r20.manaCost256).toBe(0)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(1910)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(33)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(33, 20)
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
    statsSoftOnly.setBaseSkillLevel(33, 20)
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
      skillId: 33,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(33)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculatePierceStats pure calculations, caps, and Guided Arrow (#1306) pierce scaling', () => {
    // slvl 1: dm(10, 100, 1) = floor(110*1*90 / (100*7)) + 10 = floor(9900/700) + 10 = 14 + 10 = 24%
    const stats1 = calculatePierceStats(1)
    expect(stats1.chancePct).toBe(24)
    expect(stats1.maxPierceCount).toBe(4)
    expect(stats1.maxHitsPerMissile).toBe(5)
    expect(stats1.isGuidedArrow).toBe(false)
    expect(stats1.manaCost).toBe(0)
    expect(stats1.manaCost256).toBe(0)

    // slvl 10: dm(10, 100, 10) = floor(110*10*90 / (100*16)) + 10 = floor(99000/1600) + 10 = 61 + 10 = 71%
    const stats10 = calculatePierceStats(10)
    expect(stats10.chancePct).toBe(71)

    // slvl 20: dm(10, 100, 20) = floor(110*20*90 / (100*26)) + 10 = floor(198000/2600) + 10 = 76 + 10 = 86%
    const stats20 = calculatePierceStats(20)
    expect(stats20.chancePct).toBe(86)

    // Guided Arrow (skillId === 22) calculates pierce chance using the same dm(10, 100, slvl) curve (#1306):
    const gaPierceLvl1 = calculatePierceStats(1, 22)
    expect(gaPierceLvl1.isGuidedArrow).toBe(true)
    expect(gaPierceLvl1.chancePct).toBe(24)

    const gaPierceLvl20 = calculatePierceStats(20, 22)
    expect(gaPierceLvl20.isGuidedArrow).toBe(true)
    expect(gaPierceLvl20.chancePct).toBe(86)
  })

  it('rolls the 1.13c pierce_idx once at creation from Skills.txt dm12 skill_pierce + item_pierce (Issue #1420)', async () => {
    const registry = await getSharedDataRegistry()
    const arena = new WorldArena({
      registry,
      classCode: 'ama',
      skillId: 6, // Magic Arrow
      slvl: 1,
    })
    arena.player.statList.setBaseSkillLevel(33, 20) // slvl 20 Pierce = 86%
    arena.player.statList.addStat('item_pierce', 9) // +9% -> 95%
    arena.triggerCast()
    const missiles = arena.missileEngine.getActiveMissiles()
    expect(missiles.length).toBeGreaterThanOrEqual(1)
    // Skills.txt Pierce (#33) passivecalc1 = dm12 (10, 100): slvl 20 -> 86, + 9 item_pierce = 95.
    expect(resolveUnitPierceTotal(arena.player, registry)).toBe(95)
    // The cast advanced the caster's base pierce_idx attack counter (`0x6FCEE520`), which seeds the roll (`0x6FC8F660`).
    const seed = arena.player.statList.getBaseStat('pierce_idx')
    expect(seed).toBeGreaterThan(0)
    // Remaining + already consumed pierces (the arena may already have stepped the missile into a target).
    expect(missiles[0]!.pierceIdx + missiles[0]!.pierceCount).toBe(rollMissilePierceIdx(95, seed))
    expect(missiles[0]!.pierceIdx).toBeLessThanOrEqual(4)
  })
})
