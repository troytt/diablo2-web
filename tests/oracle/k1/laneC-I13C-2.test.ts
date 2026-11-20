import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COLLISION_FindFreePositionBasic113c,
  COLLISION_FindFreePositionSimple113c,
  COLLISION_FindFreePositionWithStep113c,
} from '../../../src/d2kern-113c/common/collision.ts';
import {
  DRLG_ActivateRoomEx113c,
  DRLGMAZE_ExpandRoomsToTargetCount113c,
  DRLGMAZE_FindEastmostExpandableRoom113c,
  DRLGMAZE_FindNorthmostExpandableRoom113c,
  DRLGMAZE_FindSouthmostExpandableRoom113c,
  DRLGMAZE_FindWestmostExpandableRoom113c,
  DRLGPRESET_CreatePresetRoomEx113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-room.ts';
import {
  DRLGMAZE_PlaceTunnelsSpecialPresets113c,
  PATH_WarpUnitToRoomAndCoord113c,
  TUNNELS_SPECIAL_PRESETS_6FDE6CE8,
} from '../../../src/d2kern-113c/common/drlg/maze.ts';
import {
  ACT4_PRESET_BASE_A_6FDE57AC,
  ACT4_PRESET_BASE_B_6FDE57B8,
  DRLGOUTJUNG_SpawnAct4OutdoorPresets113c,
  DRLGOUTJUNG_SpawnPresetsSet1_113c,
  DRLGOUTJUNG_SpawnPresetsSet2_113c,
  DRLGOUTJUNG_SpawnPresetsSet3_113c,
  DRLGOUTJUNG_SpawnPresetsSet4_113c,
  DRLGOUTJUNG_SpawnPresetsSet5_113c,
  DRLGOUTJUNG_SpawnPresetsSet6_113c,
  DRLGOUTJUNG_SpawnPresetsSet7_113c,
  DRLGOUTJUNG_SpawnTravincalPresets113c,
} from '../../../src/d2kern-113c/common/drlg/out-jung.ts';
import { DRLGROOMTILE_ApplyTileFlagsAndSpawnWarp113c } from '../../../src/d2kern-113c/common/drlg/room-tile.ts';
import { DUNGEON_AllocActiveRoom113c } from '../../../src/d2kern-113c/common/dungeon.ts';
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i13c-2-vectors.ndjson');

function loadVectors(): VectorRecord[] {
  return readFileSync(FIXTURE_PATH, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as VectorRecord);
}

const I13C2_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD9D7E0': (m, a) => COLLISION_FindFreePositionBasic113c(m, a[0]!, a[1]!, a[2]!, a[3]! | 0, a[4]!, a[5]!, a[6]! | 0) >>> 0,
  '0x6FD9D810': (m, a) => COLLISION_FindFreePositionWithStep113c(m, a[0]!, a[1]!, a[2]! | 0, a[3]!, a[4]! | 0) >>> 0,
  '0x6FD9D840': (m, a) => COLLISION_FindFreePositionSimple113c(m, a[0]!, a[1]!, a[2]! | 0, a[3]!, a[4]! | 0) >>> 0,
  '0x6FD8C720': (m, a) =>
    DUNGEON_AllocActiveRoom113c(
      m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!,
      (mem, pRoom) => { mem.setU32((pRoom + 0x0c) >>> 0, 0xcafebabe); },
    ) >>> 0,
  '0x6FD5E1E0': (m, a) => PATH_WarpUnitToRoomAndCoord113c(m, a[0]!, a[1]!, a[2]!, a[3]! | 0, a[4]! | 0) >>> 0,
  '0x6FD60AF0': (m, a) => { DRLGMAZE_PlaceTunnelsSpecialPresets113c(m, a[0]!); return 0; },
  '0x6FDB8A90': (m, a) => { DRLGROOMTILE_ApplyTileFlagsAndSpawnWarp113c(m, a[0]! | 0, a[1]!, a[2]!, a[3]!, a[4]! | 0, a[5]! | 0); return 0; },
  '0x6FD60160': (m, a) => { DRLGMAZE_ExpandRoomsToTargetCount113c(m, a[0]!); return 0; },
  '0x6FD60730': (m, a) => DRLGMAZE_FindSouthmostExpandableRoom113c(m, a[0]!) >>> 0,
  '0x6FD60820': (m, a) => DRLGMAZE_FindEastmostExpandableRoom113c(m, a[0]!) >>> 0,
  '0x6FD60910': (m, a) => DRLGMAZE_FindWestmostExpandableRoom113c(m, a[0]!) >>> 0,
  '0x6FD60A00': (m, a) => DRLGMAZE_FindNorthmostExpandableRoom113c(m, a[0]!) >>> 0,
  '0x6FD9A5C0': (m, a) => DRLGPRESET_CreatePresetRoomEx113c(m, a[0]!, a[1]!, a[2]! | 0, a[3]! | 0, a[4]! | 0, a[5]! | 0, a[6]! | 0, a[7]! | 0, a[8]!) >>> 0,
  '0x6FD7E1F0': (m, a) => { DRLG_ActivateRoomEx113c(m, a[0]!, a[1]!); return 0; },
  '0x6FDD4DA0': (m, a) => { DRLGOUTJUNG_SpawnTravincalPresets113c(m, a[0]!); return 0; },
  '0x6FDD5B80': (m, a) => { DRLGOUTJUNG_SpawnPresetsSet1_113c(m, a[0]!); return 0; },
  '0x6FDD5BE0': (m, a) => { DRLGOUTJUNG_SpawnPresetsSet2_113c(m, a[0]!); return 0; },
  '0x6FDD5C50': (m, a) => { DRLGOUTJUNG_SpawnPresetsSet3_113c(m, a[0]!); return 0; },
  '0x6FDD5C90': (m, a) => { DRLGOUTJUNG_SpawnPresetsSet4_113c(m, a[0]!); return 0; },
  '0x6FDD5CF0': (m, a) => { DRLGOUTJUNG_SpawnPresetsSet5_113c(m, a[0]!); return 0; },
  '0x6FDD5D20': (m, a) => { DRLGOUTJUNG_SpawnPresetsSet6_113c(m, a[0]!); return 0; },
  '0x6FDD5D90': (m, a) => { DRLGOUTJUNG_SpawnPresetsSet7_113c(m, a[0]!); return 0; },
  '0x6FDD6040': (m, a) => { DRLGOUTJUNG_SpawnAct4OutdoorPresets113c(m, a[0]!); return 0; },
};

function verifyVector(v: VectorRecord, overrideEax?: number, corruptAddr?: number): void {
  const runner = I13C2_RUNNERS[v.va];
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

describe('Lane C I13C-2 real-DLL differential vectors (23 functions)', () => {
  const vectors = loadVectors();

  it('covers all 23 I13C-2 VAs with >= 3 real-DLL vectors each', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    expect(counts.size).toBe(23);
    for (const va of Object.keys(I13C2_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(3);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case} (${v.note})`, () => {
      verifyVector(v);
    });
  }

  it('negative control: mutating return value or post-memory state is caught for every I13C-2 function', () => {
    for (const va of Object.keys(I13C2_RUNNERS)) {
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

  it('matches .rdata tables and D2CommonAssertError boundaries across I13C-2', () => {
    expect(TUNNELS_SPECIAL_PRESETS_6FDE6CE8).toEqual([
      [1054, 1, 0],
      [1053, 3, 1],
      [1054, 1, 1],
      [1053, 3, 0],
      [1055, 0, 1],
      [1056, 2, 0],
      [1055, 0, 0],
      [1056, 2, 1],
    ]);
    expect(Array.from(ACT4_PRESET_BASE_A_6FDE57AC)).toEqual([828, 832, 832]);
    expect(Array.from(ACT4_PRESET_BASE_B_6FDE57B8)).toEqual([812, 817, 823]);

    const m = new SparseMemory113c();
    expect(() => DUNGEON_AllocActiveRoom113c(m, 0x1000, 0, 0x2000, 0, 1, 0)).toThrow(D2CommonAssertError);
  });

  it('kills boundary, swap & branch mutants across I13C-2', () => {
    const m = new SparseMemory113c();

    // #82: F21 sets (pPreset + 0x0c) |= 2 on spawned adjacent rooms (pNew !== 0)
    {
      const pLvl = m.alloc(0x240), pDrlg = m.alloc(0x500), pMaze = m.alloc(0x40);
      const pBase = m.alloc(0xec), pBasePreset = m.alloc(0x100);
      m.setU32(pLvl + 0x1b4, pDrlg); m.setU32(pLvl + 0x14, pMaze); m.setU32(pLvl + 0x10, pBase);
      m.setU32(pLvl + 0x08, 1); m.setU32(pLvl + 0x1c0, 3);
      m.setU32(pMaze + 0x10, 10); m.setU32(pMaze + 0x14, 10); m.setU32(pMaze + 0x18, 500);
      m.setU32(pBase + 0x20, pBasePreset); m.setU32(pBase + 0x58, pLvl);
      m.setU32(pBase + 0x34, 100); m.setU32(pBase + 0x38, 100);
      m.setU32(pBase + 0x3c, 10); m.setU32(pBase + 0x40, 10);
      m.setU32(pBase + 0x14, 1); m.setU32(pBase + 0x18, 0);
      DRLGMAZE_PlaceTunnelsSpecialPresets113c(m, pLvl);
      const pNew = m.u32(pLvl + 0x10);
      expect(pNew).not.toBe(pBase);
      const pNewPreset = m.u32(pNew + 0x20);
      expect((m.u32(pNewPreset + 0x0c) & 2) !== 0).toBe(true);
    }

    // #94: F28 reads lvlDefTbl[0] when nLevelId === 0
    {
      const dt = m.alloc(0x1000);
      const lvlDefTbl = m.alloc(4 * 0x9c);
      const lvlSubTbl = m.alloc(2 * 0x15c);
      const lvlSubLut = m.alloc(4 * 4);
      m.setU32(dt + 0xc5c, 4);
      m.setU32(lvlDefTbl + 0x38, 0xffffffff);
      m.setU32(lvlDefTbl + 0x3c, 0xffffffff);
      m.setU32(0x6fde9e1c, dt);
      m.setU32(0x6fdf0b38, lvlDefTbl);
      m.setU32(0x6fdf143c, lvlSubTbl);
      m.setU32(0x6fdf1444, lvlSubLut);
      const pLvl = m.alloc(0x200), pDrlg = m.alloc(0x500);
      m.setU32(pLvl + 0x1b4, pDrlg); m.setU32(pLvl + 0x1d0, 0);
      const r0 = DRLGPRESET_CreatePresetRoomEx113c(m, 0x100, pLvl, 10, 20, 8, 8, 55, 2, 0xf);
      const pr0 = m.u32(r0 + 0x20);
      expect(m.u32(pr0 + 0x64)).toBe(0xffffffff);
    }

    // #98 & #101: F16/F17 swap4 (nUnitSize=1 vs wMask=0x0002)
    {
      const pRoom = m.alloc(0x80), pGrid = m.alloc(0x28), pMap = m.alloc(200), ppNear = m.alloc(4);
      m.setU32(ppNear, pRoom);
      m.setU32(pRoom + 0x00, ppNear); m.setU32(pRoom + 0x24, 1); m.setU32(pRoom + 0x20, pGrid);
      m.setU32(pRoom + 0x4c, 100); m.setU32(pRoom + 0x50, 100);
      m.setU32(pRoom + 0x54, 10); m.setU32(pRoom + 0x58, 10);
      m.setU32(pGrid + 0x00, 100); m.setU32(pGrid + 0x04, 100);
      m.setU32(pGrid + 0x08, 10); m.setU32(pGrid + 0x0c, 10);
      m.setU32(pGrid + 0x20, pMap);
      m.setU16(pMap + (4 * 10 + 4) * 2, 0x0002);
      const pOut = m.alloc(8);
      m.setU32(pOut, 104); m.setU32(pOut + 4, 104);
      expect(COLLISION_FindFreePositionBasic113c(m, pRoom, pOut, 0, 1, 0x0002, 0, 0)).toBe(pRoom);
      expect(m.u32(pOut) !== 104 || m.u32(pOut + 4) !== 104).toBe(true);
      m.setU32(pOut, 104); m.setU32(pOut + 4, 104);
      expect(COLLISION_FindFreePositionWithStep113c(m, pRoom, pOut, 1, 0x0002, 1)).toBe(pRoom);
      expect(m.u32(pOut) !== 104 || m.u32(pOut + 4) !== 104).toBe(true);
    }

    // #96, #99, #102: F16/F17/F18 maxRadius === 50 stops before ring 50 (154,104)
    {
      const pRoom = m.alloc(0x80), pGrid = m.alloc(0x28), pMap = m.alloc(120 * 120 * 2), ppNear = m.alloc(4);
      m.setU32(ppNear, pRoom);
      m.setU32(pRoom + 0x00, ppNear); m.setU32(pRoom + 0x24, 1); m.setU32(pRoom + 0x20, pGrid);
      m.setU32(pRoom + 0x4c, 50); m.setU32(pRoom + 0x50, 50);
      m.setU32(pRoom + 0x54, 120); m.setU32(pRoom + 0x58, 120);
      m.setU32(pGrid + 0x00, 50); m.setU32(pGrid + 0x04, 50);
      m.setU32(pGrid + 0x08, 120); m.setU32(pGrid + 0x0c, 120);
      m.setU32(pGrid + 0x20, pMap);
      m.fill(pMap, 120 * 120 * 2, 0);
      for (let y = 0; y < 120; y++) {
        for (let x = 0; x < 120; x++) {
          m.setU16(pMap + (y * 120 + x) * 2, 0x0001);
        }
      }
      // Unblock only (154, 104) at dx = +50 from (104, 104)
      m.setU16(pMap + ((104 - 50) * 120 + (154 - 50)) * 2, 0);
      const pOut = m.alloc(8);
      m.setU32(pOut, 104); m.setU32(pOut + 4, 104);
      expect(COLLISION_FindFreePositionBasic113c(m, pRoom, pOut, 0, 1, 0x0001, 0, 0)).toBe(0);
      m.setU32(pOut, 104); m.setU32(pOut + 4, 104);
      expect(COLLISION_FindFreePositionWithStep113c(m, pRoom, pOut, 1, 0x0001, 1)).toBe(0);
      m.setU32(pOut, 104); m.setU32(pOut + 4, 104);
      expect(COLLISION_FindFreePositionSimple113c(m, pRoom, pOut, 1, 0x0001, 0)).toBe(0);
    }
  });
});
