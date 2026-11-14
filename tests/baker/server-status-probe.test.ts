import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  aggregateGatewayStatusLight,
  classifyIpCountry,
  createHomeFallbackHttpMiddleware,
  createServerStatusHttpMiddleware,
  detectVisitorLocaleFromRequest,
  extractVisitorIp,
  type GatewayServiceProbeResult,
  probeGatewayStatus,
  probeTcpEndpoint,
  shouldRedirectUnknownPageToHome,
} from '../../src/baker/io/server-status-probe.ts'

describe('Gateway Server Status Probe & Sanctuary Home Portal (server-status-probe.ts + public/home.html)', () => {
  it('merges 3 reachable low-latency services on the same gateway into a GREEN light', () => {
    const services: readonly GatewayServiceProbeResult[] = [
      { id: 'bncs', name: 'BNCS 战网大厅', host: 'www.laiseek.xyz', port: 6112, online: true, rttMs: 18 },
      { id: 'mcp', name: 'MCP 角色服务器', host: 'www.laiseek.xyz', port: 6113, online: true, rttMs: 19 },
      { id: 'd2gs', name: 'D2GS 游戏世界', host: 'www.laiseek.xyz', port: 4000, online: true, rttMs: 20 },
    ]
    const agg = aggregateGatewayStatusLight(services, 150)
    expect(agg.light).toBe('green')
    expect(agg.allOnline).toBe(true)
    expect(agg.onlineCount).toBe(3)
    expect(agg.totalCount).toBe(3)
    expect(agg.maxRttMs).toBe(20)
    expect(agg.avgRttMs).toBe(19)
    expect(agg.summaryZh).toContain('三服全通')
  })

  it('merges 3 reachable services with high latency (maxRttMs >= threshold) into a YELLOW light', () => {
    const services: readonly GatewayServiceProbeResult[] = [
      { id: 'bncs', name: 'BNCS 战网大厅', host: 'www.laiseek.xyz', port: 6112, online: true, rttMs: 42 },
      { id: 'mcp', name: 'MCP 角色服务器', host: 'www.laiseek.xyz', port: 6113, online: true, rttMs: 55 },
      { id: 'd2gs', name: 'D2GS 游戏世界', host: 'www.laiseek.xyz', port: 4000, online: true, rttMs: 165 },
    ]
    const agg = aggregateGatewayStatusLight(services, 150)
    expect(agg.light).toBe('yellow')
    expect(agg.allOnline).toBe(true)
    expect(agg.maxRttMs).toBe(165)
    expect(agg.summaryZh).toContain('延迟偏高')
  })

  it('merges services into a RED light whenever ANY 1 of the 3 servers is unreachable', () => {
    const oneDown: readonly GatewayServiceProbeResult[] = [
      { id: 'bncs', name: 'BNCS 战网大厅', host: 'www.laiseek.xyz', port: 6112, online: true, rttMs: 18 },
      { id: 'mcp', name: 'MCP 角色服务器', host: 'www.laiseek.xyz', port: 6113, online: true, rttMs: 19 },
      {
        id: 'd2gs',
        name: 'D2GS 游戏世界',
        host: 'www.laiseek.xyz',
        port: 4000,
        online: false,
        rttMs: null,
        error: 'ECONNREFUSED',
      },
    ]
    const agg1 = aggregateGatewayStatusLight(oneDown, 150)
    expect(agg1.light).toBe('red')
    expect(agg1.allOnline).toBe(false)
    expect(agg1.onlineCount).toBe(2)
    expect(agg1.summaryZh).toContain('4000')

    const allDown: readonly GatewayServiceProbeResult[] = oneDown.map((s) => ({
      ...s,
      online: false,
      rttMs: null,
    }))
    const agg0 = aggregateGatewayStatusLight(allDown, 150)
    expect(agg0.light).toBe('red')
    expect(agg0.allOnline).toBe(false)
    expect(agg0.onlineCount).toBe(0)
    expect(agg0.summaryZh).toContain('网关离线')
  })

  it('probes a real local TCP socket endpoint and detects both online and unreachable ports', async () => {
    const server = createServer((socket) => {
      socket.end()
    })
    await new Promise<void>((resolveListen) => {
      server.listen(0, '127.0.0.1', () => resolveListen())
    })
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    expect(port).toBeGreaterThan(0)

    try {
      const onlineRes = await probeTcpEndpoint(
        { id: 'bncs', name: 'Local BNCS', host: '127.0.0.1', port },
        1000,
      )
      expect(onlineRes.online).toBe(true)
      expect(typeof onlineRes.rttMs).toBe('number')
      expect(onlineRes.rttMs!).toBeGreaterThanOrEqual(1)
    } finally {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()))
    }

    const offlineRes = await probeTcpEndpoint(
      { id: 'd2gs', name: 'Closed D2GS', host: '127.0.0.1', port },
      500,
    )
    expect(offlineRes.online).toBe(false)
    expect(offlineRes.rttMs).toBeNull()
  })

  it('serves GET /api/server-status via createServerStatusHttpMiddleware with merged light report', async () => {
    let callCount = 0
    const middleware = createServerStatusHttpMiddleware({
      host: 'test.sanctuary.local',
      cacheTtlMs: 60_000,
      probeFn: async (ep) => {
        callCount++
        return {
          ...ep,
          online: true,
          rttMs: 24,
        }
      },
    })

    const invoke = (method: string, url: string) =>
      new Promise<{ statusCode: number; body: string; nextCalled: boolean }>((resolveCall) => {
        const headers: Record<string, string> = {}
        const req = { method, url } as IncomingMessage
        let body = ''
        const resMock = {
          statusCode: 200,
          setHeader(k: string, v: string) {
            headers[k.toLowerCase()] = v
          },
          end(chunk?: string) {
            if (chunk) body += chunk
            resolveCall({ statusCode: resMock.statusCode, body, nextCalled: false })
          },
        }
        const res = resMock as unknown as ServerResponse

        middleware(req, res, () => {
          resolveCall({ statusCode: 200, body: '', nextCalled: true })
        })
      })

    const passThrough = await invoke('GET', '/other-route')
    expect(passThrough.nextCalled).toBe(true)

    const first = await invoke('GET', '/api/server-status')
    expect(first.statusCode).toBe(200)
    const parsed1 = JSON.parse(first.body)
    expect(parsed1.ok).toBe(true)
    expect(parsed1.host).toBe('test.sanctuary.local')
    expect(parsed1.light).toBe('green')
    expect(parsed1.services).toHaveLength(3)
    expect(callCount).toBe(3)

    // Cached response should not trigger another 3 probes
    const cached = await invoke('GET', '/api/server-status')
    expect(cached.statusCode).toBe(200)
    expect(callCount).toBe(3)

    // ?refresh=1 forces a fresh probe
    const refreshed = await invoke('GET', '/api/server-status?refresh=1')
    expect(refreshed.statusCode).toBe(200)
    expect(callCount).toBe(6)

    const badMethod = await invoke('POST', '/api/server-status')
    expect(badMethod.statusCode).toBe(405)
  })

  it('verifies root index.html streamlined layout, local gothic assets, and git-ignored public/updates.json', async () => {
    const rootDir = resolve(__dirname, '../..')
    const homeHtmlPath = resolve(rootDir, 'index.html')
    expect(existsSync(homeHtmlPath)).toBe(true)

    const html = readFileSync(homeHtmlPath, 'utf8')
    // Required 6 streamlined sections
    expect(html).toContain('id="hero-play-now"')
    expect(html).toContain('id="btn-play-now"')
    expect(html).toContain('href="/play.html"')
    expect(html).toContain('id="gateway-status-card"')
    expect(html).toContain('id="musicbox-link-card"')
    expect(html).toContain('href="/musicbox.html"')
    expect(html).toContain('id="recent-updates-panel"')
    expect(html).toContain('id="project-intro-panel"')
    expect(html).toContain('id="contact-author-panel"')
    expect(html).toContain('https://github.com/troytt/diablo2-web')
    expect(html).toContain('754468203')
    expect(html).not.toContain('contact-wechat')
    expect(html).not.toContain('contact-discord')

    // Simplified gateway status card: only traffic light (#gateway-gem) and latency (#gateway-rtt)
    expect(html).toContain('id="gateway-gem"')
    expect(html).toContain('id="gateway-rtt"')
    expect(html).not.toContain('id="btn-refresh-status"')
    expect(html).not.toContain('gateway-legend')
    expect(html).not.toContain('id="gateway-sub"')
    expect(html).not.toContain('id="gateway-checked-at"')

    // Simplified music box card: single-row link without multi-line subtitle/description
    expect(html).not.toContain('class="music-tag"')
    expect(html).not.toContain('class="music-desc"')

    // Authentic Diablo II stone buttons (.d2-stone-btn + /ui/frontend/btn-*.png) & bilingual zh/en + play.html?lang=
    expect(html).toContain('d2-stone-btn')
    expect(html).toContain('/ui/frontend/btn-wide.png')
    expect(html).toContain('/ui/frontend/btn-medium.png')
    expect(html).toContain('/ui/frontend/btn-popup-small.png')
    expect(html).toContain('id="btn-lang-toggle"')
    expect(html).toContain('PLAY NOW')
    expect(html).toContain('SERVER STATUS')
    expect(html).toContain('MUSIC BOX')
    expect(html).toContain('d2web.settings.v1')
    expect(html).toContain('/play.html?lang=')

    // Streamlining constraints: no launch parameter inputs/selects and no drop/kill stats on index.html
    expect(html).not.toContain('<select')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('/drops.html')
    expect(html).not.toContain('/filter.html')
    expect(html).not.toContain('kill-stats')

    // Local gothic UI assets exist in public/ui-pd2/home/
    for (const assetName of [
      'd2-hero-banner.jpg',
      'd2-musicbox-crest.jpg',
      'stone-back.png',
      'ribbon-horizontal.png',
      'border-corner-top-left.png',
      'horadricback.png',
    ]) {
      expect(existsSync(resolve(rootDir, 'public/ui-pd2/home', assetName)), assetName).toBe(true)
    }

    // .gitignore excludes public/updates.json
    const gitignore = readFileSync(resolve(rootDir, '.gitignore'), 'utf8')
    expect(gitignore).toContain('public/updates.json')

    // Direct probeGatewayStatus call with custom probeFn
    const report = await probeGatewayStatus({
      host: 'www.laiseek.xyz',
      probeFn: async (ep) => ({ ...ep, online: true, rttMs: 15 }),
    })
    expect(report.light).toBe('green')
  })

  it('redirects non-existent page routes (/some-not-exist-page, /unknown.html, /home.html) to / via 302 Found while preserving valid pages and 404 static assets', async () => {
    const rootDir = resolve(__dirname, '../..')

    // Unknown page routes -> redirect to /
    expect(shouldRedirectUnknownPageToHome('/some-not-exist-page', { rootDir })).toBe(true)
    expect(shouldRedirectUnknownPageToHome('/some-not-exist-page?foo=1', { rootDir })).toBe(true)
    expect(shouldRedirectUnknownPageToHome('/nested/unknown/route', { rootDir })).toBe(true)
    expect(shouldRedirectUnknownPageToHome('/not-exist.html', { rootDir })).toBe(true)
    expect(shouldRedirectUnknownPageToHome('/home.html', { rootDir })).toBe(true)
    expect(shouldRedirectUnknownPageToHome('/acts.html', { rootDir })).toBe(true)

    // Valid pages, virtual routes, existing files, and non-HTML static assets -> do NOT redirect
    expect(shouldRedirectUnknownPageToHome('/', { rootDir })).toBe(false)
    expect(shouldRedirectUnknownPageToHome('/index.html', { rootDir })).toBe(false)
    expect(shouldRedirectUnknownPageToHome('/play.html', { rootDir })).toBe(false)
    expect(shouldRedirectUnknownPageToHome('/musicbox.html', { rootDir })).toBe(false)
    expect(shouldRedirectUnknownPageToHome('/drops.html', { rootDir })).toBe(false)
    expect(shouldRedirectUnknownPageToHome('/plugins/kill-stats/index.html', { rootDir })).toBe(false)
    expect(shouldRedirectUnknownPageToHome('/api/server-status', { rootDir })).toBe(false)
    expect(shouldRedirectUnknownPageToHome('/d2net/bnet', { rootDir })).toBe(false)
    expect(shouldRedirectUnknownPageToHome('/sw.js', { rootDir })).toBe(false)
    expect(shouldRedirectUnknownPageToHome('/asset-manifest.json', { rootDir })).toBe(false)
    expect(shouldRedirectUnknownPageToHome('/ui/missing-sprite.png', { rootDir })).toBe(false)

    // Verify HTTP 302 Location: / from createHomeFallbackHttpMiddleware
    const middleware = createHomeFallbackHttpMiddleware({ rootDir })
    const invoke = (method: string, url: string) =>
      new Promise<{ statusCode: number; location: string | undefined; nextCalled: boolean }>((resolveCall) => {
        const headers: Record<string, string> = {}
        const req = { method, url } as IncomingMessage
        const resMock = {
          statusCode: 200,
          setHeader(k: string, v: string) {
            headers[k.toLowerCase()] = v
          },
          end() {
            resolveCall({
              statusCode: resMock.statusCode,
              location: headers['location'],
              nextCalled: false,
            })
          },
        }
        middleware(req, resMock as unknown as ServerResponse, () => {
          resolveCall({ statusCode: 200, location: undefined, nextCalled: true })
        })
      })

    const redir = await invoke('GET', '/some-not-exist-page')
    expect(redir.statusCode).toBe(302)
    expect(redir.location).toBe('/')
    expect(redir.nextCalled).toBe(false)

    const validPlay = await invoke('GET', '/play.html')
    expect(validPlay.nextCalled).toBe(true)
  })

  it('detects visitor language (zh vs en) based on visitor IP address and GeoIP headers', () => {
    // 1. Direct IP classification
    expect(classifyIpCountry('127.0.0.1')).toBe('LOCAL')
    expect(classifyIpCountry('::1')).toBe('LOCAL')
    expect(classifyIpCountry('192.168.1.10')).toBe('LOCAL')
    expect(classifyIpCountry('10.0.0.5')).toBe('LOCAL')

    // Chinese public IPv4 (Alibaba DNS 223.5.5.5, Telecom 114.114.114.114, 180.76.76.76)
    expect(classifyIpCountry('223.5.5.5')).toBe('CN')
    expect(classifyIpCountry('114.114.114.114')).toBe('CN')
    expect(classifyIpCountry('180.76.76.76')).toBe('CN')
    expect(classifyIpCountry('240e:3b7:3272::1')).toBe('CN')

    // International public IPv4 (Public DNS 8.8.8.8, Cloudflare 1.1.1.1, AWS US 52.4.12.1)
    expect(classifyIpCountry('8.8.8.8')).toBe('INTL')
    expect(classifyIpCountry('1.1.1.1')).toBe('INTL')
    expect(classifyIpCountry('52.4.12.1')).toBe('INTL')

    // 2. Request-level visitor IP & language resolution
    const cnReq = {
      url: '/api/server-status',
      headers: { 'x-forwarded-for': '223.5.5.5, 10.0.0.1' },
    } as unknown as IncomingMessage
    expect(extractVisitorIp(cnReq)).toBe('223.5.5.5')
    expect(detectVisitorLocaleFromRequest(cnReq)).toEqual({
      visitorIp: '223.5.5.5',
      visitorCountry: 'CN',
      visitorLang: 'zh',
    })

    const usReq = {
      url: '/api/server-status',
      headers: { 'x-forwarded-for': '8.8.8.8' },
    } as unknown as IncomingMessage
    expect(extractVisitorIp(usReq)).toBe('8.8.8.8')
    expect(detectVisitorLocaleFromRequest(usReq)).toEqual({
      visitorIp: '8.8.8.8',
      visitorCountry: 'INTL',
      visitorLang: 'en',
    })

    const cfCountryReq = {
      url: '/api/server-status',
      headers: { 'cf-ipcountry': 'DE', 'x-real-ip': '::ffff:85.214.132.117' },
    } as unknown as IncomingMessage
    expect(detectVisitorLocaleFromRequest(cfCountryReq)).toEqual({
      visitorIp: '85.214.132.117',
      visitorCountry: 'DE',
      visitorLang: 'en',
    })

    const queryIpReq = {
      url: '/api/server-status?ip=8.8.8.8',
      headers: { 'cf-ipcountry': 'CN' },
    } as unknown as IncomingMessage
    expect(detectVisitorLocaleFromRequest(queryIpReq)).toEqual({
      visitorIp: '8.8.8.8',
      visitorCountry: 'INTL',
      visitorLang: 'en',
    })
  })
})
