/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #009: Critical Strike (AMA)
 * Gitea Tracking Issue: #163
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { FIXED_ONE, UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { StateBus } from '../../../src/server/engine/state-bus.ts'
import { executeSUnitDmg, type CombatUnitContext } from '../../../src/server/engine/combat-pipeline.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-009-critical-strike.ts'
import { calculateCriticalStrikeStats } from '../../../src/common/skills/amazon-passive.ts'

describe('[Skill #009] Critical Strike (AMA) — 1.13c Parity (Issue #163)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(9)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(9)
    expect(skillModule.name).toBe("Critical Strike")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(9, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(0)
    expect(r1.manaCost256).toBe(0)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(9, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(0)
    expect(r10.manaCost256).toBe(0)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(9, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(0)
    expect(r20.manaCost256).toBe(0)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(1525)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(9)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(9, 20)
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
    statsSoftOnly.setBaseSkillLevel(9, 20)
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
      skillId: 9,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(9)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateCriticalStrikeStats pure calculations and boundary invariants', () => {
    // slvl 1: dm(5, 80, 1) = floor(110*1*75 / (100*7)) + 5 = floor(8250/700) + 5 = 11 + 5 = 16%
    const stats1 = calculateCriticalStrikeStats(1)
    expect(stats1.chancePct).toBe(16)
    expect(stats1.damageMultiplier).toBe(2.0)
    expect(stats1.manaCost).toBe(0)
    expect(stats1.manaCost256).toBe(0)

    // slvl 10: dm(5, 80, 10) = floor(110*10*75 / (100*16)) + 5 = floor(82500/1600) + 5 = 51 + 5 = 56%
    const stats10 = calculateCriticalStrikeStats(10)
    expect(stats10.chancePct).toBe(56)

    // slvl 20: dm(5, 80, 20) = floor(110*20*75 / (100*26)) + 5 = floor(165000/2600) + 5 = 63 + 5 = 68%
    const stats20 = calculateCriticalStrikeStats(20)
    expect(stats20.chancePct).toBe(68)
  })

  it('doubles physical damage before elemental conversion in executeSUnitDmg and never quadruples with Deadly Strike', () => {
    const atkStats = new UnitStatList(undefined, {
      passive_critical_strike: 68,
      item_deadlystrike: 100,
    })
    const defStats = new UnitStatList(undefined, {
      maxhp: 10000 * FIXED_ONE,
      hitpoints: 10000 * FIXED_ONE,
    })
    const attacker: CombatUnitContext = {
      id: 'ama',
      name: 'Amazon',
      statList: atkStats,
      stateBus: new StateBus(atkStats),
      weaponMinPhys: 100,
      weaponMaxPhys: 100,
    }
    const defender: CombatUnitContext = {
      id: 'mon',
      name: 'Monster',
      statList: defStats,
      stateBus: new StateBus(defStats),
    }

    // 1. Both CS (68%) and DS (100%) active with roll=10: doubles once (200 total, NEVER 400!), before 20% Magic Arrow conversion
    const outBoth = executeSUnitDmg(attacker, defender, {
      skillId: 6,
      attackKind: 'missile',
      srcDam: 128,
      physToElemPct: 20,
      autoHit: true,
      critRoll100: 10,
    }, { rand: () => 10 })
    expect(outBoth.isCritical).toBe(true)
    expect(outBoth.physDamage256).toBe(160 * FIXED_ONE) // 200 * 80% = 160
    expect(outBoth.elemDamage256).toBe(40 * FIXED_ONE)  // 200 * 20% = 40
    expect(outBoth.totalDamage).toBe(200)
  })
})
