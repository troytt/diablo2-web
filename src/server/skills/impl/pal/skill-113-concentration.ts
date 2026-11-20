/**
 * Diablo II: Lord of Destruction v1.13c — Skill #113: Concentration (PAL)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 113 ("Concentration")
 * - Class: "pal"
 * - Required Level: 18
 * - Server Functions: srvstfunc=0, srvdofunc=65, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="concentration", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 113,
  name: "Concentration",
  charClass: "pal",
  srvStFunc: 0,
  srvDoFunc: 65,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-113-concentration',
      ],
    }
  },
}

export { calculateConcentrationStats } from '../../skills.ts'
export default skillModule
