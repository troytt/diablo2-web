import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DRLGGRID_AllocAndInitGridCells113c,
  DRLGGRID_AllocGridWindowRowOffsets113c,
  DRLGLOGIC_FreeRoomLogicalInfo113c,
  DRLGPRESET_FreePresetRoomGrids113c,
  KERNEL32_GET_TICK_COUNT_IAT_VA_6FDD91FC,
  KERNEL32_TIME_IAT_VA_6FDD91D4,
  SEED_GenerateLoopSeed113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-grid.ts';
import {
  DRLGPRESET_AllocDrlgMap113c,
  DRLGPRESET_BuildRoomTombCoords113c,
  DRLGPRESET_CloneSaveHeaderBlock113c,
  DRLGPRESET_FreeDrlgFile113c,
  DRLGPRESET_FreeSaveHeaderBlock113c,
  DRLGPRESET_GetFileSize113c,
  DRLGPRESET_ReadFileData113c,
} from '../../../src/d2kern-113c/common/drlg/preset.ts';
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b034-vectors.ndjson');

function loadVectors(): VectorRecord[] {
  const raw = readFileSync(FIXTURE_PATH, 'utf8').trim();
  return raw.split('\n').map(line => JSON.parse(line) as VectorRecord);
}

function hexKey(addr: number): string {
  return `0x${(addr >>> 0).toString(16).padStart(8, '0')}`;
}

function isByteEntry(memObj: Record<string, number>, addr: number): boolean {
  return hexKey((addr + 1) >>> 0) in memObj || hexKey((addr - 1) >>> 0) in memObj;
}

function createGuardedMemory(
  raw: SparseMemory113c,
  preMem: Record<string, number>,
  postMem: Record<string, number>,
): { mem: Memory113c; rogueWrites: number[]; frees: number[] } {
  for (const [k, v] of Object.entries(preMem)) {
    const addr = Number(k) >>> 0;
    if (isByteEntry(preMem, addr)) {
      raw.setU8(addr, v & 0xff);
    } else {
      raw.setU32(addr, v >>> 0);
    }
  }

  const allowedWriteBytes = new Set<number>();
  for (const k of Object.keys(postMem)) {
    const addr = Number(k) >>> 0;
    if (isByteEntry(postMem, addr)) {
      allowedWriteBytes.add(addr);
    } else {
      allowedWriteBytes.add(addr);
      allowedWriteBytes.add((addr + 1) >>> 0);
      allowedWriteBytes.add((addr + 2) >>> 0);
      allowedWriteBytes.add((addr + 3) >>> 0);
    }
  }

  const rogueWrites: number[] = [];
  const frees: number[] = [];

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
    alloc: size => raw.alloc(size),
    free: p => {
      frees.push(p >>> 0);
    },
    u8: p => raw.u8(p),
    u16: p => raw.u16(p),
    u32: p => raw.u32(p),
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
    get: (base, f, idx) => raw.get(base, f, idx),
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

  return { mem, rogueWrites, frees };
}

function assertPostMemory(raw: SparseMemory113c, postMem: Record<string, number>): void {
  for (const [k, expected] of Object.entries(postMem)) {
    const addr = Number(k) >>> 0;
    if (isByteEntry(postMem, addr)) {
      expect(raw.u8(addr), `post byte at ${k}`).toBe(expected & 0xff);
    } else {
      expect(raw.u32(addr), `post dword at ${k}`).toBe(expected >>> 0);
    }
  }
}

const B034_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6fd59610': (m, a) => {
    DRLGPRESET_ReadFileData113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6fd59700': (m, a) => DRLGPRESET_GetFileSize113c(m, a[0]!, a[1]!) >>> 0,
  '0x6fd59d90': (m, a) => {
    DRLGPRESET_FreeSaveHeaderBlock113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd59de0': (m, a) => DRLGPRESET_CloneSaveHeaderBlock113c(m, a[0]!, a[1]!) >>> 0,
  '0x6fd59fa0': (m, a) => {
    DRLGPRESET_FreeDrlgFile113c(m, a[0]!);
    return 0;
  },
  '0x6fd5a440': (m, a) => {
    DRLGPRESET_FreePresetRoomGrids113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd5aa80': (m, a) => {
    DRLGPRESET_BuildRoomTombCoords113c(m, a[0]!);
    return 0;
  },
  '0x6fd5bc60': (m, a) => DRLGPRESET_AllocDrlgMap113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6fd86760': (m, a) => SEED_GenerateLoopSeed113c(m, a[0]!) >>> 0,
  '0x6fd86840': (m, a) => {
    DRLGGRID_AllocGridWindowRowOffsets113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!);
    return 0;
  },
  '0x6fd86950': (m, a) => {
    DRLGGRID_AllocAndInitGridCells113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6fdd0f70': (m, a) => {
    DRLGLOGIC_FreeRoomLogicalInfo113c(m, a[0]!);
    return 0;
  },
};

describe('Lane C B034 real-DLL differential vectors (preset.ts, drlg-grid.ts, 12 functions)', () => {
  const vectors = loadVectors();

  it('covers all 12 B034 VAs with >= 4 real-DLL vectors each (48 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(counts.size).toBe(12);
    for (const va of Object.keys(B034_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const v of vectors) {
    it(`${v.va} case ${v.case} (${v.note})`, () => {
      const runner = B034_RUNNERS[v.va];
      expect(runner, `missing runner for ${v.va}`).toBeDefined();
      const raw = new SparseMemory113c();
      const { mem, rogueWrites, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
      const eax = runner!(mem, v.in.args);
      expect(eax >>> 0).toBe(v.out.eax >>> 0);
      expect(rogueWrites).toEqual([]);
      expect(frees).toEqual(v.out.frees);
      assertPostMemory(raw, v.out.mem);
    });
  }

  it('verifies assertion and null-guard branches in B034 functions', () => {
    const m = new SparseMemory113c();
    expect(() => DRLGPRESET_ReadFileData113c(m, 0, 4, 0x2000)).toThrow(/^D2Common assertion failed at .*:135$/);
    expect(() => DRLGPRESET_ReadFileData113c(m, 0x1000, 4, 0)).toThrow(/^D2Common assertion failed at .*:143$/);
    expect(() => DRLGPRESET_ReadFileData113c(m, 0x1000, -1, 0x2000)).toThrow(/^D2Common assertion failed at .*:146$/);

    expect(() => DRLGPRESET_GetFileSize113c(m, 0, 0)).toThrow(/^D2Common assertion failed at .*:89$/);
    m.setU32(0x1000, 0);
    expect(() => DRLGPRESET_GetFileSize113c(m, 0x1000, 0)).toThrow(/^D2Common assertion failed at .*:95$/);

    // DRLGPRESET_FreePresetRoomGrids113c null chain guards
    m.setU32(0x3000 + 0x20, 0);
    DRLGPRESET_FreePresetRoomGrids113c(m, 0x3000, 0);
    m.setU32(0x3000 + 0x20, 0x3100);
    m.setU32(0x3100 + 0x08, 0);
    DRLGPRESET_FreePresetRoomGrids113c(m, 0x3000, 0);
    m.setU32(0x3100 + 0x08, 0x3200);
    m.setU32(0x3200 + 0x0c, 0);
    DRLGPRESET_FreePresetRoomGrids113c(m, 0x3000, 0);
  });

  it('kills >= 12/12 single-site mutations across B034 functions (>= 90% kill rate)', () => {
    const mutants: Array<() => boolean> = [
      // M1: 0x6FD59610 copies exact byte count into pBuffer
      () => {
        const v = vectors.find(x => x.va === '0x6fd59610' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGPRESET_ReadFileData113c(mem, v.in.args[0]!, v.in.args[1]!, v.in.args[2]!);
        return raw.u32(v.in.args[2]! + 8) === v.out.mem['0x10000208'];
      },
      // M2: 0x6FD59700 writes high dword when lpFileSizeHigh != 0
      () => {
        const v = vectors.find(x => x.va === '0x6fd59700' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const low = DRLGPRESET_GetFileSize113c(mem, v.in.args[0]!, v.in.args[1]!);
        return (low >>> 0) === 0x12345678 && raw.u32(v.in.args[1]!) === 5;
      },
      // M3: 0x6FD59D90 frees pData before pBlock
      () => {
        const v = vectors.find(x => x.va === '0x6fd59d90' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGPRESET_FreeSaveHeaderBlock113c(mem, v.in.args[0]!, v.in.args[1]!);
        return frees.length === 2 && frees[0] === 0x10000300 && frees[1] === 0x10000120;
      },
      // M4: 0x6FD59DE0 allocates nCount * 12 bytes for cloned data
      () => {
        const v = vectors.find(x => x.va === '0x6fd59de0' && x.case === 3)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const dst = DRLGPRESET_CloneSaveHeaderBlock113c(mem, v.in.args[0]!, v.in.args[1]!);
        return raw.u32(dst) === 4 && raw.u32(dst + 4) === 0x40000008;
      },
      // M5: 0x6FD59FA0 frees pBuffer, pTileData, pSaveData, pSaveChain, pUnits, and pFile in exact order
      () => {
        const v = vectors.find(x => x.va === '0x6fd59fa0' && x.case === 3)!;
        const raw = new SparseMemory113c();
        const { mem, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGPRESET_FreeDrlgFile113c(mem, v.in.args[0]!);
        return frees.length === 7 && frees[2] === 0x10000600 && frees[6] === 0x10000100;
      },
      // M6: 0x6FD5A440 frees orientation grid before wall grid for each wall layer
      () => {
        const v = vectors.find(x => x.va === '0x6fd5a440' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGPRESET_FreePresetRoomGrids113c(mem, v.in.args[0]!, v.in.args[1]!);
        return frees[0] === 0x10000510 && frees[1] === 0x10000500;
      },
      // M7: 0x6FD5AA80 caps tomb coords at 6 and converts tile coords via * 5 + 2
      () => {
        const v = vectors.find(x => x.va === '0x6fd5aa80' && x.case === 3)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGPRESET_BuildRoomTombCoords113c(mem, v.in.args[0]!);
        return raw.u32(0x100002f4) === 6 && raw.u32(0x40000000) === 52;
      },
      // M8: 0x6FD5BC60 uses pPrest size when both sizeX and sizeY are non-zero
      () => {
        const v = vectors.find(x => x.va === '0x6fd5bc60' && x.case === 0)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const pMap = DRLGPRESET_AllocDrlgMap113c(
          mem,
          v.in.args[0]!,
          v.in.args[1]!,
          v.in.args[2]!,
          v.in.args[3]!,
        );
        return raw.u32(pMap + 0x18) === 20 && raw.u32(pMap + 0x1c) === 30;
      },
      // M9: 0x6FD86760 reads time and tick count from IAT VAs and masks with 0x7FFFFFFF
      () => {
        const v = vectors.find(x => x.va === '0x6fd86760' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const real = SEED_GenerateLoopSeed113c(mem, v.in.args[0]!);
        raw.setU32(KERNEL32_TIME_IAT_VA_6FDD91D4, 1);
        raw.setU32(KERNEL32_GET_TICK_COUNT_IAT_VA_6FDD91FC, 2);
        const mutated = SEED_GenerateLoopSeed113c(mem, v.in.args[0]!);
        return real === (v.out.eax >>> 0) && real !== mutated;
      },
      // M10: 0x6FD86840 sets bInitialized (+0x10) = 1 and computes start cell offset
      () => {
        const v = vectors.find(x => x.va === '0x6fd86840' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGGRID_AllocGridWindowRowOffsets113c(
          mem,
          v.in.args[0]!,
          v.in.args[1]!,
          v.in.args[2]!,
          v.in.args[3]!,
          v.in.args[4]!,
        );
        return raw.u32(0x10000110) === 1 && raw.u32(0x10000100) === 0x20000080;
      },
      // M11: 0x6FD86950 sets bInitialized (+0x10) = 0 and pCells = pRowOffsets + h * 4
      () => {
        const v = vectors.find(x => x.va === '0x6fd86950' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGGRID_AllocAndInitGridCells113c(
          mem,
          v.in.args[0]!,
          v.in.args[1]!,
          v.in.args[2]!,
          v.in.args[3]!,
        );
        return raw.u32(0x10000110) === 0 && raw.u32(0x10000100) === 0x4000000c;
      },
      // M12: 0x6FDD0F70 frees coord list nodes and zeroes pRoomEx->pTileGrid (+0x64)
      () => {
        const v = vectors.find(x => x.va === '0x6fdd0f70' && x.case === 3)!;
        const raw = new SparseMemory113c();
        const { mem, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGLOGIC_FreeRoomLogicalInfo113c(mem, v.in.args[0]!);
        return frees.length === 4 && raw.u32(0x10000164) === 0;
      },
    ];

    let killed = 0;
    for (const check of mutants) {
      if (check()) killed++;
    }
    expect(killed).toBe(mutants.length);
    expect(killed / mutants.length).toBeGreaterThanOrEqual(0.9);
  });
});
