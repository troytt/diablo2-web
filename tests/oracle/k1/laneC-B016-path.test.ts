import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PATH_ASTAR_HASH_X_6FDDB458,
  PATH_ASTAR_HASH_Y_6FDDB658,
  PATH_AStar_EvaluateHeuristic113c,
  PATH_AStar_FlushNodeToDynamicPath113c,
  PATH_AStar_PopBestOpenToClosed113c,
  PATH_AStar_PushToOpenAndHash113c,
  PATH_DIR_TURN_RATE_TABLE_6FDE41C8,
  PATH_GetMonsterMoveTestMask113c,
  PATH_GetVelocity113c,
  PATH_IDASTAR_JITTER_TABLE_6FDDB960,
  PATH_IdaStar_AdvanceNeighborIndex113c,
  PATH_IdaStar_FlushNodeToDynamicPath113c,
  PATH_NormalizePrecisionVector113c,
  PATH_OCTILE_DISTANCE_TABLE_6FDE3F20,
  PATH_OctileDistanceWithTable113c,
  PATH_QuantizeDirectionIndex25_113c,
  PATH_SetDirection113c,
  PATH_SetNewDistance113c,
  PATH_SetNumberOfPathPoints113c,
  PATH_SetTargetUnit113c,
  PATH_SetVelocity113c,
  PATH_UpdateOutOfRoomFlag113c,
} from '../../../src/d2kern-113c/common/path.ts';
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'laneC', 'b016-vectors.ndjson');
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

type B016Runner = (mem: Memory113c, args: number[]) => number;

const B016_DISPATCH: Readonly<Record<string, B016Runner>> = {
  '0x6FD84D30': (mem, [pPath]) => PATH_GetVelocity113c(mem, pPath!),
  '0x6FD84D40': (mem, [pPath, nVelocity, szFile, nLine]) => {
    PATH_SetVelocity113c(mem, pPath!, nVelocity!, szFile!, nLine!);
    return 0;
  },
  '0x6FD84E70': (mem, [pPath]) => {
    PATH_UpdateOutOfRoomFlag113c(mem, pPath!);
    return 0;
  },
  '0x6FD84F50': (mem, [pPath, nNewDist]) => {
    PATH_SetNewDistance113c(mem, pPath!, nNewDist!);
    return 0;
  },
  '0x6FD85040': (mem, [pPath, pUnit]) => {
    PATH_SetTargetUnit113c(mem, pPath!, pUnit!);
    return 0;
  },
  '0x6FD85080': (mem, [pPath, nPoints]) => {
    PATH_SetNumberOfPathPoints113c(mem, pPath!, nPoints!);
    return 0;
  },
  '0x6FD850B0': (mem, [pPath, nDir]) => {
    PATH_SetDirection113c(mem, pPath!, nDir!);
    return 0;
  },
  '0x6FD85100': (mem, [pMonsterUnit]) => PATH_GetMonsterMoveTestMask113c(mem, pMonsterUnit!),
  '0x6FD8E110': (mem, [pVecX, pVecY]) => {
    PATH_NormalizePrecisionVector113c(mem, pVecX!, pVecY!);
    return 0;
  },
  '0x6FD8E190': (_mem, [dwStartCoord, dwEndCoord]) =>
    PATH_QuantizeDirectionIndex25_113c(dwStartCoord!, dwEndCoord!),
  '0x6FD8E2B0': (_mem, [dwCoord1, dwCoord2]) =>
    PATH_OctileDistanceWithTable113c(dwCoord1!, dwCoord2!),
  '0x6FDC0650': (mem, [pPathInfo, pNode]) =>
    PATH_IdaStar_FlushNodeToDynamicPath113c(mem, pPathInfo!, pNode!),
  '0x6FDC07E0': (mem, [pContext, pNode]) => {
    PATH_IdaStar_AdvanceNeighborIndex113c(mem, pContext!, pNode!);
    return 0;
  },
  '0x6FDCAB50': (mem, [pPathInfo, pNode]) =>
    PATH_AStar_FlushNodeToDynamicPath113c(mem, pPathInfo!, pNode!),
  '0x6FDCAE20': (mem, [pContext, pNode]) => {
    PATH_AStar_PushToOpenAndHash113c(mem, pContext!, pNode!);
    return 0;
  },
  '0x6FDCAF70': (_mem, [dwCoord1, dwCoord2]) =>
    PATH_AStar_EvaluateHeuristic113c(dwCoord1!, dwCoord2!),
  '0x6FDCB220': (mem, [pContext]) => PATH_AStar_PopBestOpenToClosed113c(mem, pContext!),
};

function verifyVector(rec: VectorRecord, overrideRet?: number, mutatePostAddr?: number): void {
  const runner = B016_DISPATCH[rec.va];
  if (!runner) throw new Error(`Missing B016 runner for ${rec.va}`);
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

describe('Lane C B016 — Real D2Common.dll Differential Replay & Negative Controls (17 functions)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean);
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord);

  it('loads all 17 B016 function VAs with >= 4 real-DLL vectors each (111 vectors total)', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(111);
    const expectedVas = [
      '0x6FD84D30',
      '0x6FD84D40',
      '0x6FD84E70',
      '0x6FD84F50',
      '0x6FD85040',
      '0x6FD85080',
      '0x6FD850B0',
      '0x6FD85100',
      '0x6FD8E110',
      '0x6FD8E190',
      '0x6FD8E2B0',
      '0x6FDC0650',
      '0x6FDC07E0',
      '0x6FDCAB50',
      '0x6FDCAE20',
      '0x6FDCAF70',
      '0x6FDCB220',
    ];
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va);
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const [va, runner] of Object.entries(B016_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte for ${va}`, () => {
      expect(runner).toBeTypeOf('function');
      const fnVectors = vectors.filter(v => v.va === va);
      expect(fnVectors.length).toBeGreaterThan(0);
      for (const rec of fnVectors) {
        verifyVector(rec);
      }
    });
  }

  it('verifies B016 static .rdata tables (0x6FDE41C8, 0x6FDE3F20, 0x6FDDB960, 0x6FDDB458, 0x6FDDB658) byte-for-byte against D2Common.dll', () => {
    const dllPath = path.join(D2_DATA_DIR, 'D2Common.dll');
    expect(fs.existsSync(dllPath)).toBe(true);
    const buf = fs.readFileSync(dllPath);

    // 1. PATH_DIR_TURN_RATE_TABLE_6FDE41C8 at VA 0x6FDE41C8 (64 ints)
    const turnRateOff = 0x6fde41c8 - 0x6fd50000;
    expect(PATH_DIR_TURN_RATE_TABLE_6FDE41C8.length).toBe(64);
    for (let i = 0; i < 64; i++) {
      expect(PATH_DIR_TURN_RATE_TABLE_6FDE41C8[i]).toBe(buf.readInt32LE(turnRateOff + i * 4));
    }

    // 2. PATH_OCTILE_DISTANCE_TABLE_6FDE3F20 at VA 0x6FDE3F20 (64 ints)
    const octileOff = 0x6fde3f20 - 0x6fd50000;
    expect(PATH_OCTILE_DISTANCE_TABLE_6FDE3F20.length).toBe(64);
    for (let i = 0; i < 64; i++) {
      expect(PATH_OCTILE_DISTANCE_TABLE_6FDE3F20[i]).toBe(buf.readInt32LE(octileOff + i * 4));
    }

    // 3. PATH_IDASTAR_JITTER_TABLE_6FDDB960 at VA 0x6FDDB960 (32 ints)
    const jitterOff = 0x6fddb960 - 0x6fd50000;
    expect(PATH_IDASTAR_JITTER_TABLE_6FDDB960.length).toBe(32);
    for (let i = 0; i < 32; i++) {
      expect(PATH_IDASTAR_JITTER_TABLE_6FDDB960[i]).toBe(buf.readInt32LE(jitterOff + i * 4));
    }

    // 4. PATH_ASTAR_HASH_X_6FDDB458 at VA 0x6FDDB458 (128 uints)
    const hashXOff = 0x6fddb458 - 0x6fd50000;
    expect(PATH_ASTAR_HASH_X_6FDDB458.length).toBe(128);
    for (let i = 0; i < 128; i++) {
      expect(PATH_ASTAR_HASH_X_6FDDB458[i]).toBe(buf.readUInt32LE(hashXOff + i * 4));
    }

    // 5. PATH_ASTAR_HASH_Y_6FDDB658 at VA 0x6FDDB658 (128 uints)
    const hashYOff = 0x6fddb658 - 0x6fd50000;
    expect(PATH_ASTAR_HASH_Y_6FDDB658.length).toBe(128);
    for (let i = 0; i < 128; i++) {
      expect(PATH_ASTAR_HASH_Y_6FDDB658[i]).toBe(buf.readUInt32LE(hashYOff + i * 4));
    }
  });

  it('negative control: mutating return value or post-memory state is caught for every B016 function', () => {
    for (const va of Object.keys(B016_DISPATCH)) {
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
