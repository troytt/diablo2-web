import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DRLGOUTDOORS_FreeOutdoorLevelData113c,
  DRLGOUTROOM_FreeOutdoorRoomData113c,
  DRLGPRESET_BuildPresetRoomGridsFromFile113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-grid.ts';
import { DRLGVER_BuildAndLocalizeRoomVertices113c } from '../../../src/d2kern-113c/common/drlg/drlg-ver.ts';
import {
  DRLGMAZE_AssignMazeRoomPrestId113c,
  DRLGMAZE_PickSequentialSpecialPresetFileIndex113c,
} from '../../../src/d2kern-113c/common/drlg/maze.ts';
import {
  DRLGPRESET_CopyMapPresetUnitNode113c,
  DRLGPRESET_FreePresetRoomData113c,
  DRLGPRESET_LoadFileFromArchive113c,
  DRLGPRESET_ReleaseCachedPresetFile113c,
} from '../../../src/d2kern-113c/common/drlg/preset.ts';
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import {
  PATH_GetTargetTypeAndPosition113c,
  PATH_ResetToDefaultType113c,
} from '../../../src/d2kern-113c/common/path.ts';
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

interface VectorRecord {
  va: string;
  name: string;
  case: number;
  in: {
    args: number[];
    mem: Record<string, number>;
  };
  out: {
    eax: number;
    hasRet: number;
    mem: Record<string, number>;
    allocBytes: number;
    frees: number[];
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b050-vectors.ndjson');

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
      if (!allowedReadBytes.has(b) && raw.u8(b) !== 0) {
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
      if ((size >>> 0) === 0) return 0;
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
      if ((p >>> 0) !== 0) {
        frees.push(p >>> 0);
      }
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

const B050_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD59900': (m, a) => DRLGPRESET_LoadFileFromArchive113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD59EA0': (m, a) => DRLGPRESET_CopyMapPresetUnitNode113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FD5A5B0': (m, a) => {
    DRLGPRESET_ReleaseCachedPresetFile113c(m, a[0]!);
    return 0;
  },
  '0x6FD5AB50': (m, a) => {
    DRLGPRESET_BuildPresetRoomGridsFromFile113c(m, a[0]!);
    return 0;
  },
  '0x6FD5AEC0': (m, a) => {
    DRLGPRESET_FreePresetRoomData113c(m, a[0]!);
    return 0;
  },
  '0x6FD5E490': (m, a) => DRLGMAZE_AssignMazeRoomPrestId113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FD5ECB0': (m, a) => {
    DRLGMAZE_PickSequentialSpecialPresetFileIndex113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6FD6B6E0': (m, a) => {
    DRLGVER_BuildAndLocalizeRoomVertices113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!);
    return 0;
  },
  '0x6FD80050': (m, a) => {
    PATH_GetTargetTypeAndPosition113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6FD85210': (m, a) => {
    PATH_ResetToDefaultType113c(m, a[0]!);
    return 0;
  },
  '0x6FD920E0': (m, a) => {
    DRLGOUTDOORS_FreeOutdoorLevelData113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6FD9A4D0': (m, a) => {
    DRLGOUTROOM_FreeOutdoorRoomData113c(m, a[0]!, a[1]!);
    return 0;
  },
};

describe('Lane C B050 real-DLL differential vectors (preset, drlg-grid, maze, drlg-ver, path, 12 functions)', () => {
  const vectors = loadVectors();

  it('covers all 12 B050 VAs with >= 4 real-DLL vectors each (89 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(vectors.length).toBe(89);
    expect(counts.size).toBe(12);
    for (const va of Object.keys(B050_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case}`, () => {
      const runner = B050_RUNNERS[v.va];
      expect(runner, `missing runner for ${v.va}`).toBeDefined();
      const raw = new SparseMemory113c();
      const { mem, rogueReads, rogueWrites, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
      const eax = runner!(mem, v.in.args);
      if (v.out.hasRet !== 0) {
        expect(eax >>> 0).toBe(v.out.eax >>> 0);
      }
      expect(rogueReads).toEqual([]);
      expect(rogueWrites).toEqual([]);
      expect(frees).toEqual(v.out.frees);
      assertPostMemory(raw, v.in.mem, v.out.mem);
    });
  }

  it('verifies Fog.#10023/10265 assertion branches across B050 functions', () => {
    const expectAssert = (fn: () => unknown, file: string, line: number): void => {
      let caught: unknown;
      try {
        fn();
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(D2CommonAssertError);
      expect((caught as D2CommonAssertError).file).toBe(file);
      expect((caught as D2CommonAssertError).line).toBe(line);
    };
    const m = new SparseMemory113c();
    expectAssert(() => PATH_GetTargetTypeAndPosition113c(m, 0, 0x2000), 'Path.cpp', 1994);
    m.setU32(0x1000 + 0x30, 0);
    expectAssert(() => PATH_ResetToDefaultType113c(m, 0x1000), 'Path.cpp', 2174);

    m.setU32(0x1000, 0);
    m.setU32(0x1000 + 0x58, 0x2000);
    m.setU32(0x2000 + 0x1c0, 2);
    expectAssert(() => DRLGMAZE_AssignMazeRoomPrestId113c(m, 0x1000, 0), 'DrlgMaze.cpp', 352);
    m.setU32(0x2000 + 0x1c0, 5);
    expectAssert(() => DRLGMAZE_AssignMazeRoomPrestId113c(m, 0x1000, 0), 'DrlgMaze.cpp', 352);
  });
});


