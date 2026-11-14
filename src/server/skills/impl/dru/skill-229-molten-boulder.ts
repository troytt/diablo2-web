/**
 * Diablo II: Lord of Destruction v1.13c — Skill #229: Molten Boulder (DRU)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 229 ("Molten Boulder")
 * - Class: "dru"
 * - Required Level: 6
 * - Server Functions: srvstfunc=0, srvdofunc=0, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="moltenboulderemerge", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="skill('Firestorm'.blvl)*par8", DmgSymPerCalc="skill('Volcano'.blvl)*par7", ELenSymPerCalc=""
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
  skillId: 229,
  name: "Molten Boulder",
  charClass: "dru",
  srvStFunc: 0,
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
        'skill_module:skill-229-molten-boulder',
      ],
    }
  },
}

export default skillModule
