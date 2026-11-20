import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

interface VectorRecord {
  va: string;
  name: string;
  case: number;
  note: string;
  retMask: number;
  in: {
    args: number[];
    mem: Record<string, number>;
  };
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
): { mem: Memory113c; rogueReads: number[]; rogueWrites: number[]; frees: number[] } {
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

  const checkRead = (addr: number, width: number): void => {
    for (let i = 0; i < width; i++) {
      const b = (addr + i) >>> 0;
      if (!allowedReadBytes.has(b)) {
        rogueReads.push(b);
      }
    }
  };

  const checkWrite = (addr: number, width: number, _newVal: number): void => {
    for (let i = 0; i < width; i++) {
      const b = (addr + i) >>> 0;
      if (!allowedWriteBytes.has(b)) {
        rogueWrites.push(b);
      }
    }
  };

  const mem: Memory113c & { free: (p: number) => void } = {
    alloc: size => {
      if ((size >>> 0) === 0) return 0;
      const p = raw.alloc(size);
      const aligned = ((size + 3) & ~3) >>> 0;
      for (let i = 0; i < aligned; i++) {
        const b = (p + i) >>> 0;
        allowedReadBytes.add(b);
        allowedWriteBytes.add(b);
      }
      return p;
    },
    free: p => {
      if ((p >>> 0) !== 0) {
        frees.push(p >>> 0);
      }
    },
    u8: p => {
      checkRead(p >>> 0, 1);
      return raw.u8(p);
    },
    u16: p => {
      checkRead(p >>> 0, 2);
      return raw.u16(p);
    },
    u32: p => {
      checkRead(p >>> 0, 4);
      return raw.u32(p);
    },
    setU8: (p, v) => {
      checkWrite(p >>> 0, 1, v & 0xff);
      raw.setU8(p, v);
    },
    setU16: (p, v) => {
      checkWrite(p >>> 0, 2, v & 0xffff);
      raw.setU16(p, v);
    },
    setU32: (p, v) => {
      checkWrite(p >>> 0, 4, v >>> 0);
      raw.setU32(p, v);
    },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      checkRead((base + f.off + idx * width) >>> 0, width);
      return raw.get(base, f, idx);
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      checkWrite((base + f.off + idx * width) >>> 0, width, v >>> 0);
      raw.set(base, f, v, idx);
    },
    fill: (p, len, v) => {
      for (let i = 0; i < len; i++) {
        checkWrite((p + i) >>> 0, 1, v & 0xff);
      }
      raw.fill(p, len, v);
    },
  };

  return { mem, rogueReads, rogueWrites, frees };
}

function assertPostMemory(
  raw: SparseMemory113c,
  preMem: Record<string, number>,
  postMem: Record<string, number>,
): void {
  for (const [k, expected] of Object.entries(postMem)) {
    const addr = Number(k) >>> 0;
    const got = raw.u32(addr) >>> 0;
    const want = expected >>> 0;
    if (got !== want) {
      throw new Error(`post dword mismatch at ${k}: got=${got} want=${want}`);
    }
  }
  for (const [k, preVal] of Object.entries(preMem)) {
    if (!(k in postMem)) {
      const addr = Number(k) >>> 0;
      const got = raw.u32(addr) >>> 0;
      const want = preVal >>> 0;
      if (got !== want) {
        throw new Error(`unchanged pre dword mismatch at ${k}: got=${got} want=${want}`);
      }
    }
  }
}

import {
  PATH_BuildTurnCornersWithFallbackOffset113c,
  PATH_Compute113c,
  PATH_ComputeChargedBoltOrGuidedPath113c,
  PATH_ComputeGuidedStepPath113c,
  PATH_ComputeLeapOrKnockback113c,
  PATH_ComputeMonsterSeekPath113c,
  PATH_ComputeStraightLineWalk113c,
  PATH_IdaStar_ComputePathWithRooms113c,
  PATH_WallFollow_ComputePath113c,
} from '../../../src/d2kern-113c/common/path.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i11c-2-vectors.ndjson');

function loadVectors(): VectorRecord[] {
  const raw = readFileSync(FIXTURE_PATH, 'utf8').trim();
  return raw.split('\n').map(line => JSON.parse(line) as VectorRecord);
}

const I11C2_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD68C40': (m, a) => PATH_WallFollow_ComputePath113c(m, a[0]!) >>> 0,
  '0x6FD86230': (m, a) => PATH_Compute113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FDB77C0': (m, a) => PATH_ComputeStraightLineWalk113c(m, a[0]!) >>> 0,
  '0x6FDB77F0': (m, a) => PATH_ComputeLeapOrKnockback113c(m, a[0]!) >>> 0,
  '0x6FDB7850': (m, a) => PATH_BuildTurnCornersWithFallbackOffset113c(m, a[0]!) >>> 0,
  '0x6FDB78B0': (m, a) => PATH_ComputeGuidedStepPath113c(m, a[0]!) >>> 0,
  '0x6FDB7AD0': (m, a) => PATH_ComputeMonsterSeekPath113c(m, a[0]!) >>> 0,
  '0x6FDB7B70': (m, a) => PATH_ComputeChargedBoltOrGuidedPath113c(m, a[0]!) >>> 0,
  '0x6FDC0E40': (m, a) => PATH_IdaStar_ComputePathWithRooms113c(m, a[0]!) >>> 0,
};

function verifyVector(v: VectorRecord, overrideEax?: number, corruptAddr?: number): void {
  const runner = I11C2_RUNNERS[v.va];
  if (!runner) throw new Error(`missing runner for ${v.va}`);
  const raw = new SparseMemory113c();
  const { mem, rogueReads, rogueWrites, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
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
  assertPostMemory(raw, v.in.mem, v.out.mem);
}

describe('Lane C I11C-2 real-DLL differential vectors (9 functions)', () => {
  const vectors = loadVectors();

  it('covers all 9 I11C-2 VAs with >= 6 real-DLL vectors each (65 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(vectors.length).toBe(65);
    expect(counts.size).toBe(9);
    for (const va of Object.keys(I11C2_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(6);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case} (${v.note})`, () => {
      verifyVector(v);
    });
  }

  it('negative control: mutating return value or post-memory state is caught for every I11C-2 function', () => {
    for (const va of Object.keys(I11C2_RUNNERS)) {
      const sample = vectors.find(
        v => v.va === va && (v.out.hasRet !== 0 || Object.keys(v.out.mem).length > 0),
      )!;
      if (sample.out.hasRet !== 0) {
        expect(() => verifyVector(sample, (sample.out.eax ^ 1) >>> 0)).toThrow(/eax mismatch/);
      }
      const postKeys = Object.keys(sample.out.mem);
      if (postKeys.length > 0) {
        expect(() => verifyVector(sample, undefined, Number(postKeys[0]!) >>> 0)).toThrow(
          /post dword/,
        );
      }
    }
  });

  it('verifies assertion paths and boundary rejections across I11C-2', () => {
    const mem = new SparseMemory113c();

    // F18 (0x6FD68C40) invalid unit type assertion
    const pInfo = mem.alloc(0x40);
    const pPath = mem.alloc(0x200);
    const pUnit = mem.alloc(0x80);
    mem.setU32(pUnit, 2);
    mem.setU32(pPath + 0x30, pUnit);
    mem.setU32(pInfo + 0x30, pPath);
    expect(() => PATH_WallFollow_ComputePath113c(mem, pInfo)).toThrow(D2CommonAssertError);

    // F26 (0x6FD86230) pPath->pUnit != pUnit assertion (0x2e8)
    mem.setU32(pUnit, 0);
    expect(() => PATH_Compute113c(mem, pPath, mem.alloc(0x80), 0)).toThrow(D2CommonAssertError);

    // F26 delta > 0x64 returns 0 and clears path points
    const pRoom = mem.alloc(0x80);
    const pGrid = mem.alloc(0x28);
    const pCells = mem.alloc(200);
    const pNear = mem.alloc(4);
    mem.setU32(pNear, pRoom);
    mem.setU32(pRoom, pNear);
    mem.setU32(pRoom + 0x24, 1);
    mem.setU32(pRoom + 0x20, pGrid);
    mem.setU32(pRoom + 0x4c, 100);
    mem.setU32(pRoom + 0x50, 100);
    mem.setU32(pRoom + 0x54, 10);
    mem.setU32(pRoom + 0x58, 10);
    mem.setU32(pGrid, 100);
    mem.setU32(pGrid + 4, 100);
    mem.setU32(pGrid + 8, 10);
    mem.setU32(pGrid + 12, 10);
    mem.setU32(pGrid + 0x20, pCells);
    mem.setU32(pPath + 0x1c, pRoom);
    mem.setU16(pPath + 0x02, 102);
    mem.setU16(pPath + 0x06, 104);
    mem.setU16(pPath + 0x10, 210);
    mem.setU16(pPath + 0x12, 104);
    expect(PATH_Compute113c(mem, pPath, pUnit, 0)).toBe(0);

    // F26 unmapped dwPathType (e.g. 4) asserts 0x37e
    mem.setU16(pPath + 0x10, 105);
    mem.setU32(pPath + 0x3c, 4);
    mem.setU32(pPath + 0x44, 1);
    mem.setU32(pPath + 0x50, 0x1c01);
    expect(() => PATH_Compute113c(mem, pPath, pUnit, 1)).toThrow(D2CommonAssertError);

    // Helper room covering (100..220, 100..130) for clean F18/F22/F23/F24/F25/F26 branch checks
    const rmMem = new SparseMemory113c();
    // Seed .rdata tables (including full ASTAR_HASH_X/Y[128]) for rmMem from i11c-1 and i11c-2 vectors
    for (let i = 0; i < 128; i++) {
      rmMem.setU32(0x6fddb458 + i * 4, (i * 17) & 0x7f);
      rmMem.setU32(0x6fddb658 + i * 4, (i * 31) & 0x7f);
    }
    const i11c1Raw = readFileSync(resolve(__dirname, '../../fixtures/oracle/k1/i11c-1-vectors.ndjson'), 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as VectorRecord);
    for (const v of [...vectors, ...i11c1Raw]) {
      for (const [k, val] of Object.entries(v.in.mem)) {
        const a = Number(k) >>> 0;
        if (a >= 0x6fd00000) rmMem.setU32(a, val >>> 0);
      }
    }
    const mkRoom = (rx: number, ry: number, rw: number, rh: number): { room: number; grid: number; cells: number } => {
      const room = rmMem.alloc(0x80);
      const grid = rmMem.alloc(0x28);
      const cells = rmMem.alloc(rw * rh * 2 + 16);
      const near = rmMem.alloc(8);
      rmMem.setU32(near, room);
      rmMem.setU32(room, near);
      rmMem.setU32(room + 0x24, 1);
      rmMem.setU32(room + 0x20, grid);
      rmMem.setU32(room + 0x4c, rx);
      rmMem.setU32(room + 0x50, ry);
      rmMem.setU32(room + 0x54, rw);
      rmMem.setU32(room + 0x58, rh);
      rmMem.setU32(grid, rx);
      rmMem.setU32(grid + 4, ry);
      rmMem.setU32(grid + 8, rw);
      rmMem.setU32(grid + 12, rh);
      rmMem.setU32(grid + 0x20, cells);
      return { room, grid, cells };
    };
    const big = mkRoom(100, 100, 220, 220);
    const setCell = (cells: number, rx: number, ry: number, rw: number, x: number, y: number, mask: number): void => {
      rmMem.setU16(cells + ((y - ry) * rw + (x - rx)) * 2, mask);
    };

    // F26 delta == +-100 allowed inside valid room vs delta == +-101 rejected in both X and Y (#69, #70)
    const pU = rmMem.alloc(0x80);
    const pP = rmMem.alloc(0x300);
    rmMem.setU32(pU, 0);
    rmMem.setU32(pU + 0x2c, pP);
    rmMem.setU32(pP + 0x30, pU);
    rmMem.setU32(pP + 0x1c, big.room);
    rmMem.setU32(pP + 0x3c, 7); // straight / seek path
    rmMem.setU32(pP + 0x44, 1);
    rmMem.setU32(pP + 0x48, 1);
    rmMem.setU32(pP + 0x50, 0x1c01);
    rmMem.setU32(pP + 0x54, 0x80);
    rmMem.setU8(pP + 0x90, 80);
    rmMem.setU8(pP + 0x91, 80);
    // +X / -X / +Y / -Y checks from center (205, 205)
    for (const [dx, dy, wantPos] of [
      [101, 0, false],
      [-101, 0, false],
      [0, 101, false],
      [0, -101, false],
      [100, 0, true],
      [-100, 0, true],
      [0, 100, true],
      [0, -100, true],
    ] as const) {
      rmMem.setU16(pP + 0x02, 205);
      rmMem.setU16(pP + 0x06, 205);
      rmMem.setU16(pP + 0x10, 205 + dx);
      rmMem.setU16(pP + 0x12, 205 + dy);
      if (wantPos) {
        expect(PATH_Compute113c(rmMem, pP, pU, 1)).toBeGreaterThan(0);
      } else {
        expect(PATH_Compute113c(rmMem, pP, pU, 1)).toBe(0);
      }
    }

    // F26 dwFlags & 0x800 (#67): target footprint at (105, 110) blocks if 0x800 is clear, passes if 0x800 is set
    const pTarget = rmMem.alloc(0x80);
    const pTargetStatic = rmMem.alloc(0x200);
    rmMem.setU32(pP + 0x4c, 0x80);
    rmMem.setU32(pU, 0);
    rmMem.setU32(pU + 0x10, 1);
    rmMem.setU32(pTarget, 0); // player -> UNITS_GetUnitSizeX113c returns 2 (!== 0)
    rmMem.setU32(pTarget + 0x10, 1); // non-zero animMode so PATH_RemoveUnitCollisionFootprint113c clears footprint
    rmMem.setU32(pTarget + 0x2c, pTargetStatic);
    rmMem.setU32(pTargetStatic + 0x30, pTarget);
    rmMem.setU32(pTargetStatic + 0x1c, big.room);
    rmMem.setU32(pTargetStatic + 0x44, 2);
    rmMem.setU32(pTargetStatic + 0x48, 1); // cross pattern so ResetMaskWithPattern113c clears cell
    rmMem.setU32(pTargetStatic + 0x4c, 0x80); // nFootprintCollisionMask (+0x4c)
    rmMem.setU16(pTargetStatic + 0x02, 105);
    rmMem.setU16(pTargetStatic + 0x06, 110);
    rmMem.setU32(pP + 0x58, pTarget); // pTargetUnit (+0x58)
    rmMem.setU32(pP + 0x48, 0);
    rmMem.setU32(pP + 0x50, 0x1c81);
    rmMem.setU16(pP + 0x02, 104);
    rmMem.setU16(pP + 0x06, 110);
    rmMem.setU16(pP + 0x10, 105);
    rmMem.setU16(pP + 0x12, 110);
    rmMem.setU32(pP + 0x34, 0x4 | 0x1000); // 0x1000 target coll check enabled, 0x800 CLEAR -> fails (0) because (105,110) has 0x80!
    setCell(big.cells, 100, 100, 220, 105, 110, 0x80);
    expect(PATH_Compute113c(rmMem, pP, pU, 1)).toBe(0);
    rmMem.setU32(pP + 0x34, 0x800 | 0x1000); // 0x800 SET -> target footprint (0x80) removed -> target unblocked!
    setCell(big.cells, 100, 100, 220, 105, 110, 0x80);
    expect(PATH_Compute113c(rmMem, pP, pU, 1)).toBe(1);
    setCell(big.cells, 100, 100, 220, 105, 110, 0);
    rmMem.setU32(pP + 0x58, 0);
    rmMem.setU32(pP + 0x48, 1);
    rmMem.setU32(pP + 0x50, 0x1c01);

    // F22 (PATH_ComputeGuidedStepPath113c) straight >= 2-step run to target (#83)
    const gi = rmMem.alloc(0x40);
    const gp = rmMem.alloc(0x300);
    const gu = rmMem.alloc(0x80);
    rmMem.setU32(gu, 1);
    rmMem.setU32(gp + 0x30, gu);
    rmMem.setU32(gp + 0x3c, 2);
    rmMem.setU32(gp + 0x1c, big.room);
    rmMem.setU16(gp, 0x8000);
    rmMem.setU16(gp + 0x02, 110);
    rmMem.setU16(gp + 0x04, 0x8000);
    rmMem.setU16(gp + 0x06, 110);
    rmMem.setU32(gp + 0x48, 0);
    rmMem.setU32(gp + 0x50, 0x1c01);
    rmMem.setU32(gp + 0x7c, 0x400);
    rmMem.setU16(gi, 110);
    rmMem.setU16(gi + 2, 110);
    rmMem.setU16(gi + 4, 116);
    rmMem.setU16(gi + 6, 111);
    rmMem.setU32(gi + 0x08, big.room);
    rmMem.setU32(gi + 0x0c, big.room);
    rmMem.setU32(gi + 0x14, 1);
    rmMem.setU32(gi + 0x18, 10);
    rmMem.setU32(gi + 0x28, 0); // single-cell pattern
    rmMem.setU32(gi + 0x2c, 0x1c01);
    rmMem.setU32(gi + 0x30, gp);
    rmMem.setU32(gp + 0x28, 0);
    rmMem.setU32(gp + 0x24, 5);
    setCell(big.cells, 100, 100, 220, 111, 110, 0x1c01);
    setCell(big.cells, 100, 100, 220, 112, 110, 0x1c01);
    const gPts = PATH_ComputeGuidedStepPath113c(rmMem, gi);
    expect(gPts).toBe(2);
    expect(rmMem.u32(gp + 0x9c + (gPts - 1) * 4)).toBe((116 | (111 << 16)) >>> 0);
    setCell(big.cells, 100, 100, 220, 111, 110, 0);
    setCell(big.cells, 100, 100, 220, 112, 110, 0);

    // F22 (#86): stepBudget === 0 with obstructed LOS returns 0
    setCell(big.cells, 100, 100, 220, 111, 110, 0x1c01);
    rmMem.setU16(gi + 4, 114);
    rmMem.setU16(gi + 6, 110);
    rmMem.setU32(gi + 0x18, 0);
    expect(PATH_ComputeGuidedStepPath113c(rmMem, gi)).toBe(0);

    // F22 (#83, #86 line 4073/4075): rayPt === startPt (blocked at 111,110), octile((110,110),(114,110))=3 === nDistMax=3, stepBudget=0
    rmMem.setU16(gi, 110);
    rmMem.setU16(gi + 2, 110);
    rmMem.setU16(gi + 4, 114);
    rmMem.setU16(gi + 6, 110);
    rmMem.setU32(gi + 0x14, 3);
    rmMem.setU32(gi + 0x18, 0);
    rmMem.setU32(gp + 0x9c, 0);
    expect(PATH_ComputeGuidedStepPath113c(rmMem, gi)).toBe(1);
    expect(rmMem.u32(gp + 0x9c)).toBe((110 | (110 << 16)) >>> 0);
    setCell(big.cells, 100, 100, 220, 111, 110, 0);

    // F22 (#85): 180-deg reversal guard after d1=1, d2=1 (SE -> NW=5): start=(110,110) target=(112,111) (octile > 0)
    setCell(big.cells, 100, 100, 220, 111, 110, 0x1c01);
    setCell(big.cells, 100, 100, 220, 112, 111, 0x1c01);
    setCell(big.cells, 100, 100, 220, 113, 111, 0x1c01);
    rmMem.setU16(gi, 110);
    rmMem.setU16(gi + 2, 110);
    rmMem.setU16(gi + 4, 112);
    rmMem.setU16(gi + 6, 111);
    rmMem.setU32(gi + 0x14, 0);
    rmMem.setU32(gi + 0x18, 10);
    const revPts = PATH_ComputeGuidedStepPath113c(rmMem, gi);
    expect(revPts).toBe(1);
    expect(rmMem.u32(gp + 0x9c)).toBe((112 | (112 << 16)) >>> 0);
    setCell(big.cells, 100, 100, 220, 111, 110, 0);
    setCell(big.cells, 100, 100, 220, 112, 111, 0);
    setCell(big.cells, 100, 100, 220, 113, 111, 0);

    // F24 (PATH_ComputeChargedBoltOrGuidedPath113c): clears dwCurrentPointIdx from 5 -> 0 (#91)
    rmMem.setU32(gp + 0x24, 5);
    rmMem.setU32(gp + 0x28, 0);
    rmMem.setU16(gi, 110);
    rmMem.setU16(gi + 2, 110);
    rmMem.setU16(gi + 4, 114);
    rmMem.setU16(gi + 6, 110);
    rmMem.setU32(gi + 0x14, 1);
    expect(PATH_ComputeChargedBoltOrGuidedPath113c(rmMem, gi)).toBeGreaterThanOrEqual(1);
    expect(rmMem.u32(gp + 0x24)).toBe(0);

    // F23 (PATH_ComputeMonsterSeekPath113c) #87, #89, #90:
    // Partial wall y=105..115 allows A* detour (6 pts) while guided stops at (113,110) (3 pts, remDist=3 === nDistMax=3)
    for (let y = 105; y <= 115; y++) {
      setCell(big.cells, 100, 100, 220, 114, y, 0x1c01);
    }
    setCell(big.cells, 100, 100, 220, 113, 109, 0x1c01);
    setCell(big.cells, 100, 100, 220, 113, 111, 0x1c01);
    setCell(big.cells, 100, 100, 220, 111, 110, 0x1c01);
    rmMem.setU16(gi, 110);
    rmMem.setU16(gi + 2, 110);
    rmMem.setU16(gi + 4, 117);
    rmMem.setU16(gi + 6, 110);
    rmMem.setU32(gi + 0x14, 3); // exact remDist === 3 -> returns 3 early instead of A*'s 6!
    rmMem.setU32(gi + 0x18, 20);
    const seekEarly = PATH_ComputeMonsterSeekPath113c(rmMem, gi);
    expect(seekEarly).toBe(3);

    // F23 #88: full vertical wall at x=114 makes A* return 0, falls back to re-running guided (3)!
    for (let y = 100; y < 320; y++) {
      setCell(big.cells, 100, 100, 220, 114, y, 0x1c01);
    }
    rmMem.setU32(gi + 0x14, 1);
    expect(PATH_ComputeMonsterSeekPath113c(rmMem, gi)).toBe(3);
    for (let y = 100; y < 320; y++) {
      setCell(big.cells, 100, 100, 220, 114, y, 0);
    }
    setCell(big.cells, 100, 100, 220, 113, 109, 0);
    setCell(big.cells, 100, 100, 220, 113, 111, 0);
    setCell(big.cells, 100, 100, 220, 111, 110, 0);

    // F25 (PATH_IdaStar_ComputePathWithRooms113c) #95, #97: r2x === rx and target (130, 125) is beyond +-10 fallback!
    const rA = mkRoom(100, 100, 10, 10);
    const rB = mkRoom(100, 110, 40, 25); // r2x (100) === rx (100), r2w (40) > origW (10) + 10
    const ii = rmMem.alloc(0x40);
    const ip = rmMem.alloc(0x300);
    rmMem.setU16(ii, 102);
    rmMem.setU16(ii + 2, 102);
    rmMem.setU16(ii + 4, 130); // outside rA's padded (90..120) unless rB's w=40 is merged!
    rmMem.setU16(ii + 6, 125); // non-diagonal so IDA* emits >= 2 turn nodes
    rmMem.setU32(ii + 0x08, rA.room);
    rmMem.setU32(ii + 0x0c, rB.room);
    rmMem.setU32(ii + 0x10, 1);
    rmMem.setU32(ii + 0x14, 0);
    rmMem.setU32(ii + 0x18, 0x80);
    rmMem.setU32(ii + 0x1c, 0x80);
    rmMem.setU32(ii + 0x20, 0);
    rmMem.setU32(ii + 0x28, 0);
    rmMem.setU32(ii + 0x2c, 0x1c01);
    rmMem.setU32(ii + 0x30, ip);
    // Connect rA <-> rB via ppRoomsNear so COLLISION sees both rooms
    const nearA = rmMem.alloc(8);
    rmMem.setU32(nearA, rA.room);
    rmMem.setU32(nearA + 4, rB.room);
    rmMem.setU32(rA.room, nearA);
    rmMem.setU32(rA.room + 0x24, 2);
    const nearB = rmMem.alloc(8);
    rmMem.setU32(nearB, rB.room);
    rmMem.setU32(nearB + 4, rA.room);
    rmMem.setU32(rB.room, nearB);
    rmMem.setU32(rB.room + 0x24, 2);
    expect(PATH_IdaStar_ComputePathWithRooms113c(rmMem, ii)).toBeGreaterThan(0);

    // F18 (PATH_WallFollow_ComputePath113c) #65: wfSteps === 0 with stopIdx > 0 returns simplified line points
    const wfp = rmMem.alloc(0x300);
    const wfu = rmMem.alloc(0x80);
    const wfi = rmMem.alloc(0x40);
    rmMem.setU32(wfu, 0);
    rmMem.setU32(wfp + 0x30, wfu);
    rmMem.setU8(wfp + 0x91, 20);
    rmMem.setU16(wfi, 108);
    rmMem.setU16(wfi + 2, 110);
    rmMem.setU16(wfi + 4, 120);
    rmMem.setU16(wfi + 6, 110);
    rmMem.setU32(wfi + 0x08, big.room);
    rmMem.setU32(wfi + 0x0c, big.room);
    rmMem.setU32(wfi + 0x14, 1);
    rmMem.setU32(wfi + 0x28, 0);
    rmMem.setU32(wfi + 0x2c, 0x1c01);
    rmMem.setU32(wfi + 0x30, wfp);
    for (let x = 107; x <= 112; x++) {
      for (let y = 108; y <= 112; y++) {
        setCell(big.cells, 100, 100, 220, x, y, 0x1c01);
      }
    }
    setCell(big.cells, 100, 100, 220, 108, 110, 0);
    setCell(big.cells, 100, 100, 220, 109, 110, 0);
    setCell(big.cells, 100, 100, 220, 110, 110, 0);
    const wfOut = PATH_WallFollow_ComputePath113c(rmMem, wfi);
    expect(wfOut).toBeGreaterThan(0);
    expect(rmMem.u32(wfp + 0x9c)).toBe((110 | (110 << 16)) >>> 0);
  });
});
