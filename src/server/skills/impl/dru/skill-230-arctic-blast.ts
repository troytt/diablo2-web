/**
 * Diablo II: Lord of Destruction v1.13c — Skill #230: Arctic Blast (DRU)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 230 ("Arctic Blast")
 * - Class: "dru"
 * - Required Level: 6
 * - Server Functions: srvstfunc=11, srvdofunc=19, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="arcticblast1", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Cyclone Armor'.blvl)+skill('Hurricane'.blvl))*par8", DmgSymPerCalc="", ELenSymPerCalc=""
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
  skillId: 230,
  name: "Arctic Blast",
  charClass: "dru",
  srvStFunc: 11,
  srvDoFunc: 19,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const s = Math.max(1, Math.floor(ctx.evalResult.slvl))
    const abRange = Math.max(1, Math.floor((35 + (s - 1) * 6) / 2))
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-230-arctic-blast',
        `abRange:${abRange}`,
      ],
    }
  },
}

export default skillModule
