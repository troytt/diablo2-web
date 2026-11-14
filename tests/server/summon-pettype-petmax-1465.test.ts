import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { D2DataRegistry } from '../../src/common/data/data-registry.ts'
import { evaluateCalc } from '../../src/common/data/calc-ast.ts'
import { PET_TYPE_PORTRAIT_TABLE } from '../../src/common/units/pet-type-table.ts'
import { SummonManager } from '../../src/server/ai/summon-manager.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import type { CombatUnitContext } from '../../src/server/engine/combat-pipeline.ts'
import {
  DRUID_PET_GROUPS,
  calculateSummonSpiritWolfStats,
  calculateSummonDireWolfStats,
  calculateSummonGrizzlyStats,
  calculateOakSageStats,
  calculateHeartOfWolverineStats,
  calculateSpiritOfBarbsStats,
  calculatePoisonCreeperStats,
  calculateCarrionVineStats,
  calculateSolarCreeperStats,
} from '../../src/server/skills/druid-summoning.ts'

describe('Issue #1465: 1.13c SummonManager PetType, PetGroup & PetMax Ground Truth', () => {
  function createOwner(registry: D2DataRegistry, id = 'owner-1', level = 60): CombatUnitContext {
    const statList = new UnitStatList(registry, {
      level,
      maxhp: 1000 * FIXED_ONE,
      hitpoints: 1000 * FIXED_ONE,
      maxmana: 1000 * FIXED_ONE,
      mana: 1000 * FIXED_ONE,
    })
    const stateBus = new StateBus(statList, registry)
    return {
      id,
      name: 'Tester',
      unitType: 'player',
      statList,
      stateBus,
      x: 100,
      y: 100,
    }
  }

  it('verifies all 31 skills in Skills.txt with non-empty pettype (plus #295/#300) match Skills.txt + PetType.txt in SummonManager.createPet', async () => {
    const registry = await getSharedDataRegistry()

    // Authoritative 1.13c Skills.txt rows with non-empty pettype (31 skills) + monster summon skills #295/#300
    const expectedSkills: ReadonlyArray<{
      readonly id: number
      readonly name: string
      readonly petType: string
      readonly summon: string
      readonly petMax: string
      readonly group: number
    }> = [
      { id: 28, name: 'Dopplezon', petType: 'dopplezon', summon: 'dopplezon', petMax: '1', group: 0 },
      { id: 32, name: 'Valkyrie', petType: 'valkyrie', summon: 'valkyrie', petMax: '1', group: 0 },
      { id: 62, name: 'Hydra', petType: 'hydra', summon: 'hydra1', petMax: '99', group: 0 },
      { id: 70, name: 'Raise Skeleton', petType: 'skeleton', summon: 'necroskeleton', petMax: '(lvl < 4) ?lvl:(2+lvl/3)', group: 0 },
      { id: 75, name: 'Clay Golem', petType: 'golem', summon: 'ClayGolem', petMax: '1', group: 0 },
      { id: 78, name: 'Bone Wall', petType: 'none', summon: 'bonewall', petMax: '', group: 0 },
      { id: 80, name: 'Raise Skeletal Mage', petType: 'skeletonmage', summon: 'necromage', petMax: '(lvl < 4) ?lvl:(2+lvl/3)', group: 0 },
      { id: 85, name: 'BloodGolem', petType: 'golem', summon: 'BloodGolem', petMax: '1', group: 0 },
      { id: 88, name: 'Bone Prison', petType: 'none', summon: 'bonewall', petMax: '', group: 0 },
      { id: 90, name: 'IronGolem', petType: 'golem', summon: 'IronGolem', petMax: '1', group: 0 },
      { id: 94, name: 'FireGolem', petType: 'golem', summon: 'FireGolem', petMax: '1', group: 0 },
      { id: 95, name: 'Revive', petType: 'revive', summon: '', petMax: 'lvl', group: 0 },
      { id: 199, name: 'DiabPrison', petType: 'none', summon: 'boneprison1', petMax: '', group: 0 },
      { id: 221, name: 'Raven', petType: 'raven', summon: 'druidhawk', petMax: '"min(lvl,par2)"', group: 0 },
      { id: 222, name: 'Plague Poppy', petType: 'vine', summon: 'plaguepoppy', petMax: '1', group: 0 },
      { id: 226, name: 'Oak Sage', petType: 'totem', summon: 'oaksage', petMax: '1', group: 0 },
      { id: 227, name: 'Summon Spirit Wolf', petType: 'spiritwolf', summon: 'spiritwolf', petMax: '"min(lvl,par3)"', group: 1 },
      { id: 231, name: 'Cycle of Life', petType: 'vine', summon: 'cycleoflife', petMax: '1', group: 0 },
      { id: 236, name: 'Heart of Wolverine', petType: 'totem', summon: 'heartofwolverine', petMax: '1', group: 0 },
      { id: 237, name: 'Summon Fenris', petType: 'fenris', summon: 'fenris', petMax: '"min(lvl,par3)"', group: 1 },
      { id: 241, name: 'Vines', petType: 'vine', summon: 'vinecreature', petMax: '1', group: 0 },
      { id: 246, name: 'Spirit of Barbs', petType: 'totem', summon: 'spiritofbarbs', petMax: '1', group: 0 },
      { id: 247, name: 'Summon Grizzly', petType: 'grizzly', summon: 'druidbear', petMax: '1', group: 1 },
      { id: 257, name: 'Blade Sentinel', petType: 'assassintrap', summon: 'bladecreeper', petMax: '5', group: 0 },
      { id: 261, name: 'Charged Bolt Sentry', petType: 'assassintrap', summon: 'chargeboltsentry', petMax: '5', group: 0 },
      { id: 262, name: 'Wake of Fire Sentry', petType: 'assassintrap', summon: 'wakeofdestruction', petMax: '5', group: 0 },
      { id: 268, name: 'Shadow Warrior', petType: 'shadowwarrior', summon: 'shadowwarrior', petMax: '1', group: 0 },
      { id: 271, name: 'Lightning Sentry', petType: 'assassintrap', summon: 'lightningsentry', petMax: '5', group: 0 },
      { id: 272, name: 'Inferno Sentry', petType: 'assassintrap', summon: 'infernosentry', petMax: '5', group: 0 },
      { id: 276, name: 'Death Sentry', petType: 'assassintrap', summon: 'deathsentry', petMax: '5', group: 0 },
      { id: 279, name: 'Shadow Master', petType: 'shadowwarrior', summon: 'shadowmaster', petMax: '1', group: 0 },
      { id: 295, name: 'Overseer Whip', petType: '', summon: 'suicideminion1', petMax: '', group: 0 },
      { id: 300, name: 'Impregnate', petType: '', summon: 'painworm1', petMax: '', group: 0 },
    ]

    const skillsWithPetType = Array.from(registry.skillsById.values()).filter(s => s.petType.trim() !== '')
    expect(skillsWithPetType).toHaveLength(31)

    for (const exp of expectedSkills) {
      const skill = registry.getSkillById(exp.id)
      expect(skill, `Skill #${exp.id}`).toBeDefined()
      expect(skill!.petType).toBe(exp.petType)
      expect(skill!.summon).toBe(exp.summon)
      expect(skill!.petMax).toBe(exp.petMax)

      const resolvedPetType = (skill!.petType || 'none').toLowerCase()
      const ptRec = registry.getPetType(resolvedPetType)
      expect(ptRec, `PetType "${resolvedPetType}" for skill #${exp.id}`).toBeDefined()
      expect(ptRec!.group).toBe(exp.group)

      const sm = new SummonManager(registry)
      const owner = createOwner(registry)
      const out = sm.createPet({
        owner,
        skillId: exp.id,
        slvl: 5,
        corpses: [{ id: 'c-1', consumed: false, monId: 'skeleton1', classId: 0, baseMaxHp: 200 }],
        ironGolemItem: { isMetallic: true, defense: 100 },
      })
      expect(out.created, `createPet(#${exp.id} ${exp.name})`).toBe(true)
      expect(out.pet!.petType).toBe(resolvedPetType)
      expect(out.pet!.petGroup).toBe(exp.group)
      expect(out.pet!.unsummonable).toBe(Boolean(ptRec!.unsummon))
      if (exp.id !== 95) {
        expect(out.pet!.monId).toBe(exp.summon.toLowerCase())
      }
    }

    // Verify PET_TYPE_PORTRAIT_TABLE group values match PetType.txt (only 11, 12, 15 have group=1; all others group=0)
    for (const [idxStr, entry] of Object.entries(PET_TYPE_PORTRAIT_TABLE)) {
      const ptRec = registry.getPetType(Number(idxStr))
      expect(ptRec).toBeDefined()
      expect(entry.group).toBe(ptRec!.group)
    }
  })

  it('enforces #257 Blade Sentinel petType="assassintrap" and 5-trap FIFO cap shared with ground sentries (D2Game.dll 0x6FCB6310 -> 0x6FCB5D50)', async () => {
    const registry = await getSharedDataRegistry()
    const sm = new SummonManager(registry)
    const owner = createOwner(registry)

    // 1. Lay 5 ground sentries (#261, #262, #271, #272, #276)
    const s261 = sm.createPet({ owner, skillId: 261, slvl: 10 }).pet!
    const s262 = sm.createPet({ owner, skillId: 262, slvl: 10 }).pet!
    const s271 = sm.createPet({ owner, skillId: 271, slvl: 10 }).pet!
    const s272 = sm.createPet({ owner, skillId: 272, slvl: 10 }).pet!
    const s276 = sm.createPet({ owner, skillId: 276, slvl: 10 }).pet!
    expect(sm.getActivePets().map(p => p.uid)).toEqual([s261.uid, s262.uid, s271.uid, s272.uid, s276.uid])

    // 2. Cast #257 Blade Sentinel -> shares 'assassintrap' (petmax=5) and FIFO-evicts the oldest sentry (#261)
    const bs1 = sm.createPet({ owner, skillId: 257, slvl: 10 })
    expect(bs1.created).toBe(true)
    expect(bs1.pet!.petType).toBe('assassintrap')
    expect(bs1.pet!.petGroup).toBe(0)
    expect(bs1.pet!.monId).toBe('bladecreeper')
    expect(bs1.evictedPetUids).toEqual([s261.uid])
    expect(sm.getActivePets().map(p => p.sourceSkillId)).toEqual([262, 271, 272, 276, 257])

    // 3. Cast 6 consecutive #257 Blade Sentinels -> retains only 5 (FIFO eviction)
    const smBladeOnly = new SummonManager(registry)
    const bladeUids: string[] = []
    for (let i = 0; i < 6; i++) {
      const res = smBladeOnly.createPet({ owner, skillId: 257, slvl: 5 })
      expect(res.created).toBe(true)
      bladeUids.push(res.pet!.uid)
      if (i < 5) {
        expect(res.evictedPetUids).toEqual([])
      } else {
        expect(res.evictedPetUids).toEqual([bladeUids[0]])
      }
    }
    expect(smBladeOnly.getActivePets()).toHaveLength(5)
    expect(smBladeOnly.getActivePets().map(p => p.uid)).toEqual(bladeUids.slice(1))
  })

  it('enforces Druid Spirit Wolf (petType="spiritwolf", group=1), Dire Wolf (petType="fenris", group=1), and Grizzly (petType="grizzly", group=1) group exclusivity and min(lvl,par3) caps', async () => {
    const registry = await getSharedDataRegistry()
    const sm = new SummonManager(registry)
    const owner = createOwner(registry)

    // Verify pure formula helper metadata matches Skills.txt + PetType.txt
    expect(DRUID_PET_GROUPS).toEqual({ RAVEN: 0, TOTEM: 0, VINE: 0, BEAST: 1 })
    expect(calculateSummonSpiritWolfStats(5).petType).toBe('spiritwolf')
    expect(calculateSummonSpiritWolfStats(5).petGroup).toBe(1)
    expect(calculateSummonDireWolfStats(5).petType).toBe('fenris')
    expect(calculateSummonDireWolfStats(5).petGroup).toBe(1)
    expect(calculateSummonGrizzlyStats(5).petType).toBe('grizzly')
    expect(calculateSummonGrizzlyStats(5).petGroup).toBe(1)
    expect(calculateOakSageStats(5).petGroup).toBe(0)
    expect(calculateHeartOfWolverineStats(5).petGroup).toBe(0)
    expect(calculateSpiritOfBarbsStats(5).petGroup).toBe(0)
    expect(calculatePoisonCreeperStats(5).petGroup).toBe(0)
    expect(calculateCarrionVineStats(5).petGroup).toBe(0)
    expect(calculateSolarCreeperStats(5).petGroup).toBe(0)

    // 1. Summon 5 Spirit Wolves at slvl=10 (max = min(10, par3=5) = 5); 6th FIFO-evicts the 1st
    const swUids: string[] = []
    for (let i = 0; i < 6; i++) {
      const res = sm.createPet({ owner, skillId: 227, slvl: 10 })
      expect(res.pet!.petType).toBe('spiritwolf')
      expect(res.pet!.petGroup).toBe(1)
      swUids.push(res.pet!.uid)
    }
    expect(sm.getActivePets().map(p => p.uid)).toEqual(swUids.slice(1))

    // 2. Summon 1 Dire Wolf (#237) at slvl=10 -> group=1 evicts all 5 Spirit Wolves (different petType 'spiritwolf' !== 'fenris')
    const dw1 = sm.createPet({ owner, skillId: 237, slvl: 10 })
    expect(dw1.pet!.petType).toBe('fenris')
    expect(dw1.pet!.petGroup).toBe(1)
    expect(dw1.evictedPetUids.sort()).toEqual(swUids.slice(1).sort())
    expect(sm.getActivePets().map(p => p.uid)).toEqual([dw1.pet!.uid])

    // 3. Summon 3 more Dire Wolves at slvl=10 (max = min(10, par3=3) = 3) -> 4th FIFO-evicts dw1
    const dw2 = sm.createPet({ owner, skillId: 237, slvl: 10 }).pet!
    const dw3 = sm.createPet({ owner, skillId: 237, slvl: 10 }).pet!
    const dw4 = sm.createPet({ owner, skillId: 237, slvl: 10 })
    expect(dw4.evictedPetUids).toEqual([dw1.pet!.uid])
    expect(sm.getActivePets().map(p => p.uid)).toEqual([dw2.uid, dw3.uid, dw4.pet!.uid])

    // 4. Summon Grizzly (#247) -> group=1 evicts all 3 Dire Wolves
    const gz = sm.createPet({ owner, skillId: 247, slvl: 10 })
    expect(gz.pet!.petType).toBe('grizzly')
    expect(gz.pet!.petGroup).toBe(1)
    expect(gz.evictedPetUids.sort()).toEqual([dw2.uid, dw3.uid, dw4.pet!.uid].sort())
    expect(sm.getActivePets().map(p => p.uid)).toEqual([gz.pet!.uid])
  })

  it('evaluates dynamic petMax formulas from Skills.txt (#70/#80 Skeletons, #95 Revive, #221 Raven, #62 Hydra) and uncapped petType="none" (#78/#88/#199)', async () => {
    const registry = await getSharedDataRegistry()
    const owner = createOwner(registry)

    // #70 Raise Skeleton & #80 Raise Skeletal Mage: (lvl < 4) ? lvl : (2 + lvl/3)
    for (const skillId of [70, 80] as const) {
      const skill = registry.getSkillById(skillId)!
      for (const [slvl, expectedCap] of [
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 3],
        [6, 4],
        [9, 5],
        [20, 8],
      ] as const) {
        const calcCap = evaluateCalc(skill.petMax, {
          registry,
          activeSkill: skill,
          slvl,
          blvl: slvl,
        })
        expect(calcCap).toBe(expectedCap)
      }
    }

    // #62 Hydra: petmax = 99 (not 1)
    const smHydra = new SummonManager(registry)
    for (let i = 0; i < 6; i++) {
      const h = smHydra.createPet({ owner, skillId: 62, slvl: 10 })
      expect(h.created).toBe(true)
      expect(h.evictedPetUids).toEqual([])
    }
    expect(smHydra.getActivePets()).toHaveLength(6)

    // #78 Bone Wall, #88 Bone Prison, #199 DiabPrison: pettype = 'none', uncapped, never evict each other
    const smNone = new SummonManager(registry)
    for (let i = 0; i < 4; i++) {
      expect(smNone.createPet({ owner, skillId: 78, slvl: 5 }).evictedPetUids).toEqual([])
      expect(smNone.createPet({ owner, skillId: 88, slvl: 5 }).evictedPetUids).toEqual([])
      expect(smNone.createPet({ owner, skillId: 199, slvl: 5 }).evictedPetUids).toEqual([])
    }
    expect(smNone.getActivePets()).toHaveLength(12)
    expect(smNone.getActivePets().every(p => p.petType === 'none' && p.petGroup === 0)).toBe(true)
  })

  it('throws an explicit Error instead of using hardcoded fallback tables when D2DataRegistry is empty', async () => {
    const registry = await getSharedDataRegistry()
    const owner = createOwner(registry)
    const emptyRegistry = {
      skillsById: new Map(),
      petTypesByName: new Map(),
    } as unknown as D2DataRegistry
    const sm = new SummonManager(emptyRegistry)
    expect(() => sm.createPet({ owner, skillId: 70, slvl: 1 })).toThrow(
      /SummonManager\.createPet requires a loaded D2DataRegistry/,
    )
  })
})
