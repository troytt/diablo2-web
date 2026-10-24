/**
 * Diablo II: Lord of Destruction v1.13c — Skill #080: Raise Skeletal Mage (NEC)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 80 ("Raise Skeletal Mage")
 * - Class: "nec"
 * - Required Level: 12
 * - Server Functions: srvstfunc=15, srvdofunc=31, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="", summon="necromage"
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
  skillId: 80,
  name: "Raise Skeletal Mage",
  charClass: "nec",
  srvStFunc: 15,
  srvDoFunc: 31,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-080-raise-skeletal-mage',
      ],
    }
  },
}

export default skillModule
