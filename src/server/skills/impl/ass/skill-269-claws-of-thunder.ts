/**
 * Diablo II: Lord of Destruction v1.13c — Skill #269: Claws of Thunder (ASS)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 269 ("Claws of Thunder")
 * - Class: "ass"
 * - Required Level: 18
 * - Server Functions: srvstfunc=23, srvdofunc=35, srvprgfunc1=0, srvprgfunc2=36, srvprgfunc3=37
 * - Associated Missile / State / Summon: missile="", state="progressive_lightning", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Royal Strike'.blvl)) * par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 269,
  name: "Claws of Thunder",
  charClass: "ass",
  srvStFunc: 23,
  srvDoFunc: 35,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-269-claws-of-thunder',
      ],
    }
  },
}

export default skillModule
