/**
 * Diablo II: Lord of Destruction v1.13c — Skill #150: Grim Ward (BAR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 150 ("Grim Ward")
 * - Class: "bar"
 * - Required Level: 24
 * - Server Functions: srvstfunc=33, srvdofunc=75, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="grimwardmediumstart", state="", summon=""
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
  skillId: 150,
  name: "Grim Ward",
  charClass: "bar",
  srvStFunc: 33,
  srvDoFunc: 75,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const validCorpse = ctx.corpses.find(
      c => validateBarbarianCorpseTarget(150, c as any).valid,
    )
    if (!validCorpse) {
      return {
        skillId: 150,
        name: "Grim Ward",
        executed: false,
        srvDoFuncUsed: 75,
        manaSpent256: 0,
        missilesSpawned: [],
        statesApplied: [],
        petsSummoned: [],
        corpsesConsumed: 0,
        totalDamageDealt: 0,
        notes: [
          'fail: requires valid unconsumed non-boss corpse',
          'skill_module:skill-150-grim-ward',
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
        'skill_module:skill-150-grim-ward',
      ],
    }
  },
}

export default skillModule

