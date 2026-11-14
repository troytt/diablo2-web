/**
 * Lane E: `D2Game:0x6FC4CBE0` act room loop and its ambient-spawn helpers (`src/d2kern-113c/game/act-rooms-113c.ts`),
 * checked against the control flow of the `D2Game.dll` disassembly on hand-built rooms.
 */
import { describe, expect, it } from 'vitest'
import {
  GAME_UpdateActRooms113c,
  REGPOP_RollAmbientSpawn113c,
  REGPOP_SpawnAmbientPack113c,
  ROOM_TickSeedAndAmbientSpawn113c,
  type ActRoomsCallees113c,
} from '../../../src/d2kern-113c/game/act-rooms-113c.ts'
import { D2GAME_IAT_SGPT_DATATABLES_VA_113C } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import { D2LevelsTxt_SIZE } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import {
  DATATABLES_LEVELS_COUNT_OFF_113C,
  DATATABLES_LEVELS_TXT_OFF_113C,
  SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/tables/lvl-tbls-113c.ts'

function step(lo: number, hi: number): [number, number] {
  const p = BigInt(lo >>> 0) * 0x6ac690c5n + BigInt(hi >>> 0)
  return [Number(p & 0xffffffffn) >>> 0, Number(p >> 32n) >>> 0]
}

/** First low seed dword `lo` reachable from `(lo0, hi0)` such that `pred(next lo)` holds. */
function findSeed(pred: (lo: number) => boolean): [number, number] {
  for (let lo = 1; lo < 0x7fffffff; lo++) {
    const [n] = step(lo, 0)
    if (pred(n)) return [lo, 0]
  }
  throw new Error('no seed')
}

interface Calls {
  readonly log: string[]
  readonly callees: ActRoomsCallees113c
}

function recordingCallees(): Calls {
  const log: string[] = []
  const none = (): number => {
    throw new Error('unexpected callee')
  }
  return {
    log,
    callees: {
      refreshRoomUnits: (_m, _g, r) => void log.push(`refresh:${r.toString(16)}`),
      objects: {
        getLevelRoomCountInAct: none,
        checkLevelObjectHook: none,
        spawnObjectsByFn: none,
        spawn: { initObject: none, placeServerUnit: none },
      },
      initAmbientMonster: (_m, u) => void log.push(`ambient-init:${u.toString(16)}`),
      presets: {
        spawnMonsterPreset: none,
        spawnSpecialObject: none,
        allocUnitData: none,
        placePresetItem: none,
        freeUnit: none,
        initQuestObject1CB: none,
        initQuestObject1CD: none,
        initQuestObject21F: none,
      },
      regpop: {},
    },
  }
}

/** pGame with one act and `n` chained 0x80-byte active rooms (no level -> REGPOP_CanPopulateRoom == 0). */
function buildWorld(n: number): { m: SparseMemory113c; pGame: number; pAct: number; rooms: number[] } {
  const m = new SparseMemory113c()
  // sgptDataTables with LevelsTxt records 0..1 for 0x6FC4F0D0's LevelsTxt lookup (rooms are level 1)
  const pDataTables = m.alloc(0x1000)
  m.setU32(SGPT_DATATABLES_VA_113C, pDataTables)
  const pIat = m.alloc(4)
  m.setU32(pIat, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pIat)
  m.setU32((pDataTables + DATATABLES_LEVELS_TXT_OFF_113C) >>> 0, m.alloc(D2LevelsTxt_SIZE * 2))
  m.setU32((pDataTables + DATATABLES_LEVELS_COUNT_OFF_113C) >>> 0, 2)
  const pGame = m.alloc(0x2000)
  const pObjCtrl = m.alloc(0x100)
  m.setU32((pObjCtrl + 0x48 + 4) >>> 0, m.alloc(0x20))
  m.setU32((pGame + 0x10f0) >>> 0, pObjCtrl)
  const pAct = m.alloc(0x60)
  m.setU32((pGame + 0xbc) >>> 0, pAct)
  const rooms: number[] = []
  for (let i = 0; i < n; i++) {
    const pRoom = m.alloc(0x80)
    const pRoomEx = m.alloc(0x100)
    const pLevel = m.alloc(0x240)
    m.setU32((pLevel + 0x1d0) >>> 0, 1) // level 1: pGame->pMonReg[1] == NULL -> no density rolls; town -> no objects
    m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
    m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
    m.setU32((pRoom + 0x6c) >>> 0, 0x1000 + i)
    m.setU32((pRoom + 0x70) >>> 0, 0)
    m.setU32((pRoom + 0x78) >>> 0, 1) // one client: no ambient gate
    rooms.push(pRoom)
  }
  for (let i = 0; i + 1 < n; i++) m.setU32((rooms[i]! + 0x7c) >>> 0, rooms[i + 1]!)
  m.setU32((pAct + 0x10) >>> 0, rooms[0] ?? 0)
  return { m, pGame, pAct, rooms }
}

describe('D2Game 0x6FC4CBE0 act room loop (Lane E)', () => {
  it('does nothing for acts whose room list is not dirty (pAct+0x54 == 0)', () => {
    const { m, pGame, rooms } = buildWorld(2)
    const c = recordingCallees()
    GAME_UpdateActRooms113c(m, pGame, c.callees)
    expect(c.log).toEqual([])
    expect(m.u32((rooms[0]! + 0x6c) >>> 0)).toBe(0x1000)
  })

  it('populates unpopulated rooms in list order, steps every room seed once and clears the dirty flag', () => {
    const { m, pGame, pAct, rooms } = buildWorld(3)
    m.setU32((rooms[1]! + 0x34) >>> 0, 1) // room 1 already populated, flag2 clear -> refresh only
    m.setU32((pAct + 0x54) >>> 0, 1)
    const c = recordingCallees()
    GAME_UpdateActRooms113c(m, pGame, c.callees)
    const h = (p: number): string => p.toString(16)
    expect(c.log).toEqual([
      `refresh:${h(rooms[0]!)}`,
      `refresh:${h(rooms[1]!)}`,
      `refresh:${h(rooms[2]!)}`,
    ])
    for (let i = 0; i < 3; i++) {
      const [lo, hi] = step(0x1000 + i, 0)
      expect(m.u32((rooms[i]! + 0x6c) >>> 0)).toBe(lo)
      expect(m.u32((rooms[i]! + 0x70) >>> 0)).toBe(hi)
      expect(m.u32((rooms[i]! + 0x34) >>> 0) & 1).toBe(1)
    }
    expect(m.u32((pAct + 0x54) >>> 0)).toBe(0)
    // A second pass only refreshes rooms whose flag2 is clear: all three now have it set.
    m.setU32((pAct + 0x54) >>> 0, 1)
    c.log.length = 0
    GAME_UpdateActRooms113c(m, pGame, c.callees)
    expect(c.log).toEqual([])
  })

  it('clears the dirty flag of an act without active rooms and asserts on pGame == NULL', () => {
    const { m, pGame, pAct } = buildWorld(0)
    m.setU32((pAct + 0x54) >>> 0, 1)
    GAME_UpdateActRooms113c(m, pGame, recordingCallees().callees)
    expect(m.u32((pAct + 0x54) >>> 0)).toBe(0)
    expect(() => GAME_UpdateActRooms113c(m, 0, recordingCallees().callees)).toThrow(/line 3086/)
  })
})

describe('D2Game ambient spawn helpers (Lane E)', () => {
  it('0x6FC67820 reaches 0x6FC67660 only for lo % 100 < 3 and nAmbientSpawned < 3', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x200)
    const pRoom = m.alloc(0x80)
    const pMonReg = m.alloc(0x300)
    const pLevelsTxt = m.alloc(0x40)
    m.setU8((pLevelsTxt + 3) >>> 0, 1) // act 2: (first, count) = (0, 0) -> 0x6FC67660 returns at once
    m.setU32((pGame + 0xf0 + 2 * 4) >>> 0, pMonReg)
    const c = recordingCallees()
    const [hitLo] = findSeed((lo) => lo % 100 < 3)
    m.setU32((pRoom + 0x6c) >>> 0, hitLo)
    REGPOP_RollAmbientSpawn113c(m, pRoom, pGame, 2, pLevelsTxt, c.callees)
    // act 2 has no ambient classes: only the 0x6FC67820 seed step happened
    expect(m.u32((pRoom + 0x6c) >>> 0)).toBe(step(hitLo, 0)[0])
    expect(m.u32((pMonReg + 0x2c4) >>> 0)).toBe(0)
    const [missLo] = findSeed((lo) => lo % 100 >= 3)
    m.setU32((pRoom + 0x6c) >>> 0, missLo)
    m.setU32((pRoom + 0x70) >>> 0, 0)
    REGPOP_RollAmbientSpawn113c(m, pRoom, pGame, 2, pLevelsTxt, c.callees)
    expect(m.u32((pRoom + 0x6c) >>> 0)).toBe(step(missLo, 0)[0])
    expect(c.log).toEqual([])
  })

  it('0x6FC67660 picks class 270 in act 1 from the room seed and counts the spawn', () => {
    const m = new SparseMemory113c()
    const pGame = m.alloc(0x200)
    const pRoom = m.alloc(0x80)
    const pMonReg = m.alloc(0x300)
    const pLevelsTxt = m.alloc(0x40)
    m.setU32((pRoom + 0x6c) >>> 0, 0x1234)
    m.setU32((pRoom + 0x70) >>> 0, 0)
    const c = recordingCallees()
    const created: Array<{ cls: number; mode: number; x: number; y: number }> = []
    c.callees.regpop.onMonsterCreate = (mem, args): number => {
      if ((args.wFlags & 1) !== 0) return 1 // spawn-point probe of 0x6FC67450
      created.push({ cls: args.nClassId, mode: args.nMode, x: args.x, y: args.y })
      return 0xabc0
    }
    m.setU32((pRoom + 0x4c) >>> 0, 5600)
    m.setU32((pRoom + 0x50) >>> 0, 5800)
    m.setU32((pRoom + 0x54) >>> 0, 40)
    m.setU32((pRoom + 0x58) >>> 0, 40)
    REGPOP_SpawnAmbientPack113c(m, pLevelsTxt, pRoom, pGame, pMonReg, c.callees)
    expect(created.length).toBe(1)
    expect(created[0]!.cls).toBe(270)
    expect(created[0]!.mode).toBe(1)
    expect(c.log).toEqual(['ambient-init:abc0'])
    expect(m.u32((pMonReg + 0x2c4) >>> 0)).toBe(1)
    // roll(count = 1) still steps the room seed once (0x6FC21180, n = 1 is a power of two)
    m.setU8((pLevelsTxt + 3) >>> 0, 5) // act >= 5 -> no-op
    REGPOP_SpawnAmbientPack113c(m, pLevelsTxt, pRoom, pGame, pMonReg, c.callees)
    expect(created.length).toBe(1)
  })

  it('0x6FC67950 only reaches the ambient roll on (lo & 0x7FFF) == 0 with no clients', () => {
    const { m, pGame, rooms } = buildWorld(1)
    const pRoom = rooms[0]!
    const c = recordingCallees()
    const [lo0] = findSeed((lo) => (lo & 0x7fff) !== 0)
    m.setU32((pRoom + 0x6c) >>> 0, lo0)
    ROOM_TickSeedAndAmbientSpawn113c(m, pRoom, pGame, c.callees)
    expect(m.u32((pRoom + 0x6c) >>> 0)).toBe(step(lo0, 0)[0])
    expect(c.log).toEqual([])
    const [lo1] = findSeed((lo) => (lo & 0x7fff) === 0)
    m.setU32((pRoom + 0x6c) >>> 0, lo1)
    m.setU32((pRoom + 0x70) >>> 0, 0)
    ROOM_TickSeedAndAmbientSpawn113c(m, pRoom, pGame, c.callees) // nNumClients == 1 -> stop
    expect(c.log).toEqual([])
  })
})
