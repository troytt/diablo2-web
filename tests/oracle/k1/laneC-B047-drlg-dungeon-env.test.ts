import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COLLISION_StampRoomTileGridToCollGrid113c } from '../../../src/d2kern-113c/common/collision.ts';
import { DRLGLOGIC_BuildRoomCoordListRegions113c } from '../../../src/d2kern-113c/common/drlg/drlg-logic.ts';
import {
  DRLGROOM_AllocRoomTileWindowNode113c,
  DRLGROOM_AppendAndSortAdjacentRoom113c,
  DRLGROOM_BuildRoomExNearList113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-room.ts';
import { ENV_ResetDefaultEnvironment113c } from '../../../src/d2kern-113c/common/drlg/drlg.ts';
import {
  DATATBLS_FindFloorWindowTileCacheEntry113c,
  DRLGROOMTILE_FreeRoomTileGridAndAnimList113c,
  DRLGROOMTILE_UpdateWindowTileCacheEntry113c,
} from '../../../src/d2kern-113c/common/drlg/room-tile.ts';
import {
  DUNGEON_AllocAndBuildRoomNeighborList113c,
  DUNGEON_FreeRoomAndDetachUnits113c,
  DUNGEON_ShouldDeactivateRoomEx113c,
  DUNGEON_SortRoomClientArray113c,
} from '../../../src/d2kern-113c/common/dungeon.ts';
import {
  ENV_AllocDrlgEnvironment113c,
  ENV_InitEclipseEnvironment113c,
  ENV_StepCycle113c,
} from '../../../src/d2kern-113c/common/env.ts';
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
    frees: number[];
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b047-vectors.ndjson');

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
      if (!allowedReadBytes.has(b)) {
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
      frees.push(p >>> 0);
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
    expect(raw.u32(addr), `post dword at ${k}`).toBe(expected >>> 0);
  }
  for (const [k, preVal] of Object.entries(preMem)) {
    if (!(k in postMem)) {
      const addr = Number(k) >>> 0;
      expect(raw.u32(addr), `unchanged pre dword at ${k}`).toBe(preVal >>> 0);
    }
  }
}

const B047_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6fd87660': (m, a) => ENV_StepCycle113c(m, a[0]!, a[1]!) >>> 0,
  '0x6fd87ba0': (m, a) => ENV_AllocDrlgEnvironment113c(m, a[0]!) >>> 0,
  '0x6fd87c20': (m, a) => {
    ENV_ResetDefaultEnvironment113c(m, a[0]!);
    return 0;
  },
  '0x6fd87ca0': (m, a) => {
    ENV_InitEclipseEnvironment113c(m, a[0]!);
    return 0;
  },
  '0x6fd8bdd0': (m, a) => {
    DUNGEON_SortRoomClientArray113c(m, a[0]!);
    return 0;
  },
  '0x6fd8c200': (m, a) => {
    DUNGEON_AllocAndBuildRoomNeighborList113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd8c870': (m, a) => {
    DUNGEON_FreeRoomAndDetachUnits113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd94a30': (m, a) => {
    DRLGROOM_AppendAndSortAdjacentRoom113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6fd94df0': (m, a) => {
    DRLGROOM_BuildRoomExNearList113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd95240': (m, a) => {
    DRLGROOM_AllocRoomTileWindowNode113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6fd9ca90': (m, a) => {
    COLLISION_StampRoomTileGridToCollGrid113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!);
    return 0;
  },
  '0x6fdb8510': (m, a) => {
    DRLGROOMTILE_FreeRoomTileGridAndAnimList113c(m, a[0]!);
    return 0;
  },
  '0x6fdb8800': (m, a) => {
    DRLGROOMTILE_UpdateWindowTileCacheEntry113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fdcba00': (m, a) => DUNGEON_ShouldDeactivateRoomEx113c(m, a[0]!) >>> 0,
  '0x6fdd1200': (m, a) => {
    DRLGLOGIC_BuildRoomCoordListRegions113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fdbc5d0': (m, a) => DATATBLS_FindFloorWindowTileCacheEntry113c(m, a[0]!, a[1]!) >>> 0,
};

describe('Lane C B047 real-DLL differential vectors (drlg, dungeon, env, 16 functions)', () => {
  const vectors = loadVectors();

  it('covers all 16 B047 VAs with >= 4 real-DLL vectors each (68 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(counts.size).toBe(16);
    for (const va of Object.keys(B047_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const v of vectors) {
    it(`${v.va} case ${v.case} (${v.note})`, () => {
      const runner = B047_RUNNERS[v.va];
      expect(runner, `missing runner for ${v.va}`).toBeDefined();
      const raw = new SparseMemory113c();
      const { mem, rogueReads, rogueWrites, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
      const eax = runner!(mem, v.in.args);
      expect(eax >>> 0).toBe(v.out.eax >>> 0);
      expect(rogueReads).toEqual([]);
      expect(rogueWrites).toEqual([]);
      expect(frees).toEqual(v.out.frees);
      assertPostMemory(raw, v.in.mem, v.out.mem);
    });
  }

  it('verifies Fog.#10023 assertion branches across B047 functions', () => {
    const m = new SparseMemory113c();
    expect(() => ENV_StepCycle113c(m, 0, 0)).toThrow(/^D2Common assertion failed at .*:1351$/);
    expect(() => ENV_ResetDefaultEnvironment113c(m, 0)).toThrow(/^D2Common assertion failed at .*:1351$/);
    expect(() => ENV_InitEclipseEnvironment113c(m, 0)).toThrow(/^D2Common assertion failed at .*:1351$/);

    m.setU32(0x1000 + 0x48, 0x1100);
    m.setU32(0x1000 + 0x78, 1);
    m.setU32(0x1100 + 0x00, 0);
    expect(() => DUNGEON_SortRoomClientArray113c(m, 0x1000)).toThrow(/^D2Common assertion failed at .*:1107$/);

    m.setU32(0x2000 + 0x08, 0);
    m.setU32(0x2000 + 0x0c, 0);
    m.setU32(0x2100 + 0x10, 0);
    m.setU32(0x2100 + 0x14, 0);
    expect(() =>
      COLLISION_StampRoomTileGridToCollGrid113c(m, 0x2000, 0, 0x2100, 1, 1),
    ).toThrow(/^D2Common assertion failed at .*:530$/);

    expect(() => DRLGROOMTILE_UpdateWindowTileCacheEntry113c(m, 0, 5)).toThrow(/^D2Common assertion failed at .*:627$/);
    m.setU32(0x3000 + 0x10, 0);
    expect(() => DRLGROOMTILE_UpdateWindowTileCacheEntry113c(m, 0x3000, 5)).toThrow(/^D2Common assertion failed at .*:628$/);

    m.setU32(0x6fdf142c, 0);
    expect(() => DATATBLS_FindFloorWindowTileCacheEntry113c(m, 10, 0x62)).toThrow(/^D2Common assertion failed at .*:811$/);
    m.setU32(0x6fdf142c, 0x4000);
    m.setU32(0x6fdf1430, 1);
    m.setU32(0x4000, 99);
    expect(() => DATATBLS_FindFloorWindowTileCacheEntry113c(m, 10, 0x62)).toThrow(/^D2Common assertion failed at .*:826$/);

    m.setU32(0x5000 + 0x28, 0);
    m.setU32(0x5000 + 0x58, 0);
    expect(() => DUNGEON_ShouldDeactivateRoomEx113c(m, 0x5000)).toThrow(/^D2Common assertion failed at .*:1068$/);
    m.setU32(0x5000 + 0x58, 0x5100);
    m.setU32(0x5100 + 0x1b4, 0);
    expect(() => DUNGEON_ShouldDeactivateRoomEx113c(m, 0x5000)).toThrow(/^D2Common assertion failed at .*:1069$/);
    m.setU32(0x5100 + 0x1b4, 0x5200);
    m.setU8(0x5200 + 0x8c, 1);
    expect(() => DUNGEON_ShouldDeactivateRoomEx113c(m, 0x5000)).toThrow(/^D2Common assertion failed at .*:743$/);
  });
});
