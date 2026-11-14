/**
 * Diablo II: Lord of Destruction v1.13c — Paladin Defensive Auras Module
 *
 * Dedicated pure calculation, pulse cadence, and synergy formulas for the 10 Paladin Defensive Auras:
 * - Skill 99: Prayer (ReqLevel 1)
 * - Skill 100: Resist Fire (ReqLevel 1)
 * - Skill 104: Defiance (ReqLevel 6)
 * - Skill 105: Resist Cold (ReqLevel 6)
 * - Skill 109: Cleansing (ReqLevel 12)
 * - Skill 110: Resist Lightning (ReqLevel 12)
 * - Skill 115: Vigor (ReqLevel 18)
 * - Skill 120: Meditation (ReqLevel 24)
 * - Skill 124: Redemption (ReqLevel 30)
 * - Skill 125: Salvation (ReqLevel 30)
 *
 * 1.13c Ground Truth:
 * - Skills.txt, Missiles.txt (Patch_D2.mpq)
 * - D2Game/src/SKILLS/SkillPalAura.cpp
 * - 50-frame pulse cadence (2.0s), 2-3s lingering duration
 * - Prayer periodic heal pulse with continuous mana drain (16/256), auto-deactivates at 0 mana
 * - Resist Fire/Cold/Lightning passive +1% max res per 2 hard points (blvl), active even when aura is off, capped at 95%
 * - Cleansing & Meditation free Prayer heal pulse synergy at 0 mana cost
 * - Redemption 50-tick cadence, 16 subtiles radius, dm34 chance, consumes valid monster corpses for caster-only life/mana restore
 * - Salvation active party All Res (Fire/Cold/Lightning), strictly zero effect on Poison or Magic
 */

export type {
  PrayerStats,
  ResistFireStats,
  DefianceStats,
  ResistColdStats,
  CleansingStats,
  ResistLightningStats,
  VigorStats,
  MeditationStats,
  RedemptionStats,
  SalvationStats,
} from '../../common/skills/paladin-auras.ts'

export {
  PALADIN_DEFENSIVE_AURA_IDS,
  calculatePrayerStats,
  calculateResistFireStats,
  calculateDefianceStats,
  calculateResistColdStats,
  calculateCleansingStats,
  calculateResistLightningStats,
  calculateVigorStats,
  calculateMeditationStats,
  calculateRedemptionStats,
  calculateSalvationStats,
} from '../../common/skills/paladin-auras.ts'
