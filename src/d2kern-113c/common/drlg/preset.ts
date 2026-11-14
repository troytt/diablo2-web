/**
 * Diablo II v1.13c `D2Common.dll` preset-map (`Drlg\Preset.cpp` block) leaf functions, image base `0x6FD50000`.
 *
 * 1:1 ports of the cited disassembly. Neither function calls anything. Offsets come from
 * `mem/layout.generated.ts` (`D2DrlgMapStrc`, `D2DrlgCoordStrc` in `docs/oracle/route2-layout.json`).
 */
import type { Memory113c } from '../../mem/sparse-memory.ts'
import {
  D2DrlgCoordStrc,
  D2DrlgCoordStrc_SIZE,
  D2DrlgLevelStrc,
  D2DrlgMapStrc,
  D2DrlgStrc,
  D2RoomExStrc,
} from '../../mem/layout.generated.ts'
import { DATATBLS_GetLvlPrestTxtRecordFromLevelId113c } from '../../tables/lvl-tbls-113c.ts'
import { D2CommonAssertError, SEED_RollRandomNumberInline113c } from '../inline-helpers.ts'
import { imul32, sdiv32 } from '../int-math.ts'
import { fogGetLinkIndex113c } from '../inventory.ts'
import { STATLIST_FindStatIndex113c } from '../statlist.ts'
import {
  DRLGGRID_ApplyAllCellFlags113c,
  DRLGGRID_InitializeGridWindow113c,
  DRLGGRID_OpOr113c,
  DRLGPRESET_FreePresetRoomGrids113c,
} from './drlg-grid.ts'
import {
  DRLGPRESET_InitPresetRoomEx113c,
  DRLGPRESET_SpawnFortressWall2Presets113c,
  DRLGPRESET_SpawnHoradricOrifice113c,
  DRLGPRESET_SpawnMapAIPathPresets113c,
  DRLGROOM_AllocRoomEx113c,
  DRLGROOM_LoadDt1Files113c,
  DRLGWARP_GetWarpDstAdjustData113c,
} from './drlg-room.ts'
import { DRLGVER_FreeVertices113c } from './drlg-ver.ts'
import { DRLGROOMTILE_GetWarpLevelsArray113c } from './room-tile.ts'
import { DRLG_GetLevel113c, DRLG_InitLevelCoordsFromLevelsTxt113c } from './drlg.ts'
import { DRLGROOM_BuildRoomGridsAndTiles113c, DRLG_InitLevelRooms113c } from './drlg-room.ts'

const PRESET_STACK_BASE = 0x7ff90000
const PRESET_STACK_SIZE = 0x4000
const _presetStackBuf = new ArrayBuffer(PRESET_STACK_SIZE)
const _presetStackU8 = new Uint8Array(_presetStackBuf)
const _presetStackDV = new DataView(_presetStackBuf)

function withPresetStackScratch113c(m: Memory113c): Memory113c {
  const isStack = (p: number): boolean => {
    const u = p >>> 0
    return u >= PRESET_STACK_BASE && u < PRESET_STACK_BASE + PRESET_STACK_SIZE
  }
  const self: Memory113c = {
    alloc: size => m.alloc(size),
    u8: p => (isStack(p) ? _presetStackU8[(p >>> 0) - PRESET_STACK_BASE]! : m.u8(p)),
    u16: p => (isStack(p) ? _presetStackDV.getUint16((p >>> 0) - PRESET_STACK_BASE, true) : m.u16(p)),
    u32: p => (isStack(p) ? _presetStackDV.getUint32((p >>> 0) - PRESET_STACK_BASE, true) : m.u32(p)),
    setU8: (p, v) => {
      if (isStack(p)) _presetStackU8[(p >>> 0) - PRESET_STACK_BASE] = v & 0xff
      else m.setU8(p, v)
    },
    setU16: (p, v) => {
      if (isStack(p)) _presetStackDV.setUint16((p >>> 0) - PRESET_STACK_BASE, v & 0xffff, true)
      else m.setU16(p, v)
    },
    setU32: (p, v) => {
      if (isStack(p)) _presetStackDV.setUint32((p >>> 0) - PRESET_STACK_BASE, v >>> 0, true)
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
        const off = (p >>> 0) - PRESET_STACK_BASE
        _presetStackU8.fill(v & 0xff, off, off + len)
      } else {
        m.fill(p, len, v)
      }
    },
  }
  return self
}

/**
 * `@va D2Common:0x6FD59C60` (`DRLGPRESET_FinalizePopsLocations`, not exported; LTCG `esi = pDrlgMap` + 1 stack arg `nPops`, `ret 4`).
 * Sole caller `0x6FD5C060` (`0x6FD5C562 push ecx; mov esi, ebp; call 0x6fd59c60`).
 *
 * - `0x6FD59C6C mov [esi+0x40], eax`: `pDrlgMap->nPops = nPops`; `jle` (signed) -> done when `nPops <= 0`.
 * - For `i` in `0 .. nPops)` (signed `jl`), `R = pDrlgMap->pPopsLocation (+0x50) + 0x10 * i` (re-read every iteration):
 *   - reads `R.x1 (+8)`, `R.x0 (+0)`, `R.y0 (+4)`, `R.y1 (+0xC)`; signed min/max (`jl` / `jg`);
 *   - `R.x0 = pDrlgMap->nPosX (+0x10) + xmin` (`0x6FD59CC0`), `R.y0 = pDrlgMap->nPosY (+0x14) + ymin` (`0x6FD59CCB`),
 *     `R.x1 = xmax - xmin + 1` (`0x6FD59CD5`), `R.y1 = ymax - ymin + 1` (`0x6FD59CD9`), all 32-bit wrapping;
 *   - `pDrlgMap->pPopsIndex (+0x44)[i] = idx / 4 - 1` with C truncating division (`0x6FD59CE4 cdq; and edx, 3;
 *     add eax, edx; sar eax, 2; dec eax`), i.e. `sdiv32(idx, 4) - 1`, NOT a flooring `>> 2`.
 */
export function DRLGPRESET_FinalizePopsLocations113c(m: Memory113c, pDrlgMap: number, nPops: number): void {
  const n = nPops | 0
  m.set(pDrlgMap, D2DrlgMapStrc.nPops, n >>> 0)
  if (n <= 0) return
  for (let i = 0; i < n; i++) {
    const pR = (m.get(pDrlgMap, D2DrlgMapStrc.pPopsLocation) + D2DrlgCoordStrc_SIZE * i) >>> 0
    const x1 = m.get(pR, D2DrlgCoordStrc.nWidth) | 0
    const x0 = m.get(pR, D2DrlgCoordStrc.nPosX) | 0
    const xmin = x0 < x1 ? x0 : x1
    const y0 = m.get(pR, D2DrlgCoordStrc.nPosY) | 0
    const y1 = m.get(pR, D2DrlgCoordStrc.nHeight) | 0
    const ymin = y0 < y1 ? y0 : y1
    const xmax = x0 > x1 ? x0 : x1
    const ymax = y0 > y1 ? y0 : y1
    m.set(pR, D2DrlgCoordStrc.nPosX, (m.get(pDrlgMap, D2DrlgMapStrc.nPosX) + xmin) >>> 0)
    m.set(pR, D2DrlgCoordStrc.nPosY, (m.get(pDrlgMap, D2DrlgMapStrc.nPosY) + ymin) >>> 0)
    m.set(pR, D2DrlgCoordStrc.nWidth, (xmax - xmin + 1) >>> 0)
    m.set(pR, D2DrlgCoordStrc.nHeight, (ymax - ymin + 1) >>> 0)
    const pIdx = (m.get(pDrlgMap, D2DrlgMapStrc.pPopsIndex) + i * 4) >>> 0
    m.setU32(pIdx, (sdiv32(m.u32(pIdx) | 0, 4) - 1) >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD59DD0` (`D2Common.#10171` `DRLGPRESET_MovePointerAndClear`, fastcall `ecx = ppSrc`, `edx = ppDst`, plain `ret`).
 *
 * `mov eax, [ecx]; mov [edx], eax; mov dword [ecx], 0; mov eax, [edx]; ret`: moves ownership of a pointer and returns
 * the value re-read from `*ppDst` (so `ppSrc == ppDst` returns `0`).
 */
export function DRLGPRESET_MovePointerAndClear113c(m: Memory113c, ppSrc: number, ppDst: number): number {
  m.setU32(ppDst, m.u32(ppSrc))
  m.setU32(ppSrc, 0)
  return m.u32(ppDst)
}

/**
 * `D2Common.dll` `.data` pointer to `sgptDataTables`.
 *
 * `@va D2Common:0x6FDE9E1C`
 */
export const SGPT_DATA_TABLES_PTR_VA_6FDE9E1C = 0x6fde9e1c

/**
 * `D2Common.dll` `.bss` `sgptDataTables.pLvlPrestTxt` (`D2LvlPrestTxt*`).
 *
 * `@va D2Common:0x6FDF0B3C`
 */
export const SGPT_LVLPREST_TXT_VA_6FDF0B3C = 0x6fdf0b3c

/**
 * `@va D2Common:0x6FD59610` (`DRLGPRESET_ReadFileData113c`, not exported;
 * custom LTCG `esi = hFile`, `edi = nSize`, stack `[esp+4] = pBuffer`, `ret 4`).
 *
 * - Asserts `hFile != 0` (`line 135`, `0x87`).
 * - Calls `Fog.#10104` (`FOG_MPQReadFile(ecx=hFile, edx=pBuffer, nSize, &dwRead, 0, 0, 0)`):
 *   asserts non-zero return (`line 143`, `0x8F`) and `dwRead == nSize` (`line 146`, `0x92`),
 *   copying `nSize` bytes from `hFile` into `pBuffer`.
 */
export function DRLGPRESET_ReadFileData113c(
  m: Memory113c,
  hFile: number,
  nSize: number,
  pBuffer: number,
): void {
  if (hFile === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Preset.cpp', 135)
  }
  if (pBuffer === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Preset.cpp', 143)
  }
  if ((nSize | 0) < 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Preset.cpp', 146)
  }
  const len = nSize >>> 0
  for (let i = 0; i < len; i++) {
    m.setU8((pBuffer + i) >>> 0, m.u8((hFile + i) >>> 0))
  }
}

/**
 * `@va D2Common:0x6FD59700` (`DRLGPRESET_GetFileSize113c`, not exported;
 * custom LTCG `esi = hFile`, stack `[esp+4] = lpFileSizeHigh`, `ret 4`).
 *
 * - Asserts `hFile != 0` (`line 89`, `0x59`).
 * - Calls `Fog.#10105` (`FOG_MPQGetFileSize(ecx=hFile, edx=lpFileSizeHigh)`):
 *   reads `dwSizeLow = *(u32*)hFile`, optionally writes `*(u32*)(hFile + 4)` to `*lpFileSizeHigh`
 *   when `lpFileSizeHigh != 0`, asserts `dwSizeLow != 0` (`line 95`, `0x5F`), and returns `dwSizeLow`.
 */
export function DRLGPRESET_GetFileSize113c(
  m: Memory113c,
  hFile: number,
  lpFileSizeHigh: number,
): number {
  if (hFile === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Preset.cpp', 89)
  }
  const sizeLow = m.u32(hFile >>> 0)
  if (lpFileSizeHigh !== 0) {
    const sizeHigh = m.u32((hFile + 4) >>> 0)
    m.setU32(lpFileSizeHigh >>> 0, sizeHigh)
  }
  if (sizeLow === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Preset.cpp', 95)
  }
  return sizeLow | 0
}

/**
 * `@va D2Common:0x6FD59D90` (`D2Common.#10850` `DRLGPRESET_FreeSaveHeaderBlock113c`,
 * fastcall `ecx = pMemPool`, `edx = pBlock`, plain `ret`).
 *
 * Reads `pData = pBlock->pData (+0x04)`, frees `pData` via `Fog.#10046`, then frees `pBlock` via `Fog.#10046`.
 */
export function DRLGPRESET_FreeSaveHeaderBlock113c(
  m: Memory113c,
  _pMemPool: number,
  pBlock: number,
): void {
  const freeFn = (m as { free?: (p: number) => void }).free
  const pData = m.u32((pBlock + 4) >>> 0)
  if (pData !== 0) {
    freeFn?.call(m, pData)
  }
  if (pBlock !== 0) {
    freeFn?.call(m, pBlock >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD59DE0` (`D2Common.#10496` `DRLGPRESET_CloneSaveHeaderBlock113c`,
 * fastcall `ecx = pMemPool`, `edx = pSrcBlock`, plain `ret`).
 *
 * Allocates an 8-byte `D2SaveHeaderBlockStrc`, zeroes `[0, +4]`, copies `nCount = pSrcBlock->nCount (+0x00)`,
 * allocates `(nCount * 3) << 2` (`12 * nCount`) bytes at `pDstBlock->pData (+0x04)`, copies `(nCount * 3) << 2`
 * bytes from `pSrcBlock->pData (+0x04)`, and returns `pDstBlock`.
 */
export function DRLGPRESET_CloneSaveHeaderBlock113c(
  m: Memory113c,
  _pMemPool: number,
  pSrcBlock: number,
): number {
  const pDst = m.alloc(8)
  m.setU32(pDst, 0)
  m.setU32((pDst + 4) >>> 0, 0)
  const nCount = m.u32(pSrcBlock >>> 0)
  const allocBytes = (Math.imul(nCount | 0, 3) << 2) >>> 0
  m.setU32(pDst, nCount)
  const pBuf = m.alloc(allocBytes)
  const copyBytes = (Math.imul(m.u32(pDst) | 0, 3) << 2) >>> 0
  m.setU32((pDst + 4) >>> 0, pBuf)
  const pSrcData = m.u32((pSrcBlock + 4) >>> 0)
  const dwords = copyBytes >>> 2
  for (let i = 0; i < dwords; i++) {
    m.setU32((pBuf + i * 4) >>> 0, m.u32((pSrcData + i * 4) >>> 0))
  }
  for (let i = dwords << 2; i < copyBytes; i++) {
    m.setU8((pBuf + i) >>> 0, m.u8((pSrcData + i) >>> 0))
  }
  return pDst >>> 0
}

/**
 * `@va D2Common:0x6FD59FA0` (`DRLGPRESET_FreeDrlgFile113c`, not exported;
 * stdcall `(pDrlgFile)`, `ret 4`).
 *
 * - If `pDrlgFile->pBuffer (+0x04) != 0`, frees it via `Fog.#10043` (`0x6FD5922E`).
 * - If `pDrlgFile->pTileData (+0x50) != 0`, frees it via `Fog.#10046` (`0x6FD59228`).
 * - Walks `pDrlgFile->pPresetUnit (+0x54)` (next at `+0x0C`): if `pUnit->pSaveChain (+0x10) != 0`,
 *   frees `pSaveChain->pData (+0x04)` and `pSaveChain`, then frees `pUnit`.
 * - Finally frees `pDrlgFile` via `Fog.#10046`.
 */
export function DRLGPRESET_FreeDrlgFile113c(m: Memory113c, pDrlgFile: number): void {
  const freeFn = (m as { free?: (p: number) => void }).free
  const pBuffer = m.u32((pDrlgFile + 0x04) >>> 0)
  if (pBuffer !== 0) {
    freeFn?.call(m, pBuffer)
  }
  const pTileData = m.u32((pDrlgFile + 0x50) >>> 0)
  if (pTileData !== 0) {
    freeFn?.call(m, pTileData)
  }
  let pUnit = m.u32((pDrlgFile + 0x54) >>> 0)
  while (pUnit !== 0) {
    const curUnit = pUnit
    const pSaveChain = m.u32((curUnit + 0x10) >>> 0)
    pUnit = m.u32((curUnit + 0x0c) >>> 0)
    if (pSaveChain !== 0) {
      const pSaveData = m.u32((pSaveChain + 0x04) >>> 0)
      if (pSaveData !== 0) {
        freeFn?.call(m, pSaveData)
      }
      freeFn?.call(m, pSaveChain)
    }
    freeFn?.call(m, curUnit)
  }
  if (pDrlgFile !== 0) {
    freeFn?.call(m, pDrlgFile >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD5AA80` (`DRLGPRESET_BuildRoomTombCoords113c`, not exported;
 * stdcall `(pRoomEx)`, `ret 4`).
 *
 * - Reads `pPresetRoom = pRoomEx->pTypeData (+0x20)`; if `pPresetRoom->pTombCoords (+0xF0) != 0`, returns immediately.
 * - Allocates `0x30` (`48`) bytes (`6` `D2CoordStrc` entries) at `pPresetRoom->pTombCoords (+0xF0)`.
 * - Scans `y = 0 .. pRoomEx->nTileHeight (+0x40) - 1`, `x = 0 .. pRoomEx->nTileWidth (+0x3C) - 1`
 *   in `pPresetRoom->pWallGrid0` (`pCells` at `+0x10`, `pRowOffsets` at `+0x14`):
 *   when `style == ((cell >>> 20) & 0x3F) == 10` and `0x17 <= ((cell >>> 8) & 0xFF) <= 0x1B` and `count < 6`,
 *   writes `subX = (pRoomEx->nTileXPos (+0x34) + x) * 5 + 2` and `subY = (pRoomEx->nTileYPos (+0x38) + y) * 5 + 2`
 *   into `pTombCoords[count++]`.
 * - Stores `count` at `pPresetRoom->nTombCoords (+0xF4)`.
 */
export function DRLGPRESET_BuildRoomTombCoords113c(m: Memory113c, pRoomEx: number): void {
  const pPresetRoom = m.u32((pRoomEx + 0x20) >>> 0)
  if (m.u32((pPresetRoom + 0xf0) >>> 0) !== 0) {
    return
  }
  const pBuf = m.alloc(0x30)
  m.setU32((pPresetRoom + 0xf0) >>> 0, pBuf)
  let count = 0
  const h0 = m.u32((pRoomEx + 0x40) >>> 0) | 0
  if (h0 > 0) {
    for (let y = 0; ; ) {
      const w0 = m.u32((pRoomEx + 0x3c) >>> 0) | 0
      if (w0 > 0) {
        for (let x = 0; ; ) {
          const pRowOffsets = m.u32((pPresetRoom + 0x14) >>> 0)
          const rowOff = m.u32((pRowOffsets + y * 4) >>> 0) | 0
          const pCells = m.u32((pPresetRoom + 0x10) >>> 0)
          const cell = m.u32((pCells + (((rowOff + x) | 0) << 2)) >>> 0)
          const style = (cell >>> 20) & 0x3f
          const seq = (cell >>> 8) & 0xff
          if (style === 10 && seq >= 0x17 && seq <= 0x1b && count < 6) {
            const subY = (Math.imul(((m.u32((pRoomEx + 0x38) >>> 0) | 0) + y) | 0, 5) + 2) | 0
            const pCoordsX = m.u32((pPresetRoom + 0xf0) >>> 0)
            const subX = (Math.imul(((m.u32((pRoomEx + 0x34) >>> 0) | 0) + x) | 0, 5) + 2) | 0
            m.setU32((pCoordsX + count * 8) >>> 0, subX >>> 0)
            const pCoordsY = m.u32((pPresetRoom + 0xf0) >>> 0)
            m.setU32((pCoordsY + count * 8 + 4) >>> 0, subY >>> 0)
            count = (count + 1) | 0
          }
          const curW = m.u32((pRoomEx + 0x3c) >>> 0) | 0
          x = (x + 1) | 0
          if (x >= curW) break
        }
      }
      const curH = m.u32((pRoomEx + 0x40) >>> 0) | 0
      y = (y + 1) | 0
      if (y >= curH) break
    }
  }
  m.setU32((pPresetRoom + 0xf4) >>> 0, count >>> 0)
}

/**
 * `@va D2Common:0x6FD5BC60` (`DRLGPRESET_AllocDrlgMap113c`, not exported;
 * custom LTCG `ebx = pSeed`, stack `[esp+4] = pLevel`, `[esp+8] = nLvlPrestId`, `[esp+0xC] = pBox`, `ret 0xC`).
 *
 * Allocates and zero-initializes a `0x58`-byte `D2DrlgMapStrc`, looks up `D2LvlPrestTxt` record `nLvlPrestId`
 * via `sgptDataTables` (`0x6FDE9E1C` `+0xC68` count, `0x6FDF0B3C` base, stride `0x1B0`), rolls `nPickedFile`
 * against `pPrest->dwFiles (+0x40)` using `pSeed`, initializes coordinates/dimensions from `pPrest` or `pBox`,
 * sets `bInited (+0x3C) = 1`, prepends to `pLevel->pPresetMaps (+0x1B0)`, and returns `pMap`.
 */
export function DRLGPRESET_AllocDrlgMap113c(
  m: Memory113c,
  pSeed: number,
  pLevel: number,
  nLvlPrestId: number,
  pBox: number,
): number {
  const pDrlg = m.u32((pLevel + 0x1b4) >>> 0)
  void m.u32((pDrlg + 0x478) >>> 0)
  const pMap = m.alloc(0x58)
  m.fill(pMap, 0x58, 0)

  let pPrest = 0
  const prestId = nLvlPrestId | 0
  if (prestId >= 0) {
    const pDataTables = m.u32(SGPT_DATA_TABLES_PTR_VA_6FDE9E1C)
    const dwRecs = m.u32((pDataTables + 0xc68) >>> 0) | 0
    if (prestId < dwRecs) {
      const pBase = m.u32(SGPT_LVLPREST_TXT_VA_6FDF0B3C)
      pPrest = (pBase + Math.imul(prestId, 0x1b0)) >>> 0
    }
  }
  m.setU32((pMap + 0x08) >>> 0, pPrest)
  m.setU32(pMap, prestId >>> 0)

  const nFiles = m.u32((pPrest + 0x40) >>> 0) | 0
  let pickedFile = 0
  if (nFiles > 0) {
    const hi0 = m.u32((pSeed + 4) >>> 0) >>> 0
    const lo0 = m.u32(pSeed >>> 0) >>> 0
    const prod = BigInt(lo0) * 0x6ac690c5n + BigInt(hi0)
    const newLo = Number(prod & 0xffffffffn) >>> 0
    const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
    m.setU32((pSeed + 4) >>> 0, newHi)
    m.setU32(pSeed >>> 0, newLo)
    if ((nFiles & (nFiles - 1)) !== 0) {
      pickedFile = ((newLo >>> 0) % (nFiles >>> 0)) | 0
    } else {
      pickedFile = (newLo & (nFiles - 1)) | 0
    }
  }
  m.setU32((pMap + 0x04) >>> 0, pickedFile >>> 0)
  m.setU32((pMap + 0x10) >>> 0, m.u32(pBox >>> 0))
  const boxY = m.u32((pBox + 0x04) >>> 0)
  const pPrestCur = m.u32((pMap + 0x08) >>> 0)
  m.setU32((pMap + 0x14) >>> 0, boxY)

  const sizeX = m.u32((pPrestCur + 0x28) >>> 0)
  if (sizeX !== 0 && m.u32((pPrestCur + 0x2c) >>> 0) !== 0) {
    m.setU32((pMap + 0x18) >>> 0, sizeX)
    m.setU32((pMap + 0x1c) >>> 0, m.u32((pPrestCur + 0x2c) >>> 0))
  } else {
    m.setU32((pMap + 0x18) >>> 0, m.u32((pBox + 0x08) >>> 0))
    m.setU32((pMap + 0x1c) >>> 0, m.u32((pBox + 0x0c) >>> 0))
  }

  m.setU32((pMap + 0x3c) >>> 0, 1)
  m.setU32((pMap + 0x54) >>> 0, m.u32((pLevel + 0x1b0) >>> 0))
  m.setU32((pLevel + 0x1b0) >>> 0, pMap)
  return pMap >>> 0
}

export type StatEnumCallbackFn113c = (
  m: Memory113c,
  pUnit: number,
  nStatId: number,
  nValue: number,
  pArg: number,
) => void

/**
 * `@va D2Common:0x6FD88850` (`D2Common.#10984` `STATLIST_EnumerateCopyListStats113c`,
 * `__stdcall(pUnit, pArg, pfCallback)`, `ret 0xC`).
 *
 * Enumerates the `wCopyListCount` (`pStatListEx + 0x54`) packed stat keys in `pStatListEx->pCopyListKeys (+0x50)`
 * when `pUnit != 0`, `!(pArg == 0 && pfCallback != 0)`, `pStatListEx != 0`, `(pStatListEx->dwFlags & 0x80000000) != 0`,
 * and `wCopyListCount > 0`. For each key, looks up the stat in `&pStatListEx->FullStats (+0x24)` via `0x6FD882B0`
 * (`STATLIST_FindStatIndex113c`) and invokes `pfCallback(ecx=pUnit, edx=nStatId, nValue, pArg)` (passing `nValue = 0`
 * and `nStatId = (dwKey >> 16) & 0xFFFF` if absent).
 */
export function STATLIST_EnumerateCopyListStats113c(
  m: Memory113c,
  pUnit: number,
  pArg: number,
  pfCallback: number,
  customCallback?: StatEnumCallbackFn113c,
): void {
  if (pUnit === 0) return
  if (pArg === 0 && pfCallback !== 0) return

  const unit = pUnit >>> 0
  const pStatListEx = m.u32((unit + 0x5c) >>> 0)
  if (pStatListEx === 0) return
  if ((m.u32((pStatListEx + 0x10) >>> 0) | 0) >= 0) return
  if (((m.u16((pStatListEx + 0x54) >>> 0) << 16) >> 16) <= 0) return

  const pFullStats = (pStatListEx + 0x24) >>> 0
  let i = 0
  do {
    const pKeyArray = m.u32((pStatListEx + 0x50) >>> 0)
    const dwPackedKey = m.u32((pKeyArray + i * 4) >>> 0) | 0
    const idx = STATLIST_FindStatIndex113c(m, pFullStats, dwPackedKey)

    let nStatId: number
    let nValue: number
    const pStat = idx >= 0 ? (m.u32(pFullStats) + idx * 8) >>> 0 : 0
    if (idx >= 0 && pStat !== 0) {
      nValue = m.u32((pStat + 0x04) >>> 0) | 0
      nStatId = m.u16((pStat + 0x02) >>> 0)
    } else {
      nValue = 0
      nStatId = (dwPackedKey >> 16) & 0xffff
    }

    if (customCallback !== undefined) {
      customCallback(m, unit, nStatId, nValue, pArg)
    } else if (pfCallback !== 0 && pArg !== 0) {
      const arg = pArg >>> 0
      const nCalls = m.u32(arg)
      const base = (arg + 0x04 + nCalls * 12) >>> 0
      m.setU32(base, unit)
      m.setU32((base + 0x04) >>> 0, nStatId >>> 0)
      m.setU32((base + 0x08) >>> 0, nValue >>> 0)
      m.setU32(arg, (nCalls + 1) >>> 0)
    }

    i = (i + 1) | 0
  } while (i < ((m.u16((pStatListEx + 0x54) >>> 0) << 16) >> 16))
}

/**
 * `D2Common.dll` `.bss` `gpCachedPresetFileListHead` (`D2PresetFileCacheNodeStrc*`).
 *
 * `@va D2Common:0x6FDF147C`
 */
export const GP_CACHED_PRESET_FILE_LIST_HEAD_VA_6FDF147C = 0x6fdf147c

/**
 * `@va D2Common:0x6FD59900` (`DRLGPRESET_LoadFileFromArchive113c`, not exported;
 * custom LTCG `eax = szFileName`, stack `[esp+4] = pMemPool`, `[esp+8] = pdwSize`, `ret 8`).
 *
 * Opens `szFileName` via `Fog.#10102` (`FOG_MPQOpenFile(ecx=szFileName, edx=&hFile)`),
 * queries file size via `DRLGPRESET_GetFileSize113c(hFile, &dwSizeHigh)` (`0x6FD59700`),
 * allocates `dwSize + 0x320` (`dwSize + 800`) bytes via `Fog.#10042`, reads `dwSize` bytes
 * via `DRLGPRESET_ReadFileData113c(hFile, dwSize, pBuf)` (`0x6FD59610`), asserts `hFile != 0`
 * (`line 73`, `0x49`), closes `hFile` via `Fog.#10103`, writes `*pdwSize = dwSize` when `pdwSize != 0`,
 * and returns `pBuf`.
 */
export function DRLGPRESET_LoadFileFromArchive113c(
  m: Memory113c,
  szFileName: number,
  _pMemPool: number,
  pdwSize: number,
): number {
  const fileNamePtr = szFileName >>> 0
  if (fileNamePtr === 0) {
    return 0
  }
  const g = globalThis as unknown as {
    __d2LoadMpqDs1?: (m: Memory113c, relPath: string) => Uint8Array | null
  }
  const hook = g.__d2LoadMpqDs1
  if (typeof hook === 'function') {
    let relPath = ''
    for (let p = fileNamePtr; ; p = (p + 1) >>> 0) {
      const ch = m.u8(p)
      if (ch === 0) break
      relPath += String.fromCharCode(ch)
    }
    const bytes = hook(m, relPath)
    if (bytes !== null && bytes !== undefined) {
      const dwSize = bytes.byteLength >>> 0
      const allocSize = ((dwSize | 0) + 0x320) >>> 0
      if (allocSize === 0) {
        return 0
      }
      const pBuf = m.alloc(allocSize)
      if (pBuf === 0) {
        return 0
      }
      m.fill(pBuf, allocSize, 0)
      for (let i = 0; i < dwSize; i++) {
        m.setU8((pBuf + i) >>> 0, bytes[i]!)
      }
      if (pdwSize !== 0) {
        m.setU32(pdwSize >>> 0, dwSize)
      }
      return pBuf >>> 0
    }
  }
  const hFile = m.u32((fileNamePtr + 0x10) >>> 0)
  if (hFile === 0) {
    return 0
  }
  const dwSize = DRLGPRESET_GetFileSize113c(m, hFile, 0)
  const allocSize = ((dwSize | 0) + 0x320) >>> 0
  if (allocSize === 0) {
    return 0
  }
  const pBuf = m.alloc(allocSize)
  if (pBuf === 0) {
    return 0
  }
  DRLGPRESET_ReadFileData113c(m, hFile, dwSize, pBuf)
  if (pdwSize !== 0) {
    m.setU32(pdwSize >>> 0, dwSize >>> 0)
  }
  return pBuf >>> 0
}

/**
 * `@va D2Common:0x6FD59EA0` (`DRLGPRESET_CopyMapPresetUnitNode113c`, not exported;
 * custom LTCG `eax = pSrcNode`, `ebx = nOffsetY`, stack `[esp+4] = pMemPool`, `[esp+8] = nOffsetX`, `ret 8`).
 *
 * Allocates and zeroes a `0x20`-byte `D2PresetUnitStrc` via `Fog.#10045`, copies fields from `pSrcNode`
 * translating `nXPos (+0x08) += nOffsetX` and `nYPos (+0x18) += nOffsetY`, and when `pSrcNode->pSaveHdr (+0x10) != 0`,
 * clones it via `DRLGPRESET_CloneSaveHeaderBlock113c` (`0x6FD59DE0`) and offsets each 12-byte entry's
 * `(+0x04, +0x08)` coordinates by `(nOffsetX, nOffsetY)`.
 */
export function DRLGPRESET_CopyMapPresetUnitNode113c(
  m: Memory113c,
  pSrcNode: number,
  nOffsetY: number,
  pMemPool: number,
  nOffsetX: number,
): number {
  const src = pSrcNode >>> 0
  const offX = nOffsetX | 0
  const offY = nOffsetY | 0
  const pNew = m.alloc(0x20)
  m.fill(pNew, 0x20, 0)

  m.setU32((pNew + 0x14) >>> 0, m.u32((src + 0x14) >>> 0))
  m.setU32((pNew + 0x04) >>> 0, m.u32((src + 0x04) >>> 0))
  m.setU32(pNew, m.u32(src))
  m.setU32((pNew + 0x08) >>> 0, ((m.u32((src + 0x08) >>> 0) | 0) + offX) >>> 0)
  m.setU32((pNew + 0x18) >>> 0, ((m.u32((src + 0x18) >>> 0) | 0) + offY) >>> 0)
  m.setU32((pNew + 0x1c) >>> 0, m.u32((src + 0x1c) >>> 0))

  const pSrcSaveHdr = m.u32((src + 0x10) >>> 0)
  if (pSrcSaveHdr !== 0) {
    const pCloned = DRLGPRESET_CloneSaveHeaderBlock113c(m, pMemPool, pSrcSaveHdr) >>> 0
    m.setU32((pNew + 0x10) >>> 0, pCloned)
    const count0 = m.u32(pCloned) >>> 0
    if (count0 > 0) {
      let idx = 0
      let byteOff = 0
      do {
        const pHdr1 = m.u32((pNew + 0x10) >>> 0)
        const pArr1 = m.u32((pHdr1 + 0x04) >>> 0)
        const pX = (pArr1 + byteOff + 0x04) >>> 0
        m.setU32(pX, ((m.u32(pX) | 0) + offX) >>> 0)

        const pHdr2 = m.u32((pNew + 0x10) >>> 0)
        const pArr2 = m.u32((pHdr2 + 0x04) >>> 0)
        const pY = (pArr2 + byteOff + 0x08) >>> 0
        m.setU32(pY, ((m.u32(pY) | 0) + offY) >>> 0)

        const pHdr3 = m.u32((pNew + 0x10) >>> 0)
        const curCount = m.u32(pHdr3) >>> 0
        idx = (idx + 1) >>> 0
        byteOff = (byteOff + 0x0c) >>> 0
        if (idx >= curCount) {
          break
        }
      } while (true)
    }
  }
  return pNew >>> 0
}

/**
 * `@va D2Common:0x6FD5A5B0` (`DRLGPRESET_ReleaseCachedPresetFile113c`, not exported;
 * `__stdcall(ppFileData)`, `ret 4`).
 *
 * Searches `gpCachedPresetFileListHead` (`0x6FDF147C`) for the cache node whose `pDrlgFile (+0x108)`
 * matches `*ppFileData`, decrements `nRefCount (+0x104)`, and when `nRefCount <= 0`, unlinks the node,
 * frees `*ppFileData` via `DRLGPRESET_FreeDrlgFile113c` (`0x6FD59FA0`), frees the cache node via `Fog.#10046`,
 * and zeroes `*ppFileData`.
 */
export function DRLGPRESET_ReleaseCachedPresetFile113c(
  m: Memory113c,
  ppFileData: number,
): void {
  const ppFile = ppFileData >>> 0
  const pTarget = m.u32(ppFile)
  if (pTarget === 0) {
    return
  }

  let pCurr = m.u32(GP_CACHED_PRESET_FILE_LIST_HEAD_VA_6FDF147C)
  let pPrev = 0
  while (pCurr !== 0) {
    if (m.u32((pCurr + 0x108) >>> 0) === pTarget) {
      break
    }
    pPrev = pCurr
    pCurr = m.u32((pCurr + 0x10c) >>> 0)
  }

  const nextRef = ((m.u32((pCurr + 0x104) >>> 0) | 0) - 1) | 0
  m.setU32((pCurr + 0x104) >>> 0, nextRef >>> 0)
  if (pCurr === 0 || nextRef > 0) {
    return
  }

  const pNext = m.u32((pCurr + 0x10c) >>> 0)
  if (pPrev !== 0) {
    m.setU32((pPrev + 0x10c) >>> 0, pNext)
  } else {
    m.setU32(GP_CACHED_PRESET_FILE_LIST_HEAD_VA_6FDF147C, pNext)
  }

  DRLGPRESET_FreeDrlgFile113c(m, m.u32(ppFile))
  const freeFn = (m as { free?: (p: number) => void }).free
  freeFn?.call(m, pCurr)
  m.setU32(ppFile, 0)
}

/**
 * `@va D2Common:0x6FD5AEC0` (`DRLGPRESET_FreePresetRoomData113c`, not exported;
 * custom LTCG `esi = pRoomEx`, plain `ret`).
 *
 * Reads `pMemPool = pRoomEx->pLevel (+0x58)->pDrlg (+0x1B4)->pMemPool (+0x478)` and `pPreset = pRoomEx->pTypeData (+0x20)`.
 * When `pPreset != 0`, calls `DRLGPRESET_FreePresetRoomGrids113c(pRoomEx, pMemPool)` (`0x6FD5A440`), frees non-NULL
 * `pPreset->pMazeData (+0xF0)` and `pPreset` via `Fog.#10046`, and zeroes `pRoomEx->pTypeData (+0x20)`.
 */
export function DRLGPRESET_FreePresetRoomData113c(
  m: Memory113c,
  pRoomEx: number,
): void {
  const roomEx = pRoomEx >>> 0
  const pLevel = m.u32((roomEx + 0x58) >>> 0)
  const pDrlg = m.u32((pLevel + 0x1b4) >>> 0)
  const pMemPool = m.u32((pDrlg + 0x478) >>> 0)
  const pPreset = m.u32((roomEx + 0x20) >>> 0)
  if (pPreset !== 0) {
    DRLGPRESET_FreePresetRoomGrids113c(m, roomEx, pMemPool)
    const freeFn = (m as { free?: (p: number) => void }).free
    const pMazeData = m.u32((pPreset + 0xf0) >>> 0)
    if (pMazeData !== 0) {
      freeFn?.call(m, pMazeData)
    }
    freeFn?.call(m, pPreset)
    m.setU32((roomEx + 0x20) >>> 0, 0)
  }
}

/**
 * `@va D2Common:0x6FD5BD60` (`DRLGPRESET_BuildFortressAndMapAIPaths113c`, not exported;
 * custom LTCG `eax = pDrlgMap`, `[esp+4] = pMemPool`, `ret 4`).
 */
export function DRLGPRESET_BuildFortressAndMapAIPaths113c(
  m: Memory113c,
  pDrlgMap: number,
  pMemPool: number,
): void {
  const map = pDrlgMap >>> 0
  const memPool = pMemPool >>> 0
  const nWidth = m.u32((map + 0x18) >>> 0) | 0
  const nHeight = m.u32((map + 0x1c) >>> 0) | 0
  const nRowStride = (nWidth + 1) | 0
  const pFile = m.u32((map + 0x0c) >>> 0)
  const pBaseCells = m.u32((pFile + 0x3c) >>> 0)

  const sm = withPresetStackScratch113c(m)
  const pWindowBox = PRESET_STACK_BASE
  const pOutGrid = (PRESET_STACK_BASE + 0x20) >>> 0
  const pRowOffsetsBuf = (PRESET_STACK_BASE + 0x40) >>> 0

  sm.setU32(pWindowBox, 0)
  sm.setU32((pWindowBox + 0x04) >>> 0, 0)
  sm.setU32((pWindowBox + 0x08) >>> 0, nWidth >>> 0)
  sm.setU32((pWindowBox + 0x0c) >>> 0, nHeight >>> 0)
  sm.fill(pOutGrid, 0x14, 0)

  DRLGGRID_InitializeGridWindow113c(sm, pOutGrid, pWindowBox, nRowStride, pBaseCells, pRowOffsetsBuf)

  const pLvlPrestTxt = m.u32((map + 0x08) >>> 0)
  const nPosX = m.u32((map + 0x10) >>> 0) | 0
  const nPosY = m.u32((map + 0x14) >>> 0) | 0
  sm.setU32(pWindowBox, nPosX >>> 0)
  sm.setU32((pWindowBox + 0x04) >>> 0, nPosY >>> 0)

  if (m.u32(pLvlPrestTxt) === 0x1b) {
    DRLGPRESET_SpawnFortressWall2Presets113c(sm, nPosX, nPosY, map, memPool)
    DRLGPRESET_SpawnMapAIPathPresets113c(sm, map, memPool, -1, pOutGrid)
    return
  }

  let x = 0
  while (x < (sm.u32((pWindowBox + 0x08) >>> 0) | 0)) {
    const rowOff0 = sm.u32(sm.u32((pOutGrid + 0x04) >>> 0)) | 0
    const pCells = sm.u32(pOutGrid)
    const cell = sm.u32((pCells + (((rowOff0 + x) | 0) << 2)) >>> 0)
    const style = (cell >>> 20) & 0x3f
    const seq = (cell >>> 8) & 0xff
    if (style === 2 && seq === 0x18) {
      DRLGPRESET_SpawnFortressWall2Presets113c(sm, (x + nPosX + 1) | 0, nPosY, map, memPool)
      DRLGPRESET_SpawnMapAIPathPresets113c(sm, map, memPool, x, pOutGrid)
      x = (x + 4) | 0
    }
    x = (x + 1) | 0
  }
}

const TABLE_6FDDBCC0: readonly number[] = [
  0, 1, 2, 1, 2, 3, 3, 5, 5, 6, 6, 7, 7, 8, 9, 10,
]

const TABLE_6FDEE2C8: readonly number[] = [
  12, 37, 39, 35, 36, 5, 17, 18, 19, 20, 21, 22, 30, 70, 70,
  69, 69, 29, 31, 33, 34, 37, 61, 65, 66, 8, 26, 28, 82, 2,
  81, 84, 83, 78, 61, 103, 108, 119, 580, 130, 159, 163, 169, 160, 161,
  162, 104, 105, 106, 107, 179, 180, 119, 157, 247, 248, 155, 174, 175, 139,
  140, 141, 144, 6, 240, 241, 242, 54, 55, 56, 57, 58, 171, 178, 239,
  245, 250, 111, 138, 132, 164, 165, 77, 85, 86, 262, 263, 264, 265, 50,
  51, 79, 53, 1, 3, 7, 46, 38, 256, 257, 258, 129, 267, 268, 269,
  581, 351, 352, 353, 374, 385, 397, 321, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  74, 37, 192, 304, 305, 306, 101, 102, 78, 103, 156, 580, 132, 129, 357,
  153, 121, 122, 229, 230, 196, 267, 261, 149, 269, 4, 9, 52, 94, 95,
  142, 143, 5, 6, 87, 88, 146, 146, 147, 148, 240, 241, 242, 243, 176,
  177, 198, 246, 29, 160, 161, 162, 273, 283, 85, 86, 109, 116, 134, 135,
  136, 150, 151, 172, 173, 279, 280, 281, 282, 166, 167, 113, 137, 89, 104,
  105, 106, 107, 154, 171, 178, 270, 271, 272, 266, 274, 244, 284, 288, 298,
  289, 296, 297, 287, 286, 285, 290, 291, 292, 293, 294, 295, 133, 303, 299,
  300, 301, 302, 581, 354, 582, 314, 315, 316, 317, 323, 322, 110, 112, 114,
  355, 356, 357, 351, 352, 353, 152, 374, 387, 389, 390, 391, 388, 397, 402,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  117, 237, 580, 130, 102, 37, 160, 161, 162, 104, 105, 106, 107, 194, 195,
  193, 207, 211, 210, 234, 214, 215, 213, 228, 216, 227, 217, 235, 218, 219,
  220, 221, 223, 224, 267, 269, 581, 170, 325, 184, 190, 191, 197, 199, 200,
  201, 202, 206, 278, 120, 130, 326, 158, 271, 272, 327, 328, 329, 330, 331,
  332, 333, 334, 335, 336, 5, 6, 176, 240, 241, 181, 183, 246, 185, 186,
  187, 188, 203, 204, 205, 208, 209, 169, 323, 324, 196, 212, 225, 244, 351,
  352, 353, 360, 361, 362, 365, 251, 252, 208, 283, 367, 366, 368, 341, 342,
  343, 344, 374, 370, 378, 379, 386, 397, 405, 407, 406, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  238, 580, 267, 269, 581, 573, 573, 573, 345, 346, 347, 348, 349, 350, 351,
  352, 353, 358, 359, 363, 259, 373, 372, 374, 236, 249, 226, 231, 232, 93,
  97, 123, 124, 96, 225, 233, 222, 125, 126, 127, 128, 375, 376, 254, 253,
  342, 255, 392, 393, 394, 395, 396, 398, 397, 399, 401, 400, 380, 383, 384,
  296, 297, 403, 102, 408, 409, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  452, 453, 338, 337, 267, 374, 482, 39, 35, 36, 33, 34, 38, 102, 411,
  438, 412, 435, 436, 440, 441, 441, 442, 429, 420, 431, 430, 413, 432, 433,
  418, 419, 424, 425, 416, 414, 415, 427, 428, 421, 422, 423, 426, 451, 267,
  443, 444, 445, 446, 447, 448, 450, 451, 459, 460, 461, 462, 482, 473, 455,
  456, 457, 458, 463, 464, 465, 466, 467, 468, 469, 470, 471, 472, 477, 479,
  480, 481, 483, 484, 485, 486, 487, 454, 437, 508, 488, 493, 493, 495, 497,
  499, 503, 509, 512, 489, 490, 514, 515, 493, 498, 513, 494, 496, 511, 500,
  501, 502, 504, 505, 506, 507, 510, 160, 161, 162, 269, 523, 434, 496, 496,
  496, 527, 528, 538, 539, 542, 543, 546, 547, 548, 549, 550, 551, 552, 555,
  553, 554, 557, 541, 544, 559, 560, 564, 567, 568, 536, 537, 563, 570, 397,
]

const SGPT_DATA_TABLES_VA_6FDE9E1C = 0x6fde9e1c
const SGPT_ITEMS_CODE_LINK_VA_6FDEFF6C = 0x6fdeff6c
const G_SUPERUNIQUES_COUNT_VA_6FDF09B4 = 0x6fdf09b4
const SGPT_OBJECTS_TXT_PTR_VA_6FDF0B94 = 0x6fdf0b94
const SGPT_OBJECTS_TXT_CNT_VA_6FDF0B98 = 0x6fdf0b98
const G_PRESET_OBJ_REMAP_FLAG_VA_6FDF0980 = 0x6fdf0980
const G_PRESET_OBJ_REMAP_TBLS_VA_6FDF0984 = 0x6fdf0984
const G_PRESET_OBJ_REMAP_CNTS_VA_6FDF0998 = 0x6fdf0998

/**
 * `@va D2Common:0x6FD5A8E0` (`DRLGPRESET_FreeDrlgMapList113c`, not exported;
 * custom LTCG `eax = pMemPool`, stack `[esp+4] = pDrlgMap`, `ret 4`).
 */
export function DRLGPRESET_FreeDrlgMapList113c(
  m: Memory113c,
  pMemPool: number,
  pDrlgMap: number,
): void {
  let cur = pDrlgMap >>> 0
  if (cur === 0) return
  const freeFn = (m as { free?: (p: number) => void }).free
  while (cur !== 0) {
    const pPopsAlloc = m.u32((cur + 0x28) >>> 0)
    const next = m.u32((cur + 0x54) >>> 0)
    if (pPopsAlloc !== 0) {
      freeFn?.call(m, pPopsAlloc)
    }
    m.u32((cur + 0x24) >>> 0)
    m.setU32((cur + 0x24) >>> 0, 0)
    m.setU32((cur + 0x28) >>> 0, 0)
    DRLGVER_FreeVertices113c(m, pMemPool >>> 0, (cur + 0x20) >>> 0)
    DRLGPRESET_ReleaseCachedPresetFile113c(m, (cur + 0x0c) >>> 0)
    let pUnit = m.u32((cur + 0x38) >>> 0)
    while (pUnit !== 0) {
      const curUnit = pUnit
      const pSaveHdr = m.u32((curUnit + 0x10) >>> 0)
      pUnit = m.u32((curUnit + 0x0c) >>> 0)
      if (pSaveHdr !== 0) {
        const pSaveData = m.u32((pSaveHdr + 0x04) >>> 0)
        freeFn?.call(m, pSaveData)
        freeFn?.call(m, pSaveHdr)
      }
      freeFn?.call(m, curUnit)
    }
    if (m.u32((cur + 0x44) >>> 0) !== 0) freeFn?.call(m, m.u32((cur + 0x44) >>> 0))
    if (m.u32((cur + 0x48) >>> 0) !== 0) freeFn?.call(m, m.u32((cur + 0x48) >>> 0))
    if (m.u32((cur + 0x4c) >>> 0) !== 0) freeFn?.call(m, m.u32((cur + 0x4c) >>> 0))
    if (m.u32((cur + 0x50) >>> 0) !== 0) freeFn?.call(m, m.u32((cur + 0x50) >>> 0))
    freeFn?.call(m, cur)
    cur = next
  }
}

function stepSeed64_113c(m: Memory113c, pSeed: number): number {
  const lo = BigInt(m.u32(pSeed >>> 0))
  const hi = BigInt(m.u32((pSeed + 4) >>> 0))
  const prod = lo * 0x6ac690c5n + hi
  const newLo = Number(prod & 0xffffffffn) >>> 0
  const newHi = Number((prod >> 32n) & 0xffffffffn) >>> 0
  m.setU32(pSeed >>> 0, newLo)
  m.setU32((pSeed + 4) >>> 0, newHi)
  return newLo
}

/**
 * `@va D2Common:0x6FD5B320` (`DRLGPRESET_SpawnPresetUnits113c`, not exported;
 * custom LTCG `esi = pSeed`, stack `[esp+4] = pMemPool`, `[esp+8] = pDrlgMap`, `ret 8`).
 */
export function DRLGPRESET_SpawnPresetUnits113c(
  m: Memory113c,
  pSeed: number,
  pMemPool: number,
  pDrlgMap: number,
): void {
  const map = pDrlgMap >>> 0
  const pFile = m.u32((map + 0x0c) >>> 0)
  const nOffX = imul32(m.u32((map + 0x10) >>> 0) | 0, 5)
  const nOffY = imul32(m.u32((map + 0x14) >>> 0) | 0, 5)
  let pUnit = m.u32((pFile + 0x54) >>> 0)
  while (pUnit !== 0) {
    const nUnitType = m.u32((pUnit + 0x14) >>> 0) | 0
    const nClassId = m.u32((pUnit + 0x04) >>> 0) | 0
    let spawn = true
    if (nUnitType === 1) {
      const pTables = m.u32(SGPT_DATA_TABLES_VA_6FDE9E1C)
      const nMonStats = m.u32((pTables + 0xa80) >>> 0) | 0
      if (nClassId < nMonStats) {
        const c = nClassId < 0 ? -1 : nClassId
        if (c === 0xcc || c === 0xcd || c === 0x173 || c === 0x174) {
          const lo = stepSeed64_113c(m, pSeed)
          if ((lo % 3) !== 0) spawn = false
        }
      } else {
        const rel = (nClassId - nMonStats) | 0
        const nSuper = m.u32(G_SUPERUNIQUES_COUNT_VA_6FDF09B4) | 0
        if (rel >= nSuper) {
          const sIdx = (rel - nSuper) | 0
          if (sIdx === 0x21 || sIdx === 0x23) {
            const lo = stepSeed64_113c(m, pSeed)
            if ((lo & 3) === 0) spawn = false
          } else if (sIdx === 0x22) {
            const lo = stepSeed64_113c(m, pSeed)
            if ((lo & 1) === 0) spawn = false
          }
        }
      }
    } else if (nUnitType === 2) {
      if (nClassId === 0xc4 || nClassId === 0x105 || nClassId === 0x245) {
        const lo = stepSeed64_113c(m, pSeed)
        if ((lo & 1) !== 0) spawn = false
      }
    }
    if (spawn) {
      const pNode = DRLGPRESET_CopyMapPresetUnitNode113c(m, pUnit, nOffY, pMemPool >>> 0, nOffX)
      m.setU32((pNode + 0x0c) >>> 0, m.u32((map + 0x38) >>> 0))
      m.setU32((map + 0x38) >>> 0, pNode)
    }
    pUnit = m.u32((pUnit + 0x0c) >>> 0)
  }
}

/**
 * `@va D2Common:0x6FD5B560` (`DRLGPRESET_ParseDS1File113c`, not exported;
 * custom LTCG `eax = pMemPool`, stack `[esp+4] = pDrlgFile`, `[esp+8] = szFileName`, `ret 8`).
 */
export function DRLGPRESET_ParseDS1File113c(
  m: Memory113c,
  pMemPool: number,
  pDrlgFile: number,
  szFileName: number,
): void {
  const file = pDrlgFile >>> 0
  let pCur = DRLGPRESET_LoadFileFromArchive113c(m, szFileName >>> 0, pMemPool >>> 0, 0) >>> 0
  m.setU32((file + 0x04) >>> 0, pCur)

  const nVersion = m.u32(pCur) | 0
  const nWidth = m.u32((pCur + 0x04) >>> 0) | 0
  const nHeight = m.u32((pCur + 0x08) >>> 0) | 0
  pCur = (pCur + 12) >>> 0
  m.setU32((file + 0x0c) >>> 0, nWidth >>> 0)
  m.setU32((file + 0x10) >>> 0, nHeight >>> 0)

  let nAct = 0
  if (nVersion >= 8) {
    nAct = m.u32(pCur) | 0
    pCur = (pCur + 4) >>> 0
    if (nAct > 4) nAct = 4
  }
  m.setU32(file, 0)
  if (nVersion >= 10) {
    m.setU32(file, m.u32(pCur))
    pCur = (pCur + 4) >>> 0
  }
  if (nVersion >= 3) {
    let nFiles = m.u32(pCur) | 0
    pCur = (pCur + 4) >>> 0
    while (nFiles > 0) {
      while (m.u8(pCur) !== 0) {
        pCur = (pCur + 1) >>> 0
      }
      pCur = (pCur + 1) >>> 0
      nFiles--
    }
  }

  const nCells = imul32((nWidth + 1) | 0, (nHeight + 1) | 0)
  if (nVersion >= 9 && nVersion < 14) {
    pCur = (pCur + 8) >>> 0
  }
  if (nVersion >= 4) {
    const nWalls = m.u32(pCur) | 0
    pCur = (pCur + 4) >>> 0
    m.setU32((file + 0x14) >>> 0, nWalls >>> 0)
    let nFloors = 1
    if (nVersion >= 16) {
      nFloors = m.u32(pCur) | 0
      pCur = (pCur + 4) >>> 0
    }
    m.setU32((file + 0x18) >>> 0, nFloors >>> 0)
    const layerBytes = (nCells << 2) >>> 0
    for (let i = 0; i < nWalls; i++) {
      m.setU32((file + 0x2c + i * 4) >>> 0, pCur)
      pCur = (pCur + layerBytes) >>> 0
      m.setU32((file + 0x1c + i * 4) >>> 0, pCur)
      pCur = (pCur + layerBytes) >>> 0
    }
    for (let i = 0; i < nFloors; i++) {
      m.setU32((file + 0x3c + i * 4) >>> 0, pCur)
      pCur = (pCur + layerBytes) >>> 0
    }
  } else {
    const layerBytes = (nCells << 2) >>> 0
    m.setU32((file + 0x2c) >>> 0, pCur)
    pCur = (pCur + layerBytes) >>> 0
    m.setU32((file + 0x3c) >>> 0, pCur)
    pCur = (pCur + layerBytes) >>> 0
    m.setU32((file + 0x1c) >>> 0, pCur)
    pCur = (pCur + layerBytes) >>> 0
    m.setU32((file + 0x48) >>> 0, pCur)
    m.setU32((file + 0x14) >>> 0, 1)
    pCur = (pCur + layerBytes) >>> 0
  }

  if (nVersion < 7) {
    const nWalls = m.u32((file + 0x14) >>> 0) | 0
    for (let i = 0; i < nWalls; i++) {
      let pWallProp = m.u32((file + 0x1c + i * 4) >>> 0)
      for (let k = 0; k < nCells; k++) {
        const idx = m.u32(pWallProp) | 0
        m.setU32(pWallProp, TABLE_6FDDBCC0[idx]! >>> 0)
        pWallProp = (pWallProp + 4) >>> 0
      }
    }
  }

  const nSubstMethod = m.u32(file) | 0
  const layerBytes = (nCells << 2) >>> 0
  m.setU32((file + 0x44) >>> 0, pCur)
  pCur = (pCur + layerBytes) >>> 0
  if (nSubstMethod > 0 && nSubstMethod <= 2) {
    m.setU32((file + 0x48) >>> 0, pCur)
    pCur = (pCur + layerBytes) >>> 0
  }

  if (nVersion > 1) {
    let nObjects = m.u32(pCur) | 0
    pCur = (pCur + 4) >>> 0
    while (nObjects > 0) {
      const nObjType = m.u32(pCur) | 0
      let nObjId = m.u32((pCur + 4) >>> 0) | 0
      pCur = (pCur + 8) >>> 0
      if (nObjType === 1) {
        if (nVersion > 4 && nAct >= 0 && nAct < 5 && m.u32(G_PRESET_OBJ_REMAP_FLAG_VA_6FDF0980) !== 0) {
          const pTbl = m.u32((G_PRESET_OBJ_REMAP_TBLS_VA_6FDF0984 + nAct * 4) >>> 0)
          const nCnt = m.u32((G_PRESET_OBJ_REMAP_CNTS_VA_6FDF0998 + nAct * 4) >>> 0) | 0
          if (pTbl !== 0 && nObjId < nCnt) {
            const rec = (pTbl + imul32(nObjId, 4)) >>> 0
            const mode = m.u8((rec + 1) >>> 0)
            const val = m.u16((rec + 2) >>> 0)
            if (mode === 0) {
              const pTables = m.u32(SGPT_DATA_TABLES_VA_6FDE9E1C)
              nObjId = (val + (m.u32((pTables + 0xa80) >>> 0) | 0) + (m.u32(G_SUPERUNIQUES_COUNT_VA_6FDF09B4) | 0)) | 0
            } else if (mode === 1) {
              nObjId = val | 0
            } else if (mode === 2) {
              const pTables = m.u32(SGPT_DATA_TABLES_VA_6FDE9E1C)
              nObjId = (val + (m.u32((pTables + 0xa80) >>> 0) | 0)) | 0
            } else {
              nObjId = -1
            }
          }
        }
        if (nAct === 2) {
          const pTables = m.u32(SGPT_DATA_TABLES_VA_6FDE9E1C)
          const nMon = m.u32((pTables + 0xa80) >>> 0) | 0
          if (nObjId < nMon) {
            const a = nMon > 0x129 ? 0x129 : -1
            const b = nMon > 0x16e ? 0x16e : -1
            if (nObjId === a) nObjId = 0x17e
            else if (nObjId === b) nObjId = 0x194
          }
        } else if (nAct === 4) {
          const pTables = m.u32(SGPT_DATA_TABLES_VA_6FDE9E1C)
          const nMon = m.u32((pTables + 0xa80) >>> 0) | 0
          if (nObjId >= 0 && nObjId < nMon) {
            if (nObjId === 0x202) nObjId = 0x1cd
            else if (nObjId > 0x218 && nObjId <= 0x21b) nObjId = (0x3f5 - nObjId) | 0
          }
        }
      } else if (nObjType === 2) {
        if (nVersion > 5) {
          if (nObjId < 0x96) {
            nObjId = TABLE_6FDEE2C8[imul32(nAct, 0x96) + nObjId]!
          } else {
            nObjId = (nObjId - 0x96) | 0
          }
        } else if (nObjId === 0x23d) {
          nObjId = -1
        }
      } else if (nObjType === 4) {
        if (nVersion > 4) {
          // 0x6FD5B759: copies up to 3 chars of preset item code (default 'HDM'), uppercases, pads ' ', fogGetLinkIndex113c
          const c0 = nObjId === 0 ? 0x48 : (nObjId & 0xff)
          const c1 = nObjId === 0 ? 0x44 : ((nObjId >>> 8) & 0xff)
          const c2 = nObjId === 0 ? 0x4d : ((nObjId >>> 16) & 0xff)
          const up = (ch: number): number => (ch >= 0x61 && ch <= 0x7a ? ch - 0x20 : ch)
          const b0 = c0 === 0 ? 0x20 : up(c0)
          const b1 = c0 === 0 || c1 === 0 ? 0x20 : up(c1)
          const b2 = c0 === 0 || c1 === 0 || c2 === 0 ? 0x20 : up(c2)
          const dwCode = ((b0 & 0xff) | ((b1 & 0xff) << 8) | ((b2 & 0xff) << 16) | (0x20 << 24)) >>> 0
          const pLink = m.u32(SGPT_ITEMS_CODE_LINK_VA_6FDEFF6C)
          const idx = pLink !== 0 ? fogGetLinkIndex113c(m, pLink, dwCode) : -1
          nObjId = idx < 0 ? 0 : idx
        }
      }

      const nX = m.u32(pCur) | 0
      const nY = m.u32((pCur + 4) >>> 0) | 0
      pCur = (pCur + 8) >>> 0
      let dwFlags = 0
      if (nVersion > 5) {
        dwFlags = m.u32(pCur) >>> 0
        pCur = (pCur + 4) >>> 0
      }
      if (nObjId >= 0 && (nObjType !== 1 || nVersion > 4)) {
        const pUnit = m.alloc(0x20)
        m.fill(pUnit, 0x20, 0)
        m.setU32((pUnit + 0x14) >>> 0, nObjType >>> 0)
        m.setU32((pUnit + 0x18) >>> 0, nY >>> 0)
        m.setU32((pUnit + 0x04) >>> 0, nObjId >>> 0)
        m.setU32(pUnit, 0)
        m.setU32((pUnit + 0x08) >>> 0, nX >>> 0)
        m.setU32((pUnit + 0x0c) >>> 0, m.u32((file + 0x54) >>> 0))
        m.setU32((file + 0x54) >>> 0, pUnit)
        m.setU32((pUnit + 0x1c) >>> 0, (m.u32((pUnit + 0x1c) >>> 0) | dwFlags) >>> 0)
      }
      nObjects--
    }
  }

  if (nVersion >= 12 && nSubstMethod > 0 && nSubstMethod <= 2) {
    if (nVersion >= 18) {
      pCur = (pCur + 4) >>> 0
    }
    const nGroups = m.u32(pCur) | 0
    pCur = (pCur + 4) >>> 0
    m.setU32((file + 0x4c) >>> 0, nGroups >>> 0)
    const pGroups = m.alloc(imul32(nGroups, 0x18))
    m.setU32((file + 0x50) >>> 0, pGroups)
    for (let i = 0; i < nGroups; i++) {
      const dst = (pGroups + imul32(i, 0x18)) >>> 0
      m.setU32(dst, m.u32(pCur))
      m.setU32((dst + 0x04) >>> 0, m.u32((pCur + 4) >>> 0))
      pCur = (pCur + 4) >>> 0
      m.setU32((dst + 0x08) >>> 0, m.u32((pCur + 4) >>> 0))
      pCur = (pCur + 8) >>> 0
      m.setU32((dst + 0x0c) >>> 0, m.u32(pCur))
      pCur = (pCur + 4) >>> 0
      if (nVersion >= 13) {
        m.setU32((dst + 0x14) >>> 0, m.u32(pCur))
        pCur = (pCur + 4) >>> 0
      }
    }
  }

  if (nVersion >= 14) {
    let nPaths = m.u32(pCur) | 0
    pCur = (pCur + 4) >>> 0
    while (nPaths > 0) {
      const nPts = m.u32(pCur) | 0
      const pX = m.u32((pCur + 4) >>> 0)
      const pY = m.u32((pCur + 8) >>> 0)
      pCur = (pCur + 12) >>> 0
      if (nPts !== 0) {
        let pUnit = m.u32((file + 0x54) >>> 0)
        while (pUnit !== 0) {
          if (m.u32((pUnit + 0x08) >>> 0) === pX && m.u32((pUnit + 0x18) >>> 0) === pY) {
            break
          }
          pUnit = m.u32((pUnit + 0x0c) >>> 0)
        }
        if (pUnit !== 0) {
          const pHdr = m.alloc(0x08)
          m.setU32((pUnit + 0x10) >>> 0, pHdr)
          const pPts = m.alloc(imul32(nPts, 0x0c))
          m.setU32((pHdr + 0x04) >>> 0, pPts)
          m.setU32(pHdr, nPts >>> 0)
          for (let j = 0; j < nPts; j++) {
            const ptDst = (pPts + imul32(j, 0x0c)) >>> 0
            m.setU32((ptDst + 0x04) >>> 0, m.u32(pCur))
            m.setU32((ptDst + 0x08) >>> 0, m.u32((pCur + 4) >>> 0))
            pCur = (pCur + 8) >>> 0
            if (nVersion >= 15) {
              m.setU32(ptDst, m.u32(pCur))
              pCur = (pCur + 4) >>> 0
            } else {
              m.setU32(ptDst, 1)
            }
          }
        } else {
          pCur = (pCur + imul32(nPts, nVersion >= 15 ? 12 : 8)) >>> 0
        }
      }
      nPaths--
    }
  }
}

/**
 * `@va D2Common:0x6FD5BBC0` (`DRLGPRESET_AllocLevelPresetInfo113c`, not exported;
 * custom LTCG `eax = pLevel`, plain `ret`).
 */
export function DRLGPRESET_AllocLevelPresetInfo113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0
  const pDrlg = m.get(lvl, D2DrlgLevelStrc.pDrlg)
  const nLevelId = m.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  const pInfo = m.alloc(0x08)
  const pPrest = DATATBLS_GetLvlPrestTxtRecordFromLevelId113c(m, nLevelId)
  if (pPrest === 0) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Preset.cpp', 0xb01)
  }
  m.set(lvl, D2DrlgLevelStrc.pOutdoors, pInfo)
  m.setU32(pInfo, 0)
  m.setU32((pInfo + 0x04) >>> 0, 0)
  const nFlags = m.u32((pPrest + 0x40) >>> 0) | 0
  if (nFlags !== 0) {
    const rolled = SEED_RollRandomNumberInline113c(m, (lvl + 0x1c4) >>> 0, nFlags >>> 0) >>> 0
    m.setU32((pInfo + 0x04) >>> 0, rolled >>> 0)
  } else {
    m.setU32((pInfo + 0x04) >>> 0, 0xffffffff)
  }
  DRLG_InitLevelCoordsFromLevelsTxt113c(m, lvl, pDrlg)
}

/**
 * `@va D2Common:0x6FD5BE50` (`DRLGPRESET_AcquireCachedPresetFile113c`, not exported;
 * custom LTCG `ebx = ppFileData`, `[esp+4] = szFileName`, `[esp+8] = pMemPool`, `ret 8`).
 */
export function DRLGPRESET_AcquireCachedPresetFile113c(
  m: Memory113c,
  ppFileData: number,
  szFileName: number,
  pMemPool = 0,
): void {
  const ppOut = ppFileData >>> 0
  const szName = szFileName >>> 0
  let pCurr = m.u32(GP_CACHED_PRESET_FILE_LIST_HEAD_VA_6FDF147C)
  while (pCurr !== 0) {
    let i = 0
    let match = true
    while (true) {
      const c1 = m.u8((pCurr + i) >>> 0)
      const c2 = m.u8((szName + i) >>> 0)
      if (c1 !== c2) {
        match = false
        break
      }
      if (c1 === 0) break
      i++
    }
    if (match) {
      m.setU32((pCurr + 0x104) >>> 0, ((m.u32((pCurr + 0x104) >>> 0) | 0) + 1) >>> 0)
      m.setU32(ppOut, m.u32((pCurr + 0x108) >>> 0))
      return
    }
    pCurr = m.u32((pCurr + 0x10c) >>> 0)
  }

  const pNode = m.alloc(0x110)
  const pFile = m.alloc(0x5c)
  m.setU32(ppOut, pFile)
  m.fill(pFile, 0x5c, 0)
  let j = 0
  while (true) {
    const ch = m.u8((szName + j) >>> 0)
    m.setU8((pNode + j) >>> 0, ch)
    if (ch === 0) break
    j++
  }
  const pOldHead = m.u32(GP_CACHED_PRESET_FILE_LIST_HEAD_VA_6FDF147C)
  m.setU32((pNode + 0x104) >>> 0, 1)
  m.setU32((pNode + 0x10c) >>> 0, pOldHead)
  m.setU32((pNode + 0x108) >>> 0, pFile)
  m.setU32(GP_CACHED_PRESET_FILE_LIST_HEAD_VA_6FDF147C, pNode)
  DRLGPRESET_ParseDS1File113c(m, pMemPool >>> 0, pFile, szName)
}

/**
 * `@va D2Common:0x6FD5BF70` (`DRLGPRESET_LoadPresetRoomMap113c`, not exported;
 * `__stdcall(pRoomEx)`, `ret 4`).
 */
export function DRLGPRESET_LoadPresetRoomMap113c(
  m: Memory113c,
  pRoomEx: number,
): void {
  const roomEx = pRoomEx >>> 0
  const pPreset = m.u32((roomEx + 0x20) >>> 0)
  const pLevel = m.get(roomEx, D2RoomExStrc.pLevel)
  const pMap = m.u32((pPreset + 0x08) >>> 0)
  const pDrlg = m.get(pLevel, D2DrlgLevelStrc.pDrlg)
  const pMemPool = m.get(pDrlg, D2DrlgStrc.pMemPool)
  if (m.u32((pMap + 0x0c) >>> 0) === 0) {
    const nFileIdx = m.u32((pMap + 0x04) >>> 0) | 0
    const pLvlPrest = m.u32((pMap + 0x08) >>> 0) | 0
    const bArchiveFlag = m.u32((pDrlg + 0x464) >>> 0)
    const szFile = (imul32(nFileIdx, 0x3c) + pLvlPrest + 0x44) >>> 0
    DRLGPRESET_AcquireCachedPresetFile113c(m, (pMap + 0x0c) >>> 0, szFile, bArchiveFlag)
    DRLGPRESET_SpawnPresetUnits113c(m, (roomEx + 0x14) >>> 0, pMemPool, pMap)
  }
  if (m.u32((pMap + 0x3c) >>> 0) === 1) {
    const nType = m.u32(pMap) | 0
    m.setU32((pMap + 0x3c) >>> 0, 0)
    let handled = false
    if (nType > 7) {
      if (nType >= 0x1a && (nType <= 0x1c || nType === 0x12c)) {
        if ((m.get(roomEx, D2RoomExStrc.dwFlags) & 0x40000) !== 0) {
          DRLGPRESET_BuildFortressAndMapAIPaths113c(m, pMap, pMemPool)
        }
        handled = true
      }
    } else if (nType >= 4) {
      if ((m.get(pLevel, D2DrlgLevelStrc.nLevelId) | 0) === 2 && (m.u32((pMap + 0x04) >>> 0) | 0) === 3) {
        DRLGPRESET_SpawnHoradricOrifice113c(m, pMap, pMemPool)
        m.set(roomEx, D2RoomExStrc.dwFlags, (m.get(roomEx, D2RoomExStrc.dwFlags) | 0x2000000) >>> 0)
        return
      }
      handled = true
    } else if (nType === 1 || nType === 3) {
      if ((m.get(roomEx, D2RoomExStrc.dwFlags) & 0x40000) !== 0) {
        DRLGPRESET_BuildFortressAndMapAIPaths113c(m, pMap, pMemPool)
      }
      handled = true
    }
    void handled
  }
  m.set(roomEx, D2RoomExStrc.dwFlags, (m.get(roomEx, D2RoomExStrc.dwFlags) | 0x2000000) >>> 0)
}

/**
 * `@va D2Common:0x6FD5C060` (`DRLGPRESET_ProcessPresetMap113c`, not exported;
 * `__stdcall(pLevel, pGrid, nFlags, pDrlgMap, bSingleRoom)`, `ret 0x14`).
 */
export function DRLGPRESET_ProcessPresetMap113c(
  m: Memory113c,
  pLevel: number,
  pGrid: number,
  nFlags: number,
  pDrlgMap: number,
  bSingleRoom: number,
): void {
  const lvl = pLevel >>> 0
  const grid = pGrid >>> 0
  const map = pDrlgMap >>> 0
  let flags = nFlags >>> 0
  const pDrlg = m.get(lvl, D2DrlgLevelStrc.pDrlg)
  const pMemPool = m.get(pDrlg, D2DrlgStrc.pMemPool)
  const nLevelId = m.get(lvl, D2DrlgLevelStrc.nLevelId) | 0

  const pDstAdj = DRLGWARP_GetWarpDstAdjustData113c(m, pDrlg, nLevelId)
  let bit = 0x10
  for (let i = 0; i < 8; i++) {
    if (m.u32((pDstAdj + i * 4) >>> 0) !== 0) {
      const pWarpLvls = DRLGROOMTILE_GetWarpLevelsArray113c(m, pDrlg, nLevelId)
      if ((m.u32((pWarpLvls + i * 4) >>> 0) | 0) === -1) {
        flags = (flags | bit) >>> 0
      }
    }
    bit = (bit << 1) >>> 0
  }
  DRLGGRID_ApplyAllCellFlags113c(m, grid, flags, 0)

  const pLvlPrest = m.u32((map + 0x08) >>> 0)
  const bScan = m.u32((pLvlPrest + 0x34) >>> 0) | 0
  const nPops = m.u32((pLvlPrest + 0x38) >>> 0) | 0
  let nFoundPops = 0
  if (bScan === 0 && nPops === 0) {
    return
  }

  const nFileIdx = m.u32((map + 0x04) >>> 0) | 0
  const bArchiveFlag = m.u32((pDrlg + 0x464) >>> 0)
  const szFile = (imul32(nFileIdx, 0x3c) + pLvlPrest + 0x44) >>> 0
  DRLGPRESET_AcquireCachedPresetFile113c(m, (map + 0x0c) >>> 0, szFile, bArchiveFlag)
  DRLGPRESET_SpawnPresetUnits113c(m, (lvl + 0x1c4) >>> 0, pMemPool, map)

  const pFile = m.u32((map + 0x0c) >>> 0)
  if ((m.u32((pFile + 0x0c) >>> 0) | 0) !== (m.u32((map + 0x18) >>> 0) | 0)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Preset.cpp', 0x8bf)
  }
  if ((m.u32((pFile + 0x10) >>> 0) | 0) !== (m.u32((map + 0x1c) >>> 0) | 0)) {
    throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Preset.cpp', 0x8c0)
  }

  if (nPops !== 0) {
    const sz4 = (nPops << 2) >>> 0
    const pIdx = m.alloc(sz4)
    const pSub = m.alloc(sz4)
    const pFlg = m.alloc(sz4)
    const pLoc = m.alloc((nPops << 4) >>> 0)
    m.fill(pIdx, sz4, 0)
    m.fill(pSub, sz4, 0)
    m.fill(pFlg, sz4, 0)
    m.fill(pLoc, (nPops << 4) >>> 0, 0)
    m.setU32((map + 0x44) >>> 0, pIdx)
    m.setU32((map + 0x48) >>> 0, pSub)
    m.setU32((map + 0x4c) >>> 0, pFlg)
    m.setU32((map + 0x50) >>> 0, pLoc)
  }

  const sm = withPresetStackScratch113c(m)
  const pRowOffProp = (PRESET_STACK_BASE + 0x1800) >>> 0
  const pRowOffTile = (PRESET_STACK_BASE + 0x2000) >>> 0

  const fw = m.u32((pFile + 0x0c) >>> 0) | 0
  const fh = m.u32((pFile + 0x10) >>> 0) | 0
  const stride = (fw + 1) | 0
  const hPlus1 = (fh + 1) | 0
  const nWalls = m.u32((pFile + 0x14) >>> 0) | 0

  for (let layer = 0; layer < nWalls; layer++) {
    const pWallProp = m.u32((pFile + 0x1c + layer * 4) >>> 0)
    const pWallTile = m.u32((pFile + 0x2c + layer * 4) >>> 0)
    for (let r = 0, acc = 0; r < hPlus1; r++, acc = (acc + stride) | 0) {
      sm.setU32((pRowOffProp + r * 4) >>> 0, acc >>> 0)
      sm.setU32((pRowOffTile + r * 4) >>> 0, acc >>> 0)
    }
    for (let y = 0; y < fh; y++) {
      const rOffP = sm.u32((pRowOffProp + y * 4) >>> 0) | 0
      const rOffT = sm.u32((pRowOffTile + y * 4) >>> 0) | 0
      for (let x = 0; x < fw; x++) {
        const prop = m.u32((pWallProp + ((rOffP + x) << 2)) >>> 0) | 0
        const tile = m.u32((pWallTile + ((rOffT + x) << 2)) >>> 0) >>> 0
        const style = (tile >>> 20) & 0x3f
        const seq = (tile >>> 8) & 0xff
        const negBit = tile & 0x80000000

        if (prop === 10 || prop === 11) {
          if (bScan !== 0 && style >= 0 && style <= 7 && (seq === 0 || seq === 4 || negBit !== 0)) {
            const gx = (bSingleRoom | 0) !== 0 ? 0 : sdiv32(x, 8)
            const gy = (bSingleRoom | 0) !== 0 ? 0 : sdiv32(y, 8)
            const pRowArr = m.u32((grid + 0x04) >>> 0)
            const cellIdx = ((m.u32((pRowArr + gy * 4) >>> 0) | 0) + gx) | 0
            const pCell = (m.u32(grid) + (cellIdx << 2)) >>> 0
            DRLGGRID_OpOr113c(m, pCell, (1 << (style + 4)) >>> 0)
          }
          if (nPops !== 0 && style >= 8 && style <= 0x1d) {
            const pIdxArr = m.u32((map + 0x44) >>> 0)
            const pLocArr = m.u32((map + 0x50) >>> 0)
            let k = 0
            while (k < nFoundPops) {
              if ((m.u32((pIdxArr + k * 4) >>> 0) | 0) === style) {
                m.setU32((pLocArr + (k << 4) + 0x08) >>> 0, x >>> 0)
                m.setU32((pLocArr + (k << 4) + 0x0c) >>> 0, y >>> 0)
                break
              }
              k++
            }
            if (k === nFoundPops) {
              m.setU32((pIdxArr + nFoundPops * 4) >>> 0, style >>> 0)
              m.setU32((m.u32((map + 0x48) >>> 0) + nFoundPops * 4) >>> 0, seq >>> 0)
              m.setU32((pLocArr + (nFoundPops << 4)) >>> 0, x >>> 0)
              m.setU32((pLocArr + (nFoundPops << 4) + 0x04) >>> 0, y >>> 0)
              nFoundPops++
            }
          }
          if (bScan !== 0 && style >= 0x1e && style <= 0x21) {
            const nWarps = m.u32((lvl + 0x1d8) >>> 0) | 0
            const base = (lvl + 0x2c + imul32(nWarps, 12)) >>> 0
            m.setU32(base, ((m.u32((map + 0x10) >>> 0) | 0) + x) >>> 0)
            m.setU32((base + 0x04) >>> 0, ((m.u32((map + 0x14) >>> 0) | 0) + y) >>> 0)
            const sw = (style - 0x1e) | 0
            if (sw === 0) m.setU32((base + 0x08) >>> 0, seq >>> 0)
            else if (sw === 1) m.setU32((base + 0x08) >>> 0, (seq + 5) >>> 0)
            else if (sw === 2) m.setU32((base + 0x08) >>> 0, 0x0a)
            else if (sw === 3) m.setU32((base + 0x08) >>> 0, 0x0b)
            else if (sw === 4) m.setU32((base + 0x08) >>> 0, 0x0c)
            m.setU32((lvl + 0x1d8) >>> 0, (nWarps + 1) >>> 0)
          }
        }
      }
    }
  }

  if (nPops !== 0) {
    DRLGPRESET_FinalizePopsLocations113c(m, map, nFoundPops)
  }

  if (bScan !== 0) {
    let pUnit = m.u32((pFile + 0x54) >>> 0)
    while (pUnit !== 0) {
      if ((m.u32((pUnit + 0x14) >>> 0) | 0) === 2) {
        const nObjId = m.u32((pUnit + 0x04) >>> 0) | 0
        if (nObjId < 0x23d) {
          const nCnt = m.u32(SGPT_OBJECTS_TXT_CNT_VA_6FDF0B98) | 0
          if (nObjId >= nCnt) {
            throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Preset.cpp', 0xdd)
          }
          if (nObjId < 0) {
            throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\Preset.cpp', 0xde)
          }
          const pObjTxt = m.u32(SGPT_OBJECTS_TXT_PTR_VA_6FDF0B94)
          if ((m.u8((pObjTxt + imul32(nObjId, 0x1c0) + 0x167) >>> 0) & 0x40) !== 0) {
            let gx = 0
            let gy = 0
            if ((bSingleRoom | 0) === 0) {
              const ux = sdiv32(m.u32((pUnit + 0x08) >>> 0) | 0, 5)
              const uy = sdiv32(m.u32((pUnit + 0x18) >>> 0) | 0, 5)
              gx = sdiv32(ux, 8)
              gy = sdiv32(uy, 8)
            }
            const pRowArr = m.u32((grid + 0x04) >>> 0)
            const cellIdx = ((m.u32((pRowArr + gy * 4) >>> 0) | 0) + gx) | 0
            const pCell = (m.u32(grid) + (cellIdx << 2)) >>> 0
            DRLGGRID_OpOr113c(m, pCell, 0x30000)
          }
        }
      }
      pUnit = m.u32((pUnit + 0x0c) >>> 0)
    }
  }
}

/**
 * `@va D2Common:0x6FD5C690` (`DRLGPRESET_BuildPresetRoomsFromMap113c`, not exported;
 * `__stdcall(pLevel, pDrlgMap, nFlags, bSingleRoom)`, `ret 0x10`).
 */
export function DRLGPRESET_BuildPresetRoomsFromMap113c(
  m: Memory113c,
  pLevel: number,
  pDrlgMap: number,
  nFlags: number,
  bSingleRoom: number,
): number {
  const lvl = pLevel >>> 0
  const map = pDrlgMap >>> 0
  let flags = nFlags >>> 0
  const wSub = (sdiv32(m.u32((map + 0x18) >>> 0) | 0, 8) + 1) | 0
  const hSub = (sdiv32(m.u32((map + 0x1c) >>> 0) | 0, 8) + 1) | 0
  const pLvlPrest = m.u32((map + 0x08) >>> 0)
  if (m.u32((pLvlPrest + 0x10) >>> 0) !== 0) {
    flags = (flags | 0x80000) >>> 0
  }

  const sm = withPresetStackScratch113c(m)
  const pGrid = PRESET_STACK_BASE
  const pRowOff = (PRESET_STACK_BASE + 0x40) >>> 0
  const pCells = (PRESET_STACK_BASE + 0x440) >>> 0
  const pBox = (PRESET_STACK_BASE + 0x20) >>> 0
  sm.fill(pCells, (imul32(wSub, hSub) << 2) >>> 0, 0)
  for (let r = 0, acc = 0; r < hSub; r++, acc = (acc + wSub) | 0) {
    sm.setU32((pRowOff + r * 4) >>> 0, acc >>> 0)
  }
  sm.setU32(pGrid, pCells)
  sm.setU32((pGrid + 0x04) >>> 0, pRowOff)
  sm.setU32((pGrid + 0x08) >>> 0, wSub >>> 0)
  sm.setU32((pGrid + 0x0c) >>> 0, hSub >>> 0)
  sm.setU32((pGrid + 0x10) >>> 0, 0)

  DRLGPRESET_ProcessPresetMap113c(sm, lvl, pGrid, flags, map, bSingleRoom)

  const dwDT1Mask = m.u32((pLvlPrest + 0x1ac) >>> 0) >>> 0
  let pLastRoom = 0
  if ((bSingleRoom | 0) !== 0) {
    const cell0 = sm.u32((pCells + (sm.u32(pRowOff) << 2)) >>> 0) >>> 0
    const pRoomEx = DRLGROOM_AllocRoomEx113c(sm, lvl, 2) >>> 0
    sm.setU32((pRoomEx + 0x50) >>> 0, dwDT1Mask)
    sm.setU32((pRoomEx + 0x28) >>> 0, (sm.u32((pRoomEx + 0x28) >>> 0) | cell0) >>> 0)
    sm.setU32((pRoomEx + 0x34) >>> 0, sm.u32((map + 0x10) >>> 0))
    sm.setU32((pRoomEx + 0x38) >>> 0, sm.u32((map + 0x14) >>> 0))
    sm.setU32((pRoomEx + 0x3c) >>> 0, sm.u32((map + 0x18) >>> 0))
    sm.setU32((pRoomEx + 0x40) >>> 0, sm.u32((map + 0x1c) >>> 0))
    const pPreset = sm.u32((pRoomEx + 0x20) >>> 0)
    sm.setU32((pPreset + 0x08) >>> 0, map)
    sm.setU32(pPreset, sm.u32(pLvlPrest))
    sm.setU32((pPreset + 0x0c) >>> 0, 1)
    sm.setU32((pPreset + 0xec) >>> 0, 0)
    if (sm.u32((pLvlPrest + 0x08) >>> 0) === 0) {
      sm.setU32((pRoomEx + 0x28) >>> 0, (sm.u32((pRoomEx + 0x28) >>> 0) | 0x800000) >>> 0)
    }
    sm.setU32((pRoomEx + 0x24) >>> 0, sm.u32((lvl + 0x10) >>> 0))
    sm.setU32((lvl + 0x10) >>> 0, pRoomEx)
    sm.setU32((lvl + 0x08) >>> 0, ((sm.u32((lvl + 0x08) >>> 0) | 0) + 1) >>> 0)
    return pRoomEx >>> 0
  }

  const mapX0 = sm.u32((map + 0x10) >>> 0) | 0
  const mapY0 = sm.u32((map + 0x14) >>> 0) | 0
  const mapW = sm.u32((map + 0x18) >>> 0) | 0
  const mapH = sm.u32((map + 0x1c) >>> 0) | 0
  const xEnd = (mapX0 + mapW) | 0
  const yEnd = (mapY0 + mapH) | 0
  for (let y = mapY0, gy = 0; y < yEnd; y = (y + 8) | 0, gy++) {
    const remY = (yEnd - y) | 0
    const rh = remY < 8 ? remY : 8
    const rowBase = sm.u32((pRowOff + gy * 4) >>> 0) | 0
    for (let x = mapX0, gx = 0; x < xEnd; x = (x + 8) | 0, gx++) {
      const remX = (xEnd - x) | 0
      const rw = remX < 8 ? remX : 8
      const rFlags = sm.u32((pCells + ((rowBase + gx) << 2)) >>> 0) >>> 0
      let mazeGrid = 0
      if (sm.u32((map + 0x20) >>> 0) !== 0) {
        const pRows = sm.u32((map + 0x28) >>> 0)
        const pData = sm.u32((map + 0x24) >>> 0)
        mazeGrid = sm.u32((pData + (((sm.u32((pRows + gy * 4) >>> 0) | 0) + gx) << 2)) >>> 0) >>> 0
      }
      if (rw !== 0 && rh !== 0) {
        sm.setU32(pBox, x >>> 0)
        sm.setU32((pBox + 0x04) >>> 0, y >>> 0)
        sm.setU32((pBox + 0x08) >>> 0, rw >>> 0)
        sm.setU32((pBox + 0x0c) >>> 0, rh >>> 0)
        pLastRoom = DRLGPRESET_InitPresetRoomEx113c(sm, lvl, pBox, mazeGrid, map, dwDT1Mask, rFlags, 0) >>> 0
      }
    }
  }
  return pLastRoom >>> 0
}

/**
 * `@va D2Common:0x6FD5CD10` (`DRLGPRESET_InitLevelPresetRooms113c`, not exported;
 * `__fastcall(pLevel)`, plain `ret`). `indirectUnknown: true` -> `status: "ported"`.
 */
export function DRLGPRESET_InitLevelPresetRooms113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0
  const nLevelId = m.get(lvl, D2DrlgLevelStrc.nLevelId) | 0
  const pInfo = m.get(lvl, D2DrlgLevelStrc.pOutdoors)
  const pPrest = DATATBLS_GetLvlPrestTxtRecordFromLevelId113c(m, nLevelId)
  const nDef = m.u32(pPrest) | 0
  const pMap = DRLGPRESET_AllocDrlgMap113c(m, (lvl + 0x1c4) >>> 0, lvl, nDef, (lvl + 0x1c) >>> 0) >>> 0
  const nFileIdx = m.u32((pInfo + 0x04) >>> 0) | 0
  m.setU32(pInfo, pMap)
  if (nFileIdx === -1) {
    m.setU32((pInfo + 0x04) >>> 0, m.u32((pMap + 0x04) >>> 0))
  } else {
    m.setU32((pMap + 0x04) >>> 0, nFileIdx >>> 0)
  }
  DRLGPRESET_BuildPresetRoomsFromMap113c(m, lvl, m.u32(pInfo), 0, 0)

  if (nLevelId === 0x28 || nLevelId === 0x67 || nLevelId === 0x6d) {
    const pDrlg = m.get(lvl, D2DrlgLevelStrc.pDrlg)
    const pfnErr = m.get(pDrlg, D2DrlgStrc.pfnErrorCallback)
    if (pfnErr !== 0 && m.u32((m.u32((pMap + 0x08) >>> 0) + 0x30) >>> 0) !== 0) {
      void pfnErr
    }
    return
  }

  const pDrlg = m.get(lvl, D2DrlgLevelStrc.pDrlg)
  if (m.get(pDrlg, D2DrlgStrc.pfnAutomapInit) === 0) return
  if (m.u32((m.u32((pMap + 0x08) >>> 0) + 0x30) >>> 0) === 0) return

  const pDstAdj = DRLGWARP_GetWarpDstAdjustData113c(m, pDrlg, nLevelId)
  for (let i = 0; i < 8; i++) {
    const targetLvl = m.u32((pDstAdj + i * 4) >>> 0) | 0
    if (targetLvl !== 0) {
      const pTarget = DRLG_GetLevel113c(m, pDrlg, targetLvl)
      if (pTarget !== 0 && m.get(pTarget, D2DrlgLevelStrc.pFirstRoomEx) === 0) {
        DRLG_InitLevelRooms113c(m, pTarget)
      }
    }
  }

  let pRoomEx = m.get(lvl, D2DrlgLevelStrc.pFirstRoomEx)
  while (pRoomEx !== 0) {
    const flags = m.get(pRoomEx, D2RoomExStrc.dwFlags)
    if ((flags & 0x1000000) === 0) {
      DRLGROOM_LoadDt1Files113c(m, pRoomEx)
    }
    if ((m.get(pRoomEx, D2RoomExStrc.dwFlags) & 0x2000000) === 0 && (m.u32((pRoomEx + 0x48) >>> 0) | 0) === 2) {
      DRLGPRESET_LoadPresetRoomMap113c(m, pRoomEx)
    }
    if ((m.get(pRoomEx, D2RoomExStrc.dwFlags) & 0x100000) === 0) {
      DRLGROOM_BuildRoomGridsAndTiles113c(m, pRoomEx, m.get(pDrlg, D2DrlgStrc.pMemPool))
    }
    pRoomEx = m.u32((pRoomEx + 0x24) >>> 0)
  }
}
