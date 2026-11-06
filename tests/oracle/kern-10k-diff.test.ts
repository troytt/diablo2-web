/**
 * K0 Phase 0 Gate #4: 10,000+ Stateful Real-DLL Differential Suite (`0` Errors).
 *
 * Every single case counted in this suite is an independent, 100%-deduplicated ground-truth
 * record captured directly from original Diablo II v1.13c `D2Common.dll` + `D2Game.dll`
 * (zero synthetic padding, zero duplicate tuples, zero harness-written zeros, zero `src/server/` imports):
 *   1. `m` (`mulDiv113c`): `2,500` unique `(factor, value, divisor)` tuples verified against both
 *      `D2Common 0x6FD511E0` and `D2Game 0x6FC214D0`.
 *   2. `s` (`D2StatListEx` `SNAP_CALL` op 200): `3,600` unique live `STATLIST_SetUnitStat` /
 *      `STATLIST_GetUnitStat` unit snapshots across all 7 classes `0..6`, levels `1..99`,
 *      `bKeepZero`, `fMin`, `0x6FD89DEA` carrier suppression, and `op 1/2/8/9/11`.
 *   3. `l` (`MULTILIST_STAT_CALL` op 201): `1,500` unique live `D2Common.dll` multi-sub-list &
 *      equipped-item merge snapshots (`100%` with real item `it.length > 0`, unmodified
 *      `ItemStatCost.bin` op rows `1, 2, 4, 5, 6, 7, 8, 9, 11, 13`, and `removeMask 0..7`).
 *   4. `t` (`STATES_SEQ_CALL` op 202): `2,000` unique multi-step stateful `D2Common.dll` state
 *      sequences (`0x6FD88730` `STATES_ToggleState`, `0x6FD83C20` `unit+0xC8` `0x08` disguise mask
 *      across `{63, 93, 119, 139, 140, 176, 177}`, `#10494` `0x6FD83CD0` `STATES_CheckState`,
 *      `pStatListEx == NULL` no-op, unit types `0..5`, and OOB indices).
 *   5. `e` (`EVENT_TIMER_SEQ_CALL` op 203): `3,000` unique multi-operation stateful `D2TimerStrc`
 *      sequences (`6..15` `D2Game.dll` timer calls + `1..70` `EVENT_UpdateTimers` frames firing
 *      real callbacks, exercising `0x6FCAEA80` `EVENT_SetEvent` with monster `state 0x36` -> `0x6FD02240`,
 *      `0x6FCAE810` `EVENT_SetPersistentEvent`, `0x6FD00750` 2-pass `MONSTER_ClearModeEvents` on
 *      coexisting `type 0 + 1` with 12-deep `freeTop` free-list order, `0x6FCAE8C0` `EVENT_DeleteEventByType`,
 *      `0x6FCAE900` `EVENT_DeleteEventByArg14`, `0x6FCAE880` `EVENT_RemoveUnitEvents`, `0x6FCAE490`
 *      `EVENT_GetNextEventFrame`, and re-entrant callback mutations).
 *   6. `u` (`SUNIT_UNITROOM_CALL` op 204): `500` unique server unit hash & spatial room records
 *      (`0x6FCFF9C0`, `0x6FD00310`, `0x6FD003A0`, `0x6FD002A0`, `0x6FD51050`, `0x6FD51080`,
 *      `#10531` `0x6FDB6800`, `#10158` `0x6FDB65C0`, `#11016` `0x6FDB6700`).
 *   7. Live-game `fnrec` (`94` `EVENT_SetEvent` + `194` non-noop `a1c-fnrec-k0`) + `256` `D2TV`
 *      multi-frame DLL scenarios (`45,101` fired events).
 *
 * Stateful DLL records alone (`s + l + t + e + u`) = `10,600` (`> 10,000` before `mulDiv`, `fnrec`, or `D2TV`).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  D2ActiveRoomStrc,
  D2ActiveRoomStrc_SIZE,
  D2ActStrc,
  D2ActStrc_SIZE,
  D2DynamicPathStrc,
  D2EnvironmentStrc,
  D2EnvironmentStrc_SIZE,
  D2EventStrc,
  D2GameStrc,
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
  MONSTER_ClearModeEvents113c,
  mulDiv113c,
  SparseMemory113c,
  STATES_CheckState113c,
  STATES_CheckStateMaskOnUnit113c,
  STATES_ClearGfxStateFlag113c,
  STATES_COUNT_113C,
  STATES_ToggleGfxStateFlag113c,
  STATES_ToggleState113c,
  STATLIST_AllocList113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_MergeStatLists113c,
  STATLIST_SetStat113c,
  STATLIST_SetUnitStat113c,
  STATLIST_UnlinkSubList113c,
  SUNIT_GetNewUnitId113c,
  SUNIT_GetServerUnit113c,
  SUNIT_InsertServerUnit113c,
  SUNIT_RemoveServerUnit113c,
  UNIT_ITEM,
  UNIT_MONSTER,
  UNIT_OBJECT,
  UNIT_PLAYER,
  UNIT_TILE,
  UNITROOM_AddUnitToRoom113c,
  UNITROOM_ClearUpdateQueue113c,
  UNITROOM_RefreshUnit113c,
  UNITROOM_RemoveUnitFromRoom113c,
  UNITS_Create113c,
  UNITS_GetRoom113c,
  UNITS_GetX113c,
  UNITS_GetY113c,
  UNITS_InitPath113c,
  type EventWheelHooks113c,
} from '../../src/d2kern-113c/index.ts'
import {
  KERN_10K_FIXTURE_PATH,
  KERN_10K_ML_QITEM_STATS,
  KERN_10K_ML_QSTATS,
  KERN_10K_QSTATS,
  STATE_MASKS_113C,
  type EventTimerSeqDiffRecord113c,
  type Kern10kDiffRecord113c,
  type MulDivDiffRecord113c,
  type MultilistDiffRecord113c,
  type StatSnapDiffRecord113c,
  type StateSeqDiffRecord113c,
  type SunitRoomDiffRecord113c,
} from '../../tools/oracle/collect-kern-10k-diff.ts'
import { TrackedMemory113c } from '../../tools/oracle/fn-snapshot-runner.ts'
import { replayFile } from '../../tools/oracle/route2-replay.mts'
import { verifyEventWheelVectors } from '../../tools/oracle/vectors/eventwheel-vector.ts'

const REPO = join(import.meta.dirname, '..', '..')
const FNREC_SETEVENT_PATH = join(
  REPO,
  'tests/fixtures/oracle/route2/a1c-fnrec-setevent-f700.ndjson.gz',
)
const FNREC_K0_MULTI_PATH = join(
  REPO,
  'tests/fixtures/oracle/route2/a1c-fnrec-k0.ndjson.gz',
)
const EVTWHEEL_D2TV_PATH = join(REPO, 'tools/oracle/vectors/eventwheel-113c.d2tv')

function loadKern10kRecords(): { rawLines: string[]; records: Kern10kDiffRecord113c[] } {
  const raw = gunzipSync(readFileSync(KERN_10K_FIXTURE_PATH)).toString('utf8')
  const rawLines = raw.split('\n').filter((l) => l.trim().length > 0)
  return {
    rawLines,
    records: rawLines.map((l) => JSON.parse(l) as Kern10kDiffRecord113c),
  }
}

export function assertAllWritesInAllocatedStructs113c(
  m: TrackedMemory113c,
  label: string,
): void {
  for (const addr of m.writtenAddrs) {
    let ok = false
    for (const [lo, hi] of m.allocRanges) {
      if (addr >= lo && addr < hi) {
        ok = true
        break
      }
    }
    if (!ok) {
      throw new Error(
        `[${label}] Rogue write outside allocated struct ranges at 0x${(addr >>> 0).toString(16)}`,
      )
    }
  }
}

export interface StatesSeqEvalResult113c {
  readonly hasStatList: 0 | 1
  readonly unitFlags: number
  readonly unitFlags2: number
  readonly actFlag: number
  readonly roomUpdated: 0 | 1
  readonly stateFlags: [number, number, number, number, number, number]
  readonly gfxFlags: [number, number, number, number, number, number]
  readonly stepFlags2: number[]
  readonly checks: number[]
}

export function evalStatesSeq113c(
  r: StateSeqDiffRecord113c,
  mutateMode: 'none' | 'omitFlags2' | 'unconditionalClear08' | 'rogueWrite' = 'none',
): StatesSeqEvalResult113c {
  const m = new TrackedMemory113c()
  const u = UNITS_Create113c(m, r.uType, 0, 9101)
  m.set(u, D2UnitStrc.dwFlags2, r.initFlags2 >>> 0)
  let actFlagPtr = 0
  let pRoom = 0
  if (r.hasRoom === 1) {
    actFlagPtr = m.alloc(4)
    pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
    m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, actFlagPtr)
    m.set(pRoom, D2ActiveRoomStrc.dwFlags, (r.roomFlags ?? 0) >>> 0)
    UNITS_InitPath113c(m, u, 5010, 5010, pRoom)
  } else {
    UNITS_InitPath113c(m, u, 5010, 5010, 0)
  }
  if (r.noStatList === 0) {
    STATLIST_CreateEx113c(m, u, 0)
  }

  const stepFlags2: number[] = []
  const checks: number[] = []
  const disguiseSet = new Set([63, 93, 119, 139, 140, 176, 177])

  for (let s = 0; s + 2 < r.steps.length; s += 3) {
    const kind = r.steps[s]!
    const sid = r.steps[s + 1]!
    const arg = r.steps[s + 2]!
    if (kind === 0) {
      const beforeFlags2 = m.get(u, D2UnitStrc.dwFlags2) >>> 0
      STATES_ToggleState113c(m, u, sid, arg !== 0)
      if (mutateMode === 'omitFlags2') {
        m.set(u, D2UnitStrc.dwFlags2, beforeFlags2)
      } else if (mutateMode === 'unconditionalClear08' && arg === 0 && disguiseSet.has(sid)) {
        // Buggy implementation that clears 0x08 without checking if another disguise state is still active
        m.set(u, D2UnitStrc.dwFlags2, (m.get(u, D2UnitStrc.dwFlags2) & ~0x08) >>> 0)
      }
      stepFlags2.push(m.get(u, D2UnitStrc.dwFlags2) >>> 0)
    } else if (kind === 1) {
      STATES_ClearGfxStateFlag113c(m, u, sid, arg)
    } else if (kind === 2) {
      checks.push(STATES_CheckState113c(m, u, sid) | 0)
    } else if (kind === 3) {
      const beforeFlags2 = m.get(u, D2UnitStrc.dwFlags2) >>> 0
      STATES_ToggleGfxStateFlag113c(m, u, sid, arg)
      if (mutateMode === 'omitFlags2') {
        m.set(u, D2UnitStrc.dwFlags2, beforeFlags2)
      } else if (mutateMode === 'unconditionalClear08' && arg === 0 && disguiseSet.has(sid)) {
        m.set(u, D2UnitStrc.dwFlags2, (m.get(u, D2UnitStrc.dwFlags2) & ~0x08) >>> 0)
      }
      stepFlags2.push(m.get(u, D2UnitStrc.dwFlags2) >>> 0)
    } else if (kind === 4) {
      const maskWords = STATE_MASKS_113C[sid]
      checks.push(maskWords !== undefined ? STATES_CheckStateMaskOnUnit113c(m, u, maskWords) | 0 : 0)
    } else if (kind === 5) {
      if (pRoom !== 0) {
        UNITROOM_ClearUpdateQueue113c(m, pRoom)
      }
    }
  }

  if (mutateMode === 'rogueWrite') {
    m.setU32(0xdeadbee0, 1)
  }
  assertAllWritesInAllocatedStructs113c(m, 't')

  const pEx = m.get(u, D2UnitStrc.pStatListEx)
  const hasStatList: 0 | 1 = pEx !== 0 ? 1 : 0
  const stateFlags: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0]
  const gfxFlags: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0]
  if (pEx !== 0) {
    const pFlags = m.get(pEx, D2StatListExStrc.pStateFlags)
    if (pFlags !== 0) {
      for (let w = 0; w < 6; w++) {
        stateFlags[w] = m.u32(pFlags + w * 4) >>> 0
        gfxFlags[w] = m.u32(pFlags + (w + 6) * 4) >>> 0
      }
    }
  }

  const roomUpdated: 0 | 1 =
    pRoom !== 0 && m.get(pRoom, D2ActiveRoomStrc.pUpdateList) === u ? 1 : 0

  return {
    hasStatList,
    unitFlags: m.get(u, D2UnitStrc.dwFlags) >>> 0,
    unitFlags2: m.get(u, D2UnitStrc.dwFlags2) >>> 0,
    actFlag: actFlagPtr !== 0 ? m.u32(actFlagPtr) >>> 0 : 0,
    roomUpdated,
    stateFlags,
    gfxFlags,
    stepFlags2,
    checks,
  }
}

export interface EventTimerSeqEvalResult113c {
  readonly endFrame: number
  readonly u0State36: number
  readonly u6State36: number
  readonly u0State5C: number
  readonly u6State5C: number
  readonly u0Flags2: number
  readonly fired: [number, number, number, number, number, number][]
  readonly nextFrames: number[]
  readonly freeTop: number[]
  readonly u0Chain: [number, number, number, number][]
}

const EV_UNIT_TYPES = [1, 1, 0, 3, 2, 4, 1, 0] as const
const EV_UNIT_IDS = [101, 102, 201, 301, 401, 501, 103, 202] as const
const SENTINEL_CB_A = 0xcafe0001
const SENTINEL_CB_B = 0xcafe0002

export function evalEventTimerSeq113c(
  r: EventTimerSeqDiffRecord113c,
  mutateMode: 'none' | 'singlePassClear' | 'stubState36False' | 'rogueWrite' = 'none',
): EventTimerSeqEvalResult113c {
  const m = new TrackedMemory113c()
  const pGame = GAME_Create113c(m)
  m.set(pGame, D2GameStrc.dwGameFrame, r.initFrame >>> 0)

  const units: number[] = []
  for (let i = 0; i < 8; i++) {
    const u = UNITS_Create113c(m, EV_UNIT_TYPES[i]!, 0, EV_UNIT_IDS[i]!, pGame)
    if (i === 0 || i === 1 || i === 2 || i === 6) {
      STATLIST_CreateEx113c(m, u, 0, pGame)
    }
    units.push(u)
  }

  const stubHooks: EventWheelHooks113c | undefined =
    mutateMode === 'stubState36False'
      ? {
          checkState: () => false,
          onMonsterAiEventWithState36: () => {},
        }
      : undefined

  const clearModeEvents = (g: number, u: number): void => {
    if (mutateMode === 'singlePassClear') {
      let cur = m.get(u, D2UnitStrc.pEventFirst)
      while (cur !== 0) {
        const next = m.get(cur, D2EventStrc.pUnitNext)
        const t = m.get(cur, D2EventStrc.nType)
        if (t === 0 || t === 1) {
          EVENT_FreeNode113c(m, g, cur)
        }
        cur = next
      }
      return
    }
    MONSTER_ClearModeEvents113c(m, g, u)
  }

  const fired: [number, number, number, number, number, number][] = []
  const nextFrames: number[] = []

  for (let i = 0; i + 5 < r.ops.length; i += 6) {
    const cmd = r.ops[i]!
    const uIdx = r.ops[i + 1]!
    const p2 = r.ops[i + 2]!
    const p3 = r.ops[i + 3]!
    const p4 = r.ops[i + 4]! >>> 0
    const p5 = r.ops[i + 5]! >>> 0
    const u = uIdx >= 0 && uIdx < 8 ? units[uIdx]! : 0
    const cb = (p5 & 0x10000) !== 0 ? SENTINEL_CB_B : SENTINEL_CB_A
    const a18 = p5 & 0xffff

    if (cmd === 1) {
      if (p2 >= 0 && p2 < 15) {
        EVENT_SetEventFull113c(m, pGame, u, p2, p3 >>> 0, cb, p4, a18, stubHooks)
      }
    } else if (cmd === 2) {
      if (p2 >= 0 && p2 < 15) {
        EVENT_SetPersistentEventFull113c(m, pGame, u, p2, cb, p4, a18)
      }
    } else if (cmd === 3) {
      if (u !== 0) clearModeEvents(pGame, u)
    } else if (cmd === 4) {
      const dcb = p3 === 2 ? SENTINEL_CB_B : p3 === 1 ? SENTINEL_CB_A : 0
      if (u !== 0) EVENT_DeleteEventByType113c(m, pGame, u, p2, dcb)
    } else if (cmd === 5) {
      if (u !== 0) EVENT_DeleteEventByArg14_113c(m, pGame, u, p2, p3 >>> 0)
    } else if (cmd === 6) {
      if (u !== 0) EVENT_RemoveUnitEvents113c(m, pGame, u)
    } else if (cmd === 7) {
      if (
        u !== 0 &&
        m.get(u, D2UnitStrc.pStatListEx) !== 0 &&
        p2 >= 0 &&
        p2 < STATES_COUNT_113C
      ) {
        STATES_ToggleState113c(m, u, p2, p3 !== 0)
      }
    } else if (cmd === 8) {
      if (nextFrames.length < 64) {
        nextFrames.push(u !== 0 ? EVENT_GetNextEventFrame113c(m, u, p2) | 0 : 0)
      }
    } else if (cmd === 9) {
      const steps = Math.max(0, Math.min(80, p2 | 0))
      for (let s = 0; s < steps; s++) {
        m.set(pGame, D2GameStrc.dwGameFrame, (m.get(pGame, D2GameStrc.dwGameFrame) + 1) >>> 0)
        EVENT_UpdateTimers113c(m, pGame, (mem, g, unitPtr, evType, arg14, arg18, pfnHandler) => {
          if (pfnHandler !== SENTINEL_CB_A && pfnHandler !== SENTINEL_CB_B) return
          if (fired.length < 256) {
            fired.push([
              mem.get(g, D2GameStrc.dwGameFrame) >>> 0,
              evType | 0,
              unitPtr !== 0 ? mem.get(unitPtr, D2UnitStrc.dwUnitType) | 0 : -1,
              unitPtr !== 0 ? mem.get(unitPtr, D2UnitStrc.dwUnitId) >>> 0 : 0,
              arg14 | 0,
              arg18 | 0,
            ])
          }
          const uArg18 = arg18 >>> 0
          if ((uArg18 & 0xf000) === 0xa000) {
            const reCmd = (uArg18 >> 8) & 0x0f
            const reArg = uArg18 & 0xff
            if (reCmd === 1 && unitPtr !== 0) {
              EVENT_DeleteEventByType113c(mem, g, unitPtr, reArg & 0x0f, SENTINEL_CB_A)
            } else if (reCmd === 2 && unitPtr !== 0) {
              EVENT_DeleteEventByArg14_113c(
                mem,
                g,
                unitPtr,
                reArg & 0x0f,
                (reArg & 0x80) !== 0 ? arg14 >>> 0 : 0,
              )
            } else if (reCmd === 3 && unitPtr !== 0) {
              clearModeEvents(g, unitPtr)
            } else if (reCmd === 4 && unitPtr !== 0) {
              EVENT_RemoveUnitEvents113c(mem, g, unitPtr)
            } else if (reCmd === 5) {
              const delay = 1 + ((reArg >> 4) & 0x07)
              EVENT_SetEventFull113c(
                mem,
                g,
                unitPtr,
                reArg & 0x0f,
                (mem.get(g, D2GameStrc.dwGameFrame) + delay) >>> 0,
                SENTINEL_CB_A,
                ((arg14 >>> 0) + 1000) >>> 0,
                0,
                stubHooks,
              )
            }
          }
        })
      }
    } else if (cmd === 10) {
      if (u !== 0) {
        m.set(u, D2UnitStrc.pGame, p2 !== 0 ? pGame : 0)
      }
    }
  }

  if (mutateMode === 'rogueWrite') {
    m.setU32(0xdeadbee4, 1)
  }
  assertAllWritesInAllocatedStructs113c(m, 'e')

  const pTimer = m.get(pGame, D2GameStrc.pTimer)
  const chunk0 = pTimer !== 0 ? m.get(pTimer, D2TimerStrc.pPool) : 0
  const freeTop: number[] = []
  if (chunk0 !== 0) {
    let cur = m.u32(chunk0 + 0x7080)
    while (cur !== 0 && freeTop.length < 12) {
      if (cur >= chunk0 && cur < chunk0 + 0x7080) {
        freeTop.push(((cur - chunk0) / 0x30) | 0)
      } else {
        freeTop.push(-1)
      }
      cur = m.get(cur, D2EventStrc.pWheelNewer)
    }
  }

  const u0Chain: [number, number, number, number][] = []
  if (chunk0 !== 0) {
    let ev = m.get(units[0]!, D2UnitStrc.pEventFirst)
    while (ev !== 0 && u0Chain.length < 16) {
      const nidx = ev >= chunk0 && ev < chunk0 + 0x7080 ? ((ev - chunk0) / 0x30) | 0 : -1
      u0Chain.push([
        m.get(ev, D2EventStrc.nType) >>> 0,
        m.get(ev, D2EventStrc.dwFrame) >>> 0,
        m.get(ev, D2EventStrc.dwArg14) | 0,
        nidx,
      ])
      ev = m.get(ev, D2EventStrc.pUnitNext)
    }
  }

  return {
    endFrame: m.get(pGame, D2GameStrc.dwGameFrame) >>> 0,
    u0State36: STATES_CheckState113c(m, units[0]!, 0x36) | 0,
    u6State36: STATES_CheckState113c(m, units[6]!, 0x36) | 0,
    u0State5C: STATES_CheckState113c(m, units[0]!, 0x5c) | 0,
    u6State5C: STATES_CheckState113c(m, units[6]!, 0x5c) | 0,
    u0Flags2: m.get(units[0]!, D2UnitStrc.dwFlags2) >>> 0,
    fired,
    nextFrames,
    freeTop,
    u0Chain,
  }
}

export interface SunitRoomEvalResult113c {
  readonly nPlayers: number
  readonly actFlag: number
  readonly newIds: number[]
  readonly found: number[]
  readonly coords: number[]
  readonly roomUnits: number[]
  readonly roomUpdates: number[]
  readonly unitFlags: number[]
  readonly unitFlags2: number[]
  readonly unitHashNext: number[]
  readonly unitRooms: number[]
}

export function evalSunitRoom113c(
  r: SunitRoomDiffRecord113c,
  mutateMode: 'none' | 'rogueWrite' = 'none',
): SunitRoomEvalResult113c {
  const m = new TrackedMemory113c()
  const pGame = GAME_Create113c(m, { initTimerQueue: false })
  for (let i = 0; i < Math.min(6, r.initCounters.length); i++) {
    m.set(pGame, D2GameStrc.dwLastUnitId, r.initCounters[i]! >>> 0, i)
  }

  const actFlagPtr = m.alloc(4)
  const pRoom = m.alloc(D2ActiveRoomStrc_SIZE)
  m.set(pRoom, D2ActiveRoomStrc.pActUpdateFlag, actFlagPtr)
  m.set(pRoom, D2ActiveRoomStrc.dwFlags, r.roomFlags >>> 0)

  const nUnits = Math.min(8, Math.floor(r.units.length / 6))
  const units: number[] = []
  const ptrToIdx = new Map<number, number>()
  for (let i = 0; i < nUnits; i++) {
    const ut = r.units[i * 6]!
    const cid = r.units[i * 6 + 1]!
    const uid = r.units[i * 6 + 2]!
    const x = r.units[i * 6 + 3]!
    const y = r.units[i * 6 + 4]!
    const hasPath = r.units[i * 6 + 5]!
    const u = UNITS_Create113c(m, ut, cid, uid, pGame)
    m.set(u, D2UnitStrc.dwFlags2, (0x02 | (i << 4)) >>> 0)
    if (hasPath !== 0) {
      // Initialize `pPath->pRoom = pRoom` ONLY at unit setup (never inside `cmd === 6`)!
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
    ptrToIdx.set(u, i)
  }

  const mapPtr = (p: number): number => {
    if (p === 0) return -1
    return ptrToIdx.get(p) ?? -2
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

  const newIds: number[] = []
  const found: number[] = []
  const coords: number[] = []

  for (let i = 0; i + 3 < r.ops.length; i += 4) {
    const cmd = r.ops[i]!
    const a = r.ops[i + 1]!
    const b = r.ops[i + 2]!
    if (cmd === 1) {
      if (a >= 0 && a < 6 && newIds.length < 32) {
        newIds.push(SUNIT_GetNewUnitId113c(m, pGame, a) | 0)
      }
    } else if (cmd === 2) {
      if (a >= 0 && a < nUnits) {
        m.set(units[a]!, D2UnitStrc.pGameHashNext, 0)
        m.set(
          units[a]!,
          D2UnitStrc.dwFlags2,
          (m.get(units[a]!, D2UnitStrc.dwFlags2) | 0x02) >>> 0,
        )
        SUNIT_InsertServerUnit113c(m, pGame, units[a]!)
      }
    } else if (cmd === 3) {
      if (found.length < 64) {
        found.push(mapPtr(SUNIT_GetServerUnit113c(m, pGame, a >>> 0, b >>> 0)))
      }
    } else if (cmd === 4) {
      if (a >= 0 && a < nUnits) {
        SUNIT_RemoveServerUnit113c(m, pGame, units[a]!)
      }
    } else if (cmd === 5) {
      if (a >= 0 && a < nUnits && coords.length + 1 < 64) {
        coords.push(UNITS_GetX113c(m, units[a]!) | 0)
        coords.push(UNITS_GetY113c(m, units[a]!) | 0)
      }
    } else if (cmd === 6) {
      if (
        a >= 0 &&
        a < nUnits &&
        m.get(units[a]!, D2UnitStrc.pPath) !== 0 &&
        !inRoomList(units[a]!)
      ) {
        UNITROOM_AddUnitToRoom113c(m, units[a]!, pRoom)
      }
    } else if (cmd === 7) {
      if (a >= 0 && a < nUnits) {
        UNITROOM_RefreshUnit113c(m, units[a]!)
      }
    } else if (cmd === 8) {
      if (a >= 0 && a < nUnits && inRoomList(units[a]!)) {
        UNITROOM_RemoveUnitFromRoom113c(m, units[a]!)
      }
    } else if (cmd === 9) {
      if (b === 0) {
        UNITROOM_ClearUpdateQueue113c(m, pRoom)
      } else {
        m.set(pRoom, D2ActiveRoomStrc.dwFlags, b >>> 0)
      }
    }
  }

  if (mutateMode === 'rogueWrite') {
    m.setU32(0xdeadbee8, 1)
  }
  assertAllWritesInAllocatedStructs113c(m, 'u')

  const roomUnits: number[] = []
  for (
    let cur = m.get(pRoom, D2ActiveRoomStrc.pUnitFirst);
    cur !== 0 && roomUnits.length < 16;
    cur = m.get(cur, D2UnitStrc.pRoomUnitNext)
  ) {
    roomUnits.push(mapPtr(cur))
  }

  const roomUpdates: number[] = []
  for (
    let cur = m.get(pRoom, D2ActiveRoomStrc.pUpdateList);
    cur !== 0 && roomUpdates.length < 16;
    cur = m.get(cur, D2UnitStrc.pRoomUpdateNext)
  ) {
    roomUpdates.push(mapPtr(cur))
  }

  return {
    nPlayers: m.get(pRoom, D2ActiveRoomStrc.nPlayers) >>> 0,
    actFlag: m.u32(actFlagPtr) >>> 0,
    newIds,
    found,
    coords,
    roomUnits,
    roomUpdates,
    unitFlags: units.map((u) => m.get(u, D2UnitStrc.dwFlags) >>> 0),
    unitFlags2: units.map((u) => m.get(u, D2UnitStrc.dwFlags2) >>> 0),
    unitHashNext: units.map((u) => mapPtr(m.get(u, D2UnitStrc.pGameHashNext))),
    unitRooms: units.map((u) => (UNITS_GetRoom113c(m, u) === pRoom ? 1 : 0)),
  }
}

describe('K0 Gate #4: 10,000+ stateful real-DLL differential records (0 errors)', () => {
  const { rawLines, records: allRecords } = loadKern10kRecords()
  const mulRecords = allRecords.filter((r): r is MulDivDiffRecord113c => r.k === 'm')
  const statRecords = allRecords.filter((r): r is StatSnapDiffRecord113c => r.k === 's')
  const mlRecords = allRecords.filter((r): r is MultilistDiffRecord113c => r.k === 'l')
  const stateRecords = allRecords.filter((r): r is StateSeqDiffRecord113c => r.k === 't')
  const eventRecords = allRecords.filter((r): r is EventTimerSeqDiffRecord113c => r.k === 'e')
  const sunitRecords = allRecords.filter((r): r is SunitRoomDiffRecord113c => r.k === 'u')

  let mPassed = 0
  let sPassed = 0
  let lPassed = 0
  let tPassed = 0
  let ePassed = 0
  let uPassed = 0
  let fnSetEventPassed = 0
  let fnMultiPassed = 0
  let d2tvPassed = 0

  it('verifies 2,500 100%-unique mulDiv113c records against both D2Common (0x6FD511E0) & D2Game (0x6FC214D0)', () => {
    const uniqueTuples = new Set<string>()
    let passed = 0
    for (let i = 0; i < mulRecords.length; i++) {
      const r = mulRecords[i]!
      uniqueTuples.add(`${r.f}:${r.v}:${r.d}`)
      const got = mulDiv113c(r.f, r.v, r.d)
      if (got !== r.c || got !== r.g) {
        throw new Error(
          `mulDiv mismatch at #${i} (${r.f}, ${r.v}, ${r.d}): ts=${got}, D2Common=${r.c}, D2Game=${r.g}`,
        )
      }
      passed++
    }
    expect(uniqueTuples.size).toBe(2500)
    expect(passed).toBe(2500)
    mPassed = passed
  })

  it('verifies 3,600 SNAP_CALL D2StatListEx records (pModStat +0x50/+0x54 & null-StatListEx no-op) + 1,500 MULTILIST_STAT_CALL records against live D2Common.dll', () => {
    let snapOk = 0
    let nullStatListCount = 0
    for (let i = 0; i < statRecords.length; i++) {
      const r = statRecords[i]!
      const m = new TrackedMemory113c()
      const u = UNITS_Create113c(m, UNIT_PLAYER, r.cls, 1)
      let pListEx = 0
      if (r.noStatList !== 1) {
        pListEx = STATLIST_CreateEx113c(m, u, 0)
        for (let j = 0; j < r.p.length; j += 2) {
          STATLIST_SetUnitStat113c(m, u, r.p[j]!, r.p[j + 1]!, 0)
        }
      } else {
        nullStatListCount++
      }

      const eax =
        r.mode === 'set'
          ? STATLIST_SetUnitStat113c(m, u, r.sid, r.val, 0)
          : STATLIST_GetUnitStat113c(m, u, r.sid, 0)
      if ((r.mode === 'get' || r.noStatList === 1) && eax !== r.eax) {
        throw new Error(
          `STATLIST_${r.mode === 'set' ? 'Set' : 'Get'}UnitStat eax mismatch at #${i} (cls=${r.cls}, sid=${r.sid}, noStatList=${r.noStatList ?? 0}): ts=${eax}, dll=${r.eax}`,
        )
      }

      const gotEx = m.get(u, D2UnitStrc.pStatListEx)
      const gotHasStatList: 0 | 1 = gotEx !== 0 ? 1 : 0
      expect(gotHasStatList).toBe(r.hasStatList)

      const gotModStats: number[] = []
      if (pListEx !== 0) {
        const pMod = m.get(pListEx, D2StatListExStrc.pModStat)
        const nMod = m.get(pListEx, D2StatListExStrc.wModStatCount)
        for (let mi = 0; mi < nMod; mi++) {
          gotModStats.push(m.u32(pMod + mi * 4) | 0)
        }
      }
      expect(gotModStats).toEqual(r.modStats)

      for (let k = 0; k < KERN_10K_QSTATS.length; k++) {
        const sid = KERN_10K_QSTATS[k]!
        const wantBase = r.q[k * 2]!
        const wantFull = r.q[k * 2 + 1]!
        const gotBase = STATLIST_GetUnitBaseStat113c(m, u, sid, 0)
        const gotFull = STATLIST_GetUnitStat113c(m, u, sid, 0)
        if (gotBase !== wantBase || gotFull !== wantFull) {
          throw new Error(
            `D2StatListEx mismatch at #${i} (mode=${r.mode}, cls=${r.cls}, final=${r.sid}:${r.val}, queryStat=${sid}): ` +
              `ts=[${gotBase},${gotFull}], dll=[${wantBase},${wantFull}]`,
          )
        }
      }
      assertAllWritesInAllocatedStructs113c(m, 's')
      snapOk++
    }
    expect(nullStatListCount).toBeGreaterThanOrEqual(50)
    expect(snapOk).toBe(statRecords.length)
    expect(snapOk).toBeGreaterThanOrEqual(3600)
    sPassed = snapOk

    let mlOk = 0
    for (let i = 0; i < mlRecords.length; i++) {
      const r = mlRecords[i]!
      // 100% of MULTILIST records must attach a real item so `qi` is read from D2Common.dll (zero harness zeros!)
      expect(r.it.length).toBeGreaterThan(0)

      const m = new SparseMemory113c()
      const pGame = GAME_Create113c(m)
      const pAct = m.alloc(D2ActStrc_SIZE)
      const pEnv = m.alloc(D2EnvironmentStrc_SIZE)
      m.set(pAct, D2ActStrc.pEnvironment, pEnv)
      m.set(pEnv, D2EnvironmentStrc.nTimeOfDay, r.env[0] >>> 0)
      m.set(pEnv, D2EnvironmentStrc.dwTicks, r.env[1] >>> 0)
      m.set(pEnv, D2EnvironmentStrc.dwCyclePeriod, r.env[2] >>> 0)

      const ownerType = r.uType === 1 ? UNIT_MONSTER : UNIT_PLAYER
      const pOwner = UNITS_Create113c(m, ownerType, r.cls, 9001, pGame)
      m.set(pOwner, D2UnitStrc.pAct, pAct)
      STATLIST_CreateEx113c(m, pOwner, 0, pGame)

      for (let j = 0; j < r.p.length; j += 2) {
        STATLIST_SetUnitStat113c(m, pOwner, r.p[j]!, r.p[j + 1]!, 0)
      }

      let pC1 = 0
      if (r.c1.length > 0) {
        pC1 = STATLIST_AllocList113c(m, 0, ownerType, 9001)
        for (let j = 0; j < r.c1.length; j += 2) {
          STATLIST_SetStat113c(m, pC1, r.c1[j]!, r.c1[j + 1]!, 0)
        }
        STATLIST_MergeStatLists113c(m, pOwner, pC1, 1)
      }

      let pC2 = 0
      if (r.c2.length > 0) {
        pC2 = STATLIST_AllocList113c(m, 0, ownerType, 9001)
        for (let j = 0; j < r.c2.length; j += 2) {
          STATLIST_SetStat113c(m, pC2, r.c2[j]!, r.c2[j + 1]!, 0)
        }
        STATLIST_MergeStatLists113c(m, pOwner, pC2, 1)
      }

      const pItem = UNITS_Create113c(m, UNIT_ITEM, 0, 9002, pGame)
      m.set(pItem, D2UnitStrc.pAct, pAct)
      const pItemEx = STATLIST_CreateEx113c(m, pItem, 0, pGame)
      for (let j = 0; j < r.it.length; j += 2) {
        STATLIST_SetUnitStat113c(m, pItem, r.it[j]!, r.it[j + 1]!, 0)
      }
      STATLIST_MergeStatLists113c(m, pOwner, pItemEx, 0)

      for (let k = 0; k < KERN_10K_ML_QSTATS.length; k++) {
        const sid = KERN_10K_ML_QSTATS[k]!
        const wantBase = r.q[k * 2]!
        const wantFull = r.q[k * 2 + 1]!
        const gotBase = STATLIST_GetUnitBaseStat113c(m, pOwner, sid, 0)
        const gotFull = STATLIST_GetUnitStat113c(m, pOwner, sid, 0)
        if (gotBase !== wantBase || gotFull !== wantFull) {
          throw new Error(
            `MULTILIST owner mismatch at #${i} (uType=${r.uType}, cls=${r.cls}, sid=${sid}): ` +
              `ts=[${gotBase},${gotFull}], dll=[${wantBase},${wantFull}]`,
          )
        }
      }

      for (let k = 0; k < KERN_10K_ML_QITEM_STATS.length; k++) {
        const sid = KERN_10K_ML_QITEM_STATS[k]!
        const wantBase = r.qi[k * 2]!
        const wantFull = r.qi[k * 2 + 1]!
        const gotBase = STATLIST_GetUnitBaseStat113c(m, pItem, sid, 0)
        const gotFull = STATLIST_GetUnitStat113c(m, pItem, sid, 0)
        if (gotBase !== wantBase || gotFull !== wantFull) {
          throw new Error(
            `MULTILIST item mismatch at #${i} (sid=${sid}): ts=[${gotBase},${gotFull}], dll=[${wantBase},${wantFull}]`,
          )
        }
      }

      if (r.rm !== 0 && r.qp) {
        if ((r.rm & 1) !== 0 && pC1 !== 0) STATLIST_UnlinkSubList113c(m, pOwner, pC1)
        if ((r.rm & 2) !== 0 && pC2 !== 0) STATLIST_UnlinkSubList113c(m, pOwner, pC2)
        if ((r.rm & 4) !== 0 && pItemEx !== 0) STATLIST_UnlinkSubList113c(m, pOwner, pItemEx)

        for (let k = 0; k < KERN_10K_ML_QSTATS.length; k++) {
          const sid = KERN_10K_ML_QSTATS[k]!
          const wantBase = r.qp[k * 2]!
          const wantFull = r.qp[k * 2 + 1]!
          const gotBase = STATLIST_GetUnitBaseStat113c(m, pOwner, sid, 0)
          const gotFull = STATLIST_GetUnitStat113c(m, pOwner, sid, 0)
          if (gotBase !== wantBase || gotFull !== wantFull) {
            throw new Error(
              `MULTILIST post-unlink mismatch at #${i} (rm=${r.rm}, sid=${sid}): ` +
                `ts=[${gotBase},${gotFull}], dll=[${wantBase},${wantFull}]`,
            )
          }
        }
      }
      mlOk++
    }
    expect(mlOk).toBe(mlRecords.length)
    expect(mlOk).toBeGreaterThanOrEqual(1500)
    lPassed = mlOk
  })

  it('verifies 2,000 multi-step stateful STATES_SEQ_CALL records (state 0..184 uberminion, #11039/#10945/#10866/#10494, room update queue, noStatList, uType 0..5 & OOB)', () => {
    let passed = 0
    for (let i = 0; i < stateRecords.length; i++) {
      const r = stateRecords[i]!
      const got = evalStatesSeq113c(r)
      expect(got.hasStatList).toBe(r.hasStatList)
      expect(got.unitFlags).toBe(r.unitFlags)
      expect(got.unitFlags2).toBe(r.unitFlags2)
      expect(got.actFlag).toBe(r.actFlag)
      expect(got.roomUpdated).toBe(r.roomUpdated)
      expect(got.stateFlags).toEqual(r.stateFlags)
      expect(got.gfxFlags).toEqual(r.gfxFlags)
      expect(got.stepFlags2).toEqual(r.stepFlags2)
      expect(got.checks).toEqual(r.checks)
      passed++
    }
    expect(passed).toBe(stateRecords.length)
    expect(passed).toBeGreaterThanOrEqual(2000)
    tPassed = passed
  })

  it('verifies 3,000 multi-op stateful EVENT_TIMER_SEQ_CALL records + 500 SUNIT_UNITROOM_CALL records + live-game fnrec + D2TV', async () => {
    let evOk = 0
    for (let i = 0; i < eventRecords.length; i++) {
      const r = eventRecords[i]!
      const got = evalEventTimerSeq113c(r)
      expect(got.endFrame).toBe(r.endFrame)
      expect(got.u0State36).toBe(r.u0State36)
      expect(got.u6State36).toBe(r.u6State36)
      expect(got.u0State5C).toBe(r.u0State5C)
      expect(got.u6State5C).toBe(r.u6State5C)
      expect(got.u0Flags2).toBe(r.u0Flags2)
      expect(got.fired).toEqual(r.fired)
      expect(got.nextFrames).toEqual(r.nextFrames)
      expect(got.freeTop).toEqual(r.freeTop)
      expect(got.u0Chain).toEqual(r.u0Chain)
      evOk++
    }
    expect(evOk).toBe(eventRecords.length)
    expect(evOk).toBeGreaterThanOrEqual(3000)
    ePassed = evOk

    let suOk = 0
    for (let i = 0; i < sunitRecords.length; i++) {
      const r = sunitRecords[i]!
      const got = evalSunitRoom113c(r)
      expect(got.nPlayers).toBe(r.nPlayers)
      expect(got.actFlag).toBe(r.actFlag)
      expect(got.newIds).toEqual(r.newIds)
      expect(got.found).toEqual(r.found)
      expect(got.coords).toEqual(r.coords)
      expect(got.roomUnits).toEqual(r.roomUnits)
      expect(got.roomUpdates).toEqual(r.roomUpdates)
      expect(got.unitFlags).toEqual(r.unitFlags)
      expect(got.unitFlags2).toEqual(r.unitFlags2)
      expect(got.unitHashNext).toEqual(r.unitHashNext)
      expect(got.unitRooms).toEqual(r.unitRooms)
      suOk++
    }
    expect(suOk).toBe(sunitRecords.length)
    expect(suOk).toBeGreaterThanOrEqual(500)
    uPassed = suOk

    const fnSetEvent = await replayFile(FNREC_SETEVENT_PATH)
    expect(fnSetEvent.failures).toEqual([])
    expect(fnSetEvent.passed).toBe(fnSetEvent.calls)
    expect(fnSetEvent.passed).toBeGreaterThanOrEqual(90)
    fnSetEventPassed = fnSetEvent.passed

    const fnMulti = await replayFile(FNREC_K0_MULTI_PATH)
    expect(fnMulti.failures).toEqual([])
    expect(fnMulti.passed).toBe(fnMulti.calls)
    expect(fnMulti.passed).toBeGreaterThanOrEqual(190)
    fnMultiPassed = fnMulti.passed

    const d2tv = verifyEventWheelVectors(new Uint8Array(readFileSync(EVTWHEEL_D2TV_PATH)))
    expect(d2tv.errors).toEqual([])
    expect(d2tv.passed).toBeGreaterThanOrEqual(256)
    expect(d2tv.totalFired).toBeGreaterThanOrEqual(45_000)
    d2tvPassed = d2tv.passed
  })

  it('proves offline negative controls fail on mutated kernel logic (1-pass ClearModeEvents, stubbed state 0x36, omitted/naive unit+0xC8 0x08, rogue write, stat +1)', () => {
    // (a) 1-pass vs shipped 2-pass `MONSTER_ClearModeEvents` MUST fail `freeTop` on coexisting `type 0 + 1` records!
    let clear1PassMismatches = 0
    for (let i = 0; i < 600; i++) {
      const r = eventRecords[i]!
      const bad = evalEventTimerSeq113c(r, 'singlePassClear')
      if (JSON.stringify(bad.freeTop) !== JSON.stringify(r.freeTop)) {
        clear1PassMismatches++
      }
    }
    expect(clear1PassMismatches).toBeGreaterThanOrEqual(100)

    // (b) Stubbing `STATES_CheckState(0x36) -> false` on `EVENT_SetEvent` MUST fail on monster `state 0x36` `type=2` records!
    let stub36Mismatches = 0
    for (let i = 600; i < 1200; i++) {
      const r = eventRecords[i]!
      const bad = evalEventTimerSeq113c(r, 'stubState36False')
      if (
        bad.u0State36 !== r.u0State36 ||
        bad.u6State36 !== r.u6State36 ||
        bad.u0State5C !== r.u0State5C ||
        bad.u6State5C !== r.u6State5C ||
        JSON.stringify(bad.nextFrames) !== JSON.stringify(r.nextFrames) ||
        JSON.stringify(bad.fired) !== JSON.stringify(r.fired)
      ) {
        stub36Mismatches++
      }
    }
    expect(stub36Mismatches).toBeGreaterThanOrEqual(500)

    // (c) Omitting `unit+0xC8 |= 0x08` OR clearing `0x08` unconditionally while another disguise state stays active MUST fail!
    let omitFlags2Mismatches = 0
    let naiveClear08Mismatches = 0
    for (let i = 0; i < 500; i++) {
      const r = stateRecords[i]!
      const badOmit = evalStatesSeq113c(r, 'omitFlags2')
      if (
        badOmit.unitFlags2 !== r.unitFlags2 ||
        JSON.stringify(badOmit.stepFlags2) !== JSON.stringify(r.stepFlags2)
      ) {
        omitFlags2Mismatches++
      }
      const badNaive = evalStatesSeq113c(r, 'unconditionalClear08')
      if (
        badNaive.unitFlags2 !== r.unitFlags2 ||
        JSON.stringify(badNaive.stepFlags2) !== JSON.stringify(r.stepFlags2)
      ) {
        naiveClear08Mismatches++
      }
    }
    expect(omitFlags2Mismatches).toBeGreaterThanOrEqual(200)
    expect(naiveClear08Mismatches).toBeGreaterThanOrEqual(100)

    // (c2) Rogue writes outside allocated struct regions in `t`, `e`, and `u` MUST throw!
    expect(() => evalStatesSeq113c(stateRecords[0]!, 'rogueWrite')).toThrow(/Rogue write/)
    expect(() => evalEventTimerSeq113c(eventRecords[0]!, 'rogueWrite')).toThrow(/Rogue write/)
    expect(() => evalSunitRoom113c(sunitRecords[0]!, 'rogueWrite')).toThrow(/Rogue write/)

    // (d) Stat `value + 1` perturbation MUST fail `SNAP_CALL` (`s`) and `MULTILIST_STAT_CALL` (`l`)!
    const s0 = statRecords.find((r) => r.mode === 'set' && r.noStatList !== 1)!
    const mSnap = new SparseMemory113c()
    const uSnap = UNITS_Create113c(mSnap, UNIT_PLAYER, s0.cls, 1)
    STATLIST_CreateEx113c(mSnap, uSnap, 0)
    for (let j = 0; j < s0.p.length; j += 2) {
      STATLIST_SetUnitStat113c(mSnap, uSnap, s0.p[j]!, s0.p[j + 1]!, 0)
    }
    STATLIST_SetUnitStat113c(mSnap, uSnap, s0.sid, s0.val + 1, 0)
    const badSnapQ: number[] = []
    for (const sid of KERN_10K_QSTATS) {
      badSnapQ.push(
        STATLIST_GetUnitBaseStat113c(mSnap, uSnap, sid, 0),
        STATLIST_GetUnitStat113c(mSnap, uSnap, sid, 0),
      )
    }
    expect(badSnapQ).not.toEqual(s0.q)

    const l0 = mlRecords[0]!
    const mMl = new SparseMemory113c()
    const pG = GAME_Create113c(mMl)
    const pA = mMl.alloc(D2ActStrc_SIZE)
    const pE = mMl.alloc(D2EnvironmentStrc_SIZE)
    mMl.set(pA, D2ActStrc.pEnvironment, pE)
    mMl.set(pE, D2EnvironmentStrc.nTimeOfDay, l0.env[0] >>> 0)
    mMl.set(pE, D2EnvironmentStrc.dwTicks, l0.env[1] >>> 0)
    mMl.set(pE, D2EnvironmentStrc.dwCyclePeriod, l0.env[2] >>> 0)
    const pIt = UNITS_Create113c(mMl, UNIT_ITEM, 0, 9002, pG)
    mMl.set(pIt, D2UnitStrc.pAct, pA)
    STATLIST_CreateEx113c(mMl, pIt, 0, pG)
    for (let j = 0; j < l0.it.length; j += 2) {
      STATLIST_SetUnitStat113c(
        mMl,
        pIt,
        l0.it[j]!,
        j === 0 ? l0.it[j + 1]! + 1 : l0.it[j + 1]!,
        0,
      )
    }
    const badItemQi: number[] = []
    for (const sid of KERN_10K_ML_QITEM_STATS) {
      badItemQi.push(
        STATLIST_GetUnitBaseStat113c(mMl, pIt, sid, 0),
        STATLIST_GetUnitStat113c(mMl, pIt, sid, 0),
      )
    }
    expect(badItemQi).not.toEqual(l0.qi)
  })

  it('exceeds 10,000 stateful real-DLL differential records strictly from measured passed counters (zero duplicate lines)', () => {
    expect(new Set(rawLines).size).toBe(rawLines.length)
    expect(rawLines.length).toBeGreaterThanOrEqual(13_100)

    const statefulPassed = sPassed + lPassed + tPassed + ePassed + uPassed
    expect(statefulPassed).toBe(
      statRecords.length +
        mlRecords.length +
        stateRecords.length +
        eventRecords.length +
        sunitRecords.length,
    )
    expect(statefulPassed).toBeGreaterThanOrEqual(10_000)

    const totalPassed =
      mPassed + statefulPassed + fnSetEventPassed + fnMultiPassed + d2tvPassed
    expect(totalPassed).toBe(
      mulRecords.length +
        statRecords.length +
        mlRecords.length +
        stateRecords.length +
        eventRecords.length +
        sunitRecords.length +
        fnSetEventPassed +
        fnMultiPassed +
        d2tvPassed,
    )
    expect(totalPassed).toBeGreaterThanOrEqual(13_500)
  })
})
