/**
 * Diablo II: Lord of Destruction v1.13c — Skill #112: Blessed Hammer (PAL)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 112 ("Blessed Hammer")
 * - Class: "pal"
 * - Required Level: 18
 * - Server Functions: srvstfunc=0, srvdofunc=73, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="blessedhammer", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Vigor'.blvl)+skill('Blessed Aim'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 112,
  name: "Blessed Hammer",
  charClass: "pal",
  srvStFunc: 0,
  srvDoFunc: 73,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-112-blessed-hammer',
      ],
    }
  },
}

export default skillModule
