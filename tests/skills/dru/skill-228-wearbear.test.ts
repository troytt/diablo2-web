/**
 * 1.13c Numerical & Runtime Verification Suite — Skill #228: Wearbear (DRU)
 * Gitea Tracking Issue: #321
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../../src/baker/mpq-archive-source.ts'
import { UnitStatList } from '../../../src/server/engine/stat-list.ts'
import { WorldArena } from '../../../src/server/engine/world-arena.ts'
import { skillModule } from '../../../src/server/skills/impl/dru/skill-228-wearbear.ts'

describe('[Skill #228] Wearbear (DRU) — 1.13c Parity (Issue #321)', () => {
  it('evaluates exact 1.13c Skills.txt / Missiles.txt formulas at slvl 1, 10, and 20', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(228)!
    expect(skillRec).toBeDefined()
    expect(skillModule.skillId).toBe(228)
    expect(skillModule.name).toBe("Wearbear")
    expect(skillModule.charClass).toBe("dru")

    const stats1 = new UnitStatList()
    stats1.setBaseSkillLevel(228, 1)
    const r1 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 1, blvl: 1, statList: stats1 })
    expect(r1.manaCost).toBe(15)
    expect(r1.manaCost256).toBe(3840)
    expect(r1.minPhysDmg).toBe(0)
    expect(r1.maxPhysDmg).toBe(0)
    expect(r1.minElemDmg256).toBe(0)
    expect(r1.maxElemDmg256).toBe(0)

    const stats10 = new UnitStatList()
    stats10.setBaseSkillLevel(228, 10)
    const r10 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 10, blvl: 10, statList: stats10 })
    expect(r10.manaCost).toBe(15)
    expect(r10.manaCost256).toBe(3840)
    expect(r10.minPhysDmg).toBe(0)
    expect(r10.maxPhysDmg).toBe(0)
    expect(r10.minElemDmg256).toBe(0)
    expect(r10.maxElemDmg256).toBe(0)

    const stats20 = new UnitStatList()
    stats20.setBaseSkillLevel(228, 20)
    const r20 = skillModule.evaluate!({ registry, skill: skillRec, slvl: 20, blvl: 20, statList: stats20 })
    expect(r20.manaCost).toBe(15)
    expect(r20.manaCost256).toBe(3840)
    expect(r20.minPhysDmg).toBe(0)
    expect(r20.maxPhysDmg).toBe(0)
    expect(r20.minElemDmg256).toBe(0)
    expect(r20.maxElemDmg256).toBe(0)
    expect(r20.durationFrames).toBe(1000)
    expect(r20.radiusSubtiles).toBe(0)
    expect(r20.petMax).toBe(0)
    expect(r20.cooldownFrames).toBe(25)
  })

  it('enforces 1.13c blvl synergy rule (hard points boost synergy; +skills and item charges do NOT)', async () => {
    const registry = await getSharedDataRegistry()
    const skillRec = registry.getSkillById(228)!
    const synId = null

    const statsBase = new UnitStatList()
    statsBase.setBaseSkillLevel(228, 20)
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
    statsSoftOnly.setBaseSkillLevel(228, 20)
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
      classCode: "dru",
      skillId: 228,
      slvl: 20,
    })
    const outcome = arena.triggerCast()
    arena.stepTicks(15)
    const dbg = arena.getDebugState()

    expect(dbg.ready).toBe(true)
    expect(dbg.skillId).toBe(228)
    expect(dbg.castCount).toBeGreaterThanOrEqual(1)
    expect(dbg.actionFrameTriggered).toBe(true)
    expect(outcome?.executed).toBe(true)
  })

  it('Issue #1423: applies exact 1.13c Skills.txt aurastat1..6 for Werebear (#228) and Werewolf (#223)', async () => {
    const registry = await getSharedDataRegistry()

    // 1. Werebear (#228) slvl=1, Lycanthropy (#224) slvl=0:
    // aurastat1=damagepercent (ln12 = 55), aurastat2=skill_armor_percent (ln34 = 25),
    // aurastat3=item_maxhp_percent (par5 + skill('Shape Shifting'.ln34) = 75 + 0 = 75)
    const arenaBear1 = new WorldArena({
      registry,
      classCode: 'dru',
      skillId: 228,
      slvl: 1,
    })
    arenaBear1.player.statList.setBaseSkillLevel(228, 1)
    arenaBear1.player.statList.setBaseSkillLevel(224, 0)
    const outBear1 = arenaBear1.triggerCast()
    expect(outBear1?.executed).toBe(true)
    const bearState1 = arenaBear1.player.stateBus.getState('bear')
    expect(bearState1).toBeDefined()
    expect(bearState1!.stats).toEqual({
      damagepercent: 55,
      skill_armor_percent: 25,
      item_maxhp_percent: 75,
    })
    expect(bearState1!.stats['item_armor_percent']).toBeUndefined()
    expect(bearState1!.durationFrames).toBe(1000)

    // 2. Werebear (#228) slvl=10, Lycanthropy (#224) slvl=5:
    // damagepercent = 55 + 9*8 = 127, skill_armor_percent = 25 + 9*6 = 79,
    // item_maxhp_percent = 75 + (20 + 4*5) = 115
    const arenaBear10 = new WorldArena({
      registry,
      classCode: 'dru',
      skillId: 228,
      slvl: 10,
    })
    arenaBear10.player.statList.setBaseSkillLevel(228, 10)
    arenaBear10.player.statList.setBaseSkillLevel(224, 5)
    const outBear10 = arenaBear10.triggerCast()
    expect(outBear10?.executed).toBe(true)
    const bearState10 = arenaBear10.player.stateBus.getState('bear')
    expect(bearState10).toBeDefined()
    expect(bearState10!.stats).toEqual({
      damagepercent: 127,
      skill_armor_percent: 79,
      item_maxhp_percent: 115,
    })
    expect(bearState10!.stats['item_armor_percent']).toBeUndefined()
    expect(bearState10!.durationFrames).toBe(4000)

    // 3. Werewolf (#223) slvl=5, Lycanthropy (#224) slvl=5:
    // state stats contains ONLY the 4 stats in Skills.txt (skill_staminapercent, attackrate, item_tohit_percent, item_maxhp_percent)
    const arenaWolf = new WorldArena({
      registry,
      classCode: 'dru',
      skillId: 223,
      slvl: 5,
    })
    arenaWolf.player.statList.setBaseSkillLevel(223, 5)
    arenaWolf.player.statList.setBaseSkillLevel(224, 5)
    const outWolf = arenaWolf.triggerCast()
    expect(outWolf?.executed).toBe(true)
    const wolfState = arenaWolf.player.stateBus.getState('wolf')
    expect(wolfState).toBeDefined()
    expect(Object.keys(wolfState!.stats).sort()).toEqual([
      'attackrate',
      'item_maxhp_percent',
      'item_tohit_percent',
      'skill_staminapercent',
    ])
    expect(wolfState!.stats['skill_staminapercent']).toBe(25)
    expect(wolfState!.stats['item_tohit_percent']).toBe(50 + 4 * 15)
    expect(wolfState!.stats['item_maxhp_percent']).toBe(25 + 40)
  })
})
