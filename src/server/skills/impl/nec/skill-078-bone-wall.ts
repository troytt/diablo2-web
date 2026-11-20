/**
 * Diablo II: Lord of Destruction v1.13c — Skill #078: Bone Wall (NEC)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 78 ("Bone Wall")
 * - Class: "nec"
 * - Required Level: 12
 * - Server Functions: srvstfunc=0, srvdofunc=60, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="bonewallmaker", state="", summon="bonewall"
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
  skillId: 78,
  name: "Bone Wall",
  charClass: "nec",
  srvStFunc: 0,
  srvDoFunc: 60,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-078-bone-wall',
      ],
    }
  },
}

export default skillModule
