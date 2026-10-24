/**
 * Diablo II: Lord of Destruction v1.13c — Skill #280: Royal Strike (ASS)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 280 ("Royal Strike")
 * - Class: "ass"
 * - Required Level: 30
 * - Server Functions: srvstfunc=23, srvdofunc=34, srvprgfunc1=40, srvprgfunc2=143, srvprgfunc3=41
 * - Associated Missile / State / Summon: missile="royalstrikemeteorcenter", state="progressive_other", summon=""
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
  skillId: 280,
  name: "Royal Strike",
  charClass: "ass",
  srvStFunc: 23,
  srvDoFunc: 34,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-280-royal-strike',
      ],
    }
  },
}

export default skillModule
