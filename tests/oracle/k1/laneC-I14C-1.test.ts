import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DRLGROOM_LinkRoomAndWarps113c,
  DRLGWARP_LinkWarpRoomExByDir113c,
} from '../../../src/d2kern-113c/common/drlg/drlg-room.ts';
import { D2CommonAssertError } from '../../../src/d2kern-113c/common/inline-helpers.ts';
import {
  ITEMMODS_ApplyItemProperty113c,
  ITEMMODS_ApplyPropertyById113c,
  ITEMMODS_ApplySetItemBonusProps113c,
  ITEMS_ApplyItemQualityMods113c,
  ITEMS_ApplyRunewordProps113c,
  ITEMS_ApplySinglePropAndEthereal113c,
} from '../../../src/d2kern-113c/common/items.ts';
import { MONSTERS_GetCompCode113c } from '../../../src/d2kern-113c/common/monsters.ts';
import {
  SKILLS_AddSkillToUnit113c,
  SKILLS_InitCharStartSkills113c,
  SKILLS_RefreshPassiveAuraSkills113c,
  SKILLS_RemoveOrDecrementSkillFromUnit113c,
  SKILLS_SetSkillLevelOnUnit113c,
  SKILLS_FindMeleeTargetPosition113c,
} from '../../../src/d2kern-113c/common/skills.ts';
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
  if (preMem['0x6fdd90b0'] === undefined && preMem['0x6FDD90B0'] === undefined) {
    const bmBase = 0x0352c000;
    raw.setU32(0x6fdd90b0, bmBase);
    for (let i = 0; i < 4; i++) allowedReadBytes.add((0x6fdd90b0 + i) >>> 0);
    for (let i = 0; i < 32; i++) {
      const a = (bmBase + i * 4) >>> 0;
      raw.setU32(a, (1 << i) >>> 0);
      for (let j = 0; j < 4; j++) allowedReadBytes.add((a + j) >>> 0);
    }
  }
  if (preMem['0x6fde9e1c'] === undefined && preMem['0x6FDE9E1C'] === undefined) {
    raw.setU32(0x6fde9e1c, 0);
    for (let i = 0; i < 4; i++) allowedReadBytes.add((0x6fde9e1c + i) >>> 0);
  }
  for (let off = 0; off < 16; off += 4) {
    const sc = (0x6fdf1f00 + off) >>> 0;
    const hexLo = `0x${sc.toString(16)}`;
    const hexHi = `0x${sc.toString(16).toUpperCase()}`;
    if (preMem[hexLo] === undefined && preMem[hexHi] === undefined) {
      raw.setU32(sc, 0);
      for (let i = 0; i < 4; i++) {
        allowedReadBytes.add((sc + i) >>> 0);
        allowedWriteBytes.add((sc + i) >>> 0);
      }
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
  let heapOff = 0;
  const HEAP_ADDR = 0x21000000;

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
      const sz = size >>> 0;
      if (sz === 0) return 0;
      const alignedOff = (heapOff + 3) & ~3;
      const p = (HEAP_ADDR + alignedOff) >>> 0;
      heapOff = alignedOff + sz;
      allocBytes += sz;
      raw.fill(p, sz, 0);
      const alignedSz = (sz + 3) & ~3;
      for (let i = 0; i < alignedSz; i++) {
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/i14c-1-vectors.ndjson');

function loadVectors(): VectorRecord[] {
  return readFileSync(FIXTURE_PATH, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line) as VectorRecord);
}

const I14C1_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6FD953D0': (m, a) => DRLGWARP_LinkWarpRoomExByDir113c(m, a[0]!, a[1]!, a[2]! | 0) >>> 0,
  '0x6FD95550': (m, a) => { DRLGROOM_LinkRoomAndWarps113c(m, a[0]!, a[1]!); return 0; },
  '0x6FD95990': (m, a) => { ITEMMODS_ApplyPropertyById113c(m, a[0]! | 0, a[1]!, a[2]!, a[3]! | 0, a[4]! | 0, a[5]! | 0, a[6]!, a[7]! | 0, a[8]!, a[9]! | 0); return 0; },
  '0x6FD95AA0': (m, a) => { ITEMMODS_ApplyItemProperty113c(m, a[0]!, a[1]!, a[2]! | 0, a[3]!, a[4]! | 0, a[5]! | 0, a[6]! | 0, a[7]! | 0, a[8]!, a[9]! | 0, a[10]! | 0); return 0; },
  '0x6FD95F90': (m, a) => { ITEMMODS_ApplySetItemBonusProps113c(m, a[0]!, a[1]!, a[2]! | 0); return 0; },
  '0x6FD960B0': (m, a) => { ITEMS_ApplyItemQualityMods113c(m, a[0]! | 0, a[1]! | 0, a[2]!, a[3]!, a[4]!, a[5]!); return 0; },
  '0x6FD96770': (m, a) => ITEMS_ApplyRunewordProps113c(m, a[0]!, a[1]!, a[2]! | 0) >>> 0,
  '0x6FD97730': (m, a) => { ITEMS_ApplySinglePropAndEthereal113c(m, a[0]!, a[1]!, a[2]! | 0); return 0; },
  '0x6FDA1870': (m, a) => SKILLS_FindMeleeTargetPosition113c(m, a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
  '0x6FDA2660': (m, a) => SKILLS_AddSkillToUnit113c(m, a[0]!, a[1]! | 0) >>> 0,
  '0x6FDA28B0': (m, a) => { SKILLS_RemoveOrDecrementSkillFromUnit113c(m, a[0]!, a[1]! | 0, a[2]! | 0); return 0; },
  '0x6FDA29E0': (m, a) => { SKILLS_InitCharStartSkills113c(m, a[0]!); return 0; },
  '0x6FDA2AE0': (m, a) => { SKILLS_RefreshPassiveAuraSkills113c(m, a[0]!); return 0; },
  '0x6FDA2BC0': (m, a) => { SKILLS_SetSkillLevelOnUnit113c(m, a[0]!, a[1]! | 0, a[2]! | 0, a[3]! | 0, a[4]! | 0, a[5]! | 0); return 0; },
  '0x6FDD4C70': (m, a) => MONSTERS_GetCompCode113c(m, a[0]!, a[1]! | 0, a[2]! | 0) >>> 0,
};

function verifyVector(v: VectorRecord, overrideEax?: number, corruptAddr?: number): void {
  const runner = I14C1_RUNNERS[v.va];
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

describe('Lane C I14C-1 real-DLL differential vectors (15 functions)', () => {
  const vectors = loadVectors();

  it('covers all 15 I14C-1 VAs with >= 3 real-DLL vectors each', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    expect(counts.size).toBe(15);
    for (const va of Object.keys(I14C1_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(3);
    }
  });

  for (const v of vectors) {
    it(`${v.va} ${v.name} case ${v.case} (${v.note})`, () => {
      verifyVector(v);
  });
  }

  it('asserts D2CommonAssertError on invalid inputs', () => {
    const m = new SparseMemory113c();
    m.setU32(0x6fde9e1c, 0);
    expect(() => DRLGWARP_LinkWarpRoomExByDir113c(m, 0, 0, 0)).toThrow(D2CommonAssertError);
    expect(() => DRLGWARP_LinkWarpRoomExByDir113c(m, 0, m.alloc(0x100), 8)).toThrow(D2CommonAssertError);
    expect(() => ITEMMODS_ApplyItemProperty113c(m, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)).toThrow(D2CommonAssertError);
    const dt = m.alloc(0xd00);
    const charTbl = m.alloc(0x100);
    m.setU32(0x6fde9e1c, dt);
    m.setU32(dt + 0xbc4, charTbl);
    m.setU32(dt + 0xbc8, 7);
    m.setU32(dt + 0xb98, 0);
    m.setU32(dt + 0xba0, 100);
    m.setU16(charTbl + 0x60, 1);
    const u = m.alloc(0x100);
    m.setU32(u, 0);
    m.setU32(u + 0x04, 0);
    m.setU32(u + 0x28, m.alloc(0x20));
    expect(() => SKILLS_InitCharStartSkills113c(m, u)).toThrow(D2CommonAssertError);
  });

  it('exercises boundary conditions across all 15 I14C-1 functions', () => {
    const cloneVec = (va: string, caseIdx = 0) => {
      const v = vectors.find(r => r.va === va && r.case === caseIdx)!;
      const m = new SparseMemory113c();
      const bmBase = 0x0352c000;
      m.setU32(0x6fdd90b0, bmBase);
      for (let i = 0; i < 32; i++) m.setU32((bmBase + i * 4) >>> 0, (1 << i) >>> 0);
      for (let off = 0; off < 16; off += 4) m.setU32((0x6fdf1f00 + off) >>> 0, 0);
      for (const [k, val] of Object.entries(v.in.mem)) {
        m.setU32(Number(k) >>> 0, val >>> 0);
      }
      return { m, args: [...v.in.args] };
    };

    // 0x6FD953D0: bl < 8 boundary when all 8 directions fail
    {
      const { m, args } = cloneVec('0x6FD953D0', 0);
      const pAct = args[0]!;
      const pRoomEx = args[1]!;
      const pLevel = m.u32(pRoomEx + 0x58);
      const pDrlg = m.u32(pLevel + 0x1b4);
      const pWarp1 = m.u32(pDrlg + 0x90);
      const pWarp2 = m.u32(pWarp1 + 0x44);
      m.setU32(pWarp2 + 4, 0);
      m.setU32(pWarp2 + 4 + 8 * 4, 2);
      expect(DRLGWARP_LinkWarpRoomExByDir113c(m, pAct, pRoomEx, 0)).toBe(7);
    }

    // 0x6FD95550: non-0x85 level and 0x85 level near-list linking
    {
      const { m, args } = cloneVec('0x6FD953D0', 0);
      const pAct = args[0]!;
      const pRoomEx = args[1]!;
      const pLevel = m.u32(pRoomEx + 0x58);
      const pDrlg = m.u32(pLevel + 0x1b4);
      const pDstLevel = m.u32(pDrlg + 0x47c);
      const pOther = m.u32(pDstLevel + 0x10);
      m.setU32(pOther + 0x58, pDstLevel);
      m.setU32(pRoomEx + 0x28, 0x10);
      m.setU32(pRoomEx + 0x08, m.alloc(16));
      m.setU32(pOther + 0x08, m.alloc(16));
      m.setU32(pLevel + 0x1d4, 0x85);
      m.setU32((pLevel - 0x1d0) >>> 0, 0x85);
      DRLGROOM_LinkRoomAndWarps113c(m, pRoomEx, pAct);
      expect(m.u32(pRoomEx + 0x2c)).toBe(1);
    }

    // 0x6FD95990: nPropValue === 0 roll, multi-func loop with wVal offset and nAccum chaining
    {
      const { m, args } = cloneVec('0x6FD95990', 0);
      const pItem = args[1]!;
      const pProp = args[6]!;
      const dt = m.u32(0x6fde9e1c);
      const propTbl = m.u32(dt + 0xa4);
      const pStatListEx = m.u32(pItem + 0x5c);
      m.setU32(pProp, 0);
      m.setU32(pProp + 4, 0);
      m.setU32(pProp + 8, 5);
      m.setU32(pProp + 12, 5);
      m.fill(propTbl, 0x2e, 0);
      m.setU8(propTbl + 0x18, 8);
      m.setU16(propTbl + 0x20, 1);
      ITEMMODS_ApplyPropertyById113c(m, 1, pItem, 0, 0, 0, 0, pProp, 0, 0x40, 0);
      const pSub = m.u32(pStatListEx + 0x3c);
      expect(m.u16(pSub + 0x28)).toBe(1);

      const { m: m2, args: a2 } = cloneVec('0x6FD95990', 0);
      const pItem2 = a2[1]!;
      const pProp2 = a2[6]!;
      const dt2 = m2.u32(0x6fde9e1c);
      const propTbl2 = m2.u32(dt2 + 0xa4);
      const pPropTxt = propTbl2 + 0x2e;
      const pStatListEx2 = m2.u32(pItem2 + 0x5c);
      m2.setU32(pItem2 + 0x20, 0x12345678);
      m2.setU32(pItem2 + 0x24, 0x9abcdef0);
      m2.setU32(pProp2 + 8, 1);
      m2.setU32(pProp2 + 12, 10000);
      m2.setU8(pPropTxt + 0x18, 24);
      m2.setU16(pPropTxt + 0x20, 1);
      m2.setU8(pPropTxt + 0x18 + 1, 24);
      m2.setU16(pPropTxt + 0x20 + 2, 2);
      m2.setU8(pPropTxt + 0x18 + 2, 21);
      m2.setU16(pPropTxt + 0x20 + 4, 3);
      m2.setU16(pPropTxt + 0x0a + 4, 5);
      m2.setU16((pPropTxt - 0x0a + 4) >>> 0, 99);
      ITEMMODS_ApplyPropertyById113c(m2, 1, pItem2, pItem2, 0, 0, 0, pProp2, 0, 0x40, 0);
      const pSub2 = m2.u32(pStatListEx2 + 0x3c);
      const pStatsArr2 = m2.u32(pSub2 + 0x24);
      expect(m2.u16(pSub2 + 0x28)).toBe(3);
      expect(m2.u32(pStatsArr2 + 12)).toBe(m2.u32(pStatsArr2 + 4));
      expect(m2.u16(pStatsArr2 + 16)).toBe(5);
    }

    // 0x6FD95AA0: legacy item format (wItemFormat === 0) reading +0xac vs +0xb0
    {
      const { m, args } = cloneVec('0x6FD95AA0', 0);
      const pItem = args[0]!;
      const pProp = args[3]!;
      const dt = m.u32(0x6fde9e1c);
      const pItemData = m.u32(pItem + 0x14);
      const pStatListEx = m.u32(pItem + 0x5c);
      m.setU16(pItemData + 0x30, 0);
      m.setU32(dt + 0xac, 20);
      m.setU32(dt + 0xb0, 0);
      m.setU32(pProp, 13);
      ITEMMODS_ApplyItemProperty113c(m, pItem, 0x40, 0, pProp, 0, 0, 0, 0, 0, 0, 0);
      expect(m.u16(m.u32(pStatListEx + 0x3c) + 0x28)).toBeGreaterThan(0);
    }

    // 0x6FD95F90: pItemData === 0 guard and nSetItems - 1 calculation
    {
      const { m, args } = cloneVec('0x6FD95F90', 0);
      const pItem = args[0]!;
      const pUnit = args[1]!;
      const pStatListEx = m.u32(pItem + 0x5c);
      const origHead = m.u32(pStatListEx + 0x3c);
      m.setU32(pItem + 0x14, 0);
      m.setU32(1, 5);
      m.setU32(0x15, 1);
      ITEMMODS_ApplySetItemBonusProps113c(m, pItem, pUnit, 0);
      expect(m.u32(pStatListEx + 0x3c)).toBe(origHead);

      const { m: m2, args: a2 } = cloneVec('0x6FD95F90', 0);
      const pItem2 = a2[0]!;
      const pUnit2 = a2[1]!;
      const pStatListEx2 = m2.u32(pItem2 + 0x5c);
      const origHead2 = m2.u32(pStatListEx2 + 0x3c);
      const dt2 = m2.u32(0x6fde9e1c);
      const setTbl = m2.u32(dt2 + 0xc0c);
      const sitmTbl = m2.u32(dt2 + 0xc18);
      const pSetTxt = setTbl + 0x128;
      const pItemData2 = m2.u32(pItem2 + 0x14);
      const pItem2b = m2.alloc(0x100);
      const pItemData2b = m2.alloc(0x80);
      const pInv2 = m2.alloc(0x40);
      m2.setU32(pInv2, 0x01020304);
      m2.setU32(pInv2 + 0x0c, pItem2);
      m2.setU8(pItemData2 + 0x5c + 0x0d, 3);
      m2.setU32(pItemData2 + 0x5c + 0x08, pItem2b);
      m2.setU32(pItem2b, 4);
      m2.setU32(pItem2b + 0x04, m2.u32(pItem2 + 0x04));
      m2.setU32(pItem2b + 0x14, pItemData2b);
      m2.setU32(pItemData2b, 5);
      m2.setU32(pItemData2b + 0x28, 2);
      m2.setU32(pItemData2b + 0x34, 2);
      m2.setU8(pItemData2b + 0x5c + 0x0d, 3);
      m2.setU16(sitmTbl + 1 * 0x1b8 + 0x2e, 0);
      m2.setU16(sitmTbl + 2 * 0x1b8 + 0x2c, m2.u16(sitmTbl + 1 * 0x1b8 + 0x2c));
      m2.setU8(sitmTbl + 2 * 0x1b8 + 0x2e, 1);
      m2.setU32(pUnit2 + 0x60, pInv2);
      m2.setU32(pSetTxt + 0x0c, 2);
      m2.setU32(pSetTxt + 0x90, 0xffffffff);
      m2.setU32(pSetTxt + 0x10, 1);
      m2.setU32(pSetTxt + 0x18, 9);
      m2.setU32(pSetTxt + 0x1c, 9);
      ITEMMODS_ApplySetItemBonusProps113c(m2, pItem2, pUnit2, 0);
      expect(m2.u32(pStatListEx2 + 0x3c)).toBe(origHead2);
    }

    // 0x6FD960B0: pMagicProps + 0x0c, UniqueItems + 0x8c + i*0x10, SetItems fmt===0 loop i < 2
    {
      const { m, args } = cloneVec('0x6FD960B0', 0);
      const pItem = args[2]!;
      const dt = m.u32(0x6fde9e1c);
      const uniqTbl = m.u32(dt + 0xc24);
      const pUnique = uniqTbl + 0x14c;
      m.setU32(pUnique + 0x8c + 0x10, 2);
      m.setU32(pUnique + 0x8c + 0x18, 6);
      m.setU32(pUnique + 0x8c + 0x1c, 6);
      ITEMS_ApplyItemQualityMods113c(m, 3, 0, pItem, 0, 0, 0);
      expect(m.u16(m.u32(m.u32(pItem + 0x5c) + 0x3c) + 0x28)).toBe(2);

      const { m: m2, args: a2 } = cloneVec('0x6FD960B0', 1);
      const pItem2 = a2[2]!;
      const dt2 = m2.u32(0x6fde9e1c);
      const sitmTbl = m2.u32(dt2 + 0xc18);
      const pSetItem = sitmTbl + 0x1b8;
      const pItemData2 = m2.u32(pItem2 + 0x14);
      m2.setU16(pItemData2 + 0x30, 0);
      m2.setU32(dt2 + 0xac, 20);
      m2.setU32(pSetItem + 0x88, 13);
      m2.setU32(pSetItem + 0x88 + 2 * 0x10, 14);
      m2.setU32(pSetItem + 0x88 + 2 * 0x10 + 8, 9);
      m2.setU32(pSetItem + 0x88 + 2 * 0x10 + 12, 9);
      ITEMS_ApplyItemQualityMods113c(m2, 4, 0, pItem2, 0, 0, 0);
      expect(m2.u16(m2.u32(m2.u32(pItem2 + 0x5c) + 0x3c) + 0x28)).toBe(1);

      const { m: m3, args: a3 } = cloneVec('0x6FD960B0', 2);
      const pItem3 = a3[2]!;
      const pMagicProps = a3[3]!;
      const pSeed = a3[4]!;
      const propTbl3 = m3.u32(m3.u32(0x6fde9e1c) + 0xa4);
      m3.fill(propTbl3, 0x2e, 0);
      m3.setU8(propTbl3 + 0x18, 8);
      m3.setU16(propTbl3 + 0x20, 1);
      m3.setU32(pMagicProps + 0x0c, 0);
      m3.setU32(pMagicProps + 0x14, 7);
      m3.setU32(pMagicProps + 0x18, 7);
      m3.setU32(pMagicProps + 0x1c, 0xffffffff);
      ITEMS_ApplyItemQualityMods113c(m3, 1, 0, pItem3, pMagicProps, pSeed, 0);
      expect(m3.u16(m3.u32(m3.u32(pItem3 + 0x5c) + 0x3c) + 0x28)).toBeGreaterThan(0);

      const { m: m4, args: a4 } = cloneVec('0x6FD960B0', 1);
      const pItem4 = a4[2]!;
      const sitmTbl4 = m4.u32(m4.u32(0x6fde9e1c) + 0xc18);
      m4.setU32(sitmTbl4 + 0x1b8 + 0x88, 0xffffffff);
      m4.setU8(sitmTbl4 + 0x1b8 + 0x87, 0);
      ITEMS_ApplyItemQualityMods113c(m4, 4, 0, pItem4, 0, 0, 0);
      expect(m4.u32(m4.u32(m4.u32(pItem4 + 0x5c) + 0x3c) + 0x10)).toBe(0x40);
    }

    // 0x6FD96770: pStatListEx + 0x3c vs + 0x40, node + 0x14 === 0xab, and i < 7 loop
    {
      const { m, args } = cloneVec('0x6FD96770', 0);
      const pItem = args[0]!;
      const pStatListEx = m.u32(pItem + 0x5c);
      const n1 = m.alloc(0x40);
      const n2 = m.alloc(0x40);
      m.setU32(n1 + 0x14, 1);
      m.setU32(n1 + 0x2c, n2);
      m.setU32(n2 + 0x14, 0xab);
      m.setU32(pStatListEx + 0x3c, n1);
      expect(ITEMS_ApplyRunewordProps113c(m, pItem, pItem, 0)).toBe(0);

      m.setU32(pStatListEx + 0x3c, 0);
      m.setU32(n1 + 0x2c, 0);
      m.setU32(n1 + 0x14, 1);
      m.setU32(n1 + 0x18, 0xab);
      m.setU32(pStatListEx + 0x40, n1);
      expect(ITEMS_ApplyRunewordProps113c(m, pItem, pItem, 0)).toBe(1);

      const { m: m2, args: a2 } = cloneVec('0x6FD96770', 0);
      const pItem2 = a2[0]!;
      const runeTbl = m2.u32(0x6fdefbd8);
      const pRunes = runeTbl + 0x120;
      for (let i = 0; i <= 7; i++) {
        m2.setU32(pRunes + 0xb0 + i * 0x10, 1);
        m2.setU32(pRunes + 0xb0 + i * 0x10 + 8, 2);
        m2.setU32(pRunes + 0xb0 + i * 0x10 + 12, 2);
      }
      expect(ITEMS_ApplyRunewordProps113c(m2, pItem2, pItem2, 0)).toBe(1);
      const subNode = m2.u32(m2.u32(pItem2 + 0x5c) + 0x3c);
      expect(m2.u32(m2.u32(subNode + 0x24) + 4)).toBe(14);
    }

    // 0x6FD97730: non-ethereal vs ethereal AC bonus
    {
      const { m, args } = cloneVec('0x6FD97730', 0);
      const pItem = args[0]!;
      const pProp = args[1]!;
      const pItemData = m.u32(pItem + 0x14);
      const pStatListEx = m.u32(pItem + 0x5c);
      const pStatsArr = m.u32(pStatListEx + 0x24);
      m.setU16(pStatsArr + 2, 0x1f);
      m.setU32(pStatsArr + 4, 20);
      m.setU16(pStatListEx + 0x28, 1);
      m.setU32(pItemData + 0x18, 0);
      ITEMS_ApplySinglePropAndEthereal113c(m, pItem, pProp, 0);
      expect(m.u32(pStatsArr + 4)).toBe(20);

      m.setU32(pItemData + 0x18, 0x400000);
      ITEMS_ApplySinglePropAndEthereal113c(m, pItem, pProp, 0);
      expect(m.u32(pStatsArr + 4)).toBe(30);
    }

    // 0x6FDA1870: melee range check, pTarget===0 path, and blocked spiral search
    {
      const { m, args } = cloneVec('0x6FDA1870', 0);
      const [pUnit, pTarget, pOutX, pOutY] = args as [number, number, number, number];
      const pPathU = m.u32(pUnit + 0x2c);
      const pPathT = m.u32(pTarget + 0x2c);
      m.setU16(pPathT + 2, m.u16(pPathU + 2) + 1);
      m.setU16(pPathT + 6, m.u16(pPathU + 6));
      expect(SKILLS_FindMeleeTargetPosition113c(m, pUnit, pTarget, pOutX, pOutY)).toBe(0);

      const { m: m2, args: a2 } = cloneVec('0x6FDA1870', 0);
      const [pUnit2, , pOutX2, pOutY2] = a2 as [number, number, number, number];
      const pPathU2 = m2.u32(pUnit2 + 0x2c);
      m2.setU16(pPathU2 + 0x10, 105);
      m2.setU16(pPathU2 + 0x12, 102);
      m2.setU16((pPathU2 - 0x12) >>> 0, 9999);
      expect(SKILLS_FindMeleeTargetPosition113c(m2, pUnit2, 0, pOutX2, pOutY2)).toBe(1);

      const { m: m3, args: a3 } = cloneVec('0x6FDA1870', 0);
      const [pUnit3, pTarget3, pOutX3, pOutY3] = a3 as [number, number, number, number];
      const pRoom = m3.u32(m3.u32(pUnit3 + 0x2c) + 0x1c);
      const pMap = m3.u32(m3.u32(pRoom + 0x20) + 0x20);
      for (let i = 0; i < 1024; i++) m3.setU16(pMap + i * 2, 0x804);
      expect(SKILLS_FindMeleeTargetPosition113c(m3, pUnit3, pTarget3, pOutX3, pOutY3)).toBe(0);
    }

    // 0x6FDA2660: nSkillId === nSkillsCount boundary and wPassiveState toggle
    {
      const { m, args } = cloneVec('0x6FDA2660', 0);
      expect(SKILLS_AddSkillToUnit113c(m, args[0]!, 16)).toBe(0);

      const { m: m2, args: a2 } = cloneVec('0x6FDA2AE0', 0);
      const pUnit2 = a2[0]!;
      const dt2 = m2.u32(0x6fde9e1c);
      const skilTbl = m2.u32(dt2 + 0xb98);
      const expPtr = m2.alloc(8);
      m2.setU32(expPtr, 99);
      m2.setU32(0x6fdf0b50, expPtr);
      m2.setU8(skilTbl + 1 * 0x23c + 0x0c, 1);
      m2.setU16(skilTbl + 1 * 0x23c + 0x94, 2);
      const pStateFlags = m2.u32(m2.u32(pUnit2 + 0x5c) + 0x58);
      m2.setU32(pStateFlags, 0);
      expect(SKILLS_AddSkillToUnit113c(m2, pUnit2, 1)).not.toBe(0);
      expect(m2.u32(pStateFlags) & 4).toBe(4);
    }

    // 0x6FDA28B0: bDecrement === 1 with lvl === 1 clearing pUsed (+0x10) and unlinking
    {
      const { m, args } = cloneVec('0x6FDA28B0', 0);
      const pUnit = args[0]!;
      const pInfo = m.u32(pUnit + 0xa8);
      const pSkill = m.u32(pInfo + 4);
      m.setU32(pInfo + 0x10, pSkill);
      m.setU32(pSkill + 0x28, 1);
      SKILLS_RemoveOrDecrementSkillFromUnit113c(m, pUnit, 1, 1);
      expect(m.u32(pInfo + 0x10)).toBe(0);
      expect(m.u32(pInfo + 4)).toBe(0);
    }

    // 0x6FDA29E0: startSk === nSkillsCount boundary
    {
      const { m, args } = cloneVec('0x6FDA29E0', 0);
      const pUnit = args[0]!;
      const dt = m.u32(0x6fde9e1c);
      const charTbl = m.u32(dt + 0xbc4);
      m.setU32(dt + 0xba0, 15);
      m.setU16(charTbl + 0xae, 15);
      m.setU32(m.u32(dt + 0xb98) + 15 * 0x23c, 15);
      SKILLS_InitCharStartSkills113c(m, pUnit);
      expect(m.u32(m.u32(m.u32(pUnit + 0xa8) + 4) + 4)).toBe(0);
    }

    // 0x6FDA2AE0: uType === 2 guard and nAuraCount === 0 loop bound
    {
      const { m, args } = cloneVec('0x6FDA2AE0', 0);
      const pUnit = args[0]!;
      m.setU32(pUnit, 2);
      const pStateFlags = m.u32(m.u32(pUnit + 0x5c) + 0x58);
      m.setU32(pStateFlags + 4, 0);
      SKILLS_RefreshPassiveAuraSkills113c(m, pUnit);
      expect(m.u32(pStateFlags + 4)).toBe(0);

      const dt = m.u32(0x6fde9e1c);
      const auraCntAddr = (dt + 0xbb0) >>> 0;
      m.setU32(auraCntAddr, 0);
      let auraCntReads = 0;
      const origU32 = m.u32.bind(m);
      m.u32 = (addr: number) => {
        if ((addr >>> 0) === auraCntAddr) auraCntReads++;
        return origU32(addr);
      };
      SKILLS_RefreshPassiveAuraSkills113c(m, pUnit);
      expect(auraCntReads).toBe(1);
    }

    // 0x6FDA2BC0: linked list traversal, +0xa8 vs +0xac, level update, and sk === 0 guard
    {
      const { m, args } = cloneVec('0x6FDA28B0', 0);
      const pUnit = args[0]!;
      const pInfo = m.u32(pUnit + 0xa8);
      const pSkill = m.u32(pInfo + 4);
      const fakeInfo = m.alloc(0x20);
      const fakeSk = m.alloc(0x40);
      m.setU32(fakeSk, m.u32(pSkill));
      m.setU32(fakeSk + 0x34, 0xffffffff);
      m.setU32(fakeInfo + 4, fakeSk);
      m.setU32(pUnit + 0xac, fakeInfo);
      const sk0 = m.alloc(0x40);
      m.setU32((sk0 - 4) >>> 0, fakeSk);
      const skTxt0 = m.u32(m.u32(0x6fde9e1c) + 0xb98) + 2 * 0x23c;
      m.setU16(skTxt0, 2);
      m.setU32(sk0, skTxt0);
      m.setU32(sk0 + 4, pSkill);
      m.setU32(sk0 + 0x34, 0xffffffff);
      m.setU32(pInfo + 4, sk0);
      SKILLS_SetSkillLevelOnUnit113c(m, pUnit, 1, 9, 0, 0, 0);
      expect(m.u32(pSkill + 0x28)).toBe(9);
      expect(m.u32(fakeSk + 0x28)).toBe(0);
      expect(m.u32(sk0 + 0x28)).toBe(0);

      m.setU32(0x28, 0xdeadbeef);
      SKILLS_SetSkillLevelOnUnit113c(m, pUnit, 99, 0, 0, 0, 0);
      expect(m.u32(0x28)).toBe(0xdeadbeef);
    }

    // 0x6FDD4C70: compIdx === 16 boundary
    {
      const { m, args } = cloneVec('0x6FDD4C70', 0);
      const pUnit = args[0]!;
      const dt = m.u32(0x6fde9e1c);
      const mon2Tbl = m.u32(dt + 0xa90);
      m.setU8(mon2Tbl + 0x134 + 0x15 + 16, 1);
      expect(MONSTERS_GetCompCode113c(m, pUnit, 16, 0)).toBe(0);
    }

    // 0x6FDA29E0: line 1039 assert path when pUnit+0xa8 becomes 0 after refresh
    {
      const { m } = cloneVec('0x6FDA29E0', 0);
      const u2 = m.alloc(0x100);
      const sl2 = m.alloc(0x20);
      const skAttack = m.alloc(0x40);
      const skTxt0 = m.alloc(0x10);
      m.setU16(skTxt0, 0);
      m.setU32(skAttack, skTxt0);
      m.setU32(skAttack + 0x34, 0xffffffff);
      m.setU32(sl2 + 0x04, skAttack);
      m.setU32(sl2 + 0x08, 1);
      m.setU32(u2 + 0xa8, sl2);
      let u2a8Reads = 0;
      const baseU32 = m.u32.bind(m);
      m.u32 = (addr: number) => {
        if ((addr >>> 0) === ((u2 + 0xa8) >>> 0)) {
          u2a8Reads++;
          if (u2a8Reads >= 3) return 0;
        }
        return baseU32(addr);
      };
      let line1039 = 0;
      try {
        SKILLS_InitCharStartSkills113c(m, u2);
      } catch (e) {
        line1039 = (e as D2CommonAssertError).line;
      }
      expect(line1039).toBe(1039);
    }
  });
});
