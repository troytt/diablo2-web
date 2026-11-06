/**
 * Diablo II: Lord of Destruction v1.13c — Skill #152: Berserk (BAR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 152 ("Berserk")
 * - Class: "bar"
 * - Required Level: 30
 * - Server Functions: srvstfunc=39, srvdofunc=2, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="berserk", summon=""
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
  skillId: 152,
  name: "Berserk",
  charClass: "bar",
  srvStFunc: 39,
  srvDoFunc: 2,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const eq = validateBarbarianSkillEquipment(152, ctx.caster)
    if (!eq.valid) {
      return {
        skillId: 152,
        name: "Berserk",
        executed: false,
        srvDoFuncUsed: 2,
        manaSpent256: 0,
        missilesSpawned: [],
        statesApplied: [],
        petsSummoned: [],
        corpsesConsumed: 0,
        totalDamageDealt: 0,
        notes: ['fail: requires melee weapon', 'skill_module:skill-152-berserk'],
      }
    }
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-152-berserk',
      ],
    }
  },
}

export default skillModule

