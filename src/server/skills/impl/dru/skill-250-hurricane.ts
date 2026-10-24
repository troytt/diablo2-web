/**
 * Diablo II: Lord of Destruction v1.13c — Skill #250: Hurricane (DRU)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 250 ("Hurricane")
 * - Class: "dru"
 * - Required Level: 30
 * - Server Functions: srvstfunc=0, srvdofunc=124, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="hurricane", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Twister'.blvl)+skill('Tornado'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 250,
  name: "Hurricane",
  charClass: "dru",
  srvStFunc: 0,
  srvDoFunc: 124,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-250-hurricane',
      ],
    }
  },
}

export default skillModule
