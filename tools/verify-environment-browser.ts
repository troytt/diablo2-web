#!/usr/bin/env npx tsx
/**
 * Headless Chrome + CDP verifier for the 1.13c day/night environment clock
 * (`tools/verify-environment-browser.ts`).
 *
 * Runs `play.html` against the live server through the Vite `/d2net` proxy (WebGL2 on SwiftShader):
 *
 *   Gate 1. Boot, Battle.net login (`d2webbot1`), character `WebBotOne`, create a game, Rogue Encampment.
 *   Gate 2. The server's S2C 0x53 arrived right after S2C 0x03 and was applied: no disconnect, and the
 *           clock's cycle row and eclipse flag match the packet.
 *   Gate 3. Four periods, each an S2C 0x53 fed into the live session (`handleS2cPacket`): Day (2, 11520),
 *           Dusk (4, 23040), Night (5, 34560), Dawn (0, 40960), then Day again. For each: the clock after
 *           the sync and after one 25 Hz frame against goldens from the independent reference model, the
 *           1.13c light grid (#830) prefill (every grid corner out of reach of every light record holds the
 *           clock light exactly), the campfire's mode and Objects.txt light, and a screenshot.
 *   Gate 4. All 136 levels: the scene is rendered with each level's ambient light in place of the
 *           Rogue Encampment's. The light grid and the uploaded lightmap must hold the level's light
 *           (Levels.txt from the MPQs, or the act clock when its RGB is 0), levels with the same light
 *           must render the same picture, and each colour channel of the picture must follow the
 *           lightmap channel (Pearson r >= 0.95 over the 136 levels).
 *   Gate 5. (Runs right after Gate 2.) Object lights (issue #827): every drawn object of the live Rogue
 *           Encampment carries exactly the light its MPQ Objects.txt `Lit[mode]` gives (SetObjectLight
 *           0x6fad4920: radius min(Lit >> 1, 18), intensity 255, Objects.txt RGB, on its sub-tile), and
 *           objects without one carry none; each lit object also owns exactly one type-2 record of the
 *           1.13c light list (issue #830: r = radius * 8, x8 = sub-tile * 8 + 4).
 *   Gate 6. (Runs right after Gate 5.) Quest special lights (issue #826, CLIENT_GetAmbientLight 0x6fb59a20
 *           steps 1-3): the game join delivered S2C 0x5E (the Den of Evil light FatalAsserts without it)
 *           and the session copy equals the world copy; in the fresh game no Act 4 red light and no fade
 *           are on, and the Den of Evil answer follows A1Q1 (availability byte 1).
 *   Gate 7. (Runs right after Gate 6.) Skill cast light (issue #876, 0x6fb50f60): Fire Bolt (36) ramps
 *           r = 16..56 (min(Light, 18) = 7) with RGB 255/178/64, Ice Bolt (39) replaces it with RGB
 *           81/81/255, and ending the cast frees the light record immediately.
 *   No console errors and no page exceptions.
 *
 * Env: `D2W_PUBLIC_DIR` (default `public/`, must hold `act-packs/tiles/index.json`), `D2_DATA_DIR`
 * (default `samples/d2`, must hold d2data.mpq / d2exp.mpq / Patch_D2.mpq), `CHROME_PATH` (Chrome
 * binary tried first by `tools/find-chrome.ts`; it must give WebGL2 on SwiftShader). Screenshots are
 * written to `scratch/verify-environment/`.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'
import { fileSource } from '../src/baker/io/file-source.ts'
import { MpqArchive } from '../src/common/mpq/archive.ts'
import { MountedArchives } from '../src/common/mpq/mount.ts'
import { cell, parseTable } from '../src/common/world/acts.ts'
import { findChromeBinary } from './find-chrome.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT_DIR, 'scratch/verify-environment')

/** One injected S2C 0x53 and the clock it must produce (scratch/time/env_ref.py, act I, level 1). */
interface PeriodCase {
  readonly name: string
  readonly cycleIndex: number
  readonly ticks: number
  /** Right after #10358 InitializeEnvironment (the colour is only updated by the next frame). */
  readonly afterSync: { readonly period: number; readonly ticks: number; readonly intensity: number }
  /** After one 25 Hz frame (#10135 UpdatePeriodOfDay). */
  readonly afterFrame: {
    readonly cycleIndex: number
    readonly period: number
    readonly ticks: number
    readonly intensity: number
    readonly rgb: readonly [number, number, number]
  }
  /** Campfire (Objects.txt 39) mode: 0 by day, 1 at dusk, night and dawn. */
  readonly fireMode: 0 | 1
}

const PERIOD_CASES: readonly PeriodCase[] = [
  {
    name: 'day',
    cycleIndex: 2,
    ticks: 11520,
    afterSync: { period: 0, ticks: 11520, intensity: 255 },
    afterFrame: { cycleIndex: 2, period: 0, ticks: 11521, intensity: 255, rgb: [255, 255, 255] },
    fireMode: 0,
  },
  {
    name: 'dusk',
    cycleIndex: 4,
    ticks: 23040,
    afterSync: { period: 1, ticks: 23040, intensity: 128 },
    afterFrame: { cycleIndex: 4, period: 1, ticks: 23041, intensity: 128, rgb: [194, 152, 193] },
    fireMode: 1,
  },
  {
    name: 'night',
    cycleIndex: 5,
    ticks: 34560,
    afterSync: { period: 2, ticks: 34560, intensity: 64 },
    afterFrame: { cycleIndex: 5, period: 2, ticks: 34562, intensity: 64, rgb: [125, 144, 243] },
    fireMode: 1,
  },
  {
    name: 'dawn',
    cycleIndex: 0,
    ticks: 40960,
    afterSync: { period: 3, ticks: 40960, intensity: 87 },
    afterFrame: { cycleIndex: 0, period: 3, ticks: 40961, intensity: 87, rgb: [125, 144, 243] },
    fireMode: 1,
  },
  {
    name: 'day-again',
    cycleIndex: 2,
    ticks: 11520,
    afterSync: { period: 0, ticks: 11520, intensity: 255 },
    afterFrame: { cycleIndex: 2, period: 0, ticks: 11521, intensity: 255, rgb: [255, 255, 255] },
    fireMode: 0,
  },
]

/** Objects.txt row 39 (fire, RB): Lit1 = 19 → radius 19 >> 1, colour 255/236/176, intensity 255. */
const CAMPFIRE_CLASS = 39
const CAMPFIRE_LIGHT = { radius: 9, intensity: 255, r: 255, g: 236, b: 176 } as const

/** Levels screenshotted in Gate 4 (clock, quest-lit, indoor, Act IV/V fixed outdoor). */
const LEVEL_SHOTS: ReadonlySet<number> = new Set([1, 8, 40, 75, 103, 108, 120, 132])

interface LevelLight {
  readonly id: number
  readonly name: string
  readonly intensity: number
  readonly red: number
  readonly green: number
  readonly blue: number
}

interface ClockState {
  readonly cycleIndex: number
  readonly period: number
  readonly ticks: number
  readonly intensity: number
  readonly rgb: readonly [number, number, number]
  readonly eclipse: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function fail(message: string, detail?: unknown): never {
  throw new Error(detail === undefined ? message : `${message}: ${JSON.stringify(detail)}`)
}

function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx
    const dy = ys[i]! - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  if (sxx === 0 || syy === 0) return 0
  return sxy / Math.sqrt(sxx * syy)
}

/** Levels.txt Intensity / Red / Green / Blue of levels 1..136, read from the 1.13c MPQs. */
async function loadLevelLights(): Promise<LevelLight[]> {
  const dir = resolve(ROOT_DIR, process.env.D2_DATA_DIR ?? 'samples/d2')
  const archives = new MountedArchives()
  for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    const path = join(dir, name)
    if (!existsSync(path)) fail(`Missing ${path}; set D2_DATA_DIR to the 1.13c MPQ directory`)
    archives.add(name, await MpqArchive.open(await fileSource(path)))
  }
  const table = parseTable(await archives.read('data\\global\\excel\\Levels.txt'))
  const byId = new Map<number, LevelLight>()
  for (const raw of table.rows) {
    const idText = cell(table, raw, 'Id').trim()
    if (idText === '') continue
    const num = (column: string): number => Number(cell(table, raw, column).trim() || '0')
    const id = Number(idText)
    if (byId.has(id)) fail(`Levels.txt has two rows for level ${String(id)}`)
    byId.set(id, {
      id,
      name: cell(table, raw, 'Name'),
      intensity: num('Intensity'),
      red: num('Red'),
      green: num('Green'),
      blue: num('Blue'),
    })
  }
  const lights: LevelLight[] = []
  for (let id = 1; id <= 136; id++) {
    const row = byId.get(id)
    if (row === undefined) fail(`Levels.txt has no row for level ${String(id)}`)
    lights.push(row)
  }
  return lights
}

/**
 * Objects.txt `Lit0..Lit7` and `Red` / `Green` / `Blue` by compiled record index (= the object classId), read
 * from the 1.13c MPQs. The index is the row order without the `Expansion` separator row (573 records); the `Id`
 * column is not the index (records 410..412 carry Ids 408..410).
 */
interface ObjectLightRow {
  readonly lit: readonly number[]
  readonly r: number
  readonly g: number
  readonly b: number
}

async function loadObjectLightRows(): Promise<ObjectLightRow[]> {
  const dir = resolve(ROOT_DIR, process.env.D2_DATA_DIR ?? 'samples/d2')
  const archives = new MountedArchives()
  for (const name of ['d2data.mpq', 'd2exp.mpq', 'Patch_D2.mpq']) {
    const path = join(dir, name)
    if (!existsSync(path)) fail(`Missing ${path}; set D2_DATA_DIR to the 1.13c MPQ directory`)
    archives.add(name, await MpqArchive.open(await fileSource(path)))
  }
  const table = parseTable(await archives.read('data\\global\\excel\\objects.txt'))
  const rows: ObjectLightRow[] = []
  for (const raw of table.rows) {
    if (cell(table, raw, 'Name').trim() === 'Expansion' && cell(table, raw, 'Id').trim() === '') continue
    const num = (column: string): number => Number(cell(table, raw, column).trim() || '0')
    rows.push({
      lit: [0, 1, 2, 3, 4, 5, 6, 7].map((m) => num(`Lit${String(m)}`)),
      r: num('Red'),
      g: num('Green'),
      b: num('Blue'),
    })
  }
  if (rows.length !== 573) fail(`objects.txt: ${String(rows.length)} records, expected 573`)
  return rows
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
          if (!text.includes('favicon.ico')) this.consoleErrors.push(text)
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

function readBotPassword(): string {
  const botAccountsPath = resolve(ROOT_DIR, 'scratch/bot-accounts.json')
  if (existsSync(botAccountsPath)) {
    const parsed = JSON.parse(readFileSync(botAccountsPath, 'utf8')) as {
      accounts?: Record<string, { password?: string }>
    }
    const password = parsed.accounts?.d2webbot1?.password
    if (password) return password
  }
  return 'd2w_1cbc5ea3d79d'
}

/** Browser-side snippet: the session's clock as a plain object. */
const CLOCK_JS = `(() => {
  const env = window.__d2Play.session.environment;
  return {
    cycleIndex: env.cycleIndex,
    period: env.period,
    ticks: env.ticks,
    intensity: env.intensity,
    rgb: [env.red, env.green, env.blue],
    eclipse: env.eclipse,
  };
})()`

async function bootAndEnterGame(cdp: CdpSession, botPassword: string): Promise<void> {
  let ready = false
  for (let i = 0; i < 150; i++) {
    const state = await cdp.evaluate<{ ready: boolean } | null>(
      `window.__d2Play ? { ready: Boolean(window.__d2Play.ready) } : null`,
    )
    if (state?.ready) {
      ready = true
      break
    }
    await sleep(200)
  }
  if (!ready) {
    fail('Timed out waiting for window.__d2Play.ready', {
      consoleErrors: cdp.consoleErrors,
      pageExceptions: cdp.pageExceptions,
    })
  }

  // Record the server event stream from the first game packet on.
  await cdp.evaluate(`(() => {
    const app = window.__d2Play;
    window.__envEvents = [];
    app.session.onServerEvent((ev) => {
      window.__envEvents.push({
        type: ev.type,
        unitType: ev.type === 'UnitAssign' ? ev.unit.unitType : undefined,
        cycleIndex: ev.cycleIndex,
        ticks: ev.ticks,
        eclipse: ev.eclipse,
      });
    });
  })()`)

  const login = await cdp.evaluate<{
    steps: { step: string; stage: string; phase: string; loginError: string | null; roster: string[] }[]
    lobbyStage: string
    sessionPhase: string
    selectedChar: string | null
    loginError: string | null
  }>(`(async () => {
    const app = window.__d2Play;
    const fr = app.frontendRenderer;
    const st = app.flowState;
    const steps = [];
    const note = (step) => steps.push({
      step,
      stage: st.stage,
      phase: app.session.phase,
      loginError: st.loginError ?? null,
      roster: st.roster.map((c) => c.name),
    });
    fr.handleMouseDown(400, 348, performance.now());
    fr.handleMouseUp(400, 348, performance.now());
    for (let i = 0; i < 20; i++) app.renderFrame(performance.now() + i * 40);
    note('bnet-button');
    st.accountName = '';
    st.accountPassword = '';
    st.activeInput = 'accountName';
    for (const ch of 'd2webbot1') fr.handleKeyDown(new KeyboardEvent('keydown', { key: ch }));
    // The login edit box caps typed passwords at 15 characters (flow-state.ts), but the
    // d2-bot accounts were created with 16-character passwords. Typing would silently
    // truncate the password, so assign the field directly.
    st.activeInput = 'accountPassword';
    st.accountPassword = ${JSON.stringify(botPassword)};
    await fr.asyncHandlers.onLogin(st, false);
    note('login');
    if (st.loginError) {
      await fr.asyncHandlers.onLogin(st, true);
      note('login-create');
    }
    let idx = st.roster.findIndex((c) => c.name.toLowerCase() === 'webbotone');
    if (idx < 0 && !st.loginError) {
      st.stage = 'char_create';
      st.selectedClass = 'so';
      st.charName = 'WebBotOne';
      st.isExpansion = true;
      st.isHardcore = false;
      st.isLadder = true;
      await fr.asyncHandlers.onCreateCharacter(st);
      note('create-character');
      idx = st.roster.findIndex((c) => c.name.toLowerCase() === 'webbotone');
    }
    if (idx >= 0) {
      st.selectedSlotIndex = idx;
      await fr.asyncHandlers.onSelectCharacter(st);
      note('select-character');
    }
    return {
      steps,
      lobbyStage: st.stage,
      sessionPhase: app.session.phase,
      selectedChar: app.session.selectedChar,
      loginError: st.loginError,
    };
  })()`)
  console.log('[verify-environment] Gate 1a (login):', JSON.stringify(login, null, 1))
  if (login.lobbyStage !== 'bnet_lobby' || login.sessionPhase !== 'lobby' || !login.selectedChar) {
    fail('Gate 1 failed: Battle.net login / character select', login)
  }

  const gameName = `wbenv${Date.now() % 100000}`
  const ingame = await cdp.evaluate<{
    phase: string
    areaId: number
    selfId: number
    tilePages: number
    disconnectReason: string | null
  }>(`(async () => {
    const app = window.__d2Play;
    const fr = app.frontendRenderer;
    const st = app.flowState;
    st.lobbySubPanel = 'create';
    st.gameName = ${JSON.stringify(gameName)};
    st.gamePassword = '';
    st.difficulty = 'normal';
    await fr.asyncHandlers.onCreateGame(st);
    await app.assetsReadyPromise;
    for (let i = 0; i < 60; i++) {
      app.renderFrame(performance.now());
      await new Promise((r) => setTimeout(r, 100));
      if (
        app.session.phase === 'ingame' &&
        app.session.world.selfId > 0 &&
        app.session.world.areaId > 0 &&
        app.tileGpuCache.loadedPageCount > 0
      ) {
        break;
      }
    }
    if (app.entityArtCache?.waitForInflight) await app.entityArtCache.waitForInflight();
    for (let i = 0; i < 6; i++) {
      app.renderFrame(performance.now());
      await new Promise((r) => setTimeout(r, 50));
    }
    return {
      phase: app.session.phase,
      areaId: app.session.world.areaId,
      selfId: app.session.world.selfId,
      tilePages: app.tileGpuCache.loadedPageCount,
      disconnectReason: app.session.disconnectReason,
    };
  })()`)
  console.log('[verify-environment] Gate 1b (game):', { gameName, ...ingame })
  if (ingame.phase !== 'ingame' || ingame.areaId !== 1 || ingame.selfId <= 0 || ingame.tilePages === 0) {
    fail('Gate 1 failed: create game / enter the Rogue Encampment', ingame)
  }
  await cdp.evaluate(`window.__d2Play.settings.update({ lightingPreset: 'auto', viewport: '800x600' })`)
}

async function gateLiveSync(cdp: CdpSession): Promise<void> {
  interface RecordedEvent {
    readonly type: string
    readonly unitType?: number
    readonly cycleIndex?: number
    readonly ticks?: number
    readonly eclipse?: boolean
  }
  const live = await cdp.evaluate<{
    events: RecordedEvent[]
    clock: ClockState
    disconnectReason: string | null
    phase: string
  }>(`(() => ({
    events: window.__envEvents,
    clock: ${CLOCK_JS},
    disconnectReason: window.__d2Play.session.disconnectReason,
    phase: window.__d2Play.session.phase,
  }))()`)
  const types = live.events.map((e) => e.type)
  const playerAssignAt = live.events.findIndex((e) => e.type === 'UnitAssign' && e.unitType === 0)
  const loadActAt = types.indexOf('LoadAct')
  const syncAt = types.indexOf('EnvironmentSync')
  const syncs = live.events.filter((e) => e.type === 'EnvironmentSync')
  const sync = syncs[0]
  const summary = {
    events: live.events.length,
    playerAssignAt,
    loadActAt,
    syncAt,
    sync,
    clock: live.clock,
    disconnectReason: live.disconnectReason,
    phase: live.phase,
    around: types.slice(Math.max(0, loadActAt - 2), loadActAt + 3),
  }
  console.log('[verify-environment] Gate 2 (live S2C 0x53):', summary)
  if (
    live.phase !== 'ingame' ||
    live.disconnectReason !== null ||
    syncs.length !== 1 ||
    sync === undefined ||
    playerAssignAt < 0 ||
    playerAssignAt > syncAt ||
    loadActAt < 0 ||
    syncAt !== loadActAt + 1 ||
    sync.cycleIndex === undefined ||
    sync.eclipse === undefined
  ) {
    fail('Gate 2 failed: expected one S2C 0x53 right after S2C 0x03 and after the S2C 0x59 player', summary)
  }
  // Seconds of 25 Hz frames since the sync can move the clock to the next row at most.
  const nextRow = (sync.cycleIndex + 1) % 6
  if (
    (live.clock.cycleIndex !== sync.cycleIndex && live.clock.cycleIndex !== nextRow) ||
    live.clock.eclipse !== sync.eclipse
  ) {
    fail('Gate 2 failed: the clock does not follow the live S2C 0x53', summary)
  }
}

async function gatePeriods(cdp: CdpSession): Promise<void> {
  for (const pc of PERIOD_CASES) {
    const ticks = pc.ticks
    const packet = [
      0x53,
      pc.cycleIndex & 0xff,
      0,
      0,
      0,
      ticks & 0xff,
      (ticks >>> 8) & 0xff,
      (ticks >>> 16) & 0xff,
      (ticks >>> 24) & 0xff,
      0,
    ]
    const res = await cdp.evaluate<{
      eventType: string
      afterSync: ClockState
      afterFrame: ClockState
      atRender: ClockState
      cells: { total: number; outOfReach: number; clockLit: number; records: number }
      fires: { id: number; mode: number }[]
      fireLights: number
      disconnectReason: string | null
    }>(`(async () => {
      const { getLightingPassState } = await import('/src/client/scene/lighting-presets.ts');
      const app = window.__d2Play;
      const clock = () => ${CLOCK_JS};
      const ev = app.session.handleS2cPacket(new Uint8Array(${JSON.stringify(packet)}));
      const afterSync = clock();
      app.session.tick(40, performance.now());
      const afterFrame = clock();
      app.renderFrame(performance.now());
      const atRender = clock();
      const g = app.lightGrid;
      // Issue #830: a grid corner (gx, gy) is the sub-tile corner (oX + gx, oY + gy) at x8 = sub * 8. A light record
      // reaches it only when fastDistanceApprox(light - corner) < r (0x6fb59860 / 0x6fb59480); every other corner
      // keeps the room-ambient prefill, here the act clock (0x6fb59c90).
      const records = [...getLightingPassState(g).lights].map((l) => ({ x8: l.x8, y8: l.y8, r: l.r }));
      const dist = (dx, dy) => {
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        return ax >= ay ? (ax * 983 + ay * 407) >> 10 : (ay * 983 + ax * 407) >> 10;
      };
      let outOfReach = 0;
      let clockLit = 0;
      for (let gy = 0; gy < 48; gy++) {
        for (let gx = 0; gx < 48; gx++) {
          const x8 = (g.originSubX + gx) * 8;
          const y8 = (g.originSubY + gy) * 8;
          if (records.some((l) => dist(l.x8 - x8, l.y8 - y8) < l.r)) continue;
          outOfReach++;
          const i = gy * 48 + gx;
          if (
            g.intensity[i] === atRender.intensity &&
            g.red[i] === atRender.rgb[0] &&
            g.green[i] === atRender.rgb[1] &&
            g.blue[i] === atRender.rgb[2]
          ) {
            clockLit++;
          }
        }
      }
      const fires = app.session.world
        .getUnitsByType('object')
        .filter((u) => u.classId === ${CAMPFIRE_CLASS})
        .map((u) => ({ id: u.id, mode: u.mode }));
      const snap = app.getLastRenderSnapshot();
      const want = ${JSON.stringify(CAMPFIRE_LIGHT)};
      // The campfire's light is the one on its sub-tile (scene-local, as its drawable): the town torches
      // (Objects.txt 37, Lit 19) carry the same radius-9 255 / 236 / 176 light (issue #827).
      const fireAt = (snap?.entities.unitDrawables ?? [])
        .filter((d) => d.unitKind === 'object' && fires.some((f) => f.id === d.unitId))
        .map((d) => [d.subX, d.subY]);
      const fireLights = (snap?.entities.pointLights ?? []).filter(
        (l) =>
          l.radius === want.radius && l.intensity === want.intensity && l.r === want.r && l.g === want.g && l.b === want.b &&
          fireAt.some(([x, y]) => x === l.subTileX && y === l.subTileY),
      ).length;
      return {
        eventType: ev.type,
        afterSync,
        afterFrame,
        atRender,
        cells: { total: g.intensity.length, outOfReach, clockLit, records: records.length },
        fires,
        fireLights,
        disconnectReason: app.session.disconnectReason,
      };
    })()`)
    await sleep(150)
    const shotBytes = await cdp.captureScreenshot(join(OUT_DIR, `period-${pc.name}.png`))
    console.log(`[verify-environment] Gate 3 (${pc.name}):`, { ...res, shotBytes })

    const s = res.afterSync
    const f = res.afterFrame
    const want = pc.afterFrame
    if (
      res.eventType !== 'EnvironmentSync' ||
      res.disconnectReason !== null ||
      s.cycleIndex !== pc.cycleIndex ||
      s.period !== pc.afterSync.period ||
      s.ticks !== pc.afterSync.ticks ||
      s.intensity !== pc.afterSync.intensity ||
      f.cycleIndex !== want.cycleIndex ||
      f.period !== want.period ||
      f.ticks !== want.ticks ||
      f.intensity !== want.intensity ||
      f.rgb[0] !== want.rgb[0] ||
      f.rgb[1] !== want.rgb[1] ||
      f.rgb[2] !== want.rgb[2]
    ) {
      fail(`Gate 3 (${pc.name}) failed: clock state differs from the 1.13c goldens`, res)
    }
    // Every grid corner out of reach of every light record (the player light, the object lights, ...) keeps the
    // clock light exactly.
    if (res.cells.records === 0 || res.cells.outOfReach === 0 || res.cells.clockLit !== res.cells.outOfReach) {
      fail(`Gate 3 (${pc.name}) failed: light grid prefill is not the clock light`, res.cells)
    }
    if (res.fires.length === 0 || res.fires.some((fire) => fire.mode !== pc.fireMode)) {
      fail(`Gate 3 (${pc.name}) failed: campfire mode is not ${String(pc.fireMode)}`, res.fires)
    }
    const wantLights = pc.fireMode === 1 ? res.fires.length : 0
    if (res.fireLights !== wantLights) {
      fail(`Gate 3 (${pc.name}) failed: expected ${String(wantLights)} campfire light(s)`, res)
    }
  }
}

/**
 * Gate 5 (issues #827, #830): every drawn object whose Objects.txt `Lit[mode]` gives a light carries exactly that light
 * (SetObjectLight 0x6fad4920: radius min(Lit >> 1, 18), intensity 255, Objects.txt RGB, on its sub-tile), and every
 * other drawn object carries none. Live Rogue Encampment objects from the server, after their lights settled; the
 * expected values come from the MPQ, not from the port's generated table.
 */
async function gateObjectLights(cdp: CdpSession, rows: readonly ObjectLightRow[]): Promise<void> {
  await sleep(2000)
  const res = await cdp.evaluate<{
    objects: {
      id: number
      classId: number
      mode: number
      x: number
      y: number
      initSeed: number
      seedLo: number
      seedHi: number
      queuedCount: number
    }[]
    lights: { subTileX: number; subTileY: number; radius: number; intensity: number; r: number; g: number; b: number }[]
    records: { unitId: number; type: number; r: number; x8: number; y8: number; i: number; red: number; green: number; blue: number }[]
    queueProbe: {
      queuedBeforeTick: number
      modeBeforeTick: number
      queuedAfterTick: number
      modeAfterTick: number
    } | null
  }>(`(async () => {
    const { getLightingPassState } = await import('/src/client/scene/lighting-presets.ts');
    const app = window.__d2Play;
    app.renderFrame(performance.now());
    const snap = app.getLastRenderSnapshot();
    // Point lights use the scene's level-local sub-tiles, like the drawables (world position minus the shift).
    const drawn = new Map(
      snap.entities.unitDrawables.filter((d) => d.unitKind === 'object').map((d) => [d.unitId, d]),
    );
    const allObjects = app.session.world.getUnitsByType('object');
    let queueProbe = null;
    if (allObjects.length > 0) {
      const target = allObjects[0];
      const origMode = target.mode;
      app.session.world.apply({
        type: 'UnitMode',
        unitType: 2,
        id: target.id,
        mode: origMode,
        eventCode: 3,
        eventFlag: 0,
      });
      const queuedBeforeTick = target.queuedPackets.length;
      const modeBeforeTick = target.mode;
      app.session.world.tick(40);
      queueProbe = {
        queuedBeforeTick,
        modeBeforeTick,
        queuedAfterTick: target.queuedPackets.length,
        modeAfterTick: target.mode,
      };
    }
    app.renderFrame(performance.now());
    const snapAfter = app.getLastRenderSnapshot();
    const drawnAfter = new Map(
      snapAfter.entities.unitDrawables.filter((d) => d.unitKind === 'object').map((d) => [d.unitId, d]),
    );
    const objects = app.session.world
      .getUnitsByType('object')
      .filter((u) => drawnAfter.has(u.id))
      .map((u) => ({
        id: u.id,
        classId: u.classId,
        mode: u.mode,
        x: drawnAfter.get(u.id).subX,
        y: drawnAfter.get(u.id).subY,
        initSeed: u.initSeed,
        seedLo: u.seed.lo,
        seedHi: u.seed.hi,
        queuedCount: u.queuedPackets.length,
      }));
    const lights = snapAfter.entities.pointLights.map((l) => ({
      subTileX: l.subTileX, subTileY: l.subTileY, radius: l.radius, intensity: l.intensity, r: l.r, g: l.g, b: l.b,
    }));
    // Issue #830: the object lights as records of the 1.13c light list (unit type 2).
    const records = [...getLightingPassState(app.lightGrid).lights]
      .filter((l) => l.unitType === 2)
      .map((l) => ({
        unitId: l.unitId, type: l.type, r: l.r, x8: l.x8, y8: l.y8, i: l.intensity, red: l.red, green: l.green, blue: l.blue,
      }));
    return { objects, lights, records, queueProbe };
  })()`)
  const problems: string[] = []
  const litByClass = new Map<number, number>()
  let roomSeededObjects = 0
  if (
    !res.queueProbe ||
    res.queueProbe.queuedBeforeTick !== 1 ||
    res.queueProbe.queuedAfterTick !== 0
  ) {
    problems.push(`S2C 0x0E queue probe failed: ${JSON.stringify(res.queueProbe)}`)
  }
  for (const o of res.objects) {
    const row = rows[o.classId]
    const label = `object ${String(o.id)} (class ${String(o.classId)}, mode ${String(o.mode)}) at ${String(o.x)},${String(o.y)}`
    if (row === undefined || !Number.isInteger(o.mode) || o.mode < 0 || o.mode > 7) {
      problems.push(`${label}: no Objects.txt record / bad mode`)
      continue
    }
    if (o.initSeed !== 1) {
      roomSeededObjects += 1
    } else {
      problems.push(`${label}: initSeed was not derived from active room seed (initSeed=${String(o.initSeed)})`)
    }
    if (o.queuedCount !== 0) {
      problems.push(`${label}: undrained queuedPackets (${String(o.queuedCount)})`)
    }
    const radius = Math.min(row.lit[o.mode]! >> 1, 18)
    const at = res.lights.filter(
      (l) => l.subTileX === o.x && l.subTileY === o.y && l.r === row.r && l.g === row.g && l.b === row.b,
    )
    const recs = res.records.filter((l) => l.unitId === o.id)
    if (radius > 0) {
      litByClass.set(o.classId, (litByClass.get(o.classId) ?? 0) + 1)
      if (at.length !== 1 || at[0]!.radius !== radius || at[0]!.intensity !== 255) {
        problems.push(`${label}: want one light r${String(radius)} I255 ${String(row.r)}/${String(row.g)}/${String(row.b)}, got ${JSON.stringify(at)}`)
      }
      const rec = recs[0]
      if (
        recs.length !== 1 ||
        rec === undefined ||
        rec.type !== 2 ||
        rec.r !== radius * 8 ||
        rec.i !== 255 ||
        rec.red !== row.r ||
        rec.green !== row.g ||
        rec.blue !== row.b ||
        rec.x8 !== o.x * 8 + 4 ||
        rec.y8 !== o.y * 8 + 4
      ) {
        problems.push(`${label}: want one type-2 light record r${String(radius * 8)} at x8 ${String(o.x * 8 + 4)}, got ${JSON.stringify(recs)}`)
      }
    } else if (at.length !== 0 || recs.length !== 0) {
      problems.push(`${label}: Lit${String(o.mode)} = ${String(row.lit[o.mode])} but it carries ${JSON.stringify({ at, recs })}`)
    }
  }
  const litObjects = [...litByClass.values()].reduce((a, b) => a + b, 0)
  console.log('[verify-environment] Gate 5 (object lights & #874 room seed / 0x0E queue):', {
    drawnObjects: res.objects.length,
    roomSeededObjects,
    litObjects,
    litByClass: Object.fromEntries(litByClass),
    pointLights: res.lights.length,
    lightRecords: res.records.length,
    queueProbe: res.queueProbe,
    problems: problems.length,
  })
  if (problems.length > 0) {
    console.log('[verify-environment] Gate 5 sample:', { objects: res.objects.slice(0, 4), lights: res.lights.slice(0, 4) })
  }
  if (litObjects === 0) problems.push('no lit object is drawn')
  if (problems.length > 0) fail('Gate 5 failed', problems.slice(0, 30))
}

/** The session quest special light state as the live page sees it (Gate 6). */
interface QuestLightState {
  readonly recv: boolean
  readonly avail: readonly number[]
  readonly world: readonly number[]
  readonly denTimer: number
  readonly denDone: boolean
  readonly act4Red: boolean
  readonly fadeActive: boolean
  readonly lights: Readonly<Record<string, unknown>>
}

/**
 * Gate 6 (issue #826): S2C 0x5E reached the quest special lights, and in the fresh game only the Den of Evil can
 * answer: red 255 / 64 / 48 at intensity 0x50 while A1Q1 is live and its fade has not started (DenLight 0x6fb024d0).
 */
async function gateQuestLights(cdp: CdpSession): Promise<void> {
  const res = await cdp.evaluate<QuestLightState>(`(() => {
    const app = window.__d2Play;
    const q = app.session.questFxLight;
    const s = q.snapshot();
    const light = (id) => {
      try {
        return q.special(id);
      } catch (e) {
        return { error: String(e) };
      }
    };
    return {
      recv: s.questAvailRecv,
      avail: Array.from(s.questAvail),
      world: Array.from(app.session.world.gameQuestAvailability),
      denTimer: s.denTimer,
      denDone: s.denDone,
      act4Red: s.act4Red,
      fadeActive: s.fade.active,
      lights: { 1: light(1), 8: light(8), 107: light(107), 108: light(108) },
    };
  })()`)
  console.log('[verify-environment] Gate 6 (quest lights):', res)
  const problems: string[] = []
  if (!res.recv) problems.push('no S2C 0x5E reached the quest special lights')
  if (res.avail.length !== 37 || JSON.stringify(res.avail) !== JSON.stringify(res.world)) {
    problems.push('the session 0x5E copy differs from the world copy')
  }
  if (res.act4Red || res.fadeActive) problems.push('an Act 4 red light or a fade is on in a fresh game')
  for (const id of ['1', '107', '108']) {
    if (res.lights[id] !== null) problems.push(`level ${id}: special light ${JSON.stringify(res.lights[id])}`)
  }
  const den = res.lights['8']
  const denWanted = res.avail[1] !== 0 && !res.denDone && res.denTimer === -1
  const denOk = denWanted
    ? JSON.stringify(den) === JSON.stringify({ intensity: 0x50, red: 255, green: 64, blue: 48, source: 'den' })
    : res.avail[1] === 0 || res.denDone
      ? den === null
      : false
  if (!denOk) {
    problems.push(`level 8: special light ${JSON.stringify(den)} (A1Q1 ${String(res.avail[1])}, timer ${String(res.denTimer)})`)
  }
  if (problems.length > 0) fail('Gate 6 failed', problems)
}

/**
 * Gate 7 (issue #876): skill cast light (0x6fb50f60).
 * Fire Bolt (36) ramps from radius 1 (r=8 + 8 = 16) to min(Light, 18) = 7 (r=56) with RGB 255/178/64,
 * recasting Ice Bolt (39) immediately frees the old record and creates a new one with RGB 81/81/255,
 * and ending the cast frees the record immediately.
 */
async function gateCastLight(cdp: CdpSession): Promise<void> {
  const problems: string[] = []

  // Step 1: Spec lookup, Fire Bolt cast, ramp sequence, and screenshot.
  const fbRes = await cdp.evaluate<{
    spec: {
      firebolt: readonly [light: number, red: number, green: number, blue: number]
      icebolt: readonly [light: number, red: number, green: number, blue: number]
      attack: readonly [light: number, red: number, green: number, blue: number]
      oobNegOk: boolean
      oobPosOk: boolean
    }
    emitter: {
      slot: string
      unitType: number
      unitId: number
      lightType: number
      radius: number
      targetRadius: number
      red: number
      green: number
      blue: number
    } | null
    fireboltRamp: number[]
    record: {
      unitType: number
      unitId: number
      type: number
      r: number
      target: number
      red: number
      green: number
      blue: number
    } | null
  }>(`(async () => {
    const { skillCastLight113c } = await import('/src/common/units/light-sources-113c.ts');
    const { getLightingPassState } = await import('/src/client/scene/lighting-presets.ts');
    const app = window.__d2Play;
    const world = app.session.world;
    const player = world.getUnit('player', world.selfId);
    if (!player) throw new Error('Player unit not found');

    const firebolt = skillCastLight113c(36);
    const icebolt = skillCastLight113c(39);
    const attack = skillCastLight113c(0);
    let oobNegOk = false;
    try { skillCastLight113c(-1); } catch (e) { oobNegOk = e instanceof RangeError; }
    let oobPosOk = false;
    try { skillCastLight113c(357); } catch (e) { oobPosOk = e instanceof RangeError; }

    const now = performance.now();
    player.castState = {
      skillId: 36,
      targetX: player.x,
      targetY: player.y,
      mode: player.mode,
      startedAtMs: now,
      untilMs: now + 100000,
      durationMs: 100000,
      elapsedMs: 0,
    };

    const src = app.session.sceneSource;
    const inputs0 = src.buildLightingInputs('auto');
    const rawEmitter = inputs0.lightEmitters.find((e) => e.slot === 'cast') ?? null;
    const emitter = rawEmitter ? {
      slot: rawEmitter.slot,
      unitType: rawEmitter.unitType,
      unitId: rawEmitter.unitId,
      lightType: rawEmitter.lightType,
      radius: rawEmitter.radius,
      targetRadius: rawEmitter.targetRadius,
      red: rawEmitter.red,
      green: rawEmitter.green,
      blue: rawEmitter.blue,
    } : null;

    app.session.tick(40, performance.now());
    app.renderFrame(performance.now());

    const passSt = getLightingPassState(app.lightGrid);
    const key = '0:' + player.id + ':cast';
    const rec0 = passSt.tracked.get(key)?.rec ?? null;
    const fireboltRamp = [];
    if (rec0) fireboltRamp.push(rec0.r);

    for (let i = 0; i < 5; i++) {
      app.session.tick(40, performance.now());
      app.renderFrame(performance.now());
      const rec = passSt.tracked.get(key)?.rec;
      if (rec) fireboltRamp.push(rec.r);
    }

    const currentRec = passSt.tracked.get(key)?.rec ?? null;
    const record = currentRec ? {
      unitType: currentRec.unitType,
      unitId: currentRec.unitId,
      type: currentRec.type,
      r: currentRec.r,
      target: currentRec.target,
      red: currentRec.red,
      green: currentRec.green,
      blue: currentRec.blue,
    } : null;

    return {
      spec: { firebolt, icebolt, attack, oobNegOk, oobPosOk },
      emitter,
      fireboltRamp,
      record,
    };
  })()`)

  await sleep(150)
  const fbShotBytes = await cdp.captureScreenshot(join(OUT_DIR, 'cast-light-firebolt.png'))

  if (
    fbRes.spec.firebolt[0] !== 7 ||
    fbRes.spec.firebolt[1] !== 255 ||
    fbRes.spec.firebolt[2] !== 178 ||
    fbRes.spec.firebolt[3] !== 64
  ) {
    problems.push(`Fire Bolt spec mismatch: ${JSON.stringify(fbRes.spec.firebolt)}`)
  }
  if (
    fbRes.spec.icebolt[0] !== 7 ||
    fbRes.spec.icebolt[1] !== 81 ||
    fbRes.spec.icebolt[2] !== 81 ||
    fbRes.spec.icebolt[3] !== 255
  ) {
    problems.push(`Ice Bolt spec mismatch: ${JSON.stringify(fbRes.spec.icebolt)}`)
  }
  if (
    fbRes.spec.attack[0] !== 0 ||
    fbRes.spec.attack[1] !== 0 ||
    fbRes.spec.attack[2] !== 0 ||
    fbRes.spec.attack[3] !== 0
  ) {
    problems.push(`Attack spec mismatch: ${JSON.stringify(fbRes.spec.attack)}`)
  }
  if (!fbRes.spec.oobNegOk || !fbRes.spec.oobPosOk) {
    problems.push(`Out-of-bounds check failed (oobNeg: ${String(fbRes.spec.oobNegOk)}, oobPos: ${String(fbRes.spec.oobPosOk)})`)
  }

  if (
    !fbRes.emitter ||
    fbRes.emitter.slot !== 'cast' ||
    fbRes.emitter.unitType !== 0 ||
    fbRes.emitter.lightType !== 1 ||
    fbRes.emitter.radius !== 1 ||
    fbRes.emitter.targetRadius !== 7 ||
    fbRes.emitter.red !== 255 ||
    fbRes.emitter.green !== 178 ||
    fbRes.emitter.blue !== 64
  ) {
    problems.push(`Fire Bolt emitter mismatch: ${JSON.stringify(fbRes.emitter)}`)
  }

  const wantRamp = [16, 24, 32, 40, 48, 56]
  if (JSON.stringify(fbRes.fireboltRamp) !== JSON.stringify(wantRamp)) {
    problems.push(`Fire Bolt ramp mismatch: want ${JSON.stringify(wantRamp)}, got ${JSON.stringify(fbRes.fireboltRamp)}`)
  }

  if (
    !fbRes.record ||
    fbRes.record.type !== 1 ||
    fbRes.record.r !== 56 ||
    fbRes.record.target !== 56 ||
    fbRes.record.red !== 255 ||
    fbRes.record.green !== 178 ||
    fbRes.record.blue !== 64
  ) {
    problems.push(`Fire Bolt record mismatch: ${JSON.stringify(fbRes.record)}`)
  }

  // Step 2: Recast Ice Bolt (skill 39), replace existing light immediately
  const ibRes = await cdp.evaluate<{
    record: {
      unitType: number
      unitId: number
      type: number
      r: number
      target: number
      red: number
      green: number
      blue: number
    } | null
  }>(`(async () => {
    const { getLightingPassState } = await import('/src/client/scene/lighting-presets.ts');
    const app = window.__d2Play;
    const world = app.session.world;
    const player = world.getUnit('player', world.selfId);
    if (!player) throw new Error('Player unit not found');

    const now = performance.now();
    player.castState = {
      skillId: 39,
      targetX: player.x,
      targetY: player.y,
      mode: player.mode,
      startedAtMs: now,
      untilMs: now + 100000,
      durationMs: 100000,
      elapsedMs: 0,
    };

    app.session.tick(40, performance.now());
    app.renderFrame(performance.now());

    const passSt = getLightingPassState(app.lightGrid);
    const key = '0:' + player.id + ':cast';
    const rec = passSt.tracked.get(key)?.rec ?? null;
    return {
      record: rec ? {
        unitType: rec.unitType,
        unitId: rec.unitId,
        type: rec.type,
        r: rec.r,
        target: rec.target,
        red: rec.red,
        green: rec.green,
        blue: rec.blue,
      } : null,
    };
  })()`)

  await sleep(150)
  const ibShotBytes = await cdp.captureScreenshot(join(OUT_DIR, 'cast-light-icebolt.png'))

  if (
    !ibRes.record ||
    ibRes.record.type !== 1 ||
    ibRes.record.r !== 16 ||
    ibRes.record.target !== 56 ||
    ibRes.record.red !== 81 ||
    ibRes.record.green !== 81 ||
    ibRes.record.blue !== 255
  ) {
    problems.push(`Ice Bolt recast record mismatch: ${JSON.stringify(ibRes.record)}`)
  }

  // Step 3: End cast, verify light is immediately freed
  const endRes = await cdp.evaluate<{
    trackedExists: boolean
    hasCastInLights: boolean
  }>(`(async () => {
    const { getLightingPassState } = await import('/src/client/scene/lighting-presets.ts');
    const app = window.__d2Play;
    const world = app.session.world;
    const player = world.getUnit('player', world.selfId);
    if (!player) throw new Error('Player unit not found');

    player.castState = undefined;
    app.session.tick(40, performance.now());
    app.renderFrame(performance.now());

    const passSt = getLightingPassState(app.lightGrid);
    const key = '0:' + player.id + ':cast';
    const trackedExists = passSt.tracked.has(key);
    const hasCastInLights = [...passSt.lights].some(
      (l) => l.unitType === 0 && l.unitId === player.id && l.type === 1,
    );
    return { trackedExists, hasCastInLights };
  })()`)

  if (endRes.trackedExists || endRes.hasCastInLights) {
    problems.push(`Cast light was not freed on cast end: ${JSON.stringify(endRes)}`)
  }

  console.log('[verify-environment] Gate 7 (skill cast light 0x6fb50f60):', {
    fireboltRamp: fbRes.fireboltRamp,
    fireboltRecord: fbRes.record,
    iceboltRecord: ibRes.record,
    freedOnEnd: !endRes.trackedExists && !endRes.hasCastInLights,
    fbShotBytes,
    ibShotBytes,
    problems: problems.length,
  })

  if (problems.length > 0) fail('Gate 7 failed', problems)
}

async function gateLevels(cdp: CdpSession, levels: readonly LevelLight[]): Promise<void> {
  const clock = await cdp.evaluate<ClockState>(CLOCK_JS)
  await cdp.evaluate(`(async () => {
    const { resolveLevelAmbient } = await import('/src/common/world/ambient-light.ts');
    const app = window.__d2Play;
    const src = app.session.sceneSource;
    const proto = Object.getPrototypeOf(src);
    const frozenClock = ${JSON.stringify({
      intensity: clock.intensity,
      red: clock.rgb[0],
      green: clock.rgb[1],
      blue: clock.rgb[2],
    })};
    window.__envAudit = { levelId: 0, ambient: null };
    src.buildLightingInputs = (preset) => {
      const base = proto.buildLightingInputs.call(src, preset);
      const audit = window.__envAudit;
      return audit.ambient === null
        ? base
        : { ...base, levelId: audit.levelId, lightEmitters: [], ambient: { playerRoom: audit.ambient, nearRooms: [] } };
    };
    window.__envAuditLevel = (levelId) => {
      const ambient = resolveLevelAmbient(levelId, frozenClock);
      window.__envAudit = { levelId, ambient };
      // The grid is rebuilt once per new game frame (0x6fb3b1ac): advance one before rendering.
      app.session.tick(40, performance.now());
      app.renderFrame(performance.now());
      const g = app.lightGrid;
      const tex = g.textureBuffer;
      const corners = [0, 47, 47 * 48, 48 * 48 - 1].map((i) => [
        g.intensity[i], g.red[i], g.green[i], g.blue[i], tex[i * 4], tex[i * 4 + 1], tex[i * 4 + 2], tex[i * 4 + 3],
      ]);
      const canvas = document.getElementById('view');
      const gl = canvas.getContext('webgl2');
      const w = canvas.width;
      const h = Math.floor(canvas.height * 0.75);
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, canvas.height - h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let i = 0; i < buf.length; i += 16) {
        sr += buf[i]; sg += buf[i + 1]; sb += buf[i + 2]; n++;
      }
      return {
        source: ambient.source,
        light: [ambient.intensity, ambient.red, ambient.green, ambient.blue],
        corners,
        mean: [sr / n, sg / n, sb / n],
        glError: gl.getError(),
      };
    };
  })()`)

  interface LevelResult {
    readonly source: 'levels' | 'environment'
    readonly light: readonly [number, number, number, number]
    readonly corners: readonly (readonly number[])[]
    readonly mean: readonly [number, number, number]
    readonly glError: number
  }
  const results: { readonly level: LevelLight; readonly res: LevelResult }[] = []
  const problems: string[] = []
  try {
    for (const level of levels) {
      const res = await cdp.evaluate<LevelResult>(`window.__envAuditLevel(${String(level.id)})`)
      results.push({ level, res })
      const isClock = (level.red | level.green | level.blue) === 0
      const want = isClock
        ? [clock.intensity, clock.rgb[0], clock.rgb[1], clock.rgb[2]]
        : [level.intensity, level.red, level.green, level.blue]
      const [wi, wr, wg, wb] = want as [number, number, number, number]
      // Texture RGB = floor(I·C / 255) (#830, the vertex colour table of the 3D floor path), A = I.
      const wantTex = [Math.floor((wr * wi) / 255), Math.floor((wg * wi) / 255), Math.floor((wb * wi) / 255), wi]
      if (wi === 0) wantTex.fill(0)
      const label = `level ${String(level.id)} ${level.name}`
      if (res.source !== (isClock ? 'environment' : 'levels')) problems.push(`${label}: source ${res.source}`)
      if (res.light.some((v, i) => v !== want[i])) {
        problems.push(`${label}: ambient ${JSON.stringify(res.light)} != ${JSON.stringify(want)}`)
      }
      for (const c of res.corners) {
        const grid = c.slice(0, 4)
        const tex = c.slice(4)
        if (grid.some((v, i) => v !== want[i]) || tex.some((v, i) => v !== wantTex[i])) {
          problems.push(`${label}: corner cell ${JSON.stringify(c)} != grid ${JSON.stringify(want)} tex ${JSON.stringify(wantTex)}`)
          break
        }
      }
      if (res.glError !== 0) problems.push(`${label}: WebGL error ${String(res.glError)}`)
      if (LEVEL_SHOTS.has(level.id)) {
        await sleep(100)
        await cdp.captureScreenshot(join(OUT_DIR, `level-${String(level.id).padStart(3, '0')}.png`))
      }
    }
  } finally {
    await cdp.evaluate(`(() => {
      delete window.__d2Play.session.sceneSource.buildLightingInputs;
      window.__envAudit = { levelId: 0, ambient: null };
      window.__d2Play.renderFrame(performance.now());
    })()`)
  }

  // The same light must give the same picture (the scene does not move between levels).
  const byLight = new Map<string, { readonly id: number; readonly mean: readonly number[] }>()
  for (const { level, res } of results) {
    const key = res.light.join(',')
    const first = byLight.get(key)
    if (first === undefined) {
      byLight.set(key, { id: level.id, mean: res.mean })
    } else if (res.mean.some((v, i) => Math.abs(v - first.mean[i]!) > 0.5)) {
      problems.push(
        `level ${String(level.id)}: picture ${JSON.stringify(res.mean)} differs from level ${String(first.id)} ${JSON.stringify(first.mean)} under the same light ${key}`,
      )
    }
  }
  // Each picture channel must follow the lightmap channel (floor(rgb * I / 255)).
  const channelR: number[] = []
  for (let ch = 0; ch < 3; ch++) {
    const lightCh = results.map(({ res }) => Math.floor((res.light[ch + 1]! * res.light[0]) / 255))
    const meanCh = results.map(({ res }) => res.mean[ch]!)
    const r = pearson(lightCh, meanCh)
    channelR.push(Number(r.toFixed(4)))
    if (!(r >= 0.95)) problems.push(`channel ${'RGB'[ch]!}: Pearson r ${r.toFixed(4)} < 0.95`)
  }
  const clockLevels = results.filter(({ res }) => res.source === 'environment').map(({ level }) => level.id)
  console.log('[verify-environment] Gate 4 (136-level ambient audit):', {
    levels: results.length,
    clockLevels: clockLevels.length,
    distinctLights: byLight.size,
    channelPearson: channelR,
    problems: problems.length,
  })
  writeFileSync(
    join(OUT_DIR, 'levels-audit.json'),
    JSON.stringify(
      results.map(({ level, res }) => ({ id: level.id, name: level.name, ...res })),
      null,
      1,
    ),
  )
  if (results.length !== 136 || problems.length > 0) {
    fail('Gate 4 failed', problems.slice(0, 30))
  }
}

async function main(): Promise<void> {
  const chromeBin = findChromeBinary()
  mkdirSync(OUT_DIR, { recursive: true })
  const publicDir = process.env.D2W_PUBLIC_DIR ? resolve(process.env.D2W_PUBLIC_DIR) : resolve(ROOT_DIR, 'public')
  const tilesIndexPath = join(publicDir, 'act-packs/tiles/index.json')
  if (!existsSync(tilesIndexPath)) {
    fail(`Missing packed tiles at ${tilesIndexPath}; set D2W_PUBLIC_DIR=<path/to/public>`)
  }
  const levels = await loadLevelLights()
  const objectLightRows = await loadObjectLightRows()
  const botPassword = readBotPassword()

  let viteServer: ViteDevServer | null = null
  const userDataDir = mkdtempSync(join(tmpdir(), 'd2-verify-environment-'))
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
    if (!port) fail('Failed to start the Vite dev server')
    const targetUrl = `http://127.0.0.1:${String(port)}/play.html`
    console.log(`[verify-environment] Vite server listening at ${targetUrl}`)

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
        // Chrome has not written DevToolsActivePort yet.
      }
    }
    if (cdpPort === null) fail(`Chrome failed to write DevToolsActivePort: ${chromeStderr.slice(-500)}`)

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
        // Keep polling.
      }
    }
    if (pageWsUrl === null) fail('Failed to attach to a page target in headless Chrome')

    cdp = await CdpSession.connect(pageWsUrl)
    await cdp.send('Page.navigate', { url: targetUrl })

    await bootAndEnterGame(cdp, botPassword)
    await gateLiveSync(cdp)
    await gateObjectLights(cdp, objectLightRows)
    await gateQuestLights(cdp)
    await gateCastLight(cdp)
    await gatePeriods(cdp)
    await gateLevels(cdp, levels)

    if (cdp.consoleErrors.length > 0 || cdp.pageExceptions.length > 0) {
      fail('Unexpected console/page errors', { consoleErrors: cdp.consoleErrors, pageExceptions: cdp.pageExceptions })
    }
    console.log(`[verify-environment] PASS — all gates passed; screenshots in ${OUT_DIR}`)
  } finally {
    cdp?.close()
    chromeProc?.kill('SIGKILL')
    if (viteServer) await viteServer.close()
    try {
      rmSync(userDataDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup error.
    }
  }
}

main().catch((err) => {
  console.error('[verify-environment] FATAL:', err)
  process.exit(1)
})
