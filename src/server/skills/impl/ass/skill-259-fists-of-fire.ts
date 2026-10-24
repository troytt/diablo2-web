/**
 * Diablo II: Lord of Destruction v1.13c — Skill #259: Fists of Fire (ASS)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 259 ("Fists of Fire")
 * - Class: "ass"
 * - Required Level: 6
 * - Server Functions: srvstfunc=23, srvdofunc=35, srvprgfunc1=143, srvprgfunc2=38, srvprgfunc3=39
 * - Associated Missile / State / Summon: missile="", state="progressive_fire", summon=""
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
  skillId: 259,
  name: "Fists of Fire",
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
        'skill_module:skill-259-fists-of-fire',
      ],
    }
  },
}

export default skillModule
