/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #010: Jab (AMA)
 * Gitea Tracking Issue: #164
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { calculateJabStats } from '../../../src/common/skills/amazon-javelin-spear.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-010-jab.ts'

describe('[Skill #010] Jab (AMA) — 1.13c Parity (Issue #164 / #972)', () => {
  it('computes pure calculateJabStats 1.13c formulas (-15+3*(slvl-1)% ED, +10+9*(slvl-1)% AR, 3 hits, 2+0.25*(slvl-1) mana)', () => {
    const j1 = calculateJabStats(1)
    expect(j1.enhancedDamagePct).toBe(-15)
    expect(j1.toHitBonusPct).toBe(10)
    expect(j1.strikesCount).toBe(3)
    expect(j1.manaCost).toBe(2)

    const j10 = calculateJabStats(10)
    expect(j10.enhancedDamagePct).toBe(12)
    expect(j10.toHitBonusPct).toBe(91)
    expect(j10.strikesCount).toBe(3)
    expect(j10.manaCost).toBe(4.25)

    const j20 = calculateJabStats(20)
    expect(j20.enhancedDamagePct).toBe(42)
    expect(j20.toHitBonusPct).toBe(181)
    expect(j20.strikesCount).toBe(3)
    expect(j20.manaCost).toBe(6.75)
  })

  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(10)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(10)
    expect(skillModule.name).toBe("Jab")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(10, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(2)
    expect(r1.manaCost256).toBe(512)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(10, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(4)
    expect(r10.manaCost256).toBe(1088)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(10, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(6)
    expect(r20.manaCost256).toBe(1728)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(10)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(10, 20)
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
    statsSoftOnly.setBaseSkillLevel(10, 20)
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
      skillId: 10,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(10)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
    expect(outcome?.notes).toContain('melee_hits:3')

    // Weapon guard: equipping a bow blocks Jab
    arena.player.weaponItemType = 'bow'
    const blockedBow = arena.triggerCast()
    expect(blockedBow?.executed).toBe(false)
    expect(blockedBow?.error).toBe('invalid_weapon')
  })

  it('verifies ClientWorld Layer 4 (Issue #975): #10 Jab spawns no client projectile', async () => {
    const { ClientWorld } = await import('../../../src/client/world/client-world.ts')
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    const caster = world.getUnit('player', 1)!
    ;(world as any).spawnMissilesForSkill(caster, 10, 102, 100, 10)
    expect(Array.from(world.units.values()).filter((u) => u.unitType === 'missile').length).toBe(0)
  })
})


