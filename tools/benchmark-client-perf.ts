#!/usr/bin/env npx tsx
/**
 * Real-Page Headless Chrome (WebGL2 + 2D Canvas) Performance Benchmark for Milestone [M22]
 * (`tools/benchmark-client-perf.ts`).
 *
 * Launches `play.html` in Headless Chrome via CDP against Vite (`D2W_PUBLIC_DIR`), waits for all
 * in-game packs (`assetsReadyPromise`), and runs 5 deterministic benchmark scenarios covering:
 *   1. `rogue_rain_automap_walk`: Act 1 Rogue Encampment + 256-particle Rain + Automap Open + Walking
 *   2. `combat_swarm_additive_cull`: Dense Combat (40 visible monsters with glows/overlays + 35 additive
 *      missiles + 80 off-screen monsters + 40 off-screen ground items within 250 sub-tiles)
 *   3. `hud_panels_loot_beams_font`: Character + Inventory Panels Open + 12 Unique/Set Ground Loot Beams
 *      + Ground Labels + Chat Overlay (static mouse/data across frames)
 *   4. `hud_world_sync_events`: 200 non-fast-path server events flowing through `HudModel.syncFromWorld`
 *   5. `pathfind_local_astar`: 200 obstructed local A* pathfinding queries (`dist <= 18` sub-tiles) on LevelView
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
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

  async close(): Promise<void> {
    try {
      this.ws.close()
    } catch {
      // ignore
    }
  }
}

async function run(): Promise<void> {
  const outArg = process.argv.slice(2).find((a) => a.startsWith('--out='))
  const outPath = outArg
    ? resolve(outArg.slice('--out='.length))
    : resolve(ROOT_DIR, 'scratch/m22-benchmark.json')

  const chromeBin = findChromeBinary()
  const defaultPublic = existsSync(resolve(ROOT_DIR, 'public/act-packs/tiles/index.json'))
    ? resolve(ROOT_DIR, 'public')
    : resolve(ROOT_DIR, '../../public')
  const publicDir = process.env.D2W_PUBLIC_DIR
    ? resolve(process.env.D2W_PUBLIC_DIR)
    : defaultPublic

  if (!existsSync(join(publicDir, 'act-packs/tiles/index.json'))) {
    throw new Error(`Missing packed tiles under ${publicDir}`)
  }

  let viteServer: ViteDevServer | null = null
  const userDataDir = mkdtempSync(join(tmpdir(), 'd2-m22-bench-'))
  let chromeProc: ReturnType<typeof spawn> | null = null
  let cdp: CdpSession | null = null

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
    console.log(`[m22-bench] Vite listening at ${playUrl}`)

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
        '--window-size=1280,720',
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
    if (!cdpPort) throw new Error('Chrome failed to write DevToolsActivePort')

    let pageTarget: { readonly url: string; readonly webSocketDebuggerUrl: string } | null = null
    for (let i = 0; i < 100; i++) {
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
    if (!pageTarget) throw new Error('Failed to find page target')

    cdp = await CdpSession.connect(pageTarget.webSocketDebuggerUrl)
    await cdp.send('Page.navigate', { url: playUrl })

    for (let i = 0; i < 300; i++) {
      await sleep(200)
      const ready = await cdp.evaluate<boolean>(
        'Boolean(window.__d2PlayApp && window.__d2PlayApp.ready)',
      )
      if (ready) break
    }

    const benchResult = await cdp.evaluate<any>(`(async () => {
      const app = window.__d2PlayApp;
      if (!app || !app.ready) throw new Error('PlayApp not ready');
      await app.assetsReadyPromise;

      const session = app.session;
      const renderer = app.renderer;
      const gl = renderer.gl;
      const hudCanvas = document.querySelector('#d2-hud-canvas');
      const hudCtx = hudCanvas.getContext('2d');
      if (!hudCtx) throw new Error('Missing #d2-hud-canvas 2d context');

      // Stop background rAF loop so benchmark controls frame stepping deterministically
      app.settingsStore.set('worldRenderFps', 60);

      // Instrument WebGL2 and 2D Canvas calls
      const counters = {
        bufferSubData: 0,
        texSubImage2D: 0,
        createGradient: 0,
        hudClearRect: 0,
        reset() {
          this.bufferSubData = 0;
          this.texSubImage2D = 0;
          this.createGradient = 0;
          this.hudClearRect = 0;
        }
      };

      const origBufferSubData = gl.bufferSubData.bind(gl);
      gl.bufferSubData = function(...args) {
        counters.bufferSubData++;
        return origBufferSubData(...args);
      };

      const origTexSubImage2D = gl.texSubImage2D.bind(gl);
      gl.texSubImage2D = function(...args) {
        counters.texSubImage2D++;
        return origTexSubImage2D(...args);
      };

      const origCreateLinear = hudCtx.createLinearGradient.bind(hudCtx);
      hudCtx.createLinearGradient = function(...args) {
        counters.createGradient++;
        return origCreateLinear(...args);
      };

      const origCreateRadial = hudCtx.createRadialGradient.bind(hudCtx);
      hudCtx.createRadialGradient = function(...args) {
        counters.createGradient++;
        return origCreateRadial(...args);
      };

      const origClearRect = hudCtx.clearRect.bind(hudCtx);
      hudCtx.clearRect = function(...args) {
        counters.hudClearRect++;
        return origClearRect(...args);
      };

      // Attach mock game server & enter in-game view
      let emit = null;
      session.selectedCharValue = 'BenchHero';
      session.charactersValue = [{
        name: 'BenchHero', charClass: 1, level: 85, hardcore: false, dead: false, expansion: true, ladder: false,
        act: 1, difficulty: 2, progression: 12, expiresAt: 0,
        equipmentGraphics: new Uint8Array(9), rawStatString: new Uint8Array(33),
      }];
      session.flow = {
        state: 'ingame',
        leaveToLobby: async () => {},
        close: async () => {},
      };
      session.attachGameServer({
        isConnected: true,
        stats: { packetsIn: 0, packetsOut: 0, bytesIn: 0, bytesOut: 0, rttMs: 10, unknownPackets: 0 },
        connect: async () => {},
        disconnect: () => {},
        send: () => {},
        onEvent: (cb) => { emit = cb; return () => { emit = null; }; },
      });

      emit({ type: 'GameFlags', difficulty: 2, unknown1: 0, hardcore: false, expansion: true, ladder: false });
      emit({ type: 'LoadAct', act: 0, mapSeed: 0x12345678, areaId: 1 });

      const levelView = session.mapService.getLevelView(1);
      const spawnSubX = levelView.originX + levelView.spawnX * 5 + 2;
      const spawnSubY = levelView.originY + levelView.spawnY * 5 + 2;

      emit({
        type: 'UnitAssign',
        isSelf: true,
        unit: {
          unitType: 0,
          id: 1,
          classId: 1, // Sorceress
          name: 'BenchHero',
          x: spawnSubX,
          y: spawnSubY,
          lifePct: 128,
          mode: 1,
        },
      });
      emit({
        type: 'PlayerStatsSnapshot',
        stats: {
          strength: 120, energy: 150, dexterity: 100, vitality: 220,
          statPts: 10, newSkills: 2,
          hp: 950, maxHp: 950, mana: 800, maxMana: 800,
          stamina: 400, maxStamina: 400,
          level: 85, experience: 1000000000, gold: 500000, stashGold: 2500000,
        },
      });

      // Wait a moment for any async level/character assets
      app.renderFrame(performance.now());
      await new Promise((r) => setTimeout(r, 400));
      // Freeze background rAF loop so benchmark frames are 100% deterministic
      window.requestAnimationFrame = () => 0;

      function summarizeFrames(times, drawCalls, quads, bufSub, texSub, grads, hudClears) {
        const sorted = [...times].sort((a, b) => a - b);
        const sum = times.reduce((a, b) => a + b, 0);
        const avg = sum / times.length;
        const p50 = sorted[Math.floor(sorted.length * 0.5)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const avgOf = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
        return {
          frames: times.length,
          avgFrameMs: Number(avg.toFixed(3)),
          p50FrameMs: Number(p50.toFixed(3)),
          p95FrameMs: Number(p95.toFixed(3)),
          equivalentFps: Number((1000 / avg).toFixed(1)),
          avgDrawCalls: Number(avgOf(drawCalls).toFixed(2)),
          avgQuadsSubmitted: Number(avgOf(quads).toFixed(1)),
          avgBufferSubDataCalls: Number(avgOf(bufSub).toFixed(2)),
          avgTexSubImage2DCalls: Number(avgOf(texSub).toFixed(2)),
          avgCanvasGradients: Number(avgOf(grads).toFixed(2)),
          avgHudClearRects: Number(avgOf(hudClears).toFixed(2)),
        };
      }

      const results = {};

      // =========================================================================
      // SCENARIO 1: Act 1 Town + 256-particle Rain + Automap Open + Walking
      // =========================================================================
      {
        let simTime = performance.now();
        session.logicClock.reset(simTime);
        session.weather.onLoadAct(1);
        app.renderFrame(simTime);
        session.weather.setOverride('rain');
        session.weather.sim.maxValue = 256;
        session.weather.sim.targetValue = 256;
        for (let t = 0; t < 150; t++) {
          simTime += 40;
          session.tick(40, simTime);
          app.renderFrame(simTime);
        }
        session.hudModel.automapVisible = true;
        app.minimap.visible = true;
        app.hudManager.leftPanel = 'none';
        app.hudManager.rightPanel = 'none';
        app.hudManager.showGroundLabels = false;

        // Reveal all rooms on automap so automap has realistic static icon density
        session.automapView.setMode('level');
        app.minimap.mode = 'full';
        app.minimap.bMinimap = 0;

        const selfPlayer = session.world.player;
        const selfUnit = session.world.getUnit('player', 1);

        // Warmup 25 frames
        for (let i = 0; i < 25; i++) {
          simTime += 16.67;
          const offset = (i % 20) * 0.35;
          const nx = spawnSubX + offset;
          const ny = spawnSubY + offset * 0.5;
          selfPlayer.x = nx;
          selfPlayer.y = ny;
          if (selfUnit) { selfUnit.x = nx; selfUnit.y = ny; }
          session.predictor.setPosition(nx, ny);
          app.renderFrame(simTime);
          await new Promise((r) => setTimeout(r, 0));
        }

        const times = [], drawCalls = [], quads = [], bufSub = [], texSub = [], grads = [], hudClears = [];
        for (let i = 0; i < 100; i++) {
          simTime += 16.67;
          // Smooth sub-tile walking so playerClientX / offsetX changes almost every frame
          const offset = (i % 40) * 0.25;
          const nx = spawnSubX + offset;
          const ny = spawnSubY + offset * 0.5;
          selfPlayer.x = nx;
          selfPlayer.y = ny;
          if (selfUnit) { selfUnit.x = nx; selfUnit.y = ny; }
          session.predictor.setPosition(nx, ny);

          counters.reset();
          const t0 = performance.now();
          app.renderFrame(simTime);
          const t1 = performance.now();

          times.push(t1 - t0);
          drawCalls.push(renderer.drawCalls);
          quads.push(renderer.quadsSubmitted);
          bufSub.push(counters.bufferSubData);
          texSub.push(counters.texSubImage2D);
          grads.push(counters.createGradient);
          hudClears.push(counters.hudClearRect);
          // Yield microtask so any ImageBitmap promise settles just like real rAF
          await new Promise((r) => setTimeout(r, 0));
        }

        results.rogue_rain_automap_walk = summarizeFrames(
          times, drawCalls, quads, bufSub, texSub, grads, hudClears
        );
        session.weather.setOverride('off');
        session.hudModel.automapVisible = false;
        app.minimap.visible = false;
        selfPlayer.x = spawnSubX;
        selfPlayer.y = spawnSubY;
        if (selfUnit) { selfUnit.x = spawnSubX; selfUnit.y = spawnSubY; }
        session.predictor.setPosition(spawnSubX, spawnSubY);
      }

      // =========================================================================
      // SCENARIO 2: Dense Combat + Glows + Additive Missiles + Out-of-View Units
      // =========================================================================
      {
        // Spawn 36 visible monsters around player with states + overlays + boss/champ flags
        for (let i = 0; i < 36; i++) {
          const ring = 3 + (i % 6) * 2;
          const angle = (i / 36) * Math.PI * 2;
          const mx = Math.round(spawnSubX + Math.cos(angle) * ring);
          const my = Math.round(spawnSubY + Math.sin(angle) * ring);
          emit({
            type: 'UnitAssign',
            isSelf: false,
            unit: {
              unitType: 1,
              id: 2000 + i,
              classId: (i % 5) + 1, // Fallen / Skeleton / Zombie
              x: mx,
              y: my,
              lifePct: 100,
              mode: 2,
              isChampion: i % 3 === 0,
              isUnique: i % 5 === 0,
            },
          });
          const mon = session.world.getUnit('monster', 2000 + i);
          if (mon) {
            mon.states.add(8); // Salvation / aura state
            mon.states.add(9); // Amplify Damage
            session.world.attachUnitOverlay(mon, 'lightning', false);
          }
        }

        // Spawn 80 off-screen monsters (distance 60..180 sub-tiles, inside old 250 radius!)
        for (let i = 0; i < 80; i++) {
          const dist = 70 + (i % 100);
          const angle = (i / 80) * Math.PI * 2;
          const mx = Math.round(spawnSubX + Math.cos(angle) * dist);
          const my = Math.round(spawnSubY + Math.sin(angle) * dist);
          emit({
            type: 'UnitAssign',
            isSelf: false,
            unit: {
              unitType: 1,
              id: 3000 + i,
              classId: (i % 5) + 1,
              x: mx,
              y: my,
              lifePct: 128,
              mode: 1,
            },
          });
          const mon = session.world.getUnit('monster', 3000 + i);
          if (mon) {
            mon.states.add(1);
            mon.states.add(2);
            mon.states.add(3);
          }
        }

        // Spawn 40 off-screen ground items (distance 65..160 sub-tiles)
        for (let i = 0; i < 40; i++) {
          const dist = 65 + i * 2;
          const ix = spawnSubX + dist;
          const iy = spawnSubY + dist;
          emit({
            type: 'WorldItemAction',
            action: 3,
            item: {
              id: 4000 + i,
              code: i % 2 === 0 ? 'lsd' : 'chn',
              category: 1,
              quality: 7, // Unique
              itemLevel: 85,
              worldX: ix,
              worldY: iy,
              x: ix,
              y: iy,
              location: 3, // ground
              container: 'ground',
              identified: true,
              stats: [{ statId: 17, param: 0, value: 180 }],
            },
          });
        }

        // Spawn 32 active additive missiles (fireball, chargedbolt, lightning) around player
        const missileKeys = ['fireball', 'chargedbolt', 'lightning', 'icebolt'];
        for (let i = 0; i < 32; i++) {
          const angle = (i / 32) * Math.PI * 2;
          const tx = spawnSubX + Math.cos(angle) * 14;
          const ty = spawnSubY + Math.sin(angle) * 14;
          session.world.spawnMissileByKey(
            missileKeys[i % missileKeys.length],
            spawnSubX + Math.cos(angle) * 2,
            spawnSubY + Math.sin(angle) * 2,
            tx,
            ty,
            { ownerType: 'player', ownerId: 1, maxTicks: 500, pierce: true }
          );
        }

        let simTime = performance.now() + 5000;
        // Let entity & missile art load during warmup
        for (let i = 0; i < 35; i++) {
          simTime += 20;
          app.renderFrame(simTime);
          await new Promise((r) => setTimeout(r, 10));
        }

        const times = [], drawCalls = [], quads = [], bufSub = [], texSub = [], grads = [], hudClears = [];
        for (let i = 0; i < 100; i++) {
          simTime += 16.67;
          // Nudge missile coordinates each frame to exercise dynamic LightGrid updates
          for (const m of session.world.units.values()) {
            if (m.unitType !== 'missile') continue;
            m.x = spawnSubX + ((i + m.id) % 12) - 6;
            m.y = spawnSubY + ((i + m.id * 3) % 12) - 6;
            m.ageTicks = 1;
            m.maxTicks = 500;
          }
          counters.reset();
          const t0 = performance.now();
          app.renderFrame(simTime);
          const t1 = performance.now();

          times.push(t1 - t0);
          drawCalls.push(renderer.drawCalls);
          quads.push(renderer.quadsSubmitted);
          bufSub.push(counters.bufferSubData);
          texSub.push(counters.texSubImage2D);
          grads.push(counters.createGradient);
          hudClears.push(counters.hudClearRect);
        }

        results.combat_swarm_additive_cull = summarizeFrames(
          times, drawCalls, quads, bufSub, texSub, grads, hudClears
        );

        // Clean up combat units & missiles before Scenario 3
        for (let i = 0; i < 36; i++) {
          emit({ type: 'UnitRemove', unitType: 1, id: 2000 + i });
        }
        for (let i = 0; i < 80; i++) {
          emit({ type: 'UnitRemove', unitType: 1, id: 3000 + i });
        }
        for (let i = 0; i < 40; i++) {
          emit({ type: 'UnitRemove', unitType: 4, id: 4000 + i });
        }
        for (const m of [...session.world.units.values()]) {
          if (m.unitType === 'missile') {
            emit({ type: 'UnitRemove', unitType: 3, id: m.id });
          }
        }
      }

      // =========================================================================
      // SCENARIO 3: HUD Panels Open + 12 Unique/Set Ground Loot Beams + Fonts
      // =========================================================================
      {
        app.hudManager.leftPanel = 'char';
        app.hudManager.rightPanel = 'inv';
        app.hudManager.showGroundLabels = true;
        app.hudManager.setGroundItemEnhancements({
          showUniqueSetBeams: true,
          alwaysShowUniqueSetLabels: true,
        });

        // Spawn 12 visible Unique & Set items right around player (emitting loot beams + labels)
        for (let i = 0; i < 12; i++) {
          const dx = (i % 4) * 2 - 3;
          const dy = Math.floor(i / 4) * 2 - 2;
          const ix = spawnSubX + dx;
          const iy = spawnSubY + dy;
          emit({
            type: 'WorldItemAction',
            action: 3,
            item: {
              id: 5000 + i,
              code: i % 2 === 0 ? 'lsd' : 'chn',
              category: 1,
              quality: i % 2 === 0 ? 7 : 5, // 7 = Unique, 5 = Set
              itemLevel: 85,
              worldX: ix,
              worldY: iy,
              x: ix,
              y: iy,
              location: 3,
              container: 'ground',
              identified: true,
              stats: [],
            },
          });
        }

        let simTime = performance.now() + 25000;
        for (let i = 0; i < 20; i++) {
          simTime += 45;
          app.renderFrame(simTime);
        }

        const times = [], drawCalls = [], quads = [], bufSub = [], texSub = [], grads = [], hudClears = [];
        for (let i = 0; i < 100; i++) {
          simTime += 45;
          counters.reset();
          const t0 = performance.now();
          app.renderFrame(simTime);
          const t1 = performance.now();

          times.push(t1 - t0);
          drawCalls.push(renderer.drawCalls);
          quads.push(renderer.quadsSubmitted);
          bufSub.push(counters.bufferSubData);
          texSub.push(counters.texSubImage2D);
          grads.push(counters.createGradient);
          hudClears.push(counters.hudClearRect);
        }

        results.hud_panels_loot_beams_font = summarizeFrames(
          times, drawCalls, quads, bufSub, texSub, grads, hudClears
        );

        for (let i = 0; i < 12; i++) {
          emit({ type: 'UnitRemove', unitType: 4, id: 5000 + i });
        }
        app.hudManager.leftPanel = 'none';
        app.hudManager.rightPanel = 'none';
        app.hudManager.showGroundLabels = false;
        app.hudManager.setGroundItemEnhancements({
          showUniqueSetBeams: false,
          alwaysShowUniqueSetLabels: false,
        });
      }

      // =========================================================================
      // SCENARIO 4: 200 Non-Fast-Path Server Events -> HudModel.syncFromWorld
      // =========================================================================
      {
        // Populate player skill levels and states so syncFromWorld exercises realistic work
        const selfPlayer = session.world.player;
        selfPlayer.states.add(8);
        selfPlayer.states.add(16);
        selfPlayer.states.add(32);
        for (let sk = 36; sk <= 65; sk++) {
          selfPlayer.skills.set(sk, 10);
        }

        // Warmup
        for (let i = 0; i < 20; i++) {
          session.hudModel.syncFromWorld(session.world);
        }

        const iterations = 200;
        const t0 = performance.now();
        for (let i = 0; i < iterations; i++) {
          // Simulate non-equipment world sync (e.g. Quest/Waypoint/Party/GroundItem update)
          session.hudModel.syncFromWorld(session.world);
        }
        const totalMs = performance.now() - t0;
        results.hud_world_sync_events = {
          iterations,
          totalMs: Number(totalMs.toFixed(3)),
          avgCallMs: Number((totalMs / iterations).toFixed(4)),
          opsPerSec: Math.round((iterations * 1000) / totalMs),
        };
      }

      // =========================================================================
      // SCENARIO 5: 200 Local Obstacle Avoidance A* Queries (findPathWorld)
      // =========================================================================
      {
        const { findPathWorld } = await import('/src/client/motion/pathfind.ts');
        // Find an obstructed pair within 14 sub-tiles on levelView, or temporarily block the midpoint
        const midX = spawnSubX + 5;
        const midY = spawnSubY;
        const goalX = spawnSubX + 10;
        const goalY = spawnSubY;
        const localMidIdx = (midY - levelView.originY) * levelView.subWidth + (midX - levelView.originX);
        const origWalkable = levelView.walkable[localMidIdx];
        levelView.walkable[localMidIdx] = 0; // Block midpoint so straight ray is obstructed & A* runs

        // Warmup
        for (let i = 0; i < 15; i++) {
          findPathWorld(levelView, spawnSubX, spawnSubY, goalX, goalY, { unitSize: 2 });
        }

        const iterations = 200;
        const t0 = performance.now();
        let totalExpanded = 0;
        for (let i = 0; i < iterations; i++) {
          const res = findPathWorld(levelView, spawnSubX, spawnSubY, goalX, goalY + (i % 3) - 1, { unitSize: 2 });
          totalExpanded += res.expandedNodes;
        }
        const totalMs = performance.now() - t0;
        levelView.walkable[localMidIdx] = origWalkable;

        results.pathfind_local_astar = {
          iterations,
          gridCells: levelView.subWidth * levelView.subHeight,
          avgExpandedNodes: Number((totalExpanded / iterations).toFixed(1)),
          totalMs: Number(totalMs.toFixed(3)),
          avgCallMs: Number((totalMs / iterations).toFixed(4)),
          opsPerSec: Math.round((iterations * 1000) / totalMs),
        };
      }

      return results;
    })()`)

    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, JSON.stringify(benchResult, null, 2))
    console.log('[m22-bench] Results written to', outPath)
    console.log(JSON.stringify(benchResult, null, 2))
  } finally {
    await cdp?.close()
    if (chromeProc && !chromeProc.killed) {
      chromeProc.kill('SIGKILL')
    }
    if (viteServer) {
      await viteServer.close()
    }
    try {
      rmSync(userDataDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}

run().catch((err) => {
  console.error('[m22-bench] FAILED:', err)
  process.exit(1)
})
