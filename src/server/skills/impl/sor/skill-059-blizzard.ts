/**
 * Diablo II: Lord of Destruction v1.13c — Skill #059: Blizzard (SOR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 59 ("Blizzard")
 * - Class: "sor"
 * - Required Level: 24
 * - Server Functions: srvstfunc=0, srvdofunc=28, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="blizzardcenter", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Ice Bolt'.blvl)+skill('Ice Blast'.blvl)+skill('Glacial Spike'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 59,
  name: "Blizzard",
  charClass: "sor",
  srvStFunc: 0,
  srvDoFunc: 28,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-059-blizzard',
      ],
    }
  },
}

export default skillModule
