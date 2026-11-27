/**
 * Diablo II: Lord of Destruction v1.13c — Skill #239: Fire Claws (DRU)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 239 ("Fire Claws")
 * - Class: "dru"
 * - Required Level: 18
 * - Server Functions: srvstfunc=58, srvdofunc=2, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Firestorm'.blvl)+skill('Molten Boulder'.blvl)+skill('Volcano'.blvl)+skill('Eruption'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 239,
  name: "Fire Claws",
  charClass: "dru",
  srvStFunc: 58,
  srvDoFunc: 2,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-239-fire-claws',
      ],
    }
  },
}

export default skillModule
