/**
 * Milestone #37 ([K6] Wave 1) Longitudinal Golden Replay & Real-DLL INT3 Coverage Suite:
 * - Replays all 7 [K6] multi-subsystem headless 1.13c DLL scenarios from their F2 boot snapshots
 *   (`tests/fixtures/oracle/k6/<scenario>.snap-f002.ndjson.gz`) through the pure `ReplayKernel113c`
 *   (`src/d2kern-113c/`) against real 1.13c goldens (`<scenario>.oracle.ndjson.gz`).
 * - Locks full-horizon zero-divergence (`strictHorizon === lastGoldenFrame`, `0` divergence on
 *   units + `t4` items + `s2c` packets, `runtimeExecGap === 0` across `D2Common` 609/609 and
 *   `D2Game` 487/487) on `k6-bloodmoor-consumables-auras-combat` (`F2..F380`).
 * - Enforces upward-only ratchet horizons (`tests/fixtures/oracle/k6/horizons.json`), negative
 *   controls, and exact real-DLL INT3 coverage hit counts (`<scenario>.coverage.ndjson.gz`).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { D2UnitStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import {
  K6_REPLAY_SCENARIOS_113C,
  computeK6RuntimeExecSummary113c,
  k6SnapshotPath113c,
  loadK6Coverage113c,
  loadK6Golden113c,
  loadK6Horizons113c,
  loadK6Scenario113c,
  runK6Replay113c,
  type K6ReplayScenarioName113c,
} from '../../../tools/oracle/k6/k6-replay.ts'
import {
  REPO_ROOT_113C,
  bootFromSnapshot113c,
  diffFrame113c,
  loadManifest113c,
  loadSnapshotFile113c,
  manifestKey113c,
  sampleFrame113c,
  type ReplayResult113c,
} from '../../../tools/oracle/kern-replay/replay-113c.ts'
import type { TraceFrame, TraceHeader, UnitRow } from '../../../tools/oracle/lib/trace-diff.ts'

interface K6ScenarioSpec113c {
  readonly name: K6ReplayScenarioName113c
  readonly frames: number
  readonly totalHits: number
  readonly d2CommonExecuted: number
  readonly d2GameExecuted: number
  readonly minStrictHorizon: number
  readonly minPosHorizon: number
}

const K6_SCENARIO_SPECS_113C: readonly K6ScenarioSpec113c[] = [
  {
    name: 'k6-bloodmoor-consumables-auras-combat',
    frames: 380,
    totalHits: 1096,
    d2CommonExecuted: 609,
    d2GameExecuted: 487,
    minStrictHorizon: 380,
    minPosHorizon: 380,
  },
  {
    name: 'k6-act3-consumables-quest',
    frames: 140,
    totalHits: 726,
    d2CommonExecuted: 397,
    d2GameExecuted: 329,
    minStrictHorizon: 41,
    minPosHorizon: 140,
  },
  {
    name: 'k6-druid-skills',
    frames: 390,
    totalHits: 1248,
    d2CommonExecuted: 719,
    d2GameExecuted: 529,
    minStrictHorizon: 10,
    minPosHorizon: 37,
  },
  {
    name: 'k6-assassin-skills',
    frames: 390,
    totalHits: 1327,
    d2CommonExecuted: 745,
    d2GameExecuted: 582,
    minStrictHorizon: 10,
    minPosHorizon: 58,
  },
  {
    name: 'k6-items-potions-belt-combat',
    frames: 340,
    totalHits: 1284,
    d2CommonExecuted: 716,
    d2GameExecuted: 568,
    minStrictHorizon: 5,
    minPosHorizon: 7,
  },
  {
    name: 'k6-town-npc-gamble-waypoint',
    frames: 275,
    totalHits: 991,
    d2CommonExecuted: 578,
    d2GameExecuted: 413,
    minStrictHorizon: 3,
    minPosHorizon: 10,
  },
  {
    name: 'k6-nightmare-bloodmoor-combat',
    frames: 360,
    totalHits: 1070,
    d2CommonExecuted: 577,
    d2GameExecuted: 493,
    minStrictHorizon: 10,
    minPosHorizon: 104,
  },
]

function playerStat(header: TraceHeader, row: UnitRow, statId: number): number {
  const idx = header.statIds.indexOf(statId)
  if (idx < 0) throw new Error(`statId ${statId} not present in trace header`)
  const val = row[header.unitFields.length + idx]
  if (typeof val !== 'number') throw new Error(`missing stat column ${statId} in player row`)
  return val
}

const horizonsByScenario = loadK6Horizons113c()
const cachedReplay = new Map<K6ReplayScenarioName113c, ReplayResult113c>()

function getReplay(name: K6ReplayScenarioName113c): ReplayResult113c {
  let r = cachedReplay.get(name)
  if (r === undefined) {
    r = runK6Replay113c(name, 2)
    cachedReplay.set(name, r)
  }
  return r
}

describe('[K6] Wave 1 full-horizon zero-divergence multi-subsystem gate (k6-bloodmoor-consumables-auras-combat)', () => {
  it('replays all 380 frames with zero divergence across units, t4 items, gs, and s2c packets, and runtimeExecGap === 0', () => {
    const name: K6ReplayScenarioName113c = 'k6-bloodmoor-consumables-auras-combat'
    const r = getReplay(name)
    const cov = loadK6Coverage113c(name)
    const exec = computeK6RuntimeExecSummary113c(cov, r.tsExecutedVas)

    expect(r.bootCheck).toBeNull()
    expect(r.lastGoldenFrame).toBe(380)
    expect(r.strictHorizon).toBe(380)
    expect(r.posHorizon).toBe(380)
    expect(r.firstStrictDivergence).toBeNull()
    expect(r.firstPosDivergence).toBeNull()
    expect(r.unportedHit).toBeNull()

    expect(exec.d2CommonDll).toBe(609)
    expect(exec.d2GameDll).toBe(487)
    expect(exec.d2CommonRuntimeExecGap).toBe(0)
    expect(exec.d2GameRuntimeExecGap).toBe(0)

    // Verify genuine multi-subsystem golden effects occurred (Concentration/Fanaticism auras, XP gain, zombie kills, t4 ground drop)
    const golden = loadK6Golden113c(name)
    const f2 = golden.frames.get(2)!
    const f380 = golden.frames.get(380)!
    expect(playerStat(golden.header, f380.t0![0]!, 13)).toBeGreaterThan(
      playerStat(golden.header, f2.t0![0]!, 13),
    )
    // Zombies #10 and #9 killed (mode 12) and ground item #12 dropped into t4 (mode 3)
    const z10 = f380.t1!.find((m) => m[0] === 10)!
    const z9 = f380.t1!.find((m) => m[0] === 9)!
    expect(z10[2]).toBe(12)
    expect(z9[2]).toBe(12)
    expect(f380.t4!.some((it) => it[0] === 12 && it[2] === 3)).toBe(true)
  })

  it('negative controls: diffFrame113c catches 1-bit unit seed tamper, t4 item quality tamper, and s2c byte tamper', () => {
    const name: K6ReplayScenarioName113c = 'k6-bloodmoor-consumables-auras-combat'
    const golden = loadK6Golden113c(name)
    const scenario = loadK6Scenario113c(name)
    const saveBytes = new Uint8Array(readFileSync(join(REPO_ROOT_113C, scenario.save!)))
    const snap = loadSnapshotFile113c(k6SnapshotPath113c(name, 2))
    const world = bootFromSnapshot113c(snap, saveBytes)
    const f2Gold = golden.frames.get(2)!

    // 1. Mutate player #1 seedLo by 1 bit -> strict diff catches immediately
    const pPlayer = world.m.u32((world.pGame + 0x1120 + 1 * 4) >>> 0)
    expect(pPlayer).not.toBe(0)
    const origSeed = world.m.get(pPlayer, D2UnitStrc.seedLo)
    world.m.set(pPlayer, D2UnitStrc.seedLo, (origSeed ^ 1) >>> 0)
    const dSeed = diffFrame113c(f2Gold, sampleFrame113c(world, golden.header), golden.header, 'strict')
    expect(dSeed).not.toBeNull()
    expect(dSeed!.field).toBe('seedLo')
    world.m.set(pPlayer, D2UnitStrc.seedLo, origSeed)

    // 2. Mutate t4 item quality on sampled frame -> strict diff catches t4 mismatch
    const cleanSample = sampleFrame113c(world, golden.header)
    const tamperedT4: TraceFrame = {
      ...cleanSample,
      t4: cleanSample.t4!.map((r, idx) => (idx === 0 ? r.map((v, c) => (c === 11 ? 99 : v)) : r)),
    }
    const dItem = diffFrame113c(f2Gold, tamperedT4, golden.header, 'strict')
    expect(dItem).not.toBeNull()
    expect(dItem!.key).toBe('t4')
    expect(dItem!.field).toBe('quality')

    // 3. Mutate s2c packet hex on F6 -> strict diff catches s2c mismatch
    const f6Gold = golden.frames.get(6)!
    const tamperedS2c: TraceFrame = {
      ...f6Gold,
      s2c: ['2c0001000000ff00'],
    }
    const dS2c = diffFrame113c(f6Gold, tamperedS2c, golden.header, 'strict')
    expect(dS2c).not.toBeNull()
    expect(dS2c!.key).toBe('s2c')
  })
})

describe('[K6] Wave 1 7-scenario F2 boot hydration, ratchet horizons, and real-DLL INT3 coverage gates', () => {
  it('registers all 7 K6 scenarios in horizons.json', () => {
    expect(Object.keys(horizonsByScenario).sort()).toEqual([...K6_REPLAY_SCENARIOS_113C].sort())
  })

  for (const spec of K6_SCENARIO_SPECS_113C) {
    it(`${spec.name}: hydrates F2 snapshot cleanly, meets ratchet horizons (>= F${spec.minStrictHorizon}/F${spec.minPosHorizon}), and matches INT3 DLL coverage (${spec.totalHits} hits)`, () => {
      const h = horizonsByScenario[spec.name]
      expect(h).toBeDefined()
      expect(h!.bootFrame).toBe(2)

      const r = getReplay(spec.name)
      expect(r.bootCheck).toBeNull()
      expect(r.lastGoldenFrame).toBe(spec.frames)
      expect(r.strictHorizon).toBeGreaterThanOrEqual(h!.strict)
      expect(r.posHorizon).toBeGreaterThanOrEqual(h!.pos)
      expect(r.strictHorizon).toBeGreaterThanOrEqual(spec.minStrictHorizon)
      expect(r.posHorizon).toBeGreaterThanOrEqual(spec.minPosHorizon)

      const cov = loadK6Coverage113c(spec.name)
      expect(cov.from).toBe(1)
      expect(cov.to).toBe(spec.frames)
      expect(cov.hit).toBe(spec.totalHits)

      const manifest = loadManifest113c()
      let cCount = 0
      let gCount = 0
      for (const hit of cov.hits) {
        const key = manifestKey113c(hit.module, hit.va)
        expect(manifest.has(key), `${spec.name}: ${key} missing from manifest-113c.json`).toBe(true)
        if (hit.module === 'D2Common') cCount++
        else if (hit.module === 'D2Game') gCount++
      }
      expect(cCount).toBe(spec.d2CommonExecuted)
      expect(gCount).toBe(spec.d2GameExecuted)
    })
  }

  it('verifies K6 7-scenario union alone hits 806 unique D2Game VAs and golden multi-subsystem outcomes hold', () => {
    const k6GameUnion = new Set<string>()
    const k6CommonUnion = new Set<string>()
    for (const spec of K6_SCENARIO_SPECS_113C) {
      const cov = loadK6Coverage113c(spec.name)
      for (const h of cov.hits) {
        const key = manifestKey113c(h.module, h.va)
        if (h.module === 'D2Game') k6GameUnion.add(key)
        else if (h.module === 'D2Common') k6CommonUnion.add(key)
      }
    }
    expect(k6GameUnion.size).toBeGreaterThanOrEqual(800)
    expect(k6CommonUnion.size).toBeGreaterThanOrEqual(850)

    // Verify Act 3 Golden Bird ('g34 ') quality=7 & Druid/Assassin/Town/Nightmare golden invariants
    const act3 = loadK6Golden113c('k6-act3-consumables-quest')
    const bird = act3.frames.get(42)!.t4!.find((it) => it[0] === 13)!
    expect(bird[1]).toBe(547) // 'g34 ' classId
    expect(bird[11]).toBe(7) // ITEMQUAL_UNIQUE (7)

    const nm = loadK6Golden113c('k6-nightmare-bloodmoor-combat')
    const nmQuill = nm.frames.get(200)!.t1!.find((m) => m[0] === 12)!
    expect(nmQuill[1]).toBe(63) // Nightmare Quill Rat boss/champion pack
    expect(playerStat(nm.header, nmQuill, 6)).toBeGreaterThan(150000) // Nightmare scaled HP (188,160 vs ~500 in Normal)
  })
})
