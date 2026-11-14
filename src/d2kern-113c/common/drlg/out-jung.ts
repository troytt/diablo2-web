/**
 * Diablo II v1.13c `D2Common.dll` unit component choice helper (`0x6FDD4C30`) and Act II/III/IV preset placement helpers
 * (`0x6FDD58E0`, `0x6FDD5930`, `0x6FDD5990`, `0x6FDD5FD0`, `0x6FDD6000`), image base `0x6FD50000`.
 */
import type { Memory113c } from '../../mem/sparse-memory.ts';
import { seedNext, type D2SeedStrc } from '../../prng.ts';
import {
  D2CommonAssertError,
  DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c,
  SEED_RollRandomNumberInline113c,
} from '../inline-helpers.ts';
import { imul32, sdiv32, smod32 } from '../int-math.ts';
import { DRLGOUTDOORS_SpawnPresetInGrid113c } from './drlg-grid.ts';
import {
  DRLGOUTPLACE_ApplyOutdoorVerticesToGrids113c,
  DRLGROOM_SpawnOutdoorBorderPresets113c,
} from './drlg-room.ts';
import {
  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c,
  DRLGOUTDOORS_SpawnOutdoorRoomEx113c,
  DRLGOUTDOORS_SpawnRandomOutdoorThemes113c,
  SGPT_DATA_TABLES_PTR_VA_6FDE9E1C,
  SG_LVL_PREST_TXT_PTR_VA_6FDF0B3C,
  DRLGOUTDOORS_BuildOutdoorSubstContext113c,
  DRLGOUTDOORS_PlaceRandomOutdoorShrineOrSpecial113c,
} from './outdoors.ts';

export const OUTJUNG_STACK_BASE = 0x7ff68000;
export const OUTJUNG_STACK_SIZE = 0x100;
const _outJungStackBuf = new ArrayBuffer(OUTJUNG_STACK_SIZE);
const _outJungStackU8 = new Uint8Array(_outJungStackBuf);
const _outJungStackDV = new DataView(_outJungStackBuf);

function withOutJungStackScratch113c(m: Memory113c): Memory113c {
  const isStack = (p: number): boolean => {
    const u = p >>> 0;
    return u >= OUTJUNG_STACK_BASE && u < OUTJUNG_STACK_BASE + OUTJUNG_STACK_SIZE;
  };
  const self: Memory113c = {
    alloc: size => m.alloc(size),
    u8: p => (isStack(p) ? _outJungStackU8[(p >>> 0) - OUTJUNG_STACK_BASE]! : m.u8(p)),
    u16: p => (isStack(p) ? _outJungStackDV.getUint16((p >>> 0) - OUTJUNG_STACK_BASE, true) : m.u16(p)),
    u32: p => (isStack(p) ? _outJungStackDV.getUint32((p >>> 0) - OUTJUNG_STACK_BASE, true) : m.u32(p)),
    setU8: (p, v) => {
      if (isStack(p)) _outJungStackU8[(p >>> 0) - OUTJUNG_STACK_BASE] = v & 0xff;
      else m.setU8(p, v);
    },
    setU16: (p, v) => {
      if (isStack(p)) _outJungStackDV.setUint16((p >>> 0) - OUTJUNG_STACK_BASE, v & 0xffff, true);
      else m.setU16(p, v);
    },
    setU32: (p, v) => {
      if (isStack(p)) _outJungStackDV.setUint32((p >>> 0) - OUTJUNG_STACK_BASE, v >>> 0, true);
      else m.setU32(p, v);
    },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      const addr = ((base >>> 0) + f.off + idx * width) >>> 0;
      return width === 1 ? self.u8(addr) : width === 2 ? self.u16(addr) : self.u32(addr);
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      const addr = ((base >>> 0) + f.off + idx * width) >>> 0;
      if (width === 1) self.setU8(addr, v);
      else if (width === 2) self.setU16(addr, v);
      else self.setU32(addr, v);
    },
    fill: (p, len, v) => {
      if (isStack(p)) {
        const off = (p >>> 0) - OUTJUNG_STACK_BASE;
        _outJungStackU8.fill(v & 0xff, off, off + len);
      } else {
        m.fill(p, len, v);
      }
    },
  };
  return self;
}

function writeStackInt32List113c(
  sm: Memory113c,
  base: number,
  vals: readonly number[],
): number {
  for (let i = 0; i < vals.length; i++) {
    sm.setU32((base + i * 4) >>> 0, vals[i]! >>> 0);
  }
  return base >>> 0;
}

/** `.rdata` Act 4 outdoor preset base IDs A (`0x6FDE57AC`, levels `104..106`). */
export const ACT4_PRESET_BASE_A_6FDE57AC = Int32Array.from([828, 832, 832]);

/** `.rdata` Act 4 outdoor preset base IDs B (`0x6FDE57B8`, levels `104..106`). */
export const ACT4_PRESET_BASE_B_6FDE57B8 = Int32Array.from([812, 817, 823]);

/**
 * `@va D2Common:0x6FDD4C30` (`D2Common.#10035` `UNITS_GetMonStats2ComponentChoice113c`,
 * `__stdcall(pUnit, nComponent) -> uint8`, `ret 8`).
 *
 * Returns `pMonStats2Txt->nComponentChoice[nComponent]` (`+0x15 + nComponent`) for a valid
 * monster unit (`pUnit != 0 && pUnit->dwUnitType == 1`) and `nComponent < 16`, or `0` otherwise.
 */
export function UNITS_GetMonStats2ComponentChoice113c(
  m: Memory113c,
  pUnit: number,
  nComponent: number,
): number {
  const unit = pUnit >>> 0;
  if (unit === 0 || (m.u32(unit) | 0) !== 1) {
    return 0;
  }
  const comp = nComponent >>> 0;
  if (comp >= 0x10) {
    return 0;
  }
  const pMonStats2Txt = DATATBLS_GetMonStats2TxtRecordFromMonStatsIdInline113c(
    m,
    m.u32((unit + 0x04) >>> 0) | 0,
  );
  if (pMonStats2Txt === 0) {
    return 0;
  }
  return m.u8((pMonStats2Txt + comp + 0x15) >>> 0);
}

/** `.rdata` 9×4 table at `0x6FDE5B68..0x6FDE5BF7` (`[nLvlPrestId, nPickedFile, worldX, worldY]`). */
export const CANYON_OF_MAGI_BORDER_PRESETS_6FDE5B68 = Int32Array.from([
  384, 0, 8, 0,
  383, 2, 6, 0,
  383, 1, 4, 0,
  383, 0, 2, 0,
  387, 0, 0, 0,
  385, 0, 0, 2,
  385, 1, 0, 4,
  385, 2, 0, 6,
  386, 0, 0, 8,
]);

/** `.rdata` 8×5×4 table at `0x6FDE5BF8..0x6FDE5E77` (`[nLvlPrestId, nPickedFile, worldX, worldY]`). */
export const KURAST_CAUSEWAY_PRESETS_6FDE5BF8 = Int32Array.from([
  376, 1, 0, 4, 378, -1, 2, 4, 377, -1, 4, 4, 377, -1, 6, 4, 376, 2, 8, 4,
  376, 1, 0, 4, 377, -1, 2, 4, 378, -1, 4, 4, 377, -1, 6, 4, 376, 2, 8, 4,
  376, 1, 0, 4, 377, -1, 2, 4, 377, -1, 4, 4, 378, -1, 6, 4, 376, 2, 8, 4,
  376, 2, 8, 4, 377, -1, 6, 4, 382, -1, 4, 4, 381, -1, 4, 6, 379, 2, 4, 8,
  376, 2, 8, 4, 378, -1, 6, 4, 382, -1, 4, 4, 380, -1, 4, 6, 379, 2, 4, 8,
  379, 1, 4, 0, 381, -1, 4, 2, 380, -1, 4, 4, 380, -1, 4, 6, 379, 2, 4, 8,
  379, 1, 4, 0, 380, -1, 4, 2, 381, -1, 4, 4, 380, -1, 4, 6, 379, 2, 4, 8,
  379, 1, 4, 0, 380, -1, 4, 2, 380, -1, 4, 4, 381, -1, 4, 6, 379, 2, 4, 8,
]);

/** `.rdata` 5×5 table at `0x6FDE5748..0x6FDE57AB` (`nLvlPrestId` for Travincal 5×5 grid). */
export const TRAVINCAL_PRESET_TABLE_6FDE5748 = Int32Array.from([
  836, 836, 836, 836, 836,
  836, 836, 861, 836, 836,
  836, 858, 862, 859, 836,
  836, 836, 860, 836, 836,
  836, 836, 857, 836, 836,
]);

/**
 * `@va D2Common:0x6FDD58E0` (`DRLGOUTJUNG_SpawnLowerKurastPresets113c`, custom `edi = pLevel`, `ret`).
 *
 * Places the 9 Lower Kurast border presets from `0x6FDE5B68..0x6FDE5BF7` plus the center preset `0x18A` (`394`) at `(4, 4)`.
 */
export function DRLGOUTJUNG_SpawnLowerKurastPresets113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  for (let i = 0; i < 9; i++) {
    const base = i * 4;
    const nLvlPrestId = CANYON_OF_MAGI_BORDER_PRESETS_6FDE5B68[base]! | 0;
    const nPickedFile = CANYON_OF_MAGI_BORDER_PRESETS_6FDE5B68[base + 1]! | 0;
    const worldX = CANYON_OF_MAGI_BORDER_PRESETS_6FDE5B68[base + 2]! | 0;
    const worldY = CANYON_OF_MAGI_BORDER_PRESETS_6FDE5B68[base + 3]! | 0;
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, worldX, worldY, nLvlPrestId, nPickedFile, 0);
  }
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 4, 4, 0x18a, -1, 0);
}

/**
 * `@va D2Common:0x6FDD5930` (`DRLGOUTJUNG_SpawnKurastCausewayPresets113c`, custom `edi = pLevel`, `ret`).
 *
 * Advances `pLevel->sSeed` (`+0x1C4..+0x1C8`), selects `variant = sSeed.lo & 7`, and places the 5 presets
 * from `0x6FDE5BF8 + variant * 0x50`.
 */
export function DRLGOUTJUNG_SpawnKurastCausewayPresets113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  const seed: D2SeedStrc = {
    lo: m.u32((lvl + 0x1c4) >>> 0),
    hi: m.u32((lvl + 0x1c8) >>> 0),
  };
  seedNext(seed);
  m.setU32((lvl + 0x1c4) >>> 0, seed.lo);
  m.setU32((lvl + 0x1c8) >>> 0, seed.hi);
  const variant = seed.lo & 7;
  const rowBase = variant * 20;
  for (let i = 0; i < 5; i++) {
    const base = rowBase + i * 4;
    const nLvlPrestId = KURAST_CAUSEWAY_PRESETS_6FDE5BF8[base]! | 0;
    const nPickedFile = KURAST_CAUSEWAY_PRESETS_6FDE5BF8[base + 1]! | 0;
    const worldX = KURAST_CAUSEWAY_PRESETS_6FDE5BF8[base + 2]! | 0;
    const worldY = KURAST_CAUSEWAY_PRESETS_6FDE5BF8[base + 3]! | 0;
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, worldX, worldY, nLvlPrestId, nPickedFile, 0);
  }
}

/**
 * `@va D2Common:0x6FDD5990` (`DRLGOUTJUNG_SpawnAct2LutGholeinBorderPreset113c`, `__fastcall(ecx = pLevel)`, `ret`).
 *
 * Walks `pLevel->pOutdoors->pLevelLink` (`+0x264`, next at `+0x14`) looking for the link node whose target level
 * (`*(u32*)pNode`) has `nLevelId (+0x1D0) == 0x28` (`40`). When found, places preset `0x16B` (`363`) at `(0, nGridHeight - 1)`
 * if `pNode->nDirection (+0x04) == 3`, else preset `0x16A` (`362`) at `(nGridWidth - 1, 0)`.
 */
export function DRLGOUTJUNG_SpawnAct2LutGholeinBorderPreset113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  const pOutdoors = m.u32((lvl + 0x14) >>> 0);
  let pNode = m.u32((pOutdoors + 0x264) >>> 0);
  if (pNode === 0) {
    return;
  }
  while ((m.u32((m.u32(pNode) + 0x1d0) >>> 0) | 0) !== 0x28) {
    pNode = m.u32((pNode + 0x14) >>> 0);
    if (pNode === 0) {
      return;
    }
  }
  if ((m.u32((pNode + 0x04) >>> 0) | 0) === 3) {
    const worldY = ((m.u32((pOutdoors + 0x60) >>> 0) | 0) - 1) | 0;
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, worldY, 0x16b, -1, 0);
    return;
  }
  const worldX = ((m.u32((pOutdoors + 0x5c) >>> 0) | 0) - 1) | 0;
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, worldX, 0, 0x16a, -1, 0);
}

/**
 * `@va D2Common:0x6FDD5FD0` (`DRLGOUTJUNG_SpawnPandemoniumFortressPresets113c`, custom `edi = pLevel`, `ret`).
 *
 * Places the 25 Pandemonium Fortress 3×3 grid presets from `0x6FDE5748..0x6FDE57AB` at `((i % 5) * 3, Math.trunc(i / 5) * 3)`.
 */
export function DRLGOUTJUNG_SpawnPandemoniumFortressPresets113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  for (let i = 0; i < 25; i++) {
    const worldY = Math.trunc(i / 5) * 3;
    const worldX = (i % 5) * 3;
    const nLvlPrestId = TRAVINCAL_PRESET_TABLE_6FDE5748[i]! | 0;
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, worldX, worldY, nLvlPrestId, -1, 0);
  }
}

/**
 * `@va D2Common:0x6FDD6000` (`DRLGOUTJUNG_SpawnOuterSteppesTransitions113c`, custom `esi = pLevel`, `ret`).
 *
 * Checks `pLevel->pOutdoors->dwFlags (+0x00)`: if bit `0x400000` is set, places preset `0x31E` (`798`) at `(0, 1)`;
 * if bit `0x800000` is set, places preset `0x31E` (`798`) at `(0, 4)`.
 */
export function DRLGOUTJUNG_SpawnOuterSteppesTransitions113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  const pOutdoors = m.u32((lvl + 0x14) >>> 0);
  if ((m.u32(pOutdoors) & 0x400000) !== 0) {
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, 1, 0x31e, -1, 0);
  }
  if ((m.u32(pOutdoors) & 0x800000) !== 0) {
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, 4, 0x31e, -1, 0);
  }
}

const SPIDER_FOREST_PREST_BY_LEVEL_6FDD5A64 = Int32Array.from([
  0x184, 0x184, 0x186, 0x19c, 0x185,
]);

/**
 * `@va D2Common:0x6FDD59F0` (`DRLGOUTJUNG_SpawnSpiderForestSpecialPreset113c`, not exported;
 * custom LTCG `eax = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_SpawnSpiderForestSpecialPreset113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  const nLevelId = m.u32((lvl + 0x1d0) >>> 0) | 0;
  const caseIdx = (nLevelId - 41) >>> 0;
  if (caseIdx <= 4) {
    const nLvlPrestId = SPIDER_FOREST_PREST_BY_LEVEL_6FDD5A64[caseIdx]!;
    if (DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, nLvlPrestId, -1, 0, 0x0f) !== 0) {
      return;
    }
  }
  throw new D2CommonAssertError('..\\Source\\D2Common\\DRLG\\OutJung.cpp', 170);
}

/**
 * `@va D2Common:0x6FDD5A80` (`DRLGOUTJUNG_PlaceShuffledPresetList113c`, not exported;
 * custom LTCG `eax = pLevel`, `[esp+4] = pPresetIds`, `[esp+8] = nCount`, `[esp+0xC] = bAllFiles`, `ret 0xC`).
 */
export function DRLGOUTJUNG_PlaceShuffledPresetList113c(
  m: Memory113c,
  pLevel: number,
  pPresetIds: number,
  nCount: number,
  bAllFiles: number,
): void {
  const lvl = pLevel >>> 0;
  const presetIds = pPresetIds >>> 0;
  const count = nCount | 0;
  const allFiles = bAllFiles | 0;

  let curIdx = SEED_RollRandomNumberInline113c(m, (lvl + 0x1c4) >>> 0, count);
  if (count <= 0) {
    return;
  }

  for (let rem = count; rem > 0; rem--) {
    const prestId = m.u32((presetIds + curIdx * 4) >>> 0) | 0;
    if (allFiles !== 0) {
      let pLvlPrestTxt = 0;
      if (prestId >= 0) {
        const sgptDataTables = m.u32(SGPT_DATA_TABLES_PTR_VA_6FDE9E1C);
        if (prestId < (m.u32((sgptDataTables + 0xc68) >>> 0) | 0)) {
          pLvlPrestTxt = (m.u32(SG_LVL_PREST_TXT_PTR_VA_6FDF0B3C) + imul32(prestId, 0x1b0)) >>> 0;
        }
      }
      const nFiles = m.u32((pLvlPrestTxt + 0x40) >>> 0) | 0;
      for (let fileIdx = 0; fileIdx < nFiles; fileIdx++) {
        DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(
          m,
          lvl,
          m.u32((presetIds + curIdx * 4) >>> 0) | 0,
          fileIdx,
          0,
          0x0f,
        );
      }
    } else {
      DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, prestId, -1, 0, 0x0f);
    }
    curIdx = smod32((curIdx + 1) | 0, count);
  }
}

/**
 * `@va D2Common:0x6FDD4DA0` (`DRLGOUTJUNG_SpawnTravincalPresets113c`, not exported;
 * custom LTCG `esi = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_SpawnTravincalPresets113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  if ((m.u32((lvl + 0x1d0) >>> 0) | 0) !== 0x53) {
    return;
  }
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, 0, 0x28d, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 2, 0, 0x28e, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 6, 0, 0x28f, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, 4, 0x290, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 2, 4, 0x291, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 6, 4, 0x292, -1, 0);
}

/**
 * `@va D2Common:0x6FDD5B80` (`DRLGOUTJUNG_SpawnPresetsSet1_113c`, not exported;
 * custom LTCG `esi = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_SpawnPresetsSet1_113c(
  m: Memory113c,
  pLevel: number,
): void {
  const sm = withOutJungStackScratch113c(m);
  const pA = writeStackInt32List113c(sm, OUTJUNG_STACK_BASE, [0x191, 0x192, 0x196, 0x197, 0x193]);
  const pB = writeStackInt32List113c(sm, OUTJUNG_STACK_BASE + 0x20, [0x188, 0x189]);
  DRLGOUTJUNG_PlaceShuffledPresetList113c(sm, pLevel, pA, 5, 0);
  DRLGOUTJUNG_PlaceShuffledPresetList113c(sm, pLevel, pB, 2, 1);
}

/**
 * `@va D2Common:0x6FDD5BE0` (`DRLGOUTJUNG_SpawnPresetsSet2_113c`, not exported;
 * custom LTCG `esi = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_SpawnPresetsSet2_113c(
  m: Memory113c,
  pLevel: number,
): void {
  const sm = withOutJungStackScratch113c(m);
  const pA = writeStackInt32List113c(sm, OUTJUNG_STACK_BASE, [0x18b, 0x190, 0x18e, 0x194, 0x195]);
  const pB = writeStackInt32List113c(sm, OUTJUNG_STACK_BASE + 0x20, [0x19b]);
  DRLGOUTJUNG_PlaceShuffledPresetList113c(sm, pLevel, pA, 5, 0);
  DRLGOUTJUNG_PlaceShuffledPresetList113c(sm, pLevel, pB, 1, 1);
  DRLGOUTJUNG_PlaceShuffledPresetList113c(sm, pLevel, pB, 1, 1);
}

/**
 * `@va D2Common:0x6FDD5C50` (`DRLGOUTJUNG_SpawnPresetsSet3_113c`, not exported;
 * `__stdcall(pLevel) -> void`, `ret 4`).
 */
export function DRLGOUTJUNG_SpawnPresetsSet3_113c(
  m: Memory113c,
  pLevel: number,
): void {
  const sm = withOutJungStackScratch113c(m);
  const pA = writeStackInt32List113c(sm, OUTJUNG_STACK_BASE, [0x19d, 0x198, 0x199, 0x19a]);
  DRLGOUTJUNG_PlaceShuffledPresetList113c(sm, pLevel, pA, 4, 0);
}

/**
 * `@va D2Common:0x6FDD5C90` (`DRLGOUTJUNG_SpawnPresetsSet4_113c`, not exported;
 * custom LTCG `esi = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_SpawnPresetsSet4_113c(
  m: Memory113c,
  pLevel: number,
): void {
  const sm = withOutJungStackScratch113c(m);
  const pA = writeStackInt32List113c(sm, OUTJUNG_STACK_BASE, [0x19b, 0x18f, 0x18e, 0x193]);
  const pB = writeStackInt32List113c(sm, OUTJUNG_STACK_BASE + 0x20, [0x18b]);
  DRLGOUTJUNG_PlaceShuffledPresetList113c(sm, pLevel, pA, 4, 0);
  DRLGOUTJUNG_PlaceShuffledPresetList113c(sm, pLevel, pB, 1, 1);
  DRLGOUTJUNG_PlaceShuffledPresetList113c(sm, pLevel, pB, 1, 1);
}

/**
 * `@va D2Common:0x6FDD5CF0` (`DRLGOUTJUNG_SpawnPresetsSet5_113c`, not exported;
 * `__stdcall(pLevel) -> void`, `ret 4`).
 */
export function DRLGOUTJUNG_SpawnPresetsSet5_113c(
  m: Memory113c,
  pLevel: number,
): void {
  const sm = withOutJungStackScratch113c(m);
  const pA = writeStackInt32List113c(sm, OUTJUNG_STACK_BASE, [0x18c, 0x18d]);
  DRLGOUTJUNG_PlaceShuffledPresetList113c(sm, pLevel, pA, 2, 0);
}

/**
 * `@va D2Common:0x6FDD5D20` (`DRLGOUTJUNG_SpawnPresetsSet6_113c`, not exported;
 * custom LTCG `esi = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_SpawnPresetsSet6_113c(
  m: Memory113c,
  pLevel: number,
): void {
  const sm = withOutJungStackScratch113c(m);
  const pA = writeStackInt32List113c(sm, OUTJUNG_STACK_BASE, [0x18b, 0x19b, 0x190, 0x18e]);
  const pB = writeStackInt32List113c(sm, OUTJUNG_STACK_BASE + 0x20, [0x194, 0x195, 0x196, 0x197]);
  DRLGOUTJUNG_PlaceShuffledPresetList113c(sm, pLevel, pA, 4, 0);
  DRLGOUTJUNG_PlaceShuffledPresetList113c(sm, pLevel, pB, 4, 1);
}

/**
 * `@va D2Common:0x6FDD5D90` (`DRLGOUTJUNG_SpawnPresetsSet7_113c`, not exported;
 * `__stdcall(pLevel) -> void`, `ret 4`).
 */
export function DRLGOUTJUNG_SpawnPresetsSet7_113c(
  m: Memory113c,
  pLevel: number,
): void {
  const sm = withOutJungStackScratch113c(m);
  const pA = writeStackInt32List113c(
    sm,
    OUTJUNG_STACK_BASE,
    [0x18b, 0x19b, 0x191, 0x192, 0x18f, 0x18e, 0x193],
  );
  DRLGOUTJUNG_PlaceShuffledPresetList113c(sm, pLevel, pA, 7, 0);
}

/**
 * `@va D2Common:0x6FDD6040` (`DRLGOUTJUNG_SpawnAct4OutdoorPresets113c`, not exported;
 * custom LTCG `eax = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_SpawnAct4OutdoorPresets113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  const nLevelId = m.u32((lvl + 0x1d0) >>> 0) | 0;
  if (nLevelId === 0x6a) {
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x32b, -1, 0, 0x0f);
  }
  const idx = (m.u32((lvl + 0x1d0) >>> 0) | 0) - 104;
  const baseB = ACT4_PRESET_BASE_B_6FDE57B8[idx]! | 0;
  const baseA = ACT4_PRESET_BASE_A_6FDE57AC[idx]! | 0;

  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, baseB, -1, 0, 0x0f);
  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, (baseB + 1) | 0, -1, 0, 0x0f);
  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, (baseB + 1) | 0, -1, 0, 0x0f);
  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, (baseB + 2) | 0, -1, 0, 0x0f);
  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, (baseB + 2) | 0, -1, 0, 0x0f);
  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, (baseB + 3) | 0, -1, 0, 0x0f);
  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, (baseB + 3) | 0, -1, 0, 0x0f);

  if ((m.u32((lvl + 0x1d0) >>> 0) | 0) === 0x69) {
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x336, -1, 0, 0x0f);
  }

  for (let i = 0; i < 4; i++) {
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, (baseB + 4) | 0, -1, 0, 0x0f);
  }
  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, baseA, -1, 0, 0x0f);
  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, (baseA + 1) | 0, -1, 0, 0x0f);
  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, (baseA + 1) | 0, -1, 0, 0x0f);
  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, (baseA + 2) | 0, -1, 0, 0x0f);
  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, (baseA + 2) | 0, -1, 0, 0x0f);
  for (let i = 0; i < 4; i++) {
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, (baseA + 3) | 0, -1, 0, 0x0f);
  }
}

/**
 * `@va D2Common:0x6FDD4E40` (`DRLGOUTJUNG_SpawnRandomPresetRange113c`, not exported;
 * custom LTCG `esi = pLevel`, `eax = nEndLvlPrestId`, `[esp+4] = nStartLvlPrestId`, `[esp+8] = nMaxSpawns`, `ret 8`).
 */
export function DRLGOUTJUNG_SpawnRandomPresetRange113c(
  m: Memory113c,
  pLevel: number,
  nEndLvlPrestId: number,
  nStartLvlPrestId: number,
  nMaxSpawns: number,
): void {
  const lvl = pLevel >>> 0;
  const pOutdoors = m.u32((lvl + 0x14) >>> 0);
  const gridW = m.u32((pOutdoors + 0x5c) >>> 0) | 0;
  const gridH = m.u32((pOutdoors + 0x60) >>> 0) | 0;
  const nCells = imul32(gridH, gridW);
  const rangeCount = (((nEndLvlPrestId | 0) - (nStartLvlPrestId | 0)) | 0) + 1;
  const pDrlg = m.u32((lvl + 0x1b4) >>> 0);
  void m.u32((pDrlg + 0x478) >>> 0);
  if (nCells === 0) {
    return;
  }

  const pArr = m.alloc((nCells * 8) >>> 0) >>> 0;
  if (nCells > 0) {
    for (let i = 0; i < nCells; i++) {
      m.setU32((pArr + i * 8) >>> 0, smod32(i, gridW) >>> 0);
      m.setU32((pArr + i * 8 + 4) >>> 0, sdiv32(i, gridW) >>> 0);
    }
    const pSeed = (lvl + 0x1c4) >>> 0;
    for (let i = 0; i < nCells; i++) {
      const idxA = SEED_RollRandomNumberInline113c(m, pSeed, nCells);
      const idxB = SEED_RollRandomNumberInline113c(m, pSeed, nCells);
      const addrA = (pArr + idxA * 8) >>> 0;
      const addrB = (pArr + idxB * 8) >>> 0;
      const tmpX = m.u32(addrA);
      const tmpY = m.u32((addrA + 4) >>> 0);
      m.setU32(addrA, m.u32(addrB));
      m.setU32((addrA + 4) >>> 0, m.u32((addrB + 4) >>> 0));
      m.setU32(addrB, tmpX);
      m.setU32((addrB + 4) >>> 0, tmpY);
    }

    let placed = 0;
    const pSeedLoop = (lvl + 0x1c4) >>> 0;
    for (let i = 0; i < nCells; i++) {
      const cellX = m.u32((pArr + i * 8) >>> 0) | 0;
      const cellY = m.u32((pArr + i * 8 + 4) >>> 0) | 0;
      const pickedOffset =
        rangeCount > 0 ? SEED_RollRandomNumberInline113c(m, pSeedLoop, rangeCount) : 0;
      const prestId = ((nStartLvlPrestId | 0) + pickedOffset) | 0;
      if (DRLGOUTDOORS_SpawnOutdoorRoomEx113c(m, lvl, cellX, cellY, prestId, 0, 0x0f) !== 0) {
        DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, cellX, cellY, prestId, -1, 0);
        placed = (placed + 1) | 0;
        if ((nMaxSpawns | 0) > 0 && placed >= (nMaxSpawns | 0)) {
          break;
        }
      }
    }
  }
  (m as { free?: (p: number) => void }).free?.(pArr);
}

/**
 * `@va D2Common:0x6FDD50D0` (`DRLGOUTJUNG_SpawnAct3KurastBazaarBorders113c`, not exported;
 * custom LTCG `esi = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_SpawnAct3KurastBazaarBorders113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  const maxX = (sdiv32(m.u32((lvl + 0x24) >>> 0) | 0, 8) - 1) | 0;
  const maxY = (sdiv32(m.u32((lvl + 0x28) >>> 0) | 0, 8) - 1) | 0;
  const pDrlg = m.u32((lvl + 0x1b4) >>> 0);
  const actFlag = m.u32((pDrlg + 0x474) >>> 0) | 0;
  const specialX = actFlag !== 0 ? ((maxX - 1) | 0) : 1;
  const midX = sdiv32(maxX, 2);

  let x = 1;
  while (x < maxX) {
    const isMid = x === midX ? 1 : 0;
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, x, 0, (0x27c + isMid * 8) | 0, -1, 0);
    x = (x + (x === midX ? 1 : 0) + 1) | 0;
  }

  for (let i = 1; i < maxX; i++) {
    const isSpec = i === specialX ? 1 : 0;
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, i, maxY, (0x27d + isSpec * 8) | 0, -1, 0);
  }

  for (let y = 1; y < maxY; y++) {
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, maxX, y, 0x27e, -1, 0);
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, y, 0x27f, -1, 0);
  }

  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, 0, 0x281, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, maxX, 0, 0x280, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, maxY, 0x283, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, maxX, maxY, 0x282, -1, 0);
}

/**
 * `@va D2Common:0x6FDD5220` (`DRLGOUTJUNG_SpawnAct3LowerKurastBorders113c`, not exported;
 * custom LTCG `edi = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_SpawnAct3LowerKurastBorders113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  const maxX = (sdiv32(m.u32((lvl + 0x24) >>> 0) | 0, 8) - 1) | 0;
  const maxY = (sdiv32(m.u32((lvl + 0x28) >>> 0) | 0, 8) - 1) | 0;
  const pDrlg = m.u32((lvl + 0x1b4) >>> 0);
  const actFlag = m.u32((pDrlg + 0x474) >>> 0) | 0;
  const topSpecX = actFlag !== 0 ? ((maxX - 1) | 0) : 1;
  const botSpecX = actFlag !== 0 ? 1 : ((maxX - 1) | 0);

  for (let x = 1; x < maxX; x++) {
    const isTop = x === topSpecX ? 1 : 0;
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, x, 0, (0x26b + isTop * 8) | 0, -1, 0);
    const isBot = x === botSpecX ? 1 : 0;
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, x, maxY, (0x26c + isBot * 8) | 0, -1, 0);
  }

  for (let y = 1; y < maxY; y++) {
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, maxX, y, 0x26d, -1, 0);
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, y, 0x26e, -1, 0);
  }

  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, 0, 0x270, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, maxX, 0, 0x26f, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, maxY, 0x272, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, maxX, maxY, 0x271, -1, 0);
}

/**
 * `@va D2Common:0x6FDD5360` (`DRLGOUTJUNG_SpawnAct3GreatMarshBorders113c`, not exported;
 * custom LTCG `edi = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_SpawnAct3GreatMarshBorders113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  const maxX = (sdiv32(m.u32((lvl + 0x24) >>> 0) | 0, 8) - 1) | 0;
  const maxY = (sdiv32(m.u32((lvl + 0x28) >>> 0) | 0, 8) - 1) | 0;
  const pDrlg = m.u32((lvl + 0x1b4) >>> 0);
  const actFlag = m.u32((pDrlg + 0x474) >>> 0) | 0;
  const midX = sdiv32(maxX, 2);
  const topSpecX = actFlag !== 0 ? 1 : ((maxX - 1) | 0);

  for (let x = 1; x < maxX; x++) {
    const isTop = x === topSpecX ? 1 : 0;
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, x, 0, (0x25d + isTop * 8) | 0, -1, 0);
  }

  let x = 1;
  while (x < maxX) {
    const isMid = x === midX ? 1 : 0;
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, x, maxY, (0x25e + isMid * 8) | 0, -1, 0);
    x = (x + (x === midX ? 1 : 0) + 1) | 0;
  }

  for (let y = 1; y < maxY; y++) {
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, maxX, y, 0x25f, -1, 0);
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, y, 0x260, -1, 0);
  }

  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, 0, 0x262, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, maxX, 0, 0x261, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, maxY, 0x264, -1, 0);
  DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, maxX, maxY, 0x263, -1, 0);
}

/**
 * `@va D2Common:0x6FDD56C0` (`DRLGOUTJUNG_SpawnAct3CityPresetsByLevel113c`, not exported;
 * custom LTCG `eax = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_SpawnAct3CityPresetsByLevel113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  const levelId = m.u32((lvl + 0x1d0) >>> 0) | 0;
  if (levelId === 0x4f) {
    DRLGOUTJUNG_SpawnAct3GreatMarshBorders113c(m, lvl);
  } else if (levelId === 0x50) {
    DRLGOUTJUNG_SpawnAct3LowerKurastBorders113c(m, lvl);
  } else if (levelId === 0x51) {
    DRLGOUTJUNG_SpawnAct3KurastBazaarBorders113c(m, lvl);
  }

  const edgeX = (sdiv32(m.u32((lvl + 0x24) >>> 0) | 0, 8) - 4) | 0;
  const edgeY = (sdiv32(m.u32((lvl + 0x28) >>> 0) | 0, 8) - 4) | 0;
  const sw = (m.u32((lvl + 0x1d0) >>> 0) | 0) - 0x4f;
  if (sw === 0) {
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x277, 0, 0, 0x0f);
    DRLGOUTJUNG_SpawnRandomPresetRange113c(m, lvl, 0x26a, 0x26a, 4);
    DRLGOUTJUNG_SpawnRandomPresetRange113c(m, lvl, 0x269, 0x268, 0);
    DRLGOUTJUNG_SpawnRandomPresetRange113c(m, lvl, 0x267, 0x267, 0);
  } else if (sw === 1) {
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 3, 3, 0x275, 0, 0);
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, edgeX, 3, 0x275, 1, 0);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x276, 0, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x276, 1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x277, 0, 0, 0x0f);
    DRLGOUTJUNG_SpawnRandomPresetRange113c(m, lvl, 0x27b, 0x27b, 4);
    DRLGOUTJUNG_SpawnRandomPresetRange113c(m, lvl, 0x27a, 0x279, 0);
    DRLGOUTJUNG_SpawnRandomPresetRange113c(m, lvl, 0x278, 0x278, 0);
  } else if (sw === 2) {
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 3, edgeY, 0x286, 0, 0);
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, edgeX, edgeY, 0x286, 1, 0);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x287, 0, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x287, 1, 0, 0x0f);
    DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, lvl, 0x277, 0, 0, 0x0f);
    DRLGOUTJUNG_SpawnRandomPresetRange113c(m, lvl, 0x28b, 0x28b, 4);
    DRLGOUTJUNG_SpawnRandomPresetRange113c(m, lvl, 0x28a, 0x289, 0);
    DRLGOUTJUNG_SpawnRandomPresetRange113c(m, lvl, 0x288, 0x288, 0);
  } else if (sw === 3) {
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 0, 0, 0x28c, 0, 0);
  }
}

/**
 * `@va D2Common:0x6FDD5DF0` (`DRLGOUTJUNG_SpawnAct2DryHillsBorders113c`, not exported;
 * custom LTCG `esi = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_SpawnAct2DryHillsBorders113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 2, 0x16c);
  DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 1, 0x16c);
  DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 3, 0x16c);
}

const ACT2_OUTDOOR_SWITCH_6FDD5F6C = Uint8Array.from([
  0, 1, 2, 3, 4, 5, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 6,
]);

/**
 * `@va D2Common:0x6FDD5E20` (`DRLGOUTJUNG_InitAct2OutdoorLevel113c`, not exported;
 * custom LTCG `eax = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_InitAct2OutdoorLevel113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  DRLGOUTPLACE_ApplyOutdoorVerticesToGrids113c(m, lvl);
  DRLGROOM_SpawnOutdoorBorderPresets113c(m, lvl);

  const idx = ((m.u32((lvl + 0x1d0) >>> 0) | 0) - 0x29) >>> 0;
  if (idx > 0x5d) {
    return;
  }
  const caseId = ACT2_OUTDOOR_SWITCH_6FDD5F6C[idx]!;
  if (caseId === 0) {
    DRLGOUTJUNG_SpawnAct2LutGholeinBorderPreset113c(m, lvl);
    DRLGOUTJUNG_SpawnAct2DryHillsBorders113c(m, lvl);
    DRLGOUTJUNG_SpawnSpiderForestSpecialPreset113c(m, lvl);
    DRLGOUTDOORS_SpawnRandomOutdoorThemes113c(m, lvl, 5);
    DRLGOUTJUNG_SpawnPresetsSet7_113c(m, lvl);
  } else if (caseId === 1) {
    DRLGOUTJUNG_SpawnKurastCausewayPresets113c(m, lvl);
    DRLGOUTJUNG_SpawnAct2DryHillsBorders113c(m, lvl);
    DRLGOUTJUNG_SpawnSpiderForestSpecialPreset113c(m, lvl);
    DRLGOUTDOORS_PlaceRandomOutdoorShrineOrSpecial113c(m, lvl);
    DRLGOUTDOORS_SpawnRandomOutdoorThemes113c(m, lvl, 5);
    DRLGOUTJUNG_SpawnPresetsSet6_113c(m, lvl);
  } else if (caseId === 2) {
    DRLGOUTJUNG_SpawnKurastCausewayPresets113c(m, lvl);
    DRLGOUTJUNG_SpawnAct2DryHillsBorders113c(m, lvl);
    DRLGOUTJUNG_SpawnSpiderForestSpecialPreset113c(m, lvl);
    DRLGOUTJUNG_SpawnPresetsSet5_113c(m, lvl);
    DRLGOUTDOORS_PlaceRandomOutdoorShrineOrSpecial113c(m, lvl);
    DRLGOUTDOORS_SpawnRandomOutdoorThemes113c(m, lvl, 5);
    DRLGOUTJUNG_SpawnPresetsSet4_113c(m, lvl);
  } else if (caseId === 3) {
    DRLGOUTJUNG_SpawnKurastCausewayPresets113c(m, lvl);
    DRLGOUTJUNG_SpawnAct2DryHillsBorders113c(m, lvl);
    DRLGOUTJUNG_SpawnSpiderForestSpecialPreset113c(m, lvl);
    DRLGOUTJUNG_SpawnPresetsSet3_113c(m, lvl);
    DRLGOUTDOORS_PlaceRandomOutdoorShrineOrSpecial113c(m, lvl);
    DRLGOUTDOORS_SpawnRandomOutdoorThemes113c(m, lvl, 5);
    DRLGOUTJUNG_SpawnPresetsSet2_113c(m, lvl);
  } else if (caseId === 4) {
    DRLGOUTJUNG_SpawnSpiderForestSpecialPreset113c(m, lvl);
  } else if (caseId === 5) {
    DRLGOUTJUNG_SpawnLowerKurastPresets113c(m, lvl);
    DRLGOUTJUNG_SpawnAct2DryHillsBorders113c(m, lvl);
    DRLGOUTDOORS_SpawnRandomOutdoorThemes113c(m, lvl, 5);
    DRLGOUTJUNG_SpawnPresetsSet1_113c(m, lvl);
  } else if (caseId === 6) {
    DRLGOUTDOORS_SpawnPresetInGrid113c(m, lvl, 4, 4, 0x18a, -1, 0);
    DRLGOUTJUNG_SpawnAct2DryHillsBorders113c(m, lvl);
    DRLGOUTJUNG_SpawnPresetsSet1_113c(m, lvl);
    DRLGOUTDOORS_SpawnRandomOutdoorThemes113c(m, lvl, 5);
  }
}

/**
 * `@va D2Common:0x6FDD61A0` (`DRLGOUTJUNG_InitAct4OutdoorLevel113c`, not exported;
 * custom LTCG `eax = pLevel`, `ret`).
 */
export function DRLGOUTJUNG_InitAct4OutdoorLevel113c(
  m: Memory113c,
  pLevel: number,
): void {
  const lvl = pLevel >>> 0;
  const levelId = m.u32((lvl + 0x1d0) >>> 0) | 0;
  DRLGOUTPLACE_ApplyOutdoorVerticesToGrids113c(m, lvl);
  if (levelId !== 0x6c) {
    DRLGROOM_SpawnOutdoorBorderPresets113c(m, lvl);
  }
  const curId = m.u32((lvl + 0x1d0) >>> 0) | 0;
  if (curId >= 0x68 && curId <= 0x6a) {
    DRLGOUTJUNG_SpawnOuterSteppesTransitions113c(m, lvl);
    DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 1, 0x31f);
    DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 2, 0x31f);
    DRLGOUTDOORS_BuildOutdoorSubstContext113c(m, lvl, 3, 0x31f);
    DRLGOUTJUNG_SpawnAct4OutdoorPresets113c(m, lvl);
  } else if (curId === 0x6c) {
    DRLGOUTJUNG_SpawnPandemoniumFortressPresets113c(m, lvl);
  }
}

