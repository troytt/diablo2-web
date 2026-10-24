/**
 * Diablo II: Lord of Destruction v1.13c — Skill #092: Poison Nova (NEC)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 92 ("Poison Nova")
 * - Class: "nec"
 * - Required Level: 30
 * - Server Functions: srvstfunc=0, srvdofunc=22, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="poisonnova", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Poison Dagger'.blvl)+skill('Poison Explosion'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 92,
  name: "Poison Nova",
  charClass: "nec",
  srvStFunc: 0,
  srvDoFunc: 22,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-092-poison-nova',
      ],
    }
  },
}

export default skillModule
