import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  D2COMMON_GDWBITMASKS_IAT_VA_113C,
  D2COMMON_SGPT_DATATABLES_VA_113C,
  D2CommonAssertError,
  DATATABLES_OFF_113C,
} from '../../../src/d2kern-113c/common/inline-helpers.ts';
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

  const checkWrite = (addr: number, width: number, _newVal: number): void => {
    for (let i = 0; i < width; i++) {
      const b = (addr + i) >>> 0;
      if (!allowedWriteBytes.has(b)) {
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

import { DRLGROOM_AllocAndInsertOrthNode113c } from '../../../src/d2kern-113c/common/drlg/drlg-room.ts';
import {
  DRLGOUTJUNG_SpawnAct2LutGholeinBorderPreset113c,
  DRLGOUTJUNG_SpawnKurastCausewayPresets113c,
  DRLGOUTJUNG_SpawnLowerKurastPresets113c,
  DRLGOUTJUNG_SpawnOuterSteppesTransitions113c,
  DRLGOUTJUNG_SpawnPandemoniumFortressPresets113c,
} from '../../../src/d2kern-113c/common/drlg/out-jung.ts';
import { DRLGROOMTILE_FindAdjacentRoomTileGrid113c } from '../../../src/d2kern-113c/common/drlg/room-tile.ts';
import {
  DUNGEON_GetRoomCoordListFromSubtile113c,
  DUNGEON_IsTownLevelId113c,
} from '../../../src/d2kern-113c/common/dungeon.ts';
import {
  PATH_AStar_ComputePath113c,
  PATH_AllocDynamicPath113c,
  PATH_ComputeKnockbackServer113c,
  PATH_FindValidTargetPosition113c,
  PATH_IdaStar_ComputeInRoomBounds113c,
  PATH_RaycastVelocityAndCollide113c,
  PATH_RebuildTurnCornersWithDirOffset113c,
  PATH_TYPE_FLAGS_6FDE4180,
  PATH_TYPE_FLAGS_VA_6FDE4180,
  PATH_TYPE_STEP_NUMS_6FDE4138,
  PATH_TYPE_STEP_NUMS_VA_6FDE4138,
  PATH_WallFollow_StepBidirectional113c,
} from '../../../src/d2kern-113c/common/path.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i11c-1-vectors.ndjson');

function loadVectors(): VectorRecord[] {
  const raw = readFileSync(FIXTURE_PATH, 'utf8').trim();
  return raw.split('\n').map(line => JSON.parse(line) as VectorRecord);
}

const I11C1_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD68830': (m, a) =>
    PATH_WallFollow_StepBidirectional113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!, a[6]!) >>> 0,
  '0x6FD85E00': (m, a) => PATH_FindValidTargetPosition113c(m, a[0]!) >>> 0,
  '0x6FD86030': (m, a) =>
    PATH_AllocDynamicPath113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) >>> 0,
  '0x6FD8B230': (m, a) => DUNGEON_IsTownLevelId113c(m, a[0]!) >>> 0,
  '0x6FD8C680': (m, a) => DUNGEON_GetRoomCoordListFromSubtile113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD94F20': (m, a) => {
    DRLGROOM_AllocAndInsertOrthNode113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6FDB7390': (m, a) => PATH_ComputeKnockbackServer113c(m, a[0]!) >>> 0,
  '0x6FDB74C0': (m, a) => PATH_RebuildTurnCornersWithDirOffset113c(m, a[0]!) >>> 0,
  '0x6FDB7630': (m, a) => PATH_RaycastVelocityAndCollide113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDB8780': (m, a) =>
    DRLGROOMTILE_FindAdjacentRoomTileGrid113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) >>> 0,
  '0x6FDC0BB0': (m, a) => PATH_IdaStar_ComputeInRoomBounds113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDCB630': (m, a) => PATH_AStar_ComputePath113c(m, a[0]!) >>> 0,
  '0x6FDD58E0': (m, a) => {
    DRLGOUTJUNG_SpawnLowerKurastPresets113c(m, a[0]!);
    return 0;
  },
  '0x6FDD5930': (m, a) => {
    DRLGOUTJUNG_SpawnKurastCausewayPresets113c(m, a[0]!);
    return 0;
  },
  '0x6FDD5990': (m, a) => {
    DRLGOUTJUNG_SpawnAct2LutGholeinBorderPreset113c(m, a[0]!);
    return 0;
  },
  '0x6FDD5FD0': (m, a) => {
    DRLGOUTJUNG_SpawnPandemoniumFortressPresets113c(m, a[0]!);
    return 0;
  },
  '0x6FDD6000': (m, a) => {
    DRLGOUTJUNG_SpawnOuterSteppesTransitions113c(m, a[0]!);
    return 0;
  },
};

function verifyVector(v: VectorRecord, overrideEax?: number, corruptAddr?: number): void {
  const runner = I11C1_RUNNERS[v.va];
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

describe('Lane C I11C-1 real-DLL differential vectors (17 functions)', () => {
  const vectors = loadVectors();

  it('covers all 17 I11C-1 VAs with >= 4 real-DLL vectors each (101 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(vectors.length).toBe(101);
    expect(counts.size).toBe(17);
    for (const va of Object.keys(I11C1_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case} (${v.note})`, () => {
      verifyVector(v);
    });
  }

  it('negative control: mutating return value or post-memory state is caught for every I11C-1 function', () => {
    for (const va of Object.keys(I11C1_RUNNERS)) {
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

  it('verifies assertion paths and edge guards across I11C-1', () => {
    const mem = new SparseMemory113c();

    // F06 (0x6FDB7630) assert sites: pUnit invalid, dwPathType == 4, targetX == 0, targetY == 0
    const pPath = mem.alloc(0x200);
    const pUnit = mem.alloc(0x80);
    const pPt = mem.alloc(8);
    mem.setU32(pUnit, 2); // object unit -> invalid for F06
    mem.setU32(pPath + 0x30, pUnit);
    mem.setU16(pPt, 105);
    mem.setU16(pPt + 2, 105);
    expect(() => PATH_RaycastVelocityAndCollide113c(mem, pPath, pPt)).toThrow(D2CommonAssertError);
    mem.setU32(pUnit, 0);
    mem.setU32(pPath + 0x3c, 4);
    expect(() => PATH_RaycastVelocityAndCollide113c(mem, pPath, pPt)).toThrow(D2CommonAssertError);
    mem.setU32(pPath + 0x3c, 2);
    mem.setU16(pPt, 0);
    expect(() => PATH_RaycastVelocityAndCollide113c(mem, pPath, pPt)).toThrow(D2CommonAssertError);
    mem.setU16(pPt, 105);
    mem.setU16(pPt + 2, 0);
    expect(() => PATH_RaycastVelocityAndCollide113c(mem, pPath, pPt)).toThrow(D2CommonAssertError);

    // F07 (0x6FDC0BB0) w * h > 0xC350 assertion
    const pRect = mem.alloc(16);
    mem.setU32(pRect + 8, 300);
    mem.setU32(pRect + 12, 200);
    expect(() => PATH_IdaStar_ComputeInRoomBounds113c(mem, pRect, mem.alloc(0x40))).toThrow(
      D2CommonAssertError,
    );

    // F17 (0x6FD8C680) NULL pLogicalRoomInfo assertion
    const pRoom = mem.alloc(0x80);
    const pRoomEx = mem.alloc(0x80);
    mem.setU32(pRoom + 0x10, pRoomEx);
    expect(() => DUNGEON_GetRoomCoordListFromSubtile113c(mem, pRoom, 10, 10)).toThrow(
      D2CommonAssertError,
    );

    // Build shared walkable room helper for F01/F02/F04/F06/F07 edge cases
    const em = new SparseMemory113c();
    const room = em.alloc(0x80);
    const grid = em.alloc(0x28);
    const rw = 40;
    const rh = 40;
    const rx = 100;
    const ry = 100;
    const cells = em.alloc(rw * rh * 2 + 16);
    const near = em.alloc(4);
    em.setU32(near, room);
    em.setU32(room, near);
    em.setU32(room + 0x24, 1);
    em.setU32(room + 0x20, grid);
    em.setU32(room + 0x4c, rx);
    em.setU32(room + 0x50, ry);
    em.setU32(room + 0x54, rw);
    em.setU32(room + 0x58, rh);
    em.setU32(grid, rx);
    em.setU32(grid + 4, ry);
    em.setU32(grid + 8, rw);
    em.setU32(grid + 12, rh);
    em.setU32(grid + 0x20, cells);
    const setCell = (x: number, y: number, mask: number): void => {
      em.setU16(cells + ((y - ry) * rw + (x - rx)) * 2, mask);
    };

    // F02 (0x6FD85E00): dwFlags & 0x40000 assert (#4)
    const fi = em.alloc(0x40);
    const fp = em.alloc(0x200);
    const fu = em.alloc(0x80);
    em.setU32(fp + 0x30, fu);
    em.setU32(fp + 0x34, 0x40000);
    em.setU32(fi + 0x30, fp);
    expect(() => PATH_FindValidTargetPosition113c(em, fi)).toThrow(D2CommonAssertError);

    // F02 (#7): step 1 hits start -> returns 0
    em.setU32(fp + 0x34, 0);
    em.setU32(fu, 0);
    em.setU16(fi, 110);
    em.setU16(fi + 2, 110);
    em.setU16(fi + 4, 111);
    em.setU16(fi + 6, 110);
    em.setU32(fi + 0x08, room);
    em.setU32(fi + 0x0c, room);
    em.setU32(fi + 0x28, 1);
    em.setU32(fi + 0x2c, 0x1c01);
    expect(PATH_FindValidTargetPosition113c(em, fi)).toBe(0);

    // F02 (#5, #6): dir2 candidate (qIdx=2 -> [4, 2, 6], dir2=6 dx=0 dy=-1) with uType=0 nudge vs uType=1 no nudge
    em.setU32(fi + 0x28, 0); // pattern 0 = single cell so dir0/dir1 block cleanly
    em.setU16(fi, 110);
    em.setU16(fi + 2, 110);
    em.setU16(fi + 4, 113);
    em.setU16(fi + 6, 110);
    setCell(112, 110, 0x1c01); // block dir0 (-1, 0)
    setCell(113, 111, 0x1c01); // block dir1 (0, +1)
    em.setU32(fu, 0); // uType === 0 -> nudges out of (113, 109) because adx=3<5, ady=1<5
    expect(PATH_FindValidTargetPosition113c(em, fi)).toBe(1);
    const nudgedX0 = em.u16(fi + 4);
    const nudgedY0 = em.u16(fi + 6);
    em.setU16(fi + 4, 113);
    em.setU16(fi + 6, 110);
    em.setU32(fu, 1); // uType !== 0 -> stays at (113, 109)
    expect(PATH_FindValidTargetPosition113c(em, fi)).toBe(1);
    expect(em.u16(fi + 4)).toBe(113);
    expect(em.u16(fi + 6)).toBe(109);
    expect(nudgedX0 !== 113 || nudgedY0 !== 109).toBe(true);
    setCell(112, 110, 0);
    setCell(113, 111, 0);
    em.setU32(fi + 0x28, 1);

    // F03 (0x6FD86030): monStats wBaseId === 0x26 (#10)
    const am = new SparseMemory113c();
    for (let i = 0; i < PATH_TYPE_FLAGS_6FDE4180.length; i++) {
      am.setU32(PATH_TYPE_FLAGS_VA_6FDE4180 + i * 4, PATH_TYPE_FLAGS_6FDE4180[i]!);
      am.setU32(PATH_TYPE_STEP_NUMS_VA_6FDE4138 + i * 4, PATH_TYPE_STEP_NUMS_6FDE4138[i]!);
    }
    const dt = am.alloc(0xd00);
    const monStats = am.alloc(0x1a8 * 10);
    const monStats2 = am.alloc(0x134 * 10);
    const bmTbl = am.alloc(128);
    for (let b = 0; b < 32; b++) {
      am.setU32(bmTbl + b * 4, (1 << b) >>> 0);
    }
    am.setU32(D2COMMON_GDWBITMASKS_IAT_VA_113C, bmTbl);
    am.setU32(D2COMMON_SGPT_DATATABLES_VA_113C, dt);
    am.setU32(dt + DATATABLES_OFF_113C.pMonStatsTxt, monStats);
    am.setU32(dt + DATATABLES_OFF_113C.nMonStatsTxtRecordCount, 50);
    am.setU32(dt + DATATABLES_OFF_113C.pMonStats2Txt, monStats2);
    am.setU32(dt + DATATABLES_OFF_113C.nMonStats2TxtRecordCount, 10);
    am.setU16(monStats + 0x1a8 * 5 + 0x02, 0x26); // cid=5 -> baseId = 0x26
    am.setU16(monStats + 0x1a8 * 5 + 0x04, 5); // wMonProp / stats2 idx
    am.setU8(monStats2 + 0x134 * 5 + 0x06, 2); // sizeX
    const au = am.alloc(0x100);
    am.setU32(au, 1); // monster
    am.setU32(au + 0x04, 5); // dwClassId = 5
    expect(PATH_AllocDynamicPath113c(am, 0, 0, 105, 105, au, 0)).toBe(0);
    const outPath = am.u32(au + 0x2c);
    expect(am.u32(outPath + 0x48)).toBe(5);
    expect(am.u32(outPath + 0x50)).toBe(0x804);
    expect(am.u8(outPath + 0x91)).toBe(0x0e);

    // F04 (0x6FDB7390): pTargetUnit dwUnitType = 5 (#21, #22) and pStaticPath = 0 (#19)
    const ki = em.alloc(0x40);
    const kp = em.alloc(0x200);
    const kt = em.alloc(0x80);
    const kts = em.alloc(0x40);
    em.setU32(ki + 0x08, room);
    em.setU32(ki + 0x0c, room);
    em.setU32(ki + 0x28, 0);
    em.setU32(ki + 0x2c, 0x1c01);
    em.setU32(ki + 0x30, kp);
    em.setU32(kp + 0x1c, room);
    em.setU32(kp + 0x48, 0);
    em.setU32(kp + 0x50, 0x1c01);
    em.setU32(kp + 0x58, kt); // pTargetUnit (+0x58)
    em.setU8(kp + 0x90, 4); // nDist (+0x90) -> dist = (4>>>1)+1 = 3
    em.setU16(ki, 110);
    em.setU16(ki + 2, 120);
    em.setU32(kt, 5); // type 5 -> reads +0x0c and +0x10
    em.setU32(kt + 0x2c, kts);
    em.setU32(kts + 0x0c, 110);
    em.setU32(kts + 0x10, 118);
    expect(PATH_ComputeKnockbackServer113c(em, ki)).toBeGreaterThan(0);
    expect(em.u32(kp + 0x9c) >>> 16).toBe(123);
    em.setU32(kp + 0x58, kt); // restore pTargetUnit (PATH_ComputeKnockbackServer113c clears it)
    em.setU32(kt, 1); // pStaticPath = 0 -> ty fallback 0 (#19)
    em.setU32(kt + 0x2c, 0);
    em.setU16(ki, 101);
    em.setU16(ki + 2, 101); // sx=101, sy=101: ty=0 -> sy+sdiv32(101*3,101)=104; mutated ty=1 -> sy+sdiv32(100*3,101)=103!
    expect(PATH_ComputeKnockbackServer113c(em, ki)).toBeGreaterThan(0);
    expect(em.u32(kp + 0x9c) >>> 16).toBe(104);

    // F06 (0x6FDB7630): dwVelocity becomes 0 at end of path -> returns 0 (#30)
    const rp = em.alloc(0x200);
    const ru = em.alloc(0x80);
    const rpt = em.alloc(8);
    em.setU32(ru, 0);
    em.setU32(rp + 0x30, ru);
    em.setU32(rp + 0x1c, room);
    em.setU32(rp + 0x3c, 2);
    em.setU32(rp + 0x28, 1);
    em.setU32(rp + 0x24, 0);
    em.setU32(rp + 0x7c, 0x400);
    em.setU16(rp + 0x02, 110);
    em.setU16(rp, 0x8000);
    em.setU16(rp + 0x06, 110);
    em.setU16(rp + 0x04, 0x8000);
    em.setU32(rp + 0x9c, (110 | (110 << 16)) >>> 0);
    em.setU16(rpt, 112);
    em.setU16(rpt + 2, 110);
    expect(PATH_RaycastVelocityAndCollide113c(em, rp, rpt)).toBe(0);
    expect(em.u32(rpt)).toBe((110 | (110 << 16)) >>> 0);

    // F07 (0x6FDC0BB0): exact boundary w * h === 0xC350 (250 * 200) does NOT assert (#38)
    const bm = new SparseMemory113c();
    const brect = bm.alloc(16);
    const bi = bm.alloc(0x40);
    bm.setU32(brect, 100);
    bm.setU32(brect + 4, 100);
    bm.setU32(brect + 8, 250);
    bm.setU32(brect + 12, 200);
    bm.setU16(bi, 105);
    bm.setU16(bi + 2, 105);
    bm.setU16(bi + 4, 105);
    bm.setU16(bi + 6, 105);
    bm.setU32(bi + 0x20, 7);
    expect(PATH_IdaStar_ComputeInRoomBounds113c(bm, brect, bi)).toBe(0);

    // F11 (0x6FDB8780): matching preset tile in ppRoomsNear[0] (#31)
    const f11Case = vectors.find(v => v.va === '0x6FDB8780' && v.case === 2)!;
    const tm = new SparseMemory113c();
    for (const [k, val] of Object.entries(f11Case.in.mem)) {
      tm.setU32(Number(k) >>> 0, val >>> 0);
    }
    const f11Re = f11Case.in.args[1]!;
    const f11PpNear = tm.u32(f11Re + 0x08);
    tm.setU32(f11PpNear, 0x10000180);
    tm.setU32(f11Re + 0x2c, 1);
    const f11Out = f11Case.in.args[5]!;
    expect(
      DRLGROOMTILE_FindAdjacentRoomTileGrid113c(
        tm,
        f11Case.in.args[0]!,
        f11Re,
        f11Case.in.args[2]!,
        f11Case.in.args[3]!,
        f11Case.in.args[4]!,
        f11Out,
      ),
    ).toBe(f11Case.out.eax >>> 0);
    expect(tm.u32(f11Out)).toBe(0x10000180);

    // F16 (0x6FDD6000): dwFlags = 0x4 leaves grid untouched (#59)
    const om = new SparseMemory113c();
    const oLvl = om.alloc(0x40);
    const oOut = om.alloc(0x10);
    om.setU32(oLvl + 0x14, oOut);
    om.setU32(oOut, 0x4);
    DRLGOUTJUNG_SpawnOuterSteppesTransitions113c(om, oLvl); // would deref pOutdoors+preset grid if 0x800004 matched

    // F01 (0x6FD68830): enclosed 3x3 room triggers bidirectional loop-back, returns 0 and zeros wfBuf[curIdx] u16 (#0, #1)
    for (let x = 118; x <= 124; x++) {
      for (let y = 118; y <= 124; y++) {
        setCell(x, y, 0x1c01);
      }
    }
    for (let x = 120; x <= 122; x++) {
      for (let y = 120; y <= 122; y++) {
        setCell(x, y, 0);
      }
    }
    const wfi = em.alloc(0x40);
    const wfp = em.alloc(0x200);
    const wfu = em.alloc(0x80);
    const wfBuf = em.alloc(0x200);
    const wfCur = em.alloc(4);
    const wfTot = em.alloc(4);
    em.setU32(wfu, 0);
    em.setU32(wfp + 0x30, wfu);
    em.setU16(wfi, 120);
    em.setU16(wfi + 2, 121);
    em.setU16(wfi + 4, 126);
    em.setU16(wfi + 6, 121);
    em.setU32(wfi + 0x08, room);
    em.setU32(wfi + 0x0c, room);
    em.setU32(wfi + 0x28, 0);
    em.setU32(wfi + 0x2c, 0x1c01);
    em.setU32(wfi + 0x30, wfp);
    em.setU32(wfCur, 2);
    em.setU32(wfTot, 6);
    for (let i = 0; i < 6; i++) {
      em.setU32(wfBuf + i * 4, ((120 + i) | (121 << 16)) >>> 0);
    }
    expect(PATH_WallFollow_StepBidirectional113c(em, wfi, (122 | (121 << 16)) >>> 0, wfBuf, wfCur, wfTot, 30, 0)).toBe(0);
    expect(em.u16(wfBuf + 2 * 4)).toBe(0);
    expect(em.u32(wfTot)).toBe(2);

    // F01 (#3): ds === d0 (25 === 25) chooses pMov0 when ds < d0 is false, returns 1
    for (let x = 118; x <= 126; x++) {
      for (let y = 110; y <= 130; y++) {
        setCell(x, y, 0);
      }
    }
    for (let y = 110; y <= 130; y++) {
      setCell(122, y, 0x1c01);
    }
    em.setU16(wfi, 120);
    em.setU16(wfi + 2, 120);
    em.setU16(wfi + 4, 125);
    em.setU16(wfi + 6, 120);
    em.setU32(wfCur, 1);
    em.setU32(wfTot, 2);
    em.setU32(wfBuf, (120 | (120 << 16)) >>> 0);
    em.setU32(wfBuf + 4, (121 | (120 << 16)) >>> 0);
    expect(PATH_WallFollow_StepBidirectional113c(em, wfi, (121 | (120 << 16)) >>> 0, wfBuf, wfCur, wfTot, 5, 0)).toBe(1);
    expect(em.u32(wfTot)).toBe(2);
  });
});
