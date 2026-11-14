import { appendFileSync, mkdirSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'

export const PLAY_LOG_ROUTE = '/api/play-log'

const fileNameOf = (session: unknown) => `${String(session).replace(/[^\w-]/g, '_').slice(0, 64) || 'session'}.jsonl`

export function createPlayLogHttpMiddleware(dir: string) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (req.method !== 'POST' || req.url !== PLAY_LOG_ROUTE) {
      next()
      return
    }
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const { session, lines } = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { session: unknown; lines: unknown[] }
        mkdirSync(dir, { recursive: true })
        appendFileSync(join(dir, fileNameOf(session)), lines.map((line) => JSON.stringify(line)).join('\n') + '\n')
        res.statusCode = 204
      } catch {
        res.statusCode = 400
      }
      res.end()
    })
  }
}
