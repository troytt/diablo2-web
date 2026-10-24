/**
 * Diablo II: Lord of Destruction v1.13c — Skill #008: Inner Sight (AMA)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 8 ("Inner Sight")
 * - Class: "ama"
 * - Required Level: 1
 * - Server Functions: srvstfunc=0, srvdofunc=6, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="", summon=""
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
  skillId: 8,
  name: "Inner Sight",
  charClass: "ama",
  srvStFunc: 0,
  srvDoFunc: 6,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-008-inner-sight',
      ],
    }
  },
}

export { calculateInnerSightStats } from '../../../../common/skills/amazon-passive.ts'
export default skillModule
