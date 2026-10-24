/**
 * Diablo II: Lord of Destruction v1.13c — Skill #143: Leap Attack (BAR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 143 ("Leap Attack")
 * - Class: "bar"
 * - Required Level: 18
 * - Server Functions: srvstfunc=41, srvdofunc=78, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
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
import {
  validateBarbarianSkillEquipment,
  validateBarbarianLeapDestination,
} from '../../barbarian-combat.ts'

export const skillModule: SkillModule = {
  skillId: 143,
  name: "Leap Attack",
  charClass: "bar",
  srvStFunc: 41,
  srvDoFunc: 78,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const eq = validateBarbarianSkillEquipment(143, ctx.caster)
    if (!eq.valid) {
      return {
        skillId: 143,
        name: "Leap Attack",
        executed: false,
        srvDoFuncUsed: 78,
        manaSpent256: 0,
        missilesSpawned: [],
        statesApplied: [],
        petsSummoned: [],
        corpsesConsumed: 0,
        totalDamageDealt: 0,
        notes: ['fail: requires melee weapon', 'skill_module:skill-143-leap-attack'],
      }
    }
    const leapCheck = validateBarbarianLeapDestination(143, {
      isPathBlocked: (ctx as any).isPathBlocked ?? (ctx as any).invalidDestination,
      isInMeleeRange: (ctx as any).isInMeleeRange,
    })
    if (!leapCheck.valid) {
      return {
        skillId: 143,
        name: "Leap Attack",
        executed: false,
        srvDoFuncUsed: 78,
        manaSpent256: 0,
        missilesSpawned: [],
        statesApplied: [],
        petsSummoned: [],
        corpsesConsumed: 0,
        totalDamageDealt: 0,
        notes: [
          'fail: path blocked or invalid destination',
          'skill_module:skill-143-leap-attack',
        ],
      }
    }
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        ...(leapCheck.meleeFallback ? ['in_melee_range_ground_strike'] : []),
        'skill_module:skill-143-leap-attack',
      ],
    }
  },
}

export default skillModule

