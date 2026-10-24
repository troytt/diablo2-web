/**
 * Diablo II 1.13c D2Common dynamic-path data structures (Refs #808).
 *
 * Faithful TypeScript model of `D2DynamicPathStrc` / `D2PathInfoStrc` /
 * `D2PathPointStrc` / `D2FP32_16` as laid out in D2Common.dll 1.13c
 * (ImageBase 0x6FD50000). Field names follow D2MOO
 * (`source/D2Common/include/Path/Path.h:94-186`); the byte offsets quoted in the
 * comments were checked against the 1.13c disassembly (setters/getters at
 * 0x6FD84600-0x6FD86230).
 *
 * Integer semantics: every field documents its C type. Writers must keep the
 * value in range (`>>> 0` for uint32, `| 0` for int32, `& 0xFFFF` for uint16,
 * `& 0xFF` for uint8) exactly like the C code would truncate it.
 */

/** Fog assertion failure (the original calls Fog#10024 + exit(-1)). Fail fast. */
export class D2AssertError extends Error {
  constructor(where: string) {
    super(`D2Common assertion failed: ${where}`)
    this.name = 'D2AssertError'
  }
}

/** Throws a {@link D2AssertError} when `cond` is false (Fog assert). */
export function d2Assert(cond: unknown, where: string): asserts cond {
  if (!cond) throw new D2AssertError(where)
}

// ---------------------------------------------------------------------------
// C integer helpers
// ---------------------------------------------------------------------------

/** C `int32_t` truncation. */
export const i32 = (v: number): number => v | 0
/** C `uint32_t` truncation. */
export const u32 = (v: number): number => v >>> 0
/** C `uint16_t` truncation. */
export const u16 = (v: number): number => v & 0xffff
/** C `int16_t` truncation. */
export const i16 = (v: number): number => (v << 16) >> 16
/** C `uint8_t` truncation. */
export const u8 = (v: number): number => v & 0xff
/** C `int8_t` truncation. */
export const i8 = (v: number): number => (v << 24) >> 24
/** C signed 32-bit division (truncates toward zero). */
export function idiv(a: number, b: number): number {
  if (b === 0) throw new D2AssertError('integer division by zero')
  return Math.trunc((a | 0) / (b | 0)) | 0
}
/** `(sub << 16) + 0x8000` as an unsigned 16.16 value (sub-tile centre). */
export function toFP16Center(sub: number): number {
  return (u32(sub) * 65536 + 0x8000) >>> 0
}

// ---------------------------------------------------------------------------
// Constants (D2MOO enums; values checked against the 1.13c code that uses them)
// ---------------------------------------------------------------------------

/** `D2C_UnitTypes` (D2MOO `include/Units/Units.h`). */
export const UNIT_PLAYER = 0
export const UNIT_MONSTER = 1
export const UNIT_OBJECT = 2
export const UNIT_MISSILE = 3
export const UNIT_ITEM = 4
export const UNIT_TILE = 5
/** `UNIT_TYPES_COUNT`: what 1.13c substitutes for a NULL unit (e.g. 0x6FD85800 `mov eax,6`). */
export const UNIT_TYPES_COUNT = 6

/** Player anim modes used by the footprint code (0x6FD85800: `cmp eax,0x11` / `test eax,eax`). */
export const PLRMODE_DEATH = 0
export const PLRMODE_DEAD = 17
/** `D2C_MonModes` (D2MOO `Units/Monster.h:15-34`; values checked against 0x6FD83110 / 0x6FAFDC70). */
export const MONMODE_DEATH = 0
export const MONMODE_NEUTRAL = 1
export const MONMODE_WALK = 2
export const MONMODE_GETHIT = 3
export const MONMODE_ATTACK1 = 4
export const MONMODE_ATTACK2 = 5
export const MONMODE_BLOCK = 6
export const MONMODE_CAST = 7
export const MONMODE_SKILL1 = 8
export const MONMODE_SKILL2 = 9
export const MONMODE_SKILL3 = 10
export const MONMODE_SKILL4 = 11
export const MONMODE_DEAD = 12
export const MONMODE_KNOCKBACK = 13
export const MONMODE_SEQUENCE = 14
export const MONMODE_RUN = 15

/** `D2UnitFlags` subset (D2MOO `Units.h:40-75`). */
export const UNITFLAG_DOUPDATE = 0x00000001
export const UNITFLAG_ISDEAD = 0x00010000
export const UNITFLAG_ISASYNC = 0x00200000
export const UNITFLAG_ISREVIVE = 0x80000000
/** `UNITFLAGEX_UNK_PATH_RELATED` (D2MOO `Units.h:81`), toggled by #10054. */
export const UNITFLAGEX_UNK_PATH_RELATED = 0x00002000

/** `D2PathConstants` (D2MOO `Path.h:10-15`). */
export const PATH_NB_DIRECTIONS = 64
export const PATH_DIR_NULL = 255
export const PATH_MAX_STEPNUM = 20
/** `D2DynamicPathStrc::MAXPATHLEN` / `PATH_MAX_STEP_LEN`. */
export const MAXPATHLEN = 78
export const PATH_MAX_STEP_LEN = 10

/** `D2PathTypes` (D2MOO `Path.h:17-41`). */
export const PATHTYPE_IDASTAR = 0
export const PATHTYPE_ASTAR = 1
export const PATHTYPE_TOWARD = 2
export const PATHTYPE_UNKNOWN_3 = 3
export const PATHTYPE_MISSILE = 4
export const PATHTYPE_MON_CIRCLE_CW = 5
export const PATHTYPE_MON_CIRCLE_CCW = 6
export const PATHTYPE_STRAIGHT = 7
export const PATHTYPE_KNOCKBACK_SERVER = 8
export const PATHTYPE_LEAP = 9
export const PATHTYPE_CHARGEDBOLT = 10
export const PATHTYPE_KNOCKBACK_CLIENT = 11
export const PATHTYPE_BACKUP_TURN = 12
export const PATHTYPE_TOWARD_FINISH = 13
export const PATHTYPE_BLESSEDHAMMER = 14
export const PATHTYPE_WALL_FOLLOW = 15
export const PATHTYPE_MISSILE_STREAM = 16
export const PATHTYPE_UNKNOWN_17 = 17
export const PATHTYPE_COUNT = 18

/** `D2PathFlags` (D2MOO `Path.h:43-60`). */
export const PATH_UNKNOWN_FLAG_0x00001 = 0x00001
export const PATH_CURRENT_ROOM_INVALID = 0x00002
export const PATH_UNUSED_FLAG_0x00004 = 0x00004
export const PATH_UNKNOWN_FLAG_0x00008 = 0x00008
export const PATH_UNKNOWN_FLAG_0x00010 = 0x00010
export const PATH_UNKNOWN_FLAG_0x00020 = 0x00020
export const PATH_UNKNOWN_FLAG_0x00040 = 0x00040
export const PATH_UNKNOWN_FLAG_0x00200 = 0x00200
export const PATH_UNKNOWN_FLAG_0x00800 = 0x00800
export const PATH_UNKNOWN_FLAG_0x01000 = 0x01000
export const PATH_UNKNOWN_FLAG_0x02000 = 0x02000
export const PATH_UNKNOWN_FLAG_0x04000 = 0x04000
export const PATH_WITH_PREVIOUS_VELOCITY = 0x08000
export const PATH_UNKNOWN_FLAG_0x10000 = 0x10000
export const PATH_SAVE_STEPS_MASK = 0x20000
export const PATH_MISSILE_MASK = 0x40000

/** `D2C_CollisionPattern` (D2MOO `D2Collision.h:28-36`). */
export const COLLISION_PATTERN_NONE = 0
export const COLLISION_PATTERN_SMALL_UNIT_PRESENCE = 1
export const COLLISION_PATTERN_BIG_UNIT_PRESENCE = 2
export const COLLISION_PATTERN_SMALL_PET_PRESENCE = 3
export const COLLISION_PATTERN_BIG_PET_PRESENCE = 4
export const COLLISION_PATTERN_SMALL_NO_PRESENCE = 5

/** `D2C_CollisionUnitSize` (D2MOO `D2Collision.h`). */
export const COLLISION_UNIT_SIZE_NONE = 0
export const COLLISION_UNIT_SIZE_POINT = 1
export const COLLISION_UNIT_SIZE_SMALL = 2
export const COLLISION_UNIT_SIZE_BIG = 3
export const COLLISION_UNIT_SIZE_COUNT = 4

/** `OBJSUBCLASS_TOWNPORTAL` (D2MOO `DataTbls/ObjectsTbls.h:11`). */
export const OBJSUBCLASS_TOWNPORTAL = 0x04

// ---------------------------------------------------------------------------
// Abstract world (implemented by the client adapter)
// ---------------------------------------------------------------------------

/** `pCollisionGrid->pCollisionMask` of one active room, addressed in ABSOLUTE sub-tile coords. */
export interface PathCollisionGrid {
  /** Returns the uint16 mask at (x, y); only called for cells inside the owning room. */
  get(x: number, y: number): number
  /** Stores the uint16 mask at (x, y); only called for cells inside the owning room. */
  set(x: number, y: number, value: number): void
}

/** `D2ActiveRoomStrc` subset used by the path / collision code. */
export interface PathRoom {
  /** `tCoords.nSubtileX/Y/Width/Height` (also the collision grid's `pRoomCoords`). */
  readonly subX: number
  readonly subY: number
  readonly subW: number
  readonly subH: number
  /** `DUNGEON_IsRoomInTown`. */
  readonly isTown: boolean
  /** `DUNGEON_GetAdjacentRoomsListFromRoom` (`ppRoomList`, see {@link buildAdjacentRoomLists}). */
  readonly adjacentRooms: readonly PathRoom[]
  /** `DUNGEON_GetCollisionGridFromRoom`; `null` = room without grid. */
  readonly grid: PathCollisionGrid | null
}

/** `D2PathPointStrc` (uint16 sub-tile coordinates). */
export interface PathPoint {
  X: number
  Y: number
}

/** `D2CoordStrc` (int32 pair, used for direction / velocity vectors). */
export interface PathCoord {
  nX: number
  nY: number
}

/** `D2StaticPathStrc` subset (objects, items, tiles): room + sub-tile position (+0xC/+0x10). */
export interface PathStaticPosition {
  room: PathRoom | null
  x: number
  y: number
}

/** `D2ObjectsTxt` subset used by UNITS_* helpers for object units. */
export interface PathObjectTxt {
  /** ObjectTxt +0xD0 (UNITS_GetUnitSizeX 0x6FD80F80). */
  readonly sizeX: number
  /** ObjectTxt +0xD4 (UNITS_GetUnitSizeY 0x6FD80EE0). */
  readonly sizeY: number
  /** ObjectTxt +0x13A `nIsDoor` (UNITS_IsDoor 0x6FD7EDA0). */
  readonly isDoor: boolean
  /** ObjectTxt +0x13C `nOrientation` (UNITS_CheckIfObjectOrientationIs1). */
  readonly orientation: number
  /** ObjectTxt `nBlocksVis` (UNITS_GetCollisionMask). */
  readonly blocksVis: boolean
  /** ObjectTxt `nBlockMissile` (UNITS_GetCollisionMask). */
  readonly blockMissile: boolean
  /** ObjectTxt `nSubClass` (UNITS_GetCollisionMask: `& OBJSUBCLASS_TOWNPORTAL`). */
  readonly subClass: number
  /** ObjectTxt +0x120 `nHasCollision[mode]` (0x6FD85800 `movzx eax,b[edx+eax+0x120]`). */
  readonly hasCollision: readonly boolean[]
}

/**
 * `D2UnitStrc` subset needed by the path code. Offsets are the 1.13c ones.
 *
 * - `dwUnitType` +0x00, `dwClassId` +0x04, `dwUnitId` +0x0C, `dwAnimMode` +0x10,
 *   `pDynamicPath`/`pStaticPath` +0x2C (union), `dwFlags` +0xC4, `dwFlagEx` +0xC8.
 * - `objectTxt` stands for `pObjectData->pObjectTxt` (+0x14 -> +0x00); required for objects.
 */
export interface PathUnit {
  readonly dwUnitType: number
  readonly dwClassId: number
  readonly dwUnitId: number
  dwAnimMode: number
  dwFlags: number
  dwFlagEx: number
  /** Players / monsters / missiles (and NULL when not allocated). */
  pDynamicPath: DynamicPath | null
  /** Objects / items / tiles. */
  pStaticPath: PathStaticPosition | null
  /** Objects only (`pObjectData->pObjectTxt`). */
  readonly objectTxt: PathObjectTxt | null
}

// ---------------------------------------------------------------------------
// D2DynamicPathStrc / D2PathInfoStrc
// ---------------------------------------------------------------------------

function newPoints(n: number): PathPoint[] {
  const out: PathPoint[] = []
  for (let i = 0; i < n; i++) out.push({ X: 0, Y: 0 })
  return out
}

/** `D2DynamicPathStrc` (size 0x200 in 1.13c). */
export class DynamicPath {
  /** +0x00 `tGameCoords.dwPrecisionX` (uint32 16.16). */
  dwPrecisionX = 0
  /** +0x04 `tGameCoords.dwPrecisionY` (uint32 16.16). */
  dwPrecisionY = 0
  /** +0x08 int32. */
  dwClientCoordX = 0
  /** +0x0C int32. */
  dwClientCoordY = 0
  /** +0x10. */
  readonly tTargetCoord: PathPoint = { X: 0, Y: 0 }
  /** +0x14. */
  readonly tPrevTargetCoord: PathPoint = { X: 0, Y: 0 }
  /** +0x18. */
  readonly tFinalTargetCoord: PathPoint = { X: 0, Y: 0 }
  /** +0x1C. */
  pRoom: PathRoom | null = null
  /** +0x20. */
  pPreviousRoom: PathRoom | null = null
  /** +0x24 int32. */
  dwCurrentPointIdx = 0
  /** +0x28 int32. */
  dwPathPoints = 0
  /** +0x30. */
  pUnit: PathUnit | null = null
  /** +0x34 uint32 (`D2PathFlags`). */
  dwFlags = 0
  /** +0x38 uint32. */
  unk0x38 = 0
  /** +0x3C uint32. */
  dwPathType = 0
  /** +0x40 uint32. */
  dwPrevPathType = 0
  /** +0x44 uint32. */
  dwUnitSize = 0
  /** +0x48 uint32. */
  dwCollisionPattern = 0
  /** +0x4C uint32. */
  nFootprintCollisionMask = 0
  /** +0x50 uint32. */
  nMoveTestCollisionMask = 0
  /** +0x54 uint16. */
  nCollidedWithMask = 0
  /** +0x58. */
  pTargetUnit: PathUnit | null = null
  /** +0x5C uint32. */
  dwTargetType = 0
  /** +0x60 uint32. */
  dwTargetId = 0
  /** +0x64 uint8. */
  nDirection = 0
  /** +0x65 uint8. */
  nNewDirection = 0
  /** +0x66 uint8. */
  nDiffDirection = 0
  /** +0x67 uint8. */
  unk0x67 = 0
  /** +0x68 uint8 (only ever set by #10219, which D2Client never calls). */
  dwSpeed = 0
  /** +0x6A int32 pair. */
  readonly tDirectionVector: PathCoord = { nX: 0, nY: 0 }
  /** +0x72 int32 pair. */
  readonly tVelocityVector: PathCoord = { nX: 0, nY: 0 }
  /** +0x7C int32. */
  dwVelocity = 0
  /** +0x80 uint32. */
  nPreviousVelocity = 0
  /** +0x84 int32. */
  dwMaxVelocity = 0
  /** +0x88 int32. */
  dwAcceleration = 0
  /** +0x8C int32. */
  dwAccelerationsCounter = 0
  /** +0x90 uint8. */
  nDist = 0
  /** +0x91 uint8. */
  nDistMax = 0
  /** +0x92 uint8. */
  nIDAStarInitFScore = 0
  /** +0x93 uint8. */
  nStepNum = 0
  /** +0x94 uint8. */
  nDistance = 0
  /** +0x98 int32 (`gaOffsetForPathType`). */
  nDirOffset = 0
  /** +0x9C. */
  readonly PathPoints: PathPoint[] = newPoints(MAXPATHLEN)
  /** +0x1D4 int32. */
  nSavedStepsCount = 0
  /** +0x1D8. */
  readonly SavedSteps: PathPoint[] = newPoints(PATH_MAX_STEP_LEN)

  /** `tGameCoords.wPosX` (+0x02, uint16). */
  get wPosX(): number {
    return this.dwPrecisionX >>> 16
  }
  /** `tGameCoords.wPosY` (+0x06, uint16). */
  get wPosY(): number {
    return this.dwPrecisionY >>> 16
  }
  /** `tGameCoords.wOffsetX` (+0x00, uint16). */
  get wOffsetX(): number {
    return this.dwPrecisionX & 0xffff
  }
  /** `tGameCoords.wOffsetY` (+0x04, uint16). */
  get wOffsetY(): number {
    return this.dwPrecisionY & 0xffff
  }
}

/** `D2PathInfoStrc` (size 0x34): the finder input built by D2Common_10142 on its stack. */
export interface PathInfo {
  /** +0x00. */
  readonly tStartCoord: PathPoint
  /** +0x04 (finders may rewrite it). */
  readonly tTargetCoord: PathPoint
  /** +0x08. */
  pStartRoom: PathRoom | null
  /** +0x0C. */
  pTargetRoom: PathRoom | null
  /**
   * +0x10 int32. NOT written by 1.13c D2Common_10142 (0x6FD86230 never stores
   * `[pathinfo+0x10]`, the struct is not zeroed): the original reads stack garbage
   * here. Only IDA* uses it; the port initialises it to 0 [I].
   */
  field_10: number
  /** +0x14 uint8 (PATH_UpdateTargetUnit result; IDA* doubles it). */
  field_14: number
  /** +0x18 int32 (`nDistMax`). */
  nDistMax: number
  /** +0x1C uint8 (`nIDAStarInitFScore`). */
  nMinimumFScoreToEvaluate: number
  /** +0x20. */
  nPathType: number
  /** +0x24. */
  nUnitSize: number
  /** +0x28. */
  nCollisionPattern: number
  /** +0x2C. */
  nCollisionMask: number
  /** +0x30. */
  readonly pDynamicPath: DynamicPath
}

/** Creates a zeroed {@link PathInfo} bound to `pDynamicPath`. */
export function createPathInfo(pDynamicPath: DynamicPath): PathInfo {
  return {
    tStartCoord: { X: 0, Y: 0 },
    tTargetCoord: { X: 0, Y: 0 },
    pStartRoom: null,
    pTargetRoom: null,
    field_10: 0,
    field_14: 0,
    nDistMax: 0,
    nMinimumFScoreToEvaluate: 0,
    nPathType: 0,
    nUnitSize: 0,
    nCollisionPattern: 0,
    nCollisionMask: 0,
    pDynamicPath,
  }
}

/** `D2PathPointStrc::operator==`. */
export function pointsEqual(a: PathPoint, b: PathPoint): boolean {
  return a.X === b.X && a.Y === b.Y
}

/** Copies `src` into `dst` (struct assignment). */
export function copyPoint(dst: PathPoint, src: PathPoint): void {
  dst.X = src.X & 0xffff
  dst.Y = src.Y & 0xffff
}
