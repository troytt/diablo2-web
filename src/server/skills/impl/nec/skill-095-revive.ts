/**
 * Diablo II: Lord of Destruction v1.13c — Skill #095: Revive (NEC)
 *
 * Authoritative 1.13c Ground Truth (`Patch_D2.mpq` -> `data\\global\\excel\\Skills.txt`):
 * - Skill ID: 95 ("Revive")
 * - Class: "nec"
 * - Required Level: 30 (reqskill1 = Raise Skeletal Mage #80, reqskill2 = Iron Golem #90)
 * - Server Functions: srvstfunc=21 (SKILLS_SrvSt21_Revive @ 0x6FC6ED60), srvdofunc=58 (SKILLS_SrvDo058_Revive @ 0x6FC71340)
 * - Client Functions: cltstfunc=24 (SKILLS_CltSt24_Revive @ 0x6FB78620), cltmissilea="revivemedium", cltmissileb="revivesmall", cltmissilec="revivelarge"
 * - Associated State / PetType: state1="revive" (#96), pettype="revive", petmax="lvl"
 * - 1.13c Formulas:
 *   - calc1 (HP % bonus): par1 + skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par3) = 200 + 5 * SM.lvl
 *   - calc2 (Duration frames): ln34 (Param3=4500, Param4=0) = 4500 frames (180s)
 *   - aurastat1 (damagepercent): skill('Skeleton Mastery'.lvl) * skill('Skeleton Mastery'.par4) = 10 * SM.lvl
 *   - passivestat1 (velocitypercent): par5 = 50 (+50% Walk/Run speed)
 */
import type {
  SkillEvalContext,
  SkillEvalResult,
  SkillExecContext,
  SkillExecOutcome,
  SkillModule,
} from '../../types.ts'
import { evaluateSkillCore113c, executeSkillCore113c } from '../../registry.ts'

export const skillModule: SkillModule = {
  skillId: 95,
  name: "Revive",
  charClass: "nec",
  srvStFunc: 21,
  srvDoFunc: 58,

  evaluate(ctx: SkillEvalContext): SkillEvalResult {
    return evaluateSkillCore113c(ctx)
  },

  executeDo(ctx: SkillExecContext): SkillExecOutcome {
    const outcome = executeSkillCore113c(ctx)
    return {
      ...outcome,
      notes: [
        ...outcome.notes,
        'skill_module:skill-095-revive',
      ],
    }
  },
}

export default skillModule
