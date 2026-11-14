/**
 * Diablo II: Lord of Destruction v1.13c — Skill #022: Guided Arrow (AMA)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 22 ("Guided Arrow")
 * - Class: "ama"
 * - Required Level: 18
 * - Server Functions: srvstfunc=4, srvdofunc=10, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="guidedarrow", state="", summon=""
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
  skillId: 22,
  name: "Guided Arrow",
  charClass: "ama",
  srvStFunc: 4,
  srvDoFunc: 10,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-022-guided-arrow',
      ],
    }
  },
}

export { calculateGuidedArrowStats } from '../../../../common/skills/amazon-bow.ts'
export default skillModule
