/**
 * Issue #1690 — calc `/` and `^` semantics must match Fog `#10253` in both TS evaluators:
 * - op 19 `/` (`0x6FF6A177`): `idiv`; a zero divisor pushes 0 for that sub-expression only
 *   (`0x6FF6A19F -> 0x6FF6A008`), the surrounding formula keeps evaluating.
 * - op 20 `^` (`0x6FF6A234`): exponent `<= 0` -> 1 (`0x6FF6A25C..0x6FF6A270`), else repeated 32-bit `imul`.
 */
import { describe, expect, it } from 'vitest'
import { calcDiv, calcPow, evaluateCalc } from '../../src/common/data/calc-ast.ts'
import type { SkillRecord } from '../../src/common/data/data-registry.ts'
import { SKILLS_BY_ID } from '../../src/common/data/skills-catalog.ts'
import {
  buildSkillFormulaContext,
  compileSkillDescFormula,
  createInitialState,
} from '../../src/common/skills/skill-calc-engine.ts'

describe('issue #1690: calc / and ^ semantics (Fog #10253)', () => {
  it('calcDiv truncates toward zero and maps a zero divisor to 0', () => {
    expect(calcDiv(7, 2)).toBe(3)
    expect(calcDiv(-7, 2)).toBe(-3)
    expect(calcDiv(5, 0)).toBe(0)
    expect(calcDiv(0, 0)).toBe(0)
  })

  it('calcPow returns 1 for exponent <= 0 and wraps like 32-bit imul', () => {
    expect(calcPow(5, 0)).toBe(1)
    expect(calcPow(5, -2)).toBe(1)
    expect(calcPow(0, 0)).toBe(1)
    expect(calcPow(2, 10)).toBe(1024)
    expect(calcPow(-3, 3)).toBe(-27)
    expect(calcPow(2, 31)).toBe(-2147483648)
    expect(calcPow(2, 32)).toBe(0)
  })

  const activeSkill = { param1: 0, param2: 4, param3: 3 } as unknown as SkillRecord
  const calcCtx = { activeSkill, slvl: 5, blvl: 5 }

  it('calc-ast: /0 zeroes only the quotient; ^ with exponent <= 0 is 1', () => {
    expect(evaluateCalc('10 + lvl/par1', calcCtx)).toBe(10)
    expect(evaluateCalc('lvl/par1 + par2*3', calcCtx)).toBe(12)
    expect(evaluateCalc('par3^par1', calcCtx)).toBe(1)
    expect(evaluateCalc('par3^(0-1)', calcCtx)).toBe(1)
    expect(evaluateCalc('par3^par2', calcCtx)).toBe(81)
  })

  it('tooltip evaluator (skill-calc-engine) agrees with calc-ast', () => {
    const skill = SKILLS_BY_ID[36]!
    const { ctx } = buildSkillFormulaContext(createInitialState('sor'), skill, 5)
    const zeroCtx = { ...ctx, params: { ...ctx.params, par1: 0, par2: 4, par3: 3 } }
    expect(compileSkillDescFormula('10 + lvl/par1')(zeroCtx)).toBe(10) // was NaN -> whole formula 0
    expect(compileSkillDescFormula('lvl/par1 + par2*3')(zeroCtx)).toBe(12)
    expect(compileSkillDescFormula('par3^par1')(zeroCtx)).toBe(1)
    expect(compileSkillDescFormula('par3^par2')(zeroCtx)).toBe(81)
    expect(compileSkillDescFormula('lvl*2/3')(zeroCtx)).toBe(3)
  })
})
