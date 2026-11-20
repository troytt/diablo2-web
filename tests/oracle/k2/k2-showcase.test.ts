import { existsSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  judgeSettlement,
  runCombatSettlement,
  settlementFeatures,
  sweepCombatSettlements,
} from '../../../showcase/k2/combat-browser-engine.ts'
import {
  K2_SCENARIOS,
  type K2CallgraphResponse,
  type K2CombatResponse,
  type K2FunctionDetailResponse,
  type K2GapHistoryFile,
  type K2GapResponse,
  type K2OverviewResponse,
  type K2ReplayPayload,
} from '../../../showcase/k2/types.ts'
import { shouldRedirectUnknownPageToHome } from '../../../src/baker/io/server-status-probe.ts'
import {
  K2_GAP_HISTORY_SCHEMA,
  K2_SHOWCASE_SCENARIOS,
  parseD2GameRuntimeGapVas,
  readReportMdAt,
  tallyManifestJson,
} from '../../../tools/oracle/k2-showcase-gen.ts'
import {
  K2_COMBAT_VECTOR_REL_PATH,
  K2_GAP_HISTORY_REL_PATH,
  K2_MANIFEST_REL_PATH,
  createK2ShowcaseHttpMiddleware,
  type K2CallgraphResponse as ServerCallgraphResponse,
  type K2CombatResponse as ServerCombatResponse,
  type K2FunctionDetailResponse as ServerFunctionDetailResponse,
  type K2GapResponse as ServerGapResponse,
  type K2OverviewResponse as ServerOverviewResponse,
  type K2ReplayPayload as ServerReplayPayload,
} from '../../../tools/oracle/k2-showcase-server.ts'
import viteConfig from '../../../vite.config.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')

// Compile-time guard: server payloads stay assignable to the browser-side mirror types.
type Assignable<A, B> = A extends B ? true : false
const TYPE_ALIGNMENT: readonly [
  Assignable<ServerReplayPayload, K2ReplayPayload>,
  Assignable<ServerGapResponse, K2GapResponse>,
  Assignable<ServerCallgraphResponse, K2CallgraphResponse>,
  Assignable<ServerFunctionDetailResponse, K2FunctionDetailResponse>,
  Assignable<ServerCombatResponse, K2CombatResponse>,
  Assignable<ServerOverviewResponse, K2OverviewResponse>,
] = [true, true, true, true, true, true]

interface ScenarioFixture {
  readonly frames: number
  readonly inputs: readonly unknown[]
}

function loadScenarioFixture(name: string): ScenarioFixture {
  return JSON.parse(
    readFileSync(resolve(REPO_ROOT, 'tests/fixtures/oracle/scenarios', `${name}.json`), 'utf8'),
  ) as ScenarioFixture
}

/** Independent read of the recorded DLL coverage (does not go through the showcase backend). */
function dllD2GameVas(name: string): Set<string> {
  const text = gunzipSync(
    readFileSync(resolve(REPO_ROOT, 'tests/fixtures/oracle/k1/replay', `${name}.coverage.ndjson.gz`)),
  ).toString('utf8')
  const out = new Set<string>()
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    const rec = JSON.parse(line) as { k?: string; m?: string; va?: string }
    if (rec.k === 'hdr' || rec.m !== 'D2Game' || rec.va === undefined) continue
    out.add(`D2Game:0x${(Number.parseInt(rec.va, 16) >>> 0).toString(16).toUpperCase().padStart(8, '0')}`)
  }
  return out
}

describe('[K2] Interactive Visual Showcase Backend, Browser SUNITDMG Engine & Route Wiring', () => {
  let server: Server
  let baseUrl = ''

  beforeAll(async () => {
    const mw = createK2ShowcaseHttpMiddleware({ rootDir: REPO_ROOT })
    server = createServer((req, res) => {
      mw(req, res, () => {
        res.statusCode = 404
        res.end('Not Found')
      })
    })
    server.keepAliveTimeout = 60_000
    server.headersTimeout = 65_000
    await new Promise<void>((resolveListen) => {
      server.listen(0, '127.0.0.1', () => resolveListen())
    })
    const addr = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${addr.port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolveClose) => {
      server.close(() => resolveClose())
    })
  })

  async function getJson<T>(path: string): Promise<T> {
    const resp = await fetch(`${baseUrl}${path}`)
    expect(resp.status, path).toBe(200)
    return (await resp.json()) as T
  }

  it('wires /k2-showcase.html, showcase/k2/index.html, and Vite build inputs without redirecting to /', () => {
    expect(TYPE_ALIGNMENT.every(Boolean)).toBe(true)
    const showcaseHtml = resolve(REPO_ROOT, 'showcase/k2/index.html')
    const publicHtml = resolve(REPO_ROOT, 'public/k2-showcase.html')
    expect(existsSync(showcaseHtml)).toBe(true)
    expect(existsSync(publicHtml)).toBe(true)

    const html = readFileSync(showcaseHtml, 'utf8')
    expect(html).toContain('/ui/fonts/D2Exocet.ttf')
    expect(html).toContain('/ui/fonts/D2Formal436.ttf')
    expect(html).toContain('/ui/fonts/Chi.ttf')
    expect(html).toContain('/ui-pd2/home/stone-back.png')
    expect(html).toContain('/cursor-pd2/other.png')
    expect(html).toContain('/cursor-pd2/hand.png')
    expect(html).toContain('height: 100vh')
    expect(html).toContain('overflow-y: auto')
    expect(html).toContain('/showcase/k2/main.ts')
    // Assets are bundled locally: no external CDN hotlinks.
    expect(html).not.toMatch(/https?:\/\//)
    expect(readFileSync(publicHtml, 'utf8')).not.toMatch(/https?:\/\//)

    const inputs = (viteConfig.build?.rollupOptions?.input ?? {}) as Record<string, string>
    expect(inputs['showcase-k2']).toBe(showcaseHtml)
    expect(inputs['showcase-k1']).toBe(resolve(REPO_ROOT, 'showcase/k1/index.html'))
    expect(shouldRedirectUnknownPageToHome('/k2-showcase.html', { rootDir: REPO_ROOT })).toBe(false)
    expect(K2_SCENARIOS).toEqual(K2_SHOWCASE_SCENARIOS)
  })

  it('serves /api/k2-showcase/overview with scenario and manifest totals derived from repo files', async () => {
    const data = await getJson<K2OverviewResponse>('/api/k2-showcase/overview')
    expect(data.ok).toBe(true)
    expect(data.scenarios.map((s) => s.name)).toEqual([...K2_SHOWCASE_SCENARIOS])
    let frames = 0
    for (const s of data.scenarios) {
      const fx = loadScenarioFixture(s.name)
      expect(s.frames).toBe(fx.frames)
      expect(s.inputs).toBe(fx.inputs.length)
      frames += fx.frames
    }
    expect(data.totalScenarioFrames).toBe(frames)

    const tally = tallyManifestJson(readFileSync(resolve(REPO_ROOT, K2_MANIFEST_REL_PATH), 'utf8'))
    const game = data.totals.find((t) => t.module === 'D2Game')!
    const common = data.totals.find((t) => t.module === 'D2Common')!
    expect(game.total).toBe(tally.d2GameTotal)
    expect(game.diffVerified).toBe(tally.d2GameDiffVerified)
    expect(game.ported).toBe(tally.d2GamePorted)
    expect(game.unported).toBe(tally.d2GameUnported)
    expect(game.diffVerified + game.ported + game.unported).toBe(game.total)
    expect(common.total).toBe(tally.d2CommonTotal)
    expect(common.diffVerified).toBe(tally.d2CommonDiffVerified)
  })

  it(
    'serves /api/k2-showcase/replay for all 5 K1/K2 scenarios with strict zero divergence on every frame and channel',
    async () => {
      for (const name of K2_SHOWCASE_SCENARIOS) {
        const fx = loadScenarioFixture(name)
        const data = await getJson<K2ReplayPayload>(`/api/k2-showcase/replay?scenario=${name}`)
        expect(data.scenario).toBe(name)
        expect(data.scenarioFrames).toBe(fx.frames)
        expect(data.lastGoldenFrame).toBe(fx.frames)
        expect(data.inputCount).toBe(fx.inputs.length)
        expect(data.unportedHit, name).toBeNull()
        expect(data.firstStrictDivergence, name).toBeNull()
        expect(data.strictHorizon).toBe(data.lastGoldenFrame)
        expect(data.divergedFrames).toBe(0)
        expect(data.frames.length).toBe(data.lastGoldenFrame - data.bootFrame + 1)
        expect(data.framesCompared).toBe(data.frames.length)
        expect(data.frames[0]!.frame).toBe(data.bootFrame)
        expect(data.frames[data.frames.length - 1]!.frame).toBe(data.lastGoldenFrame)
        expect(data.rooms.length).toBeGreaterThan(0)

        // Per-channel statuses agree with the per-frame strict verdict and the channel totals.
        const recorded = data.channelKeys.map(() => 0)
        const matched = data.channelKeys.map(() => 0)
        let c2s = 0
        let gsRecorded = 0
        for (const f of data.frames) {
          expect(f.ch.length).toBe(data.channelKeys.length)
          expect(f.diff).toBeNull()
          expect(f.ch.includes(2)).toBe(false)
          // The game-seed channel is only compared on frames where the golden trace recorded it.
          if (f.gsWine !== null) {
            gsRecorded++
            expect(f.gsTs).toEqual(f.gsWine)
          }
          expect(f.ts).toEqual(f.wine)
          f.ch.forEach((st, i) => {
            if (st !== 0) recorded[i]!++
            if (st === 1) matched[i]!++
          })
          c2s += f.c2s.length
        }
        data.channelTotals.forEach((c, i) => {
          expect(c.key).toBe(data.channelKeys[i])
          expect(c.recorded).toBe(recorded[i])
          expect(c.matched).toBe(matched[i])
          expect(c.matched).toBe(c.recorded)
        })
        // The player channel is recorded on every compared frame; `gs` exactly where the golden has it.
        expect(data.channelTotals.find((c) => c.key === 't0')!.recorded).toBe(data.frames.length)
        expect(data.channelTotals.find((c) => c.key === 'gs')!.recorded).toBe(gsRecorded)
        expect(c2s).toBeLessThanOrEqual(data.inputCount)
        expect(c2s).toBeGreaterThan(0)
      }

      const bad = await fetch(`${baseUrl}/api/k2-showcase/replay?scenario=not-a-scenario`)
      expect(bad.status).toBe(400)
    },
    180_000,
  )

  it(
    'serves /api/k2-showcase/gap with a live |dll_union − ts_union| measurement and the generated per-commit history',
    async () => {
      const data = await getJson<K2GapResponse>('/api/k2-showcase/gap')
      const live = data.live

      // Live measurement cross-checked against an independent read of the DLL coverage fixtures.
      const dllUnion = new Set<string>()
      let frames = 0
      for (const name of K2_SHOWCASE_SCENARIOS) {
        const dll = dllD2GameVas(name)
        for (const k of dll) dllUnion.add(k)
        const s = live.scenarios.find((x) => x.scenario === name)!
        expect(s.error).toBeNull()
        expect(s.dllExecuted).toBe(dll.size)
        expect(s.tsExecutedInDll + s.gap).toBe(s.dllExecuted)
        expect(s.zeroDivergence, name).toBe(true)
        expect(s.strictHorizon).toBe(s.lastGoldenFrame)
        frames += loadScenarioFixture(name).frames
      }
      expect(live.allZeroDivergence).toBe(true)
      expect(live.framesReplayed).toBe(frames)
      expect(data.totalScenarioFrames).toBe(frames)
      expect(live.dllUnion).toBe(dllUnion.size)
      expect(new Set(live.dllUnionVas)).toEqual(dllUnion)
      expect(live.unionGap).toBe(live.unionGapVas.length)
      expect(live.tsUnionInDll + live.unionGap).toBe(live.dllUnion)
      expect(live.tsUnionVas.length).toBe(live.tsUnionInDll)
      for (const k of live.unionGapVas) expect(dllUnion.has(k)).toBe(true)
      // The union gap can never exceed the union of the per-scenario gaps (the two definitions differ).
      expect(live.unionGap).toBeLessThanOrEqual(live.unionOfScenarioGaps)
      expect(live.unionOfScenarioGaps).toBeLessThanOrEqual(live.scenarios.reduce((n, s) => n + s.gap, 0))

      // Generated history: measured points only ever come from real replays of that commit.
      expect(data.historyError).toBeNull()
      const history = data.history!
      const onDisk = JSON.parse(readFileSync(resolve(REPO_ROOT, K2_GAP_HISTORY_REL_PATH), 'utf8')) as K2GapHistoryFile
      expect(history).toEqual(onDisk)
      expect(history.schema).toBe(K2_GAP_HISTORY_SCHEMA)
      expect(history.scenarios).toEqual([...K2_SHOWCASE_SCENARIOS])
      expect(history.definitions.unionGap).toContain('dll_union − ts_union')
      const measured = history.points.filter((p) => p.measured !== null)
      expect(measured.length).toBeGreaterThanOrEqual(10)
      for (const p of history.points) {
        expect(p.sha).toMatch(/^[0-9a-f]{40}$/)
        expect(p.shortSha).toBe(p.sha.slice(0, 8))
        if (p.measured === null) {
          expect(p.measureError).not.toBeNull()
          continue
        }
        const m = p.measured
        expect(m.unionGap).toBe(m.unionGapVas.length)
        expect(m.tsUnionInDll + m.unionGap).toBe(m.dllUnion)
        expect(m.unionGap).toBeLessThanOrEqual(m.unionOfScenarioGaps)
        expect(m.scenarios.map((s) => s.scenario)).toEqual([...K2_SHOWCASE_SCENARIOS])
      }
      // Convergence is monotonic across the measured commits (the ratchet never went back up).
      for (let i = 1; i < measured.length; i++) {
        expect(measured[i]!.measured!.unionGap).toBeLessThanOrEqual(measured[i - 1]!.measured!.unionGap)
      }
      // The live tree is at least as closed as the last measured commit of the history.
      expect(live.unionGap).toBeLessThanOrEqual(measured[measured.length - 1]!.measured!.unionGap)
    },
    180_000,
  )

  it('parses the committed gap reports with the same per-scenario counts the reports declare', () => {
    const report = readReportMdAt(REPO_ROOT, 'HEAD')
    for (const name of K2_SHOWCASE_SCENARIOS) {
      const md = readFileSync(resolve(REPO_ROOT, 'docs/oracle/k1-replay', `gap-${name}.md`), 'utf8')
      const vas = parseD2GameRuntimeGapVas(md)
      expect(vas).not.toBeNull()
      const declared = /## D2Game Runtime Execution Gap[^\n]*\((\d+)\)/.exec(md)
      expect(declared).not.toBeNull()
      expect(vas!.length).toBe(Number.parseInt(declared![1]!, 10))
      expect(new Set(vas!).size).toBe(vas!.length)
      // `git show HEAD:` and the working tree agree unless the report is being edited right now.
      if (report.perScenario[name] !== null) expect(typeof report.perScenario[name]).toBe('number')
    }
  })

  it(
    'serves /api/k2-showcase/callgraph and /fn with honest D2Game diff-verified vs ported totals',
    async () => {
      const cg = await getJson<K2CallgraphResponse>('/api/k2-showcase/callgraph')
      const tally = tallyManifestJson(readFileSync(resolve(REPO_ROOT, K2_MANIFEST_REL_PATH), 'utf8'))
      const game = cg.totals.find((t) => t.module === 'D2Game')!
      expect(cg.functions.length).toBe(tally.d2GameTotal)
      expect(game.diffVerified).toBe(tally.d2GameDiffVerified)
      expect(cg.functions.filter((f) => f.status === 'diff-verified').length).toBe(game.diffVerified)
      expect(cg.functions.filter((f) => f.status === 'ported').length).toBe(game.ported)
      // K2's bar is replay-gap closure, not full D2Game verification: the page must not claim 100%.
      expect(game.diffVerified).toBeLessThanOrEqual(game.total)
      expect(new Set(cg.functions.map((f) => f.va)).size).toBe(cg.functions.length)
      for (const f of cg.functions) {
        expect(f.va).toMatch(/^0x[0-9A-F]{8}$/)
        if (f.kf >= 0) expect(cg.kernFiles[f.kf]).toBeTypeOf('string')
      }

      // Replay overlay agrees with the live gap measurement.
      const gap = await getJson<K2GapResponse>('/api/k2-showcase/gap')
      expect(cg.replay.dllUnion).toBe(gap.live.dllUnion)
      expect(cg.replay.unionGap).toBe(gap.live.unionGap)
      expect(cg.functions.filter((f) => f.exec !== 0).length).toBe(gap.live.dllUnion)
      expect(cg.functions.filter((f) => f.exec === 2).map((f) => `D2Game:${f.va}`).sort()).toEqual([...gap.live.unionGapVas])
      expect(Object.values(cg.replayClosureByStatus).reduce((a, b) => a + b, 0)).toBe(gap.live.dllUnion)

      // Frame root GAME_UpdateGameFrame (0x6FC4E050) is replay-executed by both engines.
      const root = await getJson<K2FunctionDetailResponse>('/api/k2-showcase/fn?va=0x6FC4E050')
      expect(root.module).toBe('D2Game')
      expect(root.va).toBe('0x6FC4E050')
      expect(root.exec).toBe(1)
      expect(root.tsSymbol).toBeTypeOf('string')
      expect(root.kernFile).toMatch(/^src\/d2kern-113c\//)
      expect(root.callees.length).toBeGreaterThan(0)
      const listed = cg.functions.find((f) => f.va === root.va)!
      expect(listed.name).toBe(root.name)
      expect(listed.status).toBe(root.status)

      const missing = await fetch(`${baseUrl}/api/k2-showcase/fn?va=0x00000001`)
      expect(missing.status).toBe(400)
      const noVa = await fetch(`${baseUrl}/api/k2-showcase/fn`)
      expect(noVa.status).toBe(400)
    },
    180_000,
  )

  it(
    'serves /api/k2-showcase/combat DLL vectors and runs the canonical SUNITDMG chain through the browser engine',
    async () => {
      const data = await getJson<K2CombatResponse>('/api/k2-showcase/combat')
      expect(data.vectorPath).toBe(K2_COMBAT_VECTOR_REL_PATH)
      expect(data.dllVa).toBe('0x6FCFC0B0')
      expect(data.kernSymbol).toBe('SUNITDMG_ApplyResistancesAndAbsorb113c')
      expect(data.kernFile).toMatch(/^src\/d2kern-113c\//)
      expect(data.argNames.length).toBe(14)

      // Settlements are exactly the distinct inputs of the fixture; every sampled field is carried over.
      const lines = readFileSync(resolve(REPO_ROOT, K2_COMBAT_VECTOR_REL_PATH), 'utf8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .slice(1)
        .map((l) => JSON.parse(l) as { f: string; a: number[]; v: number[] })
      expect(data.vectorLines).toBe(lines.length)
      expect(data.settlements.length).toBe(new Set(lines.map((l) => l.a.join(','))).size)
      const byKey = new Map(data.settlements.map((s) => [s.a.join(','), s]))
      for (const l of lines) {
        const field = l.f.slice('dmg.'.length) as 'phys' | 'elem' | 'total' | 'absorb'
        expect(byKey.get(l.a.join(','))!.exp[field]).toBe(l.v[0])
      }
      // The argument decode is proven by the repo's closed-form pipe matching every DLL line.
      expect(data.decodeCheck.lines).toBe(lines.length)
      expect(data.decodeCheck.matched).toBe(lines.length)

      // Same engine module the page bundles: deterministic, exception-free, internally consistent.
      const opts = { playerBaseStats: data.playerBaseStats, channels: data.channels }
      const sweep = sweepCombatSettlements(data.settlements, opts)
      const again = sweepCombatSettlements(data.settlements, opts)
      expect(sweep.settlements).toBe(data.settlements.length)
      expect(sweep.errors).toBe(0)
      expect(sweep.fieldsSampled).toBe(lines.length)
      expect(sweep.verdicts.length).toBe(data.settlements.length)
      expect(sweep.verdicts.filter((v) => v.allMatch).length).toBe(sweep.settlementsAllMatch)
      expect(sweep.verdicts.reduce((n, v) => n + v.matched, 0)).toBe(sweep.fieldsMatched)
      expect(again.settlementsAllMatch).toBe(sweep.settlementsAllMatch)
      expect(again.fieldsMatched).toBe(sweep.fieldsMatched)
      expect(sweep.settlementsAllMatch).toBeGreaterThan(0)
      expect(sweep.fieldsMatched).toBeLessThanOrEqual(sweep.fieldsSampled)
      for (const bucket of sweep.byFeature) expect(bucket.allMatch).toBeLessThanOrEqual(bucket.total)

      // Zero incoming damage settles to zero on every output for both engines.
      const zeroIn = data.settlements.filter((s) => s.a[2] === 0 && s.a[4] === 0)
      expect(zeroIn.length).toBeGreaterThan(0)
      for (const s of zeroIn) {
        const r = runCombatSettlement(s.a, opts)
        expect(r.error).toBeNull()
        expect([r.phys, r.elem, r.total, r.absorb]).toEqual([0, 0, 0, 0])
        expect(judgeSettlement(r, s.exp).allMatch).toBe(true)
      }

      // VA trace of one settlement proves the canonical manifest-bound chain is what runs.
      const withDamage = data.settlements.find((s) => s.a[2]! > 0 && s.a[4]! > 0)!
      const traced = runCombatSettlement(withDamage.a, { ...opts, trace: true })
      expect(traced.chain).toContain('D2Game:0x6FCFC0B0')
      expect(traced.chain).toContain('D2Game:0x6FCFBD00')
      expect(traced.chain).toContain('D2Game:0x6FCFB3C0')
      expect(traced.chain).toContain('D2Game:0x6FCFA7B0')
      const untraced = runCombatSettlement(withDamage.a, opts)
      expect(untraced.chain).toEqual([])
      expect([untraced.phys, untraced.elem, untraced.total, untraced.absorb]).toEqual([
        traced.phys,
        traced.elem,
        traced.total,
        traced.absorb,
      ])
      expect(settlementFeatures([1, 2, 0x20000, 0, 0, 5, -1, -1, 0, 100, 0, -1, 0, -1])).toEqual([
        'dmg > 0x10000 (256 HP)',
        'rate54 ≠ 0',
        'DR < 0',
        'MDR < 0',
        'res ≥ 100',
        'absPct < 0',
        'pierce < 0',
        '玩家 + NM/Hell 抗性惩罚',
      ])
    },
    180_000,
  )

  it('rejects unknown routes and non-GET methods, and passes through non-showcase URLs', async () => {
    const unknown = await fetch(`${baseUrl}/api/k2-showcase/nope`)
    expect(unknown.status).toBe(404)
    const post = await fetch(`${baseUrl}/api/k2-showcase/overview`, { method: 'POST' })
    expect(post.status).toBe(405)
    const passthrough = await fetch(`${baseUrl}/api/k1-showcase/overview`)
    expect(passthrough.status).toBe(404)
    expect(await passthrough.text()).toBe('Not Found')
  })
})
