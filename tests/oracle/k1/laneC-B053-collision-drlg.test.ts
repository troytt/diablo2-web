import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COLLISION_CheckAnyCollisionWithBoxRecursively113c,
  COLLISION_CheckSubtileMask113c,
  COLLISION_CheckSubtileMaskInRoomFast113c,
  COLLISION_ClearCrossPatternMask113c,
  COLLISION_ClearMaskForBoundingBoxRecursively113c,
  COLLISION_ClearSubtileMask113c,
  COLLISION_ClearSubtileMaskInRoom113c,
  COLLISION_ClearSubtileMaskInRoom_6FD9BB70_113c,
  COLLISION_GetCombinedMaskForBoxRecursively113c,
  COLLISION_IsPointWithinRoomMargin113c,
  COLLISION_RayTrace113c,
  COLLISION_ReplaceTileSubtileFlagsInRoom113c,
  COLLISION_SetCrossPatternMask113c,
  COLLISION_SetMaskForBoundingBoxRecursively113c,
  COLLISION_SetSubtileMask113c,
  COLLISION_SetSubtileMaskInRoom113c,
  COLLISION_TraceFieldCollision113c,
} from '../../../src/d2kern-113c/common/collision.ts';
import {
  DRLGTILESUB_ApplyNonPresetSubTheme113c,
  DRLGTILESUB_RollSubThemeMask113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-grid.ts';
import {
  DRLGLOGIC_AssignCoordListIndicesAcrossGrid113c,
  DRLGLOGIC_LinkAdjacentRoomCoordListsAtSubtile113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-logic.ts';
import { UNITS_GetMonStats2ComponentChoice113c } from '../../../src/d2kern-113c/common/drlg/out-jung.ts';
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

interface VectorRecord {
  va: string;
  name: string;
  case: number;
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b053-vectors.ndjson');

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
    expect(raw.u32(addr), `post dword at ${k}`).toBe(expected >>> 0);
  }
  for (const [k, preVal] of Object.entries(preMem)) {
    if (!(k in postMem)) {
      const addr = Number(k) >>> 0;
      expect(raw.u32(addr), `unchanged pre dword at ${k}`).toBe(preVal >>> 0);
    }
  }
}

const B053_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD9AD20': (m, a) => COLLISION_RayTrace113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FD9B280': (m, a) => {
    COLLISION_SetMaskForBoundingBoxRecursively113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6FD9B2F0': (m, a) => {
    COLLISION_ClearMaskForBoundingBoxRecursively113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6FD9B360': (m, a) =>
    COLLISION_CheckAnyCollisionWithBoxRecursively113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD9B3F0': (m, a) =>
    COLLISION_GetCombinedMaskForBoxRecursively113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD9B4D0': (m, a) => {
    COLLISION_ClearSubtileMaskInRoom113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6FD9B930': (m, a) => {
    COLLISION_SetSubtileMaskInRoom113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6FD9B970': (m, a) => {
    COLLISION_SetCrossPatternMask113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6FD9BB70': (m, a) => {
    COLLISION_ClearSubtileMaskInRoom_6FD9BB70_113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6FD9BBB0': (m, a) => {
    COLLISION_ClearCrossPatternMask113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6FD9C570': (m, a) =>
    COLLISION_CheckSubtileMaskInRoomFast113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FD9C940': (m, a) => {
    COLLISION_ClearSubtileMask113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6FD9C990': (m, a) => {
    COLLISION_SetSubtileMask113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6FD9C9D0': (m, a) =>
    COLLISION_CheckSubtileMask113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FD9CA20': (m, a) => {
    COLLISION_ReplaceTileSubtileFlagsInRoom113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6FDCE6C0': (m, a) =>
    COLLISION_TraceFieldCollision113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) >>> 0,
  '0x6FDCF490': (m, a) =>
    COLLISION_IsPointWithinRoomMargin113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDD16C0': (m, a) => {
    DRLGLOGIC_LinkAdjacentRoomCoordListsAtSubtile113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6FDD1BC0': (m, a) => {
    DRLGLOGIC_AssignCoordListIndicesAcrossGrid113c(m, a[0]!);
    return 0;
  },
  '0x6FDD3740': (m, a) => DRLGTILESUB_RollSubThemeMask113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FDD3E20': (m, a) => DRLGTILESUB_ApplyNonPresetSubTheme113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FDD4C30': (m, a) => UNITS_GetMonStats2ComponentChoice113c(m, a[0]!, a[1]!) >>> 0,
};

describe('Lane C B053 real-DLL differential vectors (collision, drlg-logic, drlg-grid, out-jung, 22 net-new functions)', () => {
  const vectors = loadVectors();

  it('covers all 22 net-new B053 VAs with >= 4 real-DLL vectors each (250 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(vectors.length).toBe(250);
    expect(counts.size).toBe(22);
    for (const va of Object.keys(B053_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case}`, () => {
      const runner = B053_RUNNERS[v.va];
      expect(runner, `missing runner for ${v.va}`).toBeDefined();
      const raw = new SparseMemory113c();
      const { mem, rogueReads, rogueWrites, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
      const eax = runner!(mem, v.in.args);
      if (v.out.hasRet !== 0) {
        expect(eax >>> 0).toBe(v.out.eax >>> 0);
      }
      expect(rogueReads).toEqual([]);
      expect(rogueWrites).toEqual([]);
      expect(frees).toEqual(v.out.frees);
      assertPostMemory(raw, v.in.mem, v.out.mem);
    });
  }

  it('verifies null-room and out-of-range guard paths across B053 functions', () => {
    const m = new SparseMemory113c();
    m.setU32(0x1000, 10);
    m.setU32(0x1004, 20);
    m.setU32(0x1008, 4);
    m.setU32(0x100c, 4);
    expect(() => COLLISION_SetMaskForBoundingBoxRecursively113c(m, 0, 0x1000, 4)).not.toThrow();
    expect(() => COLLISION_ClearMaskForBoundingBoxRecursively113c(m, 0, 0x1000, 4)).not.toThrow();
    expect(COLLISION_CheckAnyCollisionWithBoxRecursively113c(m, 0, 0x1000, 4)).toBe(1);
    expect(COLLISION_GetCombinedMaskForBoxRecursively113c(m, 0, 0x1000, 4)).toBe(0x27);
    expect(UNITS_GetMonStats2ComponentChoice113c(m, 0, 0)).toBe(0);
    m.setU32(0x2000, 0);
    expect(UNITS_GetMonStats2ComponentChoice113c(m, 0x2000, 0)).toBe(0);
    m.setU32(0x2000, 1);
    expect(UNITS_GetMonStats2ComponentChoice113c(m, 0x2000, 16)).toBe(0);
  });
});

