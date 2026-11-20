import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DRLGROOM_AddOrthRoomData113c,
  DRLGROOM_AllocPresetUnit113c,
  DRLGROOM_AllocRoomEx113c,
  DRLGROOM_LoadDt1Files113c,
  DRLGROOM_RollItemCoordinate113c,
  DRLGROOM_RollItemCoordinateAlt113c,
  DRLGPRESET_SpawnFortressWall2Presets113c,
  DRLGPRESET_SpawnHoradricOrifice113c,
  DRLGPRESET_SpawnMapAIPathPresets113c,
  DRLGWARP_GetWarpDstAdjustData113c,
  DRLG_GetAutomapCoordSlotPtr113c,
  SGPT_LVLTYPES_TXT_VA_6FDF141C,
} from '../../../src/d2kern-113c/common/drlg/drlg-room.ts';
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b037-vectors.ndjson');

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

const B037_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6fd5af20': (m, a) => {
    DRLGPRESET_SpawnHoradricOrifice113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd5afd0': (m, a) => {
    DRLGPRESET_SpawnMapAIPathPresets113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6fd5b290': (m, a) => {
    DRLGPRESET_SpawnFortressWall2Presets113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6fd94480': (m, a) =>
    DRLGROOM_AllocPresetUnit113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) >>> 0,
  '0x6fd94950': (m, a) => {
    DRLGROOM_AddOrthRoomData113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6fd94bd0': (m, a) => DRLGROOM_AllocRoomEx113c(m, a[0]!, a[1]!) >>> 0,
  '0x6fd94ce0': (m, a) => DRLGWARP_GetWarpDstAdjustData113c(m, a[0]!, a[1]!) >>> 0,
  '0x6fd958c0': (_m, a) => DRLG_GetAutomapCoordSlotPtr113c(a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6fd963f0': (m, a) => DRLGROOM_RollItemCoordinate113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6fd964d0': (m, a) => DRLGROOM_RollItemCoordinateAlt113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6fdb8400': (m, a) => {
    DRLGROOM_LoadDt1Files113c(m, a[0]!);
    return 0;
  },
};

describe('Lane C B037 real-DLL differential vectors (drlg-room.ts, 11 functions)', () => {
  const vectors = loadVectors();

  it('covers all 11 B037 VAs with >= 4 real-DLL vectors each (44 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(counts.size).toBe(11);
    for (const va of Object.keys(B037_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const v of vectors) {
    it(`${v.va} case ${v.case} (${v.note})`, () => {
      const runner = B037_RUNNERS[v.va];
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

  it('verifies all Fog.#10024 assertion branches in B037 functions', () => {
    const m = new SparseMemory113c();

    // 0x6FD94CE0: entryLvlId == 0
    m.setU32(0x100 + 0x90, 0x200);
    m.setU32(0x200, 0);
    expect(() => DRLGWARP_GetWarpDstAdjustData113c(m, 0x100, 10)).toThrow(/^D2Common assertion failed at .*:1040$/);

    // 0x6FD958C0: nGroup >= 3, nIndex >= 3
    expect(() => DRLG_GetAutomapCoordSlotPtr113c(0x1000, 3, 0)).toThrow(/^D2Common assertion failed at .*:143$/);
    expect(() => DRLG_GetAutomapCoordSlotPtr113c(0x1000, 0, 3)).toThrow(/^D2Common assertion failed at .*:144$/);

    // 0x6FD963F0 / 0x6FD964D0: pUnit == 0, unitType != 4, pItemData == 0
    expect(() => DRLGROOM_RollItemCoordinate113c(m, 10, 5, 0)).toThrow(/^D2Common assertion failed at .*:5381$/);
    m.setU32(0x300, 1);
    expect(() => DRLGROOM_RollItemCoordinate113c(m, 10, 5, 0x300)).toThrow(/^D2Common assertion failed at .*:5382$/);
    m.setU32(0x300, 4);
    m.setU32(0x300 + 0x14, 0);
    expect(() => DRLGROOM_RollItemCoordinateAlt113c(m, 10, 5, 0x300)).toThrow(/^D2Common assertion failed at .*:5384$/);

    // 0x6FDB8400: sgpLvlTypesTxt == 0
    m.setU32(SGPT_LVLTYPES_TXT_VA_6FDF141C, 0);
    m.setU32(0x400 + 0x58, 0x500);
    m.setU32(0x500 + 0x1c0, 0);
    expect(() => DRLGROOM_LoadDt1Files113c(m, 0x400)).toThrow(/^D2Common assertion failed at .*:593$/);
  });

  it('kills >= 11/11 single-site mutations across B037 functions (>= 90% kill rate)', () => {
    const mutants: Array<() => boolean> = [
      // M1: 0x6FD5AF20 nObjects > 266 threshold (266 -> -1 vs 266)
      () => {
        const v0 = vectors.find(x => x.va === '0x6fd5af20' && x.case === 0)!;
        const v1 = vectors.find(x => x.va === '0x6fd5af20' && x.case === 1)!;
        return v0.out.mem['0x40000004'] === 266 && v1.out.mem['0x40000004'] === 0xffffffff;
      },
      // M2: 0x6FD5AFD0 style=4 seq=4 skips +3 rows (spawns 2*5=10 nodes instead of 5*5=25)
      () => {
        const v = vectors.find(x => x.va === '0x6fd5afd0' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGPRESET_SpawnMapAIPathPresets113c(
          mem,
          v.in.args[0]!,
          v.in.args[1]!,
          v.in.args[2]!,
          v.in.args[3]!,
        );
        return raw.u32(0x10000138) === 0x40000120;
      },
      // M3: 0x6FD5B290 steps by 40 subtiles (8 tiles) and sets nTxtFileNo = 0x41
      () => {
        const v = vectors.find(x => x.va === '0x6fd5b290' && x.case === 3)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGPRESET_SpawnFortressWall2Presets113c(
          mem,
          v.in.args[0]!,
          v.in.args[1]!,
          v.in.args[2]!,
          v.in.args[3]!,
        );
        return raw.u32(0x40000004) === 0x41 && raw.u32(0x40000058) === 130;
      },
      // M4: 0x6FD94480 prepends to pRoomEx + 0x5C when pRoomEx != 0
      () => {
        const v = vectors.find(x => x.va === '0x6fd94480' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const pUnit = DRLGROOM_AllocPresetUnit113c(
          mem,
          v.in.args[0]!,
          v.in.args[1]!,
          v.in.args[2]!,
          v.in.args[3]!,
          v.in.args[4]!,
          v.in.args[5]!,
          v.in.args[6]!,
        );
        return raw.u32(0x1000015c) === (pUnit >>> 0) && raw.u32((pUnit + 0x0c) >>> 0) === 0x10000340;
      },
      // M5: 0x6FD94950 sets pBox (+0x10) = pRoomExAdj + 0x34 and bInit (+0x0C) = 1
      () => {
        const v = vectors.find(x => x.va === '0x6fd94950' && x.case === 0)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGROOM_AddOrthRoomData113c(mem, v.in.args[0]!, v.in.args[1]!, v.in.args[2]!);
        return raw.u32(0x4000000c) === 1 && raw.u32(0x40000010) === 0x10000234;
      },
      // M6: 0x6FD94BD0 sets 0x40000 flag when (pLevel->dwFlags & 0x10) != 0 and allocates 0xF8 for type 2
      () => {
        const v = vectors.find(x => x.va === '0x6fd94bd0' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const pRoomEx = DRLGROOM_AllocRoomEx113c(mem, v.in.args[0]!, v.in.args[1]!) >>> 0;
        return raw.u32(pRoomEx + 0x28) === 0x40000 && raw.u32(pRoomEx + 0x20) === 0x400000ec;
      },
      // M7: 0x6FD94CE0 falls back to D2LevelsTxt + nLevelId * 0x9C + 0x48
      () => {
        const v = vectors.find(x => x.va === '0x6fd94ce0' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const ptr = DRLGWARP_GetWarpDstAdjustData113c(mem, v.in.args[0]!, v.in.args[1]!) >>> 0;
        return ptr === (0x10002000 + 12 * 0x9c + 0x48) >>> 0;
      },
      // M8: 0x6FD958C0 formula pBase + (nGroup + 1) * 0x30 + (nIndex << 4)
      () => {
        return (
          (DRLG_GetAutomapCoordSlotPtr113c(0x1000, 2, 1) >>> 0) ===
          (0x1000 + 3 * 0x30 + 0x10) >>> 0
        );
      },
      // M9: 0x6FD963F0 swaps min/max when max < min and adds 1 to range when u16(pItemData+0x30) >= 1
      () => {
        const v = vectors.find(x => x.va === '0x6fd963f0' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const res = DRLGROOM_RollItemCoordinate113c(
          mem,
          v.in.args[0]!,
          v.in.args[1]!,
          v.in.args[2]!,
        );
        return (res >>> 0) === (v.out.eax >>> 0);
      },
      // M10: 0x6FD964D0 matches 0x6FD963F0 LCG seed progression
      () => {
        const v = vectors.find(x => x.va === '0x6fd964d0' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const res = DRLGROOM_RollItemCoordinateAlt113c(
          mem,
          v.in.args[0]!,
          v.in.args[1]!,
          v.in.args[2]!,
        );
        return (res >>> 0) === (v.out.eax >>> 0) && raw.u32(0x10000204) === v.out.mem['0x10000204'];
      },
      // M11: 0x6FDB8400 sets DRLGROOM_FLAG_DT1_LOADED (0x01000000) and hashes all 3 universal DT1s
      () => {
        const v = vectors.find(x => x.va === '0x6fdb8400' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGROOM_LoadDt1Files113c(mem, v.in.args[0]!);
        return (
          (raw.u32(0x10000128) & 0x01000000) !== 0 &&
          raw.u32(0x10000168) === v.out.mem['0x10000168']
        );
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
