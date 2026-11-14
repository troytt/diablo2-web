/**
 * Diablo II v1.13c `D2Common.dll` DRLG level/room/act helpers (`Drlg\Drlg.cpp`, `Drlg\DrlgWarp.cpp`),
 * image base `0x6FD50000`.
 *
 * Every function below is a 1:1 port of the cited disassembly (`objdump -d -M intel` on `D2Common.dll`).
 */
import {
  D2DrlgCoordStrc,
  D2DrlgLevelStrc,
  D2DrlgStrc,
  D2RoomExStrc,
} from '../../mem/layout.generated.ts';
import type { Memory113c } from '../../mem/sparse-memory.ts';
import {
  ENV_CYCLE_NORMAL_6FDEB160,
  ENV_TICK_RATES_6FDEB238,
  ENV_UpdateIntensityAndSunAngle113c,
} from '../env.ts';
import { DRLGPRESET_AllocLevelPresetInfo113c, DRLGPRESET_FreeDrlgMapList113c } from './preset.ts';
import { D2CommonAssertError } from '../inline-helpers.ts';
import { imul32 } from '../int-math.ts';
import { DRLGOUTDOORS_FreeOutdoorLevelData113c } from './drlg-grid.ts';
import {
  DRLGROOM_FreeRoomEx113c,
  DRLGWARP_GetWarpDstAdjustData113c,
} from './drlg-room.ts';
import {
  D2CMP_10051_GetTileFlags113c,
  D2CMP_10059_FindTiles113c,
  DRLGROOMTILE_GetWarpLevelsArray113c,
} from './room-tile.ts';

/**
 * Act level threshold table at `0x6FDE4668` (`int32[6] = [1, 40, 75, 103, 109, 1024]`).
 * Copied verbatim from `D2Common.dll` v1.13c.
 */
export const ACT_LEVEL_THRESHOLDS_6FDE4668 = Int32Array.from([
  1, 40, 75, 103, 109, 1024,
]);

/**
 * `D2Common.dll` `.data` addresses used by `DRLG_GetLevelDefField94_113c` (`0x6FD7D850`).
 */
export const SGPT_DATA_TABLES_PTR_VA_6FDE9E1C = 0x6fde9e1c;
export const SG_LEVEL_DEF_BIN_PTR_VA_6FDF0B38 = 0x6fdf0b38;
export const GP_WALL_TILE_CACHE_VA_6FDF1434 = 0x6fdf1434;
export const GN_WALL_TILE_CACHE_COUNT_VA_6FDF1438 = 0x6fdf1438;
const DT1_GLOBAL_PREFIX_VA_6FDDAD5C = 0x6fddad5c;
export const DT1_ACT3_TOWN_FMT_VA_6FDE46A4 = 0x6fde46a4;
export const DT1_ACT2_TOWN_FMT_VA_6FDE46C4 = 0x6fde46c4;
export const DT1_ACT1_TOWN_FMT_VA_6FDE46E4 = 0x6fde46e4;

function readCString113c(m: Memory113c, pStr: number): string {
  let out = '';
  for (let p = pStr >>> 0; ; p = (p + 1) >>> 0) {
    const b = m.u8(p);
    if (b === 0) break;
    out += String.fromCharCode(b);
  }
  return out;
}

function hashDt1PathIntoTiles113c(
  m: Memory113c,
  ppTiles: number,
  path: string,
): void {
  const g = globalThis as unknown as {
    __d2LoadMpqDt1Hash?: (m: Memory113c, path: string) => number;
  };
  const hook = g.__d2LoadMpqDt1Hash;
  if (typeof hook === 'function') {
    const trimmed = path.trim();
    if (trimmed.length === 0 || trimmed === '0' || trimmed.toLowerCase() === 'none') {
      return;
    }
    const pHash = hook(m, trimmed) >>> 0;
    if (pHash === 0) {
      return;
    }
    const base = ppTiles >>> 0;
    for (let slot = 0; slot < 32; slot++) {
      const cur = m.u32((base + slot * 4) >>> 0);
      if (cur === pHash) {
        return;
      }
      if (cur === 0) {
        m.setU32((base + slot * 4) >>> 0, pHash);
        return;
      }
    }
    return;
  }
  let h = m.u32(ppTiles >>> 0);
  for (let i = 0; i < path.length; i++) {
    h = (imul32(h, 33) + (path.charCodeAt(i) & 0xff)) >>> 0;
  }
  m.setU32(ppTiles >>> 0, h);
}

/**
 * `@va D2Common:0x6FD7D2C0` (`DRLG_GetActNoFromLevelId113c`, `__stdcall(nLevelId)`, `ret 4`).
 *
 * Scans `ACT_LEVEL_THRESHOLDS_6FDE4668[1..5]`; returns `(eax - 1) & 0xFF` for the first threshold
 * strictly greater than `nLevelId`, or `0` (`xor al, al`) if `nLevelId >= 109`.
 */
export function DRLG_GetActNoFromLevelId113c(
  _m: Memory113c,
  nLevelId: number,
): number {
  const lvl = nLevelId | 0;
  for (let eax = 1; eax <= 5; eax++) {
    if (lvl < ACT_LEVEL_THRESHOLDS_6FDE4668[eax]!) {
      return (eax - 1) & 0xff;
    }
  }
  return 0;
}

/**
 * `@va D2Common:0x6FD7D3C0` (`DRLG_ComputeLevelRoomsBoundingBox113c`, custom `[esp+4] = pLevel`,
 * `ebx = pMinX`, `edi = pMinY`, `esi = pMaxX`, `edx = pMaxY`, `ret 4`).
 *
 * Initializes `[pMinX, pMinY, pMaxX, pMaxY]` from the first `D2RoomExStrc` on `pLevel->pFirstRoomEx (+0x10)`
 * and expands the bounding box across the `pRoomEx->pRoomExNext (+0x24)` chain.
 */
export function DRLG_ComputeLevelRoomsBoundingBox113c(
  m: Memory113c,
  pLevel: number,
  pMinX: number,
  pMinY: number,
  pMaxX: number,
  pMaxY: number,
): void {
  let pRoomEx = m.get(pLevel, D2DrlgLevelStrc.pFirstRoomEx);
  const x0 = m.get(pRoomEx, D2RoomExStrc.nTileXPos) | 0;
  const y0 = m.get(pRoomEx, D2RoomExStrc.nTileYPos) | 0;
  const w0 = m.get(pRoomEx, D2RoomExStrc.nTileWidth) | 0;
  const h0 = m.get(pRoomEx, D2RoomExStrc.nTileHeight) | 0;
  m.setU32(pMinX >>> 0, x0 >>> 0);
  m.setU32(pMinY >>> 0, y0 >>> 0);
  m.setU32(pMaxX >>> 0, ((x0 + w0) | 0) >>> 0);
  m.setU32(pMaxY >>> 0, ((y0 + h0) | 0) >>> 0);

  while (pRoomEx !== 0) {
    const x = m.get(pRoomEx, D2RoomExStrc.nTileXPos) | 0;
    const w = m.get(pRoomEx, D2RoomExStrc.nTileWidth) | 0;
    const x2 = (x + w) | 0;
    if (x2 > (m.u32(pMaxX >>> 0) | 0)) {
      m.setU32(pMaxX >>> 0, x2 >>> 0);
    }
    if (x < (m.u32(pMinX >>> 0) | 0)) {
      m.setU32(pMinX >>> 0, x >>> 0);
    }
    const y = m.get(pRoomEx, D2RoomExStrc.nTileYPos) | 0;
    const h = m.get(pRoomEx, D2RoomExStrc.nTileHeight) | 0;
    const y2 = (y + h) | 0;
    if (y2 > (m.u32(pMaxY >>> 0) | 0)) {
      m.setU32(pMaxY >>> 0, y2 >>> 0);
    }
    if (y < (m.u32(pMinY >>> 0) | 0)) {
      m.setU32(pMinY >>> 0, y >>> 0);
    }
    pRoomEx = m.get(pRoomEx, D2RoomExStrc.pRoomNext);
  }
}

/**
 * `@va D2Common:0x6FD7D420` (`DRLG_MarkLevelRoomsWithWarpFlag113c`, custom `edx = pLevel`, `ret`).
 *
 * Walks `pLevel->pFirstRoomEx (+0x10)` alongside `pLevel->pRoomWarpFlags (+0x22C)` when `pLevel->nRooms (+0x08) != 0`,
 * setting bit `0x1` of `*(uint32*)(pRoomEx + 0x60)` whenever the corresponding warp flag dword is non-zero.
 */
export function DRLG_MarkLevelRoomsWithWarpFlag113c(
  m: Memory113c,
  pLevel: number,
): void {
  if (m.get(pLevel, D2DrlgLevelStrc.nRooms) === 0) return;
  if (m.get(pLevel, D2DrlgLevelStrc.pRoomWarpFlags) === 0) return;
  let pRoomEx = m.get(pLevel, D2DrlgLevelStrc.pFirstRoomEx);
  if (pRoomEx === 0) return;

  let byteOff = 0;
  while (pRoomEx !== 0) {
    const pFlags = m.get(pLevel, D2DrlgLevelStrc.pRoomWarpFlags);
    const flag = m.u32((pFlags + byteOff) >>> 0);
    byteOff = (byteOff + 4) >>> 0;
    if (flag !== 0) {
      const fAddr = (pRoomEx + 0x60) >>> 0;
      m.setU32(fAddr, (m.u32(fAddr) | 1) >>> 0);
    }
    pRoomEx = m.get(pRoomEx, D2RoomExStrc.pRoomNext);
  }
}

/**
 * `@va D2Common:0x6FD7D470` (`DRLG_GetRectTouchDirection113c`, custom `esi = pRect1`, `edx = pRect2`, `ret`).
 *
 * Returns `0` if `r1.x == r2.x + r2.w` (with `r1.x > r2.x`), `2` if `r2.x == r1.x + r1.w` (with `r1.x <= r2.x`),
 * `1` if `r1.y == r2.y + r2.h` (with `r1.y > r2.y`), `3` if `r2.y == r1.y + r1.h` (with `r1.y <= r2.y`), or `-1`.
 */
export function DRLG_GetRectTouchDirection113c(
  m: Memory113c,
  pRect1: number,
  pRect2: number,
): number {
  const x1 = m.get(pRect1, D2DrlgCoordStrc.nPosX) | 0;
  const x2 = m.get(pRect2, D2DrlgCoordStrc.nPosX) | 0;
  if (x1 > x2) {
    const w2 = m.get(pRect2, D2DrlgCoordStrc.nWidth) | 0;
    if (x1 === ((x2 + w2) | 0)) {
      return 0;
    }
  } else {
    const w1 = m.get(pRect1, D2DrlgCoordStrc.nWidth) | 0;
    if (x2 === ((x1 + w1) | 0)) {
      return 2;
    }
  }

  const y1 = m.get(pRect1, D2DrlgCoordStrc.nPosY) | 0;
  const y2 = m.get(pRect2, D2DrlgCoordStrc.nPosY) | 0;
  if (y1 > y2) {
    const h2 = m.get(pRect2, D2DrlgCoordStrc.nHeight) | 0;
    if (y1 === ((y2 + h2) | 0)) {
      return 1;
    }
  } else {
    const h1 = m.get(pRect1, D2DrlgCoordStrc.nHeight) | 0;
    if (y2 === ((y1 + h1) | 0)) {
      return 3;
    }
  }

  return -1;
}

/**
 * `@va D2Common:0x6FD7D4E0` (`DRLG_LoadActTownTileLibrary113c`, custom `eax = pDrlg`, `ret`).
 *
 * Reads `nAct = u8(pDrlg + 0x480)`. For `nAct` in `{0, 1, 2}`, formats the town DT1 path from
 * `.rdata` (`0x6FDE46E4`, `0x6FDE46C4`, or `0x6FDE46A4` with prefix `"DATA\\GLOBAL"` at `0x6FDDAD5C`)
 * and calls `D2CMP.#10085` (`0x6FD592F4`) on `pDrlg + 0x0C`.
 */
export function DRLG_LoadActTownTileLibrary113c(
  m: Memory113c,
  pDrlg: number,
): void {
  const drlg = pDrlg >>> 0;
  const nAct = m.u8((drlg + 0x480) >>> 0);
  let fmtVa: number;
  if (nAct === 0) {
    fmtVa = DT1_ACT1_TOWN_FMT_VA_6FDE46E4;
  } else if (nAct === 1) {
    fmtVa = DT1_ACT2_TOWN_FMT_VA_6FDE46C4;
  } else if (nAct === 2) {
    fmtVa = DT1_ACT3_TOWN_FMT_VA_6FDE46A4;
  } else {
    return;
  }
  const prefix = readCString113c(m, DT1_GLOBAL_PREFIX_VA_6FDDAD5C);
  const fmt = readCString113c(m, fmtVa);
  hashDt1PathIntoTiles113c(m, (drlg + 0x0c) >>> 0, fmt.replace('%s', prefix));
}

/**
 * `@va D2Common:0x6FD7D5B0` (`DRLG_FindLevelIdAtCoord113c`, custom `eax = pDrlg`, `edi = nX`, `esi = nY`, `ret`).
 *
 * Walks `pDrlg->pLevel (+0x47C)` along `pLevel->pNextLevel (+0x1AC)` and returns `pLevel->nLevelId (+0x1D0)`
 * for the first level containing `(nX, nY)` in `[nPosX, nPosX + nWidth) x [nPosY, nPosY + nHeight)`, or `0`.
 */
export function DRLG_FindLevelIdAtCoord113c(
  m: Memory113c,
  pDrlg: number,
  nX: number,
  nY: number,
): number {
  let pLevel = m.get(pDrlg, D2DrlgStrc.pLevel);
  const x = nX | 0;
  const y = nY | 0;
  while (pLevel !== 0) {
    const lx = m.get(pLevel, D2DrlgLevelStrc.nPosX) | 0;
    if (x >= lx) {
      const ly = m.get(pLevel, D2DrlgLevelStrc.nPosY) | 0;
      if (y >= ly) {
        const lw = m.get(pLevel, D2DrlgLevelStrc.nWidth) | 0;
        if (x < ((lx + lw) | 0)) {
          const lh = m.get(pLevel, D2DrlgLevelStrc.nHeight) | 0;
          if (y < ((ly + lh) | 0)) {
            return m.get(pLevel, D2DrlgLevelStrc.nLevelId) | 0;
          }
        }
      }
    }
    pLevel = m.get(pLevel, D2DrlgLevelStrc.pNextLevel);
  }
  return 0;
}

/**
 * `@va D2Common:0x6FD7D730` (`DRLG_GetOrAllocObjectPresetRecord113c`, custom `edi = pDrlg`, `ebx = nObjId`, `ret`).
 *
 * Searches `pDrlg + 0x90` (linked via `+0x44`) for `[pNode] == nObjId`. If not found, allocates a `0x48`-byte
 * node via `Fog.#10045`, copies `16` dwords (`+0x48..+0x87`) from `gpLevelDefBin[nObjId]` (stride `0x9C`),
 * prepends to `pDrlg + 0x90`, and returns `pNode`.
 */
export function DRLG_GetOrAllocObjectPresetRecord113c(
  m: Memory113c,
  pDrlg: number,
  nObjId: number,
): number {
  const drlg = pDrlg >>> 0;
  const objId = nObjId | 0;
  let pCur = m.u32((drlg + 0x90) >>> 0);
  while (pCur !== 0) {
    if ((m.u32(pCur) | 0) === objId) {
      return pCur >>> 0;
    }
    pCur = m.u32((pCur + 0x44) >>> 0);
  }

  let pObjTxt = 0;
  if (objId >= 0) {
    const pDataTables = m.u32(SGPT_DATA_TABLES_PTR_VA_6FDE9E1C);
    if (objId < (m.u32((pDataTables + 0xc5c) >>> 0) | 0)) {
      pObjTxt =
        (m.u32(SG_LEVEL_DEF_BIN_PTR_VA_6FDF0B38) + imul32(objId, 0x9c)) >>> 0;
    }
  }

  void m.u32((drlg + 0x478) >>> 0);
  const pNode = m.alloc(0x48);
  m.setU32(pNode, objId >>> 0);
  for (let i = 0; i < 8; i++) {
    m.setU32(
      (pNode + 0x04 + i * 4) >>> 0,
      m.u32((pObjTxt + 0x48 + i * 4) >>> 0),
    );
    m.setU32(
      (pNode + 0x24 + i * 4) >>> 0,
      m.u32((pObjTxt + 0x68 + i * 4) >>> 0),
    );
  }
  const pOldHead = m.u32((drlg + 0x90) >>> 0);
  m.setU32((pNode + 0x44) >>> 0, pOldHead);
  m.setU32((drlg + 0x90) >>> 0, pNode);
  return pNode >>> 0;
}

/**
 * `@va D2Common:0x6FD7D850` (`DRLG_GetLevelDefField94_113c`, `__stdcall(nLevelId)`, `ret 4`).
 *
 * Looks up `D2LevelDefBin` record `nLevelId` (stride `0x9C`) from `*(0x6FDF0B38)` (bounded by
 * `sgptDataTables->nLevelsTxtRecordCount` at `*(0x6FDE9E1C) + 0xC5C`) and returns `pLevelDef->dwField94 (+0x94)`.
 */
export function DRLG_GetLevelDefField94_113c(
  m: Memory113c,
  nLevelId: number,
): number {
  const id = nLevelId | 0;
  const sgptDataTables = m.u32(SGPT_DATA_TABLES_PTR_VA_6FDE9E1C);
  const count = m.u32((sgptDataTables + 0xc5c) >>> 0) | 0;
  const pLevelDef =
    id < 0 || id >= count
      ? 0
      : (m.u32(SG_LEVEL_DEF_BIN_PTR_VA_6FDF0B38) + imul32(id, 0x9c)) >>> 0;
  return m.u32((pLevelDef + 0x94) >>> 0) | 0;
}

/**
 * `@va D2Common:0x6FD7E0C0` (`DRLG_InitActTownFloorTileData113c`, custom `eax = pDrlg`, `esi = pTileData`, `ret`).
 *
 * Zeroes `0x30` bytes at `pTileData`, maps `nAct = u8(pDrlg + 0x480)` (`0 -> (0,0)`, `1 -> (0,1)`, `2 -> (29,12)`),
 * queries `D2CMP.#10059` (`pDrlg + 0x0C`), and initializes `pTileData` fields and flags via `D2CMP.#10051`.
 */
export function DRLG_InitActTownFloorTileData113c(
  m: Memory113c,
  pDrlg: number,
  pTileData: number,
): void {
  if (pDrlg === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Drlg.cpp', 1079);
  }
  if (pTileData === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Drlg.cpp', 1080);
  }
  const drlg = pDrlg >>> 0;
  const tileData = pTileData >>> 0;
  for (let i = 0; i < 0x30; i += 4) {
    m.setU32((tileData + i) >>> 0, 0);
  }

  const nAct = m.u8((drlg + 0x480) >>> 0);
  let nStyle = 0;
  let nSeq = 0;
  if (nAct === 0) {
    nStyle = 0;
    nSeq = 0;
  } else if (nAct === 1) {
    nStyle = 0;
    nSeq = 1;
  } else if (nAct === 2) {
    nStyle = 0x1d;
    nSeq = 0x0c;
  } else {
    return;
  }

  const aTiles = new Uint32Array(40);
  const nFound = D2CMP_10059_FindTiles113c(
    m,
    (drlg + 0x0c) >>> 0,
    0,
    nStyle,
    nSeq,
    aTiles,
    0x28,
  );
  if (nFound === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Drlg.cpp', 1100);
  }
  const pTile = aTiles[0]!;
  m.setU32((tileData + 0x18) >>> 0, pTile);
  m.setU32((tileData + 0x1c) >>> 0, 0);
  m.setU32((tileData + 0x24) >>> 0, 0);
  m.setU8((tileData + 0x29) >>> 0, 0xff);
  m.setU8((tileData + 0x2a) >>> 0, 0xff);
  m.setU8((tileData + 0x28) >>> 0, 0xff);
  m.setU32((tileData + 0x14) >>> 0, 0x4000);

  const nFlags = D2CMP_10051_GetTileFlags113c(m, pTile);
  if ((nFlags & 0x01) !== 0) {
    m.setU32(
      (tileData + 0x14) >>> 0,
      (m.u32((tileData + 0x14) >>> 0) | 0x04) >>> 0,
    );
  }
  if ((nFlags & 0x04) !== 0) {
    m.setU32(
      (tileData + 0x14) >>> 0,
      (m.u32((tileData + 0x14) >>> 0) | 0x800) >>> 0,
    );
  }
}

/**
 * `@va D2Common:0x6FD87C20` (`D2Common.#10895` `ENV_ResetDefaultEnvironment113c`, `__stdcall(pAct)`, `ret 4`).
 *
 * Resets `pAct->pEnvironment (+0x04)` to default normal cycle row 2 (`dwRateIdx = 0`, `dwCyclePeriod = 128`,
 * `dwCycleIndex = 2`, `dwTicks = 0`, `nTimeOfDay = 0`, `bEclipse = 0`) and updates intensity and sun angle.
 */
export function ENV_ResetDefaultEnvironment113c(
  m: Memory113c,
  pAct: number,
): void {
  if (pAct === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\ENVIRONMENT\\Env.cpp', 1351);
  }
  const pEnv0 = m.u32((pAct + 0x04) >>> 0);
  m.setU32((pEnv0 + 0x2c) >>> 0, 0);
  m.setU32((pEnv0 + 0x28) >>> 0, ENV_TICK_RATES_6FDEB238[0]! >>> 0);
  const pEnv = m.u32((pAct + 0x04) >>> 0);
  m.setU32(pEnv, 2);
  m.setU32((pEnv + 0x08) >>> 0, 0);
  m.setU32((pEnv + 0x04) >>> 0, ENV_CYCLE_NORMAL_6FDEB160[2 * 3 + 1]! >>> 0);
  const nActNo = DRLG_GetActNoFromLevelId113c(m, 0) & 0xff;
  ENV_UpdateIntensityAndSunAngle113c(m, pEnv, nActNo, 0);
  m.setU32((pEnv + 0x30) >>> 0, 0);
}

/**
 * `@va D2Common:0x6FDBC520` (`DATATBLS_FindWallTileCacheEntry113c`, custom `edi = nPackedTileId`, `ret`).
 *
 * Scans `gpWallTileCache` (`0x6FDF1434`, count at `0x6FDF1438`, stride `0x1C` = 28 bytes) for
 * `[pEntry] == nPackedTileId` and returns `pEntry` (asserting at lines `867` and `876` if null or missing).
 */
export function DATATBLS_FindWallTileCacheEntry113c(
  m: Memory113c,
  nPackedTileId: number,
): number {
  const pTable = m.u32(GP_WALL_TILE_CACHE_VA_6FDF1434);
  if (pTable === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\DataTbls.cpp', 867);
  }
  const nCount = m.u32(GN_WALL_TILE_CACHE_COUNT_VA_6FDF1438) | 0;
  const target = nPackedTileId | 0;
  for (let i = 0; i < nCount; i++) {
    const pEntry = (pTable + imul32(i, 0x1c)) >>> 0;
    if ((m.u32(pEntry) | 0) === target) {
      return pEntry;
    }
  }
  throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\DataTbls.cpp', 876);
}

/**
 * `@va D2Common:0x6FDCB8D0` (`DRLG_InitActWarpLists113c`, custom `eax = pDrlg`, `ret`).
 *
 * Initializes the 4 act warp list heads embedded in `D2DrlgStrc` at `+0xA0`, `+0x18C`, `+0x278`, and `+0x364`.
 */
export function DRLG_InitActWarpLists113c(m: Memory113c, pDrlg: number): void {
  const base = pDrlg >>> 0;
  const c0 = (base + 0xa0) >>> 0;
  m.setU32((base + 0xbc) >>> 0, c0);
  m.setU32((base + 0x188) >>> 0, c0);
  const c1 = (base + 0x18c) >>> 0;
  m.setU32((base + 0x1a8) >>> 0, c1);
  m.setU32((base + 0x274) >>> 0, c1);
  const c2 = (base + 0x278) >>> 0;
  m.setU32((base + 0x294) >>> 0, c2);
  m.setU32((base + 0x360) >>> 0, c2);
  const c3 = (base + 0x364) >>> 0;
  m.setU8((base + 0xe4) >>> 0, 0);
  m.setU8((base + 0x1d0) >>> 0, 1);
  m.setU8((base + 0x2bc) >>> 0, 2);
  m.setU32((base + 0x380) >>> 0, c3);
  m.setU32((base + 0x44c) >>> 0, c3);
  m.setU8((base + 0x3a8) >>> 0, 3);
}

/**
 * `@va D2Common:0x6FD7DC90` (`DRLG_CollectWarpAndSpecialRoomCenters113c`, not exported;
 * custom LTCG `esi = pLevel`, `ret`).
 */
export function DRLG_CollectWarpAndSpecialRoomCenters113c(
  m: Memory113c,
  pLevel: number,
): void {
  const level = pLevel >>> 0;
  let pRoomEx = m.u32((level + 0x10) >>> 0);
  let bSpecial = 0;

  while (pRoomEx !== 0) {
    const dwFlags = m.u32((pRoomEx + 0x28) >>> 0) >>> 0;
    if ((dwFlags & 0x30000) !== 0) {
      bSpecial = 1;
    }

    let keep = false;
    if ((dwFlags & 0xff0) !== 0) {
      if (bSpecial !== 0) {
        keep = true;
      } else {
        for (let bit = 0; bit < 8; bit++) {
          if ((m.u32((pRoomEx + 0x28) >>> 0) & ((0x10 << bit) >>> 0)) !== 0) {
            const pWarpLevels = DRLGROOMTILE_GetWarpLevelsArray113c(
              m,
              m.u32((level + 0x1b4) >>> 0),
              m.u32((level + 0x1d0) >>> 0) | 0,
            ) >>> 0;
            if ((m.u32((pWarpLevels + bit * 4) >>> 0) | 0) !== -1) {
              keep = true;
              break;
            }
          }
        }
      }
    } else if (bSpecial !== 0) {
      keep = true;
    }

    if (keep) {
      const idx = m.u32((level + 0x228) >>> 0) | 0;
      const cx =
        ((m.u32((pRoomEx + 0x34) >>> 0) | 0) +
          (((m.u32((pRoomEx + 0x3c) >>> 0) | 0) / 2) | 0)) |
        0;
      const cy =
        ((m.u32((pRoomEx + 0x38) >>> 0) | 0) +
          (((m.u32((pRoomEx + 0x40) >>> 0) | 0) / 2) | 0)) |
        0;
      m.setU32((level + 0x1e0 + idx * 4) >>> 0, imul32(cx, 5) >>> 0);
      m.setU32((level + 0x204 + idx * 4) >>> 0, imul32(cy, 5) >>> 0);
      m.setU32((level + 0x228) >>> 0, (idx + 1) >>> 0);
      bSpecial = 0;
    }

    pRoomEx = m.u32((pRoomEx + 0x24) >>> 0);
  }
}

/**
 * `D2Common.dll` `0x6FD7D890` (internal `__usercall(pLevel@<edi>)` + `pDrlg@<ebx>`).
 * Initializes level dimensions and world position from `Levels.txt` (`+0x24`, `+0x28`, `+0x1C`, `+0x20`).
 */
export function DRLG_InitLevelCoordsFromLevelsTxt113c(
  m: Memory113c,
  pLevel: number,
  pDrlg: number,
): void {
  const level = pLevel >>> 0;
  const drlg = pDrlg >>> 0;
  const nLevelId = m.u32((level + 0x1d0) >>> 0) | 0;
  let pLvlTxt = 0;
  if (nLevelId >= 0) {
    const sgptDataTables = m.u32(SGPT_DATA_TABLES_PTR_VA_6FDE9E1C);
    if (nLevelId < (m.u32((sgptDataTables + 0xc5c) >>> 0) | 0)) {
      pLvlTxt = (m.u32(SG_LEVEL_DEF_BIN_PTR_VA_6FDF0B38) + imul32(nLevelId, 0x9c)) >>> 0;
    }
  }
  const nDepend = m.u32((pLvlTxt + 0x2c) >>> 0) | 0;
  const bDiff = m.u8((drlg + 0x450) >>> 0);
  m.setU32((level + 0x24) >>> 0, m.u32((pLvlTxt + bDiff * 4 + 0x0c) >>> 0));
  m.setU32((level + 0x28) >>> 0, m.u32((pLvlTxt + bDiff * 4 + 0x18) >>> 0));
  let posX = 0;
  let posY = 0;
  if (nDepend !== 0) {
    let pDep = m.u32((drlg + 0x47c) >>> 0);
    while (pDep !== 0) {
      if ((m.u32((pDep + 0x1d0) >>> 0) | 0) === nDepend) break;
      pDep = m.u32((pDep + 0x1ac) >>> 0);
    }
    if (pDep === 0) {
      pDep = DRLG_AllocAndInitLevel113c(m, drlg, nDepend);
    }
    posX = m.u32((pDep + 0x1c) >>> 0) | 0;
    posY = m.u32((pDep + 0x20) >>> 0) | 0;
  }
  m.setU32((level + 0x1c) >>> 0, ((m.u32((pLvlTxt + 0x24) >>> 0) | 0) + posX) >>> 0);
  m.setU32((level + 0x20) >>> 0, ((m.u32((pLvlTxt + 0x28) >>> 0) | 0) + posY) >>> 0);
}

/**
 * `D2Common.dll` `0x6FD7D9B0` (Ord `10207`, `__fastcall(pDrlg@<ecx>, nLevelId@<edx>)`).
 * Allocates and initializes a `D2DrlgLevelStrc` (`0x230` B) and prepends it to `pDrlg->pLevel`.
 */
export function DRLG_AllocAndInitLevel113c(
  m: Memory113c,
  pDrlg: number,
  nLevelId: number,
): number {
  const drlg = pDrlg >>> 0;
  const lvlId = nLevelId | 0;
  const pLevel = m.alloc(0x230) >>> 0;
  m.fill(pLevel, 0x230, 0);
  m.setU32((pLevel + 0x1b4) >>> 0, drlg);
  m.setU32((pLevel + 0x1d0) >>> 0, lvlId >>> 0);

  let pLvlTxt = 0;
  if (lvlId >= 0) {
    const sgptDataTables = m.u32(SGPT_DATA_TABLES_PTR_VA_6FDE9E1C);
    if (lvlId < (m.u32((sgptDataTables + 0xc5c) >>> 0) | 0)) {
      pLvlTxt = (m.u32(SG_LEVEL_DEF_BIN_PTR_VA_6FDF0B38) + imul32(lvlId, 0x9c)) >>> 0;
    }
  }
  m.setU32((pLevel + 0x1c0) >>> 0, m.u32((pLvlTxt + 0x34) >>> 0));
  const dwDrlgType = m.u32((pLvlTxt + 0x30) >>> 0) >>> 0;
  m.setU32(pLevel, dwDrlgType);
  if ((m.u32((drlg + 0x8c) >>> 0) & 0x01) !== 0) {
    m.setU32((pLevel + 0x04) >>> 0, (m.u32((pLevel + 0x04) >>> 0) | 0x10) >>> 0);
  }
  m.setU32((pLevel + 0x1c4) >>> 0, ((m.u32((drlg + 0x470) >>> 0) | 0) + lvlId) >>> 0);
  m.setU32((pLevel + 0x1c8) >>> 0, 0x29a);

  if (dwDrlgType === 1) {
    const pMaze = DATATBLS_FindWallTileCacheEntry113c(m, lvlId);
    m.setU32((pLevel + 0x14) >>> 0, pMaze >>> 0);
    DRLG_InitLevelCoordsFromLevelsTxt113c(m, pLevel, drlg);
  } else if (dwDrlgType === 2) {
    DRLGPRESET_AllocLevelPresetInfo113c(m, pLevel);
  } else if (dwDrlgType === 3) {
    const pOutdoors = m.alloc(0x268) >>> 0;
    m.fill(pOutdoors, 0x268, 0);
    m.setU32((pLevel + 0x14) >>> 0, pOutdoors);
  }

  m.setU32((pLevel + 0x1ac) >>> 0, m.u32((drlg + 0x47c) >>> 0));
  m.setU32((drlg + 0x47c) >>> 0, pLevel);
  return pLevel;
}

/**
 * `D2Common.dll` `0x6FD7DAF0` (internal `__usercall(pLevel@<esi>, pMemPool, bKeepAllocated)`).
 * Frees all rooms, preset/outdoor data, and warp/room-coord lists for a level.
 */
export function DRLG_FreeLevelData113c(
  m: Memory113c,
  pLevel: number,
  pMemPool: number,
  bKeepAllocated: number,
): void {
  const level = pLevel >>> 0;
  const freeFn = (m as { free?: (p: number) => void }).free;
  const keep = bKeepAllocated | 0;

  if (keep !== 0) {
    if (m.u32((level + 0x22c) >>> 0) === 0) {
      const nRooms = m.u32((level + 0x08) >>> 0) >>> 0;
      if (nRooms !== 0) {
        const arr = m.alloc(nRooms * 4) >>> 0;
        m.setU32((level + 0x22c) >>> 0, arr);
        m.fill(arr, nRooms * 4, 0);
      } else {
        m.setU32((level + 0x08) >>> 0, 0);
      }
    }
  } else {
    const pArr = m.u32((level + 0x22c) >>> 0);
    if (pArr !== 0) {
      freeFn?.call(m, pArr);
      m.setU32((level + 0x22c) >>> 0, 0);
    }
  }

  let pRoomEx = m.u32((level + 0x10) >>> 0);
  if (pRoomEx !== 0) {
    let idx = 0;
    while (pRoomEx !== 0) {
      const pNext = m.u32((pRoomEx + 0x24) >>> 0);
      const pArr = m.u32((level + 0x22c) >>> 0);
      if (pArr !== 0) {
        m.setU32((pArr + idx * 4) >>> 0, m.u32((pRoomEx + 0x60) >>> 0) & 0x01);
        idx += 4;
      }
      DRLGROOM_FreeRoomEx113c(m, pRoomEx);
      pRoomEx = pNext;
    }
    m.setU32((level + 0x10) >>> 0, 0);
    m.setU32((level + 0x08) >>> 0, 0);
  }

  const pPresetRoom = m.u32((level + 0x1b0) >>> 0);
  if (pPresetRoom !== 0) {
    DRLGPRESET_FreeDrlgMapList113c(m, pMemPool, pPresetRoom);
    m.setU32((level + 0x1b0) >>> 0, 0);
  }

  const dwDrlgType = m.u32(level) >>> 0;
  if (dwDrlgType === 1) {
    if (keep === 0) {
      m.setU32((level + 0x14) >>> 0, 0);
    }
  } else if (dwDrlgType === 2) {
    const pPreset = m.u32((level + 0x14) >>> 0);
    if (pPreset !== 0) {
      m.setU32(pPreset, 0);
    }
    if (keep === 0) {
      if (pPreset !== 0) freeFn?.call(m, pPreset);
      m.setU32((level + 0x14) >>> 0, 0);
    }
  } else if (dwDrlgType === 3) {
    DRLGOUTDOORS_FreeOutdoorLevelData113c(m, level, keep);
  }

  m.fill((level + 0x2c) >>> 0, 0x60 * 4, 0);
  m.fill((level + 0x1e0) >>> 0, 0x13 * 4, 0);
  m.setU32((level + 0x1d8) >>> 0, 0);

  if (keep === 0) {
    const p1bc = m.u32((level + 0x1bc) >>> 0);
    if (p1bc !== 0) {
      freeFn?.call(m, p1bc);
      m.setU32((level + 0x1bc) >>> 0, 0);
    }
  }

  let pCoordNode = m.u32((level + 0x1cc) >>> 0);
  if (pCoordNode !== 0) {
    while (pCoordNode !== 0) {
      const pNext = m.u32((pCoordNode + 0x0c) >>> 0);
      freeFn?.call(m, pCoordNode);
      pCoordNode = pNext;
    }
    m.setU32((level + 0x1cc) >>> 0, 0);
  }
}

/**
 * `D2Common.dll` `0x6FD7DD80` (Ord `10419`, `__stdcall(pDrlg, nLevelId)`).
 * Finds an existing `D2DrlgLevelStrc` by `nLevelId` or allocates one via `0x6FD7D9B0`.
 */
export function DRLG_GetLevel113c(
  m: Memory113c,
  pDrlg: number,
  nLevelId: number,
): number {
  const drlg = pDrlg >>> 0;
  const lvlId = nLevelId | 0;
  let pLevel = m.u32((drlg + 0x47c) >>> 0);
  while (pLevel !== 0) {
    if ((m.u32((pLevel + 0x1d0) >>> 0) | 0) === lvlId) {
      return pLevel;
    }
    pLevel = m.u32((pLevel + 0x1ac) >>> 0);
  }
  return DRLG_AllocAndInitLevel113c(m, drlg, lvlId);
}

/**
 * `D2Common.dll` `0x6FD7DDB0` (internal `__stdcall(pLevel)`).
 * Checks whether a level and its warp-connected rooms can be deactivated/freed.
 */
export function DRLG_TryDeactivateLevelRooms113c(
  m: Memory113c,
  pLevel: number,
): number {
  const level = pLevel >>> 0;
  const freeFn = (m as { free?: (p: number) => void }).free;
  const pDrlg = m.u32((level + 0x1b4) >>> 0);
  void m.u32((pDrlg + 0x478) >>> 0);

  let pRoomEx = m.u32((level + 0x10) >>> 0);
  while (pRoomEx !== 0) {
    if (m.u8((pRoomEx + 0x44) >>> 0) <= 3 || (m.u32((pRoomEx + 0x28) >>> 0) & 0x100000) !== 0) {
      return 0;
    }
    pRoomEx = m.u32((pRoomEx + 0x24) >>> 0);
  }

  const nLevelId = m.u32((level + 0x1d0) >>> 0) | 0;
  const pWarpLevels = DRLGWARP_GetWarpDstAdjustData113c(m, pDrlg, nLevelId) >>> 0;

  for (let i = 0; i < 8; i++) {
    const dstLevelId = m.u32((pWarpLevels + i * 4) >>> 0) | 0;
    if (dstLevelId === 0) continue;
    const pDstLevel = DRLG_GetLevel113c(m, pDrlg, dstLevelId);
    const pDstFirst = m.u32((pDstLevel + 0x10) >>> 0);
    if (pDstFirst === 0) continue;

    const pDstWarpLevels = DRLGWARP_GetWarpDstAdjustData113c(
      m,
      m.u32((pDstLevel + 0x1b4) >>> 0),
      m.u32((pDstLevel + 0x1d0) >>> 0) | 0,
    ) >>> 0;
    let mask = 0;
    for (let bit = 0; bit < 8; bit++) {
      if ((m.u32((pDstWarpLevels + bit * 4) >>> 0) | 0) === nLevelId) {
        mask |= 0x10 << bit;
      }
    }

    let pCur = pDstFirst;
    while (pCur !== 0) {
      const flags = m.u32((pCur + 0x28) >>> 0);
      if ((flags & mask) !== 0) {
        if (m.u8((pCur + 0x44) >>> 0) <= 3 || (flags & 0x100000) !== 0) {
          return 0;
        }
      }
      pCur = m.u32((pCur + 0x24) >>> 0);
    }

    pCur = m.u32((pDstLevel + 0x10) >>> 0);
    while (pCur !== 0) {
      if ((m.u32((pCur + 0x28) >>> 0) & mask) !== 0) {
        let pStatus = m.u32((pCur + 0x4c) >>> 0);
        while (pStatus !== 0) {
          const pNextStatus = m.u32((pStatus + 0x04) >>> 0);
          freeFn?.call(m, pStatus);
          pStatus = pNextStatus;
        }
        m.setU32((pCur + 0x4c) >>> 0, 0);
        const ppNear = m.u32((pCur + 0x08) >>> 0);
        if (ppNear !== 0) {
          freeFn?.call(m, ppNear);
          m.setU32((pCur + 0x08) >>> 0, 0);
          m.setU32((pCur + 0x2c) >>> 0, 0);
        }
      }
      pCur = m.u32((pCur + 0x24) >>> 0);
    }
  }

  return 1;
}

/**
 * `D2Common.dll` `0x6FD7DF80` (internal `__usercall(pLevel@<esi>, nDelta)`).
 * Adjusts active player count (`+0x0C`, clamped `>= 0`) and resets inactive timer (`+0x1D4 = 10`)
 * on `pLevel` and its up-to-8 warp-connected levels.
 */
export function DRLG_UpdateLevelActiveCount113c(
  m: Memory113c,
  pLevel: number,
  nDelta: number,
): void {
  const level = pLevel >>> 0;
  const delta = nDelta | 0;
  const nLevelId = m.u32((level + 0x1d0) >>> 0) | 0;
  const nextCount = ((m.u32((level + 0x0c) >>> 0) | 0) + delta) | 0;
  m.setU32((level + 0x1d4) >>> 0, 10);
  m.setU32((level + 0x0c) >>> 0, (nextCount <= 0 ? 0 : nextCount) >>> 0);

  const pDrlg = m.u32((level + 0x1b4) >>> 0);
  const pWarpLevels = DRLGWARP_GetWarpDstAdjustData113c(m, pDrlg, nLevelId) >>> 0;
  for (let i = 0; i < 8; i++) {
    const dstLevelId = m.u32((pWarpLevels + i * 4) >>> 0) | 0;
    if (dstLevelId === 0) continue;
    const pDstLevel = DRLG_GetLevel113c(m, m.u32((level + 0x1b4) >>> 0), dstLevelId);
    const c = ((m.u32((pDstLevel + 0x0c) >>> 0) | 0) + delta) | 0;
    m.setU32((pDstLevel + 0x1d4) >>> 0, 10);
    m.setU32((pDstLevel + 0x0c) >>> 0, (c <= 0 ? 0 : c) >>> 0);
  }
}

/**
 * `D2Common.dll` `0x6FD7E1A0` (internal `__fastcall(pDrlg@<ecx>, nLevelId@<edx>)`).
 * Returns the count of active (non-`0x800000`) rooms in `nLevelId`.
 */
export function DRLG_CountNonPresetRoomsInLevel113c(
  m: Memory113c,
  pDrlg: number,
  nLevelId: number,
): number {
  const pLevel = DRLG_GetLevel113c(m, pDrlg, nLevelId);
  let count = 0;
  let pRoomEx = m.u32((pLevel + 0x10) >>> 0);
  while (pRoomEx !== 0) {
    if ((m.u32((pRoomEx + 0x28) >>> 0) & 0x800000) === 0) {
      count = (count + 1) | 0;
    }
    pRoomEx = m.u32((pRoomEx + 0x24) >>> 0);
  }
  return count;
}

/**
 * `D2Common.dll` `0x6FD7E2C0` (internal `__usercall(pDrlg@<eax>)`).
 * Ticks down inactive timers on all levels in `pDrlg` and frees expired levels.
 */
export function DRLG_UpdateInactiveLevels113c(m: Memory113c, pDrlg: number): void {
  const drlg = pDrlg >>> 0;
  let pLevel = m.u32((drlg + 0x47c) >>> 0);
  const pMemPool = m.u32((drlg + 0x478) >>> 0);
  while (pLevel !== 0) {
    if (
      m.u32((pLevel + 0x0c) >>> 0) === 0 &&
      m.u32((pLevel + 0x10) >>> 0) !== 0
    ) {
      const timer = m.u32((pLevel + 0x1d4) >>> 0) | 0;
      if (timer !== 0) {
        m.setU32((pLevel + 0x1d4) >>> 0, (timer - 1) >>> 0);
      } else if (DRLG_TryDeactivateLevelRooms113c(m, pLevel) !== 0) {
        DRLG_FreeLevelData113c(m, pLevel, pMemPool, 1);
      } else {
        m.setU32((pLevel + 0x1d4) >>> 0, 10);
      }
    }
    pLevel = m.u32((pLevel + 0x1ac) >>> 0);
  }
}


