/**
 * Unit StatList (`src/client/world/stat-list.ts`).
 *
 * Stores base and state-modified stats for a client unit or local player.
 * Note on 1.13c fixed-point life/mana/stamina (stats 6..11):
 * - D2GS `0x1D`/`0x1E`/`0x1F` send raw `ValShift=8` fixed-point values for stats 6..11,
 *   OR `0x95`/`0x18` send integer life/mana/stamina directly.
 */

import type { ItemStat } from '../../netproto/index.ts'

export const STAT_STRENGTH = 0
export const STAT_ENERGY = 1
export const STAT_DEXTERITY = 2
export const STAT_VITALITY = 3
export const STAT_STATPTS = 4
export const STAT_NEW_SKILLS = 5
export const STAT_HITPOINTS = 6
export const STAT_MAXHP = 7
export const STAT_MANA = 8
export const STAT_MAXMANA = 9
export const STAT_STAMINA = 10
export const STAT_MAXSTAMINA = 11
export const STAT_LEVEL = 12
export const STAT_EXPERIENCE = 13
export const STAT_GOLD = 14
export const STAT_GOLDBANK = 15

export const D2StatId = {
  Strength: STAT_STRENGTH,
  Energy: STAT_ENERGY,
  Dexterity: STAT_DEXTERITY,
  Vitality: STAT_VITALITY,
  StatPts: STAT_STATPTS,
  NewSkills: STAT_NEW_SKILLS,
  HitPoints: STAT_HITPOINTS,
  MaxHp: STAT_MAXHP,
  Mana: STAT_MANA,
  MaxMana: STAT_MAXMANA,
  Stamina: STAT_STAMINA,
  MaxStamina: STAT_MAXSTAMINA,
  Level: STAT_LEVEL,
  Experience: STAT_EXPERIENCE,
  Gold: STAT_GOLD,
  GoldBank: STAT_GOLDBANK,
  ToHit: 19,
  NextExp: 30,
  ArmorClass: 31,
  FireResist: 39,
  LightResist: 41,
  ColdResist: 43,
  PoisonResist: 45,
  SocketCount: 194,
} as const

/** Process-wide mutation sequence: every StatList construction and mutation takes the next value. */
let statListRevisionSeq = 0

export class StatList {
  private readonly baseStats = new Map<number, number>()
  private readonly paramStats = new Map<string, ItemStat>()
  private readonly stateStats = new Map<number, readonly ItemStat[]>()
  private revisionValue = ++statListRevisionSeq
  private combatRevisionValue = this.revisionValue

  /**
   * Mutation stamp: changes on every `set` / `add` / `setStateStats` / `removeStateStats` / `clear` and is
   * unique across all StatList instances, so callers caching values derived from a StatList (e.g. the player
   * light radius / colour, stats 89 / 90) can key the cache on it and see in-place stat writes immediately.
   */
  get revision(): number {
    return this.revisionValue
  }

  /**
   * Combat/attribute mutation stamp: changes whenever any stat other than runtime vitals / XP / gold
   * (`6`=HitPoints, `8`=Mana, `10`=Stamina, `13`=Experience, `14`=Gold, `15`=GoldBank) or any state stat
   * list is modified.
   */
  get combatRevision(): number {
    return this.combatRevisionValue
  }

  has(statId: number, param = 0): boolean {
    if (param === 0) {
      return this.baseStats.has(statId)
    }
    return this.paramStats.has(`${statId}:${param}`)
  }

  get(statId: number, param = 0): number {
    let total = 0
    if (param === 0) {
      total += this.baseStats.get(statId) ?? 0
    } else {
      total += this.paramStats.get(`${statId}:${param}`)?.value ?? 0
    }
    for (const list of this.stateStats.values()) {
      for (const s of list) {
        if (s.statId === statId && s.param === param) {
          total += s.value
        }
      }
    }
    return total
  }

  getBase(statId: number, param = 0): number {
    if (param === 0) {
      return this.baseStats.get(statId) ?? 0
    }
    return this.paramStats.get(`${statId}:${param}`)?.value ?? 0
  }

  set(statId: number, value: number, param = 0): void {
    let changed = true
    if (param === 0) {
      const prev = this.baseStats.get(statId)
      changed = prev !== value
      this.baseStats.set(statId, value)
    } else {
      const key = `${statId}:${param}`
      const prev = this.paramStats.get(key)
      changed = !prev || prev.value !== value
      this.paramStats.set(key, { statId, param, value })
    }
    const nextRev = ++statListRevisionSeq
    this.revisionValue = nextRev
    if (
      changed &&
      (param !== 0 ||
        (statId !== STAT_HITPOINTS &&
          statId !== STAT_MANA &&
          statId !== STAT_STAMINA &&
          statId !== STAT_EXPERIENCE &&
          statId !== STAT_GOLD &&
          statId !== STAT_GOLDBANK))
    ) {
      this.combatRevisionValue = nextRev
    }
  }

  add(statId: number, delta: number, param = 0): void {
    const prev = this.getBase(statId, param)
    this.set(statId, prev + delta, param)
  }

  delete(statId: number, param = 0): boolean {
    const existed =
      param === 0 ? this.baseStats.delete(statId) : this.paramStats.delete(`${statId}:${param}`)
    if (existed) {
      const nextRev = ++statListRevisionSeq
      this.revisionValue = nextRev
      if (
        param !== 0 ||
        (statId !== STAT_HITPOINTS &&
          statId !== STAT_MANA &&
          statId !== STAT_STAMINA &&
          statId !== STAT_EXPERIENCE &&
          statId !== STAT_GOLD &&
          statId !== STAT_GOLDBANK)
      ) {
        this.combatRevisionValue = nextRev
      }
    }
    return existed
  }

  setStateStats(stateId: number, stats: readonly ItemStat[]): void {
    this.stateStats.set(stateId, stats)
    const nextRev = ++statListRevisionSeq
    this.revisionValue = nextRev
    this.combatRevisionValue = nextRev
  }

  removeStateStats(stateId: number): void {
    this.stateStats.delete(stateId)
    const nextRev = ++statListRevisionSeq
    this.revisionValue = nextRev
    this.combatRevisionValue = nextRev
  }

  /**
   * State ids that currently carry a stat list (D2GS 0xA8 `SetState` payloads).
   * Used by the shared stat engine to aggregate each state list as its own
   * source (D2Common `sub_6FDB5830` sums every attached StatList once).
   */
  stateIds(): number[] {
    return [...this.stateStats.keys()]
  }

  /** The 0xA8 stat list attached for `stateId`, or `undefined` when none is attached. */
  getStateStats(stateId: number): readonly ItemStat[] | undefined {
    return this.stateStats.get(stateId)
  }

  toMap(): ReadonlyMap<number, number> {
    return this.baseStats
  }

  entries(): ItemStat[] {
    const out: ItemStat[] = []
    for (const [statId, value] of this.baseStats.entries()) {
      out.push({ statId, param: 0, value })
    }
    for (const item of this.paramStats.values()) {
      out.push(item)
    }
    return out
  }

  clear(): void {
    this.baseStats.clear()
    this.paramStats.clear()
    this.stateStats.clear()
    const nextRev = ++statListRevisionSeq
    this.revisionValue = nextRev
    this.combatRevisionValue = nextRev
  }
}
