/**
 * Diablo II: Lord of Destruction v1.13c — Skill #072: Weaken (NEC)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 72 ("Weaken")
 * - Class: "nec"
 * - Required Level: 6
 * - Server Functions: srvstfunc=0, srvdofunc=30, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: cltmissilea="curseweaken" (#183), cltmissilec="cursecast" (#147), auratargetstate="weaken" (#19), summon=""
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
  skillId: 72,
  name: "Weaken",
  charClass: "nec",
  srvStFunc: 0,
  srvDoFunc: 30,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-072-weaken',
      ],
    }
  },
}

export default skillModule
