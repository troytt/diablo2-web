/**
 * Runtime Site Deployment Configuration Loader (`src/client/config/site-config.ts`).
 *
 * Resolves global deployment-level feature switches (such as `singlePlayerEnabled`)
 * strictly from server/deployment configuration — never from URL parameters or `localStorage`.
 *
 * Resolution order (fail-closed to `false`):
 * 1. Fresh `GET ./site-config.json` (`cache: 'no-store'`): if HTTP 200 JSON carries a boolean
 *    `singlePlayerEnabled` (or `'true'`/`'1'`/`'false'`/`'0'`), that value wins immediately.
 * 2. Build/dev environment fallback (`import.meta.env.VITE_ENABLE_SINGLE_PLAYER`) when
 *    `site-config.json` is absent (`404`) or unreachable in static builds.
 * 3. Default: `{ singlePlayerEnabled: false }`.
 */

export type SinglePlayerBackendConfig = 'legacy' | 'd2kern-113c'

export interface SiteConfig {
  readonly singlePlayerEnabled: boolean
  readonly singlePlayerBackend?: SinglePlayerBackendConfig | undefined
}

export interface LoadSiteConfigOptions {
  readonly fetchFn?: ((input: string, init?: RequestInit) => Promise<Response>) | undefined
  readonly configUrl?: string | undefined
  readonly buildEnvSinglePlayer?: unknown
  readonly buildEnvSinglePlayerBackend?: unknown
}

export const DEFAULT_SITE_CONFIG: SiteConfig = Object.freeze({
  singlePlayerEnabled: false,
})

/**
 * Parses an explicit boolean flag (`boolean` or `'true'|'1'|'false'|'0'`).
 * Returns `undefined` for any missing or unrecognized value.
 */
export function parseSinglePlayerFlag(raw: unknown): boolean | undefined {
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'string') {
    const norm = raw.trim().toLowerCase()
    if (norm === 'true' || norm === '1') return true
    if (norm === 'false' || norm === '0') return false
  }
  return undefined
}

/**
 * Parses an explicit Single-Player backend mode (`'legacy'` or `'d2kern-113c'`).
 * Returns `undefined` when omitted or unrecognized.
 */
export function parseSinglePlayerBackend(raw: unknown): SinglePlayerBackendConfig | undefined {
  if (typeof raw !== 'string') return undefined
  const norm = raw.trim().toLowerCase()
  if (norm === 'd2kern-113c' || norm === 'd2kern') return 'd2kern-113c'
  if (norm === 'legacy') return 'legacy'
  return undefined
}

function readBuildEnvSinglePlayerFlag(): unknown {
  return (
    import.meta as {
      readonly env?: {
        readonly VITE_ENABLE_SINGLE_PLAYER?: unknown
      }
    }
  ).env?.VITE_ENABLE_SINGLE_PLAYER
}

function readBuildEnvSinglePlayerBackend(): unknown {
  return (
    import.meta as {
      readonly env?: {
        readonly VITE_SINGLE_PLAYER_BACKEND?: unknown
      }
    }
  ).env?.VITE_SINGLE_PLAYER_BACKEND
}

/**
 * Loads the active deployment configuration, failing closed (`singlePlayerEnabled: false`)
 * whenever no explicit deployment switch is enabled.
 */
export async function loadSiteConfig(options?: LoadSiteConfigOptions): Promise<SiteConfig> {
  const fallbackFlag =
    parseSinglePlayerFlag(
      options && 'buildEnvSinglePlayer' in options
        ? options.buildEnvSinglePlayer
        : readBuildEnvSinglePlayerFlag(),
    ) ?? false
  const fallbackBackend = parseSinglePlayerBackend(
    options && 'buildEnvSinglePlayerBackend' in options
      ? options.buildEnvSinglePlayerBackend
      : readBuildEnvSinglePlayerBackend(),
  )

  const buildResult = (
    enabled: boolean,
    backend?: SinglePlayerBackendConfig | undefined,
  ): SiteConfig => (backend !== undefined ? { singlePlayerEnabled: enabled, singlePlayerBackend: backend } : { singlePlayerEnabled: enabled })

  const fetchImpl =
    options?.fetchFn ??
    (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined)
  if (!fetchImpl) {
    return buildResult(fallbackFlag, fallbackBackend)
  }

  const url = options?.configUrl ?? './site-config.json'
  try {
    const res = await fetchImpl(url, { cache: 'no-store' })
    if (res.ok && res.status === 200) {
      const data = (await res.json()) as unknown
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const obj = data as Record<string, unknown>
        const remoteFlag = parseSinglePlayerFlag(obj.singlePlayerEnabled)
        const remoteBackend = parseSinglePlayerBackend(obj.singlePlayerBackend) ?? fallbackBackend
        if (remoteFlag !== undefined) {
          return buildResult(remoteFlag, remoteBackend)
        }
      }
    }
  } catch {
    // Network / JSON errors fail closed to fallbackFlag (false by default)
  }

  return buildResult(fallbackFlag, fallbackBackend)
}
