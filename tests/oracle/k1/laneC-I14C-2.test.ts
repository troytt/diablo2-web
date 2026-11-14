import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import * as presetMod from '../../../src/d2kern-113c/common/drlg/preset.ts';
import {
  DRLGROOM_BuildRoomGridsAndTiles113c,
  DRLGROOM_DecrementNearRoomsStatus113c,
  DRLGROOM_EnsureRoomAndGetRoom1_113c,
  DRLGROOM_EnsureRoomStatus3_113c,
  DRLGROOM_FreeOrUnloadRoomIfStatus4_113c,
  DRLGROOM_IncrementRoomAndNeighborsStatus113c,
  DRLGROOM_InitAndLinkRoomStatus1_113c,
  DRLGROOM_PropagateRoomStatusIncrement113c,
  DRLGROOM_SetRoomStatus2AndInitIfNear_113c,
  DRLGROOM_SetRoomStatus2IfReady_113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-room.ts';
import {
  DRLGROOMTILE_AddLinkedWarpTileData113c,
  DRLGROOMTILE_AddTileDataToRoomLink113c,
  DRLGROOMTILE_AddWallTileData113c,
  DRLGROOMTILE_BuildOutdoorRoomTileData113c,
  DRLGROOMTILE_FreeRoomResources113c,
  DRLGROOMTILE_InitOutdoorRoomTilesAndWallGrids113c,
  DRLGROOMTILE_InsertOrUpdateTileAtCoord113c,
  DRLGROOMTILE_LinkWarpTileToDoorPreset113c,
  DRLGROOMTILE_PopulateRoomTileGrid113c,
  DRLGROOMTILE_ProcessGridCellTile113c,
  DRLGROOMTILE_UpdateTileData113c,
} from '../../../src/d2kern-113c/common/drlg/room-tile.ts';
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i14c-2-vectors.ndjson');

function loadVectors(): VectorRecord[] {
  return readFileSync(FIXTURE_PATH, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as VectorRecord);
}

const I14C2_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD9A670': (m, a) => { DRLGROOMTILE_InitOutdoorRoomTilesAndWallGrids113c(m, a[0]!); return 0; },
  '0x6FD9A9B0': (m, a) => { DRLGROOMTILE_BuildOutdoorRoomTileData113c(m, a[0]!); return 0; },
  '0x6FDB88B0': (m, a) => { DRLGROOMTILE_FreeRoomResources113c(m, a[0]!, a[1]! | 0); return 0; },
  '0x6FDB8F00': (m, a) => DRLGROOMTILE_AddWallTileData113c(m, a[0]!, a[1]!, a[2]! | 0, a[3]! | 0, a[4]!, a[5]!, a[6]! | 0) >>> 0,
  '0x6FDB91C0': (m, a) => { DRLGROOMTILE_AddLinkedWarpTileData113c(m, a[0]!, a[1]!, a[2]! | 0, a[3]! | 0, a[4]! | 0); return 0; },
  '0x6FDB9360': (m, a) => { DRLGROOMTILE_LinkWarpTileToDoorPreset113c(m, a[0]!, a[1]!, a[2]!, a[3]! | 0); return 0; },
  '0x6FDB9470': (m, a) => DRLGROOMTILE_AddTileDataToRoomLink113c(m, a[0]! | 0, a[1]!, a[2]!, a[3]!, a[4]! | 0, a[5]! | 0) >>> 0,
  '0x6FDB95D0': (m, a) => { DRLGROOMTILE_UpdateTileData113c(m, a[0]! | 0, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]! | 0, a[7]! | 0); return 0; },
  '0x6FDB97C0': (m, a) => { DRLGROOMTILE_InsertOrUpdateTileAtCoord113c(m, a[0]!, a[1]!, a[2]! | 0, a[3]! | 0, a[4]!, a[5]!, a[6]! | 0); return 0; },
  '0x6FDB9820': (m, a) => { DRLGROOMTILE_ProcessGridCellTile113c(m, a[0]!, a[1]!, a[2]!, a[3]! | 0, a[4]! | 0, a[5]! | 0, a[6]! | 0); return 0; },
  '0x6FDB9B50': (m, a) => { DRLGROOMTILE_PopulateRoomTileGrid113c(m, a[0]!, a[1]!, a[2]!, a[3]! | 0, a[4]! | 0, a[5]! | 0); return 0; },
  '0x6FDCBB20': (m, a) => { DRLGROOM_DecrementNearRoomsStatus113c(m, a[0]!, a[1]! | 0); return 0; },
  '0x6FDCBDB0': (m, a) => { DRLGROOM_FreeOrUnloadRoomIfStatus4_113c(m, a[0]!); return 0; },
  '0x6FDCBEE0': (m, a) => { DRLGROOM_EnsureRoomStatus3_113c(m, a[0]!); return 0; },
  '0x6FDCBFA0': (m, a) => { DRLGROOM_PropagateRoomStatusIncrement113c(m, a[0]!, a[1]!, a[2]! | 0); return 0; },
  '0x6FDCC090': (m, a) => { DRLGROOM_IncrementRoomAndNeighborsStatus113c(m, a[0]!, a[1]! | 0); return 0; },
  '0x6FDCC0E0': (m, a) => { DRLGROOM_BuildRoomGridsAndTiles113c(m, a[0]!, a[1]!); return 0; },
  '0x6FDCC270': (m, a) => DRLGROOM_EnsureRoomAndGetRoom1_113c(m, a[0]!) >>> 0,
  '0x6FDCC370': (m, a) => { DRLGROOM_InitAndLinkRoomStatus1_113c(m, a[0]!); return 0; },
  '0x6FDCC3D0': (m, a) => { DRLGROOM_SetRoomStatus2AndInitIfNear_113c(m, a[0]!); return 0; },
  '0x6FDCC470': (m, a) => { DRLGROOM_SetRoomStatus2IfReady_113c(m, a[0]!); return 0; },
};

function verifyVector(v: VectorRecord, overrideEax?: number, corruptAddr?: number): void {
  const runner = I14C2_RUNNERS[v.va];
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

describe('Lane C I14C-2 real-DLL differential vectors (21 functions)', () => {
  const vectors = loadVectors();

  it('covers all 21 I14C-2 VAs with >= 3 real-DLL vectors each', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    expect(counts.size).toBe(21);
    for (const va of Object.keys(I14C2_RUNNERS)) {
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
    const pRoomEx = m.alloc(0x100);
    const pLevel = m.alloc(0x200);
    m.setU32(pRoomEx + 0x58, pLevel);
    expect(() => DRLGROOM_FreeOrUnloadRoomIfStatus4_113c(m, pRoomEx)).toThrow(D2CommonAssertError);
  });

  it('exercises boundary conditions across all 21 I14C-2 functions', () => {
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

    // 0x6FD9A9B0: zero-initialized pTileGrid allocation when +0x54 is 0
    {
      const { m, args } = cloneVec('0x6FD9A9B0', 0);
      const pRoomEx = args[0]!;
      m.setU32(pRoomEx + 0x54, 0);
      DRLGROOMTILE_BuildOutdoorRoomTileData113c(m, pRoomEx);
      expect(m.u32(m.u32(pRoomEx + 0x54))).toBe(0);
    }

    // 0x6FDB8F00: nTileType === 3 and dwFlags === 0 (< 0 vs <= 0) and 0x4000000 vs 0x4000004
    {
      const { m, args } = cloneVec('0x6FDB8F00', 0);
      const [pRoomEx, ppHead, , , , pCache] = args as [number, number, number, number, number, number];
      DRLGROOMTILE_AddWallTileData113c(m, pRoomEx, ppHead, 8, 8, 0, pCache, 3);
      expect(m.u32(m.u32(ppHead) + 0x14) & 0x08).toBe(0);
      DRLGROOMTILE_AddWallTileData113c(m, pRoomEx, ppHead, 8, 8, 0x04, pCache, 3);
      expect(m.u32(m.u32(ppHead) + 0x14) & 0x200).toBe(0);
      DRLGROOMTILE_AddWallTileData113c(m, pRoomEx, ppHead, 8, 8, 0x04000000, pCache, 3);
      expect(m.u32(m.u32(ppHead) + 0x14) & 0x20c).toBe(0x20c);
    }

    // 0x6FDB91C0 & 0x6FDB9360: warp loop +0x24 (seq 4 vs 8 lookup) and door preset linking
    {
      const { m, args } = cloneVec('0x6FDB9360', 0);
      const [pRoomEx] = args as [number, number];
      const pWarp = m.u32(pRoomEx + 0x4c);
      const pRoomTile = m.u32(pWarp + 0x10);
      m.setU32(pRoomTile + 0x24, 1);
      const pEntry = m.u32(pRoomEx + 0xdc);
      m.setU32(pEntry + 0x18, 0);
      m.setU32(pEntry + 0x1c, 1);
      // Add specific tile hash entry for orient=0, style=1, seq=4 -> bucket=((4<<1)-0+1)&0x7f = 9
      const origHash = m.u32(pRoomEx + 0x68);
      const pNode = m.alloc(0x20);
      const pBlock = m.alloc(0x10);
      const pSeq4Entry = m.alloc(0x30);
      m.setU32(pSeq4Entry + 0x18, 0);
      m.setU32(pSeq4Entry + 0x1c, 2);
      m.setU32(pNode + 0x00, 1);
      m.setU32(pNode + 0x04, 4);
      m.setU32(pNode + 0x08, 0);
      m.setU32(pNode + 0x0c, pBlock);
      m.setU32(pNode + 0x10, m.u32(origHash + 9 * 4));
      m.setU32(pBlock, pSeq4Entry);
      m.setU32(origHash + 9 * 4, pNode);
      DRLGROOMTILE_AddLinkedWarpTileData113c(m, 0x00100101, pRoomEx, 8, 8, 0);
      const pTG = m.u32(pRoomEx + 0x54);
      expect(m.u32(pTG + 0x0c)).toBe(4);
      expect(m.u32(m.u32(pTG + 0x1c) + 0x18)).toBe(pSeq4Entry);
      expect(m.u32(pWarp + 0x0c)).not.toBe(0);

      const { m: m2, args: a2 } = cloneVec('0x6FDB9360', 0);
      const [pRoomEx2, pTileData2] = a2 as [number, number];
      const pWarp2 = m2.u32(pRoomEx2 + 0x4c);
      m2.setU32(m2.u32(pWarp2 + 0x10) + 0x24, 1);
      DRLGROOMTILE_LinkWarpTileToDoorPreset113c(m2, pRoomEx2, pTileData2, 0x00100101, 1);
      const newTile = m2.u32(pWarp2 + 0x14);
      expect(newTile).not.toBe(0);
      expect(m2.u32(newTile + 0x0c)).toBe(m2.u32(pTileData2 + 0x0c));

      const { m: m3, args: a3 } = cloneVec('0x6FDB9360', 0);
      const [pRoomEx3, pTileData3] = a3 as [number, number];
      const pWarp3 = m3.u32(pRoomEx3 + 0x4c);
      const pWarpTxt3 = m3.alloc(0x40);
      m3.setU32(pWarpTxt3, 0);
      m3.setU8(pWarpTxt3 + 0x2c, 0x62);
      m3.setU32(0x6fdf142c, pWarpTxt3);
      m3.setU32(0x6fdf1430, 1);
      m3.setU32(pTileData3 + 0x08, m3.u32(pRoomEx3 + 0x3c));
      DRLGROOMTILE_LinkWarpTileToDoorPreset113c(m3, pRoomEx3, pTileData3, 0x00100001, 1);
      expect(m3.u32(pWarp3 + 0x0c)).toBe(0);
    }

    // 0x6FDB9470: nTileType === 0 floor link and nX === rx boundary
    {
      const { m, args } = cloneVec('0x6FDB9470', 0);
      const pRoomEx = args[1]!;
      DRLGROOMTILE_AddTileDataToRoomLink113c(m, 0, pRoomEx, 0, 0x00100102, 8, 8);
      const pList = m.u32(m.u32(pRoomEx + 0x54));
      expect(m.u32(pList)).toBe(1);
      expect(m.u32(pList + 4)).not.toBe(0);

      const { m: m2, args: a2 } = cloneVec('0x6FDB9360', 0);
      const pRoomEx2 = a2[0]!;
      const pWarp2 = m2.u32(pRoomEx2 + 0x4c);
      m2.setU32(m2.u32(pWarp2 + 0x10) + 0x24, 1);
      expect(DRLGROOMTILE_AddTileDataToRoomLink113c(m2, 0xa, pRoomEx2, 0, 0x00100101, 8, 8)).not.toBe(0);
    }

    // 0x6FDB95D0 & 0x6FDB97C0: oldType === 3 subTile loop, bSpecialZero, mapped === -1, InsertOrUpdate
    {
      const { m, args } = cloneVec('0x6FDB95D0', 0);
      const [, pTileData, , pRoomEx] = args as [number, number, number, number];
      m.setU32(pTileData + 0x1c, 3);
      const pSub = m.alloc(0x30);
      m.setU32(pTileData + 0x20, pSub);
      DRLGROOMTILE_UpdateTileData113c(m, 1, pTileData, 0, pRoomEx, pRoomEx, 0x80, 8, 8);
      expect(m.u32(pSub + 0x14) & 0x08).toBe(0x08);

      m.setU32(pTileData + 0x1c, 0);
      const pFakeEntry = m.alloc(0x30);
      m.setU32(pFakeEntry + 0x18, 0x1e);
      m.setU32(pFakeEntry + 0x1c, 0);
      m.setU32(pTileData + 0x18, pFakeEntry);
      m.setU32(pTileData + 0x14, 0x100);
      DRLGROOMTILE_UpdateTileData113c(m, 0, pTileData, 0, pRoomEx, pRoomEx, 0x00100180, 8, 8);
      expect(m.u32(pTileData + 0x18)).not.toBe(pFakeEntry);

      m.setU32(pTileData + 0x14, 0);
      m.setU32(pTileData + 0x1c, 1);
      DRLGROOMTILE_UpdateTileData113c(m, 16, pTileData, 0, pRoomEx, pRoomEx, 0, 8, 8);
      expect(m.u32(pTileData + 0x1c)).toBe(16);

      const { m: m2, args: a2 } = cloneVec('0x6FDB97C0', 0);
      const pRoomEx2 = a2[5]!;
      const existing = DRLGROOMTILE_AddTileDataToRoomLink113c(m2, 1, pRoomEx2, 0, 0x00100101, 9, 9);
      m2.setU32(existing + 0x14, 0);
      m2.setU32(existing + 0x1c, 1);
      const pCaller = m2.alloc(0x80);
      const ppNear = m2.alloc(4);
      m2.setU32(ppNear, pRoomEx2);
      m2.setU32(pCaller + 0x08, ppNear);
      m2.setU32(pCaller + 0x2c, 1);
      m2.setU32(pCaller + 0x34, 8);
      m2.setU32(pCaller + 0x38, 8);
      m2.setU32(pCaller + 0x3c, 8);
      m2.setU32(pCaller + 0x40, 8);
      m2.setU32(pCaller + 0x54, m2.u32(pRoomEx2 + 0x54));
      m2.setU32(pCaller + 0x58, m2.u32(pRoomEx2 + 0x58));
      DRLGROOMTILE_InsertOrUpdateTileAtCoord113c(m2, 0, 0, 9, 9, 0, pCaller, 16);
      expect(m2.u32(existing + 0x1c)).toBe(16);
    }

    // 0x6FDB9820 & 0x6FDB9B50: ProcessGridCellTile branches and PopulateRoomTileGrid +0x34
    {
      const { m, args } = cloneVec('0x6FDB9820', 0);
      const pRoomEx = args[2]!;
      const pTG = m.u32(pRoomEx + 0x54);
      m.setU32(pTG + 0x0c, 0);
      DRLGROOMTILE_ProcessGridCellTile113c(m, 0x00800101, 0, pRoomEx, 0xa, 8, 8, 0);
      expect(m.u32(pTG + 0x0c)).toBe(0);

      DRLGROOMTILE_ProcessGridCellTile113c(m, 0x00100101, 0, pRoomEx, 1, 8, 8, 0);
      expect(m.u32(pTG + 0x0c)).toBe(0);
      expect(m.u32(pTG + 0x08)).toBe(1);

      m.setU32(pTG, 0);
      DRLGROOMTILE_ProcessGridCellTile113c(m, 0x09e00204, 0, pRoomEx, 0, 8, 8, 0);
      expect(m.u32(pTG)).not.toBe(0);

      // tileType === 8 with nLevelId=28, dir=7, seq=0 spawns warp preset unit without setting 0x800000
      m.setU32(m.u32(pRoomEx + 0x58) + 0x1d0, 28);
      m.setU32(pRoomEx + 0x5c, 0);
      m.setU32(pRoomEx + 0x28, 0);
      DRLGROOMTILE_ProcessGridCellTile113c(m, 0x80700001, 0, pRoomEx, 8, 8, 8, 0);
      expect(m.u32(pRoomEx + 0x5c)).not.toBe(0);
      expect(m.u32(pRoomEx + 0x28) & 0x800000).toBe(0);

      const { m: m2, args: a2 } = cloneVec('0x6FDB9360', 0);
      const pRoomEx2 = a2[0]!;
      const pWarpArr = m2.u32(m2.u32(m2.u32(pRoomEx2 + 0x58) + 0x1b4) + 0x90) + 0x24;
      m2.setU32(pWarpArr + 4, 10);
      const pWarpTxt2 = m2.alloc(0x40);
      m2.setU32(pWarpTxt2, 10);
      m2.setU8(pWarpTxt2 + 0x2c, 0x62);
      m2.setU32(0x6fdf142c, pWarpTxt2);
      m2.setU32(0x6fdf1430, 1);
      DRLGROOMTILE_ProcessGridCellTile113c(m2, 0x80100102, 0, pRoomEx2, 10, 8, 8, 0);
      expect(m2.u32(m2.u32(pRoomEx2 + 0x54) + 0x0c)).toBe(0);
      expect(m2.u32(pRoomEx2 + 0x5c)).not.toBe(0);

      const { m: m3, args: a3 } = cloneVec('0x6FDB9B50', 0);
      const [pRoomEx3, pGrid1, pGrid2] = a3 as [number, number, number];
      m3.setU32(pRoomEx3 + 0x34, 10);
      m3.setU32(pRoomEx3 + 0x38, 20);
      DRLGROOMTILE_PopulateRoomTileGrid113c(m3, pRoomEx3, pGrid1, pGrid2, 0, 1, 1);
      const pTG3 = m3.u32(pRoomEx3 + 0x54);
      const pTile3 = m3.u32(pTG3 + 0x0c) > 0 ? m3.u32(pTG3 + 0x1c) : m3.u32(pTG3 + 0x14);
      expect(m3.u32(pTile3 + 0x04)).toBe(1280);
    }

    // drlg-room.ts status transitions (0x6FDCBB20..0x6FDCC470)
    {
      const { m, args } = cloneVec('0x6FDCBB20', 0);
      const pRoomEx = args[0]!;
      const pNear = m.u32(pRoomEx + 0x08);
      const pOther = m.u32(pNear);
      m.setU8(pOther + 0x44, 0);
      m.setU16(pOther + 0x0c, 1);
      m.setU16(pOther + 0x12, 2);
      DRLGROOM_DecrementNearRoomsStatus113c(m, pRoomEx, 0);
      expect(m.u8(pOther + 0x44)).toBe(3);

      // st === 3 boundary: must not recurse to st = 4
      const pOtherSub = m.alloc(0x100);
      const ppNearSub = m.alloc(4);
      m.setU32(ppNearSub, pOtherSub);
      m.setU32(pOther + 0x08, ppNearSub);
      m.setU32(pOther + 0x2c, 1);
      m.setU16(pOtherSub + 0x14, 0x7777);
      DRLGROOM_DecrementNearRoomsStatus113c(m, pRoomEx, 3);
      expect(m.u16(pOtherSub + 0x14)).toBe(0x7777);

      const { m: m2, args: a2 } = cloneVec('0x6FDCBDB0', 1);
      const pRoomEx2 = a2[0]!;
      const pDrlg2 = m2.u32(m2.u32(pRoomEx2 + 0x58) + 0x1b4);
      m2.setU8(pDrlg2 + 0x8c, 1);
      m2.setU32(pRoomEx2 + 0x28, 0x100000);
      DRLGROOM_FreeOrUnloadRoomIfStatus4_113c(m2, pRoomEx2);
      expect(m2.u32(pRoomEx2 + 0x28) & 0x100000).toBe(0);
      expect(m2.u32(pDrlg2 + 0x468)).toBe(1);

      const { m: m3, args: a3 } = cloneVec('0x6FDCBEE0', 0);
      const pRoomEx3 = a3[0]!;
      m3.setU8(pRoomEx3 + 0x44, 3);
      DRLGROOM_EnsureRoomStatus3_113c(m3, pRoomEx3);
      expect(m3.u32(pRoomEx3 + 0xe8)).toBe(0);
      m3.setU32(pRoomEx3 + 0x48, 2);
      m3.setU32(pRoomEx3 + 0x28, 0x01000000);
      // nRoomType == 2 && !(dwFlags & 0x02000000) -> 0x6FD5BF70 DRLGPRESET_LoadPresetRoomMap(pRoomEx).
      const loadSpy = vi.spyOn(presetMod, 'DRLGPRESET_LoadPresetRoomMap113c').mockImplementation(() => {});
      DRLGROOM_EnsureRoomStatus3_113c(m3, pRoomEx3);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(loadSpy.mock.calls[0]![1]).toBe(pRoomEx3);
      m3.setU32(pRoomEx3 + 0x28, 0x03000000);
      DRLGROOM_EnsureRoomStatus3_113c(m3, pRoomEx3);
      expect(loadSpy).toHaveBeenCalledTimes(1);
      loadSpy.mockRestore();

      const { m: m4, args: a4 } = cloneVec('0x6FDCBFA0', 0);
      const pRoomEx4 = a4[1]!;
      const pOther4 = m4.u32(m4.u32(pRoomEx4 + 0x08));
      m4.setU8(pOther4 + 0x44, 4);
      m4.setU16(pOther4 + 0x0c, 0);
      m4.setU16(pOther4 + 0x0e, 1);
      DRLGROOM_PropagateRoomStatusIncrement113c(m4, 0, pRoomEx4, 1);
      expect(m4.u8(pOther4 + 0x44)).toBe(4);
      m4.setU16(pOther4 + 0x0c, 0);
      m4.setU16(pOther4 + 0x0e, 0);
      m4.setU32(pOther4 + 0x30, 1);
      DRLGROOM_PropagateRoomStatusIncrement113c(m4, 0, pRoomEx4, 1);
      expect(m4.u8(pOther4 + 0x44)).toBe(1);

      const { m: m5, args: a5 } = cloneVec('0x6FDCC090', 0);
      const pRoomEx5 = a5[0]!;
      m5.setU32(pRoomEx5 + 0x2c, 0);
      m5.setU8(pRoomEx5 + 0x44, 4);
      m5.setU16(pRoomEx5 + 0x0c + 6, 1);
      DRLGROOM_IncrementRoomAndNeighborsStatus113c(m5, pRoomEx5, 3);
      expect(m5.u8(pRoomEx5 + 0x44)).toBe(4);
      m5.setU16(pRoomEx5 + 0x0c, 0);
      m5.setU16(pRoomEx5 + 0x0e, 0);
      m5.setU16(pRoomEx5 + 0x10, 0);
      m5.setU16(pRoomEx5 + 0x12, 0);
      m5.setU32(pRoomEx5 + 0x28, 0x01000000);
      m5.setU8(pRoomEx5 + 0x44, 4);
      DRLGROOM_IncrementRoomAndNeighborsStatus113c(m5, pRoomEx5, 3);
      expect(m5.u8(pRoomEx5 + 0x44)).toBe(3);
      m5.setU16(pRoomEx5 + 0x0e, 0);
      m5.setU16(pRoomEx5 + 0x10, 0);
      m5.setU16(pRoomEx5 + 0x0c, 0);
      m5.setU8(pRoomEx5 + 0x44, 4);
      DRLGROOM_IncrementRoomAndNeighborsStatus113c(m5, pRoomEx5, 2);
      expect(m5.u8(pRoomEx5 + 0x44)).toBe(2);

      // 0x6FDCC0E0 nType === 0 skips both outdoor (1) and preset (2); 0x6FDCC270 0x02000000 bit mask
      const { m: mBuild, args: aBuild } = cloneVec('0x6FDCC0E0', 0);
      const pRoomExB = aBuild[0]!;
      mBuild.setU32(pRoomExB + 0x48, 0);
      mBuild.setU32(pRoomExB + 0x20, 0);
      DRLGROOM_BuildRoomGridsAndTiles113c(mBuild, pRoomExB, 0);
      expect(mBuild.u32(pRoomExB + 0x28) & 0x100000).toBe(0x100000);

      const { m: mEns, args: aEns } = cloneVec('0x6FDCC270', 0);
      const pRoomExE = aEns[0]!;
      mEns.setU32(pRoomExE + 0x48, 2);
      mEns.setU32(pRoomExE + 0x28, 0x01100004);
      // dwFlags lacks 0x02000000 with nRoomType == 2 -> preset map load (0x6FD5BF70) is reached.
      const ensSpy = vi.spyOn(presetMod, 'DRLGPRESET_LoadPresetRoomMap113c').mockImplementation(() => {});
      DRLGROOM_EnsureRoomAndGetRoom1_113c(mEns, pRoomExE);
      expect(ensSpy).toHaveBeenCalled();
      expect(ensSpy.mock.calls[0]![1]).toBe(pRoomExE);
      ensSpy.mockRestore();

      const { m: m6, args: a6 } = cloneVec('0x6FDCC370', 0);
      const pRoomEx6 = a6[0]!;
      m6.setU32(pRoomEx6 + 0x30, 0x1234);
      m6.setU32(pRoomEx6 + 0x28, 0x01100000);
      m6.setU8(pRoomEx6 + 0x44, 1);
      DRLGROOM_InitAndLinkRoomStatus1_113c(m6, pRoomEx6);
      expect(m6.u32(pRoomEx6 + 0xe8)).toBe(0);

      const { m: m7, args: a7 } = cloneVec('0x6FDCC3D0', 0);
      const pRoomEx7 = a7[0]!;
      const prev = m7.alloc(0x100);
      const next = m7.alloc(0x100);
      m7.setU32(pRoomEx7 + 0x1c, prev);
      m7.setU32(pRoomEx7 + 0xe8, next);
      DRLGROOM_SetRoomStatus2AndInitIfNear_113c(m7, pRoomEx7);
      expect(m7.u32(next + 0x1c)).toBe(prev);
      expect(m7.u32(prev + 0xe8)).toBe(next);

      const { m: m8, args: a8 } = cloneVec('0x6FDCC470', 0);
      const pRoomEx8 = a8[0]!;
      m8.setU8(pRoomEx8 + 0x44, 2);
      m8.setU16(pRoomEx8 + 0x0e, 1);
      DRLGROOM_SetRoomStatus2IfReady_113c(m8, pRoomEx8);
      expect(m8.u8(pRoomEx8 + 0x44)).toBe(2);
      expect(m8.u32(pRoomEx8 + 0xe8)).toBe(0);
    }
  });
});
