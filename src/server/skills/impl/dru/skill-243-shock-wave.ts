/**
 * Diablo II: Lord of Destruction v1.13c — Skill #243: Shock Wave (DRU)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 243 ("Shock Wave")
 * - Class: "dru"
 * - Required Level: 24
 * - Server Functions: srvstfunc=0, srvdofunc=8, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="shockwave", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="", DmgSymPerCalc="skill('Maul'.blvl)*par8", ELenSymPerCalc=""
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
  skillId: 243,
  name: "Shock Wave",
  charClass: "dru",
  srvStFunc: 0,
  srvDoFunc: 8,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-243-shock-wave',
      ],
    }
  },
}

export default skillModule
