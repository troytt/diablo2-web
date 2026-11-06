/**
 * K0 Phase 0 Pure Kernel Vertical Slice Verification (`§3.5` + `§4.1`):
 * 1. Binary parity unit tests across `timer-wheel.ts`, `monster-events.ts`, `statlist.ts`,
 *    `int-math.ts`, and `fallen-ai-113c.ts`:
 *    - `0x6FC949A0` (`MONSTER_GetModeEntry113c` + `MonStats+0x1A5` `SplGetModeChart`)
 *    - `0x6FC94F20` (`MONSTER_IsContinuousMode113c`: `0x6FD1BC50` + `MonStats2+0x104` `wMoveFlags`)
 *    - `0x6FCFFA90` (`SUNIT_IsDeadOrDying113c`: `pUnit == 0` -> `1`, non-player/monster -> `1`)
 *    - `0x6FC950F0` -> `0x6FC94E60` (`MONSTER_NullModeEventFallback113c`: `#11103` + `MONSTER_StartNeutral113c`)
 *    - `0x6FD00750` (`MONSTER_ClearModeEvents113c`: two-pass `type 0` then `type 1` free-list order)
 *    - `0x6FCAEA80` + `0x6FD02240` (`EVENT_SetEventFull113c` default state-`0x36` refresh)
 *    - `0x6FCAE8C0` (`EVENT_DeleteEventByType113c`) vs `0x6FCAE900` (`EVENT_DeleteEventByArg14_113c`)
 *    - `0x6FD88730` + `0x6FD83C20` (`STATES_ToggleState113c` null `pStatListEx` & disguise states `{63,93,119,139,140,176,177}`)
 *    - `0x6FD511E0` (`mulDiv113c`), `0x6FCFDE90` (`SUNITDMG_CheckToHit113c`), `0x6FCA38B0` (`AiZombie113c`),
 *      `0x6FD11B10` (`AI_IdleWander113c`), `0x6FD122C0` (`AI_Stall113c` `arg14 = 0`),
 *      `0x6FC99B10` (`PLAYER_Event3_RegenTick113c`), and `0x6FC99A60` (`PLAYER_Event11_PeriodicTick113c`).
 * 2. Pure `src/d2kern-113c/` end-to-end Fallen encounter slice (`F785 -> F825`, 40 frames)
 *    with ZERO `src/server/` imports and full struct field verification against `a1c-memdump-f820.ndjson.gz`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  AI_IdleWander113c,
  AI_Stall113c,
  AiFallen113c,
  AiZombie113c,
  CANONICAL_ITEM_STAT_COST_113C,
  DATATBLS_GetItemsTxtRecord113c,
  DUNGEON_CheckRoomIsTown113c,
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2AiControlStrc_SIZE,
  D2AiGeneralStrc,
  D2AiGeneralStrc_SIZE,
  D2DynamicPathStrc,
  D2DynamicPathStrc_SIZE,
  D2EventStrc,
  D2GameStrc,
  D2MonsterDataStrc,
  D2MonsterDataStrc_SIZE,
  D2RoomExStrc,
  D2RoomExStrc_SIZE,
  D2TimerStrc,
  D2UnitStrc,
  DISGUISE_STATE_MASK_WORDS_113C,
  EVENT_CHUNK_FREE_OFF_113C,
  EVENT_DeleteEventByArg14_113c,
  EVENT_DeleteEventByType113c,
  EVENT_GetNextEventFrame113c,
  EVENT_RemoveUnitEvents113c,
  EVENT_SetEventFull113c,
  EVENT_SetPersistentEventWithHandler113c,
  EVENT_SetPersistentUnitEvent113c,
  EVENT_UpdatePartition113c,
  GAME_Create113c,
  INVENTORY_GetItemFromBodyLoc113c,
  INVENTORY_GetOrInitGrid113c,
  ITEMS_CheckIfThrowItem113c,
  ITEMS_CheckItemTypeId113c,
  ITEMS_CheckNotBrokenOrUnequipping113c,
  ITEMS_GetDexBonus113c,
  ITEMS_GetStrBonus113c,
  ITEMS_RollItemDurabilityLoss113c,
  MON_EVENT_AI_THINK,
  MON_EVENT_MODE_END,
  MON_EVENT_MODE_STEP,
  MON_EVENT_STAT_REGEN,
  MONSTER_ClearModeEvents113c,
  MONSTER_ClearStepEvents113c,
  MONSTER_DispatchEvent113c,
  MONSTER_GetModeEntry113c,
  MONSTER_INLINE_AI_ON_END_TABLE_113C,
  MONSTER_IsContinuousMode113c,
  MONSTER_RegisterContinuousModeEvent113c,
  PLAYER_DrainRunStamina113c,
  PLAYER_Event3_RegenTick113c,
  PLAYER_Event11_PeriodicTick113c,
  PLAYER_GetEquippedWeapon113c,
  SKILLS_GetFlags113c,
  SKILLS_GetWeaponMasteryBonus113c,
  STATE_CORPSE_DELAY_113C,
  STATE_STUNNED_113C,
  STATE_UNINTERRUPTABLE_113C,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
  STATES_CheckState113c,
  STATES_ToggleState113c,
  SUNIT_IsDeadOrDying113c,
  SUNITDMG_ComputeHitChance113c,
  SUNITDMG_DrainItemDurability113c,
  SparseMemory113c,
  UNIT_ITEM,
  UNIT_MISSILE,
  UNIT_MONSTER,
  UNIT_OBJECT,
  UNIT_PLAYER,
  UNIT_TILE,
  UNITFLAG_DEAD_113C,
  UNITFLAG2_DISGUISE_113C,
  UNITS_Create113c,
  UNITS_GetSeed113c,
  UNITS_SetSeed113c,
  VA_AI_ZOMBIE_113C,
  getUnitPosSubtile113c,
  hydrateFallenSliceFromMemdump113c,
  mulDiv113c,
  runMonsterAiDriver113c,
  stepFallenSliceFrame113c,
  type FallenSliceWorld113c,
  type MemdumpSnapshot113c,
  type OrdEventTuple113c,
} from '../../src/d2kern-113c/index.ts'
import { DynamicPath, COLLIDE_NONE, type PathCollisionGrid, type PathRoom } from '../../src/common/path/index.ts'

const REPO = join(import.meta.dirname, '..', '..')
const ROUTE2_DIR = join(REPO, 'tests/fixtures/oracle/route2')
const GOLDEN_PATH = join(REPO, 'tests/fixtures/oracle/golden/a1c-bloodmoor-fallen.oracle.ndjson.gz')

interface GoldenFrameRecord {
  readonly frame?: number
  readonly in?: ReadonlyArray<readonly [number, string]>
  readonly dmg?: ReadonlyArray<{
    readonly att: readonly [number, number]
    readonly def: readonly [number, number]
    readonly ret: number
  }>
  readonly t0: ReadonlyArray<readonly number[]>
  readonly t1: ReadonlyArray<readonly number[]>
}

function readNdjsonGz<T>(filePath: string): T[] {
  const text = gunzipSync(readFileSync(filePath)).toString('utf8')
  const out: T[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length > 0) out.push(JSON.parse(trimmed) as T)
  }
  return out
}

function createMinimalSliceWorld113c(m: SparseMemory113c): {
  world: FallenSliceWorld113c
  pRoom: number
} {
  const pGame = GAME_Create113c(m, { expansion: true, difficulty: 0, initSeed: 0x12345678 })
  m.set(pGame, D2GameStrc.dwGameFrame, 100)
  const pTimer = m.get(pGame, D2GameStrc.pTimer)
  const pLevel = m.alloc(0x230)
  m.setU32(pLevel + 0x1d0, 2) // Blood Moor (`dwLevelNo = 2`)
  const pRoomEx = m.alloc(D2RoomExStrc_SIZE)
  m.set(pRoomEx, D2RoomExStrc.pLevel, pLevel)
  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
  m.set(pRoom, D2ActiveRoomStrc.pRoomEx, pRoomEx)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileX, 5000)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileY, 5000)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileWidth, 80)
  m.set(pRoom, D2ActiveRoomStrc.nSubtileHeight, 80)
  const ppRooms = m.alloc(4)
  m.setU32(ppRooms, pRoom)
  m.set(pRoom, D2ActiveRoomStrc.ppRoomsNear, ppRooms)
  m.set(pRoom, D2ActiveRoomStrc.nRoomsNear, 1)

  const openGrid: PathCollisionGrid = {
    get: () => COLLIDE_NONE,
    set: () => {},
  }
  const roomObj: PathRoom & { readonly ptr: number; adjacentRooms: PathRoom[] } = {
    ptr: pRoom,
    subX: 5000,
    subY: 5000,
    subW: 80,
    subH: 80,
    isTown: false,
    adjacentRooms: [],
    grid: openGrid,
  }
  const roomByPtr = new Map([[pRoom, roomObj]])
  const world: FallenSliceWorld113c = {
    m,
    pGame,
    pTimer,
    unitsByKey: new Map(),
    monsterById: new Map(),
    playerById: new Map(),
    pathUnitByPtr: new Map(),
    roomByPtr: roomByPtr as FallenSliceWorld113c['roomByPtr'],
    minionIdsByLeaderId: new Map(),
    lastFrameOrd: [],
    lastFrameDmg: [],
  }
  return { world, pRoom }
}

function attachUnitPathInWorld113c(
  world: FallenSliceWorld113c,
  pUnit: number,
  pRoom: number,
  x: number,
  y: number,
): void {
  const { m } = world
  const pPath = m.alloc(D2DynamicPathStrc_SIZE)
  m.set(pUnit, D2UnitStrc.pPath, pPath)
  m.setU32(pPath + 0x00, ((x << 16) + 0x8000) >>> 0)
  m.setU32(pPath + 0x04, ((y << 16) + 0x8000) >>> 0)
  m.set(pPath, D2DynamicPathStrc.pRoom, pRoom)
  m.set(pPath, D2DynamicPathStrc.pUnit, pUnit)
  m.set(pPath, D2DynamicPathStrc.dwUnitSize, 2)
  m.set(pPath, D2DynamicPathStrc.dwCollisionPattern, 1)
  m.set(pPath, D2DynamicPathStrc.nFootprintCollisionMask, 0x100)
  m.set(pPath, D2DynamicPathStrc.nMoveTestCollisionMask, 0x1c09)
  const dp = new DynamicPath()
  const pu = {
    pUnit,
    pPath,
    dwUnitType: m.get(pUnit, D2UnitStrc.dwUnitType),
    dwClassId: m.get(pUnit, D2UnitStrc.dwClassId),
    dwUnitId: m.get(pUnit, D2UnitStrc.dwUnitId),
    dwAnimMode: m.get(pUnit, D2UnitStrc.dwAnimMode),
    dwFlags: m.get(pUnit, D2UnitStrc.dwFlags),
    dwFlagEx: m.get(pUnit, D2UnitStrc.dwFlags2),
    pDynamicPath: dp,
    pStaticPath: null,
    objectTxt: null,
  }
  dp.pUnit = pu
  world.pathUnitByPtr.set(pUnit, pu)
  const key = `${pu.dwUnitType}:${pu.dwUnitId}`
  world.unitsByKey.set(key, pUnit)
  if (pu.dwUnitType === UNIT_MONSTER) world.monsterById.set(pu.dwUnitId, pUnit)
  if (pu.dwUnitType === UNIT_PLAYER) world.playerById.set(pu.dwUnitId, pUnit)
}

describe('src/d2kern-113c B2/B3 binary parity unit suite', () => {
  it('verifies MONSTER_GetModeEntry113c (0x6FC949A0 + SplGetModeChart +0x1A5) and MONSTER_IsContinuousMode113c (0x6FC94F20 + MonStats2+0x104)', () => {
    expect(CANONICAL_ITEM_STAT_COST_113C.length).toBe(359)
    const m = new SparseMemory113c()
    const uFallen = UNITS_Create113c(m, UNIT_MONSTER, 19, 12)
    expect(MONSTER_GetModeEntry113c(m, uFallen, 0)).toEqual({
      mode: 0,
      pfnStart: 0x6fc96270,
      pfnStep: 0x6fc959f0,
      pfnEnd: 0x6fc96040,
      scheduleEvents: 1,
    })
    expect(MONSTER_GetModeEntry113c(m, uFallen, 1)).toEqual({
      mode: 1,
      pfnStart: 0x6fc94e60,
      pfnStep: 0x6fc95320,
      pfnEnd: 0x00000000,
      scheduleEvents: 0,
    })
    expect(MONSTER_GetModeEntry113c(m, uFallen, 2)?.pfnStep).toBe(0x6fc97010)
    expect(MONSTER_GetModeEntry113c(m, uFallen, 12)?.scheduleEvents).toBe(0)
    expect(MONSTER_GetModeEntry113c(m, uFallen, 15)?.pfnStep).toBe(0x6fc96fe0)

    // Fallen (hcIdx 19, wMoveFlags = 0): only `{2 WL, 13 KB, 14 SQ, 15 RN}` are continuous
    const fallenContinuous = Array.from({ length: 16 }, (_, i) => i).filter((mode) =>
      MONSTER_IsContinuousMode113c(m, uFallen, mode),
    )
    expect(fallenContinuous).toEqual([2, 13, 14, 15])

    // Vulture1 (hcIdx 110, MonStats2+0x104 = 0x0300 `S1mv | S2mv`): modes 8 (S1) and 9 (S2) are ALSO continuous!
    const uVulture = UNITS_Create113c(m, UNIT_MONSTER, 110, 110)
    const vultureContinuous = Array.from({ length: 16 }, (_, i) => i).filter((mode) =>
      MONSTER_IsContinuousMode113c(m, uVulture, mode),
    )
    expect(vultureContinuous).toEqual([2, 8, 9, 13, 14, 15])

    // SandMaggot1 (hcIdx 244, MonStats2+0x104 = 0x0020 `A2mv`): mode 5 (A2) is continuous!
    const uMaggot = UNITS_Create113c(m, UNIT_MONSTER, 244, 244)
    const maggotContinuous = Array.from({ length: 16 }, (_, i) => i).filter((mode) =>
      MONSTER_IsContinuousMode113c(m, uMaggot, mode),
    )
    expect(maggotContinuous).toEqual([2, 5, 13, 14, 15])

    // Inline AI-on-end modes (`0x6FD2F14C`): `{2 WL, 15 RN}`
    const inlineAiModes = Array.from({ length: 16 }, (_, i) => i).filter(
      (mode) => MONSTER_INLINE_AI_ON_END_TABLE_113C[mode] === 1,
    )
    expect(inlineAiModes).toEqual([2, 15])

    // Jump-table `0x6FC94A18` + `SplGetModeChart (+0x1A5)` classId overrides in `0x6FC949A0`:
    for (const diabloId of [243, 333, 705]) {
      const uDiablo = UNITS_Create113c(m, UNIT_MONSTER, diabloId, 200 + diabloId)
      expect(MONSTER_GetModeEntry113c(m, uDiablo, 10)?.scheduleEvents).toBe(1)
      expect(MONSTER_GetModeEntry113c(m, uDiablo, 11)?.pfnEnd).toBe(0x6fc96bf0)
    }
    const u403 = UNITS_Create113c(m, UNIT_MONSTER, 403, 403)
    expect(MONSTER_GetModeEntry113c(m, u403, 4)?.pfnEnd).toBe(0x6fc96b20)
    expect(MONSTER_GetModeEntry113c(m, u403, 5)?.pfnEnd).toBe(0x6fc96b20)
    expect(MONSTER_GetModeEntry113c(m, u403, 8)?.pfnEnd).toBe(0x6fc96a50)
    expect(MONSTER_GetModeEntry113c(m, u403, 9)?.pfnEnd).toBe(0x6fc96a50)

    for (const shadowId of [417, 418]) {
      const uShadow = UNITS_Create113c(m, UNIT_MONSTER, shadowId, shadowId)
      expect(MONSTER_GetModeEntry113c(m, uShadow, 11)?.scheduleEvents).toBe(1)
      expect(MONSTER_GetModeEntry113c(m, uShadow, 11)?.pfnEnd).toBe(0x6fc96bf0)
    }
    for (const baalId of [543, 544, 570, 709]) {
      const uBaal = UNITS_Create113c(m, UNIT_MONSTER, baalId, baalId)
      expect(MONSTER_GetModeEntry113c(m, uBaal, 10)?.scheduleEvents).toBe(1)
      expect(MONSTER_GetModeEntry113c(m, uBaal, 10)?.pfnEnd).toBe(0x6fc96bf0)
    }
  })

  it('verifies SUNIT_IsDeadOrDying113c (0x6FCFFA90), STATE_FREEZE guard, and 0x6FC950F0 null-handler fallback', () => {
    const m = new SparseMemory113c()
    const pGame = GAME_Create113c(m)
    m.set(pGame, D2GameStrc.dwGameFrame, 500)

    // 0x6FCFFA93: `pUnit == 0` -> returns `1` (`true`)!
    expect(SUNIT_IsDeadOrDying113c(m, 0)).toBe(1)

    // 0x6FCFFAAD: non-player/monster unit types (`2, 3, 4, 5`) -> returns `1`!
    for (const uType of [UNIT_OBJECT, UNIT_MISSILE, UNIT_ITEM, UNIT_TILE]) {
      const uOther = UNITS_Create113c(m, uType, 1, 50 + uType, pGame)
      m.set(uOther, D2UnitStrc.dwAnimMode, 1)
      expect(SUNIT_IsDeadOrDying113c(m, uOther)).toBe(1)
    }

    const uPlr = UNITS_Create113c(m, UNIT_PLAYER, 4, 1, pGame)
    m.set(uPlr, D2UnitStrc.dwAnimMode, 1)
    expect(SUNIT_IsDeadOrDying113c(m, uPlr)).toBe(0)
    m.set(uPlr, D2UnitStrc.dwAnimMode, 17)
    expect(SUNIT_IsDeadOrDying113c(m, uPlr)).toBe(1)

    const pUnit = UNITS_Create113c(m, UNIT_MONSTER, 19, 12, pGame)
    const pMonData = m.alloc(D2MonsterDataStrc_SIZE)
    const pAiGen = m.alloc(D2AiGeneralStrc_SIZE)
    const pSkills = m.alloc(0x20)
    m.setU32(pSkills + 0x10, 99) // non-zero dwSkillMode
    m.set(pUnit, D2UnitStrc.pSkills, pSkills)
    m.set(pAiGen, D2AiGeneralStrc.pfnThink, 0x6fca3130)
    m.set(pMonData, D2MonsterDataStrc.pAiGeneral, pAiGen)
    m.set(pUnit, D2UnitStrc.pUnitData, pMonData)
    m.set(pUnit, D2UnitStrc.dwAnimMode, 2) // WL (pfnEnd == 0!)
    STATLIST_CreateEx113c(m, pUnit, 0, pGame)

    // Null-handler fallback `0x6FC950F0`: firing `Event 1` on `WL` (`pfnEnd == 0`) calls `#11103`
    // (`pSkills+0x10 = 0`), forces `MONMODE_NEUTRAL (1)`,schedules `Event 2` (`500 + aidel(15) = 515`),
    // and does NOT delete an existing `Event 0` node (`MONSTER_ClearModeEvents` is NOT called!).
    const stepNode = MONSTER_RegisterContinuousModeEvent113c(m, pGame, pUnit)
    MONSTER_DispatchEvent113c(m, pGame, pUnit, MON_EVENT_MODE_END, 0, 0, {})
    expect(m.u32(pSkills + 0x10)).toBe(0)
    expect(m.get(pUnit, D2UnitStrc.dwAnimMode)).toBe(1)
    expect(EVENT_GetNextEventFrame113c(m, pUnit, MON_EVENT_AI_THINK)).toBe(515)
    let stillHasStepNode = false
    for (let c = m.get(pUnit, D2UnitStrc.pEventFirst); c !== 0; c = m.get(c, D2EventStrc.pUnitNext)) {
      if (c === stepNode) stillHasStepNode = true
    }
    expect(stillHasStepNode).toBe(true)

    // With `STATE_STUNNED (0x15)` set and no pending AI event, `0x6FC94E60` schedules `frame + 45` (`545`)!
    EVENT_DeleteEventByType113c(m, pGame, pUnit, MON_EVENT_AI_THINK, 0)
    STATES_ToggleState113c(m, pUnit, STATE_STUNNED_113C, true)
    m.set(pUnit, D2UnitStrc.dwAnimMode, 2)
    MONSTER_DispatchEvent113c(m, pGame, pUnit, MON_EVENT_MODE_END, 0, 0, {})
    expect(EVENT_GetNextEventFrame113c(m, pUnit, MON_EVENT_AI_THINK)).toBe(545)
    STATES_ToggleState113c(m, pUnit, STATE_STUNNED_113C, false)

    // Freeze guard `0x6FC969A0`:
    m.set(pUnit, D2UnitStrc.dwAnimMode, 2)
    STATES_ToggleState113c(m, pUnit, 1, true)
    const fired: number[] = []
    const cbs = {
      onModeStep: () => fired.push(0),
      onModeEnd: () => fired.push(1),
      onAiThink: () => fired.push(2),
      onStatRegen: () => fired.push(3),
      onOtherEvent: (_m: unknown, _g: number, _u: number, ev: number) => fired.push(ev),
    }
    for (const ev of [0, 1, 2, 3, 5, 6, 8, 12]) {
      MONSTER_DispatchEvent113c(m, pGame, pUnit, ev, 0, 0, cbs)
    }
    expect(fired).toEqual([3, 5, 8, 12])

    fired.length = 0
    m.set(pUnit, D2UnitStrc.dwAnimMode, 0)
    MONSTER_DispatchEvent113c(m, pGame, pUnit, MON_EVENT_MODE_END, 0, 0, cbs)
    expect(fired).toEqual([1])

    m.set(pUnit, D2UnitStrc.dwAnimMode, 1)
    m.set(pUnit, D2UnitStrc.dwFlags, UNITFLAG_DEAD_113C)
    expect(SUNIT_IsDeadOrDying113c(m, pUnit)).toBe(1)
  })

  it('verifies two-pass MONSTER_ClearModeEvents113c (0x6FD00750), 0x6FCAEA80 default state-0x36 refresh, and 0x6FCAE8C0 vs 0x6FCAE900', () => {
    const m = new SparseMemory113c()
    const pGame = GAME_Create113c(m)
    m.set(pGame, D2GameStrc.dwGameFrame, 788)
    const pTimer = m.get(pGame, D2GameStrc.pTimer)
    const firstChunk = m.get(pTimer, D2TimerStrc.pPool)

    const u = UNITS_Create113c(m, UNIT_MONSTER, 19, 12, pGame)
    STATLIST_CreateEx113c(m, u, 0, pGame)

    // Schedule `type 0` first (`nodeA`), then `type 1` second (`nodeB` -> head of `pEventFirst` is `[nodeB(type 1), nodeA(type 0)]`).
    // A single-pass walk would free `nodeB` first then `nodeA` (making `nodeA` free-list head).
    // Two-pass `0x6FD00750` frees `type 0` (`nodeA`) first, then `type 1` (`nodeB`), so `nodeB` MUST be free-list head!
    const nodeA = EVENT_SetEventFull113c(m, pGame, u, MON_EVENT_MODE_STEP, 795, 0, 0, 0)
    const nodeB = EVENT_SetEventFull113c(m, pGame, u, MON_EVENT_MODE_END, 796, 0, 0, 0)
    MONSTER_ClearModeEvents113c(m, pGame, u)
    expect(m.u32(firstChunk + EVENT_CHUNK_FREE_OFF_113C)).toBe(nodeB)
    expect(m.get(nodeB, D2EventStrc.pWheelNewer)).toBe(nodeA)

    // Default `0x6FD02240` (`MONSTER_RefreshAiEvent113c`) inside `EVENT_SetEventFull113c` when `hooks` is omitted:
    m.set(u, D2UnitStrc.dwAnimMode, 12)
    STATES_ToggleState113c(m, u, STATE_UNINTERRUPTABLE_113C, true)
    STATES_ToggleState113c(m, u, STATE_CORPSE_DELAY_113C, true)
    const oldAi = EVENT_SetPersistentUnitEvent113c(m, pGame, u, MON_EVENT_AI_THINK, 0, 0)
    expect(m.get(u, D2UnitStrc.pEventFirst)).toBe(oldAi)

    const newAi = EVENT_SetEventFull113c(m, pGame, u, MON_EVENT_AI_THINK, 800, 0, 0, 0)
    expect(STATES_CheckState113c(m, u, STATE_UNINTERRUPTABLE_113C)).toBe(0)
    expect(STATES_CheckState113c(m, u, STATE_CORPSE_DELAY_113C)).toBe(0)
    expect(m.get(u, D2UnitStrc.dwAnimMode)).toBe(12)
    expect(m.get(u, D2UnitStrc.pEventFirst)).toBe(newAi)
    expect(m.get(newAi, D2EventStrc.pUnitNext)).toBe(0)

    // `0x6FCAE8C0` (`EVENT_DeleteEventByType113c`, matches `pfnHandler`) vs `0x6FCAE900` (`EVENT_DeleteEventByArg14_113c`, matches `dwArg14`):
    const u2 = UNITS_Create113c(m, UNIT_MONSTER, 19, 99, pGame)
    const evH1 = EVENT_SetPersistentEventWithHandler113c(m, pGame, u2, 8, 111, 22, 0x6fcc1e80)
    const evH2 = EVENT_SetPersistentEventWithHandler113c(m, pGame, u2, 8, 222, 22, 0x6fcbe8e0)
    EVENT_DeleteEventByType113c(m, pGame, u2, 8, 0x6fcc1e80)
    expect(m.get(u2, D2UnitStrc.pEventFirst)).toBe(evH2)
    expect(m.u16(evH1 + 2)).toBe(2)

    const evA1 = EVENT_SetEventFull113c(m, pGame, u2, 5, 805, 0, 10, 0)
    const evA2 = EVENT_SetEventFull113c(m, pGame, u2, 5, 806, 0, 20, 0)
    EVENT_DeleteEventByArg14_113c(m, pGame, u2, 5, 10)
    expect(m.u16(evA1 + 2)).toBe(2)
    expect(m.u16(evA2 + 2)).not.toBe(2)
    EVENT_RemoveUnitEvents113c(m, pGame, u2)

    // Re-entrant LIFO registration (`0x6FD00B40`):
    const u12 = UNITS_Create113c(m, UNIT_MONSTER, 19, 12, pGame)
    const u14 = UNITS_Create113c(m, UNIT_MONSTER, 19, 14, pGame)
    const u15 = UNITS_Create113c(m, UNIT_MONSTER, 19, 15, pGame)
    MONSTER_RegisterContinuousModeEvent113c(m, pGame, u15)
    MONSTER_RegisterContinuousModeEvent113c(m, pGame, u14)
    MONSTER_RegisterContinuousModeEvent113c(m, pGame, u12)
    EVENT_SetEventFull113c(m, pGame, u12, MON_EVENT_STAT_REGEN, 789)

    m.set(pGame, D2GameStrc.dwGameFrame, 789)
    const f789Order: string[] = []
    EVENT_UpdatePartition113c(m, pGame, 1, (_mem, _g, pUnit, evType) => {
      const id = m.get(pUnit, D2UnitStrc.dwUnitId)
      f789Order.push(`${id}:${evType}`)
      if (id === 14 && evType === 0) {
        MONSTER_RegisterContinuousModeEvent113c(m, pGame, u14)
      }
    })
    expect(f789Order).toEqual(['12:0', '14:0', '15:0', '12:3'])

    m.set(pGame, D2GameStrc.dwGameFrame, 790)
    const f790Order: string[] = []
    EVENT_UpdatePartition113c(m, pGame, 1, (_mem, _g, pUnit, evType) => {
      f790Order.push(`${m.get(pUnit, D2UnitStrc.dwUnitId)}:${evType}`)
    })
    expect(f790Order).toEqual(['14:0', '12:0', '15:0'])
  })

  it('verifies STATES_ToggleState113c (0x6FD88730 + 0x6FD83C20), mulDiv113c (0x6FD511E0), SUNITDMG_ComputeHitChance113c (0x6FCFDE90), Player Events 3/11, AiFallen pRoom==0, and AiZombie113c', () => {
    const m = new SparseMemory113c()
    const pGame = GAME_Create113c(m)

    // 1. `STATES_ToggleState113c`: returns immediately when `pStatListEx == 0` (NEVER allocates!)
    const uNoList = UNITS_Create113c(m, UNIT_MONSTER, 19, 1, pGame)
    STATES_ToggleState113c(m, uNoList, 63, true)
    expect(m.get(uNoList, D2UnitStrc.pStatListEx)).toBe(0)
    expect(m.get(uNoList, D2UnitStrc.dwFlags2)).toBe(0)

    // Works on any unit type with an extended statlist and updates `dwFlags2 & 0x08` across `{63,93,119,139,140,176,177}`:
    expect(DISGUISE_STATE_MASK_WORDS_113C).toEqual([
      0x00000000, 0x80000000, 0x20000000, 0x00800000, 0x00001800, 0x00030000,
    ])
    const uObj = UNITS_Create113c(m, UNIT_OBJECT, 1, 2, pGame)
    STATLIST_CreateEx113c(m, uObj, 0, pGame)
    STATES_ToggleState113c(m, uObj, 139, true) // werewolf
    expect((m.get(uObj, D2UnitStrc.dwFlags2) & UNITFLAG2_DISGUISE_113C) !== 0).toBe(true)
    STATES_ToggleState113c(m, uObj, 177, true) // delirium
    STATES_ToggleState113c(m, uObj, 139, false) // 177 still active -> 0x08 stays set!
    expect((m.get(uObj, D2UnitStrc.dwFlags2) & UNITFLAG2_DISGUISE_113C) !== 0).toBe(true)
    STATES_ToggleState113c(m, uObj, 177, false) // last disguise state cleared -> 0x08 cleared!
    expect((m.get(uObj, D2UnitStrc.dwFlags2) & UNITFLAG2_DISGUISE_113C) !== 0).toBe(false)

    // 2. Native `mulDiv113c` (`0x6FD511E0` / `0x6FC214D0`): both 64-bit path and large-`a` path (`|a| > 0x100000`)
    expect(mulDiv113c(95, 100, 100)).toBe(95)
    expect(mulDiv113c(-50, 200, 100)).toBe(-100)
    expect(mulDiv113c(0x200000, 3, 2)).toBe(0x300000) // `a <= 0x100000` false -> `b > 0x10000` false -> 64-bit exact
    expect(mulDiv113c(0x200001, 0x20000, 0x10000)).toBe(Math.imul(Math.trunc(0x200001 / 0x10000), 0x20000))

    // 3. `SUNITDMG_ComputeHitChance113c` (`0x6FCFDE90`) + Player `DrainRunStamina` (`0x6FC97BB0`) + Events `3` & `11`:
    const { world, pRoom } = createMinimalSliceWorld113c(m)
    const pBarb = UNITS_Create113c(m, UNIT_PLAYER, 4, 1, world.pGame) // Barbarian (`runDrain=20`, `toHitFactor=20`)
    STATLIST_CreateEx113c(m, pBarb, 0, world.pGame)
    STATLIST_SetUnitStat113c(m, pBarb, 2, 20, 0) // Dex = 20 -> baseAr = 100 - 35 + 20 = 85
    STATLIST_SetUnitStat113c(m, pBarb, 12, 1, 0) // clvl = 1
    STATLIST_SetUnitStat113c(m, pBarb, 6, 1000, 0) // hp < maxhp
    STATLIST_SetUnitStat113c(m, pBarb, 7, 2000, 0)
    STATLIST_SetUnitStat113c(m, pBarb, 74, 25, 0) // hpregen = 25
    STATLIST_SetUnitStat113c(m, pBarb, 8, 500, 0) // mana < maxmana
    STATLIST_SetUnitStat113c(m, pBarb, 9, 6000, 0)
    STATLIST_SetUnitStat113c(m, pBarb, 10, 1000, 0) // stam < maxstam
    STATLIST_SetUnitStat113c(m, pBarb, 11, 2560, 0)
    m.set(pBarb, D2UnitStrc.dwAnimMode, 1) // NU
    const pInv = m.alloc(0x40)
    m.setU32(pInv, 0x01020304) // INV_SIGNATURE_113C
    m.setU32(pInv + 0x08, pBarb)
    m.setU32(pInv + 0x1c, 0xffffffff) // dwWeaponId = -1
    m.set(pBarb, D2UnitStrc.pInventory, pInv)

    // `INVENTORY_GetOrInitGrid113c` (`0x6FD6E1B0`) lazily allocates grid `0` (`13x1`) when `nGrids == 0`:
    expect(INVENTORY_GetOrInitGrid113c(m, pInv, 0, null)).toBe(0)
    const pGrid0 = INVENTORY_GetOrInitGrid113c(m, pInv, 0)
    expect(pGrid0).toBeGreaterThan(0)
    expect(m.u32(pInv + 0x18)).toBe(1) // nGrids = 1
    expect(m.u8(pGrid0 + 0x08)).toBe(13) // bGridX (+0x08) = 13
    expect(m.u8(pGrid0 + 0x09)).toBe(1) // bGridY (+0x09) = 1
    const ppBodyItems = m.u32(pGrid0 + 0x0c)
    expect(ppBodyItems).toBeGreaterThan(0)

    // Equip Hand Axe (`classId = 0`, `hax`) at `BODYLOC_RARM = 4` and Quilted Armor (`classId = 306`, `qui`) at `BODYLOC_TORSO = 3`
    const pAxe = UNITS_Create113c(m, UNIT_ITEM, 0, 100, world.pGame)
    STATLIST_CreateEx113c(m, pAxe, 0, world.pGame)
    STATLIST_SetUnitStat113c(m, pAxe, 72, 10, 0) // durability = 10
    STATLIST_SetUnitStat113c(m, pAxe, 73, 28, 0) // maxdurability = 28
    const pAxeData = m.alloc(0x74)
    m.set(pAxe, D2UnitStrc.pUnitData, pAxeData)
    m.setU32(ppBodyItems + 4 * 4, pAxe)

    const pArmor = UNITS_Create113c(m, UNIT_ITEM, 306, 101, world.pGame)
    STATLIST_CreateEx113c(m, pArmor, 0, world.pGame)
    STATLIST_SetUnitStat113c(m, pArmor, 72, 2, 0) // durability = 2
    STATLIST_SetUnitStat113c(m, pArmor, 73, 20, 0) // maxdurability = 20
    const pArmorData = m.alloc(0x74)
    m.set(pArmor, D2UnitStrc.pUnitData, pArmorData)
    m.setU32(ppBodyItems + 3 * 4, pArmor)

    expect(INVENTORY_GetItemFromBodyLoc113c(m, pInv, 0)).toBe(0)
    expect(INVENTORY_GetItemFromBodyLoc113c(m, pInv, 13)).toBe(0)
    expect(INVENTORY_GetItemFromBodyLoc113c(m, pInv, 4)).toBe(pAxe)
    expect(INVENTORY_GetItemFromBodyLoc113c(m, pInv, 3)).toBe(pArmor)
    expect(PLAYER_GetEquippedWeapon113c(m, pBarb)).toBe(pAxe)
    expect(DATATBLS_GetItemsTxtRecord113c(0)?.code).toBe('hax')
    expect(ITEMS_CheckItemTypeId113c(m, pAxe, 45)).toBe(1) // ITYPE_WEAPON
    expect(ITEMS_CheckItemTypeId113c(m, pAxe, 28)).toBe(1) // axe
    expect(ITEMS_CheckItemTypeId113c(m, pArmor, 50)).toBe(1) // ITYPE_ANY_ARMOR
    expect(ITEMS_GetStrBonus113c(m, pAxe)).toBe(100)
    expect(ITEMS_GetDexBonus113c(m, pAxe)).toBe(0)
    expect(ITEMS_CheckNotBrokenOrUnequipping113c(m, pAxe)).toBe(1)
    expect(ITEMS_CheckIfThrowItem113c(m, pAxe)).toBe(0)

    // `PLAYER_GetEquippedWeapon113c` (`0x6FC572C0`) dual-wield `weapSel` jump table (`0x6FC57414`) & shared fallback tail (`0x6FC573D6..0x6FC57403`):
    const pLeftClub = UNITS_Create113c(m, UNIT_ITEM, 10, 102, world.pGame) // Club (`clb`) at `BODYLOC_LARM = 5`
    const pLeftData = m.alloc(0x74)
    m.set(pLeftClub, D2UnitStrc.pUnitData, pLeftData)
    m.setU32(ppBodyItems + 5 * 4, pLeftClub)
    m.setU32(pInv + 0x1c, 102) // dwWeaponId = 102 (`pLeftClub` is primary hand slot 5; `pAxe` is secondary hand slot 6)
    const pSkills = m.alloc(0x20)
    const pUsedSkill = m.alloc(0x40)
    const pSkillsTxt = m.alloc(0x23c)
    m.setU32(pUsedSkill, pSkillsTxt)
    m.setU32(pSkills + 0x10, pUsedSkill)
    m.set(pBarb, D2UnitStrc.pSkills, pSkills)

    // weapSel == 0 (default): picks slot 5 (`pLeftClub`)
    m.setU8(pSkillsTxt + 0x168, 0)
    expect(PLAYER_GetEquippedWeapon113c(m, pBarb)).toBe(pLeftClub)
    // weapSel == 1: picks slot 6 (`pAxe`)
    m.setU8(pSkillsTxt + 0x168, 1)
    expect(PLAYER_GetEquippedWeapon113c(m, pBarb)).toBe(pAxe)
    // weapSel == 2: checks `SKILLS_GetFlags113c(m, pUsedSkill) & 0x2000` (`0` -> slot 5 `pLeftClub`; `0x2000` -> slot 6 `pAxe`)
    m.setU8(pSkillsTxt + 0x168, 2)
    m.setU32(pUsedSkill + 0x0c, 0)
    expect(SKILLS_GetFlags113c(m, pUsedSkill)).toBe(0)
    expect(PLAYER_GetEquippedWeapon113c(m, pBarb)).toBe(pLeftClub)
    m.setU32(pUsedSkill + 0x0c, 0x2000)
    expect(SKILLS_GetFlags113c(m, pUsedSkill)).toBe(0x2000)
    expect(PLAYER_GetEquippedWeapon113c(m, pBarb)).toBe(pAxe)
    // weapSel == 3: checks `((dwActionFrame (+0x38) | 0) >> 8) & 1` (`0` -> slot 5 `pLeftClub`; `1` -> slot 6 `pAxe`)
    m.setU8(pSkillsTxt + 0x168, 3)
    m.setU32(pBarb + 0x38, 0x0200) // frameIdx = 2 (even) -> slot 5
    expect(PLAYER_GetEquippedWeapon113c(m, pBarb)).toBe(pLeftClub)
    m.setU32(pBarb + 0x38, 0x0300) // frameIdx = 3 (odd) -> slot 6
    expect(PLAYER_GetEquippedWeapon113c(m, pBarb)).toBe(pAxe)
    // weapSel == 4: sets `pDefault = 0` and `pChosen = 0` -> returns `0`
    m.setU8(pSkillsTxt + 0x168, 4)
    expect(PLAYER_GetEquippedWeapon113c(m, pBarb)).toBe(0)
    m.setU32(pBarb + 0x38, 0)
    m.set(pBarb, D2UnitStrc.pSkills, 0)
    m.setU32(ppBodyItems + 5 * 4, 0)
    m.setU32(pInv + 0x1c, 0xffffffff)

    // Broken weapon (`ITEMFLAG_BROKEN = 0x100`) is rejected by `ITEMS_CheckNotBrokenOrUnequipping113c` & `PLAYER_GetEquippedWeapon113c`
    m.setU32(pAxeData + 0x18, 0x100)
    expect(ITEMS_CheckNotBrokenOrUnequipping113c(m, pAxe)).toBe(0)
    expect(PLAYER_GetEquippedWeapon113c(m, pBarb)).toBe(0)
    m.setU32(pAxeData + 0x18, 0)
    expect(PLAYER_GetEquippedWeapon113c(m, pBarb)).toBe(pAxe)

    // `SKILLS_GetWeaponMasteryBonus113c` (`#10804`, `0x6FD9F640`) queries `layer = wType1` (`28` = `axe`)
    STATLIST_SetUnitStat113c(m, pBarb, 342, 43, 28) // melee TH mastery for axe
    STATLIST_SetUnitStat113c(m, pBarb, 343, 32, 28) // melee DMG mastery for axe
    expect(SKILLS_GetWeaponMasteryBonus113c(m, pBarb, pAxe, 0, 0)).toBe(43)
    expect(SKILLS_GetWeaponMasteryBonus113c(m, pBarb, pAxe, 0, 1)).toBe(32)
    STATLIST_SetUnitStat113c(m, pBarb, 342, 0, 28)
    STATLIST_SetUnitStat113c(m, pBarb, 343, 0, 28)

    // `DUNGEON_CheckRoomIsTown113c` (`#10057`, `0x6FD8C390`) checks `{1, 40, 75, 103, 109}`
    expect(DUNGEON_CheckRoomIsTown113c(m, pRoom)).toBe(0) // Blood Moor (level 2)
    const pRoomEx = m.get(pRoom, D2ActiveRoomStrc.pRoomEx)
    const pLevel = m.get(pRoomEx, D2RoomExStrc.pLevel)
    m.setU32(pLevel + 0x1d0, 1) // Rogue Encampment
    expect(DUNGEON_CheckRoomIsTown113c(m, pRoom)).toBe(1)
    m.setU32(pLevel + 0x1d0, 2)

    attachUnitPathInWorld113c(world, pBarb, pRoom, 5040, 5040)

    expect(PLAYER_DrainRunStamina113c(m, pBarb)).toBe(1)
    expect(STATLIST_GetUnitStat113c(m, pBarb, 10, 0)).toBe(960) // 1000 - (20 << 1) = 960
    PLAYER_Event3_RegenTick113c(m, world.pGame, pBarb)
    expect(STATLIST_GetUnitStat113c(m, pBarb, 6, 0)).toBe(1025)
    expect(STATLIST_GetUnitStat113c(m, pBarb, 8, 0)).toBe(502) // 6000 / 3000 = 2
    expect(STATLIST_GetUnitStat113c(m, pBarb, 10, 0)).toBe(970) // 960 + (2560 >> 8) = 970
    expect(EVENT_GetNextEventFrame113c(m, pBarb, 3)).toBe(101)
    PLAYER_Event11_PeriodicTick113c(m, world.pGame, pBarb)
    expect(EVENT_GetNextEventFrame113c(m, pBarb, 11)).toBe(130)

    // `PLAYER_DrainRunStamina113c` (`0x6FC97BB0`) exhaustion return (`0` + clamp to `0`)
    STATLIST_SetUnitStat113c(m, pBarb, 10, 30, 0)
    expect(PLAYER_DrainRunStamina113c(m, pBarb)).toBe(0)
    expect(STATLIST_GetUnitStat113c(m, pBarb, 10, 0)).toBe(0)
    STATLIST_SetUnitStat113c(m, pBarb, 10, 970, 0)

    // `ITEMS_RollItemDurabilityLoss113c` (`0x6FC32EE0`) & `SUNITDMG_DrainItemDurability113c` (`0x6FCFEBA0`):
    // Seeding `pBarb->pSeed = {lo=0, hi=2}` forces `roll(100) == 2`:
    //   - weapon (`threshold = 4`): `2 < 4` -> loses 1 durability (`10 -> 9`)
    //   - throwing weapon (`#10711` `0x6FD74C30`, e.g. Javelin `classId = 46`, `jav`, with `bNoDurability` cleared):
    //     non-expansion returns without rolling; expansion raises `threshold` to `10` (`roll(100) == 7 < 10`)
    //   - armor (`threshold = 10`): `2 < 10` -> loses 1 durability (`2 -> 1`, then `1 -> 0` + `ITEMFLAG_BROKEN = 0x100`)
    UNITS_SetSeed113c(m, pBarb, 0, 2)
    ITEMS_RollItemDurabilityLoss113c(world, pBarb, pAxe)
    expect(STATLIST_GetUnitStat113c(m, pAxe, 72, 0)).toBe(9)
    const pJav = UNITS_Create113c(m, UNIT_ITEM, 46, 103, world.pGame) // Javelin (`jav`, `Throws = 1`)
    expect(ITEMS_CheckIfThrowItem113c(m, pJav)).toBe(1)
    STATLIST_CreateEx113c(m, pJav, 0, world.pGame)
    STATLIST_SetUnitStat113c(m, pJav, 72, 5, 0)
    STATLIST_SetUnitStat113c(m, pJav, 73, 5, 0)
    m.set(world.pGame, D2GameStrc.bExpansion, 0)
    UNITS_SetSeed113c(m, pBarb, 0, 7)
    ITEMS_RollItemDurabilityLoss113c(world, pBarb, pJav)
    expect(UNITS_GetSeed113c(m, pBarb)).toEqual({ lo: 0, hi: 7 }) // no seed roll in Classic!
    m.set(world.pGame, D2GameStrc.bExpansion, 1)
    ITEMS_RollItemDurabilityLoss113c(world, pBarb, pJav)
    expect(STATLIST_GetUnitStat113c(m, pJav, 72, 0)).toBe(4) // `7 < 10` loses 1 durability in Expansion!
    // `pBarb->pSeed = {0, 0}`: 3 draws (`roll(7) == 0`, `roll(5) == 0`, `roll(100) == 0 < 10`) -> selects `pArmor` (`BODYLOC_TORSO = 3`) and drains 1 durability
    UNITS_SetSeed113c(m, pBarb, 0, 0)
    SUNITDMG_DrainItemDurability113c(world, 0, pBarb)
    expect(STATLIST_GetUnitStat113c(m, pArmor, 72, 0)).toBe(1)
    UNITS_SetSeed113c(m, pBarb, 0, 0)
    SUNITDMG_DrainItemDurability113c(world, 0, pBarb)
    expect(STATLIST_GetUnitStat113c(m, pArmor, 72, 0)).toBe(0)
    expect((m.u32(pArmorData + 0x18) & 0x100) !== 0).toBe(true) // ITEMFLAG_BROKEN set!
    m.setU32(pArmorData + 0x18, 0)
    STATLIST_SetUnitStat113c(m, pArmor, 72, 20, 0)
    STATLIST_SetUnitStat113c(m, pAxe, 72, 28, 0)

    // Unmapped C2S `clientId` throws explicitly in `stepFallenSliceFrame113c`:
    expect(() => stepFallenSliceFrame113c(world, [[99, '06010000000c000000']])).toThrow(
      'Unmapped C2S clientId 99',
    )

    // 4. `AI_Stall113c` (`arg14 === 0`), `AiFallen113c` (`pRoom === 0` early return), and `AiZombie113c` (`hcIdx = 1`) + `AI_IdleWander113c`:
    const pZombie = UNITS_Create113c(m, UNIT_MONSTER, 1, 50, world.pGame) // Zombie1 (`hcIdx = 1`)
    STATLIST_CreateEx113c(m, pZombie, 0, world.pGame)
    STATLIST_SetUnitStat113c(m, pZombie, 12, 1, 0)
    STATLIST_SetUnitStat113c(m, pZombie, 31, 5, 0) // AC = 5 -> Barb (AR 85) vs AC 5 = 94% hit chance!
    const pZData = m.alloc(D2MonsterDataStrc_SIZE)
    const pZAiGen = m.alloc(D2AiGeneralStrc_SIZE)
    const pZAiCtrl = m.alloc(D2AiControlStrc_SIZE)
    m.set(pZAiGen, D2AiGeneralStrc.pfnThink, VA_AI_ZOMBIE_113C)
    m.set(pZData, D2MonsterDataStrc.pAiGeneral, pZAiGen)
    m.set(pZData, D2MonsterDataStrc.pAiControl, pZAiCtrl)
    m.set(pZombie, D2UnitStrc.pUnitData, pZData)
    m.set(pZombie, D2UnitStrc.dwAnimMode, 1)
    UNITS_SetSeed113c(m, pZombie, 0x11223344, 0x55667788)
    attachUnitPathInWorld113c(world, pZombie, pRoom, 5060, 5060)

    expect(SUNITDMG_ComputeHitChance113c(m, world.pGame, pBarb, pZombie)).toBe(94)

    AI_Stall113c(world, pZombie, 7)
    const stallEv = m.get(pZombie, D2UnitStrc.pEventFirst)
    expect(m.get(stallEv, D2EventStrc.dwFrame)).toBe(107)
    expect(m.get(stallEv, D2EventStrc.dwArg14)).toBe(0)
    expect(m.get(stallEv, D2EventStrc.dwArg18)).toBe(0)

    // `AI_IdleWander113c` walks (`mode = 2`) and increments `dwMonSpawnCount[2]` / `dwMonSpawnTotal`:
    expect(AI_IdleWander113c(world, pZombie, 3)).toBe(true)
    expect(m.get(pZombie, D2UnitStrc.dwAnimMode)).toBe(2)
    expect(m.get(world.pGame, D2GameStrc.dwMonSpawnTotal)).toBeGreaterThan(0)

    // `AiZombie113c` with `dwAlwaysChaseField = 3` chases player in `RN (15)` with `+100` velocity override:
    m.set(pZombie, D2UnitStrc.dwAnimMode, 1)
    m.set(pZData, D2MonsterDataStrc.dwAlwaysChaseField, 3)
    runMonsterAiDriver113c(world, pZombie, VA_AI_ZOMBIE_113C)
    expect(m.get(pZombie, D2UnitStrc.dwAnimMode)).toBe(15)
    expect(m.u32(pZAiCtrl + 0x10)).toBe(100)

    // `AiZombie113c` in melee range triggers `A1 (4)` or `A2 (5)`:
    m.set(pZombie, D2UnitStrc.dwAnimMode, 1)
    UNITS_SetSeed113c(m, pZombie, 1, 1)
    AiZombie113c(world, pZombie, pBarb, 1, true)
    expect([1, 4, 5]).toContain(m.get(pZombie, D2UnitStrc.dwAnimMode))

    // `AiFallen113c` returns immediately when `pRoom == 0` (`0x6FCA318D`) without scheduling stall events:
    const pRoomlessFallen = UNITS_Create113c(m, UNIT_MONSTER, 19, 51, world.pGame)
    const pFData = m.alloc(D2MonsterDataStrc_SIZE)
    const pFAiGen = m.alloc(D2AiGeneralStrc_SIZE)
    m.set(pFData, D2MonsterDataStrc.pAiGeneral, pFAiGen)
    m.set(pRoomlessFallen, D2UnitStrc.pUnitData, pFData)
    m.set(pRoomlessFallen, D2UnitStrc.dwAnimMode, 2) // non-NU, would call AI_Stall if not returned at pRoom==0!
    AiFallen113c(world, pRoomlessFallen, pBarb, 5, false)
    expect(m.get(pRoomlessFallen, D2UnitStrc.pEventFirst)).toBe(0)
  })
})

describe('Pure src/d2kern-113c Fallen encounter slice (F785 -> F825, zero src/server/ imports)', () => {
  it('matches real D2Game.dll ord tuples, golden unit states/seeds/stats/dmg, and key F801/F820/F821 unit/path/AI/event/death-ring struct fields across all 40 frames', () => {
    const f785Snap = readNdjsonGz<MemdumpSnapshot113c>(join(ROUTE2_DIR, 'a1c-memdump-f785.ndjson.gz'))[0]!
    const collRaw = new Uint8Array(gunzipSync(readFileSync(join(ROUTE2_DIR, 'a1c-coll-f785.bin.gz'))))
    const ordByFrame = new Map<number, readonly OrdEventTuple113c[]>()
    for (const rec of readNdjsonGz<{ readonly frame: number; readonly ord: readonly OrdEventTuple113c[] }>(
      join(ROUTE2_DIR, 'a1c-ord-f785.ndjson.gz'),
    )) {
      ordByFrame.set(rec.frame, rec.ord)
    }
    const goldenByFrame = new Map<number, GoldenFrameRecord>()
    for (const rec of readNdjsonGz<GoldenFrameRecord>(GOLDEN_PATH)) {
      if (rec.frame !== undefined && rec.frame >= 785 && rec.frame <= 825) {
        goldenByFrame.set(rec.frame, rec)
      }
    }
    const memdumpsByFrame = new Map<number, MemdumpSnapshot113c>()
    for (const snap of readNdjsonGz<MemdumpSnapshot113c>(join(ROUTE2_DIR, 'a1c-memdump-f820.ndjson.gz'))) {
      memdumpsByFrame.set(snap.frame, snap)
    }

    const m = new SparseMemory113c()
    const world = hydrateFallenSliceFromMemdump113c(m, f785Snap, collRaw)

    let f790PersistentIdsBefore: number[] = []
    let f821PersistentIdsBefore: number[] = []
    const f821SlotEventsBefore: Array<{ unitId: number; evType: number; frame: number }> = []

    for (let f = 786; f <= 825; f++) {
      if (f === 790 || f === 821) {
        const pIds: number[] = []
        for (
          let n = m.get(world.pTimer, D2TimerStrc.pPersistentHead, 1);
          n !== 0;
          n = m.get(n, D2EventStrc.pWheelNewer)
        ) {
          pIds.push(m.get(n, D2EventStrc.dwUnitId))
        }
        if (f === 790) f790PersistentIdsBefore = pIds
        if (f === 821) {
          f821PersistentIdsBefore = pIds
          const slot = 1 * 64 + (821 & 63)
          for (
            let n = m.get(world.pTimer, D2TimerStrc.pSlotTail, slot);
            n !== 0;
            n = m.get(n, D2EventStrc.pWheelNewer)
          ) {
            f821SlotEventsBefore.push({
              unitId: m.get(n, D2EventStrc.dwUnitId),
              evType: m.get(n, D2EventStrc.nType),
              frame: m.get(n, D2EventStrc.dwFrame),
            })
          }
        }
      }

      const gRec = goldenByFrame.get(f)!
      stepFallenSliceFrame113c(world, gRec.in ?? [])

      // 1. Exact monster event dispatch order (`[phase, evType, unitType, unitId, animMode]`)
      expect(world.lastFrameOrd, `ord mismatch at F${f}`).toEqual(ordByFrame.get(f))

      // 2. Exact melee damage record (`F801` ret=1022 killing #12, `F816` ret=1506 on dying #12)
      expect(world.lastFrameDmg, `dmg mismatch at F${f}`).toEqual(
        (gRec.dmg ?? []).map(({ att, def, ret }) => ({ att, def, ret })),
      )

      // 3. Player 0:1 exact position, mode, LCG seed, HP, mana, stamina, XP
      const pPlayer = world.playerById.get(1)!
      const gP = gRec.t0[0]!
      const pPos = getUnitPosSubtile113c(m, pPlayer)
      const pSeed = UNITS_GetSeed113c(m, pPlayer)
      expect(
        {
          mode: m.get(pPlayer, D2UnitStrc.dwAnimMode),
          x: pPos.x,
          y: pPos.y,
          seedLo: pSeed.lo,
          seedHi: pSeed.hi,
          hp: STATLIST_GetUnitStat113c(m, pPlayer, 6, 0),
          mana: STATLIST_GetUnitStat113c(m, pPlayer, 8, 0),
          stam: STATLIST_GetUnitStat113c(m, pPlayer, 10, 0),
          xp: STATLIST_GetUnitStat113c(m, pPlayer, 13, 0),
        },
        `player 0:1 mismatch at F${f}`,
      ).toEqual({
        mode: gP[2],
        x: gP[3],
        y: gP[4],
        seedLo: gP[5],
        seedHi: gP[6],
        hp: gP[12],
        mana: gP[14],
        stam: gP[16],
        xp: gP[19],
      })

      // 4. All 7 monsters `1:9..15` exact mode, subtile `(x, y)`, LCG `(seedLo, seedHi)`, and `hp`
      for (const gM of gRec.t1) {
        const monId = gM[0]!
        const pMon = world.monsterById.get(monId)!
        const mPos = getUnitPosSubtile113c(m, pMon)
        const mSeed = UNITS_GetSeed113c(m, pMon)
        expect(
          {
            id: monId,
            mode: m.get(pMon, D2UnitStrc.dwAnimMode),
            x: mPos.x,
            y: mPos.y,
            seedLo: mSeed.lo,
            seedHi: mSeed.hi,
            hp: STATLIST_GetUnitStat113c(m, pMon, 6, 0),
          },
          `monster 1:${monId} mismatch at F${f}`,
        ).toEqual({
          id: monId,
          mode: gM[2],
          x: gM[3],
          y: gM[4],
          seedLo: gM[5],
          seedHi: gM[6],
          hp: gM[12],
        })
      }

      // 5. Full struct parity against `a1c-memdump-f820.ndjson.gz` (`F801`, `F820`, `F821`)
      const dump = memdumpsByFrame.get(f)
      if (dump) {
        for (const uDump of dump.mem) {
          const uLabel = `F${f} ${uDump.type}:${uDump.id}`
          const pUnit = world.unitsByKey.get(`${uDump.type}:${uDump.id}`)!

          // (a) `D2UnitStrc`: mode, flags, flags2, anim frame counters (+0x40..+0x4E), seed
          const unitBlk = uDump.blocks.find((b) => b.n === 'unit')!
          const rawUnit = Buffer.from(unitBlk.h, 'hex')
          expect(
            {
              dwAnimMode: m.get(pUnit, D2UnitStrc.dwAnimMode),
              seedLo: m.get(pUnit, D2UnitStrc.seedLo),
              seedHi: m.get(pUnit, D2UnitStrc.seedHi),
              dwFrame40: m.u32(pUnit + 0x40),
              dwFrame44: m.u32(pUnit + 0x44),
              dwFrameCount48: m.u32(pUnit + 0x48),
              wAnimSpeed: m.get(pUnit, D2UnitStrc.wAnimSpeed),
              wActionFrame: m.get(pUnit, D2UnitStrc.wActionFrame),
              dwFlags: m.get(pUnit, D2UnitStrc.dwFlags),
              dwFlags2: m.get(pUnit, D2UnitStrc.dwFlags2),
            },
            `${uLabel} D2UnitStrc`,
          ).toEqual({
            dwAnimMode: rawUnit.readUInt32LE(0x10),
            seedLo: rawUnit.readUInt32LE(0x20),
            seedHi: rawUnit.readUInt32LE(0x24),
            dwFrame40: rawUnit.readUInt32LE(0x40),
            dwFrame44: rawUnit.readUInt32LE(0x44),
            dwFrameCount48: rawUnit.readUInt32LE(0x48),
            wAnimSpeed: rawUnit.readUInt16LE(0x4c),
            wActionFrame: rawUnit.readUInt16LE(0x4e),
            dwFlags: rawUnit.readUInt32LE(0xc4),
            dwFlags2: rawUnit.readUInt32LE(0xc8),
          })

          // (b) `D2DynamicPathStrc`: precision coords, target coords, pathType, velocity, direction, distMax, stepNum
          const pathBlk = uDump.blocks.find((b) => b.n === 'path')
          if (pathBlk) {
            const rawPath = Buffer.from(pathBlk.h, 'hex')
            const pPath = m.get(pUnit, D2UnitStrc.pPath)
            expect(
              {
                dwPrecisionX: m.u32(pPath + 0x00),
                dwPrecisionY: m.u32(pPath + 0x04),
                wTargetX: m.get(pPath, D2DynamicPathStrc.wTargetX),
                wTargetY: m.get(pPath, D2DynamicPathStrc.wTargetY),
                dwPathType: m.get(pPath, D2DynamicPathStrc.dwPathType),
                nDirection: m.get(pPath, D2DynamicPathStrc.nDirection),
                dwVelocity: m.get(pPath, D2DynamicPathStrc.dwVelocity),
                nDistMax: m.get(pPath, D2DynamicPathStrc.nDistMax),
                nStepNum: m.get(pPath, D2DynamicPathStrc.nStepNum),
              },
              `${uLabel} D2DynamicPathStrc`,
            ).toEqual({
              dwPrecisionX: rawPath.readUInt32LE(0x00),
              dwPrecisionY: rawPath.readUInt32LE(0x04),
              wTargetX: rawPath.readUInt16LE(0x10),
              wTargetY: rawPath.readUInt16LE(0x12),
              dwPathType: rawPath.readUInt32LE(0x3c),
              nDirection: rawPath.readUInt8(0x64),
              dwVelocity: rawPath.readUInt32LE(0x7c),
              nDistMax: rawPath.readUInt8(0x91),
              nStepNum: rawPath.readUInt8(0x93),
            })
          }

          // (c) Monster structs: `D2MonsterDataStrc`, `D2AiGeneralStrc`, `D2AiControlStrc`
          if (uDump.type === UNIT_MONSTER) {
            const dataBlk = uDump.blocks.find((b) => b.n === 'data')!
            const rawData = Buffer.from(dataBlk.h, 'hex')
            const pMonData = m.get(pUnit, D2UnitStrc.pUnitData)
            expect(
              {
                field50: m.u32(pMonData + 0x50),
                dwAlwaysChaseField: m.get(pMonData, D2MonsterDataStrc.dwAlwaysChaseField),
              },
              `${uLabel} D2MonsterDataStrc`,
            ).toEqual({
              field50: rawData.readUInt32LE(0x50),
              dwAlwaysChaseField: rawData.readUInt32LE(0x54),
            })

            const aiGenBlk = uDump.blocks.find((b) => b.n === 'aigeneral')!
            const rawAiGen = Buffer.from(aiGenBlk.h, 'hex')
            const pAiGen = m.get(pMonData, D2MonsterDataStrc.pAiGeneral)
            expect(
              {
                dwFlags: m.get(pAiGen, D2AiGeneralStrc.dwFlags),
                bAfraid: m.get(pAiGen, D2AiGeneralStrc.bAfraid),
                dwLeaderId: m.get(pAiGen, D2AiGeneralStrc.dwLeaderId),
                dwLeaderType: m.get(pAiGen, D2AiGeneralStrc.dwLeaderType),
              },
              `${uLabel} D2AiGeneralStrc`,
            ).toEqual({
              dwFlags: rawAiGen.readUInt32LE(0x08),
              bAfraid: rawAiGen.readUInt32LE(0x14),
              dwLeaderId: rawAiGen.readUInt32LE(0x2c),
              dwLeaderType: rawAiGen.readUInt32LE(0x30),
            })

            const aiCtrlBlk = uDump.blocks.find((b) => b.n === 'aicontrol')!
            const rawAiCtrl = Buffer.from(aiCtrlBlk.h, 'hex')
            const pAiCtrl = m.get(pMonData, D2MonsterDataStrc.pAiControl)
            expect(
              {
                pTarget: m.u32(pAiCtrl + 0x04),
                targetX: m.u32(pAiCtrl + 0x08),
                targetY: m.u32(pAiCtrl + 0x0c),
                velApplied: m.u32(pAiCtrl + 0x10),
                chaseSteps: m.u32(pAiCtrl + 0x14),
                ptOv: m.u32(pAiCtrl + 0x18),
                velOv: m.u32(pAiCtrl + 0x1c),
                distOv: m.u8(pAiCtrl + 0x20),
              },
              `${uLabel} D2AiControlStrc`,
            ).toEqual({
              pTarget: rawAiCtrl.readUInt32LE(0x04),
              targetX: rawAiCtrl.readUInt32LE(0x08),
              targetY: rawAiCtrl.readUInt32LE(0x0c),
              velApplied: rawAiCtrl.readUInt32LE(0x10),
              chaseSteps: rawAiCtrl.readUInt32LE(0x14),
              ptOv: rawAiCtrl.readUInt32LE(0x18),
              velOv: rawAiCtrl.readUInt32LE(0x1c),
              distOv: rawAiCtrl.readUInt8(0x20),
            })
          }

          // (d) Full `pUnit->pEventFirst` `D2EventStrc` chain (`nType`, `fFlags`, `dwFrame`, `dwArg14 === 0`, `dwArg18`)
          const dumpEvents = uDump.blocks
            .filter((b) => b.n === 'event')
            .map((b) => {
              const rawEv = Buffer.from(b.h, 'hex')
              return {
                nType: rawEv.readUInt8(0x00),
                fFlags: rawEv.readUInt8(0x02),
                dwFrame: rawEv.readUInt32LE(0x04),
                dwUnitId: rawEv.readUInt32LE(0x0c),
                dwUnitType: rawEv.readUInt32LE(0x10),
                dwArg14: rawEv.readUInt32LE(0x14),
                dwArg18: rawEv.readUInt32LE(0x18),
              }
            })
          const actualEvents = []
          for (
            let evPtr = m.get(pUnit, D2UnitStrc.pEventFirst);
            evPtr !== 0;
            evPtr = m.get(evPtr, D2EventStrc.pUnitNext)
          ) {
            const arg14 = m.get(evPtr, D2EventStrc.dwArg14)
            expect(arg14, `${uLabel} event dwArg14 must be 0`).toBe(0)
            actualEvents.push({
              nType: m.get(evPtr, D2EventStrc.nType),
              fFlags: m.get(evPtr, D2EventStrc.fFlags),
              dwFrame: m.get(evPtr, D2EventStrc.dwFrame),
              dwUnitId: m.get(evPtr, D2EventStrc.dwUnitId),
              dwUnitType: m.get(evPtr, D2EventStrc.dwUnitType),
              dwArg14: arg14,
              dwArg18: m.get(evPtr, D2EventStrc.dwArg18),
            })
          }
          expect(actualEvents, `${uLabel} D2EventStrc chain`).toEqual(dumpEvents)

          // (e) `D2ActiveRoomStrc` death ring (`bDeathRingIdx` + `dwDeathRing[0..3]`)
          const roomBlk = uDump.blocks.find((b) => b.n === 'room')
          if (roomBlk) {
            const rawRoom = Buffer.from(roomBlk.h, 'hex')
            const pPath = m.get(pUnit, D2UnitStrc.pPath)
            const pRoom = m.get(pPath, D2DynamicPathStrc.pRoom)
            expect(
              {
                bDeathRingIdx: m.get(pRoom, D2ActiveRoomStrc.bDeathRingIdx),
                dwDeathRing: [
                  m.get(pRoom, D2ActiveRoomStrc.dwDeathRing, 0),
                  m.get(pRoom, D2ActiveRoomStrc.dwDeathRing, 1),
                  m.get(pRoom, D2ActiveRoomStrc.dwDeathRing, 2),
                  m.get(pRoom, D2ActiveRoomStrc.dwDeathRing, 3),
                ],
              },
              `${uLabel} D2ActiveRoomStrc death ring`,
            ).toEqual({
              bDeathRingIdx: rawRoom.readUInt8(0x14),
              dwDeathRing: [
                rawRoom.readUInt32LE(0x38),
                rawRoom.readUInt32LE(0x3c),
                rawRoom.readUInt32LE(0x40),
                rawRoom.readUInt32LE(0x44),
              ],
            })
          }
        }
      }
    }

    // Explicit F790 & F821 milestone assertions (`§4.1`):
    expect(f790PersistentIdsBefore).toEqual([12, 14, 15])
    expect(ordByFrame.get(790)).toEqual([
      [2, 0, 1, 12, 2],
      [2, 0, 1, 14, 2],
      [2, 0, 1, 15, 2],
    ])
    expect(f821PersistentIdsBefore).toEqual([15, 14, 13])
    expect(f821SlotEventsBefore).toEqual([{ unitId: 12, evType: 1, frame: 821 }])
    expect(ordByFrame.get(821)).toEqual([
      [2, 0, 1, 15, 2],
      [2, 0, 1, 14, 2],
      [2, 0, 1, 13, 2],
      [1, 1, 1, 12, 0],
    ])
    const pMon12 = world.monsterById.get(12)!
    const pMon13 = world.monsterById.get(13)!
    expect(m.get(pMon12, D2UnitStrc.dwAnimMode)).toBe(12)
    expect(m.get(m.get(pMon13, D2UnitStrc.pPath), D2DynamicPathStrc.dwVelocity)).toBe(1600)
  })
})
