/**
 * Diablo II: Lord of Destruction v1.13c — Skill #086: Attract (NEC)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 86 ("Attract")
 * - Class: "nec"
 * - Required Level: 24
 * - Server Functions: srvstfunc=18, srvdofunc=59, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: cltmissilea="curseattract" (#186), cltmissilec="cursecast" (#147), auratargetstate="attract" (#57), summon=""
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
  skillId: 86,
  name: "Attract",
  charClass: "nec",
  srvStFunc: 18,
  srvDoFunc: 59,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-086-attract',
      ],
    }
  },
}

export default skillModule
