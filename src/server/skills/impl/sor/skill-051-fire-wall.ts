/**
 * Diablo II: Lord of Destruction v1.13c — Skill #051: Fire Wall (SOR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 51 ("Fire Wall")
 * - Class: "sor"
 * - Required Level: 18
 * - Server Functions: srvstfunc=0, srvdofunc=24, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="firewallmaker", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Warmth'.blvl)*par8+skill('Inferno'.blvl)*par7", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 51,
  name: "Fire Wall",
  charClass: "sor",
  srvStFunc: 0,
  srvDoFunc: 24,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-051-fire-wall',
      ],
    }
  },
}

export default skillModule
