/**
 * Diablo II: Lord of Destruction v1.13c — Skill #121: Fist of the Heavens (PAL)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 121 ("Fist of the Heavens")
 * - Class: "pal"
 * - Required Level: 30
 * - Server Functions: srvstfunc=0, srvdofunc=80, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="fistoftheheavensdelay", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="skill('Holy Shock'.blvl)*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 121,
  name: "Fist of the Heavens",
  charClass: "pal",
  srvStFunc: 0,
  srvDoFunc: 80,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-121-fist-of-the-heavens',
      ],
    }
  },
}

export default skillModule
