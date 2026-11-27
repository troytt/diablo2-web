import { describe, expect, it } from 'vitest'
import { evaluateCalc, computeSkillMps113c } from '../../src/common/data/calc-ast.ts'
import { getSharedDataRegistry } from '../../src/common/data/data-registry.ts'
import { SKILLS_BY_ID } from '../../src/common/data/skills-catalog.ts'
import {
  WEAPON_MASTERY_PASSIVE_CALCS_113C,
  buildSkillFormulaContext,
  createInitialState,
  evaluateSkillDescLines,
} from '../../src/common/skills/skill-calc-engine.ts'

describe('#1683 SkillCalc math / madm / macr (D2Common 0x6FD9E7A0)', () => {
  it('re-derives WEAPON_MASTERY_PASSIVE_CALCS_113C from Skills.txt passivestat1..5 / passivecalc1..5', async () => {
    const registry = await getSharedDataRegistry()
    const derived: Record<number, { th: string; dmg: string; crit: string }> = {}
    for (let id = 0; id <= 356; id += 1) {
      const sk = registry.getSkillById(id)
      if (!sk) continue
      const pairs: readonly (readonly [string, string])[] = [
        [sk.passiveStat1, sk.passiveCalc1],
        [sk.passiveStat2, sk.passiveCalc2],
        [sk.passiveStat3, sk.passiveCalc3],
        [sk.passiveStat4, sk.passiveCalc4],
        [sk.passiveStat5, sk.passiveCalc5],
      ]
      let th = ''
      let dmg = ''
      let crit = ''
      for (const [stat, calc] of pairs) {
        const s = stat.trim().toLowerCase()
        if (!th && (s === 'passive_mastery_melee_th' || s === 'passive_mastery_throw_th')) th = calc
        if (!dmg && (s === 'passive_mastery_melee_dmg' || s === 'passive_mastery_throw_dmg')) dmg = calc
        if (!crit && (s === 'passive_mastery_melee_crit' || s === 'passive_mastery_throw_crit')) crit = calc
      }
      if (th || dmg || crit) {
        derived[sk.id] = { th, dmg, crit }
      }
    }
    expect(derived).toEqual(WEAPON_MASTERY_PASSIVE_CALCS_113C)
  })

  it('evaluates math, madm and macr identically in calc-ast and skill-calc-engine across all 7 weapon masteries', async () => {
    const registry = await getSharedDataRegistry()
    const masteryIds = [127, 128, 129, 134, 135, 136, 252]
    for (const id of masteryIds) {
      const skTxt = registry.getSkillById(id)!
      const skCat = SKILLS_BY_ID[id]!
      const state = createInitialState(skCat.classCode)
      for (const lvl of [1, 5, 10, 20]) {
        const { ctx } = buildSkillFormulaContext(state, skCat, lvl)
        const astCtx = { activeSkill: skTxt, slvl: lvl, blvl: lvl }
        expect(ctx.math).toBe(evaluateCalc('math', astCtx))
        expect(ctx.madm).toBe(evaluateCalc('madm', astCtx))
        expect(ctx.macr).toBe(evaluateCalc('macr', astCtx))
      }
    }
    // Sword Mastery (#127) level 1: ln12 = 28 (AR%), ln34 = 28 (Damage%), dm56(0, 35, 1) = 5 (Crit%)
    const swordCat = SKILLS_BY_ID[127]!
    const barState = createInitialState('bar')
    barState.hardPoints[127] = 1
    const lines = evaluateSkillDescLines(barState, swordCat, 1, 'desc')
    const enTexts = lines.map(l => l.textEn)
    expect(enTexts).toContain('Damage: +28 percent')
    expect(enTexts).toContain('Attack: +28 percent')
    expect(enTexts).toContain('5 Percent Chance of Critical Strike')
  })
})

describe('#1684 SkillCalc mps integer formula (D2Common 0x6FDA1298)', () => {
  it('computes ((((lvl-1)*lvlmana + mana) * 25) / 2 << manashift) >> 8 for Inferno (#41) and Arctic Blast (#230)', async () => {
    const registry = await getSharedDataRegistry()
    // Inferno (#41): mana = 9, lvlmana = 1, manashift = 4 -> lvl 1: ((9*25)/2 << 4) >> 8 = (112 << 4) >> 8 = 7
    expect(computeSkillMps113c(9, 1, 4, 1)).toBe(7)
    expect(computeSkillMps113c(9, 1, 4, 0)).toBe(0)

    const infernoTxt = registry.getSkillById(41)!
    const infernoCat = SKILLS_BY_ID[41]!
    const sorState = createInitialState('sor')
    sorState.hardPoints[41] = 1
    expect(evaluateCalc('mps', { activeSkill: infernoTxt, slvl: 1, blvl: 1 })).toBe(7)
    const infernoLines = evaluateSkillDescLines(sorState, infernoCat, 1, 'desc')
    expect(infernoLines.map(l => l.textEn)).toContain('Mana Cost: 7 per second')

    // Arctic Blast (#230): mana = 6, lvlmana = 0, manashift = 4 -> lvl 1: ((6*25)/2 << 4) >> 8 = (75 << 4) >> 8 = 4
    const abTxt = registry.getSkillById(230)!
    const abCat = SKILLS_BY_ID[230]!
    const druState = createInitialState('dru')
    druState.hardPoints[230] = 1
    expect(evaluateCalc('mps', { activeSkill: abTxt, slvl: 1, blvl: 1 })).toBe(4)
    const abLines = evaluateSkillDescLines(druState, abCat, 1, 'desc')
    expect(abLines.map(l => l.textEn)).toContain('Mana Cost: 4 per second')
  })
})
