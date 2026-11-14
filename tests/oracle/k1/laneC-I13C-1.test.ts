import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COLLISION_AllocAndBuildRoomGrid113c,
  COLLISION_FindAdjacentUnitWithCallback113c,
  COLLISION_FindFreePosition113c,
  COLLISION_MoveUnitToRoomAndCoord113c,
} from '../../../src/d2kern-113c/common/collision.ts';
import { DRLG_CollectWarpAndSpecialRoomCenters113c } from '../../../src/d2kern-113c/common/drlg/drlg.ts';
import {
  DRLGMAZE_FillAdjacentRoomsWithPreset113c,
  DRLGMAZE_PlaceOrReplaceSpecialRoomPreset113c,
  DRLGMAZE_SpawnAndAssignCornerRoomPresets113c,
  DRLGMAZE_SpawnCrossOrPairSpecialRooms113c,
  MAZE_CORNER_PRESET_BY_DIR_6FDE6CC8,
} from '../../../src/d2kern-113c/common/drlg/maze.ts';
import {
  DRLGROOMTILE_AllocLevelWarpPresetUnit113c,
  DRLGROOMTILE_RasterizeOutdoorRoadsToPreset113c,
  DRLGROOMTILE_SpawnWarpPresetUnit113c,
  WARP_TILE_PRESET_UNIT_6FDDBF34,
} from '../../../src/d2kern-113c/common/drlg/room-tile.ts';
import {
  DUNGEON_AddClientToRoom113c,
  DUNGEON_CanFreeActiveRoom113c,
  DUNGEON_RemoveClientFromRoom113c,
} from '../../../src/d2kern-113c/common/dungeon.ts';
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

interface VectorRecord {
  va: string;
  name: string;
  case: number;
  note: string;
  retMask: number;
  in: { args: number[]; mem: Record<string, number> };
  out: {
    eax: number;
    hasRet: number;
    mem: Record<string, number>;
    allocBytes: number;
    frees: number[];
  };
}

function createGuardedMemory(
  raw: SparseMemory113c,
  preMem: Record<string, number>,
  postMem: Record<string, number>,
): {
  mem: Memory113c;
  rogueReads: number[];
  rogueWrites: number[];
  frees: number[];
  getAllocBytes: () => number;
} {
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
  let allocBytes = 0;

  const checkRead = (addr: number, width: number): void => {
    for (let i = 0; i < width; i++) {
      const b = (addr + i) >>> 0;
      if (!allowedReadBytes.has(b)) rogueReads.push(b);
    }
  };
  const checkWrite = (addr: number, width: number): void => {
    for (let i = 0; i < width; i++) {
      const b = (addr + i) >>> 0;
      if (!allowedWriteBytes.has(b)) rogueWrites.push(b);
    }
  };

  const mem: Memory113c & { free: (p: number) => void } = {
    alloc: size => {
      if ((size >>> 0) === 0) return 0;
      const p = raw.alloc(size);
      const aligned = ((size + 3) & ~3) >>> 0;
      allocBytes += size;
      for (let i = 0; i < aligned; i++) {
        const b = (p + i) >>> 0;
        allowedReadBytes.add(b);
        allowedWriteBytes.add(b);
      }
      return p;
    },
    free: p => {
      if ((p >>> 0) !== 0) frees.push(p >>> 0);
    },
    u8: p => { checkRead(p >>> 0, 1); return raw.u8(p); },
    u16: p => { checkRead(p >>> 0, 2); return raw.u16(p); },
    u32: p => { checkRead(p >>> 0, 4); return raw.u32(p); },
    setU8: (p, v) => { checkWrite(p >>> 0, 1); raw.setU8(p, v); },
    setU16: (p, v) => { checkWrite(p >>> 0, 2); raw.setU16(p, v); },
    setU32: (p, v) => { checkWrite(p >>> 0, 4); raw.setU32(p, v); },
    get: (base, f, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      checkRead((base + f.off + idx * width) >>> 0, width);
      return raw.get(base, f, idx);
    },
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      checkWrite((base + f.off + idx * width) >>> 0, width);
      raw.set(base, f, v, idx);
    },
    fill: (p, len, v) => {
      for (let i = 0; i < len; i++) checkWrite((p + i) >>> 0, 1);
      raw.fill(p, len, v);
    },
  };

  return { mem, rogueReads, rogueWrites, frees, getAllocBytes: () => allocBytes };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i13c-1-vectors.ndjson');

function loadVectors(): VectorRecord[] {
  return readFileSync(FIXTURE_PATH, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as VectorRecord);
}

const I13C1_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD5DF30': (m, a) => COLLISION_MoveUnitToRoomAndCoord113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD9D010': (m, a) => { COLLISION_AllocAndBuildRoomGrid113c(m, a[0]!, a[1]!); return 0; },
  '0x6FD9D140': (m, a) =>
    COLLISION_FindFreePosition113c(
      m, a[0]!, a[1]!, a[2]!, a[3]! | 0, a[4]!, a[5]!, a[6]! | 0, a[7]! | 0, a[8]! | 0,
    ) >>> 0,
  '0x6FDCF6A0': (m, a) =>
    COLLISION_FindAdjacentUnitWithCallback113c(
      m, a[0]!, a[1]! | 0, a[2]! | 0, a[3]!, a[4]!, a[5]! | 0,
      (mem, pUnit, pCtx) => (mem.u32((pUnit + 0x0c) >>> 0) === (pCtx >>> 0) ? 1 : 0),
    ) >>> 0,
  '0x6FD8C3B0': (m, a) => { DUNGEON_RemoveClientFromRoom113c(m, a[0]!, a[1]!); return 0; },
  '0x6FD8C460': (m, a) => { DUNGEON_AddClientToRoom113c(m, a[0]!, a[1]!); return 0; },
  '0x6FD8C520': (m, a) => DUNGEON_CanFreeActiveRoom113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD5FD20': (m, a) => { DRLGMAZE_SpawnAndAssignCornerRoomPresets113c(m, a[0]!); return 0; },
  '0x6FD5FE70': (m, a) => { DRLGMAZE_SpawnCrossOrPairSpecialRooms113c(m, a[0]! | 0, a[1]!); return 0; },
  '0x6FD60010': (m, a) => { DRLGMAZE_FillAdjacentRoomsWithPreset113c(m, a[0]!, a[1]! | 0, a[2]!); return 0; },
  '0x6FD606B0': (m, a) => { DRLGMAZE_PlaceOrReplaceSpecialRoomPreset113c(m, a[0]!, a[1]!, a[2]!); return 0; },
  '0x6FD8DC90': (m, a) => { DRLGROOMTILE_RasterizeOutdoorRoadsToPreset113c(m, a[0]!, a[1]!); return 0; },
  '0x6FDB8970': (m, a) => { DRLGROOMTILE_SpawnWarpPresetUnit113c(m, a[0]! | 0, a[1]!, a[2]!, a[3]!, a[4]! | 0, a[5]! | 0); return 0; },
  '0x6FDB9090': (m, a) => DRLGROOMTILE_AllocLevelWarpPresetUnit113c(m, a[0]!, a[1]!, a[2]! | 0, a[3]! | 0, a[4]! | 0) >>> 0,
  '0x6FD7DC90': (m, a) => { DRLG_CollectWarpAndSpecialRoomCenters113c(m, a[0]!); return 0; },
};

function verifyVector(v: VectorRecord, overrideEax?: number, corruptAddr?: number): void {
  const runner = I13C1_RUNNERS[v.va];
  if (!runner) throw new Error(`missing runner for ${v.va}`);
  const raw = new SparseMemory113c();
  const { mem, rogueReads, rogueWrites, frees, getAllocBytes } = createGuardedMemory(raw, v.in.mem, v.out.mem);
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
  expect(getAllocBytes()).toBe(v.out.allocBytes);
  for (const [k, expected] of Object.entries(v.out.mem)) {
    const addr = Number(k) >>> 0;
    const got = raw.u32(addr) >>> 0;
    const want = expected >>> 0;
    if (got !== want) {
      throw new Error(`post dword mismatch at ${k} (${v.va}#${v.case}): got=${got} want=${want}`);
    }
  }
}

describe('Lane C I13C-1 real-DLL differential vectors (15 functions)', () => {
  const vectors = loadVectors();

  it('covers all 15 I13C-1 VAs with >= 3 real-DLL vectors each', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    expect(counts.size).toBe(15);
    for (const va of Object.keys(I13C1_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(3);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case} (${v.note})`, () => {
      verifyVector(v);
    });
  }

  it('negative control: mutating return value or post-memory state is caught for every I13C-1 function', () => {
    for (const va of Object.keys(I13C1_RUNNERS)) {
      const sample = vectors.find(
        v => v.va === va && (v.out.hasRet !== 0 || Object.keys(v.out.mem).length > 0),
      )!;
      if (sample.out.hasRet !== 0) {
        expect(() => verifyVector(sample, (sample.out.eax ^ 1) >>> 0)).toThrow(/eax mismatch/);
      }
      const postKeys = Object.keys(sample.out.mem);
      if (postKeys.length > 0) {
        expect(() => verifyVector(sample, undefined, Number(postKeys[0]!) >>> 0)).toThrow(/post dword/);
      }
    }
  });

  it('matches .rdata tables and D2CommonAssertError boundaries across I13C-1', () => {
    expect(MAZE_CORNER_PRESET_BY_DIR_6FDE6CC8).toEqual([
      [447, 1075],
      [444, 1077],
      [446, 1076],
      [445, 1074],
    ]);
    expect(WARP_TILE_PRESET_UNIT_6FDDBF34.length).toBe(34);
    expect(WARP_TILE_PRESET_UNIT_6FDDBF34[0]).toEqual([14, 2, 5, 0]);
    expect(WARP_TILE_PRESET_UNIT_6FDDBF34[33]).toEqual([60, 2, 0, 2]);

    const m = new SparseMemory113c();
    // F01 assert (Path.cpp:1161) when target room is 0 and wX != 0
    const pPath = m.alloc(0x200);
    expect(() => COLLISION_MoveUnitToRoomAndCoord113c(m, pPath, 0, (10 << 16) | 10)).toThrow(D2CommonAssertError);

    // F03 asserts (Collisn.cpp:1830 & 1840)
    expect(() => COLLISION_FindFreePosition113c(m, 0x1000, 0, 0, 1, 1, 1, 0, 10, 1)).toThrow(D2CommonAssertError);

    // F05 asserts (Dungeon.cpp:1159, 1160, 1161, 1168)
    expect(() => DUNGEON_RemoveClientFromRoom113c(m, 0, 0x1000)).toThrow(D2CommonAssertError);
    expect(() => DUNGEON_RemoveClientFromRoom113c(m, 0x1000, 0)).toThrow(D2CommonAssertError);
    const pRoom5 = m.alloc(0x80);
    const pClients5 = m.alloc(8);
    m.setU32(pRoom5 + 0x48, pClients5);
    m.setU32(pRoom5 + 0x78, 1);
    expect(() => DUNGEON_RemoveClientFromRoom113c(m, pRoom5, 0x2000)).toThrow(D2CommonAssertError);
    m.setU32(pClients5, 0x1000);
    let caught1168: unknown;
    try {
      DUNGEON_RemoveClientFromRoom113c(m, pRoom5, 0x2000);
    } catch (e) {
      caught1168 = e;
    }
    expect(caught1168).toBeInstanceOf(D2CommonAssertError);
    expect((caught1168 as D2CommonAssertError).line).toBe(1168);

    // F06 asserts (Dungeon.cpp:1139, 1140, 1141, 1143)
    expect(() => DUNGEON_AddClientToRoom113c(m, 0, 0x1000)).toThrow(D2CommonAssertError);
    expect(() => DUNGEON_AddClientToRoom113c(m, 0x1000, 0)).toThrow(D2CommonAssertError);
    m.setU32(pRoom5 + 0x04, 0);
    expect(() => DUNGEON_AddClientToRoom113c(m, pRoom5, 0x2000)).toThrow(D2CommonAssertError);

    // F07 asserts (Dungeon.cpp:989, 990, 991)
    expect(() => DUNGEON_CanFreeActiveRoom113c(m, 0, 0x1000)).toThrow(D2CommonAssertError);
    const pAct7 = m.alloc(0x60);
    m.setU32(pAct7 + 0x50, 0x1234);
    expect(() => DUNGEON_CanFreeActiveRoom113c(m, pAct7, 0x1000)).toThrow(D2CommonAssertError);
    m.setU32(pAct7 + 0x50, 0);
    expect(() => DUNGEON_CanFreeActiveRoom113c(m, pAct7, 0)).toThrow(D2CommonAssertError);
  });

  it('kills boundary & branch mutants across I13C-1', () => {
    const m = new SparseMemory113c();

    // #2: F01 oldX === wX && oldY !== wY sets bit 0x08 in path+0x34
    {
      const pRoom = m.alloc(0x80);
      const pGrid = m.alloc(0x28);
      const pMap = m.alloc(200);
      const ppNear = m.alloc(4);
      m.setU32(ppNear, pRoom);
      m.setU32(pRoom + 0x00, ppNear);
      m.setU32(pRoom + 0x24, 1);
      m.setU32(pRoom + 0x20, pGrid);
      m.setU32(pRoom + 0x4c, 100); m.setU32(pRoom + 0x50, 100);
      m.setU32(pRoom + 0x54, 10);  m.setU32(pRoom + 0x58, 10);
      m.setU32(pGrid + 0x00, 100); m.setU32(pGrid + 0x04, 100);
      m.setU32(pGrid + 0x08, 10);  m.setU32(pGrid + 0x0c, 10);
      m.setU32(pGrid + 0x20, pMap);
      const pUnit = m.alloc(0x40);
      const pPath = m.alloc(0x200);
      m.setU32(pUnit + 0x00, 3);
      m.setU32(pPath + 0x30, pUnit);
      m.setU32(pPath + 0x1c, pRoom);
      m.setU16(pPath + 0x02, 102); m.setU16(pPath + 0x06, 102);
      m.setU32(pPath + 0x44, 1); m.setU32(pPath + 0x4c, 0x80); m.setU32(pPath + 0x50, 0x1c01);
      COLLISION_MoveUnitToRoomAndCoord113c(m, pPath, pRoom, (103 << 16) | 102);
      expect((m.u32(pPath + 0x34) & 0x08) !== 0).toBe(true);
    }

    // #16: F11 walks pRoomEx->pNext (+0x24) to replace a non-head room preset
    {
      const pLvl = m.alloc(0x240);
      const pDrlg = m.alloc(0x100);
      const r0 = m.alloc(0xec), pr0 = m.alloc(0x40);
      const r1 = m.alloc(0xec), pr1 = m.alloc(0x40);
      m.setU32(pLvl + 0x1b4, pDrlg);
      m.setU32(pLvl + 0x10, r0);
      m.setU32(r0 + 0x20, pr0); m.setU32(r0 + 0x24, r1);
      m.setU32(r1 + 0x20, pr1);
      m.setU32(pr0, 0x222);
      m.setU32(pr1, 0x111);
      const pSpec = m.alloc(0x10);
      m.setU32(pSpec + 0x00, 0x111); m.setU32(pSpec + 0x04, 0x333); m.setU32(pSpec + 0x08, 2);
      DRLGMAZE_PlaceOrReplaceSpecialRoomPreset113c(m, pSpec, pLvl, 0);
      expect(m.u32(pr1)).toBe(0x333);
    }

    // #23: F15 bit loop strictly < 8 (ignores bit 8 = 0x1000)
    {
      const pLvl = m.alloc(0x240);
      const pDrlg = m.alloc(0x500);
      const pWarp = m.alloc(0x48);
      m.setU32(pWarp + 0x00, 1);
      for (let i = 0; i < 8; i++) m.setU32(pWarp + 0x24 + i * 4, 0xffffffff);
      m.setU32(pWarp + 0x24 + 8 * 4, 77);
      const pR = m.alloc(0xec);
      m.setU32(pR + 0x28, 0x1010);
      m.setU32(pLvl + 0x10, pR);
      m.setU32(pLvl + 0x1b4, pDrlg);
      m.setU32(pLvl + 0x1d0, 1);
      m.setU32(pDrlg + 0x90, pWarp);
      // pLvl+0x228 stays 0 if bit 8 is ignored
      DRLG_CollectWarpAndSpecialRoomCenters113c(m, pLvl);
      expect(m.u32(pLvl + 0x228)).toBe(0);
    }

    // #36 & #39: F12 uses +0x34 for clipRect.x (not +0x38) and respects nLists === 0
    {
      const pLvl = m.alloc(0x200);
      const pOutdoors = m.alloc(0x280);
      const pRoomEx = m.alloc(0xec);
      const pPreset = m.alloc(0x100);
      const pCells = m.alloc(12 * 12 * 4);
      const pRows = m.alloc(12 * 4);
      for (let y = 0; y < 12; y++) m.setU32(pRows + y * 4, y * 12);
      m.setU32(pPreset + 0x3c, pCells);
      m.setU32(pPreset + 0x40, pRows);
      m.setU32(pPreset + 0x44, 12);
      m.setU32(pPreset + 0x48, 12);
      m.setU32(pRoomEx + 0x20, pPreset);
      m.setU32(pRoomEx + 0x34, 5);
      m.setU32(pRoomEx + 0x38, 20);
      m.setU32(pRoomEx + 0x3c, 8);
      m.setU32(pRoomEx + 0x40, 8);
      m.setU32(pLvl + 0x14, pOutdoors);
      const s0 = m.alloc(0x20), s1 = m.alloc(0x20);
      m.setU32(s0 + 0x00, 6); m.setU32(s0 + 0x04, 21); m.setU32(s0 + 0x10, s1);
      m.setU32(s1 + 0x00, 10); m.setU32(s1 + 0x04, 21);
      m.setU32(pOutdoors + 0x68, s0);
      const countNz = (): number => {
        let c = 0;
        for (let i = 0; i < 12 * 12; i++) if (m.u32(pCells + i * 4) !== 0) c++;
        return c;
      };
      m.setU32(pOutdoors + 0x260, 0);
      DRLGROOMTILE_RasterizeOutdoorRoadsToPreset113c(m, pRoomEx, pLvl);
      expect(countNz()).toBe(0);
      m.setU32(pOutdoors + 0x260, 1);
      DRLGROOMTILE_RasterizeOutdoorRoadsToPreset113c(m, pRoomEx, pLvl);
      expect(countNz()).toBeGreaterThan(0);
    }

    // #47: F03 nMaxRadius === 1 does NOT enter ring search
    {
      const pRoom = m.alloc(0x80);
      const pGrid = m.alloc(0x28);
      const pMap = m.alloc(200);
      const ppNear = m.alloc(4);
      m.setU32(ppNear, pRoom);
      m.setU32(pRoom + 0x00, ppNear); m.setU32(pRoom + 0x24, 1); m.setU32(pRoom + 0x20, pGrid);
      m.setU32(pRoom + 0x4c, 100); m.setU32(pRoom + 0x50, 100);
      m.setU32(pRoom + 0x54, 10); m.setU32(pRoom + 0x58, 10);
      m.setU32(pGrid + 0x00, 100); m.setU32(pGrid + 0x04, 100);
      m.setU32(pGrid + 0x08, 10); m.setU32(pGrid + 0x0c, 10);
      m.setU32(pGrid + 0x20, pMap);
      m.setU16(pMap + (4 * 10 + 4) * 2, 1);
      const pOut = m.alloc(8);
      m.setU32(pOut, 104); m.setU32(pOut + 4, 104);
      expect(COLLISION_FindFreePosition113c(m, pRoom, pOut, 0, 1, 1, 0, 0, 1, 1)).toBe(0);
    }

    // #49 & #51: F13 subtileX === maxX boundary & 1/3 random skip for 0x5b/0x5c
    {
      const dt = m.alloc(0x1000);
      m.setU32(0x6fde9e1c, dt);
      const pDrlg = m.alloc(0x500);
      const pLvl = m.alloc(0x200);
      const pRoomEx = m.alloc(0xec);
      m.setU32(pLvl + 0x1b4, pDrlg);
      m.setU32(pLvl + 0x1d0, 55); // idx 19..20 -> class 0x5c/0x5b
      m.setU32(pRoomEx + 0x58, pLvl);
      m.setU32(pRoomEx + 0x34, 10); m.setU32(pRoomEx + 0x38, 10);
      m.setU32(pRoomEx + 0x3c, 8);  m.setU32(pRoomEx + 0x40, 8);
      // #51: subtileX === maxX (nTileX = 18 -> (18-10)*5 = 40 = 8*5)
      m.setU32(pRoomEx + 0x14, 1);
      DRLGROOMTILE_SpawnWarpPresetUnit113c(m, 18, pRoomEx, 0, 0x00200400, 12, 9);
      expect(m.u32(pRoomEx + 0x5c)).toBe(0);
      // #49: in-bounds, seed lo=0,hi=0 -> newLo=0 % 3 === 0 -> skipped; lo=0,hi=1 -> spawns
      m.setU32(pRoomEx + 0x14, 0); m.setU32(pRoomEx + 0x18, 0);
      DRLGROOMTILE_SpawnWarpPresetUnit113c(m, 12, pRoomEx, 0, 0x00200400, 12, 9);
      expect(m.u32(pRoomEx + 0x5c)).toBe(0);
      m.setU32(pRoomEx + 0x14, 0); m.setU32(pRoomEx + 0x18, 1);
      DRLGROOMTILE_SpawnWarpPresetUnit113c(m, 12, pRoomEx, 0, 0x00200400, 12, 9);
      expect(m.u32(pRoomEx + 0x5c)).not.toBe(0);
    }

    // #56 & #59: F04 rangeIdx === 8 (size=3, nRange=3) and nRange === 0
    {
      const dt = m.alloc(0x1000);
      const monTbl = m.alloc(2 * 424);
      const mon2Tbl = m.alloc(2 * 308);
      m.setU32(dt + 0xa78, monTbl); m.setU32(dt + 0xa80, 2);
      m.setU32(dt + 0xa90, mon2Tbl); m.setU32(dt + 0xa98, 2);
      m.setU16(monTbl + 424 + 0x18, 1);
      m.setU8(mon2Tbl + 308 + 0x08, 3);
      m.setU32(0x6fde9e1c, dt);
      const pRoom = m.alloc(0x80), pGrid = m.alloc(0x28), ppNear = m.alloc(4);
      m.setU32(ppNear, pRoom);
      m.setU32(pRoom + 0x00, ppNear); m.setU32(pRoom + 0x24, 1); m.setU32(pRoom + 0x20, pGrid);
      m.setU32(pRoom + 0x4c, 100); m.setU32(pRoom + 0x50, 100);
      m.setU32(pRoom + 0x54, 10); m.setU32(pRoom + 0x58, 10);
      m.setU32(pGrid + 0x00, 100); m.setU32(pGrid + 0x04, 100);
      m.setU32(pGrid + 0x08, 10); m.setU32(pGrid + 0x0c, 10);
      const u = m.alloc(0x100), p = m.alloc(0x40);
      m.setU32(u + 0x00, 1); m.setU32(u + 0x04, 1); m.setU32(u + 0x10, 1); m.setU32(u + 0x2c, p);
      m.setU16(p + 0x02, 106); m.setU16(p + 0x06, 106);
      m.setU32(pRoom + 0x74, u);
      expect(COLLISION_FindAdjacentUnitWithCallback113c(m, pRoom, 104, 104, 0, 0, 0)).toBe(0);
      expect(COLLISION_FindAdjacentUnitWithCallback113c(m, pRoom, 104, 104, 0, 0, 3, () => 1)).toBe(u);
    }
  });
});
