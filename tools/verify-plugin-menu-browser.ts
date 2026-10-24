#!/usr/bin/env npx tsx
/**
 * Headless Chrome CDP End-to-End Browser Verification for the Plugin System & Modal Menu:
 * - Verifies `#d2-toolbar-plugins-btn` opens `[data-d2-modal-overlay="plugins"]`
 * - Verifies bilingual (`zh` / `en`) rendering of plugin cards, status badges, settings, and actions
 * - Verifies toggling `showToolbarShortcut` (`[data-plugin-setting="kill-stats:showToolbarShortcut"]`) dynamically hides/shows `#d2-toolbar-plugin-kill-stats-open`
 * - Verifies disabling `kill-stats` (`[data-plugin-toggle="kill-stats"]`):
 *   - Removes `#d2-toolbar-plugin-kill-stats-open`
 *   - Stops recording simulated monster kills while disabled
 *   - Displays `#d2-stats-disabled-notice` on `/plugins/kill-stats/index.html`
 * - Verifies re-enabling `kill-stats`:
 *   - Live-updates `/plugins/kill-stats/index.html` via `storage` event to hide `#d2-stats-disabled-notice`
 *   - Resumes recording simulated monster kills
 * - Verifies pressing `Escape` while the plugin modal is open closes the modal without triggering in-game Esc menu or HUD hotkeys
 * - Verifies zero console errors and zero uncaught page exceptions
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
  return resolve(ROOT_DIR, 'scratch/verify-plugin-menu')
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
  const userDataDir = mkdtempSync(join(tmpdir(), 'd2-verify-plugin-menu-'))
  let chromeProc: ReturnType<typeof spawn> | null = null
  let playCdp: CdpSession | null = null
  let statsCdp: CdpSession | null = null

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
    const statsUrl = `http://127.0.0.1:${port}/plugins/kill-stats/index.html`
    console.log(`[verify-plugin-menu] Vite server listening at http://127.0.0.1:${port}`)

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

    for (let i = 0; i < 120; i++) {
      await sleep(200)
      const ready = await playCdp.evaluate<boolean>(
        'Boolean(window.__d2PlayApp && window.__d2PlayApp.ready && window.__d2PlayApp.plugins)',
      )
      if (ready) break
    }
    const playReady = await playCdp.evaluate<boolean>(
      'Boolean(window.__d2PlayApp && window.__d2PlayApp.ready && window.__d2PlayApp.plugins)',
    )
    assert(playReady, 'play.html __d2PlayApp failed to reach ready=true')
    await playCdp.evaluate('window.__d2PlayApp.plugins.whenStarted()')

    // 0. Verify refactored Toolbar layout (Plugins far-left, Status + 3 icon buttons far-right),
    //    Config Modal (#d2-config-modal-overlay), and Bug Report Modal (#d2-bug-modal-overlay -> POST /api/bugs)
    const toolbarLayoutAndModals = await playCdp.evaluate<{
      directChildrenIds: string[]
      rightChildrenIds: string[]
      leftPluginsX: number
      rightBoxX: number
      configOpened: boolean
      hasFullscreenBtn: boolean
      hasViewportSelect: boolean
      hasFpsSelect: boolean
      hasMuteBtn: boolean
      hasVolumeSlider: boolean
      hasCacheClearBtn: boolean
      fpsAfterChange: number
      volAfterChange: number
      bugOpened: boolean
      configClosedOnBugOpen: boolean
      bugSubmitResult: { ok: boolean; id: string; error?: string }
      bugListMatch: boolean
    }>(`(async () => {
      const root = document.getElementById('d2-toolbar');
      const right = document.getElementById('d2-toolbar-right');
      const pluginsBtn = document.getElementById('d2-toolbar-plugins-btn');
      const directChildrenIds = root
        ? Array.from(root.children)
            .filter((el) => !el.classList.contains('d2-toolbar-modal-overlay') && el.id !== 'd2-toolbar-diag-banner')
            .map((el) => el.id)
        : [];
      const rightChildrenIds = right
        ? Array.from(
            right.querySelectorAll(
              '#d2-toolbar-status, #d2-toolbar-lang-btn, #d2-toolbar-config-btn, #d2-toolbar-bug-btn',
            ),
          ).map((el) => el.id)
        : [];
      const leftPluginsX = pluginsBtn?.getBoundingClientRect().left ?? -1;
      const rightBoxX = right?.getBoundingClientRect().left ?? -1;

      // Open Config modal
      const configBtn = document.getElementById('d2-toolbar-config-btn');
      configBtn?.click();
      const configOverlay = document.getElementById('d2-config-modal-overlay');
      const configOpened = Boolean(configOverlay && !configOverlay.hidden);
      const fullscreenBtn = document.getElementById('d2-toolbar-fullscreen-btn');
      const viewportSelect = document.getElementById('d2-toolbar-viewport-select');
      const fpsSelect = document.getElementById('d2-toolbar-worldfps-select');
      const muteBtn = document.getElementById('d2-toolbar-mute-btn');
      const volumeSlider = document.getElementById('d2-toolbar-volume-slider');
      const cacheClearBtn = document.getElementById('d2-toolbar-cache-clear-btn');

      if (fpsSelect) {
        fpsSelect.value = '30';
        fpsSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (volumeSlider) {
        volumeSlider.value = '65';
        volumeSlider.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const fpsAfterChange = window.__d2PlayApp.settings.get().worldRenderFps;
      const volAfterChange = Math.round(window.__d2PlayApp.settings.get().masterVolume * 100);
      if (fpsSelect) {
        fpsSelect.value = '60';
        fpsSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (volumeSlider) {
        volumeSlider.value = '100';
        volumeSlider.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Open Bug Report modal (must auto-close Config modal)
      const bugBtn = document.getElementById('d2-toolbar-bug-btn');
      bugBtn?.click();
      const bugOverlay = document.getElementById('d2-bug-modal-overlay');
      const bugOpened = Boolean(bugOverlay && !bugOverlay.hidden);
      const configClosedOnBugOpen = Boolean(configOverlay && configOverlay.hidden);

      const titleInput = document.getElementById('d2-bug-title-input');
      const catSelect = document.getElementById('d2-bug-category-select');
      const descInput = document.getElementById('d2-bug-desc-input');
      if (titleInput) titleInput.value = 'E2E Browser Bug Report Verification';
      if (catSelect) catSelect.value = 'ui';
      if (descInput) descInput.value = 'Automated headless Chrome check for toolbar bug reporting.';
      const bugSubmitResult = await window.__d2PlayApp.toolbar.submitBugReport();

      const listRes = await fetch('/api/bugs');
      const listJson = await listRes.json();
      const bugListMatch = Boolean(
        listJson &&
          listJson.ok &&
          Array.isArray(listJson.reports) &&
          listJson.reports.some((r) => r.id === bugSubmitResult.id),
      );

      document.getElementById('d2-bug-modal-close')?.click();

      return {
        directChildrenIds,
        rightChildrenIds,
        leftPluginsX,
        rightBoxX,
        configOpened,
        hasFullscreenBtn: Boolean(fullscreenBtn),
        hasViewportSelect: Boolean(viewportSelect),
        hasFpsSelect: Boolean(fpsSelect),
        hasMuteBtn: Boolean(muteBtn),
        hasVolumeSlider: Boolean(volumeSlider),
        hasCacheClearBtn: Boolean(cacheClearBtn),
        fpsAfterChange,
        volAfterChange,
        bugOpened,
        configClosedOnBugOpen,
        bugSubmitResult,
        bugListMatch,
      };
    })()`)

    assert(
      JSON.stringify(toolbarLayoutAndModals.directChildrenIds) ===
        JSON.stringify(['d2-toolbar-plugins-btn', 'd2-toolbar-plugin-slot', 'd2-toolbar-right']),
      `Expected toolbar top-level layout ['d2-toolbar-plugins-btn','d2-toolbar-plugin-slot','d2-toolbar-right'], got ${JSON.stringify(toolbarLayoutAndModals.directChildrenIds)}`,
    )
    assert(
      JSON.stringify(toolbarLayoutAndModals.rightChildrenIds) ===
        JSON.stringify([
          'd2-toolbar-status',
          'd2-toolbar-lang-btn',
          'd2-toolbar-config-btn',
          'd2-toolbar-bug-btn',
        ]),
      `Expected right toolbar items ['d2-toolbar-status','d2-toolbar-lang-btn','d2-toolbar-config-btn','d2-toolbar-bug-btn'], got ${JSON.stringify(toolbarLayoutAndModals.rightChildrenIds)}`,
    )
    assert(
      toolbarLayoutAndModals.rightBoxX > toolbarLayoutAndModals.leftPluginsX,
      `Expected #d2-toolbar-right (${toolbarLayoutAndModals.rightBoxX}px) to be positioned to the right of #d2-toolbar-plugins-btn (${toolbarLayoutAndModals.leftPluginsX}px)`,
    )
    assert(toolbarLayoutAndModals.configOpened, 'Expected #d2-config-modal-overlay to open when clicking #d2-toolbar-config-btn')
    assert(
      toolbarLayoutAndModals.hasFullscreenBtn &&
        toolbarLayoutAndModals.hasViewportSelect &&
        toolbarLayoutAndModals.hasFpsSelect &&
        toolbarLayoutAndModals.hasMuteBtn &&
        toolbarLayoutAndModals.hasVolumeSlider &&
        toolbarLayoutAndModals.hasCacheClearBtn,
      'Expected Config modal to contain fullscreen, viewport, FPS, mute, volume slider, and cache clear controls',
    )
    assert(toolbarLayoutAndModals.fpsAfterChange === 30, `Expected FPS setting change to 30, got ${toolbarLayoutAndModals.fpsAfterChange}`)
    assert(toolbarLayoutAndModals.volAfterChange === 65, `Expected master volume change to 65%, got ${toolbarLayoutAndModals.volAfterChange}`)
    assert(toolbarLayoutAndModals.bugOpened && toolbarLayoutAndModals.configClosedOnBugOpen, 'Expected Bug modal to open and auto-close Config modal')
    assert(
      toolbarLayoutAndModals.bugSubmitResult.ok && Boolean(toolbarLayoutAndModals.bugSubmitResult.id),
      `Expected bug report submission to succeed, got ${JSON.stringify(toolbarLayoutAndModals.bugSubmitResult)}`,
    )
    assert(toolbarLayoutAndModals.bugListMatch, 'Expected submitted bug report to be persisted and returned by GET /api/bugs')
    try {
      rmSync(join(ROOT_DIR, 'bugs', `${toolbarLayoutAndModals.bugSubmitResult.id}.json`), { force: true })
    } catch {
      // ignore cleanup
    }

    // 1. Open plugin modal menu via #d2-toolbar-plugins-btn & verify all 5 built-in plugins + PacketInspector removal
    const openStateZh = await playCdp.evaluate<{
      btnExists: boolean
      btnDisabled: boolean
      btnText: string
      modalOpen: boolean
      navIds: string[]
      cardIds: string[]
      selectedNavId: string
      visibleCardIds: string[]
      shortcutExists: boolean
      automapSelectExists: boolean
      lightingSelectExists: boolean
      weatherSelectExists: boolean
      modalModeSelectExists: boolean
      modalLightingSelectExists: boolean
      modalWeatherSelectExists: boolean
      viewportOptionCount: number
      hasInspectorBtn: boolean
      hasInspectorContainer: boolean
      titleText: string
    }>(`(() => {
      const btn = document.getElementById('d2-toolbar-plugins-btn');
      btn?.click();
      const overlay = document.querySelector('[data-d2-modal-overlay="plugins"]');
      const navIds = Array.from(document.querySelectorAll('[data-plugin-nav]')).map(
        (el) => el.getAttribute('data-plugin-nav') ?? '',
      );
      const cardIds = Array.from(document.querySelectorAll('[data-plugin-id]')).map(
        (el) => el.getAttribute('data-plugin-id') ?? '',
      );
      const selectedNavId =
        document.querySelector('[data-plugin-nav][aria-selected="true"]')?.getAttribute('data-plugin-nav') ?? '';
      const visibleCardIds = Array.from(document.querySelectorAll('[data-plugin-id]'))
        .filter((el) => !el.hasAttribute('hidden'))
        .map((el) => el.getAttribute('data-plugin-id') ?? '');
      const shortcut = document.getElementById('d2-toolbar-plugin-kill-stats-open');
      const automapSelect = document.getElementById('d2-toolbar-automap-select');
      const lightingSelect = document.getElementById('d2-toolbar-lighting-select');
      const weatherSelect = document.getElementById('d2-toolbar-weather-select');
      const modalModeSelect = document.querySelector('select[data-plugin-setting="automap-reveal:mode"]');
      const modalLightingSelect = document.querySelector('select[data-plugin-setting="automap-reveal:lightingPreset"]');
      const modalWeatherSelect = document.querySelector('select[data-plugin-setting="automap-reveal:weatherOverride"]');
      const viewportSelect = document.getElementById('d2-toolbar-viewport-select');
      return {
        btnExists: Boolean(btn),
        btnDisabled: Boolean(btn?.disabled),
        btnText: btn?.textContent?.trim() ?? '',
        modalOpen: Boolean(overlay && !overlay.hasAttribute('hidden')),
        navIds,
        cardIds,
        selectedNavId,
        visibleCardIds,
        shortcutExists: Boolean(shortcut),
        automapSelectExists: Boolean(automapSelect),
        lightingSelectExists: Boolean(lightingSelect),
        weatherSelectExists: Boolean(weatherSelect),
        modalModeSelectExists: Boolean(modalModeSelect),
        modalLightingSelectExists: Boolean(modalLightingSelect),
        modalWeatherSelectExists: Boolean(modalWeatherSelect),
        viewportOptionCount: viewportSelect ? viewportSelect.querySelectorAll('option').length : 0,
        hasInspectorBtn: Boolean(document.getElementById('d2-toolbar-inspector-btn')),
        hasInspectorContainer: Boolean(document.getElementById('d2-inspector-container')),
        titleText: overlay?.querySelector('.d2-plugin-menu__title')?.textContent?.trim() ?? '',
      };
    })()`)

    assert(openStateZh.btnExists, '#d2-toolbar-plugins-btn must exist')
    assert(!openStateZh.btnDisabled, '#d2-toolbar-plugins-btn must be enabled after PluginHost starts')
    assert(openStateZh.modalOpen, 'Plugin modal overlay must be open after clicking #d2-toolbar-plugins-btn')
    // Card order follows the BUILTIN_PLUGINS registration order in plugins/index.ts.
    const expectedCardIds = [
      'kill-stats',
      'drop-tracker',
      'automap-reveal',
      'extended-viewports',
      'hud-enhancements',
      'ground-item-beam',
      'quick-cast',
      'next-game',
    ]
    assert(
      JSON.stringify(openStateZh.navIds) === JSON.stringify(expectedCardIds),
      `Expected left-column nav items ${JSON.stringify(expectedCardIds)}, got ${JSON.stringify(openStateZh.navIds)}`,
    )
    assert(
      JSON.stringify(openStateZh.cardIds) === JSON.stringify(expectedCardIds),
      `Expected all ${expectedCardIds.length} plugin cards ${JSON.stringify(expectedCardIds)}, got ${JSON.stringify(openStateZh.cardIds)}`,
    )
    assert(
      openStateZh.selectedNavId === 'kill-stats' &&
        JSON.stringify(openStateZh.visibleCardIds) === JSON.stringify(['kill-stats']),
      `Expected only kill-stats detail panel visible initially, got selectedNavId=${openStateZh.selectedNavId}, visibleCardIds=${JSON.stringify(openStateZh.visibleCardIds)}`,
    )

    // Verify clicking a plugin in the left column switches the right detail panel
    const switchCheck = await playCdp.evaluate<{
      afterAutomapClickSelected: string
      afterAutomapClickVisible: string[]
      afterKillStatsClickSelected: string
      afterKillStatsClickVisible: string[]
    }>(`(() => {
      document.querySelector('[data-plugin-nav="automap-reveal"]')?.click();
      const afterAutomapClickSelected =
        document.querySelector('[data-plugin-nav][aria-selected="true"]')?.getAttribute('data-plugin-nav') ?? '';
      const afterAutomapClickVisible = Array.from(document.querySelectorAll('[data-plugin-id]'))
        .filter((el) => !el.hasAttribute('hidden'))
        .map((el) => el.getAttribute('data-plugin-id') ?? '');

      document.querySelector('[data-plugin-nav="kill-stats"]')?.click();
      const afterKillStatsClickSelected =
        document.querySelector('[data-plugin-nav][aria-selected="true"]')?.getAttribute('data-plugin-nav') ?? '';
      const afterKillStatsClickVisible = Array.from(document.querySelectorAll('[data-plugin-id]'))
        .filter((el) => !el.hasAttribute('hidden'))
        .map((el) => el.getAttribute('data-plugin-id') ?? '');

      return {
        afterAutomapClickSelected,
        afterAutomapClickVisible,
        afterKillStatsClickSelected,
        afterKillStatsClickVisible,
      };
    })()`)
    assert(
      switchCheck.afterAutomapClickSelected === 'automap-reveal' &&
        JSON.stringify(switchCheck.afterAutomapClickVisible) === JSON.stringify(['automap-reveal']),
      `Clicking [data-plugin-nav="automap-reveal"] must select automap-reveal and display only its right-pane details, got ${JSON.stringify(switchCheck)}`,
    )
    assert(
      switchCheck.afterKillStatsClickSelected === 'kill-stats' &&
        JSON.stringify(switchCheck.afterKillStatsClickVisible) === JSON.stringify(['kill-stats']),
      `Clicking [data-plugin-nav="kill-stats"] must restore kill-stats detail panel, got ${JSON.stringify(switchCheck)}`,
    )
    assert(openStateZh.shortcutExists, '#d2-toolbar-plugin-kill-stats-open must exist initially')
    assert(!openStateZh.automapSelectExists, '#d2-toolbar-automap-select must not be placed on the toolbar')
    assert(!openStateZh.lightingSelectExists, '#d2-toolbar-lighting-select must not be placed on the toolbar')
    assert(!openStateZh.weatherSelectExists, '#d2-toolbar-weather-select must not be placed on the toolbar')
    assert(openStateZh.modalModeSelectExists, 'select[data-plugin-setting="automap-reveal:mode"] must exist in PluginMenu')
    assert(openStateZh.modalLightingSelectExists, 'select[data-plugin-setting="automap-reveal:lightingPreset"] must exist in PluginMenu')
    assert(openStateZh.modalWeatherSelectExists, 'select[data-plugin-setting="automap-reveal:weatherOverride"] must exist in PluginMenu')
    assert(openStateZh.viewportOptionCount === 5, `Expected 5 viewport options when extended-viewports is enabled, got ${openStateZh.viewportOptionCount}`)
    assert(!openStateZh.hasInspectorBtn, '#d2-toolbar-inspector-btn must be removed (#717)')
    assert(!openStateZh.hasInspectorContainer, '#d2-inspector-container must be removed (#717)')
    assert(openStateZh.titleText === '插件管理', `Expected Chinese title "插件管理", got "${openStateZh.titleText}"`)

    // Verify hot-disabling automap-reveal (#714, including lightingPreset & weatherOverride) and extended-viewports (#716) enforces 1.13c defaults
    const fallbackCheck = await playCdp.evaluate<{
      automapWhileDisabled: string
      lightingWhileDisabled: string
      weatherWhileDisabled: string
      viewportWhileDisabled: string
      viewportOptionsWhileDisabled: string[]
      automapRestored: string
      lightingRestored: string
      weatherRestored: string
      viewportOptionsRestoredCount: number
    }>(`(async () => {
      const app = window.__d2PlayApp;
      await app.plugins.setSetting('automap-reveal', 'mode', 'act');
      await app.plugins.setSetting('automap-reveal', 'lightingPreset', 'fullbright');
      await app.plugins.setSetting('automap-reveal', 'weatherOverride', 'snow');
      app.toolbar.setViewport('1280x720');

      await app.plugins.setEnabled('automap-reveal', false);
      await app.plugins.setEnabled('extended-viewports', false);

      const automapWhileDisabled = app.settings.get().automapReveal;
      const lightingWhileDisabled = app.settings.get().lightingPreset;
      const weatherWhileDisabled = app.settings.get().weatherOverride;
      const viewportWhileDisabled = app.settings.get().viewport;
      const vpSelect = document.getElementById('d2-toolbar-viewport-select');
      const viewportOptionsWhileDisabled = vpSelect
        ? Array.from(vpSelect.querySelectorAll('option')).map((o) => o.value)
        : [];

      await app.plugins.setEnabled('automap-reveal', true);
      await app.plugins.setEnabled('extended-viewports', true);
      await app.plugins.setSetting('automap-reveal', 'mode', 'off');
      await app.plugins.setSetting('automap-reveal', 'lightingPreset', 'auto');
      await app.plugins.setSetting('automap-reveal', 'weatherOverride', 'off');

      return {
        automapWhileDisabled,
        lightingWhileDisabled,
        weatherWhileDisabled,
        viewportWhileDisabled,
        viewportOptionsWhileDisabled,
        automapRestored: app.settings.get().automapReveal,
        lightingRestored: app.settings.get().lightingPreset,
        weatherRestored: app.settings.get().weatherOverride,
        viewportOptionsRestoredCount: vpSelect ? vpSelect.querySelectorAll('option').length : 0,
      };
    })()`)
    assert(fallbackCheck.automapWhileDisabled === 'off', `Expected automapReveal='off' when automap-reveal disabled, got ${fallbackCheck.automapWhileDisabled}`)
    assert(fallbackCheck.lightingWhileDisabled === 'auto', `Expected lightingPreset='auto' when automap-reveal disabled, got ${fallbackCheck.lightingWhileDisabled}`)
    assert(fallbackCheck.weatherWhileDisabled === 'off', `Expected weatherOverride='off' when automap-reveal disabled, got ${fallbackCheck.weatherWhileDisabled}`)
    assert(fallbackCheck.viewportWhileDisabled === '800x600', `Expected viewport clamped to 800x600 when extended-viewports disabled, got ${fallbackCheck.viewportWhileDisabled}`)
    assert(
      JSON.stringify(fallbackCheck.viewportOptionsWhileDisabled) === JSON.stringify(['640x480', '800x600']),
      `Expected only native 1.13c viewports when extended-viewports disabled, got ${JSON.stringify(fallbackCheck.viewportOptionsWhileDisabled)}`,
    )
    assert(fallbackCheck.viewportOptionsRestoredCount === 5, 'Expected 5 viewport options restored when extended-viewports re-enabled')

    const shot1 = join(outDir, '01-plugin-menu-open-zh.png')
    const shot1Bytes = await playCdp.captureScreenshot(shot1)
    console.log(`[verify-plugin-menu] Captured ${shot1} (${shot1Bytes} bytes) — Plugin menu open (ZH)`)

    // 2. Toggle language to English via #d2-toolbar-lang-btn and verify English labels in plugin modal
    await playCdp.evaluate(`(() => {
      document.getElementById('d2-toolbar-lang-btn')?.click();
    })()`)
    const openStateEn = await playCdp.evaluate<{
      titleText: string
      btnText: string
      resetText: string
    }>(`(() => {
      const overlay = document.querySelector('[data-d2-modal-overlay="plugins"]');
      return {
        titleText: overlay?.querySelector('.d2-plugin-menu__title')?.textContent?.trim() ?? '',
        btnText: document.getElementById('d2-toolbar-plugins-btn')?.textContent?.trim() ?? '',
        resetText: document.getElementById('d2-plugin-menu-reset')?.textContent?.trim() ?? '',
      };
    })()`)
    assert(openStateEn.titleText === 'Plugins', `Expected English title "Plugins", got "${openStateEn.titleText}"`)
    assert(openStateEn.btnText.includes('Plugins'), `Expected toolbar button "Plugins", got "${openStateEn.btnText}"`)
    assert(openStateEn.resetText === 'Reset All to Defaults', `Expected "Reset All to Defaults", got "${openStateEn.resetText}"`)

    const shot2 = join(outDir, '02-plugin-menu-open-en.png')
    const shot2Bytes = await playCdp.captureScreenshot(shot2)
    console.log(`[verify-plugin-menu] Captured ${shot2} (${shot2Bytes} bytes) — Plugin menu open (EN)`)

    // Switch back to Chinese via #d2-toolbar-lang-btn
    await playCdp.evaluate(`(() => {
      document.getElementById('d2-toolbar-lang-btn')?.click();
    })()`)

    // 3. Toggle showToolbarShortcut off -> verify #d2-toolbar-plugin-kill-stats-open disappears, then toggle back on
    const afterShortcutOff = await playCdp.evaluate<boolean>(`(() => {
      const cb = document.querySelector('[data-plugin-setting="kill-stats:showToolbarShortcut"]');
      cb?.click();
      return Boolean(document.getElementById('d2-toolbar-plugin-kill-stats-open'));
    })()`)
    assert(!afterShortcutOff, '#d2-toolbar-plugin-kill-stats-open must be removed when showToolbarShortcut is unchecked')

    const shot3 = join(outDir, '03-plugin-shortcut-hidden.png')
    const shot3Bytes = await playCdp.captureScreenshot(shot3)
    console.log(`[verify-plugin-menu] Captured ${shot3} (${shot3Bytes} bytes) — Toolbar shortcut hidden`)

    const afterShortcutOn = await playCdp.evaluate<boolean>(`(() => {
      const cb = document.querySelector('[data-plugin-setting="kill-stats:showToolbarShortcut"]');
      cb?.click();
      return Boolean(document.getElementById('d2-toolbar-plugin-kill-stats-open'));
    })()`)
    assert(afterShortcutOn, '#d2-toolbar-plugin-kill-stats-open must reappear when showToolbarShortcut is checked')

    // 4. Attach fake game server, record 1 pending kill (unflushed), disable kill-stats via DOM toggle ONLY,
    //    verify pending kill was flushed on deactivate (Total=1), verify kills while disabled are NOT recorded,
    //    and verify disabled state persists across play.html reload.
    await playCdp.evaluate(`(async () => {
      const app = window.__d2PlayApp;
      const session = app.session;
      session.loginHostValue = 'www.laiseek.xyz';
      session.usernameValue = 'pluginacct';
      session.selectedRealmValue = { title: 'D2CS', description: 'Realm' };
      session.selectedCharValue = 'PluginSorc';
      session.charactersValue = [
        {
          name: 'PluginSorc',
          charClass: 1,
          level: 88,
          hardcore: true,
          expansion: true,
          ladder: true,
          rawFlags: 0,
          act: 5,
        },
      ];

      let emitServerEvent = null;
      const fakeAdapter = {
        isConnected: true,
        stats: { packetsIn: 0, packetsOut: 0, bytesIn: 0, bytesOut: 0, rttMs: 12, unknownPackets: 0 },
        connect: async () => {},
        disconnect: () => {},
        send: () => {},
        onEvent: (cb) => {
          emitServerEvent = cb;
          return () => { emitServerEvent = null; };
        },
      };
      session.attachGameServer(fakeAdapter);
      window.__d2EmitPluginTestEvent = (ev) => emitServerEvent && emitServerEvent(ev);

      // Emit 1 monster kill BEFORE disabling (leave unflushed in memory so deactivate() must flush it)
      const emit = window.__d2EmitPluginTestEvent;
      emit({ type: 'GameFlags', difficulty: 2, unknown1: 0, hardcore: true, expansion: true, ladder: true });
      emit({
        type: 'UnitAssign',
        isSelf: true,
        unit: { unitType: 'player', id: 1, classId: 1, name: 'PluginSorc', x: 5000, y: 5000, mode: 1, lifePct: 128 },
      });
      emit({
        type: 'UnitAssign',
        unit: { unitType: 'monster', id: 300, classId: 19, x: 5005, y: 5005, mode: 1, lifePct: 128 },
      });
      emit({ type: 'UnitMode', unitType: 'monster', id: 300, mode: 0, x: 5005, y: 5005, lifePct: 0 });

      // Toggle kill-stats off via DOM checkbox ONLY (do NOT call app.plugins.setEnabled manually)
      const toggle = document.querySelector('[data-plugin-toggle="kill-stats"]');
      toggle?.click();
    })()`)

    // Wait for async deactivation & pending kill flush triggered by checkbox change event
    let deactivatedByToggle = false
    for (let i = 0; i < 40; i++) {
      await sleep(100)
      deactivatedByToggle = await playCdp.evaluate<boolean>(
        `!window.__d2PlayApp.plugins.getInstance('kill-stats') && !document.getElementById('d2-toolbar-plugin-kill-stats-open')`,
      )
      if (deactivatedByToggle) break
    }
    assert(
      deactivatedByToggle,
      'Clicking [data-plugin-toggle="kill-stats"] must deactivate kill-stats and remove #d2-toolbar-plugin-kill-stats-open without manual setEnabled()',
    )

    // Emit monster kill while kill-stats is disabled (must NOT be recorded)
    await playCdp.evaluate(`(() => {
      const emit = window.__d2EmitPluginTestEvent;
      emit({
        type: 'UnitAssign',
        unit: { unitType: 'monster', id: 301, classId: 156, x: 5010, y: 5010, mode: 1, lifePct: 128, isBoss: true },
      });
      emit({ type: 'UnitMode', unitType: 'monster', id: 301, mode: 0, x: 5010, y: 5010, lifePct: 0 });
    })()`)

    // Open /plugins/kill-stats/index.html in second tab and verify #d2-stats-disabled-notice is visible & Total=1 (from pre-disable flush)
    const statsTarget = await openNewPageTarget(cdpPort, statsUrl)
    statsCdp = await CdpSession.connect(statsTarget.webSocketDebuggerUrl)
    for (let i = 0; i < 100; i++) {
      await sleep(150)
      const ready = await statsCdp.evaluate<boolean>('Boolean(window.__d2StatsApp && window.__d2StatsApp.ready)')
      if (ready) break
    }

    const statsDisabledState = await statsCdp.evaluate<{
      noticeVisible: boolean
      noticeText: string
      valTotal: string
    }>(`(() => {
      const notice = document.getElementById('d2-stats-disabled-notice');
      return {
        noticeVisible: Boolean(notice && !notice.hidden),
        noticeText: notice?.textContent?.trim() ?? '',
        valTotal: document.getElementById('d2-stats-val-total')?.textContent?.trim() ?? '',
      };
    })()`)
    assert(statsDisabledState.noticeVisible, '#d2-stats-disabled-notice must be visible when kill-stats is disabled')
    assert(
      statsDisabledState.valTotal === '1',
      `Expected Total=1 (flushed on disable, while post-disable kill 301 was ignored), got ${statsDisabledState.valTotal}`,
    )

    const shot4 = join(outDir, '04-stats-disabled-notice.png')
    const shot4Bytes = await statsCdp.captureScreenshot(shot4)
    console.log(`[verify-plugin-menu] Captured ${shot4} (${shot4Bytes} bytes) — Disabled notice visible on stats page`)

    // Reload play.html while kill-stats is disabled and verify disabled state persists across reload
    await playCdp.evaluate(`delete window.__d2PlayApp`)
    await playCdp.send('Page.reload')
    for (let i = 0; i < 100; i++) {
      await sleep(150)
      const ready = await playCdp.evaluate<boolean>(
        'Boolean(window.__d2PlayApp && window.__d2PlayApp.ready && window.__d2PlayApp.plugins)',
      )
      if (ready) break
    }
    await playCdp.evaluate(`window.__d2PlayApp.plugins.whenStarted()`)

    const persistedDisabledAfterReload = await playCdp.evaluate<{
      isEnabled: boolean
      hasInstance: boolean
      hasShortcutBtn: boolean
    }>(`(() => ({
      isEnabled: window.__d2PlayApp.plugins.isEnabled('kill-stats'),
      hasInstance: Boolean(window.__d2PlayApp.plugins.getInstance('kill-stats')),
      hasShortcutBtn: Boolean(document.getElementById('d2-toolbar-plugin-kill-stats-open')),
    }))()`)
    assert(!persistedDisabledAfterReload.isEnabled, 'kill-stats must remain disabled after reloading play.html')
    assert(!persistedDisabledAfterReload.hasInstance, 'kill-stats instance must remain null after reloading play.html')
    assert(
      !persistedDisabledAfterReload.hasShortcutBtn,
      '#d2-toolbar-plugin-kill-stats-open must remain absent after reloading play.html while disabled',
    )

    // 5. Re-open plugin menu on reloaded play.html, re-enable kill-stats via DOM toggle ONLY -> verify #d2-stats-disabled-notice hides live & kills record
    await playCdp.evaluate(`(() => {
      document.getElementById('d2-toolbar-plugins-btn')?.click();
      const toggle = document.querySelector('[data-plugin-toggle="kill-stats"]');
      toggle?.click();
    })()`)

    let reenabledByToggle = false
    for (let i = 0; i < 40; i++) {
      await sleep(100)
      reenabledByToggle = await playCdp.evaluate<boolean>(
        `Boolean(window.__d2PlayApp.plugins.getInstance('kill-stats')) && Boolean(document.getElementById('d2-toolbar-plugin-kill-stats-open'))`,
      )
      if (reenabledByToggle) break
    }
    assert(reenabledByToggle, 'Clicking [data-plugin-toggle="kill-stats"] must re-enable kill-stats without manual setEnabled()')

    let noticeHiddenAfterReenable = false
    for (let i = 0; i < 30; i++) {
      await sleep(100)
      noticeHiddenAfterReenable = await statsCdp.evaluate<boolean>(
        `Boolean(document.getElementById('d2-stats-disabled-notice')?.hidden)`,
      )
      if (noticeHiddenAfterReenable) break
    }
    assert(noticeHiddenAfterReenable, '#d2-stats-disabled-notice must hide automatically when kill-stats is re-enabled')

    await playCdp.evaluate(`(async () => {
      const app = window.__d2PlayApp;
      const session = app.session;
      session.loginHostValue = 'www.laiseek.xyz';
      session.usernameValue = 'pluginacct';
      session.selectedRealmValue = { title: 'D2CS', description: 'Realm' };
      session.selectedCharValue = 'PluginSorc';
      session.charactersValue = [
        {
          name: 'PluginSorc',
          charClass: 1,
          level: 88,
          hardcore: true,
          expansion: true,
          ladder: true,
          rawFlags: 0,
          act: 5,
        },
      ];
      let emitServerEvent = null;
      const fakeAdapter = {
        isConnected: true,
        stats: { packetsIn: 0, packetsOut: 0, bytesIn: 0, bytesOut: 0, rttMs: 12, unknownPackets: 0 },
        connect: async () => {},
        disconnect: () => {},
        send: () => {},
        onEvent: (cb) => {
          emitServerEvent = cb;
          return () => { emitServerEvent = null; };
        },
      };
      session.attachGameServer(fakeAdapter);
      emitServerEvent({ type: 'GameFlags', difficulty: 2, unknown1: 0, hardcore: true, expansion: true, ladder: true });
      emitServerEvent({
        type: 'UnitAssign',
        isSelf: true,
        unit: { unitType: 'player', id: 1, classId: 1, name: 'PluginSorc', x: 5000, y: 5000, mode: 1, lifePct: 128 },
      });
      emitServerEvent({
        type: 'UnitAssign',
        unit: { unitType: 'monster', id: 302, classId: 156, x: 5010, y: 5010, mode: 1, lifePct: 128, isBoss: true },
      });
      emitServerEvent({ type: 'UnitMode', unitType: 'monster', id: 302, mode: 0, x: 5010, y: 5010, lifePct: 0 });
      await app.plugins.getInstance('kill-stats').tracker.flushNow();
    })()`)

    let totalAfterReenable = ''
    for (let i = 0; i < 30; i++) {
      await sleep(100)
      totalAfterReenable = await statsCdp.evaluate<string>(
        `document.getElementById('d2-stats-val-total')?.textContent?.trim() ?? ''`,
      )
      if (totalAfterReenable === '2') break
    }
    assert(totalAfterReenable === '2', `Expected Total=2 after re-enabling kill-stats, got ${totalAfterReenable}`)

    // Clean up recorded character in stats page
    await statsCdp.evaluate(`(async () => {
      await window.__d2StatsApp.repository.clearAll();
      await window.__d2StatsApp.refresh();
    })()`)

    // 6. Verify Escape key closes the plugin modal WITHOUT changing flowState.stage or opening in-game Esc menu / HUD panels
    const escIsolation = await playCdp.evaluate<{
      modalOpenBefore: boolean
      modalOpenAfter: boolean
      hudListenerTriggered: boolean
      stageBefore: string
      stageAfter: string
      escMenuBefore: boolean
      escMenuAfter: boolean
    }>(`(() => {
      const app = window.__d2PlayApp;
      const overlay = document.querySelector('[data-d2-modal-overlay="plugins"]');
      const modalOpenBefore = Boolean(overlay && !overlay.hasAttribute('hidden'));
      const stageBefore = app.flowState.stage;
      const escMenuBefore = Boolean(app.hudModel.getSnapshot().panels.escapeMenu || app.hudManager.escapeMenuOpen);
      let hudBubbleKeySeen = false;
      const onBubbleKey = () => { hudBubbleKeySeen = true; };
      window.addEventListener('keydown', onBubbleKey, false);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
      window.removeEventListener('keydown', onBubbleKey, false);
      const modalOpenAfter = Boolean(overlay && !overlay.hasAttribute('hidden'));
      const stageAfter = app.flowState.stage;
      const escMenuAfter = Boolean(app.hudModel.getSnapshot().panels.escapeMenu || app.hudManager.escapeMenuOpen);
      return {
        modalOpenBefore,
        modalOpenAfter,
        hudListenerTriggered: hudBubbleKeySeen,
        stageBefore,
        stageAfter,
        escMenuBefore,
        escMenuAfter,
      };
    })()`)
    assert(escIsolation.modalOpenBefore, 'Plugin modal must be open before Escape key')
    assert(!escIsolation.modalOpenAfter, 'Plugin modal must close on Escape key')
    assert(!escIsolation.hudListenerTriggered, 'Escape key while plugin modal is open must not reach bubble-phase HUD listeners')
    assert(
      escIsolation.stageAfter === escIsolation.stageBefore,
      `Escape key while plugin modal is open must not change flowState.stage (${escIsolation.stageBefore} -> ${escIsolation.stageAfter})`,
    )
    assert(
      !escIsolation.escMenuBefore && !escIsolation.escMenuAfter,
      'Escape key while plugin modal is open must not open the in-game Escape menu',
    )

    // Ensure 0 console errors prior to intentional corrupt-JSON injection test
    assert(
      playCdp.consoleErrors.length === 0,
      `play.html had console errors before corrupt-JSON test: ${JSON.stringify(playCdp.consoleErrors)}`,
    )
    assert(
      statsCdp.consoleErrors.length === 0,
      `stats page had console errors before corrupt-JSON test: ${JSON.stringify(statsCdp.consoleErrors)}`,
    )

    // 7. Inject corrupt JSON into d2web.plugins.v1, reload play.html, verify ⚠ badge + #d2-plugin-menu-alert + preserved raw value,
    //    then click #d2-plugin-menu-reset and verify ⚠ clears, alert hides, and valid JSON is persisted.
    await playCdp.evaluate(`(() => {
      localStorage.setItem('d2web.plugins.v1', '{corrupt-json');
      delete window.__d2PlayApp;
    })()`)
    await playCdp.send('Page.reload')
    for (let i = 0; i < 100; i++) {
      await sleep(150)
      const ready = await playCdp.evaluate<boolean>(
        'Boolean(window.__d2PlayApp && window.__d2PlayApp.ready && window.__d2PlayApp.plugins)',
      )
      if (ready) break
    }
    await playCdp.evaluate(`window.__d2PlayApp.plugins.whenStarted()`)

    // Verify expected [PluginConfigStore] console.error was logged on corrupt JSON and filter it out on both tabs
    const corruptLogs = playCdp.consoleErrors.filter((msg) =>
      msg.includes('[PluginConfigStore] Corrupt JSON in d2web.plugins.v1'),
    )
    assert(corruptLogs.length >= 1, 'Expected [PluginConfigStore] Corrupt JSON console.error on corrupt d2web.plugins.v1')
    const unexpectedPlayLogs = playCdp.consoleErrors.filter(
      (msg) => !msg.includes('[PluginConfigStore] Corrupt JSON in d2web.plugins.v1'),
    )
    playCdp.consoleErrors.length = 0
    playCdp.consoleErrors.push(...unexpectedPlayLogs)

    const unexpectedStatsLogs = statsCdp.consoleErrors.filter(
      (msg) => !msg.includes('[PluginConfigStore] Corrupt JSON in d2web.plugins.v1'),
    )
    statsCdp.consoleErrors.length = 0
    statsCdp.consoleErrors.push(...unexpectedStatsLogs)

    const corruptAlertState = await playCdp.evaluate<{
      toolbarLabel: string
      rawBeforeReset: string | null
      alertVisible: boolean
      alertRole: string | null
      alertText: string
    }>(`(() => {
      const btn = document.getElementById('d2-toolbar-plugins-btn');
      const toolbarLabel = btn?.textContent?.trim() ?? '';
      btn?.click();
      const alertEl = document.getElementById('d2-plugin-menu-alert');
      return {
        toolbarLabel,
        rawBeforeReset: localStorage.getItem('d2web.plugins.v1'),
        alertVisible: Boolean(alertEl && !alertEl.hidden),
        alertRole: alertEl?.getAttribute('role') ?? null,
        alertText: alertEl?.textContent?.trim() ?? '',
      };
    })()`)
    assert(
      corruptAlertState.toolbarLabel.includes('⚠'),
      `Expected #d2-toolbar-plugins-btn to include ⚠ on corrupt JSON, got "${corruptAlertState.toolbarLabel}"`,
    )
    assert(
      corruptAlertState.rawBeforeReset === '{corrupt-json',
      `Raw corrupt localStorage value must NOT be overwritten before reset, got ${JSON.stringify(corruptAlertState.rawBeforeReset)}`,
    )
    assert(corruptAlertState.alertVisible, '#d2-plugin-menu-alert must be visible when storage is corrupt')
    assert(corruptAlertState.alertRole === 'alert', 'Expected #d2-plugin-menu-alert to have role="alert"')
    assert(corruptAlertState.alertText.length > 0, '#d2-plugin-menu-alert must contain a diagnostic message')

    const shot5 = join(outDir, '05-plugin-menu-corrupt-alert.png')
    const shot5Bytes = await playCdp.captureScreenshot(shot5)
    console.log(`[verify-plugin-menu] Captured ${shot5} (${shot5Bytes} bytes) — Corrupt config alert banner`)

    await playCdp.evaluate(`document.getElementById('d2-plugin-menu-reset')?.click()`)
    await sleep(250)

    const afterResetState = await playCdp.evaluate<{
      toolbarLabel: string
      alertHidden: boolean
      rawAfterReset: string | null
    }>(`(() => {
      const btn = document.getElementById('d2-toolbar-plugins-btn');
      const alertEl = document.getElementById('d2-plugin-menu-alert');
      return {
        toolbarLabel: btn?.textContent?.trim() ?? '',
        alertHidden: Boolean(alertEl && alertEl.hidden),
        rawAfterReset: localStorage.getItem('d2web.plugins.v1'),
      };
    })()`)
    assert(
      !afterResetState.toolbarLabel.includes('⚠'),
      `Expected ⚠ to clear from #d2-toolbar-plugins-btn after reset, got "${afterResetState.toolbarLabel}"`,
    )
    assert(afterResetState.alertHidden, '#d2-plugin-menu-alert must be hidden after clicking #d2-plugin-menu-reset')
    const parsedAfterReset = JSON.parse(afterResetState.rawAfterReset ?? '{}') as {
      version?: number
      plugins?: Record<string, { enabled?: boolean }>
    }
    assert(parsedAfterReset.version === 1, 'Expected reset d2web.plugins.v1 to have version: 1')
    assert(
      parsedAfterReset.plugins?.['kill-stats']?.enabled === true,
      'Expected reset d2web.plugins.v1 to restore kill-stats enabled: true',
    )

    assert(
      playCdp.consoleErrors.length === 0,
      `play.html had console errors: ${JSON.stringify(playCdp.consoleErrors)}`,
    )
    assert(
      playCdp.pageExceptions.length === 0,
      `play.html had uncaught page exceptions: ${JSON.stringify(playCdp.pageExceptions)}`,
    )
    assert(
      statsCdp.consoleErrors.length === 0,
      `stats page had console errors: ${JSON.stringify(statsCdp.consoleErrors)}`,
    )
    assert(
      statsCdp.pageExceptions.length === 0,
      `stats page had uncaught page exceptions: ${JSON.stringify(statsCdp.pageExceptions)}`,
    )

    console.log('[verify-plugin-menu] ALL END-TO-END BROWSER ASSERTIONS PASSED (0 console errors, 0 page exceptions)')
  } finally {
    await statsCdp?.close()
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
  console.error('[verify-plugin-menu] FAILED:', err)
  process.exit(1)
})
