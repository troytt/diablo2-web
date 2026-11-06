import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  CANONICAL_CORE_STATS_113C,
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2EventStrc,
  D2GameStrc,
  D2NetPacketSink113c,
  D2StatListExStrc,
  D2TimerStrc,
  D2UnitStrc,
  EVENT_DeleteEventByArg14_113c,
  EVENT_DeleteEventByType113c,
  EVENT_FreeNode113c,
  EVENT_GetNextEventFrame113c,
  EVENT_RemoveUnitEvents113c,
  EVENT_SetEventFull113c,
  EVENT_SetPersistentEventFull113c,
  EVENT_UpdateTimers113c,
  GAME_Create113c,
  GAME_SeedNext113c,
  GAME_SeedRoll113c,
  Heap113c,
  imul32,
  MONSTER_ClearModeEvents113c,
  mulDiv113c,
  sar32,
  sdiv32,
  shl32,
  shr32,
  smod32,
  SparseMemory113c,
  STATES_CheckGfxStateFlag113c,
  STATES_CheckState113c,
  STATES_CheckStateMaskOnUnit113c,
  STATES_ClearGfxStateFlag113c,
  STATES_COUNT_113C,
  STATES_ToggleGfxStateFlag113c,
  STATES_ToggleState113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetStatListFromUnitAndState113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_InsertSubList113c,
  STATLIST_MergeStatLists113c,
  STATLIST_RemoveSubList113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
  StatTableRegistry113c,
  SUNIT_GetNewUnitId113c,
  SUNIT_GetServerUnit113c,
  SUNIT_HASH_OFFSET_BY_TYPE_113C,
  SUNIT_InsertServerUnit113c,
  SUNIT_RemoveServerUnit113c,
  udiv32,
  umod32,
  UNIT_ITEM,
  UNIT_MISSILE,
  UNIT_MONSTER,
  UNIT_OBJECT,
  UNIT_PLAYER,
  UNIT_TILE,
  UNITFLAG_ISUPDATE,
  UNITROOM_AddUnitToRoom113c,
  UNITROOM_ClearUpdateQueue113c,
  UNITROOM_RefreshUnit113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_Create113c,
  UNITS_GetRoom113c,
  UNITS_GetX113c,
  UNITS_GetY113c,
  UNITS_InitPath113c,
} from '../../src/d2kern-113c/index.ts'
import {
  KERN_10K_FIXTURE_PATH,
  KERN_10K_QSTATS,
  STATE_MASKS_113C,
  type EventTimerSeqDiffRecord113c,
  type Kern10kDiffRecord113c,
  type MulDivDiffRecord113c,
  type StatSnapDiffRecord113c,
  type StateSeqDiffRecord113c,
  type SunitRoomDiffRecord113c,
} from '../../tools/oracle/collect-kern-10k-diff.ts'
import { replayFile } from '../../tools/oracle/route2-replay.mts'

describe('d2kern-113c §3.2: x86 integer arithmetic primitives', () => {
  it('truncates signed division toward zero (matching x86 idiv, unlike Math.floor)', () => {
    expect(sdiv32(-7, 2)).toBe(-3)
    expect(smod32(-7, 2)).toBe(-1)
    expect(sdiv32(7, -2)).toBe(-3)
    expect(smod32(7, -2)).toBe(1)
    expect(() => sdiv32(1, 0)).toThrow(RangeError)
    expect(udiv32(0xffffffff, 2)).toBe(0x7fffffff)
    expect(umod32(0xffffffff, 2)).toBe(1)
    expect(imul32(0x10000, 0x10000)).toBe(0)
    expect(sar32(-256, 3)).toBe(-32)
    expect(shl32(3, 8)).toBe(768)
    expect(shr32(-1, 24)).toBe(255)
  })

  it('reproduces D2Common 0x6FD511E0 shortcut remainder truncation', () => {
    // edx = 1_100_037 > 0x100000 and ecx = 100 <= (edx >> 4): divides edx/ecx BEFORE multiplying by eax!
    expect(mulDiv113c(9, 1_100_037, 100)).toBe(99_000)
    expect(mulDiv113c(10, 500, 0)).toBe(0)
  })
})

describe('d2kern-113c §3.2: D2StatListStrc, D2StatListExStrc, EvalStatWithOps (op 1..13) & STATES', () => {
  it('maintains sorted BaseStats, zero-removal vs bKeepZero, and fMin floor clamping', () => {
    const heap = new Heap113c()
    const player = UNITS_Create113c(heap, UNIT_PLAYER, 4, 1) // Barbarian
    const listEx = STATLIST_CreateEx113c(heap, player, 0)

    STATLIST_SetUnitStat113c(heap, player, 31, 150, 0) // armorclass
    STATLIST_SetUnitStat113c(heap, player, 0, 85, 0) // strength
    STATLIST_SetUnitStat113c(heap, player, 12, 24, 0) // level
    expect(STATLIST_GetUnitStat113c(heap, player, 0)).toBe(85)
    expect(STATLIST_GetUnitStat113c(heap, player, 12)).toBe(24)
    expect(STATLIST_GetUnitStat113c(heap, player, 31)).toBe(150)

    STATLIST_SetUnitStat113c(heap, player, 0, 0, 0)
    expect(heap.get(listEx, D2StatListExStrc.wStatCount)).toBe(2)
    expect(heap.get(listEx, D2StatListExStrc.wFullStatCount)).toBe(2)

    STATLIST_SetUnitStat113c(heap, player, 8, 5120, 0)
    STATLIST_SetUnitStat113c(heap, player, 8, 0, 0)
    expect(heap.get(listEx, D2StatListExStrc.wStatCount)).toBe(2)
    expect(heap.get(listEx, D2StatListExStrc.wFullStatCount)).toBe(3)

    STATLIST_SetUnitStat113c(heap, player, 6, 5120, 0)
    STATLIST_SetUnitStat113c(heap, player, 6, 0, 0)
    expect(heap.get(listEx, D2StatListExStrc.wStatCount)).toBe(2)
    expect(heap.get(listEx, D2StatListExStrc.wFullStatCount)).toBe(3)

    expect(STATLIST_GetUnitStat113c(heap, player, 7)).toBe(0)
    STATLIST_SetUnitStat113c(heap, player, 7, -500, 0)
    expect(STATLIST_GetUnitStat113c(heap, player, 7)).toBe(256)
    expect(STATLIST_GetUnitBaseStat113c(heap, player, 7)).toBe(256)
    STATLIST_SetUnitStat113c(heap, player, 7, 0, 0)
    expect(STATLIST_GetUnitStat113c(heap, player, 7)).toBe(0)

    expect(STATLIST_GetUnitBaseStat113c(heap, player, 12)).toBe(24)
    STATLIST_SetUnitStat113c(heap, player, 12, 0, 0)
    expect(STATLIST_GetUnitStat113c(heap, player, 12)).toBe(0)
  })

  it('evaluates op 1, op 2, op 4, op 5, op 8, op 9, op 11, and op 13 across sub-lists', () => {
    const reg = new StatTableRegistry113c([
      ...CANONICAL_CORE_STATS_113C,
      { statId: 300, op: 3, opParam: 3, opBase: 12, opStats: [31] },
      { statId: 301, op: 11, opStats: [31] },
      { statId: 302, op: 6, opStats: [31], evalByTime: (_u, v) => v * 3 },
      { statId: 303, op: 7, opStats: [31], evalByTime: (_u, v) => v * 2 },
    ])

    const heap = new Heap113c()
    const barb = UNITS_Create113c(heap, UNIT_PLAYER, 4, 1)
    const pListEx = STATLIST_CreateEx113c(heap, barb, 0)

    STATLIST_SetUnitStat113c(heap, barb, 12, 16, 0, reg)
    STATLIST_SetUnitStat113c(heap, barb, 3, 25, 0, reg)
    STATLIST_SetUnitStat113c(heap, barb, 1, 10, 0, reg)
    STATLIST_SetUnitStat113c(heap, barb, 7, 100 << 8, 0, reg)
    STATLIST_SetUnitStat113c(heap, barb, 9, 50 << 8, 0, reg)
    STATLIST_SetUnitStat113c(heap, barb, 11, 80 << 8, 0, reg)

    expect(STATLIST_GetUnitStat113c(heap, barb, 7, 0, reg)).toBe(25600)
    expect(STATLIST_GetUnitStat113c(heap, barb, 9, 0, reg)).toBe(12800)

    const subBuff = STATLIST_AllocList113c(heap, 0, UNIT_PLAYER, 1, 32, 500)
    STATLIST_SetStat113c(heap, subBuff, 3, 10, 0, reg)
    STATLIST_SetStat113c(heap, subBuff, 1, 5, 0, reg)
    STATLIST_SetStat113c(heap, subBuff, 76, 20, 0, reg)
    STATLIST_SetStat113c(heap, subBuff, 216, 2048, 0, reg)
    STATLIST_InsertSubList113c(heap, pListEx, subBuff, reg)

    expect(STATLIST_GetStatListFromUnitAndState113c(heap, barb, 32)).toBe(subBuff)
    expect(STATLIST_GetUnitStat113c(heap, barb, 7, 0, reg)).toBe(45056)
    expect(STATLIST_GetUnitStat113c(heap, barb, 9, 0, reg)).toBe(14080)
    expect(STATLIST_GetUnitStat113c(heap, barb, 11, 0, reg)).toBe(23040)

    STATLIST_RemoveSubList113c(heap, subBuff, reg)
    expect(STATLIST_GetStatListFromUnitAndState113c(heap, barb, 32)).toBe(0)
    expect(STATLIST_GetUnitStat113c(heap, barb, 7, 0, reg)).toBe(25600)
    expect(STATLIST_GetUnitStat113c(heap, barb, 9, 0, reg)).toBe(12800)

    const helm = UNITS_Create113c(heap, UNIT_ITEM, 100, 50)
    const helmEx = STATLIST_CreateEx113c(heap, helm, 0)
    STATLIST_SetUnitStat113c(heap, helm, 31, 120, 0, reg)
    STATLIST_SetUnitStat113c(heap, helm, 16, 50, 0, reg)
    expect(STATLIST_GetUnitStat113c(heap, helm, 31, 0, reg)).toBe(180)

    const armor = UNITS_Create113c(heap, UNIT_ITEM, 101, 51)
    const armorEx = STATLIST_CreateEx113c(heap, armor, 0)
    STATLIST_SetUnitStat113c(heap, armor, 214, 12, 0, reg)
    STATLIST_SetUnitStat113c(heap, armor, 21, 9, 0, reg)

    STATLIST_InsertSubList113c(heap, pListEx, helmEx, reg, 0)
    STATLIST_InsertSubList113c(heap, pListEx, armorEx, reg, 0)
    expect(STATLIST_GetUnitStat113c(heap, barb, 31, 0, reg)).toBe(204)
    expect(STATLIST_GetUnitStat113c(heap, barb, 21, 0, reg)).toBe(0)
    STATLIST_InsertSubList113c(heap, pListEx, armorEx, reg, 1)
    expect(STATLIST_GetUnitStat113c(heap, barb, 21, 0, reg)).toBe(9)
    STATLIST_InsertSubList113c(heap, pListEx, armorEx, reg, 0)
    expect(STATLIST_GetUnitStat113c(heap, barb, 21, 0, reg)).toBe(0)

    STATLIST_SetUnitStat113c(heap, barb, 300, 5, 0, reg)
    STATLIST_SetUnitStat113c(heap, barb, 301, 50, 0, reg)
    STATLIST_SetUnitStat113c(heap, barb, 302, 4, 0, reg)
    STATLIST_SetUnitStat113c(heap, barb, 303, 5, 0, reg)
    expect(STATLIST_GetUnitStat113c(heap, barb, 31, 0, reg)).toBe(338 + 33)
  })

  it('tracks 185 active/gfx state bits (0..184 uberminion), unit+0xC8 0x08 disguise mask (0x6FD83C20), null-StatListEx no-op, and #10494 type filter', () => {
    const m = new SparseMemory113c()
    const player = UNITS_Create113c(m, UNIT_PLAYER, 1, 1)
    const item = UNITS_Create113c(m, UNIT_ITEM, 10, 2)
    const uninitMon = UNITS_Create113c(m, UNIT_MONSTER, 5, 3)
    STATLIST_CreateEx113c(m, player, 0)
    const itemEx = STATLIST_CreateEx113c(m, item, 0)

    // `pStatListEx == NULL` is a strict no-op (never allocates, never touches `dwFlags2`)
    m.set(uninitMon, D2UnitStrc.dwFlags2, 0x20)
    STATES_ToggleState113c(m, uninitMon, 63, true)
    expect(m.get(uninitMon, D2UnitStrc.pStatListEx)).toBe(0)
    expect(m.get(uninitMon, D2UnitStrc.dwFlags2)).toBe(0x20)

    // Disguise states `{63, 93, 119, 139, 140, 176, 177}` set `unit+0xC8 |= 0x08` and keep it set until ALL clear (`0x6FD83C20`)
    STATES_ToggleState113c(m, player, 63, true)
    expect(m.get(player, D2UnitStrc.dwFlags2) & 0x08).toBe(0x08)
    STATES_ToggleState113c(m, player, 177, true)
    STATES_ToggleState113c(m, player, 63, false)
    expect(m.get(player, D2UnitStrc.dwFlags2) & 0x08).toBe(0x08) // 177 still active!
    STATES_ToggleState113c(m, player, 177, false)
    expect(m.get(player, D2UnitStrc.dwFlags2) & 0x08).toBe(0) // last disguise state cleared!

    for (const sid of [0, 31, 32, 0x36, 159, 183, 184]) {
      expect(STATES_CheckState113c(m, player, sid)).toBe(0)
      STATES_ToggleState113c(m, player, sid, true)
      const mask = (1 << (sid & 31)) >>> 0
      expect(STATES_CheckState113c(m, player, sid)).toBe(mask)
      expect(STATES_CheckGfxStateFlag113c(m, player, sid)).toBe(mask)

      STATES_ClearGfxStateFlag113c(m, player, sid)
      expect(STATES_CheckGfxStateFlag113c(m, player, sid)).toBe(0)
      STATES_ToggleState113c(m, player, sid, true)
      expect(STATES_CheckGfxStateFlag113c(m, player, sid)).toBe(0)

      STATES_ToggleState113c(m, player, sid, false)
      expect(STATES_CheckState113c(m, player, sid)).toBe(0)
      expect(STATES_CheckGfxStateFlag113c(m, player, sid)).toBe(mask)
    }

    // `STATES_ToggleState` (`0x6FD88730`) writes `dwStateFlags` on ANY unit with `pStatListEx != NULL`,
    // while `STATES_CheckState` (`#10494` `0x6FD83CD0`) filters to unit types `{0, 1, 3}`!
    expect(STATES_CheckState113c(m, player, -1)).toBe(0)
    expect(STATES_CheckState113c(m, player, 185)).toBe(0)
    STATES_ToggleState113c(m, item, 10, true)
    const itemFlagsPtr = m.get(itemEx, D2StatListExStrc.pStateFlags)
    expect((m.u32(itemFlagsPtr) >>> 10) & 1).toBe(1)
    expect(STATES_CheckState113c(m, item, 10)).toBe(0)
  })
})

describe('d2kern-113c §3.2: D2UnitStrc, UNITS_GetX/Y, UNITROOM & SUNIT hash tables', () => {
  it('resolves dynamic vs static unit coordinates and manages room unit/update chains', () => {
    const heap = new Heap113c()
    const actFlagPtr = heap.alloc(4)
    const pRoom = heap.alloc(D2ActiveRoomStrc_SIZE)
    heap.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, actFlagPtr)

    const pPlayer = UNITS_Create113c(heap, UNIT_PLAYER, 0, 1)
    UNITS_InitPath113c(heap, pPlayer, 5123, 4987, pRoom)
    const pChest = UNITS_Create113c(heap, UNIT_OBJECT, 5, 10)
    UNITS_InitPath113c(heap, pChest, 5130, 4990, pRoom)

    expect(UNITS_GetX113c(heap, pPlayer)).toBe(5123)
    expect(UNITS_GetY113c(heap, pPlayer)).toBe(4987)
    expect(UNITS_GetX113c(heap, pChest)).toBe(5130)
    expect(UNITS_GetY113c(heap, pChest)).toBe(4990)

    UNITROOM_AddUnitToRoom113c(heap, pPlayer, pRoom)
    UNITROOM_AddUnitToRoom113c(heap, pChest, pRoom)
    expect(heap.get(pRoom, D2ActiveRoomStrc.nPlayers)).toBe(1)
    expect(heap.u32(actFlagPtr)).toBe(1)
    expect(heap.get(pPlayer, D2UnitStrc.dwFlags) & UNITFLAG_ISUPDATE).toBe(UNITFLAG_ISUPDATE)
    expect(heap.get(pRoom, D2ActiveRoomStrc.pUnitFirst)).toBe(pChest)
    expect(heap.get(pChest, D2UnitStrc.pRoomUnitNext)).toBe(pPlayer)

    UNITROOM_RefreshUnit113c(heap, pChest)
    expect(heap.get(pRoom, D2ActiveRoomStrc.pUpdateList)).toBe(pChest)
    expect(heap.get(pChest, D2UnitStrc.pRoomUpdateNext)).toBe(pPlayer)

    UNITROOM_RemoveUnitFromRoom113c(heap, pPlayer)
    expect(heap.get(pRoom, D2ActiveRoomStrc.nPlayers)).toBe(0)
    expect(heap.get(pPlayer, D2UnitStrc.dwFlags) & UNITFLAG_ISUPDATE).toBe(0)
    expect(heap.get(pRoom, D2ActiveRoomStrc.pUnitFirst)).toBe(pChest)
  })

  it('allocates SUNIT IDs with 0xFFFFFFFE->1 wrap and maintains descending hash buckets across types 0..5', () => {
    const heap = new Heap113c()
    const pGame = GAME_Create113c(heap, { initSeed: 0x12345678 })

    expect(SUNIT_GetNewUnitId113c(heap, pGame, UNIT_MONSTER)).toBe(1)
    expect(SUNIT_GetNewUnitId113c(heap, pGame, UNIT_MONSTER)).toBe(2)
    heap.set(pGame, D2GameStrc.dwLastUnitId, 0xfffffffe, UNIT_MISSILE)
    expect(SUNIT_GetNewUnitId113c(heap, pGame, UNIT_MISSILE)).toBe(1)

    expect(SUNIT_HASH_OFFSET_BY_TYPE_113C[UNIT_MISSILE]).toBe(0x1920)
    expect(SUNIT_HASH_OFFSET_BY_TYPE_113C[UNIT_ITEM]).toBe(0x1720)
    expect(SUNIT_HASH_OFFSET_BY_TYPE_113C[UNIT_TILE]).toBe(0x1b20)

    const m5 = UNITS_Create113c(heap, UNIT_MONSTER, 0, 5, pGame)
    const m261 = UNITS_Create113c(heap, UNIT_MONSTER, 0, 261, pGame)
    const m133 = UNITS_Create113c(heap, UNIT_MONSTER, 0, 133, pGame)
    SUNIT_InsertServerUnit113c(heap, pGame, m5)
    SUNIT_InsertServerUnit113c(heap, pGame, m261)
    SUNIT_InsertServerUnit113c(heap, pGame, m133)

    const bucketHead = heap.u32(pGame + 0x1320 + 5 * 4)
    expect(bucketHead).toBe(m261)
    expect(heap.get(m261, D2UnitStrc.pGameHashNext)).toBe(m133)
    expect(heap.get(m133, D2UnitStrc.pGameHashNext)).toBe(m5)
    expect(SUNIT_GetServerUnit113c(heap, pGame, UNIT_MONSTER, 133)).toBe(m133)

    SUNIT_RemoveServerUnit113c(heap, pGame, m133)
    expect(SUNIT_GetServerUnit113c(heap, pGame, UNIT_MONSTER, 133)).toBe(0)
    expect(SUNIT_GetServerUnit113c(heap, pGame, UNIT_MONSTER, 5)).toBe(m5)

    const t1 = UNITS_Create113c(heap, UNIT_TILE, 0, 10, pGame)
    const t2 = UNITS_Create113c(heap, UNIT_TILE, 0, 99, pGame)
    SUNIT_InsertServerUnit113c(heap, pGame, t1)
    SUNIT_InsertServerUnit113c(heap, pGame, t2)
    expect(heap.get(pGame, D2GameStrc.pTileList)).toBe(t2)
    expect(SUNIT_GetServerUnit113c(heap, pGame, UNIT_TILE, 10)).toBe(t1)

    const s0 = GAME_SeedNext113c(heap, pGame)
    expect(typeof s0).toBe('number')
    expect(GAME_SeedRoll113c(heap, pGame, 100)).toBeLessThan(100)
  })
})

describe('d2kern-113c §3.2: D2TimerStrc chunk growth, 2-pass MONSTER_ClearModeEvents, 0x36 refresh & 10,000-cycle stress', () => {
  it('grows pool beyond 600 nodes, enforces 2-pass ClearModeEvents + state 0x36 refresh + DeleteEventByArg14, and handles re-entrancy', () => {
    const heap = new Heap113c()
    const pGame = GAME_Create113c(heap)
    heap.set(pGame, D2GameStrc.dwGameFrame, 100)

    const pPlayer = UNITS_Create113c(heap, UNIT_PLAYER, 0, 1, pGame)
    const pMonster = UNITS_Create113c(heap, UNIT_MONSTER, 0, 2, pGame)
    const pObject = UNITS_Create113c(heap, UNIT_OBJECT, 0, 3, pGame)
    const pMissile = UNITS_Create113c(heap, UNIT_MISSILE, 0, 4, pGame)
    const pItem = UNITS_Create113c(heap, UNIT_ITEM, 0, 5, pGame)
    STATLIST_CreateEx113c(heap, pMonster, 0, pGame)

    for (let i = 0; i < 750; i++) {
      EVENT_SetEventFull113c(heap, pGame, pMonster, 2, 200 + (i % 64), 0, i, 0)
    }
    expect(EVENT_GetNextEventFrame113c(heap, pMonster, 2)).toBe(200)
    EVENT_RemoveUnitEvents113c(heap, pGame, pMonster)
    expect(heap.get(pMonster, D2UnitStrc.pEventFirst)).toBe(0)

    // Verify `state 0x36` -> `0x6FD02240` (`MONSTER_RefreshAiEvent`) clears `0x36` and removes prior `evType=2`!
    EVENT_SetEventFull113c(heap, pGame, pMonster, 2, 105, 0x9999, 11, 0)
    STATES_ToggleState113c(heap, pMonster, 0x36, true)
    EVENT_SetEventFull113c(heap, pGame, pMonster, 2, 120, 0x8888, 22, 0)
    expect(STATES_CheckState113c(heap, pMonster, 0x36)).toBe(0)
    expect(EVENT_GetNextEventFrame113c(heap, pMonster, 2)).toBe(120)
    EVENT_DeleteEventByArg14_113c(heap, pGame, pMonster, 2, 22)
    expect(EVENT_GetNextEventFrame113c(heap, pMonster, 2)).toBe(0)

    // Verify 2-pass `MONSTER_ClearModeEvents113c` (`0x6FD00750`): frees `type 0` first, then `type 1`!
    const n0 = EVENT_SetEventFull113c(heap, pGame, pMonster, 0, 110, 0x1111, 1, 0)
    const n1 = EVENT_SetEventFull113c(heap, pGame, pMonster, 1, 112, 0x2222, 2, 0)
    // Unit chain is `n1 (type 1) -> n0 (type 0)`; 2-pass deletes `n0` first, then `n1` -> LIFO free head MUST be `n1`!
    MONSTER_ClearModeEvents113c(heap, pGame, pMonster)
    const pTimer = heap.get(pGame, D2GameStrc.pTimer)
    const chunk0 = heap.get(pTimer, D2TimerStrc.pPool)
    expect(heap.u32(chunk0 + 0x7080)).toBe(n1)
    expect(heap.u32(n1 + 0x1c)).toBe(n0)

    const log: string[] = []
    EVENT_SetEventFull113c(heap, pGame, pItem, 1, 101, 0, 50)
    EVENT_SetEventFull113c(heap, pGame, pObject, 1, 101, 0, 40)
    EVENT_SetEventFull113c(heap, pGame, pMonster, 1, 101, 0, 30)
    EVENT_SetEventFull113c(heap, pGame, pPlayer, 1, 101, 0, 20)
    EVENT_SetEventFull113c(heap, pGame, pMissile, 1, 101, 0, 10)
    const p1 = EVENT_SetPersistentEventFull113c(heap, pGame, pMonster, 0, 0, 301, 0)
    const p2 = EVENT_SetPersistentEventFull113c(heap, pGame, pMonster, 0, 0, 302, 0)

    heap.set(pGame, D2GameStrc.dwGameFrame, 101)
    EVENT_UpdateTimers113c(heap, pGame, (m, g, _u, _evType, arg14, _arg18, _fn, node) => {
      log.push(String(arg14))
      if (node === p2) {
        EVENT_FreeNode113c(m, g, p2)
        EVENT_FreeNode113c(m, g, p1)
      }
    })
    expect(log).toEqual(['10', '20', '302', '30', '40', '50'])
    expect(heap.get(pTimer, D2TimerStrc.pPersistentHead, 1)).toBe(0)

    let firedTotal = 0
    for (let step = 102; step < 10_102; step++) {
      heap.set(pGame, D2GameStrc.dwGameFrame, step)
      EVENT_SetEventFull113c(
        heap,
        pGame,
        pMonster,
        step % 14,
        step + 1 + (step % 7),
        0x1234,
        step,
        0,
      )
      if (step % 5 === 0) {
        EVENT_DeleteEventByType113c(heap, pGame, pMonster, step % 14, 0x1234)
      }
      firedTotal += EVENT_UpdateTimers113c(heap, pGame, () => {})
    }
    expect(firedTotal).toBeGreaterThan(7_000)
  })

  it('captures and drains outbound S2C packets via D2NetPacketSink113c', () => {
    const heap = new Heap113c()
    const sink = new D2NetPacketSink113c()
    const buf = heap.alloc(8)
    heap.loadBlock(buf, new Uint8Array([0x15, 0x00, 0x01, 0x00, 0x00, 0x00, 0xaa]))
    expect(sink.sendPacketFromMemory(heap, 0, 1, buf, 7)).toBe(7)
    expect(sink.sendPacketBytes(0, 2, new Uint8Array([0x26, 0x01]))).toBe(2)
    expect(sink.pendingCount).toBe(2)

    const c1 = sink.drain(1)
    expect(c1).toHaveLength(1)
    expect(c1[0]!.opcode).toBe(0x15)
    expect(Array.from(c1[0]!.bytes)).toEqual([0x15, 0x00, 0x01, 0x00, 0x00, 0x00, 0xaa])
    expect(sink.pendingCount).toBe(1)
    expect(sink.drain()).toHaveLength(1)
  })
})

describe('d2kern-113c §4.2 #2: real Wine DLL vs TS snapshot parity gate across StatList, STATES, SUNIT/UNITROOM & EventTimer', () => {
  it('verifies real DLL-captured vectors across all kernel domains and logs Wine vs TS parity summary', async () => {
    const t0 = performance.now()
    const all = gunzipSync(readFileSync(KERN_10K_FIXTURE_PATH))
      .toString('utf8')
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as Kern10kDiffRecord113c)

    const mSlice = all.filter((r): r is MulDivDiffRecord113c => r.k === 'm').slice(0, 200)
    const sSlice = all.filter((r): r is StatSnapDiffRecord113c => r.k === 's').slice(0, 200)
    const tSlice = all.filter((r): r is StateSeqDiffRecord113c => r.k === 't').slice(0, 200)
    const eSlice = all.filter((r): r is EventTimerSeqDiffRecord113c => r.k === 'e').slice(0, 200)
    const uSlice = all.filter((r): r is SunitRoomDiffRecord113c => r.k === 'u').slice(0, 200)

    let mOk = 0
    for (const r of mSlice) {
      const got = mulDiv113c(r.f, r.v, r.d)
      expect(got).toBe(r.c)
      expect(got).toBe(r.g)
      mOk++
    }

    let sOk = 0
    for (const r of sSlice) {
      const m = new SparseMemory113c()
      const u = UNITS_Create113c(m, UNIT_PLAYER, r.cls, 1)
      let pListEx = 0
      if (r.noStatList !== 1) {
        pListEx = STATLIST_CreateEx113c(m, u, 0)
        for (let j = 0; j < r.p.length; j += 2) {
          STATLIST_SetUnitStat113c(m, u, r.p[j]!, r.p[j + 1]!, 0)
        }
      }
      if (r.mode === 'set') {
        const eax = STATLIST_SetUnitStat113c(m, u, r.sid, r.val, 0)
        if (r.noStatList === 1) expect(eax).toBe(r.eax)
      } else {
        expect(STATLIST_GetUnitStat113c(m, u, r.sid, 0)).toBe(r.eax)
      }
      if (pListEx !== 0) {
        const pMod = m.get(pListEx, D2StatListExStrc.pModStat)
        const nMod = m.get(pListEx, D2StatListExStrc.wModStatCount)
        const gotMod: number[] = []
        for (let mi = 0; mi < nMod; mi++) gotMod.push(m.u32(pMod + mi * 4) | 0)
        expect(gotMod).toEqual(r.modStats)
      }
      for (let k = 0; k < KERN_10K_QSTATS.length; k++) {
        const sid = KERN_10K_QSTATS[k]!
        expect(STATLIST_GetUnitBaseStat113c(m, u, sid, 0)).toBe(r.q[k * 2]!)
        expect(STATLIST_GetUnitStat113c(m, u, sid, 0)).toBe(r.q[k * 2 + 1]!)
      }
      sOk++
    }

    let tOk = 0
    for (const r of tSlice) {
      const m = new SparseMemory113c()
      const u = UNITS_Create113c(m, r.uType, 0, 9101)
      m.set(u, D2UnitStrc.dwFlags2, r.initFlags2 >>> 0)
      let pRoom = 0
      if (r.hasRoom === 1) {
        const actFlagPtr = m.alloc(4)
        pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
        m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, actFlagPtr)
        m.set(pRoom, D2ActiveRoomStrc.dwFlags, (r.roomFlags ?? 0) >>> 0)
        UNITS_InitPath113c(m, u, 5010, 5010, pRoom)
      } else {
        UNITS_InitPath113c(m, u, 5010, 5010, 0)
      }
      if (r.noStatList === 0) STATLIST_CreateEx113c(m, u, 0)
      const checks: number[] = []
      for (let s = 0; s + 2 < r.steps.length; s += 3) {
        const kind = r.steps[s]!
        const sid = r.steps[s + 1]!
        const arg = r.steps[s + 2]!
        if (kind === 0) STATES_ToggleState113c(m, u, sid, arg !== 0)
        else if (kind === 1) STATES_ClearGfxStateFlag113c(m, u, sid, arg)
        else if (kind === 2) checks.push(STATES_CheckState113c(m, u, sid) | 0)
        else if (kind === 3) STATES_ToggleGfxStateFlag113c(m, u, sid, arg)
        else if (kind === 4) {
          const mw = STATE_MASKS_113C[sid]
          checks.push(mw !== undefined ? STATES_CheckStateMaskOnUnit113c(m, u, mw) | 0 : 0)
        } else if (kind === 5 && pRoom !== 0) {
          UNITROOM_ClearUpdateQueue113c(m, pRoom)
        }
      }
      expect(m.get(u, D2UnitStrc.dwFlags2) >>> 0).toBe(r.unitFlags2)
      expect(checks).toEqual(r.checks)
      tOk++
    }

    let eOk = 0
    const evTypes = [1, 1, 0, 3, 2, 4, 1, 0] as const
    const evIds = [101, 102, 201, 301, 401, 501, 103, 202] as const
    const cbA = 0xcafe0001
    const cbB = 0xcafe0002
    for (const r of eSlice) {
      const m = new SparseMemory113c()
      const pGame = GAME_Create113c(m)
      m.set(pGame, D2GameStrc.dwGameFrame, r.initFrame >>> 0)
      const units = evTypes.map((ut, i) => {
        const u = UNITS_Create113c(m, ut, 0, evIds[i]!, pGame)
        if (i === 0 || i === 1 || i === 2 || i === 6) STATLIST_CreateEx113c(m, u, 0, pGame)
        return u
      })
      const fired: [number, number, number, number, number, number][] = []
      for (let i = 0; i + 5 < r.ops.length; i += 6) {
        const [cmd, uIdx, p2, p3, p4Raw, p5Raw] = r.ops.slice(i, i + 6) as [
          number,
          number,
          number,
          number,
          number,
          number,
        ]
        const u = uIdx >= 0 && uIdx < 8 ? units[uIdx]! : 0
        const cb = ((p5Raw >>> 0) & 0x10000) !== 0 ? cbB : cbA
        const a18 = (p5Raw >>> 0) & 0xffff
        if (cmd === 1 && p2 >= 0 && p2 < 15) {
          EVENT_SetEventFull113c(m, pGame, u, p2, p3 >>> 0, cb, p4Raw >>> 0, a18)
        } else if (cmd === 2 && p2 >= 0 && p2 < 15) {
          EVENT_SetPersistentEventFull113c(m, pGame, u, p2, cb, p4Raw >>> 0, a18)
        } else if (cmd === 3 && u !== 0) {
          MONSTER_ClearModeEvents113c(m, pGame, u)
        } else if (cmd === 4 && u !== 0) {
          EVENT_DeleteEventByType113c(m, pGame, u, p2, p3 === 2 ? cbB : p3 === 1 ? cbA : 0)
        } else if (cmd === 5 && u !== 0) {
          EVENT_DeleteEventByArg14_113c(m, pGame, u, p2, p3 >>> 0)
        } else if (cmd === 6 && u !== 0) {
          EVENT_RemoveUnitEvents113c(m, pGame, u)
        } else if (
          cmd === 7 &&
          u !== 0 &&
          m.get(u, D2UnitStrc.pStatListEx) !== 0 &&
          p2 >= 0 &&
          p2 < STATES_COUNT_113C
        ) {
          STATES_ToggleState113c(m, u, p2, p3 !== 0)
        } else if (cmd === 9) {
          const steps = Math.max(0, Math.min(80, p2 | 0))
          for (let s = 0; s < steps; s++) {
            m.set(pGame, D2GameStrc.dwGameFrame, (m.get(pGame, D2GameStrc.dwGameFrame) + 1) >>> 0)
            EVENT_UpdateTimers113c(m, pGame, (mem, g, up, evT, a14, a18v, fn) => {
              if (fn !== cbA && fn !== cbB) return
              if (fired.length < 256) {
                fired.push([
                  mem.get(g, D2GameStrc.dwGameFrame) >>> 0,
                  evT | 0,
                  up !== 0 ? mem.get(up, D2UnitStrc.dwUnitType) | 0 : -1,
                  up !== 0 ? mem.get(up, D2UnitStrc.dwUnitId) >>> 0 : 0,
                  a14 | 0,
                  a18v | 0,
                ])
              }
              const ua = a18v >>> 0
              if ((ua & 0xf000) === 0xa000) {
                const rc = (ua >> 8) & 0x0f
                const ra = ua & 0xff
                if (rc === 1 && up !== 0) EVENT_DeleteEventByType113c(mem, g, up, ra & 0x0f, cbA)
                else if (rc === 2 && up !== 0) {
                  EVENT_DeleteEventByArg14_113c(
                    mem,
                    g,
                    up,
                    ra & 0x0f,
                    (ra & 0x80) !== 0 ? a14 >>> 0 : 0,
                  )
                } else if (rc === 3 && up !== 0) MONSTER_ClearModeEvents113c(mem, g, up)
                else if (rc === 4 && up !== 0) EVENT_RemoveUnitEvents113c(mem, g, up)
                else if (rc === 5) {
                  EVENT_SetEventFull113c(
                    mem,
                    g,
                    up,
                    ra & 0x0f,
                    (mem.get(g, D2GameStrc.dwGameFrame) + 1 + ((ra >> 4) & 0x07)) >>> 0,
                    cbA,
                    ((a14 >>> 0) + 1000) >>> 0,
                    0,
                  )
                }
              }
            })
          }
        } else if (cmd === 10 && u !== 0) {
          m.set(u, D2UnitStrc.pGame, p2 !== 0 ? pGame : 0)
        }
      }
      const pTimer = m.get(pGame, D2GameStrc.pTimer)
      const chunk0 = m.get(pTimer, D2TimerStrc.pPool)
      const freeTop: number[] = []
      for (let cur = m.u32(chunk0 + 0x7080); cur !== 0 && freeTop.length < 12; ) {
        freeTop.push(cur >= chunk0 && cur < chunk0 + 0x7080 ? ((cur - chunk0) / 0x30) | 0 : -1)
        cur = m.get(cur, D2EventStrc.pWheelNewer)
      }
      expect(fired).toEqual(r.fired)
      expect(freeTop).toEqual(r.freeTop)
      eOk++
    }

    let uOk = 0
    for (const r of uSlice) {
      const m = new SparseMemory113c()
      const pGame = GAME_Create113c(m, { initTimerQueue: false })
      for (let i = 0; i < Math.min(6, r.initCounters.length); i++) {
        m.set(pGame, D2GameStrc.dwLastUnitId, r.initCounters[i]! >>> 0, i)
      }
      const actFlagPtr = m.alloc(4)
      const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
      m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, actFlagPtr)
      m.set(pRoom, D2ActiveRoomStrc.dwFlags, r.roomFlags >>> 0)
      const nU = Math.min(8, Math.floor(r.units.length / 6))
      const units: number[] = []
      const ptrIdx = new Map<number, number>()
      for (let i = 0; i < nU; i++) {
        const ut = r.units[i * 6]!
        const cid = r.units[i * 6 + 1]!
        const uid = r.units[i * 6 + 2]!
        const x = r.units[i * 6 + 3]!
        const y = r.units[i * 6 + 4]!
        const hasPath = r.units[i * 6 + 5]!
        const u = UNITS_Create113c(m, ut, cid, uid, pGame)
        m.set(u, D2UnitStrc.dwFlags2, (0x02 | (i << 4)) >>> 0)
        if (hasPath !== 0) {
          UNITS_InitPath113c(m, u, x, y, pRoom)
          if (hasPath === 2 && ut === 1) {
            STATLIST_CreateEx113c(m, u, 0, pGame)
            STATES_ToggleGfxStateFlag113c(m, u, 17, 1)
            const pSub = STATLIST_AllocList113c(m, 0, ut, uid, 105, 0)
            STATLIST_SetStat113c(m, pSub, 172, 2, 0)
            STATLIST_MergeStatLists113c(m, u, pSub, 1)
          }
        }
        units.push(u)
        ptrIdx.set(u, i)
      }
      const inRoomList = (u: number): boolean => {
        for (
          let cur = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst);
          cur !== 0;
          cur = m.get(cur, D2UnitStrc.pRoomUnitNext)
        ) {
          if (cur === u) return true
        }
        return false
      }
      const found: number[] = []
      const coords: number[] = []
      for (let i = 0; i + 3 < r.ops.length; i += 4) {
        const cmd = r.ops[i]!
        const a = r.ops[i + 1]!
        const b = r.ops[i + 2]!
        if (cmd === 1 && a >= 0 && a < 6) SUNIT_GetNewUnitId113c(m, pGame, a)
        else if (cmd === 2 && a >= 0 && a < nU) {
          m.set(units[a]!, D2UnitStrc.pGameHashNext, 0)
          m.set(
            units[a]!,
            D2UnitStrc.dwFlags2,
            (m.get(units[a]!, D2UnitStrc.dwFlags2) | 0x02) >>> 0,
          )
          SUNIT_InsertServerUnit113c(m, pGame, units[a]!)
        } else if (cmd === 3 && found.length < 64) {
          const p = SUNIT_GetServerUnit113c(m, pGame, a >>> 0, b >>> 0)
          found.push(p === 0 ? -1 : (ptrIdx.get(p) ?? -2))
        } else if (cmd === 4 && a >= 0 && a < nU) SUNIT_RemoveServerUnit113c(m, pGame, units[a]!)
        else if (cmd === 5 && a >= 0 && a < nU && coords.length + 1 < 64) {
          coords.push(UNITS_GetX113c(m, units[a]!) | 0, UNITS_GetY113c(m, units[a]!) | 0)
        } else if (
          cmd === 6 &&
          a >= 0 &&
          a < nU &&
          m.get(units[a]!, D2UnitStrc.pPath) !== 0 &&
          !inRoomList(units[a]!)
        ) {
          UNITROOM_AddUnitToRoom113c(m, units[a]!, pRoom)
        } else if (cmd === 7 && a >= 0 && a < nU) UNITROOM_RefreshUnit113c(m, units[a]!)
        else if (cmd === 8 && a >= 0 && a < nU && inRoomList(units[a]!)) {
          UNITROOM_RemoveUnitFromRoom113c(m, units[a]!)
        } else if (cmd === 9) {
          if (b === 0) UNITROOM_ClearUpdateQueue113c(m, pRoom)
          else m.set(pRoom, D2ActiveRoomStrc.dwFlags, b >>> 0)
        }
      }
      expect(found).toEqual(r.found)
      expect(coords).toEqual(r.coords)
      expect(m.get(pRoom, D2ActiveRoomStrc.nPlayers) >>> 0).toBe(r.nPlayers)
      uOk++
    }

    const fnSet = await replayFile(
      join(import.meta.dirname, '..', 'fixtures/oracle/route2/a1c-fnrec-setevent-f700.ndjson.gz'),
    )
    const fnK0 = await replayFile(
      join(import.meta.dirname, '..', 'fixtures/oracle/route2/a1c-fnrec-k0.ndjson.gz'),
    )
    expect(fnSet.failures).toEqual([])
    expect(fnK0.failures).toEqual([])

    const totalRecords = mOk + sOk + tOk + eOk + uOk + fnSet.passed + fnK0.passed
    const elapsedMs = Number((performance.now() - t0).toFixed(2))
    const usPerRecord = Number(((elapsedMs * 1000) / Math.max(1, totalRecords)).toFixed(2))
    const summary = {
      mulDiv: `${mOk}/${mSlice.length}`,
      statListSnap: `${sOk}/${sSlice.length}`,
      statesSeq: `${tOk}/${tSlice.length}`,
      eventTimerSeq: `${eOk}/${eSlice.length}`,
      sunitUnitRoom: `${uOk}/${uSlice.length}`,
      fnrecSetEvent: `${fnSet.passed}/${fnSet.calls}`,
      fnrecK0Multi: `${fnK0.passed}/${fnK0.calls}`,
      elapsedMs,
      usPerRecord,
    }
    console.info('[K0-PARITY-SUMMARY] Wine DLL vs TS snapshot parity summary:', JSON.stringify(summary))
    expect(totalRecords).toBe(
      mSlice.length +
        sSlice.length +
        tSlice.length +
        eSlice.length +
        uSlice.length +
        fnSet.calls +
        fnK0.calls,
    )
    expect(elapsedMs).toBeGreaterThan(0)
    expect(usPerRecord).toBeGreaterThan(0)
  })
})
