/**
 * Diablo II: Lord of Destruction v1.13c — Skill #256: Shock Field (ASS)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 256 ("Shock Field")
 * - Class: "ass"
 * - Required Level: 6
 * - Server Functions: srvstfunc=0, srvdofunc=43, srvprgfunc1=0, srvprgfunc2=0, srvprgfunc3=0
 * - Associated Missile / State / Summon: missile="shock field in air", state="", summon=""
 * - 1.13c Synergy Formulas: EDmgSymPerCalc="(skill('Charged Bolt Sentry'.blvl) + skill('Lightning Sentry'.blvl) + skill('Death Sentry'.blvl)) * par8", DmgSymPerCalc="", ELenSymPerCalc=""
 */
import type {
  SkillEvalContext,
  SkillEvalResult,
  SkillExecContext,
  SkillExecOutcome,
  SkillModule,
} from '../../types.ts'
import { evaluateSkillCore113c, executeSkillCore113c } from '../../registry.ts'
import { calcShockWeb113c } from '../../assassin-traps.ts'

export function computeShockWebSpikeCount(slvl: number, fireBlastBlvl = 0): number {
  return calcShockWeb113c(slvl, { fireBlastBlvl }).spikeCount
}

export const skillModule: SkillModule = {
  skillId: 256,
  name: "Shock Field",
  charClass: "ass",
  srvStFunc: 0,
  srvDoFunc: 43,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-256-shock-field',
      ],
    }
  },
}

export default skillModule
