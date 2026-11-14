import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACT5_SUB_PRESET_TABLE_6FDE36A8,
  DRLGGRID_ApplyAllCellFlags113c,
  DRLGGRID_ApplyBorderCellFlags113c,
  DRLGGRID_InitializeGridCells113c,
  DRLGGRID_InitializeGridWindow113c,
  DRLGGRID_OpAnd113c,
  DRLGGRID_OpAndNegated113c,
  DRLGGRID_OpOr113c,
  DRLGGRID_OpOverwrite113c,
  DRLGGRID_OpOverwriteIfZero113c,
  DRLGGRID_OpXor113c,
  DRLGGRID_RasterizeThickLine113c,
  DRLGOUTDOORS_PickPresetFileIndex113c,
  DRLGOUTDOORS_SpawnPresetInGrid113c,
  DRLGOUTROOM_CheckAct5Preset113c,
  DRLGOUTROOM_MapAct5PresetId113c,
  DRLGPRESET_RelinkMapPresetUnitsToRoomEx113c,
  DRLGTILESUB_ApplyRoomTemplateCallbacks113c,
  DRLGTILESUB_CheckRoomTemplateCallbacks113c,
  DRLGTILESUB_MatchRoomTemplate113c,
  DRLGTILESUB_TestStampRoomTemplate113c,
  GAF_GRID_CELL_OPS_6FDEB244,
  SEED_GetLowSeed113c,
  SEED_GetSeeds113c,
  SEED_SetSeeds113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-grid.ts';
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const FIXTURE_PATH = path.join(
  REPO_ROOT,
  'tests',
  'fixtures',
  'oracle',
  'k1',
  'laneC',
  'b013-vectors.ndjson',
);
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
    alloc: size => {
      const ptr = raw.alloc(size);
      spans.push({ start: ptr >>> 0, end: (ptr + size) >>> 0 });
      return ptr;
    },
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

type B013Runner = (mem: Memory113c, args: number[]) => number;

const B013_DISPATCH: Readonly<Record<string, B013Runner>> = {
  '0x6FD5A360': (mem, [pRoomEx]) => {
    DRLGPRESET_RelinkMapPresetUnitsToRoomEx113c(mem, pRoomEx!);
    return 0;
  },
  '0x6FD86710': (mem, [pSeed, pLowSeed, pHighSeed]) => {
    SEED_GetSeeds113c(mem, pSeed!, pLowSeed!, pHighSeed!);
    return 0;
  },
  '0x6FD86720': (mem, [pSeed, nLowSeed, nHighSeed]) => {
    SEED_SetSeeds113c(mem, pSeed!, nLowSeed!, nHighSeed!);
    return 0;
  },
  '0x6FD86730': (mem, [pSeed]) => SEED_GetLowSeed113c(mem, pSeed!),
  '0x6FD867F0': (mem, [pOutGrid, pWindowBox, nRowStride, pBaseCells, pRowOffsets]) => {
    DRLGGRID_InitializeGridWindow113c(
      mem,
      pOutGrid!,
      pWindowBox!,
      nRowStride!,
      pBaseCells!,
      pRowOffsets!,
    );
    return 0;
  },
  '0x6FD86900': (mem, [pOutGrid, pCellsBuf, nWidth, nHeight, pRowOffsetsBuf]) => {
    DRLGGRID_InitializeGridCells113c(
      mem,
      pOutGrid!,
      pCellsBuf!,
      nWidth!,
      nHeight!,
      pRowOffsetsBuf!,
    );
    return 0;
  },
  '0x6FD86A60': (mem, [pGrid, nValue, eFlagOp]) => {
    DRLGGRID_ApplyBorderCellFlags113c(mem, pGrid!, nValue!, eFlagOp!);
    return 0;
  },
  '0x6FD86B10': (mem, [pGrid, nValue, eFlagOp]) => {
    DRLGGRID_ApplyAllCellFlags113c(mem, pGrid!, nValue!, eFlagOp!);
    return 0;
  },
  '0x6FD86BD0': (mem, [pCell, nValue]) => DRLGGRID_OpAndNegated113c(mem, pCell!, nValue!),
  '0x6FD86BE0': (mem, [pCell, nValue]) => DRLGGRID_OpOverwriteIfZero113c(mem, pCell!, nValue!),
  '0x6FD86BF0': (mem, [pCell, nValue]) => {
    DRLGGRID_OpXor113c(mem, pCell!, nValue!);
    return 0;
  },
  '0x6FD86C00': (mem, [pCell, nValue]) => {
    DRLGGRID_OpAnd113c(mem, pCell!, nValue!);
    return 0;
  },
  '0x6FD86C10': (mem, [pCell, nValue]) => {
    DRLGGRID_OpOr113c(mem, pCell!, nValue!);
    return 0;
  },
  '0x6FD86C20': (mem, [pCell, nValue]) => {
    DRLGGRID_OpOverwrite113c(mem, pCell!, nValue!);
    return 0;
  },
  '0x6FD86CD0': (mem, [pSegNode, pClipRect, pGrid, nValue, eFlagOp, nThickness]) => {
    DRLGGRID_RasterizeThickLine113c(
      mem,
      pSegNode!,
      pClipRect!,
      pGrid!,
      nValue!,
      eFlagOp!,
      nThickness!,
    );
    return 0;
  },
  '0x6FD90C20': (mem, [pLevel, nStyle, nSeq]) =>
    DRLGOUTROOM_MapAct5PresetId113c(mem, pLevel!, nStyle!, nSeq!),
  '0x6FD90DB0': (mem, [pLevel, worldX, worldY, curPresetVal, valFloor, valType]) =>
    DRLGOUTROOM_CheckAct5Preset113c(
      mem,
      pLevel!,
      worldX!,
      worldY!,
      curPresetVal!,
      valFloor!,
      valType!,
    ),
  '0x6FD92920': (mem, [nLvlPrestId, pLevel]) =>
    DRLGOUTDOORS_PickPresetFileIndex113c(mem, nLvlPrestId!, pLevel!),
  '0x6FD92A70': (mem, [pLevel, worldX, worldY, nLvlPrestId, nPickedFile, bBorder]) => {
    DRLGOUTDOORS_SpawnPresetInGrid113c(
      mem,
      pLevel!,
      worldX!,
      worldY!,
      nLvlPrestId!,
      nPickedFile!,
      bBorder!,
    );
    return 0;
  },
  '0x6FDD34D0': (mem, [nX, nY, pSubstCtx, pBox, pLvlSub]) =>
    DRLGTILESUB_TestStampRoomTemplate113c(mem, nX!, nY!, pSubstCtx!, pBox!, pLvlSub!),
  '0x6FDD37F0': (mem, [nY, pLvlSub, nX, pSubstCtx, pBox]) =>
    DRLGTILESUB_MatchRoomTemplate113c(mem, nY!, pLvlSub!, nX!, pSubstCtx!, pBox!),
  '0x6FDD3990': (mem, [nOffset, nX, nY, pBox, pSubstCtx, pLvlSub]) => {
    DRLGTILESUB_ApplyRoomTemplateCallbacks113c(
      mem,
      nOffset!,
      nX!,
      nY!,
      pBox!,
      pSubstCtx!,
      pLvlSub!,
    );
    return 0;
  },
  '0x6FDD3B30': (mem, [pSubstCtx, nX, nY, pBox, pLvlSub]) =>
    DRLGTILESUB_CheckRoomTemplateCallbacks113c(mem, pSubstCtx!, nX!, nY!, pBox!, pLvlSub!),
};
function verifyVector(rec: VectorRecord, overrideRet?: number, mutatePostAddr?: number): void {
  const runner = B013_DISPATCH[rec.va];
  if (!runner) throw new Error(`Missing B013 runner for ${rec.va}`);
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
        `${rec.va} ${rec.name} [${rec.caseId}] eax mismatch: got 0x${got.toString(16)}, expected 0x${exp.toString(16)}`,
      );
    }
  }
  if (rogueWrites.length > 0) {
    throw new Error(
      `${rec.va} ${rec.name} [${rec.caseId}] wrote outside tracked blocks at 0x${rogueWrites[0]!.toString(16)}`,
    );
  }
  for (const blk of rec.post) {
    const start = blk.addr >>> 0;
    const len = blk.hex.length >>> 1;
    const actualHex = bytesToHex(raw.readBytes(start, len));
    if (actualHex !== blk.hex) {
      throw new Error(
        `${rec.va} ${rec.name} [${rec.caseId}] post-memory mismatch at 0x${start.toString(16)}: got ${actualHex}, expected ${blk.hex}`,
      );
    }
  }
}

describe('Lane C B013 — Real D2Common.dll Differential Replay & Negative Controls (23 functions)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean);
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord);

  it('loads all 23 B013 function VAs with >= 4 real-DLL vectors each (105 vectors total)', () => {
    expect(vectors.length).toBe(105);
    const expectedVas = Object.keys(B013_DISPATCH);
    expect(expectedVas.length).toBe(23);
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va);
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const [va, runner] of Object.entries(B013_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte for ${va}`, () => {
      expect(runner).toBeTypeOf('function');
      const fnVectors = vectors.filter(v => v.va === va);
      expect(fnVectors.length).toBeGreaterThan(0);
      for (const rec of fnVectors) {
        verifyVector(rec);
      }
    });
  }

  it('verifies B013 static tables (0x6FDEB244 & 0x6FDE36A8) byte-for-byte against D2Common.dll', () => {
    const dllPath = path.join(D2_DATA_DIR, 'D2Common.dll');
    expect(fs.existsSync(dllPath)).toBe(true);
    const buf = fs.readFileSync(dllPath);

    // VA 0x6FDEB244 is in .data section (VA 0x6FDE9000 -> file offset 0x00099000, delta 0)
    const opTblOff = 0x6fdeb244 - 0x6fd50000;
    expect(GAF_GRID_CELL_OPS_6FDEB244.length).toBe(6);
    for (let i = 0; i < 6; i++) {
      expect(GAF_GRID_CELL_OPS_6FDEB244[i]).toBe(buf.readUInt32LE(opTblOff + i * 4));
    }

    // VA 0x6FDE36A8 is in .rdata section (VA 0x6FDD7000 -> file offset 0x00087000, delta 0)
    const act5TblOff = 0x6fde36a8 - 0x6fd50000;
    expect(ACT5_SUB_PRESET_TABLE_6FDE36A8.length).toBe(50);
    for (let i = 0; i < 50; i++) {
      expect(ACT5_SUB_PRESET_TABLE_6FDE36A8[i]).toBe(buf.readInt32LE(act5TblOff + i * 4));
    }
  });

  it('throws on invalid eFlagOp in DRLGGRID_ApplyAllCellFlags113c, Fog_10024 asserts in DRLGOUTROOM_MapAct5PresetId113c, and unknown callback pointers in 0x6FDD3990/0x6FDD3B30', () => {
    const recAll = vectors.find(v => v.va === '0x6FD86B10')!;
    const { mem: memAll } = createGuardedMemory(recAll.pre);
    expect(() => DRLGGRID_ApplyAllCellFlags113c(memAll, recAll.args[0]!, 1, 99)).toThrow(
      /invalid eFlagOp=99/,
    );

    const recMap = vectors.find(v => v.va === '0x6FD90C20')!;
    const { mem: memMap } = createGuardedMemory(recMap.pre);
    expect(() => DRLGOUTROOM_MapAct5PresetId113c(memMap, recMap.args[0]!, 47, 1)).toThrow(
      /^D2Common assertion failed at .*:388$/,
    );
    expect(() => DRLGOUTROOM_MapAct5PresetId113c(memMap, recMap.args[0]!, 48, 25)).toThrow(
      /^D2Common assertion failed at .*:421$/,
    );

    const recApply = vectors.find(
      v => v.va === '0x6FDD3990' && v.caseId === 'spawn_act5_tundra_preset959_gridsize2',
    )!;
    const { raw: rawApply, mem: memApply } = createGuardedMemory(recApply.pre);
    rawApply.setU32((recApply.args[4]! + 0x28) >>> 0, 0xdeadbeef);
    expect(() => B013_DISPATCH['0x6FDD3990']!(memApply, recApply.args)).toThrow(
      /unknown pfMapPresetId=0xdeadbeef/,
    );

    const recCheck = vectors.find(
      v => v.va === '0x6FDD3B30' && v.caseId === 'act5_pfCustomCheck_pass',
    )!;
    const { raw: rawCheck, mem: memCheck } = createGuardedMemory(recCheck.pre);
    rawCheck.setU32((recCheck.args[0]! + 0x24) >>> 0, 0xdeadbeef);
    expect(() => B013_DISPATCH['0x6FDD3B30']!(memCheck, recCheck.args)).toThrow(
      /unknown pfCustomCheck=0xdeadbeef/,
    );
  });

  it('negative control: mutating return value or post-memory state is caught for every B013 function', () => {
    for (const va of Object.keys(B013_DISPATCH)) {
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
