/**
 * Diablo II: Lord of Destruction v1.13c — Skill #278: Venom (ASS)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 278 ("Venom")
 * - Class: "ass"
 * - Required Level: 30
 * - Server Functions: srvstfunc=0, srvdofunc=18, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="venomclaws", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 278,
  name: "Venom",
  charClass: "ass",
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
        'skill_module:skill-278-venom',
      ],
    }
  },
}

export default skillModule
