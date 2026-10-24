/**
 * Diablo II: Lord of Destruction v1.13c — Skill #045: Ice Blast (SOR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 45 ("Ice Blast")
 * - Class: "sor"
 * - Required Level: 6
 * - Server Functions: srvstfunc=0, srvdofunc=0, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="iceblast", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Ice Bolt'.blvl)+skill('Blizzard'.blvl)+skill('Frozen Orb'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc="(skill('Glacial Spike'.blvl))*par7"
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
  skillId: 45,
  name: "Ice Blast",
  charClass: "sor",
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
        'skill_module:skill-045-ice-blast',
      ],
    }
  },
}

export default skillModule
