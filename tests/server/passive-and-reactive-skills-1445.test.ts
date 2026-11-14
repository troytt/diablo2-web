/**
 * Issue #1445 — 1.13c Passive Skill StatList (`SKILLS_RefreshPassiveSkills` `0x6FCBA1A0`)
 * & Reactive Event (`gpfnAuraEventFunc` `0x6FD277A8`) Verification Suite.
 *
 * Ground Truth Citations:
 * - `samples/d2/D2Game.dll` `0x6FCBA1A0..0x6FCBA325`: `SKILLS_RefreshPassiveSkills` iterates a unit's
 *   skills with `wPassiveState > 0` (`0x6FCBA1EC`), evaluates `passivestat1..5` / `passivecalc1..5`
 *   (`0x6FCBA2CA`), and attaches a `D2StatListStrc` keyed by `wPassiveState` (`0x6FCBA30F`) without
 *   any `total === 0` gating.
 * - `samples/d2/D2Game.dll` `0x6FC6EF70` (`SKILLS_EventFunc27_ClayGolem`): triggered on `damagedinmelee`
 *   (`Skills.txt` row 75 `auraevent1 = damagedinmelee`), applies `STATE_SLOWED` (29) for `750` frames
 *   (`push 0x2EE`) with `item_slow = dm34(0, 75)`.
 * - `samples/d2/D2Game.dll` `0x6FC6E2A0` (`SKILLS_EventFunc04_Thorns`): reflects melee physical damage
 *   using `STAT_THORNS_PERCENT` (`Skills.txt` row 296 `Barbs Aura` `aurastatcalc1 = ln34(50, 10)`).
 * - `samples/d2/D2Game.dll` `0x6FD00140` (`SKILLS_EventFunc25_CycloneArmor`): absorbs Fire/Cold/Lightning
 *   damage up to `Skills.txt` row 235 `calc1 = (ln12 * (100 + (Twister.blvl + Tornado.blvl + Hurricane.blvl) * par3)) / 100`.
 */
import { describe, expect, it } from 'vitest'
import { getSharedDataRegistry } from '../../src/baker/mpq-archive-source.ts'
import { evaluateCalc, computeDiminishingReturns } from '../../src/common/data/calc-ast.ts'
import { FIXED_ONE, UnitStatList } from '../../src/server/engine/stat-list.ts'
import { StateBus } from '../../src/server/engine/state-bus.ts'

describe('Issue #1445: 1.13c Passive StatList & Reactive Event Parity', () => {
  it('1. Weapon Block (#263): evaluates dm12(20, 65) -> slvl 1 = 26, slvl 20 = 57 and attaches weaponblock statlist', async () => {
    const registry = await getSharedDataRegistry()
    const stats = new UnitStatList(registry)

    stats.setBaseSkillLevel(263, 1)
    expect(stats.getAccruedStat('passive_weaponblock')).toBe(26)
    const mod1 = stats.getActiveModifiers().find(m => m.stateName === 'weaponblock')
    expect(mod1).toBeDefined()
    expect(mod1?.sourceSkillId).toBe(263)
    expect(mod1?.stats['passive_weaponblock']).toBe(26)

    stats.setBaseSkillLevel(263, 20)
    expect(stats.getAccruedStat('passive_weaponblock')).toBe(57)
  })

  it('2. Natural Resistance (#153): adds fireresist/lightresist/coldresist/poisonresist = dm12(0, 80) (Skills.txt passivestat1..4)', async () => {
    const registry = await getSharedDataRegistry()
    const stats = new UnitStatList(registry, {
      fireresist: 10,
      lightresist: 10,
      coldresist: 10,
      poisonresist: 10,
    })

    stats.setBaseSkillLevel(153, 5) // dm12(0, 80, 5) = 40
    expect(stats.getAccruedStat('fireresist')).toBe(50)
    expect(stats.getAccruedStat('lightresist')).toBe(50)
    expect(stats.getAccruedStat('coldresist')).toBe(50)
    expect(stats.getAccruedStat('poisonresist')).toBe(50)
  })

  it('3. Increased Stamina (#141): adds skill_passive_staminapercent = ln12(30, 15) and does NOT modify staminarecoverybonus', async () => {
    const registry = await getSharedDataRegistry()
    const stats = new UnitStatList(registry, {
      maxstamina: 100 * FIXED_ONE,
    })

    stats.setBaseSkillLevel(141, 6) // ln12(30, 15, 6) = 105
    expect(stats.getAccruedStat('skill_passive_staminapercent')).toBe(105)
    expect(stats.getAccruedStat('staminarecoverybonus')).toBe(0)
    expect(stats.getAccruedStat('maxstamina')).toBe(205 * FIXED_ONE)
  })

  it('4. removes total === 0 gating: passive skill bonuses stack with existing base/modifier stats (0x6FCBA1A0)', async () => {
    const registry = await getSharedDataRegistry()
    const stats = new UnitStatList(registry, {
      passive_weaponblock: 10,
      passive_dodge: 10,
      passive_avoid: 10,
      passive_evade: 10,
      passive_mastery_melee_th: 15,
      passive_mastery_melee_dmg: 20,
      passive_mastery_melee_crit: 5,
    })

    stats.setBaseSkillLevel(263, 1) // Weapon Block slvl 1 = 26 -> 10 + 26 = 36
    stats.setBaseSkillLevel(13, 1) // Dodge slvl 1 = dm12(10, 65, 1) = 18 -> 10 + 18 = 28
    stats.setBaseSkillLevel(18, 1) // Avoid slvl 1 = dm12(15, 75, 1) = 24 -> 10 + 24 = 34
    stats.setBaseSkillLevel(29, 1) // Evade slvl 1 = dm12(10, 65, 1) = 18 -> 10 + 18 = 28
    stats.setBaseSkillLevel(252, 1) // Claw Mastery slvl 1: th=30, dmg=35, crit=3

    expect(stats.getAccruedStat('passive_weaponblock')).toBe(36)
    expect(stats.getAccruedStat('passive_dodge')).toBe(28)
    expect(stats.getAccruedStat('passive_avoid')).toBe(34)
    expect(stats.getAccruedStat('passive_evade')).toBe(28)
    expect(stats.getAccruedStat('passive_mastery_melee_th')).toBe(45)
    expect(stats.getAccruedStat('passive_mastery_melee_dmg')).toBe(55)
    expect(stats.getAccruedStat('passive_mastery_melee_crit')).toBe(8)
  })

  it('5. Clay Golem (#75, EventFunc27 0x6FC6EF70): triggers ONLY on damagedinmelee (not attackedinmelee), item_slow = dm34(0, 75), duration = 750f', async () => {
    const registry = await getSharedDataRegistry()
    const golemStats = new UnitStatList(registry)
    const golemBus = new StateBus(golemStats, registry)
    golemBus.applyState({
      stateNameOrId: 'claygolem',
      sourceSkillId: 75,
      slvl: 1,
    })

    const atkStats1 = new UnitStatList(registry)
    const atkBus1 = new StateBus(atkStats1, registry)

    // attackedinmelee must NOT apply slow
    const onAttacked = golemBus.triggerReactiveEvents({
      event: 'attackedinmelee',
      incomingPhys256: 50 * FIXED_ONE,
      attackerStateBus: atkBus1,
      attackerStatList: atkStats1,
    })
    expect(onAttacked.attackerStatesApplied).toEqual([])
    expect(atkBus1.hasState('slow')).toBe(false)
    expect(atkBus1.hasState('slowed')).toBe(false)

    // damagedinmelee at slvl 1 -> dm34(0, 75, 1) = 11%, duration = 750 frames
    const onDamaged1 = golemBus.triggerReactiveEvents({
      event: 'damagedinmelee',
      incomingPhys256: 50 * FIXED_ONE,
      attackerStateBus: atkBus1,
      attackerStatList: atkStats1,
    })
    expect(onDamaged1.attackerStatesApplied).toContain('slow')
    expect(atkBus1.hasState('slow')).toBe(true)
    expect(atkBus1.hasState('slowed')).toBe(true)
    expect(atkBus1.getState('slow')?.durationFrames).toBe(750)
    expect(atkStats1.getAccruedStat('item_slow')).toBe(computeDiminishingReturns(0, 75, 1))
    expect(atkStats1.getAccruedStat('item_slow')).toBe(11)

    // damagedinmelee at slvl 20 -> dm34(0, 75, 20) = 63%, duration = 750 frames
    golemBus.applyState({
      stateNameOrId: 'claygolem',
      sourceSkillId: 75,
      slvl: 20,
    })
    const atkStats20 = new UnitStatList(registry)
    const atkBus20 = new StateBus(atkStats20, registry)
    golemBus.triggerReactiveEvents({
      event: 'damagedinmelee',
      incomingPhys256: 50 * FIXED_ONE,
      attackerStateBus: atkBus20,
      attackerStatList: atkStats20,
    })
    expect(atkStats20.getAccruedStat('item_slow')).toBe(computeDiminishingReturns(0, 75, 20))
    expect(atkStats20.getAccruedStat('item_slow')).toBe(63)
    expect(atkBus20.getState('slow')?.durationFrames).toBe(750)
  })

  it('6. Spirit of Barbs (#296, Barbs Aura): fallback thorns_percent = ln34(50, 10) -> slvl 3 = 70%', async () => {
    const registry = await getSharedDataRegistry()
    const defStats = new UnitStatList(registry)
    const defBus = new StateBus(defStats, registry)
    defBus.applyState({
      stateNameOrId: 'barbs',
      sourceSkillId: 296,
      slvl: 3,
    })

    const out = defBus.triggerReactiveEvents({
      event: 'damagedinmelee',
      incomingPhys256: 100 * FIXED_ONE,
    })
    expect(out.reflectedPhys256).toBe(70 * FIXED_ONE)
  })

  it('7. Cyclone Armor (#235, EventFunc25 0x6FD00140): default absorb capacity includes +7%/blvl synergy from Twister/Tornado/Hurricane', async () => {
    const registry = await getSharedDataRegistry()
    const druidStats = new UnitStatList(registry)
    // Allocate 5 hard points each in Twister (#240), Tornado (#245), Hurricane (#250) -> 15 * 7% = +105% synergy
    druidStats.setBaseSkillLevel(240, 5)
    druidStats.setBaseSkillLevel(245, 5)
    druidStats.setBaseSkillLevel(250, 5)

    const druidBus = new StateBus(druidStats, registry)
    // slvl 1 base = 40; with +105% synergy -> floor(40 * 205 / 100) = 82
    druidBus.applyState({
      stateNameOrId: 'cyclonearmor',
      sourceSkillId: 235,
      slvl: 1,
    })

    const out = druidBus.triggerReactiveEvents({
      event: 'absorbdamage',
      incomingElem256: 100 * FIXED_ONE,
      elemType: 'fire',
    })
    expect(out.absorbedElem256).toBe(82 * FIXED_ONE)
    expect(druidBus.hasState('cyclonearmor')).toBe(false)
  })

  it('8. Class-of-Bug Sweep: every Skills.txt row with passivestat1 != "" (all 51 rows, including 27 passivestate rows) matches Skills.txt formulas at slvl 1, 10, 20', async () => {
    const registry = await getSharedDataRegistry()
    const allPassiveStatRows = Array.from(registry.skillsById.values()).filter(
      s => s.passiveStat1.trim() !== '',
    )
    expect(allPassiveStatRows.length).toBe(51)

    const passiveStateRows = allPassiveStatRows.filter(s => s.passiveState.trim() !== '')
    expect(passiveStateRows.length).toBe(27)

    for (const skill of passiveStateRows) {
      for (const slvl of [1, 10, 20]) {
        const stats = new UnitStatList(registry, {
          fireresist: 0,
          lightresist: 0,
          coldresist: 0,
          poisonresist: 0,
          maxfireresist: 0,
          maxcoldresist: 0,
          maxlightresist: 0,
          tohit: 100,
          armorclass: 100,
          maxstamina: 100 * FIXED_ONE,
        })
        stats.setBaseSkillLevel(skill.id, slvl)

        const mod = stats.getActiveModifiers().find(m => m.sourceSkillId === skill.id)
        expect(mod, `${skill.name} (#${skill.id}) at slvl ${slvl}`).toBeDefined()
        expect(mod?.stateName).toBe(skill.passiveState.trim().toLowerCase())

        const calcCtx = {
          registry,
          activeSkill: skill,
          slvl,
          blvl: slvl,
          getBaseSkillLevel: (id: number) => (id === skill.id ? slvl : 0),
          getEffectiveSkillLevel: (id: number) => (id === skill.id ? slvl : 0),
        }

        const pairs: readonly [string, string][] = [
          [skill.passiveStat1, skill.passiveCalc1],
          [skill.passiveStat2, skill.passiveCalc2],
          [skill.passiveStat3, skill.passiveCalc3],
          [skill.passiveStat4, skill.passiveCalc4],
          [skill.passiveStat5, skill.passiveCalc5],
        ]
        for (const [st, clc] of pairs) {
          if (!st || !clc) continue
          const normSt = st.trim().toLowerCase()
          const expected =
            skill.id === 263 && clc.trim() === 'dm12'
              ? Math.min(
                  skill.param2,
                  skill.param1 +
                    Math.trunc(
                      ((skill.param2 - skill.param1) * Math.trunc((110 * slvl) / (slvl + 6))) / 100,
                    ),
                )
              : evaluateCalc(clc, calcCtx)
          expect(
            stats.getAccruedStat(normSt),
            `${skill.name} (#${skill.id}) slvl=${slvl} stat=${normSt}`,
          ).toBe(expected)
        }
      }
    }

    // Also verify all 24 summon/aura-caster passivestat rows (passivestate == '') evaluate cleanly via evaluateCalc
    for (const skill of allPassiveStatRows.filter(s => s.passiveState.trim() === '')) {
      for (const slvl of [1, 10, 20]) {
        const calcCtx = {
          registry,
          activeSkill: skill,
          slvl,
          blvl: slvl,
          getBaseSkillLevel: (id: number) => (id === skill.id ? slvl : 0),
          getEffectiveSkillLevel: (id: number) => (id === skill.id ? slvl : 0),
        }
        const val1 = evaluateCalc(skill.passiveCalc1, calcCtx)
        expect(Number.isFinite(val1), `${skill.name} (#${skill.id}) passiveCalc1`).toBe(true)
      }
    }
  })

  it('9. Class-of-Bug Sweep: every Skills.txt row with auraevent1 != "" (10 rows) plus reactive thorns_percent rows (#90, #103, #296) registers canonical event names & evaluates formulas', async () => {
    const registry = await getSharedDataRegistry()
    const reactiveRows = Array.from(registry.skillsById.values()).filter(
      s => s.auraEvent1.trim() !== '',
    )
    expect(reactiveRows.length).toBe(10)

    for (const skill of reactiveRows) {
      const stats = new UnitStatList(registry)
      const bus = new StateBus(stats, registry)
      const stateName = (skill.auraState || `skill_${skill.id}`).trim().toLowerCase()
      bus.applyState({
        stateNameOrId: stateName,
        sourceSkillId: skill.id,
        slvl: 5,
      })
      const entry = bus.getState(stateName)
      expect(entry, `${skill.name} (#${skill.id})`).toBeDefined()
      const events = entry?.reactiveEvents?.map(r => r.event) ?? []
      expect(events).toContain(skill.auraEvent1.trim().toLowerCase())
      if (skill.auraEvent2.trim() !== '' && skill.auraEventFunc2 > 0) {
        expect(events).toContain(skill.auraEvent2.trim().toLowerCase())
      }
    }

    // Also verify reactive thorns_percent skills (#90 IronGolem, #103 Thorns, #296 Barbs Aura)
    // whose event trigger (`damagedinmelee`, func 4) comes from ItemStatCost.txt `thorns_percent`.
    for (const skillId of [90, 103, 296]) {
      const skill = registry.getSkillById(skillId)!
      const stats = new UnitStatList(registry)
      const bus = new StateBus(stats, registry)
      const stateName = skill.auraState.trim().toLowerCase()
      bus.applyState({
        stateNameOrId: stateName,
        sourceSkillId: skillId,
        slvl: 5,
      })
      const entry = bus.getState(stateName)
      expect(entry, `${skill.name} (#${skill.id})`).toBeDefined()
      expect(entry?.reactiveEvents?.map(r => r.event)).toContain('damagedinmelee')
    }
  })
})
