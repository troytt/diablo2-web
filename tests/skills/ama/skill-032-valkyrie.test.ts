/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #032: Valkyrie (AMA)
 * Gitea Tracking Issue: #186
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/ama/skill-032-valkyrie.ts'
import { calculateValkyrieStats } from '../../../src/common/skills/amazon-passive.ts'
import { ClientWorld } from '../../../src/client/world/client-world.ts'
import { buildSceneDrawables } from '../../../src/client/view/unit-drawables.ts'
import { VALKYRIE_113C_APPEARANCE } from '../../../src/common/units/char-appearance.ts'
import { drawSceneUnitDrawable } from '../../../src/client/scene/world-renderer.ts'

describe('[Skill #032] Valkyrie (AMA) — 1.13c Parity (Issue #186)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(32)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(32)
    expect(skillModule.name).toBe("Valkyrie")
    expect(skillModule.charClass).toBe("ama")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(32, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(25)
    expect(r1.manaCost256).toBe(6400)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(32, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(34)
    expect(r10.manaCost256).toBe(8704)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(32, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(44)
    expect(r20.manaCost256).toBe(11264)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(0)
    expect(r20.radiusSubtiles).toBe(495)
    expect(r20.petMax).toBe(1)
    expect(r20.cooldownFrames).toBe(150)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(32)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(32, 20)
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
    statsSoftOnly.setBaseSkillLevel(32, 20)
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
      skillId: 32,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(32)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('validates 1.13c calculateValkyrieStats pure calculations, synergies, and equipment tiers', () => {
    // slvl 1: base HP 440, cooldown 150 frames (6.0s), mana 25 (6400), tier 1 basic
    const stats1 = calculateValkyrieStats(1, {
      decoyHardPoints: 0,
      csLvl: 1,
      dodgeLvl: 1,
      avoidLvl: 1,
      evadeLvl: 1,
      penetrateLvl: 1,
    })
    expect(stats1.baseHp).toBe(440)
    expect(stats1.finalHp).toBe(440)
    expect(stats1.decoySynergyBonusPct).toBe(0)
    expect(stats1.allResistancesPct).toBe(2)
    expect(stats1.strength).toBe(25)
    expect(stats1.dexterity).toBe(12)
    expect(stats1.defenseBonusPct).toBe(0)
    expect(stats1.attackRatingBonus).toBe(80) // 40 * 1 + 40 * 1
    expect(stats1.equipmentIlvl).toBe(25)
    expect(stats1.cooldownFrames).toBe(150)
    expect(stats1.cooldownSeconds).toBe(6.0)
    expect(stats1.equipmentTier).toBe('tier1_basic')
    expect(stats1.inheritedCriticalStrikeLvl).toBe(1)
    expect(stats1.manaCost).toBe(25)
    expect(stats1.manaCost256).toBe(6400)

    // Decoy Synergy at slvl 1: +20% HP per hard point (5 Decoy hard points -> +100% life -> 880 HP, res = 2*(1+5) = 12%)
    const stats1WithDecoy = calculateValkyrieStats(1, { decoyHardPoints: 5 })
    expect(stats1WithDecoy.decoySynergyBonusPct).toBe(100)
    expect(stats1WithDecoy.finalHp).toBe(880)
    expect(stats1WithDecoy.allResistancesPct).toBe(12)

    // Additive Decoy Synergy at slvl 20 + 20 Decoy blvl:
    // totalHpBonusPct = 20*19 + 20*20 = 780% -> finalHp = 440 * 880 / 100 = 3872 HP (NOT multiplicative 2112 * 5 = 10560)
    // allResistancesPct = min(85, 2 * (20 + 20)) = 80%
    const stats20WithDecoy20 = calculateValkyrieStats(20, { decoyHardPoints: 20, penetrateLvl: 20 })
    expect(stats20WithDecoy20.baseHp).toBe(2112)
    expect(stats20WithDecoy20.finalHp).toBe(3872)
    expect(stats20WithDecoy20.allResistancesPct).toBe(80)
    expect(stats20WithDecoy20.strength).toBe(500)
    expect(stats20WithDecoy20.dexterity).toBe(240)
    expect(stats20WithDecoy20.defenseBonusPct).toBe(190)
    expect(stats20WithDecoy20.attackRatingBonus).toBe(1600)
    expect(stats20WithDecoy20.equipmentIlvl).toBe(82)

    // Resistance cap at 85% (e.g. slvl 25 + 20 Decoy blvl -> min(85, 90) = 85%)
    const stats25WithDecoy20 = calculateValkyrieStats(25, { decoyHardPoints: 20 })
    expect(stats25WithDecoy20.allResistancesPct).toBe(85)

    // slvl 7: Boots tier
    const stats7 = calculateValkyrieStats(7)
    expect(stats7.equipmentTier).toBe('tier2_boots')

    // slvl 11: Gloves tier
    const stats11 = calculateValkyrieStats(11)
    expect(stats11.equipmentTier).toBe('tier3_gloves')

    // slvl 17: Rare War Pike tier
    const stats17 = calculateValkyrieStats(17)
    expect(stats17.equipmentTier).toBe('tier4_war_pike')

    // slvl 27+: Tiara & Sacred Armor tier
    const stats27 = calculateValkyrieStats(27)
    expect(stats27.equipmentTier).toBe('tier5_rare_tiara')

    // slvl 20: 440 * (1 + 0.2*19) = 440 * 4.8 = 2112 HP, 40% res, 44 mana
    const stats20 = calculateValkyrieStats(20)
    expect(stats20.baseHp).toBe(2112)
    expect(stats20.allResistancesPct).toBe(40)
    expect(stats20.manaCost).toBe(44)
  })

  it('#1294: eliminates duplicate local fake Valkyrie (910000+) on S2C 0xAC UnitAssign and renders Valkyrie (classId=357) with golden Full Plate + Pike (2ht) paperdoll disguise', () => {
    // Case A: Local predictive cast first -> S2C 0xAC UnitAssign second
    const worldA = new ClientWorld()
    worldA.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    const casterA = worldA.getUnit('player', 1)!
    ;(worldA as any).spawnMissilesForSkill(casterA, 32, 108, 104, 10)
    expect(
      Array.from(worldA.units.values()).filter((u) => u.unitType === 'monster' && u.classId === 357),
    ).toHaveLength(1)

    worldA.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 60, classId: 357, x: 108, y: 104, lifePct: 128, mode: 1 },
    })
    const valksA = Array.from(worldA.units.values()).filter(
      (u) => u.unitType === 'monster' && u.classId === 357,
    )
    expect(valksA).toHaveLength(1)
    expect(valksA[0]!.id).toBe(60)
    expect(valksA[0]!.states.has(93)).toBe(true)
    expect(valksA[0]!.overlays.some((o) => o.token === 'valkyriestart')).toBe(true)
    expect(valksA[0]!.overlays.some((o) => o.token === 'valkyrie')).toBe(true)

    // Case B: S2C 0xAC UnitAssign first -> S2C SkillCast echo second
    const worldB = new ClientWorld()
    worldB.apply({ type: 'PlayerAssign', unitId: 1, charClass: 0, name: 'Ama', x: 100, y: 100 })
    worldB.apply({
      type: 'UnitAssign',
      unit: { unitType: 1, id: 61, classId: 357, x: 109, y: 105, lifePct: 128, mode: 1 },
    })
    const casterB = worldB.getUnit('player', 1)!
    ;(worldB as any).spawnMissilesForSkill(casterB, 32, 109, 105, 10)
    const valksB = Array.from(worldB.units.values()).filter(
      (u) => u.unitType === 'monster' && u.classId === 357,
    )
    expect(valksB).toHaveLength(1)
    expect(valksB[0]!.id).toBe(61)

    // Verify Valkyrie drawable uses VALKYRIE_113C_APPEARANCE (hvy armor + pik 2ht spear + lgld tint)
    const { unitDrawables } = buildSceneDrawables([
      {
        kind: 'monster',
        id: 60,
        classId: 357,
        ownerType: 'player',
        ownerId: 1,
        x: 108,
        y: 104,
        mode: 1,
        lifePct: 128,
      },
    ])
    const valkDrawable = unitDrawables.find((d) => d.unitKind === 'monster' && d.classId === 357)!
    expect(valkDrawable).toBeDefined()
    expect(valkDrawable.token).toBe('AM')
    expect(valkDrawable.equipmentAppearance).toEqual(VALKYRIE_113C_APPEARANCE)
    expect(valkDrawable.equipmentAppearance?.wclass).toBe('2ht')
    expect(valkDrawable.equipmentAppearance?.layers.rh.variant).toBe('pik')
    expect(valkDrawable.equipmentAppearance?.layers.tr.variant).toBe('hvy')
    expect(valkDrawable.equipmentAppearance?.armorTint?.color).toBe('lgld')
    expect(valkDrawable.tintColor).toEqual([255, 230, 128])

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
      valkDrawable,
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
    expect(paperdollQueriedWithSpec?.wclass).toBe('2ht')
    expect(paperdollQueriedWithSpec?.layers.rh.variant).toBe('pik')
    expect(monsterFallbackCalled).toBe(false)
  })
})
