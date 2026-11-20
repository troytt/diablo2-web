import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  COLLISION_CheckMaskForBoundingBox113c,
  COLLISION_ClearMaskForBoundingBox113c,
  COLLISION_FillTileSubtilesMask113c,
  COLLISION_SetMaskForBoundingBox113c,
} from '../../../src/d2kern-113c/common/collision.ts';
import {
  DRLGLOGIC_AssignTileDataCoordListPointers113c,
  DRLGLOGIC_FloodFillLogicalCoordGrid113c,
  DRLGLOGIC_MarkFloorTileCells113c,
  DRLGLOGIC_MarkWallTileCells113c,
  DRLGLOGIC_ReplaceRoomCoordListIndex113c,
  FLOOD_DIR_DELTAS_6FDDA80C,
  WALL_FLOOD_ACTION_TABLE_6FDDA794,
  WALL_STYLE_GROUP_TABLE_6FDDA758,
} from '../../../src/d2kern-113c/common/drlg/drlg-logic.ts';
import {
  ACT_LEVEL_THRESHOLDS_6FDE4668,
  DRLG_ComputeLevelRoomsBoundingBox113c,
  DRLG_FindLevelIdAtCoord113c,
  DRLG_GetActNoFromLevelId113c,
  DRLG_GetLevelDefField94_113c,
  DRLG_GetRectTouchDirection113c,
  DRLG_InitActWarpLists113c,
  DRLG_MarkLevelRoomsWithWarpFlag113c,
} from '../../../src/d2kern-113c/common/drlg/drlg.ts';
import {
  DRLGOUTDOORS_ClearOutdoorCellFlag200_113c,
  DRLGOUTDOORS_MapPresetSlotIndex113c,
  DRLGOUTDOORS_SetOutdoorCellFlag200_113c,
  DRLGOUTDOORS_SpawnOutdoorRoomEx113c,
  DRLGOUTDOORS_SpawnRandomOutdoorThemes113c,
  OUTDOOR_THEME_FLAGS_6FDE345C,
} from '../../../src/d2kern-113c/common/drlg/outdoors.ts';
import {
  ENV_CYCLE_ACT3_ECLIPSE_6FDEB1A8,
  ENV_CYCLE_ECLIPSE_6FDEB1F0,
  ENV_CYCLE_NORMAL_6FDEB160,
  ENVIRONMENT_Alloc113c,
  ENVIRONMENT_ApplyCycleColors113c,
  ENVIRONMENT_Init113c,
  ENVIRONMENT_SetCycleIndex113c,
} from '../../../src/d2kern-113c/common/env.ts';
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const FIXTURE_PATH = path.join(
  REPO_ROOT,
  'tests',
  'fixtures',
  'oracle',
  'k1',
  'laneC',
  'b010-vectors.ndjson',
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

type B010Runner = (mem: Memory113c, args: number[]) => number;

const B010_DISPATCH: Readonly<Record<string, B010Runner>> = {
  '0x6FD7D2C0': (mem, [nLevelId]) => DRLG_GetActNoFromLevelId113c(mem, nLevelId!),
  '0x6FD7D3C0': (mem, [pLevel, pMinX, pMinY, pMaxX, pMaxY]) => {
    DRLG_ComputeLevelRoomsBoundingBox113c(mem, pLevel!, pMinX!, pMinY!, pMaxX!, pMaxY!);
    return 0;
  },
  '0x6FD7D420': (mem, [pLevel]) => {
    DRLG_MarkLevelRoomsWithWarpFlag113c(mem, pLevel!);
    return 0;
  },
  '0x6FD7D470': (mem, [pRect1, pRect2]) => DRLG_GetRectTouchDirection113c(mem, pRect1!, pRect2!),
  '0x6FD7D5B0': (mem, [pDrlg, nX, nY]) => DRLG_FindLevelIdAtCoord113c(mem, pDrlg!, nX!, nY!),
  '0x6FD7D850': (mem, [nLevelId]) => DRLG_GetLevelDefField94_113c(mem, nLevelId!),
  '0x6FDCB8D0': (mem, [pDrlg]) => {
    DRLG_InitActWarpLists113c(mem, pDrlg!);
    return 0;
  },
  '0x6FD86FE0': (mem, [pPointNode, pGrid, uFlag]) => {
    ENVIRONMENT_Init113c(mem, pPointNode!, pGrid!, uFlag!);
    return 0;
  },
  '0x6FD87020': (mem, [pGrid, pSegNode, uFlag, eFlagOp, bIncludeEndPoint]) => {
    ENVIRONMENT_Alloc113c(mem, pGrid!, pSegNode!, uFlag!, eFlagOp!, bIncludeEndPoint!);
    return 0;
  },
  '0x6FD87170': (mem, [pEnv]) => {
    ENVIRONMENT_SetCycleIndex113c(mem, pEnv!);
    return 0;
  },
  '0x6FD87570': (mem, [pEnv, nAct]) => {
    ENVIRONMENT_ApplyCycleColors113c(mem, pEnv!, nAct!);
    return 0;
  },
  '0x6FD92270': (mem, [pLevel, nX, nY]) =>
    DRLGOUTDOORS_MapPresetSlotIndex113c(mem, pLevel!, nX!, nY!),
  '0x6FD922A0': (mem, [pLevel, nX, nY]) => {
    DRLGOUTDOORS_SetOutdoorCellFlag200_113c(mem, pLevel!, nX!, nY!);
    return 0;
  },
  '0x6FD922F0': (mem, [pLevel, nX, nY]) => {
    DRLGOUTDOORS_ClearOutdoorCellFlag200_113c(mem, pLevel!, nX!, nY!);
    return 0;
  },
  '0x6FD92370': (mem, [pLevel, nX, nY, nLvlPrestId, nBorder, uFlags]) =>
    DRLGOUTDOORS_SpawnOutdoorRoomEx113c(
      mem,
      pLevel!,
      nX!,
      nY!,
      nLvlPrestId!,
      nBorder!,
      uFlags!,
    ),
  '0x6FD92460': (mem, [pLevel, nMaxSpawns]) => {
    DRLGOUTDOORS_SpawnRandomOutdoorThemes113c(mem, pLevel!, nMaxSpawns!);
    return 0;
  },
  '0x6FD9AB60': (mem, [pColGrid, pBox, wMask]) => {
    COLLISION_SetMaskForBoundingBox113c(mem, pColGrid!, pBox!, wMask!);
    return 0;
  },
  '0x6FD9ABD0': (mem, [pColGrid, pBox, wMask]) => {
    COLLISION_ClearMaskForBoundingBox113c(mem, pColGrid!, pBox!, wMask!);
    return 0;
  },
  '0x6FD9AC40': (mem, [pColGrid, pBox, wMask]) =>
    COLLISION_CheckMaskForBoundingBox113c(mem, pColGrid!, pBox!, wMask!),
  '0x6FD9B560': (mem, [nSubX, nSubY, pColGrid, wMask]) => {
    COLLISION_FillTileSubtilesMask113c(mem, nSubX!, nSubY!, pColGrid!, wMask!);
    return 0;
  },
  '0x6FDD0EE0': (mem, [pRoomEx, nOldIdx, nNewIdx, bNodeFlag]) => {
    DRLGLOGIC_ReplaceRoomCoordListIndex113c(mem, pRoomEx!, nOldIdx!, nNewIdx!, bNodeFlag!);
    return 0;
  },
  '0x6FDD14C0': (mem, [pRoomEx, pGrid]) => {
    DRLGLOGIC_MarkWallTileCells113c(mem, pRoomEx!, pGrid!);
    return 0;
  },
  '0x6FDD1650': (mem, [pRoomEx, pGrid]) => {
    DRLGLOGIC_MarkFloorTileCells113c(mem, pRoomEx!, pGrid!);
    return 0;
  },
  '0x6FDD17A0': (mem, [pContext, nX, nY, nFromDir]) => {
    DRLGLOGIC_FloodFillLogicalCoordGrid113c(mem, pContext!, nX!, nY!, nFromDir!);
    return 0;
  },
  '0x6FDD1A20': (mem, [pRoomEx]) => {
    DRLGLOGIC_AssignTileDataCoordListPointers113c(mem, pRoomEx!);
    return 0;
  },
};
function verifyVector(rec: VectorRecord, overrideRet?: number, mutatePostAddr?: number): void {
  const runner = B010_DISPATCH[rec.va];
  if (!runner) throw new Error(`Missing B010 runner for ${rec.va}`);
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

describe('Lane C B010 — Real D2Common.dll Differential Replay & Negative Controls (25 functions)', () => {
  const lines = fs
    .readFileSync(FIXTURE_PATH, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean);
  const vectors: VectorRecord[] = lines.map(l => JSON.parse(l) as VectorRecord);

  it('loads all 25 B010 function VAs with >= 4 real-DLL vectors each (123 vectors total)', () => {
    expect(vectors.length).toBeGreaterThanOrEqual(123);
    const expectedVas = Object.keys(B010_DISPATCH);
    expect(expectedVas.length).toBe(25);
    for (const va of expectedVas) {
      const fnVectors = vectors.filter(v => v.va === va);
      expect(fnVectors.length, `Insufficient vectors for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const [va, runner] of Object.entries(B010_DISPATCH)) {
    it(`replays real D2Common.dll vectors byte-for-byte for ${va}`, () => {
      expect(runner).toBeTypeOf('function');
      const fnVectors = vectors.filter(v => v.va === va);
      expect(fnVectors.length).toBeGreaterThan(0);
      for (const rec of fnVectors) {
        verifyVector(rec);
      }
    });
  }

  it('verifies B010 static tables (0x6FDE4668, 0x6FDE345C, 0x6FDEB160, 0x6FDEB1A8, 0x6FDEB1F0, 0x6FDDA758, 0x6FDDA794, 0x6FDDA80C) byte-for-byte against D2Common.dll', () => {
    const dllPath = path.join(D2_DATA_DIR, 'D2Common.dll');
    expect(fs.existsSync(dllPath)).toBe(true);
    const buf = fs.readFileSync(dllPath);

    // 1. ACT_LEVEL_THRESHOLDS_6FDE4668 at VA 0x6FDE4668 (.rdata, 6 ints = 24 bytes)
    const actOff = 0x6fde4668 - 0x6fd50000;
    expect(ACT_LEVEL_THRESHOLDS_6FDE4668.length).toBe(6);
    for (let i = 0; i < 6; i++) {
      expect(ACT_LEVEL_THRESHOLDS_6FDE4668[i]).toBe(buf.readInt32LE(actOff + i * 4));
    }

    // 2. OUTDOOR_THEME_FLAGS_6FDE345C at VA 0x6FDE345C (.rdata, 4 uint32s = 16 bytes)
    const outdoorOff = 0x6fde345c - 0x6fd50000;
    expect(OUTDOOR_THEME_FLAGS_6FDE345C.length).toBe(4);
    for (let i = 0; i < 4; i++) {
      expect(OUTDOOR_THEME_FLAGS_6FDE345C[i]).toBe(buf.readUInt32LE(outdoorOff + i * 4));
    }

    // 3. ENV_CYCLE_* tables in .data (VA 0x6FDE9000 -> file offset 0x00099000, delta 0)
    const envTables: Array<[number, Int32Array]> = [
      [0x6fdeb160, ENV_CYCLE_NORMAL_6FDEB160],
      [0x6fdeb1a8, ENV_CYCLE_ACT3_ECLIPSE_6FDEB1A8],
      [0x6fdeb1f0, ENV_CYCLE_ECLIPSE_6FDEB1F0],
    ];
    for (const [va, tbl] of envTables) {
      const off = va - 0x6fd50000;
      expect(tbl.length).toBe(18);
      for (let i = 0; i < 18; i++) {
        expect(tbl[i]).toBe(buf.readInt32LE(off + i * 4));
      }
    }

    // 4. WALL_STYLE_GROUP_TABLE_6FDDA758 at VA 0x6FDDA758 (.rdata, 15 ints = 60 bytes)
    const wallGroupOff = 0x6fdda758 - 0x6fd50000;
    expect(WALL_STYLE_GROUP_TABLE_6FDDA758.length).toBe(15);
    for (let i = 0; i < 15; i++) {
      expect(WALL_STYLE_GROUP_TABLE_6FDDA758[i]).toBe(buf.readInt32LE(wallGroupOff + i * 4));
    }

    // 5. WALL_FLOOD_ACTION_TABLE_6FDDA794 at VA 0x6FDDA794 (.rdata, 30 uint32s = 120 bytes)
    const wallActionOff = 0x6fdda794 - 0x6fd50000;
    expect(WALL_FLOOD_ACTION_TABLE_6FDDA794.length).toBe(30);
    for (let i = 0; i < 30; i++) {
      expect(WALL_FLOOD_ACTION_TABLE_6FDDA794[i]).toBe(buf.readUInt32LE(wallActionOff + i * 4));
    }

    // 6. FLOOD_DIR_DELTAS_6FDDA80C at VA 0x6FDDA80C (.rdata, 8 ints = 32 bytes)
    const floodDirOff = 0x6fdda80c - 0x6fd50000;
    expect(FLOOD_DIR_DELTAS_6FDDA80C.length).toBe(8);
    for (let i = 0; i < 8; i++) {
      expect(FLOOD_DIR_DELTAS_6FDDA80C[i]).toBe(buf.readInt32LE(floodDirOff + i * 4));
    }
  });

  it('throws on invalid eFlagOp in ENVIRONMENT_Alloc113c', () => {
    const rec = vectors.find(v => v.va === '0x6FD87020')!;
    const { mem } = createGuardedMemory(rec.pre);
    expect(() =>
      ENVIRONMENT_Alloc113c(mem, rec.args[0]!, rec.args[1]!, rec.args[2]!, 6, rec.args[4]!),
    ).toThrow(/invalid eFlagOp=6/);
  });

  it('negative control: mutating return value or post-memory state is caught for every B010 function', () => {
    for (const va of Object.keys(B010_DISPATCH)) {
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
