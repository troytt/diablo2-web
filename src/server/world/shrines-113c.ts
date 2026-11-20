/**
 * 1.13c Shrine Effect Helpers (`D2Game.dll` `0x6FC89EE0`, `0x6FC8ABB0`, `0x6FC8ACE0`,
 * `0x6FC8C200`, `0x6FC8C580`, `0x6FC8C798`, #1919, #1920).
 */

/**
 * Six distinct radial target coordinate offsets `(dx, dy)` in `D2Game.dll` `0x6FC8C798..0x6FC8C7C4`
 * used by `SHRINES_Exploding` (`Code 21`, `0x6FC8C580`, missile `45`) and
 * `SHRINES_Poison` (`Code 22`, `0x6FC8C200`, missile `48`).
 */
export const EXPLODING_POISON_SHRINE_OFFSETS_113C: readonly (readonly [number, number])[] = [
  [-6, 6],
  [-6, -6],
  [0, 6],
  [0, -6],
  [6, 6],
  [6, -6],
] as const

/**
 * 1.13c shrine projectile skill level: `clamp(trunc(clvl / 5), 1, 8)`.
 */
export function computeShrineMissileSlvl113c(clvl: number): number {
  return Math.max(1, Math.min(8, Math.trunc(clvl / 5)))
}

/**
 * 1.13c `SHRINES_Armor` (`Code 6`, `state 128`, `D2Game.dll` `0x6FC8ABB0`):
 * Attaches ONLY `STAT_SKILL_ARMOR_PERCENT` (`171`) = `+arg0` (`+100%`), never `item_armor_percent` (`16`).
 */
export function buildArmorShrineStats113c(arg0: number): Record<string, number> {
  return {
    skill_armor_percent: Math.trunc(arg0),
  }
}

export interface CombatShrineSnapshotInput113c {
  /** Touch-time total Attack Rating of the activating player (`0x6FC89F1A -> 0x6FC89B00`). */
  readonly currentAttackRating: number
  /** `Shrines.txt` `Arg0` (`200` = `+200%` Attack Rating). */
  readonly arg0: number
  /** `Shrines.txt` `Arg1` (`200` = `+200%` physical damage via `STAT_DAMAGEPERCENT = 25`). */
  readonly arg1: number
}

export interface CombatShrineSnapshotStats113c {
  readonly tohit: number
  readonly damagepercent: number
  readonly [key: string]: number
}

/**
 * 1.13c `SHRINES_Combat` (`Code 7`, `state 129`, `D2Game.dll` `0x6FC8ACE0` / `0x6FC89EE0`):
 * - Calls `0x6FC89EE0(STAT_TOHIT = 0x13)` to snapshot `arBonus = trunc(currentAR * Arg0 / 100)`
 *   at shrine activation time (`0x6FC8AD23..0x6FC8AD29`), then attaches `STAT_TOHIT (19) = arBonus`
 *   (`0x6FC8AD4F..0x6FC8AD55`, never `item_tohit_percent` `119` or literal `tohit: 200`).
 * - Attaches `STAT_DAMAGEPERCENT (25) = Arg1` (`200`) via `SHRINES_AllocClearPreviousShrineStats`
 *   (`0x6FC8AD3F..0x6FC8AD4A`).
 */
export function buildCombatShrineSnapshot113c(
  input: CombatShrineSnapshotInput113c,
): CombatShrineSnapshotStats113c {
  const arBonus = Math.max(
    0,
    Math.trunc((Math.max(0, Math.trunc(input.currentAttackRating)) * input.arg0) / 100),
  )
  return {
    tohit: arBonus,
    damagepercent: Math.trunc(input.arg1),
  }
}

/**
 * Canonical 1.13c room sub-tile span (`8` tiles * `5` sub-tiles/tile = `40` sub-tiles)
 * for `D2Common.#10314` (`DUNGEON_GetAdjacentRoomsList`) `3x3` active room neighborhood scans.
 */
export const SHRINE_ROOM_SUBTILE_SPAN_113C = 40

export interface ShrineRoomRectLike113c {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/**
 * 1.13c `D2Common.#10314` (`DUNGEON_GetAdjacentRoomsList`, `0x6FC8AB30` / `0x6FC8AEE0` / `0x6FC8C900`, #1953):
 * Checks whether `(unitX, unitY)` lies within the shrine's room or its 8 adjacent rooms (`3x3` room neighborhood).
 * Uses exact `RoomRect` bounds when loaded area room geometry is available, falling back to the canonical
 * `40x40`-subtile (`8x8`-tile) DRLG room grid.
 */
export function isWithinShrineActiveRoomNeighborhood113c(
  shrineX: number,
  shrineY: number,
  unitX: number,
  unitY: number,
  rooms?: readonly ShrineRoomRectLike113c[] | undefined,
): boolean {
  if (rooms !== undefined && rooms.length > 0) {
    const sx = Math.floor(shrineX)
    const sy = Math.floor(shrineY)
    const shrineRoom = rooms.find(
      (r) => sx >= r.x && sy >= r.y && sx < r.x + r.w && sy < r.y + r.h,
    )
    if (shrineRoom !== undefined) {
      const ux = Math.floor(unitX)
      const uy = Math.floor(unitY)
      for (const room of rooms) {
        const adjacent =
          room.x <= shrineRoom.x + shrineRoom.w &&
          room.x + room.w >= shrineRoom.x &&
          room.y <= shrineRoom.y + shrineRoom.h &&
          room.y + room.h >= shrineRoom.y
        if (!adjacent) continue
        if (ux >= room.x && uy >= room.y && ux < room.x + room.w && uy < room.y + room.h) {
          return true
        }
      }
      return false
    }
  }
  const shrineRoomX = Math.floor(shrineX / SHRINE_ROOM_SUBTILE_SPAN_113C)
  const shrineRoomY = Math.floor(shrineY / SHRINE_ROOM_SUBTILE_SPAN_113C)
  const unitRoomX = Math.floor(unitX / SHRINE_ROOM_SUBTILE_SPAN_113C)
  const unitRoomY = Math.floor(unitY / SHRINE_ROOM_SUBTILE_SPAN_113C)
  return (
    Math.abs(unitRoomX - shrineRoomX) <= 1 &&
    Math.abs(unitRoomY - shrineRoomY) <= 1
  )
}

/**
 * 1.13c `SHRINES_FindNearestNormalMonster` (`0x6FC8A440` / `0x6FC8B8A0`, #1953):
 * Excludes dead/corpse/submerged units, NPCs/vendors, bosses/PrimeEvils/SuperUniques,
 * already-promoted Champion/Unique/Minion monsters, player pets/summons, and non-hostile units.
 */
export function isEligibleMonsterShrineTarget113c(candidate: {
  readonly dead?: boolean | undefined
  readonly hp: number
  readonly mode?: number | undefined
  readonly submerged?: boolean | undefined
  readonly isNpc?: boolean | undefined
  readonly isVendor?: boolean | undefined
  readonly isBoss?: boolean | undefined
  readonly isPrimeEvil?: boolean | undefined
  readonly superUniqueId?: string | number | undefined
  readonly rank: string
  readonly isPet?: boolean | undefined
  readonly ownerPlayerId?: number | undefined
  readonly align?: number | undefined
  readonly petIgnore?: boolean | undefined
  readonly killable?: boolean | undefined
}): boolean {
  if (candidate.dead === true || candidate.hp <= 0) return false
  if (candidate.mode === 0 || candidate.mode === 12 || candidate.mode === 14) return false
  if (candidate.submerged === true) return false
  if (candidate.isNpc === true || candidate.isVendor === true) return false
  if (candidate.isBoss === true || candidate.isPrimeEvil === true) return false
  if (candidate.superUniqueId !== undefined) return false
  if (candidate.rank !== 'normal') return false
  if (candidate.isPet === true || candidate.ownerPlayerId !== undefined) return false
  if (candidate.align !== undefined && candidate.align !== 0) return false
  if (candidate.petIgnore === true || candidate.killable === false) return false
  return true
}
