import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { computeSkillManaCost256 } from '../../src/common/data/calc-ast.ts'
import { AnimDispatcher } from '../../src/server/engine/anim-dispatcher.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'
import { MissileEngine } from '../../src/server/engine/missile-engine.ts'
import { evaluateSkill113c, executeSkill113c } from '../../src/server/skills/registry.ts'
import { GameInstance } from '../../src/server/engine/game-instance.ts'
import type { CombatUnitContext } from '../../src/server/engine/combat-pipeline.ts'

describe('Issue #1456: 1.13c Skills.txt startmana / usemanaondo / nocostinstate parity', () => {
  it('parses startmana, usemanaondo, and nocostinstate across all 305 Skills.txt rows (exact 6-skill sweep)', async () => {
    const registry = await getSharedDataRegistry()

    const startManaIds: number[] = []
    const useManaOnDoIds: number[] = []
    const noCostInStateIds: number[] = []

    for (let id = 0; id < 360; id++) {
      const s = registry.getSkillById(id)
      if (!s) continue
      if (s.startMana > 0) startManaIds.push(s.id)
      if (s.useManaOnDo) useManaOnDoIds.push(s.id)
      if (s.noCostInState) noCostInStateIds.push(s.id)
    }

    // 1.13c Skills.txt class-of-bug sweep:
    // - startmana > 0: #41 Inferno (6), #230 Arctic Blast (6), #266 Blade Fury (6)
    // - usemanaondo = 1: #25 Plague Javelin, #266 Blade Fury
    // - nocostinstate = 1: #223 Wearwolf, #228 Wearbear
    expect(startManaIds).toEqual([41, 230, 266])
    expect(useManaOnDoIds).toEqual([25, 266])
    expect(noCostInStateIds).toEqual([223, 228])

    for (const id of [41, 230, 266]) {
      const skill = registry.getSkillById(id)!
      expect(skill.startMana).toBe(6)
      const ev = evaluateSkill113c({
        registry,
        skill,
        slvl: 1,
        blvl: 1,
        statList: new UnitStatList(registry),
      })
      expect(ev.startMana).toBe(6)
      expect(ev.startMana256).toBe(6 << 8)
    }
  })

  it('enforces startmana (6 << 8 = 1536) on initial cast of Inferno (#41), Arctic Blast (#230), and Blade Fury (#266), then allows channeling ticks down to manaCost256 while STATE_INFERNO (12) is active', async () => {
    const registry = await getSharedDataRegistry()

    // 1. Inferno (#41): startmana=6 (1536), manashift=2, mana=36, lvlmana=1 -> slvl 1 manaCost256 = 36 << 2 = 144
    // 2. Arctic Blast (#230): startmana=6 (1536), manashift=2, mana=24, lvlmana=1 -> slvl 1 manaCost256 = 24 << 2 = 96
    // 3. Blade Fury (#266): startmana=6 (1536), manashift=5, mana=8, lvlmana=1 -> slvl 1 manaCost256 = 8 << 5 = 256
    const cases = [
      { skillId: 41, expectedTickCost256: 144, classCode: 'sor' as const, classId: 1 as const },
      { skillId: 230, expectedTickCost256: 96, classCode: 'dru' as const, classId: 5 as const },
      { skillId: 266, expectedTickCost256: 256, classCode: 'ass' as const, classId: 6 as const },
    ]

    for (const { skillId, expectedTickCost256, classCode, classId } of cases) {
      const skill = registry.getSkillById(skillId)!
      expect(computeSkillManaCost256(skill, 1).manaCost256).toBe(expectedTickCost256)

      // A. executeSkill113c & AnimDispatcher check (`D2Common.dll` 0x6FD9FDC0, `D2Game.dll` 0x6FC64550 / 0x6FCB5BC0)
      const statList = new UnitStatList(registry)
      const stateBus = new StateBus(statList, registry)
      statList.setBaseSkillLevel(skillId, 1)
      const caster: CombatUnitContext = {
        id: `caster_${skillId}`,
        name: 'Caster',
        charClass: classCode,
        unitType: 'player',
        statList,
        stateBus,
      }
      const evalResult = evaluateSkill113c({
        registry,
        skill,
        slvl: 1,
        blvl: 1,
        statList,
      })

      // With 5 mana (1280 < 1536) and NOT in STATE_INFERNO (12): initial cast MUST be rejected!
      statList.setMana256(5 * FIXED_ONE)
      const rejectedOut = executeSkill113c({
        registry,
        skill,
        evalResult,
        caster,
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: new MissileEngine(registry),
        auraScanner: {} as any,
        summonManager: {} as any,
        currentTick: 10,
        targetX: 10,
        targetY: 10,
      })
      expect(rejectedOut.executed).toBe(false)
      expect(rejectedOut.error).toBe('insufficient_start_mana')
      expect(rejectedOut.manaSpent256).toBe(0)
      expect(stateBus.hasState('inferno')).toBe(false)

      const dispatcher = new AnimDispatcher({
        registry,
        statList,
        stateBus,
        charToken: classCode === 'sor' ? 'SO' : classCode === 'dru' ? 'DZ' : 'AI',
      })
      expect(dispatcher.startSkillAnimation({ skill, slvl: 1, currentTick: 10 }).allowed).toBe(false)

      // With 6 mana (1536 >= 1536): initial cast succeeds and applies STATE_INFERNO (12)
      statList.setMana256(6 * FIXED_ONE)
      const startedOut = executeSkill113c({
        registry,
        skill,
        evalResult,
        caster,
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: new MissileEngine(registry),
        auraScanner: {} as any,
        summonManager: {} as any,
        currentTick: 10,
        targetX: 10,
        targetY: 10,
      })
      expect(startedOut.executed).toBe(true)
      expect(startedOut.manaSpent256).toBe(expectedTickCost256)
      expect(stateBus.hasState('inferno')).toBe(true)

      // While STATE_INFERNO (12) is active, channeling continues with 2 mana (512 < 1536, >= expectedTickCost256)
      statList.setMana256(2 * FIXED_ONE)
      const channelOut = executeSkill113c({
        registry,
        skill,
        evalResult,
        caster,
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: new MissileEngine(registry),
        auraScanner: {} as any,
        summonManager: {} as any,
        currentTick: 12,
        targetX: 10,
        targetY: 10,
      })
      expect(channelOut.executed).toBe(true)
      expect(channelOut.manaSpent256).toBe(expectedTickCost256)
      expect(stateBus.hasState('inferno')).toBe(true)

      // When mana drops below manaCost256 (e.g. expectedTickCost256 - 1), channeling stops and removes STATE_INFERNO
      statList.setMana256(expectedTickCost256 - 1)
      const exhaustedOut = executeSkill113c({
        registry,
        skill,
        evalResult,
        caster,
        targets: [],
        targetPositions: new Map(),
        corpses: [],
        missileEngine: new MissileEngine(registry),
        auraScanner: {} as any,
        summonManager: {} as any,
        currentTick: 14,
        targetX: 10,
        targetY: 10,
      })
      expect(exhaustedOut.executed).toBe(false)
      expect(exhaustedOut.manaSpent256).toBe(0)
      expect(stateBus.hasState('inferno')).toBe(false)

      // B. Authoritative GameInstance check (pause passive mana regen with state 85 nomanaregen to isolate cast deductions)
      const game = new GameInstance({ registry, areaId: 2 })
      const pid = game.addPlayer({
        name: 'Channeler',
        classId,
        level: 30,
        x: 100,
        y: 100,
        areaId: 2,
        skills: { [skillId]: 1 },
      })
      const internalP = (game as any).players.get(pid)
      internalP.states.add(85) // nomanaregen

      // 5 mana (< 6 startmana): rejected in GameInstance, mana unchanged
      internalP.manaFixed = 5 * FIXED_ONE
      internalP.mana = 5
      game.enqueueCommand(pid, {
        type: 'CastSkillAtLocation',
        skillId,
        x: 106,
        y: 100,
      })
      game.stepFrame()
      expect(internalP.manaFixed).toBe(5 * FIXED_ONE)
      expect(internalP.states.has(12)).toBe(false)

      // 6 mana (1536): accepted in GameInstance, sets STATE_INFERNO (12) and deducts 1 tick of manaCost256
      internalP.manaFixed = 6 * FIXED_ONE
      internalP.mana = 6
      game.enqueueCommand(pid, {
        type: 'CastSkillAtLocation',
        skillId,
        x: 106,
        y: 100,
      })
      game.stepFrame()
      expect(internalP.states.has(12)).toBe(true)
      expect(internalP.manaFixed).toBe(6 * FIXED_ONE - expectedTickCost256)

      // Subsequent channeling cast while in STATE_INFERNO (12) with 2 mana (512 < 1536) succeeds!
      internalP.manaFixed = 2 * FIXED_ONE
      internalP.mana = 2
      game.enqueueCommand(pid, {
        type: 'CastSkillAtLocation',
        skillId,
        x: 106,
        y: 100,
      })
      game.stepFrame()
      expect(internalP.states.has(12)).toBe(true)
      expect(internalP.manaFixed).toBe(2 * FIXED_ONE - expectedTickCost256)

      // Moving clears STATE_INFERNO (12), so the next cast with < 6 mana is rejected again
      game.enqueueCommand(pid, {
        type: 'WalkToLocation',
        x: 104,
        y: 100,
      })
      game.stepFrame()
      expect(internalP.states.has(12)).toBe(false)
    }
  })

  it('enforces usemanaondo on Plague Javelin (#25) and Blade Fury (#266): deducts mana on the Do frame instead of SrvStFunc start (0x6FCBFD00 / 0x6FCC19A0)', async () => {
    const registry = await getSharedDataRegistry()
    const poisonJav = registry.getSkillById(15)! // Poison Javelin (#15): srvStFunc = 4, useManaOnDo = 0
    const plagueJav = registry.getSkillById(25)! // Plague Javelin (#25): srvStFunc = 4, useManaOnDo = 1
    expect(poisonJav.srvStFunc).toBe(4)
    expect(poisonJav.useManaOnDo).toBe(false)
    expect(plagueJav.srvStFunc).toBe(4)
    expect(plagueJav.useManaOnDo).toBe(true)

    // 1. Standard SrvStFunc > 0 skill with useManaOnDo = 0 (Poison Javelin #15, srvStFunc = 4):
    // SKILLS_DoSkillStart (0x6FCBFD00 @ 0x6FCBFE6C) deducts mana at startSkillAnimation
    const psjStats = new UnitStatList(registry)
    const psjBus = new StateBus(psjStats, registry)
    const psjDispatcher = new AnimDispatcher({
      registry,
      statList: psjStats,
      stateBus: psjBus,
      charToken: 'AM',
      weaponClass: 'JAV',
    })
    const psjCost256 = computeSkillManaCost256(poisonJav, 1).manaCost256
    const psjInitialMana = 20 * FIXED_ONE
    psjStats.setMana256(psjInitialMana)
    const psjStart = psjDispatcher.startSkillAnimation({ skill: poisonJav, slvl: 1, currentTick: 0 })
    expect(psjStart.allowed).toBe(true)
    expect(psjStats.getMana256()).toBe(psjInitialMana - psjCost256)
    for (let t = 1; t <= 25; t++) {
      const step = psjDispatcher.tick(t, () => {})
      if (step.actionFired) break
    }
    // No double deduction on the action frame
    expect(psjStats.getMana256()).toBe(psjInitialMana - psjCost256)

    // 2. Plague Javelin (#25, srvStFunc = 4, useManaOnDo = 1, slvl 1 cost = 14 << 7 = 1792 = 7 mana):
    // SKILLS_DoSkillStart (0x6FCBFD00) does NOT deduct mana at start; SKILLS_DoSkillDo (0x6FCC19A0)
    // checks and deducts mana on the action frame!
    const pjStats = new UnitStatList(registry)
    const pjBus = new StateBus(pjStats, registry)
    const pjDispatcher = new AnimDispatcher({
      registry,
      statList: pjStats,
      stateBus: pjBus,
      charToken: 'AM',
      weaponClass: 'JAV',
    })
    const pjCost256 = computeSkillManaCost256(plagueJav, 1).manaCost256
    expect(pjCost256).toBe(14 << 7) // 1792 (7.0 mana)
    const pjInitialMana = 20 * FIXED_ONE
    pjStats.setMana256(pjInitialMana)

    const pjStart = pjDispatcher.startSkillAnimation({ skill: plagueJav, slvl: 1, currentTick: 0 })
    expect(pjStart.allowed).toBe(true)
    // Mana is untouched during wind-up frames before actionFrame!
    expect(pjStats.getMana256()).toBe(pjInitialMana)

    let fired = false
    for (let t = 1; t <= 25; t++) {
      const step = pjDispatcher.tick(t, () => {
        fired = true
      })
      if (step.actionFired) break
    }
    expect(fired).toBe(true)
    expect(pjStats.getMana256()).toBe(pjInitialMana - pjCost256)

    // 3. If mana is drained below manaCost256 during wind-up of a useManaOnDo skill,
    // SKILLS_DoSkillDo (0x6FCC1AE5) aborts on the action frame without firing or spending mana!
    const interruptedDispatcher = new AnimDispatcher({
      registry,
      statList: pjStats,
      stateBus: new StateBus(pjStats, registry),
      charToken: 'AM',
      weaponClass: 'JAV',
    })
    pjStats.setMana256(10 * FIXED_ONE)
    expect(
      interruptedDispatcher.startSkillAnimation({ skill: plagueJav, slvl: 1, currentTick: 200 }).allowed,
    ).toBe(true)
    // Drain mana before the action frame (e.g. Mana Burn hit during wind-up)
    pjStats.setMana256(2 * FIXED_ONE)
    let interruptedFired = false
    for (let t = 201; t <= 230; t++) {
      const step = interruptedDispatcher.tick(t, () => {
        interruptedFired = true
      })
      if (step.anim?.completed) break
    }
    expect(interruptedFired).toBe(false)
    expect(pjStats.getMana256()).toBe(2 * FIXED_ONE)
  })

  it('enforces nocostinstate on Wearwolf (#223) and Wearbear (#228): costs 15 mana in human form and 0 mana (even at 0 mana) when toggling off back to human form (0x6FDA0AF0 / 0x6FCBEC80 / 0x6FC66210)', async () => {
    const registry = await getSharedDataRegistry()

    for (const { skillId, stateId, stateName } of [
      { skillId: 223, stateId: 139, stateName: 'wolf' },
      { skillId: 228, stateId: 140, stateName: 'bear' },
    ]) {
      const skill = registry.getSkillById(skillId)!
      expect(skill.noCostInState).toBe(true)
      expect(skill.auraState).toBe(stateName)

      // 1. AnimDispatcher: in human form with 0 mana, cast is rejected (nocostinstate only applies when in state!)
      const statList = new UnitStatList(registry)
      const stateBus = new StateBus(statList, registry)
      const dispatcher = new AnimDispatcher({
        registry,
        statList,
        stateBus,
        charToken: 'DZ',
      })
      statList.setMana256(0)
      expect(dispatcher.startSkillAnimation({ skill, slvl: 1, currentTick: 0 }).allowed).toBe(false)

      // In wolf/bear state with 0 mana, AnimDispatcher allows the unmorph cast and deducts 0 mana!
      stateBus.applyState({ stateNameOrId: stateName, slvl: 1, durationFrames: 1000 })
      const unshiftStart = dispatcher.startSkillAnimation({ skill, slvl: 1, currentTick: 10 })
      expect(unshiftStart.allowed).toBe(true)
      for (let t = 11; t <= 35; t++) {
        const res = dispatcher.tick(t, () => {})
        if (res.actionFired) break
      }
      expect(statList.getMana256()).toBe(0)

      // 2. GameInstance: full human -> morph (15 mana) -> unmorph at 0 mana (0 mana, clears state & clamps HP)
      const game = new GameInstance({ registry, areaId: 2 })
      const pid = game.addPlayer({
        name: 'Shapeshifter',
        classId: 5,
        level: 30,
        x: 100,
        y: 100,
        areaId: 2,
        skills: { [skillId]: 1 },
      })
      const internalP = (game as any).players.get(pid)
      internalP.states.add(85) // nomanaregen to isolate skill cast mana changes

      // Human form with 10 mana (< 15): rejected
      internalP.manaFixed = 10 * FIXED_ONE
      internalP.mana = 10
      game.enqueueCommand(pid, {
        type: 'CastSkillAtLocation',
        skillId,
        x: 100,
        y: 100,
      })
      game.stepFrame()
      expect(internalP.states.has(stateId)).toBe(false)
      expect(internalP.manaFixed).toBe(10 * FIXED_ONE)

      // Human form with 15 mana (3840): morphs into wolf/bear and spends 15 mana (3840 -> 0)
      internalP.manaFixed = 15 * FIXED_ONE
      internalP.mana = 15
      game.enqueueCommand(pid, {
        type: 'CastSkillAtLocation',
        skillId,
        x: 100,
        y: 100,
      })
      game.stepFrame()
      expect(internalP.states.has(stateId)).toBe(true)
      expect(internalP.manaFixed).toBe(0)

      // Advance past Wearwolf/Wearbear's 25-frame skill delay before recasting to toggle off
      game.stepFrames(25)

      // While in wolf/bear form with 0 mana, recasting the same morph skill toggles off to human form with 0 mana spent!
      internalP.states.add(120) // feralrage
      internalP.states.add(117) // maul
      game.enqueueCommand(pid, {
        type: 'CastSkillAtLocation',
        skillId,
        x: 100,
        y: 100,
      })
      game.stepFrame()
      expect(internalP.states.has(stateId)).toBe(false)
      expect(internalP.states.has(120)).toBe(false)
      expect(internalP.states.has(117)).toBe(false)
      expect(internalP.manaFixed).toBe(0)
    }
  })
})
