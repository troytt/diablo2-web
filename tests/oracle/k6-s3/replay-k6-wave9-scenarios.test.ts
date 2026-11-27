/**
 * [K6] Wave 9 Bosses, Quests, Full 30-Skill Druid/Assassin, Crafting/Runewords, Remaining C2S & MonAI
 * Headless 1.13c DLL Scenarios & INT3 Coverage Gate:
 * - Boots all 8 Wave 9 scenarios (`tests/fixtures/oracle/k6-s3/<name>.snap-f002.ndjson.gz`) through
 *   the pure `ReplayKernel113c` (`src/d2kern-113c/`) and replays against real 1.13c DLL goldens
 *   (`<name>.oracle.ndjson.gz`).
 * - Enforces upward-only ratchet horizons (`tests/fixtures/oracle/k6-s3/horizons.json`),
 *   100% `rc === 0` across all 1,543 C2S packets, `otherThreadHits === 0`, manifest validity,
 *   exact per-scenario `D2Common`/`D2Game` INT3 hit counts, and union net-new VA expansion over
 *   the `k1 + k3 + k4 + k6 + k6-s2` baseline (`+134` D2Common, `+616` D2Game scenario-executed VAs,
 *   including 14 newly hit scenario C2S handlers closing `C2S` to `80/80 = 100.0%`).
 * - Locks genuine 1.13c boss kills (Andariel, Radament, Summoner, Duriel, Mephisto, Izual, Diablo,
 *   Shenk, all 3 Ancients, Baal), Secret Cow Level, Act 3->4 & Act 4->5 transitions, Leaf & Stealth
 *   Runewords, Cube recipes, and live dead-merc resurrection across all 8 goldens.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { D2UnitStrc } from '../../../src/d2kern-113c/mem/layout.generated.ts'
import {
  K6_S3_REPLAY_SCENARIOS_113C,
  k6S3SnapshotPath113c,
  loadK6S3Coverage113c,
  loadK6S3Golden113c,
  loadK6S3Horizons113c,
  loadK6S3Scenario113c,
  runK6S3Replay113c,
  type K6S3ReplayScenarioName113c,
} from '../../../tools/oracle/k6-s3/k6-s3-replay.ts'
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

interface K6S3ScenarioSpec113c {
  readonly name: K6S3ReplayScenarioName113c
  readonly frames: number
  readonly packetCount: number
  readonly totalHits: number
  readonly d2CommonExecuted: number
  readonly d2GameExecuted: number
  readonly minStrictHorizon: number
  readonly minPosHorizon: number
}

const K6_S3_SCENARIO_SPECS_113C: readonly K6S3ScenarioSpec113c[] = [
  {
    name: 'k6s3-druid-full-30-skills',
    frames: 1475,
    packetCount: 142,
    totalHits: 1609,
    d2CommonExecuted: 859,
    d2GameExecuted: 750,
    minStrictHorizon: 1475,
    minPosHorizon: 1475,
  },
  {
    name: 'k6s3-assassin-full-30-skills',
    frames: 1480,
    packetCount: 155,
    totalHits: 1605,
    d2CommonExecuted: 835,
    d2GameExecuted: 770,
    minStrictHorizon: 1480,
    minPosHorizon: 1480,
  },
  {
    name: 'k6s3-act1-bosses-cowlevel-imbue',
    frames: 1611,
    packetCount: 122,
    totalHits: 1801,
    d2CommonExecuted: 924,
    d2GameExecuted: 877,
    minStrictHorizon: 1611,
    minPosHorizon: 1611,
  },
  {
    name: 'k6s3-act2-bosses-staff-duriel',
    frames: 3028,
    packetCount: 185,
    totalHits: 1856,
    d2CommonExecuted: 932,
    d2GameExecuted: 924,
    minStrictHorizon: 3028,
    minPosHorizon: 3028,
  },
  {
    name: 'k6s3-act3-council-mephisto-quests',
    frames: 2001,
    packetCount: 134,
    totalHits: 1816,
    d2CommonExecuted: 914,
    d2GameExecuted: 902,
    minStrictHorizon: 2001,
    minPosHorizon: 2001,
  },
  {
    name: 'k6s3-act4-izual-hellforge-diablo',
    frames: 4217,
    packetCount: 299,
    totalHits: 1810,
    d2CommonExecuted: 931,
    d2GameExecuted: 879,
    minStrictHorizon: 4217,
    minPosHorizon: 4217,
  },
  {
    name: 'k6s3-act5-shenk-anya-ancients-baal',
    frames: 6547,
    packetCount: 344,
    totalHits: 1934,
    d2CommonExecuted: 940,
    d2GameExecuted: 994,
    minStrictHorizon: 6547,
    minPosHorizon: 6547,
  },
  {
    name: 'k6s3-crafting-runewords-c2s-monai',
    frames: 1834,
    packetCount: 162,
    totalHits: 1687,
    d2CommonExecuted: 956,
    d2GameExecuted: 731,
    minStrictHorizon: 1834,
    minPosHorizon: 1834,
  },
]

const NEWLY_CLOSED_C2S_VAS_113C = [
  'D2Game:0x6FCED440', // 0x3D SyncObjectCollisionByGuid
  'D2Game:0x6FCED8D0', // 0x3E UseQuestScrollItem (Scroll of Inifuss)
  'D2Game:0x6FCEE000', // 0x04 RunToUnit
  'D2Game:0x6FCEE4B0', // 0x21 MergeStackableItems (Keys)
  'D2Game:0x6FCEE950', // 0x07 ShiftLeftSkillOnUnit
  'D2Game:0x6FCEEB10', // 0x0A RepeatShiftLeftSkillOnUnit
  'D2Game:0x6FCEEB70', // 0x09 RepeatLeftSkillOnUnit
  'D2Game:0x6FCEEFE0', // 0x37 IdentifyPendingGambledItem
  'D2Game:0x6FCEF2F0', // 0x1B SwapTwoHandedWeapon
  'D2Game:0x6FCEF400', // 0x4C CancelCursorIdentify
  'D2Game:0x6FCEFB90', // 0x62 MercReviveHandler
  'D2Game:0x6FCF0E90', // 0x44 InsertHoradricStaffIntoOrifice
  'D2Game:0x6FCF1140', // 0x1E SwapDualHandedBodyLoc
  'D2Game:0x6FCF1200', // 0x1D SwapCursorWithBodyItem
] as const

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

const horizonsByScenario = loadK6S3Horizons113c()
const cachedReplay = new Map<K6S3ReplayScenarioName113c, ReplayResult113c>()
const cachedGolden = new Map<K6S3ReplayScenarioName113c, ReturnType<typeof loadK6S3Golden113c>>()

function getReplay(name: K6S3ReplayScenarioName113c): ReplayResult113c {
  let r = cachedReplay.get(name)
  if (r === undefined) {
    r = runK6S3Replay113c(name, 2)
    cachedReplay.set(name, r)
  }
  return r
}

function getGolden(name: K6S3ReplayScenarioName113c): ReturnType<typeof loadK6S3Golden113c> {
  let g = cachedGolden.get(name)
  if (g === undefined) {
    g = loadK6S3Golden113c(name)
    cachedGolden.set(name, g)
  }
  return g
}

describe('[K6] Wave 9 8-scenario F2 boot hydration, ratchet horizons, and real-DLL INT3 coverage gates', () => {
  it('registers all 8 Wave 9 scenarios in tests/fixtures/oracle/k6-s3/horizons.json', () => {
    expect(Object.keys(horizonsByScenario).sort()).toEqual([...K6_S3_REPLAY_SCENARIOS_113C].sort())
    for (const name of K6_S3_REPLAY_SCENARIOS_113C) {
      expect(horizonsByScenario[name]!.bootFrame).toBe(2)
    }
  })

  for (const spec of K6_S3_SCENARIO_SPECS_113C) {
    it(`${spec.name}: boots F2 cleanly, meets ratchet horizons (>= F${spec.minStrictHorizon}/F${spec.minPosHorizon}), has 100% rc===0 (${spec.packetCount} pkts), and verifies INT3 DLL coverage (${spec.totalHits} hits, otherThreadHits === 0)`, () => {
      const h = horizonsByScenario[spec.name]
      expect(h).toBeDefined()
      expect(h!.bootFrame).toBe(2)

      const r = getReplay(spec.name)
      expect(r.bootCheck).toBeNull()
      expect(r.lastGoldenFrame).toBe(spec.frames)
      expect(
        r.strictHorizon,
        `${spec.name}: firstStrict=${JSON.stringify(r.firstStrictDivergence)}`,
      ).toBeGreaterThanOrEqual(h!.strict)
      expect(
        r.posHorizon,
        `${spec.name}: firstPos=${JSON.stringify(r.firstPosDivergence)}`,
      ).toBeGreaterThanOrEqual(h!.pos)
      expect(r.strictHorizon).toBeGreaterThanOrEqual(spec.minStrictHorizon)
      expect(r.posHorizon).toBeGreaterThanOrEqual(spec.minPosHorizon)

      const gold = getGolden(spec.name)
      let pktCount = 0
      for (const fr of gold.frames.values()) {
        for (const entry of fr.in ?? []) {
          const [rc] = entry as [number, string]
          expect(rc, `${spec.name}: non-zero C2S rc=${rc} at F${fr.frame}`).toBe(0)
          pktCount++
        }
      }
      expect(pktCount).toBe(spec.packetCount)

      const cov = loadK6S3Coverage113c(spec.name)
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

  it('negative control: diffFrame113c catches 1-bit player seedLo tamper on Act 4 Izual/Diablo F2 snapshot', () => {
    const name: K6S3ReplayScenarioName113c = 'k6s3-act4-izual-hellforge-diablo'
    const golden = getGolden(name)
    const scenario = loadK6S3Scenario113c(name)
    const saveBytes = new Uint8Array(readFileSync(join(REPO_ROOT_113C, scenario.save!)))
    const snap = loadSnapshotFile113c(k6S3SnapshotPath113c(name, 2))
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

  it('expands real-DLL scenario union by +616 net-new D2Game VAs, +134 net-new D2Common VAs, and closes all 14 remaining scenario C2S VAs over k1+k3+k4+k6+k6-s2', () => {
    const oracleFixturesDir = join(REPO_ROOT_113C, 'tests/fixtures/oracle')
    const baseFiles = [
      ...collectCoverageFiles(join(oracleFixturesDir, 'k1')),
      ...collectCoverageFiles(join(oracleFixturesDir, 'k3')),
      ...collectCoverageFiles(join(oracleFixturesDir, 'k4')),
      ...collectCoverageFiles(join(oracleFixturesDir, 'k6')),
      ...collectCoverageFiles(join(oracleFixturesDir, 'k6-s2')),
    ]
    const baseCov = loadCoverageKeysFromFiles(baseFiles)

    const s3Common = new Set<string>()
    const s3Game = new Set<string>()
    for (const spec of K6_S3_SCENARIO_SPECS_113C) {
      const cov = loadK6S3Coverage113c(spec.name)
      for (const h of cov.hits) {
        const key = manifestKey113c(h.module, h.va)
        if (h.module === 'D2Common') s3Common.add(key)
        else if (h.module === 'D2Game') s3Game.add(key)
      }
    }

    let netNewCommon = 0
    for (const k of s3Common) if (!baseCov.d2Common.has(k)) netNewCommon++
    let netNewGame = 0
    for (const k of s3Game) if (!baseCov.d2Game.has(k)) netNewGame++

    expect(s3Common.size).toBe(1262)
    expect(s3Game.size).toBe(1890)
    expect(netNewCommon).toBeGreaterThanOrEqual(134)
    expect(netNewGame).toBeGreaterThanOrEqual(616)

    for (const va of NEWLY_CLOSED_C2S_VAS_113C) {
      expect(s3Game.has(va), `expected newly closed C2S handler ${va} to be hit by k6-s3`).toBe(true)
    }
  })

  it('verifies genuine bosses, quests, full Druid/Assassin skills, runewords, and merc revive invariants across all 8 goldens', () => {
    const collectAreas = (g: ReturnType<typeof loadK6S3Golden113c>): Set<number> => {
      const areas = new Set<number>()
      for (const fr of g.frames.values()) {
        if (fr.t0 && fr.t0[0]) areas.add(fr.t0[0][7] as number)
      }
      return areas
    }

    const sawMonsterDead = (g: ReturnType<typeof loadK6S3Golden113c>, clsId: number, unitId?: number): boolean => {
      for (const fr of g.frames.values()) {
        for (const m of fr.t1 ?? []) {
          if (m[1] === clsId && (unitId === undefined || m[0] === unitId) && m[2] === 12) return true
        }
      }
      return false
    }

    // 1. Druid: all 10 summon monster classes (419..428), Grizzly #26 unsummoned (mode 12), and C2S 0x04/0x07/0x09/0x0A
    const druid = getGolden('k6s3-druid-full-30-skills')
    const druidMons = new Set<number>()
    const druidOps = new Set<number>()
    for (const fr of druid.frames.values()) {
      for (const m of fr.t1 ?? []) druidMons.add(m[1] as number)
      for (const entry of fr.in ?? []) {
        const [, hex] = entry as [number, string]
        druidOps.add(parseInt(hex.slice(0, 2), 16))
      }
    }
    for (let cls = 419; cls <= 428; cls++) expect(druidMons.has(cls)).toBe(true)
    expect(druid.frames.get(1475)!.t1!.find((m) => m[0] === 26)![2]).toBe(12)
    for (const op of [0x04, 0x07, 0x09, 0x0a]) expect(druidOps.has(op)).toBe(true)

    // 2. Assassin: all 5 Trap Sentries (410..413, 415) + Shadow Warrior (416) + Shadow Master (417) + >= 15 missile classes
    const sin = getGolden('k6s3-assassin-full-30-skills')
    const sinMons = new Set<number>()
    const sinMissiles = new Set<number>()
    for (const fr of sin.frames.values()) {
      for (const m of fr.t1 ?? []) sinMons.add(m[1] as number)
      for (const ms of fr.t3 ?? []) sinMissiles.add(ms[1] as number)
    }
    for (const cls of [410, 411, 412, 413, 415, 416, 417]) expect(sinMons.has(cls)).toBe(true)
    expect(sinMissiles.size).toBeGreaterThanOrEqual(15)

    // 3. Act 1: Tristram (38), Secret Cow Level (39) with Hell Bovines (391), Catacombs L4 (37), and Andariel (156) slain
    const act1 = getGolden('k6s3-act1-bosses-cowlevel-imbue')
    const act1Areas = collectAreas(act1)
    for (const a of [1, 4, 37, 38, 39]) expect(act1Areas.has(a)).toBe(true)
    let sawCow = false
    for (const fr of act1.frames.values()) {
      if ((fr.t1 ?? []).some((m) => m[1] === 391)) {
        sawCow = true
        break
      }
    }
    expect(sawCow).toBe(true)
    expect(sawMonsterDead(act1, 156, 359)).toBe(true)

    // 4. Act 2: Horadric Staff (#13 cls 91) Cube assembly, Radament (229), Summoner (250), Duriel (211) slain, Tyrael (251)
    const act2 = getGolden('k6s3-act2-bosses-staff-duriel')
    const act2Areas = collectAreas(act2)
    for (const a of [40, 46, 48, 49, 72, 73, 74]) expect(act2Areas.has(a)).toBe(true)
    expect(act2.frames.get(18)!.t4!.some((it) => it[0] === 13 && it[1] === 91)).toBe(true)
    expect(sawMonsterDead(act2, 229, 142)).toBe(true)
    expect(sawMonsterDead(act2, 250, 308)).toBe(true)
    expect(sawMonsterDead(act2, 211, 515)).toBe(true)
    let sawTyrael = false
    for (const fr of act2.frames.values()) {
      if ((fr.t1 ?? []).some((m) => m[1] === 251)) {
        sawTyrael = true
        break
      }
    }
    expect(sawTyrael).toBe(true)

    // 5. Act 3: Khalim's Will (#17 cls 174) Cube assembly, Travincal (83), Mephisto (242) slain, Red Portal -> Act 4 (103)
    const act3 = getGolden('k6s3-act3-council-mephisto-quests')
    const act3Areas = collectAreas(act3)
    for (const a of [75, 83, 101, 102, 103]) expect(act3Areas.has(a)).toBe(true)
    expect(act3.frames.get(60)!.t4!.some((it) => it[0] === 17 && it[1] === 174)).toBe(true)
    expect(sawMonsterDead(act3, 242, 90)).toBe(true)
    expect(act3.frames.get(2001)!.t0![0]![7]).toBe(103)

    // 6. Act 4: Plains of Despair (105) Izual (256) slain, River of Flame (107), Chaos Sanctuary (108) Diablo (243) slain -> Act 5 (109)
    const act4 = getGolden('k6s3-act4-izual-hellforge-diablo')
    const act4Areas = collectAreas(act4)
    for (const a of [103, 105, 106, 107, 108, 109]) expect(act4Areas.has(a)).toBe(true)
    expect(sawMonsterDead(act4, 256, 61)).toBe(true)
    expect(sawMonsterDead(act4, 243, 462)).toBe(true)
    expect(act4.frames.get(4217)!.t0![0]![7]).toBe(109)

    // 7. Act 5: Shenk (479) slain, Arreat Summit (120) all 3 Ancients (540/541/542) slain, Worldstone Chamber (132) Baal (544) slain
    const act5 = getGolden('k6s3-act5-shenk-anya-ancients-baal')
    const act5Areas = collectAreas(act5)
    for (const a of [109, 110, 111, 118, 120, 129, 130, 131, 132]) expect(act5Areas.has(a)).toBe(true)
    expect(sawMonsterDead(act5, 479, 35)).toBe(true)
    for (const cls of [540, 541, 542]) expect(sawMonsterDead(act5, cls)).toBe(true)
    expect(sawMonsterDead(act5, 544, 346)).toBe(true)
    expect(act5.frames.get(6547)!.t0![0]![7]).toBe(132)

    // 8. Crafting/Runewords/C2S/MonAI: Leaf (#81 cls 63) & Stealth (#149 cls 316) runeword flag (0x04000000), Rare Upgrade (#84 cls 359), Dead Rogue Merc (#1 cls 271) revived (12 -> 2), Far Oasis (43) & Flayer Jungle (78)
    const craft = getGolden('k6s3-crafting-runewords-c2s-monai')
    const craftAreas = collectAreas(craft)
    for (const a of [1, 43, 78]) expect(craftAreas.has(a)).toBe(true)
    let sawLeaf = false
    let sawStealth = false
    let sawRareUpgrade = false
    const merc1Modes = new Set<number>()
    for (const fr of craft.frames.values()) {
      for (const it of fr.t4 ?? []) {
        const flags = it[13] as number
        if (it[0] === 81 && it[1] === 63 && (flags & 0x04000000) !== 0) sawLeaf = true
        if (it[0] === 149 && it[1] === 316 && (flags & 0x04000000) !== 0) sawStealth = true
        if (it[0] === 84 && it[1] === 359) sawRareUpgrade = true
      }
      for (const m of fr.t1 ?? []) {
        if (m[0] === 1 && m[1] === 271) merc1Modes.add(m[2] as number)
      }
    }
    expect(sawLeaf).toBe(true)
    expect(sawStealth).toBe(true)
    expect(sawRareUpgrade).toBe(true)
    expect(merc1Modes.has(12)).toBe(true)
    expect(merc1Modes.has(2)).toBe(true)
  })
})
