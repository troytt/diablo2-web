/**
 * Diablo II v1.13c `D2UnitStrc` & `D2ActiveRoomStrc` unit/room primitives.
 *
 * Binary evidence (`D2Common.dll`, image base `0x6FD50000`):
 * - `UNIT_Alloc` (`#11153` @ `0x6FD7F370`): `D2UnitStrc` unified layout (`0xF4` bytes: `mov edx, 0xF4` at `0x6FD7F383`).
 * - `UNITS_GetX` (`0x6FD51050`, `ecx = pUnit`) / `UNITS_GetY` (`0x6FD51080`, `ecx = pUnit`):
 *   - `dwUnitType` in `{2, 4, 5}` (object, item, tile -> `D2StaticPathStrc` at `+0x2C`):
 *     X = `u32(pPath + 0x0C)`, Y = `u32(pPath + 0x10)`.
 *   - `dwUnitType` in `{0, 1, 3}` (player, monster, missile -> `D2DynamicPathStrc` at `+0x2C`):
 *     X = `u16(pPath + 0x02)` (`wPosX`), Y = `u16(pPath + 0x06)` (`wPosY`), or `0` if `pPath == 0`.
 * - `UNITROOM_RefreshUnit` (`#10158 0x6FDB65C0`): sets `unit.dwFlags |= 0x2000`, `*room.pActUpdateFlag = 1`,
 *   and head-inserts `unit` into `room.pUpdateList (+0x1C)` via `unit.pRoomUpdateNext (+0xE0)`.
 * - `UNITROOM_ClearUpdateQueue` (`#10796 0x6FDB63B0`): walks `room.pUpdateList (+0x1C)`, clearing
 *   `unit.dwFlags &= ~0x2000` and `unit.pRoomUpdateNext = 0`, then sets `room.pUpdateList = 0`.
 * - `UNITROOM_AddUnitToRoom` (`#10531 0x6FDB6800`): head-inserts `unit` into `room.pUnitFirst (+0x74)`
 *   via `unit.pRoomUnitNext (+0xE8)` (does NOT write `pPath->pRoom`!), calls `UNITROOM_RefreshUnit`,
 *   and increments `room.nAlliedCount (+0x28)` for players (`dwUnitType == 0`) or alignment-2 monsters (`0x6FDB687B..89`).
 * - `UNITROOM_RemoveUnitFromRoom` (`#11016 0x6FDB6700`): unlinks `unit` from `room.pUnitFirst (+0x74)`
 *   chain, decrements `room.nAlliedCount (+0x28)` for players or alignment-2 monsters (`0x6FDB67B0..C6`),
 *   unlinks from `room.pUpdateList (+0x1C)`, clears `unit.dwFlags &= ~0x2000`, and zeroes `pPath->pRoom`.
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import type { D2SeedStrc } from '../prng.ts'
import {
  D2ActiveRoomStrc,
  D2CharStatsTxt,
  D2CharStatsTxt_SIZE,
  D2DynamicPathStrc,
  D2MonStatsTxt,
  D2MonStatsTxt_SIZE,
  D2ObjectDataStrc,
  D2ObjectsTxt,
  D2PlayerDataStrc,
  D2StatListExStrc,
  D2StatListStrc,
  D2UnitStrc,
} from '../mem/layout.generated.ts'
import {
  DATATBLS_GetMonSeqTableRecord113c,
  SKILLS_CalcUnitVelocityDivided113c,
  SKILLS_EvalCalcByOffset113c,
  SKILLS_FreeSkillList113c,
  SKILLS_GetUnitSkillRequiredOrMonLevel113c,
  SKILLS_GetUsedSkill113c,
  SKILLS_MapPlayerAnimModeToMonsterMode113c,
  STATES_CheckStateMaskOnUnitFast113c,
} from './skills.ts'
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
  DATATABLES_OFF_113C,
  DATATBLS_GetMissilesTxtRecordInline113c,
  DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c,
  DATATBLS_GetMonStatsTxtRecordInline113c,
  DATATBLS_GetSkillsTxtRecordInline113c,
  DATATBLS_WalkMonsterClassChainInline113c,
  MONSTERS_GetBaseIdFromMonsterUnitInline113c,
  SEED_RollRandomNumberInline113c,
} from './inline-helpers.ts'
import { imul32, sar32, sdiv32 } from './int-math.ts'
import { MONSTERS_GetCompCode113c } from './monsters.ts'
import { fogGetLinkIndex113c } from './inventory.ts'
import {
  STATES_CheckState113c,
  STATES_CheckStateMaskOnUnit113c,
  STATLIST_FLAG_EXTENDED,
  STATLIST_FreeStatListImpl113c,
  STATLIST_GetStatListFromUnitAndState113c,
  STATLIST_GetTotalStatValueLayer0_113c,
  STATLIST_GetUnitStat113c,
  STATLIST_GetUnitStatWithLayer113c,
  STATLIST_SetWeaponStatListActive113c,
  UNITS_ApplyRunWalkStatListInline113c,
  getBaseStatWithMinFromList113c,
  getTotalStatWithMinFromList113c,
} from './statlist.ts'
import {
  ITEMS_CheckItemTypeIdMem113c,
  ITEMS_GetActiveWeaponForAttack113c,
  UNITS_GetAnimDataStringOrPath113c,
} from './items.ts'
import {
  INVENTORY_GetActiveWeaponMem113c,
  INVENTORY_GetCompositWeaponMem113c,
  INVENTORY_GetEquippedShield113c,
  INVENTORY_GetOrInitGridMem113c,
  INVENTORY_GetSecondaryWeapon113c,
  ITEMS_GetWeaponClassCodeIdx113c,
  isItemNotBrokenInvMem113c,
} from './inventory.ts'
import { ANIMDATA_FindRecordByCode113c } from '../tables/anim-tbls-113c.ts'
import { DATATBLS_GetMonsterChainInfo113c } from '../tables/monster-tbls-113c.ts'
import { DRLG_ResolveMonsterSubClassIdForRoom113c } from './drlg/drlg-ver.ts'
import {
  UNITFINDS_FindNearestUnitInRange113c,
  UNITFINDS_MatchUnitCandidate113c,
} from './unit-finds.ts'
export {
  UNITFINDS_FindNearestUnitInRange113c,
  UNITFINDS_MatchUnitCandidate113c,
}
import {
  COLLISION_CheckMaskWithPattern1_113c,
  COLLISION_RayTraceBetweenSizedPoints113c,
  COLLISION_ResetMaskWithPatternSimple113c,
  COLLISION_ResetMaskWithSizeXY113c,
  COLLISION_SetMaskWithPattern113c,
  COLLISION_SetMaskWithSizeXY113c,
} from './collision.ts'
import {
  compositGetWeaponClassCodeAndId113c,
  COMPOSIT_GetUnitWeaponClassCode113c,
  COMPOSIT_GetWeaponClassCode113c,
} from './composit.ts'
import { ITEMS_GetQuiverType113c } from '../tables/datatbls-113c.ts'
import { UNITS_IsInMovingMode113c } from './waypoint.ts'
import {
  PATH_AddUnitCollisionFootprint113c,
  PATH_RemoveUnitCollisionFootprint113c,
  PATH_SetVelocity113c,
} from './path.ts'

export const UNIT_PLAYER = 0
export const UNIT_MONSTER = 1
export const UNIT_OBJECT = 2
export const UNIT_MISSILE = 3
export const UNIT_ITEM = 4
export const UNIT_TILE = 5

export const UNITFLAG_ISUPDATE = 0x00002000

/** `D2Common.#11153` (`0x6FD7F370`): `sizeof(D2UnitStrc) = 0xF4` (`244` bytes). */
export const D2UNIT_ALLOC_SIZE_113C = 0xf4

const DYNPATH_SIZE = 0x40
const STATICPATH_SIZE = 0x20
const UNITS_CPP_FILE_113C = '..\\Source\\D2Common\\UNITS\\Units.cpp'

/** `@va D2Common:0x6FD7F370` (`D2Common.#11153` `UNIT_Alloc`): allocate a `0xF4`-byte `D2UnitStrc`. */
export function UNIT_Alloc113c(m: Memory113c, unitType = 0): number {
  const pUnit = m.alloc(D2UNIT_ALLOC_SIZE_113C)
  m.set(pUnit, D2UnitStrc.dwUnitType, unitType >>> 0)
  return pUnit
}

export function UNITS_Create113c(
  m: Memory113c,
  unitType: number,
  classId: number,
  unitId: number,
  pGame = 0,
): number {
  const pUnit = UNIT_Alloc113c(m, unitType)
  m.set(pUnit, D2UnitStrc.dwClassId, classId >>> 0)
  m.set(pUnit, D2UnitStrc.dwUnitId, unitId >>> 0)
  m.set(pUnit, D2UnitStrc.pGame, pGame >>> 0)
  return pUnit
}

/** Allocate and attach an isomorphic path (`D2DynamicPathStrc` for `0,1,3` or `D2StaticPathStrc` for `2,4,5`). */
export function UNITS_InitPath113c(m: Memory113c, pUnit: number, x: number, y: number, pRoom = 0): number {
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  const isStatic = unitType === UNIT_OBJECT || unitType === UNIT_ITEM || unitType === UNIT_TILE
  const pPath = m.alloc(isStatic ? STATICPATH_SIZE : DYNPATH_SIZE)
  m.set(pUnit, D2UnitStrc.pPath, pPath)
  if (isStatic) {
    // D2StaticPathStrc: +0x00 pRoom, +0x0C dwPosX, +0x10 dwPosY
    m.setU32(pPath + 0x00, pRoom >>> 0)
    m.setU32(pPath + 0x0c, x >>> 0)
    m.setU32(pPath + 0x10, y >>> 0)
  } else {
    // D2DynamicPathStrc: +0x00 wOffsetX, +0x02 wPosX, +0x04 wOffsetY, +0x06 wPosY, +0x1C pRoom
    m.setU16(pPath + 0x02, x & 0xffff)
    m.setU16(pPath + 0x06, y & 0xffff)
    m.setU32(pPath + 0x1c, pRoom >>> 0)
  }
  return pPath
}

/**
 * `@va D2Common:0x6FD7FE10` (`D2Common.#10331` `UNITS_GetRoom`, 82 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `D2ActiveRoomStrc*`).
 */
export function UNITS_GetRoom113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x896)
  }
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType) | 0
  if (unitType === 2 || (unitType > 3 && unitType <= 5)) {
    const pStaticPath = m.get(pUnit, D2UnitStrc.pPath)
    return m.u32(pStaticPath + 0x00)
  }
  const pDynamicPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pDynamicPath === 0) return 0
  return m.get(pDynamicPath, D2DynamicPathStrc.pRoom)
}

export function UNITS_SetRoom113c(m: Memory113c, pUnit: number, pRoom: number): void {
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pPath === 0) return
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  const isStatic = unitType === UNIT_OBJECT || unitType === UNIT_ITEM || unitType === UNIT_TILE
  m.setU32(pPath + (isStatic ? 0x00 : 0x1c), pRoom >>> 0)
}

/** `D2Common 0x6FD51050` (`UNITS_GetX`, `ecx = pUnit`). */
export function UNITS_GetX113c(m: Memory113c, pUnit: number): number {
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (unitType === UNIT_OBJECT || unitType === UNIT_ITEM || unitType === UNIT_TILE) {
    return m.u32(pPath + 0x0c) | 0
  }
  if (pPath === 0) return 0
  return m.u16(pPath + 0x02)
}

/**
 * `D2Common 0x6FD51080` (`UNITS_GetY`, `ecx = pUnit`): mirrors 0x6FD51050 exactly - no unit null test
 * (0x6FD51080 `mov eax, [ecx]`) and no path null test for static paths (0x6FD510A0..0x6FD510A3).
 */
export function UNITS_GetY113c(m: Memory113c, pUnit: number): number {
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  const pPath = m.get(pUnit, D2UnitStrc.pPath)
  if (unitType === UNIT_OBJECT || unitType === UNIT_ITEM || unitType === UNIT_TILE) {
    return m.u32(pPath + 0x10) | 0
  }
  if (pPath === 0) return 0
  return m.u16(pPath + 0x06)
}

/**
 * `@va D2Common:0x6FDB65C0` (`D2Common.#10158` `UNITROOM_RefreshUnit`).
 * 0x6FDB65C5 `test esi, esi; jne` else `push 0x75` -> assert thunk 0x6FD5921C + exit(-1).
 * 0x6FDB65F7..0x6FDB65FA: `mov ecx, [room+0x2C]; mov dword [ecx], 1` (no null test on pActUpdateFlag).
 * 0x6FDB65EE `add eax, 0x1C` + 0x6FDB6600 `jne` else `push 0x88` (address of `pUpdateList` is null).
 */
export function UNITROOM_RefreshUnit113c(m: Memory113c, pUnit: number): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x75)
  }
  const pRoom = UNITS_GetRoom113c(m, pUnit)
  if (pRoom === 0) return
  if ((m.get(pRoom, D2ActiveRoomStrc.dwFlags) & 0x04) !== 0) return
  const flags = m.get(pUnit, D2UnitStrc.dwFlags)
  if ((flags & UNITFLAG_ISUPDATE) !== 0) return

  m.set(pUnit, D2UnitStrc.dwFlags, (flags | UNITFLAG_ISUPDATE) >>> 0)
  const pActFlag = m.get(pRoom, D2ActiveRoomStrc.pActUpdateFlag)
  m.setU32(pActFlag, 1)
  if (((pRoom + 0x1c) >>> 0) === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x88)
  }
  const prevHead = m.get(pRoom, D2ActiveRoomStrc.pUpdateList)
  m.set(pUnit, D2UnitStrc.pRoomUpdateNext, prevHead)
  m.set(pRoom, D2ActiveRoomStrc.pUpdateList, pUnit)
}

/**
 * `D2Common.#10830` (`0x6FD891F0` -> `0x6FD8B650` `STATLIST_GetUnitAlignment`):
 * Returns `2` (allied/player) for `UNIT_PLAYER`, or for `UNIT_MONSTER` when state `17` (`conversion`)
 * is active (`0x6FD8920F`) or `pStatListEx->dwFlags` has bit `0x200` set (`0x6FD8B685`);
 * returns `1` when bit `0x400` is set; otherwise `0` (evil).
 */
export function UNIT_GetAlignment113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0) return 2
  const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
  if (uType !== UNIT_MONSTER) return 2
  if (STATES_CheckState113c(m, pUnit, 17) !== 0) return 2
  const pListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pListEx === 0) return 0
  const fl = m.get(pListEx, D2StatListStrc.dwFlags)
  if ((fl & STATLIST_FLAG_EXTENDED) === 0) return 0
  if ((fl & 0x0700) === 0) return 0
  if ((fl & 0x0100) !== 0) return 0
  if ((fl & 0x0400) !== 0) return 1
  return (fl & 0x0200) !== 0 ? 2 : 0
}

/**
 * `@va D2Common:0x6FDB63B0` (`D2Common.#10796` `UNITROOM_ClearUpdateQueue`):
 * Walks `pRoom->pUpdateList (+0x1C)`, clearing `UNITFLAG_ISUPDATE` (`0x2000`) and
 * `pRoomUpdateNext (+0xE0)` on each unit, then zeroes `pRoom->pUpdateList`.
 */
export function UNITROOM_ClearUpdateQueue113c(m: Memory113c, pRoom: number): void {
  if (pRoom === 0) return
  let cur = m.get(pRoom, D2ActiveRoomStrc.pUpdateList)
  while (cur !== 0) {
    const next = m.get(cur, D2UnitStrc.pRoomUpdateNext)
    m.set(cur, D2UnitStrc.dwFlags, (m.get(cur, D2UnitStrc.dwFlags) & ~UNITFLAG_ISUPDATE) >>> 0)
    m.set(cur, D2UnitStrc.pRoomUpdateNext, 0)
    cur = next
  }
  m.set(pRoom, D2ActiveRoomStrc.pUpdateList, 0)
}

/** `D2Common.#10531` (`0x6FDB6800` `UNITROOM_AddUnitToRoom`). */
export function UNITROOM_AddUnitToRoom113c(m: Memory113c, pUnit: number, pRoom: number): void {
  if (pUnit === 0 || pRoom === 0) return
  const prevFirst = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst)
  m.set(pUnit, D2UnitStrc.pRoomUnitNext, prevFirst)
  m.set(pRoom, D2ActiveRoomStrc.pUnitFirst, pUnit)
  UNITROOM_RefreshUnit113c(m, pUnit)
  const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
  if (uType === UNIT_PLAYER || (uType === UNIT_MONSTER && UNIT_GetAlignment113c(m, pUnit) === 2)) {
    m.setU32(pRoom + 0x28, (m.u32(pRoom + 0x28) + 1) >>> 0)
  }
}

/**
 * `@va D2Common:0x6FDB6700` (`D2Common.#11016` `UNITROOM_RemoveUnitFromRoom`):
 * - `pUnit == 0` asserts `0xEF` (0x6FDB670C); no room: asserts `0xF7` if `pRoomUnitNext (+0xE8) != 0`
 *   (0x6FDB6746), else returns.
 * - Unlinks from `room.pUnitFirst (+0x74)`; for players or `0x6FD891F0 == 2` monsters calls `0x6FD8B650`
 *   (`room.nAlliedCount (+0x28)`: asserts `0x27C` unless `> 0`, then decrements).
 * - Always calls `0x6FDB6410` (update-list unlink), clears `UNITFLAG_ISUPDATE` (0x6FDB67D7), and clears the
 *   path room via `0x6FD7FE70` only when the unit was found in the room list.
 */
export function UNITROOM_RemoveUnitFromRoom113c(m: Memory113c, pUnit: number): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xef)
  }
  const pRoom = UNITS_GetRoom113c(m, pUnit)
  if (pRoom === 0) {
    if (m.get(pUnit, D2UnitStrc.pRoomUnitNext) !== 0) {
      throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xf7)
    }
    return
  }
  let bFound = false
  let prev = 0
  let cur = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst)
  while (cur !== 0 && cur !== pUnit >>> 0) {
    prev = cur
    cur = m.get(cur, D2UnitStrc.pRoomUnitNext)
  }
  if (cur !== 0) {
    bFound = true
    if (prev === 0) m.set(pRoom, D2ActiveRoomStrc.pUnitFirst, m.get(cur, D2UnitStrc.pRoomUnitNext))
    else m.set(prev, D2UnitStrc.pRoomUnitNext, m.get(cur, D2UnitStrc.pRoomUnitNext))
    m.set(cur, D2UnitStrc.pRoomUnitNext, 0)
    const uType = m.get(pUnit, D2UnitStrc.dwUnitType)
    // 0x6FDB67BA calls 0x6FD891F0; kept on the same alignment helper as UNITROOM_AddUnitToRoom113c so the
    // add/remove allied-count pair stays symmetric (see handoff caveat on UNIT_GetAlignment113c vs 0x6FD891F0).
    if (uType === UNIT_PLAYER || (uType === UNIT_MONSTER && UNIT_GetAlignment113c(m, pUnit) === 2)) {
      // 0x6FD8B650: `cmp [room+0x28], 0; jg` else `push 0x27c` -> assert.
      const nAllied = m.u32(pRoom + 0x28) | 0
      if (nAllied <= 0) {
        throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x27c)
      }
      m.setU32(pRoom + 0x28, (nAllied - 1) >>> 0)
    }
  }
  UNITROOM_UnlinkUnitFromUpdateList113c(m, pUnit)
  m.set(pUnit, D2UnitStrc.dwFlags, (m.get(pUnit, D2UnitStrc.dwFlags) & ~UNITFLAG_ISUPDATE) >>> 0)
  if (bFound) {
    // 0x6FD7FE70 (`pUnit != 0` here): static paths `[pPath+0x00] = 0` with no path null test, dynamic
    // paths `[pPath+0x1C] = 0` only when `pPath != 0`.
    const pPath = m.get(pUnit, D2UnitStrc.pPath)
    const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
    if (unitType === UNIT_OBJECT || unitType === UNIT_ITEM || unitType === UNIT_TILE) {
      m.setU32(pPath, 0)
    } else if (pPath !== 0) {
      m.setU32(pPath + 0x1c, 0)
    }
  }
}

/**
 * `@va D2Common:0x6FDB6410` (`UNITROOM_UnlinkUnitFromUpdateList`, stdcall `[esp+4] = pUnit`, `ret 4`): asserts `0x127` on a null unit; with no room asserts `0x132`
 * if `pRoomUpdateNext (+0xE0) != 0`, else returns; otherwise unlinks the unit from `room.pUpdateList (+0x1C)`
 * (no-op when absent) and zeroes its `pRoomUpdateNext`.
 */
export function UNITROOM_UnlinkUnitFromUpdateList113c(m: Memory113c, pUnit: number): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x127)
  }
  const pRoom = UNITS_GetRoom113c(m, pUnit)
  if (pRoom === 0) {
    if (m.get(pUnit, D2UnitStrc.pRoomUpdateNext) !== 0) {
      throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x132)
    }
    return
  }
  let prev = 0
  let cur = m.get(pRoom, D2ActiveRoomStrc.pUpdateList)
  while (cur !== 0 && cur !== pUnit >>> 0) {
    prev = cur
    cur = m.get(cur, D2UnitStrc.pRoomUpdateNext)
  }
  if (cur === 0) return
  if (prev === 0) m.set(pRoom, D2ActiveRoomStrc.pUpdateList, m.get(cur, D2UnitStrc.pRoomUpdateNext))
  else m.set(prev, D2UnitStrc.pRoomUpdateNext, m.get(cur, D2UnitStrc.pRoomUpdateNext))
  m.set(cur, D2UnitStrc.pRoomUpdateNext, 0)
}

/** Read `pUnit->sSeed` (`+0x20` `lo`, `+0x24` `hi`). */
export function UNITS_GetSeed113c(m: Memory113c, pUnit: number): D2SeedStrc {
  if (pUnit === 0) return { lo: 0, hi: 0 }
  return {
    lo: m.get(pUnit, D2UnitStrc.seedLo) >>> 0,
    hi: m.get(pUnit, D2UnitStrc.seedHi) >>> 0,
  }
}

/** Write `pUnit->sSeed` (`+0x20` `lo`, `+0x24` `hi`). */
export function UNITS_SetSeed113c(m: Memory113c, pUnit: number, lo: number, hi: number): void {
  if (pUnit === 0) return
  m.set(pUnit, D2UnitStrc.seedLo, lo >>> 0)
  m.set(pUnit, D2UnitStrc.seedHi, hi >>> 0)
}

/** `.rdata` weapon speed animation rate tables read by `0x6FD7FAC0` (`UNITS_GetWeaponSpeedAnimRate`). */
export const D2COMMON_PLAYER_WEAP_ANIM_RATE_TABLE_VA_113C = 0x6fddc608
export const D2COMMON_MON_WEAP_ANIM_RATE_TABLE_CLASSIC_VA_113C = 0x6fddc788
export const D2COMMON_MON_WEAP_ANIM_RATE_TABLE_EXP_VA_113C = 0x6fddc8c8

/**
 * `@va D2Common:0x6FD7EE60` (`D2Common.#10582` `UNITS_GetFrameAndFrameCount`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pFrame`, `[esp+0xC] = pFrameCount`, `ret 0xC`, void).
 *
 * When `pUnit == 0`, zeroes `*pFrame` and `*pFrameCount`.
 * When `pUnit->dwUnitType == 2` (`UNIT_OBJECT`), writes `*pFrame = pUnit->dwFramePrecise (+0x44)`
 * and `*pFrameCount = pUnit->pUnitData->pObjectsTxt->dwFrameCnt[pUnit->dwAnimMode] (+0xD8 + mode*4)`.
 * Otherwise writes `*pFrame = pUnit->dwFramePrecise (+0x44)` and `*pFrameCount = pUnit->dwFrameCountPrecise (+0x48)`.
 */
export function UNITS_GetFrameAndFrameCount113c(
  m: Memory113c,
  pUnit: number,
  pFrame: number,
  pFrameCount: number,
): void {
  const u = pUnit >>> 0
  if (u === 0) {
    m.setU32(pFrame >>> 0, 0)
    m.setU32(pFrameCount >>> 0, 0)
    return
  }
  if (m.get(u, D2UnitStrc.dwUnitType) === 2) {
    m.setU32(pFrame >>> 0, m.get(u, D2UnitStrc.dwFramePrecise))
    const nMode = m.get(u, D2UnitStrc.dwAnimMode) | 0
    const pObjectData = m.get(u, D2UnitStrc.pUnitData)
    const pObjectsTxt = m.get(pObjectData, D2ObjectDataStrc.pObjectTxt)
    const frameCntAddr = (pObjectsTxt + imul32(nMode, 4) + D2ObjectsTxt.dwFrameCnt.off) >>> 0
    m.setU32(pFrameCount >>> 0, m.u32(frameCntAddr))
    return
  }
  m.setU32(pFrame >>> 0, m.get(u, D2UnitStrc.dwFramePrecise))
  m.setU32(pFrameCount >>> 0, m.get(u, D2UnitStrc.dwFrameCountPrecise))
}

/**
 * `@va D2Common:0x6FD7EF90` (`UNITS_IsWalkModeForType`,
 * custom LTCG `eax = nUnitType`, `ecx = nMode`, plain `ret` -> `1` or `0`).
 */
export function UNITS_IsWalkModeForType113c(
  _m: Memory113c,
  nUnitType: number,
  nMode: number,
): number {
  const t = nUnitType | 0
  const mode = nMode | 0
  if (t === 0) return mode === 9 ? 1 : 0
  if (t === 1) return mode === 6 ? 1 : 0
  return 0
}

/**
 * `@va D2Common:0x6FD7EFC0` (`UNITS_IsGetHitModeForType`,
 * custom LTCG `eax = nUnitType`, `ecx = nMode`, plain `ret` -> `1` or `0`).
 */
export function UNITS_IsGetHitModeForType113c(
  _m: Memory113c,
  nUnitType: number,
  nMode: number,
): number {
  const t = nUnitType | 0
  const mode = nMode | 0
  if (t === 0) return mode === 4 ? 1 : 0
  if (t === 1) return mode === 3 ? 1 : 0
  return 0
}

/**
 * `@va D2Common:0x6FD7F010` (`UNITS_IsRunModeForType`,
 * custom LTCG `eax = nUnitType`, `ecx = nMode`, plain `ret` -> `1` or `0`).
 */
export function UNITS_IsRunModeForType113c(
  _m: Memory113c,
  nUnitType: number,
  nMode: number,
): number {
  const t = nUnitType | 0
  const mode = nMode | 0
  if (t === 0) return mode === 0x13 ? 1 : 0
  if (t === 1) return mode === 0x0d ? 1 : 0
  return 0
}

/**
 * `@va D2Common:0x6FD7F1B0` (`D2Common.#10175` `UNITS_GetAnimOrSeqMode`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `dwSeqMode (+0x40)` or `dwAnimMode (+0x10)`).
 */
export function UNITS_GetAnimOrSeqMode113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const uType = m.get(u, D2UnitStrc.dwUnitType)
  if ((uType === 0 || uType === 1) && m.get(u, D2UnitStrc.pAnimSeq) !== 0) {
    return m.get(u, D2UnitStrc.dwSeqMode) | 0
  }
  return m.get(u, D2UnitStrc.dwAnimMode) | 0
}

/**
 * `@va D2Common:0x6FD7FAC0` (`UNITS_GetWeaponSpeedAnimRate`,
 * custom LTCG `eax = nUnitType`, `ecx = nWeapClass`, `[esp+4] = nClassId`, `ret 4`).
 *
 * Unconditionally reads `.rdata` weapon animation rate tables at `0x6FDDC608` (player),
 * `0x6FDDC788` (monster `nClassId < 0x19A`), or `0x6FDDC8C8` (expansion monster `nClassId >= 0x19A`).
 */
export function UNITS_GetWeaponSpeedAnimRate113c(
  m: Memory113c,
  nUnitType: number,
  nWeapClass: number,
  nClassId: number,
): number {
  const t = nUnitType | 0
  const wc = nWeapClass | 0
  const cid = nClassId | 0
  if (t === 0) {
    const addr = (D2COMMON_PLAYER_WEAP_ANIM_RATE_TABLE_VA_113C + imul32(wc, 20)) >>> 0
    return m.u32(addr) | 0
  }
  if (t === 1) {
    const base =
      cid < 0x19a
        ? D2COMMON_MON_WEAP_ANIM_RATE_TABLE_CLASSIC_VA_113C
        : D2COMMON_MON_WEAP_ANIM_RATE_TABLE_EXP_VA_113C
    const addr = (base + imul32(wc, 20) + 0x10) >>> 0
    return m.u32(addr) | 0
  }
  return 0
}

/**
 * `@va D2Common:0x6FD7FB10` (`UNITS_GetBaseAnimSpeed`,
 * custom LTCG `ecx = nUnitType`, `eax = nClassId`, `edx = nAnimMode`, plain `ret`).
 */
export function UNITS_GetBaseAnimSpeed113c(
  m: Memory113c,
  nUnitType: number,
  nClassId: number,
  nAnimMode: number,
): number {
  const t = nUnitType | 0
  const cid = nClassId | 0
  const mode = nAnimMode | 0
  if (t === 0) {
    return mode === 3 ? 0x65 : 0xd5
  }
  if (t === 1) {
    let pRecord = 0
    if (cid >= 0) {
      const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      if (cid < (m.u32((dt + DATATABLES_OFF_113C.nMonStatsTxtRecordCount) >>> 0) | 0)) {
        const pMonStats = m.u32((dt + DATATABLES_OFF_113C.pMonStatsTxt) >>> 0)
        pRecord = (pMonStats + imul32(cid, D2MonStatsTxt_SIZE)) >>> 0
      }
    }
    if (mode === 0x0f) {
      return (m.get(pRecord, D2MonStatsTxt.wRun) << 16) >> 16
    }
    return (m.get(pRecord, D2MonStatsTxt.wSeqVelocity) << 16) >> 16
  }
  return 0
}

/**
 * `@va D2Common:0x6FD80D50` (`UNITS_GetBaseWalkVelocity`,
 * custom LTCG `ecx = nUnitType`, `eax = nClassId`, plain `ret`).
 */
export function UNITS_GetBaseWalkVelocity113c(
  m: Memory113c,
  nUnitType: number,
  nClassId: number,
): number {
  const t = nUnitType | 0
  const cid = nClassId | 0
  if (t === 0) {
    let pRecord = 0
    if (cid >= 0) {
      const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      if (cid < (m.u32((dt + DATATABLES_OFF_113C.nCharStatsTxtRecordCount) >>> 0) | 0)) {
        const pCharStats = m.u32((dt + DATATABLES_OFF_113C.pCharStatsTxt) >>> 0)
        pRecord = (pCharStats + imul32(cid, D2CharStatsTxt_SIZE)) >>> 0
      }
    }
    return ((m.get(pRecord, D2CharStatsTxt.nWalkSpeed) & 0xff) << 8) | 0
  }
  if (t === 1) {
    let pRecord = 0
    if (cid >= 0) {
      const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      if (cid < (m.u32((dt + DATATABLES_OFF_113C.nMonStatsTxtRecordCount) >>> 0) | 0)) {
        const pMonStats = m.u32((dt + DATATABLES_OFF_113C.pMonStatsTxt) >>> 0)
        pRecord = (pMonStats + imul32(cid, D2MonStatsTxt_SIZE)) >>> 0
      }
    }
    const wVel = (m.get(pRecord, D2MonStatsTxt.wVelocity) << 16) >> 16
    return (wVel << 8) | 0
  }
  return 0
}

/**
 * `@va D2Common:0x6FD83A70` (`D2Common.#10226` `UNITS_CheckStateMaskOnCurse`,
 * stdcall `[esp+4] = nState`, `ret 4` -> masked bit word or `0`).
 */
export function UNITS_CheckStateMaskOnCurse113c(m: Memory113c, nState: number): number {
  const state = nState | 0
  if (state < 0) return 0
  const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (state >= (m.u32((dt + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0) | 0)) return 0
  const pMaskArray = m.u32((dt + DATATABLES_OFF_113C.fStateMasksOnCurse) >>> 0)
  const wordVal = m.u32((pMaskArray + (sar32(state, 5) << 2)) >>> 0)
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  const bitMask = m.u32((pBitMasks + ((state & 0x1f) << 2)) >>> 0)
  return (wordVal & bitMask) | 0
}

/**
 * `@va D2Common:0x6FD83B00` (`D2Common.#10590` `UNITS_CheckStateMaskExp`,
 * stdcall `[esp+4] = nState`, `ret 4` -> masked bit word or `0`).
 */
export function UNITS_CheckStateMaskExp113c(m: Memory113c, nState: number): number {
  const state = nState | 0
  if (state < 0) return 0
  const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (state >= (m.u32((dt + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0) | 0)) return 0
  const pMaskArray = m.u32((dt + DATATABLES_OFF_113C.fStateMasksExp) >>> 0)
  const wordVal = m.u32((pMaskArray + (sar32(state, 5) << 2)) >>> 0)
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  const bitMask = m.u32((pBitMasks + ((state & 0x1f) << 2)) >>> 0)
  return (wordVal & bitMask) | 0
}

/**
 * `@va D2Common:0x6FD83B40` (`D2Common.#10033` `UNITS_CheckStateMaskAura`,
 * stdcall `[esp+4] = nState`, `ret 4` -> masked bit word or `0`).
 */
export function UNITS_CheckStateMaskAura113c(m: Memory113c, nState: number): number {
  const state = nState | 0
  if (state < 0) return 0
  const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (state >= (m.u32((dt + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0) | 0)) return 0
  const pMaskArray = m.u32((dt + DATATABLES_OFF_113C.fStateMasksAura) >>> 0)
  const wordVal = m.u32((pMaskArray + (sar32(state, 5) << 2)) >>> 0)
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  const bitMask = m.u32((pBitMasks + ((state & 0x1f) << 2)) >>> 0)
  return (wordVal & bitMask) | 0
}

/**
 * `@va D2Common:0x6FD83B80` (`D2Common.#10683` `UNITS_IsShapeshifted`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `(pUnit->dwFlags2 >> 3) & 1` or `0`).
 */
export function UNITS_IsShapeshifted113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  return (m.get(u, D2UnitStrc.dwFlags2) >>> 3) & 1
}

/**
 * `@va D2Common:0x6FD83CA0` (`D2Common.#11150` `UNITS_GetStateFlagsPtr`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `pStatListEx->pStateFlags (+0x58)` or `0`).
 */
export function UNITS_GetStateFlagsPtr113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pStatListEx = m.get(u, D2UnitStrc.pStatListEx)
  if (pStatListEx === 0) return 0
  if ((m.get(pStatListEx, D2StatListStrc.dwFlags) | 0) >= 0) return 0
  return m.get(pStatListEx, D2StatListExStrc.pStateFlags) >>> 0
}

/**
 * `@va D2Common:0x6FD84330` (`D2Common.#11149` `UNITS_HasAnyGfxStateFlag`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `1` if any dirty/gfx state word is non-zero, else `0`).
 */
export function UNITS_HasAnyGfxStateFlag113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const pStatListEx = m.get(u, D2UnitStrc.pStatListEx)
  if (pStatListEx === 0) return 0
  if ((m.get(pStatListEx, D2StatListStrc.dwFlags) | 0) >= 0) return 0
  const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const nStates = m.u32((dt + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0) | 0
  const pStateFlags = m.get(pStatListEx, D2StatListExStrc.pStateFlags)
  const plus31 = (nStates + 31) | 0
  const bias = (plus31 >> 31) & 0x1f
  const nDwords = ((plus31 + bias) | 0) >> 5
  const pGfxFlags = (pStateFlags + (nDwords << 2)) >>> 0
  if (pGfxFlags === 0 || nDwords <= 0) return 0
  for (let i = 0; i < nDwords; i++) {
    if (m.u32((pGfxFlags + i * 4) >>> 0) !== 0) return 1
  }
  return 0
}

/**
 * `@va D2Common:0x6FD84390` (`D2Common.#10960` `UNITS_ClearGfxStateFlags`,
 * stdcall `[esp+4] = pUnit`, `ret 4`, void).
 */
export function UNITS_ClearGfxStateFlags113c(m: Memory113c, pUnit: number): void {
  const u = pUnit >>> 0
  if (u === 0) return
  const pStatListEx = m.get(u, D2UnitStrc.pStatListEx)
  if (pStatListEx === 0) return
  if ((m.get(pStatListEx, D2StatListStrc.dwFlags) | 0) >= 0) return
  const dt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const nStates = m.u32((dt + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0) | 0
  const plus31 = (nStates + 31) | 0
  const bias = (plus31 >> 31) & 0x1f
  const nDwords = ((plus31 + bias) | 0) >> 5
  const pStateFlags = m.get(pStatListEx, D2StatListExStrc.pStateFlags)
  const nBytes = (nDwords << 2) >>> 0
  const pGfxFlags = (pStateFlags + nBytes) >>> 0
  if (pGfxFlags === 0) return
  const dwordCount = nBytes >>> 2
  for (let i = 0; i < dwordCount; i++) {
    m.setU32((pGfxFlags + i * 4) >>> 0, 0)
  }
}

const PLAYER_MODE_SWITCH_TABLE_VA_113C = 0x6fddc5f8
const MONSTER_MODE_SWITCH_TABLE_LOW_VA_113C = 0x6fddc788
const MONSTER_MODE_SWITCH_TABLE_HIGH_VA_113C = 0x6fddc8c8
const SGPT_OBJECTS_TXT_PTR_VA_113C = 0x6fdf0b94
const SGPT_OBJECTS_TXT_COUNT_VA_113C = 0x6fdf0b98

/**
 * `@va D2Common:0x6FD7EDA0` (`D2Common.#11020` `UNITS_IsDoor`, 64 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `number`).
 */
export function UNITS_IsDoor113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xe10)
  }
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== 2) {
    return 0
  }
  const pObjectData = m.get(pUnit, D2UnitStrc.pUnitData)
  const pObjectTxt = m.get(pObjectData, D2ObjectDataStrc.pObjectTxt)
  return m.get(pObjectTxt, D2ObjectsTxt.nOperateFn)
}

/**
 * `@va D2Common:0x6FD7EEC0` (`D2Common.#10569` `UNITS_GetShiftedFrameMetrics`, 102 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pOutFrame`, `[esp+0xC] = pOutFrameCount`, `ret 0xC`, void).
 */
export function UNITS_GetShiftedFrameMetrics113c(
  m: Memory113c,
  pUnit: number,
  pOutFrame: number,
  pOutFrameCount: number,
): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xd8f)
  }
  const dwUnitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  const nFrame = sar32(m.get(pUnit, D2UnitStrc.dwFramePrecise) | 0, 8)
  if (dwUnitType === 2) {
    m.setU32(pOutFrame >>> 0, nFrame >>> 0)
    const pObjectData = m.get(pUnit, D2UnitStrc.pUnitData)
    const nMode = m.get(pUnit, D2UnitStrc.dwAnimMode) | 0
    const pObjectTxt = m.get(pObjectData, D2ObjectDataStrc.pObjectTxt)
    const dwFrameCnt = m.u32(
      (pObjectTxt + D2ObjectsTxt.dwFrameCnt.off + imul32(nMode, 4)) >>> 0,
    )
    m.setU32(pOutFrameCount >>> 0, dwFrameCnt >>> 0)
  } else {
    m.setU32(pOutFrame >>> 0, nFrame >>> 0)
    const nFrameCount = sar32(m.get(pUnit, D2UnitStrc.dwFrameCountPrecise) | 0, 8)
    m.setU32(pOutFrameCount >>> 0, nFrameCount >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD7EF30` (`D2Common.#10426` `UNITS_HasAnimFinished`, 87 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `1` or `0`).
 */
export function UNITS_HasAnimFinished113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xd81)
  }
  const pAnimSeq = m.get(pUnit, D2UnitStrc.pAnimSeq)
  if (pAnimSeq !== 0) {
    const nFrameCountPrecise = m.get(pUnit, D2UnitStrc.dwFrameCountPrecise) | 0
    return nFrameCountPrecise <= 0 ? 1 : 0
  }
  const wAnimSpeed = (m.get(pUnit, D2UnitStrc.wAnimSpeed) << 16) >> 16
  const nFramePrecise = m.get(pUnit, D2UnitStrc.dwFramePrecise) | 0
  const nFrameCountPrecise = m.get(pUnit, D2UnitStrc.dwFrameCountPrecise) | 0
  return ((wAnimSpeed + nFramePrecise) | 0) >= nFrameCountPrecise ? 1 : 0
}

/**
 * `@va D2Common:0x6FD7F0C0` (`D2Common.#10542` `UNITS_SetSeqFrameFromLowByte`, 63 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nFrame`, `ret 0x8`, void).
 */
export function UNITS_SetSeqFrameFromLowByte113c(
  m: Memory113c,
  pUnit: number,
  nFrame: number,
): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xace)
  }
  const lowByte = m.get(pUnit, D2UnitStrc.dwSeqFramePrecise) & 0xff
  m.set(pUnit, D2UnitStrc.dwSeqFramePrecise, (lowByte + (nFrame << 8)) >>> 0)
}

/**
 * `@va D2Common:0x6FD7F3E0` (`D2Common.#10234` `UNITS_FreeStaticPath`, 34 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4`, void).
 */
export function UNITS_FreeStaticPath113c(m: Memory113c, pUnit: number): void {
  const pStaticPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pStaticPath !== 0) {
    m.get(pUnit, D2UnitStrc.pMemPool)
    ;(m as { free?: (p: number) => void }).free?.(pStaticPath)
  }
}

/**
 * `@va D2Common:0x6FD7F410` (`D2Common.#10445` `UNITS_AllocStaticPath`, 69 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4`, void).
 */
export function UNITS_AllocStaticPath113c(m: Memory113c, pUnit: number): void {
  const existing = m.get(pUnit, D2UnitStrc.pPath)
  if (existing === 0) {
    m.get(pUnit, D2UnitStrc.pMemPool)
    const pStaticPath = m.alloc(0x20)
    m.set(pUnit, D2UnitStrc.pPath, pStaticPath >>> 0)
    if (pStaticPath !== 0) {
      for (let i = 0; i < 0x20; i += 4) {
        m.setU32((pStaticPath + i) >>> 0, 0)
      }
    }
  }
}

/**
 * `@va D2Common:0x6FD7F460` (`D2Common.#10829` `UNITS_GetInteractItemGuid`, 74 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `number`).
 */
export function UNITS_GetInteractItemGuid113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xfb4)
  }
  if (m.get(pUnit, D2UnitStrc.dwUnitType) !== 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xfb6)
  }
  const pPlayerData = m.get(pUnit, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x14d7)
  }
  return m.get(pPlayerData, D2PlayerDataStrc.dwInteractItemGuid)
}

/**
 * `@va D2Common:0x6FD7F4B0` (`D2Common.#11055` `UNITS_SetInteractItem`, 97 bytes,
 * stdcall `[esp+4] = pPlayer`, `[esp+8] = pItem`, `ret 0x8`, void).
 */
export function UNITS_SetInteractItem113c(
  m: Memory113c,
  pPlayer: number,
  pItem: number,
): void {
  if (pPlayer >>> 0 === 0 || m.get(pPlayer, D2UnitStrc.dwUnitType) !== 0) {
    return
  }
  const pPlayerData = m.get(pPlayer, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x14c5)
  }
  if (pItem >>> 0 === 0) {
    m.set(pPlayerData, D2PlayerDataStrc.dwInteractItemGuid, 0)
    return
  }
  if (m.get(pItem, D2UnitStrc.dwUnitType) !== 4) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x14c9)
  }
  m.set(
    pPlayerData,
    D2PlayerDataStrc.dwInteractItemGuid,
    m.get(pItem, D2UnitStrc.dwUnitId),
  )
}

/**
 * `@va D2Common:0x6FD7F5C0` (`D2Common.#10756` `UNITS_GetPlayerSubtargetLeft`, 102 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pOutType`, `[esp+0xC] = pOutGuid`, `ret 0xC`, void).
 */
export function UNITS_GetPlayerSubtargetLeft113c(
  m: Memory113c,
  pUnit: number,
  pOutType: number,
  pOutGuid: number,
): void {
  if (pUnit >>> 0 === 0 || m.get(pUnit, D2UnitStrc.dwUnitType) !== 0) {
    m.setU32(pOutType >>> 0, 0)
    m.setU32(pOutGuid >>> 0, 0xffffffff)
    return
  }
  const pPlayerData = m.get(pUnit, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x1499)
  }
  m.setU32(pOutType >>> 0, m.get(pPlayerData, D2PlayerDataStrc.dwLeftSubtargetType))
  m.setU32(pOutGuid >>> 0, m.get(pPlayerData, D2PlayerDataStrc.dwLeftSubtargetGuid))
}

/**
 * `@va D2Common:0x6FD7F630` (`D2Common.#10878` `UNITS_GetPlayerSubtargetRight`, 102 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pOutType`, `[esp+0xC] = pOutGuid`, `ret 0xC`, void).
 */
export function UNITS_GetPlayerSubtargetRight113c(
  m: Memory113c,
  pUnit: number,
  pOutType: number,
  pOutGuid: number,
): void {
  if (pUnit >>> 0 === 0 || m.get(pUnit, D2UnitStrc.dwUnitType) !== 0) {
    m.setU32(pOutType >>> 0, 0)
    m.setU32(pOutGuid >>> 0, 0xffffffff)
    return
  }
  const pPlayerData = m.get(pUnit, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x1487)
  }
  m.setU32(pOutType >>> 0, m.get(pPlayerData, D2PlayerDataStrc.dwRightSubtargetType))
  m.setU32(pOutGuid >>> 0, m.get(pPlayerData, D2PlayerDataStrc.dwRightSubtargetGuid))
}

/**
 * `@va D2Common:0x6FD7F6A0` (`D2Common.#10265` `UNITS_PopPlayerSubtargetRight`, 123 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pOutType`, `[esp+0xC] = pOutGuid`, `ret 0xC`, void).
 */
export function UNITS_PopPlayerSubtargetRight113c(
  m: Memory113c,
  pUnit: number,
  pOutType: number,
  pOutGuid: number,
): void {
  if (pUnit >>> 0 === 0 || m.get(pUnit, D2UnitStrc.dwUnitType) !== 0) {
    m.setU32(pOutType >>> 0, 0)
    m.setU32(pOutGuid >>> 0, 0xffffffff)
    return
  }
  const pPlayerData = m.get(pUnit, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x1470)
  }
  m.setU32(pOutType >>> 0, m.get(pPlayerData, D2PlayerDataStrc.dwRightSubtargetType))
  m.setU32(pOutGuid >>> 0, m.get(pPlayerData, D2PlayerDataStrc.dwRightSubtargetGuid))
  m.set(pPlayerData, D2PlayerDataStrc.dwRightTargetVal, 0)
  m.set(pPlayerData, D2PlayerDataStrc.dwRightTargetGuid, 0xffffffff)
  m.set(pPlayerData, D2PlayerDataStrc.dwInteractItemGuid, 0xffffffff)
  m.set(pPlayerData, D2PlayerDataStrc.dwInteractType, 0)
}

/**
 * `@va D2Common:0x6FD7F720` (`D2Common.#10472` `UNITS_PopPlayerSubtargetLeft`, 123 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pOutType`, `[esp+0xC] = pOutGuid`, `ret 0xC`, void).
 */
export function UNITS_PopPlayerSubtargetLeft113c(
  m: Memory113c,
  pUnit: number,
  pOutType: number,
  pOutGuid: number,
): void {
  if (pUnit >>> 0 === 0 || m.get(pUnit, D2UnitStrc.dwUnitType) !== 0) {
    m.setU32(pOutType >>> 0, 0)
    m.setU32(pOutGuid >>> 0, 0xffffffff)
    return
  }
  const pPlayerData = m.get(pUnit, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x145a)
  }
  m.setU32(pOutType >>> 0, m.get(pPlayerData, D2PlayerDataStrc.dwLeftSubtargetType))
  m.setU32(pOutGuid >>> 0, m.get(pPlayerData, D2PlayerDataStrc.dwLeftSubtargetGuid))
  m.set(pPlayerData, D2PlayerDataStrc.dwLeftTargetVal, 0)
  m.set(pPlayerData, D2PlayerDataStrc.dwLeftTargetGuid, 0xffffffff)
  m.set(pPlayerData, D2PlayerDataStrc.dwInteractItemGuid, 0xffffffff)
  m.set(pPlayerData, D2PlayerDataStrc.dwInteractType, 0)
}

/**
 * `@va D2Common:0x6FD7F7A0` (`D2Common.#10289` `UNITS_GetPlayerTargetRight`, 96 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pOutVal`, `[esp+0xC] = pOutGuid`, `ret 0xC`, void).
 */
export function UNITS_GetPlayerTargetRight113c(
  m: Memory113c,
  pUnit: number,
  pOutVal: number,
  pOutGuid: number,
): void {
  if (pUnit >>> 0 === 0 || m.get(pUnit, D2UnitStrc.dwUnitType) !== 0) {
    m.setU32(pOutVal >>> 0, 0)
    m.setU32(pOutGuid >>> 0, 0xffffffff)
    return
  }
  const pPlayerData = m.get(pUnit, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x1449)
  }
  m.setU32(pOutVal >>> 0, m.get(pPlayerData, D2PlayerDataStrc.dwRightTargetVal))
  m.setU32(pOutGuid >>> 0, m.get(pPlayerData, D2PlayerDataStrc.dwRightTargetGuid))
}

/**
 * `@va D2Common:0x6FD7F800` (`D2Common.#10180` `UNITS_GetPlayerTargetLeft`, 96 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pOutVal`, `[esp+0xC] = pOutGuid`, `ret 0xC`, void).
 */
export function UNITS_GetPlayerTargetLeft113c(
  m: Memory113c,
  pUnit: number,
  pOutVal: number,
  pOutGuid: number,
): void {
  if (pUnit >>> 0 === 0 || m.get(pUnit, D2UnitStrc.dwUnitType) !== 0) {
    m.setU32(pOutVal >>> 0, 0)
    m.setU32(pOutGuid >>> 0, 0xffffffff)
    return
  }
  const pPlayerData = m.get(pUnit, D2UnitStrc.pUnitData)
  if (pPlayerData === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x1438)
  }
  m.setU32(pOutVal >>> 0, m.get(pPlayerData, D2PlayerDataStrc.dwLeftTargetVal))
  m.setU32(pOutGuid >>> 0, m.get(pPlayerData, D2PlayerDataStrc.dwLeftTargetGuid))
}

/**
 * `@va D2Common:0x6FD7F9B0` (`D2Common.#10009` `UNITS_SetOwner`, 112 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pOwner`, `ret 0x8`, void).
 */
export function UNITS_SetOwner113c(m: Memory113c, pUnit: number, pOwner: number): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xee7)
  }
  if (pOwner >>> 0 !== 0) {
    m.set(pUnit, D2UnitStrc.dwOwnerType, m.get(pOwner, D2UnitStrc.dwUnitType))
    m.set(pUnit, D2UnitStrc.dwOwnerId, m.get(pOwner, D2UnitStrc.dwUnitId))
    const dwFlags2 = m.get(pUnit, D2UnitStrc.dwFlags2)
    m.set(pUnit, D2UnitStrc.dwFlags2, (dwFlags2 | 0x20000) >>> 0)
  } else {
    const dwFlags2 = m.get(pUnit, D2UnitStrc.dwFlags2)
    m.set(pUnit, D2UnitStrc.dwOwnerType, 0)
    m.set(pUnit, D2UnitStrc.dwOwnerId, 0)
    m.set(pUnit, D2UnitStrc.dwFlags2, (dwFlags2 & 0xfffdffff) >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD7FC50` (`D2Common.#10067` `UNITS_SetPathRoomRefreshFlag`, 106 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = bSet`, `ret 0x8`, void).
 */
export function UNITS_SetPathRoomRefreshFlag113c(
  m: Memory113c,
  pUnit: number,
  bSet: number,
): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x9fe)
  }
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType) | 0
  if (unitType === 2 || (unitType > 3 && unitType <= 5)) {
    const pStaticPath = m.get(pUnit, D2UnitStrc.pPath)
    m.setU8((pStaticPath + 0x1d) >>> 0, bSet !== 0 ? 1 : 0)
  } else {
    const pDynamicPath = m.get(pUnit, D2UnitStrc.pPath)
    const dwFlags = m.get(pDynamicPath, D2DynamicPathStrc.dwFlags)
    m.set(
      pDynamicPath,
      D2DynamicPathStrc.dwFlags,
      (bSet !== 0 ? dwFlags | 2 : dwFlags & ~2) >>> 0,
    )
  }
}

/**
 * `@va D2Common:0x6FD7FCC0` (`D2Common.#10596` `UNITS_GetPathRoomRefreshFlag`, 73 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `number`).
 */
export function UNITS_GetPathRoomRefreshFlag113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x9ec)
  }
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  if (unitType === 2 || unitType === 4) {
    const pStaticPath = m.get(pUnit, D2UnitStrc.pPath)
    return m.u8((pStaticPath + 0x1d) >>> 0)
  }
  const pDynamicPath = m.get(pUnit, D2UnitStrc.pPath)
  return (m.get(pDynamicPath, D2DynamicPathStrc.dwFlags) & 2) >>> 0
}

/**
 * `@va D2Common:0x6FD7FE70` (`D2Common.#10481` `UNITS_ClearRoom`, 85 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4`, void).
 */
export function UNITS_ClearRoom113c(m: Memory113c, pUnit: number): void {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x87d)
  }
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType) | 0
  if (unitType === 2 || (unitType > 3 && unitType <= 5)) {
    const pStaticPath = m.get(pUnit, D2UnitStrc.pPath)
    m.setU32(pStaticPath >>> 0, 0)
  } else {
    const pDynamicPath = m.get(pUnit, D2UnitStrc.pPath)
    if (pDynamicPath !== 0) {
      m.set(pDynamicPath, D2DynamicPathStrc.pRoom, 0)
    }
  }
}

/**
 * `@va D2Common:0x6FD7FF30` (`D2Common.#10997` `UNITS_GetCollisionMask`, 168 bytes,
 * fastcall `ecx = pUnit`, `ret` -> `number`).
 */
export function UNITS_GetCollisionMask113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x80e)
  }
  const unitType = m.get(pUnit, D2UnitStrc.dwUnitType)
  if (unitType === 2) {
    const pObjectData = m.get(pUnit, D2UnitStrc.pUnitData)
    const pObjectTxt = m.get(pObjectData, D2ObjectDataStrc.pObjectTxt)
    if (m.get(pObjectTxt, D2ObjectsTxt.nOperateFn) !== 0) {
      if (m.get(pObjectTxt, D2ObjectsTxt.bBlocksVis) !== 0) {
        return 0x806
      }
      return m.get(pObjectTxt, D2ObjectsTxt.bBlocksLight) !== 0 ? 0x804 : 0x400
    }
    if ((m.get(pObjectTxt, D2ObjectsTxt.nSubClass) & 4) !== 0) {
      return 0x8000
    }
    return m.get(pObjectTxt, D2ObjectsTxt.bBlocksLight) !== 0 ? 0x404 : 0x400
  }
  if (unitType === 4) {
    return 0x200
  }
  if (unitType === 5) {
    return 0x1
  }
  const pDynamicPath = m.get(pUnit, D2UnitStrc.pPath)
  if (pDynamicPath === 0) {
    return 0xffff
  }
  return m.get(pDynamicPath, D2DynamicPathStrc.nFootprintCollisionMask)
}

/**
 * `@va D2Common:0x6FD80C70` (internal LTCG `UNITS_CanSwitchToModeDuringAnim`, 222 bytes,
 * custom LTCG `edx = dwUnitType`, `ecx = nMode`, `esi = dwClassId`, `[esp+4] = pUnit`, `ret 0x4` -> `number`).
 */
export function UNITS_CanSwitchToModeDuringAnim113c(
  m: Memory113c,
  dwUnitType: number,
  nMode: number,
  dwClassId: number,
  pUnit: number,
): number {
  let pEntry = 0
  if (dwUnitType === 0) {
    pEntry = (PLAYER_MODE_SWITCH_TABLE_VA_113C + imul32(nMode | 0, 20)) >>> 0
  } else if (dwUnitType === 1) {
    const classId = dwClassId | 0
    if (classId >= 0) {
      const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      if (classId < (m.u32((sgpt + DATATABLES_OFF_113C.nMonStatsTxtRecordCount) >>> 0) | 0)) {
        const pMonStats =
          (m.u32((sgpt + DATATABLES_OFF_113C.pMonStatsTxt) >>> 0) +
            imul32(classId, D2MonStatsTxt_SIZE)) >>>
          0
        if (pMonStats !== 0) {
          const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
          const flagBit = m.get(pMonStats, D2MonStatsTxt.nBitField2) & m.u32(pBitMasks)
          if (flagBit !== 0) {
            return nMode === 2 || nMode === 15 ? 1 : 0
          }
        }
      }
    }
    const tableBase =
      classId < 0x19a ? MONSTER_MODE_SWITCH_TABLE_LOW_VA_113C : MONSTER_MODE_SWITCH_TABLE_HIGH_VA_113C
    pEntry = (tableBase + imul32(nMode | 0, 20)) >>> 0
  } else {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xbd2)
  }

  if (m.u32((pEntry + 0x04) >>> 0) !== 0) {
    return 1
  }
  if (m.u32(pEntry) === 0) {
    return 0
  }
  const pSkill = SKILLS_GetUsedSkill113c(m, pUnit)
  if (pSkill === 0) {
    return 0
  }
  const dwSkillFlags = m.u32((pSkill + 0x0c) >>> 0)
  if ((dwSkillFlags & 0x01) === 0) {
    return 0
  }
  return (dwSkillFlags & 0x1000) === 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FD81EA0` (`D2Common.#10621` `UNITS_GetPlayerBaseToHit`, 236 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `number`).
 */
export function UNITS_GetPlayerBaseToHit113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0 || m.get(pUnit, D2UnitStrc.dwUnitType) !== 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x107f)
  }
  const pStatListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  let nToHit = 0
  if (
    pStatListEx !== 0 &&
    (m.u32((sgpt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0) > 0x13
  ) {
    const pIsc19 = (m.u32((sgpt + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0) + 0x180c) >>> 0
    if (pIsc19 !== 0) {
      nToHit = STATLIST_GetUnitStat113c(m, pUnit, 0x13, 0) | 0
    }
  }
  let nDex = 0
  if (
    pStatListEx !== 0 &&
    (m.u32((sgpt + DATATABLES_OFF_113C.nItemStatCostTxtRecordCount) >>> 0) | 0) > 2
  ) {
    const pIsc2 = (m.u32((sgpt + DATATABLES_OFF_113C.pItemStatCostTxt) >>> 0) + 0x288) >>> 0
    if (pIsc2 !== 0) {
      nDex = STATLIST_GetUnitStat113c(m, pUnit, 2, 0) | 0
    }
  }
  const base = (nToHit + imul32(nDex, 5) - 35) | 0
  const nClassId = m.get(pUnit, D2UnitStrc.dwClassId) | 0
  if (
    nClassId >= 0 &&
    nClassId < (m.u32((sgpt + DATATABLES_OFF_113C.nCharStatsTxtRecordCount) >>> 0) | 0)
  ) {
    const pCharStats =
      (m.u32((sgpt + DATATABLES_OFF_113C.pCharStatsTxt) >>> 0) +
        imul32(nClassId, D2CharStatsTxt_SIZE)) >>>
      0
    if (pCharStats !== 0) {
      return ((m.get(pCharStats, D2CharStatsTxt.nToHitFactor) | 0) + base) >>> 0
    }
  }
  return base >>> 0
}

/**
 * `@va D2Common:0x6FD842D0` (`D2Common.#10315` `UNITS_GetGfxStateFlagsPtr`, 90 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `number`).
 */
export function UNITS_GetGfxStateFlagsPtr113c(m: Memory113c, pUnit: number): number {
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x99)
  }
  const pStatListEx = m.get(pUnit, D2UnitStrc.pStatListEx)
  if (pStatListEx === 0) {
    return 0
  }
  const dwFlags = m.get(pStatListEx, D2StatListExStrc.dwFlags) | 0
  if (dwFlags >= 0) {
    return 0
  }
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const nStates = m.u32((sgpt + DATATABLES_OFF_113C.nStatesTxtRecordCount) >>> 0)
  const pStateFlags = m.get(pStatListEx, D2StatListExStrc.pStateFlags)
  const nDwords = ((nStates + 0x1f) >>> 0) >>> 5
  return (pStateFlags + (nDwords << 2)) >>> 0
}

/**
 * `@va D2Common:0x6FD8E980` (`D2Common.#10688` `DATATBLS_GetObjectsTxtRecord`, 71 bytes,
 * stdcall `[esp+4] = nObjectId`, `ret 0x4` -> `D2ObjectsTxt*`).
 */
export function DATATBLS_GetObjectsTxtRecord113c(m: Memory113c, nObjectId: number): number {
  const id = nObjectId | 0
  const count = m.u32(SGPT_OBJECTS_TXT_COUNT_VA_113C) | 0
  if (id >= count) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xdd)
  }
  if (id < 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xde)
  }
  const pObjectsTxt = m.u32(SGPT_OBJECTS_TXT_PTR_VA_113C)
  return (pObjectsTxt + imul32(id, 0x1c0)) >>> 0
}

/**
 * `@va D2Common:0x6FD5D540` (`PATH_ResetDynamicPathRoomAndCoordsInline`, 53 bytes,
 * usercall `esi = pDynamicPath`, `ret` -> `void`).
 */
export function PATH_ResetDynamicPathRoomAndCoordsInline113c(
  m: Memory113c,
  pDynamicPath: number,
): void {
  const d0 = m.u32(0x6fddd458)
  const d1 = m.u32(0x6fddd45c)
  m.setU32((pDynamicPath + 0x00) >>> 0, d0)
  m.setU32((pDynamicPath + 0x08) >>> 0, d0)
  const pRoom = m.u32((pDynamicPath + 0x1c) >>> 0)
  m.setU32((pDynamicPath + 0x04) >>> 0, d1)
  m.setU32((pDynamicPath + 0x0c) >>> 0, d1)
  m.setU32((pDynamicPath + 0x28) >>> 0, 0)
  if (pRoom !== 0) {
    m.setU32((pDynamicPath + 0x20) >>> 0, pRoom)
    const pUnit = m.u32((pDynamicPath + 0x30) >>> 0)
    UNITROOM_RemoveUnitFromRoom113c(m, pUnit)
    m.setU32((pDynamicPath + 0x34) >>> 0, (m.u32((pDynamicPath + 0x34) >>> 0) | 2) >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD6A3D0` (`D2Common.#11086` `UNITS_GetSpawnedMonsterOrSkillSummonInfo`, 333 bytes,
 * stdcall `[esp+4] = pUnit, [esp+8] = bIsMonsterSpawn, [esp+0xC] = nSkillId, [esp+0x10] = a4, [esp+0x14] = pOutMode, [esp+0x18] = pOutX, [esp+0x1C] = pOutY`,
 * `ret 0x1C` -> `number`).
 */
export function UNITS_GetSpawnedMonsterOrSkillSummonInfo113c(
  m: Memory113c,
  pUnit: number,
  bIsMonsterSpawn: number,
  nSkillId: number,
  _a4: number,
  pOutMode: number,
  pOutX: number,
  pOutY: number,
): number {
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  if (bIsMonsterSpawn !== 0 && pUnit !== 0 && m.u32(pUnit) === UNIT_MONSTER) {
    const classId = m.u32((pUnit + 0x04) >>> 0) | 0
    if (classId < 0 || classId >= (m.u32((sgpt + 0xa80) >>> 0) | 0)) {
      return -1
    }
    const pMonStats = (m.u32((sgpt + 0xa78) >>> 0) + imul32(classId, 0x1a8)) >>> 0
    if (pMonStats === 0) {
      return -1
    }
    const wSpawnId = (m.u16((pMonStats + 0x20) >>> 0) << 16) >> 16
    if (pOutX !== 0) {
      const uX = UNITS_GetX113c(m, pUnit)
      m.setU32(pOutX, (uX + ((m.u8((pMonStats + 0x22) >>> 0) << 24) >> 24)) >>> 0)
    }
    if (pOutY !== 0) {
      const uY = UNITS_GetY113c(m, pUnit)
      m.setU32(pOutY, (uY + ((m.u8((pMonStats + 0x23) >>> 0) << 24) >> 24)) >>> 0)
    }
    if (pOutMode !== 0) {
      const mode = (m.u8((pMonStats + 0x24) >>> 0) << 24) >> 24
      m.setU32(pOutMode, mode < 0 || mode >= 16 ? 1 : mode >>> 0)
    }
    return wSpawnId | 0
  }
  const skillId = nSkillId | 0
  if (skillId < 0 || skillId >= (m.u32((sgpt + 0xba0) >>> 0) | 0)) {
    return -1
  }
  const pSkillsTxt = (m.u32((sgpt + 0xb98) >>> 0) + imul32(skillId, 0x23c)) >>> 0
  if (pSkillsTxt === 0) {
    return -1
  }
  const wSummon = (m.u16((pSkillsTxt + 0xbc) >>> 0) << 16) >> 16
  if (wSummon < 0 || wSummon >= (m.u32((sgpt + 0xa80) >>> 0) | 0)) {
    return -1
  }
  if (pOutX !== 0) {
    m.setU32(pOutX, UNITS_GetX113c(m, pUnit) >>> 0)
  }
  if (pOutY !== 0) {
    m.setU32(pOutY, UNITS_GetY113c(m, pUnit) >>> 0)
  }
  if (pOutMode !== 0) {
    const mode = (m.u8((pSkillsTxt + 0xbf) >>> 0) << 24) >> 24
    m.setU32(pOutMode, mode < 0 || mode >= 16 ? 1 : mode >>> 0)
  }
  return wSummon | 0
}

/**
 * `@va D2Common:0x6FD80DC0` (`D2Common.#10862` `UNITS_SetUnitUpdateFlags`, 82 bytes,
 * stdcall `[esp+4] = pUnit, [esp+8] = bSet`, `ret 0x8` -> `void`).
 */
export function UNITS_SetUnitUpdateFlags113c(m: Memory113c, pUnit: number, bSet: number): void {
  // 0x6FD80DCA: `test edi, edi; je` -> refresh only when bSet (callee asserts on pUnit == 0).
  if (bSet !== 0) {
    UNITROOM_RefreshUnit113c(m, pUnit)
  }
  // 0x6FD80DD4/0x6FD80DEF: `test esi, esi; je` -> no flag write, `ret 8` (no assert in this function).
  if (pUnit >>> 0 === 0) return
  const flags2 = m.u32((pUnit + 0xc8) >>> 0)
  if (bSet === 0) {
    m.setU32((pUnit + 0xc8) >>> 0, (flags2 & ~1) >>> 0)
    return
  }
  if (m.u32(pUnit) !== UNIT_PLAYER) {
    m.setU32((pUnit + 0xc8) >>> 0, (flags2 | 1) >>> 0)
    return
  }
  m.setU32((pUnit + 0xc8) >>> 0, (flags2 | 3) >>> 0)
}

/**
 * `@va D2Common:0x6FD823E0` (`UNITS_GetDiminishingStatBonusInline`, 124 bytes,
 * usercall `eax = nTableIdx`, `[esp+4] = pUnit`, `ret 0x4` -> `number`).
 */
export function UNITS_GetDiminishingStatBonusInline113c(
  m: Memory113c,
  nTableIdx: number,
  pUnit: number,
): number {
  const entryAddr = (0x6fde4608 + imul32(nTableIdx | 0, 12)) >>> 0
  const statId = m.u32((entryAddr + 8) >>> 0) | 0
  const val = STATLIST_GetUnitStatWithLayer113c(m, pUnit, statId, 0) | 0
  if ((m.u32(entryAddr) | 0) === 1 && val !== 0) {
    const cap = m.u32((entryAddr + 4) >>> 0) | 0
    // 0x6FD82446..0x6FD8244D: `imul eax, ecx; add esi, ecx; cdq; idiv esi` -> #DE when `cap + val == 0`.
    return sdiv32(imul32(cap, val), (cap + val) | 0) >>> 0
  }
  return val >>> 0
}

/**
 * `nStatesTxtRecordCount (+0xC4)` rounded up to dwords exactly as 0x6FD840AF..0x6FD840C1 /
 * 0x6FD8417B..0x6FD8418D: `add eax, 0x1F; cdq; and edx, 0x1F; add eax, edx; sar eax, 5` (32-bit wrap,
 * signed division truncating toward zero).
 */
function stateMaskDwordCount113c(m: Memory113c, sgpt: number): number {
  const biased = (m.u32((sgpt + 0xc4) >>> 0) + 0x1f) | 0
  return (biased + ((biased >> 31) & 0x1f)) >> 5
}

/**
 * `@va D2Common:0x6FD84080` (`UNITS_TransferStateMaskToRemoved`, 202 bytes,
 * usercall `ecx = pMaskArray`, `[esp+4] = pUnit`, `ret 0x4` -> `void`).
 */
export function UNITS_TransferStateMaskToRemoved113c(
  m: Memory113c,
  pMaskArray: number,
  pUnit: number,
): void {
  if (pUnit >>> 0 === 0) return
  const pStatList = m.u32((pUnit + 0x5c) >>> 0)
  if (pStatList === 0 || (m.u32((pStatList + 0x10) >>> 0) & 0x80000000) === 0) return

  const pActive = m.u32((pStatList + 0x58) >>> 0)
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const nDwords = stateMaskDwordCount113c(m, sgpt)
  const pRemoved = (pActive + imul32(nDwords, 4)) >>> 0
  if (pActive === 0 || pRemoved === 0) return

  for (let i = 0; i < nDwords; i++) {
    const mask = m.u32((pMaskArray + i * 4) >>> 0)
    const activeVal = m.u32((pActive + i * 4) >>> 0)
    const removedVal = m.u32((pRemoved + i * 4) >>> 0)
    m.setU32((pRemoved + i * 4) >>> 0, (removedVal | (activeVal & mask)) >>> 0)
    m.setU32((pActive + i * 4) >>> 0, (activeVal & ~mask) >>> 0)
  }
  UNITROOM_RefreshUnit113c(m, pUnit)
}

/**
 * `@va D2Common:0x6FD84150` (`D2Common.#10735` `STATES_UpdateGfxStateFlagsByMask`, 376 bytes,
 * stdcall `[esp+4] = pUnit, [esp+8] = bIsBossOrTown`, `ret 0x8` -> `void`).
 */
export function STATES_UpdateGfxStateFlagsByMask113c(
  m: Memory113c,
  pUnit: number,
  bIsBossOrTown: number,
): void {
  // 0x6FD84155: `test ebp, ebp; je 0x6FD842C4` -> `pop ebp; ret 8` (no assert).
  if (pUnit >>> 0 === 0) return
  const pStatList = m.u32((pUnit + 0x5c) >>> 0)
  if (pStatList === 0 || (m.u32((pStatList + 0x10) >>> 0) & 0x80000000) === 0) return

  const pActive = m.u32((pStatList + 0x58) >>> 0)
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const nDwords = stateMaskDwordCount113c(m, sgpt)
  const pRemoved = (pActive + imul32(nDwords, 4)) >>> 0
  if (pActive === 0 || pRemoved === 0) return

  let maskOff: number
  if (bIsBossOrTown !== 0) {
    maskOff = 0x108
  } else if (m.u32(pUnit) === UNIT_PLAYER) {
    maskOff = 0x100
  } else {
    maskOff = 0x104
  }
  const pMaskArray = m.u32((sgpt + maskOff) >>> 0)

  for (let i = 0; i < nDwords; i++) {
    const mask = m.u32((pMaskArray + i * 4) >>> 0)
    const activeVal = m.u32((pActive + i * 4) >>> 0)
    const removedVal = m.u32((pRemoved + i * 4) >>> 0)
    m.setU32((pRemoved + i * 4) >>> 0, (removedVal | (activeVal & ~mask)) >>> 0)
    m.setU32((pActive + i * 4) >>> 0, (activeVal & mask) >>> 0)
  }
  UNITROOM_RefreshUnit113c(m, pUnit)
}

function getStatListUnitAlignment113c(m: Memory113c, pUnit: number): number {
  if (pUnit === 0 || m.u32((pUnit + 0x5c) >>> 0) === 0) {
    return 0
  }
  const uType = m.u32(pUnit) | 0
  if (uType < 0 || uType > 1) {
    return 2
  }
  const pSubList = STATLIST_GetStatListFromUnitAndState113c(m, pUnit, 0x69)
  if (pSubList === 0) {
    return 0
  }
  // 0x6FD89218..0x6FD89225: `[esp+4] = 0; eax = 0xAC; jmp 0x6FD88BD0` -> total stat (0x6FD88A80, full stats
  // when extended) with layer 0, i.e. exactly 0x6FD891A0 (`STATLIST_GetTotalStatValueLayer0`), not the
  // base-stat getter 0x6FD89140.
  return STATLIST_GetTotalStatValueLayer0_113c(m, pSubList, 0xac) | 0
}

/**
 * `@va D2Common:0x6FDB6900` (`D2Common.#10457` `UNITROOM_SortUnitListByY`, 20 bytes,
 * stdcall `[esp+4] = pUnit, [esp+8] = pRoom`, `ret 0x8` -> `number`).
 */
export function UNITROOM_SortUnitListByY113c(m: Memory113c, pUnit: number, pRoom: number): number {
  // 0x6FDB6800 (callee, `push 1` = bAssertIfPresent): 0x6FDB6805 `test edi, edi; jne` else `push 0x42`;
  // 0x6FDB682A `test esi, esi; jne` else `push 0x43`; both -> assert thunk 0x6FD5921C + exit(-1).
  if (pUnit >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x42)
  }
  if (pRoom >>> 0 === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x43)
  }
  const x = UNITS_GetX113c(m, pUnit) | 0
  const y = UNITS_GetY113c(m, pUnit) | 0
  const roomX = m.u32((pRoom + 0x4c) >>> 0) | 0
  const roomW = m.u32((pRoom + 0x54) >>> 0) | 0
  const roomY = m.u32((pRoom + 0x50) >>> 0) | 0
  const roomH = m.u32((pRoom + 0x58) >>> 0) | 0
  if (x < roomX || x >= roomX + roomW || y < roomY || y >= roomY + roomH) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x2e)
  }
  let cur = m.u32((pRoom + 0x74) >>> 0)
  while (cur !== 0) {
    if (cur === pUnit >>> 0) {
      throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x36)
    }
    cur = m.u32((cur + 0xe8) >>> 0)
  }
  const prevFirst = m.u32((pRoom + 0x74) >>> 0)
  m.setU32((pUnit + 0xe8) >>> 0, prevFirst)
  m.setU32((pRoom + 0x74) >>> 0, pUnit >>> 0)
  UNITROOM_RefreshUnit113c(m, pUnit)
  const uType = m.u32(pUnit) | 0
  if (
    uType === UNIT_PLAYER ||
    (uType === UNIT_MONSTER && getStatListUnitAlignment113c(m, pUnit) === 2)
  ) {
    m.setU32((pRoom + 0x28) >>> 0, (m.u32((pRoom + 0x28) >>> 0) + 1) >>> 0)
  }
  return 1
}

/**
 * `@va D2Common:0x6FDD4D30` (`D2Common.#10665` `UNITS_AreUnitsAligned`, 98 bytes,
 * stdcall `[esp+4] = pUnit1, [esp+8] = pUnit2`, `ret 0x8` -> `number`).
 */
export function UNITS_AreUnitsAligned113c(m: Memory113c, pUnit1: number, pUnit2: number): number {
  if (pUnit1 >>> 0 === 0 || pUnit2 >>> 0 === 0) {
    return 0
  }
  if (pUnit1 >>> 0 === pUnit2 >>> 0) {
    return 1
  }
  const a2 = getStatListUnitAlignment113c(m, pUnit2)
  const a1 = getStatListUnitAlignment113c(m, pUnit1)
  if ((a1 === 0 && a2 === 0) || (a1 === 2 && a2 === 2)) {
    return 1
  }
  return 0
}

const COLSN_CPP_FILE_113C = '..\\Source\\D2Common\\COLLISION\\Colsn.cpp'
const MON_TO_PLR_MODE_TABLE_VA_113C = 0x6fde30d8

/**
 * `@va D2Common:0x6FD7F100` (`UNITS_StepAnimSeqFrame`, 85 bytes,
 * custom LTCG `esi = pUnit`, `[esp+4] = dwPrevFrameFp8`, `ret 0x4` -> `BOOL`).
 */
export function UNITS_StepAnimSeqFrame113c(
  m: Memory113c,
  pUnit: number,
  dwPrevFrameFp8: number,
): number {
  const u = pUnit >>> 0
  const oldSeqMode = m.u32((u + 0x40) >>> 0)
  const pSeq = m.u32((u + 0x30) >>> 0)
  const currFp8 = m.u32((u + 0x38) >>> 0) | 0
  const prevFp8 = dwPrevFrameFp8 | 0

  let modeOut = 0
  let frameOut = 0
  let eventOut = 0
  if (pSeq !== 0) {
    const currIdx = currFp8 >> 8
    const recAddr = (pSeq + imul32(currIdx, 6)) >>> 0
    modeOut = m.u8((recAddr + 2) >>> 0)
    frameOut = m.u8((recAddr + 3) >>> 0)
    m.u8((recAddr + 4) >>> 0)
    if (currFp8 === prevFp8) {
      eventOut = m.u8((recAddr + 5) >>> 0)
    } else {
      const startIdx = ((prevFp8 >> 8) + 1) | 0
      if (startIdx <= currIdx) {
        let pEv = (pSeq + imul32(startIdx, 6) + 5) >>> 0
        for (let rem = (currIdx - startIdx + 1) | 0; rem !== 0; rem = (rem - 1) | 0) {
          const ev = m.u8(pEv)
          if (ev !== 0) {
            eventOut = ev
          }
          pEv = (pEv + 6) >>> 0
        }
      }
    }
  }

  m.setU32((u + 0x44) >>> 0, (frameOut << 8) >>> 0)
  const changed = modeOut !== oldSeqMode ? 1 : 0
  m.setU32((u + 0x40) >>> 0, modeOut >>> 0)
  m.setU8((u + 0x4e) >>> 0, eventOut & 0xff)
  return changed
}

/**
 * `@va D2Common:0x6FD80B80` (`UNITS_IsCastAnimMode`, 72 bytes,
 * custom LTCG `eax = dwUnitType`, `ecx = nMode`, `edx = pUnit`, plain `ret` -> `BOOL`).
 */
export function UNITS_IsCastAnimMode113c(
  m: Memory113c,
  dwUnitType: number,
  nMode: number,
  pUnit: number,
): number {
  const uType = dwUnitType | 0
  const mode = nMode | 0
  if (uType === 0) {
    if (mode === 0x0a) return 1
    if (mode !== 0x12) return 0
    const u = pUnit >>> 0
    if (u === 0) return 0
    const pSkill = SKILLS_GetUsedSkill113c(m, u)
    if (pSkill === 0) return 0
    const pSkillTxtPtr = m.u32(pSkill)
    const wSkillId = (m.u16(pSkillTxtPtr) << 16) >> 16
    const pSkillRec = DATATBLS_GetSkillsTxtRecordInline113c(m, wSkillId)
    if (pSkillRec === 0) return 0
    return m.u8((pSkillRec + 0x12) >>> 0) === 0x0a ? 1 : 0
  }
  if (uType === 1) {
    return mode === 7 ? 1 : 0
  }
  return 0
}

/**
 * `@va D2Common:0x6FD80F80` (`D2Common.#10589` `UNITS_GetUnitSizeX`, 98 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `number`).
 */
export function UNITS_GetUnitSizeX113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) return 0
  const uType = m.u32(u) >>> 0
  switch (uType) {
    case 0:
      return 2
    case 1: {
      const pMonStats2 = DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c(
        m,
        m.u32((u + 0x04) >>> 0),
      )
      if (pMonStats2 === 0) return 0
      return (m.u8((pMonStats2 + 0x08) >>> 0) << 24) >> 24
    }
    case 2: {
      const pObjData = m.u32((u + 0x14) >>> 0)
      const pObjTxt = m.u32(pObjData)
      return m.u32((pObjTxt + 0xd0) >>> 0) | 0
    }
    case 3: {
      const pMisTxt = DATATBLS_GetMissilesTxtRecordInline113c(m, m.u32((u + 0x04) >>> 0))
      if (pMisTxt === 0) return 0
      return m.u8((pMisTxt + 0x18a) >>> 0)
    }
    case 4:
      return 1
    default:
      return 0
  }
}

/**
 * `@va D2Common:0x6FDA01E0` (`D2Common.#10350` `UNITS_GetTransformGfx`, 374 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pOutIsPlayerTransform`, `[esp+0xC] = pOutClassId`,
 * `[esp+0x10] = pInOutMode`, `[esp+0x14] = a5`, `[esp+0x18] = a6`, `ret 0x18`, void).
 */
export function UNITS_GetTransformGfx113c(
  m: Memory113c,
  pUnit: number,
  pOutIsPlayerTransform: number,
  pOutClassId: number,
  pInOutMode: number,
  _a5 = 0,
  _a6 = 0,
): void {
  const u = pUnit >>> 0
  if (u === 0) return
  if (((m.u32((u + 0xc8) >>> 0) >>> 3) & 1) === 0) return
  let sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const nTransformStates = (m.u16((sgpt + 0x180) >>> 0) << 16) >> 16
  if (nTransformStates <= 0) return
  const pTransformStates = m.u32((sgpt + 0x17c) >>> 0)
  const uType = m.u32(u) | 0

  for (let i = 0; i < nTransformStates; i++) {
    sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    const nState = (m.u16((pTransformStates + i * 2) >>> 0) << 16) >> 16
    if (uType < 0 || (uType > 1 && uType !== 3)) continue
    const nStatesCount = m.u32((sgpt + 0xc4) >>> 0) | 0
    if (nState < 0 || nState >= nStatesCount) continue
    const pStatListEx = m.u32((u + 0x5c) >>> 0)
    if (pStatListEx === 0 || (m.u32((pStatListEx + 0x10) >>> 0) | 0) >= 0) continue
    const pStateFlags = m.u32((pStatListEx + 0x58) >>> 0)
    const wordVal = m.u32((pStateFlags + ((nState >> 5) << 2)) >>> 0)
    const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
    const bitMask = m.u32((pBitMasks + ((nState & 0x1f) << 2)) >>> 0)
    if ((wordVal & bitMask) === 0) continue
    const pStatesTxt = m.u32((sgpt + 0xbc) >>> 0)
    const pStateRec = (pStatesTxt + imul32(nState, 0x3c)) >>> 0
    if (pStateRec === 0) continue
    const nGfxType = m.u8((pStateRec + 0x2d) >>> 0)
    if (nGfxType === 1) {
      m.setU32(pOutIsPlayerTransform >>> 0, 1)
      const nGfxClass = (m.u16((pStateRec + 0x2e) >>> 0) << 16) >> 16
      m.setU32(pOutClassId >>> 0, nGfxClass >>> 0)
      if (m.u32(u) === 0) {
        const curMode = m.u32(pInOutMode >>> 0) | 0
        const mappedMode = SKILLS_MapPlayerAnimModeToMonsterMode113c(m, curMode, nGfxClass)
        m.setU32(pInOutMode >>> 0, mappedMode >>> 0)
      }
      return
    }
    if (nGfxType === 2) {
      m.setU32(pOutIsPlayerTransform >>> 0, 0)
      const nGfxClass = (m.u16((pStateRec + 0x2e) >>> 0) << 16) >> 16
      m.setU32(pOutClassId >>> 0, nGfxClass >>> 0)
      if (m.u32(u) === 1) {
        const curMode = m.u32(pInOutMode >>> 0) >>> 0
        if (nGfxClass === 6 && curMode === 4) {
          m.setU32(pInOutMode >>> 0, 0x0c)
          return
        }
        const mappedMode = m.u32((MON_TO_PLR_MODE_TABLE_VA_113C + (curMode << 2)) >>> 0)
        m.setU32(pInOutMode >>> 0, mappedMode)
      }
      return
    }
  }
}

/**
 * `@va D2Common:0x6FD62450` (`D2Common.#10933` `UNITS_AreInAdjacentRooms`, 131 bytes,
 * stdcall `[esp+4] = pUnit1`, `[esp+8] = pUnit2`, `ret 0x8` -> `BOOL`).
 */
export function UNITS_AreInAdjacentRooms113c(m: Memory113c, pUnit1: number, pUnit2: number): number {
  const u1 = pUnit1 >>> 0
  if (u1 === 0) {
    throw new D2CommonAssertError(COLSN_CPP_FILE_113C, 0x18)
  }
  const u2 = pUnit2 >>> 0
  if (u2 === 0) {
    throw new D2CommonAssertError(COLSN_CPP_FILE_113C, 0x19)
  }
  const pRoom2 = UNITS_GetRoom113c(m, u2)
  if (pRoom2 === 0) return 0
  const pRoom1 = UNITS_GetRoom113c(m, u1)
  if (pRoom1 === 0) return 0
  const nRoomsNear = m.u32((pRoom2 + 0x24) >>> 0) | 0
  const ppRoomsNear = m.u32(pRoom2)
  if (nRoomsNear <= 0) return 0
  for (let i = 0; i < nRoomsNear; i++) {
    if (m.u32((ppRoomsNear + i * 4) >>> 0) === pRoom1) {
      return 1
    }
  }
  return 0
}

/**
 * `@va D2Common:0x6FD80BD0` (`UNITS_IsAttackAnimMode`, 158 bytes,
 * custom LTCG `edx = dwUnitType`, `ecx = nMode`, `[esp+4] = pUnit`, `[esp+8] = dwClassId`, `ret 0x8` -> `number`).
 */
export function UNITS_IsAttackAnimMode113c(
  m: Memory113c,
  dwUnitType: number,
  nMode: number,
  pUnit: number,
  dwClassId: number,
): number {
  const uType = dwUnitType | 0
  const mode = nMode | 0
  let pEntry = 0
  if (uType === 0) {
    pEntry = (PLAYER_MODE_SWITCH_TABLE_VA_113C + imul32(mode, 20)) >>> 0
  } else if (uType === 1) {
    const tableBase =
      (dwClassId | 0) < 0x19a
        ? MONSTER_MODE_SWITCH_TABLE_LOW_VA_113C
        : MONSTER_MODE_SWITCH_TABLE_HIGH_VA_113C
    pEntry = (tableBase + imul32(mode, 20)) >>> 0
  } else {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xbef)
  }

  if (m.u32((pEntry + 0x0c) >>> 0) !== 0) {
    return 1
  }
  if (m.u32((pEntry + 0x08) >>> 0) === 0) {
    return 0
  }
  const pSkill = SKILLS_GetUsedSkill113c(m, pUnit)
  if (pSkill === 0) {
    return 0
  }
  const pSkillTxtPtr = m.u32(pSkill)
  const wSkillId = (m.u16(pSkillTxtPtr) << 16) >> 16
  const pSkillRec = DATATBLS_GetSkillsTxtRecordInline113c(m, wSkillId)
  const flagsByte = m.u8((pSkillRec + 0x06) >>> 0)
  const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
  return (flagsByte & m.u32((pBitMasks + 0x0c) >>> 0)) >>> 0
}

/**
 * `@va D2Common:0x6FD80EE0` (`D2Common.#10904` `UNITS_GetUnitSizeY`, 129 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `number`).
 */
export function UNITS_GetUnitSizeY113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  if (u === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x74b)
  }
  const uType = m.u32(u) >>> 0
  switch (uType) {
    case 0:
      return 2
    case 1: {
      const pMonStats2 = DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c(
        m,
        m.u32((u + 0x04) >>> 0),
      )
      if (pMonStats2 === 0) return 0
      return (m.u8((pMonStats2 + 0x09) >>> 0) << 24) >> 24
    }
    case 2: {
      const pObjData = m.u32((u + 0x14) >>> 0)
      const pObjTxt = m.u32(pObjData)
      return m.u32((pObjTxt + 0xd4) >>> 0) | 0
    }
    case 3: {
      const pMisTxt = DATATBLS_GetMissilesTxtRecordInline113c(m, m.u32((u + 0x04) >>> 0))
      if (pMisTxt === 0) return 0
      return m.u8((pMisTxt + 0x18a) >>> 0)
    }
    case 4:
      return 1
    default:
      return 0
  }
}

/**
 * `@va D2Common:0x6FD83990` (`D2Common.#10124` `UNITS_FreeUnit`, 108 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4`, void).
 */
export function UNITS_FreeUnit113c(m: Memory113c, pUnit: number): void {
  const u = pUnit >>> 0
  if (u === 0) return
  const pStatListEx = m.u32((u + 0x5c) >>> 0)
  if (pStatListEx !== 0) {
    if ((m.u32((pStatListEx + 0x10) >>> 0) | 0) < 0) {
      STATLIST_FreeStatListImpl113c(m, pStatListEx)
    }
    m.setU32((u + 0x5c) >>> 0, 0)
  }
  SKILLS_FreeSkillList113c(m, u)
  if (m.u32(u) === 1) {
    m.u32((u + 0x08) >>> 0)
    const pMonsterData = m.u32((u + 0x14) >>> 0)
    ;(m as { free?: (p: number) => void }).free?.(pMonsterData)
  }
  m.u32((u + 0x08) >>> 0)
  m.setU32(u, 6)
  m.setU32((u + 0x0c) >>> 0, 0xffffffff)
  ;(m as { free?: (p: number) => void }).free?.(u)
}

/**
 * `@va D2Common:0x6FDB6630` (`UNITROOM_ValidateUnitInRoom`, 204 bytes,
 * custom LTCG `esi = pRoom`, `edi = pUnit`, `[esp+4] = bAssertIfPresent`, `ret 0x4` -> `BOOL`).
 */
export function UNITROOM_ValidateUnitInRoom113c(
  m: Memory113c,
  pRoom: number,
  pUnit: number,
  bAssertIfPresent: number,
): number {
  const room = pRoom >>> 0
  const u = pUnit >>> 0
  if (room !== 0) {
    for (let i = 0; i < 8; i++) {
      m.u32((room + 0x4c + i * 4) >>> 0)
    }
  }
  const uType = m.u32(u) | 0
  const pPath = m.u32((u + 0x2c) >>> 0)
  let x: number
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    x = m.u32((pPath + 0x0c) >>> 0) | 0
  } else {
    x = pPath !== 0 ? m.u16((pPath + 0x02) >>> 0) : 0
  }
  let y: number
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    y = m.u32((pPath + 0x10) >>> 0) | 0
  } else {
    y = pPath !== 0 ? m.u16((pPath + 0x06) >>> 0) : 0
  }

  if (room === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x2e)
  }
  const roomX = m.u32((room + 0x4c) >>> 0) | 0
  if (x < roomX) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x2e)
  }
  const roomW = m.u32((room + 0x54) >>> 0) | 0
  if (x >= ((roomX + roomW) | 0)) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x2e)
  }
  const roomY = m.u32((room + 0x50) >>> 0) | 0
  if (y < roomY) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x2e)
  }
  const roomH = m.u32((room + 0x58) >>> 0) | 0
  if (y >= ((roomY + roomH) | 0)) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x2e)
  }

  let cur = m.u32((room + 0x74) >>> 0)
  while (cur !== 0) {
    if (cur === u) {
      if ((bAssertIfPresent | 0) !== 0) {
        throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x36)
      }
      return 0
    }
    cur = m.u32((cur + 0xe8) >>> 0)
  }
  return 1
}

/**
 * `@va D2Common:0x6FDB68A0` (`D2Common.#10650` `UNITROOM_ClearUnitRoom`, 93 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4`, void).
 */
export function UNITROOM_ClearUnitRoom113c(m: Memory113c, pUnit: number): void {
  const u = pUnit >>> 0
  if (u === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xcc)
  }
  const uType = m.u32(u) | 0
  const pPath = m.u32((u + 0x2c) >>> 0)
  if (uType === 2 || (uType > 3 && uType <= 5)) {
    if (m.u32(pPath) !== 0) {
      UNITROOM_RemoveUnitFromRoom113c(m, u)
    }
    m.setU32(pPath, 0)
    return
  }
  PATH_ResetDynamicPathRoomAndCoordsInline113c(m, pPath)
}

function unitsCanDualWieldMem113c(m: Memory113c, pUnit: number): number {
  const ptr = pUnit >>> 0
  const uType = ptr !== 0 ? m.u32(ptr) : 6
  const classId = ptr !== 0 ? m.u32((ptr + 0x04) >>> 0) | 0 : -1
  if (uType === 0) {
    return classId === 4 || classId === 6 ? 1 : 0
  }
  if (uType === 1) {
    if (classId < 0) return 0
    const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    if (classId >= (m.u32((sgpt + 0xa80) >>> 0) | 0)) return 0
    return classId >= 0x1a1 && classId <= 0x1a2 ? 1 : 0
  }
  return 0
}

function hasAttachedItemExMem113c(m: Memory113c, pItem: number): boolean {
  const item = pItem >>> 0
  if (item === 0) return false
  const ex = m.u32((item + 0x5c) >>> 0)
  if (ex === 0) return false
  const parent = m.u32((ex + 0x34) >>> 0)
  if (parent === 0) return false
  if ((m.u32((parent + 0x10) >>> 0) | 0) >= 0) return false
  return m.u32((parent + 0x44) >>> 0) !== 0
}

/**
 * `@va D2Common:0x6FD82EF0` (`D2Common.#10932` `UNITS_SyncDualWieldWeaponStatLists`, 303 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = bCheckSkill`, `ret 0x8`, void).
 */
export function UNITS_SyncDualWieldWeaponStatLists113c(
  m: Memory113c,
  pUnit: number,
  bCheckSkill: number,
): void {
  const ebx = pUnit >>> 0
  if (unitsCanDualWieldMem113c(m, ebx) === 0) return
  const edi = ITEMS_GetActiveWeaponForAttack113c(m, ebx, bCheckSkill)
  const esi = INVENTORY_GetCompositWeaponMem113c(m, m.u32((ebx + 0x60) >>> 0))
  if (edi === 0) {
    if (hasAttachedItemExMem113c(m, esi)) {
      STATLIST_SetWeaponStatListActive113c(m, ebx, esi, 1)
    }
    return
  }
  if (edi === esi) {
    const other = INVENTORY_GetSecondaryWeapon113c(m, m.u32((ebx + 0x60) >>> 0))
    if (hasAttachedItemExMem113c(m, esi)) {
      STATLIST_SetWeaponStatListActive113c(m, ebx, esi, 1)
    }
    if (hasAttachedItemExMem113c(m, other)) {
      STATLIST_SetWeaponStatListActive113c(m, ebx, other, 0)
    }
    return
  }
  if (hasAttachedItemExMem113c(m, edi)) {
    STATLIST_SetWeaponStatListActive113c(m, ebx, edi, 1)
  }
  if (hasAttachedItemExMem113c(m, esi)) {
    STATLIST_SetWeaponStatListActive113c(m, ebx, esi, 0)
  }
}

const DIST_TABLE_6FDDABC0: ReadonlyArray<number> = [
  -1, -1, -1, 0, 2, 4, 6, 8,
  -1, -1, 0, 1, 2, 4, 6, 8,
  -1, 0, 0, 2, 3, 5, 7, 8,
  0, 1, 2, 2, 4, 5, 7, 8,
  2, 2, 3, 4, 5, 6, 7, 9,
  4, 4, 5, 5, 6, 7, 8, 9,
  6, 6, 7, 7, 7, 8, 10, 10,
  8, 8, 8, 8, 9, 9, 10, 11,
]

/**
 * `@va D2Common:0x6FDCFCD0` (`D2Common.#10407` `UNITS_GetDistanceToOtherUnit`, 361 bytes,
 * stdcall `[esp+4] = pUnit1`, `[esp+8] = pUnit2`, `ret 0x8` -> `number`).
 */
export function UNITS_GetDistanceToOtherUnit113c(
  m: Memory113c,
  pUnit1: number,
  pUnit2: number,
): number {
  const u1 = pUnit1 >>> 0
  const u2 = pUnit2 >>> 0
  const esi = m.u32(u1) | 0
  const ediPath = m.u32((u1 + 0x2c) >>> 0)
  const x1 =
    esi === 2 || (esi > 3 && esi <= 5)
      ? m.u32((ediPath + 0x0c) >>> 0) | 0
      : ediPath !== 0
        ? m.u16((ediPath + 0x02) >>> 0)
        : 0

  const ebp = m.u32(u2) | 0
  const edxPath = m.u32((u2 + 0x2c) >>> 0)
  const x2 =
    ebp === 2 || (ebp > 3 && ebp <= 5)
      ? m.u32((edxPath + 0x0c) >>> 0) | 0
      : edxPath !== 0
        ? m.u16((edxPath + 0x02) >>> 0)
        : 0

  let dx = (x1 - x2) | 0
  if (dx < 0) dx = -dx | 0

  const y1 =
    esi === 2 || (esi > 3 && esi <= 5)
      ? m.u32((ediPath + 0x10) >>> 0) | 0
      : ediPath !== 0
        ? m.u16((ediPath + 0x06) >>> 0)
        : 0

  const y2 =
    ebp === 2 || (ebp > 3 && ebp <= 5)
      ? m.u32((edxPath + 0x10) >>> 0) | 0
      : edxPath !== 0
        ? m.u16((edxPath + 0x06) >>> 0)
        : 0

  let dy = (y1 - y2) | 0
  if (dy < 0) dy = -dy | 0

  const sz1 = UNITS_GetUnitSizeX113c(m, u1) | 0
  const sz2 = UNITS_GetUnitSizeX113c(m, u2) | 0
  if (dx < 8 && dy < 8 && sz1 < 4 && sz2 < 4) {
    let d = DIST_TABLE_6FDDABC0[dy * 8 + dx]!
    if (d < 0) return 0
    if (sz1 === 3 || sz2 === 3) {
      d = (d - 1) | 0
    }
    if (d < 0) {
      d = 0
    }
    if (sz1 <= 1 || sz2 <= 1) {
      return ((d + 1) | 0) >>> 0
    }
    return d >>> 0
  }

  const sx1a = UNITS_GetUnitSizeX113c(m, u1) >>> 0
  const sx2a = UNITS_GetUnitSizeX113c(m, u2) >>> 0
  let halfX = ((sx1a >>> 1) + (sx2a >>> 1)) | 0
  if (halfX < 0) halfX = -halfX | 0
  dx = (dx - halfX) | 0

  const sx1b = UNITS_GetUnitSizeX113c(m, u1) >>> 0
  const sx2b = UNITS_GetUnitSizeX113c(m, u2) >>> 0
  let halfY = ((sx1b >>> 1) + (sx2b >>> 1)) | 0
  if (halfY < 0) halfY = -halfY | 0
  dy = (dy - halfY) | 0

  if (dx < 0) dx = 0
  if (dy < 0) dy = 0
  return (dx > dy ? (dy + dx * 2) | 0 : (dx + dy * 2) | 0) >>> 0
}

const START_FRAME_TABLE_6FDE4480: ReadonlyArray<number> = [
  1, 1, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  2, 2, 0, 0, 0, 0, 0,
  2, 2, 0, 0, 0, 0, 0,
  2, 2, 0, 0, 0, 0, 0,
  2, 2, 0, 0, 0, 0, 0,
  2, 2, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0,
]

function resolveTransformGfxMem113c(
  m: Memory113c,
  pUnit: number,
  bIsMonGfx: number,
  classId: number,
  mode: number,
): { bIsMonGfx: number; classId: number; mode: number } {
  const u = pUnit >>> 0
  if (u === 0) return { bIsMonGfx, classId, mode }
  if (((m.u32((u + 0xc8) >>> 0) >>> 3) & 1) === 0) return { bIsMonGfx, classId, mode }
  let sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const nTransformStates = (m.u16((sgpt + 0x180) >>> 0) << 16) >> 16
  if (nTransformStates <= 0) return { bIsMonGfx, classId, mode }
  const pTransformStates = m.u32((sgpt + 0x17c) >>> 0)
  const uType = m.u32(u) | 0

  for (let i = 0; i < nTransformStates; i++) {
    sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    const nState = (m.u16((pTransformStates + i * 2) >>> 0) << 16) >> 16
    if (uType < 0 || (uType > 1 && uType !== 3)) continue
    const nStatesCount = m.u32((sgpt + 0xc4) >>> 0) | 0
    if (nState < 0 || nState >= nStatesCount) continue
    const pStatListEx = m.u32((u + 0x5c) >>> 0)
    if (pStatListEx === 0 || (m.u32((pStatListEx + 0x10) >>> 0) | 0) >= 0) continue
    const pStateFlags = m.u32((pStatListEx + 0x58) >>> 0)
    const wordVal = m.u32((pStateFlags + ((nState >> 5) << 2)) >>> 0)
    const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
    const bitMask = m.u32((pBitMasks + ((nState & 0x1f) << 2)) >>> 0)
    if ((wordVal & bitMask) === 0) continue
    const pStatesTxt = m.u32((sgpt + 0xbc) >>> 0)
    const pStateRec = (pStatesTxt + imul32(nState, 0x3c)) >>> 0
    if (pStateRec === 0) continue
    const nGfxType = m.u8((pStateRec + 0x2d) >>> 0)
    if (nGfxType === 1) {
      bIsMonGfx = 1
      classId = (m.u16((pStateRec + 0x2e) >>> 0) << 16) >> 16
      if (m.u32(u) === 0) {
        mode = SKILLS_MapPlayerAnimModeToMonsterMode113c(m, mode, classId) | 0
      }
      return { bIsMonGfx, classId, mode }
    }
    if (nGfxType === 2) {
      bIsMonGfx = 0
      classId = (m.u16((pStateRec + 0x2e) >>> 0) << 16) >> 16
      if (m.u32(u) === 1) {
        const curMode = mode >>> 0
        if (classId === 6 && curMode === 4) {
          mode = 0x0c
          return { bIsMonGfx, classId, mode }
        }
        mode = m.u32((MON_TO_PLR_MODE_TABLE_VA_113C + (curMode << 2)) >>> 0) | 0
      }
      return { bIsMonGfx, classId, mode }
    }
  }
  return { bIsMonGfx, classId, mode }
}

/**
 * `@va D2Common:0x6FD82220` (`D2Common.#10031` `UNITS_GetAnimStartFrame`, 238 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `number`).
 */
export function UNITS_GetAnimStartFrame113c(m: Memory113c, pUnit: number): number {
  const esi = pUnit >>> 0
  const initMonGfx = esi !== 0 ? m.u32(esi) : 6
  const initClassId = esi !== 0 ? m.u32((esi + 0x04) >>> 0) | 0 : -1
  const initMode = esi !== 0 ? m.u32((esi + 0x10) >>> 0) | 0 : 0
  const { bIsMonGfx, classId, mode } = resolveTransformGfxMem113c(
    m,
    esi,
    initMonGfx,
    initClassId,
    initMode,
  )
  if (bIsMonGfx !== 0) return 0
  const rel = (mode - 7) >>> 0
  if (rel > 9) return 0
  if (mode === 15 || mode === 16) {
    if (unitsCanDualWieldMem113c(m, esi) === 0) return 0
    const w = ITEMS_GetActiveWeaponForAttack113c(m, esi, 1)
    const wclass = w !== 0 ? ITEMS_GetWeaponClassCodeIdx113c(m, w) & 0xffff : 0
    return START_FRAME_TABLE_6FDE4480[imul32(wclass, 7) + (classId | 0)]! >>> 0
  }
  if (mode === 7 || mode === 8) {
    const w = ITEMS_GetActiveWeaponForAttack113c(m, esi, 1)
    const wclass = w !== 0 ? ITEMS_GetWeaponClassCodeIdx113c(m, w) & 0xffff : 0
    return START_FRAME_TABLE_6FDE4480[imul32(wclass, 7) + (classId | 0)]! >>> 0
  }
  return 0
}

/**
 * `@va D2Common:0x6FD814A0` (`D2Common.#10839` `UNITS_HasCollisionBetweenUnits`, 306 bytes,
 * stdcall `[esp+4] = pUnit1`, `[esp+8] = pUnit2`, `[esp+0xC] = wMask`, `ret 0xC` -> `BOOL`).
 */
export function UNITS_HasCollisionBetweenUnits113c(
  m: Memory113c,
  pUnit1: number,
  pUnit2: number,
  wMask: number,
): number {
  const esi = pUnit1 >>> 0
  if (esi === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x1290)
  }
  const edi = pUnit2 >>> 0
  if (edi === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x1291)
  }
  const pRoom = UNITS_GetRoom113c(m, esi)
  if (pRoom === 0) return 0

  const t1 = m.u32(esi) | 0
  const p1 = m.u32((esi + 0x2c) >>> 0)
  const x1 =
    t1 === 2 || (t1 > 3 && t1 <= 5)
      ? m.u32((p1 + 0x0c) >>> 0) | 0
      : p1 !== 0
        ? m.u16((p1 + 0x02) >>> 0)
        : 0
  const y1 =
    t1 === 2 || (t1 > 3 && t1 <= 5)
      ? m.u32((p1 + 0x10) >>> 0) | 0
      : p1 !== 0
        ? m.u16((p1 + 0x06) >>> 0)
        : 0
  const sz1 = UNITS_GetUnitSizeX113c(m, esi)

  const t2 = m.u32(edi) | 0
  const p2 = m.u32((edi + 0x2c) >>> 0)
  const x2 =
    t2 === 2 || (t2 > 3 && t2 <= 5)
      ? m.u32((p2 + 0x0c) >>> 0) | 0
      : p2 !== 0
        ? m.u16((p2 + 0x02) >>> 0)
        : 0
  const y2 =
    t2 === 2 || (t2 > 3 && t2 <= 5)
      ? m.u32((p2 + 0x10) >>> 0) | 0
      : p2 !== 0
        ? m.u16((p2 + 0x06) >>> 0)
        : 0
  const sz2 = UNITS_GetUnitSizeX113c(m, edi)

  return COLLISION_RayTraceBetweenSizedPoints113c(m, x2, x1, sz2, y1, sz1, y2, pRoom, wMask)
}

/**
 * `@va D2Common:0x6FD81850` (`D2Common.#10032` `UNITS_SetCollisionMaskAtCoords`, 102 bytes,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pRoom`, `[esp+0xC] = nX`, `[esp+0x10] = nY`, `ret 0x10`, void).
 */
export function UNITS_SetCollisionMaskAtCoords113c(
  m: Memory113c,
  pUnit: number,
  pRoom: number,
  nX: number,
  nY: number,
): void {
  const esi = pUnit >>> 0
  if (esi === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x851)
  }
  const szX = UNITS_GetUnitSizeX113c(m, esi)
  const szY = UNITS_GetUnitSizeY113c(m, esi)
  if (szX !== 0 && szY !== 0) {
    const mask = UNITS_GetCollisionMask113c(m, esi)
    COLLISION_SetMaskWithSizeXY113c(m, pRoom, nX, nY, szX, szY, mask)
  }
}

/**
 * `@va D2Common:0x6FD819A0` (`D2Common.#10793` `UNITS_IsUnitMovingBool`, 19 bytes,
 * stdcall `[esp+4] = pUnit`, `ret 0x4` -> `0 | 1`).
 */
export function UNITS_IsUnitMovingBool113c(m: Memory113c, pUnit: number): number {
  return UNITS_IsInMovingMode113c(m, pUnit) !== 0 ? 1 : 0
}

/**
 * Value-returning twin of `0x6FDA01E0` (`UNITS_GetTransformGfx113c`) for callers that pass C stack
 * locals (`&nUnitType`, `&nClass`, `&nMode`) so no heap/arena writes occur under `StrictMem`.
 */
export function unitsGetTransformGfxValues113c(
  m: Memory113c,
  pUnit: number,
  initType: number,
  initClass: number,
  initMode: number,
): [number, number, number] {
  let outType = initType >>> 0
  let outClass = initClass >>> 0
  let outMode = initMode >>> 0
  const u = pUnit >>> 0
  if (u === 0) return [outType, outClass, outMode]
  if (((m.u32((u + 0xc8) >>> 0) >>> 3) & 1) === 0) return [outType, outClass, outMode]
  let sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const nTransformStates = (m.u16((sgpt + 0x180) >>> 0) << 16) >> 16
  if (nTransformStates <= 0) return [outType, outClass, outMode]
  const pTransformStates = m.u32((sgpt + 0x17c) >>> 0)
  const uType = m.u32(u) | 0

  for (let i = 0; i < nTransformStates; i++) {
    sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    const nState = (m.u16((pTransformStates + i * 2) >>> 0) << 16) >> 16
    if (uType < 0 || (uType > 1 && uType !== 3)) continue
    const nStatesCount = m.u32((sgpt + 0xc4) >>> 0) | 0
    if (nState < 0 || nState >= nStatesCount) continue
    const pStatListEx = m.u32((u + 0x5c) >>> 0)
    if (pStatListEx === 0 || (m.u32((pStatListEx + 0x10) >>> 0) | 0) >= 0) continue
    const pStateFlags = m.u32((pStatListEx + 0x58) >>> 0)
    const wordVal = m.u32((pStateFlags + ((nState >> 5) << 2)) >>> 0)
    const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
    const bitMask = m.u32((pBitMasks + ((nState & 0x1f) << 2)) >>> 0)
    if ((wordVal & bitMask) === 0) continue
    const pStatesTxt = m.u32((sgpt + 0xbc) >>> 0)
    const pStateRec = (pStatesTxt + imul32(nState, 0x3c)) >>> 0
    if (pStateRec === 0) continue
    const nGfxType = m.u8((pStateRec + 0x2d) >>> 0)
    if (nGfxType === 1) {
      outType = 1
      const nGfxClass = (m.u16((pStateRec + 0x2e) >>> 0) << 16) >> 16
      outClass = nGfxClass >>> 0
      if (m.u32(u) === 0) {
        const mappedMode = SKILLS_MapPlayerAnimModeToMonsterMode113c(m, outMode | 0, nGfxClass)
        outMode = mappedMode >>> 0
      }
      return [outType, outClass, outMode]
    }
    if (nGfxType === 2) {
      outType = 0
      const nGfxClass = (m.u16((pStateRec + 0x2e) >>> 0) << 16) >> 16
      outClass = nGfxClass >>> 0
      if (m.u32(u) === 1) {
        if (nGfxClass === 6 && outMode === 4) {
          outMode = 0x0c
          return [outType, outClass, outMode]
        }
        outMode = m.u32((MON_TO_PLR_MODE_TABLE_VA_113C + (outMode << 2)) >>> 0)
      }
      return [outType, outClass, outMode]
    }
  }
  return [outType, outClass, outMode]
}

/**
 * `@va D2Common:0x6FD9D760` (`D2Common.#10735` `UNITS_TestCollisionBetweenUnitsWithDoors`,
 * custom reg `ecx = pRoom`, `edx = nX1`, stack `[esp+4] = nY1`, `[esp+8] = nX2`,
 * `[esp+0xC] = nY2`, `[esp+0x10] = nUnitSize`, `[esp+0x14] = dwPattern`, `[esp+0x18] = dwMoveMask`,
 * `ret 0x18`, `retMask = 0xFFFF`).
 */
export function UNITS_TestCollisionBetweenUnitsWithDoors113c(
  m: Memory113c,
  pRoom: number,
  nX1: number,
  nY1: number,
  nX2: number,
  nY2: number,
  nUnitSize: number,
  dwPattern: number,
  dwMoveMask: number,
): number {
  COLLISION_ResetMaskWithPatternSimple113c(m, pRoom, nX1, nY1, nUnitSize, dwPattern)
  const hit =
    COLLISION_CheckMaskWithPattern1_113c(m, pRoom, nX2, nY2, nUnitSize, dwMoveMask) & 0xffff
  if ((hit & 5) !== 0) {
    COLLISION_SetMaskWithPattern113c(m, pRoom, nX1, nY1, nUnitSize, dwPattern)
    return hit
  }
  COLLISION_SetMaskWithPattern113c(m, pRoom, nX2, nY2, nUnitSize, dwPattern)
  return hit
}

/**
 * `@va D2Common:0x6FDCFCD0` (`D2Common.#10407` `UNITS_GetMeleeRange` / `UNITS_GetDistanceToOtherUnit`).
 */
export const UNITS_GetMeleeRange113c = UNITS_GetDistanceToOtherUnit113c

/**
 * `@va D2Common:0x6FD815E0` (`D2Common.#10686` `UNITS_FindFreeCoords`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nX2`, `[esp+0xC] = nY2`, `[esp+0x10] = dwMask`, `ret 0x10` -> `BOOL`).
 */
export function UNITS_FindFreeCoords113c(
  m: Memory113c,
  pUnit: number,
  nX2: number,
  nY2: number,
  dwMask: number,
): number {
  const edi = pUnit >>> 0
  if (edi === 0) return 0
  const ebp = UNITS_GetRoom113c(m, edi)
  if (ebp === 0) return 0
  const t1 = m.u32(edi) | 0
  const p1 = m.u32((edi + 0x2c) >>> 0)
  const ebx =
    t1 === 2 || (t1 > 3 && t1 <= 5)
      ? m.u32((p1 + 0x0c) >>> 0) | 0
      : p1 !== 0
        ? m.u16((p1 + 0x02) >>> 0)
        : 0
  const t2 = m.u32(edi) | 0
  const p2 = m.u32((edi + 0x2c) >>> 0)
  const esi =
    t2 === 2 || (t2 > 3 && t2 <= 5)
      ? m.u32((p2 + 0x10) >>> 0) | 0
      : p2 !== 0
        ? m.u16((p2 + 0x06) >>> 0)
        : 0
  const sz = UNITS_GetUnitSizeX113c(m, edi)
  return COLLISION_RayTraceBetweenSizedPoints113c(m, nX2, ebx, 2, esi, sz, nY2, ebp, dwMask)
}

/**
 * `@va D2Common:0x6FD818C0` (`D2Common.#10408` `UNITS_SetTargetUnitForDynamicUnit`,
 * stdcall `[esp+4] = pUnit`, `ret 4`, void).
 */
export function UNITS_SetTargetUnitForDynamicUnitEx113c(m: Memory113c, pUnit: number): void {
  const esi = pUnit >>> 0
  const t1 = m.u32(esi) | 0
  const p1 = m.u32((esi + 0x2c) >>> 0)
  const ebx =
    t1 === 2 || (t1 > 3 && t1 <= 5)
      ? m.u32((p1 + 0x10) >>> 0) | 0
      : p1 !== 0
        ? m.u16((p1 + 0x06) >>> 0)
        : 0
  const t2 = m.u32(esi) | 0
  const p2 = m.u32((esi + 0x2c) >>> 0)
  const edi =
    t2 === 2 || (t2 > 3 && t2 <= 5)
      ? m.u32((p2 + 0x0c) >>> 0) | 0
      : p2 !== 0
        ? m.u16((p2 + 0x02) >>> 0)
        : 0
  const mask = UNITS_GetCollisionMask113c(m, esi)
  const szY = UNITS_GetUnitSizeY113c(m, esi)
  const szX = UNITS_GetUnitSizeX113c(m, esi)
  const pRoom = UNITS_GetRoom113c(m, esi)
  COLLISION_ResetMaskWithSizeXY113c(m, pRoom, edi, ebx, szX, szY, mask)
}

/** `.data` 14-entry `(nSeqWeaponClassIdx, nWeaponClassId)` table at `0x6FDECFA0`. */
export const D2COMMON_SEQ_WCLASS_TABLE_VA_113C = 0x6fdecfa0

/** `.data` player sequence table pointers at `0x6FDECF40`. */
export const D2COMMON_PLAYER_SEQ_TABLE_PTRS_VA_113C = 0x6fdecf40

/**
 * `@va D2Common:0x6FD7E790` (internal LTCG `ANIMSEQ_GetPlayerSeqWeaponClassIdx`,
 * custom reg `esi = pUnit`, `ret` -> `0..13 | -1`).
 */
export function ANIMSEQ_GetPlayerSeqWeaponClassIdx113c(m: Memory113c, pUnit: number): number {
  const esi = pUnit >>> 0
  let uType = m.u32(esi)
  let uClass = m.u32((esi + 0x04) >>> 0)
  const pInv = m.u32((esi + 0x60) >>> 0)
  let uMode =
    (uType === 0 || uType === 1) && m.u32((esi + 0x30) >>> 0) !== 0
      ? m.u32((esi + 0x40) >>> 0)
      : m.u32((esi + 0x10) >>> 0)
  if (((m.u32((esi + 0xc8) >>> 0) >>> 3) & 1) !== 0) {
    const [t, c, md] = unitsGetTransformGfxValues113c(m, esi, uType, uClass, uMode)
    uType = t
    uClass = c
    uMode = md
  }
  const { wcid } = compositGetWeaponClassCodeAndId113c(m, esi, uType, uClass, uMode, pInv)
  const id = wcid >>> 0
  for (let i = 0; i < 14; i++) {
    if (id === m.u32((D2COMMON_SEQ_WCLASS_TABLE_VA_113C + i * 8 + 4) >>> 0)) {
      return m.u32((D2COMMON_SEQ_WCLASS_TABLE_VA_113C + i * 8) >>> 0) | 0
    }
  }
  return -1
}

/**
 * `@va D2Common:0x6FD7E840` (internal LTCG `ANIMSEQ_GetUnitSeqLookupEntry`,
 * custom reg `eax = pUnit`, `ret` -> `D2SeqLookupStrc* | 0`).
 */
export function ANIMSEQ_GetUnitSeqLookupEntry113c(m: Memory113c, pUnit: number): number {
  const esi = pUnit >>> 0
  if (esi === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x65c)
  }
  const pSkills = m.u32((esi + 0xa8) >>> 0)
  if (pSkills === 0) return 0
  const pUsedSkill = m.u32((pSkills + 0x10) >>> 0)
  if (pUsedSkill === 0) return 0
  const seqId = SKILLS_GetUnitSkillRequiredOrMonLevel113c(m, esi, pUsedSkill) | 0
  if (seqId <= 0) return 0
  const uType = m.u32(esi)
  if (uType === 0) {
    const base = m.u32((D2COMMON_PLAYER_SEQ_TABLE_PTRS_VA_113C + seqId * 4) >>> 0)
    const idx = ANIMSEQ_GetPlayerSeqWeaponClassIdx113c(m, esi) | 0
    if (idx === -1) {
      throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x533)
    }
    return (base + idx * 12) >>> 0
  }
  if (uType === 1) {
    const pMonStats = DATATBLS_GetMonStatsTxtRecordInline113c(m, m.u32((esi + 0x04) >>> 0))
    if (pMonStats === 0) return 0
    return DATATBLS_GetMonSeqTableRecord113c(m, seqId)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD7E900` (`D2Common.#10577` `ANIMSEQ_GetUnitSeqFrameDataField8`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `int32`).
 */
export function ANIMSEQ_GetUnitSeqFrameDataField8_113c(m: Memory113c, pUnit: number): number {
  const pEntry = ANIMSEQ_GetUnitSeqLookupEntry113c(m, pUnit)
  if (pEntry === 0) return 0
  return m.u32((pEntry + 0x08) >>> 0)
}

/**
 * `@va D2Common:0x6FD7E920` (`D2Common.#10034` `ANIMSEQ_GetUnitSeqFrameCountFp8`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `int32`).
 */
export function ANIMSEQ_GetUnitSeqFrameCountFp8_113c(m: Memory113c, pUnit: number): number {
  const pEntry = ANIMSEQ_GetUnitSeqLookupEntry113c(m, pUnit)
  if (pEntry === 0) return 0
  return (m.u32((pEntry + 0x04) >>> 0) << 8) >>> 0
}

/**
 * `@va D2Common:0x6FD7E940` (`D2Common.#10421` `ANIMSEQ_GetUnitSeqRecordPtr`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `D2AnimSeqTxt* | 0`).
 */
export function ANIMSEQ_GetUnitSeqRecordPtr113c(m: Memory113c, pUnit: number): number {
  const pEntry = ANIMSEQ_GetUnitSeqLookupEntry113c(m, pUnit)
  if (pEntry === 0) return 0
  return m.u32(pEntry)
}

/**
 * `@va D2Common:0x6FDCFBD0` (`D2Common.#10522` `UNITS_GetApproximateDistance`,
 * stdcall `[esp+4] = pUnit1`, `[esp+8] = pUnit2`, `ret 8` -> `int32`).
 */
export function UNITS_GetApproximateDistance113c(
  m: Memory113c,
  pUnit1: number,
  pUnit2: number,
): number {
  const esi = pUnit1 >>> 0
  const ebp = pUnit2 >>> 0

  const t1 = m.u32(esi) | 0
  const p1 = m.u32((esi + 0x2c) >>> 0)
  const x1 =
    t1 === 2 || (t1 > 3 && t1 <= 5)
      ? m.u32((p1 + 0x0c) >>> 0) | 0
      : p1 !== 0
        ? m.u16((p1 + 0x02) >>> 0)
        : 0
  const t2 = m.u32(ebp) | 0
  const p2 = m.u32((ebp + 0x2c) >>> 0)
  const x2 =
    t2 === 2 || (t2 > 3 && t2 <= 5)
      ? m.u32((p2 + 0x0c) >>> 0) | 0
      : p2 !== 0
        ? m.u16((p2 + 0x02) >>> 0)
        : 0
  const dx = Math.abs((x1 - x2) | 0) | 0

  const t1b = m.u32(esi) | 0
  const p1b = m.u32((esi + 0x2c) >>> 0)
  const y1 =
    t1b === 2 || (t1b > 3 && t1b <= 5)
      ? m.u32((p1b + 0x10) >>> 0) | 0
      : p1b !== 0
        ? m.u16((p1b + 0x06) >>> 0)
        : 0
  const t2b = m.u32(ebp) | 0
  const p2b = m.u32((ebp + 0x2c) >>> 0)
  const y2 =
    t2b === 2 || (t2b > 3 && t2b <= 5)
      ? m.u32((p2b + 0x10) >>> 0) | 0
      : p2b !== 0
        ? m.u16((p2b + 0x06) >>> 0)
        : 0
  const dy = Math.abs((y1 - y2) | 0) | 0

  const sz2 = UNITS_GetUnitSizeX113c(m, ebp) | 0
  const sz1 = UNITS_GetUnitSizeX113c(m, esi) | 0
  const half2 = ((sz2 - (sz2 >> 31)) >> 1) | 0
  const half1 = ((sz1 - (sz1 >> 31)) >> 1) | 0
  const adj = (-half2 - half1) | 0

  let bx = (dx + adj) | 0
  if (bx < 0) bx = 0
  let si = (dy + adj) | 0
  if (si < 0) si = 0

  const sum = bx > si ? (si + bx * 2) | 0 : (bx + si * 2) | 0
  return (((sum - (sum >> 31)) >> 1) | 0) >>> 0
}

/**
 * `@va D2Common:0x6FD82820` (`D2Common.#10099` `UNITS_InitSkillAnimSequence`,
 * stdcall `[esp+4] = pUnit`, `ret 4`, void).
 */
export function UNITS_InitSkillAnimSequence113c(m: Memory113c, pUnit: number): void {
  const esi = pUnit >>> 0
  if (esi === 0) return
  const pEntry1 = ANIMSEQ_GetUnitSeqLookupEntry113c(m, esi)
  const pSeq = pEntry1 !== 0 ? m.u32(pEntry1) : 0
  m.setU32((esi + 0x30) >>> 0, pSeq)
  if (pSeq === 0) return
  const pEntry2 = ANIMSEQ_GetUnitSeqLookupEntry113c(m, esi)
  const fcFp8 = pEntry2 !== 0 ? (m.u32((pEntry2 + 0x04) >>> 0) << 8) >>> 0 : 0
  m.setU32((esi + 0x34) >>> 0, fcFp8)
  m.setU32((esi + 0x38) >>> 0, 0)
  m.setU32((esi + 0x3c) >>> 0, 0x100)
  const pEntry3 = ANIMSEQ_GetUnitSeqLookupEntry113c(m, esi)
  const f8 = pEntry3 !== 0 ? m.u32((pEntry3 + 0x08) >>> 0) : 0
  m.setU32((esi + 0x48) >>> 0, (f8 << 8) >>> 0)
  UNITS_StepAnimSeqFrame113c(m, esi, 0)
  m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) | 0x4000) >>> 0)
}

/**
 * `@va D2Common:0x6FD82770` (`D2Common.#10797` `UNITS_GetAnimOrSeqEventAtFrame`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nFrameIdx`, `ret 8` -> `int32`).
 */
export function UNITS_GetAnimOrSeqEventAtFrame113c(
  m: Memory113c,
  pUnit: number,
  nFrameIdx: number,
): number {
  const eax = pUnit >>> 0
  if (eax === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0xdcc)
  }
  const ecx = nFrameIdx | 0
  if (ecx >= 0x90) return 0
  const edx = m.u32(eax)
  if (
    (edx === 0 && m.u32((eax + 0x10) >>> 0) === 0x12) ||
    ((edx === 0 || edx === 1) && m.u32((eax + 0x10) >>> 0) === 0x0e)
  ) {
    const pEntry = ANIMSEQ_GetUnitSeqLookupEntry113c(m, eax)
    const pSeqRec = pEntry !== 0 ? m.u32(pEntry) : 0
    if (pSeqRec === 0) return 0
    const rec = (pSeqRec + imul32(ecx, 6)) >>> 0
    m.u8((rec + 2) >>> 0)
    m.u8((rec + 3) >>> 0)
    m.u8((rec + 4) >>> 0)
    return m.u8((rec + 5) >>> 0)
  }
  const pFrameData = m.u32((eax + 0x50) >>> 0)
  return m.u8((pFrameData + ecx + 0x10) >>> 0)
}

/**
 * `@va D2Common:0x6FD825C0` (`D2Common.#11133` `UNITS_GetEquippedWeaponAdder`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `int32`).
 */
export function UNITS_GetEquippedWeaponAdder113c(m: Memory113c, pUnit: number): number {
  const esi = pUnit >>> 0
  if (esi === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x11be)
  }
  const uType = m.u32(esi) | 0
  if (uType === 0) {
    const pWeapon = INVENTORY_GetActiveWeaponMem113c(m, m.u32((esi + 0x60) >>> 0))
    if (pWeapon === 0) return 0
    return ITEMS_GetQuiverType113c(m, pWeapon) & 0xff
  }
  if (uType !== 1) return 0
  const pMonStats2 = DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c(
    m,
    m.u32((esi + 0x04) >>> 0),
  )
  if (pMonStats2 === 0) return 0
  const rng = m.u8((pMonStats2 + 0x0e) >>> 0)
  if (rng !== 0xff) return rng
  const pInv = m.u32((esi + 0x60) >>> 0)
  let t = m.u32(esi)
  let c = m.u32((esi + 0x04) >>> 0)
  let md =
    (t === 0 || t === 1) && m.u32((esi + 0x30) >>> 0) !== 0
      ? m.u32((esi + 0x40) >>> 0)
      : m.u32((esi + 0x10) >>> 0)
  if (((m.u32((esi + 0xc8) >>> 0) >>> 3) & 1) !== 0) {
    const [t2, c2, md2] = unitsGetTransformGfxValues113c(m, esi, t, c, md)
    t = t2
    c = c2
    md = md2
  }
  const { wcid } = compositGetWeaponClassCodeAndId113c(m, esi, t, c, md, pInv)
  return wcid === 6 ? 2 : 0
}

/**
 * `@va D2Common:0x6FD826C0` (`D2Common.#11138` `UNITS_CanUnitMeleeAttackTarget`,
 * stdcall `[esp+4] = pUnit1`, `[esp+8] = pUnit2`, `[esp+0xC] = nAdder`, `ret 0xC` -> `BOOL`).
 */
export function UNITS_CanUnitMeleeAttackTarget113c(
  m: Memory113c,
  pUnit1: number,
  pUnit2: number,
  nAdder: number,
): number {
  const edi = pUnit2 >>> 0
  if (edi === 0) return 0
  const esi = pUnit1 >>> 0
  if (esi === 0) return 0
  if (m.u32(edi) === 1) {
    let baseId = MONSTERS_GetBaseIdFromMonsterUnitInline113c(m, edi) | 0
    if (baseId >= 0) {
      const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      if (baseId >= (m.u32((sgpt + 0xa80) >>> 0) | 0)) {
        baseId = -1
      }
    } else {
      baseId = -1
    }
    if (baseId === 0x102 || baseId === 0x105) {
      const dist = UNITS_GetDistanceToOtherUnit113c(m, esi, edi) | 0
      const adder = UNITS_GetEquippedWeaponAdder113c(m, esi) | 0
      if (((adder + 8) | 0) > dist) {
        return 1
      }
    }
  }
  const maxDist = (UNITS_GetEquippedWeaponAdder113c(m, esi) + (nAdder | 0) + 1) | 0
  const dist = UNITS_GetDistanceToOtherUnit113c(m, esi, edi) | 0
  if (dist <= 0) return 1
  if (maxDist < dist) return 0
  return UNITS_HasCollisionBetweenUnits113c(m, esi, edi, 0x0804) === 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FD819C0` (`D2Common.#10324` `UNITS_TestCollisionBetweenUnits`,
 * stdcall `[esp+4] = pUnit1`, `[esp+8] = pUnit2`, `[esp+0xC] = dwMask`, `ret 0xC` -> `BOOL`).
 */
export function UNITS_TestCollisionBetweenUnits113c(
  m: Memory113c,
  pUnit1: number,
  pUnit2: number,
  dwMask: number,
): number {
  const u1 = pUnit1 >>> 0
  if (u1 === 0) return 0
  const u2 = pUnit2 >>> 0
  if (u2 === 0) return 0
  const pRoom = UNITS_GetRoom113c(m, u1)
  if (pRoom === 0) return 0

  const t1 = m.u32(u1) | 0
  const p1 = m.u32((u1 + 0x2c) >>> 0)
  const x1 =
    t1 === 2 || (t1 > 3 && t1 <= 5)
      ? m.u32((p1 + 0x0c) >>> 0) | 0
      : p1 !== 0
        ? m.u16((p1 + 0x02) >>> 0)
        : 0
  const y1 =
    t1 === 2 || (t1 > 3 && t1 <= 5)
      ? m.u32((p1 + 0x10) >>> 0) | 0
      : p1 !== 0
        ? m.u16((p1 + 0x06) >>> 0)
        : 0

  const t2 = m.u32(u2) | 0
  const p2 = m.u32((u2 + 0x2c) >>> 0)
  const x2 =
    t2 === 2 || (t2 > 3 && t2 <= 5)
      ? m.u32((p2 + 0x0c) >>> 0) | 0
      : p2 !== 0
        ? m.u16((p2 + 0x02) >>> 0)
        : 0
  const y2 =
    t2 === 2 || (t2 > 3 && t2 <= 5)
      ? m.u32((p2 + 0x10) >>> 0) | 0
      : p2 !== 0
        ? m.u16((p2 + 0x06) >>> 0)
        : 0

  const mask = dwMask >>> 0
  const bRem1 =
    (mask & UNITS_GetCollisionMask113c(m, u1)) !== 0
      ? PATH_RemoveUnitCollisionFootprint113c(m, u1, 0)
      : 0
  const bRem2 =
    (mask & UNITS_GetCollisionMask113c(m, u2)) !== 0
      ? PATH_RemoveUnitCollisionFootprint113c(m, u2, 0)
      : 0

  const sz2 = UNITS_GetUnitSizeX113c(m, u2)
  const sz1 = UNITS_GetUnitSizeX113c(m, u1)
  const hit = COLLISION_RayTraceBetweenSizedPoints113c(m, x2, x1, sz2, y1, sz1, y2, pRoom, mask)

  if (bRem1 !== 0) {
    PATH_AddUnitCollisionFootprint113c(m, u1)
  }
  if (bRem2 !== 0) {
    PATH_AddUnitCollisionFootprint113c(m, u2)
  }
  return hit
}

/**
 * `@va D2Common:0x6FD82460` (`D2Common.#10853` `UNITS_AdvanceAnimFrame`,
 * stdcall `[esp+4] = pUnit`, `ret 4`, void).
 */
export function UNITS_AdvanceAnimFrame113c(m: Memory113c, pUnit: number): void {
  const esi = pUnit >>> 0
  const pSeq = m.u32((esi + 0x30) >>> 0)
  m.setU8((esi + 0x4e) >>> 0, 0)
  if (pSeq !== 0) {
    m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) & 0xffffbfff) >>> 0)
    const edx = m.u32((esi + 0x38) >>> 0) | 0
    const edi = m.u32((esi + 0x3c) >>> 0) | 0
    const ecx = m.u32((esi + 0x34) >>> 0) | 0
    let nextSeqFrame = (edi + edx) | 0
    m.setU32((esi + 0x38) >>> 0, nextSeqFrame >>> 0)
    if (nextSeqFrame >= ecx) {
      nextSeqFrame = (nextSeqFrame - ecx) | 0
      m.setU32((esi + 0x38) >>> 0, nextSeqFrame >>> 0)
    }
    m.setU32((esi + 0x48) >>> 0, (((m.u32((esi + 0x48) >>> 0) | 0) - edi) | 0) >>> 0)
    if (UNITS_StepAnimSeqFrame113c(m, esi, edx) !== 0) {
      m.setU32((esi + 0xc4) >>> 0, (m.u32((esi + 0xc4) >>> 0) | 0x4000) >>> 0)
    }
    return
  }

  let fp = m.u32((esi + 0x44) >>> 0) | 0
  const speed = (m.u16((esi + 0x4c) >>> 0) << 16) >> 16
  let prevFrame = fp >> 8
  if (speed >= 0x100) {
    prevFrame = (prevFrame + 1) | 0
  }
  fp = (fp + speed) | 0
  m.setU32((esi + 0x44) >>> 0, fp >>> 0)

  while (fp >= (m.u32((esi + 0x48) >>> 0) | 0)) {
    const frameMax = m.u32((esi + 0x48) >>> 0) | 0
    const endLoop = frameMax >> 8
    for (let f = prevFrame; f < endLoop; f++) {
      const pAnimData = m.u32((esi + 0x50) >>> 0)
      if (pAnimData !== 0 && f < 0x90) {
        const ev = m.u8((pAnimData + f + 0x10) >>> 0)
        if (ev >= 1 && ev <= 4) {
          m.setU8((esi + 0x4e) >>> 0, ev)
        }
      }
    }
    m.setU32((esi + 0x44) >>> 0, (((m.u32((esi + 0x44) >>> 0) | 0) - frameMax) | 0) >>> 0)
    prevFrame = 0
    const startFrame = UNITS_GetAnimStartFrame113c(m, esi) | 0
    fp = ((m.u32((esi + 0x44) >>> 0) | 0) + (startFrame << 8)) | 0
    m.setU32((esi + 0x44) >>> 0, fp >>> 0)
  }

  const finalFrame = fp >> 8
  for (let f = prevFrame; f <= finalFrame; f++) {
    const pAnimData = m.u32((esi + 0x50) >>> 0)
    if (pAnimData !== 0 && f < 0x90) {
      const ev = m.u8((pAnimData + f + 0x10) >>> 0)
      if (ev >= 1 && ev <= 4) {
        m.setU8((esi + 0x4e) >>> 0, ev)
      }
    }
  }
}

// ============================================================================
// Iteration 13 Lane A — I13A-1 (#08..#11) & I13A-2 (#01..#03) Unit Ports
// ============================================================================

const UNIT_STACK_SCRATCH_BASE = 0x7fff0200
const UNIT_STACK_SCRATCH_SIZE = 0x30
const _unitScratchBuf = new ArrayBuffer(UNIT_STACK_SCRATCH_SIZE)
const _unitScratchDv = new DataView(_unitScratchBuf)

function withUnitStackScratch113c(m: Memory113c): Memory113c {
  if ((m as { __hasUnitScratch?: boolean }).__hasUnitScratch) return m
  const isScratch = (p: number): boolean => {
    const u = p >>> 0
    return u >= UNIT_STACK_SCRATCH_BASE && u < UNIT_STACK_SCRATCH_BASE + UNIT_STACK_SCRATCH_SIZE
  }
  const wrapped: Memory113c & { __hasUnitScratch: boolean } = {
    __hasUnitScratch: true,
    alloc: (size) => m.alloc(size),
    u8: (p) => (isScratch(p) ? _unitScratchDv.getUint8((p >>> 0) - UNIT_STACK_SCRATCH_BASE) : m.u8(p)),
    u16: (p) =>
      isScratch(p) ? _unitScratchDv.getUint16((p >>> 0) - UNIT_STACK_SCRATCH_BASE, true) : m.u16(p),
    u32: (p) =>
      isScratch(p) ? _unitScratchDv.getUint32((p >>> 0) - UNIT_STACK_SCRATCH_BASE, true) : m.u32(p),
    setU8: (p, v) => {
      if (isScratch(p)) _unitScratchDv.setUint8((p >>> 0) - UNIT_STACK_SCRATCH_BASE, v & 0xff)
      else m.setU8(p, v)
    },
    setU16: (p, v) => {
      if (isScratch(p)) _unitScratchDv.setUint16((p >>> 0) - UNIT_STACK_SCRATCH_BASE, v & 0xffff, true)
      else m.setU16(p, v)
    },
    setU32: (p, v) => {
      if (isScratch(p)) _unitScratchDv.setUint32((p >>> 0) - UNIT_STACK_SCRATCH_BASE, v >>> 0, true)
      else m.setU32(p, v)
    },
    get: (base, field, index = 0) => m.get(base, field, index),
    set: (base, field, value, index = 0) => m.set(base, field, value, index),
    fill: (p, len, v) => m.fill(p, len, v),
  }
  return wrapped
}

const SPLIT_SPAWN_LOW_TABLE_113C: readonly number[] = [
  0, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 1, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 2, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 3, 6, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 4, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5,
]

const SPLIT_SPAWN_HIGH_TABLE_113C: readonly number[] = [
  0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
  4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 4, 1, 4, 4, 4, 4, 4, 4, 4, 4, 2, 4, 4, 4, 4,
  4, 4, 3,
]

const D2COMMON_GRID0_INFO_VA_UNIT_113C = 0x6fded378

function mulRecip100Exact113c(val: number, recip: bigint): number {
  const prod = BigInt(val | 0) * recip
  const hi = Number(BigInt.asIntN(32, prod >> 32n))
  const s = sar32(hi, 5)
  const signBit = (s >>> 31) & 1
  return (s + signBit) | 0
}

/**
 * `@va D2Common:0x6FD6AA00` (`D2Common.#10751` `UNITS_GetMonsterSplitSpawnParams`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = pOutClassId`, `[esp+0xC] = pOutX`, `[esp+0x10] = pOutY`,
 * `[esp+0x14] = pOutSpawnCount`, `[esp+0x18] = nRandScale`, `[esp+0x1C] = pfnGetUberClass`, `ret 0x1C`, void).
 */
export function UNITS_GetMonsterSplitSpawnParams113c(
  m: Memory113c,
  pUnit: number,
  pOutClassId: number,
  pOutX: number,
  pOutY: number,
  pOutSpawnCount: number,
  nRandScale: number,
  pfnGetUberClass: number | ((m: Memory113c, pUnit: number) => number),
  cbGetUberClass?: (m: Memory113c, pUnit: number) => number,
): void {
  const esi = pUnit >>> 0
  const outClass = pOutClassId >>> 0
  const outX = pOutX >>> 0
  const outY = pOutY >>> 0
  const outCount = pOutSpawnCount >>> 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  let baseId = -1
  let rawClass = -1
  if (esi !== 0 && m.u32(esi) === UNIT_MONSTER) {
    rawClass = m.u32((esi + 4) >>> 0) | 0
    const monCount = m.u32((sgpt + DATATABLES_OFF_113C.nMonStatsTxtRecordCount) >>> 0) | 0
    let candidate = rawClass
    if (rawClass >= 0 && rawClass < monCount) {
      const pBase = m.u32((sgpt + DATATABLES_OFF_113C.pMonStatsTxt) >>> 0)
      const pRec = (pBase + imul32(rawClass, D2MonStatsTxt_SIZE)) >>> 0
      if (pRec !== 0) {
        candidate = (m.u16((pRec + 2) >>> 0) << 16) >> 16
      }
    }
    if (candidate >= 0 && candidate < m.u32((sgpt + DATATABLES_OFF_113C.nMonStatsTxtRecordCount) >>> 0)) {
      baseId = candidate
    }
  }

  const writeDefault = (): void => {
    const monCount = m.u32((m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) + 0xa80) >>> 0) | 0
    m.setU32(outClass, (monCount > 0 ? 0 : -1) >>> 0)
    m.setU32(outX, 0)
    m.setU32(outY, 0)
    m.setU32(outCount, 1)
  }

  const getChainStepsFromMonStats = (idx: number): number => {
    if (idx >= 0 && idx < (m.u32(0x6fdf0958) | 0)) {
      const pMonBase = m.u32(0x6fdf0950)
      return m.u8((pMonBase + imul32(idx, 0x1a8) + 0x4b) >>> 0)
    }
    return 0
  }

  const resolveCountId = (id: number): number => {
    const monCount = m.u32((m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) + 0xa80) >>> 0) | 0
    return monCount > id ? id : -1
  }

  const sm = withUnitStackScratch113c(m)
  const pSubIdx = UNIT_STACK_SCRATCH_BASE

  if (baseId > 0x14e) {
    const u = (baseId - 0x1e4) >>> 0
    if (u > 0x3c) {
      writeDefault()
      return
    }
    const caseHi = SPLIT_SPAWN_HIGH_TABLE_113C[u]!
    if (caseHi === 0) {
      const steps = getChainStepsFromMonStats(baseId)
      const resolved = DATATBLS_WalkMonsterClassChainInline113c(m, resolveCountId(0x1c5), steps)
      m.setU32(outClass, resolved >>> 0)
      m.setU32(outX, UNITS_GetX113c(m, esi) >>> 0)
      m.setU32(outY, (UNITS_GetY113c(m, esi) + 3) >>> 0)
      m.setU32(outCount, 1)
      return
    }
    if (caseHi === 1) {
      const hasFn = typeof pfnGetUberClass === 'function' ? 1 : (pfnGetUberClass >>> 0)
      if (hasFn === 0) {
        const monCount = m.u32((m.u32(D2COMMON_SGPT_DATATABLES_VA_113C) + 0xa80) >>> 0) | 0
        m.setU32(outClass, (monCount > 0 ? 0 : -1) >>> 0)
        throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x1fc)
      }
      const fn = typeof pfnGetUberClass === 'function' ? pfnGetUberClass : cbGetUberClass
      const cls = fn !== undefined ? fn(m, esi) : 0
      m.setU32(outClass, cls >>> 0)
      m.setU32(outX, (UNITS_GetX113c(m, esi) + 2) >>> 0)
      m.setU32(outY, (UNITS_GetY113c(m, esi) + 2) >>> 0)
      m.setU32(outCount, 1)
      return
    }
    if (caseHi === 2) {
      const steps = getChainStepsFromMonStats(baseId)
      const resolved = DATATBLS_WalkMonsterClassChainInline113c(m, resolveCountId(0x21c), steps)
      m.setU32(outClass, resolved >>> 0)
      m.setU32(outX, UNITS_GetX113c(m, esi) >>> 0)
      m.setU32(outY, (UNITS_GetY113c(m, esi) + 2) >>> 0)
      m.setU32(outCount, 1)
      const dtNow = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      if ((m.u32((dtNow + 0xc4) >>> 0) | 0) > 0x92) {
        const pEx = m.u32((esi + 0x5c) >>> 0)
        if (pEx !== 0 && (m.u32((pEx + 0x10) >>> 0) | 0) < 0) {
          const pBitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
          const bit = m.u32((pBitMasks + 0x48) >>> 0)
          const pSf = m.u32((pEx + 0x58) >>> 0)
          const cur = m.u32((pSf + 0x10) >>> 0)
          const wasSet = cur & bit
          m.setU32((pSf + 0x10) >>> 0, (cur | bit) >>> 0)
          if (wasSet === 0) {
            const dt2 = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
            const nSt = m.u32((dt2 + 0xc4) >>> 0) | 0
            const pSf2 = m.u32((pEx + 0x58) >>> 0)
            const dwIdx = (((nSt + 0x1f) | 0) >> 5) | 0
            const wordAddr = (pSf2 + (dwIdx << 2) + 0x10) >>> 0
            const bit2 = m.u32((m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C) + 0x48) >>> 0)
            m.setU32(wordAddr, (m.u32(wordAddr) | bit2) >>> 0)
            const dt3 = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
            if ((m.u32((dt3 + 0xc4) >>> 0) | 0) > 0x92) {
              const pSt = (m.u32((dt3 + 0xbc) >>> 0) + 0x2238) >>> 0
              if (pSt !== 0) {
                const flByte = m.u8((pSt + 0x12) >>> 0)
                if ((m.u8(m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)) & flByte) !== 0) {
                  m.setU32((esi + 0xc8) >>> 0, (m.u32((esi + 0xc8) >>> 0) | 8) >>> 0)
                }
              }
            }
          }
        }
        UNITROOM_RefreshUnit113c(m, esi)
      }
      return
    }
    if (caseHi === 3) {
      const prevClass = m.u32(outClass) >>> 0
      const target23a = resolveCountId(0x23a) >>> 0
      if (prevClass === target23a) {
        const rolledX = (SEED_RollRandomNumberInline113c(m, (esi + 0x20) >>> 0, 0x18) + UNITS_GetX113c(m, esi) - 0x0c) | 0
        m.setU32(outX, rolledX >>> 0)
        const rolledY = (SEED_RollRandomNumberInline113c(m, (esi + 0x20) >>> 0, 0x18) + UNITS_GetY113c(m, esi) - 0x0c) | 0
        m.setU32(outY, rolledY >>> 0)
        m.setU32(outCount, 1)
        return
      }
      const base232 = resolveCountId(0x232)
      const r1 = (SEED_RollRandomNumberInline113c(m, (esi + 0x20) >>> 0, 2) + (nRandScale | 0)) | 0
      m.setU32(outClass, DATATBLS_WalkMonsterClassChainInline113c(m, base232, r1) >>> 0)
      const rx = (SEED_RollRandomNumberInline113c(m, (esi + 0x20) >>> 0, 0x18) + UNITS_GetX113c(m, esi) - 0x0c) | 0
      m.setU32(outX, rx >>> 0)
      const ry = (SEED_RollRandomNumberInline113c(m, (esi + 0x20) >>> 0, 0x18) + UNITS_GetY113c(m, esi) - 0x0c) | 0
      m.setU32(outY, ry >>> 0)
      m.setU32(outCount, 4)
      return
    }
    writeDefault()
    return
  }

  if (baseId === 0x14e) {
    const steps = getChainStepsFromMonStats(baseId)
    const resolved = DATATBLS_WalkMonsterClassChainInline113c(m, resolveCountId(0x72), steps)
    m.setU32(outClass, resolved >>> 0)
    m.setU32(outX, (UNITS_GetX113c(m, esi) - 2) | 0)
    m.setU32(outY, (UNITS_GetY113c(m, esi) - 2) | 0)
    m.setU32(outCount, 1)
    return
  }

  const uLow = (baseId - 0xce) >>> 0
  if (uLow > 0x73) {
    writeDefault()
    return
  }
  const caseLo = SPLIT_SPAWN_LOW_TABLE_113C[uLow]!
  if (caseLo === 0) {
    const monId = esi !== 0 ? (m.u32((esi + 4) >>> 0) | 0) : -1
    sm.setU32(pSubIdx, 0)
    DATATBLS_GetMonsterChainInfo113c(sm, monId, 0, pSubIdx)
    const steps = sm.u32(pSubIdx) | 0
    const resolved = DATATBLS_WalkMonsterClassChainInline113c(m, resolveCountId(0x0f), steps)
    m.setU32(outClass, resolved >>> 0)
    m.setU32(outX, UNITS_GetX113c(m, esi) >>> 0)
    m.setU32(outY, (UNITS_GetY113c(m, esi) + 3) >>> 0)
    m.setU32(outCount, 1)
    return
  }
  if (caseLo === 1) {
    const resolved = DRLG_ResolveMonsterSubClassIdForRoom113c(m, UNITS_GetRoom113c(m, esi), resolveCountId(0x60))
    m.setU32(outClass, resolved >>> 0)
    m.setU32(outX, UNITS_GetX113c(m, esi) >>> 0)
    m.setU32(outY, (UNITS_GetY113c(m, esi) + 2) >>> 0)
    m.setU32(outCount, 1)
    return
  }
  if (caseLo === 2) {
    m.setU32(outClass, resolveCountId(0x06) >>> 0)
    const pDyn = m.u32((esi + 0x2c) >>> 0)
    m.setU32(outClass, m.u16((pDyn + 0x10) >>> 0) >>> 0)
    m.setU32(outX, m.u16((pDyn + 0x12) >>> 0) >>> 0)
    m.setU32(outY, 8)
    return
  }
  if (caseLo === 3) {
    const monId = esi !== 0 ? (m.u32((esi + 4) >>> 0) | 0) : -1
    sm.setU32(pSubIdx, 0)
    DATATBLS_GetMonsterChainInfo113c(sm, monId, 0, pSubIdx)
    const steps = sm.u32(pSubIdx) | 0
    const resolved = DATATBLS_WalkMonsterClassChainInline113c(m, resolveCountId(0x44), steps)
    m.setU32(outClass, resolved >>> 0)
    m.setU32(outX, (UNITS_GetX113c(m, esi) + 8) >>> 0)
    m.setU32(outY, UNITS_GetY113c(m, esi) >>> 0)
    m.setU32(outCount, 8)
    return
  }
  if (caseLo === 4) {
    const monId = esi !== 0 ? (m.u32((esi + 4) >>> 0) | 0) : -1
    sm.setU32(pSubIdx, 0)
    DATATBLS_GetMonsterChainInfo113c(sm, monId, 0, pSubIdx)
    const steps = sm.u32(pSubIdx) | 0
    const resolved = DATATBLS_WalkMonsterClassChainInline113c(m, resolveCountId(0x12d), steps)
    m.setU32(outClass, resolved >>> 0)
    const pDyn = m.u32((esi + 0x2c) >>> 0)
    m.setU32(outX, m.u16((pDyn + 0x10) >>> 0) >>> 0)
    m.setU32(outY, m.u16((pDyn + 0x12) >>> 0) >>> 0)
    m.setU32(outCount, 1)
    return
  }
  if (caseLo === 5) {
    const id = esi !== 0 && (m.u32((esi + 4) >>> 0) | 0) === 0x2c7 ? resolveCountId(0x2c8) : resolveCountId(0x13)
    m.setU32(outClass, id >>> 0)
    m.setU32(outX, UNITS_GetX113c(m, esi) >>> 0)
    m.setU32(outY, UNITS_GetY113c(m, esi) >>> 0)
    m.setU32(outCount, 1)
    return
  }
  writeDefault()
}

/**
 * `@va D2Common:0x6FD81000` (`D2Common.#10594` `UNITS_IsUnitInObjRectRange`,
 * stdcall `[esp+4] = pOtherUnit`, `[esp+8] = pObjUnit`, `ret 8` -> `0 | 1`).
 */
export function UNITS_IsUnitInObjRectRange113c(
  m: Memory113c,
  pOtherUnit: number,
  pObjUnit: number,
): number {
  const obj = pObjUnit >>> 0
  if (obj === 0 || m.u32(obj) !== UNIT_OBJECT) return 0
  const other = pOtherUnit >>> 0
  if ((UNITS_GetDistanceToOtherUnit113c(m, other, obj) >>> 0) === 0) {
    return 1
  }
  const otherX = UNITS_GetX113c(m, other)
  const otherY = UNITS_GetY113c(m, other)
  const rawObjX = UNITS_GetX113c(m, obj)
  const rawObjY = UNITS_GetY113c(m, obj)
  const w = UNITS_GetUnitSizeX113c(m, obj) | 0
  const h = UNITS_GetUnitSizeY113c(m, obj) | 0
  const x0 = (rawObjX - sdiv32(w, 2)) | 0
  const y0 = (rawObjY - sdiv32(h, 2)) | 0

  if (w >= 1 && h >= 1) {
    if (
      otherX < ((x0 - 2) | 0) ||
      otherX > ((x0 + w + 2) | 0) ||
      otherY < ((y0 - 2) | 0) ||
      otherY > ((y0 + h + 2) | 0)
    ) {
      return 0
    }
    const otherSzX = UNITS_GetUnitSizeX113c(m, other) >>> 0
    if (otherSzX <= 2) {
      if (otherY < ((y0 - 1) | 0)) {
        if (otherX < ((x0 - 1) | 0) || otherX > ((x0 + w + 1) | 0)) return 0
      } else if (otherY > ((y0 + h + 1) | 0)) {
        if (otherX < ((x0 - 1) | 0) || otherX > ((x0 + w + 1) | 0)) return 0
      }
    }
    return 1
  }

  if (
    otherX < ((x0 - 1) | 0) ||
    otherX > ((x0 + 1) | 0) ||
    otherY < ((y0 - 1) | 0) ||
    otherY > ((y0 + 1) | 0)
  ) {
    return 0
  }
  return 1
}

/**
 * `@va D2Common:0x6FD82890` (`D2Common.#10672` `UNITS_GetVelocity` [Unit Armor/Defense calc],
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `int32`).
 */
export function UNITS_GetVelocity113c(m: Memory113c, pUnit: number): number {
  const u = pUnit >>> 0
  let v = 0
  let pEx = 0
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  const iscCount = m.u32((sgpt + 0xbd4) >>> 0) | 0
  const pIscBase = m.u32((sgpt + 0xbcc) >>> 0)

  if (u !== 0) {
    pEx = m.u32((u + 0x5c) >>> 0)
    if (pEx !== 0 && iscCount > 0x1f) {
      const pIsc1F = (pIscBase + 0x273c) >>> 0
      if (pIsc1F !== 0) {
        v = getTotalStatWithMinFromList113c(m, pEx, 0x001f0000, pIsc1F) | 0
      }
    }
  }

  let dex = 0
  if (pEx !== 0 && iscCount > 0x02) {
    const pIsc2 = (pIscBase + 0x288) >>> 0
    if (pIsc2 !== 0) {
      dex = getTotalStatWithMinFromList113c(m, pEx, 0x00020000, pIsc2) | 0
    }
  }
  v = (v + sdiv32(dex, 4)) | 0

  const pEx2 = m.u32((u + 0x5c) >>> 0)
  let pctSum = 0
  if (pEx2 !== 0) {
    if (iscCount > 0xab) {
      const pIscAB = (pIscBase + 0xd86c) >>> 0
      if (pIscAB !== 0) {
        pctSum = (pctSum + (getTotalStatWithMinFromList113c(m, pEx2, 0x00ab0000, pIscAB) | 0)) | 0
      }
    }
    const sgptNow = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    if ((m.u32((sgptNow + 0xbd4) >>> 0) | 0) > 0x10) {
      const pIsc10 = (m.u32((sgptNow + 0xbcc) >>> 0) + 0x1440) >>> 0
      if (pIsc10 !== 0) {
        pctSum = (pctSum + (getTotalStatWithMinFromList113c(m, pEx2, 0x00100000, pIsc10) | 0)) | 0
      }
    }
  }

  const uType = m.u32(u) | 0
  if (uType === 0 || uType === 1 || uType === 3) {
    const sgptSt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    if ((m.u32((sgptSt + 0xc4) >>> 0) | 0) > 0x65) {
      if (STATES_CheckStateMaskOnUnitFast113c(m, u, 0x65) !== 0 && pEx2 !== 0 && (m.u32((pEx2 + 0x10) >>> 0) | 0) < 0) {
        let pSub = m.u32((pEx2 + 0x3c) >>> 0)
        while (pSub !== 0 && (m.u32((pSub + 0x14) >>> 0) | 0) !== 0x65) {
          pSub = m.u32((pSub + 0x2c) >>> 0)
        }
        if (pSub === 0) {
          pSub = m.u32((pEx2 + 0x40) >>> 0)
          while (pSub !== 0 && (m.u32((pSub + 0x14) >>> 0) | 0) !== 0x65) {
            pSub = m.u32((pSub + 0x2c) >>> 0)
          }
        }
        if (pSub !== 0) {
          const sgptHS = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
          const hsCount = m.u32((sgptHS + 0xbd4) >>> 0) | 0
          const hsIsc = m.u32((sgptHS + 0xbcc) >>> 0)
          const skId =
            hsCount > 0x15e && hsIsc + 0x1baf8 !== 0
              ? getBaseStatWithMinFromList113c(m, pSub, 0x015e0000, (hsIsc + 0x1baf8) >>> 0) | 0
              : 0
          const skLvl =
            hsCount > 0x15f && hsIsc + 0x1bc3c !== 0
              ? getBaseStatWithMinFromList113c(m, pSub, 0x015f0000, (hsIsc + 0x1bc3c) >>> 0) | 0
              : 0
          if (skId > 0 && skLvl > 0) {
            const pSkTxt = DATATBLS_GetSkillsTxtRecordInline113c(m, skId)
            if (pSkTxt !== 0) {
              const sm = withUnitStackScratch113c(m)
              const pOutShield = UNIT_STACK_SCRATCH_BASE
              sm.setU32(pOutShield, 0)
              INVENTORY_GetEquippedShield113c(sm, m.u32((u + 0x60) >>> 0), pOutShield)
              if (sm.u32(pOutShield) !== 0) {
                const hsPct = SKILLS_EvalCalcByOffset113c(
                  m,
                  u,
                  m.u32((pSkTxt + 0x138) >>> 0),
                  skId,
                  skLvl,
                ) | 0
                pctSum = (pctSum + hsPct) | 0
              }
            }
          }
        }
      }
    }
  }

  const prodPct = imul32(pctSum, v)
  if (v > 0) {
    v = (v + mulRecip100Exact113c(prodPct, 0x51eb851fn)) | 0
  } else {
    v = (v + mulRecip100Exact113c(prodPct, -0x51eb851fn)) | 0
  }

  const pEx3 = m.u32((u + 0x5c) >>> 0)
  if (pEx3 !== 0) {
    const sgptB6 = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    if ((m.u32((sgptB6 + 0xbd4) >>> 0) | 0) > 0xb6) {
      const pIscB6 = (m.u32((sgptB6 + 0xbcc) >>> 0) + 0xe658) >>> 0
      if (pIscB6 !== 0) {
        const bonus = getTotalStatWithMinFromList113c(m, pEx3, 0x00b60000, pIscB6) | 0
        if (bonus !== 0) {
          if (v > 0x100000) {
            if ((v & 0xfffffff0) < 0x640) {
              v = (v + Number((BigInt(v) * BigInt(bonus)) / 100n)) | 0
            } else {
              v = (v + imul32(mulRecip100Exact113c(v, 0x51eb851fn), bonus)) | 0
            }
          } else if (bonus > 0x10000) {
            if ((bonus & 0xfffffff0) < 0x640) {
              v = (v + Number((BigInt(v) * BigInt(bonus)) / 100n)) | 0
            } else {
              v = (v + imul32(mulRecip100Exact113c(bonus, 0x51eb851fn), v)) | 0
            }
          } else {
            v = (v + mulRecip100Exact113c(imul32(bonus, v), 0x51eb851fn)) | 0
          }
        }
      }
    }
  }
  return v | 0
}

/**
 * `@va D2Common:0x6FD91F70` (internal `UNITS_FindUnitAnimDataRecord`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nClassId`, `[esp+0xC] = nAnimMode`, `[esp+0x10] = nUnitType`,
 * `[esp+0x14] = pInventory`, `ret 0x14` -> `D2AnimDataRecordStrc*`).
 */
export function UNITS_FindUnitAnimDataRecord113c(
  m: Memory113c,
  pUnit: number,
  nClassId: number,
  nAnimMode: number,
  nUnitType: number,
  pInventory: number,
): number {
  const sm = withUnitStackScratch113c(m)
  const pSzOut = UNIT_STACK_SCRATCH_BASE
  const pWeapCode = UNIT_STACK_SCRATCH_BASE + 0x10
  sm.setU32(pSzOut, 0)
  sm.setU32(pSzOut + 4, 0)
  sm.setU32(pWeapCode, 0)
  UNITS_GetAnimDataStringOrPath113c(
    sm,
    pUnit >>> 0,
    nClassId | 0,
    nAnimMode | 0,
    nUnitType | 0,
    pInventory >>> 0,
    pSzOut,
    pWeapCode,
    0,
    1,
  )
  const rec = ANIMDATA_FindRecordByCode113c(sm, pSzOut) >>> 0
  if (rec !== 0) return rec
  return (m.u32(0x6fdf0b4c) + 0x404) >>> 0
}

/**
 * `@va D2Common:0x6FD82670` (`D2Common.#11122` `UNITS_GetAnimDataRecord`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = nUnitType`, `[esp+0xC] = nClassId`, `[esp+0x10] = nAnimMode`,
 * `ret 0x10` -> `D2AnimDataRecordStrc*`).
 */
export function UNITS_GetAnimDataRecord113c(
  m: Memory113c,
  pUnit: number,
  nUnitType: number,
  nClassId: number,
  nAnimMode: number,
): number {
  const u = pUnit >>> 0
  if (u === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x936)
  }
  const pInv = m.u32((u + 0x60) >>> 0)
  const rec = UNITS_FindUnitAnimDataRecord113c(m, u, nClassId, nAnimMode, nUnitType, pInv)
  m.setU32((u + 0x50) >>> 0, rec >>> 0)
  return rec >>> 0
}

/**
 * `@va D2Common:0x6FD83110` (`D2Common.#10819` `UNITS_SetUnitAnimMode`,
 * stdcall `[esp+4] = pUnit`, `[esp+8] = _szFile`, `[esp+0xC] = _nLine`, `ret 0xC`, void).
 */
export function UNITS_SetUnitAnimMode113c(
  m: Memory113c,
  pUnit: number,
  _szFile = 0,
  _nLine = 0,
): void {
  const edi = pUnit >>> 0
  if (edi === 0) return
  const rawType = m.u32(edi) | 0
  if (rawType >= 5 || rawType === 4) return

  const sm = withUnitStackScratch113c(m)
  const pType = UNIT_STACK_SCRATCH_BASE
  const pClass = UNIT_STACK_SCRATCH_BASE + 4
  const pMode = UNIT_STACK_SCRATCH_BASE + 8
  sm.setU32(pType, rawType >>> 0)
  sm.setU32(pClass, m.u32((edi + 4) >>> 0))
  sm.setU32(pMode, m.u32((edi + 0x10) >>> 0))
  UNITS_GetTransformGfx113c(sm, edi, pType, pClass, pMode, 0, 0)

  const outType = sm.u32(pType) | 0
  const outClass = sm.u32(pClass) | 0
  const outMode = sm.u32(pMode) | 0

  UNITS_GetAnimDataRecord113c(m, edi, outType, outClass, outMode)
  const pAnimData = m.u32((edi + 0x50) >>> 0)

  const calcRecip100Unsigned = (num: number): number => {
    const prod = (BigInt(num >>> 0) * 0x51eb851fn) >> 32n
    return Number(prod >> 5n) | 0
  }

  if (UNITS_IsCastAnimMode113c(m, outType, outMode, edi) !== 0) {
    let pct = ((UNITS_GetDiminishingStatBonusInline113c(m, 2, edi) | 0) + 0x64) | 0
    if (pct > 0xaf) pct = 0xaf
    const baseSpd = m.u32((pAnimData + 0x0c) >>> 0)
    const scaled = calcRecip100Unsigned(imul32(baseSpd, pct))
    const clamped = scaled <= 0 ? 0 : scaled < 0x7fff ? scaled : 0x7fff
    m.setU16((edi + 0x4c) >>> 0, clamped & 0xffff)
    m.setU32((edi + 0x3c) >>> 0, ((clamped << 16) >> 16) >>> 0)
    return
  }

  if (UNITS_IsWalkModeForType113c(m, outType, outMode) !== 0) {
    const bonus = UNITS_GetDiminishingStatBonusInline113c(m, 3, edi) | 0
    let basePct = 0x32
    const uTypeCur = m.u32(edi) | 0
    if (uTypeCur === 0 || uTypeCur === 1 || uTypeCur === 3) {
      const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
      if ((m.u32((sgpt + 0xc4) >>> 0) | 0) > 0x65) {
        if (STATES_CheckStateMaskOnUnitFast113c(m, edi, 0x65) !== 0) {
          basePct = 0x64
        }
      }
    }
    const pct = (basePct + bonus) | 0
    const scaled = calcRecip100Unsigned(imul32(pct, m.u32((pAnimData + 0x0c) >>> 0)))
    let res = scaled < 1 ? 1 : scaled
    if (res > 0) {
      if (res >= 0x7fff) res = 0x7fff
    } else {
      res = 0
    }
    m.setU16((edi + 0x4c) >>> 0, res & 0xffff)
    return
  }

  if (UNITS_IsGetHitModeForType113c(m, outType, outMode) !== 0) {
    const pct = ((UNITS_GetDiminishingStatBonusInline113c(m, 1, edi) | 0) + 0x32) | 0
    const scaled = calcRecip100Unsigned(imul32(pct, m.u32((pAnimData + 0x0c) >>> 0)))
    const clamped = scaled <= 0 ? 0 : scaled < 0x7fff ? scaled : 0x7fff
    m.setU16((edi + 0x4c) >>> 0, clamped & 0xffff)
    return
  }

  if (UNITS_IsRunModeForType113c(m, outType, outMode) !== 0) {
    const baseRun = UNITS_GetBaseAnimSpeed113c(m, outType, outClass, outMode) | 0
    const clamped = baseRun <= 0 ? 0 : baseRun < 0x7fff ? baseRun : 0x7fff
    m.setU16((edi + 0x4c) >>> 0, clamped & 0xffff)
    PATH_SetVelocity113c(m, m.u32((edi + 0x2c) >>> 0), 0x1000, 0, 0)
    return
  }

  if (UNITS_CanSwitchToModeDuringAnim113c(m, outType, outMode, outClass, edi) !== 0) {
    const pPath = m.u32((edi + 0x2c) >>> 0)
    if (pPath === 0) {
      m.setU16((edi + 0x4c) >>> 0, 0)
      return
    }
    let movePct = ((STATLIST_GetUnitStatWithLayer113c(m, edi, 0x43, 0) | 0) +
      (UNITS_GetDiminishingStatBonusInline113c(m, 4, edi) | 0)) | 0
    if (movePct < 0x19) movePct = 0x19
    const animSpd = mulRecip100Exact113c(
      imul32(UNITS_GetBaseAnimSpeed113c(m, outType, outClass, outMode), movePct),
      0x51eb851fn,
    )
    const clampedAnim = animSpd <= 0 ? 0 : animSpd < 0x7fff ? animSpd : 0x7fff
    m.setU16((edi + 0x4c) >>> 0, clampedAnim & 0xffff)
    const walkVel = mulRecip100Exact113c(
      imul32(UNITS_GetBaseWalkVelocity113c(m, outType, outClass), movePct),
      0x51eb851fn,
    )
    PATH_SetVelocity113c(m, pPath, walkVel, 0, 0)
    return
  }

  if (UNITS_IsAttackAnimMode113c(m, outType, outMode, edi, outClass) !== 0) {
    UNITS_SyncDualWieldWeaponStatLists113c(m, edi, 1)
    let ias = ((STATLIST_GetUnitStatWithLayer113c(m, edi, 0x44, 0) | 0) +
      (UNITS_GetDiminishingStatBonusInline113c(m, 0, edi) | 0)) | 0
    if (unitsCanDualWieldMem113c(m, edi) !== 0) {
      const pInv = m.u32((edi + 0x60) >>> 0)
      let left = 0
      let right = 0
      if (pInv !== 0 && m.u32(pInv) === 0x01020304) {
        const pGrid0 = INVENTORY_GetOrInitGridMem113c(m, pInv, 0, D2COMMON_GRID0_INFO_VA_UNIT_113C)
        if (pGrid0 !== 0) {
          const ppItems = m.u32((pGrid0 + 0x0c) >>> 0)
          left = m.u32((ppItems + 0x10) >>> 0)
          right = m.u32((ppItems + 0x14) >>> 0)
        }
      }
      if (isItemNotBrokenInvMem113c(m, left) === 0) left = 0
      if (isItemNotBrokenInvMem113c(m, right) === 0) right = 0
      if (ITEMS_CheckItemTypeIdMem113c(m, left, 0x2d) !== 0 && ITEMS_CheckItemTypeIdMem113c(m, right, 0x2d) !== 0) {
        const w1 = STATLIST_GetUnitStatWithLayer113c(m, left, 0x44, 0) | 0
        const w2 = STATLIST_GetUnitStatWithLayer113c(m, right, 0x44, 0) | 0
        ias = (ias + ((sdiv32((w1 + w2) | 0, 2) - w1) | 0)) | 0
      }
    }
    if ((m.u32(edi) | 0) === 0 && (m.u32((edi + 0x10) >>> 0) | 0) === 0x12) {
      ias = (ias - 0x1e) | 0
    }
    if (ias < 0x0f) ias = 0x0f
    else if (ias > 0xaf) ias = 0xaf

    const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    let divBase = 0
    if (STATES_CheckStateMaskOnUnit113c(m, edi, m.u32((sgpt + 0x164) >>> 0)) !== 0) {
      divBase = SKILLS_CalcUnitVelocityDivided113c(m, edi) | 0
    }
    if (divBase === 0) {
      divBase = m.u32((pAnimData + 0x0c) >>> 0)
    }
    const scaled = calcRecip100Unsigned(imul32(divBase, ias))
    const clamped = scaled <= 0 ? 0 : scaled < 0x7fff ? scaled : 0x7fff
    m.setU16((edi + 0x4c) >>> 0, clamped & 0xffff)
    m.setU32((edi + 0x3c) >>> 0, ((clamped << 16) >> 16) >>> 0)
    return
  }

  if (UNITS_GetWeaponSpeedAnimRate113c(m, outType, outMode, outClass) !== 0) {
    const raw = m.u32((pAnimData + 0x0c) >>> 0) | 0
    const clamped = raw <= 0 ? 0 : raw < 0x7fff ? raw : 0x7fff
    m.setU16((edi + 0x4c) >>> 0, clamped & 0xffff)
    return
  }

  let spdPct = STATLIST_GetUnitStatWithLayer113c(m, edi, 0x45, 0) | 0
  if (spdPct < 0x0f) spdPct = 0x0f
  else if (spdPct > 0xaf) spdPct = 0xaf
  const scaled = calcRecip100Unsigned(imul32(m.u32((pAnimData + 0x0c) >>> 0), spdPct))
  const clamped = scaled <= 0 ? 0 : scaled < 0x7fff ? scaled : 0x7fff
  m.setU16((edi + 0x4c) >>> 0, clamped & 0xffff)
}

/**
 * `@va D2Common:0x6FD835F0` (`D2Common.#10595` `UNITS_UpdateAnimFrame`,
 * stdcall `[esp+4] = pUnit`, `ret 4` -> `0 | 1`).
 */
export function UNITS_UpdateAnimFrame113c(m: Memory113c, pUnit: number): number {
  const edi = pUnit >>> 0
  if (edi === 0) {
    throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x951)
  }
  m.setU8((edi + 0x4e) >>> 0, 0)
  const startFrame = UNITS_GetAnimStartFrame113c(m, edi) | 0
  const prevType = m.u32(edi) | 0
  const rawClass = m.u32((edi + 4) >>> 0)
  m.setU32((edi + 0x44) >>> 0, (startFrame << 8) >>> 0)

  const sm = withUnitStackScratch113c(m)
  const pOutType = UNIT_STACK_SCRATCH_BASE
  const pOutClass = UNIT_STACK_SCRATCH_BASE + 4
  const pOutMode = UNIT_STACK_SCRATCH_BASE + 8
  sm.setU32(pOutType, prevType >>> 0)
  sm.setU32(pOutClass, rawClass >>> 0)
  sm.setU32(pOutMode, m.u32((edi + 0x10) >>> 0))
  UNITS_GetTransformGfx113c(sm, edi, pOutType, pOutClass, pOutMode, 0, 0)

  const outType = sm.u32(pOutType) >>> 0
  const outClass = sm.u32(pOutClass) | 0
  const outMode = sm.u32(pOutMode) | 0

  if (outType === 0) {
    if (outMode === 3 || outMode === 0x13) {
      UNITS_ApplyRunWalkStatListInline113c(m, outClass, edi)
    }
    if (outMode === 0x12) {
      UNITS_InitSkillAnimSequence113c(m, edi)
      UNITS_SetUnitAnimMode113c(m, edi, 0, 0)
      return 1
    }
    m.setU32((edi + 0x30) >>> 0, 0)
    UNITS_SetUnitAnimMode113c(m, edi, 0, 0)
    const pAnim = m.u32((edi + 0x50) >>> 0)
    m.setU32((edi + 0x48) >>> 0, (m.u32((pAnim + 0x08) >>> 0) << 8) >>> 0)
    return 1
  }

  if (outType === 1) {
    if (prevType === 0 && UNITS_IsShapeshifted113c(m, edi) !== 0 && (outMode === 0x0d || outMode === 0x0f)) {
      UNITS_ApplyRunWalkStatListInline113c(m, outClass, edi)
    }
    if (outMode === 0x0e) {
      UNITS_InitSkillAnimSequence113c(m, edi)
      UNITS_SetUnitAnimMode113c(m, edi, 0, 0)
      return 1
    }
    m.setU32((edi + 0x30) >>> 0, 0)
    UNITS_SetUnitAnimMode113c(m, edi, 0, 0)
    const pAnim = m.u32((edi + 0x50) >>> 0)
    m.setU32((edi + 0x48) >>> 0, (m.u32((pAnim + 0x08) >>> 0) << 8) >>> 0)
    return 1
  }

  if (outType === 2) {
    if (outMode >= 8) {
      throw new D2CommonAssertError(UNITS_CPP_FILE_113C, 0x98a)
    }
    const pObjTxt = DATATBLS_GetObjectsTxtRecord113c(m, outClass)
    m.setU32((edi + 0x48) >>> 0, m.u32((pObjTxt + imul32(outMode, 4) + 0xd8) >>> 0))
    const startByte = m.u8((pObjTxt + outMode + 0x129) >>> 0)
    m.setU32((edi + 0x44) >>> 0, (startByte << 8) >>> 0)
    const speed16 = (m.u16((pObjTxt + imul32(outMode, 2) + 0xf8) >>> 0) << 16) >> 16
    if (m.u8((pObjTxt + 0x175) >>> 0) !== 0) {
      m.setU16((edi + 0x4c) >>> 0, speed16 & 0xffff)
      return 1
    }
    const roll = SEED_RollRandomNumberInline113c(m, (edi + 0x20) >>> 0, sar32(speed16, 3)) | 0
    const sp = (roll + speed16 - sar32(speed16, 4)) | 0
    const clamped = sp <= 0 ? 0 : sp < 0x7fff ? sp : 0x7fff
    m.setU16((edi + 0x4c) >>> 0, clamped & 0xffff)
    return 1
  }

  if (outType === 3) {
    const pMisTxt = DATATBLS_GetMissilesTxtRecordInline113c(m, outClass)
    if (pMisTxt === 0) return 0
    const animSpd16 = (m.u16((pMisTxt + 0xa0) >>> 0) << 16) >> 16
    const finalSpd =
      animSpd16 > 0x10000
        ? (animSpd16 & 0xfffffff0) < 0x4000
          ? Number((BigInt(animSpd16) * 256n) / 1024n) | 0
          : (sdiv32(animSpd16, 1024) << 8) | 0
        : sdiv32(animSpd16 << 8, 1024)
    m.setU16((edi + 0x4c) >>> 0, finalSpd & 0xffff)
    m.setU32((edi + 0x48) >>> 0, (m.u8((pMisTxt + 0x178) >>> 0) << 8) >>> 0)
    return 1
  }

  if (outType === 4) {
    if (outMode === 5) {
      m.setU16((edi + 0x4c) >>> 0, 0x100)
      m.setU32((edi + 0x48) >>> 0, 0x1100)
      return 1
    }
    if (outMode === 3) {
      m.setU16((edi + 0x4c) >>> 0, outClass & 0xffff)
      m.setU32((edi + 0x48) >>> 0, 0x1100)
      m.setU32((edi + 0x44) >>> 0, 0x1000)
      return 1
    }
  }
  return 1
}

/**
 * `D2Common.dll` `0x6FD81680` (internal `__usercall(pUnit@<eax>)`).
 */
export function UNITS_IsMonsterShieldEquipped113c(m: Memory113c, pUnit: number): number {
  const unit = pUnit >>> 0
  let classId = -1
  if (unit !== 0) {
    const cid = m.u32((unit + 0x04) >>> 0) | 0
    const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
    if (cid >= 0 && cid < (m.u32((sgpt + 0xa80) >>> 0) | 0)) {
      classId = cid
    }
  }
  const rel = (classId - 0xf3) >>> 0
  if (rel <= 0x74) {
    if (rel === 0 || rel === 0x43 || rel === 0x5a) return 1
    if (rel === 0x74) return 0
  }

  let varIdx = 0
  if (unit !== 0 && m.u32(unit) === 1) {
    const pData = m.u32((unit + 0x14) >>> 0)
    if (pData !== 0) {
      varIdx = m.u8((pData + 0x0b) >>> 0)
    }
  }
  const pCode = MONSTERS_GetCompCode113c(m, unit, 7, varIdx) >>> 0
  if (pCode === 0) return 0
  const nSkip = m.u32(0x6fdeefdc) >>> 0
  for (let i = 0; i < nSkip; i++) {
    if (m.u32((0x6fdeefe0 + i * 4) >>> 0) === pCode) return 0
  }
  const idx = fogGetLinkIndex113c(m, m.u32(0x6fdeff6c), pCode) | 0
  if (idx < 0) return 0
  const pItemsTxt = m.u32(0x6fdefb98)
  if (pItemsTxt === 0) return 0
  const pTxt = (pItemsTxt + imul32(idx, 0x1a8)) >>> 0
  return m.u16((pTxt + 0x11e) >>> 0) === 2 ? 1 : 0
}

/**
 * `D2Common.dll` `0x6FD81D20` (Ord `10212`, `__stdcall(pUnit, bApplyDexFormula)`).
 */
export function UNITS_GetBlockChance113c(
  m: Memory113c,
  pUnit: number,
  bApplyDexFormula: number,
): number {
  const unit = pUnit >>> 0
  const unitType = unit !== 0 ? (m.u32(unit) >>> 0) : 6
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C)
  let block = 0

  if (unitType === 0) {
    const pInv = m.u32((unit + 0x60) >>> 0)
    if (INVENTORY_GetEquippedShield113c(m, pInv, 0) === 0) {
      return 0
    }
    const pStatListEx = m.u32((unit + 0x5c) >>> 0)
    if (pStatListEx !== 0 && (m.u32((sgpt + 0xbd4) >>> 0) | 0) > 0x14) {
      const pIsc = (m.u32((sgpt + 0xbcc) >>> 0) + 0x1950) >>> 0
      if (pIsc !== 0) {
        block = getTotalStatWithMinFromList113c(m, pStatListEx, 0x140000, pIsc) | 0
      }
    }
    const cid = m.u32((unit + 0x04) >>> 0) | 0
    let pCharStats = 0
    if (cid >= 0 && cid < (m.u32((sgpt + 0xbc8) >>> 0) | 0)) {
      pCharStats = (m.u32((sgpt + 0xbc4) >>> 0) + imul32(cid, 0xc4)) >>> 0
    }
    block = (block + m.u8((pCharStats + 0x49) >>> 0)) | 0
    if ((bApplyDexFormula | 0) !== 0) {
      const dex = STATLIST_GetUnitStat113c(m, unit, 2, 0) | 0
      let lvl = STATLIST_GetUnitStat113c(m, unit, 0x0c, 0) | 0
      if (lvl <= 1) lvl = 1
      block = sdiv32(imul32((dex - 0x0f) | 0, block), (lvl * 2) | 0)
    }
    return block >= 0x4b ? 0x4b : block
  }

  if (unitType === 1) {
    let hasMonBlock = false
    if (unit !== 0) {
      const cid = m.u32((unit + 0x04) >>> 0) | 0
      if (cid >= 0 && cid < (m.u32((sgpt + 0xa80) >>> 0) | 0)) {
        const pMon = (m.u32((sgpt + 0xa78) >>> 0) + imul32(cid, 0x1a8)) >>> 0
        if (pMon !== 0) {
          const bitMasks = m.u32(D2COMMON_GDWBITMASKS_IAT_VA_113C)
          if ((m.u8((pMon + 0x0f) >>> 0) & m.u32((bitMasks + 0x08) >>> 0)) !== 0) {
            hasMonBlock = true
          }
        }
      }
    }
    if (!hasMonBlock && UNITS_IsMonsterShieldEquipped113c(m, unit) === 0) {
      return 0
    }
    if (unit !== 0) {
      const pStatListEx = m.u32((unit + 0x5c) >>> 0)
      if (pStatListEx !== 0 && (m.u32((sgpt + 0xbd4) >>> 0) | 0) > 0x14) {
        const pIsc = (m.u32((sgpt + 0xbcc) >>> 0) + 0x1950) >>> 0
        if (pIsc !== 0) {
          block = getTotalStatWithMinFromList113c(m, pStatListEx, 0x140000, pIsc) | 0
          return block >= 0x4b ? 0x4b : block
        }
      }
    }
    return 0
  }

  return 0
}




