/**
 * Diablo II: Lord of Destruction v1.13c — Skill #053: Chain Lightning (SOR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 53 ("Chain Lightning")
 * - Class: "sor"
 * - Required Level: 18
 * - Server Functions: srvstfunc=0, srvdofunc=26, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="chainlightning", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Charged Bolt'.blvl)+skill('Lightning'.blvl)+skill('Nova'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 53,
  name: "Chain Lightning",
  charClass: "sor",
  srvStFunc: 0,
  srvDoFunc: 26,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-053-chain-lightning',
      ],
    }
  },
}

export default skillModule
