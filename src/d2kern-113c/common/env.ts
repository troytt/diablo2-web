/**
 * Diablo II v1.13c `D2Common.dll` environment cycle and DRLG grid segment helpers
 * (`Enviro.cpp`, `Drlg\DrlgGrid.cpp`), image base `0x6FD50000`.
 *
 * Every function below is a 1:1 port of the cited disassembly (`objdump -d -M intel` on `D2Common.dll`).
 */
import {
  D2DrlgGridStrc,
  D2EnvironmentStrc,
} from '../mem/layout.generated.ts';
import type { Memory113c } from '../mem/sparse-memory.ts';
import { DRLG_GetActNoFromLevelId113c } from './drlg/drlg.ts';
import { D2CommonAssertError } from './inline-helpers.ts';
import { imul32, sdiv32 } from './int-math.ts';

const ENV_CPP_FILE_113C = '..\\Source\\D2Common\\ENVIRONMENT\\Env.cpp';

/**
 * Environment cycle tables at `0x6FDEB160` (normal), `0x6FDEB1A8` (Act 3 eclipse), and `0x6FDEB1F0` (default eclipse).
 * Each table has 6 rows of `int32[3]` (`[nTicksBegin, nPeriodOfDay, dwRGB]`, 72 bytes per table).
 * Copied verbatim from `D2Common.dll` v1.13c.
 */
export const ENV_CYCLE_NORMAL_6FDEB160 = Int32Array.from([
  320, 3, 15962237,
  340, 3, 8632528,
  0, 0, 16777215,
  160, 1, 16777215,
  180, 1, 12687554,
  200, 2, 15962237,
]);

export const ENV_CYCLE_ACT3_ECLIPSE_6FDEB1A8 = Int32Array.from([
  340, 3, 15943411,
  350, 3, 8632528,
  0, 0, 1316095,
  180, 1, 2031615,
  190, 1, 12687380,
  200, 2, 15962237,
]);

export const ENV_CYCLE_ECLIPSE_6FDEB1F0 = Int32Array.from([
  300, 3, 15932928,
  0, 0, 15998464,
  60, 1, 15932928,
  120, 2, 15932928,
  180, 2, 15998464,
  240, 2, 15932928,
]);

export const ENV_TICK_RATES_6FDEB238 = Int32Array.from([128, 4, 8]);

const KERNEL32_GET_TICK_COUNT_IAT_VA_6FDD91FC = 0x6fdd91fc;

const F32_SCRATCH_BUF = new ArrayBuffer(4);
const F32_SCRATCH_VIEW = new DataView(F32_SCRATCH_BUF);

function f32ToBits113c(val: number): number {
  F32_SCRATCH_VIEW.setFloat32(0, val, true);
  return F32_SCRATCH_VIEW.getUint32(0, true);
}

function bitsToF32_113c(bits: number): number {
  F32_SCRATCH_VIEW.setUint32(0, bits >>> 0, true);
  return F32_SCRATCH_VIEW.getFloat32(0, true);
}

function applyCellOp(
  m: Memory113c,
  pCell: number,
  uFlags: number,
  eOp: number,
): void {
  const addr = pCell >>> 0;
  const val = uFlags >>> 0;
  switch (eOp | 0) {
    case 0:
      m.setU32(addr, (m.u32(addr) | val) >>> 0);
      break;
    case 1:
      m.setU32(addr, (m.u32(addr) & val) >>> 0);
      break;
    case 2:
      m.setU32(addr, (m.u32(addr) ^ val) >>> 0);
      break;
    case 3:
      m.setU32(addr, val);
      break;
    case 4:
      if (m.u32(addr) === 0) {
        m.setU32(addr, val);
      }
      break;
    case 5:
      m.setU32(addr, (m.u32(addr) & ~val) >>> 0);
      break;
    default:
      throw new Error(`DRLGGRID applyCellOp: invalid eFlagOp=${eOp}`);
  }
}

/**
 * `@va D2Common:0x6FD86FE0` (`ENVIRONMENT_Init113c` / `DRLGGRID_ApplyPointListCellFlags`, custom `eax = pNode`, `edi = pGrid`, `ebx = uFlags`, `ret`).
 *
 * `Drlg\DrlgGrid.cpp` helper (historical manifest symbol `ENVIRONMENT_Init`):
 * walks the linked list of `D2DrlgVertexStrc` nodes (`+0x00 = nPosX`, `+0x04 = nPosY`, `+0x10 = pNext`);
 * for each node inside `[0, pGrid->nWidth) x [0, pGrid->nHeight)`, applies `gafGridCellOps[0]` (`OpOr`)
 * with `uFlags` to `&pGrid->pCells[pGrid->pRowOffsets[y] + x]`.
 */
export function ENVIRONMENT_Init113c(
  m: Memory113c,
  pNode: number,
  pGrid: number,
  uFlags: number,
): void {
  let esi = pNode >>> 0;
  const flags = uFlags >>> 0;
  while (esi !== 0) {
    const x = m.u32(esi) | 0;
    const y = m.u32((esi + 4) >>> 0) | 0;
    esi = m.u32((esi + 0x10) >>> 0);
    if (
      x >= 0 &&
      x < (m.get(pGrid, D2DrlgGridStrc.nWidth) | 0) &&
      y >= 0 &&
      y < (m.get(pGrid, D2DrlgGridStrc.nHeight) | 0)
    ) {
      const pRowOffsets = m.get(pGrid, D2DrlgGridStrc.pRowOffsets);
      const rowOff = m.u32((pRowOffsets + y * 4) >>> 0) | 0;
      const pCells = m.get(pGrid, D2DrlgGridStrc.pCells);
      const pCell = (pCells + (((rowOff + x) | 0) << 2)) >>> 0;
      m.setU32(pCell, (m.u32(pCell) | flags) >>> 0);
    }
  }
}

/**
 * `@va D2Common:0x6FD87020` (`ENVIRONMENT_Alloc113c` / `DRLGGRID_ApplySegmentCellFlags`, custom `esi = pGrid`, `[esp+4] = pNode`,
 * `[esp+8] = uFlags`, `[esp+0xC] = eOp`, `[esp+0x10] = bIncludeEnd`, `ret 0x10`).
 *
 * `Drlg\DrlgGrid.cpp` segment rasterizer (historical manifest symbol `ENVIRONMENT_Alloc`):
 * applies `gafGridCellOps[eOp]` with `uFlags` along the axis-aligned segment between `pNode` (`+0x00`, `+0x04`)
 * and `pNode->pNext` (`+0x10`), including the start vertex (`pNode`) and optionally the end vertex (`pNext`)
 * when `bIncludeEnd != 0`.
 */
export function ENVIRONMENT_Alloc113c(
  m: Memory113c,
  pGrid: number,
  pNode: number,
  uFlags: number,
  eOp: number,
  bIncludeEnd: number,
): void {
  const node = pNode >>> 0;
  const pNext = m.u32((node + 0x10) >>> 0);
  const x1 = m.u32(node) | 0;
  const x2 = m.u32(pNext) | 0;
  const y1 = m.u32((node + 4) >>> 0) | 0;
  const y2 = m.u32((pNext + 4) >>> 0) | 0;

  if (x1 === x2 && y1 === y2) {
    const pRowOffsets = m.get(pGrid, D2DrlgGridStrc.pRowOffsets);
    const rowOff = m.u32((pRowOffsets + y1 * 4) >>> 0) | 0;
    const pCells = m.get(pGrid, D2DrlgGridStrc.pCells);
    const pCell = (pCells + (((rowOff + x1) | 0) << 2)) >>> 0;
    applyCellOp(m, pCell, uFlags, eOp);
    return;
  }

  let curX: number;
  let curY: number;
  let targetX: number;
  let targetY: number;
  let stepMode: number;

  if (x1 === x2) {
    curX = x1;
    targetX = x1;
    stepMode = 0;
    if (y1 < y2) {
      curY = (y1 + 1) | 0;
      targetY = y2;
    } else {
      curY = (y2 + 1) | 0;
      targetY = y1;
    }
  } else {
    curY = y1;
    targetY = y1;
    stepMode = 1;
    if (x1 < x2) {
      curX = (x1 + 1) | 0;
      targetX = x2;
    } else {
      curX = (x2 + 1) | 0;
      targetX = x1;
    }
  }

  while (!(curX === targetX && curY === targetY)) {
    const pRowOffsets = m.get(pGrid, D2DrlgGridStrc.pRowOffsets);
    const rowOff = m.u32((pRowOffsets + curY * 4) >>> 0) | 0;
    const pCells = m.get(pGrid, D2DrlgGridStrc.pCells);
    const pCell = (pCells + (((rowOff + curX) | 0) << 2)) >>> 0;
    applyCellOp(m, pCell, uFlags, eOp);
    if (stepMode === 0) {
      curY = (curY + 1) | 0;
    } else {
      curX = (curX + 1) | 0;
    }
  }

  const startY = m.u32((node + 4) >>> 0) | 0;
  const startX = m.u32(node) | 0;
  const pRowOffsets0 = m.get(pGrid, D2DrlgGridStrc.pRowOffsets);
  const rowOff0 = m.u32((pRowOffsets0 + startY * 4) >>> 0) | 0;
  const pCells0 = m.get(pGrid, D2DrlgGridStrc.pCells);
  const pStartCell = (pCells0 + (((rowOff0 + startX) | 0) << 2)) >>> 0;
  applyCellOp(m, pStartCell, uFlags, eOp);

  if ((bIncludeEnd | 0) !== 0) {
    const endNode = m.u32((node + 0x10) >>> 0);
    const endY = m.u32((endNode + 4) >>> 0) | 0;
    const endX = m.u32(endNode) | 0;
    const pRowOffsets1 = m.get(pGrid, D2DrlgGridStrc.pRowOffsets);
    const rowOff1 = m.u32((pRowOffsets1 + endY * 4) >>> 0) | 0;
    const pCells1 = m.get(pGrid, D2DrlgGridStrc.pCells);
    const pEndCell = (pCells1 + (((rowOff1 + endX) | 0) << 2)) >>> 0;
    applyCellOp(m, pEndCell, uFlags, eOp);
  }
}

/**
 * `@va D2Common:0x6FD87170` (`ENVIRONMENT_SetCycleIndex113c`, custom `eax = pEnv`, `ret`).
 *
 * Updates `pEnv->nTimeOfDay (+0x04)` and `pEnv->dwTicks (+0x08)` from `ENV_CYCLE_NORMAL_6FDEB160`
 * (when `pEnv->bEclipse (+0x30) == 0`) or `ENV_CYCLE_ECLIPSE_6FDEB1F0` (when `bEclipse != 0`)
 * indexed by `pEnv->dwCycleIndex (+0x00)`.
 */
export function ENVIRONMENT_SetCycleIndex113c(
  m: Memory113c,
  pEnv: number,
): void {
  const bEclipse = m.get(pEnv, D2EnvironmentStrc.bEclipse) | 0;
  const idx = m.get(pEnv, D2EnvironmentStrc.dwCycleIndex) | 0;
  const table =
    bEclipse === 0 ? ENV_CYCLE_NORMAL_6FDEB160 : ENV_CYCLE_ECLIPSE_6FDEB1F0;
  const nBaseTicks = table[idx * 3]!;
  const nPeriod = table[idx * 3 + 1]!;
  m.set(pEnv, D2EnvironmentStrc.nTimeOfDay, nPeriod >>> 0);
  const nInitTick = m.get(pEnv, D2EnvironmentStrc.dwCyclePeriod) | 0;
  m.set(
    pEnv,
    D2EnvironmentStrc.dwTicks,
    imul32(nInitTick, nBaseTicks) >>> 0,
  );
}

/**
 * `@va D2Common:0x6FD871C0` (`ENV_UpdateLightColor113c`, custom `edx = nAct`, `[esp+4] = pEnv`, `ret 4`).
 *
 * Interpolates RGB channels (`pEnv + 0x18..+0x1A`) between `dwCycleIndex` and `(dwCycleIndex + 1) % 6`
 * in `ENV_CYCLE_ACT3_ECLIPSE_6FDEB1A8` (`nAct == 3`), `ENV_CYCLE_NORMAL_6FDEB160` (`bEclipse == 0`),
 * or `ENV_CYCLE_ECLIPSE_6FDEB1F0` (`bEclipse != 0`).
 */
export function ENV_UpdateLightColor113c(
  m: Memory113c,
  nAct: number,
  pEnv: number,
): void {
  const env = pEnv >>> 0;
  const curIdx = m.u32(env) | 0;
  let nextIdx = (curIdx + 1) | 0;
  if (nextIdx === 6) {
    nextIdx = 0;
  }

  let table: Int32Array;
  if ((nAct | 0) === 3) {
    table = ENV_CYCLE_ACT3_ECLIPSE_6FDEB1A8;
  } else if ((m.u32((env + 0x30) >>> 0) | 0) === 0) {
    table = ENV_CYCLE_NORMAL_6FDEB160;
  } else {
    table = ENV_CYCLE_ECLIPSE_6FDEB1F0;
  }

  const nRate = m.u32((env + 0x28) >>> 0) | 0;
  const nCurStart = imul32(table[curIdx * 3]!, nRate);
  const nTicks = m.u32((env + 0x08) >>> 0) | 0;
  const nElapsed = (nTicks - nCurStart) | 0;
  const nNextStart = imul32(table[nextIdx * 3]!, nRate);
  const nSpan = (nNextStart - nCurStart) | 0;
  const fRatio = nElapsed / nSpan;

  const curRgb = table[curIdx * 3 + 2]! >>> 0;
  const nextRgb = table[nextIdx * 3 + 2]! >>> 0;

  const curR = curRgb & 0xff;
  const curG = (curRgb >>> 8) & 0xff;
  const curB = (curRgb >>> 16) & 0xff;

  const nextR = nextRgb & 0xff;
  const nextG = (nextRgb >>> 8) & 0xff;
  const nextB = (nextRgb >>> 16) & 0xff;

  const dG = Math.trunc((nextG - curG) * fRatio + 0.5) | 0;
  const dB = Math.trunc((nextB - curB) * fRatio + 0.5) | 0;
  const dR = Math.trunc((nextR - curR) * fRatio + 0.5) | 0;

  m.setU8((env + 0x18) >>> 0, (curR + dR) & 0xff);
  m.setU8((env + 0x19) >>> 0, (curG + dG) & 0xff);
  m.setU8((env + 0x1a) >>> 0, (curB + dB) & 0xff);
}

/**
 * `@va D2Common:0x6FD873B0` (`D2Common.#11062` `ENV_GetCycleState113c`,
 * `__stdcall(pAct, pCycleIndex, pTicks, pEclipse)`, `ret 0x10`).
 *
 * Asserts `pAct != 0` (`line 1351`), reads `pEnv = pAct->pEnvironment (+0x04)`, and stores
 * `pEnv->dwCycleIndex (+0x00)`, `pEnv->dwTicks (+0x08)`, and `pEnv->bEclipse (+0x30)`.
 */
export function ENV_GetCycleState113c(
  m: Memory113c,
  pAct: number,
  pCycleIndex: number,
  pTicks: number,
  pEclipse: number,
): void {
  if (pAct === 0) {
    throw new D2CommonAssertError(ENV_CPP_FILE_113C, 0x547);
  }
  const pEnv = m.u32((pAct + 0x04) >>> 0);
  m.setU32(pCycleIndex >>> 0, m.u32(pEnv));
  m.setU32(pTicks >>> 0, m.u32((pEnv + 0x08) >>> 0));
  m.setU32(pEclipse >>> 0, m.u32((pEnv + 0x30) >>> 0));
}

/**
 * `@va D2Common:0x6FD87570` (`ENVIRONMENT_ApplyCycleColors113c`, custom `eax = pEnv`, `ecx = nAct`, `ret`).
 *
 * Advances `pEnv->dwTicks (+0x08)` with Act 2 / Act 3 non-eclipse accelerations, wraps at `360 * dwCyclePeriod`,
 * and advances `pEnv->dwCycleIndex (+0x00)` and `pEnv->nTimeOfDay (+0x04)` when `dwTicks` crosses
 * the next cycle row's scaled `nTicksBegin`.
 */
export function ENVIRONMENT_ApplyCycleColors113c(
  m: Memory113c,
  pEnv: number,
  nAct: number,
): void {
  const act = nAct | 0;
  let ticks = ((m.get(pEnv, D2EnvironmentStrc.dwTicks) | 0) + 1) | 0;
  m.set(pEnv, D2EnvironmentStrc.dwTicks, ticks >>> 0);

  const bEclipse = m.get(pEnv, D2EnvironmentStrc.bEclipse) | 0;
  if (bEclipse === 0) {
    if (act === 3) {
      ticks = (ticks + 0x0f) | 0;
      m.set(pEnv, D2EnvironmentStrc.dwTicks, ticks >>> 0);
    } else {
      const idx = m.get(pEnv, D2EnvironmentStrc.dwCycleIndex) | 0;
      if (ENV_CYCLE_NORMAL_6FDEB160[idx * 3 + 1]! === 2) {
        ticks = (ticks + 1) | 0;
        m.set(pEnv, D2EnvironmentStrc.dwTicks, ticks >>> 0);
        if (act === 2) {
          ticks = (ticks + 8) | 0;
          m.set(pEnv, D2EnvironmentStrc.dwTicks, ticks >>> 0);
        }
      }
    }
  }

  const nInitTick = m.get(pEnv, D2EnvironmentStrc.dwCyclePeriod) | 0;
  const curTicks = m.get(pEnv, D2EnvironmentStrc.dwTicks) | 0;
  if (curTicks >= imul32(nInitTick, 0x168)) {
    m.set(pEnv, D2EnvironmentStrc.dwTicks, 0);
  }

  const curIdx = m.get(pEnv, D2EnvironmentStrc.dwCycleIndex) | 0;
  const nextIdxRaw = (curIdx + 1) | 0;
  const nextIdx = nextIdxRaw < 6 ? nextIdxRaw : 0;

  const thresholdTable =
    bEclipse === 0
      ? ENV_CYCLE_NORMAL_6FDEB160
      : act === 3
        ? ENV_CYCLE_ACT3_ECLIPSE_6FDEB1A8
        : ENV_CYCLE_ECLIPSE_6FDEB1F0;
  const threshold = imul32(thresholdTable[nextIdx * 3]!, nInitTick);

  if ((m.get(pEnv, D2EnvironmentStrc.dwTicks) | 0) > threshold) {
    m.set(pEnv, D2EnvironmentStrc.dwCycleIndex, nextIdxRaw >>> 0);
    if (nextIdxRaw >= 6) {
      m.set(pEnv, D2EnvironmentStrc.dwCycleIndex, 0);
    }
    const finalIdx = m.get(pEnv, D2EnvironmentStrc.dwCycleIndex) | 0;
    const snapTable =
      bEclipse === 0 ? ENV_CYCLE_NORMAL_6FDEB160 : ENV_CYCLE_ECLIPSE_6FDEB1F0;
    m.set(
      pEnv,
      D2EnvironmentStrc.nTimeOfDay,
      snapTable[finalIdx * 3 + 1]! >>> 0,
    );
    m.set(
      pEnv,
      D2EnvironmentStrc.dwTicks,
      imul32(snapTable[finalIdx * 3]!, nInitTick) >>> 0,
    );
  }
}

/**
 * `@va D2Common:0x6FD87660` (`D2Common.#11045` `ENV_StepCycle113c`, `__stdcall(pAct, nActNo)`, `ret 8`).
 *
 * Advances the environment cycle via `0x6FD87570` (`ENVIRONMENT_ApplyCycleColors113c`) and returns `1`
 * if `abs((dwTicks / dwCyclePeriod) - nPrevDegrees) > 16` (updating `nPrevDegrees` at `+0x34`) or if
 * `nTimeOfDay (+0x04)` or `dwCycleIndex (+0x00)` changed; otherwise returns `0`.
 */
export function ENV_StepCycle113c(
  m: Memory113c,
  pAct: number,
  nActNo: number,
): number {
  if (pAct === 0) {
    throw new D2CommonAssertError(ENV_CPP_FILE_113C, 0x547);
  }
  const pEnv = m.u32((pAct + 0x04) >>> 0);
  if (pEnv === 0) {
    return 0;
  }
  const oldIndex = m.u32(pEnv) | 0;
  const oldPeriod = m.u32((pEnv + 0x04) >>> 0) | 0;
  ENVIRONMENT_ApplyCycleColors113c(m, pEnv, nActNo | 0);

  const nRate = m.u32((pEnv + 0x28) >>> 0) | 0;
  if (nRate !== 0) {
    const nQuotient = sdiv32(m.u32((pEnv + 0x08) >>> 0) | 0, nRate);
    let nDiff = (nQuotient - (m.u32((pEnv + 0x34) >>> 0) | 0)) | 0;
    if (nDiff < 0) {
      nDiff = (-nDiff) | 0;
    }
    if (nDiff > 0x10) {
      m.setU32((pEnv + 0x34) >>> 0, nQuotient >>> 0);
      return 1;
    }
  }

  if (
    oldPeriod !== (m.u32((pEnv + 0x04) >>> 0) | 0) ||
    oldIndex !== (m.u32(pEnv) | 0)
  ) {
    return 1;
  }
  return 0;
}

/**
 * `@va D2Common:0x6FD876F0` (`ENV_UpdateIntensityAndSunAngle113c`, custom `esi = pEnv`, `edi = nAct`, `ecx = nLevelNo`, `ret`).
 *
 * Updates `pEnv->nIntensity (+0x0C)`, `pEnv->fCos (+0x1C)`, `pEnv->fLast (+0x20)`, and `pEnv->fSin (+0x24)`.
 */
export function ENV_UpdateIntensityAndSunAngle113c(
  m: Memory113c,
  pEnv: number,
  nAct: number,
  nLevelNo: number,
): void {
  const env = pEnv >>> 0;
  const act = nAct | 0;
  const lvl = nLevelNo | 0;

  if (act === 3) {
    const idx = ((lvl - 103) | 0) >>> 0;
    let target = 0x10;
    if (idx === 0) target = 0x80;
    else if (idx === 1) target = 0x40;
    else if (idx === 2) target = 0x38;
    else if (idx === 3) target = 0x30;

    let cur = m.u32((env + 0x0c) >>> 0) | 0;
    if (cur < target) {
      cur = (cur + 1) | 0;
      m.setU32((env + 0x0c) >>> 0, cur >>> 0);
    }
    cur = m.u32((env + 0x0c) >>> 0) | 0;
    if (cur > target) {
      cur = (cur - 1) | 0;
      m.setU32((env + 0x0c) >>> 0, cur >>> 0);
    }
    cur = m.u32((env + 0x0c) >>> 0) | 0;
    if (cur === 0) {
      m.setU32((env + 0x0c) >>> 0, target >>> 0);
    }
    return;
  }

  if ((m.u32((env + 0x30) >>> 0) | 0) !== 0) {
    let cur = m.u32((env + 0x0c) >>> 0) | 0;
    if (cur > 0x20) {
      cur = (cur - 8) | 0;
      m.setU32((env + 0x0c) >>> 0, cur >>> 0);
    }
    if ((m.u32((env + 0x0c) >>> 0) | 0) < 0x20) {
      m.setU32((env + 0x0c) >>> 0, 0x20);
    }
    return;
  }

  if (lvl === 0x78) {
    m.setU32((env + 0x0c) >>> 0, 0xc8);
    return;
  }

  const nTicks = m.u32((env + 0x08) >>> 0) | 0;
  const nRate = m.u32((env + 0x28) >>> 0) | 0;
  const nHalfDay = imul32(nRate, 0xb4);

  const angle = (nTicks / nRate) * (1.0 / 180.0) * 3.1415927410125732;
  const fCosBits = f32ToBits113c(-Math.cos(angle));
  m.setU32((env + 0x1c) >>> 0, fCosBits);

  let fSinVal = Math.sin(angle);
  if (nTicks >= nHalfDay) {
    fSinVal *= 0.5;
  }
  const fSinBits = f32ToBits113c(fSinVal);
  m.setU32((env + 0x24) >>> 0, fSinBits);
  m.setU32((env + 0x20) >>> 0, 0);

  const fSinReloaded = bitsToF32_113c(m.u32((env + 0x24) >>> 0));
  let nIntensity = Math.trunc(fSinReloaded * 128.0 + 128.0 + 0.5) | 0;
  m.setU32((env + 0x0c) >>> 0, nIntensity >>> 0);

  const nMax = act === 4 ? 0xaa : 0xff;
  if (nIntensity <= 0) {
    nIntensity = 0;
  }
  if (nIntensity >= nMax) {
    nIntensity = nMax;
  }
  m.setU32((env + 0x0c) >>> 0, nIntensity >>> 0);
}

/**
 * `@va D2Common:0x6FD87BA0` (`ENV_AllocDrlgEnvironment113c`, custom `ecx = pMemPool`, `ret`).
 *
 * Allocates and zeroes a `0x38`-byte `D2EnvironmentStrc`, initializes `dwCycleIndex = 2`,
 * `dwCyclePeriod = 128`, calls `0x6FD876F0` and `0x6FD871C0`, and records `KERNEL32.GetTickCount()`
 * at `+0x10`.
 */
export function ENV_AllocDrlgEnvironment113c(
  m: Memory113c,
  _pMemPool = 0,
): number {
  const pEnv = m.alloc(0x38);
  m.fill(pEnv, 0x38, 0);
  const rateIdx = m.u32((pEnv + 0x2c) >>> 0) | 0;
  m.setU32(pEnv, 2);
  const nRate = ENV_TICK_RATES_6FDEB238[rateIdx]!;
  const bEclipse = m.u32((pEnv + 0x30) >>> 0) | 0;
  m.setU32((pEnv + 0x28) >>> 0, nRate >>> 0);

  const table =
    bEclipse === 0 ? ENV_CYCLE_NORMAL_6FDEB160 : ENV_CYCLE_ECLIPSE_6FDEB1F0;
  m.setU32((pEnv + 0x04) >>> 0, table[2 * 3 + 1]! >>> 0);
  m.setU32((pEnv + 0x08) >>> 0, imul32(nRate, table[2 * 3]!) >>> 0);

  ENV_UpdateIntensityAndSunAngle113c(m, pEnv, 0, 0);
  ENV_UpdateLightColor113c(m, 0, pEnv);

  m.setU32((pEnv + 0x14) >>> 0, 0);
  const dwTick = m.u32(KERNEL32_GET_TICK_COUNT_IAT_VA_6FDD91FC);
  m.setU32((pEnv + 0x30) >>> 0, 0);
  m.setU32((pEnv + 0x10) >>> 0, dwTick);
  return pEnv >>> 0;
}

/**
 * `@va D2Common:0x6FD87CA0` (`D2Common.#10337` `ENV_InitEclipseEnvironment113c`, `__stdcall(pAct)`, `ret 4`).
 *
 * Initializes `pAct->pEnvironment (+0x04)` into the eclipse state (`dwRateIdx = 1`, `dwCyclePeriod = 4`,
 * `dwCycleIndex = 0`, `nTimeOfDay = 3`, `bEclipse = 1`) and updates intensity, sun angle, and light color.
 */
export function ENV_InitEclipseEnvironment113c(
  m: Memory113c,
  pAct: number,
): void {
  if (pAct === 0) {
    throw new D2CommonAssertError(ENV_CPP_FILE_113C, 0x547);
  }
  const pEnv0 = m.u32((pAct + 0x04) >>> 0);
  m.setU32((pEnv0 + 0x2c) >>> 0, 1);
  m.setU32((pEnv0 + 0x28) >>> 0, ENV_TICK_RATES_6FDEB238[1]! >>> 0);
  const pEnv = m.u32((pAct + 0x04) >>> 0);
  m.setU32(pEnv, 0);
  m.setU32((pEnv + 0x08) >>> 0, 0);
  m.setU32((pEnv + 0x04) >>> 0, ENV_CYCLE_ECLIPSE_6FDEB1F0[1]! >>> 0);
  const nActNo = DRLG_GetActNoFromLevelId113c(m, 0) & 0xff;
  ENV_UpdateIntensityAndSunAngle113c(m, pEnv, nActNo, 0);
  m.setU32((pEnv + 0x30) >>> 0, 1);
  ENVIRONMENT_SetCycleIndex113c(m, pEnv);
  ENV_UpdateIntensityAndSunAngle113c(m, pEnv, nActNo, 0);
  ENV_UpdateLightColor113c(m, nActNo, pEnv);
}

