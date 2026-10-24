#!/usr/bin/env npx tsx
/**
 * Headless Chrome CDP verification for issue #924 (D2 1.13c game completion after Baal):
 * - a fake D2GS sends S2C 0x61 07 (D2Game 0x6fc7fde9) to the real play.html session
 * - the client must send C2S 0x48 then leave the game (C2S 0x69), show the victory screen
 *   (D2Client 0x6faf3a70: endgame2.dc6, Font42 lines, endgameok.dc6) and return to the lobby on OK
 * Screenshots go to scratch/verify-end-game/ (or --out <dir>).
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

function parseOutDir(): string {
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--out' && args[i + 1]) return resolve(args[i + 1]!)
    if (arg.startsWith('--out=')) return resolve(arg.slice('--out='.length))
  }
  return resolve(ROOT_DIR, 'scratch/verify-end-game')
}

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
        const type = msg.params?.type
        if (type === 'error') {
          const text = (msg.params?.args ?? [])
            .map((a: any) => a.value ?? a.description ?? '')
            .join(' ')
          if (!text.includes('favicon.ico')) {
            this.consoleErrors.push(text)
          }
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const details = msg.params?.exceptionDetails
        const desc =
          details?.exception?.description ?? details?.text ?? JSON.stringify(details)
        this.pageExceptions.push(String(desc))
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

  async close(): Promise<void> {
    try {
      this.ws.close()
    } catch {
      // ignore
    }
  }
}

async function openNewPageTarget(
  cdpPort: string,
  targetUrl: string,
): Promise<{ readonly id: string; readonly webSocketDebuggerUrl: string }> {
  const res = await fetch(
    `http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(targetUrl)}`,
    { method: 'PUT' },
  )
  if (!res.ok) {
    throw new Error(`Failed to open new tab for ${targetUrl}: HTTP ${res.status}`)
  }
  return (await res.json()) as { id: string; webSocketDebuggerUrl: string }
}

async function run(): Promise<void> {
  const chromeBin = findChromeBinary()
  const outDir = parseOutDir()
  mkdirSync(outDir, { recursive: true })

  const publicDir = process.env.D2W_PUBLIC_DIR
    ? resolve(process.env.D2W_PUBLIC_DIR)
    : resolve(ROOT_DIR, 'public')
  const tilesIndexPath = join(publicDir, 'act-packs/tiles/index.json')
  if (!existsSync(tilesIndexPath)) {
    throw new Error(
      `Missing required packed tiles at ${tilesIndexPath}. Set D2W_PUBLIC_DIR=<path/to/public>`,
    )
  }

  let viteServer: ViteDevServer | null = null
  const userDataDir = mkdtempSync(join(tmpdir(), 'd2-verify-end-game-'))
  let chromeProc: ReturnType<typeof spawn> | null = null
  let playCdp: CdpSession | null = null

  try {
    viteServer = await createServer({
      root: ROOT_DIR,
      publicDir,
      server: {
        host: '127.0.0.1',
        port: 0,
        strictPort: false,
        watch: null,
      },
      logLevel: 'error',
    })
    await viteServer.listen()
    const addr = viteServer.httpServer?.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    if (!port) throw new Error('Failed to start Vite server')

    const playUrl = `http://127.0.0.1:${port}/play.html`
    console.log(`[verify-end-game] Vite server listening at http://127.0.0.1:${port}`)

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
        '--window-size=1440,960',
        `--user-data-dir=${userDataDir}`,
        '--remote-debugging-port=0',
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )

    let cdpPort: string | null = null
    for (let i = 0; i < 100; i++) {
      await sleep(150)
      try {
        const raw = readFileSync(join(userDataDir, 'DevToolsActivePort'), 'utf8')
        const firstLine = raw.trim().split('\n')[0]
        if (firstLine) {
          cdpPort = firstLine
          break
        }
      } catch {
        // wait
      }
    }
    if (!cdpPort) throw new Error('Chrome failed to start DevToolsActivePort')

    let pageTarget: { readonly url: string; readonly webSocketDebuggerUrl: string } | null = null
    for (let i = 0; i < 120; i++) {
      await sleep(150)
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json`)
        const list = (await res.json()) as any[]
        const pages = list.filter((p) => p.type === 'page')
        if (pages.length > 0 && pages[0]) {
          pageTarget = pages[0]
          break
        }
      } catch {
        // wait
      }
    }
    if (!pageTarget) throw new Error('Failed to attach to page target in headless Chrome')

    playCdp = await CdpSession.connect(pageTarget.webSocketDebuggerUrl)
    await playCdp.send('Page.navigate', { url: playUrl })

    for (let i = 0; i < 300; i++) {
      await sleep(200)
      const ready = await playCdp.evaluate<boolean>(
        'Boolean(window.__d2PlayApp && window.__d2PlayApp.ready)',
      )
      if (ready) break
    }
    const playReady = await playCdp.evaluate<boolean>(
      'Boolean(window.__d2PlayApp && window.__d2PlayApp.ready)',
    )
    if (!playReady) {
      console.error('[verify-end-game] console errors:', JSON.stringify(playCdp.consoleErrors))
      console.error('[verify-end-game] page exceptions:', JSON.stringify(playCdp.pageExceptions))
    }
    assert(playReady, 'play.html __d2PlayApp failed to reach ready=true')

    // Issue #924: S2C 0x61 07 (D2Game 0x6fc7fde9 after Baal's portal) must end the game exactly like
    // D2Client 0x6fb399a0(7): C2S 0x48, C2S 0x69 LeaveGame, then the victory screen 0x6faf3a70, then the lobby.
    await playCdp.evaluate(`(async () => {
      const app = window.__d2PlayApp;
      const session = app.session;
      const log = (window.__d2EndGameLog = { sent: [], leaves: 0 });
      session.selectedCharValue = 'Hero';
      session.charactersValue = [{
        name: 'Hero', charClass: 4, level: 90, hardcore: false, dead: false, expansion: true, ladder: false,
        act: 5, difficulty: 2, progression: 10, expiresAt: 0,
        equipmentGraphics: new Uint8Array(9), rawStatString: new Uint8Array(33),
      }];
      // Live-flow stand-in: leaveToLobby is where the real flow sends C2S 0x69 (D2gsSession.leaveAndClose).
      session.flow = {
        state: 'ingame',
        leaveToLobby: async () => { log.leaves++; log.sent.push('LeaveGame'); },
        close: async () => {},
      };
      let emit = null;
      session.attachGameServer({
        isConnected: true,
        stats: { packetsIn: 0, packetsOut: 0, bytesIn: 0, bytesOut: 0, rttMs: 12, unknownPackets: 0 },
        connect: async () => {},
        disconnect: () => {},
        send: (cmd) => { log.sent.push(cmd.type); },
        onEvent: (cb) => { emit = cb; return () => { emit = null; }; },
      });
      window.__d2EmitEndGame = (ev) => emit && emit(ev);
    })()`)

    for (let i = 0; i < 100; i++) {
      await sleep(100)
      if (await playCdp.evaluate<boolean>('window.__d2PlayApp.isInGameView()')) break
    }
    assert(await playCdp.evaluate<boolean>('window.__d2PlayApp.isInGameView()'), 'fake game never entered the in-game view')

    await playCdp.evaluate(`(() => {
      const emit = window.__d2EmitEndGame;
      emit({ type: 'GameFlags', difficulty: 2, unknown1: 0, hardcore: false, expansion: true, ladder: false });
      emit({ type: 'LoadAct', act: 4, mapSeed: 0x11223344, areaId: 109 });
      emit({ type: 'UnitAssign', isSelf: true, unit: { unitType: 0, id: 1, classId: 4, name: 'Hero', x: 5000, y: 5000 } });
      emit({ type: 'CanGoToAct', act: 7 });
    })()`)

    let stage = ''
    for (let i = 0; i < 100; i++) {
      await sleep(100)
      stage = await playCdp.evaluate<string>('window.__d2PlayApp.flowState.stage')
      if (stage === 'end_game') break
    }
    assert(stage === 'end_game', `expected the victory screen after S2C 0x61 07, got stage "${stage}"`)
    const afterLeave = await playCdp.evaluate<{ sent: string[]; leaves: number; endGame: unknown; inGame: boolean }>(`(() => ({
      sent: window.__d2EndGameLog.sent,
      leaves: window.__d2EndGameLog.leaves,
      endGame: window.__d2PlayApp.flowState.endGame,
      inGame: window.__d2PlayApp.isInGameView(),
    }))()`)
    console.log('[verify-end-game] after 61 07:', JSON.stringify(afterLeave))
    assert(
      JSON.stringify(afterLeave.sent) === JSON.stringify(['CancelController', 'LeaveGame']),
      `expected C2S 0x48 then 0x69, got ${JSON.stringify(afterLeave.sent)}`,
    )
    assert(afterLeave.leaves === 1, 'expected exactly one LeaveGame')
    assert(!afterLeave.inGame, 'the in-game view must be gone after leaving')
    assert(
      JSON.stringify(afterLeave.endGame) ===
        JSON.stringify({ nameLine: 'Hero', titleLine: 'Patriarch Hero', pressed: false }),
      `unexpected victory screen state ${JSON.stringify(afterLeave.endGame)}`,
    )

    await sleep(500)
    const shot1 = join(outDir, '01-victory-screen.png')
    console.log(`[verify-end-game] Captured ${shot1} (${await playCdp.captureScreenshot(shot1)} bytes)`)

    // Press OK (0x6faf2f00): pressed frame + shifted label.
    await playCdp.evaluate('window.__d2PlayApp.frontendRenderer.handleMouseDown(400, 504)')
    await sleep(300)
    const shot2 = join(outDir, '02-victory-ok-pressed.png')
    console.log(`[verify-end-game] Captured ${shot2} (${await playCdp.captureScreenshot(shot2)} bytes)`)
    // Release inside (0x6faf2e70) → lobby.
    await playCdp.evaluate('window.__d2PlayApp.frontendRenderer.handleMouseUp(400, 504)')
    for (let i = 0; i < 50; i++) {
      await sleep(100)
      stage = await playCdp.evaluate<string>('window.__d2PlayApp.flowState.stage')
      if (stage === 'bnet_lobby') break
    }
    assert(stage === 'bnet_lobby', `expected the lobby after OK, got "${stage}"`)
    await sleep(300)
    const shot3 = join(outDir, '03-lobby-after-ok.png')
    console.log(`[verify-end-game] Captured ${shot3} (${await playCdp.captureScreenshot(shot3)} bytes)`)

    assert(
      playCdp.consoleErrors.length === 0,
      `play.html had console errors: ${JSON.stringify(playCdp.consoleErrors)}`,
    )
    assert(
      playCdp.pageExceptions.length === 0,
      `play.html had uncaught page exceptions: ${JSON.stringify(playCdp.pageExceptions)}`,
    )
    console.log('[verify-end-game] ALL ASSERTIONS PASSED (0 console errors, 0 page exceptions)')
  } finally {
    await playCdp?.close()
    if (chromeProc && !chromeProc.killed) {
      chromeProc.kill('SIGKILL')
    }
    if (viteServer) {
      await viteServer.close()
    }
    try {
      rmSync(userDataDir, { recursive: true, force: true })
    } catch {
      // Chrome can still be writing its profile right after SIGKILL; never mask the real result.
    }
  }
}

run().catch((err) => {
  console.error('[verify-end-game] FAILED:', err)
  process.exit(1)
})
