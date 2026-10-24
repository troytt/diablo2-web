/**
 * Diablo II: Lord of Destruction v1.13c — Skill #147: Frenzy (BAR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 147 ("Frenzy")
 * - Class: "bar"
 * - Required Level: 24
 * - Server Functions: srvstfunc=0, srvdofunc=9, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="frenzy", summon=""
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
  skillId: 147,
  name: "Frenzy",
  charClass: "bar",
  srvStFunc: 0,
  srvDoFunc: 9,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const eq = validateBarbarianSkillEquipment(147, ctx.caster)
    if (!eq.valid) {
      return {
        skillId: 147,
        name: "Frenzy",
        executed: false,
        srvDoFuncUsed: 9,
        manaSpent256: 0,
        missilesSpawned: [],
        statesApplied: [],
        petsSummoned: [],
        corpsesConsumed: 0,
        totalDamageDealt: 0,
        notes: [
          `fail: ${eq.reason === 'requires_dual_wield' ? 'requires dual-wield weapons' : 'requires melee weapon'}`,
          'skill_module:skill-147-frenzy',
        ],
      }
    }
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-147-frenzy',
      ],
    }
  },
}

export default skillModule

