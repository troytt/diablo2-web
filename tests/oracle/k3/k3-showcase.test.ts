import { existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { shouldRedirectUnknownPageToHome } from '../../../src/baker/io/server-status-probe.ts'
import {
  createK3ShowcaseHttpMiddleware,
  type K3OverviewResponse,
  type K3SkillCalcResponse,
  type K3SubsystemsResponse,
} from '../../../tools/oracle/k3-showcase-server.ts'
import type { SharedFnDetailResponse, SharedReplayPayload } from '../../../tools/oracle/showcase-common.ts'
import viteConfig from '../../../vite.config.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')

describe('[K3] Interactive Visual Showcase Backend & Route Wiring', () => {
  let server: Server
  let baseUrl = ''

  beforeAll(async () => {
    const mw = createK3ShowcaseHttpMiddleware({ rootDir: REPO_ROOT })
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

  it('wires /k3-showcase.html and Vite build input without redirecting to /', () => {
    const showcaseHtml = resolve(REPO_ROOT, 'showcase/k3/index.html')
    const publicHtml = resolve(REPO_ROOT, 'public/k3-showcase.html')
    expect(existsSync(showcaseHtml)).toBe(true)
    expect(existsSync(publicHtml)).toBe(true)
    expect(shouldRedirectUnknownPageToHome('/k3-showcase.html', { rootDir: REPO_ROOT })).toBe(false)
    const input = viteConfig.build?.rollupOptions?.input as Record<string, string>
    expect(input['showcase-k3']).toBe(showcaseHtml)
  })

  it('serves live K3 overview (9 scenarios, 15,700 frames, 780+652 DLL union), 15 subsystems, fn detail & SKILLCALC vectors', async () => {
    const ov = await getJson<K3OverviewResponse>('/api/k3-showcase/overview')
    expect(ov.scenarioCount).toBe(9)
    expect(ov.totalGoldenFrames).toBe(15_700)
    expect(ov.dllUnionD2Common).toBe(780)
    expect(ov.dllUnionD2Game).toBe(652)
    expect(ov.skillCalcVectors.recordCount).toBe(12_600)

    const subs = await getJson<K3SubsystemsResponse>('/api/k3-showcase/subsystems')
    expect(subs.entries.length).toBe(15)
    expect(subs.entries.every((e) => e.status === 'diff-verified')).toBe(true)

    const fn = await getJson<SharedFnDetailResponse>('/api/k3-showcase/fn?module=D2Game&va=0x6FC3DD40')
    expect(fn.va).toBe('0x6FC3DD40')
    expect(fn.tsSource.code).toBeTruthy()

    const sc = await getJson<K3SkillCalcResponse>('/api/k3-showcase/skillcalc?class=1&limit=50')
    expect(sc.totalRecords).toBe(12_600)
    expect(sc.records.length).toBe(50)
    expect(sc.records.every((r) => r.charClass === 1)).toBe(true)
  })

  it('serves live K3 replay with 0 strict divergences and 0 runtimeExecGap', async () => {
    const rp = await getJson<SharedReplayPayload>('/api/k3-showcase/replay?scenario=p52-amazon-valkyrie')
    expect(rp.scenario).toBe('p52-amazon-valkyrie')
    expect(rp.divergedFrames).toBe(0)
    expect(rp.strictHorizon).toBe(1500)
    expect(rp.runtimeExec?.d2CommonGap).toBe(0)
    expect(rp.runtimeExec?.d2GameGap).toBe(0)
  })
})
