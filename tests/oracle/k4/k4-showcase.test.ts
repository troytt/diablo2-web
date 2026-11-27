import { existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { shouldRedirectUnknownPageToHome } from '../../../src/baker/io/server-status-probe.ts'
import {
  createK4ShowcaseHttpMiddleware,
  type K4CoverageResponse,
  type K4OverviewResponse,
  type K4QuestsResponse,
  type K4S2CResponse,
} from '../../../tools/oracle/k4-showcase-server.ts'
import type { SharedReplayPayload } from '../../../tools/oracle/showcase-common.ts'
import viteConfig from '../../../vite.config.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')

describe('[K4] Interactive Visual Showcase Backend & Route Wiring', () => {
  let server: Server
  let baseUrl = ''

  beforeAll(async () => {
    const mw = createK4ShowcaseHttpMiddleware({ rootDir: REPO_ROOT })
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

  it('wires /k4-showcase.html and Vite build input without redirecting to /', () => {
    const showcaseHtml = resolve(REPO_ROOT, 'showcase/k4/index.html')
    const publicHtml = resolve(REPO_ROOT, 'public/k4-showcase.html')
    expect(existsSync(showcaseHtml)).toBe(true)
    expect(existsSync(publicHtml)).toBe(true)
    expect(shouldRedirectUnknownPageToHome('/k4-showcase.html', { rootDir: REPO_ROOT })).toBe(false)
    const input = viteConfig.build?.rollupOptions?.input as Record<string, string>
    expect(input['showcase-k4']).toBe(showcaseHtml)
  })

  it('serves live K4 overview, 5-Act quest specs, S2C vectors, replay, and 0 F3+ steppedRuntimeExecGap', async () => {
    const ov = await getJson<K4OverviewResponse>('/api/k4-showcase/overview')
    expect(ov.scenarioCount).toBe(5)
    expect(ov.totalGoldenFrames).toBe(710)
    expect(ov.s2cVectorCount).toBe(1440)

    const qs = await getJson<K4QuestsResponse>('/api/k4-showcase/quests')
    expect(qs.quests.length).toBe(5)
    expect(qs.quests.every((q) => q.c2sInputs.length > 0)).toBe(true)

    const rp = await getJson<SharedReplayPayload>('/api/k4-showcase/replay?scenario=k4-act1-quest')
    expect(rp.divergedFrames).toBe(0)
    expect(rp.strictHorizon).toBe(160)

    const cov = await getJson<K4CoverageResponse>('/api/k4-showcase/coverage')
    expect(cov.allZeroDivergence).toBe(true)
    expect(cov.unionD2CommonSteppedGap).toBe(0)
    expect(cov.unionD2GameSteppedGap).toBe(0)

    const s2c = await getJson<K4S2CResponse>('/api/k4-showcase/s2c?limit=40')
    expect(s2c.totalRecords).toBe(1440)
    expect(s2c.records.length).toBe(40)
  })
})
