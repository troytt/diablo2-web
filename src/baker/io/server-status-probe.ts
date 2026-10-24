/**
 * Server-side Merged Gateway Status Probe (`src/baker/io/server-status-probe.ts`).
 *
 * Probes the three Diablo II realm gateway services on the same host concurrently:
 * - `bncs` (PvPGN Battle.net Chat & Auth Server, TCP 6112 / WSS `/d2net/bnet`)
 * - `mcp`  (Realm Character Server, TCP 6113 / WSS `/d2net/realm`)
 * - `d2gs` (Diablo II Game Simulation Server, TCP 4000 / WSS `/d2net/game`)
 *
 * Merges the three probe results into a single traffic-light indicator (`light`):
 * - `'green'`:  All 3 servers under the gateway are reachable and `maxRttMs < yellowThresholdMs` (default 150ms)
 * - `'yellow'`: All 3 servers under the gateway are reachable, but `maxRttMs >= yellowThresholdMs`
 * - `'red'`:    Any 1 of the 3 servers is unreachable
 *
 * Strict boundary compliance: never imports `src/client/**`, `src/server/**`, or `src/netproto/**`,
 * and never references DOM globals.
 */

import { randomBytes } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createConnection } from 'node:net'
import { resolve } from 'node:path'
import type { TLSSocket } from 'node:tls'

export type GatewayServiceId = 'bncs' | 'mcp' | 'd2gs'

export type GatewayStatusLight = 'green' | 'yellow' | 'red'

export type VisitorLang = 'zh' | 'en'

export interface VisitorLocaleInfo {
  readonly visitorIp: string
  readonly visitorCountry: string
  readonly visitorLang: VisitorLang
}

const CHINESE_SPEAKING_COUNTRIES: ReadonlySet<string> = new Set(['CN', 'HK', 'MO', 'TW', 'SG'])

/**
 * Major APNIC IPv4 allocations for China / HK / TW (`[startUint32, endUint32]`).
 * Used for zero-latency deterministic IP-to-language detection when no CDN GeoIP header is present.
 */
const CHINESE_IPV4_CIDR_RANGES: readonly (readonly [number, number])[] = [
  // 1.0.1.0 .. 1.0.63.255, 1.1.2.0 .. 1.1.63.255, 1.2.0.0 .. 1.207.255.255 (CN / TW; excludes Cloudflare 1.0.0.0/24 & 1.1.1.0/24)
  [0x01000100, 0x01003fff],
  [0x01010200, 0x01013fff],
  [0x01020000, 0x01cfffff],
  // 14.0.0.0/8 (CN / HK)
  [0x0e000000, 0x0effffff],
  // 27.0.0.0/8 (CN / TW / HK)
  [0x1b000000, 0x1bffffff],
  // 36.0.0.0/8 (CN / TW)
  [0x24000000, 0x24ffffff],
  // 39.0.0.0/8 (CN)
  [0x27000000, 0x27ffffff],
  // 42.0.0.0/8 (CN / HK / TW)
  [0x2a000000, 0x2affffff],
  // 43.224.0.0/11 (CN / HK)
  [0x2be00000, 0x2bffffff],
  // 45.112.0.0/12 (CN / HK)
  [0x2d700000, 0x2d7fffff],
  // 47.92.0.0/14 & 47.96.0.0/11 (Alibaba CN)
  [0x2f5c0000, 0x2f7fffff],
  // 49.0.0.0/8 (CN / TW / HK)
  [0x31000000, 0x31ffffff],
  // 58.0.0.0/7 (58.0.0.0..59.255.255.255 CN / HK / TW)
  [0x3a000000, 0x3bffffff],
  // 60.0.0.0/7 (60.0.0.0..61.255.255.255 CN / TW / HK)
  [0x3c000000, 0x3dffffff],
  // 101.0.0.0/8 (CN / TW / HK)
  [0x65000000, 0x65ffffff],
  // 103.0.0.0/8 (APNIC CN / HK / TW / SG)
  [0x67000000, 0x67ffffff],
  // 106.0.0.0/8 (CN)
  [0x6a000000, 0x6affffff],
  // 110.0.0.0/7 (110..111 CN / TW)
  [0x6e000000, 0x6fffffff],
  // 112.0.0.0/5 (112..119 CN / HK / TW)
  [0x70000000, 0x77ffffff],
  // 120.0.0.0/6 (120..123 CN / TW)
  [0x78000000, 0x7bffffff],
  // 124.0.0.0/7 (124..125 CN / TW)
  [0x7c000000, 0x7dffffff],
  // 139.0.0.0/8 (CN)
  [0x8b000000, 0x8bffffff],
  // 140.109.0.0 .. 140.255.255.255 (TW / CN)
  [0x8c6d0000, 0x8cffffff],
  // 144.0.0.0/8 (CN)
  [0x90000000, 0x90ffffff],
  // 150.0.0.0/8 (CN / HK)
  [0x96000000, 0x96ffffff],
  // 153.0.0.0/8 (CN)
  [0x99000000, 0x99ffffff],
  // 163.0.0.0/8 (CN / TW)
  [0xa3000000, 0xa3ffffff],
  // 171.0.0.0/8 (CN)
  [0xab000000, 0xabffffff],
  // 175.0.0.0/8 (CN / HK / TW)
  [0xaf000000, 0xafffffff],
  // 180.0.0.0/6 (180..183 CN / TW)
  [0xb4000000, 0xb7ffffff],
  // 202.0.0.0/7 (202..203 CN / HK / TW / SG)
  [0xca000000, 0xcbffffff],
  // 210.0.0.0/7 (210..211 CN / TW / HK)
  [0xd2000000, 0xd3ffffff],
  // 218.0.0.0/7 (218..219 CN / HK / TW)
  [0xda000000, 0xdbffffff],
  // 220.96.0.0 .. 223.255.255.255 (CN / HK / TW)
  [0xdc600000, 0xdfffffff],
]

function parseIpv4ToUint32(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip.trim())
  if (!m) return null
  const a = Number(m[1])
  const b = Number(m[2])
  const c = Number(m[3])
  const d = Number(m[4])
  if (a > 255 || b > 255 || c > 255 || d > 255) return null
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0
}

function normalizeClientIp(rawIp: string): string {
  let ip = rawIp.trim()
  if (ip.toLowerCase().startsWith('::ffff:')) {
    ip = ip.slice(7)
  }
  if (ip.startsWith('[') && ip.includes(']')) {
    ip = ip.slice(1, ip.indexOf(']'))
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(':'))
  }
  return ip
}

/**
 * Classifies an IP address into `'CN'` (Chinese-speaking public IP), `'LOCAL'` (loopback / RFC1918 / LAN),
 * or `'INTL'` (non-Chinese public IP).
 */
export function classifyIpCountry(rawIp: string): 'CN' | 'LOCAL' | 'INTL' {
  const ip = normalizeClientIp(rawIp)
  if (
    !ip ||
    ip === '::1' ||
    ip === 'localhost' ||
    ip.toLowerCase().startsWith('fe80:') ||
    ip.toLowerCase().startsWith('fc00:') ||
    ip.toLowerCase().startsWith('fd')
  ) {
    return 'LOCAL'
  }

  const u32 = parseIpv4ToUint32(ip)
  if (u32 === null) {
    // Non-local IPv6 public address: check 2400::/12..240e::/16 APNIC China IPv6 blocks
    const lower = ip.toLowerCase()
    if (
      lower.startsWith('2400:') ||
      lower.startsWith('2401:') ||
      lower.startsWith('2402:') ||
      lower.startsWith('2403:') ||
      lower.startsWith('2404:') ||
      lower.startsWith('2408:') ||
      lower.startsWith('2409:') ||
      lower.startsWith('240a:') ||
      lower.startsWith('240c:') ||
      lower.startsWith('240e:')
    ) {
      return 'CN'
    }
    return 'INTL'
  }

  // Loopback 127.0.0.0/8, 0.0.0.0/8, Private 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, CGNAT 100.64.0.0/10, Link-local 169.254.0.0/16
  const first = (u32 >>> 24) & 0xff
  const second = (u32 >>> 16) & 0xff
  if (
    first === 127 ||
    first === 0 ||
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254)
  ) {
    return 'LOCAL'
  }

  for (const [start, end] of CHINESE_IPV4_CIDR_RANGES) {
    if (u32 >= start && u32 <= end) {
      return 'CN'
    }
  }
  return 'INTL'
}

/**
 * Extracts the visitor's IP address from an incoming HTTP request (`?ip=` override,
 * `cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`, or `req.socket.remoteAddress`).
 */
export function extractVisitorIp(req: IncomingMessage): string {
  if (req.url) {
    const qIdx = req.url.indexOf('?')
    if (qIdx >= 0) {
      const params = new URLSearchParams(req.url.slice(qIdx + 1))
      const ipParam = params.get('ip')?.trim()
      if (ipParam) {
        return normalizeClientIp(ipParam)
      }
    }
  }

  const headers = req.headers ?? {}
  for (const hName of ['cf-connecting-ip', 'true-client-ip', 'x-real-ip', 'x-client-ip']) {
    const raw = headers[hName]
    const val = Array.isArray(raw) ? raw[0] : raw
    if (typeof val === 'string' && val.trim().length > 0) {
      return normalizeClientIp(val)
    }
  }

  const xff = headers['x-forwarded-for']
  const xffVal = Array.isArray(xff) ? xff[0] : xff
  if (typeof xffVal === 'string' && xffVal.trim().length > 0) {
    const firstIp = xffVal.split(',')[0]?.trim()
    if (firstIp) {
      return normalizeClientIp(firstIp)
    }
  }

  const remoteAddr = req.socket?.remoteAddress
  if (typeof remoteAddr === 'string' && remoteAddr.trim().length > 0) {
    return normalizeClientIp(remoteAddr)
  }

  return '127.0.0.1'
}

/**
 * Determines the visitor's preferred language (`'zh' | 'en'`) from their IP address
 * (and CDN/reverse-proxy GeoIP country headers when present).
 */
export function detectVisitorLocaleFromRequest(req: IncomingMessage): VisitorLocaleInfo {
  const visitorIp = extractVisitorIp(req)
  let hasExplicitIpParam = false

  if (req.url) {
    const qIdx = req.url.indexOf('?')
    if (qIdx >= 0) {
      const params = new URLSearchParams(req.url.slice(qIdx + 1))
      hasExplicitIpParam = Boolean(params.get('ip')?.trim())
      const langParam = params.get('lang')?.trim().toLowerCase()
      if (langParam === 'en' || langParam === 'eng' || langParam === 'english') {
        return { visitorIp, visitorCountry: 'INTL', visitorLang: 'en' }
      }
      if (langParam === 'zh' || langParam === 'chi' || langParam === 'zh-cn' || langParam === 'cn') {
        return { visitorIp, visitorCountry: 'CN', visitorLang: 'zh' }
      }
    }
  }

  if (!hasExplicitIpParam) {
    const headers = req.headers ?? {}
    for (const hName of [
      'cf-ipcountry',
      'x-vercel-ip-country',
      'x-country-code',
      'x-appengine-country',
      'x-geo-country',
    ]) {
      const raw = headers[hName]
      const val = (Array.isArray(raw) ? raw[0] : raw)?.trim().toUpperCase()
      if (val && /^[A-Z]{2}$/.test(val) && val !== 'XX' && val !== 'T1') {
        const visitorLang: VisitorLang = CHINESE_SPEAKING_COUNTRIES.has(val) ? 'zh' : 'en'
        return { visitorIp, visitorCountry: val, visitorLang }
      }
    }
  }

  const region = classifyIpCountry(visitorIp)
  if (region === 'INTL') {
    return { visitorIp, visitorCountry: 'INTL', visitorLang: 'en' }
  }
  return {
    visitorIp,
    visitorCountry: region,
    visitorLang: 'zh',
  }
}

export interface GatewayServiceEndpoint {
  readonly id: GatewayServiceId
  readonly name: string
  readonly host: string
  readonly port: number
  readonly wsPath?: string | undefined
}

export interface GatewayServiceProbeResult extends GatewayServiceEndpoint {
  readonly online: boolean
  readonly rttMs: number | null
  readonly error?: string | undefined
}

export interface GatewayStatusLightAggregate {
  readonly light: GatewayStatusLight
  readonly allOnline: boolean
  readonly onlineCount: number
  readonly totalCount: number
  readonly maxRttMs: number | null
  readonly avgRttMs: number | null
  readonly summaryZh: string
}

export interface GatewayStatusReport extends GatewayStatusLightAggregate {
  readonly ok: true
  readonly realm: string
  readonly host: string
  readonly checkedAt: string
  readonly yellowThresholdMs: number
  readonly services: readonly GatewayServiceProbeResult[]
}

export type TcpEndpointProbeFn = (
  endpoint: GatewayServiceEndpoint,
  timeoutMs: number,
) => Promise<GatewayServiceProbeResult>

export interface ServerStatusProbeOptions {
  readonly realm?: string | undefined
  readonly host?: string | undefined
  readonly bncsPort?: number | undefined
  readonly mcpPort?: number | undefined
  readonly d2gsPort?: number | undefined
  readonly timeoutMs?: number | undefined
  readonly yellowThresholdMs?: number | undefined
  readonly cacheTtlMs?: number | undefined
  readonly probeFn?: TcpEndpointProbeFn | undefined
}

const DEFAULT_REALM_NAME = 'Sanctuary Official Realm (v1.13c)'
const DEFAULT_GATEWAY_HOST = 'www.laiseek.xyz'
const DEFAULT_BNCS_PORT = 6112
const DEFAULT_MCP_PORT = 6113
const DEFAULT_D2GS_PORT = 4000
const DEFAULT_TIMEOUT_MS = 2500
const DEFAULT_YELLOW_THRESHOLD_MS = 150
const DEFAULT_CACHE_TTL_MS = 5000

/**
 * Pure aggregation function that merges the 3 gateway service probe results into a
 * single 3-color indicator lamp (`'green' | 'yellow' | 'red'`).
 */
export function aggregateGatewayStatusLight(
  services: readonly GatewayServiceProbeResult[],
  yellowThresholdMs: number = DEFAULT_YELLOW_THRESHOLD_MS,
): GatewayStatusLightAggregate {
  const totalCount = services.length
  const onlineServices = services.filter((s) => s.online)
  const onlineCount = onlineServices.length
  const allOnline = totalCount > 0 && onlineCount === totalCount

  const rtts = onlineServices
    .map((s) => s.rttMs)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0)

  const maxRttMs = rtts.length > 0 ? Math.max(...rtts) : null
  const avgRttMs =
    rtts.length > 0 ? Math.round(rtts.reduce((acc, v) => acc + v, 0) / rtts.length) : null

  const portLabel = services.map((s) => s.port).join(' / ')

  if (!allOnline) {
    const offlinePorts = services.filter((s) => !s.online).map((s) => s.port)
    const summaryZh =
      onlineCount === 0
        ? `网关离线 (${portLabel})`
        : `部分服务不通 (端口 ${offlinePorts.join(', ')} 异常)`
    return {
      light: 'red',
      allOnline: false,
      onlineCount,
      totalCount,
      maxRttMs,
      avgRttMs,
      summaryZh,
    }
  }

  if (maxRttMs !== null && maxRttMs >= yellowThresholdMs) {
    return {
      light: 'yellow',
      allOnline: true,
      onlineCount,
      totalCount,
      maxRttMs,
      avgRttMs,
      summaryZh: `三服全通 · 延迟偏高 (${portLabel})`,
    }
  }

  return {
    light: 'green',
    allOnline: true,
    onlineCount,
    totalCount,
    maxRttMs,
    avgRttMs,
    summaryZh: `三服全通 (${portLabel})`,
  }
}

/**
 * Performs a real TCP handshake probe against a single `{ host, port }` endpoint.
 */
export function probeTcpEndpoint(
  endpoint: GatewayServiceEndpoint,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<GatewayServiceProbeResult> {
  return new Promise((resolveProbe) => {
    const startMs = Date.now()
    let settled = false

    const socket = createConnection({
      host: endpoint.host,
      port: endpoint.port,
    })

    const finish = (online: boolean, rttMs: number | null, error?: string): void => {
      if (settled) return
      settled = true
      socket.removeAllListeners()
      socket.destroy()
      resolveProbe({
        ...endpoint,
        online,
        rttMs,
        ...(error ? { error } : {}),
      })
    }

    socket.setTimeout(timeoutMs)

    socket.once('connect', () => {
      const elapsed = Math.max(1, Date.now() - startMs)
      finish(true, elapsed)
    })

    socket.once('timeout', () => {
      finish(false, null, `TCP connect timeout (${timeoutMs}ms)`)
    })

    socket.once('error', (err: Error) => {
      finish(false, null, err.message || 'TCP connection error')
    })
  })
}

/**
 * Probes a gateway service through its WSS WebSocket bridge endpoint (`wss://<host><wsPath>`),
 * measuring single-roundtrip `101 Switching Protocols` upgrade latency after TLS handshake.
 */
export function probeWssBridgeEndpoint(
  endpoint: GatewayServiceEndpoint,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<GatewayServiceProbeResult> {
  const wsPath = endpoint.wsPath
  if (!wsPath) {
    return probeTcpEndpoint(endpoint, timeoutMs)
  }

  return new Promise((resolveProbe) => {
    let upgradeStartMs = Date.now()
    let settled = false

    const req = httpsRequest({
      host: endpoint.host,
      port: 443,
      path: wsPath,
      method: 'GET',
      timeout: timeoutMs,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
      },
    })

    const finish = (online: boolean, rttMs: number | null, error?: string): void => {
      if (settled) return
      settled = true
      req.removeAllListeners()
      req.destroy()
      resolveProbe({
        ...endpoint,
        online,
        rttMs,
        ...(error ? { error } : {}),
      })
    }

    req.on('socket', (sock) => {
      const tlsSock = sock as TLSSocket
      tlsSock.once('secureConnect', () => {
        upgradeStartMs = Date.now()
      })
    })

    req.once('upgrade', (res, socket) => {
      const rtt = Math.max(1, Date.now() - upgradeStartMs)
      socket.destroy()
      if (res.statusCode === 101) {
        finish(true, rtt)
      } else {
        finish(false, null, `Unexpected WSS upgrade HTTP ${String(res.statusCode)}`)
      }
    })

    req.once('response', (res) => {
      res.resume()
      finish(false, null, `WSS bridge returned HTTP ${String(res.statusCode)}`)
    })

    req.once('timeout', () => {
      finish(false, null, `WSS bridge timeout (${timeoutMs}ms)`)
    })

    req.once('error', (err: Error) => {
      finish(false, null, err.message || 'WSS bridge error')
    })

    req.end()
  })
}

/**
 * Default gateway service probe: for remote domain gateways with `wsPath` (`/d2net/{bnet,realm,game}`),
 * probes the WSS bridge first (matching how browser clients connect) and falls back to raw TCP if
 * WSS is unavailable; for localhost/loopback addresses, probes raw TCP directly.
 */
export async function probeGatewayEndpoint(
  endpoint: GatewayServiceEndpoint,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<GatewayServiceProbeResult> {
  const isLoopback =
    endpoint.host === '127.0.0.1' ||
    endpoint.host === 'localhost' ||
    endpoint.host === '::1'
  if (!isLoopback && endpoint.wsPath) {
    const wssResult = await probeWssBridgeEndpoint(endpoint, timeoutMs)
    if (wssResult.online) {
      return wssResult
    }
    const tcpResult = await probeTcpEndpoint(endpoint, timeoutMs)
    if (tcpResult.online) {
      return tcpResult
    }
    return wssResult
  }
  return probeTcpEndpoint(endpoint, timeoutMs)
}

export function buildGatewayEndpoints(
  options?: ServerStatusProbeOptions,
): readonly GatewayServiceEndpoint[] {
  const host = (options?.host ?? process.env.D2_REALM_HOST ?? DEFAULT_GATEWAY_HOST).trim()
  const bncsPort = options?.bncsPort ?? DEFAULT_BNCS_PORT
  const mcpPort = options?.mcpPort ?? DEFAULT_MCP_PORT
  const d2gsPort = options?.d2gsPort ?? DEFAULT_D2GS_PORT

  return [
    { id: 'bncs', name: 'BNCS 战网大厅', host, port: bncsPort, wsPath: '/d2net/bnet' },
    { id: 'mcp', name: 'MCP 角色服务器', host, port: mcpPort, wsPath: '/d2net/realm' },
    { id: 'd2gs', name: 'D2GS 游戏世界', host, port: d2gsPort, wsPath: '/d2net/game' },
  ]
}

export async function probeGatewayStatus(
  options?: ServerStatusProbeOptions,
): Promise<GatewayStatusReport> {
  const realm = (options?.realm ?? DEFAULT_REALM_NAME).trim()
  const endpoints = buildGatewayEndpoints(options)
  const host = endpoints[0]?.host ?? DEFAULT_GATEWAY_HOST
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const yellowThresholdMs = options?.yellowThresholdMs ?? DEFAULT_YELLOW_THRESHOLD_MS
  const probeFn = options?.probeFn ?? probeGatewayEndpoint

  const services = await Promise.all(endpoints.map((ep) => probeFn(ep, timeoutMs)))
  const aggregate = aggregateGatewayStatusLight(services, yellowThresholdMs)

  return {
    ok: true,
    realm,
    host,
    checkedAt: new Date().toISOString(),
    yellowThresholdMs,
    ...aggregate,
    services,
  }
}

export function createServerStatusHttpMiddleware(options?: ServerStatusProbeOptions) {
  const cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  let cachedReport: GatewayStatusReport | null = null
  let cachedAtMs = 0
  let inFlightPromise: Promise<GatewayStatusReport> | null = null

  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (!req.url || !/^\/(?:diablo2\/)?api\/server-status(?:\?.*)?$/.test(req.url)) {
      next()
      return
    }

    if (req.method !== 'GET') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(`${JSON.stringify({ ok: false, error: 'Method Not Allowed' })}\n`)
      return
    }

    const visitorLocale = detectVisitorLocaleFromRequest(req)
    const forceRefresh = /[?&]refresh=(?:1|true)\b/i.test(req.url)
    const nowMs = Date.now()

    if (!forceRefresh && cachedReport && nowMs - cachedAtMs < cacheTtlMs) {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(`${JSON.stringify({ ...cachedReport, ...visitorLocale })}\n`)
      return
    }

    if (!inFlightPromise) {
      inFlightPromise = probeGatewayStatus(options)
        .then((report) => {
          cachedReport = report
          cachedAtMs = Date.now()
          return report
        })
        .finally(() => {
          inFlightPromise = null
        })
    }

    inFlightPromise
      .then((report) => {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(`${JSON.stringify({ ...report, ...visitorLocale })}\n`)
      })
      .catch((err: unknown) => {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(
          `${JSON.stringify({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          })}\n`,
        )
      })
  }
}

export interface HomeFallbackMiddlewareOptions {
  readonly rootDir?: string | undefined
}

const NON_HTML_ASSET_EXT_RE =
  /\.(?:png|jpe?g|gif|webp|svg|ico|r8|bin|d2|txt|dc6|dcc|dt1|ds1|tbl|dat|woff2?|ttf|otf|m?js|ts|css|json|webm|opus|mpq|map|d2s|d2cap)$/i

function isExistingFile(filePath: string): boolean {
  try {
    return existsSync(filePath) && statSync(filePath).isFile()
  } catch {
    return false
  }
}

/**
 * Determines whether an incoming request URL is an unknown/non-existent page route
 * (such as `/some-not-exist-page`, `/not-exist.html`, or retired legacy `.html` paths)
 * that should automatically redirect (`302 Found`) back to the homepage `/`.
 */
export function shouldRedirectUnknownPageToHome(
  rawUrl: string | undefined,
  options?: HomeFallbackMiddlewareOptions,
): boolean {
  if (!rawUrl) return false
  const rootDir = options?.rootDir ?? process.cwd()

  const qIdx = rawUrl.search(/[?#]/)
  let pathname = qIdx >= 0 ? rawUrl.slice(0, qIdx) : rawUrl
  try {
    pathname = decodeURIComponent(pathname)
  } catch {
    // Keep raw pathname if percent-encoding is malformed
  }
  pathname = pathname.replace(/\\/g, '/').replace(/\/+/g, '/')
  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`
  }

  // Strip optional /diablo2 deployment base prefix
  if (pathname === '/diablo2' || pathname === '/diablo2/') {
    pathname = '/'
  } else if (pathname.startsWith('/diablo2/')) {
    pathname = pathname.slice('/diablo2'.length)
  }

  // 1. Canonical root / homepage routes
  if (pathname === '/' || pathname === '/index.html') {
    return false
  }

  // 2. Virtual/aliased routes & internal Vite / API / WebSocket endpoints
  if (
    pathname === '/drops.html' ||
    pathname === '/sw.js' ||
    pathname === '/asset-manifest.json' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/d2net/') ||
    pathname.startsWith('/@') ||
    pathname.startsWith('/__vite') ||
    pathname.startsWith('/node_modules/')
  ) {
    return false
  }

  // Prevent path traversal
  const relPath = pathname.replace(/^\/+/, '')
  if (!relPath || relPath.includes('..')) {
    return false
  }

  // 3. Existing files in rootDir (e.g. play.html, index.html, src/**, etc.) or public/ (e.g. musicbox.html, updates.json, ui/**)
  if (
    isExistingFile(resolve(rootDir, relPath)) ||
    isExistingFile(resolve(rootDir, 'public', relPath))
  ) {
    return false
  }

  // 4. Non-HTML static asset requests (e.g. missing .png/.bin/.json/.js) should return 404, not redirect to HTML
  if (NON_HTML_ASSET_EXT_RE.test(pathname)) {
    return false
  }

  // 5. All other non-existent page paths (e.g. /some-not-exist-page, /unknown.html, /home.html) redirect to /
  return true
}

/**
 * Vite HTTP middleware that redirects any non-existent page navigation
 * (e.g., `/some-not-exist-page`, `/not-exist.html`, `/home.html`) back to `/` (`index.html`).
 */
export function createHomeFallbackHttpMiddleware(options?: HomeFallbackMiddlewareOptions) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next()
      return
    }
    if (shouldRedirectUnknownPageToHome(req.url, options)) {
      res.statusCode = 302
      res.setHeader('Location', '/')
      res.setHeader('Cache-Control', 'no-store')
      res.end()
      return
    }
    next()
  }
}
