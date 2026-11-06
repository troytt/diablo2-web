/**
 * Diablo II: Lord of Destruction v1.13c — Skill #225: Firestorm (DRU)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 225 ("Firestorm")
 * - Class: "dru"
 * - Required Level: 1
 * - Server Functions: srvstfunc=0, srvdofunc=117, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="firestormmaker", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Molten Boulder'.blvl)+skill('Eruption'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 225,
  name: "Firestorm",
  charClass: "dru",
  srvStFunc: 0,
  srvDoFunc: 117,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-225-firestorm',
      ],
    }
  },
}

export default skillModule
