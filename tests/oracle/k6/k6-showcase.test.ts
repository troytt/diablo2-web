import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { shouldRedirectUnknownPageToHome } from '../../../src/baker/io/server-status-probe.ts'
import {
  createK6ShowcaseHttpMiddleware,
  type K6AuditResponse,
  type K6CallgraphResponse,
  type K6OverviewResponse,
} from '../../../tools/oracle/k6-showcase-server.ts'
import type { SharedFnDetailResponse, SharedReplayPayload } from '../../../tools/oracle/showcase-common.ts'
import viteConfig from '../../../vite.config.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')

describe('[K6] Interactive Visual Showcase Backend & Route Wiring', () => {
  let server: Server
  let baseUrl = ''

  beforeAll(async () => {
    const mw = createK6ShowcaseHttpMiddleware({ rootDir: REPO_ROOT })
    server = createServer((req, res) => {
      mw(req, res, () => {
        res.statusCode = 404
        res.end('Not Found')
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()))
  })

  async function getJson<T>(path: string): Promise<T> {
    const resp = await fetch(`${baseUrl}${path}`)
    expect(resp.status, path).toBe(200)
    return (await resp.json()) as T
  }

  it('wires /k6-showcase.html and Vite build input without redirecting to /', () => {
    const showcaseHtml = resolve(REPO_ROOT, 'showcase/k6/index.html')
    const publicHtml = resolve(REPO_ROOT, 'public/k6-showcase.html')
    expect(existsSync(showcaseHtml)).toBe(true)
    expect(existsSync(publicHtml)).toBe(true)
    expect(shouldRedirectUnknownPageToHome('/k6-showcase.html', { rootDir: REPO_ROOT })).toBe(false)
    const input = viteConfig.build?.rollupOptions?.input as Record<string, string>
    expect(input['showcase-k6']).toBe(showcaseHtml)
  })

  type Mod = 'D2Common' | 'D2Game'
  const MODS: readonly Mod[] = ['D2Common', 'D2Game']

  /**
   * Raise-only floors for REAL scenario execution: distinct manifest VAs with an INT3 entry hit in the
   * committed real-DLL `*.coverage.ndjson.gz` recordings. Raise them when new golden scenarios land;
   * never lower them. They are a regression ratchet, not a completion claim (see issue #2028).
   * There is deliberately no floor/literal for the emitter-referenced count: that number is a
   * source-text property of the emitter C files and moves when those files are refactored.
   */
  const SCENARIO_EXECUTED_FLOOR: Readonly<Record<Mod, number>> = { D2Common: 1303, D2Game: 2114 }

  /** Manifest inventory + scenario-executed sets re-derived here, without the showcase server. */
  function deriveFromFixtures(): { inventory: Record<Mod, Set<number>>; scenario: Record<Mod, Set<number>> } {
    const manifest = JSON.parse(
      readFileSync(resolve(REPO_ROOT, 'tools/oracle/callgraph/manifest-113c.json'), 'utf8'),
    ) as { functions: { module: string; va: string }[] }
    const inventory: Record<Mod, Set<number>> = { D2Common: new Set(), D2Game: new Set() }
    for (const f of manifest.functions) {
      if (f.module !== 'D2Common' && f.module !== 'D2Game') throw new Error(`unexpected manifest module ${f.module}`)
      inventory[f.module].add(Number.parseInt(f.va, 16) >>> 0)
    }
    const scenario: Record<Mod, Set<number>> = { D2Common: new Set(), D2Game: new Set() }
    let coverageFiles = 0
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const abs = join(dir, name)
        if (statSync(abs).isDirectory()) walk(abs)
        else if (name.endsWith('.coverage.ndjson.gz')) {
          coverageFiles++
          for (const line of gunzipSync(readFileSync(abs)).toString('utf8').split('\n')) {
            if (!line.trim()) continue
            const o = JSON.parse(line) as { k?: string; m?: string; va?: string }
            if (o.k === 'hdr' || o.va === undefined) continue
            if (o.m !== 'D2Common' && o.m !== 'D2Game') continue
            const va = Number.parseInt(o.va, 16) >>> 0
            if (inventory[o.m].has(va)) scenario[o.m].add(va)
          }
        }
      }
    }
    const root = resolve(REPO_ROOT, 'tests/fixtures/oracle')
    for (const sub of readdirSync(root)) {
      if (sub === 'k1' || sub === 'k3' || sub === 'k4' || sub.startsWith('k6')) walk(join(root, sub))
    }
    expect(coverageFiles).toBeGreaterThanOrEqual(23)
    return { inventory, scenario }
  }

  it('reports scenario-executed, emitter-referenced and union counts separately, each derived from data', async () => {
    const truth = deriveFromFixtures()
    const ov = await getJson<K6OverviewResponse>('/api/k6-showcase/overview')
    const audit = await getJson<K6AuditResponse>('/api/k6-showcase/audit')
    const cg = await getJson<K6CallgraphResponse>('/api/k6-showcase/callgraph')
    const agg = { D2Common: audit.d2Common, D2Game: audit.d2Game } as const

    // (1) Denominators are the manifest inventory, and /callgraph lists exactly that inventory.
    expect(ov.totalFunctions).toBe(truth.inventory.D2Common.size + truth.inventory.D2Game.size)
    expect(audit.combined.total).toBe(ov.totalFunctions)
    expect(cg.total).toBe(ov.totalFunctions)
    expect(cg.functions.length).toBe(cg.total)
    for (const mod of MODS) {
      expect(agg[mod].total, `${mod} total`).toBe(truth.inventory[mod].size)
      const listed = new Set(cg.functions.filter((f) => f.module === mod).map((f) => Number.parseInt(f.va, 16) >>> 0))
      expect(listed.size, `${mod} callgraph VAs are distinct`).toBe(truth.inventory[mod].size)
      for (const va of listed) expect(truth.inventory[mod].has(va), `${mod} 0x${va.toString(16)}`).toBe(true)
    }

    // (2) Scenario-executed = real-DLL INT3 hits, re-derived above from the fixtures: same count,
    //     same per-function set, and never below the ratchet.
    for (const mod of MODS) {
      const expected = truth.scenario[mod]
      expect(agg[mod].scenarioExecuted, `${mod} scenarioExecuted`).toBe(expected.size)
      expect(expected.size, `${mod} scenario-executed floor`).toBeGreaterThanOrEqual(SCENARIO_EXECUTED_FLOOR[mod])
      const flagged = cg.functions.filter((f) => f.module === mod && f.scenarioHit)
      expect(flagged.length, `${mod} scenarioHit flags`).toBe(expected.size)
      for (const f of flagged) expect(expected.has(Number.parseInt(f.va, 16) >>> 0), `${mod} ${f.va}`).toBe(true)
    }

    // (3) Emitter-referenced and union counts equal the per-function flags they summarise; the
    //     union is |scenarioHit OR emitterHit| and the remainder is total - union (0 is not assumed).
    for (const mod of MODS) {
      const fns = cg.functions.filter((f) => f.module === mod)
      expect(fns.filter((f) => f.emitterHit).length, `${mod} emitterHit flags`).toBe(agg[mod].emitterVerified)
      const union = fns.filter((f) => f.scenarioHit || f.emitterHit).length
      expect(agg[mod].combinedVerified, `${mod} union`).toBe(union)
      expect(agg[mod].remainingUnhit, `${mod} remaining`).toBe(agg[mod].total - union)
      expect(agg[mod].scenarioExecuted).toBeLessThanOrEqual(union)
      expect(agg[mod].emitterVerified).toBeLessThanOrEqual(union)
    }
    expect(audit.combined.emitterVerified).toBe(audit.d2Common.emitterVerified + audit.d2Game.emitterVerified)
    expect(audit.combined.combinedVerified).toBe(audit.d2Common.combinedVerified + audit.d2Game.combinedVerified)
    expect(audit.combined.remainingUnhit).toBe(audit.combined.total - audit.combined.combinedVerified)
    expect(ov.totalEmitterVerified).toBe(audit.combined.emitterVerified)
    expect(ov.totalVerified).toBe(audit.combined.combinedVerified)
    expect(ov.d2CommonVerified).toBe(audit.d2Common.combinedVerified)
    expect(ov.d2GameVerified).toBe(audit.d2Game.combinedVerified)
    // The cumulative emitter ledger ends at the emitter-referenced totals (not at the inventory size).
    const lastLedgerRow = audit.k6Emitters[audit.k6Emitters.length - 1]!
    expect(lastLedgerRow.cumD2Common).toBe(audit.d2Common.emitterVerified)
    expect(lastLedgerRow.cumD2Game).toBe(audit.d2Game.emitterVerified)
    expect(lastLedgerRow.cumCombined).toBe(audit.combined.emitterVerified)

    // (4) The 9 subsystem rows partition D2Game and carry the scenario / emitter split.
    expect(audit.d2Game.subsystems.length).toBe(9)
    const sum = (k: 'total' | 'verified' | 'unhit' | 'scenarioHit' | 'emitterHit'): number =>
      audit.d2Game.subsystems.reduce((a, s) => a + s[k], 0)
    expect(sum('total')).toBe(audit.d2Game.total)
    expect(sum('scenarioHit')).toBe(audit.d2Game.scenarioExecuted)
    expect(sum('emitterHit')).toBe(audit.d2Game.emitterVerified)
    expect(sum('verified')).toBe(audit.d2Game.combinedVerified)
    expect(sum('unhit')).toBe(audit.d2Game.remainingUnhit)
    for (const s of audit.d2Game.subsystems) {
      const fns = cg.functions.filter((f) => f.module === 'D2Game' && f.subsystem === s.subsystem)
      expect(fns.length, s.subsystem).toBe(s.total)
      expect(fns.filter((f) => f.scenarioHit).length, s.subsystem).toBe(s.scenarioHit)
      expect(fns.filter((f) => f.emitterHit).length, s.subsystem).toBe(s.emitterHit)
      expect(fns.filter((f) => f.scenarioHit || f.emitterHit).length, s.subsystem).toBe(s.verified)
      expect(s.unhit, s.subsystem).toBe(s.total - s.verified)
    }

    // (5) The separately implemented Python audit reports the same four numbers per module.
    const py = spawnSync('python3', ['-B', 'tools/oracle/k6/audit-dll-coverage.py', '--json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    expect(py.status, py.stderr).toBe(0)
    const ref = JSON.parse(py.stdout) as Record<
      'd2Common' | 'd2Game',
      { total: number; scenarioExecuted: number; emitterVerified: number; combinedVerified: number; remainingUnhit: number }
    >
    for (const k of ['d2Common', 'd2Game'] as const) {
      expect(audit[k].total, k).toBe(ref[k].total)
      expect(audit[k].scenarioExecuted, k).toBe(ref[k].scenarioExecuted)
      expect(audit[k].emitterVerified, k).toBe(ref[k].emitterVerified)
      expect(audit[k].combinedVerified, k).toBe(ref[k].combinedVerified)
      expect(audit[k].remainingUnhit, k).toBe(ref[k].remainingUnhit)
    }
  })

  it('serves 23 scenarios over 31,453 golden frames, 34 emitter suites, emitter source and fn detail', async () => {
    const ov = await getJson<K6OverviewResponse>('/api/k6-showcase/overview')
    expect(ov.scenarioCount).toBe(23)
    expect(ov.totalScenarioFrames).toBe(31_453)
    expect(ov.allHorizonsComplete).toBe(true)
    expect(ov.emitterSuiteCount).toBe(34)

    const audit = await getJson<K6AuditResponse>('/api/k6-showcase/audit')
    const src = await getJson<{ ok: true; totalLines: number; preview: string }>(
      `/api/k6-showcase/emitter-src?file=${encodeURIComponent(audit.k6Emitters[0]!.relPath)}`,
    )
    expect(src.totalLines).toBeGreaterThan(20)

    const fn = await getJson<SharedFnDetailResponse>('/api/k6-showcase/fn?module=D2Game&va=0x6FC4E050')
    expect(fn.va).toBe('0x6FC4E050')
  })

  it('serves live K6 replay with 0 strict divergences and 0 runtimeExecGap', async () => {
    const rp = await getJson<SharedReplayPayload>(
      '/api/k6-showcase/replay?scenario=k6-bloodmoor-consumables-auras-combat',
    )
    expect(rp.divergedFrames).toBe(0)
    expect(rp.strictHorizon).toBe(380)
    expect(rp.runtimeExec?.d2CommonGap).toBe(0)
    expect(rp.runtimeExec?.d2GameGap).toBe(0)
  })
})
