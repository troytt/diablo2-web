/**
 * Diablo II: Lord of Destruction v1.13c — Skill #236: Heart of Wolverine (DRU)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 236 ("Heart of Wolverine")
 * - Class: "dru"
 * - Required Level: 18
 * - Server Functions: srvstfunc=0, srvdofunc=119, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="", summon="heartofwolverine"
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
  skillId: 236,
  name: "Heart of Wolverine",
  charClass: "dru",
  srvStFunc: 0,
  srvDoFunc: 119,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-236-heart-of-wolverine',
      ],
    }
  },
}

export default skillModule
