/**
 * Diablo II: Lord of Destruction v1.13c — Skill #028: Dopplezon (AMA)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 28 ("Dopplezon")
 * - Class: "ama"
 * - Required Level: 24
 * - Server Functions: srvstfunc=0, srvdofunc=15, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="dopplezon", summon="dopplezon"
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
  skillId: 28,
  name: "Dopplezon",
  charClass: "ama",
  srvStFunc: 0,
  srvDoFunc: 15,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-028-dopplezon',
      ],
    }
  },
}

export { calculateDecoyStats } from '../../../../common/skills/amazon-passive.ts'
export default skillModule
