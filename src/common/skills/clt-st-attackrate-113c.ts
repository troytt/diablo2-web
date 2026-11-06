/**
 * Temporary `attackrate` (stat 68) that a SkillCltStFunc puts on the caster for the skill's animation.
 *
 * `D2Client.dll` `0x6FB50880(unit, value)`: allocates a statlist (`0x6FABC442`, flag 4), attaches it to the unit
 * (`0x6FABC36A`) and sets stat `0x44` (68 `attackrate`) to `value` (`0x6FABC562`). Callers in the 1.13c
 * SkillCltStFunc table:
 * - CltSt9 `0x6FAF0400` (Skills.txt #270 Dragon Tail): `value = Param4` (`mov edx,[skill+0x154]`, Param4 = -40).
 * - CltSt27 `0x6FB76290` (#133 Double Swing): `value = eval(cltcalc1)` (`[skill+0x114]` → D2Common#10786;
 *   `cltcalc1 = par5`, Param5 = 50).
 */

import { getSkillClientRow113c, type SkillClientRow113c } from './skill-client-113c.ts'

/** Evaluates the 1.13c `cltcalc` forms used by these rows: an integer or `parN`; anything else is rejected. */
function evalCltCalc(row: SkillClientRow113c, expr: string): number {
  const t = expr.trim().toLowerCase()
  if (/^-?\d+$/.test(t)) return Number(t)
  const m = /^par([1-8])$/.exec(t)
  if (m) return row.params[Number(m[1]) - 1] ?? 0
  throw new Error(`Skills.txt #${String(row.id)} cltcalc '${expr}' is not supported by the CltSt attackrate path`)
}

/** Stat 68 value CltSt9 / CltSt27 apply for `skillId`'s animation; 0 for every other skill. */
export function cltStAttackRate113c(skillId: number | undefined): number {
  if (skillId === undefined) return 0
  const row = getSkillClientRow113c(skillId)
  if (!row) return 0
  if (row.cltStFunc === 9) return row.params[3] ?? 0
  if (row.cltStFunc === 27) return evalCltCalc(row, row.cltCalc[0])
  return 0
}
