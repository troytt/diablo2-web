/**
 * Server-side Bug Report Persistence (`src/baker/io/bug-report-store.ts`).
 *
 * Persists user-submitted bug reports from `#d2-toolbar-bug-btn` (`POST /api/bugs`)
 * into local server files under `bugs/`:
 * - `bugs/bug-reports.jsonl` (append-only JSON Lines log of all reports)
 * - `bugs/<id>.json` (pretty-printed individual JSON report for inspection)
 *
 * Strict boundary compliance: never imports `src/client/**` or `src/server/**`.
 */

import { randomBytes } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join, resolve } from 'node:path'

export type StoredBugCategory =
  | 'gameplay'
  | 'render'
  | 'network'
  | 'audio'
  | 'ui'
  | 'other'

const VALID_CATEGORIES: readonly StoredBugCategory[] = [
  'gameplay',
  'render',
  'network',
  'audio',
  'ui',
  'other',
] as const

export interface StoredBugReportRecord {
  readonly id: string
  readonly savedAt: string
  readonly clientTimestamp: string
  readonly title: string
  readonly category: StoredBugCategory
  readonly description: string
  readonly pageUrl?: string | undefined
  readonly userAgent?: string | undefined
  readonly connection?: unknown
  readonly settings?: unknown
  readonly gameContext?: unknown
}

export interface PersistBugReportResult {
  readonly ok: boolean
  readonly id: string
  readonly savedAt?: string | undefined
  readonly file?: string | undefined
  readonly record?: StoredBugReportRecord | undefined
  readonly error?: string | undefined
}

export interface BugReportStoreOptions {
  readonly bugsDir?: string | undefined
}

const MAX_BODY_BYTES = 64 * 1024

function formatCompactTimestamp(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
  )
}

export function persistBugReportToDisk(
  rawPayload: unknown,
  options?: BugReportStoreOptions,
): PersistBugReportResult {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return { ok: false, id: '', error: 'Invalid bug report payload: expected JSON object' }
  }
  const obj = rawPayload as Record<string, unknown>
  const rawTitle = typeof obj.title === 'string' ? obj.title.trim() : ''
  const rawDesc = typeof obj.description === 'string' ? obj.description.trim() : ''
  if (!rawTitle || !rawDesc) {
    return {
      ok: false,
      id: '',
      error: 'Both title and description are required',
    }
  }

  const title = rawTitle.slice(0, 120)
  const description = rawDesc.slice(0, 4000)
  const rawCat = typeof obj.category === 'string' ? obj.category.trim() : 'gameplay'
  const category: StoredBugCategory = (VALID_CATEGORIES as readonly string[]).includes(rawCat)
    ? (rawCat as StoredBugCategory)
    : 'gameplay'

  const now = new Date()
  const savedAt = now.toISOString()
  const clientTimestamp =
    typeof obj.clientTimestamp === 'string' && obj.clientTimestamp.trim()
      ? obj.clientTimestamp.trim().slice(0, 64)
      : savedAt
  const suffix = randomBytes(3).toString('hex')
  const id = `bug-${formatCompactTimestamp(now)}-${suffix}`

  const record: StoredBugReportRecord = {
    id,
    savedAt,
    clientTimestamp,
    title,
    category,
    description,
    ...(typeof obj.pageUrl === 'string' ? { pageUrl: obj.pageUrl.slice(0, 512) } : {}),
    ...(typeof obj.userAgent === 'string' ? { userAgent: obj.userAgent.slice(0, 512) } : {}),
    ...(obj.connection !== undefined ? { connection: obj.connection } : {}),
    ...(obj.settings !== undefined ? { settings: obj.settings } : {}),
    ...(obj.gameContext !== undefined ? { gameContext: obj.gameContext } : {}),
  }

  const bugsDir = options?.bugsDir ?? resolve(process.cwd(), 'bugs')
  mkdirSync(bugsDir, { recursive: true })

  const jsonlPath = join(bugsDir, 'bug-reports.jsonl')
  const jsonFilePath = join(bugsDir, `${id}.json`)
  appendFileSync(jsonlPath, `${JSON.stringify(record)}\n`, 'utf8')
  writeFileSync(jsonFilePath, `${JSON.stringify(record, null, 2)}\n`, 'utf8')

  return {
    ok: true,
    id,
    savedAt,
    file: `bugs/${id}.json`,
    record,
  }
}

export function listSavedBugReports(
  options?: BugReportStoreOptions,
): StoredBugReportRecord[] {
  const bugsDir = options?.bugsDir ?? resolve(process.cwd(), 'bugs')
  const jsonlPath = join(bugsDir, 'bug-reports.jsonl')
  if (!existsSync(jsonlPath)) return []
  const raw = readFileSync(jsonlPath, 'utf8')
  const out: StoredBugReportRecord[] = []
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const parsed = JSON.parse(trimmed) as StoredBugReportRecord
      if (parsed && typeof parsed.id === 'string') {
        out.push(parsed)
      }
    } catch {
      // Ignore malformed lines
    }
  }
  return out.reverse()
}

export function createBugReportHttpMiddleware(options?: BugReportStoreOptions) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (!req.url || !/^\/(?:diablo2\/)?api\/bugs(?:\?.*)?$/.test(req.url)) {
      next()
      return
    }

    if (req.method === 'GET') {
      try {
        const reports = listSavedBugReports(options)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(`${JSON.stringify({ ok: true, reports })}\n`)
      } catch (err) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(
          `${JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) })}\n`,
        )
      }
      return
    }

    if (req.method === 'POST') {
      const chunks: Buffer[] = []
      let totalBytes = 0
      let aborted = false
      req.on('data', (chunk: Buffer | string) => {
        if (aborted) return
        const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
        totalBytes += buf.byteLength
        if (totalBytes > MAX_BODY_BYTES) {
          aborted = true
          res.statusCode = 413
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(`${JSON.stringify({ ok: false, error: 'Payload too large' })}\n`)
          return
        }
        chunks.push(buf)
      })
      req.on('end', () => {
        if (aborted) return
        try {
          const bodyStr = Buffer.concat(chunks).toString('utf8')
          const parsed = JSON.parse(bodyStr) as unknown
          const result = persistBugReportToDisk(parsed, options)
          res.statusCode = result.ok ? 200 : 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(
            `${JSON.stringify({
              ok: result.ok,
              id: result.id,
              savedAt: result.savedAt,
              file: result.file,
              error: result.error,
            })}\n`,
          )
        } catch (err) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(
            `${JSON.stringify({
              ok: false,
              id: '',
              error: err instanceof Error ? err.message : 'Invalid JSON body',
            })}\n`,
          )
        }
      })
      return
    }

    res.statusCode = 405
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(`${JSON.stringify({ ok: false, error: 'Method Not Allowed' })}\n`)
  }
}
