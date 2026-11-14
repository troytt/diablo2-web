/**
 * Diablo II: Lord of Destruction v1.13c — Skill #025: Plague Javelin (AMA)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 25 ("Plague Javelin")
 * - Class: "ama"
 * - Required Level: 18
 * - Server Functions: srvstfunc=4, srvdofunc=0, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="plaguejavelin", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Poison Javelin'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 25,
  name: "Plague Javelin",
  charClass: "ama",
  srvStFunc: 4,
  srvDoFunc: 0,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-025-plague-javelin',
      ],
    }
  },
}

export default skillModule
