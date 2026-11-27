#!/usr/bin/env npx tsx
/**
 * [K5] Single-Player & Multi-Resolution (`800x600` / `1068x600` / `1280x720`) Headless Browser E2E Verifier.
 *
 * Connects via Chrome DevTools Protocol (CDP) to `http://localhost:8080/play.html` (or falls back to an
 * ephemeral local Vite server if port 8080 is not running), enters Single-Player Act 1 Rogue Encampment,
 * and verifies full boot, WebGL2 world rendering, HUD control bar & dock panels, genuine walk movement,
 * and zero uncaught console/page errors across 4:3 (`800x600`) and widescreen (`1068x600`, `1280x720`).
 *
 * All output PNGs are stripped of ancillary/metadata chunks (`tEXt`, `zTXt`, `iTXt`, `eXIf`, `c2pa`, `caBX`, `tIME`).
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'
import { findChromeBinary } from '../../find-chrome.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const ALLOWED_PNG_CHUNKS = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND'])

export type K5ViewportId = '800x600' | '1068x600' | '1280x720'
export type K5SinglePlayerBackend = 'legacy' | 'd2kern-113c'

export interface StrippedPngInfo {
  readonly cleanPng: Uint8Array
  readonly width: number
  readonly height: number
  readonly droppedChunks: readonly string[]
}

/**
 * Strips all ancillary/metadata chunks (`eXIf`, `c2pa`, `caBX`, `tEXt`, `zTXt`, `iTXt`, `tIME`, `pHYs`, etc.)
 * from a PNG buffer, retaining only critical image chunks (`IHDR`, `PLTE`, `tRNS`, `IDAT`, `IEND`).
 */
export function stripPngAncillaryChunks(rawPng: Uint8Array): StrippedPngInfo {
  if (rawPng.byteLength < 33) {
    throw new Error(`Invalid PNG buffer: length ${rawPng.byteLength} < 33`)
  }
  for (let i = 0; i < 8; i++) {
    if (rawPng[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Invalid PNG signature')
    }
  }

  const dv = new DataView(rawPng.buffer, rawPng.byteOffset, rawPng.byteLength)
  const keptSlices: Uint8Array[] = [rawPng.subarray(0, 8)]
  const droppedChunks: string[] = []
  let width = 0
  let height = 0
  let offset = 8
  let sawIhdr = false
  let sawIend = false

  while (offset + 12 <= rawPng.byteLength) {
    const length = dv.getUint32(offset, false)
    const totalChunkBytes = 12 + length
    if (offset + totalChunkBytes > rawPng.byteLength) {
      throw new Error(`Truncated PNG chunk at offset ${offset}`)
    }
    const type = String.fromCharCode(
      rawPng[offset + 4]!,
      rawPng[offset + 5]!,
      rawPng[offset + 6]!,
      rawPng[offset + 7]!,
    )
    if (type === 'IHDR') {
      if (length < 8) throw new Error('Invalid IHDR length')
      width = dv.getUint32(offset + 8, false)
      height = dv.getUint32(offset + 12, false)
      sawIhdr = true
    }
    if (ALLOWED_PNG_CHUNKS.has(type)) {
      keptSlices.push(rawPng.subarray(offset, offset + totalChunkBytes))
    } else {
      droppedChunks.push(type)
    }
    offset += totalChunkBytes
    if (type === 'IEND') {
      sawIend = true
      break
    }
  }

  if (!sawIhdr || !sawIend || width <= 0 || height <= 0) {
    throw new Error(`Incomplete PNG stream (sawIhdr=${sawIhdr}, sawIend=${sawIend})`)
  }

  let totalLen = 0
  for (const s of keptSlices) totalLen += s.byteLength
  const cleanPng = new Uint8Array(totalLen)
  let pos = 0
  for (const s of keptSlices) {
    cleanPng.set(s, pos)
    pos += s.byteLength
  }

  return { cleanPng, width, height, droppedChunks }
}

export interface K5ScreenshotArtifact {
  readonly fileName: string
  readonly filePath: string
  readonly byteLength: number
  readonly pngWidth: number
  readonly pngHeight: number
  readonly droppedChunks: readonly string[]
}

export interface K5ResolutionAudit {
  readonly viewport: K5ViewportId
  readonly expectedWidth: number
  readonly expectedHeight: number
  readonly viewCanvasWidth: number
  readonly viewCanvasHeight: number
  readonly hudCanvasWidth: number
  readonly hudCanvasHeight: number
  readonly barOffsetX: number
  readonly barOffsetY: number
  readonly panelOffsetY: number
  readonly webglNonBlackRatio: number
  readonly hudBarOpaquePixels: number
  readonly hudPanelsOpaquePixels: number
  readonly panelsToggled: readonly string[]
  readonly startPos: { readonly x: number; readonly y: number }
  readonly endPos: { readonly x: number; readonly y: number }
  readonly movedDistanceSubtiles: number
  readonly moveCommandsSent: number
  readonly missingArtCount: number
}

export interface K5BrowserE2eResult {
  readonly targetUrl: string
  readonly usedLiveServer8080: boolean
  readonly bootProgressPercent: number
  readonly singlePlayerEnabled: boolean
  readonly singlePlayerBackend: K5SinglePlayerBackend
  readonly heroName: string
  readonly areaId: number
  readonly act: number
  readonly resolutions: readonly K5ResolutionAudit[]
  readonly screenshots: readonly K5ScreenshotArtifact[]
  readonly consoleErrors: readonly string[]
  readonly pageExceptions: readonly string[]
}

export interface K5BrowserE2eOptions {
  readonly targetUrl?: string | undefined
  readonly outDir?: string | undefined
  readonly singlePlayerBackend?: K5SinglePlayerBackend | undefined
  readonly forceLocalWorktreeServer?: boolean | undefined
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

class K5CdpClient {
  private readonly ws: WebSocket
  private readonly singlePlayerBackend: K5SinglePlayerBackend | undefined
  private msgId = 0
  private readonly pending = new Map<
    number,
    { readonly resolve: (val: unknown) => void; readonly reject: (err: Error) => void }
  >()
  readonly consoleErrors: string[] = []
  readonly pageExceptions: string[] = []

  private constructor(ws: WebSocket, singlePlayerBackend?: K5SinglePlayerBackend) {
    this.ws = ws
    this.singlePlayerBackend = singlePlayerBackend
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as {
        id?: number
        result?: unknown
        error?: { message?: string }
        method?: string
        params?: Record<string, unknown>
      }
      if (typeof msg.id === 'number') {
        const entry = this.pending.get(msg.id)
        if (entry) {
          this.pending.delete(msg.id)
          if (msg.error) {
            entry.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)))
          } else {
            entry.resolve(msg.result)
          }
        }
        return
      }
      if (msg.method === 'Fetch.requestPaused') {
        const reqId = String(msg.params?.requestId ?? '')
        if (reqId) {
          const cfgPayload = this.singlePlayerBackend
            ? { singlePlayerEnabled: true, singlePlayerBackend: this.singlePlayerBackend }
            : { singlePlayerEnabled: true }
          const bodyB64 = Buffer.from(JSON.stringify(cfgPayload), 'utf8').toString('base64')
          void this.send('Fetch.fulfillRequest', {
            requestId: reqId,
            responseCode: 200,
            responseHeaders: [
              { name: 'Content-Type', value: 'application/json; charset=utf-8' },
              { name: 'Cache-Control', value: 'no-store' },
            ],
            body: bodyB64,
          }).catch(() => {})
        }
        return
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        const params = msg.params as {
          type?: string
          args?: readonly { value?: unknown; description?: string }[]
        }
        if (params?.type === 'error') {
          const text = (params.args ?? [])
            .map((a) => String(a.value ?? a.description ?? ''))
            .join(' ')
          if (!text.includes('favicon.ico')) {
            this.consoleErrors.push(text)
          }
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const details = (msg.params as {
          exceptionDetails?: { exception?: { description?: string }; text?: string }
        })?.exceptionDetails
        const desc =
          details?.exception?.description ?? details?.text ?? JSON.stringify(details)
        this.pageExceptions.push(String(desc))
      }
    }
  }

  static async connect(
    wsUrl: string,
    singlePlayerBackend?: K5SinglePlayerBackend,
  ): Promise<K5CdpClient> {
    const ws = new WebSocket(wsUrl)
    await new Promise<void>((resolveP, rejectP) => {
      ws.onopen = () => resolveP()
      ws.onerror = (err) => rejectP(new Error(`CDP WebSocket error: ${String(err)}`))
    })
    const client = new K5CdpClient(ws, singlePlayerBackend)
    await client.send('Runtime.enable')
    await client.send('Page.enable')
    await client.send('Fetch.enable', {
      patterns: [{ urlPattern: '*site-config.json*', requestStage: 'Request' }],
    })
    return client
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.msgId
    return new Promise((resolveP, rejectP) => {
      this.pending.set(id, { resolve: resolveP, reject: rejectP })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate<T = unknown>(expression: string): Promise<T> {
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

  async setViewportSize(width: number, height: number): Promise<void> {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    })
  }

  async captureCleanPng(outDir: string, fileName: string): Promise<K5ScreenshotArtifact> {
    const shot = await this.send('Page.captureScreenshot', { format: 'png' })
    const b64 = shot?.data
    if (typeof b64 !== 'string' || b64.length === 0) {
      throw new Error(`Empty PNG data from Page.captureScreenshot for ${fileName}`)
    }
    const rawBuf = new Uint8Array(Buffer.from(b64, 'base64'))
    const stripped = stripPngAncillaryChunks(rawBuf)
    mkdirSync(outDir, { recursive: true })
    const filePath = join(outDir, fileName)
    writeFileSync(filePath, stripped.cleanPng)
    return {
      fileName,
      filePath,
      byteLength: stripped.cleanPng.byteLength,
      pngWidth: stripped.width,
      pngHeight: stripped.height,
      droppedChunks: stripped.droppedChunks,
    }
  }

  close(): void {
    try {
      this.ws.close()
    } catch {
      // Ignore close error
    }
  }
}

async function isUrlReachable(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2500)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(t)
    return res.ok
  } catch {
    return false
  }
}

const TARGET_VIEWPORTS: readonly {
  readonly id: K5ViewportId
  readonly width: number
  readonly height: number
  readonly barOffsetX: number
  readonly barOffsetY: number
  readonly panelOffsetY: number
}[] = [
  { id: '800x600', width: 800, height: 600, barOffsetX: 0, barOffsetY: 0, panelOffsetY: 0 },
  { id: '1068x600', width: 1068, height: 600, barOffsetX: 134, barOffsetY: 0, panelOffsetY: 0 },
  { id: '1280x720', width: 1280, height: 720, barOffsetX: 240, barOffsetY: 120, panelOffsetY: 60 },
] as const

export async function runK5BrowserMultiresE2e(
  options?: K5BrowserE2eOptions,
): Promise<K5BrowserE2eResult> {
  const chromeBin = findChromeBinary()
  const outDir =
    options?.outDir ??
    process.env.D2_K5_SCREENSHOT_DIR ??
    join(tmpdir(), 'd2w-k5-screenshots')
  mkdirSync(outDir, { recursive: true })

  const preferredUrl =
    options?.targetUrl ??
    process.env.D2_PLAY_URL ??
    'http://localhost:8080/play.html'

  const envBackend = process.env.D2_SINGLE_PLAYER_BACKEND?.trim().toLowerCase()
  const requestedBackend: K5SinglePlayerBackend | undefined =
    options?.singlePlayerBackend ??
    (envBackend === 'd2kern-113c'
      ? 'd2kern-113c'
      : envBackend === 'legacy'
        ? 'legacy'
        : undefined)

  const prevPublicDirEnv = process.env.D2_VITE_PUBLIC_DIR
  const prevBackendEnv = process.env.VITE_SINGLE_PLAYER_BACKEND

  let viteServer: ViteDevServer | null = null
  let targetUrl = preferredUrl
  let usedLiveServer8080 = options?.forceLocalWorktreeServer
    ? false
    : await isUrlReachable(preferredUrl)

  if (!usedLiveServer8080) {
    process.env.VITE_ENABLE_SINGLE_PLAYER = 'true'
    if (requestedBackend) {
      process.env.VITE_SINGLE_PLAYER_BACKEND = requestedBackend
    }
    let resolvedPublicDir: string | undefined
    if (!existsSync(join(REPO_ROOT, 'public', 'asset-manifest.json'))) {
      const homeRepoPublic = join(homedir(), 'diablo2-web', 'public')
      if (existsSync(join(homeRepoPublic, 'asset-manifest.json'))) {
        resolvedPublicDir = homeRepoPublic
        process.env.D2_VITE_PUBLIC_DIR = homeRepoPublic
      }
    }
    viteServer = await createServer({
      root: REPO_ROOT,
      ...(resolvedPublicDir ? { publicDir: resolvedPublicDir } : {}),
      server: { host: '127.0.0.1', port: 0, strictPort: false },
      logLevel: 'error',
    })
    await viteServer.listen()
    const addr = viteServer.httpServer?.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    if (!port) {
      throw new Error('Failed to start fallback Vite dev server for K5 browser E2E')
    }
    targetUrl = `http://127.0.0.1:${port}/play.html`
  }

  const userDataDir = mkdtempSync(join(tmpdir(), 'd2w-k5-chrome-'))
  let chromeProc: ReturnType<typeof spawn> | null = null
  let cdp: K5CdpClient | null = null

  try {
    const chromeEnv: NodeJS.ProcessEnv = { ...process.env }
    delete chromeEnv.DISPLAY
    delete chromeEnv.WAYLAND_DISPLAY
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
        '--disable-component-extensions-with-background-pages',
        '--no-first-run',
        '--no-default-browser-check',
        '--mute-audio',
        '--force-device-scale-factor=1',
        '--window-size=1280,752',
        `--user-data-dir=${userDataDir}`,
        '--remote-debugging-port=0',
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'], env: chromeEnv },
    )

    let chromeStderr = ''
    chromeProc.stderr?.on('data', (chunk: Buffer) => {
      chromeStderr += chunk.toString()
    })

    let cdpPort: string | null = null
    for (let i = 0; i < 100; i++) {
      await sleep(150)
      const portFile = join(userDataDir, 'DevToolsActivePort')
      if (existsSync(portFile)) {
        const firstLine = readFileSync(portFile, 'utf8').trim().split('\n')[0]
        if (firstLine) {
          cdpPort = firstLine
          break
        }
      }
    }
    if (!cdpPort) {
      throw new Error(`Chrome failed to expose DevToolsActivePort: ${chromeStderr.slice(-400)}`)
    }

    let pageWsUrl: string | null = null
    for (let i = 0; i < 100; i++) {
      await sleep(150)
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json`)
        const targets = (await res.json()) as {
          readonly type: string
          readonly webSocketDebuggerUrl?: string
        }[]
        const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
        if (page?.webSocketDebuggerUrl) {
          pageWsUrl = page.webSocketDebuggerUrl
          break
        }
      } catch {
        // Poll until DevTools HTTP endpoint responds
      }
    }
    if (!pageWsUrl) {
      throw new Error('Failed to discover Chrome page target WebSocket URL')
    }

    cdp = await K5CdpClient.connect(pageWsUrl, requestedBackend)
    // Set initial 800x600 stage + 32px toolbar = 800x632
    await cdp.setViewportSize(800, 632)
    await cdp.send('Page.navigate', { url: targetUrl })

    // 1. Wait for full boot of play.html
    let booted = false
    for (let i = 0; i < 180; i++) {
      const state = await cdp.evaluate<{ ready: boolean } | null>(
        `window.__d2Play ? { ready: Boolean(window.__d2Play.ready) } : null`,
      )
      if (state?.ready) {
        booted = true
        break
      }
      await sleep(200)
    }
    if (!booted) {
      const diag = await cdp.evaluate(
        `({ bootError: window.__d2BootError ?? null, hasPlay: Boolean(window.__d2Play) })`,
      )
      throw new Error(`Timed out waiting for play.html boot: ${JSON.stringify(diag)}`)
    }

    const bootState = await cdp.evaluate<{
      bootProgressPercent: number
      singlePlayerEnabled: boolean
      stage: string
      bnetNonBlackPixels: number
      hasWebGL2: boolean
    }>(`(() => {
      const app = window.__d2Play;
      app.settings.update({ viewport: '800x600' });
      app.renderFrame(performance.now());
      const bp = window.__d2BootProgress ?? app.bootProgress;
      const bnetCanvas = document.getElementById('bnet-canvas');
      let bnetNonBlackPixels = 0;
      if (bnetCanvas instanceof HTMLCanvasElement) {
        const ctx = bnetCanvas.getContext('2d');
        if (ctx) {
          const img = ctx.getImageData(0, 0, bnetCanvas.width, bnetCanvas.height).data;
          for (let i = 0; i < img.length; i += 16) {
            if (img[i] > 8 || img[i + 1] > 8 || img[i + 2] > 8) bnetNonBlackPixels++;
          }
        }
      }
      const view = document.getElementById('view');
      const gl = view instanceof HTMLCanvasElement ? view.getContext('webgl2') : null;
      return {
        bootProgressPercent: bp ? bp.percent : 0,
        singlePlayerEnabled: Boolean(app.flowState.singlePlayerEnabled),
        stage: app.flowState.stage,
        bnetNonBlackPixels,
        hasWebGL2: Boolean(gl),
      };
    })()`)

    if (
      bootState.bootProgressPercent !== 100 ||
      !bootState.singlePlayerEnabled ||
      bootState.stage !== 'main_menu' ||
      !bootState.hasWebGL2 ||
      bootState.bnetNonBlackPixels < 5000
    ) {
      throw new Error(`Boot verification failed: ${JSON.stringify(bootState)}`)
    }

    const screenshots: K5ScreenshotArtifact[] = []
    screenshots.push(await cdp.captureCleanPng(outDir, '01-main-menu-800x600.png'))

    // 2. Enter Single Player -> Create Character -> Enter Act 1 Rogue Encampment
    const heroName = 'K5Hero'
    const townEntry = await cdp.evaluate<{
      playMode: string
      flowStage: string
      sessionPhase: string
      activeBackend: K5SinglePlayerBackend
      act: number
      areaId: number
      selfId: number
      selfX: number
      selfY: number
      loadedTilePages: number
      floorQuadsCount: number
      unitDrawablesCount: number
      missingArtCount: number
    }>(`(async () => {
      const app = window.__d2Play;
      const fr = app.frontendRenderer;
      const st = app.flowState;

      const spBtn = fr.getActiveButtons().find((b) => b.id === 'single_player');
      if (!spBtn || spBtn.disabled) {
        throw new Error('Single Player button missing or disabled on main_menu');
      }
      spBtn.onClick();
      for (let i = 0; i < 10; i++) {
        app.renderFrame(performance.now() + i * 40);
        await new Promise((r) => setTimeout(r, 40));
      }

      // Create or select Single-Player hero
      let idx = st.roster.findIndex((c) => c.name.toLowerCase() === ${JSON.stringify(heroName.toLowerCase())});
      if (idx >= 0 && fr.asyncHandlers?.onSelectCharacter) {
        st.selectedSlotIndex = idx;
        await fr.asyncHandlers.onSelectCharacter(st);
      } else {
        st.stage = 'char_create';
        st.selectedClass = 'so';
        st.charName = ${JSON.stringify(heroName)};
        st.isExpansion = true;
        st.isHardcore = false;
        st.isLadder = false;
        if (!fr.asyncHandlers?.onCreateCharacter) {
          throw new Error('onCreateCharacter handler missing');
        }
        await fr.asyncHandlers.onCreateCharacter(st);
      }

      await app.assetsReadyPromise;
      for (let i = 0; i < 45; i++) {
        app.renderFrame(performance.now() + i * 40);
        await new Promise((r) => setTimeout(r, 60));
        if (
          app.session.phase === 'ingame' &&
          app.session.world.selfId > 0 &&
          app.session.world.areaId === 1 &&
          app.tileGpuCache.loadedPageCount > 0
        ) {
          break;
        }
      }
      if (app.entityArtCache?.waitForInflight) {
        await app.entityArtCache.waitForInflight();
      }
      for (let i = 0; i < 8; i++) {
        app.renderFrame(performance.now() + 2500 + i * 40);
        await new Promise((r) => setTimeout(r, 40));
      }
      if (app.entityArtCache?.waitForInflight) {
        await app.entityArtCache.waitForInflight();
        app.renderFrame(performance.now() + 3000);
      }

      const snap = app.getLastRenderSnapshot();
      const missingArt = Array.isArray(window.__d2MissingArt) ? window.__d2MissingArt : [];
      const rawBackend = typeof app.getSinglePlayerBackend === 'function' ? app.getSinglePlayerBackend() : 'legacy';
      const adapterKind = app.session?.gameAdapter?.kind ?? null;
      const activeBackend =
        adapterKind === 'd2kern-113c'
          ? 'd2kern-113c'
          : adapterKind === 'ts'
            ? 'legacy'
            : rawBackend === 'd2kern-113c'
              ? 'd2kern-113c'
              : 'legacy';
      return {
        playMode: st.playMode,
        flowStage: st.stage,
        sessionPhase: app.session.phase,
        activeBackend,
        act: app.session.world.act,
        areaId: app.session.world.areaId,
        selfId: app.session.world.selfId,
        selfX: app.session.world.self.x,
        selfY: app.session.world.self.y,
        loadedTilePages: app.tileGpuCache.loadedPageCount,
        floorQuadsCount: snap ? snap.floorQuads.length : 0,
        unitDrawablesCount: snap ? snap.entities.unitDrawables.length : 0,
        missingArtCount: missingArt.length,
      };
    })()`)

    if (
      townEntry.playMode !== 'single' ||
      townEntry.flowStage !== 'in_game' ||
      townEntry.sessionPhase !== 'ingame' ||
      townEntry.areaId !== 1 ||
      townEntry.selfId <= 0 ||
      townEntry.loadedTilePages <= 0 ||
      townEntry.floorQuadsCount <= 0 ||
      townEntry.unitDrawablesCount <= 0 ||
      (requestedBackend !== undefined && townEntry.activeBackend !== requestedBackend)
    ) {
      throw new Error(`Single-Player town entry failed: ${JSON.stringify(townEntry)}`)
    }

    // 3. Multi-Resolution Town + HUD + Panels + Walk Audit (800x600, 1068x600, 1280x720)
    const resolutions: K5ResolutionAudit[] = []

    for (const spec of TARGET_VIEWPORTS) {
      // +32px top toolbar height so #d2-stage receives exact 1:1 spec.width x spec.height
      await cdp.setViewportSize(spec.width, spec.height + 32)
      await sleep(100)

      const townSnap = await cdp.evaluate<{
        viewCanvasWidth: number
        viewCanvasHeight: number
        hudCanvasWidth: number
        hudCanvasHeight: number
        webglNonBlackRatio: number
        hudBarOpaquePixels: number
      }>(`(async () => {
        const app = window.__d2Play;
        app.hudModel.closeAllPanels();
        if (app.hudModel.getSnapshot().panels.escapeMenu) {
          app.hudModel.togglePanel('escapeMenu');
        }
        app.settings.update({ viewport: ${JSON.stringify(spec.id)} });
        window.dispatchEvent(new Event('resize'));
        const hudCanvas = document.getElementById('d2-hud-canvas');
        let hudBarOpaquePixels = 0;
        for (let i = 0; i < 25; i++) {
          app.renderFrame(performance.now() + i * 40);
          if (hudCanvas instanceof HTMLCanvasElement) {
            const ctx = hudCanvas.getContext('2d');
            if (ctx) {
              const barY = Math.max(0, hudCanvas.height - 56);
              const barData = ctx.getImageData(0, barY, hudCanvas.width, hudCanvas.height - barY).data;
              hudBarOpaquePixels = 0;
              for (let j = 3; j < barData.length; j += 4) {
                if (barData[j] > 32) hudBarOpaquePixels++;
              }
              if (i >= 4 && hudBarOpaquePixels >= 1000) {
                break;
              }
            }
          }
          await new Promise((r) => setTimeout(r, 40));
        }

        const viewCanvas = document.getElementById('view');
        const gl = viewCanvas instanceof HTMLCanvasElement ? viewCanvas.getContext('webgl2') : null;
        let webglNonBlackRatio = 0;
        if (gl && viewCanvas instanceof HTMLCanvasElement) {
          app.renderFrame(performance.now() + 1200);
          const w = viewCanvas.width;
          const h = viewCanvas.height;
          const buf = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          let nonBlack = 0;
          for (let i = 0; i < buf.length; i += 4) {
            if (buf[i] > 10 || buf[i + 1] > 10 || buf[i + 2] > 12) nonBlack++;
          }
          webglNonBlackRatio = w * h > 0 ? nonBlack / (w * h) : 0;
        }

        return {
          viewCanvasWidth: viewCanvas instanceof HTMLCanvasElement ? viewCanvas.width : 0,
          viewCanvasHeight: viewCanvas instanceof HTMLCanvasElement ? viewCanvas.height : 0,
          hudCanvasWidth: hudCanvas instanceof HTMLCanvasElement ? hudCanvas.width : 0,
          hudCanvasHeight: hudCanvas instanceof HTMLCanvasElement ? hudCanvas.height : 0,
          webglNonBlackRatio: Number(webglNonBlackRatio.toFixed(4)),
          hudBarOpaquePixels,
        };
      })()`)

      screenshots.push(await cdp.captureCleanPng(outDir, `02-sp-town-${spec.id}.png`))

      // Open Character + Inventory dual-dock panels and verify panel rendering
      const panelSnap = await cdp.evaluate<{
        panelsToggled: string[]
        hudPanelsOpaquePixels: number
      }>(`(async () => {
        const app = window.__d2Play;
        const allPanels = ['inventory', 'character', 'skillTree', 'questLog', 'party', 'escapeMenu'];
        const panelsToggled = [];
        for (const p of allPanels) {
          const before = Boolean(app.hudModel.getSnapshot().panels[p]);
          app.hudModel.togglePanel(p);
          const after = Boolean(app.hudModel.getSnapshot().panels[p]);
          if (after !== before) panelsToggled.push(p);
          if (app.hudModel.getSnapshot().panels[p]) {
            app.hudModel.togglePanel(p);
          }
        }

        app.hudModel.closeAllPanels();
        app.hudModel.togglePanel('character');
        app.hudModel.togglePanel('inventory');
        for (let i = 0; i < 6; i++) {
          app.renderFrame(performance.now() + i * 40);
          await new Promise((r) => setTimeout(r, 30));
        }
        if (app.entityArtCache?.waitForInflight) {
          await app.entityArtCache.waitForInflight();
          app.renderFrame(performance.now() + 300);
        }

        let hudPanelsOpaquePixels = 0;
        const hudCanvas = document.getElementById('d2-hud-canvas');
        if (hudCanvas instanceof HTMLCanvasElement) {
          const ctx = hudCanvas.getContext('2d');
          if (ctx) {
            const upperH = Math.max(1, hudCanvas.height - 56);
            const imgData = ctx.getImageData(0, 0, hudCanvas.width, upperH).data;
            for (let i = 3; i < imgData.length; i += 4) {
              if (imgData[i] > 32) hudPanelsOpaquePixels++;
            }
          }
        }
        return { panelsToggled, hudPanelsOpaquePixels };
      })()`)

      screenshots.push(await cdp.captureCleanPng(outDir, `03-sp-panels-${spec.id}.png`))

      // Close panels and verify genuine walk / movement across town subtiles
      const walkSnap = await cdp.evaluate<{
        startPos: { x: number; y: number }
        endPos: { x: number; y: number }
        movedDistanceSubtiles: number
        moveCommandsSent: number
        missingArtCount: number
      }>(`(async () => {
        const app = window.__d2Play;
        app.hudModel.closeAllPanels();
        if (app.hudModel.getSnapshot().panels.escapeMenu) {
          app.hudModel.togglePanel('escapeMenu');
        }
        app.renderFrame(performance.now());

        const startX = app.session.world.self.x;
        const startY = app.session.world.self.y;
        const sentBefore = app.session.getSentCommands().length;

        const cx = Math.floor(${spec.width} / 2);
        const cy = Math.floor((${spec.height} - 48) / 2);
        const clickOffsets = [
          [110, 40],
          [-110, 40],
          [110, -40],
          [-110, -40],
          [0, 85],
          [0, -85],
        ];

        for (const [dx, dy] of clickOffsets) {
          const now = performance.now();
          app.commandMapper.handlePointerDown(cx + dx, cy + dy, 0, now);
          app.commandMapper.handlePointerUp(0);
          for (let step = 0; step < 14; step++) {
            app.renderFrame(now + (step + 1) * 45);
            await new Promise((r) => setTimeout(r, 25));
          }
          const curX = app.session.world.self.x;
          const curY = app.session.world.self.y;
          if (Math.hypot(curX - startX, curY - startY) >= 1.5) {
            break;
          }
        }

        const endX = app.session.world.self.x;
        const endY = app.session.world.self.y;
        const sentAfter = app.session.getSentCommands();
        let moveCommandsSent = 0;
        for (let i = sentBefore; i < sentAfter.length; i++) {
          const cmd = sentAfter[i];
          if (cmd && (cmd.type === 'Move' || cmd.type === 'Run')) {
            moveCommandsSent++;
          }
        }
        const missingArt = Array.isArray(window.__d2MissingArt) ? window.__d2MissingArt : [];
        return {
          startPos: { x: Number(startX.toFixed(2)), y: Number(startY.toFixed(2)) },
          endPos: { x: Number(endX.toFixed(2)), y: Number(endY.toFixed(2)) },
          movedDistanceSubtiles: Number(Math.hypot(endX - startX, endY - startY).toFixed(3)),
          moveCommandsSent,
          missingArtCount: missingArt.length,
        };
      })()`)

      screenshots.push(await cdp.captureCleanPng(outDir, `04-sp-walk-${spec.id}.png`))

      resolutions.push({
        viewport: spec.id,
        expectedWidth: spec.width,
        expectedHeight: spec.height,
        viewCanvasWidth: townSnap.viewCanvasWidth,
        viewCanvasHeight: townSnap.viewCanvasHeight,
        hudCanvasWidth: townSnap.hudCanvasWidth,
        hudCanvasHeight: townSnap.hudCanvasHeight,
        barOffsetX: spec.barOffsetX,
        barOffsetY: spec.barOffsetY,
        panelOffsetY: spec.panelOffsetY,
        webglNonBlackRatio: townSnap.webglNonBlackRatio,
        hudBarOpaquePixels: townSnap.hudBarOpaquePixels,
        hudPanelsOpaquePixels: panelSnap.hudPanelsOpaquePixels,
        panelsToggled: panelSnap.panelsToggled,
        startPos: walkSnap.startPos,
        endPos: walkSnap.endPos,
        movedDistanceSubtiles: walkSnap.movedDistanceSubtiles,
        moveCommandsSent: walkSnap.moveCommandsSent,
        missingArtCount: walkSnap.missingArtCount,
      })
    }

    const result: K5BrowserE2eResult = {
      targetUrl,
      usedLiveServer8080,
      bootProgressPercent: bootState.bootProgressPercent,
      singlePlayerEnabled: bootState.singlePlayerEnabled,
      singlePlayerBackend: townEntry.activeBackend,
      heroName,
      areaId: townEntry.areaId,
      act: townEntry.act,
      resolutions,
      screenshots,
      consoleErrors: [...cdp.consoleErrors],
      pageExceptions: [...cdp.pageExceptions],
    }

    writeFileSync(join(outDir, 'k5-browser-e2e-report.json'), JSON.stringify(result, null, 2) + '\n')
    return result
  } finally {
    cdp?.close()
    if (chromeProc && chromeProc.exitCode === null) {
      chromeProc.kill('SIGKILL')
    }
    if (viteServer) {
      await viteServer.close()
    }
    if (prevPublicDirEnv === undefined) {
      delete process.env.D2_VITE_PUBLIC_DIR
    } else {
      process.env.D2_VITE_PUBLIC_DIR = prevPublicDirEnv
    }
    if (prevBackendEnv === undefined) {
      delete process.env.VITE_SINGLE_PLAYER_BACKEND
    } else {
      process.env.VITE_SINGLE_PLAYER_BACKEND = prevBackendEnv
    }
    rmSync(userDataDir, { recursive: true, force: true })
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runK5BrowserMultiresE2e()
    .then((res) => {
      console.log(
        `[k5-browser-e2e] PASS url=${res.targetUrl} live8080=${res.usedLiveServer8080} backend=${res.singlePlayerBackend} ` +
          `resolutions=${res.resolutions.map((r) => `${r.viewport}(moved=${r.movedDistanceSubtiles})`).join(', ')} ` +
          `screenshots=${res.screenshots.length} errors=${res.consoleErrors.length + res.pageExceptions.length}`,
      )
    })
    .catch((err: unknown) => {
      console.error('[k5-browser-e2e] FAIL:', err)
      process.exit(1)
    })
}
