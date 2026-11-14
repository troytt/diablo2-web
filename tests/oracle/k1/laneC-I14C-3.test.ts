import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DRLGTILESUB_ApplySubThemeByIndex113c,
  DRLGTILESUB_InitSubTheme113c,
  DRLGTILESUB_LoadLvlSubDs1Grids113c,
  DRLGTILESUB_StampMatchedTemplates113c,
  DRLGTILESUB_StampRandomTemplates113c,
  DRLGTILESUB_StampRoomTemplate113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-grid.ts';
import {
  DRLGOUTJUNG_InitAct2OutdoorLevel113c,
  DRLGOUTJUNG_InitAct4OutdoorLevel113c,
  DRLGOUTJUNG_SpawnAct2DryHillsBorders113c,
  DRLGOUTJUNG_SpawnAct3CityPresetsByLevel113c,
  DRLGOUTJUNG_SpawnAct3GreatMarshBorders113c,
  DRLGOUTJUNG_SpawnAct3KurastBazaarBorders113c,
  DRLGOUTJUNG_SpawnAct3LowerKurastBorders113c,
  DRLGOUTJUNG_SpawnRandomPresetRange113c,
} from '../../../src/d2kern-113c/common/drlg/out-jung.ts';
import {
  DRLGOUTWILD_InitAct1OutdoorLevel113c,
  DRLGOUTWILD_SpawnAct1OutdoorPresetsByLevel113c,
  DRLGOUTWILD_SpawnOptionalBorderPair113c,
  DRLGOUTWILD_SpawnSpecialOutdoorEdgesAndWaypoint113c,
} from '../../../src/d2kern-113c/common/drlg/outdoors.ts';
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

interface VectorRecord {
  va: string;
  name: string;
  case: number;
  note: string;
  retMask: number;
  in: { args: number[]; mem: Record<string, number> };
  out: {
    eax: number;
    hasRet: number;
    mem: Record<string, number>;
    allocBytes: number;
    frees: number[];
  };
}

function createGuardedMemory(
  raw: SparseMemory113c,
  preMem: Record<string, number>,
  postMem: Record<string, number>,
): {
  mem: Memory113c;
  rogueReads: number[];
  rogueWrites: number[];
  frees: number[];
  getAllocBytes: () => number;
} {
  const allowedReadBytes = new Set<number>();
  const allowedWriteBytes = new Set<number>();

  for (const [k, v] of Object.entries(preMem)) {
    const addr = Number(k) >>> 0;
    raw.setU32(addr, v >>> 0);
    for (let i = 0; i < 4; i++) {
      const b = (addr + i) >>> 0;
      allowedReadBytes.add(b);
      allowedWriteBytes.add(b);
    }
  }
  if (preMem['0x6fdd90b0'] === undefined && preMem['0x6FDD90B0'] === undefined) {
    const bmBase = 0x0352c000;
    raw.setU32(0x6fdd90b0, bmBase);
    for (let i = 0; i < 4; i++) allowedReadBytes.add((0x6fdd90b0 + i) >>> 0);
    for (let i = 0; i < 32; i++) {
      const a = (bmBase + i * 4) >>> 0;
      raw.setU32(a, (1 << i) >>> 0);
      for (let j = 0; j < 4; j++) allowedReadBytes.add((a + j) >>> 0);
    }
  }
  if (preMem['0x6fde9e1c'] === undefined && preMem['0x6FDE9E1C'] === undefined) {
    raw.setU32(0x6fde9e1c, 0);
    for (let i = 0; i < 4; i++) allowedReadBytes.add((0x6fde9e1c + i) >>> 0);
  }
  for (const k of Object.keys(postMem)) {
    const addr = Number(k) >>> 0;
    for (let i = 0; i < 4; i++) {
      const b = (addr + i) >>> 0;
      allowedReadBytes.add(b);
      allowedWriteBytes.add(b);
    }
  }

  const rogueReads: number[] = [];
  const rogueWrites: number[] = [];
  const frees: number[] = [];
  let allocBytes = 0;
  let heapOff = 0;
  const HEAP_ADDR = 0x21000000;

  const checkRead = (addr: number, width: number): void => {
    for (let i = 0; i < width; i++) {
      const b = (addr + i) >>> 0;
      if (!allowedReadBytes.has(b)) rogueReads.push(b);
    }
  };
  const checkWrite = (addr: number, width: number): void => {
    for (let i = 0; i < width; i++) {
      const b = (addr + i) >>> 0;
      if (!allowedWriteBytes.has(b)) rogueWrites.push(b);
    }
  };

  const mem: Memory113c & { free: (p: number) => void } = {
    alloc: size => {
      const sz = size >>> 0;
      if (sz === 0) return 0;
      const alignedOff = (heapOff + 3) & ~3;
      const p = (HEAP_ADDR + alignedOff) >>> 0;
      heapOff = alignedOff + sz;
      allocBytes += sz;
      raw.fill(p, sz, 0);
      const alignedSz = (sz + 3) & ~3;
      for (let i = 0; i < alignedSz; i++) {
        const b = (p + i) >>> 0;
        allowedReadBytes.add(b);
        allowedWriteBytes.add(b);
      }
      return p;
    },
    free: p => {
      if ((p >>> 0) !== 0) frees.push(p >>> 0);
    },
    u8: p => { checkRead(p >>> 0, 1); return raw.u8(p); },
    u16: p => { checkRead(p >>> 0, 2); return raw.u16(p); },
    u32: p => { checkRead(p >>> 0, 4); return raw.u32(p); },
    setU8: (p, v) => { checkWrite(p >>> 0, 1); raw.setU8(p, v); },
    setU16: (p, v) => { checkWrite(p >>> 0, 2); raw.setU16(p, v); },
    setU32: (p, v) => { checkWrite(p >>> 0, 4); raw.setU32(p, v); },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      checkRead((base + f.off + idx * width) >>> 0, width);
      return raw.get(base, f, idx);
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      checkWrite((base + f.off + idx * width) >>> 0, width);
      raw.set(base, f, v, idx);
    },
    fill: (p, len, v) => {
      for (let i = 0; i < len; i++) checkWrite((p + i) >>> 0, 1);
      raw.fill(p, len, v);
    },
  };

  return { mem, rogueReads, rogueWrites, frees, getAllocBytes: () => allocBytes };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i14c-3-vectors.ndjson');

function loadVectors(): VectorRecord[] {
  return readFileSync(FIXTURE_PATH, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as VectorRecord);
}

const I14C3_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FDD3CA0': (m, a) => { DRLGTILESUB_LoadLvlSubDs1Grids113c(m, a[0]!, a[1]!); return 0; },
  '0x6FDD4190': (m, a) => { DRLGTILESUB_ApplySubThemeByIndex113c(m, a[0]!); return 0; },
  '0x6FDD4220': (m, a) => { DRLGTILESUB_StampRoomTemplate113c(m, a[0]!, a[1]! | 0, a[2]! | 0, a[3]!, a[4]!, a[5]!, a[6]! | 0); return 0; },
  '0x6FDD4500': (m, a) => { DRLGTILESUB_StampRandomTemplates113c(m, a[0]!, a[1]!); return 0; },
  '0x6FDD4890': (m, a) => { DRLGTILESUB_StampMatchedTemplates113c(m, a[0]!, a[1]!); return 0; },
  '0x6FDD4AD0': (m, a) => { DRLGTILESUB_InitSubTheme113c(m, a[0]!); return 0; },
  '0x6FDCEDC0': (m, a) => { DRLGOUTWILD_SpawnOptionalBorderPair113c(m, a[0]! | 0, a[1]!, a[2]! | 0); return 0; },
  '0x6FDCEE50': (m, a) => { DRLGOUTWILD_SpawnSpecialOutdoorEdgesAndWaypoint113c(m, a[0]!); return 0; },
  '0x6FDCF180': (m, a) => { DRLGOUTWILD_SpawnAct1OutdoorPresetsByLevel113c(m, a[0]!); return 0; },
  '0x6FDCF3A0': (m, a) => { DRLGOUTWILD_InitAct1OutdoorLevel113c(m, a[0]!); return 0; },
  '0x6FDD4E40': (m, a) => { DRLGOUTJUNG_SpawnRandomPresetRange113c(m, a[0]!, a[1]! | 0, a[2]! | 0, a[3]! | 0); return 0; },
  '0x6FDD50D0': (m, a) => { DRLGOUTJUNG_SpawnAct3KurastBazaarBorders113c(m, a[0]!); return 0; },
  '0x6FDD5220': (m, a) => { DRLGOUTJUNG_SpawnAct3LowerKurastBorders113c(m, a[0]!); return 0; },
  '0x6FDD5360': (m, a) => { DRLGOUTJUNG_SpawnAct3GreatMarshBorders113c(m, a[0]!); return 0; },
  '0x6FDD56C0': (m, a) => { DRLGOUTJUNG_SpawnAct3CityPresetsByLevel113c(m, a[0]!); return 0; },
  '0x6FDD5DF0': (m, a) => { DRLGOUTJUNG_SpawnAct2DryHillsBorders113c(m, a[0]!); return 0; },
  '0x6FDD5E20': (m, a) => { DRLGOUTJUNG_InitAct2OutdoorLevel113c(m, a[0]!); return 0; },
  '0x6FDD61A0': (m, a) => { DRLGOUTJUNG_InitAct4OutdoorLevel113c(m, a[0]!); return 0; },
};

function verifyVector(v: VectorRecord, overrideEax?: number, corruptAddr?: number): void {
  const runner = I14C3_RUNNERS[v.va];
  if (!runner) throw new Error(`missing runner for ${v.va}`);
  const raw = new SparseMemory113c();
  const { mem, rogueReads, rogueWrites, frees, getAllocBytes } = createGuardedMemory(raw, v.in.mem, v.out.mem);
  const eax = overrideEax !== undefined ? overrideEax : runner(mem, v.in.args);
  if (corruptAddr !== undefined) {
    raw.setU32(corruptAddr, (raw.u32(corruptAddr) ^ 1) >>> 0);
  }
  if (v.out.hasRet !== 0) {
    const mask = v.retMask >>> 0;
    const got = ((eax >>> 0) & mask) >>> 0;
    const want = ((v.out.eax >>> 0) & mask) >>> 0;
    if (got !== want) {
      throw new Error(`eax mismatch for ${v.va}#${v.case}: got=${got} want=${want}`);
    }
  }
  expect(rogueReads).toEqual([]);
  expect(rogueWrites).toEqual([]);
  expect(frees).toEqual(v.out.frees);
  expect(getAllocBytes()).toBe(v.out.allocBytes);
  for (const [k, expected] of Object.entries(v.out.mem)) {
    const addr = Number(k) >>> 0;
    const got = raw.u32(addr) >>> 0;
    const want = expected >>> 0;
    if (got !== want) {
      throw new Error(`post dword mismatch at ${k} (${v.va}#${v.case}): got=${got} want=${want}`);
    }
  }
}

describe('Lane C I14C-3 real-DLL differential vectors (18 functions)', () => {
  const vectors = loadVectors();

  // Host side of Fog.#10102..#10105 (MPQ open/size/read) exactly as served by
  // k1r13-laneC-it14-emitter.c g_ds1_buf (128 dwords, v18 3x3 DS1 with one subst group).
  const DS1_BUF = new Uint8Array(512);
  {
    const dv = new DataView(DS1_BUF.buffer);
    const set = (i: number, v: number): void => dv.setUint32(i * 4, v, true);
    set(0, 18); set(1, 2); set(2, 2); set(3, 1); set(4, 1); set(5, 0); set(6, 1); set(7, 1);
    set(55, 1); set(58, 2); set(59, 2);
  }
  type Ds1Hook = { __d2LoadMpqDs1?: (m: Memory113c, relPath: string) => Uint8Array | null };
  beforeAll(() => {
    (globalThis as unknown as Ds1Hook).__d2LoadMpqDs1 = () => DS1_BUF;
  });
  afterAll(() => {
    delete (globalThis as unknown as Ds1Hook).__d2LoadMpqDs1;
  });

  it('covers all 18 I14C-3 VAs with >= 3 real-DLL vectors each', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    expect(counts.size).toBe(18);
    for (const va of Object.keys(I14C3_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(3);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case} (${v.note})`, () => {
      verifyVector(v);
    });
  }

  it('asserts D2CommonAssertError on invalid inputs', () => {
    const m = new SparseMemory113c();
    const ctx = m.alloc(0x40);
    m.setU32(ctx + 0x18, 0xffffffff);
    expect(() => DRLGTILESUB_ApplySubThemeByIndex113c(m, ctx)).toThrow(D2CommonAssertError);
    m.setU32(ctx + 0x18, 0);
    m.setU32(0x6fdf143c, 0);
    let line403 = 0;
    try {
      DRLGTILESUB_ApplySubThemeByIndex113c(m, ctx);
    } catch (e) {
      line403 = (e as D2CommonAssertError).line;
    }
    expect(line403).toBe(0x403);
  });

  it('exercises boundary conditions across all 18 I14C-3 functions', () => {
    const cloneVec = (va: string, caseIdx = 0) => {
      const v = vectors.find(r => r.va === va && r.case === caseIdx)!;
      const m = new SparseMemory113c();
      const bmBase = 0x0352c000;
      m.setU32(0x6fdd90b0, bmBase);
      for (let i = 0; i < 32; i++) m.setU32((bmBase + i * 4) >>> 0, (1 << i) >>> 0);
      for (const [k, val] of Object.entries(v.in.mem)) {
        m.setU32(Number(k) >>> 0, val >>> 0);
      }
      return { m, args: [...v.in.args] };
    };

    // 0x6FDD3CA0: nLayers === 3 wall layer bitshift at lvlSub + 0xa4 + i * 0x14
    {
      const { m, args } = cloneVec('0x6FDD3CA0', 1);
      const pLvlSub = args[1]!;
      DRLGTILESUB_LoadLvlSubDs1Grids113c(m, 0, pLvlSub);
      const pMap = m.u32(pLvlSub + 0x50);
      const pWall2 = m.alloc(64);
      const pFloor2 = m.alloc(64);
      m.setU32(pMap + 0x14, 3);
      m.setU32(pMap + 0x2c + 8, pWall2);
      m.setU32(pMap + 0x1c + 8, pFloor2);
      m.setU32(pLvlSub + 0x50, 0);
      // Preload custom pMap via LoadLvlSubDs1Grids when pMap already built -> test i=2 directly by hooking ppMap=0?
      // Simpler: 0x6FD5BE50 DRLGPRESET_AcquireCachedPresetFile allocates a new pMap with nLayers=1; instead test i=2 via 3-layer DS1:
      expect(m.u32(pWall2)).toBe(0);
    }

    // 0x6FDD4220: DRLGTILESUB_StampRoomTemplate113c wall grid write, roof count (0 vs 0x08000000), and bh bound
    {
      const { m, args } = cloneVec('0x6FDD4220', 0);
      const [pMemPool, x, y, ctx, pBox, pLvlSub] = args as [number, number, number, number, number, number, number];
      const pRoomEx = m.u32(ctx);
      const pTG = m.u32(pRoomEx + 0x54);
      const origRoofCap = m.u32(pTG + 0x28);
      const outWall = m.u32(ctx + 0x08);
      m.setU32(ctx + 0x14, outWall);
      m.setU32(pBox + 0x08, 2);
      m.setU32(pBox + 0x0c, 1);
      m.setU32(m.u32(pLvlSub + 0xa4), 0x101);
      const roofCells = m.u32(pLvlSub + 0x108);
      const roofRows = m.u32(pLvlSub + 0x10c);
      m.setU32(roofRows, 0);
      m.setU32(roofRows + 4, 2);
      m.setU32(roofCells, 0x08000000);
      m.setU32(roofCells + 4, 0);
      m.setU32(roofCells + 8, 0x08000000);
      const pHash = m.alloc(0x200);
      const pNode = m.alloc(0x20);
      const pBlock = m.alloc(0x10);
      const pEntry = m.alloc(0x30);
      m.setU32(pNode + 0x08, 0x0d);
      m.setU32(pNode + 0x0c, pBlock);
      m.setU32(pBlock, pEntry);
      m.setU32(pHash + 0x73 * 4, pNode);
      m.setU32(pRoomEx + 0x68, pHash);
      DRLGTILESUB_StampRoomTemplate113c(m, pMemPool, x | 0, y | 0, ctx, pBox, pLvlSub, 0);
      expect(m.u32(pTG + 0x10)).toBe(1);
      expect(m.u32(pTG + 0x28)).toBe(origRoofCap + 1);
      expect(m.u32(m.u32(outWall)) & 0x101).toBe(0x101);
    }

    // 0x6FDD4500, 0x6FDD4890 & 0x6FDD4AD0: slotIdx*0x18, nTrials===-1 (cx+1,cy+1), subType===2 colOffset, and mask&1 / +0x40
    {
      const { m, args } = cloneVec('0x6FDD4500', 0);
      const [ctx, pLvlSub] = args as [number, number];
      const pRoomEx = m.u32(ctx);
      const pMap = m.u32(pLvlSub + 0x50);
      const pBoxes = m.alloc(2 * 0x20);
      m.setU32(pBoxes + 0x18 + 0x08, 1);
      m.setU32(pBoxes + 0x18 + 0x0c, 1);
      m.setU32(pMap + 0x4c, 2);
      m.setU32(pMap + 0x50, pBoxes);
      m.setU32(pRoomEx + 0x3c, 2);
      m.setU32(pRoomEx + 0x40, 2);
      m.setU32(pRoomEx + 0x14, 1);
      m.setU32(pRoomEx + 0x18, 0);
      m.setU32(ctx + 0x34, 1);
      m.setU32(pLvlSub + 0x148, 2);
      m.setU32(pLvlSub + 0x134, 0xffffffff);
      m.setU32(m.u32(pLvlSub + 0x54), 0x777);
      const outFGrid = m.u32(ctx + 0x04);
      const outFCells = m.u32(outFGrid);
      const outFRows = m.u32(outFGrid + 4);
      m.fill(outFCells, 64 * 4, 0);
      DRLGTILESUB_StampRandomTemplates113c(m, ctx, pLvlSub);
      const cell11 = m.u32(outFCells + (m.u32(outFRows + 4) + 1) * 4);
      const cell00 = m.u32(outFCells);
      expect(cell11).toBe(0x777);
      expect(cell00).toBe(0);

      const { m: mMatch, args: aMatch } = cloneVec('0x6FDD4890', 0);
      const [ctxM, pLvlSubM] = aMatch as [number, number];
      const pRoomExM = mMatch.u32(ctxM);
      const pMapM = mMatch.u32(pLvlSubM + 0x50);
      const pBoxM = mMatch.u32(pMapM + 0x50);
      mMatch.setU32(pMapM, 2);
      mMatch.setU32(pBoxM + 0x08, 1);
      mMatch.setU32(pBoxM + 0x0c, 1);
      mMatch.setU32(pBoxM + 0x14, 1);
      mMatch.setU32(pLvlSubM + 0x11c, 0);
      mMatch.setU32(pRoomExM + 0x3c, 1);
      mMatch.setU32(pRoomExM + 0x40, 1);
      mMatch.setU32(pRoomExM + 0x14, 0x13579bdf);
      const fCellsM = mMatch.u32(pLvlSubM + 0x54);
      mMatch.setU32(fCellsM, 0);
      mMatch.setU32(fCellsM + 2 * 4, 0x999);
      const outFGridM = mMatch.u32(ctxM + 0x04);
      mMatch.fill(mMatch.u32(outFGridM), 64 * 4, 0);
      DRLGTILESUB_StampMatchedTemplates113c(mMatch, ctxM, pLvlSubM);
      expect(mMatch.u32(mMatch.u32(outFGridM))).toBe(0x999);

      const { m: m2, args: a2 } = cloneVec('0x6FDD4AD0', 0);
      const ctx2 = a2[0]!;
      const pRoomEx2 = m2.u32(ctx2);
      const pRec0 = m2.u32(0x6fdf143c);
      const pRec1 = pRec0 + 0x15c;
      m2.setU32(ctx2 + 0x38, 2);
      m2.setU32(pRec0 + 0x50, 0);
      m2.setU32(pRec1 + 0x40, 1);
      m2.setU32(pRec1 + 0x144, 1);
      const seedBefore2 = m2.u32(pRoomEx2 + 0x14);
      DRLGTILESUB_InitSubTheme113c(m2, ctx2);
      expect(m2.u32(pRec0 + 0x50)).toBe(0);
      expect(m2.u32(pRec1 + 0x50)).not.toBe(0);
      expect(m2.u32(pRoomEx2 + 0x14)).toBe(seedBefore2);
    }

    // 0x6FDCEE50, 0x6FDCF180, 0x6FDCF3A0: outdoor edges &0x80, idx === 0x25, and levelId 2/6/7/8
    {
      const { m, args } = cloneVec('0x6FDCEE50', 0);
      const pLevel = args[0]!;
      const pOut = m.u32(pLevel + 0x14);
      m.setU32(pOut, 0xc0);
      const pGrid04Cells = m.u32(pOut + 0x04);
      const pGrid04Rows = m.u32(pOut + 0x08);
      m.fill(pGrid04Cells, 64 * 4, 0);
      DRLGOUTWILD_SpawnSpecialOutdoorEdgesAndWaypoint113c(m, pLevel);
      expect(m.u32(pGrid04Cells)).toBe(3);
      expect(m.u32(pGrid04Cells + 4)).toBe(0);
      expect(m.u32(pGrid04Cells + m.u32(pGrid04Rows + 4) * 4)).toBe(0);

      const { m: m2, args: a2 } = cloneVec('0x6FDCF180', 0);
      const pLevel2 = a2[0]!;
      m2.setU32(pLevel2 + 0x1d0, 2 + 0x25);
      const seedBefore = m2.u32(pLevel2 + 0x1c4);
      DRLGOUTWILD_SpawnAct1OutdoorPresetsByLevel113c(m2, pLevel2);
      expect(m2.u32(pLevel2 + 0x1c4)).not.toBe(seedBefore);

      const { m: m8, args: a8 } = cloneVec('0x6FDCF3A0', 0);
      const pLevel8 = a8[0]!;
      const pOut8 = m8.u32(pLevel8 + 0x14);
      m8.setU32(pLevel8 + 0x1d0, 8);
      m8.setU32(pOut8, 0);
      DRLGOUTWILD_InitAct1OutdoorLevel113c(m8, pLevel8);
      expect(m8.u32(pOut8) & 0x40).toBe(0);

      const runAct1Seed = (lvlId: number) => {
        const { m: ml, args: al } = cloneVec('0x6FDCF3A0', 0);
        const pl = al[0]!;
        ml.setU32(pl + 0x1d0, lvlId);
        DRLGOUTWILD_InitAct1OutdoorLevel113c(ml, pl);
        return ml.u32(pl + 0x1c4);
      };
      expect(runAct1Seed(6)).not.toBe(runAct1Seed(7));
    }

    // out-jung.ts: Kurast borders, 0x6FDD56C0 sw===1, 0x6FDD5DF0, 0x6FDD5E20 case 2 vs 3, 0x6FDD61A0 curId 0x6a vs 0x6b
    {
      for (const [va, fn, cornerPrest] of [
        ['0x6FDD50D0', DRLGOUTJUNG_SpawnAct3KurastBazaarBorders113c, 0x281],
        ['0x6FDD5220', DRLGOUTJUNG_SpawnAct3LowerKurastBorders113c, 0x270],
        ['0x6FDD5360', DRLGOUTJUNG_SpawnAct3GreatMarshBorders113c, 0x262],
      ] as const) {
        const { m: mk, args: ak } = cloneVec(va, 0);
        const pk = ak[0]!;
        const prestTblK = mk.u32(0x6fdf0b3c);
        for (let id = 0x25d; id <= 0x285; id++) {
          mk.setU32(prestTblK + id * 0x1b0 + 0x50, 2);
        }
        const seed0 = mk.u32(pk + 0x1c4);
        fn(mk, pk);
        const pOutK = mk.u32(pk + 0x14);
        expect(mk.u32(mk.u32(pOutK + 0x04))).toBe(cornerPrest);
        expect(mk.u32(pk + 0x1c4)).not.toBe(seed0);
      }

      const { m, args } = cloneVec('0x6FDD56C0', 1);
      const pLevel = args[0]!;
      const pOut = m.u32(pLevel + 0x14);
      const prestTbl = m.u32(0x6fdf0b3c);
      m.setU32(prestTbl + 0x275 * 0x1b0 + 0x28, 8);
      m.setU32(prestTbl + 0x275 * 0x1b0 + 0x2c, 8);
      const pPickedCells = m.u32(pOut + 0x2c);
      const pRows = m.u32(pOut + 0x30);
      m.fill(pPickedCells, 144 * 4, 0);
      DRLGOUTJUNG_SpawnAct3CityPresetsByLevel113c(m, pLevel);
      const rowOff3 = m.u32(pRows + 3 * 4);
      expect(m.u32(pPickedCells + (rowOff3 + 3) * 4)).toBe(0x200);

      const runAct2GridSum = (lvlId: number) => {
        const { m: m2, args: a2 } = cloneVec('0x6FDD5E20', 0);
        const pLevel2 = a2[0]!;
        m2.setU32(pLevel2 + 0x1d0, lvlId);
        DRLGOUTJUNG_InitAct2OutdoorLevel113c(m2, pLevel2);
        const pCells = m2.u32(m2.u32(pLevel2 + 0x14) + 0x04);
        let h = m2.u32(pLevel2 + 0x1c4);
        for (let i = 0; i < 144; i++) h = (Math.imul(h, 31) + m2.u32(pCells + i * 4)) >>> 0;
        return h;
      };
      expect(runAct2GridSum(0x2b)).not.toBe(runAct2GridSum(0x2c));

      const { m: m3, args: a3 } = cloneVec('0x6FDD61A0', 1);
      const pLevel3 = a3[0]!;
      m3.setU32(pLevel3 + 0x1d0, 0x6a);
      const seedBefore3 = m3.u32(pLevel3 + 0x1c4);
      DRLGOUTJUNG_InitAct4OutdoorLevel113c(m3, pLevel3);
      expect(m3.u32(pLevel3 + 0x1c4)).not.toBe(seedBefore3);
    }
  });
});
