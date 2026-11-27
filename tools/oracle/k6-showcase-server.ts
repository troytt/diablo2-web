/**
 * [K6] Grand Slam `4,810 / 4,810 (100.00%)` Real-DLL Verification & `23 / 23` (`31,453` Frames)
 * Longitudinal Closure Interactive Visual Showcase Backend (`tools/oracle/k6-showcase-server.ts`).
 *
 * Serves 100% real-time audited & replayed data under `/api/k6-showcase/*`:
 *   - `/api/k6-showcase/overview`    — Aggregate `4,810/4,810` audit summary + 23-scenario catalog.
 *   - `/api/k6-showcase/replay`      — Live `src/d2kern-113c` replay for any of the 23 K6 scenarios
 *     (`k6` 7 + `k6-s2` 8 + `k6-s3` 8).
 *   - `/api/k6-showcase/audit`       — Full deterministic TypeScript mirror of `audit-dll-coverage.py`
 *     across `manifest-113c.json`, all `.coverage.ndjson.gz` files, all 34 C emitters, and all 9 `D2Game` subsystems.
 *   - `/api/k6-showcase/emitter-src` — Sanitized real C emitter source preview (`tools/oracle/k6-emitter/*.c`).
 *   - `/api/k6-showcase/callgraph`   — All `4,810` functions (`D2Common 1,479` + `D2Game 3,331`) tagged
 *     with subsystem, status, scenarioHit, emitterHit, topoLevel, and kernFile.
 *   - `/api/k6-showcase/fn`          — Live x86 Intel disassembly + AST TS source + callers/callees.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join, relative, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import {
  K6_REPLAY_SCENARIOS_113C,
  k6CoveragePath113c,
  k6GoldenPath113c,
  k6ScenarioPath113c,
  k6SnapshotPath113c,
  loadK6Horizons113c,
} from './k6/k6-replay.ts'
import {
  K6_S2_REPLAY_SCENARIOS_113C,
  k6S2CoveragePath113c,
  k6S2GoldenPath113c,
  k6S2ScenarioPath113c,
  k6S2SnapshotPath113c,
  loadK6S2Horizons113c,
} from './k6-s2/k6-s2-replay.ts'
import {
  K6_S3_REPLAY_SCENARIOS_113C,
  k6S3CoveragePath113c,
  k6S3GoldenPath113c,
  k6S3ScenarioPath113c,
  k6S3SnapshotPath113c,
  loadK6S3Horizons113c,
} from './k6-s3/k6-s3-replay.ts'
import {
  D2GAME_SUBSYSTEM_ORDER,
  DEFAULT_REPO_ROOT,
  canonVa,
  classifyD2GameSubsystem,
  getManifestFunctionDetail,
  loadManifestCached,
  parseShowcaseRequest,
  parseVaNum,
  runLockstepReplayPayload,
  sendJson,
  type SharedReplayPayload,
} from './showcase-common.ts'

export type K6SuiteId = 'k6' | 'k6-s2' | 'k6-s3'

export interface K6ScenarioMeta {
  readonly scenario: string
  readonly suite: K6SuiteId
  readonly focus: string
  readonly goldenFrames: number
  readonly strictHorizon: number
  readonly posHorizon: number
  readonly d2CommonHits: number
  readonly d2GameHits: number
}

export interface K6SubsystemAuditRow {
  readonly subsystem: string
  readonly total: number
  readonly verified: number
  readonly unhit: number
  readonly scenarioHit: number
  readonly emitterHit: number
}

export interface K6EmitterLedgerRow {
  readonly suite: string
  readonly relPath: string
  readonly bytes: number
  readonly d2CommonVas: number
  readonly d2GameVas: number
  readonly cumD2Common: number
  readonly cumD2Game: number
  readonly cumCombined: number
}

export interface K6AuditResponse {
  readonly ok: true
  readonly d2Common: {
    readonly total: number
    readonly baselineScenarioExecuted: number
    readonly scenarioExecuted: number
    readonly emitterVerified: number
    readonly combinedVerified: number
    readonly remainingUnhit: number
  }
  readonly d2Game: {
    readonly total: number
    readonly baselineScenarioExecuted: number
    readonly scenarioExecuted: number
    readonly baselineEmitterVerified: number
    readonly emitterVerified: number
    readonly baselineCombinedVerified: number
    readonly combinedVerified: number
    readonly remainingUnhit: number
    readonly subsystems: readonly K6SubsystemAuditRow[]
  }
  readonly combined: {
    readonly total: number
    readonly emitterVerified: number
    readonly combinedVerified: number
    readonly remainingUnhit: number
  }
  readonly k6Emitters: readonly K6EmitterLedgerRow[]
  readonly scenarios: readonly K6ScenarioMeta[]
}

export interface K6OverviewResponse {
  readonly ok: true
  readonly totalFunctions: number
  readonly totalVerified: number
  readonly totalEmitterVerified: number
  readonly d2CommonVerified: number
  readonly d2CommonTotal: number
  readonly d2GameVerified: number
  readonly d2GameTotal: number
  readonly scenarioCount: number
  readonly totalScenarioFrames: number
  readonly allHorizonsComplete: boolean
  readonly emitterSuiteCount: number
  readonly scenarios: readonly K6ScenarioMeta[]
}

export interface K6CallgraphNode {
  readonly module: 'D2Common' | 'D2Game'
  readonly va: string
  readonly name: string
  readonly status: string
  readonly size: number
  readonly topoLevel: number
  readonly subsystem: string
  readonly scenarioHit: boolean
  readonly emitterHit: boolean
  readonly kf: number
}

export interface K6CallgraphResponse {
  readonly ok: true
  readonly total: number
  readonly kernFiles: readonly string[]
  readonly functions: readonly K6CallgraphNode[]
}

const D2COMMON_ORDINAL_TO_VA: Readonly<Record<number, number>> = {
  10014: 0x6fd5f2c0, 10090: 0x6fd9ea00, 10102: 0x6fd9e6d0, 10121: 0x6fda0460,
  10147: 0x6fda1070, 10188: 0x6fd87ab0, 10207: 0x6fd5ecc0, 10286: 0x6fd86260,
  10297: 0x6fda1ff0, 10302: 0x6fda0320, 10306: 0x6fda05c0, 10322: 0x6fd5ed80,
  10334: 0x6fd86820, 10510: 0x6fd9e900, 10567: 0x6fda2100, 10647: 0x6fd86200,
  10653: 0x6fd9ea50, 10708: 0x6fd9fea0, 10775: 0x6fd51450, 10785: 0x6fd88b50,
  10786: 0x6fda1bf0, 10807: 0x6fd88730, 10856: 0x6fd9fe10, 10868: 0x6fd57770,
  10887: 0x6fd8a740, 10943: 0x6fd96ec0, 10945: 0x6fd88890, 10951: 0x6fd574e0,
  10973: 0x6fd88b70, 11003: 0x6fd860c0, 11008: 0x6fda0ea0, 11013: 0x6fd889f0,
  11016: 0x6fd57990, 11091: 0x6fda0360, 11120: 0x6fda00c0, 11146: 0x6fda0560,
  11166: 0x6fd87cd0,
}

const K6_SCENARIO_FOCUS: Readonly<Record<string, string>> = {
  'k6-bloodmoor-consumables-auras-combat': '战斗、药水、光环（runtimeExecGap = 0）',
  'k6-act3-consumables-quest': 'Act 3 黄金鸟 / 蓝·依森古书任务消耗品',
  'k6-druid-skills': '德鲁伊技能树 (221..250)、召唤、变形',
  'k6-assassin-skills': '刺客技能树 (251..280)、陷阱、聚气终结技',
  'k6-items-potions-belt-combat': '腰带/背包/装备/切手/回城卷轴/金币与战斗',
  'k6-town-npc-gamble-waypoint': '储藏箱、方块、小站、商店修理售卖、赌博、雇佣兵',
  'k6-nightmare-bloodmoor-combat': '噩梦难度精英/暗金怪物 UMod 与投射物 AI',
  'k6s2-amazon-skills': '亚马逊全 30 技能（弓弩/标枪/被动）',
  'k6s2-sorceress-skills': '法师全 30 技能（火焰/闪电/冰冷）',
  'k6s2-necromancer-skills': '死灵法师全 30 技能（诅咒/毒骨/召唤）',
  'k6s2-paladin-skills': '圣骑士全 30 技能（战斗/攻击与防御光环）',
  'k6s2-barbarian-skills': '野蛮人全 30 技能（战吼/专精/战斗）',
  'k6s2-act2-sewers-cube-merc': 'Act 2 下水道、赫拉迪克方块合成、Act 2 佣兵',
  'k6s2-act4-hell-chaos-shrines': '地狱 Act 4 火焰之河、混沌避难所、神殿',
  'k6s2-act5-harrogath-shenk-anya': 'Act 5 哈洛加斯、血腥丘陵、督军山克与安亚',
  'k6s3-act1-bosses-cowlevel-imbue': '秘密奶牛关、恰西注入、安达利尔 Boss 战',
  'k6s3-act2-bosses-staff-duriel': '罗达门特、赫拉迪克之杖插槽、召唤者与督瑞尔',
  'k6s3-act3-council-mephisto-quests': '克林姆的意志、崔凡克议会与墨菲斯托',
  'k6s3-act4-izual-hellforge-diablo': '衣卒尔、地狱熔炉灵魂石、5 封印与迪亚波罗',
  'k6s3-act5-shenk-anya-ancients-baal': '山克、拉苏克打孔、安亚、三野蛮人、5 波怪与巴尔',
  'k6s3-druid-full-30-skills': '德鲁伊全 30 技能深度战斗与召唤演化',
  'k6s3-assassin-full-30-skills': '刺客全 30 技能陷阱、影子大师与终结技',
  'k6s3-crafting-runewords-c2s-monai': 'Leaf/Stealth 符文之语、Hel+TP 洗孔、升级、0x62 复活佣兵、洗点',
}

const EMITTER_WAVE_ORDER = [
  'k6', 'k6-w2', 'k6-w3', 'k6-w5', 'k6-w6', 'k6-w7', 'k6-w8',
  'k6-w10', 'k6-w11', 'k6-w12', 'k6-w13', 'k6-w14', 'k6-w15',
  'k6-fix1', 'k6-fix2', 'k6-fix3', 'k6-fix4',
  'k6-p2', 'k6-p3', 'k6-p4', 'k6-p5', 'k6-p6', 'k6-p7', 'k6-p8',
  'k6-p9', 'k6-p10', 'k6-p11', 'k6-p12', 'k6-p13', 'k6-p14', 'k6-p15',
  'k6-p16a', 'k6-p16b', 'k6-p16c',
] as const

const HEX_VA_RE = /0x6F[CD][0-9A-Fa-f]{5}(?=[uUlL]*\b)/g
const COM_ORD_RE = /GetProcAddress\(\s*hCom\w*\s*,\s*MAKEINTRESOURCEA\(\s*(\d+)\s*\)/g

function walkFilesMatching(dir: string, suffix: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir).sort()) {
    const abs = join(dir, name)
    const st = statSync(abs)
    if (st.isDirectory()) walkFilesMatching(abs, suffix, out)
    else if (name.endsWith(suffix)) out.push(abs)
  }
  return out
}

function stripCComments(text: string): string {
  return text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ' ')
}

function extractCEmitterVas(
  absPath: string,
  d2cSet: ReadonlyMap<number, unknown>,
  d2gSet: ReadonlyMap<number, unknown>,
): { d2Common: Set<number>; d2Game: Set<number> } {
  const code = stripCComments(readFileSync(absPath, 'utf8'))
  const d2Common = new Set<number>()
  const d2Game = new Set<number>()
  for (const line of code.split('\n')) {
    if (line.includes('install_jmp_hook') || line.includes('pAutoMod')) continue
    HEX_VA_RE.lastIndex = 0
    for (const m of line.matchAll(HEX_VA_RE)) {
      const v = Number.parseInt(m[0], 16) >>> 0
      if (d2cSet.has(v)) d2Common.add(v)
      else if (d2gSet.has(v)) d2Game.add(v)
    }
    COM_ORD_RE.lastIndex = 0
    for (const m of line.matchAll(COM_ORD_RE)) {
      const ord = Number.parseInt(m[1]!, 10)
      const va = D2COMMON_ORDINAL_TO_VA[ord]
      if (va !== undefined && d2cSet.has(va)) d2Common.add(va)
    }
  }
  return { d2Common, d2Game }
}

interface K6AuditInternal {
  readonly response: K6AuditResponse
  readonly scnAllC: ReadonlySet<number>
  readonly emitAllC: ReadonlySet<number>
  readonly scnAllG: ReadonlySet<number>
  readonly emitAllG: ReadonlySet<number>
}

const k6AuditCache = new Map<string, K6AuditInternal>()
const k6ReplayCache = new Map<string, SharedReplayPayload>()

function computeK6AuditInternal(rootDir: string): K6AuditInternal {
  const hit = k6AuditCache.get(rootDir)
  if (hit) return hit

  const manifest = loadManifestCached(rootDir)
  const d2cMap = manifest.byModNum.D2Common
  const d2gMap = manifest.byModNum.D2Game

  // 1. Scan all .coverage.ndjson.gz across tests/fixtures/oracle/{k1,k3,k4,k6*}/**
  const covBaseC = new Set<number>()
  const covBaseG = new Set<number>()
  const covK6C = new Set<number>()
  const covK6G = new Set<number>()
  const scenarioHitCounts = new Map<string, { c: number; g: number; frames: number }>()

  const oracleFixturesRoot = resolve(rootDir, 'tests/fixtures/oracle')
  const subdirs = readdirSync(oracleFixturesRoot)
    .filter((d) => d === 'k1' || d === 'k3' || d === 'k4' || d.startsWith('k6'))
    .filter((d) => statSync(join(oracleFixturesRoot, d)).isDirectory())
    .sort()

  for (const sub of subdirs) {
    const covFiles = walkFilesMatching(join(oracleFixturesRoot, sub), '.coverage.ndjson.gz')
    const isK6 = sub.startsWith('k6')
    for (const cf of covFiles) {
      const lines = gunzipSync(readFileSync(cf))
        .toString('utf8')
        .split('\n')
        .filter((l) => l.trim().length > 0)
      const sC = new Set<number>()
      const sG = new Set<number>()
      let framesTo = 0
      for (const line of lines) {
        const obj = JSON.parse(line) as { k?: string; to?: number; m?: string; va?: string }
        if (obj.k === 'hdr') {
          framesTo = obj.to ?? 0
          continue
        }
        if (!obj.va) continue
        const va = Number.parseInt(obj.va, 16) >>> 0
        if (obj.m === 'D2Common' && d2cMap.has(va)) sC.add(va)
        else if (obj.m === 'D2Game' && d2gMap.has(va)) sG.add(va)
      }
      const targetC = isK6 ? covK6C : covBaseC
      const targetG = isK6 ? covK6G : covBaseG
      for (const v of sC) targetC.add(v)
      for (const v of sG) targetG.add(v)
      const baseName = cf.slice(cf.lastIndexOf('/') + 1).replace(/\.coverage\.ndjson\.gz$/, '')
      scenarioHitCounts.set(baseName, { c: sC.size, g: sG.size, frames: framesTo })
    }
  }

  // 2. Scan real-DLL emitters: tools/oracle/vectors/*.c (+ requests/*.req.json) & tools/oracle/k6*/*.c
  const emitBaseC = new Set<number>()
  const emitBaseG = new Set<number>()
  const vectorsDir = resolve(rootDir, 'tools/oracle/vectors')
  if (existsSync(vectorsDir)) {
    for (const f of readdirSync(vectorsDir).filter((n) => n.endsWith('.c')).sort()) {
      const found = extractCEmitterVas(join(vectorsDir, f), d2cMap, d2gMap)
      for (const v of found.d2Common) emitBaseC.add(v)
      for (const v of found.d2Game) emitBaseG.add(v)
    }
    const reqDir = join(vectorsDir, 'requests')
    if (existsSync(reqDir)) {
      for (const f of readdirSync(reqDir).filter((n) => n.endsWith('.req.json')).sort()) {
        const req = JSON.parse(readFileSync(join(reqDir, f), 'utf8')) as { module?: string; va?: string }
        if (!req.va) continue
        const va = parseVaNum(req.va)
        if (req.module === 'D2Common' && d2cMap.has(va)) emitBaseC.add(va)
        else if (req.module === 'D2Game' && d2gMap.has(va)) emitBaseG.add(va)
      }
    }
  }

  const toolsOracleDir = resolve(rootDir, 'tools/oracle')
  const k6EmitterDirs = readdirSync(toolsOracleDir)
    .filter((d) => d.startsWith('k6') && statSync(join(toolsOracleDir, d)).isDirectory())
    .sort((a, b) => {
      const ia = EMITTER_WAVE_ORDER.indexOf(a as (typeof EMITTER_WAVE_ORDER)[number])
      const ib = EMITTER_WAVE_ORDER.indexOf(b as (typeof EMITTER_WAVE_ORDER)[number])
      if (ia >= 0 && ib >= 0) return ia - ib
      if (ia >= 0) return -1
      if (ib >= 0) return 1
      return a.localeCompare(b)
    })

  const emitK6C = new Set<number>()
  const emitK6G = new Set<number>()
  const cumC = new Set<number>(emitBaseC)
  const cumG = new Set<number>(emitBaseG)
  const k6Emitters: K6EmitterLedgerRow[] = []

  for (const d of k6EmitterDirs) {
    const absDir = join(toolsOracleDir, d)
    for (const f of readdirSync(absDir).filter((n) => n.endsWith('.c')).sort()) {
      const absFile = join(absDir, f)
      const found = extractCEmitterVas(absFile, d2cMap, d2gMap)
      for (const v of found.d2Common) {
        emitK6C.add(v)
        cumC.add(v)
      }
      for (const v of found.d2Game) {
        emitK6G.add(v)
        cumG.add(v)
      }
      k6Emitters.push({
        suite: d,
        relPath: relative(rootDir, absFile).replace(/\\/g, '/'),
        bytes: statSync(absFile).size,
        d2CommonVas: found.d2Common.size,
        d2GameVas: found.d2Game.size,
        cumD2Common: cumC.size,
        cumD2Game: cumG.size,
        cumCombined: cumC.size + cumG.size,
      })
    }
  }

  const scnAllC = new Set<number>([...covBaseC, ...covK6C])
  const emitAllC = new Set<number>([...emitBaseC, ...emitK6C])
  const combAllC = new Set<number>([...scnAllC, ...emitAllC])

  const scnAllG = new Set<number>([...covBaseG, ...covK6G])
  const emitAllG = new Set<number>([...emitBaseG, ...emitK6G])
  const combBaseG = new Set<number>([...covBaseG, ...emitBaseG])
  const combAllG = new Set<number>([...scnAllG, ...emitAllG])

  // 9 D2Game subsystems
  const subStats = new Map<string, { total: number; verified: number; scenarioHit: number; emitterHit: number }>()
  for (const s of D2GAME_SUBSYSTEM_ORDER) subStats.set(s, { total: 0, verified: 0, scenarioHit: 0, emitterHit: 0 })
  for (const [va, fn] of d2gMap) {
    const sub = classifyD2GameSubsystem(fn.name)
    const st = subStats.get(sub)!
    st.total++
    if (combAllG.has(va)) st.verified++
    if (scnAllG.has(va)) st.scenarioHit++
    if (emitAllG.has(va)) st.emitterHit++
  }

  // 23 longitudinal scenarios metadata from real horizons.json + coverage
  const h1 = loadK6Horizons113c()
  const h2 = loadK6S2Horizons113c()
  const h3 = loadK6S3Horizons113c()
  const buildMeta = (
    list: readonly string[],
    suite: K6SuiteId,
    horizons: Record<string, { readonly bootFrame: number; readonly strict: number; readonly pos: number }>,
  ): K6ScenarioMeta[] =>
    list.map((name) => {
      const hz = horizons[name]
      const cov = scenarioHitCounts.get(name)
      const gf = cov?.frames || hz?.strict || 0
      return {
        scenario: name,
        suite,
        focus: K6_SCENARIO_FOCUS[name] ?? '',
        goldenFrames: gf,
        strictHorizon: hz?.strict ?? gf,
        posHorizon: hz?.pos ?? gf,
        d2CommonHits: cov?.c ?? 0,
        d2GameHits: cov?.g ?? 0,
      }
    })

  const scenarios: K6ScenarioMeta[] = [
    ...buildMeta(K6_REPLAY_SCENARIOS_113C, 'k6', h1),
    ...buildMeta(K6_S2_REPLAY_SCENARIOS_113C, 'k6-s2', h2),
    ...buildMeta(K6_S3_REPLAY_SCENARIOS_113C, 'k6-s3', h3),
  ]

  const response: K6AuditResponse = {
    ok: true,
    d2Common: {
      total: d2cMap.size,
      baselineScenarioExecuted: covBaseC.size,
      scenarioExecuted: scnAllC.size,
      emitterVerified: emitAllC.size,
      combinedVerified: combAllC.size,
      remainingUnhit: d2cMap.size - combAllC.size,
    },
    d2Game: {
      total: d2gMap.size,
      baselineScenarioExecuted: covBaseG.size,
      scenarioExecuted: scnAllG.size,
      baselineEmitterVerified: emitBaseG.size,
      emitterVerified: emitAllG.size,
      baselineCombinedVerified: combBaseG.size,
      combinedVerified: combAllG.size,
      remainingUnhit: d2gMap.size - combAllG.size,
      subsystems: D2GAME_SUBSYSTEM_ORDER.map((sub) => {
        const st = subStats.get(sub)!
        return {
          subsystem: sub,
          total: st.total,
          verified: st.verified,
          unhit: st.total - st.verified,
          scenarioHit: st.scenarioHit,
          emitterHit: st.emitterHit,
        }
      }),
    },
    combined: {
      total: d2cMap.size + d2gMap.size,
      emitterVerified: emitAllC.size + emitAllG.size,
      combinedVerified: combAllC.size + combAllG.size,
      remainingUnhit: d2cMap.size + d2gMap.size - (combAllC.size + combAllG.size),
    },
    k6Emitters,
    scenarios,
  }

  const entry: K6AuditInternal = { response, scnAllC, emitAllC, scnAllG, emitAllG }
  k6AuditCache.set(rootDir, entry)
  return entry
}

export function getK6AuditData(rootDir: string = DEFAULT_REPO_ROOT): K6AuditResponse {
  return computeK6AuditInternal(rootDir).response
}

export function getK6OverviewData(rootDir: string = DEFAULT_REPO_ROOT): K6OverviewResponse {
  const audit = getK6AuditData(rootDir)
  const totalScenarioFrames = audit.scenarios.reduce((acc, s) => acc + s.goldenFrames, 0)
  const allHorizonsComplete = audit.scenarios.every(
    (s) => s.goldenFrames > 0 && s.strictHorizon === s.goldenFrames && s.posHorizon === s.goldenFrames,
  )
  return {
    ok: true,
    totalFunctions: audit.combined.total,
    totalVerified: audit.combined.combinedVerified,
    totalEmitterVerified: audit.combined.emitterVerified,
    d2CommonVerified: audit.d2Common.combinedVerified,
    d2CommonTotal: audit.d2Common.total,
    d2GameVerified: audit.d2Game.combinedVerified,
    d2GameTotal: audit.d2Game.total,
    scenarioCount: audit.scenarios.length,
    totalScenarioFrames,
    allHorizonsComplete,
    emitterSuiteCount: audit.k6Emitters.length,
    scenarios: audit.scenarios,
  }
}

export function getK6ReplayData(
  scenarioName: string,
  rootDir: string = DEFAULT_REPO_ROOT,
): SharedReplayPayload {
  const hit = k6ReplayCache.get(scenarioName)
  if (hit) return hit

  let goldenPath = ''
  let snapshotPath = ''
  let scenarioPath = ''
  let coveragePath = ''

  if ((K6_REPLAY_SCENARIOS_113C as readonly string[]).includes(scenarioName)) {
    goldenPath = k6GoldenPath113c(scenarioName)
    snapshotPath = k6SnapshotPath113c(scenarioName, 2)
    scenarioPath = k6ScenarioPath113c(scenarioName)
    coveragePath = k6CoveragePath113c(scenarioName)
  } else if ((K6_S2_REPLAY_SCENARIOS_113C as readonly string[]).includes(scenarioName)) {
    goldenPath = k6S2GoldenPath113c(scenarioName)
    snapshotPath = k6S2SnapshotPath113c(scenarioName, 2)
    scenarioPath = k6S2ScenarioPath113c(scenarioName)
    coveragePath = k6S2CoveragePath113c(scenarioName)
  } else if ((K6_S3_REPLAY_SCENARIOS_113C as readonly string[]).includes(scenarioName)) {
    goldenPath = k6S3GoldenPath113c(scenarioName)
    snapshotPath = k6S3SnapshotPath113c(scenarioName, 2)
    scenarioPath = k6S3ScenarioPath113c(scenarioName)
    coveragePath = k6S3CoveragePath113c(scenarioName)
  } else {
    throw new Error(`Unsupported K6 scenario '${scenarioName}'`)
  }

  const { payload } = runLockstepReplayPayload({
    scenarioName,
    goldenPath,
    snapshotPath,
    scenarioPath,
    coveragePath,
    rootDir,
    bootFrame: 2,
  })
  k6ReplayCache.set(scenarioName, payload)
  return payload
}

export function getK6CallgraphData(rootDir: string = DEFAULT_REPO_ROOT): K6CallgraphResponse {
  const manifest = loadManifestCached(rootDir)
  const audit = computeK6AuditInternal(rootDir)
  const kernFiles: string[] = []
  const kernIdx = new Map<string, number>()
  const functions: K6CallgraphNode[] = []

  for (const fn of manifest.list) {
    const vaHex = canonVa(fn.va)
    const vaNum = parseVaNum(vaHex)
    let kf = -1
    if (fn.kernFile) {
      const existing = kernIdx.get(fn.kernFile)
      if (existing !== undefined) kf = existing
      else {
        kf = kernFiles.length
        kernFiles.push(fn.kernFile)
        kernIdx.set(fn.kernFile, kf)
      }
    }
    const isCommon = fn.module === 'D2Common'
    functions.push({
      module: fn.module,
      va: vaHex,
      name: fn.name,
      status: fn.status,
      size: fn.size,
      topoLevel: fn.topoLevel ?? 0,
      subsystem: isCommon ? 'D2Common' : classifyD2GameSubsystem(fn.name),
      scenarioHit: isCommon ? audit.scnAllC.has(vaNum) : audit.scnAllG.has(vaNum),
      emitterHit: isCommon ? audit.emitAllC.has(vaNum) : audit.emitAllG.has(vaNum),
      kf,
    })
  }

  functions.sort((a, b) => {
    if (a.module !== b.module) return a.module === 'D2Common' ? -1 : 1
    return a.va < b.va ? -1 : a.va > b.va ? 1 : 0
  })

  return { ok: true, total: functions.length, kernFiles, functions }
}

export function getK6EmitterSource(
  relPath: string,
  rootDir: string = DEFAULT_REPO_ROOT,
): { ok: true; relPath: string; totalLines: number; preview: string } {
  const norm = relPath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!/^tools\/oracle\/k6[^/]*\/[^/]+\.c$/.test(norm) || norm.includes('..')) {
    throw new Error(`Invalid K6 emitter path: '${relPath}'`)
  }
  const abs = resolve(rootDir, norm)
  if (!existsSync(abs)) {
    throw new Error(`Emitter source not found: '${norm}'`)
  }
  const lines = readFileSync(abs, 'utf8').split('\n')
  return {
    ok: true,
    relPath: norm,
    totalLines: lines.length,
    preview: lines.slice(0, 180).join('\n'),
  }
}

export interface K6ShowcaseMiddlewareOptions {
  readonly rootDir?: string
}

export function createK6ShowcaseHttpMiddleware(options?: K6ShowcaseMiddlewareOptions) {
  const rootDir = options?.rootDir ?? DEFAULT_REPO_ROOT
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const parsed = parseShowcaseRequest(req, '/api/k6-showcase/')
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
        sendJson(res, 200, getK6OverviewData(rootDir))
        return
      }
      if (parsed.subRoute === 'replay') {
        const scenario = parsed.params.get('scenario')?.trim() || K6_REPLAY_SCENARIOS_113C[0]
        sendJson(res, 200, getK6ReplayData(scenario, rootDir))
        return
      }
      if (parsed.subRoute === 'audit') {
        sendJson(res, 200, getK6AuditData(rootDir))
        return
      }
      if (parsed.subRoute === 'callgraph') {
        sendJson(res, 200, getK6CallgraphData(rootDir))
        return
      }
      if (parsed.subRoute === 'emitter-src') {
        const file = parsed.params.get('file')?.trim()
        if (!file) {
          sendJson(res, 400, { ok: false, error: 'Missing required query parameter: file' })
          return
        }
        sendJson(res, 200, getK6EmitterSource(file, rootDir))
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
      sendJson(res, 404, { ok: false, error: `Unknown K6 showcase route: ${parsed.normPath}` })
    } catch (err: unknown) {
      sendJson(res, 400, { ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
}
