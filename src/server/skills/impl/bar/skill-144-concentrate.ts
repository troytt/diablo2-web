/**
 * Diablo II: Lord of Destruction v1.13c — Skill #144: Concentrate (BAR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 144 ("Concentrate")
 * - Class: "bar"
 * - Required Level: 18
 * - Server Functions: srvstfunc=32, srvdofunc=2, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="concentrate", summon=""
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
  skillId: 144,
  name: "Concentrate",
  charClass: "bar",
  srvStFunc: 32,
  srvDoFunc: 2,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const eq = validateBarbarianSkillEquipment(144, ctx.caster)
    if (!eq.valid) {
      return {
        skillId: 144,
        name: "Concentrate",
        executed: false,
        srvDoFuncUsed: 2,
        manaSpent256: 0,
        missilesSpawned: [],
        statesApplied: [],
        petsSummoned: [],
        corpsesConsumed: 0,
        totalDamageDealt: 0,
        notes: ['fail: requires melee weapon', 'skill_module:skill-144-concentrate'],
      }
    }
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-144-concentrate',
      ],
    }
  },
}

export default skillModule

