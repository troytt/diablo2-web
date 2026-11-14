/**
 * Diablo II v1.13c `D2Common.dll` dungeon / active-room leaf functions (`Dungeon.cpp` block, image base `0x6FD50000`).
 *
 * Every function below is a 1:1 port of the cited disassembly (`objdump -d -M intel` on the 1.13c image).
 * None of them calls another function. Register-convention (LTCG) arguments are explicit TS parameters, and
 * the doc comment of each function names the register that carries them. Signedness follows the branch
 * mnemonics: `jl/jg/jle/jge` are signed compares, `ja/jb/jae/jbe` are unsigned.
 *
 * Struct offsets come from `mem/layout.generated.ts` (`docs/oracle/route2-layout.json`). The two `.bss` globals
 * read by `DUNGEON_GetPortalLevelBit` are declared below with their writer/reader instruction VAs, because the
 * layout generator has no notion of globals.
 */
import type { Memory113c } from '../mem/sparse-memory.ts'
import { D2ActStrc, D2ActiveRoomStrc, D2DrlgLevelStrc, D2RoomExStrc } from '../mem/layout.generated.ts'
import { COLLISION_AllocAndBuildRoomGrid113c, COLLISION_FindFreePosition113c } from './collision.ts'
import {
  DRLGROOM_BuildRoomGridsAndTiles113c,
  DRLGROOM_DecrementNearRoomsStatus113c,
  DRLGROOM_EnsureRoomAndGetRoom1_113c,
  DRLGROOM_IncrementRoomAndNeighborsStatus113c,
} from './drlg/drlg-room.ts'
import { DRLGPRESET_LoadPresetRoomMap113c } from './drlg/preset.ts'
import { DRLGROOMTILE_FreeRoomResources113c } from './drlg/room-tile.ts'
import {
  DRLG_CountNonPresetRoomsInLevel113c,
  DRLG_GetLevel113c,
  DRLG_InitActTownFloorTileData113c,
  DRLG_UpdateInactiveLevels113c,
  DRLG_UpdateLevelActiveCount113c,
  SG_LEVEL_DEF_BIN_PTR_VA_6FDF0B38,
  SGPT_DATA_TABLES_PTR_VA_6FDE9E1C,
} from './drlg/drlg.ts'
import { DRLGLOGIC_GetRoomCoordListFromWorldSubtile113c, DRLGLOGIC_GetRoomCoordListIndexAtSubtile113c } from './drlg/drlg-logic.ts'
import {
  DRLG_AllocAndInitDrlg113c,
  DRLG_FindRoomExAtCoords113c,
  DRLG_InitLevelRooms113c,
  DRLGROOM_LoadDt1Files113c,
  DRLGROOM_PackAdjacentRooms113c,
} from './drlg/drlg-room.ts'
import { DRLGROOMTILE_GetWarpLevelsArray113c } from './drlg/room-tile.ts'
import { ENV_AllocDrlgEnvironment113c } from './env.ts'
import { D2CommonAssertError } from './inline-helpers.ts'
import { imul32, sdiv32 } from './int-math.ts'
import { SEED_PickRandomListNode113c } from '../prng.ts'
import { DRLGROOM_RefreshStatusFromCounts113c } from '../tables/missile-tbls-113c.ts'
import { UNITROOM_RemoveUnitFromRoom113c } from './unit.ts'

const DUNGEON_STACK_BASE = 0x7ffb0000
const DUNGEON_STACK_SIZE = 0x1000
const _dungeonStackBuf = new ArrayBuffer(DUNGEON_STACK_SIZE)
const _dungeonStackU8 = new Uint8Array(_dungeonStackBuf)
const _dungeonStackDV = new DataView(_dungeonStackBuf)

function withDungeonStackScratch113c(m: Memory113c): Memory113c {
  const isStack = (p: number): boolean => {
    const u = p >>> 0
    return u >= DUNGEON_STACK_BASE && u < DUNGEON_STACK_BASE + DUNGEON_STACK_SIZE
  }
  const self: Memory113c = {
    alloc: size => m.alloc(size),
    u8: p => (isStack(p) ? _dungeonStackU8[(p >>> 0) - DUNGEON_STACK_BASE]! : m.u8(p)),
    u16: p => (isStack(p) ? _dungeonStackDV.getUint16((p >>> 0) - DUNGEON_STACK_BASE, true) : m.u16(p)),
    u32: p => (isStack(p) ? _dungeonStackDV.getUint32((p >>> 0) - DUNGEON_STACK_BASE, true) : m.u32(p)),
    setU8: (p, v) => {
      if (isStack(p)) _dungeonStackU8[(p >>> 0) - DUNGEON_STACK_BASE] = v & 0xff
      else m.setU8(p, v)
    },
    setU16: (p, v) => {
      if (isStack(p)) _dungeonStackDV.setUint16((p >>> 0) - DUNGEON_STACK_BASE, v & 0xffff, true)
      else m.setU16(p, v)
    },
    setU32: (p, v) => {
      if (isStack(p)) _dungeonStackDV.setUint32((p >>> 0) - DUNGEON_STACK_BASE, v >>> 0, true)
      else m.setU32(p, v)
    },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      const p = ((base >>> 0) + f.off + idx * width) >>> 0
      return width === 1 ? self.u8(p) : width === 2 ? self.u16(p) : self.u32(p)
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4
      const p = ((base >>> 0) + f.off + idx * width) >>> 0
      if (width === 1) self.setU8(p, v)
      else if (width === 2) self.setU16(p, v)
      else self.setU32(p, v)
    },
    fill: (p, len, v) => {
      if (isStack(p)) {
        const off = (p >>> 0) - DUNGEON_STACK_BASE
        _dungeonStackU8.fill(v & 0xff, off, off + len)
      } else {
        m.fill(p, len, v)
      }
    },
  }
  return self
}

/**
 * `.bss` `int32_t* gpPortalLevelIds` at `0x6FDF1420` (array of level ids whose `LevelDefs.bin` `dwPortal` is set).
 * - Written by the `DATATBLS\LvlTbls.cpp` loader `0x6FDBCB50` at `0x6FDBCBB6` (`mov ds:0x6fdf1420, eax` after the alloc).
 * - Read by `0x6FD8BC46` (`mov eax, ds:0x6fdf1420`).
 */
export const G_PORTAL_LEVEL_IDS_VA_113C = 0x6fdf1420
/**
 * `.bss` `int32_t gnPortalLevelIds` at `0x6FDF1424` (element count of `gpPortalLevelIds`).
 * - Written at `0x6FDBCB86`. Read at `0x6FD8BC40` (`mov edx, ds:0x6fdf1424`). The sibling `0x6FD8BC80` asserts it is `<= 0x20`.
 */
export const G_PORTAL_LEVEL_COUNT_VA_113C = 0x6fdf1424

/** `D2RoomExStrc.dwFlags` bit toggled by `DUNGEON_ToggleHasPortalFlag` (`0x6FD8BC26 and ecx, 0xFFBFFFFF` / `0x6FD8BC32 or ecx, 0x400000`). */
export const DRLGROOMFLAG_HAS_PORTAL_113C = 0x00400000
/** `D2RoomExStrc.dwFlags` bit returned by `DUNGEON_CheckLOSDraw` for type-2 rooms (`0x6FD8BDBC and eax, 0x80000`). */
export const DRLGROOMFLAG_NO_LOS_DRAW_113C = 0x00080000

/**
 * `DRLG_IsTownLevel` index table at `0x6FD7D348` (109 bytes, one per `nLevelId - 1` in `0..0x6C`).
 * Copied byte-for-byte from the 1.13c image; `tests/oracle/k1/laneC-B001.test.ts` re-reads the PE bytes
 * at `0x6FD7D348` and compares them to this constant. Value `0` selects case 0 (town), `1` selects case 1.
 */
export const DRLG_ISTOWN_CASE_INDEX_6FD7D348 = Uint8Array.from(
  [
    0x00, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
    0x01, 0x00, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00,
  ],
)
/**
 * `DRLG_IsTownLevel` jump table at `0x6FD7D340` = `{0x6FD7D334, 0x6FD7D33A}`:
 * case 0 -> `0x6FD7D334 mov eax, 1; ret`, case 1 -> `0x6FD7D33A xor eax, eax; ret`.
 */
export const DRLG_ISTOWN_CASE_RESULT_6FD7D340: readonly [number, number] = [1, 0]

/**
 * `@va D2Common:0x6FD51330` (`DUNGEON_GetRoomAtPosition`, not exported; LTCG `eax = pRoom`, `ebx = nX`, `edi = nY`, plain `ret`).
 *
 * Returns `pRoom` when the subtile `(nX, nY)` lies inside it, otherwise the first non-NULL entry of
 * `pRoom->ppRoomsNear[0 .. nRoomsNear)` that contains it, otherwise `0`.
 * - `0x6FD51331 test eax, eax; jne` -> NULL room returns `0` (eax unchanged).
 * - `0x6FD51337..0x6FD51355`: `x >= X (jl)`, `x < X + W (jge, 32-bit wrapping add)`, `y >= Y`, `y < Y + H`, all signed.
 * - `0x6FD51357..0x6FD51398`: `ppRoomsNear (+0x00)`, `nRoomsNear (+0x24)`; the loop bound test is unsigned (`jbe`/`jb`).
 *   NULL near entries are skipped (`0x6FD5136D je`). A hit re-reads `ppRoomsNear[i]` (`0x6FD513A0`).
 */
export function DUNGEON_GetRoomAtPosition113c(m: Memory113c, pRoom: number, nX: number, nY: number): number {
  if (pRoom === 0) return 0
  const x = nX | 0
  const y = nY | 0
  const roomX = m.get(pRoom, D2ActiveRoomStrc.nSubtileX) | 0
  if (x >= roomX) {
    if (x < ((m.get(pRoom, D2ActiveRoomStrc.nSubtileWidth) + roomX) | 0)) {
      const roomY = m.get(pRoom, D2ActiveRoomStrc.nSubtileY) | 0
      if (y >= roomY) {
        if (y < ((m.get(pRoom, D2ActiveRoomStrc.nSubtileHeight) + roomY) | 0)) return pRoom >>> 0
      }
    }
  }
  const nRoomsNear = m.get(pRoom, D2ActiveRoomStrc.nRoomsNear) >>> 0
  const ppRoomsNear = m.get(pRoom, D2ActiveRoomStrc.ppRoomsNear)
  for (let i = 0; i < nRoomsNear; i++) {
    const pNear = m.u32((ppRoomsNear + i * 4) >>> 0)
    if (pNear === 0) continue
    if (x < (m.get(pNear, D2ActiveRoomStrc.nSubtileX) | 0)) continue
    const endX = (m.get(pNear, D2ActiveRoomStrc.nSubtileWidth) + m.get(pNear, D2ActiveRoomStrc.nSubtileX)) | 0
    if (x >= endX) continue
    if (y < (m.get(pNear, D2ActiveRoomStrc.nSubtileY) | 0)) continue
    const endY = (m.get(pNear, D2ActiveRoomStrc.nSubtileHeight) + m.get(pNear, D2ActiveRoomStrc.nSubtileY)) | 0
    if (y < endY) return m.u32((ppRoomsNear + i * 4) >>> 0)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD7D320` (`DRLG_IsTownLevel`, not exported; LTCG `eax = nLevelId`, plain `ret`).
 *
 * `0x6FD7D320 dec eax; cmp eax, 0x6C; ja -> return 0` (unsigned, so `nLevelId <= 0` and `> 0x6D` return 0),
 * then `movzx eax, byte [eax + 0x6FD7D348]; jmp [eax*4 + 0x6FD7D340]`.
 * Not to be confused with `DUNGEON_CheckRoomIsTown` (`0x6FD8C390`), which calls this with `pLevel->nLevelId`.
 */
export function DRLG_IsTownLevel113c(nLevelId: number): number {
  const t = (nLevelId - 1) >>> 0
  if (t > 0x6c) return 0
  return DRLG_ISTOWN_CASE_RESULT_6FD7D340[DRLG_ISTOWN_CASE_INDEX_6FD7D348[t]!]!
}

/**
 * `@va D2Common:0x6FD8B6B0` (`D2Common.#10345` `DUNGEON_IncreaseRoomPlayerCount`, stdcall 1 arg, `ret 4`).
 *
 * `0x6FD8B6B4 test eax, eax; je` then `0x6FD8B6B8 inc dword [eax + 0x28]` (`D2ActiveRoomStrc.nPlayers`, wraps).
 */
export function DUNGEON_IncreaseRoomPlayerCount113c(m: Memory113c, pRoom: number): void {
  if (pRoom === 0) return
  m.set(pRoom, D2ActiveRoomStrc.nPlayers, (m.get(pRoom, D2ActiveRoomStrc.nPlayers) + 1) >>> 0)
}

/**
 * `@va D2Common:0x6FD8B710` (`D2Common.#11010` `DUNGEON_FindRoomBySubtileCoordinates`, stdcall `(pAct, nX, nY)`, `ret 0xC`).
 *
 * Walks `pAct->pRoom1 (+0x10)` through `pRoomNext (+0x7C)` and returns the first room whose subtile rectangle
 * contains `(nX, nY)`: `0x6FD8B72F..0x6FD8B74A` signed `jl/jge` with wrapping `X + W` / `Y + H`. NULL act -> `0`.
 */
export function DUNGEON_FindRoomBySubtileCoordinates113c(m: Memory113c, pAct: number, nX: number, nY: number): number {
  if (pAct === 0) return 0
  const x = nX | 0
  const y = nY | 0
  for (let pRoom = m.get(pAct, D2ActStrc.pRoom1); pRoom !== 0; pRoom = m.get(pRoom, D2ActiveRoomStrc.pRoomNext)) {
    const roomX = m.get(pRoom, D2ActiveRoomStrc.nSubtileX) | 0
    if (x < roomX) continue
    if (x >= ((m.get(pRoom, D2ActiveRoomStrc.nSubtileWidth) + roomX) | 0)) continue
    const roomY = m.get(pRoom, D2ActiveRoomStrc.nSubtileY) | 0
    if (y < roomY) continue
    if (y < ((m.get(pRoom, D2ActiveRoomStrc.nSubtileHeight) + roomY) | 0)) return pRoom >>> 0
  }
  return 0
}

/**
 * `D2DrlgRoomTilesStrc` field offsets. The struct is not heap-allocated on its own: it is embedded at `+0x14`
 * of the `0x2C`-byte tile grid (`0x6FD5C977 mov edx, 0x2C` alloc, stored to `D2RoomExStrc +0x54` at `0x6FD5C98A`),
 * and `D2ActiveRoomStrc.pRoomTiles (+0x08)` points at it (`0x6FD7E230 mov ecx, [esi+0x54]; 0x6FD7E23A add ecx, 0x14`,
 * passed to the room allocator which stores it at `0x6FD8C79F mov [ebx+0x8], edx`). Field evidence from the three
 * sibling getters (`ret = +0/+8/+0x10`, `*out = +4/+0xC/+0x14`): walls `0x6FD8BB3A/0x6FD8BB46`, floors
 * `0x6FD8BB5F mov edx, [ecx+0xC]` / `0x6FD8BB6B mov eax, [edx+0x8]`, roofs `0x6FD8BAFA/0x6FD8BB06`.
 */
export const D2DRLG_ROOMTILES_PFLOORTILES_OFF_113C = 0x08
export const D2DRLG_ROOMTILES_NFLOORS_OFF_113C = 0x0c

/**
 * `@va D2Common:0x6FD8BB50` (`D2Common.#10544` `DUNGEON_GetFloorTilesFromRoom`, stdcall `(pRoom, int* pnFloors)`, `ret 8`).
 *
 * - `pRoom != 0 && pRoom->pRoomTiles (+0x08) != 0`: `*pnFloors = tiles->nFloors (+0xC)` (`0x6FD8BB66`), then re-reads
 *   `pRoom->pRoomTiles` (`0x6FD8BB68`) and returns `tiles->pFloorTiles (+0x8)`.
 * - otherwise `*pnFloors = 0` (`0x6FD8BB75`) and returns `0`. `pnFloors` is never NULL-checked.
 */
export function DUNGEON_GetFloorTilesFromRoom113c(m: Memory113c, pRoom: number, pnFloors: number): number {
  if (pRoom !== 0) {
    const pTiles = m.get(pRoom, D2ActiveRoomStrc.pRoomTiles)
    if (pTiles !== 0) {
      m.setU32(pnFloors, m.u32((pTiles + D2DRLG_ROOMTILES_NFLOORS_OFF_113C) >>> 0))
      const pTilesAgain = m.get(pRoom, D2ActiveRoomStrc.pRoomTiles)
      return m.u32((pTilesAgain + D2DRLG_ROOMTILES_PFLOORTILES_OFF_113C) >>> 0)
    }
  }
  m.setU32(pnFloors, 0)
  return 0
}

/**
 * `@va D2Common:0x6FD8BC10` (`D2Common.#10346` `DUNGEON_ToggleHasPortalFlag`, stdcall `(pRoom, bReset)`, `ret 8`).
 *
 * NULL room -> no-op. Otherwise `pRoomEx = pRoom->pRoomEx (+0x10)`; a **nonzero** `bReset` clears bit `0x400000` of
 * `pRoomEx->dwFlags (+0x28)` (`0x6FD8BC26`), zero sets it (`0x6FD8BC32`). `pRoomEx` is not NULL-checked.
 */
export function DUNGEON_ToggleHasPortalFlag113c(m: Memory113c, pRoom: number, bReset: number): void {
  if (pRoom === 0) return
  const pRoomEx = m.get(pRoom, D2ActiveRoomStrc.pRoomEx)
  const flags = m.get(pRoomEx, D2RoomExStrc.dwFlags)
  if (bReset !== 0) m.set(pRoomEx, D2RoomExStrc.dwFlags, (flags & ~DRLGROOMFLAG_HAS_PORTAL_113C) >>> 0)
  else m.set(pRoomEx, D2RoomExStrc.dwFlags, (flags | DRLGROOMFLAG_HAS_PORTAL_113C) >>> 0)
}

/**
 * `@va D2Common:0x6FD8BC40` (`D2Common.#10805` `DUNGEON_GetPortalLevelBit`, stdcall `(nLevelId)`, `ret 4`).
 *
 * `n = *(int*)0x6FDF1424; a = *(int**)0x6FDF1420` (both read up front, `0x6FD8BC40/0x6FD8BC46`); for `i` in `0 .. n)`
 * (signed `jle`/`jl`): if `a[i] == nLevelId` return `1 << (i & 31)` (`0x6FD8BC68 mov eax, 1; shl eax, cl`); else `0`.
 */
export function DUNGEON_GetPortalLevelBit113c(m: Memory113c, nLevelId: number): number {
  const n = m.u32(G_PORTAL_LEVEL_COUNT_VA_113C) | 0
  const pIds = m.u32(G_PORTAL_LEVEL_IDS_VA_113C)
  for (let i = 0; i < n; i++) {
    if ((nLevelId | 0) === (m.u32((pIds + i * 4) >>> 0) | 0)) return (1 << (i & 31)) >>> 0
  }
  return 0
}

/**
 * `@va D2Common:0x6FD8BDA0` (`D2Common.#10685` `DUNGEON_CheckLOSDraw`, stdcall `(pRoom)`, `ret 4`).
 *
 * NULL -> `0`. `pRoomEx = pRoom->pRoomEx (+0x10)`; switch on `pRoomEx->nType (+0x48)` (`dec eax; je / dec eax; je`):
 * type 1 -> `1` (`0x6FD8BDC4`), type 2 -> `pRoomEx->dwFlags & 0x80000` (`0x6FD8BDB9`, the raw masked bit, not 1),
 * any other type -> `0`.
 */
export function DUNGEON_CheckLOSDraw113c(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) return 0
  const pRoomEx = m.get(pRoom, D2ActiveRoomStrc.pRoomEx)
  const nType = m.get(pRoomEx, D2RoomExStrc.nType) | 0
  if (nType === 1) return 1
  if (nType === 2) return (m.get(pRoomEx, D2RoomExStrc.dwFlags) & DRLGROOMFLAG_NO_LOS_DRAW_113C) >>> 0
  return 0
}

/**
 * `@va D2Common:0x6FD8C000` (`D2Common.#10826` `DUNGEON_GetLevelIdFromRoom`, stdcall `(pRoom)`, `ret 4`).
 *
 * NULL -> `0`; otherwise `pRoom->pRoomEx (+0x10)->pLevel (+0x58)->nLevelId (+0x1D0)` with no further NULL checks
 * (`0x6FD8C00B / 0x6FD8C00E / 0x6FD8C011`).
 */
export function DUNGEON_GetLevelIdFromRoom113c(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) return 0
  const pRoomEx = m.get(pRoom, D2ActiveRoomStrc.pRoomEx)
  const pLevel = m.get(pRoomEx, D2RoomExStrc.pLevel)
  return m.get(pLevel, D2DrlgLevelStrc.nLevelId) | 0
}

/**
 * `@va D2Common:0x6FD7D600` (`DRLG_GetRoomExFromCoordinates113c`, custom `eax = pDrlg`, `edi = nX`, `esi = nY`, plain `ret`).
 *
 * Walks `pDrlg->pRoomEx (+0x10)` via `pRoomExNext (+0x24)` and returns the first `D2RoomExStrc*`
 * whose tile box `[nTileXPos..nTileXPos+nTileWidth) x [nTileYPos..nTileYPos+nTileHeight)` (`+0x34/+0x38/+0x3C/+0x40`)
 * contains `(nX, nY)` (signed comparisons), or `0` if none matches.
 */
export function DRLG_GetRoomExFromCoordinates113c(
  m: Memory113c,
  eax: number,
  edi: number,
  esi: number,
): number {
  if (eax === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Drlg.cpp', 765)
  }
  let pRoomEx = m.u32((eax + 0x10) >>> 0)
  if (pRoomEx === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Drlg.cpp', 766)
  }
  const x = edi | 0
  const y = esi | 0
  do {
    const rx = m.u32((pRoomEx + 0x34) >>> 0) | 0
    if (x >= rx) {
      const ry = m.u32((pRoomEx + 0x38) >>> 0) | 0
      if (y >= ry) {
        const rw = m.u32((pRoomEx + 0x3c) >>> 0) | 0
        if (x < ((rx + rw) | 0)) {
          const rh = m.u32((pRoomEx + 0x40) >>> 0) | 0
          if (y < ((ry + rh) | 0)) {
            return pRoomEx >>> 0
          }
        }
      }
    }
    pRoomEx = m.u32((pRoomEx + 0x24) >>> 0)
  } while (pRoomEx !== 0)
  return 0
}

/**
 * `@va D2Common:0x6FD8B350` (`D2Common.#10557` `DUNGEON_UpdateRoomIdleCounter`, stdcall `(pRoom)`, `ret 4`).
 *
 * If `pRoom->nNumClients (+0x78) != 0`, resets `pRoom->nIdleCounter (+0x0C) = 0` and returns `0`;
 * otherwise increments `pRoom->nIdleCounter` and returns the new value.
 */
export function DUNGEON_UpdateRoomIdleCounter113c(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1198)
  }
  const nClients = m.u32((pRoom + 0x78) >>> 0)
  if (nClients !== 0) {
    m.setU32((pRoom + 0x0c) >>> 0, 0)
    return m.u32((pRoom + 0x0c) >>> 0) | 0
  }
  const next = ((m.u32((pRoom + 0x0c) >>> 0) | 0) + 1) | 0
  m.setU32((pRoom + 0x0c) >>> 0, next >>> 0)
  return next
}

/**
 * `@va D2Common:0x6FD8B3A0` (`DUNGEON_VerifyRoomClientsNonNull113c`, fastcall `ecx = pRoom`, plain `ret`).
 *
 * Verifies that all `pRoom->nNumClients (+0x78)` entries in `pRoom->pClientList (+0x48)` are non-NULL,
 * then returns `1`.
 */
export function DUNGEON_VerifyRoomClientsNonNull113c(m: Memory113c, ecx: number): number {
  const nClients = m.u32((ecx + 0x78) >>> 0)
  if (nClients > 0) {
    let pList = m.u32((ecx + 0x48) >>> 0)
    for (let i = 0; i < nClients; i++, pList = (pList + 4) >>> 0) {
      if (m.u32(pList) === 0) {
        throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1107)
      }
    }
  }
  return 1
}

/**
 * `@va D2Common:0x6FD8B3F0` (`D2Common.#10627` `DUNGEON_SetRoomFlag2`, stdcall `(pRoom, bSet)`, `ret 8`).
 *
 * Sets (`bSet != 0`) or clears (`bSet == 0`) bit `0x02` on `pRoom->dwFlags (+0x34)`.
 */
export function DUNGEON_SetRoomFlag2_113c(m: Memory113c, pRoom: number, bSet: number): void {
  if (pRoom === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1080)
  }
  const flags = m.u32((pRoom + 0x34) >>> 0)
  if (bSet !== 0) {
    m.setU32((pRoom + 0x34) >>> 0, (flags | 0x02) >>> 0)
  } else {
    m.setU32((pRoom + 0x34) >>> 0, (flags & ~0x02) >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD8B440` (`D2Common.#11035` `DUNGEON_CheckRoomFlag2`, stdcall `(pRoom)`, `ret 4`).
 *
 * Returns `pRoom->dwFlags (+0x34) & 0x02`.
 */
export function DUNGEON_CheckRoomFlag2_113c(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1071)
  }
  return (m.u32((pRoom + 0x34) >>> 0) & 0x02) >>> 0
}

/**
 * `@va D2Common:0x6FD8B470` (`D2Common.#10275` `DUNGEON_GetRoomPortalList`, stdcall `(pRoom)`, `ret 4`).
 *
 * Returns `pRoom->pPortalNodes (+0x18)`.
 */
export function DUNGEON_GetRoomPortalList113c(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 934)
  }
  return m.u32((pRoom + 0x18) >>> 0)
}

/**
 * `@va D2Common:0x6FD8B4A0` (`DUNGEON_FreeRoomPortalList113c`, stdcall `(pRoom)`, `ret 4`).
 *
 * Walks `pRoom->pPortalNodes (+0x18)` (next at `+0x08`), freeing each node via `Fog.#10046` with
 * `pRoom->pAct (+0x2C)->pMemPool (+0x5C)`, and zeroes `pRoom->pPortalNodes`.
 */
export function DUNGEON_FreeRoomPortalList113c(m: Memory113c, pRoom: number): void {
  if (pRoom === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 912)
  }
  const pAct = m.u32((pRoom + 0x2c) >>> 0)
  let pNode = m.u32((pRoom + 0x18) >>> 0)
  void m.u32((pAct + 0x5c) >>> 0)
  if (pNode !== 0) {
    const freeFn = (m as { free?: (p: number) => void }).free
    do {
      const cur = pNode
      pNode = m.u32((pNode + 0x08) >>> 0)
      freeFn?.call(m, cur)
    } while (pNode !== 0)
    m.setU32((pRoom + 0x18) >>> 0, 0)
  }
}

/**
 * `@va D2Common:0x6FD8B500` (`D2Common.#10903` `DUNGEON_AddRoomPortalNode`, stdcall `(pRoom, nField0, nField4)`, `ret 0xC`).
 *
 * If `pRoom != 0`, allocates a 12-byte portal node via `Fog.#10045` (`[nField0, nField4, pRoom->pPortalNodes]`),
 * prepends it to `pRoom->pPortalNodes (+0x18)`, and sets `pRoom->pAct (+0x2C)->bHasPendingPortalUpdates (+0x58) = 1`.
 */
export function DUNGEON_AddRoomPortalNode113c(
  m: Memory113c,
  pRoom: number,
  nField0: number,
  nField4: number,
): void {
  if (pRoom === 0) return
  const pAct0 = m.u32((pRoom + 0x2c) >>> 0)
  void m.u32((pAct0 + 0x5c) >>> 0)
  const pNode = m.alloc(0x0c)
  m.setU32(pNode, nField0 >>> 0)
  m.setU32((pNode + 0x04) >>> 0, nField4 >>> 0)
  const prevHead = m.u32((pRoom + 0x18) >>> 0)
  m.setU32((pNode + 0x08) >>> 0, prevHead)
  const pAct = m.u32((pRoom + 0x2c) >>> 0)
  m.setU32((pRoom + 0x18) >>> 0, pNode)
  m.setU32((pAct + 0x58) >>> 0, 1)
}

/**
 * `@va D2Common:0x6FD8B550` (`D2Common.#10055` `DUNGEON_GetRoomExFromRoom`, stdcall `(pRoom)`, `ret 4`).
 *
 * Returns `pRoom->pRoomEx (+0x10)`.
 */
export function DUNGEON_GetRoomExFromRoom113c(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 798)
  }
  return m.u32((pRoom + 0x10) >>> 0)
}

/**
 * `@va D2Common:0x6FD8B5B0` (`DUNGEON_GetCollisionGridFromRoomFast113c`, custom `eax = pRoom`, plain `ret`).
 *
 * Returns `pRoom->pCollisionGrid (+0x20)`.
 */
export function DUNGEON_GetCollisionGridFromRoomFast113c(m: Memory113c, eax: number): number {
  if (eax === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 709)
  }
  return m.u32((eax + 0x20) >>> 0)
}

/**
 * `@va D2Common:0x6FD8BA20` (`D2Common.#10786` `DUNGEON_GetAdjacentRoomsListFromRoom`, stdcall `(pRoom, pppRoomsNear, pnRoomsNear)`, `ret 0xC`).
 *
 * Stores `pRoom->nRoomsNear (+0x24)` to `*pnRoomsNear` and `pRoom->ppRoomsNear (+0x00)` to `*pppRoomsNear`.
 */
export function DUNGEON_GetAdjacentRoomsListFromRoom113c(
  m: Memory113c,
  pRoom: number,
  pppRoomsNear: number,
  pnRoomsNear: number,
): void {
  if (pRoom === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 236)
  }
  const nNear = m.u32((pRoom + 0x24) >>> 0)
  m.setU32(pnRoomsNear, nNear)
  const ppNear = m.u32(pRoom)
  m.setU32(pppRoomsNear, ppNear)
}

/**
 * `@va D2Common:0x6FD8BA60` (`D2Common.#10035` `DUNGEON_GetRoomCoordinates`, stdcall `(pRoom, pOutCoords)`, `ret 8`).
 *
 * Copies the 8 dwords at `pRoom + 0x4C .. pRoom + 0x68` (`D2DrlgCoordsStrc`) to `pOutCoords`,
 * or zeroes the 8 dwords at `pOutCoords` if `pRoom == 0`.
 */
export function DUNGEON_GetRoomCoordinates113c(
  m: Memory113c,
  pRoom: number,
  pOutCoords: number,
): void {
  if (pOutCoords === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 209)
  }
  if (pRoom === 0) {
    for (let i = 0; i < 8; i++) {
      m.setU32((pOutCoords + i * 4) >>> 0, 0)
    }
    return
  }
  for (let i = 0; i < 8; i++) {
    m.setU32((pOutCoords + i * 4) >>> 0, m.u32((pRoom + 0x4c + i * 4) >>> 0))
  }
}

/**
 * `@va D2Common:0x6FD8BD60` (`D2Common.#10006` `DUNGEON_GetLogicalRoomField30`, stdcall `(pRoom)`, `ret 4`).
 *
 * Reads `pLogical = pRoom->pRoomEx (+0x10)->pLogicalRoomInfo (+0x64)`, asserts `pLogical != 0`,
 * and returns `*[pLogical + 0x30]`.
 */
export function DUNGEON_GetLogicalRoomField30_113c(m: Memory113c, pRoom: number): number {
  const pRoomEx = m.u32((pRoom + 0x10) >>> 0)
  const pLogical = m.u32((pRoomEx + 0x64) >>> 0)
  if (pLogical === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 717)
  }
  return m.u32((pLogical + 0x30) >>> 0) | 0
}

/**
 * `@va D2Common:0x6FD8BDD0` (`DUNGEON_SortRoomClientArray113c`, custom `eax = pRoom`, `ret`).
 *
 * Verifies all client pointers via `0x6FD8B3A0` (`DUNGEON_VerifyRoomClientsNonNull113c`), bubble-sorts
 * `pRoom->pClientList (+0x48)` of length `pRoom->nNumClients (+0x78)` in ascending unsigned pointer order,
 * and re-verifies non-null entries if the outer loop runs to completion.
 */
export function DUNGEON_SortRoomClientArray113c(m: Memory113c, pRoom: number): void {
  const room = pRoom >>> 0
  if (DUNGEON_VerifyRoomClientsNonNull113c(m, room) === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1115)
  }
  let edi = ((m.u32((room + 0x78) >>> 0) | 0) - 1) | 0
  if (edi > 0) {
    while (edi > 0) {
      let bSwapped = 0
      for (let ecx = 0; ecx < edi; ecx++) {
        const pArr = m.u32((room + 0x48) >>> 0)
        const a = m.u32((pArr + ecx * 4) >>> 0)
        const b = m.u32((pArr + ecx * 4 + 4) >>> 0)
        if ((a >>> 0) > (b >>> 0)) {
          const pArr2 = m.u32((room + 0x48) >>> 0)
          const vNext = m.u32((pArr2 + ecx * 4 + 4) >>> 0)
          const vCur = m.u32((pArr2 + ecx * 4) >>> 0)
          m.setU32((pArr2 + ecx * 4) >>> 0, vNext)
          const pArr3 = m.u32((room + 0x48) >>> 0)
          m.setU32((pArr3 + ecx * 4 + 4) >>> 0, vCur)
          bSwapped = 1
        }
      }
      if (bSwapped === 0) {
        return
      }
      edi = (edi - 1) | 0
    }
  }
  const nCount = m.u32((room + 0x78) >>> 0)
  if (nCount > 0) {
    const pArr = m.u32((room + 0x48) >>> 0)
    for (let i = 0; i < nCount; i++) {
      if (m.u32((pArr + i * 4) >>> 0) === 0) {
        throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1107)
      }
    }
  }
}

/**
 * `@va D2Common:0x6FD8BE90` (`DUNGEON_AreAllAdjacentRoomsActive113c`, stdcall `(pRoom)`, `ret 4`).
 *
 * Returns `1` iff `pRoom->nRoomsNear (+0x24) == pRoom->pRoomEx (+0x10)->nRoomsNear (+0x2C)` and every
 * entry in `pRoom->ppRoomsNear[0..nRoomsNear)` has `(pAdj->dwFlags (+0x34) & 1) != 0`.
 */
export function DUNGEON_AreAllAdjacentRoomsActive113c(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1007)
  }
  const pRoomEx = m.u32((pRoom + 0x10) >>> 0)
  const nExNear = m.u32((pRoomEx + 0x2c) >>> 0)
  const nNear = m.u32((pRoom + 0x24) >>> 0)
  if (nNear !== nExNear) return 0
  if (nNear > 0) {
    const ppNear = m.u32(pRoom)
    for (let i = 0; i < nNear; i++) {
      const pAdj = m.u32((ppNear + i * 4) >>> 0)
      if ((m.u8((pAdj + 0x34) >>> 0) & 0x01) === 0) {
        return 0
      }
    }
  }
  return 1
}

/**
 * `@va D2Common:0x6FD8BF60` (`D2Common.#10615` `DUNGEON_HasRoomExWaypointFlags`, stdcall `(pRoom)`, `ret 4`).
 *
 * Returns `1` if `(pRoom->pRoomEx (+0x10)->dwFlags (+0x28) & 0x30000) != 0`, else `0`.
 */
export function DUNGEON_HasRoomExWaypointFlags113c(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 867)
  }
  const pRoomEx = m.u32((pRoom + 0x10) >>> 0)
  if (pRoomEx === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 630)
  }
  return (m.u32((pRoomEx + 0x28) >>> 0) & 0x30000) !== 0 ? 1 : 0
}

/**
 * `@va D2Common:0x6FD8BFB0` (`D2Common.#10057` `DUNGEON_GetLevelIdIfNotHidden`, stdcall `(pRoom)`, `ret 4`).
 *
 * Returns `0` if `pRoom == 0` or `(pRoom->pRoomEx->dwFlags (+0x28) & 0x800000) != 0`; otherwise returns
 * `pRoom->pRoomEx->pLevel (+0x58)->nLevelId (+0x1D0)`.
 */
export function DUNGEON_GetLevelIdIfNotHidden113c(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) return 0
  const pRoomEx = m.u32((pRoom + 0x10) >>> 0)
  if (pRoomEx === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 619)
  }
  if ((m.u32((pRoomEx + 0x28) >>> 0) & 0x800000) !== 0) {
    return 0
  }
  const pLevel = m.u32((pRoomEx + 0x58) >>> 0)
  return m.u32((pLevel + 0x1d0) >>> 0) | 0
}

/**
 * `@va D2Common:0x6FD8C020` (`D2Common.#10142` `DUNGEON_AcquireRoomExDT1Mask`, stdcall `(pRoom)`, `ret 4`).
 *
 * Reads `flags = pRoom->pRoomEx (+0x10)->dwFlags (+0x28)`. If `(flags & 0x40000) != 0`, returns
 * `pRoomEx->dwDT1Mask (+0x5C)` without modifying `dwFlags`. Otherwise, if `(flags & 0x4000000) != 0`,
 * returns `0`; else sets `pRoomEx->dwFlags |= 0x4000000` and returns `pRoomEx->dwDT1Mask (+0x5C)`.
 */
export function DUNGEON_AcquireRoomExDT1Mask113c(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 699)
  }
  const pRoomEx = m.u32((pRoom + 0x10) >>> 0)
  const flags = m.u32((pRoomEx + 0x28) >>> 0)
  if ((flags & 0x40000) === 0) {
    if ((flags & 0x4000000) !== 0) {
      return 0
    }
    m.setU32((pRoomEx + 0x28) >>> 0, (flags | 0x4000000) >>> 0)
  }
  return m.u32((pRoomEx + 0x5c) >>> 0)
}

/**
 * `@va D2Common:0x6FD8C200` (`DUNGEON_AllocAndBuildRoomNeighborList113c`, custom `esi = pRoom`, `ecx = pMemPool`, `ret`).
 *
 * Allocates `pRoom->ppRoomsNear (+0x00)` of size `pRoom->pRoomEx (+0x10)->nRoomsNear (+0x2C) * 4`,
 * packs active neighbor rooms via `0x6FD94540` (`DRLGROOM_PackAdjacentRooms113c`), and refreshes each
 * distinct neighbor's `ppRoomsNear` and `nRoomsNear (+0x24)`.
 */
export function DUNGEON_AllocAndBuildRoomNeighborList113c(
  m: Memory113c,
  pRoom: number,
  _pMemPool = 0,
): void {
  const room = pRoom >>> 0
  const pRoomEx = m.u32((room + 0x10) >>> 0)
  const nCap = m.u32((pRoomEx + 0x2c) >>> 0)
  const ppRoomsNear = m.alloc((nCap * 4) >>> 0)
  m.setU32(room, ppRoomsNear)

  const nCount = DRLGROOM_PackAdjacentRooms113c(m, pRoomEx, ppRoomsNear) >>> 0
  m.setU32((room + 0x24) >>> 0, nCount)

  for (let i = 0; (i >>> 0) < (m.u32((room + 0x24) >>> 0) >>> 0); i++) {
    const pArr = m.u32(room)
    const pNeighbor = m.u32((pArr + i * 4) >>> 0)
    if (pNeighbor === 0) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 264)
    }
    if (pNeighbor !== room) {
      const nSubCount = DRLGROOM_PackAdjacentRooms113c(
        m,
        m.u32((pNeighbor + 0x10) >>> 0),
        m.u32(pNeighbor),
      )
      m.setU32((pNeighbor + 0x24) >>> 0, nSubCount >>> 0)
    }
  }
}

/**
 * `@va D2Common:0x6FD8C330` (`D2Common.#10099` `DUNGEON_CheckPresetRoomFlag80`, stdcall `(pRoom)`, `ret 4`).
 *
 * If `pRoom->pRoomEx (+0x10)->nType (+0x48) == 1`, returns `pRoomEx->pPresetType2info (+0x20)->fFlags (+0x54) & 0x80`;
 * otherwise returns `0`.
 */
export function DUNGEON_CheckPresetRoomFlag80_113c(m: Memory113c, pRoom: number): number {
  if (pRoom === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1445)
  }
  const pRoomEx = m.u32((pRoom + 0x10) >>> 0)
  const nType = m.u32((pRoomEx + 0x48) >>> 0) | 0
  if (nType !== 1) return 0
  const pPreset = m.u32((pRoomEx + 0x20) >>> 0)
  return (m.u32((pPreset + 0x54) >>> 0) & 0x80) >>> 0
}

/**
 * `@va D2Common:0x6FD8C870` (`DUNGEON_FreeRoomAndDetachUnits113c`, custom `edi = pRoom`, `[esp+4] = pMemPool`, `ret 4`).
 *
 * Detaches all units on `pRoom->pUnitFirst (+0x74)` via `0x6FDB6700` (`UNITROOM_RemoveUnitFromRoom113c`),
 * frees `pRoom->pCollisionGrid (+0x20)`, calls `0x6FD8B4A0` (`DUNGEON_FreeRoomPortalList113c`),
 * and frees `pRoom->pClientList (+0x48)`, `pRoom->ppRoomsNear (+0x00)`, and `pRoom` via `Fog.#10046`.
 */
export function DUNGEON_FreeRoomAndDetachUnits113c(
  m: Memory113c,
  pRoom: number,
  _pMemPool = 0,
): void {
  const room = pRoom >>> 0
  let pUnit = m.u32((room + 0x74) >>> 0)
  while (pUnit !== 0) {
    const dwFlags = m.u32((pUnit + 0xc4) >>> 0)
    if (((dwFlags >>> 0x16) & 1) === 0) {
      m.setU32((pUnit + 0xc8) >>> 0, (m.u32((pUnit + 0xc8) >>> 0) | 0x20) >>> 0)
    }
    m.setU32((pUnit + 0xc4) >>> 0, (dwFlags | 0x800000) >>> 0)

    const nType = m.u32(pUnit) | 0
    const pPath = m.u32((pUnit + 0x2c) >>> 0)
    if (nType === 2 || (nType > 3 && nType <= 5)) {
      if (m.u32(pPath) !== 0) {
        UNITROOM_RemoveUnitFromRoom113c(m, pUnit)
      }
      m.setU32(pPath, 0)
    } else {
      const zero5c = m.u32(0x6fddd45c)
      const zero58 = m.u32(0x6fddd458)
      m.setU32((pPath + 0x04) >>> 0, zero5c)
      m.setU32((pPath + 0x0c) >>> 0, zero5c)
      const pPathRoom = m.u32((pPath + 0x1c) >>> 0)
      m.setU32(pPath, zero58)
      m.setU32((pPath + 0x08) >>> 0, zero58)
      m.setU32((pPath + 0x28) >>> 0, 0)
      if (pPathRoom !== 0) {
        m.setU32((pPath + 0x20) >>> 0, pPathRoom)
        UNITROOM_RemoveUnitFromRoom113c(m, m.u32((pPath + 0x30) >>> 0))
        m.setU32((pPath + 0x34) >>> 0, (m.u32((pPath + 0x34) >>> 0) | 0x02) >>> 0)
      }
    }
    pUnit = m.u32((room + 0x74) >>> 0)
  }

  const freeFn = (m as { free?: (p: number) => void }).free
  const pCollGrid = m.u32((room + 0x20) >>> 0)
  if (pCollGrid !== 0) {
    freeFn?.call(m, pCollGrid)
    m.setU32((room + 0x20) >>> 0, 0)
  }
  DUNGEON_FreeRoomPortalList113c(m, room)
  const pClients = m.u32((room + 0x48) >>> 0)
  if (pClients !== 0) {
    const pAct = m.u32((room + 0x2c) >>> 0)
    void m.u32((pAct + 0x5c) >>> 0)
    freeFn?.call(m, pClients)
  }
  const ppRoomsNear = m.u32(room)
  if (ppRoomsNear !== 0) {
    freeFn?.call(m, ppRoomsNear)
  }
  if (room !== 0) {
    freeFn?.call(m, room)
  }
}

/**
 * `@va D2Common:0x6FDCBA00` (`DUNGEON_ShouldDeactivateRoomEx113c`, custom `edx = pRoomEx`, `ret`).
 *
 * Returns `0` if `(pRoomEx->dwFlags & 0x400000) != 0` or `pRoomEx->fRoomStatus (+0x44) <= 1`.
 * For town levels (`0x6FD7D320`) or Arreat Summit (`120`), returns `0` if any room in
 * `pLevel->pFirstRoomEx (+0x10)` has `fRoomStatus <= 1`. Otherwise returns `1`.
 */
export function DUNGEON_ShouldDeactivateRoomEx113c(m: Memory113c, pRoomEx: number): number {
  const roomEx = pRoomEx >>> 0
  if ((m.u32((roomEx + 0x28) >>> 0) & 0x400000) !== 0) {
    return 0
  }
  const pLevel = m.u32((roomEx + 0x58) >>> 0)
  if (pLevel === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\MissileTbls.cpp', 1068)
  }
  const pDrlg = m.u32((pLevel + 0x1b4) >>> 0)
  if (pDrlg === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\MissileTbls.cpp', 1069)
  }
  if ((m.u8((pDrlg + 0x8c) >>> 0) & 0x01) !== 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\MissileTbls.cpp', 743)
  }
  if (m.u8((roomEx + 0x44) >>> 0) <= 1) {
    return 0
  }
  const nLevelId = m.u32((pLevel + 0x1d0) >>> 0) | 0
  if (DRLG_IsTownLevel113c(nLevelId) !== 0 || nLevelId === 0x78) {
    let pCur = m.u32((pLevel + 0x10) >>> 0)
    while (pCur !== 0) {
      if (m.u8((pCur + 0x44) >>> 0) <= 1) {
        return 0
      }
      pCur = m.u32((pCur + 0x24) >>> 0)
    }
  }
  return 1
}

/**
 * `@va D2Common:0x6FD8B230` (`D2Common.#10416` `DUNGEON_IsTownLevelId113c`, `__stdcall(nLevelId) -> BOOL`, `ret 4`).
 *
 * Delegates to `DRLG_IsTownLevel113c` (`0x6FD7D320`).
 */
export function DUNGEON_IsTownLevelId113c(_m: Memory113c, nLevelId: number): number {
  return DRLG_IsTownLevel113c(nLevelId | 0)
}

/**
 * `@va D2Common:0x6FD8C680` (`D2Common.#10224` `DUNGEON_GetRoomCoordListFromSubtile113c`,
 * `__stdcall(pRoom, nSubtileX, nSubtileY) -> D2RoomCoordListStrc*`, `ret 0xC`).
 *
 * Reads `pRoom->pRoomEx (+0x10)` and delegates to `DRLGLOGIC_GetRoomCoordListFromWorldSubtile113c` (`0x6FDD1950`).
 */
export function DUNGEON_GetRoomCoordListFromSubtile113c(
  m: Memory113c,
  pRoom: number,
  nSubtileX: number,
  nSubtileY: number,
): number {
  const pRoomEx = m.get(pRoom >>> 0, D2ActiveRoomStrc.pRoomEx)
  return DRLGLOGIC_GetRoomCoordListFromWorldSubtile113c(m, pRoomEx, nSubtileX | 0, nSubtileY | 0)
}

/**
 * `@va D2Common:0x6FD621D0` (`DUNGEON_IsSquareTouchingRoomBounds113c`, not exported;
 * custom LTCG `eax = nY`, `ecx = pRoom1`, `edx = nX`, `edi = nRadius`, `ret`).
 */
export function DUNGEON_IsSquareTouchingRoomBounds113c(
  m: Memory113c,
  nY: number,
  pRoom1: number,
  nX: number,
  nRadius: number,
): number {
  const sm = withDungeonStackScratch113c(m)
  const pCoords = DUNGEON_STACK_BASE
  DUNGEON_GetRoomCoordinates113c(sm, pRoom1 >>> 0, pCoords)
  const rX = sm.u32(pCoords) | 0
  const rY = sm.u32((pCoords + 0x04) >>> 0) | 0
  const rW = sm.u32((pCoords + 0x08) >>> 0) | 0
  const rH = sm.u32((pCoords + 0x0c) >>> 0) | 0
  const x = nX | 0
  const y = nY | 0
  const r = nRadius | 0

  if (((x + r) | 0) >= rX) {
    if (((y + r) | 0) < rY && ((y - r) | 0) > ((rY + rH) | 0)) {
      return 0
    }
    return 1
  }
  if (((x - r) | 0) > ((rX + rW) | 0)) {
    return 0
  }
  if (((y + r) | 0) < rY && ((y - r) | 0) > ((rY + rH) | 0)) {
    return 0
  }
  return 1
}

/**
 * `@va D2Common:0x6FD62250` (`DUNGEON_IsSquareOutsideRoomInterior113c`, not exported;
 * custom LTCG `eax = nY`, `ecx = pRoom1`, `edx = nX`, `esi = nMargin`, `ret`).
 */
export function DUNGEON_IsSquareOutsideRoomInterior113c(
  m: Memory113c,
  nY: number,
  pRoom1: number,
  nX: number,
  nMargin: number,
): number {
  const sm = withDungeonStackScratch113c(m)
  const pCoords = (DUNGEON_STACK_BASE + 0x20) >>> 0
  DUNGEON_GetRoomCoordinates113c(sm, pRoom1 >>> 0, pCoords)
  const rX = sm.u32(pCoords) | 0
  const rY = sm.u32((pCoords + 0x04) >>> 0) | 0
  const rW = sm.u32((pCoords + 0x08) >>> 0) | 0
  const rH = sm.u32((pCoords + 0x0c) >>> 0) | 0
  const x = nX | 0
  const y = nY | 0
  const margin = nMargin | 0

  if (
    ((x - margin) | 0) > rX &&
    ((y - margin) | 0) > rY &&
    ((x + margin) | 0) < ((rX + rW) | 0) &&
    ((y + margin) | 0) < ((rY + rH) | 0)
  ) {
    return 0
  }
  return 1
}

/**
 * `@va D2Common:0x6FD69AD0` (`DUNGEON_FindRoomExWithValidExitWarp113c`, not exported;
 * custom LTCG `edi = pLevel`, `ret`).
 */
export function DUNGEON_FindRoomExWithValidExitWarp113c(
  m: Memory113c,
  pLevel: number,
): number {
  const lvl = pLevel >>> 0
  let pRoomEx = m.u32((lvl + 0x10) >>> 0)
  while (pRoomEx !== 0) {
    const dt1Mask = m.u32((pRoomEx + 0x28) >>> 0) >>> 0
    if ((dt1Mask & 0xff0) !== 0) {
      let mask = 0x10
      let bitIdx = 0
      while ((mask & 0xff0) !== 0) {
        if ((dt1Mask & mask) !== 0) {
          const pWarpLevels = DRLGROOMTILE_GetWarpLevelsArray113c(
            m,
            m.u32((lvl + 0x1b4) >>> 0),
            m.u32((lvl + 0x1d0) >>> 0),
          )
          if ((m.u32((pWarpLevels + bitIdx * 4) >>> 0) | 0) !== -1) {
            return pRoomEx >>> 0
          }
        }
        mask = (mask << 1) >>> 0
        bitIdx++
      }
    }
    pRoomEx = m.u32((pRoomEx + 0x24) >>> 0)
  }
  return 0
}

/**
 * `@va D2Common:0x6FD8C6D0` (`D2Common.#10916` `DUNGEON_GetRoomCoordListIndexAtSubtile113c`,
 * `__stdcall(pRoom1, nSubtileX, nSubtileY) -> int32`, `ret 0xC`).
 */
export function DUNGEON_GetRoomCoordListIndexAtSubtile113c(
  m: Memory113c,
  pRoom1: number,
  nSubtileX: number,
  nSubtileY: number,
): number {
  const sx = nSubtileX | 0
  const sy = nSubtileY | 0
  const pFoundRoom = DUNGEON_GetRoomAtPosition113c(m, pRoom1 >>> 0, sx, sy)
  if (pFoundRoom === 0) {
    return 0
  }
  const pRoomEx = m.u32((pFoundRoom + 0x10) >>> 0)
  const nTileX = sdiv32(sx, 5)
  const nTileY = sdiv32(sy, 5)
  return DRLGLOGIC_GetRoomCoordListIndexAtSubtile113c(m, pRoomEx, nTileY, nTileX) | 0
}

/**
 * `@va D2Common:0x6FD8C3B0` (`D2Common.#10144` `DUNGEON_RemoveClientFromRoom113c`,
 * `__stdcall(pRoom, pClient) -> void`, `ret 8`).
 */
export function DUNGEON_RemoveClientFromRoom113c(
  m: Memory113c,
  pRoom: number,
  pClient: number,
): void {
  const room = pRoom >>> 0
  if (room === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1159)
  }
  const client = pClient >>> 0
  if (client === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1160)
  }
  if (DUNGEON_VerifyRoomClientsNonNull113c(m, room) === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1161)
  }
  const nNumClients = m.u32((room + 0x78) >>> 0) >>> 0
  const pClientList = m.u32((room + 0x48) >>> 0)
  let i = 0
  while (i < nNumClients) {
    if (m.u32((pClientList + i * 4) >>> 0) === client) {
      break
    }
    i++
  }
  if (i >= nNumClients) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1168)
  }
  m.setU32((pClientList + i * 4) >>> 0, m.u32((pClientList + (nNumClients - 1) * 4) >>> 0))
  m.setU32((room + 0x78) >>> 0, (nNumClients - 1) >>> 0)
  DUNGEON_SortRoomClientArray113c(m, room)
}

/**
 * `@va D2Common:0x6FD8C460` (`D2Common.#10879` `DUNGEON_AddClientToRoom113c`,
 * `__stdcall(pRoom, pClient) -> void`, `ret 8`).
 */
export function DUNGEON_AddClientToRoom113c(
  m: Memory113c,
  pRoom: number,
  pClient: number,
): void {
  const room = pRoom >>> 0
  if (room === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1139)
  }
  const client = pClient >>> 0
  if (client === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1140)
  }
  if (DUNGEON_VerifyRoomClientsNonNull113c(m, room) === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1141)
  }
  const nNumClients = m.u32((room + 0x78) >>> 0) >>> 0
  const nCap = m.u32((room + 0x04) >>> 0) >>> 0
  if (nNumClients > nCap) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 1143)
  }
  if (nNumClients === nCap) {
    const newCap = (nCap + 4) >>> 0
    m.setU32((room + 0x04) >>> 0, newCap)
    const pOld = m.u32((room + 0x48) >>> 0)
    const pNew = m.alloc((newCap << 2) >>> 0) >>> 0
    if (pOld !== 0) {
      for (let i = 0; i < nNumClients; i++) {
        m.setU32((pNew + i * 4) >>> 0, m.u32((pOld + i * 4) >>> 0))
      }
      ;(m as { free?: (p: number) => void }).free?.(pOld)
    }
    m.setU32((room + 0x48) >>> 0, pNew)
  }
  const pClientList = m.u32((room + 0x48) >>> 0)
  m.setU32((pClientList + nNumClients * 4) >>> 0, client)
  m.setU32((room + 0x78) >>> 0, (nNumClients + 1) >>> 0)
  DUNGEON_SortRoomClientArray113c(m, room)
}

/**
 * `@va D2Common:0x6FD8C520` (`D2Common.#10163` `DUNGEON_CanFreeActiveRoom113c`,
 * `__stdcall(pAct, pRoom) -> BOOL`, `ret 8`).
 */
export function DUNGEON_CanFreeActiveRoom113c(
  m: Memory113c,
  pAct: number,
  pRoom: number,
): number {
  const act = pAct >>> 0
  if (act === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 989)
  }
  if (m.u32((act + 0x50) >>> 0) !== 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 990)
  }
  const room = pRoom >>> 0
  if (room === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 991)
  }
  return DUNGEON_ShouldDeactivateRoomEx113c(m, m.u32((room + 0x10) >>> 0)) | 0
}

/**
 * `@va D2Common:0x6FD8C720` (`DUNGEON_AllocActiveRoom113c`, not exported;
 * `__stdcall(pAct, pRoomEx, pCoords, pTileGrid, seedLo, dwFlags) -> pRoom`, `ret 0x18`).
 */
export function DUNGEON_AllocActiveRoom113c(
  m: Memory113c,
  pAct: number,
  pRoomEx: number,
  pCoords: number,
  pTileGrid: number,
  seedLo: number,
  dwFlags: number,
  onRoomCreate?: (m: Memory113c, pRoom: number) => void,
): number {
  const act = pAct >>> 0
  const roomEx = pRoomEx >>> 0
  if (roomEx === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DUNGEON\\Dungeon.cpp', 281)
  }
  const pMemPool = m.u32((act + 0x5c) >>> 0)
  const pRoom = m.alloc(0x80) >>> 0
  m.fill(pRoom, 0x80, 0)
  m.setU32((pRoom + 0x34) >>> 0, dwFlags >>> 0)
  m.setU32((pRoom + 0x6c) >>> 0, seedLo >>> 0)
  m.setU32((pRoom + 0x70) >>> 0, 0x29a)
  m.setU32((pRoom + 0x10) >>> 0, roomEx)
  const coords = pCoords >>> 0
  for (let i = 0; i < 8; i++) {
    m.setU32((pRoom + 0x4c + i * 4) >>> 0, m.u32((coords + i * 4) >>> 0))
  }
  m.setU32((pRoom + 0x08) >>> 0, pTileGrid >>> 0)
  m.setU32((pRoom + 0x7c) >>> 0, m.u32((act + 0x10) >>> 0))
  m.setU32((act + 0x10) >>> 0, pRoom)
  m.setU32((act + 0x54) >>> 0, 1)
  m.setU32((pRoom + 0x2c) >>> 0, act)
  m.setU32((roomEx + 0x30) >>> 0, pRoom)
  DUNGEON_AllocAndBuildRoomNeighborList113c(m, pRoom, pMemPool)
  COLLISION_AllocAndBuildRoomGrid113c(m, pMemPool, pRoom)
  const cbPtr = m.u32((act + 0x4c) >>> 0)
  if (cbPtr !== 0 && onRoomCreate !== undefined) {
    onRoomCreate(m, pRoom)
  }
  return pRoom
}

const WAYPOINT_PAIR_GROUP_6FDE4F48 = [1, 0, 0, 0, 0, 0, 0, 0] as const

/**
 * `D2Common.dll` `0x6FD69B60` (internal `__usercall(pLevel@<ecx>, nPortalType@<ebx>, pOutX, pOutY)`).
 */
export function DRLG_FindPortalTargetRoomEx113c(
  m: Memory113c,
  pLevel: number,
  nPortalType: number,
  pOutX: number,
  pOutY: number,
): number {
  const level = pLevel >>> 0
  const targetType = nPortalType | 0
  const nEntries = m.u32((level + 0x1d8) >>> 0) | 0
  let count = 0
  if (nEntries > 0) {
    let pEntry = (level + 0x34) >>> 0
    for (let i = 0; i < nEntries; i++) {
      const eType = m.u32(pEntry) | 0
      if (
        eType === targetType ||
        ((WAYPOINT_PAIR_GROUP_6FDE4F48[targetType * 2]! | 0) !== 0 &&
          WAYPOINT_PAIR_GROUP_6FDE4F48[targetType * 2 + 1] === WAYPOINT_PAIR_GROUP_6FDE4F48[eType * 2 + 1])
      ) {
        count = (count + 1) | 0
      }
      pEntry = (pEntry + 12) >>> 0
    }
  }

  let pick = 0
  if (count > 0) {
    const lo = BigInt(m.u32((level + 0x1c4) >>> 0))
    const hi = BigInt(m.u32((level + 0x1c8) >>> 0))
    const next = lo * 0x6ac690c5n + hi
    const newLo = Number(next & 0xffffffffn) >>> 0
    const newHi = Number((next >> 32n) & 0xffffffffn) >>> 0
    m.setU32((level + 0x1c4) >>> 0, newLo)
    m.setU32((level + 0x1c8) >>> 0, newHi)
    if ((count & (count - 1)) === 0) {
      pick = ((newLo & (count - 1)) + 1) | 0
    } else {
      pick = ((newLo % (count >>> 0)) + 1) | 0
    }
  }

  let idx = 0
  if (nEntries > 0) {
    let pEntry = (level + 0x34) >>> 0
    while (idx < nEntries) {
      const eType = m.u32(pEntry) | 0
      if (
        eType === targetType ||
        ((WAYPOINT_PAIR_GROUP_6FDE4F48[targetType * 2]! | 0) !== 0 &&
          WAYPOINT_PAIR_GROUP_6FDE4F48[targetType * 2 + 1] === WAYPOINT_PAIR_GROUP_6FDE4F48[eType * 2 + 1])
      ) {
        pick = (pick - 1) | 0
      }
      if (pick <= 0) break
      idx = (idx + 1) | 0
      pEntry = (pEntry + 12) >>> 0
    }
  }

  const outX = m.u32((level + idx * 12 + 0x2c) >>> 0) | 0
  const outY = m.u32((level + idx * 12 + 0x30) >>> 0) | 0
  m.setU32(pOutX >>> 0, outX >>> 0)
  m.setU32(pOutY >>> 0, outY >>> 0)
  return DRLG_FindRoomExAtCoords113c(m, 0, outX, outY, m.u32((level + 0x1b4) >>> 0), level)
}

/**
 * `D2Common.dll` `0x6FD69FA0` (internal `__usercall(pLevel@<eax>, pOutX, pOutY)`).
 */
export function DRLG_FindWaypointRoomExAndPos113c(
  m: Memory113c,
  pLevel: number,
  pOutX: number,
  pOutY: number,
): number {
  let pRoomEx = m.u32(((pLevel >>> 0) + 0x10) >>> 0)
  while (pRoomEx !== 0) {
    if ((m.u32((pRoomEx + 0x28) >>> 0) & 0x30000) !== 0) break
    pRoomEx = m.u32((pRoomEx + 0x24) >>> 0)
  }
  if (pRoomEx === 0) return 0
  DRLGROOM_EnsureRoomAndGetRoom1_113c(m, pRoomEx)
  let pPreset = m.u32((pRoomEx + 0x5c) >>> 0)
  if (pPreset !== 0) {
    const pObjectsTxt = m.u32(0x6fdf0b94)
    const nObjectsTxt = m.u32(0x6fdf0b98) | 0
    while (pPreset !== 0) {
      if ((m.u32((pPreset + 0x14) >>> 0) | 0) === 2) {
        const objId = m.u32((pPreset + 0x04) >>> 0) | 0
        if (objId < 0x23d) {
          if (objId >= nObjectsTxt) {
            throw new D2CommonAssertError('', 0xdd)
          }
          if (objId < 0) {
            throw new D2CommonAssertError('', 0xde)
          }
          if ((m.u8((pObjectsTxt + imul32(objId, 0x1c0) + 0x167) >>> 0) & 0x40) !== 0) {
            m.setU32(pOutX >>> 0, (sdiv32(m.u32((pPreset + 0x08) >>> 0) | 0, 5) + (m.u32((pRoomEx + 0x34) >>> 0) | 0)) >>> 0)
            m.setU32(pOutY >>> 0, (sdiv32(m.u32((pPreset + 0x18) >>> 0) | 0, 5) + (m.u32((pRoomEx + 0x38) >>> 0) | 0)) >>> 0)
            return pRoomEx
          }
        }
      }
      pPreset = m.u32((pPreset + 0x0c) >>> 0)
    }
  }
  return pRoomEx
}

/**
 * `D2Common.dll` `0x6FD6A080` (internal `__usercall(pRoomEx@<eax>)`).
 */
export function DRLG_EnsureRoomExActiveAndLoaded113c(
  m: Memory113c,
  pRoomEx: number,
): number {
  const rx = pRoomEx >>> 0
  if ((m.u32((rx + 0x28) >>> 0) & 0x1000000) === 0) {
    DRLGROOM_LoadDt1Files113c(m, rx)
  }
  if ((m.u32((rx + 0x28) >>> 0) & 0x2000000) === 0 && (m.u32((rx + 0x48) >>> 0) | 0) === 2) {
    DRLGPRESET_LoadPresetRoomMap113c(m, rx)
  }
  if ((m.u32((rx + 0x28) >>> 0) & 0x100000) === 0) {
    const pLevel = m.u32((rx + 0x58) >>> 0)
    const pDrlg = m.u32((pLevel + 0x1b4) >>> 0)
    const pMemPool = m.u32((pDrlg + 0x478) >>> 0)
    DRLGROOM_BuildRoomGridsAndTiles113c(m, rx, pMemPool)
  }
  return m.u32((rx + 0x30) >>> 0)
}

/**
 * `D2Common.dll` `0x6FD6A0D0` (internal `__fastcall(nLevelId@<ecx>, pRoomEx@<edx>, pOutX, pOutY)`).
 */
export function DRLG_FindWarpTargetRoom113c(
  m: Memory113c,
  nLevelId: number,
  pRoomEx: number,
  pOutX: number,
  pOutY: number,
): number {
  const lvlId = nLevelId | 0
  const rx = pRoomEx >>> 0
  let pTile = m.u32((rx + 0x4c) >>> 0)
  while (pTile !== 0) {
    const pDest = m.u32((pTile + 0x10) >>> 0)
    if ((m.u32(pDest) | 0) === lvlId) break
    pTile = m.u32((pTile + 0x04) >>> 0)
  }
  if (pTile === 0) return 0
  const pTargetRx = m.u32(pTile) >>> 0
  let pBack = m.u32((pTargetRx + 0x4c) >>> 0)
  while (pBack !== 0) {
    if (m.u32(pBack) === rx) break
    pBack = m.u32((pBack + 0x04) >>> 0)
  }
  if (pBack === 0) return 0
  const pBackDest = m.u32((pBack + 0x10) >>> 0)
  m.setU32(pOutX >>> 0, m.u32(pBackDest))
  m.setU32(pOutY >>> 0, pBackDest)
  if (m.u32((pTargetRx + 0x30) >>> 0) === 0) {
    DRLGROOM_EnsureRoomAndGetRoom1_113c(m, pTargetRx)
  }
  return m.u32((pTargetRx + 0x30) >>> 0)
}

/**
 * `D2Common.dll` `0x6FD6A130` (internal `__usercall(pOutX@<eax>, pDrlg@<ecx>, nLevelId@<edx>, nPortalType, pOutY)`).
 */
export function DRLG_FindLevelSpawnRoom113c(
  m: Memory113c,
  pOutX: number,
  pDrlg: number,
  nLevelId: number,
  nPortalType: number,
  pOutY: number,
): number {
  const outX = pOutX >>> 0
  const outY = pOutY >>> 0
  const drlg = pDrlg >>> 0
  const lvlId = nLevelId | 0
  let pLvlTxt = 0
  if (lvlId >= 0) {
    const sgpt = m.u32(SGPT_DATA_TABLES_PTR_VA_6FDE9E1C)
    if (lvlId < (m.u32((sgpt + 0xc5c) >>> 0) | 0)) {
      pLvlTxt = (m.u32(SG_LEVEL_DEF_BIN_PTR_VA_6FDF0B38) + imul32(lvlId, 0x9c)) >>> 0
    }
  }
  m.setU32(outY, 0xffffffff)
  m.setU32(outX, 0xffffffff)
  const pLevel = DRLG_GetLevel113c(m, drlg, lvlId)
  if (m.u32((pLevel + 0x10) >>> 0) === 0) {
    DRLG_InitLevelRooms113c(m, pLevel)
  }
  if (m.u32((pLvlTxt + 0x90) >>> 0) !== 0) {
    const rx =
      (nPortalType | 0) === 0x0d
        ? DRLG_FindWaypointRoomExAndPos113c(m, pLevel, outY, outX)
        : DRLG_FindPortalTargetRoomEx113c(m, pLevel, nPortalType, outY, outX)
    return DRLG_EnsureRoomExActiveAndLoaded113c(m, rx)
  }

  let rx = DRLG_FindWaypointRoomExAndPos113c(m, pLevel, outY, outX)
  if (rx === 0) {
    rx = DUNGEON_FindRoomExWithValidExitWarp113c(m, pLevel)
    if (rx === 0) {
      const midX = ((m.u32((pLevel + 0x1c) >>> 0) | 0) + sdiv32(m.u32((pLevel + 0x24) >>> 0) | 0, 2) - 2) | 0
      const midY = ((m.u32((pLevel + 0x20) >>> 0) | 0) + sdiv32(m.u32((pLevel + 0x28) >>> 0) | 0, 2) - 2) | 0
      rx = DRLG_GetRoomExFromCoordinates113c(m, pLevel, midX, midY)
      if (rx === 0) {
        rx = SEED_PickRandomListNode113c(m, pLevel)
        if (rx === 0) return 0
      }
    }
  }

  if ((m.u32(outY) | 0) === -1 || (m.u32(outX) | 0) === -1) {
    m.setU32(outY, ((m.u32((rx + 0x34) >>> 0) | 0) + sdiv32(m.u32((rx + 0x3c) >>> 0) | 0, 2)) >>> 0)
    m.setU32(outX, ((m.u32((rx + 0x38) >>> 0) | 0) + sdiv32(m.u32((rx + 0x40) >>> 0) | 0, 2)) >>> 0)
  }
  return DRLG_EnsureRoomExActiveAndLoaded113c(m, rx)
}

/**
 * `D2Common.dll` `0x6FD8C7E0` (Ord `10662`, `__stdcall(pAct, nLevelId)`).
 */
export function DUNGEON_CountNonPresetRoomsInLevel113c(
  m: Memory113c,
  pAct: number,
  nLevelId: number,
): number {
  return DRLG_CountNonPresetRoomsInLevel113c(m, m.u32(((pAct >>> 0) + 0x48) >>> 0), nLevelId)
}

/**
 * `D2Common.dll` `0x6FD8C800` (Ord `10007`, `__stdcall(pAct)`).
 */
export function DUNGEON_UpdateInactiveLevels113c(m: Memory113c, pAct: number): void {
  DRLG_UpdateInactiveLevels113c(m, m.u32(((pAct >>> 0) + 0x48) >>> 0))
}

/**
 * `D2Common.dll` `0x6FD8C810` (Ord `10043`, `__stdcall(pRoomOld, pRoomNew)`).
 */
export function DUNGEON_UpdateRoomLevelChange113c(
  m: Memory113c,
  pRoomOld: number,
  pRoomNew: number,
): void {
  const rxOld = pRoomOld !== 0 ? m.u32(((pRoomOld >>> 0) + 0x10) >>> 0) : 0
  const rxNew = pRoomNew !== 0 ? m.u32(((pRoomNew >>> 0) + 0x10) >>> 0) : 0
  const lvlOld = rxOld !== 0 ? m.u32((rxOld + 0x58) >>> 0) : 0
  const lvlNew = rxNew !== 0 ? m.u32((rxNew + 0x58) >>> 0) : 0
  if (lvlOld !== lvlNew) {
    if (lvlOld !== 0) DRLG_UpdateLevelActiveCount113c(m, lvlOld, -1)
    if (lvlNew !== 0) DRLG_UpdateLevelActiveCount113c(m, lvlNew, 1)
  }
}

/**
 * `D2Common.dll` `0x6FD8CA20` (Ord `10150`, `__stdcall(pAct, pRoom)`).
 */
export function DUNGEON_FreeActiveRoom113c(
  m: Memory113c,
  pAct: number,
  pRoom: number,
): void {
  const room = pRoom >>> 0
  if (room === 0) {
    throw new D2CommonAssertError('', 0x4f7)
  }
  const act = pAct >>> 0
  let cur = m.u32((act + 0x10) >>> 0)
  let prev = 0
  while (cur !== 0 && cur !== room) {
    prev = cur
    cur = m.u32((cur + 0x7c) >>> 0)
  }
  if (cur === 0) {
    throw new D2CommonAssertError('', 0x502)
  }
  const nextRoom = m.u32((cur + 0x7c) >>> 0)
  if (prev !== 0) {
    m.setU32((prev + 0x7c) >>> 0, nextRoom)
  } else {
    m.setU32((act + 0x10) >>> 0, nextRoom)
  }

  const nNear = m.u32((room + 0x24) >>> 0) | 0
  const ppNear = m.u32(room)
  for (let i = 0; i < nNear; i++) {
    const peer = m.u32((ppNear + i * 4) >>> 0)
    if (peer === room) continue
    const peerCount = m.u32((peer + 0x24) >>> 0) | 0
    if (peerCount > 0) {
      const pArr = m.u32(peer)
      for (let j = 0; j < peerCount; j++) {
        if (m.u32((pArr + j * 4) >>> 0) === room) {
          m.setU32((pArr + j * 4) >>> 0, m.u32((pArr + (peerCount - 1) * 4) >>> 0))
          m.setU32((peer + 0x24) >>> 0, (peerCount - 1) >>> 0)
          break
        }
      }
    }
  }

  const rx = m.u32((room + 0x10) >>> 0)
  m.setU32((rx + 0x60) >>> 0, m.u32((room + 0x34) >>> 0) & 0x01)
  m.setU32((rx + 0x30) >>> 0, 0)
  if ((m.u32((rx + 0x28) >>> 0) & 0x100000) !== 0) {
    DRLGROOMTILE_FreeRoomResources113c(m, rx, m.u32((act + 0x50) >>> 0) === 0 ? 1 : 0)
  }
  DUNGEON_FreeRoomAndDetachUnits113c(m, room, m.u32((act + 0x5c) >>> 0))
}

/**
 * `D2Common.dll` `0x6FD8CB30` (Ord `10951`, `__stdcall(9 args)`).
 */
export function DUNGEON_AllocAct113c(
  m: Memory113c,
  nAct: number,
  nSeed: number,
  dwFlags: number,
  pGame: number,
  bDifficulty: number,
  pMemPool: number,
  nTownLevelId: number,
  pfnAutomapInit: number,
  pfnErrorCallback: number,
): number {
  const act = m.alloc(0x60) >>> 0
  m.fill(act, 0x60, 0)
  m.setU32((act + 0x0c) >>> 0, nSeed >>> 0)
  m.setU32((act + 0x50) >>> 0, dwFlags >>> 0)
  m.setU8((act + 0x14) >>> 0, nAct & 0xff)
  m.setU32((act + 0x5c) >>> 0, pMemPool >>> 0)

  let pDrlg = 0
  if (dwFlags !== 0) {
    pDrlg = DRLG_AllocAndInitDrlg113c(
      m,
      act,
      nAct,
      0,
      nSeed,
      0,
      1,
      pGame,
      bDifficulty,
      pfnAutomapInit,
      pfnErrorCallback,
    )
  } else {
    m.setU32((act + 0x08) >>> 0, nTownLevelId >>> 0)
    pDrlg = DRLG_AllocAndInitDrlg113c(
      m,
      act,
      nAct,
      0,
      nSeed,
      nTownLevelId,
      0,
      pGame,
      bDifficulty,
      pfnAutomapInit,
      pfnErrorCallback,
    )
  }
  m.setU32((act + 0x48) >>> 0, pDrlg)
  m.setU32((act + 0x04) >>> 0, ENV_AllocDrlgEnvironment113c(m, pMemPool))
  DRLG_InitActTownFloorTileData113c(m, pDrlg, (act + 0x18) >>> 0)
  return act
}

/**
 * `D2Common.dll` `0x6FD8CC40` (Ord `10622`, `__stdcall(pRoomOld, pRoomNew)`).
 */
export function DUNGEON_SyncActiveRoomStatusChange113c(
  m: Memory113c,
  pRoomOld: number,
  pRoomNew: number,
): void {
  const rxOld = pRoomOld !== 0 ? m.u32(((pRoomOld >>> 0) + 0x10) >>> 0) : 0
  const rxNew = pRoomNew !== 0 ? m.u32(((pRoomNew >>> 0) + 0x10) >>> 0) : 0
  if (rxOld !== rxNew) {
    if (rxNew !== 0) {
      DRLGROOM_IncrementRoomAndNeighborsStatus113c(m, rxNew, 0)
    }
    if (rxOld !== 0) {
      const cnt = m.u16((rxOld + 0x0c) >>> 0);
      if (cnt !== 0) {
        m.setU16((rxOld + 0x0c) >>> 0, (cnt - 1) & 0xffff)
        DRLGROOM_RefreshStatusFromCounts113c(m, rxOld)
        DRLGROOM_DecrementNearRoomsStatus113c(m, rxOld, 1)
      }
    }
  }
}

/**
 * `D2Common.dll` `0x6FD8CD00` (Ord `10264`, `__stdcall(pRoom, nLevelId, pOutLvlWarpTxt)` -> `D2UnitStrc*`).
 */
export function DUNGEON_FindWarpPortalUnitInTargetLevel113c(
  m: Memory113c,
  pRoom: number,
  nLevelId: number,
  pOutLvlWarpTxt: number,
): number {
  const sm = withDungeonStackScratch113c(m)
  const room = pRoom >>> 0
  if (room === 0) {
    throw new D2CommonAssertError('', 0x6a)
  }
  const pWarpX = (DUNGEON_STACK_BASE + 0x10) >>> 0
  const pWarpY = (DUNGEON_STACK_BASE + 0x14) >>> 0
  const pTargetRoom = DRLG_FindWarpTargetRoom113c(
    sm,
    nLevelId,
    sm.u32((room + 0x10) >>> 0),
    pWarpX,
    pWarpY,
  )
  if (pTargetRoom === 0) {
    throw new D2CommonAssertError('', 0x71)
  }
  const targetLvlId = sm.u32(pWarpX) | 0
  let pUnit = sm.u32((pTargetRoom + 0x74) >>> 0)
  while (pUnit !== 0) {
    if ((sm.u32(pUnit) | 0) === 5 && (sm.u32((pUnit + 0x04) >>> 0) | 0) === targetLvlId) {
      break
    }
    pUnit = sm.u32((pUnit + 0xe8) >>> 0)
  }
  sm.setU32(pOutLvlWarpTxt >>> 0, sm.u32(pWarpY))
  return pUnit >>> 0
}

/**
 * `D2Common.dll` `0x6FD8CDA0` (Ord `10053`, `__stdcall(pAct, nX, nY)` -> `D2ActiveRoomStrc*`).
 */
export function DUNGEON_FindRoomBySubtileCoords113c(
  m: Memory113c,
  pAct: number,
  nX: number,
  nY: number,
): number {
  const act = pAct >>> 0
  if (act === 0) {
    throw new D2CommonAssertError('', 0x313)
  }
  const rx = DRLG_FindRoomExAtCoords113c(m, 0, nX, nY, m.u32((act + 0x48) >>> 0), 0)
  if (rx !== 0) {
    return DRLGROOM_EnsureRoomAndGetRoom1_113c(m, rx) >>> 0
  }
  return 0
}

/**
 * `D2Common.dll` `0x6FD8CDF0` (Ord `10816`, `__stdcall(pAct, nLevelId, nPortalType, pOutX, pOutY, nUnitSize)`).
 */
export function DUNGEON_FindFreeSpawnPositionInLevel113c(
  m: Memory113c,
  pAct: number,
  nLevelId: number,
  nPortalType: number,
  pOutX: number,
  pOutY: number,
  nUnitSize: number,
): number {
  const sm = withDungeonStackScratch113c(m)
  const act = pAct >>> 0
  if (act === 0) {
    throw new D2CommonAssertError('', 0x22c)
  }
  const pX = (DUNGEON_STACK_BASE + 0x20) >>> 0
  const pY = (DUNGEON_STACK_BASE + 0x24) >>> 0
  sm.setU32(pX, 0)
  sm.setU32(pY, 0)
  const pRoom = DRLG_FindLevelSpawnRoom113c(
    sm,
    pX,
    sm.u32((act + 0x48) >>> 0),
    nLevelId,
    nPortalType,
    pY,
  )
  if (pRoom === 0) {
    return 0
  }
  const pOutPos = (DUNGEON_STACK_BASE + 0x38) >>> 0
  sm.setU32(pOutPos, ((sm.u32(pY) | 0) * 5 + 3) >>> 0)
  sm.setU32((pOutPos + 0x04) >>> 0, ((sm.u32(pX) | 0) * 5 + 3) >>> 0)
  const found = COLLISION_FindFreePosition113c(
    sm,
    pRoom,
    pOutPos,
    0,
    nUnitSize,
    0x1c09,
    0x1c09,
    0,
    0x32,
    1,
  )
  if (found === 0) {
    throw new D2CommonAssertError('', 0x238)
  }
  const outX = sm.u32(pOutPos)
  const outY = sm.u32((pOutPos + 0x04) >>> 0)
  sm.setU32(pOutX >>> 0, outX)
  sm.setU32(pOutY >>> 0, outY)
  return DUNGEON_GetRoomAtPosition113c(sm, pRoom, outX | 0, outY | 0)
}

/**
 * `D2Common.dll` `0x6FD8CEE0` (Ord `10942`, `__stdcall(pAct, nLevelId, nPortalType, pOutX, pOutY)`).
 */
export function DUNGEON_FindLevelSpawnRoom113c(
  m: Memory113c,
  pAct: number,
  nLevelId: number,
  nPortalType: number,
  pOutX: number,
  pOutY: number,
): number {
  const act = pAct >>> 0
  if (act === 0) {
    throw new D2CommonAssertError('', 0x221)
  }
  return DRLG_FindLevelSpawnRoom113c(
    m,
    pOutY,
    m.u32((act + 0x48) >>> 0),
    nLevelId,
    nPortalType,
    pOutX,
  )
}


