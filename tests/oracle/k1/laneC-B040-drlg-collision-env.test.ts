import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COLLISION_ClearTileSubtileFlagsFromCollGrid113c,
  COLLISION_CopyTileSubtileFlagsToCollGrid113c,
  COLLISION_InitBoundingBox113c,
  COLLISION_OrTileSubtileFlagsToCollGrid113c,
  COLLISION_SplitClipRectByRoomBounds113c,
  D2CMP_10011_GetTileSubtileFlagsPtr113c,
} from '../../../src/d2kern-113c/common/collision.ts';
import {
  DRLGLOGIC_AllocSingleRoomCoordList113c,
  DRLGLOGIC_GetRoomCoordListAtSubtile113c,
  DRLGLOGIC_GetRoomCoordListFromWorldSubtile113c,
  DRLGLOGIC_GetRoomCoordListIndexAtSubtile113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-logic.ts';
import {
  DATATBLS_FindWallTileCacheEntry113c,
  DRLG_GetOrAllocObjectPresetRecord113c,
  DRLG_InitActTownFloorTileData113c,
  DRLG_LoadActTownTileLibrary113c,
} from '../../../src/d2kern-113c/common/drlg/drlg.ts';
import { DRLGOUTDOORS_ScaleAndCompactVertices113c } from '../../../src/d2kern-113c/common/drlg/outdoors.ts';
import {
  ENV_GetCycleState113c,
  ENV_UpdateIntensityAndSunAngle113c,
  ENV_UpdateLightColor113c,
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b040-vectors.ndjson');

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

const B040_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6fd7d4e0': (m, a) => {
    DRLG_LoadActTownTileLibrary113c(m, a[0]!);
    return 0;
  },
  '0x6fd7d730': (m, a) => DRLG_GetOrAllocObjectPresetRecord113c(m, a[0]!, a[1]!) >>> 0,
  '0x6fd7e0c0': (m, a) => {
    DRLG_InitActTownFloorTileData113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd871c0': (m, a) => {
    ENV_UpdateLightColor113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd873b0': (m, a) => {
    ENV_GetCycleState113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6fd876f0': (m, a) => {
    ENV_UpdateIntensityAndSunAngle113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6fd92070': (m, a) => {
    DRLGOUTDOORS_ScaleAndCompactVertices113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd9aa90': (m, a) => COLLISION_SplitClipRectByRoomBounds113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6fd9b5f0': (m, a) => {
    COLLISION_CopyTileSubtileFlagsToCollGrid113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6fd9b6b0': (m, a) => {
    COLLISION_ClearTileSubtileFlagsFromCollGrid113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6fd9b780': (m, a) => {
    COLLISION_OrTileSubtileFlagsToCollGrid113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6fdbc520': (m, a) => DATATBLS_FindWallTileCacheEntry113c(m, a[0]!) >>> 0,
  '0x6fdce390': (m, a) => {
    COLLISION_InitBoundingBox113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6fdd10a0': (m, a) => DRLGLOGIC_GetRoomCoordListAtSubtile113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6fdd1100': (m, a) => {
    DRLGLOGIC_AllocSingleRoomCoordList113c(m, a[0]!);
    return 0;
  },
  '0x6fdd1950': (m, a) =>
    DRLGLOGIC_GetRoomCoordListFromWorldSubtile113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6fdd19c0': (m, a) =>
    DRLGLOGIC_GetRoomCoordListIndexAtSubtile113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
};

describe('Lane C B040 real-DLL differential vectors (drlg, collision, env, 17 functions)', () => {
  const vectors = loadVectors();

  it('covers all 17 B040 VAs with >= 4 real-DLL vectors each (75 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(counts.size).toBe(17);
    for (const va of Object.keys(B040_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const v of vectors) {
    it(`${v.va} case ${v.case} (${v.note})`, () => {
      const runner = B040_RUNNERS[v.va];
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

  it('verifies Fog.#10023 assertion branches across B040 functions', () => {
    const m = new SparseMemory113c();
    expect(() => DRLG_InitActTownFloorTileData113c(m, 0, 0x2000)).toThrow(/^D2Common assertion failed at .*:1079$/);
    expect(() => DRLG_InitActTownFloorTileData113c(m, 0x1000, 0)).toThrow(/^D2Common assertion failed at .*:1080$/);
    m.setU8(0x1000 + 0x480, 0);
    m.setU32(0x1000 + 0x0c, 0);
    expect(() => DRLG_InitActTownFloorTileData113c(m, 0x1000, 0x2000)).toThrow(/^D2Common assertion failed at .*:1100$/);

    expect(() => ENV_GetCycleState113c(m, 0, 0x2000, 0x2004, 0x2008)).toThrow(/^D2Common assertion failed at .*:1351$/);

    m.setU32(0x3000 + 0x00, 10);
    m.setU32(0x3000 + 0x04, 10);
    m.setU32(0x3000 + 0x08, 20);
    m.setU32(0x3000 + 0x0c, 20);
    expect(() => COLLISION_SplitClipRectByRoomBounds113c(m, 0, 0x3000, 0x3100)).toThrow(/^D2Common assertion failed at .*:709$/);
    expect(() => D2CMP_10011_GetTileSubtileFlagsPtr113c(m, 0)).toThrow(/line 129/);
    expect(() => COLLISION_InitBoundingBox113c(m, 0, 1, 2)).toThrow(/^D2Common assertion failed at .*:161$/);

    m.setU32(0x6fdf1434, 0);
    expect(() => DATATBLS_FindWallTileCacheEntry113c(m, 10)).toThrow(/^D2Common assertion failed at .*:867$/);
    m.setU32(0x6fdf1434, 0x4000);
    m.setU32(0x6fdf1438, 1);
    m.setU32(0x4000, 99);
    expect(() => DATATBLS_FindWallTileCacheEntry113c(m, 10)).toThrow(/^D2Common assertion failed at .*:876$/);

    m.setU32(0x5000 + 0x64, 0);
    expect(() => DRLGLOGIC_GetRoomCoordListAtSubtile113c(m, 0x5000, 0, 0)).toThrow(/^D2Common assertion failed at .*:668$/);
    expect(() => DRLGLOGIC_GetRoomCoordListFromWorldSubtile113c(m, 0x5000, 0, 0)).toThrow(/^D2Common assertion failed at .*:668$/);
    expect(() => DRLGLOGIC_GetRoomCoordListIndexAtSubtile113c(m, 0x5000, 0, 0)).toThrow(/^D2Common assertion failed at .*:668$/);
  });
});
