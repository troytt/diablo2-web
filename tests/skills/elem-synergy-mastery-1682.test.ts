/**
 * Issue #1682 — SkillCalc elemental codes (kb/skills/d2common-skillcalc-callbacks-113c.md §2/§4):
 * - edmn/edmx (0x6FDA11F4/0x6FDA1212) and edns/edxs (0x6FDA1471/0x6FDA148C) call #10121/#11091 with bMastery=0,
 *   which already include EDmgSymPerCalc (min side gated by 0x6FDA04C7).
 * - enma/exma/enms/exms (0x6FDA15E6..0x6FDA1658) pass bMastery=1: + v * stat(329..332 by EType) / 100 (0x6FD9F870).
 * - edln/edma (0x6FDA1230/0x6FDA1622) -> #10510 0x6FD9E900: 3-band ELen + ELenSymPerCalc (flag ignored).
 */
import { describe, expect, it } from 'vitest'
import { compute3BandDuration, compute5BandScaling, evaluateCalc } from '../../src/common/data/calc-ast.ts'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { SKILLS_BY_ID } from '../../src/common/data/skills-catalog.ts'
import {
  buildSkillFormulaContext,
  createInitialState,
} from '../../src/common/skills/skill-calc-engine.ts'

describe('issue #1682: SkillCalc edXX include synergy, enXX/exXX add caster mastery, edln synergised', () => {
  it('calc-ast (server): Enchant edmn/enma/exma with Warmth synergy and passive_fire_mastery', async () => {
    const registry = await getSharedDataRegistry()
    const skill = registry.getSkillById(52)! // Enchant: HitShift 7, EDmgSymPerCalc = Warmth.blvl * par8 (9)
    const warmth = 10
    const fireMastery = 51
    const ctx = {
      registry,
      activeSkill: skill,
      slvl: 10,
      blvl: 10,
      getBaseSkillLevel: (id: number) => (id === 37 ? warmth : 0),
      getUnitStat: (stat: string | number) => (stat === 329 ? fireMastery : 0),
    }
    const min256 = compute5BandScaling(10, skill.eMin, skill.eMinLev1, skill.eMinLev2, skill.eMinLev3, skill.eMinLev4, skill.eMinLev5) << skill.hitShift
    const max256 = compute5BandScaling(10, skill.eMax, skill.eMaxLev1, skill.eMaxLev2, skill.eMaxLev3, skill.eMaxLev4, skill.eMaxLev5) << skill.hitShift
    const syn = warmth * skill.param8
    const synMin = min256 + Math.trunc((min256 * syn) / 100)
    const synMax = max256 + Math.trunc((max256 * syn) / 100)
    expect(evaluateCalc('edns', ctx)).toBe(synMin)
    expect(evaluateCalc('edxs', ctx)).toBe(synMax)
    expect(evaluateCalc('edmn', ctx)).toBe(synMin >> 8)
    expect(evaluateCalc('edmx', ctx)).toBe(synMax >> 8)
    expect(evaluateCalc('enms', ctx)).toBe(synMin + Math.trunc((synMin * fireMastery) / 100))
    expect(evaluateCalc('exma', ctx)).toBe((synMax + Math.trunc((synMax * fireMastery) / 100)) >> 8)
    // No caster unit -> no mastery term (0x6FDA053A requires a unit).
    const { getUnitStat: _drop, ...noUnit } = ctx
    expect(evaluateCalc('enms', noUnit)).toBe(synMin)
  })

  it('calc-ast (server): Ice Blast edln/edma include the Glacial Spike length synergy', async () => {
    const registry = await getSharedDataRegistry()
    const skill = registry.getSkillById(45)! // Ice Blast: ELenSymPerCalc = Glacial Spike.blvl * par7 (10)
    const ctx = { registry, activeSkill: skill, slvl: 10, blvl: 10, getBaseSkillLevel: (id: number) => (id === 55 ? 10 : 0) }
    const base = compute3BandDuration(10, skill.eLen, skill.eLevLen1, skill.eLevLen2, skill.eLevLen3)
    expect(base).toBe(120)
    expect(evaluateCalc('edln', ctx)).toBe(240)
    expect(evaluateCalc('edma', ctx)).toBe(240)
  })

  it('tooltip engine: edln, edmn and enma follow the binary', () => {
    const state = createInitialState('sor')
    ;(state.hardPoints as Record<number, number>)[55] = 10 // 10 hard points in Glacial Spike
    const iceBlast = SKILLS_BY_ID[45]!
    const { ctx } = buildSkillFormulaContext(state, iceBlast, 10)
    expect(ctx.edln).toBe(240)

    const fire = createInitialState('sor')
    ;(fire.hardPoints as Record<number, number>)[61] = 1 // Fire Mastery lvl 1: passive_fire_mastery = 30
    const inferno = SKILLS_BY_ID[41]! // Inferno does not list the mastery but is EType fire
    const built = buildSkillFormulaContext(fire, inferno, 1)
    expect(built.ctx.enms).toBe((built.ctx.edns ?? 0) + Math.trunc(((built.ctx.edns ?? 0) * 30) / 100))
    expect(built.ctx.edmn).toBe((built.ctx.edns ?? 0) >> 8)
  })
})
