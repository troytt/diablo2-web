/**
 * Diablo II: Lord of Destruction v1.13c — Skill #084: Bone Spear (NEC)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 84 ("Bone Spear")
 * - Class: "nec"
 * - Required Level: 18
 * - Server Functions: srvstfunc=0, srvdofunc=0, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="bonespear", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Bone Wall'.blvl)+skill('Bone Prison'.blvl)+skill('Teeth'.blvl)+skill('Bone Spirit'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 84,
  name: "Bone Spear",
  charClass: "nec",
  srvStFunc: 0,
  srvDoFunc: 0,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-084-bone-spear',
      ],
    }
  },
}

export default skillModule
