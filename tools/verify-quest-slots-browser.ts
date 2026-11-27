#!/usr/bin/env npx tsx
/**
 * Headless Chrome + CDP visual verifier for Issue #914: Quest Log icon / questsockets slot geometry from the
 * D2Client.dll 1.13c slot table (0x6fba8100). Renders the real WorldPanelsHud quest panel with baked /ui assets for
 * all 5 acts and asserts the icons stay inside the stone area (no overdraw of the divider below row 2 or of the act
 * tab strip above row 1) while covering every slot hit-rect. Screenshot: scratch/verify-quest-slots/.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'

import { findChromeBinary } from './find-chrome.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT_DIR, 'scratch/verify-quest-slots')

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

class CdpSession {
  private readonly ws: WebSocket
  private msgId = 0
  private readonly pending = new Map<
    number,
    { readonly resolve: (val: any) => void; readonly reject: (err: Error) => void }
  >()
  readonly consoleErrors: string[] = []
  readonly pageExceptions: string[] = []

  private constructor(ws: WebSocket) {
    this.ws = ws
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data))
      if (typeof msg.id === 'number') {
        const entry = this.pending.get(msg.id)
        if (entry) {
          this.pending.delete(msg.id)
          if (msg.error) {
            entry.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
          } else {
            entry.resolve(msg.result)
          }
        }
        return
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        if (msg.params?.type === 'error') {
          const text = (msg.params?.args ?? [])
            .map((a: any) => a.value ?? a.description ?? '')
            .join(' ')
          if (
            !text.includes('favicon.ico') &&
            !text.includes('[D2MissingArt]') &&
            !text.includes('unavailable in pre-baked packs')
          ) {
            this.consoleErrors.push(text)
          }
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const details = msg.params?.exceptionDetails
        this.pageExceptions.push(
          String(details?.exception?.description ?? details?.text ?? JSON.stringify(details)),
        )
      }
    }
  }

  static async connect(wsUrl: string): Promise<CdpSession> {
    const ws = new WebSocket(wsUrl)
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = (err) => reject(new Error(`CDP WebSocket error: ${String(err)}`))
    })
    const cdp = new CdpSession(ws)
    await cdp.send('Runtime.enable')
    await cdp.send('Page.enable')
    return cdp
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.msgId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate<T = any>(expression: string): Promise<T> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (res?.exceptionDetails) {
      const desc =
        res.exceptionDetails.exception?.description ??
        res.exceptionDetails.text ??
        JSON.stringify(res.exceptionDetails)
      throw new Error(`CDP evaluate exception: ${String(desc)}`)
    }
    return res?.result?.value as T
  }

  async captureScreenshot(outPath: string): Promise<number> {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' })
    const data = shot?.data
    if (typeof data !== 'string' || data.length === 0) {
      throw new Error('Failed to capture PNG screenshot via CDP')
    }
    const buf = Buffer.from(data, 'base64')
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, buf)
    return buf.byteLength
  }

  close(): void {
    try {
      this.ws.close()
    } catch {
      // Ignore close error
    }
  }
}

async function main(): Promise<void> {
  const chromeBin = findChromeBinary()
  mkdirSync(OUT_DIR, { recursive: true })
  const publicDir = resolve(ROOT_DIR, 'public')


  let viteServer: ViteDevServer | null = null
  const userDataDir = mkdtempSync(join(tmpdir(), 'd2-verify-quest-slots-'))
  let chromeProc: ReturnType<typeof spawn> | null = null
  let cdp: CdpSession | null = null

  try {
    viteServer = await createServer({
      root: ROOT_DIR,
      publicDir,
      server: { host: '127.0.0.1', port: 0, strictPort: false, watch: null },
      logLevel: 'error',
    })
    await viteServer.listen()
    const addr = viteServer.httpServer?.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    if (!port) throw new Error('Failed to start Vite dev server')
    const pageUrl = `http://127.0.0.1:${String(port)}/tools/verify-quest-slots.html`
    console.log(`[verify-quest-slots] Vite server listening at ${pageUrl}`)

    chromeProc = spawn(
      chromeBin,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu-sandbox',
        '--use-angle=swiftshader',
        '--use-gl=angle',
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--no-proxy-server',
        '--password-store=basic',
        '--disable-extensions',
        '--no-first-run',
        '--no-default-browser-check',
        '--force-device-scale-factor=1',
        '--window-size=1280,960',
        `--user-data-dir=${userDataDir}`,
        '--remote-debugging-port=0',
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )
    let chromeStderr = ''
    chromeProc.stderr?.on('data', (chunk) => {
      chromeStderr += String(chunk)
    })

    let cdpPort: string | null = null
    for (let i = 0; i < 100 && cdpPort === null; i++) {
      await sleep(150)
      try {
        const firstLine = readFileSync(join(userDataDir, 'DevToolsActivePort'), 'utf8').trim().split('\n')[0]
        if (firstLine) cdpPort = firstLine
      } catch {
        // DevToolsActivePort not written yet
      }
    }
    if (cdpPort === null) throw new Error(`Chrome failed to start DevTools: ${chromeStderr.slice(-500)}`)

    let pageWsUrl: string | null = null
    for (let i = 0; i < 120 && pageWsUrl === null; i++) {
      await sleep(150)
      try {
        const list = (await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()) as {
          readonly type: string
          readonly webSocketDebuggerUrl: string
        }[]
        const page = list.find((p) => p.type === 'page')
        if (page) pageWsUrl = page.webSocketDebuggerUrl
      } catch {
        // Keep polling
      }
    }
    if (pageWsUrl === null) throw new Error('Failed to find page WebSocket URL')

    cdp = await CdpSession.connect(pageWsUrl)
    // play.html needs WebGL2; the quest log is pure 2D HUD, so render it with the real WorldPanelsHud +
    // D2FontRenderer + baked /ui assets on a 2D canvas page.
    const shots: string[] = []
    await cdp.send('Page.navigate', { url: pageUrl })
    let ready = false
    for (let i = 0; i < 120 && !ready; i++) {
      await sleep(250)
      ready = await cdp.evaluate<boolean>('Boolean(window.__questSlotReady)').catch(() => false)
    }
    assert(ready, `quest slot verify page failed to render (${JSON.stringify({ console: cdp.consoleErrors, exceptions: cdp.pageExceptions })})`)
    const results = await cdp.evaluate<{ act: number; belowDiff: number; aboveDiff: number; covered: boolean[] }[]>(
      'window.__questSlotResults',
    )
    console.log('[verify-quest-slots] results:', JSON.stringify(results))
    assert(results.length === 5, 'all 5 acts rendered')
    for (const r of results) {
      assert(r.belowDiff === 0, `act ${r.act}: quest icons/sockets overdraw the divider below row 2 (${r.belowDiff} px)`)
      assert(r.aboveDiff === 0, `act ${r.act}: quest icons/sockets overdraw the tab strip above row 1 (${r.aboveDiff} px)`)
      assert(r.covered.length === (r.act === 4 ? 3 : 6) && r.covered.every(Boolean), `act ${r.act}: every slot hit-rect must be covered by icon art`)
    }
    const shot = join(OUT_DIR, 'quest-slots.png')
    const bytes = await cdp.captureScreenshot(shot)
    console.log(`[verify-quest-slots] Captured ${shot} (${bytes} bytes)`)
    shots.push(shot)

    // Verify no unexpected errors
    if (cdp.consoleErrors.length > 0 || cdp.pageExceptions.length > 0) {
      throw new Error(`Unexpected errors: ${JSON.stringify({ console: cdp.consoleErrors, exceptions: cdp.pageExceptions })}`)
    }

    console.log(`\n======================================================`)
    console.log(`[verify-quest-slots] ALL GATES PASSED! Screenshots saved to:`)
    for (const s of shots) console.log(`  - ${s}`)
    console.log(`======================================================\n`)
  } finally {
    cdp?.close()
    chromeProc?.kill('SIGKILL')
    if (viteServer) await viteServer.close()
    try {
      rmSync(userDataDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error
    }
  }
}

main().catch((err) => {
  console.error('[verify-quest-slots] FATAL:', err)
  process.exit(1)
})
