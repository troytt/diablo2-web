/**
 * Records 13,100 independent, 100% deduplicated ground-truth differential records (10,600 stateful
 * multi-step DLL snapshots + 2,500 unique `mulDiv113c` tuples) directly from live Diablo II v1.13c
 * `D2Common.dll` and `D2Game.dll` (`FnOracleDaemon` / `fnharness v2`) into
 * `tests/fixtures/oracle/route2/kern-10k-diff.ndjson.gz` (`Plan §3.3` / `§4.1`).
 *
 * Domains (zero synthetic padding, zero duplicate lines, zero harness-synthesized outputs):
 *   1. `m` (`mulDiv113c`): 2,500 unique `(factor, value, divisor)` tuples verified against both
 *      `D2Common 0x6FD511E0` (op 20) and `D2Game 0x6FC214D0` (op 51).
 *   2. `s` (`D2StatListEx` `SNAP_CALL` op 200): 3,600 unique stateful unit snapshots calling
 *      `D2Common.#10887` (`0x6FD8A740` `STATLIST_SetUnitStat`) & `#10973` (`0x6FD88B70`
 *      `STATLIST_GetUnitStat`) across all 7 character classes `0..6`, levels `1..99`,
 *      `bKeepZero`, `fMin`, `0x6FD89DEA` carrier suppression, and `op 1/2/8/9/11`.
 *   3. `l` (`MULTILIST_STAT_CALL` op 201): 1,500 unique live `D2Common.dll` multi-sub-list &
 *      equipped-item merge snapshots (100% with a real `D2StatListExStrc` item `it.length > 0`
 *      and unmodified `ItemStatCost.bin` op rows `1, 2, 4, 5, 6, 7, 8, 9, 11, 13`, `removeMask 0..7`).
 *   4. `t` (`STATES_SEQ_CALL` op 202): 2,000 unique multi-step stateful `D2Common.dll` state
 *      sequences (`0x6FD88730` `STATES_ToggleState`, `0x6FD83C20` `unit+0xC8` `0x08` mask across
 *      states `63, 93, 119, 139, 140, 176, 177`, `#10494` `0x6FD83CD0` `STATES_CheckState`,
 *      `pStatListEx == NULL` no-op, unit types `0..5`, and OOB indices).
 *   5. `e` (`EVENT_TIMER_SEQ_CALL` op 203): 3,000 unique multi-operation stateful `D2TimerStrc`
 *      sequences (`6..15` `D2Game.dll` timer calls + `1..70` `EVENT_UpdateTimers` frames firing
 *      real callbacks, exercising `0x6FCAEA80` `EVENT_SetEvent` with monster `state 0x36` -> `0x6FD02240`,
 *      `0x6FCAE810` `EVENT_SetPersistentEvent`, `0x6FD00750` 2-pass `MONSTER_ClearModeEvents` on
 *      coexisting `type 0 + 1` with `freeTop` free-list order, `0x6FCAE8C0` `EVENT_DeleteEventByType`,
 *      `0x6FCAE900` `EVENT_DeleteEventByArg14`, `0x6FCAE880` `EVENT_RemoveUnitEvents`, `0x6FCAE490`
 *      `EVENT_GetNextEventFrame`, and re-entrant callback mutations).
 *   6. `u` (`SUNIT_UNITROOM_CALL` op 204): 500 unique server unit hash & spatial room records
 *      (`0x6FCFF9C0`, `0x6FD00310`, `0x6FD003A0`, `0x6FD002A0`, `0x6FD51050`, `0x6FD51080`,
 *      `#10531` `0x6FDB6800`, `#10158` `0x6FDB65C0`, `#11016` `0x6FDB6700`).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { seedInit, seedNext, seedRoll } from '../../src/d2kern-113c/prng.ts'
import {
  FnOracleDaemon,
  SNAP_PTR_PLAYER,
  type EventTimerSeqCallRequest113c,
  type MultilistCallRequest113c,
  type SnapCallRequest113c,
  type StatesSeqCallRequest113c,
  type SunitRoomCallRequest113c,
} from './fn-daemon.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
export const KERN_10K_FIXTURE_PATH = join(
  REPO,
  'tests/fixtures/oracle/route2/kern-10k-diff.ndjson.gz',
)

export const KERN_10K_QSTATS = [
  0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 76, 77, 162, 216, 217, 220, 221, 222, 223,
] as const

export const KERN_10K_ML_QSTATS = [
  0, 1, 2, 3, 7, 9, 11, 12, 19, 21, 22, 24, 31, 72, 73, 76, 77, 92, 162, 214, 215, 216, 224, 268,
  269, 270, 274,
] as const

export const KERN_10K_ML_QITEM_STATS = [
  16, 17, 18, 21, 22, 23, 24, 31, 72, 73, 75, 92, 94, 159, 160, 214, 215, 218, 219,
] as const

export const STATES_FLAG08_IDS = [63, 93, 119, 139, 140, 176, 177] as const

/**
 * Exact 6-dword (185-bit) `fStateMasks[idx]` vectors from `sgptDataTables + 0xCC + 4*idx`
 * (`D2Common.dll` `0x6FDAF742..0x6FDAFDEC`, `States.txt` rows `0..184`).
 */
export const STATE_MASKS_113C: Readonly<Record<number, readonly [number, number, number, number, number, number]>> = {
  0: [0x00001000, 0x00000000, 0x00600057, 0x00008002, 0x00000000, 0x00000c01], // nosend
  1: [0x34000138, 0x000fff3f, 0x00000000, 0x00000000, 0x20380000, 0x0000000e], // aura
  2: [0x00000002, 0x80000000, 0x00000000, 0x00800908, 0x04000000, 0x01002000], // hide
  3: [0x00000000, 0x80000000, 0x20000000, 0x00800020, 0x00001800, 0x00030000], // transform
  11: [0x08880200, 0x3f800000, 0x02000000, 0x00060000, 0x100023ff, 0x00000000], // curse
  12: [0x08880200, 0x3f800000, 0x00000000, 0x00060000, 0x00000000, 0x00000000], // curable
  16: [0x00000000, 0x80000000, 0x20000000, 0x00800000, 0x00001800, 0x00030000], // disguise
  18: [0x00000802, 0x00001000, 0x04000000, 0x00000000, 0x00000000, 0x00000000], // blue
  31: [0x00000002, 0x00000000, 0x00000000, 0x00000800, 0x00000000, 0x01000000], // shatter
  36: [0x00004000, 0x00000000, 0x00000000, 0x00000000, 0x00800000, 0x00000000], // noclear
  38: [0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00001800, 0x00000000], // meleeonly
}
export const STATE_MASK_INDICES_113C = [0, 1, 2, 3, 11, 12, 16, 18, 31, 36, 38] as const

export interface MulDivDiffRecord113c {
  readonly k: 'm'
  readonly f: number
  readonly v: number
  readonly d: number
  readonly c: number
  readonly g: number
}

export interface StatSnapDiffRecord113c {
  readonly k: 's'
  readonly mode: 'set' | 'get'
  readonly cls: number
  readonly noStatList?: 0 | 1
  readonly p: readonly number[]
  readonly sid: number
  readonly val: number
  readonly eax: number
  readonly hasStatList: 0 | 1
  readonly modStats: readonly number[]
  readonly q: readonly number[]
}

export interface MultilistDiffRecord113c {
  readonly k: 'l'
  readonly uType: 0 | 1
  readonly cls: number
  readonly env: readonly [number, number, number]
  readonly p: readonly number[]
  readonly c1: readonly number[]
  readonly c2: readonly number[]
  readonly it: readonly number[]
  readonly rm: number
  readonly q: readonly number[]
  readonly qi: readonly number[]
  readonly qp?: readonly number[]
}

export interface StateSeqDiffRecord113c {
  readonly k: 't'
  readonly uType: number
  readonly noStatList: 0 | 1
  readonly initFlags2: number
  readonly hasRoom?: 0 | 1
  readonly roomFlags?: number
  /**
   * Flat `[kind, sid, arg, ...]` triples:
   * - `0`: `0x6FD88730` `STATES_ToggleState`
   * - `1`: `#11039` `0x6FD84450` `STATES_ToggleGfxStateFlag`
   * - `2`: `#10494` `0x6FD83CD0` `STATES_CheckState`
   * - `3`: `#10945` `0x6FD84510` `STATES_ToggleState` (with `#10158` `UNITROOM_RefreshUnit`)
   * - `4`: `#10866` `0x6FD83D10` -> `0x6FD83C20` `STATES_CheckStateMaskOnUnit`
   * - `5`: `#10796` `0x6FDB63B0` `UNITROOM_ClearUpdateQueue`
   */
  readonly steps: readonly number[]
  readonly hasStatList: 0 | 1
  readonly unitFlags: number
  readonly unitFlags2: number
  readonly actFlag: number
  readonly roomUpdated: 0 | 1
  readonly stateFlags: readonly [number, number, number, number, number, number]
  readonly gfxFlags: readonly [number, number, number, number, number, number]
  readonly stepFlags2: readonly number[]
  readonly checks: readonly number[]
}

export interface EventTimerSeqDiffRecord113c {
  readonly k: 'e'
  readonly initFrame: number
  /** Flat `[cmd, uIdx, p2, p3, p4, p5, ...]` 6-tuples executed against `D2Game.dll`. */
  readonly ops: readonly number[]
  readonly endFrame: number
  readonly u0State36: number
  readonly u6State36: number
  readonly u0State5C: number
  readonly u6State5C: number
  readonly u0Flags2: number
  readonly fired: readonly (readonly [number, number, number, number, number, number])[]
  readonly nextFrames: readonly number[]
  readonly freeTop: readonly number[]
  readonly u0Chain: readonly (readonly [number, number, number, number])[]
}

export interface SunitRoomDiffRecord113c {
  readonly k: 'u'
  readonly roomFlags: number
  readonly initCounters: readonly number[]
  readonly units: readonly number[]
  readonly ops: readonly number[]
  readonly nPlayers: number
  readonly actFlag: number
  readonly newIds: readonly number[]
  readonly found: readonly number[]
  readonly coords: readonly number[]
  readonly roomUnits: readonly number[]
  readonly roomUpdates: readonly number[]
  readonly unitFlags: readonly number[]
  readonly unitFlags2: readonly number[]
  readonly unitHashNext: readonly number[]
  readonly unitRooms: readonly number[]
}

export type Kern10kDiffRecord113c =
  | MulDivDiffRecord113c
  | StatSnapDiffRecord113c
  | MultilistDiffRecord113c
  | StateSeqDiffRecord113c
  | EventTimerSeqDiffRecord113c
  | SunitRoomDiffRecord113c

function buildMulDivInputs(): [number, number, number][] {
  const seen = new Set<string>()
  const inputs: [number, number, number][] = []
  const pushUnique = (f: number, v: number, d: number): void => {
    const fi = f | 0
    const vi = v | 0
    const di = d | 0
    const key = `${fi},${vi},${di}`
    if (seen.has(key)) return
    seen.add(key)
    inputs.push([fi, vi, di])
  }

  const seeds: readonly [number, number, number][] = [
    [0, 0, 0],
    [0, 0, 1],
    [15, 999, 0],
    [-15, 999, 0],
    [1, 0x100000, 100],
    [1, 0x100001, 100],
    [9, 1_100_037, 100],
    [-9, 1_100_037, 100],
    [9, -1_100_037, 100],
    [-9, -1_100_037, 100],
    [7, 0x100020, 0x10002],
    [7, 0x100020, 0x10003],
    [256, 0x150000, 3],
    [-256, 0x150000, 3],
    [256, 0x150000, -3],
    [-256, 0x150000, -3],
    [65536, 32767, 100],
    [-65536, 32767, 100],
    [50000, -40000, 77],
    [-50000, -40000, -77],
  ]
  for (const [f, v, d] of seeds) pushUnique(f, v, d)

  const rng = seedInit(0x5a17113c, 666)
  while (inputs.length < 2500) {
    const mode = seedRoll(rng, 6)
    let f = 0
    let v = 0
    let d = 100
    if (mode === 0) {
      f = (seedRoll(rng, 4096) - 2048) | 0
      v = (0x100001 + seedRoll(rng, 0x600000)) | 0
      d = (1 + seedRoll(rng, 512)) | 0
      if (seedRoll(rng, 4) === 0) d = -d
    } else if (mode === 1) {
      f = (seedRoll(rng, 1000) - 500) | 0
      v = (0x0ffff8 + seedRoll(rng, 32)) | 0
      const baseDiv = v >> 4
      d = (baseDiv - 4 + seedRoll(rng, 9)) | 0
    } else if (mode === 2) {
      f = ((seedRoll(rng, 120000) - 60000) * 16) | 0
      v = ((seedRoll(rng, 120000) - 60000) * 16) | 0
      d = (5000 + seedRoll(rng, 50000)) | 0
      if (seedRoll(rng, 2) === 0) d = -d
    } else if (mode === 3) {
      const sub = seedRoll(rng, 3)
      f = (seedNext(rng) >> 8) | 0
      v = (seedNext(rng) >> 8) | 0
      d = sub === 0 ? 0 : sub === 1 ? 1 : -1
    } else {
      f = (seedRoll(rng, 801) - 200) | 0
      v = ((seedRoll(rng, 20000) - 2000) << 8) | 0
      d = [100, 128, 256, 1024, 1000, 7, 13, -100][seedRoll(rng, 8)]!
    }
    pushUnique(f, v, d)
  }
  return inputs
}

function buildStatSnapInputs(): Array<{
  readonly mode: 'set' | 'get'
  readonly cls: number
  readonly noStatList: 0 | 1
  readonly p: number[]
  readonly sid: number
  readonly val: number
  readonly req: SnapCallRequest113c & { readonly noStatList?: 0 | 1 }
}> {
  const rng = seedInit(0x6fd89530, 666)
  const seen = new Set<string>()
  const out: Array<{
    readonly mode: 'set' | 'get'
    readonly cls: number
    readonly noStatList: 0 | 1
    readonly p: number[]
    readonly sid: number
    readonly val: number
    readonly req: SnapCallRequest113c & { readonly noStatList?: 0 | 1 }
  }> = []

  // First 100 records: `pStatListEx == NULL` (`noStatList: 1`) across classes `0..6` and `set` / `get`:
  // verifies both `D2Common.dll` (`#10887` `0x6FD8A740` & `#10973` `0x6FD88B70`) and TS return `0`
  // without allocating a `D2StatListExStrc`.
  for (let n = 0; n < 100; n++) {
    const mode: 'set' | 'get' = n % 5 === 4 ? 'get' : 'set'
    const cls = n % 7
    const sid = KERN_10K_QSTATS[n % KERN_10K_QSTATS.length]!
    const val = mode === 'set' ? 10 + n * 3 : n
    const sig = `nostat:${mode}:${cls}:${sid}:${val}`
    seen.add(sig)
    out.push({
      mode,
      cls,
      noStatList: 1,
      p: [],
      sid,
      val,
      req:
        mode === 'set'
          ? {
              mod: 1,
              va: 0x6fd8a740,
              args: [SNAP_PTR_PLAYER, sid, val, 0],
              pClass: cls,
              noStatCb: 1,
              noStatList: 1,
              pStats: [],
              qStats: KERN_10K_QSTATS,
            }
          : {
              mod: 1,
              va: 0x6fd88b70,
              args: [SNAP_PTR_PLAYER, sid, 0],
              pClass: cls,
              noStatCb: 1,
              noStatList: 1,
              pStats: [],
              qStats: KERN_10K_QSTATS,
            },
    })
  }

  let i = 0
  while (out.length < 3600) {
    const cls = i % 7
    const str = i % 5 === 0 ? 0 : i % 17 === 0 ? -15 : 10 + seedRoll(rng, 180)
    const ene = i % 19 === 0 ? 0 : i % 23 === 0 ? -10 : 10 + seedRoll(rng, 120)
    const dex = i % 13 === 0 ? 0 : 15 + seedRoll(rng, 140)
    const vit = i % 11 === 0 ? 0 : i % 29 === 0 ? -8 : 15 + seedRoll(rng, 160)
    const lvl = 1 + (i % 99)

    const pctHp76 = i % 4 === 0 ? 0 : i % 15 === 0 ? -120 : seedRoll(rng, 161) - 40
    const pctMana77 = i % 4 === 1 ? 0 : i % 17 === 0 ? -120 : seedRoll(rng, 161) - 40
    const pctStam162 = i % 3 === 0 ? 0 : i % 19 === 0 ? -120 : seedRoll(rng, 181) - 40
    const hpPerLvl216 = i % 3 === 1 ? 0 : seedRoll(rng, 32) << 6
    const manaPerLvl217 = i % 3 === 2 ? 0 : seedRoll(rng, 32) << 6
    const strPerLvl220 = i % 5 === 1 ? 0 : seedRoll(rng, 25)
    const dexPerLvl221 = i % 5 === 2 ? 0 : seedRoll(rng, 25)
    const enePerLvl222 = i % 3 === 0 ? 0 : seedRoll(rng, 33)
    const vitPerLvl223 = i % 3 === 1 ? 0 : seedRoll(rng, 33)

    const hp6 = i % 7 === 0 ? 0 : (10 + seedRoll(rng, 500)) << 8
    const maxhp7 =
      i % 16 === 0 ? 0 : i % 16 === 1 ? -512 : i % 16 === 2 ? 128 : (30 + seedRoll(rng, 900)) << 8
    const mana8 = i % 6 === 0 ? 0 : (5 + seedRoll(rng, 400)) << 8
    const maxmana9 =
      i % 18 === 0 ? 0 : i % 18 === 1 ? -768 : i % 18 === 2 ? 128 : (15 + seedRoll(rng, 600)) << 8
    const stam10 = i % 8 === 0 ? 0 : (20 + seedRoll(rng, 400)) << 8
    const maxstam11 =
      i % 20 === 0 ? 0 : i % 20 === 1 ? -256 : i % 20 === 2 ? 128 : (40 + seedRoll(rng, 500)) << 8

    const targetChoices: readonly [number, number][] = [
      [223, vitPerLvl223],
      [222, enePerLvl222],
      [216, hpPerLvl216],
      [217, manaPerLvl217],
      [162, pctStam162],
      [76, pctHp76],
      [77, pctMana77],
      [12, lvl],
      [7, maxhp7],
      [8, mana8],
    ]
    const [finalSid, finalVal] = targetChoices[i % targetChoices.length]!
    const mode: 'set' | 'get' = i % 6 === 5 ? 'get' : 'set'

    const basePairs: [number, number][] = [
      [0, str],
      [1, ene],
      [2, dex],
      [3, vit],
      [6, hp6],
      [7, maxhp7],
      [8, mana8],
      [9, maxmana9],
      [10, stam10],
      [11, maxstam11],
      [12, lvl],
      [76, pctHp76],
      [77, pctMana77],
      [162, pctStam162],
      [216, hpPerLvl216],
      [217, manaPerLvl217],
      [220, strPerLvl220],
      [221, dexPerLvl221],
      [222, enePerLvl222],
      [223, vitPerLvl223],
    ]

    const p: number[] = []
    for (const [sid, v] of basePairs) {
      p.push(sid, mode === 'set' && sid === finalSid ? 0 : v)
    }

    const sid = mode === 'set' ? finalSid : KERN_10K_QSTATS[i % KERN_10K_QSTATS.length]!
    const val = mode === 'set' ? finalVal : 0
    const sig = `${mode}:${cls}:${sid}:${val}:${p.join(',')}`
    i++
    if (seen.has(sig)) continue
    seen.add(sig)

    out.push({
      mode,
      cls,
      noStatList: 0,
      p,
      sid,
      val,
      req:
        mode === 'set'
          ? {
              mod: 1,
              va: 0x6fd8a740,
              args: [SNAP_PTR_PLAYER, sid, val, 0],
              pClass: cls,
              noStatCb: 1,
              pStats: p,
              qStats: KERN_10K_QSTATS,
            }
          : {
              mod: 1,
              va: 0x6fd88b70,
              args: [SNAP_PTR_PLAYER, sid, 0],
              pClass: cls,
              noStatCb: 1,
              pStats: p,
              qStats: KERN_10K_QSTATS,
            },
    })
  }
  return out
}

function packByTime113c(period: number, minVal: number, maxVal: number): number {
  const p = period & 3
  const mn = (minVal + 0x100) & 0x3ff
  const mx = (maxVal + 0x100) & 0x3ff
  return p | (mn << 2) | (mx << 12)
}

function buildMultilistInputs(): Array<{
  readonly uType: 0 | 1
  readonly cls: number
  readonly env: readonly [number, number, number]
  readonly p: number[]
  readonly c1: number[]
  readonly c2: number[]
  readonly it: number[]
  readonly rm: number
  readonly req: MultilistCallRequest113c
}> {
  const rng = seedInit(0x6fd8a7d0, 666)
  const seen = new Set<string>()
  const out: Array<{
    readonly uType: 0 | 1
    readonly cls: number
    readonly env: readonly [number, number, number]
    readonly p: number[]
    readonly c1: number[]
    readonly c2: number[]
    readonly it: number[]
    readonly rm: number
    readonly req: MultilistCallRequest113c
  }> = []

  let i = 0
  while (out.length < 1500) {
    const uType: 0 | 1 = i % 5 === 4 ? 1 : 0
    const cls = i % 7
    const tod = i % 4
    const ticksPerDeg = i % 17 === 0 ? 0 : 10 + seedRoll(rng, 40)
    const angleTarget = (i * 19 + seedRoll(rng, 25)) % 400
    const ticks = ticksPerDeg === 0 ? seedRoll(rng, 500) : angleTarget * ticksPerDeg + seedRoll(rng, 10)
    const env: readonly [number, number, number] = [tod, ticks, ticksPerDeg]

    const lvl = 1 + (i % 99)
    const str = i % 4 === 0 ? 0 : 15 + seedRoll(rng, 160)
    const ene = 10 + seedRoll(rng, 80)
    const vit = 15 + seedRoll(rng, 100)
    const baseAc = i % 6 === 0 ? 0 : 10 + seedRoll(rng, 120)
    const baseTohit19 = i % 5 === 0 ? 0 : 40 + seedRoll(rng, 200)
    const baseHp = (40 + seedRoll(rng, 300)) << 8
    const baseMana = (20 + seedRoll(rng, 200)) << 8
    const baseStam = (30 + seedRoll(rng, 200)) << 8

    const byTimeAc268 =
      i % 3 === 0 ? 0 : packByTime113c(i % 4, seedRoll(rng, 80) - 20, 30 + seedRoll(rng, 150))
    const byTimeAcPct269 =
      i % 3 === 1 ? 0 : packByTime113c((i + 1) % 4, seedRoll(rng, 50) - 15, 20 + seedRoll(rng, 120))
    const byTimeHp270 =
      i % 4 === 0 ? 0 : packByTime113c((i + 2) % 4, 0, (10 + seedRoll(rng, 60)) << 2)
    const byTimeStr274 =
      i % 5 === 0 ? 0 : packByTime113c((i + 3) % 4, -5, 5 + seedRoll(rng, 30))

    // Real unmodified ItemStatCost.bin op rows on owner (`p`):
    // - op 1 (`162 -> 11`), op 2 (`216 -> 7`, `224 -> 19` param=1), op 6 (`268, 270, 274`), op 7 (`269`), op 11 (`76, 77`)
    const p: number[] = [
      0, str,
      1, ene,
      3, vit,
      7, baseHp,
      9, baseMana,
      11, baseStam,
      12, lvl,
      19, baseTohit19,
      31, baseAc,
      162, i % 3 === 0 ? 0 : 10 + seedRoll(rng, 45),
      216, i % 4 === 1 ? 0 : (1 + seedRoll(rng, 16)) << 6,
      224, i % 4 === 2 ? 0 : 2 + seedRoll(rng, 20),
      268, byTimeAc268,
      269, byTimeAcPct269,
      270, byTimeHp270,
      274, byTimeStr274,
    ]

    // c1Stats (bType=1 buff/aura/active-weapon): merges BOTH non-damage and ISC_FLAG_DAMAGE_RELATED
    const c1: number[] =
      i % 8 === 0
        ? []
        : [
            3, 5 + seedRoll(rng, 25), // op 9 -> 7, 11 on player
            1, 4 + seedRoll(rng, 20), // op 8 -> 9 on player
            21, 3 + seedRoll(rng, 18), // mindamage (0x04) merged when bType == 1
            22, 10 + seedRoll(rng, 30), // maxdamage (0x04) merged when bType == 1
            31, 15 + seedRoll(rng, 60),
            76, seedRoll(rng, 60) - 10, // op 11 -> 7
            77, seedRoll(rng, 50) - 10, // op 11 -> 9
          ]

    // c2Stats (bType=1 second buff sub-list, including damage-related by-time 272/273)
    const c2: number[] =
      i % 7 === 0
        ? []
        : [
            0, seedRoll(rng, 30),
            31, 10 + seedRoll(rng, 50),
            268, i % 2 === 0 ? packByTime113c(2, 5, 45) : 0,
            272, i % 3 === 0 ? packByTime113c(1, 2, 24) : 0,
            273, i % 3 === 1 ? packByTime113c(3, 5, 35) : 0,
          ]

    // EVERY `l` record has a real non-empty item (`it.length > 0`) so `qi` is 100% read from D2Common.dll!
    // Exercises real ItemStatCost.bin op 13 (`16->31`, `17->22/24/160`, `18->21/23/159`, `75->73`, `94->92`),
    // op 4 (`214->31`, `218->22/24/160`), op 5 (`215->31`, `219->22/24/160`), `itemSpecific` (`72, 73`),
    // and `damageRelated` (`0x04`) suppression on owner under `bType == 0`!
    const itemVariant = i % 3
    let it: number[]
    if (itemVariant === 0) {
      it = [
        31, i % 9 === 0 ? 0 : 25 + seedRoll(rng, 200),
        16, i % 4 === 0 ? 0 : 10 + seedRoll(rng, 150),
        73, 20 + seedRoll(rng, 60),
        75, i % 3 === 0 ? 0 : 10 + seedRoll(rng, 80),
        72, 10 + seedRoll(rng, 40),
        92, 12 + seedRoll(rng, 55),
        94, i % 2 === 0 ? -20 : -15 - seedRoll(rng, 25),
        21, 5 + seedRoll(rng, 25),
        214, i % 3 === 1 ? 0 : 2 + seedRoll(rng, 24),
        215, i % 3 === 2 ? 0 : 2 + seedRoll(rng, 18),
      ]
    } else if (itemVariant === 1) {
      it = [
        21, 8 + seedRoll(rng, 25),
        22, 20 + seedRoll(rng, 45),
        23, 14 + seedRoll(rng, 30),
        24, 32 + seedRoll(rng, 60),
        159, 6 + seedRoll(rng, 20),
        160, 15 + seedRoll(rng, 35),
        17, 15 + seedRoll(rng, 140),
        18, 10 + seedRoll(rng, 110),
        31, 15 + seedRoll(rng, 90),
        16, i % 3 === 0 ? 0 : 20 + seedRoll(rng, 80),
        218, 2 + seedRoll(rng, 16),
        219, 2 + seedRoll(rng, 14),
      ]
    } else {
      it = [
        31, 40 + seedRoll(rng, 180),
        16, 25 + seedRoll(rng, 120),
        22, 12 + seedRoll(rng, 40),
        17, i % 2 === 0 ? 0 : 20 + seedRoll(rng, 90),
        73, 25 + seedRoll(rng, 50),
        75, 15 + seedRoll(rng, 60),
        92, 18 + seedRoll(rng, 45),
        94, -10 - seedRoll(rng, 30),
        214, 3 + seedRoll(rng, 20),
        215, 3 + seedRoll(rng, 16),
        218, i % 2 === 0 ? 4 + seedRoll(rng, 12) : 0,
      ]
    }
    if (it.length === 0) {
      throw new Error('Invariant violation: itemStats must be non-empty on all l-domain records')
    }

    const rm = i % 8
    const sig = `${uType}:${cls}:${env.join(',')}:${rm}:${p.join(',')}|${c1.join(',')}|${c2.join(',')}|${it.join(',')}`
    i++
    if (seen.has(sig)) continue
    seen.add(sig)

    out.push({
      uType,
      cls,
      env,
      p,
      c1,
      c2,
      it,
      rm,
      req: {
        uType,
        pClass: cls,
        envTimeOfDay: tod,
        envTicks: ticks,
        envTicksPerDeg: ticksPerDeg,
        pStats: p,
        c1Stats: c1,
        c2Stats: c2,
        itemStats: it,
        removeMask: rm,
        qStats: KERN_10K_ML_QSTATS,
        qItemStats: KERN_10K_ML_QITEM_STATS,
      },
    })
  }
  return out
}

function buildStateSeqInputs(): Array<{
  readonly uType: number
  readonly noStatList: 0 | 1
  readonly initFlags2: number
  readonly hasRoom: 0 | 1
  readonly roomFlags: number
  readonly steps: number[]
  readonly req: StatesSeqCallRequest113c & { readonly hasRoom?: 0 | 1; readonly roomFlags?: number }
}> {
  const rng = seedInit(0x6fd88730, 666)
  const seen = new Set<string>()
  const out: Array<{
    readonly uType: number
    readonly noStatList: 0 | 1
    readonly initFlags2: number
    readonly hasRoom: 0 | 1
    readonly roomFlags: number
    readonly steps: number[]
    readonly req: StatesSeqCallRequest113c & { readonly hasRoom?: 0 | 1; readonly roomFlags?: number }
  }> = []

  const addPlan = (
    uType: number,
    noStatList: 0 | 1,
    initFlags2: number,
    steps: number[],
    hasRoom: 0 | 1 = 0,
    roomFlags = 0,
  ): void => {
    const f2 = initFlags2 >>> 0
    const rf = roomFlags >>> 0
    const sig = `${uType}:${noStatList}:${f2}:${hasRoom}:${rf}:${steps.join(',')}`
    if (seen.has(sig)) return
    seen.add(sig)
    out.push({
      uType,
      noStatList,
      initFlags2: f2,
      hasRoom,
      roomFlags: rf,
      steps,
      req: { uType, noStatList, initFlags2: f2, hasRoom, roomFlags: rf, steps },
    })
  }

  // 1. Coexisting & single `0x08` states (`63, 93, 119, 139, 140, 176, 177`) across unit types `0..5`:
  //    set sA -> set sB -> clear sA (`0x08` stays set via `0x6FD83C20`!) -> clear sB (`0x08` clears!),
  //    plus `kind=4` (`#10866` `0x6FD83D10` -> `0x6FD83C20` `STATES_CheckStateMaskOnUnit`) across multiple masks!
  for (let aIdx = 0; aIdx < STATES_FLAG08_IDS.length; aIdx++) {
    for (let bIdx = 0; bIdx < STATES_FLAG08_IDS.length; bIdx++) {
      if (aIdx === bIdx) continue
      const sA = STATES_FLAG08_IDS[aIdx]!
      const sB = STATES_FLAG08_IDS[bIdx]!
      for (let uType = 0; uType < 6; uType++) {
        const otherSid = (aIdx + bIdx + uType) % 5 === 0 ? 184 : ((aIdx * 29 + bIdx * 17 + uType * 11) % 184) + 1
        const initFlags2 = ((uType * 0x100) | (aIdx % 2 === 0 ? 0x04 : 0x20)) >>> 0
        const maskIdx = STATE_MASK_INDICES_113C[(aIdx * 7 + bIdx * 3 + uType) % STATE_MASK_INDICES_113C.length]!
        const hasRoom: 0 | 1 = (aIdx + bIdx + uType) % 3 === 0 ? 1 : 0
        const roomFlags = (aIdx + uType) % 6 === 0 ? 4 : 0
        const toggleKind = hasRoom === 1 && (uType <= 1 || uType === 3) ? 3 : 0
        const steps = [
          toggleKind, sA, 1,
          2, sA, 0,
          4, 16, 0, // mask 16 = disguise
          toggleKind, otherSid, 1,
          4, maskIdx, 0,
          toggleKind, sB, 1,
          toggleKind, sA, 0, // sB still active -> 0x6FD83C20 keeps 0x08 set!
          2, sA, 0,
          2, sB, 0,
          4, 16, 0,
          ...(bIdx % 2 === 0 ? [toggleKind, sB, 0, 2, sB, 0, 4, 16, 0] : []),
        ]
        addPlan(uType, 0, initFlags2, steps, hasRoom, roomFlags)
      }
    }
  }

  // 2. `noStatList: 1` (`pStatListEx == NULL`) across unit types `0..5` & `0x08` states:
  //    DLL returns immediately without allocating `pStatListEx` and without touching `unit+0xC8`.
  for (let k = 0; k < 120; k++) {
    const uType = k % 6
    const initFlags2 = (k % 2 === 0 ? 0x08 | ((k & 7) << 4) : (k & 15) << 4) >>> 0
    const s1 = STATES_FLAG08_IDS[k % STATES_FLAG08_IDS.length]!
    const s2 = k % 9 === 0 ? 184 : (k * 7 + 3) % 185
    const oob = k % 2 === 0 ? -(1 + k) : 185 + k
    const maskIdx = STATE_MASK_INDICES_113C[k % STATE_MASK_INDICES_113C.length]!
    const hasRoom: 0 | 1 = k % 2 === 0 ? 1 : 0
    const steps = [
      0, s1, k % 2 === 0 ? 0 : 1,
      3, s2, 1,
      3, oob, 1,
      1, s1, 0,
      2, s1, 0,
      2, s2, 0,
      2, oob, 0,
      4, maskIdx, 0,
    ]
    addPlan(uType, 1, initFlags2, steps, hasRoom, 0)
  }

  // 3. Multi-word (`w0..w5`, including `stateId = 184` `uberminion`), `D2Common.#11039` (`kind=1` `0x6FD84450`
  //    `STATES_ToggleGfxStateFlag`), `D2Common.#10945` (`kind=3` `0x6FD84510` with room update queue mutations
  //    and `#10796` `kind=5` `UNITROOM_ClearUpdateQueue`), `D2Common.#10866` (`kind=4` `0x6FD83D10` -> `0x6FD83C20`
  //    across all `STATE_MASK_INDICES_113C`), and OOB `< 0` and `>= 185` routed through `#10945` & `#10494`.
  let idx = 0
  while (out.length < 2000) {
    const uType = idx % 6
    const initFlags2 = ((seedRoll(rng, 16) << 4) | (idx % 9 === 0 ? 0x08 : 0)) >>> 0
    const hasRoom: 0 | 1 = idx % 2 === 0 ? 1 : 0
    const roomFlags = hasRoom === 1 && idx % 8 === 0 ? 4 : 0
    const useExportToggle = hasRoom === 1 && (uType <= 1 || uType === 3)
    const toggleKind = useExportToggle ? 3 : 0
    const nToggles = 3 + (idx % 3) // 3..5 state toggles per record
    const steps: number[] = []
    const chosen: number[] = []
    // Ensure every state 0..184 (including 184 = uberminion) is thoroughly covered across all 6 bitvector words
    const primarySid = idx % 185
    chosen.push(primarySid)
    steps.push(toggleKind, primarySid, 1)
    if (idx % 3 === 0) {
      // Call D2Common.#11039 (0x6FD84450 STATES_ToggleGfxStateFlag) to clear or set gfx bit
      steps.push(1, primarySid, 0)
      if (useExportToggle && idx % 6 === 0) {
        steps.push(5, 0, 0) // flush room update queue before re-toggle!
      }
      steps.push(toggleKind, primarySid, idx % 6 === 0 ? 1 : 0)
    } else if (idx % 3 === 1) {
      // Also test D2Common.#11039 setting gfx bit (`bSet = 1`) and OOB no-op on #11039
      steps.push(1, primarySid, 0)
      steps.push(1, primarySid, 1)
    }
    for (let t = 1; t < nToggles; t++) {
      const sid =
        t === 1 && idx % 4 === 0
          ? STATES_FLAG08_IDS[seedRoll(rng, STATES_FLAG08_IDS.length)]!
          : t === 2 && idx % 7 === 0
            ? 184
            : seedRoll(rng, 185)
      chosen.push(sid)
      steps.push(toggleKind, sid, seedRoll(rng, 2))
    }
    if (idx % 5 === 0 && chosen.length >= 2) {
      steps.push(toggleKind, chosen[1]!, 0)
    }
    for (const cSid of chosen.slice(0, 3)) {
      steps.push(2, cSid, 0)
    }
    // Check multiple `fStateMasks[idx]` via `0x6FD83D10 -> 0x6FD83C20` (`kind=4`)
    const m1 = STATE_MASK_INDICES_113C[idx % STATE_MASK_INDICES_113C.length]!
    const m2 = STATE_MASK_INDICES_113C[(idx + 5) % STATE_MASK_INDICES_113C.length]!
    steps.push(4, m1, 0)
    steps.push(4, m2, 0)
    // Route OOB (`< 0` and `>= 185`) through BOTH D2Common.#10945 (`kind=3`) and D2Common.#10494 (`kind=2`)!
    const oobSid = idx % 2 === 0 ? -1 - (idx % 300) : 185 + (idx % 300)
    steps.push(3, oobSid, 1)
    steps.push(2, oobSid, 0)
    addPlan(uType, 0, initFlags2, steps, hasRoom, roomFlags)
    idx++
  }
  return out
}

function buildEventTimerSeqInputs(): Array<{
  readonly initFrame: number
  readonly ops: number[]
  readonly req: EventTimerSeqCallRequest113c
}> {
  const rng = seedInit(0x6fcaea80, 666)
  const seen = new Set<string>()
  const out: Array<{
    readonly initFrame: number
    readonly ops: number[]
    readonly req: EventTimerSeqCallRequest113c
  }> = []

  const addSeq = (initFrame: number, ops: number[]): void => {
    const f0 = initFrame >>> 0
    const sig = `${f0}:${ops.join(',')}`
    if (seen.has(sig)) return
    seen.add(sig)
    out.push({ initFrame: f0, ops, req: { initFrame: f0, ops } })
  }

  // Category 1 (600 records): Coexisting `type 0` and `type 1` on monster `u0` + `MONSTER_ClearModeEvents` (`cmd=3`)
  // in both `[0, 1]` and `[1, 0]` orders, interspersed with `type 2 / 3 / 11` events, testing 2-pass `0` then `1`
  // deletion order in `freeTop` + `u0Chain` + `EVENT_UpdateTimers` firing of surviving events!
  for (let i = 0; i < 600; i++) {
    const initFrame = [60, 63, 64, 127, 250, 785, 1023, 4094][i % 8]! + Math.floor(i / 8) * 3
    const d0 = 1 + (i % 20)
    const d1 = 1 + ((i * 7 + 3) % 25)
    const d2 = 2 + ((i * 5 + 1) % 18)
    const dOther = 1 + ((i * 3 + 2) % 15)
    const order01 = i % 2 === 0
    const ops: number[] = []
    if (i % 3 === 0) {
      ops.push(1, 0, 11, initFrame + dOther, 1100 + i, 0)
    }
    if (order01) {
      ops.push(1, 0, 0, initFrame + d0, 10 + i, 1)
      ops.push(1, 0, 1, initFrame + d1, 20 + i, 2)
    } else {
      ops.push(1, 0, 1, initFrame + d1, 20 + i, 2)
      ops.push(1, 0, 0, initFrame + d0, 10 + i, 1)
    }
    // Sometimes add multiple type 0 / type 1 events with cb_b (0x10000) so >2 nodes are freed in 2 passes!
    if (i % 4 === 0) {
      ops.push(1, 0, 0, initFrame + d0 + 4, 30 + i, 0x10003)
      ops.push(1, 0, 1, initFrame + d1 + 5, 40 + i, 0x10004)
    }
    ops.push(1, 0, 2, initFrame + d2, 50 + i, 5)
    ops.push(1, 2, 3, initFrame + dOther, 60 + i, 6) // player event in partition 0
    ops.push(8, 0, 0, 0, 0, 0) // GetNextEventFrame(u0, 0) before clear
    ops.push(8, 0, 1, 0, 0, 0) // GetNextEventFrame(u0, 1) before clear
    ops.push(3, 0, 0, 0, 0, 0) // MONSTER_ClearModeEvents(game, u0) -> 2-pass delete 0 then 1!
    ops.push(8, 0, 0, 0, 0, 0) // GetNextEventFrame(u0, 0) after clear
    ops.push(8, 0, 2, 0, 0, 0) // GetNextEventFrame(u0, 2) after clear
    // Half stop right after ClearModeEvents so `freeTop` directly holds the newly freed 0/1 nodes at head;
    // half step frames via `EVENT_UpdateTimers` (`cmd=9`) to verify node reuse + firing order!
    if (i % 2 === 1) {
      const stepFrames = Math.max(d2, dOther) + 2
      ops.push(9, 0, stepFrames, 0, 0, 0)
    }
    addSeq(initFrame, ops)
  }

  // Category 2 (600 records): Monster `EVENT_SetEvent(evType=2)` WITH `state 0x36` active (`0x6FD02240` branch!).
  // Diversified across:
  //   - Monsters `u0` (id=101) and `u6` (id=103),
  //   - Varied event chains with 1..3 queued `evType=2` nodes (mixed `cb_a`/`cb_b`) + neighboring `evType = 0, 1, 3, 7, 11`,
  //   - `pUnit + 0x80 == 0` cases (`cmd=10, uIdx, 0` before `SetEvent(evType=2)` -> `0x6FD0227E` early exit after
  //     clearing `0x36`, leaving prior `evType=2` nodes intact!),
  //   - `state 92` (`0x5C` `corpse_nodraw`) active alongside `state 0x36` (`0x6FD02280..0x6FD022D1` clears `0x5C`,
  //     runs `0x6FCFEEE0`, and frees all prior `evType=2` nodes)!
  for (let i = 0; i < 600; i++) {
    const initFrame = 100 + i * 5
    const uIdx = i % 5 === 4 ? 6 : 0 // 80% monster u0 (id=101), 20% monster u6 (id=103)
    const dEarly = 2 + (i % 12)
    const dMid = dEarly + 2 + (i % 6)
    const dReplacement = dMid + 3 + (i % 12)
    const hasNullUnitGame = i % 6 === 5
    const hasState5C = !hasNullUnitGame && i % 3 === 1
    const hasMultiType2 = i % 2 === 0
    const neighborType = [0, 1, 3, 7, 11][i % 5]!
    const ops: number[] = [
      // Initial AI_THINK (evType=2) with cb_b (0x10000) so normal `(evType, cb_a)` dedup in SetEvent
      // would NOT remove it — ONLY `0x6FD02240` removes it (unless `pUnit+0x80 == 0` exits early at `0x6FD0227E`!)
      1, uIdx, 2, initFrame + dEarly, 200 + i, 0x10001,
      1, uIdx, neighborType, initFrame + dEarly + 2, 300 + i, 2,
      ...(hasMultiType2
        ? [
            // Queue a second `evType=2` node (and a persistent event when i % 4 === 0) so `0x6FD02240` walks a multi-node chain
            1, uIdx, 2, initFrame + dMid, 250 + i, 0x10002,
          ]
        : []),
      // Activate state 0x36 (54) on the monster
      7, uIdx, 0x36, 1, 0, 0,
      // Activate state 0x5C (92 corpse_nodraw) on a subset to exercise 0x6FD02280..0x6FD022D1!
      ...(hasState5C ? [7, uIdx, 0x5c, 1, 0, 0] : []),
      // Also optionally activate a 0x08 state (or state 184) to verify state/flags preservation alongside 0x36/0x5C clear
      ...(i % 3 === 0 ? [7, uIdx, STATES_FLAG08_IDS[i % STATES_FLAG08_IDS.length]!, 1, 0, 0] : []),
      ...(i % 11 === 0 ? [7, uIdx, 184, 1, 0, 0] : []),
      // When testing `pUnit+0x80 == 0` early exit at `0x6FD0227E`, temporarily zero `pUnit->pGame` (+0x80)
      ...(hasNullUnitGame ? [10, uIdx, 0, 0, 0, 0] : []),
      // Schedule new AI_THINK (evType=2) with cb_a -> triggers 0x6FD02240!
      1, uIdx, 2, initFrame + dReplacement, 400 + i, 3,
      ...(hasNullUnitGame ? [10, uIdx, 1, 0, 0, 0] : []),
      8, uIdx, 2, 0, 0, 0, // NextFrame(evType=2): initFrame+dEarly when pUnit+0x80==0, else initFrame+dReplacement!
      9, 0, dReplacement + 3, 0, 0, 0,
    ]
    addSeq(initFrame, ops)
  }

  // Category 3 (600 records): `EVENT_DeleteEventByArg14` (`0x6FCAE900`, `cmd=5`: `arg14 == 0` wildcard vs exact `arg14`)
  // and `EVENT_DeleteEventByType` (`0x6FCAE8C0`, `cmd=4`: `pfn == NULL` vs `cb_a` vs `cb_b`) + `EVENT_RemoveUnitEvents` (`cmd=6`).
  for (let i = 0; i < 600; i++) {
    const initFrame = 50 + (i % 128) + Math.floor(i / 128) * 64
    const a1 = 10 + (i % 7)
    const a2 = a1 + 1 + (i % 5)
    const evT = [0, 1, 2, 3, 7, 11][i % 6]!
    const ops: number[] = [
      1, 0, evT, initFrame + 3 + (i % 10), a1, 10,
      1, 0, evT, initFrame + 5 + (i % 12), a2, 0x10011, // cb_b so both coexist on u0!
      1, 1, evT, initFrame + 4 + (i % 9), a1, 12,
      2, 0, (evT + 1) % 12, 0, 900 + i, 13, // persistent event on u0
    ]
    if (i % 3 === 0) {
      // Exact arg14 match: deletes only `a1`, keeps `a2`
      ops.push(5, 0, evT, a1, 0, 0)
    } else if (i % 3 === 1) {
      // Wildcard `arg14 == 0`: deletes ALL `evT` nodes on `u0` regardless of handler!
      ops.push(5, 0, evT, 0, 0, 0)
    } else {
      // DeleteEventByType with specific callback filter (`0=NULL`, `1=cb_a`, `2=cb_b`)
      ops.push(4, 0, evT, i % 6 === 2 ? 1 : 2, 0, 0)
    }
    if (i % 5 === 0) {
      ops.push(6, 1, 0, 0, 0, 0) // RemoveUnitEvents on u1
    }
    ops.push(8, 0, evT, 0, 0, 0)
    ops.push(9, 0, 18 + (i % 15), 0, 0, 0)
    addSeq(initFrame, ops)
  }

  // Category 4 (1,200 records): Full 5-partition (`missile u3`, `monster u0/u1`, `player u2/u7`, `item u5`, `object u4`)
  // multi-frame wheel wrap-around (`1..70` frames), clamping (`targetFrame <= dwGameFrame`), persistent timers (`cmd=2`),
  // and re-entrant callback mutations (`0xA000 | (reCmd << 8) | reArg`)!
  let idx = 0
  while (out.length < 3000) {
    const baseWrap = [0, 1, 62, 63, 64, 126, 127, 128, 511, 1023, 65534][idx % 11]!
    const initFrame = baseWrap + seedRoll(rng, 32)
    const nSetup = 6 + (idx % 7) // 6..12 setup timer calls + queries + UpdateTimers
    const ops: number[] = []
    for (let s = 0; s < nSetup; s++) {
      const uIdx = [0, 1, 2, 3, 4, 5, 7][(idx + s) % 7]!
      const evType = seedRoll(rng, 14)
      if (s === 0 && idx % 4 === 0) {
        // Persistent timer that fires every frame (until deleted or re-entrantly cleared)
        const reSpec = idx % 8 === 0 ? 0xa400 : 0 // reCmd=4 RemoveUnitEvents on self after first fire!
        ops.push(2, uIdx, evType, 0, 700 + idx, reSpec)
      } else {
        // Mix clamped (`<= initFrame`), near (`+1..+20`), and >64-slot ring wrap (`+64..+69`) frames
        const delta =
          s === 1 && idx % 3 === 0
            ? -seedRoll(rng, 5) // clamped to initFrame + 1
            : s === 2 && idx % 3 === 1
              ? 64 + seedRoll(rng, 6) // multi-revolution ring wrap (`nQueueIdx > 0` skip until revolution matches!)
              : 1 + seedRoll(rng, 30)
        const cbBit = seedRoll(rng, 2) === 1 ? 0x10000 : 0
        let reSpec = idx % 9 + s
        if (s === 0 && idx % 5 === 0) {
          // Re-entrant callback schedules a follow-up event (`reCmd=5`) or clears mode events (`reCmd=3`)
          const reCmd = idx % 10 === 0 ? 3 : 5
          const reArg = reCmd === 5 ? (2 << 4) | (evType & 0x0f) : 0
          reSpec = 0xa000 | (reCmd << 8) | reArg
        }
        ops.push(1, uIdx, evType, Math.max(0, initFrame + delta), 1000 + idx * 10 + s, cbBit | reSpec)
      }
    }
    ops.push(8, 0, ops[2]!, 0, 0, 0)
    const runFrames = idx % 3 === 1 ? 66 + (idx % 5) : 12 + (idx % 35) // up to 70 frames!
    ops.push(9, 0, runFrames, 0, 0, 0)
    addSeq(initFrame, ops)
    idx++
  }
  return out
}

function buildSunitRoomInputs(): Array<{
  readonly roomFlags: number
  readonly initCounters: number[]
  readonly units: number[]
  readonly ops: number[]
  readonly req: SunitRoomCallRequest113c
}> {
  const rng = seedInit(0x6fd00310, 666)
  const seen = new Set<string>()
  const out: Array<{
    readonly roomFlags: number
    readonly initCounters: number[]
    readonly units: number[]
    readonly ops: number[]
    readonly req: SunitRoomCallRequest113c
  }> = []

  let idx = 0
  while (out.length < 500) {
    const roomFlags = idx % 6 === 0 ? 4 : 0 // 0x04 = ROOMFLAG_INACTIVE (skips room update queue!)
    // Include BOTH `0xFFFFFFFE` (where `old + 1 == 0xFFFFFFFF -> wraps to 1` at `0x6FCFF9EC`!)
    // and `0xFFFFFFFF` (where `old + 1 == 0 -> returns 0`) in `initCounters`!
    const initCounters = [
      idx % 12 === 0 ? 0xfffffffe : seedRoll(rng, 20),
      idx % 12 === 2 ? 0xfffffffe : 100 + seedRoll(rng, 50),
      200 + seedRoll(rng, 50),
      300 + seedRoll(rng, 50),
      400 + seedRoll(rng, 50),
      idx % 10 === 0 ? 0xfffffffe : idx % 10 === 5 ? 0xffffffff : seedRoll(rng, 30),
    ]

    const nUnits = 4 + (idx % 5) // 4..8 units
    const units: number[] = []
    const baseBucket = idx & 127
    const usedTypeIds = new Set<string>()
    for (let u = 0; u < nUnits; u++) {
      const ut = u === 0 ? 0 : u === 1 && idx % 3 === 0 ? 1 : [0, 1, 2, 3, 4, 5][(idx + u) % 6]!
      const cid = 1 + seedRoll(rng, 100)
      // Deliberately create hash collisions (`uid & 127 === baseBucket`) in descending/ascending orders!
      let uid =
        u < 3
          ? baseBucket + 128 * (1 + ((idx + u * 3) % 12))
          : 1 + seedRoll(rng, 1024)
      while (usedTypeIds.has(`${ut}:${uid}`)) uid += 128
      usedTypeIds.add(`${ut}:${uid}`)
      const x = 5005 + seedRoll(rng, 180)
      const y = 5005 + seedRoll(rng, 180)
      const isStatic = ut === 2 || ut === 4 || ut === 5
      // `hasPath === 2` on a monster (`ut === 1`) configures an alignment-2 converted monster
      // (`state 17` conversion + `state 105` sublist `stat 172 = 2`) so `#10531` (`0x6FDB6800`)
      // increments `pRoom->nPlayers (+0x28)` and `#11016` (`0x6FDB6700`) decrements it!
      const hasPath =
        !isStatic && u === nUnits - 1 && idx % 5 === 0
          ? 0
          : ut === 1 && (u === 1 || idx % 2 === 0)
            ? 2
            : 1
      units.push(ut, cid, uid, x, y, hasPath)
    }

    const ops: number[] = []
    // 1. Allocate new IDs (`SUNIT_GetNewUnitId` 0x6FCFF9C0, including `0xFFFFFFFE -> 1` and `1 -> 2`)
    ops.push(1, idx % 6, 0, 0)
    ops.push(1, 5, 0, 0)
    if (idx % 10 === 0 || idx % 10 === 5) {
      ops.push(1, 5, 0, 0) // second call after wrap!
    }
    // 2. Insert units into server hash table (`SUNIT_InsertServerUnit` 0x6FD00310) & spatial room (`#10531`)
    for (let u = 0; u < nUnits; u++) {
      ops.push(2, u, 0, 0)
      ops.push(5, u, 0, 0) // UNITS_GetX / UNITS_GetY (including dynamic hasPath=0 returning 0,0)
      if ((u % 2 === 0 || units[u * 6] === 0 || units[u * 6 + 5] === 2) && units[u * 6 + 5] !== 0) {
        ops.push(6, u, 0, 0) // UNITROOM_AddUnitToRoom
      }
    }
    // 3. Lookup existing & missing IDs (`SUNIT_GetServerUnit` 0x6FD003A0, including early-exit descending walk)
    for (let u = 0; u < Math.min(4, nUnits); u++) {
      const ut = units[u * 6]!
      const uid = units[u * 6 + 2]!
      ops.push(3, ut, uid, 0)
      ops.push(3, ut, uid + 128, 0) // same bucket miss
    }
    // 4. Refresh units (`#10158` `UNITROOM_RefreshUnit`), testing dedup (`UNITFLAG_ISUPDATE 0x2000`) & clear
    ops.push(7, 0, 0, 0)
    ops.push(7, 0, 0, 0) // idempotent second refresh while 0x2000 set!
    if (nUnits > 2) ops.push(7, 2, 0, 0)
    if (idx % 4 === 0) {
      ops.push(9, 0, 0, 0) // flush room update queue via D2Common 0x6FDB63B0 (clears 0x2000 + pUpdateList)
      ops.push(9, 0, idx % 8 === 0 ? 4 : 0, 0) // optionally toggle room inactive flag
      ops.push(7, 0, 0, 0) // re-refresh u0 after update queue flush!
    }
    // 5. Remove from server hash (`0x6FD002A0` leaving `+0xE4` intact & clearing `+0xC8 & ~2`) & room (`#11016`)
    const remIdx = idx % nUnits
    ops.push(4, remIdx, 0, 0)
    ops.push(3, units[remIdx * 6]!, units[remIdx * 6 + 2]!, 0) // verify lookup returns -1 after remove!
    ops.push(8, 0, 0, 0)
    if (idx % 3 === 0 && nUnits > 1) {
      ops.push(8, 1, 0, 0) // also remove u1 (often alignment-2 converted monster!) to test nPlayers decrement
    }
    if (idx % 3 === 1 && nUnits > 2) {
      ops.push(8, 2, 0, 0)
    }

    const sig = `${roomFlags}:${initCounters.join(',')}|${units.join(',')}|${ops.join(',')}`
    idx++
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push({
      roomFlags,
      initCounters,
      units,
      ops,
      req: { roomFlags, initCounters, units, ops },
    })
  }
  return out
}

async function main(): Promise<void> {
  const daemon = new FnOracleDaemon({ workerId: 1 })
  console.log('[collect-kern-10k] Booting warm fnharness v2 Wine daemon...')
  const info = await daemon.start()
  console.log(
    `[collect-kern-10k] Daemon ready (pid=${info.pid}, game=0x${info.game.toString(16)}, player=0x${info.player.toString(16)}, monster=0x${info.monster.toString(16)})`,
  )

  const records: Kern10kDiffRecord113c[] = []

  try {
    // 1. Domain M: 2,500 unique mulDiv113c records (D2Common 0x6FD511E0 & D2Game 0x6FC214D0)
    const mulInputs = buildMulDivInputs()
    const mulOps: number[][] = []
    for (const [f, v, d] of mulInputs) {
      mulOps.push([20, v, f, d])
      mulOps.push([51, v, f, d])
    }
    const mulRes = await daemon.execArrayOps(mulOps, 60_000)
    for (let i = 0; i < mulInputs.length; i++) {
      const [f, v, d] = mulInputs[i]!
      const c = mulRes.results[i * 2]![0]
      const g = mulRes.results[i * 2 + 1]![0]
      if (typeof c !== 'number' || typeof g !== 'number') {
        throw new Error(`mulDiv fault at #${i}: c=${String(c)}, g=${String(g)}`)
      }
      records.push({ k: 'm', f, v, d, c, g })
    }
    console.log(
      `[collect-kern-10k] Recorded ${mulInputs.length} unique mulDiv113c records in ${mulRes.elapsedMs.toFixed(1)}ms`,
    )

    // 2. Domain S: 3,600 unique SNAP_CALL D2StatListEx snapshots
    const statInputs = buildStatSnapInputs()
    let statElapsed = 0
    for (let start = 0; start < statInputs.length; start += 400) {
      const slice = statInputs.slice(start, start + 400)
      const batch = await daemon.execSnapBatch(
        slice.map((s) => s.req),
        60_000,
      )
      statElapsed += batch.elapsedMs
      for (let j = 0; j < slice.length; j++) {
        const item = slice[j]!
        const resp = batch.responses[j]! as typeof batch.responses[number] & {
          readonly hasStatList?: 0 | 1
          readonly modStats?: readonly number[]
        }
        if (resp.fault !== 0) {
          throw new Error(`SNAP_CALL fault at stat #${start + j}`)
        }
        const flatQ: number[] = []
        for (const [, bv, fv] of resp.qStats) flatQ.push(bv | 0, fv | 0)
        records.push({
          k: 's',
          mode: item.mode,
          cls: item.cls,
          ...(item.noStatList === 1 ? { noStatList: 1 } : {}),
          p: item.p,
          sid: item.sid,
          val: item.val,
          eax: resp.eax | 0,
          hasStatList: resp.hasStatList ?? 1,
          modStats: (resp.modStats ?? []).map((v) => v >>> 0),
          q: flatQ,
        })
      }
    }
    console.log(
      `[collect-kern-10k] Recorded ${statInputs.length} unique D2StatListEx SNAP_CALL records in ${statElapsed.toFixed(1)}ms`,
    )

    // 3. Domain L: 1,500 unique MULTILIST_STAT_CALL (op 201) records (100% real item + unmodified ISC)
    const mlInputs = buildMultilistInputs()
    let mlElapsed = 0
    for (let start = 0; start < mlInputs.length; start += 250) {
      const slice = mlInputs.slice(start, start + 250)
      const batch = await daemon.execMultilistBatch(
        slice.map((s) => s.req),
        60_000,
      )
      mlElapsed += batch.elapsedMs
      for (let j = 0; j < slice.length; j++) {
        const item = slice[j]!
        const resp = batch.responses[j]!
        if (resp.fault !== 0) {
          throw new Error(`MULTILIST_STAT_CALL fault at #${start + j}`)
        }
        const flatQ: number[] = []
        for (const [, bv, fv] of resp.qStats) flatQ.push(bv | 0, fv | 0)
        const flatQi: number[] = []
        for (const [, bv, fv] of resp.qItemStats) flatQi.push(bv | 0, fv | 0)
        let flatQp: number[] | undefined
        if (resp.qStatsPost) {
          flatQp = []
          for (const [, bv, fv] of resp.qStatsPost) flatQp.push(bv | 0, fv | 0)
        }
        records.push({
          k: 'l',
          uType: item.uType,
          cls: item.cls,
          env: item.env,
          p: item.p,
          c1: item.c1,
          c2: item.c2,
          it: item.it,
          rm: item.rm,
          q: flatQ,
          qi: flatQi,
          ...(flatQp ? { qp: flatQp } : {}),
        })
      }
    }
    console.log(
      `[collect-kern-10k] Recorded ${mlInputs.length} unique MULTILIST_STAT_CALL records in ${mlElapsed.toFixed(1)}ms`,
    )

    // 4. Domain T: 2,000 unique multi-step STATES_SEQ_CALL (op 202) records
    const stInputs = buildStateSeqInputs()
    let stElapsed = 0
    for (let start = 0; start < stInputs.length; start += 400) {
      const slice = stInputs.slice(start, start + 400)
      const batch = await daemon.execStatesSeqBatch(
        slice.map((s) => s.req),
        60_000,
      )
      stElapsed += batch.elapsedMs
      for (let j = 0; j < slice.length; j++) {
        const item = slice[j]!
        const resp = batch.responses[j]! as typeof batch.responses[number] & {
          readonly unitFlags?: number
          readonly actFlag?: number
          readonly roomUpdated?: 0 | 1
        }
        if (resp.fault !== 0) {
          throw new Error(`STATES_SEQ_CALL fault at #${start + j}`)
        }
        records.push({
          k: 't',
          uType: item.uType,
          noStatList: item.noStatList,
          initFlags2: item.initFlags2,
          ...(item.hasRoom === 1 ? { hasRoom: 1, roomFlags: item.roomFlags } : {}),
          steps: item.steps,
          hasStatList: resp.hasStatList,
          unitFlags: (resp.unitFlags ?? 0) >>> 0,
          unitFlags2: resp.unitFlags2 >>> 0,
          actFlag: (resp.actFlag ?? 0) >>> 0,
          roomUpdated: resp.roomUpdated ?? 0,
          stateFlags: resp.stateFlags,
          gfxFlags: resp.gfxFlags,
          stepFlags2: resp.stepFlags2.map((v) => v >>> 0),
          checks: resp.checks,
        })
      }
    }
    console.log(
      `[collect-kern-10k] Recorded ${stInputs.length} unique STATES_SEQ_CALL records in ${stElapsed.toFixed(1)}ms`,
    )

    // 5. Domain E: 3,000 unique multi-op stateful EVENT_TIMER_SEQ_CALL (op 203) records
    const evInputs = buildEventTimerSeqInputs()
    let evElapsed = 0
    for (let start = 0; start < evInputs.length; start += 300) {
      const slice = evInputs.slice(start, start + 300)
      const batch = await daemon.execEventTimerSeqBatch(
        slice.map((s) => s.req),
        60_000,
      )
      evElapsed += batch.elapsedMs
      for (let j = 0; j < slice.length; j++) {
        const item = slice[j]!
        const resp = batch.responses[j]! as typeof batch.responses[number] & {
          readonly u0State5C?: number
          readonly u6State5C?: number
        }
        if (resp.fault !== 0) {
          throw new Error(`EVENT_TIMER_SEQ_CALL fault at #${start + j}`)
        }
        records.push({
          k: 'e',
          initFrame: item.initFrame,
          ops: item.ops,
          endFrame: resp.endFrame >>> 0,
          u0State36: resp.u0State36,
          u6State36: resp.u6State36,
          u0State5C: resp.u0State5C ?? 0,
          u6State5C: resp.u6State5C ?? 0,
          u0Flags2: resp.u0Flags2 >>> 0,
          fired: resp.fired,
          nextFrames: resp.nextFrames,
          freeTop: resp.freeTop,
          u0Chain: resp.u0Chain,
        })
      }
    }
    console.log(
      `[collect-kern-10k] Recorded ${evInputs.length} unique EVENT_TIMER_SEQ_CALL records in ${evElapsed.toFixed(1)}ms`,
    )

    // 6. Domain U: 500 unique SUNIT_UNITROOM_CALL (op 204) records
    const suInputs = buildSunitRoomInputs()
    let suElapsed = 0
    for (let start = 0; start < suInputs.length; start += 250) {
      const slice = suInputs.slice(start, start + 250)
      const batch = await daemon.execSunitRoomBatch(
        slice.map((s) => s.req),
        60_000,
      )
      suElapsed += batch.elapsedMs
      for (let j = 0; j < slice.length; j++) {
        const item = slice[j]!
        const resp = batch.responses[j]! as typeof batch.responses[number] & {
          readonly unitFlags2?: readonly number[]
          readonly unitHashNext?: readonly number[]
        }
        if (resp.fault !== 0) {
          throw new Error(`SUNIT_UNITROOM_CALL fault at #${start + j}`)
        }
        records.push({
          k: 'u',
          roomFlags: item.roomFlags,
          initCounters: item.initCounters,
          units: item.units,
          ops: item.ops,
          nPlayers: resp.nPlayers >>> 0,
          actFlag: resp.actFlag >>> 0,
          newIds: resp.newIds,
          found: resp.found,
          coords: resp.coords,
          roomUnits: resp.roomUnits,
          roomUpdates: resp.roomUpdates,
          unitFlags: resp.unitFlags.map((v) => v >>> 0),
          unitFlags2: (resp.unitFlags2 ?? []).map((v) => v >>> 0),
          unitHashNext: resp.unitHashNext ?? [],
          unitRooms: resp.unitRooms,
        })
      }
    }
    console.log(
      `[collect-kern-10k] Recorded ${suInputs.length} unique SUNIT_UNITROOM_CALL records in ${suElapsed.toFixed(1)}ms`,
    )
  } finally {
    await daemon.close()
  }

  const lines = records.map((r) => JSON.stringify(r))
  const uniqueLines = new Set(lines)
  if (uniqueLines.size !== lines.length) {
    throw new Error(
      `Duplicate serialized records detected: ${uniqueLines.size} unique out of ${lines.length}`,
    )
  }

  mkdirSync(dirname(KERN_10K_FIXTURE_PATH), { recursive: true })
  const ndjson = lines.join('\n') + '\n'
  const gz = gzipSync(Buffer.from(ndjson, 'utf8'), { level: 9 })
  writeFileSync(KERN_10K_FIXTURE_PATH, gz)
  console.log(
    `[collect-kern-10k] Wrote ${records.length} 100%-unique DLL records (${(gz.byteLength / 1024).toFixed(1)} KiB) -> ${KERN_10K_FIXTURE_PATH}`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
