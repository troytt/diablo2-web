import {
  D2DrlgCoordStrc,
  D2DrlgLevelLinkDataStrc,
  D2DrlgLevelStrc,
  D2DrlgOutdoorInfoStrc,
  D2DrlgStrc,
  D2LevelDefBin,
  D2LevelDefBin_SIZE,
  type FieldLayout113c,
} from '../../mem/layout.generated.ts';
import type { Memory113c } from '../../mem/sparse-memory.ts';
import {
  DRLGOUTROOM_LinkLevelsByLevelCoords113c,
  DRLGOUTROOM_LinkLevelsByLevelDef113c,
  DRLGOUTROOM_LinkLevelsByOffsetCoords113c,
} from '../../tables/anim-tbls-113c.ts';
import {
  DRLG_ApplyOutdoorVertexFlags113c,
  DRLG_CheckAct1LinkOverlap113c,
  DRLG_CheckAct1WildLinkOverlap113c,
  DRLG_CheckAct2LinkOverlap113c,
  DRLG_CheckAct4LinkOverlap113c,
  DRLG_CheckMonasteryLinkOverlap113c,
  DRLG_LinkOutdoorLevels113c,
} from '../../tables/datatbls-113c.ts';
import { DRLGGRID_OpOr113c as DRLGGRID_BitwiseOrCell113c } from './drlg-grid.ts';
import { D2CommonAssertError, D2COMMON_SGPT_DATATABLES_VA_113C } from '../inline-helpers.ts';
import { DRLG_SetWarpId113c } from '../quest-record.ts';
import { DRLG_AllocAndInitLevel113c, DRLG_GetOrAllocObjectPresetRecord113c } from './drlg.ts';
import { SGPT_DATA_TABLES_PTR_VA } from './drlg-ver.ts';

/**
 * `D2Common.dll` `.data` `D2LevelLinkDefStrc` table for Act 1 outdoor link placement (15 records x 16 bytes).
 *
 * `@va D2Common:0x6FDDCBE8`
 */
export const ACT1_LINK_DEFS_VA = 0x6fddcbe8;

/**
 * `D2Common.dll` `.data` `D2LevelLinkDefStrc` table for Act 2 outdoor link placement (15 records x 16 bytes).
 *
 * `@va D2Common:0x6FDDCCD8`
 */
export const ACT2_LINK_DEFS_VA = 0x6fddccd8;

/**
 * `D2Common.dll` `.rdata` 64-entry `int32_t` compatibility matrix for Act 1 `nLevelLink == 1`.
 *
 * `@va D2Common:0x6FDE54B8`
 */
export const ACT1_TOWN_COMPAT_VA = 0x6fde54b8;

/**
 * `D2Common.dll` `.bss` `sgptDataTables.pLevelDefBin` (`D2LevelDefBin*`).
 *
 * `@va D2Common:0x6FDF0B38`
 */
export const SGPT_LEVELDEF_BIN_VA = 0x6fdf0b38;

/**
 * `D2Common.dll` `.bss` Act 4 step direction flag (`0x800000` or `0x400000`).
 *
 * `@va D2Common:0x6FDF146C`
 */
export const GDW_ACT4_STEP_FLAG_VA = 0x6fdf146c;

function stepLinkSeed(m: Memory113c, pSeed: number): number {
  const lo = BigInt(m.u32(pSeed));
  const hi = BigInt(m.u32((pSeed + 4) >>> 0));
  const prod = lo * 0x6ac690c5n + hi;
  const newLo = Number(prod & 0xffffffffn) >>> 0;
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0;
  m.setU32(pSeed, newLo);
  m.setU32((pSeed + 4) >>> 0, newHi);
  return newLo | 0;
}

function signedMod8(v: number): number {
  let eax = (v & 0x80000007) | 0;
  if (eax < 0) {
    eax = (((eax - 1) | -8) + 1) | 0;
  }
  return eax;
}

function signedMod4(v: number): number {
  let eax = (v & 0x80000003) | 0;
  if (eax < 0) {
    eax = (((eax - 1) | -4) + 1) | 0;
  }
  return eax;
}

function signedMod2(v: number): number {
  let eax = (v & 0x80000001) | 0;
  if (eax < 0) {
    eax = (((eax - 1) | -2) + 1) | 0;
  }
  return eax;
}

function boxesOverlap(m: Memory113c, pBoxA: number, pBoxB: number): boolean {
  const ax = m.u32(pBoxA) | 0;
  const ay = m.u32((pBoxA + 4) >>> 0) | 0;
  const aw = m.u32((pBoxA + 8) >>> 0) | 0;
  const ah = m.u32((pBoxA + 12) >>> 0) | 0;
  const bx = m.u32(pBoxB) | 0;
  const by = m.u32((pBoxB + 4) >>> 0) | 0;
  const bw = m.u32((pBoxB + 8) >>> 0) | 0;
  const bh = m.u32((pBoxB + 12) >>> 0) | 0;

  const sepX = ax < bx ? ((bx - aw - ax) | 0) : ((ax - bw - bx) | 0);
  const sepY = ay < by ? ((by - ah - ay) | 0) : ((ay - bh - by) | 0);
  return sepX < 0 && sepY < 0;
}

/**
 * `@va D2Common:0x6FD63F30` (`DRLGOUTPLACE_InitRoomExCoordByDir113c`, not exported;
 * custom LTCG `ebx = pDest`, `edi = nWidth`, `esi = nHeight`, `[esp+4] = pSrc`, `[esp+8] = nDir`, `ret 8`).
 *
 * Computes a directional coordinate offset `(dx, dy)` for `nDir` in `0..4`, sets
 * `pDest->nPosX = pSrc->nPosX + dx`, `pDest->nPosY = pSrc->nPosY + dy`,
 * `pDest->nWidth = nWidth`, `pDest->nHeight = nHeight`, and `*(pDest + 0x10) = nDir`.
 */
export function DRLGOUTPLACE_InitRoomExCoordByDir113c(
  m: Memory113c,
  pDest: number,
  nWidth: number,
  nHeight: number,
  pSrc: number,
  nDir: number,
): void {
  const dest = pDest >>> 0;
  const src = pSrc >>> 0;
  const w = nWidth | 0;
  const h = nHeight | 0;
  const dir = nDir >>> 0;

  let dx = 0;
  let dy = 0;
  if (dir === 0) {
    dx = 0;
    dy = (-h) | 0;
  } else if (dir === 1) {
    dx = (-w) | 0;
    const prod = BigInt(h) * 0x55555555n;
    const hi = Number((prod >> 32n) & 0xffffffffn) | 0;
    const edx = ((hi - h) | 0) >> 1;
    dy = (edx + (edx >>> 31)) | 0;
  } else if (dir === 2) {
    dx = w;
    const prod = BigInt(h) * 0x55555555n;
    const hi = Number((prod >> 32n) & 0xffffffffn) | 0;
    const edx = ((hi - h) | 0) >> 1;
    dy = (edx + (edx >>> 31)) | 0;
  } else if (dir === 3) {
    dx = (-w) | 0;
    const scaled = ((-h) << 1) | 0;
    const prod = BigInt(scaled) * 0x55555556n;
    const edx = Number((prod >> 32n) & 0xffffffffn) | 0;
    dy = (edx + (edx >>> 31)) | 0;
  } else if (dir === 4) {
    dx = w;
    const scaled = ((-h) << 1) | 0;
    const prod = BigInt(scaled) * 0x55555556n;
    const edx = Number((prod >> 32n) & 0xffffffffn) | 0;
    dy = (edx + (edx >>> 31)) | 0;
  }

  const outX = ((m.u32((src + D2DrlgCoordStrc.nPosX.off) >>> 0) | 0) + dx) >>> 0;
  m.setU32((dest + D2DrlgCoordStrc.nPosX.off) >>> 0, outX);
  const outY = ((m.u32((src + D2DrlgCoordStrc.nPosY.off) >>> 0) | 0) + dy) >>> 0;
  m.setU32((dest + 0x10) >>> 0, dir);
  m.setU32((dest + D2DrlgCoordStrc.nPosY.off) >>> 0, outY);
  m.setU32((dest + D2DrlgCoordStrc.nWidth.off) >>> 0, w >>> 0);
  m.setU32((dest + D2DrlgCoordStrc.nHeight.off) >>> 0, h >>> 0);
}

/**
 * `@va D2Common:0x6FD64900` (`DRLGOUTPLACE_CheckAct2LinkOverlap113c`, not exported;
 * `__fastcall(ecx = pLinkData, edx = nIteration) -> BOOL`, `ret`).
 *
 * Checks whether `pLinkData->pCoord[nIteration]` overlaps any non-linked prior box `0..nIteration-1`
 * (using `.data` `0x6FDDCCE0 + nIteration * 16` for `nTargetLink`), and when `nIteration != 0`,
 * temporarily expands `pCoord[0]` (`nPosY -= 200`, `nHeight += 200`) to reject overlap with the expanded box 0.
 */
export function DRLGOUTPLACE_CheckAct2LinkOverlap113c(
  m: Memory113c,
  pLinkData: number,
  nIteration: number,
): number {
  const base = pLinkData >>> 0;
  const iter = nIteration | 0;
  const pCurrBox = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (iter << 4)) >>> 0;
  const linkedIdx = m.u32((0x6fddcce0 + (iter << 4)) >>> 0) | 0;

  for (let i = 0; i < iter; i++) {
    if (i !== linkedIdx) {
      const pOtherBox = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (i << 4)) >>> 0;
      if (boxesOverlap(m, pCurrBox, pOtherBox)) {
        return 0;
      }
    }
  }

  if (iter === 0) {
    return 1;
  }

  const pBox0 = (base + D2DrlgLevelLinkDataStrc.nPosX.off) >>> 0;
  const origY0 = m.u32((pBox0 + 4) >>> 0) | 0;
  const origH0 = m.u32((pBox0 + 12) >>> 0) | 0;
  const modY0 = (origY0 - 200) | 0;
  const modH0 = (origH0 + 200) | 0;
  m.setU32((pBox0 + 4) >>> 0, modY0 >>> 0);
  m.setU32((pBox0 + 12) >>> 0, modH0 >>> 0);

  const res = boxesOverlap(m, pBox0, pCurrBox) ? 0 : 1;

  const curY0 = m.u32((pBox0 + 4) >>> 0) | 0;
  m.setU32((pBox0 + 12) >>> 0, ((modH0 - 200) | 0) >>> 0);
  m.setU32((pBox0 + 4) >>> 0, ((curY0 + 200) | 0) >>> 0);
  return res;
}

/**
 * `@va D2Common:0x6FD64A00` (`DRLGOUTPLACE_CheckAct1LinkOverlap113c`, not exported;
 * `__fastcall(ecx = pLinkData, edx = nIteration) -> BOOL`, `ret`).
 *
 * Checks whether `pLinkData->pCoord[nIteration]` overlaps any non-linked prior box `0..nIteration-1`
 * (using `.data` `0x6FDDCBF0 + nIteration * 16` for `nTargetLink`), then dispatches on
 * `nLevelLink` (`.data` `0x6FDDCBEC + nIteration * 16`):
 * - `nLevelLink == 1`: returns `ACT1_TOWN_COMPAT_6FDE54B8` entry indexed by `nRand0` and `nRand2`.
 * - `nLevelLink == 17`: rejects if any other entry `k != nIteration` sharing the same `nTargetLink`
 *   has `nRand0[k] == nRand0[nIteration]`.
 */
export function DRLGOUTPLACE_CheckAct1LinkOverlap113c(
  m: Memory113c,
  pLinkData: number,
  nIteration: number,
): number {
  const base = pLinkData >>> 0;
  const iter = nIteration | 0;
  const pCurrBox = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (iter << 4)) >>> 0;
  const linkedIdx = m.u32((0x6fddcbf0 + (iter << 4)) >>> 0) | 0;

  for (let i = 0; i < iter; i++) {
    if (i !== linkedIdx) {
      const pOtherBox = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (i << 4)) >>> 0;
      if (boxesOverlap(m, pCurrBox, pOtherBox)) {
        return 0;
      }
    }
  }

  const nLevelLink = m.u32((0x6fddcbec + (iter << 4)) >>> 0) | 0;
  if (nLevelLink === 1) {
    const v0 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (linkedIdx << 2)) >>> 0) | 0;
    const v1 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand2.off + (linkedIdx << 2)) >>> 0) | 0;
    const v2 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand2.off + (iter << 2)) >>> 0) | 0;
    const v3 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter << 2)) >>> 0) | 0;
    const idx = (v3 + (((v2 + (((v0 + (v1 << 2)) << 1) | 0)) << 2) | 0)) | 0;
    return m.u32((ACT1_TOWN_COMPAT_VA + ((idx << 2) >>> 0)) >>> 0) | 0;
  }

  if (nLevelLink === 17) {
    const myRand0 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter << 2)) >>> 0) | 0;
    for (let k = 0; k < 15; k++) {
      if (k !== iter && (m.u32((0x6fddcbf0 + (k << 4)) >>> 0) | 0) === linkedIdx) {
        const otherRand0 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (k << 2)) >>> 0) | 0;
        if (myRand0 === otherRand0) {
          return 0;
        }
      }
    }
  }

  return 1;
}

/**
 * `@va D2Common:0x6FD64B00` (`DRLGOUTPLACE_LinkAct4Step113c`, not exported;
 * `__fastcall(ecx = pLinkData) -> BOOL`, `ret`).
 *
 * Sets `nRand1[iter] = 3` and `nRand0[iter] = 3`, advances `pLinkData`'s 64-bit LCG seed,
 * positions `pCoord[iter]` relative to `pCoord[pLink[iter].nTargetLink]`, writes `0x800000`
 * (odd seed low bit) or `0x400000` (even seed low bit) to `0x6FDF146C`, and returns `1`.
 */
export function DRLGOUTPLACE_LinkAct4Step113c(m: Memory113c, pLinkData: number): number {
  const base = pLinkData >>> 0;
  const iter0 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  m.setU32((base + D2DrlgLevelLinkDataStrc.nRand1.off + (iter0 << 2)) >>> 0, 3);
  const iter1 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const r1 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand1.off + (iter1 << 2)) >>> 0);
  m.setU32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter1 << 2)) >>> 0, r1);

  const pLinkArr = m.u32((base + D2DrlgLevelLinkDataStrc.pLink.off) >>> 0);
  const iter2 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const targetIdx = m.u32((pLinkArr + (iter2 << 4) + 8) >>> 0) | 0;

  const newLo = stepLinkSeed(m, base);
  const iter3 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const dir = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter3 << 2)) >>> 0) >>> 0;

  const pRef = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (targetIdx << 4)) >>> 0;
  const pCurr = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (iter2 << 4)) >>> 0;
  const refX = m.u32(pRef) | 0;
  const refY = m.u32((pRef + 4) >>> 0) | 0;
  const refW = m.u32((pRef + 8) >>> 0) | 0;
  const refH = m.u32((pRef + 12) >>> 0) | 0;
  const curW = m.u32((pCurr + 8) >>> 0) | 0;
  const curH = m.u32((pCurr + 12) >>> 0) | 0;

  if ((newLo & 1) !== 0) {
    if (dir === 0) {
      m.setU32(pCurr, refX >>> 0);
      m.setU32((pCurr + 4) >>> 0, ((refY + refH) | 0) >>> 0);
    } else if (dir === 1) {
      m.setU32(pCurr, ((refX - curW) | 0) >>> 0);
      m.setU32((pCurr + 4) >>> 0, refY >>> 0);
    } else if (dir === 2) {
      m.setU32(pCurr, ((refX + refW - curW) | 0) >>> 0);
      m.setU32((pCurr + 4) >>> 0, ((refY - curH) | 0) >>> 0);
    } else if (dir === 3) {
      m.setU32(pCurr, ((refX + refW) | 0) >>> 0);
      m.setU32((pCurr + 4) >>> 0, ((refY + refH - curH + 8) | 0) >>> 0);
    }
    m.setU32(GDW_ACT4_STEP_FLAG_VA, 0x800000);
    return 1;
  }

  if (dir === 0) {
    m.setU32(pCurr, ((refX + refW - curW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + refH) | 0) >>> 0);
  } else if (dir === 1) {
    m.setU32(pCurr, ((refX - curW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + refH - curH) | 0) >>> 0);
  } else if (dir === 2) {
    m.setU32(pCurr, refX >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY - curH) | 0) >>> 0);
  } else if (dir === 3) {
    m.setU32(pCurr, ((refX + refW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY - 8) | 0) >>> 0);
  }
  m.setU32(GDW_ACT4_STEP_FLAG_VA, 0x400000);
  return 1;
}

/**
 * `@va D2Common:0x6FD64D00` (`DRLGOUTPLACE_LinkAct3KurastCauseway113c`, not exported;
 * `__fastcall(ecx = pLinkData) -> BOOL`, `ret`).
 *
 * Cycles `nRand0[iter]` through `0..7` (`signedMod8`) starting from `stepLinkSeed & 7`;
 * places `pCoord[iter]` on one of the 4 cardinal sides of `pCoord[targetIdx]` (`dir >> 1`).
 */
export function DRLGOUTPLACE_LinkAct3KurastCauseway113c(
  m: Memory113c,
  pLinkData: number,
): number {
  const base = pLinkData >>> 0;
  const iter = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const rand1Addr = (base + D2DrlgLevelLinkDataStrc.nRand1.off + (iter << 2)) >>> 0;
  const rand1 = m.u32(rand1Addr) | 0;

  if (rand1 === -1) {
    const r = stepLinkSeed(m, base) & 7;
    m.setU32(rand1Addr, r >>> 0);
    const iterNow = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
    const r1 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand1.off + (iterNow << 2)) >>> 0);
    m.setU32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iterNow << 2)) >>> 0, r1);
  } else {
    const rand0Addr = (base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter << 2)) >>> 0;
    const next = signedMod8(((m.u32(rand0Addr) | 0) + 1) | 0);
    if (next === rand1) {
      return 0;
    }
    m.setU32(rand0Addr, next >>> 0);
  }

  const iter2 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const pLinkArr = m.u32((base + D2DrlgLevelLinkDataStrc.pLink.off) >>> 0);
  const dir = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter2 << 2)) >>> 0) >>> 0;
  const targetIdx = m.u32((pLinkArr + (iter2 << 4) + 8) >>> 0) | 0;

  const pRef = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (targetIdx << 4)) >>> 0;
  const pCurr = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (iter2 << 4)) >>> 0;
  const refX = m.u32(pRef) | 0;
  const refY = m.u32((pRef + 4) >>> 0) | 0;
  const refW = m.u32((pRef + 8) >>> 0) | 0;
  const refH = m.u32((pRef + 12) >>> 0) | 0;
  const curW = m.u32((pCurr + 8) >>> 0) | 0;
  const curH = m.u32((pCurr + 12) >>> 0) | 0;

  if (dir === 0 || dir === 1) {
    m.setU32(pCurr, refX >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + refH) | 0) >>> 0);
  } else if (dir === 2 || dir === 3) {
    m.setU32(pCurr, ((refX - curW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, refY >>> 0);
  } else if (dir === 4 || dir === 5) {
    m.setU32(pCurr, refX >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY - curH) | 0) >>> 0);
  } else if (dir === 6 || dir === 7) {
    m.setU32(pCurr, ((refX + refW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, refY >>> 0);
  }
  return 1;
}

/**
 * `@va D2Common:0x6FD64E30` (`DRLGOUTPLACE_LinkAct3SpiderForest113c`, not exported;
 * `__fastcall(ecx = pLinkData) -> BOOL`, `ret`).
 *
 * Alternates `nRand0[iter]` between `1` and `2` starting from `((stepLinkSeed & 1) + 1)`,
 * and places `pCoord[iter]` relative to `pCoord[targetIdx]`.
 */
export function DRLGOUTPLACE_LinkAct3SpiderForest113c(
  m: Memory113c,
  pLinkData: number,
): number {
  const base = pLinkData >>> 0;
  const iter = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const rand1Addr = (base + D2DrlgLevelLinkDataStrc.nRand1.off + (iter << 2)) >>> 0;
  const rand1 = m.u32(rand1Addr) | 0;

  if (rand1 === -1) {
    const r = ((stepLinkSeed(m, base) & 1) + 1) | 0;
    m.setU32(rand1Addr, r >>> 0);
    const iterNow = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
    const r1 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand1.off + (iterNow << 2)) >>> 0);
    m.setU32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iterNow << 2)) >>> 0, r1);
  } else {
    const rand0Addr = (base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter << 2)) >>> 0;
    const cur = m.u32(rand0Addr) | 0;
    const next = cur === 1 ? 2 : 1;
    if (next === rand1) {
      return 0;
    }
    m.setU32(rand0Addr, next >>> 0);
  }

  const iter2 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const pLinkArr = m.u32((base + D2DrlgLevelLinkDataStrc.pLink.off) >>> 0);
  const dir = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter2 << 2)) >>> 0) >>> 0;
  const targetIdx = m.u32((pLinkArr + (iter2 << 4) + 8) >>> 0) | 0;

  const pRef = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (targetIdx << 4)) >>> 0;
  const pCurr = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (iter2 << 4)) >>> 0;
  const refX = m.u32(pRef) | 0;
  const refY = m.u32((pRef + 4) >>> 0) | 0;
  const refW = m.u32((pRef + 8) >>> 0) | 0;
  const refH = m.u32((pRef + 12) >>> 0) | 0;
  const curW = m.u32((pCurr + 8) >>> 0) | 0;
  const curH = m.u32((pCurr + 12) >>> 0) | 0;

  if (dir === 1) {
    m.setU32(pCurr, ((refX - curW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, refY >>> 0);
    return 1;
  }
  if (dir === 0) {
    m.setU32(pCurr, ((refX + refW - curW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + refH) | 0) >>> 0);
  } else if (dir === 2) {
    m.setU32(pCurr, refX >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY - curH) | 0) >>> 0);
  } else if (dir === 3) {
    m.setU32(pCurr, ((refX + refW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, refY >>> 0);
  }
  return 1;
}

/**
 * `@va D2Common:0x6FD64F90` (`DRLGOUTPLACE_LinkAct1Rotating113c`, not exported;
 * `__fastcall(ecx = pLinkData) -> BOOL`, `ret`).
 *
 * Steps a 2D state `(nRand0[iter] in 0..3, nRand2[iter] in 0..1)` with `nRand1`/`nRand3` start markers,
 * rotates `pCoord[iter]` dimensions between `(56, 96)` (`0x38, 0x60`) and `(96, 56)` (`0x60, 0x38`)
 * according to `nRand0[iter] % 2`, and positions `pCoord[iter]` relative to `pCoord[targetIdx]` with `±16` offsets.
 */
export function DRLGOUTPLACE_LinkAct1Rotating113c(m: Memory113c, pLinkData: number): number {
  const base = pLinkData >>> 0;
  const iter = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const rand1Addr = (base + D2DrlgLevelLinkDataStrc.nRand1.off + (iter << 2)) >>> 0;
  const rand1 = m.u32(rand1Addr) | 0;

  let next2: number;
  let idxForStore2: number;
  if (rand1 === -1) {
    const r0 = stepLinkSeed(m, base) & 3;
    m.setU32(rand1Addr, r0 >>> 0);
    const iterA = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
    const savedR1 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand1.off + (iterA << 2)) >>> 0);
    m.setU32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iterA << 2)) >>> 0, savedR1);

    const r2 = stepLinkSeed(m, base) & 1;
    const iterB = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
    m.setU32((base + D2DrlgLevelLinkDataStrc.nRand3.off + (iterB << 2)) >>> 0, r2 >>> 0);
    idxForStore2 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
    next2 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand3.off + (idxForStore2 << 2)) >>> 0) | 0;
  } else {
    const cur2 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand2.off + (iter << 2)) >>> 0) | 0;
    const cur0 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter << 2)) >>> 0) | 0;
    const next0 = signedMod4((cur0 + cur2) | 0);
    next2 = signedMod2((cur2 + 1) | 0);
    const rand3 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand3.off + (iter << 2)) >>> 0) | 0;
    if (next0 === rand1 && next2 === rand3) {
      return 0;
    }
    m.setU32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter << 2)) >>> 0, next0 >>> 0);
    idxForStore2 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  }

  m.setU32((base + D2DrlgLevelLinkDataStrc.nRand2.off + (idxForStore2 << 2)) >>> 0, next2 >>> 0);

  const iterW = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const parityW = signedMod2(m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iterW << 2)) >>> 0) | 0);
  const newW = parityW !== 0 ? 0x60 : 0x38;
  m.setU32((base + (((iterW + 1) << 4) >>> 0)) >>> 0, newW >>> 0);

  const iterH = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const parityH = signedMod2(m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iterH << 2)) >>> 0) | 0);
  const newH = parityH !== 0 ? 0x38 : 0x60;
  m.setU32((base + (iterH << 4) + 0x14) >>> 0, newH >>> 0);

  const iterP = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const pLinkArr = m.u32((base + D2DrlgLevelLinkDataStrc.pLink.off) >>> 0);
  const branch = m.u32((base + D2DrlgLevelLinkDataStrc.nRand2.off + (iterP << 2)) >>> 0) | 0;
  const dir = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iterP << 2)) >>> 0) >>> 0;
  const targetIdx = m.u32((pLinkArr + (iterP << 4) + 8) >>> 0) | 0;

  const pRef = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (targetIdx << 4)) >>> 0;
  const pCurr = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (iterP << 4)) >>> 0;
  const refX = m.u32(pRef) | 0;
  const refY = m.u32((pRef + 4) >>> 0) | 0;
  const refW = m.u32((pRef + 8) >>> 0) | 0;
  const refH = m.u32((pRef + 12) >>> 0) | 0;
  const curW = m.u32((pCurr + 8) >>> 0) | 0;
  const curH = m.u32((pCurr + 12) >>> 0) | 0;

  if (branch === 1) {
    if (dir === 0) {
      m.setU32(pCurr, ((refX - 0x10) | 0) >>> 0);
      m.setU32((pCurr + 4) >>> 0, ((refY + refH) | 0) >>> 0);
    } else if (dir === 1) {
      m.setU32(pCurr, ((refX - curW) | 0) >>> 0);
      m.setU32((pCurr + 4) >>> 0, ((refY - 0x10) | 0) >>> 0);
    } else if (dir === 2) {
      m.setU32(pCurr, ((refX + refW - curW + 0x10) | 0) >>> 0);
      m.setU32((pCurr + 4) >>> 0, ((refY - curH) | 0) >>> 0);
    } else if (dir === 3) {
      m.setU32(pCurr, ((refX + refW) | 0) >>> 0);
      m.setU32((pCurr + 4) >>> 0, ((refY + refH - curH + 0x10) | 0) >>> 0);
    }
    return 1;
  }

  if (dir === 0) {
    m.setU32(pCurr, ((refX + refW - curW + 0x10) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + refH) | 0) >>> 0);
  } else if (dir === 1) {
    m.setU32(pCurr, ((refX - curW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + refH - curH + 0x10) | 0) >>> 0);
  } else if (dir === 2) {
    m.setU32(pCurr, ((refX - 0x10) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY - curH) | 0) >>> 0);
  } else if (dir === 3) {
    m.setU32(pCurr, ((refX + refW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY - 0x10) | 0) >>> 0);
  }
  return 1;
}

/**
 * `@va D2Common:0x6FD65250` (`DRLGOUTPLACE_LinkAct1FixedSize113c`, not exported;
 * `__fastcall(ecx = pLinkData) -> BOOL`, `ret`).
 *
 * Steps `(nRand0[iter] in 0..3, nRand2[iter] in 0..1)` with `nRand1`/`nRand3` start markers
 * (preserving existing `nWidth`/`nHeight`) and positions `pCoord[iter]` relative to `pCoord[targetIdx]`.
 */
export function DRLGOUTPLACE_LinkAct1FixedSize113c(m: Memory113c, pLinkData: number): number {
  const base = pLinkData >>> 0;
  const iter = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const rand1Addr = (base + D2DrlgLevelLinkDataStrc.nRand1.off + (iter << 2)) >>> 0;
  const rand1 = m.u32(rand1Addr) | 0;

  let next2: number;
  let idxForStore2: number;
  if (rand1 === -1) {
    const r0 = stepLinkSeed(m, base) & 3;
    m.setU32(rand1Addr, r0 >>> 0);
    const iterA = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
    const savedR1 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand1.off + (iterA << 2)) >>> 0);
    m.setU32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iterA << 2)) >>> 0, savedR1);

    const r2 = stepLinkSeed(m, base) & 1;
    const iterB = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
    m.setU32((base + D2DrlgLevelLinkDataStrc.nRand3.off + (iterB << 2)) >>> 0, r2 >>> 0);
    idxForStore2 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
    next2 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand3.off + (idxForStore2 << 2)) >>> 0) | 0;
  } else {
    const cur2 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand2.off + (iter << 2)) >>> 0) | 0;
    const cur0 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter << 2)) >>> 0) | 0;
    const next0 = signedMod4((cur0 + cur2) | 0);
    next2 = signedMod2((cur2 + 1) | 0);
    const rand3 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand3.off + (iter << 2)) >>> 0) | 0;
    if (next0 === rand1 && next2 === rand3) {
      return 0;
    }
    m.setU32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter << 2)) >>> 0, next0 >>> 0);
    idxForStore2 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  }

  m.setU32((base + D2DrlgLevelLinkDataStrc.nRand2.off + (idxForStore2 << 2)) >>> 0, next2 >>> 0);

  const iterP = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const pLinkArr = m.u32((base + D2DrlgLevelLinkDataStrc.pLink.off) >>> 0);
  const branch = m.u32((base + D2DrlgLevelLinkDataStrc.nRand2.off + (iterP << 2)) >>> 0) | 0;
  const dir = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iterP << 2)) >>> 0) >>> 0;
  const targetIdx = m.u32((pLinkArr + (iterP << 4) + 8) >>> 0) | 0;

  const pRef = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (targetIdx << 4)) >>> 0;
  const pCurr = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (iterP << 4)) >>> 0;
  const refX = m.u32(pRef) | 0;
  const refY = m.u32((pRef + 4) >>> 0) | 0;
  const refW = m.u32((pRef + 8) >>> 0) | 0;
  const refH = m.u32((pRef + 12) >>> 0) | 0;
  const curW = m.u32((pCurr + 8) >>> 0) | 0;
  const curH = m.u32((pCurr + 12) >>> 0) | 0;

  if (branch === 1) {
    if (dir === 0) {
      m.setU32(pCurr, refX >>> 0);
      m.setU32((pCurr + 4) >>> 0, ((refY + refH) | 0) >>> 0);
    } else if (dir === 1) {
      m.setU32(pCurr, ((refX - curW) | 0) >>> 0);
      m.setU32((pCurr + 4) >>> 0, ((refY + 8) | 0) >>> 0);
    } else if (dir === 2) {
      m.setU32(pCurr, ((refX + refW - curW) | 0) >>> 0);
      m.setU32((pCurr + 4) >>> 0, ((refY - curH) | 0) >>> 0);
    } else if (dir === 3) {
      m.setU32(pCurr, ((refX + refW) | 0) >>> 0);
      m.setU32((pCurr + 4) >>> 0, ((refY + refH - curH - 8) | 0) >>> 0);
    }
    return 1;
  }

  if (dir === 0) {
    m.setU32(pCurr, ((refX + refW - curW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + refH) | 0) >>> 0);
  } else if (dir === 1) {
    m.setU32(pCurr, ((refX - curW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + refH - curH - 8) | 0) >>> 0);
  } else if (dir === 2) {
    m.setU32(pCurr, refX >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY - curH) | 0) >>> 0);
  } else if (dir === 3) {
    m.setU32(pCurr, ((refX + refW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + 8) | 0) >>> 0);
  }
  return 1;
}

/**
 * `@va D2Common:0x6FD65480` (`DRLGOUTPLACE_LinkAct3Jungle113c`, not exported;
 * `__fastcall(ecx = pLinkData) -> BOOL`, `ret`).
 *
 * Cycles `nRand0[iter]` through `0..7` (`signedMod8`) starting from `stepLinkSeed & 7` and
 * places `pCoord[iter]` with half-dimension (`w / 2` or `h / 2` signed division) and `±8` offsets.
 */
export function DRLGOUTPLACE_LinkAct3Jungle113c(m: Memory113c, pLinkData: number): number {
  const base = pLinkData >>> 0;
  const iter = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const rand1Addr = (base + D2DrlgLevelLinkDataStrc.nRand1.off + (iter << 2)) >>> 0;
  const rand1 = m.u32(rand1Addr) | 0;

  if (rand1 === -1) {
    const r = stepLinkSeed(m, base) & 7;
    m.setU32(rand1Addr, r >>> 0);
    const iterNow = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
    const r1 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand1.off + (iterNow << 2)) >>> 0);
    m.setU32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iterNow << 2)) >>> 0, r1);
  } else {
    const rand0Addr = (base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter << 2)) >>> 0;
    const next = signedMod8(((m.u32(rand0Addr) | 0) + 1) | 0);
    if (next === rand1) {
      return 0;
    }
    m.setU32(rand0Addr, next >>> 0);
  }

  const iter2 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const pLinkArr = m.u32((base + D2DrlgLevelLinkDataStrc.pLink.off) >>> 0);
  const dir = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter2 << 2)) >>> 0) >>> 0;
  const targetIdx = m.u32((pLinkArr + (iter2 << 4) + 8) >>> 0) | 0;

  const pRef = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (targetIdx << 4)) >>> 0;
  const pCurr = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (iter2 << 4)) >>> 0;
  const refX = m.u32(pRef) | 0;
  const refY = m.u32((pRef + 4) >>> 0) | 0;
  const refW = m.u32((pRef + 8) >>> 0) | 0;
  const refH = m.u32((pRef + 12) >>> 0) | 0;
  const curW = m.u32((pCurr + 8) >>> 0) | 0;
  const curH = m.u32((pCurr + 12) >>> 0) | 0;
  const halfW = ((curW - (curW >> 31)) | 0) >> 1;
  const halfH = ((curH - (curH >> 31)) | 0) >> 1;

  if (dir === 0) {
    m.setU32(pCurr, ((refX + ((-8 - halfW) | 0)) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + refH) | 0) >>> 0);
  } else if (dir === 1) {
    m.setU32(pCurr, ((refX + ((halfW + 8) | 0)) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + refH) | 0) >>> 0);
  } else if (dir === 2) {
    m.setU32(pCurr, ((refX - curW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY - halfH - 8) | 0) >>> 0);
  } else if (dir === 3) {
    m.setU32(pCurr, ((refX - curW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + halfH + 8) | 0) >>> 0);
  } else if (dir === 4) {
    m.setU32(pCurr, ((refX + ((-8 - halfW) | 0)) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY - curH) | 0) >>> 0);
  } else if (dir === 5) {
    m.setU32(pCurr, ((refX + ((halfW + 8) | 0)) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY - curH) | 0) >>> 0);
  } else if (dir === 6) {
    m.setU32(pCurr, ((refX + refW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY - halfH - 8) | 0) >>> 0);
  } else if (dir === 7) {
    m.setU32(pCurr, ((refX + refW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + halfH + 8) | 0) >>> 0);
  }
  return 1;
}

/**
 * `@va D2Common:0x6FD65680` (`DRLGOUTPLACE_LinkQuadrant4_113c`, not exported;
 * `__fastcall(ecx = pLinkData) -> BOOL`, `ret`).
 *
 * Cycles `nRand0[iter]` through `0..3` (`signedMod4`) starting from `stepLinkSeed & 3` and
 * places `pCoord[iter]` around `pCoord[targetIdx]` with `±16` (`0x10`) offsets.
 */
export function DRLGOUTPLACE_LinkQuadrant4_113c(m: Memory113c, pLinkData: number): number {
  const base = pLinkData >>> 0;
  const iter = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const rand1Addr = (base + D2DrlgLevelLinkDataStrc.nRand1.off + (iter << 2)) >>> 0;
  const rand1 = m.u32(rand1Addr) | 0;

  if (rand1 === -1) {
    const r = stepLinkSeed(m, base) & 3;
    m.setU32(rand1Addr, r >>> 0);
    const iterNow = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
    const r1 = m.u32((base + D2DrlgLevelLinkDataStrc.nRand1.off + (iterNow << 2)) >>> 0);
    m.setU32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iterNow << 2)) >>> 0, r1);
  } else {
    const rand0Addr = (base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter << 2)) >>> 0;
    const next = signedMod4(((m.u32(rand0Addr) | 0) + 1) | 0);
    if (next === rand1) {
      return 0;
    }
    m.setU32(rand0Addr, next >>> 0);
  }

  const iter2 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const pLinkArr = m.u32((base + D2DrlgLevelLinkDataStrc.pLink.off) >>> 0);
  const dir = m.u32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter2 << 2)) >>> 0) >>> 0;
  const targetIdx = m.u32((pLinkArr + (iter2 << 4) + 8) >>> 0) | 0;

  const pRef = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (targetIdx << 4)) >>> 0;
  const pCurr = (base + D2DrlgLevelLinkDataStrc.nPosX.off + (iter2 << 4)) >>> 0;
  const refX = m.u32(pRef) | 0;
  const refY = m.u32((pRef + 4) >>> 0) | 0;
  const refW = m.u32((pRef + 8) >>> 0) | 0;
  const refH = m.u32((pRef + 12) >>> 0) | 0;
  const curW = m.u32((pCurr + 8) >>> 0) | 0;
  const curH = m.u32((pCurr + 12) >>> 0) | 0;

  if (dir === 0) {
    m.setU32(pCurr, ((refX - 0x10) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + refH) | 0) >>> 0);
  } else if (dir === 1) {
    m.setU32(pCurr, ((refX - curW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY - 0x10) | 0) >>> 0);
  } else if (dir === 2) {
    m.setU32(pCurr, ((refX + refW - curW + 0x10) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY - curH) | 0) >>> 0);
  } else if (dir === 3) {
    m.setU32(pCurr, ((refX + refW) | 0) >>> 0);
    m.setU32((pCurr + 4) >>> 0, ((refY + refH - curH + 0x10) | 0) >>> 0);
  }
  return 1;
}

/**
 * `@va D2Common:0x6FD657D0` (`DRLGOUTPLACE_LinkFromLevelDef113c`, not exported;
 * `__fastcall(ecx = pLinkData) -> BOOL`, `ret`).
 *
 * Copies `(dwOffsetX, dwOffsetY)` (`+0x24`, `+0x28`) from `sgptDataTables.pLevelDefBin[nCurrentLevel]`
 * (`0x6FDF0B38`, stride `0x9C`) into `pLinkData->pCoord[nIteration].(nPosX, nPosY)` and returns `1`.
 */
export function DRLGOUTPLACE_LinkFromLevelDef113c(m: Memory113c, pLinkData: number): number {
  const base = pLinkData >>> 0;
  const iter0 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const rand1Addr = (base + D2DrlgLevelLinkDataStrc.nRand1.off + (iter0 << 2)) >>> 0;
  if ((m.u32(rand1Addr) | 0) === -1) {
    const r1 = m.u32(rand1Addr);
    m.setU32((base + D2DrlgLevelLinkDataStrc.nRand0.off + (iter0 << 2)) >>> 0, r1);
  }

  const nLevelId = m.u32((base + D2DrlgLevelLinkDataStrc.nCurrentLevel.off) >>> 0) | 0;
  let pLevelDef = 0;
  if (nLevelId >= 0) {
    const gpDataTables = m.u32(SGPT_DATA_TABLES_PTR_VA);
    const nLevelsCount = m.u32((gpDataTables + 0xc5c) >>> 0) | 0;
    if (nLevelId < nLevelsCount) {
      pLevelDef = (m.u32(SGPT_LEVELDEF_BIN_VA) + Math.imul(nLevelId, D2LevelDefBin_SIZE)) >>> 0;
    }
  }

  const iter1 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const dwOffsetX = m.u32((pLevelDef + D2LevelDefBin.dwOffsetX.off) >>> 0);
  m.setU32((base + D2DrlgLevelLinkDataStrc.nPosX.off + (iter1 << 4)) >>> 0, dwOffsetX);

  const iter2 = m.u32((base + D2DrlgLevelLinkDataStrc.nIteration.off) >>> 0) | 0;
  const dwOffsetY = m.u32((pLevelDef + D2LevelDefBin.dwOffsetY.off) >>> 0);
  m.setU32((base + D2DrlgLevelLinkDataStrc.nPosY.off + (iter2 << 4)) >>> 0, dwOffsetY);
  return 1;
}

/**
 * `@va D2Common:0x6FD65840` (`DRLGOUTPLACE_MarkBorderGridCells113c`, not exported;
 * custom LTCG `eax = pLevel`, `ret`).
 *
 * Sweeps from all 4 corners of `pLevel->pOutdoors->pGrid2` (`(0, 0)` step `(+1, +1)`,
 * `(W-1, 0)` step `(-1, +1)`, `(0, H-1)` step `(+1, -1)`, `(W-1, H-1)` step `(-1, -1)`),
 * calling `DRLGGRID_BitwiseOrCell113c(m, cellAddr, 0x100)` (`0x6FD86C10` via `0x6FDEB244`)
 * on cells until a cell with bit `0` (`& 1`) set is encountered along each row/column.
 */
export function DRLGOUTPLACE_MarkBorderGridCells113c(m: Memory113c, pLevel: number): void {
  const pOutdoors = m.u32(((pLevel >>> 0) + D2DrlgLevelStrc.pOutdoors.off) >>> 0);
  const passes: ReadonlyArray< readonly [number, number, number, number]> = [
    [0, 0, 1, 1],
    [1, 0, -1, 1],
    [0, 1, 1, -1],
    [1, 1, -1, -1],
  ];

  for (let p = 0; p < 4; p++) {
    const [bRight, bBottom, stepX, stepY] = passes[p]!;
    const startX =
      bRight !== 0
        ? ((m.u32((pOutdoors + D2DrlgOutdoorInfoStrc.nGridWidth.off) >>> 0) | 0) - 1) | 0
        : 0;
    let curY =
      bBottom !== 0
        ? ((m.u32((pOutdoors + D2DrlgOutdoorInfoStrc.nGridHeight.off) >>> 0) | 0) - 1) | 0
        : 0;

    let pRowOffsets = m.u32((pOutdoors + D2DrlgOutdoorInfoStrc.pGrid2RowOffsets.off) >>> 0);
    let rowBase = m.u32((pRowOffsets + ((curY << 2) >>> 0)) >>> 0) | 0;
    let pCells = m.u32((pOutdoors + D2DrlgOutdoorInfoStrc.pGrid2Cells.off) >>> 0);

    if ((m.u8((pCells + (((rowBase + startX) << 2) >>> 0)) >>> 0) & 1) === 0) {
      do {
        pRowOffsets = m.u32((pOutdoors + D2DrlgOutdoorInfoStrc.pGrid2RowOffsets.off) >>> 0);
        rowBase = m.u32((pRowOffsets + ((curY << 2) >>> 0)) >>> 0) | 0;
        pCells = m.u32((pOutdoors + D2DrlgOutdoorInfoStrc.pGrid2Cells.off) >>> 0);
        let curX = startX;
        if ((m.u8((pCells + (((rowBase + startX) << 2) >>> 0)) >>> 0) & 1) === 0) {
          do {
            pRowOffsets = m.u32((pOutdoors + D2DrlgOutdoorInfoStrc.pGrid2RowOffsets.off) >>> 0);
            rowBase = m.u32((pRowOffsets + ((curY << 2) >>> 0)) >>> 0) | 0;
            pCells = m.u32((pOutdoors + D2DrlgOutdoorInfoStrc.pGrid2Cells.off) >>> 0);
            const cellAddr = (pCells + (((rowBase + curX) << 2) >>> 0)) >>> 0;
            DRLGGRID_BitwiseOrCell113c(m, cellAddr, 0x100);
            curX = (curX + stepX) | 0;
            pCells = m.u32((pOutdoors + D2DrlgOutdoorInfoStrc.pGrid2Cells.off) >>> 0);
            pRowOffsets = m.u32((pOutdoors + D2DrlgOutdoorInfoStrc.pGrid2RowOffsets.off) >>> 0);
            rowBase = m.u32((pRowOffsets + ((curY << 2) >>> 0)) >>> 0) | 0;
          } while ((m.u8((pCells + (((rowBase + curX) << 2) >>> 0)) >>> 0) & 1) === 0);
        }

        curY = (curY + stepY) | 0;
        pRowOffsets = m.u32((pOutdoors + D2DrlgOutdoorInfoStrc.pGrid2RowOffsets.off) >>> 0);
        rowBase = m.u32((pRowOffsets + ((curY << 2) >>> 0)) >>> 0) | 0;
        pCells = m.u32((pOutdoors + D2DrlgOutdoorInfoStrc.pGrid2Cells.off) >>> 0);
      } while ((m.u8((pCells + (((rowBase + startX) << 2) >>> 0)) >>> 0) & 1) === 0);
    }
  }
}

const ACT5_OUTPLACE_TILE_MAP_6FDE51E4: readonly number[] = [
  16711681, 575, 576, 577, 578, 579, 580, 0, 581, 582, 583, 0, 584, 0, 0, 0, 0, 0, 545, 546, 547, 548, 0, 549, 550, 0, 0, 551,
  552, 553, 554, 0, 555, 0, 556, 0, 557, 558, 0, 0, 559, 0, 0, 0, 560, 561, 562, 563, 0, 0, 564, 565, 0, 566, 0, 567, 0, 0, 0,
  568, 0, 569, 570, 0, 0, 0, 571, 0, 0, 572, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
];

const OUTPLACE_LINK_RDATA_BASE = 0x6fddcbe8;
const OUTPLACE_LINK_RDATA_6FDDCBE8: readonly number[] = [
  /* +0x000 (0x6fddcbe8) */ 0x6fd657d0, 0x00000004, 0xffffffff, 0xffffffff, 0x6fd65680, 0x00000003, 0x00000000, 0xffffffff,
  /* +0x020 (0x6fddcc08) */ 0x6fd64f90, 0x00000002, 0x00000001, 0xffffffff, 0x6fd65250, 0x00000001, 0x00000002, 0xffffffff,
  /* +0x040 (0x6fddcc28) */ 0x6fd65680, 0x00000011, 0x00000001, 0xffffffff, 0x00000000, 0x00000000, 0xffffffff, 0xffffffff,
  /* +0x060 (0x6fddcc48) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x080 (0x6fddcc68) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x0a0 (0x6fddcc88) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x0c0 (0x6fddcca8) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x0e0 (0x6fddccc8) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x6fd657d0, 0x00000027, 0xffffffff, 0xffffffff,
  /* +0x100 (0x6fddcce8) */ 0x6fd657d0, 0x0000001a, 0xffffffff, 0xffffffff, 0x6fd644c0, 0x00000007, 0x00000001, 0xffffffff,
  /* +0x120 (0x6fddcd08) */ 0x6fd65680, 0x00000006, 0x00000002, 0xffffffff, 0x6fd65680, 0x00000005, 0x00000003, 0xffffffff,
  /* +0x140 (0x6fddcd28) */ 0x00000000, 0x00000000, 0xffffffff, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x160 (0x6fddcd48) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x180 (0x6fddcd68) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x1a0 (0x6fddcd88) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x1c0 (0x6fddcda8) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x1e0 (0x6fddcdc8) */ 0x6fd657d0, 0x00000028, 0xffffffff, 0xffffffff, 0x6fd64e30, 0x00000029, 0x00000000, 0xffffffff,
  /* +0x200 (0x6fddcde8) */ 0x6fd65480, 0x0000002a, 0x00000001, 0xffffffff, 0x6fd65480, 0x0000002b, 0x00000002, 0xffffffff,
  /* +0x220 (0x6fddce08) */ 0x6fd65480, 0x0000002c, 0x00000003, 0xffffffff, 0x6fd64d00, 0x0000002d, 0x00000004, 0xffffffff,
  /* +0x240 (0x6fddce28) */ 0x00000000, 0x00000000, 0xffffffff, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x260 (0x6fddce48) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x280 (0x6fddce68) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x2a0 (0x6fddce88) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x2c0 (0x6fddcea8) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x6fd657d0, 0x0000002e, 0xffffffff, 0xffffffff,
  /* +0x2e0 (0x6fddcec8) */ 0x00000000, 0x00000000, 0xffffffff, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x300 (0x6fddcee8) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x320 (0x6fddcf08) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x340 (0x6fddcf28) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x360 (0x6fddcf48) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x380 (0x6fddcf68) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x3a0 (0x6fddcf88) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x3c0 (0x6fddcfa8) */ 0x6fd657d0, 0x00000086, 0xffffffff, 0xffffffff, 0x6fd657d0, 0x00000088, 0xffffffff, 0xffffffff,
  /* +0x3e0 (0x6fddcfc8) */ 0x00000000, 0x00000000, 0xffffffff, 0xffffffff, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x400 (0x6fddcfe8) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x420 (0x6fddd008) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x440 (0x6fddd028) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x460 (0x6fddd048) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x480 (0x6fddd068) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x4a0 (0x6fddd088) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x6fd657d0, 0x00000067, 0xffffffff, 0xffffffff,
  /* +0x4c0 (0x6fddd0a8) */ 0x6fd64b00, 0x00000068, 0x00000000, 0xffffffff, 0x6fd65680, 0x00000069, 0x00000001, 0xffffffff,
  /* +0x4e0 (0x6fddd0c8) */ 0x6fd65680, 0x0000006a, 0x00000002, 0xffffffff, 0x00000000, 0x00000000, 0xffffffff, 0xffffffff,
  /* +0x500 (0x6fddd0e8) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x520 (0x6fddd108) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x540 (0x6fddd128) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x560 (0x6fddd148) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x580 (0x6fddd168) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x5a0 (0x6fddd188) */ 0x6fd657d0, 0x0000006c, 0xffffffff, 0xffffffff, 0x00000000, 0x00000000, 0xffffffff, 0xffffffff,
  /* +0x5c0 (0x6fddd1a8) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x5e0 (0x6fddd1c8) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x600 (0x6fddd1e8) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x620 (0x6fddd208) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x640 (0x6fddd228) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x660 (0x6fddd248) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x680 (0x6fddd268) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x6fd657d0, 0x0000006d, 0xffffffff, 0xffffffff,
  /* +0x6a0 (0x6fddd288) */ 0x6fd657d0, 0x0000006e, 0x00000000, 0xffffffff, 0x6fd90fc0, 0x0000006f, 0x00000001, 0xffffffff,
  /* +0x6c0 (0x6fddd2a8) */ 0x6fd90e10, 0x00000070, 0x00000002, 0xffffffff, 0x00000000, 0x00000000, 0xffffffff, 0xffffffff,
  /* +0x6e0 (0x6fddd2c8) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x700 (0x6fddd2e8) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x720 (0x6fddd308) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x740 (0x6fddd328) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x760 (0x6fddd348) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x780 (0x6fddd368) */ 0x6fd90f00, 0x00000075, 0xffffffff, 0xffffffff, 0x00000000, 0x00000000, 0xffffffff, 0xffffffff,
];
const OUTPLACE_LINK_RDATA_END = (OUTPLACE_LINK_RDATA_BASE + (OUTPLACE_LINK_RDATA_6FDDCBE8.length << 2)) >>> 0;

const OUTPLACE_VERTEX_COMPAT_RDATA_BASE = 0x6fde5350;
const OUTPLACE_VERTEX_COMPAT_RDATA_6FDE5350: readonly number[] = [
  /* +0x000 (0x6fde5350) */ 0x00000000, 0x00000002, 0x00000003, 0x00000001, 0x00000000, 0x00000004, 0x00000000, 0x00000002,
  /* +0x020 (0x6fde5370) */ 0x00000003, 0x00000002, 0x00000003, 0x00000004, 0x00000000, 0x00000003, 0x00000011, 0x00000002,
  /* +0x040 (0x6fde5390) */ 0x00000001, 0x00000008, 0x00000000, 0x00000003, 0x00000011, 0x00000003, 0x00000000, 0x00000008,
  /* +0x060 (0x6fde53b0) */ 0x00000000, 0x00000003, 0x00000011, 0x00000001, 0x00000001, 0x00000010, 0x00000000, 0x00000003,
  /* +0x080 (0x6fde53d0) */ 0x00000011, 0x00000003, 0x00000003, 0x00000010, 0x00000002, 0x00000000, 0x00000000, 0x00000000,
  /* +0x0a0 (0x6fde53f0) */ 0x00000000, 0x00000008, 0x00000002, 0x00000000, 0x00000000, 0x00000002, 0x00000002, 0x00000008,
  /* +0x0c0 (0x6fde5410) */ 0x00000002, 0x00000000, 0x00000000, 0x00000003, 0x00000000, 0x00000008, 0x00000002, 0x00000000,
  /* +0x0e0 (0x6fde5430) */ 0x00000000, 0x00000003, 0x00000002, 0x00000008, 0x00000002, 0x00000000, 0x00000000, 0x00000000,
  /* +0x100 (0x6fde5450) */ 0x00000001, 0x00000400, 0x00000002, 0x00000000, 0x00000000, 0x00000001, 0x00000001, 0x00000400,
  /* +0x120 (0x6fde5470) */ 0x00000002, 0x00000000, 0x00000000, 0x00000002, 0x00000001, 0x00000200, 0x00000002, 0x00000000,
  /* +0x140 (0x6fde5490) */ 0x00000000, 0x00000002, 0x00000002, 0x00000080, 0x00000002, 0x00000000, 0x00000000, 0x00000003,
  /* +0x160 (0x6fde54b0) */ 0x00000002, 0x00000100, 0x00000001, 0x00000001, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x180 (0x6fde54d0) */ 0x00000000, 0x00000000, 0x00000000, 0x00000001, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x1a0 (0x6fde54f0) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000001, 0x00000000, 0x00000001,
  /* +0x1c0 (0x6fde5510) */ 0x00000000, 0x00000000, 0x00000001, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x1e0 (0x6fde5530) */ 0x00000001, 0x00000001, 0x00000000, 0x00000001, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x200 (0x6fde5550) */ 0x00000000, 0x00000001, 0x00000000, 0x00000001, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x220 (0x6fde5570) */ 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000001,
  /* +0x240 (0x6fde5590) */ 0x00000001, 0x00000000, 0x00000001, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000,
  /* +0x260 (0x6fde55b0) */ 0x00000001, 0x00000001,
];
const OUTPLACE_VERTEX_COMPAT_RDATA_END =
  (OUTPLACE_VERTEX_COMPAT_RDATA_BASE + (OUTPLACE_VERTEX_COMPAT_RDATA_6FDE5350.length << 2)) >>> 0;

const OUTPLACE_STACK_BASE = 0x7e400000;
function withOutPlaceScratch113c(m: Memory113c): Memory113c {
  const mem = m as Memory113c & {
    free?: (ptr: number) => void;
  };
  const buf = new Uint8Array(0x400);
  const dv = new DataView(buf.buffer);
  const end = (OUTPLACE_STACK_BASE + 0x400) >>> 0;
  const self: Memory113c & { free?: (ptr: number) => void } = {
    u8(addr: number): number {
      const a = addr >>> 0;
      if (a >= OUTPLACE_STACK_BASE && a < end) return buf[a - OUTPLACE_STACK_BASE]!;
      if (a >= OUTPLACE_LINK_RDATA_BASE && a < OUTPLACE_LINK_RDATA_END) {
        const off = a - OUTPLACE_LINK_RDATA_BASE;
        return (OUTPLACE_LINK_RDATA_6FDDCBE8[off >>> 2]! >>> ((off & 3) << 3)) & 0xff;
      }
      if (a >= OUTPLACE_VERTEX_COMPAT_RDATA_BASE && a < OUTPLACE_VERTEX_COMPAT_RDATA_END) {
        const off = a - OUTPLACE_VERTEX_COMPAT_RDATA_BASE;
        return (OUTPLACE_VERTEX_COMPAT_RDATA_6FDE5350[off >>> 2]! >>> ((off & 3) << 3)) & 0xff;
      }
      return mem.u8(a);
    },
    u16(addr: number): number {
      const a = addr >>> 0;
      if (a >= OUTPLACE_STACK_BASE && a + 1 < end) return dv.getUint16(a - OUTPLACE_STACK_BASE, true);
      if (
        (a >= OUTPLACE_LINK_RDATA_BASE && a + 1 < OUTPLACE_LINK_RDATA_END) ||
        (a >= OUTPLACE_VERTEX_COMPAT_RDATA_BASE && a + 1 < OUTPLACE_VERTEX_COMPAT_RDATA_END)
      ) {
        return self.u8(a) | (self.u8((a + 1) >>> 0) << 8);
      }
      return mem.u16(a);
    },
    u32(addr: number): number {
      const a = addr >>> 0;
      if (a >= OUTPLACE_STACK_BASE && a + 3 < end) return dv.getUint32(a - OUTPLACE_STACK_BASE, true);
      if (a >= OUTPLACE_LINK_RDATA_BASE && a + 3 < OUTPLACE_LINK_RDATA_END) {
        if ((a & 3) === 0) return OUTPLACE_LINK_RDATA_6FDDCBE8[(a - OUTPLACE_LINK_RDATA_BASE) >>> 2]! >>> 0;
        return (self.u16(a) | (self.u16((a + 2) >>> 0) << 16)) >>> 0;
      }
      if (a >= OUTPLACE_VERTEX_COMPAT_RDATA_BASE && a + 3 < OUTPLACE_VERTEX_COMPAT_RDATA_END) {
        if ((a & 3) === 0) {
          return OUTPLACE_VERTEX_COMPAT_RDATA_6FDE5350[(a - OUTPLACE_VERTEX_COMPAT_RDATA_BASE) >>> 2]! >>> 0;
        }
        return (self.u16(a) | (self.u16((a + 2) >>> 0) << 16)) >>> 0;
      }
      return mem.u32(a);
    },
    setU8(addr: number, val: number): void {
      const a = addr >>> 0;
      if (a >= OUTPLACE_STACK_BASE && a < end) {
        buf[a - OUTPLACE_STACK_BASE] = val & 0xff;
        return;
      }
      mem.setU8(a, val);
    },
    setU16(addr: number, val: number): void {
      const a = addr >>> 0;
      if (a >= OUTPLACE_STACK_BASE && a + 1 < end) {
        dv.setUint16(a - OUTPLACE_STACK_BASE, val & 0xffff, true);
        return;
      }
      mem.setU16(a, val);
    },
    setU32(addr: number, val: number): void {
      const a = addr >>> 0;
      if (a >= OUTPLACE_STACK_BASE && a + 3 < end) {
        dv.setUint32(a - OUTPLACE_STACK_BASE, val >>> 0, true);
        return;
      }
      mem.setU32(a, val);
    },
    get(base: number, f: FieldLayout113c, index = 0): number {
      const idx = index | 0;
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      const p = ((base >>> 0) + f.off + idx * width) >>> 0;
      if (
        base !== 0 &&
        idx >= 0 &&
        idx < f.count &&
        ((p >= OUTPLACE_STACK_BASE && p + width <= end) ||
          (p >= OUTPLACE_LINK_RDATA_BASE && p + width <= OUTPLACE_LINK_RDATA_END) ||
          (p >= OUTPLACE_VERTEX_COMPAT_RDATA_BASE && p + width <= OUTPLACE_VERTEX_COMPAT_RDATA_END))
      ) {
        return width === 1 ? self.u8(p) : width === 2 ? self.u16(p) : self.u32(p);
      }
      return mem.get(base, f, index);
    },
    set(base: number, f: FieldLayout113c, v: number, index = 0): void {
      const idx = index | 0;
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      const p = ((base >>> 0) + f.off + idx * width) >>> 0;
      if (base !== 0 && idx >= 0 && idx < f.count && p >= OUTPLACE_STACK_BASE && p + width <= end) {
        if (width === 1) self.setU8(p, v);
        else if (width === 2) self.setU16(p, v);
        else self.setU32(p, v);
        return;
      }
      mem.set(base, f, v, index);
    },
    fill(p: number, len: number, v: number): void {
      const start = p >>> 0;
      if (start >= OUTPLACE_STACK_BASE && start + len <= end) {
        for (let i = 0; i < len; i++) self.setU8((start + i) >>> 0, v & 0xff);
        return;
      }
      mem.fill(p, len, v);
    },
    alloc: (size: number) => mem.alloc(size),
    free: (ptr: number) => mem.free?.(ptr),
  };
  return self;
}

function truncDiv2_113c(x: number): number {
  const v = x | 0;
  return ((v - (v >> 31)) >> 1) | 0;
}

function truncDiv32_113c(x: number): number {
  const v = x | 0;
  return ((v + ((v >> 31) & 0x1f)) >> 5) | 0;
}

function stepDrlgSeed64_113c(m: Memory113c, pDrlg: number): { lo: number; hi: number } {
  const pSeed = (pDrlg >>> 0);
  const lo = BigInt(m.u32(pSeed));
  const hi = BigInt(m.u32((pSeed + 4) >>> 0));
  const prod = lo * 0x6ac690c5n + hi;
  const newLo = Number(prod & 0xffffffffn) >>> 0;
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0;
  m.setU32(pSeed, newLo);
  m.setU32((pSeed + 4) >>> 0, newHi);
  return { lo: newLo, hi: newHi };
}

function seedRoll_113c(m: Memory113c, pDrlg: number, bound: number): number {
  const b = bound | 0;
  if (b <= 0) return 0;
  const { lo } = stepDrlgSeed64_113c(m, pDrlg);
  if ((b & (b - 1)) === 0) return (lo & (b - 1)) | 0;
  return (lo % (b >>> 0)) | 0;
}

function findOrAllocLevel113c(m: Memory113c, pDrlg: number, nLevelId: number): number {
  let pLvl = m.u32(((pDrlg >>> 0) + D2DrlgStrc.pLevel.off) >>> 0);
  while (pLvl !== 0) {
    if ((m.u32((pLvl + D2DrlgLevelStrc.nLevelId.off) >>> 0) | 0) === (nLevelId | 0)) {
      return pLvl >>> 0;
    }
    pLvl = m.u32((pLvl + D2DrlgLevelStrc.pNextLevel.off) >>> 0);
  }
  return DRLG_AllocAndInitLevel113c(m, pDrlg, nLevelId) >>> 0;
}

/**
 * `@va D2Common:0x6FD65980` (`DRLGOUTPLACE_PlaceAct4Levels`, stdcall `[esp+4] = pLevel`, `ret 4`, void).
 */
export function DRLGOUTPLACE_PlaceAct4Levels113c(m: Memory113c, pLevel: number): void {
  const lvl = pLevel >>> 0;
  const pDrlg = m.u32((lvl + D2DrlgLevelStrc.pDrlg.off) >>> 0);
  const halfH = truncDiv2_113c(m.u32((lvl + D2DrlgLevelStrc.nWidth.off) >>> 0) | 0);
  let accumY = 0;
  let tableOff = 0x3024;
  let nLevelId = 0x4f;

  for (let i = 0; i < 5; i++) {
    let curX = halfH;
    let recBase = 0;
    const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C);
    if (nLevelId >= 0 && nLevelId < (m.u32((sgpt + 0xc5c) >>> 0) | 0)) {
      recBase = (m.u32(SGPT_LEVELDEF_BIN_VA) + tableOff) >>> 0;
    }
    const nDiff = m.u8((pDrlg + 0x450) >>> 0);
    const w = m.u32((recBase + (nDiff << 2) + D2LevelDefBin.dwSizeX0.off) >>> 0) | 0;
    const h = m.u32((recBase + (nDiff << 2) + D2LevelDefBin.dwSizeY0.off) >>> 0) | 0;
    curX = (curX - truncDiv2_113c(w)) | 0;
    accumY = (accumY - h) | 0;

    const pTarget = findOrAllocLevel113c(m, pDrlg, nLevelId);
    m.setU32(
      (pTarget + D2DrlgLevelStrc.nPosX.off) >>> 0,
      ((m.u32((lvl + D2DrlgLevelStrc.nPosX.off) >>> 0) | 0) + curX) | 0,
    );
    m.setU32(
      (pTarget + D2DrlgLevelStrc.nPosY.off) >>> 0,
      ((m.u32((lvl + D2DrlgLevelStrc.nPosY.off) >>> 0) | 0) + accumY) | 0,
    );
    m.setU32((pTarget + D2DrlgLevelStrc.nWidth.off) >>> 0, w >>> 0);
    m.setU32((pTarget + D2DrlgLevelStrc.nHeight.off) >>> 0, h >>> 0);

    tableOff = (tableOff + D2LevelDefBin_SIZE) | 0;
    nLevelId = (nLevelId + 1) | 0;
  }
}

/**
 * `@va D2Common:0x6FD65A80` (`DRLGOUTPLACE_PlaceAct5OutdoorLevels`, custom LTCG `eax = pLevel`, `ret` -> `pLastLevel`).
 */
export function DRLGOUTPLACE_PlaceAct5OutdoorLevels113c(m: Memory113c, pLevel: number): number {
  const lvl = pLevel >>> 0;
  const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C);
  let pLvlDef76 = 0;
  if ((m.u32((sgpt + 0xc5c) >>> 0) | 0) > 0x4c) {
    pLvlDef76 = (m.u32(SGPT_LEVELDEF_BIN_VA) + 0x2e50) >>> 0;
  }
  const pDrlg = m.u32((lvl + D2DrlgLevelStrc.pDrlg.off) >>> 0);
  const nDiff = m.u8((pDrlg + 0x450) >>> 0);
  const sizeX = m.u32((pLvlDef76 + (nDiff << 2) + D2LevelDefBin.dwSizeX0.off) >>> 0) | 0;
  const sizeY = m.u32((pLvlDef76 + (nDiff << 2) + D2LevelDefBin.dwSizeY0.off) >>> 0) | 0;
  void m.u32((pDrlg + 0x478) >>> 0); // pMemPool

  const cellW = truncDiv32_113c(sizeX);
  const cellH = truncDiv32_113c(sizeY);
  let minX = m.u32((lvl + D2DrlgLevelStrc.nPosX.off) >>> 0) | 0;
  const baseY = m.u32((lvl + D2DrlgLevelStrc.nPosY.off) >>> 0) | 0;
  let minY = (baseY - sizeY) | 0;
  let maxX = (minX + sizeX) | 0;

  const sm = withOutPlaceScratch113c(m);
  const recsBase = OUTPLACE_STACK_BASE;
  for (let i = 0; i < 0x2a; i++) {
    sm.setU32((recsBase + (i << 2)) >>> 0, 0);
  }
  sm.setU32((recsBase + 0x00) >>> 0, minX >>> 0);
  sm.setU32((recsBase + 0x04) >>> 0, (baseY - sizeY) >>> 0);
  sm.setU32((recsBase + 0x08) >>> 0, sizeX >>> 0);
  sm.setU32((recsBase + 0x0c) >>> 0, sizeY >>> 0);
  sm.setU32((recsBase + 0x10) >>> 0, 0);

  let recIdx = 1;
  while (recIdx < 3) {
    const pickIdx = seedRoll_113c(m, pDrlg, recIdx);
    const dir = seedRoll_113c(m, pDrlg, 5);
    const pickOff = (pickIdx * 0x38) | 0;
    const pParent = (recsBase + pickOff) >>> 0;
    const pCur = (recsBase + recIdx * 0x38) >>> 0;
    DRLGOUTPLACE_InitRoomExCoordByDir113c(sm, pCur, sizeX, sizeY, pParent, dir);

    const curX = sm.u32(pCur) | 0;
    const curY = sm.u32((pCur + 4) >>> 0) | 0;
    const curW = sm.u32((pCur + 8) >>> 0) | 0;
    const curH = sm.u32((pCur + 12) >>> 0) | 0;

    let overlap = false;
    for (let j = 0; j < recIdx; j++) {
      const pOther = (recsBase + j * 0x38) >>> 0;
      const oX = sm.u32(pOther) | 0;
      const oY = sm.u32((pOther + 4) >>> 0) | 0;
      const oW = sm.u32((pOther + 8) >>> 0) | 0;
      const oH = sm.u32((pOther + 12) >>> 0) | 0;
      const dx = oX < curX ? (curX - oW - oX) | 0 : (oX - curW - curX) | 0;
      const dy = oY < curY ? (curY - oH - oY) | 0 : (oY - curH - curY) | 0;
      if (dx < 0 && dy < 0) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;

    const pSubCount = (pParent + 0x14) >>> 0;
    const subCnt = sm.u32(pSubCount) | 0;
    sm.setU32((pParent + 0x1c + (subCnt << 2)) >>> 0, pCur >>> 0);
    sm.setU32((pCur + 0x18) >>> 0, pParent >>> 0);
    const nextSub = (subCnt + 1) | 0;
    sm.setU32(pSubCount, nextSub >>> 0);
    if (nextSub > 3) {
      throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\OutPlace.cpp', 0x63e);
    }
    if (minX > curX) minX = curX;
    if (minY > curY) minY = curY;
    if (maxX < ((curX + curW) | 0)) maxX = (curX + curW) | 0;
    recIdx = (recIdx + 1) | 0;
  }

  const totalW = (maxX - minX) | 0;
  if ((totalW % 32) !== 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\OutPlace.cpp', 0x64d);
  }
  const totalH = (baseY - minY) | 0;
  if ((totalH % 32) !== 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\OutPlace.cpp', 0x64e);
  }

  const gw = (truncDiv32_113c(totalW) + 2) | 0;
  const gh = (truncDiv32_113c(totalH) + 2) | 0;
  const gridBytes = Math.imul(gw, gh) << 2;

  const levelGridBytes = (Math.imul(cellW, cellH) << 2) >>> 0;

  const pLevelGrid = m.alloc(gridBytes >>> 0);
  const pOrderGrid = m.alloc(gridBytes >>> 0);
  const pConnGrid = m.alloc(gridBytes >>> 0);
  const pTileGrid = m.alloc(gridBytes >>> 0);

  const gLen = Math.imul(gw, gh);
  try {
    for (;;) {
      for (let i = 0; i < gLen; i++) {
        const off = (i << 2) >>> 0;
        m.setU32((pLevelGrid + off) >>> 0, 0);
        m.setU32((pOrderGrid + off) >>> 0, 0);
        m.setU32((pConnGrid + off) >>> 0, 0);
        m.setU32((pTileGrid + off) >>> 0, 0);
      }

      let restartOuter = false;
      for (let idx = 0; idx < 3; idx++) {
        const rBase = (recsBase + idx * 0x38) >>> 0;
        const rx = sm.u32(rBase) | 0;
        const ry = sm.u32((rBase + 4) >>> 0) | 0;
        const gx = (truncDiv32_113c((rx - minX) | 0) + 1) | 0;
        const gy = (truncDiv32_113c((ry - minY) | 0) + 1) | 0;

        sm.setU32((rBase + 0x28) >>> 0, gx >>> 0);
        sm.setU32((rBase + 0x2c) >>> 0, gy >>> 0);
        sm.setU32((rBase + 0x30) >>> 0, m.alloc(levelGridBytes));

        let curDir: number;
        if (idx === 0) {
          const { lo } = stepDrlgSeed64_113c(m, pDrlg);
          curDir = lo & 1;
        } else {
          const rDir = sm.u32((rBase + 0x10) >>> 0) | 0;
          curDir = rDir & 1;
        }

        const endGY = (gy + cellH - 1) | 0;
        let pathCount = 0;

        let walkDone = false;
        while (!walkDone) {
          for (let y = gy; y <= endGY; y++) {
            for (let x = gx; x < gx + cellW; x++) {
              const cOff = (Math.imul(y, gw) + x) << 2;
              m.setU32((pLevelGrid + cOff) >>> 0, (idx + 1) >>> 0);
              m.setU32((pOrderGrid + cOff) >>> 0, 0);
              m.setU32((pConnGrid + cOff) >>> 0, 0);
              m.setU32((pTileGrid + cOff) >>> 0, 0);
            }
          }

          let pathX = (gx + curDir) | 0;
          let pathY = endGY;
          if (idx !== 0) {
            const cOff = (Math.imul(endGY, gw) + pathX) << 2;
            m.setU32((pConnGrid + cOff) >>> 0, 1);
            const adjX = (pathX + (curDir === 0 ? 1 : -1)) | 0;
            m.setU32((pConnGrid + ((Math.imul(endGY, gw) + adjX) << 2)) >>> 0, 2);
          }

          const subCnt = sm.u32((rBase + 0x14) >>> 0) | 0;
          for (let s = 0; s < subCnt; s++) {
            const pChild = sm.u32((rBase + 0x1c + s * 4) >>> 0);
            const cDir = sm.u32((pChild + 0x10) >>> 0) | 0;
            if (cDir === 0) {
              m.setU32((pConnGrid + ((Math.imul(gy, gw) + gx) << 2)) >>> 0, 1);
            } else if (cDir === 1) {
              m.setU32((pConnGrid + ((Math.imul((gy + 3) | 0, gw) + gx) << 2)) >>> 0, 1);
            } else if (cDir === 2) {
              m.setU32((pConnGrid + ((Math.imul((gy + 3) | 0, gw) + gx + 1) << 2)) >>> 0, 1);
            } else if (cDir === 3) {
              m.setU32((pConnGrid + ((Math.imul((gy + 1) | 0, gw) + gx) << 2)) >>> 0, 1);
            } else if (cDir === 4) {
              m.setU32((pConnGrid + ((Math.imul((gy + 1) | 0, gw) + gx + 1) << 2)) >>> 0, 1);
            }
          }

          // 0x6FD6608B..0x6FD6608F: pathCount = (idx != 0) is re-seeded on every walk attempt.
          pathCount = idx !== 0 ? 1 : 0;
          let stepOrder = ((idx + 1) * 100) | 0;
          let straightSteps = 0;
          while (pathY >= gy) {
            const cOff = (Math.imul(pathY, gw) + pathX) << 2;
            m.setU32((pOrderGrid + cOff) >>> 0, stepOrder >>> 0);
            stepOrder = (stepOrder + 1) | 0;
            if (straightSteps !== 0 && pathY !== gy) {
              const r3 = seedRoll_113c(m, pDrlg, 3);
              if (r3 === 0) {
                straightSteps = 0;
                if (curDir !== 0) {
                  pathX = (pathX - 1) | 0;
                  curDir = 0;
                } else {
                  pathX = (pathX + 1) | 0;
                  curDir = 1;
                }
                continue;
              }
            }
            straightSteps = (straightSteps + 1) | 0;
            if (straightSteps >= 2 && pathY > 1) {
              const sideX = (pathX + (curDir === 0 ? 1 : -1)) | 0;
              const sOff = (Math.imul(pathY, gw) + sideX) << 2;
              if (m.u32((pConnGrid + sOff) >>> 0) === 0) {
                pathCount = (pathCount + 1) | 0;
                m.setU32((pConnGrid + sOff) >>> 0, 2);
              }
            }
            pathY = (pathY - 1) | 0;
          }

          if (pathCount < 2) continue;

          while (pathCount > 3) {
            const dropIdx = seedRoll_113c(m, pDrlg, pathCount);
            let seen = 0;
            let dropped = false;
            for (let y = gy; y < gy + cellH && !dropped; y++) {
              for (let x = gx; x < gx + cellW && !dropped; x++) {
                const cOff = (Math.imul(y, gw) + x) << 2;
                if (m.u32((pConnGrid + cOff) >>> 0) === 2) {
                  if (seen === dropIdx) {
                    m.setU32((pConnGrid + cOff) >>> 0, 0);
                    dropped = true;
                    pathCount = (pathCount - 1) | 0;
                  }
                  seen = (seen + 1) | 0;
                }
              }
            }
          }
          walkDone = true;
        }
      }

      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const cIdx = (Math.imul(y, gw) + x) | 0;
          const cOff = (cIdx << 2) >>> 0;
          const lvlId = m.u32((pLevelGrid + cOff) >>> 0) | 0;
          const conn = m.u32((pConnGrid + cOff) >>> 0) | 0;
          let mask = 0;

          if (conn === 1) {
            let bestOrder = 0x7fffffff;
            const nIdx = (Math.imul(y - 1, gw) + x) | 0;
            const nOrd = m.u32((pOrderGrid + (nIdx << 2)) >>> 0) | 0;
            if (nOrd !== 0 && nOrd < bestOrder && (m.u32((pLevelGrid + (nIdx << 2)) >>> 0) | 0) === lvlId) {
              mask = 8;
              bestOrder = nOrd;
            }
            const sIdx = (Math.imul(y + 1, gw) + x) | 0;
            const sOrd = m.u32((pOrderGrid + (sIdx << 2)) >>> 0) | 0;
            if (sOrd !== 0 && sOrd < bestOrder && (m.u32((pLevelGrid + (sIdx << 2)) >>> 0) | 0) === lvlId) {
              mask = 4;
              bestOrder = sOrd;
            }
            const eIdx = (cIdx + 1) | 0;
            const eOrd = m.u32((pOrderGrid + (eIdx << 2)) >>> 0) | 0;
            if (eOrd !== 0 && eOrd < bestOrder && (m.u32((pLevelGrid + (eIdx << 2)) >>> 0) | 0) === lvlId) {
              mask = 2;
              bestOrder = eOrd;
            }
            const wIdx = (cIdx - 1) | 0;
            const wOrd = m.u32((pOrderGrid + (wIdx << 2)) >>> 0) | 0;
            if (wOrd !== 0 && wOrd < bestOrder && (m.u32((pLevelGrid + (wIdx << 2)) >>> 0) | 0) === lvlId) {
              mask = 1;
            }

            if ((mask & 8) !== 0) {
              const o = (nIdx << 2) >>> 0;
              m.setU32((pTileGrid + o) >>> 0, (m.u32((pTileGrid + o) >>> 0) | 4) >>> 0);
            }
            if ((mask & 4) !== 0) {
              const o = (sIdx << 2) >>> 0;
              m.setU32((pTileGrid + o) >>> 0, (m.u32((pTileGrid + o) >>> 0) | 8) >>> 0);
            }
            if ((mask & 2) !== 0) {
              const o = (eIdx << 2) >>> 0;
              m.setU32((pTileGrid + o) >>> 0, (m.u32((pTileGrid + o) >>> 0) | 1) >>> 0);
            }
            if ((mask & 1) !== 0) {
              const o = (wIdx << 2) >>> 0;
              m.setU32((pTileGrid + o) >>> 0, (m.u32((pTileGrid + o) >>> 0) | 2) >>> 0);
            }

            if (m.u32((pConnGrid + (nIdx << 2)) >>> 0) === 1 && (m.u32((pLevelGrid + (nIdx << 2)) >>> 0) | 0) !== lvlId) {
              mask |= 8;
            }
            if (m.u32((pConnGrid + (sIdx << 2)) >>> 0) === 1 && (m.u32((pLevelGrid + (sIdx << 2)) >>> 0) | 0) !== lvlId) {
              mask |= 4;
            }
            if (m.u32((pConnGrid + (eIdx << 2)) >>> 0) === 1 && (m.u32((pLevelGrid + (eIdx << 2)) >>> 0) | 0) !== lvlId) {
              mask |= 2;
            }
            if (m.u32((pConnGrid + (wIdx << 2)) >>> 0) === 1 && (m.u32((pLevelGrid + (wIdx << 2)) >>> 0) | 0) !== lvlId) {
              mask |= 1;
            }
          }

          const ord = m.u32((pOrderGrid + cOff) >>> 0) | 0;
          if (ord !== 0) {
            const nOrd = m.u32((pOrderGrid + ((Math.imul(y - 1, gw) + x) << 2)) >>> 0) | 0;
            if (Math.abs((ord - nOrd) | 0) === 1) mask |= 8;
            const sOrd = m.u32((pOrderGrid + ((Math.imul(y + 1, gw) + x) << 2)) >>> 0) | 0;
            if (Math.abs((ord - sOrd) | 0) === 1) mask |= 4;
            const eOrd = m.u32((pOrderGrid + ((cIdx + 1) << 2)) >>> 0) | 0;
            if (Math.abs((ord - eOrd) | 0) === 1) mask |= 2;
            const wOrd = m.u32((pOrderGrid + ((cIdx - 1) << 2)) >>> 0) | 0;
            if (Math.abs((ord - wOrd) | 0) === 1) mask |= 1;
          }

          m.setU32((pTileGrid + cOff) >>> 0, (m.u32((pTileGrid + cOff) >>> 0) | mask) >>> 0);
        }
      }

      for (let y = 0; y < gh && !restartOuter; y++) {
        for (let x = 0; x < gw && !restartOuter; x++) {
          const cIdx = (Math.imul(y, gw) + x) | 0;
          const cOff = (cIdx << 2) >>> 0;
          const tileVal = m.u32((pTileGrid + cOff) >>> 0) | 0;
          const lvlId = m.u32((pLevelGrid + cOff) >>> 0) | 0;
          const { lo: rSeed0, hi: rSeedHi0 } = stepDrlgSeed64_113c(m, pDrlg);
          let dirStart = rSeed0 & 3;
          let carryHi = rSeedHi0;
          let mask = tileVal;

          if (m.u32((pConnGrid + cOff) >>> 0) === 2) {
            let connected = 0;
            let pass1Done = false;
            for (let d = 0; d < 4 && !pass1Done; d++) {
              const dir = (dirStart + d) & 3;
              if (dir === 0) {
                const nIdx = (Math.imul(y - 1, gw) + x) | 0;
                const nt = m.u32((pTileGrid + (nIdx << 2)) >>> 0) | 0;
                if ((m.u32((pLevelGrid + (nIdx << 2)) >>> 0) | 0) === lvlId && nt !== 0 && nt < 0xf) {
                  mask |= 0x80;
                  pass1Done = true;
                }
              } else if (dir === 1) {
                const sIdx = (Math.imul(y + 1, gw) + x) | 0;
                const st = m.u32((pTileGrid + (sIdx << 2)) >>> 0) | 0;
                if ((m.u32((pLevelGrid + (sIdx << 2)) >>> 0) | 0) === lvlId && st !== 0 && st < 0xf) {
                  mask |= 0x40;
                  pass1Done = true;
                }
              } else if (dir === 2) {
                const eIdx = (cIdx + 1) | 0;
                const et = m.u32((pTileGrid + (eIdx << 2)) >>> 0) | 0;
                if ((m.u32((pLevelGrid + (eIdx << 2)) >>> 0) | 0) === lvlId && et !== 0 && et < 0xf) {
                  mask |= 0x20;
                  pass1Done = true;
                }
              } else {
                const wIdx = (cIdx - 1) | 0;
                const wt = m.u32((pTileGrid + (wIdx << 2)) >>> 0) | 0;
                if ((m.u32((pLevelGrid + (wIdx << 2)) >>> 0) | 0) === lvlId && wt !== 0 && wt < 0xf) {
                  mask |= 0x10;
                  pass1Done = true;
                }
              }
            }

            if (mask === 0) {
              restartOuter = true;
              break;
            }

            if (tileVal === 0) {
              let pass2 = 1;
              for (let d = 0; d < 4 && pass2 !== 0; d++) {
                const dir = (dirStart + d) & 3;
                if (dir === 0) {
                  const nIdx = (Math.imul(y - 1, gw) + x) | 0;
                  if ((m.u32((pLevelGrid + (nIdx << 2)) >>> 0) | 0) !== lvlId && m.u32((pConnGrid + (nIdx << 2)) >>> 0) === 2) {
                    mask |= 0x80;
                    pass2 = 0;
                  }
                } else if (dir === 1) {
                  const sIdx = (Math.imul(y + 1, gw) + x) | 0;
                  if ((m.u32((pLevelGrid + (sIdx << 2)) >>> 0) | 0) !== lvlId && m.u32((pConnGrid + (sIdx << 2)) >>> 0) === 2) {
                    mask |= 0x40;
                    pass2 = 0;
                  }
                } else if (dir === 2) {
                  const eIdx = (cIdx + 1) | 0;
                  if ((m.u32((pLevelGrid + (eIdx << 2)) >>> 0) | 0) !== lvlId && m.u32((pConnGrid + (eIdx << 2)) >>> 0) === 2) {
                    mask |= 0x20;
                    pass2 = 0;
                  }
                } else {
                  const wIdx = (cIdx - 1) | 0;
                  if ((m.u32((pLevelGrid + (wIdx << 2)) >>> 0) | 0) !== lvlId && m.u32((pConnGrid + (wIdx << 2)) >>> 0) === 2) {
                    mask |= 0x10;
                    pass2 = 0;
                  }
                }
              }

              const p1 = BigInt(rSeed0) * 0x6ac690c5n + BigInt(carryHi);
              const l1 = Number(p1 & 0xffffffffn) >>> 0;
              const h1 = Number((p1 >> 32n) & 0xffffffffn) >>> 0;
              const p2 = BigInt(l1) * 0x6ac690c5n + BigInt(h1);
              const l2 = Number(p2 & 0xffffffffn) >>> 0;
              const h2 = Number((p2 >> 32n) & 0xffffffffn) >>> 0;
              m.setU32(pDrlg, l2);
              m.setU32((pDrlg + 4) >>> 0, h2);
              dirStart = l2 & 3;
              if ((l1 & 1) !== 0 && pass2 !== 0) {
                connected = 1;
              }
              for (let d = 0; d < 4 && connected !== 0; d++) {
                const dir = (dirStart + d) & 3;
                if (dir === 0) {
                  const nIdx = (Math.imul(y - 1, gw) + x) | 0;
                  const nt = m.u32((pTileGrid + (nIdx << 2)) >>> 0) | 0;
                  if (nt !== 0 && nt < 0xf && (mask & 0x80) === 0) {
                    mask |= 0x80;
                    connected = 0;
                  }
                } else if (dir === 1) {
                  const sIdx = (Math.imul(y + 1, gw) + x) | 0;
                  const st = m.u32((pTileGrid + (sIdx << 2)) >>> 0) | 0;
                  if (st !== 0 && st < 0xf && (mask & 0x40) === 0) {
                    mask |= 0x40;
                    connected = 0;
                  }
                } else if (dir === 2) {
                  const eIdx = (cIdx + 1) | 0;
                  const et = m.u32((pTileGrid + (eIdx << 2)) >>> 0) | 0;
                  if (et !== 0 && et < 0xf && (mask & 0x20) === 0) {
                    mask |= 0x20;
                    connected = 0;
                  }
                } else {
                  const wIdx = (cIdx - 1) | 0;
                  const wt = m.u32((pTileGrid + (wIdx << 2)) >>> 0) | 0;
                  if (wt !== 0 && wt < 0xf && (mask & 0x10) === 0) {
                    mask |= 0x10;
                    connected = 0;
                  }
                }
              }
            }

            if ((mask & 0x80) !== 0) {
              const nOff = (Math.imul(y - 1, gw) + x) << 2;
              m.setU32((pTileGrid + nOff) >>> 0, (m.u32((pTileGrid + nOff) >>> 0) | 0x40) >>> 0);
            }
            if ((mask & 0x40) !== 0) {
              const sOff = (Math.imul(y + 1, gw) + x) << 2;
              m.setU32((pTileGrid + sOff) >>> 0, (m.u32((pTileGrid + sOff) >>> 0) | 0x80) >>> 0);
            }
            if ((mask & 0x20) !== 0) {
              const eOff = ((cIdx + 1) << 2) >>> 0;
              m.setU32((pTileGrid + eOff) >>> 0, (m.u32((pTileGrid + eOff) >>> 0) | 0x10) >>> 0);
            }
            if ((mask & 0x10) !== 0) {
              const wOff = ((cIdx - 1) << 2) >>> 0;
              m.setU32((pTileGrid + wOff) >>> 0, (m.u32((pTileGrid + wOff) >>> 0) | 0x20) >>> 0);
            }
            m.setU32((pConnGrid + cOff) >>> 0, 0);
          }
          m.setU32((pTileGrid + cOff) >>> 0, (m.u32((pTileGrid + cOff) >>> 0) | mask) >>> 0);
        }
      }
      if (!restartOuter) break;
    }

    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const cOff = ((Math.imul(y, gw) + x) << 2) >>> 0;
        const val = m.u32((pTileGrid + cOff) >>> 0) | 0;
        const low = val & 0xf;
        let tileId: number;
        if (low === 0) {
          if (val < 0x10) {
            tileId = low;
          } else {
            tileId = ACT5_OUTPLACE_TILE_MAP_6FDE51E4[val >> 4]!;
            if (tileId === 0) {
              throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\OutPlace.cpp', 0x799);
            }
          }
        } else if (val < 0x10) {
          tileId = (low + 0x211) | 0;
        } else {
          let mapped = low;
          if ((val & 0x10) !== 0) mapped = ACT5_OUTPLACE_TILE_MAP_6FDE51E4[13 + (mapped << 2)]!;
          if ((val & 0x20) !== 0) mapped = ACT5_OUTPLACE_TILE_MAP_6FDE51E4[14 + (mapped << 2)]!;
          if ((val & 0x40) !== 0) mapped = ACT5_OUTPLACE_TILE_MAP_6FDE51E4[15 + (mapped << 2)]!;
          if ((val & 0x80) !== 0) mapped = ACT5_OUTPLACE_TILE_MAP_6FDE51E4[16 + (mapped << 2)]!;
          if (mapped === 0) {
            throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\OutPlace.cpp', 0x78c);
          }
          tileId = mapped;
        }
        m.setU32((pTileGrid + cOff) >>> 0, tileId >>> 0);
      }
    }

    for (let idx = 0; idx < 3; idx++) {
      const rBase = (recsBase + idx * 0x38) >>> 0;
      const gx = sm.u32((rBase + 0x28) >>> 0) | 0;
      const gy = sm.u32((rBase + 0x2c) >>> 0) | 0;
      const rGrid = sm.u32((rBase + 0x30) >>> 0);
      let tileCnt = 0;
      let outIdx = 0;
      for (let sy = 0; sy < cellH; sy++) {
        for (let sx = 0; sx < cellW; sx++) {
          const tVal = m.u32((pTileGrid + ((Math.imul(gy + sy, gw) + gx + sx) << 2)) >>> 0) | 0;
          m.setU32((rGrid + (outIdx << 2)) >>> 0, tVal >>> 0);
          if (tVal > 0x23e) tileCnt = (tileCnt + 1) | 0;
          outIdx = (outIdx + 1) | 0;
        }
      }
      sm.setU32((rBase + 0x34) >>> 0, tileCnt >>> 0);
    }

    // Bubble-sort the 3 records by +0x04 (nPosY) ascending
    for (;;) {
      let swapped = false;
      if ((sm.u32((recsBase + 0x38 + 4) >>> 0) | 0) > (sm.u32((recsBase + 4) >>> 0) | 0)) {
        for (let k = 0; k < 14; k++) {
          const a = sm.u32((recsBase + (k << 2)) >>> 0);
          const b = sm.u32((recsBase + 0x38 + (k << 2)) >>> 0);
          sm.setU32((recsBase + (k << 2)) >>> 0, b);
          sm.setU32((recsBase + 0x38 + (k << 2)) >>> 0, a);
        }
        swapped = true;
      }
      if ((sm.u32((recsBase + 0x70 + 4) >>> 0) | 0) > (sm.u32((recsBase + 0x38 + 4) >>> 0) | 0)) {
        for (let k = 0; k < 14; k++) {
          const a = sm.u32((recsBase + 0x38 + (k << 2)) >>> 0);
          const b = sm.u32((recsBase + 0x70 + (k << 2)) >>> 0);
          sm.setU32((recsBase + 0x38 + (k << 2)) >>> 0, b);
          sm.setU32((recsBase + 0x70 + (k << 2)) >>> 0, a);
        }
        swapped = true;
      }
      if (!swapped) break;
    }

    let pLastLevel = 0;
    for (let idx = 0; idx < 3; idx++) {
      const rBase = (recsBase + idx * 0x38) >>> 0;
      pLastLevel = findOrAllocLevel113c(m, pDrlg, (idx + 0x4c) | 0);
      m.setU32((pLastLevel + 0x1bc) >>> 0, sm.u32((rBase + 0x30) >>> 0));
      m.setU32((pLastLevel + 0x1b8) >>> 0, sm.u32((rBase + 0x34) >>> 0));
      m.setU32((pLastLevel + D2DrlgLevelStrc.nPosX.off) >>> 0, sm.u32(rBase));
      m.setU32((pLastLevel + D2DrlgLevelStrc.nPosY.off) >>> 0, sm.u32((rBase + 4) >>> 0));
      m.setU32((pLastLevel + D2DrlgLevelStrc.nWidth.off) >>> 0, sm.u32((rBase + 8) >>> 0));
      m.setU32((pLastLevel + D2DrlgLevelStrc.nHeight.off) >>> 0, sm.u32((rBase + 12) >>> 0));
    }
    return pLastLevel >>> 0;
  } finally {
    const freeMem = (m as { free?: (p: number) => void }).free;
    freeMem?.(pLevelGrid);
    freeMem?.(pOrderGrid);
    freeMem?.(pConnGrid);
    freeMem?.(pTileGrid);
  }
}

/**
 * `@va D2Common:0x6FD66CF0` (`DRLGOUTPLACE_LinkAct5OutdoorLevels`, stdcall `(pDrlg, nStartLevelId, nEndLevelId)`, `ret 0xc`, void).
 */
export function DRLGOUTPLACE_LinkAct5OutdoorLevels113c(
  m: Memory113c,
  pDrlg: number,
  nStartLevelId: number,
  nEndLevelId: number,
): void {
  const drlg = pDrlg >>> 0;
  const startId = nStartLevelId | 0;
  const endId = nEndLevelId | 0;
  if (startId > endId) return;

  for (let i = startId; i <= endId; i++) {
    const pLvl1 = findOrAllocLevel113c(m, drlg, i);
    const pWarp1 = DRLG_GetOrAllocObjectPresetRecord113c(m, drlg, i);
    for (let j = startId; j <= endId; j++) {
      if (i === j) continue;
      const pLvl2 = findOrAllocLevel113c(m, drlg, j);
      const x1 = m.u32((pLvl1 + D2DrlgLevelStrc.nPosX.off) >>> 0) | 0;
      const w1 = m.u32((pLvl1 + D2DrlgLevelStrc.nWidth.off) >>> 0) | 0;
      const x2 = m.u32((pLvl2 + D2DrlgLevelStrc.nPosX.off) >>> 0) | 0;
      const w2 = m.u32((pLvl2 + D2DrlgLevelStrc.nWidth.off) >>> 0) | 0;
      const dx = x1 <= x2 ? (x2 - w1 - x1) | 0 : (x1 - w2 - x2) | 0;

      const y1 = m.u32((pLvl1 + D2DrlgLevelStrc.nPosY.off) >>> 0) | 0;
      const h1 = m.u32((pLvl1 + D2DrlgLevelStrc.nHeight.off) >>> 0) | 0;
      const y2 = m.u32((pLvl2 + D2DrlgLevelStrc.nPosY.off) >>> 0) | 0;
      const h2 = m.u32((pLvl2 + D2DrlgLevelStrc.nHeight.off) >>> 0) | 0;
      const dy = y1 <= y2 ? (y2 - h1 - y1) | 0 : (y1 - h2 - y2) | 0;

      if ((dx === 0 && dy <= -1) || (dy === 0 && dx <= -1)) {
        DRLG_SetWarpId113c(m, pWarp1, j, -1, -1);
      }
    }
  }
}

export type OutPlaceValidateArg113c =
  | number
  | ((m: Memory113c, pLinkData: number, idx: number) => number);
export type OutPlacePostArg113c =
  | number
  | ((m: Memory113c, pLevel: number, idx: number, pStates: number) => void);

function dispatchOutPlaceLinkerVa113c(m: Memory113c, fnVa: number, pLinkData: number): number {
  switch (fnVa >>> 0) {
    case 0x6fd644c0:
      return DRLG_LinkOutdoorLevels113c(m, pLinkData);
    case 0x6fd64b00:
      return DRLGOUTPLACE_LinkAct4Step113c(m, pLinkData);
    case 0x6fd64d00:
      return DRLGOUTPLACE_LinkAct3KurastCauseway113c(m, pLinkData);
    case 0x6fd64e30:
      return DRLGOUTPLACE_LinkAct3SpiderForest113c(m, pLinkData);
    case 0x6fd64f90:
      return DRLGOUTPLACE_LinkAct1Rotating113c(m, pLinkData);
    case 0x6fd65250:
      return DRLGOUTPLACE_LinkAct1FixedSize113c(m, pLinkData);
    case 0x6fd65480:
      return DRLGOUTPLACE_LinkAct3Jungle113c(m, pLinkData);
    case 0x6fd65680:
      return DRLGOUTPLACE_LinkQuadrant4_113c(m, pLinkData);
    case 0x6fd657d0:
      return DRLGOUTPLACE_LinkFromLevelDef113c(m, pLinkData);
    case 0x6fd90e10:
      return DRLGOUTROOM_LinkLevelsByOffsetCoords113c(m, pLinkData);
    case 0x6fd90f00:
      return DRLGOUTROOM_LinkLevelsByLevelDef113c(m, pLinkData);
    case 0x6fd90fc0:
      return DRLGOUTROOM_LinkLevelsByLevelCoords113c(m, pLinkData);
    default:
      return 0;
  }
}

function resolveOutPlaceValidateArg113c(
  arg: OutPlaceValidateArg113c | undefined,
): ((m: Memory113c, pLinkData: number, idx: number) => number) | undefined {
  if (typeof arg === 'function') return arg;
  if (arg === undefined) return undefined;
  switch (arg >>> 0) {
    case 0x6fd64630:
      return DRLG_CheckAct1LinkOverlap113c;
    case 0x6fd646c0:
      return DRLG_CheckAct1WildLinkOverlap113c;
    case 0x6fd64750:
      return DRLG_CheckAct2LinkOverlap113c;
    case 0x6fd647e0:
      return DRLG_CheckAct4LinkOverlap113c;
    case 0x6fd64870:
      return DRLG_CheckMonasteryLinkOverlap113c;
    case 0x6fd64900:
      return DRLGOUTPLACE_CheckAct2LinkOverlap113c;
    case 0x6fd64a00:
      return DRLGOUTPLACE_CheckAct1LinkOverlap113c;
    default:
      return undefined;
  }
}

function resolveOutPlacePostArg113c(
  arg: OutPlacePostArg113c | undefined,
): ((m: Memory113c, pLevel: number, idx: number, pStates: number) => void) | undefined {
  if (typeof arg === 'function') return arg;
  if (arg !== undefined && (arg >>> 0) === 0x6fd63fd0) {
    return DRLG_ApplyOutdoorVertexFlags113c;
  }
  return undefined;
}

/**
 * `@va D2Common:0x6FD66E10` (`DRLGOUTPLACE_PlaceActLevelsByList`, custom LTCG `esi = pDrlg`, stack `(pList, pfnValidate, pfnPost)`, `ret 0xc`, void).
 */
export function DRLGOUTPLACE_PlaceActLevelsByList113c(
  m: Memory113c,
  pDrlg: number,
  pList: number,
  pfnPlace?: (m: Memory113c, pLinkData: number, idx: number, nLevelId: number) => number,
  pfnValidate?: OutPlaceValidateArg113c,
  pfnPost?: OutPlacePostArg113c,
): void {
  const drlg = pDrlg >>> 0;
  const listPtr = pList >>> 0;
  const validateFn = resolveOutPlaceValidateArg113c(pfnValidate);
  const postFn = resolveOutPlacePostArg113c(pfnPost);
  const sm = withOutPlaceScratch113c(m);
  const frameBase = OUTPLACE_STACK_BASE;
  for (let i = 0; i < 0x7d; i++) sm.setU32((frameBase + (i << 2)) >>> 0, 0);
  for (let i = 0; i < 15; i++) {
    sm.setU32((frameBase + 0xfc + (i << 2)) >>> 0, 0xffffffff);
    sm.setU32((frameBase + 0x138 + (i << 2)) >>> 0, 0xffffffff);
    sm.setU32((frameBase + 0x174 + (i << 2)) >>> 0, 0xffffffff);
    sm.setU32((frameBase + 0x1b0 + (i << 2)) >>> 0, 0xffffffff);
  }

  sm.setU32(frameBase, m.u32(drlg));
  sm.setU32((frameBase + 4) >>> 0, m.u32((drlg + 4) >>> 0));
  sm.setU32((frameBase + 0xf8) >>> 0, listPtr);

  if ((sm.u32((listPtr + 4) >>> 0) | 0) !== 0) {
    const nDiff = m.u8((drlg + 0x450) >>> 0);
    const sgpt = m.u32(D2COMMON_SGPT_DATATABLES_VA_113C);
    const lvlDefCount = m.u32((sgpt + 0xc5c) >>> 0) | 0;
    const lvlDefBase = m.u32(SGPT_LEVELDEF_BIN_VA);

    let idx = 0;
    for (;;) {
      const nLevelId = sm.u32((listPtr + (idx << 4) + 4) >>> 0) | 0;
      if (nLevelId === 0) break;
      let recBase = 0;
      if (nLevelId >= 0 && nLevelId < lvlDefCount) {
        recBase = (lvlDefBase + Math.imul(nLevelId, 0x9c)) >>> 0;
      }
      const w = m.u32((recBase + (nDiff << 2) + D2LevelDefBin.dwSizeX0.off) >>> 0);
      const h = m.u32((recBase + (nDiff << 2) + D2LevelDefBin.dwSizeY0.off) >>> 0);
      sm.setU32((frameBase + 0x10 + (idx << 4)) >>> 0, w);
      sm.setU32((frameBase + 0x14 + (idx << 4)) >>> 0, h);
      idx = (idx + 1) | 0;
    }
  }

  let idx = 0;
  while ((sm.u32((listPtr + (idx << 4) + 4) >>> 0) | 0) !== 0) {
    const entryPtr = (listPtr + (idx << 4)) >>> 0;
    const nLevelId = sm.u32((entryPtr + 4) >>> 0) | 0;
    sm.setU32((frameBase + 0x1f0) >>> 0, nLevelId >>> 0);
    sm.setU32((frameBase + 0x1ec) >>> 0, idx >>> 0);
    const placed =
      pfnPlace !== undefined
        ? pfnPlace(sm, frameBase, idx, nLevelId) | 0
        : dispatchOutPlaceLinkerVa113c(sm, sm.u32(entryPtr), frameBase) | 0;
    if (placed === 0) {
      sm.setU32((frameBase + 0xfc + (idx << 2)) >>> 0, 0xffffffff);
      sm.setU32((frameBase + 0x138 + (idx << 2)) >>> 0, 0xffffffff);
      sm.setU32((frameBase + 0x174 + (idx << 2)) >>> 0, 0xffffffff);
      sm.setU32((frameBase + 0x1b0 + (idx << 2)) >>> 0, 0xffffffff);
      idx = (idx - 1) | 0;
    } else if (validateFn !== undefined && (validateFn(sm, frameBase, idx) | 0) === 0) {
      // Retry current entry
    } else {
      idx = (idx + 1) | 0;
    }
  }

  idx = 0;
  for (;;) {
    const entryPtr = (listPtr + (idx << 4)) >>> 0;
    const nLevelId = sm.u32((entryPtr + 4) >>> 0) | 0;
    if (nLevelId === 0) break;

    const vis1Idx = sm.u32((entryPtr + 8) >>> 0) | 0;
    const vis2Idx = sm.u32((entryPtr + 12) >>> 0) | 0;
    const vis1 = vis1Idx === -1 ? 0 : (sm.u32((listPtr + (vis1Idx << 4) + 4) >>> 0) | 0);
    const vis2 = vis2Idx === -1 ? 0 : (sm.u32((listPtr + (vis2Idx << 4) + 4) >>> 0) | 0);

    const pTarget = findOrAllocLevel113c(m, drlg, nLevelId);
    const rectOff = (frameBase + 8 + (idx << 4)) >>> 0;
    m.setU32((pTarget + D2DrlgLevelStrc.nPosX.off) >>> 0, sm.u32(rectOff));
    m.setU32((pTarget + D2DrlgLevelStrc.nPosY.off) >>> 0, sm.u32((rectOff + 4) >>> 0));
    m.setU32((pTarget + D2DrlgLevelStrc.nWidth.off) >>> 0, sm.u32((rectOff + 8) >>> 0));
    m.setU32((pTarget + D2DrlgLevelStrc.nHeight.off) >>> 0, sm.u32((rectOff + 12) >>> 0));

    if ((m.u32(pTarget) | 0) === 2) {
      if (nLevelId === 1) {
        const pRoomEx = m.u32((pTarget + 0x14) >>> 0);
        m.setU32((pRoomEx + 4) >>> 0, sm.u32((frameBase + 0xfc + (idx << 2)) >>> 0));
      } else if (nLevelId === 0x28) {
        const pRoomEx = m.u32((pTarget + 0x14) >>> 0);
        m.setU32((pRoomEx + 4) >>> 0, sm.u32((frameBase + 0xfc + (idx << 2) + 4) >>> 0));
      }
    }

    if (nLevelId === 6) {
      const pLvl1b = findOrAllocLevel113c(m, drlg, 0x1b);
      const pRoomEx = m.u32((pLvl1b + 0x14) >>> 0);
      const stateVal = sm.u32((frameBase + 0xfc + (idx << 2)) >>> 0) | 0;
      if (stateVal === 1) {
        const { lo } = stepDrlgSeed64_113c(m, drlg);
        m.setU32((pRoomEx + 4) >>> 0, ((lo & 1) !== 0 ? 1 : 2) >>> 0);
      } else if (stateVal === 3) {
        const { lo } = stepDrlgSeed64_113c(m, drlg);
        m.setU32((pRoomEx + 4) >>> 0, ((~lo) & 1) >>> 0);
      }
    }

    if (postFn !== undefined) {
      postFn(sm, pTarget, idx, (frameBase + 0xfc) >>> 0);
    }

    if (m.u8((drlg + 0x480) >>> 0) !== 4) {
      if (vis1 !== 0) {
        const pWarpA = DRLG_GetOrAllocObjectPresetRecord113c(m, drlg, nLevelId);
        const pWarpB = DRLG_GetOrAllocObjectPresetRecord113c(m, drlg, vis1);
        DRLG_SetWarpId113c(m, pWarpA, vis1, -1, -1);
        DRLG_SetWarpId113c(m, pWarpB, nLevelId, -1, -1);
      }
      if (vis2 !== 0) {
        const pWarpA = DRLG_GetOrAllocObjectPresetRecord113c(m, drlg, nLevelId);
        const pWarpB = DRLG_GetOrAllocObjectPresetRecord113c(m, drlg, vis2);
        DRLG_SetWarpId113c(m, pWarpA, vis2, -1, -1);
        DRLG_SetWarpId113c(m, pWarpB, nLevelId, -1, -1);
      }
    }

    idx = (idx + 1) | 0;
  }
}
