/**
 * Diablo II v1.13c `D2Common.dll` room collision grid bounding-box and subtile mask helpers
 * (`Collision\Collisn.cpp`), image base `0x6FD50000`.
 *
 * Every function below is a 1:1 port of the cited disassembly (`objdump -d -M intel` on `D2Common.dll`).
 */
import { D2RoomCollisionGridStrc } from '../mem/layout.generated.ts';
import type { Memory113c } from '../mem/sparse-memory.ts';
import { FIELD_AllocField113c, FIELD_FreeField113c, FIELD_StepFieldCoords113c } from '../tables/field-tbls-113c.ts';
import {
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetCollisionGridFromRoomFast113c,
  DUNGEON_GetRoomAtPosition113c,
  DUNGEON_GetRoomCoordinates113c,
} from './dungeon.ts';
import { D2CommonAssertError } from './inline-helpers.ts';
import { imul32 } from './int-math.ts';
import {
  PATH_SetPrecisionPosAndRecacheRoom113c,
  PATH_StopMovementAndSnapToTileCenter113c,
} from './path.ts';
import { UNITS_GetUnitSizeX113c } from './unit.ts';

const STACK_SCRATCH_BASE = 0x7fff0000;
const STACK_SCRATCH_SIZE = 0x1000;
const _stackBuf = new ArrayBuffer(STACK_SCRATCH_SIZE);
const _stackU8 = new Uint8Array(_stackBuf);
const _stackDV = new DataView(_stackBuf);

function withStackScratch113c(m: Memory113c): Memory113c {
  if ((m as { __hasStackScratch?: boolean }).__hasStackScratch) {
    return m;
  }
  const isStack = (p: number): boolean => {
    const u = p >>> 0;
    return u >= STACK_SCRATCH_BASE && u < STACK_SCRATCH_BASE + STACK_SCRATCH_SIZE;
  };
  const wrapped: Memory113c & { __hasStackScratch: boolean; free?: (p: number) => void } = {
    __hasStackScratch: true,
    alloc: size => m.alloc(size),
    free: p => (m as { free?: (addr: number) => void }).free?.(p),
    u8: p => (isStack(p) ? _stackU8[(p >>> 0) - STACK_SCRATCH_BASE]! : m.u8(p)),
    u16: p => (isStack(p) ? _stackDV.getUint16((p >>> 0) - STACK_SCRATCH_BASE, true) : m.u16(p)),
    u32: p => (isStack(p) ? _stackDV.getUint32((p >>> 0) - STACK_SCRATCH_BASE, true) : m.u32(p)),
    setU8: (p, v) => {
      if (isStack(p)) _stackU8[(p >>> 0) - STACK_SCRATCH_BASE] = v & 0xff;
      else m.setU8(p, v);
    },
    setU16: (p, v) => {
      if (isStack(p)) _stackDV.setUint16((p >>> 0) - STACK_SCRATCH_BASE, v & 0xffff, true);
      else m.setU16(p, v);
    },
    setU32: (p, v) => {
      if (isStack(p)) _stackDV.setUint32((p >>> 0) - STACK_SCRATCH_BASE, v >>> 0, true);
      else m.setU32(p, v);
    },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      const addr = (base + f.off + idx * width) >>> 0;
      if (isStack(addr)) {
        return width === 1 ? wrapped.u8(addr) : width === 2 ? wrapped.u16(addr) : wrapped.u32(addr);
      }
      return m.get(base, f, idx);
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      const addr = (base + f.off + idx * width) >>> 0;
      if (isStack(addr)) {
        if (width === 1) wrapped.setU8(addr, v);
        else if (width === 2) wrapped.setU16(addr, v);
        else wrapped.setU32(addr, v);
      } else {
        m.set(base, f, v, idx);
      }
    },
    fill: (p, len, v) => {
      if (isStack(p)) {
        _stackU8.fill(v & 0xff, (p >>> 0) - STACK_SCRATCH_BASE, (p >>> 0) - STACK_SCRATCH_BASE + len);
      } else {
        m.fill(p, len, v);
      }
    },
  };
  return wrapped;
}

/**
 * `@va D2Common:0x6FD9AB60` (`COLLISION_SetMaskForBoundingBox113c`, custom `eax = pCollGrid`, `edx = pBox`, `[esp+4] = wMask`, `ret 4`).
 *
 * Translates `pBox` (`[nMinX, nMinY, nMaxX, nMaxY]`) by `(pCollGrid->nSubtileX, pCollGrid->nSubtileY)` (`+0x00`, `+0x04`)
 * and ORs `(uint16)wMask` into every subtile cell of `pCollGrid->pMapStart (+0x20)` (stride `pCollGrid->nSubtileWidth` at `+0x08`)
 * across `[rMinY .. rMaxY] x [rMinX .. rMaxX]`.
 */
export function COLLISION_SetMaskForBoundingBox113c(
  m: Memory113c,
  pCollGrid: number,
  pBox: number,
  wMask: number,
): void {
  const box = pBox >>> 0;
  const gridX = m.get(pCollGrid, D2RoomCollisionGridStrc.nSubtileX) | 0;
  const gridY = m.get(pCollGrid, D2RoomCollisionGridStrc.nSubtileY) | 0;
  const rMinX = ((m.u32(box) | 0) - gridX) | 0;
  const rMinY = ((m.u32((box + 4) >>> 0) | 0) - gridY) | 0;
  const rMaxX = ((m.u32((box + 8) >>> 0) | 0) - gridX) | 0;
  const rMaxY = ((m.u32((box + 0x0c) >>> 0) | 0) - gridY) | 0;
  if (rMinY > rMaxY) return;

  const stride = m.get(pCollGrid, D2RoomCollisionGridStrc.nSubtileWidth) | 0;
  const pMapStart = m.get(pCollGrid, D2RoomCollisionGridStrc.pMapStart);
  const mask16 = wMask & 0xffff;

  for (let y = rMinY; y <= rMaxY; y++) {
    if (rMinX <= rMaxX) {
      const rowBase = imul32(stride, y);
      for (let x = rMinX; x <= rMaxX; x++) {
        const pCell = (pMapStart + (((rowBase + x) | 0) << 1)) >>> 0;
        m.setU16(pCell, (m.u16(pCell) | mask16) & 0xffff);
      }
    }
  }
}

/**
 * `@va D2Common:0x6FD9ABD0` (`COLLISION_ClearMaskForBoundingBox113c`, custom `eax = pCollGrid`, `edx = pBox`, `[esp+4] = wMask`, `ret 4`).
 *
 * Translates `pBox` (`[nMinX, nMinY, nMaxX, nMaxY]`) by `(pCollGrid->nSubtileX, pCollGrid->nSubtileY)` (`+0x00`, `+0x04`)
 * and ANDs `~(uint16)wMask` into every subtile cell of `pCollGrid->pMapStart (+0x20)` across `[rMinY .. rMaxY] x [rMinX .. rMaxX]`.
 */
export function COLLISION_ClearMaskForBoundingBox113c(
  m: Memory113c,
  pCollGrid: number,
  pBox: number,
  wMask: number,
): void {
  const box = pBox >>> 0;
  const gridX = m.get(pCollGrid, D2RoomCollisionGridStrc.nSubtileX) | 0;
  const gridY = m.get(pCollGrid, D2RoomCollisionGridStrc.nSubtileY) | 0;
  const rMinX = ((m.u32(box) | 0) - gridX) | 0;
  const rMinY = ((m.u32((box + 4) >>> 0) | 0) - gridY) | 0;
  const rMaxX = ((m.u32((box + 8) >>> 0) | 0) - gridX) | 0;
  const rMaxY = ((m.u32((box + 0x0c) >>> 0) | 0) - gridY) | 0;
  if (rMinY > rMaxY) return;

  const stride = m.get(pCollGrid, D2RoomCollisionGridStrc.nSubtileWidth) | 0;
  const pMapStart = m.get(pCollGrid, D2RoomCollisionGridStrc.pMapStart);
  const notMask16 = ~wMask & 0xffff;

  for (let y = rMinY; y <= rMaxY; y++) {
    if (rMinX <= rMaxX) {
      const rowBase = imul32(stride, y);
      for (let x = rMinX; x <= rMaxX; x++) {
        const pCell = (pMapStart + (((rowBase + x) | 0) << 1)) >>> 0;
        m.setU16(pCell, m.u16(pCell) & notMask16);
      }
    }
  }
}

/**
 * `@va D2Common:0x6FD9AC40` (`COLLISION_CheckMaskForBoundingBox113c`, custom `ecx = pCollGrid`, `eax = pBox`, `[esp+4] = wMask`, `ret 4`).
 *
 * Accumulates `(cell & wMask)` via bitwise OR across all subtile cells of `pCollGrid->pMapStart (+0x20)`
 * in `[rMinY .. rMaxY] x [rMinX .. rMaxX]` and returns the resulting `uint16` mask.
 */
export function COLLISION_CheckMaskForBoundingBox113c(
  m: Memory113c,
  pCollGrid: number,
  pBox: number,
  wMask: number,
): number {
  const box = pBox >>> 0;
  const gridX = m.get(pCollGrid, D2RoomCollisionGridStrc.nSubtileX) | 0;
  const gridY = m.get(pCollGrid, D2RoomCollisionGridStrc.nSubtileY) | 0;
  const rMinX = ((m.u32(box) | 0) - gridX) | 0;
  const rMinY = ((m.u32((box + 4) >>> 0) | 0) - gridY) | 0;
  const rMaxX = ((m.u32((box + 8) >>> 0) | 0) - gridX) | 0;
  const rMaxY = ((m.u32((box + 0x0c) >>> 0) | 0) - gridY) | 0;
  if (rMinY > rMaxY) return 0;

  const stride = m.get(pCollGrid, D2RoomCollisionGridStrc.nSubtileWidth) | 0;
  const pMapStart = m.get(pCollGrid, D2RoomCollisionGridStrc.pMapStart);
  const mask32 = wMask >>> 0;
  let acc = 0;

  for (let y = rMinY; y <= rMaxY; y++) {
    if (rMinX <= rMaxX) {
      const rowBase = imul32(stride, y);
      for (let x = rMinX; x <= rMaxX; x++) {
        const pCell = (pMapStart + (((rowBase + x) | 0) << 1)) >>> 0;
        acc = (acc | (m.u16(pCell) & mask32)) >>> 0;
      }
    }
  }
  return acc >>> 0;
}

/**
 * `@va D2Common:0x6FD9B560` (`COLLISION_FillTileSubtilesMask113c`, custom `ecx = nSubX`, `eax = nSubY`,
 * `[esp+4] = pCollGrid`, `[esp+8] = wMask`, `ret 8`).
 *
 * Clamps the 5x5 subtile region `[nSubX, nSubX + 5) x [nSubY, nSubY + 5)` against `0` on the low side
 * (`startX = max(0, nSubX)`, `startY = max(0, nSubY)`, `endX = nSubX + 5`, `endY = nSubY + 5`) and ORs
 * `(uint16)wMask` into `pCollGrid->pMapStart[y * nSubtileWidth + x]`.
 */
export function COLLISION_FillTileSubtilesMask113c(
  m: Memory113c,
  nSubX: number,
  nSubY: number,
  pCollGrid: number,
  wMask: number,
): void {
  const grid = pCollGrid >>> 0;
  if (grid === 0) return;
  const pMapStart = m.get(grid, D2RoomCollisionGridStrc.pMapStart);
  if (pMapStart === 0) return;

  const subX = nSubX | 0;
  const subY = nSubY | 0;
  const startY = subY <= 0 ? 0 : subY;
  const endY = (subY + 5) | 0;
  const startX = subX <= 0 ? 0 : subX;
  const endX = (subX + 5) | 0;
  if (startY >= endY) return;

  const stride = m.get(grid, D2RoomCollisionGridStrc.nSubtileWidth) | 0;
  const mask16 = wMask & 0xffff;

  for (let y = startY; y < endY; y++) {
    if (startX < endX) {
      const curMapStart = m.get(grid, D2RoomCollisionGridStrc.pMapStart);
      const rowByteOff = (imul32(y, stride) << 1) | 0;
      const pRow = (curMapStart + rowByteOff) >>> 0;
      for (let x = startX; x < endX; x++) {
        const pCell = (pRow + (x << 1)) >>> 0;
        m.setU16(pCell, (m.u16(pCell) | mask16) & 0xffff);
      }
    }
  }
}

/**
 * `@va D2Common:0x6FD9AA90` (`COLLISION_SplitClipRectByRoomBounds113c`, custom `eax = pRoom`, `edx = pInRect`, `ecx = pOutRects`, `ret`).
 *
 * Splits `pInRect` (`[nLeft, nTop, nRight, nBottom]`) against `pRoom->pCollisionGrid (+0x20)` right/bottom bounds
 * into up to 3 sub-rectangles at `pOutRects[0..2]` (stride `0x10`) and returns the resulting count (`0..3`).
 */
export function COLLISION_SplitClipRectByRoomBounds113c(
  m: Memory113c,
  pRoom: number,
  pInRect: number,
  pOutRects: number,
): number {
  const inRect = pInRect >>> 0;
  const outRects = pOutRects >>> 0;
  const inTop = m.u32((inRect + 0x04) >>> 0) | 0;
  const inBottom = m.u32((inRect + 0x0c) >>> 0) | 0;
  if (inTop > inBottom) {
    return 0;
  }
  const inLeft = m.u32(inRect) | 0;
  const inRight = m.u32((inRect + 0x08) >>> 0) | 0;
  if (inLeft > inRight) {
    return 0;
  }
  if (pRoom === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\RoomTile.cpp', 709);
  }
  const pCollGrid = m.u32(((pRoom >>> 0) + 0x20) >>> 0);
  if (pCollGrid === 0) {
    return 0;
  }

  m.setU32((outRects + 0x04) >>> 0, inTop >>> 0);
  m.setU32((outRects + 0x0c) >>> 0, inBottom >>> 0);
  m.setU32(outRects, inLeft >>> 0);
  m.setU32((outRects + 0x08) >>> 0, inRight >>> 0);

  const nRoomRight =
    ((m.u32(pCollGrid) | 0) + (m.u32((pCollGrid + 0x08) >>> 0) | 0)) | 0;
  let nCount = 1;
  if (inRight >= nRoomRight) {
    m.setU32((outRects + 0x08) >>> 0, ((nRoomRight - 1) | 0) >>> 0);
    m.setU32((outRects + 0x10) >>> 0, nRoomRight >>> 0);
    m.setU32((outRects + 0x18) >>> 0, m.u32((inRect + 0x08) >>> 0));
    m.setU32((outRects + 0x14) >>> 0, m.u32((outRects + 0x04) >>> 0));
    m.setU32((outRects + 0x1c) >>> 0, m.u32((outRects + 0x0c) >>> 0));
    nCount = 2;
  }

  const nRoomBottom =
    ((m.u32((pCollGrid + 0x04) >>> 0) | 0) + (m.u32((pCollGrid + 0x0c) >>> 0) | 0)) | 0;
  if (inBottom >= nRoomBottom) {
    m.setU32((outRects + 0x0c) >>> 0, ((nRoomBottom - 1) | 0) >>> 0);
    const pSlot = (outRects + (nCount << 4)) >>> 0;
    m.setU32(pSlot, m.u32(outRects));
    m.setU32((pSlot + 0x08) >>> 0, m.u32((outRects + 0x08) >>> 0));
    m.setU32((pSlot + 0x04) >>> 0, ((m.u32((outRects + 0x0c) >>> 0) | 0) + 1) >>> 0);
    m.setU32((pSlot + 0x0c) >>> 0, m.u32((inRect + 0x0c) >>> 0));
    nCount = (nCount + 1) | 0;
  }

  return nCount >>> 0;
}

/**
 * `@va D2CMP:0x6FE251E0` (`D2CMP.#10011` via `D2Common` thunk `0x6FD59318`, `__stdcall(pTileLibraryEntry)`, `ret 4`).
 *
 * Asserts `pTileLibraryEntry != 0` (line 129) and returns `pTileLibraryEntry + 0x28` (`uint8[25]` subtile flags).
 */
export function D2CMP_10011_GetTileSubtileFlagsPtr113c(
  _m: Memory113c,
  pTileLibraryEntry: number,
): number {
  if (pTileLibraryEntry === 0) {
    throw new Error('D2CMP_10011_GetTileSubtileFlagsPtr113c: pTileLibraryEntry == NULL (line 129)');
  }
  return ((pTileLibraryEntry >>> 0) + 0x28) >>> 0;
}

/**
 * `@va D2Common:0x6FD9B5F0` (`COLLISION_CopyTileSubtileFlagsToCollGrid113c`, custom `eax = nRelY`, `ecx = nRelX`,
 * `[esp+4] = pCollGrid`, `[esp+8] = pTileLibraryEntry`, `ret 8`).
 *
 * Copies the 5x5 subtile collision flags from `D2CMP.#10011(pTileLibraryEntry)` into `pCollGrid->pMapStart (+0x20)`,
 * reversing row order (`flagRow = 4 - (y - nRelY)`) and clipping low coordinates at `0`.
 */
export function COLLISION_CopyTileSubtileFlagsToCollGrid113c(
  m: Memory113c,
  nRelY: number,
  nRelX: number,
  pCollGrid: number,
  pTileLibraryEntry: number,
): void {
  const grid = pCollGrid >>> 0;
  if (grid === 0) return;
  const pMapStart = m.get(grid, D2RoomCollisionGridStrc.pMapStart);
  if (pMapStart === 0) return;

  const pSubtileFlags = D2CMP_10011_GetTileSubtileFlagsPtr113c(m, pTileLibraryEntry);
  const relY = nRelY | 0;
  const relX = nRelX | 0;
  const startY = relY <= 0 ? 0 : relY;
  const endY = (relY + 5) | 0;
  const startX = relX <= 0 ? 0 : relX;
  const endX = (relX + 5) | 0;

  const nStride = m.get(grid, D2RoomCollisionGridStrc.nSubtileWidth) | 0;
  if (startY >= endY) return;

  let flagRowPtr = (pSubtileFlags + imul32((relY - startY + 4) | 0, 5) - relX) >>> 0;
  let rowByteOffset = (imul32(startY, nStride) << 1) | 0;
  const rowByteStep = (nStride << 1) | 0;
  let remRows = (endY - startY) | 0;

  while (remRows !== 0) {
    if (startX < endX) {
      const pCurMapStart = m.get(grid, D2RoomCollisionGridStrc.pMapStart);
      const pRowDest = (pCurMapStart + rowByteOffset) >>> 0;
      for (let x = startX; x < endX; x++) {
        const flag = m.u8((flagRowPtr + x) >>> 0);
        m.setU16((pRowDest + (x << 1)) >>> 0, flag);
      }
    }
    flagRowPtr = (flagRowPtr - 5) >>> 0;
    rowByteOffset = (rowByteOffset + rowByteStep) | 0;
    remRows = (remRows - 1) | 0;
  }
}

/**
 * `@va D2Common:0x6FD9B6B0` (`COLLISION_ClearTileSubtileFlagsFromCollGrid113c`, custom `eax = nRelY`, `ecx = nRelX`,
 * `[esp+4] = pCollGrid`, `[esp+8] = pTileLibraryEntry`, `ret 8`).
 *
 * Clears (`&= ~flag`) the 5x5 subtile collision flags from `D2CMP.#10011(pTileLibraryEntry)` in `pCollGrid->pMapStart (+0x20)`.
 */
export function COLLISION_ClearTileSubtileFlagsFromCollGrid113c(
  m: Memory113c,
  nRelY: number,
  nRelX: number,
  pCollGrid: number,
  pTileLibraryEntry: number,
): void {
  const grid = pCollGrid >>> 0;
  if (grid === 0) return;
  const pMapStart = m.get(grid, D2RoomCollisionGridStrc.pMapStart);
  if (pMapStart === 0) return;

  const pSubtileFlags = D2CMP_10011_GetTileSubtileFlagsPtr113c(m, pTileLibraryEntry);
  const relY = nRelY | 0;
  const relX = nRelX | 0;
  const startY = relY <= 0 ? 0 : relY;
  const endY = (relY + 5) | 0;
  const startX = relX <= 0 ? 0 : relX;
  const endX = (relX + 5) | 0;

  const nStride = m.get(grid, D2RoomCollisionGridStrc.nSubtileWidth) | 0;
  if (startY >= endY) return;

  let flagRowPtr = (pSubtileFlags + imul32((relY - startY + 4) | 0, 5) - relX) >>> 0;
  let rowByteOffset = (imul32(startY, nStride) << 1) | 0;
  const rowByteStep = (nStride << 1) | 0;
  let remRows = (endY - startY) | 0;

  while (remRows !== 0) {
    if (startX < endX) {
      const pCurMapStart = m.get(grid, D2RoomCollisionGridStrc.pMapStart);
      const pRowDest = (pCurMapStart + rowByteOffset) >>> 0;
      for (let x = startX; x < endX; x++) {
        const flag = m.u8((flagRowPtr + x) >>> 0);
        const addr = (pRowDest + (x << 1)) >>> 0;
        m.setU16(addr, m.u16(addr) & (~flag & 0xffff));
      }
    }
    flagRowPtr = (flagRowPtr - 5) >>> 0;
    rowByteOffset = (rowByteOffset + rowByteStep) | 0;
    remRows = (remRows - 1) | 0;
  }
}

/**
 * `@va D2Common:0x6FD9B780` (`COLLISION_OrTileSubtileFlagsToCollGrid113c`, custom `eax = nRelY`, `ecx = nRelX`,
 * `[esp+4] = pCollGrid`, `[esp+8] = pTileLibraryEntry`, `ret 8`).
 *
 * ORs (`|= flag`) the 5x5 subtile collision flags from `D2CMP.#10011(pTileLibraryEntry)` into `pCollGrid->pMapStart (+0x20)`.
 */
export function COLLISION_OrTileSubtileFlagsToCollGrid113c(
  m: Memory113c,
  nRelY: number,
  nRelX: number,
  pCollGrid: number,
  pTileLibraryEntry: number,
): void {
  const grid = pCollGrid >>> 0;
  if (grid === 0) return;
  const pMapStart = m.get(grid, D2RoomCollisionGridStrc.pMapStart);
  if (pMapStart === 0) return;

  const pSubtileFlags = D2CMP_10011_GetTileSubtileFlagsPtr113c(m, pTileLibraryEntry);
  const relY = nRelY | 0;
  const relX = nRelX | 0;
  const startY = relY <= 0 ? 0 : relY;
  const endY = (relY + 5) | 0;
  const startX = relX <= 0 ? 0 : relX;
  const endX = (relX + 5) | 0;

  const nStride = m.get(grid, D2RoomCollisionGridStrc.nSubtileWidth) | 0;
  if (startY >= endY) return;

  let flagRowPtr = (pSubtileFlags + imul32((relY - startY + 4) | 0, 5) - relX) >>> 0;
  let rowByteOffset = (imul32(startY, nStride) << 1) | 0;
  const rowByteStep = (nStride << 1) | 0;
  let remRows = (endY - startY) | 0;

  while (remRows !== 0) {
    if (startX < endX) {
      const pCurMapStart = m.get(grid, D2RoomCollisionGridStrc.pMapStart);
      const pRowDest = (pCurMapStart + rowByteOffset) >>> 0;
      for (let x = startX; x < endX; x++) {
        const flag = m.u8((flagRowPtr + x) >>> 0);
        const addr = (pRowDest + (x << 1)) >>> 0;
        m.setU16(addr, (m.u16(addr) | flag) & 0xffff);
      }
    }
    flagRowPtr = (flagRowPtr - 5) >>> 0;
    rowByteOffset = (rowByteOffset + rowByteStep) | 0;
    remRows = (remRows - 1) | 0;
  }
}

/**
 * `@va D2Common:0x6FDCE390` (`D2Common.#10638` `COLLISION_InitBoundingBox113c`, `__stdcall(pBox, nLeft, nBottom)`, `ret 0xC`).
 *
 * Asserts `pBox != 0` (line 161) and writes `pBox->nLeft = nLeft`, `pBox->nBottom = nBottom`.
 */
export function COLLISION_InitBoundingBox113c(
  m: Memory113c,
  pBox: number,
  nLeft: number,
  nBottom: number,
): void {
  if (pBox === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DATATBLS\\FieldTbls.cpp', 161);
  }
  const box = pBox >>> 0;
  m.setU32(box, nLeft >>> 0);
  m.setU32((box + 0x04) >>> 0, nBottom >>> 0);
}

/**
 * `@va D2Common:0x6FD9CA90` (`COLLISION_StampRoomTileGridToCollGrid113c`, custom `ecx = pTileEntryArray`, `esi = pCollGrid`,
 * `[esp+4] = pRoomCoords`, `[esp+8] = nTileCount`, `[esp+0xC] = bCopyMode`, `ret 0xC`).
 *
 * Iterates `nTileCount` `D2DrlgTileDataStrc` records (stride `0x30`) in `pTileEntryArray`; for each tile whose subtile origin
 * `((nPosX + pRoomCoords->nTileXPos) * 5, (nPosY + pRoomCoords->nTileYPos) * 5)` lies inside `pCollGrid`, copies (`bCopyMode != 0`)
 * or ORs (`bCopyMode == 0`) the tile's 5x5 subtile flags into `pCollGrid`, and fills extra mask bits (`0x10`, `0x01`, `0x04`)
 * via `0x6FD9B560` (`COLLISION_FillTileSubtilesMask113c`) when `dwFlags` has `0x02`, `0x40`, or `0x80` set.
 */
export function COLLISION_StampRoomTileGridToCollGrid113c(
  m: Memory113c,
  pTileEntryArray: number,
  pCollGrid: number,
  pRoomCoords: number,
  nTileCount: number,
  bCopyMode: number,
): void {
  const count = nTileCount | 0;
  if (count <= 0) {
    return;
  }
  let pTile = pTileEntryArray >>> 0;
  const coords = pRoomCoords >>> 0;
  const grid = pCollGrid >>> 0;

  for (let i = 0; i < count; i++) {
    const tileX = ((m.u32((pTile + 0x08) >>> 0) | 0) + (m.u32((coords + 0x10) >>> 0) | 0)) | 0;
    const subtileX = imul32(tileX, 5);
    const tileY = ((m.u32((pTile + 0x0c) >>> 0) | 0) + (m.u32((coords + 0x14) >>> 0) | 0)) | 0;
    const subtileY = imul32(tileY, 5);

    if (grid === 0) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\COLLISN\\Collisn.cpp', 530);
    }

    const posX = m.get(grid, D2RoomCollisionGridStrc.nSubtileX) | 0;
    if (subtileX >= posX) {
      const sizeX = m.get(grid, D2RoomCollisionGridStrc.nSubtileWidth) | 0;
      if (subtileX < ((posX + sizeX) | 0)) {
        const posY = m.get(grid, D2RoomCollisionGridStrc.nSubtileY) | 0;
        if (subtileY >= posY) {
          const sizeY = m.get(grid, D2RoomCollisionGridStrc.nSubtileHeight) | 0;
          if (subtileY < ((posY + sizeY) | 0)) {
            const relY = (subtileY - posY) | 0;
            const relX = (subtileX - posX) | 0;
            const pTileLibEntry = m.u32((pTile + 0x18) >>> 0);

            if ((bCopyMode | 0) !== 0) {
              COLLISION_CopyTileSubtileFlagsToCollGrid113c(
                m,
                relY,
                relX,
                grid,
                pTileLibEntry,
              );
            } else {
              COLLISION_OrTileSubtileFlagsToCollGrid113c(
                m,
                relY,
                relX,
                grid,
                pTileLibEntry,
              );
            }

            const dwFlags = m.u32((pTile + 0x14) >>> 0) & 0xff;
            let nExtraMask = 0;
            if ((dwFlags & 0x02) !== 0) {
              nExtraMask = 0x10;
            }
            if ((dwFlags & 0x40) !== 0) {
              nExtraMask |= 0x01;
            }
            if ((dwFlags & 0x80) !== 0) {
              nExtraMask |= 0x04;
            }
            if (nExtraMask !== 0) {
              COLLISION_FillTileSubtilesMask113c(m, relX, relY, grid, nExtraMask);
            }
          }
        }
      }
    }

    pTile = (pTile + 0x30) >>> 0;
  }
}

/**
 * `@va D2Common:0x6FD9AD20` (`COLLISION_RayTrace113c`,
 * `__stdcall(pRoom, pPt1, pPt2, dwMask) -> BOOL`, `ret 0x10`).
 */
export function COLLISION_RayTrace113c(
  m: Memory113c,
  pRoom: number,
  pPt1: number,
  pPt2: number,
  dwMask: number,
): number {
  const pt1 = pPt1 >>> 0;
  const pt2 = pPt2 >>> 0;
  const y1 = m.u32((pt1 + 0x04) >>> 0) | 0;
  let ebx = m.u32(pt1) | 0;
  const x2 = m.u32(pt2) | 0;
  const y2 = m.u32((pt2 + 0x04) >>> 0) | 0;
  let esi = pRoom >>> 0;
  let curY = y1;
  let dx = (x2 - ebx) | 0;
  let dy = (y2 - y1) | 0;
  let stepX = 1;
  let stepY = 1;

  const hitOrStop = (): number => {
    m.setU32(pt2, ebx >>> 0);
    m.setU32((pt2 + 0x04) >>> 0, curY >>> 0);
    return 1;
  };

  if (esi === 0) {
    return hitOrStop();
  }
  if (dx < 0) {
    dx = -dx | 0;
    stepX = -1;
  }
  if (dy < 0) {
    dy = -dy | 0;
    stepY = -1;
  }

  let rW = m.u32((esi + 0x54) >>> 0) | 0;
  let edi = m.u32((esi + 0x4c) >>> 0) | 0;
  let ebp = m.u32((esi + 0x50) >>> 0) | 0;
  let rMaxX = (rW + edi) | 0;
  let rMaxY = ((m.u32((esi + 0x58) >>> 0) | 0) + ebp) | 0;

  if (ebx < edi || ebx >= rMaxX || curY < ebp || curY >= rMaxY) {
    esi = DUNGEON_GetRoomAtPosition113c(m, esi, ebx, curY);
    if (esi === 0) return hitOrStop();
    rW = m.u32((esi + 0x54) >>> 0) | 0;
    edi = m.u32((esi + 0x4c) >>> 0) | 0;
    ebp = m.u32((esi + 0x50) >>> 0) | 0;
    rMaxX = (edi + rW) | 0;
    rMaxY = ((m.u32((esi + 0x58) >>> 0) | 0) + ebp) | 0;
    if (ebx < edi || ebx >= rMaxX || curY < ebp || curY >= rMaxY) {
      return hitOrStop();
    }
  }

  const mask16 = dwMask & 0xffff;

  if (dx === 0) {
    if (dy === 0) {
      const pGrid = DUNGEON_GetCollisionGridFromRoomFast113c(m, esi);
      const pMap = m.u32((pGrid + 0x20) >>> 0);
      const stride = m.u32((pGrid + 0x08) >>> 0) | 0;
      const idx = (imul32((curY - ebp) | 0, stride) - edi + ebx) | 0;
      const cell = m.u16((pMap + (idx << 1)) >>> 0);
      if ((cell & mask16) !== 0) {
        return hitOrStop();
      }
      return 0;
    }

    let remY = (dy + 1) | 0;
    for (;;) {
      let nextRemY = 0;
      let countY = remY;
      if (stepY > 0) {
        if (y2 >= rMaxY) {
          const span = (rMaxY - curY) | 0;
          nextRemY = (remY - span) | 0;
          countY = span;
        }
      } else {
        if (y2 < ebp) {
          const span = ((curY - ebp + 1) | 0);
          nextRemY = (remY - span) | 0;
          countY = span;
        }
      }

      const pGrid = m.u32((esi + 0x20) >>> 0);
      const stride = m.u32((pGrid + 0x08) >>> 0) | 0;
      const pMap = m.u32((pGrid + 0x20) >>> 0);
      const stepElem = imul32( rW, stepY );
      let pCell = (pMap + (((imul32((curY - ebp) | 0, stride) - edi + ebx) | 0) << 1)) >>> 0;
      const pEnd = (pCell + (imul32(stepElem, countY) << 1)) >>> 0;

      while (pCell !== pEnd) {
        if ((m.u16(pCell) & mask16) !== 0) {
          return hitOrStop();
        }
        pCell = (pCell + (stepElem << 1)) >>> 0;
        curY = (curY + stepY) | 0;
      }

      if (nextRemY === 0) {
        return 0;
      }

      esi = DUNGEON_GetRoomAtPosition113c(m, esi, ebx, curY);
      if (esi === 0) return hitOrStop();
      ebp = m.u32((esi + 0x50) >>> 0) | 0;
      rMaxY = ((m.u32((esi + 0x58) >>> 0) | 0) + ebp) | 0;
      edi = m.u32((esi + 0x4c) >>> 0) | 0;
      if (ebx < edi) return hitOrStop();
      rW = m.u32((esi + 0x54) >>> 0) | 0;
      rMaxX = (rW + edi) | 0;
      if (ebx >= rMaxX || curY < ebp || curY >= rMaxY) {
        return hitOrStop();
      }
      remY = nextRemY;
    }
  }

  if (dy === 0) {
    let remX = (dx + 1) | 0;
    for (;;) {
      let nextRemX = 0;
      let countX = remX;
      if (stepX > 0) {
        if (x2 >= rMaxX) {
          const span = (rMaxX - ebx) | 0;
          nextRemX = (remX - span) | 0;
          countX = span;
        }
      } else {
        if (x2 < edi) {
          const span = ((ebx - edi + 1) | 0);
          nextRemX = (remX - span) | 0;
          countX = span;
        }
      }

      const pGrid = m.u32((esi + 0x20) >>> 0);
      const stride = m.u32((pGrid + 0x08) >>> 0) | 0;
      const pMap = m.u32((pGrid + 0x20) >>> 0);
      let pCell = (pMap + (((imul32((curY - ebp) | 0, stride) - edi + ebx) | 0) << 1)) >>> 0;
      const pEnd = (pCell + (imul32(stepX, countX) << 1)) >>> 0;

      while (pCell !== pEnd) {
        if ((m.u16(pCell) & mask16) !== 0) {
          return hitOrStop();
        }
        pCell = (pCell + (stepX << 1)) >>> 0;
        ebx = (ebx + stepX) | 0;
      }

      if (nextRemX === 0) {
        return 0;
      }

      esi = DUNGEON_GetRoomAtPosition113c(m, esi, ebx, curY);
      if (esi === 0) return hitOrStop();
      edi = m.u32((esi + 0x4c) >>> 0) | 0;
      rW = m.u32((esi + 0x54) >>> 0) | 0;
      ebp = m.u32((esi + 0x50) >>> 0) | 0;
      rMaxX = (rW + edi) | 0;
      rMaxY = ((m.u32((esi + 0x58) >>> 0) | 0) + ebp) | 0;
      if (ebx < edi || ebx >= rMaxX || curY < ebp || curY >= rMaxY) {
        return hitOrStop();
      }
      remX = nextRemX;
    }
  }

  let acc = 0;
  if (dx >= dy) {
    const endX = (x2 + stepX) | 0;
    for (;;) {
      const boundX = stepX < 0 ? (edi - 1) | 0 : rMaxX;
      const boundY = stepY < 0 ? (ebp - 1) | 0 : rMaxY;
      if (curY >= rMaxY) {
        return hitOrStop();
      }
      const pGrid = DUNGEON_GetCollisionGridFromRoomFast113c(m, esi);
      const pMap = m.u32((pGrid + 0x20) >>> 0);
      const stride = m.u32((pGrid + 0x08) >>> 0) | 0;
      let pCell = (pMap + (((imul32((curY - ebp) | 0, stride) - edi + ebx) | 0) << 1)) >>> 0;
      const rowStep = imul32(m.u32((esi + 0x54) >>> 0) | 0, stepY);

      for (;;) {
        if ((m.u16(pCell) & mask16) !== 0) {
          return hitOrStop();
        }
        acc = (acc + dy) | 0;
        ebx = (ebx + stepX) | 0;
        if (acc >= dx) {
          acc = (acc - dx) | 0;
          curY = (curY + stepY) | 0;
          pCell = (pCell + (rowStep << 1)) >>> 0;
        }
        pCell = (pCell + (stepX << 1)) >>> 0;
        if (ebx === boundX || curY === boundY) {
          break;
        }
        if (ebx === endX) {
          return 0;
        }
      }

      if (ebx === endX) {
        return 0;
      }
      esi = DUNGEON_GetRoomAtPosition113c(m, esi, ebx, curY);
      if (esi === 0) return hitOrStop();
      edi = m.u32((esi + 0x4c) >>> 0) | 0;
      ebp = m.u32((esi + 0x50) >>> 0) | 0;
      rW = m.u32((esi + 0x54) >>> 0) | 0;
      rMaxX = (rW + edi) | 0;
      rMaxY = ((m.u32((esi + 0x58) >>> 0) | 0) + ebp) | 0;
      if (ebx < edi || ebx >= rMaxX || curY < ebp || curY >= rMaxY) {
        return hitOrStop();
      }
    }
  } else {
    const endY = (y2 + stepY) | 0;
    for (;;) {
      const boundX = stepX < 0 ? (edi - 1) | 0 : rMaxX;
      const boundY = stepY < 0 ? (ebp - 1) | 0 : rMaxY;
      if (curY >= rMaxY) {
        return hitOrStop();
      }
      const pGrid = DUNGEON_GetCollisionGridFromRoomFast113c(m, esi);
      const pMap = m.u32((pGrid + 0x20) >>> 0);
      const stride = m.u32((pGrid + 0x08) >>> 0) | 0;
      let pCell = (pMap + (((imul32((curY - ebp) | 0, stride) - edi + ebx) | 0) << 1)) >>> 0;
      const rowStep = imul32(m.u32((esi + 0x54) >>> 0) | 0, stepY);

      for (;;) {
        if ((m.u16(pCell) & mask16) !== 0) {
          return hitOrStop();
        }
        curY = (curY + stepY) | 0;
        acc = (acc + dx) | 0;
        if (acc >= dy) {
          acc = (acc - dy) | 0;
          ebx = (ebx + stepX) | 0;
          pCell = (pCell + (stepX << 1)) >>> 0;
        }
        pCell = (pCell + (rowStep << 1)) >>> 0;
        if (ebx === boundX || curY === boundY) {
          break;
        }
        if (curY === endY) {
          return 0;
        }
      }

      if (curY === endY) {
        return 0;
      }
      esi = DUNGEON_GetRoomAtPosition113c(m, esi, ebx, curY);
      if (esi === 0) return hitOrStop();
      edi = m.u32((esi + 0x4c) >>> 0) | 0;
      ebp = m.u32((esi + 0x50) >>> 0) | 0;
      rW = m.u32((esi + 0x54) >>> 0) | 0;
      rMaxX = (rW + edi) | 0;
      rMaxY = ((m.u32((esi + 0x58) >>> 0) | 0) + ebp) | 0;
      if (ebx < edi || ebx >= rMaxX || curY < ebp || curY >= rMaxY) {
        return hitOrStop();
      }
    }
  }
}

/**
 * `@va D2Common:0x6FD9B280` (`COLLISION_SetMaskForBoundingBoxRecursively113c`,
 * `__fastcall(ecx=pRoom, edx=pClipRect, [esp+4]=wMask)`, `ret 4`).
 */
export function COLLISION_SetMaskForBoundingBoxRecursively113c(
  m: Memory113c,
  pRoom: number,
  pClipRect: number,
  wMask: number,
  depth = 0,
): void {
  const sm = withStackScratch113c(m);
  const rect = pClipRect >>> 0;
  const edi = DUNGEON_GetRoomAtPosition113c(sm, pRoom, sm.u32(rect) | 0, sm.u32((rect + 0x04) >>> 0) | 0);
  if (edi === 0) return;
  const pCollGrid = sm.u32((edi + 0x20) >>> 0);
  if (pCollGrid === 0) return;

  const pOutRects = (STACK_SCRATCH_BASE + depth * 0x30) >>> 0;
  const nSplit = COLLISION_SplitClipRectByRoomBounds113c(sm, edi, rect, pOutRects) | 0;
  if (nSplit <= 0) return;

  COLLISION_SetMaskForBoundingBox113c(sm, pCollGrid, pOutRects, wMask);

  if (nSplit > 1) {
    let i = 1;
    do {
      COLLISION_SetMaskForBoundingBoxRecursively113c(
        sm,
        edi,
        (pOutRects + i * 0x10) >>> 0,
        wMask,
        depth + 1,
      );
      i = (i + 1) | 0;
    } while (i < nSplit);
  }
}

/**
 * `@va D2Common:0x6FD9B2F0` (`COLLISION_ClearMaskForBoundingBoxRecursively113c`,
 * `__fastcall(ecx=pRoom, edx=pClipRect, [esp+4]=wMask)`, `ret 4`).
 */
export function COLLISION_ClearMaskForBoundingBoxRecursively113c(
  m: Memory113c,
  pRoom: number,
  pClipRect: number,
  wMask: number,
  depth = 0,
): void {
  const sm = withStackScratch113c(m);
  const rect = pClipRect >>> 0;
  const edi = DUNGEON_GetRoomAtPosition113c(sm, pRoom, sm.u32(rect) | 0, sm.u32((rect + 0x04) >>> 0) | 0);
  if (edi === 0) return;
  const pCollGrid = sm.u32((edi + 0x20) >>> 0);
  if (pCollGrid === 0) return;

  const pOutRects = (STACK_SCRATCH_BASE + depth * 0x30) >>> 0;
  const nSplit = COLLISION_SplitClipRectByRoomBounds113c(sm, edi, rect, pOutRects) | 0;
  if (nSplit <= 0) return;

  COLLISION_ClearMaskForBoundingBox113c(sm, pCollGrid, pOutRects, wMask);

  if (nSplit > 1) {
    let i = 1;
    do {
      COLLISION_ClearMaskForBoundingBoxRecursively113c(
        sm,
        edi,
        (pOutRects + i * 0x10) >>> 0,
        wMask,
        depth + 1,
      );
      i = (i + 1) | 0;
    } while (i < nSplit);
  }
}

/**
 * `@va D2Common:0x6FD9B360` (`COLLISION_CheckAnyCollisionWithBoxRecursively113c`,
 * `__fastcall(ecx=pRoom, edx=pClipRect, [esp+4]=wMask) -> BOOL`, `ret 4`).
 */
export function COLLISION_CheckAnyCollisionWithBoxRecursively113c(
  m: Memory113c,
  pRoom: number,
  pClipRect: number,
  wMask: number,
  depth = 0,
): number {
  const sm = withStackScratch113c(m);
  const rect = pClipRect >>> 0;
  const edi = DUNGEON_GetRoomAtPosition113c(sm, pRoom, sm.u32(rect) | 0, sm.u32((rect + 0x04) >>> 0) | 0);
  if (edi === 0) return 1;
  const pCollGrid = sm.u32((edi + 0x20) >>> 0);
  if (pCollGrid === 0) return 1;

  const pOutRects = (STACK_SCRATCH_BASE + depth * 0x30) >>> 0;
  const nSplit = COLLISION_SplitClipRectByRoomBounds113c(sm, edi, rect, pOutRects) | 0;
  if (nSplit <= 0) return 1;

  if ((COLLISION_CheckMaskForBoundingBox113c(sm, pCollGrid, pOutRects, wMask) & 0xffff) !== 0) {
    return 1;
  }

  let i = 1;
  if (nSplit > 1) {
    while (
      COLLISION_CheckAnyCollisionWithBoxRecursively113c(
        sm,
        edi,
        (pOutRects + i * 0x10) >>> 0,
        wMask,
        depth + 1,
      ) === 0
    ) {
      i = (i + 1) | 0;
      if (i >= nSplit) {
        return 0;
      }
    }
    return 1;
  }
  return 0;
}

/**
 * `@va D2Common:0x6FD9B3F0` (`COLLISION_GetCombinedMaskForBoxRecursively113c`,
 * `__fastcall(ecx=pRoom, edx=pClipRect, [esp+4]=wMask) -> uint16`, `ret 4`).
 */
export function COLLISION_GetCombinedMaskForBoxRecursively113c(
  m: Memory113c,
  pRoom: number,
  pClipRect: number,
  wMask: number,
  depth = 0,
): number {
  const sm = withStackScratch113c(m);
  const rect = pClipRect >>> 0;
  const edi = DUNGEON_GetRoomAtPosition113c(sm, pRoom, sm.u32(rect) | 0, sm.u32((rect + 0x04) >>> 0) | 0);
  if (edi === 0) return 0x27;
  const pCollGrid = sm.u32((edi + 0x20) >>> 0);
  if (pCollGrid === 0) return 0x27;

  const pOutRects = (STACK_SCRATCH_BASE + depth * 0x30) >>> 0;
  const nSplit = COLLISION_SplitClipRectByRoomBounds113c(sm, edi, rect, pOutRects) | 0;
  if (nSplit <= 0) return 0x27;

  let acc = COLLISION_CheckMaskForBoundingBox113c(sm, pCollGrid, pOutRects, wMask) & 0xffff;

  if (nSplit > 1) {
    let i = 1;
    do {
      acc =
        (acc |
          COLLISION_GetCombinedMaskForBoxRecursively113c(
            sm,
            edi,
            (pOutRects + i * 0x10) >>> 0,
            wMask,
            depth + 1,
          )) &
        0xffff;
      i = (i + 1) | 0;
    } while (i < nSplit);
  }
  return acc;
}

/**
 * `@va D2Common:0x6FD9B4D0` (`COLLISION_ClearSubtileMaskInRoom113c`,
 * custom register ABI `eax = pRoom`, `ecx = wMask`, `edx = nY`, `[esp+4] = nX`, `ret 4`).
 */
export function COLLISION_ClearSubtileMaskInRoom113c(
  m: Memory113c,
  pRoom: number,
  wMask: number,
  nY: number,
  nX: number,
): void {
  const room = DUNGEON_GetRoomAtPosition113c(m, pRoom, nX | 0, nY | 0);
  if (room === 0) return;
  const pCollGrid = m.u32((room + 0x20) >>> 0);
  if (pCollGrid === 0) return;
  const pMap = m.u32((pCollGrid + 0x20) >>> 0);
  if (pMap === 0) return;
  const rx = ((nX | 0) - (m.u32(pCollGrid) | 0)) | 0;
  const ry = ((nY | 0) - (m.u32((pCollGrid + 0x04) >>> 0) | 0)) | 0;
  const stride = m.u32((pCollGrid + 0x08) >>> 0) | 0;
  const addr = (pMap + (((imul32(stride, ry) + rx) | 0) << 1)) >>> 0;
  m.setU16(addr, m.u16(addr) & (~wMask & 0xffff));
}

/**
 * `@va D2Common:0x6FD9B930` (`COLLISION_SetSubtileMaskInRoom113c`,
 * custom register ABI `eax = pRoom`, `ecx = nY`, `edx = nX`, `[esp+4] = wMask`, `ret 4`).
 */
export function COLLISION_SetSubtileMaskInRoom113c(
  m: Memory113c,
  pRoom: number,
  nY: number,
  nX: number,
  wMask: number,
): void {
  const room = DUNGEON_GetRoomAtPosition113c(m, pRoom, nX | 0, nY | 0);
  if (room === 0) return;
  const pCollGrid = m.u32((room + 0x20) >>> 0);
  if (pCollGrid === 0) return;
  const pMap = m.u32((pCollGrid + 0x20) >>> 0);
  if (pMap === 0) return;
  const rx = ((nX | 0) - (m.u32(pCollGrid) | 0)) | 0;
  const ry = ((nY | 0) - (m.u32((pCollGrid + 0x04) >>> 0) | 0)) | 0;
  const stride = m.u32((pCollGrid + 0x08) >>> 0) | 0;
  const addr = (pMap + (((imul32(stride, ry) + rx) | 0) << 1)) >>> 0;
  m.setU16(addr, (m.u16(addr) | (wMask & 0xffff)) & 0xffff);
}

/**
 * `@va D2Common:0x6FD9B970` (`COLLISION_SetCrossPatternMask113c`,
 * custom register ABI `esi = nY`, `[esp+4] = pRoom`, `[esp+8] = nX`, `[esp+0xC] = wMask`, `ret 0xC`).
 */
export function COLLISION_SetCrossPatternMask113c(
  m: Memory113c,
  nY: number,
  pRoom: number,
  nX: number,
  wMask: number,
): void {
  const x = nX | 0;
  const y = nY | 0;
  const mask16 = wMask & 0xffff;

  const setPoint = (px: number, py: number): void => {
    const r = DUNGEON_GetRoomAtPosition113c(m, pRoom, px, py);
    if (r === 0) return;
    const pGrid = m.u32((r + 0x20) >>> 0);
    if (pGrid === 0) return;
    const pMap = m.u32((pGrid + 0x20) >>> 0);
    if (pMap === 0) return;
    const rx = (px - (m.u32(pGrid) | 0)) | 0;
    const ry = (py - (m.u32((pGrid + 0x04) >>> 0) | 0)) | 0;
    const stride = m.u32((pGrid + 0x08) >>> 0) | 0;
    const addr = (pMap + (((imul32(stride, ry) + rx) | 0) << 1)) >>> 0;
    m.setU16(addr, (m.u16(addr) | mask16) & 0xffff);
  };

  setPoint((x - 1) | 0, y);
  setPoint(x, y);
  setPoint((x + 1) | 0, y);
  setPoint(x, (y - 1) | 0);
  setPoint(x, (y + 1) | 0);
}

/**
 * `@va D2Common:0x6FD9BB70` (`COLLISION_ClearSubtileMaskInRoom_6FD9BB70_113c`,
 * custom register ABI `eax = pRoom`, `ecx = wMask`, `edx = nY`, `[esp+4] = nX`, `ret 4`).
 */
export function COLLISION_ClearSubtileMaskInRoom_6FD9BB70_113c(
  m: Memory113c,
  pRoom: number,
  wMask: number,
  nY: number,
  nX: number,
): void {
  COLLISION_ClearSubtileMaskInRoom113c(m, pRoom, wMask, nY, nX);
}

/**
 * `@va D2Common:0x6FD9BBB0` (`COLLISION_ClearCrossPatternMask113c`,
 * custom register ABI `esi = nY`, `[esp+4] = pRoom`, `[esp+8] = nX`, `[esp+0xC] = wMask`, `ret 0xC`).
 */
export function COLLISION_ClearCrossPatternMask113c(
  m: Memory113c,
  nY: number,
  pRoom: number,
  nX: number,
  wMask: number,
): void {
  const x = nX | 0;
  const y = nY | 0;
  const invMask16 = ~wMask & 0xffff;

  const clearPoint = (px: number, py: number): void => {
    const r = DUNGEON_GetRoomAtPosition113c(m, pRoom, px, py);
    if (r === 0) return;
    const pGrid = m.u32((r + 0x20) >>> 0);
    if (pGrid === 0) return;
    const pMap = m.u32((pGrid + 0x20) >>> 0);
    if (pMap === 0) return;
    const rx = (px - (m.u32(pGrid) | 0)) | 0;
    const ry = (py - (m.u32((pGrid + 0x04) >>> 0) | 0)) | 0;
    const stride = m.u32((pGrid + 0x08) >>> 0) | 0;
    const addr = (pMap + (((imul32(stride, ry) + rx) | 0) << 1)) >>> 0;
    m.setU16(addr, m.u16(addr) & invMask16);
  };

  clearPoint((x - 1) | 0, y);
  clearPoint(x, y);
  clearPoint((x + 1) | 0, y);
  clearPoint(x, (y - 1) | 0);
  clearPoint(x, (y + 1) | 0);
}

/**
 * `@va D2Common:0x6FD9C570` (`COLLISION_CheckSubtileMaskInRoomFast113c`,
 * custom register ABI `eax = pRoom`, `ecx = nY`, `edx = nX`, `[esp+4] = wMask`, `ret 4 -> uint16`).
 */
export function COLLISION_CheckSubtileMaskInRoomFast113c(
  m: Memory113c,
  pRoom: number,
  nY: number,
  nX: number,
  wMask: number,
): number {
  const room = DUNGEON_GetRoomAtPosition113c(m, pRoom, nX | 0, nY | 0);
  if (room === 0) return 0x27;
  const pCollGrid = m.u32((room + 0x20) >>> 0);
  if (pCollGrid === 0) return 0x27;
  const pMap = m.u32((pCollGrid + 0x20) >>> 0);
  if (pMap === 0) return 0x27;
  const rx = ((nX | 0) - (m.u32(pCollGrid) | 0)) | 0;
  const ry = ((nY | 0) - (m.u32((pCollGrid + 0x04) >>> 0) | 0)) | 0;
  const stride = m.u32((pCollGrid + 0x08) >>> 0) | 0;
  const cell = m.u16((pMap + (((imul32(stride, ry) + rx) | 0) << 1)) >>> 0);
  return (cell & wMask) >>> 0;
}

/**
 * `@va D2Common:0x6FD9C940` (`D2Common.#10212` `COLLISION_ClearSubtileMask113c`,
 * `__stdcall(pRoom, nX, nY, wMask)`, `ret 0x10`).
 */
export function COLLISION_ClearSubtileMask113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  wMask: number,
): void {
  COLLISION_ClearSubtileMaskInRoom113c(m, pRoom, wMask, nY, nX);
}

/**
 * `@va D2Common:0x6FD9C990` (`D2Common.#10628` `COLLISION_SetSubtileMask113c`,
 * `__stdcall(pRoom, nX, nY, wMask)`, `ret 0x10`).
 */
export function COLLISION_SetSubtileMask113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  wMask: number,
): void {
  COLLISION_SetSubtileMaskInRoom113c(m, pRoom, nY, nX, wMask);
}

/**
 * `@va D2Common:0x6FD9C9D0` (`D2Common.#10288` `COLLISION_CheckSubtileMask113c`,
 * `__stdcall(pRoom, nX, nY, wMask) -> uint16`, `ret 0x10`).
 */
export function COLLISION_CheckSubtileMask113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  wMask: number,
): number {
  return COLLISION_CheckSubtileMaskInRoomFast113c(m, pRoom, nY, nX, wMask);
}

/**
 * `@va D2Common:0x6FD9CA20` (`COLLISION_ReplaceTileSubtileFlagsInRoom113c`,
 * custom register ABI `eax = pRoom`, `[esp+4] = pTileEntry`, `[esp+8] = pNewTileLibraryEntry`, `ret 8`).
 */
export function COLLISION_ReplaceTileSubtileFlagsInRoom113c(
  m: Memory113c,
  pRoom: number,
  pTileEntry: number,
  pNewTileLibraryEntry: number,
): void {
  const room0 = pRoom >>> 0;
  if (room0 === 0) return;
  const pRoomCoords = m.u32((room0 + 0x20) >>> 0);
  if (pRoomCoords === 0) return;
  const te = pTileEntry >>> 0;
  const tileX = ((m.u32((pRoomCoords + 0x10) >>> 0) | 0) + (m.u32((te + 0x08) >>> 0) | 0)) | 0;
  const tileY = ((m.u32((pRoomCoords + 0x14) >>> 0) | 0) + (m.u32((te + 0x0c) >>> 0) | 0)) | 0;
  const subX = imul32(tileX, 5);
  const subY = imul32(tileY, 5);

  const room = DUNGEON_GetRoomAtPosition113c(m, room0, subX, subY);
  if (room === 0) return;
  const pCollGrid = m.u32((room + 0x20) >>> 0);
  if (pCollGrid === 0) return;

  const relY = (subY - (m.u32((pCollGrid + 0x04) >>> 0) | 0)) | 0;
  const relX = (subX - (m.u32(pCollGrid) | 0)) | 0;
  const pOldTileLibraryEntry = m.u32((te + 0x18) >>> 0);
  COLLISION_ClearTileSubtileFlagsFromCollGrid113c(m, relY, relX, pCollGrid, pOldTileLibraryEntry);
  if ((pNewTileLibraryEntry >>> 0) !== 0) {
    COLLISION_OrTileSubtileFlagsToCollGrid113c(m, relY, relX, pCollGrid, pNewTileLibraryEntry >>> 0);
  }
}

/**
 * `@va D2Common:0x6FDCE6C0` (`D2Common.#10697` `COLLISION_TraceFieldCollision113c`,
 * `__stdcall(pField, pRoom, nX, nY, wMask) -> BOOL`, `ret 0x14`).
 */
export function COLLISION_TraceFieldCollision113c(
  m: Memory113c,
  pField: number,
  pRoom: number,
  nX: number,
  nY: number,
  wMask: number,
): number {
  const sm = withStackScratch113c(m);
  const room0 = pRoom >>> 0;
  if (room0 === 0) return 0;

  const x0 = nX | 0;
  const y0 = nY | 0;
  const mask16 = wMask & 0xffff;

  let r = DUNGEON_GetRoomAtPosition113c(sm, room0, x0, y0);
  if (r === 0) return 1;
  let pGrid = sm.u32((r + 0x20) >>> 0);
  if (pGrid === 0) return 1;
  let pMap = sm.u32((pGrid + 0x20) >>> 0);
  if (pMap === 0) return 1;
  let rx = (x0 - (sm.u32(pGrid) | 0)) | 0;
  let ry = (y0 - (sm.u32((pGrid + 0x04) >>> 0) | 0)) | 0;
  let stride = sm.u32((pGrid + 0x08) >>> 0) | 0;
  if ((sm.u16((pMap + (((imul32(stride, ry) + rx) | 0) << 1)) >>> 0) & mask16) !== 0) {
    return 1;
  }

  const pStackXY = STACK_SCRATCH_BASE + 0x800;
  sm.setU32(pStackXY, x0 >>> 0);
  sm.setU32((pStackXY + 0x04) >>> 0, y0 >>> 0);

  while (FIELD_StepFieldCoords113c(sm, pField, pStackXY, (pStackXY + 0x04) >>> 0) !== 0) {
    const curX = sm.u32(pStackXY) | 0;
    const curY = sm.u32((pStackXY + 0x04) >>> 0) | 0;
    r = DUNGEON_GetRoomAtPosition113c(sm, room0, curX, curY);
    if (r === 0) return 1;
    pGrid = sm.u32((r + 0x20) >>> 0);
    if (pGrid === 0) return 1;
    pMap = sm.u32((pGrid + 0x20) >>> 0);
    if (pMap === 0) return 1;
    rx = (curX - (sm.u32(pGrid) | 0)) | 0;
    ry = (curY - (sm.u32((pGrid + 0x04) >>> 0) | 0)) | 0;
    stride = sm.u32((pGrid + 0x08) >>> 0) | 0;
    if ((sm.u16((pMap + (((imul32(stride, ry) + rx) | 0) << 1)) >>> 0) & mask16) !== 0) {
      return 1;
    }
  }
  return 0;
}

/**
 * `@va D2Common:0x6FDCF490` (`COLLISION_IsPointWithinRoomMargin113c`,
 * custom register ABI `eax = nY`, `ecx = pRoom`, `edx = nX`, `edi = nMargin -> BOOL`).
 */
export function COLLISION_IsPointWithinRoomMargin113c(
  m: Memory113c,
  nY: number,
  pRoom: number,
  nX: number,
  nMargin: number,
): number {
  const sm = withStackScratch113c(m);
  const pRoomCoords = STACK_SCRATCH_BASE + 0x900;
  DUNGEON_GetRoomCoordinates113c(sm, pRoom, pRoomCoords);

  const margin = nMargin | 0;
  const x = nX | 0;
  const y = nY | 0;
  const rX = sm.u32(pRoomCoords) | 0;
  const rY = sm.u32((pRoomCoords + 0x04) >>> 0) | 0;
  const rW = sm.u32((pRoomCoords + 0x08) >>> 0) | 0;
  const rH = sm.u32((pRoomCoords + 0x0c) >>> 0) | 0;

  if (((x + margin) | 0) < rX) {
    if (((x - margin) | 0) > ((rX + rW) | 0)) {
      return 0;
    }
  }
  if (((y + margin) | 0) >= rY) {
    return 1;
  }
  if (((y - margin) | 0) > ((rY + rH) | 0)) {
    return 0;
  }
  return 1;
}

/**
 * `@va D2Common:0x6FD9B510` (`COLLISION_GetMaskAt113c`,
 * custom register ABI `eax = pRoom`, `edx = nX`, `ecx = nY`, `[esp+4] = wMask`, `ret 4 -> uint16`).
 */
export function COLLISION_GetMaskAt113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  wMask: number,
): number {
  const room = DUNGEON_GetRoomAtPosition113c(m, pRoom, nX | 0, nY | 0);
  if (room === 0) return 0x27;
  const pCollGrid = m.u32((room + 0x20) >>> 0);
  if (pCollGrid === 0) return 0x27;
  const pMap = m.u32((pCollGrid + 0x20) >>> 0);
  if (pMap === 0) return 0x27;
  const rx = ((nX | 0) - (m.u32(pCollGrid) | 0)) | 0;
  const ry = ((nY | 0) - (m.u32((pCollGrid + 0x04) >>> 0) | 0)) | 0;
  const stride = m.u32((pCollGrid + 0x08) >>> 0) | 0;
  const cell = m.u16((pMap + (((imul32(stride, ry) + rx) | 0) << 1)) >>> 0);
  return (cell & wMask) & 0xffff;
}

/**
 * `@va D2Common:0x6FD80730` (`COLLISION_RayTraceBetweenSizedPoints113c`,
 * custom register ABI `eax = nX2`, `ecx = nX1`, `edx = nSize2`,
 * `[esp+4] = nY1`, `[esp+8] = nSize1`, `[esp+0xC] = nY2`, `[esp+0x10] = pRoom`, `[esp+0x14] = dwMask`,
 * `ret 0x14 -> BOOL`).
 */
export function COLLISION_RayTraceBetweenSizedPoints113c(
  m: Memory113c,
  nX2: number,
  nX1: number,
  nSize2: number,
  nY1: number,
  nSize1: number,
  nY2: number,
  pRoom: number,
  dwMask: number,
): number {
  const sm = withStackScratch113c(m);
  const s1 = (nSize1 | 0) >= 3 ? 2 : (nSize1 | 0);
  const s2 = (nSize2 | 0) >= 3 ? 2 : (nSize2 | 0);
  let x1 = nX1 | 0;
  let y1 = nY1 | 0;
  let x2 = nX2 | 0;
  let y2 = nY2 | 0;
  let dx = (x2 - x1) | 0;
  if (dx < 0) dx = -dx | 0;
  let dy = (y2 - y1) | 0;
  if (dy < 0) dy = -dy | 0;
  if (((dx + dy) | 0) < ((s1 + s2) | 0)) {
    return 0;
  }
  if (s1 !== 0 || s2 !== 0) {
    if (dx >= dy) {
      if (x2 > x1) {
        x1 = (x1 + s1) | 0;
        x2 = (x2 - s2) | 0;
      } else {
        x1 = (x1 - s1) | 0;
        x2 = (x2 + s2) | 0;
      }
    }
    if (dy >= dx) {
      if (y2 > y1) {
        y1 = (y1 + s1) | 0;
        y2 = (y2 - s2) | 0;
      } else {
        y1 = (y1 - s1) | 0;
        y2 = (y2 + s2) | 0;
      }
    }
  }
  const pt1 = STACK_SCRATCH_BASE + 0xa00;
  const pt2 = STACK_SCRATCH_BASE + 0xa08;
  sm.setU32(pt1, x1 >>> 0);
  sm.setU32((pt1 + 0x04) >>> 0, y1 >>> 0);
  sm.setU32(pt2, x2 >>> 0);
  sm.setU32((pt2 + 0x04) >>> 0, y2 >>> 0);
  return COLLISION_RayTrace113c(sm, pRoom, pt1, pt2, dwMask);
}

/**
 * `@va D2Common:0x6FD9B840` (`D2Common.#10200` `COLLISION_SetMaskWithSizeXY113c`,
 * `__stdcall(pRoom, nX, nY, nSizeX, nSizeY, wMask)`, `ret 0x18`).
 */
export function COLLISION_SetMaskWithSizeXY113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  nSizeX: number,
  nSizeY: number,
  wMask: number,
): void {
  const sx = nSizeX | 0;
  const sy = nSizeY | 0;
  if (sx === 1 && sy === 1) {
    COLLISION_SetSubtileMaskInRoom113c(m, pRoom, nY, nX, wMask);
    return;
  }
  const sm = withStackScratch113c(m);
  const left = ((nX | 0) - ((nSizeX >>> 0) >>> 1)) | 0;
  const right = (left + sx - 1) | 0;
  const top = ((nY | 0) - ((nSizeY >>> 0) >>> 1)) | 0;
  const bottom = (top + sy - 1) | 0;
  const box = STACK_SCRATCH_BASE + 0xa20;
  sm.setU32(box, left >>> 0);
  sm.setU32((box + 0x04) >>> 0, top >>> 0);
  sm.setU32((box + 0x08) >>> 0, right >>> 0);
  sm.setU32((box + 0x0c) >>> 0, bottom >>> 0);
  COLLISION_SetMaskForBoundingBoxRecursively113c(sm, pRoom, box, wMask);
}

/**
 * `@va D2Common:0x6FD9B8F0` (`COLLISION_SetMask3x3_113c`,
 * custom register ABI `ecx = pRoom`, `eax = nX`, `[esp+4] = nY`, `[esp+8] = wMask`, `ret 8`).
 */
export function COLLISION_SetMask3x3_113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  wMask: number,
): void {
  const sm = withStackScratch113c(m);
  const x = nX | 0;
  const y = nY | 0;
  const box = STACK_SCRATCH_BASE + 0xa30;
  sm.setU32(box, ((x - 1) | 0) >>> 0);
  sm.setU32((box + 0x04) >>> 0, ((y - 1) | 0) >>> 0);
  sm.setU32((box + 0x08) >>> 0, ((x + 1) | 0) >>> 0);
  sm.setU32((box + 0x0c) >>> 0, ((y + 1) | 0) >>> 0);
  COLLISION_SetMaskForBoundingBoxRecursively113c(sm, pRoom, box, wMask);
}

/**
 * `@va D2Common:0x6FD9BAB0` (`D2Common.#10958` `COLLISION_ResetMaskWithSizeXY113c`,
 * `__stdcall(pRoom, nX, nY, nSizeX, nSizeY, wMask)`, `ret 0x18`).
 */
export function COLLISION_ResetMaskWithSizeXY113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  nSizeX: number,
  nSizeY: number,
  wMask: number,
): void {
  const sx = nSizeX | 0;
  const sy = nSizeY | 0;
  if (sx <= 0 || sy <= 0) return;
  if (sx === 1 && sy === 1) {
    COLLISION_ClearSubtileMaskInRoom113c(m, pRoom, wMask, nY, nX);
    return;
  }
  const sm = withStackScratch113c(m);
  const left = ((nX | 0) - ((nSizeX >>> 0) >>> 1)) | 0;
  const right = (left + sx - 1) | 0;
  const top = ((nY | 0) - ((nSizeY >>> 0) >>> 1)) | 0;
  const bottom = (top + sy - 1) | 0;
  const box = STACK_SCRATCH_BASE + 0xa40;
  sm.setU32(box, left >>> 0);
  sm.setU32((box + 0x04) >>> 0, top >>> 0);
  sm.setU32((box + 0x08) >>> 0, right >>> 0);
  sm.setU32((box + 0x0c) >>> 0, bottom >>> 0);
  COLLISION_ClearMaskForBoundingBoxRecursively113c(sm, pRoom, box, wMask);
}

/**
 * `@va D2Common:0x6FD9BB30` (`COLLISION_ResetMask3x3_113c`,
 * custom register ABI `ecx = pRoom`, `eax = nX`, `[esp+4] = nY`, `[esp+8] = wMask`, `ret 8`).
 */
export function COLLISION_ResetMask3x3_113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  wMask: number,
): void {
  const sm = withStackScratch113c(m);
  const x = nX | 0;
  const y = nY | 0;
  const box = STACK_SCRATCH_BASE + 0xa50;
  sm.setU32(box, ((x - 1) | 0) >>> 0);
  sm.setU32((box + 0x04) >>> 0, ((y - 1) | 0) >>> 0);
  sm.setU32((box + 0x08) >>> 0, ((x + 1) | 0) >>> 0);
  sm.setU32((box + 0x0c) >>> 0, ((y + 1) | 0) >>> 0);
  COLLISION_ClearMaskForBoundingBoxRecursively113c(sm, pRoom, box, wMask);
}

/**
 * `@va D2Common:0x6FD9BFC0` (`D2Common.#10552` `COLLISION_SetMaskWithPattern113c`,
 * `__stdcall(pRoom, nX, nY, nPattern, wMask)`, `ret 0x14`).
 */
export function COLLISION_SetMaskWithPattern113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  nPattern: number,
  wMask: number,
): void {
  const pat = nPattern | 0;
  if (pat === 1) {
    COLLISION_SetSubtileMaskInRoom113c(m, pRoom, nY, nX, wMask);
  } else if (pat === 2) {
    COLLISION_SetCrossPatternMask113c(m, nY, pRoom, nX, wMask);
  } else if (pat === 3) {
    COLLISION_SetMask3x3_113c(m, pRoom, nX, nY, wMask);
  }
}

/**
 * `@va D2Common:0x6FD9C080` (`D2Common.#10303` `COLLISION_CheckMaskWithSizeXY113c`,
 * `__stdcall(pRoom, nX, nY, nSizeX, nSizeY, wMask) -> uint16`, `ret 0x18`).
 */
export function COLLISION_CheckMaskWithSizeXY113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  nSizeX: number,
  nSizeY: number,
  wMask: number,
): number {
  const sx = nSizeX | 0;
  const sy = nSizeY | 0;
  if (sx <= 1 && sy <= 1) {
    return COLLISION_GetMaskAt113c(m, pRoom, nX, nY, wMask) & 0xffff;
  }
  const sm = withStackScratch113c(m);
  const left = ((nX | 0) - ((nSizeX >>> 0) >>> 1)) | 0;
  const right = (left + sx - 1) | 0;
  const top = ((nY | 0) - ((nSizeY >>> 0) >>> 1)) | 0;
  const bottom = (top + sy - 1) | 0;
  const box = STACK_SCRATCH_BASE + 0xa60;
  sm.setU32(box, left >>> 0);
  sm.setU32((box + 0x04) >>> 0, top >>> 0);
  sm.setU32((box + 0x08) >>> 0, right >>> 0);
  sm.setU32((box + 0x0c) >>> 0, bottom >>> 0);
  return COLLISION_GetCombinedMaskForBoxRecursively113c(sm, pRoom, box, wMask) & 0xffff;
}

/**
 * `@va D2Common:0x6FD9C140` (`COLLISION_CheckCrossPatternCollision113c`,
 * custom register ABI `eax = nX`, `esi = wMask`, `[esp+4] = pRoom`, `[esp+8] = nY`,
 * `ret 8 -> BOOL`).
 */
export function COLLISION_CheckCrossPatternCollision113c(
  m: Memory113c,
  nX: number,
  wMask: number,
  pRoom: number,
  nY: number,
): number {
  const x = nX | 0;
  const y = nY | 0;
  const mask16 = wMask & 0xffff;
  const r = DUNGEON_GetRoomAtPosition113c(m, pRoom, x, y);
  if (r === 0) return 1;
  const g = m.u32((r + 0x20) >>> 0);
  if (g === 0) return 1;
  const pMap = m.u32((g + 0x20) >>> 0);
  if (pMap === 0) return 1;

  const gx = m.u32(g) | 0;
  const gy = m.u32((g + 0x04) >>> 0) | 0;
  const gw = m.u32((g + 0x08) >>> 0) | 0;
  const gh = m.u32((g + 0x0c) >>> 0) | 0;

  let edge = 0;
  if (gx >= x) edge = 1;
  if (gy >= y) edge = (edge + 2) | 0;
  if (((gx + gw) | 0) <= ((x + 1) | 0)) edge = (edge + 4) | 0;
  if (((gy + gh) | 0) <= ((y + 1) | 0)) edge = (edge + 8) | 0;

  const rx = (x - gx) | 0;
  const ry = (y - gy) | 0;
  const pCenter = (pMap + (((imul32(gw, ry) + rx) | 0) << 1)) >>> 0;
  const rowBytes = (gw << 1) | 0;
  const cellAt = (byteOff: number): number => m.u16((pCenter + byteOff) >>> 0) & mask16;

  switch (edge >>> 0) {
    case 0:
      if (cellAt(0) !== 0) return 1;
      if (cellAt(-2) !== 0) return 1;
      if (cellAt(2) !== 0) return 1;
      if (cellAt(-rowBytes) !== 0) return 1;
      if (cellAt(rowBytes) !== 0) return 1;
      return 0;
    case 1:
      if (cellAt(0) !== 0) return 1;
      if (cellAt(2) !== 0) return 1;
      if (cellAt(-rowBytes) !== 0) return 1;
      if (cellAt(rowBytes) !== 0) return 1;
      if (COLLISION_GetMaskAt113c(m, r, (x - 1) | 0, y, mask16) !== 0) return 1;
      return 0;
    case 2:
      if (cellAt(0) !== 0) return 1;
      if (cellAt(-2) !== 0) return 1;
      if (cellAt(2) !== 0) return 1;
      if (cellAt(rowBytes) !== 0) return 1;
      if (COLLISION_GetMaskAt113c(m, r, x, (y - 1) | 0, mask16) !== 0) return 1;
      return 0;
    case 3:
      if (cellAt(0) !== 0) return 1;
      if (cellAt(2) !== 0) return 1;
      if (cellAt(rowBytes) !== 0) return 1;
      if (COLLISION_GetMaskAt113c(m, r, x, (y - 1) | 0, mask16) !== 0) return 1;
      if (COLLISION_GetMaskAt113c(m, r, (x - 1) | 0, y, mask16) !== 0) return 1;
      return 0;
    case 4:
      if (cellAt(0) !== 0) return 1;
      if (cellAt(-2) !== 0) return 1;
      if (cellAt(-rowBytes) !== 0) return 1;
      if (cellAt(rowBytes) !== 0) return 1;
      if (COLLISION_GetMaskAt113c(m, r, (x + 1) | 0, y, mask16) !== 0) return 1;
      return 0;
    case 6:
      if (cellAt(0) !== 0) return 1;
      if (cellAt(-2) !== 0) return 1;
      if (cellAt(rowBytes) !== 0) return 1;
      if (COLLISION_GetMaskAt113c(m, r, (x + 1) | 0, y, mask16) !== 0) return 1;
      if (COLLISION_GetMaskAt113c(m, r, x, (y - 1) | 0, mask16) !== 0) return 1;
      return 0;
    case 8:
      if (cellAt(0) !== 0) return 1;
      if (cellAt(-2) !== 0) return 1;
      if (cellAt(2) !== 0) return 1;
      if (cellAt(-rowBytes) !== 0) return 1;
      if (COLLISION_GetMaskAt113c(m, r, x, (y + 1) | 0, mask16) !== 0) return 1;
      return 0;
    case 9:
      if (cellAt(0) !== 0) return 1;
      if (cellAt(2) !== 0) return 1;
      if (cellAt(-rowBytes) !== 0) return 1;
      if (COLLISION_GetMaskAt113c(m, r, (x - 1) | 0, y, mask16) !== 0) return 1;
      if (COLLISION_GetMaskAt113c(m, r, x, (y + 1) | 0, mask16) !== 0) return 1;
      return 0;
    case 12:
      if (cellAt(0) !== 0) return 1;
      if (cellAt(-2) !== 0) return 1;
      if (cellAt(-rowBytes) !== 0) return 1;
      if (COLLISION_GetMaskAt113c(m, r, (x + 1) | 0, y, mask16) !== 0) return 1;
      if (COLLISION_GetMaskAt113c(m, r, x, (y + 1) | 0, mask16) !== 0) return 1;
      return 0;
    default:
      return 1;
  }
}

/**
 * `@va D2Common:0x6FD9C530` (`COLLISION_GetMask3x3_113c`,
 * custom register ABI `ecx = pRoom`, `eax = nX`, `[esp+4] = nY`, `[esp+8] = wMask`,
 * `ret 8 -> uint16`).
 */
export function COLLISION_GetMask3x3_113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  wMask: number,
): number {
  const sm = withStackScratch113c(m);
  const x = nX | 0;
  const y = nY | 0;
  const box = STACK_SCRATCH_BASE + 0xa70;
  sm.setU32(box, ((x - 1) | 0) >>> 0);
  sm.setU32((box + 0x04) >>> 0, ((y - 1) | 0) >>> 0);
  sm.setU32((box + 0x08) >>> 0, ((x + 1) | 0) >>> 0);
  sm.setU32((box + 0x0c) >>> 0, ((y + 1) | 0) >>> 0);
  return COLLISION_GetCombinedMaskForBoxRecursively113c(sm, pRoom, box, wMask) & 0xffff;
}

/**
 * `@va D2Common:0x6FD9C5C0` (`COLLISION_GetCrossPatternMask113c`,
 * custom register ABI `eax = pRoom`, `[esp+4] = nX`, `[esp+8] = nY`, `[esp+0xC] = wMask`,
 * `ret 0xC -> uint16`).
 */
export function COLLISION_GetCrossPatternMask113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  wMask: number,
): number {
  const x = nX | 0;
  const y = nY | 0;
  const mask16 = wMask & 0xffff;
  const r = DUNGEON_GetRoomAtPosition113c(m, pRoom, x, y);
  if (r === 0) return mask16;
  const g = m.u32((r + 0x20) >>> 0);
  if (g === 0) return mask16;
  const pMap = m.u32((g + 0x20) >>> 0);
  if (pMap === 0) return mask16;

  const gx = m.u32(g) | 0;
  const gy = m.u32((g + 0x04) >>> 0) | 0;
  const gw = m.u32((g + 0x08) >>> 0) | 0;
  const gh = m.u32((g + 0x0c) >>> 0) | 0;

  let edge = 0;
  if (gx >= x) edge = 1;
  if (gy >= y) edge = (edge + 2) | 0;
  if (((gx + gw) | 0) <= ((x + 1) | 0)) edge = (edge + 4) | 0;
  if (((gy + gh) | 0) <= ((y + 1) | 0)) edge = (edge + 8) | 0;

  const rx = (x - gx) | 0;
  const ry = (y - gy) | 0;
  const pCenter = (pMap + (((imul32(gw, ry) + rx) | 0) << 1)) >>> 0;
  const rowBytes = (gw << 1) | 0;
  const cellAt = (byteOff: number): number => m.u16((pCenter + byteOff) >>> 0) & mask16;

  switch (edge >>> 0) {
    case 0:
      return (cellAt(0) | cellAt(-2) | cellAt(2) | cellAt(-rowBytes) | cellAt(rowBytes)) & 0xffff;
    case 1:
      return (
        (cellAt(0) |
          cellAt(2) |
          cellAt(-rowBytes) |
          cellAt(rowBytes) |
          COLLISION_GetMaskAt113c(m, r, (x - 1) | 0, y, mask16)) &
        0xffff
      );
    case 2:
      return (
        (cellAt(0) |
          cellAt(-2) |
          cellAt(2) |
          cellAt(rowBytes) |
          COLLISION_GetMaskAt113c(m, r, x, (y - 1) | 0, mask16)) &
        0xffff
      );
    case 3:
      return (
        (cellAt(0) |
          cellAt(2) |
          cellAt(rowBytes) |
          COLLISION_GetMaskAt113c(m, r, x, (y - 1) | 0, mask16) |
          COLLISION_GetMaskAt113c(m, r, (x - 1) | 0, y, mask16)) &
        0xffff
      );
    case 4:
      return (
        (cellAt(0) |
          cellAt(-2) |
          cellAt(-rowBytes) |
          cellAt(rowBytes) |
          COLLISION_GetMaskAt113c(m, r, (x + 1) | 0, y, mask16)) &
        0xffff
      );
    case 6:
      return (
        (cellAt(0) |
          cellAt(-2) |
          cellAt(rowBytes) |
          COLLISION_GetMaskAt113c(m, r, x, (y - 1) | 0, mask16) |
          COLLISION_GetMaskAt113c(m, r, (x + 1) | 0, y, mask16)) &
        0xffff
      );
    case 8:
      return (
        (cellAt(0) |
          cellAt(-2) |
          cellAt(2) |
          cellAt(-rowBytes) |
          COLLISION_GetMaskAt113c(m, r, x, (y + 1) | 0, mask16)) &
        0xffff
      );
    case 9:
      return (
        (cellAt(0) |
          cellAt(2) |
          cellAt(-rowBytes) |
          COLLISION_GetMaskAt113c(m, r, (x - 1) | 0, y, mask16) |
          COLLISION_GetMaskAt113c(m, r, x, (y + 1) | 0, mask16)) &
        0xffff
      );
    case 12:
      return (
        (cellAt(0) |
          cellAt(-2) |
          cellAt(-rowBytes) |
          COLLISION_GetMaskAt113c(m, r, (x + 1) | 0, y, mask16) |
          COLLISION_GetMaskAt113c(m, r, x, (y + 1) | 0, mask16)) &
        0xffff
      );
    default:
      return mask16;
  }
}

/**
 * `@va D2Common:0x6FD9CB90` (`D2Common.#11135` `COLLISION_FindFreeCoordsNear113c`,
 * custom register ABI `ecx = pRoom`, `edx = pCoord`, `[esp+4] = nSize`, `[esp+8] = wMask`, `[esp+0xC] = ppRoomOut`,
 * `ret 0xC`).
 */
export function COLLISION_FindFreeCoordsNear113c(
  m: Memory113c,
  pRoom: number,
  pCoord: number,
  nSize: number,
  wMask: number,
  ppRoomOut: number,
): void {
  const sm = withStackScratch113c(m);
  const coord = pCoord >>> 0;
  const roomOut = ppRoomOut >>> 0;
  const x0 = sm.u32(coord) | 0;
  const y0 = sm.u32((coord + 0x04) >>> 0) | 0;
  const pCo = STACK_SCRATCH_BASE + 0xa80;
  const box = STACK_SCRATCH_BASE + 0xaa0;

  DUNGEON_GetRoomCoordinates113c(sm, pRoom, pCo);

  let lim = 1;
  let s = -1;
  do {
    for (let dy = s; dy < lim; dy = (dy + 2) | 0) {
      const y = (y0 + dy) | 0;
      sm.setU32((coord + 0x04) >>> 0, y >>> 0);
      const coSubY = sm.u32((pCo + 0x04) >>> 0) | 0;
      const coSubH = sm.u32((pCo + 0x0c) >>> 0) | 0;
      let rr = pRoom >>> 0;
      if (y < coSubY || y >= ((coSubY + coSubH) | 0)) {
        rr = DUNGEON_GetRoomAtPosition113c(sm, pRoom, sm.u32(coord) | 0, y);
      }
      if (rr !== 0) {
        for (let dx = s; dx < lim; dx = (dx + 2) | 0) {
          DUNGEON_GetRoomCoordinates113c(sm, rr, pCo);
          const x = (x0 + dx) | 0;
          sm.setU32(coord, x >>> 0);
          const coSubX = sm.u32(pCo) | 0;
          const coSubW = sm.u32((pCo + 0x08) >>> 0) | 0;
          let cr = rr;
          if (x < coSubX || x >= ((coSubX + coSubW) | 0)) {
            cr = DUNGEON_GetRoomAtPosition113c(sm, rr, x, sm.u32((coord + 0x04) >>> 0) | 0);
          }
          if (cr !== 0) {
            const curY = sm.u32((coord + 0x04) >>> 0) | 0;
            const curX = sm.u32(coord) | 0;
            const dim = ((nSize | 0) + 2) | 0;
            let maskRes: number;
            if (dim <= 1) {
              maskRes = COLLISION_GetMaskAt113c(sm, cr, curX, curY, wMask) & 0xffff;
            } else {
              const half = (dim >>> 0) >>> 1;
              const l = (curX - half) | 0;
              const t = (curY - half) | 0;
              sm.setU32(box, l >>> 0);
              sm.setU32((box + 0x04) >>> 0, t >>> 0);
              sm.setU32((box + 0x08) >>> 0, ((l + dim - 1) | 0) >>> 0);
              sm.setU32((box + 0x0c) >>> 0, ((t + dim - 1) | 0) >>> 0);
              maskRes = COLLISION_GetCombinedMaskForBoxRecursively113c(sm, cr, box, wMask) & 0xffff;
            }
            if ((maskRes & 0xffff) === 0) {
              sm.setU32(roomOut, cr >>> 0);
              return;
            }
          }
        }
      }
    }
    lim = (lim + 1) | 0;
    s = (s - 1) | 0;
  } while (s > -50);

  sm.setU32(roomOut, 0);
}

/**
 * `@va D2Common:0x6FD9BCF0` (`D2Common.#11073` `COLLISION_ResetMaskWithPattern113c`,
 * `__stdcall(pRoom, nX, nY, nCollisionPattern, wMask)`, `ret 0x14`).
 */
export function COLLISION_ResetMaskWithPattern113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  nCollisionPattern: number,
  wMask: number,
): void {
  const room = pRoom >>> 0;
  if (room === 0) return;
  const pat = nCollisionPattern >>> 0;
  if (pat > 5) return;
  switch (pat) {
    case 0:
      return;
    case 1:
      COLLISION_ClearCrossPatternMask113c(m, nY, room, nX, wMask);
      if ((wMask | 0) !== 0) {
        COLLISION_ClearSubtileMaskInRoom_6FD9BB70_113c(m, room, 0x1000, nY, nX);
      }
      return;
    case 2:
      COLLISION_ResetMask3x3_113c(m, room, nX, nY, wMask);
      if ((wMask | 0) !== 0) {
        COLLISION_ClearCrossPatternMask113c(m, nY, room, nX, 0x1000);
      }
      return;
    case 3:
      COLLISION_ClearCrossPatternMask113c(m, nY, room, nX, wMask);
      if ((wMask | 0) !== 0) {
        COLLISION_ClearSubtileMaskInRoom_6FD9BB70_113c(m, room, 0x2000, nY, nX);
      }
      return;
    case 4:
      COLLISION_ResetMask3x3_113c(m, room, nX, nY, wMask);
      if ((wMask | 0) !== 0) {
        COLLISION_ClearCrossPatternMask113c(m, nY, room, nX, 0x2000);
      }
      return;
    default:
      COLLISION_ClearCrossPatternMask113c(m, nY, room, nX, wMask);
      return;
  }
}

/**
 * `@va D2Common:0x6FD9BE10` (`D2Common.#10232` `COLLISION_ResetMaskWithPatternSimple113c`,
 * `__stdcall(pRoom, nX, nY, nCollisionPattern, wMask)`, `ret 0x14`).
 */
export function COLLISION_ResetMaskWithPatternSimple113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  nCollisionPattern: number,
  wMask: number,
): void {
  const room = pRoom >>> 0;
  if (room === 0) return;
  const pat = nCollisionPattern >>> 0;
  if (pat > 3) return;
  if (pat === 1) {
    COLLISION_ClearSubtileMaskInRoom_6FD9BB70_113c(m, room, wMask, nY, nX);
  } else if (pat === 2) {
    COLLISION_ClearCrossPatternMask113c(m, nY, room, nX, wMask);
  } else if (pat === 3) {
    COLLISION_ResetMask3x3_113c(m, room, nX, nY, wMask);
  }
}

/**
 * `@va D2Common:0x6FD9BE90` (`D2Common.#10565` `COLLISION_SetUnitCollisionMaskWithPattern113c`,
 * `__stdcall(pRoom, nX, nY, nCollisionPattern, wMask)`, `ret 0x14`).
 */
export function COLLISION_SetUnitCollisionMaskWithPattern113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  nCollisionPattern: number,
  wMask: number,
): void {
  const pat = nCollisionPattern >>> 0;
  if (pat > 5) return;
  switch (pat) {
    case 0:
      return;
    case 1:
      COLLISION_SetCrossPatternMask113c(m, nY, pRoom, nX, wMask);
      if ((wMask | 0) !== 0) {
        COLLISION_SetSubtileMaskInRoom113c(m, pRoom, nY, nX, 0x1000);
      }
      return;
    case 2:
      COLLISION_SetMask3x3_113c(m, pRoom, nX, nY, wMask);
      if ((wMask | 0) !== 0) {
        COLLISION_SetCrossPatternMask113c(m, nY, pRoom, nX, 0x1000);
      }
      return;
    case 3:
      COLLISION_SetCrossPatternMask113c(m, nY, pRoom, nX, wMask);
      if ((wMask | 0) !== 0) {
        COLLISION_SetSubtileMaskInRoom113c(m, pRoom, nY, nX, 0x2000);
      }
      return;
    case 4:
      COLLISION_SetMask3x3_113c(m, pRoom, nX, nY, wMask);
      if ((wMask | 0) !== 0) {
        COLLISION_SetCrossPatternMask113c(m, nY, pRoom, nX, 0x2000);
      }
      return;
    default:
      COLLISION_SetCrossPatternMask113c(m, nY, pRoom, nX, wMask);
      return;
  }
}

/**
 * `@va D2Common:0x6FD9CE00` (`D2Common.#10573` `COLLISION_CheckMaskWithPattern1_113c`,
 * `__stdcall(pRoom, nX, nY, nCollisionPattern, wMask) -> uint16`, `ret 0x14`).
 */
export function COLLISION_CheckMaskWithPattern1_113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  nCollisionPattern: number,
  wMask: number,
): number {
  const pat = nCollisionPattern >>> 0;
  if (pat === 0 || pat === 1) {
    return COLLISION_CheckSubtileMaskInRoomFast113c(m, pRoom, nY, nX, wMask) & 0xffff;
  }
  if (pat === 2) {
    return COLLISION_GetCrossPatternMask113c(m, pRoom, nX, nY, wMask) & 0xffff;
  }
  if (pat === 3) {
    return COLLISION_GetMask3x3_113c(m, pRoom, nX, nY, wMask) & 0xffff;
  }
  return 0xffff;
}

/**
 * `@va D2Common:0x6FD9CE90` (`D2Common.#10851` `COLLISION_CheckMaskWithPattern2_113c`,
 * `__stdcall(pRoom, nX, nY, nCollisionPattern, wMask) -> uint32`, `ret 0x14`).
 */
export function COLLISION_CheckMaskWithPattern2_113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  nCollisionPattern: number,
  wMask: number,
): number {
  const pat = nCollisionPattern >>> 0;
  if (pat === 0) {
    return COLLISION_CheckSubtileMaskInRoomFast113c(m, pRoom, nY, nX, wMask) & 0xffff;
  }
  if (pat === 1 || pat === 3 || pat === 5) {
    return COLLISION_CheckCrossPatternCollision113c(m, nX, wMask, pRoom, nY) >>> 0;
  }
  if (pat === 2 || pat === 4) {
    const sm = withStackScratch113c(m);
    const x = nX | 0;
    const y = nY | 0;
    const box = STACK_SCRATCH_BASE + 0xac0;
    sm.setU32(box, ((x - 1) | 0) >>> 0);
    sm.setU32((box + 0x04) >>> 0, ((y - 1) | 0) >>> 0);
    sm.setU32((box + 0x08) >>> 0, ((x + 1) | 0) >>> 0);
    sm.setU32((box + 0x0c) >>> 0, ((y + 1) | 0) >>> 0);
    return COLLISION_CheckAnyCollisionWithBoxRecursively113c(sm, pRoom, box, wMask) >>> 0;
  }
  return 1;
}

/**
 * `@va D2Common:0x6FD9CF40` (`D2Common.#10001` `COLLISION_GetMaskWithPattern2_113c`,
 * `__stdcall(pRoom, nX, nY, nCollisionPattern, wMask) -> uint16`, `ret 0x14`).
 */
export function COLLISION_GetMaskWithPattern2_113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  nCollisionPattern: number,
  wMask: number,
): number {
  const pat = nCollisionPattern >>> 0;
  if (pat === 0) {
    return COLLISION_CheckSubtileMaskInRoomFast113c(m, pRoom, nY, nX, wMask) & 0xffff;
  }
  if (pat === 1 || pat === 3 || pat === 5) {
    return COLLISION_GetCrossPatternMask113c(m, pRoom, nX, nY, wMask) & 0xffff;
  }
  if (pat === 2 || pat === 4) {
    const sm = withStackScratch113c(m);
    const x = nX | 0;
    const y = nY | 0;
    const box = STACK_SCRATCH_BASE + 0xad0;
    sm.setU32(box, ((x - 1) | 0) >>> 0);
    sm.setU32((box + 0x04) >>> 0, ((y - 1) | 0) >>> 0);
    sm.setU32((box + 0x08) >>> 0, ((x + 1) | 0) >>> 0);
    sm.setU32((box + 0x0c) >>> 0, ((y + 1) | 0) >>> 0);
    return COLLISION_GetCombinedMaskForBoxRecursively113c(sm, pRoom, box, wMask) & 0xffff;
  }
  return 0xffff;
}

/**
 * `@va D2Common:0x6FD9D6E0` (`D2Common.#10166` `COLLISION_MoveUnitCollisionMask113c`,
 * `__fastcall(ecx=pRoom, edx=nOldX, [esp+4]=nOldY, [esp+8]=nNewX, [esp+0xC]=nNewY, [esp+0x10]=nCollisionPattern, [esp+0x14]=wFootprintMask, [esp+0x18]=wMoveTestMask) -> uint16`, `ret 0x18`).
 */
export function COLLISION_MoveUnitCollisionMask113c(
  m: Memory113c,
  pRoom: number,
  nOldX: number,
  nOldY: number,
  nNewX: number,
  nNewY: number,
  nCollisionPattern: number,
  wFootprintMask: number,
  wMoveTestMask: number,
): number {
  COLLISION_ResetMaskWithPattern113c(m, pRoom, nOldX, nOldY, nCollisionPattern, wFootprintMask);
  const hit =
    COLLISION_GetMaskWithPattern2_113c(m, pRoom, nNewX, nNewY, nCollisionPattern, wMoveTestMask) &
    0xffff;
  if (hit === 0) {
    COLLISION_SetUnitCollisionMaskWithPattern113c(
      m,
      pRoom,
      nNewX,
      nNewY,
      nCollisionPattern,
      wFootprintMask,
    );
  } else {
    COLLISION_SetUnitCollisionMaskWithPattern113c(
      m,
      pRoom,
      nOldX,
      nOldY,
      nCollisionPattern,
      wFootprintMask,
    );
  }
  return hit;
}

/**
 * `@va D2Common:0x6FD5DF30` (`COLLISION_MoveUnitToRoomAndCoord113c`, not exported;
 * custom LTCG `eax = pDynamicPath`, `[esp+4] = pRoom`, `[esp+8] = packedXY`, `ret 8 -> BOOL`).
 */
export function COLLISION_MoveUnitToRoomAndCoord113c(
  m: Memory113c,
  pDynamicPath: number,
  pRoom: number,
  packedXY: number,
): number {
  const path = pDynamicPath >>> 0;
  const room = pRoom >>> 0;
  const packed = packedXY >>> 0;
  const wX = packed & 0xffff;
  const wY = (packed >>> 16) & 0xffff;
  const pUnit = m.u32((path + 0x30) >>> 0);

  if (pUnit !== 0 && m.u32(pUnit) === 3) {
    if (wX === 0 && wY === 0) {
      COLLISION_ResetMaskWithPatternSimple113c(
        m,
        m.u32((path + 0x1c) >>> 0),
        m.u16((path + 0x02) >>> 0),
        m.u16((path + 0x06) >>> 0),
        m.u32((path + 0x44) >>> 0) | 0,
        m.u32((path + 0x4c) >>> 0) & 0xffff,
      );
      m.setU16((path + 0x54) >>> 0, 0);
    } else {
      const oldX = m.u16((path + 0x02) >>> 0);
      const oldY = m.u16((path + 0x06) >>> 0);
      const curFlags = m.u32((path + 0x34) >>> 0);
      if (oldX === wX && oldY === wY) {
        m.setU32((path + 0x34) >>> 0, (curFlags & ~0x08) >>> 0);
      } else {
        m.setU32((path + 0x34) >>> 0, (curFlags | 0x08) >>> 0);
      }
      const dwUnitSize = m.u32((path + 0x44) >>> 0) | 0;
      const nFootprintMask = m.u32((path + 0x4c) >>> 0) & 0xffff;
      const nMoveTestMask = m.u32((path + 0x50) >>> 0) & 0xffff;
      const pOldRoom = m.u32((path + 0x1c) >>> 0);
      if (pOldRoom !== 0) {
        COLLISION_ResetMaskWithPatternSimple113c(
          m,
          pOldRoom,
          oldX,
          oldY,
          dwUnitSize,
          nFootprintMask,
        );
      }
      const mask =
        COLLISION_CheckMaskWithPattern1_113c(m, room, wX, wY, dwUnitSize, nMoveTestMask) &
        0xffff;
      COLLISION_SetMaskWithPattern113c(m, room, wX, wY, dwUnitSize, nFootprintMask);
      m.setU16((path + 0x54) >>> 0, mask);
      m.setU32((path + 0x1d4) >>> 0, 1);
      m.setU32((path + 0x1d8) >>> 0, packed);
    }
  } else {
    const oldX = m.u16((path + 0x02) >>> 0);
    const oldY = m.u16((path + 0x06) >>> 0);
    const dwCollPattern = m.u32((path + 0x48) >>> 0) | 0;
    const nFootprintMask = m.u32((path + 0x4c) >>> 0) & 0xffff;
    if (wX === 0 && wY === 0) {
      COLLISION_ResetMaskWithPattern113c(
        m,
        m.u32((path + 0x1c) >>> 0),
        oldX,
        oldY,
        dwCollPattern,
        nFootprintMask,
      );
    } else {
      const pOldRoom = m.u32((path + 0x1c) >>> 0);
      if (pOldRoom !== 0) {
        COLLISION_ResetMaskWithPattern113c(
          m,
          pOldRoom,
          oldX,
          oldY,
          dwCollPattern,
          nFootprintMask,
        );
        COLLISION_SetUnitCollisionMaskWithPattern113c(
          m,
          room,
          wX,
          wY,
          dwCollPattern,
          nFootprintMask,
        );
      }
    }
  }

  if (m.u32((path + 0x1c) >>> 0) !== room) {
    m.setU32((path + 0x34) >>> 0, (m.u32((path + 0x34) >>> 0) | 0x01) >>> 0);
  }
  PATH_SetPrecisionPosAndRecacheRoom113c(
    m,
    path,
    (((wX << 16) + 0x8000) | 0) >>> 0,
    (((wY << 16) + 0x8000) | 0) >>> 0,
    room,
  );
  if (wX !== 0 || wY !== 0) {
    if (DUNGEON_GetRoomAtPosition113c(m, room, wX, wY) === 0) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\PATH\\Path.cpp', 1161);
    }
  }
  PATH_StopMovementAndSnapToTileCenter113c(m, path);
  return 1;
}

/**
 * `@va D2Common:0x6FD9D010` (`COLLISION_AllocAndBuildRoomGrid113c`, not exported;
 * `__stdcall(pMemPool, pRoom) -> void`, `ret 8`).
 */
export function COLLISION_AllocAndBuildRoomGrid113c(
  m: Memory113c,
  _pMemPool: number,
  pRoom: number,
): void {
  const room = pRoom >>> 0;
  if (room === 0) {
    return;
  }
  const sm = withStackScratch113c(m);
  const coords = (STACK_SCRATCH_BASE + 0xb00) >>> 0;
  DUNGEON_GetRoomCoordinates113c(sm, room, coords);

  const subtileW = sm.u32((coords + 0x08) >>> 0) | 0;
  const subtileH = sm.u32((coords + 0x0c) >>> 0) | 0;
  const cellCount = imul32(subtileW, subtileH);
  const allocSize = (((cellCount + subtileH * 2 + 0x12) | 0) << 1) >>> 0;
  const pGrid = sm.alloc(allocSize) >>> 0;

  for (let i = 0; i < 8; i++) {
    sm.setU32((pGrid + i * 4) >>> 0, sm.u32((coords + i * 4) >>> 0));
  }
  sm.setU32((room + 0x20) >>> 0, pGrid);
  const pMapStart = (pGrid + 0x24) >>> 0;
  sm.setU32((pGrid + 0x20) >>> 0, pMapStart);
  sm.fill(pMapStart, (cellCount << 1) >>> 0, 0);

  const nRoomsNear = sm.u32((room + 0x24) >>> 0) | 0;
  const ppRoomsNear = sm.u32(room);
  for (let i = 0; i < nRoomsNear; i++) {
    const pNear0 = sm.u32((ppRoomsNear + i * 4) >>> 0);
    if (pNear0 === 0) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\COLLISN\\Collisn.cpp', 709);
    }
    const pTileGrid0 = sm.u32((pNear0 + 0x08) >>> 0);
    const pNearCoords = sm.u32((pNear0 + 0x20) >>> 0);
    const pFloors = pTileGrid0 !== 0 ? sm.u32((pTileGrid0 + 0x08) >>> 0) : 0;
    const nFloors = pTileGrid0 !== 0 ? (sm.u32((pTileGrid0 + 0x0c) >>> 0) | 0) : 0;
    COLLISION_StampRoomTileGridToCollGrid113c(sm, pFloors, pGrid, pNearCoords, nFloors, 0);

    const pNear1 = sm.u32((ppRoomsNear + i * 4) >>> 0);
    if (pNear1 === 0) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\COLLISN\\Collisn.cpp', 177);
    }
    const pTileGrid1 = sm.u32((pNear1 + 0x08) >>> 0);
    COLLISION_StampRoomTileGridToCollGrid113c(
      sm,
      sm.u32(pTileGrid1),
      pGrid,
      pNearCoords,
      sm.u32((pTileGrid1 + 0x04) >>> 0) | 0,
      0,
    );

    const pNear2 = sm.u32((ppRoomsNear + i * 4) >>> 0);
    if (pNear2 === 0) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\COLLISN\\Collisn.cpp', 190);
    }
    const pTileGrid2 = sm.u32((pNear2 + 0x08) >>> 0);
    COLLISION_StampRoomTileGridToCollGrid113c(
      sm,
      sm.u32((pTileGrid2 + 0x10) >>> 0),
      pGrid,
      pNearCoords,
      sm.u32((pTileGrid2 + 0x14) >>> 0) | 0,
      0,
    );
  }
}

/**
 * `@va D2Common:0x6FD9D140` (`COLLISION_FindFreePosition113c`, not exported;
 * `__stdcall(pRoom, pOutCoords, pFieldBoxCoords, nUnitSize, wMask, wFieldMask, bAllowFallback, nMaxRadius, nStep) -> pRoom`, `ret 0x24`).
 */
export function COLLISION_FindFreePosition113c(
  m: Memory113c,
  pRoom: number,
  pOutCoords: number,
  pFieldBoxCoords: number,
  nUnitSize: number,
  wMask: number,
  wFieldMask: number,
  bAllowFallback: number,
  nMaxRadius: number,
  nStep: number,
): number {
  const outCoords = pOutCoords >>> 0;
  if (outCoords === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\COLLISN\\Collisn.cpp', 1830);
  }
  const x0 = m.u32(outCoords) | 0;
  const y0 = m.u32((outCoords + 4) >>> 0) | 0;
  const fieldBox = pFieldBoxCoords >>> 0;
  let pField = 0;
  if (fieldBox !== 0) {
    pField = FIELD_AllocField113c(m) >>> 0;
    if (pField === 0) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\COLLISN\\Collisn.cpp', 1840);
    }
    COLLISION_InitBoundingBox113c(
      m,
      pField,
      m.u32(fieldBox) | 0,
      m.u32((fieldBox + 4) >>> 0) | 0,
    );
  }

  const unitSize = nUnitSize | 0;
  const mask16 = wMask & 0xffff;
  const fieldMask16 = wFieldMask & 0xffff;
  let pHintRoom = DUNGEON_GetRoomAtPosition113c(m, pRoom >>> 0, x0, y0) >>> 0;
  if (
    pHintRoom !== 0 &&
    (COLLISION_CheckMaskWithPattern1_113c(m, pHintRoom, x0, y0, unitSize, mask16) & 0xffff) === 0
  ) {
    if (
      fieldBox === 0 ||
      COLLISION_TraceFieldCollision113c(m, pField, pHintRoom, x0, y0, fieldMask16) === 0
    ) {
      if (pField !== 0) {
        FIELD_FreeField113c(m, pField);
      }
      return pHintRoom;
    }
  }

  let bestDist = -1;
  const maxRadius = nMaxRadius | 0;
  const step = nStep | 0;
  if (maxRadius > 1) {
    let xMin = x0;
    let xMax = x0;
    let yMin = (y0 - 1) | 0;
    let yMax = (y0 + 1) | 0;
    let xStep = 2;

    while (true) {
      bestDist = -1;
      for (let cy = yMin; cy <= yMax; cy = (cy + step) | 0) {
        const xStart = (xMin - 1) | 0;
        const xEnd = (xMax + 1) | 0;
        const dy = (cy - y0) | 0;
        const absDy = dy >= 0 ? dy : (-dy) | 0;
        for (let cx = xStart; cx <= xEnd; cx = (cx + xStep) | 0) {
          const pCand = DUNGEON_GetRoomAtPosition113c(m, pHintRoom, cx, cy) >>> 0;
          if (pCand !== 0) {
            pHintRoom = pCand;
            if (
              (COLLISION_CheckMaskWithPattern1_113c(m, pCand, cx, cy, unitSize, mask16) &
                0xffff) ===
              0
            ) {
              if (
                fieldBox === 0 ||
                COLLISION_TraceFieldCollision113c(m, pField, pCand, cx, cy, fieldMask16) === 0
              ) {
                const dx = (cx - x0) | 0;
                const absDx = dx >= 0 ? dx : (-dx) | 0;
                const dist = (absDx + absDy) | 0;
                if (bestDist === -1 || dist < bestDist) {
                  m.setU32(outCoords, cx >>> 0);
                  m.setU32((outCoords + 4) >>> 0, cy >>> 0);
                  bestDist = dist;
                }
              }
            }
          }
        }
      }

      for (let cx = xMin; cx <= xMax; cx = (cx + step) | 0) {
        const dx = (cx - x0) | 0;
        const absDx = dx >= 0 ? dx : (-dx) | 0;
        for (let cy = yMin; cy <= yMax; cy = (cy + xStep) | 0) {
          const pCand = DUNGEON_GetRoomAtPosition113c(m, pHintRoom, cx, cy) >>> 0;
          if (pCand !== 0) {
            pHintRoom = pCand;
            if (
              (COLLISION_CheckMaskWithPattern1_113c(m, pCand, cx, cy, unitSize, mask16) &
                0xffff) ===
              0
            ) {
              if (
                fieldBox === 0 ||
                COLLISION_TraceFieldCollision113c(m, pField, pCand, cx, cy, fieldMask16) === 0
              ) {
                const dy = (cy - y0) | 0;
                const absDy = dy >= 0 ? dy : (-dy) | 0;
                const dist = (absDx + absDy) | 0;
                if (bestDist === -1 || dist < bestDist) {
                  m.setU32(outCoords, cx >>> 0);
                  m.setU32((outCoords + 4) >>> 0, cy >>> 0);
                  bestDist = dist;
                }
              }
            }
          }
        }
      }

      if (bestDist !== -1) {
        break;
      }
      yMax = (yMax + step) | 0;
      xStep = (xStep + step * 2) | 0;
      xMax = (xMax + step) | 0;
      xMin = (xMin - step) | 0;
      yMin = (yMin - step) | 0;
      if (((1 - x0 + xMax) | 0) >= maxRadius) {
        break;
      }
    }
  }

  if (pField !== 0) {
    FIELD_FreeField113c(m, pField);
  }
  if (bestDist !== -1 || (bAllowFallback | 0) !== 0) {
    return (
      DUNGEON_GetRoomAtPosition113c(
        m,
        pHintRoom,
        m.u32(outCoords) | 0,
        m.u32((outCoords + 4) >>> 0) | 0,
      ) >>> 0
    );
  }
  return 0;
}

/**
 * `@va D2Common:0x6FD9D7E0` (`D2Common.#10654` `COLLISION_FindFreePositionBasic113c`,
 * `__stdcall(pRoom, pOutCoords, pFieldBoxCoords, nUnitSize, wMask, wFieldMask, bAllowFallback) -> pRoom`, `ret 0x1C`).
 */
export function COLLISION_FindFreePositionBasic113c(
  m: Memory113c,
  pRoom: number,
  pOutCoords: number,
  pFieldBoxCoords: number,
  nUnitSize: number,
  wMask: number,
  wFieldMask: number,
  bAllowFallback: number,
): number {
  return (
    COLLISION_FindFreePosition113c(
      m,
      pRoom,
      pOutCoords,
      pFieldBoxCoords,
      nUnitSize,
      wMask,
      wFieldMask,
      bAllowFallback,
      50,
      1,
    ) >>> 0
  );
}

/**
 * `@va D2Common:0x6FD9D810` (`D2Common.#11049` `COLLISION_FindFreePositionWithStep113c`,
 * `__stdcall(pRoom, pOutCoords, nUnitSize, wMask, nStep) -> pRoom`, `ret 0x14`).
 */
export function COLLISION_FindFreePositionWithStep113c(
  m: Memory113c,
  pRoom: number,
  pOutCoords: number,
  nUnitSize: number,
  wMask: number,
  nStep: number,
): number {
  return (
    COLLISION_FindFreePosition113c(
      m,
      pRoom,
      pOutCoords,
      0,
      nUnitSize,
      wMask,
      wMask,
      0,
      50,
      nStep,
    ) >>> 0
  );
}

/**
 * `@va D2Common:0x6FD9D840` (`D2Common.#10509` `COLLISION_FindFreePositionSimple113c`,
 * `__stdcall(pRoom, pOutCoords, nUnitSize, wMask, bAllowFallback) -> pRoom`, `ret 0x14`).
 */
export function COLLISION_FindFreePositionSimple113c(
  m: Memory113c,
  pRoom: number,
  pOutCoords: number,
  nUnitSize: number,
  wMask: number,
  bAllowFallback: number,
): number {
  return (
    COLLISION_FindFreePosition113c(
      m,
      pRoom,
      pOutCoords,
      0,
      nUnitSize,
      wMask,
      wMask,
      bAllowFallback,
      50,
      1,
    ) >>> 0
  );
}

/**
 * `@va D2Common:0x6FDCF6A0` (`D2Common.#10389` `COLLISION_FindAdjacentUnitWithCallback113c`,
 * `__stdcall(pRoom, nX, nY, pfnCallback, pContext, nRangeType) -> pUnit`, `ret 0x18`).
 */
export function COLLISION_FindAdjacentUnitWithCallback113c(
  m: Memory113c,
  pRoom: number,
  nX: number,
  nY: number,
  pfnCallback: number,
  pContext: number,
  nRangeType: number,
  onUnit?: (m: Memory113c, pUnit: number, pContext: number) => number,
): number {
  const room = pRoom >>> 0;
  const rangeType = nRangeType | 0;
  if (room === 0 || rangeType <= 0 || rangeType >= 4) {
    return 0;
  }
  const x = nX | 0;
  const y = nY | 0;
  const rangeBase = (rangeType * 3 - 3) | 0;

  const sm = withStackScratch113c(m);
  const pppRoomsNear = (STACK_SCRATCH_BASE + 0xb20) >>> 0;
  const pnRoomsNear = (STACK_SCRATCH_BASE + 0xb24) >>> 0;
  DUNGEON_GetAdjacentRoomsListFromRoom113c(sm, room, pppRoomsNear, pnRoomsNear);

  const nRoomsNear = sm.u32(pnRoomsNear) | 0;
  const ppRoomsNear = sm.u32(pppRoomsNear);
  for (let i = 0; i < nRoomsNear; i++) {
    const pAdjRoom = sm.u32((ppRoomsNear + i * 4) >>> 0);
    if (COLLISION_IsPointWithinRoomMargin113c(sm, y, pAdjRoom, x, 2) === 0) {
      continue;
    }
    let pUnit = sm.u32((pAdjRoom + 0x74) >>> 0);
    while (pUnit !== 0) {
      const dwUnitType = sm.u32(pUnit) >>> 0;
      let skip = false;
      if (dwUnitType === 0) {
        const animMode = sm.u32((pUnit + 0x10) >>> 0) >>> 0;
        if (animMode === 0 || animMode === 17) skip = true;
      } else if (dwUnitType === 1) {
        const animMode = sm.u32((pUnit + 0x10) >>> 0) >>> 0;
        if (animMode === 0 || animMode === 12) skip = true;
      } else if (dwUnitType !== 3) {
        skip = true;
      }

      if (!skip) {
        let clampedSize = UNITS_GetUnitSizeX113c(sm, pUnit) | 0;
        if (clampedSize >= 3) {
          clampedSize = 3;
        }
        if (clampedSize > 0) {
          const pPath = sm.u32((pUnit + 0x2c) >>> 0);
          const isStatic = dwUnitType === 2 || (dwUnitType > 3 && dwUnitType <= 5);
          const ux = isStatic
            ? (sm.u32((pPath + 0x0c) >>> 0) | 0)
            : pPath !== 0
              ? sm.u16((pPath + 0x02) >>> 0)
              : 0;
          const uy = isStatic
            ? (sm.u32((pPath + 0x10) >>> 0) | 0)
            : pPath !== 0
              ? sm.u16((pPath + 0x06) >>> 0)
              : 0;

          const rangeIdx = (clampedSize + rangeBase - 1) >>> 0;
          let inRange = false;
          if (rangeIdx === 0) {
            inRange = x === ux && y === uy;
          } else if (rangeIdx === 1 || rangeIdx === 3) {
            const dx = (x - ux) | 0;
            const dy = (y - uy) | 0;
            inRange = (((dx >= 0 ? dx : -dx) + (dy >= 0 ? dy : -dy)) | 0) <= 1;
          } else if (rangeIdx === 4) {
            const dx = (x - ux) | 0;
            const dy = (y - uy) | 0;
            inRange = (((dx >= 0 ? dx : -dx) + (dy >= 0 ? dy : -dy)) | 0) <= 2;
          } else if (rangeIdx === 2 || rangeIdx === 6) {
            inRange = x >= ux - 1 && x <= ux + 1 && y >= uy - 1 && y <= uy + 1;
          } else if (rangeIdx === 5 || rangeIdx === 7) {
            const dx = (x - ux) | 0;
            const dy = (y - uy) | 0;
            const absDx = dx >= 0 ? dx : -dx;
            const absDy = dy >= 0 ? dy : -dy;
            inRange = (absDx <= 2 && absDy <= 1) || (absDy <= 2 && absDx <= 1);
          } else if (rangeIdx === 8) {
            inRange = x >= ux - 2 && x <= ux + 2 && y >= uy - 2 && y <= uy + 2;
          }

          if (inRange) {
            void pfnCallback;
            if (
              onUnit !== undefined &&
              (onUnit(sm, pUnit, pContext >>> 0) | 0) !== 0
            ) {
              return pUnit >>> 0;
            }
          }
        }
      }
      pUnit = sm.u32((pUnit + 0xe8) >>> 0);
    }
  }
  return 0;
}

