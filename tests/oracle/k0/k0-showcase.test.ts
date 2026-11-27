import { existsSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  BrowserTimerWheelSandbox,
  runFogHuffmanRoundtrip,
  stepCustomPrngRoll,
  sweepPrngVectorsInBrowser,
} from '../../../showcase/k0/k0-browser-engine.ts'
import { shouldRedirectUnknownPageToHome } from '../../../src/baker/io/server-status-probe.ts'
import {
  createK0ShowcaseHttpMiddleware,
  type K0LayoutsResponse,
  type K0OverviewResponse,
  type K0VectorsResponse,
} from '../../../tools/oracle/k0-showcase-server.ts'
import type { SharedReplayPayload } from '../../../tools/oracle/showcase-common.ts'
import viteConfig from '../../../vite.config.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')

describe('[K0] Interactive Visual Showcase Backend, Browser Sandbox & Route Wiring', () => {
  let server: Server
  let baseUrl = ''

  beforeAll(async () => {
    const mw = createK0ShowcaseHttpMiddleware({ rootDir: REPO_ROOT })
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

  it('wires /k0-showcase.html, showcase/k0/index.html, and Vite build inputs with zero external CDN links', () => {
    const showcaseHtml = resolve(REPO_ROOT, 'showcase/k0/index.html')
    const publicHtml = resolve(REPO_ROOT, 'public/k0-showcase.html')
    expect(existsSync(showcaseHtml)).toBe(true)
    expect(existsSync(publicHtml)).toBe(true)
    expect(shouldRedirectUnknownPageToHome('/k0-showcase.html', { rootDir: REPO_ROOT })).toBe(false)

    const cssText = readFileSync(resolve(REPO_ROOT, 'showcase/shared/showcase-shell.css'), 'utf8')
    expect(cssText).not.toMatch(/https?:\/\//i)
    expect(cssText).toContain('height: 100vh')
    expect(cssText).toContain('overflow-y: auto')

    const input = viteConfig.build?.rollupOptions?.input as Record<string, string>
    expect(input['showcase-k0']).toBe(showcaseHtml)
  })

  it('serves live K0 overview, 18 frozen struct layouts, and D2TV PRNG + 11-slot D2Net IAT', async () => {
    const ov = await getJson<K0OverviewResponse>('/api/k0-showcase/overview')
    expect(ov.manifest.total).toBe(4810)
    expect(ov.frozenStructsCount).toBeGreaterThanOrEqual(18)
    expect(ov.iatSlotCount).toBe(11)
    expect(ov.totalDiffRecords).toBeGreaterThanOrEqual(13_000)

    const ly = await getJson<K0LayoutsResponse>('/api/k0-showcase/layouts')
    expect(ly.structCount).toBe(ov.frozenStructsCount)
    const unit = ly.structs.find((s) => s.name === 'D2UnitStrc')
    expect(unit?.size).toBe(244)

    const vec = await getJson<K0VectorsResponse>('/api/k0-showcase/vectors?offset=0&limit=100')
    expect(vec.prng.recordCount).toBe(10_000)
    expect(vec.prng.records.length).toBe(100)
    expect(vec.d2NetIat.length).toBe(11)

    // Verify pure browser PRNG engine against real DLL vectors
    const sweep = sweepPrngVectorsInBrowser(vec.prng.records)
    expect(sweep.matched).toBe(100)
    expect(sweep.firstMismatch).toBeNull()
  })

  it('runs browser PRNG edge cases, 64-slot D2TimerStrc wheel, and Fog.#10223 Huffman roundtrip', () => {
    const neg = stepCustomPrngRoll(0x12345678, 0x29a, -1)
    expect(neg.rolled).toBe(0)
    expect(neg.nextLo).toBe(0x12345678)
    expect(neg.nextHi).toBe(0x29a)

    const wheel = new BrowserTimerWheelSandbox(786)
    wheel.schedulePersistent(1, 0, 12)
    wheel.scheduleTimed(1, 1, 788, 99)
    const f1 = wheel.stepOneFrame()
    expect(f1.some((e) => e.persistent && e.frame === 787)).toBe(true)
    const f2 = wheel.stepOneFrame()
    expect(f2.some((e) => e.persistent)).toBe(true)
    expect(f2.some((e) => !e.persistent && e.arg14 === 99)).toBe(true)

    const huf = runFogHuffmanRoundtrip('59 01 00 00 00 04 42 61 72 62 00 00 00 00 00 00 00 00 00 00 00 00 5c 15 0c 17')
    expect(huf.exactRoundtrip).toBe(true)
    expect(huf.framedLen).toBeGreaterThan(2)
  })

  it('serves live a1c-bloodmoor-fallen F786..F825 vertical slice replay with 0 strict divergences', async () => {
    const rp = await getJson<SharedReplayPayload>('/api/k0-showcase/replay')
    expect(rp.scenario).toBe('a1c-bloodmoor-fallen')
    expect(rp.windowStartFrame).toBe(786)
    expect(rp.windowEndFrame).toBe(825)
    expect(rp.frames.length).toBe(40)
    expect(rp.divergedFrames).toBe(0)
    expect(rp.firstStrictDivergence).toBeNull()
  })
})
