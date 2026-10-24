/**
 * Diablo II: Lord of Destruction v1.13c — Skill #024: Charged Strike (AMA)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 24 ("Charged Strike")
 * - Class: "ama"
 * - Required Level: 18
 * - Server Functions: srvstfunc=6, srvdofunc=11, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="chargedstrikebolt", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Lightning Strike'.blvl)+skill('Lightning Bolt'.blvl)+skill('Power Strike'.blvl)+skill('Lightning Fury'.blvl)) * par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 24,
  name: "Charged Strike",
  charClass: "ama",
  srvStFunc: 6,
  srvDoFunc: 11,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-024-charged-strike',
      ],
    }
  },
}

export default skillModule
