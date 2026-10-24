#!/usr/bin/env npx tsx
/**
 * Headless Chrome + CDP visual verifier for Issue #1453 (frozen monster shatter -> icebreak melt):
 * a monster carrying States.txt `freeze` (#1) dies -> `icebreaksmall`/`icebreaklarge` + `icebreaksmoke` shards ->
 * MissCltHitFunc[31] leaves `icebreaksmallmelt` / `icebreaklargemelt` (Range 150) on the ground.
 *
 * Runs at 800x600 and 1280x720 and captures screenshots to `scratch/verify-icebreak-melt/`.
 * Usage: npx tsx tools/verify-icebreak-melt-browser.ts
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
const OUT_DIR = resolve(ROOT_DIR, 'scratch/verify-icebreak-melt')

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
          if (text.includes('[D2MissingArt]')) this.missingArt.push(text)
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
  // Baked assets are gitignored; D2W_PUBLIC_DIR points a fresh worktree at a checkout that has them.
  const publicDir = resolve(process.env.D2W_PUBLIC_DIR ?? resolve(ROOT_DIR, 'public'))

  const d2capPath = resolve(ROOT_DIR, 'tests/fixtures/netproto/02-d2gs-town-walk-chat.d2cap')
  assert(existsSync(d2capPath), `Missing fixture at ${d2capPath}`)
  const d2capJsonl = readFileSync(d2capPath, 'utf8')

  let viteServer: ViteDevServer | null = null
  const userDataDir = mkdtempSync(join(tmpdir(), 'd2-verify-icebreak-melt-'))
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
    const targetUrl = `http://127.0.0.1:${String(port)}/play.html`
    console.log(`[verify-icebreak-melt] Vite server listening at ${targetUrl}`)

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
    await cdp.send('Page.navigate', { url: targetUrl })

    // Wait for client bootstrap
    console.log('[verify-icebreak-melt] Waiting for play.html bootstrap...')
    let ready = false
    for (let i = 0; i < 120; i++) {
      await sleep(250)
      try {
        ready = await cdp.evaluate<boolean>(`Boolean(window.__d2PlayApp && window.__d2PlayApp.ready)`)
        if (ready) break
        if (i % 20 === 0) {
          const loc = await cdp.evaluate<string>(`window.location.href`)
          console.log(`[verify-icebreak-melt] Waiting (tick ${i})... loc: ${loc}, consoleErrors: ${cdp.consoleErrors.length}, exceptions: ${cdp.pageExceptions.length}`)
          if (cdp.consoleErrors.length > 0) console.log('  console:', cdp.consoleErrors)
          if (cdp.pageExceptions.length > 0) console.log('  exceptions:', cdp.pageExceptions)
        }
      } catch (err) {
        console.log(`[verify-icebreak-melt] eval error at ${i}:`, err)
      }
    }
    if (!ready) {
      console.log('Final page state:', {
        loc: await cdp.evaluate(`window.location.href`),
        title: await cdp.evaluate(`document.title`),
        htmlSnippet: await cdp.evaluate(`document.body.innerHTML.slice(0, 500)`),
        consoleErrors: cdp.consoleErrors,
        pageExceptions: cdp.pageExceptions,
      })
    }
    assert(ready, 'play.html failed to bootstrap window.__d2PlayApp')

    const viewports = ['800x600', '1280x720'] as const
    for (const viewport of viewports) {
      await cdp.evaluate(`(() => {
        const key = 'd2web.settings.v1';
        const cur = JSON.parse(localStorage.getItem(key) || '{}');
        cur.viewport = ${JSON.stringify(viewport)};
        localStorage.setItem(key, JSON.stringify(cur));
        return true;
      })()`)
      await cdp.send('Page.reload', {})
      let ok = false
      for (let i = 0; i < 160 && !ok; i++) {
        await sleep(250)
        try {
          ok = await cdp.evaluate<boolean>(`Boolean(window.__d2PlayApp && window.__d2PlayApp.ready)`)
        } catch {
          // page reloading
        }
      }
      assert(ok, `play.html failed to bootstrap at ${viewport}`)
      const replayed = await cdp.evaluate<number>(`(async () => {
        const app = window.__d2Play;
        await app.assetsReadyPromise;
        const count = app.replayD2Cap(${JSON.stringify(d2capJsonl)});
        app.renderFrame(performance.now());
        return count;
      })()`)
      console.log(`[verify-icebreak-melt] ${viewport}: replayed ${replayed} packets`)

      const shatter = await cdp.evaluate<any>(`(async () => {
        const app = window.__d2Play;
        const world = app.session.world;
        const px = Math.round(world.self.x);
        const py = Math.round(world.self.y);
        const mk = (id, classId, dx, dy) => world.apply({ type: 'UnitAssign', unit: { unitType: 1, id, classId, x: px + dx, y: py + dy, mode: 1, lifePct: 40, states: [1] } });
        mk(9531, 19, 4, 1);   // fallen-sized
        mk(9532, 66, -3, 4);  // larger monster
        world.apply({ type: 'UnitMode', unitType: 1, id: 9531, mode: 12, lifePct: 0 });
        world.apply({ type: 'UnitMode', unitType: 1, id: 9532, mode: 12, lifePct: 0 });
        for (let i = 0; i < 6; i++) world.tick(40);
        app.renderFrame(performance.now());
        const keys = world.getUnitsByType('missile').map((m) => m.missileKey);
        const { buildSceneDrawables } = await import('/src/client/view/unit-drawables.ts');
        const scene = buildSceneDrawables(app.session.buildRenderableUnits(), { originX: 0, originY: 0, tick: 0 });
        return {
          keys,
          drawables: scene.missileDrawables.map((d) => d.missileKey),
          corpses: scene.unitDrawables.filter((d) => d.id === 9531 || d.id === 9532).length,
        };
      })()`)
      console.log(`[verify-icebreak-melt] ${viewport} shatter:`, shatter)
      assert(shatter.drawables.some((k: string) => k === 'icebreaksmall' || k === 'icebreaklarge'), 'shard drawable')
      assert(shatter.drawables.includes('icebreaksmoke'), 'smoke drawable')
      assert(shatter.corpses === 0, 'shattered corpses must be hidden')
      await cdp.captureScreenshot(join(OUT_DIR, `${viewport}-1-shatter.png`))

      // The page's own game loop also advances the world between CDP calls, so checkpoints are short and only the
      // first one (right after the shards expire) asserts the melt.
      let sawMelt = false
      for (const [label, ticks] of [['2-melt-start', 0], ['3-melt-mid', 3], ['4-melt-late', 20]] as const) {
        const melt = await cdp.evaluate<any>(`(async () => {
          const app = window.__d2Play;
          const world = app.session.world;
          const hasMelt = () => world.getUnitsByType('missile').some((m) => (m.missileKey || '').endsWith('melt'));
          if (${JSON.stringify(label)} === '2-melt-start') {
            for (let i = 0; i < 40 && !hasMelt(); i++) world.tick(40);
          } else {
            for (let i = 0; i < ${ticks}; i++) world.tick(40);
          }
          app.renderFrame(performance.now());
          const { buildSceneDrawables } = await import('/src/client/view/unit-drawables.ts');
          const scene = buildSceneDrawables(app.session.buildRenderableUnits(), { originX: 0, originY: 0, tick: 0 });
          return scene.missileDrawables
            .filter((d) => d.missileKey.startsWith('icebreak'))
            .map((d) => ({ key: d.missileKey, frame: d.frame, dir: d.direction }));
        })()`)
        console.log(`[verify-icebreak-melt] ${viewport} ${label}:`, melt)
        if (melt.some((m: any) => m.key.endsWith('melt'))) sawMelt = true
        await cdp.captureScreenshot(join(OUT_DIR, `${viewport}-${label}.png`))
      }
      assert(sawMelt, `${viewport}: expected an icebreak*melt drawable after the shards expired`)
      const gone = await cdp.evaluate<number>(`(() => {
        const world = window.__d2Play.session.world;
        for (let i = 0; i < 160; i++) world.tick(40);
        return world.getUnitsByType('missile').filter((m) => (m.missileKey || '').startsWith('icebreak')).length;
      })()`)
      assert(gone === 0, 'melt puddles expire after Range 150')
    }
    assert(cdp.pageExceptions.length === 0, `page exceptions: ${cdp.pageExceptions.join('\n')}`)
    assert(cdp.missingArt.length === 0, `missing art: ${cdp.missingArt.join('\n')}`)
    console.log('[verify-icebreak-melt] PASS')
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
  console.error('[verify-icebreak-melt] FATAL:', err)
  process.exit(1)
})
