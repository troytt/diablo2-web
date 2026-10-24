/**
 * Diablo II v1.13c `Skills.txt` `aurafilter` target predicate and aura radius test.
 *
 * Ground truth (`samples/d2/D2Game.dll`, image base 0x6FC20000; `samples/d2/D2Common.dll`,
 * image base 0x6FD50000). See `kb/skills/aura-target-filter-113c.md`.
 *
 * Radial scan 0x6FCC0C70 (`SrvDo065/066/081/082` call it with `[skill+0x50]` = `aurafilter`
 * and the evaluated `aurarangecalc`):
 * - `test ebx,ebx; jle` -> a radius `<= 0` scans nothing.
 * - filter `0` defaults to `0x583` (`mov [esp+0x40],0x583`).
 * - `6fcc0d00: imul ebp,ebx` -> `range²`; per unit D2Common ord 10769 (0x6FD84580) returns the
 *   sub-tile `dx² + dy²`; `6fcc0e07: cmp ebp,eax; jl skip` -> hit when `dx² + dy² <= range²`.
 * - filter bit `0x2000`: every room for which D2Common ord 10057 (IsTown level) is true is
 *   skipped before its units are visited.
 * Per-unit predicate 0x6FCC0370 (jump table 0x6FCC0610 on the unit type) decodes the other bits.
 */

/** `aurafilter` bits decoded from 0x6FCC0370 / 0x6FCC0C70. */
export const AURA_FILTER = {
  /** unit type 0 accepted (players). */
  PLAYER: 0x1,
  /** unit type 1 accepted (monsters, incl. mercenaries and summons). */
  MONSTER: 0x2,
  /** monsters must be undead: D2Common ord 10239 (MonStats flags `lUndead | hUndead`). */
  UNDEAD: 0x4,
  /** unit type 3 accepted (missiles). */
  MISSILE: 0x8,
  /** unit type 2 accepted (objects). */
  OBJECT: 0x10,
  /** unit type 4 accepted (items). */
  ITEM: 0x20,
  /** unit flag `0x4` (selectable) required. */
  SELECTABLE: 0x80,
  /** reject a target standing in a town room (D2Common ord 10331 room + ord 10057 IsTown). */
  NOT_IN_TOWN: 0x100,
  /** reject a target without a clear path (D2Common ord 11076, collision mask 4). */
  LINE_OF_SIGHT: 0x200,
  /** unit flag `0x8` (can be attacked) required. */
  ATTACKABLE: 0x400,
  /** only dead/dying units (player mode 0x11, monster mode 0x0C); without it they are rejected. */
  DEAD: 0x1000,
  /** scan 0x6FCC0C70 skips every town room. */
  SKIP_TOWN_ROOMS: 0x2000,
  /** reject MonStats `boss` monsters (D2Common ord 10064, flag bit 6). */
  NOT_BOSS: 0x4000,
  /** target must be hostile to the source (0x6FD00A60). */
  ENEMY: 0x8000,
  /** target must be allied with the source (0x6FD00570); also rejects MonStats `npc` monsters. */
  ALLY: 0x10000,
  /** D2Common ord 11138 relation check (unused by aura rows). */
  RELATION_11138: 0x20000,
  /** reject MonStats `primeevil` monsters (D2Common ord 10278, flag bit 7). */
  NOT_PRIME_EVIL: 0x40000,
  /** reject targets carrying state 86 `justhit` (D2Common ord 10494). */
  NOT_JUSTHIT: 0x80000,
} as const

/** 0x6FCC0C70: `aurafilter = 0` scans with `0x583`. */
export const AURA_FILTER_DEFAULT = 0x583

/** Relation of the scanned unit to the aura source after owner resolution (0x6FD00570 / 0x6FD00A60). */
export type AuraTargetRelation = 'self' | 'ally' | 'enemy' | 'neutral'

export interface AuraFilterTarget {
  readonly kind: 'player' | 'monster'
  readonly relation: AuraTargetRelation
  readonly dead: boolean
  /** Target stands in a town room (IsTown level). */
  readonly inTown: boolean
  readonly isUndead?: boolean | undefined
  /** MonStats `boss` column. */
  readonly isBoss?: boolean | undefined
  /** MonStats `primeevil` column. */
  readonly isPrimeEvil?: boolean | undefined
  /** MonStats `npc` column. */
  readonly isNpc?: boolean | undefined
  readonly hasJustHitState?: boolean | undefined
  /** Clear D2Common ord 11076 path from the source; treated as clear when unknown. */
  readonly lineOfSightClear?: boolean | undefined
}

/** D2Common ord 10769 + 0x6FCC0E07: sub-tile `dx² + dy² <= range²`; `range <= 0` hits nothing. */
export function isWithinAuraRange(dx: number, dy: number, rangeSubtiles: number): boolean {
  if (!(rangeSubtiles > 0)) return false
  return dx * dx + dy * dy <= rangeSubtiles * rangeSubtiles
}

/** 0x6FCC0C70 + 0x6FCC0370: does `aurafilter` accept this unit. */
export function passesAuraFilter(rawFilter: number, t: AuraFilterTarget): boolean {
  const f = rawFilter === 0 ? AURA_FILTER_DEFAULT : rawFilter
  // Room-level town skip (scan loop, before 0x6FCC0370).
  if (f & AURA_FILTER.SKIP_TOWN_ROOMS && t.inTown) return false
  // Unit type gate (jump table 0x6FCC0610) + dead/alive mode check.
  if (!(f & (t.kind === 'player' ? AURA_FILTER.PLAYER : AURA_FILTER.MONSTER))) return false
  if (f & AURA_FILTER.DEAD) {
    if (!t.dead) return false
  } else if (t.dead) {
    return false
  }
  if (t.kind === 'monster') {
    if (f & AURA_FILTER.UNDEAD && !t.isUndead) return false
    if (f & AURA_FILTER.NOT_BOSS && t.isBoss) return false
    if (f & AURA_FILTER.NOT_PRIME_EVIL && t.isPrimeEvil) return false
  }
  if (f & AURA_FILTER.NOT_IN_TOWN && t.inTown) return false
  if (f & AURA_FILTER.ALLY) {
    if (t.relation !== 'self' && t.relation !== 'ally') return false
    if (t.kind === 'monster' && t.isNpc) return false
  }
  if (f & AURA_FILTER.ENEMY && t.relation !== 'enemy') return false
  if (f & AURA_FILTER.NOT_JUSTHIT && t.hasJustHitState) return false
  if (f & AURA_FILTER.LINE_OF_SIGHT && t.lineOfSightClear === false) return false
  return true
}
