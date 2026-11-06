/**
 * Diablo II 1.13c D2Common dynamic-path core: allocation, accessors, path type / direction state,
 * unit collision footprints and room re-caching (Refs #808).
 *
 * Every export is a port of one D2Common.dll 1.13c function (ImageBase 0x6FD50000). The doc comment
 * cites the 1.13c ordinal + address and the D2MOO source (`source/D2Common/src/Path/Path.cpp` unless
 * stated otherwise). Behaviour follows the 1.13c disassembly; where D2MOO differs it is called out.
 * Null handling mirrors the binary: where 1.13c tests a pointer and returns, so does the port; where
 * 1.13c asserts (Fog #10024) or would dereference NULL, the port throws {@link D2AssertError}.
 */

import {
  COLLIDE_CORPSE,
  COLLIDE_MONSTER,
  COLLIDE_NONE,
  COLLIDE_PLAYER,
  COLLIDE_MASK_PLAYER_PATH,
  COLLISION_CheckMaskWithSize,
  COLLISION_ResetMaskWithPattern,
  COLLISION_ResetMaskWithSize,
  COLLISION_ResetMaskWithSizeXY,
  COLLISION_SetCollisionMaskForBoundingBoxRecursively,
  COLLISION_SetMaskWithPattern,
  COLLISION_SetMaskWithSize,
  COLLISION_SetMaskWithSizeXY,
  DUNGEON_GetRoomAtPosition,
} from './collision.ts'
import { PATH_GetDirectionVector, PATH_NormalizeDirection, subtileCenter } from './direction.ts'
import { COLLISION_PATTERNS_FROM_SIZE, DIFF_DIRECTION, OFFSET_FOR_PATH_TYPE, PATH_TYPE_FLAGS } from './tables.ts'
import {
  type PathPoint,
  type PathRoom,
  type PathUnit,
  COLLISION_PATTERN_BIG_PET_PRESENCE,
  COLLISION_PATTERN_BIG_UNIT_PRESENCE,
  COLLISION_PATTERN_SMALL_NO_PRESENCE,
  COLLISION_PATTERN_SMALL_PET_PRESENCE,
  COLLISION_PATTERN_SMALL_UNIT_PRESENCE,
  COLLISION_UNIT_SIZE_COUNT,
  D2AssertError,
  DynamicPath,
  MAXPATHLEN,
  MONMODE_DEAD,
  MONMODE_DEATH,
  PATHTYPE_COUNT,
  PATHTYPE_KNOCKBACK_CLIENT,
  PATHTYPE_KNOCKBACK_SERVER,
  PATHTYPE_MISSILE,
  PATHTYPE_STRAIGHT,
  PATHTYPE_TOWARD,
  PATH_CURRENT_ROOM_INVALID,
  PATH_MAX_STEPNUM,
  PATH_MISSILE_MASK,
  PATH_SAVE_STEPS_MASK,
  PATH_UNKNOWN_FLAG_0x00001,
  PATH_UNKNOWN_FLAG_0x00008,
  PATH_UNKNOWN_FLAG_0x00010,
  PATH_UNKNOWN_FLAG_0x00020,
  PATH_UNKNOWN_FLAG_0x00040,
  PATH_UNKNOWN_FLAG_0x02000,
  PATH_UNKNOWN_FLAG_0x04000,
  PATH_UNKNOWN_FLAG_0x10000,
  PATH_UNUSED_FLAG_0x00004,
  PATH_WITH_PREVIOUS_VELOCITY,
  PLRMODE_DEAD,
  PLRMODE_DEATH,
  UNITFLAGEX_UNK_PATH_RELATED,
  UNIT_MISSILE,
  UNIT_MONSTER,
  UNIT_OBJECT,
  UNIT_PLAYER,
  UNIT_TYPES_COUNT,
  d2Assert,
  i32,
  toFP16Center,
  u16,
  u32,
  u8,
} from './types.ts'
import {
  MONSTATS2FLAG_ISATT,
  MONSTATS2FLAG_REVIVE,
  MONSTATS2FLAG_SMALL,
  MONSTATSFLAGINDEX_FLYING,
  MONSTATSFLAGINDEX_INTERACT,
  MONSTATSFLAGINDEX_OPENDOORS,
  MONSTER_BIRD1,
  MONSTER_BIRD2,
  MONSTER_PARROT,
  MONSTER_WRAITH1,
  MONSTERS_CanBeInTown,
  MONSTERS_GetBaseIdFromMonsterUnit,
  UNITS_GetCollisionMask,
  UNITS_GetRoom,
  UNITS_GetUnitSizeX,
  UNITS_GetUnitSizeY,
  UNITS_GetXPosition,
  UNITS_GetYPosition,
  UNITS_HasCollision,
  getMonsterPathRecord,
} from './units.ts'
import { MONSTATS2_TXT_RECORD_COUNT, MONSTATS_TXT_RECORD_COUNT } from './monster-path-data.ts'

// ---------------------------------------------------------------------------
// Room unit lists (UNITROOM_*) — owned by the embedding engine
// ---------------------------------------------------------------------------

/**
 * Hooks for the `UNITROOM_*` calls the path code makes (1.13c D2Common 0x6FDB6800
 * `UNITROOM_AddUnitToRoom(pUnit, pRoom, 1)`, 0x6FDB6700 `UNITROOM_RemoveUnitFromRoom(pUnit)`,
 * 0x6FDB65C0 `UNITROOM_RefreshUnit(pUnit)`). They maintain the per-room unit lists of
 * `D2ActiveRoomStrc`, which the path port does not model; nothing in the path / collision state
 * depends on them. Install them with {@link PATH_SetUnitRoomCallbacks} when the embedding engine keeps
 * such lists; when none are installed the calls are skipped (no path state is affected either way).
 */
export interface PathUnitRoomCallbacks {
  addUnitToRoom(pUnit: PathUnit, pRoom: PathRoom): void
  removeUnitFromRoom(pUnit: PathUnit): void
  refreshUnit(pUnit: PathUnit): void
}

let unitRoomCallbacks: PathUnitRoomCallbacks | null = null

/** `UNITROOM_AddUnitToRoom(pUnit, pRoom, 1)` (1.13c 0x6FDB6800) via the installed hooks. */
export function UNITROOM_AddUnitToRoom(pUnit: PathUnit, pRoom: PathRoom): void {
  unitRoomCallbacks?.addUnitToRoom(pUnit, pRoom)
}

/** `UNITROOM_RemoveUnitFromRoom(pUnit)` (1.13c 0x6FDB6700) via the installed hooks. */
export function UNITROOM_RemoveUnitFromRoom(pUnit: PathUnit): void {
  unitRoomCallbacks?.removeUnitFromRoom(pUnit)
}

/** `UNITROOM_RefreshUnit(pUnit)` (1.13c 0x6FDB65C0) via the installed hooks. */
export function UNITROOM_RefreshUnit(pUnit: PathUnit): void {
  unitRoomCallbacks?.refreshUnit(pUnit)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requirePath(pDynamicPath: DynamicPath | null | undefined, where: string): DynamicPath {
  if (!pDynamicPath) throw new D2AssertError(`${where}: pDynamicPath`)
  return pDynamicPath
}

function requireUnit(pUnit: PathUnit | null | undefined, where: string): PathUnit {
  if (!pUnit) throw new D2AssertError(`${where}: pUnit`)
  return pUnit
}

function requireUnitPath(pUnit: PathUnit, where: string): DynamicPath {
  if (!pUnit.pDynamicPath) throw new D2AssertError(`${where}: pUnit->pDynamicPath`)
  return pUnit.pDynamicPath
}

function assertPathType(nPathType: number, where: string): void {
  d2Assert(Number.isInteger(nPathType) && nPathType >= 0 && nPathType < PATHTYPE_COUNT, `${where}: path type ${nPathType}`)
}

/**
 * Client ("pixel") coordinates from the precise position, as inlined by 1.13c (e.g. 0x6FD5DA78):
 * `x = precX >> 11`, `y = precY >> 11` (unsigned), then `DUNGEON_GameToClientCoords`:
 * `clientX = (x - y) >> 1`, `clientY = (x + y) >> 2` (arithmetic shifts). D2MOO `PATH_UpdateClientCoords`
 * (Path.cpp:127).
 */
export function PATH_UpdateClientCoords(pDynamicPath: DynamicPath): void {
  const x = pDynamicPath.dwPrecisionX >>> 11
  const y = pDynamicPath.dwPrecisionY >>> 11
  pDynamicPath.dwClientCoordX = (x - y) >> 1
  pDynamicPath.dwClientCoordY = (x + y) >> 2
}

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

/**
 * Monster move-test mask (1.13c 0x6FD85100, eax=pUnit; inlined `else` branch of D2MOO
 * `PATH_AllocDynamicPath` Path.cpp:748-760): MonStats `flying` -> 0x1804, `opendoors` -> 0x3401,
 * otherwise 0x3C01. 1.13c reads the MonStats record without a NULL check (an out-of-range class id
 * dereferences NULL); the port throws through {@link getMonsterPathRecord}.
 */
function monsterMoveTestCollisionMask(pUnit: PathUnit): number {
  const f = getMonsterPathRecord(pUnit.dwClassId).monStatsFlags
  if (f & (1 << MONSTATSFLAGINDEX_FLYING)) return 0x1804
  return f & (1 << MONSTATSFLAGINDEX_OPENDOORS) ? 0x3401 : 0x3c01
}

/**
 * `PATH_AllocDynamicPath` (#11003, 1.13c 0x6FD86030; D2MOO #10152 Path.cpp:698). The memory pool
 * argument of the original is dropped. Allocates a zeroed path, links it to `pUnit`, sets the unit
 * size / collision pattern, the precise position `(n << 16) + 0x8000` (32-bit wrap), saved step 0,
 * velocity 0x800, the per-unit-type masks / path type / distances, then (with a room) stamps the
 * footprint and adds the unit to the room, and finally computes the client coordinates.
 *
 * Players: footprint 0x80, move-test 0x1C09, `PATH_SetType(7)`, nDistMax 73, IDA* init F 70.
 * Monsters: footprint 0x100, path type 2 (1.13c inlines the `PATH_SetType(2)` body: flags &=
 * 0xFFF800FF, type 2, dir offset 0, the two prev-type asserts), base id (range-checked) == 38
 * (wraith1) -> pattern 5 / mask 0x804, otherwise 0x6FD85100 mask; nDistMax 14 in every case.
 * Missiles: masks 0, `PATH_SetType(4)`. `bSetFlag` -> flags |= 0x10.
 */
export function PATH_AllocDynamicPath(
  pRoom: PathRoom | null,
  nX: number,
  nY: number,
  pUnit: PathUnit,
  bSetFlag: boolean | number,
): DynamicPath {
  requireUnit(pUnit, 'PATH_AllocDynamicPath')
  const p = new DynamicPath()
  pUnit.pDynamicPath = p
  p.pUnit = pUnit
  p.dwUnitSize = u32(UNITS_GetUnitSizeX(pUnit))
  p.dwCollisionPattern = u32(D2Common_11281_CollisionPatternFromSize(pUnit, p.dwUnitSize | 0))
  p.dwPrecisionX = toFP16Center(nX)
  p.dwPrecisionY = toFP16Center(nY)
  p.SavedSteps[0]!.X = u16(nX)
  p.SavedSteps[0]!.Y = u16(nY)
  p.dwVelocity = 0x800
  p.pRoom = pRoom
  p.nStepNum = 0
  p.nSavedStepsCount = 1

  switch (pUnit.dwUnitType) {
    case UNIT_PLAYER:
      p.nFootprintCollisionMask = COLLIDE_PLAYER
      p.nMoveTestCollisionMask = COLLIDE_MASK_PLAYER_PATH
      PATH_SetType(p, PATHTYPE_STRAIGHT)
      p.nDistMax = 73
      p.nIDAStarInitFScore = 70
      break
    case UNIT_MONSTER: {
      p.nFootprintCollisionMask = COLLIDE_MONSTER
      // Inlined PATH_SetType(PATHTYPE_TOWARD) (0x6FD860D6..): table entry 0 and offset 0.
      p.dwFlags = u32((p.dwFlags & 0xfff800ff) | PATH_TYPE_FLAGS[PATHTYPE_TOWARD]!)
      p.dwPathType = PATHTYPE_TOWARD
      p.nDirOffset = OFFSET_FOR_PATH_TYPE[PATHTYPE_TOWARD]!
      d2Assert(p.dwPrevPathType !== PATHTYPE_KNOCKBACK_CLIENT, 'PATH_AllocDynamicPath: dwPrevPathType != KNOCKBACK_CLIENT')
      d2Assert(p.dwPrevPathType !== PATHTYPE_KNOCKBACK_SERVER, 'PATH_AllocDynamicPath: dwPrevPathType != KNOCKBACK_SERVER')
      const nClassId = pUnit.dwClassId
      const nBaseId =
        nClassId >= 0 && nClassId < MONSTATS_TXT_RECORD_COUNT ? getMonsterPathRecord(nClassId).baseId : nClassId
      if (nBaseId === MONSTER_WRAITH1) {
        p.dwCollisionPattern = COLLISION_PATTERN_SMALL_NO_PRESENCE
        p.nMoveTestCollisionMask = 0x804
      } else {
        p.nMoveTestCollisionMask = monsterMoveTestCollisionMask(pUnit)
      }
      p.nDistMax = 14
      break
    }
    case UNIT_MISSILE:
      p.nFootprintCollisionMask = COLLIDE_NONE
      p.nMoveTestCollisionMask = COLLIDE_NONE
      PATH_SetType(p, PATHTYPE_MISSILE)
      break
    default:
      break
  }

  if (pRoom) {
    PATH_AddCollisionFootprintForUnit(pUnit)
    UNITROOM_AddUnitToRoom(pUnit, pRoom)
  }
  PATH_UpdateClientCoords(p)
  if (bSetFlag) p.dwFlags = u32(p.dwFlags | PATH_UNKNOWN_FLAG_0x00010)
  return p
}

/**
 * `PATH_FreeDynamicPath` (#10692, 1.13c 0x6FD84DC0; D2MOO #10156 Path.cpp:613). The original frees
 * the pool block; the port detaches it from its unit (the caller still owns footprint / room cleanup,
 * exactly like the original).
 */
export function PATH_FreeDynamicPath(pDynamicPath: DynamicPath): void {
  const pUnit = pDynamicPath.pUnit
  if (pUnit && pUnit.pDynamicPath === pDynamicPath) pUnit.pDynamicPath = null
}

/**
 * Sets `PATH_UNKNOWN_FLAG_0x00001` when a path point lies outside the current room (1.13c 0x6FD84E70,
 * eax=pDynamicPath; D2MOO `sub_6FDA8220` Path.cpp:140). The flag is cleared first. 1.13c also sets
 * it when `pRoom` is NULL and the path has points (D2MOO leaves it cleared).
 */
export function sub_6FDA8220(pDynamicPath: DynamicPath): void {
  pDynamicPath.dwFlags = u32(pDynamicPath.dwFlags & ~PATH_UNKNOWN_FLAG_0x00001)
  const pRoom = pDynamicPath.pRoom
  for (let i = 0; i < pDynamicPath.dwPathPoints; i++) {
    const pt = pDynamicPath.PathPoints[i]!
    if (
      !pRoom ||
      pt.X < pRoom.subX ||
      pt.X >= pRoom.subX + pRoom.subW ||
      pt.Y < pRoom.subY ||
      pt.Y >= pRoom.subY + pRoom.subH
    ) {
      pDynamicPath.dwFlags = u32(pDynamicPath.dwFlags | PATH_UNKNOWN_FLAG_0x00001)
      return
    }
  }
}

// ---------------------------------------------------------------------------
// Collision footprints
// ---------------------------------------------------------------------------

/**
 * `PATH_AddCollisionFootprintForUnit` (#10713, 1.13c 0x6FD859D0; D2MOO #10222 Path.cpp:195).
 * Players and monsters: `COLLISION_SetMaskWithPattern(room, x, y, pPath->dwCollisionPattern, mask)`;
 * objects: `COLLISION_SetMaskWithSizeXY`; every other type: `COLLISION_SetMaskWithSize(sizeX)`.
 * D2MOO stamps players with `SetMaskWithSize` instead of the pattern (1.13c `cmp eax,1; jle` sends
 * players down the pattern branch). A NULL unit is dereferenced by 1.13c; the port throws.
 */
export function PATH_AddCollisionFootprintForUnit(pUnit: PathUnit): void {
  requireUnit(pUnit, 'PATH_AddCollisionFootprintForUnit')
  const t = pUnit.dwUnitType
  if (t === UNIT_PLAYER || t === UNIT_MONSTER) {
    const nPattern = requireUnitPath(pUnit, 'PATH_AddCollisionFootprintForUnit').dwCollisionPattern
    COLLISION_SetMaskWithPattern(
      UNITS_GetRoom(pUnit),
      UNITS_GetXPosition(pUnit),
      UNITS_GetYPosition(pUnit),
      nPattern,
      UNITS_GetCollisionMask(pUnit),
    )
  } else if (t === UNIT_OBJECT) {
    COLLISION_SetMaskWithSizeXY(
      UNITS_GetRoom(pUnit),
      UNITS_GetXPosition(pUnit),
      UNITS_GetYPosition(pUnit),
      UNITS_GetUnitSizeX(pUnit),
      UNITS_GetUnitSizeY(pUnit),
      UNITS_GetCollisionMask(pUnit),
    )
  } else {
    COLLISION_SetMaskWithSize(
      UNITS_GetRoom(pUnit),
      UNITS_GetXPosition(pUnit),
      UNITS_GetYPosition(pUnit),
      UNITS_GetUnitSizeX(pUnit),
      UNITS_GetCollisionMask(pUnit),
    )
  }
}

/**
 * `PATH_RemoveCollisionFootprintForUnit` (#10775, 1.13c 0x6FD85800; D2MOO #10223 Path.cpp:216).
 * Players (unless DEAD 17 / DEATH 0) and monsters (unless DEAD 12 / DEATH 0) reset their pattern;
 * objects reset their SizeX*SizeY box when `nHasCollision[mode]`; other types always reset
 * `SizeX`. `bForce` skips the mode / collision checks. Returns TRUE when something was reset.
 */
export function PATH_RemoveCollisionFootprintForUnit(pUnit: PathUnit, bForce: boolean | number): boolean {
  requireUnit(pUnit, 'PATH_RemoveCollisionFootprintForUnit')
  const t = pUnit.dwUnitType
  if (t === UNIT_PLAYER || t === UNIT_MONSTER) {
    const nDead = t === UNIT_PLAYER ? PLRMODE_DEAD : MONMODE_DEAD
    const nDeath = t === UNIT_PLAYER ? PLRMODE_DEATH : MONMODE_DEATH
    if (!bForce && (pUnit.dwAnimMode === nDead || pUnit.dwAnimMode === nDeath)) return false
    const nPattern = requireUnitPath(pUnit, 'PATH_RemoveCollisionFootprintForUnit').dwCollisionPattern
    COLLISION_ResetMaskWithPattern(
      UNITS_GetRoom(pUnit),
      UNITS_GetXPosition(pUnit),
      UNITS_GetYPosition(pUnit),
      nPattern,
      UNITS_GetCollisionMask(pUnit),
    )
    return true
  }
  if (t === UNIT_OBJECT) {
    if (!UNITS_HasCollision(pUnit) && !bForce) return false
    COLLISION_ResetMaskWithSizeXY(
      UNITS_GetRoom(pUnit),
      UNITS_GetXPosition(pUnit),
      UNITS_GetYPosition(pUnit),
      UNITS_GetUnitSizeX(pUnit),
      UNITS_GetUnitSizeY(pUnit),
      UNITS_GetCollisionMask(pUnit),
    )
    return true
  }
  COLLISION_ResetMaskWithSize(
    UNITS_GetRoom(pUnit),
    UNITS_GetXPosition(pUnit),
    UNITS_GetYPosition(pUnit),
    UNITS_GetUnitSizeX(pUnit),
    UNITS_GetCollisionMask(pUnit),
  )
  return true
}

/** `PATH_AddCollisionFootprintForOptionalUnit` (#11011, 1.13c 0x6FD85B80; D2MOO #10221 Path.cpp:1661). */
export function PATH_AddCollisionFootprintForOptionalUnit(pUnit: PathUnit | null): void {
  if (pUnit) PATH_AddCollisionFootprintForUnit(pUnit)
}

/**
 * `D2Common_11281_CollisionPatternFromSize` (#10122, 1.13c 0x6FD85360; D2MOO #11281 Path.cpp:651).
 * `nSize < 0 || nSize >= 4` -> SMALL_UNIT_PRESENCE (1); else the size table, remapped 1->3 / 2->4 for a
 * monster that `MONSTERS_CanBeInTown` and lacks MonStats `interact`. D2MOO writes the range test as
 * `nSize < 0 && nSize >= 4` (never true); 1.13c uses `||`.
 */
export function D2Common_11281_CollisionPatternFromSize(pUnit: PathUnit | null, nSize: number): number {
  if (nSize < 0 || nSize >= COLLISION_UNIT_SIZE_COUNT) return COLLISION_PATTERN_SMALL_UNIT_PRESENCE
  const nPattern = COLLISION_PATTERNS_FROM_SIZE[nSize]!
  if (pUnit && pUnit.dwUnitType === UNIT_MONSTER && MONSTERS_CanBeInTown(pUnit)) {
    const interact = (getMonsterPathRecord(pUnit.dwClassId).monStatsFlags & (1 << MONSTATSFLAGINDEX_INTERACT)) !== 0
    if (!interact) {
      if (nPattern === COLLISION_PATTERN_SMALL_UNIT_PRESENCE) return COLLISION_PATTERN_SMALL_PET_PRESENCE
      if (nPattern === COLLISION_PATTERN_BIG_UNIT_PRESENCE) return COLLISION_PATTERN_BIG_PET_PRESENCE
    }
  }
  return nPattern
}

/**
 * `PATH_GetCollisionPatternFromMonStats2Txt` (#10280, 1.13c 0x6FD853D0; D2MOO #11282 Path.cpp:620).
 * Class id / MonStatsEx / SizeX out of range -> 1. REVIVE or SMALL without ISATT remaps 1->3 / 2->4.
 */
export function PATH_GetCollisionPatternFromMonStats2Txt(nMonsterId: number): number {
  if (nMonsterId < 0 || nMonsterId >= MONSTATS_TXT_RECORD_COUNT) return COLLISION_PATTERN_SMALL_UNIT_PRESENCE
  const rec = getMonsterPathRecord(nMonsterId)
  if (rec.monStatsEx < 0 || rec.monStatsEx >= MONSTATS2_TXT_RECORD_COUNT) return COLLISION_PATTERN_SMALL_UNIT_PRESENCE
  if (rec.sizeX < 0 || rec.sizeX >= COLLISION_UNIT_SIZE_COUNT) return COLLISION_PATTERN_SMALL_UNIT_PRESENCE
  let nPattern = COLLISION_PATTERNS_FROM_SIZE[rec.sizeX]!
  const f = rec.monStats2Flags
  if ((f & MONSTATS2FLAG_REVIVE || f & MONSTATS2FLAG_SMALL) && !(f & MONSTATS2FLAG_ISATT)) {
    if (nPattern === COLLISION_PATTERN_SMALL_UNIT_PRESENCE) nPattern = COLLISION_PATTERN_SMALL_PET_PRESENCE
    else if (nPattern === COLLISION_PATTERN_BIG_UNIT_PRESENCE) nPattern = COLLISION_PATTERN_BIG_PET_PRESENCE
  }
  return nPattern
}

/** `PATH_GetUnitCollisionPattern` (#10123, 1.13c 0x6FD845D0; D2MOO #10210 Path.cpp:1596). No NULL check. */
export function PATH_GetUnitCollisionPattern(pUnit: PathUnit): number {
  return requireUnitPath(pUnit, 'PATH_GetUnitCollisionPattern').dwCollisionPattern
}

/** `PATH_SetUnitCollisionPattern` (#10671, 1.13c 0x6FD845B0; D2MOO #10211 Path.cpp:1602). No footprint update. */
export function PATH_SetUnitCollisionPattern(pUnit: PathUnit, nCollisionPattern: number): void {
  requireUnitPath(pUnit, 'PATH_SetUnitCollisionPattern').dwCollisionPattern = u32(nCollisionPattern)
}

/**
 * `D2Common_10214` (#10704, 1.13c 0x6FD85CF0; D2MOO #10214 Path.cpp:680): recompute the collision
 * pattern from `dwUnitSize` (re-stamping the footprint when the unit is in a room).
 */
export function D2Common_10214(pUnit: PathUnit): void {
  const pPath = pUnit.pDynamicPath
  if (!pPath) return
  if (UNITS_GetRoom(pUnit)) {
    PATH_RemoveCollisionFootprintForUnit(pUnit, true)
    requireUnitPath(pUnit, 'D2Common_10214').dwCollisionPattern = u32(
      D2Common_11281_CollisionPatternFromSize(pUnit, pPath.dwUnitSize | 0),
    )
    PATH_AddCollisionFootprintForUnit(pUnit)
  } else {
    requireUnitPath(pUnit, 'D2Common_10214').dwCollisionPattern = u32(
      D2Common_11281_CollisionPatternFromSize(pUnit, pPath.dwUnitSize | 0),
    )
  }
}

/** `D2Common_10228` (#10505, 1.13c 0x6FD85CD0; D2MOO #10228 Path.cpp:869): force-remove the footprint. */
export function D2Common_10228(pUnit: PathUnit): void {
  if (pUnit.pDynamicPath) PATH_RemoveCollisionFootprintForUnit(pUnit, true)
}

/**
 * `PATH_SetUnitDeadCollision` (#10084, 1.13c 0x6FD865A0; D2MOO #10143 Path.cpp:878).
 * Client monster (`!bForGameLogic`): remove footprint, pattern 5, footprint mask 0x8000 (corpse),
 * re-add. Otherwise: remove the footprint (when the unit has a path) and OR 0x8000 into the 3x3 box
 * around the unit (`COLLISION_SetCollisionMaskForBoundingBoxRecursively`, 0x6FD9B280). Both end with
 * `PATH_RecacheRoomAtCoordIfNeeded(path, centre X, centre Y, NULL)` (== #10770). 1.13c has no NULL
 * assert but dereferences the path in both branches; the port throws.
 */
export function PATH_SetUnitDeadCollision(pUnit: PathUnit, bForGameLogic: boolean | number): void {
  const pPath = requireUnitPath(pUnit, 'PATH_SetUnitDeadCollision')
  if (!bForGameLogic && pUnit.dwUnitType === UNIT_MONSTER) {
    PATH_RemoveCollisionFootprintForUnit(pUnit, true)
    requireUnitPath(pUnit, 'PATH_SetUnitDeadCollision').dwCollisionPattern = COLLISION_PATTERN_SMALL_NO_PRESENCE
    PATH_SetFootprintCollisionMask(pPath, COLLIDE_CORPSE)
    PATH_AddCollisionFootprintForUnit(pUnit)
  } else {
    PATH_RemoveCollisionFootprintForUnit(pUnit, true)
    const x = pPath.wPosX
    const y = pPath.wPosY
    COLLISION_SetCollisionMaskForBoundingBoxRecursively(
      pPath.pRoom,
      { nLeft: x - 1, nBottom: y - 1, nRight: x + 1, nTop: y + 1 },
      COLLIDE_CORPSE,
    )
  }
  PATH_RecacheRoomAtCoordIfNeeded(
    pPath,
    u32((pPath.dwPrecisionX & 0xffff0000) + 0x8000),
    u32((pPath.dwPrecisionY & 0xffff0000) + 0x8000),
    null,
  )
}

/**
 * `PATH_SetUnitAliveCollision` (#10938, 1.13c 0x6FD85BE0; D2MOO #10144 Path.cpp:898). Only for the
 * client (`!bForGameLogic`): asserts a monster unit (line 0x542); when its footprint mask is the corpse
 * mask, restores pattern (11281 of SizeX, or 5 for base ids 38/157/158/319 — 1.13c range-checks the
 * base id against the MonStats count first) and footprint mask 0x100, re-stamping when in a room.
 */
export function PATH_SetUnitAliveCollision(pUnit: PathUnit | null, bForGameLogic: boolean | number): void {
  if (bForGameLogic) return
  d2Assert(pUnit && pUnit.dwUnitType === UNIT_MONSTER, 'PATH_SetUnitAliveCollision: pUnit && pUnit->dwUnitType == UNIT_MONSTER')
  const pPath = pUnit.pDynamicPath
  if (!pPath || pPath.nFootprintCollisionMask !== COLLIDE_CORPSE) return
  let nPattern = D2Common_11281_CollisionPatternFromSize(pUnit, UNITS_GetUnitSizeX(pUnit))
  const nBaseId = MONSTERS_GetBaseIdFromMonsterUnit(pUnit)
  if (
    nBaseId >= 0 &&
    nBaseId < MONSTATS_TXT_RECORD_COUNT &&
    (nBaseId === MONSTER_WRAITH1 || nBaseId === MONSTER_BIRD1 || nBaseId === MONSTER_BIRD2 || nBaseId === MONSTER_PARROT)
  ) {
    nPattern = COLLISION_PATTERN_SMALL_NO_PRESENCE
  }
  if (UNITS_GetRoom(pUnit)) {
    PATH_RemoveCollisionFootprintForUnit(pUnit, true)
    requireUnitPath(pUnit, 'PATH_SetUnitAliveCollision').dwCollisionPattern = u32(nPattern)
    PATH_SetFootprintCollisionMask(pPath, COLLIDE_MONSTER)
    PATH_AddCollisionFootprintForUnit(pUnit)
  } else {
    requireUnitPath(pUnit, 'PATH_SetUnitAliveCollision').dwCollisionPattern = u32(nPattern)
    PATH_SetFootprintCollisionMask(pPath, COLLIDE_MONSTER)
  }
}

/**
 * `PATH_SetFootprintCollisionMask` (#11056, 1.13c 0x6FD85640; D2MOO #10182 Path.cpp:1323): with a
 * room, reset the old footprint (missiles: `ResetMaskWithSize(dwUnitSize)`, others: pattern), store
 * the new mask and stamp it the same way.
 */
export function PATH_SetFootprintCollisionMask(pDynamicPath: DynamicPath, nCollisionMask: number): void {
  const x = pDynamicPath.wPosX
  const y = pDynamicPath.wPosY
  if (pDynamicPath.pRoom) {
    if (pDynamicPath.pUnit && pDynamicPath.pUnit.dwUnitType === UNIT_MISSILE) {
      COLLISION_ResetMaskWithSize(pDynamicPath.pRoom, x, y, pDynamicPath.dwUnitSize | 0, pDynamicPath.nFootprintCollisionMask)
    } else {
      COLLISION_ResetMaskWithPattern(pDynamicPath.pRoom, x, y, pDynamicPath.dwCollisionPattern | 0, pDynamicPath.nFootprintCollisionMask)
    }
  }
  pDynamicPath.nFootprintCollisionMask = u32(nCollisionMask)
  if (pDynamicPath.pRoom) {
    if (pDynamicPath.pUnit && pDynamicPath.pUnit.dwUnitType === UNIT_MISSILE) {
      COLLISION_SetMaskWithSize(pDynamicPath.pRoom, x, y, pDynamicPath.dwUnitSize | 0, nCollisionMask)
    } else {
      COLLISION_SetMaskWithPattern(pDynamicPath.pRoom, x, y, pDynamicPath.dwCollisionPattern | 0, nCollisionMask)
    }
  }
}

/** `PATH_GetFootprintCollisionMask` (#10259, 1.13c 0x6FD848D0; D2MOO #10181 Path.cpp:1311). NULL -> 0xFFFF. */
export function PATH_GetFootprintCollisionMask(pDynamicPath: DynamicPath | null): number {
  return pDynamicPath ? pDynamicPath.nFootprintCollisionMask : 0xffff
}

/** `PATH_GetMoveTestCollisionMask` (#11083, 1.13c 0x6FD848C0; D2MOO #10183 Path.cpp:1353). */
export function PATH_GetMoveTestCollisionMask(pDynamicPath: DynamicPath): number {
  return pDynamicPath.nMoveTestCollisionMask
}

/** `PATH_SetMoveTestCollisionMask` (#11164, 1.13c 0x6FD848B0; D2MOO #10184 Path.cpp:1359). */
export function PATH_SetMoveTestCollisionMask(pDynamicPath: DynamicPath, nCollisionMask: number): void {
  pDynamicPath.nMoveTestCollisionMask = u32(nCollisionMask)
}

/**
 * `D2Common_10201` (#11009, 1.13c 0x6FD85BA0; D2MOO #10201 Path.cpp:1456): when the velocity is 0,
 * refresh `nCollidedWithMask` with `COLLISION_CheckMaskWithSize(room, pos, dwUnitSize, 0x7FFF)`.
 */
export function D2Common_10201(pDynamicPath: DynamicPath): number {
  if (pDynamicPath.dwVelocity === 0) {
    pDynamicPath.nCollidedWithMask = u16(
      COLLISION_CheckMaskWithSize(pDynamicPath.pRoom, pDynamicPath.wPosX, pDynamicPath.wPosY, pDynamicPath.dwUnitSize | 0, 0x7fff),
    )
  }
  return pDynamicPath.nCollidedWithMask
}

/** `D2Common_10202` (#10282, 1.13c 0x6FD84850; D2MOO #10202 Path.cpp:1468): `nCollidedWithMask`. */
export function D2Common_10202(pDynamicPath: DynamicPath): number {
  return pDynamicPath.nCollidedWithMask
}

// ---------------------------------------------------------------------------
// Room re-caching
// ---------------------------------------------------------------------------

/**
 * `PATH_RecacheRoom` (1.13c 0x6FD5D760, stdcall `(pPath, pHintRoom)`; D2MOO `PATHMISC_RecacheRoom`
 * PathMisc.cpp:1304). Keeps `pRoom` when it still contains (wPosX, wPosY); otherwise looks the
 * position up from `pRoom`, then from the hint room; a missile path without a room clears its points
 * and returns. Otherwise `pPreviousRoom = pRoom`, removes the unit from the old room, sets
 * `PATH_CURRENT_ROOM_INVALID`, stores the new room (possibly NULL) and adds + refreshes the unit there.
 */
export function PATH_RecacheRoom(pDynamicPath: DynamicPath, pHintRoom: PathRoom | null): void {
  const x = pDynamicPath.wPosX
  const y = pDynamicPath.wPosY
  const cur = pDynamicPath.pRoom
  if (cur && x >= cur.subX && x < cur.subX + cur.subW && y >= cur.subY && y < cur.subY + cur.subH) return
  let pNewRoom = DUNGEON_GetRoomAtPosition(cur, x, y)
  if (!pNewRoom && pHintRoom) pNewRoom = DUNGEON_GetRoomAtPosition(pHintRoom, x, y)
  if (!pNewRoom && pDynamicPath.dwFlags & PATH_MISSILE_MASK) {
    pDynamicPath.dwPathPoints = 0
    return
  }
  const pUnit = pDynamicPath.pUnit
  pDynamicPath.pPreviousRoom = cur
  if (cur) UNITROOM_RemoveUnitFromRoom(requireUnit(pUnit, 'PATH_RecacheRoom'))
  pDynamicPath.dwFlags = u32(pDynamicPath.dwFlags | PATH_CURRENT_ROOM_INVALID)
  pDynamicPath.pRoom = pNewRoom
  if (pNewRoom) {
    const u = requireUnit(pUnit, 'PATH_RecacheRoom')
    UNITROOM_AddUnitToRoom(u, pNewRoom)
    UNITROOM_RefreshUnit(u)
  }
}

/**
 * `PATH_RecacheRoomAtCoordIfNeeded` (1.13c 0x6FD5DA40, esi=pPath + stdcall `(dwPrecisionX,
 * dwPrecisionY, pHintRoom)`; D2MOO Step.cpp:764 takes `(pPath, pHintRoom, x, y)`). A missile path whose
 * target position has no room clears its points and returns. Otherwise stores the precise position,
 * recomputes the client coordinates and, when the path has a unit and `PATH_UNKNOWN_FLAG_0x00001` is
 * set, calls {@link PATH_RecacheRoom}.
 */
export function PATH_RecacheRoomAtCoordIfNeeded(
  pDynamicPath: DynamicPath,
  dwPrecisionX: number,
  dwPrecisionY: number,
  pHintRoom: PathRoom | null,
): void {
  const px = u32(dwPrecisionX)
  const py = u32(dwPrecisionY)
  if (pDynamicPath.dwFlags & PATH_MISSILE_MASK) {
    if (!DUNGEON_GetRoomAtPosition(pDynamicPath.pRoom, px >>> 16, py >>> 16)) {
      pDynamicPath.dwPathPoints = 0
      return
    }
  }
  pDynamicPath.dwPrecisionY = py
  pDynamicPath.dwPrecisionX = px
  PATH_UpdateClientCoords(pDynamicPath)
  if (pDynamicPath.pUnit && pDynamicPath.dwFlags & PATH_UNKNOWN_FLAG_0x00001) PATH_RecacheRoom(pDynamicPath, pHintRoom)
}

/**
 * `PATH_RecacheRoomIfNeeded` (#10770, 1.13c 0x6FD5DB40; D2MOO #10233 Step.cpp:830): snaps the
 * precise position to the sub-tile centre and calls {@link PATH_RecacheRoomAtCoordIfNeeded} without
 * a hint room.
 */
export function PATH_RecacheRoomIfNeeded(pDynamicPath: DynamicPath): void {
  PATH_RecacheRoomAtCoordIfNeeded(
    pDynamicPath,
    u32((pDynamicPath.dwPrecisionX & 0xffff0000) + 0x8000),
    u32((pDynamicPath.dwPrecisionY & 0xffff0000) + 0x8000),
    null,
  )
}

/**
 * `D2Common_10235_PATH_UpdateRiderPath` (#11121, 1.13c 0x6FD5DAB0; D2MOO #10235 Step.cpp:851). Asserts
 * both units (lines 0x54E / 0x54F). Rider flag 0x8 = positions differ; flag 0x1 |= rooms differ; then
 * `PATH_RecacheRoomAtCoordIfNeeded(rider, mount precise X/Y, hint = mount room)`. (D2MOO spells the
 * copy out instead of calling the shared helper.)
 */
export function D2Common_10235_PATH_UpdateRiderPath(pRiderUnit: PathUnit | null, pMountUnit: PathUnit | null): void {
  d2Assert(pRiderUnit, 'D2Common_10235_PATH_UpdateRiderPath: pRiderUnit (0x54E)')
  d2Assert(pMountUnit, 'D2Common_10235_PATH_UpdateRiderPath: pMountUnit (0x54F)')
  const pMount = requireUnitPath(pMountUnit, 'D2Common_10235_PATH_UpdateRiderPath')
  const pRider = requireUnitPath(pRiderUnit, 'D2Common_10235_PATH_UpdateRiderPath')
  if (pRider.wPosX === pMount.wPosX && pRider.wPosY === pMount.wPosY) {
    pRider.dwFlags = u32(pRider.dwFlags & ~PATH_UNKNOWN_FLAG_0x00008)
  } else {
    pRider.dwFlags = u32(pRider.dwFlags | PATH_UNKNOWN_FLAG_0x00008)
  }
  if (pRider.pRoom !== pMount.pRoom) pRider.dwFlags = u32(pRider.dwFlags | PATH_UNKNOWN_FLAG_0x00001)
  PATH_RecacheRoomAtCoordIfNeeded(pRider, pMount.dwPrecisionX, pMount.dwPrecisionY, pMount.pRoom)
}

/** `D2Common_10234` (#10203, 1.13c 0x6FD5CE90; D2MOO #10234 Step.cpp:839): `pPath ? dwFlags & 8 : 0`. */
export function D2Common_10234(pDynamicPath: DynamicPath | null): number {
  return pDynamicPath ? pDynamicPath.dwFlags & PATH_UNKNOWN_FLAG_0x00008 : 0
}

// ---------------------------------------------------------------------------
// Path type
// ---------------------------------------------------------------------------

/**
 * `PATH_SetType` (#10647, 1.13c 0x6FD84F80; D2MOO #10185 Path.cpp:1365). Asserts a player never gets
 * TOWARD (line 0x861). Table bit 0x2000 saves the current type as previous unless flag 0x4000;
 * bit 0x8000 saves the velocity unless flag 0x10000; `flags = (flags & 0xFFF800FF) | table`; then the
 * prev-type != KNOCKBACK_CLIENT / KNOCKBACK_SERVER asserts (0x871 / 0x872) and the missile
 * `nDistMax < 78` assert (0x873).
 */
export function PATH_SetType(pDynamicPath: DynamicPath, nPathType: number): void {
  assertPathType(nPathType, 'PATH_SetType')
  const pUnit = pDynamicPath.pUnit
  d2Assert(!(pUnit && pUnit.dwUnitType === UNIT_PLAYER && nPathType === PATHTYPE_TOWARD), 'PATH_SetType: player with PATHTYPE_TOWARD (0x861)')
  const nFlag = PATH_TYPE_FLAGS[nPathType]!
  if (nFlag & PATH_UNKNOWN_FLAG_0x02000 && !(pDynamicPath.dwFlags & PATH_UNKNOWN_FLAG_0x04000)) {
    pDynamicPath.dwPrevPathType = pDynamicPath.dwPathType
  }
  if (nFlag & PATH_WITH_PREVIOUS_VELOCITY && !(pDynamicPath.dwFlags & PATH_UNKNOWN_FLAG_0x10000)) {
    pDynamicPath.nPreviousVelocity = u32(pDynamicPath.dwVelocity)
  }
  pDynamicPath.dwFlags = u32((pDynamicPath.dwFlags & 0xfff800ff) | nFlag)
  pDynamicPath.dwPathType = nPathType
  pDynamicPath.nDirOffset = OFFSET_FOR_PATH_TYPE[nPathType]!
  d2Assert(pDynamicPath.dwPrevPathType !== PATHTYPE_KNOCKBACK_CLIENT, 'PATH_SetType: dwPrevPathType != KNOCKBACK_CLIENT (0x871)')
  d2Assert(pDynamicPath.dwPrevPathType !== PATHTYPE_KNOCKBACK_SERVER, 'PATH_SetType: dwPrevPathType != KNOCKBACK_SERVER (0x872)')
  d2Assert(nPathType !== PATHTYPE_MISSILE || pDynamicPath.nDistMax < MAXPATHLEN, 'PATH_SetType: missile nDistMax < MAXPATHLEN (0x873)')
}

/**
 * `PATH_ResetToPreviousType` (#10498, 1.13c 0x6FD85210; D2MOO #10186 Path.cpp:1391). Asserts pUnit
 * (0x87E); flag 0x8000 restores the saved velocity; players -> STRAIGHT, others -> previous type when
 * flag 0x2000.
 */
export function PATH_ResetToPreviousType(pDynamicPath: DynamicPath): void {
  const pUnit = pDynamicPath.pUnit
  d2Assert(pUnit, 'PATH_ResetToPreviousType: pDynamicPath->pUnit (0x87E)')
  const nFlags = pDynamicPath.dwFlags
  if (nFlags & PATH_WITH_PREVIOUS_VELOCITY) pDynamicPath.dwVelocity = i32(pDynamicPath.nPreviousVelocity)
  if (pUnit.dwUnitType === UNIT_PLAYER) {
    PATH_SetType(pDynamicPath, PATHTYPE_STRAIGHT)
  } else if (nFlags & PATH_UNKNOWN_FLAG_0x02000) {
    PATH_SetType(pDynamicPath, pDynamicPath.dwPrevPathType)
  }
}

/** `PATH_GetType` (#10471, 1.13c 0x6FD848A0; D2MOO #10187 Path.cpp:1414). */
export function PATH_GetType(pDynamicPath: DynamicPath): number {
  return pDynamicPath.dwPathType
}

// ---------------------------------------------------------------------------
// Velocity
// ---------------------------------------------------------------------------

/**
 * `PATH_SetVelocity` (#10488, 1.13c 0x6FD84D40, stdcall `(pPath, nVelocity, szFile, nLine)`; D2MOO
 * #10146 Path.cpp:938). A changed velocity sets `unk0x38 = 15`; velocity and max velocity are
 * stored. A NULL path is only traced by the original (FOG_Trace) and ignored; so is it here.
 */
export function PATH_SetVelocity(pDynamicPath: DynamicPath | null, nVelocity: number, _szFile = '', _nLine = 0): void {
  if (!pDynamicPath) return
  const v = i32(nVelocity)
  if (v !== pDynamicPath.dwVelocity) pDynamicPath.unk0x38 = 15
  pDynamicPath.dwVelocity = v
  pDynamicPath.dwMaxVelocity = v
}

/** `PATH_GetVelocity` (#10777, 1.13c 0x6FD84D30; D2MOO #10147 Path.cpp:957). */
export function PATH_GetVelocity(pDynamicPath: DynamicPath): number {
  return pDynamicPath.dwVelocity
}

/** `PATH_SetMaxVelocity` (#10378, 1.13c 0x6FD84D10; D2MOO #10148 Path.cpp:963). */
export function PATH_SetMaxVelocity(pDynamicPath: DynamicPath, nMaxVelocity: number): void {
  pDynamicPath.dwMaxVelocity = i32(nMaxVelocity)
}

/** `PATH_GetMaxVelocity` (#10424, 1.13c 0x6FD84D00; D2MOO #10149 Path.cpp:969). */
export function PATH_GetMaxVelocity(pDynamicPath: DynamicPath): number {
  return pDynamicPath.dwMaxVelocity
}

/** `PATH_SetAcceleration` (#11022, 1.13c 0x6FD84CE0; D2MOO #10150 Path.cpp:975). */
export function PATH_SetAcceleration(pDynamicPath: DynamicPath, nAcceleration: number): void {
  pDynamicPath.dwAcceleration = i32(nAcceleration)
}

/** `PATH_GetAcceleration` (#10616, 1.13c 0x6FD84CD0; D2MOO #10151 Path.cpp:981). */
export function PATH_GetAcceleration(pDynamicPath: DynamicPath): number {
  return pDynamicPath.dwAcceleration
}

// ---------------------------------------------------------------------------
// Path points
// ---------------------------------------------------------------------------

/** `D2Common_10153` (#10159, 1.13c 0x6FD84CB0; D2MOO #10153 Path.cpp:988): clear flag 0x20, 0 points. */
export function D2Common_10153(pDynamicPath: DynamicPath): void {
  pDynamicPath.dwFlags = u32(pDynamicPath.dwFlags & ~PATH_UNKNOWN_FLAG_0x00020)
  pDynamicPath.dwPathPoints = 0
}

/** `D2COMMON_10208_PathSetPathingFlag` (#10559, 1.13c 0x6FD84C80; D2MOO #10208 Path.cpp:996): flag 0x20. */
export function D2COMMON_10208_PathSetPathingFlag(pDynamicPath: DynamicPath, bSet: boolean | number): void {
  pDynamicPath.dwFlags = u32(bSet ? pDynamicPath.dwFlags | PATH_UNKNOWN_FLAG_0x00020 : pDynamicPath.dwFlags & ~PATH_UNKNOWN_FLAG_0x00020)
}

/** `D2COMMON_10209_PathCheckPathingFlag` (#11046, 1.13c 0x6FD84C70; D2MOO #10209 Path.cpp:1010): `flags & 0x20`. */
export function D2COMMON_10209_PathCheckPathingFlag(pDynamicPath: DynamicPath): number {
  return pDynamicPath.dwFlags & PATH_UNKNOWN_FLAG_0x00020
}

/** `PATH_GetNumberOfPathPoints` (#10800, 1.13c 0x6FD84C60; D2MOO #10154 Path.cpp:1016). */
export function PATH_GetNumberOfPathPoints(pDynamicPath: DynamicPath): number {
  return pDynamicPath.dwPathPoints
}

/** `PATH_SetNumberOfPathPoints` (#10165, 1.13c 0x6FD85080; D2MOO #11291 Path.cpp:1022): `n > 77 -> 77`. */
export function PATH_SetNumberOfPathPoints(pDynamicPath: DynamicPath, nPoints: number): void {
  const n = i32(nPoints)
  pDynamicPath.dwPathPoints = n > MAXPATHLEN - 1 ? MAXPATHLEN - 1 : n
}

/** `D2Common_10155` (#10452, 1.13c 0x6FD84C50; D2MOO #10155 Path.cpp:1036): `dwCurrentPointIdx`. */
export function D2Common_10155(pDynamicPath: DynamicPath): number {
  return pDynamicPath.dwCurrentPointIdx
}

/**
 * `PATH_GetPathPoints` (#10817, 1.13c 0x6FD84C30; D2MOO #10157 Path.cpp:1042): returns the live
 * `PathPoints` array (the original writes its address to `*ppPathPoints`) and `dwPathPoints`.
 */
export function PATH_GetPathPoints(pDynamicPath: DynamicPath): { readonly pPathPoints: PathPoint[]; readonly nCount: number } {
  return { pPathPoints: pDynamicPath.PathPoints, nCount: pDynamicPath.dwPathPoints }
}

/** `D2COMMON_10175_PathGetFirstPointX` (#10983, 1.13c 0x6FD84AB0; D2MOO Path.cpp:1154): `tTargetCoord.X`. */
export function D2COMMON_10175_PathGetFirstPointX(pDynamicPath: DynamicPath): number {
  return pDynamicPath.tTargetCoord.X
}

/** `D2COMMON_10176_PathGetFirstPointY` (#10764, 1.13c 0x6FD84AA0; D2MOO Path.cpp:1161): `tTargetCoord.Y`. */
export function D2COMMON_10176_PathGetFirstPointY(pDynamicPath: DynamicPath): number {
  return pDynamicPath.tTargetCoord.Y
}

/** `D2Common_10224` (#10690, 1.13c 0x6FD84A90; D2MOO Path.cpp:1168): `tFinalTargetCoord.X`. */
export function D2Common_10224(pDynamicPath: DynamicPath): number {
  return pDynamicPath.tFinalTargetCoord.X
}

/** `D2Common_10225` (#10999, 1.13c 0x6FD84A80; D2MOO Path.cpp:1175): `tFinalTargetCoord.Y`. */
export function D2Common_10225(pDynamicPath: DynamicPath): number {
  return pDynamicPath.tFinalTargetCoord.Y
}

/** `D2COMMON_10177_PATH_GetLastPointX` (#10976, 1.13c 0x6FD84A60; D2MOO Path.cpp:1181): last point X or 0. */
export function D2COMMON_10177_PATH_GetLastPointX(pDynamicPath: DynamicPath): number {
  const n = pDynamicPath.dwPathPoints
  return n ? pDynamicPath.PathPoints[n - 1]!.X : 0
}

/** `D2COMMON_10178_PATH_GetLastPointY` (#11001, 1.13c 0x6FD84A40; D2MOO Path.cpp:1192): last point Y or 0. */
export function D2COMMON_10178_PATH_GetLastPointY(pDynamicPath: DynamicPath): number {
  const n = pDynamicPath.dwPathPoints
  return n ? pDynamicPath.PathPoints[n - 1]!.Y : 0
}

// ---------------------------------------------------------------------------
// Direction
// ---------------------------------------------------------------------------

/** `PATH_GetDirection` (#10042, 1.13c 0x6FD84C10; D2MOO #10158 Path.cpp:1049). NULL -> 0. */
export function PATH_GetDirection(pDynamicPath: DynamicPath | null): number {
  return pDynamicPath ? pDynamicPath.nDirection : 0
}

/** `PATH_GetNewDirection` (#10788, 1.13c 0x6FD84C00; D2MOO #10159 Path.cpp:1060). */
export function PATH_GetNewDirection(pDynamicPath: DynamicPath): number {
  return pDynamicPath.nNewDirection
}

/**
 * Requests a turn towards `nDirection` (1.13c 0x6FD850B0, ecx=pPath al=nDirection; D2MOO `sub_6FDA9720`
 * Path.cpp:786). Objects / items turn at once; missiles turn unless flag 0x40; everything else (and a
 * path without unit) records `nNewDirection` and the per-tick turn step `DIFF_DIRECTION[(new - cur) & 63]`.
 */
export function sub_6FDA9720(pDynamicPath: DynamicPath, nDirection: number): void {
  const nType = pDynamicPath.pUnit ? pDynamicPath.pUnit.dwUnitType : UNIT_TYPES_COUNT
  const d = PATH_NormalizeDirection(nDirection)
  switch (nType) {
    case UNIT_OBJECT:
    case 4 /* UNIT_ITEM */:
      pDynamicPath.nDirection = d
      break
    case UNIT_MISSILE:
      if (!(pDynamicPath.dwFlags & PATH_UNKNOWN_FLAG_0x00040)) pDynamicPath.nDirection = d
      break
    default:
      if (d !== pDynamicPath.nNewDirection) {
        pDynamicPath.nNewDirection = d
        pDynamicPath.nDiffDirection = u8(DIFF_DIRECTION[(d - pDynamicPath.nDirection) & 0x3f]!)
      }
      break
  }
}

/**
 * `D2COMMON_10160_PathUpdateDirection` (#10425, 1.13c 0x6FD85270; D2MOO #10160 Path.cpp:1067): asserts
 * `nDirection < 64` (line 0x672) then behaves like {@link sub_6FDA9720}.
 */
export function D2COMMON_10160_PathUpdateDirection(pDynamicPath: DynamicPath, nDirection: number): void {
  d2Assert(u8(nDirection) < 64, `D2COMMON_10160_PathUpdateDirection: nDirection ${nDirection} < 64 (0x672)`)
  sub_6FDA9720(pDynamicPath, u8(nDirection))
}

/** `PATH_SetDirection` (#10706, 1.13c 0x6FD84BE0; D2MOO #10161 Path.cpp:1075): NULL ignored; dir = new dir = n & 63. */
export function PATH_SetDirection(pDynamicPath: DynamicPath | null, nDirection: number): void {
  if (!pDynamicPath) return
  const d = nDirection & 0x3f
  pDynamicPath.nDirection = d
  pDynamicPath.nNewDirection = d
}

/**
 * `D2COMMON_10193_PATH_AdjustDirection` (#10603, 1.13c 0x6FD84D70; D2MOO #10193 Path.cpp:824). One
 * turn step: unless already facing `nNewDirection` or flag 0x40, `dir = (dir + diff) & 63`; then with
 * `rem = (dir - new) & 63`: `rem > 31 && diff > 63` or `rem < 31 && diff < 63` snaps to `nNewDirection`
 * (unsigned byte compares; `rem == 31` keeps turning).
 */
export function D2COMMON_10193_PATH_AdjustDirection(pDynamicPath: DynamicPath): void {
  if (pDynamicPath.nDirection === pDynamicPath.nNewDirection || pDynamicPath.dwFlags & PATH_UNKNOWN_FLAG_0x00040) return
  const diff = pDynamicPath.nDiffDirection & 0xff
  pDynamicPath.nDirection = (diff + pDynamicPath.nDirection) & 0x3f
  const rem = (pDynamicPath.nDirection - pDynamicPath.nNewDirection) & 0x3f
  if (rem > 31) {
    if (diff > 63) pDynamicPath.nDirection = pDynamicPath.nNewDirection
  } else if (rem < 31) {
    if (diff < 63) pDynamicPath.nDirection = pDynamicPath.nNewDirection
  }
}

/**
 * `D2Common_10216` (#10739, 1.13c 0x6FD852F0; D2MOO #10216 Path.cpp:850). Faces the sub-tile (x, y):
 * direction from `PATH_GetDirectionVector(precX, precY, (x << 16) + 0x8000, (y << 16) + 0x8000)`;
 * `bDirect` sets current + new direction, otherwise {@link sub_6FDA9720}. NULL path ignored.
 */
export function D2Common_10216(pDynamicPath: DynamicPath | null, nX: number, nY: number, bDirect: boolean | number): void {
  if (!pDynamicPath) return
  const d =
    PATH_GetDirectionVector(pDynamicPath.dwPrecisionX, pDynamicPath.dwPrecisionY, subtileCenter(nX), subtileCenter(nY)).direction & 0xff
  if (bDirect) {
    pDynamicPath.nDirection = d & 0x3f
    pDynamicPath.nNewDirection = d & 0x3f
  } else {
    sub_6FDA9720(pDynamicPath, d)
  }
}

/**
 * `D2COMMON_10203_PATH_SetRotateFlag` (#10520, 1.13c 0x6FD846F0; D2MOO #10203 Path.cpp:1521). NULL
 * ignored; `bReset` clears flag 0x40, otherwise sets it.
 */
export function D2COMMON_10203_PATH_SetRotateFlag(pDynamicPath: DynamicPath | null, bReset: boolean | number): void {
  if (!pDynamicPath) return
  pDynamicPath.dwFlags = u32(bReset ? pDynamicPath.dwFlags & ~PATH_UNKNOWN_FLAG_0x00040 : pDynamicPath.dwFlags | PATH_UNKNOWN_FLAG_0x00040)
}

// ---------------------------------------------------------------------------
// Position
// ---------------------------------------------------------------------------

/** `PATH_GetXPosition` (#10867, 1.13c 0x6FD84BB0; D2MOO #10162 Path.cpp:1085): asserts (0x692); `wPosX`. */
export function PATH_GetXPosition(pDynamicPath: DynamicPath | null): number {
  return requirePath(pDynamicPath, 'PATH_GetXPosition (0x692)').wPosX
}

/** `PATH_GetYPosition` (#10750, 1.13c 0x6FD84B80; D2MOO #10163 Path.cpp:1093): asserts (0x69D); `wPosY`. */
export function PATH_GetYPosition(pDynamicPath: DynamicPath | null): number {
  return requirePath(pDynamicPath, 'PATH_GetYPosition (0x69D)').wPosY
}

/** `PATH_GetPrecisionX` (#10780, 1.13c 0x6FD84B50; D2MOO #10194 Path.cpp:1101): asserts (0x6A8). */
export function PATH_GetPrecisionX(pDynamicPath: DynamicPath | null): number {
  return requirePath(pDynamicPath, 'PATH_GetPrecisionX (0x6A8)').dwPrecisionX
}

/** `PATH_GetPrecisionY` (#10528, 1.13c 0x6FD84B20; D2MOO #10195 Path.cpp:1109): asserts (0x6B3). */
export function PATH_GetPrecisionY(pDynamicPath: DynamicPath | null): number {
  return requirePath(pDynamicPath, 'PATH_GetPrecisionY (0x6B3)').dwPrecisionY
}

/** `PATH_SetPrecisionX` (#10236, 1.13c 0x6FD84B10; D2MOO #10196 Path.cpp:1117): raw store (no client coords). */
export function PATH_SetPrecisionX(pDynamicPath: DynamicPath, nPrecisionX: number): void {
  pDynamicPath.dwPrecisionX = u32(nPrecisionX)
}

/** `PATH_SetPrecisionY` (#10575, 1.13c 0x6FD84B00; D2MOO #10197 Path.cpp:1123): raw store (no client coords). */
export function PATH_SetPrecisionY(pDynamicPath: DynamicPath, nPrecisionY: number): void {
  pDynamicPath.dwPrecisionY = u32(nPrecisionY)
}

/** `PATH_GetClientCoordX` (#10860, 1.13c 0x6FD84AF0; D2MOO #10164 Path.cpp:1129). */
export function PATH_GetClientCoordX(pDynamicPath: DynamicPath): number {
  return pDynamicPath.dwClientCoordX
}

/** `PATH_GetClientCoordY` (#10250, 1.13c 0x6FD84AE0; D2MOO #10165 Path.cpp:1135). */
export function PATH_GetClientCoordY(pDynamicPath: DynamicPath): number {
  return pDynamicPath.dwClientCoordY
}

/** `PATH_SetClientCoordX` (1.13c 0x6FD84AD0, fastcall ecx=pPath eax=value; D2MOO Path.cpp:1141). */
export function PATH_SetClientCoordX(pDynamicPath: DynamicPath, nX: number): void {
  pDynamicPath.dwClientCoordX = i32(nX)
}

/** `PATH_SetClientCoordY` (1.13c 0x6FD84AC0, fastcall ecx=pPath eax=value; D2MOO Path.cpp:1147). */
export function PATH_SetClientCoordY(pDynamicPath: DynamicPath, nY: number): void {
  pDynamicPath.dwClientCoordY = i32(nY)
}

/** `PATH_ComputeSquaredDistance` (#10769, 1.13c 0x6FD84580; D2MOO #10220 Path.cpp:1653): 32-bit `dx*dx + dy*dy`. */
export function PATH_ComputeSquaredDistance(nX1: number, nY1: number, nX2: number, nY2: number): number {
  const dx = (nX2 - nX1) | 0
  const dy = (nY2 - nY1) | 0
  return (Math.imul(dy, dy) + Math.imul(dx, dx)) | 0
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

/** `PATH_GetRoom` (#10687, 1.13c 0x6FD84A30; D2MOO #10166 Path.cpp:1203). */
export function PATH_GetRoom(pDynamicPath: DynamicPath): PathRoom | null {
  return pDynamicPath.pRoom
}

/** `PATH_SetRoom` (#11141, 1.13c 0x6FD84A20; D2MOO #10167 Path.cpp:1209). */
export function PATH_SetRoom(pDynamicPath: DynamicPath, pRoom: PathRoom | null): void {
  pDynamicPath.pRoom = pRoom
}

/** `PATH_GetNextRoom` (#10950, 1.13c 0x6FD84A10; D2MOO #10168 Path.cpp:1215): returns `pPreviousRoom`. */
export function PATH_GetNextRoom(pDynamicPath: DynamicPath): PathRoom | null {
  return pDynamicPath.pPreviousRoom
}

/** `PATH_ClearNextRoom` (#10451, 1.13c 0x6FD84A00; D2MOO #10169 Path.cpp:1221): `pPreviousRoom = NULL`. */
export function PATH_ClearNextRoom(pDynamicPath: DynamicPath): void {
  pDynamicPath.pPreviousRoom = null
}

/** `PATH_IsCurrentRoomInvalid` (#10462, 1.13c 0x6FD849C0; D2MOO #10172 Path.cpp:1240): `flags & 2`. */
export function PATH_IsCurrentRoomInvalid(pDynamicPath: DynamicPath): number {
  return pDynamicPath.dwFlags & PATH_CURRENT_ROOM_INVALID
}

/** `PATH_SetCurrentRoomInvalid` (#10390, 1.13c 0x6FD84990; D2MOO #10173 Path.cpp:1247): flag 2. */
export function PATH_SetCurrentRoomInvalid(pDynamicPath: DynamicPath, bSet: boolean | number): void {
  pDynamicPath.dwFlags = u32(bSet ? pDynamicPath.dwFlags | PATH_CURRENT_ROOM_INVALID : pDynamicPath.dwFlags & ~PATH_CURRENT_ROOM_INVALID)
}

/** `PATH_SetUnusedFlag_0x00004` (#10888, 1.13c 0x6FD84960; D2MOO #10145 Path.cpp:1260). */
export function PATH_SetUnusedFlag_0x00004(pDynamicPath: DynamicPath, bSet: boolean | number): void {
  pDynamicPath.dwFlags = u32(bSet ? pDynamicPath.dwFlags | PATH_UNUSED_FLAG_0x00004 : pDynamicPath.dwFlags & ~PATH_UNUSED_FLAG_0x00004)
}

/** `PATH_GetUnusedFlag_0x00004` (#11130, 1.13c 0x6FD84950; D2MOO #10174 Path.cpp:1273). */
export function PATH_GetUnusedFlag_0x00004(pDynamicPath: DynamicPath): number {
  return pDynamicPath.dwFlags & PATH_UNUSED_FLAG_0x00004
}

// ---------------------------------------------------------------------------
// Target
// ---------------------------------------------------------------------------

/**
 * `D2COMMON_10170_PathSetTargetPos` (#10286, 1.13c 0x6FD849D0; D2MOO #10170 Path.cpp:1228). NULL
 * ignored; stores the uint16 target and clears `pTargetUnit` (type / GUID are left untouched).
 */
export function D2COMMON_10170_PathSetTargetPos(pDynamicPath: DynamicPath | null, nX: number, nY: number): void {
  if (!pDynamicPath) return
  pDynamicPath.tTargetCoord.X = u16(nX)
  pDynamicPath.tTargetCoord.Y = u16(nY)
  pDynamicPath.pTargetUnit = null
}

/**
 * `PATH_SetTargetUnit` (#10336, 1.13c 0x6FD85040; D2MOO #10179 Path.cpp:1279): stores the unit and,
 * when non-NULL, its type and GUID (a NULL unit keeps the old type / GUID).
 */
export function PATH_SetTargetUnit(pDynamicPath: DynamicPath, pUnit: PathUnit | null): void {
  pDynamicPath.pTargetUnit = pUnit
  if (pUnit) {
    pDynamicPath.dwTargetType = u32(pUnit.dwUnitType)
    pDynamicPath.dwTargetId = u32(pUnit.dwUnitId)
  }
}

/**
 * `PATH_GetTargetTypeAndGUID` (#11163, 1.13c 0x6FD84910; D2MOO #10171 Path.cpp:1291): asserts
 * `pTargetUnit` (line 0x7C0) and returns the stored type / GUID.
 */
export function PATH_GetTargetTypeAndGUID(pDynamicPath: DynamicPath): { readonly nTargetType: number; readonly nTargetGUID: number } {
  d2Assert(pDynamicPath.pTargetUnit, 'PATH_GetTargetTypeAndGUID: pDynamicPath->pTargetUnit (0x7C0)')
  return { nTargetType: pDynamicPath.dwTargetType, nTargetGUID: pDynamicPath.dwTargetId }
}

/** `PATH_GetTargetUnit` (#10392, 1.13c 0x6FD848F0; D2MOO #10180 Path.cpp:1300). NULL path -> NULL. */
export function PATH_GetTargetUnit(pDynamicPath: DynamicPath | null): PathUnit | null {
  return pDynamicPath ? pDynamicPath.pTargetUnit : null
}

// ---------------------------------------------------------------------------
// Distances / step counters
// ---------------------------------------------------------------------------

/** `D2COMMON_10190_PATH_SetDistance` (#10527, 1.13c 0x6FD84880; D2MOO #10190 Path.cpp:1421): `nDist = (uint8)n`. */
export function D2COMMON_10190_PATH_SetDistance(pDynamicPath: DynamicPath, nDistance: number): void {
  pDynamicPath.nDist = u8(nDistance)
}

/** `D2COMMON_10191_PATH_GetDistance` (#10981, 1.13c 0x6FD84870; D2MOO #10191 Path.cpp:1428): `nDist`. */
export function D2COMMON_10191_PATH_GetDistance(pDynamicPath: DynamicPath): number {
  return pDynamicPath.nDist
}

/**
 * `PATH_SetNewDistance` (#10168, 1.13c 0x6FD84F50; D2MOO #10188 Path.cpp:1434). NULL ignored;
 * `nDistMax = nDist = min((uint8)n, 77)`.
 */
export function PATH_SetNewDistance(pDynamicPath: DynamicPath | null, nNewDistance: number): void {
  if (!pDynamicPath) return
  let v = u8(nNewDistance)
  if (v >= MAXPATHLEN - 1) v = MAXPATHLEN - 1
  pDynamicPath.nDistMax = v
  pDynamicPath.nDist = v
}

/** `PATH_GetMaxDistance` (#11058, 1.13c 0x6FD84860; D2MOO #10189 Path.cpp:1449): `nDistMax`. */
export function PATH_GetMaxDistance(pDynamicPath: DynamicPath): number {
  return pDynamicPath.nDistMax
}

/**
 * `PATH_SetIDAStarInitFScore` (#10359, 1.13c 0x6FD84810; D2MOO #10192 Path.cpp:1474): asserts the path
 * type is IDA* (line 0x8E8) and stores the uint8.
 */
export function PATH_SetIDAStarInitFScore(pDynamicPath: DynamicPath, nIDAStarInitFScore: number): void {
  d2Assert(pDynamicPath.dwPathType === 0, 'PATH_SetIDAStarInitFScore: dwPathType == PATHTYPE_IDASTAR (0x8E8)')
  pDynamicPath.nIDAStarInitFScore = u8(nIDAStarInitFScore)
}

/**
 * `D2COMMON_10198_PathGetSaveStep` (#10214, 1.13c 0x6FD847C0; D2MOO #10198 Path.cpp:1483): asserts
 * `PATH_SAVE_STEPS_MASK` (0x8F4); returns the live saved-steps array and count.
 */
export function D2COMMON_10198_PathGetSaveStep(pDynamicPath: DynamicPath): { readonly pSavedSteps: PathPoint[]; readonly nCount: number } {
  d2Assert(pDynamicPath.dwFlags & PATH_SAVE_STEPS_MASK, 'D2COMMON_10198_PathGetSaveStep: PATH_SAVE_STEPS_MASK (0x8F4)')
  return { pSavedSteps: pDynamicPath.SavedSteps, nCount: pDynamicPath.nSavedStepsCount }
}

/** `D2COMMON_10199_PathGetSaveX` (#10253, 1.13c 0x6FD84770; D2MOO Path.cpp:1493): asserts 0x20000 (0x902); last saved X or 0. */
export function D2COMMON_10199_PathGetSaveX(pDynamicPath: DynamicPath): number {
  d2Assert(pDynamicPath.dwFlags & PATH_SAVE_STEPS_MASK, 'D2COMMON_10199_PathGetSaveX: PATH_SAVE_STEPS_MASK (0x902)')
  const n = pDynamicPath.nSavedStepsCount
  return n ? pDynamicPath.SavedSteps[n - 1]!.X : 0
}

/** `D2COMMON_10200_PathGetSaveY` (#10477, 1.13c 0x6FD84720; D2MOO Path.cpp:1507): asserts 0x20000 (0x911); last saved Y or 0. */
export function D2COMMON_10200_PathGetSaveY(pDynamicPath: DynamicPath): number {
  d2Assert(pDynamicPath.dwFlags & PATH_SAVE_STEPS_MASK, 'D2COMMON_10200_PathGetSaveY: PATH_SAVE_STEPS_MASK (0x911)')
  const n = pDynamicPath.nSavedStepsCount
  return n ? pDynamicPath.SavedSteps[n - 1]!.Y : 0
}

/** `D2COMMON_10204_PATH_ClearPoint2` (#10723, 1.13c 0x6FD846D0; D2MOO #10204 Path.cpp:1538): `tPrevTargetCoord = {0,0}`. */
export function D2COMMON_10204_PATH_ClearPoint2(pDynamicPath: DynamicPath): void {
  pDynamicPath.tPrevTargetCoord.X = 0
  pDynamicPath.tPrevTargetCoord.Y = 0
}

/**
 * `PATH_SetStepNum` (#11005, 1.13c 0x6FD846A0; D2MOO #10205 Path.cpp:1545). NULL ignored;
 * `0 < (uint8)n < 20 -> nStepNum = n - 1`, else 0.
 */
export function PATH_SetStepNum(pDynamicPath: DynamicPath | null, nSteps: number): void {
  if (!pDynamicPath) return
  const n = u8(nSteps)
  pDynamicPath.nStepNum = n > 0 && n < PATH_MAX_STEPNUM ? n - 1 : 0
}

/** `PATH_GetStepNum` (#10229, 1.13c 0x6FD84690; D2MOO #10206 Path.cpp:1561): `nStepNum + 1`. */
export function PATH_GetStepNum(pDynamicPath: DynamicPath): number {
  return pDynamicPath.nStepNum + 1
}

/** `D2Common_10207` (#10219, 1.13c 0x6FD84670; D2MOO #10207 Path.cpp:1568): `unk0x67 = a2; dwSpeed = a3` (uint8). */
export function D2Common_10207(pDynamicPath: DynamicPath, a2: number, a3: number): void {
  pDynamicPath.unk0x67 = u8(a2)
  pDynamicPath.dwSpeed = u8(a3)
}

/** `PATH_SetDistance` (#10022, 1.13c 0x6FD84630; D2MOO #10217 Path.cpp:1575): asserts 0..255 (0x965); `nDistance`. */
export function PATH_SetDistance(pDynamicPath: DynamicPath, nDist: number): void {
  const n = i32(nDist)
  d2Assert(n >= 0 && n <= 255, `PATH_SetDistance: 0 <= ${n} <= 255 (0x965)`)
  pDynamicPath.nDistance = n
}

/** `PATH_GetDistance` (#10730, 1.13c 0x6FD84620; D2MOO #10218 Path.cpp:1583): `nDistance`. */
export function PATH_GetDistance(pDynamicPath: DynamicPath): number {
  return pDynamicPath.nDistance
}

/** `PATH_AddToDistance` (#10311, 1.13c 0x6FD845E0; D2MOO #10219 Path.cpp:1589): `nDistance = clamp(nDistance + n, 0, 255)`. */
export function PATH_AddToDistance(pDynamicPath: DynamicPath, nAddition: number): void {
  const v = (pDynamicPath.nDistance + nAddition) | 0
  pDynamicPath.nDistance = v < 0 ? 0 : v > 255 ? 255 : v
}

// ---------------------------------------------------------------------------
// Unit-level helpers
// ---------------------------------------------------------------------------

/**
 * `D2COMMON_10212_PATH_SetMoveFlags` (#10054, 1.13c 0x6FD84EE0; D2MOO #10212 Path.cpp:1609): asserts the
 * unit path (line 0x9A2), toggles `UNITFLAGEX_UNK_PATH_RELATED` (0x2000) and resets `unk0x38`.
 */
export function D2COMMON_10212_PATH_SetMoveFlags(pUnit: PathUnit, bSet: boolean | number): void {
  const pPath = requireUnitPath(pUnit, 'D2COMMON_10212_PATH_SetMoveFlags (0x9A2)')
  pUnit.dwFlagEx = u32(bSet ? pUnit.dwFlagEx | UNITFLAGEX_UNK_PATH_RELATED : pUnit.dwFlagEx & ~UNITFLAGEX_UNK_PATH_RELATED)
  pPath.unk0x38 = 0
}

/** `D2Common_10237` (#10877, 1.13c 0x6FD84550; D2MOO #10237 Path.cpp:1671): `dwCurrentPointIdx < dwPathPoints`. */
export function D2Common_10237(pUnit: PathUnit | null): boolean {
  if (!pUnit || !pUnit.pDynamicPath) return false
  return pUnit.pDynamicPath.dwCurrentPointIdx < pUnit.pDynamicPath.dwPathPoints
}
