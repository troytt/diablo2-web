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
import {
  CANONICAL_113C_SKILLS,
  evaluateCanonicalSkillMana113c,
} from '../../common/data/skills-catalog.ts'

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

/**
 * 1.13c `Skills.txt` `aurastat2 = progressive_tohit` (`ItemStatCost.txt` ID 325) per-charge bonus:
 * - `#254` Tiger Strike, `#259` Fists of Fire, `#265` Cobra Strike, `#269` Claws of Thunder, `#274` Blades of Ice:
 *   `aurastatcalc2 = par4` (`Param4 = 50` -> +50% / +100% / +150% Attack Rating at Charge 1 / 2 / 3)
 * - `#280` Royal Strike (Phoenix Strike):
 *   `aurastatcalc2 = par7` (`Param7 = 25` -> +25% / +50% / +75% Attack Rating at Charge 1 / 2 / 3)
 * Verified against `D2Game.dll` `sub_6FCB5370` (`0x6FCB5370..0x6FCB5603`).
 */
export const PROGRESSIVE_TOHIT_PER_CHARGE_BY_SKILL_ID: Readonly<Record<number, number>> = {
  [ASSASSIN_MARTIAL_SKILL_IDS.TIGER_STRIKE]: CANONICAL_113C_SKILLS[254]?.params.par4 ?? 50,
  [ASSASSIN_MARTIAL_SKILL_IDS.FISTS_OF_FIRE]: CANONICAL_113C_SKILLS[259]?.params.par4 ?? 50,
  [ASSASSIN_MARTIAL_SKILL_IDS.COBRA_STRIKE]: CANONICAL_113C_SKILLS[265]?.params.par4 ?? 50,
  [ASSASSIN_MARTIAL_SKILL_IDS.CLAWS_OF_THUNDER]: CANONICAL_113C_SKILLS[269]?.params.par4 ?? 50,
  [ASSASSIN_MARTIAL_SKILL_IDS.BLADES_OF_ICE]: CANONICAL_113C_SKILLS[274]?.params.par4 ?? 50,
  [ASSASSIN_MARTIAL_SKILL_IDS.PHOENIX_STRIKE]: CANONICAL_113C_SKILLS[280]?.params.par7 ?? 25,
}

export function evaluateChargeUpProgressiveToHit(skillId: number, chargeCount: number): number {
  const clamped = Math.max(0, Math.min(MAX_CHARGES_PER_SKILL, Math.floor(chargeCount)))
  if (clamped <= 0) return 0
  const perCharge = PROGRESSIVE_TOHIT_PER_CHARGE_BY_SKILL_ID[skillId] ?? 0
  return perCharge * clamped
}

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
  /** 1.13c `aurastat2 = progressive_tohit` (+AR% contributed by this charge orb before discharge). */
  readonly progressiveToHitBonusPct?: number
  // Tiger Strike
  readonly enhancedDamagePct?: number
  // Cobra Strike
  readonly lifeStealPct?: number
  readonly manaStealPct?: number
  // Elemental damages & effects
  readonly fireDamage?: {
    min: number
    max: number
    explosionRadiusPx?: number | undefined
    burningGroundFrames?: number | undefined
    /** Charge 3 fistsoffirefirewall (#557, HitShift=3) per-frame fire damage in 1/256ths */
    burningGroundMinDmg256?: number | undefined
    burningGroundMaxDmg256?: number | undefined
    /** Charge 3 fistsoffirefirewall (#557, HitShift=3) total fire damage over burningGroundFrames */
    burningGroundTotalMin?: number | undefined
    burningGroundTotalMax?: number | undefined
  } | undefined
  readonly ltngDamage?: {
    /** Charge 1 melee lightning damage (Skills.txt #269: 1..80 at slvl 1) */
    min: number
    max: number
    /** Charge 2 clawsofthundernova (#559) lightning damage (Missiles.txt #559: 1..30 at slvl 1) */
    novaMin: number
    novaMax: number
    /** Charge 3 clawsofthunderbolt (#558) lightning damage (Missiles.txt #558: 1..40 at slvl 1) */
    boltMin: number
    boltMax: number
    hasNova?: boolean | undefined
    chargedBoltsCount?: number | undefined
  } | undefined
  readonly coldDamage?: { min: number; max: number; explosionRadiusPx?: number | undefined; freezeDurationFrames?: number | undefined } | undefined
  // Phoenix Strike
  readonly phoenixPayload?: {
    tier: 1 | 2 | 3
    type: 'meteor' | 'chain_lightning' | 'chaos_ice'
    meteorDamage?: {
      min: number
      max: number
      groundFireFrames: number
      groundFireMinDmg256: number
      groundFireMaxDmg256: number
      groundFireTotalMin: number
      groundFireTotalMax: number
    } | undefined
    chainLightningDamage?: {
      min: number
      max: number
      maxTargets: number
      jumpRadiusSubtiles?: number | undefined
      boltsCount?: number | undefined
    } | undefined
    chaosIceDamage?: { min: number; max: number; boltsCount: number; freezeFrames: number } | undefined
  } | undefined
}

/**
 * 1.13c `Missiles.txt` elemental damage row descriptor for Martial Arts charge-up release sub-missiles.
 * (`MISSILES_CalculateDamageData` @ `0x6FC5D9D0` in `D2Game.dll`).
 */
export interface MartialSubMissileSpec113c {
  readonly missileId: number
  readonly missileName: string
  readonly sourceSkillId: number
  readonly chargeTier: 1 | 2 | 3
  readonly elemType: 'fire' | 'ltng' | 'cold' | 'frze'
  readonly hitShift: number
  readonly rangeFrames: number
  readonly eMin: number
  readonly minELev: readonly [number, number, number, number, number]
  readonly eMax: number
  readonly maxELev: readonly [number, number, number, number, number]
  readonly synergySkillId: number | null
  readonly synergyPctPerBlvl: number
}

export const MARTIAL_SUB_MISSILE_SPECS_113C = {
  fistsoffirefirewall: {
    missileId: 557,
    missileName: 'fistsoffirefirewall',
    sourceSkillId: 259,
    chargeTier: 3,
    elemType: 'fire',
    hitShift: 3,
    rangeFrames: 64,
    eMin: 6,
    minELev: [5, 10, 16, 22, 30],
    eMax: 10,
    maxELev: [5, 10, 17, 24, 32],
    synergySkillId: 280,
    synergyPctPerBlvl: 6,
  },
  clawsofthundernova: {
    missileId: 559,
    missileName: 'clawsofthundernova',
    sourceSkillId: 269,
    chargeTier: 2,
    elemType: 'ltng',
    hitShift: 8,
    rangeFrames: 13,
    eMin: 1,
    minELev: [0, 0, 0, 0, 0],
    eMax: 30,
    maxELev: [15, 25, 35, 45, 65],
    synergySkillId: 280,
    synergyPctPerBlvl: 8,
  },
  clawsofthunderbolt: {
    missileId: 558,
    missileName: 'clawsofthunderbolt',
    sourceSkillId: 269,
    chargeTier: 3,
    elemType: 'ltng',
    hitShift: 8,
    rangeFrames: 98,
    eMin: 1,
    minELev: [0, 0, 0, 0, 0],
    eMax: 40,
    maxELev: [20, 40, 60, 80, 100],
    synergySkillId: 280,
    synergyPctPerBlvl: 8,
  },
  bladesoficecubes: {
    missileId: 561,
    missileName: 'bladesoficecubes',
    sourceSkillId: 274,
    chargeTier: 3,
    elemType: 'frze',
    hitShift: 8,
    rangeFrames: 30,
    eMin: 1,
    minELev: [0, 0, 0, 0, 0],
    eMax: 1,
    maxELev: [0, 0, 0, 0, 0],
    synergySkillId: null,
    synergyPctPerBlvl: 0,
  },
  royalstrikemeteor: {
    missileId: 563,
    missileName: 'royalstrikemeteor',
    sourceSkillId: 280,
    chargeTier: 1,
    elemType: 'fire',
    hitShift: 8,
    rangeFrames: 60,
    eMin: 20,
    minELev: [10, 19, 29, 38, 46],
    eMax: 40,
    maxELev: [10, 21, 33, 42, 50],
    synergySkillId: 259,
    synergyPctPerBlvl: 10,
  },
  royalstrikemeteorfire: {
    missileId: 567,
    missileName: 'royalstrikemeteorfire',
    sourceSkillId: 280,
    chargeTier: 1,
    elemType: 'fire',
    hitShift: 3,
    rangeFrames: 37,
    eMin: 6,
    minELev: [5, 10, 16, 22, 30],
    eMax: 10,
    maxELev: [5, 10, 17, 24, 32],
    synergySkillId: 259,
    synergyPctPerBlvl: 6,
  },
  royalstrikechainlightning: {
    missileId: 568,
    missileName: 'royalstrikechainlightning',
    sourceSkillId: 280,
    chargeTier: 2,
    elemType: 'ltng',
    hitShift: 8,
    rangeFrames: 60,
    eMin: 1,
    minELev: [0, 0, 0, 0, 0],
    eMax: 40,
    maxELev: [20, 40, 60, 80, 100],
    synergySkillId: 269,
    synergyPctPerBlvl: 13,
  },
  royalstrikechaosice: {
    missileId: 569,
    missileName: 'royalstrikechaosice',
    sourceSkillId: 280,
    chargeTier: 3,
    elemType: 'cold',
    hitShift: 8,
    rangeFrames: 40,
    eMin: 16,
    minELev: [4, 8, 12, 20, 28],
    eMax: 32,
    maxELev: [4, 8, 13, 21, 29],
    synergySkillId: 274,
    synergyPctPerBlvl: 10,
  },
} as const satisfies Record<string, MartialSubMissileSpec113c>

/**
 * Evaluates 1.13c `MISSILES_CalculateDamageData` (`0x6FC5D9D0`) for a Martial Arts release sub-missile
 * using its exact `Missiles.txt` 5-band scaling, `EDmgSymPerCalc` synergy, and `HitShift`.
 */
export function evaluateMartialSubMissileDamage(
  missileKey: keyof typeof MARTIAL_SUB_MISSILE_SPECS_113C,
  slvl: number,
  synergyBlvl = 0,
): {
  rawMin: number
  rawMax: number
  synMin: number
  synMax: number
  min256: number
  max256: number
  minDamage: number
  maxDamage: number
  hitShift: number
} {
  const spec = MARTIAL_SUB_MISSILE_SPECS_113C[missileKey]
  const rawMin = compute5BandScaling(
    slvl,
    spec.eMin,
    spec.minELev[0],
    spec.minELev[1],
    spec.minELev[2],
    spec.minELev[3],
    spec.minELev[4],
  )
  const rawMax = compute5BandScaling(
    slvl,
    spec.eMax,
    spec.maxELev[0],
    spec.maxELev[1],
    spec.maxELev[2],
    spec.maxELev[3],
    spec.maxELev[4],
  )
  const synPct = Math.max(0, Math.floor(synergyBlvl)) * spec.synergyPctPerBlvl
  const synMin = Math.floor((rawMin * (100 + synPct)) / 100)
  const synMax = Math.floor((rawMax * (100 + synPct)) / 100)
  const min256 = synMin * (1 << spec.hitShift)
  const max256 = synMax * (1 << spec.hitShift)
  return {
    rawMin,
    rawMax,
    synMin,
    synMax,
    min256,
    max256,
    minDamage: Math.floor(min256 / 256),
    maxDamage: Math.floor(max256 / 256),
    hitShift: spec.hitShift,
  }
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

  getTotalProgressiveToHitBonus(currentFrame: number): number {
    let total = 0
    for (const orb of this.getActiveCharges(currentFrame)) {
      total += evaluateChargeUpProgressiveToHit(orb.skillId, orb.count)
    }
    return total
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
    const progressiveToHitBonusPct = evaluateChargeUpProgressiveToHit(c.skillId, c.count)

    switch (c.skillId) {
      case ASSASSIN_MARTIAL_SKILL_IDS.TIGER_STRIKE: {
        const stats = evaluateTigerStrikeStats(c.slvl)
        const edMultiplier = c.count === 1 ? stats.charge1EDPct : (c.count === 2 ? stats.charge2EDPct : stats.charge3EDPct)
        payloads.push({
          skillId: c.skillId,
          chargeLevel: c.count,
          slvl: c.slvl,
          progressiveToHitBonusPct,
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
          progressiveToHitBonusPct,
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
          progressiveToHitBonusPct,
          fireDamage: {
            min: stats.minDamage,
            max: stats.maxDamage,
            explosionRadiusPx: c.count >= 2 ? 64 : undefined,
            burningGroundFrames: c.count >= 3 ? stats.burningGroundFrames : undefined,
            burningGroundMinDmg256: c.count >= 3 ? stats.firewallMinDamage256 : undefined,
            burningGroundMaxDmg256: c.count >= 3 ? stats.firewallMaxDamage256 : undefined,
            burningGroundTotalMin: c.count >= 3 ? stats.firewallTotalMinDamage : undefined,
            burningGroundTotalMax: c.count >= 3 ? stats.firewallTotalMaxDamage : undefined,
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
          progressiveToHitBonusPct,
          ltngDamage: {
            min: stats.minDamage,
            max: stats.maxDamage,
            novaMin: stats.novaMinDamage,
            novaMax: stats.novaMaxDamage,
            boltMin: stats.boltMinDamage,
            boltMax: stats.boltMaxDamage,
            hasNova: c.count >= 2,
            chargedBoltsCount: c.count >= 3 ? stats.chargedBoltsCount : undefined,
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
          progressiveToHitBonusPct,
          coldDamage: {
            min: stats.minDamage,
            max: stats.maxDamage,
            explosionRadiusPx: c.count >= 2 ? 96 : undefined,
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
            meteorDamage: {
              min: stats.meteorMinDamage,
              max: stats.meteorMaxDamage,
              groundFireFrames: stats.meteorGroundFireFrames,
              groundFireMinDmg256: stats.meteorGroundFireMinDamage256,
              groundFireMaxDmg256: stats.meteorGroundFireMaxDamage256,
              groundFireTotalMin: stats.meteorGroundFireTotalMinDamage,
              groundFireTotalMax: stats.meteorGroundFireTotalMaxDamage,
            },
          }
        } else if (c.count === 2) {
          phoenixPayload = {
            tier: 2,
            type: 'chain_lightning',
            chainLightningDamage: {
              min: stats.chainLightningMinDamage,
              max: stats.chainLightningMaxDamage,
              maxTargets: stats.chainLightningTargets,
              jumpRadiusSubtiles: stats.chainLightningJumpRadiusSubtiles,
              boltsCount: stats.chainLightningBoltsCount,
            },
          }
        } else {
          phoenixPayload = {
            tier: 3,
            type: 'chaos_ice',
            chaosIceDamage: {
              min: stats.chaosIceMinDamage,
              max: stats.chaosIceMaxDamage,
              boltsCount: stats.chaosIceBoltsCount,
              freezeFrames: stats.freezeDurationFrames,
            },
          }
        }

        payloads.push({
          skillId: c.skillId,
          chargeLevel: c.count,
          slvl: c.slvl,
          progressiveToHitBonusPct,
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
  manaCost256: number
  delayFrames: number
  cooldownFrames: number
} {
  const lvl = Math.max(1, Math.floor(slvl))
  const entry = CANONICAL_113C_SKILLS[254]
  const par1 = entry?.params.par1 ?? 100
  const par2 = entry?.params.par2 ?? 20
  const par3 = entry?.params.par3 ?? CHARGE_DURATION_FRAMES
  const toHit = entry?.toHit ?? 15
  const toHitLev = entry?.toHitLev ?? 7
  const mana = evaluateCanonicalSkillMana113c(254, lvl)
  const baseED = par1 + par2 * (lvl - 1)
  const attackRatingBonusPct = toHit + toHitLev * (lvl - 1)

  return {
    charge1EDPct: baseED,
    charge2EDPct: baseED * 2,
    charge3EDPct: baseED * 3,
    attackRatingBonusPct,
    durationFrames: par3,
    manaCost: mana.manaCost,
    manaCost256: mana.manaCost256,
    delayFrames: mana.delayFrames,
    cooldownFrames: mana.delayFrames,
  }
}

/**
 * Skill #255: Dragon Talon
 * 1.13c Parity (`Skills.txt` row 255):
 * - Kick count: 1 + floor(slvl / Param1) (`Param1 = 6`)
 * - Attack Rating: 20 + 35 * (slvl - 1)%
 * - Mana cost: 6 (`manashift = 8, minmana = 1, mana = 6, lvlmana = 0`)
 * - Knockback on each kick
 */
export function evaluateDragonTalonStats(slvl: number): {
  kickCount: number
  attackRatingBonusPct: number
  manaCost: number
  manaCost256: number
  delayFrames: number
  cooldownFrames: number
} {
  const lvl = Math.max(1, Math.floor(slvl))
  const entry = CANONICAL_113C_SKILLS[255]
  const par1 = entry?.params.par1 ?? 6
  const toHit = entry?.toHit ?? 20
  const toHitLev = entry?.toHitLev ?? 35
  const mana = evaluateCanonicalSkillMana113c(255, lvl)
  return {
    kickCount: 1 + Math.floor(lvl / par1),
    attackRatingBonusPct: toHit + toHitLev * (lvl - 1),
    manaCost: mana.manaCost,
    manaCost256: mana.manaCost256,
    delayFrames: mana.delayFrames,
    cooldownFrames: mana.delayFrames,
  }
}

/**
 * Skill #259: Fists of Fire
 * 1.13c Parity:
 * - Charge 1 & 2 Fire damage (`Skills.txt` #259, `HitShift = 8`): `6 [5,10,20,30,40]` to `10 [5,11,22,33,44]`, `+12%` per Royal Strike blvl
 * - Charge 3 Burning Ground (`Missiles.txt` #557 `fistsoffirefirewall`, `HitShift = 3`, `Range = 64` frames): `6 [5,10,16,22,30]` to `10 [5,10,17,24,32]`, `+6%` per Royal Strike blvl (`<< 3 = /32` per frame)
 * - Converts physical to fire: `min(100, 3 * slvl)%` (`Param3 = 3`)
 * - Attack Rating: `15 + 7 * (slvl - 1)%`
 * - Duration: `375` frames
 */
export function evaluateFistsOfFireStats(
  slvl: number,
  royalStrikeBlvl = 0
): {
  minDamage: number
  maxDamage: number
  convertPhysToFirePct: number
  burningGroundFrames: number
  firewallMinDamage256: number
  firewallMaxDamage256: number
  firewallTotalMinDamage: number
  firewallTotalMaxDamage: number
  attackRatingBonusPct: number
  durationFrames: number
  manaCost: number
  manaCost256: number
  delayFrames: number
  cooldownFrames: number
} {
  const lvl = Math.max(1, Math.floor(slvl))
  const entry = CANONICAL_113C_SKILLS[259]
  const par3 = entry?.params.par3 ?? CHARGE_DURATION_FRAMES
  const par8 = entry?.params.par8 ?? 12
  const toHit = entry?.toHit ?? 15
  const toHitLev = entry?.toHitLev ?? 7
  const mana = evaluateCanonicalSkillMana113c(259, lvl)
  const baseMin = compute5BandScaling(lvl, 6, 5, 10, 20, 30, 40)
  const baseMax = compute5BandScaling(lvl, 10, 5, 11, 22, 33, 44)
  const synPct = Math.max(0, Math.floor(royalStrikeBlvl)) * par8
  const minDamage = Math.floor((baseMin * (100 + synPct)) / 100)
  const maxDamage = Math.floor((baseMax * (100 + synPct)) / 100)
  const convertPhysToFirePct = Math.min(100, lvl * 3)
  const burningGroundFrames = MARTIAL_SUB_MISSILE_SPECS_113C.fistsoffirefirewall.rangeFrames
  const firewall = evaluateMartialSubMissileDamage('fistsoffirefirewall', lvl, royalStrikeBlvl)
  const firewallTotalMinDamage = Math.floor((firewall.min256 * burningGroundFrames) / 256)
  const firewallTotalMaxDamage = Math.floor((firewall.max256 * burningGroundFrames) / 256)

  return {
    minDamage,
    maxDamage,
    convertPhysToFirePct,
    burningGroundFrames,
    firewallMinDamage256: firewall.min256,
    firewallMaxDamage256: firewall.max256,
    firewallTotalMinDamage,
    firewallTotalMaxDamage,
    attackRatingBonusPct: toHit + toHitLev * (lvl - 1),
    durationFrames: par3,
    manaCost: mana.manaCost,
    manaCost256: mana.manaCost256,
    delayFrames: mana.delayFrames,
    cooldownFrames: mana.delayFrames,
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
  manaCost256: number
  delayFrames: number
  cooldownFrames: number
} {
  const lvl = Math.max(1, Math.floor(slvl))
  const entry = CANONICAL_113C_SKILLS[260]
  const par1 = entry?.params.par1 ?? 50
  const par2 = entry?.params.par2 ?? 5
  const par8 = entry?.params.par8 ?? 4
  const toHit = entry?.toHit ?? 40
  const toHitLev = entry?.toHitLev ?? 25
  const mana = evaluateCanonicalSkillMana113c(260, lvl)
  const enhancedDamagePct = par1 + par2 * (lvl - 1) + clawMasteryBlvl * par8
  const attackRatingBonusPct = toHit + toHitLev * (lvl - 1)

  return {
    enhancedDamagePct,
    attackRatingBonusPct,
    strikesCount: 2,
    manaCost: mana.manaCost,
    manaCost256: mana.manaCost256,
    delayFrames: mana.delayFrames,
    cooldownFrames: mana.delayFrames,
  }
}

/**
 * Skill #265: Cobra Strike
 * 1.13c Parity (`D2Game.dll` `0x6FCB1400`, `Skills.txt` row 265 `prgdam = 2`):
 * - Base Steal%: `ln12 = 40 + 5 * (slvl - 1)%` (`Param1 = 40, Param2 = 5`)
 * - Charge 1: Life Steal = `base%`, Mana Steal = `0%`
 * - Charge 2: Life Steal = `base%`, Mana Steal = `base%`
 * - Charge 3: Life Steal = `2 * base%`, Mana Steal = `2 * base%`
 * - Attack Rating: `15 + 7 * (slvl - 1)%`
 * - Duration: `375` frames (`Param3 = 375`)
 */
export function evaluateCobraStrikeStats(slvl: number): {
  baseStealPct: number
  charge1LifeStealPct: number
  charge1ManaStealPct: number
  charge2LifeStealPct: number
  charge2ManaStealPct: number
  charge3LifeStealPct: number
  charge3ManaStealPct: number
  attackRatingBonusPct: number
  durationFrames: number
  manaCost: number
  manaCost256: number
  delayFrames: number
  cooldownFrames: number
} {
  const lvl = Math.max(1, Math.floor(slvl))
  const entry = CANONICAL_113C_SKILLS[265]
  const par1 = entry?.params.par1 ?? 40
  const par2 = entry?.params.par2 ?? 5
  const par3 = entry?.params.par3 ?? CHARGE_DURATION_FRAMES
  const toHit = entry?.toHit ?? 15
  const toHitLev = entry?.toHitLev ?? 7
  const mana = evaluateCanonicalSkillMana113c(265, lvl)
  const baseStealPct = par1 + par2 * (lvl - 1)

  return {
    baseStealPct,
    charge1LifeStealPct: baseStealPct,
    charge1ManaStealPct: 0,
    charge2LifeStealPct: baseStealPct,
    charge2ManaStealPct: baseStealPct,
    charge3LifeStealPct: baseStealPct * 2,
    charge3ManaStealPct: baseStealPct * 2,
    attackRatingBonusPct: toHit + toHitLev * (lvl - 1),
    durationFrames: par3,
    manaCost: mana.manaCost,
    manaCost256: mana.manaCost256,
    delayFrames: mana.delayFrames,
    cooldownFrames: mana.delayFrames,
  }
}

/**
 * Skill #269: Claws of Thunder
 * 1.13c Parity:
 * - Charge 1 Melee Lightning (`Skills.txt` #269, `HitShift = 8`): `1 [0..0]` to `80 [20,40,60,80,100]`, `+8%` per Royal Strike blvl
 * - Charge 2 Nova (`Missiles.txt` #559 `clawsofthundernova`, `HitShift = 8`): `1 [0..0]` to `30 [15,25,35,45,65]`, `+8%` per Royal Strike blvl
 * - Charge 3 Charged Bolts (`Missiles.txt` #558 `clawsofthunderbolt`, `HitShift = 8`, 16 bolts): `1 [0..0]` to `40 [20,40,60,80,100]`, `+8%` per Royal Strike blvl
 * - Attack Rating: `15 + 7 * (slvl - 1)%`
 * - Duration: `375` frames
 */
export function evaluateClawsOfThunderStats(
  slvl: number,
  royalStrikeBlvl = 0
): {
  minDamage: number
  maxDamage: number
  novaMinDamage: number
  novaMaxDamage: number
  boltMinDamage: number
  boltMaxDamage: number
  chargedBoltsCount: number
  attackRatingBonusPct: number
  durationFrames: number
  manaCost: number
  manaCost256: number
  delayFrames: number
  cooldownFrames: number
} {
  const lvl = Math.max(1, Math.floor(slvl))
  const entry = CANONICAL_113C_SKILLS[269]
  const par3 = entry?.params.par3 ?? CHARGE_DURATION_FRAMES
  const par8 = entry?.params.par8 ?? 8
  const toHit = entry?.toHit ?? 15
  const toHitLev = entry?.toHitLev ?? 7
  const mana = evaluateCanonicalSkillMana113c(269, lvl)
  const synPct = Math.max(0, Math.floor(royalStrikeBlvl)) * par8
  // Claws of Thunder EMin=1, HitShift=8, EMinLev1=0: D2Common #10121 0x6FDA04C7 leaves the min un-synergised (#1681).
  const minDamage = 1
  const baseMax = compute5BandScaling(lvl, 80, 20, 40, 60, 80, 100)
  const maxDamage = Math.floor((baseMax * (100 + synPct)) / 100)
  const nova = evaluateMartialSubMissileDamage('clawsofthundernova', lvl, royalStrikeBlvl)
  const bolt = evaluateMartialSubMissileDamage('clawsofthunderbolt', lvl, royalStrikeBlvl)

  return {
    minDamage,
    maxDamage,
    novaMinDamage: nova.minDamage,
    novaMaxDamage: nova.maxDamage,
    boltMinDamage: bolt.minDamage,
    boltMaxDamage: bolt.maxDamage,
    chargedBoltsCount: 16,
    attackRatingBonusPct: toHit + toHitLev * (lvl - 1),
    durationFrames: par3,
    manaCost: mana.manaCost,
    manaCost256: mana.manaCost256,
    delayFrames: mana.delayFrames,
    cooldownFrames: mana.delayFrames,
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
  manaCost256: number
  delayFrames: number
  cooldownFrames: number
} {
  const lvl = Math.max(1, Math.floor(slvl))
  const entry = CANONICAL_113C_SKILLS[270]
  const par1 = entry?.params.par1 ?? 50
  const par2 = entry?.params.par2 ?? 10
  const par3 = entry?.params.par3 ?? 6
  const toHit = entry?.toHit ?? 20
  const toHitLev = entry?.toHitLev ?? 15
  const mana = evaluateCanonicalSkillMana113c(270, lvl)
  return {
    fireExplosionPct: par1 + par2 * (lvl - 1),
    attackRatingBonusPct: toHit + toHitLev * (lvl - 1),
    radiusSubtiles: par3,
    manaCost: mana.manaCost,
    manaCost256: mana.manaCost256,
    delayFrames: mana.delayFrames,
    cooldownFrames: mana.delayFrames,
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
  manaCost256: number
  delayFrames: number
  cooldownFrames: number
} {
  const lvl = Math.max(1, Math.floor(slvl))
  const entry = CANONICAL_113C_SKILLS[274]
  const par3 = entry?.params.par3 ?? CHARGE_DURATION_FRAMES
  const par8 = entry?.params.par8 ?? 8
  const toHit = entry?.toHit ?? 15
  const toHitLev = entry?.toHitLev ?? 7
  const mana = evaluateCanonicalSkillMana113c(274, lvl)
  const baseMin = compute5BandScaling(lvl, 15, 8, 10, 20, 30, 40)
  const baseMax = compute5BandScaling(lvl, 35, 8, 10, 22, 32, 42)
  const synBonus = 1 + (royalStrikeBlvl * par8) / 100
  const minDamage = Math.floor(baseMin * synBonus)
  const maxDamage = Math.floor(baseMax * synBonus)
  const freezeDurationFrames = 100 + 10 * (lvl - 1)

  return {
    minDamage,
    maxDamage,
    freezeDurationFrames,
    attackRatingBonusPct: toHit + toHitLev * (lvl - 1),
    durationFrames: par3,
    manaCost: mana.manaCost,
    manaCost256: mana.manaCost256,
    delayFrames: mana.delayFrames,
    cooldownFrames: mana.delayFrames,
  }
}

/**
 * Skill #275: Dragon Flight
 * 1.13c Parity (`Skills.txt` row 275):
 * - Teleport kick to target unit within `aurarangecalc = par7 = 27` sub-tiles
 * - Enhanced Damage: `ln12 = 100 + 25 * (slvl - 1)%` (`Param1 = 100, Param2 = 25`)
 * - Attack Rating: `60 + 25 * (slvl - 1)%`
 * - Casting Delay (`delay`): `25` frames (1.0s)
 * - Mana cost: `15` (`manashift = 8, minmana = 1, mana = 15, lvlmana = 0`)
 */
export function evaluateDragonFlightStats(slvl: number): {
  enhancedDamagePct: number
  attackRatingBonusPct: number
  rangeSubtiles: number
  delayFrames: number
  cooldownFrames: number
  nextDelayFrames: number
  manaCost: number
  manaCost256: number
} {
  const lvl = Math.max(1, Math.floor(slvl))
  const entry = CANONICAL_113C_SKILLS[275]
  const par1 = entry?.params.par1 ?? 100
  const par2 = entry?.params.par2 ?? 25
  const par7 = entry?.params.par7 ?? 27
  const toHit = entry?.toHit ?? 60
  const toHitLev = entry?.toHitLev ?? 25
  const mana = evaluateCanonicalSkillMana113c(275, lvl)
  return {
    enhancedDamagePct: par1 + par2 * (lvl - 1),
    attackRatingBonusPct: toHit + toHitLev * (lvl - 1),
    rangeSubtiles: par7,
    delayFrames: mana.delayFrames,
    cooldownFrames: mana.delayFrames,
    nextDelayFrames: 0,
    manaCost: mana.manaCost,
    manaCost256: mana.manaCost256,
  }
}

/**
 * Skill #280: Royal Strike / Phoenix Strike
 * 1.13c Parity (`Skills.txt` #280 & `Missiles.txt` #563, #567, #568, #569):
 * - Tier 1: Meteor (`royalstrikemeteor` #563: `20 [10,19,29,38,46]` to `40 [10,21,33,42,50]`, `+10%` per Fists of Fire blvl)
 *   + Ground Fire (`royalstrikemeteorfire` #567: `HitShift = 3`, `6 [5,10,16,22,30]` to `10 [5,10,17,24,32]`, `+6%` per Fists of Fire blvl, duration `30 + 15 * (slvl - 1)` frames via `0x6FC5E072` `SKILLS_GetParam34Linear`)
 * - Tier 2: Chain Lightning (`royalstrikechainlightning` #568: `1 [0..0]` to `40 [20,40,60,80,100]`, `+13%` per Claws of Thunder blvl, 7 radial bolts via `Param6 = 10`, `TargetX = Param2 + 1 = 7` targets via `0x6FCB4343`, jump radius `Param1 = 8` sub-tiles via `0x6FC5D0FB`)
 * - Tier 3: Chaos Ice (`royalstrikechaosice` #569: `16 [4,8,12,20,28]` to `32 [4,8,13,21,29]`, `+10%` per Blades of Ice blvl, 16 bolts via `Param5 = 16`, freeze `100 [10,15,20]` frames)
 * - Attack Rating: `15 + 7 * (slvl - 1)%`
 * - Duration: `375` frames
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
  meteorGroundFireFrames: number
  meteorGroundFireMinDamage256: number
  meteorGroundFireMaxDamage256: number
  meteorGroundFireTotalMinDamage: number
  meteorGroundFireTotalMaxDamage: number
  chainLightningMinDamage: number
  chainLightningMaxDamage: number
  chainLightningTargets: number
  chainLightningJumpRadiusSubtiles: number
  chainLightningBoltsCount: number
  chaosIceMinDamage: number
  chaosIceMaxDamage: number
  chaosIceBoltsCount: number
  freezeDurationFrames: number
  attackRatingBonusPct: number
  durationFrames: number
  manaCost: number
  manaCost256: number
  delayFrames: number
  cooldownFrames: number
} {
  const lvl = Math.max(1, Math.floor(slvl))
  const entry = CANONICAL_113C_SKILLS[280]
  const par1 = entry?.params.par1 ?? 8
  const par2 = entry?.params.par2 ?? 6
  const par3 = entry?.params.par3 ?? 30
  const par4 = entry?.params.par4 ?? 15
  const par5 = entry?.params.par5 ?? 16
  const par6 = entry?.params.par6 ?? 10
  const toHit = entry?.toHit ?? 15
  const toHitLev = entry?.toHitLev ?? 7
  const mana = evaluateCanonicalSkillMana113c(280, lvl)
  const fofBlvl = synergies.fistsOfFireBlvl ?? 0
  const cotBlvl = synergies.clawsOfThunderBlvl ?? 0
  const boiBlvl = synergies.bladesOfIceBlvl ?? 0

  const meteor = evaluateMartialSubMissileDamage('royalstrikemeteor', lvl, fofBlvl)
  const meteorFire = evaluateMartialSubMissileDamage('royalstrikemeteorfire', lvl, fofBlvl)
  const meteorGroundFireFrames = par3 + par4 * (lvl - 1)
  const meteorGroundFireTotalMinDamage = Math.floor(
    (meteorFire.min256 * meteorGroundFireFrames) / 256,
  )
  const meteorGroundFireTotalMaxDamage = Math.floor(
    (meteorFire.max256 * meteorGroundFireFrames) / 256,
  )

  const chainLtng = evaluateMartialSubMissileDamage('royalstrikechainlightning', lvl, cotBlvl)
  // 1.13c D2Game.dll sub_6FCB3D60 @ 0x6FCB4314..0x6FCB434C:
  // MISSILE_SetTargetX(pMissile, SkillsTxt[280].Param2 + 1) -> 6 + 1 = 7 total chain targets (jump radius Param1 = 8 sub-tiles)
  const chainLightningTargets = par2 + 1
  const chainLightningJumpRadiusSubtiles = par1
  const chainLightningBoltsCount = Math.ceil(64 / par6) // 7 radial bolts (Param6 = 10)

  const chaosIce = evaluateMartialSubMissileDamage('royalstrikechaosice', lvl, boiBlvl)
  const chaosIceBoltsCount = par5 // Param5 = 16
  const freezeDurationFrames = compute3BandDuration(lvl, 100, 10, 15, 20)

  return {
    meteorMinDamage: meteor.minDamage,
    meteorMaxDamage: meteor.maxDamage,
    meteorGroundFireFrames,
    meteorGroundFireMinDamage256: meteorFire.min256,
    meteorGroundFireMaxDamage256: meteorFire.max256,
    meteorGroundFireTotalMinDamage,
    meteorGroundFireTotalMaxDamage,
    chainLightningMinDamage: chainLtng.minDamage,
    chainLightningMaxDamage: chainLtng.maxDamage,
    chainLightningTargets,
    chainLightningJumpRadiusSubtiles,
    chainLightningBoltsCount,
    chaosIceMinDamage: chaosIce.minDamage,
    chaosIceMaxDamage: chaosIce.maxDamage,
    chaosIceBoltsCount,
    freezeDurationFrames,
    attackRatingBonusPct: toHit + toHitLev * (lvl - 1),
    durationFrames: CHARGE_DURATION_FRAMES,
    manaCost: mana.manaCost,
    manaCost256: mana.manaCost256,
    delayFrames: mana.delayFrames,
    cooldownFrames: mana.delayFrames,
  }
}

/**
 * Dual claw eligibility check for Dragon Claw (#260).
 * Requires claw weapons in both hands.
 */
export function canCastDragonClaw(hasLeftClaw: boolean, hasRightClaw: boolean): boolean {
  return hasLeftClaw && hasRightClaw
}
