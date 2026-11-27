/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #056: Meteor (SOR)
 * Gitea Tracking Issue: #210 & #401
 *
 * 7-Dimensional Verification Scope:
 * Dimension 1: Static data table parsing (Skills.txt row 56, Missiles.txt IDs 100, 101, 102, 103, 240).
 * Dimension 2: Visual assets & atlas metadata on disk (PNG/JSON exist with non-zero size).
 * Dimension 3: Harmless emitter countdown (60 ticks / 2.40s) without premature contact damage.
 * Dimension 4: Primary detonation damage scaling & synergies (5-band formula: 80-100 base).
 * Dimension 5: Detonation AOE 120px with 2:1 isometric ground ratio (ISO_GROUND_ASPECT_RATIO = 0.5).
 * Dimension 6: 18-offset ground fire geometry and duration scaling (30 + (slvl - 1) * 15 ticks).
 * Dimension 7: Residual ground fire periodic burn damage with NextDelay = 0.
 */
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/sor/skill-056-meteor.ts'
import {
  parseMissilesTxt,
  getMissileTxtData,
  CANONICAL_113C_MISSILES,
  tickProjectiles,
  ISO_GROUND_ASPECT_RATIO,
  calculateMeteorDamage,
  calculateMeteorSynergyMultiplier,
  calculateMeteorResidualFireDamage,
  calculateMeteorDetailedDamage,
  calculateSkillDamage,
  getSkillManaCost,
  getSkillCooldownTicks,
  METEOR_FIRE_SUBTILE_OFFSETS,
  type Projectile,
} from '../../../src/server/skills/skills.ts'
import {
  METEOR_META,
  METEORTAIL_META,
  METEORCENTER_META,
  METEOREXPLODE_META,
  METEORFIRE_META,
  MISSILE_METAS,
} from '../../../src/client/render/missiles-meta.ts'
import type { LoadedMissileArt } from '../../../src/client/scene/missile-overlay-renderer.ts'
import { renderSceneSourceFrame } from '../../../src/client/scene/world-renderer.ts'
import { celFileArtKey } from '../../../src/client/render/cel-file-key.ts'
import { buildSceneDrawables } from '../../../src/client/view/unit-drawables.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import type { SpriteRenderer, AtlasHandle } from '../../../src/client/render/renderer.ts'

describe('[Skill #056] Meteor (SOR) — 1.13c Parity (Issue #210 & #401)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(56)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(56)
    expect(skillModule.name).toBe("Meteor")
    expect(skillModule.charClass).toBe("sor")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(56, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(17)
    expect(r1.manaCost256).toBe(4352)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(20480)
    expect(r1.maxElemDmg256).toBe(25600)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(56, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(21)
    expect(r10.manaCost256).toBe(5504)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(81664)
    expect(r10.maxElemDmg256).toBe(91392)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(56, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(26)
    expect(r20.manaCost256).toBe(6784)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(222464)
    expect(r20.maxElemDmg256).toBe(237312)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(6)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(30)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(56)!
    const synId = 36

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(56, 20)
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
    expect(withHardPoints.synergyBonusPct).toBe(100)

    // +20 allskills and +33 Marrowwalk charges without hard points must yield 0 synergy
    const statsSoftOnly = new UnitStatList()
    statsSoftOnly.setBaseSkillLevel(56, 20)
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
      classCode: "sor",
      skillId: 56,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(56)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  // ==========================================================================
  // 7-Dimensional Verification Suite (Issue #401)
  // ==========================================================================

  it('Dimension 1: Parses authentic 1.13c Missiles.txt & Skills.txt for Meteor suite', async () => {
    const registry = await getSharedDataRegistry()
    const missilesTxtPath = path.resolve(__dirname, '../../../samples/fixtures/data/global/excel/Missiles.txt')
    const missilesTxtContent = fs.readFileSync(missilesTxtPath, 'latin1')
    const map = parseMissilesTxt(missilesTxtContent)

    // meteor (ID 100)
    const meteor = map.get('meteor')
    expect(meteor).toBeDefined()
    expect(meteor!.id).toBe(100)
    expect(meteor!.vel).toBe(0)
    expect(meteor!.range).toBe(60)
    expect(meteor!.celFile.toLowerCase()).toBe('meteor')
    expect(meteor!.animLen).toBe(12)

    // meteorcenter (ID 101)
    const center = map.get('meteorcenter')
    expect(center).toBeDefined()
    expect(center!.id).toBe(101)
    expect(center!.vel).toBe(0)
    expect(center!.range).toBe(60)
    expect(center!.celFile.toLowerCase()).toBe('meteortargetindicator')
    expect(center!.animLen).toBe(17)
    expect(center!.light).toBe(4)
    expect(center!.red).toBe(255)
    expect(center!.green).toBe(64)
    expect(center!.blue).toBe(64)

    // meteortail (ID 102)
    const tail = map.get('meteortail')
    expect(tail).toBeDefined()
    expect(tail!.id).toBe(102)
    expect(tail!.range).toBe(60)
    expect(tail!.celFile.toLowerCase()).toBe('meteortail')
    expect(tail!.animLen).toBe(12)

    // meteorexplode (ID 103)
    const explode = map.get('meteorexplode')
    expect(explode).toBeDefined()
    expect(explode!.id).toBe(103)
    expect(explode!.range).toBe(16)
    expect(explode!.celFile.toLowerCase()).toBe('exparrowexplode')
    expect(explode!.animLen).toBe(16)
    expect(explode!.light).toBe(13)

    // meteorfire (ID 240)
    const fire = map.get('meteorfire')
    expect(fire).toBeDefined()
    expect(fire!.id).toBe(240)
    expect(fire!.celFile.toLowerCase()).toBe('groundfiremedium')
    expect(fire!.animLen).toBe(37)
    expect(fire!.light).toBe(3)

    // Skills.txt metadata specification check
    const skillRec = registry.getSkillById(56)!
    expect(skillRec).toBeDefined()
    expect(skillRec.name).toBe('Meteor')
    expect(skillRec.delay).toBe('30')
    expect(skillRec.mana).toBe(34)
    expect(skillRec.lvlMana).toBe(1)
    expect(skillRec.manaShift).toBe(7)
    expect(skillRec.eMin).toBe(80)
    expect(skillRec.eMax).toBe(100)
    expect(skillRec.srvDoFunc).toBe(28)
    expect(skillRec.castOverlay).toBe('fire_cast_2')

    // Mana cost formula: (34 + (lvl - 1)) * 0.5
    expect(getSkillManaCost(56, 1)).toBe(17)
    expect(getSkillManaCost(56, 10)).toBe(21.5)
    expect(getSkillManaCost(56, 20)).toBe(26.5)
    expect(getSkillCooldownTicks(56)).toBe(30)
  })

  it('Dimension 2: Baked DCC missile atlases and metadata exist on disk with non-zero size', () => {
    expect(METEOR_META.name).toBe('meteor')
    expect(METEOR_META.celFile).toBe('Meteor')
    expect(METEOR_META.framesPerDirection).toBe(12)

    expect(METEORTAIL_META.name).toBe('meteortail')
    expect(METEORTAIL_META.celFile).toBe('MeteorTail')
    expect(METEORTAIL_META.framesPerDirection).toBe(12)

    expect(METEORCENTER_META.name).toBe('meteorcenter')
    expect(METEORCENTER_META.celFile).toBe('MeteorTargetIndicator')
    expect(METEORCENTER_META.framesPerDirection).toBe(17)

    expect(METEOREXPLODE_META.name).toBe('meteorexplode')
    expect(METEOREXPLODE_META.celFile).toBe('ExpArrowExplode')
    expect(METEOREXPLODE_META.framesPerDirection).toBe(16)

    expect(METEORFIRE_META.name).toBe('meteorfire')
    expect(METEORFIRE_META.celFile).toBe('groundFireMedium')
    expect(METEORFIRE_META.framesPerDirection).toBe(37)

    expect(MISSILE_METAS['meteor']).toBe(METEOR_META)
    expect(MISSILE_METAS['meteortail']).toBe(METEORTAIL_META)
    expect(MISSILE_METAS['meteorcenter']).toBe(METEORCENTER_META)
    expect(MISSILE_METAS['meteorexplode']).toBe(METEOREXPLODE_META)
    expect(MISSILE_METAS['meteorfire']).toBe(METEORFIRE_META)

    const missileFiles = ['meteor', 'meteortail', 'meteorcenter', 'meteorexplode', 'meteorfire']
    for (const name of missileFiles) {
      const pngPath = path.resolve(__dirname, `../../../public/missiles/${name}.png`)
      const jsonPath = path.resolve(__dirname, `../../../public/missiles/${name}.json`)
      expect(fs.existsSync(pngPath), `Missing ${pngPath}`).toBe(true)
      expect(fs.statSync(pngPath).size).toBeGreaterThan(1000)
      expect(fs.existsSync(jsonPath), `Missing ${jsonPath}`).toBe(true)
      expect(fs.statSync(jsonPath).size).toBeGreaterThan(100)
    }
  })

  it('Dimension 3: Harmless emitter countdown (60 ticks / 2.40s) without premature contact damage', () => {
    let center: Projectile = {
      skillId: '56',
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      damage: 500,
      ttl: 60, // 2.40s at 25 fps
      fromPlayer: true,
      missileType: 'meteorcenter',
      slvl: 1,
    }

    const dummyMonster = [{ index: 0, x: 300, y: 300, radius: 30, alive: true }]
    const openTerrain = { overlap: () => 0 }

    // Over ticks 1 to 59, meteorcenter must not damage monster despite standing at exact same coordinates
    for (let tick = 1; tick < 60; tick += 1) {
      const outcome = tickProjectiles([center], dummyMonster, openTerrain)
      expect(outcome.hits.length).toBe(0)
      expect(outcome.alive.length).toBe(1)
      center = outcome.alive[0]!
      expect(center.missileType).toBe('meteorcenter')
      expect(center.ttl).toBe(60 - tick)
    }

    // Exactly on tick 60, center expires and detonates
    const finalOutcome = tickProjectiles([center], dummyMonster, openTerrain)
    expect(finalOutcome.expired).toBe(1)
    expect(finalOutcome.hits.length).toBe(1) // monster takes detonation damage on expiry!
    expect(finalOutcome.hits[0]!.damage).toBe(500)
    expect(finalOutcome.hits[0]!.missileType).toBe('meteorexplode')
  })

  it('Dimension 4: Primary detonation damage scaling with 5-band level progression & synergies', () => {
    // slvl 1: 80 - 100
    const d1 = calculateMeteorDamage(1)
    expect(d1.min).toBe(80)
    expect(d1.max).toBe(100)

    // slvl 5: 80 + 4*23 = 172, 100 + 4*25 = 200
    const d5 = calculateMeteorDamage(5)
    expect(d5.min).toBe(172)
    expect(d5.max).toBe(200)

    // slvl 10: 80 + 7*23 + 2*39 = 319, 100 + 7*25 + 2*41 = 357
    const d10 = calculateMeteorDamage(10)
    expect(d10.min).toBe(319)
    expect(d10.max).toBe(357)

    // slvl 20: 80 + 7*23 + 8*39 + 4*79 = 869, 100 + 7*25 + 8*41 + 4*81 = 927
    const d20 = calculateMeteorDamage(20)
    expect(d20.min).toBe(869)
    expect(d20.max).toBe(927)

    // slvl 30: 869 + 2*79 + 6*81 + 2*83 = 1679, 927 + 2*81 + 6*83 + 2*85 = 1757
    const d30 = calculateMeteorDamage(30)
    expect(d30.min).toBe(1679)
    expect(d30.max).toBe(1757)

    // Synergies:
    // Fire Bolt: 20 pts (+100% = 2.0x)
    const syn20 = calculateMeteorSynergyMultiplier({ fireBolt: 20 })
    expect(syn20).toBe(2.0)
    const d20Syn = calculateMeteorDamage(20, { fireBolt: 20 })
    expect(d20Syn.min).toBe(1738) // 869 * 2.0
    expect(d20Syn.max).toBe(1854) // 927 * 2.0

    // Full synergies: Fire Bolt 20, Fire Ball 20 (+200% = 3.0x)
    const syn40 = calculateMeteorSynergyMultiplier({ fireBolt: 20, fireBall: 20 })
    expect(syn40).toBe(3.0)
    const d20Full = calculateMeteorDamage(20, { fireBolt: 20, fireBall: 20 })
    expect(d20Full.min).toBe(2607) // 869 * 3.0
    expect(d20Full.max).toBe(2781) // 927 * 3.0

    // Generic calculateSkillDamage router checks
    expect(calculateSkillDamage(56, 1)).toEqual(d1)
    expect(calculateSkillDamage('56', 10)).toEqual(d10)
    expect(calculateSkillDamage('meteor', 20)).toEqual(d20)
  })

  it('Dimension 5: Detonation AOE 120px with 2:1 isometric ground foreshortening', () => {
    // 6 subtiles = 120px ground radius.
    // In 2:1 isometric projection: ellipse is dx^2 + (dy / 0.5)^2 <= 120^2.
    const center: Projectile = {
      skillId: '56',
      x: 200,
      y: 200,
      vx: 0,
      vy: 0,
      damage: 400,
      ttl: 0, // detonates immediately on tick
      fromPlayer: true,
      missileType: 'meteorcenter',
      slvl: 1,
    }

    const monsters = [
      { index: 1, x: 200, y: 250, radius: 10, alive: true }, // dx=0, dy=50: dy/0.5 = 100 <= 120 (INSIDE)
      { index: 2, x: 200, y: 310, radius: 10, alive: true }, // dx=0, dy=110: dy/0.5 = 220 > 120 (OUTSIDE)
      { index: 3, x: 300, y: 200, radius: 10, alive: true }, // dx=100, dy=0: dx = 100 <= 120 (INSIDE)
      { index: 4, x: 330, y: 200, radius: 10, alive: true }, // dx=130, dy=0: dx = 130 > 120 (OUTSIDE)
    ]

    const outcome = tickProjectiles([center], monsters, { overlap: () => 0 })
    expect(outcome.hits.length).toBe(2)
    const hitIndices = outcome.hits.map(h => h.targetIndex)
    expect(hitIndices).toContain(1)
    expect(hitIndices).toContain(3)
    expect(hitIndices).not.toContain(2)
    expect(hitIndices).not.toContain(4)

    // Visual meteorexplode missile spawned
    expect(outcome.spawnedProjectiles?.some(p => p.missileType === 'meteorexplode')).toBe(true)
  })

  it('Dimension 6: 18-offset ground fire geometry and duration scaling (30 + (slvl-1)*15)', () => {
    expect(METEOR_FIRE_SUBTILE_OFFSETS.length).toBe(18)

    // Check specific cardinal offsets from D2Game.dll 0x6FD1C918 and 0x6FD1C8D0
    expect(METEOR_FIRE_SUBTILE_OFFSETS[3]).toEqual({ x: 0, y: 5 })   // North Tip
    expect(METEOR_FIRE_SUBTILE_OFFSETS[11]).toEqual({ x: -4, y: -2 }) // West Tip
    expect(METEOR_FIRE_SUBTILE_OFFSETS[14]).toEqual({ x: 0, y: -4 })  // South Tip
    expect(METEOR_FIRE_SUBTILE_OFFSETS[17]).toEqual({ x: 4, y: -2 })  // East Tip

    // Verify duration scaling: slvl 1: 30 ticks; slvl 10: 165 ticks; slvl 20: 315 ticks
    const centerSlvl10: Projectile = {
      skillId: '56',
      x: 100,
      y: 100,
      vx: 0,
      vy: 0,
      damage: 300,
      ttl: 0,
      fromPlayer: true,
      missileType: 'meteorcenter',
      slvl: 10,
    }

    const outcome10 = tickProjectiles([centerSlvl10], [], { overlap: () => 0 })
    const flames10 = outcome10.spawnedProjectiles?.filter(p => p.missileType === 'meteorfire') ?? []
    expect(flames10.length).toBe(18)
    for (const f of flames10) {
      expect(f.ttl).toBe(90 + 9 * 15) // 225 ticks = 9.00 seconds
      expect(f.pierce).toBe(true)
    }

    // Verify wall collision filtering: flames inside walls are suppressed
    const outcomeWall = tickProjectiles([centerSlvl10], [], {
      overlap: (x, y) => (x > 140 ? 1 : 0), // wall on eastern side
    })
    const flamesWall = outcomeWall.spawnedProjectiles?.filter(p => p.missileType === 'meteorfire') ?? []
    expect(flamesWall.length).toBeLessThan(18)
    expect(flamesWall.every(f => f.x <= 140)).toBe(true)
  })

  it('Dimension 7: Residual ground fire periodic burn damage with NextDelay = 0', () => {
    // Residual fire formulas
    const res1 = calculateMeteorResidualFireDamage(1)
    expect(res1.min).toBe(15)
    expect(res1.max).toBe(25)
    expect(res1.perSecMin).toBe(11) // floor(15 * 200 / 256)
    expect(res1.perSecMax).toBe(19) // floor(25 * 200 / 256)

    const res10 = calculateMeteorResidualFireDamage(10)
    expect(res10.min).toBe(53)
    expect(res10.max).toBe(63)
    expect(res10.perSecMin).toBe(41)
    expect(res10.perSecMax).toBe(49)

    const res20 = calculateMeteorResidualFireDamage(20)
    expect(res20.min).toBe(107)
    expect(res20.max).toBe(117)
    expect(res20.perSecMin).toBe(83)
    expect(res20.perSecMax).toBe(91)

    // Detailed damage breakdown
    const detailed = calculateMeteorDetailedDamage(20, { fireBolt: 20 })
    expect(detailed.impactFire.min).toBe(1738)
    expect(detailed.impactPhys.min).toBe(0) // 1.13c vanilla has 0 physical damage
    expect(detailed.residualFire.min).toBe(107)

    // Optional physical split support (e.g. 50/50 mod support)
    const splitDetailed = calculateMeteorDetailedDamage(20, {}, { physRatio: 0.5 })
    expect(splitDetailed.impactFire.min).toBe(434)
    expect(splitDetailed.impactPhys.min).toBe(434)

    // Simulation of residual flame patch over 10 ticks
    let flame: Projectile = {
      skillId: '56',
      x: 100,
      y: 100,
      vx: 0,
      vy: 0,
      damage: 20,
      ttl: 30,
      fromPlayer: true,
      missileType: 'meteorfire',
      pierce: true,
    }

    const dummyMonster = [{ index: 5, x: 100, y: 100, radius: 15, alive: true }]
    let hitCount = 0

    for (let t = 1; t <= 10; t += 1) {
      const outcome = tickProjectiles([flame], dummyMonster, { overlap: () => 0 })
      flame = outcome.alive[0]!
      hitCount += outcome.hits.length
    }

    // Over 10 ticks with 5-tick periodic burn cadence, monster is damaged 3 times (tick 1, 5, 10)
    expect(hitCount).toBe(3)
    expect(flame.ttl).toBe(20) // remains alive, doesn't vanish on hit
  })

  it('Dimension 8: Dual Sprite Falling Trajectory & Trans Blending in renderSceneSourceFrame', () => {
    const drawCalls: { frame: any; x: number; y: number; options?: any }[] = []
    const mockRenderer = {
      begin: () => {},
      flush: () => {},
      setLighting: () => {},
      setUnitLight: () => {},
      draw(frame: any, x: number, y: number, options?: any) {
        drawCalls.push({ frame, x, y, options })
      },
      drawSolid: vi.fn(),
    } as unknown as SpriteRenderer

    // Build mock art map for meteor, meteortail, meteorcenter keyed by normalised CelFile
    const makeMockArt = (meta: any): LoadedMissileArt => ({
      meta,
      handle: 1 as unknown as AtlasHandle,
      frames: [
        meta.groups[0].map(([x, y, w, h, ax, ay]: number[]) => ({
          x,
          y,
          width: w,
          height: h,
          anchorX: ax,
          anchorY: ay,
        })),
      ],
    })

    const artMap = new Map<string, LoadedMissileArt>([
      [celFileArtKey('Meteor'), makeMockArt(METEOR_META)],
      [celFileArtKey('MeteorTail'), makeMockArt(METEORTAIL_META)],
      [celFileArtKey('MeteorTargetIndicator'), makeMockArt(METEORCENTER_META)],
    ])

    const sceneAtRemainingTicks = (remainingTicks: number) => {
      const missileDrawables: any[] = [
        {
          drawableKind: 'missile',
          unitId: 1,
          missileClassId: 101,
          missileKey: 'meteorcenter',
          celFile: 'MeteorTargetIndicator',
          direction: 0,
          frame: 0,
          totalFrames: 17,
          loopAnim: true,
          subX: 0,
          subY: 0,
          worldX: 400,
          worldY: 300,
          sortY: 300,
          blendMode: 'additive',
          trans: 1,
          lightRadius: 0,
          lightColor: [0, 0, 0],
        },
      ]
      if (remainingTicks > 0) {
        const fallAltitude = remainingTicks * 25
        const meteorX = 400 - remainingTicks * 15
        missileDrawables.push(
          {
            drawableKind: 'missile',
            unitId: 2,
            missileClassId: 103,
            missileKey: 'meteortail',
            celFile: 'MeteorTail',
            direction: 0,
            frame: 0,
            totalFrames: 12,
            loopAnim: true,
            altitude: fallAltitude,
            subX: 0,
            subY: 0,
            worldX: meteorX,
            worldY: 300,
            sortY: 300 + fallAltitude - 0.5,
            blendMode: 'additive',
            trans: 1,
            lightRadius: 0,
            lightColor: [0, 0, 0],
          },
          {
            drawableKind: 'missile',
            unitId: 3,
            missileClassId: 100,
            missileKey: 'meteor',
            celFile: 'Meteor',
            direction: 0,
            frame: 0,
            totalFrames: 10,
            loopAnim: true,
            altitude: fallAltitude,
            subX: 0,
            subY: 0,
            worldX: meteorX,
            worldY: 300,
            sortY: 300 + fallAltitude,
            blendMode: 'normal',
            trans: 0,
            lightRadius: 0,
            lightColor: [0, 0, 0],
          },
        )
      }
      renderSceneSourceFrame({
        renderer: mockRenderer,
        cameraX: 400,
        cameraY: 300,
        viewportProfile: { width: 4000, height: 4000 },
        missileDrawables,
        missileArtMap: artMap,
      } as any)
    }

    // Tick 0 (ttl = 60): Ground indicator + falling tail + fireball core at altitude 1500px, slideX -900px
    sceneAtRemainingTicks(60)
    expect(drawCalls.length).toBe(3) // 1 ground indicator, 1 flame tail, 1 meteor core

    // 1. Ground target indicator (MeteorTargetIndicator)
    expect(drawCalls[0]!.options?.blendMode).toBe('additive')
    expect(drawCalls[0]!.x).toBe(400 - 56) // anchorX = -56
    expect(drawCalls[0]!.y).toBe(300 - 43) // anchorY = -43

    // 2. Atmospheric flame tail (MeteorTail)
    expect(drawCalls[1]!.options?.blendMode).toBe('additive')
    // slideX = -60 * 15 = -900 -> meteorX = 400 - 900 = -500; anchorX = -49 -> drawX = -549
    expect(drawCalls[1]!.x).toBe(400 - 60 * 15 - 49)
    // altitude = 60 * 25 = 1500 -> meteorY = 300 - 143 - 1500 = -1343
    expect(drawCalls[1]!.y).toBe(300 - 143 - 60 * 25)

    // 3. Falling meteor rock (Meteor): Missiles.txt #100 Trans empty -> eDrawMode 5 NORMAL (D2Client 0x6FB1CF3B)
    expect(drawCalls[2]!.options?.blendMode).toBe('normal')
    expect(drawCalls[2]!.x).toBe(400 - 60 * 15 - 7) // anchorX = -7
    expect(drawCalls[2]!.y).toBe(300 - 55 - 60 * 25) // anchorY = -55

    // Tick 30 (ttl = 30): Mid-flight descent (altitude = 750px, slideX = -450px)
    drawCalls.length = 0
    sceneAtRemainingTicks(30)
    expect(drawCalls.length).toBe(3)
    expect(drawCalls[1]!.x).toBe(400 - 30 * 15 - 49)
    expect(drawCalls[1]!.y).toBe(300 - 143 - 30 * 25)
    expect(drawCalls[2]!.x).toBe(400 - 30 * 15 - 7)
    expect(drawCalls[2]!.y).toBe(300 - 55 - 30 * 25)

    // Tick 60 (ttl = 0 / impact): Falling fireball hits ground, only ground indicator rendered
    drawCalls.length = 0
    sceneAtRemainingTicks(0)
    expect(drawCalls.length).toBe(1) // Only ground indicator, zero sky fireball
  })

  it('Dimension 9: Animation frame indexing progression for meteorcenter and meteorfire sublooping', () => {
    const world = new ClientWorld()

    // 1. meteorcenter starts at frame 0 and advances forward at AnimSpeed=16 (1 frame/tick, 17 frames)
    const centerUnit = (world as any).spawnMissileByKey('meteorcenter', 100, 100, 100, 100, {
      sourceSkillId: 56,
      skillLevel: 1,
    })
    for (let elapsed = 0; elapsed < 17; elapsed++) {
      expect(centerUnit.frame).toBe(elapsed)
      ;(world as any).stepMissileUnit(centerUnit)
    }

    // 2. meteorfire plays emergence once (frames 0..11) then subloops 12..36 (Missiles.txt SubLoop=1, SubStart=12, SubStop=36)
    const fireUnit = (world as any).spawnMissileByKey('meteorfire', 100, 100, 100, 100, {
      sourceSkillId: 56,
      skillLevel: 20,
      maxTicks: 315,
    })
    for (let elapsed = 0; elapsed < 12; elapsed++) {
      expect(fireUnit.frame).toBe(elapsed)
      ;(world as any).stepMissileUnit(fireUnit)
    }
    const phaseOffset = (fireUnit.id * 7) % 24
    for (let elapsed = 12; elapsed <= 70; elapsed++) {
      const expectedFrame = 12 + ((elapsed - 12 + phaseOffset) % 25)
      expect(fireUnit.frame).toBe(expectedFrame)
      expect(fireUnit.frame).toBeGreaterThanOrEqual(12)
      expect(fireUnit.frame).toBeLessThanOrEqual(36)
      ;(world as any).stepMissileUnit(fireUnit)
    }
  })
})
