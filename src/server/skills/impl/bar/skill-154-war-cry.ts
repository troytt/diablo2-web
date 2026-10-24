/**
 * Diablo II: Lord of Destruction v1.13c — Skill #154: War Cry (BAR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 154 ("War Cry")
 * - Class: "bar"
 * - Required Level: 30
 * - Server Functions: srvstfunc=0, srvdofunc=68, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="warcry", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="", DmgSymPerCalc="(skill('Howl'.blvl)+skill('Taunt'.blvl)+skill('Battle Cry'.blvl))*par8", ELenSymPerCalc=""
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
  skillId: 154,
  name: "War Cry",
  charClass: "bar",
  srvStFunc: 0,
  srvDoFunc: 68,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-154-war-cry',
      ],
    }
  },
}

export default skillModule
