/**
 * [K4] Act 1–5 Town NPC AI & Quest State Machine Interactive Visual Showcase Backend
 * (`tools/oracle/k4-showcase-server.ts`).
 *
 * Serves authentic Act 1–5 quest & town NPC data under `/api/k4-showcase/*`:
 *   - `/api/k4-showcase/overview` — 5-Act quest catalog, horizons (`710` golden / `700` stepped frames),
 *     DS1/DT1 bundle & `s2c-113c.d2tv.gz` (`1,440` vectors) summaries.
 *   - `/api/k4-showcase/replay`   — Live `src/d2kern-113c` lockstep replay of `k4-act{1..5}-quest`
 *     with tracked quest reward stats (`stat 5`, `stats 39/41/43/45`).
 *   - `/api/k4-showcase/quests`   — Decoded C2S quest sequences (`0x03/0x13/0x2F/0x31/0x30/0x20`),
 *     `Woo!` quest bit specs, callback VAs, town NPC AI VAs, and Act 2–5 DS1 bundle stats.
 *   - `/api/k4-showcase/coverage` — Live execution of all 5 K4 replays separating `preBootGap (F1..F2)`
 *     from `steppedRuntimeExecGap (F3+) = 0` across every Act!
 *   - `/api/k4-showcase/s2c`      — Live decoded `tests/fixtures/oracle/k4/s2c-113c.d2tv.gz` records.
 *   - `/api/k4-showcase/fn`       — Live x86 Intel disassembly + AST TS source + callers/callees.
 */

import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { gunzipSync } from 'node:zlib'
import { manifestKey113c, type ReplayScenario113c } from './kern-replay/replay-113c.ts'
import type { Horizon113c } from './kern-replay/report.ts'
import {
  DEFAULT_REPO_ROOT,
  canonVa,
  getManifestFunctionDetail,
  loadCoverageGzFile,
  loadManifestCached,
  parseShowcaseRequest,
  runLockstepReplayPayload,
  sendJson,
  sha256Buffer,
  type SharedReplayPayload,
} from './showcase-common.ts'
import { parseS2CVectors, type S2CVectorRecord } from './vectors/s2c-vector.ts'

export const K4_QUEST_SCENARIOS = [
  'k4-act1-quest',
  'k4-act2-quest',
  'k4-act3-quest',
  'k4-act4-quest',
  'k4-act5-quest',
] as const

export type K4QuestScenarioId = (typeof K4_QUEST_SCENARIOS)[number]

interface K4QuestStaticSpec {
  readonly act: number
  readonly townName: string
  readonly townLevelId: number
  readonly questCode: string
  readonly questName: string
  readonly wooWord: number
  readonly initialWordHex: string
  readonly finalWordHex: string
  readonly npcName: string
  readonly npcHcIdx: number
  readonly callbackVa: string
  readonly townNpcAiVa: string
  readonly scrollIdHex: string
  readonly rewardOutcome: string
}

const K4_QUEST_SPECS: Readonly<Record<K4QuestScenarioId, K4QuestStaticSpec>> = {
  'k4-act1-quest': {
    act: 1,
    townName: 'Rogue Encampment (罗格营地)',
    townLevelId: 1,
    questCode: 'A1Q1',
    questName: 'Den of Evil (邪恶洞窟)',
    wooWord: 1,
    initialWordHex: '0x0002',
    finalWordHex: '0x0001',
    npcName: 'Akara (阿卡拉)',
    npcHcIdx: 148,
    callbackVa: '0x6FC85260',
    townNpcAiVa: '0x6FCBCB00',
    scrollIdHex: '0x004C',
    rewardOutcome: '+1 STAT_NEWSKILLS (stat 5: 12 -> 13)',
  },
  'k4-act2-quest': {
    act: 2,
    townName: 'Lut Gholein (鲁·高因)',
    townLevelId: 40,
    questCode: 'A2Q1',
    questName: "Radament's Lair (罗达门特的巢穴)",
    wooWord: 9,
    initialWordHex: '0x2021',
    finalWordHex: '0x2021 (+A2Q0 word 8 bit 0)',
    npcName: 'Jerhyn (杰海因)',
    npcHcIdx: 201,
    callbackVa: '0x6FCE4620',
    townNpcAiVa: '0x6FC3DB40',
    scrollIdHex: '0x00FD',
    rewardOutcome: "消耗技能之书 'ass '，+1 STAT_NEWSKILLS (stat 5: 12 -> 13)",
  },
  'k4-act3-quest': {
    act: 3,
    townName: 'Kurast Docks (库拉斯特海港)',
    townLevelId: 75,
    questCode: 'A3Q1',
    questName: 'The Golden Bird (黄金鸟)',
    wooWord: 20,
    initialWordHex: '0x0004',
    finalWordHex: '0x0010 (mints g34)',
    npcName: 'Meshif (马席夫)',
    npcHcIdx: 264,
    callbackVa: '0x6FD08B60',
    townNpcAiVa: '0x6FC3BC60',
    scrollIdHex: '0x0211',
    rewardOutcome: "删除玉雕 'j34 '，铸造黄金鸟 'g34 '（F42 精确推进 64-bit gs）",
  },
  'k4-act4-quest': {
    act: 4,
    townName: 'Pandemonium Fortress (群魔堡垒)',
    townLevelId: 103,
    questCode: 'A4Q1',
    questName: 'The Fallen Angel (堕落天使)',
    wooWord: 25,
    initialWordHex: '0x0002',
    finalWordHex: '0x0001',
    npcName: 'Tyrael (泰瑞尔)',
    npcHcIdx: 367,
    callbackVa: '0x6FCDA5E0',
    townNpcAiVa: '0x6FC39880',
    scrollIdHex: '0x02A4',
    rewardOutcome: '+2 STAT_NEWSKILLS (stat 5: 12 -> 14)',
  },
  'k4-act5-quest': {
    act: 5,
    townName: 'Harrogath (哈洛加斯)',
    townLevelId: 109,
    questCode: 'A5Q3',
    questName: 'Prison of Ice (冰之囚)',
    wooWord: 37,
    initialWordHex: '0x0202',
    finalWordHex: '0x0301 (mints & uses tr2)',
    npcName: 'Malah (马拉)',
    npcHcIdx: 513,
    callbackVa: '0x6FC7F5E0',
    townNpcAiVa: '0x6FCCA4D0',
    scrollIdHex: '0x4EA4',
    rewardOutcome: "铸造并消耗抗性卷轴 'tr2 '，全抗 +10 (stats 39/41/43/45: 0 -> 10)",
  },
}

const C2S_OPCODE_LABELS: Readonly<Record<number, string>> = {
  0x01: 'C2S 0x01 WalkToLocation',
  0x03: 'C2S 0x03 RunToLocation',
  0x13: 'C2S 0x13 UnitInteract',
  0x20: 'C2S 0x20 UseItem (Consumable)',
  0x2f: 'C2S 0x2F NpcInit',
  0x30: 'C2S 0x30 NpcCancel',
  0x31: 'C2S 0x31 QuestMessage',
}

export interface K4OverviewScenario {
  readonly scenario: K4QuestScenarioId
  readonly act: number
  readonly townName: string
  readonly townLevelId: number
  readonly questCode: string
  readonly questName: string
  readonly npcName: string
  readonly rewardOutcome: string
  readonly goldenFrames: number
  readonly strictHorizon: number
  readonly posHorizon: number
  readonly dllHitsTotal: number
}

export interface K4OverviewResponse {
  readonly ok: true
  readonly scenarioCount: number
  readonly totalGoldenFrames: number
  readonly totalSteppedFrames: number
  readonly ds1BundleEntryCount: number
  readonly s2cVectorCount: number
  readonly s2cVectorSha256: string
  readonly scenarios: readonly K4OverviewScenario[]
}

export interface K4QuestDetail {
  readonly scenario: K4QuestScenarioId
  readonly spec: K4QuestStaticSpec
  readonly callbackName: string
  readonly callbackKernFile: string | null
  readonly townNpcAiName: string
  readonly townNpcAiKernFile: string | null
  readonly c2sInputs: readonly {
    readonly frame: number
    readonly hex: string
    readonly opcodeHex: string
    readonly opcodeLabel: string
  }[]
}

export interface K4QuestsResponse {
  readonly ok: true
  readonly quests: readonly K4QuestDetail[]
  readonly ds1Bundle: {
    readonly relPath: string
    readonly entryCount: number
    readonly samplePaths: readonly string[]
  }
}

export interface K4CoverageScenarioRow {
  readonly scenario: K4QuestScenarioId
  readonly act: number
  readonly goldenFrames: number
  readonly zeroDivergence: boolean
  readonly d2CommonDll: number
  readonly d2CommonTsInDll: number
  readonly d2CommonPreBootGap: number
  readonly d2CommonSteppedGap: number
  readonly d2GameDll: number
  readonly d2GameTsInDll: number
  readonly d2GamePreBootGap: number
  readonly d2GameSteppedGap: number
  readonly preBootVas: readonly { readonly key: string; readonly name: string; readonly firstFrame: number }[]
}

export interface K4CoverageResponse {
  readonly ok: true
  readonly computeMs: number
  readonly allZeroDivergence: boolean
  readonly unionDllTotal: number
  readonly unionD2CommonDll: number
  readonly unionD2CommonPreBootGap: number
  readonly unionD2CommonSteppedGap: number
  readonly unionD2GameDll: number
  readonly unionD2GamePreBootGap: number
  readonly unionD2GameSteppedGap: number
  readonly scenarios: readonly K4CoverageScenarioRow[]
}

export interface K4S2CVectorRow {
  readonly index: number
  readonly opKind: number
  readonly flags: number
  readonly rawLen: number
  readonly framedLen: number
  readonly decompLen: number
  readonly pktCount: number
  readonly firstOpcodeHex: string
  readonly wireHdrHex: string
  readonly rawPrefixHex: string
  readonly framedPrefixHex: string
}

export interface K4S2CResponse {
  readonly ok: true
  readonly relPath: string
  readonly sha256: string
  readonly totalRecords: number
  readonly filteredCount: number
  readonly opKindFilter: number | null
  readonly records: readonly K4S2CVectorRow[]
}

const k4ReplayCache = new Map<string, { payload: SharedReplayPayload; tsExecutedVas: readonly string[] }>()
let k4OverviewCache: K4OverviewResponse | null = null
let k4QuestsCache: K4QuestsResponse | null = null
let k4CoverageCache: K4CoverageResponse | null = null
let k4S2cCache: { sha256: string; records: S2CVectorRecord[] } | null = null

function isK4Scenario(s: string): s is K4QuestScenarioId {
  return (K4_QUEST_SCENARIOS as readonly string[]).includes(s)
}

function getK4S2cParsed(rootDir: string): { sha256: string; records: S2CVectorRecord[] } {
  if (k4S2cCache) return k4S2cCache
  const raw = gunzipSync(readFileSync(resolve(rootDir, 'tests/fixtures/oracle/k4/s2c-113c.d2tv.gz')))
  const parsed = parseS2CVectors(raw)
  k4S2cCache = { sha256: sha256Buffer(raw), records: parsed.records }
  return k4S2cCache
}

function readDs1BundleSummary(rootDir: string): { relPath: string; entryCount: number; samplePaths: string[] } {
  const relPath = 'tests/fixtures/oracle/k4/drlg-act2-5-ds1-dt1-113c.json.gz'
  const abs = resolve(rootDir, relPath)
  if (!existsSync(abs)) return { relPath, entryCount: 0, samplePaths: [] }
  const parsed = JSON.parse(gunzipSync(readFileSync(abs)).toString('utf8')) as Record<string, unknown>
  const ds1Map =
    (parsed.ds1ByPath as Record<string, unknown> | undefined) ??
    (parsed.ds1 as Record<string, unknown> | undefined) ??
    parsed
  const keys = Object.keys(ds1Map).sort()
  return { relPath, entryCount: keys.length, samplePaths: keys.slice(0, 20) }
}

function runK4ScenarioCached(
  scenarioName: K4QuestScenarioId,
  rootDir: string,
): { payload: SharedReplayPayload; tsExecutedVas: readonly string[] } {
  const hit = k4ReplayCache.get(scenarioName)
  if (hit) return hit
  const dir = resolve(rootDir, 'tests/fixtures/oracle/k4')
  const res = runLockstepReplayPayload({
    scenarioName,
    goldenPath: resolve(dir, `${scenarioName}.oracle.ndjson.gz`),
    snapshotPath: resolve(dir, `${scenarioName}.snap-f002.ndjson.gz`),
    scenarioPath: resolve(rootDir, 'tests/fixtures/oracle/scenarios', `${scenarioName}.json`),
    coveragePath: resolve(dir, `${scenarioName}.coverage.ndjson.gz`),
    rootDir,
    bootFrame: 2,
    trackPlayerStatIds: [5, 39, 41, 43, 45],
  })
  k4ReplayCache.set(scenarioName, res)
  return res
}

export function getK4OverviewData(rootDir: string = DEFAULT_REPO_ROOT): K4OverviewResponse {
  if (k4OverviewCache) return k4OverviewCache
  const dir = resolve(rootDir, 'tests/fixtures/oracle/k4')
  const horizons = JSON.parse(readFileSync(resolve(dir, 'horizons.json'), 'utf8')) as Record<string, Horizon113c>
  const ds1 = readDs1BundleSummary(rootDir)
  const s2c = getK4S2cParsed(rootDir)

  const scenarios: K4OverviewScenario[] = []
  let totalGoldenFrames = 0
  let totalSteppedFrames = 0
  for (const name of K4_QUEST_SCENARIOS) {
    const spec = K4_QUEST_SPECS[name]
    const hz = horizons[name]
    const cov = loadCoverageGzFile(resolve(dir, `${name}.coverage.ndjson.gz`))
    const gf = cov.to || hz?.strict || 0
    totalGoldenFrames += gf
    totalSteppedFrames += Math.max(0, gf - 2)
    scenarios.push({
      scenario: name,
      act: spec.act,
      townName: spec.townName,
      townLevelId: spec.townLevelId,
      questCode: spec.questCode,
      questName: spec.questName,
      npcName: spec.npcName,
      rewardOutcome: spec.rewardOutcome,
      goldenFrames: gf,
      strictHorizon: hz?.strict ?? gf,
      posHorizon: hz?.pos ?? gf,
      dllHitsTotal: cov.hit,
    })
  }

  k4OverviewCache = {
    ok: true,
    scenarioCount: scenarios.length,
    totalGoldenFrames,
    totalSteppedFrames,
    ds1BundleEntryCount: ds1.entryCount,
    s2cVectorCount: s2c.records.length,
    s2cVectorSha256: s2c.sha256,
    scenarios,
  }
  return k4OverviewCache
}

export function getK4ReplayData(
  scenarioName: string,
  rootDir: string = DEFAULT_REPO_ROOT,
): SharedReplayPayload {
  if (!isK4Scenario(scenarioName)) {
    throw new Error(`Unsupported K4 scenario '${scenarioName}'. Expected one of: ${K4_QUEST_SCENARIOS.join(', ')}`)
  }
  return runK4ScenarioCached(scenarioName, rootDir).payload
}

export function getK4QuestsData(rootDir: string = DEFAULT_REPO_ROOT): K4QuestsResponse {
  if (k4QuestsCache) return k4QuestsCache
  const manifest = loadManifestCached(rootDir)
  const quests: K4QuestDetail[] = K4_QUEST_SCENARIOS.map((name) => {
    const spec = K4_QUEST_SPECS[name]
    const scenario = JSON.parse(
      readFileSync(resolve(rootDir, 'tests/fixtures/oracle/scenarios', `${name}.json`), 'utf8'),
    ) as ReplayScenario113c
    const cbFn = manifest.byKey.get(`D2Game:${canonVa(spec.callbackVa)}`)
    const aiFn = manifest.byKey.get(`D2Game:${canonVa(spec.townNpcAiVa)}`)
    return {
      scenario: name,
      spec,
      callbackName: cbFn?.name ?? '(unknown)',
      callbackKernFile: cbFn?.kernFile ?? null,
      townNpcAiName: aiFn?.name ?? '(unknown)',
      townNpcAiKernFile: aiFn?.kernFile ?? null,
      c2sInputs: scenario.inputs.map((inp) => {
        const clean = inp.c2s.replace(/\s+/g, '')
        const op = parseInt(clean.slice(0, 2), 16) || 0
        const opcodeHex = `0x${op.toString(16).toUpperCase().padStart(2, '0')}`
        return {
          frame: inp.frame,
          hex: inp.c2s,
          opcodeHex,
          opcodeLabel: C2S_OPCODE_LABELS[op] ?? `C2S ${opcodeHex}`,
        }
      }),
    }
  })

  k4QuestsCache = {
    ok: true,
    quests,
    ds1Bundle: readDs1BundleSummary(rootDir),
  }
  return k4QuestsCache
}

export function getK4CoverageData(rootDir: string = DEFAULT_REPO_ROOT): K4CoverageResponse {
  if (k4CoverageCache) return k4CoverageCache
  const t0 = performance.now()
  const manifest = loadManifestCached(rootDir)
  const dir = resolve(rootDir, 'tests/fixtures/oracle/k4')
  const unionDllC = new Map<string, number>()
  const unionDllG = new Map<string, number>()
  const unionTs = new Set<string>()
  const rows: K4CoverageScenarioRow[] = []
  let allZero = true

  for (const name of K4_QUEST_SCENARIOS) {
    const { payload, tsExecutedVas } = runK4ScenarioCached(name, rootDir)
    const cov = loadCoverageGzFile(resolve(dir, `${name}.coverage.ndjson.gz`))
    const tsSet = new Set(tsExecutedVas)
    for (const k of tsExecutedVas) unionTs.add(k)

    let cDll = 0
    let cPre = 0
    let cStep = 0
    let gDll = 0
    let gPre = 0
    let gStep = 0
    const preBootVas: { key: string; name: string; firstFrame: number }[] = []

    for (const h of cov.hits) {
      const k = manifestKey113c(h.module, h.va)
      if (h.module === 'D2Common') {
        cDll++
        const prev = unionDllC.get(k)
        if (prev === undefined || h.firstFrame > prev) unionDllC.set(k, h.firstFrame)
        if (!tsSet.has(k)) {
          if (h.firstFrame <= 2) {
            cPre++
            preBootVas.push({ key: k, name: manifest.byKey.get(k)?.name ?? '(unknown)', firstFrame: h.firstFrame })
          } else {
            cStep++
          }
        }
      } else if (h.module === 'D2Game') {
        gDll++
        const prev = unionDllG.get(k)
        if (prev === undefined || h.firstFrame > prev) unionDllG.set(k, h.firstFrame)
        if (!tsSet.has(k)) {
          if (h.firstFrame <= 2) {
            gPre++
            preBootVas.push({ key: k, name: manifest.byKey.get(k)?.name ?? '(unknown)', firstFrame: h.firstFrame })
          } else {
            gStep++
          }
        }
      }
    }

    const zero = payload.divergedFrames === 0 && payload.firstStrictDivergence === null
    if (!zero) allZero = false
    preBootVas.sort((a, b) => a.key.localeCompare(b.key))
    rows.push({
      scenario: name,
      act: K4_QUEST_SPECS[name].act,
      goldenFrames: payload.lastGoldenFrame,
      zeroDivergence: zero,
      d2CommonDll: cDll,
      d2CommonTsInDll: cDll - cPre - cStep,
      d2CommonPreBootGap: cPre,
      d2CommonSteppedGap: cStep,
      d2GameDll: gDll,
      d2GameTsInDll: gDll - gPre - gStep,
      d2GamePreBootGap: gPre,
      d2GameSteppedGap: gStep,
      preBootVas,
    })
  }

  let uCPre = 0
  let uCStep = 0
  for (const [k, maxFirst] of unionDllC) {
    if (!unionTs.has(k)) {
      if (maxFirst <= 2) uCPre++
      else uCStep++
    }
  }
  let uGPre = 0
  let uGStep = 0
  for (const [k, maxFirst] of unionDllG) {
    if (!unionTs.has(k)) {
      if (maxFirst <= 2) uGPre++
      else uGStep++
    }
  }

  k4CoverageCache = {
    ok: true,
    computeMs: Math.round(performance.now() - t0),
    allZeroDivergence: allZero,
    unionDllTotal: unionDllC.size + unionDllG.size,
    unionD2CommonDll: unionDllC.size,
    unionD2CommonPreBootGap: uCPre,
    unionD2CommonSteppedGap: uCStep,
    unionD2GameDll: unionDllG.size,
    unionD2GamePreBootGap: uGPre,
    unionD2GameSteppedGap: uGStep,
    scenarios: rows,
  }
  return k4CoverageCache
}

function bytesHex(u8: Uint8Array): string {
  return [...u8].map((b) => b.toString(16).padStart(2, '0')).join(' ')
}

export function getK4S2CData(
  rootDir: string = DEFAULT_REPO_ROOT,
  opKindFilter: number | null = null,
  limit = 160,
): K4S2CResponse {
  const parsed = getK4S2cParsed(rootDir)
  const filtered =
    opKindFilter !== null
      ? parsed.records.filter((r) => r.opKind === opKindFilter)
      : parsed.records
  const cap = Math.max(1, Math.min(400, Math.trunc(limit)))
  return {
    ok: true,
    relPath: 'tests/fixtures/oracle/k4/s2c-113c.d2tv.gz',
    sha256: parsed.sha256,
    totalRecords: parsed.records.length,
    filteredCount: filtered.length,
    opKindFilter,
    records: filtered.slice(0, cap).map((r) => ({
      index: r.index,
      opKind: r.opKind,
      flags: r.flags,
      rawLen: r.rawLen,
      framedLen: r.framedLen,
      decompLen: r.decompLen,
      pktCount: r.pktCount,
      firstOpcodeHex: `0x${r.firstOpcode.toString(16).toUpperCase().padStart(2, '0')}`,
      wireHdrHex: `${r.wireHdr0.toString(16).padStart(2, '0')} ${r.wireHdr1.toString(16).padStart(2, '0')}`,
      rawPrefixHex: bytesHex(r.rawPrefix),
      framedPrefixHex: bytesHex(r.framedPrefix),
    })),
  }
}

export interface K4ShowcaseMiddlewareOptions {
  readonly rootDir?: string
}

export function createK4ShowcaseHttpMiddleware(options?: K4ShowcaseMiddlewareOptions) {
  const rootDir = options?.rootDir ?? DEFAULT_REPO_ROOT
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const parsed = parseShowcaseRequest(req, '/api/k4-showcase/')
    if (!parsed) {
      next()
      return
    }
    if (req.method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'Method Not Allowed' })
      return
    }
    try {
      if (parsed.subRoute === 'overview') {
        sendJson(res, 200, getK4OverviewData(rootDir))
        return
      }
      if (parsed.subRoute === 'replay') {
        const scenario = parsed.params.get('scenario')?.trim() || K4_QUEST_SCENARIOS[0]
        sendJson(res, 200, getK4ReplayData(scenario, rootDir))
        return
      }
      if (parsed.subRoute === 'quests') {
        sendJson(res, 200, getK4QuestsData(rootDir))
        return
      }
      if (parsed.subRoute === 'coverage') {
        sendJson(res, 200, getK4CoverageData(rootDir))
        return
      }
      if (parsed.subRoute === 's2c') {
        const opStr = parsed.params.get('opKind')
        const op = opStr !== null && opStr !== '' && opStr !== 'all' ? Number(opStr) : null
        const lim = Number(parsed.params.get('limit') ?? '160')
        sendJson(
          res,
          200,
          getK4S2CData(rootDir, op !== null && Number.isFinite(op) ? op : null, Number.isFinite(lim) ? lim : 160),
        )
        return
      }
      if (parsed.subRoute === 'fn') {
        const va = parsed.params.get('va')?.trim()
        if (!va) {
          sendJson(res, 400, { ok: false, error: 'Missing required query parameter: va' })
          return
        }
        sendJson(res, 200, getManifestFunctionDetail(rootDir, va, parsed.params.get('module')))
        return
      }
      sendJson(res, 404, { ok: false, error: `Unknown K4 showcase route: ${parsed.normPath}` })
    } catch (err: unknown) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
}
