/**
 * Diablo II: Lord of Destruction v1.13c — Skill #032: Valkyrie (AMA)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 32 ("Valkyrie")
 * - Class: "ama"
 * - Required Level: 30
 * - Server Functions: srvstfunc=0, srvdofunc=16, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="", summon="valkyrie"
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
  skillId: 32,
  name: "Valkyrie",
  charClass: "ama",
  srvStFunc: 0,
  srvDoFunc: 16,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-032-valkyrie',
      ],
    }
  },
}

export { calculateValkyrieStats } from '../../../../common/skills/amazon-passive.ts'
export default skillModule
