/**
 * Diablo II: Lord of Destruction v1.13c — Skill #131: Find Potion (BAR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 131 ("Find Potion")
 * - Class: "bar"
 * - Required Level: 1
 * - Server Functions: srvstfunc=33, srvdofunc=69, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
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
  skillId: 131,
  name: "Find Potion",
  charClass: "bar",
  srvStFunc: 33,
  srvDoFunc: 69,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const validCorpse = ctx.corpses.find(
      c => validateBarbarianCorpseTarget(131, c as any).valid,
    )
    if (!validCorpse) {
      return {
        skillId: 131,
        name: "Find Potion",
        executed: false,
        srvDoFuncUsed: 69,
        manaSpent256: 0,
        missilesSpawned: [],
        statesApplied: [],
        petsSummoned: [],
        corpsesConsumed: 0,
        totalDamageDealt: 0,
        notes: [
          'fail: requires valid unconsumed non-boss corpse',
          'skill_module:skill-131-find-potion',
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
        'skill_module:skill-131-find-potion',
      ],
    }
  },
}

export default skillModule

