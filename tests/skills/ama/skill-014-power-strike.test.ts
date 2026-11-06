/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #014: Power Strike (AMA)
 * Gitea Tracking Issue: #168
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { calculatePowerStrikeStats } from '../../../src/common/skills/amazon-javelin-spear.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-014-power-strike.ts'

describe('[Skill #014] Power Strike (AMA) — 1.13c Parity (Issue #168 / #972)', () => {
  it('computes pure calculatePowerStrikeStats 1.13c formulas (+20+12*(slvl-1)% AR, 5-band lightning + 10%/lvl synergies, 2+0.25*(slvl-1) mana)', () => {
    const p1 = calculatePowerStrikeStats(1)
    expect(p1.toHitBonusPct).toBe(20)
    expect(p1.minDamage).toBe(1)
    expect(p1.maxDamage).toBe(16)
    expect(p1.manaCost).toBe(2)

    const p20 = calculatePowerStrikeStats(20)
    expect(p20.toHitBonusPct).toBe(248)
    expect(p20.minDamage).toBe(1)
    expect(p20.maxDamage).toBe(646)
    expect(p20.manaCost).toBe(6.75)

    const p20Syn = calculatePowerStrikeStats(20, { lightningBolt: 20, chargedStrike: 20 })
    expect(p20Syn.maxDamage).toBe(Math.floor((646 * 500) / 100))
  })

  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(14)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(14)
    expect(skillModule.name).toBe("Power Strike")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(14, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(2)
    expect(r1.manaCost256).toBe(512)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(256)
    expect(r1.maxElemDmg256).toBe(4096)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(14, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(4)
    expect(r10.manaCost256).toBe(1088)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(256)
    expect(r10.maxElemDmg256).toBe(54784)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(14, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(6)
    expect(r20.manaCost256).toBe(1728)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(256)
    expect(r20.maxElemDmg256).toBe(165376)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(14)!
    const synId = 34

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(14, 20)
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
    expect(withHardPoints.synergyBonusPct).toBe(200)

    // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(14, 20)
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
      skillId: 14,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(14)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
    expect(outcome?.notes).toContain('melee_hits:1')
    expect(outcome?.missilesSpawned.length).toBe(0)

    arena.player.weaponItemType = 'bow'
    const blockedBow = arena.triggerCast()
    expect(blockedBow?.executed).toBe(false)
    expect(blockedBow?.error).toBe('invalid_weapon')
  })

  it('verifies ClientWorld Layer 4 (Issue #975): #14 Power Strike attaches lightning tgtoverlay without spawning chargedstrikebolt', async () => {
    const { ClientWorld } = await import('../../../src/client/world/client-world.ts')
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 101, classId: 1, x: 102, y: 100, lifePct: 128, mode: 1 },
    })
    const caster = world.getUnit('player', 1)!
    ;(world as any).spawnMissilesForSkill(caster, 14, 102, 100, 10)
    expect(Array.from(world.units.values()).filter((u) => u.unitType === 'missile').length).toBe(0)
    expect(world.getUnit('monster', 101)!.overlays.some((o) => o.token === 'lightning')).toBe(true)
  })
})


