/**
 * [K6] Wave 4 Multi-Class & Act 2-5 Headless 1.13c DLL Scenarios & INT3 Coverage Gate:
 * - Boots all 8 Wave 4 scenarios (`tests/fixtures/oracle/k6-s2/<name>.snap-f002.ndjson.gz`) through
 *   the pure `ReplayKernel113c` (`src/d2kern-113c/`) and replays against real 1.13c DLL goldens
 *   (`<name>.oracle.ndjson.gz`).
 * - Enforces upward-only ratchet horizons (`tests/fixtures/oracle/k6-s2/horizons.json`),
 *   `otherThreadHits === 0`, manifest validity, exact per-scenario `D2Common`/`D2Game` INT3 hit
 *   counts, and union net-new VA expansion over the `k1 + k3 + k4 + k6` baseline (`+209` D2Common,
 *   `+370` D2Game scenario-executed VAs).
 * - Locks genuine 1.13c multi-class, Horadric Cube, Socket, Mercenary, Hell Gamble/Identify/Death/
 *   Resurrect, Waypoint, and Town Portal gameplay invariants across all 8 goldens.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { D2UnitStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import {
  K6_S2_REPLAY_SCENARIOS_113C,
  k6S2SnapshotPath113c,
  loadK6S2Coverage113c,
  loadK6S2Golden113c,
  loadK6S2Horizons113c,
  loadK6S2Scenario113c,
  runK6S2Replay113c,
  type K6S2ReplayScenarioName113c,
} from '../../../tools/oracle/k6-s2/k6-s2-replay.ts'
import { computeK6SteppedRuntimeExecSummary113c } from '../../../tools/oracle/k6/k6-runtime-exec-exemptions.ts'
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

interface K6S2ScenarioSpec113c {
  readonly name: K6S2ReplayScenarioName113c
  readonly frames: number
  readonly totalHits: number
  readonly d2CommonExecuted: number
  readonly d2GameExecuted: number
  readonly minStrictHorizon: number
  readonly minPosHorizon: number
}

const K6_S2_SCENARIO_SPECS_113C: readonly K6S2ScenarioSpec113c[] = [
  {
    name: 'k6s2-amazon-skills',
    frames: 715,
    totalHits: 1360,
    d2CommonExecuted: 762,
    d2GameExecuted: 598,
    minStrictHorizon: 715,
    minPosHorizon: 715,
  },
  {
    name: 'k6s2-sorceress-skills',
    frames: 680,
    totalHits: 1365,
    d2CommonExecuted: 742,
    d2GameExecuted: 623,
    minStrictHorizon: 680,
    minPosHorizon: 680,
  },
  {
    name: 'k6s2-necromancer-skills',
    frames: 775,
    totalHits: 1426,
    d2CommonExecuted: 763,
    d2GameExecuted: 663,
    minStrictHorizon: 775,
    minPosHorizon: 775,
  },
  {
    name: 'k6s2-paladin-skills',
    frames: 775,
    totalHits: 1316,
    d2CommonExecuted: 741,
    d2GameExecuted: 575,
    minStrictHorizon: 775,
    minPosHorizon: 775,
  },
  {
    name: 'k6s2-barbarian-skills',
    frames: 665,
    totalHits: 1366,
    d2CommonExecuted: 775,
    d2GameExecuted: 591,
    minStrictHorizon: 665,
    minPosHorizon: 665,
  },
  {
    name: 'k6s2-act2-sewers-cube-merc',
    frames: 1290,
    totalHits: 1452,
    d2CommonExecuted: 809,
    d2GameExecuted: 643,
    minStrictHorizon: 1290,
    minPosHorizon: 1290,
  },
  {
    name: 'k6s2-act4-hell-chaos-shrines',
    frames: 1225,
    totalHits: 1655,
    d2CommonExecuted: 896,
    d2GameExecuted: 759,
    minStrictHorizon: 1225,
    minPosHorizon: 1225,
  },
  {
    name: 'k6s2-act5-harrogath-shenk-anya',
    frames: 860,
    totalHits: 1588,
    d2CommonExecuted: 828,
    d2GameExecuted: 760,
    minStrictHorizon: 860,
    minPosHorizon: 860,
  },
]

function collectCoverageFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) collectCoverageFiles(full, out)
    else if (entry.name.endsWith('.coverage.ndjson.gz')) out.push(full)
  }
  return out
}

function loadCoverageKeysFromFiles(files: readonly string[]): { d2Common: Set<string>; d2Game: Set<string> } {
  const d2Common = new Set<string>()
  const d2Game = new Set<string>()
  for (const file of files) {
    const lines = gunzipSync(readFileSync(file))
      .toString('utf8')
      .split('\n')
      .filter((l) => l.trim().length > 0)
    for (let i = 1; i < lines.length; i++) {
      const o = JSON.parse(lines[i]!) as { m: string; va: string }
      const key = manifestKey113c(o.m, parseInt(o.va, 16))
      if (o.m === 'D2Common') d2Common.add(key)
      else if (o.m === 'D2Game') d2Game.add(key)
    }
  }
  return { d2Common, d2Game }
}

const horizonsByScenario = loadK6S2Horizons113c()
const cachedReplay = new Map<K6S2ReplayScenarioName113c, ReplayResult113c>()

function getReplay(name: K6S2ReplayScenarioName113c): ReplayResult113c {
  let r = cachedReplay.get(name)
  if (r === undefined) {
    r = runK6S2Replay113c(name, 2)
    cachedReplay.set(name, r)
  }
  return r
}

describe('[K6] Wave 4 8-scenario F2 boot hydration, ratchet horizons, and real-DLL INT3 coverage gates', () => {
  it('registers all 8 Wave 4 scenarios in tests/fixtures/oracle/k6-s2/horizons.json', () => {
    expect(Object.keys(horizonsByScenario).sort()).toEqual([...K6_S2_REPLAY_SCENARIOS_113C].sort())
    for (const name of K6_S2_REPLAY_SCENARIOS_113C) {
      expect(horizonsByScenario[name]!.bootFrame).toBe(2)
    }
  })

  for (const spec of K6_S2_SCENARIO_SPECS_113C) {
    it(`${spec.name}: boots F2 cleanly, meets ratchet horizons (>= F${spec.minStrictHorizon}/F${spec.minPosHorizon}), and verifies INT3 DLL coverage (${spec.totalHits} hits, otherThreadHits === 0)`, () => {
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

      const cov = loadK6S2Coverage113c(spec.name)
      expect(cov.from).toBe(1)
      expect(cov.to).toBe(spec.frames)
      expect(cov.otherThreadHits).toBe(0)
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

      const stepped = computeK6SteppedRuntimeExecSummary113c(spec.name, cov, r.tsExecutedVas, 2)
      expect(
        stepped.d2CommonUnexemptedGap,
        `${spec.name}: unexempted F3+ D2Common runtime gap: ${stepped.missingSteppedD2CommonVas.join(', ')}`,
      ).toBe(0)
      expect(
        stepped.d2GameUnexemptedGap,
        `${spec.name}: unexempted F3+ D2Game runtime gap: ${stepped.missingSteppedD2GameVas.join(', ')}`,
      ).toBe(0)
    })
  }

  it('negative control: diffFrame113c catches 1-bit player seedLo tamper on Act 4 Hell F2 snapshot', () => {
    const name: K6S2ReplayScenarioName113c = 'k6s2-act4-hell-chaos-shrines'
    const golden = loadK6S2Golden113c(name)
    const scenario = loadK6S2Scenario113c(name)
    const saveBytes = new Uint8Array(readFileSync(join(REPO_ROOT_113C, scenario.save!)))
    const snap = loadSnapshotFile113c(k6S2SnapshotPath113c(name, 2))
    const world = bootFromSnapshot113c(snap, saveBytes)
    const f2Gold = golden.frames.get(2)!

    expect(diffFrame113c(f2Gold, sampleFrame113c(world, golden.header), golden.header, 'strict')).toBeNull()

    const pPlayer = world.m.u32((world.pGame + 0x1120 + 1 * 4) >>> 0)
    expect(pPlayer).not.toBe(0)
    const origSeed = world.m.get(pPlayer, D2UnitStrc.seedLo)
    world.m.set(pPlayer, D2UnitStrc.seedLo, (origSeed ^ 1) >>> 0)
    const dSeed = diffFrame113c(f2Gold, sampleFrame113c(world, golden.header), golden.header, 'strict')
    expect(dSeed).not.toBeNull()
    expect(dSeed!.field).toBe('seedLo')
    world.m.set(pPlayer, D2UnitStrc.seedLo, origSeed)
  })

  it('expands real-DLL scenario union by +370 net-new D2Game VAs and +209 net-new D2Common VAs over k1+k3+k4+k6', () => {
    const oracleFixturesDir = join(REPO_ROOT_113C, 'tests/fixtures/oracle')
    const baseFiles = [
      ...collectCoverageFiles(join(oracleFixturesDir, 'k1')),
      ...collectCoverageFiles(join(oracleFixturesDir, 'k3')),
      ...collectCoverageFiles(join(oracleFixturesDir, 'k4')),
      ...collectCoverageFiles(join(oracleFixturesDir, 'k6')),
    ]
    const baseCov = loadCoverageKeysFromFiles(baseFiles)

    const s2Common = new Set<string>()
    const s2Game = new Set<string>()
    for (const spec of K6_S2_SCENARIO_SPECS_113C) {
      const cov = loadK6S2Coverage113c(spec.name)
      for (const h of cov.hits) {
        const key = manifestKey113c(h.module, h.va)
        if (h.module === 'D2Common') s2Common.add(key)
        else if (h.module === 'D2Game') s2Game.add(key)
      }
    }

    let netNewCommon = 0
    for (const k of s2Common) if (!baseCov.d2Common.has(k)) netNewCommon++
    let netNewGame = 0
    for (const k of s2Game) if (!baseCov.d2Game.has(k)) netNewGame++

    expect(s2Common.size).toBe(1139)
    expect(s2Game.size).toBe(1301)
    expect(netNewCommon).toBeGreaterThanOrEqual(209)
    expect(netNewGame).toBeGreaterThanOrEqual(370)
  })

  it('verifies genuine multi-class & Act 2-5 golden gameplay invariants across all 8 scenarios', () => {
    // 1. Amazon: Decoy (356) & Valkyrie (357) summoned
    const ama = loadK6S2Golden113c('k6s2-amazon-skills')
    const amaClasses = new Set<number>()
    for (const fr of ama.frames.values()) for (const m of fr.t1 ?? []) amaClasses.add(m[1] as number)
    expect(amaClasses.has(356)).toBe(true)
    expect(amaClasses.has(357)).toBe(true)

    // 2. Sorceress: 3-head Hydras (351/352/353) + >= 22 distinct missile classes
    const sorc = loadK6S2Golden113c('k6s2-sorceress-skills')
    const sorcMons = new Set<number>()
    const sorcMissiles = new Set<number>()
    for (const fr of sorc.frames.values()) {
      for (const m of fr.t1 ?? []) sorcMons.add(m[1] as number)
      for (const ms of fr.t3 ?? []) sorcMissiles.add(ms[1] as number)
    }
    expect(sorcMons.has(351)).toBe(true)
    expect(sorcMons.has(352)).toBe(true)
    expect(sorcMons.has(353)).toBe(true)
    expect(sorcMissiles.size).toBeGreaterThanOrEqual(22)

    // 3. Necromancer: all 4 Golems (Clay 289, Blood 290, Iron 291, Fire 292) + Skeleton (363) + Mage (364)
    const necro = loadK6S2Golden113c('k6s2-necromancer-skills')
    const necroMons = new Set<number>()
    for (const fr of necro.frames.values()) for (const m of fr.t1 ?? []) necroMons.add(m[1] as number)
    for (const cls of [289, 290, 291, 292, 363, 364]) expect(necroMons.has(cls)).toBe(true)

    // 4. Paladin: zombies #9, #10, #11 slain (mode 12)
    const pal = loadK6S2Golden113c('k6s2-paladin-skills')
    const palEnd = pal.frames.get(775)!.t1!
    for (const id of [9, 10, 11]) expect(palEnd.find((m) => m[0] === id)![2]).toBe(12)

    // 5. Barbarian: zombies #9, #10, #11 slain + corpse-popped ground drop (#13 cls 523 mode 3)
    const barb = loadK6S2Golden113c('k6s2-barbarian-skills')
    const barbEnd = barb.frames.get(665)!
    for (const id of [9, 10, 11]) expect(barbEnd.t1!.find((m) => m[0] === id)![2]).toBe(12)
    expect(barbEnd.t4!.some((it) => it[0] === 13 && it[1] === 523 && it[2] === 3)).toBe(true)

    // 6. Act 2: Cube outputs (#21 gfv socketed mode=6 into Fara weapon #114, #22 rvl, #23 r02), Desert Merc (338) in town & Sewers L2 (48)
    const act2 = loadK6S2Golden113c('k6s2-act2-sewers-cube-merc')
    const a2f429 = act2.frames.get(429)!.t4!
    expect(a2f429.some((it) => it[0] === 21 && it[1] === 558 && it[2] === 6)).toBe(true)
    expect(a2f429.some((it) => it[0] === 22 && it[1] === 516)).toBe(true)
    expect(a2f429.some((it) => it[0] === 23 && it[1] === 611)).toBe(true)
    expect(a2f429.some((it) => it[0] === 114 && it[1] === 20 && ((it[13] as number) & 0x800) !== 0)).toBe(true)
    const a2MercAreas = new Set<number>()
    for (const fr of act2.frames.values()) {
      for (const m of fr.t1 ?? []) if (m[1] === 338) a2MercAreas.add(m[7] as number)
    }
    expect(a2MercAreas.has(40)).toBe(true)
    expect(a2MercAreas.has(48)).toBe(true)
    expect(act2.frames.get(1290)!.t0![0]![7]).toBe(48)

    // 7. Act 4 Hell: Jamella gambled Amulet #108 identified via 0x27, River of Flame (107), Hell death (mode 17) -> 0x41 Resurrect (area 103, mode 5)
    const act4 = loadK6S2Golden113c('k6s2-act4-hell-chaos-shrines')
    const amuUnid = act4.frames.get(341)!.t4!.find((it) => it[0] === 108)!
    const amuId = act4.frames.get(353)!.t4!.find((it) => it[0] === 108)!
    expect(amuUnid[1]).toBe(520)
    expect((amuUnid[13] as number) & 0x10).toBe(0)
    expect((amuId[13] as number) & 0x10).toBe(0x10)
    expect(act4.frames.get(502)!.t0![0]![7]).toBe(107)
    expect(act4.frames.get(1209)!.t0![0]![2]).toBe(17)
    expect(act4.frames.get(1210)!.t0![0]![7]).toBe(103)
    expect(act4.frames.get(1210)!.t0![0]![2]).toBe(5)

    // 8. Act 5: Malah Tome #59 (cls 518) with Scroll inserted, Barbarian Merc (561) in Harrogath (109) & Frigid Highlands (111), TP return to Harrogath (109)
    const act5 = loadK6S2Golden113c('k6s2-act5-harrogath-shenk-anya')
    expect(act5.frames.get(69)!.t4!.some((it) => it[0] === 59 && it[1] === 518)).toBe(true)
    const a5MercAreas = new Set<number>()
    for (const fr of act5.frames.values()) {
      for (const m of fr.t1 ?? []) if (m[1] === 561) a5MercAreas.add(m[7] as number)
    }
    expect(a5MercAreas.has(109)).toBe(true)
    expect(a5MercAreas.has(111)).toBe(true)
    expect(act5.frames.get(638)!.t0![0]![7]).toBe(111)
    expect(act5.frames.get(825)!.t0![0]![7]).toBe(111)
    expect(act5.frames.get(826)!.t0![0]![7]).toBe(109)
  })

  it('locks full-horizon zero-divergence closure across all 8 Wave 4 scenarios (Amazon 715/715, Sorceress 680/680, Necromancer 775/775, Paladin 775/775, Barbarian 665/665, Act 2 1290/1290, Act 4 1225/1225, Act 5 860/860)', () => {
    for (const [name, expectedFrames] of [
      ['k6s2-amazon-skills', 715],
      ['k6s2-sorceress-skills', 680],
      ['k6s2-necromancer-skills', 775],
      ['k6s2-paladin-skills', 775],
      ['k6s2-barbarian-skills', 665],
      ['k6s2-act2-sewers-cube-merc', 1290],
      ['k6s2-act4-hell-chaos-shrines', 1225],
      ['k6s2-act5-harrogath-shenk-anya', 860],
    ] as const) {
      const r = getReplay(name)
      expect(r.strictHorizon).toBe(expectedFrames)
      expect(r.posHorizon).toBe(expectedFrames)
      expect(r.firstStrictDivergence).toBeNull()
      expect(r.firstPosDivergence).toBeNull()
    }
  })
})
