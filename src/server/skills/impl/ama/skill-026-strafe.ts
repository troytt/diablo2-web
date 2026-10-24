/**
 * Diablo II: Lord of Destruction v1.13c — Skill #026: Strafe (AMA)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 26 ("Strafe")
 * - Class: "ama"
 * - Required Level: 24
 * - Server Functions: srvstfunc=8, srvdofunc=12, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="strafearrow", state="", summon=""
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
  skillId: 26,
  name: "Strafe",
  charClass: "ama",
  srvStFunc: 8,
  srvDoFunc: 12,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-026-strafe',
      ],
    }
  },
}

export { calculateStrafeStats } from '../../../../common/skills/amazon-bow.ts'
export default skillModule
