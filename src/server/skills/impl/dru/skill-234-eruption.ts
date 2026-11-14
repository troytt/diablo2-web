/**
 * Diablo II: Lord of Destruction v1.13c — Skill #234: Eruption (DRU)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 234 ("Eruption")
 * - Class: "dru"
 * - Required Level: 12
 * - Server Functions: srvstfunc=0, srvdofunc=28, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="erruption center", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Firestorm'.blvl)+skill('Volcano'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 234,
  name: "Eruption",
  charClass: "dru",
  srvStFunc: 0,
  srvDoFunc: 28,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-234-eruption',
      ],
    }
  },
}

export default skillModule
