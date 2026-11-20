#!/usr/bin/env npx tsx
/**
 * Headless Chrome + CDP end-to-end verifier for issue #1007: level entry title (`D2Client.dll` `0x6fb6f0d0`).
 *
 * Replays `11-d2gs-waypoint-teleport.d2cap` into `play.html` in three slices (town, first waypoint teleport,
 * teleport back) and checks on the real HUD canvas that:
 * - the first level of the session shows no title;
 * - every level change shows the baked "Entering ..." title for 120 frames (4.8 s), then hides it;
 * - the title pixels land at the 1.13c position (x = W/2 - (w >> 1) - 1, bottom = H/2 - 0x8c).
 *
 * `VERIFY_PUBLIC_DIR` may point at a public dir that holds the full baked `ui/` (incl. `level-entry-titles.png`).
 * Screenshots go to `scratch/verify-level-entry-title/`.
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
const OUT_DIR = resolve(ROOT_DIR, 'scratch/verify-level-entry-title')

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
  const publicDir = process.env.VERIFY_PUBLIC_DIR ?? resolve(ROOT_DIR, 'public')

  const d2capPath = resolve(ROOT_DIR, 'tests/fixtures/netproto/11-d2gs-waypoint-teleport.d2cap')
  assert(existsSync(d2capPath), `Missing fixture at ${d2capPath}`)
  const d2capJsonl = readFileSync(d2capPath, 'utf8')

  let viteServer: ViteDevServer | null = null
  const userDataDir = mkdtempSync(join(tmpdir(), 'd2-verify-level-entry-title-'))
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
    console.log(`[verify-level-entry-title] Vite server listening at ${targetUrl}`)

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
    console.log('[verify-level-entry-title] Waiting for play.html bootstrap...')
    let ready = false
    for (let i = 0; i < 120; i++) {
      await sleep(250)
      try {
        ready = await cdp.evaluate<boolean>(`Boolean(window.__d2PlayApp && window.__d2PlayApp.ready)`)
        if (ready) break
        if (i % 20 === 0) {
          const loc = await cdp.evaluate<string>(`window.location.href`)
          console.log(`[verify-level-entry-title] Waiting (tick ${i})... loc: ${loc}, consoleErrors: ${cdp.consoleErrors.length}, exceptions: ${cdp.pageExceptions.length}`)
          if (cdp.consoleErrors.length > 0) console.log('  console:', cdp.consoleErrors)
          if (cdp.pageExceptions.length > 0) console.log('  exceptions:', cdp.pageExceptions)
        }
      } catch (err) {
        console.log(`[verify-level-entry-title] eval error at ${i}:`, err)
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

    const lines = d2capJsonl.split('\n').filter((l) => l.trim() !== '')
    const header = lines[0]!
    // Line numbers (1-based) of the two C2S 0x49 waypoint-teleport requests in the capture.
    const firstTeleport = lines.findIndex((l, i) => i > 0 && /"conn":"game","dir":"c2s","hex":"49/.test(l))
    const secondTeleport = lines.findIndex((l, i) => i > firstTeleport + 20 && /"conn":"game","dir":"c2s","hex":"49/.test(l))
    assert(firstTeleport > 0 && secondTeleport > firstTeleport, `teleport packets not found (${firstTeleport}, ${secondTeleport})`)
    const slice = (a: number, b: number): string => [header, ...lines.slice(a, b)].join('\n')
    const sliceTown = slice(1, firstTeleport)
    const sliceTeleport = slice(firstTeleport, secondTeleport)
    const sliceBack = slice(secondTeleport, lines.length)

    // Render frames for `ms` of wall time (25 Hz), like the live loop.
    const pump = async (ms: number): Promise<void> => {
      const end = Date.now() + ms
      while (Date.now() < end) {
        await cdp!.evaluate(`(() => { window.__d2Play.renderFrame(performance.now()); return true })()`)
        await sleep(40)
      }
    }

    const snapshotExpr = (tag: string): string => `(async () => {
      const app = window.__d2Play;
      const hud = app.session.hudManager;
      const title = hud.levelEntryTitle;
      const levelId = hud.worldPanels.currentLevelId;
      const { LEVEL_ENTRY_TITLE_KEY_BY_LEVEL, LEVEL_ENTRY_TITLE_RECTS } = await import('/src/common/world/level-entry-titles-113c.ts');
      const { layoutLevelEntryTitle } = await import('/src/client/ui/level-entry-title.ts');
      const { computeDockingLayout } = await import('/src/client/ui/hud-viewport-layout.ts');
      const key = levelId ? LEVEL_ENTRY_TITLE_KEY_BY_LEVEL[levelId] : null;
      const profile = hud.viewportProfile;
      const canvas = hud.hudCanvas;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssW = Math.max(320, canvas.clientWidth || window.innerWidth);
      const cssH = Math.max(240, canvas.clientHeight || window.innerHeight);
      const dock = computeDockingLayout(cssW, cssH, dpr, profile);
      let opaque = 0, reddish = 0, box = null;
      if (key) {
        const l = layoutLevelEntryTitle(key, profile.width, profile.height);
        const sx = Math.round((dock.offsetX + l.x * dock.uiScale) * dpr);
        const sy = Math.round((dock.offsetY + l.y * dock.uiScale) * dpr);
        const sw = Math.max(1, Math.round(l.width * dock.uiScale * dpr));
        const sh = Math.max(1, Math.round(l.height * dock.uiScale * dpr));
        const px = canvas.getContext('2d').getImageData(sx, sy, sw, sh).data;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] > 0) { opaque++; if (px[i] > px[i + 1] + 8) reddish++; }
        }
        box = { native: l, screen: { sx, sy, sw, sh } };
        window.__lt = window.__lt || {};
        window.__lt['${tag}'] = { key, sx, sy, sw, sh, px: Array.from(px) };
      }
      return {
        levelId,
        lastLevel: title.lastLevel,
        active: title.active,
        key,
        rect: key ? LEVEL_ENTRY_TITLE_RECTS[key] : null,
        atlasLoaded: hud.images.has('levelEntryTitles'),
        profile: { w: profile.width, h: profile.height },
        opaque,
        reddish,
        box,
      };
    })()`

    // ─── Gate 1: first level of the session → no title ───────────────────────
    const replayed = await cdp.evaluate<number>(`(async () => {
      const app = window.__d2Play;
      await app.assetsReadyPromise;
      return app.replayD2Cap(${JSON.stringify(sliceTown)});
    })()`)
    await pump(400)
    const g1 = await cdp.evaluate<any>(snapshotExpr('g1'))
    console.log(`[verify-level-entry-title] Gate 1 (town, ${replayed} records):`, g1)
    assert(g1.atlasLoaded, 'ui/level-entry-titles.png did not load')
    assert(g1.levelId > 0, 'player has no level after the town slice')
    assert(g1.lastLevel === g1.levelId, 'g_nLastLevel did not latch the first level')
    assert(!g1.active, 'first level of the session must not show a title (0x6fbd340c = 0x78)')
    await cdp.captureScreenshot(join(OUT_DIR, '01-town-no-title.png'))

    // ─── Gate 2: waypoint teleport → "Entering ..." for 120 frames ───────────
    await cdp.evaluate(`(() => {
      const s = window.__d2Play.session;
      s.loadD2CapReplay(${JSON.stringify(sliceTeleport)});
      s.replayAllD2Cap();
      return true;
    })()`)
    await pump(600)
    const g2 = await cdp.evaluate<any>(snapshotExpr('g2'))
    console.log('[verify-level-entry-title] Gate 2 (after teleport, ~0.6 s):', g2)
    assert(g2.levelId !== g1.levelId, `teleport did not change the level (${g1.levelId} -> ${g2.levelId})`)
    assert(g2.active, 'level change must start the title')
    assert(g2.box !== null, 'no title layout')
    const cx = Math.trunc(g2.profile.w / 2)
    assert(g2.box.native.x === cx - (g2.rect.w >>> 1) - 1, 'title x is not W/2 - (w >> 1) - 1')
    assert(g2.box.native.y + g2.rect.h === Math.trunc(g2.profile.h / 2) - 0x8c, 'title bottom is not H/2 - 0x8c')
    const shot2 = join(OUT_DIR, '02-teleport-entering-title.png')
    await cdp.captureScreenshot(shot2)

    await pump(4400) // total ≈ 5.0 s > 120 x 40 ms
    const g3 = await cdp.evaluate<any>(snapshotExpr('g3'))
    console.log('[verify-level-entry-title] Gate 3 (after 5 s):', g3)
    assert(!g3.active, 'title must disappear after 120 frames')
    // Same level, same box: the pixels that changed between "title on" and "title expired" are the title.
    const diff = await cdp.evaluate<{ changed: number; changedRed: number; total: number }>(`(() => {
      const a = window.__lt.g2, b = window.__lt.g3;
      if (!a || !b || a.key !== b.key || a.px.length !== b.px.length) return { changed: -1, changedRed: 0, total: 0 };
      let changed = 0, changedRed = 0;
      for (let i = 0; i < a.px.length; i += 4) {
        if (a.px[i] !== b.px[i] || a.px[i + 1] !== b.px[i + 1] || a.px[i + 2] !== b.px[i + 2] || a.px[i + 3] !== b.px[i + 3]) {
          changed++;
          if (a.px[i + 3] > 0 && a.px[i] > a.px[i + 1] + 8) changedRed++;
        }
      }
      return { changed, changedRed, total: a.px.length / 4 };
    })()`)
    console.log('[verify-level-entry-title] title on/off pixel diff:', diff)
    assert(diff.changed > 1000, `title pixels did not change when the title expired: ${JSON.stringify(diff)}`)
    assert(diff.changedRed > diff.changed * 0.6, `title is not drawn with textShifts[1] (red): ${JSON.stringify(diff)}`)
    await cdp.captureScreenshot(join(OUT_DIR, '03-title-expired.png'))

    // ─── Gate 4: teleport back → title again ─────────────────────────────────
    await cdp.evaluate(`(() => {
      const s = window.__d2Play.session;
      s.loadD2CapReplay(${JSON.stringify(sliceBack)});
      s.replayAllD2Cap();
      return true;
    })()`)
    await pump(600)
    const g4 = await cdp.evaluate<any>(snapshotExpr('g4'))
    console.log('[verify-level-entry-title] Gate 4 (teleport back):', g4)
    if (g4.levelId !== g3.levelId) {
      assert(g4.active, 'second level change must show the title again')
    } else {
      console.log('[verify-level-entry-title] capture tail does not change level; gate 4 informational only')
    }
    await cdp.captureScreenshot(join(OUT_DIR, '04-teleport-back-title.png'))

    if (cdp.consoleErrors.length > 0 || cdp.pageExceptions.length > 0) {
      throw new Error(`Unexpected errors: ${JSON.stringify({ console: cdp.consoleErrors, exceptions: cdp.pageExceptions })}`)
    }
    console.log(`[verify-level-entry-title] ALL GATES PASSED. Screenshots in ${OUT_DIR}`)
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
  console.error('[verify-level-entry-title] FATAL:', err)
  process.exit(1)
})
