import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DRLGOUTPLACE_CheckAct1LinkOverlap113c,
  DRLGOUTPLACE_CheckAct2LinkOverlap113c,
  DRLGOUTPLACE_InitRoomExCoordByDir113c,
  DRLGOUTPLACE_LinkAct1FixedSize113c,
  DRLGOUTPLACE_LinkAct1Rotating113c,
  DRLGOUTPLACE_LinkAct3Jungle113c,
  DRLGOUTPLACE_LinkAct3KurastCauseway113c,
  DRLGOUTPLACE_LinkAct3SpiderForest113c,
  DRLGOUTPLACE_LinkAct4Step113c,
  DRLGOUTPLACE_LinkFromLevelDef113c,
  DRLGOUTPLACE_LinkQuadrant4_113c,
  DRLGOUTPLACE_MarkBorderGridCells113c,
} from '../../../src/d2kern-113c/common/drlg/out-place.ts';
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b022-vectors.ndjson');

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

const B022_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6fd63f30': (m, a) => {
    DRLGOUTPLACE_InitRoomExCoordByDir113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!);
    return 0;
  },
  '0x6fd64900': (m, a) => DRLGOUTPLACE_CheckAct2LinkOverlap113c(m, a[0]!, a[1]!) >>> 0,
  '0x6fd64a00': (m, a) => DRLGOUTPLACE_CheckAct1LinkOverlap113c(m, a[0]!, a[1]!) >>> 0,
  '0x6fd64b00': (m, a) => DRLGOUTPLACE_LinkAct4Step113c(m, a[0]!) >>> 0,
  '0x6fd64d00': (m, a) => DRLGOUTPLACE_LinkAct3KurastCauseway113c(m, a[0]!) >>> 0,
  '0x6fd64e30': (m, a) => DRLGOUTPLACE_LinkAct3SpiderForest113c(m, a[0]!) >>> 0,
  '0x6fd64f90': (m, a) => DRLGOUTPLACE_LinkAct1Rotating113c(m, a[0]!) >>> 0,
  '0x6fd65250': (m, a) => DRLGOUTPLACE_LinkAct1FixedSize113c(m, a[0]!) >>> 0,
  '0x6fd65480': (m, a) => DRLGOUTPLACE_LinkAct3Jungle113c(m, a[0]!) >>> 0,
  '0x6fd65680': (m, a) => DRLGOUTPLACE_LinkQuadrant4_113c(m, a[0]!) >>> 0,
  '0x6fd657d0': (m, a) => DRLGOUTPLACE_LinkFromLevelDef113c(m, a[0]!) >>> 0,
  '0x6fd65840': (m, a) => {
    DRLGOUTPLACE_MarkBorderGridCells113c(m, a[0]!);
    return 0;
  },
};

describe('Lane C B022 real-DLL differential vectors (out-place.ts, 12 functions)', () => {
  const vectors = loadVectors();

  it('covers all 12 B022 VAs with >= 3 real-DLL vectors each', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(counts.size).toBe(12);
    for (const va of Object.keys(B022_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(3);
    }
  });

  for (const v of vectors) {
    it(`${v.va} case ${v.case} (${v.note})`, () => {
      const runner = B022_RUNNERS[v.va];
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
