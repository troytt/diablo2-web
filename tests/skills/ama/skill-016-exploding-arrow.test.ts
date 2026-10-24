/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #016: Exploding Arrow (AMA)
 * Gitea Tracking Issue: #170
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-016-exploding-arrow.ts'
import { calculateExplodingArrowStats } from '../../../src/common/skills/amazon-bow.ts'

describe('[Skill #016] Exploding Arrow (AMA) — 1.13c Parity (Issue #170)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(16)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(16)
    expect(skillModule.name).toBe("Exploding Arrow")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(16, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(5)
    expect(r1.manaCost256).toBe(1280)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(512)
    expect(r1.maxElemDmg256).toBe(1536)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(16, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(9)
    expect(r10.manaCost256).toBe(2432)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(13056)
    expect(r10.maxElemDmg256).toBe(14592)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(16, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(14)
    expect(r20.manaCost256).toBe(3712)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(33024)
    expect(r20.maxElemDmg256).toBe(38144)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(16)!
    const synId = 7

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(16, 20)
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
    statsSoftOnly.setBaseSkillLevel(16, 20)
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
      skillId: 16,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(16)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateExplodingArrowStats pure calculations and AoE invariants', () => {
    // Level 1: 2-6 blast fire dmg, 80 sub-pixel AoE, +20% AR, 5.0 mana
    const s1 = calculateExplodingArrowStats(1)
    expect(s1.minBlastDamage).toBe(2)
    expect(s1.maxBlastDamage).toBe(6)
    expect(s1.radiusPx).toBe(80)
    expect(s1.toHitBonusPct).toBe(20)
    expect(s1.manaCost).toBe(5.0)

    // Level 10: 51-57 blast fire dmg, +101% AR, 9.5 mana
    const s10 = calculateExplodingArrowStats(10)
    expect(s10.minBlastDamage).toBe(51)
    expect(s10.maxBlastDamage).toBe(57)
    expect(s10.toHitBonusPct).toBe(101)
    expect(s10.manaCost).toBe(9.5)

    // Level 20: 129-149 blast fire dmg, +191% AR, 14.5 mana
    const s20 = calculateExplodingArrowStats(20)
    expect(s20.minBlastDamage).toBe(129)
    expect(s20.maxBlastDamage).toBe(149)
    expect(s20.toHitBonusPct).toBe(191)
    expect(s20.manaCost).toBe(14.5)

    // Synergy test: Fire Arrow +12%/level
    const s20Syn = calculateExplodingArrowStats(20, { fireArrow: 20 })
    expect(s20Syn.synergyBonusPct).toBe(240)
    expect(s20Syn.synergyMultiplier).toBe(3.4)
    expect(s20Syn.minBlastDamage).toBe(Math.floor(129 * 3.4))
    expect(s20Syn.maxBlastDamage).toBe(Math.floor(149 * 3.4))

    // Monotonicity checks
    for (let lvl = 1; lvl < 30; lvl++) {
      const cur = calculateExplodingArrowStats(lvl)
      const nxt = calculateExplodingArrowStats(lvl + 1)
      expect(nxt.minBlastDamage).toBeGreaterThanOrEqual(cur.minBlastDamage)
      expect(nxt.maxBlastDamage).toBeGreaterThanOrEqual(cur.maxBlastDamage)
      expect(nxt.toHitBonusPct).toBeGreaterThan(cur.toHitBonusPct)
      expect(nxt.manaCost).toBeGreaterThan(cur.manaCost)
    }

    // Boundary resilience
    const sZero = calculateExplodingArrowStats(0)
    expect(sZero.minBlastDamage).toBe(2)
    expect(sZero.manaCost).toBe(5.0)

    const sNeg = calculateExplodingArrowStats(-3)
    expect(sNeg.minBlastDamage).toBe(2)

    const sNan = calculateExplodingArrowStats(NaN)
    expect(sNan.minBlastDamage).toBe(2)

    const sFrac = calculateExplodingArrowStats(8.6)
    expect(sFrac.minBlastDamage).toBe(calculateExplodingArrowStats(8).minBlastDamage)
  })

  it('verifies Layer 2 (Issue #960): two-stage explosion (no phys splash), HitFlags=2 item fire/cold merge, AlwaysExplode=1 on wall/expiry, weapon/ammo gates, and Strafe target-clamped volley', async () => {
    const { MissileEngine } = await import('../../../src/server/engine/missile-engine.ts')
    const { StateBus } = await import('../../../src/server/engine/state-bus.ts')
    const { AuraScanner } = await import('../../../src/server/engine/aura-scanner.ts')
    const { SummonManager } = await import('../../../src/server/ai/summon-manager.ts')
    const { evaluateSkill113c, executeSkill113c } = await import('../../../src/server/skills/registry.ts')
    const registry = await getSharedDataRegistry()

    const makeUnit = (id: string, hp = 1000) => {
      const statList = new UnitStatList()
      statList.setHp256(hp * 256)
      statList.addStat('maxhp', hp * 256)
      const stateBus = new StateBus(registry, statList)
      return { id, name: id, statList, stateBus, weaponMinPhys: 100, weaponMaxPhys: 100 }
    }

    const runSkill = (params: {
      skillId: number
      caster: ReturnType<typeof makeUnit> & { weaponItemType?: string; ammoQuantity?: number }
      targets: ReturnType<typeof makeUnit>[]
      targetPositions?: ReadonlyMap<string, { x: number; y: number }>
      missileEngine: InstanceType<typeof MissileEngine>
    }) => {
      const skill = registry.getSkillById(params.skillId)!
      const slvl = params.caster.statList.getEffectiveSkillLevel(params.skillId)
      const blvl = params.caster.statList.getBaseSkillLevel(params.skillId)
      const evalResult = evaluateSkill113c({
        registry,
        skill,
        slvl,
        blvl,
        statList: params.caster.statList,
        stateBus: params.caster.stateBus,
      })
      return executeSkill113c({
        registry,
        skill,
        evalResult,
        caster: params.caster,
        targets: params.targets,
        targetPositions: params.targetPositions ?? new Map(),
        corpses: [],
        missileEngine: params.missileEngine,
        auraScanner: new AuraScanner(registry),
        summonManager: new SummonManager(registry),
        currentTick: 1,
        targetX: 50,
        targetY: 0,
      })
    }

    // 1. Two-stage explosion & HitFlags=2: secondary splash target takes ONLY fire explosion + item flat fire, NEVER weapon phys
    const me = new MissileEngine(registry)
    const caster = makeUnit('ama', 500)
    caster.statList.addStat('firemindam', 10)
    caster.statList.addStat('firemaxdam', 10)
    const primary = makeUnit('m1', 1000)
    const secondary = makeUnit('m2', 1000)
    const positions = new Map([
      ['m1', { x: 18, y: 0 }],
      ['m2', { x: 50, y: 0 }], // within 80px splash of m1, outside direct hitRadius of arrow at x=18
    ])
    me.spawnMissile({
      missileNameOrId: 'explodingarrow',
      sourceSkillId: 16,
      slvl: 10,
      owner: caster,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      dmgPacket: {
        skillId: 16,
        slvl: 10,
        attackKind: 'missile',
        srcDam: 128,
        elemType: 'fire',
        elemMin256: 50 * 256,
        elemMax256: 50 * 256,
        autoHit: true,
      },
    })
    const tickRes = me.tick(1, [primary, secondary], positions)
    const hitPrimary = tickRes.hits.find(h => h.targetId === 'm1')
    const hitSecondary = tickRes.hits.find(h => h.targetId === 'm2')
    expect(hitPrimary?.damage).toBe(100 + 50 + 10) // 100 weapon phys + 50 skill fire + 10 item fire (HitFlags=2)
    expect(hitSecondary?.damage).toBe(50 + 10) // ONLY 50 skill fire + 10 item fire, ZERO weapon phys!
    expect(tickRes.subMissilesSpawned).toContain('explodingarrowexp')

    // 2. AlwaysExplode = 1 on range expiry: Freezing Arrow detonates at max range and freezes nearby target
    const meExpiry = new MissileEngine(registry)
    const nearEndTarget = makeUnit('m_end', 1000)
    caster.statList.setBaseSkillLevel(21, 10) // Ice Arrow blvl=10 -> +50% freeze duration (50 * 1.5 = 75 frames)
    meExpiry.spawnMissile({
      missileNameOrId: 'freezingarrow',
      sourceSkillId: 31,
      slvl: 1,
      owner: caster,
      startX: 0,
      startY: 0,
      targetX: 100,
      targetY: 0,
      maxRangeTicks: 1,
      dmgPacket: {
        skillId: 31,
        slvl: 1,
        attackKind: 'missile',
        srcDam: 128,
        elemType: 'cold',
        elemMin256: 40 * 256,
        elemMax256: 40 * 256,
        autoHit: true,
      },
    })
    const expRes = meExpiry.tick(1, [nearEndTarget], new Map([['m_end', { x: 60, y: 0 }]]))
    expect(expRes.hits.some(h => h.targetId === 'm_end' && h.damage === 40)).toBe(true)
    expect(expRes.subMissilesSpawned).toContain('freezingarrowexp1')
    expect(expRes.subMissilesSpawned).toContain('freezingarrowexp2')
    expect(nearEndTarget.stateBus.getState('freeze')?.durationFrames).toBe(75)

    // 3. Weapon & Ammo gates in SkillRegistry + Magic Arrow noAmmo exemption + Crossbow bolts + Strafe clamping
    const casterNoAmmo = {
      ...makeUnit('ama_bow', 500),
      weaponItemType: 'crossbow',
      ammoQuantity: 0,
    }
    casterNoAmmo.statList.setMana256(500 * 256)
    casterNoAmmo.statList.setBaseSkillLevel(6, 10)
    casterNoAmmo.statList.setBaseSkillLevel(7, 10)
    casterNoAmmo.statList.setBaseSkillLevel(12, 5)
    casterNoAmmo.statList.setBaseSkillLevel(26, 20)

    // Fire Arrow (#7) with 0 ammo -> 'no_ammo'
    const fireNoAmmo = runSkill({
      skillId: 7,
      caster: casterNoAmmo,
      targets: [makeUnit('t1', 500)],
      missileEngine: new MissileEngine(registry),
    })
    expect(fireNoAmmo.executed).toBe(false)
    expect(fireNoAmmo.error).toBe('no_ammo')

    // Magic Arrow (#6) with 0 ammo -> succeeds (noammo=1) and converts 10% phys to magic
    const magicTarget = makeUnit('t_mag', 500)
    magicTarget.statList.addStat('damageresist', 100) // physical immune!
    const magicOk = runSkill({
      skillId: 6,
      caster: casterNoAmmo,
      targets: [magicTarget],
      targetPositions: new Map([['t_mag', { x: 10, y: 0 }]]),
      missileEngine: new MissileEngine(registry),
    })
    expect(magicOk.executed).toBe(true)
    expect(magicOk.totalDamageDealt).toBeGreaterThan(0) // 10% converted to Magic bypasses 100% physical immunity!

    // Crossbow Multiple Shot (#12) & Strafe (#26) with 2 targets -> spawns multipleshotbolt / strafebolt
    casterNoAmmo.ammoQuantity = 10
    const msOut = runSkill({
      skillId: 12,
      caster: casterNoAmmo,
      targets: [makeUnit('t1', 500)],
      missileEngine: new MissileEngine(registry),
    })
    expect(msOut.executed).toBe(true)
    expect(casterNoAmmo.ammoQuantity).toBe(9)
    expect(msOut.missilesSpawned.filter((n: string) => n === 'multipleshotbolt')).toHaveLength(6) // min(24, 1 + 5) = 6

    const strafeMe = new MissileEngine(registry)
    const strafeVolley = strafeMe.spawnStrafeVolley({
      slvl: 20,
      owner: casterNoAmmo,
      startX: 0,
      startY: 0,
      targets: [makeUnit('s1', 500), makeUnit('s2', 500)], // 2 targets, slvl 20 minArrows = 7
      dmgPacket: { skillId: 26, attackKind: 'missile', srcDam: 96 },
      missileName: 'strafebolt',
    })
    expect(strafeVolley).toHaveLength(7) // max(minArrows=7, aliveTargets=2) = 7
  })
})

