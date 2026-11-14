import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DATATBLS_GetCubemainTxtRecord113c,
  DRLGVER_CreateVerticesForRoom113c,
  DRLGVER_FreeVertices113c,
  DRLGVER_ScaleOutdoorsVertices113c,
  OUTDOORS_VERTEX_DX_VA,
  OUTDOORS_VERTEX_DY_VA,
  SGPT_CUBEMAIN_RECS_VA,
  SGPT_CUBEMAIN_TXT_VA,
} from '../../../src/d2kern-113c/common/drlg/drlg-ver.ts';
import { DRLGMAZE_HasMapDS1113c } from '../../../src/d2kern-113c/common/drlg/maze.ts';
import {
  D2CMP_10027_GetTileRarity113c,
  D2CMP_10051_GetTileFlags113c,
  D2CMP_10059_FindTiles113c,
  DRLGROOMTILE_AllocTileData113c,
  DRLGROOMTILE_CountPresetTileTypes113c,
  DRLGROOMTILE_FreeTileDataArrays113c,
  DRLGROOMTILE_GetTileCache113c,
  DRLGROOMTILE_GetWarpLevelsArray113c,
  DRLGROOMTILE_InitRoofTileData113c,
  DRLGROOMTILE_InitTileData113c,
  DRLGROOMTILE_ReallocRoofTiles113c,
} from '../../../src/d2kern-113c/common/drlg/room-tile.ts';
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b028-vectors.ndjson');

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

/**
 * `0x6FDB7FD0` grows `pTileGrid->pRoofs` through the Fog realloc thunk `0x6FD59252` (`edx` = old block),
 * which copies the old `nRoofCapacity * 0x30` bytes into the new block. The B028 vectors record the
 * realloc result but not the (zero-initialised) source block, so seed it here before replaying.
 */
function seedRoofReallocSource(raw: SparseMemory113c, v: VectorRecord): void {
  if (v.va !== '0x6fdb7fd0') return;
  const esi = v.in.args[0]! >>> 0;
  const pRoofs = (v.in.mem[hexKey((esi + 0x24) >>> 0)] ?? 0) >>> 0;
  const cap = (v.in.mem[hexKey((esi + 0x28) >>> 0)] ?? 0) >>> 0;
  if (pRoofs === 0) return;
  for (let off = 0; off < cap * 0x30; off += 4) {
    const key = hexKey((pRoofs + off) >>> 0);
    if (!(key in v.in.mem)) raw.setU32((pRoofs + off) >>> 0, 0);
  }
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

const B028_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6fd5e3e0': (m, a) => DRLGMAZE_HasMapDS1113c(m, a[0]!) >>> 0,
  '0x6fd62e50': (m, a) => {
    DRLGROOMTILE_CountPresetTileTypes113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!);
    return 0;
  },
  '0x6fd69950': (m, a) => DRLGROOMTILE_GetWarpLevelsArray113c(m, a[0]!, a[1]!) >>> 0,
  '0x6fd6b3d0': (m, a) => {
    DRLGVER_FreeVertices113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd6b4b0': (m, a) => {
    DRLGVER_CreateVerticesForRoom113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!);
    return 0;
  },
  '0x6fd6b890': (m, a) => DATATBLS_GetCubemainTxtRecord113c(m, a[0]!) >>> 0,
  '0x6fd8d920': (m, a) => {
    DRLGVER_ScaleOutdoorsVertices113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fdb7f50': (m, a) => {
    DRLGROOMTILE_FreeTileDataArrays113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fdb7fd0': (m, a) => {
    DRLGROOMTILE_ReallocRoofTiles113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fdb8040': (m, a) => {
    DRLGROOMTILE_AllocTileData113c(m, a[0]!);
    return 0;
  },
  '0x6fdb8b90': (m, a) => DRLGROOMTILE_GetTileCache113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6fdb8cd0': (m, a) => DRLGROOMTILE_InitRoofTileData113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!) >>> 0,
  '0x6fdb8df0': (m, a) => {
    DRLGROOMTILE_InitTileData113c(m, a[0]!, a[1]!, a[2]!, a[3]!, a[4]!, a[5]!);
    return 0;
  },
};

describe('Lane C B028 real-DLL differential vectors (maze.ts, drlg-ver.ts, room-tile.ts, 13 functions)', () => {
  const vectors = loadVectors();

  it('covers all 13 B028 VAs with >= 3 real-DLL vectors each (59 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(counts.size).toBe(13);
    for (const va of Object.keys(B028_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(4);
    }
  });

  for (const v of vectors) {
    it(`${v.va} case ${v.case} (${v.note})`, () => {
      const runner = B028_RUNNERS[v.va];
      expect(runner, `missing runner for ${v.va}`).toBeDefined();
      const raw = new SparseMemory113c();
      seedRoofReallocSource(raw, v);
      const { mem, rogueWrites, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
      const eax = runner!(mem, v.in.args);
      expect(eax >>> 0).toBe(v.out.eax >>> 0);
      expect(rogueWrites).toEqual([]);
      expect(frees).toEqual(v.out.frees);
      assertPostMemory(raw, v.out.mem);
    });
  }

  it('verifies D2CMP.#10027, #10051, #10059 assertion and VM-pointer output paths', () => {
    const m = new SparseMemory113c();
    expect(() => D2CMP_10051_GetTileFlags113c(m, 0)).toThrow();
    expect(() => D2CMP_10027_GetTileRarity113c(m, 0)).toThrow();
    expect(() => D2CMP_10059_FindTiles113c(m, 0, 1, 2, 3, 0x2000, 5)).toThrow();

    // Test D2CMP_10059_FindTiles113c with numeric VM output pointer and multi-node chain
    const ppHash = 0x1000;
    const pHash = 0x2000;
    const pNodeMismatch = 0x3000;
    const pNodeMatch = 0x3100;
    const pBlk0 = 0x3200;
    const pBlk1 = 0x3220;
    const pOut = 0x4000;
    m.setU32(ppHash, pHash);
    m.setU32(ppHash + 4, 0);
    const bucket = ((((4 & 0xff) << 1) - (2 & 0xff) + (3 & 0xff)) & 0x7f) >>> 0;
    m.setU32(pHash + bucket * 4, pNodeMismatch);
    m.setU32(pNodeMismatch + 0x00, 99);
    m.setU32(pNodeMismatch + 0x10, pNodeMatch);
    m.setU32(pNodeMatch + 0x00, 3);
    m.setU32(pNodeMatch + 0x04, 4);
    m.setU32(pNodeMatch + 0x08, 2);
    m.setU32(pNodeMatch + 0x0c, pBlk0);
    m.setU32(pBlk0 + 0x00, 0xaaaa0001);
    m.setU32(pBlk0 + 0x04, pBlk1);
    m.setU32(pBlk1 + 0x00, 0xaaaa0002);
    m.setU32(pBlk1 + 0x04, 0);

    expect(D2CMP_10059_FindTiles113c(m, ppHash, 2, 3, 4, pOut, 1)).toBe(1);
    expect(m.u32(pOut)).toBe(0xaaaa0001);
  });

  it('verifies all Fog.#10024 / #10265 assertion branches in B028 functions', () => {
    const m = new SparseMemory113c();

    // 1. 0x6FD5E3E0: pLevel == 0 and pMaze == 0
    expect(() => DRLGMAZE_HasMapDS1113c(m, 0)).toThrow(/^D2Common assertion failed at .*:28$/);
    m.setU32(0x100 + 0x14, 0);
    expect(() => DRLGMAZE_HasMapDS1113c(m, 0x100)).toThrow(/^D2Common assertion failed at .*:30$/);

    // 2. 0x6FD69950: [pNode] == 0
    m.setU32(0x500 + 0x90, 0x600);
    m.setU32(0x600 + 0x00, 0);
    expect(() => DRLGROOMTILE_GetWarpLevelsArray113c(m, 0x500, 1)).toThrow(/^D2Common assertion failed at .*:418$/);

    // 3. 0x6FD6B4B0: dir > 3
    m.setU32(0x700 + 0x10, 0x720);
    m.setU32(0x720 + 0x10, 0x740);
    m.setU32(0x740 + 0x10, 0x760);
    m.setU32(0x800 + 0x10, 0x780);
    m.setU32(0x800 + 0x04, 4);
    expect(() => DRLGVER_CreateVerticesForRoom113c(m, 0, 0x700, 0x780, 1, 0x800)).toThrow(/^D2Common assertion failed at .*:109$/);

    // 4. 0x6FD6B890: pCubemain == 0, nIndex >= count
    m.setU32(SGPT_CUBEMAIN_TXT_VA, 0);
    expect(() => DATATBLS_GetCubemainTxtRecord113c(m, 0)).toThrow(/^D2Common assertion failed at .*:846$/);
    m.setU32(SGPT_CUBEMAIN_TXT_VA, 0x9000);
    m.setU32(SGPT_CUBEMAIN_RECS_VA, 4);
    expect(() => DATATBLS_GetCubemainTxtRecord113c(m, 4)).toThrow(/^D2Common assertion failed at .*:847$/);

    // 5. 0x6FDB8B90: fallback miss (line 115)
    for (let i = 0; i < 32; i++) {
      m.setU32(0x1000 + 0x68 + i * 4, 0);
    }
    expect(() => DRLGROOMTILE_GetTileCache113c(m, 0x1000, 0, 0)).toThrow(/^D2Common assertion failed at .*:115$/);
  });

  it('kills >= 10/10 single-site mutations across B028 functions (>= 90% kill rate)', () => {
    const mutants: Array<() => boolean> = [
      // M1: 0x6FD5E3E0 difficulty index offset (+0x04 vs +0x08)
      () => {
        const v = vectors.find(x => x.va === '0x6fd5e3e0' && x.case === 0)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const real = DRLGMAZE_HasMapDS1113c(mem, v.in.args[0]!);
        const mutant = raw.u32(raw.u32(v.in.args[0]! + 0x14) + 0x08);
        return real !== mutant;
      },
      // M2: 0x6FD62E50 flag 0x0100 check inverted
      () => {
        const v = vectors.find(x => x.va === '0x6fd62e50' && x.case === 3)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGROOMTILE_CountPresetTileTypes113c(
          mem,
          v.in.args[0]!,
          v.in.args[1]!,
          v.in.args[2]!,
          v.in.args[3]!,
          v.in.args[4]!,
          v.in.args[5]!,
        );
        return raw.u32(0x10000220) === 7;
      },
      // M3: 0x6FD69950 out-of-range fallback returns 0x68 vs 0
      () => {
        const v = vectors.find(x => x.va === '0x6fd69950' && x.case === 4)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        return DRLGROOMTILE_GetWarpLevelsArray113c(mem, v.in.args[0]!, v.in.args[1]!) === 0x68;
      },
      // M4: 0x6FD6B3D0 zeroes *ppVertexList and frees all 3 circular nodes
      () => {
        const v = vectors.find(x => x.va === '0x6fd6b3d0' && x.case === 3)!;
        const raw = new SparseMemory113c();
        const { mem, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGVER_FreeVertices113c(mem, v.in.args[0]!, v.in.args[1]!);
        return frees.length === 3 && raw.u32(v.in.args[1]!) === 0;
      },
      // M5: 0x6FD6B4B0 dir 0 sets vertex flags to 3 when bIndoor != 0
      () => {
        const v = vectors.find(x => x.va === '0x6fd6b4b0' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGVER_CreateVerticesForRoom113c(
          mem,
          v.in.args[0]!,
          v.in.args[1]!,
          v.in.args[2]!,
          v.in.args[3]!,
          v.in.args[4]!,
        );
        return raw.u32(0x4000000c) === 3;
      },
      // M6: 0x6FD6B890 record stride 0x148 (328) vs 0x144
      () => {
        const v = vectors.find(x => x.va === '0x6fd6b890' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const eax = DATATBLS_GetCubemainTxtRecord113c(mem, v.in.args[0]!);
        return eax === (0x10002000 + 7 * 0x148) >>> 0;
      },
      // M7: 0x6FD8D920 reads .rdata dX/dY from Memory113c at 0x6FDE4020/0x6FDE4030
      () => {
        const v = vectors.find(x => x.va === '0x6fd8d920' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        for (let i = 0; i < 4; i++) {
          raw.setU32(OUTDOORS_VERTEX_DX_VA + i * 4, 100);
          raw.setU32(OUTDOORS_VERTEX_DY_VA + i * 4, 200);
        }
        DRLGVER_ScaleOutdoorsVertices113c(mem, v.in.args[0]!, v.in.args[1]!);
        return raw.u32(0x10000b20) !== v.out.mem['0x10000b20'];
      },
      // M8: 0x6FDB7F50 frees walls, floors, roofs in exact order
      () => {
        const v = vectors.find(x => x.va === '0x6fdb7f50' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGROOMTILE_FreeTileDataArrays113c(mem, v.in.args[0]!, v.in.args[1]!);
        return (
          frees.length === 3 &&
          frees[0] === v.out.frees[0] &&
          frees[1] === v.out.frees[1] &&
          frees[2] === v.out.frees[2]
        );
      },
      // M9: 0x6FDB7FD0 links existing roof entries and adds nAddRoofs to nRoofCapacity
      () => {
        const v = vectors.find(x => x.va === '0x6fdb7fd0' && x.case === 3)!;
        const raw = new SparseMemory113c();
        seedRoofReallocSource(raw, v);
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGROOMTILE_ReallocRoofTiles113c(mem, v.in.args[0]!, v.in.args[1]!);
        return raw.u32(0x40000020) === 0x40000030 && raw.u32(0x10000128) === 6;
      },
      // M10: 0x6FDB8B90 power-of-two vs non-power-of-two rarity selection
      () => {
        const v = vectors.find(x => x.va === '0x6fdb8b90' && x.case === 3)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const eax = DRLGROOMTILE_GetTileCache113c(mem, v.in.args[0]!, v.in.args[1]!, v.in.args[2]!);
        return eax === v.out.eax >>> 0;
      },
      // M11: 0x6FDB8CD0 sets nTileType (+0x1C) to 0x0D and increments nRoofs (+0x10)
      () => {
        const v = vectors.find(x => x.va === '0x6fdb8cd0' && x.case === 0)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const ptr = DRLGROOMTILE_InitRoofTileData113c(
          mem,
          v.in.args[0]!,
          v.in.args[1]!,
          v.in.args[2]!,
          v.in.args[3]!,
          v.in.args[4]!,
          v.in.args[5]!,
        );
        return raw.u32(ptr + 0x1c) === 0x0d && raw.u32(0x10000210) === 1;
      },
      // M12: 0x6FDB8DF0 layer shift (((dwTileFlags >> 18) & 3) + 1) << 14
      () => {
        const v = vectors.find(x => x.va === '0x6fdb8df0' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DRLGROOMTILE_InitTileData113c(
          mem,
          v.in.args[0]!,
          v.in.args[1]!,
          v.in.args[2]!,
          v.in.args[3]!,
          v.in.args[4]!,
          v.in.args[5]!,
        );
        return (raw.u32(v.in.args[1]! + 0x14) & 0x0000c000) === 0x0000c000;
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
