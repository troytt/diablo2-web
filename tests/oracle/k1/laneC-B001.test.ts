import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DRLG_ISTOWN_CASE_INDEX_6FD7D348,
  DRLG_IsTownLevel113c,
  DUNGEON_CheckLOSDraw113c,
  DUNGEON_FindRoomBySubtileCoordinates113c,
  DUNGEON_GetFloorTilesFromRoom113c,
  DUNGEON_GetLevelIdFromRoom113c,
  DUNGEON_GetPortalLevelBit113c,
  DUNGEON_GetRoomAtPosition113c,
  DUNGEON_IncreaseRoomPlayerCount113c,
  DUNGEON_ToggleHasPortalFlag113c,
} from '../../../src/d2kern-113c/common/dungeon.ts';
import {
  DRLGPRESET_FinalizePopsLocations113c,
  DRLGPRESET_MovePointerAndClear113c,
} from '../../../src/d2kern-113c/common/drlg/preset.ts';
import { DATATBLS_GetLvlPrestTxtRecordFromLevelId113c } from '../../../src/d2kern-113c/tables/lvl-tbls-113c.ts';
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'oracle', 'k1', 'laneC', 'b001-vectors.ndjson');
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

type B001Runner = (mem: Memory113c, args: number[]) => number;

const B001_DISPATCH: Readonly<Record<string, B001Runner>> = {
  '0x6FD51330': (mem, [pRoom, nX, nY]) => DUNGEON_GetRoomAtPosition113c(mem, pRoom!, nX!, nY!),
  '0x6FD59C60': (mem, [pPresetLevel, nPops]) => {
    DRLGPRESET_FinalizePopsLocations113c(mem, pPresetLevel!, nPops!);
    return 0;
  },
  '0x6FD59DD0': (mem, [ppSrc, pDst]) => DRLGPRESET_MovePointerAndClear113c(mem, ppSrc!, pDst!),
  '0x6FD7D320': (_mem, [nLevelId]) => DRLG_IsTownLevel113c(nLevelId!),
  '0x6FD8B6B0': (mem, [pRoom]) => {
    DUNGEON_IncreaseRoomPlayerCount113c(mem, pRoom!);
    return 0;
  },
  '0x6FD8B710': (mem, [pAct, nX, nY]) =>
    DUNGEON_FindRoomBySubtileCoordinates113c(mem, pAct!, nX!, nY!),
  '0x6FD8BB50': (mem, [pRoom, pNumTiles]) =>
    DUNGEON_GetFloorTilesFromRoom113c(mem, pRoom!, pNumTiles!),
  '0x6FD8BC10': (mem, [pAct, bNotHasPortal]) => {
    DUNGEON_ToggleHasPortalFlag113c(mem, pAct!, bNotHasPortal!);
    return 0;
  },
  '0x6FD8BC40': (mem, [nLevelId]) => DUNGEON_GetPortalLevelBit113c(mem, nLevelId!),
  '0x6FD8BDA0': (mem, [pRoom]) => DUNGEON_CheckLOSDraw113c(mem, pRoom!),
  '0x6FD8C000': (mem, [pRoom]) => DUNGEON_GetLevelIdFromRoom113c(mem, pRoom!),
  '0x6FDBC950': (mem, [nLevelId]) => DATATBLS_GetLvlPrestTxtRecordFromLevelId113c(mem, nLevelId!),
};

function verifyVector(rec: VectorRecord, overrideRet?: number, mutatePostAddr?: number): void {
  const runner = B001_DISPATCH[rec.va];
  if (!runner) throw new Error(`Missing B001 runner for ${rec.va}`);
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

describe('Lane C B001 — Real D2Common.dll Differential Replay & Negative Controls (12 functions)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean);
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord);

  it('loads all 12 B001 function VAs with >= 4 real-DLL vectors each (110 vectors total)', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(110);
    const expectedVas = [
      '0x6FD51330',
      '0x6FD59C60',
      '0x6FD59DD0',
      '0x6FD7D320',
      '0x6FD8B6B0',
      '0x6FD8B710',
      '0x6FD8BB50',
      '0x6FD8BC10',
      '0x6FD8BC40',
      '0x6FD8BDA0',
      '0x6FD8C000',
      '0x6FDBC950',
    ];
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va);
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const [va, runner] of Object.entries(B001_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte for ${va}`, () => {
      expect(runner).toBeTypeOf('function');
      const fnVectors = vectors.filter(v => v.va === va);
      expect(fnVectors.length).toBeGreaterThan(0);
      for (const rec of fnVectors) {
        verifyVector(rec);
      }
    });
  }

  it('verifies DRLG_ISTOWN_CASE_INDEX_6FD7D348 byte-for-byte against D2Common.dll at VA 0x6FD7D348', () => {
    const dllPath = path.join(D2_DATA_DIR, 'D2Common.dll');
    expect(fs.existsSync(dllPath)).toBe(true);
    const buf = fs.readFileSync(dllPath);
    // D2Common.dll .text starts at VA 0x6FD51000, file offset 0x1000 (1:1 RVA mapping)
    const jmpTblOff = 0x6fd7d340 - 0x6fd50000;
    expect(buf.readUInt32LE(jmpTblOff)).toBe(0x6fd7d334);
    expect(buf.readUInt32LE(jmpTblOff + 4)).toBe(0x6fd7d33a);

    const caseTblOff = 0x6fd7d348 - 0x6fd50000;
    const dllBytes = new Uint8Array(buf.buffer, buf.byteOffset + caseTblOff, 109);
    expect(Array.from(DRLG_ISTOWN_CASE_INDEX_6FD7D348)).toEqual(Array.from(dllBytes));
  });

  it('negative control: mutating return value or post-memory state is caught for every B001 function', () => {
    for (const va of Object.keys(B001_DISPATCH)) {
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
