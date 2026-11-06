/**
 * Server/Deployment Site Configuration Middleware (`src/baker/io/site-config.ts`).
 *
 * Exposes `GET /site-config.json` (and `/diablo2/site-config.json`) with `Cache-Control: no-store`
 * so administrators can control global site switches (such as `singlePlayerEnabled`) via either:
 * 1. Environment variable `VITE_ENABLE_SINGLE_PLAYER` (`true`/`1` or `false`/`0`), or
 * 2. Server-local `public/site-config.json` (`{ "singlePlayerEnabled": boolean }`), git-ignored.
 *
 * Strictly fail-closed (`singlePlayerEnabled: false`) when neither is configured or valid.
 */

import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'

export interface SiteDeploymentConfig {
  readonly singlePlayerEnabled: boolean
}

export interface SiteConfigMiddlewareOptions {
  readonly publicDir: string
  readonly env?: Readonly<Record<string, string | undefined>> | undefined
}

export const DEFAULT_SITE_DEPLOYMENT_CONFIG: SiteDeploymentConfig = Object.freeze({
  singlePlayerEnabled: false,
})

/**
 * Parses an explicit boolean flag from an environment variable or JSON field.
 * Returns `undefined` when unset or unrecognized so callers can fall through or fail closed.
 */
export function parseExplicitBooleanFlag(raw: unknown): boolean | undefined {
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'string') {
    const norm = raw.trim().toLowerCase()
    if (norm === 'true' || norm === '1') return true
    if (norm === 'false' || norm === '0') return false
  }
  return undefined
}

/**
 * Resolves the active deployment configuration from environment variables and `public/site-config.json`.
 * Precedence: explicit `VITE_ENABLE_SINGLE_PLAYER` env var > `public/site-config.json` > `false`.
 */
export function resolveServerSiteConfig(options: SiteConfigMiddlewareOptions): SiteDeploymentConfig {
  const env = options.env ?? process.env
  const envFlag = parseExplicitBooleanFlag(env.VITE_ENABLE_SINGLE_PLAYER)
  if (envFlag !== undefined) {
    return { singlePlayerEnabled: envFlag }
  }

  const configFile = resolve(options.publicDir, 'site-config.json')
  if (existsSync(configFile)) {
    try {
      const parsed = JSON.parse(readFileSync(configFile, 'utf8')) as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const diskFlag = parseExplicitBooleanFlag(parsed.singlePlayerEnabled)
        if (diskFlag !== undefined) {
          return { singlePlayerEnabled: diskFlag }
        }
      }
    } catch {
      // Malformed JSON fails closed to singlePlayerEnabled: false
    }
  }

  return DEFAULT_SITE_DEPLOYMENT_CONFIG
}

/**
 * Vite dev/preview HTTP middleware serving `/site-config.json` and `/diablo2/site-config.json`.
 */
export function createSiteConfigHttpMiddleware(options: SiteConfigMiddlewareOptions) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (
      (req.method !== 'GET' && req.method !== 'HEAD') ||
      !req.url ||
      !/^\/(?:diablo2\/)?site-config\.json(?:\?.*)?$/.test(req.url)
    ) {
      next()
      return
    }

    const config = resolveServerSiteConfig(options)
    const body = `${JSON.stringify(config)}\n`
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    res.end(body)
  }
}
