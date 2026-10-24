/**
 * Diablo II: Lord of Destruction v1.13c — Skill #132: Leap (BAR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 132 ("Leap")
 * - Class: "bar"
 * - Required Level: 6
 * - Server Functions: srvstfunc=40, srvdofunc=77, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
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
import { validateBarbarianLeapDestination } from '../../barbarian-combat.ts'

export const skillModule: SkillModule = {
  skillId: 132,
  name: "Leap",
  charClass: "bar",
  srvStFunc: 40,
  srvDoFunc: 77,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const leapCheck = validateBarbarianLeapDestination(132, {
      isPathBlocked: (ctx as any).isPathBlocked ?? (ctx as any).invalidDestination,
    })
    if (!leapCheck.valid) {
      return {
        skillId: 132,
        name: "Leap",
        executed: false,
        srvDoFuncUsed: 77,
        manaSpent256: 0,
        missilesSpawned: [],
        statesApplied: [],
        petsSummoned: [],
        corpsesConsumed: 0,
        totalDamageDealt: 0,
        notes: ['fail: path blocked or invalid destination', 'skill_module:skill-132-leap'],
      }
    }
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-132-leap',
      ],
    }
  },
}

export default skillModule

