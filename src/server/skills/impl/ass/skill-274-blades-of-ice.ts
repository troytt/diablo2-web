/**
 * Diablo II: Lord of Destruction v1.13c — Skill #274: Blades of Ice (ASS)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 274 ("Blades of Ice")
 * - Class: "ass"
 * - Required Level: 24
 * - Server Functions: srvstfunc=23, srvdofunc=35, srvprgfunc1=0, srvprgfunc2=38, srvprgfunc3=39
 * - Associated Missile / State / Summon: missile="", state="progressive_cold", summon=""
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
  skillId: 274,
  name: "Blades of Ice",
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
        'skill_module:skill-274-blades-of-ice',
      ],
    }
  },
}

export default skillModule
