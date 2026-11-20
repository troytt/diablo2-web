/**
 * #1601 — SkillCltStFunc temporary attackrate (D2Client.dll 0x6FB50880 sets stat 68): CltSt9 #270 Dragon Tail
 * Param4 = -40, CltSt27 #133 Double Swing eval(cltcalc1 = par5) = +50.
 */

import { describe, expect, it } from 'vitest'
import { cltStAttackRate113c } from '../../src/common/skills/clt-st-attackrate-113c.ts'
import { computeEffectiveAnimRate113c } from '../../src/common/units/char-anim-speed.ts'
import { SKILL_CLIENT_ROWS_113C } from '../../src/common/skills/skill-client-113c.ts'

describe('CltSt9 / CltSt27 temporary attackrate (#1601)', () => {
  it('reads the values from Skills.txt', () => {
    expect(cltStAttackRate113c(270)).toBe(-40)
    expect(cltStAttackRate113c(133)).toBe(50)
    expect(cltStAttackRate113c(0)).toBe(0)
    expect(cltStAttackRate113c(undefined)).toBe(0)
  })

  it('only cltstfunc 9 / 27 rows exist for this path in 1.13c', () => {
    expect(SKILL_CLIENT_ROWS_113C.filter(r => r.cltStFunc === 9 || r.cltStFunc === 27).map(r => r.id)).toEqual([133, 270])
  })

  it('Dragon Tail kick (kk) is slower than a plain kick by the -40 attackrate', () => {
    const plain = computeEffectiveAnimRate113c('kk', { itemIas: 0, skillIas: 0 })
    const tail = computeEffectiveAnimRate113c('kk', { itemIas: 0, skillIas: 0, skillId: 270 })
    expect(tail).toBe(plain - 40)
  })

  it('Double Swing sequence keeps +50 (now from cltcalc1) on top of the -30 sequence penalty', () => {
    const base = computeEffectiveAnimRate113c('sq', { itemIas: 0, skillIas: 0, seqTrans: 'A1' })
    const ds = computeEffectiveAnimRate113c('sq', { itemIas: 0, skillIas: 0, skillId: 133, seqTrans: 'A1' })
    expect(ds - base).toBe(50)
  })
})
