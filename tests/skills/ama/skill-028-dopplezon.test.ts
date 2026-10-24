/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #028: Dopplezon (AMA)
 * Gitea Tracking Issue: #182
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-028-dopplezon.ts'
import { calculateDecoyStats } from '../../../src/common/skills/amazon-passive.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import { buildSceneDrawables } from '../../../src/client/view/unit-drawables.ts'
import { resolveCharacterAppearance } from '../../../src/common/units/char-appearance.ts'
import { drawSceneUnitDrawable } from '../../../src/client/scene/world-renderer.ts'

describe('[Skill #028] Dopplezon (AMA) — 1.13c Parity (Issue #182)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(28)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(28)
    expect(skillModule.name).toBe("Dopplezon")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(28, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(19)
    expect(r1.manaCost256).toBe(4864)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(28, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(12)
    expect(r10.manaCost256).toBe(3136)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(28, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(4)
    expect(r20.manaCost256).toBe(1216)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(2625)
    expect(r20.petMax).toBe(1)
    expect(r20.cooldownFrames).toBe(0)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(28)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(28, 20)
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
    statsSoftOnly.setBaseSkillLevel(28, 20)
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
      skillId: 28,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(28)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateDecoyStats pure calculations and boundary invariants', () => {
    // slvl 1: 250 frames (10.0s), floor(500 * 50 / 100) * 110 / 100 = 275 HP (55% of Amazon life), 4% res, defense = amazonDef, stationary, draws threat, 19 mana (4864)
    const stats1 = calculateDecoyStats(1, 500, 150, { avoidLvl: 5, evadeLvl: 3 })
    expect(stats1.durationFrames).toBe(250)
    expect(stats1.durationSeconds).toBe(10)
    expect(stats1.hp).toBe(275) // floor(250 * 110 / 100)
    expect(stats1.hpPctOfAmazon).toBe(55)
    expect(stats1.allResistancesPct).toBe(4)
    expect(stats1.defense).toBe(150)
    expect(stats1.isStationary).toBe(true)
    expect(stats1.drawsThreat).toBe(true)
    expect(stats1.inheritedAvoidLvl).toBe(0)
    expect(stats1.inheritedEvadeLvl).toBe(0)
    expect(stats1.manaCost).toBe(19)
    expect(stats1.manaCost256).toBe(4864)

    // slvl 10: 250 + 125*9 = 1375 frames (55.0s), 100% Amazon life (250 * 200 / 100 = 500), 40% res, 12 mana (3136)
    const stats10 = calculateDecoyStats(10, 500, 200)
    expect(stats10.durationFrames).toBe(1375)
    expect(stats10.durationSeconds).toBe(55)
    expect(stats10.hp).toBe(500)
    expect(stats10.hpPctOfAmazon).toBe(100)
    expect(stats10.allResistancesPct).toBe(40)
    expect(stats10.manaCost).toBe(12)
    expect(stats10.manaCost256).toBe(3136)

    // slvl 20: 250 + 125*19 = 2625 frames (105.0s), 150% Amazon life (250 * 300 / 100 = 750), 80% res, 4 mana (1216)
    const stats20 = calculateDecoyStats(20, 500, 300)
    expect(stats20.durationFrames).toBe(2625)
    expect(stats20.durationSeconds).toBe(105)
    expect(stats20.hp).toBe(750)
    expect(stats20.hpPctOfAmazon).toBe(150)
    expect(stats20.allResistancesPct).toBe(80)
    expect(stats20.manaCost).toBe(4)
    expect(stats20.manaCost256).toBe(1216)

    // slvl 25: 4*25 = 100% -> capped at 85%, min mana 1 (256)
    const stats25 = calculateDecoyStats(25, 500, 300)
    expect(stats25.allResistancesPct).toBe(85)
    expect(stats25.manaCost).toBe(1)
    expect(stats25.manaCost256).toBe(256)
  })

  it('#1294: eliminates duplicate local fake Decoy (900000+) on S2C 0xAC UnitAssign and renders Decoy (classId=356) with owner Amazon paperdoll appearance', () => {
    // Case A: Local predictive cast first -> S2C 0xAC UnitAssign second
    const worldA = new ClientWorld()
    worldA.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    const casterA = worldA.getUnit('player', 1)!
    ;(worldA as any).spawnMissilesForSkill(casterA, 28, 105, 102, 5)
    expect(
      Array.from(worldA.units.values()).filter((u) => u.unitType === 'monster' && u.classId === 356),
    ).toHaveLength(1)

    worldA.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 50, classId: 356, x: 105, y: 102, lifePct: 128, mode: 1 },
    })
    const decoysA = Array.from(worldA.units.values()).filter(
      (u) => u.unitType === 'monster' && u.classId === 356,
    )
    expect(decoysA).toHaveLength(1)
    expect(decoysA[0]!.id).toBe(50)
    expect(decoysA[0]!.overlays.some((o) => o.token === 'dopllezon_appear')).toBe(true)

    // Case B: S2C 0xAC UnitAssign first -> S2C SkillCast echo second
    const worldB = new ClientWorld()
    worldB.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    worldB.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 51, classId: 356, x: 106, y: 103, lifePct: 128, mode: 1 },
    })
    const casterB = worldB.getUnit('player', 1)!
    ;(worldB as any).spawnMissilesForSkill(casterB, 28, 106, 103, 5)
    const decoysB = Array.from(worldB.units.values()).filter(
      (u) => u.unitType === 'monster' && u.classId === 356,
    )
    expect(decoysB).toHaveLength(1)
    expect(decoysB[0]!.id).toBe(51)

    // Verify Decoy inherits owner Amazon's paperdoll appearance and queries paperdollGpuCache
    const ownerAppearance = resolveCharacterAppearance('am', {
      helm: 'ghm',
      armor: 'ful',
      weapon1: 'lbw',
    })
    const { unitDrawables } = buildSceneDrawables([
      {
        kind: 'player',
        id: 1,
        classId: 0,
        x: 100,
        y: 100,
        mode: 1,
        isLocalPlayer: true,
        equipmentAppearance: ownerAppearance,
      },
      {
        kind: 'monster',
        id: 50,
        classId: 356,
        ownerType: 'player',
        ownerId: 1,
        x: 105,
        y: 102,
        mode: 1,
        lifePct: 128,
      },
    ])
    const decoyDrawable = unitDrawables.find((d) => d.unitKind === 'monster' && d.classId === 356)!
    expect(decoyDrawable).toBeDefined()
    expect(decoyDrawable.token).toBe('AM')
    expect(decoyDrawable.equipmentAppearance?.wclass).toBe('bow')
    expect(decoyDrawable.equipmentAppearance?.layers.hd.variant).toBe('ghm')
    expect(decoyDrawable.equipmentAppearance?.layers.tr.variant).toBe('hvy')
    expect(decoyDrawable.equipmentAppearance?.layers.lh.variant).toBe('lbw')

    let paperdollQueriedWithSpec: any = null
    const mockPaperdollCache = {
      getCharacterArt: (spec: any) => {
        paperdollQueriedWithSpec = spec
        return 'loading' as const
      },
    }
    let monsterFallbackCalled = false
    const mockEntityArtCache = {
      getMonsterVariantArt: () => {
        monsterFallbackCalled = true
        return 'missing' as const
      },
    }
    const mockRenderer = {
      draw: () => {},
      drawQuad: () => {},
    } as any
    drawSceneUnitDrawable(
      mockRenderer,
      decoyDrawable,
      {
        source: {} as any,
        lightingPreset: 'outdoor-day' as any,
        paperdollGpuCache: mockPaperdollCache as any,
        characterArtByToken: new Map(),
        ensureCharacterArt: async () => {},
        entityArtCache: mockEntityArtCache as any,
      },
      0,
      1,
    )
    expect(paperdollQueriedWithSpec?.wclass).toBe('bow')
    expect(monsterFallbackCalled).toBe(false)
  })
})
