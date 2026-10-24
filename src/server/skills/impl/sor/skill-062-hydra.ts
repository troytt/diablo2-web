/**
 * Diablo II: Lord of Destruction v1.13c — Skill #062: Hydra (SOR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 62 ("Hydra")
 * - Class: "sor"
 * - Required Level: 30
 * - Server Functions: srvstfunc=14, srvdofunc=144, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="", summon="hydra1"
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Fire Bolt'.blvl) + skill('Fire Ball'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 62,
  name: "Hydra",
  charClass: "sor",
  srvStFunc: 14,
  srvDoFunc: 144,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-062-hydra',
      ],
    }
  },
}

export default skillModule
