/**
 * Lane E: `D2Game:0x6FD01430` room preset-unit spawning (`src/d2kern-113c/game/room-presets-113c.ts`),
 * checked against the control flow of the `D2Game.dll` disassembly on hand-built rooms.
 */
import { describe, expect, it } from 'vitest'
import {
  OBJECTS_InitPresetQuestObject113c,
  ROOM_SpawnPresetUnits113c,
  SUNIT_CreatePresetUnit113c,
  type RoomPresetCallees113c,
} from '../../../src/d2kern-113c/game/room-presets-113c.ts'
import { SparseMemory113c } from '../../../src/d2kern-113c/mem/sparse-memory.ts'

interface Rec {
  readonly log: string[]
  readonly callees: RoomPresetCallees113c
  readonly units: Map<number, number>
}

function recorder(m: SparseMemory113c, placeOk = 1): Rec {
  const log: string[] = []
  const units = new Map<number, number>()
  const mk = (type: number, cls: number): number => {
    const p = m.alloc(0xf4)
    m.setU32(p, type)
    m.setU32((p + 4) >>> 0, cls)
    units.set(p, type)
    return p
  }
  return {
    log,
    units,
    callees: {
      spawnMonsterPreset: (mem, _r, cls, _g, x, y, mode) => {
        log.push(`mon:${cls}@${x},${y}:${mode}`)
        const p = mk(1, cls)
        const pMonData = mem.alloc(0x60)
        const pAi = mem.alloc(0x40)
        mem.setU32((p + 0x14) >>> 0, pMonData)
        mem.setU32((pMonData + 0x28) >>> 0, pAi)
        return p
      },
      spawnSpecialObject: (_m, cls, _g, _r, x, y) => {
        log.push(`special:${cls}@${x},${y}`)
        return mk(2, cls)
      },
      allocUnitData: (_m, type, cls, x, y, _g, _r, a5, mode, a7) => {
        log.push(`alloc:${type}/${cls}@${x},${y}:${a5},${mode},${a7}`)
        return mk(type, cls)
      },
      placePresetItem: (mem, ppItem, _g, pArgs, a2) => {
        log.push(`place:${mem.u32((pArgs + 0x30) >>> 0)},${mem.u32((pArgs + 0x0c) >>> 0)},${a2}`)
        expect(units.has(mem.u32(ppItem))).toBe(true)
        return placeOk
      },
      freeUnit: (_m, _g, u) => void log.push(`free:${units.get(u)}`),
      initQuestObject1CB: () => void log.push('q1cb'),
      initQuestObject1CD: () => void log.push('q1cd'),
      initQuestObject21F: () => void log.push('q21f'),
    },
  }
}

function buildRoom(nLevelId: number): { m: SparseMemory113c; pGame: number; pRoom: number; pRoomEx: number } {
  const m = new SparseMemory113c()
  const pGame = m.alloc(0x2000)
  const pRoom = m.alloc(0x80)
  const pRoomEx = m.alloc(0x100)
  const pLevel = m.alloc(0x240)
  m.setU32((pLevel + 0x1d0) >>> 0, nLevelId)
  m.setU32((pRoomEx + 0x58) >>> 0, pLevel)
  m.setU32((pRoom + 0x10) >>> 0, pRoomEx)
  m.setU32((pRoom + 0x4c) >>> 0, 5600)
  m.setU32((pRoom + 0x50) >>> 0, 5800)
  return { m, pGame, pRoom, pRoomEx }
}

/** Appends presets `(type, class, x, y, flags)` to `pRoomEx+0x5C` in list order. */
function addPresets(m: SparseMemory113c, pRoomEx: number, list: ReadonlyArray<readonly [number, number, number, number, number]>): number[] {
  const out: number[] = []
  let prev = 0
  for (const [type, cls, x, y, flags] of list) {
    const p = m.alloc(0x20)
    m.setU32(p, 3) // mode
    m.setU32((p + 0x04) >>> 0, cls)
    m.setU32((p + 0x08) >>> 0, x)
    m.setU32((p + 0x14) >>> 0, type)
    m.setU32((p + 0x18) >>> 0, y)
    m.setU32((p + 0x1c) >>> 0, flags)
    if (prev === 0) m.setU32((pRoomEx + 0x5c) >>> 0, p)
    else m.setU32((prev + 0x0c) >>> 0, p)
    prev = p
    out.push(p)
  }
  return out
}

describe('D2Game 0x6FD01430 room preset units (Lane E)', () => {
  it('spawns non-monster presets first, then monsters, skipping spawned ones, at room-origin offsets', () => {
    const { m, pGame, pRoom, pRoomEx } = buildRoom(2)
    const p = addPresets(m, pRoomEx, [
      [1, 19, 3, 4, 0],
      [2, 30, 5, 6, 0],
      [1, 5, 7, 8, 1],
      [2, 600, 9, 10, 0],
      [5, 77, 11, 12, 0],
    ])
    const saveChain = m.alloc(4)
    m.setU32((p[0]! + 0x10) >>> 0, saveChain)
    const r = recorder(m)
    ROOM_SpawnPresetUnits113c(m, pGame, pRoom, r.callees)
    expect(r.log).toEqual([
      'alloc:2/30@5605,5806:1,3,0',
      'special:600@5609,5810',
      'alloc:5/77@5611,5812:1,3,0',
      'mon:19@5603,5804:3',
    ])
    // the monster took the save chain into pMonsterData->pAi + 0x38
    expect(m.u32((p[0]! + 0x10) >>> 0)).toBe(0)
    // the DT1-mask/preset acquire flag of D2Common.#10476 is set on the RoomEx
    expect(m.u32((pRoomEx + 0x28) >>> 0) & 0x4000000).toBe(0x4000000)
    for (const u of r.units.keys()) expect(m.u32((u + 0xc4) >>> 0) & 0x3000000).toBe(0x3000000)
  })

  it('applies the level 0x85/0x86/0x88 object filters and skips pass 2 on level 0x88', () => {
    const r85 = buildRoom(0x85)
    addPresets(r85.m, r85.pRoomEx, [
      [2, 0x18d, 0, 0, 0],
      [2, 0x18e, 0, 0, 0],
    ])
    const rec85 = recorder(r85.m)
    ROOM_SpawnPresetUnits113c(r85.m, r85.pGame, r85.pRoom, rec85.callees)
    expect(rec85.log).toEqual(['alloc:2/398@5600,5800:1,3,0'])

    const r88 = buildRoom(0x88)
    addPresets(r88.m, r88.pRoomEx, [
      [2, 0x10c, 0, 0, 0],
      [2, 0x1a, 0, 0, 0],
      [5, 0x1a, 0, 0, 0],
      [1, 19, 0, 0, 0],
    ])
    const rec88 = recorder(r88.m)
    ROOM_SpawnPresetUnits113c(r88.m, r88.pGame, r88.pRoom, rec88.callees)
    expect(rec88.log).toEqual(['alloc:5/26@5600,5800:1,3,0'])

    const r86 = buildRoom(0x86)
    r86.m.setU32((r86.pGame + 0x7c) >>> 0, 7) // 7 % 3 + 3 = 4 -> 4th object is skipped
    addPresets(r86.m, r86.pRoomEx, [
      [2, 0x192, 0, 0, 0],
      [2, 1, 0, 0, 0],
      [2, 2, 0, 0, 0],
      [5, 9, 0, 0, 0],
      [2, 3, 0, 0, 0],
      [2, 4, 0, 0, 0],
    ])
    const rec86 = recorder(r86.m)
    ROOM_SpawnPresetUnits113c(r86.m, r86.pGame, r86.pRoom, rec86.callees)
    expect(rec86.log).toEqual([
      'alloc:2/1@5600,5800:1,3,0',
      'alloc:2/2@5600,5800:1,3,0',
      'alloc:5/9@5600,5800:1,3,0',
      'alloc:2/3@5600,5800:1,3,0',
    ])
    expect(r86.m.u32((r86.pGame + 0x1de4) >>> 0)).toBe(4)
  })

  it('0x6FD012D0: object 0x23D -> NULL, items go through 0x6FC31070 and are freed on failure', () => {
    const { m, pGame, pRoom } = buildRoom(2)
    const r = recorder(m, 0)
    expect(SUNIT_CreatePresetUnit113c(m, 0, 0x23d, 2, pGame, pRoom, 1, 2, r.callees)).toBe(0)
    expect(SUNIT_CreatePresetUnit113c(m, 0, 10, 4, pGame, pRoom, 1, 2, r.callees)).toBe(0)
    expect(r.log).toEqual(['alloc:4/10@1,2:1,0,0', 'place:2,2,1', 'free:4'])
    const ok = recorder(m, 1)
    const pItem = SUNIT_CreatePresetUnit113c(m, 0, 10, 4, pGame, pRoom, 1, 2, ok.callees)
    expect(pItem).not.toBe(0)
    expect(m.u32((pItem + 0xc4) >>> 0)).toBe(0x3000000)
  })

  it('0x6FC55E50 dispatches quest objects 0x1CB / 0x1CD / 0x21F only', () => {
    const m = new SparseMemory113c()
    const r = recorder(m)
    for (const [type, cls] of [
      [2, 0x1cb],
      [2, 0x1cd],
      [2, 0x21f],
      [2, 0x1cc],
      [1, 0x1cb],
    ] as const) {
      const u = m.alloc(0x10)
      m.setU32(u, type)
      m.setU32((u + 4) >>> 0, cls)
      OBJECTS_InitPresetQuestObject113c(m, 0, u, 0, r.callees)
    }
    OBJECTS_InitPresetQuestObject113c(m, 0, 0, 0, r.callees)
    expect(r.log).toEqual(['q1cb', 'q1cd', 'q21f'])
  })
})
