/**
 * EndpointResolver implementations (`wsBridgeResolver`, `tcpResolver`, `mixedResolver`).
 *
 * Maps server-advertised `(kind, host, port)` endpoints to `ByteStream` connections:
 * - `wsBridgeResolver`: maps `6112 -> /d2net/bnet`, `6113 -> /d2net/realm`, `4000 -> /d2net/game`
 *   over `wss://<bridgeHost><basePath>/<kind>` and enforces a maximum of 2 concurrent
 *   WSS connections to `/d2net/bnet` (Requirement R6).
 * - `tcpResolver`: connects directly via TCP (`host:port`).
 * - `mixedResolver`: connects directly via TCP (`bnetHost:6112`) for `bnet` and uses
 *   the WSS bridge (`wss://<bridgeHost>/d2net/{realm,game}`) for `realm` and `game`,
 *   preventing Node bots from consuming the 5-per-IP `127.0.0.1` `bnetd` connection quota.
 */

import { NetprotoError } from '../core/errors.ts'
import type { ByteStream, EndpointKind } from './byte-stream.ts'
import { connectWsStream, type ConnectWsOptions } from './ws-stream.ts'

export type { EndpointKind }
export type NetChannel = EndpointKind

export interface EndpointResolver {
  open(kind: EndpointKind, host: string, port: number): Promise<ByteStream>
}

export const DEFAULT_PORT_KIND_MAP: Readonly<Record<number, EndpointKind>> = {
  6112: 'bnet',
  6113: 'realm',
  4000: 'game',
} as const

let activeWssBnetConnections = 0

export function getActiveWssBnetConnections(): number {
  return activeWssBnetConnections
}

export function resetActiveWssBnetConnectionsForTesting(): void {
  activeWssBnetConnections = 0
}

export interface WsBridgeResolverOptions extends ConnectWsOptions {
  /** Bridge hostname (default `'www.laiseek.xyz'`). */
  readonly host?: string | undefined
  /** WebSocket scheme (`'wss'` or `'ws'`, default `'wss'`). */
  readonly scheme?: 'wss' | 'ws' | undefined
  /** Boolean alias for scheme (`true` -> `'wss'`, `false` -> `'ws'`). */
  readonly secure?: boolean | undefined
  /** Base path prefix (default `'/d2net'`). */
  readonly basePath?: string | undefined
  /** Explicit URL override map per EndpointKind. */
  readonly urlMap?: Partial<Record<EndpointKind, string>> | undefined
  /** Optional port offset for direct ws://host:(port + wsPortOffset) resolution. */
  readonly wsPortOffset?: number | undefined
  /** Port to endpoint kind mapping override. */
  readonly portMap?: Readonly<Record<number, EndpointKind>> | undefined
  /** Maximum concurrent WSS connections to `/d2net/bnet` (default `2`). */
  readonly maxConcurrentBnetWss?: number | undefined
  /** Optional custom stream factory for testing. */
  readonly streamFactory?:
    | ((kind: EndpointKind, url: string) => Promise<ByteStream> | ByteStream)
    | undefined
}

export function resolveEndpointUrl(
  kind: EndpointKind,
  host = 'www.laiseek.xyz',
  port = 6112,
  options: WsBridgeResolverOptions = {},
): string {
  const mapped = options.urlMap?.[kind]
  if (mapped) return mapped
  const scheme = options.scheme ?? (options.secure !== undefined ? (options.secure ? 'wss' : 'ws') : 'ws')
  if (options.wsPortOffset !== undefined) {
    return `${scheme}://${host}:${port + options.wsPortOffset}`
  }
  if (options.host !== undefined || options.basePath !== undefined || options.scheme !== undefined) {
    const bridgeHost = options.host ?? host
    const bridgeScheme = options.scheme ?? (options.secure === false ? 'ws' : 'wss')
    const basePath = (options.basePath ?? '/d2net').replace(/\/+$/, '')
    return `${bridgeScheme}://${bridgeHost}${basePath}/${kind}`
  }
  return `${scheme}://${host}:${port}`
}

export function createWsBridgeResolver(options: WsBridgeResolverOptions = {}): EndpointResolver {
  const bridgeHost = options.host ?? 'www.laiseek.xyz'
  const scheme = options.scheme ?? (options.secure === false ? 'ws' : 'wss')
  const basePath = (options.basePath ?? '/d2net').replace(/\/+$/, '')
  const portMap = options.portMap ?? DEFAULT_PORT_KIND_MAP
  const maxConcurrentBnetWss = options.maxConcurrentBnetWss ?? 2

  return {
    async open(kind: EndpointKind, host: string, port: number): Promise<ByteStream> {
      const resolvedKind = portMap[port] ?? kind
      if (resolvedKind === 'bnet') {
        if (activeWssBnetConnections >= maxConcurrentBnetWss) {
          throw new Error(
            `Rate limit / WSS /d2net/bnet concurrency limit exceeded: ${activeWssBnetConnections}/${maxConcurrentBnetWss} active connections (R6 safety cap)`,
          )
        }
        activeWssBnetConnections += 1
      }

      const url =
        options.urlMap?.[resolvedKind] ??
        (options.wsPortOffset !== undefined
          ? `${scheme}://${host}:${port + options.wsPortOffset}`
          : `${scheme}://${bridgeHost}${basePath}/${resolvedKind}`)

      try {
        const stream = options.streamFactory
          ? await options.streamFactory(resolvedKind, url)
          : await connectWsStream(url, resolvedKind, options)
        if (resolvedKind === 'bnet') {
          let decremented = false
          stream.onClose(() => {
            if (!decremented) {
              decremented = true
              activeWssBnetConnections = Math.max(0, activeWssBnetConnections - 1)
            }
          })
        }
        return stream
      } catch (err) {
        if (resolvedKind === 'bnet') {
          activeWssBnetConnections = Math.max(0, activeWssBnetConnections - 1)
        }
        throw err
      }
    },
  }
}

export const wsBridgeResolver = createWsBridgeResolver

export type TcpOpener = (
  host: string,
  port: number,
  label: string,
  options?: { readonly timeoutMs?: number | undefined },
) => Promise<ByteStream>

let defaultTcpOpener: TcpOpener | null = null

export function registerDefaultTcpOpener(opener: TcpOpener | null): void {
  defaultTcpOpener = opener
}

export interface TcpResolverOptions {
  /** Override target host (e.g. `'127.0.0.1'`) when server advertises internal IP. */
  readonly hostOverride?: string | undefined
  readonly timeoutMs?: number | undefined
  readonly openTcp?: TcpOpener | undefined
  readonly streamFactory?:
    | ((kind: EndpointKind, host: string, port: number) => Promise<ByteStream> | ByteStream)
    | undefined
}

export function createTcpResolver(options: TcpResolverOptions = {}): EndpointResolver {
  return {
    async open(kind: EndpointKind, host: string, port: number): Promise<ByteStream> {
      const targetHost = options.hostOverride ?? host
      if (options.streamFactory) {
        return await options.streamFactory(kind, targetHost, port)
      }
      const openFn = options.openTcp ?? defaultTcpOpener
      if (!openFn) {
        throw new NetprotoError(
          'ERR_TRANSPORT',
          `Failed to open TCP stream to ${targetHost}:${port}: No TCP opener registered for netproto endpoint; call registerDefaultTcpOpener(openNodeTcpStream) in Node CLI tools`,
          { channel: kind },
        )
      }
      return await openFn(targetHost, port, kind, { timeoutMs: options.timeoutMs })
    },
  }
}

export const tcpResolver = createTcpResolver

export interface MixedResolverOptions extends WsBridgeResolverOptions {
  /** Direct TCP host for BNCS port 6112 (default `'127.0.0.1'`). */
  readonly bnetTcpHost?: string | undefined
  /** Direct TCP port for BNCS (default `6112`). */
  readonly bnetTcpPort?: number | undefined
  readonly openTcp?: TcpOpener | undefined
}

function isResolverRouteMap(
  arg: MixedResolverOptions | Partial<Record<EndpointKind, EndpointResolver>>,
): arg is Partial<Record<EndpointKind, EndpointResolver>> {
  const rec = arg as Record<string, unknown>
  return (
    typeof rec['bnet'] === 'object' ||
    typeof rec['realm'] === 'object' ||
    typeof rec['game'] === 'object' ||
    typeof rec['ts'] === 'object' ||
    Object.keys(rec).length === 0
  )
}

export function createMixedResolver(
  optionsOrMap?: MixedResolverOptions | Partial<Record<EndpointKind, EndpointResolver>>,
  fallback?: EndpointResolver,
): EndpointResolver {
  if (
    optionsOrMap !== undefined &&
    (fallback !== undefined || isResolverRouteMap(optionsOrMap))
  ) {
    const routeMap = optionsOrMap as Partial<Record<EndpointKind, EndpointResolver>>
    const hasAnyRoute =
      routeMap.bnet !== undefined ||
      routeMap.realm !== undefined ||
      routeMap.game !== undefined ||
      routeMap.ts !== undefined ||
      fallback !== undefined
    if (hasAnyRoute || Object.keys(optionsOrMap).length === 0) {
      return {
        async open(kind: EndpointKind, host: string, port: number): Promise<ByteStream> {
          const target = routeMap[kind] ?? fallback
          if (!target) {
            throw new Error(`No endpoint resolver configured for kind "${kind}" (${host}:${port})`)
          }
          return await target.open(kind, host, port)
        },
      }
    }
  }

  const options = (optionsOrMap ?? {}) as MixedResolverOptions
  const bnetTcpHost = options.bnetTcpHost ?? '127.0.0.1'
  const bnetTcpPort = options.bnetTcpPort ?? 6112
  const wsResolver = createWsBridgeResolver(options)
  const tcpRes = createTcpResolver({
    hostOverride: bnetTcpHost,
    timeoutMs: options.timeoutMs,
    openTcp: options.openTcp,
  })

  return {
    open(kind: EndpointKind, host: string, port: number): Promise<ByteStream> {
      if (kind === 'bnet' || port === 6112) {
        return tcpRes.open('bnet', bnetTcpHost, bnetTcpPort)
      }
      return wsResolver.open(kind, host, port)
    },
  }
}

export const mixedResolver = createMixedResolver
export const directTcpResolver = createTcpResolver
export type EndpointRole = EndpointKind

