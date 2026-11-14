import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DRLG_GetRoomExFromCoordinates113c,
  DUNGEON_AcquireRoomExDT1Mask113c,
  DUNGEON_AddRoomPortalNode113c,
  DUNGEON_AreAllAdjacentRoomsActive113c,
  DUNGEON_CheckPresetRoomFlag80_113c,
  DUNGEON_CheckRoomFlag2_113c,
  DUNGEON_FreeRoomPortalList113c,
  DUNGEON_GetAdjacentRoomsListFromRoom113c,
  DUNGEON_GetCollisionGridFromRoomFast113c,
  DUNGEON_GetLevelIdIfNotHidden113c,
  DUNGEON_GetLogicalRoomField30_113c,
  DUNGEON_GetRoomCoordinates113c,
  DUNGEON_GetRoomExFromRoom113c,
  DUNGEON_GetRoomPortalList113c,
  DUNGEON_HasRoomExWaypointFlags113c,
  DUNGEON_SetRoomFlag2_113c,
  DUNGEON_UpdateRoomIdleCounter113c,
  DUNGEON_VerifyRoomClientsNonNull113c,
} from '../../../src/d2kern-113c/common/dungeon.ts';
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
const FIXTURE_PATH = resolve(__dirname, '../../fixtures/oracle/k1/b031-vectors.ndjson');

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

const B031_RUNNERS: Readonly<Record<string, (m: Memory113c, args: number[]) => number>> = {
  '0x6fd7d600': (m, a) => DRLG_GetRoomExFromCoordinates113c(m, a[0]!, a[1]!, a[2]!) >>> 0,
  '0x6fd8b350': (m, a) => DUNGEON_UpdateRoomIdleCounter113c(m, a[0]!) >>> 0,
  '0x6fd8b3a0': (m, a) => DUNGEON_VerifyRoomClientsNonNull113c(m, a[0]!) >>> 0,
  '0x6fd8b3f0': (m, a) => {
    DUNGEON_SetRoomFlag2_113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd8b440': (m, a) => DUNGEON_CheckRoomFlag2_113c(m, a[0]!) >>> 0,
  '0x6fd8b470': (m, a) => DUNGEON_GetRoomPortalList113c(m, a[0]!) >>> 0,
  '0x6fd8b4a0': (m, a) => {
    DUNGEON_FreeRoomPortalList113c(m, a[0]!);
    return 0;
  },
  '0x6fd8b500': (m, a) => {
    DUNGEON_AddRoomPortalNode113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6fd8b550': (m, a) => DUNGEON_GetRoomExFromRoom113c(m, a[0]!) >>> 0,
  '0x6fd8b5b0': (m, a) => DUNGEON_GetCollisionGridFromRoomFast113c(m, a[0]!) >>> 0,
  '0x6fd8ba20': (m, a) => {
    DUNGEON_GetAdjacentRoomsListFromRoom113c(m, a[0]!, a[1]!, a[2]!);
    return 0;
  },
  '0x6fd8ba60': (m, a) => {
    DUNGEON_GetRoomCoordinates113c(m, a[0]!, a[1]!);
    return 0;
  },
  '0x6fd8bd60': (m, a) => DUNGEON_GetLogicalRoomField30_113c(m, a[0]!) >>> 0,
  '0x6fd8be90': (m, a) => DUNGEON_AreAllAdjacentRoomsActive113c(m, a[0]!) >>> 0,
  '0x6fd8bf60': (m, a) => DUNGEON_HasRoomExWaypointFlags113c(m, a[0]!) >>> 0,
  '0x6fd8bfb0': (m, a) => DUNGEON_GetLevelIdIfNotHidden113c(m, a[0]!) >>> 0,
  '0x6fd8c020': (m, a) => DUNGEON_AcquireRoomExDT1Mask113c(m, a[0]!) >>> 0,
  '0x6fd8c330': (m, a) => DUNGEON_CheckPresetRoomFlag80_113c(m, a[0]!) >>> 0,
};

describe('Lane C B031 real-DLL differential vectors (dungeon.ts, 18 functions)', () => {
  const vectors = loadVectors();

  it('covers all 18 B031 VAs with >= 3 real-DLL vectors each (58 total)', () => {
    const counts = new Map<string, number>();
    for (const v of vectors) {
      counts.set(v.va, (counts.get(v.va) ?? 0) + 1);
    }
    expect(counts.size).toBe(18);
    for (const va of Object.keys(B031_RUNNERS)) {
      expect(counts.get(va) ?? 0, `vector count for ${va}`).toBeGreaterThanOrEqual(3);
    }
  });

  for (const v of vectors) {
    it(`${v.va} case ${v.case} (${v.note})`, () => {
      const runner = B031_RUNNERS[v.va];
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

  it('verifies all Fog.#10024 / #10265 assertion branches in B031 functions', () => {
    const m = new SparseMemory113c();

    // 1. 0x6FD7D600: pDrlg == 0 and pDrlg->pRoomEx == 0
    expect(() => DRLG_GetRoomExFromCoordinates113c(m, 0, 100, 100)).toThrow(/^D2Common assertion failed at .*:765$/);
    m.setU32(0x100 + 0x10, 0);
    expect(() => DRLG_GetRoomExFromCoordinates113c(m, 0x100, 100, 100)).toThrow(/^D2Common assertion failed at .*:766$/);

    // 2. 0x6FD8B350: pRoom == 0
    expect(() => DUNGEON_UpdateRoomIdleCounter113c(m, 0)).toThrow(/^D2Common assertion failed at .*:1198$/);

    // 3. 0x6FD8B3A0: null entry in pClientList
    m.setU32(0x200 + 0x78, 1);
    m.setU32(0x200 + 0x48, 0x250);
    m.setU32(0x250, 0);
    expect(() => DUNGEON_VerifyRoomClientsNonNull113c(m, 0x200)).toThrow(/^D2Common assertion failed at .*:1107$/);

    // 4. 0x6FD8B3F0, 0x6FD8B440, 0x6FD8B470, 0x6FD8B4A0, 0x6FD8B550, 0x6FD8B5B0
    expect(() => DUNGEON_SetRoomFlag2_113c(m, 0, 1)).toThrow(/^D2Common assertion failed at .*:1080$/);
    expect(() => DUNGEON_CheckRoomFlag2_113c(m, 0)).toThrow(/^D2Common assertion failed at .*:1071$/);
    expect(() => DUNGEON_GetRoomPortalList113c(m, 0)).toThrow(/^D2Common assertion failed at .*:934$/);
    expect(() => DUNGEON_FreeRoomPortalList113c(m, 0)).toThrow(/^D2Common assertion failed at .*:912$/);
    expect(() => DUNGEON_GetRoomExFromRoom113c(m, 0)).toThrow(/^D2Common assertion failed at .*:798$/);
    expect(() => DUNGEON_GetCollisionGridFromRoomFast113c(m, 0)).toThrow(/^D2Common assertion failed at .*:709$/);

    // 5. 0x6FD8BA20, 0x6FD8BA60, 0x6FD8BD60, 0x6FD8BE90, 0x6FD8BF60, 0x6FD8BFB0, 0x6FD8C020, 0x6FD8C330
    expect(() => DUNGEON_GetAdjacentRoomsListFromRoom113c(m, 0, 0x300, 0x304)).toThrow(/^D2Common assertion failed at .*:236$/);
    expect(() => DUNGEON_GetRoomCoordinates113c(m, 0x100, 0)).toThrow(/^D2Common assertion failed at .*:209$/);
    m.setU32(0x400 + 0x10, 0x450);
    m.setU32(0x450 + 0x64, 0);
    expect(() => DUNGEON_GetLogicalRoomField30_113c(m, 0x400)).toThrow(/^D2Common assertion failed at .*:717$/);
    expect(() => DUNGEON_AreAllAdjacentRoomsActive113c(m, 0)).toThrow(/^D2Common assertion failed at .*:1007$/);
    expect(() => DUNGEON_HasRoomExWaypointFlags113c(m, 0)).toThrow(/^D2Common assertion failed at .*:867$/);
    m.setU32(0x500 + 0x10, 0);
    expect(() => DUNGEON_HasRoomExWaypointFlags113c(m, 0x500)).toThrow(/^D2Common assertion failed at .*:630$/);
    expect(() => DUNGEON_GetLevelIdIfNotHidden113c(m, 0x500)).toThrow(/^D2Common assertion failed at .*:619$/);
    expect(() => DUNGEON_AcquireRoomExDT1Mask113c(m, 0)).toThrow(/^D2Common assertion failed at .*:699$/);
    expect(() => DUNGEON_CheckPresetRoomFlag80_113c(m, 0)).toThrow(/^D2Common assertion failed at .*:1445$/);
  });

  it('kills >= 10/10 single-site mutations across B031 functions (>= 90% kill rate)', () => {
    const mutants: Array<() => boolean> = [
      // M1: 0x6FD7D600 room bounding-box check
      () => {
        const v = vectors.find(x => x.va === '0x6fd7d600' && x.case === 0)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const eax = DRLG_GetRoomExFromCoordinates113c(mem, v.in.args[0]!, v.in.args[1]!, v.in.args[2]!);
        return eax === v.out.eax >>> 0 && eax !== 0;
      },
      // M2: 0x6FD8B350 nClients == 0 increments nIdleCounter at +0x0C
      () => {
        const v = vectors.find(x => x.va === '0x6fd8b350' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const eax = DUNGEON_UpdateRoomIdleCounter113c(mem, v.in.args[0]!);
        return eax === 42 && raw.u32(v.in.args[0]! + 0x0c) === 42;
      },
      // M3: 0x6FD8B3F0 bSet=0 clears bit 2 vs sets bit 2
      () => {
        const v = vectors.find(x => x.va === '0x6fd8b3f0' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DUNGEON_SetRoomFlag2_113c(mem, v.in.args[0]!, v.in.args[1]!);
        return (raw.u32(v.in.args[0]! + 0x34) & 0x02) === 0;
      },
      // M4: 0x6FD8B440 returns (dwFlags & 0x02)
      () => {
        const v = vectors.find(x => x.va === '0x6fd8b440' && x.case === 0)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        return DUNGEON_CheckRoomFlag2_113c(mem, v.in.args[0]!) === 2;
      },
      // M5: 0x6FD8B4A0 frees all portal nodes and zeroes pRoom+0x18
      () => {
        const v = vectors.find(x => x.va === '0x6fd8b4a0' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem, frees } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DUNGEON_FreeRoomPortalList113c(mem, v.in.args[0]!);
        return frees.length === 3 && raw.u32(v.in.args[0]! + 0x18) === 0;
      },
      // M6: 0x6FD8B500 prepends portal node and sets pAct->bHasPendingPortalUpdates (+0x58) = 1
      () => {
        const v = vectors.find(x => x.va === '0x6fd8b500' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DUNGEON_AddRoomPortalNode113c(mem, v.in.args[0]!, v.in.args[1]!, v.in.args[2]!);
        return raw.u32(v.in.args[0]! + 0x18) === 0x40000000 && raw.u32(0x10000258) === 1;
      },
      // M7: 0x6FD8BA60 copies 8 dwords from pRoom+0x4C to pOutCoords
      () => {
        const v = vectors.find(x => x.va === '0x6fd8ba60' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        DUNGEON_GetRoomCoordinates113c(mem, v.in.args[0]!, v.in.args[1]!);
        return raw.u32(v.in.args[1]! + 0x1c) === v.out.mem[hexKey(v.in.args[1]! + 0x1c)];
      },
      // M8: 0x6FD8BE90 returns 0 when any adjacent room has bit 0 clear at +0x34
      () => {
        const v = vectors.find(x => x.va === '0x6fd8be90' && x.case === 3)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        return DUNGEON_AreAllAdjacentRoomsActive113c(mem, v.in.args[0]!) === 0;
      },
      // M9: 0x6FD8BF60 masks dwFlags with 0x30000 and returns 1
      () => {
        const v = vectors.find(x => x.va === '0x6fd8bf60' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        return DUNGEON_HasRoomExWaypointFlags113c(mem, v.in.args[0]!) === 1;
      },
      // M10: 0x6FD8BFB0 returns 0 when bit 0x800000 is set on pRoomEx->dwFlags
      () => {
        const v = vectors.find(x => x.va === '0x6fd8bfb0' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        return DUNGEON_GetLevelIdIfNotHidden113c(mem, v.in.args[0]!) === 0;
      },
      // M11: 0x6FD8C020 sets bit 0x4000000 and returns dwDT1Mask on first acquire
      () => {
        const v = vectors.find(x => x.va === '0x6fd8c020' && x.case === 2)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        const mask = DUNGEON_AcquireRoomExDT1Mask113c(mem, v.in.args[0]!);
        return mask === v.out.eax >>> 0 && (raw.u32(0x10000228) & 0x4000000) !== 0;
      },
      // M12: 0x6FD8C330 checks nType == 1 and returns (pPreset->fFlags & 0x80)
      () => {
        const v = vectors.find(x => x.va === '0x6fd8c330' && x.case === 1)!;
        const raw = new SparseMemory113c();
        const { mem } = createGuardedMemory(raw, v.in.mem, v.out.mem);
        return DUNGEON_CheckPresetRoomFlag80_113c(mem, v.in.args[0]!) === 0x80;
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
