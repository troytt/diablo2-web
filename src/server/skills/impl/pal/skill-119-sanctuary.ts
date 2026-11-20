/**
 * Diablo II: Lord of Destruction v1.13c — Skill #119: Sanctuary (PAL)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 119 ("Sanctuary")
 * - Class: "pal"
 * - Required Level: 24
 * - Server Functions: srvstfunc=0, srvdofunc=66, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="sanctuary", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="skill('Cleansing'.blvl)*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 119,
  name: "Sanctuary",
  charClass: "pal",
  srvStFunc: 0,
  srvDoFunc: 66,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-119-sanctuary',
      ],
    }
  },
}

export { calculateSanctuaryStats } from '../../skills.ts'
export default skillModule
