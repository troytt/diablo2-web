import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CHAT_GetUsed113c,
  CHAT_SetUsed113c,
  DATATBLS_GetCubemainTxtRecordCount113c,
  DRLG_ResolveMonsterSubClassIdForRoom113c,
  DRLGGRID_Get3x3Neighborhood113c,
  DRLGOUTPLACE_CanStepMazeLinkNode113c,
  MONSTER_CheckMonTypeFlag0x20_113c,
  MONSTER_GetMonStatsInteractBit113c,
  MONSTER_IsSarcophagusBaseAndZeroArg113c,
  PATH_QuantizeDeltaIndex25_113c,
  SGPT_DATA_TABLES_PTR_VA,
} from '../../../src/d2kern-113c/common/drlg/drlg-ver.ts';
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
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b019-vectors.ndjson');

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
): { mem: Memory113c; rogueWrites: number[] } {
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
  const checkWrite = (addr: number, width: number): void => {
    for (let i = 0; i < width; i++) {
      const b = (addr + i) >>> 0;
      if (!allowedWriteBytes.has(b)) {
        rogueWrites.push(b);
      }
    }
  };

  const mem: Memory113c = {
    alloc: size => raw.alloc(size),
    u8: p => raw.u8(p),
    u16: p => raw.u16(p),
    u32: p => raw.u32(p),
    setU8: (p, v) => {
      checkWrite(p >>> 0, 1);
      raw.setU8(p, v);
    },
    setU16: (p, v) => {
      checkWrite(p >>> 0, 2);
      raw.setU16(p, v);
    },
    setU32: (p, v) => {
      checkWrite(p >>> 0, 4);
      raw.setU32(p, v);
    },
    get: (base, f, idx) => raw.get(base, f, idx),
    set: (base, f, v, idx = 0) => {
      const width = f.type === 'u8' ? 1 : f.type === 'u16' ? 2 : 4;
      checkWrite((base + f.off + idx * width) >>> 0, width);
      raw.set(base, f, v, idx);
    },
    fill: (p, len, v) => {
      checkWrite(p >>> 0, len);
      raw.fill(p, len, v);
    },
  };

  return { mem, rogueWrites };
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

const B019_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6fd67c80': (m, a) => DRLGOUTPLACE_CanStepMazeLinkNode113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!) >>> 0,
  '0x6fd681e0': (m, a) => {
    CHAT_SetUsed113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd681f0': (m, a) => CHAT_GetUsed113c(m, a[0]!) >>> 0,
  '0x6fd6a610': (m, a) => MONSTER_CheckMonTypeFlag0x20_113c(m, a[0]!) >>> 0,
  '0x6fd6a720': (m, a) => MONSTER_GetMonStatsInteractBit113c(m, a[0]!) >>> 0,
  '0x6fd6a770': (m, a) => DRLG_ResolveMonsterSubClassIdForRoom113c(m, a[0]!, a[1]!) >>> 0,
  '0x6fd6a990': (m, a) => MONSTER_IsSarcophagusBaseAndZeroArg113c(m, a[0]!, a[1]!) >>> 0,
  '0x6fd6b880': m => DATATBLS_GetCubemainTxtRecordCount113c(m) >>> 0,
  '0x6fd8d810': (m, a) => {
    DRLGGRID_Get3x3Neighborhood113c(m, a[0]!, a[1]!, a[2]!, a[3]!);
    return 0;
  },
  '0x6fd8e230': (_m, a) => PATH_QuantizeDeltaIndex25_113c(a[0]!, a[1]!, a[2]!, a[3]!) >>> 0,
};

describe('Lane C B019 real-DLL differential vectors (drlg-ver.ts, 10 functions)', () => {
  const vectors = loadVectors();

  it('covers all 10 B019 VAs with >= 3 real-DLL vectors each', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(counts.size).toBe(10);
    for (const va of Object.keys(B019_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(3);
    }
  });

  for (const v of vectors) {
    it(`${v.va} case ${v.case} (${v.note})`, () => {
      const runner = B019_RUNNERS[v.va];
      expect(runner, `missing runner for ${v.va}`).toBeDefined();
      const raw = new SparseMemory113c();
      const { mem, rogueWrites } = createGuardedMemory(raw, v.in.mem, v.out.mem);
      const eax = runner!(mem, v.in.args);
      expect(eax >>> 0).toBe(v.out.eax >>> 0);
      expect(rogueWrites).toEqual([]);
      assertPostMemory(raw, v.out.mem);
    });
  }

  it('0x6FD6A770 DRLG_ResolveMonsterSubClassIdForRoom113c: unguarded pLevelsTxt=0 reads u8(0x33) for pRoom1==0, nLevelId==0, and nLevelId>=nLevelsCount', () => {
    const m = new SparseMemory113c();
    m.setU32(SGPT_DATA_TABLES_PTR_VA, 0x10000);
    m.setU32(0x10000 + 0xc5c, 3);
    m.setU8(0x33, 0);

    // 1. pRoom1 == 0 -> pLevelsTxt = 0 -> u8(0x33) == 0 -> returns nClassId without invented NULL guard
    expect(DRLG_ResolveMonsterSubClassIdForRoom113c(m, 0, 42)).toBe(42);

    // 2. nLevelId == 0 -> pLevelsTxt = 0 -> u8(0x33) == 0 -> returns nClassId
    m.setU32(0x2000 + 0x10, 0x3000);
    m.setU32(0x3000 + 0x58, 0x4000);
    m.setU32(0x4000 + 0x1d0, 0);
    expect(DRLG_ResolveMonsterSubClassIdForRoom113c(m, 0x2000, 17)).toBe(17);

    // 3. nLevelId >= nLevelsCount -> pLevelsTxt = 0 -> u8(0x33) == 0 -> returns nClassId
    m.setU32(0x4000 + 0x1d0, 5);
    expect(DRLG_ResolveMonsterSubClassIdForRoom113c(m, 0x2000, 29)).toBe(29);
  });
});
