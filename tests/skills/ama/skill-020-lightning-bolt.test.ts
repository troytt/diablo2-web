/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #020: Lightning Bolt (AMA)
 * Gitea Tracking Issue: #174
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { calculateLightningBoltStats } from '../../../src/common/skills/amazon-javelin-spear.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-020-lightning-bolt.ts'

describe('[Skill #020] Lightning Bolt (AMA) — 1.13c Parity (Issue #174 / #972)', () => {
  it('computes pure calculateLightningBoltStats 1.13c formulas (srcDam=96, 100% phys->ltng, 5-band lightning + 3%/lvl synergies, 6+0.25*(slvl-1) mana)', () => {
    const l1 = calculateLightningBoltStats(1)
    expect(l1.srcDam).toBe(96)
    expect(l1.physToElemPct).toBe(100)
    expect(l1.minDamage).toBe(1)
    expect(l1.maxDamage).toBe(40)
    expect(l1.manaCost).toBe(6)

    const l20 = calculateLightningBoltStats(20)
    expect(l20.srcDam).toBe(96)
    expect(l20.minDamage).toBe(1)
    expect(l20.maxDamage).toBe(380)
    expect(l20.manaCost).toBe(10.75)

    const l20Syn = calculateLightningBoltStats(20, { powerStrike: 20, chargedStrike: 20 })
    expect(l20Syn.maxDamage).toBe(Math.floor((380 * 220) / 100))
  })

  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(20)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(20)
    expect(skillModule.name).toBe("Lightning Bolt")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(20, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(6)
    expect(r1.manaCost256).toBe(1536)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(256)
    expect(r1.maxElemDmg256).toBe(10240)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(20, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(8)
    expect(r10.manaCost256).toBe(2112)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(256)
    expect(r10.maxElemDmg256).toBe(40960)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(20, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(10)
    expect(r20.manaCost256).toBe(2752)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(256)
    expect(r20.maxElemDmg256).toBe(97280)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(20)!
    const synId = 34

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(20, 20)
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
    expect(withHardPoints.synergyBonusPct).toBe(60)

    // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(20, 20)
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
      skillId: 20,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(20)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
    expect(outcome?.missilesSpawned).toContain('lightningjavelin')
    expect(dbg.totalDamageDealt).toBeGreaterThan(0)
  })

  it('verifies ClientWorld Layer 4 (Issue #975): #20 Lightning Bolt spawns piercing lightningjavelin with lightninghit trail and lightning overlay on impact', async () => {
    const { ClientWorld } = await import('../../../src/client/world/client-world.ts')
    const world = new ClientWorld()
    world.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    world.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 101, classId: 1, x: 105, y: 100, lifePct: 128, mode: 1 },
    })
    const caster = world.getUnit('player', 1)!
    // Missiles.txt Pierce=1 only marks lightningjavelin pierce-capable; actual piercing needs owner
    // STAT_SKILL_PIERCE (166) / STAT_ITEM_PIERCE (156) (D2Game 0x6FD11420, Issue #1117).
    caster.stats.set(166, 100)
    ;(world as any).spawnMissilesForSkill(caster, 20, 115, 100, 10)
    const lj = Array.from(world.units.values()).find(
      (u) => u.unitType === 'missile' && u.missileKey === 'lightningjavelin',
    )!
    expect(lj).toBeDefined()
    expect(lj.canPierce).toBe(true)
    expect(lj.pierce).toBe(true)
    ;(world as any).stepMissileUnit(lj)
    // lightningjavelin has pCltDoFunc=1 and no CltSubMissile1 in 1.13c Missiles.txt: no in-flight
    // lightninghit trail (that CltDoFunc=8 trail belongs to lightningbolt, Issue #1122).
    expect(
      Array.from(world.units.values()).some(
        (u) => u.unitType === 'missile' && u.missileKey === 'lightninghit',
      ),
    ).toBe(false)
    const hitMon = world.getUnit('monster', 101)!
    ;(world as any).triggerMissileImpact(lj, 105, 100, false, hitMon)
    expect(hitMon.overlays.some((o) => o.token === 'lightning')).toBe(true)
  })
})


