/**
 * Diablo II: Lord of Destruction v1.13c — Assassin Martial Arts Module
 *
 * Dedicated pure calculations, charge-up progression (3-tier orbs, 375-frame duration),
 * finisher release resolution (Dragon Talon multi-kicks, Dragon Claw dual-strikes,
 * Dragon Tail explosive fire conversion, Dragon Flight teleport kicks), and Phoenix Strike
 * tier payload selection for the 10 Assassin Martial Arts Tree Skills:
 * - Skill 254: Tiger Strike (ReqLevel 1)
 * - Skill 255: Dragon Talon (ReqLevel 1)
 * - Skill 259: Fists of Fire (ReqLevel 6)
 * - Skill 260: Dragon Claw (ReqLevel 6)
 * - Skill 265: Cobra Strike (ReqLevel 12)
 * - Skill 269: Claws of Thunder (ReqLevel 18)
 * - Skill 270: Dragon Tail (ReqLevel 18)
 * - Skill 274: Blades of Ice (ReqLevel 24)
 * - Skill 275: Dragon Flight (ReqLevel 24)
 * - Skill 280: Royal Strike / Phoenix Strike (ReqLevel 30)
 *
 * 1.13c Ground Truth:
 * - Skills.txt, Missiles.txt, MonStats.txt, SkillDesc.txt (Patch_D2.mpq).
 * - Charge-up Mechanics:
 *     Max charges per skill: 3.
 *     Duration: 375 frames (15.0 seconds). Striking with the same charge-up skill before
 *     expiry refreshes duration and adds the next tier orb.
 *     Multiple different charge-up skills can be active simultaneously.
 * - Finisher Release Mechanics:
 *     Striking an enemy with any finisher move releases ALL active charge-ups simultaneously.
 *     For elemental skills (Fists of Fire, Claws of Thunder, Blades of Ice):
 *       Releases all tiers up to and including current charge (Charge 3 triggers Tier 1 + 2 + 3).
 *     For Phoenix Strike (Royal Strike):
 *       Releases strictly the single specific payload for the current charge level:
 *       Charge 1 = Meteor, Charge 2 = Chain Lightning, Charge 3 = Chaos Ice Orb.
 * - Zero runtime MPQ reading.
 */

import { compute5BandScaling, compute3BandDuration } from '../../common/data/calc-ast.ts'

// --- Skill IDs ---

export const ASSASSIN_MARTIAL_SKILL_IDS = {
  TIGER_STRIKE: 254,
  DRAGON_TALON: 255,
  FISTS_OF_FIRE: 259,
  DRAGON_CLAW: 260,
  COBRA_STRIKE: 265,
  CLAWS_OF_THUNDER: 269,
  DRAGON_TAIL: 270,
  BLADES_OF_ICE: 274,
  DRAGON_FLIGHT: 275,
  PHOENIX_STRIKE: 280,
} as const

export const MAX_CHARGES_PER_SKILL = 3
export const CHARGE_DURATION_FRAMES = 375 // 15.0 seconds

// --- Interfaces ---

export interface ActiveChargeOrb {
  readonly skillId: number
  count: number
  slvl: number
  expiresAtFrame: number
}

export interface DischargedPayload {
  readonly skillId: number
  readonly chargeLevel: number
  readonly slvl: number
  // Tiger Strike
  readonly enhancedDamagePct?: number
  // Cobra Strike
  readonly lifeStealPct?: number
  readonly manaStealPct?: number
  // Elemental damages & effects
  readonly fireDamage?: { min: number; max: number; explosionRadiusPx?: number | undefined; burningGroundFrames?: number | undefined } | undefined
  readonly ltngDamage?: { min: number; max: number; hasNova?: boolean | undefined; chargedBoltsCount?: number | undefined } | undefined
  readonly coldDamage?: { min: number; max: number; explosionRadiusPx?: number | undefined; freezeDurationFrames?: number | undefined } | undefined
  // Phoenix Strike
  readonly phoenixPayload?: {
    tier: 1 | 2 | 3
    type: 'meteor' | 'chain_lightning' | 'chaos_ice'
    meteorDamage?: { min: number; max: number } | undefined
    chainLightningDamage?: { min: number; max: number; maxTargets: number; boltsCount?: number | undefined } | undefined
    chaosIceDamage?: { min: number; max: number; boltsCount: number; freezeFrames: number } | undefined
  } | undefined
}

// --- ChargeOrbManager Engine ---

export class ChargeOrbManager {
  private readonly charges = new Map<number, ActiveChargeOrb>()

  getChargeLevel(skillId: number, currentFrame: number): number {
    const orb = this.charges.get(skillId)
    if (!orb) return 0
    if (currentFrame >= orb.expiresAtFrame) {
      this.charges.delete(skillId)
      return 0
    }
    return orb.count
  }

  addCharge(skillId: number, slvl: number, currentFrame: number): { currentCount: number; previousCount: number } {
    let orb = this.charges.get(skillId)
    let previousCount = 0

    if (orb && currentFrame < orb.expiresAtFrame) {
      previousCount = orb.count
      orb.count = Math.min(MAX_CHARGES_PER_SKILL, orb.count + 1)
      orb.slvl = slvl
      orb.expiresAtFrame = currentFrame + CHARGE_DURATION_FRAMES
      return { currentCount: orb.count, previousCount }
    }

    orb = {
      skillId,
      count: 1,
      slvl,
      expiresAtFrame: currentFrame + CHARGE_DURATION_FRAMES,
    }
    this.charges.set(skillId, orb)
    return { currentCount: 1, previousCount: 0 }
  }

  getActiveCharges(currentFrame: number): ActiveChargeOrb[] {
    const active: ActiveChargeOrb[] = []
    for (const [skillId, orb] of this.charges.entries()) {
      if (currentFrame < orb.expiresAtFrame) {
        active.push({ ...orb })
      } else {
        this.charges.delete(skillId)
      }
    }
    return active
  }

  dischargeAll(currentFrame: number): ActiveChargeOrb[] {
    const active = this.getActiveCharges(currentFrame)
    this.charges.clear()
    return active
  }

  clear(): void {
    this.charges.clear()
  }
}

// --- Finisher Discharge Resolution ---

export function resolveFinisherDischarge(
  charges: readonly ActiveChargeOrb[],
  options: {
    clawMasteryBlvl?: number | undefined
    royalStrikeBlvl?: number | undefined
    fistsOfFireBlvl?: number | undefined
    clawsOfThunderBlvl?: number | undefined
    bladesOfIceBlvl?: number | undefined
  } = {}
): DischargedPayload[] {
  const payloads: DischargedPayload[] = []

  for (const c of charges) {
    if (c.count <= 0) continue

    switch (c.skillId) {
      case ASSASSIN_MARTIAL_SKILL_IDS.TIGER_STRIKE: {
        const stats = evaluateTigerStrikeStats(c.slvl)
        const edMultiplier = c.count === 1 ? stats.charge1EDPct : (c.count === 2 ? stats.charge2EDPct : stats.charge3EDPct)
        payloads.push({
          skillId: c.skillId,
          chargeLevel: c.count,
          slvl: c.slvl,
          enhancedDamagePct: edMultiplier,
        })
        break
      }

      case ASSASSIN_MARTIAL_SKILL_IDS.COBRA_STRIKE: {
        const stats = evaluateCobraStrikeStats(c.slvl)
        payloads.push({
          skillId: c.skillId,
          chargeLevel: c.count,
          slvl: c.slvl,
          lifeStealPct: c.count === 3 ? stats.charge3LifeStealPct : stats.charge1LifeStealPct,
          manaStealPct: c.count >= 2 ? (c.count === 3 ? stats.charge3ManaStealPct : stats.charge2ManaStealPct) : 0,
        })
        break
      }

      case ASSASSIN_MARTIAL_SKILL_IDS.FISTS_OF_FIRE: {
        const stats = evaluateFistsOfFireStats(c.slvl, options.royalStrikeBlvl ?? 0)
        payloads.push({
          skillId: c.skillId,
          chargeLevel: c.count,
          slvl: c.slvl,
          fireDamage: {
            min: stats.minDamage,
            max: stats.maxDamage,
            explosionRadiusPx: c.count >= 2 ? 64 : undefined,
            burningGroundFrames: c.count >= 3 ? stats.burningGroundFrames : undefined,
          },
        })
        break
      }

      case ASSASSIN_MARTIAL_SKILL_IDS.CLAWS_OF_THUNDER: {
        const stats = evaluateClawsOfThunderStats(c.slvl, options.royalStrikeBlvl ?? 0)
        payloads.push({
          skillId: c.skillId,
          chargeLevel: c.count,
          slvl: c.slvl,
          ltngDamage: {
            min: stats.minDamage,
            max: stats.maxDamage,
            hasNova: c.count >= 2,
            chargedBoltsCount: c.count >= 3 ? 16 : undefined,
          },
        })
        break
      }

      case ASSASSIN_MARTIAL_SKILL_IDS.BLADES_OF_ICE: {
        const stats = evaluateBladesOfIceStats(c.slvl, options.royalStrikeBlvl ?? 0)
        payloads.push({
          skillId: c.skillId,
          chargeLevel: c.count,
          slvl: c.slvl,
          coldDamage: {
            min: stats.minDamage,
            max: stats.maxDamage,
            explosionRadiusPx: c.count >= 2 ? 64 : undefined,
            freezeDurationFrames: c.count >= 3 ? stats.freezeDurationFrames : undefined,
          },
        })
        break
      }

      case ASSASSIN_MARTIAL_SKILL_IDS.PHOENIX_STRIKE: {
        const stats = evaluatePhoenixStrikeStats(c.slvl, {
          fistsOfFireBlvl: options.fistsOfFireBlvl ?? 0,
          clawsOfThunderBlvl: options.clawsOfThunderBlvl ?? 0,
          bladesOfIceBlvl: options.bladesOfIceBlvl ?? 0,
        })
        let phoenixPayload: DischargedPayload['phoenixPayload']
        if (c.count === 1) {
          phoenixPayload = {
            tier: 1,
            type: 'meteor',
            meteorDamage: { min: stats.meteorMinDamage, max: stats.meteorMaxDamage },
          }
        } else if (c.count === 2) {
          phoenixPayload = {
            tier: 2,
            type: 'chain_lightning',
            chainLightningDamage: {
              min: 1,
              max: stats.chainLightningMaxDamage,
              maxTargets: stats.chainLightningTargets,
              boltsCount: stats.chainLightningBoltsCount,
            },
          }
        } else {
          phoenixPayload = {
            tier: 3,
            type: 'chaos_ice',
            chaosIceDamage: { min: stats.chaosIceMinDamage, max: stats.chaosIceMaxDamage, boltsCount: 16, freezeFrames: stats.freezeDurationFrames },
          }
        }

        payloads.push({
          skillId: c.skillId,
          chargeLevel: c.count,
          slvl: c.slvl,
          phoenixPayload,
        })
        break
      }
    }
  }

  return payloads
}

// --- Individual Skill Evaluators ---

/**
 * Skill #254: Tiger Strike
 * 1.13c Parity:
 * - Charge 1: +ln12% Enhanced Damage (100 + 20 * (slvl - 1)%)
 * - Charge 2: +2 * ln12% Enhanced Damage
 * - Charge 3: +3 * ln12% Enhanced Damage
 * - Attack Rating: 15 + 7 * (slvl - 1)%
 * - Duration: 375 frames (15s)
 */
export function evaluateTigerStrikeStats(slvl: number): {
  charge1EDPct: number
  charge2EDPct: number
  charge3EDPct: number
  attackRatingBonusPct: number
  durationFrames: number
  manaCost: number
} {
  const baseED = 100 + 20 * (slvl - 1)
  const attackRatingBonusPct = 15 + 7 * (slvl - 1)

  return {
    charge1EDPct: baseED,
    charge2EDPct: baseED * 2,
    charge3EDPct: baseED * 3,
    attackRatingBonusPct,
    durationFrames: CHARGE_DURATION_FRAMES,
    manaCost: 1,
  }
}

/**
 * Skill #255: Dragon Talon
 * 1.13c Parity:
 * - Kick count: 1 + floor(slvl / 6)
 * - Attack Rating: 20 + 35 * (slvl - 1)%
 * - Mana cost: 6
 * - Knockback on each kick
 */
export function evaluateDragonTalonStats(slvl: number): {
  kickCount: number
  attackRatingBonusPct: number
  manaCost: number
} {
  return {
    kickCount: 1 + Math.floor(slvl / 6),
    attackRatingBonusPct: 20 + 35 * (slvl - 1),
    manaCost: 10,
  }
}

/**
 * Skill #259: Fists of Fire
 * 1.13c Parity:
 * - Fire damage: 6-10 base, scales with level
 * - Converts physical to fire: min(100, 3 * slvl)% (Param3 = 3)
 * - Burning ground duration: 64 frames (Missiles.txt fistsoffirefirewall Range = 64)
 * - Attack Rating: 15 + 7 * (slvl - 1)%
 * - Duration: 375 frames
 */
export function evaluateFistsOfFireStats(
  slvl: number,
  royalStrikeBlvl = 0
): {
  minDamage: number
  maxDamage: number
  convertPhysToFirePct: number
  burningGroundFrames: number
  attackRatingBonusPct: number
  durationFrames: number
  manaCost: number
} {
  const baseMin = compute5BandScaling(slvl, 6, 5, 10, 20, 30, 40)
  const baseMax = compute5BandScaling(slvl, 10, 5, 11, 22, 33, 44)
  const synBonus = 1 + (royalStrikeBlvl * 12) / 100
  const minDamage = Math.floor(baseMin * synBonus)
  const maxDamage = Math.floor(baseMax * synBonus)
  const convertPhysToFirePct = Math.min(100, slvl * 3)

  return {
    minDamage,
    maxDamage,
    convertPhysToFirePct,
    burningGroundFrames: 64,
    attackRatingBonusPct: 15 + 7 * (slvl - 1),
    durationFrames: CHARGE_DURATION_FRAMES,
    manaCost: 2,
  }
}

/**
 * Skill #260: Dragon Claw
 * 1.13c Parity:
 * - Requires dual claws equipped (`hasLeftClaw && hasRightClaw`)
 * - Enhanced Damage: 50 + 5 * (slvl - 1) + clawMasteryBlvl * 4 %
 * - Attack Rating: 40 + 25 * (slvl - 1)%
 * - Strikes twice (once per claw)
 */
export function evaluateDragonClawStats(
  slvl: number,
  clawMasteryBlvl = 0
): {
  enhancedDamagePct: number
  attackRatingBonusPct: number
  strikesCount: number
  manaCost: number
} {
  const enhancedDamagePct = 50 + 5 * (slvl - 1) + clawMasteryBlvl * 4
  const attackRatingBonusPct = 40 + 25 * (slvl - 1)

  return {
    enhancedDamagePct,
    attackRatingBonusPct,
    strikesCount: 2,
    manaCost: 2,
  }
}

/**
 * Skill #265: Cobra Strike
 * 1.13c Parity:
 * - Base Steal%: 40 + 5 * (slvl - 1)%
 * - Charge 1: Life Steal = base%
 * - Charge 2: Life Steal = base%, Mana Steal = base%
 * - Charge 3: Life Steal = 2 * base%, Mana Steal = 2 * base%
 * - Attack Rating: 15 + 7 * (slvl - 1)%
 * - Duration: 375 frames
 */
export function evaluateCobraStrikeStats(slvl: number): {
  baseStealPct: number
  charge1LifeStealPct: number
  charge2LifeStealPct: number
  charge2ManaStealPct: number
  charge3LifeStealPct: number
  charge3ManaStealPct: number
  attackRatingBonusPct: number
  durationFrames: number
  manaCost: number
} {
  const baseStealPct = 40 + 5 * (slvl - 1)

  return {
    baseStealPct,
    charge1LifeStealPct: baseStealPct,
    charge2LifeStealPct: baseStealPct,
    charge2ManaStealPct: baseStealPct,
    charge3LifeStealPct: baseStealPct * 2,
    charge3ManaStealPct: baseStealPct * 2,
    attackRatingBonusPct: 15 + 7 * (slvl - 1),
    durationFrames: CHARGE_DURATION_FRAMES,
    manaCost: 2,
  }
}

/**
 * Computes Cobra Strike (#265) progressive leech bonus percentage for a given charge tier (1..3) and skill level:
 * Charge 1: 40 + 5 * (slvl - 1)%
 * Charge 2: 80 + 10 * (slvl - 1)%
 * Charge 3: 120 + 15 * (slvl - 1)%
 */
export function getCobraStrikeLeechBonus(chargeCount: number, slvl: number): number {
  const clamped = Math.max(0, Math.min(MAX_CHARGES_PER_SKILL, Math.floor(chargeCount)))
  if (clamped <= 0) return 0
  const lvl = Math.max(1, Math.floor(slvl))
  return (40 + 5 * (lvl - 1)) * clamped
}

/**
 * Skill #269: Claws of Thunder
 * 1.13c Parity:
 * - Lightning damage: 1 base min, max scales +8, +16, +24, +32, +40 (1-80 at slvl 1)
 * - Charge 2 adds Nova, Charge 3 adds 4 Charged Bolts
 * - Attack Rating: 15 + 7 * (slvl - 1)%
 * - Duration: 375 frames
 */
export function evaluateClawsOfThunderStats(
  slvl: number,
  royalStrikeBlvl = 0
): {
  minDamage: number
  maxDamage: number
  attackRatingBonusPct: number
  durationFrames: number
  manaCost: number
} {
  const minDamage = 1
  const baseMax = compute5BandScaling(slvl, 80, 20, 40, 60, 80, 100)
  const synBonus = 1 + (royalStrikeBlvl * 8) / 100
  const maxDamage = Math.floor(baseMax * synBonus)

  return {
    minDamage,
    maxDamage,
    attackRatingBonusPct: 15 + 7 * (slvl - 1),
    durationFrames: CHARGE_DURATION_FRAMES,
    manaCost: 4,
  }
}

/**
 * Skill #270: Dragon Tail
 * 1.13c Parity:
 * - Physical damage dealt converted to Fire Explosion: 50 + 10 * (slvl - 1)%
 * - Attack Rating: 20 + 15 * (slvl - 1)%
 * - Knockback on impact
 * - Explosion radius: 4 yards (6 subtiles)
 */
export function evaluateDragonTailStats(slvl: number): {
  fireExplosionPct: number
  attackRatingBonusPct: number
  radiusSubtiles: number
  manaCost: number
} {
  return {
    fireExplosionPct: 50 + 10 * (slvl - 1),
    attackRatingBonusPct: 20 + 15 * (slvl - 1),
    radiusSubtiles: 6,
    manaCost: 10,
  }
}

/**
 * Skill #274: Blades of Ice
 * 1.13c Parity:
 * - Cold damage: 15-35 base, scales with level
 * - Freeze duration: 4 + 0.4 * (slvl - 1) seconds = (100 + 10 * (slvl - 1)) frames (Missiles.txt bladesoficecubes)
 * - Attack Rating: 15 + 7 * (slvl - 1)%
 * - Duration: 375 frames
 */
export function evaluateBladesOfIceStats(
  slvl: number,
  royalStrikeBlvl = 0
): {
  minDamage: number
  maxDamage: number
  freezeDurationFrames: number
  attackRatingBonusPct: number
  durationFrames: number
  manaCost: number
} {
  const baseMin = compute5BandScaling(slvl, 15, 8, 10, 20, 30, 40)
  const baseMax = compute5BandScaling(slvl, 35, 8, 10, 22, 32, 42)
  const synBonus = 1 + (royalStrikeBlvl * 8) / 100
  const minDamage = Math.floor(baseMin * synBonus)
  const maxDamage = Math.floor(baseMax * synBonus)
  const freezeDurationFrames = 100 + 10 * (slvl - 1)

  return {
    minDamage,
    maxDamage,
    freezeDurationFrames,
    attackRatingBonusPct: 15 + 7 * (slvl - 1),
    durationFrames: CHARGE_DURATION_FRAMES,
    manaCost: 3,
  }
}

/**
 * Skill #275: Dragon Flight
 * 1.13c Parity:
 * - Teleport kick to target unit
 * - Enhanced Damage: 100 + 25 * (slvl - 1)%
 * - Attack Rating: 60 + 25 * (slvl - 1)%
 * - NextDelay: 4 frames
 */
export function evaluateDragonFlightStats(slvl: number): {
  enhancedDamagePct: number
  attackRatingBonusPct: number
  nextDelayFrames: number
  manaCost: number
} {
  return {
    enhancedDamagePct: 100 + 25 * (slvl - 1),
    attackRatingBonusPct: 60 + 25 * (slvl - 1),
    nextDelayFrames: 4,
    manaCost: 15,
  }
}

/**
 * Skill #280: Royal Strike / Phoenix Strike
 * 1.13c Parity:
 * - Tier 1: Meteor (Fire damage)
 * - Tier 2: Chain Lightning (arcs through 10 targets)
 * - Tier 3: Chaos Ice (16 chaos ice bolts piercing & freezing)
 * - Attack Rating: 15 + 7 * (slvl - 1)%
 * - Duration: 375 frames
 */
export function evaluatePhoenixStrikeStats(
  slvl: number,
  synergies: {
    fistsOfFireBlvl?: number
    clawsOfThunderBlvl?: number
    bladesOfIceBlvl?: number
  } = {}
): {
  meteorMinDamage: number
  meteorMaxDamage: number
  chainLightningMaxDamage: number
  chainLightningTargets: number
  chainLightningBoltsCount: number
  chaosIceMinDamage: number
  chaosIceMaxDamage: number
  freezeDurationFrames: number
  attackRatingBonusPct: number
  durationFrames: number
  manaCost: number
} {
  const fofSyn = 1 + ((synergies.fistsOfFireBlvl ?? 0) * 10) / 100
  const cotSyn = 1 + ((synergies.clawsOfThunderBlvl ?? 0) * 13) / 100
  const boiSyn = 1 + ((synergies.bladesOfIceBlvl ?? 0) * 10) / 100

  const baseMeteorMin = compute5BandScaling(slvl, 20, 10, 19, 29, 38, 46)
  const baseMeteorMax = compute5BandScaling(slvl, 40, 10, 22, 34, 46, 56)
  const meteorMinDamage = Math.floor(baseMeteorMin * fofSyn)
  const meteorMaxDamage = Math.floor(baseMeteorMax * fofSyn)

  const baseChainMax = compute5BandScaling(slvl, 40, 20, 40, 60, 80, 100)
  const chainLightningMaxDamage = Math.floor(baseChainMax * cotSyn)
  const chainLightningTargets = 5 + slvl
  const chainLightningBoltsCount = Math.ceil(64 / 10) // 7 radial bolts (Param6 = 10)

  const baseChaosMin = compute5BandScaling(slvl, 16, 4, 8, 12, 16, 20)
  const baseChaosMax = compute5BandScaling(slvl, 32, 4, 8, 13, 18, 23)
  const chaosIceMinDamage = Math.floor(baseChaosMin * boiSyn)
  const chaosIceMaxDamage = Math.floor(baseChaosMax * boiSyn)
  const freezeDurationFrames = compute3BandDuration(slvl, 100, 10, 15, 20)

  return {
    meteorMinDamage,
    meteorMaxDamage,
    chainLightningMaxDamage,
    chainLightningTargets,
    chainLightningBoltsCount,
    chaosIceMinDamage,
    chaosIceMaxDamage,
    freezeDurationFrames,
    attackRatingBonusPct: 15 + 7 * (slvl - 1),
    durationFrames: CHARGE_DURATION_FRAMES,
    manaCost: 4,
  }
}

/**
 * Dual claw eligibility check for Dragon Claw (#260).
 * Requires claw weapons in both hands.
 */
export function canCastDragonClaw(hasLeftClaw: boolean, hasRightClaw: boolean): boolean {
  return hasLeftClaw && hasRightClaw
}
