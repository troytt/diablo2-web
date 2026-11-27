import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import { DRLGLOGIC_AllocAndBuildRoomCoordList113c } from '../../../src/d2kern-113c/common/drlg/drlg-logic.ts';
import {
  DRLGMAZE_SpawnAdjacentSpecialPresetRoom113c,
  DRLGOUTPLACE_ApplyOutdoorVerticesToGrids113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-room.ts';
import { DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c } from '../../../src/d2kern-113c/common/drlg/maze.ts';
import {
  DRLGOUTJUNG_PlaceShuffledPresetList113c,
  DRLGOUTJUNG_SpawnSpiderForestSpecialPreset113c,
} from '../../../src/d2kern-113c/common/drlg/out-jung.ts';
import {
  PATH_AdvancePrecisionStep113c,
  PATH_CheckTargetMovedAndRecompute113c,
  PATH_MarkUnitDeadCollision113c,
  PATH_RaymarchSubtileSteps113c,
  PATH_Step113c,
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i12c-2-vectors.ndjson');

function loadVectors(): VectorRecord[] {
  return readFileSync(FIXTURE_PATH, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as VectorRecord);
}

const I12C2_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD5D580': (m, a) => PATH_RaymarchSubtileSteps113c(m, a[0]!, a[1]! | 0, a[2]! | 0, a[3]!, a[4]!) >>> 0,
  '0x6FD5D8E0': (m, a) => PATH_AdvancePrecisionStep113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6FD5DB70': (m, a) => PATH_CheckTargetMovedAndRecompute113c(m, a[0]!) >>> 0,
  '0x6FD5E230': (m, a) => PATH_Step113c(m, a[0]!, a[1]! | 0) >>> 0,
  '0x6FD865A0': (m, a) => { PATH_MarkUnitDeadCollision113c(m, a[0]!, a[1]! | 0); return 0; },
  '0x6FDD1CA0': (m, a) => { DRLGLOGIC_AllocAndBuildRoomCoordList113c(m, a[0]!, a[1]!, a[2]!, a[3]!); return 0; },
  '0x6FD676F0': (m, a) => { DRLGOUTPLACE_ApplyOutdoorVerticesToGrids113c(m, a[0]!); return 0; },
  '0x6FD5F000': (m, a) => DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(m, a[0]!, a[1]! | 0, a[2]! | 0) >>> 0,
  '0x6FD605C0': (m, a) => DRLGMAZE_SpawnAdjacentSpecialPresetRoom113c(m, a[0]!, a[1]! | 0, a[2]! | 0, a[3]! | 0) >>> 0,
  '0x6FDD59F0': (m, a) => { DRLGOUTJUNG_SpawnSpiderForestSpecialPreset113c(m, a[0]!); return 0; },
  '0x6FDD5A80': (m, a) => { DRLGOUTJUNG_PlaceShuffledPresetList113c(m, a[0]!, a[1]!, a[2]! | 0, a[3]! | 0); return 0; },
};

function verifyVector(v: VectorRecord, overrideEax?: number, corruptAddr?: number): void {
  const runner = I12C2_RUNNERS[v.va];
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

describe('Lane C I12C-2 real-DLL differential vectors (11 functions)', () => {
  const vectors = loadVectors();

  it('covers all 11 I12C-2 VAs with >= 3 real-DLL vectors each (50 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    expect(vectors.length).toBe(50);
    expect(counts.size).toBe(11);
    for (const va of Object.keys(I12C2_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(3);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case} (${v.note})`, () => {
      verifyVector(v);
    });
  }

  it('negative control: mutating return value or post-memory state is caught for every I12C-2 function', () => {
    for (const va of Object.keys(I12C2_RUNNERS)) {
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

  it('verifies assertion paths and boundary cases across I12C-2', () => {
    const mem = new SparseMemory113c();

    // F31 (#119): level < 41 || level >= 46 throws D2CommonAssertError with exact line 170
    const pLevel = mem.alloc(0x200);
    mem.setU32(pLevel + 0x04, 40);
    let err40: unknown;
    try { DRLGOUTJUNG_SpawnSpiderForestSpecialPreset113c(mem, pLevel); } catch (e) { err40 = e; }
    expect(err40).toBeInstanceOf(D2CommonAssertError);
    expect((err40 as D2CommonAssertError).line).toBe(170);
    mem.setU32(pLevel + 0x04, 46);
    expect(() => DRLGOUTJUNG_SpawnSpiderForestSpecialPreset113c(mem, pLevel)).toThrow(D2CommonAssertError);

    // F25 (#95): bTestOnly (0x40000) clears wLastCollisionMask (+0x54) without touching +0x58
    const u25 = mem.alloc(0x80);
    const p25 = mem.alloc(0x80);
    mem.setU32(u25 + 0x2c, p25);
    mem.setU32(p25 + 0x34, 0x40000);
    mem.setU16(p25 + 0x54, 0x1234);
    mem.setU32(p25 + 0x58, 0xdeadbeef);
    mem.setU32(p25 + 0x1c, 0);
    expect(PATH_Step113c(mem, u25, 16)).toBe(0);
    expect(mem.u16(p25 + 0x54)).toBe(0);
    expect(mem.u32(p25 + 0x58)).toBe(0xdeadbeef);

    // F23 (#87, #89): single subtile step (0x108000 -> 0x110000) with pt=8 preserves nDirChange
    const p23 = mem.alloc(0x200);
    const r23 = mem.alloc(0x80);
    const cg23 = mem.alloc(0x40);
    const cells23 = mem.alloc(16 * 16 * 2);
    mem.setU32(p23 + 0x00, 0x00108000);
    mem.setU32(p23 + 0x04, 0x00108000);
    mem.setU32(p23 + 0x10, 0x00148000);
    mem.setU32(p23 + 0x14, 0x00108000);
    mem.setU32(p23 + 0x1c, r23);
    mem.setU32(p23 + 0x24, 0);
    mem.setU32(p23 + 0x28, 1);
    mem.setU32(p23 + 0x30, 0);
    mem.setU32(p23 + 0x34, 0);
    mem.setU32(p23 + 0x3c, 8);
    mem.setU32(p23 + 0x44, 1);
    mem.setU32(p23 + 0x48, 1);
    mem.setU32(p23 + 0x4c, 0);
    mem.setU32(p23 + 0x50, 0x100);
    mem.setU32(p23 + 0x72, 0x8000);
    mem.setU32(p23 + 0x76, 0);
    mem.setU32(p23 + 0x7c, 2);
    mem.setU32(p23 + 0x80, 0x00140010);
    mem.setU8(p23 + 0x90, 2);
    mem.setU32(r23 + 0x1c, cg23);
    mem.setU32(cg23 + 0x00, 10); mem.setU32(cg23 + 0x04, 10);
    mem.setU32(cg23 + 0x08, 16); mem.setU32(cg23 + 0x0c, 16);
    mem.setU32(cg23 + 0x20, cells23);
    PATH_AdvancePrecisionStep113c(mem, p23, mem.alloc(8), mem.alloc(4));
    expect(mem.u8(p23 + 0x90)).toBe(2);

    // F24 (#94): dwPathType === 5 with dwCurrIdx >= dwLen returns 1
    const p24 = mem.alloc(0x80);
    mem.setU32(p24 + 0x3c, 5);
    mem.setU32(p24 + 0x24, 2);
    mem.setU32(p24 + 0x28, 2);
    expect(PATH_CheckTargetMovedAndRecompute113c(mem, p24)).toBe(1);

    // F26 (#99, #101): corpse=1 writes 0x8000 across (x-1..x+1, y-1..y+1) bounding box
    const u26 = mem.alloc(0x80);
    const p26 = mem.alloc(0x80);
    const r26 = mem.alloc(0x80);
    const cg26 = mem.alloc(0x40);
    const cells26 = mem.alloc(8 * 8 * 2);
    mem.setU32(r26 + 0x20, cg26);
    mem.setU32(r26 + 0x4c, 10); mem.setU32(r26 + 0x50, 10);
    mem.setU32(r26 + 0x54, 8);  mem.setU32(r26 + 0x58, 8);
    mem.setU32(cg26 + 0x00, 10); mem.setU32(cg26 + 0x04, 10);
    mem.setU32(cg26 + 0x08, 8);  mem.setU32(cg26 + 0x0c, 8);
    mem.setU32(cg26 + 0x20, cells26);
    mem.setU32(u26 + 0x00, 1);
    mem.setU32(u26 + 0x2c, p26);
    mem.setU32(p26 + 0x30, u26);
    mem.setU16(p26 + 0x02, 13);
    mem.setU16(p26 + 0x06, 13);
    mem.setU32(p26 + 0x1c, r26);
    PATH_MarkUnitDeadCollision113c(mem, u26, 1);
    expect(mem.u16(cells26 + (2 * 8 + 2) * 2)).toBe(0x8000);
    expect(mem.u16(cells26 + (4 * 8 + 4) * 2)).toBe(0x8000);

    // F29 (#112): bLinkTouching = 1 invokes LinkTouchingMazeRooms vs bLinkTouching = 0
    const lvl29 = mem.alloc(0x200);
    const drlg29 = mem.alloc(0x500);
    const mz29 = mem.alloc(0x40);
    const rxBase29 = mem.alloc(0xEC);
    const rxExist29 = mem.alloc(0xEC);
    const grBase29 = mem.alloc(0x20);
    const grExist29 = mem.alloc(0x20);
    mem.setU32(lvl29 + 0x1b4, drlg29);
    mem.setU32(lvl29 + 0x1c4, 1); mem.setU32(lvl29 + 0x1c8, 1);
    mem.setU32(lvl29 + 0x10, rxExist29);
    mem.setU32(lvl29 + 0x14, mz29);
    mem.setU32(lvl29 + 0x1c0, 4);
    mem.setU32(mz29 + 0x10, 8); mem.setU32(mz29 + 0x14, 4); mem.setU32(mz29 + 0x18, 1000);
    mem.setU32(rxBase29 + 0x20, grBase29); mem.setU32(rxBase29 + 0x58, lvl29);
    mem.setU32(rxBase29 + 0x34, 10); mem.setU32(rxBase29 + 0x38, 10);
    mem.setU32(rxBase29 + 0x3c, 8);  mem.setU32(rxBase29 + 0x40, 4);
    mem.setU32(rxExist29 + 0x20, grExist29); mem.setU32(rxExist29 + 0x58, lvl29);
    mem.setU32(rxExist29 + 0x14, 1);
    mem.setU32(rxExist29 + 0x34, 26); mem.setU32(rxExist29 + 0x38, 10);
    mem.setU32(rxExist29 + 0x3c, 8);  mem.setU32(rxExist29 + 0x40, 4);
    const newRx29 = DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c(mem, rxBase29, 2, 1);
    expect(newRx29).not.toBe(0);
    expect(mem.u32(mem.u32(rxExist29 + 0x00))).toBe(newRx29);

    // F32 (#126): prestId === 0 with bAllFiles = 1 triggers sgptDataTables lookup (instead of skipping 0)
    const pIds32 = mem.alloc(4);
    mem.setU32(pIds32, 0);
    const lvl32 = mem.alloc(0x200);
    mem.setU32(lvl32 + 0x1c4, 1); mem.setU32(lvl32 + 0x1c8, 1);
    expect(() => DRLGOUTJUNG_PlaceShuffledPresetList113c(mem, lvl32, pIds32, 1, 1)).toThrow();
  });
});
