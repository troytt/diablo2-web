/**
 * Diablo II: Lord of Destruction v1.13c — Skill #108: Blessed Aim (PAL)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 108 ("Blessed Aim")
 * - Class: "pal"
 * - Required Level: 12
 * - Server Functions: srvstfunc=0, srvdofunc=65, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="blessedaim", summon=""
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
  skillId: 108,
  name: "Blessed Aim",
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
        'skill_module:skill-108-blessed-aim',
      ],
    }
  },
}

export { calculateBlessedAimStats } from '../../skills.ts'
export default skillModule
