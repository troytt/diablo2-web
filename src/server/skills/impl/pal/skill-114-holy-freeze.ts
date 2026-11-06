/**
 * Diablo II: Lord of Destruction v1.13c — Skill #114: Holy Freeze (PAL)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 114 ("Holy Freeze")
 * - Class: "pal"
 * - Required Level: 18
 * - Server Functions: srvstfunc=0, srvdofunc=81, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="holywind", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="skill('Resist Cold'.blvl)*par8+skill('Salvation'.blvl)*par7", DmgSymPerCalc="", ELenSymPerCalc=""
 */
import type {
  SkillEvalContext,
  SkillEvalResult,
  SkillExecContext,
  SkillExecOutcome,
  SkillModule,
} from '../../types.ts'
import { evaluateSkillCore113c, executeSkillCore113c } from '../../registry.ts'

export const skillModule: SkillModule = {
  skillId: 114,
  name: "Holy Freeze",
  charClass: "pal",
  srvStFunc: 0,
  srvDoFunc: 81,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-114-holy-freeze',
      ],
    }
  },
}

export { calculateHolyFreezeStats } from '../../skills.ts'
export default skillModule
