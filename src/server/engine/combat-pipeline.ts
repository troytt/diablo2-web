/**
 * Diablo II: Lord of Destruction v1.13c `RollToHit` & `SUnitDmg` Combat Pipeline.
 *
 * Implements:
 * - `RollToHit` (`AR` vs `Defense` + `Alvl` vs `Dlvl`, clamped to `[5, 95]`, `autohit` for Smite/Guided Arrow/Spells).
 * - Shield Block, Assassin `Weapon Block` (`263`), and Amazon `Dodge` (`13`), `Avoid` (`18`), `Evade` (`29`).
 * - Weapon `srcdam` (`128 = 100%`), off-weapon `%ED`, Critical Strike / Deadly Strike (`2x`), and Physical-to-Elemental/Magic conversion.
 * - Elemental Masteries (`Fire Mastery` 61, `Lightning Mastery` 63, `Cold Mastery` 65, `passive_*_mastery`).
 * - Conviction (`123`) & Lower Resist (`91`) Immunity-Breaking (`1/5` efficiency when base resistance >= 100%,
 *   followed by `-Enemy Res` at 100% effectiveness only after immunity is broken below 100%).
 * - 1.13c Binary Overrides:
 *   1. **Blessed Hammer (`112`)**: Does NOT ignore Magic Resistance of Undead or Demons in 1.13c!
 *      (Undead/Demons with `magicresist >= 100` take `0` damage; Undead with `< 100` magic resist still
 *      receive `+50%` Undead bonus and `+50%` of active Concentration aura `%ED`.)
 *   2. **Corpse Explosion (`74`)**: Scales at **`70%–120%`** (`Param1=70, Param2=120`) of base monster HP,
 *      split `50%` Physical + `50%` Fire.
 *   3. **Venom (`278`)**: Clamps total poison duration of all weapon/item poison sources to **`10` frames (`0.4s`)**
 *      while summing their per-frame poison bitrates (`<< 8`) with Venom's bitrate.
 */
import { FIXED_ONE, UnitStatList } from './stat-list.ts'
import { StateBus, type ReactiveUnitOverlayEvent } from './state-bus.ts'
import { calculateLowerResistReduction, calculateIronMaidenReturnPct } from './missile-engine.ts'
import {
  calculateHolyFireStats,
  calculateHolyFreezeStats,
  calculateHolyShockStats,
} from '../skills/skills.ts'
import {
  evaluateBarbarianMastery,
  isWeaponMatchingMastery,
  type WeaponMasteryStats,
} from '../skills/barbarian-masteries.ts'
import { computeVenomPoisonDamage } from '../skills/assassin-shadow.ts'

/**
 * RNG contract required by 1.13c combat pipeline functions (`D2Game.dll` `pUnit + 0x20` LCG).
 * Compatible with `D2Rng` (`src/common/rng/d2-rng.ts`).
 */
export interface CombatRng {
  rand(max: number): number
}

/**
 * Roll a damage value in `[min256, max256]` (8.8 fixed-point) using 1.13c RNG (`D2Game.dll`
 * `SUNITDMG_RollDamageValue` `0x6FCFCD80` -> `0x6FCFBED0`).
 *
 * - When `max256 <= min256`, returns `Math.max(0, min256)` without advancing RNG (`0x6FCFC009`).
 * - When both `min256` and `max256` are exact integer multiples of `FIXED_ONE` (`256`),
 *   rolls uniformly in whole-damage units `[minWhole, maxWhole]` and shifts `<< 8`, so integer
 *   damage ranges (`[10..20]`) produce exact uniform integer hits without ceiling bias.
 * - Otherwise rolls uniformly across the 256-fixed sub-interval `[min256, max256]`.
 */
function boundedRand(rng: CombatRng, span: number): number {
  if (span <= 1) return 0
  const raw = Math.trunc(rng.rand(span))
  if (!Number.isFinite(raw) || raw < 0) return 0
  return raw >= span ? raw % span : raw
}

export function rollDamageRange256(min256: number, max256: number, rng: CombatRng): number {
  const lo = Math.max(0, Math.trunc(min256))
  const hi = Math.max(0, Math.trunc(max256))
  if (hi <= lo) return lo
  if ((lo & 0xff) === 0 && (hi & 0xff) === 0) {
    const loWhole = Math.trunc(lo / FIXED_ONE)
    const hiWhole = Math.trunc(hi / FIXED_ONE)
    return (loWhole + boundedRand(rng, hiWhole - loWhole + 1)) * FIXED_ONE
  }
  return lo + boundedRand(rng, hi - lo + 1)
}

export interface CombatUnitContext {
  readonly id: string
  readonly name: string
  readonly charClass?: string | undefined
  readonly statList: UnitStatList
  readonly stateBus: StateBus
  readonly x?: number
  readonly y?: number
  readonly ownerUnitId?: string
  readonly ownerRef?: CombatUnitContext | undefined
  readonly isUndead?: boolean
  readonly isDemon?: boolean
  readonly isMoving?: boolean
  readonly isDualClaw?: boolean
  readonly hasShield?: boolean
  readonly isRanged?: boolean
  weaponItemType?: string
  readonly offHandWeaponItemType?: string
  readonly weaponMinPhys?: number
  readonly weaponMaxPhys?: number
  readonly weaponPoisonBitrate256?: number
  readonly weaponPoisonFrames?: number
  readonly unitType?: 'player' | 'mercenary' | 'party' | 'party_mercenary' | 'minion' | 'monster'
  /**
   * `DifficultyLevels.txt` `ResistPenalty` (0 / -40 / -100) of the game this unit lives in.
   * Read only on the player/hireling branch of `D2Game.dll` 0x6FCFB3C0 (see
   * {@link defenderResistParams113c}); fixtures built outside a game instance leave it unset,
   * which is the Normal row (0).
   */
  readonly resistPenalty?: number | undefined
  /**
   * `DifficultyLevels.txt` `LifeStealDivisor` / `ManaStealDivisor` (1 / 2 / 3) of the game a
   * player attacker lives in. `D2Game.dll` 0x6FCFBACF..0x6FCFBAF3 divides only a `UNIT_PLAYER`
   * attacker's steal % by them (see {@link computeLifeManaSteal113c}); fixtures built outside a
   * game instance leave them unset, which is the Normal row (1).
   */
  readonly lifeStealDivisor?: number | undefined
  readonly manaStealDivisor?: number | undefined
  /**
   * `MonStats.txt` `Drain` / `Drain(N)` / `Drain(H)` of the current difficulty for a
   * monster-class defender (`MonStatsTxt + 0xA0 + difficulty`, read at `D2Game.dll` 0x6FCFBA8E).
   * Steal against a monster-class defender is scaled by `Drain / 100` and skipped when
   * `Drain <= 0` (e.g. `skeleton1`). Required whenever a monster-class defender is stolen from.
   */
  readonly drain?: number | undefined
  readonly isBoss?: boolean
  readonly isPrimeEvil?: boolean
  readonly coldEffect?: number
  readonly isChampion?: boolean
  readonly rank?: 'normal' | 'champion' | 'unique' | 'minion' | 'boss'
  readonly hasDualWield?: boolean
  readonly isDualWielding?: boolean
  readonly hasDualThrow?: boolean
  readonly isThrowing?: boolean
  readonly thrownMissile?: string
  readonly offHandThrownMissile?: string
  ammoQuantity?: number
  weaponQuantity?: number
  readonly firesMagicArrows?: boolean
  readonly firesExplosiveArrows?: boolean
  readonly hasOffHandWeapon?: boolean
  readonly offHandIsThrowing?: boolean
  readonly offHandIsRanged?: boolean
  readonly offHandWeaponType?: string
  offHandQuantity?: number
  offHandWeaponQuantity?: number
  readonly offHandMinPhys?: number
  readonly offHandMaxPhys?: number
  readonly kickMinDam?: number
  readonly kickMaxDam?: number
  readonly bootMinDam?: number
  readonly bootMaxDam?: number
  readonly petId?: string
  readonly petType?: string
  readonly petOwnerId?: string | number
  readonly unsummonable?: boolean
  scrollCount?: number
  tomeQuantity?: number
  readonly targetItem?: { id?: string | number; code?: string; identified?: boolean; name?: string }
  readonly townPortalSlot?: import('../../common/world/portal.ts').TownPortalSlot | { cast: (p: any) => any; current?: any }
  readonly passiveSkills?: ReadonlyMap<number, number>
}

export interface ResistanceResult {
  readonly baseRes: number
  readonly convictionAndLRApplied: number
  readonly resAfterConvictionLR: number
  readonly isImmune: boolean
  readonly effectiveRes: number
}

/** Resistance channel of the `D2Game.dll` descriptor table at 0x6FD22AB0 (0x2C-byte records). */
export type ResistChannel113c = 'phys' | 'mag' | 'fire' | 'ltng' | 'cold' | 'pois'

/**
 * True when `D2Game.dll` 0x6FCFB3C0 resolves this unit on the player branch.
 *
 * The context flag `[ctx+0x14]` (set at 0x6FCFC10A..0x6FCFC121) is 1 only for a
 * `UNIT_MONSTER` whose D2Common #11104 hireling type is 0. Players and hirelings
 * therefore share the penalised / capped branch, while ordinary monsters and
 * player summons (minions) take the uncapped monster branch.
 */
export function usesPlayerResistBranch113c(unit: Pick<CombatUnitContext, 'unitType'>): boolean {
  return (
    unit.unitType === 'player' ||
    unit.unitType === 'mercenary' ||
    unit.unitType === 'party' ||
    unit.unitType === 'party_mercenary'
  )
}

/**
 * Player/hireling upper bound, `D2Game.dll` 0x6FCFB44A..0x6FCFB4B3:
 * - descriptors with a max stat (fire 40, ltng 42, cold 44, pois 46, magic 38) cap at
 *   `min(95, 75 + stat(max))`;
 * - `damageresist` (36) has no max stat and caps at 50.
 */
export function playerResistCap113c(statList: UnitStatList, channel: ResistChannel113c): number {
  if (channel === 'phys') return 50
  return statList.getEffectiveMaxResistance(channel)
}

/** 0x6FCFB405..0x6FCFB410: `damageresist` (0x24) and `magicresist` (0x25) never take the difficulty penalty. */
export function channelTakesDifficultyPenalty113c(channel: ResistChannel113c): boolean {
  return channel !== 'phys' && channel !== 'mag'
}

/** Branch selection + player cap + difficulty penalty for {@link computeEffectiveResistance}. */
export function defenderResistParams113c(
  unit: Pick<CombatUnitContext, 'unitType' | 'statList' | 'resistPenalty'>,
  channel: ResistChannel113c,
): { isDefenderPlayer: boolean; maxResistance?: number; resistPenalty?: number } {
  if (!usesPlayerResistBranch113c(unit)) return { isDefenderPlayer: false }
  return {
    isDefenderPlayer: true,
    maxResistance: playerResistCap113c(unit.statList, channel),
    resistPenalty: channelTakesDifficultyPenalty113c(channel) ? Math.trunc(unit.resistPenalty ?? 0) : 0,
  }
}

/**
 * Compute effective resistance under 1.13c Conviction (`123`) + Lower Resist (`91`)
 * `1/5` immunity-breaking rule and `-Enemy Resistance` (`Cold Mastery` / facets).
 *
 * Mirrors `D2Game.dll` 0x6FCFB3C0:
 * - monster branch: `-enemy res` is skipped when `res >= 100`; no difficulty penalty and no
 *   upper cap (`>= 100` stays immune); lower bound -100.
 * - player/hireling branch (`isDefenderPlayer`): `res - pierce + ResistPenalty`, then
 *   `res <= 0 ? max(-100, res) : min(res, maxResistance)`. Never immune.
 */
export function computeEffectiveResistance(params: {
  baseRes: number
  convictionPierce?: number
  lowerResistPierce?: number
  passiveEnemyPierce?: number
  canBreakImmunity?: boolean
  maxResistance?: number | undefined
  /** Player/hireling branch of 0x6FCFB3C0 (see {@link usesPlayerResistBranch113c}). Must be explicit. */
  isDefenderPlayer: boolean
  /** `DifficultyLevels.txt` `ResistPenalty` (player branch only; 0 for phys/magic channels). */
  resistPenalty?: number | undefined
}): ResistanceResult {
  const baseRes = Math.trunc(params.baseRes)
  const rawConvictionAndLR = Math.max(0, Math.trunc((params.convictionPierce ?? 0) + (params.lowerResistPierce ?? 0)))
  const canBreak = params.canBreakImmunity ?? true

  // 1.13c Rule: When base resistance >= 100%, Conviction and Lower Resist apply at 1/5 effectiveness!
  // Note: For player units, positive resistance stacks to buffer against -res, but cannot grant immunity.
  if (params.isDefenderPlayer) {
    if (params.maxResistance === undefined) {
      throw new Error('computeEffectiveResistance: player/hireling defender requires maxResistance (D2Game 0x6FCFB44A)')
    }
    const resAfterConvictionLR = baseRes - rawConvictionAndLR
    const passivePierce = Math.max(0, Math.trunc(params.passiveEnemyPierce ?? 0))
    const res = resAfterConvictionLR - passivePierce + Math.trunc(params.resistPenalty ?? 0)
    const effectiveRes = res <= 0 ? Math.max(-100, res) : Math.min(res, Math.trunc(params.maxResistance))
    return {
      baseRes,
      convictionAndLRApplied: rawConvictionAndLR,
      resAfterConvictionLR,
      isImmune: false,
      effectiveRes,
    }
  }

  const convictionAndLRApplied =
    baseRes >= 100
      ? canBreak
        ? Math.trunc(rawConvictionAndLR / 5)
        : 0
      : rawConvictionAndLR

  const resAfterConvictionLR = baseRes - convictionAndLRApplied
  if (resAfterConvictionLR >= 100) {
    return {
      baseRes,
      convictionAndLRApplied,
      resAfterConvictionLR,
      isImmune: true,
      effectiveRes: 100,
    }
  }


  const passivePierce = Math.max(0, Math.trunc(params.passiveEnemyPierce ?? 0))
  const maxRes = params.maxResistance !== undefined ? Math.min(95, Math.max(0, params.maxResistance)) : 99
  const effectiveRes = Math.max(-100, Math.min(maxRes, resAfterConvictionLR - passivePierce))
  return {
    baseRes,
    convictionAndLRApplied,
    resAfterConvictionLR,
    isImmune: false,
    effectiveRes,
  }
}


/**
 * Compute 1.13c `RollToHit` chance (`[5, 95]`, or `100` for `autohit` skills such as Smite / Guided Arrow / Spells).
 */
export function computeToHitChance(params: {
  attackerAr: number
  defenderDef: number
  attackerLvl: number
  defenderLvl: number
  skillArBonusPct?: number
  targetDefPctMod?: number // e.g. -50% from Battle Cry / Cloak of Shadows / Inner Sight
  autoHit?: boolean
}): number {
  if (params.autoHit) return 100
  const arBonusPct = params.skillArBonusPct ?? 0
  const effAr = Math.max(1, Math.trunc((params.attackerAr * (100 + arBonusPct)) / 100))
  const defMod = params.targetDefPctMod ?? 0
  const effDef = Math.max(0, Math.trunc((params.defenderDef * Math.max(0, 100 + defMod)) / 100))
  const alvl = Math.max(1, params.attackerLvl)
  const dlvl = Math.max(1, params.defenderLvl)

  const divisor = effAr + effDef
  const toHitFactor = divisor > 0 ? Math.trunc((100 * effAr) / divisor) : 100
  const raw = Math.trunc((2 * alvl * toHitFactor) / (alvl + dlvl))
  return Math.max(5, Math.min(95, raw))
}

/**
 * Evaluate shield block (`D2Game.dll` `0x6FCFB790`), Assassin Weapon Block (`263`, `0x6FCFB0DE`),
 * and Amazon Evade (`29`, `0x6FCFB065`), Dodge (`13`, `0x6FCFB11F`), Avoid (`18`, `0x6FCFB156`).
 *
 * Each active check draws its own independent `rng.rand(100)` roll in 1.13c (never reusing the
 * attacker's `RollToHit` roll or a previous avoidance roll).
 */
export function evaluateAvoidanceAndBlock(params: {
  defender: CombatUnitContext
  attackKind: 'melee' | 'missile' | 'spell'
  rng: CombatRng
  unblockable?: boolean
  isPersistentGroundFire?: boolean
  roll100?: number | undefined
  shieldBlockRoll100?: number | undefined
  weaponBlockRoll100?: number | undefined
  evadeRoll100?: number | undefined
  dodgeRoll100?: number | undefined
  avoidRoll100?: number | undefined
}): { avoided: boolean; reason: 'none' | 'block' | 'weapon_block' | 'dodge' | 'avoid' | 'evade' } {
  if (!params.rng || typeof params.rng.rand !== 'function') {
    throw new Error('evaluateAvoidanceAndBlock: rng is required (D2Game.dll 0x6FCFB790 / 0x6FCFB030)')
  }
  if (params.unblockable) return { avoided: false, reason: 'none' }
  const defStats = params.defender.statList

  // 1. Shield Block (0x6FCFB790..0x6FCFB7FF, applies to physical melee/missile)
  if (params.attackKind !== 'spell' && params.defender.hasShield) {
    const blockChance = Math.min(75, Math.max(0, defStats.getAccruedStat('toblock')))
    if (blockChance > 0) {
      const blockRoll = params.shieldBlockRoll100 ?? params.roll100 ?? params.rng.rand(100)
      if (blockRoll < blockChance) {
        return { avoided: true, reason: 'block' }
      }
    }
  }

  // 2. Assassin Weapon Block (`skillId = 263`, 0x6FCFB0DE, blocks melee, missiles, and most spells while stationary/attacking with dual claws)
  const defAny = params.defender as unknown as Record<string, unknown>
  const isMovingOrRunning = Boolean(
    params.defender.isMoving || defAny['isWalking'] || defAny['isRunning']
  )
  const wType = (params.defender.weaponItemType ?? '').trim().toLowerCase()
  const isClawWielded =
    params.defender.isDualClaw === true ||
    ((params.defender.isDualClaw !== false && !params.defender.hasShield) &&
      (wType === '' || wType === 'h2h' || wType === 'h2h2' || wType === 'claw' || wType === 'katar'))
  if (isClawWielded && !isMovingOrRunning && !params.isPersistentGroundFire) {
    const wbChance = Math.min(65, Math.max(0, defStats.getAccruedStat('passive_weaponblock')))
    if (wbChance > 0) {
      const wbRoll = params.weaponBlockRoll100 ?? params.roll100 ?? params.rng.rand(100)
      if (wbRoll < wbChance) {
        return { avoided: true, reason: 'weapon_block' }
      }
    }
  }

  // 3. Amazon Evade (`skillId = 29`, 0x6FCFB065, while moving)
  if (params.defender.isMoving) {
    const evadeChance = Math.min(75, Math.max(0, defStats.getAccruedStat('passive_evade')))
    if (evadeChance > 0) {
      const evadeRoll = params.evadeRoll100 ?? params.roll100 ?? params.rng.rand(100)
      if (evadeRoll < evadeChance) {
        return { avoided: true, reason: 'evade' }
      }
    }
  } else {
    // 4. Amazon Dodge (`skillId = 13`, 0x6FCFB11F, melee while stationary)
    if (params.attackKind === 'melee') {
      const dodgeChance = Math.min(75, Math.max(0, defStats.getAccruedStat('passive_dodge')))
      if (dodgeChance > 0) {
        const dodgeRoll = params.dodgeRoll100 ?? params.roll100 ?? params.rng.rand(100)
        if (dodgeRoll < dodgeChance) {
          return { avoided: true, reason: 'dodge' }
        }
      }
    }
    // 5. Amazon Avoid (`skillId = 18`, 0x6FCFB156, missile/ranged while stationary)
    if (params.attackKind === 'missile') {
      const avoidChance = Math.min(75, Math.max(0, defStats.getAccruedStat('passive_avoid')))
      if (avoidChance > 0) {
        const avoidRoll = params.avoidRoll100 ?? params.roll100 ?? params.rng.rand(100)
        if (avoidRoll < avoidChance) {
          return { avoided: true, reason: 'avoid' }
        }
      }
    }
  }

  return { avoided: false, reason: 'none' }
}

/**
 * 1.13c Venom (`skillId = 278`) Poison Duration Clamp:
 * When `STATE_VENOM` is active on a weapon attack, clamps total poison duration of ALL
 * weapon/charm poison sources to **10 frames (`0.4s`)** while summing their per-frame
 * poison bitrates (`<< 8`) with Venom's bitrate!
 */
export function resolveVenomPoisonApplication(params: {
  venomActive: boolean
  venomBitrate256: number
  otherPoisonSources: readonly { bitrate256: number; frames: number }[]
}): { bitrate256: number; durationFrames: number; totalDamage256: number; totalDamage: number } {
  if (params.venomActive) {
    const clampedDuration = 10 // 1.13c Venom fixed 10-frame clamp (0.4s)
    let totalBitrate256 = Math.max(0, Math.trunc(params.venomBitrate256))
    for (const src of params.otherPoisonSources) {
      if (src.bitrate256 > 0 && src.frames > 0) {
        totalBitrate256 += Math.trunc(src.bitrate256)
      }
    }
    const totalDamage256 = totalBitrate256 * clampedDuration
    return {
      bitrate256: totalBitrate256,
      durationFrames: clampedDuration,
      totalDamage256,
      totalDamage: Math.trunc(totalDamage256 / FIXED_ONE),
    }
  }

  let sumBitrate256 = 0
  let sumFrames = 0
  let count = 0
  for (const src of params.otherPoisonSources) {
    if (src.bitrate256 > 0 && src.frames > 0) {
      sumBitrate256 += Math.trunc(src.bitrate256)
      sumFrames += Math.trunc(src.frames)
      count += 1
    }
  }
  const avgFrames = count > 0 ? Math.trunc(sumFrames / count) : 0
  const totalDamage256 = sumBitrate256 * avgFrames
  return {
    bitrate256: sumBitrate256,
    durationFrames: avgFrames,
    totalDamage256,
    totalDamage: Math.trunc(totalDamage256 / FIXED_ONE),
  }
}

/**
 * 1.13c Corpse Explosion (`skillId = 74`) Damage Calculator:
 * In 1.13c (`Patch_D2.mpq` `Skills.txt` & `D2Game.dll` `SKILLS_SrvDo055_CorpseExplosion` `0x6FD10DC0`):
 * - Scales at **70%–120%** (`Param1=70`, `Param2=120`) of base monster HP, split **50% Physical + 50% Fire** (`Param5=50`).
 * - When `casterLevel < corpseLevel`, scales `corpseBaseHp = floor((corpseBaseHp * casterLevel) / corpseLevel)`.
 * - Dual-radius AoE (`Param3=8`, `Param4=1`, `calc2 = (par3 + lvl*par4 - par4)/2`):
 *   - Outer Fire ring radius: `nOuterRange = floor((8 + slvl) / 2)` subtiles.
 *   - Inner Physical+Fire ring radius: `nInnerRange = floor((8 + slvl - 1) / 2)` subtiles.
 */
export function computeCorpseExplosion113c(params: {
  corpseBaseHp: number
  rollPct?: number // percentage in [70..120]; if omitted and rng is provided, rolled in [70..120]
  rng?: CombatRng | undefined
  targetPhysRes?: number
  targetFireRes?: number
  convictionPierce?: number
  lowerResistPierce?: number
  amplifyDamagePierce?: number // e.g. 100 for Amplify Damage, 50 for Decrepify
  casterLevel?: number | undefined
  corpseLevel?: number | undefined
  slvl?: number | undefined
  distanceSubtiles?: number | undefined
}): {
  minRollPct: number
  maxRollPct: number
  chosenPct: number
  effectiveCorpseBaseHp: number
  innerPhysRadiusSubtiles: number
  outerFireRadiusSubtiles: number
  rawTotalDamage: number
  rawPhysDamage: number
  rawFireDamage: number
  finalPhysDamage: number
  finalFireDamage: number
  finalTotalDamage: number
} {
  const minRollPct = 70
  const maxRollPct = 120
  const rawRollPct =
    params.rollPct !== undefined
      ? params.rollPct
      : params.rng !== undefined
        ? minRollPct + params.rng.rand(maxRollPct - minRollPct + 1)
        : 95
  const chosenPct = Math.max(minRollPct, Math.min(maxRollPct, rawRollPct))
  const effectiveCorpseBaseHp =
    params.casterLevel !== undefined &&
    params.corpseLevel !== undefined &&
    params.casterLevel > 0 &&
    params.corpseLevel > 0 &&
    params.casterLevel < params.corpseLevel
      ? Math.trunc((params.corpseBaseHp * params.casterLevel) / params.corpseLevel)
      : params.corpseBaseHp
  const slvl = Math.max(1, Math.floor(params.slvl ?? 1))
  const rawRange = 8 + (slvl - 1)
  const outerFireRadiusSubtiles = Math.floor((rawRange + 1) / 2)
  const innerPhysRadiusSubtiles = Math.floor(rawRange / 2)

  const rawTotalDamage = Math.trunc((effectiveCorpseBaseHp * chosenPct) / 100)
  const rawFireDamage = Math.trunc((rawTotalDamage * 50) / 100)
  const rawPhysDamage = rawTotalDamage - rawFireDamage

  // Corpse Explosion callers only iterate monsters: monster branch of 0x6FCFB3C0.
  const physRes = computeEffectiveResistance({
    isDefenderPlayer: false,
    baseRes: params.targetPhysRes ?? 0,
    convictionPierce: params.amplifyDamagePierce ?? 0,
  })
  const fireRes = computeEffectiveResistance({
    isDefenderPlayer: false,
    baseRes: params.targetFireRes ?? 0,
    convictionPierce: params.convictionPierce ?? 0,
    lowerResistPierce: params.lowerResistPierce ?? 0,
  })

  const inOuterFireRing =
    params.distanceSubtiles === undefined || params.distanceSubtiles <= outerFireRadiusSubtiles
  const inInnerPhysRing =
    params.distanceSubtiles === undefined || params.distanceSubtiles <= innerPhysRadiusSubtiles

  const finalPhysDamage =
    !inInnerPhysRing || physRes.isImmune
      ? 0
      : Math.max(0, Math.trunc((rawPhysDamage * (100 - physRes.effectiveRes)) / 100))
  const finalFireDamage =
    !inOuterFireRing || fireRes.isImmune
      ? 0
      : Math.max(0, Math.trunc((rawFireDamage * (100 - fireRes.effectiveRes)) / 100))

  return {
    minRollPct,
    maxRollPct,
    chosenPct,
    effectiveCorpseBaseHp,
    innerPhysRadiusSubtiles,
    outerFireRadiusSubtiles,
    rawTotalDamage,
    rawPhysDamage,
    rawFireDamage,
    finalPhysDamage,
    finalFireDamage,
    finalTotalDamage: finalPhysDamage + finalFireDamage,
  }
}

export interface SUnitDmgPacket {
  readonly skillId: number
  readonly attackKind?: 'melee' | 'missile' | 'spell'
  readonly srcDam?: number // 128 = 100% weapon damage
  readonly physDamagePct?: number // skill off-weapon %ED
  readonly flatPhysMin256?: number
  readonly flatPhysMax256?: number
  readonly elemType?: string // 'fire' | 'ltng' | 'cold' | 'pois' | 'mag' | 'stun'
  readonly elemMin256?: number
  readonly elemMax256?: number
  readonly elemDurationFrames?: number
  readonly slvl?: number
  readonly physToElemPct?: number // e.g. Berserk 100% magic, Magic Arrow / Fire Arrow %
  readonly concentrationBonusPct?: number // active Concentration aura %ED for Blessed Hammer (50% efficiency)
  readonly convictionPierce?: number
  readonly lowerResistPierce?: number
  readonly passiveEnemyPierce?: number
  readonly autoHit?: boolean
  readonly unblockable?: boolean
  readonly roll100?: number
  readonly blockRoll100?: number | undefined
  readonly isPoison?: boolean
  readonly isOpenWounds?: boolean
  readonly returnFire?: boolean
  readonly isEnchant?: boolean
  readonly selfDamagePct?: number | undefined
  readonly multiElemPacket?: {
    readonly firePct?: number | undefined
    readonly coldPct?: number | undefined
    readonly ltngPct?: number | undefined
    readonly chillDurationFrames?: number | undefined
  } | undefined
  readonly stunDurationFrames?: number | undefined
  readonly knockback?: boolean | undefined
  readonly isAlly?: boolean | undefined
  readonly rollUninterrupted?: number | undefined
  readonly canTriggerProcs?: boolean | undefined
  readonly suppressGearLeech?: boolean | undefined
  readonly critRoll100?: number | undefined
  readonly csRoll100?: number | undefined
  readonly masteryCritRoll100?: number | undefined
  readonly dsRoll100?: number | undefined
  readonly toHitBonusPct?: number | undefined
  readonly bypassUndeadMagicRes?: boolean | undefined
  readonly concentrationAlreadyApplied?: boolean | undefined
  readonly rng?: CombatRng | undefined
}

export interface SUnitDmgOutcome {
  readonly hit: boolean
  readonly avoidedReason: 'none' | 'miss' | 'block' | 'weapon_block' | 'dodge' | 'avoid' | 'evade'
  readonly immuneToElem: boolean
  readonly immuneToPhys: boolean
  readonly physDamage256: number
  readonly elemDamage256: number
  readonly totalDamage256: number
  readonly totalDamage: number
  readonly targetHpBefore256: number
  readonly targetHpAfter256: number
  readonly targetKilled: boolean
  readonly isCritical?: boolean
  readonly uninterrupted?: boolean
  readonly attackerStatesApplied?: readonly string[]
  readonly attackerColdDamage256?: number
  readonly reflectedPhys256?: number
  readonly attackerHealed256?: number
  readonly attackerManaLeeched256?: number
  readonly selfDamageTaken256?: number
  readonly spawnedMissiles?: readonly string[]
  readonly procsSuppressed?: boolean
  readonly attackerOverlaysApplied?: readonly string[]
  readonly defenderOverlaysApplied?: readonly string[]
  readonly unitOverlays?: readonly ReactiveUnitOverlayEvent[]
}

/**
 * `D2Game.dll` 0x6FC214D0: overflow-guarded `a * b / c` (truncating) used by the steal path.
 * - `c == 0` returns 0;
 * - `b > 0x100000`: `(b / c) * a` unless `c > b >> 4`, which takes the 64-bit product;
 * - `a > 0x10000`: `(a / c) * b` unless `c > a >> 4`, which takes the 64-bit product;
 * - otherwise the 32-bit `a * b / c`.
 */
export function mulDiv113c(a: number, b: number, c: number): number {
  if (c === 0) return 0
  const wide = (): number => Number((BigInt(a) * BigInt(b)) / BigInt(c))
  if (b > 0x100000) {
    return c > b >> 4 ? wide() : Math.imul(Math.trunc(b / c), a)
  }
  if (a > 0x10000) {
    return c > a >> 4 ? wide() : Math.imul(Math.trunc(a / c), b)
  }
  return Math.trunc(Math.imul(a, b) / c)
}

/**
 * Attacker branch of `D2Game.dll` 0x6FCFBA40 (life / mana steal):
 * - `'player'`: `UNIT_PLAYER` (0x6FCFBABA `[attacker] == 0`) — steal % divided by
 *   `DifficultyLevels.txt` `LifeStealDivisor` / `ManaStealDivisor`;
 * - `'owned'`: a `UNIT_MONSTER` that is a hireling (D2Common hireling check at 0x6FCFBBBE) or is
 *   owned by a player (owner lookup at 0x6FCFBC11) — same formula without the divisor;
 * - `undefined`: any other monster takes the separate MonStats drain branch at 0x6FCFBC22, which
 *   does not read `lifedrainmindam` / `manadrainmindam` percentages and is not modelled here.
 */
export function stealAttackerClass113c(
  unit: Pick<CombatUnitContext, 'unitType'>,
): 'player' | 'owned' | undefined {
  switch (unit.unitType) {
    case 'player':
    case 'party':
      return 'player'
    case 'mercenary':
    case 'party_mercenary':
    case 'minion':
      return 'owned'
    default:
      return undefined
  }
}

/** `UNIT_MONSTER` defenders (monsters, hirelings, summons) carry a `MonStats.txt` `Drain` row. */
export function isMonsterClassUnit113c(unit: Pick<CombatUnitContext, 'unitType'>): boolean {
  return (
    unit.unitType === 'monster' ||
    unit.unitType === 'minion' ||
    unit.unitType === 'mercenary' ||
    unit.unitType === 'party_mercenary'
  )
}

/**
 * Life / mana steal amounts (256-fixed, before the attacker's max life / max mana clamp) per
 * `D2Game.dll` 0x6FCFBA40 (`kb/combat/d2game-life-mana-steal-113c.md`):
 *
 * 1. both steal % zero → nothing (0x6FCFBA47..0x6FCFBA5A);
 * 2. monster-class defender: `drain = MonStats.Drain[difficulty]`, `drain <= 0` → nothing
 *    (0x6FCFBA75..0x6FCFBA9C); any other defender uses 100;
 * 3. `pct <<= 6` (0x6FCFBAA2..0x6FCFBAB1);
 * 4. player attacker: `pct /= LifeStealDivisor | ManaStealDivisor` when non-zero (0x6FCFBACF..0x6FCFBAF3);
 * 5. `phys <= 0` → nothing (0x6FCFBAFD);
 * 6. `v = MulDiv(pct, phys, 100)`, then `v = MulDiv(drain, v, 100)` when `drain != 100`,
 *    then `v / 64` truncated toward zero (0x6FCFBB0A..0x6FCFBB35 mana, 0x6FCFBB4E..0x6FCFBB6C life).
 */
export function computeLifeManaSteal113c(params: {
  readonly phys256: number
  readonly lifeStealPct: number
  readonly manaStealPct: number
  readonly attackerIsPlayer: boolean
  readonly lifeStealDivisor: number
  readonly manaStealDivisor: number
  readonly defenderIsMonster: boolean
  readonly defenderDrain: number | undefined
}): { readonly life256: number; readonly mana256: number } {
  const none = { life256: 0, mana256: 0 }
  let life = Math.trunc(params.lifeStealPct)
  let mana = Math.trunc(params.manaStealPct)
  if (life === 0 && mana === 0) return none
  let drain = 100
  if (params.defenderIsMonster) {
    if (params.defenderDrain === undefined) {
      throw new Error('life/mana steal: monster-class defender has no MonStats Drain value')
    }
    drain = Math.trunc(params.defenderDrain)
    if (drain <= 0) return none
  }
  life *= 64
  mana *= 64
  if (params.attackerIsPlayer) {
    if (params.lifeStealDivisor !== 0) life = Math.trunc(life / params.lifeStealDivisor)
    if (params.manaStealDivisor !== 0) mana = Math.trunc(mana / params.manaStealDivisor)
  }
  const phys = Math.trunc(params.phys256)
  if (phys <= 0) return none
  const scale = (pct64: number): number => {
    if (pct64 === 0) return 0
    let v = mulDiv113c(pct64, phys, 100)
    if (drain !== 100) v = mulDiv113c(drain, v, 100)
    return Math.trunc(v / 64)
  }
  return { life256: scale(life), mana256: scale(mana) }
}

/**
 * Execute the complete 1.13c `SUnitDmg` damage pipeline from `attacker` onto `defender`
 * (`D2Game.dll` `0x6FCFE011`, `0x6FCFB790`, `0x6FCFB030`, `0x6FCFC530`, `0x6FCFD51A`, `0x6FCFCD80`).
 *
 * Requires a `CombatRng` instance either via the 4th parameter `rng` or inside `packet.rng`.
 */
export function executeSUnitDmg(
  attacker: CombatUnitContext,
  defender: CombatUnitContext,
  packet: SUnitDmgPacket & { readonly rng: CombatRng },
  rng?: CombatRng,
): SUnitDmgOutcome
export function executeSUnitDmg(
  attacker: CombatUnitContext,
  defender: CombatUnitContext,
  packet: SUnitDmgPacket,
  rng: CombatRng,
): SUnitDmgOutcome
export function executeSUnitDmg(
  attacker: CombatUnitContext,
  defender: CombatUnitContext,
  packet: SUnitDmgPacket,
  rng?: CombatRng,
): SUnitDmgOutcome {
  const resolvedRng = rng ?? packet.rng
  if (!resolvedRng || typeof resolvedRng.rand !== 'function') {
    throw new Error('executeSUnitDmg: rng is required (D2Game.dll SUnitDmg 0x6FCFCD80 / 0x6FCFE011)')
  }
  const hpBefore256 = defender.statList.getHp256()

  // 1.13c Pre-requisite equipment guards with tri-state semantics:
  // Smite (97): strictly requires an equipped shield (D2MOO SkillPal.cpp:170)
  if (packet.skillId === 97 && attacker.hasShield === false) {
    return {
      hit: false,
      avoidedReason: 'miss',
      immuneToElem: false,
      immuneToPhys: false,
      physDamage256: 0,
      elemDamage256: 0,
      totalDamage256: 0,
      totalDamage: 0,
      targetHpBefore256: hpBefore256,
      targetHpAfter256: hpBefore256,
      targetKilled: false,
    }
  }

  // Melee combat attacks (Sacrifice 96, Zeal 106, Charge 107, Vengeance 111, Conversion 116):
  // strictly require melee weapon (itypea1 = 'mele')
  if (
    (packet.skillId === 96 ||
      packet.skillId === 106 ||
      packet.skillId === 107 ||
      packet.skillId === 111 ||
      packet.skillId === 116) &&
    (attacker.weaponItemType === 'bow' ||
      (attacker as any).weaponItemType === 'crossbow' ||
      (attacker as any).weaponItemType === 'xbow' ||
      attacker.isRanged === true ||
      (attacker as any).hasMeleeWeapon === false)
  ) {
    return {
      hit: false,
      avoidedReason: 'miss',
      immuneToElem: false,
      immuneToPhys: false,
      physDamage256: 0,
      elemDamage256: 0,
      totalDamage256: 0,
      totalDamage: 0,
      targetHpBefore256: hpBefore256,
      targetHpAfter256: hpBefore256,
      targetKilled: false,
    }
  }

  const attackKind = packet.attackKind ?? (packet.srcDam && packet.srcDam > 0 ? 'melee' : 'spell')

  const attackerStatesApplied: string[] = []
  let attackerColdDamage256 = 0
  let reflectedPhys256 = 0
  const spawnedMissiles: string[] = []
  const attackerOverlaysApplied: string[] = []
  const defenderOverlaysApplied: string[] = []
  const unitOverlays: ReactiveUnitOverlayEvent[] = []
  const defRawType = defender.unitType === 'monster' ? 1 : 0
  const atkRawType = attacker.unitType === 'player' ? 0 : 1
  const defNumericId = Number(String(defender.id).replace(/\D+/g, '') || 1) >>> 0
  const atkNumericId = Number(String(attacker.id).replace(/\D+/g, '') || 1) >>> 0

  // If melee attack, trigger 'attackedinmelee' proactively on attack initiation
  if (attackKind === 'melee') {
    const unarmedMax = Math.max(2, Math.trunc(attacker.statList.getAccruedStat('maxdamage')))
    const initialPhys =
      packet.flatPhysMax256 ?? ((attacker.weaponMaxPhys ?? attacker.weaponMinPhys ?? unarmedMax) * FIXED_ONE)
    const reactiveAttack = defender.stateBus.triggerReactiveEvents({
      event: 'attackedinmelee',
      incomingPhys256: initialPhys,
      attackerStateBus: attacker.stateBus,
      ...(defender.x !== undefined ? { defenderX: defender.x } : {}),
      ...(defender.y !== undefined ? { defenderY: defender.y } : {}),
      ...(attacker.x !== undefined ? { attackerX: attacker.x } : {}),
      ...(attacker.y !== undefined ? { attackerY: attacker.y } : {}),
      defenderRawUnitType: defRawType,
      defenderUnitId: defNumericId,
      attackerRawUnitType: atkRawType,
      attackerUnitId: atkNumericId,
    })
    if (reactiveAttack.attackerStatesApplied.length > 0) {
      attackerStatesApplied.push(...reactiveAttack.attackerStatesApplied)
    }
    if (reactiveAttack.attackerOverlaysApplied) {
      attackerOverlaysApplied.push(...reactiveAttack.attackerOverlaysApplied)
    }
    if (reactiveAttack.defenderOverlaysApplied) {
      defenderOverlaysApplied.push(...reactiveAttack.defenderOverlaysApplied)
    }
    if (reactiveAttack.unitOverlays) {
      unitOverlays.push(...reactiveAttack.unitOverlays)
    }
    if (reactiveAttack.attackerColdDamage256 > 0) {
      attackerColdDamage256 += reactiveAttack.attackerColdDamage256
      const attackerHp = attacker.statList.getHp256()
      attacker.statList.setHp256(Math.max(0, attackerHp - reactiveAttack.attackerColdDamage256))
    }
  }

  // Resolve Barbarian Weapon Mastery (#127..#129, #134..#136) & Assassin Claw Mastery (#252) for weapon attacks
  const BAR_MASTERY_STATES: Readonly<Record<number, string>> = {
    127: 'swordmastery',
    128: 'axemastery',
    129: 'macemastery',
    134: 'polearmmastery',
    135: 'throwingmastery',
    136: 'spearmastery',
    252: 'clawmastery',
  }
  const isClawWeaponType = (wt: string | undefined): boolean => {
    if (!wt) return false
    const k = wt.trim().toLowerCase()
    return k === 'h2h' || k === 'h2h2' || k === 'claw' || k === 'katar' || k === 'handtohand' || k === 'assassinclaw'
  }
  const isThrowAttack =
    packet.skillId === 2 ||
    packet.skillId === 4 ||
    packet.skillId === 140 ||
    Boolean(attacker.isThrowing && attackKind !== 'melee' && attackKind !== 'spell')
  const isMeleeWeaponAttack =
    !isThrowAttack &&
    attackKind === 'melee' &&
    packet.skillId !== 97 &&
    packet.skillId !== 1
  let barMasteryArBonusPct = 0
  let barMasteryEdBonusPct = 0
  let barMasteryCritPct: number | undefined
  const getLearnedMasterySlvl = (mId: number): number => {
    const passiveLvl = attacker.passiveSkills?.get(mId) ?? 0
    if (passiveLvl > 0) return passiveLvl
    const baseLvl = attacker.statList.getBaseSkillLevel(mId)
    if (baseLvl > 0) return attacker.statList.getEffectiveSkillLevel(mId)
    const stateName = BAR_MASTERY_STATES[mId]
    if (stateName && attacker.stateBus.hasState(stateName)) {
      return attacker.stateBus.getState(stateName)?.slvl ?? 0
    }
    return 0
  }
  if (isThrowAttack) {
    const slvl135 = getLearnedMasterySlvl(135)
    if (slvl135 > 0) {
      const wType =
        packet.skillId === 4
          ? (attacker.offHandWeaponItemType ?? attacker.offHandWeaponType ?? attacker.weaponItemType)
          : attacker.weaponItemType
      if (!wType || isWeaponMatchingMastery(wType, 135)) {
        const mStats = evaluateBarbarianMastery(135, slvl135) as WeaponMasteryStats
        barMasteryArBonusPct = mStats.attackRatingBonusPct
        barMasteryEdBonusPct = mStats.damageBonusPct
        barMasteryCritPct = mStats.criticalStrikeChancePct
      } else {
        barMasteryCritPct = 0
      }
    }
  } else if (isMeleeWeaponAttack) {
    const meleeMasteryIds = [127, 128, 129, 134, 136] as const
    const hasAnyMeleeMastery = meleeMasteryIds.some(id => getLearnedMasterySlvl(id) > 0)
    const slvl252 = getLearnedMasterySlvl(252)
    const wType =
      packet.skillId === 5
        ? (attacker.offHandWeaponItemType ?? attacker.offHandWeaponType ?? attacker.weaponItemType)
        : attacker.weaponItemType
    if (hasAnyMeleeMastery) {
      if (wType && wType.trim() !== '') {
        barMasteryCritPct = 0
        for (const mId of meleeMasteryIds) {
          const slvl = getLearnedMasterySlvl(mId)
          if (slvl > 0 && isWeaponMatchingMastery(wType, mId)) {
            const mStats = evaluateBarbarianMastery(mId, slvl) as WeaponMasteryStats
            barMasteryArBonusPct = mStats.attackRatingBonusPct
            barMasteryEdBonusPct = mStats.damageBonusPct
            barMasteryCritPct = mStats.criticalStrikeChancePct
            break
          }
        }
      } else {
        for (const mId of meleeMasteryIds) {
          const slvl = getLearnedMasterySlvl(mId)
          if (slvl > 0) {
            const mStats = evaluateBarbarianMastery(mId, slvl) as WeaponMasteryStats
            barMasteryArBonusPct = Math.max(barMasteryArBonusPct, mStats.attackRatingBonusPct)
            barMasteryEdBonusPct = Math.max(barMasteryEdBonusPct, mStats.damageBonusPct)
            barMasteryCritPct = Math.max(barMasteryCritPct ?? 0, mStats.criticalStrikeChancePct)
          }
        }
      }
    }
    if (slvl252 > 0) {
      const matchesClaw = !wType || wType.trim() === '' || isClawWeaponType(wType) || attacker.isDualClaw === true
      if (matchesClaw) {
        const cmAr = 30 + (slvl252 - 1) * 10
        const cmEd = 35 + (slvl252 - 1) * 4
        const cmCrit = Math.floor((25 * Math.floor((110 * slvl252) / (slvl252 + 6))) / 100)
        barMasteryArBonusPct = Math.max(barMasteryArBonusPct, cmAr)
        barMasteryEdBonusPct = Math.max(barMasteryEdBonusPct, cmEd)
        barMasteryCritPct = Math.max(barMasteryCritPct ?? 0, cmCrit)
      } else if (barMasteryCritPct === undefined) {
        barMasteryCritPct = 0
      }
    }
  }

  // 1. RollToHit check for weapon attacks (unless autoHit, e.g. Smite 97 / Guided Arrow 22 / Spells)
  // D2Game.dll 0x6FCFE011: draws an independent rng.rand(100) against clamped toHitChance [5..95].
  const isAutoHit = packet.autoHit ?? (packet.skillId === 97 || packet.skillId === 22 || attackKind === 'spell')
  if (!isAutoHit) {
    const effectiveToHitBonusPct = (packet.toHitBonusPct ?? 0) + barMasteryArBonusPct
    const toHitChance = computeToHitChance({
      attackerAr: attacker.statList.getAccruedStat('tohit'),
      defenderDef: defender.statList.getAccruedStat('armorclass'),
      attackerLvl: attacker.statList.getAccruedStat('level'),
      defenderLvl: defender.statList.getAccruedStat('level'),
      ...(effectiveToHitBonusPct !== 0 || packet.toHitBonusPct !== undefined
        ? { skillArBonusPct: effectiveToHitBonusPct }
        : {}),
    })
    const hitRoll = packet.roll100 ?? resolvedRng.rand(100)
    if (hitRoll >= toHitChance) {
      return {
        hit: false,
        avoidedReason: 'miss',
        immuneToElem: false,
        immuneToPhys: false,
        physDamage256: 0,
        elemDamage256: 0,
        totalDamage256: 0,
        totalDamage: 0,
        targetHpBefore256: hpBefore256,
        targetHpAfter256: hpBefore256,
        targetKilled: false,
        ...(attackerStatesApplied.length > 0 ? { attackerStatesApplied } : {}),
        ...(attackerColdDamage256 > 0 ? { attackerColdDamage256 } : {}),
      }
    }
  }

  // 2. Avoidance & Block (Smite `97` is unblockable by shield block; D2Game.dll 0x6FCFB790 / 0x6FCFB030).
  // Draws its own independent rng.rand(100) roll(s), never reusing hitRoll.
  const avoidCheck = evaluateAvoidanceAndBlock({
    defender,
    attackKind,
    rng: resolvedRng,
    unblockable: packet.unblockable ?? packet.skillId === 97,
    isPersistentGroundFire: Boolean((packet as unknown as Record<string, unknown>)['isPersistentGroundFire']),
    ...(packet.blockRoll100 !== undefined ? { roll100: packet.blockRoll100 } : {}),
  })
  if (avoidCheck.avoided) {
    return {
      hit: false,
      avoidedReason: avoidCheck.reason,
      immuneToElem: false,
      immuneToPhys: false,
      physDamage256: 0,
      elemDamage256: 0,
      totalDamage256: 0,
      totalDamage: 0,
      targetHpBefore256: hpBefore256,
      targetHpAfter256: hpBefore256,
      targetKilled: false,
      ...(attackerStatesApplied.length > 0 ? { attackerStatesApplied } : {}),
      ...(attackerColdDamage256 > 0 ? { attackerColdDamage256 } : {}),
    }
  }

  // 3. Weapon `srcdam` (128 = 100%) + Physical Damage calculation (D2Game.dll 0x6FCFC530 / 0x6FCFCD80)
  const hasFlatPhys = (packet.flatPhysMin256 !== undefined && packet.flatPhysMin256 > 0) || (packet.flatPhysMax256 !== undefined && packet.flatPhysMax256 > 0)
  const isSpellWithoutFlatPhys = attackKind === 'spell' && !hasFlatPhys
  const srcDam =
    isSpellWithoutFlatPhys
      ? 0
      : (packet.srcDam ??
        (packet.skillId === 12 || packet.skillId === 26
          ? 96
          : attackKind !== 'spell'
            ? 128
            : 0))
  let rawPhys256 = 0
  let baseWeapPhys256 = 0
  let isCritical = false
  if (!isSpellWithoutFlatPhys && (srcDam > 0 || hasFlatPhys)) {
    // 1.13c Unarmed / missing weapon base damage (`D2Game.dll` `0x6FCFC5A2..0x6FCFC5C8`):
    // Reads `D2Common_GetStatSigned(pAttacker, STAT_MINDAMAGE=21)` (if <= 0, 1) and
    // `D2Common_GetStatSigned(pAttacker, STAT_MAXDAMAGE=22)` (if <= 1, 2) when no weapon is equipped
    // and no explicit flat physical packet override is supplied. Never fabricates 25-45!
    const hasExplicitWeaponDmg =
      attacker.weaponMinPhys !== undefined || attacker.weaponMaxPhys !== undefined
    let weapMin = 0
    let weapMax = 0
    if (hasExplicitWeaponDmg) {
      weapMin = Math.max(0, attacker.weaponMinPhys ?? 0)
      weapMax = Math.max(weapMin, attacker.weaponMaxPhys ?? weapMin)
    } else if (!hasFlatPhys && srcDam > 0) {
      const statMin = Math.trunc(attacker.statList.getAccruedStat('mindamage'))
      const statMax = Math.trunc(attacker.statList.getAccruedStat('maxdamage'))
      weapMin = statMin <= 0 ? 1 : statMin
      weapMax = statMax <= 1 ? 2 : Math.max(weapMin, statMax)
    }
    const weapMin256 = weapMin * FIXED_ONE
    const weapMax256 = weapMax * FIXED_ONE
    const effectiveSrcDam = srcDam
    const scaledWeapMin256 = effectiveSrcDam > 0 ? Math.trunc((weapMin256 * effectiveSrcDam) / 128) : 0
    const scaledWeapMax256 = effectiveSrcDam > 0 ? Math.trunc((weapMax256 * effectiveSrcDam) / 128) : 0
    const flatMin256 = Math.max(0, Math.trunc(packet.flatPhysMin256 ?? 0))
    const flatMax256 = Math.max(flatMin256, Math.trunc(packet.flatPhysMax256 ?? flatMin256))
    const totalBaseMin256 = Math.max(0, scaledWeapMin256 + flatMin256)
    const totalBaseMax256 = Math.max(totalBaseMin256, scaledWeapMax256 + flatMax256)
    baseWeapPhys256 = rollDamageRange256(totalBaseMin256, totalBaseMax256, resolvedRng)
    const dmgPctBonus = attacker.statList.getModifierBonus('damagepercent')
    const weakenEntry = attacker.stateBus.getState('weaken')
    const decrepifyEntry = attacker.stateBus.getState('decrepify')
    const curseDmgMod =
      (weakenEntry && weakenEntry.stats['damagepercent'] === undefined ? -33 : 0) +
      (decrepifyEntry && decrepifyEntry.stats['damagepercent'] === undefined ? -50 : 0)
    let edPct =
      (packet.physDamagePct ?? 0) +
      barMasteryEdBonusPct +
      dmgPctBonus +
      curseDmgMod

    // Fanaticism: caster vs ally %ED distinction if not already accrued in statList
    if (attacker.stateBus.hasState('fanaticism') && dmgPctBonus === 0) {
      const fanatSlvl = attacker.stateBus.getState('fanaticism')?.slvl ?? 1
      const casterEd = 50 + (fanatSlvl - 1) * 17
      const isAlly = Boolean(
        packet.isAlly ||
        attacker.unitType === 'party' ||
        attacker.unitType === 'mercenary' ||
        attacker.unitType === 'party_mercenary' ||
        attacker.stateBus.getState('fanaticism')?.stats?.['is_ally'] === 1
      )
      const fanatEd = isAlly ? Math.trunc(casterEd / 2) : casterEd
      edPct += fanatEd
    }

    // Might: if not already accrued in statList
    if (attacker.stateBus.hasState('might') && dmgPctBonus === 0) {
      const mightSlvl = attacker.stateBus.getState('might')?.slvl ?? 1
      edPct += 40 + (mightSlvl - 1) * 10
    }

    // Concentration: if not already accrued in statList
    if (attacker.stateBus.hasState('concentration') && dmgPctBonus === 0) {
      const concSlvl = attacker.stateBus.getState('concentration')?.slvl ?? 1
      edPct += 60 + (concSlvl - 1) * 15
    }

    // Sanctuary: +150% + 30%/lvl %ED vs Undead
    if (attacker.stateBus.hasState('sanctuary') && defender.isUndead) {
      const sanctSlvl = attacker.stateBus.getState('sanctuary')?.slvl ?? 1
      const sanctEd = 150 + (sanctSlvl - 1) * 30
      edPct += sanctEd
    }

    rawPhys256 = Math.max(0, Math.trunc((baseWeapPhys256 * (100 + edPct)) / 100))

    // 1.13c SKILLS_CalculateKickDamage (0x6FC9AE10): Kick skills (#1, #255, #270, #275)
    // use Strength + Dexterity + Boot Min/Max damage (never weapon base damage or on-weapon ED)
    const isKickPacket =
      packet.skillId === 1 ||
      packet.skillId === 255 ||
      packet.skillId === 270 ||
      packet.skillId === 275
    if (isKickPacket) {
      if (hasFlatPhys && srcDam === 0) {
        // Pre-calculated by SKILLS_CalculateKickDamage in registry.ts
        rawPhys256 = baseWeapPhys256
      } else {
        const str = attacker.statList.getAccruedStat('strength') || 20
        const dex = attacker.statList.getAccruedStat('dexterity') || 20
        const bootMin = attacker.bootMinDam ?? attacker.kickMinDam ?? 0
        const bootMax = attacker.bootMaxDam ?? attacker.kickMaxDam ?? 0
        const skillED = packet.skillId === 255 || packet.skillId === 275 ? (packet.physDamagePct ?? 0) : 0
        const offWeaponED =
          dmgPctBonus +
          curseDmgMod
        const attrMin = Math.max(1, Math.floor(Math.max(0, dex + str - 20) / 4))
        const attrMax = Math.max(2, Math.floor(Math.max(0, dex + str - 20) / 3))
        const strBootBonus = Math.floor((str * 120) / 100)
        const kMin =
          Math.floor((attrMin * (100 + skillED)) / 100) +
          Math.floor((bootMin * (100 + strBootBonus + offWeaponED + skillED)) / 100)
        const kMax =
          Math.floor((attrMax * (100 + skillED)) / 100) +
          Math.floor((bootMax * (100 + strBootBonus + offWeaponED + skillED)) / 100)
        rawPhys256 = rollDamageRange256(kMin * FIXED_ONE, kMax * FIXED_ONE, resolvedRng)
      }
    }

    // 3b. 1.13c Weapon Mastery Crit (`0x6FCFD549`), Critical Strike (`0x6FCFD573`),
    //     and Deadly Strike (`0x6FCFD59D`) sequential evaluation (`D2Game.dll` `0x6FCFD51A..0x6FCFD5A6`).
    //     Triggered BEFORE physical-to-elemental conversion; mutually exclusive (never 4x/8x).
    //     Each stage draws its own independent `rng.rand(100)` roll only if the previous stage did not proc!
    //     NOTE: Smite (`skillId === 97`, `SKILLS_SrvDo150_Smite` @ `0x6FCB9000`) and Kick skills
    //     (`#1, #255, #270, #275`, `SKILLS_CalculateKickDamage` @ `0x6FC9AE10`) do NOT call
    //     `SUNITDMG_FillDamageValues` and strictly CANNOT Critical Strike or Deadly Strike!
    if (packet.skillId !== 97 && !isKickPacket) {
      const csChance = Math.min(100, Math.max(0, attacker.statList.getAccruedStat('passive_critical_strike')))
      const masteryCritStat =
        attackKind === 'missile'
          ? attacker.statList.getAccruedStat('passive_mastery_throw_crit') ||
            attacker.statList.getAccruedStat('passive_mastery_melee_crit')
          : attacker.statList.getAccruedStat('passive_mastery_melee_crit')
      const rawMasteryCrit =
        barMasteryCritPct !== undefined
          ? Math.max(barMasteryCritPct, attacker.weaponItemType ? 0 : masteryCritStat)
          : masteryCritStat
      const masteryCritChance = Math.min(100, Math.max(0, rawMasteryCrit))
      const dsChance = Math.min(100, Math.max(0, attacker.statList.getAccruedStat('item_deadlystrike')))
      if (masteryCritChance > 0) {
        const masteryRoll = packet.masteryCritRoll100 ?? packet.critRoll100 ?? resolvedRng.rand(100)
        if (masteryRoll < masteryCritChance) {
          isCritical = true
        }
      }
      if (!isCritical && csChance > 0) {
        const csRoll = packet.csRoll100 ?? packet.critRoll100 ?? resolvedRng.rand(100)
        if (csRoll < csChance) {
          isCritical = true
        }
      }
      if (!isCritical && dsChance > 0) {
        const dsRoll = packet.dsRoll100 ?? packet.critRoll100 ?? resolvedRng.rand(100)
        if (dsRoll < dsChance) {
          isCritical = true
        }
      }
      if (isCritical) {
        rawPhys256 *= 2
      }
    }
  }

  // 4. Physical-to-Elemental/Magic Conversion (e.g. Berserk 100% Magic, Magic Arrow, Fire Arrow, Cold Arrow)
  const elemMin256 = Math.max(0, Math.trunc(packet.elemMin256 ?? 0))
  const elemMax256 = Math.max(elemMin256, Math.trunc(packet.elemMax256 ?? elemMin256))
  let rawElem256 = rollDamageRange256(elemMin256, elemMax256, resolvedRng)
  const effectiveSlvl = Math.max(
    1,
    packet.slvl ?? (packet.skillId !== undefined ? attacker.statList.getEffectiveSkillLevel(packet.skillId) : 1) ?? 1,
  )
  const defaultConvPct =
    packet.skillId === 152
      ? 100
      : packet.skillId === 7 || packet.skillId === 11
        ? Math.min(100, 3 + 2 * (effectiveSlvl - 1))
        : packet.skillId === 6
          ? Math.min(100, effectiveSlvl)
          : 0
  const convPct = Math.max(0, Math.min(100, packet.physToElemPct ?? defaultConvPct))
  if (convPct > 0 && rawPhys256 > 0) {
    const converted256 = Math.trunc((rawPhys256 * convPct) / 100)
    rawPhys256 -= converted256
    rawElem256 += converted256
  }

  // 5. Elemental Mastery & 1.13c Blessed Hammer / Venom / Static Field / Enchant rules
  let elemType = (
    packet.elemType && packet.elemType !== 'none'
      ? packet.elemType
      : packet.skillId === 6 || packet.skillId === 152 || packet.skillId === 112
        ? 'mag'
        : packet.skillId === 11 || packet.skillId === 21 || packet.skillId === 31
          ? 'cold'
          : 'fire'
  ).toLowerCase()

  // Added elemental damage from Paladin offensive auras (Holy Fire, Holy Freeze, Holy Shock) on physical attacks
  if (attackKind !== 'spell' && packet.skillId !== 97) {
    if (attacker.stateBus.hasState('holyfire')) {
      const hfSlvl = attacker.stateBus.getState('holyfire')?.slvl ?? 1
      const rfBlvl = attacker.statList.getBaseSkillLevel(100)
      const salvBlvl = attacker.statList.getBaseSkillLevel(125)
      const hfStats = calculateHolyFireStats(hfSlvl, { resistFire: rfBlvl, salvation: salvBlvl })
      rawElem256 += rollDamageRange256(
        hfStats.weaponFireMin * FIXED_ONE,
        hfStats.weaponFireMax * FIXED_ONE,
        resolvedRng,
      )
      if (!packet.elemType) {
        elemType = 'fire'
      }
    }
    if (attacker.stateBus.hasState('holyfreeze') || attacker.stateBus.hasState('holywind')) {
      const freezeState = attacker.stateBus.getState('holyfreeze') ?? attacker.stateBus.getState('holywind')
      const freezeSlvl = freezeState?.slvl ?? 1
      const rcBlvl = attacker.statList.getBaseSkillLevel(105)
      const salvBlvl = attacker.statList.getBaseSkillLevel(125)
      const freezeStats = calculateHolyFreezeStats(freezeSlvl, { resistCold: rcBlvl, salvation: salvBlvl })
      rawElem256 += rollDamageRange256(
        freezeStats.weaponColdMin * FIXED_ONE,
        freezeStats.weaponColdMax * FIXED_ONE,
        resolvedRng,
      )
      if (!packet.elemType) {
        elemType = 'cold'
      }
    }
    if (attacker.stateBus.hasState('holyshock')) {
      const shockSlvl = attacker.stateBus.getState('holyshock')?.slvl ?? 1
      const rlBlvl = attacker.statList.getBaseSkillLevel(110)
      const salvBlvl = attacker.statList.getBaseSkillLevel(125)
      const shockStats = calculateHolyShockStats(shockSlvl, { resistLightning: rlBlvl, salvation: salvBlvl })
      rawElem256 += rollDamageRange256(
        shockStats.weaponLightningMin * FIXED_ONE,
        shockStats.weaponLightningMax * FIXED_ONE,
        resolvedRng,
      )
      if (!packet.elemType) {
        elemType = 'ltng'
      }
    }
  }

  const isEnchantFire = Boolean(packet.isEnchant || packet.skillId === 52 || attacker.stateBus.hasState('enchant'))
  if (isEnchantFire && attackKind === 'missile' && elemType === 'fire') {
    // 1.13c Param3 = 33: Ranged attacks (bow/crossbow/throwing) receive only 33% of Enchant fire damage bonus
    rawElem256 = Math.trunc((rawElem256 * 33) / 100)
  }

  if (rawElem256 > 0) {
    let masteryPct = 0
    // Ranged Enchant attacks do NOT get the second Fire Mastery multiplier
    const skipFireMasterySecondMultiplier = isEnchantFire && attackKind === 'missile'
    if (elemType === 'fire' && !skipFireMasterySecondMultiplier) {
      masteryPct = attacker.statList.getAccruedStat('passive_fire_mastery')
    } else if (elemType === 'ltng') {
      masteryPct = attacker.statList.getAccruedStat('passive_ltng_mastery')
    } else if (elemType === 'cold') {
      masteryPct = attacker.statList.getAccruedStat('passive_cold_mastery')
    } else if (elemType === 'pois') {
      masteryPct = attacker.statList.getAccruedStat('passive_pois_mastery')
    }
    if (masteryPct > 0) {
      rawElem256 = Math.trunc((rawElem256 * (100 + masteryPct)) / 100)
    }
  }

  // Blessed Hammer (`skillId = 112`):
  // - Concentration aura adds `50%` (`Param1 = 4 -> 4/8`) of its `%ED` to Blessed Hammer.
  // - `+50%` damage bonus vs Undead (`dParam1 = 50`).
  // - CRITICAL 1.13c RULE (`patch.txt` line 112): Blessed Hammer does NOT ignore Magic Resistance
  //   of Undead or Demons! Magic Resistance (`magicresist`) applies normally to all targets.
  if (packet.skillId === 112) {
    if (!packet.concentrationAlreadyApplied) {
      const concState = attacker.stateBus.getState('concentration')
      const concPct =
        packet.concentrationBonusPct ??
        (attacker.statList.getModifierBonus('concentration_damage_pct') ||
          (concState ? (concState.stats['damagepercent'] ?? (60 + (concState.slvl - 1) * 15)) : 0))
      if (concPct > 0) {
        rawElem256 = Math.trunc((rawElem256 * (100 + Math.trunc(concPct / 2))) / 100)
      }
    }
    if (defender.isUndead) {
      rawElem256 = Math.trunc((rawElem256 * 150) / 100)
    }
  }

  // Venom (`skillId = 278` or `STATE_VENOM` / `venomclaws` / State 31 active on weapon attack)
  if (
    attackKind !== 'spell' &&
    (packet.skillId === 278 ||
      attacker.stateBus.hasState('venom') ||
      attacker.stateBus.hasState('venomclaws') ||
      attacker.stateBus.hasState(31))
  ) {
    const vState =
      attacker.stateBus.getState('venom') ??
      attacker.stateBus.getState('venomclaws') ??
      attacker.stateBus.getState(31)
    const fallbackBitrate256 = vState
      ? computeVenomPoisonDamage(vState.slvl).minBitrate
      : 35 * FIXED_ONE
    const itemPoisMin = attacker.statList.getAccruedStat('poisonmindam')
    const itemPoisLen = attacker.statList.getAccruedStat('poisonlength')
    const otherSources =
      (attacker.weaponPoisonBitrate256 ?? 0) > 0
        ? [{ bitrate256: attacker.weaponPoisonBitrate256!, frames: attacker.weaponPoisonFrames ?? 100 }]
        : itemPoisMin > 0 && itemPoisLen > 0
          ? [{ bitrate256: itemPoisMin, frames: itemPoisLen }]
          : []
    const venomRes = resolveVenomPoisonApplication({
      venomActive: true,
      venomBitrate256:
        attacker.statList.getModifierBonus('venom_bitrate_256') ||
        attacker.statList.getModifierBonus('skill_pois_min') ||
        fallbackBitrate256,
      otherPoisonSources: otherSources,
    })
    rawElem256 += venomRes.totalDamage256
    if (venomRes.totalDamage256 > 0) {
      defender.stateBus.applyState({
        stateNameOrId: 'poison',
        sourceUnitId: attacker.id,
        sourceSkillId: 278,
        slvl: vState?.slvl ?? 1,
        durationFrames: venomRes.durationFrames,
      })
    }
  }

  // 6. Resistances & 1/5 Immunity Breaking
  const ampPierceBonus = defender.statList.getModifierBonus('amplify_phys_pierce')
  const curseAmpPierce =
    ampPierceBonus > 0
      ? ampPierceBonus
      : defender.stateBus.hasState('amplifydamage')
        ? 100
        : defender.stateBus.hasState('decrepify')
          ? 50
          : 0

  let physResRec = computeEffectiveResistance({
    baseRes: defender.statList.getAccruedStat('damageresist'),
    convictionPierce: curseAmpPierce,
    ...defenderResistParams113c(defender, 'phys'),
  })

  // Sanctuary (1.13c SUnitDmg.cpp:1002): Paladin physical attacks ignore positive Undead physical resistance
  // (clamping damageresist > 0 to 0% and piercing immunity, while preserving negative resistance from curses!)
  if (attacker.stateBus.hasState('sanctuary') && defender.isUndead && attackKind !== 'spell') {
    if (physResRec.effectiveRes > 0 || physResRec.isImmune) {
      physResRec = {
        baseRes: physResRec.baseRes,
        convictionAndLRApplied: physResRec.convictionAndLRApplied,
        resAfterConvictionLR: 0,
        isImmune: false,
        effectiveRes: 0,
      }
    }
  }

  const resStatKey =
    elemType === 'fire'
      ? 'fireresist'
      : elemType === 'ltng'
        ? 'lightresist'
        : elemType === 'cold'
          ? 'coldresist'
          : elemType === 'pois'
            ? 'poisonresist'
            : 'magicresist'

  const isElemPiercableByConviction = elemType === 'fire' || elemType === 'ltng' || elemType === 'cold'
  const isElemPiercableByLR = elemType === 'fire' || elemType === 'ltng' || elemType === 'cold' || elemType === 'pois'

  const lrPierceBonus = defender.statList.getModifierBonus('lowerresist_pierce')
  const curseLrPierce =
    lrPierceBonus > 0
      ? lrPierceBonus
      : defender.stateBus.hasState('lowerresist')
        ? calculateLowerResistReduction(defender.stateBus.getState('lowerresist')?.slvl ?? 1)
        : 0

  const convictionBonus = defender.statList.getModifierBonus('conviction_pierce')
  const auraConvictionPierce =
    convictionBonus > 0
      ? convictionBonus
      : defender.stateBus.hasState('conviction')
        ? Math.min(150, 25 + 5 * Math.max(1, defender.stateBus.getState('conviction')?.slvl ?? 1))
        : 0
  const convictionPierce = isElemPiercableByConviction
    ? (packet.convictionPierce ?? auraConvictionPierce)
    : 0
  const lowerResistPierce = isElemPiercableByLR
    ? (packet.lowerResistPierce ?? curseLrPierce)
    : 0
  const passivePierce =
    packet.passiveEnemyPierce ??
    (elemType === 'cold'
      ? attacker.statList.getAccruedStat('passive_cold_pierce')
      : elemType === 'fire'
        ? attacker.statList.getAccruedStat('passive_fire_pierce')
        : elemType === 'ltng'
          ? attacker.statList.getAccruedStat('passive_ltng_pierce')
          : elemType === 'pois'
            ? attacker.statList.getAccruedStat('passive_pois_pierce')
            : 0)

  const elemChannel: ResistChannel113c =
    elemType === 'fire' || elemType === 'ltng' || elemType === 'cold' || elemType === 'pois' ? elemType : 'mag'

  let elemResRec = computeEffectiveResistance({
    baseRes: defender.statList.getAccruedStat(resStatKey),
    convictionPierce,
    lowerResistPierce,
    passiveEnemyPierce: passivePierce,
    // Magic resistance cannot be broken by Conviction/Lower Resist
    canBreakImmunity: isElemPiercableByLR,
    ...defenderResistParams113c(defender, elemChannel),
  })

  // 1.13c Holy Bolt (#101, Holy=1) & FoH Holy Bolt (#234, Holy=3):
  // Sets `DAMAGEHITFLAG_BYPASSUNDEAD` (0x200) in `SUnitDmg.cpp:0x6FCBFB40`, clamping positive
  // Undead `magicresist` (including >= 100% Magic Immunity) to 0%!
  // (Blessed Hammer #112 has Holy=0 and does NOT set this flag.)
  if (
    (packet.skillId === 101 || packet.bypassUndeadMagicRes === true) &&
    defender.isUndead &&
    elemType === 'mag' &&
    (elemResRec.effectiveRes > 0 || elemResRec.isImmune)
  ) {
    elemResRec = {
      baseRes: elemResRec.baseRes,
      convictionAndLRApplied: elemResRec.convictionAndLRApplied,
      resAfterConvictionLR: 0,
      isImmune: false,
      effectiveRes: 0,
    }
  }



  // 6. Reactive `auraeventfunc` shields (`Energy Shield`, `Bone Armor`, `Cyclone Armor`) absorb BEFORE resistances in 1.13c
  const reactive = defender.stateBus.triggerReactiveEvents({
    event: 'absorbdamage',
    incomingPhys256: rawPhys256,
    incomingElem256: rawElem256,
    attackerStateBus: attacker.stateBus,
    elemType,
    isPoison: elemType === 'pois' || Boolean(packet.isPoison),
    isOpenWounds: Boolean(packet.isOpenWounds),
    ...(defender.x !== undefined ? { defenderX: defender.x } : {}),
    ...(defender.y !== undefined ? { defenderY: defender.y } : {}),
    ...(attacker.x !== undefined ? { attackerX: attacker.x } : {}),
    ...(attacker.y !== undefined ? { attackerY: attacker.y } : {}),
    defenderRawUnitType: defRawType,
    defenderUnitId: defNumericId,
    attackerRawUnitType: atkRawType,
    attackerUnitId: atkNumericId,
  })
  if (reactive.attackerOverlaysApplied) {
    attackerOverlaysApplied.push(...reactive.attackerOverlaysApplied)
  }
  if (reactive.defenderOverlaysApplied) {
    defenderOverlaysApplied.push(...reactive.defenderOverlaysApplied)
  }
  if (reactive.unitOverlays) {
    unitOverlays.push(...reactive.unitOverlays)
  }
  const flatPhysDr256 = Math.max(0, defender.statList.getAccruedStat('normal_damage_reduction')) * FIXED_ONE
  const flatMagicDr256 =
    elemType === 'pois'
      ? 0
      : Math.max(0, defender.statList.getAccruedStat('magic_damage_reduction')) * FIXED_ONE
  const remRawPhys256 = Math.max(0, rawPhys256 - reactive.absorbedPhys256 - flatPhysDr256)
  const remRawElem256 = Math.max(0, rawElem256 - reactive.absorbedElem256 - flatMagicDr256)

  // 1.13c Fire Golem Fire Absorption (`aurastat1 = fireresist = 100 - dm12`, `aurastat2 = item_absorbfire_percent = dm12`):
  // Fire Golem takes 0 net fire damage and heals by `dm12%` of incoming fire damage.
  const fireGolemAbsorbPct = elemType === 'fire' ? defender.statList.getAccruedStat('fire_golem_absorb') : 0
  const isFireGolemAbsorb = fireGolemAbsorbPct > 0
  if (isFireGolemAbsorb && remRawElem256 > 0) {
    const heal256 = Math.trunc((remRawElem256 * fireGolemAbsorbPct) / 100)
    const curHp = defender.statList.getHp256()
    const maxHp = defender.statList.getMaxHp256()
    defender.statList.setHp256(Math.min(maxHp, curHp + heal256))
  }

  // 7. Resistances & 1/5 Immunity Breaking applied to unabsorbed damage
  let finalPhys256 = physResRec.isImmune
    ? 0
    : Math.max(0, Math.trunc((remRawPhys256 * (100 - physResRec.effectiveRes)) / 100))

  let finalElem256 = isFireGolemAbsorb || elemResRec.isImmune
    ? 0
    : Math.max(0, Math.trunc((remRawElem256 * (100 - elemResRec.effectiveRes)) / 100))

  // Life Tap & Leech (1.13c: outer Multiple Shot arrows have procs & leech suppressed when canTriggerProcs === false)
  let attackerHealed256 = 0
  let attackerManaLeeched256 = 0
  const canTriggerProcs = packet.canTriggerProcs !== false
  const hasLifeTap = defender.stateBus.hasState('lifetap') || defender.statList.getModifierBonus('lifetap_leech_pct') > 0
  if (hasLifeTap && finalPhys256 > 0 && canTriggerProcs) {
    attackerHealed256 = Math.trunc(finalPhys256 * 50 / 100)
    const curHp = attacker.statList.getHp256()
    attacker.statList.setHp256(curHp + attackerHealed256)
  }

  // 1.13c Life / Mana steal (`D2Game.dll` 0x6FCFBA40) from ItemStatCost `lifedrainmindam` (60) /
  // `manadrainmindam` (62) — the stats the damage filler at 0x6FCFD6FB copies into the damage
  // record (+0x38 / +0x3C). Suppressed when canTriggerProcs === false or for Smite (97).
  const canLeechGear = canTriggerProcs && packet.skillId !== 97 && !packet.suppressGearLeech
  const stealClass = stealAttackerClass113c(attacker)
  if (canLeechGear && finalPhys256 > 0 && stealClass !== undefined) {
    const steal = computeLifeManaSteal113c({
      phys256: finalPhys256,
      lifeStealPct: attacker.statList.getAccruedStat('lifedrainmindam'),
      manaStealPct: attacker.statList.getAccruedStat('manadrainmindam'),
      attackerIsPlayer: stealClass === 'player',
      lifeStealDivisor: attacker.lifeStealDivisor ?? 1,
      manaStealDivisor: attacker.manaStealDivisor ?? 1,
      defenderIsMonster: isMonsterClassUnit113c(defender),
      defenderDrain: defender.drain,
    })
    // Mana first (0x6FCFAE70: `min(mana + v, maxmana)`), then life (0x6FCFB570: skipped for a dead
    // attacker or one in `death_delay` (state 92), `min(hp + v, maxhp)`).
    if (steal.mana256 > 0) {
      const curMana = attacker.statList.getMana256()
      attacker.statList.setMana256(curMana + steal.mana256)
      attackerManaLeeched256 = attacker.statList.getMana256() - curMana
    }
    if (steal.life256 > 0 && attacker.statList.getHp256() > 0 && !attacker.stateBus.hasState('death_delay')) {
      const curHp = attacker.statList.getHp256()
      attacker.statList.setHp256(curHp + steal.life256)
      attackerHealed256 += attacker.statList.getHp256() - curHp
    }
  }

  // Static Field (`skillId = 42`): reduces target HP by 25% mitigated by Lightning Resistance
  if (packet.skillId === 42 && !elemResRec.isImmune) {
    const rawStatic256 = Math.trunc((hpBefore256 * 25) / 100)
    finalElem256 = Math.max(0, Math.trunc((rawStatic256 * (100 - elemResRec.effectiveRes)) / 100))
  }

  // 8. Elemental Absorb (% and flat)
  if (finalElem256 > 0 && !isFireGolemAbsorb) {
    const absorbPct = Math.min(40, Math.max(0, defender.statList.getAccruedStat(`absorb_${elemType}_percent`)))
    const absorbFlat256 = Math.max(0, defender.statList.getAccruedStat(`absorb_${elemType}`)) * FIXED_ONE
    if (absorbPct > 0 || absorbFlat256 > 0) {
      const pctAbsorbed = Math.trunc((finalElem256 * absorbPct) / 100)
      const totalAbsorb = Math.min(finalElem256, pctAbsorbed + absorbFlat256)
      // Absorb heals before damage is applied, effectively subtracting 2x absorb from net damage
      finalElem256 = Math.max(0, finalElem256 - totalAbsorb * 2)
    }
  }

  // Vengeance (111) multi-elemental packet evaluation (Fire, Cold, Lightning)
  // 1.13c Ground Truth (`SKILLS_SrvSt35_Vengeance` @ `0x6FCB8BA0`):
  // - Elemental percentages scale off BASE weapon damage + flat +min/+max (`baseWeapPhys256`),
  //   NOT multiplied by off-weapon %ED (Might/Fanaticism/Strength) or Deadly Strike!
  // - Multiplied by `passive_fire_mastery` (#329), `passive_cold_mastery` (#331), `passive_ltng_mastery` (#330).
  // - Inflicts `chill` (`STATE_COLD` #28) for `chillDurationFrames` (`30 + 15*(slvl-1)` frames), NOT solid `freeze`.
  if (packet.multiElemPacket && (baseWeapPhys256 > 0 || rawPhys256 > 0)) {
    if (!packet.elemMin256 && !packet.elemMax256) {
      finalElem256 = 0
    }
    const mep = packet.multiElemPacket
    const baseWpPhys256 = baseWeapPhys256 > 0 ? baseWeapPhys256 : rawPhys256

    if (mep.firePct && mep.firePct > 0) {
      let rawFire256 = Math.trunc((baseWpPhys256 * mep.firePct) / 100)
      const fireMasteryPct = attacker.statList.getAccruedStat('passive_fire_mastery')
      if (fireMasteryPct > 0) {
        rawFire256 = Math.trunc((rawFire256 * (100 + fireMasteryPct)) / 100)
      }
      const fireRes = computeEffectiveResistance({
        baseRes: defender.statList.getAccruedStat('fireresist'),
        convictionPierce,
        lowerResistPierce,
        passiveEnemyPierce: packet.passiveEnemyPierce ?? attacker.statList.getAccruedStat('passive_fire_pierce'),
        ...defenderResistParams113c(defender, 'fire'),
      })
      if (!fireRes.isImmune) {
        finalElem256 += Math.max(0, Math.trunc((rawFire256 * (100 - fireRes.effectiveRes)) / 100))
      }
    }

    if (mep.coldPct && mep.coldPct > 0) {
      let rawCold256 = Math.trunc((baseWpPhys256 * mep.coldPct) / 100)
      const coldMasteryPct = attacker.statList.getAccruedStat('passive_cold_mastery')
      if (coldMasteryPct > 0) {
        rawCold256 = Math.trunc((rawCold256 * (100 + coldMasteryPct)) / 100)
      }
      const coldRes = computeEffectiveResistance({
        baseRes: defender.statList.getAccruedStat('coldresist'),
        convictionPierce,
        lowerResistPierce,
        passiveEnemyPierce: packet.passiveEnemyPierce ?? attacker.statList.getAccruedStat('passive_cold_pierce'),
        ...defenderResistParams113c(defender, 'cold'),
      })
      if (!coldRes.isImmune) {
        finalElem256 += Math.max(0, Math.trunc((rawCold256 * (100 - coldRes.effectiveRes)) / 100))
        if (!defender.statList.getAccruedStat('item_cannotbefrozen')) {
          const chillFrames = mep.chillDurationFrames ?? 30
          defender.stateBus.applyState({
            stateNameOrId: 'chill',
            sourceSkillId: packet.skillId,
            slvl: 1,
            durationFrames: chillFrames,
          })
        }
      }
    }

    if (mep.ltngPct && mep.ltngPct > 0) {
      let rawLtng256 = Math.trunc((baseWpPhys256 * mep.ltngPct) / 100)
      const ltngMasteryPct = attacker.statList.getAccruedStat('passive_ltng_mastery')
      if (ltngMasteryPct > 0) {
        rawLtng256 = Math.trunc((rawLtng256 * (100 + ltngMasteryPct)) / 100)
      }
      const ltngRes = computeEffectiveResistance({
        baseRes: defender.statList.getAccruedStat('lightresist'),
        convictionPierce,
        lowerResistPierce,
        passiveEnemyPierce: packet.passiveEnemyPierce ?? attacker.statList.getAccruedStat('passive_ltng_pierce'),
        ...defenderResistParams113c(defender, 'ltng'),
      })
      if (!ltngRes.isImmune) {
        finalElem256 += Math.max(0, Math.trunc((rawLtng256 * (100 - ltngRes.effectiveRes)) / 100))
      }
    }

  }

  // Smite (97) / generic stun application
  if (packet.stunDurationFrames && packet.stunDurationFrames > 0) {
    defender.stateBus.applyState({
      stateNameOrId: 'stun',
      sourceSkillId: packet.skillId,
      slvl: 1,
      durationFrames: packet.stunDurationFrames,
    })
  }

  // Knockback application (suppressed when canTriggerProcs === false in 1.13c)
  if (packet.knockback && canTriggerProcs) {
    defender.stateBus.applyState({
      stateNameOrId: 'knockback',
      sourceSkillId: packet.skillId,
      slvl: 1,
      durationFrames: 10,
    })
  }

  // Self-damage calculation (`SKILLS_SrvDo064_Sacrifice` @ `0x6FCB9290`):
  // - Base recoil is `min(rawPhys256, targetCurrentHpBefore256)` * `selfDamagePct` / 100.
  // - Routed through attacker's own `damageresist` (physical damage reduction %, capped at 50%).
  // - CAN kill the Paladin (`HP` can drop to `0`).
  let selfDamageTaken256 = 0
  if (packet.selfDamagePct && packet.selfDamagePct > 0 && rawPhys256 > 0 && !physResRec.isImmune) {
    const recoilBase256 = hpBefore256 > 0 ? Math.min(rawPhys256, hpBefore256) : rawPhys256
    const rawSelfDmg256 = Math.trunc((recoilBase256 * packet.selfDamagePct) / 100)
    const attackerPhysRes = Math.min(50, Math.max(-100, attacker.statList.getAccruedStat('damageresist')))
    selfDamageTaken256 = Math.max(0, Math.trunc((rawSelfDmg256 * (100 - attackerPhysRes)) / 100))
    const curAttackerHp256 = attacker.statList.getHp256()
    const newAttackerHp256 = Math.max(0, curAttackerHp256 - selfDamageTaken256)
    attacker.statList.setHp256(newAttackerHp256)
  }

  const totalDamage256 = finalPhys256 + finalElem256
  const currentDefenderHp256 = defender.statList.getHp256()
  const hpAfter256 = Math.max(0, currentDefenderHp256 - totalDamage256)
  defender.statList.setHp256(hpAfter256)

  // 1.13c Blood Golem EventFunc26_DamageLink (0x6FD13D90):
  // Shares Param6 = 25% of damage taken with the Necromancer owner, clamped so owner HP never drops below 1 HP.
  const bloodGolemSharePct = defender.statList.getAccruedStat('blood_golem_damage_share')
  if (bloodGolemSharePct > 0 && totalDamage256 > 0 && defender.ownerRef) {
    const sharedDmg256 = Math.trunc((totalDamage256 * bloodGolemSharePct) / 100)
    if (sharedDmg256 > 0) {
      const ownerHp256 = defender.ownerRef.statList.getHp256()
      defender.ownerRef.statList.setHp256(Math.max(FIXED_ONE, ownerHp256 - sharedDmg256))
    }
  }

  // 9. Reactive events post-damage (damagedinmelee for melee, hitbymissile for missile)
  if (attackKind === 'melee') {
    // 1.13c Clay Golem EventFunc27_SlowTarget (0x6FD13E10): attacker in melee is slowed for 750 frames (30s)!
    const claySlowPct = defender.statList.getAccruedStat('clay_golem_slow')
    if (claySlowPct > 0) {
      attacker.stateBus.applyState({
        stateNameOrId: 'slowed',
        slvl: 1,
        durationFrames: 750,
        stats: { item_slow: claySlowPct },
      })
      attackerStatesApplied.push('slowed')
    }

    const isPvP = Boolean(
      (defender.unitType === 'player' || defender.ownerUnitId !== undefined) &&
      (attacker.unitType === 'player' || attacker.ownerUnitId !== undefined)
    )

    // Iron Golem / stat-based Thorns reflection (ItemStatCost thorns_percent 131, if not already handled by stateBus thorns/barbs/ironmaiden)
    const thornsReturnPct =
      !defender.stateBus.hasState('thorns') &&
      !defender.stateBus.hasState('barbs') &&
      !defender.stateBus.hasState('ironmaiden')
        ? defender.statList.getAccruedStat('thorns_percent')
        : 0
    if (thornsReturnPct > 0 && finalPhys256 > 0) {
      let rawThorns256 = Math.trunc((finalPhys256 * thornsReturnPct) / 100)
      if (isPvP) {
        rawThorns256 = Math.trunc(rawThorns256 / 4)
      }
      const attackerPhysRes = computeEffectiveResistance({
        baseRes: attacker.statList.getAccruedStat('damageresist'),
        ...defenderResistParams113c(attacker, 'phys'),
      })
      const reflected256 = attackerPhysRes.isImmune
        ? 0
        : Math.max(0, Math.trunc((rawThorns256 * (100 - attackerPhysRes.effectiveRes)) / 100))
      if (reflected256 > 0) {
        reflectedPhys256 += reflected256
        const curHp = attacker.statList.getHp256()
        attacker.statList.setHp256(Math.max(0, curHp - reflected256))
      }
    }

    const reactiveDamage = defender.stateBus.triggerReactiveEvents({
      event: 'damagedinmelee',
      incomingPhys256: finalPhys256,
      incomingElem256: finalElem256,
      elemType,
      attackerStateBus: attacker.stateBus,
      attackerStatList: attacker.statList,
      isPvP,
      ...(defender.x !== undefined ? { defenderX: defender.x } : {}),
      ...(defender.y !== undefined ? { defenderY: defender.y } : {}),
      ...(attacker.x !== undefined ? { attackerX: attacker.x } : {}),
      ...(attacker.y !== undefined ? { attackerY: attacker.y } : {}),
      defenderRawUnitType: defRawType,
      defenderUnitId: defNumericId,
      attackerRawUnitType: atkRawType,
      attackerUnitId: atkNumericId,
    })
    if (reactiveDamage.attackerStatesApplied.length > 0) {
      attackerStatesApplied.push(...reactiveDamage.attackerStatesApplied)
    }
    if (reactiveDamage.attackerOverlaysApplied) {
      attackerOverlaysApplied.push(...reactiveDamage.attackerOverlaysApplied)
    }
    if (reactiveDamage.defenderOverlaysApplied) {
      defenderOverlaysApplied.push(...reactiveDamage.defenderOverlaysApplied)
    }
    if (reactiveDamage.unitOverlays) {
      unitOverlays.push(...reactiveDamage.unitOverlays)
    }
    if (reactiveDamage.attackerColdDamage256 > 0) {
      attackerColdDamage256 += reactiveDamage.attackerColdDamage256
      const curHp = attacker.statList.getHp256()
      attacker.statList.setHp256(Math.max(0, curHp - reactiveDamage.attackerColdDamage256))
    }
    if (reactiveDamage.reflectedPhys256 > 0) {
      reflectedPhys256 += reactiveDamage.reflectedPhys256
      const curHp = attacker.statList.getHp256()
      attacker.statList.setHp256(Math.max(0, curHp - reactiveDamage.reflectedPhys256))
    }

    // Iron Maiden: reflect physical melee damage back to cursed attacker
    // 1.13c SKILLS_AuraEventFunc04_IronMaiden (0x6FD13E90):
    // calc1 = ln56 = 200 + 25*(slvl-1)% vs monsters; calc2 = calc3 = floor(ln56 / 4) when attacker is Player or Hireling
    const hasIronMaiden = attacker.stateBus.hasState('ironmaiden') || attacker.statList.getModifierBonus('ironmaiden_return_pct') > 0
    if (hasIronMaiden && finalPhys256 > 0) {
      const imSlvl = attacker.stateBus.getState('ironmaiden')?.slvl ?? 1
      const isPlayerOrHireling =
        attacker.unitType === 'player' ||
        attacker.unitType === 'mercenary' ||
        attacker.unitType === 'party_mercenary'
      const rawReturnPct =
        attacker.statList.getModifierBonus('ironmaiden_return_pct') ||
        calculateIronMaidenReturnPct(imSlvl, false)
      const returnPct = isPlayerOrHireling ? Math.floor(rawReturnPct / 4) : rawReturnPct
      const rawReflected256 = Math.trunc((finalPhys256 * returnPct) / 100)
      const attackerPhysRes = computeEffectiveResistance({
        baseRes: attacker.statList.getAccruedStat('damageresist'),
        ...defenderResistParams113c(attacker, 'phys'),
      })
      const imReflected256 = attackerPhysRes.isImmune
        ? 0
        : Math.max(0, Math.trunc((rawReflected256 * (100 - attackerPhysRes.effectiveRes)) / 100))
      if (imReflected256 > 0) {
        reflectedPhys256 += imReflected256
        const curHp = attacker.statList.getHp256()
        attacker.statList.setHp256(Math.max(0, curHp - imReflected256))
      }
    }
  } else if (attackKind === 'missile') {
    const reactiveMissile = defender.stateBus.triggerReactiveEvents({
      event: 'hitbymissile',
      incomingPhys256: finalPhys256,
      incomingElem256: finalElem256,
      elemType,
      ...(packet.returnFire !== undefined ? { returnFire: packet.returnFire } : {}),
      attackerStateBus: attacker.stateBus,
      ...(defender.x !== undefined ? { defenderX: defender.x } : {}),
      ...(defender.y !== undefined ? { defenderY: defender.y } : {}),
      ...(attacker.x !== undefined ? { attackerX: attacker.x } : {}),
      ...(attacker.y !== undefined ? { attackerY: attacker.y } : {}),
      defenderRawUnitType: defRawType,
      defenderUnitId: defNumericId,
      attackerRawUnitType: atkRawType,
      attackerUnitId: atkNumericId,
    })
    if (reactiveMissile.spawnedMissiles.length > 0) {
      spawnedMissiles.push(...reactiveMissile.spawnedMissiles)
    }
    if (reactiveMissile.attackerStatesApplied.length > 0) {
      attackerStatesApplied.push(...reactiveMissile.attackerStatesApplied)
    }
    if (reactiveMissile.attackerOverlaysApplied) {
      attackerOverlaysApplied.push(...reactiveMissile.attackerOverlaysApplied)
    }
    if (reactiveMissile.defenderOverlaysApplied) {
      defenderOverlaysApplied.push(...reactiveMissile.defenderOverlaysApplied)
    }
    if (reactiveMissile.unitOverlays) {
      unitOverlays.push(...reactiveMissile.unitOverlays)
    }
  }

  // Concentration: 20% chance that attack will not be interrupted (D2Game.dll 0x6FCFC8D6..0x6FCFC8FA)
  const hasConcentration =
    attacker.stateBus.hasState('concentration') ||
    attacker.statList.getModifierBonus('skill_concentration') > 0
  const isUninterrupted = hasConcentration
    ? (packet.rollUninterrupted !== undefined
        ? packet.rollUninterrupted < 20
        : resolvedRng.rand(100) < 20)
    : false

  return {
    hit: true,
    avoidedReason: 'none',
    immuneToElem: elemResRec.isImmune && rawElem256 > 0,
    immuneToPhys: physResRec.isImmune && rawPhys256 > 0,
    physDamage256: finalPhys256,
    elemDamage256: finalElem256,
    totalDamage256,
    totalDamage: Math.ceil(totalDamage256 / FIXED_ONE),
    targetHpBefore256: hpBefore256,
    targetHpAfter256: hpAfter256,
    targetKilled: hpAfter256 === 0 && hpBefore256 > 0,
    ...(isCritical ? { isCritical: true } : {}),
    ...(isUninterrupted ? { uninterrupted: true } : {}),
    ...(attackerStatesApplied.length > 0 ? { attackerStatesApplied } : {}),
    ...(attackerColdDamage256 > 0 ? { attackerColdDamage256 } : {}),
    ...(reflectedPhys256 > 0 ? { reflectedPhys256 } : {}),
    ...(attackerHealed256 > 0 ? { attackerHealed256 } : {}),
    ...(attackerManaLeeched256 > 0 ? { attackerManaLeeched256 } : {}),
    ...(packet.canTriggerProcs === false ? { procsSuppressed: true } : {}),
    ...(selfDamageTaken256 > 0 ? { selfDamageTaken256 } : {}),
    ...(spawnedMissiles.length > 0 ? { spawnedMissiles } : {}),
    ...(attackerOverlaysApplied.length > 0 ? { attackerOverlaysApplied } : {}),
    ...(defenderOverlaysApplied.length > 0 ? { defenderOverlaysApplied } : {}),
    ...(unitOverlays.length > 0 ? { unitOverlays } : {}),
  }
}

// ============================================================================
// Normal Weapon / Unarmed / Bow / Crossbow Attack Execution
// ============================================================================

import { damageMonster, type Monster } from '../ai/monster-ai.ts'
import type { GameEngine } from './game-engine.ts'
import { monsterDisplayName } from '../../common/units/monsters-data.ts'
import type { Projectile } from '../../common/skills/missiles-data.ts'
import { getTblLang } from '../../common/i18n/lang.ts'
import {
  PASSIVE_SKILL_IDS,
  isPassiveSkill,
  type AttackWeaponKind,
  type AttackWeaponSubtype,
  type AttackWeaponInfo,
  type AttackWeaponInputItem,
  getAttackWeaponInfo,
  checkAmmunition,
  type HudCombatStateLike,
  getSkillRange,
  getSkillMana,
  type SkillCastOutcome,
} from '../../common/skills/weapon-combat-meta.ts'
export {
  PASSIVE_SKILL_IDS,
  isPassiveSkill,
  type AttackWeaponKind,
  type AttackWeaponSubtype,
  type AttackWeaponInfo,
  type AttackWeaponInputItem,
  getAttackWeaponInfo,
  checkAmmunition,
  type HudCombatStateLike,
  getSkillRange,
  getSkillMana,
  type SkillCastOutcome,
} from '../../common/skills/weapon-combat-meta.ts'
import {
  calculateMightStats,
  calculateConcentrationStats,
  calculateSanctuaryStats,
  calculateFanaticismStats,
} from '../../common/skills/paladin-auras.ts'
import { resolveWeaponBase113c } from '../../common/units/char-anim-speed.ts'

export interface WeaponCombatContext {
  readonly engine: GameEngine
  readonly hudLike?: HudCombatStateLike | null | undefined
  readonly equippedWeapon?: AttackWeaponInputItem | null | undefined
  readonly equippedAmmo?: any | null | undefined
  readonly hasAmmo?: boolean | undefined
}

function resolveLearnedSkillLevelFromHudOrPlayer(
  skillId: number,
  engine: GameEngine,
  hudLike?: HudCombatStateLike | null | undefined,
): number {
  const player = engine.world?.player as any
  const baseSkillLevels = (hudLike as any)?.baseSkillLevels ?? player?.baseSkillLevels
  if (baseSkillLevels && typeof baseSkillLevels === 'object' && skillId in baseSkillLevels) {
    if (Number(baseSkillLevels[skillId]) <= 0) return 0
  }
  if (typeof (hudLike as any)?.getBaseSkillLevel === 'function') {
    if (Number((hudLike as any).getBaseSkillLevel(skillId)) <= 0) return 0
  }
  const fromHudFn =
    typeof (hudLike as any)?.getSkillLevel === 'function'
      ? Number((hudLike as any).getSkillLevel(skillId))
      : 0
  if (Number.isFinite(fromHudFn) && fromHudFn > 0) return Math.floor(fromHudFn)
  const skillLevels = (hudLike as any)?.skillLevels ?? player?.skillLevels ?? {}
  const fromMap =
    typeof player?.skills?.get === 'function'
      ? Number(player.skills.get(skillId))
      : Number(skillLevels[skillId] ?? player?.skills?.[skillId] ?? 0)
  return Number.isFinite(fromMap) && fromMap > 0 ? Math.floor(fromMap) : 0
}

function resolveBarbarianMeleeMasteryCombat(
  weapon: AttackWeaponInputItem | null | undefined,
  weaponInfo: AttackWeaponInfo,
  engine: GameEngine,
  hudLike?: HudCombatStateLike | null | undefined,
): { readonly edPct: number; readonly arPct: number; readonly critPct: number; readonly critMult: 1 | 2 } {
  if (!weapon || weaponInfo.kind !== 'melee' || weaponInfo.isRanged) {
    return { edPct: 0, arPct: 0, critPct: 0, critMult: 1 }
  }
  const code = String(weapon.code ?? '').trim().toLowerCase()
  const wb = code ? resolveWeaponBase113c(code) : undefined
  const typeTokens = [
    wb?.type,
    weapon.type,
    weaponInfo.subtype,
    weapon.name,
  ]
    .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    .map(t => t.trim().toLowerCase())

  const meleeMasteryIds = [127, 128, 129, 134, 136] as const
  for (const mId of meleeMasteryIds) {
    const slvl = resolveLearnedSkillLevelFromHudOrPlayer(mId, engine, hudLike)
    if (slvl <= 0) continue
    if (typeTokens.some(tok => isWeaponMatchingMastery(tok, mId))) {
      const stats = evaluateBarbarianMastery(mId, slvl) as WeaponMasteryStats
      const player = engine.world?.player as any
      const csProc =
        Boolean(player?.criticalStrikeProc) ||
        (typeof player?.criticalStrikeRoll === 'number' &&
          player.criticalStrikeRoll < stats.criticalStrikeChancePct)
      const dsPct = Number(player?.deadlyStrikePct ?? 0)
      const dsProc =
        !csProc &&
        (Boolean(player?.deadlyStrikeProc) ||
          (typeof player?.deadlyStrikeRoll === 'number' && player.deadlyStrikeRoll < dsPct))
      return {
        edPct: stats.damageBonusPct,
        arPct: stats.attackRatingBonusPct,
        critPct: stats.criticalStrikeChancePct,
        critMult: csProc || dsProc ? 2 : 1,
      }
    }
  }
  return { edPct: 0, arPct: 0, critPct: 0, critMult: 1 }
}

function resolveActiveAuraWeaponCombat(
  baseMin: number,
  baseMax: number,
  engine: GameEngine,
  hudLike?: HudCombatStateLike | null | undefined,
  targetMonster?: Monster | null | undefined,
  extraEdPct = 0,
  critMult: 1 | 2 = 1,
): { readonly damage: number; readonly iasPct: number } {
  const rawAuraId =
    engine.activeAuraSkillId ??
    ((hudLike as any)?.rightSkill && [98, 102, 113, 114, 118, 119, 122].includes((hudLike as any).rightSkill)
      ? Number((hudLike as any).rightSkill)
      : null)
  if (!rawAuraId && extraEdPct === 0 && critMult === 1) {
    return { damage: Math.round((baseMin + baseMax) / 2), iasPct: 0 }
  }
  const skillLevels =
    (hudLike as any)?.skillLevels ??
    (engine.world?.player as any)?.skillLevels ??
    {}
  const slvl = rawAuraId
    ? Math.max(
        1,
        engine.activeAuraSkillId === rawAuraId && engine.activeAuraLevel > 0
          ? engine.activeAuraLevel
          : Number(skillLevels[rawAuraId] ?? 1),
      )
    : 0
  const resistFire = Math.max(0, Number(skillLevels[100] ?? 0))
  const resistCold = Math.max(0, Number(skillLevels[105] ?? 0))
  const resistLightning = Math.max(0, Number(skillLevels[110] ?? 0))
  const salvation = Math.max(0, Number(skillLevels[125] ?? 0))

  let edPct = extraEdPct
  let elemAvg = 0
  let iasPct = 0

  if (rawAuraId === 98) {
    edPct += calculateMightStats(slvl).damagePercent
  } else if (rawAuraId === 113) {
    edPct += calculateConcentrationStats(slvl).damagePercent
  } else if (rawAuraId === 122) {
    const fanat = calculateFanaticismStats(slvl)
    edPct += fanat.casterDamagePercent
    iasPct = fanat.casterIas
  } else if (rawAuraId === 119) {
    const isUndead = Boolean((targetMonster as any)?.isUndead || targetMonster?.stats?.isUndead)
    if (isUndead) {
      edPct += calculateSanctuaryStats(slvl).undeadDamagePercent
    }
  } else if (rawAuraId === 102) {
    const hf = calculateHolyFireStats(slvl, { resistFire, salvation })
    elemAvg = (hf.weaponFireMin + hf.weaponFireMax) / 2
  } else if (rawAuraId === 114) {
    const hfr = calculateHolyFreezeStats(slvl, { resistCold, salvation })
    elemAvg = (hfr.weaponColdMin + hfr.weaponColdMax) / 2
  } else if (rawAuraId === 118) {
    const hs = calculateHolyShockStats(slvl, { resistLightning, salvation })
    elemAvg = (hs.weaponLightningMin + hs.weaponLightningMax) / 2
  }

  if (edPct === 0 && elemAvg === 0 && critMult === 1) {
    return { damage: Math.round((baseMin + baseMax) / 2), iasPct }
  }
  const physMin = Math.floor((baseMin * (100 + edPct)) / 100) * critMult
  const physMax = Math.floor((baseMax * (100 + edPct)) / 100) * critMult
  return {
    damage: Math.max(1, Math.round((physMin + physMax) / 2 + elemAvg)),
    iasPct,
  }
}

/**
 * Pure simulation helper for normal weapon/unarmed attack (`skillId === 0`).
 */
export function executeNormalAttack(
  targetX: number,
  targetY: number,
  context: WeaponCombatContext,
): SkillCastOutcome {
  const { engine, hudLike } = context
  const player = engine.world.player
  const isEn = (hudLike?.lang ?? getTblLang()) === 'ENG'
  const globalHud = (globalThis as Record<string, any>).__d2webHudInstance as HudCombatStateLike | null | undefined

  const rawW1 = hudLike?.inventory?.equipped?.weapon1 ?? globalHud?.inventory?.equipped?.weapon1 ?? null
  const rawW2 = hudLike?.inventory?.equipped?.weapon2 ?? globalHud?.inventory?.equipped?.weapon2 ?? null
  const w1Info = getAttackWeaponInfo(rawW1)
  const w2Info = getAttackWeaponInfo(rawW2)
  const swappedRanged = context.equippedWeapon === undefined && !w1Info.isRanged && w2Info.isRanged
  const weapon = context.equippedWeapon ?? (swappedRanged ? rawW2 : rawW1)
  const weaponInfo =
    context.equippedWeapon !== undefined ? getAttackWeaponInfo(weapon) : swappedRanged ? w2Info : w1Info

  if (weaponInfo.isRanged) {
    const ammo = context.equippedAmmo ?? (swappedRanged ? rawW1 : rawW2)
    const hasAmmo = context.hasAmmo ?? checkAmmunition(weaponInfo.ammoType!, ammo, hudLike?.inventory)
    if (!hasAmmo) {
      return {
        casted: false,
        animMode: 'a1',
        statusMessage: isEn
          ? (weaponInfo.ammoType === 'arrow' ? 'Out of arrows!' : 'Out of bolts!')
          : (weaponInfo.ammoType === 'arrow' ? '缺少箭矢！' : '缺少十字弓弹！'),
      }
    }

    const auraMod = resolveActiveAuraWeaponCombat(weaponInfo.damageMin, weaponInfo.damageMax, engine, hudLike)
    player.cooldown = auraMod.iasPct > 0 ? Math.max(1, Math.round((weaponInfo.cooldown * 100) / (100 + auraMod.iasPct))) : weaponInfo.cooldown
    player.swingTicks = auraMod.iasPct > 0 ? Math.max(1, Math.round((weaponInfo.swingTicks * 100) / (100 + auraMod.iasPct))) : weaponInfo.swingTicks

    const dx = targetX - player.x
    const dy = targetY - player.y
    const len = Math.hypot(dx, dy)
    const speed = 500
    const range = weaponInfo.reach
    const perTick = speed / 25
    const ttl = Math.max(1, Math.round(range / perTick))

    const damage = auraMod.damage

    const projectile: Projectile = {
      skillId: '0',
      x: player.x,
      y: player.y,
      vx: len > 0 ? (dx / len) * perTick : perTick,
      vy: len > 0 ? (dy / len) * perTick : 0,
      damage,
      ttl,
      fromPlayer: true,
    }

    engine.projectiles.push(projectile)
    engine.metrics.casts += 1
    return {
      casted: true,
      animMode: 'a1',
      statusMessage: isEn
        ? (weaponInfo.subtype === 'bow' ? 'Attack: Shoot Arrow' : 'Attack: Shoot Bolt')
        : (weaponInfo.subtype === 'bow' ? '普通攻击：发射箭矢' : '普通攻击：发射弩箭'),
    }
  }

  // Unarmed or Melee Attack
  let targetMonster: Monster | null = null
  let bestTargetDist = 36
  for (const monster of engine.world.monsters) {
    if (monster.state === 'dead' || monster.hp <= 0) continue
    const distToPlayer = Math.hypot(monster.x - player.x, monster.y - player.y)
    if (distToPlayer <= weaponInfo.reach) {
      const distFeet = Math.hypot(monster.x - targetX, monster.y - targetY)
      const distBody = Math.hypot(monster.x - targetX, (monster.y - 16) - targetY)
      const minD = Math.min(distFeet, distBody)
      if (minD <= bestTargetDist) {
        bestTargetDist = minD
        targetMonster = monster
      }
    }
  }
  if (targetMonster === null) {
    let bestDist = weaponInfo.reach
    for (const monster of engine.world.monsters) {
      if (monster.state === 'dead' || monster.hp <= 0) continue
      const dist = Math.hypot(monster.x - player.x, monster.y - player.y)
      if (dist <= bestDist) {
        bestDist = dist
        targetMonster = monster
      }
    }
  }

  const masteryMod = resolveBarbarianMeleeMasteryCombat(weapon, weaponInfo, engine, hudLike)
  const auraMod = resolveActiveAuraWeaponCombat(
    weaponInfo.damageMin,
    weaponInfo.damageMax,
    engine,
    hudLike,
    targetMonster,
    masteryMod.edPct,
    masteryMod.critMult,
  )
  player.cooldown = auraMod.iasPct > 0 ? Math.max(1, Math.round((weaponInfo.cooldown * 100) / (100 + auraMod.iasPct))) : weaponInfo.cooldown
  player.swingTicks = auraMod.iasPct > 0 ? Math.max(1, Math.round((weaponInfo.swingTicks * 100) / (100 + auraMod.iasPct))) : weaponInfo.swingTicks

  const damage = auraMod.damage
  let statusMessage: string | null = null
  if (targetMonster !== null) {
    damageMonster(engine.world, targetMonster.index, damage)
    engine.metrics.playerHits += 1
    if (isEn) {
      const attackLabel = weaponInfo.kind === 'unarmed' ? 'Unarmed Attack' : 'Attack'
      statusMessage = `${attackLabel} hit: ${monsterDisplayName(targetMonster.stats, 'ENG')}`
    } else {
      const attackLabel = weaponInfo.kind === 'unarmed' ? '普通攻击（空手拳击）' : '普通攻击'
      statusMessage = `${attackLabel}命中：${targetMonster.stats.name || targetMonster.stats.id}`
    }
  } else {
    engine.world.events.push({ kind: 'playerHit', x: player.x, y: player.y, amount: 0, text: 'whiff' })
  }
  return {
    casted: true,
    animMode: 'a1',
    statusMessage,
  }
}

