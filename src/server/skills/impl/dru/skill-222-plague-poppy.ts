/**
 * Diablo II: Lord of Destruction v1.13c — Skill #222: Plague Poppy (DRU)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 222 ("Plague Poppy")
 * - Class: "dru"
 * - Required Level: 1
 * - Server Functions: srvstfunc=0, srvdofunc=115, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="vine_beast", summon="plaguepoppy"
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
  skillId: 222,
  name: "Plague Poppy",
  charClass: "dru",
  srvStFunc: 0,
  srvDoFunc: 115,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-222-plague-poppy',
      ],
    }
  },
}

export default skillModule
