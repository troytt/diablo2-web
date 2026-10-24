/**
 * Diablo II: Lord of Destruction v1.13c — Paladin Combat Skills Module
 *
 * Dedicated pure calculation, synergy, and kinematics formulas for the 10 Paladin Combat Skills:
 * - Skill 96: Sacrifice (ReqLevel 1)
 * - Skill 97: Smite (ReqLevel 1)
 * - Skill 101: Holy Bolt (ReqLevel 6)
 * - Skill 106: Zeal (ReqLevel 12)
 * - Skill 107: Charge (ReqLevel 12)
 * - Skill 111: Vengeance (ReqLevel 18)
 * - Skill 112: Blessed Hammer (ReqLevel 18)
 * - Skill 116: Conversion (ReqLevel 24)
 * - Skill 117: Holy Shield (ReqLevel 24)
 * - Skill 121: Fist of the Heavens (ReqLevel 30)
 *
 * 1.13c Ground Truth:
 * - Skills.txt, Missiles.txt, Overlay.txt (Patch_D2.mpq)
 * - D2Game/src/SKILLS/SkillPal.cpp, SkillPalDo.cpp
 * - Strict fixed-point 24.8 mana calculations
 * - Smite auto-hit, unblockable, stun scaling, shield base + Holy Shield flat damage
 * - Blessed Hammer does NOT bypass Undead/Demon Magic Resistance (1.13c parity rule)
 * - Sacrifice 8% self-damage taken per successful hit (clamped >= 1 HP)
 * - Vengeance Fire/Cold/Lightning multi-element packet with independent resistances
 */

export interface SacrificeStats {
  readonly toHitBonusPct: number
  readonly damagePct: number
  readonly selfDamagePct: number
}

export interface SmiteStats {
  readonly damagePct: number
  readonly stunDurationFrames: number
  readonly minDamage: number
  readonly maxDamage: number
}

export interface HolyBoltDamageStats {
  readonly min: number
  readonly max: number
}

export interface HolyBoltHealStats {
  readonly min: number
  readonly max: number
}

export interface ZealStats {
  readonly hits: number
  readonly toHitBonusPct: number
  readonly damagePct: number
}

export interface ChargeStats {
  readonly toHitBonusPct: number
  readonly damagePct: number
  readonly speedMultiplier: number
}

export interface VengeanceStats {
  readonly toHitBonusPct: number
  readonly firePct: number
  readonly coldPct: number
  readonly ltngPct: number
  readonly chillDurationFrames: number
}

export interface BlessedHammerStats {
  readonly min: number
  readonly max: number
  readonly concentrationBonusPct: number
}

export interface ConversionStats {
  readonly chancePct: number
  readonly durationFrames: number
  readonly durationSeconds: number
}

export interface HolyShieldStats {
  readonly durationFrames: number
  readonly defensePct: number
  readonly blockChancePct: number
  readonly smiteMinFlat: number
  readonly smiteMaxFlat: number
}

export interface FistOfTheHeavensStats {
  readonly lightningMin: number
  readonly lightningMax: number
}

export interface FistOfTheHeavensHolyBoltStats {
  readonly holyBoltMin: number
  readonly holyBoltMax: number
}

export {
  calculateSacrificeStats,
  calculateSmiteStats,
  calculateHolyBoltDamage,
  calculateHolyBoltHeal,
  calculateZealStats,
  calculateChargeStats,
  calculateVengeanceStats,
  calculateBlessedHammerDamage,
  calculateConversionStats,
  calculateHolyShieldStats,
  calculateFistOfTheHeavensDamage,
  calculateFistOfTheHeavensHolyBoltDamage,
} from './skills.ts'

/**
 * Validate 1.13c pre-cast equipment constraints for Paladin combat skills with tri-state semantics:
 * - Holy Shield (#117) & Smite (#97): require an equipped shield (`hasShield !== false`)
 * - Sacrifice (#96), Zeal (#106), Charge (#107), Vengeance (#111), & Conversion (#116):
 *   require a melee weapon (`itypea1 = mele`, fails if `weaponItemType === 'bow'` / `'xbow'` or `isRanged === true` or `hasMeleeWeapon === false`)
 * Tri-state semantics: undefined/omitted allows execution for backwards compatibility with legacy test fixtures.
 */
export function validatePaladinSkillEquipment(
  skillId: number,
  equipment?: {
    hasShield?: boolean | undefined
    hasMeleeWeapon?: boolean | undefined
    weaponItemType?: string | undefined
    isRanged?: boolean | undefined
  },
): { valid: boolean; reason?: 'requires_shield' | 'requires_melee' } {
  if (!equipment) return { valid: true }
  if ((skillId === 97 || skillId === 117) && equipment.hasShield === false) {
    return { valid: false, reason: 'requires_shield' }
  }
  if (
    (skillId === 96 || skillId === 106 || skillId === 107 || skillId === 111 || skillId === 116) &&
    (equipment.weaponItemType === 'bow' ||
      equipment.weaponItemType === 'xbow' ||
      equipment.isRanged === true ||
      equipment.hasMeleeWeapon === false)
  ) {
    return { valid: false, reason: 'requires_melee' }
  }
  return { valid: true }
}


