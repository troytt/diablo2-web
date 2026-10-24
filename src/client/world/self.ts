/**
 * Local Player Authoritative Mirror (`src/client/world/self.ts`).
 *
 * Tracks the local player's unit ID, class, position, life/mana/stamina,
 * gold, experience, stats, skill list, active left/right hand skills,
 * run/walk toggle, active weapon set, and mercenary ID.
 */

import type { CharClassId, SkillLevel } from '../../netproto/index.ts'
import type { UnitCastState } from './client-unit.ts'
import {
  STAT_EXPERIENCE,
  STAT_GOLD,
  STAT_GOLDBANK,
  STAT_HITPOINTS,
  STAT_LEVEL,
  STAT_MANA,
  STAT_MAXHP,
  STAT_MAXMANA,
  STAT_MAXSTAMINA,
  STAT_STAMINA,
  StatList,
} from './stat-list.ts'

export interface SelfPlayerState {
  unitId: number
  name: string
  /** `null` until the server assigns the class (MCP char list / `0x59` UnitAssign). */
  charClass: CharClassId | null
  level: number
  x: number
  y: number
  targetX: number
  targetY: number
  life: number
  maxLife: number
  mana: number
  maxMana: number
  /** True once mana or maxMana has been explicitly set or synced from server packets (`0x18`/`0x95`/`StatSet`). */
  readonly hasManaState?: boolean | undefined
  stamina: number
  maxStamina: number
  gold: number
  stashGold: number
  experience: number
  readonly stats: StatList
  readonly skills: ReadonlyMap<number, number>
  readonly skillEntries: ReadonlyMap<number, SkillLevel>
  readonly states: ReadonlySet<number>
  readonly skillCharges?: ReadonlyMap<number, number> | undefined
  leftSkill: number
  rightSkill: number
  runMode: boolean
  moving: boolean
  mode: number
  weaponSet: 0 | 1
  mercId: number | null
  isDead: boolean
  castState?: UnitCastState | undefined
  applyStat(stat: number, value: number, param?: number): void
  applyLifeMana?(
    life: number,
    mana: number,
    stamina: number,
    x: number,
    y: number,
    lifeRegen?: number,
    manaRegen?: number,
  ): void
}

export class MutableSelfPlayerState implements SelfPlayerState {
  unitId = 0
  name = ''
  charClass: CharClassId | null = null
  level = 0
  x = 0
  y = 0
  targetX = 0
  targetY = 0
  life = 0
  maxLife = 0
  private _mana = 0
  private _maxMana = 0
  private _hasManaState = false
  stamina = 0
  maxStamina = 0

  get mana(): number {
    return this._mana
  }

  set mana(val: number) {
    this._mana = val
    this._hasManaState = true
  }

  get maxMana(): number {
    return this._maxMana
  }

  set maxMana(val: number) {
    this._maxMana = val
    this._hasManaState = true
  }

  get hasManaState(): boolean {
    return this._hasManaState
  }
  gold = 0
  stashGold = 0
  experience = 0
  readonly stats = new StatList()
  readonly skills = new Map<number, number>()
  readonly skillEntries = new Map<number, SkillLevel>()
  readonly states = new Set<number>()
  readonly skillCharges = new Map<number, number>()
  leftSkill = 0
  rightSkill = 0
  runMode = true
  moving = false
  mode = 1
  weaponSet: 0 | 1 = 0
  mercId: number | null = null
  isDead = false
  castState?: UnitCastState | undefined

  /**
   * Apply one server stat update (`0x1D`/`0x1E`/`0x1F` BaseAttribute byte/word/dword, `0x19` gold delta).
   *
   * Wire format of the pool stats 6..11 (hitpoints, maxhp, mana, maxmana, stamina, maxstamina): the value is
   * the engine's internal **8.8 fixed-point** number (`ItemStatCost.txt` ValShift = 8 for these six stats),
   * so the displayed integer is always `value >> 8` — unconditionally, never by magnitude.
   * Evidence (tests/fixtures/netproto/0[234]-*.d2cap, fresh level-1 Assassin "WebBotOne"): raw packets
   * `1e 07 00 32` / `1e 09 00 19` / `1e 0b 00 5f` decode (u16 LE, as every other D2GS field) to
   * 12800 / 6400 / 24320 = maxhp 50 (vit 20 + hpadd 30) / maxmana 25 / maxstamina 95 in 8.8, with a zero
   * fractional byte; `0x95` (15-bit plain integer) confirms life = 50. The StatList keeps the raw value.
   */
  applyStat(stat: number, value: number, param = 0): void {
    if (stat === STAT_GOLD && param === 1) {
      this.gold = Math.max(0, this.gold + value)
      this.stats.set(STAT_GOLD, this.gold)
      return
    }
    this.stats.set(stat, value, param)
    switch (stat) {
      case STAT_HITPOINTS:
        this.life = poolStatValue(value)
        // D2Client.dll 0x6fb5ee00 -> 0x6fb5eb10 (0x6fb5eb2a: `test eax, eax; je ...; cmp [esi+0x10], 0x11`):
        // A positive raw 8.8 STAT_HITPOINTS value (including sub-integer 1..255 from poison clamping at 1/256 HP)
        // revives a dead player, and STAT_HITPOINTS / STAT_MAXHP updates NEVER mark a living player dead.
        if (value > 0) {
          this.isDead = false
        }
        break
      case STAT_MAXHP:
        this.maxLife = poolStatValue(value)
        break
      case STAT_MANA:
        this.mana = poolStatValue(value)
        break
      case STAT_MAXMANA:
        this.maxMana = poolStatValue(value)
        break
      case STAT_STAMINA:
        this.stamina = poolStatValue(value)
        break
      case STAT_MAXSTAMINA:
        this.maxStamina = poolStatValue(value)
        break
      case STAT_LEVEL:
        this.level = value
        break
      case STAT_EXPERIENCE:
        this.experience = value >>> 0
        break
      case STAT_GOLD:
        this.gold = value
        break
      case STAT_GOLDBANK:
        this.stashGold = value
        break
    }
  }

  /**
   * `0x18` / `0x95` current life / mana / stamina (15-bit integers on the wire),
   * plus `0x18 HPMPUpdate` 7-bit `lifeRegen` (`STAT_HPREGEN = 74`) and `manaRegen` (`STAT_MANARECOVERY = 26`)
   * per `D2Client.dll 0x6fb5eca0` (`0x6fb5ecf7..0x6fb5ed12`).
   * `0x95 HPMPPotUpdate` (`lifeRegen === undefined`) leaves stored `STAT_HPREGEN`/`STAT_MANARECOVERY` untouched.
   */
  applyLifeMana(
    life: number,
    mana: number,
    stamina: number,
    x: number,
    y: number,
    lifeRegen?: number,
    manaRegen?: number,
  ): void {
    if (life >= 0) {
      this.life = life
      const rawHp = this.stats.get(STAT_HITPOINTS)
      if (life > 0 || rawHp <= 0 || rawHp >= (1 << POOL_STAT_VAL_SHIFT)) {
        this.stats.set(STAT_HITPOINTS, life << POOL_STAT_VAL_SHIFT)
      }
      // D2Client.dll 0x6fb5ebe0 (0x95, 0x6fb5ec78) & 0x6fb5eca0 (0x18, 0x6fb5ed58):
      // `test edi, edi; je ...; cmp [esi+0x10], 0x11`: life > 0 revives from PLRMODE_DEAD (17),
      // whereas life == 0 (e.g. poisoned to 1..255 raw 8.8 HP where rawHp >> 8 == 0) NEVER sets death.
      if (life > 0) {
        this.isDead = false
      }
    }
    if (mana >= 0) {
      this.mana = mana
      this.stats.set(STAT_MANA, mana << POOL_STAT_VAL_SHIFT)
    }
    if (stamina >= 0) {
      this.stamina = stamina
      this.stats.set(STAT_STAMINA, stamina << POOL_STAT_VAL_SHIFT)
    }
    if (typeof lifeRegen === 'number') {
      this.stats.set(STAT_HPREGEN, lifeRegen)
    }
    if (typeof manaRegen === 'number') {
      this.stats.set(STAT_MANARECOVERY, manaRegen)
    }
    if (x !== 0 || y !== 0) {
      this.x = x
      this.y = y
      this.targetX = x
      this.targetY = y
    }
  }

  applyExperience(value: number, isDelta = false): void {
    if (isDelta) {
      this.experience = (this.experience + value) >>> 0
    } else {
      this.experience = value >>> 0
    }
    this.stats.set(STAT_EXPERIENCE, this.experience)
  }

  reset(): void {
    this.unitId = 0
    this.name = ''
    this.charClass = null
    this.level = 0
    this.x = 0
    this.y = 0
    this.targetX = 0
    this.targetY = 0
    this.life = 0
    this.maxLife = 0
    this._mana = 0
    this._maxMana = 0
    this._hasManaState = false
    this.stamina = 0
    this.maxStamina = 0
    this.gold = 0
    this.stashGold = 0
    this.experience = 0
    this.stats.clear()
    this.skills.clear()
    this.skillEntries.clear()
    this.states.clear()
    this.skillCharges.clear()
    this.leftSkill = 0
    this.rightSkill = 0
    this.runMode = true
    this.moving = false
    this.mode = 1
    this.weaponSet = 0
    this.mercId = null
    this.isDead = false
    this.castState = undefined
  }
}

/** `ItemStatCost.txt` stat 26 (`manarecovery`): `S2C 0x18` stores 7-bit `nPotionManaPercent` (`0..100`) here (`0x6fb5ed0f`). */
export const STAT_MANARECOVERY = 26

/** `ItemStatCost.txt` stat 74 (`hpregen`): `S2C 0x18` stores 7-bit `nPotionLifePercent` (`0..100`) here (`0x6fb5ecff`). */
export const STAT_HPREGEN = 74

/** `ItemStatCost.txt` ValShift of stats 6..11 (hitpoints/maxhp/mana/maxmana/stamina/maxstamina). */
export const POOL_STAT_VAL_SHIFT = 8

/** Integer pool value from the 8.8 fixed-point wire/StatList value of stats 6..11. */
export function poolStatValue(raw: number): number {
  return Math.floor(raw / (1 << POOL_STAT_VAL_SHIFT))
}
