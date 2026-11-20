import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  EVENT_SetEventFull113c,
  GAME_Create113c,
  Heap113c,
  MONSTER_ClearModeEvents113c,
  mulDiv113c,
  seedInit,
  seedNext,
  STATES_CheckGfxStateFlag113c,
  STATES_CheckState113c,
  STATES_ToggleState113c,
  STATLIST_CreateEx113c,
  STATLIST_GetUnitBaseStat113c,
  STATLIST_GetUnitStat113c,
  STATLIST_SetUnitStat113c,
  SUNIT_GetNewUnitId113c,
  SUNITDMG_CheckToHit113c,
  UNIT_MONSTER,
  UNIT_PLAYER,
  UNITS_Create113c,
  UNITS_GetSeed113c,
  UNITS_SetSeed113c,
} from '../../src/d2kern-113c/index.ts'
import {
  FnOracleDaemon,
  isOracleToolchainAvailable113c,
  SNAP_PTR_MONSTER,
  SNAP_PTR_PLAYER,
} from '../../tools/oracle/fn-daemon.ts'
import {
  runFnrecDifferential113c,
  runLiveSnapshotSweep113c,
  type FnrecCallRecord113c,
  type SnapshotCase113c,
} from '../../tools/oracle/fn-snapshot-runner.ts'

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

function hasRealMutation(rec: FnrecCallRecord113c): boolean {
  const preMap = new Map<number, string>()
  for (const [addr, hex] of rec.pre) preMap.set(addr >>> 0, hex)
  for (const [addr, hex] of rec.post) {
    const preHex = preMap.get(addr >>> 0)
    if (preHex !== undefined && preHex !== hex) return true
  }
  return false
}

describe('fn-snapshot-runner §3.3 (offline multi-function fnrec differential)', () => {
  it('replays all 94 recorded EVENT_SetEvent (0x6FCAEA80) snapshots byte-identically using shipped EVENT_SetEventFull113c (zero hooks override)', () => {
    const lines = gunzipSync(readFileSync(SETEVENT_FIXTURE))
      .toString('utf8')
      .split('\n')
      .filter((l) => l.trim().length > 0)

    expect(lines.length).toBe(94)
    for (const line of lines) {
      const rec = JSON.parse(line) as FnrecCallRecord113c
      const err = runFnrecDifferential113c(rec, (m, args) => {
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
      })
      expect(err).toBeNull()
    }
  })

  it('replays all 194 non-noop STATLIST_SetUnitStat, STATES_ToggleState & MONSTER_DeleteModeEvents snapshots byte-identically using shipped kernel functions', () => {
    const lines = gunzipSync(readFileSync(K0_MULTI_FIXTURE))
      .toString('utf8')
      .split('\n')
      .filter((l) => l.trim().length > 0)

    expect(lines.length).toBe(194)
    const seen = new Map<string, number>()
    const distinctStats = new Set<number>()
    const stateCounts = new Map<number, number>()

    for (const line of lines) {
      const rec = JSON.parse(line) as FnrecCallRecord113c
      expect(hasRealMutation(rec)).toBe(true)
      seen.set(rec.fn, (seen.get(rec.fn) ?? 0) + 1)

      const err = runFnrecDifferential113c(rec, (m, args) => {
        if (rec.fn === 'STATLIST_SetUnitStat') {
          const [pUnit, statId, value, layer] = args as [number, number, number, number]
          distinctStats.add(statId | 0)
          STATLIST_SetUnitStat113c(m, pUnit, statId, value, layer)
        } else if (rec.fn === 'STATES_ToggleState') {
          const [pUnit, stateId, bSet] = args as [number, number, number]
          stateCounts.set(stateId | 0, (stateCounts.get(stateId | 0) ?? 0) + 1)
          STATES_ToggleState113c(m, pUnit, stateId, bSet !== 0)
        } else if (rec.fn === 'MONSTER_DeleteModeEvents') {
          const [pGame, pUnit] = args as [number, number]
          MONSTER_ClearModeEvents113c(m, pGame, pUnit)
        } else {
          throw new Error(`Unexpected fnrec function: ${rec.fn}`)
        }
      })
      expect(err).toBeNull()
    }

    expect(seen.get('STATLIST_SetUnitStat')).toBe(80)
    expect(seen.get('STATES_ToggleState')).toBe(39)
    expect(seen.get('MONSTER_DeleteModeEvents')).toBe(75)
    expect(distinctStats.size).toBeGreaterThanOrEqual(20)
    expect(stateCounts.size).toBeGreaterThanOrEqual(12)
    expect(stateCounts.has(93)).toBe(true) // live-game disguise state 93 (unit+0xC8 |= 0x08)
    expect(stateCounts.get(105) ?? 0).toBeLessThanOrEqual(4)
  })

  it('catches missing writes and wrong bytes in both fixed-address and newly alloc()d post-only blocks', () => {
    const rec: FnrecCallRecord113c = {
      fn: 'SYNTH_AllocAndPopulate',
      va: 0x6fd80000,
      frame: 100,
      args: [0x02000000],
      pre: [[0x02000000, '00000000']],
      post: [
        [0x02000000, '01000000'],
        [0x03000000, '1122334455667788'],
      ],
    }

    // 1. Fixed-address post-only block: complete matching writes pass
    expect(
      runFnrecDifferential113c(rec, (m, [base]) => {
        m.setU32(base!, 1)
        m.setU32(0x03000000, 0x44332211)
        m.setU32(0x03000004, 0x88776655)
      }),
    ).toBeNull()

    // 2. Fixed-address post-only block: missing write to second dword fails
    const errFixedMissing = runFnrecDifferential113c(rec, (m, [base]) => {
      m.setU32(base!, 1)
      m.setU32(0x03000000, 0x44332211)
    })
    expect(errFixedMissing).toMatch(/post-only block 0x3000000\+0x4 missing write/)

    // 3. Fixed-address post-only block: wrong byte fails
    const errFixedWrong = runFnrecDifferential113c(rec, (m, [base]) => {
      m.setU32(base!, 1)
      m.setU32(0x03000000, 0x44332211)
      m.setU32(0x03000004, 0x99776655)
    })
    expect(errFixedWrong).toMatch(/post-only block 0x3000000\+0x7 got 0x99, want 0x88/)

    // 4. Newly alloc()d post-only block: complete matching writes pass
    expect(
      runFnrecDifferential113c(rec, (m, [base]) => {
        m.setU32(base!, 1)
        const p = m.alloc(8)
        m.setU32(p, 0x44332211)
        m.setU32(p + 4, 0x88776655)
      }),
    ).toBeNull()

    // 5. Newly alloc()d post-only block: missing write to second dword fails
    const errAllocMissing = runFnrecDifferential113c(rec, (m, [base]) => {
      m.setU32(base!, 1)
      const p = m.alloc(8)
      m.setU32(p, 0x44332211)
    })
    expect(errAllocMissing).toMatch(/post-only block 0x3000000\+0x4 missing write/)

    // 6. Newly alloc()d post-only block: wrong byte fails
    const errAllocWrong = runFnrecDifferential113c(rec, (m, [base]) => {
      m.setU32(base!, 1)
      const p = m.alloc(8)
      m.setU32(p, 0x44332211)
      m.setU32(p + 4, 0x88776600)
    })
    expect(errAllocWrong).toMatch(/post-only block 0x3000000\+0x4 got 0x0, want 0x55/)
  })
})

const HAS_ORACLE = isOracleToolchainAvailable113c()

describe.skipIf(!HAS_ORACLE)('fn-snapshot-runner §3.3 (live warm fnharness v2 daemon)', () => {
  let daemon: FnOracleDaemon

  beforeAll(async () => {
    daemon = new FnOracleDaemon({ workerId: 0 })
    const info = await daemon.start()
    expect(info.game).toBeGreaterThan(0)
    expect(info.player).toBeGreaterThan(0)
  }, 120_000)

  afterAll(async () => {
    if (daemon) await daemon.close()
  }, 30_000)

  it('executes 500 mulDiv113c (0x6FD511E0 & 0x6FC214D0) differential calls on warm daemon in < 100ms', async () => {
    const rng = seedInit(0x1337c0de, 666)
    const inputs: [number, number, number][] = [
      [0, 0, 1],
      [10, 500, 0],
      [9, 1_100_037, 100],
      [-9, 1_100_037, 100],
      [9, -1_100_037, 100],
      [90_000, 50, 7],
      [-90_000, 50, 7],
      [0x20000, 0x30000, 1000],
      [256, 0x150000, 3],
    ]
    while (inputs.length < 250) {
      const a = seedNext(rng) >> 6
      const b = seedNext(rng) >> 4
      let c = seedNext(rng) % 5000
      if (c === 0) c = 100
      inputs.push([a, b, c])
    }

    const warm = await daemon.execArrayOps([[0, 42]])
    expect(warm.results[0]).toEqual([42])

    const ops: number[][] = []
    for (const [factor, value, divisor] of inputs) {
      ops.push([20, value, factor, divisor])
      ops.push([51, value, factor, divisor])
    }
    const { results, elapsedMs } = await daemon.execArrayOps(ops)
    expect(elapsedMs).toBeLessThan(100)
    for (let i = 0; i < inputs.length; i++) {
      const [factor, value, divisor] = inputs[i]!
      const expected = mulDiv113c(factor, value, divisor)
      expect(results[i * 2]).toEqual([expected])
      expect(results[i * 2 + 1]).toEqual([expected])
    }
  })

  it('verifies STATES_ToggleState (0x6FD88730), STATES_CheckState (#10494), SUNIT_GetNewUnitId (0x6FCFF9C0), EVENT_SetEvent (0x6FCAEA80) & D2Net.#10002 hook', async () => {
    const heap = new Heap113c()
    const pGame = GAME_Create113c(heap)
    const pPlayer = UNITS_Create113c(heap, UNIT_PLAYER, 4, 1, pGame)
    STATLIST_CreateEx113c(heap, pPlayer, 0, pGame)

    const testStates = [0, 1, 8, 31, 32, 0x36, 93, 95, 128, 183, 184]
    const stateOps: number[][] = []
    for (const sid of testStates) {
      stateOps.push([70, 0, sid, 0])
      stateOps.push([70, 0, sid, 1])
      stateOps.push([71, 0, sid])
      stateOps.push([72, 0, sid])
      stateOps.push([70, 0, sid, 0])
      stateOps.push([71, 0, sid])
      stateOps.push([73, 0, sid])
    }
    stateOps.push([71, 0, -1])
    stateOps.push([71, 0, 185])

    const stRes = await daemon.execArrayOps(stateOps)
    let cursor = 0
    for (const sid of testStates) {
      STATES_ToggleState113c(heap, pPlayer, sid, false)
      STATES_ToggleState113c(heap, pPlayer, sid, true)
      const expAct = STATES_CheckState113c(heap, pPlayer, sid) | 0
      const expDrt = STATES_CheckGfxStateFlag113c(heap, pPlayer, sid) | 0
      STATES_ToggleState113c(heap, pPlayer, sid, false)
      const expOff = STATES_CheckState113c(heap, pPlayer, sid) | 0

      cursor += 2
      expect(stRes.results[cursor++]).toEqual([expAct])
      expect(stRes.results[cursor++]).toEqual([expDrt])
      cursor += 1
      expect(stRes.results[cursor++]).toEqual([expOff])
      cursor += 1
    }
    expect(stRes.results[cursor++]).toEqual([0])
    expect(stRes.results[cursor++]).toEqual([0])

    const miscOps: number[][] = [
      [76, 1, 0],
      [76, 1, 41],
      [76, 3, -2],
      [77, 0, 13, 500, 400],
      [77, 0, 13, 350, 400],
      [77, 0, 13, 400, 400],
      [78, 0, 1, 0x26, 0x01, 0x02, 0x99],
    ]
    const miscRes = await daemon.execArrayOps(miscOps)
    expect(miscRes.results[0]).toEqual([SUNIT_GetNewUnitId113c(heap, pGame, 1)])
    heap.set(pGame, { off: 0x90, type: 'u32', count: 6 }, 41, 1)
    expect(miscRes.results[1]).toEqual([SUNIT_GetNewUnitId113c(heap, pGame, 1)])
    heap.set(pGame, { off: 0x90, type: 'u32', count: 6 }, 0xfffffffe, 3)
    expect(miscRes.results[2]).toEqual([SUNIT_GetNewUnitId113c(heap, pGame, 3)])
    expect(miscRes.results[3]).toEqual([500])
    expect(miscRes.results[4]).toEqual([401])
    expect(miscRes.results[5]).toEqual([401])
    expect(miscRes.results[6]).toEqual([(1 << 24) | (4 << 16) | (0x26 << 8) | 0x99])
  })

  it('runs SNAP_CALL (op 200) snapshot sweeps against D2Common STATLIST_SetUnitStat/EvalStatWithOps and emits minimal reproducers on mismatch', async () => {
    const statCases: SnapshotCase113c[] = []
    for (const [str, lvl, baseHp256, pctHp, hpPerLvl] of [
      [20, 1, 50 << 8, 0, 0],
      [20, 10, 120 << 8, 25, 1024],
      [20, 24, 300 << 8, 50, 2048],
      [20, 50, 800 << 8, -30, 512],
      [0, 50, 800 << 8, -30, 512],
      [20, 80, 0, 0, 0],
      [20, 80, -500, 0, 0],
    ] as const) {
      statCases.push({
        label: `str=${str},lvl=${lvl},hp=${baseHp256},pct=${pctHp},perLvl=${hpPerLvl}`,
        request: {
          mod: 1,
          va: 0x6fd8a740,
          args: [SNAP_PTR_PLAYER, 216, hpPerLvl, 0],
          pClass: 4,
          pStats: [0, str, 12, lvl, 7, baseHp256, 76, pctHp, 216, 0],
          qStats: [0, 12, 7, 76, 216],
        },
        evalTs: () => {
          const h = new Heap113c()
          const u = UNITS_Create113c(h, UNIT_PLAYER, 4, 1)
          STATLIST_CreateEx113c(h, u, 0)
          STATLIST_SetUnitStat113c(h, u, 0, str, 0)
          STATLIST_SetUnitStat113c(h, u, 12, lvl, 0)
          STATLIST_SetUnitStat113c(h, u, 7, baseHp256, 0)
          STATLIST_SetUnitStat113c(h, u, 76, pctHp, 0)
          STATLIST_SetUnitStat113c(h, u, 216, hpPerLvl, 0)
          return {
            qStats: [0, 12, 7, 76, 216].map((id) => [
              id,
              STATLIST_GetUnitBaseStat113c(h, u, id, 0),
              STATLIST_GetUnitStat113c(h, u, id, 0),
            ]),
          }
        },
      })
    }

    statCases.push({
      label: 'GetUnitStat_eax_parity',
      request: {
        mod: 1,
        va: 0x6fd88b70,
        args: [SNAP_PTR_PLAYER, 7, 0],
        pClass: 4,
        pStats: [0, 20, 12, 50, 7, 204800, 76, -30, 216, 512],
      },
      evalTs: () => {
        const h = new Heap113c()
        const u = UNITS_Create113c(h, UNIT_PLAYER, 4, 1)
        STATLIST_CreateEx113c(h, u, 0)
        STATLIST_SetUnitStat113c(h, u, 0, 20, 0)
        STATLIST_SetUnitStat113c(h, u, 12, 50, 0)
        STATLIST_SetUnitStat113c(h, u, 7, 204800, 0)
        STATLIST_SetUnitStat113c(h, u, 76, -30, 0)
        STATLIST_SetUnitStat113c(h, u, 216, 512, 0)
        return { eax: STATLIST_GetUnitStat113c(h, u, 7, 0) }
      },
    })

    const report = await runLiveSnapshotSweep113c(daemon, 'STATLIST_SetUnitStat_113c', statCases)
    expect(report.mismatches).toEqual([])
    expect(report.passedCases).toBe(statCases.length)
    expect(report.elapsedMs).toBeLessThan(100)

    // Live SNAP_CALL (op 200) sweep against D2Game SUNITDMG_CheckToHit (0x6FCFDE90)
    const hitCases: SnapshotCase113c[] = []
    for (const [dex, clvl, flatAr, arPct, mlvl, ac, extraPct, sLo, sHi] of [
      [20, 1, 0, 0, 1, 3, 0, 0x12345678, 666],
      [20, 1, 0, 0, 1, 3, 0, 0, 94], // roll = 94 >= 94 -> miss (0)
      [20, 1, 0, 0, 1, 3, 0, 0, 93], // roll = 93 < 94 -> hit (1)
      [45, 12, 50, 25, 15, 80, 10, 0xdeadbeef, 0x1337c0de],
      [15, 5, 0, -20, 25, 300, 0, 0, 5], // clamped to 5% floor: roll = 5 -> miss (0)
      [15, 5, 0, -20, 25, 300, 0, 0, 4], // clamped to 5% floor: roll = 4 -> hit (1)
      [120, 60, 400, 150, 10, 10, 50, 0, 95], // clamped to 95% ceiling: roll = 95 -> miss (0)
      [120, 60, 400, 150, 10, 10, 50, 0, 94], // clamped to 95% ceiling: roll = 94 -> hit (1)
    ] as const) {
      hitCases.push({
        label: `hit_dex=${dex},clvl=${clvl},ar=${flatAr},pct=${arPct},mlvl=${mlvl},ac=${ac},extra=${extraPct},seed=${sLo}:${sHi}`,
        request: {
          mod: 0,
          va: 0x6fcfde90,
          eax: SNAP_PTR_PLAYER,
          args: [SNAP_PTR_MONSTER, extraPct, 0],
          pClass: 4,
          pSeed: [sLo, sHi],
          pStats: [2, dex, 12, clvl, 19, flatAr, 119, arPct],
          mStats: [12, mlvl, 31, ac, 32, 0, 33, 0],
        },
        evalTs: () => {
          const h = new Heap113c()
          const pGame = GAME_Create113c(h)
          const pAtt = UNITS_Create113c(h, UNIT_PLAYER, 4, 1, pGame)
          const pDef = UNITS_Create113c(h, UNIT_MONSTER, 19, 12, pGame)
          STATLIST_CreateEx113c(h, pAtt, 0, pGame)
          STATLIST_CreateEx113c(h, pDef, 0, pGame)
          STATLIST_SetUnitStat113c(h, pAtt, 2, dex, 0)
          STATLIST_SetUnitStat113c(h, pAtt, 12, clvl, 0)
          STATLIST_SetUnitStat113c(h, pAtt, 19, flatAr, 0)
          STATLIST_SetUnitStat113c(h, pAtt, 119, arPct, 0)
          STATLIST_SetUnitStat113c(h, pDef, 12, mlvl, 0)
          STATLIST_SetUnitStat113c(h, pDef, 31, ac, 0)
          UNITS_SetSeed113c(h, pAtt, sLo, sHi)
          const eax = SUNITDMG_CheckToHit113c(h, pGame, pAtt, pDef, extraPct) ? 1 : 0
          const postSeed = UNITS_GetSeed113c(h, pAtt)
          return {
            eax,
            pSeed: [postSeed.lo >>> 0, postSeed.hi >>> 0],
          }
        },
      })
    }
    const hitReport = await runLiveSnapshotSweep113c(daemon, 'SUNITDMG_CheckToHit_113c', hitCases)
    expect(hitReport.mismatches).toEqual([])
    expect(hitReport.passedCases).toBe(hitCases.length)

    const tmpRepro = mkdtempSync(join(tmpdir(), 'd2kern-repro-'))
    try {
      const badReport = await runLiveSnapshotSweep113c(
        daemon,
        'NegControl_NewUnitId',
        [
          {
            label: 'deliberate-wrong-eax',
            request: {
              mod: 0,
              va: 0x6fd0ad10,
              eax: 0,
              esi: SNAP_PTR_PLAYER,
              gameSeed: [12345, 666],
            },
            evalTs: () => ({ gameSeed: [99999, 666] }),
          },
        ],
        tmpRepro,
      )
      expect(badReport.passedCases).toBe(0)
      expect(badReport.mismatches).toHaveLength(1)
      expect(badReport.reproducerFiles).toHaveLength(1)
      expect(existsSync(badReport.reproducerFiles[0]!)).toBe(true)
    } finally {
      rmSync(tmpRepro, { recursive: true, force: true })
    }
  })
})
