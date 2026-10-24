/**
 * Diablo II: Lord of Destruction v1.13c — Skill #133: Double Swing (BAR)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 133 ("Double Swing")
 * - Class: "bar"
 * - Required Level: 6
 * - Server Functions: srvstfunc=0, srvdofunc=70, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
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
  skillId: 133,
  name: "Double Swing",
  charClass: "bar",
  srvStFunc: 0,
  srvDoFunc: 70,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const eq = validateBarbarianSkillEquipment(133, ctx.caster)
    if (!eq.valid) {
      return {
        skillId: 133,
        name: "Double Swing",
        executed: false,
        srvDoFuncUsed: 70,
        manaSpent256: 0,
        missilesSpawned: [],
        statesApplied: [],
        petsSummoned: [],
        corpsesConsumed: 0,
        totalDamageDealt: 0,
        notes: [
          `fail: ${eq.reason === 'requires_dual_wield' ? 'requires dual-wield weapons' : 'requires melee weapon'}`,
          'skill_module:skill-133-double-swing',
        ],
      }
    }
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-133-double-swing',
      ],
    }
  },
}

export default skillModule

