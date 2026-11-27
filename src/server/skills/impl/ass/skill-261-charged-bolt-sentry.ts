/**
 * Diablo II: Lord of Destruction v1.13c — Skill #261: Charged Bolt Sentry (ASS)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 261 ("Charged Bolt Sentry")
 * - Class: "ass"
 * - Required Level: 12
 * - Server Functions: srvstfunc=0, srvdofunc=45, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="", summon="chargeboltsentry"
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Fire Trauma'.blvl) + skill('Lightning Sentry'.blvl) + skill('Death Sentry'.blvl)) * par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 261,
  name: "Charged Bolt Sentry",
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
        'skill_module:skill-261-charged-bolt-sentry',
      ],
    }
  },
}

export default skillModule
