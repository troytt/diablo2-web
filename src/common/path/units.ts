/**
 * Diablo II 1.13c unit helpers used by the dynamic-path code (Refs #808).
 *
 * Ports of the small `UNITS_*` / `MONSTERS_*` accessors that D2Common's path code calls, plus the
 * generated monster table lookup ({@link getMonsterPathRecord}). Every helper cites its 1.13c address
 * and the D2MOO source; behaviour follows the 1.13c disassembly (differences to D2MOO are noted).
 */

import {
  MONSTATS2_TXT_RECORD_COUNT,
  MONSTATS_TXT_RECORD_COUNT,
  MONSTER_PATH_DATA,
  MONSTER_PATH_DATA_STRIDE,
  MONSTER_PATH_IDS,
} from './monster-path-data.ts'
import {
  type PathRoom,
  type PathUnit,
  D2AssertError,
  OBJSUBCLASS_TOWNPORTAL,
  UNIT_ITEM,
  UNIT_MISSILE,
  UNIT_MONSTER,
  UNIT_OBJECT,
  UNIT_PLAYER,
  UNIT_TILE,
  UNITFLAG_ISREVIVE,
  d2Assert,
} from './types.ts'

/** `MONSTATSFLAGINDEX_*` (D2MOO `DataTbls/MonsterTbls.h`): bit indices in `D2MonStatsTxt::dwMonStatsFlags` (+0x0C). */
export const MONSTATSFLAGINDEX_OPENDOORS = 3
export const MONSTATSFLAGINDEX_NPC = 8
export const MONSTATSFLAGINDEX_INTERACT = 9
export const MONSTATSFLAGINDEX_INTOWN = 10
export const MONSTATSFLAGINDEX_FLYING = 14

/** `MONSTATS2FLAG_*` (D2MOO `DataTbls/MonsterTbls.h`): bits of `D2MonStats2Txt::dwFlags` (+0x04). */
export const MONSTATS2FLAG_REVIVE = 0x100
export const MONSTATS2FLAG_ISATT = 0x200
export const MONSTATS2FLAG_SMALL = 0x400

/** `MONSTER_WRAITH1` / `MONSTER_BIRD1` / `MONSTER_BIRD2` / `MONSTER_PARROT` hcIdx (0x6FD86030 `cmp ecx,0x26`, 0x6FD85BE0). */
export const MONSTER_WRAITH1 = 38
export const MONSTER_BIRD1 = 157
export const MONSTER_BIRD2 = 158
export const MONSTER_PARROT = 319

/** The MonStats / MonStats2 fields the path and NpcMotion code reads for one monster class (generated table row). */
export interface MonsterPathRecord {
  readonly hcIdx: number
  readonly id: string
  /** `D2MonStatsTxt::nBaseId` (+0x02, int16). */
  readonly baseId: number
  /** `D2MonStatsTxt::dwMonStatsFlags` restricted to opendoors/npc/interact/inTown/flying. */
  readonly monStatsFlags: number
  /** MonStats `Velocity` (walk speed, sub-tiles per 256 ticks before the `<< 8` of D2Client). */
  readonly velocity: number
  /** MonStats `Run`. */
  readonly run: number
  /** `D2MonStatsTxt::wMonStatsEx` (+0x18): compiled MonStats2 index. */
  readonly monStatsEx: number
  /** `D2MonStats2Txt::nSizeX` (+0x08, int8). */
  readonly sizeX: number
  /** `D2MonStats2Txt::nSizeY` (+0x09, int8). */
  readonly sizeY: number
  /** `D2MonStats2Txt::dwFlags` restricted to revive/isAtt/small. */
  readonly monStats2Flags: number
  /** `D2MonStatsTxt::nWalkAnimSpeed` (+0x36, int16, compiled from AnimData). */
  readonly walkAnimSpeed: number
  /** `D2MonStatsTxt::nRunAnimSpeed` (+0x38, int16, compiled from AnimData). */
  readonly runAnimSpeed: number
  /** `D2MonStatsTxt::nSplEndDeath` (+0x1A4, uint8). */
  readonly splEndDeath: number
  /** `D2MonStatsTxt::nSplClientEnd` (+0x1A7, uint8). */
  readonly splClientEnd: number
  /** `D2MonStats2Txt::dwModeFlags` (+0xF0, uint16 `mDT`..`mRN`). */
  readonly modeFlags: number
  /** `D2MonStats2Txt::nModeEnabledWhenMovingFlags` (+0x104, uint16 `A1mv`..`S4mv`). */
  readonly moveInAnimFlags: number
}

const recordCache = new Map<number, MonsterPathRecord>()

/**
 * Returns the generated MonStats/MonStats2 row of `classId`. The 1.13c helpers range-check the id
 * against `nMonStatsTxtRecordCount` and treat a miss as "no record"; a client monster with an
 * unknown class id is a data error, so the port throws instead of silently degrading.
 */
export function getMonsterPathRecord(classId: number): MonsterPathRecord {
  if (!Number.isInteger(classId) || classId < 0 || classId >= MONSTATS_TXT_RECORD_COUNT) {
    throw new D2AssertError(`getMonsterPathRecord: monster class id ${classId} outside MonStats.txt (0..${MONSTATS_TXT_RECORD_COUNT - 1})`)
  }
  const cached = recordCache.get(classId)
  if (cached) return cached
  const o = classId * MONSTER_PATH_DATA_STRIDE
  const d = MONSTER_PATH_DATA
  const rec: MonsterPathRecord = {
    hcIdx: classId,
    id: MONSTER_PATH_IDS[classId]!,
    baseId: d[o]!,
    monStatsFlags: d[o + 1]!,
    velocity: d[o + 2]!,
    run: d[o + 3]!,
    monStatsEx: d[o + 4]!,
    sizeX: d[o + 5]!,
    sizeY: d[o + 6]!,
    monStats2Flags: d[o + 7]!,
    walkAnimSpeed: d[o + 8]!,
    runAnimSpeed: d[o + 9]!,
    splEndDeath: d[o + 10]!,
    splClientEnd: d[o + 11]!,
    modeFlags: d[o + 12]!,
    moveInAnimFlags: d[o + 13]!,
  }
  d2Assert(rec.monStatsEx >= 0 && rec.monStatsEx < MONSTATS2_TXT_RECORD_COUNT, `MonStatsEx of ${rec.id}`)
  recordCache.set(classId, rec)
  return rec
}

/**
 * AnimData base speed (`dwAnimSpeed`) for a monster's `mode` — the value the engine's
 * `UNITS_UpdateAnimRateAndVelocity` reads from `pAnimData` for the current mode before stat
 * scaling. Modes 0..12 index the packed per-mode slots (DT,NU,WL,GH,A1,A2,BL,SC,S1..S4,DD);
 * KB(13) uses the walk speed and RN(15) the run speed exactly like
 * `UNITS_GetBaseAnimSpeed`/npc-motion; unknown modes fall back to the engine's default
 * AnimData record speed (256).
 */
export function getMonsterModeBaseAnimSpeed256(classId: number, mode: number): number {
  const o = classId * MONSTER_PATH_DATA_STRIDE
  const d = MONSTER_PATH_DATA
  if (mode === 13) return d[o + 8]!
  if (mode === 15) return d[o + 9]!
  if (mode >= 0 && mode <= 12) {
    const speed = d[o + 14 + mode]!
    return speed > 0 ? speed : 256
  }
  return 256
}

/**
 * Base id of a monster unit (D2Common 1.13c 0x6FD51860, eax=pUnit; D2MOO
 * `MONSTERS_GetBaseIdFromMonsterId` Monsters.cpp:1315). NULL / non-monster -> -1.
 */
export function MONSTERS_GetBaseIdFromMonsterUnit(pUnit: PathUnit | null): number {
  if (!pUnit || pUnit.dwUnitType !== UNIT_MONSTER) return -1
  return getMonsterPathRecord(pUnit.dwClassId).baseId
}

/**
 * `MONSTERS_CanBeInTown` (1.13c 0x6FD6A660, edx=pUnit; D2MOO Monsters.cpp:751).
 * Monster with MonStats `npc` or `inTown`, or a revived unit (`dwFlags & 0x80000000`).
 */
export function MONSTERS_CanBeInTown(pUnit: PathUnit | null): boolean {
  if (!pUnit || pUnit.dwUnitType !== UNIT_MONSTER) return false
  const f = getMonsterPathRecord(pUnit.dwClassId).monStatsFlags
  if (f & (1 << MONSTATSFLAGINDEX_NPC)) return true
  if (f & (1 << MONSTATSFLAGINDEX_INTOWN)) return true
  return (pUnit.dwFlags & UNITFLAG_ISREVIVE) !== 0
}

function requireObjectTxt(pUnit: PathUnit, where: string) {
  d2Assert(pUnit.objectTxt, `${where}: object unit ${pUnit.dwClassId} without ObjectTxt`)
  return pUnit.objectTxt
}

/**
 * `UNITS_GetUnitSizeX` (#10589, 1.13c 0x6FD80F80; D2MOO #10336 Units.cpp:197).
 * NULL -> 0; player 2; monster MonStats2 `SizeX` (0 if no record); object ObjectTxt +0xD0; item 1;
 * tile / other 0. Missiles need MissilesTxt (+0x18A), which this port does not model: throws.
 */
export function UNITS_GetUnitSizeX(pUnit: PathUnit | null): number {
  if (!pUnit) return 0
  switch (pUnit.dwUnitType) {
    case UNIT_PLAYER:
      return 2
    case UNIT_MONSTER:
      return getMonsterPathRecord(pUnit.dwClassId).sizeX
    case UNIT_OBJECT:
      return requireObjectTxt(pUnit, 'UNITS_GetUnitSizeX').sizeX
    case UNIT_MISSILE:
      throw new D2AssertError('UNITS_GetUnitSizeX: missile units (MissilesTxt nSize) are not supported by the path port')
    case UNIT_ITEM:
      return 1
    default:
      return 0
  }
}

/**
 * `UNITS_GetUnitSizeY` (1.13c 0x6FD80EE0; D2MOO #10337 Units.cpp:240). Same as X with MonStats2 `SizeY` /
 * ObjectTxt +0xD4, except that 1.13c asserts on a NULL unit (line 0x74B) where D2MOO returns 0.
 */
export function UNITS_GetUnitSizeY(pUnit: PathUnit | null): number {
  d2Assert(pUnit, 'UNITS_GetUnitSizeY: pUnit (Units.cpp 0x74B)')
  switch (pUnit.dwUnitType) {
    case UNIT_PLAYER:
      return 2
    case UNIT_MONSTER:
      return getMonsterPathRecord(pUnit.dwClassId).sizeY
    case UNIT_OBJECT:
      return requireObjectTxt(pUnit, 'UNITS_GetUnitSizeY').sizeY
    case UNIT_MISSILE:
      throw new D2AssertError('UNITS_GetUnitSizeY: missile units (MissilesTxt nSize) are not supported by the path port')
    case UNIT_ITEM:
      return 1
    default:
      return 0
  }
}

/** `UNITS_IsDoor` (#11020, 1.13c 0x6FD7EDA0; D2MOO Units.cpp:1911). Asserts pUnit. */
export function UNITS_IsDoor(pUnit: PathUnit | null): boolean {
  d2Assert(pUnit, 'UNITS_IsDoor: pUnit (Units.cpp 0xE10)')
  if (pUnit.dwUnitType === UNIT_OBJECT) return requireObjectTxt(pUnit, 'UNITS_IsDoor').isDoor
  return false
}

/** `UNITS_HasCollision` (1.13c 0x6FD7EDE0; D2MOO #10410 Units.cpp:1883): objects use `nHasCollision[dwAnimMode]`. */
export function UNITS_HasCollision(pUnit: PathUnit): boolean {
  if (pUnit.dwUnitType === UNIT_OBJECT) {
    const v = requireObjectTxt(pUnit, 'UNITS_HasCollision').hasCollision[pUnit.dwAnimMode]
    d2Assert(v !== undefined, `UNITS_HasCollision: no nHasCollision entry for mode ${pUnit.dwAnimMode}`)
    return v
  }
  return true
}

/**
 * `UNITS_GetCollisionMask` (1.13c 0x6FD7FF30, ecx=pUnit; D2MOO #10338 Units.cpp:505).
 * Object door: BlocksVis 0x806, BlockMissile 0x804, else 0x400; other objects: town portal subclass
 * 0x8000, BlockMissile 0x404, else 0x400; item 0x200; tile 1; others the path footprint mask (0xFFFF
 * without a dynamic path).
 */
export function UNITS_GetCollisionMask(pUnit: PathUnit | null): number {
  d2Assert(pUnit, 'UNITS_GetCollisionMask: pUnit (Units.cpp 0x80E)')
  switch (pUnit.dwUnitType) {
    case UNIT_OBJECT: {
      const t = requireObjectTxt(pUnit, 'UNITS_GetCollisionMask')
      if (t.isDoor) {
        if (t.blocksVis) return 0x806
        return t.blockMissile ? 0x804 : 0x400
      }
      if (t.subClass & OBJSUBCLASS_TOWNPORTAL) return 0x8000
      return t.blockMissile ? 0x404 : 0x400
    }
    case UNIT_ITEM:
      return 0x200
    case UNIT_TILE:
      return 0x1
    default:
      return pUnit.pDynamicPath ? pUnit.pDynamicPath.nFootprintCollisionMask : 0xffff
  }
}

/** True for the unit types whose position lives in `pStaticPath` (objects, items, tiles: 0x6FD7FE10 `cmp ecx,2` / `cmp ecx,5`). */
export function UNITS_HasStaticPath(nUnitType: number): boolean {
  return nUnitType === UNIT_OBJECT || nUnitType === UNIT_ITEM || nUnitType === UNIT_TILE
}

/**
 * `UNITS_GetRoom` (#10331, 1.13c 0x6FD7FE10; D2MOO Units.cpp:621). Objects / items / tiles read
 * `pStaticPath->pRoom`; others `pDynamicPath->pRoom` (NULL without a dynamic path). Asserts pUnit.
 */
export function UNITS_GetRoom(pUnit: PathUnit | null): PathRoom | null {
  d2Assert(pUnit, 'UNITS_GetRoom: pUnit (Units.cpp 0x896)')
  if (UNITS_HasStaticPath(pUnit.dwUnitType)) {
    d2Assert(pUnit.pStaticPath, `UNITS_GetRoom: unit type ${pUnit.dwUnitType} without static path`)
    return pUnit.pStaticPath.room
  }
  return pUnit.pDynamicPath ? pUnit.pDynamicPath.pRoom : null
}

/**
 * `UNITS_GetXPosition` as inlined by the 1.13c footprint code (e.g. 0x6FD85800): objects / items / tiles
 * use `pStaticPath->dwPosX` (+0x0C); players / monsters / missiles `pDynamicPath->wPosX` (0 if none).
 */
export function UNITS_GetXPosition(pUnit: PathUnit): number {
  if (UNITS_HasStaticPath(pUnit.dwUnitType)) {
    d2Assert(pUnit.pStaticPath, `UNITS_GetXPosition: unit type ${pUnit.dwUnitType} without static path`)
    return pUnit.pStaticPath.x
  }
  return pUnit.pDynamicPath ? pUnit.pDynamicPath.wPosX : 0
}

/** `UNITS_GetYPosition` (inlined like {@link UNITS_GetXPosition}; `pStaticPath->dwPosY` +0x10 / `wPosY`). */
export function UNITS_GetYPosition(pUnit: PathUnit): number {
  if (UNITS_HasStaticPath(pUnit.dwUnitType)) {
    d2Assert(pUnit.pStaticPath, `UNITS_GetYPosition: unit type ${pUnit.dwUnitType} without static path`)
    return pUnit.pStaticPath.y
  }
  return pUnit.pDynamicPath ? pUnit.pDynamicPath.wPosY : 0
}
