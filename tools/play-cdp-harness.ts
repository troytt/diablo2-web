#!/usr/bin/env npx tsx
/**
 * Shared headless Chrome + CDP harness for the play.html visual verifiers of the client parity audit
 * (`tools/verify-*-units-browser.ts`). It boots `play.html` from this checkout on a Vite dev server, replays the
 * town fixture (`tests/fixtures/netproto/02-d2gs-town-walk-chat.d2cap`) so a live session exists, and hands the
 * caller a CDP session with helpers to inject raw S2C packets, tick, render and take screenshots at the 1.13c
 * resolutions (800x600 and 1280x720).
 *
 * Env: `D2W_PORT` (default 0 = any free port), `D2W_PUBLIC_DIR` (default `public/`), `CHROME_PATH`.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'

import { findChromeBinary } from './find-chrome.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT_DIR = resolve(__dirname, '..')

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`Assertion failed: ${message}`)
}

export class CdpSession {
  private readonly ws: WebSocket
  private msgId = 0
  private readonly pending = new Map<number, { readonly resolve: (val: any) => void; readonly reject: (err: Error) => void }>()
  readonly consoleErrors: string[] = []
  readonly missingArt: string[] = []
  readonly pageExceptions: string[] = []

  private constructor(ws: WebSocket) {
    this.ws = ws
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data))
      if (typeof msg.id === 'number') {
        const entry = this.pending.get(msg.id)
        if (entry) {
          this.pending.delete(msg.id)
          if (msg.error) entry.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
          else entry.resolve(msg.result)
        }
        return
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        const text = (msg.params?.args ?? []).map((a: any) => a.value ?? a.description ?? '').join(' ')
        if (text.includes('[D2MissingArt]')) this.missingArt.push(text)
        else if (!text.includes('favicon.ico') && !text.includes('unavailable in pre-baked packs')) this.consoleErrors.push(text)
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const details = msg.params?.exceptionDetails
        this.pageExceptions.push(String(details?.exception?.description ?? details?.text ?? JSON.stringify(details)))
      }
    }
  }

  static async connect(wsUrl: string): Promise<CdpSession> {
    const ws = new WebSocket(wsUrl)
    await new Promise<void>((res, rej) => {
      ws.onopen = () => res()
      ws.onerror = (err) => rej(new Error(`CDP WebSocket error: ${String(err)}`))
    })
    const cdp = new CdpSession(ws)
    await cdp.send('Runtime.enable')
    await cdp.send('Page.enable')
    return cdp
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.msgId
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate<T = any>(expression: string): Promise<T> {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (res?.exceptionDetails) {
      const desc = res.exceptionDetails.exception?.description ?? res.exceptionDetails.text ?? JSON.stringify(res.exceptionDetails)
      throw new Error(`CDP evaluate exception: ${String(desc)}`)
    }
    return res?.result?.value as T
  }

  async setViewport(width: number, height: number): Promise<void> {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await sleep(300)
  }

  async captureScreenshot(outPath: string): Promise<number> {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' })
    const data = shot?.data
    if (typeof data !== 'string' || data.length === 0) throw new Error('Failed to capture PNG screenshot via CDP')
    const buf = Buffer.from(data, 'base64')
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, buf)
    return buf.byteLength
  }

  close(): void {
    try {
      this.ws.close()
    } catch {
      // ignore
    }
  }
}

/**
 * In-page helper source: `window.__unitsHarness` with `packet0xAC(...)` (S2C 0xAC AssignNPC bitstream exactly as
 * `src/netproto/d2gs/s2c/units.ts` decodes it) and `inject(bytes)` (session.handleS2cPacket).
 */
const PAGE_HELPERS = `(() => {
  class BitWriter {
    constructor() { this.bytes = []; this.bit = 0 }
    write(value, width) {
      for (let i = 0; i < width; i++) {
        const byteIndex = this.bit >> 3
        if (byteIndex >= this.bytes.length) this.bytes.push(0)
        if ((value >>> i) & 1) this.bytes[byteIndex] |= 1 << (this.bit & 7)
        this.bit++
      }
    }
  }
  window.__unitsHarness = {
    packet0xAC(o) {
      const w = new BitWriter()
      w.write(o.mode ?? 1, 4)
      w.write(0, 1) // no anim components
      const hasFlags = o.flags !== undefined && o.flags !== 0
      w.write(hasFlags ? 1 : 0, 1)
      if (hasFlags) {
        w.write((o.flags & 0x04) ? 1 : 0, 1)
        w.write((o.flags & 0x08) ? 1 : 0, 1)
        w.write((o.flags & 0x02) ? 1 : 0, 1)
        w.write((o.flags & 0x10) ? 1 : 0, 1)
        w.write((o.flags & 0x40) ? 1 : 0, 1)
        if (o.flags & 0x02) w.write(o.superUniqueId ?? 0, 16)
        for (const m of (o.bossMods ?? [])) w.write(m, 8)
        w.write(0, 8)
        w.write(o.nameSeed ?? 0, 16)
      }
      w.write(0, 1) // no owner
      const len = 13 + w.bytes.length
      const out = new Uint8Array(len)
      const dv = new DataView(out.buffer)
      out[0] = 0xac
      dv.setUint32(1, o.id, true)
      dv.setUint16(5, o.classId, true)
      dv.setUint16(7, o.x, true)
      dv.setUint16(9, o.y, true)
      out[11] = o.lifePct ?? 128
      out[12] = len
      out.set(w.bytes, 13)
      return out
    },
    inject(bytes) { return window.__d2Play.session.handleS2cPacket(bytes) },
  }
  return true
})()`

export interface PlayHarness {
  readonly cdp: CdpSession
  readonly outDir: string
  /** Tick the session `frames` x 40 ms and render. */
  tick(frames: number): Promise<void>
  /** Screenshot at 800x600 and 1280x720 into `outDir/<name>-<w>x<h>.png`. */
  shootBoth(name: string): Promise<string[]>
}

export async function withPlayHarness(outName: string, fn: (h: PlayHarness) => Promise<void>): Promise<void> {
  const chromeBin = findChromeBinary()
  const outDir = resolve(ROOT_DIR, 'scratch', outName)
  mkdirSync(outDir, { recursive: true })
  const publicDir = process.env.D2W_PUBLIC_DIR ? resolve(process.env.D2W_PUBLIC_DIR) : resolve(ROOT_DIR, 'public')
  const d2capPath = resolve(ROOT_DIR, 'tests/fixtures/netproto/02-d2gs-town-walk-chat.d2cap')
  assert(existsSync(d2capPath), `Missing fixture at ${d2capPath}`)
  const d2capJsonl = readFileSync(d2capPath, 'utf8')
  let viteServer: ViteDevServer | null = null
  const userDataDir = mkdtempSync(join(tmpdir(), 'd2-units-harness-'))
  let chromeProc: ReturnType<typeof spawn> | null = null
  let cdp: CdpSession | null = null
  try {
    const port = Number(process.env.D2W_PORT ?? 0)
    viteServer = await createServer({
      root: ROOT_DIR,
      publicDir,
      server: { host: '127.0.0.1', port, strictPort: port !== 0, watch: null },
      logLevel: 'error',
    })
    await viteServer.listen()
    const addr = viteServer.httpServer?.address()
    const boundPort = typeof addr === 'object' && addr ? addr.port : 0
    assert(boundPort, 'Failed to start Vite dev server')
    const targetUrl = `http://127.0.0.1:${String(boundPort)}/play.html`
    console.log(`[harness] ${targetUrl}`)
    chromeProc = spawn(
      chromeBin,
      [
        '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox', '--use-angle=swiftshader',
        '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--no-proxy-server',
        '--password-store=basic', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
        '--force-device-scale-factor=1', '--window-size=1280,960', `--user-data-dir=${userDataDir}`,
        '--remote-debugging-port=0', 'about:blank',
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
        // not yet
      }
    }
    assert(cdpPort !== null, `Chrome failed to start DevTools: ${chromeStderr.slice(-500)}`)
    let pageWsUrl: string | null = null
    for (let i = 0; i < 120 && pageWsUrl === null; i++) {
      await sleep(150)
      try {
        const list = (await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json()) as { type: string; webSocketDebuggerUrl: string }[]
        pageWsUrl = list.find((p) => p.type === 'page')?.webSocketDebuggerUrl ?? null
      } catch {
        // keep polling
      }
    }
    assert(pageWsUrl !== null, 'Failed to find page WebSocket URL')
    cdp = await CdpSession.connect(pageWsUrl)
    await cdp.setViewport(800, 600)
    await cdp.send('Page.navigate', { url: targetUrl })
    let ready = false
    const bootTimeoutMs = Number(process.env.D2W_BOOT_TIMEOUT_MS ?? 900_000)
    const bootStart = Date.now()
    for (let i = 0; Date.now() - bootStart < bootTimeoutMs && !ready; i++) {
      await sleep(500)
      try {
        ready = await cdp.evaluate<boolean>(`Boolean(window.__d2PlayApp && window.__d2PlayApp.ready)`)
        if (!ready && i % 60 === 0) {
          console.log(`[harness] booting ${String(Math.round((Date.now() - bootStart) / 1000))}s: ${JSON.stringify(await cdp.evaluate(`window.__d2BootProgress ?? null`))}`)
        }
      } catch {
        // page navigating
      }
    }
    assert(ready, `play.html failed to bootstrap: ${JSON.stringify({ exceptions: cdp.pageExceptions.slice(0, 3), console: cdp.consoleErrors.slice(0, 10) })}`)
    const replayed = await cdp.evaluate<number>(`(async () => {
      const app = window.__d2Play;
      await app.assetsReadyPromise;
      const n = app.replayD2Cap(${JSON.stringify(d2capJsonl)});
      app.renderFrame(performance.now());
      return n;
    })()`)
    console.log(`[harness] replayed ${String(replayed)} packets`)
    await cdp.evaluate(PAGE_HELPERS)
    const c = cdp
    const harness: PlayHarness = {
      cdp: c,
      outDir,
      async tick(frames: number) {
        await c.evaluate(`(async () => { const app = window.__d2Play; for (let i = 0; i < ${String(frames)}; i++) { await new Promise(r => setTimeout(r, 40)); app.session.tick(40, performance.now()) } app.renderFrame(performance.now()); return true })()`)
      },
      async shootBoth(name: string) {
        const out: string[] = []
        for (const [w, hgt] of [[800, 600], [1280, 720]] as const) {
          await c.setViewport(w, hgt)
          await c.evaluate(`(async () => { const app = window.__d2Play; for (let i = 0; i < 3; i++) { app.renderFrame(performance.now()); await new Promise(r => setTimeout(r, 100)) } return true })()`)
          const p = join(outDir, `${name}-${String(w)}x${String(hgt)}.png`)
          await c.captureScreenshot(p)
          out.push(p)
        }
        await c.setViewport(800, 600)
        return out
      },
    }
    await fn(harness)
    assert(c.pageExceptions.length === 0, `page exceptions: ${JSON.stringify(c.pageExceptions.slice(0, 5))}`)
  } finally {
    cdp?.close()
    chromeProc?.kill('SIGKILL')
    if (viteServer) await viteServer.close()
    await sleep(500)
    try {
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch (err) {
      console.warn(`[harness] could not remove ${userDataDir}: ${String(err)}`)
    }
  }
}
