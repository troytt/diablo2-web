/**
 * Diablo II: Lord of Destruction v1.13c — Skill #060: Chilling Armor (SOR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 60 ("Chilling Armor")
 * - Class: "sor"
 * - Required Level: 24
 * - Server Functions: srvstfunc=0, srvdofunc=18, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="chillingarmorbolt", state="chillingarmor", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Frozen Armor'.blvl)+skill('Shiver Armor'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 60,
  name: "Chilling Armor",
  charClass: "sor",
  srvStFunc: 0,
  srvDoFunc: 18,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-060-chilling-armor',
      ],
    }
  },
}

export default skillModule
