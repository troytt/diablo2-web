/**
 * Diablo II: Lord of Destruction v1.13c — Skill #034: Lightning Strike (AMA)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 34 ("Lightning Strike")
 * - Class: "ama"
 * - Required Level: 30
 * - Server Functions: srvstfunc=10, srvdofunc=14, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="lightningstrike", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Charged Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Power Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 34,
  name: "Lightning Strike",
  charClass: "ama",
  srvStFunc: 10,
  srvDoFunc: 14,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-034-lightning-strike',
      ],
    }
  },
}

export default skillModule
