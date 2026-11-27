/**
 * Diablo II: Lord of Destruction v1.13c — Skill #050: Shiver Armor (SOR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 50 ("Shiver Armor")
 * - Class: "sor"
 * - Required Level: 12
 * - Server Functions: srvstfunc=0, srvdofunc=18, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="shiverarmor", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Frozen Armor'.blvl)+skill('Chilling Armor'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 50,
  name: "Shiver Armor",
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
        'skill_module:skill-050-shiver-armor',
      ],
    }
  },
}

export default skillModule
