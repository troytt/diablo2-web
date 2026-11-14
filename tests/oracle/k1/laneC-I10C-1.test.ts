import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import {
  COLLISION_CheckMaskWithPattern1_113c,
  COLLISION_CheckMaskWithPattern2_113c,
  COLLISION_GetMaskWithPattern2_113c,
  COLLISION_ResetMaskWithPattern113c,
  COLLISION_ResetMaskWithPatternSimple113c,
  COLLISION_SetUnitCollisionMaskWithPattern113c,
} from '../../../src/d2kern-113c/common/collision.ts';
import {
  DRLGPRESET_InitPresetRoomEx113c,
  DRLGROOM_CopyPresetUnitsInTileBox113c,
  DRLGROOM_FlagIfAdjacentToTown113c,
  DRLGROOM_InsertOrthSorted113c,
  DRLGROOM_LinkRoomsBidirectional113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-room.ts';
import { DRLGOUTDOORS_GetLevelLinkVisBit113c } from '../../../src/d2kern-113c/common/drlg/outdoors.ts';
import { DRLGROOMTILE_InitFloorTileData113c } from '../../../src/d2kern-113c/common/drlg/room-tile.ts';
import {
  PATH_ComputeDirectSinglePointPath113c,
  PATH_SetPrecisionPosAndRecacheRoom113c,
} from '../../../src/d2kern-113c/common/path.ts';
import { SparseMemory113c, type Memory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts';

interface VectorRecord {
  va: string;
  name: string;
  case: number;
  note: string;
  retMask: number;
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i10c-1-vectors.ndjson');

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
    const got = raw.u32(addr) >>> 0;
    const want = expected >>> 0;
    if (got !== want) {
      throw new Error(`post dword mismatch at ${k}: got=${got} want=${want}`);
    }
  }
  for (const [k, preVal] of Object.entries(preMem)) {
    if (!(k in postMem)) {
      const addr = Number(k) >>> 0;
      const got = raw.u32(addr) >>> 0;
      const want = preVal >>> 0;
      if (got !== want) {
        throw new Error(`unchanged pre dword mismatch at ${k}: got=${got} want=${want}`);
      }
    }
  }
}

const I10C1_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD9BCF0': (m, a) => {
    COLLISION_ResetMaskWithPattern113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!);
    return 0;
  },
  '0x6FD9BE10': (m, a) => {
    COLLISION_ResetMaskWithPatternSimple113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!);
    return 0;
  },
  '0x6FD9BE90': (m, a) => {
    COLLISION_SetUnitCollisionMaskWithPattern113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!);
    return 0;
  },
  '0x6FD9CE00': (m, a) =>
    COLLISION_CheckMaskWithPattern1_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) & 0xffff,
  '0x6FD9CE90': (m, a) =>
    COLLISION_CheckMaskWithPattern2_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) >>> 0,
  '0x6FD9CF40': (m, a) =>
    COLLISION_GetMaskWithPattern2_113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) & 0xffff,
  '0x6FD5DA40': (m, a) => {
    PATH_SetPrecisionPosAndRecacheRoom113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6FD85530': (m, a) => PATH_ComputeDirectSinglePointPath113c(m, a[0]!) >>> 0,
  '0x6FD5AE10': (m, a) =>
    DRLGPRESET_InitPresetRoomEx113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) >>> 0,
  '0x6FD944F0': (m, a) => {
    DRLGROOM_FlagIfAdjacentToTown113c(m, a[0]!);
    return 0;
  },
  '0x6FD94B20': (m, a) => {
    DRLGROOM_InsertOrthSorted113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6FD94BA0': (m, a) => {
    DRLGROOM_LinkRoomsBidirectional113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6FDD3630': (m, a) => {
    DRLGROOM_CopyPresetUnitsInTileBox113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!);
    return 0;
  },
  '0x6FD92A20': (m, a) => DRLGOUTDOORS_GetLevelLinkVisBit113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDB9170': (m, a) =>
    DRLGROOMTILE_InitFloorTileData113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) >>> 0,
};

function verifyVector(v: VectorRecord, overrideEax?: number, corruptAddr?: number): void {
  const runner = I10C1_RUNNERS[v.va];
  if (!runner) throw new Error(`missing runner for ${v.va}`);
  const raw = new SparseMemory113c();
  const { mem, rogueReads, rogueWrites, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
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
  assertPostMemory(raw, v.in.mem, v.out.mem);
}

describe('Lane C I10C-1 real-DLL differential vectors (15 functions)', () => {
  const vectors = loadVectors();

  it('covers all 15 I10C-1 VAs with >= 6 real-DLL vectors each (110 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(vectors.length).toBe(110);
    expect(counts.size).toBe(15);
    for (const va of Object.keys(I10C1_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(6);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case} (${v.note})`, () => {
      verifyVector(v);
    });
  }

  it('negative control: mutating return value or post-memory state is caught for every I10C-1 function', () => {
    for (const va of Object.keys(I10C1_RUNNERS)) {
      const sample = vectors.find(
        v => v.va === va && (v.out.hasRet !== 0 || Object.keys(v.out.mem).length > 0),
      )!;
      if (sample.out.hasRet !== 0) {
        expect(() => verifyVector(sample, (sample.out.eax ^ 1) >>> 0)).toThrow(/eax mismatch/);
      }
      const postKeys = Object.keys(sample.out.mem);
      if (postKeys.length > 0) {
        expect(() => verifyVector(sample, undefined, Number(postKeys[0]!) >>> 0)).toThrow(
          /post dword/,
        );
      }
    }
  });

  it('handles null-room guards, boundary patterns, and edge branches across I10C-1', () => {
    const mem = new SparseMemory113c();

    // F01..F06 null room / out-of-range pattern checks
    COLLISION_ResetMaskWithPattern113c(mem, 0, 10, 10, 1, 0x100);
    COLLISION_ResetMaskWithPattern113c(mem, 0, 10, 10, 9, 0x100);
    COLLISION_ResetMaskWithPatternSimple113c(mem, 0, 10, 10, 1, 0x100);
    COLLISION_ResetMaskWithPatternSimple113c(mem, 0, 10, 10, 9, 0x100);
    COLLISION_SetUnitCollisionMaskWithPattern113c(mem, 0, 10, 10, 9, 0x100);
    expect(COLLISION_CheckMaskWithPattern1_113c(mem, 0, 10, 10, 99, 0x0400)).toBe(0xffff);
    expect(COLLISION_CheckMaskWithPattern2_113c(mem, 0, 10, 10, 99, 0x0400)).toBe(1);
    expect(COLLISION_GetMaskWithPattern2_113c(mem, 0, 10, 10, 99, 0x0400)).toBe(0xffff);

    // F08 static target unit (type 2, 4, 5) and boundary |dx|/|dy| == 99 vs 100
    const pPath = mem.alloc(0x200);
    const pTarget = mem.alloc(0x60);
    const pStaticPath = mem.alloc(0x40);
    mem.setU32(pPath + 0x00, (100 << 16) | 0x8000);
    mem.setU32(pPath + 0x04, (100 << 16) | 0x8000);
    mem.setU32(pPath + 0x58, pTarget);
    mem.setU32(pTarget + 0x00, 2); // static object unit
    mem.setU32(pTarget + 0x2c, pStaticPath);
    mem.setU32(pStaticPath + 0x0c, 199); // dx = +99 (valid)
    mem.setU32(pStaticPath + 0x10, 1); // dy = -99 (valid)
    expect(PATH_ComputeDirectSinglePointPath113c(mem, pPath)).toBe(1);
    expect(mem.u32(pPath + 0x34) & 1).toBe(1);

    mem.setU32(pTarget + 0x00, 4); // static item unit
    expect(PATH_ComputeDirectSinglePointPath113c(mem, pPath)).toBe(1);

    mem.setU32(pStaticPath + 0x10, 0); // ty == 0 -> returns 0
    expect(PATH_ComputeDirectSinglePointPath113c(mem, pPath)).toBe(0);

    mem.setU32(pStaticPath + 0x0c, 0); // tx < 100 by -100 -> returns 0
    mem.setU32(pStaticPath + 0x10, 100);
    expect(PATH_ComputeDirectSinglePointPath113c(mem, pPath)).toBe(0);

    // F14 unlinked adjacent level returns 0, even if adjId is placed just past index 7 at pVisArr[8]
    const pLevel = mem.alloc(0x200);
    const pAdj = mem.alloc(0x200);
    const pDrlg = mem.alloc(0x100);
    const pWarp = mem.alloc(0x80);
    mem.setU32(pLevel + 0x1d0, 5);
    mem.setU32(pLevel + 0x1b4, pDrlg);
    mem.setU32(pDrlg + 0x90, pWarp);
    mem.setU32(pWarp + 0x00, 5);
    mem.setU32(pWarp + 0x04 + 8 * 4, 999); // index 8 out of bounds of 0..7 loop
    mem.setU32(pAdj + 0x1d0, 999);
    expect(DRLGOUTDOORS_GetLevelLinkVisBit113c(mem, pLevel, pAdj)).toBe(0);

    // F01 wMask === 1 with pat === 1 must clear 0x1000 at center subtile
    // F03 pat === 5 falls into default cross-pattern set
    // F04 pat === 3 preserves bit 0 (0x0001)
    const pRoom = mem.alloc(0x100);
    const pColl = mem.alloc(0x40);
    const pGrid = mem.alloc(10 * 10 * 2);
    mem.setU32(pRoom + 0x20, pColl);
    mem.setU32(pRoom + 0x4c, 0);
    mem.setU32(pRoom + 0x50, 0);
    mem.setU32(pRoom + 0x54, 10);
    mem.setU32(pRoom + 0x58, 10);
    mem.setU32(pColl + 0x00, 0);
    mem.setU32(pColl + 0x04, 0);
    mem.setU32(pColl + 0x08, 10);
    mem.setU32(pColl + 0x0c, 10);
    mem.setU32(pColl + 0x20, pGrid);

    mem.setU16(pGrid + (5 * 10 + 5) * 2, 0x1001);
    COLLISION_ResetMaskWithPattern113c(mem, pRoom, 5, 5, 1, 1);
    expect(mem.u16(pGrid + (5 * 10 + 5) * 2)).toBe(0);

    COLLISION_SetUnitCollisionMaskWithPattern113c(mem, pRoom, 5, 5, 5, 0x0004);
    expect(mem.u16(pGrid + (5 * 10 + 5) * 2) & 0x0004).toBe(0x0004);

    mem.setU16(pGrid + (5 * 10 + 5) * 2, 0x0001);
    expect(COLLISION_CheckMaskWithPattern1_113c(mem, pRoom, 5, 5, 3, 0x0001)).toBe(1);

    // F08 ty2 === ry exact top room boundary keeps dwFlags bit 0 clear
    const pPath2 = mem.alloc(0x200);
    mem.setU32(pRoom + 0x50, 2); // ry = 2
    mem.setU32(pPath2 + 0x00, (3 << 16) | 0x8000);
    mem.setU32(pPath2 + 0x04, (3 << 16) | 0x8000);
    mem.setU16(pPath2 + 0x10, 5);
    mem.setU16(pPath2 + 0x12, 2); // ty2 == ry == 2
    mem.setU32(pPath2 + 0x1c, pRoom);
    mem.setU32(pPath2 + 0x34, 0);
    mem.setU32(pPath2 + 0x50, 2048);
    expect(PATH_ComputeDirectSinglePointPath113c(mem, pPath2)).toBe(1);
    expect(mem.u32(pPath2 + 0x34) & 1).toBe(0);

    // F10 nRoomsNear === 0 does not inspect ppRoomsNear[0] even if it points to a town room
    const pRoomEx = mem.alloc(0x100);
    const pTownRoomEx = mem.alloc(0x100);
    const pTownLevel = mem.alloc(0x200);
    const ppNear = mem.alloc(0x10);
    mem.setU32(pTownLevel + 0x1d0, 1); // Rogue Encampment (town)
    mem.setU32(pTownRoomEx + 0x58, pTownLevel);
    mem.setU32(ppNear, pTownRoomEx);
    mem.setU32(pRoomEx + 0x58, pLevel); // level 5 (non-town)
    mem.setU32(pRoomEx + 0x08, ppNear);
    mem.setU32(pRoomEx + 0x2c, 0); // nRoomsNear == 0
    mem.setU32(pRoomEx + 0x28, 0);
    DRLGROOM_FlagIfAdjacentToTown113c(mem, pRoomEx);
    expect(mem.u32(pRoomEx + 0x28)).toBe(0);

    // F13 boxH * 5 scaling copies unit at uy = 18 when box = {0, 0, 4, 4} (endY = 20)
    const pBox = mem.alloc(0x10);
    mem.setU32(pBox + 0x00, 0);
    mem.setU32(pBox + 0x04, 0);
    mem.setU32(pBox + 0x08, 4);
    mem.setU32(pBox + 0x0c, 4);
    const ppDstRoomEx = mem.alloc(0x08);
    const pDstRoomEx = mem.alloc(0x100);
    mem.setU32(ppDstRoomEx, pDstRoomEx);
    const pSrcWrap = mem.alloc(0x80);
    const pSrcInner = mem.alloc(0x80);
    const pPresetUnit = mem.alloc(0x30);
    mem.setU32(pSrcWrap + 0x50, pSrcInner);
    mem.setU32(pSrcInner + 0x54, pPresetUnit);
    mem.setU32(pPresetUnit + 0x00, 1);
    mem.setU32(pPresetUnit + 0x04, 100);
    mem.setU32(pPresetUnit + 0x08, 5); // ux = 5
    mem.setU32(pPresetUnit + 0x0c, 0); // pNext = 0
    mem.setU32(pPresetUnit + 0x10, 0);
    mem.setU32(pPresetUnit + 0x18, 18); // uy = 18 (16 < 18 < 20)
    DRLGROOM_CopyPresetUnitsInTileBox113c(mem, pBox, 2, 2, ppDstRoomEx, 0, pSrcWrap);
    expect(mem.u32(pDstRoomEx + 0x5c)).not.toBe(0);
  });
});
