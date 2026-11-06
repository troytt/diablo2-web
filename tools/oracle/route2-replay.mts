/**
 * Route-2 replay: run recorded 1.13c calls (oracle hook `fnrec`, scenario key `oracleFnRec`) through the
 * shipped TS kernel ports in `src/d2kern-113c/index.ts` on `TrackedMemory113c` (`SparseMemory113c` +
 * write-set verification) and compare post-call memory byte for byte.
 *
 *   npx tsx tools/oracle/route2-replay.mts <fnrec.ndjson[.gz]> [trace.ndjson with ord]
 *
 * Supported recorded functions (all imported directly from `src/d2kern-113c/index.ts`):
 * - `EVENT_SetEvent` (`0x6FCAEA80` -> `EVENT_SetEventFull113c`, default `STATES_CheckState113c(0x36)` + `0x6FD02240`)
 * - `MONSTER_DeleteModeEvents` (`0x6FD00750` -> `MONSTER_ClearModeEvents113c`, 2-pass `0` then `1`)
 * - `STATLIST_SetUnitStat` (`0x6FD8A740` -> `STATLIST_SetUnitStat113c`)
 * - `STATES_ToggleState` (`0x6FD88730` -> `STATES_ToggleState113c`)
 * - `EVENT_UpdateTimers` (`0x6FCAF070` partition fire order over `D2TimerStrc`)
 */
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'
import {
  D2EventStrc,
  D2GameStrc,
  D2TimerStrc,
  EVENT_SetEventFull113c,
  MONSTER_ClearModeEvents113c,
  SparseMemory113c,
  STATES_ToggleState113c,
  STATLIST_SetUnitStat113c,
} from '../../src/d2kern-113c/index.ts'
import { runFnrecDifferential113c, type FnrecCallRecord113c } from './fn-snapshot-runner.ts'

export type Rec = FnrecCallRecord113c

export interface ReplayResult {
  readonly fn: string
  readonly byFn: Readonly<Record<string, { calls: number; passed: number }>>
  readonly calls: number
  readonly passed: number
  readonly failures: readonly string[]
}

function hex(b: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b, 'hex'))
}

/**
 * `EVENT_UpdateTimers` static pre-frame monster partition (`part = 1`) fire order check:
 * walks `D2TimerStrc.pPersistentHead[1]` LIFO (`+0x1C`) followed by `D2TimerStrc.pSlotTail[64 + (frame & 63)]`
 * FIFO (`+0x1C` where `dwFrame == dwGameFrame`) and compares against the oracle `ord` log of that frame.
 */
export function replayTimersRecord(rec: Rec, ord: readonly (readonly number[])[] | undefined): string | null {
  const m = new SparseMemory113c()
  for (const [addr, h] of rec.pre) if (h !== '') m.loadBlock(addr >>> 0, hex(h))

  const pGame = rec.args[0]! >>> 0
  const pTimer = m.get(pGame, D2GameStrc.pTimer)
  const frame = m.get(pGame, D2GameStrc.dwGameFrame) >>> 0
  const got: number[][] = []

  for (let n = m.get(pTimer, D2TimerStrc.pPersistentHead, 1); n !== 0; n = m.get(n, D2EventStrc.pWheelNewer)) {
    if (m.get(n, D2EventStrc.pfnHandler) === 0) {
      got.push([
        2,
        m.get(n, D2EventStrc.nType),
        m.get(n, D2EventStrc.dwUnitType),
        m.get(n, D2EventStrc.dwUnitId),
      ])
    }
  }
  const slot = 64 + (frame & 63)
  for (let n = m.get(pTimer, D2TimerStrc.pSlotTail, slot); n !== 0; n = m.get(n, D2EventStrc.pWheelNewer)) {
    if ((m.get(n, D2EventStrc.dwFrame) >>> 0) === frame && m.get(n, D2EventStrc.pfnHandler) === 0) {
      got.push([
        1,
        m.get(n, D2EventStrc.nType),
        m.get(n, D2EventStrc.dwUnitType),
        m.get(n, D2EventStrc.dwUnitId),
      ])
    }
  }

  const want = (ord ?? []).filter((e) => e[0] === 1 || e[0] === 2).map((e) => e.slice(0, 4))
  return JSON.stringify(got) === JSON.stringify(want)
    ? null
    : `F${rec.frame}: order ${JSON.stringify(got)} != oracle ${JSON.stringify(want)}`
}

export function replayRecord(rec: Rec): string | null {
  if (
    rec.fn !== 'EVENT_SetEvent' &&
    rec.fn !== 'MONSTER_DeleteModeEvents' &&
    rec.fn !== 'STATLIST_SetUnitStat' &&
    rec.fn !== 'STATES_ToggleState'
  ) {
    return `no TS port for ${rec.fn}`
  }

  return runFnrecDifferential113c(rec, (m, args) => {
    if (rec.fn === 'EVENT_SetEvent') {
      const [pGame, pUnit, type, frame, handler, arg14, arg18] = args as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ]
      EVENT_SetEventFull113c(m, pGame, pUnit, type, frame, handler, arg14, arg18)
    } else if (rec.fn === 'MONSTER_DeleteModeEvents') {
      const [pGame, pUnit] = args as [number, number]
      MONSTER_ClearModeEvents113c(m, pGame, pUnit)
    } else if (rec.fn === 'STATLIST_SetUnitStat') {
      const [pUnit, statId, value, layer] = args as [number, number, number, number]
      return STATLIST_SetUnitStat113c(m, pUnit, statId, value, layer)
    } else if (rec.fn === 'STATES_ToggleState') {
      const [pUnit, stateId, bSet] = args as [number, number, number]
      STATES_ToggleState113c(m, pUnit, stateId, bSet !== 0)
    }
  })
}

export async function replayFile(
  path: string,
  ordByFrame?: ReadonlyMap<number, readonly (readonly number[])[]>,
): Promise<ReplayResult> {
  const input = path.endsWith('.gz') ? createReadStream(path).pipe(createGunzip()) : createReadStream(path)
  const rl = createInterface({ input, crlfDelay: Infinity })
  let calls = 0
  let passed = 0
  const failures: string[] = []
  const byFn: Record<string, { calls: number; passed: number }> = {}
  let fn = ''
  for await (const line of rl) {
    if (line.trim() === '') continue
    const rec = JSON.parse(line) as Rec
    fn = rec.fn
    const bucket = (byFn[rec.fn] ??= { calls: 0, passed: 0 })
    bucket.calls++
    calls++
    const err =
      rec.fn === 'EVENT_UpdateTimers' ? replayTimersRecord(rec, ordByFrame?.get(rec.frame)) : replayRecord(rec)
    if (err === null) {
      passed++
      bucket.passed++
    } else if (failures.length < 20) {
      failures.push(err)
    }
  }
  return { fn, byFn, calls, passed, failures }
}

if (/route2-replay\.m?ts$/.test(process.argv[1] ?? '')) {
  const path = process.argv[2]
  if (path === undefined) throw new Error('usage: route2-replay.mts <fnrec.ndjson[.gz]> [trace.ndjson with ord]')
  const tracePath = process.argv[3]
  const ordByFrame = new Map<number, readonly (readonly number[])[]>()
  if (tracePath !== undefined) {
    const rl = createInterface({ input: createReadStream(tracePath), crlfDelay: Infinity })
    for await (const line of rl) {
      if (!line.includes('"ord"')) continue
      const o = JSON.parse(line) as { frame: number; ord: number[][] }
      ordByFrame.set(o.frame, o.ord)
    }
  }
  const r = await replayFile(path, ordByFrame)
  console.log(`${Object.keys(r.byFn).join('+')}: ${r.passed}/${r.calls} calls byte-identical`, r.byFn)
  for (const f of r.failures) console.log('  FAIL', f)
  process.exit(r.passed === r.calls ? 0 : 1)
}
