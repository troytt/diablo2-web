/**
 * Diablo II: Lord of Destruction v1.13c — Skill #257: Blade Sentinel (ASS)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 257 ("Blade Sentinel")
 * - Class: "ass"
 * - Required Level: 6
 * - Server Functions: srvstfunc=0, srvdofunc=44, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="blade creeper", state="", summon="bladecreeper"
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
  skillId: 257,
  name: "Blade Sentinel",
  charClass: "ass",
  srvStFunc: 0,
  srvDoFunc: 44,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-257-blade-sentinel',
      ],
    }
  },
}

export default skillModule
