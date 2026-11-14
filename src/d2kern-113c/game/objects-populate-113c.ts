/**
 * Diablo II v1.13c `D2Game.dll` random room objects (image base `0x6FC20000`).
 *
 * `OBJECTS_PopulateRoom113c` (`0x6FC4F0D0`) is the third step of `GAME_UpdateActRooms113c`
 * (`0x6FC4CBE0`) for a newly activated room. For each of the 8 `LevelsTxt` object groups (`+0xE5` group
 * id, `+0xED` probability) it rolls `pRoom->tSeed`, picks one `ObjGroup.txt` entry by weighted roll and
 * calls the matching object spawner in the D2Game table at `0x6FD2E190`, indexed by `ObjectsTxt+0x1B2`
 * (index 3 is `OBJECTS_SpawnDensityObjectsInRoom`, `0x6FC52CE0`).
 *
 * Every function below is a 1:1 port of the cited `objdump -d -M intel` disassembly of `D2Game.dll`.
 * Callees without a kernel port yet are reached through `ObjectsPopulateCallees113c` (all members required).
 */
import { COLLISION_CheckMaskWithSizeXY113c } from '../common/collision.ts'
import { DRLG_GetActNoFromLevelId113c } from '../common/drlg/drlg.ts'
import {
  DUNGEON_CheckPresetRoomFlag80_113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetLevelIdIfNotHidden113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_HasRoomExWaypointFlags113c,
} from '../common/dungeon.ts'
import { DUNGEON_CheckRoomIsTownMemPort113c } from '../common/k0-d2common-memports.ts'
import { DATATBLS_GetObjectsTxtRecord113c, UNITS_AllocStaticPath113c, UNIT_Alloc113c } from '../common/unit.ts'
import type { Memory113c } from '../mem/sparse-memory.ts'
import { seedRoll, type D2SeedStrc } from '../prng.ts'
import { DATATBLS_GetShrinesTxtRecord113c } from '../tables/datatbls-113c.ts'
import { DATATBLS_GetLevelsTxtRecord113c } from '../tables/lvl-tbls-113c.ts'
import {
  D2GAME_IAT_SGPT_DATATABLES_VA_113C,
  OBJECTS_InitChestLockAndSeed113c,
  OBJECTS_InitShrineType113c,
  OBJECTS_SpawnDensityObjectsInRoom113c,
  SUNIT_InitUnitSeed113c,
  type RegpopSpawnHooks113c,
} from './regpop-spawn-113c.ts'
import { EVENT_RemoveUnitEvents113c } from './timer-wheel.ts'

/** `pGame->pObjectControl` (`0x6FC4EEC1 mov eax, [ebp+0x10F0]`). */
const GAME_OFF_POBJECTCONTROL = 0x10f0
/** `pObjectControl->pLevelObjInfo[nLevelId]` (`0x6FC4EEC7 mov esi, [eax+edi*4+0x48]`). */
const OBJCTRL_OFF_LEVEL_INFO = 0x48
/** `sgptDataTables->nLevelsTxtRecordCount` (`0x6FC4EEDF cmp edi, [edx+0xC5C]`). */
const DATATABLES_OFF_LEVELS_COUNT = 0xc5c
/** `LevelsTxt->nObjGrp[8]` / `nObjPrb[8]` (`0x6FC4F156` / `0x6FC4F1D3`). */
const LEVELSTXT_OFF_OBJGRP = 0xe5
const LEVELSTXT_OFF_OBJPRB = 0xed
/** `LevelsTxt->dwObjectQuestHook` style dword tested at `0x6FC4EF15 mov eax, [edx+0x210]`. */
const LEVELSTXT_OFF_210 = 0x210

/** `byte` at `0x6FD2E1B8` (`.data`, only ever read, value `2` in the v1.13c image). */
const OBJECTS_MAX_ACT_FLAG_6FD2E1B8 = 2
/**
 * Object spawner table at `0x6FD2E190` (`int32[10]`, copied verbatim from `D2Game.dll` v1.13c);
 * `[3] = 0x6FC52CE0` (`OBJECTS_SpawnDensityObjectsInRoom`).
 */
export const OBJECTS_SPAWN_FN_TABLE_6FD2E190: readonly number[] = [
  0, 0x6fc51000, 0x6fc527d0, 0x6fc52ce0, 0x6fc50800, 0x6fc50150, 0x6fc53260, 0x6fc52df0, 0x6fc52a10, 0x6fc52bc0,
]

/** Callees of the room-object population without a kernel port yet (all required). */
export interface ObjectsPopulateCallees113c {
  /** `D2Common.#10662` (`0x6FD8C7E0`, `__stdcall(pAct, nLevelId)`): number of rooms of the level in the act. */
  readonly getLevelRoomCountInAct: (m: Memory113c, pAct: number, nLevelId: number) => number
  /** `D2Game:0x6FC4EAD0` (`ecx = pLevelObjInfo`, `__stdcall(pGame, pRoom, nHook)`). */
  readonly checkLevelObjectHook: (m: Memory113c, pLevelObjInfo: number, pGame: number, pRoom: number, nHook: number) => number
  /**
   * Object spawners `0x6FD2E190[nFn]` for `nFn != 3` (`ecx = pGame`, `edx = pRoom`,
   * `__stdcall(nDensity, nObjectId, 100)`); `nFn == 3` is the ported `0x6FC52CE0`.
   */
  readonly spawnObjectsByFn: (
    m: Memory113c,
    nFnVa: number,
    pGame: number,
    pRoom: number,
    nDensity: number,
    nObjectId: number,
    nProb: number,
  ) => number
  /** Callees of `OBJECTS_SpawnRandomObjectInRoom113c` (`0x6FC51E20`), reached from `0x6FC52CE0`. */
  readonly spawn: ObjectSpawnCallees113c
}

function seedStep113c(m: Memory113c, pSeed: number): number {
  const lo = m.u32(pSeed >>> 0) >>> 0
  const hi = m.u32((pSeed + 4) >>> 0) >>> 0
  const prod = BigInt(lo) * 0x6ac690c5n + BigInt(hi)
  const newLo = Number(prod & 0xffffffffn) >>> 0
  m.setU32((pSeed + 4) >>> 0, Number((prod >> 32n) & 0xffffffffn) >>> 0)
  m.setU32(pSeed >>> 0, newLo)
  return newLo
}

/**
 * Gate for random room objects (`ebx = pRoom`, `__stdcall(pGame, pLevelsTxt)`, `ret 8`): returns `0` for a
 * room with waypoint flags (`D2Common.#10233`), a hidden level (`#11025 == 0`), a preset room with flag
 * `0x80` (`#10283`), a level id `>= nLevelsTxtRecordCount`, or a town room (`#10057`). Otherwise lazily
 * caches the level's room count (`pLevelObjInfo->nRooms`, `+0x08`, `0x7FFFFFFF` = unknown) via
 * `D2Common.#10662`, increments `pLevelObjInfo->nVisitedRooms` (`+0x04`) and, when `LevelsTxt+0x210 != 0`,
 * returns `0` if `0x6FC4EAD0(...) == 1`; else `1`.
 *
 * @va D2Game:0x6FC4EEA0 (161B)
 */
export function OBJECTS_CanPopulateRoom113c(
  m: Memory113c,
  pRoom: number,
  pGame: number,
  pLevelsTxt: number,
  callees: ObjectsPopulateCallees113c,
): number {
  if (DUNGEON_HasRoomExWaypointFlags113c(m, pRoom) !== 0) return 0
  const nLevelId = DUNGEON_GetLevelIdIfNotHidden113c(m, pRoom) | 0
  const pObjCtrl = m.u32((pGame + GAME_OFF_POBJECTCONTROL) >>> 0) >>> 0
  const pInfo = m.u32((pObjCtrl + Math.imul(nLevelId, 4) + OBJCTRL_OFF_LEVEL_INFO) >>> 0) >>> 0
  if (nLevelId === 0) return 0
  if (DUNGEON_CheckPresetRoomFlag80_113c(m, pRoom) !== 0) return 0
  const pDataTables = m.u32(m.u32(D2GAME_IAT_SGPT_DATATABLES_VA_113C) >>> 0) >>> 0
  if (nLevelId >= (m.u32((pDataTables + DATATABLES_OFF_LEVELS_COUNT) >>> 0) | 0)) return 0
  if (DUNGEON_CheckRoomIsTownMemPort113c(m, pRoom) !== 0) return 0
  if ((m.u32((pInfo + 8) >>> 0) | 0) === 0x7fffffff) {
    const nAct = m.u8(pInfo)
    const pAct = m.u32((pGame + 0xbc + nAct * 4) >>> 0) >>> 0
    m.setU32((pInfo + 8) >>> 0, callees.getLevelRoomCountInAct(m, pAct, nLevelId) >>> 0)
  }
  m.setU32((pInfo + 4) >>> 0, ((m.u32((pInfo + 4) >>> 0) | 0) + 1) >>> 0)
  const nHook = m.u32((pLevelsTxt + LEVELSTXT_OFF_210) >>> 0) >>> 0
  if (nHook !== 0) {
    if (callees.checkLevelObjectHook(m, pInfo, pGame, pRoom, nHook) === 1) return 0
  }
  return 1
}

/**
 * Populates the random objects of a newly activated room (`__stdcall(pGame, pRoom)`, `ret 8`). `LevelsTxt`
 * of the room's level is asserted non-NULL (line `0xBEC`). After `0x6FC4EEA0` passes, for each object group
 * slot `i` in `0..7`: `nGroup = LevelsTxt+0xE5+i`, `roll = step(pRoom->tSeed) % 100` (always stepped); if
 * the level has visited more than 3/4 of its rooms (`(nVisited << 7) / nRooms > 0x60`, `nRooms > 0`,
 * `+0x10 == 0`) and `ObjectsTxt[nGroup]+0x167 != 0`, `roll = 100`. A non-zero group with
 * `roll <= LevelsTxt+0xED+i` looks up `ObjGroup.txt` (`D2Common.#10465`; `NULL` ends the whole walk),
 * rolls `pick = step(pRoom->tSeed) % 100` and walks the 8 group entries summing `ObjGroup+0x28+j` until
 * `pick < sum` and `ObjectsTxt[id]+0x172 <= 2`; the chosen entry's spawner `0x6FD2E190[ObjectsTxt+0x1B2]`
 * (`< 10`, else assert `0xC43`) is called with density `ObjGroup+0x20+j` (`< 0x80`, else assert `0xC47`)
 * and probability `100`.
 *
 * @va D2Game:0x6FC4F0D0 (545B)
 */
export function OBJECTS_PopulateRoom113c(
  m: Memory113c,
  pGame: number,
  pRoom: number,
  callees: ObjectsPopulateCallees113c,
): void {
  const pLevelsTxt = DATATBLS_GetLevelsTxtRecord113c(m, DUNGEON_GetLevelIdFromRoom113c(m, pRoom)) >>> 0
  if (pLevelsTxt === 0) {
    throw new Error('OBJECTS_PopulateRoom113c: pLevelsTxt == NULL (line 3052)')
  }
  if (OBJECTS_CanPopulateRoom113c(m, pRoom, pGame, pLevelsTxt, callees) === 0) return
  const pSeed = pRoom !== 0 ? (pRoom + 0x6c) >>> 0 : 0
  for (let i = 0; i < 8; i++) {
    const nGroup = m.u8((pLevelsTxt + i + LEVELSTXT_OFF_OBJGRP) >>> 0)
    let roll = (seedStep113c(m, pSeed) % 100) | 0
    const nLevelId = DUNGEON_GetLevelIdIfNotHidden113c(m, pRoom) | 0
    const pObjCtrl = m.u32((pGame + GAME_OFF_POBJECTCONTROL) >>> 0) >>> 0
    const pInfo = m.u32((pObjCtrl + Math.imul(nLevelId, 4) + OBJCTRL_OFF_LEVEL_INFO) >>> 0) >>> 0
    const nRooms = m.u32((pInfo + 8) >>> 0) | 0
    if (nRooms > 0) {
      const pct = Math.trunc(((m.u32((pInfo + 4) >>> 0) << 7) | 0) / nRooms) | 0
      if (pct > 0x60 && m.u32((pInfo + 0x10) >>> 0) === 0) {
        if (m.u8((DATATBLS_GetObjectsTxtRecord113c(m, nGroup) + 0x167) >>> 0) !== 0) roll = 100
      }
    }
    if (nGroup === 0) continue
    if (roll > m.u8((pLevelsTxt + i + LEVELSTXT_OFF_OBJPRB) >>> 0)) continue
    const pGroup = DATATBLS_GetShrinesTxtRecord113c(m, nGroup) >>> 0
    if (pGroup === 0) return
    const pick = (seedStep113c(m, pSeed) % 100) | 0
    let sum = 0
    for (let j = 0; j < 8; j++) {
      const nObjectId = m.u32((pGroup + j * 4) >>> 0) | 0
      if (nObjectId === 0) break
      sum = (sum + m.u8((pGroup + j + 0x28) >>> 0)) | 0
      const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, nObjectId) >>> 0
      if (pick >= sum) continue
      if (m.u8((pObjTxt + 0x172) >>> 0) > OBJECTS_MAX_ACT_FLAG_6FD2E1B8) continue
      const nFn = m.u8((pObjTxt + 0x1b2) >>> 0)
      if (nFn >= 10) throw new Error('OBJECTS_PopulateRoom113c: nFn >= 10 (line 3139)')
      const fnVa = OBJECTS_SPAWN_FN_TABLE_6FD2E190[nFn]!
      if (fnVa === 0) break
      // 0x6FC4F271 IsBadCodePtr(fn) != 0 -> assert 0xC46: never taken for the constant table entries.
      const nDensity = m.u8((pGroup + j + 0x20) >>> 0)
      if (nDensity >= 0x80) throw new Error('OBJECTS_PopulateRoom113c: nDensity >= 0x80 (line 3143)')
      if (fnVa === 0x6fc52ce0) {
        OBJECTS_SpawnDensityObjectsInRoom113c(m, pGame, pRoom, nDensity, nObjectId, 100, densityObjectHooks113c(callees.spawn))
      } else {
        callees.spawnObjectsByFn(m, fnVa, pGame, pRoom, nDensity, nObjectId, 100)
      }
      break
    }
  }
}

/** Callees of the random object spawn without a kernel port yet (all required). */
export interface ObjectSpawnCallees113c {
  /** `D2Game:0x6FC4F300` (`esi = pUnit`, `ebx = pGame`, `__stdcall(nUnitId, pRoom, x, y)`): object init. */
  readonly initObject: (m: Memory113c, pUnit: number, pGame: number, nUnitId: number, pRoom: number, x: number, y: number) => void
  /** `D2Game:0x6FD00F40` (`ecx = y`, `edx = pUnit`, `eax = pRoom`, `__stdcall(x, pGame, 1)`): place and hash the unit. */
  readonly placeServerUnit: (m: Memory113c, y: number, pUnit: number, pRoom: number, x: number, pGame: number, a2: number) => void
}

/**
 * `0x6FC52CE0` calls `0x6FC51E20` as `__stdcall(pGame, nObjectId, nSizeX, nSizeY, pRoom)`; Lane G's port reaches it
 * through `RegpopSpawnHooks113c.onSpawnRandomObjectInRoom` (`nSizeX, nSizeY, nObjectId, pGame, 0, pRoom`).
 */
function densityObjectHooks113c(spawn: ObjectSpawnCallees113c): RegpopSpawnHooks113c {
  return {
    onSpawnRandomObjectInRoom: (m, nSizeX, nSizeY, nObjectId, pGame, _nSubType, pRoom) =>
      OBJECTS_SpawnRandomObjectInRoom113c(m, pGame, nObjectId, nSizeX, nSizeY, pRoom, spawn),
  }
}

/** Scratch "stack" for the room coordinates of `0x6FC51E20` (outside every recorded heap range). */
let objSpawnStackPtr = 0x7fc00000

/** Inline `SEED_RollLimited` on `pObjectControl->tSeed` (`0x6FC51E74..0x6FC51EA6`): power-of-two mask else `lo % n`. */
function rollObjCtrlSeed113c(m: Memory113c, pSeed: number, n: number): number {
  if ((n | 0) <= 0) return 0
  const lo = seedStep113c(m, pSeed)
  const mask = (n - 1) | 0
  if ((n & mask) === 0) return (mask & lo) >>> 0
  return (lo % (n >>> 0)) >>> 0
}

/**
 * Spawns one random object in `pRoom` (`__stdcall(pGame, nObjectId, nSizeX, nSizeY, pRoom)`, `ret 0x14`).
 * Rooms narrower or shorter than 2 subtiles return `NULL`. Up to 5 attempts pick
 * `x = subX + roll(subW - nSizeX - 1)`, `y = subY + roll(subH - nSizeY - 1)` on `pGame->pObjectControl->tSeed`
 * and accept the first non-zero point strictly inside the room border whose
 * `(nSizeX + 6) x (nSizeY + 6)` box has no `0x3F11` collision (`D2Common.#10303`). The object unit is then
 * built in place: `D2Common.#11153` unit (type 2, class `nObjectId`, mem pool `pGame+0x1C`, `pGame` at
 * `+0x80`), `dwFlags2 (+0xC8)` bit `0x2000000` from `pGame+0x70` plus `0x4000000`, act / `pAct` from the
 * room's level, `SUNIT_InitUnitSeed(pGame->tSeed)` (one game-seed step), `dwFlags |= 0x10`, `+0xD0 = 0xB`,
 * unit id `++pGame->dwObjectId (+0x98)` (`-1` wraps to `1`), a zeroed `0x38`-byte object data with
 * `pObjectsTxt`, mode 0, a static path (`D2Common.#10445`), then `0x6FC4F300` and `0x6FD00F40`.
 * `pRoom == NULL` after a successful probe asserts (line `0x54E`).
 *
 * @va D2Game:0x6FC51E20 (744B)
 */
export function OBJECTS_SpawnRandomObjectInRoom113c(
  m: Memory113c,
  pGame: number,
  nObjectId: number,
  nSizeX: number,
  nSizeY: number,
  pRoom: number,
  callees: ObjectSpawnCallees113c,
): number {
  const sp = objSpawnStackPtr
  objSpawnStackPtr = (sp + 0x20) >>> 0
  let subX = 0
  let subY = 0
  let subW = 0
  let subH = 0
  try {
    DUNGEON_GetRoomCoordinates113c(m, pRoom, sp)
    subX = m.u32(sp) | 0
    subY = m.u32((sp + 4) >>> 0) | 0
    subW = m.u32((sp + 8) >>> 0) | 0
    subH = m.u32((sp + 12) >>> 0) | 0
  } finally {
    objSpawnStackPtr = sp
  }
  if (subW < 2 || subH < 2) return 0
  const pSeed = m.u32((pGame + GAME_OFF_POBJECTCONTROL) >>> 0) >>> 0
  let x = 0
  let y = 0
  let attempt = 0
  for (; attempt < 5; attempt++) {
    x = (rollObjCtrlSeed113c(m, pSeed, (subW - nSizeX - 1) | 0) + subX) | 0
    y = (rollObjCtrlSeed113c(m, pSeed, (subH - nSizeY - 1) | 0) + subY) | 0
    if (x === 0 || y === 0) continue
    const x16 = x & 0xffff
    const y16 = y & 0xffff
    if (x16 < ((subX + 1) | 0)) continue
    if (y16 < ((subY + 1) | 0)) continue
    if (x16 >= ((subX + subW - 1) | 0)) continue
    if (y16 >= ((subY + subH - 1) | 0)) continue
    const hit = COLLISION_CheckMaskWithSizeXY113c(m, pRoom, x, y, (nSizeX + 6) | 0, (nSizeY + 6) | 0, 0x3f11)
    if ((hit & 0xffff) === 0) break
  }
  if (attempt >= 5) return 0
  if (pRoom === 0) {
    throw new Error('OBJECTS_SpawnRandomObjectInRoom113c: pRoom == NULL (line 1358)')
  }
  const pUnit = UNIT_Alloc113c(m, 2) >>> 0
  if (pUnit === 0) return 0
  m.setU32(pUnit, 2)
  m.setU32((pUnit + 0x04) >>> 0, nObjectId >>> 0)
  m.setU32((pUnit + 0x08) >>> 0, m.u32((pGame + 0x1c) >>> 0))
  m.setU32((pUnit + 0x80) >>> 0, pGame >>> 0)
  let flags2 = m.u32((pUnit + 0xc8) >>> 0)
  flags2 = m.u32((pGame + 0x70) >>> 0) !== 0 ? (flags2 | 0x2000000) >>> 0 : (flags2 & 0xfdffffff) >>> 0
  m.setU32((pUnit + 0xc8) >>> 0, flags2)
  m.setU32((pUnit + 0xc8) >>> 0, (flags2 | 0x4000000) >>> 0)
  const nAct = DRLG_GetActNoFromLevelId113c(m, DUNGEON_GetLevelIdFromRoom113c(m, pRoom)) & 0xff
  m.setU8((pUnit + 0x18) >>> 0, nAct)
  m.setU32((pUnit + 0x1c) >>> 0, m.u32((pGame + 0xbc + nAct * 4) >>> 0))
  m.setU32((pUnit + 0x74) >>> 0, 0)
  SUNIT_InitUnitSeed113c(m, pUnit, (pGame + 0xd0) >>> 0)
  m.setU32((pUnit + 0xc4) >>> 0, (m.u32((pUnit + 0xc4) >>> 0) | 0x10) >>> 0)
  m.setU32((pUnit + 0xd0) >>> 0, 0xb)
  let nUnitId = ((m.u32((pGame + 0x98) >>> 0) | 0) + 1) | 0
  if (nUnitId === -1) nUnitId = 1
  m.setU32((pGame + 0x98) >>> 0, nUnitId >>> 0)
  const pObjData = m.alloc(0x38)
  m.setU32((pUnit + 0x14) >>> 0, pObjData)
  m.fill(pObjData, 0x38, 0)
  m.setU32(pObjData, DATATBLS_GetObjectsTxtRecord113c(m, nObjectId) >>> 0)
  m.setU32((pUnit + 0x10) >>> 0, 0)
  UNITS_AllocStaticPath113c(m, pUnit)
  callees.initObject(m, pUnit, pGame, nUnitId >>> 0, pRoom, x, y)
  callees.placeServerUnit(m, y, pUnit, pRoom, x, pGame, 1)
  return pUnit
}

/**
 * `@va D2Game:0x6FC4E7D0` (`OBJECTS_AllocInteractStrc`, `eax = pUnit`, `edx = pObjectsTxt`, `ecx = pMemPool`).
 */
export function OBJECTS_AllocInteractStrc113c(
  m: Memory113c,
  pUnit: number,
  pObjectsTxt: number,
): void {
  if (pObjectsTxt === 0) return
  if (m.u8((pObjectsTxt + 0x168) >>> 0) !== 1) return
  const pObjData = pUnit !== 0 ? m.u32((pUnit + 0x14) >>> 0) : 0
  if (pObjData === 0) return
  if (m.u32((pObjData + 0x08) >>> 0) !== 0) return
  const pInteract = m.alloc(0x88)
  m.fill(pInteract, 0x88, 0)
  m.setU32((pObjData + 0x08) >>> 0, pInteract >>> 0)
}

/**
 * `@va D2Game:0x6FC4EAD0` (`OBJECTS_CheckLevelObjectHook`, `__fastcall(pLevelObjInfo, pRoom, pGame, bFlag)`).
 */
export function OBJECTS_CheckLevelObjectHook113c(
  m: Memory113c,
  pLevelObjInfo: number,
  _pRoom: number,
  _pGame: number,
  _bFlag: number,
): number {
  if (pLevelObjInfo === 0) return 0
  const count0C = m.u32((pLevelObjInfo + 0x0c) >>> 0) | 0
  const rooms08 = m.u32((pLevelObjInfo + 0x08) >>> 0) | 0
  if (rooms08 < Math.imul(count0C, 10)) return 0
  return 0
}

/**
 * `@va D2Game:0x6FC4F300` (`OBJECTS_InitObjectUnit`, `esi = pUnit`, `ebx = pGame`, `__stdcall(nUnitId, pRoom, x, y)`).
 *
 * Sets `dwUnitId (+0x0C)`, clears `bSparkly (+0x78)`, updates `dwFlags (+0xC4)` bit `0x04` from `ObjectsTxt + 0x128`,
 * clears `pObjectData->InteractType (+0x04)`, removes pending events on `pUnit + 0xDC`, dispatches
 * `ObjectsTxt->nInitFn (+0x1B1)` via `0x6FD2E050[nInitFn]` (`1/3 -> 0x6FC4ECB0`, `2 -> 0x6FC4EF90`,
 * `8/10 -> mode 1`, `9 -> mode 2`, `16 -> (ObjectsTxt+0x180)<<1`), updates `dwFlags` bit `0x02` from
 * `ObjectsTxt->bSelectable[nMode] (+0xC4 + nMode)`, rolls 1/14 pre-operated mode 2 when `ObjectsTxt + 0x13D != 0`,
 * and allocates interaction data via `0x6FC4E7D0`.
 */
export function OBJECTS_InitObjectUnit113c(
  m: Memory113c,
  pUnit: number,
  pGame: number,
  nUnitId: number,
  pRoom: number,
  x: number,
  y: number,
): void {
  if (pUnit === 0) return
  const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
  const pObjectsTxt = DATATBLS_GetObjectsTxtRecord113c(m, nClassId) >>> 0
  if (pObjectsTxt === 0) return

  const savedMode = m.u32((pUnit + 0x10) >>> 0) | 0
  m.setU32((pUnit + 0x0c) >>> 0, nUnitId >>> 0)
  m.setU8((pUnit + 0x78) >>> 0, 0)
  let flags = (m.u32((pUnit + 0xc4) >>> 0) & ~0x08) >>> 0
  m.setU32((pUnit + 0xc4) >>> 0, flags)
  m.setU32((pUnit + 0xa4) >>> 0, 0)

  if (m.u8((pObjectsTxt + 0x128) >>> 0) !== 0) {
    flags = (flags | 0x04) >>> 0
  } else {
    flags = (flags & ~0x04) >>> 0
  }
  m.setU32((pUnit + 0xc4) >>> 0, flags)

  const pObjData = m.u32((pUnit + 0x14) >>> 0) >>> 0
  if (pObjData !== 0) {
    m.setU8((pObjData + 0x04) >>> 0, 0)
  }

  if (m.u32((pUnit + 0xdc) >>> 0) !== 0) {
    EVENT_RemoveUnitEvents113c(m, pGame, pUnit)
  }
  m.setU32((pUnit + 0xdc) >>> 0, 0)

  const nInitFn = m.u8((pObjectsTxt + 0x1b1) >>> 0)
  const pObjControl = m.u32((pGame + 0x10f0) >>> 0) >>> 0
  if (nInitFn !== 0 && nInitFn < 0x50) {
    const sp = objSpawnStackPtr
    objSpawnStackPtr = (sp + 0x20) >>> 0
    try {
      m.setU32((sp + 0x00) >>> 0, pGame >>> 0)
      m.setU32((sp + 0x04) >>> 0, pUnit >>> 0)
      m.setU32((sp + 0x08) >>> 0, pRoom >>> 0)
      m.setU32((sp + 0x0c) >>> 0, pObjControl >>> 0)
      m.setU32((sp + 0x10) >>> 0, pObjectsTxt >>> 0)
      m.setU32((sp + 0x14) >>> 0, x >>> 0)
      m.setU32((sp + 0x18) >>> 0, y >>> 0)
      if (nInitFn === 1 || nInitFn === 3) {
        OBJECTS_InitChestLockAndSeed113c(m, sp)
      } else if (nInitFn === 2) {
        OBJECTS_InitShrineType113c(m, sp)
      } else if (nInitFn === 8 || nInitFn === 10) {
        m.setU32((pUnit + 0x10) >>> 0, 1)
      } else if (nInitFn === 9) {
        m.setU32((pUnit + 0x10) >>> 0, 2)
      } else if (nInitFn === 16 && pObjData !== 0) {
        m.setU8((pObjData + 0x04) >>> 0, (m.u8((pObjectsTxt + 0x180) >>> 0) << 1) & 0xff)
      }
    } finally {
      objSpawnStackPtr = sp
    }
  }

  const bSelectable = m.u8((pObjectsTxt + 0xc4 + savedMode) >>> 0)
  let flagsAfter = m.u32((pUnit + 0xc4) >>> 0)
  if (bSelectable !== 0) {
    flagsAfter = (flagsAfter | 0x02) >>> 0
  } else {
    flagsAfter = (flagsAfter & ~0x02) >>> 0
  }
  m.setU32((pUnit + 0xc4) >>> 0, flagsAfter)

  if (m.u8((pObjectsTxt + 0x13d) >>> 0) !== 0 && ((flagsAfter >>> 7) & 1) === 0 && pObjControl !== 0) {
    const seed: D2SeedStrc = {
      lo: m.u32(pObjControl) >>> 0,
      hi: m.u32((pObjControl + 0x04) >>> 0) >>> 0,
    }
    const r = seedRoll(seed, 0x0e)
    m.setU32(pObjControl, seed.lo >>> 0)
    m.setU32((pObjControl + 0x04) >>> 0, seed.hi >>> 0)
    if (r === 0) {
      m.setU32((pUnit + 0x10) >>> 0, 2)
    }
  }

  OBJECTS_AllocInteractStrc113c(m, pUnit, pObjectsTxt)
}

