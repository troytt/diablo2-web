/**
 * Diablo II: Lord of Destruction v1.13c — Skill #244: Volcano (DRU)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 244 ("Volcano")
 * - Class: "dru"
 * - Required Level: 24
 * - Server Functions: srvstfunc=0, srvdofunc=123, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="volcano", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Eruption'.blvl)+skill('Armageddon'.blvl))*par8", DmgSymPerCalc="skill('Molten Boulder'.blvl)*par7", ELenSymPerCalc=""
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
  skillId: 244,
  name: "Volcano",
  charClass: "dru",
  srvStFunc: 0,
  srvDoFunc: 123,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-244-volcano',
      ],
    }
  },
}

export default skillModule
