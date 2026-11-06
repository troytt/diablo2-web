import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  D2EventStrc,
  D2UnitStrc,
  EVENT_FreeNode113c,
  MONSTER_ClearModeEvents113c,
  STATES_ToggleState113c,
  STATLIST_SetUnitStat113c,
} from '../../src/d2kern-113c/index.ts'
import {
  runFnrecDifferential113c,
  type FnrecCallRecord113c,
} from '../../tools/oracle/fn-snapshot-runner.ts'
import { replayFile, replayRecord } from '../../tools/oracle/route2-replay.mts'

/**
 * Route-2 fnrec replay gate (`§3.3` / `§3.5`):
 * Replays real-game `fnrec` snapshots recorded by `d2oracle.dll` across live scenarios
 * byte for byte on `SparseMemory113c` using ONLY shipped `src/d2kern-113c/` functions:
 * - `EVENT_SetEvent` (`0x6FCAEA80` -> `EVENT_SetEventFull113c`, 94 calls, zero hooks override)
 * - `STATLIST_SetUnitStat` (`0x6FD8A740` -> `STATLIST_SetUnitStat113c`, 80 non-noop calls across 21 stats)
 * - `STATES_ToggleState` (`0x6FD88730` -> `STATES_ToggleState113c`, 39 non-noop calls across 13 states incl. disguise `93`)
 * - `MONSTER_DeleteModeEvents` (`0x6FD00750` -> `MONSTER_ClearModeEvents113c`, 75 non-noop calls incl. coexisting `type 0 + 1`)
 * - `EVENT_UpdateTimers` (`0x6FCAF070`, 41 frames; 40/41 static pre-walk monster wheel snapshots match `ord`,
 *   with `F801` differing because Fallen #12 dies earlier in the player partition walk)
 */
const SETEVENT_FIXTURE = join(
  import.meta.dirname,
  '..',
  'fixtures/oracle/route2/a1c-fnrec-setevent-f700.ndjson.gz',
)
const K0_MULTI_FIXTURE = join(
  import.meta.dirname,
  '..',
  'fixtures/oracle/route2/a1c-fnrec-k0.ndjson.gz',
)

function loadFnrecFixture(path: string): FnrecCallRecord113c[] {
  return gunzipSync(readFileSync(path))
    .toString('utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as FnrecCallRecord113c)
}

describe('route-2 replay: EVENT_SetEvent (shipped EVENT_SetEventFull113c)', () => {
  it('all 94 recorded calls are byte-identical', async () => {
    const r = await replayFile(SETEVENT_FIXTURE)
    expect(r.failures).toEqual([])
    expect(r.passed).toBe(r.calls)
    expect(r.calls).toBe(94)
  })

  it('detects a wrong result (negative control: frame shifted by one)', () => {
    const first = loadFnrecFixture(SETEVENT_FIXTURE)[0]!
    const mutated: FnrecCallRecord113c = {
      ...first,
      args: [
        first.args[0]!,
        first.args[1]!,
        first.args[2]!,
        (first.args[3]! + 1) >>> 0,
        first.args[4]!,
        first.args[5]!,
        first.args[6]!,
      ],
    }
    expect(replayRecord(mutated as never)).not.toBeNull()
  })
})

describe('route-2 replay: multi-function K0 fnrec (STATLIST_SetUnitStat + STATES_ToggleState + MONSTER_DeleteModeEvents)', () => {
  const k0Records = loadFnrecFixture(K0_MULTI_FIXTURE)

  it('all 194 recorded non-noop calls across 3 functions are byte-identical', async () => {
    const r = await replayFile(K0_MULTI_FIXTURE)
    expect(r.failures).toEqual([])
    expect(r.passed).toBe(r.calls)
    expect(r.byFn['STATLIST_SetUnitStat']).toEqual({ calls: 80, passed: 80 })
    expect(r.byFn['STATES_ToggleState']).toEqual({ calls: 39, passed: 39 })
    expect(r.byFn['MONSTER_DeleteModeEvents']).toEqual({ calls: 75, passed: 75 })
  })

  it('offline negative controls: catches 1-pass vs 2-pass MONSTER_ClearModeEvents, omitted unit+0xC8 0x08 flag, stat +1, and out-of-bounds writes', () => {
    // (a) Single-pass `nType === 0 || nType === 1` deletion MUST fail on live-game coexisting `type 0 + 1` records
    //     when `type 1` precedes `type 0` in `pEventFirst` (wrong LIFO free-list head & `pWheelNewer` link)!
    const deRecords = k0Records.filter((r) => r.fn === 'MONSTER_DeleteModeEvents')
    let singlePassFailures = 0
    for (const rec of deRecords) {
      // Baseline shipped 2-pass `MONSTER_ClearModeEvents113c` passes
      expect(
        runFnrecDifferential113c(rec, (m, [pGame, pUnit]) => {
          MONSTER_ClearModeEvents113c(m, pGame!, pUnit!)
        }),
      ).toBeNull()

      // Broken 1-pass walk freeing `0 || 1` in single chain order
      const err1Pass = runFnrecDifferential113c(rec, (m, [pGame, pUnit]) => {
        let cur = m.get(pUnit!, D2UnitStrc.pEventFirst)
        while (cur !== 0) {
          const next = m.get(cur, D2EventStrc.pUnitNext)
          const t = m.get(cur, D2EventStrc.nType)
          if (t === 0 || t === 1) {
            EVENT_FreeNode113c(m, pGame!, cur)
          }
          cur = next
        }
      })
      if (err1Pass !== null) singlePassFailures++
    }
    expect(singlePassFailures).toBeGreaterThan(0)

    // (b) Omitting `unit+0xC8 |= 0x08` MUST fail on live-game disguise `state 93` `STATES_ToggleState` records!
    const state93Records = k0Records.filter(
      (r) => r.fn === 'STATES_ToggleState' && r.args[1] === 93,
    )
    expect(state93Records.length).toBeGreaterThan(0)
    for (const rec of state93Records) {
      const errNo08 = runFnrecDifferential113c(rec, (m, [pUnit, stateId, bSet]) => {
        const savedFlags2 = m.get(pUnit!, D2UnitStrc.dwFlags2)
        STATES_ToggleState113c(m, pUnit!, stateId!, bSet !== 0)
        // Simulate buggy ToggleState that forgets to update `unit+0xC8` (`dwFlags2`)
        m.set(pUnit!, D2UnitStrc.dwFlags2, savedFlags2)
      })
      expect(errNo08).not.toBeNull()
    }

    // (c) Perturbing `STATLIST_SetUnitStat` value by +1 MUST fail byte-level post verification!
    const statRec = k0Records.find((r) => r.fn === 'STATLIST_SetUnitStat')!
    const errStatPlus1 = runFnrecDifferential113c(statRec, (m, [pUnit, statId, value, layer]) => {
      STATLIST_SetUnitStat113c(m, pUnit!, statId!, (value! | 0) + 1, layer!)
    })
    expect(errStatPlus1).not.toBeNull()

    // (d) Any write outside recorded `post` blocks and `alloc()` ranges MUST fail `TrackedMemory113c` check!
    const errrogueWrite = runFnrecDifferential113c(statRec, (m, [pUnit, statId, value, layer]) => {
      STATLIST_SetUnitStat113c(m, pUnit!, statId!, value!, layer!)
      m.setU8(0x12345000, 0xaa)
    })
    expect(errrogueWrite).toMatch(/unexpected write outside recorded post blocks/)
  })
})

describe('route-2 replay: EVENT_UpdateTimers static pre-walk monster partition order', () => {
  it('matches 40/41 frames from static pre-walk snapshots, with F801 diverging due to earlier player-partition kill', async () => {
    const ord = new Map<number, number[][]>()
    for (const line of gunzipSync(
      readFileSync(join(import.meta.dirname, '..', 'fixtures/oracle/route2/a1c-ord-f785.ndjson.gz')),
    )
      .toString('utf8')
      .split('\n')) {
      if (line.trim() === '') continue
      const o = JSON.parse(line) as { frame: number; ord: number[][] }
      ord.set(o.frame, o.ord)
    }
    const r = await replayFile(
      join(import.meta.dirname, '..', 'fixtures/oracle/route2/a1c-fnrec-timers-f785.ndjson.gz'),
      ord,
    )
    // F801: Fallen #12 dies in the player partition (walked before monsters), freeing its persistent node
    // before the monster partition runs; the pre-walk snapshot still holds it (kb event-wheel §3, in-walk frees).
    expect(r.calls).toBe(41)
    expect(r.passed).toBe(40)
    expect(r.failures.length).toBe(1)
    expect(r.failures[0]).toMatch(/^F801: /)
  })
})
