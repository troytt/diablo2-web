#!/usr/bin/env npx tsx
/**
 * Headless Chrome + CDP visual verifier for issue #1668 (flat 2,500,000 stash gold limit,
 * `D2Common.dll` #11060 @ `0x6FD7E9C0`). Replays a town d2cap, gives the clvl 1 character
 * 10,000 carried / 100,000 stashed gold, opens the stash deposit keypad and checks that the whole
 * 10,000 is offered (the old level-scaled table capped clvl 1 at 50,000). Screens 800x600 / 1280x720.
 * Output dir: `D2W_SHOT_DIR` or `scratch/verify-stash-gold-cap/`.
 * Usage: env -u DISPLAY npx tsx tools/verify-stash-gold-cap-browser.ts
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
const OUT_DIR = resolve(process.env.D2W_SHOT_DIR ?? resolve(ROOT_DIR, 'scratch/verify-stash-gold-cap'))

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
  const userDataDir = mkdtempSync(join(tmpdir(), 'd2-verify-stash-gold-cap-'))
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
    console.log(`[verify-stash-gold-cap] Vite server listening at ${targetUrl}`)

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
    console.log('[verify-stash-gold-cap] Waiting for play.html bootstrap...')
    let ready = false
    for (let i = 0; i < 120; i++) {
      await sleep(250)
      try {
        ready = await cdp.evaluate<boolean>(`Boolean(window.__d2PlayApp && window.__d2PlayApp.ready)`)
        if (ready) break
        if (i % 20 === 0) {
          const loc = await cdp.evaluate<string>(`window.location.href`)
          console.log(`[verify-stash-gold-cap] Waiting (tick ${i})... loc: ${loc}, consoleErrors: ${cdp.consoleErrors.length}, exceptions: ${cdp.pageExceptions.length}`)
          if (cdp.consoleErrors.length > 0) console.log('  console:', cdp.consoleErrors)
          if (cdp.pageExceptions.length > 0) console.log('  exceptions:', cdp.pageExceptions)
        }
      } catch (err) {
        console.log(`[verify-stash-gold-cap] eval error at ${i}:`, err)
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
        window.__d2Play.settingsStore.set({ viewport: ${JSON.stringify(viewport)} });
        return true;
      })()`)
      const replayed = await cdp.evaluate<number>(`(async () => {
        const app = window.__d2Play;
        await app.assetsReadyPromise;
        const count = app.replayD2Cap(${JSON.stringify(d2capJsonl)});
        app.renderFrame(performance.now());
        return count;
      })()`)
      console.log(`[verify-stash-gold-cap] ${viewport}: replayed ${replayed} packets`)

      // clvl 1 character with 10,000 carried and 100,000 stashed opens the stash deposit keypad:
      // 1.13c #11060 caps stash gold at a flat 2,500,000, so the whole 10,000 is depositable.
      const info = await cdp.evaluate<any>(`(async () => {
        const app = window.__d2Play;
        const world = app.session.world;
        const id = world.selfId;
        world.apply({ type: 'UnitStatUpdate', unitType: 'player', unitId: id, statId: 14, value: 10000 });
        world.apply({ type: 'UnitStatUpdate', unitType: 'player', unitId: id, statId: 15, value: 100000 });
        world.npcInteraction.stashOpen = true;
        app.hudModel.syncFromWorld();
        const hud = app.hudManager;
        // Checked synchronously: the replayed player stands outside every Stash object's interact
        // range, so the next frame's range enforcement (#866) closes the panel again.
        hud.showStashPanel();
        hud.rightPanel = 'inv';
        hud.worldPanels.stashGold = 100000;
        if (hud.inventory) hud.inventory.gold = 10000;
        const balance = hud.goldDialogBalance(3);
        hud.openGoldDialog(3);
        const dialog = hud.goldDialog ? { mode: hud.goldDialog.mode, amount: hud.goldDialog.amount } : null;
        app.renderFrame(performance.now());
        return {
          level: world.self.level,
          invGold: hud.inventory?.gold,
          balance,
          stashMax: hud.worldPanels.getStashMaxGold(),
          dialog,
          dialogAfterFrame: Boolean(hud.goldDialog),
          leftPanel: hud.leftPanel,
        };
      })()`)
      console.log(`[verify-stash-gold-cap] ${viewport}:`, info)
      assert(info.stashMax === 2500000, 'stash max is the flat 2,500,000')
      assert(info.dialog && info.dialog.amount === 10000, 'deposit keypad offers the full 10,000')
      await cdp.captureScreenshot(join(OUT_DIR, `${viewport}-stash-deposit.png`))
      await cdp.evaluate(`(() => { const a = window.__d2Play; const h = a.hudManager; h.goldDialog = null; h.leftPanel = 'none'; h.rightPanel = 'none'; a.session.world.npcInteraction.stashOpen = false; return true })()`)
    }
    // Missing baked art depends on the local asset bake (backdrops / overlays); it is reported, not
    // asserted, because this verifier only checks the player GH / BL / KB step speeds.
    if (cdp.missingArt.length > 0) console.warn(`[verify-stash-gold-cap] missing art:\n${cdp.missingArt.join('\n')}`)
    console.log('[verify-stash-gold-cap] PASS')
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
  console.error('[verify-stash-gold-cap] FATAL:', err)
  process.exit(1)
})
