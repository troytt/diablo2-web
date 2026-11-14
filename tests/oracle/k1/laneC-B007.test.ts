import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PATH_BresenhamLine113c,
  PATH_ClearPrevTargetCoord113c,
  PATH_ComputeSquaredDistance113c,
  PATH_DIRECTION_TABLE_6FDDD470,
  PATH_GetDirectionVector113c,
  PATH_GetDistance113c,
  PATH_GetFootprintCollisionMask113c,
  PATH_GetMaxDistance113c,
  PATH_GetMoveTestCollisionMask113c,
  PATH_GetStepNum113c,
  PATH_GetTargetUnit113c,
  PATH_GetType113c,
  PATH_GetUnitCollisionPattern113c,
  PATH_SetDistance113c,
  PATH_SetMoveTestCollisionMask113c,
  PATH_SetStepNum113c,
  PATH_SetUnitCollisionPattern113c,
  PATH_SimplifyToLines113c,
  PATH_StepVelocity113c,
} from '../../../src/d2kern-113c/common/path.ts';
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'laneC', 'b007-vectors.ndjson');
const D2_DATA_DIR = process.env.D2_DATA_DIR || path.join(os.homedir(), 'd2-data');

interface MemBlock {
  addr: number;
  hex: string;
}

interface VectorRecord {
  va: string;
  name: string;
  caseId: string;
  args: number[];
  pre: MemBlock[];
  eax: number;
  retMask: number;
  post: MemBlock[];
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >>> 1);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

function createGuardedMemory(pre: MemBlock[]): {
  raw: SparseMemory113c;
  mem: Memory113c;
  rogueWrites: number[];
} {
  const raw = new SparseMemory113c();
  const spans: Array<{ start: number; end: number }> = [];
  for (const blk of pre) {
    const start = blk.addr >>> 0;
    const bytes = hexToBytes(blk.hex);
    raw.loadBlock(start, bytes);
    spans.push({ start, end: (start + bytes.length) >>> 0 });
  }
  const rogueWrites: number[] = [];
  const checkWrite = (addr: number, width: number): void => {
    for (let i = 0; i < width; i++) {
      const a = (addr + i) >>> 0;
      if (!spans.some(s => a >= s.start && a < s.end)) {
        rogueWrites.push(a);
      }
    }
  };
  const mem: Memory113c = {
    alloc: size => raw.alloc(size),
    u8: p => raw.u8(p),
    u16: p => raw.u16(p),
    u32: p => raw.u32(p),
    setU8: (p, v) => {
      checkWrite(p, 1);
      raw.setU8(p, v);
    },
    setU16: (p, v) => {
      checkWrite(p, 2);
      raw.setU16(p, v);
    },
    setU32: (p, v) => {
      checkWrite(p, 4);
      raw.setU32(p, v);
    },
    get: (base, f, idx) => raw.get(base, f, idx),
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      checkWrite((base + f.off + idx * width) >>> 0, width);
      raw.set(base, f, v, idx);
    },
    fill: (p, len, v) => {
      checkWrite(p, len);
      raw.fill(p, len, v);
    },
  };
  return { raw, mem, rogueWrites };
}

type B007Runner = (mem: Memory113c, args: number[]) => number;

const B007_DISPATCH: Readonly<Record<string, B007Runner>> = {
  '0x6FD5CEB0': (mem, [pPath, nRate]) => {
    PATH_StepVelocity113c(mem, pPath!, nRate!);
    return 0;
  },
  '0x6FD5CF40': (mem, [x0, y0, x1, y1, pOutPt, pOutDir]) =>
    PATH_GetDirectionVector113c(mem, x0!, y0!, x1!, y1!, pOutPt!, pOutDir!),
  '0x6FD68310': (mem, [pPoints, dwStartPt, pOut, nPoints]) =>
    PATH_SimplifyToLines113c(mem, pPoints!, dwStartPt!, pOut!, nPoints!),
  '0x6FD684C0': (mem, [pOut, dwStartPt, dwEndPt, nMax, pDir]) =>
    PATH_BresenhamLine113c(mem, pOut!, dwStartPt!, dwEndPt!, nMax!, pDir!),
  '0x6FD84580': (_mem, [x1, y1, x2, y2]) => PATH_ComputeSquaredDistance113c(x1!, y1!, x2!, y2!),
  '0x6FD845B0': (mem, [pUnit, nPattern]) => {
    PATH_SetUnitCollisionPattern113c(mem, pUnit!, nPattern!);
    return 0;
  },
  '0x6FD845D0': (mem, [pUnit]) => PATH_GetUnitCollisionPattern113c(mem, pUnit!),
  '0x6FD84690': (mem, [pPath]) => PATH_GetStepNum113c(mem, pPath!),
  '0x6FD846A0': (mem, [pPath, nSteps]) => {
    PATH_SetStepNum113c(mem, pPath!, nSteps!);
    return 0;
  },
  '0x6FD846D0': (mem, [pPath]) => {
    PATH_ClearPrevTargetCoord113c(mem, pPath!);
    return 0;
  },
  '0x6FD84860': (mem, [pPath]) => PATH_GetMaxDistance113c(mem, pPath!),
  '0x6FD84870': (mem, [pPath]) => PATH_GetDistance113c(mem, pPath!),
  '0x6FD84880': (mem, [pPath, nDist]) => {
    PATH_SetDistance113c(mem, pPath!, nDist!);
    return 0;
  },
  '0x6FD848A0': (mem, [pPath]) => PATH_GetType113c(mem, pPath!),
  '0x6FD848B0': (mem, [pPath, nMask]) => {
    PATH_SetMoveTestCollisionMask113c(mem, pPath!, nMask!);
    return 0;
  },
  '0x6FD848C0': (mem, [pPath]) => PATH_GetMoveTestCollisionMask113c(mem, pPath!),
  '0x6FD848D0': (mem, [pPath]) => PATH_GetFootprintCollisionMask113c(mem, pPath!),
  '0x6FD848F0': (mem, [pPath]) => PATH_GetTargetUnit113c(mem, pPath!),
};

function verifyVector(rec: VectorRecord, overrideRet?: number, mutatePostAddr?: number): void {
  const runner = B007_DISPATCH[rec.va];
  if (!runner) throw new Error(`Missing B007 runner for ${rec.va}`);
  const { raw, mem, rogueWrites } = createGuardedMemory(rec.pre);
  const actualRet = overrideRet !== undefined ? overrideRet : runner(mem, rec.args);
  if (mutatePostAddr !== undefined) {
    raw.setU8(mutatePostAddr, raw.u8(mutatePostAddr) ^ 0xff);
  }
  const mask = rec.retMask >>> 0;
  if (mask !== 0) {
    const got = ((actualRet >>> 0) & mask) >>> 0;
    const exp = ((rec.eax >>> 0) & mask) >>> 0;
    if (got !== exp) {
      throw new Error(
        `${rec.va} ${rec.name} [${rec.caseId}] eax mismatch: got 0x${got.toString(16)}, expected 0x${exp.toString(16)}`
      );
    }
  }
  if (rogueWrites.length > 0) {
    throw new Error(
      `${rec.va} ${rec.name} [${rec.caseId}] wrote outside tracked blocks at 0x${rogueWrites[0]!.toString(16)}`
    );
  }
  for (const blk of rec.post) {
    const start = blk.addr >>> 0;
    const len = blk.hex.length >>> 1;
    const actualHex = bytesToHex(raw.readBytes(start, len));
    if (actualHex !== blk.hex) {
      throw new Error(
        `${rec.va} ${rec.name} [${rec.caseId}] post-memory mismatch at 0x${start.toString(16)}: got ${actualHex}, expected ${blk.hex}`
      );
    }
  }
}

describe('Lane C B007 — Real D2Common.dll Differential Replay & Negative Controls (18 functions)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean);
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord);

  it('loads all 18 B007 function VAs with >= 4 real-DLL vectors each (142 vectors total)', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(142);
    const expectedVas = [
      '0x6FD5CEB0',
      '0x6FD5CF40',
      '0x6FD68310',
      '0x6FD684C0',
      '0x6FD84580',
      '0x6FD845B0',
      '0x6FD845D0',
      '0x6FD84690',
      '0x6FD846A0',
      '0x6FD846D0',
      '0x6FD84860',
      '0x6FD84870',
      '0x6FD84880',
      '0x6FD848A0',
      '0x6FD848B0',
      '0x6FD848C0',
      '0x6FD848D0',
      '0x6FD848F0',
    ];
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va);
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const [va, runner] of Object.entries(B007_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte for ${va}`, () => {
      expect(runner).toBeTypeOf('function');
      const fnVectors = vectors.filter(v => v.va === va);
      expect(fnVectors.length).toBeGreaterThan(0);
      for (const rec of fnVectors) {
        verifyVector(rec);
      }
    });
  }

  it('verifies PATH_DIRECTION_TABLE_6FDDD470 (384 ints = 1536B) byte-for-byte against D2Common.dll .rdata at VA 0x6FDDD470', () => {
    const dllPath = path.join(D2_DATA_DIR, 'D2Common.dll');
    expect(fs.existsSync(dllPath)).toBe(true);
    const buf = fs.readFileSync(dllPath);
    // D2Common.dll .rdata starts at RVA 0x8B000, rawPtr 0x8B000 (1:1 RVA mapping)
    const tableOff = 0x6fddd470 - 0x6fd50000;
    expect(PATH_DIRECTION_TABLE_6FDDD470.length).toBe(384);
    for (let i = 0; i < 384; i++) {
      expect(PATH_DIRECTION_TABLE_6FDDD470[i]).toBe(buf.readInt32LE(tableOff + i * 4));
    }
  });

  it('negative control: mutating return value or post-memory state is caught for every B007 function', () => {
    for (const va of Object.keys(B007_DISPATCH)) {
      const rec = vectors.find(v => v.va === va && (v.retMask !== 0 || v.post.length > 0))!;
      expect(rec).toBeDefined();
      if (rec.retMask !== 0) {
        expect(() => verifyVector(rec, (rec.eax ^ 1) >>> 0)).toThrow(/eax mismatch/);
      }
      if (rec.post.length > 0) {
        const firstAddr = rec.post[0]!.addr >>> 0;
        expect(() => verifyVector(rec, undefined, firstAddr)).toThrow(/post-memory mismatch/);
      }
    }
  });
});
