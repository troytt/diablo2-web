#!/usr/bin/env npx tsx
/**
 * Headless Chrome + CDP End-to-End Visual Verifier for Issue #873 Quest FX Missiles:
 * - Den of Evil cleared: Missile 287 (denofevillight / LightBeams) + Light = 10 white light source
 * - Stony Field Cairn Stones activation: Missile 288 (cairnstones) -> 384 (cairn stones bolt) -> 290/99 (lightning) + sound 2255
 * - Diablo Appears: Missile 372 (diablo appears) -> Screen shake (amp 25, 4000ms) at rem=150 + Diablo taunt sound 4638 at rem=50
 *
 * Verifies with WebGL2 SwiftShader in headless Chrome and captures screenshots to `scratch/verify-quest-fx/`.
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
const OUT_DIR = resolve(ROOT_DIR, 'scratch/verify-quest-fx')

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
  const publicDir = resolve(ROOT_DIR, 'public')

  const d2capPath = resolve(ROOT_DIR, 'tests/fixtures/netproto/02-d2gs-town-walk-chat.d2cap')
  assert(existsSync(d2capPath), `Missing fixture at ${d2capPath}`)
  const d2capJsonl = readFileSync(d2capPath, 'utf8')

  let viteServer: ViteDevServer | null = null
  const userDataDir = mkdtempSync(join(tmpdir(), 'd2-verify-quest-fx-'))
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
    console.log(`[verify-quest-fx] Vite server listening at ${targetUrl}`)

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
    console.log('[verify-quest-fx] Waiting for play.html bootstrap...')
    let ready = false
    for (let i = 0; i < 120; i++) {
      await sleep(250)
      try {
        ready = await cdp.evaluate<boolean>(`Boolean(window.__d2PlayApp && window.__d2PlayApp.ready)`)
        if (ready) break
        if (i % 20 === 0) {
          const loc = await cdp.evaluate<string>(`window.location.href`)
          console.log(`[verify-quest-fx] Waiting (tick ${i})... loc: ${loc}, consoleErrors: ${cdp.consoleErrors.length}, exceptions: ${cdp.pageExceptions.length}`)
          if (cdp.consoleErrors.length > 0) console.log('  console:', cdp.consoleErrors)
          if (cdp.pageExceptions.length > 0) console.log('  exceptions:', cdp.pageExceptions)
        }
      } catch (err) {
        console.log(`[verify-quest-fx] eval error at ${i}:`, err)
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

    // Load replay fixture
    console.log('[verify-quest-fx] Replaying town fixture into session...')
    const replayCount = await cdp.evaluate<number>(`(async () => {
      const app = window.__d2Play;
      await app.assetsReadyPromise;
      const count = app.replayD2Cap(${JSON.stringify(d2capJsonl)});
      app.renderFrame(performance.now());
      return count;
    })()`)
    console.log(`[verify-quest-fx] Replayed ${replayCount} packets into session`)

    // ─── Gate 1: Den of Evil Cleared (Light Beams + Light Source) ───────────
    console.log('[verify-quest-fx] Gate 1: Testing Den of Evil cleared light beams...')
    const gate1 = await cdp.evaluate<{
      missileCount: number
      denLightMissiles: { id: number; classId: number; missileKey: string; x: number; y: number }[]
      drawables: {
        missileCount: number
        hasLightBeams: boolean
        lightRadius: number
        lightColor: [number, number, number]
      }
      lightEmitters: { unitType: number; lightType: number; radius: number }[]
    }>(`(async () => {
      const app = window.__d2Play;
      const world = app.session.world;
      const px = Math.round(world.self.x) || 7500;
      const py = Math.round(world.self.y) || 5000;

      // Spawn Den of Evil light beams around player
      world.spawnDenOfEvilLightsInRoom(px - 10, py - 10, 20, 20);

      // Tick 1 frame and render
      app.session.tick(40, performance.now());
      app.renderFrame(performance.now());

      const missiles = world.getUnitsByType('missile');
      const denMissiles = missiles
        .filter((m) => m.classId === 287)
        .map((m) => ({ id: m.id, classId: m.classId, missileKey: m.missileKey, x: m.x, y: m.y }));

      const { buildSceneDrawables } = await import('/src/client/view/unit-drawables.ts');
      const sceneDrawables = buildSceneDrawables(
        app.session.buildRenderableUnits(),
        { originX: 0, originY: 0, tick: 0 },
      );
      const lightBeamsDrawable = sceneDrawables.missileDrawables.find(
        (d) => d.missileClassId === 287 || d.celFile === 'LightBeams'
      );
      const lighting = app.session.sceneSource.buildLightingInputs('auto');
      const lightEmitter = lighting.lightEmitters.find(
        (e) => e.radius === 10 && e.lightType === 1
      );

      return {
        missileCount: missiles.length,
        denLightMissiles: denMissiles,
        drawables: {
          missileCount: sceneDrawables.missileDrawables.length,
          hasLightBeams: Boolean(lightBeamsDrawable),
          lightRadius: lightBeamsDrawable?.lightRadius ?? 0,
          lightColor: lightBeamsDrawable?.lightColor ?? [0, 0, 0],
        },
        lightEmitters: lighting.lightEmitters.map((e) => ({
          unitType: e.unitType,
          lightType: e.lightType,
          radius: e.radius,
        })),
      };
    })()`)

    console.log('[verify-quest-fx] Gate 1 Result:', gate1)
    assert(gate1.denLightMissiles.length > 0, 'Expected at least 1 denofevillight missile')
    assert(gate1.drawables.hasLightBeams, 'Expected LightBeams missile drawable')
    assert(gate1.drawables.lightRadius === 10, 'Expected LightBeams lightRadius === 10')
    assert(
      JSON.stringify(gate1.drawables.lightColor) === JSON.stringify([255, 255, 255]),
      'Expected LightBeams white light source [255, 255, 255]',
    )

    const shot1 = join(OUT_DIR, '01-den-of-evil-light-beams.png')
    const shot1Bytes = await cdp.captureScreenshot(shot1)
    console.log(`[verify-quest-fx] Captured ${shot1} (${shot1Bytes} bytes) — Den of Evil Light Beams`)

    // ─── Gate 2: Stony Field Cairn Stones Activation (Lightning) ───────────
    console.log('[verify-quest-fx] Gate 2: Testing Stony Field Cairn Stones activation...')
    const gate2 = await cdp.evaluate<{
      phaseASpawned: boolean
      skyBolts: number
      groundBolts: number
      lightningHit: number
    }>(`(async () => {
      const app = window.__d2Play;
      const world = app.session.world;
      const px = Math.round(world.self.x) || 7500;
      const py = Math.round(world.self.y) || 5000;

      // Spawn 5 Cairn Stones objects (classes 17..21) around player
      const stonePositions = [
        { id: 9101, classId: 17, x: px, y: py },
        { id: 9102, classId: 18, x: px + 6, y: py - 4 },
        { id: 9103, classId: 19, x: px + 10, y: py + 4 },
        { id: 9104, classId: 20, x: px - 6, y: py + 6 },
        { id: 9105, classId: 21, x: px - 8, y: py - 5 },
      ];
      for (const s of stonePositions) {
        world.apply({
          type: 'UnitAssign',
          unit: {
            unitType: 2,
            id: s.id,
            classId: s.classId,
            x: s.x,
            y: s.y,
            mode: 0,
          },
        });
      }

      // Spawn Cairn Stones controller at player position
      world.spawnCairnStonesController(px, py);

      // Step 45 ticks: triggers Phase A (missile 384 sky bolts descending from alt 280)
      let skyBolts = 0;
      for (let i = 0; i < 45; i++) {
        world.tick();
        if (world.getUnitsByType('missile').some((m) => m.classId === 384)) {
          skyBolts++;
        }
      }
      app.renderFrame(performance.now());

      // Step 110 more ticks (age reaches 155): triggers Phase B (missiles 290 and 99 ground lightning)
      let groundBolts = 0;
      let lightningHit = 0;
      for (let i = 0; i < 110; i++) {
        world.tick();
        const missiles = world.getUnitsByType('missile');
        if (missiles.some((m) => m.classId === 290)) groundBolts++;
        if (missiles.some((m) => m.classId === 99)) lightningHit++;
      }
      app.renderFrame(performance.now());

      return {
        phaseASpawned: skyBolts > 0,
        skyBolts,
        groundBolts,
        lightningHit,
      };
    })()`)

    console.log('[verify-quest-fx] Gate 2 Result:', gate2)
    assert(gate2.phaseASpawned, 'Expected cairn stones bolt (384) in Phase A')
    assert(gate2.groundBolts > 0, 'Expected cairnstonesground (290) in Phase B')

    const shot2 = join(OUT_DIR, '02-cairn-stones-lightning.png')
    const shot2Bytes = await cdp.captureScreenshot(shot2)
    console.log(`[verify-quest-fx] Captured ${shot2} (${shot2Bytes} bytes) — Cairn Stones Lightning`)

    // ─── Gate 3: Diablo Appears (Screen Shake) ──────────────────────────────
    console.log('[verify-quest-fx] Gate 3: Testing Diablo Appears (Event 12)...')
    const gate3 = await cdp.evaluate<{
      controllerSpawned: boolean
      shakeAt150: { active: boolean; amplitude: number; offsetX: number; offsetY: number }
      cameraOffset: { dx: number; dy: number }
    }>(`(async () => {
      const app = window.__d2Play;
      const world = app.session.world;
      const px = Math.round(world.self.x) || 7500;
      const py = Math.round(world.self.y) || 5000;

      // Spawn Diablo Appears controller (missile 372)
      world.spawnDiabloAppearsController(px, py);
      const controller = world.getUnitsByType('missile').find((m) => m.classId === 372);

      // Step 155 ticks to reach rem = 150 (happens at tick 151): screen shake begins
      for (let i = 0; i < 155; i++) {
        world.tick(40);
      }
      const shakeAt150 = {
        active: world.screenShake.active,
        amplitude: world.screenShake.amplitude,
        offsetX: world.screenShake.offsetX,
        offsetY: world.screenShake.offsetY,
      };

      const cam1 = app.session.sceneSource.getCameraTopLeft();

      // Step 105 more ticks to reach rem = 50 (happens at tick 251)
      for (let i = 0; i < 105; i++) {
        world.tick(40);
      }

      app.renderFrame(performance.now());
      const cam2 = app.session.sceneSource.getCameraTopLeft();

      return {
        controllerSpawned: Boolean(controller),
        shakeAt150,
        cameraOffset: {
          dx: cam2.x - cam1.x,
          dy: cam2.y - cam1.y,
        },
      };
    })()`)

    console.log('[verify-quest-fx] Gate 3 Result:', gate3)
    assert(gate3.controllerSpawned, 'Expected diablo appears controller (372)')
    assert(gate3.shakeAt150.active, 'Expected screen shake active at rem=150')
    assert(gate3.shakeAt150.amplitude === 25, 'Expected screen shake amplitude === 25')

    const shot3 = join(OUT_DIR, '03-diablo-appears-screenshake.png')
    const shot3Bytes = await cdp.captureScreenshot(shot3)
    console.log(`[verify-quest-fx] Captured ${shot3} (${shot3Bytes} bytes) — Diablo Appears Screen Shake`)

    // ─── Gate 4: A2Q6 staff in orifice (special quest event 3, Issue #915) ──────
    console.log('[verify-quest-fx] Gate 4: Testing A2Q6 staff in orifice (Event 3)...')
    const gate4Snapshot = `(() => {
      const app = window.__d2Play;
      const world = app.session.world;
      return import('/src/client/view/unit-drawables.ts').then(({ buildSceneDrawables }) => {
        const scene = buildSceneDrawables(app.session.buildRenderableUnits(), { originX: 0, originY: 0, tick: 0 });
        const count = (key) => scene.missileDrawables.filter((d) => d.missileKey === key).length;
        const staff = world.getUnitsByType('missile').find((m) => m.missileKey === 'horadricstaff');
        return {
          staff: count('horadricstaff'),
          staffAltitude: staff ? staff.altitude : -1,
          beams: count('horadriclight'),
          lightning: count('horadriclightning'),
          dust: count('dust'),
          lightJet: scene.overlayDrawables.filter((o) => o.token === 'light_jet').length,
          shake: { active: world.screenShake.active, amplitude: world.screenShake.amplitude },
        };
      });
    })()`
    const gate4Start = await cdp.evaluate<{ readonly staffId: number }>(`(async () => {
      const app = window.__d2Play;
      const world = app.session.world;
      const px = Math.round(world.self.x) || 7500;
      const py = Math.round(world.self.y) || 5000;
      world.apply({ type: 'UnitAssign', unit: { unitType: 2, id: 9915, classId: 152, x: px + 6, y: py + 2, mode: 1 } });
      const orifice = world.getUnit('object', 9915);
      const staff = world.spawnHoradricStaffAtOrifice(orifice);
      for (let i = 0; i < 20; i++) world.tick(40);
      app.renderFrame(performance.now());
      return { staffId: staff.id };
    })()`)
    const gate4a = await cdp.evaluate<any>(gate4Snapshot)
    console.log('[verify-quest-fx] Gate 4a (tick 20):', gate4a, gate4Start)
    assert(gate4a.staff === 1, 'Expected one horadricstaff (338) drawable')
    assert(gate4a.staffAltitude === 45, 'Expected the staff at 40 + 20/4 = 45 px after 20 ticks')
    assert(gate4a.lightJet === 1, 'Expected Overlay.txt 181 light_jet on the orifice')
    const shot4 = join(OUT_DIR, '04-a2q6-staff-light-jet.png')
    const shot4Bytes = await cdp.captureScreenshot(shot4)

    await cdp.evaluate(`(() => {
      const app = window.__d2Play;
      for (let i = 0; i < 200; i++) app.session.world.tick(40);
      app.renderFrame(performance.now());
      return true;
    })()`)
    const gate4b = await cdp.evaluate<any>(gate4Snapshot)
    console.log('[verify-quest-fx] Gate 4b (tick 220, rem 221):', gate4b)
    assert(gate4b.beams === 5, 'Expected the 5 beams of rem 325..225 (340 horadriclight)')
    assert(gate4b.staffAltitude === 70, 'Expected the staff to stop at 70 px')
    const shot5 = join(OUT_DIR, '05-a2q6-staff-light-beams.png')
    const shot5Bytes = await cdp.captureScreenshot(shot5)

    await cdp.evaluate(`(() => {
      const app = window.__d2Play;
      for (let i = 0; i < 80; i++) app.session.world.tick(40);
      app.renderFrame(performance.now());
      return true;
    })()`)
    const gate4c = await cdp.evaluate<any>(gate4Snapshot)
    console.log('[verify-quest-fx] Gate 4c (tick 300, rem 141):', gate4c)
    assert(gate4c.beams === 7, 'Expected all 7 beams alive with the staff')
    assert(gate4c.lightning > 0, 'Expected horadriclightning (339) towards the wall')
    assert(gate4c.dust > 0, 'Expected dust (150) at the wall')
    assert(gate4c.shake.active && gate4c.shake.amplitude === 25, 'Expected the rem 150 screen shake (amplitude 25)')
    const shot6 = join(OUT_DIR, '06-a2q6-staff-lightning-dust.png')
    const shot6Bytes = await cdp.captureScreenshot(shot6)
    const horadricMissingArt = cdp.missingArt.filter((t) =>
      /horadric|light_jet|lightjet|lightningstrike|firesmoke|\bdust\b/i.test(t),
    )
    assert(horadricMissingArt.length === 0, `Missing A2Q6 art: ${JSON.stringify(horadricMissingArt)}`)
    console.log(`[verify-quest-fx] Captured ${shot4} (${shot4Bytes}), ${shot5} (${shot5Bytes}), ${shot6} (${shot6Bytes})`)

    // Verify no unexpected errors
    if (cdp.consoleErrors.length > 0 || cdp.pageExceptions.length > 0) {
      throw new Error(`Unexpected errors: ${JSON.stringify({ console: cdp.consoleErrors, exceptions: cdp.pageExceptions })}`)
    }

    console.log(`\n======================================================`)
    console.log(`[verify-quest-fx] ALL GATES PASSED! Screenshots saved to:`)
    console.log(`  - ${shot1} (${shot1Bytes} bytes)`)
    console.log(`  - ${shot2} (${shot2Bytes} bytes)`)
    console.log(`  - ${shot3} (${shot3Bytes} bytes)`)
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
  console.error('[verify-quest-fx] FATAL:', err)
  process.exit(1)
})
