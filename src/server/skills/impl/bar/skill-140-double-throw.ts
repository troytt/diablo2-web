/**
 * Diablo II: Lord of Destruction v1.13c — Skill #140: Double Throw (BAR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 140 ("Double Throw")
 * - Class: "bar"
 * - Required Level: 12
 * - Server Functions: srvstfunc=0, srvdofunc=74, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
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
import { validateBarbarianSkillEquipment } from '../../barbarian-combat.ts'

export const skillModule: SkillModule = {
  skillId: 140,
  name: "Double Throw",
  charClass: "bar",
  srvStFunc: 0,
  srvDoFunc: 74,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const eq = validateBarbarianSkillEquipment(140, ctx.caster)
    if (!eq.valid) {
      return {
        skillId: 140,
        name: "Double Throw",
        executed: false,
        srvDoFuncUsed: 74,
        manaSpent256: 0,
        missilesSpawned: [],
        statesApplied: [],
        petsSummoned: [],
        corpsesConsumed: 0,
        totalDamageDealt: 0,
        notes: ['fail: requires dual throwing weapons', 'skill_module:skill-140-double-throw'],
      }
    }
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-140-double-throw',
      ],
    }
  },
}

export default skillModule

