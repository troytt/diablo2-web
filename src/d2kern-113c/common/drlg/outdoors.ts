/**
 * Diablo II v1.13c `D2Common.dll` outdoor DRLG grid/preset placement helpers (`Drlg\DrlgOutdoors.cpp`),
 * image base `0x6FD50000`.
 *
 * Every function below is a 1:1 port of the cited disassembly (`objdump -d -M intel` on `D2Common.dll`).
 */
import { D2DrlgLevelStrc } from '../../mem/layout.generated.ts';
import type { Memory113c } from '../../mem/sparse-memory.ts';
import { DRLG_GetLevelBorderStyle113c } from '../../tables/datatbls-113c.ts';
import {
  DRLGOUTWILD_GetBridgeCoords113c,
  DRLGOUTWILD_MarkCliffBorderVertices113c,
  DRLGOUTWILD_SpawnAllRiversAndBridges113c,
  DRLGOUTWILD_SpawnRiverColumnAndBridge113c,
  DRLGOUTWILD_TestSpawnRiver113c,
} from '../../tables/field-tbls-113c.ts';
import { ENVIRONMENT_Init113c } from '../env.ts';
import { D2CommonAssertError, SEED_RollRandomNumberInline113c } from '../inline-helpers.ts';
import { imul32, sdiv32, smod32 } from '../int-math.ts';
import { DRLGVER_SnapAndOffsetVertex113c } from '../text.ts';
import {
  DRLGGRID_OpAndNegated113c,
  DRLGGRID_OpOr113c,
  DRLGOUTDOORS_SpawnPresetInGrid113c,
  DRLGTILESUB_ApplySubThemeByIndex113c,
} from './drlg-grid.ts';
import {
  DRLGOUTPLACE_ApplyOutdoorVerticesToGrids113c,
  DRLGWARP_GetWarpDstAdjustData113c,
} from './drlg-room.ts';
import {
  DRLGOUTPLACE_BuildOutdoorMazeLinkPath113c,
  DRLGVER_ScaleOutdoorsVertices113c,
} from './drlg-ver.ts';
import { DRLGOUTPLACE_MarkBorderGridCells113c } from './out-place.ts';
import { DRLGGRID_AllocAndInitGridCells113c } from './drlg-grid.ts';
import { DRLGPRESET_CreatePresetRoomEx113c, DRLGROOM_SpawnOutdoorBorderPresets113c } from './drlg-room.ts';
import { DRLGVER_BuildAndLocalizeRoomVertices113c } from './drlg-ver.ts';
import { DRLG_GetLevel113c } from './drlg.ts';
import {
  DRLGOUTJUNG_InitAct2OutdoorLevel113c,
  DRLGOUTJUNG_InitAct4OutdoorLevel113c,
  DRLGOUTJUNG_SpawnAct3CityPresetsByLevel113c,
  DRLGOUTJUNG_SpawnTravincalPresets113c,
} from './out-jung.ts';
import { DRLGPRESET_AllocDrlgMap113c, DRLGPRESET_BuildPresetRoomsFromMap113c } from './preset.ts';
import { DRLGOUTWILD_BuildOutdoorPathsAndEnv113c } from './room-tile.ts';
import { DRLGOUTJUNG_BuildJunglePresets113c } from '../../prng.ts';
import { DRLGOUTANIM_BuildAct5Outdoors113c } from '../../tables/anim-tbls-113c.ts';

/**
 * `D2Common.dll` `.rdata` table at `0x6FDE34A4` (4 `{ dX, dY }` `int32_t` pairs = 32 bytes).
 * Indexed by outdoor border direction `eDir = 0..3` (`ebp * 8` in `0x6FD92C00`).
 *
 * `@va D2Common:0x6FDE34A4`
 */
export const OUTDOOR_BORDER_DIR_OFFSETS_6FDE34A4 = Int32Array.from([
  -4, 4,
  4, -4,
  12, 4,
  4, 12,
]);

/**
 * Outdoor theme bitmask table at `0x6FDE345C` (`uint32[4] = [0x1000, 0x2000, 0x4000, 0x8000]`).
 * Copied verbatim from `D2Common.dll` v1.13c.
 */
export const OUTDOOR_THEME_FLAGS_6FDE345C = Uint32Array.from([
  0x1000, 0x2000, 0x4000, 0x8000,
]);

/**
 * `D2Common.dll` `.data` addresses used by `DRLGOUTDOORS_SpawnOutdoorRoomEx113c` (`0x6FD92370`).
 */
export const SGPT_DATA_TABLES_PTR_VA_6FDE9E1C = 0x6fde9e1c;
export const SG_LVL_PREST_TXT_PTR_VA_6FDF0B3C = 0x6fdf0b3c;

/**
 * `@va D2Common:0x6FD92270` (`DRLGOUTDOORS_MapPresetSlotIndex113c`, `__fastcall(pLevel, nX, nY)`, `ret 4`).
 *
 * Free-cell predicate (`D2DrlgSubstContextStrc.pfTestFree1` at `ctx + 0x1C`):
 * reads `pOutdoors = pLevel->pOutdoors (+0x14)` and inspects `grid2` (`pCells` at `+0x2C`, `pRowOffsets` at `+0x30`)
 * at `(nX, nY)`, returning `((~(val >>> 10)) & 1)` (`1` when bit 10 `0x400` is clear, `0` when set).
 */
export function DRLGOUTDOORS_MapPresetSlotIndex113c(
  m: Memory113c,
  pLevel: number,
  nX: number,
  nY: number,
): number {
  const pOutdoors = m.get(pLevel, D2DrlgLevelStrc.pOutdoors);
  const pRowOffsets = m.u32((pOutdoors + 0x30) >>> 0);
  const pCells = m.u32((pOutdoors + 0x2c) >>> 0);
  const rowOff = m.u32((pRowOffsets + (nY | 0) * 4) >>> 0) | 0;
  const idx = (rowOff + (nX | 0)) | 0;
  const val = m.u32((pCells + (idx << 2)) >>> 0);
  return (~(val >>> 10)) & 1;
}

/**
 * `@va D2Common:0x6FD922A0` (`DRLGOUTDOORS_SetOutdoorCellFlag200_113c`, `__fastcall(pLevel, nX, nY)`, `ret 4`).
 *
 * Outdoor floor-clear callback (`D2DrlgSubstContextStrc.pfOnClear` at `ctx + 0x30`):
 * applies `gafGridCellOps[3]` (`OpOverwrite`, `0x6FD86C20`) with `0` to `pOutdoors->grid0[nY][nX]` (`+0x04`/`+0x08`)
 * and `gafGridCellOps[3]` (`OpOverwrite`, `0x6FD86C20`) with `0x100` to `pOutdoors->grid2[nY][nX]` (`+0x2C`/`+0x30`).
 */
export function DRLGOUTDOORS_SetOutdoorCellFlag200_113c(
  m: Memory113c,
  pLevel: number,
  nX: number,
  nY: number,
): void {
  const pOutdoors = m.get(pLevel, D2DrlgLevelStrc.pOutdoors);
  const x = nX | 0;
  const y = nY | 0;

  const pRowOffsets0 = m.u32((pOutdoors + 0x08) >>> 0);
  const rowOff0 = m.u32((pRowOffsets0 + y * 4) >>> 0) | 0;
  const pCells0 = m.u32((pOutdoors + 0x04) >>> 0);
  const pCell0 = (pCells0 + (((rowOff0 + x) | 0) << 2)) >>> 0;
  m.setU32(pCell0, 0);

  const pRowOffsets2 = m.u32((pOutdoors + 0x30) >>> 0);
  const rowOff2 = m.u32((pRowOffsets2 + y * 4) >>> 0) | 0;
  const pCells2 = m.u32((pOutdoors + 0x2c) >>> 0);
  const pCell2 = (pCells2 + (((rowOff2 + x) | 0) << 2)) >>> 0;
  m.setU32(pCell2, 0x100);
}

/**
 * `@va D2Common:0x6FD922F0` (`DRLGOUTDOORS_ClearOutdoorCellFlag200_113c`, `__fastcall(pLevel, nX, nY)`, `ret 4`).
 *
 * Outdoor floor-bit2 callback (`D2DrlgSubstContextStrc.pfOnBit2` at `ctx + 0x2C`):
 * applies `gafGridCellOps[3]` (`OpOverwrite`, `0x6FD86C20`) with `0` to both `pOutdoors->grid0[nY][nX]` (`+0x04`/`+0x08`)
 * and `pOutdoors->grid2[nY][nX]` (`+0x2C`/`+0x30`).
 */
export function DRLGOUTDOORS_ClearOutdoorCellFlag200_113c(
  m: Memory113c,
  pLevel: number,
  nX: number,
  nY: number,
): void {
  const pOutdoors = m.get(pLevel, D2DrlgLevelStrc.pOutdoors);
  const x = nX | 0;
  const y = nY | 0;

  const pRowOffsets0 = m.u32((pOutdoors + 0x08) >>> 0);
  const rowOff0 = m.u32((pRowOffsets0 + y * 4) >>> 0) | 0;
  const pCells0 = m.u32((pOutdoors + 0x04) >>> 0);
  const pCell0 = (pCells0 + (((rowOff0 + x) | 0) << 2)) >>> 0;
  m.setU32(pCell0, 0);

  const pRowOffsets2 = m.u32((pOutdoors + 0x30) >>> 0);
  const rowOff2 = m.u32((pRowOffsets2 + y * 4) >>> 0) | 0;
  const pCells2 = m.u32((pOutdoors + 0x2c) >>> 0);
  const pCell2 = (pCells2 + (((rowOff2 + x) | 0) << 2)) >>> 0;
  m.setU32(pCell2, 0);
}

/**
 * `@va D2Common:0x6FD92370` (`DRLGOUTDOORS_SpawnOutdoorRoomEx113c`, `__fastcall(pLevel, nX, nY, nLvlPrestId, nBorder, uFlags)`, `ret 0x10`).
 *
 * Outdoor preset footprint-free predicate (`D2DrlgSubstContextStrc.pfTestFree4` at `ctx + 0x20`):
 * computes the 8-tile-unit footprint `(w, h)` (either `(1, 1)` when `nLvlPrestId == 0`, or `(pPrest->nSizeX / 8, pPrest->nSizeY / 8)`
 * from `*(0x6FDF0B3C) + nLvlPrestId * 0x1B0`), expands by `nBorder` along the directions enabled in `uFlags & 0x0F`,
 * and returns `1` iff every cell in `[x .. x + w - 1] x [y .. y + h - 1]` is within `grid2` bounds (`+0x34`, `+0x38`)
 * and has `(grid2[cy][cx] & 0x1B81) == 0` (else `0`).
 */
export function DRLGOUTDOORS_SpawnOutdoorRoomEx113c(
  m: Memory113c,
  pLevel: number,
  nX: number,
  nY: number,
  nLvlPrestId: number,
  nBorder: number,
  uFlags: number,
): number {
  const pOutdoors = m.get(pLevel, D2DrlgLevelStrc.pOutdoors);
  let x = nX | 0;
  let y = nY | 0;
  const prestId = nLvlPrestId | 0;
  let w: number;
  let h: number;

  if (prestId === 0) {
    w = 1;
    h = 1;
  } else {
    const sgptDataTables = m.u32(SGPT_DATA_TABLES_PTR_VA_6FDE9E1C);
    const count = m.u32((sgptDataTables + 0xc68) >>> 0) | 0;
    const pPrest =
      prestId < 0 || prestId >= count
        ? 0
        : (m.u32(SG_LVL_PREST_TXT_PTR_VA_6FDF0B3C) +
            imul32(prestId, 0x1b0)) >>>
          0;
    const rawW = m.u32((pPrest + 0x28) >>> 0) | 0;
    const rawH = m.u32((pPrest + 0x2c) >>> 0) | 0;
    w = sdiv32(rawW, 8);
    h = sdiv32(rawH, 8);
  }

  const border = nBorder | 0;
  if (border !== 0) {
    const fl = uFlags & 0xff;
    if ((fl & 0x01) !== 0) {
      y = (y - border) | 0;
      h = (h + border) | 0;
    }
    if ((fl & 0x02) !== 0) {
      w = (w + border) | 0;
    }
    if ((fl & 0x04) !== 0) {
      h = (h + border) | 0;
    }
    if ((fl & 0x08) !== 0) {
      x = (x - border) | 0;
      w = (w + border) | 0;
    }
  }

  const endY = (y + h) | 0;
  const endX = (x + w) | 0;
  const gridW = m.u32((pOutdoors + 0x34) >>> 0) | 0;
  const gridH = m.u32((pOutdoors + 0x38) >>> 0) | 0;
  const pRowOffsets = m.u32((pOutdoors + 0x30) >>> 0);
  const pCells = m.u32((pOutdoors + 0x2c) >>> 0);

  for (let cy = y; cy < endY; cy++) {
    for (let cx = x; cx < endX; cx++) {
      if (cx < 0 || cx >= gridW || cy < 0 || cy >= gridH) {
        return 0;
      }
      const rowOff = m.u32((pRowOffsets + cy * 4) >>> 0) | 0;
      const cellVal = m.u32((pCells + (((rowOff + cx) | 0) << 2)) >>> 0);
      if ((cellVal & 0x1b81) !== 0) {
        return 0;
      }
    }
  }
  return 1;
}

/**
 * `@va D2Common:0x6FD92460` (`DRLGOUTDOORS_SpawnRandomOutdoorThemes113c`, custom `esi = pLevel`, `[esp+4] = nMaxSpawns`, `ret 4`).
 *
 * Rolls an initial theme index `(seed & 3)` on `pLevel->sSeed (+0x1C4)`, builds a coordinate list of
 * `nCells = (pOutdoors->nGridWidth - 2) * (pOutdoors->nGridHeight - 2)` interior cells, shuffles it with `nCells`
 * random swaps using `pLevel->sSeed`, and for up to `nMaxSpawns` cells whose `(x+1, y+1)` cell in `grid2`
 * avoids `0x1B81`, ORs `OUTDOOR_THEME_FLAGS_6FDE345C[themeIdx]` into `grid1[y+1][x+1]` and `0x1000` into `grid2[y+1][x+1]`.
 */
export function DRLGOUTDOORS_SpawnRandomOutdoorThemes113c(
  m: Memory113c,
  pLevel: number,
  nMaxSpawns: number,
): void {
  const pSeed = (pLevel + D2DrlgLevelStrc.sSeed.off) >>> 0;
  const pOutdoors = m.get(pLevel, D2DrlgLevelStrc.pOutdoors);
  let themeIdx = SEED_RollRandomNumberInline113c(m, pSeed, 4) & 3;

  const innerW = ((m.u32((pOutdoors + 0x5c) >>> 0) | 0) - 2) | 0;
  const innerH = ((m.u32((pOutdoors + 0x60) >>> 0) | 0) - 2) | 0;
  const nCells = imul32(innerH, innerW);
  if (nCells === 0) return;

  const xs = new Int32Array(nCells > 0 ? nCells : 0);
  const ys = new Int32Array(nCells > 0 ? nCells : 0);
  if (nCells > 0) {
    for (let i = 0; i < nCells; i++) {
      xs[i] = smod32(i, innerW);
      ys[i] = sdiv32(i, innerW);
    }
    for (let step = nCells; step !== 0; step--) {
      const idx1 = SEED_RollRandomNumberInline113c(m, pSeed, nCells);
      const idx2 = SEED_RollRandomNumberInline113c(m, pSeed, nCells);
      const tx = xs[idx1]!;
      const ty = ys[idx1]!;
      xs[idx1] = xs[idx2]!;
      ys[idx1] = ys[idx2]!;
      xs[idx2] = tx;
      ys[idx2] = ty;
    }
  }

  let remSpawns = nMaxSpawns | 0;
  for (let i = 0; i < nCells; i++) {
    if (remSpawns <= 0) break;
    const curOutdoors = m.get(pLevel, D2DrlgLevelStrc.pOutdoors);
    const gx = (xs[i]! + 1) | 0;
    const gy = (ys[i]! + 1) | 0;
    const pRowOffsets2 = m.u32((curOutdoors + 0x30) >>> 0);
    const rowOff2 = m.u32((pRowOffsets2 + gy * 4) >>> 0) | 0;
    const pCells2 = m.u32((curOutdoors + 0x2c) >>> 0);
    const pCell2 = (pCells2 + (((rowOff2 + gx) | 0) << 2)) >>> 0;
    if ((m.u32(pCell2) & 0x1b81) === 0) {
      const pRowOffsets1 = m.u32((pOutdoors + 0x1c) >>> 0);
      const rowOff1 = m.u32((pRowOffsets1 + gy * 4) >>> 0) | 0;
      const pCells1 = m.u32((pOutdoors + 0x18) >>> 0);
      const pCell1 = (pCells1 + (((rowOff1 + gx) | 0) << 2)) >>> 0;
      const themeFlag = OUTDOOR_THEME_FLAGS_6FDE345C[themeIdx]!;
      m.setU32(pCell1, (m.u32(pCell1) | themeFlag) >>> 0);

      const pRowOffsets2b = m.u32((pOutdoors + 0x30) >>> 0);
      const rowOff2b = m.u32((pRowOffsets2b + gy * 4) >>> 0) | 0;
      const pCells2b = m.u32((pOutdoors + 0x2c) >>> 0);
      const pCell2b = (pCells2b + (((rowOff2b + gx) | 0) << 2)) >>> 0;
      m.setU32(pCell2b, (m.u32(pCell2b) | 0x1000) >>> 0);

      themeIdx = (themeIdx + 1) & 3;
      remSpawns = (remSpawns - 1) | 0;
    }
  }
}

/**
 * `@va D2Common:0x6FD92070` (`DRLGOUTDOORS_ScaleAndCompactVertices113c`, custom `edi = ppVertexHead`, `ebx = pMemPool`, `ret`).
 *
 * Scales every vertex's `(nPosX, nPosY)` in the circular `D2DrlgVertexStrc` list at `*ppVertexHead` by truncating signed division by `8`
 * (`(v + (v < 0 ? 7 : 0)) >> 3`), then compacts adjacent duplicate vertices (`pCur->nPosX == pNext->nPosX && pCur->nPosY == pNext->nPosY`)
 * by updating `*ppVertexHead` when `pNext == *ppVertexHead`, unlinking `pNext`, ORing `pNext->dwFlags` into `pCur->dwFlags`,
 * copying `pNext->nDirection` to `pCur->nDirection`, and freeing `pNext` via `Fog.#10046`.
 */
export function DRLGOUTDOORS_ScaleAndCompactVertices113c(
  m: Memory113c,
  ppVertexHead: number,
  _pMemPool = 0,
): void {
  const ppHead = ppVertexHead >>> 0;
  let pCur = m.u32(ppHead);
  do {
    const x = m.u32(pCur) | 0;
    m.setU32(pCur, sdiv32(x, 8) >>> 0);
    const y = m.u32((pCur + 0x04) >>> 0) | 0;
    m.setU32((pCur + 0x04) >>> 0, sdiv32(y, 8) >>> 0);
    pCur = m.u32((pCur + 0x10) >>> 0);
  } while (pCur !== m.u32(ppHead));

  const freeFn = (m as { free?: (p: number) => void }).free;
  do {
    const pNext = m.u32((pCur + 0x10) >>> 0);
    if (
      (m.u32(pCur) | 0) === (m.u32(pNext) | 0) &&
      (m.u32((pCur + 0x04) >>> 0) | 0) === (m.u32((pNext + 0x04) >>> 0) | 0)
    ) {
      if (pNext === m.u32(ppHead)) {
        m.setU32(ppHead, pCur);
      }
      m.setU32((pCur + 0x10) >>> 0, m.u32((pNext + 0x10) >>> 0));
      const nextFlags = m.u32((pNext + 0x0c) >>> 0);
      const curFlags = m.u32((pCur + 0x0c) >>> 0);
      m.setU32((pCur + 0x0c) >>> 0, (curFlags | nextFlags) >>> 0);
      const nextDir = m.u8((pNext + 0x08) >>> 0);
      m.setU8((pCur + 0x08) >>> 0, nextDir);
      freeFn?.call(m, pNext);
    }
    pCur = m.u32((pCur + 0x10) >>> 0);
  } while (pCur !== m.u32(ppHead));
}

/**
 * `@va D2Common:0x6FD92A20` (`DRLGOUTDOORS_GetLevelLinkVisBit113c`, not exported;
 * custom LTCG `eax = pLevel`, stack `[esp+4] = pAdjLevel`, `ret 4`).
 *
 * Resolves `pVisArr = DRLGWARP_GetWarpDstAdjustData113c(m, pLevel->pDrlg (+0x1B4), pLevel->nLevelId (+0x1D0))`,
 * scans `i = 0..7` for `pVisArr[i] == pAdjLevel->nLevelId (+0x1D0)`, and returns `1 << (i + 4)` on match (or `0` if not found).
 */
export function DRLGOUTDOORS_GetLevelLinkVisBit113c(
  m: Memory113c,
  pLevel: number,
  pAdjLevel: number,
): number {
  const lvl = pLevel >>> 0;
  const adj = pAdjLevel >>> 0;
  const nLevelId = m.get(lvl, D2DrlgLevelStrc.nLevelId) | 0;
  const pDrlg = m.get(lvl, D2DrlgLevelStrc.pDrlg);
  const pVisArr = DRLGWARP_GetWarpDstAdjustData113c(m, pDrlg, nLevelId) >>> 0;
  const adjId = m.get(adj, D2DrlgLevelStrc.nLevelId) | 0;
  for (let i = 0; i < 8; i++) {
    if ((m.u32((pVisArr + i * 4) >>> 0) | 0) === adjId) {
      return (1 << (i + 4)) >>> 0;
    }
  }
  return 0;
}

/**
 * `@va D2Common:0x6FD92CE0` (`DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c`, not exported;
 * custom LTCG `esi = pLevel`, `[esp+4] = nLvlPrestId`, `[esp+8] = nPickedFile`, `[esp+0xC] = nBorder`, `[esp+0x10] = uFlags`, `ret 0x10`).
 */
export function DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(
  m: Memory113c,
  pLevel: number,
  nLvlPrestId: number,
  nPickedFile: number,
  nBorder: number,
  uFlags: number,
): number {
  const lvl = pLevel >>> 0;
  const pOutdoors = m.u32((lvl + 0x14) >>> 0);
  const innerW = ((m.u32((pOutdoors + 0x5c) >>> 0) | 0) - 2) | 0;
  const innerH = ((m.u32((pOutdoors + 0x60) >>> 0) | 0) - 2) | 0;
  const nCount = imul32(innerH, innerW);
  if (nCount === 0) {
    return 0;
  }

  const xs = new Int32Array(nCount > 0 ? nCount : 0);
  const ys = new Int32Array(nCount > 0 ? nCount : 0);
  if (nCount > 0) {
    for (let i = 0; i < nCount; i++) {
      xs[i] = smod32(i, innerW);
      ys[i] = sdiv32(i, innerW);
    }
    const pSeed = (lvl + 0x1c4) >>> 0;
    for (let step = nCount; step !== 0; step--) {
      const idxA = SEED_RollRandomNumberInline113c(m, pSeed, nCount);
      const idxB = SEED_RollRandomNumberInline113c(m, pSeed, nCount);
      const tmpX = xs[idxA]!;
      const tmpY = ys[idxA]!;
      xs[idxA] = xs[idxB]!;
      ys[idxA] = ys[idxB]!;
      xs[idxB] = tmpX;
      ys[idxB] = tmpY;
    }
  }

  for (let i = 0; i < nCount; i++) {
    const candX = (xs[i]! + 1) | 0;
    const candY = (ys[i]! + 1) | 0;
    if (
      DRLGOUTDOORS_SpawnOutdoorRoomEx113c(
        m,
        lvl,
        candX,
        candY,
        nLvlPrestId | 0,
        nBorder | 0,
        uFlags >>> 0,
      ) !== 0
    ) {
      DRLGOUTDOORS_SpawnPresetInGrid113c(
        m,
        lvl,
        candX,
        candY,
        nLvlPrestId | 0,
        nPickedFile | 0,
        0,
      );
      return 1;
    }
  }
  return 0;
}

/**
 * `@va D2Common:0x6FD92C00` (`DRLGOUTDOORS_ComputeVertexLevelLinkVisBit113c`, not exported;
 * custom LTCG `ecx = pVertex`, `[esp+4] = pLevel`, `ret 4`).
 */
export function DRLGOUTDOORS_ComputeVertexLevelLinkVisBit113c(
  m: Memory113c,
  pVertex: number,
  pLevel: number,
): number {
  const vertex = pVertex >>> 0;
  const lvl = pLevel >>> 0;
  const pOutdoors = m.u32((lvl + 0x14) >>> 0);
  const vx = m.u32(vertex) | 0;
  const vy = m.u32((vertex + 0x04) >>> 0) | 0;

  let eDir: number;
  if (vx === 0) {
    eDir = vy === 0 ? 1 : 0;
  } else {
    const maxW = ((m.u32((pOutdoors + 0x5c) >>> 0) | 0) - 1) | 0;
    if (vy === 0) {
      eDir = vx === maxW ? 2 : 1;
    } else {
      const maxH = ((m.u32((pOutdoors + 0x60) >>> 0) | 0) - 1) | 0;
      if (vx === maxW) {
        eDir = vy === maxH ? 3 : 2;
      } else if (vy === maxH) {
        eDir = 3;
      } else {
        return 0;
      }
    }
  }

  const worldX =
    (OUTDOOR_BORDER_DIR_OFFSETS_6FDE34A4[eDir * 2]! + (vx << 3) + (m.u32((lvl + 0x1c) >>> 0) | 0)) |
    0;
  const worldY =
    (OUTDOOR_BORDER_DIR_OFFSETS_6FDE34A4[eDir * 2 + 1]! +
      (vy << 3) +
      (m.u32((lvl + 0x20) >>> 0) | 0)) |
    0;

  let pOrth = m.u32((pOutdoors + 0x264) >>> 0);
  while (pOrth !== 0) {
    if ((m.u32((pOrth + 0x04) >>> 0) | 0) === eDir) {
      const pBox = m.u32((pOrth + 0x10) >>> 0);
      const bx = m.u32(pBox) | 0;
      const by = m.u32((pBox + 0x04) >>> 0) | 0;
      const bw = m.u32((pBox + 0x08) >>> 0) | 0;
      const bh = m.u32((pBox + 0x0c) >>> 0) | 0;
      if (worldX >= bx && worldY >= by && worldX < ((bx + bw) | 0) && worldY < ((by + bh) | 0)) {
        if (m.u32((pOrth + 0x0c) >>> 0) !== 0) {
          return 0;
        }
        return DRLGOUTDOORS_GetLevelLinkVisBit113c(m, lvl, m.u32(pOrth));
      }
    }
    pOrth = m.u32((pOrth + 0x14) >>> 0);
  }
  return 0;
}

const OUTDOORS_ACT_BOUNDARIES_6FDE4668 = [1, 40, 75, 103, 109, 1024] as const;
const OUTDOORS_NEAR_DY_6FDE346C = [0, -1, 1, 0, -1, 1, -1, 1] as const;
const OUTDOORS_NEAR_DX_6FDE3474 = [-1, 0, 0, 1, -1, 1, 1, -1] as const;
const BORDER_PRESET_LOW_6FDDCAB8 = [
  50462976, 16843008, 33620483, 16909056,
  0, 4, 364, 799,
  16, 5, 365, 800,
  17, 6, 366, 801,
  0, 7, 367, 802,
  18, 8, 368, 803,
] as const;
const BORDER_PRESET_HIGH_6FDDCB88 = [
  881, 957, 882, 958, 883, 959, 884, 960, 885, 961,
  886, 962, 887, 963, 888, 964, 889, 965, 890, 966,
] as const;
const BORDER_PRESET_ACT3_6FDE55B8 = [
  373, 372, 372, 375, 0, 0, 373, 374, 374, 375,
] as const;
const BORDER_DIR_TO_IDX_6FDE5734 = [-1, 1, -1, 0, -1, 2, -1, 3, -1] as const;
const BORDER_CORNER_IDX_6FDE5644 = [
  -1, 10, 1, 9, 9, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
  -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 11, 11, 3, 12,
  -1, -1, -1, -1, 12, 4, 4, 7, -1, -1, 2, 10, -1, -1, -1,
  -1, 10, -1, -1, 6, 3, -1, -1, 11, 11, 3, -1, 1, -1, 0,
] as const;
const OUTDOOR_PRESET_EDGE_MAP_6FD8D7DC = [
  0, 1, 2, 3, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9,
  9, 9, 9, 9, 4, 5, 9, 9, 6, 9, 9, 9, 9, 9, 9, 9,
  9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 7, 8,
] as const;
const BRIDGE_OFF_Y_6FDE4040 = [0, 1, -1, 0] as const;
const BRIDGE_OFF_X_6FDE4050 = [-1, 0, 0, 1] as const;

const OUTDOORS_STACK_BASE = 0x7ff50000;
const OUTDOORS_STACK_SIZE = 0x100;
const _outdoorsStackBuf = new ArrayBuffer(OUTDOORS_STACK_SIZE);
const _outdoorsStackU8 = new Uint8Array(_outdoorsStackBuf);
const _outdoorsStackDV = new DataView(_outdoorsStackBuf);

function withOutdoorsStackScratch113c(m: Memory113c): Memory113c {
  const isStack = (p: number): boolean => {
    const u = p >>> 0;
    return u >= OUTDOORS_STACK_BASE && u < OUTDOORS_STACK_BASE + OUTDOORS_STACK_SIZE;
  };
  return {
    alloc: size => m.alloc(size),
    u8: p => (isStack(p) ? _outdoorsStackU8[(p >>> 0) - OUTDOORS_STACK_BASE]! : m.u8(p)),
    u16: p => (isStack(p) ? _outdoorsStackDV.getUint16((p >>> 0) - OUTDOORS_STACK_BASE, true) : m.u16(p)),
    u32: p => (isStack(p) ? _outdoorsStackDV.getUint32((p >>> 0) - OUTDOORS_STACK_BASE, true) : m.u32(p)),
    setU8: (p, v) => {
      if (isStack(p)) _outdoorsStackU8[(p >>> 0) - OUTDOORS_STACK_BASE] = v & 0xff;
      else m.setU8(p, v);
    },
    setU16: (p, v) => {
      if (isStack(p)) _outdoorsStackDV.setUint16((p >>> 0) - OUTDOORS_STACK_BASE, v & 0xffff, true);
      else m.setU16(p, v);
    },
    setU32: (p, v) => {
      if (isStack(p)) _outdoorsStackDV.setUint32((p >>> 0) - OUTDOORS_STACK_BASE, v >>> 0, true);
      else m.setU32(p, v);
    },
    get: (base, f, idx = 0) => m.get(base, f, idx),
    set: (base, f, v, idx = 0) => m.set(base, f, v, idx),
    fill: (p, len, byte) => {
      if (isStack(p)) {
        _outdoorsStackU8.fill(
          byte & 0xff,
          (p >>> 0) - OUTDOORS_STACK_BASE,
          (p >>> 0) - OUTDOORS_STACK_BASE + len,
        );
      } else {
        m.fill(p, len, byte);
      }
    },
  };
}

function lcgNextBound113c(m: Memory113c, level: number, bound: number): number {
  if (bound <= 0) return 0;
  const lo = BigInt(m.u32((level + 0x1c4) >>> 0));
  const hi = BigInt(m.u32((level + 0x1c8) >>> 0));
  const next = lo * 0x6ac690c5n + hi;
  const newLo = Number(next & 0xffffffffn) >>> 0;
  const newHi = Number((next >> 32n) & 0xffffffffn) >>> 0;
  m.setU32((level + 0x1c4) >>> 0, newLo);
  m.setU32((level + 0x1c8) >>> 0, newHi);
  if ((bound & (bound - 1)) === 0) {
    return newLo & (bound - 1);
  }
  return newLo % (bound >>> 0);
}

function signum32(v: number): number {
  const s = v | 0;
  return s < 0 ? -1 : s > 0 ? 1 : 0;
}

function stepDir2(v: number): number {
  const s = v | 0;
  return s < 0 ? (s - 2) | 0 : s > 0 ? (s + 2) | 0 : 0;
}

/**
 * `@va D2Common:0x6FDCEDC0` (`DRLGOUTWILD_SpawnOptionalBorderPair113c`,
 * `__usercall(nLvlPrestId@<eax>, pLevel@<esi>, bExtra@<stack+4>) -> void`, `ret 0x4`).
 */
export function DRLGOUTWILD_SpawnOptionalBorderPair113c(
  m: Memory113c,
  nLvlPrestId: number,
  pLevel: number,
  bExtra: number,
): void {
  const lvl = pLevel >>> 0;
  const pSeed = (lvl + 0x1c4) >>> 0;
  const lo = BigInt(m.u32(pSeed));
  const hi = BigInt(m.u32((pSeed + 4) >>> 0));
  const next = lo * 0x6ac690c5n + hi;
  const newLo = Number(next & 0xffffffffn) >>> 0;
  const newHi = Number((next >> 32n) & 0xffffffffn) >>> 0;
  m.setU32(pSeed, newLo);
  m.setU32((pSeed + 4) >>> 0, newHi);

  if ((newLo & 3) === 0) {
    DRLGOUTDOORS_PlaceRandomOutdoorPresetNearSeed113c(m, lvl, nLvlPrestId | 0, -1);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetNearSeed113c(m, lvl, nLvlPrestId | 0, -1);
    return;
  }

  DRLGOUTDOORS_PlaceRandomOutdoorPresetNearSeed113c(m, lvl, nLvlPrestId | 0, -1);
  if ((bExtra | 0) === 0) return;

  const lo2 = BigInt(m.u32(pSeed));
  const hi2 = BigInt(m.u32((pSeed + 4) >>> 0));
  const next2 = lo2 * 0x6ac690c5n + hi2;
  const newLo2 = Number(next2 & 0xffffffffn) >>> 0;
  const newHi2 = Number((next2 >> 32n) & 0xffffffffn) >>> 0;
  m.setU32(pSeed, newLo2);
  m.setU32((pSeed + 4) >>> 0, newHi2);
  if ((newLo2 & 1) !== 0) {
    DRLGOUTDOORS_PlaceRandomOutdoorPresetNearSeed113c(m, lvl, 0x31, -1);
  }
}

/**
 * `@va D2Common:0x6FDCEE50` (`DRLGOUTWILD_SpawnSpecialOutdoorEdgesAndWaypoint113c`,
 * `__usercall(pLevel@<eax>) -> void`).
 */
export function DRLGOUTWILD_SpawnSpecialOutdoorEdgesAndWaypoint113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  if ((m.u32((lvl + 0x1d0) >>> 0) | 0) === 0x27) return;
  const pOut = m.u32((lvl + 0x14) >>> 0) >>> 0;
  const dwFlags = m.u32(pOut) >>> 0;

  if ((dwFlags & 0x10) !== 0) {
    const midX = ((m.u32((pOut + 0x5c) >>> 0) | 0) >> 1) - 1;
    if (DRLGOUTWILD_TestSpawnRiver113c(m, lvl, midX) !== 0) {
      DRLGOUTWILD_SpawnRiverColumnAndBridge113c(m, midX, lvl);
    }
  }
  if ((dwFlags & 0x80) !== 0) {
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, 0, 3, 1, 0);
  }
  if ((dwFlags & 0x100) !== 0) {
    const gx = ((m.u32((pOut + 0x5c) >>> 0) | 0) - 7) | 0;
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, gx, 0, 3, 2, 0);
  }
  if ((dwFlags & 0x200) !== 0) {
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, 1, 2, 1, 0);
  }
  if ((dwFlags & 0x400) !== 0) {
    const gy = ((m.u32((pOut + 0x60) >>> 0) | 0) - 6) | 0;
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, gy, 2, 1, 0);
  }
  if ((dwFlags & 0x40) === 0) {
    let placed = 0;
    if ((m.u32((lvl + 0x1d0) >>> 0) | 0) === 2) {
      const pCoords = DRLG_GetLevel113c(m, m.u32((lvl + 0x1b4) >>> 0), 1) >>> 0;
      placed = DRLGOUTDOORS_PlaceClosestOutdoorPresetToRect113c(
        m,
        lvl,
        (pCoords + 0x1c) >>> 0,
        0x34,
        -1,
        1,
        0x0f,
      ) | 0;
    } else {
      placed = DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x33, -1, 1, 0x0f) | 0;
    }
    if (placed === 0) {
      throw new D2CommonAssertError('', 0x1e5);
    }
    m.setU32(pOut, (m.u32(pOut) | 0x40) >>> 0);
  }
}

const OUTWILD_LEVEL_CASE_6FDCF374: readonly number[] = [
  0, 1, 2, 3, 4, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8, 6,
  8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8,
  8, 8, 8, 8, 8, 7,
];

/**
 * `@va D2Common:0x6FDCF180` (`DRLGOUTWILD_SpawnAct1OutdoorPresetsByLevel113c`,
 * `__usercall(pLevel@<eax>) -> void`).
 */
export function DRLGOUTWILD_SpawnAct1OutdoorPresetsByLevel113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  const idx = ((m.u32((lvl + 0x1d0) >>> 0) | 0) - 2) >>> 0;
  if (idx > 0x25) return;
  const sw = OUTWILD_LEVEL_CASE_6FDCF374[idx]!;
  if (sw === 0) {
    DRLGOUTDOORS_PlaceRandomOutdoorPresetNearSeed113c(m, lvl, 0x2e, -1);
    DRLGOUTWILD_SpawnOptionalBorderPair113c(m, 0x2f, lvl, 0);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x1d, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x1e, -1, 0, 0x0f);
  } else if (sw === 1) {
    DRLGOUTWILD_SpawnOptionalBorderPair113c(m, 0x30, lvl, 1);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x2c, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x1d, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x1e, -1, 0, 0x0f);
  } else if (sw === 2) {
    DRLGOUTDOORS_PlaceRandomOutdoorPresetNearSeed113c(m, lvl, 0xa0, -1);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetNearSeed113c(m, lvl, 0x2d, -1);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0xa2, -1, 0, 0x0f);
    DRLGOUTWILD_SpawnOptionalBorderPair113c(m, 0x2f, lvl, 1);
    DRLGOUTWILD_SpawnOptionalBorderPair113c(m, 0x2a, lvl, 0);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x1f, -1, 0, 0x0f);
  } else if (sw === 3) {
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0xa1, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x29, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x28, -1, 0, 0x0f);
    DRLGOUTWILD_SpawnOptionalBorderPair113c(m, 0x30, lvl, 1);
    DRLGOUTWILD_SpawnOptionalBorderPair113c(m, 0x2b, lvl, 0);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x1d, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x1e, -1, 0, 0x0f);
  } else if (sw === 4) {
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0xa3, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x26, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x27, -1, 0, 0x0f);
    DRLGOUTWILD_SpawnOptionalBorderPair113c(m, 0x2f, lvl, 1);
    DRLGOUTWILD_SpawnOptionalBorderPair113c(m, 0x2a, lvl, 0);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x1d, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x1e, -1, 0, 0x0f);
  } else if (sw === 5) {
    DRLGOUTWILD_SpawnOptionalBorderPair113c(m, 0x30, lvl, 1);
    DRLGOUTWILD_SpawnOptionalBorderPair113c(m, 0x2b, lvl, 0);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x1f, -1, 0, 0x0f);
  } else if (sw === 6) {
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 1, 1, 0x6c, -1, 0);
  } else if (sw === 7) {
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x32, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x2e, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x1f, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x26, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x27, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x1d, -1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x1e, -1, 0, 0x0f);
  }
}

/**
 * `@va D2Common:0x6FDCF3A0` (`DRLGOUTWILD_InitAct1OutdoorLevel113c`,
 * `__usercall(pLevel@<eax>) -> void`, tail-jmp `0x6FDCF180`).
 */
export function DRLGOUTWILD_InitAct1OutdoorLevel113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  const nLevelId = m.u32((lvl + 0x1d0) >>> 0) | 0;
  if (nLevelId !== 2 && nLevelId !== 3 && nLevelId !== 0x11) {
    DRLGOUTWILD_MarkCliffBorderVertices113c(m, lvl);
  }
  DRLGOUTPLACE_ApplyOutdoorVerticesToGrids113c(m, lvl);
  DRLGROOM_SpawnOutdoorBorderPresets113c(m, lvl);
  if (nLevelId >= 2 && nLevelId <= 7) {
    DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 0, 4);
    DRLGOUTWILD_SpawnAllRiversAndBridges113c(m, lvl);
    DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 1, 4);
    DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 2, 4);
    DRLGOUTWILD_SpawnSpecialOutdoorEdgesAndWaypoint113c(m, lvl);
    DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 3, 4);
    DRLGOUTWILD_BuildOutdoorPathsAndEnv113c(m, lvl);
  }
  if (nLevelId === 0x27) {
    DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 0, 4);
    DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 1, 4);
    DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 2, 4);
    DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 3, 4);
  }
  if (nLevelId >= 3 && nLevelId <= 6) {
    DRLGOUTDOORS_PlaceRandomOutdoorShrineOrSpecial113c(m, lvl);
  }
  if (nLevelId >= 2 && nLevelId <= 7) {
    DRLGOUTDOORS_SpawnRandomOutdoorThemes113c(m, lvl, 5);
  }
  DRLGOUTWILD_SpawnAct1OutdoorPresetsByLevel113c(m, lvl);
}

const OUTDOORS_ROOM_MASK_SWITCH_6FD93330 = [
  0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 1, 4,
  4, 4, 4, 2, 1, 4, 4, 4, 4, 1, 1, 4, 3, 3,
] as const;
/**
 * `D2Common.dll` `0x6FD926A0` (internal `__usercall(pLevel@<eax>)`).
 */
export function DRLGOUTDOORS_PlaceRandomOutdoorShrineOrSpecial113c(
  m: Memory113c,
  pLevel: number,
): void {
  const level = pLevel >>> 0;
  const nLevelId = m.u32((level + 0x1d0) >>> 0) | 0;
  const pOutdoors = m.u32((level + 0x14) >>> 0);

  if (nLevelId === 3) {
    const pWarpLevels = DRLGWARP_GetWarpDstAdjustData113c(m, m.u32((level + 0x1b4) >>> 0), nLevelId) >>> 0;
    let bit = 0;
    for (let i = 0; i < 8; i++) {
      if ((m.u32((pWarpLevels + i * 4) >>> 0) | 0) === 2) {
        bit = i;
        break;
      }
    }
    const mask = (1 << (bit + 4)) >>> 0;
    const gw = m.u32((pOutdoors + 0x5c) >>> 0) | 0;
    const gh = m.u32((pOutdoors + 0x60) >>> 0) | 0;
    const g1Rows = m.u32((pOutdoors + 0x1c) >>> 0);
    const g1Cells = m.u32((pOutdoors + 0x18) >>> 0);
    const g2Rows = m.u32((pOutdoors + 0x30) >>> 0);
    const g2Cells = m.u32((pOutdoors + 0x2c) >>> 0);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const r1 = m.u32((g1Rows + y * 4) >>> 0) | 0;
        if ((m.u32((g1Cells + ((r1 + x) | 0) * 4) >>> 0) & mask) !== 0) {
          const r2 = m.u32((g2Rows + y * 4) >>> 0) | 0;
          if ((m.u8((g2Cells + ((r2 + x) | 0) * 4 + 1) >>> 0) & 0x04) !== 0) {
            let cx = x === 0 ? 1 : x;
            let cy = y === 0 ? 1 : y;
            if (cx === ((gw - 1) | 0)) cx = (cx - 1) | 0;
            if (cy === ((gh - 1) | 0)) cy = (cy - 1) | 0;
            const cr1 = m.u32((g1Rows + cy * 4) >>> 0) | 0;
            DRLGGRID_OpOr113c(m, (g1Cells + ((cr1 + cx) | 0) * 4) >>> 0, 0x20000);
            const cr2 = m.u32((g2Rows + cy * 4) >>> 0) | 0;
            DRLGGRID_OpOr113c(m, (g2Cells + ((cr2 + cx) | 0) * 4) >>> 0, 0x800);
            return;
          }
        }
      }
    }
  }

  const innerW = ((m.u32((pOutdoors + 0x5c) >>> 0) | 0) - 2) | 0;
  const innerH = ((m.u32((pOutdoors + 0x60) >>> 0) | 0) - 2) | 0;
  const total = imul32(innerW, innerH);
  if (total === 0) return;

  const coordsX = new Int32Array(total);
  const coordsY = new Int32Array(total);
  for (let i = 0; i < total; i++) {
    coordsX[i] = smod32(i, innerW);
    coordsY[i] = sdiv32(i, innerW);
  }
  for (let i = 0; i < total; i++) {
    const r1 = lcgNextBound113c(m, level, total);
    const r2 = lcgNextBound113c(m, level, total);
    const tx = coordsX[r1]!;
    const ty = coordsY[r1]!;
    coordsX[r1] = coordsX[r2]!;
    coordsY[r1] = coordsY[r2]!;
    coordsX[r2] = tx;
    coordsY[r2] = ty;
  }

  const g2Rows = m.u32((pOutdoors + 0x30) >>> 0);
  const g2Cells = m.u32((pOutdoors + 0x2c) >>> 0);
  const g1Rows = m.u32((pOutdoors + 0x1c) >>> 0);
  const g1Cells = m.u32((pOutdoors + 0x18) >>> 0);
  for (let i = 0; i < total; i++) {
    const px = (coordsX[i]! + 1) | 0;
    const py = (coordsY[i]! + 1) | 0;
    const r2 = m.u32((g2Rows + py * 4) >>> 0) | 0;
    if ((m.u32((g2Cells + ((r2 + px) | 0) * 4) >>> 0) & 0x1b81) === 0) {
      const r1 = m.u32((g1Rows + py * 4) >>> 0) | 0;
      DRLGGRID_OpOr113c(m, (g1Cells + ((r1 + px) | 0) * 4) >>> 0, 0x10000);
      DRLGGRID_OpOr113c(m, (g2Cells + ((r2 + px) | 0) * 4) >>> 0, 0x800);
      return;
    }
  }
}

/**
 * `D2Common.dll` `0x6FD92EB0` (internal `__usercall(pLevel@<edi>, pRect, nPresetId, nFlags, nArg4, nArg5)`).
 */
export function DRLGOUTDOORS_PlaceClosestOutdoorPresetToRect113c(
  m: Memory113c,
  pLevel: number,
  pRect: number,
  nPresetId: number,
  nFlags: number,
  nArg4: number,
  nArg5: number,
): number {
  const level = pLevel >>> 0;
  const pOutdoors = m.u32((level + 0x14) >>> 0);
  const innerW = ((m.u32((pOutdoors + 0x5c) >>> 0) | 0) - 2) | 0;
  const innerH = ((m.u32((pOutdoors + 0x60) >>> 0) | 0) - 2) | 0;
  const startX = lcgNextBound113c(m, level, innerW);
  const startY = lcgNextBound113c(m, level, innerH);

  const rect = pRect >>> 0;
  const rx = m.u32(rect) | 0;
  const ry = m.u32((rect + 0x04) >>> 0) | 0;
  const rw = m.u32((rect + 0x08) >>> 0) | 0;
  const rh = m.u32((rect + 0x0c) >>> 0) | 0;
  const centerX = (rx + (rw >> 1)) | 0;
  const centerY = (ry + (rh >> 1)) | 0;
  const lx = m.u32((level + 0x1c) >>> 0) | 0;
  const ly = m.u32((level + 0x20) >>> 0) | 0;

  let bestDist = 0;
  let bestX = -1;
  let bestY = -1;

  for (let iy = 0; iy <= innerH; iy++) {
    const gy = (smod32((iy + startY) | 0, innerH) + 1) | 0;
    for (let ix = 0; ix <= innerW; ix++) {
      const gx = (smod32((ix + startX) | 0, innerW) + 1) | 0;
      if (DRLGOUTDOORS_SpawnOutdoorRoomEx113c(m, level, gx, gy, nPresetId, nArg4, nArg5) !== 0) {
        let dx = ((gx * 8 - centerX + lx + 4) | 0);
        if (dx < 0) dx = -dx | 0;
        let dy = ((gy * 8 - centerY + ly + 4) | 0);
        if (dy < 0) dy = -dy | 0;
        const d = (dx > dy ? (dy + dx * 2) : (dx + dy * 2)) >> 1;
        if (bestDist < d) {
          bestDist = d;
          bestX = gx;
          bestY = gy;
        }
      }
    }
  }

  if (bestX !== -1 && bestY !== -1) {
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, level, bestX, bestY, nPresetId, nFlags, 0);
    return 1;
  }
  return 0;
}

/**
 * `D2Common.dll` `0x6FD93100` (internal `__usercall(pLevel@<eax>, nArg1, nArg2)`).
 */
export function DRLGOUTDOORS_BuildOutdoorSubstContext113c(
  m: Memory113c,
  pLevel: number,
  nArg1: number,
  nArg2: number,
): void {
  const sm = withOutdoorsStackScratch113c(m);
  const level = pLevel >>> 0;
  const pOutdoors = sm.u32((level + 0x14) >>> 0);
  const ctx = OUTDOORS_STACK_BASE;
  sm.fill(ctx, 0x38, 0);
  sm.setU32(ctx, level);
  sm.setU32((ctx + 0x04) >>> 0, (pOutdoors + 0x54) >>> 0);
  sm.setU32((ctx + 0x08) >>> 0, (pOutdoors + 0x04) >>> 0);
  sm.setU32((ctx + 0x0c) >>> 0, (pOutdoors + 0x2c) >>> 0);
  sm.setU32((ctx + 0x10) >>> 0, nArg2 >>> 0);
  sm.setU32((ctx + 0x14) >>> 0, 0xffffffff);
  sm.setU32((ctx + 0x18) >>> 0, nArg1 >>> 0);
  sm.setU32((ctx + 0x1c) >>> 0, 0x6fd92270);
  sm.setU32((ctx + 0x20) >>> 0, 0x6fd92370);
  sm.setU32((ctx + 0x2c) >>> 0, 0x6fd922f0);
  sm.setU32((ctx + 0x30) >>> 0, 0x6fd922a0);
  sm.setU32((ctx + 0x34) >>> 0, 0x6fd92a70);
  DRLGTILESUB_ApplySubThemeByIndex113c(sm, ctx);
}

/**
 * `D2Common.dll` `0x6FD93190` (internal `__stdcall(pLevel)`).
 */
export function DRLGOUTDOORS_BuildOutdoorRoomExList113c(
  m: Memory113c,
  pLevel: number,
): void {
  const sm = withOutdoorsStackScratch113c(m);
  const level = pLevel >>> 0;
  const nLevelType = sm.u32((level + 0x1c0) >>> 0) | 0;
  const pOutdoors = sm.u32((level + 0x14) >>> 0);
  let roomFlags = 0;
  const rel = (nLevelType - 2) >>> 0;
  if (rel <= 0x1d) {
    const sw = OUTDOORS_ROOM_MASK_SWITCH_6FD93330[rel]!;
    if (sw === 0) roomFlags = 0x44103;
    else if (sw === 1) roomFlags = 1;
    else if (sw === 2) roomFlags = 4;
    else if (sw === 3) roomFlags = 0x11;
  }

  const gh = sm.u32((pOutdoors + 0x60) >>> 0) | 0;
  const gw = sm.u32((pOutdoors + 0x5c) >>> 0) | 0;
  const g0Rows = sm.u32((pOutdoors + 0x08) >>> 0);
  const g0Cells = sm.u32((pOutdoors + 0x04) >>> 0);
  const g1Rows = sm.u32((pOutdoors + 0x1c) >>> 0);
  const g1Cells = sm.u32((pOutdoors + 0x18) >>> 0);
  const g2Rows = sm.u32((pOutdoors + 0x30) >>> 0);
  const g2Cells = sm.u32((pOutdoors + 0x2c) >>> 0);
  const g3Rows = sm.u32((pOutdoors + 0x44) >>> 0);
  const g3Cells = sm.u32((pOutdoors + 0x40) >>> 0);

  let worldY = sm.u32((level + 0x20) >>> 0) | 0;
  for (let y = 0; y < gh; y++) {
    let worldX = sm.u32((level + 0x1c) >>> 0) | 0;
    for (let x = 0; x < gw; x++) {
      const r1 = sm.u32((g1Rows + y * 4) >>> 0) | 0;
      const c1 = sm.u32((g1Cells + ((r1 + x) | 0) * 4) >>> 0) >>> 0;
      const r2 = sm.u32((g2Rows + y * 4) >>> 0) | 0;
      const c2 = sm.u32((g2Cells + ((r2 + x) | 0) * 4) >>> 0) >>> 0;
      if ((c2 & 0x200) !== 0) {
        const r0 = sm.u32((g0Rows + y * 4) >>> 0) | 0;
        const prestId = sm.u32((g0Cells + ((r0 + x) | 0) * 4) >>> 0) | 0;
        if (prestId !== 0) {
          const rectPtr = (OUTDOORS_STACK_BASE + 0x40) >>> 0;
          sm.setU32(rectPtr, worldX >>> 0);
          sm.setU32((rectPtr + 0x04) >>> 0, worldY >>> 0);
          sm.setU32((rectPtr + 0x08) >>> 0, 0);
          sm.setU32((rectPtr + 0x0c) >>> 0, 0);
          const pMap = DRLGPRESET_AllocDrlgMap113c(sm, (level + 0x1c4) >>> 0, level, prestId, rectPtr);
          sm.setU32((pMap + 0x04) >>> 0, (c2 >>> 16) & 0x0f);
          DRLGPRESET_BuildPresetRoomsFromMap113c(sm, level, pMap, c1, 0);
        }
      } else if ((c2 & 0x100) === 0) {
        const r3 = sm.u32((g3Rows + y * 4) >>> 0) | 0;
        const subTheme = sm.u32((g3Cells + ((r3 + x) | 0) * 4) >>> 0) | 0;
        DRLGPRESET_CreatePresetRoomEx113c(sm, c1, level, worldX, worldY, 8, 8, c2, subTheme, roomFlags);
      }
      worldX = (worldX + 8) | 0;
    }
    worldY = (worldY + 8) | 0;
  }
}

/**
 * `D2Common.dll` `0x6FD93350` (internal `__usercall(pLevel@<eax>, nPresetId, nFlags)`).
 */
export function DRLGOUTDOORS_PlaceRandomOutdoorPresetNearSeed113c(
  m: Memory113c,
  pLevel: number,
  nPresetId: number,
  nFlags: number,
): number {
  const level = pLevel >>> 0;
  const pOutdoors = m.u32((level + 0x14) >>> 0);
  const innerW = ((m.u32((pOutdoors + 0x5c) >>> 0) | 0) - 2) | 0;
  const innerH = ((m.u32((pOutdoors + 0x60) >>> 0) | 0) - 2) | 0;
  const total = imul32(innerW, innerH);
  if (total === 0) return 0;

  const coordsX = new Int32Array(total);
  const coordsY = new Int32Array(total);
  for (let i = 0; i < total; i++) {
    coordsX[i] = smod32(i, innerW);
    coordsY[i] = sdiv32(i, innerW);
  }
  for (let i = 0; i < total; i++) {
    const r1 = lcgNextBound113c(m, level, total);
    const r2 = lcgNextBound113c(m, level, total);
    const tx = coordsX[r1]!;
    const ty = coordsY[r1]!;
    coordsX[r1] = coordsX[r2]!;
    coordsY[r1] = coordsY[r2]!;
    coordsX[r2] = tx;
    coordsY[r2] = ty;
  }

  const g2Rows = m.u32((pOutdoors + 0x30) >>> 0);
  const g2Cells = m.u32((pOutdoors + 0x2c) >>> 0);
  for (let i = 0; i < total; i++) {
    const px = (coordsX[i]! + 1) | 0;
    const py = (coordsY[i]! + 1) | 0;
    const r2 = m.u32((g2Rows + py * 4) >>> 0) | 0;
    if ((m.u8((g2Cells + ((r2 + px) | 0) * 4) >>> 0) & 0x80) !== 0) {
      for (let d = 0; d < 8; d++) {
        const nx = (px + OUTDOORS_NEAR_DX_6FDE3474[d]!) | 0;
        const ny = (py + OUTDOORS_NEAR_DY_6FDE346C[d]!) | 0;
        if (DRLGOUTDOORS_SpawnOutdoorRoomEx113c(m, level, nx, ny, nPresetId, 0, 15) !== 0) {
          DRLGOUTDOORS_SpawnPresetInGrid113c(m, level, nx, ny, nPresetId, nFlags, 0);
          return 1;
        }
      }
    }
  }

  return DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, level, nPresetId, nFlags, 0, 15);
}

/**
 * `D2Common.dll` `0x6FD93580` (internal `__usercall(pLevel@<eax>)`).
 */
export function DRLGOUTDOORS_InitOutdoorLevel113c(
  m: Memory113c,
  pLevel: number,
): void {
  const level = pLevel >>> 0;
  const pDrlg = m.u32((level + 0x1b4) >>> 0);
  const pMemPool = m.u32((pDrlg + 0x478) >>> 0);
  const pOutdoors = m.u32((level + 0x14) >>> 0);

  m.setU32((pOutdoors + 0x54) >>> 0, 0);
  m.setU32((pOutdoors + 0x58) >>> 0, 0);
  const gw = sdiv32(m.u32((level + 0x24) >>> 0) | 0, 8);
  const gh = sdiv32(m.u32((level + 0x28) >>> 0) | 0, 8);
  m.setU32((pOutdoors + 0x5c) >>> 0, gw >>> 0);
  m.setU32((pOutdoors + 0x60) >>> 0, gh >>> 0);

  DRLGGRID_AllocAndInitGridCells113c(m, (pOutdoors + 0x04) >>> 0, pMemPool, gw, gh);
  DRLGGRID_AllocAndInitGridCells113c(m, (pOutdoors + 0x18) >>> 0, pMemPool, gw, gh);
  DRLGGRID_AllocAndInitGridCells113c(m, (pOutdoors + 0x2c) >>> 0, pMemPool, gw, gh);
  DRLGGRID_AllocAndInitGridCells113c(m, (pOutdoors + 0x40) >>> 0, pMemPool, gw, gh);

  const nLevelId = m.u32((level + 0x1d0) >>> 0) | 0;
  let actIdx = 0;
  for (let i = 1; i <= 5; i++) {
    if (nLevelId < OUTDOORS_ACT_BOUNDARIES_6FDE4668[i]!) {
      actIdx = (i - 1) & 0xff;
      break;
    }
  }

  DRLGVER_BuildAndLocalizeRoomVertices113c(
    m,
    0,
    (level + 0x1c) >>> 0,
    pMemPool,
    (pOutdoors + 0x64) >>> 0,
    m.u32((pOutdoors + 0x264) >>> 0),
  );
  DRLGOUTDOORS_ScaleAndCompactVertices113c(m, (pOutdoors + 0x64) >>> 0, pMemPool);

  if (nLevelId === 0x86) {
    actIdx = 1;
  }

  if (actIdx === 0) {
    DRLGOUTWILD_InitAct1OutdoorLevel113c(m, level);
  } else if (actIdx === 1) {
    DRLGOUTJUNG_InitAct2OutdoorLevel113c(m, level);
  } else if (actIdx === 2) {
    DRLGOUTPLACE_ApplyOutdoorVerticesToGrids113c(m, level);
    DRLGOUTJUNG_BuildJunglePresets113c(m, level);
    DRLGOUTJUNG_SpawnAct3CityPresetsByLevel113c(m, level);
    DRLGOUTJUNG_SpawnTravincalPresets113c(m, level);
  } else if (actIdx === 3) {
    DRLGOUTJUNG_InitAct4OutdoorLevel113c(m, level);
  } else if (actIdx === 4) {
    DRLGOUTANIM_BuildAct5Outdoors113c(m, level);
  }

  DRLGOUTDOORS_BuildOutdoorRoomExList113c(m, level);
}

