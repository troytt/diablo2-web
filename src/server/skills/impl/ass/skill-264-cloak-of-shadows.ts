/**
 * Diablo II: Lord of Destruction v1.13c — Skill #264: Cloak of Shadows (ASS)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 264 ("Cloak of Shadows")
 * - Class: "ass"
 * - Required Level: 12
 * - Server Functions: srvstfunc=0, srvdofunc=47, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="cloak_of_shadows", summon=""
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
  skillId: 264,
  name: "Cloak of Shadows",
  charClass: "ass",
  srvStFunc: 0,
  srvDoFunc: 47,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-264-cloak-of-shadows',
      ],
    }
  },
}

export default skillModule
