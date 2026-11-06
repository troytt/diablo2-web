/**
 * Diablo II: Lord of Destruction v1.13c — Skill #151: Whirlwind (BAR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 151 ("Whirlwind")
 * - Class: "bar"
 * - Required Level: 30
 * - Server Functions: srvstfunc=38, srvdofunc=76, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="whirlwind", summon=""
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
  skillId: 151,
  name: "Whirlwind",
  charClass: "bar",
  srvStFunc: 38,
  srvDoFunc: 76,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const eq = validateBarbarianSkillEquipment(151, ctx.caster)
    if (!eq.valid) {
      return {
        skillId: 151,
        name: "Whirlwind",
        executed: false,
        srvDoFuncUsed: 76,
        manaSpent256: 0,
        missilesSpawned: [],
        statesApplied: [],
        petsSummoned: [],
        corpsesConsumed: 0,
        totalDamageDealt: 0,
        notes: ['fail: requires melee weapon', 'skill_module:skill-151-whirlwind'],
      }
    }
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-151-whirlwind',
      ],
    }
  },
}

export default skillModule

