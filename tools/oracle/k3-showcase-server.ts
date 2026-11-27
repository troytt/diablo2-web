/**
 * [K3] Class Skills, Summons, Curses, Warcries, Auras, Merc & DoT Interactive Visual Showcase
 * Backend (`tools/oracle/k3-showcase-server.ts`).
 *
 * Serves authentic K3 (`9 x p52-*`, `15,700` frames, `runtimeExecGap = 0`) data under `/api/k3-showcase/*`:
 *   - `/api/k3-showcase/overview`   — 9-scenario catalog, horizons, DLL coverage union (`780` D2Common + `652` D2Game), `skillcalc-113c.d2tv.gz` summary.
 *   - `/api/k3-showcase/replay`     — Live `src/d2kern-113c` replay of any of the 9 `p52-*` scenarios.
 *   - `/api/k3-showcase/verify-all` — Live execution of all 9 `p52-*` scenarios proving `runtimeExecGap = 0` across the union.
 *   - `/api/k3-showcase/subsystems` — 15 closed K3 `D2Game.dll` VAs enriched with manifest + per-scenario firstFrame hit matrix.
 *   - `/api/k3-showcase/fn`         — Live x86 Intel disassembly + AST TS source + callers/callees.
 *   - `/api/k3-showcase/skillcalc`  — Live decoded `skillcalc-113c.d2tv.gz` (`12,600` records, 7 classes × 210 skills × slvl 1..60).
 */

import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { gunzipSync } from 'node:zlib'
import {
  K3_REPLAY_SCENARIOS_113C,
  k3CoveragePath113c,
  k3SnapshotPath113c,
  loadK3Coverage113c,
  loadK3Horizons113c,
  runK3Replay113c,
  type K3ReplayScenarioName113c,
} from './kern-replay/k3-replay.ts'
import { manifestKey113c } from './kern-replay/replay-113c.ts'
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
import { parseSkillCalcVectors, type SkillCalcVectorRecord } from './vectors/skillcalc-vector.ts'

export const K3_SCENARIOS = K3_REPLAY_SCENARIOS_113C

export interface K3ScenarioSummary {
  readonly scenario: K3ReplayScenarioName113c
  readonly classLabel: string
  readonly focus: string
  readonly goldenFrames: number
  readonly strictHorizon: number
  readonly posHorizon: number
  readonly d2CommonDllHits: number
  readonly d2GameDllHits: number
}

export interface K3OverviewResponse {
  readonly ok: true
  readonly scenarioCount: number
  readonly totalGoldenFrames: number
  readonly totalSteppedFrames: number
  readonly dllUnionD2Common: number
  readonly dllUnionD2Game: number
  readonly closedSubsystemsCount: number
  readonly skillCalcVectors: {
    readonly relPath: string
    readonly recordCount: number
    readonly sha256: string
  }
  readonly scenarios: readonly K3ScenarioSummary[]
}

export interface K3ClosedSubsystemEntry {
  readonly va: string
  readonly name: string
  readonly size: number
  readonly status: string
  readonly kernFile: string | null
  readonly tsSymbol: string | null
  readonly role: string
  readonly hits: readonly { readonly scenario: string; readonly firstFrame: number }[]
}

export interface K3SubsystemsResponse {
  readonly ok: true
  readonly entries: readonly K3ClosedSubsystemEntry[]
}

export interface K3VerifyAllScenario {
  readonly scenario: K3ReplayScenarioName113c
  readonly bootOk: boolean
  readonly strictHorizon: number
  readonly lastGoldenFrame: number
  readonly zeroDivergence: boolean
  readonly d2CommonDll: number
  readonly d2CommonGap: number
  readonly d2GameDll: number
  readonly d2GameGap: number
}

export interface K3VerifyAllResponse {
  readonly ok: true
  readonly computeMs: number
  readonly allZeroDivergence: boolean
  readonly unionD2CommonDll: number
  readonly unionD2CommonGap: number
  readonly unionD2GameDll: number
  readonly unionD2GameGap: number
  readonly scenarios: readonly K3VerifyAllScenario[]
}

export interface K3SkillCalcResponse {
  readonly ok: true
  readonly relPath: string
  readonly sha256: string
  readonly totalRecords: number
  readonly filteredCount: number
  readonly classFilter: number | null
  readonly records: readonly SkillCalcVectorRecord[]
}

const K3_SCENARIO_META: Readonly<Record<K3ReplayScenarioName113c, { classLabel: string; focus: string }>> = {
  'p52-amazon-defense': { classLabel: 'Amazon', focus: 'Dodge / Avoid / Evade 被动闪避 + Critical Strike 暴击' },
  'p52-amazon-valkyrie': { classLabel: 'Amazon', focus: 'Valkyrie 召唤 + MonEquip 稀有装 + NecroPet AI + 面包屑寻路' },
  'p52-barbarian-warcries': { classLabel: 'Barbarian', focus: 'Shout / Battle Orders / Battle Command / War Cry 眩晕环' },
  'p52-necromancer-curses': { classLabel: 'Necromancer', focus: 'Amp / Decrep / Lower Resist / Weaken 诅咒 + Raise Skeleton' },
  'p52-necromancer-poison-golem': { classLabel: 'Necromancer', focus: 'Clay Golem 减速 + Golem Mastery + Poison Nova DoT' },
  'p52-paladin-auras': { classLabel: 'Paladin', focus: 'Event 6 周期光环 Concentration + Fanaticism + 攻击前摇保护' },
  'p52-paladin-merc-aura': { classLabel: 'Paladin + Merc', focus: 'Act 1 Rogue Scout 雇佣兵 AI (Inner Sight / Cold Arrow) + 共享光环' },
  'p52-sorceress-elemental': { classLabel: 'Sorceress', focus: 'Fire Ball / Chain Lightning / Frozen Orb / Glacial Spike' },
  'p52-sorceress-fire-dot': { classLabel: 'Sorceress', focus: 'Fire Wall (skilldelay) + Inferno PLRMODE_SEQUENCE 持续耗蓝' },
}

const K3_CLOSED_SUBSYSTEMS: readonly { va: string; role: string }[] = [
  { va: '0x6FC3DD40', role: 'AI_Hireable — 雇佣兵顶层 AI 分发器 (Act 1 Rogue Scout)' },
  { va: '0x6FC3D3C0', role: 'AI_Hireable_Sub — 佣兵城镇巡逻/跟随/Inner Sight/Cold Arrow' },
  { va: '0x6FC49720', role: 'SKILLS_SrvDo068_BasicShout — 战吼径向投射物环 (BO/BC/Shout/WarCry)' },
  { va: '0x6FC5EA60', role: 'MISSMODE_SrvHit18_Shout — 施加 BO/BC/Shout 状态与增益' },
  { va: '0x6FC6D710', role: 'SKILLS_SrvDo016_Valkyrie — 召唤女武神 + MonEquip 装备 + 协同被动' },
  { va: '0x6FC71750', role: 'SKILLS_SrvDo056_Golem — 召唤黏土石魔 + Golem Mastery 生命加成' },
  { va: '0x6FC70070', role: 'Golem Mastery 被动属性辅助函数' },
  { va: '0x6FC718B0', role: 'SKILLS_SrvDo031_RaiseSkeleton_Mage — 消耗尸体召唤骷髅战士' },
  { va: '0x6FCC3610', role: 'D2GAME_SummonPet — 通用召唤物生成、上限裁切与初始 AI 调度' },
  { va: '0x6FCC3090', role: 'Pet 上限人数统计辅助' },
  { va: '0x6FCB7F50', role: '玩家召唤物表登记 (PetType.txt 关联与 S2C 同步)' },
  { va: '0x6FC3E900', role: 'AI_NecroPet — 石魔/女武神/骷髅通用 AI 入口' },
  { va: '0x6FC3E640', role: 'AI_NecroPet_Melee — 宠物寻敌、80% A1 挥击与追击' },
  { va: '0x6FC3E140', role: 'AIPET_CheckFollow — 计算主人距离阈值与跟随状态 0..5' },
  { va: '0x6FC3CAE0', role: 'AIPET_PetMove — 6 态跳转表 + pPlayerData+0xA8 面包屑环跟随/传送' },
]

const k3ReplayCache = new Map<string, SharedReplayPayload>()
let k3OverviewCache: K3OverviewResponse | null = null
let k3SubsystemsCache: K3SubsystemsResponse | null = null
let k3VerifyAllCache: K3VerifyAllResponse | null = null
let k3SkillCalcCache: { sha256: string; records: SkillCalcVectorRecord[] } | null = null

function isK3Scenario(s: string): s is K3ReplayScenarioName113c {
  return (K3_REPLAY_SCENARIOS_113C as readonly string[]).includes(s)
}

function getSkillCalcParsed(rootDir: string): { sha256: string; records: SkillCalcVectorRecord[] } {
  if (k3SkillCalcCache) return k3SkillCalcCache
  const rawGz = readFileSync(resolve(rootDir, 'tests/fixtures/oracle/k3/skillcalc-113c.d2tv.gz'))
  const raw = gunzipSync(rawGz)
  const parsed = parseSkillCalcVectors(raw)
  k3SkillCalcCache = { sha256: sha256Buffer(raw), records: parsed.records }
  return k3SkillCalcCache
}

export function getK3OverviewData(rootDir: string = DEFAULT_REPO_ROOT): K3OverviewResponse {
  if (k3OverviewCache) return k3OverviewCache
  const horizons = loadK3Horizons113c()
  const unionC = new Set<string>()
  const unionG = new Set<string>()
  const scenarios: K3ScenarioSummary[] = []
  let totalGoldenFrames = 0
  let totalSteppedFrames = 0

  for (const name of K3_REPLAY_SCENARIOS_113C) {
    const covPath = k3CoveragePath113c(name)
    const cov = loadCoverageGzFile(covPath)
    let cHits = 0
    let gHits = 0
    for (const h of cov.hits) {
      const k = manifestKey113c(h.module, h.va)
      if (h.module === 'D2Common') {
        cHits++
        unionC.add(k)
      } else if (h.module === 'D2Game') {
        gHits++
        unionG.add(k)
      }
    }
    const hz = horizons[name]
    const goldenFrames = cov.to || hz?.strict || 0
    totalGoldenFrames += goldenFrames
    totalSteppedFrames += Math.max(0, goldenFrames - 2)
    scenarios.push({
      scenario: name,
      classLabel: K3_SCENARIO_META[name].classLabel,
      focus: K3_SCENARIO_META[name].focus,
      goldenFrames,
      strictHorizon: hz?.strict ?? goldenFrames,
      posHorizon: hz?.pos ?? goldenFrames,
      d2CommonDllHits: cHits,
      d2GameDllHits: gHits,
    })
  }

  const sc = getSkillCalcParsed(rootDir)
  k3OverviewCache = {
    ok: true,
    scenarioCount: scenarios.length,
    totalGoldenFrames,
    totalSteppedFrames,
    dllUnionD2Common: unionC.size,
    dllUnionD2Game: unionG.size,
    closedSubsystemsCount: K3_CLOSED_SUBSYSTEMS.length,
    skillCalcVectors: {
      relPath: 'tests/fixtures/oracle/k3/skillcalc-113c.d2tv.gz',
      recordCount: sc.records.length,
      sha256: sc.sha256,
    },
    scenarios,
  }
  return k3OverviewCache
}

export function getK3ReplayData(
  scenarioName: string,
  rootDir: string = DEFAULT_REPO_ROOT,
): SharedReplayPayload {
  if (!isK3Scenario(scenarioName)) {
    throw new Error(`Unsupported K3 scenario '${scenarioName}'. Expected one of: ${K3_REPLAY_SCENARIOS_113C.join(', ')}`)
  }
  const hit = k3ReplayCache.get(scenarioName)
  if (hit) return hit
  const { payload } = runLockstepReplayPayload({
    scenarioName,
    goldenPath: resolve(rootDir, 'tests/fixtures/oracle/golden', `${scenarioName}.oracle.ndjson.gz`),
    snapshotPath: k3SnapshotPath113c(scenarioName, 2),
    scenarioPath: resolve(rootDir, 'tests/fixtures/oracle/scenarios', `${scenarioName}.json`),
    coveragePath: k3CoveragePath113c(scenarioName),
    rootDir,
    bootFrame: 2,
  })
  k3ReplayCache.set(scenarioName, payload)
  return payload
}

export function getK3SubsystemsData(rootDir: string = DEFAULT_REPO_ROOT): K3SubsystemsResponse {
  if (k3SubsystemsCache) return k3SubsystemsCache
  const manifest = loadManifestCached(rootDir)
  const hitIndex = new Map<string, { scenario: string; firstFrame: number }[]>()

  for (const name of K3_REPLAY_SCENARIOS_113C) {
    const covPath = k3CoveragePath113c(name)
    if (!existsSync(covPath)) continue
    const cov = loadCoverageGzFile(covPath)
    for (const h of cov.hits) {
      if (h.module !== 'D2Game') continue
      const vaHex = canonVa(h.va)
      let arr = hitIndex.get(vaHex)
      if (!arr) {
        arr = []
        hitIndex.set(vaHex, arr)
      }
      arr.push({ scenario: name, firstFrame: h.firstFrame })
    }
  }

  const entries: K3ClosedSubsystemEntry[] = K3_CLOSED_SUBSYSTEMS.map((spec) => {
    const vaHex = canonVa(spec.va)
    const fn = manifest.byKey.get(`D2Game:${vaHex}`)
    return {
      va: vaHex,
      name: fn?.name ?? '(unknown)',
      size: fn?.size ?? 0,
      status: fn?.status ?? 'unported',
      kernFile: fn?.kernFile ?? null,
      tsSymbol: fn?.tsSymbol ?? null,
      role: spec.role,
      hits: hitIndex.get(vaHex) ?? [],
    }
  })

  k3SubsystemsCache = { ok: true, entries }
  return k3SubsystemsCache
}

export function runK3VerifyAllLive(): K3VerifyAllResponse {
  if (k3VerifyAllCache) return k3VerifyAllCache
  const t0 = performance.now()
  const unionDllC = new Set<string>()
  const unionDllG = new Set<string>()
  const unionTs = new Set<string>()
  const scenarios: K3VerifyAllScenario[] = []
  let allZero = true

  for (const name of K3_REPLAY_SCENARIOS_113C) {
    const res = runK3Replay113c(name, 2)
    const cov = loadK3Coverage113c(name)
    const tsSet = new Set(res.tsExecutedVas)
    let d2CommonDll = 0
    let d2CommonGap = 0
    let d2GameDll = 0
    let d2GameGap = 0
    for (const h of cov.hits) {
      const k = manifestKey113c(h.module, h.va)
      if (h.module === 'D2Common') {
        d2CommonDll++
        unionDllC.add(k)
        if (!tsSet.has(k)) d2CommonGap++
      } else if (h.module === 'D2Game') {
        d2GameDll++
        unionDllG.add(k)
        if (!tsSet.has(k)) d2GameGap++
      }
    }
    for (const k of res.tsExecutedVas) unionTs.add(k)
    const zero =
      res.bootCheck === null &&
      res.firstStrictDivergence === null &&
      res.strictHorizon === res.lastGoldenFrame
    if (!zero) allZero = false
    scenarios.push({
      scenario: name,
      bootOk: res.bootCheck === null,
      strictHorizon: res.strictHorizon,
      lastGoldenFrame: res.lastGoldenFrame,
      zeroDivergence: zero,
      d2CommonDll,
      d2CommonGap,
      d2GameDll,
      d2GameGap,
    })
  }

  let unionGapC = 0
  for (const k of unionDllC) if (!unionTs.has(k)) unionGapC++
  let unionGapG = 0
  for (const k of unionDllG) if (!unionTs.has(k)) unionGapG++

  k3VerifyAllCache = {
    ok: true,
    computeMs: Math.round(performance.now() - t0),
    allZeroDivergence: allZero,
    unionD2CommonDll: unionDllC.size,
    unionD2CommonGap: unionGapC,
    unionD2GameDll: unionDllG.size,
    unionD2GameGap: unionGapG,
    scenarios,
  }
  return k3VerifyAllCache
}

export function getK3SkillCalcData(
  rootDir: string = DEFAULT_REPO_ROOT,
  classFilter: number | null = null,
  limit = 210,
): K3SkillCalcResponse {
  const parsed = getSkillCalcParsed(rootDir)
  const filtered =
    classFilter !== null && classFilter >= 0 && classFilter <= 6
      ? parsed.records.filter((r) => r.charClass === classFilter)
      : parsed.records
  const cap = Math.max(1, Math.min(500, Math.trunc(limit)))
  return {
    ok: true,
    relPath: 'tests/fixtures/oracle/k3/skillcalc-113c.d2tv.gz',
    sha256: parsed.sha256,
    totalRecords: parsed.records.length,
    filteredCount: filtered.length,
    classFilter,
    records: filtered.slice(0, cap),
  }
}

export interface K3ShowcaseMiddlewareOptions {
  readonly rootDir?: string
}

export function createK3ShowcaseHttpMiddleware(options?: K3ShowcaseMiddlewareOptions) {
  const rootDir = options?.rootDir ?? DEFAULT_REPO_ROOT
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const parsed = parseShowcaseRequest(req, '/api/k3-showcase/')
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
        sendJson(res, 200, getK3OverviewData(rootDir))
        return
      }
      if (parsed.subRoute === 'replay') {
        const scenario = parsed.params.get('scenario')?.trim() || K3_REPLAY_SCENARIOS_113C[0]
        sendJson(res, 200, getK3ReplayData(scenario, rootDir))
        return
      }
      if (parsed.subRoute === 'verify-all') {
        sendJson(res, 200, runK3VerifyAllLive())
        return
      }
      if (parsed.subRoute === 'subsystems') {
        sendJson(res, 200, getK3SubsystemsData(rootDir))
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
      if (parsed.subRoute === 'skillcalc') {
        const clsStr = parsed.params.get('class')
        const cls = clsStr !== null && clsStr !== '' && clsStr !== 'all' ? Number(clsStr) : null
        const lim = Number(parsed.params.get('limit') ?? '210')
        sendJson(
          res,
          200,
          getK3SkillCalcData(
            rootDir,
            cls !== null && Number.isFinite(cls) ? cls : null,
            Number.isFinite(lim) ? lim : 210,
          ),
        )
        return
      }
      sendJson(res, 404, { ok: false, error: `Unknown K3 showcase route: ${parsed.normPath}` })
    } catch (err: unknown) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
}
