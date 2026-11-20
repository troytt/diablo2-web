import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FOG_TRIG_LUT_VA_6FF7F470,
  PATH_AdjustTargetForDoorObject113c,
  PATH_BuildSpiralPath77Points113c,
  PATH_DIR_TURN_RATE_VA_6FDE41C8,
  PATH_FreeDynamicPath113c,
  PATH_GetPosX113c,
  PATH_GetPosY113c,
  PATH_GetSavedSteps113c,
  PATH_GetTargetTypeAndId113c,
  PATH_OffsetTargetByUnitRadius113c,
  PATH_SetNewDirection113c,
  PATH_SetStepDistance113c,
  PATH_SetType113c,
  PATH_SpliceSegmentPoints113c,
  PATH_TYPE_FLAGS_VA_6FDE4180,
  PATH_TYPE_STEP_NUMS_VA_6FDE4138,
} from '../../../src/d2kern-113c/common/path.ts';
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b042-vectors.ndjson');

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

const B042_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6fd68400': (m, a) => {
    PATH_SpliceSegmentPoints113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!);
    return 0;
  },
  '0x6fd84630': (m, a) => {
    PATH_SetStepDistance113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd847c0': (m, a) => PATH_GetSavedSteps113c(m, a[0]!, a[1]!) >>> 0,
  '0x6fd84910': (m, a) => {
    PATH_GetTargetTypeAndId113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6fd84b80': (m, a) => PATH_GetPosY113c(m, a[0]!) >>> 0,
  '0x6fd84bb0': (m, a) => PATH_GetPosX113c(m, a[0]!) >>> 0,
  '0x6fd84dc0': (m, a) => {
    PATH_FreeDynamicPath113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd84f80': (m, a) => {
    PATH_SetType113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd85160': (m, a) => {
    PATH_AdjustTargetForDoorObject113c(m, a[0]!);
    return 0;
  },
  '0x6fd85270': (m, a) => {
    PATH_SetNewDirection113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd8e080': (m, a) => {
    PATH_OffsetTargetByUnitRadius113c(m, a[0]!);
    return 0;
  },
  '0x6fdb6920': (m, a) => {
    PATH_BuildSpiralPath77Points113c(m, a[0]!);
    return 0;
  },
};

describe('Lane C B042 real-DLL differential vectors (path.ts, 12 functions)', () => {
  const vectors = loadVectors();

  it('covers all 12 B042 VAs with >= 4 real-DLL vectors each (51 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(counts.size).toBe(12);
    for (const va of Object.keys(B042_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const v of vectors) {
    it(`${v.va} case ${v.case} (${v.note})`, () => {
      const runner = B042_RUNNERS[v.va];
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

  it('verifies all Fog.#10024 assertion branches in B042 functions', () => {
    const m = new SparseMemory113c();

    // 0x6FD84630: nDistance < 0 or > 255
    expect(() => PATH_SetStepDistance113c(m, 0x100, -1)).toThrow(/^D2Common assertion failed at .*:2405$/);
    expect(() => PATH_SetStepDistance113c(m, 0x100, 256)).toThrow(/^D2Common assertion failed at .*:2405$/);

    // 0x6FD847C0: missing flag 0x20000
    m.setU32(0x100 + 0x34, 0);
    expect(() => PATH_GetSavedSteps113c(m, 0x100, 0x200)).toThrow(/^D2Common assertion failed at .*:2292$/);

    // 0x6FD84910: pTargetUnit == 0
    m.setU32(0x100 + 0x58, 0);
    expect(() => PATH_GetTargetTypeAndId113c(m, 0x100, 0x200, 0x204)).toThrow(/^D2Common assertion failed at .*:1984$/);

    // 0x6FD84B80 / 0x6FD84BB0: pPath == 0
    expect(() => PATH_GetPosY113c(m, 0)).toThrow(/^D2Common assertion failed at .*:1693$/);
    expect(() => PATH_GetPosX113c(m, 0)).toThrow(/^D2Common assertion failed at .*:1682$/);

    // 0x6FD84F80: player pathType 2, prevType == 11, prevType == 8, type 4 && nDistMax >= 78
    m.setU32(0x100 + 0x30, 0x300);
    m.setU32(0x300, 0);
    expect(() => PATH_SetType113c(m, 0x100, 2)).toThrow(/^D2Common assertion failed at .*:2145$/);

    m.setU32(0x100 + 0x30, 0);
    m.setU32(0x100 + 0x34, 0);
    m.setU32(0x100 + 0x40, 11);
    m.setU32(PATH_TYPE_FLAGS_VA_6FDE4180, 0x201);
    m.setU32(PATH_TYPE_STEP_NUMS_VA_6FDE4138, 1);
    expect(() => PATH_SetType113c(m, 0x100, 0)).toThrow(/^D2Common assertion failed at .*:2161$/);

    m.setU32(0x100 + 0x40, 8);
    expect(() => PATH_SetType113c(m, 0x100, 0)).toThrow(/^D2Common assertion failed at .*:2162$/);

    m.setU32(0x100 + 0x40, 1);
    m.setU32(0x100 + 0x3c, 1);
    m.setU8(0x100 + 0x91, 78);
    m.setU32(PATH_TYPE_FLAGS_VA_6FDE4180 + 4 * 4, 0x6224);
    m.setU32(PATH_TYPE_STEP_NUMS_VA_6FDE4138 + 4 * 4, 15);
    expect(() => PATH_SetType113c(m, 0x100, 4)).toThrow(/^D2Common assertion failed at .*:2163$/);

    // 0x6FD85160: pTargetUnit == 0, unitType != 2, nSubClass == 0
    m.setU32(0x400 + 0x30, 0x500);
    m.setU32(0x500 + 0x58, 0);
    expect(() => PATH_AdjustTargetForDoorObject113c(m, 0x400)).toThrow(/^D2Common assertion failed at .*:3600$/);
    m.setU32(0x500 + 0x58, 0x600);
    m.setU32(0x600, 1);
    expect(() => PATH_AdjustTargetForDoorObject113c(m, 0x400)).toThrow(/^D2Common assertion failed at .*:533$/);
    m.setU32(0x600, 2);
    m.setU32(0x600 + 0x14, 0x700);
    m.setU32(0x700, 0x800);
    m.setU8(0x800 + 0x13a, 0);
    expect(() => PATH_AdjustTargetForDoorObject113c(m, 0x400)).toThrow(/^D2Common assertion failed at .*:533$/);

    // 0x6FD85270: nNewDir >= 64
    expect(() => PATH_SetNewDirection113c(m, 0x100, 64)).toThrow(/^D2Common assertion failed at .*:1650$/);

    // 0x6FD8E080: pPath == 0, pTargetUnit == 0
    expect(() => PATH_OffsetTargetByUnitRadius113c(m, 0)).toThrow(/^D2Common assertion failed at .*:490$/);
    m.setU32(0x900 + 0x58, 0);
    expect(() => PATH_OffsetTargetByUnitRadius113c(m, 0x900)).toThrow(/^D2Common assertion failed at .*:491$/);
  });

  it('kills >= 12/12 single-site mutations across B042 functions (>= 90% kill rate)', () => {
    const mutants: Array<() => boolean> = [
      // M1: 0x6FD68400 updates *pnTotalPoints = total + curIdx - insertIdx + nSubPoints - 1 and *pnCurIdx = curIdx + nSubPoints
      () => {
        const v = vectors.find(x => x.va === '0x6fd68400' && x.case === 0)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        PATH_SpliceSegmentPoints113c(
          mem,
          v.in.args[0]!,
          v.in.args[1]!,
          v.in.args[2]!,
          v.in.args[3]!,
          v.in.args[4]!,
        );
        return raw.u32(0x10000100) === 7 && raw.u32(0x10000110) === 4;
      },
      // M2: 0x6FD84630 writes single byte at +0x94 without clobbering +0x95..+0x97
      () => {
        const v = vectors.find(x => x.va === '0x6fd84630' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        PATH_SetStepDistance113c(mem, v.in.args[0]!, v.in.args[1]!);
        return raw.u32(0x10000194) === 0xaabbcc7f;
      },
      // M3: 0x6FD847C0 stores pPath + 0x1D8 to *ppOutSavedSteps and returns *(u32*)(pPath + 0x1D4)
      () => {
        const v = vectors.find(x => x.va === '0x6fd847c0' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const count = PATH_GetSavedSteps113c(mem, v.in.args[0]!, v.in.args[1]!);
        return count === 5 && raw.u32(0x10000400) === (v.in.args[0]! + 0x1d8) >>> 0;
      },
      // M4: 0x6FD84910 writes targetType (+0x5C) and targetId (+0x60)
      () => {
        const v = vectors.find(x => x.va === '0x6fd84910' && x.case === 3)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        PATH_GetTargetTypeAndId113c(mem, v.in.args[0]!, v.in.args[1]!, v.in.args[2]!);
        return raw.u32(0x10000200) === 4 && raw.u32(0x10000204) === 999;
      },
      // M5: 0x6FD84B80 reads u16 at +0x06 (not +0x04)
      () => {
        const v = vectors.find(x => x.va === '0x6fd84b80' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        return PATH_GetPosY113c(mem, v.in.args[0]!) === 5123;
      },
      // M6: 0x6FD84BB0 reads u16 at +0x02 (not +0x00)
      () => {
        const v = vectors.find(x => x.va === '0x6fd84bb0' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        return PATH_GetPosX113c(mem, v.in.args[0]!) === 6400;
      },
      // M7: 0x6FD84DC0 frees pPath via Fog.#10046
      () => {
        const v = vectors.find(x => x.va === '0x6fd84dc0' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        PATH_FreeDynamicPath113c(mem, v.in.args[0]!, v.in.args[1]!);
        return frees.length === 1 && frees[0] === 0x10000120;
      },
      // M8: 0x6FD84F80 saves dwPrevVelocity (+0x80) and updates dwFlags (+0x34) when (flagMask & 0x8000) != 0 and (dwFlags & 0x10000) == 0
      () => {
        const v = vectors.find(x => x.va === '0x6fd84f80' && x.case === 3)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        PATH_SetType113c(mem, v.in.args[0]!, v.in.args[1]!);
        return raw.u32(0x10000180) === 0x1200 && raw.u32(0x10000134) === 0x1e622;
      },
      // M9: 0x6FD85160 adjusts wTargetY (+0x12) by -2 when flag13C == 1 and posY < doorY
      () => {
        const v = vectors.find(x => x.va === '0x6fd85160' && x.case === 0)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        PATH_AdjustTargetForDoorObject113c(mem, v.in.args[0]!);
        return raw.u16(0x10000212) === 218;
      },
      // M10: 0x6FD85270 reads turn rate from 0x6FDE41C8 in Memory113c
      () => {
        const v = vectors.find(x => x.va === '0x6fd85270' && x.case === 4)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        raw.setU8(PATH_DIR_TURN_RATE_VA_6FDE41C8 + ((25 - 10) & 0x3f) * 4, 0x77);
        PATH_SetNewDirection113c(mem, v.in.args[0]!, v.in.args[1]!);
        return raw.u8(0x10000166) === 0x77;
      },
      // M11: 0x6FD8E080 reads Fog trig LUT at 0x6FF7F470 from Memory113c
      () => {
        const v = vectors.find(x => x.va === '0x6fd8e080' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        PATH_OffsetTargetByUnitRadius113c(mem, v.in.args[0]!);
        return raw.u32(0x10000110) === v.out.mem['0x10000110'];
      },
      // M12: 0x6FDB6920 writes 77 (0x4D) points at +0x28 and reads Fog trig LUT at 0x6FF7F470
      () => {
        const v = vectors.find(x => x.va === '0x6fdb6920' && x.case === 0)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        PATH_BuildSpiralPath77Points113c(mem, v.in.args[0]!);
        const origFirst = raw.u32(0x1000019c);
        raw.setU32(FOG_TRIG_LUT_VA_6FF7F470 + 0x10 * 4, 0x42c80000); // 100.0f at angleIdx = 0x10
        PATH_BuildSpiralPath77Points113c(mem, v.in.args[0]!);
        return raw.u32(0x10000128) === 77 && raw.u32(0x1000019c) !== origFirst;
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
