import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import { COLLISION_MoveUnitCollisionMask113c } from '../../../src/d2kern-113c/common/collision.ts';
import {
  PATH_AStar_ExpandNodeNeighbors113c,
  PATH_AStar_IsTargetReachableOrHasNoTargetUnit113c,
  PATH_AddUnitCollisionFootprint113c,
  PATH_ComputeSpecialFlag40000Path113c,
  PATH_FindNonCollidingTargetPoint113c,
  PATH_IdaStar_SearchLoop113c,
  PATH_NudgeTargetOutOfImmediateCollision113c,
  PATH_PickStepDirectionCandidate3_113c,
  PATH_RaycastGridLineCollision113c,
  PATH_RemoveUnitCollisionFootprint113c,
  PATH_StopMovementAndSnapToTileCenter113c,
} from '../../../src/d2kern-113c/common/path.ts';
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i10c-2-vectors.ndjson');

function loadVectors(): VectorRecord[] {
  const raw = readFileSync(FIXTURE_PATH, 'utf8').trim();
  return raw.split('\n').map(line => JSON.parse(line) as VectorRecord);
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
      if (!allowedReadBytes.has(b) && raw.u8(b) !== 0) {
        rogueReads.push(b);
      }
    }
  };

  const checkWrite = (addr: number, width: number, newVal: number): void => {
    for (let i = 0; i < width; i++) {
      const b = (addr + i) >>> 0;
      const byteVal = (newVal >>> (i * 8)) & 0xff;
      if (!allowedWriteBytes.has(b) && raw.u8(b) !== byteVal) {
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

const I10C2_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD9D6E0': (m, a) =>
    COLLISION_MoveUnitCollisionMask113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
      a[7]!,
    ) & 0xffff,
  '0x6FD5DC80': (m, a) => {
    PATH_StopMovementAndSnapToTileCenter113c(m, a[0]!);
    return 0;
  },
  '0x6FD686D0': (m, a) => PATH_FindNonCollidingTargetPoint113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD85780': (m, a) => PATH_ComputeSpecialFlag40000Path113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD85800': (m, a) => PATH_RemoveUnitCollisionFootprint113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD859D0': (m, a) => {
    PATH_AddUnitCollisionFootprint113c(m, a[0]!);
    return 0;
  },
  '0x6FD85D40': (m, a) => {
    PATH_NudgeTargetOutOfImmediateCollision113c(m, a[0]!);
    return 0;
  },
  '0x6FDB6C20': (m, a) => PATH_RaycastGridLineCollision113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FDB71B0': (m, a) =>
    PATH_PickStepDirectionCandidate3_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDC08F0': (m, a) => PATH_IdaStar_SearchLoop113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FDCB2C0': (m, a) => PATH_AStar_IsTargetReachableOrHasNoTargetUnit113c(m, a[0]!) >>> 0,
  '0x6FDCB3C0': (m, a) =>
    PATH_AStar_ExpandNodeNeighbors113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
};

function verifyVector(v: VectorRecord, overrideEax?: number, corruptAddr?: number): void {
  const runner = I10C2_RUNNERS[v.va];
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

describe('Lane C I10C-2 real-DLL differential vectors (12 functions)', () => {
  const vectors = loadVectors();

  it('covers all 12 I10C-2 VAs with >= 6 real-DLL vectors each (79 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(vectors.length).toBe(79);
    expect(counts.size).toBe(12);
    for (const va of Object.keys(I10C2_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(6);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case} (${v.note})`, () => {
      verifyVector(v);
    });
  }

  it('negative control: mutating return value or post-memory state is caught for every I10C-2 function', () => {
    for (const va of Object.keys(I10C2_RUNNERS)) {
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

  it('handles assertion paths, null guards, and negative-step branches across I10C-2', () => {
    const mem = new SparseMemory113c();

    // F16 null room move with pat=0 returns 0x27 (39) from COLLISION_CheckSubtileMaskInRoomFast113c
    expect(COLLISION_MoveUnitCollisionMask113c(mem, 0, 10, 10, 12, 12, 0, 0x100, 0x1c01)).toBe(39);

    // F18 & F24 non-player/non-monster unit asserts
    const pInfo = mem.alloc(0x40);
    const pDynPath = mem.alloc(0x80);
    const pUnit = mem.alloc(0x80);
    const pMov = mem.alloc(0x20);
    const pCand = mem.alloc(0x10);
    const pOutDir = mem.alloc(0x10);
    mem.setU32(pInfo + 0x30, pDynPath);
    mem.setU32(pDynPath + 0x30, pUnit);
    mem.setU32(pUnit + 0x00, 2); // object (not 0 or 1)
    expect(() => PATH_FindNonCollidingTargetPoint113c(mem, pInfo, pMov)).toThrow(
      D2CommonAssertError,
    );
    expect(() =>
      PATH_PickStepDirectionCandidate3_113c(mem, pInfo, 100 | (100 << 16), pCand, pOutDir),
    ).toThrow(D2CommonAssertError);

    // F24 cand[2] === 0xff triggers PathMisc.cpp:76 (0x4c) assert when cand[0] and cand[1] fail
    mem.setU32(pUnit + 0x00, 0); // player
    mem.setU32(pInfo + 0x08, 0); // pRoom == 0 so probes return non-zero (blocked)
    mem.setU32(pCand + 0x00, 0);
    mem.setU32(pCand + 0x04, 1);
    mem.setU32(pCand + 0x08, 0xff);
    expect(() =>
      PATH_PickStepDirectionCandidate3_113c(mem, pInfo, 100 | (100 << 16), pCand, pOutDir),
    ).toThrow(D2CommonAssertError);

    // F19 unknown path type throws Path.cpp:519 (0x207) assert
    mem.setU32(pDynPath + 0x3c, 99);
    expect(() => PATH_ComputeSpecialFlag40000Path113c(mem, pDynPath, pUnit)).toThrow(
      D2CommonAssertError,
    );

    // F20 & F21 missile (uType 3) default path with null/non-null pPath
    const pTables = mem.alloc(0x1000);
    mem.setU32(0x6fde9e1c, pTables);
    mem.setU32(pUnit + 0x00, 3); // missile
    mem.setU32(pUnit + 0x2c, 0);
    expect(PATH_RemoveUnitCollisionFootprint113c(mem, pUnit, 0)).toBe(1);
    PATH_AddUnitCollisionFootprint113c(mem, pUnit);
    mem.setU32(pUnit + 0x2c, pDynPath);
    expect(PATH_RemoveUnitCollisionFootprint113c(mem, pUnit, 1)).toBe(1);
    PATH_AddUnitCollisionFootprint113c(mem, pUnit);

    // F22 |dy| >= 5 early return
    mem.setU16(pInfo + 0x00, 100);
    mem.setU16(pInfo + 0x02, 100);
    mem.setU16(pInfo + 0x04, 101);
    mem.setU16(pInfo + 0x06, 95); // dy = -5 -> |dy| >= 5
    PATH_NudgeTargetOutOfImmediateCollision113c(mem, pInfo);
    expect(mem.u16(pInfo + 0x04)).toBe(101);
    expect(mem.u16(pInfo + 0x06)).toBe(95);

    // F23 start == target returns 1; negative step raycast
    const pTargetPt = mem.alloc(0x10);
    mem.setU32(pTargetPt, 100 | (100 << 16));
    expect(PATH_RaycastGridLineCollision113c(mem, pDynPath, 100 | (100 << 16), pTargetPt)).toBe(1);
    // With pRoom == 0, first step fails and writes startPt to *pInOutTargetPoint
    mem.setU32(pDynPath + 0x1c, 0);
    mem.setU32(pTargetPt, 95 | (97 << 16)); // negative dx=-5, dy=-3
    expect(PATH_RaycastGridLineCollision113c(mem, pDynPath, 100 | (100 << 16), pTargetPt)).toBe(0);
    expect(mem.u32(pTargetPt)).toBe(100 | (100 << 16));

    // Setup 20x20 live room for F20/F21/F22/F24/F25/F26 boundary checks
    const pRoom = mem.alloc(0x100);
    const pColl = mem.alloc(0x40);
    const pGrid = mem.alloc(20 * 20 * 2);
    mem.setU32(pRoom + 0x20, pColl);
    mem.setU32(pRoom + 0x4c, 0);
    mem.setU32(pRoom + 0x50, 0);
    mem.setU32(pRoom + 0x54, 20);
    mem.setU32(pRoom + 0x58, 20);
    mem.setU32(pColl + 0x00, 0);
    mem.setU32(pColl + 0x04, 0);
    mem.setU32(pColl + 0x08, 20);
    mem.setU32(pColl + 0x0c, 20);
    mem.setU32(pColl + 0x20, pGrid);

    // F20 & F21 static path (uType = 4 item & uType = 5 tile) uses +0x0c / +0x10 dwords (never +0x02 / +0x06)
    const pStaticRoomPtr = mem.alloc(0x40); // pad before pSP so pSP - 0x0c is 0
    const pSP = mem.alloc(0x40);
    void pStaticRoomPtr;
    mem.setU32(pSP + 0x00, pRoom);
    mem.setU32(pSP + 0x0c, 6); // x = 6
    mem.setU32(pSP + 0x10, 7); // y = 7
    mem.setU32(pUnit + 0x00, 4); // item unit (uType == 4, mask 0x0200, pat 1)
    mem.setU32(pUnit + 0x2c, pSP);
    PATH_AddUnitCollisionFootprint113c(mem, pUnit);
    expect(mem.u16(pGrid + (7 * 20 + 6) * 2) & 0x0200).toBe(0x0200);
    expect(PATH_RemoveUnitCollisionFootprint113c(mem, pUnit, 0)).toBe(1);
    expect(mem.u16(pGrid + (7 * 20 + 6) * 2)).toBe(0);

    // For uType = 5 (tile unit), verify it reads pSP + 0x0c / +0x10 and never reads pSP + 0x02 / +0x06
    mem.setU32(pUnit + 0x00, 5);
    let readDynamicOffsetOnTile = false;
    const tileGuardMem = new Proxy(mem, {
      get(target, prop) {
        if (prop === 'u16') {
          return (p: number) => {
            if ((p >>> 0) === ((pSP + 0x02) >>> 0) || (p >>> 0) === ((pSP + 0x06) >>> 0)) {
              readDynamicOffsetOnTile = true;
            }
            return target.u16(p);
          };
        }
        const v = (target as any)[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    expect(PATH_RemoveUnitCollisionFootprint113c(tileGuardMem, pUnit, 0)).toBe(1);
    expect(readDynamicOffsetOnTile).toBe(false);

    // For uType = 3 (missile unit), verify PATH_AddUnitCollisionFootprint113c reads pDynPath + 0x02 (not pDynPath - 0x02)
    mem.setU32(pUnit + 0x00, 3);
    mem.setU32(pUnit + 0x2c, pDynPath);
    let readWrongDynXOnMissile = false;
    const misGuardMem = new Proxy(mem, {
      get(target, prop) {
        if (prop === 'u16') {
          return (p: number) => {
            if ((p >>> 0) === ((pDynPath - 0x02) >>> 0)) {
              readWrongDynXOnMissile = true;
            }
            return target.u16(p);
          };
        }
        const v = (target as any)[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    PATH_AddUnitCollisionFootprint113c(misGuardMem, pUnit);
    expect(readWrongDynXOnMissile).toBe(false);

    // F22 dx = 2, dy = 0 (adx = 2, ady = 0) nudges targetX from 12 up to 15 (3 steps of +1)
    mem.setU16(pInfo + 0x00, 10);
    mem.setU16(pInfo + 0x02, 10);
    mem.setU16(pInfo + 0x04, 12);
    mem.setU16(pInfo + 0x06, 10);
    mem.setU32(pInfo + 0x08, pRoom);
    mem.setU32(pInfo + 0x28, 1);
    mem.setU32(pInfo + 0x2c, 0x01);
    PATH_NudgeTargetOutOfImmediateCollision113c(mem, pInfo);
    expect(mem.u16(pInfo + 0x04)).toBe(15);
    expect(mem.u16(pInfo + 0x06)).toBe(10);

    // F22 dx = 0, dy = 1 (adx = 0, ady = 1) nudges targetY from 11 up to 15 (4 steps of +1)
    mem.setU16(pInfo + 0x04, 10);
    mem.setU16(pInfo + 0x06, 11);
    PATH_NudgeTargetOutOfImmediateCollision113c(mem, pInfo);
    expect(mem.u16(pInfo + 0x04)).toBe(10);
    expect(mem.u16(pInfo + 0x06)).toBe(15);

    // F22 dx = 5, dy = 0 (adx = 5, ady = 0) early return without nudging
    mem.setU16(pInfo + 0x04, 15);
    mem.setU16(pInfo + 0x06, 10);
    PATH_NudgeTargetOutOfImmediateCollision113c(mem, pInfo);
    expect(mem.u16(pInfo + 0x04)).toBe(15);

    // F24 3 blocked candidates return 0 even if cand[3] is unblocked
    mem.setU32(pUnit + 0x00, 0);
    mem.setU32(pInfo + 0x08, pRoom);
    mem.setU32(pInfo + 0x28, 0);
    mem.setU32(pInfo + 0x2c, 0x01);
    mem.fill(pGrid, 20 * 20 * 2, 0xff);
    mem.setU16(pGrid + (9 * 20 + 10) * 2, 0); // dir 6 = (0, -1) -> (10, 9) is free
    mem.setU32(pCand + 0x00, 0);
    mem.setU32(pCand + 0x04, 2);
    mem.setU32(pCand + 0x08, 4);
    mem.setU32(pCand + 0x0c, 6); // index 3 is unblocked (0, -1) -> (10, 9)
    expect(PATH_PickStepDirectionCandidate3_113c(mem, pInfo, 10 | (10 << 16), pCand, pOutDir)).toBe(
      0,
    );
    mem.fill(pGrid, 20 * 20 * 2, 0);

    // F26 index 0 (tx - 2, ty - 2) = (8, 8) is probed first and short-circuits before probing (8, 12)
    mem.setU32(pDynPath + 0x58, pUnit); // has pTargetUnit
    mem.setU16(pInfo + 0x04, 10);
    mem.setU16(pInfo + 0x06, 10);
    mem.fill(pGrid, 20 * 20 * 2, 0xff);
    mem.setU16(pGrid + (8 * 20 + 8) * 2, 0); // (10 - 2, 10 - 2) = (8, 8) is free
    let probedWrongFirstCell = false;
    const f26GuardMem = new Proxy(mem, {
      get(target, prop) {
        if (prop === 'u16') {
          return (p: number) => {
            if ((p >>> 0) === ((pGrid + (12 * 20 + 8) * 2) >>> 0)) {
              probedWrongFirstCell = true;
            }
            return target.u16(p);
          };
        }
        const v = (target as any)[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    expect(PATH_AStar_IsTargetReachableOrHasNoTargetUnit113c(f26GuardMem, pInfo)).toBe(1);
    expect(probedWrongFirstCell).toBe(false);
    mem.fill(pGrid, 20 * 20 * 2, 0);

    // F25 cx === maxX (exact right bound of IDA* box) does not abort early and reaches target
    const pCtx = mem.alloc(0x37000);
    const pRoot = (pCtx + 0x04) >>> 0;
    mem.setU32(pCtx + 0x00, pRoot);
    mem.setU32(pCtx + 0x6274, 1); // 1 node used
    mem.setU16(pCtx + 0x6278, 2); // minX = 2
    mem.setU16(pCtx + 0x627a, 2); // minY = 2
    mem.setU16(pCtx + 0x627c, 10); // maxX = 10 (cx == 10!)
    mem.setU16(pCtx + 0x627e, 15); // maxY = 15
    mem.setU32(pCtx + 0x6284, 20); // stride = 20
    mem.setU16(pRoot + 0x08, 10); // cx = 10 == maxX
    mem.setU16(pRoot + 0x0a, 10); // cy = 10
    mem.setU32(pRoot + 0x10, 6); // nNextNeighborIndex (+0x10) = dir 6: dx=0, dy=-1 -> (10, 9)
    mem.setU16(pInfo + 0x04, 10); // tx = 10
    mem.setU16(pInfo + 0x06, 9); // ty = 9
    mem.setU8(pInfo + 0x14, 1); // nTargetTypeStatus (+0x14) = 1
    mem.fill(0x6fddb860, 256, 0);
    const foundNode = PATH_IdaStar_SearchLoop113c(mem, pCtx, 100, pInfo);
    expect(foundNode).toBe((pCtx + 0x04 + 0x1c) >>> 0);
  });
});
