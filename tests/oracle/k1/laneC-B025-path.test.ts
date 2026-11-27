import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PATH_ClearNextRoom113c,
  PATH_ClearPathPointsAndFlag0x20_113c,
  PATH_ForceDirection113c,
  PATH_GetDirection113c,
  PATH_GetFirstPointX113c,
  PATH_GetFirstPointY113c,
  PATH_GetLastPointX113c,
  PATH_GetLastPointY113c,
  PATH_GetNewDirection113c,
  PATH_GetNextRoom113c,
  PATH_GetNumberOfPathPoints113c,
  PATH_GetPathPoints113c,
  PATH_GetPrevTargetX113c,
  PATH_GetPrevTargetY113c,
  PATH_SetAcceleration113c,
  PATH_SetCurrentRoomInvalid113c,
  PATH_SetMaxVelocity113c,
  PATH_SetTargetPos113c,
} from '../../../src/d2kern-113c/common/path.ts';
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

interface VectorRecord {
  va: string;
  case: number;
  note: string;
  in: {
    args: number[];
    mem: Record<string, number>;
  };
  out: {
    eax: number;
    mem: Record<string, number>;
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b025-vectors.ndjson');

function loadVectors(): VectorRecord[] {
  const raw = readFileSync(FIXTURE_PATH, 'utf8').trim();
  return raw.split('\n').map(line => JSON.parse(line) as VectorRecord);
}

function hexKey(addr: number): string {
  return `0x${(addr >>> 0).toString(16).padStart(8, '0')}`;
}

function isByteEntry(memObj: Record<string, number>, addr: number): boolean {
  return hexKey((addr + 1) >>> 0) in memObj || hexKey((addr - 1) >>> 0) in memObj;
}

function createGuardedMemory(
  raw: SparseMemory113c,
  preMem: Record<string, number>,
  postMem: Record<string, number>,
): { mem: Memory113c; rogueWrites: number[] } {
  for (const [k, v] of Object.entries(preMem)) {
    const addr = Number(k) >>> 0;
    if (isByteEntry(preMem, addr)) {
      raw.setU8(addr, v & 0xff);
    } else {
      raw.setU32(addr, v >>> 0);
    }
  }

  const allowedWriteBytes = new Set<number>();
  for (const k of Object.keys(postMem)) {
    const addr = Number(k) >>> 0;
    if (isByteEntry(postMem, addr)) {
      allowedWriteBytes.add(addr);
    } else {
      allowedWriteBytes.add(addr);
      allowedWriteBytes.add((addr + 1) >>> 0);
      allowedWriteBytes.add((addr + 2) >>> 0);
      allowedWriteBytes.add((addr + 3) >>> 0);
    }
  }

  const rogueWrites: number[] = [];
  const checkWrite = (addr: number, width: number): void => {
    for (let i = 0; i < width; i++) {
      const b = (addr + i) >>> 0;
      if (!allowedWriteBytes.has(b)) {
        rogueWrites.push(b);
      }
    }
  };

  const mem: Memory113c = {
    alloc: size => raw.alloc(size),
    u8: p => raw.u8(p),
    u16: p => raw.u16(p),
    u32: p => raw.u32(p),
    setU8: (p, v) => {
      checkWrite(p >>> 0, 1);
      raw.setU8(p, v);
    },
    setU16: (p, v) => {
      checkWrite(p >>> 0, 2);
      raw.setU16(p, v);
    },
    setU32: (p, v) => {
      checkWrite(p >>> 0, 4);
      raw.setU32(p, v);
    },
    get: (base, f, idx) => raw.get(base, f, idx),
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      checkWrite((base + f.off + idx * width) >>> 0, width);
      raw.set(base, f, v, idx);
    },
    fill: (p, len, v) => {
      checkWrite(p >>> 0, len);
      raw.fill(p, len, v);
    },
  };

  return { mem, rogueWrites };
}

function assertPostMemory(raw: SparseMemory113c, postMem: Record<string, number>): void {
  for (const [k, expected] of Object.entries(postMem)) {
    const addr = Number(k) >>> 0;
    if (isByteEntry(postMem, addr)) {
      expect(raw.u8(addr), `post byte at ${k}`).toBe(expected & 0xff);
    } else {
      expect(raw.u32(addr), `post dword at ${k}`).toBe(expected >>> 0);
    }
  }
}

const B025_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6fd84990': (m, a) => {
    PATH_SetCurrentRoomInvalid113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd849d0': (m, a) => {
    PATH_SetTargetPos113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6fd84a00': (m, a) => {
    PATH_ClearNextRoom113c(m, a[0]!);
    return 0;
  },
  '0x6fd84a10': (m, a) => PATH_GetNextRoom113c(m, a[0]!) >>> 0,
  '0x6fd84a40': (m, a) => PATH_GetLastPointY113c(m, a[0]!) >>> 0,
  '0x6fd84a60': (m, a) => PATH_GetLastPointX113c(m, a[0]!) >>> 0,
  '0x6fd84a80': (m, a) => PATH_GetPrevTargetY113c(m, a[0]!) >>> 0,
  '0x6fd84a90': (m, a) => PATH_GetPrevTargetX113c(m, a[0]!) >>> 0,
  '0x6fd84aa0': (m, a) => PATH_GetFirstPointY113c(m, a[0]!) >>> 0,
  '0x6fd84ab0': (m, a) => PATH_GetFirstPointX113c(m, a[0]!) >>> 0,
  '0x6fd84be0': (m, a) => {
    PATH_ForceDirection113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd84c00': (m, a) => PATH_GetNewDirection113c(m, a[0]!) >>> 0,
  '0x6fd84c10': (m, a) => PATH_GetDirection113c(m, a[0]!) >>> 0,
  '0x6fd84c30': (m, a) => PATH_GetPathPoints113c(m, a[0]!, a[1]!) >>> 0,
  '0x6fd84c60': (m, a) => PATH_GetNumberOfPathPoints113c(m, a[0]!) >>> 0,
  '0x6fd84cb0': (m, a) => {
    PATH_ClearPathPointsAndFlag0x20_113c(m, a[0]!);
    return 0;
  },
  '0x6fd84ce0': (m, a) => {
    PATH_SetAcceleration113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd84d10': (m, a) => {
    PATH_SetMaxVelocity113c(m, a[0]!, a[1]!);
    return 0;
  },
};

describe('Lane C B025 real-DLL differential vectors (path.ts, 18 functions)', () => {
  const vectors = loadVectors();

  it('covers all 18 B025 VAs with >= 3 real-DLL vectors each', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(counts.size).toBe(18);
    for (const va of Object.keys(B025_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(3);
    }
  });

  for (const v of vectors) {
    it(`${v.va} case ${v.case} (${v.note})`, () => {
      const runner = B025_RUNNERS[v.va];
      expect(runner, `missing runner for ${v.va}`).toBeDefined();
      const raw = new SparseMemory113c();
      const { mem, rogueWrites } = createGuardedMemory(raw, v.in.mem, v.out.mem);
      const eax = runner!(mem, v.in.args);
      expect(eax >>> 0).toBe(v.out.eax >>> 0);
      expect(rogueWrites).toEqual([]);
      assertPostMemory(raw, v.out.mem);
    });
  }
});
