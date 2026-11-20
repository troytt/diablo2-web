/**
 * Diablo II: Lord of Destruction v1.13c — Skill #262: Wake of Fire Sentry (ASS)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 262 ("Wake of Fire Sentry")
 * - Class: "ass"
 * - Required Level: 12
 * - Server Functions: srvstfunc=0, srvdofunc=45, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="", summon="wakeofdestruction"
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Fire Trauma'.blvl) + skill('Inferno Sentry'.blvl)) * par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 262,
  name: "Wake of Fire Sentry",
  charClass: "ass",
  srvStFunc: 0,
  srvDoFunc: 45,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-262-wake-of-fire-sentry',
      ],
    }
  },
}

export default skillModule
