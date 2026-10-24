/**
 * Diablo II: Lord of Destruction v1.13c Unit `StatList` (`D2StatListStrc` Parity).
 *
 * Enforces:
 * - 256-fixed-point (`<< 8`, `HIT_SHIFT = 8`) integer arithmetic for life (`hitpoints`/`maxhp`),
 *   mana (`mana`/`maxmana`), stamina (`stamina`/`maxstamina`), and per-frame poison/burn bitrates.
 * - Strict separation of base allocated skill points (`STAT_SKILLPTS` -> `getBaseSkillLevel(skillId)`)
 *   from item/buff `+skills` and item charges (`STAT_ITEM_CHARGED_SKILL`), enforcing the 1.13c
 *   Marrowwalk / charge synergy fix (`blvl` never includes `+skills` or charges).
 * - Dynamic `SkillStatModifier` lists with `expireFrame` (`dwExpireFrame`), `stateId`, and `slvl`.
 */
import type { D2DataRegistry } from '../../common/data/data-registry.ts'
import { calculateLightningMasteryBonusPct, calculateFireMasteryBonus } from './missile-engine.ts'

export const HIT_SHIFT = 8
export const FIXED_ONE = 1 << HIT_SHIFT // 256

export interface SkillStatModifier {
  readonly id: string
  readonly stateName: string
  readonly stateId: number
  readonly sourceUnitId: string
  readonly sourceSkillId: number
  readonly slvl: number
  /** Frame (`tick`) at which this modifier expires (`0` = permanent/passive/toggle). */
  expireFrame: number
  readonly isAura?: boolean
  readonly isCurse?: boolean
  readonly curseType?: number
  readonly stats: Readonly<Record<string, number>>
}

export class UnitStatList {
  readonly registry: D2DataRegistry | undefined
  private readonly baseStats = new Map<string, number>()
  private readonly baseSkillLevels = new Map<number, number>()
  private readonly bonusSkillLevels = new Map<number, number>()
  private readonly chargedSkillLevels = new Map<number, number>()
  private allSkillsBonus = 0
  private classSkillsBonus = 0
  private readonly modifiers: SkillStatModifier[] = []

  constructor(registry?: D2DataRegistry, initialStats?: Readonly<Record<string, number>>) {
    this.registry = registry
    // Sensible defaults in 256-fixed-point for HP/Mana/Stamina
    this.baseStats.set('level', 80)
    this.baseStats.set('strength', 100)
    this.baseStats.set('dexterity', 100)
    this.baseStats.set('vitality', 150)
    this.baseStats.set('energy', 100)
    this.baseStats.set('maxhp', 1000 << HIT_SHIFT)
    this.baseStats.set('hitpoints', 1000 << HIT_SHIFT)
    this.baseStats.set('maxmana', 1000 << HIT_SHIFT)
    this.baseStats.set('mana', 1000 << HIT_SHIFT)
    this.baseStats.set('maxstamina', 500 << HIT_SHIFT)
    this.baseStats.set('stamina', 500 << HIT_SHIFT)
    this.baseStats.set('tohit', 2500)
    this.baseStats.set('armorclass', 500)

    if (initialStats) {
      for (const [k, v] of Object.entries(initialStats)) {
        this.setBaseStat(k, v)
      }
    }
  }

  private normalizeStatKey(statNameOrId: string | number): string {
    if (typeof statNameOrId === 'number') {
      const rec = this.registry?.getStatById(statNameOrId)
      return rec ? rec.stat.toLowerCase() : String(statNameOrId)
    }
    return statNameOrId.trim().toLowerCase()
  }

  setBaseStat(statNameOrId: string | number, value: number): void {
    const key = this.normalizeStatKey(statNameOrId)
    this.baseStats.set(key, Math.trunc(value))
  }

  addStat(statNameOrId: string | number, delta: number): void {
    const key = this.normalizeStatKey(statNameOrId)
    if (key === 'item_allskills') {
      this.allSkillsBonus += Math.trunc(delta)
    }
    this.baseStats.set(key, (this.baseStats.get(key) ?? 0) + Math.trunc(delta))
  }

  getBaseStat(statNameOrId: string | number): number {
    const key = this.normalizeStatKey(statNameOrId)
    return this.baseStats.get(key) ?? 0
  }

  /**
   * Set hard-invested `STAT_SKILLPTS` (`blvl`) for a skill.
   */
  setBaseSkillLevel(skillId: number, blvl: number): void {
    this.baseSkillLevels.set(skillId, Math.max(0, Math.trunc(blvl)))
  }

  /**
   * 1.13c Ground Truth (`D2Common`): returns strictly hard-allocated `STAT_SKILLPTS` (`blvl`).
   * Never includes `bonusSkillLevels`, `allSkillsBonus`, or `chargedSkillLevels` (`Marrowwalk` fix).
   */
  getBaseSkillLevel(skillId: number): number {
    return this.baseSkillLevels.get(skillId) ?? 0
  }

  setBonusSkillLevel(skillId: number, bonus: number): void {
    this.bonusSkillLevels.set(skillId, Math.trunc(bonus))
  }

  setAllSkillsBonus(bonus: number): void {
    this.allSkillsBonus = Math.trunc(bonus)
  }

  setClassSkillsBonus(bonus: number): void {
    this.classSkillsBonus = Math.trunc(bonus)
  }

  /**
   * Set item skill charges (`STAT_ITEM_CHARGED_SKILL`, e.g. Level 33 Bone Prison on Marrowwalk boots).
   * Stored in `chargedSkillLevels` and strictly excluded from `getBaseSkillLevel(skillId)` in 1.13c!
   */
  setChargedSkillLevel(skillId: number, chargeSlvl: number): void {
    this.chargedSkillLevels.set(skillId, Math.max(0, Math.trunc(chargeSlvl)))
  }

  getChargedSkillLevel(skillId: number): number {
    return this.chargedSkillLevels.get(skillId) ?? 0
  }

  /**
   * Effective skill level (`lvl = blvl + bonusSkill + allSkills + classSkills + modAllSkills`).
   */
  getEffectiveSkillLevel(skillId: number): number {
    const base = this.getBaseSkillLevel(skillId)
    const singleBonus = this.bonusSkillLevels.get(skillId) ?? 0
    const modAllSkills = this.getModifierBonus('item_allskills') + this.getModifierBonus('allskills')
    const total = base + singleBonus + this.allSkillsBonus + this.classSkillsBonus + modAllSkills
    return Math.max(0, total)
  }

  /**
   * Sum dynamic modifier bonuses for a given stat.
   * For duplicate aura states (`isAura === true` with same `stateId`), only the highest `slvl`
   * active modifier contributes its stats (`1.13c` aura stacking/level override rule).
   */
  getModifierBonus(statNameOrId: string | number): number {
    const key = this.normalizeStatKey(statNameOrId)
    const bestAuraByState = new Map<number, SkillStatModifier>()
    let sum = 0

    for (const mod of this.modifiers) {
      if (mod.isAura && mod.stateId > 0) {
        const prev = bestAuraByState.get(mod.stateId)
        if (!prev || mod.slvl >= prev.slvl) {
          bestAuraByState.set(mod.stateId, mod)
        }
      } else {
        sum += mod.stats[key] ?? 0
      }
    }

    for (const auraMod of bestAuraByState.values()) {
      sum += auraMod.stats[key] ?? 0
    }

    return Math.trunc(sum)
  }

  /**
   * Get accrued stat value (`D2Common_GetStatSigned`, `stat('...'.accr)`).
   * Handles `%` max life/mana (`item_maxhp_percent`, `item_maxmana_percent`, `item_armor_percent`).
   */
  getAccruedStat(statNameOrId: string | number, baseOnly = false): number {
    const key = this.normalizeStatKey(statNameOrId)
    const base = this.getBaseStat(key)
    if (baseOnly) return base

    const modBonus = this.getModifierBonus(key)
    let total = base + modBonus

    if (key === 'maxhp') {
      const pct = this.getModifierBonus('item_maxhp_percent') + this.getModifierBonus('maxhp_percent')
      if (pct !== 0) {
        total = Math.trunc((total * (100 + pct)) / 100)
      }
    } else if (key === 'maxmana') {
      const pct = this.getModifierBonus('item_maxmana_percent') + this.getModifierBonus('maxmana_percent')
      if (pct !== 0) {
        total = Math.trunc((total * (100 + pct)) / 100)
      }
    } else if (key === 'maxstamina') {
      let incStamPct = 0
      const base141 = this.getBaseSkillLevel(141)
      const single141 = this.bonusSkillLevels.get(141) ?? 0
      if (
        (base141 > 0 || single141 > 0) &&
        !this.modifiers.some(m => m.sourceSkillId === 141 || m.stateName === 'increasedstamina')
      ) {
        const eff141 = this.getEffectiveSkillLevel(141)
        if (eff141 > 0) {
          incStamPct = 30 + 15 * (eff141 - 1)
        }
      }
      const pct =
        this.getModifierBonus('item_maxstamina_percent') +
        this.getBaseStat('item_maxstamina_percent') +
        this.getModifierBonus('staminapercent') +
        this.getBaseStat('staminapercent') +
        this.getModifierBonus('skill_staminapercent') +
        this.getBaseStat('skill_staminapercent') +
        incStamPct
      if (pct !== 0) {
        total = Math.trunc((total * (100 + pct)) / 100)
      }
    } else if (key === 'item_maxstamina_percent' || key === 'staminarecoverybonus') {
      const base141 = this.getBaseSkillLevel(141)
      const single141 = this.bonusSkillLevels.get(141) ?? 0
      if (
        (base141 > 0 || single141 > 0) &&
        !this.modifiers.some(m => m.sourceSkillId === 141 || m.stateName === 'increasedstamina')
      ) {
        const eff141 = this.getEffectiveSkillLevel(141)
        if (eff141 > 0) {
          total += 30 + 15 * (eff141 - 1)
        }
      }
    } else if (key === 'armorclass') {
      let ironSkinPct = 0
      const base145 = this.getBaseSkillLevel(145)
      const single145 = this.bonusSkillLevels.get(145) ?? 0
      if (
        (base145 > 0 || single145 > 0) &&
        !this.modifiers.some(m => m.sourceSkillId === 145 || m.stateName === 'ironskin')
      ) {
        const eff145 = this.getEffectiveSkillLevel(145)
        if (eff145 > 0) {
          ironSkinPct = 30 + 10 * (eff145 - 1)
        }
      }
      const pct =
        this.getModifierBonus('item_armor_percent') +
        this.getBaseStat('item_armor_percent') +
        this.getModifierBonus('skill_armor_percent') +
        this.getBaseStat('skill_armor_percent') +
        this.getModifierBonus('armor_percent') +
        this.getBaseStat('armor_percent') +
        ironSkinPct
      if (pct !== 0) {
        total = Math.trunc((total * (100 + pct)) / 100)
      }
    } else if (key === 'skill_armor_percent') {
      const base145 = this.getBaseSkillLevel(145)
      const single145 = this.bonusSkillLevels.get(145) ?? 0
      if (
        (base145 > 0 || single145 > 0) &&
        !this.modifiers.some(m => m.sourceSkillId === 145 || m.stateName === 'ironskin')
      ) {
        const eff145 = this.getEffectiveSkillLevel(145)
        if (eff145 > 0) {
          total += 30 + 10 * (eff145 - 1)
        }
      }
    } else if (key === 'velocitypercent') {
      const base148 = this.getBaseSkillLevel(148)
      const single148 = this.bonusSkillLevels.get(148) ?? 0
      if (
        (base148 > 0 || single148 > 0) &&
        !this.modifiers.some(m => m.sourceSkillId === 148 || m.stateName === 'increasedspeed')
      ) {
        const eff148 = this.getEffectiveSkillLevel(148)
        if (eff148 > 0) {
          total += 7 + Math.trunc((43 * Math.trunc((110 * eff148) / (eff148 + 6))) / 100)
        }
      }
    } else if (
      key === 'fireresist' ||
      key === 'coldresist' ||
      key === 'lightresist' ||
      key === 'poisonresist'
    ) {
      const base153 = this.getBaseSkillLevel(153)
      const single153 = this.bonusSkillLevels.get(153) ?? 0
      if (
        (base153 > 0 || single153 > 0) &&
        !this.modifiers.some(m => m.sourceSkillId === 153 || m.stateName === 'naturalresistance')
      ) {
        const eff153 = this.getEffectiveSkillLevel(153)
        if (eff153 > 0) {
          total += Math.trunc((80 * Math.trunc((110 * eff153) / (eff153 + 6))) / 100)
        }
      }
    } else if (
      key === 'passive_mastery_throw_th' ||
      key === 'passive_mastery_throw_dmg' ||
      key === 'passive_mastery_throw_crit'
    ) {
      const base135 = this.getBaseSkillLevel(135)
      const single135 = this.bonusSkillLevels.get(135) ?? 0
      if (
        (base135 > 0 || single135 > 0) &&
        !this.modifiers.some(m => m.sourceSkillId === 135 || m.stateName === 'throwingmastery')
      ) {
        const eff135 = this.getEffectiveSkillLevel(135)
        if (eff135 > 0) {
          if (key === 'passive_mastery_throw_th') {
            total += 30 + 8 * (eff135 - 1)
          } else if (key === 'passive_mastery_throw_dmg') {
            total += 28 + 5 * (eff135 - 1)
          } else {
            total += Math.trunc((35 * Math.trunc((110 * eff135) / (eff135 + 6))) / 100)
          }
        }
      }
    } else if (key === 'passive_weaponblock' || key === 'weaponblock') {
      const otherKey = key === 'passive_weaponblock' ? 'weaponblock' : 'passive_weaponblock'
      total =
        Math.max(this.getBaseStat(key), this.getBaseStat(otherKey)) +
        Math.max(this.getModifierBonus(key), this.getModifierBonus(otherKey))
      const base263 = this.getBaseSkillLevel(263)
      const single263 = this.bonusSkillLevels.get(263) ?? 0
      if (
        total === 0 &&
        (base263 > 0 || single263 > 0) &&
        !this.modifiers.some(m => m.sourceSkillId === 263 || m.stateName === 'weaponblock')
      ) {
        const eff263 = this.getEffectiveSkillLevel(263)
        if (eff263 > 0) {
          total += 10 + Math.trunc((50 * Math.trunc((110 * eff263) / (eff263 + 6))) / 100)
        }
      }
    } else if (key === 'passive_dodge') {
      const base13 = this.getBaseSkillLevel(13)
      const single13 = this.bonusSkillLevels.get(13) ?? 0
      if (
        total === 0 &&
        (base13 > 0 || single13 > 0) &&
        !this.modifiers.some(m => m.sourceSkillId === 13 || m.stateName === 'dodge')
      ) {
        const eff13 = this.getEffectiveSkillLevel(13)
        if (eff13 > 0) {
          total += 10 + Math.trunc((55 * Math.trunc((110 * eff13) / (eff13 + 6))) / 100)
        }
      }
    } else if (key === 'passive_avoid') {
      const base18 = this.getBaseSkillLevel(18)
      const single18 = this.bonusSkillLevels.get(18) ?? 0
      if (
        total === 0 &&
        (base18 > 0 || single18 > 0) &&
        !this.modifiers.some(m => m.sourceSkillId === 18 || m.stateName === 'avoid')
      ) {
        const eff18 = this.getEffectiveSkillLevel(18)
        if (eff18 > 0) {
          total += 15 + Math.trunc((60 * Math.trunc((110 * eff18) / (eff18 + 6))) / 100)
        }
      }
    } else if (key === 'passive_evade') {
      const base29 = this.getBaseSkillLevel(29)
      const single29 = this.bonusSkillLevels.get(29) ?? 0
      if (
        total === 0 &&
        (base29 > 0 || single29 > 0) &&
        !this.modifiers.some(m => m.sourceSkillId === 29 || m.stateName === 'evade')
      ) {
        const eff29 = this.getEffectiveSkillLevel(29)
        if (eff29 > 0) {
          total += 10 + Math.trunc((55 * Math.trunc((110 * eff29) / (eff29 + 6))) / 100)
        }
      }
    } else if (
      key === 'passive_mastery_melee_th' ||
      key === 'passive_mastery_melee_dmg' ||
      key === 'passive_mastery_melee_crit' ||
      key === 'passive_mastery_crit'
    ) {
      if (key === 'passive_mastery_melee_crit' || key === 'passive_mastery_crit') {
        const otherCritKey =
          key === 'passive_mastery_melee_crit' ? 'passive_mastery_crit' : 'passive_mastery_melee_crit'
        total =
          Math.max(this.getBaseStat(key), this.getBaseStat(otherCritKey)) +
          Math.max(this.getModifierBonus(key), this.getModifierBonus(otherCritKey))
      }
      const base252 = this.getBaseSkillLevel(252)
      const single252 = this.bonusSkillLevels.get(252) ?? 0
      if (
        total === 0 &&
        (base252 > 0 || single252 > 0) &&
        !this.modifiers.some(m => m.sourceSkillId === 252 || m.stateName === 'clawmastery')
      ) {
        const eff252 = this.getEffectiveSkillLevel(252)
        if (eff252 > 0) {
          if (key === 'passive_mastery_melee_th') {
            total += 30 + 10 * (eff252 - 1)
          } else if (key === 'passive_mastery_melee_dmg') {
            total += 35 + 4 * (eff252 - 1)
          } else {
            total += Math.trunc((25 * Math.trunc((110 * eff252) / (eff252 + 6))) / 100)
          }
        }
      }
    } else if (key === 'passive_ltng_mastery' || key === 'passive_lightning_mastery') {
      const base = this.getBaseSkillLevel(63)
      const single = this.bonusSkillLevels.get(63) ?? 0
      if (base > 0 || single > 0) {
        const effLvl = this.getEffectiveSkillLevel(63)
        if (effLvl > 0) {
          total += calculateLightningMasteryBonusPct(effLvl)
        }
      }
    } else if (key === 'passive_fire_mastery') {
      const base = this.getBaseSkillLevel(61)
      const single = this.bonusSkillLevels.get(61) ?? 0
      if (base > 0 || single > 0) {
        const effLvl = this.getEffectiveSkillLevel(61)
        if (effLvl > 0) {
          total += calculateFireMasteryBonus(effLvl)
        }
      }
    } else if (key === 'passive_ar_bonus_pct') {
      const hasActiveBlessedAim = this.modifiers.some(
        m => m.sourceSkillId === 108 || m.stateName === 'blessedaim',
      )
      if (!hasActiveBlessedAim) {
        const blvlBlessedAim = this.getBaseSkillLevel(108)
        total += blvlBlessedAim * 5
      }
    } else if (key === 'tohit') {
      const hasActiveBlessedAim = this.modifiers.some(
        m => m.sourceSkillId === 108 || m.stateName === 'blessedaim',
      )
      const blvlBlessedAim = hasActiveBlessedAim ? 0 : this.getBaseSkillLevel(108)
      const passiveArBonus =
        blvlBlessedAim * 5 +
        this.getModifierBonus('passive_ar_bonus_pct') +
        this.getBaseStat('passive_ar_bonus_pct')
      const pct =
        this.getModifierBonus('tohit_percent') +
        this.getBaseStat('tohit_percent') +
        this.getModifierBonus('item_tohit_percent') +
        this.getBaseStat('item_tohit_percent') +
        passiveArBonus
      if (pct !== 0) {
        total = Math.trunc((total * (100 + pct)) / 100)
      }
    } else if (key === 'maxfireresist') {
      const blvlResistFire = this.getBaseSkillLevel(100)
      const hasActiveResistFire = this.modifiers.some(
        m => m.sourceSkillId === 100 || m.stateName === 'resistfire',
      )
      if (!hasActiveResistFire) {
        total += Math.floor(blvlResistFire / 2)
      } else if (modBonus === 0 && blvlResistFire > 0) {
        total += blvlResistFire
      }
    } else if (key === 'maxcoldresist') {
      const blvlResistCold = this.getBaseSkillLevel(105)
      const hasActiveResistCold = this.modifiers.some(
        m => m.sourceSkillId === 105 || m.stateName === 'resistcold',
      )
      if (!hasActiveResistCold) {
        total += Math.floor(blvlResistCold / 2)
      } else if (modBonus === 0 && blvlResistCold > 0) {
        total += blvlResistCold
      }
    } else if (key === 'maxlightresist') {
      const blvlResistLight = this.getBaseSkillLevel(110)
      const hasActiveResistLight = this.modifiers.some(
        m => m.sourceSkillId === 110 || m.stateName === 'resistlight',
      )
      if (!hasActiveResistLight) {
        total += Math.floor(blvlResistLight / 2)
      } else if (modBonus === 0 && blvlResistLight > 0) {
        total += blvlResistLight
      }
    }

    return Math.trunc(total)
  }

  /**
   * Player/hireling resistance cap for a channel with a max stat.
   * 1.13c `D2Game.dll` 0x6FCFB457..0x6FCFB46B: `min(95, 75 + stat(max))` where the max stat is
   * `maxfireresist` (40) / `maxlightresist` (42) / `maxcoldresist` (44) / `maxpoisonresist` (46) /
   * `maxmagicresist` (38). There is no lower clamp on the cap.
   */
  getEffectiveMaxResistance(elemType: 'fire' | 'cold' | 'ltng' | 'pois' | 'mag'): number {
    const statKey =
      elemType === 'fire'
        ? 'maxfireresist'
        : elemType === 'cold'
          ? 'maxcoldresist'
          : elemType === 'ltng'
            ? 'maxlightresist'
            : elemType === 'pois'
              ? 'maxpoisonresist'
              : 'maxmagicresist'
    const bonus = Math.trunc(this.getAccruedStat(statKey))
    return Math.min(95, 75 + bonus)
  }

  /**
   * Attach or update a `SkillStatModifier`.
   */
  addOrUpdateModifier(mod: SkillStatModifier): void {
    const normStats: Record<string, number> = {}
    for (const [k, v] of Object.entries(mod.stats)) {
      normStats[this.normalizeStatKey(k)] = Math.trunc(v)
    }
    const normalizedMod: SkillStatModifier = {
      ...mod,
      stats: normStats,
    }

    const existingIdx = this.modifiers.findIndex(
      m =>
        m.id === normalizedMod.id ||
        (!normalizedMod.isAura && m.stateName.toLowerCase() === normalizedMod.stateName.toLowerCase()),
    )
    if (existingIdx !== -1) {
      this.modifiers[existingIdx] = normalizedMod
    } else {
      this.modifiers.push(normalizedMod)
    }
  }

  removeModifiersByState(stateNameOrId: string | number): SkillStatModifier[] {
    const removed: SkillStatModifier[] = []
    for (let i = this.modifiers.length - 1; i >= 0; i -= 1) {
      const m = this.modifiers[i]!
      const match =
        typeof stateNameOrId === 'number'
          ? m.stateId === stateNameOrId
          : m.stateName.toLowerCase() === stateNameOrId.trim().toLowerCase()
      if (match) {
        removed.push(m)
        this.modifiers.splice(i, 1)
      }
    }
    return removed
  }

  removeModifiersByFilter(predicate: (mod: SkillStatModifier) => boolean): SkillStatModifier[] {
    const removed: SkillStatModifier[] = []
    for (let i = this.modifiers.length - 1; i >= 0; i -= 1) {
      const m = this.modifiers[i]!
      if (predicate(m)) {
        removed.push(m)
        this.modifiers.splice(i, 1)
      }
    }
    return removed
  }

  /**
   * Expire any modifier whose `expireFrame > 0 && expireFrame <= currentFrame`.
   */
  expireAtFrame(currentFrame: number): SkillStatModifier[] {
    return this.removeModifiersByFilter(m => m.expireFrame > 0 && m.expireFrame <= currentFrame)
  }

  getActiveModifiers(): readonly SkillStatModifier[] {
    return this.modifiers
  }

  /**
   * Convenience helpers for 256-fixed-point (`<< 8`) HP and Mana access.
   */
  getHp256(): number {
    return this.getBaseStat('hitpoints')
  }

  getHp(): number {
    return Math.ceil(this.getHp256() / FIXED_ONE)
  }

  getMaxHp256(): number {
    return this.getAccruedStat('maxhp')
  }

  getMaxHp(): number {
    return Math.ceil(this.getMaxHp256() / FIXED_ONE)
  }

  setHp256(hp256: number): void {
    const clamped = Math.max(0, Math.min(this.getMaxHp256(), Math.trunc(hp256)))
    this.setBaseStat('hitpoints', clamped)
  }

  getMana256(): number {
    return this.getBaseStat('mana')
  }

  getMana(): number {
    return Math.floor(this.getMana256() / FIXED_ONE)
  }

  getMaxMana256(): number {
    return this.getAccruedStat('maxmana')
  }

  setMana256(mana256: number): void {
    const clamped = Math.max(0, Math.min(this.getMaxMana256(), Math.trunc(mana256)))
    this.setBaseStat('mana', clamped)
  }

  /**
   * 1.13c SUNITDMG_DrainItemDurability: Drains durability from equipped weapon upon contact hits (e.g. Blade Shield).
   */
  drainEquippedWeaponDurability(amount: number = 1): number {
    const cur = this.getBaseStat('durability')
    if (cur > 0) {
      const updated = Math.max(0, cur - amount)
      this.setBaseStat('durability', updated)
      return updated
    }
    return 0
  }
}

