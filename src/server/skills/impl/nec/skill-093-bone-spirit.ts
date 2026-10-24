/**
 * Diablo II: Lord of Destruction v1.13c — Skill #093: Bone Spirit (NEC)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 93 ("Bone Spirit")
 * - Class: "nec"
 * - Required Level: 30
 * - Server Functions: srvstfunc=0, srvdofunc=10, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="bonespirit", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Bone Wall'.blvl)+skill('Bone Prison'.blvl)+skill('Teeth'.blvl)+skill('Bone Spear'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 93,
  name: "Bone Spirit",
  charClass: "nec",
  srvStFunc: 0,
  srvDoFunc: 10,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-093-bone-spirit',
      ],
    }
  },
}

export default skillModule
