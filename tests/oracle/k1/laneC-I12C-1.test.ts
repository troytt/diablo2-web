import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import {
  DRLGMAZE_LinkTouchingMazeRooms113c,
  DRLGMAZE_PositionAdjacentRoomAndCheckSeparation113c,
} from '../../../src/d2kern-113c/common/drlg/maze.ts';
import { DRLGLOGIC_LinkAdjacentRoomsCoordLists113c } from '../../../src/d2kern-113c/common/drlg/drlg-logic.ts';
import { DRLGROOM_FreeRoomEx113c } from '../../../src/d2kern-113c/common/drlg/drlg-room.ts';
import { DRLGTILESUB_ApplySubThemesToRoom113c } from '../../../src/d2kern-113c/common/drlg/drlg-grid.ts';
import {
  MONSTER_GetMissileIdForAnimMode113c,
  MONSTATS_MISSILE_OFFSET_BY_MODE_6FDE4F08,
} from '../../../src/d2kern-113c/common/drlg/drlg-ver.ts';
import {
  DRLGOUTDOORS_ComputeVertexLevelLinkVisBit113c,
  DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c,
  OUTDOOR_BORDER_DIR_OFFSETS_6FDE34A4,
} from '../../../src/d2kern-113c/common/drlg/outdoors.ts';
import { DRLGPRESET_BuildFortressAndMapAIPaths113c } from '../../../src/d2kern-113c/common/drlg/preset.ts';
import {
  DUNGEON_FindRoomExWithValidExitWarp113c,
  DUNGEON_GetRoomCoordListIndexAtSubtile113c,
  DUNGEON_IsSquareOutsideRoomInterior113c,
  DUNGEON_IsSquareTouchingRoomBounds113c,
} from '../../../src/d2kern-113c/common/dungeon.ts';
import {
  PATH_CopyPositionFromUnit113c,
  PATH_GetOrCheckLastCollisionMask113c,
  PATH_MoveOrTestSubtileStepCollision113c,
  PATH_RecomputeDynamicPath113c,
  PATH_RefreshUnitCollisionPattern113c,
  PATH_RemoveUnitCollisionIfHasPath113c,
  PATH_SetCollisionMask113c,
  PATH_SnapToSubtileCenter113c,
} from '../../../src/d2kern-113c/common/path.ts';
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i12c-1-vectors.ndjson');

function loadVectors(): VectorRecord[] {
  return readFileSync(FIXTURE_PATH, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as VectorRecord);
}

const I12C1_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD5D420': (m, a) => PATH_MoveOrTestSubtileStepCollision113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD5D820': (m, a) => PATH_RecomputeDynamicPath113c(m, a[0]!, a[1]! | 0) >>> 0,
  '0x6FD5DAB0': (m, a) => { PATH_CopyPositionFromUnit113c(m, a[0]!, a[1]!); return 0; },
  '0x6FD5DB40': (m, a) => { PATH_SnapToSubtileCenter113c(m, a[0]!); return 0; },
  '0x6FD85640': (m, a) => { PATH_SetCollisionMask113c(m, a[0]!, a[1]!); return 0; },
  '0x6FD85BA0': (m, a) => PATH_GetOrCheckLastCollisionMask113c(m, a[0]!) >>> 0,
  '0x6FD85CD0': (m, a) => { PATH_RemoveUnitCollisionIfHasPath113c(m, a[0]!); return 0; },
  '0x6FD85CF0': (m, a) => { PATH_RefreshUnitCollisionPattern113c(m, a[0]!); return 0; },
  '0x6FD6B280': (m, a) => MONSTER_GetMissileIdForAnimMode113c(m, a[0]!, a[1]! | 0) >>> 0,
  '0x6FD5BD60': (m, a) => { DRLGPRESET_BuildFortressAndMapAIPaths113c(m, a[0]!, a[1]!); return 0; },
  '0x6FD5EEC0': (m, a) => DRLGMAZE_PositionAdjacentRoomAndCheckSeparation113c(m, a[0]! | 0, a[1]!, a[2]!) >>> 0,
  '0x6FD621D0': (m, a) => DUNGEON_IsSquareTouchingRoomBounds113c(m, a[0]! | 0, a[1]!, a[2]! | 0, a[3]! | 0) >>> 0,
  '0x6FD62250': (m, a) => DUNGEON_IsSquareOutsideRoomInterior113c(m, a[0]! | 0, a[1]!, a[2]! | 0, a[3]! | 0) >>> 0,
  '0x6FD69AD0': (m, a) => DUNGEON_FindRoomExWithValidExitWarp113c(m, a[0]!) >>> 0,
  '0x6FD8C6D0': (m, a) => DUNGEON_GetRoomCoordListIndexAtSubtile113c(m, a[0]!, a[1]! | 0, a[2]! | 0) >>> 0,
  '0x6FD94F90': (m, a) => { DRLGROOM_FreeRoomEx113c(m, a[0]!); return 0; },
  '0x6FD5EB80': (m, a) => { DRLGMAZE_LinkTouchingMazeRooms113c(m, a[0]!); return 0; },
  '0x6FD92CE0': (m, a) => DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c(m, a[0]!, a[1]! | 0, a[2]! | 0, a[3]! | 0, a[4]!) >>> 0,
  '0x6FD92C00': (m, a) => DRLGOUTDOORS_ComputeVertexLevelLinkVisBit113c(m, a[0]!, a[1]!) >>> 0,
  '0x6FDD1AD0': (m, a) => { DRLGLOGIC_LinkAdjacentRoomsCoordLists113c(m, a[0]!); return 0; },
  '0x6FDD4110': (m, a) => { DRLGTILESUB_ApplySubThemesToRoom113c(m, a[0]!, a[1]!); return 0; },
};

function verifyVector(v: VectorRecord, overrideEax?: number, corruptAddr?: number): void {
  const runner = I12C1_RUNNERS[v.va];
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

describe('Lane C I12C-1 real-DLL differential vectors (21 functions)', () => {
  const vectors = loadVectors();

  it('covers all 21 I12C-1 VAs with >= 2 real-DLL vectors each (102 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    expect(vectors.length).toBe(102);
    expect(counts.size).toBe(21);
    for (const va of Object.keys(I12C1_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(2);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case} (${v.note})`, () => {
      verifyVector(v);
    });
  }

  it('negative control: mutating return value or post-memory state is caught for every I12C-1 function', () => {
    for (const va of Object.keys(I12C1_RUNNERS)) {
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

  it('matches .rdata tables and D2CommonAssertError boundaries across I12C-1', () => {
    expect(Array.from(MONSTATS_MISSILE_OFFSET_BY_MODE_6FDE4F08)).toEqual([
      0x00, 0x00, 0x00, 0x00,
      0x3a, 0x3c, 0x00, 0x46,
      0x3e, 0x40, 0x42, 0x44,
      0x00, 0x00, 0x48, 0x00,
    ]);
    expect(Array.from(OUTDOOR_BORDER_DIR_OFFSETS_6FDE34A4)).toEqual([
      -4, 4, 4, -4, 12, 4, 4, 12,
    ]);

    const mem = new SparseMemory113c();
    const pBadStepPath = mem.alloc(0x80);
    mem.setU32(pBadStepPath + 0x34, 0x04);
    mem.setU32(pBadStepPath + 0x30, 0);
    expect(() => PATH_MoveOrTestSubtileStepCollision113c(mem, pBadStepPath, 0x00100010, 0x00100010)).toThrow(D2CommonAssertError);
    expect(() => PATH_CopyPositionFromUnit113c(mem, 0, 0x1000)).toThrow(D2CommonAssertError);
    expect(() => PATH_CopyPositionFromUnit113c(mem, 0x1000, 0)).toThrow(D2CommonAssertError);
    expect(DUNGEON_GetRoomCoordListIndexAtSubtile113c(mem, 0, 0, 0)).toBe(0);
    mem.setU32(pBadStepPath + 0x30, mem.alloc(0x10));
    mem.setU32(mem.u32(pBadStepPath + 0x30), 2);
    expect(() => PATH_MoveOrTestSubtileStepCollision113c(mem, pBadStepPath, 0x00100010, 0x00100010)).toThrow(D2CommonAssertError);
  });

  it('kills boundary, flag, and orientation mutants across I12C-1', () => {
    const m = new SparseMemory113c();

    // F02 (#4): clamp diff > 0xff to 0xff
    const u2 = m.alloc(0x100);
    const p2 = m.alloc(0x200);
    m.setU32(u2 + 0x00, 0);
    m.setU32(u2 + 0x2c, p2);
    m.setU32(p2 + 0x30, u2);
    m.setU32(p2 + 0x34, 0);
    m.setU32(p2 + 0x1c, 0);
    m.setU32(u2 + 0xc4, 0);
    m.setU16(p2 + 0x02, 5); m.setU16(p2 + 0x06, 5);
    m.setU16(p2 + 0x10, 5); m.setU16(p2 + 0x14, 5);
    m.setU8(p2 + 0x94, 10);
    m.setU32(p2 + 0x24, 0xfffffec4 >>> 0); // -316 => diff = 326 > 255
    m.setU32(p2 + 0x3c, 1);
    PATH_RecomputeDynamicPath113c(m, u2, 0);
    expect(m.u8(p2 + 0x94)).toBe(0xff);

    // F05 (#44): object unit (type === 3) resets & sets simple collision mask via path + 0x44 (vs type=0 pattern=5)
    const p5 = m.alloc(0x80);
    const u5 = m.alloc(0x10);
    const r5 = m.alloc(0x80);
    const cg5 = m.alloc(0x40);
    const cells5 = m.alloc(0x200);
    m.setU32(u5 + 0x00, 3);
    m.setU32(p5 + 0x30, u5);
    m.setU32(p5 + 0x44, 1);
    m.setU32(p5 + 0x48, 5);
    m.setU32(p5 + 0x4c, 0x08);
    m.setU32(p5 + 0x1c, r5);
    m.setU16(p5 + 0x02, 11);
    m.setU16(p5 + 0x06, 11);
    m.setU32(r5 + 0x20, cg5);
    m.setU32(r5 + 0x4c, 10); m.setU32(r5 + 0x50, 10);
    m.setU32(r5 + 0x54, 4);  m.setU32(r5 + 0x58, 4);
    m.setU32(cg5 + 0x00, 10); m.setU32(cg5 + 0x04, 10);
    m.setU32(cg5 + 0x08, 4);  m.setU32(cg5 + 0x0c, 4);
    m.setU32(cg5 + 0x20, cells5);
    m.setU16(cells5 + (1 * 4 + 1) * 2, 0x08);
    PATH_SetCollisionMask113c(m, p5, 0x20);
    expect(m.u32(p5 + 0x4c)).toBe(0x20);
    expect(m.u16(cells5 + (1 * 4 + 1) * 2)).toBe(0x20);
    expect(m.u16(cells5 + (1 * 4 + 2) * 2)).toBe(0);

    // F06 (#21): dwLen (pPath + 0x7c) === 0 triggers check-mask recompute and writes +0x54
    const p6 = m.alloc(0x80);
    const r6 = m.alloc(0x80);
    const cg6 = m.alloc(0x40);
    const cells6 = m.alloc(0x200);
    m.setU32(p6 + 0x7c, 0);
    m.setU32(p6 + 0x1c, r6);
    m.setU16(p6 + 0x02, 11);
    m.setU16(p6 + 0x06, 11);
    m.setU32(p6 + 0x44, 1);
    m.setU16(p6 + 0x54, 0x1234);
    m.setU32(r6 + 0x20, cg6);
    m.setU32(r6 + 0x4c, 10); m.setU32(r6 + 0x50, 10);
    m.setU32(r6 + 0x54, 4);  m.setU32(r6 + 0x58, 4);
    m.setU32(cg6 + 0x00, 10);
    m.setU32(cg6 + 0x04, 10);
    m.setU32(cg6 + 0x08, 4);
    m.setU32(cg6 + 0x0c, 4);
    m.setU32(cg6 + 0x20, cells6);
    m.setU16(cells6 + (1 * 4 + 1) * 2, 0x0001);
    expect(PATH_GetOrCheckLastCollisionMask113c(m, p6)).toBe(0x0001);

    // F12 (#43, #44, #45): room coords [100,200] 10x10; test strict inequalities and negative branch
    const rm12 = m.alloc(0x80);
    m.setU32(rm12 + 0x4c, 100);
    m.setU32(rm12 + 0x50, 200);
    m.setU32(rm12 + 0x54, 10);
    m.setU32(rm12 + 0x58, 10);
    expect(DUNGEON_IsSquareTouchingRoomBounds113c(m, 195, rm12, 120, -20)).toBe(0);
    expect(DUNGEON_IsSquareTouchingRoomBounds113c(m, 195, rm12, 120, -15)).toBe(1);
    expect(DUNGEON_IsSquareTouchingRoomBounds113c(m, 205, rm12, 100, -10)).toBe(0);
    expect(DUNGEON_IsSquareTouchingRoomBounds113c(m, 195, rm12, 95, -15)).toBe(1); // kills #29 ('>' -> '>=')

    // F17 (#22): rX === oX = 10, rW = 2, oW = 3, distY = -2 => '<' gives distX=-3 (!== distY -> links), '<=' gives -2 (=== distY -> skips)
    const lvl17 = m.alloc(0x200);
    const drlg17 = m.alloc(0x500);
    const mz17 = m.alloc(0x40);
    const rxA = m.alloc(0xEC);
    const rxB = m.alloc(0xEC);
    const grA = m.alloc(0x20);
    const grB = m.alloc(0x20);
    m.setU32(lvl17 + 0x1b4, drlg17);
    m.setU32(lvl17 + 0x14, mz17);
    m.setU32(lvl17 + 0x10, rxB);
    m.setU32(lvl17 + 0x1c0, 4); // act/drlgType=4 valid maze (case 1)
    m.setU32(mz17 + 0x18, 1000); // always link
    m.setU32(rxA + 0x20, grA);
    m.setU32(rxB + 0x20, grB);
    m.setU32(rxA + 0x58, lvl17);
    m.setU32(rxB + 0x58, lvl17);
    m.setU32(rxB + 0x14, 1);
    m.setU32(rxB + 0x18, 0);
    m.setU32(rxA + 0x34, 10); m.setU32(rxA + 0x38, 10); m.setU32(rxA + 0x3c, 0); m.setU32(rxA + 0x40, 2);
    m.setU32(rxB + 0x34, 10); m.setU32(rxB + 0x38, 12); m.setU32(rxB + 0x3c, 2); m.setU32(rxB + 0x40, 2);
    DRLGMAZE_LinkTouchingMazeRooms113c(m, rxA);
    expect(m.u32(rxA)).not.toBe(0);

    // F11 (#26): pOrth box touches newRoom at exact edge distY === 0 (while distX < 0) => returns 1 (while distY <= 0 returns 0)
    const pOrth11 = m.alloc(0x20);
    const pBox11 = m.alloc(0x10);
    m.setU32(pBox11 + 0x00, 20); m.setU32(pBox11 + 0x04, 14); m.setU32(pBox11 + 0x08, 8); m.setU32(pBox11 + 0x0c, 4);
    m.setU32(pOrth11 + 0x10, pBox11);
    const rxBase11 = m.alloc(0xEC);
    const rxNew11 = m.alloc(0xEC);
    const lvl11 = m.alloc(0x200);
    m.setU32(lvl11 + 0x10, 0);
    m.setU32(rxBase11 + 0x00, pOrth11);
    m.setU32(rxBase11 + 0x34, 28); m.setU32(rxBase11 + 0x38, 10); m.setU32(rxBase11 + 0x3c, 8); m.setU32(rxBase11 + 0x40, 4);
    m.setU32(rxNew11 + 0x3c, 8);  m.setU32(rxNew11 + 0x40, 4);
    m.setU32(rxNew11 + 0x58, lvl11);
    expect(DRLGMAZE_PositionAdjacentRoomAndCheckSeparation113c(m, 0, rxBase11, rxNew11)).toBe(1);

    // F19 (#66): worldX === bx + bw => must return 0 without calling GetLevelLinkVisBit (which would deref null orth->adj)
    const lvl19 = m.alloc(0x200);
    const out19 = m.alloc(0x300);
    const orth19 = m.alloc(0x20);
    const box19 = m.alloc(0x10);
    const vtx19 = m.alloc(0x20);
    m.setU32(lvl19 + 0x14, out19);
    m.setU32(lvl19 + 0x1c, 16); m.setU32(lvl19 + 0x20, 0);
    m.setU32(out19 + 0x5c, 4);  m.setU32(out19 + 0x60, 4);
    m.setU32(out19 + 0x264, orth19);
    m.setU32(orth19 + 0x00, 0); // pAdjLevel=0 (unloaded if entered)
    m.setU32(orth19 + 0x04, 0); // eDir=0 (-4, +4)
    m.setU32(orth19 + 0x0c, 0);
    m.setU32(orth19 + 0x10, box19);
    m.setU32(box19 + 0x00, 0); m.setU32(box19 + 0x04, 0); m.setU32(box19 + 0x08, 12); m.setU32(box19 + 0x0c, 20);
    m.setU32(vtx19 + 0x00, 0); m.setU32(vtx19 + 0x04, 1); m.setU32(vtx19 + 0x0c, 1); // worldX = -4 + 0 + 16 = 12 === bx + bw
    expect(DRLGOUTDOORS_ComputeVertexLevelLinkVisBit113c(m, vtx19, lvl19)).toBe(0);

    // F20 (#75, #77): (a) nr20 left of rx20 with nW=11 != nH=2 (kills 0x3c->0x40), (b) nr20b touching interior x=21 top edge (kills startX '+'->'-')
    const lvl20 = m.alloc(0x200);
    const rx20 = m.alloc(0xEC);
    const nr20 = m.alloc(0xEC);
    const pp20 = m.alloc(8);
    const lgR = m.alloc(0x34);
    const lgN = m.alloc(0x34);
    const clR = m.alloc(0x30);
    const clN = m.alloc(0x30);
    const icR = m.alloc(12 * 4);
    const irR = m.alloc(12);
    const icN = m.alloc(12 * 4 * 4);
    const irN = m.alloc(12);
    m.setU32(lvl20 + 0x1d0, 2);
    m.setU32(rx20 + 0x58, lvl20); m.setU32(nr20 + 0x58, lvl20);
    m.setU32(rx20 + 0x08, pp20); m.setU32(rx20 + 0x2c, 1); m.setU32(pp20, nr20);
    m.setU32(rx20 + 0x34, 20); m.setU32(rx20 + 0x38, 10); m.setU32(rx20 + 0x3c, 3);  m.setU32(rx20 + 0x40, 2);
    m.setU32(nr20 + 0x34, 10); m.setU32(nr20 + 0x38, 10); m.setU32(nr20 + 0x3c, 11); m.setU32(nr20 + 0x40, 2);
    m.setU32(rx20 + 0x64, lgR); m.setU32(nr20 + 0x64, lgN);
    for (let i = 0; i < 3; i++) { m.setU32(irR + i * 4, i * 4); m.setU32(irN + i * 4, i * 12); }
    for (let i = 0; i < 12; i++) m.setU32(icR + i * 4, clR);
    for (let i = 0; i < 36; i++) m.setU32(icN + i * 4, clN);
    m.setU32(lgR + 0x1c, icR); m.setU32(lgR + 0x20, irR); m.setU32(lgR + 0x30, clR);
    m.setU32(lgN + 0x1c, icN); m.setU32(lgN + 0x20, irN); m.setU32(lgN + 0x30, clN);
    m.setU32(clR + 0x20, 1); m.setU32(clR + 0x28, 7);
    m.setU32(clN + 0x20, 1); m.setU32(clN + 0x28, 9);
    DRLGLOGIC_LinkAdjacentRoomsCoordLists113c(m, rx20);
    expect(m.u32(clR + 0x28)).toBe(9);

    // (b) nr20b sits strictly above interior x=21 (curX=20 and rightX=23 miss it, only horizontal startX..endX hits it)
    const rx20b = m.alloc(0xEC);
    const nr20b = m.alloc(0xEC);
    const pp20b = m.alloc(4);
    const lgRb = m.alloc(0x34);
    const lgNb = m.alloc(0x34);
    const clRb = m.alloc(0x30);
    const clNb = m.alloc(0x30);
    const icRb = m.alloc(12 * 4);
    const irRb = m.alloc(12);
    const icNb = m.alloc(8 * 4);
    const irNb = m.alloc(16);
    m.setU32(rx20b + 0x58, lvl20); m.setU32(nr20b + 0x58, lvl20);
    m.setU32(rx20b + 0x08, pp20b); m.setU32(rx20b + 0x2c, 1); m.setU32(pp20b, nr20b);
    m.setU32(rx20b + 0x34, 20); m.setU32(rx20b + 0x38, 10); m.setU32(rx20b + 0x3c, 3); m.setU32(rx20b + 0x40, 2);
    m.setU32(nr20b + 0x34, 21); m.setU32(nr20b + 0x38, 8);  m.setU32(nr20b + 0x3c, 1); m.setU32(nr20b + 0x40, 3);
    m.setU32(rx20b + 0x64, lgRb); m.setU32(nr20b + 0x64, lgNb);
    for (let i = 0; i < 3; i++) m.setU32(irRb + i * 4, i * 4);
    for (let i = 0; i < 4; i++) m.setU32(irNb + i * 4, i * 2);
    for (let i = 0; i < 12; i++) m.setU32(icRb + i * 4, clRb);
    for (let i = 0; i < 8; i++) m.setU32(icNb + i * 4, clNb);
    m.setU32(lgRb + 0x1c, icRb); m.setU32(lgRb + 0x20, irRb); m.setU32(lgRb + 0x30, clRb);
    m.setU32(lgNb + 0x1c, icNb); m.setU32(lgNb + 0x20, irNb); m.setU32(lgNb + 0x30, clNb);
    m.setU32(clRb + 0x20, 1); m.setU32(clRb + 0x28, 3);
    m.setU32(clNb + 0x20, 1); m.setU32(clNb + 0x28, 5);
    DRLGLOGIC_LinkAdjacentRoomsCoordLists113c(m, rx20b);
    expect(m.u32(clRb + 0x28)).toBe(5);
  });
});
