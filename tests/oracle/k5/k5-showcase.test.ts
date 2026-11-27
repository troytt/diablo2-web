import { existsSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  BrowserK5LoopbackSandbox,
  buildSyntheticAnnotatedPng,
  stripPngAncillaryChunksBrowser,
} from '../../../showcase/k5/k5-browser-engine.ts'
import { shouldRedirectUnknownPageToHome } from '../../../src/baker/io/server-status-probe.ts'
import {
  createK5ShowcaseHttpMiddleware,
  type K5D2tvResponse,
  type K5OverviewResponse,
  type K5SavesResponse,
  type K5ViewportsResponse,
} from '../../../tools/oracle/k5-showcase-server.ts'
import viteConfig from '../../../vite.config.ts'

const REPO_ROOT = resolve(import.meta.dirname, '../../..')

describe('[K5] Interactive Visual Showcase Backend, Browser Loopback Sandbox & Route Wiring', () => {
  let server: Server
  let baseUrl = ''

  beforeAll(async () => {
    const mw = createK5ShowcaseHttpMiddleware({ rootDir: REPO_ROOT })
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

  it('wires /k5-showcase.html and Vite build input without redirecting to /', () => {
    const showcaseHtml = resolve(REPO_ROOT, 'showcase/k5/index.html')
    const publicHtml = resolve(REPO_ROOT, 'public/k5-showcase.html')
    expect(existsSync(showcaseHtml)).toBe(true)
    expect(existsSync(publicHtml)).toBe(true)
    expect(shouldRedirectUnknownPageToHome('/k5-showcase.html', { rootDir: REPO_ROOT })).toBe(false)
    const input = viteConfig.build?.rollupOptions?.input as Record<string, string>
    expect(input['showcase-k5']).toBe(showcaseHtml)
  })

  it('serves live K5 overview, 9-suite D2TV pinned SHA-256 verification, .d2s saves, and viewport profiles', async () => {
    const ov = await getJson<K5OverviewResponse>('/api/k5-showcase/overview')
    expect(ov.d2tvSuiteCount).toBe(9)
    expect(ov.d2tvAllMatched).toBe(true)

    const d2tv = await getJson<K5D2tvResponse>('/api/k5-showcase/d2tv')
    expect(d2tv.totalArtifacts).toBe(13)
    expect(d2tv.allMatched).toBe(true)

    const saves = await getJson<K5SavesResponse>('/api/k5-showcase/saves')
    expect(saves.saveCount).toBeGreaterThanOrEqual(15)
    expect(saves.allChecksumsValid).toBe(true)

    const vps = await getJson<K5ViewportsResponse>('/api/k5-showcase/viewports')
    expect(vps.profiles.some((p) => p.id === '800x600')).toBe(true)
    expect(vps.profiles.some((p) => p.id === '1068x600')).toBe(true)
    expect(vps.profiles.some((p) => p.id === '1280x720')).toBe(true)
  })

  it('boots BrowserK5LoopbackSandbox live over Fog.#10223 ByteStream and strips PNG ancillary chunks', () => {
    const sb = new BrowserK5LoopbackSandbox({ areaId: 2, charClass: 4, charName: 'K5TestBarb' })
    const init = sb.snapshot()
    expect(init.state).toBe('ingame')
    expect(init.protocolErrors).toBe(0)
    const moved = sb.moveTo(5046, 5050, true, 30)
    expect(moved.x).toBeGreaterThan(init.x)
    expect(moved.stamina).toBeLessThan(init.stamina)
    expect(moved.protocolErrors).toBe(0)
    sb.close()

    const stripped = stripPngAncillaryChunksBrowser(buildSyntheticAnnotatedPng())
    expect(stripped.width).toBe(800)
    expect(stripped.height).toBe(600)
    expect(stripped.droppedChunks).toEqual(['tEXt', 'eXIf', 'c2pa', 'tIME'])
    expect(stripped.keptChunks).toEqual(['IHDR', 'IDAT', 'IEND'])
  })
})
