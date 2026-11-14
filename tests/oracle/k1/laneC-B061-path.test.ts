import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PATH_AStar_ProcessNeighbor113c,
  PATH_ComputeDirection113c,
  PATH_ComputePathChargedBolt113c,
  PATH_ComputeVelocityToNextPoint113c,
  PATH_FaceTowardsCoords113c,
  PATH_GetCollisionPatternForSize113c,
  PATH_IdaStar_AdvanceToNextCandidate113c,
  PATH_IsMonsterDestinationAllowed113c,
  PATH_RecacheRoom113c,
  PATH_ResolveTargetUnitPosition113c,
  UNITS_GetDirectionToCoords113c,
  UNITS_TransferStateMaskDCToRemoved113c,
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b061-vectors.ndjson');

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

const B061_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD5D180': (m, a) => PATH_ComputeDirection113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FD5D240': (m, a) => PATH_ComputeVelocityToNextPoint113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD5D760': (m, a) => {
    PATH_RecacheRoom113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6FD7F910': (m, a) => UNITS_GetDirectionToCoords113c(m, a[0]!, a[1]!, a[2]!) & 0xff,
  '0x6FD844F0': (m, a) => {
    UNITS_TransferStateMaskDCToRemoved113c(m, a[0]!);
    return 0;
  },
  '0x6FD852F0': (m, a) => {
    PATH_FaceTowardsCoords113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6FD85360': (m, a) => PATH_GetCollisionPatternForSize113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD85470': (m, a) => PATH_ResolveTargetUnitPosition113c(m, a[0]!) & 0xff,
  '0x6FD856E0': (m, a) => PATH_IsMonsterDestinationAllowed113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDB6AA0': (m, a) => {
    PATH_ComputePathChargedBolt113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6FDC0840': (m, a) => PATH_IdaStar_AdvanceToNextCandidate113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDCAFB0': (m, a) => PATH_AStar_ProcessNeighbor113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) >>> 0,
};

function verifyVector(v: VectorRecord, overrideEax?: number, corruptAddr?: number): void {
  const runner = B061_RUNNERS[v.va];
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

describe('Lane C B061 real-DLL differential vectors (path.ts, 12 functions)', () => {
  const vectors = loadVectors();

  it('covers all 12 B061 VAs with >= 6 real-DLL vectors each (118 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(vectors.length).toBe(118);
    expect(counts.size).toBe(12);
    for (const va of Object.keys(B061_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(6);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case} (${v.note})`, () => {
      verifyVector(v);
    });
  }

  it('negative control: mutating return value or post-memory state is caught for every B061 function', () => {
    for (const va of Object.keys(B061_RUNNERS)) {
      const sample = vectors.find(v => v.va === va && (v.out.hasRet !== 0 || Object.keys(v.out.mem).length > 0))!;
      if (sample.out.hasRet !== 0) {
        expect(() => verifyVector(sample, (sample.out.eax ^ 1) >>> 0)).toThrow(/eax mismatch/);
      }
      const postKeys = Object.keys(sample.out.mem);
      if (postKeys.length > 0) {
        expect(() => verifyVector(sample, undefined, Number(postKeys[0]!) >>> 0)).toThrow(/post dword/);
      }
    }
  });
});
