/**
 * Diablo II: Lord of Destruction v1.13c — Skill #073: Poison Dagger (NEC)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 73 ("Poison Dagger")
 * - Class: "nec"
 * - Required Level: 6
 * - Server Functions: srvstfunc=16, srvdofunc=32, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Poison Explosion'.blvl)+skill('Poison Nova'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 73,
  name: "Poison Dagger",
  charClass: "nec",
  srvStFunc: 16,
  srvDoFunc: 32,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-073-poison-dagger',
      ],
    }
  },
}

export default skillModule
