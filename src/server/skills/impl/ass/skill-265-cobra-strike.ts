/**
 * Diablo II: Lord of Destruction v1.13c — Skill #265: Cobra Strike (ASS)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 265 ("Cobra Strike")
 * - Class: "ass"
 * - Required Level: 12
 * - Server Functions: srvstfunc=23, srvdofunc=34, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="", state="progressive_steal", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="", DmgSymPerCalc="", ELenSymPerCalc=""
 */
import type {
  SkillEvalContext,
  SkillEvalResult,
  SkillExecContext,
  SkillExecOutcome,
  SkillModule,
} from '../../types.ts'
import { evaluateCobraStrikeStats } from '../../assassin-martial-arts.ts'
import { evaluateSkillCore113c, executeSkillCore113c } from '../../registry.ts'

export { evaluateCobraStrikeStats }

export const skillModule: SkillModule = {
  skillId: 265,
  name: "Cobra Strike",
  charClass: "ass",
  srvStFunc: 23,
  srvDoFunc: 34,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    const stealState = ctx.caster.stateBus.getState('progressive_steal') ?? ctx.caster.stateBus.getState('cobrastrike')
    const chargeCount = stealState
      ? (stealState.stats?.progressive_steal ??
          stealState.stats?.progressive_other ??
          stealState.stats?.progressive_damage ??
          stealState.stats?.charge ??
          stealState.stats?.progressive_charges ??
          0)
      : 0
    const slvl = ctx.evalResult?.slvl ?? Math.max(1, ctx.caster.statList.getEffectiveSkillLevel(265))
    const stats = evaluateCobraStrikeStats(slvl)
    const lifeStealPct =
      chargeCount >= 3
        ? stats.charge3LifeStealPct
        : chargeCount === 2
          ? stats.charge2LifeStealPct
          : chargeCount === 1
            ? stats.charge1LifeStealPct
            : 0
    const manaStealPct =
      chargeCount >= 3
        ? stats.charge3ManaStealPct
        : chargeCount === 2
          ? stats.charge2ManaStealPct
          : 0
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        `cobra_leech_bonus:${lifeStealPct}:${manaStealPct}`,
        `cobra_life_steal:${lifeStealPct}`,
        `cobra_mana_steal:${manaStealPct}`,
        'skill_module:skill-265-cobra-strike',
      ],
    }
  },
}

export default skillModule
