/**
 * Diablo II: Lord of Destruction v1.13c — Paladin Offensive Auras Module
 *
 * Dedicated pure calculation, pulse cadence, and synergy formulas for the 10 Paladin Offensive Auras:
 * - Skill 98: Might (ReqLevel 1)
 * - Skill 102: Holy Fire (ReqLevel 6)
 * - Skill 103: Thorns (ReqLevel 6)
 * - Skill 108: Blessed Aim (ReqLevel 12)
 * - Skill 113: Concentration (ReqLevel 18)
 * - Skill 114: Holy Freeze (ReqLevel 18)
 * - Skill 118: Holy Shock (ReqLevel 24)
 * - Skill 119: Sanctuary (ReqLevel 24)
 * - Skill 122: Fanaticism (ReqLevel 30)
 * - Skill 123: Conviction (ReqLevel 30)
 *
 * 1.13c Ground Truth:
 * - Skills.txt, Missiles.txt (Patch_D2.mpq)
 * - D2Game/src/SKILLS/SkillPalAura.cpp
 * - 50-frame pulse cadence (2.0s), 2-3s lingering duration
 * - Fanaticism party physical %ED is strictly half of caster %ED
 * - Conviction capped at -150% max resistance reduction, 1/5th efficiency vs element-immunes (base res >= 100%), no effect on Poison/Magic
 * - Sanctuary radial pulse + knockback vs Undead, sets Undead physical resistance to 0%
 * - Holy Freeze continuous slow (bypasses Cannot Be Frozen), radial cold pulse
 */

export type {
  MightStats,
  HolyFireStats,
  ThornsStats,
  BlessedAimStats,
  ConcentrationStats,
  HolyFreezeStats,
  HolyShockStats,
  SanctuaryStats,
  FanaticismStats,
  ConvictionStats,
} from '../../common/skills/paladin-auras.ts'

export {
  PALADIN_OFFENSIVE_AURA_IDS,
  calculateMightStats,
  calculateHolyFireStats,
  calculateThornsStats,
  calculateBlessedAimStats,
  calculateConcentrationStats,
  calculateHolyFreezeStats,
  calculateHolyShockStats,
  calculateSanctuaryStats,
  calculateFanaticismStats,
  calculateConvictionStats,
} from '../../common/skills/paladin-auras.ts'
