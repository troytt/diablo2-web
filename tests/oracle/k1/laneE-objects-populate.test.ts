/**
 * Lane E: `D2Game:0x6FC4F0D0` / `0x6FC4EEA0` random room objects (`src/d2kern-113c/game/objects-populate-113c.ts`),
 * checked against the control flow of the `D2Game.dll` disassembly on hand-built tables.
 */
import { describe, expect, it } from 'vitest'
import {
  OBJECTS_CanPopulateRoom113c,
  OBJECTS_PopulateRoom113c,
  OBJECTS_SpawnRandomObjectInRoom113c,
  type ObjectsPopulateCallees113c,
} from '../../../src/d2kern-113c/game/objects-populate-113c.ts'
import { D2GAME_IAT_SGPT_DATATABLES_VA_113C } from '../../../src/d2kern-113c/game/regpop-spawn-113c.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'
import {
  DATATABLES_LEVELS_COUNT_OFF_113C,
  DATATABLES_LEVELS_TXT_OFF_113C,
  SGPT_DATATABLES_VA_113C,
} from '../../../src/d2kern-113c/tables/lvl-tbls-113c.ts'
import { D2LevelsTxt_SIZE } from '../../../src/d2kern-113c/mem/layout.generated.ts'

function step(lo: number, hi: number): [number, number] {
  const p = BigInt(lo >>> 0) * 0x6ac690c5n + BigInt(hi >>> 0)
  return [Number(p & 0xffffffffn) >>> 0, Number(p >> 32n) >>> 0]
}

interface World {
  m: SparseMemory113c
  pGame: number
  pRoom: number
  pRoomEx: number
  pLevelsTxt: number
  pInfo: number
}

/** Level 2 room with `LevelsTxt`, `pObjectControl->pLevelObjInfo[2]` and empty Objects/ObjGroup tables. */
function buildWorld(): World {
  const m = new SparseMemory113c()
  const pDataTables = m.alloc(0x1000)
  m.setU32(SGPT_DATATABLES_VA_113C, pDataTables)
  const pIat = m.alloc(4)
  m.setU32(pIat, pDataTables)
  m.setU32(D2GAME_IAT_SGPT_DATATABLES_VA_113C, pIat)
  const pLevelsArr = m.alloc(D2LevelsTxt_SIZE * 4)
  m.setU32((pDataTables + DATATABLES_LEVELS_TXT_OFF_113C) >>> 0, pLevelsArr)
  m.setU32((pDataTables + DATATABLES_LEVELS_COUNT_OFF_113C) >>> 0, 4)
  const pLevelsTxt = (pLevelsArr + 2 * D2LevelsTxt_SIZE) >>> 0
  const pGame = m.alloc(0x2000)
  const pObjCtrl = m.alloc(0x200)
  const pInfo = m.alloc(0x20)
  m.setU32((pGame + 0x10f0) >>> 0, pObjCtrl)
  m.setU32((pObjCtrl + 0x48 + 2 * 4) >>> 0, pInfo)
  m.setU32((pInfo + 8) >>> 0, 48)
  const pRoom = m.alloc(0x80)
  const pRoomEx = m.alloc(0x100)
  const pLevel = m.alloc(0x240)
  m.setU32((pLevel + 0x1d0) >>> 0, 2)
  m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
  m.setU32((pRoom + 0x6c) >>> 0, 0x5555)
  m.setU32((pRoom + 0x70) >>> 0, 0)
  return { m, pGame, pRoom, pRoomEx, pLevelsTxt, pInfo }
}

function callees(log: string[]): ObjectsPopulateCallees113c {
  return {
    getLevelRoomCountInAct: (_m, _a, lvl) => {
      log.push(`count:${lvl}`)
      return 40
    },
    checkLevelObjectHook: () => {
      log.push('hook')
      return 0
    },
    spawnObjectsByFn: (_m, fn, _g, _r, dens, obj, prob) => {
      log.push(`spawn:${fn.toString(16)}:${dens}:${obj}:${prob}`)
      return 0
    },
    spawn: {
      initObject: (_m, u, _g, id, _r, x, y) => void log.push(`init:${id}@${x},${y}`),
      placeServerUnit: (_m, y, _u, _r, x) => void log.push(`place:${x},${y}`),
    },
  }
}

describe('D2Game 0x6FC4EEA0 object population gate (Lane E)', () => {
  it('counts visited rooms, caches the room count once and passes a plain wilderness room', () => {
    const w = buildWorld()
    const log: string[] = []
    m8(w)
    w.m.setU32((w.pInfo + 8) >>> 0, 0x7fffffff)
    expect(OBJECTS_CanPopulateRoom113c(w.m, w.pRoom, w.pGame, w.pLevelsTxt, callees(log))).toBe(1)
    expect(w.m.u32((w.pInfo + 8) >>> 0)).toBe(40)
    expect(w.m.u32((w.pInfo + 4) >>> 0)).toBe(1)
    expect(log).toEqual(['count:2'])
    // LevelsTxt+0x210 hook returning 1 vetoes the room (after the visit count).
    w.m.setU32((w.pLevelsTxt + 0x210) >>> 0, 7)
    const veto = callees(log)
    expect(OBJECTS_CanPopulateRoom113c(w.m, w.pRoom, w.pGame, w.pLevelsTxt, { ...veto, checkLevelObjectHook: () => 1 })).toBe(0)
    expect(w.m.u32((w.pInfo + 4) >>> 0)).toBe(2)
  })
})

/** Clear RoomEx flags so the waypoint / preset / town checks all pass. */
function m8(w: World): void {
  w.m.setU32((w.pRoomEx + 0x28) >>> 0, 0)
}

describe('D2Game 0x6FC4F0D0 room objects (Lane E)', () => {
  it('steps the room seed once per empty object-group slot and spawns nothing', () => {
    const w = buildWorld()
    m8(w)
    const log: string[] = []
    OBJECTS_PopulateRoom113c(w.m, w.pGame, w.pRoom, callees(log))
    let s: [number, number] = [0x5555, 0]
    for (let i = 0; i < 8; i++) s = step(s[0], s[1])
    expect(w.m.u32((w.pRoom + 0x6c) >>> 0)).toBe(s[0])
    expect(w.m.u32((w.pRoom + 0x70) >>> 0)).toBe(s[1])
    expect(log).toEqual([])
  })

  it('picks the weighted ObjGroup entry and dispatches spawner 0x6FD2E190[ObjectsTxt+0x1B2]', () => {
    const w = buildWorld()
    m8(w)
    const { m } = w
    // Objects.txt (0x6FDF0B94 base, 0x6FDF0B98 count, 0x1C0 per record) and ObjGroup.txt (0x6FDF0B9C / 0x6FDF0BA0, 0x34).
    const pObjects = m.alloc(0x1c0 * 8)
    m.setU32(0x6fdf0b94, pObjects)
    m.setU32(0x6fdf0b98, 8)
    const pGroups = m.alloc(0x34 * 4)
    m.setU32(0x6fdf0b9c, pGroups)
    m.setU32(0x6fdf0ba0, 4)
    const g1 = (pGroups + 0x34) >>> 0
    m.setU32(g1, 5) // entry 0: object 5, weight 0 -> never picked
    m.setU8((g1 + 0x28) >>> 0, 0)
    m.setU32((g1 + 4) >>> 0, 6) // entry 1: object 6, weight 100, density 4
    m.setU8((g1 + 0x29) >>> 0, 100)
    m.setU8((g1 + 0x21) >>> 0, 4)
    m.setU8((pObjects + 6 * 0x1c0 + 0x1b2) >>> 0, 1)
    m.setU8((w.pLevelsTxt + 0xe5) >>> 0, 1) // slot 0 -> group 1
    m.setU8((w.pLevelsTxt + 0xed) >>> 0, 100) // probability 100: always taken
    const log: string[] = []
    OBJECTS_PopulateRoom113c(m, w.pGame, w.pRoom, callees(log))
    expect(log).toEqual(['spawn:6fc51000:4:6:100'])
    // 8 slot rolls + 1 pick roll on pRoom->tSeed
    let st: [number, number] = [0x5555, 0]
    for (let i = 0; i < 9; i++) st = step(st[0], st[1])
    expect(m.u32((w.pRoom + 0x6c) >>> 0)).toBe(st[0])
    // ObjectsTxt+0x172 > 2 rejects the entry
    m.setU8((pObjects + 6 * 0x1c0 + 0x172) >>> 0, 3)
    log.length = 0
    OBJECTS_PopulateRoom113c(m, w.pGame, w.pRoom, callees(log))
    expect(log).toEqual([])
  })

})

describe('D2Game 0x6FC51E20 random object spawn (Lane E)', () => {
  function roomWithGrid(w: World, blocked: number): void {
    const { m, pRoom } = w
    m.setU32((pRoom + 0x4c) >>> 0, 5600)
    m.setU32((pRoom + 0x50) >>> 0, 5800)
    m.setU32((pRoom + 0x54) >>> 0, 40)
    m.setU32((pRoom + 0x58) >>> 0, 40)
    const g = m.alloc(0x24)
    m.setU32(g, 5600)
    m.setU32((g + 4) >>> 0, 5800)
    m.setU32((g + 8) >>> 0, 40)
    m.setU32((g + 0x0c) >>> 0, 40)
    const pMap = m.alloc(40 * 40 * 2)
    for (let i = 0; i < 40 * 40; i++) m.setU16((pMap + i * 2) >>> 0, blocked)
    m.setU32((g + 0x20) >>> 0, pMap)
    m.setU32((pRoom + 0x20) >>> 0, g)
    const near = m.alloc(4)
    m.setU32(near, pRoom)
    m.setU32(pRoom, near)
    m.setU32((pRoom + 0x24) >>> 0, 1)
  }

  it('returns NULL for rooms under 2 subtiles without touching the object-control seed', () => {
    const w = buildWorld()
    const pCtrl = w.m.u32((w.pGame + 0x10f0) >>> 0)
    w.m.setU32(pCtrl, 77)
    w.m.setU32((w.pRoom + 0x54) >>> 0, 1)
    w.m.setU32((w.pRoom + 0x58) >>> 0, 40)
    const log: string[] = []
    expect(OBJECTS_SpawnRandomObjectInRoom113c(w.m, w.pGame, 3, 2, 2, w.pRoom, callees(log).spawn)).toBe(0)
    expect(w.m.u32(pCtrl)).toBe(77)
  })

  it('builds the object unit on a free floor, steps the game seed once and assigns the next object id', () => {
    const w = buildWorld()
    roomWithGrid(w, 0)
    const { m } = w
    const pObjects = m.alloc(0x1c0 * 8)
    m.setU32(0x6fdf0b94, pObjects)
    m.setU32(0x6fdf0b98, 8)
    m.setU32((w.pGame + 0xd0) >>> 0, 1000)
    m.setU32((w.pGame + 0xd4) >>> 0, 0)
    m.setU32((w.pGame + 0x98) >>> 0, 9)
    const pCtrl = m.u32((w.pGame + 0x10f0) >>> 0)
    m.setU32(pCtrl, 0x2468)
    const log: string[] = []
    const pUnit = OBJECTS_SpawnRandomObjectInRoom113c(m, w.pGame, 3, 2, 2, w.pRoom, callees(log).spawn)
    expect(pUnit).not.toBe(0)
    // first attempt: x = 5600 + roll(37), y = 5800 + roll(37) on pObjectControl->tSeed
    let s: [number, number] = step(0x2468, 0)
    const x = 5600 + (s[0] % 37)
    s = step(s[0], s[1])
    const y = 5800 + (s[0] % 37)
    expect(log).toEqual([`init:10@${x},${y}`, `place:${x},${y}`])
    expect(m.u32((w.pGame + 0x98) >>> 0)).toBe(10)
    expect(m.u32((w.pGame + 0xd0) >>> 0)).toBe(step(1000, 0)[0])
    expect(m.u32(pUnit)).toBe(2)
    expect(m.u32((pUnit + 4) >>> 0)).toBe(3)
    expect(m.u32((pUnit + 0x28) >>> 0)).toBe(step(1000, 0)[0])
    expect(m.u32((pUnit + 0xc8) >>> 0)).toBe(0x4000000)
    expect(m.u32((pUnit + 0xd0) >>> 0)).toBe(0xb)
    expect(m.u32(m.u32((pUnit + 0x14) >>> 0))).toBe((pObjects + 3 * 0x1c0) >>> 0)
  })

  it('gives up after 5 blocked probes', () => {
    const w = buildWorld()
    roomWithGrid(w, 0x3f11)
    const pCtrl = w.m.u32((w.pGame + 0x10f0) >>> 0)
    w.m.setU32(pCtrl, 0x2468)
    const log: string[] = []
    expect(OBJECTS_SpawnRandomObjectInRoom113c(w.m, w.pGame, 3, 2, 2, w.pRoom, callees(log).spawn)).toBe(0)
    let s: [number, number] = [0x2468, 0]
    for (let i = 0; i < 10; i++) s = step(s[0], s[1])
    expect(w.m.u32(pCtrl)).toBe(s[0])
    expect(log).toEqual([])
  })
})
