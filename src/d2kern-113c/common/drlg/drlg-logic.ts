/**
 * Diablo II v1.13c `D2Common.dll` room logical coordinate grid and flood-fill helpers (`Drlg\DrlgLogic.cpp`),
 * image base `0x6FD50000`.
 *
 * Every function below is a 1:1 port of the cited disassembly (`objdump -d -M intel` on `D2Common.dll`).
 */
import {
  D2DrlgGridStrc,
  D2DrlgLevelStrc,
  D2DrlgTileDataStrc,
  D2DrlgTileGridStrc,
  D2DrlgTileLinkStrc,
  D2RoomCoordListStrc,
  D2RoomExStrc,
  D2RoomLogicalInfoStrc,
} from '../../mem/layout.generated.ts';
import type { Memory113c } from '../../mem/sparse-memory.ts';
import { D2CommonAssertError } from '../inline-helpers.ts';
import { sdiv32 } from '../int-math.ts';
import {
  DRLGGRID_AllocAndInitGridCells113c,
  DRLGGRID_OpOverwrite113c,
} from './drlg-grid.ts';

const DRLGLOGIC_STACK_BASE = 0x7ffa0000;
const DRLGLOGIC_STACK_SIZE = 0x10000;
const _drlgLogicStackBuf = new ArrayBuffer(DRLGLOGIC_STACK_SIZE);
const _drlgLogicStackU8 = new Uint8Array(_drlgLogicStackBuf);
const _drlgLogicStackDV = new DataView(_drlgLogicStackBuf);

function withDrlgLogicStackScratch113c(m: Memory113c): Memory113c {
  const isStack = (p: number): boolean => {
    const u = p >>> 0;
    return u >= DRLGLOGIC_STACK_BASE && u < DRLGLOGIC_STACK_BASE + DRLGLOGIC_STACK_SIZE;
  };
  const self: Memory113c = {
    alloc: size => m.alloc(size),
    u8: p => (isStack(p) ? _drlgLogicStackU8[(p >>> 0) - DRLGLOGIC_STACK_BASE]! : m.u8(p)),
    u16: p => (isStack(p) ? _drlgLogicStackDV.getUint16((p >>> 0) - DRLGLOGIC_STACK_BASE, true) : m.u16(p)),
    u32: p => (isStack(p) ? _drlgLogicStackDV.getUint32((p >>> 0) - DRLGLOGIC_STACK_BASE, true) : m.u32(p)),
    setU8: (p, v) => {
      if (isStack(p)) _drlgLogicStackU8[(p >>> 0) - DRLGLOGIC_STACK_BASE] = v & 0xff;
      else m.setU8(p, v);
    },
    setU16: (p, v) => {
      if (isStack(p)) _drlgLogicStackDV.setUint16((p >>> 0) - DRLGLOGIC_STACK_BASE, v & 0xffff, true);
      else m.setU16(p, v);
    },
    setU32: (p, v) => {
      if (isStack(p)) _drlgLogicStackDV.setUint32((p >>> 0) - DRLGLOGIC_STACK_BASE, v >>> 0, true);
      else m.setU32(p, v);
    },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      const p = ((base >>> 0) + f.off + idx * width) >>> 0;
      return width === 1 ? self.u8(p) : width === 2 ? self.u16(p) : self.u32(p);
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      const p = ((base >>> 0) + f.off + idx * width) >>> 0;
      if (width === 1) self.setU8(p, v);
      else if (width === 2) self.setU16(p, v);
      else self.setU32(p, v);
    },
    fill: (p, len, v) => {
      if (isStack(p)) {
        const off = (p >>> 0) - DRLGLOGIC_STACK_BASE;
        _drlgLogicStackU8.fill(v & 0xff, off, off + len);
      } else {
        m.fill(p, len, v);
      }
    },
  };
  return self;
}

/**
 * Wall style group lookup table at `0x6FDDA758` (`int32[15]`, 60 bytes: `0x6FDDA758 .. 0x6FDDA793`).
 * Maps wall tile style (`0..14`) to flood-fill group (`-1..4`).
 * Copied verbatim from `D2Common.dll` v1.13c.
 */
export const WALL_STYLE_GROUP_TABLE_6FDDA758 = Int32Array.from([
  -1, 0, 1, 2, 2, 0, 1, 3, 0, 1, 0, 1, 4, -1, 4,
]);

/**
 * Wall flood-fill action bitmask table at `0x6FDDA794` (`uint32[30]`, 120 bytes: `0x6FDDA794 .. 0x6FDDA80B`),
 * indexed in the binary as `*(uint32*)(0x6FDDA7AC + (group * 5 + nFromDir) * 4)` for `group in -1..4` and `nFromDir in -1..3`
 * (i.e. `index = (group + 1) * 5 + (nFromDir + 1) = group * 5 + nFromDir + 6`).
 * Copied verbatim from `D2Common.dll` v1.13c.
 */
export const WALL_FLOOD_ACTION_TABLE_6FDDA794 = Uint32Array.from([
  /* group -1 (0x6FDDA794): */ 0x00, 0x00, 0x00, 0x00, 0x00,
  /* group  0 (0x6FDDA7A8): */ 0x17, 0x00, 0x05, 0x15, 0x11,
  /* group  1 (0x6FDDA7BC): */ 0x0f, 0x03, 0x00, 0x09, 0x07,
  /* group  2 (0x6FDDA7D0): */ 0x27, 0x00, 0x00, 0x05, 0x03,
  /* group  3 (0x6FDDA7E4): */ 0x1f, 0x1f, 0x1f, 0x1f, 0x1f,
  /* group  4 (0x6FDDA7F8): */ 0x1f, 0x1f, 0x1f, 0x1f, 0x1f,
]);

/**
 * 4-connected step delta table `(dx, dy)` at `0x6FDDA80C` (`int32[8]`, 32 bytes: `0x6FDDA80C .. 0x6FDDA82B`).
 * Copied verbatim from `D2Common.dll` v1.13c.
 */
export const FLOOD_DIR_DELTAS_6FDDA80C = Int32Array.from([
  1, 0,
  0, 1,
  -1, 0,
  0, -1,
]);

/**
 * `@va D2Common:0x6FDD0EE0` (`DRLGLOGIC_ReplaceRoomCoordListIndex113c`, `__fastcall(pRoomEx, nOldIdx, nNewIdx, bNodeFlag)`, `ret 8`).
 *
 * If `pRoomEx->pLogicalRoomInfo (+0x64)` is non-NULL and `(pLogicalRoomInfo->dwFlags & 1) == 0`, walks
 * `pLogicalRoomInfo->pCoordList (+0x30)` via `D2RoomCoordListStrc.pNext (+0x2C)` replacing every node where
 * `nIndex (+0x28) == nOldIdx` with `nNewIdx`. If at least one node matched, recurses onto adjacent rooms
 * `pRoomEx->ppRoomsNear[i]` (`0 <= i < pRoomEx->nRoomsNear`) belonging to the same `pLevel->nLevelId (+0x1D0)`.
 */
export function DRLGLOGIC_ReplaceRoomCoordListIndex113c(
  m: Memory113c,
  pRoomEx: number,
  nOldIdx: number,
  nNewIdx: number,
  bNodeFlag: number,
): void {
  const roomEx = pRoomEx >>> 0;
  const pLogical = m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo);
  if (pLogical === 0) return;
  if ((m.get(pLogical, D2RoomLogicalInfoStrc.dwFlags) & 1) !== 0) return;

  let pCoord = m.get(pLogical, D2RoomLogicalInfoStrc.pCoordList);
  if (pCoord === 0) return;

  const oldIdx = nOldIdx | 0;
  const newIdx = nNewIdx >>> 0;
  let found = 0;

  while (pCoord !== 0) {
    if ((m.get(pCoord, D2RoomCoordListStrc.nIndex) | 0) === oldIdx) {
      found = 1;
      m.set(pCoord, D2RoomCoordListStrc.nIndex, newIdx);
    }
    pCoord = m.get(pCoord, D2RoomCoordListStrc.pNext);
  }

  if (found === 0) return;

  const nNear = m.get(roomEx, D2RoomExStrc.nRoomsNear) | 0;
  if (nNear <= 0) return;

  for (let i = 0; i < nNear; i++) {
    const ppRoomsNear = m.get(roomEx, D2RoomExStrc.ppRoomsNear);
    const pNear = m.u32((ppRoomsNear + i * 4) >>> 0);
    if (pNear !== roomEx) {
      const pNearLevel = m.get(pNear, D2RoomExStrc.pLevel);
      const pSelfLevel = m.get(roomEx, D2RoomExStrc.pLevel);
      if (
        m.get(pNearLevel, D2DrlgLevelStrc.nLevelId) ===
        m.get(pSelfLevel, D2DrlgLevelStrc.nLevelId)
      ) {
        DRLGLOGIC_ReplaceRoomCoordListIndex113c(
          m,
          pNear,
          oldIdx,
          newIdx,
          bNodeFlag,
        );
      }
    }
  }
}

/**
 * `@va D2Common:0x6FDD14C0` (`DRLGLOGIC_MarkWallTileCells113c`, custom `edi = pRoomEx`, `[esp+4] = pGrid`, `ret 4`).
 *
 * Marks wall cells (`gafGridCellOps[0]` `OpOr` with `0x1`) in `pGrid` from `pRoomEx->pTileGrid->pWalls` (`+0x14`, count `+0x18`)
 * and from adjacent rooms' `pTileGrid->pMapLinks` (`bFloor == 0`) overlapping `pRoomEx`'s tile bounds
 * whenever `(dwFlags & 0x1C000) == 0x4000`, `nTileType != 15`, and `((~dwFlags >>> 11) & 1) != 0`.
 */
export function DRLGLOGIC_MarkWallTileCells113c(
  m: Memory113c,
  pRoomEx: number,
  pGrid: number,
): void {
  const roomEx = pRoomEx >>> 0;
  const grid = pGrid >>> 0;
  const pTileGrid = m.get(roomEx, D2RoomExStrc.pTileGrid);
  const pWallsSlot = (pTileGrid + 0x14) >>> 0;
  const nWallsInitial = m.u32((pTileGrid + 0x18) >>> 0);

  if (nWallsInitial > 0) {
    let idx = 0;
    let byteOff = 0;
    while (true) {
      const pWallsBase = m.u32(pWallsSlot);
      const pTile = (pWallsBase + byteOff) >>> 0;
      const dwFlags = m.get(pTile, D2DrlgTileDataStrc.dwFlags);
      if (
        (dwFlags & 0x1c000) === 0x4000 &&
        (m.get(pTile, D2DrlgTileDataStrc.nTileType) | 0) !== 0x0f &&
        ((~(dwFlags >>> 11)) & 1) !== 0
      ) {
        const y = m.get(pTile, D2DrlgTileDataStrc.nPosY) | 0;
        const x = m.get(pTile, D2DrlgTileDataStrc.nPosX) | 0;
        const pRowOffsets = m.get(grid, D2DrlgGridStrc.pRowOffsets);
        const rowOff = m.u32((pRowOffsets + y * 4) >>> 0) | 0;
        const pCells = m.get(grid, D2DrlgGridStrc.pCells);
        const pCell = (pCells + (((rowOff + x) | 0) << 2)) >>> 0;
        m.setU32(pCell, (m.u32(pCell) | 1) >>> 0);
      }
      const curCount = m.u32((pWallsSlot + 4) >>> 0);
      idx = (idx + 1) >>> 0;
      byteOff = (byteOff + 0x30) >>> 0;
      if (idx >= curCount) break;
    }
  }

  const nNearInitial = m.get(roomEx, D2RoomExStrc.nRoomsNear) >>> 0;
  if (nNearInitial > 0) {
    let i = 0;
    while (true) {
      const ppRoomsNear = m.get(roomEx, D2RoomExStrc.ppRoomsNear);
      const pNear = m.u32((ppRoomsNear + i * 4) >>> 0);
      if (pNear !== roomEx) {
        const pNearTileGrid = m.get(pNear, D2RoomExStrc.pTileGrid);
        if (pNearTileGrid !== 0) {
          let pLink = m.get(pNearTileGrid, D2DrlgTileGridStrc.pMapLinks);
          while (pLink !== 0) {
            if (m.get(pLink, D2DrlgTileLinkStrc.bFloor) === 0) {
              let pTile = m.get(pLink, D2DrlgTileLinkStrc.pTileData);
              while (pTile !== 0) {
                const dwFlags = m.get(pTile, D2DrlgTileDataStrc.dwFlags);
                if (
                  (dwFlags & 0x1c000) === 0x4000 &&
                  (m.get(pTile, D2DrlgTileDataStrc.nTileType) | 0) !== 0x0f &&
                  ((~(dwFlags >>> 11)) & 1) !== 0
                ) {
                  const worldY =
                    ((m.get(pNear, D2RoomExStrc.nTileYPos) | 0) +
                      (m.get(pTile, D2DrlgTileDataStrc.nPosY) | 0)) |
                    0;
                  const worldX =
                    ((m.get(pNear, D2RoomExStrc.nTileXPos) | 0) +
                      (m.get(pTile, D2DrlgTileDataStrc.nPosX) | 0)) |
                    0;
                  const selfX = m.get(roomEx, D2RoomExStrc.nTileXPos) | 0;
                  const selfY = m.get(roomEx, D2RoomExStrc.nTileYPos) | 0;
                  const selfW = m.get(roomEx, D2RoomExStrc.nTileWidth) | 0;
                  const selfH = m.get(roomEx, D2RoomExStrc.nTileHeight) | 0;
                  if (
                    worldX >= selfX &&
                    worldY >= selfY &&
                    worldX <= ((selfX + selfW) | 0) &&
                    worldY <= ((selfY + selfH) | 0)
                  ) {
                    const relY = (worldY - selfY) | 0;
                    const pRowOffsets = m.get(grid, D2DrlgGridStrc.pRowOffsets);
                    const rowOff = m.u32((pRowOffsets + relY * 4) >>> 0) | 0;
                    const cellIdx = ((rowOff - selfX + worldX) | 0) >>> 0;
                    const pCells = m.get(grid, D2DrlgGridStrc.pCells);
                    const pCell = (pCells + (cellIdx << 2)) >>> 0;
                    m.setU32(pCell, (m.u32(pCell) | 1) >>> 0);
                  }
                }
                pTile = m.get(pTile, D2DrlgTileDataStrc.pNext);
              }
            }
            pLink = m.get(pLink, D2DrlgTileLinkStrc.pNext);
          }
        }
      }
      i = (i + 1) >>> 0;
      const curNear = m.get(roomEx, D2RoomExStrc.nRoomsNear) >>> 0;
      if (i >= curNear) break;
    }
  }
}

/**
 * `@va D2Common:0x6FDD1650` (`DRLGLOGIC_MarkFloorTileCells113c`, custom `eax = pRoomEx`, `[esp+4] = pGrid`, `ret 4`).
 *
 * Iterates `pRoomEx->pTileGrid->pWalls` (`+0x14`, count at `+0x18`) and sets bit `0x8` (`OpOr` with `0x8`)
 * on `&pGrid[pTile->nPosY][pTile->nPosX]` whenever `(pTile->dwFlags & 0x04) != 0` and `(pTile->dwFlags & 0x1C000) == 0`.
 */
export function DRLGLOGIC_MarkFloorTileCells113c(
  m: Memory113c,
  pRoomEx: number,
  pGrid: number,
): void {
  const roomEx = pRoomEx >>> 0;
  const grid = pGrid >>> 0;
  const pTileGrid = m.get(roomEx, D2RoomExStrc.pTileGrid);
  const pWallsSlot = (pTileGrid + 0x14) >>> 0;
  const nCountInitial = m.u32((pTileGrid + 0x18) >>> 0);
  if (nCountInitial === 0) return;

  let idx = 0;
  let byteOff = 0;
  while (true) {
    const pBase = m.u32(pWallsSlot);
    const pTile = (pBase + byteOff) >>> 0;
    const dwFlags = m.get(pTile, D2DrlgTileDataStrc.dwFlags);
    if ((dwFlags & 0x04) !== 0 && (dwFlags & 0x1c000) === 0) {
      const y = m.get(pTile, D2DrlgTileDataStrc.nPosY) | 0;
      const x = m.get(pTile, D2DrlgTileDataStrc.nPosX) | 0;
      const pRowOffsets = m.get(grid, D2DrlgGridStrc.pRowOffsets);
      const rowOff = m.u32((pRowOffsets + y * 4) >>> 0) | 0;
      const pCells = m.get(grid, D2DrlgGridStrc.pCells);
      const pCell = (pCells + (((rowOff + x) | 0) << 2)) >>> 0;
      m.setU32(pCell, (m.u32(pCell) | 8) >>> 0);
    }
    const curCount = m.u32((pWallsSlot + 4) >>> 0);
    idx = (idx + 1) >>> 0;
    byteOff = (byteOff + 0x30) >>> 0;
    if (idx >= curCount) break;
  }
}

/**
 * `@va D2Common:0x6FDD17A0` (`DRLGLOGIC_FloodFillLogicalCoordGrid113c`, `__fastcall(pContext, nX, nY, nFromDir)`, `ret 8`).
 *
 * Recursive/tail-looping flood-fill over logical room grids:
 * - `pContext + 0x00` = `pRoomEx`
 * - `pContext + 0x04` = `pIndexGrid` (`D2DrlgGridStrc*`, visited cells marked with `0x10000000 | uFillValue`)
 * - `pContext + 0x08` = `pWallTypeGrid` (`D2DrlgGridStrc*`, optional)
 * - `pContext + 0x14` = `pWallFloorGrid` (`D2DrlgGridStrc*`)
 * - `pContext + 0x1C` = `uFillValue` (`uint32`)
 */
export function DRLGLOGIC_FloodFillLogicalCoordGrid113c(
  m: Memory113c,
  pContext: number,
  nX: number,
  nY: number,
  nFromDir: number,
): void {
  const ctx = pContext >>> 0;
  let curX = nX | 0;
  let curY = nY | 0;
  let fromDir = nFromDir | 0;

  while (true) {
    const pRoomEx = m.u32(ctx);
    const rx = m.get(pRoomEx, D2RoomExStrc.nTileXPos) | 0;
    const ry = m.get(pRoomEx, D2RoomExStrc.nTileYPos) | 0;
    const rw = m.get(pRoomEx, D2RoomExStrc.nTileWidth) | 0;
    const rh = m.get(pRoomEx, D2RoomExStrc.nTileHeight) | 0;
    const worldX = (rx + curX) | 0;
    const worldY = (ry + curY) | 0;
    if (
      worldX < rx ||
      worldY < ry ||
      worldX > ((rx + rw) | 0) ||
      worldY > ((ry + rh) | 0)
    ) {
      return;
    }

    const pIndexGrid = m.u32((ctx + 4) >>> 0);
    const pIndexRowOffsets = m.get(pIndexGrid, D2DrlgGridStrc.pRowOffsets);
    const idxRowOff = m.u32((pIndexRowOffsets + curY * 4) >>> 0) | 0;
    const pIndexCells = m.get(pIndexGrid, D2DrlgGridStrc.pCells);
    const pIndexCell = (pIndexCells + (((idxRowOff + curX) | 0) << 2)) >>> 0;
    if ((m.u32(pIndexCell) & 0x10000000) !== 0) {
      return;
    }

    const pWallFloorGrid = m.u32((ctx + 0x14) >>> 0);
    const pWfRowOffsets = m.get(pWallFloorGrid, D2DrlgGridStrc.pRowOffsets);
    const wfRowOff = m.u32((pWfRowOffsets + curY * 4) >>> 0) | 0;
    const pWfCells = m.get(pWallFloorGrid, D2DrlgGridStrc.pCells);
    const wfVal = m.u32((pWfCells + (((wfRowOff + curX) | 0) << 2)) >>> 0);

    if (wfVal === 0) {
      const uFillValue = m.u32((ctx + 0x1c) >>> 0);
      m.setU32(pIndexCell, (m.u32(pIndexCell) | uFillValue) >>> 0);
      for (let dir = 0; dir < 4; dir++) {
        const dx = FLOOD_DIR_DELTAS_6FDDA80C[dir * 2]!;
        const dy = FLOOD_DIR_DELTAS_6FDDA80C[dir * 2 + 1]!;
        DRLGLOGIC_FloodFillLogicalCoordGrid113c(
          m,
          ctx,
          (curX + dx) | 0,
          (curY + dy) | 0,
          dir,
        );
      }
      return;
    }

    const pWallTypeGrid = m.u32((ctx + 8) >>> 0);
    let style = 0;
    if (pWallTypeGrid !== 0) {
      const pWtCells = m.get(pWallTypeGrid, D2DrlgGridStrc.pCells);
      if (pWtCells !== 0) {
        const pWtRowOffsets = m.get(pWallTypeGrid, D2DrlgGridStrc.pRowOffsets);
        const wtRowOff = m.u32((pWtRowOffsets + curY * 4) >>> 0) | 0;
        style = m.u32((pWtCells + (((wtRowOff + curX) | 0) << 2)) >>> 0) | 0;
      }
    }

    const group = WALL_STYLE_GROUP_TABLE_6FDDA758[style]!;
    const actionIdx = (group * 5 + fromDir + 6) | 0;
    const actionMask = WALL_FLOOD_ACTION_TABLE_6FDDA794[actionIdx]!;

    if ((actionMask & 0x01) !== 0) {
      const uFillValue = m.u32((ctx + 0x1c) >>> 0);
      const curRowOff =
        m.u32(
          (m.get(pIndexGrid, D2DrlgGridStrc.pRowOffsets) + curY * 4) >>> 0,
        ) | 0;
      const pCell =
        (m.get(pIndexGrid, D2DrlgGridStrc.pCells) +
          (((curRowOff + curX) | 0) << 2)) >>>
        0;
      m.setU32(pCell, (m.u32(pCell) | uFillValue) >>> 0);
    }
    if ((actionMask & 0x02) !== 0 && fromDir !== 2) {
      DRLGLOGIC_FloodFillLogicalCoordGrid113c(
        m,
        ctx,
        (curX + 1) | 0,
        curY,
        0,
      );
    }
    if ((actionMask & 0x04) !== 0 && fromDir !== 3) {
      DRLGLOGIC_FloodFillLogicalCoordGrid113c(
        m,
        ctx,
        curX,
        (curY + 1) | 0,
        1,
      );
    }
    if ((actionMask & 0x08) !== 0 && fromDir !== 0) {
      DRLGLOGIC_FloodFillLogicalCoordGrid113c(
        m,
        ctx,
        (curX - 1) | 0,
        curY,
        2,
      );
    }
    if ((actionMask & 0x10) !== 0 && fromDir !== 1) {
      DRLGLOGIC_FloodFillLogicalCoordGrid113c(
        m,
        ctx,
        curX,
        (curY - 1) | 0,
        3,
      );
    }
    if ((actionMask & 0x20) === 0) {
      return;
    }
    curY = (curY + 1) | 0;
    curX = (curX + 1) | 0;
    fromDir = -1;
  }
}

/**
 * `@va D2Common:0x6FDD1A20` (`DRLGLOGIC_AssignTileDataCoordListPointers113c`, `__stdcall(pRoomEx)`, `ret 4`).
 *
 * Iterates `pRoomEx->pTileGrid->pWalls` (`+0x14`, count at `+0x18`) and sets `pTile->pRoomCoordList (+0x10)`
 * to `0` if `pRoomEx->pLogicalRoomInfo (+0x64)` is NULL or has bit `0x1` set on `dwFlags (+0x00)`, or else
 * to `pLogicalRoomInfo->pIndexCells[pLogicalRoomInfo->pIndexRowOffsets[nPosY] + nPosX]`.
 */
export function DRLGLOGIC_AssignTileDataCoordListPointers113c(
  m: Memory113c,
  pRoomEx: number,
): void {
  const roomEx = pRoomEx >>> 0;
  const pTileGrid = m.get(roomEx, D2RoomExStrc.pTileGrid);
  const pWallsSlot = (pTileGrid + 0x14) >>> 0;
  const nCountInitial = m.u32((pTileGrid + 0x18) >>> 0);
  if (nCountInitial === 0) return;

  let idx = 0;
  let byteOff = 0;
  while (true) {
    const pBase = m.u32(pWallsSlot);
    const pTile = (pBase + byteOff) >>> 0;
    const x = m.get(pTile, D2DrlgTileDataStrc.nPosX) | 0;
    const y = m.get(pTile, D2DrlgTileDataStrc.nPosY) | 0;
    const pLogical = m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo);

    if (pLogical === 0) {
      m.set(pTile, D2DrlgTileDataStrc.pRoomCoordList, 0);
    } else if ((m.get(pLogical, D2RoomLogicalInfoStrc.dwFlags) & 1) !== 0) {
      m.set(pTile, D2DrlgTileDataStrc.pRoomCoordList, 0);
    } else {
      const pRowOffsets = m.get(
        pLogical,
        D2RoomLogicalInfoStrc.pIndexRowOffsets,
      );
      const rowOff = m.u32((pRowOffsets + y * 4) >>> 0) | 0;
      const pCells = m.get(pLogical, D2RoomLogicalInfoStrc.pIndexCells);
      const pCoordList = m.u32((pCells + (((rowOff + x) | 0) << 2)) >>> 0);
      m.set(pTile, D2DrlgTileDataStrc.pRoomCoordList, pCoordList);
    }

    byteOff = (byteOff + 0x30) >>> 0;
    idx = (idx + 1) >>> 0;
    const curCount = m.u32((pWallsSlot + 4) >>> 0);
    if (idx >= curCount) break;
  }
}

/**
 * `@va D2Common:0x6FDD10A0` (`DRLGLOGIC_GetRoomCoordListAtSubtile113c`, custom `edx = pRoomEx`, `ecx = nTileY`, `[esp+4] = nTileX`, `ret 4`).
 *
 * Asserts `pRoomEx->pLogicalRoomInfo (+0x64) != 0` (line 668). If `(dwFlags & 1) != 0`, returns `pCoordList (+0x30)`;
 * otherwise returns `pIndexCells[pIndexRowOffsets[nTileY - nTileYPos] - nTileXPos + nTileX]`.
 */
export function DRLGLOGIC_GetRoomCoordListAtSubtile113c(
  m: Memory113c,
  pRoomEx: number,
  nTileY: number,
  nTileX: number,
): number {
  const roomEx = pRoomEx >>> 0;
  const pCoords = m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo);
  if (pCoords === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\DrlgLogic.cpp', 668);
  }
  if ((m.u8(pCoords) & 0x01) !== 0) {
    return m.get(pCoords, D2RoomLogicalInfoStrc.pCoordList);
  }
  const relY = ((nTileY | 0) - (m.get(roomEx, D2RoomExStrc.nTileYPos) | 0)) | 0;
  const pRowOffsets = m.get(pCoords, D2RoomLogicalInfoStrc.pIndexRowOffsets);
  const rowOff = m.u32((pRowOffsets + relY * 4) >>> 0) | 0;
  const cellIdx = (rowOff - (m.get(roomEx, D2RoomExStrc.nTileXPos) | 0) + (nTileX | 0)) | 0;
  const pCells = m.get(pCoords, D2RoomLogicalInfoStrc.pIndexCells);
  return m.u32((pCells + (cellIdx << 2)) >>> 0);
}

/**
 * `@va D2Common:0x6FDD1100` (`DRLGLOGIC_AllocSingleRoomCoordList113c`, custom `ebx = pRoomEx`, `ret`).
 *
 * Allocates a `0x34`-byte `D2RoomLogicalInfoStrc` at `pRoomEx->pLogicalRoomInfo (+0x64)` with `dwFlags |= 1`
 * and a single `0x30`-byte `D2RoomCoordListStrc` at `pCoordList (+0x30)` spanning the full room tile box.
 */
export function DRLGLOGIC_AllocSingleRoomCoordList113c(
  m: Memory113c,
  pRoomEx: number,
): void {
  const roomEx = pRoomEx >>> 0;
  const pLevel0 = m.get(roomEx, D2RoomExStrc.pLevel);
  const pDrlg0 = m.u32((pLevel0 + 0x1b4) >>> 0);
  void m.u32((pDrlg0 + 0x478) >>> 0);

  const pCoords = m.alloc(0x34);
  m.fill(pCoords, 0x34, 0);
  m.set(roomEx, D2RoomExStrc.pLogicalRoomInfo, pCoords);

  const pLogical = m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo);
  m.setU32(pLogical, (m.u32(pLogical) | 1) >>> 0);

  const pLevel1 = m.get(roomEx, D2RoomExStrc.pLevel);
  m.setU32((pLevel1 + 0x1dc) >>> 0, 1);

  const pLogical2 = m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo);
  m.setU32((pLogical2 + 0x04) >>> 0, 1);

  const pLogical3 = m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo);
  const nAllocCount = m.u32((pLogical3 + 0x04) >>> 0) | 0;
  const pLevel2 = m.get(roomEx, D2RoomExStrc.pLevel);
  const pDrlg2 = m.u32((pLevel2 + 0x1b4) >>> 0);
  void m.u32((pDrlg2 + 0x478) >>> 0);

  const pCoordList = m.alloc((Math.imul(nAllocCount, 0x30) | 0) >>> 0);
  m.set(pLogical3, D2RoomLogicalInfoStrc.pCoordList, pCoordList);

  const pLogical4 = m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo);
  const nZeroBytes = (Math.imul(m.u32((pLogical4 + 0x04) >>> 0) | 0, 0x30) | 0) >>> 0;
  const pListDest = m.get(pLogical4, D2RoomLogicalInfoStrc.pCoordList);
  m.fill(pListDest, nZeroBytes, 0);

  const pLevel3 = m.get(roomEx, D2RoomExStrc.pLevel);
  const pLogical5 = m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo);
  const pNode0 = m.get(pLogical5, D2RoomLogicalInfoStrc.pCoordList);
  m.set(pNode0, D2RoomCoordListStrc.nIndex, m.u32((pLevel3 + 0x1dc) >>> 0));

  const posY0 = m.get(roomEx, D2RoomExStrc.nTileYPos) | 0;
  const pNode1 = m.get(m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo), D2RoomLogicalInfoStrc.pCoordList);
  m.setU32((pNode1 + 0x04) >>> 0, posY0 >>> 0);

  const endY0 = ((m.get(roomEx, D2RoomExStrc.nTileYPos) | 0) + (m.get(roomEx, D2RoomExStrc.nTileHeight) | 0)) | 0;
  const pNode2 = m.get(m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo), D2RoomLogicalInfoStrc.pCoordList);
  m.setU32((pNode2 + 0x0c) >>> 0, endY0 >>> 0);

  const posX0 = m.get(roomEx, D2RoomExStrc.nTileXPos) | 0;
  const pNode3 = m.get(m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo), D2RoomLogicalInfoStrc.pCoordList);
  m.setU32(pNode3, posX0 >>> 0);

  const endX0 = ((m.get(roomEx, D2RoomExStrc.nTileWidth) | 0) + (m.get(roomEx, D2RoomExStrc.nTileXPos) | 0)) | 0;
  const pNode4 = m.get(m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo), D2RoomLogicalInfoStrc.pCoordList);
  m.setU32((pNode4 + 0x08) >>> 0, endX0 >>> 0);

  const posY1 = m.get(roomEx, D2RoomExStrc.nTileYPos) | 0;
  const pNode5 = m.get(m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo), D2RoomLogicalInfoStrc.pCoordList);
  m.setU32((pNode5 + 0x14) >>> 0, posY1 >>> 0);

  const endY1 = ((m.get(roomEx, D2RoomExStrc.nTileHeight) | 0) + (m.get(roomEx, D2RoomExStrc.nTileYPos) | 0)) | 0;
  const pNode6 = m.get(m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo), D2RoomLogicalInfoStrc.pCoordList);
  m.setU32((pNode6 + 0x1c) >>> 0, endY1 >>> 0);

  const posX1 = m.get(roomEx, D2RoomExStrc.nTileXPos) | 0;
  const pNode7 = m.get(m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo), D2RoomLogicalInfoStrc.pCoordList);
  m.setU32((pNode7 + 0x10) >>> 0, posX1 >>> 0);

  const endX1 = ((m.get(roomEx, D2RoomExStrc.nTileWidth) | 0) + (m.get(roomEx, D2RoomExStrc.nTileXPos) | 0)) | 0;
  const pNode8 = m.get(m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo), D2RoomLogicalInfoStrc.pCoordList);
  m.setU32((pNode8 + 0x18) >>> 0, endX1 >>> 0);
}

/**
 * `@va D2Common:0x6FDD1950` (`DRLGLOGIC_GetRoomCoordListFromWorldSubtile113c`, custom `esi = pRoomEx`,
 * `[esp+4] = nWorldSubtileX`, `[esp+8] = nWorldSubtileY`, `ret 8`).
 *
 * Converts `(nWorldSubtileX, nWorldSubtileY)` to tile coordinates via truncating signed division by `5`
 * and returns the `D2RoomCoordListStrc*` at that tile in `pRoomEx->pLogicalRoomInfo (+0x64)`.
 */
export function DRLGLOGIC_GetRoomCoordListFromWorldSubtile113c(
  m: Memory113c,
  pRoomEx: number,
  nWorldSubtileX: number,
  nWorldSubtileY: number,
): number {
  const roomEx = pRoomEx >>> 0;
  const pCoords = m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo);
  if (pCoords === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\DrlgLogic.cpp', 668);
  }
  if ((m.u8(pCoords) & 0x01) !== 0) {
    return m.get(pCoords, D2RoomLogicalInfoStrc.pCoordList);
  }
  const tileY = sdiv32(nWorldSubtileY | 0, 5);
  const relY = (tileY - (m.get(roomEx, D2RoomExStrc.nTileYPos) | 0)) | 0;
  const pRowOffsets = m.get(pCoords, D2RoomLogicalInfoStrc.pIndexRowOffsets);
  const rowOff = m.u32((pRowOffsets + relY * 4) >>> 0) | 0;
  const tileX = sdiv32(nWorldSubtileX | 0, 5);
  const cellIdx = (rowOff - (m.get(roomEx, D2RoomExStrc.nTileXPos) | 0) + tileX) | 0;
  const pCells = m.get(pCoords, D2RoomLogicalInfoStrc.pIndexCells);
  return m.u32((pCells + (cellIdx << 2)) >>> 0);
}

/**
 * `@va D2Common:0x6FDD19C0` (`DRLGLOGIC_GetRoomCoordListIndexAtSubtile113c`, custom `edx = pRoomEx`, `ecx = nTileY`, `[esp+4] = nTileX`, `ret 4`).
 *
 * Looks up the `D2RoomCoordListStrc*` at `(nTileX, nTileY)` in `pRoomEx->pLogicalRoomInfo (+0x64)`
 * and returns `pNode->nIndex (+0x28)` if non-NULL, or `-1` (`0xFFFFFFFF`) if NULL.
 */
export function DRLGLOGIC_GetRoomCoordListIndexAtSubtile113c(
  m: Memory113c,
  pRoomEx: number,
  nTileY: number,
  nTileX: number,
): number {
  const roomEx = pRoomEx >>> 0;
  const pCoords = m.get(roomEx, D2RoomExStrc.pLogicalRoomInfo);
  if (pCoords === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\DrlgLogic.cpp', 668);
  }
  let pNode: number;
  if ((m.u8(pCoords) & 0x01) !== 0) {
    pNode = m.get(pCoords, D2RoomLogicalInfoStrc.pCoordList);
  } else {
    const relY = ((nTileY | 0) - (m.get(roomEx, D2RoomExStrc.nTileYPos) | 0)) | 0;
    const pRowOffsets = m.get(pCoords, D2RoomLogicalInfoStrc.pIndexRowOffsets);
    const rowOff = m.u32((pRowOffsets + relY * 4) >>> 0) | 0;
    const cellIdx = (rowOff - (m.get(roomEx, D2RoomExStrc.nTileXPos) | 0) + (nTileX | 0)) | 0;
    const pCells = m.get(pCoords, D2RoomLogicalInfoStrc.pIndexCells);
    pNode = m.u32((pCells + (cellIdx << 2)) >>> 0);
  }
  if (pNode === 0) {
    return 0xffffffff;
  }
  return m.get(pNode, D2RoomCoordListStrc.nIndex);
}

/**
 * `@va D2Common:0x6FDD1200` (`DRLGLOGIC_BuildRoomCoordListRegions113c`, `__stdcall(pRoomEx, pCoords)`, `ret 8`).
 *
 * Initializes `pCoords + 0x1C` (`D2DrlgGridStrc` of `(nTileWidth + 1) x (nTileHeight + 1)` cells) via `0x6FD86950`,
 * then greedily partitions `pCoords`'s index grid (`+0x08`/`+0x0C`) into maximal axis-aligned rectangles of identical
 * `cell & 0x0FFFFFFF` values, allocating a `0x30`-byte `D2RoomCoordListStrc` node for each region, filling `pCoords + 0x1C`
 * cells with `pNode` via `0x6FD86C20` (`gafGridCellOps[3]`), and computing world-space bounding boxes `box[0]` and `box[1]`.
 */
export function DRLGLOGIC_BuildRoomCoordListRegions113c(
  m: Memory113c,
  pRoomEx: number,
  pCoords: number,
): void {
  const roomEx = pRoomEx >>> 0;
  const coords = pCoords >>> 0;
  const pLevel = m.get(roomEx, D2RoomExStrc.pLevel);
  const pDrlg = m.u32((pLevel + 0x1b4) >>> 0);
  const initRows = ((m.get(roomEx, D2RoomExStrc.nTileHeight) | 0) + 1) | 0;
  const initCols = ((m.get(roomEx, D2RoomExStrc.nTileWidth) | 0) + 1) | 0;
  const pMemPool = m.u32((pDrlg + 0x478) >>> 0);
  const pDestGrid = (coords + 0x1c) >>> 0;

  DRLGGRID_AllocAndInitGridCells113c(m, pDestGrid, pMemPool, initCols, initRows);

  const nCols = ((m.get(roomEx, D2RoomExStrc.nTileWidth) | 0) + 1) | 0;
  const nRows = ((m.get(roomEx, D2RoomExStrc.nTileHeight) | 0) + 1) | 0;
  if (nRows <= 0) return;

  for (let y = 0; y < nRows; y++) {
    if (nCols <= 0) continue;
    for (let x = 0; x < nCols; x++) {
      const pSrcRowOffsets = m.get(coords, D2RoomLogicalInfoStrc.pGrid0RowOffsets);
      const srcRowOff = m.u32((pSrcRowOffsets + y * 4) >>> 0) | 0;
      const pSrcCells = m.get(coords, D2RoomLogicalInfoStrc.pGrid0Cells);
      const srcCell = m.u32((pSrcCells + (((srcRowOff + x) | 0) << 2)) >>> 0);
      const pDstCells = m.get(pDestGrid, D2DrlgGridStrc.pCells);
      const nMaskedVal = srcCell & 0x0fffffff;
      const pDstRowOffsets = m.get(pDestGrid, D2DrlgGridStrc.pRowOffsets);
      const dstRowOff = m.u32((pDstRowOffsets + y * 4) >>> 0) | 0;
      if (m.u32((pDstCells + (((dstRowOff + x) | 0) << 2)) >>> 0) !== 0) {
        continue;
      }

      const pNode = m.alloc(0x30);
      m.fill(pNode, 0x30, 0);
      const bFlag = (srcCell & 0x20000000) !== 0 ? 1 : 0;
      m.set(pNode, D2RoomCoordListStrc.nIndex, nMaskedVal >>> 0);
      m.set(pNode, D2RoomCoordListStrc.bNode, bFlag >>> 0);
      m.set(pNode, D2RoomCoordListStrc.pNext, m.get(coords, D2RoomLogicalInfoStrc.pCoordList));
      m.set(coords, D2RoomLogicalInfoStrc.pCoordList, pNode);
      m.setU32(pNode, x >>> 0);
      m.setU32((pNode + 0x04) >>> 0, y >>> 0);

      let endX = x;
      if (endX < nCols) {
        const sRowOff = m.u32((m.get(coords, D2RoomLogicalInfoStrc.pGrid0RowOffsets) + y * 4) >>> 0) | 0;
        while (endX < nCols) {
          const sIdx = (sRowOff + endX) | 0;
          const sVal =
            m.u32((m.get(coords, D2RoomLogicalInfoStrc.pGrid0Cells) + (sIdx << 2)) >>> 0) &
            0x0fffffff;
          if (sVal !== nMaskedVal) break;
          const dRowOff = m.u32((m.get(pDestGrid, D2DrlgGridStrc.pRowOffsets) + y * 4) >>> 0) | 0;
          const dIdx = (dRowOff + endX) | 0;
          if (m.u32((m.get(pDestGrid, D2DrlgGridStrc.pCells) + (dIdx << 2)) >>> 0) !== 0) break;
          endX = (endX + 1) | 0;
        }
      }
      m.setU32((pNode + 0x08) >>> 0, endX >>> 0);

      let curY = y;
      let bStop = 0;
      if (curY < nRows) {
        do {
          const nodeEndX = m.u32((pNode + 0x08) >>> 0) | 0;
          if (x < nodeEndX) {
            const sRowOff =
              m.u32((m.get(coords, D2RoomLogicalInfoStrc.pGrid0RowOffsets) + curY * 4) >>> 0) | 0;
            const pSCells = m.get(coords, D2RoomLogicalInfoStrc.pGrid0Cells);
            for (let tx = x; tx < (m.u32((pNode + 0x08) >>> 0) | 0); tx++) {
              const sIdx = (sRowOff + tx) | 0;
              const sVal = m.u32((pSCells + (sIdx << 2)) >>> 0) & 0x0fffffff;
              if (sVal !== nMaskedVal) {
                bStop = 1;
                curY = (curY - 1) | 0;
                break;
              }
              const dRowOff =
                m.u32((m.get(pDestGrid, D2DrlgGridStrc.pRowOffsets) + curY * 4) >>> 0) | 0;
              const dIdx = (dRowOff + tx) | 0;
              if (m.u32((m.get(pDestGrid, D2DrlgGridStrc.pCells) + (dIdx << 2)) >>> 0) !== 0) {
                bStop = 1;
                curY = (curY - 1) | 0;
                break;
              }
            }
          }
          curY = (curY + 1) | 0;
        } while (bStop === 0 && curY < nRows);
      }
      m.setU32((pNode + 0x0c) >>> 0, curY >>> 0);

      for (let ry = y; ry < (m.u32((pNode + 0x0c) >>> 0) | 0); ry++) {
        for (
          let rx = m.u32(pNode) | 0;
          rx < (m.u32((pNode + 0x08) >>> 0) | 0);
          rx++
        ) {
          const dRowOff =
            m.u32((m.get(pDestGrid, D2DrlgGridStrc.pRowOffsets) + ry * 4) >>> 0) | 0;
          const dIdx = (dRowOff + rx) | 0;
          const pCell = (m.get(pDestGrid, D2DrlgGridStrc.pCells) + (dIdx << 2)) >>> 0;
          DRLGGRID_OpOverwrite113c(m, pCell, pNode);
        }
      }

      const posY0 = m.get(roomEx, D2RoomExStrc.nTileYPos) | 0;
      const box0Y = m.u32((pNode + 0x04) >>> 0) | 0;
      const box0EndY = m.u32((pNode + 0x0c) >>> 0) | 0;
      m.setU32((pNode + 0x04) >>> 0, ((box0Y + posY0) | 0) >>> 0);
      const posY1 = m.get(roomEx, D2RoomExStrc.nTileYPos) | 0;
      const box0EndX = m.u32((pNode + 0x08) >>> 0) | 0;
      const box0X = m.u32(pNode) | 0;
      m.setU32((pNode + 0x0c) >>> 0, ((box0EndY + posY1) | 0) >>> 0);
      const posX0 = m.get(roomEx, D2RoomExStrc.nTileXPos) | 0;
      m.setU32(pNode, ((box0X + posX0) | 0) >>> 0);
      const posX1 = m.get(roomEx, D2RoomExStrc.nTileXPos) | 0;
      m.setU32((pNode + 0x08) >>> 0, ((box0EndX + posX1) | 0) >>> 0);

      m.setU32((pNode + 0x10) >>> 0, m.u32(pNode));
      m.setU32((pNode + 0x14) >>> 0, m.u32((pNode + 0x04) >>> 0));
      m.setU32((pNode + 0x18) >>> 0, m.u32((pNode + 0x08) >>> 0));
      m.setU32((pNode + 0x1c) >>> 0, m.u32((pNode + 0x0c) >>> 0));

      const maxX0 =
        ((m.get(roomEx, D2RoomExStrc.nTileXPos) | 0) +
          (m.get(roomEx, D2RoomExStrc.nTileWidth) | 0)) |
        0;
      if ((m.u32((pNode + 0x18) >>> 0) | 0) >= maxX0) {
        m.setU32((pNode + 0x18) >>> 0, maxX0 >>> 0);
      }

      const maxY0 =
        ((m.get(roomEx, D2RoomExStrc.nTileHeight) | 0) +
          (m.get(roomEx, D2RoomExStrc.nTileYPos) | 0)) |
        0;
      if ((m.u32((pNode + 0x1c) >>> 0) | 0) >= maxY0) {
        m.setU32((pNode + 0x1c) >>> 0, maxY0 >>> 0);
      }

      const maxX1 =
        ((m.get(roomEx, D2RoomExStrc.nTileWidth) | 0) +
          (m.get(roomEx, D2RoomExStrc.nTileXPos) | 0)) |
        0;
      const box1X = m.u32((pNode + 0x10) >>> 0) | 0;
      let clearBox1 = box1X >= maxX1;
      if (!clearBox1) {
        const maxY1 =
          ((m.get(roomEx, D2RoomExStrc.nTileYPos) | 0) +
            (m.get(roomEx, D2RoomExStrc.nTileHeight) | 0)) |
          0;
        const box1Y = m.u32((pNode + 0x14) >>> 0) | 0;
        if (box1Y >= maxY1) {
          clearBox1 = true;
        }
      }
      if (clearBox1) {
        m.setU32((pNode + 0x10) >>> 0, 0);
        m.setU32((pNode + 0x14) >>> 0, 0);
        m.setU32((pNode + 0x18) >>> 0, 0);
        m.setU32((pNode + 0x1c) >>> 0, 0);
      }
    }
  }
}

/**
 * `@va D2Common:0x6FDD16C0` (`DRLGLOGIC_LinkAdjacentRoomCoordListsAtSubtile113c`,
 * custom register ABI `eax = nSubtileY`, `ecx = nSubtileX`, `edx = pRoomEx1`, `[esp+4] = pRoomEx2`, `ret 4`).
 */
export function DRLGLOGIC_LinkAdjacentRoomCoordListsAtSubtile113c(
  m: Memory113c,
  nSubtileY: number,
  nSubtileX: number,
  pRoomEx1: number,
  pRoomEx2: number,
): void {
  const room1 = pRoomEx1 >>> 0;
  const room2 = pRoomEx2 >>> 0;
  const x = nSubtileX | 0;
  const y = nSubtileY | 0;

  const xStart = m.u32((room1 + 0x34) >>> 0) | 0;
  if (x < xStart) return;
  const yStart = m.u32((room1 + 0x38) >>> 0) | 0;
  if (y < yStart) return;
  const width = m.u32((room1 + 0x3c) >>> 0) | 0;
  if (x > ((xStart + width) | 0)) return;
  const height = m.u32((room1 + 0x40) >>> 0) | 0;
  if (y > ((yStart + height) | 0)) return;

  const pList1 = DRLGLOGIC_GetRoomCoordListAtSubtile113c(m, room1, y, x);
  const pList2 = DRLGLOGIC_GetRoomCoordListAtSubtile113c(m, room2, y, x);

  const idx1 = m.u32((pList1 + 0x28) >>> 0) | 0;
  if (idx1 === 0) return;
  const idx2 = m.u32((pList2 + 0x28) >>> 0) | 0;
  if (idx2 === 0) return;

  const pLvl1 = m.u32((room1 + 0x58) >>> 0);
  const pLvl2 = m.u32((room2 + 0x58) >>> 0);
  if (m.u32((pLvl1 + 0x1d0) >>> 0) !== m.u32((pLvl2 + 0x1d0) >>> 0)) return;
  if (idx1 === idx2) return;

  const bNode1 = m.u32((pList1 + 0x20) >>> 0);
  if (bNode1 !== m.u32((pList2 + 0x20) >>> 0)) return;

  DRLGLOGIC_ReplaceRoomCoordListIndex113c(m, room2, idx2, idx1, bNode1);
}

/**
 * `@va D2Common:0x6FDD1BC0` (`DRLGLOGIC_AssignCoordListIndicesAcrossGrid113c`,
 * custom register ABI `esi = pLogicalCoordCtx`, plain `ret`).
 */
export function DRLGLOGIC_AssignCoordListIndicesAcrossGrid113c(
  m: Memory113c,
  pLogicalCoordCtx: number,
): void {
  const ctx = pLogicalCoordCtx >>> 0;
  const pRoomEx = m.u32(ctx);
  if ((m.u32((pRoomEx + 0x40) >>> 0) | 0) < 0) return;

  let y = 0;
  do {
    const nWidth = m.u32((m.u32(ctx) + 0x3c) >>> 0) | 0;
    if (nWidth >= 0) {
      let x = 0;
      do {
        const pGrid1 = m.u32((ctx + 0x04) >>> 0);
        const pRowOffsets1 = m.u32((pGrid1 + 0x04) >>> 0);
        const pCells1 = m.u32(pGrid1);
        const rowOff1 = m.u32((pRowOffsets1 + y * 4) >>> 0) | 0;
        const cellVal = m.u32((pCells1 + ((rowOff1 + x) << 2)) >>> 0);

        if ((cellVal & 0x10000000) === 0) {
          const nextIdx = ((m.u32((ctx + 0x18) >>> 0) | 0) + 1) | 0;
          m.setU32((ctx + 0x18) >>> 0, nextIdx >>> 0);
          const fillVal = ((nextIdx & 0x0fffffff) | 0x10000000) >>> 0;
          m.setU32((ctx + 0x1c) >>> 0, fillVal);

          const pWallGrid = m.u32((ctx + 0x10) >>> 0);
          const pRowOffsetsW = m.u32((pWallGrid + 0x04) >>> 0);
          const rowOffW = m.u32((pRowOffsetsW + y * 4) >>> 0) | 0;
          const pCellsW = m.u32(pWallGrid);
          const wallCell = m.u32((pCellsW + (((rowOffW + x) | 0) << 2)) >>> 0) | 0;

          if ((wallCell & 0x01e0ff00) === 0x01e00000 || wallCell < 0) {
            m.setU32((ctx + 0x1c) >>> 0, (fillVal | 0x20000000) >>> 0);
          }

          DRLGLOGIC_FloodFillLogicalCoordGrid113c(m, ctx, x, y, -1);
        }

        const curWidth = m.u32((m.u32(ctx) + 0x3c) >>> 0) | 0;
        x = (x + 1) | 0;
        if (x > curWidth) break;
      } while (true);
    }

    const curHeight = m.u32((m.u32(ctx) + 0x40) >>> 0) | 0;
    y = (y + 1) | 0;
    if (y > curHeight) break;
  } while (true);
}

/**
 * `@va D2Common:0x6FDD1AD0` (`DRLGLOGIC_LinkAdjacentRoomsCoordLists113c`, not exported;
 * custom LTCG `esi = pRoomEx`, `ret`).
 */
export function DRLGLOGIC_LinkAdjacentRoomsCoordLists113c(m: Memory113c, pRoomEx: number): void {
  const roomEx = pRoomEx >>> 0;
  let i = 0;
  while (i < (m.u32((roomEx + 0x2c) >>> 0) | 0)) {
    const pNear = m.u32((m.u32((roomEx + 0x08) >>> 0) + i * 4) >>> 0);
    if (pNear !== roomEx && m.u32((pNear + 0x64) >>> 0) !== 0) {
      const rX = m.u32((roomEx + 0x34) >>> 0) | 0;
      const nX = m.u32((pNear + 0x34) >>> 0) | 0;
      const rW = m.u32((roomEx + 0x3c) >>> 0) | 0;
      const nW = m.u32((pNear + 0x3c) >>> 0) | 0;
      const distX = rX < nX ? (nX - rW - rX) | 0 : (rX - nW - nX) | 0;

      const rY = m.u32((roomEx + 0x38) >>> 0) | 0;
      const nY = m.u32((pNear + 0x38) >>> 0) | 0;
      const rH = m.u32((roomEx + 0x40) >>> 0) | 0;
      const nH = m.u32((pNear + 0x40) >>> 0) | 0;
      const distY = rY < nY ? (nY - rH - rY) | 0 : (rY - nH - nY) | 0;

      if (distX < 1 && distY < 1) {
        const startX = m.u32((roomEx + 0x34) >>> 0) | 0;
        const startY = m.u32((roomEx + 0x38) >>> 0) | 0;
        const endX = (startX + (m.u32((roomEx + 0x3c) >>> 0) | 0)) | 0;
        for (let x = startX; x <= endX; x++) {
          const curY = m.u32((roomEx + 0x38) >>> 0) | 0;
          DRLGLOGIC_LinkAdjacentRoomCoordListsAtSubtile113c(m, curY, x, pNear, roomEx);
          const botY = ((m.u32((roomEx + 0x38) >>> 0) | 0) + (m.u32((roomEx + 0x40) >>> 0) | 0)) | 0;
          DRLGLOGIC_LinkAdjacentRoomCoordListsAtSubtile113c(m, botY, x, pNear, roomEx);
        }
        const endY = (startY + (m.u32((roomEx + 0x40) >>> 0) | 0)) | 0;
        for (let y = startY; y <= endY; y++) {
          const curX = m.u32((roomEx + 0x34) >>> 0) | 0;
          DRLGLOGIC_LinkAdjacentRoomCoordListsAtSubtile113c(m, y, curX, pNear, roomEx);
          const rightX = ((m.u32((roomEx + 0x34) >>> 0) | 0) + (m.u32((roomEx + 0x3c) >>> 0) | 0)) | 0;
          DRLGLOGIC_LinkAdjacentRoomCoordListsAtSubtile113c(m, y, rightX, pNear, roomEx);
        }
      }
    }
    i++;
  }
}

/**
 * `@va D2Common:0x6FDD1CA0` (`DRLGLOGIC_AllocAndBuildRoomCoordList113c`, not exported;
 * `__stdcall(pRoomEx, nPresetFlags, pTileGrid1, pTileGrid2) -> void`, `ret 0x10`).
 */
export function DRLGLOGIC_AllocAndBuildRoomCoordList113c(
  m: Memory113c,
  pRoomEx: number,
  nPresetFlags: number,
  pTileGrid1: number,
  pTileGrid2: number,
): void {
  const roomEx = pRoomEx >>> 0;
  const pLevel = m.u32((roomEx + 0x58) >>> 0);
  const pDrlg = m.u32((pLevel + 0x1b4) >>> 0);
  void m.u32((pDrlg + 0x478) >>> 0);

  const pLogical = m.alloc(0x34);
  m.fill(pLogical, 0x34, 0);
  m.setU32((roomEx + 0x64) >>> 0, pLogical);

  DRLGLOGIC_MarkFloorTileCells113c(m, roomEx, pTileGrid2 >>> 0);
  m.setU32(pLogical, (m.u32(pLogical) | 0x02) >>> 0);

  const pLogicalGrid = (pLogical + 0x08) >>> 0;
  const w = ((m.u32((roomEx + 0x3c) >>> 0) | 0) + 1) | 0;
  const h = ((m.u32((roomEx + 0x40) >>> 0) | 0) + 1) | 0;
  DRLGGRID_AllocAndInitGridCells113c(m, pLogicalGrid, m.u32((pDrlg + 0x478) >>> 0), w, h);

  if (m.u32((pLevel + 0x1dc) >>> 0) === 0) {
    m.setU32((pLevel + 0x1dc) >>> 0, 1);
  }
  const startCoordId = m.u32((pLevel + 0x1dc) >>> 0) | 0;

  const sm = withDrlgLogicStackScratch113c(m);
  const ctx = DRLGLOGIC_STACK_BASE;
  const tempWallGrid = (DRLGLOGIC_STACK_BASE + 0x40) >>> 0;
  const rowOffsetsBuf = (DRLGLOGIC_STACK_BASE + 0x80) >>> 0;
  const cellsBuf = (DRLGLOGIC_STACK_BASE + 0x500) >>> 0;

  const cellBytes = Math.imul(w, h) * 4;
  if (cellBytes > 0) {
    sm.fill(cellsBuf, cellBytes, 0);
  }
  let rowOff = 0;
  for (let y = 0; y < h; y++) {
    sm.setU32((rowOffsetsBuf + y * 4) >>> 0, rowOff >>> 0);
    rowOff = (rowOff + w) | 0;
  }

  sm.setU32(tempWallGrid, cellsBuf);
  sm.setU32((tempWallGrid + 0x04) >>> 0, rowOffsetsBuf);
  sm.setU32((tempWallGrid + 0x08) >>> 0, w >>> 0);
  sm.setU32((tempWallGrid + 0x0c) >>> 0, h >>> 0);
  sm.setU32((tempWallGrid + 0x10) >>> 0, 0);

  DRLGLOGIC_MarkWallTileCells113c(sm, roomEx, tempWallGrid);

  sm.fill(ctx, 0x20, 0);
  sm.setU32(ctx, roomEx);
  sm.setU32((ctx + 0x04) >>> 0, pLogicalGrid);
  sm.setU32((ctx + 0x08) >>> 0, nPresetFlags >>> 0);
  sm.setU32((ctx + 0x0c) >>> 0, pTileGrid2 >>> 0);
  sm.setU32((ctx + 0x10) >>> 0, pTileGrid1 >>> 0);
  sm.setU32((ctx + 0x14) >>> 0, tempWallGrid);
  sm.setU32((ctx + 0x18) >>> 0, startCoordId >>> 0);
  sm.setU32((ctx + 0x1c) >>> 0, 0);

  DRLGLOGIC_AssignCoordListIndicesAcrossGrid113c(sm, ctx);

  const nCoordLists = ((sm.u32((ctx + 0x18) >>> 0) | 0) - startCoordId + 1) | 0;
  m.setU32((pLogical + 0x04) >>> 0, nCoordLists >>> 0);
  const arrBytes = Math.imul(nCoordLists, 0x30) >>> 0;
  const pCoordListArr = m.alloc(arrBytes);
  m.fill(pCoordListArr, arrBytes, 0);
  m.setU32((pLogical + 0x30) >>> 0, pCoordListArr);
  m.setU32((pLevel + 0x1dc) >>> 0, ((m.u32((pLevel + 0x1dc) >>> 0) | 0) + nCoordLists) >>> 0);

  DRLGLOGIC_BuildRoomCoordListRegions113c(m, roomEx, pLogical);
  DRLGLOGIC_AssignTileDataCoordListPointers113c(m, roomEx);
  DRLGLOGIC_LinkAdjacentRoomsCoordLists113c(m, roomEx);
}


