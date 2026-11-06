/**
 * Diablo II: Lord of Destruction v1.13c — Skill #251: Fire Trauma (ASS)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 251 ("Fire Trauma")
 * - Class: "ass"
 * - Required Level: 1
 * - Server Functions: srvstfunc=0, srvdofunc=0, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="bomb in air", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Shock Field'.blvl) + skill('Death Sentry'.blvl) + skill('Charged Bolt Sentry'.blvl) + skill('Lightning Sentry'.blvl) + skill('Wake of Fire Sentry'.blvl) + skill('Inferno Sentry'.blvl)) * par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 251,
  name: "Fire Trauma",
  charClass: "ass",
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
        'skill_module:skill-251-fire-trauma',
      ],
    }
  },
}

export default skillModule
