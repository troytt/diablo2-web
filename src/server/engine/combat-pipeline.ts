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
import { mulDiv113c } from '../../common/data/mul-div-113c.ts'
import { FIXED_ONE, UnitStatList } from './stat-list.ts'
import { compute5BandScaling, computeDiminishingReturns } from '../../common/data/calc-ast.ts'
import { resolveWeaponBase113c } from '../../common/units/char-anim-speed.ts'
import { StateBus, type ReactiveUnitOverlayEvent } from './state-bus.ts'
import { calculateIronMaidenReturnPct } from './missile-engine.ts'
import {
  calculateHolyFireStats,
  calculateHolyFreezeStats,
  calculateHolyShockStats,
} from '../skills/skills.ts'
import {
  evaluateBarbarianMastery,
  isWeaponMatchingMastery,
  itemTypeIsA,
  type WeaponMasteryStats,
} from '../skills/barbarian-masteries.ts'
import { computeVenomPoisonDamage } from '../skills/assassin-shadow.ts'
import { CHARACTER_CLASS_CODES, resolveCharacterClass } from '../../common/units/classes.ts'
import { rollLimitedSeed113c } from './game-instance/unit-seeds-113c.ts'

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
  x?: number
  y?: number
  readonly ownerUnitId?: string
  readonly ownerRef?: CombatUnitContext | undefined
  readonly isUndead?: boolean
  readonly isDemon?: boolean
  readonly isMoving?: boolean | undefined
  readonly isWalking?: boolean | undefined
  readonly isRunning?: boolean | undefined
  readonly isDualClaw?: boolean | undefined
  readonly hasShield?: boolean | undefined
  readonly isRanged?: boolean
  weaponItemType?: string
  readonly offHandWeaponItemType?: string
  readonly weaponCode?: string
  readonly offHandWeaponCode?: string
  readonly weaponHitClass?: number | string | undefined
  readonly weaponMinPhys?: number
  readonly weaponMaxPhys?: number
  readonly weaponStrBonus?: number | undefined
  readonly weaponDexBonus?: number | undefined
  readonly weaponPoisonBitrate256?: number
  readonly weaponPoisonFrames?: number
  readonly weaponPoisonSources?: readonly { readonly bitrate256: number; readonly frames: number }[] | undefined
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
   * `DifficultyLevels.txt` `MonsterColdDivisor` / `MonsterFreezeDivisor` (1 / 2 / 4) for monster
   * targets (`D2Game.dll` `0x6FCFC84A` / `0x6FCFDC18`).
   */
  readonly monsterColdDivisor?: number | undefined
  readonly monsterFreezeDivisor?: number | undefined
  /**
   * `MonStats.txt` `Drain` / `Drain(N)` / `Drain(H)` of the current difficulty for a
   * monster-class defender (`MonStatsTxt + 0xA0 + difficulty`, read at `D2Game.dll` 0x6FCFBA8E).
   * Steal against a monster-class defender is scaled by `Drain / 100` and skipped when
   * `Drain <= 0` (e.g. `skeleton1`). Required whenever a monster-class defender is stolen from.
   */
  readonly drain?: number | undefined
  readonly isBoss?: boolean
  readonly isPrimeEvil?: boolean
  readonly isSuperUnique?: boolean
  readonly coldEffect?: number
  readonly isChampion?: boolean
  readonly rank?: 'normal' | 'champion' | 'unique' | 'superunique' | 'minion' | 'boss'
  readonly armorClassIncludesDex?: boolean
  readonly smiteMinDam?: number
  readonly smiteMaxDam?: number
  readonly partyScaleCount?: number
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
 * 1.13c (`samples/d2/D2Game.dll` `0x6FCFB3C0`):
 * Return the unit's resistance before Amplify Damage (`9`) / Decrepify (`60`) / Lower Resist (`61`) /
 * Conviction (`28`) modifiers so `computeEffectiveResistance` can apply `1/5` immunity breaking
 * when pre-pierce resistance >= 100% without double-subtracting the modifier delta.
 */
export function getPrePierceResistance113c(
  statList: UnitStatList,
  statName: 'damageresist' | 'magicresist' | 'fireresist' | 'lightresist' | 'coldresist' | 'poisonresist',
): number {
  let res = statList.getAccruedStat(statName)
  if (statName === 'magicresist') return res
  let bestConvictionMod: { slvl: number; delta: number } | undefined
  for (const mod of statList.getActiveModifiers()) {
    const delta = mod.stats[statName] ?? 0
    if (delta === 0) continue
    if (statName === 'damageresist') {
      if (mod.stateName === 'amplifydamage' || mod.stateName === 'decrepify' || mod.stateId === 9 || mod.stateId === 60) {
        res -= delta
      }
    } else {
      if (mod.stateName === 'lowerresist' || mod.stateId === 61) {
        res -= delta
      } else if (mod.stateName === 'conviction' || mod.stateId === 28) {
        if (!bestConvictionMod || mod.slvl >= bestConvictionMod.slvl) {
          bestConvictionMod = { slvl: mod.slvl, delta }
        }
      }
    }
  }
  if (bestConvictionMod) {
    res -= bestConvictionMod.delta
  }
  return res
}

/**
 * 1.13c (`samples/d2/D2Game.dll` `0x6FCC00B0` + `samples/d2/excel/Skills.txt` rows 66/87):
 * Read physical resistance pierce magnitude from the active curse modifier (`damageresist`)
 * on `defender.stateBus` / `defender.statList`.
 */
export function resolvePhysCursePierce113c(
  defender: Pick<CombatUnitContext, 'statList' | 'stateBus'>,
): number {
  const ampMod = defender.stateBus.getState('amplifydamage')
  if (ampMod) {
    return Math.max(0, -(ampMod.stats['damageresist'] ?? 0))
  }
  const decMod = defender.stateBus.getState('decrepify')
  if (decMod) {
    return Math.max(0, -(decMod.stats['damageresist'] ?? 0))
  }
  return 0
}

/**
 * 1.13c (`samples/d2/D2Game.dll` `0x6FCC00B0` + `samples/d2/excel/Skills.txt` row 91):
 * Read Lower Resist pierce magnitude from the active `lowerresist` modifier on `defender.stateBus`.
 */
export function resolveLowerResistPierce113c(
  defender: Pick<CombatUnitContext, 'statList' | 'stateBus'>,
  resStatKey: 'fireresist' | 'lightresist' | 'coldresist' | 'poisonresist' = 'fireresist',
): number {
  const lrMod = defender.stateBus.getState('lowerresist')
  if (!lrMod) return 0
  return Math.max(0, -(lrMod.stats[resStatKey] ?? lrMod.stats['fireresist'] ?? 0))
}

/**
 * 1.13c (`samples/d2/D2Game.dll` `0x6FCC0C70` + `samples/d2/excel/Skills.txt` row 123):
 * Read Conviction pierce magnitude from the active `conviction` modifier on `defender.stateBus`.
 */
export function resolveConvictionPierce113c(
  defender: Pick<CombatUnitContext, 'statList' | 'stateBus'>,
  resStatKey: 'fireresist' | 'lightresist' | 'coldresist' = 'fireresist',
): number {
  const convMod = defender.stateBus.getState('conviction')
  if (!convMod) return 0
  return Math.max(0, -(convMod.stats[resStatKey] ?? convMod.stats['fireresist'] ?? 0))
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
 * Compute 1.13c `RollToHit` chance (`D2Game.dll` `0x6FCFDE90`, clamped to `[5, 95]`, or `100` for `autohit`).
 *
 * Implements:
 * - Single additive `%AR` pool (`item_tohit_percent` 119 + skill `%AR` + weapon mastery `%AR` + `progressive_tohit` 325 + `attack_vs_montype` 179) (#1625).
 * - Flat AR vs Demon (`123 item_demon_tohit`) and Undead (`124 item_undead_tohit`) (#1626).
 * - Defender `32 armorclass_vs_missile` / `33 armorclass_vs_hth`, `115 item_ignoretargetac` (vs normal monsters),
 *   `116 item_fractionaltargetac` (halved vs players/bosses/mercs, capped at 100), and negative defense/AR adjustment (#1626).
 */
export function computeToHitChance(params: {
  attackerAr: number
  defenderDef: number
  attackerLvl: number
  defenderLvl: number
  skillArBonusPct?: number
  itemArBonusPct?: number
  demonToHit?: number
  undeadToHit?: number
  isTargetDemon?: boolean
  isTargetUndead?: boolean
  ignoreTargetAc?: boolean
  fractionalTargetAc?: number
  isTargetPlayerOrBossOrMerc?: boolean
  blocksIgnoreTargetDefense?: boolean
  halvesFractionalTargetAc?: boolean
  defenderAcVsMissile?: number
  defenderAcVsHth?: number
  attackKind?: 'melee' | 'missile' | 'spell'
  targetDefPctMod?: number // e.g. -50% from Battle Cry / Cloak of Shadows
  autoHit?: boolean
}): number {
  if (params.autoHit) return 100
  const baseAr =
    Math.trunc(params.attackerAr) +
    (params.isTargetDemon ? Math.trunc(params.demonToHit ?? 0) : 0) +
    (params.isTargetUndead ? Math.trunc(params.undeadToHit ?? 0) : 0)
  const arBonusPct = Math.trunc(params.skillArBonusPct ?? 0) + Math.trunc(params.itemArBonusPct ?? 0)
  let effAr = baseAr + Math.trunc((baseAr * arBonusPct) / 100)

  const blocksItd =
    params.blocksIgnoreTargetDefense ?? Boolean(params.isTargetPlayerOrBossOrMerc)
  const halvesFracAc =
    params.halvesFractionalTargetAc ?? Boolean(params.isTargetPlayerOrBossOrMerc)

  let effDef = 0
  if (!(params.ignoreTargetAc && !blocksItd)) {
    effDef = Math.trunc(params.defenderDef)
    const rawFrac = Math.trunc(params.fractionalTargetAc ?? 0)
    if (rawFrac > 0) {
      const frac = Math.min(
        100,
        Math.max(0, halvesFracAc ? Math.trunc(rawFrac / 2) : rawFrac),
      )
      if (frac > 0) {
        effDef -= Math.trunc((effDef * frac) / 100)
      }
    }
    const defMod = params.targetDefPctMod ?? 0
    if (defMod !== 0) {
      effDef = Math.trunc((effDef * Math.max(0, 100 + defMod)) / 100)
    }
    if (params.attackKind === 'missile' && params.defenderAcVsMissile) {
      effDef += Math.trunc(params.defenderAcVsMissile)
    } else if (params.attackKind === 'melee' && params.defenderAcVsHth) {
      effDef += Math.trunc(params.defenderAcVsHth)
    }
  }

  // 1.13c `D2Game.dll` `0x6FCFDFD6..0x6FCFDFF2`: negative defense adds to AR; negative AR adds to defense.
  if (effDef < 0) {
    effAr -= effDef
    effDef = 0
  }
  if (effAr < 0) {
    effDef -= effAr
    effAr = 0
  }

  const alvl = Math.max(1, params.attackerLvl)
  const dlvl = Math.max(1, params.defenderLvl)

  const divisor = effAr + effDef
  const toHitFactor = divisor > 0 ? Math.trunc((100 * effAr) / divisor) : 100
  const raw = Math.trunc((2 * alvl * toHitFactor) / (alvl + dlvl))
  return Math.max(5, Math.min(95, raw))
}

/**
 * Unclamped-input 1.13c `D2Game.dll` `0x6FCFDE90..0x6FCFE08C` (`RollToHit` chance `[5, 95]`):
 * - Scales `ar` via `mulDiv113c(extraPct + itemPct, ar, 100)` (`0x6FCFDFB3..0x6FCFDFC1`).
 * - Applies 32-bit signed wrap on `def < 0` / `ar < 0` (`0x6FCFDFC3..0x6FCFDFEB`).
 * - Uses signed `alvl` / `dlvl` directly (`(imul(f, alvl) << 1) / (alvl + dlvl)`, faulting in x86 when `alvl + dlvl == 0`).
 */
export function computeRawToHitChance113c(params: {
  readonly ar: number
  readonly def: number
  readonly alvl: number
  readonly dlvl: number
  readonly extraPct: number
  readonly itemPct: number
  readonly acVs: number
}): number {
  let ebp = params.ar | 0
  let edi = ((params.def | 0) + (params.acVs | 0)) | 0
  const esi = ((params.extraPct | 0) + (params.itemPct | 0)) | 0
  ebp = (ebp + mulDiv113c(esi, ebp, 100)) | 0
  if (edi < 0) {
    ebp = (ebp - edi) | 0
    edi = 0
  }
  if (ebp < 0) {
    edi = (edi - ebp) | 0
    ebp = 0
  }
  if (edi < 0) edi = 0
  edi = (edi + ebp) | 0
  const f = edi === 0 ? 100 : (Math.trunc(Math.imul(ebp, 100) / edi) | 0)
  const ecx = params.alvl | 0
  const edx = params.dlvl | 0
  const den = (ecx + edx) | 0
  if (den === 0) return 5
  const num = (Math.imul(f, ecx) << 1) | 0
  const raw = Math.trunc(num / den) | 0
  return raw <= 5 ? 5 : raw >= 95 ? 95 : raw
}

/**
 * 1.13c `D2Game.dll` `0x6FCFAC10` (`SUNITDMG_GetDamagePercentModifier`, table @ `0x6FD28140`):
 * - Player (`unitType === 'player' | 'party'`) or player-owned Mercenary/Minion vs Player defender: `17%` (`1/6`).
 * - Mercenary (`unitType === 'mercenary' | 'party_mercenary'`) vs Mercenary: `25%` (`1/4`).
 * - Note: Boss vs Player-Summoned Minion `400%` (`offset +0x0C`) is gated out in 1.13c because
 *   `0x6FD28154` sets `offset +0x04 = 100` and `0x6FCFAC89` jumps to `100` whenever `offset +0x04 == 100`.
 */
export function damagePercentModifier113c(
  attacker: Pick<CombatUnitContext, 'unitType' | 'ownerUnitId' | 'ownerRef' | 'petOwnerId'>,
  defender: Pick<CombatUnitContext, 'unitType' | 'ownerUnitId' | 'ownerRef' | 'petOwnerId'>,
): number {
  const atkIsPlayer = attacker.unitType === 'player' || attacker.unitType === 'party'
  const defIsPlayer = defender.unitType === 'player' || defender.unitType === 'party'
  const atkIsMerc = attacker.unitType === 'mercenary' || attacker.unitType === 'party_mercenary'
  const defIsMerc = defender.unitType === 'mercenary' || defender.unitType === 'party_mercenary'
  const atkIsPlayerMinion =
    attacker.unitType === 'minion' ||
    Boolean(attacker.ownerUnitId || attacker.ownerRef || attacker.petOwnerId)
  if (defIsPlayer && (atkIsPlayer || atkIsMerc || atkIsPlayerMinion)) {
    return 17
  }
  if (atkIsMerc && defIsMerc) {
    return 25
  }
  return 100
}

/**
 * Evaluate shield block (`D2Game.dll` `0x6FCFB790`), Assassin Weapon Block (`263`, `0x6FCFB0DE`),
 * and Amazon Evade (`29`, `0x6FCFB065`), Dodge (`13`, `0x6FCFB11F`), Avoid (`18`, `0x6FCFB156`).
 *
 * Each active check draws its own independent `rng.rand(100)` roll in 1.13c (never reusing the
 * attacker's `RollToHit` roll or a previous avoidance roll).
 */
/**
 * 1.13c `D2Common.dll #10212` (`UNITS_GetBlockRate` @ `0x6FD81D20`):
 * - Player (`unitType === 'player'`):
 *   - Requires an equipped shield (`hasShield === true`); otherwise returns `0`.
 *   - `block = stat20 + CharStats.BlockFactor` (`Amazon: 25, Sorceress: 20, Necromancer: 20, Paladin: 30, Barbarian: 25, Druid: 20, Assassin: 25`).
 *   - In Expansion (`isExpansion = true`): `block = Math.trunc(((dex - 15) * block) / (2 * Math.max(1, clvl)))`.
 *   - Clamped to `[0, 75]`.
 * - Monster / Minion / Hireling (`unitType !== 'player'`):
 *   - Hirelings (`unitType === 'mercenary'`) require `hasShield === true`.
 *   - Reads `STAT_TOBLOCK` (`statId = 20`, which for monsters already combines `MonStats.ToBlock[difficulty]`
 *     gated by `MonStats2.mBL` with any active state/item bonuses) and clamps to `[0, 75]`.
 */
export function computeBlockRate113c(unit: CombatUnitContext, isExpansion = true): number {
  const stat20 = Math.trunc(unit.statList.getAccruedStat('toblock'))
  if (unit.unitType === 'player') {
    if (!unit.hasShield) return 0
    const classStats = resolveCharacterClass(unit.charClass || unit.name || unit.id)
    let block = stat20 + classStats.blockFactor
    if (isExpansion) {
      const dex = Math.trunc(unit.statList.getAccruedStat('dexterity'))
      const clvl = Math.max(1, Math.trunc(unit.statList.getAccruedStat('level')))
      block = Math.trunc(((dex - 15) * block) / (2 * clvl))
    }
    return Math.min(75, Math.max(0, block))
  }
  if (unit.unitType !== 'monster' && unit.unitType !== 'minion' && !unit.hasShield) {
    return 0
  }
  return Math.min(75, Math.max(0, stat20))
}

/**
 * Unclamped-lower 1.13c `D2Common #10212` (`0x6FD81D20..0x6FD81E94`) player shield block rate:
 * `(toblock + CharStats.BlockFactor)` (and in Expansion `imul(dex - 15, block) / (2 * max(1, clvl))`),
 * capped at `<= 75` only (`0x6FD81E7F: cmp edi, 0x4b; jge`) with no `>= 0` clamp.
 */
export function computeRawPlayerBlockRate113c(
  classId: number,
  isExpansion: boolean,
  dex: number,
  clvl: number,
  toblock: number,
): number {
  const code = CHARACTER_CLASS_CODES[classId | 0] ?? 'ama'
  const cs = resolveCharacterClass(code)
  let edi = ((toblock | 0) + cs.blockFactor) | 0
  if (isExpansion) {
    const lv = Math.max(1, clvl | 0)
    const num = Math.imul(((dex | 0) - 15) | 0, edi)
    edi = Math.trunc(num / ((lv << 1) | 0)) | 0
  }
  return edi >= 75 ? 75 : edi
}

/**
 * Raw 1.13c `D2Game.dll` `SUNITDMG_GetResistance` (`0x6FCFB3C0..0x6FCFB4B4`):
 * - Pierce (`0x6FCFB3D8..0x6FCFB3FE`): when `pierceStatId >= 0` and `(res < 100 || defenderIsPlayer)`,
 *   subtracts signed `pierce` (`esi = (esi - pierce) | 0`, even when `pierce < 0`).
 * - Difficulty penalty (`0x6FCFB3FE..0x6FCFB434`): for players when `resStatId !== 36 && resStatId !== 37`,
 *   adds signed `penalty` (`esi = (esi + penalty) | 0`).
 * - Clamps (`0x6FCFB434..0x6FCFB4B4`):
 *   - If `esi <= 0`: returns `esi <= -100 ? -100 : esi`.
 *   - Monster (`!defenderIsPlayer`): returns `esi` with no `100` upper cap.
 *   - Player (`esi > 0`): `cap = maxStatId < 0 ? (resStatId === 36 ? 50 : 75) : (maxStat + 75) | 0`;
 *     when `maxStatId >= 0 && cap >= 95`, `cap = 95`; returns `esi >= cap ? cap : esi`.
 */
export function computeRawEffectiveResistance113c(params: {
  readonly resStatId: number
  readonly maxStatId: number
  readonly pierceStatId: number
  readonly defenderIsPlayer: boolean
  readonly res: number
  readonly maxStat: number
  readonly pierce: number
  readonly penalty: number
}): number {
  let esi = params.res | 0
  const defIsMonster = !params.defenderIsPlayer
  if (params.pierceStatId >= 0 && (esi < 100 || !defIsMonster)) {
    const p = params.pierce | 0
    if (p !== 0) {
      esi = (esi - p) | 0
    }
  }
  if (!defIsMonster && params.resStatId !== 36 && params.resStatId !== 37) {
    esi = (esi + (params.penalty | 0)) | 0
  }
  if (esi <= 0) {
    return esi <= -100 ? -100 : esi
  }
  if (defIsMonster) {
    return esi
  }
  let cap =
    params.maxStatId < 0
      ? params.resStatId === 36
        ? 50
        : 75
      : ((params.maxStat | 0) + 75) | 0
  if (params.maxStatId >= 0 && cap >= 95) {
    cap = 95
  }
  return esi >= cap ? cap : esi
}

/**
 * Raw 1.13c `D2Game.dll` `SUNITDMG_CalcResistAndAbsorb` (`0x6FCFC0B0..0x6FCFC52D`),
 * channel helper `0x6FCFBD00..0x6FCFBD88`, and absorb helper `0x6FCFAD00..0x6FCFAD66`
 * (for PvP modifier = 100%, physical row 0 + one elemental channel):
 * - Scales positive `dr << 8` / `mdr << 8` by `mulDiv113c(rate54, r256, 0x400)` when `rate54 > 0`;
 *   negative `dr` / `mdr` is NOT clamped (`0x6FCFC137..0x6FCFC175`).
 * - Subtracts `dr256` / `mdr256` without clamping to `0` (`0x6FCFBD41`), applies resistance via
 *   `mulDiv113c(100 - min(effRes, 100), esi, 100)` only when `esi > 0 && effRes !== 0` (`0x6FCFBD45..0x6FCFBD6A`),
 *   runs `%` absorb (capped at `40%`, `> 0`) then flat absorb (`<< 8`, `> 0`, `min(flat256, esi)`) on
 *   elemental channels even when `esi <= 0` (`0x6FCFAD00..0x6FCFAD62`), and sums channels signed (`0x6FCFC4F7..0x6FCFC519`).
 */
export function computeRawDamagePipe113c(params: {
  readonly defenderIsPlayer: boolean
  readonly phys256: number
  readonly elem256: number
  readonly rate54: number
  readonly dr: number
  readonly mdr: number
  readonly physRes: number
  readonly elemResStatId: number
  readonly elemMaxStatId: number
  readonly elemPierceStatId: number
  readonly res: number
  readonly maxRes: number
  readonly absPct: number
  readonly absFlat: number
  readonly pierce: number
  readonly penalty: number
}): {
  readonly physDamage256: number
  readonly elemDamage256: number
  readonly totalDamage256: number
  readonly absorb256: number
} {
  let dr256 = (params.dr | 0) << 8
  if (dr256 > 0 && (params.rate54 | 0) > 0) {
    dr256 = mulDiv113c(params.rate54 | 0, dr256, 0x400)
  }
  let mdr256 = (params.mdr | 0) << 8
  if (mdr256 > 0 && (params.rate54 | 0) > 0) {
    mdr256 = mulDiv113c(params.rate54 | 0, mdr256, 0x400)
  }

  let physOut = 0
  if ((params.phys256 | 0) > 0) {
    const effPhysRes = computeRawEffectiveResistance113c({
      resStatId: 36,
      maxStatId: -1,
      pierceStatId: -1,
      defenderIsPlayer: params.defenderIsPlayer,
      res: params.physRes,
      maxStat: 0,
      pierce: 0,
      penalty: 0,
    })
    let esi = ((params.phys256 | 0) - dr256) | 0
    if (esi > 0 && effPhysRes !== 0) {
      const r = effPhysRes >= 100 ? 100 : effPhysRes
      esi = mulDiv113c((100 - r) | 0, esi, 100)
    }
    physOut = esi
  }

  let elemOut = 0
  let absorb256 = 0
  if ((params.elem256 | 0) > 0) {
    const effElemRes = computeRawEffectiveResistance113c({
      resStatId: params.elemResStatId,
      maxStatId: params.elemMaxStatId,
      pierceStatId: params.elemPierceStatId,
      defenderIsPlayer: params.defenderIsPlayer,
      res: params.res,
      maxStat: params.maxRes,
      pierce: params.elemPierceStatId >= 0 ? params.pierce : 0,
      penalty: params.defenderIsPlayer ? params.penalty : 0,
    })
    let esi = ((params.elem256 | 0) - mdr256) | 0
    if (esi > 0 && effElemRes !== 0) {
      const r = effElemRes >= 100 ? 100 : effElemRes
      esi = mulDiv113c((100 - r) | 0, esi, 100)
    }
    let pct = params.absPct | 0
    if (pct >= 40) pct = 40
    if (pct > 0) {
      const a = mulDiv113c(pct, esi, 100)
      absorb256 = (absorb256 + a) | 0
      esi = (esi - a) | 0
    }
    const flat = (params.absFlat | 0) << 8
    if (flat > 0) {
      const f = flat >= esi ? esi : flat
      absorb256 = (absorb256 + f) | 0
      esi = (esi - f) | 0
    }
    elemOut = esi
  }

  return {
    physDamage256: physOut,
    elemDamage256: elemOut,
    totalDamage256: (physOut + elemOut) | 0,
    absorb256,
  }
}

export function evaluateAvoidanceAndBlock(params: {
  defender: CombatUnitContext
  attackKind: 'melee' | 'missile' | 'spell'
  rng: CombatRng
  unblockable?: boolean | undefined
  unavoidable?: boolean | undefined
  skillId?: number | undefined
  isPersistentGroundFire?: boolean | undefined
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
  // Persistent ground fire, Smite (#97), and explicitly unavoidable radial/DoT effects bypass 0x6FCFB790 / 0x6FCFB030 completely.
  if (params.isPersistentGroundFire || params.unavoidable || params.skillId === 97) {
    return { avoided: false, reason: 'none' }
  }
  const defStats = params.defender.statList
  const defAny = params.defender as unknown as Record<string, unknown>

  // 1. Shield / Monster Block (`D2Game.dll` `0x6FCFB790..0x6FCFB7FF` & `D2Common #10212` `0x6FD81D20`):
  // Runs ONLY when `bBlockable != 0` (`!params.unblockable`) and attack is physical (`attackKind !== 'spell'`).
  // When `params.unblockable === true` (e.g. elemental projectile spells), Step 1 is skipped and execution
  // proceeds directly into `0x6FCFB030` (`Evade` / `Weapon Block` / `Dodge` / `Avoid`).
  if (
    !params.unblockable &&
    params.attackKind !== 'spell' &&
    (params.defender.hasShield ||
      params.defender.unitType === 'monster' ||
      params.defender.unitType === 'minion')
  ) {
    let blockChance = computeBlockRate113c(params.defender)
    const isRunning =
      params.defender.isRunning === true ||
      defAny['isRunning'] === true ||
      (params.defender.isMoving === true &&
        params.defender.isWalking !== true &&
        defAny['isWalking'] !== true)
    if (params.defender.unitType === 'player' && isRunning) {
      blockChance = Math.trunc(blockChance / 3)
    }
    if (blockChance > 0) {
      const blockRoll = params.shieldBlockRoll100 ?? params.roll100 ?? params.rng.rand(100)
      if (blockRoll < blockChance) {
        return { avoided: true, reason: 'block' }
      }
    }
  }

  // 2. Movement Gate & Amazon Evade (`skillId = 29`, `stat 340`, `D2Game.dll` `0x6FCFB040..0x6FCFB09C`):
  // If defender is walking or running (`PLRMODE_WALK = 2` or `PLRMODE_RUN = 3`), ONLY `passive_evade` is rolled,
  // and `0x6FCFB09C` returns IMMEDIATELY regardless of whether `Evade` succeeded or failed (`Weapon Block`,
  // `Dodge`, and `Avoid` NEVER run while moving!).
  const isMovingOrRunning = Boolean(
    params.defender.isMoving ||
      params.defender.isWalking ||
      params.defender.isRunning ||
      defAny['isWalking'] ||
      defAny['isRunning'],
  )
  if (isMovingOrRunning) {
    const evadeChance = Math.max(0, Math.trunc(defStats.getAccruedStat('passive_evade')))
    if (evadeChance > 0) {
      const evadeRoll = params.evadeRoll100 ?? params.roll100 ?? params.rng.rand(100)
      if (evadeRoll < evadeChance) {
        return { avoided: true, reason: 'evade' }
      }
    }
    return { avoided: false, reason: 'none' }
  }

  // 3. Assassin Weapon Block (`skillId = 263`, `stat 348`, `D2Game.dll` `0x6FCFB0B9` -> `0x6FCFA540`):
  // Reached ONLY when NOT walking and NOT running, and requires dual-wielding two `h2h`/`h2h2` Katar-class claws.
  // Blocks melee, missiles, AND projectile spells!
  const wType = (params.defender.weaponItemType ?? '').trim().toLowerCase()
  const offWType = (
    params.defender.offHandWeaponItemType ??
    params.defender.offHandWeaponType ??
    ''
  )
    .trim()
    .toLowerCase()
  const isDualClawWielded =
    !params.defender.hasShield &&
    (params.defender.isDualClaw === true ||
      (params.defender.isDualClaw !== false &&
        wType !== '' &&
        offWType !== '' &&
        isWeaponMatchingMastery(wType, 263) &&
        isWeaponMatchingMastery(offWType, 263)))
  if (isDualClawWielded) {
    const wbChance = Math.max(0, Math.trunc(defStats.getAccruedStat('passive_weaponblock')))
    if (wbChance > 0) {
      const wbRoll = params.weaponBlockRoll100 ?? params.roll100 ?? params.rng.rand(100)
      if (wbRoll < wbChance) {
        return { avoided: true, reason: 'weapon_block' }
      }
    }
  }

  // 4. Amazon Dodge (`skillId = 13`, `stat 338`, `0x6FCFB10E`) vs Avoid (`skillId = 18`, `stat 339`, `0x6FCFB156`)
  // while stationary / attacking / casting:
  if (params.attackKind === 'melee') {
    const dodgeChance = Math.max(0, Math.trunc(defStats.getAccruedStat('passive_dodge')))
    if (dodgeChance > 0) {
      const dodgeRoll = params.dodgeRoll100 ?? params.roll100 ?? params.rng.rand(100)
      if (dodgeRoll < dodgeChance) {
        return { avoided: true, reason: 'dodge' }
      }
    }
  } else {
    const avoidChance = Math.max(0, Math.trunc(defStats.getAccruedStat('passive_avoid')))
    if (avoidChance > 0) {
      const avoidRoll = params.avoidRoll100 ?? params.roll100 ?? params.rng.rand(100)
      if (avoidRoll < avoidChance) {
        return { avoided: true, reason: 'avoid' }
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
      : Math.max(0, applyResist113c(rawPhysDamage, physRes.effectiveRes))
  const finalFireDamage =
    !inOuterFireRing || fireRes.isImmune
      ? 0
      : Math.max(0, applyResist113c(rawFireDamage, fireRes.effectiveRes))

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
  readonly skipMasteryEd?: boolean | undefined // mastery %ED already folded into flatPhysMin256/Max256 (#1803, #1804)
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
  readonly unavoidable?: boolean | undefined
  readonly isPersistentGroundFire?: boolean | undefined
  readonly noHitRecovery?: boolean | undefined
  readonly frameRate1024?: number | undefined
  readonly damageRate?: number | undefined
  readonly frameScalar?: number | undefined
  readonly difficulty?: 0 | 1 | 2 | 'normal' | 'nightmare' | 'hell' | undefined
  readonly isExpansion?: boolean | undefined
  readonly staticFieldMinPct?: number | undefined
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
  readonly preScaledPhysEd?: boolean | undefined
  readonly skipAttrEd?: boolean | undefined
  readonly includesNormalDamage?: boolean | undefined
  readonly skipCrushingBlow?: boolean | undefined
  readonly skipOpenWounds?: boolean | undefined
  readonly skipWeaponElemRiders?: boolean | undefined
  readonly skipWeaponPoison?: boolean | undefined
  readonly skipElemMastery?: boolean | undefined
  readonly riderSrcDam?: number | undefined
  readonly playerCount?: number | undefined
  readonly vengeanceBasePhys256?: number | undefined
  readonly cbRoll100?: number | undefined
  readonly owRoll100?: number | undefined
  readonly hitClass?: number | string | undefined
  readonly rng?: CombatRng | undefined
  readonly d2AttackerSeed113c?: { lo: number; hi: number } | undefined
  readonly d2DefenderSeed113c?: { lo: number; hi: number } | undefined
  readonly unrolledWeaponBase113c?:
    | {
        readonly min256: number
        readonly max256: number
        readonly edPct: number
        readonly srcDam: number
        /** `pDamage->dwEnDmgPct` (`+0x0C`) part of `edPct` (blunt vs undead, `0x6FCFA8C0`); trace only. */
        readonly enDmgPct113c?: number | undefined
      }
    | undefined
  /**
   * `MissilesTxt` `HitFlags` (`+0xA8`) OR-ed into `D2DamageStrc.dwHitFlags` by missile hit functions
   * before the area scan (`MISSMODE_SrvHit01` `0x6FC5BB05..0x6FC5BB17`); reported in the trace packet.
   */
  readonly missileHitFlags113c?: number | undefined
  /**
   * Result flags of a missile packet built by `0x6FC5A4E0` (+ `SrvDmg` bits, e.g. `SrvDmg03` softhit
   * `0x4000`): replaces the derived `0x04` get-hit bit in the trace packet (`0x01` is always set).
   */
  readonly missileResultFlags113c?: number | undefined
  /**
   * Monster attacker `MonStats.txt` `crit` column (`pMonStatsTxt + 0xA6`). When set together with
   * `d2AttackerSeed113c`, the tail of `SUNITDMG_FillDamageValues` (`0x6FCFD450`) runs for a monster
   * attacker before the resistances: the unconditional `RAND(1)` draw at `0x6FCFD908` and the monster
   * critical hit `0x6FC970E0` (`rand(100) < crit` doubles every damage field). See
   * `kb/combat/d2game-sunitdmg-player-defender-113c.md` §3.
   */
  readonly monStatsCritPct113c?: number | undefined
  /**
   * When `true`, skips the inline step-9 `damagedinmelee`/`ironmaiden`/`thorns_percent` reflection inside
   * `executeSUnitDmg` so `resolveMonsterAttackOnPlayer` can dispatch `event 5` (`Iron Maiden`), `event 1`
   * (`ATD`/`ATLD`/`DamageToMana`/`CtC`), armor durability, and `0x6FCB8A70` (`thorns_percent`) in exact
   * `D2Game.dll` `0x6FCFED30` -> `0x6FCFE0C0` call & `dmg`-trace order (`kb/combat/d2game-item-defense-absorb-thorns-ctc-113c.md`).
   */
  readonly deferDefenderReactiveEvents113c?: boolean | undefined
}

export {
  emitDotTraceEvent113c,
  setDotTraceObserver113c,
  type DotTraceEvent113c,
} from './statregen-dot-113c.ts'

export interface SUnitDmgTraceEvent113c {
  readonly att: readonly [number, number]
  readonly def: readonly [number, number]
  readonly hp: readonly [number, number]
  readonly ret: number
  readonly raw: readonly number[]
}

let sUnitDmgTraceObserver113c: ((ev: SUnitDmgTraceEvent113c) => void) | null = null

/** Install or clear an observer notified for every landed `SUNITDMG_ApplyDamage` (`0x6FCFC0B0`) hit. */
export function setSUnitDmgTraceObserver113c(
  observer: ((ev: SUnitDmgTraceEvent113c) => void) | null,
): void {
  sUnitDmgTraceObserver113c = observer
}

/** Notify the active `SUNITDMG` (`0x6FCFC0B0`) oracle trace observer of a landed hit (`ATD`, `Thorns`, `Iron Maiden`, `Static Field`, merc missile, etc.). */
export function emitSUnitDmgTraceEvent113c(ev: SUnitDmgTraceEvent113c): void {
  if (sUnitDmgTraceObserver113c !== null) {
    sUnitDmgTraceObserver113c(ev)
  }
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
  /** Exact signed `pDamage->dwPhysDamage` (`+0x08`, before MDR spill; negative when `flatDR > rawPhys`). */
  readonly signedPhysDamage256?: number | undefined
  /** Exact signed `pDamage->dwDmgTotal` (`+0x4C`). */
  readonly signedTotalDamage256?: number | undefined
  /** Exact `pDamage->wResultFlags` (`+0x04`) at `0x6FCFC0B0` return. */
  readonly resultFlags113c?: number | undefined
  readonly targetHpBefore256: number
  readonly targetHpAfter256: number
  readonly targetKilled: boolean
  readonly isCritical?: boolean
  /** Monster `MonStats.crit` hit (`0x6FC970E0`): sets the `0x10` hit-class nibble (`pDamage + 0x60`). */
  readonly monsterCrit113c?: boolean
  readonly uninterrupted?: boolean
  readonly knockedBack?: boolean
  readonly noHitRecovery?: boolean
  readonly hitClass?: number | undefined
  readonly crushingBlowTriggered?: boolean
  readonly crushingBlowDamage256?: number
  readonly openWoundsTriggered?: boolean
  readonly openWoundsBitrate256?: number
  readonly openWoundsFrames?: number
  readonly poisonBitrate256?: number
  readonly poisonDurationFrames?: number
  readonly attackerStatesApplied?: readonly string[]
  readonly attackerColdDamage256?: number
  readonly reflectedPhys256?: number
  readonly attackerHealed256?: number
  readonly attackerManaLeeched256?: number
  readonly absorbHeal256?: number
  readonly defenderHealed256?: number
  readonly selfDamageTaken256?: number
  readonly targetDefenseReduction?: number
  readonly spawnedMissiles?: readonly string[]
  readonly procsSuppressed?: boolean
  readonly attackerOverlaysApplied?: readonly string[]
  readonly defenderOverlaysApplied?: readonly string[]
  readonly unitOverlays?: readonly ReactiveUnitOverlayEvent[]
  readonly warnings?: readonly string[]
}

/**
 * 1.13c `Weapons.txt` `StrBonus` / `DexBonus` physical damage scaling factors (`D2Game.dll` `0x6FCFC640..0x6FCFC6CE`, #1867):
 * - Explicit `attacker.weaponStrBonus` / `weaponDexBonus` takes precedence when provided.
 * - `#97 Smite` (`0x6FCB87D0`): `100 Str / 0 Dex`.
 * - Equipped `weaponCode`: exact `Weapons.txt` `StrBonus` / `DexBonus` columns via `resolveWeaponBase113c`.
 * - `weaponItemType` fallback:
 *   - `abow` / `bow` / `xbow`: `0 Str / 100 Dex`
 *   - `ajav` / `aspe` (Amazon spears & javelins): `80 Str / 50 Dex`
 *   - `hamm` (War Hammer / Maul / Great Maul): `110 Str / 0 Dex`
 *   - `h2h` / `h2h2` / `knif` / `tkni` / `taxe` / `jave` / `jav`: `75 Str / 75 Dex`
 *   - `tpot`: `0 Str / 0 Dex`
 *   - standard melee weapon types (`swor`, `axe`, `mace`, `club`, `scep`, `pole`, `spea`, `staf`, `wand`, `orb`): `100 Str / 0 Dex`
 */
export function resolveWeaponAttrFactors113c(
  attacker: Pick<
    CombatUnitContext,
    | 'unitType'
    | 'weaponStrBonus'
    | 'weaponDexBonus'
    | 'weaponCode'
    | 'weaponItemType'
    | 'weaponMinPhys'
    | 'weaponMaxPhys'
  >,
  attackKind: 'melee' | 'missile' | 'spell',
  skillId?: number,
): { readonly strBonus: number; readonly dexBonus: number } {
  if (skillId === 97) {
    return { strBonus: 100, dexBonus: 0 }
  }
  if (attacker.weaponStrBonus !== undefined || attacker.weaponDexBonus !== undefined) {
    return {
      strBonus: attacker.weaponStrBonus ?? 0,
      dexBonus: attacker.weaponDexBonus ?? 0,
    }
  }
  const code = (attacker.weaponCode ?? '').trim().toLowerCase()
  if (code !== '') {
    const wb = resolveWeaponBase113c(code)
    if (wb) {
      return { strBonus: wb.strBonus, dexBonus: wb.dexBonus }
    }
  }
  const wType = (attacker.weaponItemType ?? '').trim().toLowerCase()
  if (wType !== '') {
    switch (wType) {
      case 'abow':
      case 'bow':
      case 'xbow':
        return { strBonus: 0, dexBonus: 100 }
      case 'ajav':
      case 'aspe':
        return { strBonus: 80, dexBonus: 50 }
      case 'hamm':
        return { strBonus: 110, dexBonus: 0 }
      case 'h2h':
      case 'h2h2':
      case 'knif':
      case 'tkni':
      case 'taxe':
      case 'jave':
      case 'jav':
        return { strBonus: 75, dexBonus: 75 }
      case 'tpot':
        return { strBonus: 0, dexBonus: 0 }
      default:
        return { strBonus: 100, dexBonus: 0 }
    }
  }
  if (
    attacker.unitType === 'player' &&
    attackKind === 'melee' &&
    attacker.weaponMinPhys === undefined &&
    attacker.weaponMaxPhys === undefined
  ) {
    return { strBonus: 100, dexBonus: 0 }
  }
  return { strBonus: 0, dexBonus: 0 }
}

/**
 * 1.13c Open Wounds (`D2Game.dll` `0x6FCCD410` `ITEMEVENTS_ApplyOpenWounds`, `stat 135`, #1870):
 * - Duration: fixed `200` frames (`8` seconds @ 25Hz).
 * - Base per-frame `256ths` bleed rate by attacker `clvl`:
 *   - `1..15`: `9 * clvl + 31`
 *   - `16..30`: `18 * clvl - 104`
 *   - `31..45`: `27 * clvl - 374`
 *   - `46..60`: `36 * clvl - 779`
 *   - `61..99`: `45 * clvl - 1319`
 * - Target scaling:
 *   - Player target (`PvP`): `/ 4` melee, `/ 8` ranged (`isRanged === true`).
 *   - Boss (`MonStats.boss == 1` / `isBoss` / `isPrimeEvil` / `rank === 'boss'`): `/ 2` (both melee and ranged).
 */
export function calculateOpenWounds113c(params: {
  readonly attackerLvl: number
  readonly isRanged?: boolean | undefined
  readonly defender: Pick<CombatUnitContext, 'unitType' | 'isBoss' | 'isPrimeEvil' | 'rank'>
}): {
  readonly bitrate256: number
  readonly durationFrames: number
  readonly totalDamage256: number
  readonly totalDamage: number
} {
  const clvl = Math.max(1, Math.min(99, Math.trunc(params.attackerLvl)))
  let bitrate256: number
  if (clvl <= 15) {
    bitrate256 = 9 * clvl + 31
  } else if (clvl <= 30) {
    bitrate256 = 18 * clvl - 104
  } else if (clvl <= 45) {
    bitrate256 = 27 * clvl - 374
  } else if (clvl <= 60) {
    bitrate256 = 36 * clvl - 779
  } else {
    bitrate256 = 45 * clvl - 1319
  }
  const isPvpTarget = params.defender.unitType === 'player' || params.defender.unitType === 'party'
  if (isPvpTarget) {
    bitrate256 = Math.trunc(bitrate256 / (params.isRanged ? 8 : 4))
  } else if (
    params.defender.isBoss ||
    params.defender.isPrimeEvil ||
    params.defender.rank === 'boss'
  ) {
    bitrate256 = Math.trunc(bitrate256 / 2)
  }
  bitrate256 = Math.max(0, bitrate256)
  const durationFrames = 200
  const totalDamage256 = bitrate256 * durationFrames
  return {
    bitrate256,
    durationFrames,
    totalDamage256,
    totalDamage: Math.trunc(totalDamage256 / FIXED_ONE),
  }
}

/**
 * 1.13c Poison Length Resist (`D2Game.dll` `0x6FCFCAB0`, `item_poisonlengthresist` `stat 110`, #1871):
 * - Players and hirelings take the `DifficultyLevels.txt` `ResistPenalty` (`0 / -40 / -100`) on `stat 110`.
 * - Effective PLR is clamped to `[-100, 75]`, scaling poison frames by `trunc(rawFrames * (100 - effPlr) / 100)`.
 */
export function computeEffectivePoisonLengthFrames113c(
  rawFrames: number,
  defender: Pick<CombatUnitContext, 'unitType' | 'statList' | 'resistPenalty'>,
): number {
  const baseFrames = Math.trunc(rawFrames)
  if (baseFrames <= 0) return 0
  let plr = Math.trunc(defender.statList.getAccruedStat('item_poisonlengthresist'))
  if (usesPlayerResistBranch113c(defender)) {
    plr += Math.trunc(defender.resistPenalty ?? 0)
  }
  const effPlr = Math.max(-100, Math.min(75, plr))
  return Math.max(1, Math.trunc((baseFrames * (100 - effPlr)) / 100))
}

/**
 * `D2Game.dll` 0x6FC214D0: overflow-guarded `a * b / c` (truncating) used by the steal path.
 * - `c == 0` returns 0;
 * - `b > 0x100000`: `(b / c) * a` unless `c > b >> 4`, which takes the 64-bit product;
 * - `a > 0x10000`: `(a / c) * b` unless `c > a >> 4`, which takes the 64-bit product;
 * - otherwise the 32-bit `a * b / c`.
 */
/**
 * Resistance step of `0x6FCFBD00` (`0x6FCFBD45..0x6FCFBD6A`): for a positive channel with a non-zero
 * effective resistance, `dmg = mulDiv(eax = 100 - min(res, 100), edx = dmg, 100)` through `0x6FC214D0`
 * (divide-first shortcut above 0x100000, i.e. 4096 damage).
 */
export function applyResist113c(dmg256: number, effectiveRes: number): number {
  const dmg = Math.trunc(dmg256)
  const res = Math.trunc(effectiveRes)
  if (dmg <= 0 || res === 0) return dmg
  // Values outside int32 (scripted "kill" damage far beyond anything the game can produce) keep exact
  // arithmetic instead of wrapping like the 32-bit original would.
  if (dmg > 0x7fffffff) return Math.trunc((dmg * (100 - Math.min(res, 100))) / 100)
  return mulDiv113c(100 - Math.min(res, 100), dmg, 100)
}

/**
 * 1.13c Elemental Absorb stat mapping (`D2Game.dll` resistance/absorb descriptor table @ `0x6FD22AB0`,
 * stride `0x2C`, offsets `+0x10` = `absPctStat`, `+0x14` = `absFlatStat`; `ItemStatCost.txt` IDs `142..149`):
 * - Row 1 (`0x6FD22ADC`, Fire `+0x10`): `142` (`item_absorbfire_percent`), `143` (`item_absorbfire`)
 * - Row 2 (`0x6FD22B08`, Ltng `+0x1C`): `144` (`item_absorblight_percent`), `145` (`item_absorblight`)
 * - Row 3 (`0x6FD22B34`, Cold `+0x24`): `148` (`item_absorbcold_percent`), `149` (`item_absorbcold`)
 * - Row 4 (`0x6FD22B60`, Magic `+0x20`): `146` (`item_absorbmagic_percent`), `147` (`item_absorbmagic`)
 * - Row 0 (Phys `+0x08`) and Rows 5..11 (incl. Row 8 Poison `+0x28` @ `0x6FD22C10`): `-1` / `-1` (no absorb).
 */
export const ELEM_ABSORB_STAT_MAP: Readonly<
  Record<string, { readonly pct: string; readonly flat: string }>
> = {
  fire: { pct: 'item_absorbfire_percent', flat: 'item_absorbfire' },
  ltng: { pct: 'item_absorblight_percent', flat: 'item_absorblight' },
  mag: { pct: 'item_absorbmagic_percent', flat: 'item_absorbmagic' },
  cold: { pct: 'item_absorbcold_percent', flat: 'item_absorbcold' },
}

/**
 * 1.13c Elemental Absorb (`D2Game.dll` `SUNITDMG_ApplyAbsorb` @ `0x6FCFAD00..0x6FCFAD88`):
 * 1. Reads `%` absorb stat (`desc->absPctStat` at `+0x10`) and clamps it to `<= 40` (`0x28` at `0x6FCFAD37`).
 *    If `pct > 0`, computes `pctAbsorbed256 = mulDiv(eax = pct, edx = dmg256, 100)` (`0x6FC214D0`, which
 *    divides first for dmg256 > 0x100000), adds it to
 *    `pDamage->dwAbsorbLife` (`+0x48`), and subtracts `pctAbsorbed256` from `dmg256` (`0x6FCFAD48..0x6FCFAD4C`).
 * 2. Reads flat absorb stat (`desc->absFlatStat` at `+0x14`), shifts `flat256 = flat << 8` (`0x6FCFAD66`),
 *    clamps `flatAbsorbed256 = min(dmg256, flat256)` against the post-% remaining `dmg256` (`0x6FCFAD6D..0x6FCFAD75`),
 *    adds `flatAbsorbed256` to `pDamage->dwAbsorbLife`, and subtracts `flatAbsorbed256` from `dmg256`.
 */
export function applyElementalAbsorb113c(
  dmg256: number,
  absorbPctRaw: number,
  absorbFlatRaw256: number,
): {
  readonly remainingDamage256: number
  readonly pctAbsorbed256: number
  readonly flatAbsorbed256: number
  readonly absorbHeal256: number
} {
  let remaining256 = Math.max(0, Math.trunc(dmg256))
  if (remaining256 <= 0) {
    return {
      remainingDamage256: 0,
      pctAbsorbed256: 0,
      flatAbsorbed256: 0,
      absorbHeal256: 0,
    }
  }
  const absorbPct = Math.min(40, Math.max(0, Math.trunc(absorbPctRaw)))
  // 0x6FCFAD2A..0x6FCFAD40: `ecx = 100`, `edx = dmg256`, `eax = pct` -> mulDiv(eax = pct, edx = dmg256).
  const pctAbsorbed256 =
    absorbPct <= 0
      ? 0
      : remaining256 > 0x7fffffff
        ? Math.trunc((remaining256 * absorbPct) / 100)
        : mulDiv113c(absorbPct, remaining256, 100)
  remaining256 = Math.max(0, remaining256 - pctAbsorbed256)

  const flatPool256 = Math.max(0, Math.trunc(absorbFlatRaw256))
  const flatAbsorbed256 = flatPool256 > 0 ? Math.min(remaining256, flatPool256) : 0
  remaining256 = Math.max(0, remaining256 - flatAbsorbed256)

  const absorbHeal256 = pctAbsorbed256 + flatAbsorbed256
  return {
    remainingDamage256: remaining256,
    pctAbsorbed256,
    flatAbsorbed256,
    absorbHeal256,
  }
}

/**
 * D2Game `0x6FC214D0` / D2Common `0x6FD511E0` mul-div (`eax = factor`, `edx = value`, `ecx = divisor`),
 * bit-exact including the divide-first shortcuts and the low-dword 64-bit path; see
 * `src/common/data/mul-div-113c.ts`.
 */
export { mulDiv113c }

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
  life = (life << 6) | 0
  mana = (mana << 6) | 0
  if (params.attackerIsPlayer) {
    if (params.lifeStealDivisor !== 0) life = Math.trunc(life / params.lifeStealDivisor) | 0
    if (params.manaStealDivisor !== 0) mana = Math.trunc(mana / params.manaStealDivisor) | 0
  }
  const phys = params.phys256 | 0
  if (phys <= 0) return none
  const scale = (pct64: number): number => {
    if (pct64 === 0) return 0
    let v = mulDiv113c(pct64, phys, 100)
    if (drain !== 100) v = mulDiv113c(drain, v, 100)
    return Math.trunc(v / 64) | 0
  }
  return { life256: scale(life), mana256: scale(mana) }
}

/**
 * 1.13c `D2Game.dll` `0x6FCFB570` (`SUNITDMG_AddLife`) / `0x6FCFAE70` (`SUNITDMG_AddMana`) delta applied
 * to a unit with current resource `cur256` and cap `max256` (`<= 0` is ignored; `cur + amt >= max` clamps to `max`).
 */
export function applyRawStealDelta256_113c(
  steal256: number,
  cur256 = 256,
  max256 = 0x3fffff00,
): number {
  const amt = steal256 | 0
  if (amt <= 0) return 0
  const cur = cur256 | 0
  const cap = max256 | 0
  let next = (cur + amt) | 0
  if (next >= cap) next = cap
  return (next - cur) | 0
}

/**
 * Canonical 1.13c `HitClass.txt` (`d2exp.mpq` `data\global\excel\HitClass.txt`) row indices (`0..13`).
 */
export const HITCLASS_CODE_TO_ID_113C: Readonly<Record<string, number>> = {
  none: 0,
  '': 0,
  hth: 1,
  '1hss': 2,
  '1hsl': 3,
  '2hss': 4,
  '2hsl': 5,
  '1ht': 6,
  '2ht': 7,
  club: 8,
  staf: 9,
  bow: 10,
  xbow: 11,
  claw: 12,
  over: 13,
}

/**
 * Resolve a `HitClass` identifier (numeric `0..255` or `HitClass.txt` string code `'hth'`, `'1hss'`, etc.)
 * to its numeric 1.13c `dwHitClass` code (`D2Common.dll` `#10862` `0x6FD821E0`).
 */
export function resolveHitClassCode113c(hitClass?: number | string | null): number {
  if (typeof hitClass === 'number') {
    return Number.isFinite(hitClass) && hitClass >= 0 ? Math.trunc(hitClass) : 0
  }
  if (typeof hitClass === 'string') {
    const trimmed = hitClass.trim().toLowerCase()
    if (!trimmed) return 0
    const mapped = HITCLASS_CODE_TO_ID_113C[trimmed]
    if (mapped !== undefined) return mapped
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed) && parsed >= 0) return Math.trunc(parsed)
  }
  return 0
}

/**
 * Resolve the 1.13c GetHit max-life divisor `d` (`8`, `16`, `32`, or `64`) from `dwHitClass`
 * per `D2Game.dll` `SUNITDMG_CheckSkipGetHit` (`0x6FCFB94E..0x6FCFB975`, jump table `0x6FCFBA04`):
 * - `2` (`1hss`), `6` (`1ht`), `10` (`bow`), `11` (`xbow`) -> `8`
 * - `1` (`hth`), `3` (`1hsl`), `7` (`2ht`), `9` (`staf`), `12` (`claw`), default (`0`, `13`, `>=16`) -> `16`
 * - `4` (`2hss`), `8` (`club`) -> `32`
 * - `5` (`2hsl`) -> `64`
 */
export function resolveHitClassDivisor113c(hitClass?: number | string | null): 8 | 16 | 32 | 64 {
  const code = resolveHitClassCode113c(hitClass)
  switch (code) {
    case 2: // 1hss (One Hand Swing vs. Small)
    case 6: // 1ht (One Hand Thrust)
    case 10: // bow (Bow)
    case 11: // xbow (Crossbow)
      return 8
    case 4: // 2hss (Two Hand Swing vs. Small)
    case 8: // club (Club)
      return 32
    case 5: // 2hsl (Two Hand Swing vs. Large)
      return 64
    case 1: // hth (Hand To Hand)
    case 3: // 1hsl (One Hand Swing vs. Large)
    case 7: // 2ht (Two Hand Thrust)
    case 9: // staf (Staff)
    case 12: // claw (Claw)
    default:
      return 16
  }
}

export interface GetHitDefender113c {
  /** Defender max life in 1/256 fixed-point (`D2Common_10913_GetMaxLife`). */
  readonly maxHp256?: number | undefined
  /** Defender max life in integer HP (multiplied by `256` when `maxHp256` and `statList` are omitted). */
  readonly maxHp?: number | undefined
  readonly statList?: Pick<UnitStatList, 'getMaxHp256'> | undefined
  readonly stateBus?: Pick<StateBus, 'hasState'> | undefined
  readonly states?: ReadonlySet<number> | undefined
  readonly frozenTicks?: number | undefined
  readonly isFrozen?: boolean | undefined
  readonly isStunned?: boolean | undefined
  readonly isPurePoison?: boolean | undefined
  readonly unitType?: 'player' | 'mercenary' | 'party' | 'party_mercenary' | 'minion' | 'monster' | 0 | 1 | undefined
  /**
   * `MonStats2.txt` `mGH` mode flag (`dwModeFlags` bit 3 = `0x08`, checked via `D2Game.dll` `0x6FC21560`
   * at `0x6FCFB9D5..0x6FCFB9ED`). Defaults to `true` when omitted.
   */
  readonly hasModeGH?: boolean | undefined
  /**
   * `MonStats.txt` `neverCount` flag (`0x6FCFFA90` at `0x6FCFE180`). When `true`, skips GetHit.
   */
  readonly neverCount?: boolean | undefined
}

export interface GetHitDamageInput113c {
  readonly totalDamage256: number
  readonly poisDamage256?: number | undefined
  readonly isPurePoison?: boolean | undefined
  readonly noHitRecovery?: boolean | undefined
  readonly isPersistentGroundFire?: boolean | undefined
}

/**
 * Evaluate whether `defender` enters GetHit (`GH`) recovery on a hit of `dmg256` with `hitClass`
 * per `D2Game.dll` `SUNITDMG_CheckSkipGetHit` (`0x6FCFB910`..`0x6FCFB9FC`) and caller
 * `SUNITDMG_ExecuteEvents` (`0x6FCFD0FC` / `0x6FCFD3EF`) (`kb/combat/d2game-gethit-recovery-113c.md`):
 *
 * 1. `MonStats.neverCount` (`0x6FCFE180` -> `0x6FCFFA90`): skip (`false`).
 * 2. `STATE_FREEZE (1)` active (`0x6FCFB91A`): skip (`false`).
 * 3. Pure poison damage (`dwPoisDamage != 0 && dwPoisDamage == dwDmgTotal`, `0x6FCFB926`): skip (`false`).
 * 4. Total damage `< 0x100` (`< 256` fixed-point = `< 1` HP, `0x6FCFB932`): skip (`false`).
 * 5. `STATE_STUNNED (21)` active (`0x6FCFD0FC` / `0x6FCFD3EF`): bypass life-threshold RNG rolls and
 *    enter GetHit directly (`true`, subject to monster `MonStats2.mGH`).
 * 6. Life-fraction thresholds using `d = resolveHitClassDivisor113c(hitClass)` (`8 / 16 / 32 / 64`):
 *    - `dmg256 < floor(maxHp256 / d)` -> `false` (`0%`)
 *    - `dmg256 < floor(maxHp256 / (d / 2))` -> if `rng.rand(2) == 0` return `false`; else fall through
 *    - `dmg256 < floor(maxHp256 / (d / 4))` -> if `rng.rand(4) == 0` return `false`
 *    (Effective probabilities: `0%` below `1/d`, `3/8 = 37.5%` in `[1/d, 2/d)`, `3/4 = 75%` in `[2/d, 4/d)`, `100%` at `>= 4/d`.)
 * 7. Monster `MonStats2.mGH` bit 3 (`0x6FCFB9D5` -> `0x6FC21560`): if `hasModeGH === false`, skip (`false`).
 */
export function shouldEnterGetHit113c(
  defender: GetHitDefender113c,
  dmg256OrInput: number | GetHitDamageInput113c,
  hitClass: number | string | null | undefined,
  rng: CombatRng,
): boolean {
  if (!rng || typeof rng.rand !== 'function') {
    throw new Error('shouldEnterGetHit113c: rng is required (D2Game.dll 0x6FCFB910)')
  }
  if (defender.neverCount === true) {
    return false
  }
  if (
    typeof dmg256OrInput !== 'number' &&
    (dmg256OrInput.noHitRecovery || dmg256OrInput.isPersistentGroundFire)
  ) {
    return false
  }
  const dmgTotal256 =
    typeof dmg256OrInput === 'number'
      ? Math.trunc(dmg256OrInput)
      : Math.trunc(dmg256OrInput.totalDamage256)
  const isPurePoison =
    typeof dmg256OrInput === 'number'
      ? Boolean(defender.isPurePoison)
      : Boolean(
          dmg256OrInput.isPurePoison ||
            defender.isPurePoison ||
            (dmg256OrInput.poisDamage256 !== undefined &&
              dmg256OrInput.poisDamage256 !== 0 &&
              Math.trunc(dmg256OrInput.poisDamage256) === dmgTotal256),
        )

  // 1. 0x6FCFB91A: D2Common_10494_CheckUnitState(pDefender, STATE_FREEZE=1)
  const isFrozen = Boolean(
    defender.isFrozen ||
      (defender.frozenTicks !== undefined && defender.frozenTicks > 0) ||
      defender.states?.has(1) ||
      defender.states?.has(29) ||
      defender.stateBus?.hasState('freeze') ||
      defender.stateBus?.hasState(1),
  )
  if (isFrozen) {
    return false
  }

  // 2. 0x6FCFB926: pure poison damage never triggers GetHit
  if (isPurePoison) {
    return false
  }

  // 3. 0x6FCFB932: total damage < 0x100 (< 1 HP in 256ths) never triggers GetHit
  if (dmgTotal256 < FIXED_ONE) {
    return false
  }

  // 4. 0x6FCFB9D5..0x6FCFB9ED: Monster MonStats2.mGH (bit 3 = 0x08) check
  const hasModeGH = defender.hasModeGH !== false

  // 5. 0x6FCFD0FC / 0x6FCFD3EF: STATE_STUNNED (21) forces GetHit without calling SUNITDMG_CheckSkipGetHit
  const isStunned = Boolean(
    defender.isStunned ||
      defender.states?.has(21) ||
      defender.stateBus?.hasState('stunned') ||
      defender.stateBus?.hasState('stun') ||
      defender.stateBus?.hasState(21),
  )
  if (isStunned) {
    return hasModeGH
  }

  // 6. 0x6FCFB948..0x6FCFB975: Max life & HitClass divisor d (8 / 16 / 32 / 64)
  const maxHp256 =
    defender.maxHp256 !== undefined
      ? Math.trunc(defender.maxHp256)
      : defender.statList
        ? Math.trunc(defender.statList.getMaxHp256())
        : defender.maxHp !== undefined
          ? Math.trunc(defender.maxHp * FIXED_ONE)
          : 0
  if (maxHp256 <= 0) {
    return false
  }

  const d = resolveHitClassDivisor113c(hitClass)

  // 0x6FCFB97A..0x6FCFB982: dmg < maxHp / d -> skip (0%)
  const thresh1 = Math.trunc(maxHp256 / d)
  if (dmgTotal256 < thresh1) {
    return false
  }

  // 0x6FCFB988..0x6FCFB9AB: dmg < maxHp / (d / 2) -> roll rand(2); if 0 skip, if 1 fall through!
  const thresh2 = Math.trunc(maxHp256 / Math.trunc(d / 2))
  if (dmgTotal256 < thresh2) {
    if (boundedRand(rng, 2) === 0) {
      return false
    }
  }

  // 0x6FCFB9AD..0x6FCFB9D3: dmg < maxHp / (d / 4) -> roll rand(4); if 0 skip
  const thresh4 = Math.trunc(maxHp256 / Math.trunc(d / 4))
  if (dmgTotal256 < thresh4) {
    if (boundedRand(rng, 4) === 0) {
      return false
    }
  }

  return hasModeGH
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
  const seedRng113c: CombatRng | undefined =
    packet.d2AttackerSeed113c !== undefined
      ? { rand: (n: number) => rollLimitedSeed113c(packet.d2AttackerSeed113c!, n) }
      : undefined
  const defenderSeedRng113c: CombatRng | undefined =
    packet.d2DefenderSeed113c !== undefined
      ? { rand: (n: number) => rollLimitedSeed113c(packet.d2DefenderSeed113c!, n) }
      : undefined
  const resolvedRng = seedRng113c ?? rng ?? packet.rng
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
  const atkWType = (attacker.weaponItemType ?? '').trim()
  if (
    (packet.skillId === 96 ||
      packet.skillId === 106 ||
      packet.skillId === 107 ||
      packet.skillId === 111 ||
      packet.skillId === 116) &&
    ((atkWType !== '' && !itemTypeIsA(atkWType, 'mele')) ||
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
  const isThrowAttack =
    packet.skillId === 2 ||
    packet.skillId === 4 ||
    packet.skillId === 140 ||
    Boolean(attacker.isThrowing && attackKind !== 'melee' && attackKind !== 'spell')
  const isMeleeWeaponAttack =
    !isThrowAttack &&
    (attackKind === 'melee' || packet.skillId === 266) &&
    packet.skillId !== 97 &&
    packet.skillId !== 1
  let barMasteryArBonusPct = 0
  let barMasteryEdBonusPct = 0
  let barMasteryCritPct: number | undefined
  const warnings: string[] = []
  const getLearnedMasterySlvl = (mId: number): number => {
    const passiveLvl = attacker.passiveSkills?.get(mId) ?? 0
    if (passiveLvl > 0) return passiveLvl
    const baseLvl = attacker.statList.getBaseSkillLevel(mId)
    if (baseLvl > 0 || attacker.statList.getBonusSkillLevel(mId) > 0) {
      return attacker.statList.getEffectiveSkillLevel(mId)
    }
    const stateName = BAR_MASTERY_STATES[mId]
    if (stateName && attacker.stateBus.hasState(stateName)) {
      return attacker.stateBus.getState(stateName)?.slvl ?? 0
    }
    return 0
  }
  if (isThrowAttack) {
    barMasteryCritPct = 0
    const slvl135 = getLearnedMasterySlvl(135)
    if (slvl135 > 0) {
      const wType =
        packet.skillId === 4
          ? (attacker.offHandWeaponItemType ?? attacker.offHandWeaponType ?? attacker.weaponItemType)
          : attacker.weaponItemType
      if (!wType || wType.trim() === '') {
        warnings.push('mastery_skipped_missing_weapon_type')
      } else if (isWeaponMatchingMastery(wType, 135)) {
        const mStats = evaluateBarbarianMastery(135, slvl135) as WeaponMasteryStats
        barMasteryArBonusPct = mStats.attackRatingBonusPct
        barMasteryEdBonusPct = mStats.damageBonusPct
        barMasteryCritPct = mStats.criticalStrikeChancePct
      }
    }
  } else if (isMeleeWeaponAttack) {
    barMasteryCritPct = 0
    const meleeMasteryIds = [127, 128, 129, 134, 136] as const
    const hasAnyMeleeMastery = meleeMasteryIds.some(id => getLearnedMasterySlvl(id) > 0)
    const slvl252 = getLearnedMasterySlvl(252)
    const wType =
      packet.skillId === 5
        ? (attacker.offHandWeaponItemType ?? attacker.offHandWeaponType ?? attacker.weaponItemType)
        : attacker.weaponItemType
    if (hasAnyMeleeMastery || slvl252 > 0) {
      if (!wType || wType.trim() === '') {
        warnings.push('mastery_skipped_missing_weapon_type')
      } else {
        if (hasAnyMeleeMastery) {
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
        }
        if (slvl252 > 0 && isWeaponMatchingMastery(wType, 252)) {
          const cmAr = 30 + (slvl252 - 1) * 10
          const cmEd = 35 + (slvl252 - 1) * 4
          // Claw Mastery #252 passivecalc3 = dm56 (0, 25) → D2Common 0x6FD9DC30 (issue #1678).
          const cmCrit = computeDiminishingReturns(0, 25, slvl252)
          barMasteryArBonusPct = Math.max(barMasteryArBonusPct, cmAr)
          barMasteryEdBonusPct = Math.max(barMasteryEdBonusPct, cmEd)
          barMasteryCritPct = Math.max(barMasteryCritPct ?? 0, cmCrit)
        }
      }
    }
  }

  // 1. RollToHit check for weapon attacks (unless autoHit, e.g. Smite 97 / Guided Arrow 22 / Spells,
  // or when defender is a running player hit by a MELEE attack: `D2Game.dll` `0x6FCFE006` / `0x6FCFE2B0`
  // skips `RollToHit` ONLY for melee vs `PLRMODE_RUN`, whereas ranged missiles still roll `RollToHit` #1865).
  // D2Game.dll 0x6FCFE011: draws an independent rng.rand(100) against clamped toHitChance [5..95].
  const defAnyForRun = defender as unknown as Record<string, unknown>
  const isPlayerLikeDefender =
    defender.unitType === 'player' ||
    defender.unitType === 'party' ||
    (defender.unitType === undefined && defender.statList.getOwnerType() === 'player')
  const isDefenderRunningPlayer =
    (defender.unitType === 'player' || defender.unitType === 'party' || isPlayerLikeDefender) &&
    (defender.isRunning === true ||
      defAnyForRun['isRunning'] === true ||
      (defender.isMoving === true &&
        defender.isWalking !== true &&
        defAnyForRun['isWalking'] !== true))
  const isAutoHit =
    packet.autoHit ??
    (packet.skillId === 97 ||
      packet.skillId === 22 ||
      attackKind === 'spell' ||
      (attackKind === 'melee' && isDefenderRunningPlayer))
  if (!isAutoHit) {
    // 1.13c D2Game.dll (0x6FCFDE90, 0x6FCB29D4 Dragon Tail, 0x6FCB2ABF Dragon Claw, 0x6FCB2BCB Dragon Talon,
    // 0x6FCB37B7 Dragon Flight, 0x6FCC2D26 Attack/Left Hand Swing):
    // Single additive `%AR` pool = `item_tohit_percent` (119) + `packet.toHitBonusPct` + `barMasteryArBonusPct`
    // + `progressive_tohit` (325) + `attack_vs_montype` (179) (#1625, #1626).
    const progressiveToHitBonusPct =
      attackKind === 'melee' ? attacker.statList.getAccruedStat('progressive_tohit') : 0
    const itemToHitPct = attacker.statList.getAccruedStat('item_tohit_percent')
    const monTypeArPct = attacker.statList.getAccruedStat('attack_vs_montype')
    const effectiveToHitBonusPct =
      (packet.toHitBonusPct ?? 0) + barMasteryArBonusPct + progressiveToHitBonusPct + monTypeArPct
    const isTargetPlayerOrMerc =
      isPlayerLikeDefender ||
      defender.unitType === 'mercenary' ||
      defender.unitType === 'party_mercenary'
    const isTargetBossOrSuperUnique = Boolean(
      defender.isBoss ||
        defender.isPrimeEvil ||
        defender.isSuperUnique ||
        defender.rank === 'boss' ||
        defender.rank === 'superunique',
    )
    const blocksIgnoreTargetDefense =
      isTargetPlayerOrMerc ||
      isTargetBossOrSuperUnique ||
      Boolean(
        defender.isChampion ||
          defender.rank === 'champion' ||
          defender.rank === 'unique',
      )
    const halvesFractionalTargetAc = isTargetPlayerOrMerc || isTargetBossOrSuperUnique
    const rawDefenderDef = isPlayerLikeDefender
      ? defender.statList.getDefense({ includeDexterityBonus: !defender.armorClassIncludesDex })
      : defender.statList.getAccruedStat('armorclass')
    const toHitChance = computeToHitChance({
      attackerAr: attacker.statList.getRawToHit113c(),
      defenderDef: isDefenderRunningPlayer ? 0 : rawDefenderDef,
      attackerLvl: attacker.statList.getAccruedStat('level'),
      defenderLvl: defender.statList.getAccruedStat('level'),
      skillArBonusPct: effectiveToHitBonusPct,
      itemArBonusPct: itemToHitPct,
      demonToHit: attacker.statList.getAccruedStat('item_demon_tohit'),
      undeadToHit: attacker.statList.getAccruedStat('item_undead_tohit'),
      isTargetDemon: Boolean(defender.isDemon),
      isTargetUndead: Boolean(defender.isUndead),
      ignoreTargetAc: attacker.statList.getAccruedStat('item_ignoretargetac') > 0,
      fractionalTargetAc: attacker.statList.getAccruedStat('item_fractionaltargetac'),
      blocksIgnoreTargetDefense,
      halvesFractionalTargetAc,
      defenderAcVsMissile: isDefenderRunningPlayer
        ? 0
        : defender.statList.getAccruedStat('armorclass_vs_missile'),
      defenderAcVsHth: isDefenderRunningPlayer
        ? 0
        : defender.statList.getAccruedStat('armorclass_vs_hth'),
      attackKind,
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

  // 2. Avoidance & Block (Smite `97` bypasses both block and dodge; `unblockable` skips Shield Block while
  // still allowing `Evade` / dual-claw `Weapon Block` / `Avoid` on projectile spells per D2Game.dll 0x6FCFB790 / 0x6FCFB030).
  // Draws on `pDefender->pSeed` (`0x6FCFB7F5` / `0x6FCFB0DE`), never `pAttacker->pSeed` or reusing hitRoll.
  const avoidCheck =
    hpBefore256 <= 0 && packet.d2AttackerSeed113c !== undefined
      ? { avoided: false as const }
      : evaluateAvoidanceAndBlock({
          defender,
          attackKind,
          rng: defenderSeedRng113c ?? rng ?? packet.rng ?? resolvedRng,
          skillId: packet.skillId,
          unblockable: packet.unblockable ?? packet.skillId === 97,
          unavoidable: packet.unavoidable ?? packet.skillId === 97,
          isPersistentGroundFire: Boolean(
            packet.isPersistentGroundFire ??
              (packet as unknown as Record<string, unknown>)['isPersistentGroundFire'],
          ),
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
  let baseWeapPhysWithoutNormal256 = 0
  let isCritical = false
  if (!isSpellWithoutFlatPhys && (srcDam > 0 || hasFlatPhys || packet.skillId === 97)) {
    const flatMin256 = Math.max(0, Math.trunc(packet.flatPhysMin256 ?? 0))
    const flatMax256 = Math.max(flatMin256, Math.trunc(packet.flatPhysMax256 ?? flatMin256))
    let dmgPctBonus = attacker.statList.getModifierBonus('damagepercent')
    const fanatState = attacker.stateBus.getState('fanaticism')
    if (
      fanatState &&
      fanatState.stats['is_ally'] !== 1 &&
      Boolean(
        packet.isAlly ||
          attacker.unitType === 'party' ||
          attacker.unitType === 'mercenary' ||
          attacker.unitType === 'party_mercenary',
      )
    ) {
      const fanatModEd = fanatState.stats['damagepercent'] ?? 0
      dmgPctBonus -= fanatModEd - Math.trunc(fanatModEd / 2)
    }

    if (attackKind === 'spell') {
      baseWeapPhysWithoutNormal256 = rollDamageRange256(flatMin256, flatMax256, resolvedRng)
      baseWeapPhys256 = baseWeapPhysWithoutNormal256
      rawPhys256 = packet.physDamagePct
        ? Math.max(0, Math.trunc((baseWeapPhys256 * Math.max(10, 100 + packet.physDamagePct)) / 100))
        : baseWeapPhys256
    } else if (packet.skillId === 97) {
      // 1.13c `#97 Smite` (`SKILLS_SrvDo150_Smite` @ `0x6FCB87D0`, #1868):
      // - Base = shield `SmiteDmg` + `#117 Holy Shield` bonus + `stat 111 item_normaldamage` (Grief `+Damage`).
      // - Excludes weapon/charm `+Min/+Max` (`stats 21/22`), Demon/Undead `%ED` (`stats 121/122/180`), and CS/DS.
      let smiteMin256 = 0
      let smiteMax256 = 0
      if (hasFlatPhys) {
        smiteMin256 = flatMin256
        smiteMax256 = flatMax256
      } else if (attacker.smiteMinDam !== undefined || attacker.smiteMaxDam !== undefined) {
        const sMin = Math.max(0, Math.trunc(attacker.smiteMinDam ?? 0))
        const sMax = Math.max(sMin, Math.trunc(attacker.smiteMaxDam ?? sMin))
        smiteMin256 = sMin * FIXED_ONE
        smiteMax256 = sMax * FIXED_ONE
      } else if (attacker.weaponMinPhys !== undefined || attacker.weaponMaxPhys !== undefined) {
        const sMin = Math.max(0, Math.trunc(attacker.weaponMinPhys ?? 0))
        const sMax = Math.max(sMin, Math.trunc(attacker.weaponMaxPhys ?? sMin))
        smiteMin256 = sMin * FIXED_ONE
        smiteMax256 = sMax * FIXED_ONE
      } else {
        smiteMin256 = FIXED_ONE
        smiteMax256 = 2 * FIXED_ONE
      }
      if (!hasFlatPhys && !packet.includesNormalDamage && !packet.preScaledPhysEd) {
        if (attacker.stateBus.hasState('holyshield') || attacker.stateBus.hasState(101)) {
          const hsState = attacker.stateBus.getState('holyshield') ?? attacker.stateBus.getState(101)
          const hsLvl = Math.max(1, hsState?.slvl ?? attacker.statList.getEffectiveSkillLevel(117) ?? 1)
          smiteMin256 += compute5BandScaling(hsLvl, 3, 2, 3, 4, 4, 4) * FIXED_ONE
          smiteMax256 += compute5BandScaling(hsLvl, 6, 2, 3, 4, 4, 4) * FIXED_ONE
        }
        const smiteNormalDmg = attacker.statList.getAccruedStat('item_normaldamage')
        const smiteNormalDmg256 = smiteNormalDmg * FIXED_ONE
        if (smiteNormalDmg256 !== 0) {
          smiteMin256 = Math.max(0, smiteMin256 + smiteNormalDmg256)
          smiteMax256 = Math.max(smiteMin256, smiteMax256 + smiteNormalDmg256)
        }
      }
      baseWeapPhys256 = rollDamageRange256(smiteMin256, smiteMax256, resolvedRng)
      baseWeapPhysWithoutNormal256 = baseWeapPhys256
      if (packet.preScaledPhysEd) {
        rawPhys256 = baseWeapPhys256
      } else if (hasFlatPhys && packet.physDamagePct === undefined) {
        rawPhys256 =
          dmgPctBonus !== 0
            ? Math.max(0, Math.trunc((baseWeapPhys256 * Math.max(10, 100 + dmgPctBonus)) / 100))
            : baseWeapPhys256
      } else {
        const smiteStrEd = packet.skipAttrEd
          ? 0
          : Math.trunc((attacker.statList.getAccruedStat('strength') * 100) / 100)
        const smiteEdPct = Math.max(-90, (packet.physDamagePct ?? 0) + dmgPctBonus + smiteStrEd)
        rawPhys256 = Math.max(0, Math.trunc((baseWeapPhys256 * (100 + smiteEdPct)) / 100))
      }
    } else if (packet.unrolledWeaponBase113c !== undefined) {
      // 1.13c `D2Game.dll` `0x6FCFC530..0x6FCFC71F` + `SUNITDMG_RollDamageValue` (`0x6FCFCD80` -> `0x6FCFBED0`):
      // Scale `min256` and `max256` by the combined `%ED` pool FIRST in 256-fixed point, then draw
      // a single `RAND_RollLimited(&pAttacker->pSeed, scaledMax256 - scaledMin256)` exclusive roll.
      const uwb = packet.unrolledWeaponBase113c
      const targetTypeEdPct =
        (defender.isUndead ? attacker.statList.getAccruedStat('item_undeaddamage_percent') : 0) +
        (defender.isDemon ? attacker.statList.getAccruedStat('item_demondamage_percent') : 0) +
        attacker.statList.getAccruedStat('damage_vs_montype')
      const totalEdPct = Math.max(-90, uwb.edPct + targetTypeEdPct)
      const scaledMin256 = Math.max(
        FIXED_ONE,
        uwb.min256 + Math.trunc((uwb.min256 * totalEdPct) / 100),
      )
      const scaledMax256 = Math.max(
        scaledMin256,
        uwb.max256 + Math.trunc((uwb.max256 * totalEdPct) / 100),
      )
      const span256 = scaledMax256 - scaledMin256
      const rolledWeap256 =
        span256 > 0 ? scaledMin256 + resolvedRng.rand(span256) : scaledMin256
      rawPhys256 =
        uwb.srcDam === 128
          ? rolledWeap256
          : Math.max(0, Math.trunc((rolledWeap256 * uwb.srcDam) / 128))
      baseWeapPhysWithoutNormal256 = rawPhys256
      baseWeapPhys256 = rawPhys256

      const csChance = Math.min(100, Math.max(0, attacker.statList.getAccruedStat('passive_critical_strike')))
      const rawMasteryCrit = barMasteryCritPct ?? 0
      const masteryCritChance = Math.min(100, Math.max(0, rawMasteryCrit))
      const dsChance = Math.min(100, Math.max(0, attacker.statList.getAccruedStat('item_deadlystrike')))
      if (masteryCritChance > 0) {
        const masteryRoll = packet.masteryCritRoll100 ?? packet.critRoll100 ?? resolvedRng.rand(100)
        if (masteryRoll < masteryCritChance) isCritical = true
      }
      if (!isCritical && csChance > 0) {
        const csRoll = packet.csRoll100 ?? packet.critRoll100 ?? resolvedRng.rand(100)
        if (csRoll < csChance) isCritical = true
      }
      if (!isCritical && dsChance > 0) {
        const dsRoll = packet.dsRoll100 ?? packet.critRoll100 ?? resolvedRng.rand(100)
        if (dsRoll < dsChance) isCritical = true
      }
      if (isCritical) {
        rawPhys256 *= 2
      }
    } else {
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
      const totalBaseMin256 = Math.max(0, scaledWeapMin256 + flatMin256)
      const totalBaseMax256 = Math.max(totalBaseMin256, scaledWeapMax256 + flatMax256)
      baseWeapPhysWithoutNormal256 = rollDamageRange256(totalBaseMin256, totalBaseMax256, resolvedRng)
      const normalDmgStat =
        !packet.includesNormalDamage && !packet.preScaledPhysEd && effectiveSrcDam > 0
          ? attacker.statList.getAccruedStat('item_normaldamage')
          : 0
      const scaledNormal256 =
        normalDmgStat !== 0 ? Math.trunc((normalDmgStat * FIXED_ONE * effectiveSrcDam) / 128) : 0
      baseWeapPhys256 = Math.max(0, baseWeapPhysWithoutNormal256 + scaledNormal256)

      const targetTypeEdPct =
        (defender.isUndead ? attacker.statList.getAccruedStat('item_undeaddamage_percent') : 0) +
        (defender.isDemon ? attacker.statList.getAccruedStat('item_demondamage_percent') : 0) +
        attacker.statList.getAccruedStat('damage_vs_montype')
      if (packet.preScaledPhysEd) {
        rawPhys256 =
          targetTypeEdPct !== 0
            ? Math.max(0, Math.trunc((baseWeapPhys256 * Math.max(10, 100 + targetTypeEdPct)) / 100))
            : baseWeapPhys256
      } else {
        const shouldApplyAttrEd =
          !packet.skipAttrEd &&
          (effectiveSrcDam > 0 ||
            (!hasFlatPhys &&
              (attacker.weaponStrBonus !== undefined ||
                attacker.weaponDexBonus !== undefined ||
                Boolean(attacker.weaponCode) ||
                Boolean(attacker.weaponItemType))) ||
            (hasFlatPhys &&
              (attacker.weaponStrBonus !== undefined || attacker.weaponDexBonus !== undefined)))
        const { strBonus: strFactor, dexBonus: dexFactor } = shouldApplyAttrEd
          ? resolveWeaponAttrFactors113c(attacker, attackKind, packet.skillId)
          : { strBonus: 0, dexBonus: 0 }
        const attrEdBonus =
          (strFactor > 0 ? Math.trunc((attacker.statList.getAccruedStat('strength') * strFactor) / 100) : 0) +
          (dexFactor > 0 ? Math.trunc((attacker.statList.getAccruedStat('dexterity') * dexFactor) / 100) : 0)
        // 1.13c `D2Game.dll` `0x6FCFC530..0x6FCFC71F`: single additive `%ED` pool clamped at `>= -90` (#1628, #1867).
        const edPct = Math.max(
          -90,
          (packet.physDamagePct ?? 0) +
            (packet.skipMasteryEd ? 0 : barMasteryEdBonusPct) +
            dmgPctBonus +
            attrEdBonus +
            targetTypeEdPct,
        )
        rawPhys256 = Math.max(0, Math.trunc((baseWeapPhys256 * (100 + edPct)) / 100))
      }

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
          rawPhys256 = baseWeapPhysWithoutNormal256
        } else {
          const str = attacker.statList.getAccruedStat('strength')
          const dex = attacker.statList.getAccruedStat('dexterity')
          const bootMin = attacker.bootMinDam ?? attacker.kickMinDam ?? 0
          const bootMax = attacker.bootMaxDam ?? attacker.kickMaxDam ?? 0
          const skillED = packet.skillId === 255 || packet.skillId === 275 ? (packet.physDamagePct ?? 0) : 0
          const offWeaponED = dmgPctBonus
          const attrMin = Math.max(1, Math.floor(Math.max(0, dex + str - 20) / 4))
          const attrMax = Math.max(2, Math.floor(Math.max(0, dex + str - 20) / 3))
          const strBootBonus = Math.floor((str * 120) / 100)
          const attrEdMult = Math.max(10, 100 + skillED)
          const bootEdMult = Math.max(10, 100 + strBootBonus + offWeaponED + skillED)
          const kMin =
            Math.floor((attrMin * attrEdMult) / 100) +
            Math.floor((bootMin * bootEdMult) / 100)
          const kMax =
            Math.floor((attrMax * attrEdMult) / 100) +
            Math.floor((bootMax * bootEdMult) / 100)
          rawPhys256 = rollDamageRange256(kMin * FIXED_ONE, kMax * FIXED_ONE, resolvedRng)
        }
      }

      // 3b. 1.13c Weapon Mastery Crit (`0x6FCFD549`), Critical Strike (`0x6FCFD573`),
      //     and Deadly Strike (`0x6FCFD59D`) sequential evaluation (`D2Game.dll` `0x6FCFD51A..0x6FCFD5A6`, #1873).
      //     Triggered BEFORE physical-to-elemental conversion; mutually exclusive (never 4x/8x).
      //     Each stage draws its own independent `rng.rand(100)` roll only if the previous stage did not proc!
      //     NOTE: Smite (`skillId === 97`, `SKILLS_SrvDo150_Smite` @ `0x6FCB9000`) and Kick skills
      //     (`#1, #255, #270, #275`, `SKILLS_CalculateKickDamage` @ `0x6FC9AE10`) do NOT call
      //     `SUNITDMG_FillDamageValues` and strictly CANNOT Critical Strike or Deadly Strike!
      if (!isKickPacket) {
        const csChance = Math.min(100, Math.max(0, attacker.statList.getAccruedStat('passive_critical_strike')))
        const rawMasteryCrit = barMasteryCritPct ?? 0
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
  let addedEnchantRider = false
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
    if (attacker.stateBus.hasState('enchant') && !packet.elemMin256 && !packet.elemMax256) {
      const ench = attacker.stateBus.getState('enchant')
      const eMin = Math.max(0, ench?.stats['firemindam'] ?? 0)
      const eMax = Math.max(eMin, ench?.stats['firemaxdam'] ?? eMin)
      if (eMax > 0) {
        rawElem256 += rollDamageRange256(eMin * FIXED_ONE, eMax * FIXED_ONE, resolvedRng)
        addedEnchantRider = true
        if (!packet.elemType) {
          elemType = 'fire'
        }
      }
    }
  }

  const isEnchantFire = Boolean(packet.isEnchant || packet.skillId === 52 || addedEnchantRider)
  if (isEnchantFire && attackKind === 'missile' && elemType === 'fire') {
    // 1.13c Param3 = 33: Ranged attacks (bow/crossbow/throwing) receive only 33% of Enchant fire damage bonus
    rawElem256 = Math.trunc((rawElem256 * 33) / 100)
  }

  if (rawElem256 > 0 && !packet.skipElemMastery) {
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
        (concState?.stats['damagepercent'] ?? 0)
      if (concPct > 0) {
        rawElem256 = Math.trunc((rawElem256 * (100 + Math.trunc(concPct / 2))) / 100)
      }
    }
    if (defender.isUndead) {
      rawElem256 = Math.trunc((rawElem256 * 150) / 100)
    }
  }

  // 1.13c `SUNITDMG_FillDamageValues` (`0x6FCFD450`) tail for a MONSTER attacker on the oracle seed path
  // (`kb/combat/d2game-sunitdmg-player-defender-113c.md` §3):
  // - `0x6FCFD8F0..0x6FCFD926`: unconditional `0x6FC211D0(&pAttacker->pSeed, 1)` (one LCG step, value 0);
  // - `0x6FCFDA6C` -> `0x6FC970E0`: `MonStats.crit` (`+0xA6`) > 0 -> `pAttacker->pSeed % 100 < crit` doubles
  //   phys / fire / ltng / magic / cold / poison (`+0x08 +0x10 +0x1C +0x20 +0x24 +0x28`) and ORs `0x10` into
  //   the hit class (`+0x60`) when its upper nibble is empty.
  // Both happen before `SUNITDMG_ApplyDamage` (`0x6FCFC0B0`) applies resistances.
  let fillDamageTailDone113c = false
  let monsterCrit113c = false
  if (packet.d2AttackerSeed113c !== undefined && packet.monStatsCritPct113c !== undefined) {
    resolvedRng.rand(1)
    fillDamageTailDone113c = true
    const critPct = packet.monStatsCritPct113c
    if (critPct > 0 && resolvedRng.rand(100) < critPct) {
      monsterCrit113c = true
      rawPhys256 *= 2
      rawElem256 *= 2
    }
  }

  // 6. Resistances & 1/5 Immunity Breaking
  const curseAmpPierce = resolvePhysCursePierce113c(defender)

  let physResRec = computeEffectiveResistance({
    baseRes: getPrePierceResistance113c(defender.statList, 'damageresist'),
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

  const curseLrPierce = isElemPiercableByLR
    ? resolveLowerResistPierce113c(defender, resStatKey as 'fireresist' | 'lightresist' | 'coldresist' | 'poisonresist')
    : 0
  const auraConvictionPierce = isElemPiercableByConviction
    ? resolveConvictionPierce113c(defender, resStatKey as 'fireresist' | 'lightresist' | 'coldresist')
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
    baseRes: getPrePierceResistance113c(defender.statList, resStatKey),
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
  // Against non-undead enemies (`!defender.isUndead`), Holy Bolt (#101) passes through and deals 0 damage (#1943).
  if (packet.skillId === 101 && !defender.isUndead) {
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

  // 6.1 Unit-vs-Unit / PvP Damage Modifier FIRST (`D2Game.dll` `0x6FCFC17F` -> `SUNITDMG_GetDamagePercentModifier` `0x6FCFAC10`, #1631 / #1795):
  // Scales damage by `17%` for Player/Merc/Minion vs Player and `25%` for Merc vs Merc BEFORE `absorbdamage`
  // (`Energy Shield`, `Bone Armor`, `Cyclone Armor`), `PDR/MDR`, `Resistances`, and `Absorb`!
  // Preserve `prePvpRawPhys256` for Sacrifice self-recoil (`0x6FCB9290`) and `damagedinmelee` Thorns reflection
  // (`0x6FCFBA40`, which applies its own `1/4` PvP divisor).
  const prePvpRawPhys256 = rawPhys256
  const pvpDmgModPct = damagePercentModifier113c(attacker, defender)
  if (pvpDmgModPct !== 100) {
    rawPhys256 = Math.trunc((rawPhys256 * pvpDmgModPct) / 100)
    rawElem256 = Math.trunc((rawElem256 * pvpDmgModPct) / 100)
  }

  // 6.2 Reactive `auraeventfunc` shields (`Energy Shield`, `Bone Armor`, `Cyclone Armor`) absorb BEFORE PDR/MDR & resistances (`0x6FCFC0EC`)
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

  const isSanctuaryBypassUndead = Boolean(
    (attacker.stateBus.hasState('sanctuary') ||
      attacker.statList.getAccruedStat('skill_bypass_undead') > 0) &&
      defender.isUndead &&
      attackKind !== 'spell',
  )

  // 6.3 Integer PDR (`stat 34`) & MDR (`stat 35`) with frame-based `damagerate` scaling (`D2Game.dll` `0x6FCFC13B..0x6FCFC177`, #1795):
  // Continuous per-frame ground fire / stream missiles scale flat PDR/MDR by `dwFrameRate / 1024` (or fractional `frameScalar < 1`).
  const scaleFlatDrByFrameRate = (dr256: number): number => {
    if (dr256 <= 0) return 0
    const rate = packet.frameRate1024 ?? packet.damageRate ?? packet.frameScalar
    if (rate === undefined || rate <= 0) return dr256
    if (rate < 1) return Math.max(0, Math.trunc(dr256 * rate))
    // 0x6FCFC13B..0x6FCFC147: mulDiv(eax = pDamage+0x54 rate, edx = stat << 8, ecx = 0x400).
    return Math.max(0, mulDiv113c(Math.trunc(rate), dr256, 1024))
  }
  const flatPhysDr256 = isSanctuaryBypassUndead
    ? 0
    : scaleFlatDrByFrameRate(
        Math.max(0, defender.statList.getAccruedStat('normal_damage_reduction')) * FIXED_ONE,
      )
  const flatMagicDr256 =
    elemType === 'pois'
      ? 0
      : scaleFlatDrByFrameRate(
          Math.max(0, defender.statList.getAccruedStat('magic_damage_reduction')) * FIXED_ONE,
        )

  const afterShieldPhys256 = Math.max(0, rawPhys256 - reactive.absorbedPhys256)
  const afterShieldElem256 = Math.max(0, rawElem256 - reactive.absorbedElem256)
  const remRawPhys256 = Math.max(0, afterShieldPhys256 - flatPhysDr256)
  // 1.13c DR overflow (`0x6FCFBD41..0x6FCFBD47` row 0, total at `0x6FCFC4F7..0x6FCFC519`): a positive physical
  // channel driven below 0 by flat DR skips resistance and stays negative, and `dwDmgTotal` (+0x4C) is the
  // signed sum of all channels, so the overflow eats into the elemental damage of the same hit.
  const physDrOverflow256 = afterShieldPhys256 > 0 ? Math.max(0, flatPhysDr256 - afterShieldPhys256) : 0

  // Compute un-PvP-scaled post-PDR/Res physical damage solely for `damagedinmelee` Thorns reflection (#1631)
  const prePvpAfterShieldPhys256 = Math.max(0, prePvpRawPhys256 - reactive.absorbedPhys256 - flatPhysDr256)
  const prePvpFinalPhys256 = physResRec.isImmune
    ? 0
    : Math.max(0, applyResist113c(prePvpAfterShieldPhys256, physResRec.effectiveRes))

  // 1.13c MDR Overflow Spill (`D2Game.dll` `0x6FCFBD41..0x6FCFBD47` + `0x6FCFAD6D..0x6FCFAD7C` + `0x6FCFC50A`, #1795):
  // When an active non-poison elemental channel (`afterShieldElem256 > 0`) has `flatMagicDr256` subtracted below 0,
  // `0x6FCFBD47` (`jle`) skips resistance & `%` absorb (`0x6FCFAD16`), then reaches flat absorb (`0x6FCFAD4D`):
  // - If `flatAbsorb == 0`, the negative channel value stays in `pDamage` (`raw[4/7/8/9]`) and subtracts from `dwDmgTotal`.
  // - If `flatAbsorb > 0`, `min(flatAbsorb, esi) == esi` (negative), cancelling `esi` to `0` and adding negative `esi` to `dwAbsorbLife`.
  let mdrOverflow256 = 0
  let remRawElem256 = 0
  let negElemTrace256 = 0
  let negElemAbsorbDelta256 = 0
  if (afterShieldElem256 > 0) {
    if (elemType === 'pois') {
      remRawElem256 = afterShieldElem256
    } else {
      const signedElemAfterMdr256 = afterShieldElem256 - flatMagicDr256
      if (signedElemAfterMdr256 <= 0) {
        remRawElem256 = 0
        let remNeg256 = signedElemAfterMdr256
        const negAbsPair = elemType ? ELEM_ABSORB_STAT_MAP[elemType] : undefined
        if (negAbsPair !== undefined && packet.skillId !== 42 && !isSanctuaryBypassUndead) {
          const negPct = Math.min(40, Math.trunc(defender.statList.getAccruedStat(negAbsPair.pct)))
          if (negPct > 0) {
            const pctDelta = mulDiv113c(negPct, remNeg256, 100)
            negElemAbsorbDelta256 = (negElemAbsorbDelta256 + pctDelta) | 0
            remNeg256 = (remNeg256 - pctDelta) | 0
          }
          const negFlatAbs256 = Math.max(0, defender.statList.getAccruedStat(negAbsPair.flat)) * FIXED_ONE
          if (negFlatAbs256 > 0) {
            negElemAbsorbDelta256 = (negElemAbsorbDelta256 + remNeg256) | 0
            remNeg256 = 0
          }
        }
        mdrOverflow256 += -remNeg256
        negElemTrace256 = remNeg256
      } else {
        remRawElem256 = signedElemAfterMdr256
      }
    }
  }

  // 1.13c Fire Golem Fire Absorption (`aurastat1 = fireresist = 100 - dm12`, `aurastat2 = item_absorbfire_percent = dm12`):
  // Fire Golem takes 0 net fire damage and heals by `dm12%` of incoming fire damage via `item_absorbfire_percent`.
  const isFireGolemUnit =
    defender.stateBus.hasState('firegolem') ||
    defender.name === 'firegolem' ||
    defender.name === 'fire_golem' ||
    (defender as { kind?: string; sourceSkillId?: number }).kind === 'fire_golem' ||
    (defender as { sourceSkillId?: number }).sourceSkillId === 94
  const fireGolemAbsorbPct =
    elemType === 'fire' && isFireGolemUnit
      ? defender.statList.getAccruedStat('item_absorbfire_percent')
      : 0
  const isFireGolemAbsorb = fireGolemAbsorbPct > 0
  let absorbHeal256 = negElemAbsorbDelta256
  if (isFireGolemAbsorb && remRawElem256 > 0) {
    absorbHeal256 += Math.trunc((remRawElem256 * fireGolemAbsorbPct) / 100)
  }

  // 7. Resistances & 1/5 Immunity Breaking applied to unabsorbed post-PDR/MDR damage
  let finalPhys256 = physResRec.isImmune
    ? 0
    : Math.max(0, applyResist113c(remRawPhys256, physResRec.effectiveRes))

  let finalElem256 = isFireGolemAbsorb || elemResRec.isImmune
    ? 0
    : Math.max(0, applyResist113c(remRawElem256, elemResRec.effectiveRes))

  // Track resolved poison bitrate/duration and signed per-channel post-absorb damage (`0x6FCFBD80`) for #1871 / #1873 & oracle `dmg` trace
  let resolvedPoisonBitrate256 = 0
  let resolvedPoisonDurationFrames = 0
  let tracePhys256 = packet.skillId === 42 ? 0 : physDrOverflow256 > 0 ? -physDrOverflow256 : finalPhys256
  let traceFire256 = elemType === 'fire' ? negElemTrace256 : 0
  let traceLtng256 = elemType === 'ltng' ? negElemTrace256 : 0
  let traceMag256 = elemType === 'mag' ? negElemTrace256 : 0
  let traceCold256 = elemType === 'cold' ? negElemTrace256 : 0
  let traceColdLen = 0

  // Skill-packet poison length resist scaling (`stat 110 item_poisonlengthresist` + player difficulty penalty, #1871)
  if (
    elemType === 'pois' &&
    packet.elemDurationFrames !== undefined &&
    packet.elemDurationFrames > 0 &&
    finalElem256 > 0
  ) {
    const rawSkillPoisFrames = Math.max(1, Math.trunc(packet.elemDurationFrames))
    const effSkillPoisFrames = computeEffectivePoisonLengthFrames113c(rawSkillPoisFrames, defender)
    const skillBitrate256 = Math.trunc(finalElem256 / rawSkillPoisFrames)
    finalElem256 = skillBitrate256 * effSkillPoisFrames
    resolvedPoisonBitrate256 = skillBitrate256
    resolvedPoisonDurationFrames = effSkillPoisFrames
  }

  // Static Field (`skillId = 42`, `D2Game.dll` `0x6FC62EC0..0x6FC62FB0` + `DifficultyLevels.txt` `StaticFieldMin`, #1805):
  // - Expansion difficulty life floors: Normal `0%` (non-lethal `1 HP`), Nightmare `33%` of max HP, Hell `50%` of max HP; Classic `0%` (`1 HP`).
  // - Pre-check invariant (`0x6FC62F13`): if `hpBefore256 <= floorHp256`, deals `0` damage immediately!
  // - Mitigated by target `lightresist` (does NOT scale with `passive_ltng_mastery`, and never drops target below `floorHp256`).
  if (packet.skillId === 42) {
    finalPhys256 = 0
    const diffIdx =
      packet.difficulty === 'hell' || packet.difficulty === 2
        ? 2
        : packet.difficulty === 'nightmare' || packet.difficulty === 1
          ? 1
          : packet.difficulty === 'normal' || packet.difficulty === 0
            ? 0
            : (defender.monsterColdDivisor ?? 1) >= 4 ||
                (attacker.lifeStealDivisor ?? 1) >= 3 ||
                (defender.resistPenalty ?? 0) <= -100
              ? 2
              : (defender.monsterColdDivisor ?? 1) === 2 ||
                  (attacker.lifeStealDivisor ?? 1) === 2 ||
                  (defender.resistPenalty ?? 0) < 0
                ? 1
                : 0
    const minPct =
      packet.staticFieldMinPct !== undefined
        ? Math.max(0, Math.min(100, Math.trunc(packet.staticFieldMinPct)))
        : packet.isExpansion === false
          ? 0
          : diffIdx === 2
            ? 50
            : diffIdx === 1
              ? 33
              : 0
    const maxHp256 = defender.statList.getMaxHp256()
    const floorHp256 =
      minPct > 0 && maxHp256 > 0
        ? Math.max(FIXED_ONE, Math.trunc((maxHp256 * minPct) / 100))
        : FIXED_ONE
    if (elemResRec.isImmune || hpBefore256 <= floorHp256) {
      finalElem256 = 0
    } else {
      let rawStatic256 = Math.trunc((hpBefore256 * 25) / 100)
      if (pvpDmgModPct !== 100) {
        rawStatic256 = Math.trunc((rawStatic256 * pvpDmgModPct) / 100)
      }
      const resistedStatic256 = Math.max(
        0,
        applyResist113c(rawStatic256, elemResRec.effectiveRes),
      )
      finalElem256 = Math.max(0, Math.min(resistedStatic256, hpBefore256 - floorHp256))
    }
  }

  // 8. Elemental Absorb (% <= 40% FIRST, then flat) (`D2Game.dll` `SUNITDMG_ApplyAbsorb` @ `0x6FCFAD00`)
  const absorbStatPair = elemType ? ELEM_ABSORB_STAT_MAP[elemType] : undefined
  if (
    finalElem256 > 0 &&
    packet.skillId !== 42 &&
    !isFireGolemAbsorb &&
    !isSanctuaryBypassUndead &&
    absorbStatPair !== undefined
  ) {
    const absorbPctRaw = defender.statList.getAccruedStat(absorbStatPair.pct)
    const absorbFlat256 = Math.max(0, defender.statList.getAccruedStat(absorbStatPair.flat)) * FIXED_ONE
    if (absorbPctRaw > 0 || absorbFlat256 > 0) {
      const absorbOut = applyElementalAbsorb113c(finalElem256, absorbPctRaw, absorbFlat256)
      finalElem256 = absorbOut.remainingDamage256
      absorbHeal256 += absorbOut.absorbHeal256
    }
  }
  if (elemType === 'fire') traceFire256 += finalElem256
  else if (elemType === 'ltng') traceLtng256 += finalElem256
  else if (elemType === 'mag') traceMag256 += finalElem256
  else if (elemType === 'cold') traceCold256 += finalElem256

  // 8.1 Weapon / Charm Elemental Riders (`SrcDamage > 0` melee & weapon-carrying projectiles, #1873):
  // `D2Game.dll` `0x6FC5A4E0..0x6FC5A78C` (`MISSILE_InitWeaponDamage`) & `0x6FCFD610` (`SUNITDMG_FillDamageValues`):
  // Inherits `firemindam..firemaxdam`, `lightmindam..lightmaxdam`, `coldmindam..coldmaxdam`, `magicmindam..magicmaxdam`
  // scaled by `srcDam / 128` (excluding Smite #97 and any channel already merged via `mergedBowHitFlagElem`).
  const riderSrcDam = Math.max(0, Math.trunc(packet.riderSrcDam ?? srcDam))
  let anyRiderChannelNonImmune = false
  let anyRiderChannelRaw = false
  if (
    !packet.skipWeaponElemRiders &&
    attackKind !== 'spell' &&
    packet.skillId !== 97 &&
    riderSrcDam > 0
  ) {
    const mergedBowElem = (packet as { mergedBowHitFlagElem?: string }).mergedBowHitFlagElem
    const enchState = attacker.stateBus.getState('enchant')
    const enchFireMin = enchState?.stats['firemindam'] ?? 0
    const enchFireMax = enchState?.stats['firemaxdam'] ?? enchFireMin
    const riderFlatMdr256 = scaleFlatDrByFrameRate(
      Math.max(0, defender.statList.getAccruedStat('magic_damage_reduction')) * FIXED_ONE,
    )

    const resolveRiderChannel = (
      ch: 'fire' | 'ltng' | 'cold' | 'mag',
      minRaw: number,
      maxRaw: number,
    ): void => {
      const lo = Math.max(0, Math.trunc(minRaw))
      const hi = Math.max(lo, Math.trunc(maxRaw))
      if (hi <= 0) return
      const minScaled256 = Math.trunc((lo * FIXED_ONE * riderSrcDam) / 128)
      const maxScaled256 = Math.max(minScaled256, Math.trunc((hi * FIXED_ONE * riderSrcDam) / 128))
      if (maxScaled256 <= 0) return
      let chDmg256 = rollDamageRange256(minScaled256, maxScaled256, resolvedRng)
      if (attackKind === 'melee' && !packet.skipElemMastery) {
        const mPct =
          ch === 'fire'
            ? attacker.statList.getAccruedStat('passive_fire_mastery')
            : ch === 'ltng'
              ? attacker.statList.getAccruedStat('passive_ltng_mastery')
              : ch === 'cold'
                ? attacker.statList.getAccruedStat('passive_cold_mastery')
                : 0
        if (mPct > 0) {
          chDmg256 = Math.trunc((chDmg256 * (100 + mPct)) / 100)
        }
      }
      if (pvpDmgModPct !== 100) {
        chDmg256 = Math.trunc((chDmg256 * pvpDmgModPct) / 100)
      }
      anyRiderChannelRaw = true
      const signedCh256 = chDmg256 - riderFlatMdr256
      if (signedCh256 <= 0) {
        if (chDmg256 > 0) {
          let remNegCh256 = signedCh256
          const rAbsPair = ELEM_ABSORB_STAT_MAP[ch]
          if (rAbsPair !== undefined && !isSanctuaryBypassUndead) {
            const rPct = Math.min(40, Math.trunc(defender.statList.getAccruedStat(rAbsPair.pct)))
            if (rPct > 0) {
              const pctDelta = mulDiv113c(rPct, remNegCh256, 100)
              absorbHeal256 = (absorbHeal256 + pctDelta) | 0
              remNegCh256 = (remNegCh256 - pctDelta) | 0
            }
            const rFlatAbs256 = Math.max(0, defender.statList.getAccruedStat(rAbsPair.flat)) * FIXED_ONE
            if (rFlatAbs256 > 0) {
              absorbHeal256 = (absorbHeal256 + remNegCh256) | 0
              remNegCh256 = 0
            }
          }
          if (remNegCh256 !== 0) {
            mdrOverflow256 += -remNegCh256
            if (ch === 'fire') traceFire256 += remNegCh256
            else if (ch === 'ltng') traceLtng256 += remNegCh256
            else if (ch === 'cold') traceCold256 += remNegCh256
            else if (ch === 'mag') traceMag256 += remNegCh256
          }
        }
        return
      }
      chDmg256 = signedCh256
      const chResKey =
        ch === 'fire'
          ? 'fireresist'
          : ch === 'ltng'
            ? 'lightresist'
            : ch === 'cold'
              ? 'coldresist'
              : 'magicresist'
      const chConv =
        ch === 'mag'
          ? 0
          : resolveConvictionPierce113c(defender, chResKey as 'fireresist' | 'lightresist' | 'coldresist')
      const chLr =
        ch === 'mag'
          ? 0
          : resolveLowerResistPierce113c(defender, chResKey as 'fireresist' | 'lightresist' | 'coldresist')
      const chPierce =
        ch === 'fire'
          ? attacker.statList.getAccruedStat('passive_fire_pierce')
          : ch === 'ltng'
            ? attacker.statList.getAccruedStat('passive_ltng_pierce')
            : ch === 'cold'
              ? attacker.statList.getAccruedStat('passive_cold_pierce')
              : 0
      const chRes = computeEffectiveResistance({
        baseRes: getPrePierceResistance113c(defender.statList, chResKey),
        convictionPierce: packet.convictionPierce ?? chConv,
        lowerResistPierce: packet.lowerResistPierce ?? chLr,
        passiveEnemyPierce: packet.passiveEnemyPierce ?? chPierce,
        canBreakImmunity: ch !== 'mag',
        ...defenderResistParams113c(defender, ch),
      })
      if (chRes.isImmune) return
      anyRiderChannelNonImmune = true
      if (ch === 'fire' && isFireGolemUnit) {
        const fgAbs = defender.statList.getAccruedStat('item_absorbfire_percent')
        if (fgAbs > 0) {
          absorbHeal256 += Math.trunc((chDmg256 * fgAbs) / 100)
          return
        }
      }
      let postResCh256 = Math.max(0, applyResist113c(chDmg256, chRes.effectiveRes))
      const absPair = ELEM_ABSORB_STAT_MAP[ch]
      if (postResCh256 > 0 && absPair && !isSanctuaryBypassUndead) {
        const absOut = applyElementalAbsorb113c(
          postResCh256,
          defender.statList.getAccruedStat(absPair.pct),
          Math.max(0, defender.statList.getAccruedStat(absPair.flat)) * FIXED_ONE,
        )
        postResCh256 = absOut.remainingDamage256
        absorbHeal256 += absOut.absorbHeal256
      }
      finalElem256 += postResCh256
      if (ch === 'fire') traceFire256 += postResCh256
      else if (ch === 'ltng') traceLtng256 += postResCh256
      else if (ch === 'cold') traceCold256 += postResCh256
      else if (ch === 'mag') traceMag256 += postResCh256
    }

    if (mergedBowElem !== 'fire') {
      const gearFireMin = Math.max(0, attacker.statList.getAccruedStat('firemindam') - enchFireMin)
      const gearFireMax = Math.max(gearFireMin, attacker.statList.getAccruedStat('firemaxdam') - enchFireMax)
      resolveRiderChannel('fire', gearFireMin, gearFireMax)
    }
    resolveRiderChannel(
      'ltng',
      attacker.statList.getAccruedStat('lightmindam'),
      attacker.statList.getAccruedStat('lightmaxdam'),
    )
    if (mergedBowElem !== 'cold') {
      resolveRiderChannel(
        'cold',
        attacker.statList.getAccruedStat('coldmindam'),
        attacker.statList.getAccruedStat('coldmaxdam'),
      )
    }
    resolveRiderChannel(
      'mag',
      attacker.statList.getAccruedStat('magicmindam'),
      attacker.statList.getAccruedStat('magicmaxdam'),
    )
  }

  // 8.2 Multi-Source Weapon/Charm Poison (`poison_count` `stat 326`), `#278 Venom` (`state 31`) 10-frame clamp,
  //     `stat 110 item_poisonlengthresist`, and single-highest-bitrate overwrite (#1871, #1873):
  const hasVenom =
    attackKind !== 'spell' &&
    packet.skillId !== 97 &&
    (packet.skillId === 278 ||
      attacker.stateBus.hasState('venom') ||
      attacker.stateBus.hasState('venomclaws') ||
      attacker.stateBus.hasState(31))
  if (
    !packet.skipWeaponPoison &&
    attackKind !== 'spell' &&
    packet.skillId !== 97 &&
    (riderSrcDam > 0 || hasVenom)
  ) {
    const vState = hasVenom
      ? (attacker.stateBus.getState('venom') ??
          attacker.stateBus.getState('venomclaws') ??
          attacker.stateBus.getState(31))
      : undefined
    const venomModPoisMin = vState?.stats['poisonmindam'] ?? 0
    const venomModPoisMax = vState?.stats['poisonmaxdam'] ?? venomModPoisMin
    const venomModPoisLen = vState?.stats['poisonlength'] ?? 0
    const venomModPoisCount = vState?.stats['poison_count'] ?? 0

    let itemPoisBitrate256 = 0
    let itemPoisFrames = 0
    if (attacker.weaponPoisonSources && attacker.weaponPoisonSources.length > 0) {
      let sumRate256 = 0
      let sumFrames = 0
      let validCount = 0
      for (const src of attacker.weaponPoisonSources) {
        if (src.bitrate256 > 0 && src.frames > 0) {
          sumRate256 += Math.trunc(src.bitrate256)
          sumFrames += Math.trunc(src.frames)
          validCount += 1
        }
      }
      if (validCount > 0) {
        itemPoisBitrate256 = sumRate256
        itemPoisFrames = validCount > 1 ? Math.floor(sumFrames / validCount) : sumFrames
      }
    } else if ((attacker.weaponPoisonBitrate256 ?? 0) > 0) {
      itemPoisBitrate256 = Math.trunc(attacker.weaponPoisonBitrate256!)
      itemPoisFrames = Math.max(1, Math.trunc(attacker.weaponPoisonFrames ?? 100))
    } else {
      const rawItemMin256 = Math.max(0, attacker.statList.getAccruedStat('poisonmindam') - venomModPoisMin)
      const rawItemMax256 = Math.max(rawItemMin256, attacker.statList.getAccruedStat('poisonmaxdam') - venomModPoisMax)
      const rawItemLenSum = Math.max(0, attacker.statList.getAccruedStat('poisonlength') - venomModPoisLen)
      const rawItemCount = Math.max(
        1,
        Math.trunc(attacker.statList.getAccruedStat('poison_count') - venomModPoisCount),
      )
      if (rawItemMax256 > 0 && rawItemLenSum > 0) {
        itemPoisBitrate256 = rollDamageRange256(rawItemMin256, rawItemMax256, resolvedRng)
        itemPoisFrames = rawItemCount > 1 ? Math.floor(rawItemLenSum / rawItemCount) : rawItemLenSum
      }
    }

    const poisSrcDam = riderSrcDam > 0 ? riderSrcDam : 128
    if (itemPoisBitrate256 > 0 && poisSrcDam !== 128) {
      itemPoisBitrate256 = Math.trunc((itemPoisBitrate256 * poisSrcDam) / 128)
    }

    let rawWeapPoisBitrate256 = 0
    let rawWeapPoisFrames = 0
    if (hasVenom) {
      let venomBitrate256 = 0
      if (venomModPoisMax > 0) {
        venomBitrate256 = rollDamageRange256(
          Math.max(0, venomModPoisMin),
          Math.max(venomModPoisMin, venomModPoisMax),
          resolvedRng,
        )
      } else {
        const vCalc = vState ? computeVenomPoisonDamage(vState.slvl) : undefined
        venomBitrate256 = vCalc
          ? rollDamageRange256(vCalc.minBitrate, vCalc.maxBitrate, resolvedRng)
          : 35 * FIXED_ONE
      }
      if (poisSrcDam !== 128) {
        venomBitrate256 = Math.trunc((venomBitrate256 * poisSrcDam) / 128)
      }
      rawWeapPoisBitrate256 = venomBitrate256 + itemPoisBitrate256
      rawWeapPoisFrames = 10
    } else if (itemPoisBitrate256 > 0 && itemPoisFrames > 0) {
      rawWeapPoisBitrate256 = itemPoisBitrate256
      if (attackKind === 'melee' && !packet.skipElemMastery) {
        const poisMastPct = attacker.statList.getAccruedStat('passive_pois_mastery')
        if (poisMastPct > 0) {
          rawWeapPoisBitrate256 = Math.trunc((rawWeapPoisBitrate256 * (100 + poisMastPct)) / 100)
        }
      }
      rawWeapPoisFrames = itemPoisFrames
    }

    if (rawWeapPoisBitrate256 > 0 && rawWeapPoisFrames > 0) {
      // 1.13c `#73 Poison Dagger` + weapon/Venom poison (`SKILLS_SrvDmg_PoisonDagger`):
      // Sums skill bitrate + weapon/Venom bitrate and adds skill frames + weapon/Venom frames (10 with Venom!).
      if (packet.skillId === 73 && elemType === 'pois' && (packet.elemDurationFrames ?? 0) > 0) {
        finalElem256 = 0
        const pdRawFrames = Math.max(1, Math.trunc(packet.elemDurationFrames!))
        const pdRawBitrate256 = Math.trunc(afterShieldElem256 / pdRawFrames)
        const combinedRawFrames = pdRawFrames + rawWeapPoisFrames
        let combinedBitrate256 = rawWeapPoisBitrate256
        if (pvpDmgModPct !== 100) {
          combinedBitrate256 = Math.trunc((combinedBitrate256 * pvpDmgModPct) / 100)
        }
        combinedBitrate256 += pdRawBitrate256
        const poisLr = resolveLowerResistPierce113c(defender, 'poisonresist')
        const poisRes = computeEffectiveResistance({
          baseRes: getPrePierceResistance113c(defender.statList, 'poisonresist'),
          convictionPierce: 0,
          lowerResistPierce: packet.lowerResistPierce ?? poisLr,
          passiveEnemyPierce:
            packet.passiveEnemyPierce ?? attacker.statList.getAccruedStat('passive_pois_pierce'),
          canBreakImmunity: true,
          ...defenderResistParams113c(defender, 'pois'),
        })
        if (!poisRes.isImmune) {
          const effRate256 = Math.max(0, applyResist113c(combinedBitrate256, poisRes.effectiveRes))
          const effFrames = computeEffectivePoisonLengthFrames113c(combinedRawFrames, defender)
          finalElem256 += effRate256 * effFrames
          resolvedPoisonBitrate256 = effRate256
          resolvedPoisonDurationFrames = effFrames
        }
      } else {
        let pvpPoisRate256 = rawWeapPoisBitrate256
        if (pvpDmgModPct !== 100) {
          pvpPoisRate256 = Math.trunc((pvpPoisRate256 * pvpDmgModPct) / 100)
        }
        anyRiderChannelRaw = true
        const poisLr = resolveLowerResistPierce113c(defender, 'poisonresist')
        const poisRes = computeEffectiveResistance({
          baseRes: getPrePierceResistance113c(defender.statList, 'poisonresist'),
          convictionPierce: 0,
          lowerResistPierce: packet.lowerResistPierce ?? poisLr,
          passiveEnemyPierce:
            packet.passiveEnemyPierce ?? attacker.statList.getAccruedStat('passive_pois_pierce'),
          canBreakImmunity: true,
          ...defenderResistParams113c(defender, 'pois'),
        })
        if (!poisRes.isImmune) {
          anyRiderChannelNonImmune = true
          const effRate256 = Math.max(0, applyResist113c(pvpPoisRate256, poisRes.effectiveRes))
          const effFrames = computeEffectivePoisonLengthFrames113c(rawWeapPoisFrames, defender)
          if (effRate256 > 0 && effFrames > 0) {
            finalElem256 += effRate256 * effFrames
            if (effRate256 >= resolvedPoisonBitrate256) {
              resolvedPoisonBitrate256 = effRate256
              resolvedPoisonDurationFrames = effFrames
            }
          }
        }
      }
    }
  }

  // Apply single-highest-bitrate poison state overwrite (`D2Game.dll` `0x6FCFCAB0`, #1871)
  if (resolvedPoisonBitrate256 > 0 && resolvedPoisonDurationFrames > 0) {
    const existingPois = defender.stateBus.getState('poison') ?? defender.stateBus.getState(2)
    const existingRate256 = existingPois?.stats['poisonmindam'] ?? 0
    if (!existingPois || resolvedPoisonBitrate256 >= existingRate256) {
      if (existingPois) {
        defender.stateBus.removeState('poison')
      }
      defender.stateBus.applyState({
        stateNameOrId: 'poison',
        sourceUnitId: attacker.id,
        sourceSkillId: hasVenom ? 278 : packet.skillId,
        slvl: effectiveSlvl,
        durationFrames: resolvedPoisonDurationFrames,
        stats: {
          poisonmindam: resolvedPoisonBitrate256,
          poisonlength: resolvedPoisonDurationFrames,
        },
      })
    }
  }

  // Vengeance (111) multi-elemental packet evaluation (Fire, Cold, Lightning)
  // 1.13c Ground Truth (`SKILLS_SrvSt35_Vengeance` @ `0x6FCB8BA0`, #1868):
  // - Elemental percentages scale off BASE weapon damage + flat +min/+max (`baseWeapPhysWithoutNormal256`),
  //   strictly EXCLUDING `item_normaldamage` (`stat 111`, Grief `+Damage`), off-weapon %ED, and Deadly Strike!
  // - Multiplied by `passive_fire_mastery` (#329), `passive_cold_mastery` (#331), `passive_ltng_mastery` (#330).
  // - Inflicts `chill` (`STATE_COLD` #28) for `chillDurationFrames` (`30 + 15*(slvl-1)` frames), NOT solid `freeze`.
  if (packet.multiElemPacket && (baseWeapPhysWithoutNormal256 > 0 || baseWeapPhys256 > 0 || rawPhys256 > 0)) {
    if (!packet.elemMin256 && !packet.elemMax256) {
      finalElem256 = 0
      traceFire256 = 0
      traceLtng256 = 0
      traceMag256 = 0
      traceCold256 = 0
    }
    const mep = packet.multiElemPacket
    const rawBaseWpPhys256 =
      packet.vengeanceBasePhys256 ??
      (baseWeapPhysWithoutNormal256 > 0
        ? baseWeapPhysWithoutNormal256
        : baseWeapPhys256 > 0
          ? baseWeapPhys256
          : prePvpRawPhys256)
    const baseWpPhys256 =
      pvpDmgModPct !== 100
        ? Math.trunc((rawBaseWpPhys256 * pvpDmgModPct) / 100)
        : rawBaseWpPhys256
    const multiElemFlatMdr256 = scaleFlatDrByFrameRate(
      Math.max(0, defender.statList.getAccruedStat('magic_damage_reduction')) * FIXED_ONE,
    )

    if (mep.firePct && mep.firePct > 0) {
      let rawFire256 = Math.trunc((Math.trunc(baseWpPhys256 / 256) * mep.firePct) / 100) * 256
      const fireMasteryPct = attacker.statList.getAccruedStat('passive_fire_mastery')
      if (fireMasteryPct > 0) {
        rawFire256 = Math.trunc((rawFire256 * (100 + fireMasteryPct)) / 100)
      }
      // 1.13c `D2Game.dll` `0x6FCFBD41`: flat `magic_damage_reduction` applies independently to each elemental channel,
      // and negative overflow spills into `mdrOverflow256` (#1635, #1795).
      const signedFire256 = rawFire256 - multiElemFlatMdr256
      if (signedFire256 <= 0) {
        if (rawFire256 > 0) mdrOverflow256 += -signedFire256
        rawFire256 = 0
      } else {
        rawFire256 = signedFire256
      }
      const fireRes = computeEffectiveResistance({
        baseRes: defender.statList.getAccruedStat('fireresist'),
        convictionPierce,
        lowerResistPierce,
        passiveEnemyPierce: packet.passiveEnemyPierce ?? attacker.statList.getAccruedStat('passive_fire_pierce'),
        ...defenderResistParams113c(defender, 'fire'),
      })
      if (rawFire256 > 0 && !fireRes.isImmune) {
        const postResFire256 = Math.max(0, applyResist113c(rawFire256, fireRes.effectiveRes))
        const fireAbsorbOut = applyElementalAbsorb113c(
          postResFire256,
          defender.statList.getAccruedStat('item_absorbfire_percent'),
          Math.max(0, defender.statList.getAccruedStat('item_absorbfire')) * FIXED_ONE,
        )
        finalElem256 += fireAbsorbOut.remainingDamage256
        traceFire256 += fireAbsorbOut.remainingDamage256
        absorbHeal256 += fireAbsorbOut.absorbHeal256
      }
    }

    if (mep.coldPct && mep.coldPct > 0) {
      let rawCold256 = Math.trunc((Math.trunc(baseWpPhys256 / 256) * mep.coldPct) / 100) * 256
      const coldMasteryPct = attacker.statList.getAccruedStat('passive_cold_mastery')
      if (coldMasteryPct > 0) {
        rawCold256 = Math.trunc((rawCold256 * (100 + coldMasteryPct)) / 100)
      }
      const signedCold256 = rawCold256 - multiElemFlatMdr256
      if (signedCold256 <= 0) {
        if (rawCold256 > 0) mdrOverflow256 += -signedCold256
        rawCold256 = 0
      } else {
        rawCold256 = signedCold256
      }
      const coldRes = computeEffectiveResistance({
        baseRes: defender.statList.getAccruedStat('coldresist'),
        convictionPierce,
        lowerResistPierce,
        passiveEnemyPierce: packet.passiveEnemyPierce ?? attacker.statList.getAccruedStat('passive_cold_pierce'),
        ...defenderResistParams113c(defender, 'cold'),
      })
      if (rawCold256 > 0 && !coldRes.isImmune) {
        const postResCold256 = Math.max(0, applyResist113c(rawCold256, coldRes.effectiveRes))
        const coldAbsorbOut = applyElementalAbsorb113c(
          postResCold256,
          defender.statList.getAccruedStat('item_absorbcold_percent'),
          Math.max(0, defender.statList.getAccruedStat('item_absorbcold')) * FIXED_ONE,
        )
        finalElem256 += coldAbsorbOut.remainingDamage256
        traceCold256 += coldAbsorbOut.remainingDamage256
        absorbHeal256 += coldAbsorbOut.absorbHeal256
        if (!defender.statList.getAccruedStat('item_cannotbefrozen')) {
          const rawChillFrames = mep.chillDurationFrames ?? 30
          const chillDivisor =
            defender.unitType === 'monster' ? Math.max(1, defender.monsterColdDivisor ?? 1) : 1
          let chillFrames = Math.trunc(rawChillFrames / chillDivisor)
          if (defender.statList.getAccruedStat('item_halffreezeduration') > 0) {
            chillFrames = Math.floor(chillFrames / 2)
          }
          if (chillFrames > 0) {
            defender.stateBus.applyState({
              stateNameOrId: 'chill',
              sourceSkillId: packet.skillId,
              slvl: 1,
              durationFrames: chillFrames,
            })
          }
        }
      }
    }

    if (mep.ltngPct && mep.ltngPct > 0) {
      let rawLtng256 = Math.trunc((Math.trunc(baseWpPhys256 / 256) * mep.ltngPct) / 100) * 256
      const ltngMasteryPct = attacker.statList.getAccruedStat('passive_ltng_mastery')
      if (ltngMasteryPct > 0) {
        rawLtng256 = Math.trunc((rawLtng256 * (100 + ltngMasteryPct)) / 100)
      }
      const signedLtng256 = rawLtng256 - multiElemFlatMdr256
      if (signedLtng256 <= 0) {
        if (rawLtng256 > 0) mdrOverflow256 += -signedLtng256
        rawLtng256 = 0
      } else {
        rawLtng256 = signedLtng256
      }
      const ltngRes = computeEffectiveResistance({
        baseRes: defender.statList.getAccruedStat('lightresist'),
        convictionPierce,
        lowerResistPierce,
        passiveEnemyPierce: packet.passiveEnemyPierce ?? attacker.statList.getAccruedStat('passive_ltng_pierce'),
        ...defenderResistParams113c(defender, 'ltng'),
      })
      if (rawLtng256 > 0 && !ltngRes.isImmune) {
        const postResLtng256 = Math.max(0, applyResist113c(rawLtng256, ltngRes.effectiveRes))
        const ltngAbsorbOut = applyElementalAbsorb113c(
          postResLtng256,
          defender.statList.getAccruedStat('item_absorblight_percent'),
          Math.max(0, defender.statList.getAccruedStat('item_absorblight')) * FIXED_ONE,
        )
        finalElem256 += ltngAbsorbOut.remainingDamage256
        traceLtng256 += ltngAbsorbOut.remainingDamage256
        absorbHeal256 += ltngAbsorbOut.absorbHeal256
      }
    }
  }

  // Apply 1.13c MDR negative overflow spill onto Physical damage (`D2Game.dll` `0x6FCFC50A`, #1795):
  if (mdrOverflow256 > 0 && finalPhys256 > 0) {
    finalPhys256 = Math.max(0, finalPhys256 - mdrOverflow256)
  }

  // 1.13c Cold Chill / Freeze application (`SUNITDMG_ApplyCold` `0x6FCFC780` & `SUNITDMG_ApplyFreeze` `0x6FCFDAC0`, #1939):
  // - `item_cannotbefrozen` (stat 153) completely blocks `cold` (state 11) and `freeze` (state 1)
  //   (Holy Freeze `state 44` `holywindcold` is applied by `AuraScanner`, never here).
  // - `item_halffreezeduration` (stat 118) halves duration ONCE (`floor(frames / 2)`), regardless of item count.
  if (
    elemType === 'cold' &&
    finalElem256 > 0 &&
    !elemResRec.isImmune &&
    (packet.elemDurationFrames ?? 0) > 0 &&
    defender.statList.getAccruedStat('item_cannotbefrozen') <= 0
  ) {
    const rawColdFrames = Math.max(0, Math.trunc(packet.elemDurationFrames!))
    const coldDivisor =
      defender.unitType === 'monster' ? Math.max(1, defender.monsterColdDivisor ?? 1) : 1
    let effColdFrames = Math.trunc(rawColdFrames / coldDivisor)
    if (defender.statList.getAccruedStat('item_halffreezeduration') > 0) {
      effColdFrames = Math.floor(effColdFrames / 2)
    }
    if (effColdFrames > 0) {
      traceColdLen = effColdFrames
      defender.stateBus.applyState({
        stateNameOrId: 'cold',
        sourceUnitId: attacker.id,
        sourceSkillId: packet.skillId,
        slvl: effectiveSlvl,
        durationFrames: effColdFrames,
      })
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

  const canTriggerProcs = packet.canTriggerProcs !== false
  const canTriggerWeaponHitEvents =
    canTriggerProcs && (attackKind === 'melee' || (attackKind === 'missile' && riderSrcDam > 0))

  // 1.13c Knockback flag (`D2Game.dll` `SUNITDMG_ExecuteEvents` @ `0x6FCFD00E..0x6FCFD120`):
  // `pDamage->wResultFlags |= 0x08` transitions the defender into `MONMODE_KNOCKBACK` (13) or
  // `PLRMODE_KNOCKBACK` (19); `States.txt` has no `'knockback'` state.
  const knockedBack = Boolean(packet.knockback && canTriggerProcs)

  // Self-damage calculation (`SKILLS_SrvDo064_Sacrifice` @ `0x6FCB9290`, #1942):
  // - Base recoil is `min(prePvpRawPhys256, targetCurrentHpBefore256)` * `selfDamagePct` / 100 (`Param3 = 8` for Sacrifice #96).
  // - Routed through attacker's own `damageresist` (physical damage reduction %, capped at 50%).
  // - CAN kill the Paladin (`HP` can drop to `0`).
  let selfDamageTaken256 = 0
  const effectiveSelfDamagePct = packet.selfDamagePct ?? (packet.skillId === 96 ? 8 : 0)
  if (effectiveSelfDamagePct > 0 && prePvpRawPhys256 > 0 && !physResRec.isImmune) {
    const recoilBase256 = hpBefore256 > 0 ? Math.min(prePvpRawPhys256, hpBefore256) : prePvpRawPhys256
    const rawSelfDmg256 = Math.trunc((recoilBase256 * effectiveSelfDamagePct) / 100)
    const attackerPhysRes = Math.min(50, Math.max(-100, attacker.statList.getAccruedStat('damageresist')))
    selfDamageTaken256 = Math.max(0, Math.trunc((rawSelfDmg256 * (100 - attackerPhysRes)) / 100))
    const curAttackerHp256 = attacker.statList.getHp256()
    const newAttackerHp256 = Math.max(0, curAttackerHp256 - selfDamageTaken256)
    attacker.statList.setHp256(newAttackerHp256)
  }

  // 1.13c `SUNITDMG_ExecuteEvents` (`0x6FCFE237` -> `SUNITDMG_AddLife` `0x6FCFB570`):
  // Apply `dwAbsorbLife` (`absorbHeal256`) to defender HP (clamped at `maxhp`) BEFORE subtracting
  // `dwTotalDamage` (`0x6FCFE242`), provided defender is alive (`hp > 0`) and not in `death_delay` (state 92).
  if (
    absorbHeal256 > 0 &&
    defender.statList.getHp256() > 0 &&
    !defender.stateBus.hasState('death_delay')
  ) {
    defender.statList.setHp256(defender.statList.getHp256() + absorbHeal256)
  }
  const currentDefenderHp256 = defender.statList.getHp256()

  // 8.3 Crushing Blow (`stat 136`, `ITEMEVENTS_ApplyCrushingBlow` @ `0x6FCCCC30`, #1869, #1873)
  // & Open Wounds (`stat 135`, `ITEMEVENTS_ApplyOpenWounds` @ `0x6FCCD410`, #1870, #1873)
  // & -Monster Defense Per Hit (`stat 120`, `ITEMEVENTS_ApplyDamageTargetAC`, #1936)
  // & Hit Blinds Target (`stat 113`, `ITEMEVENTS_ApplyStupidity` `0x6FCCD0F0`, #1937)
  // & Hit Causes Monster to Flee (`stat 112`, `ITEMEVENTS_ApplyHowl` `0x6FCCCF40`, #1937):
  let cbTriggered = false
  let cbDamage256 = 0
  let owTriggered = false
  let owBitrate256 = 0
  let targetDefenseReduction = 0
  if (canTriggerWeaponHitEvents) {
    const rawDamageTargetAc = Math.abs(Math.trunc(attacker.statList.getAccruedStat('item_damagetargetac')))
    if (rawDamageTargetAc > 0) {
      const isPvpOrMercTarget =
        isPlayerLikeDefender ||
        defender.unitType === 'mercenary' ||
        defender.unitType === 'party_mercenary'
      const acReduction = isPvpOrMercTarget ? Math.floor(rawDamageTargetAc / 2) : rawDamageTargetAc
      if (acReduction > 0) {
        targetDefenseReduction = acReduction
        const curBaseAc = defender.statList.getAccruedStat('armorclass', true)
        defender.statList.setBaseStat('armorclass', Math.max(0, curBaseAc - acReduction))
      }
    }

    const isEligibleForBlindOrFlee =
      defender.unitType === 'monster' &&
      !defender.isBoss &&
      !defender.isPrimeEvil &&
      !defender.isSuperUnique &&
      !defender.isChampion &&
      defender.rank !== 'champion' &&
      defender.rank !== 'unique' &&
      defender.rank !== 'boss' &&
      defender.rank !== 'superunique' &&
      !defender.stateBus.hasState(57) &&
      !defender.stateBus.hasState('attract') &&
      !defender.stateBus.hasState(59) &&
      !defender.stateBus.hasState('confuse')
    if (isEligibleForBlindOrFlee) {
      const stat113 = Math.trunc(attacker.statList.getAccruedStat('item_stupidity'))
      if (stat113 > 0) {
        const atkLvl = Math.max(1, Math.trunc(attacker.statList.getAccruedStat('level')))
        const defLvl = Math.max(1, Math.trunc(defender.statList.getAccruedStat('level')))
        const blindChance = Math.max(0, Math.min(100, 50 + (atkLvl + (stat113 - 1) * 4 - defLvl) * 5))
        if (boundedRand(resolvedRng, 100) < blindChance) {
          const blindSlvl = Math.max(1, Math.min(20, Math.floor((atkLvl - 6) / 4) + 1))
          const curseDiv = Math.max(1, defender.monsterColdDivisor ?? 1)
          const blindFrames = Math.max(1, Math.floor((125 + (blindSlvl - 1) * 50) / curseDiv))
          defender.stateBus.applyState({
            stateNameOrId: 'dimvision',
            sourceUnitId: attacker.id,
            sourceSkillId: 81,
            slvl: blindSlvl,
            durationFrames: blindFrames,
          })
        }
      }
      const stat112 = Math.trunc(attacker.statList.getAccruedStat('item_howl'))
      if (stat112 > 0) {
        const fleeChance = stat112 > 100 ? Math.min(100, Math.floor((stat112 * 100) / 128)) : stat112
        if (fleeChance >= 100 || boundedRand(resolvedRng, 100) < fleeChance) {
          const curseDiv = Math.max(1, defender.monsterColdDivisor ?? 1)
          const fleeFrames = Math.max(25, Math.floor(150 / curseDiv))
          defender.stateBus.applyState({
            stateNameOrId: 'terror',
            sourceUnitId: attacker.id,
            sourceSkillId: 77,
            slvl: 1,
            durationFrames: fleeFrames,
          })
        }
      }
    }
    if (!packet.skipCrushingBlow && currentDefenderHp256 > 0) {
      const cbChance = Math.min(100, Math.max(0, Math.trunc(attacker.statList.getAccruedStat('item_crushingblow'))))
      if (cbChance > 0) {
        const cbRoll = packet.cbRoll100 ?? boundedRand(resolvedRng, 100)
        if (cbRoll < cbChance) {
          cbTriggered = true
          const cbOut = calculateCrushingBlow113c({
            defenderHp: currentDefenderHp256,
            unitType: isPlayerLikeDefender ? 'player' : 'monster',
            isHireling:
              defender.unitType === 'mercenary' || defender.unitType === 'party_mercenary',
            isBoss: defender.isBoss,
            isPrimeEvil: defender.isPrimeEvil,
            isSuperUnique: defender.isSuperUnique,
            rank: defender.rank,
            playerCount:
              packet.playerCount ?? defender.partyScaleCount ?? attacker.partyScaleCount ?? 1,
            isRanged: attackKind === 'missile',
            physResPct: physResRec.isImmune ? 100 : physResRec.effectiveRes,
          })
          cbDamage256 = Math.max(0, cbOut.damage)
        }
      }
    }
    if (!packet.skipOpenWounds) {
      const owChance = Math.min(100, Math.max(0, Math.trunc(attacker.statList.getAccruedStat('item_openwounds'))))
      if (owChance > 0) {
        const owRoll = packet.owRoll100 ?? boundedRand(resolvedRng, 100)
        if (owRoll < owChance) {
          const owOut = calculateOpenWounds113c({
            attackerLvl: Math.max(1, attacker.statList.getAccruedStat('level')),
            isRanged: attackKind === 'missile',
            defender,
          })
          if (owOut.bitrate256 > 0) {
            owTriggered = true
            owBitrate256 = owOut.bitrate256
            if (defender.stateBus.hasState('openwounds') || defender.stateBus.hasState(62)) {
              defender.stateBus.removeState('openwounds')
            }
            defender.stateBus.applyState({
              stateNameOrId: 'openwounds',
              sourceUnitId: attacker.id,
              sourceSkillId: packet.skillId,
              slvl: 1,
              durationFrames: owOut.durationFrames,
              stats: { damage_framerate: owOut.bitrate256 },
            })
          }
        }
      }
    }
  }

  // 8.4 CurHp-Clamped Life/Mana Leech, `#82 Life Tap`, and Thorns / Iron Maiden (`D2Game.dll` `0x6FCFE205..0x6FCFE237`, #1872):
  // Clamp effective physical damage dealt against defender's remaining HP (`currentDefenderHp256 - cbDamage256`)
  // BEFORE computing Life Tap, gear Life/Mana Steal, Thorns, Spirit of Barbs, or Iron Maiden!
  const remHpForPhys256 = Math.max(0, currentDefenderHp256 - cbDamage256)
  const actualPhysDealt256 = Math.min(finalPhys256, remHpForPhys256)
  const actualPrePvpPhysDealt256 = Math.min(prePvpFinalPhys256, remHpForPhys256)

  let attackerHealed256 = 0
  let attackerManaLeeched256 = 0
  // 1.13c Skills.txt #82 Life Tap (`state 25`): calc1 = ln56 with Param5 = 50 -> 50% life heal,
  // ignoring DifficultyLevels steal divisor and MonStats `Drain = 0`!
  const hasLifeTap = defender.stateBus.hasState('lifetap') || defender.stateBus.hasState(25)
  if (
    hasLifeTap &&
    actualPhysDealt256 > 0 &&
    canTriggerProcs &&
    attacker.statList.getHp256() > 0 &&
    !attacker.stateBus.hasState('death_delay')
  ) {
    const ltHeal256 = Math.trunc((actualPhysDealt256 * 50) / 100)
    if (ltHeal256 > 0) {
      const curHp = attacker.statList.getHp256()
      attacker.statList.setHp256(curHp + ltHeal256)
      attackerHealed256 += attacker.statList.getHp256() - curHp
    }
  }

  // 1.13c Life / Mana steal (`D2Game.dll` 0x6FCFBA40) from ItemStatCost `lifedrainmindam` (60) /
  // `manadrainmindam` (62). Suppressed when canTriggerProcs === false or for Smite (97).
  const canLeechGear = canTriggerProcs && packet.skillId !== 97 && !packet.suppressGearLeech
  const stealClass = stealAttackerClass113c(attacker)
  if (canLeechGear && actualPhysDealt256 > 0 && stealClass !== undefined) {
    const steal = computeLifeManaSteal113c({
      phys256: actualPhysDealt256,
      lifeStealPct: attacker.statList.getAccruedStat('lifedrainmindam'),
      manaStealPct: attacker.statList.getAccruedStat('manadrainmindam'),
      attackerIsPlayer: stealClass === 'player',
      lifeStealDivisor: attacker.lifeStealDivisor ?? 1,
      manaStealDivisor: attacker.manaStealDivisor ?? 1,
      defenderIsMonster: isMonsterClassUnit113c(defender),
      defenderDrain: defender.drain,
    })
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

  // The DR overflow (physDrOverflow256) only lowers the signed `dwDmgTotal`; the per-channel values are
  // kept (0x6FCFC4F7..0x6FCFC519). A non-positive total deals no damage.
  const totalDamage256 = Math.max(0, cbDamage256 + finalPhys256 + finalElem256 - physDrOverflow256)
  const hpAfter256 = Math.max(0, currentDefenderHp256 - totalDamage256)
  defender.statList.setHp256(hpAfter256)

  // 1.13c Blood Golem EventFunc26_DamageLink (0x6FD13D90):
  // Shares Param6 = 25% of damage taken with the Necromancer owner, clamped so owner HP never drops below 1 HP.
  const bloodGolemSharePct =
    (defender as { lifeLink?: { shareDamagePct?: number } }).lifeLink?.shareDamagePct ??
    (defender.stateBus.hasState('bloodgolem') || (defender as { kind?: string }).kind === 'blood_golem'
      ? 25
      : 0)
  if (bloodGolemSharePct > 0 && totalDamage256 > 0 && defender.ownerRef) {
    const sharedDmg256 = Math.trunc((totalDamage256 * bloodGolemSharePct) / 100)
    if (sharedDmg256 > 0) {
      const ownerHp256 = defender.ownerRef.statList.getHp256()
      defender.ownerRef.statList.setHp256(Math.max(FIXED_ONE, ownerHp256 - sharedDmg256))
    }
  }

  // 9. Reactive events post-damage (damagedinmelee for melee, hitbymissile for missile)
  if (attackKind === 'melee' && !packet.deferDefenderReactiveEvents113c) {
    const isClayGolemUnit =
      defender.stateBus.hasState('claygolem') ||
      (defender as { kind?: string }).kind === 'clay_golem' ||
      defender.name === 'clay_golem'
    const rawClaySlowPct = isClayGolemUnit ? defender.statList.getAccruedStat('item_slow') : 0
    const claySlowPct = capTargetSlowPct113c(rawClaySlowPct, attacker)

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
    if (thornsReturnPct > 0 && actualPhysDealt256 > 0) {
      let rawThorns256 = Math.trunc((actualPhysDealt256 * thornsReturnPct) / 100)
      if (isPvP) {
        rawThorns256 = Math.trunc(rawThorns256 / 4)
      }
      const attackerPhysRes = computeEffectiveResistance({
        baseRes: attacker.statList.getAccruedStat('damageresist'),
        ...defenderResistParams113c(attacker, 'phys'),
      })
      const reflected256 = attackerPhysRes.isImmune
        ? 0
        : Math.max(0, applyResist113c(rawThorns256, attackerPhysRes.effectiveRes))
      if (reflected256 > 0) {
        reflectedPhys256 += reflected256
        const curHp = attacker.statList.getHp256()
        attacker.statList.setHp256(Math.max(0, curHp - reflected256))
      }
    }

    const reactiveDamage = defender.stateBus.triggerReactiveEvents({
      event: 'damagedinmelee',
      incomingPhys256: actualPrePvpPhysDealt256,
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
    // 1.13c Clay Golem EventFunc27_SlowTarget (0x6FC6EF70 -> ITEMEVENTS_ApplySlow 0x6FCCD2C0,
    // Skills.txt #75 aurastat1 = item_slow = dm34): slows melee attacker for 750 frames (30s),
    // capped at 50% vs Player/Hireling/Boss/Unique/Champion, 75% vs SuperUnique, 90% vs Normal.
    if (claySlowPct > 0) {
      const existingSlow = attacker.stateBus.getState('slowed')
      if (!existingSlow || existingSlow.stats['item_slow'] !== claySlowPct) {
        attacker.stateBus.applyState({
          stateNameOrId: 'slowed',
          slvl: existingSlow?.slvl ?? 1,
          durationFrames: existingSlow?.durationFrames ?? 750,
          stats: { item_slow: claySlowPct },
        })
      }
      if (!attackerStatesApplied.includes('slowed') && !attackerStatesApplied.includes('slow')) {
        attackerStatesApplied.push('slowed')
      }
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
    const imState = attacker.stateBus.getState('ironmaiden')
    const hasIronMaiden = Boolean(imState)
    if (hasIronMaiden && actualPhysDealt256 > 0) {
      const imSlvl = imState?.slvl ?? 1
      const isPlayerOrHireling =
        attacker.unitType === 'player' ||
        attacker.unitType === 'mercenary' ||
        attacker.unitType === 'party_mercenary'
      const rawReturnPct =
        imState?.stats['thorns_percent'] ??
        calculateIronMaidenReturnPct(imSlvl, false)
      const returnPct = isPlayerOrHireling ? Math.floor(rawReturnPct / 4) : rawReturnPct
      const rawReflected256 = Math.trunc((actualPhysDealt256 * returnPct) / 100)
      const attackerPhysRes = computeEffectiveResistance({
        baseRes: attacker.statList.getAccruedStat('damageresist'),
        ...defenderResistParams113c(attacker, 'phys'),
      })
      const imReflected256 = attackerPhysRes.isImmune
        ? 0
        : Math.max(0, applyResist113c(rawReflected256, attackerPhysRes.effectiveRes))
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

  if (packet.d2AttackerSeed113c !== undefined && attackKind !== 'spell' && !fillDamageTailDone113c) {
    // 1.13c `SUNITDMG_FillDamageValues` (`0x6FCFD610`): `dwBurnLength = 25 + RAND_RollLimited(&pAttacker->pSeed, 50)`.
    resolvedRng.rand(50)
  }

  // 1.13c Skills.txt #113 Concentration: aurastat2 = skill_concentration = Param5 (20%).
  // Note: When `d2AttackerSeed113c` is active, Concentration uninterruptibility is rolled on the
  // interrupted windup path (`schedulePlayerSkillWindup113c`), never on `pAttacker->pSeed` inside `SUnitDmg`.
  const hasConcentration =
    packet.d2AttackerSeed113c === undefined &&
    (attacker.stateBus.hasState('concentration') ||
      attacker.statList.getModifierBonus('skill_concentration') > 0)
  const isUninterrupted = hasConcentration
    ? (packet.rollUninterrupted !== undefined
        ? packet.rollUninterrupted < 20
        : resolvedRng.rand(100) < 20)
    : false

  const resolvedHitClass = resolveHitClassCode113c(packet.hitClass ?? attacker.weaponHitClass)
  const effectiveImmuneToElem =
    (elemResRec.isImmune && (rawElem256 > 0 || packet.skillId === 42) && !anyRiderChannelNonImmune) ||
    (!rawElem256 && anyRiderChannelRaw && !anyRiderChannelNonImmune && finalElem256 === 0)

  const defenderUninterruptable113c =
    defender.stateBus.hasState('uninterruptable') || defender.stateBus.hasState(54)
  const hasNonPoisonHitChannel113c =
    rawPhys256 > 0 || (rawElem256 > 0 && elemType !== 'pois') || anyRiderChannelRaw
  const resultFlags113c =
    (0x01 |
      (packet.missileResultFlags113c ?? 0) |
      (packet.missileResultFlags113c === undefined &&
      !(packet.noHitRecovery || packet.isPersistentGroundFire) &&
      !defenderUninterruptable113c &&
      hasNonPoisonHitChannel113c
        ? 0x04
        : 0) |
      (knockedBack ? 0x08 : 0) |
      (isCritical ? 0x2000 : 0)) >>>
    0
  const signedTotalDamage256 =
    (tracePhys256 +
      traceFire256 +
      traceLtng256 +
      traceMag256 +
      traceCold256 +
      resolvedPoisonBitrate256) |
    0

  if (sUnitDmgTraceObserver113c !== null) {
    // `0x20` is OR'd by `SUNITDMG_FillDamageValues` (`0x6FCFD492`). The monster melee caller
    // `0x6FC64AC0` zeroes the damage struct (`0x6FC64BDE rep stos`), so its swings never carry `0x02`.
    const hitFlags =
      ((attackKind !== 'spell' ? 0x20 : 0) |
        (packet.monStatsCritPct113c === undefined && (finalPhys256 > 0 || rawPhys256 > 0) ? 0x02 : 0) |
        (packet.missileHitFlags113c ?? 0)) >>>
      0
    const traceStunLen = Math.max(0, Math.trunc(packet.stunDurationFrames ?? 0)) >>> 0
    sUnitDmgTraceObserver113c({
      att: [atkRawType, atkNumericId],
      def: [defRawType, defNumericId],
      hp: [hpBefore256 >>> 0, hpBefore256 >>> 0],
      ret: signedTotalDamage256,
      raw: [
        hitFlags,
        resultFlags113c,
        tracePhys256 >>> 0,
        (packet.unrolledWeaponBase113c?.enDmgPct113c ?? 0) >>> 0,
        traceFire256 >>> 0,
        attackKind !== 'spell' ? 2 : 0,
        0,
        traceLtng256 >>> 0,
        traceMag256 >>> 0,
        traceCold256 >>> 0,
        resolvedPoisonBitrate256 >>> 0,
        resolvedPoisonDurationFrames >>> 0,
        traceColdLen >>> 0,
        0,
        attackerHealed256 >>> 0,
        attackerManaLeeched256 >>> 0,
        0,
        traceStunLen,
      ],
    })
  }

  return {
    hit: true,
    avoidedReason: 'none',
    immuneToElem: effectiveImmuneToElem,
    immuneToPhys: physResRec.isImmune && rawPhys256 > 0,
    physDamage256: finalPhys256,
    elemDamage256: finalElem256,
    totalDamage256,
    totalDamage: Math.ceil(totalDamage256 / FIXED_ONE),
    signedPhysDamage256: tracePhys256,
    signedTotalDamage256,
    resultFlags113c,
    targetHpBefore256: hpBefore256,
    targetHpAfter256: hpAfter256,
    targetKilled: hpAfter256 === 0 && hpBefore256 > 0,
    ...(isCritical ? { isCritical: true } : {}),
    ...(monsterCrit113c ? { monsterCrit113c: true } : {}),
    ...(isUninterrupted ? { uninterrupted: true } : {}),
    ...(knockedBack ? { knockedBack: true } : {}),
    ...(packet.noHitRecovery || packet.isPersistentGroundFire ? { noHitRecovery: true } : {}),
    ...(resolvedHitClass > 0 ? { hitClass: resolvedHitClass } : {}),
    ...(cbTriggered ? { crushingBlowTriggered: true, crushingBlowDamage256: cbDamage256 } : {}),
    ...(owTriggered
      ? { openWoundsTriggered: true, openWoundsBitrate256: owBitrate256, openWoundsFrames: 200 }
      : {}),
    ...(resolvedPoisonBitrate256 > 0 && resolvedPoisonDurationFrames > 0
      ? {
          poisonBitrate256: resolvedPoisonBitrate256,
          poisonDurationFrames: resolvedPoisonDurationFrames,
        }
      : {}),
    ...(attackerStatesApplied.length > 0 ? { attackerStatesApplied } : {}),
    ...(attackerColdDamage256 > 0 ? { attackerColdDamage256 } : {}),
    ...(reflectedPhys256 > 0 ? { reflectedPhys256 } : {}),
    ...(attackerHealed256 > 0 ? { attackerHealed256 } : {}),
    ...(attackerManaLeeched256 > 0 ? { attackerManaLeeched256 } : {}),
    ...(absorbHeal256 > 0 ? { absorbHeal256, defenderHealed256: absorbHeal256 } : {}),
    ...(packet.canTriggerProcs === false ? { procsSuppressed: true } : {}),
    ...(selfDamageTaken256 > 0 ? { selfDamageTaken256 } : {}),
    ...(targetDefenseReduction > 0 ? { targetDefenseReduction } : {}),
    ...(spawnedMissiles.length > 0 ? { spawnedMissiles } : {}),
    ...(attackerOverlaysApplied.length > 0 ? { attackerOverlaysApplied } : {}),
    ...(defenderOverlaysApplied.length > 0 ? { defenderOverlaysApplied } : {}),
    ...(unitOverlays.length > 0 ? { unitOverlays } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
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
    (wb as { type2?: string } | undefined)?.type2,
    weapon.type,
  ]
    .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
    .map(t => t.trim().toLowerCase())
  if (typeTokens.length === 0) {
    return { edPct: 0, arPct: 0, critPct: 0, critMult: 1 }
  }

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


/**
 * 1.13c Slow Target cap (`D2Game.dll` `ITEMEVENTS_ApplySlow` @ `0x6FCCD2C0..0x6FCCD38A`):
 * - `50%` vs `UNIT_PLAYER`, Hireling (`D2Common.#11104`), Boss (`D2Common.#10064`), or
 *   `fTypeFlags & 0x0E` (Unique `0x02`, Champion `0x04`, Boss `0x08`).
 * - `75%` vs SuperUnique (`D2Common.#10062`).
 * - `90%` vs Normal monsters.
 */
export function capTargetSlowPct113c(
  rawSlowPct: number,
  target: {
    readonly unitType?: string | undefined
    readonly isBoss?: boolean | undefined
    readonly isPrimeEvil?: boolean | undefined
    readonly isSuperUnique?: boolean | undefined
    readonly rank?: string | undefined
  },
): number {
  if (rawSlowPct <= 0) return 0
  const isPlayerOrHireling = target.unitType === 'player' || target.unitType === 'hireling' || target.unitType === 'merc'
  const isBossUniqueOrChampion =
    Boolean(target.isBoss) ||
    Boolean(target.isPrimeEvil) ||
    target.rank === 'boss' ||
    target.rank === 'unique' ||
    target.rank === 'champion'
  let cap = 90
  if (isPlayerOrHireling || isBossUniqueOrChampion) {
    cap = 50
  } else if (target.isSuperUnique || target.rank === 'superunique') {
    cap = 75
  }
  return Math.min(Math.trunc(rawSlowPct), cap)
}

/**
 * 1.13c Crushing Blow (`D2Game.dll` `ITEMEVENTS_ApplyCrushingBlow` @ `0x6FCCCC30..0x6FCCCD93`,
 * `itemeventfunc 16`, `STAT_ITEM_CRUSHINGBLOW = 136`):
 * 1. Base divisor `ebx`:
 *    - `4` (`1/4`) for Normal monsters, Minions (`0x10`), and **Champions (`0x04`, `rank === 'champion'`)**.
 *      (`0x6FCCCCBA` only checks `D2Common.#10064` `boss == 1` and `0x6FC42A80(pDefender, 2)` `fTypeFlags & 0x02`).
 *    - `8` (`1/8`) for Boss (`MonStats.txt` `boss == 1`) and Unique / SuperUnique (`fTypeFlags & 0x02`).
 *    - `10` (`1/10`) for `UNIT_PLAYER` and Hirelings (`D2Common.#11104 != 0`).
 * 2. Monster `/players N` divisor scaling (`0x6FCCF5F0` & `0x6FD1B614` HP bonus table):
 *    - `hpBonusPct = (max(1, playerCount) - 1) * 50`
 *    - `ebx = ebx + trunc((ebx * hpBonusPct) / 100)`
 * 3. Ranged / missile penalty (`nEvent == 6` = `ITEMEVENT_DOMISSILEDAMAGE` @ `0x6FCCCCE8..0x6FCCCCEF`):
 *    - `ebx *= 2` (`4 -> 8`, `8 -> 16`, `10 -> 20`).
 * 4. Physical resistance mitigation (`STAT_DAMAGERESIST = 36` @ `0x6FCCCD31..0x6FCCCD6A`):
 *    - Capped at `100`; applied **only when `physResPct > 0`**: `dmg -= trunc((dmg * physRes) / 100)`.
 *    - Negative `physResPct` does not amplify Crushing Blow damage.
 */
export interface CrushingBlow113cOptions {
  readonly defenderHp: number
  readonly unitType?: 'player' | 'monster' | undefined
  readonly isHireling?: boolean | undefined
  readonly isBoss?: boolean | undefined
  readonly isPrimeEvil?: boolean | undefined
  readonly isSuperUnique?: boolean | undefined
  readonly rank?: string | undefined
  readonly playerCount?: number | undefined
  readonly isRanged?: boolean | undefined
  readonly physResPct?: number | undefined
}

export function calculateCrushingBlow113c(
  options: CrushingBlow113cOptions,
): { readonly divisor: number; readonly damage: number } {
  let ebx = 4
  if (options.unitType === 'player' || options.isHireling) {
    ebx = 10
  } else {
    const isBossOrUnique =
      Boolean(options.isBoss) ||
      Boolean(options.isPrimeEvil) ||
      Boolean(options.isSuperUnique) ||
      options.rank === 'boss' ||
      options.rank === 'unique' ||
      options.rank === 'superunique'
    if (isBossOrUnique) {
      ebx = 8
    }
    const playerCount = Math.max(1, Math.trunc(options.playerCount ?? 1))
    const hpBonusPct = (playerCount - 1) * 50
    if (hpBonusPct > 0) {
      ebx += Math.trunc((ebx * hpBonusPct) / 100)
    }
  }
  if (options.isRanged) {
    ebx *= 2
  }
  if (options.defenderHp <= 0 || ebx <= 0) {
    return { divisor: ebx, damage: 0 }
  }
  let dmg = Math.trunc(options.defenderHp / ebx)
  const cappedRes = Math.min(100, Math.trunc(options.physResPct ?? 0))
  if (cappedRes >= 100) {
    dmg = 0
  } else if (cappedRes > 0) {
    dmg -= Math.trunc((dmg * cappedRes) / 100)
  }
  return { divisor: ebx, damage: Math.max(0, dmg) }
}

/**
 * 1.13c Item Knockback threshold out of 128 (`D2Game.dll` `ITEMEVENTS_ApplyKnockback` @ `0x6FCCCE60..0x6FCCCF0B`,
 * `itemeventfunc 7`, `STAT_ITEM_KNOCKBACK = 81`):
 * - `UNIT_PLAYER`: `0x40` (`64 / 128 = 50%`).
 * - `UNIT_MONSTER`: reads `MonStats2.txt` flags byte `+0x05`:
 *   - Bit `3` (`0x08`, `large` / `sizeX >= 3`): `0x20` (`32 / 128 = 25%`).
 *   - Bit `2` (`0x04`, `small` / `sizeX <= 1`): `0x80` (`128 / 128 = 100%`).
 *   - Otherwise (`medium` / `sizeX === 2`): `0x40` (`64 / 128 = 50%`).
 */
export function getItemKnockbackThreshold128_113c(options: {
  readonly unitType?: 'player' | 'monster' | undefined
  readonly sizeX?: number | undefined
}): number {
  if (options.unitType === 'player') return 64
  const sizeX = options.sizeX ?? 2
  if (sizeX >= 3) return 32
  if (sizeX <= 1) return 128
  return 64
}

export function rollItemKnockback113c(
  rng: CombatRng,
  options: {
    readonly unitType?: 'player' | 'monster' | undefined
    readonly sizeX?: number | undefined
  },
): boolean {
  const threshold128 = getItemKnockbackThreshold128_113c(options)
  return (rng.rand(128) & 0x7f) < threshold128
}

/**
 * 1.13c Server Knockback trajectory (`D2Game.dll` `0x6FC951F6..0x6FC9520E` & `D2Common.dll` `0x6FDB7390`):
 * - `nDist = (BaseId == 78 'sandmaggot1', hcIdx 49..53) ? 10 : 5`
 * - `stepDist = (nDist >> 1) + 1` (`3` sub-tiles standard, `6` sub-tiles `sandmaggot1`)
 * - Chebyshev vector scaling:
 *   `maxDelta = max(abs(dx), abs(dy))`
 *   `destX = targetX + trunc((stepDist * dx) / maxDelta)`
 *   `destY = targetY + trunc((stepDist * dy) / maxDelta)`
 */
export function computeKnockbackStep113c(options: {
  readonly targetX: number
  readonly targetY: number
  readonly sourceX: number
  readonly sourceY: number
  readonly hcIdx?: number | undefined
  readonly baseId?: string | number | undefined
}): {
  readonly nDist: number
  readonly stepDist: number
  readonly destX: number
  readonly destY: number
} {
  const isSandMaggot =
    options.baseId === 78 ||
    options.baseId === 'sandmaggot1' ||
    (options.hcIdx !== undefined && options.hcIdx >= 49 && options.hcIdx <= 53)
  const nDist = isSandMaggot ? 10 : 5
  const stepDist = (nDist >> 1) + 1
  const dx = options.targetX - options.sourceX
  const dy = options.targetY - options.sourceY
  const maxDelta = Math.max(Math.abs(dx), Math.abs(dy))
  if (!Number.isFinite(maxDelta) || maxDelta <= 0) {
    return {
      nDist,
      stepDist,
      destX: options.targetX,
      destY: options.targetY,
    }
  }
  return {
    nDist,
    stepDist,
    destX: options.targetX + Math.trunc((stepDist * dx) / maxDelta),
    destY: options.targetY + Math.trunc((stepDist * dy) / maxDelta),
  }
}
