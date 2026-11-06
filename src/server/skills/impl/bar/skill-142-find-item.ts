/**
 * Diablo II: Lord of Destruction v1.13c — Skill #142: Find Item (BAR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 142 ("Find Item")
 * - Class: "bar"
 * - Required Level: 12
 * - Server Functions: srvstfunc=34, srvdofunc=72, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="", summon=""
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
import { validateBarbarianCorpseTarget } from '../../barbarian-warcries.ts'

export const skillModule: SkillModule = {
  skillId: 142,
  name: "Find Item",
  charClass: "bar",
  srvStFunc: 34,
  srvDoFunc: 72,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const validCorpse = ctx.corpses.find(
      c => validateBarbarianCorpseTarget(142, c as any).valid,
    )
    if (!validCorpse) {
      return {
        skillId: 142,
        name: "Find Item",
        executed: false,
        srvDoFuncUsed: 72,
        manaSpent256: 0,
        missilesSpawned: [],
        statesApplied: [],
        petsSummoned: [],
        corpsesConsumed: 0,
        totalDamageDealt: 0,
        notes: [
          'fail: requires valid unconsumed non-boss corpse',
          'skill_module:skill-142-find-item',
        ],
      }
    }
    const outcome = executeSkillCore113c({
      ...ctx,
      corpses: [validCorpse, ...ctx.corpses.filter(c => c !== validCorpse)],
    })
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-142-find-item',
      ],
    }
  },
}

export default skillModule

