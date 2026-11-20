/**
 * Issue #1678 — SkillCalc `dm12/dm34/dm56/dm78` and MissCalc `sd12/sd34/dd12` must follow D2Common 1.13c
 * `0x6FD9DC30(lvl, a, b)`:
 *   x = (lvl * 110) / (lvl + 6)   (idiv, truncated first)
 *   r = x * (b - a) / 100 + a      (idiv)
 *   if (r > b) r = b
 * dm12/34/56 wrappers (`0x6FD9E680/0x6FD9E630/0x6FD9E5E0`) return 0 for lvl <= 0; dm78 (`0x6FDA1148`) and the
 * MissCalc callbacks (`0x6FDBA964..0x6FDBAA54`) call the helper unguarded.
 */
import { describe, expect, it } from 'vitest'
import {
  computeDiminishingReturns,
  computeDiminishingReturnsRaw,
  evaluateCalc,
} from '../../src/common/data/calc-ast.ts'
import type { SkillRecord } from '../../src/common/data/data-registry.ts'
import { SKILLS_BY_ID } from '../../src/common/data/skills-catalog.ts'
import { buildSkillFormulaContext, createInitialState } from '../../src/common/skills/skill-calc-engine.ts'

/** Independent integer reference of 0x6FD9DC30 (C idiv truncates toward zero). */
function idiv(a: number, b: number): number {
  return Math.trunc(a / b)
}
function dmRef(lvl: number, a: number, b: number): number {
  const x = idiv(lvl * 110, lvl + 6)
  const r = idiv(x * (b - a), 100) + a
  return r > b ? b : r
}

describe('issue #1678: dmXY diminishing returns (D2Common 0x6FD9DC30)', () => {
  it('matches the binary at the audit sample points', () => {
    expect(computeDiminishingReturns(10, 100, 1)).toBe(23) // Pierce dm12 lvl 1 (old TS: 24)
    expect(computeDiminishingReturns(50, 500, 1)).toBe(117) // Blaze dm12 lvl 1 (old TS: 120)
    expect(computeDiminishingReturns(50, 500, 8)).toBe(329) // Blaze dm12 lvl 8 (old TS: 332)
    expect(computeDiminishingReturns(25, 70, 1)).toBe(31) // Lower Resist dm56 lvl 1 (old TS: 32)
    expect(computeDiminishingReturns(5, 80, 8)).toBe(51) // Critical Strike dm12 lvl 8 (old TS: 52)
    expect(computeDiminishingReturns(20, 65, 1)).toBe(26) // Weapon Block dm12 lvl 1
    expect(computeDiminishingReturns(20, 65, 20)).toBe(57) // Weapon Block dm12 lvl 20
  })

  it('caps at Param[Y] above the 100% knee', () => {
    // x(lvl) > 100 for lvl > 60, so the uncapped value would exceed b.
    expect(computeDiminishingReturns(10, 100, 99)).toBe(100)
    expect(computeDiminishingReturns(5, 80, 200)).toBe(80)
    expect(computeDiminishingReturns(50, 500, 120)).toBe(500)
  })

  it('dm12/34/56 return 0 for lvl <= 0; the raw helper (dm78, sd/dd) is unguarded', () => {
    expect(computeDiminishingReturns(10, 100, 0)).toBe(0)
    expect(computeDiminishingReturns(10, 100, -3)).toBe(0)
    expect(computeDiminishingReturnsRaw(10, 100, 0)).toBe(10)
  })

  it('evaluateCalc dm/sd/dd codes use the binary helper', () => {
    const activeSkill = {
      param1: 10, param2: 100, param3: 35, param4: 150, param5: 25, param6: 70, param7: 50, param8: 500,
    } as unknown as SkillRecord
    for (const slvl of [1, 3, 8, 12, 20, 45, 61, 99]) {
      const ctx = { activeSkill, slvl, blvl: slvl }
      expect(evaluateCalc('dm12', ctx)).toBe(dmRef(slvl, 10, 100))
      expect(evaluateCalc('sd12', ctx)).toBe(dmRef(slvl, 10, 100))
      expect(evaluateCalc('dm34', ctx)).toBe(dmRef(slvl, 35, 150))
      expect(evaluateCalc('sd34', ctx)).toBe(dmRef(slvl, 35, 150))
      expect(evaluateCalc('dm56', ctx)).toBe(dmRef(slvl, 25, 70))
      expect(evaluateCalc('dm78', ctx)).toBe(dmRef(slvl, 50, 500))
    }
  })

  it('class sweep: every catalog skill (210 player skills) x every dm pair x lvl 1..99 agrees in the tooltip engine', () => {
    const pairs = [
      ['dm12', 'par1', 'par2'],
      ['dm34', 'par3', 'par4'],
      ['dm56', 'par5', 'par6'],
      ['dm78', 'par7', 'par8'],
    ] as const
    const state = createInitialState('ama')
    let checked = 0
    for (const skill of Object.values(SKILLS_BY_ID)) {
      const p = (skill.params ?? {}) as Record<string, number | undefined>
      for (let lvl = 1; lvl <= 99; lvl++) {
        const { ctx } = buildSkillFormulaContext(state, skill, lvl)
        for (const [code, pa, pb] of pairs) {
          const want = dmRef(lvl, p[pa] ?? 0, p[pb] ?? 0)
          if (ctx[code] !== want) {
            throw new Error(`skill #${skill.id} ${code} lvl ${lvl}: got ${ctx[code]}, want ${want}`)
          }
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(210 * 99 * 4)
  })
})
