/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #027: Immolation Arrow (AMA)
 * Gitea Tracking Issue: #181
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-027-immolation-arrow.ts'
import { calculateImmolationArrowStats } from '../../../src/common/skills/amazon-bow.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'

describe('[Skill #027] Immolation Arrow (AMA) — 1.13c Parity (Issue #181)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(27)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(27)
    expect(skillModule.name).toBe("Immolation Arrow")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(27, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(6)
    expect(r1.manaCost256).toBe(1536)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(3072)
    expect(r1.maxElemDmg256).toBe(5888)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(27, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(10)
    expect(r10.manaCost256).toBe(2688)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(36352)
    expect(r10.maxElemDmg256).toBe(39168)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(27, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(15)
    expect(r20.manaCost256).toBe(3968)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(106496)
    expect(r20.maxElemDmg256).toBe(109312)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(79)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(25)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(27)!
    const synId = 16

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(27, 20)
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
    statsSoftOnly.setBaseSkillLevel(27, 20)
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
      skillId: 27,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(27)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateImmolationArrowStats pure calculations, cooldown, and fire patch invariants', () => {
    // Level 1: 12-23 explosion fire dmg, 75 frames ground fire, 25 frames delay, +30% AR, 6.0 mana
    const s1 = calculateImmolationArrowStats(1)
    expect(s1.minExplosionDamage).toBe(12)
    expect(s1.maxExplosionDamage).toBe(23)
    expect(s1.firePatchDurationFrames).toBe(75)
    expect(s1.cooldownFrames).toBe(25)
    expect(s1.toHitBonusPct).toBe(30)
    expect(s1.manaCost).toBe(6.0)

    // Level 10: 142-153 explosion fire dmg, +111% AR, 10.5 mana
    const s10 = calculateImmolationArrowStats(10)
    expect(s10.minExplosionDamage).toBe(142)
    expect(s10.maxExplosionDamage).toBe(153)
    expect(s10.firePatchDurationFrames).toBe(75)
    expect(s10.cooldownFrames).toBe(25)
    expect(s10.toHitBonusPct).toBe(111)
    expect(s10.manaCost).toBe(10.5)

    // Level 20: 416-427 explosion fire dmg, +201% AR, 15.5 mana
    const s20 = calculateImmolationArrowStats(20)
    expect(s20.minExplosionDamage).toBe(416)
    expect(s20.maxExplosionDamage).toBe(427)
    expect(s20.firePatchDurationFrames).toBe(75)
    expect(s20.cooldownFrames).toBe(25)
    expect(s20.toHitBonusPct).toBe(201)
    expect(s20.manaCost).toBe(15.5)

    // Synergies: Exploding Arrow (+10%/blvl explosion dmg), Fire Arrow (+5%/blvl patch dmg)
    const s20Syn = calculateImmolationArrowStats(20, { explodingArrow: 20, fireArrow: 20 })
    expect(s20Syn.explosionSynergyMultiplier).toBe(3.0) // 1 + 20 * 0.10
    expect(s20Syn.firePatchSynergyMultiplier).toBe(2.0) // 1 + 20 * 0.05
    expect(s20Syn.minExplosionDamage).toBe(Math.floor(416 * 3.0))
    expect(s20Syn.maxExplosionDamage).toBe(Math.floor(427 * 3.0))

    // Monotonicity checks
    for (let lvl = 1; lvl < 30; lvl++) {
      const cur = calculateImmolationArrowStats(lvl)
      const nxt = calculateImmolationArrowStats(lvl + 1)
      expect(nxt.minExplosionDamage).toBeGreaterThanOrEqual(cur.minExplosionDamage)
      expect(nxt.maxExplosionDamage).toBeGreaterThanOrEqual(cur.maxExplosionDamage)
      expect(nxt.toHitBonusPct).toBeGreaterThan(cur.toHitBonusPct)
      expect(nxt.manaCost).toBeGreaterThan(cur.manaCost)
      expect(nxt.cooldownFrames).toBe(25)
      expect(nxt.firePatchDurationFrames).toBe(75)
    }

    // Boundary resilience
    const sZero = calculateImmolationArrowStats(0)
    expect(sZero.minExplosionDamage).toBe(12)
    expect(sZero.manaCost).toBe(6.0)

    const sNeg = calculateImmolationArrowStats(-4)
    expect(sNeg.minExplosionDamage).toBe(12)

    const sNan = calculateImmolationArrowStats(NaN)
    expect(sNan.minExplosionDamage).toBe(12)

    const sFrac = calculateImmolationArrowStats(11.3)
    expect(sFrac.minExplosionDamage).toBe(calculateImmolationArrowStats(11).minExplosionDamage)
  })

  it('#1293: spawns cltmissileb=explodingarrowexp center explosion + radius-3 fire patch on immolationarrow impact, and collides with recently-killed monsters (<= 600ms) for all elemental/magic arrows (#6/#7/#11/#16/#21/#27/#31)', () => {
    const arrowCases: Array<{
      skillId: number
      missileKey: string
      expectedExplosionMissile?: string
      expectedFirePatch?: boolean
    }> = [
      { skillId: 6, missileKey: 'magicarrow', expectedExplosionMissile: 'teethexplode' },
      { skillId: 7, missileKey: 'firearrow', expectedExplosionMissile: 'fireexplode' },
      { skillId: 11, missileKey: 'coldarrow', expectedExplosionMissile: 'iceexplode' },
      { skillId: 16, missileKey: 'explodingarrow', expectedExplosionMissile: 'explodingarrowexp' },
      { skillId: 21, missileKey: 'icearrow', expectedExplosionMissile: 'iceexplode' },
      { skillId: 27, missileKey: 'immolationarrow', expectedExplosionMissile: 'explodingarrowexp', expectedFirePatch: true },
      { skillId: 31, missileKey: 'freezingarrow', expectedExplosionMissile: 'freezingarrowexp1' },
    ]

    for (const tc of arrowCases) {
      const world = new ClientWorld()
      ;(world as any)._timeMs = 1000
      ;(world as any)._monsters.set(700, {
        id: 700,
        unitType: 'monster',
        classId: 1,
        x: 102,
        y: 100,
        dead: true,
        diedAtMs: 800, // died 200ms ago (<= 600ms window)
        states: new Set<number>(),
      })

      const arrow = (world as any).spawnMissileByKey(tc.missileKey, 100, 100, 110, 100, {
        ownerType: 'player',
        ownerId: 1,
        sourceSkillId: tc.skillId,
        skillLevel: 5,
      })

      for (let i = 0; i < 6; i++) {
        if (!(world as any)._units.has(arrow.key)) break
        ;(world as any).stepMissileUnit(arrow)
      }

      // Must have collided with the recently-killed monster at x=102 instead of flying all the way to x=110
      expect((world as any)._units.has(arrow.key), `${tc.missileKey} consumed on impact`).toBe(false)
      expect(arrow.piercedTargets?.has(700), `${tc.missileKey} records pierced target 700`).toBe(true)

      const spawns = Array.from((world as any)._units.values()).filter(
        (u: any) => u.unitType === 'missile' && u.key !== arrow.key,
      )
      if (tc.expectedExplosionMissile) {
        expect(
          spawns.some((u: any) => u.missileKey === tc.expectedExplosionMissile && Math.abs(u.x - 102) < 2),
          `${tc.missileKey} spawns ${tc.expectedExplosionMissile} at monster x=102`,
        ).toBe(true)
      }
      if (tc.expectedFirePatch) {
        const firePatches = spawns.filter((u: any) =>
          ['firewall', 'firesmall', 'firemedium'].includes(u.missileKey),
        )
        expect(firePatches.length).toBeGreaterThanOrEqual(20)
      }
    }

    // Verify old corpses (diedAtMs > 600ms ago) are ignored so arrows fly past them
    const worldOldCorpse = new ClientWorld()
    ;(worldOldCorpse as any)._timeMs = 2000
    ;(worldOldCorpse as any)._monsters.set(701, {
      id: 701,
      unitType: 'monster',
      classId: 1,
      x: 102,
      y: 100,
      dead: true,
      diedAtMs: 1000, // died 1000ms ago (> 600ms window)
      states: new Set<number>(),
    })
    const arrowOverCorpse = (worldOldCorpse as any).spawnMissileByKey('immolationarrow', 100, 100, 120, 100, {
      ownerType: 'player',
      ownerId: 1,
      sourceSkillId: 27,
      skillLevel: 5,
    })
    for (let i = 0; i < 6; i++) {
      if (!(worldOldCorpse as any)._units.has(arrowOverCorpse.key)) break
      ;(worldOldCorpse as any).stepMissileUnit(arrowOverCorpse)
    }
    expect(arrowOverCorpse.piercedTargets?.has(701)).toBe(false)
    expect((worldOldCorpse as any)._units.has(arrowOverCorpse.key)).toBe(true)
  })
})
