/**
 * Diablo II 1.13c `DUNGEON_FindActSpawnLocationEx` (D2Common `#10816` `0x6FD8CDF0`) and its pieces.
 *
 * Ground truth: `samples/d2/D2Common.dll` 1.13c, documented in
 * `kb/world/d2common-act-spawn-location-raytrace-113c.md`.
 *
 * - {@link pickTileInfoRecord}: `sub_6FD69B60` — pick one `pLevel->pTileInfo[]` special-tile record
 *   (DS1 style 30..33 markers saved by the preset loader `0x6FD5C45F`) with the level seed.
 * - {@link findActSpawnLocationTile}: the core `0x6FD6A130` — `Levels.txt` `Position` branch, then the
 *   waypoint (`0x6FD69FA0`), warp-room (`0x6FD69AD0`), centre-room (`0x6FD7D600`) and random-room
 *   (`0x6FD69A50`) fall-backs. Returns **level-local tile** coordinates.
 * - {@link collisionGetFreeCoordinates}: `COLLISION_GetFreeCoordinates` (`0x6FD9D140`) without the
 *   optional path-field test (`#10816` passes `pFieldCoord = NULL`).
 * - {@link findActSpawnLocationSubTile}: `#10816` itself — tile `*5+3`, then the free-coordinate search
 *   with mask `0x1C09`, radius `50`, step `1`.
 */

import type { D2SeedStrc } from '../rng/d2-rng.ts'
import { SEED_RollLimitedRandomNumber } from '../rng/d2-rng.ts'

/** One `pLevel->pTileInfo[]` record (`+0x2C/+0x30/+0x34`, stride `0xC`), in level-local tiles. */
export interface ActSpawnTileInfo {
  readonly x: number
  readonly y: number
  /** style 30 -> sequence, 31 -> sequence + 5, 32 -> 10, 33 -> 11 (jump table `0x6FD5C67C`). */
  readonly index: number
}

/** A DRLG room rectangle (`pRoomEx->nTileXPos/nTileYPos/nTileWidth/nTileHeight`, `+0x34..+0x40`). */
export interface ActSpawnRoomRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/**
 * Everything `0x6FD6A130` reads from the level, captured from the DRLG level (level-local tiles).
 * Rooms are in `pLevel->pFirstRoomEx` list order.
 */
export interface ActSpawnLevelData {
  /** `LevelDefs[nLevelId] + 0x90` (`Levels.txt` `Position`). */
  readonly position: number
  /** `pLevel->pTileInfo[0 .. nTileInfo)`. */
  readonly tileInfo: readonly ActSpawnTileInfo[]
  /**
   * The level-centre probe of `0x6FD6A1F1`: `pLevelCoords.x + w/2 - 2`, `pLevelCoords.y + h/2 - 2`
   * (`pLevel + 0x1C/0x20/0x24/0x28`), converted to level-local tiles.
   */
  readonly centreX: number
  readonly centreY: number
  readonly rooms: readonly ActSpawnRoomRect[]
  /**
   * `0x6FD69FA0` result: index of the first room with `dwFlags & 0x30000` (-1 = none) and, when that
   * room has a type-2 preset unit with `classId < 573` and `Objects.txt` byte `+0x167 & 0x40`, its tile
   * (`room.x + unit.x / 5`, `room.y + unit.y / 5`).
   */
  readonly waypointRoom: number
  readonly waypointTile: { readonly x: number; readonly y: number } | null
  /** `0x6FD69AD0`: first room with a `dwFlags & 0xFF0` warp bit whose level warp slot is not -1 (-1 = none). */
  readonly warpRoom: number
}

/**
 * `0x6FDE4F48`: 14 x `{ bMatchGroup, nGroup }` (dumped from `.rdata`). A request for index `n` matches a
 * record with the same index, or — when `bMatchGroup[n]` — any record in the same group.
 */
export const TILE_INFO_GROUPS_113C: readonly (readonly [match: number, group: number])[] = [
  [1, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 1],
  [0, 1], [0, 1], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
]

/** `#10816` tile index of the entry markers (D2Game `0x6FC6B571`, `0x6FC6B6FE`, `0x6FC8BC22`, `0x6FC8D362`). */
export const ACT_SPAWN_TILE_ENTRY = 0
/** `#10816` tile index of the town-portal mouth (style 33; D2Game `0x6FCC2318` / `0x6FCC23C8`). */
export const ACT_SPAWN_TILE_TOWN_PORTAL = 11
/** Index routed to the waypoint lookup when `Position != 0` (`cmp eax,0xd` at `0x6FD6A1AA`). */
export const ACT_SPAWN_TILE_WAYPOINT = 13
/** `#10816` collision masks (`push 0x1c09` x2 at `0x6FD8CE5B`). */
export const ACT_SPAWN_COLLISION_MASK = 0x1c09
/** `#10816` free-coordinate radius (`push 0x32` at `0x6FD8CE58`). */
export const ACT_SPAWN_MAX_DISTANCE = 50

function groupOf(index: number): readonly [number, number] {
  const entry = TILE_INFO_GROUPS_113C[index]
  if (entry === undefined) {
    throw new RangeError(`tile-info index ${String(index)} outside the 1.13c group table 0x6FDE4F48`)
  }
  return entry
}

function matches(request: number, recordIndex: number): boolean {
  if (request === recordIndex) return true
  const [match, group] = groupOf(request)
  return match !== 0 && group === groupOf(recordIndex)[1]
}

/**
 * `sub_6FD69B60` (`ecx = pLevel`, `ebx = nTileIndex`). Counts the matching records; when there is at
 * least one it **always** rolls the level seed (`1 + SEED_RollLimitedRandomNumber(count)` — also for a
 * single match), then walks the records decrementing on each match and stops when the counter reaches 0.
 * No match leaves the counter at 0, which selects record 0.
 *
 * @throws when the level saved no tile-info records (1.13c would read uninitialised `pTileInfo[0]`).
 */
export function pickTileInfoRecord(
  tileInfo: readonly ActSpawnTileInfo[],
  nTileIndex: number,
  levelSeed: D2SeedStrc,
): ActSpawnTileInfo {
  if (tileInfo.length === 0) {
    throw new Error(`pickTileInfoRecord: the level has no pTileInfo records (index ${String(nTileIndex)})`)
  }
  let count = 0
  for (const record of tileInfo) {
    if (matches(nTileIndex, record.index)) count += 1
  }
  let counter = count > 0 ? 1 + SEED_RollLimitedRandomNumber(levelSeed, count) : 0
  let k = 0
  for (; k < tileInfo.length; k += 1) {
    if (matches(nTileIndex, tileInfo[k]!.index)) counter -= 1
    if (counter <= 0) break
  }
  return tileInfo[k]!
}

function roomCentre(room: ActSpawnRoomRect): { x: number; y: number } {
  // `0x6FD6A237`: room.x + w/2, room.y + h/2 (cdq/sub/sar = signed division toward zero).
  return { x: room.x + Math.trunc(room.w / 2), y: room.y + Math.trunc(room.h / 2) }
}

/**
 * Core of `DUNGEON_FindActSpawnLocationEx` (`0x6FD6A130`). Returns level-local tile coordinates.
 * `levelSeed` is the level's `pSeed` (`pLevel + 0x1C4`) and is advanced exactly like 1.13c.
 */
export function findActSpawnLocationTile(
  level: ActSpawnLevelData,
  nTileIndex: number,
  levelSeed: D2SeedStrc,
): { x: number; y: number } {
  const waypoint = (): { x: number; y: number } | null => {
    if (level.waypointRoom < 0) return null
    if (level.waypointTile !== null) return { x: level.waypointTile.x, y: level.waypointTile.y }
    return roomCentre(level.rooms[level.waypointRoom]!)
  }
  if (level.position !== 0) {
    if (nTileIndex === ACT_SPAWN_TILE_WAYPOINT) {
      const wp = waypoint()
      if (wp === null) throw new Error('findActSpawnLocationTile: Position level without a waypoint room')
      return wp
    }
    const record = pickTileInfoRecord(level.tileInfo, nTileIndex, levelSeed)
    return { x: record.x, y: record.y }
  }
  const wp = waypoint()
  if (wp !== null) return wp
  if (level.warpRoom >= 0) return roomCentre(level.rooms[level.warpRoom]!)
  // `0x6FD6A1F1`: level centre (x + w/2 - 2, y + h/2 - 2) -> first room containing it (`0x6FD7D600`).
  const cx = level.centreX
  const cy = level.centreY
  for (const room of level.rooms) {
    if (cx >= room.x && cy >= room.y && cx < room.x + room.w && cy < room.y + room.h) return roomCentre(room)
  }
  // `0x6FD69A50`: a random room (`SEED_RollLimitedRandomNumber(pLevel->pSeed, pLevel->nRooms)`).
  if (level.rooms.length === 0) throw new Error('findActSpawnLocationTile: level without rooms')
  const n = SEED_RollLimitedRandomNumber(levelSeed, level.rooms.length)
  return roomCentre(level.rooms[n]!)
}

/**
 * `COLLISION_CheckMaskWithSize` (`0x6FD9CE00`) over a cell predicate: size 0/1 = the cell, 2 = "+",
 * 3 = 3x3 box; any other size counts as blocked (`0xFFFF`).
 */
export function isBlockedWithUnitSize(
  isCellBlocked: (x: number, y: number) => boolean,
  x: number,
  y: number,
  nUnitSize: number,
): boolean {
  switch (nUnitSize) {
    case 0:
    case 1:
      return isCellBlocked(x, y)
    case 2:
      return isCellBlocked(x, y) || isCellBlocked(x - 1, y) || isCellBlocked(x + 1, y) ||
        isCellBlocked(x, y - 1) || isCellBlocked(x, y + 1)
    case 3:
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (isCellBlocked(x + dx, y + dy)) return true
        }
      }
      return false
    default:
      return true
  }
}

/**
 * `COLLISION_GetFreeCoordinates` (`0x6FD9D140`) with `pFieldCoord = NULL`.
 *
 * The start cell is returned when it is free. Otherwise square rings `d = 1, 1 + incr, ...` while
 * `d < nMaxDistance` are scanned: first the left/right columns (`x = X0 -/+ d`, `y` from `Y0 - d` to
 * `Y0 + d`, row-major, left before right), then the top/bottom rows (`x` from `X0 - d + 1` to
 * `X0 + d - 1`, `y = Y0 -/+ d`, column-major, top before bottom). In a ring the free candidate with the
 * smallest `|dx| + |dy|` wins (strict `<`, so the first one in scan order keeps ties); the first ring
 * with a candidate ends the search. Returns `null` when nothing is free (`bOnlyFind = 0` path).
 *
 * @param isFree - `room != NULL && !COLLISION_CheckMaskWithSize(room, x, y, size, mask)`.
 */
export function collisionGetFreeCoordinates(
  isFree: (x: number, y: number) => boolean,
  x0: number,
  y0: number,
  nMaxDistance: number = ACT_SPAWN_MAX_DISTANCE,
  nIncrement = 1,
): { x: number; y: number } | null {
  if (isFree(x0, y0)) return { x: x0, y: y0 }
  if (nMaxDistance <= 1 || nIncrement <= 0) return null
  // `[esp+0x1c]` (the ring distance) starts at 1 and grows by `nIncrement`; the loop continues while
  // the next distance is `< nMaxDistance` (`0x6FD9D54E`).
  for (let d = 1; d < nMaxDistance; d += nIncrement) {
    let best = -1
    let bx = 0
    let by = 0
    const consider = (x: number, y: number): void => {
      if (!isFree(x, y)) return
      const metric = Math.abs(x - x0) + Math.abs(y - y0)
      if (best === -1 || metric < best) {
        best = metric
        bx = x
        by = y
      }
    }
    const step = 2 * d
    for (let y = y0 - d; y <= y0 + d; y += nIncrement) {
      for (let x = x0 - d; x <= x0 + d; x += step) consider(x, y)
    }
    for (let x = x0 - d + 1; x <= x0 + d - 1; x += nIncrement) {
      for (let y = y0 - d; y <= y0 + d; y += step) consider(x, y)
    }
    if (best !== -1) return { x: bx, y: by }
  }
  return null
}

/**
 * `DUNGEON_FindActSpawnLocationEx` (`#10816` `0x6FD8CDF0`): core -> tile `*5+3` -> free coordinates with
 * mask `0x1C09`, radius 50, step 1 and the unit size. Coordinates are level-local sub-tiles.
 *
 * @param isCellBlocked - `COLLISION_CheckCollisionMask(room, x, y, 0x1C09) != 0`, with cells outside every
 *   room reading as blocked.
 * @throws when no free cell exists (1.13c asserts at `0x6FD8CE86`).
 */
export function findActSpawnLocationSubTile(
  level: ActSpawnLevelData,
  nTileIndex: number,
  levelSeed: D2SeedStrc,
  nUnitSize: number,
  isCellBlocked: (x: number, y: number) => boolean,
): { x: number; y: number } {
  const tile = findActSpawnLocationTile(level, nTileIndex, levelSeed)
  const free = collisionGetFreeCoordinates(
    (x, y) => !isBlockedWithUnitSize(isCellBlocked, x, y, nUnitSize),
    tile.x * 5 + 3,
    tile.y * 5 + 3,
    ACT_SPAWN_MAX_DISTANCE,
    1,
  )
  if (free === null) {
    throw new Error(
      `DUNGEON_FindActSpawnLocationEx: no free cell within ${String(ACT_SPAWN_MAX_DISTANCE)} of tile (${String(tile.x)}, ${String(tile.y)})`,
    )
  }
  return free
}
