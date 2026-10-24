/**
 * Diablo II: Lord of Destruction v1.13c — Skill #038: Charged Bolt (SOR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 38 ("Charged Bolt")
 * - Class: "sor"
 * - Required Level: 1
 * - Server Functions: srvstfunc=0, srvdofunc=17, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="chargedbolt", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Lightning'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 38,
  name: "Charged Bolt",
  charClass: "sor",
  srvStFunc: 0,
  srvDoFunc: 17,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-038-charged-bolt',
      ],
    }
  },
}

export default skillModule
