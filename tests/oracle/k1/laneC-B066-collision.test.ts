import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COLLISION_CheckCrossPatternCollision113c,
  COLLISION_CheckMaskWithSizeXY113c,
  COLLISION_FindFreeCoordsNear113c,
  COLLISION_GetCrossPatternMask113c,
  COLLISION_GetMask3x3_113c,
  COLLISION_GetMaskAt113c,
  COLLISION_RayTraceBetweenSizedPoints113c,
  COLLISION_ResetMask3x3_113c,
  COLLISION_ResetMaskWithSizeXY113c,
  COLLISION_SetMask3x3_113c,
  COLLISION_SetMaskWithPattern113c,
  COLLISION_SetMaskWithSizeXY113c,
} from '../../../src/d2kern-113c/common/collision.ts';
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b066-vectors.ndjson');

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

const B066_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD80730': (m, a) =>
    COLLISION_RayTraceBetweenSizedPoints113c(
      m,
      a[0]!,
      a[1]!,
      a[2]!,
      a[3]!,
      a[4]!,
      a[5]!,
      a[6]!,
      a[7]!,
    ) >>> 0,
  '0x6FD9B510': (m, a) => COLLISION_GetMaskAt113c(m, a[0]!, a[1]!, a[2]!, a[3]!) & 0xffff,
  '0x6FD9B840': (m, a) => {
    COLLISION_SetMaskWithSizeXY113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!);
    return 0;
  },
  '0x6FD9B8F0': (m, a) => {
    COLLISION_SetMask3x3_113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6FD9BAB0': (m, a) => {
    COLLISION_ResetMaskWithSizeXY113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!);
    return 0;
  },
  '0x6FD9BB30': (m, a) => {
    COLLISION_ResetMask3x3_113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6FD9BFC0': (m, a) => {
    COLLISION_SetMaskWithPattern113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!);
    return 0;
  },
  '0x6FD9C080': (m, a) =>
    COLLISION_CheckMaskWithSizeXY113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) & 0xffff,
  '0x6FD9C140': (m, a) =>
    COLLISION_CheckCrossPatternCollision113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FD9C530': (m, a) => COLLISION_GetMask3x3_113c(m, a[0]!, a[1]!, a[2]!, a[3]!) & 0xffff,
  '0x6FD9C5C0': (m, a) =>
    COLLISION_GetCrossPatternMask113c(m, a[0]!, a[1]!, a[2]!, a[3]!) & 0xffff,
  '0x6FD9CB90': (m, a) => {
    COLLISION_FindFreeCoordsNear113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!);
    return 0;
  },
};

function verifyVector(v: VectorRecord, overrideEax?: number, corruptAddr?: number): void {
  const runner = B066_RUNNERS[v.va];
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

describe('Lane C B066 real-DLL differential vectors (collision.ts, 12 functions)', () => {
  const vectors = loadVectors();

  it('covers all 12 B066 VAs with >= 5 real-DLL vectors each (155 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(vectors.length).toBe(155);
    expect(counts.size).toBe(12);
    for (const va of Object.keys(B066_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(5);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case} (${v.note})`, () => {
      verifyVector(v);
    });
  }

  it('negative control: mutating return value or post-memory state is caught for every B066 function', () => {
    for (const va of Object.keys(B066_RUNNERS)) {
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
